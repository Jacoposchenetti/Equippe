'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Team } from '@/types/equippe';
import Link from 'next/link';
import Header from '@/components/Header';

export default function TeamsPage() {
  const { user, userProfile } = useAuth();
  const router = useRouter();
  const [myTeams, setMyTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      router.push('/login');
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
      } as Team));

      setMyTeams(teams);
    } catch (error) {
      console.error('Errore caricamento team:', error);
    } finally {
      setLoading(false);
    }
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

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Le Mie Equipé</h1>
          <Link
            href="/teams/create"
            className="px-6 py-3 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition shadow-sm"
          >
            + Crea Nuova Equipé
          </Link>
        </div>

        {myTeams.length === 0 ? (
          <div className="bg-white p-12 rounded-lg shadow text-center">
            <h3 className="text-xl font-semibold mb-4">Non fai parte di nessuna Equipé</h3>
            <p className="text-gray-600 mb-6">
              Crea la tua prima Equipé per iniziare a collaborare con altri professionisti
            </p>
            <Link
              href="/teams/create"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Crea la tua Equipé
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {myTeams.map((team) => (
              <Link
                key={team.id}
                href={`/teams/${team.id}`}
                className="bg-white p-6 rounded-lg shadow hover:shadow-xl transition"
              >
                <h3 className="text-xl font-semibold mb-2">{team.name}</h3>
                <p className="text-gray-600 mb-4">{team.description}</p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">{team.members.length} membri</span>
                  <span className={`px-3 py-1 rounded ${
                    team.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {team.status === 'active' ? 'Attivo' : 'Inattivo'}
                  </span>
                </div>
                <div className="mt-4">
                  <span className="text-xs font-semibold text-gray-700">Specializzazioni:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {team.specializations?.map((spec: string) => (
                      <span key={spec} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        {spec}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
