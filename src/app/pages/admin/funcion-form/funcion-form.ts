import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, debounceTime, distinctUntilChanged, filter, from, map, of, switchMap, tap } from 'rxjs';
import { FuncionesService } from '../../../core/services/funciones.service';
import { PeliculasService } from '../../../core/services/peliculas.service';
import { SalasService } from '../../../core/services/salas.service';
import { LoadingService } from '../../../core/services/loading.service';
import { ConCambiosSinGuardar } from '../../../core/guards/cambios-sin-guardar.guard';
import {
  Funcion,
  FuncionListado,
  HORA_APERTURA,
  HORA_ULTIMO_INICIO,
  MINUTOS_LIMPIEZA,
  combinarFechaHora,
  diaOperativo,
  disponibilidadEn,
  etiquetaIdioma,
  horaLocal,
  inicioDeFuncion,
  primerDiaProgramable,
  seSuperponen,
  sumarDias,
  sumarMinutos,
} from '../../../core/models/funcion.model';
import { PeliculaAdmin } from '../../../core/models/pelicula.model';
import { DESCRIPCION_FORMATO, FORMATOS_SALA, FormatoSala, SalaConCapacidad } from '../../../core/models/sala.model';
import { Alerta } from '../../../components/alerta/alerta';
import { CampoFecha } from '../../../components/campo-fecha/campo-fecha';
import { horarioFuncionValidator } from '../../../validators/horario-funcion.validator';

type Periodo = 'AM' | 'PM';

interface OpcionHora {
  etiqueta: string; // lo que ve el empleado (12 h)
  valor: string;    // hora real en 24 h ('10', '13', '00'…)
  nota?: string;
}

// AM: 10, 11 y 12 (mediodía). PM: 1 a 11 y 12 (medianoche, última función posible)
const HORAS: Record<Periodo, OpcionHora[]> = {
  AM: [
    { etiqueta: '10', valor: '10' },
    { etiqueta: '11', valor: '11' },
    { etiqueta: '12', valor: '12', nota: 'mediodía' },
  ],
  PM: [
    ...Array.from({ length: 11 }, (_, i) => ({ etiqueta: String(i + 1), valor: String(i + 13) })),
    { etiqueta: '12', valor: '00', nota: 'medianoche' },
  ],
};

const MINUTOS = ['00', '15', '30', '45'];

// Días de la semana (valor = Date.getDay(): 0 domingo … 6 sábado), en orden de lunes a domingo
const DIAS_SEMANA = [
  { valor: 1, corto: 'Lun', largo: 'lunes' },
  { valor: 2, corto: 'Mar', largo: 'martes' },
  { valor: 3, corto: 'Mié', largo: 'miércoles' },
  { valor: 4, corto: 'Jue', largo: 'jueves' },
  { valor: 5, corto: 'Vie', largo: 'viernes' },
  { valor: 6, corto: 'Sáb', largo: 'sábado' },
  { valor: 0, corto: 'Dom', largo: 'domingo' },
];

// Rango máximo para programar de una vez
const DIAS_MAXIMOS = 62;

// Estado de cada fecha del plan
type EstadoPlan = 'ok' | 'sin_sala' | 'no_disponible';

interface FechaPlan {
  dia: string;    // día operativo 'AAAA-MM-DD'
  inicio: Date;
  estado: EstadoPlan;
  sala: SalaConCapacidad | null; // sala que asignaría el sistema (vista previa)
  detalle: string;
}

// 'AAAA-MM-DD' → día de la semana (0 domingo … 6 sábado)
const diaSemana = (dia: string): number => combinarFechaHora(dia, '12:00').getDay();

// Validador de grupo para la repetición: "hasta" obligatorio, no anterior a "desde",
// rango máximo y al menos un día de la semana
function repeticionValidator(grupo: AbstractControl): ValidationErrors | null {
  if (!grupo.get('repetir')?.value) {
    return null;
  }
  const desde = grupo.get('fecha')?.value as string;
  const hasta = grupo.get('hasta')?.value as string;
  const dias = grupo.get('dias_semana')?.value as number[];

  if (!hasta) {
    return { hastaRequerido: true };
  }
  if (desde && hasta < desde) {
    return { hastaAnterior: true };
  }
  if (desde && hasta > sumarDias(desde, DIAS_MAXIMOS - 1)) {
    return { rangoMuyLargo: DIAS_MAXIMOS };
  }
  if (!dias || dias.length === 0) {
    return { sinDias: true };
  }
  return null;
}

