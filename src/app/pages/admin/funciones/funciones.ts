import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FuncionesService } from '../../../core/services/funciones.service';
import { SalasService } from '../../../core/services/salas.service';
import { LoadingService } from '../../../core/services/loading.service';
import { ConfirmacionService } from '../../../core/services/confirmacion.service';
import {
  FuncionListado,
  GRILLA_DESDE_HORA,
  GRILLA_HASTA_HORA,
  combinarFechaHora,
  diaOperativo,
  etiquetaEstado,
  etiquetaIdioma,
  fechaLocal,
  primerDiaProgramable,
  sumarDias,
} from '../../../core/models/funcion.model';
import { SalaConCapacidad } from '../../../core/models/sala.model';
import { Alerta } from '../../../components/alerta/alerta';
import { CampoFecha } from '../../../components/campo-fecha/campo-fecha';

interface Bloque {
  funcion: FuncionListado;
  izquierda: number;      // % desde el inicio de la grilla
  ancho: number;          // % de la película
  anchoLimpieza: number;  // % de la limpieza
}

@Component({
  selector: 'app-funciones',
  imports: [RouterLink, DatePipe, CurrencyPipe, ReactiveFormsModule, Alerta, CampoFecha],
  templateUrl: './funciones.html',
  styleUrl: './funciones.css',
})
export class Funciones implements OnInit {
  // ?fecha=AAAA-MM-DD en la URL (withComponentInputBinding también enlaza query params)
  readonly fecha = input<string>();

