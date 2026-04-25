import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { UserProfile, Availability } from '@/types/equippe';
import BookingWidget from '@/components/BookingWidget';

interface PublicUser {
  uid: string;
  displayName: string;
  profile: UserProfile;
}

export default function PublicProfilePage() {
  const { uid } = useParams<{ uid: string }>();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!uid) { setNotFound(true); setLoading(false); return; }
    loadProfile();
  }, [uid]);

  const loadProfile = async () => {
    try {
      const [userSnap, availSnap] = await Promise.all([
        getDoc(doc(db, 'users', uid!)),
        getDoc(doc(db, 'availability', uid!)),
      ]);
      if (!userSnap.exists()) { setNotFound(true); setLoading(false); return; }
      const data = userSnap.data();
      // Only show if profile is public
      if (availSnap.exists() && !(availSnap.data() as Availability).isPublic) {
        setNotFound(true); setLoading(false); return;
      }
      const nome = data.displayName ?? data.profile?.nome ?? 'Professionista';
      const professione = data.profile?.professioniConDocumenti?.[0]?.professione ?? data.profile?.albo ?? '';
      // SEO meta tags
      document.title = professione
        ? `${nome} - ${professione} | tuaequipe.it`
        : `${nome} | tuaequipe.it`;
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) {
        const desc = data.profile?.bio
          ? data.profile.bio.slice(0, 155)
          : `Prenota una visita con ${nome}${professione ? `, ${professione}` : ''} su tuaequipe.it.`;
        metaDesc.setAttribute('content', desc);
      }
      setUser({ uid: uid!, displayName: nome, profile: data.profile });
      if (availSnap.exists()) {
        setAvailability(availSnap.data() as Availability);
      }
    } catch (e) {
      console.error(e);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  // Reset title on unmount
  useEffect(() => {
    return () => {
      document.title = 'tuaequipe.it';
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Caricamento profilo...</div>
      </div>
    );
  }

  if (notFound || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center text-center p-8">
        <div className="text-6xl mb-4">🔍</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Profilo non trovato</h1>
        <p className="text-gray-600 mb-6">Questo profilo non esiste o non è pubblico.</p>
        <Link to="/" className="text-blue-600 hover:text-blue-800 underline text-sm">← Vai alla homepage</Link>
      </div>
    );
  }

  const { profile } = user;
  const professioniApproved = profile.professioniConDocumenti ?? [];
  const primaryProfession = professioniApproved[0]?.professione ?? profile.albo ?? '';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-200 py-3 px-4">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-blue-600 font-bold text-lg">TuaEquipe</span>
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-gray-600 text-sm">{user.displayName}</span>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT: Profile info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Card: header */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-start gap-4">
                {profile.photoURL ? (
                  <img src={profile.photoURL} alt={user.displayName}
                    className="w-20 h-20 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl font-bold text-blue-600">
                      {user.displayName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-2xl font-bold text-gray-900">{user.displayName}</h1>
                    {profile.verificationInfo?.status === 'approved' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Verificato
                      </span>
                    )}
                  </div>
                  {primaryProfession && (
                    <p className="text-blue-700 font-medium mt-1">{primaryProfession}</p>
                  )}
                  {profile.location?.città && (
                    <p className="text-gray-500 text-sm mt-0.5 flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {profile.location.città}{profile.location.provincia ? `, ${profile.location.provincia}` : ''}
                    </p>
                  )}
                  {/* External links */}
                  <div className="flex gap-3 mt-3 flex-wrap">
                    {profile.website && (
                      <a href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`}
                        target="_blank" rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        Sito web
                      </a>
                    )}
                    {profile.linkedin && (
                      <a href={profile.linkedin.startsWith('http') ? profile.linkedin : `https://${profile.linkedin}`}
                        target="_blank" rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                        LinkedIn
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {profile.bio && (
                <p className="text-gray-700 text-sm mt-4 leading-relaxed whitespace-pre-wrap">{profile.bio}</p>
              )}
            </div>

            {/* Card: Professioni e tematiche */}
            {professioniApproved.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Professioni e specializzazioni</h2>
                <div className="space-y-4">
                  {professioniApproved.map((prof, i) => (
                    <div key={i}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900">{prof.professione}</span>
                        {prof.anniEsperienza && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                            {prof.anniEsperienza} anni esp.
                          </span>
                        )}
                      </div>
                      {prof.tematiche && prof.tematiche.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {prof.tematiche.map(t => (
                            <span key={t} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full">{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Card: Dove riceve */}
            {availability?.sedi && availability.sedi.length > 0 ? (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Dove riceve</h2>
                <div className="space-y-3">
                  {availability.sedi.map(sede => (
                    <div key={sede.id} className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${sede.tipo === 'online' ? 'bg-purple-100' : 'bg-blue-100'}`}>
                        {sede.tipo === 'online' ? (
                          <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{sede.nome}</p>
                        {sede.tipo === 'presenziale' && sede.indirizzo && (
                          <p className="text-sm text-gray-500">{sede.indirizzo}</p>
                        )}
                        {sede.tipo === 'online' && (
                          <p className="text-sm text-gray-500">Visita online</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : availability?.locationVisita ? (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Dove riceve</h2>
                <div className="space-y-3">
                  {(availability.locationVisita.tipo === 'presenziale' || availability.locationVisita.tipo === 'entrambi') && (
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">In presenza</p>
                        {availability.locationVisita.indirizzo && (
                          <p className="text-sm text-gray-500">{availability.locationVisita.indirizzo}</p>
                        )}
                      </div>
                    </div>
                  )}
                  {(availability.locationVisita.tipo === 'online' || availability.locationVisita.tipo === 'entrambi') && (
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">Online</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : profile.studi && profile.studi.length > 0 ? (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Dove riceve</h2>
                <div className="space-y-3">
                  {profile.studi.map((studio, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm text-gray-700">{studio.indirizzo}, {studio.città} ({studio.provincia})</p>
                      </div>
                    </div>
                  ))}
                  {(profile.lavoraOnline ?? profile.studi.some(s => s.remoto)) && (
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm text-gray-700">Online</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {/* Card: Formazione */}
            {profile.formazione && profile.formazione.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Formazione</h2>
                <div className="space-y-3">
                  {profile.formazione.map((f) => (
                    <div key={f.id} className="flex items-start gap-3">
                      <div className="w-1 h-full bg-blue-200 rounded-full mt-1.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{f.titolo}</p>
                        <p className="text-gray-500 text-xs">{f.istituzione} · {f.annoConseguimento}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Card: Lingue */}
            {profile.lingue && profile.lingue.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">Lingue parlate</h2>
                <div className="flex flex-wrap gap-2">
                  {profile.lingue.map((l, i) => (
                    <span key={i} className="px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-sm">
                      {l.lingua} <span className="text-indigo-400">·</span> {l.livello}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Booking widget */}
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-6 space-y-4">
              {availability && availability.isPublic ? (
                <>
                  <div className="bg-blue-600 text-white rounded-xl p-4 text-center">
                    <p className="font-semibold">Prenota una visita</p>
                    <p className="text-blue-200 text-sm mt-0.5">Seleziona giorno e orario</p>
                  </div>
                  <BookingWidget
                    professionalUid={uid!}
                    professionalName={user.displayName}
                    availability={availability}
                  />
                </>
              ) : (
                <div className="bg-white rounded-xl shadow-sm p-6 text-center">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-600">Le prenotazioni online non sono al momento disponibili per questo professionista.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <footer className="border-t border-gray-200 mt-12 py-6 text-center text-sm text-gray-400">
        <Link to="https://tuaequipe.it" className="hover:text-gray-600">TuaEquipe.it</Link> — La rete dei professionisti della salute
      </footer>
    </div>
  );
}
