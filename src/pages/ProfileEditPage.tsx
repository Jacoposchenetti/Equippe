'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useModal } from '@/contexts/ModalContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { doc, updateDoc, deleteDoc, deleteField } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { requestNotificationPermission, saveFCMToken } from '@/lib/notifications';
import Header from '@/components/Header';
import LocationAutocomplete from '@/components/LocationAutocomplete';
import DocumentiProfessioneForm from '@/components/DocumentiProfessioneForm';
import { CurriculumEditor } from '@/components/CurriculumSection';
import { ProfessioneConDocumenti, EsperienzaProfessionale, Formazione, Certificazione } from '@/types/equippe';
import { getConfigurazioneProfessione } from '@/lib/professioni';

const SPECIALIZZAZIONI = [
  'Psicologo',
  'Psicoterapeuta',
  'Psichiatra',
  'Nutrizionista',
  'Dietologo',
  'Logopedista',
  
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

function removeUndefined(obj: any): any {
  if (Array.isArray(obj)) return obj.map(item => removeUndefined(item));
  if (obj !== null && typeof obj === 'object') {
    const cleaned: any = {};
    Object.keys(obj).forEach(key => {
      const value = obj[key];
      if (value !== undefined) cleaned[key] = removeUndefined(value);
    });
    return cleaned;
  }
  return obj;
}

function CollapsibleSection({ title, children, defaultOpen = false, subtitle, id, forceOpen }: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  subtitle?: string;
  id?: string;
  forceOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen || !!forceOpen);
  useEffect(() => { if (forceOpen) setOpen(true); }, [forceOpen]);
  return (
    <div id={id} className="bg-white rounded-xl shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-50 transition-colors"
      >
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
          {subtitle && !open && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <svg
          className={`w-6 h-6 text-gray-400 transition-transform duration-200 flex-shrink-0 ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="px-6 pb-6">{children}</div>}
    </div>
  );
}

export default function EditProfilePage() {
  const { user, userProfile, refreshProfile, deleteCurrentUser } = useAuth();
  const { showToast, showConfirm } = useModal();
  const navigate = useNavigate();
  const location = useLocation();
  const targetHash = location.hash.replace('#', '');

  useEffect(() => {
    if (!targetHash) return;
    const el = document.getElementById(targetHash);
    if (el) {
      setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
    }
  }, [targetHash]);

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
  
  // Gestione nuove professioni
  const [professioniApprovate, setProfessioniApprovate] = useState<ProfessioneConDocumenti[]>([]);
  const [professioniPending, setProfessioniPending] = useState<ProfessioneConDocumenti[]>([]);
  const [selectedProfessione, setSelectedProfessione] = useState<string>('');
  const [showDocumentiForm, setShowDocumentiForm] = useState(false);

  // Curriculum: esperienze, formazione, certificazioni
  const [esperienze, setEsperienze] = useState<EsperienzaProfessionale[]>([]);
  const [formazione, setFormazione] = useState<Formazione[]>([]);
  const [certificazioni, setCertificazioni] = useState<Certificazione[]>([]);

  // Auto-save
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const isInitializedRef = useRef(false);
  const lastUploadedFileRef = useRef<File | null>(null);
  const isSavingRef = useRef(false);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (userProfile && !isInitializedRef.current) {
      isInitializedRef.current = true;
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
      
      // Carica curriculum
      setEsperienze(userProfile.profile.esperienze || []);
      setFormazione(userProfile.profile.formazione || []);
      setCertificazioni(userProfile.profile.certificazioni || []);
      
      // Carica professioni approvate e pending
      if (userProfile.profile.professioniConDocumenti && userProfile.profile.professioniConDocumenti.length > 0) {
        setProfessioniApprovate(userProfile.profile.professioniConDocumenti);
        
        // Raccogli tutte le tematiche dalle professioni approvate
        const tutteTematiche = new Set<string>();
        userProfile.profile.professioniConDocumenti.forEach(prof => {
          if (prof.tematiche) {
            prof.tematiche.forEach(t => tutteTematiche.add(t));
          }
        });
        
        // Unisci con le tematiche generali
        const tematicheUnite = [...new Set([...normalizedTematiche, ...Array.from(tutteTematiche)])];
        setTematiche(tematicheUnite);
      } else if (normalizedSpecs.length > 0) {
        // Migrazione: se ha solo specializzazioni vecchie, mettile come pending (non sono state verificate dall'admin)
        const professioniMigrate = normalizedSpecs.map(spec => ({
          professione: spec,
          documenti: [],
          note: 'Migrato da sistema precedente - in attesa di verifica'
        }));
        setProfessioniPending(prev => [...prev, ...professioniMigrate]);
      }
      
      if (userProfile.profile.professioniPending && userProfile.profile.professioniPending.length > 0) {
        setProfessioniPending(userProfile.profile.professioniPending);
        
        // Raccogli anche le tematiche dalle professioni pending
        const tutteTematichePending = new Set<string>();
        userProfile.profile.professioniPending.forEach(prof => {
          if (prof.tematiche) {
            prof.tematiche.forEach(t => tutteTematichePending.add(t));
          }
        });
        
        // Unisci con le tematiche già presenti
        setTematiche(prev => [...new Set([...prev, ...Array.from(tutteTematichePending)])]);
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
    setTimeout(() => triggerSave(), 0);
  };

  const handleTemaChange = (tema: string) => {
    if (tematiche.includes(tema)) {
      setTematiche(tematiche.filter(t => t !== tema));
    } else {
      setTematiche([...tematiche, tema]);
    }
    setTimeout(() => triggerSave(), 0);
  };

  const addStudio = () => {
    setStudi([...studi, { indirizzo: '', remoto: false }]);
    setTimeout(() => triggerSave(), 0);
  };

  const removeStudio = (index: number) => {
    if (studi.length > 1) {
      setStudi(studi.filter((_, i) => i !== index));
      setTimeout(() => triggerSave(), 0);
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
    setTimeout(() => triggerSave(), 0);
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
        showToast('🔕 Notifiche push disabilitate', 'info');
      } else {
        // Abilita notifiche - richiedi permesso e salva token
        const token = await requestNotificationPermission();
        if (token) {
          await saveFCMToken(user.uid, token);
          setNotificationEnabled(true);
          showToast('🔔 Notifiche push abilitate con successo!', 'success');
        } else {
          showToast('Impossibile abilitare le notifiche. Controlla i permessi del browser.', 'warning');
        }
      }
    } catch (error) {
      console.error('Errore toggle notifiche:', error);
      showToast('Errore durante la modifica delle notifiche', 'error');
    } finally {
      setNotificationLoading(false);
    }
  };
  const handleAddProfessione = () => {
    if (!selectedProfessione) {
      showToast('Seleziona una professione da aggiungere', 'warning');
      return;
    }
    
    // Controlla se la professione è già presente (approvata o pending)
    const giaPresente = professioniApprovate.some(p => p.professione === selectedProfessione) ||
                        professioniPending.some(p => p.professione === selectedProfessione);
    
    if (giaPresente) {
      showToast('Questa professione è già presente nel tuo profilo', 'warning');
      return;
    }
    
    setShowDocumentiForm(true);
  };

  const handleDocumentiComplete = async (professioneData: ProfessioneConDocumenti) => {
    const newProfessioniPending = [...professioniPending, professioneData];
    setProfessioniPending(newProfessioniPending);
    if (professioneData.tematiche && professioneData.tematiche.length > 0) {
      const nuoveTematiche = [...new Set([...tematiche, ...professioneData.tematiche])];
      setTematiche(nuoveTematiche);
    }
    setShowDocumentiForm(false);
    setSelectedProfessione('');

    // Salva direttamente con i dati calcolati per evitare stale closure
    if (user) {
      try {
        setAutoSaveStatus('saving');
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
          'profile.professioniPending': removeUndefined(newProfessioniPending),
          updatedAt: new Date()
        });
        await refreshProfile();
        setAutoSaveStatus('saved');
        setTimeout(() => setAutoSaveStatus(s => s === 'saved' ? 'idle' : s), 3000);
      } catch (err) {
        console.error('Errore salvataggio professione pending:', err);
        setAutoSaveStatus('error');
      }
    }

    showToast('✅ Professione aggiunta! Sarà visibile dopo l\'approvazione dell\'amministratore.', 'success');
  };

  const handleCancelDocumenti = () => {
    setShowDocumentiForm(false);
    setSelectedProfessione('');
  };

  const handleRemoveProfessioneApprovata = async (index: number) => {
    const professioneDaRimuovere = professioniApprovate[index];
    if (!professioneDaRimuovere) return;

    const confirmed = await showConfirm({
      title: 'Rimuovi professione',
      message: `Vuoi rimuovere la professione approvata "${professioneDaRimuovere.professione}" dal tuo profilo?`,
      variant: 'warning',
      confirmText: 'Rimuovi'
    });
    if (!confirmed) {
      return;
    }

    const newProfessioniApprovate = professioniApprovate.filter((_, i) => i !== index);
    setProfessioniApprovate(newProfessioniApprovate);

    if (user) {
      try {
        setAutoSaveStatus('saving');
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
          'profile.professioniConDocumenti': newProfessioniApprovate.length > 0 ? newProfessioniApprovate : deleteField(),
          'profile.specializzazioni': newProfessioniApprovate.map(p => p.professione),
          updatedAt: new Date()
        });
        await refreshProfile();
        setAutoSaveStatus('saved');
        setTimeout(() => setAutoSaveStatus(s => s === 'saved' ? 'idle' : s), 3000);
      } catch {
        setAutoSaveStatus('error');
      }
    }
  };

  const handleRemoveProfessionePending = async (index: number) => {
    const confirmed = await showConfirm({
      title: 'Annulla richiesta',
      message: 'Vuoi annullare la richiesta di convalida per questa professione?',
      variant: 'warning',
      confirmText: 'Annulla richiesta'
    });
    if (confirmed) {
      const newProfessioniPending = professioniPending.filter((_, i) => i !== index);
      setProfessioniPending(newProfessioniPending);

      if (user) {
        try {
          setAutoSaveStatus('saving');
          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, {
            'profile.professioniPending': newProfessioniPending.length > 0 ? newProfessioniPending : deleteField(),
            updatedAt: new Date()
          });
          await refreshProfile();
          setAutoSaveStatus('saved');
          setTimeout(() => setAutoSaveStatus(s => s === 'saved' ? 'idle' : s), 3000);
        } catch {
          setAutoSaveStatus('error');
        }
      }
    }
  };
  const performSave = async () => {
    if (!user || !userProfile || isSavingRef.current) return;
    if (!nome.trim() || !dataNascita) return;

    isSavingRef.current = true;
    try {
      const userRef = doc(db, 'users', user.uid);

      // Upload foto profilo se nuova e non già caricata in questa sessione
      let photoURL = userProfile.profile.photoURL || '';
      if (photoFile && photoFile !== lastUploadedFileRef.current) {
        try {
          const photoRef = ref(storage, `profile-photos/${user.uid}`);
          await uploadBytes(photoRef, photoFile);
          photoURL = await getDownloadURL(photoRef);
          lastUploadedFileRef.current = photoFile;
        } catch (uploadError) {
          console.error('Errore upload foto:', uploadError);
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
          if (provinciaMatch) { provincia = provinciaMatch[1]; }
        }
        return {
          indirizzo: studio.indirizzo.trim(),
          città: città || '',
          provincia: provincia || '',
          remoto: studio.remoto || false,
          coordinate: {
            lat: studio.coordinate?.lat || 0,
            lng: studio.coordinate?.lng || 0
          }
        };
      }) : [];

      const mainLocation = studiData.length > 0 ? {
        indirizzo: studiData[0].indirizzo || '',
        città: studiData[0].città || '',
        provincia: studiData[0].provincia || '',
        lat: studiData[0].coordinate?.lat || 0,
        lng: studiData[0].coordinate?.lng || 0
      } : {
        indirizzo: indirizzo.trim() || '',
        città: '',
        provincia: '',
        lat: coordinate?.lat || 0,
        lng: coordinate?.lng || 0
      };

      const specializzazioniAggiornate = professioniApprovate.length > 0
        ? professioniApprovate.map(p => p.professione)
        : [];

      const tutteTematicheProfessioni = new Set<string>();
      professioniApprovate.forEach(prof => { if (prof.tematiche) prof.tematiche.forEach(t => tutteTematicheProfessioni.add(t)); });
      professioniPending.forEach(prof => { if (prof.tematiche) prof.tematiche.forEach(t => tutteTematicheProfessioni.add(t)); });
      const tematicheFinali = [...new Set([...tematiche, ...Array.from(tutteTematicheProfessioni)])];

      const updateData: any = {
        'profile.nome': nome.trim() || '',
        'profile.dataNascita': dataNascita || '',
        'profile.specializzazioni': specializzazioniAggiornate,
        'profile.tematiche': tematicheFinali,
        'profile.bio': bio.trim() || '',
        'profile.linkedin': linkedin.trim() || '',
        'profile.website': website.trim() || '',
        'profile.telefono': telefono.trim() || '',
        'profile.location.indirizzo': mainLocation.indirizzo,
        'profile.location.città': mainLocation.città,
        'profile.location.provincia': mainLocation.provincia,
        'profile.location.lat': mainLocation.lat,
        'profile.location.lng': mainLocation.lng,
        'profile.studi': studiData,
        'profile.esperienze': esperienze,
        'profile.formazione': formazione,
        'profile.certificazioni': certificazioni,
        updatedAt: new Date()
      };

      if (professioniApprovate && professioniApprovate.length > 0) {
        updateData['profile.professioniConDocumenti'] = professioniApprovate;
      } else {
        updateData['profile.professioniConDocumenti'] = deleteField();
      }

      if (professioniPending && professioniPending.length > 0) {
        updateData['profile.professioniPending'] = professioniPending;
      } else {
        updateData['profile.professioniPending'] = deleteField();
      }

      if (photoURL) {
        updateData['profile.photoURL'] = photoURL;
      }

      await updateDoc(userRef, removeUndefined(updateData));
      await refreshProfile();
    } finally {
      isSavingRef.current = false;
    }
  };

  const triggerSave = async () => {
    setAutoSaveStatus('saving');
    try {
      await performSave();
      setAutoSaveStatus('saved');
      setTimeout(() => setAutoSaveStatus(s => s === 'saved' ? 'idle' : s), 3000);
    } catch {
      setAutoSaveStatus('error');
    }
  };

  const handleNavigateDashboard = async () => {
    if (nome.trim() && dataNascita && !isSavingRef.current) {
      setAutoSaveStatus('saving');
      try {
        await performSave();
      } catch {
        // Naviga comunque
      }
    }
    navigate('/dashboard');
  };

  const handleDeleteAccount = async () => {
    if (!user) return;

    const firstConfirm = await showConfirm({
      title: 'Elimina account',
      message: 'Sei sicuro di voler eliminare definitivamente il tuo account? Questa azione non può essere annullata.',
      variant: 'danger',
      confirmText: 'Elimina account'
    });
    if (!firstConfirm) return;

    const secondConfirm = await showConfirm({
      title: 'Conferma eliminazione',
      message: 'Questa è l\'ultima conferma. Il tuo account e tutti i dati verranno eliminati permanentemente.',
      variant: 'danger',
      confirmText: 'Conferma eliminazione'
    });
    if (!secondConfirm) {
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
        showToast('Per motivi di sicurezza devi effettuare nuovamente l\'accesso prima di eliminare l\'account. Esci, rientra e riprova.', 'error');
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
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-0 pb-24 sm:pt-4 sm:pb-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Modifica Profilo</h1>
          <p className="text-gray-600 mt-2">Aggiorna le tue informazioni professionali</p>
        </div>

        <form className="space-y-6">
          {/* Informazioni base */}
          <CollapsibleSection id="sezione-info-base" title="Informazioni Base" defaultOpen={true} subtitle={nome || 'Nome, data di nascita, foto...'} forceOpen={['sezione-foto','sezione-bio','sezione-nascita'].includes(targetHash)}>
            <div className="space-y-4">
              <div id="sezione-foto">
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
                          reader.onloadend = () => { setPhotoPreview(reader.result as string); };
                          reader.readAsDataURL(file);
                          setTimeout(() => triggerSave(), 0);
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
                  onBlur={triggerSave}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div id="sezione-bio">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bio
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  onBlur={triggerSave}
                  rows={4}
                  placeholder="Raccontaci di te, della tua esperienza e del tuo approccio professionale..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              <div id="sezione-nascita">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data di Nascita *
                </label>
                <input
                  type="date"
                  value={dataNascita}
                  onChange={(e) => setDataNascita(e.target.value)}
                  onBlur={triggerSave}
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
                  onBlur={triggerSave}
                  placeholder="+39 123 456 7890"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </CollapsibleSection>

          {/* Localizzazione - Studi */}
          <CollapsibleSection title="Studi e Sedi di Lavoro" subtitle={`${studi.length} studio/i configurato/i`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div className="flex-1">
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
          </CollapsibleSection>

          {/* Gestione Professioni */}
          <CollapsibleSection title="Professioni" subtitle={`${professioniApprovate.length} approvata/e, ${professioniPending.length} in attesa`}>
            <p className="text-gray-600 mb-4">
              Aggiungi nuove professioni al tuo profilo. Ogni professione richiede documentazione che sarà verificata dall'amministratore.
            </p>

            {/* Professioni Approvate */}
            {professioniApprovate.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-green-700 mb-3">✓ Professioni Approvate</h3>
                <div className="space-y-2">
                  {professioniApprovate.map((prof, index) => (
                    <div key={index} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-green-900 text-sm sm:text-base">{prof.professione}</p>
                        {prof.tematiche && prof.tematiche.length > 0 && (
                          <p className="text-xs sm:text-sm text-green-700 truncate">Tematiche: {prof.tematiche.join(', ')}</p>
                        )}
                        {prof.anniEsperienza && (
                          <p className="text-xs sm:text-sm text-green-700">Esperienza: {prof.anniEsperienza} anni</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="px-2 py-0.5 bg-green-200 text-green-800 rounded-full text-xs font-medium">
                          Approvata
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveProfessioneApprovata(index)}
                          className="px-2 py-0.5 text-xs font-medium text-red-700 bg-red-100 rounded-full hover:bg-red-200 transition-colors"
                          title="Rimuovi professione"
                        >
                          Rimuovi
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Professioni in Attesa */}
            {professioniPending.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-yellow-700 mb-3">⏳ In Attesa di Approvazione</h3>
                <div className="space-y-2">
                  {professioniPending.map((prof, index) => (
                    <div key={index} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-yellow-900 text-sm sm:text-base">{prof.professione}</p>
                        {prof.tematiche && prof.tematiche.length > 0 && (
                          <p className="text-xs sm:text-sm text-yellow-700 truncate">Tematiche: {prof.tematiche.join(', ')}</p>
                        )}
                        {prof.anniEsperienza && (
                          <p className="text-xs sm:text-sm text-yellow-700">Esperienza: {prof.anniEsperienza} anni</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="px-2 py-0.5 bg-yellow-200 text-yellow-800 rounded-full text-xs font-medium">
                          In Attesa
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveProfessionePending(index)}
                          className="px-2 py-0.5 text-xs font-medium text-red-700 bg-red-100 rounded-full hover:bg-red-200 transition-colors"
                          title="Annulla richiesta"
                        >
                          Annulla
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Aggiungi Nuova Professione */}
            {!showDocumentiForm ? (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">Aggiungi una Nuova Professione</h3>
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <label className="block text-sm font-medium mb-2">Seleziona Professione</label>
                    <select
                      value={selectedProfessione}
                      onChange={(e) => setSelectedProfessione(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="">Seleziona...</option>
                      {SPECIALIZZAZIONI
                        .filter(spec => 
                          !professioniApprovate.some(p => p.professione === spec) &&
                          !professioniPending.some(p => p.professione === spec)
                        )
                        .map((spec) => (
                          <option key={spec} value={spec}>{spec}</option>
                        ))
                      }
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddProfessione}
                    disabled={!selectedProfessione}
                    className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    Aggiungi
                  </button>
                </div>
                <p className="text-sm text-gray-500 mt-3">
                  Quando aggiungi una professione, dovrai fornire la documentazione necessaria. La professione sarà visibile nel tuo profilo solo dopo l'approvazione dell'amministratore.
                </p>
              </div>
            ) : (
              <DocumentiProfessioneForm
                professione={selectedProfessione}
                onComplete={handleDocumentiComplete}
                onCancel={handleCancelDocumenti}
              />
            )}
          </CollapsibleSection>

          {/* Tematiche per Professione */}
          <CollapsibleSection id="sezione-tematiche" title="Tematiche di Interesse" subtitle={`${[...professioniApprovate, ...professioniPending].reduce((acc, p) => acc + (p.tematiche?.length || 0), 0)} tematiche selezionate`} forceOpen={targetHash === 'sezione-tematiche'}>
            <p className="text-gray-600 mb-6">
              Seleziona le tematiche specifiche per ogni tua professione.
            </p>
            
            {/* Tutte le professioni (approvate e pending insieme) */}
            {[...professioniApprovate, ...professioniPending].length > 0 ? (
              <div className="space-y-4">
                {/* Professioni approvate */}
                {professioniApprovate.map((prof, profIndex) => {
                  const config = getConfigurazioneProfessione(prof.professione);
                  if (!config || !config.tematiche || config.tematiche.length === 0) return null;
                  
                  return (
                    <div key={`approvata-${profIndex}`} className="border-2 border-green-200 rounded-lg p-4 bg-green-50">
                      <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <span className="text-green-600">✓</span>
                        {prof.professione}
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {config.tematiche.map((tema) => {
                          const isChecked = prof.tematiche?.includes(tema) || false;
                          return (
                            <label
                              key={tema}
                              className={`flex items-center gap-2 p-2 border rounded-lg cursor-pointer transition ${
                                isChecked
                                  ? 'border-green-500 bg-white'
                                  : 'border-gray-200 hover:border-gray-300 bg-white'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  const newProfessioni = [...professioniApprovate];
                                  const currentTematiche = newProfessioni[profIndex].tematiche || [];
                                  
                                  if (e.target.checked) {
                                    newProfessioni[profIndex].tematiche = [...currentTematiche, tema];
                                  } else {
                                    newProfessioni[profIndex].tematiche = currentTematiche.filter(t => t !== tema);
                                  }
                                  
                                  setProfessioniApprovate(newProfessioni);
                                }}
                                className="w-4 h-4 text-green-600"
                              />
                              <span className="text-sm">{tema}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                
                {/* Professioni pending */}
                {professioniPending.map((prof, profIndex) => {
                  const config = getConfigurazioneProfessione(prof.professione);
                  if (!config || !config.tematiche || config.tematiche.length === 0) return null;
                  
                  return (
                    <div key={`pending-${profIndex}`} className="border-2 border-yellow-200 rounded-lg p-4 bg-yellow-50">
                      <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <span className="text-yellow-600">⏳</span>
                        {prof.professione}
                        <span className="text-xs text-yellow-700">(in attesa di approvazione)</span>
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {config.tematiche.map((tema) => {
                          const isChecked = prof.tematiche?.includes(tema) || false;
                          return (
                            <label
                              key={tema}
                              className={`flex items-center gap-2 p-2 border rounded-lg cursor-pointer transition ${
                                isChecked
                                  ? 'border-yellow-500 bg-white'
                                  : 'border-gray-200 hover:border-gray-300 bg-white'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  const newProfessioni = [...professioniPending];
                                  const currentTematiche = newProfessioni[profIndex].tematiche || [];
                                  
                                  if (e.target.checked) {
                                    newProfessioni[profIndex].tematiche = [...currentTematiche, tema];
                                  } else {
                                    newProfessioni[profIndex].tematiche = currentTematiche.filter(t => t !== tema);
                                  }
                                  
                                  setProfessioniPending(newProfessioni);
                                }}
                                className="w-4 h-4 text-yellow-600"
                              />
                              <span className="text-sm">{tema}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>Aggiungi prima una professione per selezionare le tematiche di interesse.</p>
              </div>
            )}
          </CollapsibleSection>

          {/* Curriculum: Esperienze, Formazione, Certificazioni */}
          <CollapsibleSection id="sezione-curriculum" title="Curriculum" subtitle={`${esperienze.length} esperienze, ${formazione.length} formazione, ${certificazioni.length} certificazioni`} forceOpen={targetHash === 'sezione-curriculum'}>
          <CurriculumEditor
            esperienze={esperienze}
            formazione={formazione}
            certificazioni={certificazioni}
            onChange={async (data) => {
              console.log('💾 CurriculumEditor onChange:', { esperienze: data.esperienze.length, formazione: data.formazione.length, certificazioni: data.certificazioni.length });
              setEsperienze(data.esperienze);
              setFormazione(data.formazione);
              setCertificazioni(data.certificazioni);
              // Salvataggio diretto per evitare stale closure
              if (user) {
                try {
                  setAutoSaveStatus('saving');
                  const userRef = doc(db, 'users', user.uid);
                  await updateDoc(userRef, {
                    'profile.esperienze': removeUndefined(data.esperienze),
                    'profile.formazione': removeUndefined(data.formazione),
                    'profile.certificazioni': removeUndefined(data.certificazioni),
                    updatedAt: new Date()
                  });
                  await refreshProfile();
                  setAutoSaveStatus('saved');
                  setTimeout(() => setAutoSaveStatus(s => s === 'saved' ? 'idle' : s), 3000);
                } catch (err) {
                  console.error('Errore salvataggio curriculum:', err);
                  setAutoSaveStatus('error');
                }
              }
            }}
          />
          </CollapsibleSection>

          {/* Link social */}
          <CollapsibleSection title="Link Professionali" subtitle={[linkedin && 'LinkedIn', website && 'Sito Web'].filter(Boolean).join(', ') || 'Nessun link'}>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  LinkedIn
                </label>
                <input
                  type="url"
                  value={linkedin}
                  onChange={(e) => setLinkedin(e.target.value)}
                  onBlur={triggerSave}
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
                  onBlur={triggerSave}
                  placeholder="https://tuosito.com"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </CollapsibleSection>

          {/* Notifiche Push */}
          <CollapsibleSection title="Notifiche Push" subtitle={notificationEnabled ? 'Abilitate' : 'Disabilitate'}>
            <p className="text-gray-600 mb-6">
              Ricevi notifiche istantanee per messaggi, inviti e richieste da equipe
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
          </CollapsibleSection>

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

          {/* Stato auto-save e navigazione */}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2 text-sm">
              {autoSaveStatus === 'saving' && (
                <span className="text-gray-500 flex items-center gap-1.5">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Salvataggio in corso...
                </span>
              )}
              {autoSaveStatus === 'saved' && (
                <span className="text-green-600 flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Salvato
                </span>
              )}
              {autoSaveStatus === 'error' && (
                <span className="text-red-500 flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Errore durante il salvataggio
                </span>
              )}
              {autoSaveStatus === 'idle' && (
                <span className="text-gray-400 text-xs">Le modifiche vengono salvate automaticamente</span>
              )}
            </div>

            <button
              type="button"
              onClick={handleNavigateDashboard}
              disabled={autoSaveStatus === 'saving'}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              Torna alla Dashboard
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
