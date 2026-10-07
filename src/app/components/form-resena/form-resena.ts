import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAXIMO_COMENTARIO, MiResena } from '../../core/models/resena.model';

export interface DatosResena {
  estrellas: number;
  comentario: string | null;
}

// Formulario para calificar una película: 1 a 5 estrellas + comentario corto (100 caracteres).
// Si el cliente ya había calificado, arranca con su reseña y permite cambiarla o borrarla.
@Component({
  selector: 'app-form-resena',
  imports: [ReactiveFormsModule],
  templateUrl: './form-resena.html',
  styleUrl: './form-resena.css',
})
export class FormResena {
  private readonly fb = inject(NonNullableFormBuilder);

  readonly inicial = input<MiResena | null>(null);
  readonly guardando = input(false);
  readonly guardar = output<DatosResena>();
  readonly eliminar = output<void>();

  protected readonly maximo = MAXIMO_COMENTARIO;
  protected readonly posiciones = [1, 2, 3, 4, 5];
  protected readonly etiquetas = ['', 'Mala', 'Regular', 'Buena', 'Muy buena', 'Excelente'];

  protected readonly formulario = this.fb.group({
    estrellas: [0, [Validators.required, Validators.min(1), Validators.max(5)]],
    comentario: ['', Validators.maxLength(MAXIMO_COMENTARIO)],
  });

  // Estrella bajo el mouse (vista previa) y valores para el template
  protected readonly hover = signal(0);
  private readonly elegidas = signal(0);
  private readonly texto = signal('');
  protected readonly visibles = computed(() => this.hover() || this.elegidas());
  protected readonly restantes = computed(() => this.maximo - this.texto().length);
  protected readonly editando = computed(() => this.inicial() !== null);
  // "Borrar" pide confirmación en el mismo formulario
  protected readonly confirmandoBorrado = signal(false);

  constructor() {
    // Carga la reseña existente (o limpia si no hay)
    effect(() => {
      const r = this.inicial();
      this.formulario.reset({ estrellas: r?.estrellas ?? 0, comentario: r?.comentario ?? '' });
      this.elegidas.set(r?.estrellas ?? 0);
      this.texto.set(r?.comentario ?? '');
      this.confirmandoBorrado.set(false);
    });
    this.formulario.controls.comentario.valueChanges.subscribe(v => this.texto.set(v));
  }

  protected elegir(estrellas: number): void {
    this.formulario.controls.estrellas.setValue(estrellas);
    this.formulario.controls.estrellas.markAsTouched();
    this.elegidas.set(estrellas);
  }

  // Flechas del teclado sobre el grupo de estrellas
  protected teclado(evento: KeyboardEvent): void {
    const actual = this.elegidas();
    if (evento.key === 'ArrowRight' || evento.key === 'ArrowUp') {
      this.elegir(Math.min(5, actual + 1));
      evento.preventDefault();
    } else if (evento.key === 'ArrowLeft' || evento.key === 'ArrowDown') {
      this.elegir(Math.max(1, actual - 1));
      evento.preventDefault();
    }
  }

  protected enviar(): void {
    if (this.formulario.invalid || this.guardando()) {
      this.formulario.markAllAsTouched();
      return;
    }
    const { estrellas, comentario } = this.formulario.getRawValue();
    this.guardar.emit({ estrellas, comentario: comentario.trim() || null });
  }
}