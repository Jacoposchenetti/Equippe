import { useEffect, useState, useMemo } from 'react';
import { collection, getDocs, query, where, getDoc, doc } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { db } from '@/lib/firebase';
import { UserProfile, Availability } from '@/types/equippe';
import { PROFESSIONI_DISPONIBILI } from '@/lib/professioni';
import ProfessionalCard from '@/components/ProfessionalCard';

interface DirectoryEntry {
  uid: string;
  nome: string;
  photoURL?: string;
  professione: string;
  città?: string;
  remoto: boolean;
  presenziale: boolean;
  tematiche?: string[];
  verified: boolean;
}

type Modalità = 'tutte' | 'presenziale' | 'online';

export default function TrovaPage() {
  const [entries, setEntries] = useState<DirectoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [filterProfessione, setFilterProfessione] = useState('');
  const [filterCittà, setFilterCittà] = useState('');
  const [filterModalità, setFilterModalità] = useState<Modalità>('tutte');

  useEffect(() => {
    loadDirectory();
  }, []);

  const loadDirectory = async () => {
    try {
      // Step 1: get all UIDs with isPublic == true
      const availSnap = await getDocs(
        query(collection(db, 'availability'), where('isPublic', '==', true))
      );
      if (availSnap.empty) {
        setDebugInfo('availability query: 0 docs with isPublic==true');
        setEntries([]);
        setLoading(false);
        return;
      }

      const uids = availSnap.docs.map(d => d.id);
      setDebugInfo(`availability: ${uids.length} UIDs found: ${uids.join(', ')}`);

      // Step 2: batch-fetch user docs in parallel
      const userDocs = await Promise.all(uids.map(uid => getDoc(doc(db, 'users', uid))));

      const result: DirectoryEntry[] = [];
      const skipReasons: string[] = [];
      userDocs.forEach(userDoc => {
        if (!userDoc.exists()) { skipReasons.push(`${(userDoc as {id: string}).id}: doc not found`); return; }
        const data = userDoc.data();
        const uid = userDoc.id;
        const profile = data.profile as UserProfile;

        // Only show verified professionals:
        // either top-level verificationInfo.status === 'approved',
        // or they have at least one admin-approved profession in professioniConDocumenti
        const hasApprovedStatus = profile.verificationInfo?.status === 'approved';
        const hasApprovedProfession = (profile.professioniConDocumenti?.length ?? 0) > 0;
        if (!hasApprovedStatus && !hasApprovedProfession) {
          skipReasons.push(`${uid}: no approved status (${profile.verificationInfo?.status}) and no professioniConDocumenti (${(profile.professioniConDocumenti?.length ?? 0)})`);
          return;
        }

        const professioni = profile.professioniConDocumenti ?? [];
        const professione = professioni[0]?.professione ?? profile.albo ?? '';
        if (!professione) { skipReasons.push(`${uid}: professione empty (albo=${profile.albo})`); return; }

        const tematiche = profile.tematiche?.length
          ? profile.tematiche
          : (professioni[0]?.tematiche ?? []);

        const studi = profile.studi ?? [];
        const città = studi[0]?.città ?? profile.location?.città ?? undefined;
        const remoto = studi.some(s => s.remoto);
        const presenziale = studi.some(s => !s.remoto);

        result.push({
          uid,
          nome: data.displayName ?? profile.nome ?? 'Professionista',
          photoURL: profile.photoURL,
          professione,
          città,
          remoto,
          presenziale,
          tematiche,
          verified: true,
        });
      });

      if (skipReasons.length > 0) setDebugInfo(prev => prev + ' | skip: ' + skipReasons.join('; '));
      // Sort alphabetically by name
      result.sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
      setEntries(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setDebugInfo('ERROR: ' + msg);
      console.error('Error loading directory:', e);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    return entries.filter(e => {
      if (filterProfessione && e.professione !== filterProfessione) return false;
      if (filterCittà && !e.città?.toLowerCase().includes(filterCittà.toLowerCase())) return false;
      if (filterModalità === 'online' && !e.remoto) return false;
      if (filterModalità === 'presenziale' && !e.presenziale) return false;
      return true;
    });
  }, [entries, filterProfessione, filterCittà, filterModalità]);

  const resetFilters = () => {
    setFilterProfessione('');
    setFilterCittà('');
    setFilterModalità('tutte');
  };

  const hasActiveFilters = filterProfessione || filterCittà || filterModalità !== 'tutte';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center">
            <span className="text-blue-600 font-bold text-xl">tua</span>
            <span className="text-green-600 font-bold text-xl">equipe</span>
            <span className="text-orange-500 font-bold text-xl">.it</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/paziente/login" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
              Accedi
            </Link>
            <Link
              to="/paziente/registrati"
              className="text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Crea account
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Title */}
        <div className="mb-8">
          <p className="text-sm font-semibold text-blue-600 uppercase tracking-wider mb-2">
            Directory professionisti
          </p>
          <h1 className="text-3xl font-extrabold text-gray-900 mb-2">
            Trova il tuo professionista sanitario
          </h1>
          <p className="text-gray-600">
            Tutti i professionisti su TuaEquipe sono verificati e iscritti ai rispettivi albi professionali.
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">
                Specializzazione
              </label>
              <select
                value={filterProfessione}
                onChange={e => setFilterProfessione(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
              >
                <option value="">Tutte le specializzazioni</option>
                {PROFESSIONI_DISPONIBILI.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">
                Città
              </label>
              <input
                value={filterCittà}
                onChange={e => setFilterCittà(e.target.value)}
                placeholder="es. Milano, Roma, Torino…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">
                Modalità
              </label>
              <select
                value={filterModalità}
                onChange={e => setFilterModalità(e.target.value as Modalità)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
              >
                <option value="tutte">Tutte le modalità</option>
                <option value="presenziale">In presenza</option>
                <option value="online">Online</option>
              </select>
            </div>
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 animate-pulse">
                <div className="flex gap-3 mb-3">
                  <div className="w-14 h-14 bg-gray-200 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-2 pt-1">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </div>
                </div>
                <div className="h-3 bg-gray-200 rounded w-1/3 mb-3" />
                <div className="flex gap-2 mb-4">
                  <div className="h-5 bg-gray-200 rounded-full w-16" />
                  <div className="h-5 bg-gray-200 rounded-full w-20" />
                </div>
                <div className="h-10 bg-gray-200 rounded-lg" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">🔍</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Nessun professionista trovato</h3>
            <p className="text-gray-600 text-sm mb-4">Prova a modificare i filtri di ricerca.</p>
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="text-sm text-blue-600 hover:underline font-medium"
              >
                Rimuovi tutti i filtri
              </button>
            )}
            {debugInfo && (
              <p className="mt-4 text-xs text-gray-400 bg-gray-100 rounded p-2 max-w-2xl mx-auto break-all">{debugInfo}</p>
            )}
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-4">
              {filtered.length} professionista{filtered.length !== 1 ? 'i' : ''} trovat{filtered.length !== 1 ? 'i' : 'o'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(e => (
                <ProfessionalCard key={e.uid} {...e} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-200 mt-16 py-8 text-center text-sm text-gray-400">
        <p>
          <Link to="/" className="hover:text-gray-600 transition-colors">tuaequipe.it</Link>
          {' · '}
          <Link to="/legal/privacy" className="hover:text-gray-600 transition-colors">Privacy</Link>
          {' · '}
          <Link to="/legal/termini" className="hover:text-gray-600 transition-colors">Termini</Link>
        </p>
      </footer>
    </div>
  );
}
