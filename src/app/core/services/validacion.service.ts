import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { CompraValidacion, codigoDesdeQr } from '../models/compra.model';

export type TipoCanje = 'sala' | 'candy';

// Validación con el QR único de la compra (boletería y candy bar).
// La base controla permisos, que cada parte se canjee una sola vez y la concurrencia.
@Injectable({ providedIn: 'root' })
export class ValidacionService {
  private readonly supabase = inject(SupabaseService);

  // Datos de la compra (no canjea nada)
  async consultar(textoQr: string): Promise<CompraValidacion> {
    const { data, error } = await this.supabase.client.rpc('consultar_compra', { p_codigo: codigoDesdeQr(textoQr) });
    if (error) {
      throw error;
    }
    return data as CompraValidacion;
  }

  // Canjea las entradas ('sala') o los productos del candy ('candy')
  async validar(textoQr: string, tipo: TipoCanje): Promise<CompraValidacion> {
    const { data, error } = await this.supabase.client.rpc('validar_compra', {
      p_codigo: codigoDesdeQr(textoQr),
      p_tipo: tipo,
    });
    if (error) {
      throw error;
    }
    return data as CompraValidacion;
  }
}