'use client';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="flex min-h-screen flex-col items-center justify-center px-4">
        <main className="text-center max-w-4xl">
          <h1 className="text-6xl font-bold text-blue-600 mb-4">
            Equipé
          </h1>
          <h2 className="text-3xl font-semibold text-gray-800 mb-6">
            La piattaforma per professionisti sociosanitari
          </h2>
          <p className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto">
            Trova colleghi, forma equipé multidisciplinari e collabora in modo sicuro 
            per offrire il miglior supporto ai tuoi pazienti.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <a
              href="/register"
              className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-lg hover:shadow-xl"
            >
              Registrati ora
            </a>
            <a
              href="/login"
              className="px-8 py-3 bg-white text-blue-600 font-semibold rounded-lg hover:bg-gray-50 transition-colors border-2 border-blue-600"
            >
              Accedi
            </a>
          </div>

          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="text-3xl mb-3"></div>
              <h3 className="text-xl font-semibold mb-2 text-gray-800">
                Cerca professionisti
              </h3>
              <p className="text-gray-600">
                Trova colleghi nella tua città per specializzazione e tematica
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="text-3xl mb-3"></div>
              <h3 className="text-xl font-semibold mb-2 text-gray-800">
                Forma equipé
              </h3>
              <p className="text-gray-600">
                Crea team multidisciplinari per gestire casi complessi
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="text-3xl mb-3"></div>
              <h3 className="text-xl font-semibold mb-2 text-gray-800">
                Collabora in sicurezza
              </h3>
              <p className="text-gray-600">
                Referral tracciati e conformi alla privacy sanitaria
              </p>
            </div>
          </div>
        </main>

        <footer className="mt-16 text-center text-gray-500 text-sm">
          <p> 2026 Equipé - Piattaforma per professionisti sociosanitari</p>
        </footer>
      </div>
    </div>
  );
}
