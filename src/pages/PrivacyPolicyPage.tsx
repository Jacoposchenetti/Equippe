'use client';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-6">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3 sm:mb-8">Informativa Privacy</h1>
          
          <div className="prose prose-gray max-w-none">
            <p className="text-sm text-gray-600 mb-6">
              <strong>Ultimo aggiornamento:</strong> {new Date().toLocaleDateString('it-IT')}
            </p>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Titolare del Trattamento</h2>
              <p className="mb-4">
                <strong>tuaequipe.it</strong><br />
                Titolare del trattamento: persona fisica (dati completi su richiesta)<br />
                Email: <a href="mailto:legal@tuaequipe.it" className="text-blue-600 hover:underline">legal@tuaequipe.it</a>
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Dati Personali Trattati</h2>
              <h3 className="text-lg font-semibold mb-3">2.1 Dati Identificativi e Professionali</h3>
              <ul className="list-disc list-inside space-y-2 mb-4">
                <li>Nome, cognome, data di nascita</li>
                <li>Email e numero di telefono</li>
                <li>Specializzazioni professionali</li>
                <li>Numero di iscrizione all'albo professionale</li>
                <li>Foto profilo (facoltativa)</li>
                <li>Indirizzo e località di lavoro</li>
                <li>Disponibilità e orari</li>
              </ul>

              <h3 className="text-lg font-semibold mb-3">2.2 Dati di Utilizzo</h3>
              <ul className="list-disc list-inside space-y-2 mb-4">
                <li>Messaggi scambiati tra professionisti</li>
                <li>Partecipazione a equipe</li>
                <li>File condivisi (solo tra professionisti)</li>
                <li>Log di accesso e utilizzo della piattaforma</li>
              </ul>

              <h3 className="text-lg font-semibold mb-3">2.3 Dati Sanitari dei Pazienti (Sistema Referral)</h3>
              <p className="mb-3">
                Attraverso il sistema di referral clinico, i professionisti possono inserire dati relativi a pazienti 
                terzi, tra cui:
              </p>
              <ul className="list-disc list-inside space-y-2 mb-4">
                <li>Quesito clinico e informazioni diagnostiche</li>
                <li>Livello di urgenza clinica</li>
                <li>Dati identificativi del paziente (PHI — Protected Health Information)</li>
                <li>Allegati clinici</li>
              </ul>
              <p className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm mb-3">
                <strong>Protezione PHI:</strong> I dati sanitari dei pazienti sono cifrati lato client prima 
                dell'invio, tramite Web Crypto API (AES-GCM 256-bit). tuaequipe.it non ha accesso in chiaro 
                a tali dati. Solo il mittente e il destinatario del referral possono decifrarli.
              </p>
              <p className="text-sm text-gray-600">
                Il professionista che inserisce il referral agisce come <strong>titolare autonomo</strong> del trattamento 
                verso il proprio paziente, ed è responsabile di aver acquisito il consenso informato del paziente 
                prima dell'inserimento. tuaequipe.it agisce come <strong>responsabile del trattamento</strong> ai sensi 
                dell'art. 28 GDPR, fornendo l'infrastruttura tecnica per il trasferimento sicuro delle informazioni.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. Base Giuridica e Finalità</h2>
              
              <h3 className="text-lg font-semibold mb-3">3.1 Consenso (Art. 6.1.a GDPR)</h3>
              <ul className="list-disc list-inside space-y-2 mb-4">
                <li>Creazione e gestione del profilo professionale</li>
                <li>Comunicazioni di marketing (solo se consenso specifico)</li>
                <li>Foto profilo e contenuti pubblicati</li>
              </ul>

              <h3 className="text-lg font-semibold mb-3">3.2 Interesse Legittimo (Art. 6.1.f GDPR)</h3>
              <ul className="list-disc list-inside space-y-2 mb-4">
                <li>Networking tra professionisti qualificati</li>
                <li>Formazione di equipe multidisciplinari</li>
                <li>Miglioramento del servizio e sicurezza</li>
                <li>Prevenzione frodi e abusi</li>
              </ul>

              <h3 className="text-lg font-semibold mb-3">3.3 Finalità di Cura e Tutela della Salute (Art. 9.2.h GDPR)</h3>
              <p className="mb-3 text-sm text-gray-700">
                Il trattamento di dati sanitari di pazienti terzi attraverso il sistema referral avviene 
                esclusivamente per finalità di medicina preventiva, diagnosi, assistenza o terapia sanitaria, 
                ai sensi dell'art. 9, par. 2, lett. h) del GDPR e dell'art. 2-sexies del D.Lgs. 196/2003 
                (Codice Privacy italiano). Il trattamento è effettuato sotto la responsabilità professionale 
                del sanitario che inserisce il referral, soggetto al segreto professionale.
              </p>

              <h3 className="text-lg font-semibold mb-3">3.4 Obbligo Legale (Art. 6.1.c GDPR)</h3>
              <ul className="list-disc list-inside space-y-2">
                <li>Conservazione dati per obblighi fiscali</li>
                <li>Risposta a richieste autorità competenti</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Conservazione Dati</h2>
              <ul className="list-disc list-inside space-y-2">
                <li><strong>Account attivo:</strong> Per tutta la durata dell'utilizzo del servizio</li>
                <li><strong>Dopo cancellazione:</strong> 10 anni per obblighi legali e fiscali</li>
                <li><strong>Dati marketing:</strong> Fino a revoca del consenso</li>
                <li><strong>Log accessi:</strong> 24 mesi per sicurezza</li>
                <li><strong>Dati referral (PHI):</strong> Per tutta la durata del rapporto contrattuale con il professionista; eliminati entro 30 giorni dalla chiusura dell'account o su richiesta esplicita. I dati cifrati lato client non sono accessibili a tuaequipe.it in forma intellegibile.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Destinatari dei Dati</h2>
              <h3 className="text-lg font-semibold mb-3">5.1 Altri Professionisti</h3>
              <p className="mb-4">
                I dati del profilo sono visibili agli altri utenti registrati per facilitare 
                la formazione di equipe e la collaborazione professionale.
              </p>

              <h3 className="text-lg font-semibold mb-3">5.2 Fornitori di Servizi (Sub-Responsabili art. 28 GDPR)</h3>
              <ul className="list-disc list-inside space-y-2">
                <li><strong>Google Firebase / Google Cloud</strong> (hosting, database, autenticazione) — server region <code>europe-west1</code>, UE. DPA: <a href="https://cloud.google.com/terms/data-processing-addendum" className="text-blue-600 hover:underline" target="_blank" rel="noreferrer">Google Cloud DPA</a></li>
                <li><strong>Resend</strong> (invio email transazionali) — solo indirizzo email e contenuto notifica</li>
                <li><strong>Lemon Squeezy</strong> (gestione abbonamenti e pagamenti) — Lemon Squeezy agisce come <em>Merchant of Record</em>: è il venditore legale verso l'utente finale, emette le fatture e gestisce i pagamenti in autonomia. I dati trasmessi includono nome, email e importo dell'abbonamento. Privacy policy Lemon Squeezy: <a href="https://www.lemonsqueezy.com/privacy" className="text-blue-600 hover:underline" target="_blank" rel="noreferrer">lemonsqueezy.com/privacy</a></li>
                <li>Servizi di analitiche anonimizzate</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Trasferimenti Internazionali</h2>
              <p className="mb-4">
                I dati sono trattati esclusivamente su server localizzati nell'Unione Europea. 
                Non effettuiamo trasferimenti verso paesi terzi.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Diritti dell'Interessato</h2>
              <p className="mb-4">
                Ai sensi del GDPR, hai diritto di:
              </p>
              <ul className="list-disc list-inside space-y-2">
                <li><strong>Accesso:</strong> Ottenere copia dei tuoi dati</li>
                <li><strong>Rettifica:</strong> Correggere dati inesatti</li>
                <li><strong>Cancellazione:</strong> Richiedere la rimozione dei dati</li>
                <li><strong>Limitazione:</strong> Limitare il trattamento</li>
                <li><strong>Portabilità:</strong> Ricevere i dati in formato strutturato</li>
                <li><strong>Opposizione:</strong> Opporti al trattamento</li>
                <li><strong>Revoca consenso:</strong> Ritirare il consenso in qualsiasi momento</li>
              </ul>
              
              <p className="mt-4">
                Per esercitare i tuoi diritti: <a href="mailto:legal@tuaequipe.it" className="text-blue-600 hover:underline">legal@tuaequipe.it</a>
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Sicurezza</h2>
              <p className="mb-4">
                Implementiamo misure tecniche e organizzative appropriate per proteggere i dati:
              </p>
              <ul className="list-disc list-inside space-y-2">
                <li>Crittografia dei dati in transito e a riposo</li>
                <li>Autenticazione a due fattori</li>
                <li>Accesso limitato su base need-to-know</li>
                <li>Monitoraggio accessi e audit regolari</li>
                <li>Backup crittografati</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Data Protection Officer</h2>
              <p>
                Per questioni relative alla privacy puoi contattare il nostro DPO:<br />
                Email: <a href="mailto:admin@tuaequipe.it" className="text-blue-600 hover:underline">admin@tuaequipe.it</a>
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Reclami</h2>
              <p>
                Hai il diritto di presentare reclamo al Garante per la protezione dei dati personali:<br />
                <a href="https://www.gpdp.it" className="text-blue-600 hover:underline" target="_blank">
                  www.gpdp.it
                </a>
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Modifiche</h2>
              <p>
                L'Informativa può essere aggiornata. Le modifiche sostanziali saranno 
                comunicate con 30 giorni di preavviso.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
