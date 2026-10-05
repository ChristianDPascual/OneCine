import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

// Palabras de letras, separadas por espacios, guion o apóstrofe (recto o curvo)
const PATRON_NOMBRE = /^[\p{L}\p{M}]+(?:(?:\s+|['’-])[\p{L}\p{M}]+)*$/u;

export function nombrePersonaValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const valor = String(control.value ?? '').trim();

    if (valor === '') {
      // Vacío: lo resuelve Validators.required.
      // Solo espacios: lo tratamos como vacío.
      return control.value ? { required: true } : null;
    }

    return PATRON_NOMBRE.test(valor) ? null : { nombreInvalido: true };
  };
}