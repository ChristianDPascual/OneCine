import { Component, input, output } from '@angular/core';

// Control "− 2 +" para sumar o quitar un producto del carrito
@Component({
  selector: 'app-contador',
  templateUrl: './contador.html',
  styleUrl: './contador.css',
})
export class Contador {
  readonly cantidad = input.required<number>();
  readonly nombre = input.required<string>(); // para los aria-label
  readonly puedeSumar = input(true);
  readonly cambiar = output<number>();
}