import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

// Pantallas de compra: alcanza con CUALQUIER sesión.
//  · cliente registrado → compra con descuentos y puntos
//  · sin sesión → entra como invitado (sesión anónima de Supabase), sin registrarse
//  · sesión de empleado → se cierra y entra como invitado
export const compraGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await auth.esperarInicio();

  // Cliente registrado o invitado: compra con su sesión
  if (auth.logueado() || auth.esInvitado()) {
    return true;
  }

  // Sesión de empleado en la parte de clientes: se cierra y compra como invitado
  if (auth.sesionDeEmpleado()) {
    await auth.cerrarSesion();
  }

  return (await auth.entrarComoInvitado()) ? true : router.createUrlTree(['/']);
};