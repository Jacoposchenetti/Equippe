import { useParams } from 'react-router-dom';
import Header from '@/components/Header';

export default function ReferralDetailPage() {
  const { id } = useParams();
  
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">
          Dettaglio Referral {id}
        </h1>
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
          <p className="text-sm sm:text-base text-gray-600">
            Pagina dettaglio referral in sviluppo
          </p>
        </div>
      </div>
    </div>
  );
}
