import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { ReportesService } from '../../../core/services/reportes.service';
import { ExportarReporteService } from '../../../core/services/exportar-reporte.service';
import { LoadingService } from '../../../core/services/loading.service';
import {
  DatosExportacion,
  FilaEntradas,
  FilaFacturacion,
  RangoReporte,
  mensajeErrorReporte,
} from '../../../core/models/reporte.model';

type Pestana = 'facturacion' | 'entradas';
type Atajo = 7 | 30 | 'mes';

// Estado de un reporte: cada uno tiene su propio rango, datos y errores (son independientes)
interface EstadoReporte<T> {
  rango: RangoReporte;
  filas: T[] | null; // null = todavía no se consultó
  error: string | null;
}

// Reportes del administrador: facturación por día y entradas vendidas por día.
// Se ven en pantalla (resumen, gráfico y tabla) y se descargan en PDF o Excel.
@Component({
  selector: 'app-reportes',
  imports: [CurrencyPipe, DatePipe, DecimalPipe, NgTemplateOutlet],
  templateUrl: './reportes.html',
  styleUrl: './reportes.css',
})
export class Reportes {
  private readonly reportes = inject(ReportesService);
  private readonly exportar = inject(ExportarReporteService);
  private readonly loading = inject(LoadingService);

  protected readonly pestana = signal<Pestana>('facturacion');
  protected readonly hoy = diaLocal(new Date());

  // ---------- Facturación ----------
  protected readonly facturacion = signal<EstadoReporte<FilaFacturacion>>({ rango: rangoDe(30), filas: null, error: null });

  protected readonly totalesFacturacion = computed(() => {
    const filas = this.facturacion().filas ?? [];
    return filas.reduce(
      (t, f) => ({
        compras: t.compras + f.compras,
        facturado: t.facturado + f.facturado,
        credito: t.credito + f.credito,
        descuentos: t.descuentos + f.descuentos,
        puntos: t.puntos + f.puntos,
      }),
      { compras: 0, facturado: 0, credito: 0, descuentos: 0, puntos: 0 },
    );
  });

  protected readonly maximoFacturado = computed(() => Math.max(1, ...(this.facturacion().filas ?? []).map(f => f.facturado)));

  // ---------- Entradas ----------
  protected readonly entradas = signal<EstadoReporte<FilaEntradas>>({ rango: rangoDe(30), filas: null, error: null });

  protected readonly totalesEntradas = computed(() => {
    const filas = this.entradas().filas ?? [];
    return filas.reduce(
      (t, f) => ({
        vendidas: t.vendidas + f.vendidas,
        devueltas: t.devueltas + f.devueltas,
        netas: t.netas + f.netas,
        con_puntos: t.con_puntos + f.con_puntos,
      }),
      { vendidas: 0, devueltas: 0, netas: 0, con_puntos: 0 },
    );
  });

  protected readonly maximoEntradas = computed(() => Math.max(1, ...(this.entradas().filas ?? []).map(f => f.vendidas)));

  constructor() {
    // Al entrar se muestran los últimos 30 días de los dos reportes
    this.consultarFacturacion();
    this.consultarEntradas();
  }

  // ---------- Rango de fechas ----------

  protected cambiarRango(reporte: Pestana, campo: 'desde' | 'hasta', valor: string): void {
    // Cada signal tiene su propio tipo: se actualiza cada uno por separado
    if (reporte === 'facturacion') {
      this.facturacion.update(e => ({ ...e, rango: { ...e.rango, [campo]: valor } }));
    } else {
      this.entradas.update(e => ({ ...e, rango: { ...e.rango, [campo]: valor } }));
    }
  }

  protected atajo(reporte: Pestana, atajo: Atajo): void {
    const rango = atajo === 'mes' ? rangoDelMes() : rangoDe(atajo);
    if (reporte === 'facturacion') {
      this.facturacion.update(e => ({ ...e, rango }));
      this.consultarFacturacion();
    } else {
      this.entradas.update(e => ({ ...e, rango }));
      this.consultarEntradas();
    }
  }

  // ---------- Consultas ----------

  protected async consultarFacturacion(): Promise<void> {
    const rango = this.facturacion().rango;
    await this.consultar(
      () => this.reportes.facturacion(rango),
      filas => this.facturacion.update(e => ({ ...e, filas, error: null })),
      error => this.facturacion.update(e => ({ ...e, error })),
    );
  }

