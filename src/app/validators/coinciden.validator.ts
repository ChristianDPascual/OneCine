import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

// Validador de grupo: los dos campos indicados deben tener el mismo valor
export function coincidenValidator(campo: string, confirmacion: string): ValidatorFn {
  return (grupo: AbstractControl): ValidationErrors | null => {
    const valor = grupo.get(campo)?.value;
    const repetido = grupo.get(confirmacion)?.value;

    if (!valor || !repetido) {
      return null; // Si falta alguno, lo resuelve Validators.required
    }

    return valor === repetido ? null : { noCoinciden: true };
  };
}