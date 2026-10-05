import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { CategoriaConCantidad, CategoriaProducto } from '../models/producto.model';

// Así llega cada fila: productos(count) es un agregado de PostgREST
interface FilaCategoria extends CategoriaProducto {
  productos: { count: number }[];
}

@Injectable({ providedIn: 'root' })
export class CategoriasProductoService {
  private readonly supabase = inject(SupabaseService);

  // Categorías en el orden de la carta, con la cantidad de productos de cada una
  async listar(): Promise<CategoriaConCantidad[]> {
    const { data, error } = await this.supabase.client
      .from('categorias_producto')
      .select('id, nombre, orden, productos(count)')
      .order('orden')
      .order('nombre');

    if (error) {
      throw error;
    }

    return (data as unknown as FilaCategoria[]).map(({ productos, ...categoria }) => ({
      ...categoria,
      cantidad: productos[0]?.count ?? 0,
    }));
  }

  async crear(nombre: string, orden: number): Promise<void> {
    const { error } = await this.supabase.client
      .from('categorias_producto')
      .insert({ nombre, orden });

    if (error) {
      throw error;
    }
  }

  async renombrar(id: number, nombre: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('categorias_producto')
      .update({ nombre })
      .eq('id', id);

    if (error) {
      throw error;
    }
  }

  // Guarda el orden de la lista tal como quedó (0, 1, 2...). Solo actualiza las que cambiaron.
  async guardarOrden(categorias: CategoriaProducto[]): Promise<void> {
    const cambios = categorias
      .map((categoria, indice) => ({ id: categoria.id, orden: indice, anterior: categoria.orden }))
      .filter(c => c.orden !== c.anterior);

    const resultados = await Promise.all(
      cambios.map(c =>
        this.supabase.client.from('categorias_producto').update({ orden: c.orden }).eq('id', c.id),
      ),
    );

    const conError = resultados.find(r => r.error);
    if (conError?.error) {
      throw conError.error;
    }
  }

  // Solo se puede eliminar una categoría vacía (la FK de productos lo impide si no)
  async eliminar(id: number): Promise<void> {
    const { error } = await this.supabase.client
      .from('categorias_producto')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }
  }
}