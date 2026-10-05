import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { LoadingService } from './core/services/loading.service';
import { ConfirmacionService } from './core/services/confirmacion.service';
import { Navbar } from './components/navbar/navbar';
import { Confirmacion } from './components/confirmacion/confirmacion';

@Component({
  imports: [RouterOutlet, Navbar, Confirmacion],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  private readonly router = inject(Router);

  protected readonly title = signal('OneCine');
  protected readonly loading = inject(LoadingService);
  protected readonly confirmacion = inject(ConfirmacionService);

  // true mientras la URL esté dentro de /admin
  protected readonly enAdmin = toSignal(
    this.router.events.pipe(
      filter((evento): evento is NavigationEnd => evento instanceof NavigationEnd),
      map(evento => evento.urlAfterRedirects.startsWith('/admin')),
    ),
    { initialValue: window.location.pathname.startsWith('/admin') },
  );
}