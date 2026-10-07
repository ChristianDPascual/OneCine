import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { DescuentoAplicable, ItemCompra } from '../models/compra.model';
import { ComprasService } from './compras.service';
import { AuthService } from './auth.service';

// Una línea del carrito del candy
export interface LineaCarrito {
  tipo: 'producto' | 'combo';
  id: number;
  nombre: string;
  precio: number;
  cantidad: number;
  incluyeEntrada: boolean;
}

export const MAXIMO_POR_ITEM = 20;

// Carrito del candy compartido entre pantallas.
// Flujo desde el navbar: /candy → /candy/funcion (elegir película y horario) → butacas → pago.
// Se guarda en sessionStorage: sobrevive a recargas y a volver de un login,
// y se borra al cerrar la pestaña.
@Injectable({ providedIn: 'root' })
export class CarritoService {
  private readonly compras = inject(ComprasService);
  private readonly auth = inject(AuthService);
  private readonly guardado = leerGuardado();

  // 'combo-3' → línea
  private readonly mapa = signal(new Map<string, LineaCarrito>(this.guardado.lineas.map(l => [`${l.tipo}-${l.id}`, l])));

  // true cuando el cliente armó su pedido en /candy y tocó "Continuar":
  // la compra va directo de butacas a pago (el candy ya está elegido)
  readonly pedidoDelCandy = signal(this.guardado.pedidoDelCandy);

  readonly lineas = computed(() => [...this.mapa().values()]);
  readonly vacio = computed(() => this.mapa().size === 0);
  readonly unidades = computed(() => this.lineas().reduce((t, l) => t + l.cantidad, 0));
  readonly total = computed(() => this.lineas().reduce((t, l) => t + l.precio * l.cantidad, 0));

  // Cada combo con entrada necesita una butaca de una función
  readonly combosConEntrada = computed(() =>
    this.lineas().filter(l => l.incluyeEntrada).reduce((t, l) => t + l.cantidad, 0),
  );

  // ---------- Descuento del cliente logueado ----------
  // Primera compra o, si no, por edad. Es una estimación para mostrar en el Candy y en
  // "Elegí la película": el monto final lo calcula la base al pagar.
  readonly descuento = signal<DescuentoAplicable | null>(null);
  readonly montoDescuento = computed(() => {
    const d = this.descuento();
    return d ? Math.round(this.total() * d.porcentaje) / 100 : 0;
  });
  readonly totalConDescuento = computed(() => this.total() - this.montoDescuento());

  constructor() {
    // Se consulta al iniciar sesión; al cerrarla se borra
    effect(() => {
      if (!this.auth.logueado()) {
        this.descuento.set(null);
        return;
      }
      this.compras.descuentoPrimeraCompra()
        .then(d => this.descuento.set(d))
        .catch(() => this.descuento.set(null));
    });

    // Cada cambio del carrito se guarda en la pestaña
    effect(() => {
      const datos: CarritoGuardado = { lineas: this.lineas(), pedidoDelCandy: this.pedidoDelCandy() };
      try {
        sessionStorage.setItem(CLAVE, JSON.stringify(datos));
      } catch {
        // Sin almacenamiento disponible: el carrito sigue funcionando en memoria
      }
    });
  }

  cantidad(tipo: 'producto' | 'combo', id: number): number {
    return this.mapa().get(`${tipo}-${id}`)?.cantidad ?? 0;
  }

  cambiar(item: Omit<LineaCarrito, 'cantidad'>, diferencia: number): void {
    const clave = `${item.tipo}-${item.id}`;
    const nueva = Math.max(0, Math.min(MAXIMO_POR_ITEM, this.cantidad(item.tipo, item.id) + diferencia));

    this.mapa.update(actual => {
      const copia = new Map(actual);
      if (nueva === 0) {
        copia.delete(clave);
      } else {
        copia.set(clave, { ...item, cantidad: nueva });
      }
      return copia;
    });
  }

  iniciarPedido(): void {
    this.pedidoDelCandy.set(true);
  }

  vaciar(): void {
    this.mapa.set(new Map());
    this.pedidoDelCandy.set(false);
  }

  // Lo que se manda a la base (los precios los vuelve a calcular ella)
  items(): ItemCompra[] {
    return this.lineas().map(l => ({ tipo: l.tipo, id: l.id, cantidad: l.cantidad }));
  }
}

// ---------- Guardado en la pestaña ----------

const CLAVE = 'onecine-carrito';

interface CarritoGuardado {
  lineas: LineaCarrito[];
  pedidoDelCandy: boolean;
}

function leerGuardado(): CarritoGuardado {
  try {
    const datos = JSON.parse(sessionStorage.getItem(CLAVE) ?? 'null') as CarritoGuardado | null;
    if (datos && Array.isArray(datos.lineas)) {
      return { lineas: datos.lineas, pedidoDelCandy: !!datos.pedidoDelCandy };
    }
  } catch {
    // Dato corrupto o almacenamiento bloqueado: se arranca vacío
  }
  return { lineas: [], pedidoDelCandy: false };
}