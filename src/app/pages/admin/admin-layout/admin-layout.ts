import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { EmpleadosService } from '../../../core/services/empleados.service';
import { SECCIONES_ADMIN } from '../../../core/models/empleado.model';
import { PuestoPipe } from '../../../pipes/puesto.pipe';

interface Volver {
  link: string[];
  texto: string;
}

@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, PuestoPipe],
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.css',
})
export class AdminLayout {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly empleados = inject(EmpleadosService);

  // URL actual (se actualiza en cada navegación)
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((evento): evento is NavigationEnd => evento instanceof NavigationEnd),
      map(evento => evento.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  // A dónde lleva el botón "Volver" según la URL:
  //   /admin/inicio            → no se muestra
  //   /admin/empleados         → Volver al panel
  //   /admin/empleados/nuevo   → Volver a Empleados
  protected readonly volver = computed<Volver | null>(() => {
    const partes = this.url().split(/[?#]/)[0].split('/').filter(Boolean); // ['admin', 'empleados', 'nuevo']
    const seccion = partes[1];

    if (!seccion || seccion === 'inicio') {
      return null;
    }

    if (partes.length > 2) {
      const titulo = SECCIONES_ADMIN.find(s => s.ruta === seccion)?.titulo ?? 'la sección';
      return { link: ['/admin', seccion], texto: `Volver a ${titulo}` };
    }

    return { link: ['/admin/inicio'], texto: 'Volver al panel' };
  });

  protected async cerrarSesion(): Promise<void> {
    await this.auth.cerrarSesion();
    await this.router.navigate(['/admin/login']);
  }
}
