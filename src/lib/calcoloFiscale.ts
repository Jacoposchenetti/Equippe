/**
 * Motore di calcolo fiscale per fatturazione.
 * Usato sia nel frontend (anteprima real-time) che nel backend (validazione).
 * 
 * Logica:
 * 1. Calcola imponibile (somma righe: quantità × prezzo)
 * 2. Calcola cassa previdenziale (es. ENPAP 2% su imponibile)
 * 3. Raggruppa per aliquota IVA e calcola imposta
 * 4. Calcola ritenuta d'acconto (se cliente azienda + regime ordinario)
 * 5. Calcola marca da bollo virtuale (2€ se operazioni esenti > 77.47€)
 * 6. Calcola totale e netto a pagare
 */

import type { RigaFattura, TotaliCalcolati, RegimeFiscale, TipoCliente } from '../types/fatturazione';
import type { ConfigFiscaleProfessione } from './configFiscaleProfessioni';

export interface CalcoloInput {
  righe: RigaFattura[];
  configFiscale: ConfigFiscaleProfessione;
  regimeFiscale: RegimeFiscale;
  tipoCliente: TipoCliente;
  applicaCassa: boolean;          // Possibilità di escludere cassa (es. affitti)
  cassaAliquota?: number;         // Override aliquota cassa dalla config utente (priorità su configFiscale)
}

/**
 * Round a number to 2 decimal places (banker's rounding for fiscal compliance)
 */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Calcola tutti i totali per una fattura.
 */
export function calcolaTotali(input: CalcoloInput): TotaliCalcolati {
  const { righe, configFiscale, regimeFiscale, tipoCliente, applicaCassa, cassaAliquota } = input;

  // 1. Calcola imponibile per riga
  const imponibile = round2(
    righe.reduce((sum, r) => sum + r.quantita * r.prezzoUnitario, 0)
  );

  // 2. Cassa previdenziale (es. ENPAP 2%)
  // Usa cassaAliquota dalla config utente se disponibile, altrimenti dalla profession config
  const aliquotaCassa = cassaAliquota ?? configFiscale.cassaPrevidenziale.aliquota;
  const cassaPrevidenziale = applicaCassa
    ? round2(imponibile * aliquotaCassa / 100)
    : 0;

  // Base per IVA = imponibile + cassa (la cassa è soggetta a IVA)
  const imponibileConCassa = round2(imponibile + cassaPrevidenziale);

  // 3. Raggruppa per aliquota IVA e calcola imposta
  const ivaMap = new Map<string, { aliquota: number; natura?: string; imponibile: number; imposta: number }>();

  for (const riga of righe) {
    const key = riga.naturaEsenzione ? `N_${riga.naturaEsenzione}` : `A_${riga.aliquotaIva}`;
    const importoRiga = round2(riga.quantita * riga.prezzoUnitario);

    if (!ivaMap.has(key)) {
      ivaMap.set(key, {
        aliquota: riga.aliquotaIva,
        natura: riga.naturaEsenzione,
        imponibile: 0,
        imposta: 0,
      });
    }

    const entry = ivaMap.get(key)!;
    entry.imponibile = round2(entry.imponibile + importoRiga);
  }

  // Distribuisci la cassa proporzionalmente tra le aliquote IVA
  if (cassaPrevidenziale > 0) {
    const totalImponibileRighe = Array.from(ivaMap.values()).reduce((s, e) => s + e.imponibile, 0);
    for (const entry of ivaMap.values()) {
      if (totalImponibileRighe > 0) {
        const quotaCassa = round2(cassaPrevidenziale * entry.imponibile / totalImponibileRighe);
        entry.imponibile = round2(entry.imponibile + quotaCassa);
      }
    }
  }

  // Calcola imposta IVA per ogni aliquota
  // Nel regime forfettario NON si addebita IVA (operazioni con natura N2.2)
  if (regimeFiscale === 'forfettario') {
    // Forfettario: tutte le operazioni senza IVA, natura N2.2
    const totImponibile = Array.from(ivaMap.values()).reduce((s, e) => s + e.imponibile, 0);
    ivaMap.clear();
    ivaMap.set('N_N2.2', {
      aliquota: 0,
      natura: 'N2.2',
      imponibile: round2(totImponibile),
      imposta: 0,
    });
  } else {
    for (const entry of ivaMap.values()) {
      if (entry.aliquota > 0 && !entry.natura) {
        entry.imposta = round2(entry.imponibile * entry.aliquota / 100);
      }
    }
  }

  const ivaPerAliquota = Array.from(ivaMap.values());
  const totaleIva = round2(ivaPerAliquota.reduce((s, e) => s + e.imposta, 0));

  // 4. Ritenuta d'acconto
  // Si applica solo se: regime ordinario/semplificato + cliente persona giuridica
  let ritenuataAcconto = 0;
  if (
    regimeFiscale !== 'forfettario' &&
    tipoCliente === 'persona_giuridica' &&
    configFiscale.regole.ritenutaAccontoAziende
  ) {
    ritenuataAcconto = round2(imponibile * configFiscale.regole.aliquotaRitenuta / 100);
  }

  // 5. Marca da bollo virtuale
  // Si applica quando: operazioni esenti/non soggette + importo > 77.47€
  const totaleEsente = ivaPerAliquota
    .filter(e => e.aliquota === 0)
    .reduce((s, e) => s + e.imponibile, 0);
  const bolloVirtuale = totaleEsente > 77.47 ? 2 : 0;

  // 6. Totale e netto
  const totaleDocumento = round2(imponibileConCassa + totaleIva + bolloVirtuale);
  const nettoAPagare = round2(totaleDocumento - ritenuataAcconto);

  return {
    imponibile,
    cassaPrevidenziale,
    imponibileConCassa,
    ivaPerAliquota,
    totaleIva,
    ritenuataAcconto,
    bolloVirtuale,
    totaleDocumento,
    nettoAPagare,
  };
}

