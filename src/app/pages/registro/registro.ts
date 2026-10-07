import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { COLORES_OJOS, ColorOjos, RegistroCliente, TIPOS_SANGRE, TipoSangre } from '../../core/models/cliente.model';
import { ConCambiosSinGuardar } from '../../core/guards/cambios-sin-guardar.guard';
import { AuthService } from '../../core/services/auth.service';
import { LoadingService } from '../../core/services/loading.service';
import { Alerta } from '../../components/alerta/alerta';
import { nombrePersonaValidator } from '../../validators/nombre-persona.validator';
import { passwordValidator } from '../../validators/password.validator';
import { coincidenValidator } from '../../validators/coinciden.validator';
import { anioNacimiento, fechaNacimientoValidator, fechaSql } from '../../validators/fecha-nacimiento.validator';
import { Router } from '@angular/router';


const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

@Component({
  selector: 'app-registro',
  imports: [ReactiveFormsModule, Alerta],
  templateUrl: './registro.html',
  styleUrl: './registro.css',
})
export class Registro implements ConCambiosSinGuardar {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);
  private readonly loading = inject(LoadingService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly tiposSangre = TIPOS_SANGRE;
  protected readonly coloresOjos = COLORES_OJOS;
  protected readonly meses = MESES;

  protected readonly enviando = signal(false);
  protected readonly mensajeError = signal<string | null>(null);
  protected readonly mensajeExito = signal<string | null>(null);
  protected readonly registroCompletado = signal(false);


  protected readonly formulario = this.fb.group(
    {
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6), passwordValidator()]],
      confirmarPassword: ['', Validators.required],
      nombre: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50), nombrePersonaValidator()]],
      apellido: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50), nombrePersonaValidator()]],
      nacimiento: this.fb.group(
        {
          edad: this.fb.control<number | null>(null, [
            Validators.required,
            Validators.min(3),
            Validators.max(120),
            Validators.pattern(/^\d+$/),
          ]),
          mes: this.fb.control<number | null>({ value: null, disabled: true }, Validators.required),
          dia: this.fb.control<number | null>({ value: null, disabled: true }, [
            Validators.required,
            Validators.min(1),
            Validators.max(31),
            Validators.pattern(/^\d+$/),
          ]),
        },
        { validators: fechaNacimientoValidator() },
      ),
      tipoSangre: this.fb.control<TipoSangre | ''>('', Validators.required),
      colorOjos: this.fb.control<ColorOjos | ''>('', Validators.required),
      diasVacaciones: this.fb.control<number | null>(null, [
        Validators.required,
        Validators.min(0),
        Validators.max(365),
        Validators.pattern(/^\d+$/),
      ]),
    },
    { validators: coincidenValidator('password', 'confirmarPassword') },
  );

  protected readonly campos = this.formulario.controls;
  protected readonly nacimiento = this.campos.nacimiento.controls;

  constructor() {
    const { edad, mes, dia } = this.nacimiento;

    edad.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      if (edad.valid) {
        mes.enable();
      } else {
        mes.disable();
      }
    });

    mes.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      if (mes.enabled && mes.value !== null) {
        dia.enable();
      } else {
        dia.disable();
      }
    });
  }

  protected get fechaTexto(): string | null {
    const grupo = this.campos.nacimiento;
    if (grupo.invalid || this.nacimiento.dia.disabled) {
      return null;
    }

    const { edad, mes, dia } = grupo.getRawValue();
    if (edad === null || mes === null || dia === null) {
      return null;
    }

    return `${dia} de ${MESES[mes - 1].toLowerCase()} de ${anioNacimiento(edad, mes, dia)}`;
  }

  hayCambiosSinGuardar(): boolean {
    if (this.registroCompletado()) {
      return false;
    }

    const { nacimiento, ...resto } = this.formulario.getRawValue();
    const valores = [...Object.values(resto), ...Object.values(nacimiento)];
    return valores.some(valor => valor !== null && String(valor).trim() !== '');
  }

  protected async registrar(): Promise<void> {
    if (this.enviando()) {
      return;
    }

    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    const datos = this.prepararDatos();
    if (!datos) {
      return;
    }

    this.mensajeError.set(null);
    this.mensajeExito.set(null);
    this.enviando.set(true);
    this.loading.mostrar();

    try {
      const resultado = await this.auth.registrar(datos);

      if (!resultado.ok) {
        this.mensajeError.set(resultado.mensaje);
        return;
      }

      this.registroCompletado.set(true);
      this.formulario.disable();

      if (resultado.requiereConfirmacion) {
        this.mensajeExito.set('Te enviamos un correo para confirmar tu cuenta. Revisá tu bandeja de entrada.');
        return;
      }

      this.mensajeExito.set('Tu cuenta ya está lista. En unos segundos te llevamos al inicio…');

      // Mientras se muestra el aviso, el ícono de carga queda visible y bloquea la
      // pantalla (menú incluido) hasta llegar al inicio. Este mostrar() es aparte del
      // de la consulta: el finally de abajo cierra ese, y este se cierra al salir.
      this.loading.mostrar();
      const temporizador = setTimeout(() => this.irAlInicio(), 3000);
      this.destroyRef.onDestroy(() => {
        clearTimeout(temporizador);
        this.loading.ocultar();
      });
    } finally {
      this.loading.ocultar();
      this.enviando.set(false);
    }
  }

  protected irAlInicio(): void {
    this.router.navigate(['/']);
  }

  // Convierte los valores del formulario al formato que espera AuthService
  private prepararDatos(): RegistroCliente | null {
    const valores = this.formulario.getRawValue();
    const { edad, mes, dia } = valores.nacimiento;

    // Con el formulario válido estos casos no ocurren, pero TypeScript necesita la comprobación
    if (
      edad === null || mes === null || dia === null ||
      valores.diasVacaciones === null || valores.tipoSangre === '' || valores.colorOjos === ''
    ) {
      return null;
    }

    return {
      email: valores.email.trim(),
      password: valores.password,
      nombre: valores.nombre.trim(),
      apellido: valores.apellido.trim(),
      fechaNacimiento: fechaSql(anioNacimiento(edad, mes, dia), mes, dia),
      tipoSangre: valores.tipoSangre,
      colorOjos: valores.colorOjos,
      diasVacaciones: valores.diasVacaciones,
    };
  }
}