import { useState, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useModal } from '@/contexts/ModalContext';
import Header from '@/components/Header';
import LocationAutocomplete from '@/components/LocationAutocomplete';
import {
  DayAvailability,
  DayOfWeek,
  DAYS_OF_WEEK,
  MarketplacePriceType,
  MarketplacePropertyType,
  PriceOption,
  PRICE_TYPE_LABELS,
} from '@/types/equippe';

const MapSelector = lazy(() => import('@/components/MapSelectorClient'));

const FEATURES_OPTIONS = [
  'Ascensore', 'Wi-Fi', 'Aria condizionata', 'Riscaldamento',
  'Sala d\'attesa', 'Parcheggio', 'Accessibile disabili', 'Arredato',
  'Insonorizzazione', 'Bagno privato', 'Cucina/Angolo cottura',
];

const DOTAZIONI_OPTIONS = [
  'Lettino/poltrona inclusi', 'Lettino/poltrona da portare',
  'Connessione internet', 'Climatizzazione',
];

const ADMIN_EMAILS = ['admin@tuaequipe.it', 'jschenetti@gmail.com', 'udemyteam2025@gmail.com', 'martinamaccara@icloud.com', 'martinamaccarana@icloud.com'];

export default function MarketplaceCreatePage() {
  const { user, userProfile, isAdminViewActive: isAdmin } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useModal();

  const [loading, setLoading] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);

  const [prices, setPrices] = useState<PriceOption[]>([]);
  const [newPrice, setNewPrice] = useState({ amount: '', type: 'orario' as MarketplacePriceType });

  const [form, setForm] = useState({
    title: '',
    description: '',
    address: '',
    city: '',
    cap: '',
    provincia: '',
    propertyType: 'studio' as MarketplacePropertyType,
    rooms: '1',
    bathrooms: '1',
    area: '',
    features: [] as string[],
  });

  const [availability, setAvailability] = useState<DayAvailability[]>([]);
  const [coordinate, setCoordinate] = useState<{ lat: number; lng: number } | null>(null);
  const [newSlot, setNewSlot] = useState<DayAvailability>({
    day: 'lunedi',
    startTime: '08:00',
    endTime: '20:00',
  });

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const toggleFeature = (f: string) => {
    setForm(prev => ({
      ...prev,
      features: prev.features.includes(f)
        ? prev.features.filter(x => x !== f)
        : [...prev.features, f],
    }));
  };

  const addAvailability = () => {
    if (newSlot.startTime >= newSlot.endTime) {
      showToast('L\'orario di fine deve essere dopo quello di inizio', 'error');
      return;
    }
    // Check for duplicate day
    const existing = availability.find(a => a.day === newSlot.day);
    if (existing) {
      showToast('Questo giorno è già presente. Rimuovilo prima di aggiungerne uno nuovo.', 'error');
      return;
    }
    setAvailability(prev => [...prev, { ...newSlot }]);
  };

  const removeAvailability = (index: number) => {
    setAvailability(prev => prev.filter((_, i) => i !== index));
  };

  const handlePhotoAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const valid = files.filter(f => f.type.startsWith('image/') && f.size <= 5 * 1024 * 1024);
    if (valid.length < files.length) {
      showToast('Alcune immagini sono state escluse (max 5MB, solo immagini)', 'warning');
    }
    setPhotos(prev => [...prev, ...valid].slice(0, 5));
    const newPreviews = valid.map(f => URL.createObjectURL(f));
    setPhotoPreviews(prev => [...prev, ...newPreviews].slice(0, 5));
    e.target.value = '';
  };

  const removePhoto = (index: number) => {
    URL.revokeObjectURL(photoPreviews[index]);
    setPhotos(prev => prev.filter((_, i) => i !== index));
    setPhotoPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Validazione
    if (!form.title.trim()) { showToast('Inserisci un titolo', 'error'); return; }
    if (!form.city.trim()) { showToast('Inserisci la città', 'error'); return; }
    if (prices.length === 0) { showToast('Aggiungi almeno un prezzo', 'error'); return; }
    if (availability.length === 0) { showToast('Aggiungi almeno una fascia oraria di disponibilità', 'error'); return; }

    setLoading(true);
    try {
      // Upload photos
      const photoURLs: string[] = [];
      for (const photo of photos) {
        const storageRef = ref(storage, `marketplace/${user.uid}/${Date.now()}_${photo.name}`);
        await uploadBytes(storageRef, photo);
        const url = await getDownloadURL(storageRef);
        photoURLs.push(url);
      }

      // Geocode address
      let coord = coordinate;
      if (!coord) {
        const fullAddress = [form.address, form.city, form.cap, form.provincia].filter(Boolean).join(', ');
        const token = import.meta.env.VITE_MAPBOX_TOKEN;
        if (token && fullAddress) {
          try {
            const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(fullAddress)}.json?country=it&limit=1&language=it&access_token=${token}`);
            const data = await res.json();
            if (data.features?.length) {
              const [lng, lat] = data.features[0].center;
              coord = { lat, lng };
            }
          } catch { /* ignore geocoding error */ }
        }
      }

      await addDoc(collection(db, 'marketplace_listings'), {
        authorId: user.uid,
        authorName: userProfile?.profile?.nome || user.email || 'Utente',
        authorPhotoURL: userProfile?.profile?.photoURL || '',
        title: form.title.trim(),
        description: form.description.trim(),
        prices,
        address: form.address.trim(),
        city: form.city.trim(),
        cap: form.cap.trim(),
        provincia: form.provincia.trim(),
        ...(coord && { coordinate: coord }),
        features: form.features,
        photos: photoURLs,
        rooms: Number(form.rooms) || 1,
        bathrooms: Number(form.bathrooms) || 1,
        area: Number(form.area) || 0,
        propertyType: form.propertyType,
        availability,
        status: 'active',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      showToast('Annuncio pubblicato!', 'success');
      navigate('/marketplace');
    } catch (error) {
      console.error('Errore pubblicazione:', error);
      showToast('Errore nella pubblicazione dell\'annuncio', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <>
        <Header />
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-gray-500">Sezione non ancora disponibile.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 pt-0 pb-24 sm:pt-3 sm:pb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Pubblica annuncio</h1>
          <p className="text-gray-500 text-sm mb-6">Inserisci i dettagli dello studio che vuoi affittare</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Info principali */}
            <Section title="Informazioni principali">
              <div className="space-y-4">
                <Field label="Titolo annuncio *">
                  <input
                    type="text"
                    value={form.title}
                    onChange={e => handleChange('title', e.target.value)}
                    placeholder="es. Studio professionale in zona Prati"
                    className="input-field"
                  />
                </Field>

                <Field label="Descrizione">
                  <textarea
                    value={form.description}
                    onChange={e => handleChange('description', e.target.value)}
                    placeholder="Descrivi lo studio, le caratteristiche, la zona..."
                    rows={4}
                    className="input-field"
                  />
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Tipo immobile">
                    <select
                      value={form.propertyType}
                      onChange={e => handleChange('propertyType', e.target.value)}
                      className="input-field"
                    >
                      <option value="studio">Studio</option>
                      <option value="locale_intero">Locale intero</option>
                    </select>
                  </Field>
                  <Field label="Area (m²)">
                    <input
                      type="number"
                      value={form.area}
                      onChange={e => handleChange('area', e.target.value)}
                      placeholder="es. 20"
                      className="input-field"
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Locali">
                    <input
                      type="number"
                      value={form.rooms}
                      onChange={e => handleChange('rooms', e.target.value)}
                      min="1"
                      className="input-field"
                    />
                  </Field>
                  <Field label="Bagni">
                    <input
                      type="number"
                      value={form.bathrooms}
                      onChange={e => handleChange('bathrooms', e.target.value)}
                      min="0"
                      className="input-field"
                    />
                  </Field>
                </div>
              </div>
            </Section>

            {/* Prezzi */}
            <Section title="Prezzi *">
              <p className="text-sm text-gray-500 mb-3">Aggiungi uno o più prezzi per diverse modalità di affitto.</p>
              {prices.length > 0 && (
                <div className="space-y-2 mb-4">
                  {prices.map((p, i) => (
                    <div key={i} className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
                      <span className="text-sm font-medium text-blue-800">
                        {p.amount}€ / {PRICE_TYPE_LABELS[p.type]}
                      </span>
                      <button type="button" onClick={() => setPrices(prev => prev.filter((_, j) => j !== i))} className="text-red-500 hover:text-red-700 text-sm">Rimuovi</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap items-end gap-3 bg-gray-50 p-3 rounded-lg border">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Importo (€)</label>
                  <input type="number" value={newPrice.amount} onChange={e => setNewPrice(prev => ({ ...prev, amount: e.target.value }))} placeholder="es. 15" min="1" className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-28" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Per</label>
                  <select value={newPrice.type} onChange={e => setNewPrice(prev => ({ ...prev, type: e.target.value as MarketplacePriceType }))} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    <option value="orario">Ora</option>
                    <option value="mezza_giornata">Mezza giornata a settimana</option>
                    <option value="giornaliero">Giorno a settimana</option>
                    <option value="mensile">Mese</option>
                  </select>
                </div>
                <button type="button" onClick={() => {
                  if (!newPrice.amount || Number(newPrice.amount) <= 0) { showToast('Inserisci un importo valido', 'error'); return; }
                  if (prices.some(p => p.type === newPrice.type)) { showToast('Questo tipo di prezzo è già presente', 'error'); return; }
                  setPrices(prev => [...prev, { amount: Number(newPrice.amount), type: newPrice.type }]);
                  setNewPrice({ amount: '', type: 'orario' });
                }} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition">Aggiungi</button>
              </div>
            </Section>

            {/* Ubicazione */}
            <Section title="Ubicazione">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cerca indirizzo *</label>
                  <LocationAutocomplete
                    value={form.address}
                    onChange={(addr, coords) => {
                      handleChange('address', addr);
                      if (coords) setCoordinate(coords);
                    }}
                    placeholder="Cerca un indirizzo..."
                  />
                </div>
                {coordinate && (
                  <Suspense fallback={<div className="h-48 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">Caricamento mappa...</div>}>
                    <div className="h-48 rounded-lg overflow-hidden border">
                      <MapSelector coordinate={coordinate} indirizzo={form.address} readOnly />
                    </div>
                  </Suspense>
                )}
                <div className="grid grid-cols-3 gap-4">
                  <Field label="Città *">
                    <input
                      type="text"
                      value={form.city}
                      onChange={e => handleChange('city', e.target.value)}
                      placeholder="es. Roma"
                      className="input-field"
                    />
                  </Field>
                  <Field label="CAP">
                    <input
                      type="text"
                      value={form.cap}
                      onChange={e => handleChange('cap', e.target.value)}
                      placeholder="es. 00100"
                      maxLength={5}
                      className="input-field"
                    />
                  </Field>
                  <Field label="Provincia">
                    <input
                      type="text"
                      value={form.provincia}
                      onChange={e => handleChange('provincia', e.target.value)}
                      placeholder="es. RM"
                      maxLength={2}
                      className="input-field"
                    />
                  </Field>
                </div>
              </div>
            </Section>

            {/* Photos */}
            <Section title="Foto">
              <div className="flex flex-wrap gap-3">
                {photoPreviews.map((src, i) => (
                  <div key={i} className="relative w-24 h-24 rounded-lg overflow-hidden border">
                    <img src={src} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {photos.length < 5 && (
                  <label className="w-24 h-24 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-blue-400 transition">
                    <input type="file" accept="image/*" onChange={handlePhotoAdd} className="hidden" multiple />
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </label>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-2">Max 5 foto, 5MB ciascuna</p>
            </Section>

            {/* Features */}
            <Section title="Caratteristiche">
              <div className="flex flex-wrap gap-2">
                {FEATURES_OPTIONS.map(f => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => toggleFeature(f)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition ${
                      form.features.includes(f)
                        ? 'bg-blue-50 border-blue-300 text-blue-700'
                        : 'border-gray-300 text-gray-600 hover:border-gray-400'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </Section>

            <Section title="Dotazioni e attrezzature">
              <div className="flex flex-wrap gap-2">
                {DOTAZIONI_OPTIONS.map(f => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => toggleFeature(f)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition ${
                      form.features.includes(f)
                        ? 'bg-blue-50 border-blue-300 text-blue-700'
                        : 'border-gray-300 text-gray-600 hover:border-gray-400'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </Section>

            {/* Availability */}
            <Section title="Disponibilità *">
              <p className="text-sm text-gray-500 mb-3">
                Indica i giorni e le fasce orarie in cui lo studio è disponibile per l'affitto.
              </p>

              {/* Existing slots */}
              {availability.length > 0 && (
                <div className="space-y-2 mb-4">
                  {availability.map((slot, i) => {
                    const dayLabel = DAYS_OF_WEEK.find(d => d.value === slot.day)?.label;
                    return (
                      <div key={i} className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-4 py-2">
                        <span className="text-sm font-medium text-green-800">
                          {dayLabel}: {slot.startTime} – {slot.endTime}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeAvailability(i)}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          Rimuovi
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add new slot */}
              <div className="flex flex-wrap items-end gap-3 bg-gray-50 p-3 rounded-lg border">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Giorno</label>
                  <select
                    value={newSlot.day}
                    onChange={e => setNewSlot(prev => ({ ...prev, day: e.target.value as DayOfWeek }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    {DAYS_OF_WEEK.map(d => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Dalle</label>
                  <input
                    type="time"
                    value={newSlot.startTime}
                    onChange={e => setNewSlot(prev => ({ ...prev, startTime: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Alle</label>
                  <input
                    type="time"
                    value={newSlot.endTime}
                    onChange={e => setNewSlot(prev => ({ ...prev, endTime: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={addAvailability}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition"
                >
                  Aggiungi
                </button>
              </div>
            </Section>

            {/* Submit */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => navigate('/marketplace')}
                className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm font-medium"
              >
                Annulla
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition text-sm font-medium"
              >
                {loading ? 'Pubblicazione in corso...' : 'Pubblica annuncio'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border p-5">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}
