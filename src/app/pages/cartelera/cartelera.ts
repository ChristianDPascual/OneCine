import { Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Params, Router, RouterLink } from '@angular/router';
import { catchError, from, map, of, startWith, switchMap } from 'rxjs';
import { PeliculasService } from '../../core/services/peliculas.service';
import { GenerosService } from '../../core/services/generos.service';
import {
  BusquedaPeliculas,
  EDADES_MINIMAS,
  ETIQUETAS_EDAD,
  EdadMinima,
  Lanzamiento,
  PeliculaListado,
} from '../../core/models/pelicula.model';
import { Genero } from '../../core/models/genero.model';
import { TarjetaPelicula } from '../../components/tarjeta-pelicula/tarjeta-pelicula';

const LANZAMIENTOS: Lanzamiento[] = ['estreno', 'proximamente', 'clasico'];

const TITULOS: Record<Lanzamiento, string> = {
  estreno: 'Estrenos',
  proximamente: 'Próximamente',
  clasico: 'Clásicos',
};

type Resultado = { estado: 'cargando' } | { estado: 'listo'; peliculas: PeliculaListado[] } | { estado: 'error' };

interface Chip {
  etiqueta: string;
  quitar: Params; // parámetros a cambiar en la URL para sacar ese filtro
}

@Component({
  selector: 'app-cartelera',
  imports: [RouterLink, TarjetaPelicula],
  templateUrl: './cartelera.html',
  styleUrl: './cartelera.css',
})
export class Cartelera {
  // Query params de la URL (withComponentInputBinding). Ej.: /cartelera?q=titanic&generos=1&generos=3&edad=13
  readonly q = input<string>();
  readonly generos = input<string | string[]>();
  readonly edad = input<string>();
  readonly lanzamiento = input<string>();

  private readonly peliculasService = inject(PeliculasService);
  private readonly generosService = inject(GenerosService);
  private readonly router = inject(Router);

  private readonly listaGeneros = signal<Genero[]>([]);
  // Se incrementa con "Reintentar" para volver a consultar con la misma búsqueda
  private readonly intento = signal(0);
  protected readonly esqueletos = Array.from({ length: 10 }, (_, i) => i);

  // ---------- La URL convertida en búsqueda (se ignoran valores inválidos) ----------

  protected readonly busqueda = computed<BusquedaPeliculas>(() => {
    const texto = this.q()?.trim() || null;

    const crudos = this.generos();
    const generos = (Array.isArray(crudos) ? crudos : crudos ? [crudos] : [])
      .flatMap(g => g.split(','))
      .map(Number)
      .filter(n => Number.isInteger(n) && n > 0);

    const edadTexto = this.edad();
    const edadNumero = Number(edadTexto);
    const edad = edadTexto && (EDADES_MINIMAS as readonly number[]).includes(edadNumero)
      ? (edadNumero as EdadMinima)
      : null;

    const lanzamiento = LANZAMIENTOS.includes(this.lanzamiento() as Lanzamiento)
      ? (this.lanzamiento() as Lanzamiento)
      : null;

    return { texto, generos, edad, lanzamiento };
  });

  // Cada vez que cambia la búsqueda se consulta de nuevo.
  // switchMap descarta la respuesta anterior si el usuario cambia de filtro rápido.
  private readonly resultado = toSignal(
    toObservable(computed(() => ({ busqueda: this.busqueda(), intento: this.intento() }))).pipe(
      switchMap(({ busqueda }) =>
        from(this.peliculasService.buscar(busqueda)).pipe(
          map(peliculas => ({ estado: 'listo', peliculas }) as Resultado),
          catchError(error => {
            console.error('Error al buscar películas', error);
            return of({ estado: 'error' } as Resultado);
          }),
          startWith({ estado: 'cargando' } as Resultado),
        ),
      ),
    ),
    { initialValue: { estado: 'cargando' } as Resultado },
  );

  protected readonly cargando = computed(() => this.resultado().estado === 'cargando');
  protected readonly hayError = computed(() => this.resultado().estado === 'error');
  protected readonly peliculas = computed(() => {
    const r = this.resultado();
    return r.estado === 'listo' ? r.peliculas : [];
  });

  protected readonly titulo = computed(() => {
    const { lanzamiento, texto } = this.busqueda();
    if (texto) {
      return `Resultados para "${texto}"`;
    }
    return lanzamiento ? TITULOS[lanzamiento] : 'Cartelera';
  });

  // ---------- Filtros activos como chips ----------

  protected readonly chips = computed<Chip[]>(() => {
    const { texto, generos, edad, lanzamiento } = this.busqueda();
    const nombres = new Map(this.listaGeneros().map(g => [g.id, g.nombre]));
    const chips: Chip[] = [];

    if (texto) {
      chips.push({ etiqueta: `"${texto}"`, quitar: { q: null } });
    }
    if (lanzamiento) {
      chips.push({ etiqueta: TITULOS[lanzamiento], quitar: { lanzamiento: null } });
    }
    if (edad !== null) {
      chips.push({ etiqueta: ETIQUETAS_EDAD[edad], quitar: { edad: null } });
    }
    generos.forEach(id => {
      const resto = generos.filter(g => g !== id);
      chips.push({
        etiqueta: nombres.get(id) ?? `Género ${id}`,
        quitar: { generos: resto.length > 0 ? resto : null },
      });
    });

    return chips;
  });

  // Accesos rápidos por tipo de lanzamiento
  protected readonly pestanas = LANZAMIENTOS.map(valor => ({ valor, etiqueta: TITULOS[valor] }));

  constructor() {
    this.generosService
      .listar()
      .then(generos => this.listaGeneros.set(generos))
      .catch(error => console.warn('No se pudieron cargar los géneros', error));
  }

  // ---------- Acciones ----------

  protected quitar(chip: Chip): void {
    this.router.navigate(['/cartelera'], { queryParams: chip.quitar, queryParamsHandling: 'merge' });
  }

  protected elegirLanzamiento(valor: Lanzamiento | null): void {
    this.router.navigate(['/cartelera'], {
      queryParams: { lanzamiento: this.busqueda().lanzamiento === valor ? null : valor },
      queryParamsHandling: 'merge',
    });
  }

  protected borrarTodo(): void {
    this.router.navigate(['/cartelera']);
  }

  protected reintentar(): void {
    this.intento.update(n => n + 1);
  }
}