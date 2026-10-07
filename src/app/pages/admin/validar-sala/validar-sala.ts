import { Component } from '@angular/core';
import { ValidadorQr } from '../../../components/validador-qr/validador-qr';

// Validar entradas: usa el validador del QR único de la compra
@Component({
  selector: 'app-validar-sala',
  imports: [ValidadorQr],
  templateUrl: './validar-sala.html',
  styleUrl: './validar-sala.css',
})
export class ValidarSala {}