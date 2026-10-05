import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import {
  BusquedaPeliculas,
  PeliculaAdmin,
  PeliculaGuardar,
  PeliculaListado,
  fechaDeHoy,
} from '../models/pelicula.model';
import { Genero } from '../models/genero.model';

const COLUMNAS_LISTADO =
  'id, titulo, director, sinopsis, duracion_min, edad_minima, imagen_url, fecha_estreno, es_clasico';

const COLUMNAS_ADMIN =
  'id, titulo, director, sinopsis, duracion_min, edad_minima, imagen_url, fecha_estreno, ' +
  'es_clasico, visible, precio, precio_preventa, dias_preventa, created_at';

const GENEROS = 'pelicula_generos(generos(id, nombre))';

// Bucket público de Supabase Storage donde se guardan los pósters
const BUCKET_POSTERS = 'posters';

// Forma en la que llegan los géneros desde Supabase
type ConGenerosAnidados<T> = T & { pelicula_generos: { generos: Genero }[] };

// pelicula_generos: [{ generos: {id, nombre} }]  →  generos: [{id, nombre}]
function aplanarGeneros<T>({ pelicula_generos, ...pelicula }: ConGenerosAnidados<T>): T & { generos: Genero[] } {
  return { ...(pelicula as unknown as T), generos: pelicula_generos.map(pg => pg.generos) };
}

@Injectable({ providedIn: 'root' })
export class PeliculasService {
  private readonly supabase = inject(SupabaseService);

  // ---------- Sitio público ----------

  async buscar(busqueda: BusquedaPeliculas): Promise<PeliculaListado[]> {
    const filtrarPorGenero = busqueda.generos.length > 0;

    const select = [
      COLUMNAS_LISTADO,
      GENEROS,
      ...(filtrarPorGenero ? ['filtro:pelicula_generos!inner(genero_id)'] : []),
    ].join(', ');

    let consulta = this.supabase.client
      .from('peliculas')
      .select(select)
      .eq('visible', true);

    if (busqueda.texto) {
      consulta = consulta.ilike('titulo', `%${busqueda.texto}%`);
    }

    if (busqueda.edad !== null) {
      consulta = consulta.eq('edad_minima', busqueda.edad);
    }

    const hoy = fechaDeHoy();

    if (busqueda.lanzamiento === 'proximamente') {
      consulta = consulta.gt('fecha_estreno', hoy);
    } else if (busqueda.lanzamiento === 'estreno') {
      consulta = consulta.lte('fecha_estreno', hoy).eq('es_clasico', false);
    } else if (busqueda.lanzamiento === 'clasico') {
      consulta = consulta.eq('es_clasico', true);
    }

    if (filtrarPorGenero) {
      consulta = consulta.in('filtro.genero_id', busqueda.generos);
    }

    const { data, error } = await consulta.order('fecha_estreno', { ascending: false });

    if (error) {
      throw error;
    }

    return (data as unknown as ConGenerosAnidados<Omit<PeliculaListado, 'generos'>>[]).map(aplanarGeneros);
  }

  // ---------- Panel de administración ----------

  // Todas las películas, incluidas las ocultas
  async listarAdmin(): Promise<PeliculaAdmin[]> {
    const { data, error } = await this.supabase.client
      .from('peliculas')
      .select(`${COLUMNAS_ADMIN}, ${GENEROS}`)
      .order('fecha_estreno', { ascending: false });

    if (error) {
      throw error;
    }

    return (data as unknown as ConGenerosAnidados<Omit<PeliculaAdmin, 'generos'>>[]).map(aplanarGeneros);
  }

  async obtener(id: number): Promise<PeliculaAdmin | null> {
    const { data, error } = await this.supabase.client
      .from('peliculas')
      .select(`${COLUMNAS_ADMIN}, ${GENEROS}`)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ? aplanarGeneros(data as unknown as ConGenerosAnidados<Omit<PeliculaAdmin, 'generos'>>) : null;
  }

  // Crea (sin id) o actualiza (con id) la película y reemplaza sus géneros
  async guardar(datos: PeliculaGuardar, generos: number[], id?: number): Promise<number> {
    let peliculaId: number;

    if (id === undefined) {
      const { data, error } = await this.supabase.client
        .from('peliculas')
        .insert(datos)
        .select('id')
        .single();

      if (error) {
        throw error;
      }
      peliculaId = data.id;
    } else {
      const { error } = await this.supabase.client
        .from('peliculas')
        .update(datos)
        .eq('id', id);

      if (error) {
        throw error;
      }
      peliculaId = id;

      // Se borran los géneros anteriores para volver a cargar la selección actual
      const { error: errorBorrar } = await this.supabase.client
        .from('pelicula_generos')
        .delete()
        .eq('pelicula_id', id);

      if (errorBorrar) {
        throw errorBorrar;
      }
    }

    if (generos.length > 0) {
      const { error } = await this.supabase.client
        .from('pelicula_generos')
        .insert(generos.map(genero_id => ({ pelicula_id: peliculaId, genero_id })));

      if (error) {
        throw error;
      }
    }

    return peliculaId;
  }

  // Sube la imagen a Storage y devuelve su URL pública (la que se guarda en imagen_url)
  async subirPoster(archivo: File): Promise<string> {
    const extension = archivo.name.split('.').pop()?.toLowerCase() || 'jpg';
    const ruta = `${crypto.randomUUID()}.${extension}`;

    const storage = this.supabase.client.storage.from(BUCKET_POSTERS);
    const { error } = await storage.upload(ruta, archivo, {
      contentType: archivo.type,
      cacheControl: '31536000', // el nombre es único: el navegador la puede cachear un año
      upsert: false,
    });

    if (error) {
      throw error;
    }

    return storage.getPublicUrl(ruta).data.publicUrl;
  }

  async cambiarVisible(id: number, visible: boolean): Promise<void> {
    const { error } = await this.supabase.client
      .from('peliculas')
      .update({ visible })
      .eq('id', id);

    if (error) {
      throw error;
    }
  }
}