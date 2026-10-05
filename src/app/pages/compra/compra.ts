import { Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ComprasService } from '../../core/services/compras.service';
import { SalasService } from '../../core/services/salas.service';
import { ConfiguracionService } from '../../core/services/configuracion.service';
import { ProductosService } from '../../core/services/productos.service';
import { CombosService } from '../../core/services/combos.service';
import { CategoriasProductoService } from '../../core/services/categorias-producto.service';
import { LoadingService } from '../../core/services/loading.service';
import {
  CompraConfirmada,
  DescuentoAplicable,
  EstadoButacaCompra,
  FuncionDeCompra,
  ItemCompra,
  MAXIMO_BUTACAS,
  esError,
  mensajeErrorCompra,
  qrCandy,
  qrSala,
} from '../../core/models/compra.model';
import { BLOQUES, BloqueButaca, Butaca, ETIQUETAS_BLOQUE, ETIQUETAS_TIPO_BUTACA } from '../../core/models/sala.model';
import { Producto } from '../../core/models/producto.model';
import { ComboAdmin } from '../../core/models/combo.model';
import { Alerta } from '../../components/alerta/alerta';
import { CodigoQr } from '../../components/codigo-qr/codigo-qr';

type Paso = 'butacas' | 'candy' | 'pago' | 'listo';

interface FilaMapa {
  fila: string;
  bloques: { bloque: BloqueButaca; lugares: (Butaca | null)[] }[];
}

interface SeccionCandy {
  titulo: string;
  productos: Producto[];
}

const AVISO_RESERVADA = 'Esta butaca ya se encuentra reservada, por favor elija otra butaca.';

@Component({
  selector: 'app-compra',
  imports: [CurrencyPipe, DatePipe, RouterLink, Alerta, CodigoQr],
  templateUrl: './compra.html',
  styleUrl: './compra.css',
})
export class Compra implements OnInit {
  // Parámetro :funcion de /comprar/:funcion
  readonly funcion = input.required<string>();

