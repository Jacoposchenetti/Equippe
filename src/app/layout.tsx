// File Next.js - non utilizzato in Vite (il layout è gestito in src/App.tsx)
// import type { Metadata, Viewport } from 'next';
import { AuthProvider } from '@/contexts/AuthContext';
import PushNotificationManager from '@/components/PushNotificationManager';
import './globals.css';
import 'leaflet/dist/leaflet.css';

/*
export const metadata: Metadata = {
  title: 'equipe - Piattaforma per professionisti sanitari',
  description: 'Trova colleghi, forma equipe multidisciplinari e collabora',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};
*/

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it">
      <body>
        <AuthProvider>
          {children}
          <PushNotificationManager />
        </AuthProvider>
      </body>
    </html>
  );
}
