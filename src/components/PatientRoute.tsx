import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
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
      setStatus(patSnap.exists() ? 'patient' : 'not-patient');
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
  // If logged in as a professional, redirect to their dashboard
  if (status === 'not-patient') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
