import React from 'react';
import Header from '@/components/Header';

export default function InvitesPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">
          Inviti
        </h1>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-gray-600">
            Sistema inviti in sviluppo
          </p>
        </div>
      </div>
    </div>
  );
}
