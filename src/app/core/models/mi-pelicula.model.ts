import { EdadMinima } from './pelicula.model';

// Una función a la que fue el cliente (función mis_peliculas)
export interface FuncionVista {
  funcion_id: number;
  inicio: string;
  idioma: string;
  sala: number;
  formato: string;
  entradas: number;
  asistio: boolean; // la entrada se validó en la sala
}

// Una película del historial "Mis películas"
export interface MiPelicula {
  pelicula_id: number;
  titulo: string;
  imagen_url: string | null;
  edad_minima: EdadMinima;
  duracion_min: number;
  ultima: string;              // última vez que la vio
  funciones: FuncionVista[];   // de la más reciente a la más vieja
  mis_estrellas: number | null;
  mi_comentario: string | null;
}