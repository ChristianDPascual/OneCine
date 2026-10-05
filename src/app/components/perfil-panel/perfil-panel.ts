import { Component, ElementRef, afterNextRender, inject, output, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ClientesService } from '../../core/services/clientes.service';
import { EntradasService } from '../../core/services/entradas.service';

@Component({
  selector: 'app-perfil-panel',
  imports: [RouterLink],
  templateUrl: './perfil-panel.html',
  styleUrl: './perfil-panel.css',
})
export class PerfilPanel {
  readonly cerrar = output<void>();

  private readonly dialogo = viewChild.required<ElementRef<HTMLDialogElement>>('dialogo');
  private readonly auth = inject(AuthService);
  private readonly clientes = inject(ClientesService);
  private readonly router = inject(Router);
  private readonly entradas = inject(EntradasService);

  protected readonly nombre = signal<string | null>(null);
  protected readonly cerrandoSesion = signal(false);
  protected readonly mostrarCredito = signal(false);

  constructor() {
    afterNextRender(() => this.dialogo().nativeElement.showModal());
    this.cargarNombre();
    this.verificarCredito();
  }

  private async cargarNombre(): Promise<void> {
    const id = this.auth.usuario()?.id;
    if (!id) {
      return;
    }

    try {
      this.nombre.set(await this.clientes.obtenerNombre(id));
    } catch {
      // Si falla, el saludo queda como "Hola" sin nombre
    }
  }

  private async verificarCredito(): Promise<void> {
    const id = this.auth.usuario()?.id;
    if (!id) {
      return;
    }

    try {
      this.mostrarCredito.set(await this.entradas.tieneEntradasCanceladas(id));
    } catch {
      // Si falla, la opción simplemente no se muestra
    }
  }

  protected cerrarPanel(): void {
    this.dialogo().nativeElement.close();
  }

  protected async cerrarSesion(): Promise<void> {
    this.cerrandoSesion.set(true);
    await this.auth.cerrarSesion();
    this.cerrarPanel();
    await this.router.navigate(['/']);
  }

  protected cerrarSiClicFuera(evento: MouseEvent): void {
    if (evento.target === evento.currentTarget) {
      this.cerrarPanel();
    }
  }
}
