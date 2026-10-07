import { Component, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ComprasService } from '../../core/services/compras.service';
import { ResenasService } from '../../core/services/resenas.service';
import { LoadingService } from '../../core/services/loading.service';
import { MiPelicula } from '../../core/models/mi-pelicula.model';
import { MiResena, mensajeErrorResena } from '../../core/models/resena.model';
import { Estrellas } from '../../components/estrellas/estrellas';
import { DatosResena, FormResena } from '../../components/form-resena/form-resena';
import { ClasificacionPipe } from '../../pipes/clasificacion.pipe';
import { DuracionPipe } from '../../pipes/duracion.pipe';

type Orden = 'recientes' | 'mejor' | 'titulo';

// Mis películas (solo clientes registrados): historial visual de lo que vio,
// con pósters, fechas de cada función y su propia calificación.
@Component({
  selector: 'app-mis-peliculas',
  imports: [DatePipe, DecimalPipe, RouterLink, Estrellas, FormResena, ClasificacionPipe, DuracionPipe],
  templateUrl: './mis-peliculas.html',
  styleUrl: './mis-peliculas.css',
})
export class MisPeliculas implements OnInit {
  private readonly compras = inject(ComprasService);
  private readonly resenas = inject(ResenasService);
  private readonly loading = inject(LoadingService);
  private readonly dialogo = viewChild<ElementRef<HTMLDialogElement>>('dialogo');

  protected readonly peliculas = signal<MiPelicula[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal(false);
  protected readonly orden = signal<Orden>('recientes');

  // ---------- Resumen ----------
  protected readonly totalFunciones = computed(() => this.peliculas().reduce((t, p) => t + p.funciones.length, 0));
  protected readonly calificadas = computed(() => this.peliculas().filter(p => p.mis_estrellas !== null));
  protected readonly promedio = computed(() => {
    const c = this.calificadas();
    return c.length > 0 ? c.reduce((t, p) => t + (p.mis_estrellas ?? 0), 0) / c.length : null;
  });

  protected readonly ordenadas = computed(() => {
    const lista = [...this.peliculas()];
    switch (this.orden()) {
      case 'mejor':
        return lista.sort((a, b) => (b.mis_estrellas ?? 0) - (a.mis_estrellas ?? 0) || b.ultima.localeCompare(a.ultima));
      case 'titulo':
        return lista.sort((a, b) => a.titulo.localeCompare(b.titulo));
      default:
        return lista.sort((a, b) => b.ultima.localeCompare(a.ultima));
    }
  });

  // ---------- Calificar (en un <dialog>) ----------
  protected readonly calificando = signal<MiPelicula | null>(null);
  protected readonly guardando = signal(false);
  protected readonly mensajeResena = signal<string | null>(null);
  protected readonly inicial = computed<MiResena | null>(() => {
    const p = this.calificando();
    return p && p.mis_estrellas !== null
      ? { estrellas: p.mis_estrellas, comentario: p.mi_comentario, created_at: '' }
      : null;
  });

  ngOnInit(): void {
    this.cargar();
  }

  protected async cargar(): Promise<void> {
    this.error.set(false);
    this.loading.mostrar();
    try {
      this.peliculas.set(await this.compras.misPeliculas());
    } catch (error) {
      console.error('Error al cargar mis películas', error);
      this.error.set(true);
    } finally {
      this.cargando.set(false);
      this.loading.ocultar();
    }
  }

  protected abrirCalificar(pelicula: MiPelicula): void {
    this.mensajeResena.set(null);
    this.calificando.set(pelicula);
    this.dialogo()?.nativeElement.showModal();
  }

  protected cerrarCalificar(): void {
    this.dialogo()?.nativeElement.close();
  }

  protected alCerrarDialogo(): void {
    this.calificando.set(null);
  }

  protected async guardar(datos: DatosResena): Promise<void> {
    const pelicula = this.calificando();
    if (!pelicula) {
      return;
    }
    await this.ejecutar(async () => {
      await this.resenas.guardar(pelicula.pelicula_id, datos.estrellas, datos.comentario);
      this.actualizar(pelicula.pelicula_id, datos.estrellas, datos.comentario);
    });
  }

  protected async eliminar(): Promise<void> {
    const pelicula = this.calificando();
    if (!pelicula) {
      return;
    }
    await this.ejecutar(async () => {
      await this.resenas.eliminar(pelicula.pelicula_id);
      this.actualizar(pelicula.pelicula_id, null, null);
    });
  }

  private async ejecutar(accion: () => Promise<void>): Promise<void> {
    this.guardando.set(true);
    this.mensajeResena.set(null);
    try {
      await accion();
      this.cerrarCalificar();
    } catch (error) {
      console.error('Error al guardar la reseña', error);
      this.mensajeResena.set(mensajeErrorResena(error));
    } finally {
      this.guardando.set(false);
    }
  }

  // Refleja el cambio en la tarjeta sin volver a consultar todo
  private actualizar(peliculaId: number, estrellas: number | null, comentario: string | null): void {
    this.peliculas.update(lista =>
      lista.map(p => (p.pelicula_id === peliculaId ? { ...p, mis_estrellas: estrellas, mi_comentario: comentario } : p)),
    );
  }
}