import { Link } from 'react-router-dom';

interface ProfessionalCardProps {
  uid: string;
  nome: string;
  photoURL?: string;
  professione: string;
  città?: string;
  remoto: boolean;
  presenziale: boolean;
  tematiche?: string[];
  verified?: boolean;
}

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-green-500', 'bg-purple-500',
  'bg-orange-500', 'bg-pink-500', 'bg-teal-500',
];

export default function ProfessionalCard({
  uid, nome, photoURL, professione, città, remoto, presenziale, tematiche, verified,
}: ProfessionalCardProps) {
  const initials = nome.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const color = AVATAR_COLORS[nome.charCodeAt(0) % AVATAR_COLORS.length];

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col gap-3">
      {/* Header: avatar + name + profession */}
      <div className="flex items-start gap-3">
        {photoURL ? (
          <img
            src={photoURL}
            alt={nome}
            className="w-14 h-14 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0 ${color}`}>
            {initials}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-gray-900 text-base leading-tight truncate">{nome}</h3>
            {verified && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5 flex-shrink-0">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Verificato
              </span>
            )}
          </div>
          <p className="text-blue-600 text-sm font-medium mt-0.5">{professione}</p>
        </div>
      </div>

      {/* Location + modality */}
      <div className="flex items-center gap-2 flex-wrap">
        {città && (
          <span className="flex items-center gap-1 text-sm text-gray-600">
            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {città}
          </span>
        )}
        {remoto && (
          <span className="text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full px-2 py-0.5">
            Online
          </span>
        )}
        {presenziale && (
          <span className="text-xs font-medium bg-gray-50 text-gray-600 border border-gray-200 rounded-full px-2 py-0.5">
            In presenza
          </span>
        )}
      </div>

      {/* Tematiche */}
      {tematiche && tematiche.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tematiche.slice(0, 3).map(t => (
            <span key={t} className="text-xs bg-gray-100 text-gray-600 rounded-full px-2.5 py-0.5">{t}</span>
          ))}
          {tematiche.length > 3 && (
            <span className="text-xs text-gray-400 self-center">+{tematiche.length - 3}</span>
          )}
        </div>
      )}

      {/* CTA */}
      <Link
        to={`/p/${uid}`}
        className="mt-auto block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm py-2.5 rounded-lg transition-colors"
      >
        Prenota una visita
      </Link>
    </div>
  );
}
