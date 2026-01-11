'use client';

import dynamic from 'next/dynamic';

const MapSelector = dynamic(() => import('./MapSelectorClient'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-96 bg-gray-100 rounded-lg flex items-center justify-center">
      <div className="text-gray-500">Caricamento mappa...</div>
    </div>
  ),
});

export default MapSelector;
