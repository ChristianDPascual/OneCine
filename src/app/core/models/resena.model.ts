// Reseña tal como se muestra en el sitio (vista resenas_publicas)
export interface Resena {
  id: number;
  pelicula_id: number;
  estrellas: number;          // 1 a 5
  comentario: string | null;  // opcional: se puede puntuar sin comentar
  created_at: string;
  autor: string;              // "Nombre A."
}

// Promedio de la película (vista puntuacion_peliculas)
export interface Puntuacion {
  promedio: number; // 1,0 a 5,0
  cantidad: number; // cantidad de votos
}

export interface ResenasDePelicula {
  puntuacion: Puntuacion | null; // null = todavía nadie puntuó
  resenas: Resena[];             // solo las que tienen comentario
}