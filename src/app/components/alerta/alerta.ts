import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-alerta',
  templateUrl: './alerta.html',
  styleUrl: './alerta.css',
})
export class Alerta {
  readonly tipo = input<'error' | 'exito'>('error');
  readonly titulo = input.required<string>();
  readonly mensaje = input.required<string>();

  readonly cerrar = output<void>();
}
