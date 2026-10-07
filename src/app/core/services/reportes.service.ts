import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { FilaEntradas, FilaFacturacion, RangoReporte } from '../models/reporte.model';

// Reportes del administrador. Los calcula la base (y verifica que sea admin).
@Injectable({ providedIn: 'root' })
export class ReportesService {
  private readonly supabase = inject(SupabaseService);

  async facturacion(rango: RangoReporte): Promise<FilaFacturacion[]> {
    const { data, error } = await this.supabase.client.rpc('reporte_facturacion', {
      p_desde: rango.desde,
      p_hasta: rango.hasta,
    });
    if (error) {
      throw error;
    }
    // numeric llega como texto desde PostgREST: se convierte a número
    return ((data ?? []) as FilaFacturacion[]).map(f => ({
      dia: f.dia,
      compras: Number(f.compras),
      facturado: Number(f.facturado),
      credito: Number(f.credito),
      descuentos: Number(f.descuentos),
      puntos: Number(f.puntos),
    }));
  }

  async entradas(rango: RangoReporte): Promise<FilaEntradas[]> {
    const { data, error } = await this.supabase.client.rpc('reporte_entradas', {
      p_desde: rango.desde,
      p_hasta: rango.hasta,
    });
    if (error) {
      throw error;
    }
    return ((data ?? []) as FilaEntradas[]).map(f => ({
      dia: f.dia,
      vendidas: Number(f.vendidas),
      devueltas: Number(f.devueltas),
      netas: Number(f.netas),
      con_puntos: Number(f.con_puntos),
      funciones: Number(f.funciones),
    }));
  }
}