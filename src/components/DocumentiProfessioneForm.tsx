import { useState } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage, auth } from '@/lib/firebase';
import { DocumentoVerifica, ProfessioneConDocumenti } from '@/types/equippe';
import { getConfigurazioneProfessione, DocumentoRichiesto } from '@/lib/professioni';

interface Props {
  professione: string;
  onComplete: (data: ProfessioneConDocumenti) => void;
  onCancel: () => void;
}

export default function DocumentiProfessioneForm({ professione, onComplete, onCancel }: Props) {
  const config = getConfigurazioneProfessione(professione);
  const [documenti, setDocumenti] = useState<{ [key: string]: { valore: string; file?: File } }>({});
  const [note, setNote] = useState('');
  const [tematicheSelezionate, setTematicheSelezionate] = useState<string[]>([]);
  const [anniEsperienza, setAnniEsperienza] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!config) {
    return <div className="text-red-600">Configurazione professione non trovata</div>;
  }

  const handleDocumentoChange = (docNome: string, valore: string) => {
    setDocumenti({
      ...documenti,
      [docNome]: { ...documenti[docNome], valore }
    });
  };

  const handleFileChange = (docNome: string, file: File | null) => {
    if (file) {
      setDocumenti({
        ...documenti,
        [docNome]: { ...documenti[docNome], valore: documenti[docNome]?.valore || '', file }
      });
    }
  };

  const handleSubmit = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    console.log('📝 Inizio submit documenti professione:', professione);
    setError('');

    // Verifica che tutti i documenti obbligatori siano compilati
    for (const doc of config.documentiRichiesti) {
      if (doc.obbligatorio && !documenti[doc.nome]?.valore) {
        setError(`Il campo "${doc.nome}" è obbligatorio`);
        return;
      }
    }

    // Verifica che siano selezionate almeno alcune tematiche se disponibili
    if (config.tematiche && config.tematiche.length > 0 && tematicheSelezionate.length === 0) {
      setError('Seleziona almeno una tematica di competenza');
      return;
    }

    // Verifica anni esperienza
    if (!anniEsperienza) {
      setError('Specifica gli anni di esperienza');
      return;
    }

    setLoading(true);

    try {
      const documentiVerifica: DocumentoVerifica[] = [];

      // Upload dei file e creazione oggetti DocumentoVerifica
      for (const docConfig of config.documentiRichiesti) {
        const doc = documenti[docConfig.nome];
        if (!doc || !doc.valore) {
          if (docConfig.obbligatorio) {
            throw new Error(`Documento obbligatorio mancante: ${docConfig.nome}`);
          }
          continue;
        }

        let fileURL: string | undefined;
        
        // Upload del file se presente
        if (doc.file) {
          const currentUser = auth.currentUser;
          if (!currentUser) {
            throw new Error('Utente non autenticato');
          }
          
          console.log('📤 Upload file per:', docConfig.nome);
          const timestamp = Date.now();
          const fileName = `${professione}_${docConfig.nome}_${timestamp}`;
          const fileRef = ref(storage, `verification-documents/${currentUser.uid}/${fileName}`);
          
          await uploadBytes(fileRef, doc.file);
          fileURL = await getDownloadURL(fileRef);
          console.log('✅ File caricato:', fileURL);
        }

        documentiVerifica.push({
          tipo: docConfig.tipo,
          nome: docConfig.nome,
          valore: doc.valore,
          fileURL
        });
      }

      const result: ProfessioneConDocumenti = {
        professione,
        documenti: documentiVerifica,
        note: note.trim() || undefined,
        tematiche: tematicheSelezionate.length > 0 ? tematicheSelezionate : undefined,
        anniEsperienza: anniEsperienza || undefined
      };

      console.log('✅ Documenti completati, chiamo onComplete');
      onComplete(result);
    } catch (err: any) {
      console.error('❌ Errore upload documenti:', err);
      setError(err.message || 'Errore durante il caricamento dei documenti');
      setLoading(false);
    }
  };

  return (
    <div className="border-2 border-blue-200 rounded-lg p-6 bg-blue-50">
      <h3 className="text-xl font-semibold mb-4 text-blue-900">
        Documenti per: {professione}
      </h3>

      {config.noteAggiuntive && (
        <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4 text-sm text-yellow-900">
          <strong>ℹ️ Nota:</strong> {config.noteAggiuntive}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3 mb-4 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {/* Tematiche - se disponibili per questa professione */}
        {config.tematiche && config.tematiche.length > 0 && (
          <div className="bg-white rounded p-4 border">
            <label className="block text-sm font-medium mb-3">
              Tematiche di competenza <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-600 mb-3">
              Seleziona le tematiche in cui hai esperienza e competenza
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {config.tematiche.map((tematica) => (
                <label key={tematica} className="flex items-center space-x-2 text-sm">
                  <input
                    type="checkbox"
                    checked={tematicheSelezionate.includes(tematica)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setTematicheSelezionate([...tematicheSelezionate, tematica]);
                      } else {
                        setTematicheSelezionate(tematicheSelezionate.filter(t => t !== tematica));
                      }
                    }}
                    className="rounded"
                  />
                  <span>{tematica}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Anni di esperienza */}
        <div className="bg-white rounded p-4 border">
          <label className="block text-sm font-medium mb-2">
            Anni di esperienza come {professione} <span className="text-red-500">*</span>
          </label>
          <select
            className="w-full px-3 py-2 border rounded"
            value={anniEsperienza}
            onChange={(e) => setAnniEsperienza(e.target.value)}
            required
          >
            <option value="">Seleziona...</option>
            <option value="0-2">0-2 anni</option>
            <option value="3-5">3-5 anni</option>
            <option value="6-10">6-10 anni</option>
            <option value="11-15">11-15 anni</option>
            <option value="16-20">16-20 anni</option>
            <option value="20+">Oltre 20 anni</option>
          </select>
        </div>

        {config.documentiRichiesti.map((doc) => (
          <div key={doc.nome} className="bg-white rounded p-4 border">
            <label className="block text-sm font-medium mb-2">
              {doc.nome} {doc.obbligatorio && <span className="text-red-500">*</span>}
            </label>
            
            {doc.descrizione && (
              <p className="text-xs text-gray-600 mb-2">{doc.descrizione}</p>
            )}

            <input
              type="text"
              required={doc.obbligatorio}
              placeholder={doc.placeholder}
              className="w-full px-3 py-2 border rounded mb-2"
              value={documenti[doc.nome]?.valore || ''}
              onChange={(e) => handleDocumentoChange(doc.nome, e.target.value)}
            />

            <div className="mt-2">
              <label className="block text-xs text-gray-600 mb-1">
                Allega documento (opzionale)
              </label>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="text-sm"
                onChange={(e) => handleFileChange(doc.nome, e.target.files?.[0] || null)}
              />
              {documenti[doc.nome]?.file && (
                <p className="text-xs text-green-600 mt-1">
                  ✓ File selezionato: {documenti[doc.nome].file?.name}
                </p>
              )}
            </div>
          </div>
        ))}

        {/* Campo note aggiuntive */}
        <div className="bg-white rounded p-4 border">
          <label className="block text-sm font-medium mb-2">
            Note aggiuntive (facoltativo)
          </label>
          <textarea
            className="w-full px-3 py-2 border rounded"
            rows={3}
            placeholder="Eventuali note o informazioni aggiuntive per la verifica..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2 px-4 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Caricamento...' : 'Conferma Professione'}
          </button>
        </div>
      </div>
    </div>
  );
}