  protected async consultarEntradas(): Promise<void> {
    const rango = this.entradas().rango;
    await this.consultar(
      () => this.reportes.entradas(rango),
      filas => this.entradas.update(e => ({ ...e, filas, error: null })),
      error => this.entradas.update(e => ({ ...e, error })),
    );
  }

  private async consultar<T>(pedir: () => Promise<T>, listo: (datos: T) => void, fallo: (mensaje: string) => void): Promise<void> {
    this.loading.mostrar();
    try {
      listo(await pedir());
    } catch (error) {
      console.error('Error al generar el reporte', error);
      fallo(mensajeErrorReporte(error));
    } finally {
      this.loading.ocultar();
    }
  }

  // ---------- Descargas ----------

  protected descargar(reporte: Pestana, formato: 'pdf' | 'excel'): void {
    const datos = reporte === 'facturacion' ? this.datosFacturacion() : this.datosEntradas();
    if (!datos) {
      return;
    }
    if (formato === 'pdf') {
      this.exportar.pdf(datos);
    } else {
      this.exportar.excel(datos);
    }
  }

  private datosFacturacion(): DatosExportacion | null {
    const { filas, rango } = this.facturacion();
    if (!filas) {
      return null;
    }
    const t = this.totalesFacturacion();
    return {
      titulo: 'Facturación por día',
      archivo: 'facturacion',
      rango,
      columnas: [
        { titulo: 'Fecha', tipo: 'fecha' },
        { titulo: 'Compras', tipo: 'numero' },
        { titulo: 'Facturado', tipo: 'moneda' },
        { titulo: 'Pagado con crédito', tipo: 'moneda' },
        { titulo: 'Descuentos', tipo: 'moneda' },
        { titulo: 'Puntos canjeados', tipo: 'numero' },
      ],
      filas: filas.map(f => [f.dia, f.compras, f.facturado, f.credito, f.descuentos, f.puntos]),
      totales: ['Total', t.compras, t.facturado, t.credito, t.descuentos, t.puntos],
      resumen: [
        { etiqueta: 'Facturado', valor: moneda(t.facturado) },
        { etiqueta: 'Compras', valor: t.compras.toLocaleString('es-AR') },
        { etiqueta: 'Promedio por día', valor: moneda(t.facturado / Math.max(filas.length, 1)) },
      ],
    };
  }

  private datosEntradas(): DatosExportacion | null {
    const { filas, rango } = this.entradas();
    if (!filas) {
      return null;
    }
    const t = this.totalesEntradas();
    return {
      titulo: 'Entradas vendidas por día',
      archivo: 'entradas',
      rango,
      columnas: [
        { titulo: 'Fecha', tipo: 'fecha' },
        { titulo: 'Vendidas', tipo: 'numero' },
        { titulo: 'Devueltas', tipo: 'numero' },
        { titulo: 'Netas', tipo: 'numero' },
        { titulo: 'Con puntos', tipo: 'numero' },
        { titulo: 'Funciones', tipo: 'numero' },
      ],
      filas: filas.map(f => [f.dia, f.vendidas, f.devueltas, f.netas, f.con_puntos, f.funciones]),
      // "Funciones" no se suma: una función puede venderse en varios días
      totales: ['Total', t.vendidas, t.devueltas, t.netas, t.con_puntos, '—'],
      resumen: [
        { etiqueta: 'Entradas vendidas', valor: t.vendidas.toLocaleString('es-AR') },
        { etiqueta: 'Netas (sin devueltas)', valor: t.netas.toLocaleString('es-AR') },
        { etiqueta: 'Promedio por día', valor: (t.vendidas / Math.max(filas.length, 1)).toLocaleString('es-AR', { maximumFractionDigits: 1 }) },
      ],
    };
  }
}

// ---------- Fechas (día local de Argentina, 'AAAA-MM-DD') ----------

function diaLocal(fecha: Date): string {
  const a = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${a}-${m}-${d}`;
}

// Últimos N días, incluido hoy
function rangoDe(dias: number): RangoReporte {
  const hasta = new Date();
  const desde = new Date();
  desde.setDate(hasta.getDate() - (dias - 1));
  return { desde: diaLocal(desde), hasta: diaLocal(hasta) };
}

function rangoDelMes(): RangoReporte {
  const hoy = new Date();
  return { desde: diaLocal(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), hasta: diaLocal(hoy) };
}

function moneda(valor: number): string {
  return `$ ${valor.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}