'use client';

export default function TerminiServizio() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-6">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3 sm:mb-8">Termini e Condizioni di Servizio</h1>
          
          <div className="prose prose-gray max-w-none">
            <p className="text-sm text-gray-600 mb-6">
              <strong>Ultimo aggiornamento:</strong> {new Date().toLocaleDateString('it-IT')}
            </p>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Oggetto del Servizio</h2>
              <p className="mb-4">
                tuaequipe.it è una piattaforma digitale che facilita la connessione e collaborazione tra professionisti 
                sanitari per la formazione di equipe multidisciplinari. Il servizio include un sistema di referral clinico 
                che consente ai professionisti di trasferire informazioni su pazienti terzi in forma cifrata, 
                nel rispetto della normativa vigente sul trattamento dei dati sanitari.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Definizioni</h2>
              <ul className="list-disc list-inside space-y-2">
                <li><strong>Piattaforma:</strong> Il sito web e l'applicazione tuaequipe.it</li>
                <li><strong>Utente:</strong> Professionista sanitario registrato</li>
                <li><strong>equipe:</strong> Gruppo di professionisti collaboranti</li>
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
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">4-bis. Trattamento Dati Sanitari — Accordo ex Art. 28 GDPR</h2>
              <p className="mb-4 text-sm text-gray-700">
                Accettando i presenti Termini, il Professionista riconosce e accetta quanto segue:
              </p>
              <ol className="list-decimal list-inside space-y-3 text-sm text-gray-700">
                <li>
                  <strong>Ruoli GDPR.</strong> Il Professionista è <em>titolare autonomo del trattamento</em> dei dati 
                  personali e sanitari dei propri pazienti. tuaequipe.it agisce come <em>responsabile del trattamento</em> 
                  ai sensi dell'art. 28 GDPR, trattando tali dati esclusivamente per erogare il servizio di referral 
                  clinico richiesto dal Professionista e nel rispetto delle sue istruzioni.
                </li>
                <li>
                  <strong>Consenso del paziente.</strong> Il Professionista garantisce di aver acquisito, prima di 
                  inserire qualsiasi dato del paziente, il consenso informato del paziente al trattamento per 
                  finalità di cura (art. 9.2.h GDPR), inclusa la condivisione con altri professionisti sanitari 
                  mediante strumenti digitali.
                </li>
                <li>
                  <strong>Minimizzazione.</strong> Il Professionista si impegna a inserire esclusivamente i dati 
                  strettamente necessari per la finalità del referral, evitando dati eccedenti rispetto al quesito 
                  clinico.
                </li>
                <li>
                  <strong>Misure di sicurezza adottate da tuaequipe.it.</strong> I dati sanitari (PHI) sono 
                  cifrati lato client tramite Web Crypto API (AES-GCM 256-bit) prima della trasmissione. 
                  tuaequipe.it non ha accesso in chiaro ai dati sanitari dei pazienti. I dati sono conservati 
                  su infrastruttura Google Firebase, region <code>europe-west1</code> (UE), soggetta a DPA Google.
                </li>
                <li>
                  <strong>Sub-responsabili.</strong> tuaequipe.it si avvale di Google Cloud / Firebase come 
                  sub-responsabile del trattamento. L'elenco aggiornato dei sub-responsabili è disponibile 
                  su richiesta a <a href="mailto:legal@tuaequipe.it" className="text-blue-600 hover:underline">legal@tuaequipe.it</a>.
                </li>
                <li>
                  <strong>Cancellazione.</strong> Al termine del rapporto contrattuale, i dati del referral 
                  saranno eliminati entro 30 giorni, salvo obbligo di conservazione previsto dalla legge. 
                  Il Professionista può richiedere la cancellazione anticipata a 
                  <a href="mailto:legal@tuaequipe.it" className="text-blue-600 hover:underline">legal@tuaequipe.it</a>.
                </li>
                <li>
                  <strong>Assistenza all'interessato.</strong> tuaequipe.it collaborerà con il Professionista, 
                  nella misura tecnicamente possibile, per evadere le richieste di esercizio dei diritti da parte 
                  dei pazienti (accesso, cancellazione, portabilità).
                </li>
              </ol>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Contenuti e Responsabilità</h2>
              <p className="mb-4">
                L'Utente è esclusivamente responsabile dei contenuti che pubblica. È vietato:
              </p>
              <ul className="list-disc list-inside space-y-2">
                <li>Inserire dati sanitari di pazienti nel sistema referral senza aver acquisito il consenso informato del paziente</li>
                <li>Inserire dati sanitari di pazienti in campi non predisposti a tale scopo (messaggi, bio, note pubbliche)</li>
                <li>Pubblicare contenuti offensivi, diffamatori o inappropriati</li>
                <li>Violare diritti di proprietà intellettuale</li>
                <li>Utilizzare la piattaforma per spam o attività commerciali non autorizzate</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Limitazioni di Responsabilità</h2>
              <p className="mb-4">
                tuaequipe.it non è responsabile per:
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
                tuaequipe.it si riserva il diritto di sospendere o risolvere l'accesso in caso di:
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
                tuaequipe.it può modificare i presenti Termini con preavviso di 30 giorni. 
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
                Email: <a href="mailto:legal@tuaequipe.it" className="text-blue-600 hover:underline">legal@tuaequipe.it</a>
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
