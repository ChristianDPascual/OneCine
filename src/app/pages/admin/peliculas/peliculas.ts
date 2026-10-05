import { Component, WritableSignal, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PeliculasService } from '../../../core/services/peliculas.service';
import { GenerosService } from '../../../core/services/generos.service';
import { LoadingService } from '../../../core/services/loading.service';
import { ConfirmacionService } from '../../../core/services/confirmacion.service';
import {
  EDADES_MINIMAS,
  EdadMinima,
  Lanzamiento,
  PeliculaAdmin,
  fechaDeHoy,
  lanzamientoDe,
} from '../../../core/models/pelicula.model';
import { Genero } from '../../../core/models/genero.model';
import { Alerta } from '../../../components/alerta/alerta';
import { ClasificacionPipe } from '../../../pipes/clasificacion.pipe';


type Visibilidad = 'visibles' | 'ocultas';

@Component({
  selector: 'app-peliculas',
  imports: [RouterLink, DatePipe, CurrencyPipe, Alerta, ClasificacionPipe],
  templateUrl: './peliculas.html',
  styleUrl: './peliculas.css',
})
export class Peliculas {
  private readonly peliculas = inject(PeliculasService);
  private readonly generosService = inject(GenerosService);
  private readonly loading = inject(LoadingService);
  private readonly confirmacion = inject(ConfirmacionService);

  protected readonly lista = signal<PeliculaAdmin[]>([]);
  protected readonly generos = signal<Genero[]>([]);
  protected readonly mensajeError = signal<string | null>(null);

  // Mensaje que deja el formulario al volver (estado de la navegación)
  protected readonly mensajeExito = signal<string | null>(history.state?.exito ?? null);

  // ---------- Filtros (mismos criterios que el panel de los clientes + estado) ----------

  protected readonly edades = EDADES_MINIMAS;
  protected readonly opcionesLanzamiento: { valor: Lanzamiento; etiqueta: string }[] = [
    { valor: 'proximamente', etiqueta: 'Próximamente' },
    { valor: 'estreno', etiqueta: 'Estreno' },
    { valor: 'clasico', etiqueta: 'Clásico' },
  ];
  protected readonly opcionesVisibilidad: { valor: Visibilidad; etiqueta: string }[] = [
    { valor: 'visibles', etiqueta: 'Visibles' },
    { valor: 'ocultas', etiqueta: 'Ocultas' },
  ];

  protected readonly busqueda = signal('');
  protected readonly generosElegidos = signal<number[]>([]);
  protected readonly edad = signal<EdadMinima | null>(null);
  protected readonly lanzamiento = signal<Lanzamiento | null>(null);
  protected readonly visibilidad = signal<Visibilidad | null>(null);

  protected readonly cantidadFiltros = computed(() =>
    [
      this.busqueda().trim() !== '',
      this.generosElegidos().length > 0,
      this.edad() !== null,
      this.lanzamiento() !== null,
      this.visibilidad() !== null,
    ].filter(Boolean).length,
  );

  // El panel ya tiene todas las películas cargadas: se filtra en el navegador
  protected readonly filtradas = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();
    const generos = this.generosElegidos();
    const edad = this.edad();
    const lanzamiento = this.lanzamiento();
    const visibilidad = this.visibilidad();
    const hoy = fechaDeHoy();

    return this.lista().filter(p =>
      (!texto || p.titulo.toLowerCase().includes(texto)) &&
      // Géneros: la película tiene ALGUNO de los elegidos (igual que en el sitio público)
      (generos.length === 0 || p.generos.some(g => generos.includes(g.id))) &&
      (edad === null || p.edad_minima === edad) &&
      (lanzamiento === null || lanzamientoDe(p, hoy) === lanzamiento) &&
      (visibilidad === null || p.visible === (visibilidad === 'visibles')),
    );
  });

  constructor() {
    this.cargar();
  }

  private async cargar(): Promise<void> {
    this.loading.mostrar();
    try {
      const [peliculas, generos] = await Promise.all([
        this.peliculas.listarAdmin(),
        this.generosService.listar(),
      ]);
      this.lista.set(peliculas);
      this.generos.set(generos);
    } catch {
      this.mensajeError.set('No pudimos cargar las películas.');
    } finally {
      this.loading.ocultar();
    }
  }

  // Varios géneros a la vez
  protected alternarGenero(id: number): void {
    this.generosElegidos.update(actuales =>
      actuales.includes(id) ? actuales.filter(g => g !== id) : [...actuales, id],
    );
  }

  // Una sola opción: tocar la elegida otra vez la quita
  protected elegir<T>(filtro: WritableSignal<T | null>, valor: T): void {
    filtro.update(actual => (actual === valor ? null : valor));
  }

  protected borrarFiltros(): void {
    this.busqueda.set('');
    this.generosElegidos.set([]);
    this.edad.set(null);
    this.lanzamiento.set(null);
    this.visibilidad.set(null);
  }

  // ---------- Tarjetas ----------

  protected lanzamientoDe(pelicula: PeliculaAdmin): Lanzamiento {
    return lanzamientoDe(pelicula);
  }

  protected nombresGeneros(pelicula: PeliculaAdmin): string {
    return pelicula.generos.map(g => g.nombre).join(' · ');
  }

  protected async alternarVisible(pelicula: PeliculaAdmin): Promise<void> {
    const ocultar = pelicula.visible;

    if (ocultar) {
      const confirmado = await this.confirmacion.preguntar({
        titulo: '¿Ocultar película?',
        mensaje: `"${pelicula.titulo}" va a dejar de aparecer en la cartelera y en las búsquedas del sitio.`,
        textoConfirmar: 'Ocultar',
        textoCancelar: 'Cancelar',
      });

      if (!confirmado) {
        return;
      }
    }

    this.mensajeError.set(null);
    this.mensajeExito.set(null);
    this.loading.mostrar();

    try {
      await this.peliculas.cambiarVisible(pelicula.id, !pelicula.visible);
      this.lista.update(lista =>
        lista.map(p => (p.id === pelicula.id ? { ...p, visible: !p.visible } : p)),
      );
      this.mensajeExito.set(`"${pelicula.titulo}" ${ocultar ? 'ya no se muestra' : 'ahora se muestra'} en el sitio.`);
    } catch {
      this.mensajeError.set('No pudimos actualizar la película.');
    } finally {
      this.loading.ocultar();
    }
  }
}