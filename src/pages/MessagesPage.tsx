import React from 'react';
import Header from '@/components/Header';
import VerificationBanner from '@/components/VerificationBanner';
import { useCanInteract } from '@/hooks/useCanInteract';

export default function MessagesPage() {
  const { canInteract, message } = useCanInteract();
  
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <VerificationBanner />
      <div className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">
          Messaggi
        </h1>
        <div className="bg-white rounded-xl shadow-sm p-6">
          {!canInteract ? (
            <div className="text-center py-8">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">Messaggi non disponibili</h3>
              <p className="mt-1 text-sm text-gray-500">{message}</p>
            </div>
          ) : (
            <p className="text-gray-600">
              Sistema di messaggi in sviluppo
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
