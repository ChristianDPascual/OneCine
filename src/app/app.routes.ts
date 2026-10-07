import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { authGuard, sinSesionGuard } from './core/guards/auth.guard';
import { empleadoGuard, loginEmpleadoGuard, puestoGuard } from './core/guards/empleado.guard';
import { cambiosSinGuardarGuard } from './core/guards/cambios-sin-guardar.guard';
import { salirDelPedidoGuard } from './core/guards/salir-del-pedido.guard';
import { compraGuard } from './core/guards/compra.guard';
import { puestosDe } from './core/models/empleado.model';

export const routes: Routes = [
  // ---------- Público ----------
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
    // Si sale del recorrido con productos cargados, pregunta antes
    canDeactivate: [salirDelPedidoGuard],
  },
  {
    // Pedido armado en el Candy bar → elegir película y horario
    path: 'candy/funcion',
    loadComponent: () => import('./pages/candy-funcion/candy-funcion').then(m => m.CandyFuncion),
    canDeactivate: [salirDelPedidoGuard],
  },
  {
    path: 'registro',
    loadComponent: () => import('./pages/registro/registro').then(m => m.Registro),
    // Si ya hay sesión, no tiene sentido registrarse
    canActivate: [sinSesionGuard],
    // Avisa antes de salir con el formulario a medio completar
    canDeactivate: [cambiosSinGuardarGuard],
  },

  // ---------- Área del cliente (requiere sesión) ----------
  {
    path: '',
    canActivate: [authGuard],
    children: [
      {
        // Compras del cliente registrado (entradas + candy, QR único y PDF)
        path: 'mis-compras',
        loadComponent: () => import('./pages/mis-compras/mis-compras').then(m => m.MisCompras),
      },
      {
        // Nombre anterior de la sección
        path: 'mis-entradas',
        redirectTo: 'mis-compras',
      },
      {
        path: 'mis-puntos',
        loadComponent: () => import('./pages/mis-puntos/mis-puntos').then(m => m.MisPuntos),
      },
      {
        path: 'mis-peliculas',
        loadComponent: () => import('./pages/mis-peliculas/mis-peliculas').then(m => m.MisPeliculas),
      },
      {
        path: 'mi-credito',
        loadComponent: () => import('./pages/mi-credito/mi-credito').then(m => m.MiCredito),
      },
    ],
  },

  // ---------- Compra: cliente registrado o invitado (sesión anónima) ----------
  {
    path: 'comprar/:funcion',
    loadComponent: () => import('./pages/compra/compra').then(m => m.Compra),
    canActivate: [compraGuard],
    canDeactivate: [salirDelPedidoGuard],
  },
  {
    // Compra solo de candy (sin entradas)
    path: 'comprar-candy',
    loadComponent: () => import('./pages/compra-candy/compra-candy').then(m => m.CompraCandy),
    canActivate: [compraGuard],
    canDeactivate: [salirDelPedidoGuard],
  },

  // ---------- Panel de empleados ----------
  {
    path: 'admin/login',
    loadComponent: () => import('./pages/admin/admin-login/admin-login').then(m => m.AdminLogin),
    // Si el empleado ya inició sesión, lo manda directo al panel
    canActivate: [loginEmpleadoGuard],
  },
  {
    path: 'admin',
    loadComponent: () => import('./pages/admin/admin-layout/admin-layout').then(m => m.AdminLayout),
    // Solo empleados. Además, cada sección pide su puesto con puestoGuard
    // (los puestos permitidos van en data y salen del modelo de empleados).
    canActivate: [empleadoGuard],
    children: [
      {
        path: '',
        redirectTo: 'inicio',
        pathMatch: 'full',
      },
      {
        path: 'inicio',
        loadComponent: () => import('./pages/admin/inicio/inicio').then(m => m.Inicio),
      },

      // Validación de QR
      {
        path: 'validar-sala',
        loadComponent: () => import('./pages/admin/validar-sala/validar-sala').then(m => m.ValidarSala),
        canActivate: [puestoGuard],
        data: { puestos: puestosDe('validar-sala') },
      },
      {
        path: 'validar-candy',
        loadComponent: () => import('./pages/admin/validar-candy/validar-candy').then(m => m.ValidarCandy),
        canActivate: [puestoGuard],
        data: { puestos: puestosDe('validar-candy') },
      },

      // Películas
      {
        path: 'peliculas',
        loadComponent: () => import('./pages/admin/peliculas/peliculas').then(m => m.Peliculas),
        canActivate: [puestoGuard],
        data: { puestos: puestosDe('peliculas') },
      },
      {
        path: 'peliculas/nueva',
        loadComponent: () => import('./pages/admin/pelicula-form/pelicula-form').then(m => m.PeliculaForm),
        canActivate: [puestoGuard],
        data: { puestos: puestosDe('peliculas') },
        canDeactivate: [cambiosSinGuardarGuard],
      },
      {
        path: 'peliculas/:id/editar',
        loadComponent: () => import('./pages/admin/pelicula-form/pelicula-form').then(m => m.PeliculaForm),
        canActivate: [puestoGuard],
        data: { puestos: puestosDe('peliculas') },
        canDeactivate: [cambiosSinGuardarGuard],
      },

      // Funciones
      {
        path: 'funciones',
        loadComponent: () => import('./pages/admin/funciones/funciones').then(m => m.Funciones),
        canActivate: [puestoGuard],
        data: { puestos: puestosDe('funciones') },
      },
      {
        path: 'funciones/nueva',
        loadComponent: () => import('./pages/admin/funcion-form/funcion-form').then(m => m.FuncionForm),
        canActivate: [puestoGuard],
        data: { puestos: puestosDe('funciones') },
        canDeactivate: [cambiosSinGuardarGuard],
      },
      {
        path: 'funciones/:id/editar',
        loadComponent: () => import('./pages/admin/funcion-form/funcion-form').then(m => m.FuncionForm),
        canActivate: [puestoGuard],
        data: { puestos: puestosDe('funciones') },
        canDeactivate: [cambiosSinGuardarGuard],
      },

      // Salas
      {
        path: 'salas',
        loadComponent: () => import('./pages/admin/salas/salas').then(m => m.Salas),
        canActivate: [puestoGuard],
        data: { puestos: puestosDe('salas') },
      },
      {
        path: 'salas/nueva',
        loadComponent: () => import('./pages/admin/sala-form/sala-form').then(m => m.SalaForm),
        canActivate: [puestoGuard],
        data: { puestos: puestosDe('salas') },
        canDeactivate: [cambiosSinGuardarGuard],
      },
      {
        path: 'salas/:id/editar',
        loadComponent: () => import('./pages/admin/sala-form/sala-form').then(m => m.SalaForm),
        canActivate: [puestoGuard],
        data: { puestos: puestosDe('salas') },
        canDeactivate: [cambiosSinGuardarGuard],
      },
      {
        path: 'salas/:id',
        loadComponent: () => import('./pages/admin/sala-butacas/sala-butacas').then(m => m.SalaButacas),
        canActivate: [puestoGuard],
        data: { puestos: puestosDe('salas') },
      },

      // Productos
      {
        path: 'productos',
        loadComponent: () => import('./pages/admin/productos/productos').then(m => m.Productos),
        canActivate: [puestoGuard],
        data: { puestos: puestosDe('productos') },
      },
      {
        path: 'productos/nuevo',
        loadComponent: () => import('./pages/admin/producto-form/producto-form').then(m => m.ProductoForm),
        canActivate: [puestoGuard],
        data: { puestos: puestosDe('productos') },
        canDeactivate: [cambiosSinGuardarGuard],
      },
      {
        path: 'productos/:id/editar',
        loadComponent: () => import('./pages/admin/producto-form/producto-form').then(m => m.ProductoForm),
        canActivate: [puestoGuard],
        data: { puestos: puestosDe('productos') },
        canDeactivate: [cambiosSinGuardarGuard],
      },
      {
        path: 'productos/categorias',
        loadComponent: () => import('./pages/admin/categorias-producto/categorias-producto').then(m => m.CategoriasProducto),
        canActivate: [puestoGuard],
        data: { puestos: puestosDe('productos') },
      },

      // Combos
      {
        path: 'combos',
        loadComponent: () => import('./pages/admin/combos/combos').then(m => m.Combos),
        canActivate: [puestoGuard],
        data: { puestos: puestosDe('combos') },
      },
      {
        path: 'combos/nuevo',
        loadComponent: () => import('./pages/admin/combo-form/combo-form').then(m => m.ComboForm),
        canActivate: [puestoGuard],
        data: { puestos: puestosDe('combos') },
        canDeactivate: [cambiosSinGuardarGuard],
      },
      {
        path: 'combos/:id/editar',
        loadComponent: () => import('./pages/admin/combo-form/combo-form').then(m => m.ComboForm),
        canActivate: [puestoGuard],
        data: { puestos: puestosDe('combos') },
        canDeactivate: [cambiosSinGuardarGuard],
      },

      // Precios y promociones
      {
        path: 'precios',
        loadComponent: () => import('./pages/admin/precios-promos/precios-promos').then(m => m.PreciosPromos),
        canActivate: [puestoGuard],
        data: { puestos: puestosDe('precios') },
      },
      {
        path: 'precios/promociones/nueva',
        loadComponent: () => import('./pages/admin/promocion-form/promocion-form').then(m => m.PromocionForm),
        canActivate: [puestoGuard],
        data: { puestos: puestosDe('precios') },
        canDeactivate: [cambiosSinGuardarGuard],
      },
      {
        path: 'precios/promociones/:id/editar',
        loadComponent: () => import('./pages/admin/promocion-form/promocion-form').then(m => m.PromocionForm),
        canActivate: [puestoGuard],
        data: { puestos: puestosDe('precios') },
        canDeactivate: [cambiosSinGuardarGuard],
      },

      // Empleados
      {
        path: 'empleados',
        loadComponent: () => import('./pages/admin/empleados/empleados').then(m => m.Empleados),
        canActivate: [puestoGuard],
        data: { puestos: puestosDe('empleados') },
      },
      {
        path: 'empleados/nuevo',
        loadComponent: () => import('./pages/admin/empleado-nuevo/empleado-nuevo').then(m => m.EmpleadoNuevo),
        canActivate: [puestoGuard],
        data: { puestos: puestosDe('empleados') },
        canDeactivate: [cambiosSinGuardarGuard],
      },

      // Reportes y actividad
      {
        path: 'reportes',
        loadComponent: () => import('./pages/admin/reportes/reportes').then(m => m.Reportes),
        canActivate: [puestoGuard],
        data: { puestos: puestosDe('reportes') },
      },
      {
        path: 'actividad',
        loadComponent: () => import('./pages/admin/actividad/actividad').then(m => m.Actividad),
        canActivate: [puestoGuard],
        data: { puestos: puestosDe('actividad') },
      },
    ],
  },

  // ---------- Cualquier otra ruta ----------
  {
    path: '**',
    loadComponent: () => import('./pages/not-found/not-found').then(m => m.NotFound),
  },
];