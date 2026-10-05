import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { FiltrosLog, LogActividad, PaginaLog } from '../models/log-actividad.model';

const COLUMNAS = 'id, usuario_id, accion, tabla, registro_id, antes, despues, created_at';

// Cantidad de filas recientes que se leen para armar las opciones de los filtros
const MUESTRA_OPCIONES = 1000;

@Injectable({ providedIn: 'root' })
export class LogActividadService {
  private readonly supabase = inject(SupabaseService);

  // Página del log filtrada en la base (no se trae todo al navegador: el log crece siempre)
  async listar(filtros: FiltrosLog, pagina: number, porPagina: number): Promise<PaginaLog> {
    let consulta = this.supabase.client
      .from('log_actividad')
      .select(COLUMNAS, { count: 'exact' })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false });

    if (filtros.tabla) {
      consulta = consulta.eq('tabla', filtros.tabla);
    }
    if (filtros.accion) {
      consulta = consulta.eq('accion', filtros.accion);
    }
    if (filtros.usuario === 'sistema') {
      consulta = consulta.is('usuario_id', null);
    } else if (filtros.usuario) {
      consulta = consulta.eq('usuario_id', filtros.usuario);
    }
    if (filtros.desde) {
      consulta = consulta.gte('created_at', inicioDelDia(filtros.desde));
    }
    if (filtros.hasta) {
      consulta = consulta.lt('created_at', inicioDelDia(filtros.hasta, 1));
    }
    if (filtros.registro) {
      consulta = consulta.eq('registro_id', filtros.registro);
    }

    const desde = (pagina - 1) * porPagina;
    const { data, error, count } = await consulta.range(desde, desde + porPagina - 1);

    if (error) {
      throw error;
    }

    return { filas: data as LogActividad[], total: count ?? 0 };
  }

  // PostgREST no tiene "select distinct": se toman los valores de las filas más recientes
  async opcionesFiltros(): Promise<{ tablas: string[]; acciones: string[] }> {
    const { data, error } = await this.supabase.client
      .from('log_actividad')
      .select('tabla, accion')
      .order('created_at', { ascending: false })
      .limit(MUESTRA_OPCIONES);

    if (error) {
      throw error;
    }

    const filas = data as { tabla: string; accion: string }[];
    return {
      tablas: [...new Set(filas.map(f => f.tabla))].sort(),
      acciones: [...new Set(filas.map(f => f.accion))].sort(),
    };
  }

  // Nombres de los clientes que aparecen en la página (los empleados se buscan aparte)
  async nombresClientes(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) {
      return new Map();
    }

    const { data, error } = await this.supabase.client
      .from('clientes')
      .select('id, nombre, apellido')
      .in('id', ids);

    if (error) {
      throw error;
    }

    return new Map(
      (data as { id: string; nombre: string; apellido: string }[]).map(c => [c.id, `${c.nombre} ${c.apellido}`]),
    );
  }
}

// 'YYYY-MM-DD' en hora local → ISO (UTC) para comparar con timestamptz
function inicioDelDia(fecha: string, sumarDias = 0): string {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return new Date(anio, mes - 1, dia + sumarDias).toISOString();
}