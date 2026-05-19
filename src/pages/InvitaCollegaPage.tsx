import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

const SITE_URL = 'https://tuaequipe.it';

function decodeToken(token: string): string | null {
  try {
    const base64 = token.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(base64);
    return decoded.includes('@') ? decoded : null;
  } catch {
    return null;
  }
}

export default function InvitaCollegaPage() {
  const [searchParams] = useSearchParams();
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [referralUrl, setReferralUrl] = useState('');

  useEffect(() => {
    const token = searchParams.get('t');
    if (token) {
      const decoded = decodeToken(token);
      setEmail(decoded);
      setReferralUrl(`${SITE_URL}/?ref=${token}`);
    }
  }, [searchParams]);

  const handleCopy = () => {
    navigator.clipboard.writeText(referralUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const whatsappText = encodeURIComponent(
    `Ciao! Ti consiglio di iscriverti a tuaequipe.it — la piattaforma italiana per professionisti sanitari che collaborano tra loro. Puoi iscriverti alla waiting list qui: ${referralUrl}`
  );
  const emailSubject = encodeURIComponent('Ti invito su tuaequipe.it');
  const emailBody = encodeURIComponent(
    `Ciao,\n\nti segnalo tuaequipe.it, una piattaforma italiana per professionisti sanitari che vogliono costruire una rete professionale locale.\n\nIscriviti alla waiting list tramite questo link:\n${referralUrl}\n\nA presto!`
  );

  if (!referralUrl) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center max-w-md">
          <p className="text-gray-500 text-lg">Link non valido o scaduto.</p>
          <a href="/" className="mt-4 inline-block text-blue-600 hover:underline">
            Torna alla home →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg max-w-lg w-full p-8">
        {/* Logo */}
        <div className="text-center mb-6">
          <a href="/" className="inline-flex items-center gap-2 justify-center">
            <img src="/logo_senza_scritta.png" alt="" className="w-8 h-8" />
            <span className="text-2xl font-extrabold tracking-tight">
              <span className="text-blue-600">tua</span><span className="text-green-600">equipe</span><span className="text-orange-500">.it</span>
            </span>
          </a>
        </div>

        {/* Heading */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">👋</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Invita un collega
          </h1>
          <p className="text-gray-500 text-sm">
            Condividi il tuo link personale — quando un collega si iscrive tramite questo link, sei tu ad averlo portato nella rete.
          </p>
        </div>

        {/* Link box */}
        <div className="mb-6">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            Il tuo link personale
          </p>
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl p-3">
            <span className="flex-1 text-sm text-gray-700 font-mono break-all select-all">
              {referralUrl}
            </span>
            <button
              onClick={handleCopy}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                copied
                  ? 'bg-green-100 text-green-700'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {copied ? '✓ Copiato!' : 'Copia'}
            </button>
          </div>
        </div>

        {/* Share buttons */}
        <div className="space-y-3">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Condividi su
          </p>

          {/* WhatsApp */}
          <a
            href={`https://wa.me/?text=${whatsappText}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 w-full px-4 py-3 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl font-medium transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current shrink-0">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Condividi su WhatsApp
          </a>

          {/* Email */}
          <a
            href={`mailto:?subject=${emailSubject}&body=${emailBody}`}
            className="flex items-center gap-3 w-full px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl font-medium transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current shrink-0">
              <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
            </svg>
            Invia via email
          </a>

          {/* Telegram */}
          <a
            href={`https://t.me/share/url?url=${encodeURIComponent(referralUrl)}&text=${encodeURIComponent('Ti invito su tuaequipe.it — la piattaforma per professionisti sanitari 🏥')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 w-full px-4 py-3 bg-[#0088cc] hover:bg-[#0077b5] text-white rounded-xl font-medium transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current shrink-0">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
            </svg>
            Condividi su Telegram
          </a>
        </div>

        {/* Footer note */}
        {email && (
          <p className="text-center text-xs text-gray-400 mt-6">
            Link associato a {email}
          </p>
        )}
      </div>
    </div>
  );
}
