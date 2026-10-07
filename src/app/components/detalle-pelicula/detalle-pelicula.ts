import { Component, ElementRef, OnInit, afterNextRender, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { PeliculaListado, lanzamientoDe } from '../../core/models/pelicula.model';
import { MiResena, Puntuacion, Resena, mensajeErrorResena } from '../../core/models/resena.model';
import { ResenasService } from '../../core/services/resenas.service';
import { ComprasService } from '../../core/services/compras.service';
import { AuthService } from '../../core/services/auth.service';
import { FuncionDePelicula } from '../../core/models/compra.model';
import { diaOperativo, sumarDias } from '../../core/models/funcion.model';
import { Estrellas } from '../estrellas/estrellas';
import { DatosResena, FormResena } from '../form-resena/form-resena';
import { ClasificacionPipe } from '../../pipes/clasificacion.pipe';
import { DuracionPipe } from '../../pipes/duracion.pipe';

// Ficha de la película en un <dialog> modal (se abre al tocar una tarjeta).
// Recibe la película por input() y avisa por output() cuando se cierra.
@Component({
  selector: 'app-detalle-pelicula',
  imports: [DatePipe, DecimalPipe, ClasificacionPipe, DuracionPipe, Estrellas, FormResena],
  templateUrl: './detalle-pelicula.html',
  styleUrl: './detalle-pelicula.css',
})
export class DetallePelicula implements OnInit {
  readonly pelicula = input.required<PeliculaListado>();
  readonly cerrar = output<void>();

  private readonly resenasService = inject(ResenasService);
  private readonly comprasService = inject(ComprasService);
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly dialogo = viewChild.required<ElementRef<HTMLDialogElement>>('dialogo');

  // ---------- Puntuación y reseñas (se cargan al abrir la ficha) ----------
  protected readonly cargandoResenas = signal(true);
  protected readonly errorResenas = signal(false);
  protected readonly puntuacion = signal<Puntuacion | null>(null);
  protected readonly resenas = signal<Resena[]>([]);

  // ---------- Mi reseña (solo clientes registrados) ----------
  protected readonly miResena = signal<MiResena | null>(null);
  protected readonly guardandoResena = signal(false);
  protected readonly mensajeResena = signal<{ tipo: 'exito' | 'error'; texto: string } | null>(null);

  // ---------- Funciones a la venta ----------
  // Paso a paso: "Ver horarios" → semana → día → horario
  //  inicial  → solo se ve el botón (todavía no se consultó nada)
  //  cargando → consultando la base
  //  listo    → hay respuesta (con o sin funciones)
  //  error    → falló la consulta
  protected readonly abriendoCompra = signal(false);
  protected readonly errorCompra = signal<string | null>(null);
  protected readonly estadoFunciones = signal<'inicial' | 'cargando' | 'listo' | 'error'>('inicial');
  private readonly funciones = signal<FuncionDePelicula[]>([]);
  protected readonly diaElegido = signal<string | null>(null);
  protected readonly indiceSemana = signal(0);

  // Momento de referencia para descartar funciones que ya empezaron.
  // Se actualiza al consultar y al elegir un día (por si la ficha quedó abierta un rato).
  private readonly ahora = signal(Date.now());

  // Solo las funciones que todavía no empezaron
  private readonly disponibles = computed(() =>
    this.funciones().filter(f => new Date(f.inicio).getTime() > this.ahora()),
  );

  // Fechas con al menos una función disponible (la de las 00:00 pertenece a la noche anterior)
  protected readonly fechas = computed(() => {
    const dias = new Set(this.disponibles().map(f => diaOperativo(new Date(f.inicio))));
    return [...dias].sort().map(dia => ({ dia, fecha: new Date(`${dia}T12:00:00`) }));
  });

  // Semanas de lunes a domingo que tienen al menos un día con funciones.
  // Dentro de cada semana solo están los días disponibles (no los 7).
  protected readonly semanas = computed(() => {
    const grupos = new Map<string, { dia: string; fecha: Date }[]>();
    this.fechas().forEach(f => {
      const lunes = lunesDe(f.dia);
      grupos.set(lunes, [...(grupos.get(lunes) ?? []), f]);
    });
    return [...grupos.entries()].map(([lunes, dias]) => ({
      desde: new Date(`${lunes}T12:00:00`),
      hasta: new Date(`${sumarDias(lunes, 6)}T12:00:00`),
      dias,
    }));
  });

  protected readonly semana = computed(() => this.semanas()[this.indiceSemana()] ?? null);
  protected readonly hayAnterior = computed(() => this.indiceSemana() > 0);
  protected readonly haySiguiente = computed(() => this.indiceSemana() < this.semanas().length - 1);

  // Horarios del día elegido
  protected readonly horarios = computed(() => {
    const dia = this.diaElegido();
    return dia ? this.disponibles().filter(f => diaOperativo(new Date(f.inicio)) === dia) : [];
  });

  protected readonly fechaElegida = computed(() => {
    const dia = this.diaElegido();
    return dia ? new Date(`${dia}T12:00:00`) : null;
  });

  protected readonly lanzamiento = computed(() => lanzamientoDe(this.pelicula()));

  constructor() {
    // showModal(): top layer, fondo oscuro, foco atrapado y cierre con Escape
    afterNextRender(() => this.dialogo().nativeElement.showModal());
  }

  ngOnInit(): void {
    this.cargarResenas();
    this.cargarMiResena();
  }

  private async cargarMiResena(): Promise<void> {
    await this.auth.esperarInicio();
    if (!this.auth.logueado()) {
      return;
    }
    try {
      this.miResena.set(await this.resenasService.miResena(this.pelicula().id));
    } catch (error) {
      console.error('Error al cargar mi reseña', error);
    }
  }

  protected async guardarResena(datos: DatosResena): Promise<void> {
    this.guardandoResena.set(true);
    this.mensajeResena.set(null);
    try {
      const nueva = this.miResena() === null;
      await this.resenasService.guardar(this.pelicula().id, datos.estrellas, datos.comentario);
      this.mensajeResena.set({ tipo: 'exito', texto: nueva ? '¡Gracias por tu reseña!' : 'Actualizamos tu reseña.' });
      // El promedio y la lista se recalculan en la base
      await Promise.all([this.cargarResenas(), this.cargarMiResena()]);
    } catch (error) {
      console.error('Error al guardar la reseña', error);
      this.mensajeResena.set({ tipo: 'error', texto: mensajeErrorResena(error) });
    } finally {
      this.guardandoResena.set(false);
    }
  }

  // La confirmación se pide dentro del formulario (un modal aparte quedaría detrás de este <dialog>)
  protected async eliminarResena(): Promise<void> {
    this.guardandoResena.set(true);
    this.mensajeResena.set(null);
    try {
      await this.resenasService.eliminar(this.pelicula().id);
      this.miResena.set(null);
      this.mensajeResena.set({ tipo: 'exito', texto: 'Borramos tu reseña.' });
      await this.cargarResenas();
    } catch (error) {
      console.error('Error al borrar la reseña', error);
      this.mensajeResena.set({ tipo: 'error', texto: 'No pudimos borrar tu reseña. Intentá de nuevo.' });
    } finally {
      this.guardandoResena.set(false);
    }
  }

  // Recién al tocar "Ver horarios" se consulta la base
  protected async verHorarios(): Promise<void> {
    this.estadoFunciones.set('cargando');
    this.diaElegido.set(null);
    this.indiceSemana.set(0);
    try {
      this.funciones.set(await this.comprasService.funcionesDePelicula(this.pelicula().id));
      this.ahora.set(Date.now());
      this.estadoFunciones.set('listo');
    } catch (error) {
      console.error('Error al cargar las funciones', error);
      this.estadoFunciones.set('error');
    }
  }

  // Navegación entre semanas: solo se puede ir a semanas con funciones
  protected cambiarSemana(paso: -1 | 1): void {
    const indice = this.indiceSemana() + paso;
    if (indice < 0 || indice >= this.semanas().length) {
      return;
    }
    this.indiceSemana.set(indice);
    this.diaElegido.set(null);
  }

  protected elegirDia(dia: string): void {
    this.ahora.set(Date.now());
    // Si mientras tanto pasaron todas las funciones de ese día, la fecha desaparece de la lista
    this.diaElegido.set(this.fechas().some(f => f.dia === dia) ? dia : null);
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

  // Horario elegido → pantalla de butacas.
  // Si no hay sesión, compraGuard abre una de invitado; si eso falla, el guard
  // redirige al inicio y acá lo mostramos en vez de quedarnos sin respuesta.
  protected async irAComprar(funcionId: number): Promise<void> {
    if (this.abriendoCompra()) {
      return;
    }
    this.abriendoCompra.set(true);
    this.errorCompra.set(null);

    const destino = `/comprar/${funcionId}`;
    try {
      await this.router.navigateByUrl(destino);
    } catch (error) {
      console.error('Error al abrir la compra', error);
    }

    if (this.router.url.startsWith(destino)) {
      this.cerrarDialogo();
    } else {
      this.errorCompra.set('No pudimos iniciar la compra. Probá de nuevo en unos segundos.');
    }
    this.abriendoCompra.set(false);
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

// 'AAAA-MM-DD' → el lunes de esa semana ('AAAA-MM-DD')
function lunesDe(dia: string): string {
  const diaSemana = new Date(`${dia}T12:00:00`).getDay(); // 0 domingo … 6 sábado
  return sumarDias(dia, -((diaSemana + 6) % 7));
}