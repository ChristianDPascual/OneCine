import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { qrCompra } from '../models/compra.model';

// Datos que lleva el comprobante (sirve para compras con entradas, solo candy, invitado o registrado)
export interface DatosComprobante {
  codigo: string;
  fecha: Date;               // fecha de la compra
  invitado: boolean;
  pelicula?: string;
  funcion?: Date;            // inicio de la función
  sala?: string;             // 'Sala 3 · 2D · Castellano'
  edadMinima?: number;       // 0 = ATP
  butacas: string[];         // ['F7', 'F8 (VIP)']
  productos: string[];       // ['1× Combo familiar']
  subtotal: number;
  descuento: number;
  total: number;
  puntosUsados?: number;     // puntos canjeados (solo clientes registrados)
  creditoUsado?: number;     // crédito a favor usado
  estado?: string;           // 'Pagada', 'Cancelada'…
}

const ROJO: [number, number, number] = [214, 40, 40];
const NEGRO: [number, number, number] = [21, 21, 25];
const GRIS: [number, number, number] = [110, 110, 118];

const precio = (valor: number): string =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(valor);

const fechaLarga = (fecha: Date): string =>
  new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(fecha);

const hora = (fecha: Date): string =>
  new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' }).format(fecha);

// Genera el comprobante en PDF (en el navegador) con el QR único de la compra
@Injectable({ providedIn: 'root' })
export class ComprobanteService {
  async descargar(datos: DatosComprobante): Promise<void> {
    const pdf = new jsPDF({ unit: 'mm', format: 'a5' }); // 148 × 210 mm
    const ancho = pdf.internal.pageSize.getWidth();
    const margen = 14;
    let y = 0;

    // ---------- Encabezado ----------
    pdf.setFillColor(...NEGRO);
    pdf.rect(0, 0, ancho, 26, 'F');
    pdf.setTextColor(...ROJO);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(22);
    pdf.text('One', margen, 16);
    pdf.setTextColor(255, 255, 255);
    pdf.text('Cine', margen + pdf.getTextWidth('One'), 16);
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Comprobante de compra', ancho - margen, 16, { align: 'right' });
    y = 36;

    // ---------- QR único ----------
    const imagenQr = await QRCode.toDataURL(qrCompra(datos.codigo), { width: 400, margin: 1, errorCorrectionLevel: 'M' });
    const lado = 52;
    pdf.addImage(imagenQr, 'PNG', (ancho - lado) / 2, y, lado, lado);
    y += lado + 6;

    pdf.setTextColor(...NEGRO);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(15);
    pdf.text(datos.codigo, ancho / 2, y, { align: 'center' });
    y += 5;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(...GRIS);
    pdf.text('Un solo QR para ingresar a la sala y retirar en el candy bar.', ancho / 2, y, { align: 'center' });
    y += 9;

    // ---------- Función ----------
    if (datos.pelicula && datos.funcion) {
      y = this.titulo(pdf, 'Función', margen, y);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.setTextColor(...NEGRO);
      pdf.text(datos.pelicula, margen, y);
      y += 5.5;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9.5);
      pdf.text(`${fechaLarga(datos.funcion)} · ${hora(datos.funcion)} hs`, margen, y);
      y += 5;
      if (datos.sala) {
        pdf.text(datos.sala, margen, y);
        y += 5;
      }
      if (datos.butacas.length > 0) {
        pdf.text(`Butacas: ${datos.butacas.join(', ')}`, margen, y, { maxWidth: ancho - margen * 2 });
        y += 5;
      }
      if (datos.edadMinima && datos.edadMinima > 0) {
        pdf.setTextColor(...ROJO);
        pdf.text(
          `Película +${datos.edadMinima}: los menores de ${datos.edadMinima} años deben ingresar acompañados de un adulto.`,
          margen, y, { maxWidth: ancho - margen * 2 },
        );
        pdf.setTextColor(...NEGRO);
        y += 9;
      }
      y += 2;
    }

    // ---------- Candy ----------
    if (datos.productos.length > 0) {
      y = this.titulo(pdf, 'Candy bar', margen, y);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9.5);
      pdf.setTextColor(...NEGRO);
      datos.productos.forEach(linea => {
        pdf.text(linea, margen, y);
        y += 5;
      });
      y += 2;
    }

    // ---------- Totales ----------
    y = this.titulo(pdf, 'Pago', margen, y);
    pdf.setFontSize(9.5);
    if (datos.puntosUsados) {
      this.fila(pdf, 'Pagado con puntos', `${datos.puntosUsados.toLocaleString('es-AR')} pts`, margen, ancho, y);
      y += 5;
    }
    if (datos.descuento > 0) {
      this.fila(pdf, 'Subtotal', precio(datos.subtotal), margen, ancho, y);
      y += 5;
      this.fila(pdf, 'Descuento', `- ${precio(datos.descuento)}`, margen, ancho, y);
      y += 5;
    }
    if (datos.creditoUsado) {
      this.fila(pdf, 'Pagado con crédito', `- ${precio(datos.creditoUsado)}`, margen, ancho, y);
      y += 5;
    }
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    this.fila(pdf, datos.creditoUsado ? 'Pagado con dinero' : 'Total', precio(datos.total), margen, ancho, y);
    y += 8;

    // ---------- Pie ----------
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(...GRIS);
    const pie = [
      `Compra realizada el ${fechaLarga(datos.fecha)} a las ${hora(datos.fecha)} hs${datos.estado ? ` · Estado: ${datos.estado}` : ''}.`,
      'Cada parte de la compra (entradas y candy) se puede canjear una sola vez.',
      datos.invitado
        ? 'Compra como invitado: si perdés este comprobante no vas a poder recuperarla desde el sitio.'
        : 'También podés ver esta compra en "Mis compras" de tu cuenta.',
    ];
    pdf.text(pie, margen, Math.max(y + 4, 188), { maxWidth: ancho - margen * 2 });

    pdf.save(`OneCine-${datos.codigo}.pdf`);
  }

  private titulo(pdf: jsPDF, texto: string, x: number, y: number): number {
    pdf.setDrawColor(...ROJO);
    pdf.setLineWidth(0.6);
    pdf.line(x, y - 3.5, x + 8, y - 3.5);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(...ROJO);
    pdf.text(texto.toUpperCase(), x, y);
    return y + 6;
  }

  private fila(pdf: jsPDF, etiqueta: string, valor: string, margen: number, ancho: number, y: number): void {
    pdf.setTextColor(...NEGRO);
    pdf.text(etiqueta, margen, y);
    pdf.text(valor, ancho - margen, y, { align: 'right' });
  }
}