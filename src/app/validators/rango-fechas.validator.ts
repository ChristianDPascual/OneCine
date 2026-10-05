import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

// Validador de grupo: la fecha "hasta" no puede ser anterior a "desde".
// Refleja el CHECK de la base (vigente_hasta >= vigente_desde). Si falta alguna, no valida.
export function rangoFechasValidator(desde: string, hasta: string): ValidatorFn {
  return (grupo: AbstractControl): ValidationErrors | null => {
    const inicio = grupo.get(desde)?.value as string | null;
    const fin = grupo.get(hasta)?.value as string | null;

    if (!inicio || !fin) {
      return null;
    }

    return fin >= inicio ? null : { rangoInvalido: true };
  };
}