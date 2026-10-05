import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CategoriasProductoService } from '../../../core/services/categorias-producto.service';
import { LoadingService } from '../../../core/services/loading.service';
import { ConfirmacionService } from '../../../core/services/confirmacion.service';
import { CategoriaConCantidad } from '../../../core/models/producto.model';
import { Alerta } from '../../../components/alerta/alerta';

const VALIDADORES_NOMBRE = [Validators.required, Validators.pattern(/\S/), Validators.maxLength(40)];

@Component({
  selector: 'app-categorias-producto',
  imports: [ReactiveFormsModule, Alerta],
  templateUrl: './categorias-producto.html',
  styleUrl: './categorias-producto.css',
})
export class CategoriasProducto {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly categoriasService = inject(CategoriasProductoService);
  private readonly loading = inject(LoadingService);
  private readonly confirmacion = inject(ConfirmacionService);

  protected readonly categorias = signal<CategoriaConCantidad[]>([]);
  protected readonly mensajeError = signal<string | null>(null);
  protected readonly mensajeExito = signal<string | null>(null);

  // Alta (un FormGroup de un campo, para que el <form> use ngSubmit sin recargar)
  protected readonly formNueva = this.fb.group({ nombre: ['', VALIDADORES_NOMBRE] });
  protected readonly nueva = this.formNueva.controls.nombre;

  // Edición en línea: una categoría por vez
  protected readonly editandoId = signal<number | null>(null);
  protected readonly formEdicion = this.fb.group({ nombre: ['', VALIDADORES_NOMBRE] });
  protected readonly edicion = this.formEdicion.controls.nombre;

  constructor() {
    this.cargar();
  }

  private async cargar(): Promise<void> {
    this.loading.mostrar();
    try {
      this.categorias.set(await this.categoriasService.listar());
    } catch (error) {
      console.error('Error al cargar categorías', error);
      this.mensajeError.set('No pudimos cargar las categorías.');
    } finally {
      this.loading.ocultar();
    }
  }

  // Evita dos categorías con el mismo nombre (sin distinguir mayúsculas)
  private nombreRepetido(nombre: string, excepto?: number): boolean {
    const buscado = nombre.trim().toLowerCase();
    return this.categorias().some(c => c.id !== excepto && c.nombre.trim().toLowerCase() === buscado);
  }

  private limpiarMensajes(): void {
    this.mensajeError.set(null);
    this.mensajeExito.set(null);
  }

  // ---------- Alta ----------

  protected async agregar(): Promise<void> {
    this.limpiarMensajes();

    if (this.nueva.invalid) {
      this.nueva.markAsTouched();
      return;
    }

    const nombre = this.nueva.value.trim();
    if (this.nombreRepetido(nombre)) {
      this.mensajeError.set(`Ya existe la categoría "${nombre}".`);
      return;
    }

    await this.ejecutar(async () => {
      // Se agrega al final de la carta
      await this.categoriasService.crear(nombre, this.categorias().length);
      this.formNueva.reset();
      this.mensajeExito.set(`Se creó la categoría "${nombre}".`);
    }, 'No pudimos crear la categoría.');
  }

  // ---------- Renombrar ----------

  protected empezarEdicion(categoria: CategoriaConCantidad): void {
    this.limpiarMensajes();
    this.editandoId.set(categoria.id);
    this.edicion.reset(categoria.nombre);
  }

  protected cancelarEdicion(): void {
    this.editandoId.set(null);
  }

  protected async guardarEdicion(categoria: CategoriaConCantidad): Promise<void> {
    this.limpiarMensajes();

    if (this.edicion.invalid) {
      this.edicion.markAsTouched();
      return;
    }

    const nombre = this.edicion.value.trim();
    if (nombre === categoria.nombre) {
      this.editandoId.set(null);
      return;
    }
    if (this.nombreRepetido(nombre, categoria.id)) {
      this.mensajeError.set(`Ya existe la categoría "${nombre}".`);
      return;
    }

    await this.ejecutar(async () => {
      await this.categoriasService.renombrar(categoria.id, nombre);
      this.editandoId.set(null);
      this.mensajeExito.set(`"${categoria.nombre}" ahora se llama "${nombre}".`);
    }, 'No pudimos renombrar la categoría.');
  }

  // ---------- Orden ----------

  protected async mover(indice: number, direccion: -1 | 1): Promise<void> {
    this.limpiarMensajes();

    const lista = [...this.categorias()];
    const destino = indice + direccion;
    if (destino < 0 || destino >= lista.length) {
      return;
    }

    [lista[indice], lista[destino]] = [lista[destino], lista[indice]];

    await this.ejecutar(
      () => this.categoriasService.guardarOrden(lista),
      'No pudimos cambiar el orden.',
    );
  }

  // ---------- Eliminar ----------

  protected async eliminar(categoria: CategoriaConCantidad): Promise<void> {
    this.limpiarMensajes();

    const confirmado = await this.confirmacion.preguntar({
      titulo: '¿Eliminar categoría?',
      mensaje: `Se va a eliminar "${categoria.nombre}". Esta acción no se puede deshacer.`,
      textoConfirmar: 'Eliminar',
      textoCancelar: 'Cancelar',
    });

    if (!confirmado) {
      return;
    }

    await this.ejecutar(async () => {
      await this.categoriasService.eliminar(categoria.id);
      this.mensajeExito.set(`Se eliminó la categoría "${categoria.nombre}".`);
    }, 'No pudimos eliminar la categoría.');
  }

  // Ejecuta una operación con el spinner, traduce errores y recarga la lista
  private async ejecutar(operacion: () => Promise<void>, mensajeFallo: string): Promise<void> {
    this.loading.mostrar();
    try {
      await operacion();
    } catch (error) {
      console.error(mensajeFallo, error);
      const codigo = (error as { code?: string } | null)?.code;
      this.mensajeError.set(
        codigo === '23503'
          ? 'La categoría tiene productos asociados. Primero pasalos a otra categoría.'
          : mensajeFallo,
      );
    } finally {
      this.loading.ocultar();
    }
    await this.cargar();
  }
}