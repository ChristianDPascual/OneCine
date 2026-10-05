// Tabla public.categorias_producto
export interface CategoriaProducto {
  id: number;
  nombre: string;
  orden: number;
}

// Categoría + cantidad de productos que tiene (para el ABM de categorías)
export interface CategoriaConCantidad extends CategoriaProducto {
  cantidad: number;
}

// Tabla public.productos
export interface Producto {
  id: number;
  categoria_id: number;
  nombre: string;
  descripcion: string | null;
  precio: number;
  imagen_url: string | null;
  puntos_canje: number | null; // null = no se puede canjear con puntos
  activo: boolean;
}

// Lo que se envía al crear o editar (el id lo genera la base: identity)
export type ProductoGuardar = Omit<Producto, 'id'>;