import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function passwordValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const valor = String(control.value ?? '');

    if (valor === '') {
      return null; // Lo resuelve Validators.required
    }

    return /\s/.test(valor) ? { conEspacios: true } : null;
  };
}