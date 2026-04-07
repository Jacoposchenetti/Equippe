import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, Timestamp, arrayUnion } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Team, User } from '@/types/equippe';
import { Link } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useCanInteract } from '@/hooks/useCanInteract';
import { notifyTeamInviteResponse } from '@/lib/notifications';
import { occupyPositions } from '@/lib/teamPositions';
import { useModal } from '@/contexts/ModalContext';

interface TeamInvite {
  id: string;
  teamId: string;
  type: 'invite' | 'request';
  fromUserId: string;
  toUserId: string;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  createdAt: any;
  updatedAt: any;
}

interface InviteWithData extends TeamInvite {
  team?: Team;
  fromUser?: User;
  toUser?: User;
}

export default function TeamsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast, showConfirm } = useModal();
  const { canInteract, message } = useCanInteract();

  // Teams state
  const [myTeams, setMyTeams] = useState<(Team & { id: string })[]>([]);
  const [teamMembers, setTeamMembers] = useState<Record<string, User[]>>({});

  // Invites state
  const [receivedInvites, setReceivedInvites] = useState<InviteWithData[]>([]);
  const [sentInvites, setSentInvites] = useState<InviteWithData[]>([]);
  const [inviteTab, setInviteTab] = useState<'received' | 'sent'>('received');
  const [inviteSort, setInviteSort] = useState<'desc' | 'asc'>('desc');

  // UI state
  const [activeTab, setActiveTab] = useState<'teams' | 'invites'>('teams');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    loadAll();
  }, [user]);

  const loadAll = async () => {
    await Promise.all([loadTeams(), loadInvites()]);
    setLoading(false);
  };

  const loadTeams = async () => {
    try {
      if (!user) return;

      const teamsRef = collection(db, 'teams');
      const q = query(teamsRef, where('memberIds', 'array-contains', user.uid));
      const snapshot = await getDocs(q);

      const teams = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      } as Team & { id: string }));

      setMyTeams(teams);

      const membersData: Record<string, User[]> = {};
      for (const team of teams) {
        if (team.memberIds && team.memberIds.length > 0) {
          const teamMembersList: User[] = [];
          for (const memberId of team.memberIds) {
            try {
              const memberDoc = await getDoc(doc(db, 'users', memberId));
              if (memberDoc.exists()) {
                teamMembersList.push({ uid: memberDoc.id, ...memberDoc.data() } as User);
              }
            } catch (error) {
              console.error(`Errore caricamento membro ${memberId}:`, error);
            }
          }
          membersData[team.id] = teamMembersList;
        }
      }
      setTeamMembers(membersData);
    } catch (error) {
      console.error('Errore caricamento team:', error);
    }
  };

  const loadInvites = async () => {
    try {
      if (!user) return;

      const receivedQuery = query(collection(db, 'teamInvites'), where('toUserId', '==', user.uid));
      const receivedSnapshot = await getDocs(receivedQuery);
      const received = await Promise.all(
        receivedSnapshot.docs.map(async (inviteDoc) => {
          const invite = { id: inviteDoc.id, ...inviteDoc.data() } as TeamInvite;
          const teamDoc = await getDoc(doc(db, 'teams', invite.teamId));
          const team = teamDoc.exists() ? { id: teamDoc.id, ...teamDoc.data() } as Team : undefined;
          const fromUserDoc = await getDoc(doc(db, 'users', invite.fromUserId));
          const fromUser = fromUserDoc.exists() ? { uid: fromUserDoc.id, ...fromUserDoc.data() } as User : undefined;
          return { ...invite, team, fromUser };
        })
      );
      setReceivedInvites(received.filter(inv => inv.status === 'pending'));

      const sentQuery = query(collection(db, 'teamInvites'), where('fromUserId', '==', user.uid));
      const sentSnapshot = await getDocs(sentQuery);
      const sent = await Promise.all(
        sentSnapshot.docs.map(async (inviteDoc) => {
          const invite = { id: inviteDoc.id, ...inviteDoc.data() } as TeamInvite;
          const teamDoc = await getDoc(doc(db, 'teams', invite.teamId));
          const team = teamDoc.exists() ? { id: teamDoc.id, ...teamDoc.data() } as Team : undefined;
          const toUserDoc = await getDoc(doc(db, 'users', invite.toUserId));
          const toUser = toUserDoc.exists() ? { uid: toUserDoc.id, ...toUserDoc.data() } as User : undefined;
          return { ...invite, team, toUser };
        })
      );
      setSentInvites(sent);
    } catch (error) {
      console.error('Errore caricamento inviti:', error);
    }
  };

  const handleAcceptInvite = async (invite: InviteWithData) => {
    try {
      await updateDoc(doc(db, 'teamInvites', invite.id), {
        status: 'accepted',
        respondedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      const teamRef = doc(db, 'teams', invite.teamId);
      await updateDoc(teamRef, {
        members: arrayUnion({ userId: user?.uid, role: 'member', joinedAt: Timestamp.now() }),
        memberIds: arrayUnion(user?.uid),
        updatedAt: Timestamp.now(),
      });
      if (invite.fromUserId && invite.team?.name && user) {
        const userName = user.displayName || user.email || 'Un utente';
        await notifyTeamInviteResponse(invite.fromUserId, userName, invite.team.name, true, invite.id, user.uid);
      }
      if (user?.uid) await occupyPositions(invite.teamId, user.uid);
      showToast('Invito accettato! Ora fai parte dell\'equipe', 'success');
      await loadInvites();
      await loadTeams();
    } catch (error) {
      console.error('Errore accettazione invito:', error);
      showToast('Errore durante l\'accettazione dell\'invito', 'error');
    }
  };

  const handleRejectInvite = async (invite: InviteWithData) => {
    const confirmed = await showConfirm({
      title: 'Rifiuta invito',
      message: 'Sei sicuro di voler rifiutare questo invito?',
      variant: 'danger',
      confirmText: 'Rifiuta',
    });
    if (!confirmed) return;
    try {
      await updateDoc(doc(db, 'teamInvites', invite.id), {
        status: 'rejected',
        respondedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      if (invite.fromUserId && invite.team?.name && user) {
        const userName = user.displayName || user.email || 'Un utente';
        await notifyTeamInviteResponse(invite.fromUserId, userName, invite.team.name, false, invite.id, user.uid);
      }
      showToast('Invito rifiutato', 'success');
      await loadInvites();
    } catch (error) {
      console.error('Errore rifiuto invito:', error);
      showToast('Errore durante il rifiuto dell\'invito', 'error');
    }
  };

  const handleCancelInvite = async (invite: InviteWithData) => {
    const confirmed = await showConfirm({
      title: 'Annulla invito',
      message: 'Sei sicuro di voler annullare questo invito?',
      variant: 'warning',
      confirmText: 'Annulla invito',
    });
    if (!confirmed) return;
    try {
      await updateDoc(doc(db, 'teamInvites', invite.id), {
        status: 'cancelled',
        updatedAt: Timestamp.now(),
      });
      showToast('Invito annullato con successo', 'success');
      await loadInvites();
    } catch (error) {
      console.error('Errore annullamento invito:', error);
      showToast('Errore durante l\'annullamento dell\'invito', 'error');
    }
  };

  const getTeamSpecializations = (teamId: string) => {
    const members = teamMembers[teamId] || [];
    const allSpecializations = members.flatMap(member => member.profile?.specializzazioni || []);
    const uniqueSpecializations = [...new Set(allSpecializations)];
    const professionistToDiscipine: Record<string, string> = {
      'Psicologo': 'Psicologia', 'Psicoterapeuta': 'Psicoterapia', 'Psichiatra': 'Psichiatria',
      'Nutrizionista': 'Nutrizione', 'Dietologo': 'Dietetica', 'Logopedista': 'Logopedia',
      'Neuropsicomotricista': 'Neuropsicomotricità'
    };
    return [...new Set(uniqueSpecializations.map(spec => professionistToDiscipine[spec] || spec))];
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Caricamento...</div>
      </div>
    );
  }

  const displayInvites = [...(inviteTab === 'received' ? receivedInvites : sentInvites)].sort((a, b) => {
    const tA = a.createdAt?.toDate?.().getTime() ?? 0;
    const tB = b.createdAt?.toDate?.().getTime() ?? 0;
    return inviteSort === 'desc' ? tB - tA : tA - tB;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-0 pb-24 sm:pt-4 sm:pb-8">

        {/* Header con titolo e toggle */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">Equipe</h1>

          {/* Toggle Le mie equipe / Inviti */}
          <div className="flex rounded-lg overflow-hidden border border-gray-300 self-start sm:self-auto">
            <button
              onClick={() => setActiveTab('teams')}
              className={`px-5 py-2.5 text-sm font-medium transition ${
                activeTab === 'teams'
                  ? 'bg-amber-500 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              Le mie equipe
            </button>
            <button
              onClick={() => setActiveTab('invites')}
              className={`px-5 py-2.5 text-sm font-medium transition flex items-center gap-2 ${
                activeTab === 'invites'
                  ? 'bg-amber-500 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              Inviti
              {receivedInvites.length > 0 && (
                <span className={`px-1.5 py-0.5 text-xs font-bold rounded-full ${
                  activeTab === 'invites' ? 'bg-white text-amber-600' : 'bg-red-500 text-white'
                }`}>
                  {receivedInvites.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ===== TAB: LE MIE EQUIPE ===== */}
        {activeTab === 'teams' && (
          <>
            <div className="flex justify-end mb-6">
              {canInteract ? (
                <Link
                  to="/teams/create"
                  className="w-full sm:w-auto px-4 sm:px-6 py-3 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition shadow-sm text-center touch-friendly"
                >
                  + Crea Nuova equipe
                </Link>
              ) : (
                <div className="relative group w-full sm:w-auto">
                  <button
                    disabled
                    className="w-full sm:w-auto px-4 sm:px-6 py-3 bg-gray-300 text-gray-500 rounded-lg font-medium cursor-not-allowed shadow-sm text-center touch-friendly opacity-60"
                    title={message || 'Funzionalità non disponibile'}
                  >
                    + Crea Nuova equipe
                  </button>
                  <div className="hidden group-hover:block absolute z-10 w-64 p-2 mt-2 text-sm bg-gray-800 text-white rounded-lg shadow-lg right-0">
                    {message}
                  </div>
                </div>
              )}
            </div>

            {myTeams.length === 0 ? (
              <div className="bg-white p-6 sm:p-8 lg:p-12 rounded-lg shadow text-center">
                <h3 className="text-lg sm:text-xl font-semibold mb-4">Non fai parte di nessuna equipe</h3>
                <p className="text-sm sm:text-base text-gray-600 mb-6">
                  Crea la tua prima equipe per iniziare a collaborare con altri professionisti
                </p>
                {canInteract ? (
                  <Link
                    to="/teams/create"
                    className="inline-block w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 touch-friendly"
                  >
                    Crea la tua equipe
                  </Link>
                ) : (
                  <div className="inline-block">
                    <button
                      disabled
                      className="w-full sm:w-auto px-6 py-3 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed opacity-60"
                      title={message || 'Funzionalità non disponibile'}
                    >
                      Crea la tua equipe
                    </button>
                    <p className="text-sm text-gray-500 mt-3">{message}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {myTeams.map((team) => (
                  <Link
                    key={team.id}
                    to={`/teams/${team.id}`}
                    className="bg-white p-6 rounded-lg shadow hover:shadow-xl transition"
                  >
                    <div className="flex items-start gap-4 mb-4">
                      {team.photoURL ? (
                        <img
                          src={team.photoURL}
                          alt={`Foto ${team.name}`}
                          className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                          <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h3 className="text-xl font-semibold mb-2">{team.name}</h3>
                        <p className="text-gray-600 mb-4">{team.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">{team.members.length} membri</span>
                    </div>
                    <div className="mt-4">
                      <span className="text-xs font-semibold text-gray-700">Specializzazioni del team:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(() => {
                          const specs = getTeamSpecializations(team.id);
                          return specs.length > 0 ? (
                            specs.map((spec) => (
                              <span key={spec} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                {spec}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-gray-500 italic">Nessuna specializzazione</span>
                          );
                        })()}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}

        {/* ===== TAB: INVITI ===== */}
        {activeTab === 'invites' && (
          <>
            {/* Sub-tab ricevuti / inviati */}
            <div className="bg-white rounded-xl shadow-sm mb-6">
              <div className="flex items-center border-b border-gray-200">
                <button
                  onClick={() => setInviteTab('received')}
                  className={`flex-1 px-6 py-4 font-medium transition relative ${
                    inviteTab === 'received'
                      ? 'text-amber-600 border-b-2 border-amber-500'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Ricevuti
                  {receivedInvites.length > 0 && (
                    <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                      {receivedInvites.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setInviteTab('sent')}
                  className={`flex-1 px-6 py-4 font-medium transition ${
                    inviteTab === 'sent'
                      ? 'text-amber-600 border-b-2 border-amber-500'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Inviati
                  {sentInvites.length > 0 && (
                    <span className="ml-2 px-2 py-0.5 bg-gray-300 text-gray-700 text-xs font-bold rounded-full">
                      {sentInvites.length}
                    </span>
                  )}
                </button>
                {/* Ordina per data */}
                <button
                  onClick={() => setInviteSort(s => s === 'desc' ? 'asc' : 'desc')}
                  className="ml-auto mr-3 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition whitespace-nowrap flex-shrink-0"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" /></svg>
                  {inviteSort === 'desc' ? 'Più recente' : 'Meno recente'}
                </button>
              </div>
            </div>

            {displayInvites.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm p-16 text-center">
                <div className="max-w-md mx-auto">
                  <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" />
                  </svg>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {inviteTab === 'received' ? 'Nessun invito ricevuto' : 'Nessun invito inviato'}
                  </h3>
                  <p className="text-gray-600">
                    {inviteTab === 'received'
                      ? 'Quando riceverai inviti a unirsi a un\'equipe, appariranno qui'
                      : 'Gli inviti che invii ai professionisti appariranno qui'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {displayInvites.map((invite) => (
                  <div key={invite.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <div className="p-6">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          {inviteTab === 'received' ? (
                            <>
                              <h3 className="text-xl font-bold text-gray-900 mb-2">
                                Invito a unirsi a: {invite.team?.name || 'Caricamento...'}
                              </h3>
                              <p className="text-gray-600 mb-3">
                                Da: <span className="font-medium">{invite.fromUser?.profile.nome || 'Caricamento...'}</span>
                              </p>
                              {invite.team && (
                                <div className="mb-4">
                                  <p className="text-sm text-gray-700 mb-2">{invite.team.description}</p>
                                  <div className="flex flex-wrap gap-2">
                                    {invite.team.specializations?.map((spec: string) => (
                                      <span key={spec} className="bg-blue-100 text-blue-700 px-3 py-1 rounded-lg text-sm font-medium">
                                        {spec}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </>
                          ) : (
                            <>
                              <h3 className="text-xl font-bold text-gray-900 mb-2">
                                Invito a: {invite.toUser?.profile.nome || 'Caricamento...'}
                              </h3>
                              <p className="text-gray-600 mb-3">
                                Per unirsi a: <span className="font-medium">{invite.team?.name || 'Caricamento...'}</span>
                              </p>
                              <span className={`inline-block px-3 py-1 rounded-lg text-sm font-medium ${
                                invite.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                                invite.status === 'accepted' ? 'bg-green-100 text-green-700' :
                                invite.status === 'cancelled' ? 'bg-gray-100 text-gray-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                {invite.status === 'pending' ? 'In attesa' :
                                 invite.status === 'accepted' ? 'Accettato' :
                                 invite.status === 'cancelled' ? 'Annullato' : 'Rifiutato'}
                              </span>
                            </>
                          )}
                          <p className="text-xs text-gray-500 mt-3 flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Inviato il {invite.createdAt?.toDate?.().toLocaleDateString('it-IT') || 'N/A'}
                          </p>
                        </div>

                        {inviteTab === 'received' && invite.status === 'pending' && (
                          <div className="flex gap-2 ml-4">
                            <button
                              onClick={() => handleAcceptInvite(invite)}
                              className="px-5 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition shadow-sm flex items-center gap-2"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Accetta
                            </button>
                            <button
                              onClick={() => handleRejectInvite(invite)}
                              className="px-5 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition shadow-sm flex items-center gap-2"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              Rifiuta
                            </button>
                          </div>
                        )}

                        {inviteTab === 'sent' && invite.status === 'pending' && (
                          <div className="flex gap-2 ml-4">
                            <button
                              onClick={() => handleCancelInvite(invite)}
                              className="px-5 py-2.5 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition shadow-sm flex items-center gap-2"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              Annulla Invito
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

      </div>
      <Footer />
    </div>
  );
}
