import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe, NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ComprasService } from '../../core/services/compras.service';
import { AuthService } from '../../core/services/auth.service';
import { ComprobanteService } from '../../core/services/comprobante.service';
import { ConfirmacionService } from '../../core/services/confirmacion.service';
import { ConfiguracionService } from '../../core/services/configuracion.service';
import { LoadingService } from '../../core/services/loading.service';
import { ETIQUETAS_ESTADO_QR, EstadoQr, MiCompra, estadoQr, mensajeErrorCompra, qrCompra } from '../../core/models/compra.model';
import { EdadMinima } from '../../core/models/pelicula.model';
import { CodigoQr } from '../../components/codigo-qr/codigo-qr';
import { Alerta } from '../../components/alerta/alerta';
import { ClasificacionPipe } from '../../pipes/clasificacion.pipe';

type Pestana = 'activas' | 'historial';

// Una entrada o un producto del candy, con lo necesario para devolverlo (genera crédito a favor)
interface Devolvible {
  tipo: 'entrada' | 'item';
  id: number;
  etiqueta: string;          // 'Entrada F7' · '2× Pochoclo grande'
  conPuntos: boolean;
  puedeDevolver: boolean;
  motivo: string | null;     // por qué no se puede devolver (si no se puede)
  extra: string | null;      // lo que se devuelve junto (ej.: '1× COMBO FAN' con la entrada)
}

// Una compra lista para mostrar (con entradas, solo candy o ambas cosas)
interface Tarjeta {
  compra: MiCompra;
  titulo: string;
  imagen: string | null;
  cuando: Date;               // inicio de la función, o fecha de compra si es solo candy
  funcion: Date | null;
  sala: string;
  edadMinima: EdadMinima;
  butacas: { etiqueta: string; vip: boolean }[];
  candy: string[];
  tieneEntradas: boolean;
  tieneCandy: boolean;
  estadoQr: EstadoQr;
  devueltos: string[];        // lo que ya se devolvió (para mostrarlo)
  entradasDetalle: Devolvible[];  // listado desplegable de entradas (con "Devolver")
  candyDetalle: Devolvible[];     // listado desplegable del candy (con "Devolver")
  limiteDevolucion: Date | null; // hasta cuándo (null = solo candy, hasta retirarlo)
}

@Component({
  selector: 'app-mis-compras',
  imports: [CurrencyPipe, DatePipe, NgTemplateOutlet, RouterLink, CodigoQr, Alerta, ClasificacionPipe],
  templateUrl: './mis-compras.html',
  styleUrl: './mis-compras.css',
})
export class MisCompras {
  private readonly compras = inject(ComprasService);
  private readonly auth = inject(AuthService);
  private readonly comprobante = inject(ComprobanteService);
  private readonly confirmacion = inject(ConfirmacionService);
  private readonly configuracion = inject(ConfiguracionService);
  private readonly loading = inject(LoadingService);

  protected readonly mensajeExito = signal<string | null>(null);
  protected readonly devolviendo = signal(false);
  // Plazo de devolución: horas antes de la función (configuracion.horas_limite_cancelacion)
  protected readonly horasLimite = signal(2);
  // Se actualiza cada minuto para que el botón "Devolver" desaparezca al vencer el plazo
  private readonly ahora = signal(Date.now());

  protected readonly cargando = signal(true);
  protected readonly mensajeError = signal<string | null>(null);
  protected readonly pestana = signal<Pestana>('activas');
  protected readonly descargando = signal<string | null>(null); // id de la compra
  // QR abierto en grande (para mostrar en boletería o en el candy)
  protected readonly ampliado = signal<{ valor: string; titulo: string } | null>(null);
  // Listados desplegados: '<id de compra>-entradas' · '<id de compra>-candy'
  protected readonly desplegados = signal(new Set<string>());

  protected alternar(id: string): void {
    this.desplegados.update(actual => {
      const copia = new Set(actual);
      if (copia.has(id)) {
        copia.delete(id);
      } else {
        copia.add(id);
      }
      return copia;
    });
  }

  private readonly lista = signal<MiCompra[]>([]);

  protected readonly qrCompra = qrCompra;
  protected readonly etiquetasQr = ETIQUETAS_ESTADO_QR;

