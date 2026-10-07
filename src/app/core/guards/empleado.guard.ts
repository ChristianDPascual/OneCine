import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { EmpleadosService } from '../services/empleados.service';
import { Puesto } from '../models/empleado.model';

// ¿Hay un empleado activo logueado?
export const empleadoGuard: CanActivateFn = async () => {
  const empleados = inject(EmpleadosService);
  const router = inject(Router);

  try {
    const empleado = await empleados.obtenerActual();
    if (empleado?.activo) {
      return true;
    }
  } catch {
    // Si falla la consulta, se deniega el acceso
  }

  return router.createUrlTree(['/admin/login']);
};

// ¿Su puesto puede entrar a esta sección? Los puestos llegan en route.data
export const puestoGuard: CanActivateFn = async (route) => {
  const empleados = inject(EmpleadosService);
  const router = inject(Router);
  const permitidos = (route.data['puestos'] ?? []) as Puesto[];

  try {
    const empleado = await empleados.obtenerActual();
    if (empleado?.activo && permitidos.includes(empleado.puesto)) {
      return true;
    }
  } catch {
    // Si falla la consulta, se deniega el acceso
  }

  return router.createUrlTree(['/admin/inicio']);
};

// Login del panel:
//  · sin sesión → entra
//  · empleado activo ya logueado → directo al panel
//  · cliente logueado o invitado → entra igual: clientes y empleados están en tablas distintas,
//    y al iniciar sesión como empleado se reemplaza la sesión del cliente
//    (Supabase Auth tiene una sola sesión por navegador)
export const loginEmpleadoGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const empleados = inject(EmpleadosService);
  const router = inject(Router);

  await auth.esperarInicio();

  // Sin sesión, invitado o cliente → muestra el login
  if (!auth.conSesion() || auth.esInvitado() || auth.logueado()) {
    return true;
  }

  try {
    const empleado = await empleados.obtenerActual();
    if (empleado?.activo) {
      return router.createUrlTree(['/admin/inicio']);
    }
  } catch {
    // Si no se puede verificar, se lo trata como no empleado
  }

  return true;
};