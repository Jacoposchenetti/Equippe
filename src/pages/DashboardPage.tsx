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
import { useCanInteract } from '../hooks/useCanInteract';

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
  }, [user]);

  // Inizializza automaticamente la ricerca al caricamento
  useEffect(() => {
    if (!loading) {
      // Esegui una ricerca di base al caricamento
      setCurrentFilters({
        type: 'professionista',
        remoto: false,
      });
    }
  }, [loading]);

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
        setTeams(teamsData);
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

  // Filtra professionisti
  const filteredProfessionisti = professionisti.filter(p => {
    // Specializzazione - controlla sia il nome originale che quello normalizzato
    if (currentFilters.specializzazione) {
      const normalizedSpecs = p.profile.specializzazioni.map(spec => normalizeSpecialization(spec));
      if (!p.profile.specializzazioni.includes(currentFilters.specializzazione) &&
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

      // Se non ha posizioni nel raggio, escludi (a meno che non sia remoto)
      if (!hasLocationInRange) {
        // Se ha studi con remoto o non ha filtro remoto attivo, potrebbe essere incluso
        const hasRemoto = p.profile.studi?.some(s => s.remoto);
        if (!hasRemoto && !currentFilters.remoto) {
          return false;
        }
      }
    }

    // Remoto
    if (currentFilters.remoto) {
      const hasRemoto = p.profile.studi?.some(s => s.remoto);
      if (!hasRemoto) return false;
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
      // Se l'equipe non ha coordinate, mostrala solo se è remota o se il filtro remoto è attivo
      if (!t.coordinate) {
        if (!t.remoto && currentFilters.remoto === false) {
          return false;
        }
      } else {
        // L'equipe ha coordinate, calcola la distanza
        const distance = calculateDistance(
          currentFilters.coordinate.lat,
          currentFilters.coordinate.lng,
          t.coordinate.lat,
          t.coordinate.lng
        );

        // Se l'equipe non è nel raggio, escludi (a meno che non lavori anche da remoto)
        if (distance > currentFilters.raggioKm) {
          // Se l'equipe non è remota o non è richiesto remoto, escludi
          if (!t.remoto && !currentFilters.remoto) {
            return false;
          }
        }
      }
    }

    // Se il filtro remoto è attivo, mostra solo equipe remote
    if (currentFilters.remoto && !t.remoto) {
      return false;
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xl text-gray-600">Caricamento...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <VerificationBanner />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-0 pb-24 sm:pt-4 sm:pb-8">
        <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-3 sm:mb-8">
          {currentFilters.type === 'professionista' ? 'Cerca Professionisti' : 'Cerca equipe'}
        </h1>
        {!canInteract && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
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
          />
        </div>

        {/* Risultati */}
        {currentFilters.type === 'professionista' ? (
          // Lista Professionisti
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProfessionisti.length === 0 ? (
              <div className="col-span-full text-center py-12 text-gray-500">
                <div className="mb-4 text-6xl">?</div>
                <h3 className="text-xl font-semibold mb-2">Nessun professionista trovato</h3>
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
                <p className="text-xs text-gray-400 mt-4">
                  Suggerimento: Prova ad espandere il raggio di ricerca o rimuovere alcuni filtri
                </p>
              </div>
            ) : (
              filteredProfessionisti.map((p, index) => (
                <div key={p.uid} className="bg-white rounded-xl shadow-sm hover:shadow-md transition overflow-hidden">
                  <div className="p-6">
                    {/* Badge verifica documentazione */}
                    {p.profile.verificationInfo?.status !== 'approved' && (
                      <div className="mb-3 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
                        <svg className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <div className="flex-1">
                          <p className="text-xs font-medium text-yellow-800">
                            Documentazione in verifica
                          </p>
                          <p className="text-xs text-yellow-700 mt-0.5">
                            Profilo visibile ma non ancora validato
                          </p>
                        </div>
                      </div>
                    )}
                    {/* Avatar */}
                    <div className="flex justify-center mb-4">
                      {p.profile.photoURL ? (
                        <img
                          src={p.profile.photoURL}
                          alt={p.profile.nome}
                          className="w-20 h-20 rounded-full object-cover border-4 border-gray-200"
                          style={{ aspectRatio: '1/1' }}
                        />
                      ) : (
                        <div
                          className={`w-20 h-20 ${getAvatarColor(index)} rounded-full flex items-center justify-center text-gray-700 font-bold text-2xl`}
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
                      {[...new Set(p.profile.specializzazioni.map(spec => normalizeSpecialization(spec)))].slice(0, 2).map((spec, i) => (
                        <span key={i} className="inline-block px-3 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                          {spec}
                        </span>
                      ))}
                      {[...new Set(p.profile.specializzazioni.map(spec => normalizeSpecialization(spec)))].length > 2 && (
                        <span className="inline-block px-3 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
                          +{[...new Set(p.profile.specializzazioni.map(spec => normalizeSpecialization(spec)))].length - 2}
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
                                {studio.remoto && (
                                  <span className="text-green-600 text-xs">• Remoto</span>
                                )}
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
                      className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition"
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTeams.length === 0 ? (
              <div className="col-span-full text-center py-12 text-gray-500">
                Nessuna equipe trovata con posti disponibili
              </div>
            ) : (
              filteredTeams.map((team, index) => (
                <div key={team.teamId || team.id} className="bg-white rounded-xl shadow-sm hover:shadow-md transition overflow-hidden">
                  <div className="p-6">
                    {/* Avatar Team */}
                    <div className="flex justify-center mb-4">
                      {team.photoURL ? (
                        <img
                          src={team.photoURL}
                          alt={`Foto ${team.name}`}
                          className="w-20 h-20 rounded-full object-cover border-4 border-amber-200"
                          style={{ aspectRatio: '1/1' }}
                        />
                      ) : (
                        <div
                          className={`w-20 h-20 ${getAvatarColor(index)} rounded-full flex items-center justify-center text-gray-700 font-bold text-2xl`}
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
                    <div className="mb-4 border-t border-gray-200 pt-4">
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
                      className="w-full py-3 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 transition"
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
