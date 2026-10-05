import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

// Para controles que guardan una lista (por ejemplo, ids de géneros):
// exige al menos `minimo` elementos seleccionados
export function seleccionMinimaValidator(minimo: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const cantidad = Array.isArray(control.value) ? control.value.length : 0;
    return cantidad >= minimo ? null : { seleccionMinima: { minimo, actual: cantidad } };
  };
}