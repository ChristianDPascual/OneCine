import { Component, ElementRef, OnInit, afterNextRender, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PeliculaListado, lanzamientoDe } from '../../core/models/pelicula.model';
import { Puntuacion, Resena } from '../../core/models/resena.model';
import { ResenasService } from '../../core/services/resenas.service';
import { ComprasService } from '../../core/services/compras.service';
import { AuthService } from '../../core/services/auth.service';
import { FuncionDePelicula } from '../../core/models/compra.model';
import { diaOperativo } from '../../core/models/funcion.model';
import { Estrellas } from '../estrellas/estrellas';
import { ClasificacionPipe } from '../../pipes/clasificacion.pipe';
import { DuracionPipe } from '../../pipes/duracion.pipe';

// Ficha de la película en un <dialog> modal (se abre al tocar una tarjeta).
// Recibe la película por input() y avisa por output() cuando se cierra.
@Component({
  selector: 'app-detalle-pelicula',
  imports: [RouterLink, DatePipe, DecimalPipe, ClasificacionPipe, DuracionPipe, Estrellas],
  templateUrl: './detalle-pelicula.html',
  styleUrl: './detalle-pelicula.css',
})
export class DetallePelicula implements OnInit {
  readonly pelicula = input.required<PeliculaListado>();
  readonly cerrar = output<void>();

  private readonly resenasService = inject(ResenasService);
  private readonly comprasService = inject(ComprasService);
  protected readonly auth = inject(AuthService);
  private readonly dialogo = viewChild.required<ElementRef<HTMLDialogElement>>('dialogo');

  // ---------- Puntuación y reseñas (se cargan al abrir la ficha) ----------
  protected readonly cargandoResenas = signal(true);
  protected readonly errorResenas = signal(false);
  protected readonly puntuacion = signal<Puntuacion | null>(null);
  protected readonly resenas = signal<Resena[]>([]);

  // ---------- Funciones a la venta ----------
  protected readonly cargandoFunciones = signal(true);
  private readonly funciones = signal<FuncionDePelicula[]>([]);

  // Agrupadas por día (la función de las 00:00 pertenece a la noche anterior)
  protected readonly funcionesPorDia = computed(() => {
    const grupos = new Map<string, FuncionDePelicula[]>();
    this.funciones().forEach(f => {
      const dia = diaOperativo(new Date(f.inicio));
      grupos.set(dia, [...(grupos.get(dia) ?? []), f]);
    });
    return [...grupos.entries()].map(([dia, funciones]) => ({
      dia,
      fecha: new Date(`${dia}T12:00:00`),
      funciones,
    }));
  });

  protected readonly lanzamiento = computed(() => lanzamientoDe(this.pelicula()));

  constructor() {
    // showModal(): top layer, fondo oscuro, foco atrapado y cierre con Escape
    afterNextRender(() => this.dialogo().nativeElement.showModal());
  }

  ngOnInit(): void {
    this.cargarResenas();
    this.cargarFunciones();
  }

  private async cargarFunciones(): Promise<void> {
    try {
      this.funciones.set(await this.comprasService.funcionesDePelicula(this.pelicula().id));
    } catch (error) {
      console.error('Error al cargar las funciones', error);
    } finally {
      this.cargandoFunciones.set(false);
    }
  }

  private async cargarResenas(): Promise<void> {
    try {
      const { puntuacion, resenas } = await this.resenasService.dePelicula(this.pelicula().id);
      this.puntuacion.set(puntuacion);
      this.resenas.set(resenas);
    } catch (error) {
      console.error('Error al cargar las reseñas', error);
      this.errorResenas.set(true);
    } finally {
      this.cargandoResenas.set(false);
    }
  }

  protected cerrarDialogo(): void {
    this.dialogo().nativeElement.close();
  }

  // Clic en el fondo oscuro (fuera del contenido) → cerrar
  protected alHacerClic(evento: MouseEvent): void {
    if (evento.target === this.dialogo().nativeElement) {
      this.cerrarDialogo();
    }
  }
}