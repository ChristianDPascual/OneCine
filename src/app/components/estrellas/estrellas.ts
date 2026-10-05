import { Component, computed, input } from '@angular/core';

// Muestra de 0 a 5 estrellas, con relleno parcial (ej.: 4,3 → cuatro llenas y un 30 % de la quinta)
@Component({
  selector: 'app-estrellas',
  templateUrl: './estrellas.html',
  styleUrl: './estrellas.css',
  host: {
    role: 'img',
    '[attr.aria-label]': 'etiqueta()',
    '[style.--tamano]': 'tamano()',
  },
})
export class Estrellas {
  readonly valor = input.required<number>();
  readonly tamano = input('1rem');

  protected readonly posiciones = [0, 1, 2, 3, 4];

  // Porcentaje de relleno de cada estrella
  protected readonly rellenos = computed(() =>
    this.posiciones.map(i => Math.round(Math.min(1, Math.max(0, this.valor() - i)) * 100)),
  );

  protected readonly etiqueta = computed(() => `${this.valor().toLocaleString('es-AR')} de 5 estrellas`);
}