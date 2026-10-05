import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProductosService } from '../../../core/services/productos.service';
import { CategoriasProductoService } from '../../../core/services/categorias-producto.service';
import { LoadingService } from '../../../core/services/loading.service';
import { ConfirmacionService } from '../../../core/services/confirmacion.service';
import { CategoriaProducto, Producto } from '../../../core/models/producto.model';
import { Alerta } from '../../../components/alerta/alerta';

type Estado = 'activos' | 'inactivos';

interface GrupoCategoria {
  categoria: CategoriaProducto;
  productos: Producto[];
}

@Component({
  selector: 'app-productos',
  imports: [RouterLink, CurrencyPipe, Alerta],
  templateUrl: './productos.html',
  styleUrl: './productos.css',
})
export class Productos {
  private readonly productosService = inject(ProductosService);
  private readonly categoriasService = inject(CategoriasProductoService);
  private readonly loading = inject(LoadingService);
  private readonly confirmacion = inject(ConfirmacionService);

  protected readonly productos = signal<Producto[]>([]);
  protected readonly categorias = signal<CategoriaProducto[]>([]);
  protected readonly mensajeError = signal<string | null>(null);
  protected readonly cargado = signal(false);
  protected readonly mensajeExito = signal<string | null>(history.state?.exito ?? null);

  // ---------- Filtros (en el navegador: el panel ya tiene todo cargado) ----------
  protected readonly busqueda = signal('');
  protected readonly categoriaElegida = signal<number | null>(null);
  protected readonly estado = signal<Estado | null>(null);
  protected readonly soloCanjeables = signal(false);

  protected readonly opcionesEstado: { valor: Estado; etiqueta: string }[] = [
    { valor: 'activos', etiqueta: 'Activos' },
    { valor: 'inactivos', etiqueta: 'Inactivos' },
  ];

  protected readonly cantidadFiltros = computed(() =>
    [
      this.busqueda().trim() !== '',
      this.categoriaElegida() !== null,
      this.estado() !== null,
      this.soloCanjeables(),
    ].filter(Boolean).length,
  );

  private readonly filtrados = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();
    const categoria = this.categoriaElegida();
    const estado = this.estado();
    const canjeables = this.soloCanjeables();

    return this.productos().filter(p =>
      (!texto || p.nombre.toLowerCase().includes(texto)) &&
      (categoria === null || p.categoria_id === categoria) &&
      (estado === null || p.activo === (estado === 'activos')) &&
      (!canjeables || p.puntos_canje !== null),
    );
  });

  protected readonly cantidadFiltrados = computed(() => this.filtrados().length);

  // Productos agrupados por categoría, en el orden de la carta
  protected readonly grupos = computed<GrupoCategoria[]>(() => {
    const productos = this.filtrados();
    return this.categorias()
      .map(categoria => ({ categoria, productos: productos.filter(p => p.categoria_id === categoria.id) }))
      .filter(grupo => grupo.productos.length > 0);
  });

  constructor() {
    this.cargar();
  }

  private async cargar(): Promise<void> {
    this.loading.mostrar();
    try {
      const [productos, categorias] = await Promise.all([
        this.productosService.listar(),
        this.categoriasService.listar(),
      ]);
      this.productos.set(productos);
      this.categorias.set(categorias);
    } catch (error) {
      console.error('Error al cargar productos', error);
      this.mensajeError.set('No pudimos cargar los productos.');
    } finally {
      this.loading.ocultar();
      this.cargado.set(true);
    }
  }

  // Una sola opción: tocar la elegida otra vez la quita
  protected elegirCategoria(id: number): void {
    this.categoriaElegida.update(actual => (actual === id ? null : id));
  }

  protected elegirEstado(valor: Estado): void {
    this.estado.update(actual => (actual === valor ? null : valor));
  }

  protected borrarFiltros(): void {
    this.busqueda.set('');
    this.categoriaElegida.set(null);
    this.estado.set(null);
    this.soloCanjeables.set(false);
  }

  protected async alternarActivo(producto: Producto): Promise<void> {
    const desactivar = producto.activo;

    if (desactivar) {
      const confirmado = await this.confirmacion.preguntar({
        titulo: '¿Desactivar producto?',
        mensaje: `"${producto.nombre}" va a dejar de ofrecerse en el candy bar.`,
        textoConfirmar: 'Desactivar',
        textoCancelar: 'Cancelar',
      });

      if (!confirmado) {
        return;
      }
    }

    this.mensajeError.set(null);
    this.mensajeExito.set(null);
    this.loading.mostrar();

    try {
      await this.productosService.cambiarActivo(producto.id, !producto.activo);
      this.productos.update(lista =>
        lista.map(p => (p.id === producto.id ? { ...p, activo: !p.activo } : p)),
      );
      this.mensajeExito.set(`"${producto.nombre}" ${desactivar ? 'fue desactivado' : 'vuelve a estar disponible'}.`);
    } catch (error) {
      console.error('Error al cambiar el estado del producto', error);
      this.mensajeError.set('No pudimos actualizar el producto.');
    } finally {
      this.loading.ocultar();
    }
  }
}