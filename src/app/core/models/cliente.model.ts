// Valores del ENUM tipo_sangre de PostgreSQL
export const TIPOS_SANGRE = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

export type TipoSangre = (typeof TIPOS_SANGRE)[number];

// Lista definida por la aplicación (en la base, color_ojos es text)
export const COLORES_OJOS = ['marrón', 'negro', 'avellana', 'verde', 'azul', 'gris'] as const;

export type ColorOjos = (typeof COLORES_OJOS)[number];

// Datos que el formulario le entrega al AuthService
export interface RegistroCliente {
  email: string;
  password: string;
  nombre: string;
  apellido: string;
  fechaNacimiento: string; // 'AAAA-MM-DD'
  tipoSangre: TipoSangre;
  colorOjos: ColorOjos;
  diasVacaciones: number;
}