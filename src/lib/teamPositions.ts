import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Team, User, RoleCercato } from '@/types/equippe';

/**
 * Aggiorna le posizioni occupate quando un membro entra nell'equipe
 * Se ha più specializzazioni richieste, occupa tutte le posizioni corrispondenti
 */
export async function occupyPositions(teamId: string, userId: string): Promise<void> {
  try {
    // Carica dati team e utente
    const teamDoc = await getDoc(doc(db, 'teams', teamId));
    const userDoc = await getDoc(doc(db, 'users', userId));

    if (!teamDoc.exists() || !userDoc.exists()) {
      console.error('Team o utente non trovato');
      return;
    }

    const team = { id: teamDoc.id, ...teamDoc.data() } as Team;
    const user = { uid: userDoc.id, ...userDoc.data() } as User;

    // Se il team non ha ruoli cercati, non fare nulla
    if (!team.ruoliCercati || team.ruoliCercati.length === 0) {
      console.log('Team senza ruoli cercati, skip');
      return;
    }

    // Trova le specializzazioni dell'utente che corrispondono ai ruoli cercati
    const userSpecializations = user.profile.specializzazioni || [];
    const updatedRuoli = team.ruoliCercati.map(ruolo => {
      // Controlla se l'utente ha questa specializzazione
      const hasSpecialization = userSpecializations.some(spec =>
        spec.toLowerCase().includes(ruolo.specializzazione.toLowerCase()) ||
        ruolo.specializzazione.toLowerCase().includes(spec.toLowerCase())
      );

      if (hasSpecialization && ruolo.occupati < ruolo.numero) {
        // Occupa una posizione
        return { ...ruolo, occupati: ruolo.occupati + 1 };
      }

      return ruolo;
    });

    // Controlla se tutti i ruoli sono completati
    const completato = updatedRuoli.every(r => r.occupati >= r.numero);

    // Aggiorna il team
    await updateDoc(doc(db, 'teams', teamId), {
      ruoliCercati: updatedRuoli,
      completato,
      updatedAt: new Date(),
    });

    console.log(`✅ Posizioni aggiornate per team ${teamId}:`, updatedRuoli);
  } catch (error) {
    console.error('❌ Errore aggiornamento posizioni:', error);
    throw error;
  }
}

/**
 * Libera le posizioni quando un membro lascia l'equipe
 */
export async function freePositions(teamId: string, userId: string): Promise<void> {
  try {
    // Carica dati team e utente
    const teamDoc = await getDoc(doc(db, 'teams', teamId));
    const userDoc = await getDoc(doc(db, 'users', userId));

    if (!teamDoc.exists() || !userDoc.exists()) {
      console.error('Team o utente non trovato');
      return;
    }

    const team = { id: teamDoc.id, ...teamDoc.data() } as Team;
    const user = { uid: userDoc.id, ...userDoc.data() } as User;

    // Se il team non ha ruoli cercati, non fare nulla
    if (!team.ruoliCercati || team.ruoliCercati.length === 0) {
      console.log('Team senza ruoli cercati, skip');
      return;
    }

    // Trova le specializzazioni dell'utente che corrispondono ai ruoli cercati
    const userSpecializations = user.profile.specializzazioni || [];
    const updatedRuoli = team.ruoliCercati.map(ruolo => {
      // Controlla se l'utente ha questa specializzazione
      const hasSpecialization = userSpecializations.some(spec =>
        spec.toLowerCase().includes(ruolo.specializzazione.toLowerCase()) ||
        ruolo.specializzazione.toLowerCase().includes(spec.toLowerCase())
      );

      if (hasSpecialization && ruolo.occupati > 0) {
        // Libera una posizione
        return { ...ruolo, occupati: ruolo.occupati - 1 };
      }

      return ruolo;
    });

    // Il team non è più completato se si libera una posizione
    const completato = updatedRuoli.every(r => r.occupati >= r.numero);

    // Aggiorna il team
    await updateDoc(doc(db, 'teams', teamId), {
      ruoliCercati: updatedRuoli,
      completato,
      updatedAt: new Date(),
    });

    console.log(`✅ Posizioni liberate per team ${teamId}:`, updatedRuoli);
  } catch (error) {
    console.error('❌ Errore liberazione posizioni:', error);
    throw error;
  }
}