@Component({
  selector: 'app-funcion-form',
  imports: [ReactiveFormsModule, DatePipe, CurrencyPipe, Alerta, CampoFecha],
  templateUrl: './funcion-form.html',
  styleUrl: './funcion-form.css',
})
export class FuncionForm implements OnInit, ConCambiosSinGuardar {
  // :id en /admin/funciones/:id/editar · ?fecha= en /admin/funciones/nueva
  readonly id = input<string>();
  readonly fecha = input<string>();

  private readonly fb = inject(NonNullableFormBuilder);
  private readonly funcionesService = inject(FuncionesService);
  private readonly peliculasService = inject(PeliculasService);
  private readonly salasService = inject(SalasService);
  private readonly loading = inject(LoadingService);
  private readonly router = inject(Router);

  protected readonly esEdicion = computed(() => this.id() !== undefined);
  protected readonly apertura = HORA_APERTURA;
  protected readonly ultimoInicio = HORA_ULTIMO_INICIO;
  protected readonly minutosLimpieza = MINUTOS_LIMPIEZA;
  protected readonly minutos = MINUTOS;
  protected readonly diasSemana = DIAS_SEMANA;
  protected readonly diasMaximos = DIAS_MAXIMOS;
  protected readonly etiquetaIdioma = etiquetaIdioma;
  protected readonly descripcionFormato = DESCRIPCION_FORMATO;

  // ---------- Selector de horario (AM / PM + hora + minutos de a 15) ----------
  protected readonly periodo = signal<Periodo>('PM');
  protected readonly opcionesHora = computed(() => HORAS[this.periodo()]);

  protected readonly peliculas = signal<PeliculaAdmin[]>([]);
  protected readonly salas = signal<SalaConCapacidad[]>([]);
  protected readonly idiomas = signal<string[]>([]);
  protected readonly ocupacion = signal<FuncionListado[]>([]);
  protected readonly verificando = signal(false);

  // Edición: sala y formato actuales, y si ya vendió entradas (entonces no cambia de sala ni de formato)
  private readonly salaActualId = signal<number | null>(null);
  protected readonly formatoActual = signal<FormatoSala | null>(null);
  protected readonly conEntradas = signal(false);

  protected readonly noEncontrada = signal(false);
  protected readonly noEditable = signal(false);
  protected readonly enviando = signal(false);
  protected readonly mensajeError = signal<string | null>(null);

  private guardado = false;
  // Al editar se respeta el precio guardado: no se reemplaza por el sugerido
  private precioFijo = false;

  protected readonly formulario = this.fb.group(
    {
      pelicula_id: this.fb.control<number | null>(null, Validators.required),
      formato: this.fb.control<FormatoSala | null>(null, Validators.required),
      fecha: this.fb.control(primerDiaProgramable(), Validators.required), // "desde" si se repite
      hora: this.fb.control('', Validators.required),
      idioma: this.fb.control('', Validators.required),
      precio_base: this.fb.control<number | null>(null, [Validators.required, Validators.min(1)]),
      // Repetición (solo al crear): ej. lunes, martes y viernes hasta tal fecha
      repetir: false,
      hasta: '',
      dias_semana: this.fb.control<number[]>([]),
    },
    { validators: [horarioFuncionValidator(HORA_APERTURA, HORA_ULTIMO_INICIO), repeticionValidator] },
  );

  protected readonly campos = this.formulario.controls;

  // El formulario como signal: todos los cálculos de abajo se actualizan solos
  private readonly valores = toSignal(this.formulario.valueChanges, { initialValue: this.formulario.getRawValue() });

  protected readonly pelicula = computed(() => this.peliculas().find(p => p.id === this.valores().pelicula_id) ?? null);

  // ---------- Formato ----------

  // Cada formato con la cantidad de salas que lo tienen (los que no tienen salas se muestran deshabilitados)
  protected readonly formatos = computed(() =>
    FORMATOS_SALA.map(formato => ({
      formato,
      salas: this.salas().filter(s => s.formato === formato).length,
    })),
  );

