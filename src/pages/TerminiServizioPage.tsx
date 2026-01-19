'use client';

export default function TerminiServizio() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-6">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Termini e Condizioni di Servizio</h1>
          
          <div className="prose prose-gray max-w-none">
            <p className="text-sm text-gray-600 mb-6">
              <strong>Ultimo aggiornamento:</strong> {new Date().toLocaleDateString('it-IT')}
            </p>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Oggetto del Servizio</h2>
              <p className="mb-4">
                Equipé è una piattaforma digitale che facilita la connessione e collaborazione tra professionisti 
                sociosanitari per la formazione di équipe multidisciplinari. Il servizio NON include il trattamento 
                diretto di pazienti attraverso la piattaforma.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Definizioni</h2>
              <ul className="list-disc list-inside space-y-2">
                <li><strong>Piattaforma:</strong> Il sito web e l'applicazione Equipé</li>
                <li><strong>Utente:</strong> Professionista sociosanitario registrato</li>
                <li><strong>Équipe:</strong> Gruppo di professionisti collaboranti</li>
                <li><strong>Referral:</strong> Segnalazione professionale tra utenti</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. Requisiti di Accesso</h2>
              <p className="mb-4">
                L'accesso al servizio è riservato esclusivamente a:
              </p>
              <ul className="list-disc list-inside space-y-2">
                <li>Professionisti regolarmente iscritti agli Albi professionali competenti</li>
                <li>Operatori sanitari autorizzati secondo la normativa italiana</li>
                <li>Professionisti con abilitazione all'esercizio della professione</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Obblighi dell'Utente</h2>
              <ul className="list-disc list-inside space-y-2">
                <li>Fornire informazioni veritiere e aggiornate</li>
                <li>Mantenere la riservatezza delle credenziali di accesso</li>
                <li>Rispettare il Codice Deontologico della propria professione</li>
                <li>Non utilizzare la piattaforma per finalità illecite</li>
                <li>Rispettare la privacy e dignità degli altri professionisti</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Contenuti e Responsabilità</h2>
              <p className="mb-4">
                L'Utente è esclusivamente responsabile dei contenuti che pubblica. È vietato:
              </p>
              <ul className="list-disc list-inside space-y-2">
                <li>Condividere informazioni riservate sui pazienti</li>
                <li>Pubblicare contenuti offensivi, diffamatori o inappropriati</li>
                <li>Violare diritti di proprietà intellettuale</li>
                <li>Utilizzare la piattaforma per spam o attività commerciali non autorizzate</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Limitazioni di Responsabilità</h2>
              <p className="mb-4">
                Equipé non è responsabile per:
              </p>
              <ul className="list-disc list-inside space-y-2">
                <li>Rapporti professionali instaurati tramite la piattaforma</li>
                <li>Qualità delle prestazioni professionali degli utenti</li>
                <li>Contenuti pubblicati dagli utenti</li>
                <li>Interruzioni temporanee del servizio per manutenzione</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Sospensione e Risoluzione</h2>
              <p className="mb-4">
                Equipé si riserva il diritto di sospendere o risolvere l'accesso in caso di:
              </p>
              <ul className="list-disc list-inside space-y-2">
                <li>Violazione dei presenti Termini</li>
                <li>Comportamento inappropriato o dannoso</li>
                <li>Perdita dei requisiti professionali</li>
                <li>Richiesta dell'autorità competente</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Modifiche ai Termini</h2>
              <p className="mb-4">
                Equipé può modificare i presenti Termini con preavviso di 30 giorni. 
                L'uso continuato del servizio costituisce accettazione delle modifiche.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Legge Applicabile e Foro</h2>
              <p className="mb-4">
                I presenti Termini sono disciplinati dalla legge italiana. Per qualsiasi controversia 
                è competente il Foro di Roma.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Contatti</h2>
              <p>
                Per informazioni sui Termini di Servizio: <br />
                Email: <a href="mailto:legal@equipe.it" className="text-blue-600 hover:underline">legal@equipe.it</a>
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
