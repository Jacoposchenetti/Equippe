'use client';

import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white/80 text-slate-700 py-12 mt-16 backdrop-blur">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <h3 className="text-xl font-bold mb-4">tuaequipe.it</h3>
            <p className="text-slate-500 text-sm mb-4">
              Piattaforma per professionisti sanitari
            </p>
            <p className="text-slate-500 text-xs">
              Networking professionale<br />
              Formazione equipe multidisciplinari<br />
              Collaborazione sicura
            </p>
          </div>

          {/* Servizi */}
          <div>
            <h4 className="font-semibold mb-4">Servizi</h4>
            <ul className="space-y-3 text-sm">
              <li><Link to="/trova" className="text-slate-500 hover:text-blue-700 transition">Trova un Professionista</Link></li>
              <li><Link to="/teams" className="text-slate-500 hover:text-blue-700 transition">Le Mie equipe</Link></li>
              <li><Link to="/messages" className="text-slate-500 hover:text-blue-700 transition">Messaggi</Link></li>
              <li><Link to="/referrals" className="text-slate-500 hover:text-blue-700 transition">Pazienti</Link></li>
              <li><Link to="/invites" className="text-slate-500 hover:text-blue-700 transition">Inviti</Link></li>
            </ul>
          </div>

          {/* Supporto */}
          <div>
            <h4 className="font-semibold mb-4">Supporto</h4>
            <ul className="space-y-3 text-sm">
              <li><a href="/#faq" className="text-slate-500 hover:text-blue-700 transition">FAQ</a></li>
              <li><a href="mailto:support@tuaequipe.it" className="text-slate-500 hover:text-blue-700 transition">Assistenza Tecnica</a></li>
              <li><a href="mailto:info@tuaequipe.it" className="text-slate-500 hover:text-blue-700 transition">Informazioni Generali</a></li>
              <li><a href="mailto:info@tuaequipe.it" className="text-slate-500 hover:text-blue-700 transition">Partnership</a></li>
              <li><a href="mailto:support@tuaequipe.it" className="text-slate-500 hover:text-blue-700 transition">Feedback & Suggerimenti</a></li>
            </ul>
          </div>

          {/* Legale */}
          <div>
            <h4 className="font-semibold mb-4">Informazioni Legali</h4>
            <ul className="space-y-3 text-sm">
              <li><Link to="/legal/termini" className="text-slate-500 hover:text-blue-700 transition">Termini e Condizioni</Link></li>
              <li><Link to="/legal/privacy" className="text-slate-500 hover:text-blue-700 transition">Privacy Policy</Link></li>
              <li><Link to="/legal/cookie" className="text-slate-500 hover:text-blue-700 transition">Cookie Policy</Link></li>
              <li><a href="mailto:admin@tuaequipe.it" className="text-slate-500 hover:text-blue-700 transition">Data Protection Officer</a></li>
              <li><a href="mailto:legal@tuaequipe.it" className="text-slate-500 hover:text-blue-700 transition">Ufficio Legale</a></li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-slate-200 mt-10 pt-8">
          <div className="text-sm text-slate-500 mb-6 text-center">
            <p className="font-semibold">© 2026 tuaequipe.it</p>
          </div>
          
          <div className="border-t border-slate-200 pt-4 text-center text-xs text-slate-400">
            <p>
              Questa piattaforma è destinata esclusivamente a professionisti sanitari regolarmente iscritti ai rispettivi albi professionali.
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
