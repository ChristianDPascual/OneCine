import { Component, computed, forwardRef, input, signal } from '@angular/core';
import {
  AbstractControl,
  ControlValueAccessor,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ValidationErrors,
  Validator,
} from '@angular/forms';

export const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const ANIO_MINIMO = 1901; // el año tiene que ser mayor a 1900

// Días que tiene un mes (mes 1-12). Sin año, febrero se toma con 29 hasta saber si es bisiesto.
export function diasDelMes(mes: number, anio: number | null): number {
  return new Date(anio ?? 2000, mes, 0).getDate();
}

const dos = (n: number) => String(n).padStart(2, '0');

// Campo de fecha en 3 partes: día (número) · mes (select con el nombre) · año (número).
// Funciona con formControlName como cualquier input: su valor es 'AAAA-MM-DD'
// (o '' si está vacío o incompleto) y valida solo la fecha (día del mes, febrero, año > 1900).
@Component({
  selector: 'app-campo-fecha',
  templateUrl: './campo-fecha.html',
  styleUrl: './campo-fecha.css',
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => CampoFecha), multi: true },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => CampoFecha), multi: true },
  ],
})
export class CampoFecha implements ControlValueAccessor, Validator {
  // id del cuadro del día (para el <label for="...">)
  readonly inputId = input('');

  protected readonly meses = MESES;

  protected readonly dia = signal<number | null>(null);
  protected readonly mes = signal<number | null>(null); // 1-12
  protected readonly anio = signal<number | null>(null);
  protected readonly deshabilitado = signal(false);

  // ---------- Validación ----------

  protected readonly vacio = computed(() => this.dia() === null && this.mes() === null && this.anio() === null);
  protected readonly completo = computed(() => this.dia() !== null && this.mes() !== null && this.anio() !== null);

  protected readonly maximoDias = computed(() => {
    const mes = this.mes();
    return mes === null ? 31 : diasDelMes(mes, this.anioValido() ? this.anio() : null);
  });

  private readonly anioValido = computed(() => {
    const anio = this.anio();
    return anio !== null && Number.isInteger(anio) && anio >= ANIO_MINIMO && anio <= 9999;
  });

  protected readonly errorDia = computed(() => {
    const dia = this.dia();
    if (dia === null) {
      return null;
    }
    if (!Number.isInteger(dia) || dia < 1 || dia > 31) {
      return 'El día tiene que estar entre 1 y 31.';
    }
    const mes = this.mes();
    if (mes !== null && dia > this.maximoDias()) {
      if (mes === 2) {
        return this.anioValido()
          ? `Febrero de ${this.anio()} tiene ${this.maximoDias()} días.`
          : 'Febrero tiene como máximo 29 días.';
      }
      return `${MESES[mes - 1][0].toUpperCase()}${MESES[mes - 1].slice(1)} tiene ${this.maximoDias()} días.`;
    }
    return null;
  });

  protected readonly errorAnio = computed(() =>
    this.anio() !== null && !this.anioValido() ? 'El año tiene que ser mayor a 1900.' : null,
  );

  // Mensaje que se muestra debajo del campo
  protected readonly mensaje = computed(() => this.errorDia() ?? this.errorAnio());

  // ---------- ControlValueAccessor ----------

  private alCambiar: (valor: string) => void = () => undefined;
  private alTocar: () => void = () => undefined;

  writeValue(valor: string | null): void {
    const partes = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor ?? '');
    this.anio.set(partes ? Number(partes[1]) : null);
    this.mes.set(partes ? Number(partes[2]) : null);
    this.dia.set(partes ? Number(partes[3]) : null);
  }

  registerOnChange(fn: (valor: string) => void): void {
    this.alCambiar = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.alTocar = fn;
  }

  setDisabledState(deshabilitado: boolean): void {
    this.deshabilitado.set(deshabilitado);
  }

  // ---------- Validator (lo usa el formulario) ----------

  validate(_control: AbstractControl): ValidationErrors | null {
    if (this.vacio()) {
      return null; // si es obligatorio, lo informa Validators.required
    }
    if (!this.completo()) {
      return { fechaIncompleta: true };
    }
    if (this.errorDia() || this.errorAnio()) {
      return { fechaInvalida: this.mensaje() };
    }
    return null;
  }

  // ---------- Eventos de los 3 cuadros ----------

  protected cambiarDia(texto: string): void {
    this.dia.set(texto === '' ? null : Number(texto));
    this.emitir();
  }

  protected cambiarMes(texto: string): void {
    this.mes.set(texto === '' ? null : Number(texto));
    this.emitir();
  }

  protected cambiarAnio(texto: string): void {
    this.anio.set(texto === '' ? null : Number(texto));
    this.emitir();
  }

  protected tocar(): void {
    this.alTocar();
  }

  // Valor para el formulario: 'AAAA-MM-DD' solo si la fecha es válida y completa
  private emitir(): void {
    const valida = this.completo() && !this.errorDia() && !this.errorAnio();
    this.alCambiar(valida ? `${this.anio()}-${dos(this.mes()!)}-${dos(this.dia()!)}` : '');
  }
}