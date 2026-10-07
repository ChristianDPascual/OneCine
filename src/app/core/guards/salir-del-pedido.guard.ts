import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { CarritoService } from '../services/carrito.service';
import { ConfirmacionService } from '../services/confirmacion.service';

// Lo implementa la pantalla de compra: true si hay butacas elegidas y todavía no se pagó
export interface ConPedidoEnCurso {
  pedidoEnCurso(): boolean;
}

// Pasos del recorrido de compra: ir de uno a otro no pregunta nada
//  · elegir película (/candy/funcion) → comprar (/comprar/…)
//  · volver a sumar productos al candy: "Modificar pedido" (desde /candy/funcion)
//    o "Agregar más productos" (desde /comprar-candy)
// Lo implementan las pantallas que terminan una compra (entradas y solo candy):
// un invitado no puede irse sin descargar el comprobante, porque es la única copia de su QR
export interface ConComprobantePendiente {
  comprobantePendiente(): boolean;
  descargarComprobante(): Promise<void>;
}

function sigueEnLaCompra(desde: string, hacia: string): boolean {
  if (hacia.startsWith('/comprar') || hacia.startsWith('/candy/funcion')) {
    return true;
  }
  const vuelveAlCandy = desde.startsWith('/candy/funcion') || desde.startsWith('/comprar-candy');
  return vuelveAlCandy && hacia.startsWith('/candy');
}

function comprobanteSinDescargar(componente: unknown): ConComprobantePendiente | null {
  const pantalla = componente as Partial<ConComprobantePendiente> | null;
  return typeof pantalla?.comprobantePendiente === 'function' && pantalla.comprobantePendiente()
    ? (pantalla as ConComprobantePendiente)
    : null;
}

function tienePedidoEnCurso(componente: unknown): boolean {
  const pantalla = componente as Partial<ConPedidoEnCurso> | null;
  return typeof pantalla?.pedidoEnCurso === 'function' && pantalla.pedidoEnCurso();
}

// Al salir de una pantalla del pedido:
//  · invitado que pagó y no descargó el PDF → NO lo deja salir (puede descargarlo desde la alerta).
//  · con butacas elegidas (pantalla de compra) → SIEMPRE pregunta, aunque vaya a
//    "Cambiar función": la reserva se libera al salir.
//  · solo con productos del candy → pregunta si se va fuera del recorrido de compra.
// Si confirma y se va fuera del recorrido, además se vacía el carrito.
export const salirDelPedidoGuard: CanDeactivateFn<unknown> = async (componente, _ruta, actual, siguiente) => {
  const carrito = inject(CarritoService);
  const confirmacion = inject(ConfirmacionService);

  // Compra terminada como invitado, sin descargar el comprobante: no se puede salir
  const pendiente = comprobanteSinDescargar(componente);
  if (pendiente) {
    const descargar = await confirmacion.preguntar({
      titulo: 'Descargá tu comprobante',
      mensaje: 'Compraste como invitado: el comprobante (PDF) tiene el QR para ingresar y retirar el candy. ' +
        'Si salís sin descargarlo, no vas a poder recuperar esta compra.',
      textoConfirmar: 'Descargar PDF',
      textoCancelar: 'Seguir acá',
    });
    if (descargar) {
      await pendiente.descargarComprobante();
    }
    return false;
  }

  const conProductos = !carrito.vacio();
  const conButacas = tienePedidoEnCurso(componente);
  const dentroDelRecorrido = sigueEnLaCompra(actual.url, siguiente.url);
  const vaciaCarrito = conProductos && !dentroDelRecorrido;

  if (!conButacas && !vaciaCarrito) {
    return true;
  }

  const seVaAPerder = [
    conButacas ? 'se va a liberar la reserva de tus butacas' : null,
    vaciaCarrito ? 'se va a vaciar tu pedido del candy' : null,
  ].filter(Boolean).join(' y ');

  const salir = await confirmacion.preguntar({
    titulo: conButacas && dentroDelRecorrido ? '¿Cambiar de función?' : '¿Abandonar la compra?',
    mensaje: `Si salís ahora, ${seVaAPerder}.`,
    textoConfirmar: conButacas && dentroDelRecorrido ? 'Cambiar función' : 'Salir',
    textoCancelar: 'Seguir comprando',
  });

  if (salir && vaciaCarrito) {
    carrito.vaciar();
  }
  return salir;
};