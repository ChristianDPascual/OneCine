import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SalasService } from '../../../core/services/salas.service';
import { LoadingService } from '../../../core/services/loading.service';
import { ConfirmacionService } from '../../../core/services/confirmacion.service';
import { DESCRIPCION_FORMATO, SalaConCapacidad } from '../../../core/models/sala.model';
import { Alerta } from '../../../components/alerta/alerta';

@Component({
  selector: 'app-salas',
  imports: [RouterLink, Alerta],
  templateUrl: './salas.html',
  styleUrl: './salas.css',
})
export class Salas {
  private readonly salasService = inject(SalasService);
  private readonly loading = inject(LoadingService);
  private readonly confirmacion = inject(ConfirmacionService);

  protected readonly salas = signal<SalaConCapacidad[]>([]);
  protected readonly cargado = signal(false);
  protected readonly mensajeError = signal<string | null>(null);
  protected readonly mensajeExito = signal<string | null>(history.state?.exito ?? null);

  protected readonly descripcionFormato = DESCRIPCION_FORMATO;

  constructor() {
    this.cargar();
  }

  private async cargar(): Promise<void> {
    this.loading.mostrar();
    try {
      this.salas.set(await this.salasService.listar());
    } catch (error) {
      console.error('Error al cargar las salas', error);
      this.mensajeError.set('No pudimos cargar las salas.');
    } finally {
      this.cargado.set(true);
      this.loading.ocultar();
    }
  }

  protected async eliminar(sala: SalaConCapacidad): Promise<void> {
    const confirmado = await this.confirmacion.preguntar({
      titulo: `¿Eliminar la sala ${sala.numero}?`,
      mensaje: `Se borran también sus ${sala.total} butacas. Esta acción no se puede deshacer.`,
      textoConfirmar: 'Eliminar',
      textoCancelar: 'Cancelar',
    });

    if (!confirmado) {
      return;
    }

    this.mensajeError.set(null);
    this.mensajeExito.set(null);
    this.loading.mostrar();

    try {
      await this.salasService.eliminar(sala.id);
      this.salas.update(lista => lista.filter(s => s.id !== sala.id));
      this.mensajeExito.set(`La sala ${sala.numero} fue eliminada.`);
    } catch (error) {
      console.error('Error al eliminar la sala', error);
      this.mensajeError.set(
        (error as { code?: string } | null)?.code === '23503'
          ? `La sala ${sala.numero} tiene funciones o entradas asociadas: no se puede eliminar.`
          : 'No pudimos eliminar la sala.',
      );
    } finally {
      this.loading.ocultar();
    }
  }
}