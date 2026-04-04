import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, collection, addDoc, Timestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useModal } from '@/contexts/ModalContext';
import Header from '@/components/Header';
import {
  MarketplaceListing,
  MarketplaceOffer,
  DayAvailability,
  DayOfWeek,
  DAYS_OF_WEEK,
  RequestedSlot,
  PRICE_TYPE_LABELS,
} from '@/types/equippe';

const ADMIN_EMAILS = ['admin@tuaequipe.it', 'jschenetti@gmail.com', 'udemyteam2025@gmail.com', 'martinamaccara@icloud.com', 'martinamaccarana@icloud.com'];

export default function MarketplaceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useModal();
  const isAdmin = !!user?.email && ADMIN_EMAILS.includes(user.email);

  const [listing, setListing] = useState<MarketplaceListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [existingOffers, setExistingOffers] = useState<MarketplaceOffer[]>([]);

  // Offer form state
  const [selectedSlots, setSelectedSlots] = useState<RequestedSlot[]>([]);
  const [offerAmount, setOfferAmount] = useState('');
  const [offerMessage, setOfferMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [currentPhotoIdx, setCurrentPhotoIdx] = useState(0);

  useEffect(() => {
    if (id) {
      loadListing();
      loadMyOffers();
    }
  }, [id]);

  const loadListing = async () => {
    try {
      const snap = await getDoc(doc(db, 'marketplace_listings', id!));
      if (snap.exists()) {
        setListing({ id: snap.id, ...snap.data() } as MarketplaceListing);
      }
    } catch (error) {
      console.error('Errore:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMyOffers = async () => {
    if (!user) return;
    try {
      const q = query(
        collection(db, 'marketplace_offers'),
        where('listingId', '==', id),
        where('offererId', '==', user.uid)
      );
      const snap = await getDocs(q);
      setExistingOffers(snap.docs.map(d => ({ id: d.id, ...d.data() } as MarketplaceOffer)));
    } catch (error) {
      console.error('Errore caricamento offerte:', error);
    }
  };

  const toggleSlot = (avail: DayAvailability) => {
    setSelectedSlots(prev => {
      const exists = prev.find(s => s.day === avail.day);
      if (exists) return prev.filter(s => s.day !== avail.day);
      return [...prev, { day: avail.day, startTime: avail.startTime, endTime: avail.endTime }];
    });
  };

  const updateSlotTime = (day: DayOfWeek, field: 'startTime' | 'endTime', value: string) => {
    setSelectedSlots(prev =>
      prev.map(s => (s.day === day ? { ...s, [field]: value } : s))
    );
  };

  const handleSubmitOffer = async () => {
    if (!user || !listing) return;
    if (selectedSlots.length === 0) {
      showToast('Seleziona almeno una fascia oraria', 'error');
      return;
    }
    if (!offerAmount || Number(offerAmount) <= 0) {
      showToast('Inserisci un importo valido', 'error');
      return;
    }

    // Validate slots are within listing availability
    for (const slot of selectedSlots) {
      const available = listing.availability.find(a => a.day === slot.day);
      if (!available || slot.startTime < available.startTime || slot.endTime > available.endTime) {
        const dayLabel = DAYS_OF_WEEK.find(d => d.value === slot.day)?.label;
        showToast(`Fascia oraria per ${dayLabel} fuori dalla disponibilità`, 'error');
        return;
      }
    }

    setSubmitting(true);
    try {
      const offerRef = await addDoc(collection(db, 'marketplace_offers'), {
        listingId: listing.id,
        listingTitle: listing.title,
        authorId: listing.authorId,
        authorName: listing.authorName,
        offererId: user.uid,
        offererName: userProfile?.profile?.nome || user.email || 'Utente',
        offererPhotoURL: userProfile?.profile?.photoURL || '',
        requestedSlots: selectedSlots,
        message: offerMessage.trim(),
        offerAmount: Number(offerAmount),
        status: 'pending',
        createdAt: Timestamp.now(),
      });

      showToast('Offerta inviata!', 'success');
      setShowOfferForm(false);
      setSelectedSlots([]);
      setOfferAmount('');
      setOfferMessage('');
      loadMyOffers();
    } catch (error) {
      console.error('Errore invio offerta:', error);
      showToast('Errore nell\'invio dell\'offerta', 'error');
    } finally {
      setSubmitting(false);
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

  if (loading) {
    return (
      <>
        <Header />
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-gray-500">Caricamento...</p>
        </div>
      </>
    );
  }

  if (!listing) {
    return (
      <>
        <Header />
        <div className="min-h-screen flex items-center justify-center flex-col gap-4">
          <p className="text-gray-500">Annuncio non trovato</p>
          <Link to="/marketplace" className="text-blue-600 hover:underline">Torna al marketplace</Link>
        </div>
      </>
    );
  }

  // Backward compat
  const displayPrices = listing.prices?.length
    ? listing.prices
    : listing.price ? [{ amount: listing.price, type: listing.priceType || 'orario' as const }] : [];

  const propertyLabel: Record<string, string> = {
    studio: 'Studio',
    ufficio: 'Ufficio',
    stanza: 'Stanza',
  };

  const isOwner = user?.uid === listing.authorId;

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 pt-0 pb-24 sm:pt-3 sm:pb-6">
          {/* Breadcrumb */}
          <div className="mb-4">
            <Link to="/marketplace" className="text-blue-600 hover:underline text-sm">
              ← Torna al marketplace
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main content */}
            <div className="lg:col-span-2 space-y-5">
              {/* Photos */}
              {listing.photos.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                  <div className="relative h-64 sm:h-80">
                    <img
                      src={listing.photos[currentPhotoIdx]}
                      alt={listing.title}
                      className="w-full h-full object-cover"
                    />
                    {listing.photos.length > 1 && (
                      <>
                        <button
                          onClick={() => setCurrentPhotoIdx(i => (i > 0 ? i - 1 : listing.photos.length - 1))}
                          className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 rounded-full flex items-center justify-center hover:bg-white transition"
                        >
                          ‹
                        </button>
                        <button
                          onClick={() => setCurrentPhotoIdx(i => (i < listing.photos.length - 1 ? i + 1 : 0))}
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 rounded-full flex items-center justify-center hover:bg-white transition"
                        >
                          ›
                        </button>
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                          {currentPhotoIdx + 1}/{listing.photos.length}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Title & Info */}
              <div className="bg-white rounded-xl shadow-sm border p-5">
                <h1 className="text-xl font-bold text-gray-900 mb-1">{listing.title}</h1>
                <p className="text-gray-500 text-sm mb-4">
                  {listing.address && `${listing.address}, `}{listing.cap} {listing.city}{listing.provincia ? ` (${listing.provincia})` : ''}
                </p>

                <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                  <span className="flex items-center gap-1">🏠 {propertyLabel[listing.propertyType]}</span>
                  {listing.rooms > 0 && <span>{listing.rooms} {listing.rooms === 1 ? 'locale' : 'locali'}</span>}
                  {listing.bathrooms > 0 && <span>{listing.bathrooms} {listing.bathrooms === 1 ? 'bagno' : 'bagni'}</span>}
                  {listing.area > 0 && <span>{listing.area} m²</span>}
                </div>

                {listing.description && (
                  <>
                    <h3 className="font-semibold text-gray-900 mb-2">Descrizione</h3>
                    <p className="text-gray-700 text-sm whitespace-pre-line">{listing.description}</p>
                  </>
                )}
              </div>

              {/* Features */}
              {listing.features.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border p-5">
                  <h3 className="font-semibold text-gray-900 mb-3">Caratteristiche</h3>
                  <div className="flex flex-wrap gap-2">
                    {listing.features.map(f => (
                      <span key={f} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm">
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Availability */}
              <div className="bg-white rounded-xl shadow-sm border p-5">
                <h3 className="font-semibold text-gray-900 mb-3">Disponibilità</h3>
                <div className="space-y-2">
                  {listing.availability.map((slot, i) => {
                    const dayLabel = DAYS_OF_WEEK.find(d => d.value === slot.day)?.label;
                    return (
                      <div key={i} className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5">
                        <span className="font-medium text-green-800 text-sm w-24">{dayLabel}</span>
                        <span className="text-green-700 text-sm">{slot.startTime} – {slot.endTime}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-5">
              {/* Price card */}
              <div className="bg-white rounded-xl shadow-sm border p-5 sticky top-4">
                <div className="space-y-1 mb-1">
                  {displayPrices.map((p, i) => (
                    <div key={i} className={i === 0 ? 'text-2xl font-bold text-blue-600' : 'text-sm text-gray-600'}>
                      {p.amount}€<span className={i === 0 ? 'text-base font-normal text-gray-500' : ''}> / {PRICE_TYPE_LABELS[p.type]}</span>
                    </div>
                  ))}
                </div>

                {/* Author */}
                <div className="flex items-center gap-3 mt-4 pb-4 border-b">
                  {listing.authorPhotoURL ? (
                    <img src={listing.authorPhotoURL} alt="" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-sm">
                      {listing.authorName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{listing.authorName}</p>
                    <p className="text-xs text-gray-500">Proprietario</p>
                  </div>
                </div>

                {/* Actions */}
                {!isOwner ? (
                  <div className="mt-4">
                    {existingOffers.length > 0 && (
                      <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-sm text-yellow-800 font-medium">
                          Hai già inviato {existingOffers.length} {existingOffers.length === 1 ? 'offerta' : 'offerte'}
                        </p>
                        {existingOffers.map(o => (
                          <p key={o.id} className="text-xs text-yellow-700 mt-1">
                            {o.offerAmount}€ — {o.status === 'pending' ? '⏳ In attesa' : o.status === 'accepted' ? '✅ Accettata' : o.status === 'rejected' ? '❌ Rifiutata' : '🔙 Ritirata'}
                          </p>
                        ))}
                      </div>
                    )}

                    {!showOfferForm ? (
                      <button
                        onClick={() => setShowOfferForm(true)}
                        className="w-full px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
                      >
                        Fai un'offerta
                      </button>
                    ) : (
                      <div className="space-y-3">
                        <h4 className="font-semibold text-gray-900 text-sm">La tua offerta</h4>

                        {/* Slot selection */}
                        <div>
                          <p className="text-xs text-gray-500 mb-2">Seleziona le fasce orarie che ti interessano:</p>
                          <div className="space-y-2">
                            {listing.availability.map((avail, i) => {
                              const dayLabel = DAYS_OF_WEEK.find(d => d.value === avail.day)?.label;
                              const isSelected = selectedSlots.some(s => s.day === avail.day);
                              const selectedSlot = selectedSlots.find(s => s.day === avail.day);

                              return (
                                <div key={i} className="space-y-1">
                                  <button
                                    type="button"
                                    onClick={() => toggleSlot(avail)}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm border transition ${
                                      isSelected
                                        ? 'bg-blue-50 border-blue-300 text-blue-800'
                                        : 'bg-gray-50 border-gray-200 text-gray-700 hover:border-gray-300'
                                    }`}
                                  >
                                    <span className="font-medium">{dayLabel}</span>
                                    <span className="text-gray-500 ml-2 text-xs">
                                      ({avail.startTime}–{avail.endTime})
                                    </span>
                                  </button>

                                  {/* Custom time within selected slot */}
                                  {isSelected && selectedSlot && (
                                    <div className="flex items-center gap-2 ml-3">
                                      <span className="text-xs text-gray-500">Dalle</span>
                                      <input
                                        type="time"
                                        value={selectedSlot.startTime}
                                        min={avail.startTime}
                                        max={avail.endTime}
                                        onChange={e => updateSlotTime(avail.day, 'startTime', e.target.value)}
                                        className="px-2 py-1 border rounded text-xs"
                                      />
                                      <span className="text-xs text-gray-500">alle</span>
                                      <input
                                        type="time"
                                        value={selectedSlot.endTime}
                                        min={avail.startTime}
                                        max={avail.endTime}
                                        onChange={e => updateSlotTime(avail.day, 'endTime', e.target.value)}
                                        className="px-2 py-1 border rounded text-xs"
                                      />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Amount */}
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">La tua offerta (€)</label>
                          <input
                            type="number"
                            value={offerAmount}
                            onChange={e => setOfferAmount(e.target.value)}
                            placeholder={displayPrices.length ? `Da ${displayPrices[0].amount}€/${PRICE_TYPE_LABELS[displayPrices[0].type]}` : 'Inserisci importo'}
                            min="1"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                        </div>

                        {/* Message */}
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Messaggio (opzionale)</label>
                          <textarea
                            value={offerMessage}
                            onChange={e => setOfferMessage(e.target.value)}
                            placeholder="Presentati e descrivi le tue esigenze..."
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => { setShowOfferForm(false); setSelectedSlots([]); }}
                            className="flex-1 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition"
                          >
                            Annulla
                          </button>
                          <button
                            onClick={handleSubmitOffer}
                            disabled={submitting}
                            className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 transition"
                          >
                            {submitting ? 'Invio...' : 'Invia offerta'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-4 space-y-2">
                    <Link
                      to={`/marketplace/${listing.id}/edit`}
                      className="w-full block text-center px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
                    >
                      Modifica annuncio
                    </Link>
                    <Link
                      to="/marketplace/my"
                      className="w-full block text-center px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm font-medium"
                    >
                      Gestisci annunci
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
