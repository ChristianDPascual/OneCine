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

// Reseña del cliente logueado para una película (función mi_resena)
export interface MiResena {
  estrellas: number;
  comentario: string | null;
  created_at: string;
}

export const MAXIMO_COMENTARIO = 100;

const MENSAJES_RESENA: Record<string, string> = {
  SOLO_CLIENTES: 'Solo los clientes registrados pueden calificar películas.',
  ESTRELLAS_INVALIDAS: 'Elegí de 1 a 5 estrellas.',
  COMENTARIO_LARGO: `El comentario puede tener hasta ${MAXIMO_COMENTARIO} caracteres.`,
  PELICULA_INEXISTENTE: 'La película ya no existe.',
};

export function mensajeErrorResena(error: unknown): string {
  const mensaje = (error as { message?: string } | null)?.message ?? '';
  const codigo = Object.keys(MENSAJES_RESENA).find(c => mensaje.includes(c));
  return codigo ? MENSAJES_RESENA[codigo] : 'No pudimos guardar tu reseña. Intentá de nuevo.';
}