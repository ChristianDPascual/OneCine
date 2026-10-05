import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SalasService } from '../../../core/services/salas.service';
import { LoadingService } from '../../../core/services/loading.service';
import { EmpleadosService } from '../../../core/services/empleados.service';
import {
  BLOQUES,
  BloqueButaca,
  Butaca,
  DESCRIPCION_FORMATO,
  ETIQUETAS_BLOQUE,
  ETIQUETAS_TIPO_BUTACA,
  Sala,
  TIPOS_BUTACA,
  TipoButaca,
} from '../../../core/models/sala.model';
import { Alerta } from '../../../components/alerta/alerta';

interface FilaMapa {
  fila: string;
  // Por bloque, los lugares 1..máximo: null donde no hay butaca (ej.: fila K accesible)
  bloques: { bloque: BloqueButaca; lugares: (Butaca | null)[] }[];
}

@Component({
  selector: 'app-sala-butacas',
  imports: [RouterLink, Alerta],
  templateUrl: './sala-butacas.html',
  styleUrl: './sala-butacas.css',
})
export class SalaButacas implements OnInit {
  // Parámetro :id de /admin/salas/:id
  readonly id = input.required<string>();

  private readonly salas = inject(SalasService);
  private readonly loading = inject(LoadingService);
  private readonly empleados = inject(EmpleadosService);

  protected readonly sala = signal<Sala | null>(null);
  protected readonly butacas = signal<Butaca[]>([]);
  protected readonly noEncontrada = signal(false);
  protected readonly mensajeError = signal<string | null>(null);
  protected readonly seleccionada = signal<Butaca | null>(null);

  // ---------- Edición de tipos (solo admin y supervisor) ----------
  protected readonly puedeEditar = computed(() => {
    const puesto = this.empleados.actual()?.puesto;
    return puesto === 'admin' || puesto === 'supervisor';
  });
  protected readonly editando = signal(false);
  // Tipo que se aplica al tocar una butaca en modo edición ("pincel")
  protected readonly pincel = signal<TipoButaca>('vip');
  // Butacas que se están guardando (para mostrarlas atenuadas)
  protected readonly guardando = signal(new Set<number>());
  protected readonly mensajeExito = signal<string | null>(null);

  protected readonly tipos = TIPOS_BUTACA;
  protected readonly etiquetasTipo = ETIQUETAS_TIPO_BUTACA;
  protected readonly etiquetasBloque = ETIQUETAS_BLOQUE;
  protected readonly descripcionFormato = DESCRIPCION_FORMATO;

  protected readonly cantidadPorTipo = computed(() => {
    const cantidades = Object.fromEntries(TIPOS_BUTACA.map(t => [t, 0])) as Record<TipoButaca, number>;
    this.butacas().forEach(b => cantidades[b.tipo]++);
    return cantidades;
  });

  // Arma la grilla a partir de las butacas que generó la base (no repite la lógica del trigger)
  protected readonly mapa = computed<FilaMapa[]>(() => {
    const butacas = this.butacas();

    const maximo = Object.fromEntries(
      BLOQUES.map(bloque => [bloque, Math.max(0, ...butacas.filter(b => b.bloque === bloque).map(b => b.numero))]),
    ) as Record<BloqueButaca, number>;

    const porClave = new Map(butacas.map(b => [`${b.fila}-${b.bloque}-${b.numero}`, b]));
    const filas = [...new Set(butacas.map(b => b.fila))].sort();

    return filas.map(fila => ({
      fila,
      bloques: BLOQUES.filter(bloque => maximo[bloque] > 0).map(bloque => ({
        bloque,
        lugares: Array.from({ length: maximo[bloque] }, (_, i) => porClave.get(`${fila}-${bloque}-${i + 1}`) ?? null),
      })),
    }));
  });

  ngOnInit(): void {
    this.cargar();
  }

  private async cargar(): Promise<void> {
    const idNumerico = Number(this.id());
    if (!Number.isInteger(idNumerico)) {
      this.noEncontrada.set(true);
      return;
    }

    this.loading.mostrar();
    try {
      const [sala, butacas] = await Promise.all([
        this.salas.obtener(idNumerico),
        this.salas.butacas(idNumerico),
      ]);

      if (!sala) {
        this.noEncontrada.set(true);
        return;
      }

      this.sala.set(sala);
      this.butacas.set(butacas);
    } catch (error) {
      console.error('Error al cargar las butacas', error);
      this.mensajeError.set('No pudimos cargar las butacas de la sala.');
    } finally {
      this.loading.ocultar();
    }
  }

  protected nombreButaca(butaca: Butaca): string {
    return `Fila ${butaca.fila} · ${ETIQUETAS_BLOQUE[butaca.bloque]} ${butaca.numero} · ${ETIQUETAS_TIPO_BUTACA[butaca.tipo]}`;
  }

  protected elegir(butaca: Butaca): void {
    if (this.editando()) {
      this.cambiarTipo(butaca, this.pincel());
      return;
    }
    this.seleccionada.update(actual => (actual?.id === butaca.id ? null : butaca));
  }

  protected alternarEdicion(): void {
    this.editando.update(valor => !valor);
    this.seleccionada.set(null);
    this.mensajeExito.set(null);
  }

  // Actualización optimista: se pinta al instante y, si la base falla, se vuelve atrás
  protected async cambiarTipo(butaca: Butaca, tipo: TipoButaca): Promise<void> {
    if (!this.puedeEditar() || butaca.tipo === tipo || this.guardando().has(butaca.id)) {
      return;
    }

    const anterior = butaca.tipo;
    this.mensajeError.set(null);
    this.reemplazar(butaca.id, tipo);
    this.guardando.update(ids => new Set(ids).add(butaca.id));

    try {
      await this.salas.cambiarTipoButaca(butaca.id, tipo);
      this.mensajeExito.set(`Fila ${butaca.fila} · ${ETIQUETAS_BLOQUE[butaca.bloque]} ${butaca.numero} ahora es ${ETIQUETAS_TIPO_BUTACA[tipo]}.`);
    } catch (error) {
      console.error('Error al cambiar el tipo de butaca', error);
      this.reemplazar(butaca.id, anterior);
      this.mensajeError.set('No pudimos cambiar el tipo de la butaca. Intentá de nuevo.');
    } finally {
      this.guardando.update(ids => {
        const nuevos = new Set(ids);
        nuevos.delete(butaca.id);
        return nuevos;
      });
    }
  }

  private reemplazar(id: number, tipo: TipoButaca): void {
    this.butacas.update(lista => lista.map(b => (b.id === id ? { ...b, tipo } : b)));
    this.seleccionada.update(actual => (actual?.id === id ? { ...actual, tipo } : actual));
  }
}