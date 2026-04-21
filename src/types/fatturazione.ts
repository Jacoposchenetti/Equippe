import { Timestamp } from 'firebase/firestore';

// ===== REGIME FISCALE =====
export type RegimeFiscale =
  | 'forfettario'     // Regime forfettario (flat tax 15% o 5%)
  | 'ordinario'       // Regime ordinario
  | 'semplificato';   // Contabilità semplificata

export const REGIME_FISCALE_LABELS: Record<RegimeFiscale, string> = {
  forfettario: 'Regime Forfettario',
  ordinario: 'Regime Ordinario',
  semplificato: 'Contabilità Semplificata',
};

// Codici regime fiscale per XML FatturaPA
export const REGIME_FISCALE_CODICI: Record<RegimeFiscale, string> = {
  forfettario: 'RF19',    // Regime forfettario (art.1, c.54-89, L. 190/2014)
  ordinario: 'RF01',      // Regime ordinario
  semplificato: 'RF01',   // Semplificato usa stesso codice di ordinario in FatturaPA
};

// ===== CONFIGURAZIONE FATTURAZIONE UTENTE =====
export interface FatturazioneConfig {
  // Dati professionista
  nome: string;
  cognome: string;
  codiceFiscale: string;
  partitaIva: string;
  regimeFiscale: RegimeFiscale;

  // Cassa previdenziale (es. ENPAP per psicologi)
  cassaPrevidenziale?: {
    nome: string;           // es. "ENPAP"
    codice: string;         // es. "TC22" (codice FatturaPA)
    aliquota: number;       // es. 2 (percentuale)
  };

  // Sede legale/professionale
  indirizzo: string;
  cap: string;
  città: string;
  provincia: string;   // Sigla 2 lettere
  nazione: string;     // Default "IT"

  // Dati bancari
  iban?: string;

  // Logo per fattura PDF
  logoURL?: string;

  // Email per invio fatture
  emailFatturazione?: string;

  // Numerazione progressiva (per anno corrente)
  prossimoNumeroFattura: number;
  prossimoNumeroProforma: number;
  prossimoNumeroNotaCredito: number;
  annoCorrente: number;

  // Configurazione completata
  setupCompleted: boolean;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ===== CLIENTE FATTURAZIONE =====
export type TipoCliente = 'persona_fisica' | 'persona_giuridica';

export interface ClienteFatturazione {
  id?: string;

  tipo: TipoCliente;

  // Dati comuni
  codiceFiscale: string;
  indirizzo: string;
  cap: string;
  città: string;
  provincia: string;
  nazione: string;      // Default "IT"
  email?: string;
  telefono?: string;
  pec?: string;

  // Persona fisica
  nome?: string;
  cognome?: string;

  // Persona giuridica
  ragioneSociale?: string;
  partitaIva?: string;
  codiceDestinatario?: string; // Codice SDI (7 caratteri), default "0000000"

  // STS
  opposizioneSTS: boolean;     // true = il paziente si oppone all'invio a STS

  note?: string;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ===== FATTURA =====
export type TipoDocumento = 'fattura' | 'proforma' | 'nota_credito';
export type StatoFattura = 'bozza' | 'emessa';

export const TIPO_DOCUMENTO_LABELS: Record<TipoDocumento, string> = {
  fattura: 'Fattura',
  proforma: 'Proforma',
  nota_credito: 'Nota di Credito',
};

// Codici tipo documento per XML FatturaPA
export const TIPO_DOCUMENTO_CODICI: Record<TipoDocumento, string> = {
  fattura: 'TD01',        // Fattura
  proforma: 'TD01',       // Proforma non va in XML (uso interno)
  nota_credito: 'TD04',   // Nota di credito
};

export interface RigaFattura {
  id: string;
  descrizione: string;
  quantita: number;
  prezzoUnitario: number;    // in euro
  aliquotaIva: number;       // 0, 4, 10, 22 (percentuale)
  naturaEsenzione?: string;  // es. "N4" per esente art.10
  codicePrestazioneRef?: string; // ref a prestazione pre-configurata
  sanitaria?: boolean;       // true = prestazione sanitaria (no SDI per persona fisica)
}

export interface TotaliCalcolati {
  imponibile: number;            // Somma righe (quantità × prezzo)
  cassaPrevidenziale: number;    // ENPAP: 2% su imponibile
  imponibileConCassa: number;    // imponibile + cassa (base IVA se non esente)
  // IVA per aliquota
  ivaPerAliquota: {
    aliquota: number;
    natura?: string;             // natura esenzione se aliquota=0
    imponibile: number;
    imposta: number;
  }[];
  totaleIva: number;
  ritenuataAcconto: number;       // 20% su imponibile (solo se cliente azienda + regime ordinario)
  bolloVirtuale: number;          // 2€ se operazioni esenti > 77.47€
  totaleDocumento: number;        // imponibile + cassa + IVA + bollo
  nettoAPagare: number;           // totale - ritenuta
}

export interface Fattura {
  id?: string;

