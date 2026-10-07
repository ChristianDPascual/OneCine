import { Component } from '@angular/core';
import { ValidadorQr } from '../../../components/validador-qr/validador-qr';

// Entregar candy: usa el validador del QR único de la compra
@Component({
  selector: 'app-validar-candy',
  imports: [ValidadorQr],
  templateUrl: './validar-candy.html',
  styleUrl: './validar-candy.css',
})
export class ValidarCandy {}