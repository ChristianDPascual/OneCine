import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthError } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { Empleado, EmpleadoSesion, NuevoEmpleado, SECCIONES_ADMIN } from '../models/empleado.model';

export type ResultadoOperacion = { ok: true } | { ok: false; mensaje: string };

const COLUMNAS = 'id, nombre, apellido, dni, email, puesto, activo, created_at';

@Injectable({ providedIn: 'root' })
export class EmpleadosService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);

  private readonly empleadoActual = signal<EmpleadoSesion | null>(null);
  private usuarioCargado: string | null = null;

  readonly actual = this.empleadoActual.asReadonly();

  // Secciones del panel que puede ver el empleado logueado
  readonly secciones = computed(() => {
    const empleado = this.empleadoActual();
    return empleado ? SECCIONES_ADMIN.filter(s => s.puestos.includes(empleado.puesto)) : [];
  });

  // ---------- Empleado logueado ----------

  async obtenerActual(): Promise<EmpleadoSesion | null> {
    await this.auth.esperarInicio();
    const usuario = this.auth.usuario();

    if (!usuario?.email) {
      this.usuarioCargado = null;
      this.empleadoActual.set(null);
      return null;
    }

    if (this.usuarioCargado !== usuario.id) {
      this.empleadoActual.set(await this.buscarPorEmail(usuario.email));
      this.usuarioCargado = usuario.id;
    }

    return this.empleadoActual();
  }

  private async buscarPorEmail(email: string): Promise<EmpleadoSesion | null> {
    const { data, error } = await this.supabase.client
      .from('empleados')
      .select('id, nombre, apellido, email, puesto, activo')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data as EmpleadoSesion | null;
  }

  // ---------- ABM ----------

  async listar(): Promise<Empleado[]> {
    const { data, error } = await this.supabase.client
      .from('empleados')
      .select(COLUMNAS)
      .order('apellido')
      .order('nombre');

    if (error) {
      throw error;
    }

    return data as Empleado[];
  }

  async crear(datos: NuevoEmpleado): Promise<ResultadoOperacion> {
    const email = datos.email.trim().toLowerCase();
    const dni = datos.dni.trim();

    try {
      // 1. Verificar duplicados ANTES de crear el usuario de Auth
      if (await this.existe('email', email)) {
        return { ok: false, mensaje: 'Ya existe un empleado con ese correo electrónico.' };
      }
      if (await this.existe('dni', dni)) {
        return { ok: false, mensaje: 'Ya existe un empleado con ese DNI.' };
      }

      // 2. Crear el usuario con el cliente SIN sesión (no reemplaza la del admin).
      //    tipo = 'empleado' → el trigger crear_cliente() no crea fila en clientes.
      const altas = this.supabase.clienteAltas;
      const { data, error } = await altas.auth.signUp({
        email,
        password: datos.password,
        options: { data: { tipo: 'empleado', nombre: datos.nombre, apellido: datos.apellido } },
      });

      if (error) {
        return { ok: false, mensaje: this.traducirErrorAuth(error) };
      }

      const usuario = data.user;
      if (!usuario || usuario.identities?.length === 0) {
        return { ok: false, mensaje: 'Ya existe un usuario con ese correo electrónico.' };
      }

      // La sesión del empleado nuevo quedó solo en memoria del cliente de altas: se descarta
      await altas.auth.signOut({ scope: 'local' }).catch(() => undefined);

      // 3. Crear la fila en empleados con la sesión del admin (queda en el log)
      const { error: errorInsert } = await this.supabase.client.from('empleados').insert({
        id: usuario.id,
        nombre: datos.nombre,
        apellido: datos.apellido,
        dni,
        email,
        puesto: datos.puesto,
        activo: true,
      });

      if (errorInsert) {
        return {
          ok: false,
          mensaje: errorInsert.code === '23505'
            ? 'Ya existe un empleado con ese correo o DNI.'
            : 'Se creó el usuario, pero no pudimos registrarlo como empleado. Avisá al administrador del sistema.',
        };
      }

      return { ok: true };
    } catch {
      return { ok: false, mensaje: 'No pudimos conectarnos con el servidor. Verificá tu conexión.' };
    }
  }

  async cambiarActivo(id: string, activo: boolean): Promise<void> {
    const { error } = await this.supabase.client
      .from('empleados')
      .update({ activo })
      .eq('id', id);

    if (error) {
      throw error;
    }
  }

  private async existe(columna: 'email' | 'dni', valor: string): Promise<boolean> {
    const { count, error } = await this.supabase.client
      .from('empleados')
      .select('id', { count: 'exact', head: true })
      .eq(columna, valor);

    if (error) {
      throw error;
    }

    return (count ?? 0) > 0;
  }

  private traducirErrorAuth(error: AuthError): string {
    switch (error.code) {
      case 'user_already_exists':
      case 'email_exists':
        return 'Ya existe un usuario con ese correo (puede estar registrado como cliente).';
      case 'weak_password':
        return 'La contraseña es demasiado débil.';
      case 'email_address_invalid':
        return 'El correo electrónico no es válido.';
      case 'over_email_send_rate_limit':
      case 'over_request_rate_limit':
        return 'Demasiados intentos. Esperá unos minutos.';
      default:
        return 'No pudimos crear el usuario. Intentá de nuevo.';
    }
  }
}