  // Tipo e stato
  tipo: TipoDocumento;
  stato: StatoFattura;

  // Numerazione
  numero: number;
  anno: number;
  // Numero formattato: es. "1/2026"
  numeroFormattato?: string;

  // Date
  dataEmissione: string;    // YYYY-MM-DD
  dataScadenza?: string;    // YYYY-MM-DD (opzionale)

  // Riferimenti
  clienteId: string;
  // Snapshot dati cliente al momento dell'emissione (per storicizzazione)
  clienteSnapshot: Pick<ClienteFatturazione,
    'tipo' | 'nome' | 'cognome' | 'ragioneSociale' | 'codiceFiscale' |
    'partitaIva' | 'indirizzo' | 'cap' | 'città' | 'provincia' | 'nazione' |
    'codiceDestinatario' | 'pec' | 'opposizioneSTS' | 'email'
  >;

  // Se nota di credito, riferimento alla fattura originale
  fatturaRiferimentoId?: string;
  fatturaRiferimentoNumero?: string;

  // Righe
  righe: RigaFattura[];

  // Totali calcolati
  totali: TotaliCalcolati;

  // Pagamento
  metodoPagamento?: string;  // es. "Bonifico bancario", "Contanti"
  ibanPagamento?: string;

  // Note in fattura
  note?: string;

  // Canale di emissione
  // 'sdi' = FatturaPA XML inviata a SDI (aziende/PA, o prestazioni non sanitarie)
  // 'cartacea' = solo PDF (prestazioni sanitarie a persona fisica — divieto SDI art.10-bis DL 119/2018)
  canale?: 'sdi' | 'cartacea';

  // File generati
  xmlUrl?: string;          // URL su Cloud Storage del file XML FatturaPA (solo se canale='sdi')
  pdfUrl?: string;          // URL su Cloud Storage del file PDF

  // Pagamento tracciamento
  statoPagamento: 'non_pagata' | 'pagata';
  dataPagamento?: string;    // YYYY-MM-DD quando è stata pagata

  // Flag per STS
  inviatoSTS: boolean;
  inviatoSTSAt?: Timestamp;
  idoneaSTS: boolean;        // true se prestazione sanitaria a persona fisica non opposta
  caricatoSTS?: boolean;     // true se il professionista conferma di aver caricato l'XML sul portale STS
  caricatoSTSAt?: Timestamp;

  // Email inviata al cliente
  emailInviataAt?: Timestamp;
  emailInviataA?: string;     // indirizzo email a cui è stata inviata

  createdAt: Timestamp;
  updatedAt: Timestamp;
  emessaAt?: Timestamp;
}

// ===== METODI DI PAGAMENTO =====
export const METODI_PAGAMENTO = [
  { codice: 'MP05', label: 'Bonifico bancario' },
  { codice: 'MP01', label: 'Contanti' },
  { codice: 'MP08', label: 'Carta di pagamento' },
  { codice: 'MP02', label: 'Assegno' },
] as const;

// ===== NATURE IVA (esenzioni) =====
export const NATURE_IVA = {
  N1: 'Escluse ex art.15',
  N2: 'Non soggette',
  'N2.1': 'Non soggette ad IVA – artt. da 7 a 7-septies',
  'N2.2': 'Non soggette – altri casi',
  N3: 'Non imponibili',
  N4: 'Esenti (art.10)',
  N5: 'Regime del margine / IVA non esposta in fattura',
  N6: 'Inversione contabile (reverse charge)',
} as const;
