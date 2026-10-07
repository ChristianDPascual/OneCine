import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EmpleadosService } from '../../../core/services/empleados.service';
import { ValidadorQr } from '../../../components/validador-qr/validador-qr';
import { TipoCanje } from '../../../core/services/validacion.service';

@Component({
  selector: 'app-inicio',
  imports: [RouterLink, ValidadorQr],
  templateUrl: './inicio.html',
  styleUrl: './inicio.css',
})
export class Inicio {
  protected readonly empleados = inject(EmpleadosService);

  // Boletería y confitería tienen una sola tarea: el escáner va directo en el inicio.
  // Admin y supervisor siguen viendo las tarjetas de todas sus secciones.
  protected readonly canje = computed<TipoCanje | null>(() => {
    switch (this.empleados.actual()?.puesto) {
      case 'boleteria':
        return 'sala';
      case 'confiteria':
        return 'candy';
      default:
        return null;
    }
  });
}