  private readonly tarjetas = computed<Tarjeta[]>(() =>
    this.lista()
      .filter(c => c.entradas.length > 0 || c.compra_items.length > 0)
      .map(compra => {
        const funcion = compra.entradas[0]?.funcion ?? null;
        const activas = compra.entradas.filter(e => e.estado === 'activa');
        const nombreItem = (i: MiCompra['compra_items'][number]) =>
          `${i.cantidad}× ${i.producto?.nombre ?? i.combo?.nombre ?? 'Producto'}`;
        const itemsVigentes = compra.compra_items.filter(i => !i.devuelto_at);
        const candy = itemsVigentes.map(nombreItem);
        const tieneEntradas = activas.length > 0;
        const tieneCandy = candy.length > 0;

        // Devoluciones: solo compras pagadas, antes del límite y de que se use cada parte
        const limiteDevolucion = funcion ? new Date(new Date(funcion.inicio).getTime() - this.horasLimite() * 3_600_000) : null;
        const enPlazo = compra.estado === 'pagada' && (!limiteDevolucion || this.ahora() < limiteDevolucion.getTime());
        const fueraDePlazo = compra.estado === 'pagada' && !enPlazo ? 'Plazo vencido' : null;

        // Combos con entrada todavía vigentes: cada uno necesita una entrada activa.
        // Si devolver una entrada deja un combo sin su entrada, el combo se devuelve con ella.
        const combosConEntrada = itemsVigentes.filter(i => i.combo?.incluye_entrada);
        const unidadesCombo = combosConEntrada.reduce((t, i) => t + i.cantidad, 0);
        const arrastraCombo = activas.length - 1 < unidadesCombo;
        const comboArrastrado = arrastraCombo ? `1× ${combosConEntrada[0]?.combo?.nombre ?? 'combo'}` : null;

        const entradasDetalle: Devolvible[] = [...activas]
          .sort((a, b) => `${a.butaca.fila}${a.butaca.numero}`.localeCompare(`${b.butaca.fila}${b.butaca.numero}`, undefined, { numeric: true }))
          .map(e => {
            const motivo = compra.validada_sala_at
              ? 'Ya ingresaste'
              : arrastraCombo && compra.validada_candy_at
                ? 'Combo ya retirado'
                : fueraDePlazo;
            return {
              tipo: 'entrada' as const,
              id: e.id,
              etiqueta: `Entrada ${e.butaca.fila.trim()}${e.butaca.numero}${e.tipo_butaca === 'vip' ? ' (VIP)' : ''}`,
              conPuntos: e.canjeada_con_puntos,
              puedeDevolver: enPlazo && !motivo,
              motivo,
              extra: comboArrastrado,
            };
          });

        const candyDetalle: Devolvible[] = itemsVigentes.map(i => {
          // Un combo con entrada se devuelve con su entrada (salvo que ya no le quede ninguna)
          const motivo = compra.validada_candy_at
            ? 'Ya retirado'
            : i.combo?.incluye_entrada && activas.length >= unidadesCombo
              ? 'Se devuelve con la entrada'
              : fueraDePlazo;
          return {
            tipo: 'item' as const,
            id: i.id,
            etiqueta: nombreItem(i),
            conPuntos: i.canjeado_con_puntos,
            puedeDevolver: enPlazo && !motivo,
            motivo,
            extra: null,
          };
        });
        const devueltos = [
          ...compra.entradas
            .filter(e => e.estado !== 'activa')
            .map(e => `Entrada ${e.butaca.fila.trim()}${e.butaca.numero}`),
          ...compra.compra_items.filter(i => i.devuelto_at).map(nombreItem),
        ];

        return {
          compra,
          titulo: funcion?.pelicula.titulo ?? 'Pedido del candy bar',
          imagen: funcion?.pelicula.imagen_url ?? null,
          cuando: new Date(funcion?.inicio ?? compra.created_at),
          funcion: funcion ? new Date(funcion.inicio) : null,
          sala: funcion
            ? `Sala ${funcion.sala.numero} · ${funcion.sala.formato} · ${funcion.idioma === 'subtitulada' ? 'Subtitulada' : 'Castellano'}`
            : '',
          edadMinima: (funcion?.pelicula.edad_minima ?? 0) as EdadMinima,
          butacas: activas
            .map(e => ({ etiqueta: `${e.butaca.fila.trim()}${e.butaca.numero}`, vip: e.tipo_butaca === 'vip' }))
            .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, undefined, { numeric: true })),
          candy,
          tieneEntradas,
          tieneCandy,
          estadoQr: estadoQr({
            estado: compra.estado,
            tieneEntradas,
            tieneCandy,
            validadaSala: !!compra.validada_sala_at,
            validadaCandy: !!compra.validada_candy_at,
          }),
          devueltos,
          entradasDetalle,
          candyDetalle,
          limiteDevolucion,
        };
      }),
  );

  // Activas: QR con algo por canjear (y, si tiene entradas, la función todavía no pasó)
  private esActiva(t: Tarjeta): boolean {
    if (t.estadoQr === 'usado' || t.estadoQr === 'anulado') {
      return false;
    }
    return !t.funcion || t.funcion > new Date() || (t.tieneCandy && !t.compra.validada_candy_at);
  }

  protected readonly activas = computed(() =>
    this.tarjetas().filter(t => this.esActiva(t)).sort((a, b) => +a.cuando - +b.cuando),
  );
  protected readonly historial = computed(() =>
    this.tarjetas().filter(t => !this.esActiva(t)).sort((a, b) => +b.cuando - +a.cuando),
  );
  protected readonly visibles = computed(() => (this.pestana() === 'activas' ? this.activas() : this.historial()));

  constructor() {
    this.cargar();
    this.configuracion.obtener()
      .then(c => this.horasLimite.set(c?.horas_limite_cancelacion ?? 2))
      .catch(() => undefined);

    const reloj = setInterval(() => this.ahora.set(Date.now()), 60_000);
    inject(DestroyRef).onDestroy(() => clearInterval(reloj));
  }

  private async cargar(): Promise<void> {
    try {
      await this.auth.esperarInicio();
      const usuario = this.auth.usuario();
      if (!usuario || this.auth.esInvitado()) {
        return;
      }
      this.lista.set(await this.compras.misCompras(usuario.id));
    } catch (error) {
      console.error('Error al cargar mis compras', error);
      this.mensajeError.set('No pudimos cargar tus compras. Recargá la página.');
    } finally {
      this.cargando.set(false);
    }
  }

  // Devolución: no hay reintegro de dinero ni de puntos; la base genera crédito a favor
  protected async devolver(t: Tarjeta, d: Devolvible): Promise<void> {
    if (this.devolviendo()) {
      return;
    }

    const confirmado = await this.confirmacion.preguntar({
      titulo: `¿Devolver ${d.etiqueta}${d.extra ? ' + ' + d.extra : ''}?`,
      mensaje: (d.extra ? `La entrada viene con un combo: también se devuelve ${d.extra}. ` : '') + (d.conPuntos
        ? 'Se pagó con puntos: los puntos no se reintegran. Vas a recibir crédito a favor por su valor al momento del canje.'
        : 'No se reintegra dinero: el importe queda como crédito a favor para tus próximas compras.'),
      textoConfirmar: 'Devolver',
      textoCancelar: 'Cancelar',
    });
    if (!confirmado) {
      return;
    }

    this.mensajeError.set(null);
    this.mensajeExito.set(null);
    this.devolviendo.set(true);
    this.loading.mostrar();
    try {
      const resultado = d.tipo === 'entrada'
        ? await this.compras.devolverEntrada(d.id)
        : await this.compras.devolverItem(d.id);

      const formato = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 });
      this.mensajeExito.set(
        `Devolviste ${d.etiqueta} (compra ${t.compra.codigo}). Se acreditaron ${formato.format(resultado.credito)} ` +
        `de crédito: tenés ${formato.format(resultado.saldo)} disponibles.`,
      );
      await this.recargar();
    } catch (error) {
      console.error('Error al devolver', error);
      this.mensajeError.set(mensajeErrorCompra(error, 'No pudimos procesar la devolución. Intentá de nuevo.'));
      await this.recargar();
    } finally {
      this.devolviendo.set(false);
      this.loading.ocultar();
    }
  }

  private async recargar(): Promise<void> {
    const usuario = this.auth.usuario();
    if (usuario) {
      this.lista.set(await this.compras.misCompras(usuario.id).catch(() => this.lista()));
    }
  }

  protected etiquetaEstado(t: Tarjeta): string {
    return t.compra.estado === 'pagada' ? 'Pagada' : 'Cancelada';
  }

  // Vuelve a generar el comprobante en PDF con el QR único
  protected async descargar(t: Tarjeta): Promise<void> {
    if (this.descargando()) {
      return;
    }
    this.descargando.set(t.compra.id);
    try {
      await this.comprobante.descargar({
        codigo: t.compra.codigo,
        fecha: new Date(t.compra.created_at),
        invitado: false,
        pelicula: t.tieneEntradas ? t.titulo : undefined,
        funcion: t.funcion ?? undefined,
        sala: t.sala,
        edadMinima: t.edadMinima,
        butacas: t.butacas.map(b => `${b.etiqueta}${b.vip ? ' (VIP)' : ''}`),
        productos: t.candy,
        subtotal: Number(t.compra.subtotal),
        descuento: Number(t.compra.monto_descuento),
        total: Number(t.compra.total),
        puntosUsados: t.compra.puntos_usados,
        creditoUsado: Number(t.compra.credito_usado),
        estado: this.etiquetaEstado(t),
      });
    } catch (error) {
      console.error('No se pudo generar el comprobante', error);
      this.mensajeError.set('No pudimos generar el PDF. Intentá de nuevo.');
    } finally {
      this.descargando.set(null);
    }
  }
}