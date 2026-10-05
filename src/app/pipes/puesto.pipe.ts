import { Pipe, PipeTransform } from '@angular/core';
import { ETIQUETAS_PUESTO, Puesto } from '../core/models/empleado.model';

// 'confiteria' → 'Confitería'
@Pipe({ name: 'puesto' })
export class PuestoPipe implements PipeTransform {
  transform(valor: Puesto): string {
    return ETIQUETAS_PUESTO[valor];
  }
}