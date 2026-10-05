import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import {
  Butaca,
  Sala,
  SalaConCapacidad,
  SalaGuardar,
  TIPOS_BUTACA,
  TipoButaca,
} from '../models/sala.model';

const COLUMNAS = 'id, numero, formato';
const COLUMNAS_BUTACA = 'id, sala_id, fila, bloque, numero, tipo';

@Injectable({ providedIn: 'root' })
export class SalasService {
  private readonly supabase = inject(SupabaseService);

  // Salas con el tipo de cada butaca: la capacidad se cuenta acá
  async listar(): Promise<SalaConCapacidad[]> {
    const { data, error } = await this.supabase.client
      .from('salas')
      .select(`${COLUMNAS}, butacas(tipo)`)
      .order('numero');

    if (error) {
      throw error;
    }

    return (data as (Sala & { butacas: { tipo: TipoButaca }[] })[]).map(({ butacas, ...sala }) => {
      const capacidad = Object.fromEntries(TIPOS_BUTACA.map(t => [t, 0])) as Record<TipoButaca, number>;
      butacas.forEach(b => capacidad[b.tipo]++);
      return { ...sala, capacidad, total: butacas.length };
    });
  }

  async obtener(id: number): Promise<Sala | null> {
    const { data, error } = await this.supabase.client
      .from('salas')
      .select(COLUMNAS)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data as Sala | null;
  }

  async butacas(salaId: number): Promise<Butaca[]> {
    const { data, error } = await this.supabase.client
      .from('butacas')
      .select(COLUMNAS_BUTACA)
      .eq('sala_id', salaId)
      .order('fila')
      .order('numero');

    if (error) {
      throw error;
    }

    // fila es char(1): se limpia por si viene con espacios
    return (data as Butaca[]).map(b => ({ ...b, fila: b.fila.trim() }));
  }

  // Cambia el tipo de una butaca (estándar / VIP / accesible)
  async cambiarTipoButaca(id: number, tipo: TipoButaca): Promise<void> {
    const { error } = await this.supabase.client.from('butacas').update({ tipo }).eq('id', id);

    if (error) {
      throw error;
    }
  }

  // Alta: la base genera las butacas (trigger generar_butacas). Edición: solo número y formato.
  async guardar(datos: SalaGuardar, id?: number): Promise<number> {
    const consulta = id === undefined
      ? this.supabase.client.from('salas').insert(datos)
      : this.supabase.client.from('salas').update(datos).eq('id', id);

    const { data, error } = await consulta.select('id').single();

    if (error) {
      throw error;
    }

    return (data as { id: number }).id;
  }

  // Borra la sala y, por ON DELETE CASCADE, sus butacas.
  // Si tiene funciones asociadas la base lo impide (error 23503).
  async eliminar(id: number): Promise<void> {
    const { error } = await this.supabase.client.from('salas').delete().eq('id', id);

    if (error) {
      throw error;
    }
  }
}