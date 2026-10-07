// Fila del reporte de facturación (función reporte_facturacion)
export interface FilaFacturacion {
  dia: string;        // 'AAAA-MM-DD'
  compras: number;
  facturado: number;  // cobrado con dinero
  credito: number;    // pagado con crédito a favor
  descuentos: number;
  puntos: number;     // puntos canjeados
}

// Fila del reporte de entradas (función reporte_entradas)
export interface FilaEntradas {
  dia: string;
  vendidas: number;
  devueltas: number;
  netas: number;
  con_puntos: number;
  funciones: number;
}

export interface RangoReporte {
  desde: string; // 'AAAA-MM-DD'
  hasta: string;
}

// Lo que necesita la exportación (PDF / Excel): es igual para cualquier reporte
export interface ColumnaReporte {
  titulo: string;
  tipo: 'fecha' | 'numero' | 'moneda';
}

export interface DatosExportacion {
  titulo: string;           // 'Facturación por día'
  archivo: string;          // 'facturacion' → OneCine-facturacion-2026-10-01_2026-10-07
  rango: RangoReporte;
  columnas: ColumnaReporte[];
  filas: (string | number)[][];
  totales: (string | number)[]; // primera celda: 'Total'
  resumen: { etiqueta: string; valor: string }[];
}

const MENSAJES: Record<string, string> = {
  SOLO_ADMIN: 'Solo el administrador puede ver los reportes.',
  RANGO_INVALIDO: 'La fecha "desde" tiene que ser anterior o igual a "hasta".',
  RANGO_DEMASIADO_LARGO: 'Elegí un rango de hasta un año.',
};

export function mensajeErrorReporte(error: unknown): string {
  const mensaje = (error as { message?: string } | null)?.message ?? '';
  const codigo = Object.keys(MENSAJES).find(c => mensaje.includes(c));
  return codigo ? MENSAJES[codigo] : 'No pudimos generar el reporte. Intentá de nuevo.';
}