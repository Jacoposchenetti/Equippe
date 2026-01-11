'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, Timestamp, collection, getDocs, addDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Team, User } from '@/types/equippe';
import Link from 'next/link';
import Header from '@/components/Header';

export default function TeamDetailPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const teamId = params.id as string;
  
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    loadTeamData();
  }, [user, teamId]);

  const loadTeamData = async () => {
    try {
      // Carica team
      const teamDoc = await getDoc(doc(db, 'teams', teamId));
      if (!teamDoc.exists()) {
        router.push('/teams');
        return;
      }

      const teamData = { id: teamDoc.id, ...teamDoc.data() } as Team;
      setTeam(teamData);

      // Verifica se l'utente è admin
      const userMember = teamData.members.find(m => m.userId === user?.uid);
      setIsAdmin(userMember?.role === 'admin');

      // Carica dati membri
      const memberPromises = teamData.members.map(async (member) => {
        const userId = member.userId || member.uid;
        const userDoc = await getDoc(doc(db, 'users', userId));
        return { uid: userDoc.id, ...userDoc.data() } as User;
      });

      const membersData = await Promise.all(memberPromises);
      setMembers(membersData);

      // Carica utenti disponibili per invito
      const userIsAdmin = teamData.members.find(m => m.userId === user?.uid)?.role === 'admin';
      if (userIsAdmin) {
        const allUsersSnapshot = await getDocs(collection(db, 'users'));
        const allUsers = allUsersSnapshot.docs.map(doc => ({
          uid: doc.id,
          ...doc.data()
        } as User));
        
        // Filtra utenti non già membri (usa memberIds che è un array semplice)
        const available = allUsers.filter(u => 
          !teamData.memberIds?.includes(u.uid)
        );
        setAvailableUsers(available);
      }
    } catch (error) {
      console.error('Errore caricamento team:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm('Sei sicuro di voler rimuovere questo membro?')) return;

    try {
      const teamRef = doc(db, 'teams', teamId);
      const memberToRemove = team?.members.find(m => m.userId === userId);
      
      await updateDoc(teamRef, {
        members: arrayRemove(memberToRemove),
        memberIds: arrayRemove(userId),
        updatedAt: Timestamp.now(),
      });

      await loadTeamData();
    } catch (error) {
      console.error('Errore rimozione membro:', error);
      alert('Errore durante la rimozione del membro');
    }
  };

  const handleLeaveTeam = async () => {
    if (!isAdmin) {
      // Utente normale lascia il team
      if (!confirm('Sei sicuro di voler lasciare questa Equipé?')) return;

      try {
        const teamRef = doc(db, 'teams', teamId);
        const memberToRemove = team?.members.find(m => m.userId === user?.uid);
        
        await updateDoc(teamRef, {
          members: arrayRemove(memberToRemove),
          memberIds: arrayRemove(user?.uid),
          updatedAt: Timestamp.now(),
        });

        router.push('/teams');
      } catch (error) {
        console.error('Errore uscita dal team:', error);
        alert('Errore durante l\'uscita dal team');
      }
    } else {
      // Admin lascia il team - passa admin al secondo membro
      if (!confirm('Sei sicuro di voler lasciare questa Equipé? Il ruolo di admin passerà al prossimo membro.')) return;

      try {
        const teamRef = doc(db, 'teams', teamId);
        
        if (team && team.members.length > 1) {
          // Trova il secondo membro (non admin)
          const otherMembers = team.members.filter(m => m.userId !== user?.uid);
          
          if (otherMembers.length > 0) {
            // Promuovi il primo membro disponibile ad admin
            const newAdmin = otherMembers[0];
            const updatedNewAdmin = { ...newAdmin, role: 'admin' };
            
            // Rimuovi l'admin corrente e aggiorna il nuovo admin
            const memberToRemove = team.members.find(m => m.userId === user?.uid);
            const updatedMembers = team.members
              .filter(m => m.userId !== user?.uid)
              .map(m => m.userId === newAdmin.userId ? updatedNewAdmin : m);
            
            await updateDoc(teamRef, {
              members: updatedMembers,
              memberIds: arrayRemove(user?.uid),
              createdBy: newAdmin.userId, // Aggiorna anche il createdBy
              updatedAt: Timestamp.now(),
            });

            alert(`${otherMembers[0].userId} è ora l'admin dell'Equipé`);
          }
        } else {
          // Se è l'unico membro, elimina il team
          await deleteDoc(teamRef);
        }

        router.push('/teams');
      } catch (error) {
        console.error('Errore uscita dal team:', error);
        alert('Errore durante l\'uscita dal team');
      }
    }
  };

  const handleDeleteTeam = async () => {
    if (!confirm('⚠️ ATTENZIONE: Sei sicuro di voler eliminare definitivamente questa Equipé? Questa azione non può essere annullata.')) return;
    
    // Doppia conferma per sicurezza
    if (!confirm('Confermi l\'eliminazione? Tutti i dati del team saranno persi.')) return;

    try {
      // Elimina il team
      await deleteDoc(doc(db, 'teams', teamId));
      
      // TODO: Considera di eliminare anche gli inviti correlati
      // const invitesQuery = query(collection(db, 'teamInvites'), where('teamId', '==', teamId));
      // const invitesSnapshot = await getDocs(invitesQuery);
      // await Promise.all(invitesSnapshot.docs.map(doc => deleteDoc(doc.ref)));

      alert('Equipé eliminata con successo');
      router.push('/teams');
    } catch (error) {
      console.error('Errore eliminazione team:', error);
      alert('Errore durante l\'eliminazione del team');
    }
  };

  const handleInviteMembers = async () => {
    if (selectedUsers.length === 0) {
      alert('Seleziona almeno un utente da invitare');
      return;
    }

    try {
      // Crea inviti invece di aggiungere direttamente
      const invitePromises = selectedUsers.map(userId => 
        addDoc(collection(db, 'teamInvites'), {
          teamId,
          type: 'invite',
          fromUserId: user?.uid,
          toUserId: userId,
          status: 'pending',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        })
      );

      await Promise.all(invitePromises);

      setShowInviteModal(false);
      setSelectedUsers([]);
      alert(`Inviti inviati a ${selectedUsers.length} professionisti!`);
    } catch (error) {
      console.error('Errore invio inviti:', error);
      alert('Errore durante l\'invio degli inviti');
    }
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Caricamento...</div>
      </div>
    );
  }

  if (!team) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-5xl mx-auto px-6 py-8">
        <Link href="/teams" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6 font-medium">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Torna alle Equipé
        </Link>

        <div className="bg-white rounded-xl shadow-sm mb-6 overflow-hidden">
          <div className="p-8">
            <div className="flex justify-between items-start mb-6">
              <div className="flex-1">
                <h2 className="text-4xl font-bold text-gray-900 mb-3">{team.name}</h2>
                <p className="text-gray-600 text-lg">{team.description}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-4 py-2 rounded-lg font-medium ${
                  team.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                }`}>
                  {team.status === 'active' ? '✓ Attivo' : 'Inattivo'}
                </span>
                {isAdmin && (
                  <Link
                    href={`/teams/${teamId}/edit`}
                    className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition shadow-sm flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Modifica
                  </Link>
                )}
              </div>
            </div>

            <div className="border-t border-gray-200 pt-6">
              <span className="text-sm font-semibold text-gray-700 block mb-3">Specializzazioni del team:</span>
              <div className="flex flex-wrap gap-2">
                {team.specializations?.map((spec: string) => (
                  <span key={spec} className="bg-blue-100 text-blue-700 px-4 py-2 rounded-lg text-sm font-medium">
                    {spec}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Sezione Composizione Equipé */}
        {team.ruoliCercati && team.ruoliCercati.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm mb-6 overflow-hidden">
            <div className="px-8 py-6 border-b border-gray-200">
              <h3 className="text-2xl font-bold text-gray-900">Composizione Equipé</h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {team.ruoliCercati.map((ruolo, index) => {
                  const postiLiberi = ruolo.numero - ruolo.occupati;
                  const percentualeOccupazione = (ruolo.occupati / ruolo.numero) * 100;
                  
                  return (
                    <div key={index} className="border border-gray-200 rounded-lg p-5 hover:border-blue-300 transition">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-bold text-lg text-gray-900 mb-1">{ruolo.specializzazione}</h4>
                          <p className="text-sm text-gray-600">{ruolo.descrizione}</p>
                        </div>
                        {postiLiberi > 0 ? (
                          <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap">
                            🔍 {postiLiberi} {postiLiberi === 1 ? 'POSTO' : 'POSTI'} LIBERO
                          </span>
                        ) : (
                          <span className="bg-green-100 text-green-700 px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap">
                            ✓ COMPLETO
                          </span>
                        )}
                      </div>

                      {/* Barra di progresso */}
                      <div className="mb-3">
                        <div className="flex justify-between text-xs text-gray-600 mb-1">
                          <span>{ruolo.occupati} occupati</span>
                          <span>{ruolo.numero} totali</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all ${
                              percentualeOccupazione === 100 ? 'bg-green-500' : 'bg-blue-500'
                            }`}
                            style={{ width: `${percentualeOccupazione}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Icone membri */}
                      <div className="flex items-center gap-1">
                        {Array.from({ length: ruolo.numero }).map((_, i) => (
                          <div
                            key={i}
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                              i < ruolo.occupati
                                ? 'bg-green-500 text-white'
                                : 'bg-gray-200 text-gray-400 border-2 border-dashed border-gray-300'
                            }`}
                          >
                            {i < ruolo.occupati ? '✓' : '?'}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-8 py-6 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-2xl font-bold text-gray-900">Membri ({members.length})</h3>
            {isAdmin && (
              <button
                onClick={() => setShowInviteModal(true)}
                className="px-5 py-2.5 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition shadow-sm flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                Invita Membri
              </button>
            )}
          </div>
          <div className="p-6 space-y-4">
            {members.map((member) => {
              const memberInfo = team.members.find(m => m.userId === member.uid);
              const isCurrentUser = member.uid === user?.uid;

              return (
                <div key={member.uid} className="flex items-start justify-between p-5 border border-gray-200 rounded-xl hover:border-blue-200 hover:bg-blue-50/30 transition">
                  <div className="flex gap-4 flex-1">
                    <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                      {member.profile.nome.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-bold text-lg text-gray-900">{member.profile.nome}</h4>
                        {memberInfo?.role === 'admin' && (
                          <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-lg text-xs font-bold">
                            ADMIN
                          </span>
                        )}
                        {isCurrentUser && (
                          <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-lg text-xs font-bold">
                            TU
                          </span>
                        )}
                      </div>
                      <p className="text-gray-600 text-sm mb-3">{member.email}</p>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {member.profile.specializzazioni.map((spec) => (
                          <span key={spec} className="text-xs bg-gray-100 text-gray-700 px-3 py-1 rounded-lg font-medium">
                            {spec}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          {member.profile.location.città}
                        </span>
                        <span>•</span>
                        <span>{member.profile.esperienza}</span>
                      </div>
                    </div>
                  </div>

                  {isAdmin && !isCurrentUser && (
                    <button
                      onClick={() => handleRemoveMember(member.uid)}
                      className="ml-4 px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg font-medium transition"
                    >
                      Rimuovi
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {!isAdmin && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <button
              onClick={handleLeaveTeam}
              className="w-full px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition shadow-sm flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Lascia Equipé
            </button>
          </div>
        )}

        {showInviteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col">
              <div className="px-8 py-6 border-b border-gray-200">
                <h3 className="text-2xl font-bold text-gray-900">Invita Nuovi Membri</h3>
                <p className="text-sm text-gray-600 mt-1">Seleziona i professionisti da invitare al team</p>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6">
                {availableUsers.length === 0 ? (
                  <div className="text-center py-12">
                    <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <p className="text-gray-600 font-medium">Tutti i professionisti sono già membri</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {availableUsers.map((user) => (
                      <label key={user.uid} className="flex items-start p-4 hover:bg-blue-50 rounded-xl cursor-pointer border-2 border-gray-200 hover:border-blue-300 transition">
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(user.uid)}
                          onChange={() => toggleUserSelection(user.uid)}
                          className="mr-4 mt-1.5 w-5 h-5 text-blue-600 rounded"
                        />
                        <div className="flex-1">
                          <div className="font-bold text-gray-900">{user.profile.nome}</div>
                          <div className="text-sm text-gray-600 mb-2">{user.email}</div>
                          <div className="flex flex-wrap gap-1 mb-2">
                            {user.profile.specializzazioni.map(spec => (
                              <span key={spec} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded font-medium">
                                {spec}
                              </span>
                            ))}
                          </div>
                          <div className="text-xs text-gray-500 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            </svg>
                            {user.profile.location.città}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="px-8 py-6 border-t border-gray-200 flex gap-3">
                <button
                  onClick={handleInviteMembers}
                  disabled={selectedUsers.length === 0}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition shadow-sm"
                >
                  Invita {selectedUsers.length > 0 && `(${selectedUsers.length})`}
                </button>
                <button
                  onClick={() => {
                    setShowInviteModal(false);
                    setSelectedUsers([]);
                  }}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition"
                >
                  Annulla
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sezione Azioni Admin */}
        {isAdmin && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden mt-6">
            <div className="px-8 py-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">Gestione Equipé</h3>
              <p className="text-sm text-gray-600 mt-1">Azioni riservate all'amministratore</p>
            </div>
            <div className="p-6 space-y-4">
              {/* Lascia Equipé */}
              <div className="border border-orange-200 rounded-lg p-4 bg-orange-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-bold text-gray-900 mb-1">Lascia Equipé</h4>
                    <p className="text-sm text-gray-600">
                      Esci dall'equipé. {team.members.length > 1 ? 'Il ruolo di admin passerà al prossimo membro.' : 'Essendo l\'unico membro, l\'equipé verrà eliminata.'}
                    </p>
                  </div>
                  <button
                    onClick={handleLeaveTeam}
                    className="ml-4 px-5 py-2.5 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition shadow-sm whitespace-nowrap"
                  >
                    Lascia Equipé
                  </button>
                </div>
              </div>

              {/* Elimina Equipé */}
              <div className="border border-red-300 rounded-lg p-4 bg-red-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-bold text-red-900 mb-1">⚠️ Elimina Equipé</h4>
                    <p className="text-sm text-red-700">
                      Elimina definitivamente questa equipé. Questa azione è irreversibile e rimuoverà tutti i dati associati.
                    </p>
                  </div>
                  <button
                    onClick={handleDeleteTeam}
                    className="ml-4 px-5 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition shadow-sm whitespace-nowrap"
                  >
                    Elimina Equipé
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
