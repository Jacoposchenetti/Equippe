import React from 'react';

interface LegalPageProps {
  type: 'privacy' | 'termini' | 'cookie';
}

export default function LegalPage({ type }: LegalPageProps) {
  const getTitle = () => {
    switch(type) {
      case 'privacy': return 'Privacy Policy';
      case 'termini': return 'Termini e Condizioni';
      case 'cookie': return 'Cookie Policy';
      default: return 'Documenti Legali';
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-0 pb-24 sm:pt-4 sm:pb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3 sm:mb-6">
          {getTitle()}
        </h1>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-gray-600">
            Contenuto {getTitle()} in sviluppo
          </p>
        </div>
      </div>
    </div>
  );
}
