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
  puntos?: number; // unidades de esta línea pagadas con puntos (solo productos canjeables)
}

export interface CompraConfirmada {
  id: string;
  codigo: string;
  subtotal: number; // lo pagado con dinero, antes del descuento
  descuento: number;
  total: number;   // lo pagado con DINERO
  credito_usado: number;
  puntos_usados: number;
  puntos_ganados: number;
}

// ---------- Crédito a favor (devoluciones) ----------

export interface MovimientoCredito {
  id: number;
  fecha: string;
  concepto: string;
  ingreso: number;
  egreso: number;
  saldo: number;
}

export interface ResumenCredito {
  disponible: number;
  movimientos: MovimientoCredito[];
}

export interface ResultadoDevolucion {
  credito: number; // crédito generado
  saldo: number;   // crédito disponible después de la devolución
}

// ---------- Puntos (solo clientes registrados) ----------

export interface MovimientoPuntos {
  id: number;
  fecha: string;
  concepto: string;
  obtenidos: number;
  utilizados: number;
  saldo: number;
}

export interface ResumenPuntos {
  disponibles: number;
  movimientos: MovimientoPuntos[];
}

// Algo que se puede pagar con puntos en una compra (entrada o producto)
export interface OpcionCanje {
  clave: string;    // 'entrada' | 'producto-12'
  nombre: string;
  puntos: number;   // costo en puntos de UNA unidad
  maximo: number;   // unidades que se pueden canjear (las de la compra)
}

// Descuento que le corresponde al cliente (función descuento_aplicable):
// el de primera compra o, si ya compró, el de su edad (nunca los dos)
export interface DescuentoAplicable {
  id: number;
  nombre: string;
  porcentaje: number;
  tipo: 'primera_compra' | 'edad';
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
  CARRITO_VACIO: 'Tu carrito está vacío.',
  CREDITO_INSUFICIENTE: 'No tenés crédito suficiente.',
  CREDITO_SOLO_REGISTRADOS: 'El crédito es solo para clientes registrados.',
  FUERA_DE_PLAZO: 'Ya no se puede devolver: el plazo vence 2 horas antes de la función.',
  ENTRADA_YA_USADA: 'Las entradas ya se usaron para ingresar a la sala.',
  YA_DEVUELTA: 'Esto ya fue devuelto.',
  NO_ES_TU_COMPRA: 'Esta compra no pertenece a tu cuenta.',
  COMBO_CON_ENTRADA: 'Los combos con entrada se devuelven junto con su entrada.',
  COMBO_YA_RETIRADO: 'El combo de esta entrada ya se retiró en el candy: la entrada no se puede devolver.',
  PUNTOS_INSUFICIENTES: 'No tenés puntos suficientes para ese canje.',
  PUNTOS_SOLO_REGISTRADOS: 'Los puntos son solo para clientes registrados.',
  ITEM_NO_CANJEABLE: 'Uno de los productos elegidos no se puede pagar con puntos.',
  EDAD_INSUFICIENTE: 'No tenés la edad mínima que pide esta película para comprar entradas.',
  // Validación (boletería / candy)
  SOLO_EMPLEADOS: 'Solo el personal del cine puede validar compras.',
  SIN_PERMISO: 'Tu puesto no puede validar este tipo de canje.',
  CODIGO_INEXISTENTE: 'No existe ninguna compra con ese código.',
  COMPRA_NO_VIGENTE: 'Esta compra fue cancelada: el código ya no es válido.',
  SIN_ENTRADAS: 'Esta compra no tiene entradas para validar.',
  SIN_CANDY: 'Esta compra no tiene productos del candy.',
  ENTRADAS_YA_VALIDADAS: 'Las entradas de esta compra ya fueron validadas.',
  CANDY_YA_RETIRADO: 'Los productos del candy de esta compra ya fueron retirados.',
  FUNCION_FINALIZADA: 'La función de estas entradas ya terminó.',
  COMBO_REQUIERE_FUNCION: 'Un combo con entrada se compra junto con una función. Elegí la película y el horario.',
};

export function mensajeErrorCompra(error: unknown, porDefecto: string): string {
  const mensaje = (error as { message?: string } | null)?.message ?? '';
  const codigo = Object.keys(MENSAJES).find(c => mensaje.includes(c));
  return codigo ? MENSAJES[codigo] : porDefecto;
}

export function esError(error: unknown, codigo: string): boolean {
  return ((error as { message?: string } | null)?.message ?? '').includes(codigo);
}

// ---------- Código QR único por compra ----------
// Un solo QR por compra: sirve en boletería (entradas) y en el candy (productos).
// Cada parte se canjea una vez; el QR queda "usado" cuando se canjeó todo.
export const qrCompra = (codigo: string): string => `ONECINE|COMPRA|${codigo}`;

// Texto leído del QR (o escrito a mano) → código de compra. Acepta también los QR viejos.
export function codigoDesdeQr(texto: string): string {
  return texto.trim().toUpperCase().replace(/^ONECINE\|(COMPRA|SALA|CANDY)\|/, '');
}

// Estado del QR según lo que ya se canjeó
export type EstadoQr = 'vigente' | 'parcial' | 'usado' | 'anulado';

export function estadoQr(compra: {
  estado: string;
  tieneEntradas: boolean;
  tieneCandy: boolean;
  validadaSala: boolean;
  validadaCandy: boolean;
}): EstadoQr {
  if (compra.estado !== 'pagada') {
    return 'anulado';
  }
  const pendientes = [compra.tieneEntradas && !compra.validadaSala, compra.tieneCandy && !compra.validadaCandy];
  const canjeadas = [compra.tieneEntradas && compra.validadaSala, compra.tieneCandy && compra.validadaCandy];
  if (!pendientes.some(Boolean)) {
    return 'usado';
  }
  return canjeadas.some(Boolean) ? 'parcial' : 'vigente';
}

export const ETIQUETAS_ESTADO_QR: Record<EstadoQr, string> = {
  vigente: 'QR vigente',
  parcial: 'QR vigente (canje parcial)',
  usado: 'QR usado',
  anulado: 'QR anulado',
};

// ---------- Validación (respuesta de consultar_compra / validar_compra) ----------
export interface CompraValidacion {
  codigo: string;
  estado: string;
  creada: string;
  invitado: boolean;
  cliente: string | null;
  total: number;
  validada_sala_at: string | null;
  validada_candy_at: string | null;
  funcion: {
    inicio: string;
    fin: string;
    idioma: string;
    sala: number;
    formato: string;
    pelicula: string;
    edad_minima: number;
  } | null;
  butacas: string[];
  items: { nombre: string; cantidad: number }[];
}

// ---------- Mis entradas ----------

export interface EntradaDeCompra {
  id: number;
  precio: number;
  tipo_butaca: 'estandar' | 'vip' | 'accesible';
  estado: string;
  canjeada_con_puntos: boolean;
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
  id: number;
  cantidad: number;
  canjeado_con_puntos: boolean;
  devuelto_at: string | null;
  precio_unitario: number;
  producto: { nombre: string } | null;
  combo: { nombre: string; incluye_entrada: boolean } | null;
}

export interface MiCompra {
  id: string;
  codigo: string;
  subtotal: number;
  monto_descuento: number;
  total: number;
  credito_usado: number;
  puntos_usados: number;
  puntos_ganados: number;
  estado: string;
  created_at: string;
  validada_sala_at: string | null;
  validada_candy_at: string | null;
  entradas: EntradaDeCompra[];
  compra_items: ItemDeCompra[];
}