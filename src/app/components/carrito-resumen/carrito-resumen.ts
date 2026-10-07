import { Component, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { CarritoService, LineaCarrito, MAXIMO_POR_ITEM } from '../../core/services/carrito.service';
import { Contador } from '../contador/contador';

// Panel lateral del Candy bar con el pedido armado.
//  · "Continuar" → elegir película y horario → butacas → pago
//  · "Pagar solo el candy" (si no hay combos con entrada) → compra sin entradas
@Component({
  selector: 'app-carrito-resumen',
  imports: [CurrencyPipe, RouterLink, Contador],
  templateUrl: './carrito-resumen.html',
  styleUrl: './carrito-resumen.css',
})
export class CarritoResumen {
  protected readonly carrito = inject(CarritoService);
  private readonly router = inject(Router);
  protected readonly maximo = MAXIMO_POR_ITEM;

  protected cambiar(linea: LineaCarrito, diferencia: number): void {
    this.carrito.cambiar(linea, diferencia);
  }

  protected continuar(): void {
    this.carrito.iniciarPedido();
    this.router.navigate(['/candy/funcion']);
  }
}