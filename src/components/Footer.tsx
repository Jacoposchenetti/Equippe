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
              <li><a href="mailto:support@tuaequipe.it" className="text-gray-400 hover:text-white transition">Assistenza Tecnica</a></li>
              <li><a href="mailto:info@tuaequipe.it" className="text-gray-400 hover:text-white transition">Informazioni Generali</a></li>
              <li><a href="mailto:info@tuaequipe.it" className="text-gray-400 hover:text-white transition">Partnership</a></li>
              <li><a href="mailto:support@tuaequipe.it" className="text-gray-400 hover:text-white transition">Feedback & Suggerimenti</a></li>
            </ul>
          </div>

          {/* Legale */}
          <div>
            <h4 className="font-semibold mb-4">Informazioni Legali</h4>
            <ul className="space-y-3 text-sm">
              <li><Link to="/legal/termini" className="text-gray-400 hover:text-white transition">Termini e Condizioni</Link></li>
              <li><Link to="/legal/privacy" className="text-gray-400 hover:text-white transition">Privacy Policy</Link></li>
              <li><Link to="/legal/cookie" className="text-gray-400 hover:text-white transition">Cookie Policy</Link></li>
              <li><a href="mailto:admin@tuaequipe.it" className="text-gray-400 hover:text-white transition">Data Protection Officer</a></li>
              <li><a href="mailto:legal@tuaequipe.it" className="text-gray-400 hover:text-white transition">Ufficio Legale</a></li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-800 mt-10 pt-8">
          <div className="text-sm text-gray-400 mb-6 text-center">
            <p className="font-semibold">© 2026 Equipé</p>
          </div>
          
          <div className="border-t border-gray-800 pt-4 text-center text-xs text-gray-500">
            <p>
              Questa piattaforma è destinata esclusivamente a professionisti sanitari e socio-sanitari regolarmente iscritti ai rispettivi albi professionali.
              L'accesso e l'utilizzo sono soggetti alla verifica delle credenziali professionali.
            </p>
          </div>
          {/* Extra space for mobile bottom nav */}
          <div className="md:hidden h-20" />
        </div>
      </div>
    </footer>
  );
}
