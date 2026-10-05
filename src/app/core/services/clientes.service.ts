import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class ClientesService {
  private readonly supabase = inject(SupabaseService);

  // null si el usuario no tiene fila en clientes (por ejemplo, un empleado)
  async obtenerNombre(id: string): Promise<string | null> {
    const { data, error } = await this.supabase.client
      .from('clientes')
      .select('nombre')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data?.nombre ?? null;
  }
}