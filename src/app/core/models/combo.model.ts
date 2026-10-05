import { Producto } from './producto.model';

// Tabla public.combos
export interface Combo {
  id: number;
  nombre: string;
  descripcion: string | null;
  precio: number;
  imagen_url: string | null;
  incluye_entrada: boolean;
  destacado: boolean;
  activo: boolean;
}

// Datos del producto que se muestran dentro de un combo
export type ProductoDeCombo = Pick<Producto, 'id' | 'nombre' | 'precio' | 'imagen_url'>;

// Una fila de combo_productos, con el producto ya resuelto
export interface ItemCombo {
  producto: ProductoDeCombo;
  cantidad: number;
}

// Combo + sus productos (para el panel)
export type ComboAdmin = Combo & { items: ItemCombo[] };

// Lo que se envía al crear o editar (el id lo genera la base: identity)
export type ComboGuardar = Omit<Combo, 'id'>;

// Lo que se guarda en combo_productos
export interface ItemComboGuardar {
  producto_id: number;
  cantidad: number;
}

// Cuánto costarían los productos del combo comprados por separado
// (la entrada no se suma: su precio depende de la función)
export function precioPorSeparado(items: ItemCombo[]): number {
  return items.reduce((total, item) => total + item.producto.precio * item.cantidad, 0);
}