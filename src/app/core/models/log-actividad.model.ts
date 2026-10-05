// Fila de public.log_actividad (la llena el trigger registrar_log)
export interface LogActividad {
  id: number;
  usuario_id: string | null;
  accion: string;
  tabla: string;
  registro_id: string | null;
  antes: Record<string, unknown> | null;
  despues: Record<string, unknown> | null;
  created_at: string;
}

// Filtros del listado (todos opcionales)
export interface FiltrosLog {
  tabla: string | null;
  accion: string | null;
  // uuid del usuario, 'sistema' (usuario_id null) o null (todos)
  usuario: string | null;
  desde: string | null; // 'YYYY-MM-DD'
  hasta: string | null; // 'YYYY-MM-DD'
  registro: string | null;
}

export interface PaginaLog {
  filas: LogActividad[];
  total: number;
}

export interface CambioCampo {
  campo: string;
  antes: unknown;
  despues: unknown;
}

// ---------- Etiquetas ----------

const ETIQUETAS_ACCION: Record<string, string> = {
  INSERT: 'Alta',
  UPDATE: 'Modificación',
  DELETE: 'Baja',
};

const ETIQUETAS_TABLA: Record<string, string> = {
  peliculas: 'Películas',
  pelicula_generos: 'Géneros de películas',
  funciones: 'Funciones',
  salas: 'Salas',
  butacas: 'Butacas',
  productos: 'Productos',
  categorias_producto: 'Categorías de productos',
  combos: 'Combos',
  combo_productos: 'Productos de combos',
  descuentos: 'Descuentos y promos',
  configuracion: 'Configuración',
  empleados: 'Empleados',
  clientes: 'Clientes',
  entradas: 'Entradas',
  compras: 'Compras',
};

// Si la acción o la tabla no está en el mapa, se muestra tal cual viene de la base
export const etiquetaAccion = (accion: string): string => ETIQUETAS_ACCION[accion.toUpperCase()] ?? accion;
export const etiquetaTabla = (tabla: string): string => ETIQUETAS_TABLA[tabla] ?? tabla;

// ---------- Diferencias entre "antes" y "después" ----------

// UPDATE: solo los campos que cambiaron. INSERT: todo "después". DELETE: todo "antes".
export function cambiosDe(log: LogActividad): CambioCampo[] {
  const antes = log.antes ?? {};
  const despues = log.despues ?? {};
  const campos = [...new Set([...Object.keys(antes), ...Object.keys(despues)])];

  return campos
    .map(campo => ({ campo, antes: antes[campo], despues: despues[campo] }))
    .filter(c => !log.antes || !log.despues || JSON.stringify(c.antes) !== JSON.stringify(c.despues));
}