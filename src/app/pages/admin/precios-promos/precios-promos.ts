import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ConfiguracionService } from '../../../core/services/configuracion.service';
import { DescuentosService } from '../../../core/services/descuentos.service';
import { LoadingService } from '../../../core/services/loading.service';
import { Configuracion } from '../../../core/models/configuracion.model';
import {
  Descuento,
  EstadoPromocion,
  esPorEdad,
  esPrimeraCompra,
  esPromocion,
  estadoPromocion,
} from '../../../core/models/descuento.model';
import { Alerta } from '../../../components/alerta/alerta';

type Tarjeta = 'precios' | 'primeraCompra' | 'mayores' | 'puntos';
type EstadoTarjeta = 'guardando' | 'ok' | 'error' | null;

const ENTERO = Validators.pattern(/^\d+$/);

@Component({
  selector: 'app-precios-promos',
  imports: [ReactiveFormsModule, RouterLink, DatePipe, Alerta],
  templateUrl: './precios-promos.html',
  styleUrl: './precios-promos.css',
})
export class PreciosPromos {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly configuracionService = inject(ConfiguracionService);
  private readonly descuentosService = inject(DescuentosService);
  private readonly loading = inject(LoadingService);

  protected readonly mensajeError = signal<string | null>(null);
  protected readonly mensajeExito = signal<string | null>(history.state?.exito ?? null);
  protected readonly sinConfiguracion = signal(false);

  private readonly descuentos = signal<Descuento[]>([]);
  protected readonly primeraCompra = computed(() => this.descuentos().find(esPrimeraCompra) ?? null);
  protected readonly mayores = computed(() => this.descuentos().find(esPorEdad) ?? null);
  protected readonly promociones = computed(() => this.descuentos().filter(esPromocion));

  // Estado de guardado de cada tarjeta (cada una se guarda por separado)
  protected readonly estado = signal<Record<Tarjeta, EstadoTarjeta>>({
    precios: null,
    primeraCompra: null,
    mayores: null,
    puntos: null,
  });

  // ---------- Formularios ----------

  protected readonly formPrecios = this.fb.group({
    precio_estreno: this.fb.control<number | null>(null, [Validators.required, Validators.min(1)]),
    precio_clasico: this.fb.control<number | null>(null, [Validators.required, Validators.min(1)]),
  });

  protected readonly formPrimeraCompra = this.fb.group({
    porcentaje: this.fb.control<number | null>(20, [Validators.required, Validators.min(1), Validators.max(100)]),
    activo: true,
  });

  protected readonly formMayores = this.fb.group({
    edad_minima: this.fb.control<number | null>(50, [Validators.required, Validators.min(18), Validators.max(120), ENTERO]),
    porcentaje: this.fb.control<number | null>(null, [Validators.required, Validators.min(1), Validators.max(100)]),
    activo: true,
  });

  protected readonly formPuntos = this.fb.group({
    puntos_por_peso: this.fb.control<number | null>(null, [Validators.required, Validators.min(0), ENTERO]),
    puntos_entrada_gratis: this.fb.control<number | null>(null, [Validators.required, Validators.min(1), ENTERO]),
    recargo_vip: this.fb.control<number | null>(null, [Validators.required, Validators.min(0), ENTERO]),
    horas_limite_cancelacion: this.fb.control<number | null>(null, [Validators.required, Validators.min(0), Validators.max(72), ENTERO]),
  });

  constructor() {
    this.cargar();
  }

  private async cargar(): Promise<void> {
    this.loading.mostrar();
    try {
      const [configuracion, descuentos] = await Promise.all([
        this.configuracionService.obtener(),
        this.descuentosService.listar(),
      ]);

      this.descuentos.set(descuentos);
      this.completarConfiguracion(configuracion);
      this.completarBeneficios();
    } catch (error) {
      console.error('Error al cargar precios y promos', error);
      this.mensajeError.set('No pudimos cargar la configuración.');
    } finally {
      this.loading.ocultar();
    }
  }

  private completarConfiguracion(configuracion: Configuracion | null): void {
    if (!configuracion) {
      this.sinConfiguracion.set(true);
      return;
    }

    this.formPrecios.reset({
      precio_estreno: configuracion.precio_estreno,
      precio_clasico: configuracion.precio_clasico,
    });
    this.formPuntos.reset({
      puntos_por_peso: configuracion.puntos_por_peso,
      puntos_entrada_gratis: configuracion.puntos_entrada_gratis,
      recargo_vip: configuracion.recargo_vip,
      horas_limite_cancelacion: configuracion.horas_limite_cancelacion,
    });
  }