/**
 * Formatta un importo in euro
 */
export function formatEuro(amount: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

/**
 * Formatta il numero fattura: "N/ANNO" (es. "1/2026")
 */
export function formatNumeroFattura(numero: number, anno: number): string {
  return `${numero}/${anno}`;
}

/**
 * Determina se una fattura è idonea per l'invio a STS.
 * Condizioni: cliente persona fisica + almeno una prestazione sanitaria + no opposizione
 */
export function isIdoneaSTS(
  tipoCliente: TipoCliente,
  opposizioneSTS: boolean,
  righe: RigaFattura[],
  configFiscale: ConfigFiscaleProfessione,
): boolean {
  if (tipoCliente !== 'persona_fisica') return false;
  if (opposizioneSTS) return false;

  // Almeno una riga con prestazione sanitaria (esente IVA art.10)
  const prestazioniMap = new Map(
    configFiscale.prestazioni.map(p => [p.codice, p])
  );

  return righe.some(r => {
    if (r.codicePrestazioneRef) {
      const prest = prestazioniMap.get(r.codicePrestazioneRef);
      return prest?.sanitaria ?? false;
    }
    // Se riga custom con natura N4, considerala sanitaria
    return r.naturaEsenzione === 'N4';
  });
}

/**
 * Genera la dicitura obbligatoria per la marca da bollo virtuale
 */
export function getDicituraBollo(bolloVirtuale: number): string | null {
  if (bolloVirtuale <= 0) return null;
  return 'Imposta di bollo assolta in modo virtuale ai sensi del D.M. 17/06/2014';
}

/**
 * Genera la dicitura per il regime forfettario
 */
export function getDicituraForfettario(): string {
  return 'Operazione effettuata ai sensi dell\'art. 1, commi da 54 a 89, della Legge n. 190/2014 e successive modificazioni (L. 208/2015, L. 145/2018) - Regime forfettario. Operazione senza applicazione dell\'IVA.';
}

/**
 * Dicitura obbligatoria per forfettari: compenso non soggetto a ritenuta d'acconto
 */
export function getDicituraNoRitenutaForfettario(): string {
  return 'Compenso non assoggettato a ritenuta d\'acconto ai sensi dell\'art. 1, c. 67, L. 190/2014.';
}

/**
 * Genera la dicitura per l'esenzione IVA art.10
 */
export function getDicituraEsenzioneIva(): string {
  return 'Prestazione sanitaria esente IVA ai sensi dell\'art. 10, comma 1, n. 18, DPR 633/72.';
}
