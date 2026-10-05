import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { ConfirmacionService } from '../services/confirmacion.service';

export interface ConCambiosSinGuardar {
  hayCambiosSinGuardar(): boolean;
}

export const cambiosSinGuardarGuard: CanDeactivateFn<ConCambiosSinGuardar> = (componente) => {
  if (!componente.hayCambiosSinGuardar()) {
    return true;
  }

  return inject(ConfirmacionService).preguntar({
    titulo: '¿Salir sin terminar?',
    mensaje: 'Si salís ahora vas a perder los datos que cargaste en el formulario.',
    textoConfirmar: 'Salir de todas formas',
    textoCancelar: 'Seguir completando',
  });
};