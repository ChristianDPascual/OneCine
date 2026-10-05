import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { DescuentosService } from '../../../core/services/descuentos.service';
import { LoadingService } from '../../../core/services/loading.service';
import { ConCambiosSinGuardar } from '../../../core/guards/cambios-sin-guardar.guard';
import { Descuento, esPromocion } from '../../../core/models/descuento.model';
import { Alerta } from '../../../components/alerta/alerta';
import { CampoFecha } from '../../../components/campo-fecha/campo-fecha';
import { rangoFechasValidator } from '../../../validators/rango-fechas.validator';

@Component({
  selector: 'app-promocion-form',
  imports: [ReactiveFormsModule, Alerta, CampoFecha],
  templateUrl: './promocion-form.html',
  styleUrl: './promocion-form.css',
})
export class PromocionForm implements OnInit, ConCambiosSinGuardar {
  // Parámetro :id de /admin/precios/promociones/:id/editar. En "nueva" queda undefined.
  readonly id = input<string>();

  private readonly fb = inject(NonNullableFormBuilder);
  private readonly descuentos = inject(DescuentosService);
  private readonly loading = inject(LoadingService);
  private readonly router = inject(Router);

  protected readonly esEdicion = computed(() => this.id() !== undefined);
  protected readonly noEncontrada = signal(false);
  protected readonly enviando = signal(false);
  protected readonly mensajeError = signal<string | null>(null);

  private guardado = false;

  protected readonly formulario = this.fb.group(
    {
      nombre: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(60)]],
      porcentaje: this.fb.control<number | null>(null, [Validators.required, Validators.min(1), Validators.max(100)]),
      vigente_desde: [''],
      vigente_hasta: [''],
      activo: true,
    },
    // Refleja el CHECK de la base: vigente_hasta >= vigente_desde
    { validators: rangoFechasValidator('vigente_desde', 'vigente_hasta') },
  );

  protected readonly campos = this.formulario.controls;

  ngOnInit(): void {
    this.cargar();
  }

  hayCambiosSinGuardar(): boolean {
    return !this.guardado && this.formulario.dirty;
  }

  private async cargar(): Promise<void> {
    const id = this.id();
    if (id === undefined) {
      return;
    }

    const idNumerico = Number(id);
    if (!Number.isInteger(idNumerico)) {
      this.noEncontrada.set(true);
      return;
    }

    this.loading.mostrar();
    try {
      const promo = await this.descuentos.obtener(idNumerico);

      // Solo se editan promociones: primera compra y edad se configuran en su tarjeta
      if (!promo || !esPromocion(promo)) {
        this.noEncontrada.set(true);
        return;
      }
      this.completarFormulario(promo);
    } catch (error) {
      console.error('Error al cargar la promoción', error);
      this.mensajeError.set('No pudimos cargar la promoción. Recargá la página.');
    } finally {
      this.loading.ocultar();
    }
  }

  private completarFormulario(promo: Descuento): void {
    this.formulario.reset({
      nombre: promo.nombre,
      porcentaje: promo.porcentaje,
      vigente_desde: promo.vigente_desde ?? '',
      vigente_hasta: promo.vigente_hasta ?? '',
      activo: promo.activo,
    });
  }

  protected async guardar(): Promise<void> {
    if (this.enviando()) {
      return;
    }

    this.mensajeError.set(null);

    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.mensajeError.set('Revisá los campos marcados en rojo.');
      return;
    }

    const v = this.formulario.getRawValue();
    if (v.porcentaje === null) {
      return;
    }

    this.enviando.set(true);
    this.loading.mostrar();

    try {
      const id = this.id();
      await this.descuentos.guardar(
        {
          nombre: v.nombre.trim(),
          porcentaje: v.porcentaje,
          es_primera_compra: false,
          edad_minima: null,
          vigente_desde: v.vigente_desde || null,
          vigente_hasta: v.vigente_hasta || null,
          activo: v.activo,
        },
        id !== undefined ? Number(id) : undefined,
      );

      this.guardado = true;
      await this.router.navigate(['/admin/precios'], {
        state: { exito: `La promoción "${v.nombre.trim()}" se ${this.esEdicion() ? 'actualizó' : 'creó'} correctamente.` },
      });
    } catch (error) {
      console.error('Error al guardar la promoción', error);
      this.mensajeError.set(
        (error as { code?: string } | null)?.code === '23514'
          ? 'El porcentaje tiene que estar entre 1 y 100, y la fecha de fin no puede ser anterior a la de inicio.'
          : 'No pudimos guardar la promoción. Revisá tu conexión e intentá de nuevo.',
      );
    } finally {
      this.loading.ocultar();
      this.enviando.set(false);
    }
  }
}