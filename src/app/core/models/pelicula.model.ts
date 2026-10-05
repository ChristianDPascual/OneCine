import { Genero } from './genero.model';

// CHECK de peliculas: edad_minima ∈ {0, 13, 17}
export const EDADES_MINIMAS = [0, 13, 17] as const;

export type EdadMinima = (typeof EDADES_MINIMAS)[number];

export const ETIQUETAS_EDAD: Record<EdadMinima, string> = {
  0: 'ATP',
  13: '+13',
  17: '+17',
};

// Tabla public.peliculas
export interface Pelicula {
  id: number;
  titulo: string;
  director: string | null;
  sinopsis: string;
  duracion_min: number;
  edad_minima: EdadMinima;
  imagen_url: string | null;
  fecha_estreno: string; // 'AAAA-MM-DD'
  es_clasico: boolean;
  visible: boolean;
  precio: number | null;          // precio normal de la entrada
  precio_preventa: number | null; // precio especial durante la preventa
  dias_preventa: number;
  created_at: string;
}

// Lo que necesita un listado público: datos de la película + sus géneros
export type PeliculaListado = Pick<Pelicula, 'id' | 'titulo' | 'director' | 'sinopsis' | 'duracion_min' | 'edad_minima' | 'imagen_url' | 'fecha_estreno' | 'es_clasico'> & { generos: Genero[] };

// Película completa para el panel de administración
export type PeliculaAdmin = Pelicula & { generos: Genero[] };

// Lo que se envía al crear o editar (id y created_at los genera la base)
export type PeliculaGuardar = Omit<Pelicula, 'id' | 'created_at'>;

// Categorías de lanzamiento (reglas definidas por la app)
//  proximamente → fecha_estreno > hoy
//  estreno      → fecha_estreno <= hoy y es_clasico = false
//  clasico      → es_clasico = true
export type Lanzamiento = 'proximamente' | 'estreno' | 'clasico';

export interface FiltrosPeliculas {
  generos: number[];
  edad: EdadMinima | null;
  lanzamiento: Lanzamiento | null;
}

// Filtros + texto del buscador
export interface BusquedaPeliculas extends FiltrosPeliculas {
  texto: string | null;
}

// 'AAAA-MM-DD' según la fecha local (no UTC)
export function fechaDeHoy(): string {
  const hoy = new Date();
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${hoy.getFullYear()}-${dos(hoy.getMonth() + 1)}-${dos(hoy.getDate())}`;
}

export function lanzamientoDe(pelicula: Pick<Pelicula, 'fecha_estreno' | 'es_clasico'>, hoy = fechaDeHoy()): Lanzamiento {
  if (pelicula.es_clasico) {
    return 'clasico';
  }
  return pelicula.fecha_estreno > hoy ? 'proximamente' : 'estreno';
}