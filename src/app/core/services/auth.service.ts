import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthError, Session } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';
import { RegistroCliente } from '../models/cliente.model';

export type ResultadoRegistro =
  | { ok: true; requiereConfirmacion: boolean }
  | { ok: false; mensaje: string };

export type ResultadoLogin = { ok: true } | { ok: false; mensaje: string };

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase = inject(SupabaseService);
  private readonly sesionActual = signal<Session | null>(null);

  readonly sesion = this.sesionActual.asReadonly();
  readonly usuario = computed(() => this.sesionActual()?.user ?? null);

  // Invitado: sesión ANÓNIMA de Supabase (compra sin registrarse).
  // Tiene id para reservar butacas, pero no es cliente: sin descuentos, puntos ni "Mis compras".
  readonly esInvitado = computed(() => this.usuario()?.is_anonymous === true);

  // id del usuario que se confirmó que está en la tabla "clientes"
  private readonly idCliente = signal<string | null>(null);

  // Cliente REGISTRADO logueado: perfil, Mis compras, puntos, descuentos…
  // No cuenta al invitado ni a un empleado: Supabase tiene una sola sesión por navegador,
  // y si un empleado vuelve a la parte de clientes no tiene que figurar como logueado.
  readonly logueado = computed(() => {
    const usuario = this.usuario();
    return usuario !== null && !usuario.is_anonymous && this.idCliente() === usuario.id;
  });

  // Sesión con cuenta que no es de cliente (un empleado)
  readonly sesionDeEmpleado = computed(() => this.usuario() !== null && !this.esInvitado() && !this.logueado());

  // Cualquier sesión, incluida la de invitado (alcanza para comprar)
  readonly conSesion = computed(() => this.usuario() !== null);
  private resolverInicio!: () => void;
  private readonly inicio = new Promise<void>(resolver => (this.resolverInicio = resolver));

  constructor() {
    this.supabase.client.auth.onAuthStateChange((_evento, sesion) => {
      this.sesionActual.set(sesion);
      // Supabase recomienda no consultar la base dentro de este callback: se difiere
      setTimeout(() => {
        this.verificarCliente(sesion?.user.id ?? null, sesion?.user.is_anonymous === true)
          .finally(() => this.resolverInicio());
      });
    });
  }

  // ¿El usuario de la sesión está en "clientes"? (los empleados y los invitados no)
  private async verificarCliente(id: string | null, anonimo: boolean): Promise<void> {
    if (!id || anonimo) {
      this.idCliente.set(null);
      return;
    }
    if (this.idCliente() === id) {
      return;
    }
    try {
      const { data } = await this.supabase.client.from('clientes').select('id').eq('id', id).maybeSingle();
      this.idCliente.set(data ? id : null);
    } catch {
      this.idCliente.set(null);
    }
  }

  // Permite esperar a que se haya leído la sesión guardada
  esperarInicio(): Promise<void> {
    return this.inicio;
  }

  async registrar(datos: RegistroCliente): Promise<ResultadoRegistro> {
    try {
      const { data, error } = await this.supabase.client.auth.signUp({
        email: datos.email,
        password: datos.password,
        options: {
          // Claves exactas que lee crear_cliente() desde raw_user_meta_data
          data: {
            tipo: 'cliente',
            nombre: datos.nombre,
            apellido: datos.apellido,
            fecha_nacimiento: datos.fechaNacimiento,
            tipo_sangre: datos.tipoSangre,
            color_ojos: datos.colorOjos,
            dias_vacaciones: datos.diasVacaciones,
          },
        },
      });

      if (error) {
        return { ok: false, mensaje: this.traducirError(error) };
      }

      // Con "Confirm email" activado, un email existente no da error:
      // Supabase devuelve un usuario sin identidades
      if (data.user && data.user.identities?.length === 0) {
        return { ok: false, mensaje: 'Ya existe una cuenta con ese correo electrónico.' };
      }

      return { ok: true, requiereConfirmacion: data.session === null };
    } catch {
      return { ok: false, mensaje: 'No pudimos conectarnos con el servidor. Verificá tu conexión.' };
    }
  }

  async iniciarSesion(email: string, password: string): Promise<ResultadoLogin> {
    try {
      const { data, error } = await this.supabase.client.auth.signInWithPassword({ email, password });

      if (error) {
        return { ok: false, mensaje: this.traducirError(error) };
      }

      // Al volver del login, "logueado" ya refleja si es cliente
      await this.verificarCliente(data.user?.id ?? null, false);
      return { ok: true };
    } catch {
      return { ok: false, mensaje: 'No pudimos conectarnos con el servidor. Verificá tu conexión.' };
    }
  }

  // Compra sin registrarse: crea una sesión anónima (requiere "Allow anonymous sign-ins")
  async entrarComoInvitado(): Promise<boolean> {
    try {
      const { error } = await this.supabase.client.auth.signInAnonymously();
      if (error) {
        console.error('No se pudo iniciar la sesión de invitado', error);
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  async cerrarSesion(): Promise<void> {
    await this.supabase.client.auth.signOut();
  }

  private traducirError(error: AuthError): string {
    if (error.name === 'AuthRetryableFetchError') {
      return 'No pudimos conectarnos con el servidor. Verificá tu conexión.';
    }

    switch (error.code) {
      case 'user_already_exists':
      case 'email_exists':
        return 'Ya existe una cuenta con ese correo electrónico.';
      case 'weak_password':
        return 'La contraseña es demasiado débil. Probá con una más larga.';
      case 'email_address_invalid':
        return 'El correo electrónico no es válido.';
      case 'over_email_send_rate_limit':
      case 'over_request_rate_limit':
        return 'Hiciste demasiados intentos. Esperá unos minutos y volvé a probar.';
      case 'signup_disabled':
        return 'El registro de cuentas está deshabilitado en este momento.';
      case 'unexpected_failure':
        return 'No pudimos crear tu cuenta. Revisá los datos e intentá de nuevo.';
      default:
        return 'Ocurrió un error inesperado. Intentá de nuevo más tarde.';
      case 'invalid_credentials':
        return 'El correo o la contraseña no son correctos.';
      case 'email_not_confirmed':
        return 'Tu cuenta todavía no fue confirmada. Revisá tu correo.';
    }
  }
}