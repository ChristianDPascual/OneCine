import { Component, DestroyRef, inject, signal } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs';

// Avisos de la PWA:
//  · "Hay una versión nueva": el service worker ya descargó la actualización → Recargar
//  · "Sin conexión": la app se sigue viendo (está en caché), pero comprar y ver datos necesita internet
@Component({
  selector: 'app-estado-app',
  templateUrl: './estado-app.html',
  styleUrl: './estado-app.css',
})
export class EstadoApp {
  private readonly actualizaciones = inject(SwUpdate);

  protected readonly hayVersionNueva = signal(false);
  protected readonly sinConexion = signal(!navigator.onLine);

  constructor() {
    // SwUpdate solo está activo en producción (en ng serve isEnabled es false)
    if (this.actualizaciones.isEnabled) {
      const sub = this.actualizaciones.versionUpdates
        .pipe(filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY'))
        .subscribe(() => this.hayVersionNueva.set(true));
      inject(DestroyRef).onDestroy(() => sub.unsubscribe());
    }

    const conectado = () => this.sinConexion.set(false);
    const desconectado = () => this.sinConexion.set(true);
    window.addEventListener('online', conectado);
    window.addEventListener('offline', desconectado);
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('online', conectado);
      window.removeEventListener('offline', desconectado);
    });
  }

  protected async actualizar(): Promise<void> {
    await this.actualizaciones.activateUpdate();
    document.location.reload();
  }
}