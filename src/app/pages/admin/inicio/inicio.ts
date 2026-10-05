import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EmpleadosService } from '../../../core/services/empleados.service';

@Component({
  selector: 'app-inicio',
  imports: [RouterLink],
  templateUrl: './inicio.html',
  styleUrl: './inicio.css',
})
export class Inicio {
  protected readonly empleados = inject(EmpleadosService);
}