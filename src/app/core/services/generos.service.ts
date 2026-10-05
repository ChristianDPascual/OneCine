import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Genero } from '../models/genero.model';

@Injectable({ providedIn: 'root' })
export class GenerosService {
  private readonly supabase = inject(SupabaseService);

  async listar(): Promise<Genero[]> {
    const { data, error } = await this.supabase.client
      .from('generos')
      .select('id, nombre')
      .order('nombre');

    if (error) {
      throw error;
    }

    return data;
  }
}