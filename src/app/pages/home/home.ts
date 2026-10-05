import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PeliculasService } from '../../core/services/peliculas.service';
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

@Component({
  selector: 'app-home',
  imports: [RouterLink, TarjetaPelicula, Alerta, ClasificacionPipe, DuracionPipe],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  private readonly peliculasService = inject(PeliculasService);

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

  // Película destacada del hero: el estreno más reciente con póster
  protected readonly destacada = computed(
    () => this.porLanzamiento().estreno.find(p => p.imagen_url) ?? this.peliculas().find(p => p.imagen_url) ?? null,
  );

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
  }

  private async cargar(): Promise<void> {
    try {
      this.peliculas.set(
        await this.peliculasService.buscar({ texto: null, generos: [], edad: null, lanzamiento: null }),
      );
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