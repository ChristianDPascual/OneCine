import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { StorageService } from './storage.service';
import { Combo, ComboAdmin, ComboGuardar, ItemComboGuardar, ProductoDeCombo } from '../models/combo.model';

const COLUMNAS =
  'id, nombre, descripcion, precio, imagen_url, incluye_entrada, destacado, activo, ' +
  'combo_productos(cantidad, productos(id, nombre, precio, imagen_url))';

// Las imágenes de combos van al mismo bucket que las de productos
const BUCKET_IMAGENES = 'productos';

// Así llega cada fila desde Supabase
interface FilaCombo extends Combo {
  combo_productos: { cantidad: number; productos: ProductoDeCombo }[];
}

function aComboAdmin({ combo_productos, ...combo }: FilaCombo): ComboAdmin {
  return {
    ...combo,
    items: combo_productos.map(cp => ({ producto: cp.productos, cantidad: cp.cantidad })),
  };
}

@Injectable({ providedIn: 'root' })
export class CombosService {
  private readonly supabase = inject(SupabaseService);
  private readonly storage = inject(StorageService);

  // Todos los combos (incluidos los inactivos), destacados primero
  async listar(): Promise<ComboAdmin[]> {
    const { data, error } = await this.supabase.client
      .from('combos')
      .select(COLUMNAS)
      .order('destacado', { ascending: false })
      .order('nombre');

    if (error) {
      throw error;
    }

    return (data as unknown as FilaCombo[]).map(aComboAdmin);
  }

  async obtener(id: number): Promise<ComboAdmin | null> {
    const { data, error } = await this.supabase.client
      .from('combos')
      .select(COLUMNAS)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ? aComboAdmin(data as unknown as FilaCombo) : null;
  }

  // Crea (sin id) o actualiza (con id) el combo y reemplaza sus productos
  async guardar(datos: ComboGuardar, items: ItemComboGuardar[], id?: number): Promise<number> {
    let comboId: number;

    if (id === undefined) {
      const { data, error } = await this.supabase.client
        .from('combos')
        .insert(datos)
        .select('id')
        .single();

      if (error) {
        throw error;
      }
      comboId = data.id;
    } else {
      const { error } = await this.supabase.client
        .from('combos')
        .update(datos)
        .eq('id', id);

      if (error) {
        throw error;
      }
      comboId = id;

      // Se borran los productos anteriores para volver a cargar la selección actual
      const { error: errorBorrar } = await this.supabase.client
        .from('combo_productos')
        .delete()
        .eq('combo_id', id);

      if (errorBorrar) {
        throw errorBorrar;
      }
    }

    if (items.length > 0) {
      const { error } = await this.supabase.client
        .from('combo_productos')
        .insert(items.map(item => ({ combo_id: comboId, ...item })));

      if (error) {
        throw error;
      }
    }

    return comboId;
  }

  async actualizar(id: number, cambios: Partial<Pick<Combo, 'activo' | 'destacado'>>): Promise<void> {
    const { error } = await this.supabase.client
      .from('combos')
      .update(cambios)
      .eq('id', id);

    if (error) {
      throw error;
    }
  }

  subirImagen(archivo: File): Promise<string> {
    return this.storage.subirImagen(BUCKET_IMAGENES, archivo);
  }
}