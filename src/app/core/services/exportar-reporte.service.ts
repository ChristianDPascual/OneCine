import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { ColumnaReporte, DatosExportacion } from '../models/reporte.model';

const ROJO: [number, number, number] = [214, 40, 40];
const NEGRO: [number, number, number] = [21, 21, 25];
const GRIS: [number, number, number] = [110, 110, 118];
const GRIS_CLARO: [number, number, number] = [243, 243, 245];

// Exporta cualquier reporte (columnas + filas + totales) a PDF o a Excel.
// Los reportes solo arman los datos; el formato del archivo vive acá, en un solo lugar.
@Injectable({ providedIn: 'root' })
export class ExportarReporteService {
  // ---------- PDF (jsPDF, se arma en el navegador) ----------
  pdf(datos: DatosExportacion): void {
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' }); // 210 × 297
    const margen = 14;
    const ancho = 210;
    const alto = 297;
    const anchoUtil = ancho - margen * 2;
    // Primera columna (fecha) más ancha; el resto se reparte
    const anchoFecha = 34;
    const anchoResto = (anchoUtil - anchoFecha) / Math.max(datos.columnas.length - 1, 1);
    const anchos = datos.columnas.map((_, i) => (i === 0 ? anchoFecha : anchoResto));

    // Encabezado
    pdf.setFillColor(...NEGRO);
    pdf.rect(0, 0, ancho, 26, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.text('OneCine', margen, 12);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Reporte de administración', margen, 19);
    pdf.text(`Generado el ${new Date().toLocaleString('es-AR')}`, ancho - margen, 19, { align: 'right' });

    let y = 38;
    pdf.setTextColor(...NEGRO);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(15);
    pdf.text(datos.titulo, margen, y);
    y += 7;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(...GRIS);
    pdf.text(`Del ${fechaLarga(datos.rango.desde)} al ${fechaLarga(datos.rango.hasta)}`, margen, y);
    y += 8;

    // Resumen (tarjetas)
    if (datos.resumen.length > 0) {
      const anchoTarjeta = (anchoUtil - (datos.resumen.length - 1) * 4) / datos.resumen.length;
      datos.resumen.forEach((r, i) => {
        const x = margen + i * (anchoTarjeta + 4);
        pdf.setFillColor(...GRIS_CLARO);
        pdf.roundedRect(x, y, anchoTarjeta, 16, 2, 2, 'F');
        pdf.setFontSize(8);
        pdf.setTextColor(...GRIS);
        pdf.text(r.etiqueta, x + 3, y + 5.5);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(12);
        pdf.setTextColor(...NEGRO);
        pdf.text(r.valor, x + 3, y + 12.5);
        pdf.setFont('helvetica', 'normal');
      });
      y += 24;
    }

    // Tabla
    const altoFila = 7;
    const encabezado = () => {
      pdf.setFillColor(...ROJO);
      pdf.rect(margen, y, anchoUtil, altoFila, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      this.fila(pdf, datos.columnas.map(c => c.titulo), datos.columnas, anchos, margen, y);
      pdf.setFont('helvetica', 'normal');
      y += altoFila;
    };
    encabezado();

    pdf.setFontSize(9);
    datos.filas.forEach((fila, i) => {
      if (y + altoFila > alto - 18) {
        pdf.addPage();
        y = 18;
        encabezado();
        pdf.setFontSize(9);
      }
      if (i % 2 === 1) {
        pdf.setFillColor(...GRIS_CLARO);
        pdf.rect(margen, y, anchoUtil, altoFila, 'F');
      }
      pdf.setTextColor(...NEGRO);
      this.fila(pdf, fila.map((v, c) => formatear(v, datos.columnas[c])), datos.columnas, anchos, margen, y);
      y += altoFila;
    });

    // Totales
    if (y + altoFila > alto - 18) {
      pdf.addPage();
      y = 18;
    }
    pdf.setDrawColor(...NEGRO);
    pdf.line(margen, y, margen + anchoUtil, y);
    pdf.setFont('helvetica', 'bold');
    this.fila(pdf, datos.totales.map((v, c) => formatear(v, datos.columnas[c])), datos.columnas, anchos, margen, y);

    // Pie con número de página
    const paginas = pdf.getNumberOfPages();
    for (let p = 1; p <= paginas; p++) {
      pdf.setPage(p);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(...GRIS);
      pdf.text(`OneCine · ${datos.titulo}`, margen, alto - 8);
      pdf.text(`Página ${p} de ${paginas}`, ancho - margen, alto - 8, { align: 'right' });
    }

    pdf.save(`${this.nombre(datos)}.pdf`);
  }

  // ---------- Excel (SheetJS) ----------
  excel(datos: DatosExportacion): void {
    const filas: (string | number)[][] = [
      [`OneCine · ${datos.titulo}`],
      [`Del ${fechaLarga(datos.rango.desde)} al ${fechaLarga(datos.rango.hasta)}`],
      [],
      datos.columnas.map(c => c.titulo),
      // Fechas como texto dd/mm/aaaa; números y montos como números (se pueden sumar en Excel)
      ...datos.filas.map(fila => fila.map((v, c) => (datos.columnas[c].tipo === 'fecha' ? fechaCorta(String(v)) : v))),
      datos.totales,
    ];

    const hoja = XLSX.utils.aoa_to_sheet(filas);
    hoja['!cols'] = datos.columnas.map((c, i) => ({ wch: i === 0 ? 14 : Math.max(14, c.titulo.length + 2) }));
    hoja['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: datos.columnas.length - 1 } }];

    // Formato de moneda en las columnas de montos
    const primeraFila = 4;
    const ultimaFila = primeraFila + datos.filas.length; // incluye la fila de totales
    datos.columnas.forEach((c, col) => {
      if (c.tipo !== 'moneda') {
        return;
      }
      for (let r = primeraFila; r <= ultimaFila; r++) {
        const celda = hoja[XLSX.utils.encode_cell({ r, c: col })];
        if (celda && typeof celda.v === 'number') {
          celda.z = '"$"#,##0.00';
        }
      }
    });

    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, datos.titulo.slice(0, 31));
    XLSX.writeFile(libro, `${this.nombre(datos)}.xlsx`);
  }

  private nombre(datos: DatosExportacion): string {
    return `OneCine-${datos.archivo}-${datos.rango.desde}_${datos.rango.hasta}`;
  }

  // Una fila de la tabla del PDF: fechas a la izquierda, números a la derecha
  private fila(pdf: jsPDF, celdas: string[], columnas: ColumnaReporte[], anchos: number[], margen: number, y: number): void {
    let x = margen;
    celdas.forEach((texto, i) => {
      if (columnas[i].tipo === 'fecha') {
        pdf.text(texto, x + 2, y + 5);
      } else {
        pdf.text(texto, x + anchos[i] - 2, y + 5, { align: 'right' });
      }
      x += anchos[i];
    });
  }
}

// ---------- Formatos ----------

function formatear(valor: string | number, columna: ColumnaReporte): string {
  if (typeof valor === 'string') {
    return columna.tipo === 'fecha' && /^\d{4}-\d{2}-\d{2}$/.test(valor) ? fechaCorta(valor) : valor;
  }
  if (columna.tipo === 'moneda') {
    // jsPDF usa fuentes Latin-1: "$" y separadores comunes, sin símbolos especiales
    return `$ ${valor.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return valor.toLocaleString('es-AR');
}

// 'AAAA-MM-DD' → 'dd/mm/aaaa'
function fechaCorta(dia: string): string {
  const [a, m, d] = dia.split('-');
  return `${d}/${m}/${a}`;
}

// 'AAAA-MM-DD' → '7 de octubre de 2026'
function fechaLarga(dia: string): string {
  return new Date(`${dia}T12:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
}