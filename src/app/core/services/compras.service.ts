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
  ResultadoDevolucion,
  ResumenCredito,
  ResumenPuntos,
} from '../models/compra.model';
import { MiPelicula } from '../models/mi-pelicula.model';

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

  // Restricción de edad: false si el cliente logueado es menor que la edad mínima de la película
  async puedoComprar(funcionId: number): Promise<boolean> {
    const { data, error } = await this.supabase.client.rpc('puedo_comprar_funcion', { p_funcion: funcionId });
    if (error) {
      throw error;
    }
    return data !== false;
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

  // Descuento para el cliente logueado (null si no le corresponde ninguno):
  // primera compra o, si no, por edad. La base lo vuelve a calcular al pagar.
  async descuentoPrimeraCompra(): Promise<DescuentoAplicable | null> {
    const { data, error } = await this.supabase.client.rpc('descuento_aplicable');
    if (error) {
      throw error;
    }
    const fila = (data as DescuentoAplicable[] | null)?.[0];
    return fila ? { ...fila, porcentaje: Number(fila.porcentaje) } : null;
  }

  // Pago simulado: la base valida la reserva, calcula el total y genera las entradas
  // entradasConPuntos: cuántas entradas se pagan con puntos (la base elige las más caras)
  // credito: cuánto crédito a favor usar (la base lo recorta a lo que corresponda)
  async confirmar(funcionId: number, items: ItemCompra[], entradasConPuntos = 0, credito = 0): Promise<CompraConfirmada> {
    const { data, error } = await this.supabase.client.rpc('confirmar_compra', {
      p_funcion: funcionId,
      p_items: items,
      p_entradas_puntos: entradasConPuntos,
      p_credito: credito,
    });
    if (error) {
      throw error;
    }
    return data as CompraConfirmada;
  }

  // Compra solo de candy (sin función): la base calcula el total y genera el código
  async confirmarCandy(items: ItemCompra[], credito = 0): Promise<CompraConfirmada> {
    const { data, error } = await this.supabase.client.rpc('confirmar_compra_candy', {
      p_items: items,
      p_credito: credito,
    });
    if (error) {
      throw error;
    }
    return data as CompraConfirmada;
  }

  // ---------- Puntos ----------

  // Saldo disponible e historial (fecha, concepto, obtenidos, utilizados, saldo resultante)
  async misPuntos(): Promise<ResumenPuntos> {
    const { data, error } = await this.supabase.client.rpc('mis_puntos');
    if (error) {
      throw error;
    }
    return (data as ResumenPuntos | null) ?? { disponibles: 0, movimientos: [] };
  }

  // ---------- Mis películas ----------

  // Historial de películas vistas (funciones ya empezadas) con mi calificación
  async misPeliculas(): Promise<MiPelicula[]> {
    const { data, error } = await this.supabase.client.rpc('mis_peliculas');
    if (error) {
      throw error;
    }
    return (data ?? []) as MiPelicula[];
  }

  // ---------- Ranking ----------

  // Top de películas por entradas vendidas (activas). Lo calcula la base.
  async masVendidas(limite = 3): Promise<{ pelicula_id: number; vendidas: number }[]> {
    const { data, error } = await this.supabase.client.rpc('peliculas_mas_vendidas', { p_limite: limite });
    if (error) {
      throw error;
    }
    return ((data ?? []) as { pelicula_id: number; vendidas: number }[]).map(f => ({
      pelicula_id: Number(f.pelicula_id),
      vendidas: Number(f.vendidas),
    }));
  }

  // ---------- Crédito a favor y devoluciones ----------

  // Crédito disponible e historial (fecha, concepto, ingreso, egreso, saldo resultante)
  async misCreditos(): Promise<ResumenCredito> {
    const { data, error } = await this.supabase.client.rpc('mis_creditos');
    if (error) {
      throw error;
    }
    return (data as ResumenCredito | null) ?? { disponible: 0, movimientos: [] };
  }

  // Devuelve una entrada: la base controla el plazo y genera el crédito
  async devolverEntrada(entradaId: number): Promise<ResultadoDevolucion> {
    const { data, error } = await this.supabase.client.rpc('devolver_entrada', { p_entrada: entradaId });
    if (error) {
      throw error;
    }
    return data as ResultadoDevolucion;
  }

  // Devuelve una línea del candy (producto o combo sin entrada)
  async devolverItem(itemId: number): Promise<ResultadoDevolucion> {
    const { data, error } = await this.supabase.client.rpc('devolver_item', { p_item: itemId });
    if (error) {
      throw error;
    }
    return data as ResultadoDevolucion;
  }

  // ---------- Mis compras ----------

  // Mis compras: entradas (butaca, función, película) y productos del candy del cliente registrado
  async misCompras(clienteId: string): Promise<MiCompra[]> {
    const { data, error } = await this.supabase.client
      .from('compras')
      .select(
        'id, codigo, subtotal, monto_descuento, total, credito_usado, puntos_usados, puntos_ganados, estado, created_at, validada_sala_at, validada_candy_at, ' +
        'entradas(id, precio, tipo_butaca, estado, canjeada_con_puntos, butaca:butacas(fila, bloque, numero), ' +
        'funcion:funciones(id, inicio, idioma, sala:salas(numero, formato), pelicula:peliculas(titulo, imagen_url, edad_minima))), ' +
        'compra_items(id, cantidad, precio_unitario, canjeado_con_puntos, devuelto_at, producto:productos(nombre), combo:combos(nombre, incluye_entrada))',
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