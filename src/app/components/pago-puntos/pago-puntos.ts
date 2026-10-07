import { Component, computed, input, model } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { OpcionCanje } from '../../core/models/compra.model';
import { Contador } from '../contador/contador';

// "Pagar con puntos" (solo clientes registrados).
// Se canjean ítems COMPLETOS: una entrada o una unidad de un producto por vez.
// Si el saldo no alcanza para una unidad más, el "+" queda deshabilitado.
// La base vuelve a verificar el saldo al pagar.
@Component({
  selector: 'app-pago-puntos',
  imports: [DecimalPipe, Contador],
  templateUrl: './pago-puntos.html',
  styleUrl: './pago-puntos.css',
})
export class PagoPuntos {
  readonly saldo = input.required<number>();
  readonly opciones = input.required<OpcionCanje[]>();
  // clave → unidades pagadas con puntos
  readonly seleccion = model.required<Record<string, number>>();

  protected readonly usados = computed(() =>
    this.opciones().reduce((t, o) => t + (this.seleccion()[o.clave] ?? 0) * o.puntos, 0),
  );
  protected readonly restantes = computed(() => this.saldo() - this.usados());

  // Ni siquiera alcanza para la opción más barata
  protected readonly sinSaldo = computed(() => {
    const opciones = this.opciones();
    return opciones.length > 0 && this.saldo() < Math.min(...opciones.map(o => o.puntos));
  });

  protected cantidad(opcion: OpcionCanje): number {
    return this.seleccion()[opcion.clave] ?? 0;
  }

  protected puedeSumar(opcion: OpcionCanje): boolean {
    return this.cantidad(opcion) < opcion.maximo && opcion.puntos <= this.restantes();
  }

  protected alcanza(opcion: OpcionCanje): boolean {
    return this.cantidad(opcion) > 0 || opcion.puntos <= this.restantes();
  }

  protected cambiar(opcion: OpcionCanje, diferencia: number): void {
    const nueva = Math.max(0, Math.min(opcion.maximo, this.cantidad(opcion) + diferencia));
    this.seleccion.update(actual => ({ ...actual, [opcion.clave]: nueva }));
  }
}