  private readonly funcionesService = inject(FuncionesService);
  private readonly salasService = inject(SalasService);
  private readonly loading = inject(LoadingService);
  private readonly confirmacion = inject(ConfirmacionService);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);

  protected readonly dia = signal(fechaLocal(new Date()));
  // Selector de día (día · mes · año): cuando la fecha está completa y es válida, se va a ese día
  protected readonly fechaElegida = new FormControl(fechaLocal(new Date()), { nonNullable: true });
  protected readonly salas = signal<SalaConCapacidad[]>([]);
  protected readonly funciones = signal<FuncionListado[]>([]);
  protected readonly estados = signal<string[]>([]);
  protected readonly mensajeError = signal<string | null>(null);
  protected readonly mensajeExito = signal<string | null>(history.state?.exito ?? null);
  protected readonly ahora = signal(new Date());

  protected readonly etiquetaIdioma = etiquetaIdioma;
  protected readonly etiquetaEstado = etiquetaEstado;

  protected readonly esHoy = computed(() => this.dia() === fechaLocal(this.ahora()));
  protected readonly fechaComoDate = computed(() => combinarFechaHora(this.dia(), '12:00'));

  // Solo se ofrece "Cancelar" si el enum estado_funcion tiene ese valor
  protected readonly puedeCancelar = computed(() => this.estados().includes('cancelada'));

  // ---------- Grilla ----------

  private readonly grillaInicio = computed(() => combinarFechaHora(this.dia(), '00:00').getTime() + GRILLA_DESDE_HORA * 3_600_000);
  private readonly grillaDuracion = (GRILLA_HASTA_HORA - GRILLA_DESDE_HORA) * 3_600_000;

  protected readonly horas = Array.from(
    { length: GRILLA_HASTA_HORA - GRILLA_DESDE_HORA },
    (_, i) => String((GRILLA_DESDE_HORA + i) % 24).padStart(2, '0'),
  );

  protected readonly filas = computed(() =>
    this.salas().map(sala => ({
      sala,
      bloques: this.funciones()
        .filter(f => f.sala_id === sala.id)
        .map(f => this.bloque(f))
        .filter((b): b is Bloque => b !== null),
    })),
  );

  // Línea roja de "ahora" (solo si se está viendo el día de hoy)
  protected readonly posicionAhora = computed(() => {
    if (!this.esHoy()) {
      return null;
    }
    const porcentaje = this.porcentaje(this.ahora().getTime());
    return porcentaje >= 0 && porcentaje <= 100 ? porcentaje : null;
  });

  // Lista del día operativo: incluye la función de medianoche y excluye la de la noche anterior
  protected readonly delDia = computed(() =>
    this.funciones().filter(f => diaOperativo(new Date(f.inicio)) === this.dia()),
  );

  constructor() {
    this.fechaElegida.valueChanges.pipe(takeUntilDestroyed()).subscribe(fecha => {
      if (fecha) {
        this.irA(fecha);
      }
    });
  }

  ngOnInit(): void {
    const fecha = this.fecha();
    if (fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      this.dia.set(fecha);
    }
    this.fechaElegida.setValue(this.dia(), { emitEvent: false });
    this.iniciar();
  }

  private async iniciar(): Promise<void> {
    this.loading.mostrar();
    try {
      const [salas, estados] = await Promise.all([
        this.salasService.listar(),
        this.funcionesService.valoresEnum('estado_funcion').catch(() => [] as string[]),
      ]);
      this.salas.set(salas);
      this.estados.set(estados);
      await this.cargarDia();
    } catch (error) {
      console.error('Error al cargar las funciones', error);
      this.mensajeError.set('No pudimos cargar las funciones.');
    } finally {
      this.loading.ocultar();
    }
  }

  private async cargarDia(): Promise<void> {
    this.funciones.set(await this.funcionesService.listarDia(this.dia()));
    this.ahora.set(new Date());
  }

  protected async irA(fecha: string): Promise<void> {
    if (!fecha || fecha === this.dia()) {
      return;
    }

    this.dia.set(fecha);
    this.fechaElegida.setValue(fecha, { emitEvent: false });
    this.mensajeError.set(null);
    this.router.navigate([], { relativeTo: this.ruta, queryParams: { fecha }, replaceUrl: true });

    this.loading.mostrar();
    try {
      await this.cargarDia();
    } catch (error) {
      console.error('Error al cargar el día', error);
      this.mensajeError.set('No pudimos cargar las funciones de ese día.');
    } finally {
      this.loading.ocultar();
    }
  }

  protected moverDia(dias: number): void {
    this.irA(sumarDias(this.dia(), dias));
  }

  protected irAHoy(): void {
    this.irA(fechaLocal(new Date()));
  }

  // ---------- Posiciones ----------

  private porcentaje(momento: number): number {
    return ((momento - this.grillaInicio()) / this.grillaDuracion) * 100;
  }

  private bloque(funcion: FuncionListado): Bloque | null {
    const inicio = Math.max(0, this.porcentaje(new Date(funcion.inicio).getTime()));
    const fin = Math.min(100, this.porcentaje(new Date(funcion.fin).getTime()));
    const finLimpieza = Math.min(100, this.porcentaje(new Date(funcion.fin_limpieza).getTime()));

    if (finLimpieza <= 0 || inicio >= 100) {
      return null;
    }

    return {
      funcion,
      izquierda: inicio,
      ancho: Math.max(0, fin - inicio),
      anchoLimpieza: Math.max(0, finLimpieza - Math.max(fin, inicio)),
    };
  }

  // ---------- Estado de cada función ----------

  // Cancelar sí se puede el mismo día, mientras la función no haya empezado
  protected esCancelable(funcion: FuncionListado): boolean {
    return funcion.estado === 'programada' && new Date(funcion.inicio) > this.ahora();
  }

  // Editar sigue la misma regla que el alta: solo desde mañana
  protected esEditable(funcion: FuncionListado): boolean {
    return funcion.estado === 'programada' && diaOperativo(new Date(funcion.inicio)) >= primerDiaProgramable();
  }

  // ---------- Acciones ----------

  protected async cancelar(funcion: FuncionListado): Promise<void> {
    const confirmado = await this.confirmacion.preguntar({
      titulo: '¿Cancelar la función?',
      mensaje: `"${funcion.pelicula.titulo}" en la sala ${funcion.sala.numero}. La sala queda libre en ese horario.`,
      textoConfirmar: 'Cancelar función',
      textoCancelar: 'Volver',
    });

    if (!confirmado) {
      return;
    }

    await this.ejecutar(
      () => this.funcionesService.cambiarEstado(funcion.id, 'cancelada'),
      `La función de "${funcion.pelicula.titulo}" fue cancelada.`,
      'No pudimos cancelar la función.',
    );
  }

  protected async eliminar(funcion: FuncionListado): Promise<void> {
    const confirmado = await this.confirmacion.preguntar({
      titulo: '¿Eliminar la función?',
      mensaje: `"${funcion.pelicula.titulo}" en la sala ${funcion.sala.numero}. Esta acción no se puede deshacer.`,
      textoConfirmar: 'Eliminar',
      textoCancelar: 'Volver',
    });

    if (!confirmado) {
      return;
    }

    await this.ejecutar(
      () => this.funcionesService.eliminar(funcion.id),
      `La función de "${funcion.pelicula.titulo}" fue eliminada.`,
      'No pudimos eliminar la función.',
      'La función ya tiene entradas vendidas: no se puede eliminar. Cancelala en su lugar.',
    );
  }

  private async ejecutar(accion: () => Promise<void>, exito: string, error: string, errorConEntradas?: string): Promise<void> {
    this.mensajeError.set(null);
    this.mensajeExito.set(null);
    this.loading.mostrar();

    try {
      await accion();
      await this.cargarDia();
      this.mensajeExito.set(exito);
    } catch (e) {
      console.error(error, e);
      this.mensajeError.set((e as { code?: string } | null)?.code === '23503' && errorConEntradas ? errorConEntradas : error);
    } finally {
      this.loading.ocultar();
    }
  }
}