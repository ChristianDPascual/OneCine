import { Component, computed, input, model } from '@angular/core';
import { CurrencyPipe } from '@angular/common';

// "Usar mi crédito a favor" (solo clientes registrados).
// Se aplica hasta cubrir lo que queda por pagar; el resto sigue disponible.
// La base vuelve a verificar el saldo al pagar.
@Component({
  selector: 'app-pago-credito',
  imports: [CurrencyPipe],
  templateUrl: './pago-credito.html',
  styleUrl: './pago-credito.css',
})
export class PagoCredito {
  readonly saldo = input.required<number>();
  // Lo que falta pagar después de puntos y descuento
  readonly aPagar = input.required<number>();
  readonly usar = model.required<boolean>();

  protected readonly aplicado = computed(() => (this.usar() ? Math.min(this.saldo(), this.aPagar()) : 0));
  protected readonly restante = computed(() => this.saldo() - this.aplicado());
  protected readonly disponible = computed(() => this.saldo() > 0 && this.aPagar() > 0);
}