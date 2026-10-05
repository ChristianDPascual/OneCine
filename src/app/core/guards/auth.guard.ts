import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

// Pantallas que requieren sesión (área del cliente)
export const authGuard: CanActivateFn = async () => {
  // inject() tiene que ir ANTES del primer await
  const auth = inject(AuthService);
  const router = inject(Router);

  await auth.esperarInicio();

  return auth.logueado() ? true : router.createUrlTree(['/']);
};

// Pantallas solo para visitantes SIN sesión (registro): si ya hay sesión, al inicio
export const sinSesionGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await auth.esperarInicio();

  return auth.logueado() ? router.createUrlTree(['/']) : true;
};