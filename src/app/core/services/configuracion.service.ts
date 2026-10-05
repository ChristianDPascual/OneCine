import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Configuracion, ConfiguracionEditable } from '../models/configuracion.model';

const COLUMNAS =
  'id, recargo_vip, puntos_por_peso, puntos_entrada_gratis, horas_limite_cancelacion, ' +
  'precio_estreno, precio_clasico, updated_at';

// La base garantiza una única fila de configuración (id = 1)
const ID_CONFIGURACION = 1;

@Injectable({ providedIn: 'root' })
export class ConfiguracionService {
  private readonly supabase = inject(SupabaseService);

  async obtener(): Promise<Configuracion | null> {
    const { data, error } = await this.supabase.client
      .from('configuracion')
      .select(COLUMNAS)
      .eq('id', ID_CONFIGURACION)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data as Configuracion | null;
  }

  async actualizar(cambios: Partial<ConfiguracionEditable>): Promise<void> {
    const { error } = await this.supabase.client
      .from('configuracion')
      .update({ ...cambios, updated_at: new Date().toISOString() })
      .eq('id', ID_CONFIGURACION);

    if (error) {
      throw error;
    }
  }
}