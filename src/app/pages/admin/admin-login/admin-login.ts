import { Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { EmpleadosService } from '../../../core/services/empleados.service';
import { LoadingService } from '../../../core/services/loading.service';
import { Alerta } from '../../../components/alerta/alerta';

@Component({
  selector: 'app-admin-login',
  imports: [ReactiveFormsModule, RouterLink, Alerta],
  templateUrl: './admin-login.html',
  styleUrl: './admin-login.css',
})
export class AdminLogin {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);
  private readonly empleados = inject(EmpleadosService);
  private readonly loading = inject(LoadingService);
  private readonly router = inject(Router);

  protected readonly formulario = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  protected readonly campos = this.formulario.controls;
  protected readonly verPassword = signal(false);
  protected readonly enviando = signal(false);
  protected readonly mensajeError = signal<string | null>(null);

  // Si hay un cliente logueado se le avisa que su sesión se va a reemplazar
  protected readonly emailCliente = computed(() => (this.auth.logueado() ? this.auth.usuario()?.email ?? null : null));

  protected async ingresar(): Promise<void> {
    if (this.enviando()) {
      return;
    }

    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.mensajeError.set(null);
    this.enviando.set(true);
    this.loading.mostrar();

    try {
      const resultado = await this.auth.iniciarSesion(
        this.campos.email.value.trim(),
        this.campos.password.value,
      );

      if (!resultado.ok) {
        this.mensajeError.set(resultado.mensaje);
        return;
      }

      // Autenticado: ahora se verifica que sea un empleado activo (autorización)
      const empleado = await this.empleados.obtenerActual();

      if (!empleado || !empleado.activo) {
        await this.auth.cerrarSesion();
        this.mensajeError.set(
          empleado
            ? 'Tu usuario está inactivo. Consultá con un administrador.'
            : 'Esta cuenta no tiene acceso al panel de empleados.',
        );
        return;
      }

      await this.router.navigate(['/admin/inicio']);
    } catch {
      this.mensajeError.set('No pudimos verificar tu acceso. Intentá de nuevo.');
    } finally {
      this.loading.ocultar();
      this.enviando.set(false);
    }
  }
}