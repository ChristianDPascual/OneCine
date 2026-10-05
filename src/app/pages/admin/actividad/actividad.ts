import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LogActividadService } from '../../../core/services/log-actividad.service';
import { EmpleadosService } from '../../../core/services/empleados.service';
import { LoadingService } from '../../../core/services/loading.service';
import {
  CambioCampo,
  FiltrosLog,
  LogActividad,
  cambiosDe,
  etiquetaAccion,
  etiquetaTabla,
} from '../../../core/models/log-actividad.model';
import { Empleado } from '../../../core/models/empleado.model';
import { Alerta } from '../../../components/alerta/alerta';
import { PuestoPipe } from '../../../pipes/puesto.pipe';
import { CampoFecha } from '../../../components/campo-fecha/campo-fecha';

const POR_PAGINA = 25;

const SIN_FILTROS: FiltrosLog = {
  tabla: null,
  accion: null,
  usuario: null,
  desde: null,
  hasta: null,
  registro: null,
};

@Component({
  selector: 'app-actividad',
  imports: [DatePipe, ReactiveFormsModule, Alerta, PuestoPipe, CampoFecha],
  templateUrl: './actividad.html',
  styleUrl: './actividad.css',
})
export class Actividad {
  private readonly logService = inject(LogActividadService);
  private readonly empleadosService = inject(EmpleadosService);
  private readonly loading = inject(LoadingService);

  protected readonly filas = signal<LogActividad[]>([]);
  protected readonly total = signal(0);
  protected readonly pagina = signal(1);
  protected readonly filtros = signal<FiltrosLog>({ ...SIN_FILTROS });
  protected readonly mensajeError = signal<string | null>(null);
  protected readonly cargando = signal(false);

  // Opciones de los filtros
  protected readonly tablas = signal<string[]>([]);
  protected readonly acciones = signal<string[]>([]);
  protected readonly empleados = signal<Empleado[]>([]);

  // Nombres de quienes hicieron cada cambio
  private readonly empleadoPorId = computed(() => new Map(this.empleados().map(e => [e.id, e])));
  private readonly clientes = signal(new Map<string, string>());

  // Filas con el detalle abierto
  protected readonly abiertas = signal(new Set<number>());

  protected readonly totalPaginas = computed(() => Math.max(1, Math.ceil(this.total() / POR_PAGINA)));
  protected readonly primeraFila = computed(() => (this.total() === 0 ? 0 : (this.pagina() - 1) * POR_PAGINA + 1));
  protected readonly ultimaFila = computed(() => Math.min(this.pagina() * POR_PAGINA, this.total()));

  protected readonly cantidadFiltros = computed(() => Object.values(this.filtros()).filter(v => v !== null).length);

  // Rango de fechas con el campo de 3 partes (día · mes · año)
  protected readonly desde = new FormControl('', { nonNullable: true });
  protected readonly hasta = new FormControl('', { nonNullable: true });
  protected readonly rangoInvalido = signal(false);

