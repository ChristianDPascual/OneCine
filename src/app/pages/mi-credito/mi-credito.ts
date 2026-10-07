import { Component, OnInit, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ComprasService } from '../../core/services/compras.service';
import { LoadingService } from '../../core/services/loading.service';
import { ResumenCredito } from '../../core/models/compra.model';

// Mi crédito (solo clientes registrados): saldo a favor e historial de movimientos.
// El crédito se genera al devolver entradas o productos y se usa como medio de pago.
@Component({
  selector: 'app-mi-credito',
  imports: [CurrencyPipe, DatePipe, RouterLink],
  templateUrl: './mi-credito.html',
  styleUrl: './mi-credito.css',
})
export class MiCredito implements OnInit {
  private readonly compras = inject(ComprasService);
  private readonly loading = inject(LoadingService);

  protected readonly resumen = signal<ResumenCredito | null>(null);
  protected readonly error = signal(false);

  ngOnInit(): void {
    this.cargar();
  }

  protected async cargar(): Promise<void> {
    this.error.set(false);
    this.loading.mostrar();
    try {
      this.resumen.set(await this.compras.misCreditos());
    } catch (error) {
      console.error('Error al cargar el crédito', error);
      this.error.set(true);
    } finally {
      this.loading.ocultar();
    }
  }
}