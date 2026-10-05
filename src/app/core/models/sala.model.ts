// Valores de los enums de la base (formato de sala, tipo y bloque de butaca)
export const FORMATOS_SALA = ['2D', '3D', '4D', '5D'] as const;
export type FormatoSala = (typeof FORMATOS_SALA)[number];

export const DESCRIPCION_FORMATO: Record<FormatoSala, string> = {
  '2D': 'Proyección digital tradicional.',
  '3D': 'Proyección 3D con anteojos.',
  '4D': 'Butacas con movimiento sincronizado.',
  '5D': 'Movimiento más efectos (viento, agua, aromas).',
};

export type TipoButaca = 'estandar' | 'vip' | 'accesible';
export type BloqueButaca = 'izquierdo' | 'central' | 'derecho';

export const TIPOS_BUTACA: TipoButaca[] = ['estandar', 'vip', 'accesible'];
export const BLOQUES: BloqueButaca[] = ['izquierdo', 'central', 'derecho'];

export const ETIQUETAS_TIPO_BUTACA: Record<TipoButaca, string> = {
  estandar: 'Estándar',
  vip: 'VIP',
  accesible: 'Accesible',
};

export const ETIQUETAS_BLOQUE: Record<BloqueButaca, string> = {
  izquierdo: 'Izquierda',
  central: 'Centro',
  derecho: 'Derecha',
};

// Fila de public.salas
export interface Sala {
  id: number;
  numero: number;
  formato: FormatoSala;
}

// Sala con la cantidad de butacas de cada tipo (listado)
export interface SalaConCapacidad extends Sala {
  capacidad: Record<TipoButaca, number>;
  total: number;
}

export type SalaGuardar = Pick<Sala, 'numero' | 'formato'>;

// Fila de public.butacas (las genera el trigger generar_butacas al crear la sala)
export interface Butaca {
  id: number;
  sala_id: number;
  fila: string;
  bloque: BloqueButaca;
  numero: number;
  tipo: TipoButaca;
}