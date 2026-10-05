// Tabla public.configuracion (una sola fila: id = 1)
export interface Configuracion {
  id: number;
  recargo_vip: number;
  puntos_por_peso: number;
  puntos_entrada_gratis: number;
  horas_limite_cancelacion: number;
  precio_estreno: number | null; // precio sugerido de la entrada de un estreno
  precio_clasico: number | null; // precio sugerido de la entrada de un clásico
  updated_at: string;
}

export type ConfiguracionEditable = Omit<Configuracion, 'id' | 'updated_at'>;