  // Salas candidatas para la vista previa: solo las del formato elegido, en el mismo orden
  // que usa la base (al editar, primero la sala actual; después de menor a mayor número)
  protected readonly salasDelFormato = computed(() => {
    const formato = this.valores().formato;
    const actual = this.salaActualId();
    return this.salas()
      .filter(s => s.formato === formato && (!this.conEntradas() || s.id === actual))
      .sort((a, b) => Number(b.id === actual) - Number(a.id === actual) || a.numero - b.numero);
  });

  protected readonly horaElegida = computed(() => this.valores().hora?.split(':')[0] || null);
  protected readonly minutosElegidos = computed(() => this.valores().hora?.split(':')[1] ?? null);

  // La función de medianoche cae en el día siguiente del calendario
  protected readonly esMedianoche = computed(() => {
    const hora = this.valores().hora;
    return !!hora && hora < HORA_APERTURA;
  });

  // ---------- Fechas a programar ----------

  // Una sola fecha, o todas las del rango que caen en los días de la semana elegidos
  protected readonly fechas = computed<string[]>(() => {
    const { fecha, hasta, repetir, dias_semana } = this.valores();
    if (!fecha) {
      return [];
    }
    if (!repetir || this.esEdicion()) {
      return [fecha];
    }
    if (!hasta || hasta < fecha || !dias_semana?.length) {
      return [];
    }

    const lista: string[] = [];
    for (let dia = fecha; dia <= hasta && lista.length < DIAS_MAXIMOS; dia = sumarDias(dia, 1)) {
      if (dias_semana.includes(diaSemana(dia))) {
        lista.push(dia);
      }
    }
    return lista;
  });

  // Vista previa del plan: para cada fecha, qué sala asignaría el sistema.
  // Es solo informativa: la sala definitiva la elige la base al guardar.
  protected readonly plan = computed<FechaPlan[]>(() => {
    const pelicula = this.pelicula();
    const { hora, formato } = this.valores();
    if (!pelicula || !hora || !formato) {
      return [];
    }

    const idActual = Number(this.id());
    return this.fechas().map(dia => {
      const inicio = inicioDeFuncion(dia, hora);
      const finLimpieza = sumarMinutos(inicio, pelicula.duracion_min + MINUTOS_LIMPIEZA);
      const disponible = disponibilidadEn(pelicula, dia);

      if (!disponible.ok) {
        return { dia, inicio, estado: 'no_disponible' as const, sala: null, detalle: disponible.motivo };
      }

      const libre = this.salasDelFormato().find(
        sala =>
          !this.ocupacion().some(
            f =>
              f.sala_id === sala.id &&
              f.id !== idActual &&
              f.estado === 'programada' &&
              seSuperponen(inicio, finLimpieza, new Date(f.inicio), new Date(f.fin_limpieza)),
          ),
      );

      return libre
        ? { dia, inicio, estado: 'ok' as const, sala: libre, detalle: disponible.preventa ? 'Preventa' : '' }
        : { dia, inicio, estado: 'sin_sala' as const, sala: null, detalle: `Todas las salas ${formato} están ocupadas en ese horario` };
    });
  });

  protected readonly aProgramar = computed(() => this.plan().filter(p => p.estado !== 'no_disponible'));
  protected readonly conSala = computed(() => this.plan().filter(p => p.estado === 'ok').length);
  protected readonly noDisponibles = computed(() => this.plan().filter(p => p.estado === 'no_disponible').length);
  protected readonly sinSala = computed(() => this.plan().filter(p => p.estado === 'sin_sala').length);

  // Línea de tiempo de la primera fecha (inicio → fin → limpieza)
  protected readonly rango = computed(() => {
    const primera = this.plan()[0];
    const pelicula = this.pelicula();
    if (!primera || !pelicula) {
      return null;
    }
    const fin = sumarMinutos(primera.inicio, pelicula.duracion_min);
    return { inicio: primera.inicio, fin, finLimpieza: sumarMinutos(fin, MINUTOS_LIMPIEZA) };
  });

  // Precio sugerido: el de preventa si la primera fecha cae en la preventa, si no el normal
  protected readonly esPreventa = computed(() => this.plan()[0]?.detalle === 'Preventa');
  protected readonly precioSugerido = computed(() => {
    const pelicula = this.pelicula();
    if (!pelicula) {
      return null;
    }
    return this.esPreventa() ? pelicula.precio_preventa : pelicula.precio;
  });

