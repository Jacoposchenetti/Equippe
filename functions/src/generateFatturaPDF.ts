/**
 * Generatore PDF "copia di cortesia" per fatture.
 * Usa PDFKit per creare un PDF professionale con layout standard.
 */

import PDFDocument from 'pdfkit';

interface PdfCedenteData {
  nome: string;
  cognome: string;
  partitaIva: string;
  codiceFiscale: string;
  indirizzo: string;
  cap: string;
  città: string;
  provincia: string;
  email?: string;
  iban?: string;
}

interface PdfClienteData {
  tipo: 'persona_fisica' | 'persona_giuridica';
  nome?: string;
  cognome?: string;
  ragioneSociale?: string;
  codiceFiscale: string;
  partitaIva?: string;
  indirizzo: string;
  cap: string;
  città: string;
  provincia: string;
}

interface PdfRiga {
  descrizione: string;
  quantita: number;
  prezzoUnitario: number;
  totale: number;
  iva: string; // es. "22%", "Esente N4"
}

interface PdfTotali {
  imponibile: number;
  cassaPrevidenziale: number;
  cassaLabel: string;
  totaleIva: number;
  ritenuataAcconto: number;
  bolloVirtuale: number;
  totaleDocumento: number;
  nettoAPagare: number;
}

export interface GeneratePdfInput {
  // Tipo documento
  tipoDocumento: string; // "Fattura", "Proforma", "Nota di Credito"
  numero: string;        // es. "1/2026"
  data: string;          // es. "12/04/2026"

  // Riferimento nota credito
  riferimentoFattura?: string;

  cedente: PdfCedenteData;
  cliente: PdfClienteData;
  righe: PdfRiga[];
  totali: PdfTotali;

  metodoPagamento: string;
  note?: string;
  diciture: string[];   // Diciture legali (bollo, forfettario, esenzione)
}

function formatEur(n: number): string {
  return n.toFixed(2).replace('.', ',') + ' €';
}

/**
 * Genera il PDF e restituisce un Buffer.
 */
