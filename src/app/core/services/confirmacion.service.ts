import { Injectable, signal } from '@angular/core';

export interface OpcionesConfirmacion {
  titulo: string;
  mensaje: string;
  textoConfirmar: string;
  textoCancelar: string;
}

interface PedidoConfirmacion extends OpcionesConfirmacion {
  resolver: (respuesta: boolean) => void;
}

@Injectable({ providedIn: 'root' })
export class ConfirmacionService {
  private readonly pedidoActual = signal<PedidoConfirmacion | null>(null);

  readonly pedido = this.pedidoActual.asReadonly();

  preguntar(opciones: OpcionesConfirmacion): Promise<boolean> {
    // Si había una pregunta sin responder, se da por cancelada
    this.pedidoActual()?.resolver(false);

    return new Promise<boolean>(resolver => {
      this.pedidoActual.set({ ...opciones, resolver });
    });
  }

  responder(respuesta: boolean): void {
    this.pedidoActual()?.resolver(respuesta);
    this.pedidoActual.set(null);
  }
}