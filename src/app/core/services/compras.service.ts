import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import {
  CompraConfirmada,
  DescuentoAplicable,
  FilaEstadoButaca,
  FuncionDeCompra,
  FuncionDePelicula,
  ItemCompra,
  MiCompra,
} from '../models/compra.model';

@Injectable({ providedIn: 'root' })
export class ComprasService {
  private readonly supabase = inject(SupabaseService);

  // ---------- Funciones a la venta ----------

  // Próximas funciones programadas de una película (ficha de la película)
  async funcionesDePelicula(peliculaId: number): Promise<FuncionDePelicula[]> {
    const { data, error } = await this.supabase.client
      .from('funciones')
      .select('id, inicio, idioma, precio_base, sala:salas(numero, formato)')
      .eq('pelicula_id', peliculaId)
      .eq('estado', 'programada')
      .gt('inicio', new Date().toISOString())
      .order('inicio')
      .limit(80);

    if (error) {
      throw error;
    }
    return data as unknown as FuncionDePelicula[];
  }

  async funcion(id: number): Promise<FuncionDeCompra | null> {
    const { data, error } = await this.supabase.client
      .from('funciones')
      .select(
        'id, inicio, fin, idioma, precio_base, estado, ' +
        'sala:salas(id, numero, formato), pelicula:peliculas(id, titulo, imagen_url, duracion_min, edad_minima)',
      )
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw error;
    }
    return data as unknown as FuncionDeCompra | null;
  }

  // ---------- Butacas y reservas (funciones de la base) ----------

  async estadoButacas(funcionId: number): Promise<FilaEstadoButaca[]> {
    const { data, error } = await this.supabase.client.rpc('estado_butacas', { p_funcion: funcionId });
    if (error) {
      throw error;
    }
    return (data ?? []) as FilaEstadoButaca[];
  }

  // Verifica y reserva en una sola operación. Devuelve el vencimiento de la reserva.
  async reservar(funcionId: number, butacaId: number): Promise<string> {
    const { data, error } = await this.supabase.client.rpc('reservar_butaca', {
      p_funcion: funcionId,
      p_butaca: butacaId,
    });
    if (error) {
      throw error;
    }
    return data as string;
  }

  async liberar(funcionId: number, butacaId: number): Promise<void> {
    const { error } = await this.supabase.client.rpc('liberar_butaca', { p_funcion: funcionId, p_butaca: butacaId });
    if (error) {
      throw error;
    }
  }

  async liberarTodas(funcionId: number): Promise<void> {
    const { error } = await this.supabase.client.rpc('liberar_reservas', { p_funcion: funcionId });
    if (error) {
      throw error;
    }
  }

  // Descuento de primera compra para el cliente logueado (null si no le corresponde)
  async descuentoPrimeraCompra(): Promise<DescuentoAplicable | null> {
    const { data, error } = await this.supabase.client.rpc('descuento_primera_compra');
    if (error) {
      throw error;
    }
    const fila = (data as DescuentoAplicable[] | null)?.[0];
    return fila ? { ...fila, porcentaje: Number(fila.porcentaje) } : null;
  }

  // Pago simulado: la base valida la reserva, calcula el total y genera las entradas
  async confirmar(funcionId: number, items: ItemCompra[]): Promise<CompraConfirmada> {
    const { data, error } = await this.supabase.client.rpc('confirmar_compra', {
      p_funcion: funcionId,
      p_items: items,
    });
    if (error) {
      throw error;
    }
    return data as CompraConfirmada;
  }

  // ---------- Mis compras ----------

  // Compras del cliente con sus entradas (butaca, función, película) y productos del candy
  async misCompras(clienteId: string): Promise<MiCompra[]> {
    const { data, error } = await this.supabase.client
      .from('compras')
      .select(
        'id, codigo, total, estado, created_at, validada_sala_at, validada_candy_at, ' +
        'entradas(id, precio, tipo_butaca, estado, butaca:butacas(fila, bloque, numero), ' +
        'funcion:funciones(id, inicio, idioma, sala:salas(numero, formato), pelicula:peliculas(titulo, imagen_url, edad_minima))), ' +
        'compra_items(cantidad, precio_unitario, producto:productos(nombre), combo:combos(nombre, incluye_entrada))',
      )
      .eq('cliente_id', clienteId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }
    return data as unknown as MiCompra[];
  }

  // ---------- Tiempo real ----------

  // Avisa cada vez que alguien reserva, libera o compra butacas de esta función.
  // Devuelve la función para dejar de escuchar.
  escucharCambios(funcionId: number, alCambiar: () => void): () => void {
    const canal = this.supabase.client
      .channel(`funcion-${funcionId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reservas_butacas', filter: `funcion_id=eq.${funcionId}` }, alCambiar)
      // Realtime no permite filtrar los DELETE: se escuchan todos y se recarga el estado
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'reservas_butacas' }, alCambiar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'entradas', filter: `funcion_id=eq.${funcionId}` }, alCambiar)
      .subscribe();

    return () => {
      this.supabase.client.removeChannel(canal);
    };
  }
}