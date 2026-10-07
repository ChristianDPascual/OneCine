import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PeliculasService } from '../../core/services/peliculas.service';
import { CarritoService } from '../../core/services/carrito.service';
import { PeliculaListado, fechaDeHoy, lanzamientoDe } from '../../core/models/pelicula.model';
import { TarjetaPelicula } from '../../components/tarjeta-pelicula/tarjeta-pelicula';
import { Alerta } from '../../components/alerta/alerta';

// Paso intermedio del pedido armado en el Candy bar:
// muestra la cartelera para elegir película → horario → butacas → pago.
@Component({
  selector: 'app-candy-funcion',
  imports: [CurrencyPipe, RouterLink, TarjetaPelicula, Alerta],
  templateUrl: './candy-funcion.html',
  styleUrl: './candy-funcion.css',
})
export class CandyFuncion {
  private readonly peliculasService = inject(PeliculasService);
  protected readonly carrito = inject(CarritoService);

  private readonly peliculas = signal<PeliculaListado[]>([]);
  protected readonly cargando = signal(true);
  protected readonly mensajeError = signal<string | null>(null);

  // En cartelera primero (estrenos y clásicos), después las de preventa
  protected readonly enCartelera = computed(() => {
    const hoy = fechaDeHoy();
    return this.peliculas().filter(p => lanzamientoDe(p, hoy) !== 'proximamente');
  });
  protected readonly preventa = computed(() => {
    const hoy = fechaDeHoy();
    return this.peliculas().filter(p => lanzamientoDe(p, hoy) === 'proximamente');
  });

  constructor() {
    this.cargar();
  }

  private async cargar(): Promise<void> {
    try {
      this.peliculas.set(await this.peliculasService.buscar({ texto: null, generos: [], edad: null, lanzamiento: null }));
    } catch (error) {
      console.error('Error al cargar la cartelera', error);
      this.mensajeError.set('No pudimos cargar las películas. Revisá tu conexión e intentá de nuevo.');
    } finally {
      this.cargando.set(false);
    }
  }
}