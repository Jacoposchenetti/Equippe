import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';

const STEPS = [
  { key: 'foto',       label: 'Foto profilo',           points: 25, hash: 'sezione-foto'      },
  { key: 'bio',        label: 'Bio',                    points: 27, hash: 'sezione-bio'       },
  { key: 'nascita',    label: 'Data di nascita',        points: 8,  hash: 'sezione-nascita'   },
  { key: 'tematiche',  label: 'Tematiche d\'interesse', points: 22, hash: 'sezione-tematiche' },
  { key: 'curriculum', label: 'Curriculum',             points: 18, hash: 'sezione-curriculum'},
];

export default function ProfileCompletionBanner() {
  const { userProfile } = useAuth();

  if (!userProfile) return null;

  const profile = userProfile.profile;

  const rawProfessions = profile?.professioniConDocumenti || profile?.professioniPending || [];
  const professions: any[] = Array.isArray(rawProfessions) ? rawProfessions : Object.values(rawProfessions);

  const completed: Record<string, boolean> = {
    foto:       !!(profile?.photoURL),
    bio:        !!(profile?.bio?.trim()),
    nascita:    !!(profile?.dataNascita),
    tematiche:  professions.some((p: any) => p.tematiche?.length > 0),
    curriculum: !!(profile?.esperienze?.length > 0 || profile?.formazione?.length > 0 || profile?.certificazioni?.length > 0),
  };

  const totalPoints = STEPS.reduce((sum, s) => sum + (completed[s.key] ? s.points : 0), 0);

  // Nascondi il banner solo quando si raggiungono 100 punti
  if (totalPoints >= 100) return null;

  const barColor = totalPoints >= 75 ? 'bg-green-500' : totalPoints >= 40 ? 'bg-teal-500' : 'bg-orange-400';

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">

          {/* Left: progress */}
          <div className="flex-1">
            <h3 className="text-base font-semibold text-gray-900 mb-1">
              Livello di completezza del profilo
            </h3>

            {/* Bar */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                  style={{ width: `${totalPoints}%` }}
                />
              </div>
              <span className="text-sm font-bold text-gray-700 whitespace-nowrap">
                {totalPoints} / 100 punti
              </span>
            </div>

            {/* Steps */}
            <p className="text-xs text-gray-500 mb-3">Aggiungi le informazioni mancanti</p>
            <div className="flex flex-wrap gap-2">
              {STEPS.filter(s => !completed[s.key]).map(s => (
                <Link
                  key={s.key}
                  to={`/profile/edit#${s.hash}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-full text-xs text-gray-700 hover:border-teal-500 hover:text-teal-700 transition-colors"
                >
                  <span className="w-4 h-4 rounded-full border-2 border-dashed border-gray-400 inline-block" />
                  {s.label} (+{s.points})
                  <span className="text-gray-400">Aggiungi</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Right: CTA */}
          <div className="flex-shrink-0">
            <Link
              to="/profile/edit"
              className="inline-flex items-center justify-center px-6 py-2.5 bg-teal-600 text-white rounded-full font-medium hover:bg-teal-700 transition-colors text-sm"
            >
              Completa il profilo
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

