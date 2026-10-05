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
    readonly logueado = computed(() => this.usuario() !== null);
    private resolverInicio!: () => void;
    private readonly inicio = new Promise<void>(resolver => (this.resolverInicio = resolver));

    constructor() {
      this.supabase.client.auth.onAuthStateChange((_evento, sesion) => {
        this.sesionActual.set(sesion);
        this.resolverInicio();
      });
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
        const { error } = await this.supabase.client.auth.signInWithPassword({ email, password });

        if (error) {
          return { ok: false, mensaje: this.traducirError(error) };
        }

        return { ok: true };
      } catch {
        return { ok: false, mensaje: 'No pudimos conectarnos con el servidor. Verificá tu conexión.' };
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