import { Route, Router, Routes } from '@angular/router';
import { cambiosSinGuardarGuard } from './core/guards/cambios-sin-guardar.guard';
import { authGuard, sinSesionGuard } from './core/guards/auth.guard';
import { empleadoGuard, loginEmpleadoGuard, puestoGuard } from './core/guards/empleado.guard';
import { puestosDe } from './core/models/empleado.model';
import { inject } from '@angular/core';


// Sección del panel: lazy + puestoGuard + puestos permitidos tomados del modelo
const seccionAdmin = (ruta: string, cargar: Route['loadComponent']): Route => ({
  path: ruta,
  loadComponent: cargar,
  canActivate: [puestoGuard],
  data: { puestos: puestosDe(ruta) },
});

// Sub-pantalla de una sección (mismos permisos que la sección)
const subseccionAdmin = (seccion: string, ruta: string, cargar: Route['loadComponent']): Route => ({
  path: `${seccion}/${ruta}`,
  loadComponent: cargar,
  canActivate: [puestoGuard],
  data: { puestos: puestosDe(seccion) },
});

// Formulario de una sección (alta/edición): además avisa antes de salir con datos cargados
const formularioAdmin = (seccion: string, ruta: string, cargar: Route['loadComponent']): Route => ({
  ...subseccionAdmin(seccion, ruta, cargar),
  canDeactivate: [cambiosSinGuardarGuard],
});

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home').then(m => m.Home),

  },
  {
    path: 'cartelera',
    loadComponent: () => import('./pages/cartelera/cartelera').then(m => m.Cartelera),
  },
  {
    // El link "Próximamente" del navbar abre la cartelera ya filtrada
    path: 'proximamente',
    redirectTo: () => inject(Router).createUrlTree(['/cartelera'], { queryParams: { lanzamiento: 'proximamente' } }),
  },
  {
    path: 'candy',
    loadComponent: () => import('./pages/candy/candy').then(m => m.Candy),
  },
  {
    path: 'registro',
    loadComponent: () => import('./pages/registro/registro').then(m => m.Registro),
    canActivate: [sinSesionGuard],
    canDeactivate: [cambiosSinGuardarGuard],
  },

  // Área del cliente: requiere sesión
  {
    path: '',
    canActivate: [authGuard],
    children: [
      { path: 'mis-entradas', loadComponent: () => import('./pages/mis-entradas/mis-entradas').then(m => m.MisEntradas) },
      { path: 'mis-puntos', loadComponent: () => import('./pages/mis-puntos/mis-puntos').then(m => m.MisPuntos) },
      { path: 'mis-peliculas', loadComponent: () => import('./pages/mis-peliculas/mis-peliculas').then(m => m.MisPeliculas) },
      { path: 'mi-credito', loadComponent: () => import('./pages/mi-credito/mi-credito').then(m => m.MiCredito) },
      { path: 'comprar/:funcion', loadComponent: () => import('./pages/compra/compra').then(m => m.Compra) },
    ],
  },

  // Panel de empleados
  {
    path: 'admin/login',
    loadComponent: () => import('./pages/admin/admin-login/admin-login').then(m => m.AdminLogin),
    canActivate: [loginEmpleadoGuard],
  },
  {
    path: 'admin',
    canActivate: [empleadoGuard],
    loadComponent: () => import('./pages/admin/admin-layout/admin-layout').then(m => m.AdminLayout),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'inicio' },
      { path: 'inicio', loadComponent: () => import('./pages/admin/inicio/inicio').then(m => m.Inicio) },
      seccionAdmin('validar-sala', () => import('./pages/admin/validar-sala/validar-sala').then(m => m.ValidarSala)),
      seccionAdmin('validar-candy', () => import('./pages/admin/validar-candy/validar-candy').then(m => m.ValidarCandy)),

      seccionAdmin('peliculas', () => import('./pages/admin/peliculas/peliculas').then(m => m.Peliculas)),
      formularioAdmin('peliculas', 'nueva', () => import('./pages/admin/pelicula-form/pelicula-form').then(m => m.PeliculaForm)),
      formularioAdmin('peliculas', ':id/editar', () => import('./pages/admin/pelicula-form/pelicula-form').then(m => m.PeliculaForm)),

      seccionAdmin('funciones', () => import('./pages/admin/funciones/funciones').then(m => m.Funciones)),
      formularioAdmin('funciones', 'nueva', () => import('./pages/admin/funcion-form/funcion-form').then(m => m.FuncionForm)),
      formularioAdmin('funciones', ':id/editar', () => import('./pages/admin/funcion-form/funcion-form').then(m => m.FuncionForm)),
      seccionAdmin('salas', () => import('./pages/admin/salas/salas').then(m => m.Salas)),
      formularioAdmin('salas', 'nueva', () => import('./pages/admin/sala-form/sala-form').then(m => m.SalaForm)),
      formularioAdmin('salas', ':id/editar', () => import('./pages/admin/sala-form/sala-form').then(m => m.SalaForm)),
      subseccionAdmin('salas', ':id', () => import('./pages/admin/sala-butacas/sala-butacas').then(m => m.SalaButacas)),

      seccionAdmin('productos', () => import('./pages/admin/productos/productos').then(m => m.Productos)),
      formularioAdmin('productos', 'nuevo', () => import('./pages/admin/producto-form/producto-form').then(m => m.ProductoForm)),
      formularioAdmin('productos', ':id/editar', () => import('./pages/admin/producto-form/producto-form').then(m => m.ProductoForm)),
      subseccionAdmin('productos', 'categorias', () => import('./pages/admin/categorias-producto/categorias-producto').then(m => m.CategoriasProducto)),

      seccionAdmin('combos', () => import('./pages/admin/combos/combos').then(m => m.Combos)),
      formularioAdmin('combos', 'nuevo', () => import('./pages/admin/combo-form/combo-form').then(m => m.ComboForm)),
      formularioAdmin('combos', ':id/editar', () => import('./pages/admin/combo-form/combo-form').then(m => m.ComboForm)),

      seccionAdmin('precios', () => import('./pages/admin/precios-promos/precios-promos').then(m => m.PreciosPromos)),
      formularioAdmin('precios', 'promociones/nueva', () => import('./pages/admin/promocion-form/promocion-form').then(m => m.PromocionForm)),
      formularioAdmin('precios', 'promociones/:id/editar', () => import('./pages/admin/promocion-form/promocion-form').then(m => m.PromocionForm)),

      seccionAdmin('empleados', () => import('./pages/admin/empleados/empleados').then(m => m.Empleados)),
      formularioAdmin('empleados', 'nuevo', () => import('./pages/admin/empleado-nuevo/empleado-nuevo').then(m => m.EmpleadoNuevo)),

      seccionAdmin('reportes', () => import('./pages/admin/reportes/reportes').then(m => m.Reportes)),
      seccionAdmin('actividad', () => import('./pages/admin/actividad/actividad').then(m => m.Actividad)),
    ],
  },

  {
    path: '**',
    loadComponent: () => import('./pages/not-found/not-found').then(m => m.NotFound),
  },
];