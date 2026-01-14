import type { Metadata } from 'next';
import { AuthProvider } from '@/contexts/AuthContext';
import PushNotificationManager from '@/components/PushNotificationManager';
import './globals.css';
import 'leaflet/dist/leaflet.css';

export const metadata: Metadata = {
  title: 'Equipé - Piattaforma per professionisti sociosanitari',
  description: 'Trova colleghi, forma equipé multidisciplinari e collabora',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
};

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
