import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { SubscriptionPlan } from '@/types/equippe';
import Footer from '@/components/Footer';

type BillingPeriod = 'monthly' | 'annual';

interface PlanConfig {
  id: SubscriptionPlan;
  name: string;
  monthlyPrice: number | null;
  annualPrice: number | null;
  features: string[];
  available: boolean;
}

const PLANS: PlanConfig[] = [
  {
    id: 'base',
    name: 'Base',
    monthlyPrice: null,
    annualPrice: null,
    features: [
      'Dashboard professionale',
      'Gestione equipe e referral',
      'Messaggistica con colleghi',
      'Agenda e appuntamenti',
      'Corsi ECM',
      'Fatturazione',
      'Marketplace',
    ],
    available: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    monthlyPrice: 49,
    annualPrice: 29,
    features: [
      'Tutto del piano Base',
      'Visibile ai pazienti in /trova',
      'Pagina profilo pubblica',
      'Prenotazione online da pazienti',
    ],
    available: false,
  },
  {
    id: 'best',
    name: 'Best',
    monthlyPrice: 99,
    annualPrice: 59,
    features: [
      'Tutto del piano Pro',
      'Visibilità prioritaria ai pazienti',
      'Badge "In evidenza"',
      'Statistiche avanzate profilo',
    ],
    available: false,
  },
];

export default function AbbonamentoPage() {
  const { currentPlan } = useAuth();
  const navigate = useNavigate();
  const [billing, setBilling] = useState<BillingPeriod>('monthly');

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="flex-1 py-10 px-4">
        <div className="max-w-4xl mx-auto">

          {/* Back button */}
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Indietro
          </button>

          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Abbonamento</h1>
            <p className="mt-2 text-gray-500">
              Scegli il piano più adatto alla tua attività professionale.
            </p>
          </div>

          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-3 mb-10">
            <span className={`text-sm font-medium ${billing === 'monthly' ? 'text-gray-900' : 'text-gray-400'}`}>
              Mensile
            </span>
            <button
              onClick={() => setBilling(b => b === 'monthly' ? 'annual' : 'monthly')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none
                ${billing === 'annual' ? 'bg-blue-600' : 'bg-gray-300'}`}
              aria-label="Cambia piano di fatturazione"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform
                  ${billing === 'annual' ? 'translate-x-6' : 'translate-x-1'}`}
              />
            </button>
            <span className={`text-sm font-medium ${billing === 'annual' ? 'text-gray-900' : 'text-gray-400'}`}>
              Annuale
              <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                Risparmia ~40%
              </span>
            </span>
          </div>

          {/* Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PLANS.map((plan) => {
              const isCurrentPlan = currentPlan === plan.id;
              const isDisabled = !plan.available;
              const price = billing === 'monthly' ? plan.monthlyPrice : plan.annualPrice;

              return (
                <div
                  key={plan.id}
                  className={`relative rounded-2xl border-2 p-6 flex flex-col transition-all
                    ${isCurrentPlan
                      ? 'border-blue-500 bg-white shadow-lg'
                      : isDisabled
                      ? 'border-gray-200 bg-gray-50 opacity-70'
                      : 'border-gray-200 bg-white shadow-sm hover:shadow-md'
                    }`}
                >
                  {/* Name + badges */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <span className="text-xl font-bold text-gray-900">{plan.name}</span>
                      {isCurrentPlan && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          Piano attuale
                        </span>
                      )}
                    </div>
                    {isDisabled && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        Prossimamente
                      </span>
                    )}
                  </div>

                  {/* Price */}
                  <div className="mb-1">
                    {price !== null ? (
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-extrabold text-gray-900">€{price}</span>
                        <span className="text-sm text-gray-500">/ mese</span>
                      </div>
                    ) : (
                      <span className="text-2xl font-extrabold text-gray-900">Gratuito</span>
                    )}
                  </div>
                  {price !== null && billing === 'annual' && (
                    <p className="text-xs text-gray-400 mb-5">fatturato annualmente (€{price * 12}/anno)</p>
                  )}
                  {price !== null && billing === 'monthly' && (
                    <p className="text-xs text-gray-400 mb-5">fatturato mensilmente</p>
                  )}
                  {price === null && <div className="mb-5" />}

                  {/* Features */}
                  <ul className="space-y-2 flex-1 mb-6">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm text-gray-600">
                        <svg
                          className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isDisabled ? 'text-gray-400' : 'text-blue-500'}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  {isCurrentPlan ? (
                    <div className="w-full py-2 rounded-lg text-center text-sm font-medium bg-blue-50 text-blue-600 border border-blue-200">
                      Piano attivo
                    </div>
                  ) : isDisabled ? (
                    <div className="w-full py-2 rounded-lg text-center text-sm font-medium bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200 select-none">
                      Prossimamente
                    </div>
                  ) : (
                    <button className="w-full py-2 rounded-lg text-center text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition">
                      Attiva
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Note */}
          <p className="text-center text-xs text-gray-400 mt-8">
            I piani Pro e Best saranno disponibili a breve. Tutti gli utenti attuali hanno accesso completo al piano Base.
          </p>

        </div>
      </div>
      <Footer />
    </div>
  );
}
