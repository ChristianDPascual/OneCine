import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ComprasService } from '../../core/services/compras.service';
import { AuthService } from '../../core/services/auth.service';
import { MiCompra, qrCandy, qrSala } from '../../core/models/compra.model';
import { CodigoQr } from '../../components/codigo-qr/codigo-qr';
import { Alerta } from '../../components/alerta/alerta';

type Pestana = 'proximas' | 'pasadas';

// Una compra lista para mostrar: datos de la función + butacas + candy
interface Tarjeta {
  compra: MiCompra;
  titulo: string;
  imagen: string | null;
  inicio: Date;
  sala: string;
  idioma: string;
  butacas: { etiqueta: string; vip: boolean }[];
  candy: string[];
  cancelada: boolean;
}

@Component({
  selector: 'app-mis-entradas',
  imports: [CurrencyPipe, DatePipe, RouterLink, CodigoQr, Alerta],
  templateUrl: './mis-entradas.html',
  styleUrl: './mis-entradas.css',
})
export class MisEntradas {
  private readonly compras = inject(ComprasService);
  private readonly auth = inject(AuthService);

  protected readonly cargando = signal(true);
  protected readonly mensajeError = signal<string | null>(null);
  protected readonly pestana = signal<Pestana>('proximas');
  // Compra con el QR abierto en grande (para mostrar en la puerta)
  protected readonly ampliado = signal<{ valor: string; titulo: string } | null>(null);

  private readonly lista = signal<MiCompra[]>([]);

  protected readonly qrSala = qrSala;
  protected readonly qrCandy = qrCandy;

  private readonly tarjetas = computed<Tarjeta[]>(() =>
    this.lista()
      .filter(c => c.entradas.length > 0)
      .map(compra => {
        const funcion = compra.entradas[0].funcion;
        return {
          compra,
          titulo: funcion.pelicula.titulo,
          imagen: funcion.pelicula.imagen_url,
          inicio: new Date(funcion.inicio),
          sala: `Sala ${funcion.sala.numero} · ${funcion.sala.formato}`,
          idioma: funcion.idioma === 'subtitulada' ? 'Subtitulada' : 'Castellano',
          butacas: compra.entradas
            .filter(e => e.estado === 'activa')
            .map(e => ({ etiqueta: `${e.butaca.fila.trim()}${e.butaca.numero}`, vip: e.tipo_butaca === 'vip' }))
            .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, undefined, { numeric: true })),
          candy: compra.compra_items.map(i => `${i.cantidad}× ${i.producto?.nombre ?? i.combo?.nombre ?? 'Producto'}`),
          cancelada: compra.estado !== 'pagada',
        };
      }),
  );

  // Próximas: de la más cercana a la más lejana · Pasadas: de la más reciente a la más vieja
  protected readonly proximas = computed(() =>
    this.tarjetas().filter(t => t.inicio > new Date() && !t.cancelada).sort((a, b) => +a.inicio - +b.inicio),
  );
  protected readonly pasadas = computed(() =>
    this.tarjetas().filter(t => t.inicio <= new Date() || t.cancelada).sort((a, b) => +b.inicio - +a.inicio),
  );
  protected readonly visibles = computed(() => (this.pestana() === 'proximas' ? this.proximas() : this.pasadas()));

  constructor() {
    this.cargar();
  }

  private async cargar(): Promise<void> {
    try {
      await this.auth.esperarInicio();
      const usuario = this.auth.usuario();
      if (!usuario) {
        return;
      }
      this.lista.set(await this.compras.misCompras(usuario.id));
    } catch (error) {
      console.error('Error al cargar mis entradas', error);
      this.mensajeError.set('No pudimos cargar tus entradas. Recargá la página.');
    } finally {
      this.cargando.set(false);
    }
  }
}