import { useState, useCallback, useEffect, useRef } from 'react';
import { httpsCallable } from 'firebase/functions';
import {
  collection, query, where, orderBy, limit, getDocs,
  startAfter, QueryDocumentSnapshot, DocumentData, Timestamp,
} from 'firebase/firestore';
import { functions, db } from '@/lib/firebase';

export interface ECMEvent {
  id: string;
  titolo: string;
  provider: string;
  professione: string;
  crediti: string;
  creditiNum: number;
  dataInizio: string;
  dataFine: string;
  tipologia: string;
  costo: string;
  costoNum: number;
  professioneLabel: string;
  professioniIds: string[];
}

export interface ECMSearchFilters {
  professione?: string;
  tipologia?: string;
  titolo?: string;
  creditiMinimi?: number;
  creditiMassimi?: number;
  costoMinimo?: number;
  costoMassimo?: number;
  obiettivo?: string;
  regione?: string;
}

export interface DropdownOption {
  value: string;
  label: string;
}

export interface ECMDropdownValues {
  professioni: DropdownOption[];
  regioni: DropdownOption[];
  discipline: DropdownOption[];
  tipologie: DropdownOption[];
  obiettivi: DropdownOption[];
  province: DropdownOption[];
}

// Keep dropdowns callable (still needed for filters)
const getECMDropdownValuesCallable = httpsCallable<void, ECMDropdownValues>(
  functions,
  'getECMDropdownValues'
);

const getECMDisciplinesCallable = httpsCallable<
  { professioneId: string },
  { discipline: DropdownOption[] }
>(functions, 'getECMDisciplines');

const searchECMLiveCallable = httpsCallable<
  { professione?: string; tipologia?: string; obiettivo?: string; titolo?: string; regione?: string },
  { events: ECMEvent[] }
>(functions, 'searchECMLive');

const PAGE_LIMIT = 50;

/**
 * Mappa professioni del sito → ID AGENAS.
 * Usata dal dashboard per auto-cercare i corsi ECM dell'utente.
 */
export const SITE_TO_AGENAS: Record<string, string> = {
  'Psicologo': '5',
  'Psicoterapeuta': '5',       // Stesso albo di Psicologo su AGENAS
  'Psichiatra': '1',           // Medico Chirurgo
  'Nutrizionista': '6',        // Biologo
  'Dietista': '10',
  'Dietologo': '1',            // Medico Chirurgo
  'Logopedista': '16',
  'Fisioterapista': '12',
  'Neuropsicomotricista': '29', // TNPEE
  'Terapista Occupazionale': '30',
  'Educatore Professionale': '11',
  'Infermiere': '14',
  'Medico di Base': '1',       // Medico Chirurgo
  'Medico Specialista': '1',   // Medico Chirurgo
  'Ginecologo': '1',           // Medico Chirurgo
  'Andrologo': '1',            // Medico Chirurgo
  'Assistente Sociale': '9',   // Assistente Sanitario (approssimazione)
  'Sessuologo': '5',           // Spesso psicologi
};

/**
 * Hook principale: query Firestore per cercare eventi ECM.
 * Filtra per professione (array-contains), tipologia, crediti minimi.
 * Il titolo è filtrato lato client.
 */
