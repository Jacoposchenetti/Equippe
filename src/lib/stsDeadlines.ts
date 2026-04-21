/**
 * Logica scadenze invio dati al Sistema Tessera Sanitaria.
 *
 * Dal DM 29/10/2025 (attuativo del D.Lgs. 81/2025, art.5 comma 1):
 * la scadenza per l'invio dei dati di spesa sanitaria è ANNUALE,
 * entro il 31 gennaio dell'anno successivo a quello di emissione.
 *
 * Esempio: fatture emesse nel 2026 → scadenza 31 gennaio 2027.
 */

export interface STSDeadlineInfo {
  /** Data scadenza (es. "2027-01-31") */
  deadline: string;
  /** Giorni rimanenti alla scadenza (negativi se scaduta) */
  giorniRimanenti: number;
  /** Etichetta periodo (es. "Anno 2026") */
  periodoLabel: string;
  /** Anno di riferimento delle fatture */
  annoRiferimento: number;
  /** Livello urgenza */
  urgenza: 'ok' | 'attenzione' | 'urgente' | 'scaduto';
}

/**
 * Calcola le info sulla scadenza STS per un dato anno fiscale.
 */
export function getSTSDeadlineInfo(annoFiscale: number, oggi?: Date): STSDeadlineInfo {
  const now = oggi ?? new Date();
  const deadline = `${annoFiscale + 1}-01-31`;
  const deadlineDate = new Date(annoFiscale + 1, 0, 31); // 31 gennaio anno+1
  const diffMs = deadlineDate.getTime() - now.getTime();
  const giorniRimanenti = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  let urgenza: STSDeadlineInfo['urgenza'];
  if (giorniRimanenti < 0) urgenza = 'scaduto';
  else if (giorniRimanenti <= 7) urgenza = 'urgente';
  else if (giorniRimanenti <= 30) urgenza = 'attenzione';
  else urgenza = 'ok';

  return {
    deadline,
    giorniRimanenti,
    periodoLabel: `Anno ${annoFiscale}`,
    annoRiferimento: annoFiscale,
    urgenza,
  };
}

/**
 * Restituisce il colore/stile per il livello di urgenza STS.
 */
export function getUrgenzaStyle(urgenza: STSDeadlineInfo['urgenza']) {
  switch (urgenza) {
    case 'scaduto': return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', icon: '🔴' };
    case 'urgente': return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', icon: '🟠' };
    case 'attenzione': return { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', icon: '🟡' };
    case 'ok': return { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', icon: '🟢' };
  }
}
