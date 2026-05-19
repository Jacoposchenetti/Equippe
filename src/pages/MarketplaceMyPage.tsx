import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, getDocs, updateDoc, doc, Timestamp, orderBy, onSnapshot, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useModal } from '@/contexts/ModalContext';
import Header from '@/components/Header';
import {
  MarketplaceListing,
  MarketplaceOffer,
  MarketplaceOfferStatus,
  DAYS_OF_WEEK,
  PRICE_TYPE_LABELS,
} from '@/types/equippe';

const ADMIN_EMAILS = ['admin@tuaequipe.it', 'jschenetti@gmail.com', 'udemyteam2025@gmail.com', 'martinamaccara@icloud.com', 'martinamaccarana@icloud.com'];

type Tab = 'listings' | 'offers-received' | 'offers-sent';

export default function MarketplaceMyPage() {
  const { user } = useAuth();
  const { showToast } = useModal();
  const isAdmin = !!user?.email && ADMIN_EMAILS.includes(user.email);

  const [tab, setTab] = useState<Tab>('listings');
  const [myListings, setMyListings] = useState<MarketplaceListing[]>([]);
  const [offersReceived, setOffersReceived] = useState<MarketplaceOffer[]>([]);
  const [offersSent, setOffersSent] = useState<MarketplaceOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [unreadOfferIds, setUnreadOfferIds] = useState<string[]>([]);
  const [responseMessage, setResponseMessage] = useState('');

  useEffect(() => {
    if (user) loadAll();
  }, [user]);

  const loadAll = async () => {
    setLoading(true);
    try {
      await Promise.all([loadMyListings(), loadOffersReceived(), loadOffersSent()]);
    } finally {
      setLoading(false);
    }
  };

  const loadMyListings = async () => {
    const q = query(
      collection(db, 'marketplace_listings'),
      where('authorId', '==', user!.uid),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    setMyListings(snap.docs.map(d => ({ id: d.id, ...d.data() } as MarketplaceListing)));
  };

  const loadOffersReceived = async () => {
    const q = query(
      collection(db, 'marketplace_offers'),
      where('authorId', '==', user!.uid),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    setOffersReceived(snap.docs.map(d => ({ id: d.id, ...d.data() } as MarketplaceOffer)));
  };

  const loadOffersSent = async () => {
    const q = query(
      collection(db, 'marketplace_offers'),
      where('offererId', '==', user!.uid),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    setOffersSent(snap.docs.map(d => ({ id: d.id, ...d.data() } as MarketplaceOffer)));
  };

  const handleRespondOffer = async (offerId: string, status: 'accepted' | 'rejected') => {
    try {
      await updateDoc(doc(db, 'marketplace_offers', offerId), {
        status,
        responseMessage: responseMessage.trim() || null,
        respondedAt: Timestamp.now(),
      });
      showToast(status === 'accepted' ? 'Offerta accettata!' : 'Offerta rifiutata', 'success');
      setRespondingTo(null);
      setResponseMessage('');
      loadOffersReceived();
    } catch (error) {
      console.error('Errore:', error);
      showToast('Errore nell\'aggiornamento', 'error');
    }
  };

  const handleToggleListingStatus = async (listing: MarketplaceListing) => {
    const newStatus = listing.status === 'active' ? 'paused' : 'active';
    try {
      await updateDoc(doc(db, 'marketplace_listings', listing.id!), {
        status: newStatus,
        updatedAt: Timestamp.now(),
      });
      showToast(newStatus === 'active' ? 'Annuncio riattivato' : 'Annuncio messo in pausa', 'success');
      loadMyListings();
    } catch (error) {
      console.error('Errore:', error);
      showToast('Errore nell\'aggiornamento', 'error');
    }
  };

  const handleWithdrawOffer = async (offerId: string) => {
    try {
      await updateDoc(doc(db, 'marketplace_offers', offerId), {
        status: 'withdrawn' as MarketplaceOfferStatus,
        respondedAt: Timestamp.now(),
      });
      showToast('Offerta ritirata', 'success');
      loadOffersSent();
    } catch (error) {
      console.error('Errore:', error);
      showToast('Errore nel ritiro', 'error');
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

  const pendingCount = offersReceived.filter(o => o.status === 'pending').length;

  // Listen for unread marketplace_offer_received notifications
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, snap => {
      const ids = snap.docs
        .filter(d => {
          const data = d.data();
          return !data.read && data.type === 'marketplace_offer_received';
        })
        .map(d => d.id);
      setUnreadOfferIds(ids);
    });
    return () => unsub();
  }, [user]);

  const markOffersRead = async () => {
    if (unreadOfferIds.length === 0) return;
    const batch = writeBatch(db);
    unreadOfferIds.forEach(id => batch.update(doc(db, 'notifications', id), { read: true }));
    try { await batch.commit(); } catch { /* ignore */ }
  };

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 pt-0 pb-24 sm:pt-3 sm:pb-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Annunci e Offerte</h1>
              <p className="text-gray-500 text-sm mt-1">Gestisci i tuoi annunci e le offerte</p>
            </div>
            <Link
              to="/marketplace"
              className="text-blue-600 hover:underline text-sm"
            >
              ← Marketplace
            </Link>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 mb-6">
            <TabBtn active={tab === 'listings'} onClick={() => setTab('listings')}>
              Miei annunci
            </TabBtn>
            <TabBtn active={tab === 'offers-received'} onClick={() => { setTab('offers-received'); markOffersRead(); }}>
              Offerte ricevute
              {unreadOfferIds.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                  {unreadOfferIds.length}
                </span>
              )}
            </TabBtn>
            <TabBtn active={tab === 'offers-sent'} onClick={() => setTab('offers-sent')}>
              Offerte inviate
            </TabBtn>
          </div>

          {loading ? (
            <div className="text-center py-12 text-gray-500">Caricamento...</div>
          ) : (
            <>
              {/* My Listings */}
              {tab === 'listings' && (
                <div className="space-y-4">
                  {myListings.length === 0 ? (
                    <EmptyState
                      icon="🏢"
                      title="Nessun annuncio pubblicato"
                      description="Pubblica il tuo primo annuncio per iniziare"
                      actionLabel="Pubblica annuncio"
                      actionHref="/marketplace/create"
                    />
                  ) : (
                    myListings.map(listing => (
                      <div key={listing.id} className="bg-white rounded-xl shadow-sm border p-4">
                        <div className="flex items-start gap-4">
                          {listing.photos.length > 0 ? (
                            <img src={listing.photos[0]} alt="" className="w-20 h-20 rounded-lg object-cover" />
                          ) : (
                            <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-2xl">
                              🏢
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <Link to={`/marketplace/${listing.id}`} className="font-semibold text-gray-900 hover:text-blue-600 transition">
                                {listing.title}
                              </Link>
                              <StatusBadge status={listing.status as string} />
                            </div>
                            <p className="text-sm text-gray-500 mt-1">{listing.city}{listing.provincia ? ` (${listing.provincia})` : ''}</p>
                            <div className="text-sm font-medium text-blue-600 mt-1">
                              {(listing.prices?.length ? listing.prices : listing.price ? [{ amount: listing.price, type: listing.priceType || 'orario' }] : []).map((p, i) => (
                                <span key={i}>{i > 0 && ' · '}{p.amount}€/{PRICE_TYPE_LABELS[p.type]}</span>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 flex gap-2">
                          <Link
                            to={`/marketplace/${listing.id}/edit`}
                            className="px-3 py-1.5 text-sm border border-blue-300 text-blue-600 rounded-lg hover:bg-blue-50 transition"
                          >
                            Modifica
                          </Link>
                          <button
                            onClick={() => handleToggleListingStatus(listing)}
                            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                          >
                            {listing.status === 'active' ? 'Metti in pausa' : 'Riattiva'}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Offers received */}
              {tab === 'offers-received' && (
                <div className="space-y-4">
                  {offersReceived.length === 0 ? (
                    <EmptyState icon="📩" title="Nessuna offerta ricevuta" description="Le offerte per i tuoi annunci appariranno qui" />
                  ) : (
                    offersReceived.map(offer => (
                      <div key={offer.id} className="bg-white rounded-xl shadow-sm border p-4">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-3">
                            {offer.offererPhotoURL ? (
                              <img src={offer.offererPhotoURL} alt="" className="w-10 h-10 rounded-full object-cover" />
                            ) : (
                              <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-sm">
                                {offer.offererName.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <p className="font-medium text-gray-900 text-sm">{offer.offererName}</p>
                              <Link to={`/marketplace/${offer.listingId}`} className="text-xs text-gray-500 hover:text-blue-600">
                                {offer.listingTitle}
                              </Link>
                            </div>
                          </div>
                          <OfferStatusBadge status={offer.status} />
                        </div>

                        {/* Requested slots */}
                        <div className="mb-3">
                          <p className="text-xs font-medium text-gray-500 mb-1">Fascia oraria richiesta:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {offer.requestedSlots.map((slot, i) => {
                              const dayLabel = DAYS_OF_WEEK.find(d => d.value === slot.day)?.label;
                              return (
                                <span key={i} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-lg">
                                  {dayLabel} {slot.startTime}–{slot.endTime}
                                </span>
                              );
                            })}
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-sm mb-3">
                          <span className="font-bold text-green-600">{offer.offerAmount}€</span>
                          {offer.message && <span className="text-gray-600 italic">"{offer.message}"</span>}
                        </div>

                        {/* Actions for pending offers */}
                        {offer.status === 'pending' && (
                          <>
                            {respondingTo === offer.id ? (
                              <div className="space-y-2 bg-gray-50 p-3 rounded-lg">
                                <textarea
                                  value={responseMessage}
                                  onChange={e => setResponseMessage(e.target.value)}
                                  placeholder="Messaggio di risposta (opzionale)..."
                                  rows={2}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                />
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleRespondOffer(offer.id!, 'accepted')}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition"
                                  >
                                    ✓ Accetta
                                  </button>
                                  <button
                                    onClick={() => handleRespondOffer(offer.id!, 'rejected')}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition"
                                  >
                                    ✗ Rifiuta
                                  </button>
                                  <button
                                    onClick={() => { setRespondingTo(null); setResponseMessage(''); }}
                                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition"
                                  >
                                    Annulla
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setRespondingTo(offer.id!)}
                                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition"
                                >
                                  Rispondi
                                </button>
                              </div>
                            )}
                          </>
                        )}

                        {/* Response message if already responded */}
                        {offer.responseMessage && offer.status !== 'pending' && (
                          <div className="mt-2 p-2 bg-gray-50 rounded-lg">
                            <p className="text-xs text-gray-500">La tua risposta:</p>
                            <p className="text-sm text-gray-700 italic">"{offer.responseMessage}"</p>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Offers sent */}
              {tab === 'offers-sent' && (
                <div className="space-y-4">
                  {offersSent.length === 0 ? (
                    <EmptyState icon="📤" title="Nessuna offerta inviata" description="Quando invii un'offerta per uno studio, apparirà qui" />
                  ) : (
                    offersSent.map(offer => (
                      <div key={offer.id} className="bg-white rounded-xl shadow-sm border p-4">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div>
                            <Link to={`/marketplace/${offer.listingId}`} className="font-medium text-gray-900 hover:text-blue-600 text-sm">
                              {offer.listingTitle}
                            </Link>
                            <p className="text-xs text-gray-500 mt-0.5">a {offer.authorName}</p>
                          </div>
                          <OfferStatusBadge status={offer.status} />
                        </div>

                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {offer.requestedSlots.map((slot, i) => {
                            const dayLabel = DAYS_OF_WEEK.find(d => d.value === slot.day)?.label;
                            return (
                              <span key={i} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-lg">
                                {dayLabel} {slot.startTime}–{slot.endTime}
                              </span>
                            );
                          })}
                        </div>

                        <div className="flex items-center gap-4 text-sm">
                          <span className="font-bold text-green-600">{offer.offerAmount}€</span>
                          {offer.message && <span className="text-gray-600 italic text-xs">"{offer.message}"</span>}
                        </div>

                        {/* Response */}
                        {offer.responseMessage && (
                          <div className="mt-2 p-2 bg-gray-50 rounded-lg">
                            <p className="text-xs text-gray-500">Risposta del proprietario:</p>
                            <p className="text-sm text-gray-700 italic">"{offer.responseMessage}"</p>
                          </div>
                        )}

                        {/* Withdraw pending offer */}
                        {offer.status === 'pending' && (
                          <div className="mt-3">
                            <button
                              onClick={() => handleWithdrawOffer(offer.id!)}
                              className="px-3 py-1.5 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition"
                            >
                              Ritira offerta
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-3 text-sm font-medium border-b-2 transition flex items-center ${
        active
          ? 'border-blue-600 text-blue-600'
          : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      {children}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-green-50 text-green-700 border-green-200',
    paused: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    closed: 'bg-gray-100 text-gray-500 border-gray-200',
  };
  const labels: Record<string, string> = {
    active: 'Attivo',
    paused: 'In pausa',
    closed: 'Chiuso',
  };
  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${styles[status] || styles.closed}`}>
      {labels[status] || status}
    </span>
  );
}

function OfferStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    accepted: 'bg-green-50 text-green-700 border-green-200',
    rejected: 'bg-red-50 text-red-700 border-red-200',
    withdrawn: 'bg-gray-100 text-gray-500 border-gray-200',
  };
  const labels: Record<string, string> = {
    pending: '⏳ In attesa',
    accepted: '✅ Accettata',
    rejected: '❌ Rifiutata',
    withdrawn: '🔙 Ritirata',
  };
  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${styles[status] || ''}`}>
      {labels[status] || status}
    </span>
  );
}

function EmptyState({ icon, title, description, actionLabel, actionHref }: {
  icon: string;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="text-center py-12">
      <div className="text-5xl mb-4">{icon}</div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-500 mb-4">{description}</p>
      {actionLabel && actionHref && (
        <Link
          to={actionHref}
          className="inline-block px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
