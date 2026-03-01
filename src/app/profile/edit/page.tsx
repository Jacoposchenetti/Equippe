'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useModal } from '@/contexts/ModalContext';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { requestNotificationPermission, saveFCMToken } from '@/lib/notifications';
import Header from '@/components/Header';
import LocationAutocomplete from '@/components/LocationAutocomplete';

const SPECIALIZZAZIONI = [
  'Psicologo',
  'Psicoterapeuta',
  'Psichiatra',
  'Nutrizionista',
  'Dietologo',
  'Logopedista'
];

const TEMATICHE = [
  'Disturbi d\'ansia',
  'Depressione',
  'Disturbi alimentari',
  'Trauma e PTSD',
  'Dipendenze',
  'Disturbi di personalità',
  'Autismo',
  'ADHD',
  'Disturbi dell\'umore',
  'Terapia di coppia',
  'Terapia familiare',
  'Neuropsicologia',
  'Psicologia dello sport',
  'Psicologia giuridica'
];

export default function EditProfilePage() {
  const { user, userProfile, refreshProfile, deleteCurrentUser } = useAuth();
  const { showToast, showConfirm } = useModal();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [nome, setNome] = useState('');
  const [dataNascita, setDataNascita] = useState('');
  const [specializzazioni, setSpecializzazioni] = useState<string[]>([]);
  const [tematiche, setTematiche] = useState<string[]>([]);
  const [bio, setBio] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [website, setWebsite] = useState('');
  const [telefono, setTelefono] = useState('');
  const [indirizzo, setIndirizzo] = useState('');
  const [coordinate, setCoordinate] = useState<{ lat: number; lng: number } | null>(null);
  const [studi, setStudi] = useState<Array<{indirizzo: string; coordinate?: {lat: number; lng: number}; remoto: boolean}>>([]);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (userProfile) {
      setNome(userProfile.profile.nome || '');
      
      // Normalizza specializzazioni esistenti
      const normalizedSpecs = userProfile.profile.specializzazioni
        .map(spec => {
          const map: Record<string, string> = {
            'Psicologia': 'Psicologo',
            'Psicoterapia': 'Psicoterapeuta',
            'Psichiatria': 'Psichiatra',
            'Nutrizione': 'Nutrizionista',
            
          };
          return map[spec] || spec;
        })
        .filter((spec, index, self) => self.indexOf(spec) === index); // Rimuovi duplicati
      
      setSpecializzazioni(normalizedSpecs);
      
      // Normalizza tematiche esistenti e rimuovi quelle obsolete
      const normalizedTematiche = userProfile.profile.tematiche
        .filter(tema => tema !== 'Dolore cronico' && tema !== 'Riabilitazione' && tema !== 'Riabilitazione motoria' && tema !== 'Geriatria' && tema !== 'Pediatria')
        .map(tema => {
          const map: Record<string, string> = {
            'DCA (Disturbi del Comportamento Alimentare)': 'Disturbi alimentari',
            'Ansia e stress': 'Disturbi d\'ansia',
            'Obesità': 'Disturbi alimentari',
            'Diabete': 'Disturbi alimentari',
          };
          return map[tema] || tema;
        })
        .filter((t, index, self) => self.indexOf(t) === index); // Rimuovi duplicati
      
      setTematiche(normalizedTematiche);
      
      setBio(userProfile.profile.bio || '');
      setLinkedin(userProfile.profile.linkedin || '');
      setWebsite(userProfile.profile.website || '');
      setTelefono(userProfile.profile.telefono || '');
      setIndirizzo(userProfile.profile.location?.indirizzo || '');
      // Inizializza coordinate se esistenti
      if (userProfile.profile.location?.lat && userProfile.profile.location?.lng) {
        setCoordinate({
          lat: userProfile.profile.location.lat,
          lng: userProfile.profile.location.lng
        });
      }
      
      // Inizializza studi esistenti o crea un array vuoto se non presenti
      if (userProfile.profile.studi && userProfile.profile.studi.length > 0) {
        setStudi(userProfile.profile.studi.map(studio => ({
          indirizzo: studio.indirizzo,
          coordinate: studio.coordinate,
          remoto: studio.remoto || false
        })));
      } else if (userProfile.profile.location?.indirizzo) {
        // Migra il vecchio indirizzo a studio singolo
        setStudi([{
          indirizzo: userProfile.profile.location.indirizzo,
          coordinate: coordinate || undefined,
          remoto: false
        }]);
      }
      setPhotoPreview(userProfile.profile.photoURL || '');
      setDataNascita(userProfile.profile.dataNascita || '');
      
      // Controlla stato notifiche
      if (typeof window !== 'undefined' && 'Notification' in window) {
        const hasPermission = Notification.permission === 'granted';
        const hasToken = !!userProfile.fcmToken;
        setNotificationEnabled(hasPermission && hasToken);
      }
      
      // Controlla stato notifiche
      if (typeof window !== 'undefined' && 'Notification' in window) {
        const hasPermission = Notification.permission === 'granted';
        const hasToken = !!userProfile.fcmToken;
        setNotificationEnabled(hasPermission && hasToken);
      }
    }
  }, [user, userProfile]);

  const handleSpecChange = (spec: string) => {
    if (specializzazioni.includes(spec)) {
      setSpecializzazioni(specializzazioni.filter(s => s !== spec));
    } else {
      setSpecializzazioni([...specializzazioni, spec]);
    }
  };

  const handleTemaChange = (tema: string) => {
    if (tematiche.includes(tema)) {
      setTematiche(tematiche.filter(t => t !== tema));
    } else {
      setTematiche([...tematiche, tema]);
    }
  };

  const addStudio = () => {
    setStudi([...studi, { indirizzo: '', remoto: false }]);
  };

  const removeStudio = (index: number) => {
    if (studi.length > 1) {
      setStudi(studi.filter((_, i) => i !== index));
    }
  };

  const updateStudio = (index: number, field: string, value: any) => {
    const updatedStudi = studi.map((studio, i) => {
      if (i === index) {
        return { ...studio, [field]: value };
      }
      return studio;
    });
    setStudi(updatedStudi);
  };

  const handleToggleNotifications = async () => {
    if (!user) return;
    
    setNotificationLoading(true);
    
    try {
      if (notificationEnabled) {
        // Disabilita notifiche - rimuovi il token FCM
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
          fcmToken: null,
          fcmTokenUpdatedAt: null
        });
        setNotificationEnabled(false);
        showToast('Notifiche push disabilitate', 'info');
      } else {
        // Abilita notifiche - richiedi permesso e salva token
        const token = await requestNotificationPermission();
        if (token) {
          await saveFCMToken(user.uid, token);
          setNotificationEnabled(true);
          showToast('Notifiche push abilitate con successo!', 'success');
        } else {
          showToast('Impossibile abilitare le notifiche. Controlla i permessi del browser.', 'error');
        }
      }
    } catch (error) {
      console.error('Errore toggle notifiche:', error);
      showToast('Errore durante la modifica delle notifiche', 'error');
    } finally {
      setNotificationLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user || !userProfile) return;

    if (!nome.trim()) {
      showToast('Il nome è obbligatorio', 'warning');
      return;
    }

    if (!dataNascita) {
      showToast('La data di nascita è obbligatoria', 'warning');
      return;
    }

    if (!indirizzo.trim() && studi.length === 0) {
      showToast('Inserisci almeno un indirizzo di studio nella sezione "Localizzazione"', 'warning');
      return;
    }

    if (studi.length > 0) {
      const hasEmptyStudi = studi.some(studio => !studio.indirizzo.trim());
      if (hasEmptyStudi) {
        showToast('Tutti gli studi devono avere un indirizzo valido', 'warning');
        return;
      }
    }

    if (specializzazioni.length === 0) {
      showToast('Seleziona almeno una specializzazione', 'warning');
      return;
    }

    setLoading(true);

    try {
      const userRef = doc(db, 'users', user.uid);
      
      // Upload foto profilo se presente
      let photoURL = userProfile.profile.photoURL || '';
      if (photoFile) {
        try {
          console.log('Inizio upload foto profilo...');
          const photoRef = ref(storage, `profile-photos/${user.uid}`);
          await uploadBytes(photoRef, photoFile);
          photoURL = await getDownloadURL(photoRef);
          console.log('Foto caricata con successo:', photoURL);
        } catch (uploadError) {
          console.error('Errore upload foto:', uploadError);
          showToast('Errore durante il caricamento della foto. Il profilo verrà salvato senza foto.', 'error');
          // Continua comunque con il salvataggio del resto
        }
      }
      
      // Prepara i dati degli studi con coordinate e città/provincia
      const studiData = studi.length > 0 ? studi.map(studio => {
        const parts = studio.indirizzo.split(',');
        let città = '';
        let provincia = '';
        
        if (parts.length >= 2) {
          città = parts[parts.length - 2].trim();
          const lastPart = parts[parts.length - 1].trim();
          const provinciaMatch = lastPart.match(/\b([A-Z]{2})\b/);
          if (provinciaMatch) {
            provincia = provinciaMatch[1];
          }
        }
        
        return {
          indirizzo: studio.indirizzo.trim(),
          città: città,
          provincia: provincia,
          remoto: studio.remoto,
          coordinate: studio.coordinate || { lat: 0, lng: 0 }
        };
      }) : [];
      
      // Mantieni compatibilità con location principale (usa primo studio se disponibile)
      const mainLocation = studiData.length > 0 ? {
        indirizzo: studiData[0].indirizzo,
        città: studiData[0].città,
        provincia: studiData[0].provincia,
        lat: studiData[0].coordinate?.lat || 0,
        lng: studiData[0].coordinate?.lng || 0
      } : {
        indirizzo: indirizzo.trim(),
        città: '',
        provincia: '',
        lat: coordinate?.lat || 0,
        lng: coordinate?.lng || 0
      };
      
      const updateData: any = {
        'profile.nome': nome.trim(),
        'profile.dataNascita': dataNascita,
        'profile.specializzazioni': specializzazioni,
        'profile.tematiche': tematiche,
        'profile.bio': bio.trim(),
        'profile.linkedin': linkedin.trim(),
        'profile.website': website.trim(),
        'profile.telefono': telefono.trim(),
        'profile.location.indirizzo': mainLocation.indirizzo,
        'profile.location.città': mainLocation.città,
        'profile.location.provincia': mainLocation.provincia,
        'profile.location.lat': mainLocation.lat,
        'profile.location.lng': mainLocation.lng,
        'profile.studi': studiData, // Aggiunge gli studi multipli
        updatedAt: new Date()
      };
      
      // Aggiungi photoURL solo se esiste
      if (photoURL) {
        updateData['profile.photoURL'] = photoURL;
      }
      
      console.log('Salvataggio profilo...', updateData);
      await updateDoc(userRef, updateData);

      await refreshProfile();
      showToast('Profilo aggiornato con successo!', 'success');
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Errore aggiornamento profilo:', error);
      showToast(`Errore durante l'aggiornamento del profilo: ${error.message || error}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;

    const firstConfirm = await showConfirm({
      title: 'Elimina account',
      message: 'Sei sicuro di voler eliminare definitivamente il tuo account? Questa azione non può essere annullata.',
      variant: 'danger',
      confirmText: 'Elimina'
    });
    if (!firstConfirm) return;

    const typedConfirmation = await showConfirm({
      title: 'Conferma eliminazione',
      message: 'Per confermare, clicca "ELIMINA". Questa operazione è irreversibile.',
      variant: 'danger',
      confirmText: 'ELIMINA'
    });
    if (!typedConfirmation) {
      showToast('Eliminazione account annullata.', 'info');
      return;
    }

    setDeletingAccount(true);
    try {
      await deleteDoc(doc(db, 'users', user.uid));
      await deleteCurrentUser();
      showToast('Il tuo account è stato eliminato con successo.', 'success');
      navigate('/');
    } catch (error: any) {
      console.error('Errore eliminazione account:', error);
      if (error?.code === 'auth/requires-recent-login') {
        showToast('Per motivi di sicurezza devi effettuare nuovamente l\'accesso prima di eliminare l\'account. Esci, rientra e riprova.', 'warning');
      } else {
        showToast(`Errore durante l'eliminazione dell'account: ${error?.message || error}`, 'error');
      }
    } finally {
      setDeletingAccount(false);
    }
  };

  if (!userProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-600">Caricamento...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Modifica Profilo</h1>
          <p className="text-gray-600 mt-2">Aggiorna le tue informazioni professionali</p>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Informazioni base */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Informazioni Base</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Foto Profilo
                </label>
                <div className="flex items-center gap-6">
                  <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                    {photoPreview ? (
                      <img src={photoPreview} alt="Foto profilo" className="w-full h-full object-cover" />
                    ) : (
                      <svg className="w-16 h-16 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setPhotoFile(file);
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setPhotoPreview(reader.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                    <p className="text-xs text-gray-500 mt-2">JPG, PNG o GIF. Max 5MB.</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data di Nascita *
                </label>
                <input
                  type="date"
                  value={dataNascita}
                  onChange={(e) => setDataNascita(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={userProfile.email}
                  disabled
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">L'email non può essere modificata</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Telefono
                </label>
                <input
                  type="tel"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="+39 123 456 7890"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Localizzazione - Studi */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900">Studi e Sedi di Lavoro</h2>
                <p className="text-sm text-gray-600 mt-1">Aggiungi i luoghi dove ricevi pazienti o svolgi la tua attività</p>
              </div>
              <button
                type="button"
                onClick={addStudio}
                className="w-full sm:w-auto px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-sm font-medium whitespace-nowrap"
              >
                + Aggiungi Studio
              </button>
            </div>
            
            {/* Mantieni il campo legacy per compatibilità */}
            {indirizzo && studi.length === 0 && (
              <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.728-.833-2.498 0L4.316 15.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-yellow-800">Vecchia configurazione rilevata</h3>
                    <p className="text-xs text-yellow-600 mt-1">
                      Hai un indirizzo salvato nel vecchio formato. Ti consigliamo di convertirlo in uno studio per gestire più sedi.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        if (indirizzo) {
                          setStudi([{
                            indirizzo: indirizzo,
                            coordinate: coordinate || undefined,
                            remoto: false
                          }]);
                          setIndirizzo('');
                          setCoordinate(null);
                        }
                      }}
                      className="mt-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded hover:bg-yellow-200 transition"
                    >
                      Converti in Studio
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Lista Studi */}
            {studi.length > 0 ? (
              <div className="space-y-4">
                {studi.map((studio, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-medium text-gray-900">Studio {index + 1}</h3>
                      {studi.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeStudio(index)}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          ✕ Rimuovi
                        </button>
                      )}
                    </div>
                    
                    <div className="space-y-3">
                      <LocationAutocomplete
                        value={studio.indirizzo}
                        onChange={(address, coords) => {
                          updateStudio(index, 'indirizzo', address);
                          if (coords) {
                            updateStudio(index, 'coordinate', coords);
                            console.log(`📍 Coordinate studio ${index + 1}:`, coords);
                          }
                        }}
                        placeholder="Via, Città, Zona..."
                        label={`Indirizzo Studio ${index + 1} *`}
                      />
                      
                      <div className="flex items-center">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={studio.remoto}
                            onChange={(e) => updateStudio(index, 'remoto', e.target.checked)}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">Lavoro da remoto disponibile</span>
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2">🏢</div>
                <p className="text-lg font-medium mb-2">Nessuno studio configurato</p>
                <p className="text-sm mb-4">Aggiungi almeno uno studio dove ricevi i pazienti</p>
                <button
                  type="button"
                  onClick={addStudio}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                >
                  Aggiungi Primo Studio
                </button>
              </div>
            )}
          </div>

          {/* Specializzazioni */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Specializzazioni *</h2>
            <p className="text-gray-600 mb-4">Seleziona le tue aree professionali</p>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {SPECIALIZZAZIONI.map((spec) => (
                <label
                  key={spec}
                  className={`flex items-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition ${
                    specializzazioni.includes(spec)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={specializzazioni.includes(spec)}
                    onChange={() => handleSpecChange(spec)}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-sm font-medium">{spec}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Tematiche */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Tematiche di Interesse</h2>
            <p className="text-gray-600 mb-4">Seleziona le tematiche su cui lavori</p>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {TEMATICHE.map((tema) => (
                <label
                  key={tema}
                  className={`flex items-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition ${
                    tematiche.includes(tema)
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={tematiche.includes(tema)}
                    onChange={() => handleTemaChange(tema)}
                    className="w-4 h-4 text-green-600"
                  />
                  <span className="text-sm font-medium">{tema}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Bio */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Bio</h2>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={6}
              placeholder="Raccontaci di te, della tua esperienza e del tuo approccio professionale..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Link social */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Link Professionali</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  LinkedIn
                </label>
                <input
                  type="url"
                  value={linkedin}
                  onChange={(e) => setLinkedin(e.target.value)}
                  placeholder="https://linkedin.com/in/tuoprofilo"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sito Web
                </label>
                <input
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://tuosito.com"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Notifiche Push */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Notifiche Push</h2>
            <p className="text-gray-600 mb-6">
              Ricevi notifiche istantanee per messaggi, inviti e richieste da équipe
            </p>
            
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  notificationEnabled ? 'bg-green-100' : 'bg-gray-100'
                }`}>
                  {notificationEnabled ? (
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-.707-1.707l1.293-1.293a1 1 0 01.707-.293V8a6 6 0 1112 0v4.414l1.293 1.293A1 1 0 0118 15h-1.586l-1.707 1.707A1 1 0 0114 17H10a1 1 0 01-.707-.293L7.586 15zM6 8v8h12V8a6 6 0 00-12 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.5 3.5L6 21" />
                    </svg>
                  )}
                </div>
                
                <div>
                  <h3 className="font-semibold text-gray-900">
                    Notifiche Push {notificationEnabled ? 'Abilitate' : 'Disabilitate'}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {notificationEnabled 
                      ? 'Riceverai notifiche push per nuovi messaggi e attività'
                      : 'Abilita per ricevere notifiche istantanee'
                    }
                  </p>
                </div>
              </div>
              
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notificationEnabled}
                  onChange={handleToggleNotifications}
                  disabled={notificationLoading}
                  className="sr-only"
                />
                <div className={`relative w-14 h-8 rounded-full transition-colors duration-200 ${
                  notificationEnabled ? 'bg-blue-600' : 'bg-gray-300'
                } ${notificationLoading ? 'opacity-50' : ''}`}>
                  <div className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform duration-200 ${
                    notificationEnabled ? 'transform translate-x-6' : ''
                  }`} />
                </div>
              </label>
            </div>
            
            {notificationLoading && (
              <p className="text-sm text-gray-500 mt-2 flex items-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Aggiornamento in corso...
              </p>
            )}
          </div>

          {/* Eliminazione account */}
          <div className="bg-red-50 border border-red-200 rounded-xl p-6">
            <h2 className="text-2xl font-bold text-red-800 mb-2">Zona Pericolosa</h2>
            <p className="text-red-700 mb-4">
              Eliminando l'account perderai definitivamente accesso al profilo e ai dati associati.
            </p>
            <button
              type="button"
              onClick={handleDeleteAccount}
              disabled={deletingAccount}
              className="px-5 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              {deletingAccount ? 'Eliminazione in corso...' : 'Elimina il mio account'}
            </button>
          </div>

          {/* Bottoni azione */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white py-4 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
            >
              {loading ? 'Salvataggio...' : 'Salva Modifiche'}
            </button>
            
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="px-8 py-4 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition"
            >
              Annulla
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
