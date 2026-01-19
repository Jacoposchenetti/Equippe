import React, { useState } from 'react';
import { collection, getDocs, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function MigrationButton() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<{updated: number; skipped: number} | null>(null);

  const runMigration = async () => {
    if (isRunning) return;
    
    setIsRunning(true);
    setResults(null);
    
    try {
      console.log('🔄 Inizio migrazione consensi...');
      
      const usersSnapshot = await getDocs(collection(db, 'users'));
      let updated = 0;
      let skipped = 0;
      const migrationDate = Timestamp.now();
      
      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        
        if (!userData.consents) {
          await updateDoc(userDoc.ref, {
            consents: {
              termini: { 
                accepted: true, 
                timestamp: migrationDate,
                migrated: true
              },
              privacy: { 
                accepted: true, 
                timestamp: migrationDate,
                migrated: true
              },
              marketing: { 
                accepted: false,
                timestamp: migrationDate,
                migrated: true
              }
            }
          });
          updated++;
        } else {
          skipped++;
        }
      }
      
      setResults({ updated, skipped });
      console.log(`✅ Migrazione completata: ${updated} aggiornati, ${skipped} saltati`);
      
    } catch (error) {
      console.error('❌ Errore migrazione:', error);
      alert('Errore durante la migrazione: ' + error);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
      <h3 className="text-lg font-semibold text-yellow-800 mb-2">
        🚨 Migrazione GDPR (Solo Admin)
      </h3>
      
      <p className="text-sm text-yellow-700 mb-3">
        Aggiunge i consensi GDPR agli utenti esistenti. Eseguire solo una volta!
      </p>
      
      <button
        onClick={runMigration}
        disabled={isRunning}
        className={`px-4 py-2 rounded font-medium ${
          isRunning 
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-yellow-600 text-white hover:bg-yellow-700'
        }`}
      >
        {isRunning ? '⏳ Migrazione in corso...' : '▶️ Avvia Migrazione'}
      </button>
      
      {results && (
        <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded">
          <p className="text-sm text-green-800">
            Completato: {results.updated} utenti aggiornati, {results.skipped} già esistenti
          </p>
        </div>
      )}
    </div>
  );
}
