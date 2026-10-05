  import { Component, computed, inject, signal } from '@angular/core';
  import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
  import { Router, RouterLink } from '@angular/router';
  import { EmpleadosService } from '../../../core/services/empleados.service';
  import { LoadingService } from '../../../core/services/loading.service';
  import { ConCambiosSinGuardar } from '../../../core/guards/cambios-sin-guardar.guard';
  import { PUESTOS_QUE_PUEDE_CREAR, Puesto } from '../../../core/models/empleado.model';
  import { Alerta } from '../../../components/alerta/alerta';
  import { PuestoPipe } from '../../../pipes/puesto.pipe';
  import { nombrePersonaValidator } from '../../../validators/nombre-persona.validator';
  import { passwordValidator } from '../../../validators/password.validator';

  @Component({
    selector: 'app-empleado-nuevo',
    imports: [ReactiveFormsModule, RouterLink, Alerta, PuestoPipe],
    templateUrl: './empleado-nuevo.html',
    styleUrl: './empleado-nuevo.css',
  })
  export class EmpleadoNuevo implements ConCambiosSinGuardar {
    private readonly fb = inject(NonNullableFormBuilder);
    private readonly empleados = inject(EmpleadosService);
    private readonly loading = inject(LoadingService);
    private readonly router = inject(Router);

    // Puestos que el empleado logueado puede asignar (admin: todos; supervisor: confitería y boletería)
    protected readonly puestos = computed(() => {
      const actual = this.empleados.actual();
      return actual ? PUESTOS_QUE_PUEDE_CREAR[actual.puesto] : [];
    });

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

    private guardado = false;

    // Lo consulta el guard cambiosSinGuardarGuard antes de salir
    hayCambiosSinGuardar(): boolean {
      if (this.guardado) {
        return false;
      }
      return Object.values(this.formulario.getRawValue()).some(valor => String(valor).trim() !== '');
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

      const nombreCompleto = `${valores.nombre.trim()} ${valores.apellido.trim()}`;

      this.mensajeError.set(null);
      this.enviando.set(true);
      this.loading.mostrar();

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

        this.guardado = true;

        // Volvemos al listado y le pasamos el mensaje de éxito en el estado de la navegación
        await this.router.navigate(['/admin/empleados'], {
          state: { exito: `Se creó el empleado ${nombreCompleto}. Ya puede ingresar al panel.` },
        });
      } finally {
        this.loading.ocultar();
        this.enviando.set(false);
      }
    }
  }