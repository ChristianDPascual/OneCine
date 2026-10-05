import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Funcion, FuncionGuardar, FuncionListado, HORA_APERTURA, combinarFechaHora, sumarDias } from '../models/funcion.model';
import { FormatoSala } from '../models/sala.model';

// Resultado de programar: la sala asignada (null = no había ninguna libre en ese horario)
export interface FuncionProgramada {
  inicio: string;
  id: number | null;
  sala: number | null;
}

const COLUMNAS = 'id, pelicula_id, sala_id, inicio, fin, fin_limpieza, idioma, precio_base, estado, created_at';
const RELACIONES =
  'pelicula:peliculas(id, titulo, duracion_min, imagen_url, edad_minima), sala:salas(id, numero, formato)';

@Injectable({ providedIn: 'root' })
export class FuncionesService {
  private readonly supabase = inject(SupabaseService);

  // Funciones que ocupan alguna parte del día operativo: desde las 00:00 del día
  // (lo que queda de la noche anterior) hasta la apertura del día siguiente
  // (incluye la función de medianoche, que pertenece a este día).
  listarDia(fecha: string): Promise<FuncionListado[]> {
    return this.listarDias(fecha, 1);
  }

  // Lo mismo para varios días seguidos (se usa al repetir una función)
  async listarDias(fecha: string, dias: number): Promise<FuncionListado[]> {
    const desde = combinarFechaHora(fecha, '00:00').toISOString();
    const hasta = combinarFechaHora(sumarDias(fecha, dias), HORA_APERTURA).toISOString();

    const { data, error } = await this.supabase.client
      .from('funciones')
      .select(`${COLUMNAS}, ${RELACIONES}`)
      .lt('inicio', hasta)
      .gt('fin_limpieza', desde)
      .order('inicio');

    if (error) {
      throw error;
    }

    return data as unknown as FuncionListado[];
  }

  async obtener(id: number): Promise<Funcion | null> {
    const { data, error } = await this.supabase.client
      .from('funciones')
      .select(COLUMNAS)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data as Funcion | null;
  }

  // fin y fin_limpieza los calcula el trigger calcular_fin_funcion (BEFORE INSERT/UPDATE)
  async guardar(datos: FuncionGuardar, id?: number): Promise<void> {
    const { error } = id === undefined
      ? await this.supabase.client.from('funciones').insert(datos)
      : await this.supabase.client.from('funciones').update(datos).eq('id', id);

    if (error) {
      throw error;
    }
  }

  // Varias funciones en un solo insert: si una falla (ej.: otro empleado ocupó la sala),
  // no se guarda ninguna. Así nunca queda una repetición a medias.
  async crearVarias(funciones: FuncionGuardar[]): Promise<void> {
    const { error } = await this.supabase.client.from('funciones').insert(funciones);

    if (error) {
      throw error;
    }
  }

  // ---------- Asignación automática de salas (funciones de la base) ----------

  // Programa una función por cada inicio; la base asigna la primera sala libre de ese formato.
  async programar(
    peliculaId: number,
    inicios: string[],
    formato: FormatoSala,
    idioma: string,
    precio: number,
  ): Promise<FuncionProgramada[]> {
    const { data, error } = await this.supabase.client.rpc('programar_funciones', {
      p_pelicula: peliculaId,
      p_inicios: inicios,
      p_formato: formato,
      p_idioma: idioma,
      p_precio: precio,
    });

    if (error) {
      throw error;
    }

    return (data as { inicio_funcion: string; id_funcion: number | null; numero_sala: number | null }[]).map(f => ({
      inicio: f.inicio_funcion,
      id: f.id_funcion,
      sala: f.numero_sala,
    }));
  }

  // Edita una función: mantiene su sala si sigue libre y el formato no cambió;
  // si no, busca otra sala libre del formato. Devuelve el número de sala.
  async reprogramar(
    id: number,
    peliculaId: number,
    inicio: string,
    formato: FormatoSala,
    idioma: string,
    precio: number,
  ): Promise<number> {
    const { data, error } = await this.supabase.client.rpc('reprogramar_funcion', {
      p_id: id,
      p_pelicula: peliculaId,
      p_inicio: inicio,
      p_formato: formato,
      p_idioma: idioma,
      p_precio: precio,
    });

    if (error) {
      throw error;
    }

    return data as number;
  }

  // Con entradas vendidas la función no puede cambiar de sala (ni de formato)
  async tieneEntradas(id: number): Promise<boolean> {
    const { data, error } = await this.supabase.client.rpc('funcion_tiene_entradas', { p_id: id });

    if (error) {
      throw error;
    }

    return data === true;
  }

  async cambiarEstado(id: number, estado: string): Promise<void> {
    const { error } = await this.supabase.client.from('funciones').update({ estado }).eq('id', id);

    if (error) {
      throw error;
    }
  }

  // Si ya tiene entradas vendidas, la base lo impide (error 23503)
  async eliminar(id: number): Promise<void> {
    const { error } = await this.supabase.client.from('funciones').delete().eq('id', id);

    if (error) {
      throw error;
    }
  }

  // Valores de un enum de la base (función enum_valores de funciones.sql)
  async valoresEnum(nombre: 'idioma_funcion' | 'estado_funcion'): Promise<string[]> {
    const { data, error } = await this.supabase.client.rpc('enum_valores', { nombre });

    if (error) {
      throw error;
    }

    return (data as string[] | null) ?? [];
  }
}