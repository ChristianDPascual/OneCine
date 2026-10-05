import { Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { map } from 'rxjs';
import { PeliculasService } from '../../../core/services/peliculas.service';
import { GenerosService } from '../../../core/services/generos.service';
import { ConfiguracionService } from '../../../core/services/configuracion.service';
import { LoadingService } from '../../../core/services/loading.service';
import { ConCambiosSinGuardar } from '../../../core/guards/cambios-sin-guardar.guard';
import { EDADES_MINIMAS, EdadMinima, PeliculaAdmin, PeliculaGuardar } from '../../../core/models/pelicula.model';
import { Genero } from '../../../core/models/genero.model';
import { Alerta } from '../../../components/alerta/alerta';
import { CampoFecha } from '../../../components/campo-fecha/campo-fecha';
import { ClasificacionPipe } from '../../../pipes/clasificacion.pipe';
import { seleccionMinimaValidator } from '../../../validators/seleccion-minima.validator';

const LARGO_SINOPSIS = 1000;
const TIPOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp'];
const PESO_MAXIMO_MB = 5;
const DIAS_PREVENTA_POR_DEFECTO = 7;

// Tipo de lanzamiento que elige el admin. En la base se guarda así:
//   estreno  → es_clasico = false, dias_preventa = 0, precio_preventa = null
//   preventa → es_clasico = false, dias_preventa y precio_preventa configurados
//   clasico  → es_clasico = true,  dias_preventa = 0, precio_preventa = null
type TipoLanzamiento = 'estreno' | 'preventa' | 'clasico';

// Nombre visible y id del elemento de cada campo (para el resumen de errores)
const CAMPOS: Record<string, { etiqueta: string; elemento: string }> = {
  titulo: { etiqueta: 'Título', elemento: 'pel-titulo' },
  director: { etiqueta: 'Director', elemento: 'pel-director' },
  duracion_min: { etiqueta: 'Duración', elemento: 'pel-duracion' },
  fecha_estreno: { etiqueta: 'Fecha de estreno', elemento: 'pel-estreno' },
  sinopsis: { etiqueta: 'Sinopsis', elemento: 'pel-sinopsis' },
  generos: { etiqueta: 'Géneros', elemento: 'pel-generos' },
  dias_preventa: { etiqueta: 'Días de preventa', elemento: 'pel-dias-preventa' },
  precio: { etiqueta: 'Precio de la entrada', elemento: 'pel-precio' },
  precio_preventa: { etiqueta: 'Precio de preventa', elemento: 'pel-precio-preventa' },
};

@Component({
  selector: 'app-pelicula-form',
  imports: [ReactiveFormsModule, CurrencyPipe, Alerta, ClasificacionPipe, CampoFecha],
  templateUrl: './pelicula-form.html',
  styleUrl: './pelicula-form.css',
})
export class PeliculaForm implements OnInit, ConCambiosSinGuardar {
  // Parámetro :id de la ruta /admin/peliculas/:id/editar (withComponentInputBinding).
  // En /admin/peliculas/nueva no existe, así que queda undefined.
  readonly id = input<string>();

  private readonly fb = inject(NonNullableFormBuilder);
  private readonly peliculas = inject(PeliculasService);
  private readonly generosService = inject(GenerosService);
  private readonly configuracionService = inject(ConfiguracionService);
  private readonly loading = inject(LoadingService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly esEdicion = computed(() => this.id() !== undefined);
  protected readonly edades = EDADES_MINIMAS;
  protected readonly largoMaximoSinopsis = LARGO_SINOPSIS;

  protected readonly opcionesLanzamiento: { valor: TipoLanzamiento; etiqueta: string; ayuda: string }[] = [
    { valor: 'estreno', etiqueta: 'Estreno', ayuda: 'Película nueva, se vende a precio normal.' },
    { valor: 'preventa', etiqueta: 'Preventa', ayuda: 'Se venden entradas antes del estreno a un precio especial.' },
    { valor: 'clasico', etiqueta: 'Clásico', ayuda: 'Película de años anteriores (por ejemplo, un reestreno).' },
  ];

  protected readonly generos = signal<Genero[]>([]);
  protected readonly noEncontrada = signal(false);
  protected readonly enviando = signal(false);
  protected readonly mensajeError = signal<string | null>(null);
  protected readonly camposInvalidos = signal<string[]>([]);

  // Precios sugeridos desde "Precios y promos" (configuración global)
  protected readonly precioSugeridoEstreno = signal<number | null>(null);
  protected readonly precioSugeridoClasico = signal<number | null>(null);

  // ---------- Póster ----------
  protected readonly tiposImagen = TIPOS_IMAGEN.join(',');
  protected readonly pesoMaximoMb = PESO_MAXIMO_MB;
  protected readonly imagenGuardada = signal<string | null>(null); // URL que ya tiene la película
  protected readonly archivoPoster = signal<File | null>(null);    // archivo elegido, todavía sin subir
  protected readonly previaLocal = signal<string | null>(null);    // URL temporal del archivo elegido
  protected readonly errorImagen = signal<string | null>(null);
  protected readonly arrastrando = signal(false);
  protected readonly vistaPrevia = computed(() => this.previaLocal() ?? this.imagenGuardada());

  private guardado = false;

  protected readonly formulario = this.fb.group({
    titulo: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(150)]],
    director: ['', Validators.maxLength(100)],
    sinopsis: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(LARGO_SINOPSIS)]],
    duracion_min: this.fb.control<number | null>(null, [
      Validators.required,
      Validators.min(1),
      Validators.max(600),
      Validators.pattern(/^\d+$/),
    ]),
    edad_minima: this.fb.control<EdadMinima>(0),
    fecha_estreno: ['', Validators.required],
    generos: this.fb.control<number[]>([], seleccionMinimaValidator(1)),
    visible: true,
    tipo: this.fb.control<TipoLanzamiento>('estreno'),
    // Precio normal de la entrada (en preventa, es el precio que rige después del estreno)
    precio: this.fb.control<number | null>(null, [Validators.required, Validators.min(1)]),
    // Deshabilitados hasta que se elija "Preventa": así no cuentan para la validez
    dias_preventa: this.fb.control<number | null>({ value: DIAS_PREVENTA_POR_DEFECTO, disabled: true }, [
      Validators.required,
      Validators.min(1),
      Validators.max(60),
      Validators.pattern(/^\d+$/),
    ]),
    precio_preventa: this.fb.control<number | null>({ value: null, disabled: true }, [
      Validators.required,
      Validators.min(1),
    ]),
  });

  protected readonly campos = this.formulario.controls;

  // Observables del formulario convertidos en signals para el template
  protected readonly largoSinopsis = toSignal(
    this.campos.sinopsis.valueChanges.pipe(map(texto => texto.length)),
    { initialValue: 0 },
  );
  protected readonly tipo = toSignal(this.campos.tipo.valueChanges, { initialValue: this.campos.tipo.value });

  constructor() {
    // "Preventa" habilita su configuración; las otras opciones la deshabilitan
    this.campos.tipo.valueChanges.pipe(takeUntilDestroyed()).subscribe(tipo => {
      this.sugerirPrecio(tipo);

      if (tipo === 'preventa') {
        this.campos.dias_preventa.enable();
        this.campos.precio_preventa.enable();
      } else {
        this.campos.dias_preventa.disable();
        this.campos.precio_preventa.disable();
      }
    });

    // Si ya se mostró el resumen de errores, se actualiza mientras el usuario corrige
    this.formulario.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      if (this.camposInvalidos().length > 0) {
        this.camposInvalidos.set(this.listarInvalidos());
      }
    });

    // Libera la URL temporal de la vista previa al salir de la página
    this.destroyRef.onDestroy(() => this.liberarPrevia());
  }

  ngOnInit(): void {
    // En ngOnInit el input id() ya tiene el valor de la ruta
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
      const [generos, configuracion, pelicula] = await Promise.all([
        this.generosService.listar(),
        this.configuracionService.obtener(),
        id !== undefined ? this.peliculas.obtener(idNumerico) : Promise.resolve(null),
      ]);

      this.generos.set(generos);
      this.precioSugeridoEstreno.set(configuracion?.precio_estreno ?? null);
      this.precioSugeridoClasico.set(configuracion?.precio_clasico ?? null);

      // Película nueva: arranca con el precio sugerido para estrenos
      if (id === undefined) {
        this.sugerirPrecio(this.campos.tipo.value);
      }

      if (id !== undefined) {
        if (!pelicula) {
          this.noEncontrada.set(true);
          return;
        }
        this.completarFormulario(pelicula);
      }
    } catch (error) {
      console.error('Error al cargar la película', error);
      this.mensajeError.set('No pudimos cargar los datos. Recargá la página.');
    } finally {
      this.loading.ocultar();
    }
  }

  private completarFormulario(pelicula: PeliculaAdmin): void {
    const tipo: TipoLanzamiento = pelicula.es_clasico
      ? 'clasico'
      : pelicula.precio_preventa !== null ? 'preventa' : 'estreno';

    this.formulario.patchValue({
      titulo: pelicula.titulo,
      director: pelicula.director ?? '',
      sinopsis: pelicula.sinopsis,
      duracion_min: pelicula.duracion_min,
      edad_minima: pelicula.edad_minima,
      fecha_estreno: pelicula.fecha_estreno,
      generos: pelicula.generos.map(g => g.id),
      visible: pelicula.visible,
      tipo,
      precio: pelicula.precio,
      dias_preventa: tipo === 'preventa' ? pelicula.dias_preventa : DIAS_PREVENTA_POR_DEFECTO,
      precio_preventa: pelicula.precio_preventa,
    });

    this.imagenGuardada.set(pelicula.imagen_url);

    // Película cargada antes de existir el precio: se completa con el sugerido
    if (pelicula.precio === null) {
      this.sugerirPrecio(tipo, true);
    }

    // Recién cargado no hay cambios del usuario
    this.formulario.markAsPristine();
  }

  // ---------- Precio sugerido ----------

  protected precioSugerido(tipo: TipoLanzamiento): number | null {
    return tipo === 'clasico' ? this.precioSugeridoClasico() : this.precioSugeridoEstreno();
  }

  // Completa el precio con el sugerido del tipo elegido,
  // salvo que el admin ya lo haya escrito a mano (control "dirty")
  private sugerirPrecio(tipo: TipoLanzamiento, forzar = false): void {
    const control = this.campos.precio;
    const sugerido = this.precioSugerido(tipo);

    if (sugerido !== null && (forzar || !control.dirty)) {
      control.setValue(sugerido, { emitEvent: false });
    }
  }

  // ---------- Géneros (varios por película) ----------

  protected generoSeleccionado(id: number): boolean {
    return this.campos.generos.value.includes(id);
  }

  protected alternarGenero(id: number): void {
    const control = this.campos.generos;
    const actuales = control.value;
    control.setValue(actuales.includes(id) ? actuales.filter(g => g !== id) : [...actuales, id]);
    control.markAsDirty();
    control.markAsTouched();
  }

  // ---------- Póster ----------

  protected alElegirArchivo(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    this.usarArchivo(input.files?.[0] ?? null);
    input.value = ''; // permite volver a elegir el mismo archivo
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
    this.archivoPoster.set(null);
    this.imagenGuardada.set(null);
    this.errorImagen.set(null);
    this.formulario.markAsDirty();
  }

  private usarArchivo(archivo: File | null): void {
    if (!archivo) {
      return;
    }

    // Validación de UX: el bucket también limita tipo y tamaño
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
    this.archivoPoster.set(archivo);
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

  // Nombres de los campos inválidos, en el orden en que aparecen en pantalla
  private listarInvalidos(): string[] {
    return Object.keys(CAMPOS)
      .filter(nombre => this.formulario.get(nombre)?.invalid)
      .map(nombre => CAMPOS[nombre].etiqueta);
  }

  // Lleva la pantalla al primer campo con error
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
    if (v.duracion_min === null) {
      return;
    }

    const conPreventa = v.tipo === 'preventa';

    this.enviando.set(true);
    this.loading.mostrar();

    try {
      // 1. Si se eligió una imagen nueva, primero se sube a Storage
      const archivo = this.archivoPoster();
      let imagenUrl = this.imagenGuardada();

      if (archivo) {
        try {
          imagenUrl = await this.peliculas.subirPoster(archivo);
        } catch (error) {
          console.error('Error al subir el póster', error);
          this.mensajeError.set('No pudimos subir el póster. Verificá que exista el bucket "posters" e intentá de nuevo.');
          return;
        }
      }

      // 2. Se guarda la película con la URL pública de la imagen
      const datos: PeliculaGuardar = {
        titulo: v.titulo.trim(),
        director: v.director.trim() || null,
        sinopsis: v.sinopsis.trim(),
        duracion_min: v.duracion_min,
        edad_minima: v.edad_minima,
        imagen_url: imagenUrl,
        fecha_estreno: v.fecha_estreno,
        visible: v.visible,
        es_clasico: v.tipo === 'clasico',
        precio: v.precio,
        dias_preventa: conPreventa ? (v.dias_preventa ?? DIAS_PREVENTA_POR_DEFECTO) : 0,
        precio_preventa: conPreventa ? v.precio_preventa : null,
      };

      const id = this.id();
      await this.peliculas.guardar(datos, v.generos, id !== undefined ? Number(id) : undefined);

      this.guardado = true;
      await this.router.navigate(['/admin/peliculas'], {
        state: { exito: `"${datos.titulo}" se ${this.esEdicion() ? 'actualizó' : 'creó'} correctamente.` },
      });
    } catch (error) {
      console.error('Error al guardar la película', error);
      this.mensajeError.set(this.traducirError(error));
    } finally {
      this.loading.ocultar();
      this.enviando.set(false);
    }
  }

  // Errores de PostgreSQL (vía Supabase) → mensaje para el usuario
  private traducirError(error: unknown): string {
    const codigo = (error as { code?: string } | null)?.code;

    switch (codigo) {
      case '23514': // CHECK: un valor no cumple una regla de la tabla
        return 'Algún valor no cumple las reglas de la base (por ejemplo, la duración o los días de preventa).';
      case '23505': // UNIQUE
        return 'Ya existe un registro con esos datos.';
      case '23503': // FK
        return 'Alguno de los géneros elegidos ya no existe. Recargá la página.';
      case '23502': // NOT NULL
        return 'Falta completar un dato obligatorio.';
      default:
        return 'No pudimos guardar la película. Revisá tu conexión e intentá de nuevo.';
    }
  }
}