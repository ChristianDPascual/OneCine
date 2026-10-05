import { Pelicula } from './pelicula.model';
import { Sala } from './sala.model';

// Máximo de butacas por compra (mismo valor que maximo_butacas_compra() en la base)
export const MAXIMO_BUTACAS = 10;

// Estado de una butaca para el usuario actual (función estado_butacas)
//  libre: no aparece en la consulta · procesando: esperando respuesta de la base
export type EstadoButacaCompra = 'libre' | 'vendida' | 'reservada' | 'mia' | 'procesando';

export interface FilaEstadoButaca {
  butaca_id: number;
  estado: 'vendida' | 'reservada' | 'mia';
  vence_at: string | null; // solo en las mías
}

// Función con lo necesario para comprar
export interface FuncionDeCompra {
  id: number;
  inicio: string;
  fin: string;
  idioma: string;
  precio_base: number;
  estado: string;
  sala: Pick<Sala, 'id' | 'numero' | 'formato'>;
  pelicula: Pick<Pelicula, 'id' | 'titulo' | 'imagen_url' | 'duracion_min' | 'edad_minima'>;
}

// Función en la ficha de la película (para elegir día y horario)
export interface FuncionDePelicula {
  id: number;
  inicio: string;
  idioma: string;
  precio_base: number;
  sala: Pick<Sala, 'numero' | 'formato'>;
}

// Lo que se manda a confirmar_compra
export interface ItemCompra {
  tipo: 'producto' | 'combo';
  id: number;
  cantidad: number;
}

export interface CompraConfirmada {
  id: string;
  codigo: string;
  subtotal: number;
  descuento: number;
  total: number;
}

// Descuento de primera compra que le corresponde al cliente (función descuento_primera_compra)
export interface DescuentoAplicable {
  id: number;
  nombre: string;
  porcentaje: number;
}

// Errores que lanza la base (raise exception 'CODIGO') → mensaje para el usuario
const MENSAJES: Record<string, string> = {
  BUTACA_RESERVADA: 'Esta butaca ya se encuentra reservada, por favor elija otra butaca.',
  BUTACA_VENDIDA: 'Esta butaca ya fue vendida, por favor elija otra butaca.',
  BUTACA_INVALIDA: 'Esa butaca no pertenece a la sala de esta función.',
  MAXIMO_BUTACAS: `Podés reservar hasta ${MAXIMO_BUTACAS} butacas por compra.`,
  FUNCION_NO_DISPONIBLE: 'Esta función ya no está disponible para la venta.',
  RESERVA_VENCIDA: 'Se venció el tiempo de reserva y las butacas se liberaron. Elegilas de nuevo.',
  COMBOS_SUPERAN_BUTACAS: 'Tenés más combos con entrada que butacas elegidas.',
  ITEM_NO_DISPONIBLE: 'Algún producto del candy ya no está disponible. Revisá tu pedido.',
  ITEM_INVALIDO: 'Hay un producto con una cantidad inválida.',
  SOLO_CLIENTES: 'Solo los clientes registrados pueden comprar entradas.',
  SIN_SESION: 'Tu sesión se cerró. Iniciá sesión de nuevo para comprar.',
};

export function mensajeErrorCompra(error: unknown, porDefecto: string): string {
  const mensaje = (error as { message?: string } | null)?.message ?? '';
  const codigo = Object.keys(MENSAJES).find(c => mensaje.includes(c));
  return codigo ? MENSAJES[codigo] : porDefecto;
}

export function esError(error: unknown, codigo: string): boolean {
  return ((error as { message?: string } | null)?.message ?? '').includes(codigo);
}

// ---------- Códigos QR ----------
// Un mismo código de compra, dos QR: uno para entrar a la sala y otro para retirar en el candy.
// El prefijo le dice al validador de cada puesto qué está leyendo.
export const qrSala = (codigo: string): string => `ONECINE|SALA|${codigo}`;
export const qrCandy = (codigo: string): string => `ONECINE|CANDY|${codigo}`;

// ---------- Mis entradas ----------

export interface EntradaDeCompra {
  id: number;
  precio: number;
  tipo_butaca: 'estandar' | 'vip' | 'accesible';
  estado: string;
  butaca: { fila: string; bloque: string; numero: number };
  funcion: {
    id: number;
    inicio: string;
    idioma: string;
    sala: Pick<Sala, 'numero' | 'formato'>;
    pelicula: Pick<Pelicula, 'titulo' | 'imagen_url' | 'edad_minima'>;
  };
}

export interface ItemDeCompra {
  cantidad: number;
  precio_unitario: number;
  producto: { nombre: string } | null;
  combo: { nombre: string; incluye_entrada: boolean } | null;
}

export interface MiCompra {
  id: string;
  codigo: string;
  total: number;
  estado: string;
  created_at: string;
  validada_sala_at: string | null;
  validada_candy_at: string | null;
  entradas: EntradaDeCompra[];
  compra_items: ItemDeCompra[];
}