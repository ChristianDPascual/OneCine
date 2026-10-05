import { fechaDeHoy } from './pelicula.model';

// Tabla public.descuentos
//  CHECK: 0 < porcentaje <= 100
//  CHECK: vigente_hasta >= vigente_desde (cuando las dos están cargadas)
export interface Descuento {
  id: number;
  nombre: string;
  porcentaje: number;
  es_primera_compra: boolean;
  edad_minima: number | null;
  vigente_desde: string | null; // 'AAAA-MM-DD'
  vigente_hasta: string | null; // 'AAAA-MM-DD'
  activo: boolean;
  created_at: string;
}

export type DescuentoGuardar = Omit<Descuento, 'id' | 'created_at'>;

// Cómo usa la app cada fila de descuentos:
//  primera compra → es_primera_compra = true (una sola fila)
//  por edad       → edad_minima cargada (por ejemplo, mayores de 50)
//  promoción      → las demás: descuentos por fechas creados por el admin
export function esPrimeraCompra(d: Descuento): boolean {
  return d.es_primera_compra;
}

export function esPorEdad(d: Descuento): boolean {
  return !d.es_primera_compra && d.edad_minima !== null;
}

export function esPromocion(d: Descuento): boolean {
  return !d.es_primera_compra && d.edad_minima === null;
}

export type EstadoPromocion = 'vigente' | 'programada' | 'vencida' | 'inactiva';

export function estadoPromocion(d: Descuento, hoy = fechaDeHoy()): EstadoPromocion {
  if (!d.activo) {
    return 'inactiva';
  }
  if (d.vigente_desde && d.vigente_desde > hoy) {
    return 'programada';
  }
  if (d.vigente_hasta && d.vigente_hasta < hoy) {
    return 'vencida';
  }
  return 'vigente';
}