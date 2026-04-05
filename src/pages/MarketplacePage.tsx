import { useState, useEffect, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, orderBy, getDocs, doc, getDoc, updateDoc, arrayUnion, arrayRemove, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import LocationAutocomplete from '@/components/LocationAutocomplete';
import { MarketplaceListing, DAYS_OF_WEEK, DayOfWeek, PRICE_TYPE_LABELS } from '@/types/equippe';

const MapSelector = lazy(() => import('@/components/MapSelectorClient'));
import type { MapMarker } from '@/components/MapSelectorClient';

const ADMIN_EMAILS = ['admin@tuaequipe.it', 'jschenetti@gmail.com', 'udemyteam2025@gmail.com', 'martinamaccara@icloud.com', 'martinamaccarana@icloud.com'];

const FILTER_KEY = 'marketplace_filters_v2';

function loadFilters() {
  try {
    const raw = sessionStorage.getItem(FILTER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveFilters(partial: Record<string, unknown>) {
  try {
    const current = loadFilters() ?? {};
    sessionStorage.setItem(FILTER_KEY, JSON.stringify({ ...current, ...partial }));
  } catch { /* ignore */ }
}

export default function MarketplacePage() {
  const { user } = useAuth();
  const isAdmin = !!user?.email && ADMIN_EMAILS.includes(user.email);

  const saved = loadFilters();

  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAddress, setFilterAddress] = useState<string>(saved?.filterAddress ?? '');
  const [filterCoord, setFilterCoord] = useState<{ lat: number; lng: number } | null>(saved?.filterCoord ?? null);
  const [filterRadius, setFilterRadius] = useState<number>(saved?.filterRadius ?? 3);
  const [filterDay, setFilterDay] = useState<DayOfWeek | ''>(saved?.filterDay ?? '');
  const [filterMaxPrice, setFilterMaxPrice] = useState<string>(saved?.filterMaxPrice ?? '');
  const [filterPriceTypes, setFilterPriceTypes] = useState<string[]>(saved?.filterPriceTypes ?? []);
  const [savedListings, setSavedListings] = useState<string[]>([]);
  const [showSavedOnly, setShowSavedOnly] = useState<boolean>(saved?.showSavedOnly ?? false);
  const [marketplaceUnread, setMarketplaceUnread] = useState(0);

  const togglePriceType = (type: string) =>
    setFilterPriceTypes(prev => {
      const next = prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type];
      saveFilters({ filterPriceTypes: next });
      return next;
    });

  useEffect(() => {
    loadListings();
    if (user) loadSaved();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, snap => {
      const count = snap.docs.filter(d => {
        const data = d.data();
        return !data.read && ['marketplace_offer_received', 'marketplace_offer_accepted', 'marketplace_offer_rejected'].includes(data.type);
      }).length;
      setMarketplaceUnread(count);
    });
    return () => unsub();
  }, [user]);

  const loadSaved = async () => {
    if (!user) return;
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      const data = snap.data();
      setSavedListings(data?.savedListings ?? []);
    } catch { /* ignore */ }
  };

  const toggleSave = async (e: React.MouseEvent, listingId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return;
    const isSaved = savedListings.includes(listingId);
    setSavedListings(prev => isSaved ? prev.filter(id => id !== listingId) : [...prev, listingId]);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        savedListings: isSaved ? arrayRemove(listingId) : arrayUnion(listingId),
      });
    } catch {
      // rollback
      setSavedListings(prev => isSaved ? [...prev, listingId] : prev.filter(id => id !== listingId));
    }
  };

  const loadListings = async () => {
    try {
      const q = query(
        collection(db, 'marketplace_listings'),
        where('status', '==', 'active'),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as MarketplaceListing));
      setListings(data);
    } catch (error) {
      console.error('Errore caricamento annunci:', error);
    } finally {
      setLoading(false);
    }
  };

  // Haversine distance in km
  const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const filtered = listings.filter(l => {
    if (showSavedOnly && !savedListings.includes(l.id!)) return false;
    if (filterCoord) {
      if (!l.coordinate) return false;
      if (haversine(filterCoord.lat, filterCoord.lng, l.coordinate.lat, l.coordinate.lng) > filterRadius) return false;
    }
    if (filterDay && !l.availability.some(a => a.day === filterDay)) return false;
    if (filterPriceTypes.length > 0) {
      const types = l.prices?.length ? l.prices.map(p => p.type) : (l.priceType ? [l.priceType] : []);
      if (!filterPriceTypes.some(ft => types.includes(ft as any))) return false;
    }
    if (filterMaxPrice) {
      const allPrices = l.prices?.length ? l.prices : (l.priceType ? [{ type: l.priceType, amount: l.price ?? Infinity }] : []);
      const relevantPrices = filterPriceTypes.length > 0
        ? allPrices.filter(p => filterPriceTypes.includes(p.type))
        : allPrices;
      const minRelevant = relevantPrices.length ? Math.min(...relevantPrices.map(p => p.amount)) : Infinity;
      if (minRelevant > Number(filterMaxPrice)) return false;
    }
    return true;
  });

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
        <div className="max-w-6xl mx-auto px-4 pt-0 pb-24 sm:pt-3 sm:pb-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Marketplace Studi</h1>
              <p className="text-gray-500 text-sm mt-1">Trova o pubblica studi professionali in affitto</p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowSavedOnly(v => { const next = !v; saveFilters({ showSavedOnly: next }); return next; })}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition flex items-center gap-1.5 ${
                  showSavedOnly
                    ? 'bg-red-50 border-red-300 text-red-600'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <svg className="w-4 h-4" fill={showSavedOnly ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                Salvati
              </button>
              <Link
                to="/marketplace/my"
                className="relative px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm font-medium"
              >
                Annunci e Offerte
                {marketplaceUnread > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                    {marketplaceUnread > 9 ? '9+' : marketplaceUnread}
                  </span>
                )}
              </Link>
              <Link
                to="/marketplace/create"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
              >
                + Pubblica annuncio
              </Link>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
            <div className={`flex flex-col ${filterCoord ? 'lg:flex-row' : ''} gap-4`}>
              {/* Left: filter fields */}
              <div className={`space-y-4 ${filterCoord ? 'lg:w-1/2' : 'w-full'}`}>
                {/* Location filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Zona</label>
                  <div className="flex gap-3 items-end">
                    <div className="flex-1">
                      <LocationAutocomplete
                        value={filterAddress}
                        onChange={(addr, coords) => {
                          setFilterAddress(addr);
                          setFilterCoord(coords ?? null);
                          saveFilters({ filterAddress: addr, filterCoord: coords ?? null });
                        }}
                        placeholder="Cerca un indirizzo o città..."
                      />
                    </div>
                    {filterCoord && (
                      <button
                        type="button"
                        onClick={() => { setFilterAddress(''); setFilterCoord(null); saveFilters({ filterAddress: '', filterCoord: null }); }}
                        className="px-3 py-2 text-sm text-gray-400 hover:text-gray-600 border border-dashed border-gray-300 rounded-lg whitespace-nowrap"
                      >
                        Rimuovi zona
                      </button>
                    )}
                  </div>
                  {filterCoord && (
                    <div className="mt-3 flex items-center gap-3">
                      <label className="text-sm text-gray-600 whitespace-nowrap">Raggio: <strong>{filterRadius} km</strong></label>
                      <input
                        type="range"
                        min={1}
                        max={100}
                        value={filterRadius}
                        onChange={e => { const v = Number(e.target.value); setFilterRadius(v); saveFilters({ filterRadius: v }); }}
                        className="flex-1 accent-blue-600"
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Giorno disponibile</label>
                    <select
                      value={filterDay}
                      onChange={e => { const v = e.target.value as DayOfWeek | ''; setFilterDay(v); saveFilters({ filterDay: v }); }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Tutti i giorni</option>
                      {DAYS_OF_WEEK.map(d => (
                        <option key={d.value} value={d.value}>{d.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Prezzo max (€)</label>
                    <input
                      type="number"
                      value={filterMaxPrice}
                      onChange={e => { const v = e.target.value; setFilterMaxPrice(v); saveFilters({ filterMaxPrice: v }); }}
                      placeholder="es. 500"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Formula d'affitto</label>
                  <div className="flex flex-wrap gap-2">
                    {([
                      { value: 'orario', label: 'Ora' },
                      { value: 'mezza_giornata', label: 'Mezza giornata/sett.' },
                      { value: 'giornaliero', label: 'Giorno/sett.' },
                      { value: 'mensile', label: 'Mese' },
                    ] as const).map(opt => {
                      const active = filterPriceTypes.includes(opt.value);
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => togglePriceType(opt.value)}
                          className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${
                            active
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                    {filterPriceTypes.length > 0 && (
                      <button type="button" onClick={() => setFilterPriceTypes([])} className="px-3 py-1.5 rounded-full text-sm text-gray-400 hover:text-gray-600 border border-dashed border-gray-300">
                        Rimuovi filtri
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: map (only when a location is selected) */}
              {filterCoord && (
                <div className="lg:w-1/2">
                  <Suspense fallback={<div className="h-full min-h-[280px] bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">Caricamento mappa...</div>}>
                    <div className="h-full min-h-[280px] rounded-lg overflow-hidden border">
                      <MapSelector
                        coordinate={filterCoord}
                        raggioKm={filterRadius}
                        indirizzo={filterAddress}
                        readOnly
                        markers={filtered
                          .filter(l => {
                            if (!l.coordinate) return false;
                            if (!filterCoord) return true;
                            return haversine(filterCoord.lat, filterCoord.lng, l.coordinate.lat, l.coordinate.lng) <= filterRadius;
                          })
                          .map(l => ({
                            id: l.id!,
                            lat: l.coordinate!.lat,
                            lng: l.coordinate!.lng,
                            imageUrl: l.photos?.[0],
                            title: l.title,
                            href: `/marketplace/${l.id}`,
                          } as MapMarker))}
                      />
                    </div>
                  </Suspense>
                </div>
              )}
            </div>
          </div>

          {/* Results */}
          {loading ? (
            <div className="text-center py-12 text-gray-500">Caricamento annunci...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-5xl mb-4">🏢</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Nessun annuncio trovato</h3>
              <p className="text-gray-500 mb-4">Prova a modificare i filtri oppure pubblica il primo annuncio!</p>
              <Link
                to="/marketplace/create"
                className="inline-block px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
              >
                Pubblica annuncio
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map(listing => (
                <ListingCard key={listing.id} listing={listing} activeFilters={filterPriceTypes} isSaved={savedListings.includes(listing.id!)} onToggleSave={toggleSave} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function ListingCard({ listing, activeFilters = [], isSaved = false, onToggleSave }: {
  listing: MarketplaceListing;
  activeFilters?: string[];
  isSaved?: boolean;
  onToggleSave?: (e: React.MouseEvent, listingId: string) => void;
}) {
  // Backward compat
  const allPrices = listing.prices?.length
    ? listing.prices
    : listing.price ? [{ amount: listing.price, type: listing.priceType || 'orario' as const }] : [];

  // Se c'è un filtro attivo, metti in testa il primo prezzo che matcha
  const displayPrices = activeFilters.length > 0
    ? [
        ...allPrices.filter(p => activeFilters.includes(p.type)),
        ...allPrices.filter(p => !activeFilters.includes(p.type)),
      ]
    : allPrices;

  const dayLabels = listing.availability
    .map(a => DAYS_OF_WEEK.find(d => d.value === a.day)?.label?.slice(0, 3))
    .filter(Boolean);

  return (
    <Link
      to={`/marketplace/${listing.id}`}
      className="bg-white rounded-xl shadow-sm border hover:shadow-md transition overflow-hidden group"
    >
      {/* Photo */}
      <div className="h-44 bg-gray-100 overflow-hidden relative">
        {listing.photos.length > 0 ? (
          <img
            src={listing.photos[0]}
            alt={listing.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
        )}
        {onToggleSave && (
          <button
            type="button"
            onClick={e => onToggleSave(e, listing.id!)}
            className="absolute top-2 right-2 p-1.5 rounded-full bg-white/80 backdrop-blur-sm shadow hover:bg-white transition"
            title={isSaved ? 'Rimuovi dai salvati' : 'Salva annuncio'}
          >
            <svg className={`w-4 h-4 transition ${isSaved ? 'text-red-500 fill-red-500' : 'text-gray-400 fill-none'}`} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </button>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold text-gray-900 line-clamp-1">{listing.title}</h3>
          <div className="text-right">
            {displayPrices.length > 0 && (
              <span className="text-blue-600 font-bold whitespace-nowrap text-sm">
                {displayPrices[0].amount}€/{PRICE_TYPE_LABELS[displayPrices[0].type]}
              </span>
            )}
            {displayPrices.length > 1 && (
              <span className="block text-xs text-gray-400">+{displayPrices.length - 1} {displayPrices.length === 2 ? 'opzione' : 'opzioni'}</span>
            )}
          </div>
        </div>

        <p className="text-sm text-gray-500 mb-3">
          {listing.city}{listing.provincia ? ` (${listing.provincia})` : ''}
        </p>

        <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
          {listing.rooms > 0 && <span>{listing.rooms} {listing.rooms === 1 ? 'locale' : 'locali'}</span>}
          {listing.area > 0 && <span>{listing.area} m²</span>}
          {listing.bathrooms > 0 && <span>{listing.bathrooms} {listing.bathrooms === 1 ? 'bagno' : 'bagni'}</span>}
        </div>

        {/* Availability badges */}
        <div className="flex flex-wrap gap-1.5">
          {dayLabels.map((d, i) => (
            <span key={i} className="px-2 py-0.5 bg-green-50 text-green-700 text-xs rounded-full font-medium">
              {d}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
