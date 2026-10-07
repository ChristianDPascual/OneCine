import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

// Botones del final de una compra (entradas o solo candy):
//  · Descargar (principal, a todo el ancho)
//  · Ver mis compras (solo cliente registrado) y Volver al inicio, en una fila
// Para el invitado, "Volver al inicio" queda en gris hasta que descargue el comprobante.
// No usa [disabled] para que el clic llegue y el guard de salida muestre la alerta.
@Component({
  selector: 'app-acciones-compra',
  imports: [RouterLink],
  templateUrl: './acciones-compra.html',
  styleUrl: './acciones-compra.css',
})
export class AccionesCompra {
  readonly descargando = input(false);
  readonly descargado = input(false);
  readonly tieneEntradas = input(true);
  readonly logueado = input(false);
  // Invitado que todavía no descargó el comprobante
  readonly bloqueado = input(false);

  readonly descargar = output<void>();
  readonly volver = output<void>();
}