import { Component, DestroyRef, ElementRef, HostListener, computed, inject, input, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import jsQR from 'jsqr';
import { TipoCanje, ValidacionService } from '../../core/services/validacion.service';
import { LoadingService } from '../../core/services/loading.service';
import { CompraValidacion, mensajeErrorCompra } from '../../core/models/compra.model';

// Validador del QR único de la compra. Lo usan boletería (tipo 'sala') y candy (tipo 'candy').
//  1. Se escanea el QR con la cámara (jsQR) o se escribe el código a mano.
//  2. Se abre una ventana con el listado de lo que se va a canjear en ESTE puesto
//     (butacas o productos) y el estado de la otra parte.
//  3. El empleado confirma el canje, o vuelve atrás sin usar el QR.
// La base garantiza que cada parte se canjee una sola vez.
@Component({
  selector: 'app-validador-qr',
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: './validador-qr.html',
  styleUrl: './validador-qr.css',
})
export class ValidadorQr {
  readonly tipo = input.required<TipoCanje>();

  private readonly validacion = inject(ValidacionService);
  private readonly loading = inject(LoadingService);
  private readonly video = viewChild.required<ElementRef<HTMLVideoElement>>('video');
  // Ventana de confirmación. No es un <dialog> modal: el modal se dibuja en el "top layer"
  // y taparía el spinner de carga de la app (LoadingService). Así se usa el mismo spinner.
  protected readonly ventanaAbierta = signal(false);
  private readonly botonPrincipal = viewChild<ElementRef<HTMLButtonElement>>('principal');
  // true cuando el canje se confirmó (la ventana muestra el resultado y "Leer otro código")
  protected readonly canjeado = signal(false);

  protected readonly codigoManual = new FormControl('', { nonNullable: true, validators: Validators.required });

  protected readonly escaneando = signal(false);
  protected readonly procesando = signal(false);
  protected readonly compra = signal<CompraValidacion | null>(null);
  protected readonly mensajeError = signal<string | null>(null);
  protected readonly mensajeExito = signal<string | null>(null);

  private stream: MediaStream | null = null;
  private cuadro = 0;
  private readonly lienzo = document.createElement('canvas');

  // ---------- Estado de la compra para este puesto ----------
  protected readonly tieneLoMio = computed(() => {
    const c = this.compra();
    if (!c) {
      return false;
    }
    return this.tipo() === 'sala' ? c.butacas.length > 0 : c.items.length > 0;
  });

  protected readonly yaCanjeado = computed(() => {
    const c = this.compra();
    if (!c) {
      return null;
    }
    return this.tipo() === 'sala' ? c.validada_sala_at : c.validada_candy_at;
  });

  protected readonly puedeCanjear = computed(
    () => !!this.compra() && this.compra()!.estado === 'pagada' && this.tieneLoMio() && !this.yaCanjeado(),
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => this.detenerCamara());
  }

  // ---------- Cámara ----------

  protected async iniciarCamara(): Promise<void> {
    this.limpiarMensajes();
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      const video = this.video().nativeElement;
      video.srcObject = this.stream;
      await video.play();
      this.escaneando.set(true);
      this.cuadro = requestAnimationFrame(() => this.leerCuadro());
    } catch (error) {
      console.error('No se pudo abrir la cámara', error);
      this.mensajeError.set('No pudimos abrir la cámara. Revisá los permisos del navegador o ingresá el código a mano.');
      this.detenerCamara();
    }
  }

  protected detenerCamara(): void {
    cancelAnimationFrame(this.cuadro);
    this.stream?.getTracks().forEach(pista => pista.stop());
    this.stream = null;
    this.escaneando.set(false);
  }

  // Se analiza cada cuadro del video hasta encontrar un QR
  private leerCuadro(): void {
    if (!this.escaneando()) {
      return;
    }
    const video = this.video().nativeElement;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      this.lienzo.width = video.videoWidth;
      this.lienzo.height = video.videoHeight;
      const contexto = this.lienzo.getContext('2d', { willReadFrequently: true });
      if (contexto) {
        contexto.drawImage(video, 0, 0, this.lienzo.width, this.lienzo.height);
        const imagen = contexto.getImageData(0, 0, this.lienzo.width, this.lienzo.height);
        const qr = jsQR(imagen.data, imagen.width, imagen.height, { inversionAttempts: 'dontInvert' });
        if (qr?.data) {
          this.detenerCamara();
          this.buscar(qr.data);
          return;
        }
      }
    }
    this.cuadro = requestAnimationFrame(() => this.leerCuadro());
  }

  // ---------- Código a mano ----------

  protected buscarManual(evento?: Event): void {
    evento?.preventDefault(); // que el form no recargue la página
    if (this.procesando()) {
      return;
    }
    if (this.codigoManual.invalid) {
      this.codigoManual.markAsTouched();
      return;
    }
    this.buscar(this.codigoManual.value);
  }

  // ---------- Consultar y canjear ----------

  private async buscar(texto: string): Promise<void> {
    this.limpiarMensajes();
    this.compra.set(null);
    this.procesando.set(true);
    this.loading.mostrar();
    try {
      this.compra.set(await this.validacion.consultar(texto));
      // Listado para confirmar o volver atrás (todavía no se usó el QR)
      this.canjeado.set(false);
      this.ventanaAbierta.set(true);
      // Foco en el botón principal (confirmar o volver) para usarlo con Enter
      setTimeout(() => this.botonPrincipal()?.nativeElement.focus());
    } catch (error) {
      this.mensajeError.set(mensajeErrorCompra(error, 'No pudimos leer el código. Intentá de nuevo.'));
    } finally {
      this.procesando.set(false);
      this.loading.ocultar();
    }
  }

  protected async canjear(): Promise<void> {
    const compra = this.compra();
    if (!compra || !this.puedeCanjear() || this.procesando()) {
      return;
    }
    this.limpiarMensajes();
    this.procesando.set(true);
    this.loading.mostrar(); // el spinner de carga de la app
    try {
      this.compra.set(await this.validacion.validar(compra.codigo, this.tipo()));
      this.canjeado.set(true);
      this.mensajeExito.set(
        this.tipo() === 'sala'
          ? `Compra ${compra.codigo}: ingreso validado (${compra.butacas.length} ${compra.butacas.length === 1 ? 'entrada' : 'entradas'}).`
          : `Compra ${compra.codigo}: productos entregados.`,
      );
    } catch (error) {
      this.mensajeError.set(mensajeErrorCompra(error, 'No pudimos validar la compra. Intentá de nuevo.'));
    } finally {
      this.procesando.set(false);
      this.loading.ocultar();
      setTimeout(() => this.botonPrincipal()?.nativeElement.focus());
    }
  }

  protected nuevaLectura(): void {
    this.limpiarMensajes();
    this.compra.set(null);
    this.codigoManual.reset('');
  }

  // "Volver sin canjear" o "Listo": cierra la ventana. Si no se confirmó, el QR queda sin usar.
  // Mientras se valida no se cierra (el empleado tiene que ver el resultado)
  protected cerrarVentana(): void {
    if (this.procesando() || !this.ventanaAbierta()) {
      return;
    }
    this.ventanaAbierta.set(false);
    this.alCerrarVentana();
  }

  // Escape cierra la ventana (igual que "Volver sin usar el QR")
  @HostListener('document:keydown.escape')
  protected alEscape(): void {
    this.cerrarVentana();
  }

  // Al cerrar: queda listo para leer otro código
  private alCerrarVentana(): void {
    if (!this.canjeado()) {
      this.mensajeError.set(null);
      this.mensajeExito.set(null);
    }
    this.compra.set(null);
    this.codigoManual.reset('');
    this.canjeado.set(false);
  }

  private limpiarMensajes(): void {
    this.mensajeError.set(null);
    this.mensajeExito.set(null);
  }
}