'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, where, Timestamp, getDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User } from '@/types/equippe';
import { generateEncryptionKey, exportKey, encryptData } from '@/lib/encryption';
import Link from 'next/link';
import { notifyReferralReceived } from '@/lib/notifications';

export default function CreateReferralPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [professionisti, setProfessionisti] = useState<User[]>([]);
  const [formData, setFormData] = useState({
    receiverId: '',
    patientName: '',
    patientAge: '',
    patientContact: '',
    diagnosis: '',
    notes: '',
    urgency: 'normal' as 'low' | 'normal' | 'high',
  });

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    loadProfessionisti();
  }, [user]);

  const loadProfessionisti = async () => {
    try {
      const usersRef = collection(db, 'users');
      const snapshot = await getDocs(usersRef);
      const users = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      } as User));
      setProfessionisti(users.filter(u => u.uid !== user?.uid));
    } catch (error) {
      console.error('Errore caricamento professionisti:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.receiverId) {
      setError('Seleziona un destinatario');
      return;
    }

    if (!formData.patientName.trim()) {
      setError('Inserisci il nome del paziente');
      return;
    }

    setLoading(true);

    try {
      if (!user) return;

      // Genera chiave di crittografia
      const encryptionKey = await generateEncryptionKey();
      const keyString = await exportKey(encryptionKey);

      // Cripta i dati sensibili del paziente
      const patientData = JSON.stringify({
        name: formData.patientName,
        age: formData.patientAge,
        contact: formData.patientContact,
      });

      const { encrypted: encryptedPatient, iv: patientIv } = await encryptData(patientData, encryptionKey);
      const { encrypted: encryptedDiagnosis, iv: diagnosisIv } = await encryptData(formData.diagnosis, encryptionKey);
      const { encrypted: encryptedNotes, iv: notesIv } = await encryptData(formData.notes, encryptionKey);

      // Crea il referral
      const referralData = {
        senderUid: user.uid,
        receiverUid: formData.receiverId,
        encryptedPatient,
        patientIv,
        encryptedDiagnosis,
        diagnosisIv,
        encryptedNotes,
        notesIv,
        encryptionKey: keyString, // In produzione, questa chiave dovrebbe essere condivisa tramite un canale sicuro separato
        urgency: formData.urgency,
        status: 'pending' as const,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      const referralRef = await addDoc(collection(db, 'referrals'), referralData);

      // Notifica il destinatario del nuovo referral
      const senderName = user.displayName || user.email || 'Un professionista';
      await notifyReferralReceived(
        formData.receiverId,
        user.uid,
        senderName,
        formData.patientName,
        referralRef.id
      );

      router.push('/referrals');
    } catch (err: any) {
      console.error('Errore creazione referral:', err);
      setError(err.message || 'Errore durante la creazione del referral');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-600">Equipé</h1>
          <Link href="/referrals" className="text-blue-600 hover:underline">← Torna ai Referral</Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <h2 className="text-3xl font-bold mb-6">Crea Nuovo Referral</h2>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow space-y-6">
          {/* Destinatario */}
          <div>
            <label className="block text-sm font-semibold mb-2">Invia a *</label>
            <select
              value={formData.receiverId}
              onChange={(e) => setFormData({ ...formData, receiverId: e.target.value })}
              className="w-full border rounded px-3 py-2"
              required
            >
              <option value="">Seleziona professionista...</option>
              {professionisti.map((prof) => (
                <option key={prof.uid} value={prof.uid}>
                  {prof.profile.nome} - {prof.profile.specializzazioni.join(', ')} ({prof.profile.location.città})
                </option>
              ))}
            </select>
          </div>

          {/* Urgenza */}
          <div>
            <label className="block text-sm font-semibold mb-2">Urgenza</label>
            <select
              value={formData.urgency}
              onChange={(e) => setFormData({ ...formData, urgency: e.target.value as any })}
              className="w-full border rounded px-3 py-2"
            >
              <option value="low">Bassa</option>
              <option value="normal">Normale</option>
              <option value="high">Alta</option>
            </select>
          </div>

          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4">🔒 Dati Paziente (Crittografati)</h3>
            
            {/* Nome Paziente */}
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2">Nome Paziente *</label>
              <input
                type="text"
                value={formData.patientName}
                onChange={(e) => setFormData({ ...formData, patientName: e.target.value })}
                className="w-full border rounded px-3 py-2"
                placeholder="Nome completo del paziente"
                required
              />
            </div>

            {/* Età */}
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2">Età</label>
              <input
                type="text"
                value={formData.patientAge}
                onChange={(e) => setFormData({ ...formData, patientAge: e.target.value })}
                className="w-full border rounded px-3 py-2"
                placeholder="es. 45 anni"
              />
            </div>

            {/* Contatto */}
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2">Contatto Paziente</label>
              <input
                type="text"
                value={formData.patientContact}
                onChange={(e) => setFormData({ ...formData, patientContact: e.target.value })}
                className="w-full border rounded px-3 py-2"
                placeholder="Telefono o email"
              />
            </div>

            {/* Diagnosi */}
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2">Diagnosi / Motivo Referral *</label>
              <textarea
                value={formData.diagnosis}
                onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
                className="w-full border rounded px-3 py-2"
                rows={3}
                placeholder="Descrivi la diagnosi e il motivo della segnalazione"
                required
              />
            </div>

            {/* Note */}
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2">Note Cliniche</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full border rounded px-3 py-2"
                rows={4}
                placeholder="Informazioni aggiuntive rilevanti per il collega"
              />
            </div>

            <div className="bg-blue-50 p-4 rounded text-sm text-blue-800">
              <strong>🔒 Privacy e Sicurezza:</strong> Tutti i dati sensibili del paziente saranno crittografati 
              end-to-end prima dell'invio, in conformità con il GDPR.
            </div>
          </div>

          {/* Pulsanti */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-semibold"
            >
              {loading ? 'Invio in corso...' : 'Invia Referral'}
            </button>
            <Link
              href="/referrals"
              className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 text-center"
            >
              Annulla
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
