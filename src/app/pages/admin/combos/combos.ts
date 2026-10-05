import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CombosService } from '../../../core/services/combos.service';
import { LoadingService } from '../../../core/services/loading.service';
import { ConfirmacionService } from '../../../core/services/confirmacion.service';
import { ConfiguracionService } from '../../../core/services/configuracion.service';
import { ComboAdmin, precioPorSeparado } from '../../../core/models/combo.model';
import { Alerta } from '../../../components/alerta/alerta';

type Estado = 'activos' | 'inactivos';

@Component({
  selector: 'app-combos',
  imports: [RouterLink, CurrencyPipe, Alerta],
  templateUrl: './combos.html',
  styleUrl: './combos.css',
})
export class Combos {
  private readonly combosService = inject(CombosService);
  private readonly loading = inject(LoadingService);
  private readonly confirmacion = inject(ConfirmacionService);
  private readonly configuracionService = inject(ConfiguracionService);

  protected readonly combos = signal<ComboAdmin[]>([]);
  protected readonly mensajeError = signal<string | null>(null);
  protected readonly mensajeExito = signal<string | null>(history.state?.exito ?? null);

  // Precio sugerido de la entrada de estreno ("Precios y promos"): referencia para el ahorro
  protected readonly precioEntrada = signal<number | null>(null);

  // ---------- Filtros (en el navegador: el panel ya tiene todo cargado) ----------
  protected readonly busqueda = signal('');
  protected readonly estado = signal<Estado | null>(null);
  protected readonly soloDestacados = signal(false);
  protected readonly soloConEntrada = signal(false);

  protected readonly opcionesEstado: { valor: Estado; etiqueta: string }[] = [
    { valor: 'activos', etiqueta: 'Activos' },
    { valor: 'inactivos', etiqueta: 'Inactivos' },
  ];

  protected readonly cantidadFiltros = computed(() =>
    [this.busqueda().trim() !== '', this.estado() !== null, this.soloDestacados(), this.soloConEntrada()]
      .filter(Boolean).length,
  );

  protected readonly filtrados = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();
    const estado = this.estado();

    return this.combos().filter(c =>
      (!texto || c.nombre.toLowerCase().includes(texto)) &&
      (estado === null || c.activo === (estado === 'activos')) &&
      (!this.soloDestacados() || c.destacado) &&
      (!this.soloConEntrada() || c.incluye_entrada),
    );
  });

  constructor() {
    this.cargar();
  }

  private async cargar(): Promise<void> {
    this.loading.mostrar();
    try {
      const [combos, configuracion] = await Promise.all([
        this.combosService.listar(),
        this.configuracionService.obtener(),
      ]);
      this.combos.set(combos);
      this.precioEntrada.set(configuracion?.precio_estreno ?? null);
    } catch (error) {
      console.error('Error al cargar combos', error);
      this.mensajeError.set('No pudimos cargar los combos.');
    } finally {
      this.loading.ocultar();
    }
  }

  // ---------- Datos calculados de cada tarjeta ----------

  protected contenido(combo: ComboAdmin): string {
    return combo.items.map(i => `${i.cantidad}× ${i.producto.nombre}`).join(' · ');
  }

  // Ahorro frente a comprar todo por separado.
  // Si el combo incluye entrada, se suma el precio sugerido de estreno (el real depende de la función).
  protected ahorro(combo: ComboAdmin): number {
    const entrada = combo.incluye_entrada ? (this.precioEntrada() ?? 0) : 0;
    return precioPorSeparado(combo.items) + entrada - combo.precio;
  }

  // El ahorro de un combo con entrada solo se puede calcular si hay precio sugerido
  protected ahorroCalculable(combo: ComboAdmin): boolean {
    return !combo.incluye_entrada || this.precioEntrada() !== null;
  }

  // ---------- Filtros ----------

  protected elegirEstado(valor: Estado): void {
    this.estado.update(actual => (actual === valor ? null : valor));
  }

  protected borrarFiltros(): void {
    this.busqueda.set('');
    this.estado.set(null);
    this.soloDestacados.set(false);
    this.soloConEntrada.set(false);
  }

  // ---------- Acciones ----------

  protected async alternarDestacado(combo: ComboAdmin): Promise<void> {
    await this.actualizar(
      combo,
      { destacado: !combo.destacado },
      combo.destacado ? `"${combo.nombre}" ya no aparece destacado.` : `"${combo.nombre}" ahora aparece destacado en la compra.`,
    );
  }

  protected async alternarActivo(combo: ComboAdmin): Promise<void> {
    if (combo.activo) {
      const confirmado = await this.confirmacion.preguntar({
        titulo: '¿Desactivar combo?',
        mensaje: `"${combo.nombre}" va a dejar de ofrecerse en la compra.`,
        textoConfirmar: 'Desactivar',
        textoCancelar: 'Cancelar',
      });

      if (!confirmado) {
        return;
      }
    }

    await this.actualizar(
      combo,
      { activo: !combo.activo },
      combo.activo ? `"${combo.nombre}" fue desactivado.` : `"${combo.nombre}" vuelve a estar disponible.`,
    );
  }

  private async actualizar(combo: ComboAdmin, cambios: Partial<Pick<ComboAdmin, 'activo' | 'destacado'>>, exito: string): Promise<void> {
    this.mensajeError.set(null);
    this.mensajeExito.set(null);
    this.loading.mostrar();

    try {
      await this.combosService.actualizar(combo.id, cambios);
      this.combos.update(lista => lista.map(c => (c.id === combo.id ? { ...c, ...cambios } : c)));
      this.mensajeExito.set(exito);
    } catch (error) {
      console.error('Error al actualizar el combo', error);
      this.mensajeError.set('No pudimos actualizar el combo.');
    } finally {
      this.loading.ocultar();
    }
  }
}