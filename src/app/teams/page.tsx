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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">Le Mie Equipé</h1>
          <Link
            href="/teams/create"
            className="w-full sm:w-auto px-4 sm:px-6 py-3 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition shadow-sm text-center touch-friendly"
          >
            + Crea Nuova Equipé
          </Link>
        </div>

        {myTeams.length === 0 ? (
          <div className="bg-white p-6 sm:p-8 lg:p-12 rounded-lg shadow text-center">
            <h3 className="text-lg sm:text-xl font-semibold mb-4">Non fai parte di nessuna Equipé</h3>
            <p className="text-sm sm:text-base text-gray-600 mb-6">
              Crea la tua prima Equipé per iniziare a collaborare con altri professionisti
            </p>
            <Link
              href="/teams/create"
              className="inline-block w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 touch-friendly"
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
