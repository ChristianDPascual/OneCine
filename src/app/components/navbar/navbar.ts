import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Params, Router, RouterLink } from '@angular/router';
import { LoginPanel } from '../login-panel/login-panel';
import { FiltrosPanel } from '../filtros-panel/filtros-panel';
import { PerfilPanel } from '../perfil-panel/perfil-panel';
import { FiltrosPeliculas } from '../../core/models/pelicula.model';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-navbar',
  imports: [RouterLink, ReactiveFormsModule, LoginPanel, FiltrosPanel, PerfilPanel],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar {
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly auth = inject(AuthService);

  protected readonly loginAbierto = signal(false);
  protected readonly perfilAbierto = signal(false);
  protected readonly filtrosAbierto = signal(false);
  protected readonly menuAbierto = signal(false);

  protected readonly busqueda = this.fb.group({ texto: '' });

  protected alternarMenu(): void {
    this.menuAbierto.update(abierto => !abierto);
  }

  protected cerrarMenu(): void {
    this.menuAbierto.set(false);
  }

  // Sin sesión abre el login; con sesión, el perfil
  protected abrirUsuario(): void {
    this.cerrarMenu();
    if (this.auth.logueado()) {
      this.perfilAbierto.set(true);
    } else {
      this.loginAbierto.set(true);
    }
  }

  protected abrirFiltros(): void {
    this.cerrarMenu();
    this.filtrosAbierto.set(true);
  }

  protected buscarTexto(): void {
    const texto = this.busqueda.controls.texto.value.trim();
    this.irACartelera({ q: texto || null });
  }

  protected buscarConFiltros(filtros: FiltrosPeliculas): void {
    this.irACartelera({
      generos: filtros.generos.length > 0 ? filtros.generos : null,
      edad: filtros.edad,
      lanzamiento: filtros.lanzamiento,
    });
  }

  private irACartelera(queryParams: Params): void {
    this.cerrarMenu();
    this.router.navigate(['/cartelera'], { queryParams, queryParamsHandling: 'merge' });
  }
}