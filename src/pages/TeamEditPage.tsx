import { useParams } from 'react-router-dom';
import Header from '@/components/Header';

export default function TeamEditPage() {
  const { id } = useParams();
  
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">
          Modifica Equipé {id}
        </h1>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-gray-600">
            Pagina modifica equipé in sviluppo
          </p>
        </div>
      </div>
    </div>
  );
}
