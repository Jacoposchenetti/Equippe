'use client';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-6">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Informativa Privacy</h1>
          
          <div className="prose prose-gray max-w-none">
            <p className="text-sm text-gray-600 mb-6">
              <strong>Ultimo aggiornamento:</strong> {new Date().toLocaleDateString('it-IT')}
            </p>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Titolare del Trattamento</h2>
              <p className="mb-4">
                <strong>Equipé</strong><br />
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
                <li>Partecipazione a équipe</li>
                <li>File condivisi (solo tra professionisti)</li>
                <li>Log di accesso e utilizzo della piattaforma</li>
              </ul>

              <p className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm">
                <strong>Importante:</strong> Equipé NON tratta dati sanitari di pazienti. 
                È severamente vietato condividere informazioni sui pazienti attraverso la piattaforma.
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
                <li>Formazione di équipe multidisciplinari</li>
                <li>Miglioramento del servizio e sicurezza</li>
                <li>Prevenzione frodi e abusi</li>
              </ul>

              <h3 className="text-lg font-semibold mb-3">3.3 Obbligo Legale (Art. 6.1.c GDPR)</h3>
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
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Destinatari dei Dati</h2>
              <h3 className="text-lg font-semibold mb-3">5.1 Altri Professionisti</h3>
              <p className="mb-4">
                I dati del profilo sono visibili agli altri utenti registrati per facilitare 
                la formazione di équipe e la collaborazione professionale.
              </p>

              <h3 className="text-lg font-semibold mb-3">5.2 Fornitori di Servizi</h3>
              <ul className="list-disc list-inside space-y-2">
                <li>Google Firebase (hosting e database) - Server UE</li>
                <li>Provider email per comunicazioni di servizio</li>
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