export function generateFatturaPDF(input: GeneratePdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `${input.tipoDocumento} ${input.numero}`,
          Author: `${input.cedente.nome} ${input.cedente.cognome}`,
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth = doc.page.width - 100; // margins

      // === HEADER ===
      doc.fontSize(20).font('Helvetica-Bold')
        .text(input.tipoDocumento.toUpperCase(), 50, 50);

      doc.fontSize(11).font('Helvetica')
        .text(`N. ${input.numero}`, 50, 75)
        .text(`Data: ${input.data}`, 50, 90);

      if (input.riferimentoFattura) {
        doc.text(`Rif. fattura: ${input.riferimentoFattura}`, 50, 105);
      }

      // Linea separatrice
      doc.moveTo(50, 120).lineTo(50 + pageWidth, 120).stroke('#0066cc');

      // === CEDENTE (sinistra) ===
      let y = 135;
      doc.fontSize(9).font('Helvetica-Bold').text('DA:', 50, y);
      y += 14;
      doc.font('Helvetica-Bold').fontSize(10)
        .text(`${input.cedente.nome} ${input.cedente.cognome}`, 50, y);
      y += 14;
      doc.font('Helvetica').fontSize(9)
        .text(input.cedente.indirizzo, 50, y);
      y += 12;
      doc.text(`${input.cedente.cap} ${input.cedente.città} (${input.cedente.provincia})`, 50, y);
      y += 12;
      doc.text(`P.IVA: ${input.cedente.partitaIva}`, 50, y);
      y += 12;
      doc.text(`C.F.: ${input.cedente.codiceFiscale}`, 50, y);
      if (input.cedente.email) {
        y += 12;
        doc.text(`Email: ${input.cedente.email}`, 50, y);
      }

      // === CLIENTE (destra) ===
      let yRight = 135;
      const rightCol = 320;
      doc.fontSize(9).font('Helvetica-Bold').text('A:', rightCol, yRight);
      yRight += 14;
      if (input.cliente.tipo === 'persona_giuridica' && input.cliente.ragioneSociale) {
        doc.font('Helvetica-Bold').fontSize(10)
          .text(input.cliente.ragioneSociale, rightCol, yRight, { width: 230 });
      } else {
        doc.font('Helvetica-Bold').fontSize(10)
          .text(`${input.cliente.nome || ''} ${input.cliente.cognome || ''}`, rightCol, yRight, { width: 230 });
      }
      yRight += 14;
      doc.font('Helvetica').fontSize(9)
        .text(input.cliente.indirizzo, rightCol, yRight, { width: 230 });
      yRight += 12;
      doc.text(`${input.cliente.cap} ${input.cliente.città} (${input.cliente.provincia})`, rightCol, yRight, { width: 230 });
      yRight += 12;
      doc.text(`C.F.: ${input.cliente.codiceFiscale}`, rightCol, yRight, { width: 230 });
      if (input.cliente.partitaIva) {
        yRight += 12;
        doc.text(`P.IVA: ${input.cliente.partitaIva}`, rightCol, yRight, { width: 230 });
      }

      // === TABELLA PRESTAZIONI ===
      let tableY = Math.max(y, yRight) + 30;

      // Header tabella
      doc.rect(50, tableY, pageWidth, 20).fill('#0066cc');
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8);
      doc.text('DESCRIZIONE', 55, tableY + 6, { width: 230 });
      doc.text('QTÀ', 290, tableY + 6, { width: 40, align: 'right' });
      doc.text('PREZZO', 335, tableY + 6, { width: 70, align: 'right' });
      doc.text('IVA', 410, tableY + 6, { width: 50, align: 'right' });
      doc.text('TOTALE', 465, tableY + 6, { width: 80, align: 'right' });
      doc.fillColor('#000000');

      tableY += 20;

      // Righe tabella
      doc.font('Helvetica').fontSize(8);
      for (let i = 0; i < input.righe.length; i++) {
        const riga = input.righe[i];
        const bgColor = i % 2 === 0 ? '#f8f9fa' : '#ffffff';
        doc.rect(50, tableY, pageWidth, 18).fill(bgColor);
        doc.fillColor('#000000');

        doc.text(riga.descrizione, 55, tableY + 5, { width: 230 });
        doc.text(riga.quantita.toString(), 290, tableY + 5, { width: 40, align: 'right' });
        doc.text(formatEur(riga.prezzoUnitario), 335, tableY + 5, { width: 70, align: 'right' });
        doc.text(riga.iva, 410, tableY + 5, { width: 50, align: 'right' });
        doc.text(formatEur(riga.totale), 465, tableY + 5, { width: 80, align: 'right' });

        tableY += 18;
      }

      // Linea sotto tabella
      doc.moveTo(50, tableY).lineTo(50 + pageWidth, tableY).stroke('#cccccc');

      // === TOTALI (allineati a destra) ===
      tableY += 15;
      const totalsX = 370;
      const totalsValueX = 465;
      const totalsWidth = 80;

      doc.font('Helvetica').fontSize(9);

      doc.text('Imponibile:', totalsX, tableY, { width: 90, align: 'right' });
      doc.text(formatEur(input.totali.imponibile), totalsValueX, tableY, { width: totalsWidth, align: 'right' });
      tableY += 14;

      if (input.totali.cassaPrevidenziale > 0) {
        doc.text(input.totali.cassaLabel + ':', totalsX, tableY, { width: 90, align: 'right' });
        doc.text(formatEur(input.totali.cassaPrevidenziale), totalsValueX, tableY, { width: totalsWidth, align: 'right' });
        tableY += 14;
      }

      if (input.totali.totaleIva > 0) {
        doc.text('IVA:', totalsX, tableY, { width: 90, align: 'right' });
        doc.text(formatEur(input.totali.totaleIva), totalsValueX, tableY, { width: totalsWidth, align: 'right' });
        tableY += 14;
      }

      if (input.totali.bolloVirtuale > 0) {
        doc.text('Bollo virtuale:', totalsX, tableY, { width: 90, align: 'right' });
        doc.text(formatEur(input.totali.bolloVirtuale), totalsValueX, tableY, { width: totalsWidth, align: 'right' });
        tableY += 14;
      }

      // Linea prima del totale
      doc.moveTo(totalsX, tableY).lineTo(totalsValueX + totalsWidth, tableY).stroke('#0066cc');
      tableY += 5;

      doc.font('Helvetica-Bold').fontSize(11);
      doc.text('TOTALE:', totalsX, tableY, { width: 90, align: 'right' });
      doc.text(formatEur(input.totali.totaleDocumento), totalsValueX, tableY, { width: totalsWidth, align: 'right' });
      tableY += 18;

      if (input.totali.ritenuataAcconto > 0) {
        doc.font('Helvetica').fontSize(9);
        doc.text('Ritenuta d\'acconto:', totalsX, tableY, { width: 90, align: 'right' });
        doc.text(`- ${formatEur(input.totali.ritenuataAcconto)}`, totalsValueX, tableY, { width: totalsWidth, align: 'right' });
        tableY += 14;

        doc.font('Helvetica-Bold').fontSize(10);
        doc.text('NETTO A PAGARE:', totalsX, tableY, { width: 90, align: 'right' });
        doc.text(formatEur(input.totali.nettoAPagare), totalsValueX, tableY, { width: totalsWidth, align: 'right' });
        tableY += 18;
      }

      // === PAGAMENTO ===
      tableY += 10;
      doc.font('Helvetica-Bold').fontSize(9).text('MODALITÀ DI PAGAMENTO', 50, tableY);
      tableY += 14;
      doc.font('Helvetica').fontSize(9).text(input.metodoPagamento, 50, tableY);
      if (input.cedente.iban) {
        tableY += 12;
        doc.text(`IBAN: ${input.cedente.iban}`, 50, tableY);
      }

      // === NOTE ===
      if (input.note) {
        tableY += 20;
        doc.font('Helvetica-Bold').fontSize(9).text('NOTE', 50, tableY);
        tableY += 14;
        doc.font('Helvetica').fontSize(8).text(input.note, 50, tableY, { width: pageWidth });
        tableY += doc.heightOfString(input.note, { width: pageWidth }) + 5;
      }

      // === DICITURE LEGALI ===
      if (input.diciture.length > 0) {
        tableY += 10;
        doc.moveTo(50, tableY).lineTo(50 + pageWidth, tableY).stroke('#eeeeee');
        tableY += 8;
        doc.font('Helvetica-Oblique').fontSize(7).fillColor('#666666');
        for (const d of input.diciture) {
          doc.text(d, 50, tableY, { width: pageWidth });
          tableY += doc.heightOfString(d, { width: pageWidth }) + 3;
        }
      }

      // === FOOTER ===
      doc.fillColor('#999999').font('Helvetica').fontSize(7)
        .text('Documento generato da tuaequipe.it', 50, doc.page.height - 50, {
          align: 'center',
          width: pageWidth,
        });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
