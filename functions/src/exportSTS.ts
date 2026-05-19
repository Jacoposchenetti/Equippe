/**
 * Export dati per Sistema Tessera Sanitaria (STS).
 * Genera un file XML conforme al tracciato DM MEF 19/10/2020 (schema versione 5)
 * per l'upload massivo su sistemats.sanita.finanze.it.
 *
 * Flusso previsto:
 *   App genera XML → professionista lo scarica → lo carica su sistemats.sanita.finanze.it
 *
 * Riferimento normativo:
 *   DM MEF 19/10/2020 — Specifiche tecniche per la trasmissione telematica
 *   dei dati delle spese sanitarie al Sistema Tessera Sanitaria
 */

import { create } from 'xmlbuilder2';

export interface SpesaSTS {
  /** Codice fiscale del paziente (cifrato solo per invio anonimo; qui non serve) */
  cfPaziente: string;
  /** 0 = paziente NON ha esercitato opposizione; 1 = opposto (non dovrebbe mai entrare qui) */
  flagOpposizione: 0;
  /** F = Fattura */
  tipoDocumento: 'F';
  /** Data del documento, formato YYYY-MM-DD */
  dataDocumento: string;
  /** Numero documento, es. "1/2026" */
  numDocumento: string;
  /** Importo totale in euro con 2 decimali */
  importo: number;
  /**
   * Natura IVA per STS (codifica MEF — diversa da FatturaPA):
   *   N2 = Non soggetto (regime forfettario)
   *   N4 = Esente (art. 10 DPR 633/72, regime ordinario)
   */
  naturaIVA: 'N2' | 'N4';
  /** SR = Spesa Sanitaria Rimborsabile (tutte le prestazioni psicologiche) */
  tipoSpesa: 'SR';
  /** I = Inserimento, C = Cancellazione */
  flagOperazione: 'I' | 'C';
  /**
   * SI = pagamento tracciato (bonifico, carta, POS, PayPal)
   * NO = pagamento non tracciato (contanti)
   */
  pagamentoTracciato: 'SI' | 'NO';
  /** Data pagamento (YYYY-MM-DD), opzionale — va valorizzata se la fattura è pagata */
  dataPagamento?: string;
}

export interface GenerateSTSInput {
  /** Codice fiscale del professionista sanitario */
  cfProfessionista: string;
  /** Partita IVA del professionista */
  partitaIva: string;
  /** Lista delle spese da includere nel file */
  spese: SpesaSTS[];
}

/**
 * Genera il file XML STS conforme al tracciato MEF (versione 5).
 *
 * Struttura:
 *   <DatiFattura versione="5">
 *     <Proprietario>
 *       <codiceFiscale>...</codiceFiscale>
 *       <partitaIva>...</partitaIva>
 *     </Proprietario>
 *     <DatiSpesa>  (ripetuto per ogni fattura)
 *       <cfCittadino>...</cfCittadino>
 *       <flagOpposizione>0</flagOpposizione>
 *       <tipoDocumento>F</tipoDocumento>
 *       <dataDocumento>YYYY-MM-DD</dataDocumento>
 *       <numDocumento>...</numDocumento>
 *       <importo>70.00</importo>
 *       <naturaIVA>N4</naturaIVA>
 *       <tipoSpesa>SR</tipoSpesa>
 *       <flagOperazione>I</flagOperazione>
 *       <pagamentoTracciato>SI</pagamentoTracciato>
 *       <dataPagamento>YYYY-MM-DD</dataPagamento>  (se presente)
 *     </DatiSpesa>
 *   </DatiFattura>
 */
export function generateSTSXML(input: GenerateSTSInput): string {
  const root = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('DatiFattura', { versione: '5' });

  const proprietario = root.ele('Proprietario');
  proprietario.ele('codiceFiscale').txt(input.cfProfessionista);
  proprietario.ele('partitaIva').txt(input.partitaIva);

  for (const spesa of input.spese) {
    const ds = root.ele('DatiSpesa');
    ds.ele('cfCittadino').txt(spesa.cfPaziente);
    ds.ele('flagOpposizione').txt(String(spesa.flagOpposizione));
    ds.ele('tipoDocumento').txt(spesa.tipoDocumento);
    ds.ele('dataDocumento').txt(spesa.dataDocumento);
    ds.ele('numDocumento').txt(spesa.numDocumento);
    ds.ele('importo').txt(spesa.importo.toFixed(2));
    ds.ele('naturaIVA').txt(spesa.naturaIVA);
    ds.ele('tipoSpesa').txt(spesa.tipoSpesa);
    ds.ele('flagOperazione').txt(spesa.flagOperazione);
    ds.ele('pagamentoTracciato').txt(spesa.pagamentoTracciato);
    if (spesa.dataPagamento) {
      ds.ele('dataPagamento').txt(spesa.dataPagamento);
    }
  }

  return root.end({ prettyPrint: true });
}

/**
 * Restituisce la natura IVA corretta per STS in base al regime fiscale.
 *   Forfettario → N2 (non soggetto — la non imponibilità deriva dal regime, non dall'art.10)
 *   Ordinario/Semplificato → N4 (esente art. 10, c.1, n.18 DPR 633/72)
 */
export function getNaturaIVA_STS(regimeFiscale: string): 'N2' | 'N4' {
  return regimeFiscale === 'forfettario' ? 'N2' : 'N4';
}

/**
 * Determina se il pagamento è tracciato ai fini STS.
 *   Contanti → NO
 *   Tutto il resto (bonifico, carta, POS, ecc.) → SI
 */
export function isPagamentoTracciato(metodoPagamento?: string): 'SI' | 'NO' {
  if (!metodoPagamento || metodoPagamento === 'Contanti') return 'NO';
  return 'SI';
}
