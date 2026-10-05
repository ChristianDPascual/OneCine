import { Component, effect, input, signal } from '@angular/core';
import QRCode from 'qrcode';

// Dibuja un código QR a partir de un texto (se genera en el navegador, sin servicios externos)
@Component({
  selector: 'app-codigo-qr',
  templateUrl: './codigo-qr.html',
  styleUrl: './codigo-qr.css',
})
export class CodigoQr {
  readonly valor = input.required<string>();
  readonly tamano = input(220);
  readonly descripcion = input('Código QR');

  protected readonly imagen = signal<string | null>(null);

  constructor() {
    // Cada vez que cambia el texto o el tamaño, se vuelve a generar la imagen
    effect(() => {
      const valor = this.valor();
      const tamano = this.tamano();

      QRCode.toDataURL(valor, {
        width: tamano * 2, // doble resolución para pantallas de alta densidad
        margin: 1,
        errorCorrectionLevel: 'M',
        color: { dark: '#0c0c0e', light: '#ffffff' },
      })
        .then(url => this.imagen.set(url))
        .catch(error => console.error('No se pudo generar el QR', error));
    });
  }
}