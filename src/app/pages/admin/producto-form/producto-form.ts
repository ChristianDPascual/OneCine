import { Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { ProductosService } from '../../../core/services/productos.service';
import { CategoriasProductoService } from '../../../core/services/categorias-producto.service';
import { LoadingService } from '../../../core/services/loading.service';
import { ConCambiosSinGuardar } from '../../../core/guards/cambios-sin-guardar.guard';
import { CategoriaProducto, Producto, ProductoGuardar } from '../../../core/models/producto.model';
import { Alerta } from '../../../components/alerta/alerta';

const LARGO_DESCRIPCION = 300;
const TIPOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp'];
const PESO_MAXIMO_MB = 5;

// Nombre visible y id del elemento de cada campo (para el resumen de errores)
const CAMPOS: Record<string, { etiqueta: string; elemento: string }> = {
  nombre: { etiqueta: 'Nombre', elemento: 'prod-nombre' },
  categoria_id: { etiqueta: 'Categoría', elemento: 'prod-categoria' },
  precio: { etiqueta: 'Precio', elemento: 'prod-precio' },
  descripcion: { etiqueta: 'Descripción', elemento: 'prod-descripcion' },
  puntos_canje: { etiqueta: 'Puntos para canjear', elemento: 'prod-puntos' },
};

@Component({
  selector: 'app-producto-form',
  imports: [ReactiveFormsModule, RouterLink, Alerta],
  templateUrl: './producto-form.html',
  styleUrl: './producto-form.css',
})
export class ProductoForm implements OnInit, ConCambiosSinGuardar {
  // Parámetro :id de /admin/productos/:id/editar (withComponentInputBinding). En "nuevo" queda undefined.
  readonly id = input<string>();

  private readonly fb = inject(NonNullableFormBuilder);
  private readonly productos = inject(ProductosService);
  private readonly categoriasService = inject(CategoriasProductoService);
  private readonly loading = inject(LoadingService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly esEdicion = computed(() => this.id() !== undefined);
  protected readonly largoMaximoDescripcion = LARGO_DESCRIPCION;

  protected readonly categorias = signal<CategoriaProducto[]>([]);
  protected readonly noEncontrado = signal(false);
  protected readonly enviando = signal(false);
  protected readonly mensajeError = signal<string | null>(null);
  protected readonly cargado = signal(false);
  protected readonly camposInvalidos = signal<string[]>([]);

  // ---------- Imagen ----------
  protected readonly tiposImagen = TIPOS_IMAGEN.join(',');
  protected readonly pesoMaximoMb = PESO_MAXIMO_MB;
  protected readonly imagenGuardada = signal<string | null>(null);
  protected readonly archivoImagen = signal<File | null>(null);
  protected readonly previaLocal = signal<string | null>(null);
  protected readonly errorImagen = signal<string | null>(null);
  protected readonly arrastrando = signal(false);
  protected readonly vistaPrevia = computed(() => this.previaLocal() ?? this.imagenGuardada());

  private guardado = false;

  protected readonly formulario = this.fb.group({
    nombre: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(80)]],
    categoria_id: this.fb.control<number | null>(null, Validators.required),
    precio: this.fb.control<number | null>(null, [Validators.required, Validators.min(0)]),
    descripcion: ['', Validators.maxLength(LARGO_DESCRIPCION)],
    activo: true,
    canjeable: false,
    // Deshabilitado hasta marcar "Se puede canjear con puntos": así no cuenta para la validez
    puntos_canje: this.fb.control<number | null>({ value: null, disabled: true }, [
      Validators.required,
      Validators.min(1),
      Validators.pattern(/^\d+$/),
    ]),
  });

  protected readonly campos = this.formulario.controls;

  protected readonly largoDescripcion = toSignal(
    this.campos.descripcion.valueChanges.pipe(map(texto => texto.length)),
    { initialValue: 0 },
  );
  protected readonly canjeable = toSignal(this.campos.canjeable.valueChanges, { initialValue: false });

  constructor() {
    // El interruptor de canje habilita o deshabilita los puntos
    this.campos.canjeable.valueChanges.pipe(takeUntilDestroyed()).subscribe(canjeable => {
      if (canjeable) {
        this.campos.puntos_canje.enable();
      } else {
        this.campos.puntos_canje.disable();
      }
    });

    // Si ya se mostró el resumen de errores, se actualiza mientras el usuario corrige
    this.formulario.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      if (this.camposInvalidos().length > 0) {
        this.camposInvalidos.set(this.listarInvalidos());
      }
    });

    this.destroyRef.onDestroy(() => this.liberarPrevia());
  }

  ngOnInit(): void {
    this.cargar();
  }

  hayCambiosSinGuardar(): boolean {
    return !this.guardado && this.formulario.dirty;
  }

  private async cargar(): Promise<void> {
    const id = this.id();
    const idNumerico = Number(id);

    if (id !== undefined && !Number.isInteger(idNumerico)) {
      this.noEncontrado.set(true);
      return;
    }

    this.loading.mostrar();
    try {
      const [categorias, producto] = await Promise.all([
        this.categoriasService.listar(),
        id !== undefined ? this.productos.obtener(idNumerico) : Promise.resolve(null),
      ]);

      this.categorias.set(categorias);

      if (id !== undefined) {
        if (!producto) {
          this.noEncontrado.set(true);
          return;
        }
        this.completarFormulario(producto);
      }
    } catch (error) {
      console.error('Error al cargar el producto', error);
      this.mensajeError.set('No pudimos cargar los datos. Recargá la página.');
    } finally {
      this.loading.ocultar();
      this.cargado.set(true);
    }
  }

  private completarFormulario(producto: Producto): void {
    this.formulario.patchValue({
      nombre: producto.nombre,
      categoria_id: producto.categoria_id,
      precio: producto.precio,
      descripcion: producto.descripcion ?? '',
      activo: producto.activo,
      canjeable: producto.puntos_canje !== null,
      puntos_canje: producto.puntos_canje,
    });

    this.imagenGuardada.set(producto.imagen_url);
    this.formulario.markAsPristine();
  }

  // ---------- Imagen ----------

  protected alElegirArchivo(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    this.usarArchivo(input.files?.[0] ?? null);
    input.value = '';
  }

  protected alSoltar(evento: DragEvent): void {
    evento.preventDefault();
    this.arrastrando.set(false);
    this.usarArchivo(evento.dataTransfer?.files[0] ?? null);
  }

  protected alArrastrar(evento: DragEvent): void {
    evento.preventDefault();
    this.arrastrando.set(true);
  }

  protected quitarImagen(): void {
    this.liberarPrevia();
    this.archivoImagen.set(null);
    this.imagenGuardada.set(null);
    this.errorImagen.set(null);
    this.formulario.markAsDirty();
  }

  private usarArchivo(archivo: File | null): void {
    if (!archivo) {
      return;
    }

    if (!TIPOS_IMAGEN.includes(archivo.type)) {
      this.errorImagen.set('El archivo tiene que ser una imagen JPG, PNG o WEBP.');
      return;
    }
    if (archivo.size > PESO_MAXIMO_MB * 1024 * 1024) {
      this.errorImagen.set(`La imagen no puede pesar más de ${PESO_MAXIMO_MB} MB.`);
      return;
    }

    this.errorImagen.set(null);
    this.liberarPrevia();
    this.archivoImagen.set(archivo);
    this.previaLocal.set(URL.createObjectURL(archivo));
    this.formulario.markAsDirty();
  }

  private liberarPrevia(): void {
    const previa = this.previaLocal();
    if (previa) {
      URL.revokeObjectURL(previa);
      this.previaLocal.set(null);
    }
  }

  // ---------- Errores de validación ----------

  private listarInvalidos(): string[] {
    return Object.keys(CAMPOS)
      .filter(nombre => this.formulario.get(nombre)?.invalid)
      .map(nombre => CAMPOS[nombre].etiqueta);
  }

  private irAlPrimerError(): void {
    const primero = Object.keys(CAMPOS).find(nombre => this.formulario.get(nombre)?.invalid);
    if (!primero) {
      return;
    }

    const elemento = document.getElementById(CAMPOS[primero].elemento);
    elemento?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    elemento?.focus({ preventScroll: true });
  }

  // ---------- Guardar ----------

  protected async guardar(): Promise<void> {
    if (this.enviando()) {
      return;
    }

    this.mensajeError.set(null);

    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.camposInvalidos.set(this.listarInvalidos());
      this.irAlPrimerError();
      return;
    }

    this.camposInvalidos.set([]);

    const v = this.formulario.getRawValue();
    if (v.categoria_id === null || v.precio === null) {
      return;
    }

    this.enviando.set(true);
    this.loading.mostrar();

    try {
      // 1. Si se eligió una imagen nueva, primero se sube a Storage
      const archivo = this.archivoImagen();
      let imagenUrl = this.imagenGuardada();

      if (archivo) {
        try {
          imagenUrl = await this.productos.subirImagen(archivo);
        } catch (error) {
          console.error('Error al subir la imagen', error);
          this.mensajeError.set('No pudimos subir la imagen. Verificá que exista el bucket "productos" e intentá de nuevo.');
          return;
        }
      }

      // 2. Se guarda el producto
      const datos: ProductoGuardar = {
        nombre: v.nombre.trim(),
        categoria_id: v.categoria_id,
        precio: v.precio,
        descripcion: v.descripcion.trim() || null,
        imagen_url: imagenUrl,
        activo: v.activo,
        puntos_canje: v.canjeable ? v.puntos_canje : null,
      };

      const id = this.id();
      await this.productos.guardar(datos, id !== undefined ? Number(id) : undefined);

      this.guardado = true;
      await this.router.navigate(['/admin/productos'], {
        state: { exito: `"${datos.nombre}" se ${this.esEdicion() ? 'actualizó' : 'creó'} correctamente.` },
      });
    } catch (error) {
      console.error('Error al guardar el producto', error);
      this.mensajeError.set(this.traducirError(error));
    } finally {
      this.loading.ocultar();
      this.enviando.set(false);
    }
  }

  private traducirError(error: unknown): string {
    switch ((error as { code?: string } | null)?.code) {
      case '23514':
        return 'Algún valor no cumple las reglas de la base (el precio no puede ser negativo y los puntos tienen que ser mayores a 0).';
      case '23503':
        return 'La categoría elegida ya no existe. Recargá la página.';
      case '23502':
        return 'Falta completar un dato obligatorio.';
      default:
        return 'No pudimos guardar el producto. Revisá tu conexión e intentá de nuevo.';
    }
  }
}