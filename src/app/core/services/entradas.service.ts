import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class EntradasService {
  private readonly supabase = inject(SupabaseService);

  // Las entradas no tienen cliente_id: el dueño se obtiene a través de la compra
  async tieneEntradasCanceladas(clienteId: string): Promise<boolean> {
    const { count, error } = await this.supabase.client
      .from('entradas')
      .select('id, compras!inner(cliente_id)', { count: 'exact', head: true })
      .eq('estado', 'cancelada')
      .eq('compras.cliente_id', clienteId);

    if (error) {
      throw error;
    }

    return (count ?? 0) > 0;
  }
}