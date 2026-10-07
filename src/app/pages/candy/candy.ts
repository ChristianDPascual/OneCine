import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { ProductosService } from '../../core/services/productos.service';
import { CategoriasProductoService } from '../../core/services/categorias-producto.service';
import { CombosService } from '../../core/services/combos.service';
import { ConfiguracionService } from '../../core/services/configuracion.service';
import { AuthService } from '../../core/services/auth.service';
import { CarritoService } from '../../core/services/carrito.service';
import { Producto } from '../../core/models/producto.model';
import { ComboAdmin, precioPorSeparado } from '../../core/models/combo.model';
import { Alerta } from '../../components/alerta/alerta';
import { Contador } from '../../components/contador/contador';
import { CarritoResumen } from '../../components/carrito-resumen/carrito-resumen';

interface Seccion {
  id: string;       // ancla para el menú (#combos, #categoria-3…)
  titulo: string;
  productos: Producto[];
}

@Component({
  selector: 'app-candy',
  imports: [CurrencyPipe, DecimalPipe, Alerta, Contador, CarritoResumen],
  templateUrl: './candy.html',
  styleUrl: './candy.css',
})
export class Candy {
  private readonly productosService = inject(ProductosService);
  private readonly categoriasService = inject(CategoriasProductoService);
  private readonly combosService = inject(CombosService);
  private readonly configuracionService = inject(ConfiguracionService);
  // Los puntos canjeables solo se muestran con la sesión iniciada
  protected readonly auth = inject(AuthService);
  // Carrito compartido: lo que se elige acá se paga solo o junto con las entradas
  protected readonly carrito = inject(CarritoService);

  protected readonly cargando = signal(true);
  protected readonly mensajeError = signal<string | null>(null);
  protected readonly busqueda = signal('');

  private readonly combos = signal<ComboAdmin[]>([]);
  private readonly productos = signal<Producto[]>([]);
  private readonly categorias = signal<{ id: number; nombre: string }[]>([]);
  // Precio sugerido de una entrada de estreno: para calcular el ahorro de los combos con entrada
  private readonly precioEntrada = signal<number | null>(null);

  protected readonly esqueletos = Array.from({ length: 8 }, (_, i) => i);

  private readonly texto = computed(() => this.busqueda().trim().toLowerCase());

  // Solo lo activo; destacados primero (ya vienen ordenados desde el servicio)
  protected readonly combosVisibles = computed(() =>
    this.combos().filter(c => c.activo && (!this.texto() || c.nombre.toLowerCase().includes(this.texto()))),
  );

  // Productos activos agrupados por categoría, en el orden configurado en el panel
  protected readonly secciones = computed<Seccion[]>(() => {
    const texto = this.texto();
    const activos = this.productos().filter(p => p.activo && (!texto || p.nombre.toLowerCase().includes(texto)));

    return this.categorias()
      .map(c => ({
        id: `categoria-${c.id}`,
        titulo: c.nombre,
        productos: activos.filter(p => p.categoria_id === c.id),
      }))
      .filter(s => s.productos.length > 0);
  });

  // Menú de anclas: Combos + cada categoría con productos
  protected readonly menu = computed(() => [
    ...(this.combosVisibles().length > 0 ? [{ id: 'combos', titulo: 'Combos' }] : []),
    ...this.secciones().map(s => ({ id: s.id, titulo: s.titulo })),
  ]);

  protected readonly sinResultados = computed(
    () => !this.cargando() && this.combosVisibles().length === 0 && this.secciones().length === 0,
  );

  constructor() {
    this.cargar();
  }

  private async cargar(): Promise<void> {
    try {
      const [combos, productos, categorias, configuracion] = await Promise.all([
        this.combosService.listar(),
        this.productosService.listar(),
        this.categoriasService.listar(),
        this.configuracionService.obtener().catch(() => null),
      ]);
      this.combos.set(combos);
      this.productos.set(productos);
      this.categorias.set(categorias);
      this.precioEntrada.set(configuracion?.precio_estreno ?? null);
    } catch (error) {
      console.error('Error al cargar el candy bar', error);
      this.mensajeError.set('No pudimos cargar el candy bar. Revisá tu conexión e intentá de nuevo.');
    } finally {
      this.cargando.set(false);
    }
  }

  // ---------- Combos ----------

  protected contenido(combo: ComboAdmin): string[] {
    return [
      ...(combo.incluye_entrada ? ['1× Entrada'] : []),
      ...combo.items.map(i => `${i.cantidad}× ${i.producto.nombre}`),
    ];
  }

  // Ahorro frente a comprar todo por separado (la entrada, con el precio sugerido de estreno)
  protected ahorro(combo: ComboAdmin): number {
    if (combo.incluye_entrada && this.precioEntrada() === null) {
      return 0;
    }
    const entrada = combo.incluye_entrada ? (this.precioEntrada() ?? 0) : 0;
    return precioPorSeparado(combo.items) + entrada - combo.precio;
  }

  // ---------- Carrito ----------

  protected cambiarCombo(combo: ComboAdmin, diferencia: number): void {
    this.carrito.cambiar(
      { tipo: 'combo', id: combo.id, nombre: combo.nombre, precio: combo.precio, incluyeEntrada: combo.incluye_entrada },
      diferencia,
    );
  }

  protected cambiarProducto(producto: Producto, diferencia: number): void {
    this.carrito.cambiar(
      { tipo: 'producto', id: producto.id, nombre: producto.nombre, precio: producto.precio, incluyeEntrada: false },
      diferencia,
    );
  }

  // ---------- Navegación ----------

  protected irA(id: string): void {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}