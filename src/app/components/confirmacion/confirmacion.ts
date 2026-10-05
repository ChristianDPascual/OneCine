import { Component, ElementRef, afterNextRender, input, output, viewChild } from '@angular/core';

@Component({
  selector: 'app-confirmacion',
  templateUrl: './confirmacion.html',
  styleUrl: './confirmacion.css',
})
export class Confirmacion {
  readonly titulo = input.required<string>();
  readonly mensaje = input.required<string>();
  readonly textoConfirmar = input.required<string>();
  readonly textoCancelar = input.required<string>();

  readonly respuesta = output<boolean>();

  private readonly dialogo = viewChild.required<ElementRef<HTMLDialogElement>>('dialogo');

  constructor() {
    afterNextRender(() => this.dialogo().nativeElement.showModal());
  }

  protected cerrarSiClicFuera(evento: MouseEvent): void {
    if (evento.target === evento.currentTarget) {
      this.dialogo().nativeElement.close('no');
    }
  }
}
