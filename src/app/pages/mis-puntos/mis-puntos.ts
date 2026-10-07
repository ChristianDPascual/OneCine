import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ComprasService } from '../../core/services/compras.service';
import { ConfiguracionService } from '../../core/services/configuracion.service';
import { LoadingService } from '../../core/services/loading.service';
import { ResumenPuntos } from '../../core/models/compra.model';

// Mis puntos (solo clientes registrados): saldo disponible e historial de movimientos.
// El saldo y el "saldo resultante" de cada movimiento los calcula la base (mis_puntos()).
@Component({
  selector: 'app-mis-puntos',
  imports: [DatePipe, DecimalPipe, RouterLink],
  templateUrl: './mis-puntos.html',
  styleUrl: './mis-puntos.css',
})
export class MisPuntos implements OnInit {
  private readonly compras = inject(ComprasService);
  private readonly configuracion = inject(ConfiguracionService);
  private readonly loading = inject(LoadingService);

  protected readonly resumen = signal<ResumenPuntos | null>(null);
  protected readonly error = signal(false);
  // Reglas del negocio para mostrarle al cliente cuánto vale cada cosa
  protected readonly puntosPorPeso = signal<number | null>(null);
  protected readonly puntosEntrada = signal<number | null>(null);

  ngOnInit(): void {
    this.cargar();
  }

  protected async cargar(): Promise<void> {
    this.error.set(false);
    this.loading.mostrar();
    try {
      const [resumen, configuracion] = await Promise.all([
        this.compras.misPuntos(),
        this.configuracion.obtener().catch(() => null),
      ]);
      this.resumen.set(resumen);
      this.puntosPorPeso.set(configuracion?.puntos_por_peso ?? null);
      this.puntosEntrada.set(configuracion?.puntos_entrada_gratis ?? null);
    } catch (error) {
      console.error('Error al cargar los puntos', error);
      this.error.set(true);
    } finally {
      this.loading.ocultar();
    }
  }
}