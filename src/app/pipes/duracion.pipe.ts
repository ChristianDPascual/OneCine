import { Pipe, PipeTransform } from '@angular/core';

// 195 → '3 h 15 min' · 90 → '1 h 30 min' · 45 → '45 min'
@Pipe({ name: 'duracion' })
export class DuracionPipe implements PipeTransform {
  transform(minutos: number | null | undefined): string {
    if (!minutos || minutos <= 0) {
      return '';
    }
    const horas = Math.floor(minutos / 60);
    const resto = minutos % 60;
    if (horas === 0) {
      return `${resto} min`;
    }
    return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`;
  }
}