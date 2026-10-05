import { Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CurrencyPipe } from '@angular/common';
import { Router } from '@angular/router';
import { CombosService } from '../../../core/services/combos.service';
import { ProductosService } from '../../../core/services/productos.service';
import { CategoriasProductoService } from '../../../core/services/categorias-producto.service';
import { ConfiguracionService } from '../../../core/services/configuracion.service';
import { LoadingService } from '../../../core/services/loading.service';
import { ConCambiosSinGuardar } from '../../../core/guards/cambios-sin-guardar.guard';
import { ComboAdmin, ComboGuardar, ItemComboGuardar } from '../../../core/models/combo.model';
import { CategoriaProducto, Producto } from '../../../core/models/producto.model';
import { Alerta } from '../../../components/alerta/alerta';
import { seleccionMinimaValidator } from '../../../validators/seleccion-minima.validator';

const LARGO_DESCRIPCION = 300;
const CANTIDAD_MAXIMA = 20;
const TIPOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp'];
const PESO_MAXIMO_MB = 5;

const CAMPOS: Record<string, { etiqueta: string; elemento: string }> = {
  nombre: { etiqueta: 'Nombre', elemento: 'combo-nombre' },
  precio: { etiqueta: 'Precio', elemento: 'combo-precio' },
  descripcion: { etiqueta: 'Descripción', elemento: 'combo-descripcion' },
  items: { etiqueta: 'Productos del combo', elemento: 'combo-productos' },
};

type ReferenciaEntrada = 'estreno' | 'clasico';

interface GrupoProductos {
  categoria: CategoriaProducto;
  productos: Producto[];
}

@Component({
  selector: 'app-combo-form',
  imports: [ReactiveFormsModule, CurrencyPipe, Alerta],
  templateUrl: './combo-form.html',
  styleUrl: './combo-form.css',
})
export class ComboForm implements OnInit, ConCambiosSinGuardar {
  // Parámetro :id de /admin/combos/:id/editar (withComponentInputBinding). En "nuevo" queda undefined.
  readonly id = input<string>();

