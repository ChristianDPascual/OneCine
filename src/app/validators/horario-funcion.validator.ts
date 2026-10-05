import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { horaPermitida, primerDiaProgramable } from '../core/models/funcion.model';

// Validador de grupo: mira los controles "fecha" y "hora" juntos.
//  - horarioFueraDeRango: la hora no está entre la apertura y el último inicio (puede cruzar la medianoche)
//  - funcionSinAnticipacion: la función es para hoy o un día anterior (tiene que ser desde mañana)
export function horarioFuncionValidator(apertura: string, ultimoInicio: string): ValidatorFn {
  return (grupo: AbstractControl): ValidationErrors | null => {
    const fecha = grupo.get('fecha')?.value as string | null;
    const hora = grupo.get('hora')?.value as string | null;

    if (!fecha || !hora) {
      return null; // de eso se ocupa Validators.required en cada control
    }

    if (!horaPermitida(hora)) {
      return { horarioFueraDeRango: { apertura, ultimoInicio } };
    }

    const minimo = primerDiaProgramable();
    if (fecha < minimo) {
      return { funcionSinAnticipacion: { minimo } };
    }

    return null;
  };
}