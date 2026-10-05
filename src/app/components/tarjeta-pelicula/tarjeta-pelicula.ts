import { Component, computed, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { PeliculaListado, lanzamientoDe } from '../../core/models/pelicula.model';
import { ClasificacionPipe } from '../../pipes/clasificacion.pipe';
import { DuracionPipe } from '../../pipes/duracion.pipe';
import { DetallePelicula } from '../detalle-pelicula/detalle-pelicula';

// Tarjeta de película del sitio público (Home y Cartelera).
// Recibe la película por input(); al tocarla abre la ficha completa.
@Component({
  selector: 'app-tarjeta-pelicula',
  imports: [DatePipe, ClasificacionPipe, DuracionPipe, DetallePelicula],
  templateUrl: './tarjeta-pelicula.html',
  styleUrl: './tarjeta-pelicula.css',
})
export class TarjetaPelicula {
  readonly pelicula = input.required<PeliculaListado>();

  protected readonly abierta = signal(false);
  protected readonly lanzamiento = computed(() => lanzamientoDe(this.pelicula()));
  protected readonly generos = computed(() => this.pelicula().generos.map(g => g.nombre).join(' · '));
}