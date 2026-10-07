import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ConComprobantePendiente } from '../../core/guards/salir-del-pedido.guard';
import { ComprasService } from '../../core/services/compras.service';
import { CarritoService, LineaCarrito, MAXIMO_POR_ITEM } from '../../core/services/carrito.service';
import { LoadingService } from '../../core/services/loading.service';
import { CompraConfirmada, DescuentoAplicable, OpcionCanje, esError, mensajeErrorCompra, qrCompra } from '../../core/models/compra.model';
import { ProductosService } from '../../core/services/productos.service';
import { PagoPuntos } from '../../components/pago-puntos/pago-puntos';
import { PagoCredito } from '../../components/pago-credito/pago-credito';
import { AccionesCompra } from '../../components/acciones-compra/acciones-compra';
import { AuthService } from '../../core/services/auth.service';
import { ComprobanteService } from '../../core/services/comprobante.service';
import { Alerta } from '../../components/alerta/alerta';
import { CodigoQr } from '../../components/codigo-qr/codigo-qr';
import { Contador } from '../../components/contador/contador';

// Compra solo de candy (sin entradas): carrito → pago simulado → QR para retirar
@Component({
  selector: 'app-compra-candy',
  imports: [CurrencyPipe, DecimalPipe, RouterLink, Alerta, CodigoQr, Contador, PagoPuntos, PagoCredito, AccionesCompra],
  templateUrl: './compra-candy.html',
  styleUrl: './compra-candy.css',
})
export class CompraCandy implements OnInit, ConComprobantePendiente {
  private readonly compras = inject(ComprasService);
  private readonly loading = inject(LoadingService);
  protected readonly carrito = inject(CarritoService);

  protected readonly descuento = signal<DescuentoAplicable | null>(null);
  protected readonly metodoPago = signal<'credito' | 'debito' | 'mercadopago'>('credito');
  protected readonly pagando = signal(false);
  protected readonly mensajeError = signal<string | null>(null);

  // Resultado de la compra (el carrito se vacía al pagar, por eso se guarda lo comprado)
  protected readonly compra = signal<CompraConfirmada | null>(null);
  protected readonly comprado = signal<LineaCarrito[]>([]);
  protected readonly qrCompra = qrCompra;
  protected readonly auth = inject(AuthService);
  private readonly comprobante = inject(ComprobanteService);
  protected readonly descargando = signal(false);
  protected readonly descargado = signal(false);
  private readonly router = inject(Router);

  // Invitado que ya pagó y todavía no descargó el PDF (lo usa el guard de salida)
  comprobantePendiente(): boolean {
    return this.compra() !== null && this.auth.esInvitado() && !this.descargado();
  }

  // Cerrar o recargar la pestaña sin el PDF: el navegador muestra su propio aviso
  @HostListener('window:beforeunload', ['$event'])
  protected alCerrarPestana(evento: BeforeUnloadEvent): void {
    if (this.comprobantePendiente()) {
      evento.preventDefault();
    }
  }

  // "Volver al inicio": si falta el PDF, el guard muestra la alerta y no deja salir
  protected volverAlInicio(): void {
    this.router.navigateByUrl('/');
  }
  protected readonly maximo = MAXIMO_POR_ITEM;

  // ---------- Puntos (solo clientes registrados) ----------
  private readonly productosService = inject(ProductosService);
  // id de producto → puntos para canjear una unidad (null = no se canjea)
  private readonly puntosPorProducto = signal(new Map<number, number | null>());
  protected readonly saldoPuntos = signal<number | null>(null);
  protected readonly seleccionPuntos = signal<Record<string, number>>({});

  // ---------- Crédito a favor (solo clientes registrados) ----------
  protected readonly saldoCredito = signal<number | null>(null);
  protected readonly usarCredito = signal(false);

  protected readonly opcionesCanje = computed<OpcionCanje[]>(() =>
    this.carrito.lineas()
      .filter(l => l.tipo === 'producto' && this.puntosPorProducto().get(l.id))
      .map(l => ({ clave: `producto-${l.id}`, nombre: l.nombre, puntos: this.puntosPorProducto().get(l.id)!, maximo: l.cantidad })),
  );

  // Unidades canjeadas, recortadas por si después se quitaron productos
  private canjeadas(clave: string): number {
    const opcion = this.opcionesCanje().find(o => o.clave === clave);
    return opcion ? Math.min(this.seleccionPuntos()[clave] ?? 0, opcion.maximo) : 0;
  }

