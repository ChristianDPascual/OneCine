import { Pipe, PipeTransform } from '@angular/core';
import { ETIQUETAS_EDAD, EdadMinima } from '../core/models/pelicula.model';

// 0 → 'ATP' · 13 → '+13' · 17 → '+17'
@Pipe({ name: 'clasificacion' })
export class ClasificacionPipe implements PipeTransform {
  transform(edad: EdadMinima): string {
    return ETIQUETAS_EDAD[edad];
  }
}