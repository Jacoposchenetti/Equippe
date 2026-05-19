import type { FC } from 'react';
import WPComponent from './WaitlistPage';
import type { WaitlistConfig } from './waitlistTypes';

// cast esplicito: tsc non riesce a inferire i props del componente grande
const WaitlistPage = WPComponent as FC<{ config?: WaitlistConfig }>;

const config: WaitlistConfig = {
  pageTitle: 'tuaequipe.it — Per Psichiatri',
  heroTitle: 'Connettiti con psicologi e specialisti di fiducia nella tua zona.',
  heroSubtitle: 'tuaequipe.it ti permette di costruire una rete multidisciplinare verificata: invia e ricevi referral in modo sicuro, e offri ai tuoi pazienti un percorso di cura completo.',
  formTitle: 'Sei uno psichiatra? Iscriviti ora',
  formSubtitle: 'Piano base gratuito + codice sconto — solo per gli iscritti alla waiting list',
  professioneDefault: 'Psichiatra',
  painTitle: 'Ti riconosci in queste situazioni?',
  painSubtitle: 'Lavori con pazienti complessi, ma trovare colleghi affidabili con cui collaborare non è mai semplice.',
  painPoints: [
    'Non riesci a trovare psicologi affidabili nella tua zona a cui inviare i pazienti per il supporto psicoterapeutico.',
    'I tuoi pazienti hanno bisogno di un nutrizionista o fisioterapista ma non sai a chi indirizzarli.',
    'Le segnalazioni di pazienti avvengono via WhatsApp o email, senza tracciabilità né struttura.',
    'Ti manca una rete di colleghi verificati con cui confrontarti su casi complessi.',
  ],
  solutionText: 'Con tuaequipe.it trovi professionisti verificati nella tua zona e gestisci i referral in modo sicuro e professionale.',
  ctaTitle: 'I posti per psichiatri sono limitati',
  ctaSubtitle: 'Iscriviti subito alla waiting list. Piano base gratuito e codice sconto sui piani superiori riservato ai primi iscritti.',
  highlightedProfessions: ['Psichiatra'],
};

export default function WaitlistPsichiatriPage() {
  return <WaitlistPage config={config} />;
}
