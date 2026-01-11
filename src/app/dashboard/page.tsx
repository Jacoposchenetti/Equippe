'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User, Team } from '@/types/equippe';
import Header from '@/components/Header';
import EnhancedSearch, { SearchFilters } from '@/components/EnhancedSearch';

export default function Dashboard() {
  const { user, userProfile } = useAuth();
  const router = useRouter();
  const [professionisti, setProfessionisti] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentFilters, setCurrentFilters] = useState<SearchFilters>({
    type: 'professionista',
    remoto: false,
  });

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    loadData();
  }, [user]);

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
          await user.getIdToken(true);
          console.log('🔄 Token refreshed');
        }
        
        const teamsRef = collection(db, 'teams');
        console.log('🔄 Caricamento teams...');
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
                  const memberDocRef = doc(db, 'users', member.userId);
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

  // Filtra professionisti
  const filteredProfessionisti = professionisti.filter(p => {
    // Specializzazione
    if (currentFilters.specializzazione && !p.profile.specializzazioni.includes(currentFilters.specializzazione)) {
      return false;
    }

    // Location - controlla tutti gli studi
    if (currentFilters.città || currentFilters.provincia) {
      const hasMatchingStudio = p.profile.studi?.some(studio => {
        if (currentFilters.città && studio.città !== currentFilters.città) return false;
        if (currentFilters.provincia && studio.provincia !== currentFilters.provincia) return false;
        return true;
      });

      // Se non ha studi, controlla location legacy
      if (!hasMatchingStudio) {
        if (currentFilters.città && p.profile.location?.città !== currentFilters.città) return false;
        if (currentFilters.provincia && p.profile.location?.provincia !== currentFilters.provincia) return false;
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
    // Solo equipé con posti disponibili (se hanno ruoliCercati)
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

    // Location - controlla il creatore del team
    // TODO: potremmo aggiungere location anche ai team se necessario

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

      <div className="max-w-7xl mx-auto px-6 py-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">
          {currentFilters.type === 'professionista' ? 'Cerca Professionisti' : 'Cerca Equipé'}
        </h1>

        {/* Enhanced Search */}
        <div className="mb-8">
          <EnhancedSearch onSearch={handleSearch} />
        </div>

        {/* Risultati */}
        {currentFilters.type === 'professionista' ? (
          // Lista Professionisti
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProfessionisti.length === 0 ? (
              <div className="col-span-full text-center py-12 text-gray-500">
                Nessun professionista trovato
              </div>
            ) : (
              filteredProfessionisti.map((p, index) => (
                <div key={p.uid} className="bg-white rounded-xl shadow-sm hover:shadow-md transition overflow-hidden">
                  <div className="p-6">
                    {/* Avatar */}
                    <div className="flex justify-center mb-4">
                      <div className={`w-20 h-20 ${getAvatarColor(index)} rounded-full flex items-center justify-center text-gray-700 font-bold text-2xl`}>
                        {getInitials(p.profile.nome)}
                      </div>
                    </div>

                    {/* Nome */}
                    <h3 className="text-center font-bold text-lg text-gray-900 mb-3">
                      Dr. {p.profile.nome}
                    </h3>

                    {/* Badge Specializzazione */}
                    <div className="flex justify-center mb-4">
                      <span className="inline-block px-3 py-1 text-sm font-medium bg-blue-100 text-blue-700 rounded-lg">
                        {p.profile.specializzazioni[0]}
                      </span>
                    </div>

                    {/* Studi/Location */}
                    <div className="text-center text-sm text-gray-500 mb-4">
                      {p.profile.studi && p.profile.studi.length > 0 ? (
                        <>
                          {p.profile.studi.map((studio, i) => (
                            <p key={i}>
                              {studio.città} ({studio.provincia})
                              {studio.remoto && ' - Remoto'}
                            </p>
                          ))}
                        </>
                      ) : (
                        <p>{p.profile.location?.città || 'Non specificato'}</p>
                      )}
                    </div>

                    {/* Button */}
                    <button 
                      onClick={() => router.push(`/profile/${p.uid}`)}
                      className="w-full py-3 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 transition"
                    >
                      Vedi Profilo
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          // Lista Equipé
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTeams.length === 0 ? (
              <div className="col-span-full text-center py-12 text-gray-500">
                Nessuna equipé trovata con posti disponibili
              </div>
            ) : (
              filteredTeams.map((team, index) => (
                <div key={team.teamId || team.id} className="bg-white rounded-xl shadow-sm hover:shadow-md transition overflow-hidden">
                  <div className="p-6">
                    {/* Avatar Team */}
                    <div className="flex justify-center mb-4">
                      <div className={`w-20 h-20 ${getAvatarColor(index)} rounded-full flex items-center justify-center text-gray-700 font-bold text-2xl`}>
                        {getInitials(team.name || 'Team')}
                      </div>
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
                          <span className="text-xs font-semibold text-gray-700">👥 Membri Attuali</span>
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
                            <span className="text-xs font-semibold text-orange-700">🔍 Cercano</span>
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
                                    {ruolo.numero - ruolo.occupati}
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

                    {/* Button */}
                    <button 
                      onClick={() => router.push(`/teams/${team.teamId || team.id}`)}
                      className="w-full py-3 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 transition"
                    >
                      Vedi Equipé
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
