import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Team, User } from '@/types/equippe';
import { Link } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useCanInteract } from '@/hooks/useCanInteract';

export default function TeamsPage() {
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();
  const { canInteract, message } = useCanInteract();
  const [myTeams, setMyTeams] = useState<(Team & { id: string })[]>([]);
  const [teamMembers, setTeamMembers] = useState<Record<string, User[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    loadTeams();
  }, [user]);

  const loadTeams = async () => {
    try {
      if (!user) return;

      const teamsRef = collection(db, 'teams');
      const q = query(teamsRef, where('memberIds', 'array-contains', user.uid));
      const snapshot = await getDocs(q);

      const teams = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Team & { id: string }));

      setMyTeams(teams);

      // Carica i membri per ogni team
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
    } finally {
      setLoading(false);
    }
  };

  // Funzione per estrarre le specializzazioni uniche dai membri del team
  const getTeamSpecializations = (teamId: string) => {
    const members = teamMembers[teamId] || [];

    // Raccogli tutte le specializzazioni dei membri
    const allSpecializations = members.flatMap(member =>
      member.profile?.specializzazioni || []
    );

    // Rimuovi duplicati
    const uniqueSpecializations = [...new Set(allSpecializations)];

    // Converti da professionista a disciplina
    const disciplines = uniqueSpecializations.map(spec => {
      const professionistToDiscipine: Record<string, string> = {
        'Psicologo': 'Psicologia',
        'Psicoterapeuta': 'Psicoterapia',
        'Psichiatra': 'Psichiatria',
        'Nutrizionista': 'Nutrizione',
        'Dietologo': 'Dietetica',
        'Logopedista': 'Logopedia',
        'Neuropsicomotricista': 'Neuropsicomotricità'
      };
      return professionistToDiscipine[spec] || spec;
    }).filter((disc, index, arr) => arr.indexOf(disc) === index); // Rimuovi duplicati anche dopo conversione

    return disciplines;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Caricamento...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-0 pb-24 sm:pt-4 sm:pb-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-3 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">Le Mie equipe</h1>
          {canInteract ? (
            <Link
              to="/teams/create"
              className="w-full sm:w-auto px-4 sm:px-6 py-3 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition shadow-sm text-center touch-friendly"
            >
              + Crea Nuova equipe
            </Link>
          ) : (
            <div className="relative group">
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
                      const teamSpecializations = getTeamSpecializations(team.id);
                      return teamSpecializations.length > 0 ? (
                        teamSpecializations.map((spec) => (
                          <span key={spec} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                            {spec}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-gray-500 italic">
                          Nessuna specializzazione
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