export function useECMSearch() {
  const [events, setEvents] = useState<ECMEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const lastDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const lastFiltersRef = useRef<ECMSearchFilters>({});

  const search = useCallback(async (filters: ECMSearchFilters, loadMore = false) => {
    setLoading(true);
    setError(null);

    if (!loadMore) {
      lastDocRef.current = null;
    }
    lastFiltersRef.current = filters;

    // Se l'obiettivo o la regione sono specificati, usa ricerca live su AGENAS
    if (filters.obiettivo || filters.regione) {
      try {
        const result = await searchECMLiveCallable({
          professione: filters.professione || undefined,
          tipologia: filters.tipologia || undefined,
          obiettivo: filters.obiettivo,
          titolo: filters.titolo || undefined,
          regione: filters.regione || undefined,
        });
        let liveEvents = result.data.events;
        // Filtri crediti lato client
        if (filters.creditiMinimi && filters.creditiMinimi > 0) {
          liveEvents = liveEvents.filter(e => e.creditiNum >= filters.creditiMinimi!);
        }
        if (filters.creditiMassimi && filters.creditiMassimi > 0) {
          liveEvents = liveEvents.filter(e => e.creditiNum <= filters.creditiMassimi!);
        }
        if (filters.costoMinimo != null && filters.costoMinimo >= 0) {
          liveEvents = liveEvents.filter(e => e.costoNum >= filters.costoMinimo!);
        }
        if (filters.costoMassimo != null && filters.costoMassimo > 0) {
          liveEvents = liveEvents.filter(e => e.costoNum <= filters.costoMassimo!);
        }
        setEvents(liveEvents);
        setHasMore(false);
      } catch (err: any) {
        console.error('Errore ricerca ECM live:', err);
        setError('Errore nella ricerca eventi ECM su AGENAS.');
        setEvents([]);
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      const eventsRef = collection(db, 'ecmEvents');
      const constraints: any[] = [];

      // Profession filter (array-contains)
      if (filters.professione) {
        constraints.push(where('professioniIds', 'array-contains', filters.professione));
      }

      // Tipologia is always filtered client-side (avoids composite index issues)

      // Tipologia/titolo/costo are filtered client-side — fetch more to compensate
      const hasCostFilter = (filters.costoMinimo != null && filters.costoMinimo >= 0) || (filters.costoMassimo != null && filters.costoMassimo! > 0);
      const needsClientFilter = !!(filters.tipologia || filters.titolo || hasCostFilter);
      const hasMinCredits = !!(filters.creditiMinimi && filters.creditiMinimi > 0);
      const hasMaxCredits = !!(filters.creditiMassimi && filters.creditiMassimi > 0);
      const hasCreditRange = hasMinCredits || hasMaxCredits;

      // Crediti minimi
      // Se tipologia/titolo sono filtrati lato client, evitare orderBy su creditiNum:
      // con limit elevato tende a privilegiare solo eventi con crediti molto alti (es. 50 ECM).
      // In quel caso filtriamo i crediti lato client per mantenere risultati coerenti.
      if (hasCreditRange && !needsClientFilter) {
        if (hasMinCredits) constraints.push(where('creditiNum', '>=', filters.creditiMinimi!));
        if (hasMaxCredits) constraints.push(where('creditiNum', '<=', filters.creditiMassimi!));
        constraints.push(orderBy('creditiNum', 'desc'));
      } else {
        constraints.push(orderBy('dataInizioTimestamp', 'desc'));
      }

      const fetchLimit = needsClientFilter ? 2000 : PAGE_LIMIT + 1;
      constraints.push(limit(fetchLimit));

      if (loadMore && lastDocRef.current) {
        constraints.push(startAfter(lastDocRef.current));
      }

      const q = query(eventsRef, ...constraints);
      const snapshot = await getDocs(q);

      let allEvents: ECMEvent[] = [];
      snapshot.docs.forEach(doc => {
        const d = doc.data();
        allEvents.push({
          id: doc.id,
          titolo: d.titolo || '',
          provider: d.provider || '',
          professione: d.professioneLabel || '',
          crediti: d.crediti || '',
          creditiNum: d.creditiNum || 0,
          dataInizio: d.dataInizio || '',
          dataFine: d.dataFine || '',
          tipologia: d.tipologia || '',
          costo: d.costo || '',
          costoNum: d.costoNum ?? 0,
          professioneLabel: d.professioneLabel || '',
          professioniIds: d.professioniIds || [],
        });
      });

      // Client-side title filter
      let filtered = allEvents;
      if (filters.titolo) {
        const needle = filters.titolo.toLowerCase();
        filtered = filtered.filter(e => e.titolo.toLowerCase().includes(needle));
      }
      // Client-side tipologia filter (BLENDED matches all BLENDED variants)
      if (filters.tipologia) {
        if (filters.tipologia === 'BLENDED') {
          filtered = filtered.filter(e => e.tipologia.startsWith('BLENDED'));
        } else {
          filtered = filtered.filter(e => e.tipologia === filters.tipologia);
        }
      }
      // Crediti range lato client quando sono presenti anche filtri lato client
      if (hasCreditRange && needsClientFilter) {
        if (hasMinCredits) filtered = filtered.filter(e => e.creditiNum >= filters.creditiMinimi!);
        if (hasMaxCredits) filtered = filtered.filter(e => e.creditiNum <= filters.creditiMassimi!);
      }
      // Costo range — sempre filtrato lato client
      if (filters.costoMinimo != null && filters.costoMinimo >= 0) {
        filtered = filtered.filter(e => e.costoNum >= filters.costoMinimo!);
      }
      if (filters.costoMassimo != null && filters.costoMassimo > 0) {
        filtered = filtered.filter(e => e.costoNum <= filters.costoMassimo!);
      }

      if (needsClientFilter) {
        // When using client-side filter, we fetched a big batch — no pagination
        if (loadMore) {
          setEvents(prev => [...prev, ...filtered]);
        } else {
          setEvents(filtered);
        }
        setHasMore(false);
      } else {
        // Normal pagination
        const page = allEvents.slice(0, PAGE_LIMIT);
        if (loadMore) {
          setEvents(prev => [...prev, ...page]);
        } else {
          setEvents(page);
        }
        setHasMore(snapshot.docs.length > PAGE_LIMIT);
        if (snapshot.docs.length > 0) {
          lastDocRef.current = snapshot.docs[Math.min(snapshot.docs.length - 1, PAGE_LIMIT - 1)];
        }
      }
    } catch (err: any) {
      console.error('Errore query ECM Firestore:', err);
      setError('Errore nella ricerca eventi ECM.');
      if (!loadMore) setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(() => {
    if (hasMore && !loading) {
      search(lastFiltersRef.current, true);
    }
  }, [hasMore, loading, search]);

  return { events, loading, error, hasMore, search, loadMore };
}

export function useECMDropdowns() {
  const [dropdowns, setDropdowns] = useState<ECMDropdownValues | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDropdowns = useCallback(async () => {
    if (dropdowns) return;

    setLoading(true);
    setError(null);

    try {
      const result = await getECMDropdownValuesCallable();
      setDropdowns(result.data);
    } catch (err: any) {
      setError('Impossibile caricare le opzioni di ricerca.');
      console.error('Errore caricamento dropdown ECM:', err);
    } finally {
      setLoading(false);
    }
  }, [dropdowns]);

  return { dropdowns, loading, error, loadDropdowns };
}

export function useECMDisciplines() {
  const [discipline, setDiscipline] = useState<DropdownOption[]>([]);
  const [loading, setLoading] = useState(false);

  const loadDiscipline = useCallback(async (professioneId: string) => {
    if (!professioneId || professioneId === '-1') {
      setDiscipline([]);
      return;
    }

    setLoading(true);
    try {
      const result = await getECMDisciplinesCallable({ professioneId });
      setDiscipline(result.data.discipline);
    } catch (err) {
      console.error('Errore caricamento discipline ECM:', err);
      setDiscipline([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return { discipline, loading, loadDiscipline };
}

// ----- Dettaglio Evento e Scarica Programma (on-demand via AGENAS) -----

export interface ECMEventDetail {
  id: string;
  edizione: string;
  titolo: string;
  idProvider: string;
  ragioneSociale: string;
  dataInizio: string;
  dataFine: string;
  durata: string;
  crediti: string;
  quota: string;
  numPartecipanti: string;
  tipologiaFAD: string;
  obiettivo: string;
  areaObiettivo: string;
  competenzeTecniche: string;
  competenzeProcesso: string;
  verificaApprendimento: string;
  professioni: string;
  programmaFilename: string;
  telefonoSegreteria: string;
  emailSegreteria: string;
  responsabileNome: string;
  responsabileCognome: string;
  sponsorizzato: string;
}

const getECMEventDetailCallable = httpsCallable<
  { eventId: string },
  { detail: ECMEventDetail }
>(functions, 'getECMEventDetail');

const downloadECMProgrammaCallable = httpsCallable<
  { eventId: string },
  { base64: string; filename: string; contentType: string }
>(functions, 'downloadECMProgramma');

export function useECMEventDetail() {
  const [detail, setDetail] = useState<ECMEventDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDetail = useCallback(async (eventId: string) => {
    setLoading(true);
    setError(null);
    setDetail(null);

    try {
      const result = await getECMEventDetailCallable({ eventId });
      setDetail(result.data.detail);
      return result.data.detail;
    } catch (err: any) {
      const msg = err?.message || 'Errore nel recupero del dettaglio';
      setError(msg.includes('Troppe richieste') ? msg : 'Impossibile recuperare il dettaglio. Riprova.');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearDetail = useCallback(() => {
    setDetail(null);
    setError(null);
  }, []);

  return { detail, loading, error, loadDetail, clearDetail };
}

export function useECMDownloadProgramma() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const download = useCallback(async (eventId: string) => {
    setLoading(true);
    setError(null);

    try {
      const result = await downloadECMProgrammaCallable({ eventId });
      const { base64, filename, contentType } = result.data;

      const byteChars = atob(base64);
      const byteArray = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteArray[i] = byteChars.charCodeAt(i);
      }
      const blob = new Blob([byteArray], { type: contentType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      const msg = err?.message || 'Errore nel download del programma';
      setError(msg.includes('Troppe richieste') ? msg : 'Impossibile scaricare il programma. Riprova.');
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, download };
}