  protected readonly puntosUsados = computed(() =>
    this.opcionesCanje().reduce((t, o) => t + this.canjeadas(o.clave) * o.puntos, 0),
  );
  protected readonly valorCanjeado = computed(() =>
    this.carrito.lineas()
      .filter(l => l.tipo === 'producto')
      .reduce((t, l) => t + this.canjeadas(`producto-${l.id}`) * l.precio, 0),
  );

  // Estimado para mostrar: el total real lo calcula la base al confirmar.
  // El descuento se aplica sobre lo que se paga con dinero.
  protected readonly aPagarConDinero = computed(() => this.carrito.total() - this.valorCanjeado());
  protected readonly montoDescuento = computed(() => {
    const d = this.descuento();
    return d ? Math.round(this.aPagarConDinero() * d.porcentaje) / 100 : 0;
  });
  // Después de puntos y descuento: lo que se cubre con crédito y/o dinero
  protected readonly aPagarAntesCredito = computed(() => this.aPagarConDinero() - this.montoDescuento());
  protected readonly creditoAplicado = computed(() =>
    this.usarCredito() ? Math.min(this.saldoCredito() ?? 0, this.aPagarAntesCredito()) : 0,
  );
  // Lo que se paga con DINERO (sobre esto se ganan puntos)
  protected readonly total = computed(() => this.aPagarAntesCredito() - this.creditoAplicado());

  ngOnInit(): void {
    if (!this.auth.logueado()) {
      return; // invitado: sin descuentos ni puntos
    }
    this.compras.descuentoPrimeraCompra()
      .then(d => this.descuento.set(d))
      .catch(() => this.descuento.set(null));
    this.cargarSaldo();
    this.cargarCredito();
    this.productosService.listar()
      .then(productos => this.puntosPorProducto.set(new Map(productos.map(p => [p.id, p.puntos_canje]))))
      .catch(() => undefined);
  }

  private cargarCredito(): void {
    this.compras.misCreditos()
      .then(r => this.saldoCredito.set(Number(r.disponible)))
      .catch(() => this.saldoCredito.set(null));
  }

  private cargarSaldo(): void {
    this.compras.misPuntos()
      .then(r => this.saldoPuntos.set(r.disponibles))
      .catch(() => this.saldoPuntos.set(null));
  }

  protected cambiar(linea: LineaCarrito, diferencia: number): void {
    this.carrito.cambiar(linea, diferencia);
  }

  // Comprobante en PDF con el QR único de la compra
  async descargarComprobante(): Promise<void> {
    const compra = this.compra();
    if (!compra || this.descargando()) {
      return;
    }
    this.descargando.set(true);
    try {
      await this.comprobante.descargar({
        codigo: compra.codigo,
        fecha: new Date(),
        invitado: this.auth.esInvitado(),
        butacas: [],
        productos: this.comprado().map(l => `${l.cantidad}× ${l.nombre}`),
        subtotal: compra.subtotal,
        descuento: compra.descuento,
        total: compra.total,
        puntosUsados: compra.puntos_usados,
        creditoUsado: compra.credito_usado,
        estado: 'Pagada',
      });
      this.descargado.set(true);
    } catch (error) {
      console.error('No se pudo generar el comprobante', error);
      this.mensajeError.set('No pudimos generar el PDF. Intentá de nuevo.');
    } finally {
      this.descargando.set(false);
    }
  }

  protected async pagar(): Promise<void> {
    if (this.pagando() || this.carrito.vacio() || this.carrito.combosConEntrada() > 0) {
      return;
    }

    this.mensajeError.set(null);
    this.pagando.set(true);
    this.loading.mostrar();

    try {
      const lineas = this.carrito.lineas();
      const items = this.carrito.items().map(i => ({
        ...i,
        puntos: i.tipo === 'producto' ? this.canjeadas(`producto-${i.id}`) : 0,
      }));
      const compra = await this.compras.confirmarCandy(items, this.creditoAplicado());
      this.comprado.set(lineas);
      this.compra.set(compra);
      this.carrito.vaciar();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      console.error('Error al confirmar la compra de candy', error);
      this.mensajeError.set(mensajeErrorCompra(error, 'No pudimos procesar el pago. Intentá de nuevo.'));
      if (esError(error, 'CREDITO_INSUFICIENTE')) {
        this.cargarCredito();
      }
      if (esError(error, 'PUNTOS_INSUFICIENTES')) {
        this.cargarSaldo();
      }
    } finally {
      this.pagando.set(false);
      this.loading.ocultar();
    }
  }
}