  // Para el resumen: "lunes, martes y viernes"
  protected readonly textoDias = computed(() => {
    const elegidos = DIAS_SEMANA.filter(d => this.valores().dias_semana?.includes(d.valor)).map(d => d.largo);
    return elegidos.length <= 1 ? elegidos.join('') : `${elegidos.slice(0, -1).join(', ')} y ${elegidos.at(-1)}`;
  });

  constructor() {
    // Cada vez que cambia el rango de fechas se trae la ocupación de esos días.
    // switchMap descarta la consulta anterior si el usuario cambia rápido.
    this.formulario.valueChanges
      .pipe(
        map(() => this.rangoConsulta()),
        filter((r): r is { desde: string; dias: number } => r !== null),
        distinctUntilChanged((a, b) => a.desde === b.desde && a.dias === b.dias),
        debounceTime(250),
        tap(() => this.verificando.set(true)),
        switchMap(r =>
          from(this.funcionesService.listarDias(r.desde, r.dias)).pipe(catchError(() => of<FuncionListado[]>([]))),
        ),
        takeUntilDestroyed(),
      )
      .subscribe(funciones => {
        this.ocupacion.set(funciones);
        this.verificando.set(false);
      });

    // Precio sugerido al elegir película o fecha, salvo que el precio se haya escrito a mano
    this.formulario.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      const sugerido = this.precioSugerido();
      const control = this.campos.precio_base;
      if (sugerido !== null && !this.precioFijo && !control.dirty && control.value !== sugerido) {
        control.setValue(sugerido, { emitEvent: false });
      }
    });
  }

  // Días que hay que consultar: desde la primera fecha hasta la última del plan
  private rangoConsulta(): { desde: string; dias: number } | null {
    const fechas = this.fechas();
    if (fechas.length === 0) {
      return null;
    }
    const desde = fechas[0];
    const hasta = fechas[fechas.length - 1];
    const dias = Math.round((combinarFechaHora(hasta, '12:00').getTime() - combinarFechaHora(desde, '12:00').getTime()) / 86_400_000) + 1;
    return { desde, dias };
  }

  ngOnInit(): void {
    const fecha = this.fecha();
    if (!this.esEdicion() && fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) && fecha >= primerDiaProgramable()) {
      this.campos.fecha.setValue(fecha);
    }
    this.cargar();
  }

  hayCambiosSinGuardar(): boolean {
    return !this.guardado && this.formulario.dirty;
  }

  private async cargar(): Promise<void> {
    const id = this.id();
    const idNumerico = Number(id);

    if (id !== undefined && !Number.isInteger(idNumerico)) {
      this.noEncontrada.set(true);
      return;
    }

    this.loading.mostrar();
    try {
      const [peliculas, salas, idiomas, funcion] = await Promise.all([
        this.peliculasService.listarAdmin(),
        this.salasService.listar(),
        this.funcionesService.valoresEnum('idioma_funcion').catch(error => {
          console.error('No se pudieron cargar los idiomas', error);
          this.mensajeError.set('Falta crear la función enum_valores en la base (archivo funciones.sql).');
          return [] as string[];
        }),
        id !== undefined ? this.funcionesService.obtener(idNumerico) : Promise.resolve(null),
      ]);

      this.salas.set([...salas].sort((a, b) => a.numero - b.numero));
      this.idiomas.set(idiomas);

      // Solo películas visibles (más la de la función que se edita, aunque esté oculta)
      this.peliculas.set(
        peliculas
          .filter(p => p.visible || p.id === funcion?.pelicula_id)
          .sort((a, b) => a.titulo.localeCompare(b.titulo)),
      );

      if (id !== undefined) {
        if (!funcion) {
          this.noEncontrada.set(true);
          return;
        }
        // Solo se editan funciones programadas desde mañana en adelante (misma regla que el alta)
        if (funcion.estado !== 'programada' || diaOperativo(new Date(funcion.inicio)) < primerDiaProgramable()) {
          this.noEditable.set(true);
          return;
        }
        const sala = salas.find(s => s.id === funcion.sala_id);
        this.salaActualId.set(funcion.sala_id);
        this.formatoActual.set(sala?.formato ?? null);
        this.conEntradas.set(await this.funcionesService.tieneEntradas(funcion.id).catch(() => false));
        this.completarFormulario(funcion, sala?.formato ?? null);
      } else {
        if (idiomas.length > 0) {
          this.campos.idioma.setValue(idiomas[0]);
        }
        // Por defecto 2D (o el primer formato que tenga salas)
        const formato = salas.some(s => s.formato === '2D') ? '2D' : (salas[0]?.formato ?? null);
        this.campos.formato.setValue(formato);
        this.formulario.markAsPristine();
      }

      const rango = this.rangoConsulta();
      if (rango) {
        this.ocupacion.set(await this.funcionesService.listarDias(rango.desde, rango.dias));
      }
    } catch (error) {
      console.error('Error al cargar los datos', error);
      this.mensajeError.set('No pudimos cargar los datos. Recargá la página.');
    } finally {
      this.loading.ocultar();
    }
  }

  private completarFormulario(funcion: Funcion, formato: FormatoSala | null): void {
    const inicio = new Date(funcion.inicio);
    this.precioFijo = true;
    this.formulario.setValue({
      pelicula_id: funcion.pelicula_id,
      formato,
      fecha: diaOperativo(inicio),
      hora: horaLocal(inicio),
      idioma: funcion.idioma,
      precio_base: funcion.precio_base,
      repetir: false,
      hasta: '',
      dias_semana: [],
    });
    // Se abre el período (AM / PM) de la hora guardada
    const hora = horaLocal(inicio).split(':')[0];
    this.periodo.set(HORAS.AM.some(h => h.valor === hora) ? 'AM' : 'PM');
    this.formulario.markAsPristine();
  }

  // ---------- Formato ----------

  protected elegirFormato(formato: FormatoSala): void {
    // Con entradas vendidas la función se queda en su sala, así que tampoco cambia de formato
    if (this.conEntradas() && formato !== this.formatoActual()) {
      return;
    }
    this.campos.formato.setValue(formato);
    this.campos.formato.markAsDirty();
    this.campos.formato.markAsTouched();
  }

  // ---------- Repetición ----------

  protected alternarRepetir(repetir: boolean): void {
    this.campos.repetir.setValue(repetir);
    // Al activar: por defecto, el mismo día de la semana que la fecha elegida, durante 4 semanas
    if (repetir && this.campos.dias_semana.value.length === 0 && this.campos.fecha.value) {
      this.campos.dias_semana.setValue([diaSemana(this.campos.fecha.value)]);
      if (!this.campos.hasta.value) {
        this.campos.hasta.setValue(sumarDias(this.campos.fecha.value, 27));
      }
    }
    this.formulario.markAsDirty();
  }

  protected alternarDia(valor: number): void {
    const actuales = this.campos.dias_semana.value;
    this.campos.dias_semana.setValue(
      actuales.includes(valor) ? actuales.filter(d => d !== valor) : [...actuales, valor],
    );
    this.campos.dias_semana.markAsDirty();
  }

  protected elegirDias(valores: number[]): void {
    this.campos.dias_semana.setValue(valores);
    this.campos.dias_semana.markAsDirty();
  }

  // ---------- Horario ----------

  protected elegirPeriodo(periodo: Periodo): void {
    if (periodo === this.periodo()) {
      return;
    }
    this.periodo.set(periodo);
    const hora = this.horaElegida();
    if (hora && !HORAS[periodo].some(h => h.valor === hora)) {
      this.campos.hora.setValue('');
    }
  }

  protected elegirHora(hora: string): void {
    // Medianoche es la última función posible: solo a las 00:00
    const minutos = hora === '00' ? '00' : (this.minutosElegidos() ?? '00');
    this.actualizarHora(`${hora}:${minutos}`);
  }

  protected elegirMinutos(minutos: string): void {
    const hora = this.horaElegida();
    if (hora) {
      this.actualizarHora(`${hora}:${minutos}`);
    }
  }

  private actualizarHora(valor: string): void {
    this.campos.hora.setValue(valor);
    this.campos.hora.markAsDirty();
    this.campos.hora.markAsTouched();
  }

  // ---------- Guardar ----------

  protected async guardar(): Promise<void> {
    if (this.enviando()) {
      return;
    }

    this.mensajeError.set(null);

    if (this.formulario.invalid || this.aProgramar().length === 0) {
      this.formulario.markAllAsTouched();
      if (this.formulario.valid && this.plan().length > 0) {
        this.mensajeError.set('La película no está disponible en ninguna de las fechas elegidas.');
      }
      document.querySelector<HTMLElement>('[aria-invalid="true"], .campo__error')?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
      return;
    }

    const v = this.formulario.getRawValue();
    const pelicula = this.pelicula();
    if (v.pelicula_id === null || v.precio_base === null || v.formato === null || !pelicula) {
      return;
    }

    this.enviando.set(true);
    this.loading.mostrar();

    try {
      let exito: string;
      const id = this.id();

      if (id !== undefined) {
        // Edición: la base mantiene la sala si sigue libre o busca otra
        const sala = await this.funcionesService.reprogramar(
          Number(id), v.pelicula_id, inicioDeFuncion(v.fecha, v.hora).toISOString(), v.formato, v.idioma, v.precio_base,
        );
        exito = `La función de "${pelicula.titulo}" se actualizó (Sala ${sala} · ${v.formato}).`;
      } else {
        // Alta: la base asigna la primera sala libre para cada fecha
        const resultado = await this.funcionesService.programar(
          v.pelicula_id, this.aProgramar().map(p => p.inicio.toISOString()), v.formato, v.idioma, v.precio_base,
        );
        const asignadas = resultado.filter(r => r.sala !== null);
        const sinLugar = resultado.length - asignadas.length;

        if (asignadas.length === 0) {
          this.mensajeError.set(`No hay ninguna sala ${v.formato} libre en ese horario. Probá con otro horario o formato.`);
          await this.refrescarOcupacion();
          return;
        }

        const salas = [...new Set(asignadas.map(r => r.sala))].sort((a, b) => a! - b!).join(', ');
        exito = asignadas.length === 1
          ? `Se programó "${pelicula.titulo}" en ${v.formato}, Sala ${salas}.`
          : `Se programaron ${asignadas.length} funciones de "${pelicula.titulo}" en ${v.formato} (Sala ${salas}).`;
        if (sinLugar > 0) {
          exito += ` ${sinLugar} ${sinLugar === 1 ? 'fecha quedó' : 'fechas quedaron'} sin programar por falta de sala ${v.formato} libre.`;
        }
      }

      this.guardado = true;
      await this.router.navigate(['/admin/funciones'], { queryParams: { fecha: v.fecha }, state: { exito } });
    } catch (error) {
      console.error('Error al guardar la función', error);
      this.mensajeError.set(this.traducirError(error));
      await this.refrescarOcupacion();
    } finally {
      this.loading.ocultar();
      this.enviando.set(false);
    }
  }

  private async refrescarOcupacion(): Promise<void> {
    const rango = this.rangoConsulta();
    if (rango) {
      this.ocupacion.set(await this.funcionesService.listarDias(rango.desde, rango.dias).catch(() => this.ocupacion()));
    }
  }

  private traducirError(error: unknown): string {
    const { code, message } = (error ?? {}) as { code?: string; message?: string };

    if (message?.includes('SIN_SALA_LIBRE')) {
      return this.conEntradas()
        ? 'Su sala está ocupada en ese horario y, como ya tiene entradas vendidas, la función no puede cambiar de sala.'
        : `No hay ninguna sala ${this.campos.formato.value} libre en ese horario. Probá con otro horario o formato.`;
    }
    if (message?.includes('SIN_SALAS_DEL_FORMATO')) {
      return `No hay salas ${this.campos.formato.value} cargadas. Elegí otro formato o creá la sala en Salas.`;
    }
    if (message?.includes('FORMATO_CON_ENTRADAS')) {
      return 'La función ya tiene entradas vendidas: no se puede cambiar el formato porque cambiaría de sala.';
    }

    switch (code) {
      case '23514':
        if (message?.includes('funcion_sin_anticipacion')) {
          return 'Las funciones se programan con al menos un día de anticipación: elegí una fecha desde mañana.';
        }
        return message?.includes('funciones_horario_inicio')
          ? `Las funciones solo pueden empezar entre las ${HORA_APERTURA} y las ${HORA_ULTIMO_INICIO}.`
          : 'El precio no puede ser negativo.';
      case '23503':
        return 'La película elegida ya no existe. Recargá la página.';
      case '22P02':
        return 'El idioma elegido no es válido para la base.';
      case 'PGRST202':
        return 'Falta crear las funciones de asignación de salas en la base (archivo asignacion-salas.sql).';
      default:
        return 'No pudimos guardar la función. Revisá tu conexión e intentá de nuevo.';
    }
  }
}