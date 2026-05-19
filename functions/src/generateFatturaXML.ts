/**
 * Generatore XML FatturaPA conforme allo schema v1.2.2 dell'Agenzia delle Entrate.
 * Genera il file XML che l'utente può caricare su "Fatture e Corrispettivi".
 *
 * Riferimento: https://www.agenziaentrate.gov.it/portale/web/guest/specifiche-tecniche-versione-1.2.2
 */

import { create } from 'xmlbuilder2';

interface DatiCedente {
  partitaIva: string;
  codiceFiscale: string;
  nome: string;
  cognome: string;
  regimeFiscale: string;    // es. "RF19" (forfettario), "RF01" (ordinario)
  indirizzo: string;
  cap: string;
  comune: string;
  provincia: string;
  nazione: string;
}

interface DatiCessionario {
  tipo: 'persona_fisica' | 'persona_giuridica';
  codiceFiscale: string;
  partitaIva?: string;
  nome?: string;
  cognome?: string;
  ragioneSociale?: string;
  indirizzo: string;
  cap: string;
  comune: string;
  provincia: string;
  nazione: string;
  codiceDestinatario?: string;
  pec?: string;
}

interface RigaDettaglio {
  numeroLinea: number;
  descrizione: string;
  quantita: number;
  prezzoUnitario: number;
  prezzoTotale: number;
  aliquotaIva: number;
  natura?: string;           // es. "N4" se esente
}

interface RiepilogoIva {
  aliquotaIva: number;
  natura?: string;
  imponibile: number;
  imposta: number;
  riferimentoNormativo?: string;
}

interface DatiCassa {
  tipoCassa: string;         // es. "TC22" (ENPAP)
  alCassa: number;           // aliquota cassa (es. 2)
  importoContributoCassa: number;
  imponibileCassa: number;
  aliquotaIva: number;
  natura?: string;
  riferimentoAmministrazione?: string;
}

interface DatiBolloVirtuale {
  importoBollo: number;
}

interface DatiPagamento {
  modalitaPagamento: string; // es. "MP05" (bonifico)
  importoPagamento: number;
  iban?: string;
}

export interface GenerateXMLInput {
  // Progressivo invio (usato nel nome file e nei DatiTrasmissione)
  progressivoInvio: string;

  // Tipo documento: "TD01" fattura, "TD04" nota di credito
  tipoDocumento: string;

  // Formato: "FPR12" per privati, "FPA12" per PA
  formatoTrasmissione: 'FPR12' | 'FPA12';

  cedente: DatiCedente;
  cessionario: DatiCessionario;

  // Numero e data fattura
  numero: string;           // es. "1/2026"
  data: string;             // YYYY-MM-DD

  // Riferimento fattura (per note di credito)
  riferimentoFattura?: {
    numero: string;
    data: string;
  };

  // Causale (opzionale, max 200 char per riga, max 5 righe)
  causale?: string[];

  // Cassa previdenziale (opzionale)
  datiCassa?: DatiCassa;

  // Bollo virtuale (opzionale)
  datiBollo?: DatiBolloVirtuale;

  // Righe dettaglio
  righe: RigaDettaglio[];

  // Riepiloghi IVA
  riepiloghi: RiepilogoIva[];

  // Ritenuta d'acconto (opzionale)
  ritenuta?: {
    tipoRitenuta: 'RT01' | 'RT02';  // RT01=persone fisiche, RT02=persone giuridiche
    importoRitenuta: number;
    aliquotaRitenuta: number;
    causalePagamento: string;        // es. "A" per professionisti
  };

  // Dati pagamento
  pagamento: DatiPagamento;

  // Totale documento (per ImportoTotaleDocumento)
  totaleDocumento?: number;

  // Diciture aggiuntive (note a piè di fattura)
  note?: string;
}

/**
 * Genera l'XML FatturaPA conforme allo schema v1.2.2.
 * Restituisce la stringa XML completa con dichiarazione e namespace.
 */
