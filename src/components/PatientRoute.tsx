import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

type Status = 'loading' | 'patient' | 'not-auth' | 'not-patient';

export default function PatientRoute({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async user => {
      if (!user) {
        setStatus('not-auth');
        return;
      }
      const patSnap = await getDoc(doc(db, 'patients', user.uid));
      if (patSnap.exists()) {
        setStatus('patient');
        return;
      }
      // Dual-role: se è un professionista, auto-crea il doc paziente
      const profSnap = await getDoc(doc(db, 'users', user.uid));
      if (profSnap.exists()) {
        const profData = profSnap.data();
        const nomeCompleto = (profData.profile?.nome ?? user.displayName ?? '').trim();
        const parts = nomeCompleto.split(' ');
        await setDoc(doc(db, 'patients', user.uid), {
          uid: user.uid,
          nome: parts[0] ?? '',
          cognome: parts.slice(1).join(' '),
          email: user.email?.toLowerCase() ?? '',
          createdAt: Timestamp.now(),
          linkedProfessional: true,
        });
        setStatus('patient');
      } else {
        setStatus('not-patient');
      }
    });
    return unsub;
  }, []);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Caricamento…</div>
      </div>
    );
  }
  if (status === 'not-auth') return <Navigate to="/paziente/login" replace />;
  // If logged in as a professional (no patients doc), send to patient login
  if (status === 'not-patient') return <Navigate to="/paziente/login" replace />;
  return <>{children}</>;
}
