import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { StorageService } from './storage.service';
import { Producto, ProductoGuardar } from '../models/producto.model';

const COLUMNAS = 'id, categoria_id, nombre, descripcion, precio, imagen_url, puntos_canje, activo';
const BUCKET_PRODUCTOS = 'productos';

@Injectable({ providedIn: 'root' })
export class ProductosService {
  private readonly supabase = inject(SupabaseService);
  private readonly storage = inject(StorageService);

  // Todos los productos, incluidos los inactivos (panel de administración)
  async listar(): Promise<Producto[]> {
    const { data, error } = await this.supabase.client
      .from('productos')
      .select(COLUMNAS)
      .order('nombre');

    if (error) {
      throw error;
    }

    return data as Producto[];
  }

  async obtener(id: number): Promise<Producto | null> {
    const { data, error } = await this.supabase.client
      .from('productos')
      .select(COLUMNAS)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data as Producto | null;
  }

  // Crea (sin id) o actualiza (con id). Devuelve el id del producto.
  async guardar(datos: ProductoGuardar, id?: number): Promise<number> {
    if (id === undefined) {
      const { data, error } = await this.supabase.client
        .from('productos')
        .insert(datos)
        .select('id')
        .single();

      if (error) {
        throw error;
      }
      return data.id;
    }

    const { error } = await this.supabase.client
      .from('productos')
      .update(datos)
      .eq('id', id);

    if (error) {
      throw error;
    }
    return id;
  }

  async cambiarActivo(id: number, activo: boolean): Promise<void> {
    const { error } = await this.supabase.client
      .from('productos')
      .update({ activo })
      .eq('id', id);

    if (error) {
      throw error;
    }
  }

  subirImagen(archivo: File): Promise<string> {
    return this.storage.subirImagen(BUCKET_PRODUCTOS, archivo);
  }
}