export function generateFatturaXML(input: GenerateXMLInput): string {
  const codiceDestinatario = input.cessionario.codiceDestinatario || '0000000';

  const root = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('p:FatturaElettronica', {
      'xmlns:ds': 'http://www.w3.org/2000/09/xmldsig#',
      'xmlns:p': 'http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2',
      'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
      'xsi:schemaLocation': 'http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2 http://www.fatturapa.gov.it/export/fatturazione/sdi/fatturapa/v1.2.2/Schema_del_file_xml_FatturaPA_v1.2.2.xsd',
      versione: input.formatoTrasmissione,
    });

  // === HEADER ===
  const header = root.ele('FatturaElettronicaHeader');

  // DatiTrasmissione
  const datiTrasmissione = header.ele('DatiTrasmissione');
  const idTrasmittente = datiTrasmissione.ele('IdTrasmittente');
  idTrasmittente.ele('IdPaese').txt('IT');
  idTrasmittente.ele('IdCodice').txt(input.cedente.codiceFiscale);
  datiTrasmissione.ele('ProgressivoInvio').txt(input.progressivoInvio);
  datiTrasmissione.ele('FormatoTrasmissione').txt(input.formatoTrasmissione);
  datiTrasmissione.ele('CodiceDestinatario').txt(codiceDestinatario);
  if (input.cessionario.pec && codiceDestinatario === '0000000') {
    datiTrasmissione.ele('PECDestinatario').txt(input.cessionario.pec);
  }

  // CedentePrestatore
  const cedente = header.ele('CedentePrestatore');
  const datiAnagraficiCedente = cedente.ele('DatiAnagrafici');
  const idFiscaleCedente = datiAnagraficiCedente.ele('IdFiscaleIVA');
  idFiscaleCedente.ele('IdPaese').txt('IT');
  idFiscaleCedente.ele('IdCodice').txt(input.cedente.partitaIva);
  datiAnagraficiCedente.ele('CodiceFiscale').txt(input.cedente.codiceFiscale);
  const anagraficaCedente = datiAnagraficiCedente.ele('Anagrafica');
  anagraficaCedente.ele('Nome').txt(input.cedente.nome);
  anagraficaCedente.ele('Cognome').txt(input.cedente.cognome);
  datiAnagraficiCedente.ele('RegimeFiscale').txt(input.cedente.regimeFiscale);

  const sedeCedente = cedente.ele('Sede');
  sedeCedente.ele('Indirizzo').txt(input.cedente.indirizzo);
  sedeCedente.ele('CAP').txt(input.cedente.cap);
  sedeCedente.ele('Comune').txt(input.cedente.comune);
  sedeCedente.ele('Provincia').txt(input.cedente.provincia);
  sedeCedente.ele('Nazione').txt(input.cedente.nazione);

  // CessionarioCommittente
  const cessionario = header.ele('CessionarioCommittente');
  const datiAnagraficiCessionario = cessionario.ele('DatiAnagrafici');

  if (input.cessionario.partitaIva) {
    const idFiscaleCessionario = datiAnagraficiCessionario.ele('IdFiscaleIVA');
    idFiscaleCessionario.ele('IdPaese').txt(input.cessionario.nazione || 'IT');
    idFiscaleCessionario.ele('IdCodice').txt(input.cessionario.partitaIva);
  }
  if (input.cessionario.codiceFiscale) {
    datiAnagraficiCessionario.ele('CodiceFiscale').txt(input.cessionario.codiceFiscale);
  }

  const anagraficaCessionario = datiAnagraficiCessionario.ele('Anagrafica');
  if (input.cessionario.tipo === 'persona_giuridica' && input.cessionario.ragioneSociale) {
    anagraficaCessionario.ele('Denominazione').txt(input.cessionario.ragioneSociale);
  } else {
    if (input.cessionario.nome) anagraficaCessionario.ele('Nome').txt(input.cessionario.nome);
    if (input.cessionario.cognome) anagraficaCessionario.ele('Cognome').txt(input.cessionario.cognome);
  }

  const sedeCessionario = cessionario.ele('Sede');
  sedeCessionario.ele('Indirizzo').txt(input.cessionario.indirizzo);
  sedeCessionario.ele('CAP').txt(input.cessionario.cap);
  sedeCessionario.ele('Comune').txt(input.cessionario.comune);
  if (input.cessionario.provincia) {
    sedeCessionario.ele('Provincia').txt(input.cessionario.provincia);
  }
  sedeCessionario.ele('Nazione').txt(input.cessionario.nazione || 'IT');

  // === BODY ===
  const body = root.ele('FatturaElettronicaBody');

  // DatiGenerali
  const datiGenerali = body.ele('DatiGenerali');
  const datiGeneraliDocumento = datiGenerali.ele('DatiGeneraliDocumento');
  datiGeneraliDocumento.ele('TipoDocumento').txt(input.tipoDocumento);
  datiGeneraliDocumento.ele('Divisa').txt('EUR');
  datiGeneraliDocumento.ele('Data').txt(input.data);
  datiGeneraliDocumento.ele('Numero').txt(input.numero);

  // ImportoTotaleDocumento (opzionale ma fortemente consigliato)
  if (input.totaleDocumento != null) {
    datiGeneraliDocumento.ele('ImportoTotaleDocumento').txt(input.totaleDocumento.toFixed(2));
  }

  // Ritenuta d'acconto
  if (input.ritenuta) {
    const datiRitenuta = datiGeneraliDocumento.ele('DatiRitenuta');
    datiRitenuta.ele('TipoRitenuta').txt(input.ritenuta.tipoRitenuta);
    datiRitenuta.ele('ImportoRitenuta').txt(input.ritenuta.importoRitenuta.toFixed(2));
    datiRitenuta.ele('AliquotaRitenuta').txt(input.ritenuta.aliquotaRitenuta.toFixed(2));
    datiRitenuta.ele('CausalePagamento').txt(input.ritenuta.causalePagamento);
  }

  // Bollo virtuale
  if (input.datiBollo) {
    const datiBollo = datiGeneraliDocumento.ele('DatiBollo');
    datiBollo.ele('BolloVirtuale').txt('SI');
    datiBollo.ele('ImportoBollo').txt(input.datiBollo.importoBollo.toFixed(2));
  }

  // Cassa previdenziale
  if (input.datiCassa) {
    const datiCassaEl = datiGeneraliDocumento.ele('DatiCassaPrevidenziale');
    datiCassaEl.ele('TipoCassa').txt(input.datiCassa.tipoCassa);
    datiCassaEl.ele('AlCassa').txt(input.datiCassa.alCassa.toFixed(2));
    datiCassaEl.ele('ImportoContributoCassa').txt(input.datiCassa.importoContributoCassa.toFixed(2));
    datiCassaEl.ele('ImponibileCassa').txt(input.datiCassa.imponibileCassa.toFixed(2));
    datiCassaEl.ele('AliquotaIVA').txt(input.datiCassa.aliquotaIva.toFixed(2));
    if (input.datiCassa.natura) {
      datiCassaEl.ele('Natura').txt(input.datiCassa.natura);
    }
    // Indica se il contributo cassa è soggetto a ritenuta d'acconto
    if (input.ritenuta) {
      datiCassaEl.ele('Ritenuta').txt('SI');
    }
  }

  // Causale
  if (input.causale) {
    for (const c of input.causale) {
      datiGeneraliDocumento.ele('Causale').txt(c.substring(0, 200));
    }
  }

  // Riferimento fattura (per nota di credito)
  if (input.riferimentoFattura) {
    const datiFattureCollegate = datiGenerali.ele('DatiFattureCollegate');
    datiFattureCollegate.ele('IdDocumento').txt(input.riferimentoFattura.numero);
    datiFattureCollegate.ele('Data').txt(input.riferimentoFattura.data);
  }

  // DatiBeniServizi
  const datiBeniServizi = body.ele('DatiBeniServizi');

  // DettaglioLinee
  for (const riga of input.righe) {
    const dettaglio = datiBeniServizi.ele('DettaglioLinee');
    dettaglio.ele('NumeroLinea').txt(String(riga.numeroLinea));
    dettaglio.ele('Descrizione').txt(riga.descrizione);
    dettaglio.ele('Quantita').txt(riga.quantita.toFixed(2));
    dettaglio.ele('PrezzoUnitario').txt(riga.prezzoUnitario.toFixed(2));
    dettaglio.ele('PrezzoTotale').txt(riga.prezzoTotale.toFixed(2));
    dettaglio.ele('AliquotaIVA').txt(riga.aliquotaIva.toFixed(2));
    if (riga.natura) {
      dettaglio.ele('Natura').txt(riga.natura);
    }
  }

  // DatiRiepilogo
  for (const riepilogo of input.riepiloghi) {
    const datiRiepilogo = datiBeniServizi.ele('DatiRiepilogo');
    datiRiepilogo.ele('AliquotaIVA').txt(riepilogo.aliquotaIva.toFixed(2));
    if (riepilogo.natura) {
      datiRiepilogo.ele('Natura').txt(riepilogo.natura);
    }
    datiRiepilogo.ele('ImponibileImporto').txt(riepilogo.imponibile.toFixed(2));
    datiRiepilogo.ele('Imposta').txt(riepilogo.imposta.toFixed(2));
    if (riepilogo.riferimentoNormativo) {
      datiRiepilogo.ele('RiferimentoNormativo').txt(riepilogo.riferimentoNormativo);
    }
  }

  // DatiPagamento
  const datiPagamento = body.ele('DatiPagamento');
  datiPagamento.ele('CondizioniPagamento').txt('TP02'); // Pagamento completo
  const dettaglioPagamento = datiPagamento.ele('DettaglioPagamento');
  dettaglioPagamento.ele('ModalitaPagamento').txt(input.pagamento.modalitaPagamento);
  dettaglioPagamento.ele('ImportoPagamento').txt(input.pagamento.importoPagamento.toFixed(2));
  if (input.pagamento.iban) {
    dettaglioPagamento.ele('IBAN').txt(input.pagamento.iban.replace(/\s/g, ''));
  }

  return root.end({ prettyPrint: true });
}

/**
 * Genera il nome file XML secondo le specifiche AdE.
 * Formato: IT{PartitaIVA}_{ProgressivoInvio}.xml
 */
export function generateNomeFileXML(partitaIva: string, progressivoInvio: string): string {
  return `IT${partitaIva}_${progressivoInvio}.xml`;
}
