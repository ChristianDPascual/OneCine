import { Component, ElementRef, afterNextRender, inject, output, signal, viewChild } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { Alerta } from '../alerta/alerta';

@Component({
  selector: 'app-login-panel',
  imports: [ReactiveFormsModule, RouterLink, Alerta],
  templateUrl: './login-panel.html',
  styleUrl: './login-panel.css',
})
export class LoginPanel {
  readonly cerrar = output<void>();

  private readonly dialogo = viewChild.required<ElementRef<HTMLDialogElement>>('dialogo');
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);

  protected readonly formulario = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  protected readonly verPassword = signal(false);
  protected readonly enviando = signal(false);
  protected readonly mensajeError = signal<string | null>(null);

  protected get email() {
    return this.formulario.controls.email;
  }

  protected get password() {
    return this.formulario.controls.password;
  }

  constructor() {
    afterNextRender(() => this.dialogo().nativeElement.showModal());
  }

  cerrarSiClicFuera(evento: MouseEvent): void {
    if (evento.target === evento.currentTarget) {
      this.dialogo().nativeElement.close();
    }
  }

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

    try {
      const resultado = await this.auth.iniciarSesion(
        this.email.value.trim(),
        this.password.value,
      );

      if (resultado.ok) {
        this.dialogo().nativeElement.close();
      } else {
        this.mensajeError.set(resultado.mensaje);
      }
    } finally {
      this.enviando.set(false);
    }
  }
}