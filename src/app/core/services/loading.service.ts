import { Injectable, computed, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LoadingService {
  private readonly pendientes = signal(0);

  // true mientras haya al menos una operación en curso
  readonly cargando = computed(() => this.pendientes() > 0);

  mostrar(): void {
    this.pendientes.update(n => n + 1);
  }

  ocultar(): void {
    this.pendientes.update(n => Math.max(0, n - 1));
  }
}