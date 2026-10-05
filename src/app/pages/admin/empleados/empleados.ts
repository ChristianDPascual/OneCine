import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EmpleadosService } from '../../../core/services/empleados.service';
import { LoadingService } from '../../../core/services/loading.service';
import { ConfirmacionService } from '../../../core/services/confirmacion.service';
import { Empleado, PUESTOS_QUE_PUEDE_CREAR, puedeGestionar } from '../../../core/models/empleado.model';
import { Alerta } from '../../../components/alerta/alerta';
import { PuestoPipe } from '../../../pipes/puesto.pipe';

@Component({
  selector: 'app-empleados',
  imports: [RouterLink, Alerta, PuestoPipe],
  templateUrl: './empleados.html',
  styleUrl: './empleados.css',
})
export class Empleados {
  private readonly empleadosService = inject(EmpleadosService);
  private readonly loading = inject(LoadingService);
  private readonly confirmacion = inject(ConfirmacionService);

  protected readonly lista = signal<Empleado[]>([]);
  protected readonly mensajeError = signal<string | null>(null);

  // Mensaje que deja el formulario de alta al volver (estado de la navegación)
  protected readonly mensajeExito = signal<string | null>(history.state?.exito ?? null);

  // ¿Puede dar de alta algún puesto? (admin y supervisor)
  protected readonly puedeCrear = computed(() => {
    const actual = this.empleadosService.actual();
    return actual !== null && PUESTOS_QUE_PUEDE_CREAR[actual.puesto].length > 0;
  });

  constructor() {
    this.cargar();
  }

  protected puedeGestionar(empleado: Empleado): boolean {
    const actual = this.empleadosService.actual();
    return actual !== null && puedeGestionar(actual, empleado);
  }

  private async cargar(): Promise<void> {
    this.loading.mostrar();
    try {
      this.lista.set(await this.empleadosService.listar());
    } catch {
      this.mensajeError.set('No pudimos cargar los empleados.');
    } finally {
      this.loading.ocultar();
    }
  }

  protected async alternarActivo(empleado: Empleado): Promise<void> {
    const nombre = `${empleado.nombre} ${empleado.apellido}`;
    const desactivar = empleado.activo;

    const confirmado = await this.confirmacion.preguntar({
      titulo: desactivar ? '¿Desactivar empleado?' : '¿Reactivar empleado?',
      mensaje: desactivar
        ? `${nombre} no va a poder ingresar al panel hasta que lo reactives.`
        : `${nombre} va a poder volver a ingresar al panel.`,
      textoConfirmar: desactivar ? 'Desactivar' : 'Reactivar',
      textoCancelar: 'Cancelar',
    });

    if (!confirmado) {
      return;
    }

    this.mensajeError.set(null);
    this.mensajeExito.set(null);
    this.loading.mostrar();

    try {
      await this.empleadosService.cambiarActivo(empleado.id, !empleado.activo);
      this.lista.update(lista =>
        lista.map(e => (e.id === empleado.id ? { ...e, activo: !e.activo } : e)),
      );
      this.mensajeExito.set(`${nombre} fue ${desactivar ? 'desactivado' : 'reactivado'}.`);
    } catch {
      this.mensajeError.set('No pudimos actualizar el estado del empleado.');
    } finally {
      this.loading.ocultar();
    }
  }
}