  private completarBeneficios(): void {
    const primera = this.primeraCompra();
    if (primera) {
      this.formPrimeraCompra.reset({ porcentaje: primera.porcentaje, activo: primera.activo });
    }

    const mayores = this.mayores();
    if (mayores) {
      this.formMayores.reset({ edad_minima: mayores.edad_minima, porcentaje: mayores.porcentaje, activo: mayores.activo });
    }
  }

  // ---------- Guardar cada tarjeta ----------

  protected guardarPrecios(): Promise<void> {
    return this.guardarTarjeta('precios', this.formPrecios, async () => {
      const v = this.formPrecios.getRawValue();
      await this.configuracionService.actualizar({ precio_estreno: v.precio_estreno, precio_clasico: v.precio_clasico });
    });
  }

  protected guardarPuntos(): Promise<void> {
    return this.guardarTarjeta('puntos', this.formPuntos, async () => {
      const v = this.formPuntos.getRawValue();
      await this.configuracionService.actualizar({
        puntos_por_peso: v.puntos_por_peso ?? 0,
        puntos_entrada_gratis: v.puntos_entrada_gratis ?? 0,
        recargo_vip: v.recargo_vip ?? 0,
        horas_limite_cancelacion: v.horas_limite_cancelacion ?? 0,
      });
    });
  }

  // Si todavía no existe la fila del beneficio, se crea; si existe, se actualiza
  protected guardarPrimeraCompra(): Promise<void> {
    return this.guardarTarjeta('primeraCompra', this.formPrimeraCompra, async () => {
      const v = this.formPrimeraCompra.getRawValue();
      await this.descuentosService.guardar(
        {
          nombre: 'Primera compra',
          porcentaje: v.porcentaje ?? 0,
          es_primera_compra: true,
          edad_minima: null,
          activo: v.activo,
        },
        this.primeraCompra()?.id,
      );
    });
  }

  protected guardarMayores(): Promise<void> {
    return this.guardarTarjeta('mayores', this.formMayores, async () => {
      const v = this.formMayores.getRawValue();
      await this.descuentosService.guardar(
        {
          nombre: `Mayores de ${v.edad_minima} años`,
          porcentaje: v.porcentaje ?? 0,
          es_primera_compra: false,
          edad_minima: v.edad_minima,
          activo: v.activo,
        },
        this.mayores()?.id,
      );
    });
  }

  // Valida, guarda, muestra el resultado en la tarjeta y recarga los descuentos
  private async guardarTarjeta(
    tarjeta: Tarjeta,
    formulario: { invalid: boolean; markAllAsTouched(): void; markAsPristine(): void },
    operacion: () => Promise<void>,
  ): Promise<void> {
    if (formulario.invalid) {
      formulario.markAllAsTouched();
      return;
    }

    this.cambiarEstado(tarjeta, 'guardando');
    try {
      await operacion();
      formulario.markAsPristine();
      this.descuentos.set(await this.descuentosService.listar());
      this.cambiarEstado(tarjeta, 'ok');
    } catch (error) {
      console.error(`Error al guardar ${tarjeta}`, error);
      this.cambiarEstado(tarjeta, 'error');
    }
  }

  private cambiarEstado(tarjeta: Tarjeta, valor: EstadoTarjeta): void {
    this.estado.update(actual => ({ ...actual, [tarjeta]: valor }));
  }

  // ---------- Promociones ----------

  protected estadoDe(promo: Descuento): EstadoPromocion {
    return estadoPromocion(promo);
  }

  protected async alternarActiva(promo: Descuento): Promise<void> {
    this.mensajeError.set(null);
    this.mensajeExito.set(null);
    this.loading.mostrar();
    try {
      await this.descuentosService.guardar({ activo: !promo.activo }, promo.id);
      this.descuentos.update(lista => lista.map(d => (d.id === promo.id ? { ...d, activo: !d.activo } : d)));
      this.mensajeExito.set(`"${promo.nombre}" ${promo.activo ? 'fue desactivada' : 'está activa'}.`);
    } catch (error) {
      console.error('Error al actualizar la promoción', error);
      this.mensajeError.set('No pudimos actualizar la promoción.');
    } finally {
      this.loading.ocultar();
    }
  }
}