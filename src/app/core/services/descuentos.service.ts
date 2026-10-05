import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Descuento, DescuentoGuardar } from '../models/descuento.model';

const COLUMNAS =
  'id, nombre, porcentaje, es_primera_compra, edad_minima, vigente_desde, vigente_hasta, activo, created_at';

@Injectable({ providedIn: 'root' })
export class DescuentosService {
  private readonly supabase = inject(SupabaseService);

  async listar(): Promise<Descuento[]> {
    const { data, error } = await this.supabase.client
      .from('descuentos')
      .select(COLUMNAS)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data as Descuento[];
  }

  async obtener(id: number): Promise<Descuento | null> {
    const { data, error } = await this.supabase.client
      .from('descuentos')
      .select(COLUMNAS)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data as Descuento | null;
  }

  // Crea (sin id) o actualiza (con id)
  async guardar(datos: Partial<DescuentoGuardar>, id?: number): Promise<void> {
    const consulta = id === undefined
      ? this.supabase.client.from('descuentos').insert(datos)
      : this.supabase.client.from('descuentos').update(datos).eq('id', id);

    const { error } = await consulta;

    if (error) {
      throw error;
    }
  }
}