  private readonly compras = inject(ComprasService);
  private readonly salas = inject(SalasService);
  private readonly configuracion = inject(ConfiguracionService);
  private readonly productosService = inject(ProductosService);
  private readonly combosService = inject(CombosService);
  private readonly categoriasService = inject(CategoriasProductoService);
  private readonly loading = inject(LoadingService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly paso = signal<Paso>('butacas');
  protected readonly datos = signal<FuncionDeCompra | null>(null);
  protected readonly noDisponible = signal<string | null>(null);
  protected readonly mensajeError = signal<string | null>(null);
  protected readonly aviso = signal<string | null>(null);

  // ---------- Butacas ----------
  protected readonly butacas = signal<Butaca[]>([]);
  private readonly estados = signal(new Map<number, { estado: 'vendida' | 'reservada' | 'mia'; vence: string | null }>());
  private readonly procesando = signal(new Set<number>());
  protected readonly maximo = MAXIMO_BUTACAS;
  protected readonly etiquetasTipo = ETIQUETAS_TIPO_BUTACA;

  // ---------- Reserva (10 minutos) ----------
  private readonly vence = signal<Date | null>(null);
  private readonly ahora = signal(Date.now());

  // ---------- Precios ----------
  private readonly recargoVip = signal(0);
  // Descuento de primera compra (si al cliente le corresponde)
  protected readonly descuento = signal<DescuentoAplicable | null>(null);

  // ---------- Candy ----------
  private readonly combos = signal<ComboAdmin[]>([]);
  private readonly productos = signal<Producto[]>([]);
  private readonly categorias = signal<{ id: number; nombre: string }[]>([]);
  private readonly carrito = signal(new Map<string, number>()); // 'combo-3' → 2

  // ---------- Pago ----------
  protected readonly metodoPago = signal<'credito' | 'debito' | 'mercadopago'>('credito');
  protected readonly pagando = signal(false);
  protected readonly compra = signal<CompraConfirmada | null>(null);
  // Lo comprado, para mostrarlo en la pantalla final (las reservas ya no existen)
  protected readonly butacasCompradas = signal<Butaca[]>([]);
  protected readonly candyComprado = signal<{ nombre: string; cantidad: number }[]>([]);
  protected readonly qrSala = qrSala;
  protected readonly qrCandy = qrCandy;

  // =====================================================================
  // Derivados
  // =====================================================================

  protected estadoDe(id: number): EstadoButacaCompra {
    if (this.procesando().has(id)) {
      return 'procesando';
    }
    return this.estados().get(id)?.estado ?? 'libre';
  }

  protected readonly mias = computed(() =>
    this.butacas()
      .filter(b => this.estados().get(b.id)?.estado === 'mia')
      .sort((a, b) => a.fila.localeCompare(b.fila) || a.numero - b.numero),
  );

  protected readonly libres = computed(() => this.butacas().filter(b => !this.estados().has(b.id)).length);

  protected readonly mapa = computed<FilaMapa[]>(() => {
    const butacas = this.butacas();
    const maximo = Object.fromEntries(
      BLOQUES.map(bloque => [bloque, Math.max(0, ...butacas.filter(b => b.bloque === bloque).map(b => b.numero))]),
    ) as Record<BloqueButaca, number>;
    const porClave = new Map(butacas.map(b => [`${b.fila}-${b.bloque}-${b.numero}`, b]));
    const filas = [...new Set(butacas.map(b => b.fila))].sort();

    return filas.map(fila => ({
      fila,
      bloques: BLOQUES.filter(bloque => maximo[bloque] > 0).map(bloque => ({
        bloque,
        lugares: Array.from({ length: maximo[bloque] }, (_, i) => porClave.get(`${fila}-${bloque}-${i + 1}`) ?? null),
      })),
    }));
  });

  // Segundos que le quedan a la reserva (null si no hay reserva)
  protected readonly restante = computed(() => {
    const vence = this.vence();
    return vence ? Math.max(0, Math.floor((vence.getTime() - this.ahora()) / 1000)) : null;
  });

  protected readonly reloj = computed(() => {
    const s = this.restante() ?? 0;
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  });

  // ---------- Candy ----------

  protected readonly combosActivos = computed(() => this.combos().filter(c => c.activo));

  protected readonly seccionesCandy = computed<SeccionCandy[]>(() => {
    const activos = this.productos().filter(p => p.activo);
    return this.categorias()
      .map(c => ({ titulo: c.nombre, productos: activos.filter(p => p.categoria_id === c.id) }))
      .filter(s => s.productos.length > 0);
  });

  protected cantidad(tipo: 'producto' | 'combo', id: number): number {
    return this.carrito().get(`${tipo}-${id}`) ?? 0;
  }

  // Cada combo con entrada cubre una butaca: no puede haber más que butacas elegidas
  protected readonly combosConEntrada = computed(() =>
    this.combosActivos().filter(c => c.incluye_entrada).reduce((t, c) => t + this.cantidad('combo', c.id), 0),
  );

  protected readonly lineasCandy = computed(() => [
    ...this.combosActivos()
      .filter(c => this.cantidad('combo', c.id) > 0)
      .map(c => ({ tipo: 'combo' as const, id: c.id, nombre: c.nombre, precio: c.precio, cantidad: this.cantidad('combo', c.id), incluyeEntrada: c.incluye_entrada })),
    ...this.productos()
      .filter(p => this.cantidad('producto', p.id) > 0)
      .map(p => ({ tipo: 'producto' as const, id: p.id, nombre: p.nombre, precio: p.precio, cantidad: this.cantidad('producto', p.id), incluyeEntrada: false })),
  ]);

  // ---------- Totales (estimados: el total final lo calcula la base al confirmar) ----------

  protected readonly vipsElegidas = computed(() => this.mias().filter(b => b.tipo === 'vip').length);
  protected readonly entradasCubiertas = computed(() => Math.min(this.combosConEntrada(), this.mias().length));
  protected readonly entradasAPagar = computed(() => this.mias().length - this.entradasCubiertas());
  protected readonly precioEntrada = computed(() => this.datos()?.precio_base ?? 0);
  protected readonly recargo = computed(() => this.recargoVip());

  protected readonly totalEntradas = computed(
    () => this.entradasAPagar() * this.precioEntrada() + this.vipsElegidas() * this.recargoVip(),
  );
  protected readonly totalCandy = computed(() => this.lineasCandy().reduce((t, l) => t + l.precio * l.cantidad, 0));
  protected readonly subtotal = computed(() => this.totalEntradas() + this.totalCandy());
  protected readonly montoDescuento = computed(() => {
    const descuento = this.descuento();
    return descuento ? Math.round(this.subtotal() * descuento.porcentaje) / 100 : 0;
  });
  protected readonly total = computed(() => this.subtotal() - this.montoDescuento());

  protected readonly combosExcedidos = computed(() => this.combosConEntrada() > this.mias().length);

  // =====================================================================
  // Carga
  // =====================================================================

  ngOnInit(): void {
    this.cargar();

    // Reloj de la reserva
    const intervalo = setInterval(() => this.tic(), 1000);

    this.destroyRef.onDestroy(() => {
      clearInterval(intervalo);
      // Si se va sin pagar, libera sus butacas para que otro las pueda elegir
      const id = this.datos()?.id;
      if (id && this.paso() !== 'listo' && this.mias().length > 0) {
        this.compras.liberarTodas(id).catch(() => undefined);
      }
    });
  }

  private async cargar(): Promise<void> {
    const id = Number(this.funcion());
    if (!Number.isInteger(id)) {
      this.noDisponible.set('La función que buscás no existe.');
      return;
    }

    this.loading.mostrar();
    try {
      const funcion = await this.compras.funcion(id);

      if (!funcion) {
        this.noDisponible.set('La función que buscás no existe.');
        return;
      }
      if (funcion.estado !== 'programada' || new Date(funcion.inicio) <= new Date()) {
        this.noDisponible.set('Esta función ya no está a la venta.');
        return;
      }

      const [butacas, configuracion, combos, productos, categorias, descuento] = await Promise.all([
        this.salas.butacas(funcion.sala.id),
        this.configuracion.obtener().catch(() => null),
        this.combosService.listar(),
        this.productosService.listar(),
        this.categoriasService.listar(),
        this.compras.descuentoPrimeraCompra().catch(() => null),
      ]);

      this.datos.set(funcion);
      this.butacas.set(butacas);
      this.recargoVip.set(configuracion?.recargo_vip ?? 0);
      this.combos.set(combos);
      this.productos.set(productos);
      this.categorias.set(categorias);
      this.descuento.set(descuento);

      await this.recargarEstado();

      // Tiempo real: si otra persona reserva, libera o compra, el mapa se actualiza solo
      const dejarDeEscuchar = this.compras.escucharCambios(id, () => this.recargarEstado());
      this.destroyRef.onDestroy(dejarDeEscuchar);
    } catch (error) {
      console.error('Error al cargar la función', error);
      this.mensajeError.set('No pudimos cargar la función. Recargá la página.');
    } finally {
      this.loading.ocultar();
    }
  }

  // Estado real de las butacas según la base
  private async recargarEstado(): Promise<void> {
    const id = this.datos()?.id;
    if (!id || this.paso() === 'listo') {
      return;
    }

    try {
      const filas = await this.compras.estadoButacas(id);
      this.estados.set(new Map(filas.map(f => [f.butaca_id, { estado: f.estado, vence: f.vence_at }])));

      const vencimientos = filas.filter(f => f.estado === 'mia' && f.vence_at).map(f => new Date(f.vence_at!).getTime());
      this.vence.set(vencimientos.length > 0 ? new Date(Math.min(...vencimientos)) : null);
    } catch (error) {
      console.error('Error al actualizar las butacas', error);
    }
  }

  private tic(): void {
    this.ahora.set(Date.now());

    // Se terminó el tiempo de la reserva
    if (this.restante() === 0 && this.paso() !== 'listo' && !this.pagando()) {
      this.vence.set(null);
      this.paso.set('butacas');
      this.aviso.set('Se venció el tiempo de reserva y tus butacas se liberaron. Elegilas de nuevo.');
      this.recargarEstado();
    }
  }

  // =====================================================================
  // Paso 1 · Butacas
  // =====================================================================

  protected async tocar(butaca: Butaca): Promise<void> {
    const funcion = this.datos();
    if (!funcion || this.procesando().has(butaca.id)) {
      return;
    }

    const estado = this.estadoDe(butaca.id);
    this.aviso.set(null);

    if (estado === 'vendida') {
      this.aviso.set('Esta butaca ya fue vendida, por favor elija otra butaca.');
      return;
    }
    if (estado === 'reservada') {
      this.aviso.set(AVISO_RESERVADA);
      return;
    }

    this.marcarProcesando(butaca.id, true);

    try {
      if (estado === 'mia') {
        await this.compras.liberar(funcion.id, butaca.id);
        this.cambiarEstado(butaca.id, null);
      } else {
        if (this.mias().length >= MAXIMO_BUTACAS) {
          this.aviso.set(`Podés reservar hasta ${MAXIMO_BUTACAS} butacas por compra.`);
          return;
        }
        // await: la base verifica y reserva en una sola operación
        const vence = await this.compras.reservar(funcion.id, butaca.id);
        this.cambiarEstado(butaca.id, { estado: 'mia', vence });
        if (!this.vence()) {
          this.vence.set(new Date(vence));
        }
      }
    } catch (error) {
      if (esError(error, 'BUTACA_RESERVADA')) {
        this.cambiarEstado(butaca.id, { estado: 'reservada', vence: null });
      } else if (esError(error, 'BUTACA_VENDIDA')) {
        this.cambiarEstado(butaca.id, { estado: 'vendida', vence: null });
      }
      this.aviso.set(mensajeErrorCompra(error, 'No pudimos reservar la butaca. Intentá de nuevo.'));
    } finally {
      this.marcarProcesando(butaca.id, false);
      if (this.mias().length === 0) {
        this.vence.set(null);
      }
    }
  }

  private cambiarEstado(id: number, valor: { estado: 'vendida' | 'reservada' | 'mia'; vence: string | null } | null): void {
    this.estados.update(actual => {
      const nuevo = new Map(actual);
      if (valor) {
        nuevo.set(id, valor);
      } else {
        nuevo.delete(id);
      }
      return nuevo;
    });
  }

  private marcarProcesando(id: number, activo: boolean): void {
    this.procesando.update(actual => {
      const nuevo = new Set(actual);
      if (activo) {
        nuevo.add(id);
      } else {
        nuevo.delete(id);
      }
      return nuevo;
    });
  }

  protected nombreButaca(butaca: Butaca): string {
    return `Fila ${butaca.fila} · ${ETIQUETAS_BLOQUE[butaca.bloque]} ${butaca.numero}`;
  }

  protected etiquetaEstado(butaca: Butaca): string {
    const estados: Record<EstadoButacaCompra, string> = {
      libre: 'libre',
      mia: 'seleccionada',
      reservada: 'reservada',
      vendida: 'vendida',
      procesando: 'reservando…',
    };
    return `${this.nombreButaca(butaca)} · ${ETIQUETAS_TIPO_BUTACA[butaca.tipo]} · ${estados[this.estadoDe(butaca.id)]}`;
  }

  // =====================================================================
  // Paso 2 · Candy (opcional)
  // =====================================================================

  protected cambiarCantidad(tipo: 'producto' | 'combo', id: number, diferencia: number, incluyeEntrada = false): void {
    const actual = this.cantidad(tipo, id);
    if (diferencia > 0 && incluyeEntrada && this.combosConEntrada() >= this.mias().length) {
      return; // no más combos con entrada que butacas
    }
    const nueva = Math.max(0, Math.min(20, actual + diferencia));

    this.carrito.update(carrito => {
      const nuevo = new Map(carrito);
      if (nueva === 0) {
        nuevo.delete(`${tipo}-${id}`);
      } else {
        nuevo.set(`${tipo}-${id}`, nueva);
      }
      return nuevo;
    });
  }

  protected puedeSumarComboConEntrada(): boolean {
    return this.combosConEntrada() < this.mias().length;
  }

  // =====================================================================
  // Navegación entre pasos
  // =====================================================================

  protected irA(paso: Paso): void {
    if ((paso === 'candy' || paso === 'pago') && this.mias().length === 0) {
      this.aviso.set('Elegí al menos una butaca para continuar.');
      return;
    }
    if (paso === 'pago' && this.combosExcedidos()) {
      this.aviso.set('Tenés más combos con entrada que butacas elegidas.');
      return;
    }
    this.aviso.set(null);
    this.paso.set(paso);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected async cancelar(): Promise<void> {
    const funcion = this.datos();
    if (!funcion) {
      return;
    }
    this.loading.mostrar();
    try {
      await this.compras.liberarTodas(funcion.id);
      this.carrito.set(new Map());
      this.vence.set(null);
      this.paso.set('butacas');
      await this.recargarEstado();
      this.aviso.set('Liberaste tus butacas.');
    } finally {
      this.loading.ocultar();
    }
  }

  // =====================================================================
  // Paso 3 · Pago simulado
  // =====================================================================

  protected async pagar(): Promise<void> {
    const funcion = this.datos();
    if (!funcion || this.pagando()) {
      return;
    }

    this.mensajeError.set(null);
    this.pagando.set(true);
    this.loading.mostrar();

    const items: ItemCompra[] = this.lineasCandy().map(l => ({ tipo: l.tipo, id: l.id, cantidad: l.cantidad }));

    try {
      const butacas = this.mias();
      const candy = this.lineasCandy().map(l => ({ nombre: l.nombre, cantidad: l.cantidad }));

      const compra = await this.compras.confirmar(funcion.id, items);
      this.butacasCompradas.set(butacas);
      this.candyComprado.set(candy);
      this.compra.set(compra);
      this.vence.set(null);
      this.paso.set('listo');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      console.error('Error al confirmar la compra', error);
      this.mensajeError.set(mensajeErrorCompra(error, 'No pudimos procesar el pago. Intentá de nuevo.'));
      if (esError(error, 'RESERVA_VENCIDA')) {
        this.paso.set('butacas');
        await this.recargarEstado();
      }
    } finally {
      this.pagando.set(false);
      this.loading.ocultar();
    }
  }
}