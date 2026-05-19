'use client';

export default function CookiePolicy() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-6">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Cookie Policy</h1>
          
          <div className="prose prose-gray max-w-none">
            <p className="text-sm text-gray-600 mb-6">
              <strong>Ultimo aggiornamento:</strong> {new Date().toLocaleDateString('it-IT')}
            </p>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Cosa sono i Cookie</h2>
              <p className="mb-4">
                I cookie sono piccoli file di testo che i siti web inviano al tuo dispositivo per 
                riconoscerlo nelle visite successive e migliorare l'esperienza di navigazione.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Cookie Utilizzati da tuaequipe.it</h2>
              
              <h3 className="text-lg font-semibold mb-3">2.1 Cookie Tecnici (Sempre Attivi)</h3>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <p className="mb-2">
                  <strong>Questi cookie sono necessari per il funzionamento del sito e non richiedono consenso.</strong>
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li><strong>Autenticazione:</strong> Mantengono il login attivo</li>
                  <li><strong>Sessione:</strong> Gestiscono la navigazione tra le pagine</li>
                  <li><strong>Sicurezza:</strong> Proteggono da attacchi CSRF</li>
                  <li><strong>Preferenze UI:</strong> Ricordano impostazioni interfaccia</li>
                </ul>
              </div>

              <h3 className="text-lg font-semibold mb-3">2.2 Cookie di Prestazioni (Con Consenso)</h3>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="mb-2">
                  <strong>Questi cookie ci aiutano a migliorare il servizio analizzando l'utilizzo.</strong>
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li><strong>Google Analytics:</strong> Statistiche anonime di utilizzo</li>
                  <li><strong>Prestazioni:</strong> Tempi di caricamento e errori</li>
                  <li><strong>Funzionalità:</strong> Quali sezioni sono più utilizzate</li>
                </ul>
              </div>

              <h3 className="text-lg font-semibold mb-3">2.3 Cookie NON Utilizzati</h3>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-sm">
                  <strong>tuaequipe.it NON utilizza:</strong>
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Cookie di profilazione per pubblicità</li>
                  <li>Cookie di terze parti per marketing</li>
                  <li>Tracciamento comportamentale</li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. Durata dei Cookie</h2>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300 text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-4 py-2 text-left">Cookie</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">Scopo</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">Durata</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-gray-300 px-4 py-2">auth-session</td>
                      <td className="border border-gray-300 px-4 py-2">Autenticazione</td>
                      <td className="border border-gray-300 px-4 py-2">30 giorni</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 px-4 py-2">csrf-token</td>
                      <td className="border border-gray-300 px-4 py-2">Sicurezza</td>
                      <td className="border border-gray-300 px-4 py-2">Sessione</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 px-4 py-2">ui-preferences</td>
                      <td className="border border-gray-300 px-4 py-2">Impostazioni interfaccia</td>
                      <td className="border border-gray-300 px-4 py-2">1 anno</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 px-4 py-2">_ga</td>
                      <td className="border border-gray-300 px-4 py-2">Google Analytics</td>
                      <td className="border border-gray-300 px-4 py-2">2 anni</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Gestione dei Cookie</h2>
              
              <h3 className="text-lg font-semibold mb-3">4.1 Impostazioni tuaequipe.it</h3>
              <p className="mb-4">
                Puoi gestire i tuoi consensi sui cookie accedendo alle impostazioni del tuo profilo 
                nella sezione "Privacy e Cookie".
              </p>

              <h3 className="text-lg font-semibold mb-3">4.2 Impostazioni Browser</h3>
              <p className="mb-4">
                Puoi anche gestire i cookie direttamente dalle impostazioni del tuo browser:
              </p>
              <ul className="list-disc list-inside space-y-2">
                <li>
                  <strong>Chrome:</strong> Impostazioni → Privacy e sicurezza → Cookie
                </li>
                <li>
                  <strong>Firefox:</strong> Impostazioni → Privacy e sicurezza → Cookie e dati dei siti web
                </li>
                <li>
                  <strong>Safari:</strong> Preferenze → Privacy → Gestisci dati siti web
                </li>
                <li>
                  <strong>Edge:</strong> Impostazioni → Cookie e autorizzazioni sito
                </li>
              </ul>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-4">
                <p className="text-sm">
                  <strong>Attenzione:</strong> Disabilitare i cookie tecnici può compromettere 
                  il corretto funzionamento della piattaforma.
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Cookie di Terze Parti</h2>
              
              <h3 className="text-lg font-semibold mb-3">5.1 Google Analytics</h3>
              <p className="mb-4">
                Utilizziamo Google Analytics per raccogliere statistiche anonime sull'uso del sito. 
                Google può utilizzare questi dati secondo la propria privacy policy.
              </p>
              <ul className="list-disc list-inside space-y-2">
                <li>
                  Privacy Policy Google: <a href="https://policies.google.com/privacy" className="text-blue-600 hover:underline" target="_blank">
                    policies.google.com/privacy
                  </a>
                </li>
                <li>
                  Opt-out Google Analytics: <a href="https://tools.google.com/dlpage/gaoptout" className="text-blue-600 hover:underline" target="_blank">
                    tools.google.com/dlpage/gaoptout
                  </a>
                </li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Aggiornamenti</h2>
              <p className="mb-4">
                Questa Cookie Policy può essere aggiornata per riflettere cambiamenti nelle 
                nostre pratiche o per motivi normativi. Ti informeremo di modifiche sostanziali.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Contatti</h2>
              <p>
                Per domande sui cookie o sulla privacy: <br />
                Email: <a href="mailto:legal@tuaequipe.it" className="text-blue-600 hover:underline">legal@tuaequipe.it</a>
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
