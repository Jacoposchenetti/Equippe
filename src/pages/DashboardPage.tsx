'use client';

import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User, Team } from '../types/equippe';
import Header from '../components/Header';
import Footer from '../components/Footer';
import EnhancedSearch, { SearchFilters } from '../components/EnhancedSearch';
import VerificationBanner from '../components/VerificationBanner';
import ProfileCompletionBanner from '../components/ProfileCompletionBanner';
import DailyRewardModal from '../components/DailyRewardModal';
import { useCanInteract } from '../hooks/useCanInteract';
import { fetchDailyRewardStatus, DailyRewardStatus } from '../lib/dailyReward';

export default function DashboardPage() {
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();
  const { canInteract } = useCanInteract();
  const [professionisti, setProfessionisti] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentFilters, setCurrentFilters] = useState<SearchFilters>({
    type: 'professionista',
    remoto: false,
  });
  const [dailyRewardStatus, setDailyRewardStatus] = useState<DailyRewardStatus | null>(null);
  const [showRewardModal, setShowRewardModal] = useState(false);

  // Funzione per normalizzare i vecchi nomi delle discipline nei nomi dei professionisti
  const normalizeSpecialization = (spec: string): string => {
    const normalizationMap: Record<string, string> = {
      'Psicologia': 'Psicologo',
      'Psicoterapia': 'Psicoterapeuta',
      'Psichiatria': 'Psichiatra',
      'Nutrizione': 'Nutrizionista',
      'Logopedia': 'Logopedista',
      'Fisioterapia': 'Fisioterapista'
    };
    return normalizationMap[spec] || spec;
  };

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    loadData();

    // Check daily reward once per browser session
    const sessionKey = `daily_reward_checked_${user.uid}`;
    if (!sessionStorage.getItem(sessionKey)) {
      sessionStorage.setItem(sessionKey, '1');
      fetchDailyRewardStatus(user.uid).then((status) => {
        setDailyRewardStatus(status);
        if (status.canClaim) setShowRewardModal(true);
      }).catch(() => { /* non-critical */ });
    }
  }, [user]);

  // Inizializza i filtri con la posizione del proprio studio appena userProfile è disponibile
  useEffect(() => {
    if (!userProfile) return;
    const studioCoord = userProfile.profile?.studi?.[0]?.coordinate || null;
    const studioAddr = userProfile.profile?.studi?.[0]?.indirizzo || '';
    if (studioCoord || studioAddr) {
      setCurrentFilters(prev => ({
        ...prev,
        coordinate: studioCoord,
        indirizzo: studioAddr || undefined,
        raggioKm: 5,
      }));
    }
  }, [userProfile]);

  const loadData = async () => {
    try {
      // Verifica autenticazione
      console.log('🔐 User autenticato:', user?.uid);
      console.log('🔐 Token:', await user?.getIdToken());

      // Carica professionisti
      const usersRef = collection(db, 'users');
      const usersSnapshot = await getDocs(usersRef);
      const users = usersSnapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      } as User));
      setProfessionisti(users.filter(u => u.uid !== user?.uid));
      console.log('✅ Caricati', users.length, 'professionisti');

      // Carica teams con token refresh
      try {
        // Forza refresh del token
        if (user) {
          const token = await user.getIdToken(true);
          console.log('🔄 Token refreshed');
          console.log('🔐 Token claims:', await user.getIdTokenResult());
        }

        const teamsRef = collection(db, 'teams');
        console.log('🔄 Caricamento teams...');
        console.log('🔍 DB instance:', db.app.options.projectId);
        console.log('🔍 User UID:', user?.uid);
        const teamsSnapshot = await getDocs(teamsRef);
        const teamsData = await Promise.all(teamsSnapshot.docs.map(async (teamDoc) => {
          const teamData = {
            teamId: teamDoc.id,
            id: teamDoc.id,
            ...teamDoc.data()
          } as Team;

          // Carica i dati dei membri per ogni team
          if (teamData.members && teamData.members.length > 0) {
            const membersData = await Promise.all(
              teamData.members.map(async (member) => {
                try {
                  const userId = member.userId || member.uid;
                  if (!userId) return member;
                  const memberDocRef = doc(db, 'users', userId);
                  const memberDoc = await getDoc(memberDocRef);
                  if (memberDoc.exists()) {
                    return {
                      ...member,
                      userData: { uid: memberDoc.id, ...memberDoc.data() } as User
                    };
                  }
                  return member;
                } catch (err) {
                  console.error('Errore caricamento membro:', err);
                  return member;
                }
              })
            );
            teamData.membersWithData = membersData;
          }

          return teamData;
        }));
        // Geocodifica i team che hanno indirizzo ma coordinate mancanti o uguali al default Roma
        const isDefaultRome = (c: any) => c && Math.abs(c.lat - 41.9028) < 0.001 && Math.abs(c.lng - 12.4964) < 0.001;
        const geocodedTeams = await Promise.all(teamsData.map(async (t) => {
          if ((!t.coordinate || isDefaultRome(t.coordinate)) && t.indirizzo) {
            try {
              const token = import.meta.env.VITE_MAPBOX_TOKEN;
              // Usa solo via+numero+città (le prime 2-3 parti) per geocodifica più precisa
              const shortAddr = t.indirizzo.split(',').slice(0, 2).join(',').trim();
              const res = await fetch(
                `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(shortAddr)}.json?country=it&limit=1&language=it&access_token=${token}`
              );
              const data = await res.json();
              if (data.features?.[0]) {
                const [lng, lat] = data.features[0].center;
                return { ...t, coordinate: { lat, lng } };
              }
            } catch { /* ignore */ }
          }
          return t;
        }));
        setTeams(geocodedTeams);
        console.log('✅ Caricati', teamsData.length, 'teams');
        console.log('Teams:', teamsData);
      } catch (teamError) {
        console.error('❌ Errore caricamento teams:', teamError);
        // Continua comunque con i professionisti
      }
    } catch (error) {
      console.error('Errore caricamento dati:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (filters: SearchFilters) => {
    setCurrentFilters(filters);
  };

  // Funzione per calcolare la distanza tra due coordinate (formula di Haversine)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Raggio della Terra in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distanza in km
  };

  const normalizeTextFilter = (value: string) => value.trim().toLowerCase();

  const getExperienceYearsUpperBound = (value?: string): number => {
    if (!value) return 0;
    const matches = value.match(/\d+/g);
    if (!matches || matches.length === 0) return 0;
    return Math.max(...matches.map((match) => Number(match)).filter((year) => !Number.isNaN(year)));
  };

  // Filtra professionisti
  const filteredProfessionisti = professionisti.filter(p => {
    // Specializzazione - controlla sia il nome originale che quello normalizzato
    if (currentFilters.specializzazione) {
      const specs = p.profile.specializzazioni || [];
      const normalizedSpecs = specs.map(spec => normalizeSpecialization(spec));
      if (!specs.includes(currentFilters.specializzazione) &&
          !normalizedSpecs.includes(currentFilters.specializzazione)) {
        return false;
      }
    }

    // Area d'interesse - filtra per tematica specifica
    if (currentFilters.areaInteresse) {
      const hasTematica = p.profile.tematiche?.includes(currentFilters.areaInteresse);
      if (!hasTematica) {
        return false;
      }
    }

    // Location - verifica distanza dalla posizione del professionista
    if (currentFilters.coordinate && currentFilters.raggioKm) {
      let hasLocationInRange = false;

      // PRIMA controlla studi multipli se disponibili
      if (p.profile.studi && p.profile.studi.length > 0) {
        for (const studio of p.profile.studi) {
          // Controlla coordinate se valide
          if (studio.coordinate && studio.coordinate.lat !== 0 && studio.coordinate.lng !== 0) {
            const distance = calculateDistance(
              currentFilters.coordinate.lat,
              currentFilters.coordinate.lng,
              studio.coordinate.lat,
              studio.coordinate.lng
            );
            if (distance <= currentFilters.raggioKm) {
              hasLocationInRange = true;
              break;
            }
          } else {
            // FALLBACK per studi senza coordinate: controlla se l'indirizzo contiene Roma
            if (studio.indirizzo) {
              const addressLower = studio.indirizzo.toLowerCase();
              const isRomeAddress = addressLower.includes('roma') || addressLower.includes('rome');
              const isSearchingInRome = currentFilters.indirizzo?.toLowerCase().includes('roma') ||
                                        currentFilters.indirizzo?.toLowerCase().includes('rome');
              if (isRomeAddress && isSearchingInRome && currentFilters.raggioKm >= 10) {
                hasLocationInRange = true;
                break;
              }
            }
          }
        }
      }

      // FALLBACK: se non ha studi validi, controlla location principale (legacy)
      if (!hasLocationInRange && p.profile.location) {
        if (p.profile.location.lat && p.profile.location.lng &&
            p.profile.location.lat !== 0 && p.profile.location.lng !== 0) {
          const distance = calculateDistance(
            currentFilters.coordinate.lat,
            currentFilters.coordinate.lng,
            p.profile.location.lat,
            p.profile.location.lng
          );
          if (distance <= currentFilters.raggioKm) {
            hasLocationInRange = true;
          }
        } else {
          // FALLBACK per location senza coordinate
          if (p.profile.location.indirizzo) {
            const addressLower = p.profile.location.indirizzo.toLowerCase();
            const isRomeAddress = addressLower.includes('roma') || addressLower.includes('rome');
            const isSearchingInRome = currentFilters.indirizzo?.toLowerCase().includes('roma') ||
                                      currentFilters.indirizzo?.toLowerCase().includes('rome');
            if (isRomeAddress && isSearchingInRome && currentFilters.raggioKm >= 10) {
              hasLocationInRange = true;
            }
          }
        }
      }

      // Se non ha nessuna coordinata GPS valida, includi comunque (non possiamo calcolare distanza)
      const hasAnyLocationData = (p.profile.studi && p.profile.studi.length > 0 && p.profile.studi.some(s =>
        s.coordinate && s.coordinate.lat !== 0 && s.coordinate.lng !== 0
      )) || (p.profile.location && p.profile.location.lat && p.profile.location.lat !== 0 && p.profile.location.lng && p.profile.location.lng !== 0);

      if (!hasLocationInRange && hasAnyLocationData) {
        // Ha dati di location ma non è nel raggio — includi solo se lavora da remoto e il filtro lo prevede
        const hasRemoto = p.profile.lavoraOnline ?? p.profile.studi?.some(s => s.remoto) ?? false;
        if (!hasRemoto || !currentFilters.remoto) {
          return false;
        }
      }
      // Se non ha nessun dato location, lascialo passare comunque
    }

    // Lingua parlata
    if (currentFilters.lingua) {
      const lingue = (p.profile as any).lingue as Array<{ lingua: string; livello: string }> | undefined;
      const selectedLingua = normalizeTextFilter(currentFilters.lingua);
      const hasImplicitItalian = selectedLingua === 'italiano' && (!lingue || lingue.length === 0);
      const hasSelectedLingua = lingue?.some(l => normalizeTextFilter(l.lingua || '') === selectedLingua) ?? false;
      if (!hasImplicitItalian && !hasSelectedLingua) {
        return false;
      }
    }

    // Anni di esperienza minimi (basato sul campo anniEsperienza delle professioni)
    if (currentFilters.anniEsperienzaMin && currentFilters.anniEsperienzaMin > 0) {
      const profDocs = [
        ...(Array.isArray(p.profile.professioniConDocumenti) ? p.profile.professioniConDocumenti : []),
        ...(Array.isArray(p.profile.professioniPending) ? p.profile.professioniPending : []),
      ];
      const maxAnni = Math.max(
        getExperienceYearsUpperBound((p.profile as any).esperienza),
        ...profDocs.map((prof) => getExperienceYearsUpperBound(prof.anniEsperienza))
      );
      if (maxAnni < currentFilters.anniEsperienzaMin) {
        return false;
      }
    }

    return true;
  });

  // Filtra teams (solo quelli con posti disponibili)
  const filteredTeams = teams.filter(t => {
    // Solo equipe con posti disponibili (se hanno ruoliCercati)
    if (t.ruoliCercati && t.ruoliCercati.length > 0) {
      const hasAvailableSpots = t.ruoliCercati.some(ruolo => ruolo.occupati < ruolo.numero);
      if (!hasAvailableSpots) return false;
    } else {
      // Se non ha ruoliCercati, mostralo comunque (team vecchi)
      // oppure nascondilo: return false;
    }

    // Specializzazione (basata sui ruoli cercati)
    if (currentFilters.specializzazione && t.ruoliCercati) {
      const hasSpecialization = t.ruoliCercati.some(ruolo =>
        ruolo.specializzazione === currentFilters.specializzazione
      );
      if (!hasSpecialization) return false;
    }

    // Location - verifica distanza se ci sono coordinate del filtro E dell'equipe
    if (currentFilters.coordinate && currentFilters.raggioKm) {
      if (!t.coordinate) {
        // Senza coordinate: mostra solo se remoto E checkbox attiva
        if (!t.remoto || !currentFilters.remoto) {
          return false;
        }
      } else {
        const distance = calculateDistance(
          currentFilters.coordinate.lat,
          currentFilters.coordinate.lng,
          t.coordinate.lat,
          t.coordinate.lng
        );

        if (distance > currentFilters.raggioKm) {
          // Fuori raggio: mostra solo se remoto E checkbox attiva
          if (!t.remoto || !currentFilters.remoto) {
            return false;
          }
        }
      }
    }

    return true;
  });

  const getAvatarColor = (index: number) => {
    const colors = ['bg-green-300', 'bg-orange-300', 'bg-purple-300', 'bg-blue-300', 'bg-pink-300', 'bg-yellow-300'];
    return colors[index % colors.length];
  };

  const getInitials = (nome: string) => {
    const names = nome.split(' ');
    return names.map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center app-shell">
        <div className="text-xl text-gray-600">Caricamento...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen app-shell">
      <Header />
      <VerificationBanner />
      <ProfileCompletionBanner />

      {showRewardModal && dailyRewardStatus && (
        <DailyRewardModal
          status={dailyRewardStatus}
          onClose={() => setShowRewardModal(false)}
          onClaimed={(newStreak, tokensEarned) => {
            setDailyRewardStatus(prev => prev ? { ...prev, canClaim: false, currentStreak: newStreak } : prev);
          }}
        />
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-0 pb-24 sm:pt-6 sm:pb-10">
        <section className="surface-lifted relative mb-6 overflow-hidden rounded-3xl">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-700 via-green-600 to-orange-500" />
          <div className="flex flex-col gap-2 p-5 md:flex-row md:items-end md:justify-between md:gap-6 sm:p-7">
            <h1 className="text-2xl font-extrabold tracking-normal text-slate-950 md:text-4xl">
              {currentFilters.type === 'professionista' ? 'Professionisti' : 'Equipe'}
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-500 md:text-right md:text-base">
              {currentFilters.type === 'professionista'
                ? 'Cerca il professionista perfetto con cui collaborare'
                : 'Cerca equipe di lavoro a cui unirti nella tua zona'}
            </p>
          </div>
        </section>
        {!canInteract && (
          <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50/90 p-4 shadow-sm">
            <p className="text-sm text-blue-700">
              ℹ️ Puoi navigare il sito, ma dovrai completare la verifica per poter interagire con altri professionisti
            </p>
          </div>
        )}

        {/* Enhanced Search */}
        <div className="mb-8">
          <EnhancedSearch
            onSearch={handleSearch}
            initialAddress={userProfile?.profile?.studi?.[0]?.indirizzo || ''}
            initialCoordinate={userProfile?.profile?.studi?.[0]?.coordinate || null}
            mapMarkers={currentFilters.type === 'professionista'
              ? filteredProfessionisti.flatMap(p => {
                  const coords =
                    p.profile.studi?.find((s: any) => s.coordinate?.lat && s.coordinate?.lng)?.coordinate ||
                    (p.profile.location?.lat ? p.profile.location : null);
                  if (!coords) return [];
                  return [{
                    id: p.uid,
                    lat: coords.lat,
                    lng: coords.lng,
                    imageUrl: p.profile.photoURL || undefined,
                    title: p.profile.nome || '',
                    href: `/profile/${p.uid}`,
                  }];
                })
              : filteredTeams.flatMap(t => {
                  const coords = (t.coordinate?.lat && t.coordinate?.lng)
                    ? t.coordinate
                    : (t as any).membersWithData?.find((m: any) => m.userData?.profile?.studi?.[0]?.coordinate?.lat)
                        ?.userData?.profile?.studi?.[0]?.coordinate ?? null;
                  if (!coords) return [];
                  return [{
                    id: t.teamId || t.id || '',
                    lat: coords.lat,
                    lng: coords.lng,
                    imageUrl: t.photoURL || undefined,
                    title: t.name || '',
                    href: `/teams/${t.teamId || t.id}`,
                  }];
                })
            }
          />
        </div>

        {/* Risultati */}
        {currentFilters.type === 'professionista' ? (
          // Lista Professionisti
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredProfessionisti.length === 0 ? (
              <div className="surface col-span-full rounded-3xl px-6 py-14 text-center text-slate-500">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-2xl font-bold text-blue-700">0</div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">Nessun professionista trovato</h3>
                <div className="text-sm text-gray-400 space-y-1">
                  {currentFilters.specializzazione && (
                    <p>• Specializzazione: {currentFilters.specializzazione}</p>
                  )}
                  {currentFilters.coordinate && (
                    <p>• Zona: {currentFilters.indirizzo} (raggio {currentFilters.raggioKm} km)</p>
                  )}
                  {currentFilters.remoto && (
                    <p>• Include lavoro da remoto</p>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-4">
                  Suggerimento: Prova ad espandere il raggio di ricerca o rimuovere alcuni filtri
                </p>
              </div>
            ) : (
              filteredProfessionisti.map((p, index) => (
                <div key={p.uid} className="surface relative overflow-hidden rounded-2xl transition hover:-translate-y-0.5 hover:shadow-lg">
                  <div className="p-6">
                    {/* Badge verifica documentazione - icona con tooltip */}
                    {p.profile.verificationInfo?.status !== 'approved' && (
                      <div className="absolute top-3 right-3 group">
                        <svg className="w-5 h-5 text-yellow-500 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <div className="invisible group-hover:visible absolute right-0 top-7 z-10 w-48 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg shadow-lg text-xs">
                          <p className="font-medium text-yellow-800">Documentazione in verifica</p>
                          <p className="text-yellow-700 mt-0.5">Profilo visibile ma non ancora validato</p>
                        </div>
                      </div>
                    )}
                    {/* Avatar */}
                    <div className="flex justify-center mb-4">
                      {p.profile.photoURL ? (
                        <img
                          src={p.profile.photoURL}
                          alt={p.profile.nome}
                          className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-sm ring-1 ring-slate-200"
                          style={{ aspectRatio: '1/1' }}
                        />
                      ) : (
                        <div
                          className={`w-20 h-20 ${getAvatarColor(index)} rounded-full flex items-center justify-center text-gray-700 font-bold text-2xl shadow-sm ring-1 ring-white`}
                          style={{ aspectRatio: '1/1' }}
                        >
                          {getInitials(p.profile.nome)}
                        </div>
                      )}
                    </div>

                    {/* Nome */}
                    <h3 className="text-center font-bold text-xl text-gray-900 mb-2">
                      {p.profile.nome}
                    </h3>

                    {/* Badge Specializzazioni */}
                    <div className="flex flex-wrap justify-center gap-2 mb-4">
                      {[...new Set((p.profile.specializzazioni || []).map(spec => normalizeSpecialization(spec)))].slice(0, 2).map((spec, i) => (
                        <span key={i} className="inline-block px-3 py-1 text-xs font-medium bg-blue-50 text-blue-800 rounded-full border border-blue-100">
                          {spec}
                        </span>
                      ))}
                      {[...new Set((p.profile.specializzazioni || []).map(spec => normalizeSpecialization(spec)))].length > 2 && (
                        <span className="inline-block px-3 py-1 text-xs font-medium bg-slate-100 text-slate-600 rounded-full">
                          +{[...new Set((p.profile.specializzazioni || []).map(spec => normalizeSpecialization(spec)))].length - 2}
                        </span>
                      )}
                    </div>

                    {/* Location - Studi multipli */}
                    <div className="text-center text-sm text-gray-600 mb-4">
                      {p.profile.studi && p.profile.studi.length > 0 ? (
                        <div className="space-y-1">
                          {p.profile.studi.slice(0, 2).map((studio, idx) => {
                            // Estrae meglio la città dall'indirizzo
                            let displayLocation = studio.città;
                            if (!displayLocation || displayLocation === 'N/A') {
                              const parts = studio.indirizzo.split(',');
                              // Cerca "Roma" nelle parti dell'indirizzo
                              const romaPart = parts.find(part => part.toLowerCase().includes('roma'));
                              if (romaPart) {
                                displayLocation = 'Roma';
                              } else if (parts.length >= 2) {
                                // Prende la penultima parte se disponibile, altrimenti la prima
                                displayLocation = parts[parts.length - 2]?.trim() || parts[0]?.trim();
                              } else {
                                displayLocation = 'Studio';
                              }
                            }

                            return (
                              <div key={idx} className="flex items-center justify-center gap-1">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <span className="truncate">{studio.indirizzo}</span>
                              </div>
                            );
                          })}
                          {p.profile.studi.length > 2 && (
                            <div className="text-xs text-gray-500">
                              +{p.profile.studi.length - 2} {p.profile.studi.length - 2 === 1 ? 'altro studio' : 'altri studi'}
                            </div>
                          )}
                        </div>
                      ) : p.profile.location?.indirizzo ? (
                        <p className="flex items-center justify-center gap-1">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span className="truncate">{p.profile.location.città || 'Italia'}</span>
                        </p>
                      ) : (
                        <p>{p.profile.location?.città || 'Italia'}</p>
                      )}
                    </div>

                    {/* Button */}
                    <button
                      onClick={() => navigate(`/profile/${p.uid}`)}
                      className="btn-primary w-full"
                    >
                      Vedi Profilo
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          // Lista equipe
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredTeams.length === 0 ? (
              <div className="surface col-span-full rounded-3xl px-6 py-14 text-center text-slate-500">
                Nessuna equipe trovata con posti disponibili
              </div>
            ) : (
              filteredTeams.map((team, index) => (
                <div key={team.teamId || team.id} className="surface overflow-hidden rounded-2xl transition hover:-translate-y-0.5 hover:shadow-lg">
                  <div className="p-6">
                    {/* Avatar Team */}
                    <div className="flex justify-center mb-4">
                      {team.photoURL ? (
                        <img
                          src={team.photoURL}
                          alt={`Foto ${team.name}`}
                          className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-sm ring-2 ring-amber-100"
                          style={{ aspectRatio: '1/1' }}
                        />
                      ) : (
                        <div
                          className={`w-20 h-20 ${getAvatarColor(index)} rounded-full flex items-center justify-center text-gray-700 font-bold text-2xl shadow-sm ring-1 ring-white`}
                          style={{ aspectRatio: '1/1' }}
                        >
                          {getInitials(team.name || 'Team')}
                        </div>
                      )}
                    </div>

                    {/* Nome Team */}
                    <h3 className="text-center font-bold text-lg text-gray-900 mb-2">
                      {team.name}
                    </h3>

                    {/* Descrizione */}
                    <p className="text-sm text-gray-600 text-center mb-4 line-clamp-2">
                      {team.description}
                    </p>

                    {/* Composizione Team */}
                    <div className="mb-4 border-t border-slate-200 pt-4">
                      {/* Membri Attuali */}
                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-gray-700">Membri Attuali</span>
                          <span className="text-xs text-gray-500">{team.members?.length || 0}</span>
                        </div>
                        {team.membersWithData && team.membersWithData.length > 0 ? (
                          <div className="space-y-1">
                            {team.membersWithData.slice(0, 3).map((member: any, i: number) => (
                              <div key={i} className="flex items-start gap-2 text-xs bg-green-50 rounded px-2 py-1.5">
                                <svg className="w-3 h-3 mt-0.5 flex-shrink-0 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                </svg>
                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold text-green-800 truncate">
                                    {member.userData?.profile?.nome || 'Membro'}
                                  </div>
                                  <div className="text-green-600 truncate">
                                    {member.userData?.profile?.specializzazioni?.[0] || ''}
                                  </div>
                                </div>
                              </div>
                            ))}
                            {team.membersWithData.length > 3 && (
                              <div className="text-xs text-gray-500 text-center">+{team.membersWithData.length - 3} altri</div>
                            )}
                          </div>
                        ) : (
                          <div className="text-xs text-gray-400 text-center italic">Nessun membro</div>
                        )}
                      </div>

                      {/* Posizioni Aperte */}
                      {team.ruoliCercati && team.ruoliCercati.length > 0 ? (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-orange-700">Cercano</span>
                            <span className="text-xs text-orange-600 font-medium">
                              {team.ruoliCercati.reduce((acc, r) => acc + (r.numero - r.occupati), 0)} {team.ruoliCercati.reduce((acc, r) => acc + (r.numero - r.occupati), 0) === 1 ? 'posto' : 'posti'}
                            </span>
                          </div>
                          <div className="space-y-1">
                            {team.ruoliCercati
                              .filter(ruolo => ruolo.occupati < ruolo.numero)
                              .map((ruolo, i) => (
                                <div key={i} className="flex items-start justify-between gap-2 text-xs bg-orange-50 rounded px-2 py-1.5">
                                  <div className="flex items-start gap-2 flex-1 min-w-0">
                                    <svg className="w-3 h-3 mt-0.5 flex-shrink-0 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                    <span className="font-semibold text-orange-800 truncate">{ruolo.specializzazione}</span>
                                  </div>
                                  <span className="text-xs bg-orange-200 text-orange-900 px-2 py-0.5 rounded-full font-bold whitespace-nowrap">
                                    {ruolo.numero - (ruolo.occupati || 0)}
                                  </span>
                                </div>
                              ))}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-2">
                          <div className="text-xs text-gray-400 italic">
                            Nessuna posizione specificata
                          </div>
                          <div className="text-xs text-blue-600 mt-1">
                            Clicca per vedere i dettagli
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Zona Operativa */}
                    {team.coordinate && team.indirizzo && (
                      <div className="mb-4 border-t border-gray-200 pt-3">
                        <div className="flex items-start gap-2 text-xs">
                          <svg className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <div className="flex-1 min-w-0">
                            <div className="text-gray-700 font-medium mb-1" style={{ fontSize: '11px', lineHeight: '1.3' }}>
                              {team.indirizzo}
                            </div>
                            <div className="text-gray-500">
                              Raggio: <span className="font-semibold text-blue-600">{team.raggioKm} km</span>
                              {team.remoto && (
                                <span className="ml-2 text-green-600">• Remoto</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Button */}
                    <button
                      onClick={() => navigate(`/teams/${team.teamId || team.id}`)}
                      className="btn-primary w-full"
                    >
                      Vedi equipe
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

      </div>
      <Footer />
    </div>
  );
}