  constructor() {
    this.iniciar();

    // Se filtra solo cuando la fecha está completa y es válida ('' = sin filtro)
    this.desde.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.aplicarRango());
    this.hasta.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.aplicarRango());
  }

  private aplicarRango(): void {
    // Si alguno de los dos está a medio escribir o es inválido, se espera
    if (this.desde.invalid || this.hasta.invalid) {
      return;
    }

    const desde = this.desde.value || null;
    const hasta = this.hasta.value || null;

    // "Hasta" no puede ser anterior a "Desde"
    this.rangoInvalido.set(!!desde && !!hasta && hasta < desde);
    if (this.rangoInvalido()) {
      return;
    }

    const actuales = this.filtros();
    if (actuales.desde === desde && actuales.hasta === hasta) {
      return;
    }

    this.filtros.update(f => ({ ...f, desde, hasta }));
    this.pagina.set(1);
    this.recargar();
  }

  private async iniciar(): Promise<void> {
    this.loading.mostrar();
    try {
      const [opciones, empleados] = await Promise.all([
        this.logService.opcionesFiltros(),
        this.empleadosService.listar(),
      ]);
      this.tablas.set(opciones.tablas);
      this.acciones.set(opciones.acciones);
      this.empleados.set(empleados);
      await this.cargarPagina();
    } catch (error) {
      console.error('Error al cargar el log', error);
      this.mensajeError.set('No pudimos cargar el log de actividad.');
    } finally {
      this.loading.ocultar();
    }
  }

  private async cargarPagina(): Promise<void> {
    this.cargando.set(true);
    try {
      const { filas, total } = await this.logService.listar(this.filtros(), this.pagina(), POR_PAGINA);
      this.filas.set(filas);
      this.total.set(total);
      this.abiertas.set(new Set());
      await this.cargarClientes(filas);
    } finally {
      this.cargando.set(false);
    }
  }

  // Los usuarios que no son empleados se buscan en clientes (si falla, se muestra el id)
  private async cargarClientes(filas: LogActividad[]): Promise<void> {
    const ids = [...new Set(filas.map(f => f.usuario_id))].filter(
      (id): id is string => id !== null && !this.empleadoPorId().has(id) && !this.clientes().has(id),
    );

    try {
      const nuevos = await this.logService.nombresClientes(ids);
      this.clientes.update(actuales => new Map([...actuales, ...nuevos]));
    } catch (error) {
      console.warn('No se pudieron obtener los nombres de los clientes', error);
    }
  }

  private async recargar(): Promise<void> {
    this.mensajeError.set(null);
    this.loading.mostrar();
    try {
      await this.cargarPagina();
    } catch (error) {
      console.error('Error al cargar el log', error);
      this.mensajeError.set('No pudimos cargar el log de actividad.');
    } finally {
      this.loading.ocultar();
    }
  }

  // ---------- Filtros ----------

  protected cambiarFiltro(campo: keyof FiltrosLog, evento: Event): void {
    const valor = (evento.target as HTMLInputElement | HTMLSelectElement).value.trim();
    this.filtros.update(actuales => ({ ...actuales, [campo]: valor || null }));
    this.pagina.set(1);
    this.recargar();
  }

  protected borrarFiltros(): void {
    this.desde.setValue('', { emitEvent: false });
    this.hasta.setValue('', { emitEvent: false });
    this.rangoInvalido.set(false);
    this.filtros.set({ ...SIN_FILTROS });
    this.pagina.set(1);
    this.recargar();
  }

  // ---------- Paginación ----------

  protected irAPagina(pagina: number): void {
    if (pagina < 1 || pagina > this.totalPaginas() || pagina === this.pagina()) {
      return;
    }
    this.pagina.set(pagina);
    this.recargar();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---------- Filas ----------

  protected alternarDetalle(id: number): void {
    this.abiertas.update(actuales => {
      const nuevas = new Set(actuales);
      if (!nuevas.delete(id)) {
        nuevas.add(id);
      }
      return nuevas;
    });
  }

  protected usuario(log: LogActividad): { nombre: string; empleado: Empleado | null; esCliente: boolean } {
    if (log.usuario_id === null) {
      return { nombre: 'Sistema', empleado: null, esCliente: false };
    }

    const empleado = this.empleadoPorId().get(log.usuario_id);
    if (empleado) {
      return { nombre: `${empleado.nombre} ${empleado.apellido}`, empleado, esCliente: false };
    }

    const cliente = this.clientes().get(log.usuario_id);
    if (cliente) {
      return { nombre: cliente, empleado: null, esCliente: true };
    }

    return { nombre: `Usuario ${log.usuario_id.slice(0, 8)}…`, empleado: null, esCliente: false };
  }

  protected tipoAccion(accion: string): 'alta' | 'modificacion' | 'baja' | 'otra' {
    switch (accion.toUpperCase()) {
      case 'INSERT': return 'alta';
      case 'UPDATE': return 'modificacion';
      case 'DELETE': return 'baja';
      default: return 'otra';
    }
  }

  protected cambios(log: LogActividad): CambioCampo[] {
    return cambiosDe(log);
  }

  protected formatear(valor: unknown): string {
    if (valor === null || valor === undefined || valor === '') {
      return '—';
    }
    if (typeof valor === 'boolean') {
      return valor ? 'Sí' : 'No';
    }
    if (typeof valor === 'object') {
      return JSON.stringify(valor);
    }
    return String(valor);
  }

  protected readonly etiquetaAccion = etiquetaAccion;
  protected readonly etiquetaTabla = etiquetaTabla;
}