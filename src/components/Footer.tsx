'use client';

import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-white py-12 mt-16">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <h3 className="text-xl font-bold mb-4">Equipé</h3>
            <p className="text-gray-400 text-sm mb-4">
              Piattaforma per professionisti sociosanitari
            </p>
            <p className="text-gray-400 text-xs">
              Networking professionale<br />
              Formazione équipe multidisciplinari<br />
              Collaborazione sicura
            </p>
          </div>

          {/* Servizi */}
          <div>
            <h4 className="font-semibold mb-4">Servizi</h4>
            <ul className="space-y-3 text-sm">
              <li><Link to="/dashboard" className="text-gray-400 hover:text-white transition">Cerca Professionisti</Link></li>
              <li><Link to="/teams" className="text-gray-400 hover:text-white transition">Le Mie Équipe</Link></li>
              <li><Link to="/messages" className="text-gray-400 hover:text-white transition">Messaggi</Link></li>
              <li><Link to="/referrals" className="text-gray-400 hover:text-white transition">Pazienti</Link></li>
              <li><Link to="/invites" className="text-gray-400 hover:text-white transition">Inviti</Link></li>
            </ul>
          </div>

          {/* Supporto */}
          <div>
            <h4 className="font-semibold mb-4">Supporto</h4>
            <ul className="space-y-3 text-sm">
              <li><a href="mailto:support@equipe.it" className="text-gray-400 hover:text-white transition">Assistenza Tecnica</a></li>
              <li><a href="mailto:info@equipe.it" className="text-gray-400 hover:text-white transition">Informazioni Generali</a></li>
              <li><a href="mailto:partnership@equipe.it" className="text-gray-400 hover:text-white transition">Partnership</a></li>
              <li><a href="mailto:feedback@equipe.it" className="text-gray-400 hover:text-white transition">Feedback & Suggerimenti</a></li>
            </ul>
          </div>

          {/* Legale */}
          <div>
            <h4 className="font-semibold mb-4">Informazioni Legali</h4>
            <ul className="space-y-3 text-sm">
              <li><Link to="/legal/termini" className="text-gray-400 hover:text-white transition">Termini e Condizioni</Link></li>
              <li><Link to="/legal/privacy" className="text-gray-400 hover:text-white transition">Privacy Policy</Link></li>
              <li><Link to="/legal/cookie" className="text-gray-400 hover:text-white transition">Cookie Policy</Link></li>
              <li><a href="mailto:dpo@equipe.it" className="text-gray-400 hover:text-white transition">Data Protection Officer</a></li>
              <li><a href="mailto:legal@equipe.it" className="text-gray-400 hover:text-white transition">Ufficio Legale</a></li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-800 mt-10 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
            <div className="text-sm text-gray-400 mb-4 md:mb-0">
              <p className="font-semibold">© 2026 Equipé S.r.l.</p>
              <p className="mt-1">P.IVA: [DA_INSERIRE] • Sede Legale: [DA_INSERIRE]</p>
              <p className="mt-1">Registro Imprese: [DA_INSERIRE] • REA: [DA_INSERIRE]</p>
              <p className="mt-2 text-xs">
                Piattaforma per professionisti sanitari e socio-sanitari • Conforme GDPR e normative italiane
              </p>
            </div>
            
            <div className="flex items-center space-x-6 text-sm text-gray-400">
              <span className="flex items-center">
                <svg className="w-4 h-4 mr-2 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Server UE
              </span>
              <span className="flex items-center">
                <svg className="w-4 h-4 mr-2 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
                End-to-End
              </span>
              <span className="flex items-center">
                <svg className="w-4 h-4 mr-2 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                ISO 27001
              </span>
            </div>
          </div>
          
          <div className="border-t border-gray-800 pt-4 text-center text-xs text-gray-500">
            <p>
              Questa piattaforma è destinata esclusivamente a professionisti sanitari e socio-sanitari regolarmente iscritti ai rispettivi albi professionali.
              L'accesso e l'utilizzo sono soggetti alla verifica delle credenziali professionali.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
