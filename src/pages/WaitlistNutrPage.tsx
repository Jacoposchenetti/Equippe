import type { FC } from 'react';
import WPComponent from './WaitlistPage';
import type { WaitlistConfig } from './waitlistTypes';

// cast esplicito: tsc non riesce a inferire i props del componente grande
const WaitlistPage = WPComponent as FC<{ config?: WaitlistConfig }>;

const config: WaitlistConfig = {
  pageTitle: 'tuaequipe.it — Per Nutrizionisti e Dietisti',
  heroTitle: 'I tuoi pazienti hanno bisogno di uno psicologo. I loro pazienti hanno bisogno di te.',
  heroSubtitle: 'tuaequipe.it ti connette con psicologi, medici e altri specialisti nella tua zona. Invia e ricevi referral in modo strutturato e sicuro.',
  formTitle: 'Sei un nutrizionista o dietista? Iscriviti ora',
  formSubtitle: 'Piano base gratuito + codice sconto — solo per gli iscritti alla waiting list',
  professioneDefault: 'Nutrizionista',
  painTitle: 'Ti riconosci in queste situazioni?',
  painSubtitle: 'Sai fare il tuo lavoro, ma quando il paziente ha bisogno di un altro specialista le cose si complicano.',
  painPoints: [
    'I tuoi pazienti con disturbi del comportamento alimentare hanno bisogno di supporto psicologico, ma non sai a chi inviarli.',
    'Non hai una rete strutturata con medici e dietologi della tua zona per collaborare su casi complessi.',
    'Ricevi richieste fuori dalla tua specializzazione e non sai a chi indirizzare il paziente.',
    'La gestione dei referral è caotica — WhatsApp, email e telefonate senza tracciabilità.',
  ],
  solutionText: 'Con tuaequipe.it costruisci una rete di fiducia nella tua zona e gestisci i referral in modo sicuro e professionale.',
  ctaTitle: 'I posti per nutrizionisti sono limitati',
  ctaSubtitle: 'Iscriviti subito alla waiting list. Piano base gratuito e codice sconto sui piani superiori riservato ai primi iscritti.',
  highlightedProfessions: ['Nutrizionista', 'Dietista', 'Dietologo'],
};

export default function WaitlistNutrPage() {
  return <WaitlistPage config={config} />;
}
