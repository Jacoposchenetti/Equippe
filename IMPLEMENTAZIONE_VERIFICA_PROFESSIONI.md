# Implementazione Nuovo Sistema di Verifica Professioni

## Riepilogo Modifiche

Sono state implementate le modifiche richieste per invertire la logica di registrazione, richiedendo prima la selezione delle professioni e poi la raccolta dei documenti necessari per la verifica.

## File Modificati/Creati

### Nuovi File Creati

1. **`src/lib/professioni.ts`**
   - Configurazione completa delle 17 professioni supportate
   - Definizione dei documenti richiesti per ogni professione
   - Distinzione tra professioni con albo e senza albo
   - Note informative specifiche per ciascuna professione

2. **`src/components/DocumentiProfessioneForm.tsx`**
   - Componente per la raccolta dei documenti di verifica
   - Supporto per l'upload di file allegati (PDF, JPG, PNG)
   - Validazione dei campi obbligatori
   - Campo note aggiuntive

### File Modificati

3. **`src/types/equippe.ts`**
   - Aggiunta interfacce `DocumentoVerifica`, `ProfessioneConDocumenti`
   - Aggiornamento `UserProfile` con campo `professioniConDocumenti`
   - Campi legacy mantenuti per retrocompatibilità

4. **`src/pages/RegisterPage.tsx`**
   - Rimozione campo "Numero albo" singolo
   - Rimozione checkbox "Specializzazioni"
   - Aggiunta gestione dinamica professioni con documenti
   - Interfaccia per aggiungere/rimuovere professioni
   - Upload documenti per ogni professione

5. **`src/pages/OnboardingPage.tsx`**
   - Stesse modifiche di RegisterPage per coerenza

6. **`src/app/register/page.tsx`** (versione Next.js)
   - Stesse modifiche di RegisterPage

7. **`src/app/onboarding/page.tsx`** (versione Next.js)
   - Stesse modifiche di OnboardingPage

## Nuova Logica di Registrazione

### Flusso Precedente
1. Inserimento numero albo
2. Selezione professioni (checkbox multiplo)
3. Altri dati

### Nuovo Flusso
1. Selezione professione da dropdown
2. Compilazione documenti specifici per quella professione:
   - Numeri di iscrizione ad albi (ove presenti)
   - Certificati e attestati
   - Upload file opzionali
   - Note aggiuntive
3. Ripetizione per ogni professione
4. Altri dati (tematiche, esperienza, studi, ecc.)

## Professioni Configurate

Tutte le 17 professioni sono state configurate con i rispettivi documenti:

- **Con Albo**: Psicologo, Psicoterapeuta, Psichiatra, Nutrizionista, Dietista, Dietologo, Assistente Sociale, Educatore Professionale, Logopedista, Fisioterapista, Terapista Occupazionale, Infermiere, Medico di Base, Medico Specialista, Ginecologo, Andrologo

- **Senza Albo Proprio**: Sessuologo (richiede albo della professione base + formazione specifica)

## Documenti Richiesti - Esempi

### Psicologo
- Numero iscrizione Albo degli Psicologi (obbligatorio)
- Sezione Albo - A o B (obbligatorio)

### Psichiatra
- Numero iscrizione Ordine dei Medici (obbligatorio)
- Specializzazione in Psichiatria (obbligatorio)

### Sessuologo
- Titolo di base (obbligatorio)
- Numero iscrizione Albo professione base (obbligatorio)
- Formazione in Sessuologia (obbligatorio)

## Caratteristiche Implementate

✅ Upload file per ogni documento (PDF, JPG, PNG)  
✅ Campo note aggiuntive per informazioni extra  
✅ Validazione campi obbligatori  
✅ Interfaccia intuitiva con feedback visivi  
✅ Retrocompatibilità con profili esistenti  
✅ Storage documenti su Firebase Storage  
✅ Verifica duplicati professioni  

## Struttura Dati Firestore

```javascript
{
  profile: {
    // Campi legacy (retrocompatibilità)
    albo: "",  // Deprecato, lasciato vuoto
    specializzazioni: ["Psicologo", "Psicoterapeuta"],  // Lista semplice
    
    // NUOVO campo
    professioniConDocumenti: [
      {
        professione: "Psicologo",
        documenti: [
          {
            tipo: "albo",
            nome: "Numero iscrizione Albo degli Psicologi",
            valore: "12345",
            fileURL: "https://..."  // opzionale
          },
          {
            tipo: "albo",
            nome: "Sezione Albo (A o B)",
            valore: "A"
          }
        ],
        note: "Iscritto dal 2020"  // opzionale
      }
    ],
    
    verified: false  // Da verificare manualmente dall'admin
  }
}
```

## Note per l'Amministrazione

- Gli utenti inseriscono i dati necessari alla registrazione
- Il campo `verified` rimane `false` finché non verificato dall'amministratore
- I documenti caricati sono accessibili su Firebase Storage in `verification-documents/{userId}/`
- La retrocompatibilità è garantita: il campo `specializzazioni` viene popolato automaticamente dalla lista delle professioni

## Prossimi Passi Suggeriti

1. Implementare pannello admin per la verifica dei documenti
2. Sistema di notifiche per utente quando verificato
3. Possibilità di richiedere documenti integrativi
4. Dashboard admin per visualizzare documenti caricati
