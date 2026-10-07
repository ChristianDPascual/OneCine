import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { MiResena, Puntuacion, Resena, ResenasDePelicula } from '../models/resena.model';

const MAXIMO_RESENAS = 20;

@Injectable({ providedIn: 'root' })
export class ResenasService {
  private readonly supabase = inject(SupabaseService);

  // Puntuación promedio + últimas reseñas con comentario, en paralelo
  async dePelicula(peliculaId: number): Promise<ResenasDePelicula> {
    const [puntuacion, resenas] = await Promise.all([
      this.supabase.client
        .from('puntuacion_peliculas')
        .select('promedio, cantidad')
        .eq('pelicula_id', peliculaId)
        .maybeSingle(),
      this.supabase.client
        .from('resenas_publicas')
        .select('id, pelicula_id, estrellas, comentario, created_at, autor')
        .eq('pelicula_id', peliculaId)
        .not('comentario', 'is', null)
        .neq('comentario', '')
        .order('created_at', { ascending: false })
        .limit(MAXIMO_RESENAS),
    ]);

    if (puntuacion.error) {
      throw puntuacion.error;
    }
    if (resenas.error) {
      throw resenas.error;
    }

    const datos = puntuacion.data as { promedio: number | string; cantidad: number } | null;

    return {
      // numeric llega como texto desde PostgREST: se convierte a número
      puntuacion: datos && datos.cantidad > 0 ? { promedio: Number(datos.promedio), cantidad: datos.cantidad } : null,
      resenas: resenas.data as Resena[],
    };
  }

  // ---------- Reseña del cliente registrado ----------

  // Mi calificación de la película (null si todavía no califiqué)
  async miResena(peliculaId: number): Promise<MiResena | null> {
    const { data, error } = await this.supabase.client.rpc('mi_resena', { p_pelicula: peliculaId });
    if (error) {
      throw error;
    }
    return (data as MiResena | null) ?? null;
  }

  // Califica o actualiza la calificación (la base valida: cliente registrado, 1 a 5, 100 caracteres)
  async guardar(peliculaId: number, estrellas: number, comentario: string | null): Promise<void> {
    const { error } = await this.supabase.client.rpc('guardar_resena', {
      p_pelicula: peliculaId,
      p_estrellas: estrellas,
      p_comentario: comentario,
    });
    if (error) {
      throw error;
    }
  }

  async eliminar(peliculaId: number): Promise<void> {
    const { error } = await this.supabase.client.rpc('eliminar_resena', { p_pelicula: peliculaId });
    if (error) {
      throw error;
    }
  }
}