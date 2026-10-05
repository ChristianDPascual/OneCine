import { Component, ElementRef, afterNextRender, inject, input, output, signal, viewChild } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { EmpleadosService } from '../../core/services/empleados.service';
import { Puesto } from '../../core/models/empleado.model';
import { Alerta } from '../alerta/alerta';
import { PuestoPipe } from '../../pipes/puesto.pipe';
import { nombrePersonaValidator } from '../../validators/nombre-persona.validator';
import { passwordValidator } from '../../validators/password.validator';

@Component({
  selector: 'app-empleado-form',
  imports: [ReactiveFormsModule, Alerta, PuestoPipe],
  templateUrl: './empleado-form.html',
  styleUrl: './empleado-form.css',
})
export class EmpleadoForm {
  // Puestos que el empleado logueado puede asignar
  readonly puestos = input.required<Puesto[]>();

  readonly cerrar = output<void>();
  readonly creado = output<string>();

  private readonly dialogo = viewChild.required<ElementRef<HTMLDialogElement>>('dialogo');
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly empleados = inject(EmpleadosService);

  protected readonly formulario = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50), nombrePersonaValidator()]],
    apellido: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50), nombrePersonaValidator()]],
    dni: ['', [Validators.required, Validators.pattern(/^\d{7,8}$/)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6), passwordValidator()]],
    puesto: this.fb.control<Puesto | ''>('', Validators.required),
  });

  protected readonly campos = this.formulario.controls;
  protected readonly verPassword = signal(false);
  protected readonly enviando = signal(false);
  protected readonly mensajeError = signal<string | null>(null);

  constructor() {
    afterNextRender(() => this.dialogo().nativeElement.showModal());
  }

  protected cerrarPanel(): void {
    this.dialogo().nativeElement.close();
  }

  protected cerrarSiClicFuera(evento: MouseEvent): void {
    if (evento.target === evento.currentTarget && !this.enviando()) {
      this.cerrarPanel();
    }
  }

  protected async guardar(): Promise<void> {
    if (this.enviando()) {
      return;
    }

    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    const valores = this.formulario.getRawValue();
    if (valores.puesto === '') {
      return;
    }

    this.mensajeError.set(null);
    this.enviando.set(true);

    try {
      const resultado = await this.empleados.crear({
        nombre: valores.nombre.trim(),
        apellido: valores.apellido.trim(),
        dni: valores.dni,
        email: valores.email,
        password: valores.password,
        puesto: valores.puesto,
      });

      if (!resultado.ok) {
        this.mensajeError.set(resultado.mensaje);
        return;
      }

      this.creado.emit(`${valores.nombre.trim()} ${valores.apellido.trim()}`);
      this.cerrarPanel();
    } finally {
      this.enviando.set(false);
    }
  }
}