// ENUM puesto_empleado
export const PUESTOS = ['admin', 'supervisor', 'confiteria', 'boleteria'] as const;

export type Puesto = (typeof PUESTOS)[number];

export const ETIQUETAS_PUESTO: Record<Puesto, string> = {
  admin: 'Administrador',
  supervisor: 'Supervisor',
  confiteria: 'Confitería',
  boleteria: 'Boletería',
};

// Tabla public.empleados
export interface Empleado {
  id: string;
  nombre: string;
  apellido: string;
  dni: string;
  email: string;
  puesto: Puesto;
  activo: boolean;
  created_at: string;
}

// Datos del empleado logueado que usa el panel
export type EmpleadoSesion = Pick<Empleado, 'id' | 'nombre' | 'apellido' | 'email' | 'puesto' | 'activo'>;

// Datos del formulario de alta
export interface NuevoEmpleado {
  nombre: string;
  apellido: string;
  dni: string;
  email: string;
  password: string;
  puesto: Puesto;
}

export interface SeccionAdmin {
  ruta: string;
  titulo: string;
  descripcion: string;
  puestos: Puesto[];
}

const GESTION: Puesto[] = ['admin', 'supervisor'];

// Única fuente de verdad de permisos: la usan las rutas y el inicio
export const SECCIONES_ADMIN: SeccionAdmin[] = [
  { ruta: 'validar-sala', titulo: 'Validar sala', descripcion: 'Escanear o ingresar el código de las entradas', puestos: ['boleteria', ...GESTION] },
  { ruta: 'validar-candy', titulo: 'Validar candy', descripcion: 'Entregar productos del candy bar', puestos: ['confiteria', ...GESTION] },
  { ruta: 'peliculas', titulo: 'Películas', descripcion: 'Cartelera, estrenos y preventa', puestos: GESTION },
  { ruta: 'funciones', titulo: 'Funciones', descripcion: 'Horarios y asignación de salas', puestos: GESTION },
  { ruta: 'salas', titulo: 'Salas', descripcion: 'Salas y formatos', puestos: GESTION },
  { ruta: 'productos', titulo: 'Productos', descripcion: 'Productos y categorías del candy', puestos: GESTION },
  { ruta: 'combos', titulo: 'Combos', descripcion: 'Combos y destacados', puestos: GESTION },
  { ruta: 'precios', titulo: 'Precios y promos', descripcion: 'Precios de entradas, descuentos, promociones y puntos', puestos: GESTION },
  { ruta: 'empleados', titulo: 'Empleados', descripcion: 'Altas y permisos del personal', puestos: GESTION },
  { ruta: 'reportes', titulo: 'Reportes', descripcion: 'Facturación, entradas y rankings', puestos: ['admin'] },
  { ruta: 'actividad', titulo: 'Log de actividad', descripcion: 'Quién hizo qué y cuándo', puestos: ['admin'] },
];

export function puestosDe(ruta: string): Puesto[] {
  return SECCIONES_ADMIN.find(s => s.ruta === ruta)?.puestos ?? [];
}

// Qué puestos puede dar de alta (y gestionar) cada puesto
export const PUESTOS_QUE_PUEDE_CREAR: Record<Puesto, Puesto[]> = {
  admin: ['admin', 'supervisor', 'confiteria', 'boleteria'],
  supervisor: ['confiteria', 'boleteria'],
  confiteria: [],
  boleteria: [],
};

// ¿El empleado logueado puede activar/desactivar a otro? Nunca a sí mismo.
export function puedeGestionar(actual: EmpleadoSesion, otro: Pick<Empleado, 'id' | 'puesto'>): boolean {
  return actual.id !== otro.id && PUESTOS_QUE_PUEDE_CREAR[actual.puesto].includes(otro.puesto);
}