  private readonly fb = inject(NonNullableFormBuilder);
  private readonly combos = inject(CombosService);
  private readonly productosService = inject(ProductosService);
  private readonly categoriasService = inject(CategoriasProductoService);
  private readonly configuracionService = inject(ConfiguracionService);
  private readonly loading = inject(LoadingService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly esEdicion = computed(() => this.id() !== undefined);
  protected readonly largoMaximoDescripcion = LARGO_DESCRIPCION;
  protected readonly cantidadMaxima = CANTIDAD_MAXIMA;

  protected readonly productos = signal<Producto[]>([]);
  protected readonly categorias = signal<CategoriaProducto[]>([]);
  protected readonly noEncontrado = signal(false);
  protected readonly enviando = signal(false);
  protected readonly mensajeError = signal<string | null>(null);
  protected readonly camposInvalidos = signal<string[]>([]);
  protected readonly busquedaProducto = signal('');

  // ---------- Entrada (precios sugeridos de "Precios y promos") ----------
  protected readonly precioEntradaEstreno = signal<number | null>(null);
  protected readonly precioEntradaClasico = signal<number | null>(null);
  // Solo para el cálculo del resumen: no se guarda en el combo
  protected readonly referenciaEntrada = signal<ReferenciaEntrada>('estreno');

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
    descripcion: ['', Validators.maxLength(LARGO_DESCRIPCION)],
    precio: this.fb.control<number | null>(null, [Validators.required, Validators.min(1)]),
    incluye_entrada: true,
    destacado: false,
    activo: true,
    // Lista de { producto_id, cantidad }: al menos un producto
    items: this.fb.control<ItemComboGuardar[]>([], seleccionMinimaValidator(1)),
  });

  protected readonly campos = this.formulario.controls;

  // Observables del formulario convertidos en signals para los cálculos en pantalla
  private readonly items = toSignal(this.campos.items.valueChanges, { initialValue: this.campos.items.value });
  protected readonly precio = toSignal(this.campos.precio.valueChanges, { initialValue: this.campos.precio.value });
  protected readonly incluyeEntrada = toSignal(this.campos.incluye_entrada.valueChanges, { initialValue: true });
  protected readonly largoDescripcion = toSignal(this.campos.descripcion.valueChanges, { initialValue: '' });

  private readonly productoPorId = computed(() => new Map(this.productos().map(p => [p.id, p])));

  // Productos elegidos, con sus datos, en el orden en que se agregaron
  protected readonly seleccion = computed(() =>
    this.items()
      .map(item => ({ producto: this.productoPorId().get(item.producto_id), cantidad: item.cantidad }))
      .filter((item): item is { producto: Producto; cantidad: number } => item.producto !== undefined),
  );

  // Precio de la entrada que se usa como referencia (null si el combo no la incluye o no está configurado)
  protected readonly precioEntrada = computed(() => {
    if (!this.incluyeEntrada()) {
      return null;
    }
    return this.referenciaEntrada() === 'clasico' ? this.precioEntradaClasico() : this.precioEntradaEstreno();
  });

  protected readonly precioProductos = computed(() =>
    this.seleccion().reduce((total, item) => total + item.producto.precio * item.cantidad, 0),
  );

  protected readonly precioSeparado = computed(() => this.precioProductos() + (this.precioEntrada() ?? 0));

  protected readonly ahorro = computed(() => this.precioSeparado() - (this.precio() ?? 0));

  protected readonly porcentajeAhorro = computed(() =>
    this.precioSeparado() > 0 ? Math.round((this.ahorro() / this.precioSeparado()) * 100) : 0,
  );

  // Productos disponibles para elegir, agrupados por categoría.
  // Los inactivos solo aparecen si ya forman parte del combo.
  protected readonly grupos = computed<GrupoProductos[]>(() => {
    const texto = this.busquedaProducto().trim().toLowerCase();
    const elegidos = new Set(this.items().map(i => i.producto_id));

    return this.categorias()
      .map(categoria => ({
        categoria,
        productos: this.productos().filter(p =>
          p.categoria_id === categoria.id &&
          (p.activo || elegidos.has(p.id)) &&
          (!texto || p.nombre.toLowerCase().includes(texto)),
        ),
      }))
      .filter(grupo => grupo.productos.length > 0);
  });

  constructor() {
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
      const [productos, categorias, configuracion, combo] = await Promise.all([
        this.productosService.listar(),
        this.categoriasService.listar(),
        this.configuracionService.obtener(),
        id !== undefined ? this.combos.obtener(idNumerico) : Promise.resolve(null),
      ]);

      this.productos.set(productos);
      this.categorias.set(categorias);
      this.precioEntradaEstreno.set(configuracion?.precio_estreno ?? null);
      this.precioEntradaClasico.set(configuracion?.precio_clasico ?? null);

      if (id !== undefined) {
        if (!combo) {
          this.noEncontrado.set(true);
          return;
        }
        this.completarFormulario(combo);
      }
    } catch (error) {
      console.error('Error al cargar el combo', error);
      this.mensajeError.set('No pudimos cargar los datos. Recargá la página.');
    } finally {
      this.loading.ocultar();
    }
  }

  private completarFormulario(combo: ComboAdmin): void {
    this.formulario.patchValue({
      nombre: combo.nombre,
      descripcion: combo.descripcion ?? '',
      precio: combo.precio,
      incluye_entrada: combo.incluye_entrada,
      destacado: combo.destacado,
      activo: combo.activo,
      items: combo.items.map(i => ({ producto_id: i.producto.id, cantidad: i.cantidad })),
    });

    this.imagenGuardada.set(combo.imagen_url);
    this.formulario.markAsPristine();
  }

  // ---------- Productos del combo ----------

  protected cantidadDe(productoId: number): number {
    return this.items().find(i => i.producto_id === productoId)?.cantidad ?? 0;
  }

  protected cambiarCantidad(productoId: number, diferencia: number): void {
    const control = this.campos.items;
    const nueva = Math.min(CANTIDAD_MAXIMA, Math.max(0, this.cantidadDe(productoId) + diferencia));
    const resto = control.value.filter(i => i.producto_id !== productoId);
    const existia = control.value.some(i => i.producto_id === productoId);

    control.setValue(
      nueva === 0
        ? resto
        : existia
          ? control.value.map(i => (i.producto_id === productoId ? { ...i, cantidad: nueva } : i))
          : [...control.value, { producto_id: productoId, cantidad: nueva }],
    );
    control.markAsDirty();
    control.markAsTouched();
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
    if (v.precio === null) {
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
          imagenUrl = await this.combos.subirImagen(archivo);
        } catch (error) {
          console.error('Error al subir la imagen', error);
          this.mensajeError.set('No pudimos subir la imagen. Verificá que exista el bucket "productos" e intentá de nuevo.');
          return;
        }
      }

      // 2. Se guarda el combo y sus productos
      const datos: ComboGuardar = {
        nombre: v.nombre.trim(),
        descripcion: v.descripcion.trim() || null,
        precio: v.precio,
        imagen_url: imagenUrl,
        incluye_entrada: v.incluye_entrada,
        destacado: v.destacado,
        activo: v.activo,
      };

      const id = this.id();
      await this.combos.guardar(datos, v.items, id !== undefined ? Number(id) : undefined);

      this.guardado = true;
      await this.router.navigate(['/admin/combos'], {
        state: { exito: `"${datos.nombre}" se ${this.esEdicion() ? 'actualizó' : 'creó'} correctamente.` },
      });
    } catch (error) {
      console.error('Error al guardar el combo', error);
      this.mensajeError.set(this.traducirError(error));
    } finally {
      this.loading.ocultar();
      this.enviando.set(false);
    }
  }

  private traducirError(error: unknown): string {
    switch ((error as { code?: string } | null)?.code) {
      case '23514':
        return 'Algún valor no cumple las reglas de la base (el precio no puede ser negativo y las cantidades tienen que ser mayores a 0).';
      case '23505':
        return 'Hay un producto repetido en el combo.';
      case '23503':
        return 'Alguno de los productos elegidos ya no existe. Recargá la página.';
      default:
        return 'No pudimos guardar el combo. Revisá tu conexión e intentá de nuevo.';
    }
  }
}