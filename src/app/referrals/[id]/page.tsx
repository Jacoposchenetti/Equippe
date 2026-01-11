'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User } from '@/types/equippe';
import { importKey, decryptData } from '@/lib/encryption';
import Link from 'next/link';

interface Referral {
  id: string;
  senderUid: string;
  receiverUid: string;
  encryptedPatient: string;
  patientIv: string;
  encryptedDiagnosis: string;
  diagnosisIv: string;
  encryptedNotes: string;
  notesIv: string;
  encryptionKey: string;
  urgency: 'low' | 'normal' | 'high';
  status: 'pending' | 'accepted' | 'rejected' | 'completed';
  createdAt: any;
  updatedAt: any;
}

interface DecryptedData {
  patient: { name: string; age: string; contact: string };
  diagnosis: string;
  notes: string;
}

export default function ReferralDetailPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const referralId = params.id as string;
  
  const [referral, setReferral] = useState<Referral | null>(null);
  const [sender, setSender] = useState<User | null>(null);
  const [receiver, setReceiver] = useState<User | null>(null);
  const [decryptedData, setDecryptedData] = useState<DecryptedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    loadReferralData();
  }, [user, referralId]);

  const loadReferralData = async () => {
    try {
      // Carica referral
      const referralDoc = await getDoc(doc(db, 'referrals', referralId));
      if (!referralDoc.exists()) {
        router.push('/referrals');
        return;
      }

      const referralData = { id: referralDoc.id, ...referralDoc.data() } as Referral;
      
      // Verifica accesso
      if (referralData.senderUid !== user?.uid && referralData.receiverUid !== user?.uid) {
        router.push('/referrals');
        return;
      }

      setReferral(referralData);

      // Carica dati utenti
      const senderDoc = await getDoc(doc(db, 'users', referralData.senderUid));
      const receiverDoc = await getDoc(doc(db, 'users', referralData.receiverUid));

      if (senderDoc.exists()) setSender({ uid: senderDoc.id, ...senderDoc.data() } as User);
      if (receiverDoc.exists()) setReceiver({ uid: receiverDoc.id, ...receiverDoc.data() } as User);

      // Decripta i dati
      const key = await importKey(referralData.encryptionKey);
      
      const patientJson = await decryptData(referralData.encryptedPatient, referralData.patientIv, key);
      const patient = JSON.parse(patientJson);
      const diagnosis = await decryptData(referralData.encryptedDiagnosis, referralData.diagnosisIv, key);
      const notes = await decryptData(referralData.encryptedNotes, referralData.notesIv, key);

      setDecryptedData({ patient, diagnosis, notes });
    } catch (error) {
      console.error('Errore caricamento referral:', error);
      alert('Errore nel caricamento o decifrazione dei dati');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (newStatus: 'accepted' | 'rejected' | 'completed') => {
    if (!referral) return;

    const confirmMessages = {
      accepted: 'Sei sicuro di voler accettare questo referral?',
      rejected: 'Sei sicuro di voler rifiutare questo referral?',
      completed: 'Sei sicuro di voler segnare questo referral come completato?',
    };

    if (!confirm(confirmMessages[newStatus])) return;

    setUpdating(true);
    try {
      await updateDoc(doc(db, 'referrals', referralId), {
        status: newStatus,
        updatedAt: Timestamp.now(),
      });

      await loadReferralData();
      alert('Stato aggiornato con successo');
    } catch (error) {
      console.error('Errore aggiornamento stato:', error);
      alert('Errore durante l\'aggiornamento dello stato');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Caricamento...</div>
      </div>
    );
  }

  if (!referral || !decryptedData) {
    return null;
  }

  const isReceiver = user?.uid === referral.receiverUid;
  const isSender = user?.uid === referral.senderUid;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-600">Equippe</h1>
          <Link href="/referrals" className="text-blue-600 hover:underline">← Torna ai Referral</Link>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header Referral */}
        <div className="bg-white p-8 rounded-lg shadow mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-3xl font-bold mb-2">Dettaglio Referral</h2>
              <p className="text-gray-600">
                Creato il {referral.createdAt?.toDate?.().toLocaleDateString('it-IT', { dateStyle: 'long' })}
              </p>
            </div>
            <div className="flex gap-2">
              <span className={`px-4 py-2 rounded font-semibold ${
                referral.urgency === 'high' ? 'bg-red-100 text-red-800' :
                referral.urgency === 'normal' ? 'bg-yellow-100 text-yellow-800' :
                'bg-green-100 text-green-800'
              }`}>
                {referral.urgency === 'high' ? '🔴 Alta urgenza' : 
                 referral.urgency === 'normal' ? '🟡 Urgenza normale' : '🟢 Bassa urgenza'}
              </span>
              <span className={`px-4 py-2 rounded font-semibold ${
                referral.status === 'pending' ? 'bg-blue-100 text-blue-800' :
                referral.status === 'accepted' ? 'bg-green-100 text-green-800' :
                referral.status === 'rejected' ? 'bg-red-100 text-red-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {referral.status === 'pending' ? 'In attesa' :
                 referral.status === 'accepted' ? 'Accettato' :
                 referral.status === 'rejected' ? 'Rifiutato' : 'Completato'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mt-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Inviato da:</h3>
              {sender && (
                <div>
                  <p className="font-semibold text-lg">{sender.profile.nome}</p>
                  <p className="text-gray-600">{sender.email}</p>
                  <p className="text-sm text-gray-500">{sender.profile.specializzazioni.join(', ')}</p>
                  <p className="text-sm text-gray-500">{sender.profile.location.città}</p>
                </div>
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Destinatario:</h3>
              {receiver && (
                <div>
                  <p className="font-semibold text-lg">{receiver.profile.nome}</p>
                  <p className="text-gray-600">{receiver.email}</p>
                  <p className="text-sm text-gray-500">{receiver.profile.specializzazioni.join(', ')}</p>
                  <p className="text-sm text-gray-500">{receiver.profile.location.città}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Dati Paziente Decriptati */}
        <div className="bg-white p-8 rounded-lg shadow mb-6">
          <div className="flex items-center gap-2 mb-6">
            <h3 className="text-2xl font-bold">🔓 Dati Paziente</h3>
            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Decriptato</span>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Nome Paziente</label>
              <p className="text-lg">{decryptedData.patient.name}</p>
            </div>

            {decryptedData.patient.age && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Età</label>
                <p className="text-lg">{decryptedData.patient.age}</p>
              </div>
            )}

            {decryptedData.patient.contact && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Contatto</label>
                <p className="text-lg">{decryptedData.patient.contact}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Diagnosi / Motivo Referral</label>
              <p className="text-lg whitespace-pre-wrap">{decryptedData.diagnosis}</p>
            </div>

            {decryptedData.notes && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Note Cliniche</label>
                <p className="text-lg whitespace-pre-wrap">{decryptedData.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Azioni */}
        {isReceiver && referral.status === 'pending' && (
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-xl font-bold mb-4">Azioni</h3>
            <div className="flex gap-4">
              <button
                onClick={() => handleStatusUpdate('accepted')}
                disabled={updating}
                className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-semibold"
              >
                ✓ Accetta Referral
              </button>
              <button
                onClick={() => handleStatusUpdate('rejected')}
                disabled={updating}
                className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 font-semibold"
              >
                ✗ Rifiuta Referral
              </button>
            </div>
          </div>
        )}

        {referral.status === 'accepted' && (
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-xl font-bold mb-4">Azioni</h3>
            <button
              onClick={() => handleStatusUpdate('completed')}
              disabled={updating}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-semibold"
            >
              ✓ Segna come Completato
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
