import type { FC } from 'react';
import WPComponent from './WaitlistPage';
import type { WaitlistConfig } from './waitlistTypes';

// cast esplicito: tsc non riesce a inferire i props del componente grande
const WaitlistPage = WPComponent as FC<{ config?: WaitlistConfig }>;

const config: WaitlistConfig = {
  pageTitle: 'tuaequipe.it — Per Fisioterapisti e Osteopati',
  heroTitle: 'Riabiliti il corpo. Con la rete giusta, puoi offrire molto di più ai tuoi pazienti.',
  heroSubtitle: 'tuaequipe.it ti connette con medici, psicologi e altri specialisti per una collaborazione clinica strutturata. Invia e ricevi referral in modo sicuro.',
  formTitle: 'Sei un fisioterapista o osteopata? Iscriviti ora',
  formSubtitle: 'Piano base gratuito + codice sconto — solo per gli iscritti alla waiting list',
  professioneDefault: 'Fisioterapista',
  painTitle: 'Ti riconosci in queste situazioni?',
  painSubtitle: 'Sei bravo nel tuo lavoro, ma senza una rete strutturata invii pazienti a colleghi che non conosci davvero.',
  painPoints: [
    'I tuoi pazienti con dolore cronico o problemi posturali hanno anche componenti psicologiche: non sai a chi inviarli.',
    'Non hai una rete strutturata di medici, neurologi o specialisti con cui collaborare nella tua zona.',
    'Le segnalazioni avvengono in modo informale, senza tracciabilità né struttura.',
    'Ti mancano fisioterapisti e osteopati di fiducia con cui confrontarti su casi clinici complessi.',
  ],
  solutionText: 'Con tuaequipe.it trovi i professionisti giusti nella tua zona e gestisci i referral in modo strutturato.',
  ctaTitle: 'I posti per fisioterapisti e osteopati sono limitati',
  ctaSubtitle: 'Iscriviti subito alla waiting list. Piano base gratuito e codice sconto sui piani superiori riservato ai primi iscritti.',
  highlightedProfessions: ['Fisioterapista', 'Osteopata'],
};

export default function WaitlistFisioPage() {
  return <WaitlistPage config={config} />;
}
