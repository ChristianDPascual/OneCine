import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  // Cliente principal: maneja la sesión del usuario logueado
  readonly client: SupabaseClient = createClient(
    environment.supabaseUrl,
    environment.supabaseKey,
  );

  // Cliente sin sesión persistida: crea usuarios (altas de empleados)
  // sin reemplazar la sesión de quien está logueado
  readonly clienteAltas: SupabaseClient = createClient(
    environment.supabaseUrl,
    environment.supabaseKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: 'onecine-altas',
      },
    },
  );
}