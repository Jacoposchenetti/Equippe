'use client';

import { lazy, Suspense } from 'react';

const MapSelectorClient = lazy(() => import('./MapSelectorClient'));

const MapSelector: React.FC<any> = (props) => {
  return (
    <Suspense fallback={
      <div className="w-full h-96 bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="text-gray-500">Caricamento mappa...</div>
      </div>
    }>
      <MapSelectorClient {...props} />
    </Suspense>
  );
};

export default MapSelector;
