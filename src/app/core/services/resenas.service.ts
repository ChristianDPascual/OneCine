import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Puntuacion, Resena, ResenasDePelicula } from '../models/resena.model';

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
}