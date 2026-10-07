import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PeliculasService } from '../../core/services/peliculas.service';
import { ComprasService } from '../../core/services/compras.service';
import { Lanzamiento, PeliculaListado, fechaDeHoy, lanzamientoDe } from '../../core/models/pelicula.model';
import { TarjetaPelicula } from '../../components/tarjeta-pelicula/tarjeta-pelicula';
import { Alerta } from '../../components/alerta/alerta';
import { ClasificacionPipe } from '../../pipes/clasificacion.pipe';
import { DuracionPipe } from '../../pipes/duracion.pipe';

interface Fila {
  lanzamiento: Lanzamiento;
  etiqueta: string;
  titulo: string;
  peliculas: PeliculaListado[];
}

const MAXIMO_POR_FILA = 12;

// Carrusel del hero: las más vendidas
const CANTIDAD_TOP = 3;
const SEGUNDOS_POR_SLIDE = 7;

interface SlideTop {
  pelicula: PeliculaListado;
  puesto: number;          // 1, 2, 3
  vendidas: number | null; // null = completada con un estreno (todavía sin ventas)
}

@Component({
  selector: 'app-home',
  imports: [RouterLink, TarjetaPelicula, Alerta, ClasificacionPipe, DuracionPipe],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  private readonly peliculasService = inject(PeliculasService);
  private readonly compras = inject(ComprasService);
  private readonly destroyRef = inject(DestroyRef);

  // Ranking de ventas: [{ pelicula_id, vendidas }] (lo calcula la base)
  private readonly ranking = signal<{ pelicula_id: number; vendidas: number }[]>([]);

  // ---------- Carrusel ----------
  protected readonly indice = signal(0);
  private readonly pausado = signal(false);

  protected readonly peliculas = signal<PeliculaListado[]>([]);
  protected readonly cargando = signal(true);
  protected readonly mensajeError = signal<string | null>(null);

  // Tarjetas "fantasma" mientras carga
  protected readonly esqueletos = Array.from({ length: 6 }, (_, i) => i);

  // Una sola consulta: se agrupa en el navegador por tipo de lanzamiento
  private readonly porLanzamiento = computed(() => {
    const hoy = fechaDeHoy();
    const grupos: Record<Lanzamiento, PeliculaListado[]> = { estreno: [], proximamente: [], clasico: [] };
    this.peliculas().forEach(p => grupos[lanzamientoDe(p, hoy)].push(p));
    // Próximamente: la que se estrena antes, primero
    grupos.proximamente.sort((a, b) => a.fecha_estreno.localeCompare(b.fecha_estreno));
    return grupos;
  });

  // Top 3 del carrusel: las más vendidas que siguen visibles en el sitio.
  // Si hay menos de 3 con ventas, se completa con estrenos (para que el carrusel no quede vacío).
  protected readonly top = computed<SlideTop[]>(() => {
    const conPoster = this.peliculas().filter(p => p.imagen_url);
    const porId = new Map(conPoster.map(p => [p.id, p]));

    const vendidas: SlideTop[] = this.ranking()
      .map(r => ({ pelicula: porId.get(r.pelicula_id), vendidas: r.vendidas }))
      .filter((s): s is { pelicula: PeliculaListado; vendidas: number } => !!s.pelicula)
      .slice(0, CANTIDAD_TOP)
      .map((s, i) => ({ ...s, puesto: i + 1 }));

    const usadas = new Set(vendidas.map(s => s.pelicula.id));
    const relleno = [...this.porLanzamiento().estreno, ...conPoster]
      .filter(p => p.imagen_url && !usadas.has(p.id) && !!usadas.add(p.id))
      .slice(0, CANTIDAD_TOP - vendidas.length)
      .map((pelicula, i) => ({ pelicula, vendidas: null, puesto: vendidas.length + i + 1 }));

    return [...vendidas, ...relleno];
  });

  protected readonly actual = computed(() => this.top()[this.indice() % Math.max(this.top().length, 1)] ?? null);

  protected readonly filas = computed<Fila[]>(() => {
    const grupos = this.porLanzamiento();
    return (
      [
        { lanzamiento: 'estreno', etiqueta: 'En cartelera', titulo: 'Estrenos', peliculas: grupos.estreno },
        { lanzamiento: 'proximamente', etiqueta: 'Muy pronto', titulo: 'Próximamente', peliculas: grupos.proximamente },
        { lanzamiento: 'clasico', etiqueta: 'Para volver a ver', titulo: 'Clásicos', peliculas: grupos.clasico },
      ] satisfies Fila[]
    )
      .filter(fila => fila.peliculas.length > 0)
      .map(fila => ({ ...fila, peliculas: fila.peliculas.slice(0, MAXIMO_POR_FILA) }));
  });

  protected readonly cantidadPorFila = computed(() => {
    const grupos = this.porLanzamiento();
    return { estreno: grupos.estreno.length, proximamente: grupos.proximamente.length, clasico: grupos.clasico.length };
  });

  constructor() {
    this.cargar();

    // Avance automático (se pausa con el mouse encima o el foco adentro, y si el usuario
    // pidió menos movimiento en su sistema)
    const sinMovimiento = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const reloj = setInterval(() => {
      if (!this.pausado() && !sinMovimiento && this.top().length > 1) {
        this.siguiente();
      }
    }, SEGUNDOS_POR_SLIDE * 1000);
    this.destroyRef.onDestroy(() => clearInterval(reloj));
  }

  protected siguiente(): void {
    const total = this.top().length;
    if (total > 0) {
      this.indice.update(i => (i + 1) % total);
    }
  }

  protected anterior(): void {
    const total = this.top().length;
    if (total > 0) {
      this.indice.update(i => (i - 1 + total) % total);
    }
  }

  protected irA(i: number): void {
    this.indice.set(i);
  }

  protected pausar(valor: boolean): void {
    this.pausado.set(valor);
  }

  // Flechas del teclado cuando el carrusel tiene el foco
  protected teclado(evento: KeyboardEvent): void {
    if (evento.key === 'ArrowRight') {
      this.siguiente();
      evento.preventDefault();
    } else if (evento.key === 'ArrowLeft') {
      this.anterior();
      evento.preventDefault();
    }
  }

  private async cargar(): Promise<void> {
    try {
      const [peliculas, ranking] = await Promise.all([
        this.peliculasService.buscar({ texto: null, generos: [], edad: null, lanzamiento: null }),
        // Si el ranking falla, el carrusel se arma con estrenos
        this.compras.masVendidas(CANTIDAD_TOP * 3).catch(() => []),
      ]);
      this.peliculas.set(peliculas);
      this.ranking.set(ranking);
    } catch (error) {
      console.error('Error al cargar la cartelera', error);
      this.mensajeError.set('No pudimos cargar las películas. Revisá tu conexión e intentá de nuevo.');
    } finally {
      this.cargando.set(false);
    }
  }

  protected generos(pelicula: PeliculaListado): string {
    return pelicula.generos.map(g => g.nombre).join(' · ');
  }
}