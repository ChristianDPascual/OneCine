import { Pelicula } from './pelicula.model';
import { Sala } from './sala.model';

// ---------- Reglas de horario de la app (UX) ----------
// La base es la que impide superposiciones (restricción funciones_sin_superposicion)
// y calcula fin / fin_limpieza (trigger calcular_fin_funcion). Estas constantes solo
// sirven para validar y mostrar una vista previa mientras se completa el formulario.

export const HORA_APERTURA = '10:00';       // primera función posible del día
export const HORA_ULTIMO_INICIO = '00:00';  // última hora de inicio posible (medianoche)
export const MINUTOS_LIMPIEZA = 30;         // mismo valor que usa calcular_fin_funcion

// Rango que muestra la grilla del día (10:00 a 04:00 del día siguiente)
export const GRILLA_DESDE_HORA = 10;
export const GRILLA_HASTA_HORA = 28;

// ---------- Tipos ----------

// Fila de public.funciones (idioma y estado son enums: sus valores vienen de la base)
export interface Funcion {
  id: number;
  pelicula_id: number;
  sala_id: number;
  inicio: string;       // timestamptz (ISO)
  fin: string;          // lo calcula la base
  fin_limpieza: string; // lo calcula la base
  idioma: string;
  precio_base: number;
  estado: string;
  created_at: string;
}

export type PeliculaDeFuncion = Pick<Pelicula, 'id' | 'titulo' | 'duracion_min' | 'imagen_url' | 'edad_minima'>;
export type SalaDeFuncion = Pick<Sala, 'id' | 'numero' | 'formato'>;

export interface FuncionListado extends Funcion {
  pelicula: PeliculaDeFuncion;
  sala: SalaDeFuncion;
}

// Lo que se envía al guardar (fin y fin_limpieza los completa el trigger)
export type FuncionGuardar = Pick<Funcion, 'pelicula_id' | 'sala_id' | 'inicio' | 'idioma' | 'precio_base'>;

// ---------- Etiquetas ----------

const ETIQUETAS_IDIOMA: Record<string, string> = {
  castellano: 'Castellano',
  doblada: 'Doblada',
  subtitulada: 'Subtitulada',
  original: 'Idioma original',
  espanol: 'Español',
  ingles: 'Inglés',
};

const ETIQUETAS_ESTADO: Record<string, string> = {
  programada: 'Programada',
  cancelada: 'Cancelada',
  finalizada: 'Finalizada',
  en_curso: 'En curso',
};

const capitalizar = (texto: string): string => texto.charAt(0).toUpperCase() + texto.slice(1).replaceAll('_', ' ');

export const etiquetaIdioma = (valor: string): string => ETIQUETAS_IDIOMA[valor] ?? capitalizar(valor);
export const etiquetaEstado = (valor: string): string => ETIQUETAS_ESTADO[valor] ?? capitalizar(valor);

// ---------- Fechas (hora local de Argentina) ----------

const dos = (n: number) => String(n).padStart(2, '0');

// Date → 'AAAA-MM-DD' local
export function fechaLocal(fecha: Date): string {
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`;
}

// Date → 'HH:MM' local
export function horaLocal(fecha: Date): string {
  return `${dos(fecha.getHours())}:${dos(fecha.getMinutes())}`;
}

// 'AAAA-MM-DD' + 'HH:MM' en hora local → Date
export function combinarFechaHora(fecha: string, hora: string): Date {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const [h, m] = hora.split(':').map(Number);
  return new Date(anio, mes - 1, dia, h, m);
}

export function sumarDias(fecha: string, dias: number): string {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return fechaLocal(new Date(anio, mes - 1, dia + dias));
}

export function sumarMinutos(fecha: Date, minutos: number): Date {
  return new Date(fecha.getTime() + minutos * 60_000);
}

// ---------- Día operativo del cine ----------
// El cine abre a las 10:00 y la última función puede empezar a medianoche.
// Una función de las 00:00 pertenece a la noche del día anterior:
// "viernes 00:00" = sábado 00:00 en el calendario.

// ¿La hora está dentro del horario permitido? (soporta rangos que cruzan la medianoche)
export function horaPermitida(hora: string): boolean {
  return HORA_ULTIMO_INICIO >= HORA_APERTURA
    ? hora >= HORA_APERTURA && hora <= HORA_ULTIMO_INICIO
    : hora >= HORA_APERTURA || hora <= HORA_ULTIMO_INICIO;
}

// Día operativo + hora → momento real de inicio
export function inicioDeFuncion(dia: string, hora: string): Date {
  return combinarFechaHora(hora < HORA_APERTURA ? sumarDias(dia, 1) : dia, hora);
}

// Momento real de inicio → día operativo al que pertenece
export function diaOperativo(inicio: Date): string {
  const fecha = fechaLocal(inicio);
  return horaLocal(inicio) < HORA_APERTURA ? sumarDias(fecha, -1) : fecha;
}

// Regla de seguridad: las funciones se programan con al menos un día de anticipación.
// Devuelve el primer día operativo permitido (mañana).
export function primerDiaProgramable(): string {
  return sumarDias(fechaLocal(new Date()), 1);
}

// ¿Se superponen dos rangos [a, b) y [c, d)? Mismo criterio que el operador && de tstzrange
export function seSuperponen(inicioA: Date, finA: Date, inicioB: Date, finB: Date): boolean {
  return inicioA < finB && inicioB < finA;
}

// ---------- Disponibilidad de la película en una fecha ----------

export type Disponibilidad =
  | { ok: true; preventa: boolean }
  | { ok: false; motivo: string };

// Estreno: desde fecha_estreno. Preventa: los dias_preventa anteriores al estreno. Clásico: siempre.
export function disponibilidadEn(
  pelicula: Pick<Pelicula, 'fecha_estreno' | 'es_clasico' | 'dias_preventa' | 'precio_preventa'>,
  fecha: string,
): Disponibilidad {
  if (pelicula.es_clasico || fecha >= pelicula.fecha_estreno) {
    return { ok: true, preventa: false };
  }

  const tienePreventa = pelicula.precio_preventa !== null && (pelicula.dias_preventa ?? 0) > 0;
  const inicioPreventa = sumarDias(pelicula.fecha_estreno, -(pelicula.dias_preventa ?? 0));

  if (tienePreventa && fecha >= inicioPreventa) {
    return { ok: true, preventa: true };
  }

  return {
    ok: false,
    motivo: tienePreventa
      ? `La preventa empieza el ${formatoCorto(inicioPreventa)}.`
      : `La película se estrena el ${formatoCorto(pelicula.fecha_estreno)}.`,
  };
}

function formatoCorto(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-');
  return `${dia}/${mes}/${anio}`;
}