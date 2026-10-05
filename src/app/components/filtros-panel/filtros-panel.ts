import { Component, ElementRef, afterNextRender, inject, output, signal, viewChild } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { GenerosService } from '../../core/services/generos.service';
import { Genero } from '../../core/models/genero.model';
import { EdadMinima, FiltrosPeliculas, Lanzamiento } from '../../core/models/pelicula.model';

@Component({
  selector: 'app-filtros-panel',
  imports: [ReactiveFormsModule],
  templateUrl: './filtros-panel.html',
  styleUrl: './filtros-panel.css',
})
export class FiltrosPanel {
  readonly cerrar = output<void>();

  private readonly dialogo = viewChild.required<ElementRef<HTMLDialogElement>>('dialogo');
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly generosService = inject(GenerosService);

  protected readonly generos = signal<Genero[]>([]);
  protected readonly cargandoGeneros = signal(true);
  protected readonly errorGeneros = signal(false);
  readonly buscar = output<FiltrosPeliculas>();

  protected readonly opcionesEdad: { valor: EdadMinima | null; etiqueta: string }[] = [
    { valor: null, etiqueta: 'Todas' },
    { valor: 0, etiqueta: 'ATP' },
    { valor: 13, etiqueta: '+13' },
    { valor: 17, etiqueta: '+17' },
  ];

  protected readonly opcionesLanzamiento: { valor: Lanzamiento | null; etiqueta: string }[] = [
    { valor: null, etiqueta: 'Todos' },
    { valor: 'proximamente', etiqueta: 'Próximamente' },
    { valor: 'estreno', etiqueta: 'Estreno' },
    { valor: 'clasico', etiqueta: 'Clásico' },
  ];

  protected readonly formulario = this.fb.group({
    generos: this.fb.control<number[]>([]),
    edad: this.fb.control<EdadMinima | null>(null),
    lanzamiento: this.fb.control<Lanzamiento | null>(null),
  });

  constructor() {
    afterNextRender(() => this.dialogo().nativeElement.showModal());
    this.cargarGeneros();
  }

  private async cargarGeneros(): Promise<void> {
    try {
      this.generos.set(await this.generosService.listar());
    } catch {
      this.errorGeneros.set(true);
    } finally {
      this.cargandoGeneros.set(false);
    }
  }

  protected generoSeleccionado(id: number): boolean {
    return this.formulario.controls.generos.value.includes(id);
  }

  protected alternarGenero(id: number): void {
    const control = this.formulario.controls.generos;
    const actuales = control.value;

    control.setValue(
      actuales.includes(id) ? actuales.filter(g => g !== id) : [...actuales, id],
    );
  }

  protected borrarFiltros(): void {
    this.formulario.reset();
  }

    protected aplicarFiltros(): void {
    this.buscar.emit(this.formulario.getRawValue());
    this.dialogo().nativeElement.close();
  }

  protected cerrarSiClicFuera(evento: MouseEvent): void {
    if (evento.target === evento.currentTarget) {
      this.dialogo().nativeElement.close();
    }
  }
}
