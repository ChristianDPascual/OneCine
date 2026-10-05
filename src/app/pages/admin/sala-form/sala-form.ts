import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { SalasService } from '../../../core/services/salas.service';
import { LoadingService } from '../../../core/services/loading.service';
import { ConCambiosSinGuardar } from '../../../core/guards/cambios-sin-guardar.guard';
import { DESCRIPCION_FORMATO, FORMATOS_SALA, FormatoSala, Sala } from '../../../core/models/sala.model';
import { Alerta } from '../../../components/alerta/alerta';

const NUMERO_MAXIMO = 99;

@Component({
  selector: 'app-sala-form',
  imports: [ReactiveFormsModule, Alerta],
  templateUrl: './sala-form.html',
  styleUrl: './sala-form.css',
})
export class SalaForm implements OnInit, ConCambiosSinGuardar {
  // Parámetro :id de /admin/salas/:id/editar (withComponentInputBinding). En "nueva" queda undefined.
  readonly id = input<string>();

  private readonly fb = inject(NonNullableFormBuilder);
  private readonly salas = inject(SalasService);
  private readonly loading = inject(LoadingService);
  private readonly router = inject(Router);

  protected readonly esEdicion = computed(() => this.id() !== undefined);
  protected readonly formatos = FORMATOS_SALA;
  protected readonly descripcionFormato = DESCRIPCION_FORMATO;
  protected readonly numeroMaximo = NUMERO_MAXIMO;

  protected readonly noEncontrada = signal(false);
  protected readonly enviando = signal(false);
  protected readonly mensajeError = signal<string | null>(null);

  private guardado = false;

  protected readonly formulario = this.fb.group({
    numero: this.fb.control<number | null>(null, [
      Validators.required,
      Validators.min(1),
      Validators.max(NUMERO_MAXIMO),
      Validators.pattern(/^\d+$/),
    ]),
    formato: this.fb.control<FormatoSala>('2D', Validators.required),
  });

  protected readonly campos = this.formulario.controls;

  ngOnInit(): void {
    this.cargar();
  }

  hayCambiosSinGuardar(): boolean {
    return !this.guardado && this.formulario.dirty;
  }

  private async cargar(): Promise<void> {
    const id = this.id();

    if (id === undefined) {
      return;
    }

    const idNumerico = Number(id);
    if (!Number.isInteger(idNumerico)) {
      this.noEncontrada.set(true);
      return;
    }

    this.loading.mostrar();
    try {
      const sala = await this.salas.obtener(idNumerico);
      if (!sala) {
        this.noEncontrada.set(true);
        return;
      }
      this.completarFormulario(sala);
    } catch (error) {
      console.error('Error al cargar la sala', error);
      this.mensajeError.set('No pudimos cargar la sala. Recargá la página.');
    } finally {
      this.loading.ocultar();
    }
  }

  private completarFormulario(sala: Sala): void {
    this.formulario.reset({ numero: sala.numero, formato: sala.formato });
  }

  protected async guardar(): Promise<void> {
    if (this.enviando()) {
      return;
    }

    this.mensajeError.set(null);

    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      document.getElementById('sala-numero')?.focus();
      return;
    }

    const v = this.formulario.getRawValue();
    if (v.numero === null) {
      return;
    }

    this.enviando.set(true);
    this.loading.mostrar();

    try {
      const id = this.id();
      await this.salas.guardar({ numero: v.numero, formato: v.formato }, id !== undefined ? Number(id) : undefined);

      this.guardado = true;
      await this.router.navigate(['/admin/salas'], {
        state: {
          exito: this.esEdicion()
            ? `La sala ${v.numero} se actualizó correctamente.`
            : `La sala ${v.numero} se creó con sus butacas.`,
        },
      });
    } catch (error) {
      console.error('Error al guardar la sala', error);
      this.mensajeError.set(this.traducirError(error, v.numero));
    } finally {
      this.loading.ocultar();
      this.enviando.set(false);
    }
  }

  private traducirError(error: unknown, numero: number): string {
    switch ((error as { code?: string } | null)?.code) {
      case '23505':
        return `Ya existe una sala con el número ${numero}.`;
      case '22P02':
        return 'El formato elegido no es válido para la base.';
      case '23502':
        return 'La base no generó el id de la sala. Revisá que la columna id de salas sea identity.';
      default:
        return 'No pudimos guardar la sala. Revisá tu conexión e intentá de nuevo.';
    }
  }
}