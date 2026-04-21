/**
 * Cloud Functions per la fatturazione elettronica.
 * CRUD fatture, generazione XML/PDF, export STS.
 */

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { Resend } from 'resend';
import { generateFatturaXML, generateNomeFileXML, type GenerateXMLInput } from './generateFatturaXML';
import { generateFatturaPDF, type GeneratePdfInput } from './generateFatturaPDF';
import { generateSTSXML, getNaturaIVA_STS, isPagamentoTracciato, type GenerateSTSInput } from './exportSTS';

// Lazy getters — avoids calling admin.firestore() at module load time
// (admin.initializeApp() is called in index.ts, which loads after this module)
const getDb = () => admin.firestore();
const getStorage = () => admin.storage();

// Lazy Resend getter (same pattern as index.ts)
let resendInstance: Resend | null = null;
function getResend(): Resend {
  if (!resendInstance) {
    resendInstance = new Resend(process.env.RESEND_API_KEY);
  }
  return resendInstance;
}

// ===== HELPER: Firebase Storage download URL senza signBlob =====
// Usa Firebase Storage download tokens invece di signed URLs (evita IAM signBlob)
function makeFirebaseDownloadUrl(bucketName: string, filePath: string, token: string): string {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(filePath)}?alt=media&token=${token}`;
}

async function saveWithDownloadUrl(bucket: any, filePath: string, content: Buffer | string, contentType: string): Promise<string> {
  const token = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const file = bucket.file(filePath);
  await file.save(content, {
    contentType,
    metadata: { metadata: { firebaseStorageDownloadTokens: token } },
  });
  return makeFirebaseDownloadUrl(bucket.name, filePath, token);
}

async function refreshDownloadUrl(bucket: any, filePath: string): Promise<string> {
  const token = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  await bucket.file(filePath).setMetadata({ metadata: { firebaseStorageDownloadTokens: token } });
  return makeFirebaseDownloadUrl(bucket.name, filePath, token);
}

// ===== HELPER: validate authenticated user =====
function getAuthUid(context: functions.https.CallableContext): string {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'Devi essere autenticato.');
  }
  return context.auth.uid;
}

// ===== HELPER: get fatturazione config =====
async function getFatturazioneConfig(uid: string) {
  const db = getDb();
  const configDoc = await db.collection('users').doc(uid)
    .collection('fatturazione_config').doc('config').get();
  if (!configDoc.exists) {
    throw new functions.https.HttpsError('failed-precondition', 'Configurazione fatturazione non trovata. Completa il setup.');
  }
  return configDoc.data()!;
}

// ===== HELPER: check soglia forfettario €85.000 =====
// Invia notifica in-app (campanella) + email se il fatturato annuo supera 80% o 100% di €85.000
async function checkSogliaForfettario(uid: string, anno: number, regimeFiscale: string): Promise<void> {
  if (!regimeFiscale || !regimeFiscale.startsWith('RF19')) return; // solo forfettari

  const SOGLIA = 85000;
  const db = getDb();

  try {
    // Somma imponibile di tutte le fatture emesse dell'anno
    const snapshot = await db.collection('users').doc(uid).collection('fatture')
      .where('stato', '==', 'emessa')
      .where('anno', '==', anno)
      .where('tipo', '==', 'fattura')
      .get();

    let totaleImponibile = 0;
    for (const doc of snapshot.docs) {
      totaleImponibile += doc.data().totali?.imponibile || 0;
    }

    const percentuale = totaleImponibile / SOGLIA;

    // Determina quale soglia è stata superata
    let sogliaKey: string | null = null;
    let notifType: string | null = null;
    let notifTitle: string | null = null;
    let notifMessage: string | null = null;
    let emailSubject: string | null = null;
    let emailHtml: string | null = null;

    if (percentuale >= 1.0) {
      sogliaKey = `${anno}_100`;
      notifType = 'soglia_forfettario_100';
      notifTitle = 'Soglia forfettario superata';
      notifMessage = `Hai superato €85.000 di fatturato per il ${anno}. Consulta il tuo commercialista per valutare il cambio regime.`;
      emailSubject = `Attenzione: hai superato il limite di €85.000 per il ${anno}`;
      emailHtml = `
        <h2 style="color: #B91C1C;">Attenzione: soglia forfettario superata</h2>
        <p>Il tuo fatturato per l'anno <strong>${anno}</strong> ha superato la soglia di <strong>€85.000</strong> prevista per il regime forfettario.</p>
        <p><strong>Fatturato attuale:</strong> €${totaleImponibile.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</p>
        <p>Superando questa soglia potresti perdere il diritto al regime forfettario per l'anno successivo. <strong>Consulta il tuo commercialista al più presto.</strong></p>
        <p>Puoi visualizzare le tue fatture nella sezione <a href="https://tuaequipe.it/fatturazione" style="color: #0066cc;">Fatture &amp; Fiscale</a>.</p>
      `;
    } else if (percentuale >= 0.8) {
      sogliaKey = `${anno}_80`;
      notifType = 'soglia_forfettario_80';
      notifTitle = 'Avviso: 80% del limite forfettario raggiunto';
      notifMessage = `Hai raggiunto €${Math.round(totaleImponibile).toLocaleString('it-IT')} su €85.000 (${Math.round(percentuale * 100)}%). Monitora il tuo fatturato.`;
      emailSubject = `Avviso: hai raggiunto l'80% del limite forfettario per il ${anno}`;
      emailHtml = `
        <h2 style="color: #D97706;">Avviso: 80% della soglia forfettaria raggiunta</h2>
        <p>Il tuo fatturato per l'anno <strong>${anno}</strong> ha raggiunto <strong>${Math.round(percentuale * 100)}%</strong> del limite di €85.000 previsto per il regime forfettario.</p>
        <p><strong>Fatturato attuale:</strong> €${totaleImponibile.toLocaleString('it-IT', { minimumFractionDigits: 2 })} su €${SOGLIA.toLocaleString('it-IT')}</p>
        <p>Ti restano ancora <strong>€${Math.round(SOGLIA - totaleImponibile).toLocaleString('it-IT')}</strong> prima di raggiungere il limite.</p>
        <p>Puoi visualizzare le tue fatture nella sezione <a href="https://tuaequipe.it/fatturazione" style="color: #0066cc;">Fatture &amp; Fiscale</a>.</p>
      `;
    }

    if (!sogliaKey || !notifType) return; // nessuna soglia raggiunta

    // Evita notifiche duplicate: verifica se già inviata per questo anno+soglia
    const notifSogliaRef = db.collection('users').doc(uid)
      .collection('fatturazione_config').doc(`soglia_notif_${sogliaKey}`);
    const alreadySent = await notifSogliaRef.get();
    if (alreadySent.exists) return;

    // Salva marker per evitare duplicati
    await notifSogliaRef.set({ sentAt: admin.firestore.Timestamp.now(), totale: totaleImponibile });

    // Recupera email utente
    let userEmail = '';
    try {
      const authUser = await admin.auth().getUser(uid);
      userEmail = authUser.email || '';
    } catch (_) { /* non bloccante */ }

    // Notifica in-app (campanella)
    await db.collection('notifications').add({
      userId: uid,
      type: notifType,
      title: notifTitle,
      message: notifMessage,
      read: false,
      createdAt: admin.firestore.Timestamp.now(),
    });

    // Email via Resend
    if (userEmail && emailSubject && emailHtml) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const wrappedHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <div style="text-align: center; padding: 24px 0 16px 0; border-bottom: 2px solid #0066cc;">
              <a href="https://tuaequipe.it" target="_blank">
                <img src="https://tuaequipe.it/logo-equipe.png" alt="tuaequipe.it" style="height: 180px; width: auto;" />
              </a>
            </div>
            <div style="padding: 24px 20px;">${emailHtml}</div>
            <div style="text-align: center; padding: 16px 20px; border-top: 1px solid #eee; color: #999; font-size: 12px;">
              <p style="margin: 4px 0;">&copy; ${anno} tuaequipe.it</p>
              <p style="margin: 4px 0;">La piattaforma per professionisti sanitari</p>
            </div>
          </div>
        `;
        await resend.emails.send({
          from: 'tuaequipe.it <noreply@tuaequipe.it>',
          to: userEmail,
          subject: emailSubject,
          html: wrappedHtml,
        });
        console.log(`✅ Email soglia forfettario inviata a ${userEmail} (${sogliaKey})`);
      } catch (emailErr) {
        console.error('❌ Errore invio email soglia:', emailErr);
      }
    }
  } catch (err) {
    // Non bloccare l'emissione fattura se il check fallisce
    console.error('❌ Errore checkSogliaForfettario:', err);
  }
}

// ===== EMETTI FATTURA =====
// Cambia stato da bozza a emessa, genera XML FatturaPA + PDF
export const emettiFattura = functions
  .region('europe-west1')
  .https.onCall(async (data: { fatturaId: string }, context) => {
    const uid = getAuthUid(context);
    const { fatturaId } = data;

    if (!fatturaId) {
      throw new functions.https.HttpsError('invalid-argument', 'fatturaId richiesto.');
    }

    const config = await getFatturazioneConfig(uid);
    const fatturaRef = getDb().collection('users').doc(uid).collection('fatture').doc(fatturaId);
    const fatturaDoc = await fatturaRef.get();

    if (!fatturaDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Fattura non trovata.');
    }

    const fattura = fatturaDoc.data()!;

    if (fattura.stato !== 'bozza') {
      throw new functions.https.HttpsError('failed-precondition', 'Solo le fatture in bozza possono essere emesse.');
    }

    const canale = fattura.canale || 'sdi'; // default SDI per retrocompatibilità

    // Prepara input PDF (sempre generato)
    const pdfInput = buildPDFInput(config, fattura);
    const pdfBuffer = await generateFatturaPDF(pdfInput);

    const bucket = getStorage().bucket();
    const progressivoInvio = String(fattura.numero).padStart(5, '0');
    const nomeFile = generateNomeFileXML(config.partitaIva, progressivoInvio);
    const pdfPath = `fatture/${uid}/${fattura.anno}/${nomeFile.replace('.xml', '.pdf')}`;
    const pdfUrl = await saveWithDownloadUrl(bucket, pdfPath, pdfBuffer, 'application/pdf');

    if (canale === 'sdi') {
      // FatturaPA XML per SDI (aziende, PA, prestazioni non sanitarie)
      const xmlInput = buildXMLInput(config, fattura, progressivoInvio);
      const xmlContent = generateFatturaXML(xmlInput);

      const xmlPath = `fatture/${uid}/${fattura.anno}/${nomeFile}`;
      const xmlUrl = await saveWithDownloadUrl(bucket, xmlPath, xmlContent, 'application/xml');

      await fatturaRef.update({
        stato: 'emessa',
        canale,
        xmlUrl,
        pdfUrl,
        xmlPath,
        pdfPath,
        emessaAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
      });

      // Check soglia €85k forfettario (fire-and-forget, non blocca il return)
      checkSogliaForfettario(uid, fattura.anno, config.regimeFiscale).catch(() => {});

      return { success: true, xmlUrl, pdfUrl, canale };
    } else {
      // Cartacea: solo PDF (prestazioni sanitarie a persona fisica — divieto SDI art.10-bis DL 119/2018)
      await fatturaRef.update({
        stato: 'emessa',
        canale,
        pdfUrl,
        pdfPath,
        emessaAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
      });

      // Check soglia €85k forfettario (fire-and-forget, non blocca il return)
      checkSogliaForfettario(uid, fattura.anno, config.regimeFiscale).catch(() => {});

      return { success: true, pdfUrl, canale };
    }
  });

// ===== RIGENERA DOWNLOAD URLS =====
// Rigenera URL firmati per XML/PDF (quando scadono dopo 7 giorni)
export const rigeneraDownloadUrls = functions
  .region('europe-west1')
  .https.onCall(async (data: { fatturaId: string }, context) => {
    const uid = getAuthUid(context);
    const { fatturaId } = data;

    const fatturaRef = getDb().collection('users').doc(uid).collection('fatture').doc(fatturaId);
    const fatturaDoc = await fatturaRef.get();

    if (!fatturaDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Fattura non trovata.');
    }

    const fattura = fatturaDoc.data()!;
    if (!fattura.pdfPath) {
      throw new functions.https.HttpsError('failed-precondition', 'Fattura non ancora emessa.');
    }

    const bucket = getStorage().bucket();
    const pdfUrl = await refreshDownloadUrl(bucket, fattura.pdfPath);

    if (fattura.xmlPath) {
      const xmlUrl = await refreshDownloadUrl(bucket, fattura.xmlPath);
      await fatturaRef.update({ xmlUrl, pdfUrl, updatedAt: admin.firestore.Timestamp.now() });
      return { success: true, xmlUrl, pdfUrl };
    } else {
      await fatturaRef.update({ pdfUrl, updatedAt: admin.firestore.Timestamp.now() });
      return { success: true, pdfUrl };
    }
  });

// ===== EXPORT STS =====
// Genera XML MEF v5 per upload massivo su sistemats.sanita.finanze.it
export const exportSTS = functions
  .region('europe-west1')
  .https.onCall(async (data: { anno: number; mese?: number }, context) => {
    const uid = getAuthUid(context);
    const { anno, mese } = data;

    const config = await getFatturazioneConfig(uid);
    const naturaIVA = getNaturaIVA_STS(config.regimeFiscale);

    const db = getDb();
    const snapshot = await db.collection('users').doc(uid).collection('fatture')
      .where('stato', '==', 'emessa')
      .where('anno', '==', anno)
      .where('tipo', '==', 'fattura')
      .where('idoneaSTS', '==', true)
      .get();

    const fatture = snapshot.docs
      .map(doc => doc.data())
      .filter(f => {
        if (mese !== undefined) {
          return parseInt(f.dataEmissione.split('-')[1], 10) === mese;
        }
        return true;
      });

    const stsInput: GenerateSTSInput = {
      cfProfessionista: config.codiceFiscale,
      partitaIva: config.partitaIva,
      spese: fatture.map(f => ({
        cfPaziente: f.clienteSnapshot.codiceFiscale,
        flagOpposizione: 0 as const,
        tipoDocumento: 'F' as const,
        dataDocumento: f.dataEmissione,
        numDocumento: f.numeroFormattato || `${f.numero}/${f.anno}`,
        importo: f.totali.totaleDocumento,
        naturaIVA,
        tipoSpesa: 'SR' as const,
        flagOperazione: 'I' as const,
        pagamentoTracciato: isPagamentoTracciato(f.metodoPagamento),
        dataPagamento: f.dataPagamento || undefined,
      })),
    };

    const xmlContent = generateSTSXML(stsInput);
    const bucket = getStorage().bucket();
    const fileName = mese
      ? `export_sts_${anno}_${String(mese).padStart(2, '0')}.xml`
      : `export_sts_${anno}.xml`;
    const filePath = `fatture/${uid}/sts/${fileName}`;
    const downloadUrl = await saveWithDownloadUrl(bucket, filePath, xmlContent, 'application/xml');

    return { success: true, downloadUrl, count: fatture.length };
  });

// ===== EXPORT COMMERCIALISTA =====
// Genera CSV riepilogativo per il commercialista
export const exportCommercialistaCSV = functions
  .region('europe-west1')
  .https.onCall(async (data: { anno: number }, context) => {
    const uid = getAuthUid(context);
    const { anno } = data;

    const db = getDb();
    const snapshot = await db.collection('users').doc(uid).collection('fatture')
      .where('stato', '==', 'emessa')
      .where('anno', '==', anno)
      .get();

    const header = [
      'Numero', 'Data', 'Tipo', 'Cliente', 'CF_Cliente', 'P.IVA_Cliente',
      'Imponibile', 'Cassa_Previdenziale', 'IVA', 'Ritenuta_Acconto',
      'Bollo', 'Totale', 'Netto_A_Pagare', 'Metodo_Pagamento', 'Stato_Pagamento', 'Data_Incasso',
    ].join(';');

    const rows = (snapshot.docs
      .map(doc => ({ id: doc.id, ...(doc.data() as any) }))
      .sort((a: any, b: any) => (a.numero || 0) - (b.numero || 0)) as any[])
      .map((f: any) => {
      const cliente = (f.clienteSnapshot as Record<string, any>) || {};
      const nomeCliente = cliente.tipo === 'persona_giuridica'
        ? cliente.ragioneSociale || ''
        : `${cliente.nome || ''} ${cliente.cognome || ''}`.trim();

      return [
        f.numeroFormattato || `${f.numero}/${f.anno}`,
        f.dataEmissione,
        f.tipo,
        nomeCliente,
        cliente.codiceFiscale || '',
        cliente.partitaIva || '',
        f.totali?.imponibile?.toFixed(2) || '0.00',
        f.totali?.cassaPrevidenziale?.toFixed(2) || '0.00',
        f.totali?.totaleIva?.toFixed(2) || '0.00',
        f.totali?.ritenuataAcconto?.toFixed(2) || '0.00',
        f.totali?.bolloVirtuale?.toFixed(2) || '0.00',
        f.totali?.totaleDocumento?.toFixed(2) || '0.00',
        f.totali?.nettoAPagare?.toFixed(2) || '0.00',
        f.metodoPagamento || '',
        f.statoPagamento || 'non_pagata',
        f.dataIncasso || '',
      ].join(';');
    });

    const csvContent = [header, ...rows].join('\n');
    const bucket = getStorage().bucket();
    const fileName = `riepilogo_fatture_${anno}.csv`;
    const filePath = `fatture/${uid}/export/${fileName}`;
    const downloadUrl = await saveWithDownloadUrl(bucket, filePath, csvContent, 'text/csv');

    return { success: true, downloadUrl, count: snapshot.docs.length, csvContent };
  });

// ===== HELPER: Build XML input =====
function buildXMLInput(config: any, fattura: any, progressivoInvio: string): GenerateXMLInput {
  const cliente = fattura.clienteSnapshot;
  const isAzienda = cliente.tipo === 'persona_giuridica';

  // Determina se tutte le righe sono esenti (per forfettario o sanitario)
  const regimeFiscale = config.regimeFiscale;
  const codiceRegime = regimeFiscale === 'forfettario' ? 'RF19' : 'RF01';

  // Prepara righe
  const righe = fattura.righe.map((r: any, i: number) => ({
    numeroLinea: i + 1,
    descrizione: r.descrizione,
    quantita: r.quantita,
    prezzoUnitario: r.prezzoUnitario,
    prezzoTotale: r.quantita * r.prezzoUnitario,
    aliquotaIva: regimeFiscale === 'forfettario' ? 0 : r.aliquotaIva,
    natura: regimeFiscale === 'forfettario' ? 'N2.2' : r.naturaEsenzione,
  }));

  // Riepiloghi IVA
  const ivaMap = new Map<string, { aliquota: number; natura?: string; imponibile: number; imposta: number; rif?: string }>();
  for (const entry of fattura.totali.ivaPerAliquota) {
    const key = entry.natura ? `N_${entry.natura}` : `A_${entry.aliquota}`;
    ivaMap.set(key, {
      aliquota: entry.aliquota,
      natura: entry.natura,
      imponibile: entry.imponibile,
      imposta: entry.imposta,
      rif: entry.natura === 'N4' ? 'Art. 10, c.1, n.18 DPR 633/72'
        : entry.natura === 'N2.2' ? 'Art.1, c.54-89, L.190/2014 - Regime forfettario'
        : undefined,
    });
  }

  const result: GenerateXMLInput = {
    progressivoInvio,
    tipoDocumento: fattura.tipo === 'nota_credito' ? 'TD04' : 'TD01',
    formatoTrasmissione: 'FPR12',
    cedente: {
      partitaIva: config.partitaIva,
      codiceFiscale: config.codiceFiscale,
      nome: config.nome,
      cognome: config.cognome,
      regimeFiscale: codiceRegime,
      indirizzo: config.indirizzo,
      cap: config.cap,
      comune: config.città,
      provincia: config.provincia,
      nazione: config.nazione || 'IT',
    },
    cessionario: {
      tipo: cliente.tipo,
      codiceFiscale: cliente.codiceFiscale,
      partitaIva: cliente.partitaIva,
      nome: cliente.nome,
      cognome: cliente.cognome,
      ragioneSociale: cliente.ragioneSociale,
      indirizzo: cliente.indirizzo,
      cap: cliente.cap,
      comune: cliente.città,
      provincia: cliente.provincia,
      nazione: cliente.nazione || 'IT',
      codiceDestinatario: isAzienda ? (cliente.codiceDestinatario || '0000000') : '0000000',
      pec: cliente.pec,
    },
    numero: fattura.numeroFormattato || `${fattura.numero}/${fattura.anno}`,
    data: fattura.dataEmissione,
    righe,
    riepiloghi: Array.from(ivaMap.values()).map(e => ({
      aliquotaIva: e.aliquota,
      natura: e.natura,
      imponibile: e.imponibile,
      imposta: e.imposta,
      riferimentoNormativo: e.rif,
    })),
    pagamento: {
      modalitaPagamento: fattura.metodoPagamento === 'Contanti' ? 'MP01'
        : fattura.metodoPagamento === 'Carta di pagamento' ? 'MP08'
        : 'MP05', // default bonifico
      importoPagamento: fattura.totali.nettoAPagare,
      iban: fattura.ibanPagamento,
    },
    totaleDocumento: fattura.totali.totaleDocumento,
  };

  // Cassa previdenziale
  if (fattura.totali.cassaPrevidenziale > 0 && config.cassaPrevidenziale) {
    // La cassa segue l'aliquota IVA delle righe:
    // - Forfettario: 0% con natura N2.2
    // - Ordinario sanitaria esente art.10: 0% con natura N4
    // - Ordinario non sanitaria: aliquota IVA effettiva, senza natura
    const primaRiga = fattura.righe?.[0];
    const isSanitariaEsente = primaRiga?.naturaEsenzione === 'N4';
    const ivaAliquotaForCassa = regimeFiscale === 'forfettario' ? 0
      : isSanitariaEsente ? 0
      : (primaRiga?.aliquotaIva ?? 22);
    const naturaCassa = regimeFiscale === 'forfettario' ? 'N2.2'
      : isSanitariaEsente ? 'N4'
      : undefined;
    result.datiCassa = {
      tipoCassa: config.cassaPrevidenziale.codice,
      alCassa: config.cassaPrevidenziale.aliquota,
      importoContributoCassa: fattura.totali.cassaPrevidenziale,
      imponibileCassa: fattura.totali.imponibile,
      aliquotaIva: ivaAliquotaForCassa,
      natura: naturaCassa,
    };
  }

  // Bollo virtuale
  if (fattura.totali.bolloVirtuale > 0) {
    result.datiBollo = { importoBollo: fattura.totali.bolloVirtuale };
  }

  // Ritenuta d'acconto
  if (fattura.totali.ritenuataAcconto > 0) {
    result.ritenuta = {
      tipoRitenuta: 'RT01',
      importoRitenuta: fattura.totali.ritenuataAcconto,
      aliquotaRitenuta: 20,
      causalePagamento: 'A', // prestazioni di lavoro autonomo
    };
  }

  // Riferimento fattura (per nota di credito)
  if (fattura.fatturaRiferimentoNumero) {
    result.riferimentoFattura = {
      numero: fattura.fatturaRiferimentoNumero,
      data: fattura.dataEmissione,
    };
  }

  return result;
}

// ===== HELPER: Build PDF input =====
function buildPDFInput(config: any, fattura: any): GeneratePdfInput {
  const cliente = fattura.clienteSnapshot;
  const tipoLabel = fattura.tipo === 'nota_credito' ? 'Nota di Credito'
    : fattura.tipo === 'proforma' ? 'Proforma'
    : 'Fattura';

  const dataFormatted = fattura.dataEmissione.split('-').reverse().join('/');

  const diciture: string[] = [];
  if (config.regimeFiscale === 'forfettario') {
    diciture.push('Operazione effettuata ai sensi dell\'art. 1, commi da 54 a 89, della Legge n. 190/2014 e successive modificazioni (L. 208/2015, L. 145/2018) - Regime forfettario. Operazione senza applicazione dell\'IVA.');
    diciture.push('Compenso non assoggettato a ritenuta d\'acconto ai sensi dell\'art. 1, c. 67, L. 190/2014.');
  }
  // Check if any riga is esente N4
  const hasEsente = fattura.righe.some((r: any) => r.naturaEsenzione === 'N4');
  if (hasEsente && config.regimeFiscale !== 'forfettario') {
    diciture.push('Prestazione sanitaria esente IVA ai sensi dell\'art. 10, comma 1, n. 18, DPR 633/72.');
  }
  if (fattura.totali.bolloVirtuale > 0) {
    diciture.push('Imposta di bollo assolta in modo virtuale ai sensi del D.M. 17/06/2014');
  }

  const cassaLabel = config.cassaPrevidenziale
    ? `${config.cassaPrevidenziale.nome} ${config.cassaPrevidenziale.aliquota}%`
    : 'Cassa prev.';

  return {
    tipoDocumento: tipoLabel,
    numero: fattura.numeroFormattato || `${fattura.numero}/${fattura.anno}`,
    data: dataFormatted,
    riferimentoFattura: fattura.fatturaRiferimentoNumero,
    cedente: {
      nome: config.nome,
      cognome: config.cognome,
      partitaIva: config.partitaIva,
      codiceFiscale: config.codiceFiscale,
      indirizzo: config.indirizzo,
      cap: config.cap,
      città: config.città,
      provincia: config.provincia,
      email: config.emailFatturazione,
      iban: fattura.ibanPagamento || config.iban,
    },
    cliente: {
      tipo: cliente.tipo,
      nome: cliente.nome,
      cognome: cliente.cognome,
      ragioneSociale: cliente.ragioneSociale,
      codiceFiscale: cliente.codiceFiscale,
      partitaIva: cliente.partitaIva,
      indirizzo: cliente.indirizzo,
      cap: cliente.cap,
      città: cliente.città,
      provincia: cliente.provincia,
    },
    righe: fattura.righe.map((r: any) => ({
      descrizione: r.descrizione,
      quantita: r.quantita,
      prezzoUnitario: r.prezzoUnitario,
      totale: r.quantita * r.prezzoUnitario,
      iva: r.naturaEsenzione ? `Esente ${r.naturaEsenzione}` : `${r.aliquotaIva}%`,
    })),
    totali: {
      imponibile: fattura.totali.imponibile,
      cassaPrevidenziale: fattura.totali.cassaPrevidenziale,
      cassaLabel,
      totaleIva: fattura.totali.totaleIva,
      ritenuataAcconto: fattura.totali.ritenuataAcconto,
      bolloVirtuale: fattura.totali.bolloVirtuale,
      totaleDocumento: fattura.totali.totaleDocumento,
      nettoAPagare: fattura.totali.nettoAPagare,
    },
    metodoPagamento: fattura.metodoPagamento || 'Bonifico bancario',
    note: fattura.note,
    diciture,
  };
}

// ===== CREA FATTURA BOZZA (numerazione atomica) =====
export const creaFatturaBozza = functions
  .region('europe-west1')
  .https.onCall(async (data: { fatturaData: any }, context) => {
    const uid = getAuthUid(context);
    const { fatturaData } = data;

    // Validazione input
    if (!fatturaData || !fatturaData.tipo || !['fattura', 'proforma', 'nota_credito'].includes(fatturaData.tipo)) {
      throw new functions.https.HttpsError('invalid-argument', 'Tipo documento non valido.');
    }
    if (!fatturaData.dataEmissione || !/^\d{4}-\d{2}-\d{2}$/.test(fatturaData.dataEmissione)) {
      throw new functions.https.HttpsError('invalid-argument', 'Data emissione non valida.');
    }
    if (!fatturaData.clienteId || !fatturaData.righe?.length) {
      throw new functions.https.HttpsError('invalid-argument', 'Cliente e righe obbligatori.');
    }

    const db = getDb();
    const configRef = db.collection('users').doc(uid).collection('fatturazione_config').doc('config');
    const fattureCol = db.collection('users').doc(uid).collection('fatture');

    const result = await db.runTransaction(async (tx) => {
      const configDoc = await tx.get(configRef);
      if (!configDoc.exists) {
        throw new functions.https.HttpsError('failed-precondition', 'Configurazione fatturazione non trovata. Completa il setup.');
      }
      const config = configDoc.data()!;

      const anno = new Date(fatturaData.dataEmissione).getFullYear();

      // Seleziona contatore in base al tipo
      let counterField: string;
      if (fatturaData.tipo === 'nota_credito') {
        counterField = 'prossimoNumeroNotaCredito';
      } else if (fatturaData.tipo === 'proforma') {
        counterField = 'prossimoNumeroProforma';
      } else {
        counterField = 'prossimoNumeroFattura';
      }

      // Reset contatori se anno è cambiato
      let numero: number;
      if (config.annoCorrente !== anno) {
        numero = 1;
        tx.update(configRef, {
          annoCorrente: anno,
          prossimoNumeroFattura: fatturaData.tipo === 'fattura' ? 2 : 1,
          prossimoNumeroProforma: fatturaData.tipo === 'proforma' ? 2 : 1,
          prossimoNumeroNotaCredito: fatturaData.tipo === 'nota_credito' ? 2 : 1,
          updatedAt: admin.firestore.Timestamp.now(),
        });
      } else {
        numero = config[counterField] || 1;
        tx.update(configRef, {
          [counterField]: numero + 1,
          updatedAt: admin.firestore.Timestamp.now(),
        });
      }

      const numeroFormattato = `${numero}/${anno}`;
      const fatturaRef = fattureCol.doc();

      // Whitelist dei campi accettati dal client
      tx.set(fatturaRef, {
        tipo: fatturaData.tipo,
        dataEmissione: fatturaData.dataEmissione,
        dataScadenza: fatturaData.dataScadenza || null,
        clienteId: fatturaData.clienteId,
        clienteSnapshot: fatturaData.clienteSnapshot,
        righe: fatturaData.righe,
        totali: fatturaData.totali,
        metodoPagamento: fatturaData.metodoPagamento || null,
        ibanPagamento: fatturaData.ibanPagamento || null,
        note: fatturaData.note || null,
        canale: fatturaData.canale === 'cartacea' ? 'cartacea' : 'sdi', // sanitizza: solo valori noti
        idoneaSTS: !!fatturaData.idoneaSTS,
        fatturaRiferimentoId: fatturaData.fatturaRiferimentoId || null,
        fatturaRiferimentoNumero: fatturaData.fatturaRiferimentoNumero || null,
        // Campi server-assigned
        numero,
        anno,
        numeroFormattato,
        stato: 'bozza',
        statoPagamento: 'non_pagata',
        inviatoSTS: false,
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
      });

      return { fatturaId: fatturaRef.id, numero, numeroFormattato };
    });

    return { success: true, ...result };
  });

// ===== SEGNA COME PAGATA =====
export const segnaComePagata = functions
  .region('europe-west1')
  .https.onCall(async (data: { fatturaId: string; dataPagamento?: string }, context) => {
    const uid = getAuthUid(context);
    const { fatturaId, dataPagamento } = data;

    if (!fatturaId) {
      throw new functions.https.HttpsError('invalid-argument', 'fatturaId richiesto.');
    }

    const fatturaRef = getDb().collection('users').doc(uid).collection('fatture').doc(fatturaId);
    const fatturaDoc = await fatturaRef.get();

    if (!fatturaDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Fattura non trovata.');
    }

    const fattura = fatturaDoc.data()!;
    const nuovoStato = fattura.statoPagamento === 'pagata' ? 'non_pagata' : 'pagata';

    const updateData: any = {
      statoPagamento: nuovoStato,
      updatedAt: admin.firestore.Timestamp.now(),
    };

    if (nuovoStato === 'pagata') {
      updateData.dataPagamento = dataPagamento || new Date().toISOString().split('T')[0];
    } else {
      updateData.dataPagamento = admin.firestore.FieldValue.delete();
    }

    await fatturaRef.update(updateData);

    return { success: true, statoPagamento: nuovoStato };
  });

// ===== INVIA FATTURA VIA EMAIL =====
export const inviaFatturaEmail = functions
  .region('europe-west1')
  .runWith({ timeoutSeconds: 60, memory: '256MB' })
  .https.onCall(async (data: { fatturaId: string; emailOverride?: string }, context) => {
    const uid = getAuthUid(context);
    const { fatturaId, emailOverride } = data;

    if (!fatturaId) {
      throw new functions.https.HttpsError('invalid-argument', 'fatturaId richiesto.');
    }

    // Validate emailOverride format if provided
    if (emailOverride && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailOverride)) {
      throw new functions.https.HttpsError('invalid-argument', 'Formato email non valido.');
    }

    const config = await getFatturazioneConfig(uid);
    const fatturaRef = getDb().collection('users').doc(uid).collection('fatture').doc(fatturaId);
    const fatturaDoc = await fatturaRef.get();

    if (!fatturaDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Fattura non trovata.');
    }

    const fattura = fatturaDoc.data()!;

    if (!fattura.pdfPath) {
      throw new functions.https.HttpsError('failed-precondition', 'PDF non ancora generato. Emetti prima la fattura.');
    }

    // Determina email destinatario
    const clienteEmail = emailOverride || fattura.clienteSnapshot?.email;
    if (!clienteEmail) {
      throw new functions.https.HttpsError('invalid-argument', 'Il cliente non ha un indirizzo email. Specifica un indirizzo.');
    }

    // Scarica PDF da Storage
    const bucket = getStorage().bucket();
    const [pdfBuffer] = await bucket.file(fattura.pdfPath).download();

    // Costruisci email
    const nomeCliente = fattura.clienteSnapshot.tipo === 'persona_giuridica'
      ? fattura.clienteSnapshot.ragioneSociale || ''
      : `${fattura.clienteSnapshot.nome || ''} ${fattura.clienteSnapshot.cognome || ''}`.trim();

    const nomeProfessionista = `${config.nome} ${config.cognome}`;
    const tipoLabel = fattura.tipo === 'nota_credito' ? 'Nota di Credito'
      : fattura.tipo === 'proforma' ? 'Proforma' : 'Fattura';
    const numero = fattura.numeroFormattato || `${fattura.numero}/${fattura.anno}`;
    const fileName = `${tipoLabel.replace(/\s/g, '_')}_${numero.replace('/', '-')}.pdf`;

    const subject = `${tipoLabel} n. ${numero} - ${nomeProfessionista}`;

    const dataFormattata = fattura.dataEmissione.split('-').reverse().join('/');
    const scadenzaFormattata = fattura.dataScadenza
      ? fattura.dataScadenza.split('-').reverse().join('/') : null;

    const html = buildFatturaEmailHtml({
      nomeCliente,
      tipoLabel: tipoLabel.toLowerCase(),
      numero,
      dataFormattata,
      totaleDocumento: fattura.totali.totaleDocumento,
      nettoAPagare: fattura.totali.nettoAPagare,
      ritenuataAcconto: fattura.totali.ritenuataAcconto,
      scadenzaFormattata,
      iban: fattura.ibanPagamento,
      nomeProfessionista,
    });

    // Invia con Resend
    await getResend().emails.send({
      from: `${nomeProfessionista} via tuaequipe.it <noreply@tuaequipe.it>`,
      replyTo: config.emailFatturazione || undefined,
      to: clienteEmail,
      subject,
      html: wrapFatturaEmailTemplate(html),
      attachments: [{
        filename: fileName,
        content: pdfBuffer,
      }],
    });

    // Aggiorna fattura
    await fatturaRef.update({
      emailInviataAt: admin.firestore.Timestamp.now(),
      emailInviataA: clienteEmail,
      updatedAt: admin.firestore.Timestamp.now(),
    });

    return { success: true, emailTo: clienteEmail };
  });

// ===== HELPERS per email fattura =====
function formatEuroBE(amount: number): string {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount);
}

function buildFatturaEmailHtml(data: {
  nomeCliente: string;
  tipoLabel: string;
  numero: string;
  dataFormattata: string;
  totaleDocumento: number;
  nettoAPagare: number;
  ritenuataAcconto: number;
  scadenzaFormattata: string | null;
  iban?: string;
  nomeProfessionista: string;
}): string {
  const righeTabella = [
    `<tr><td style="padding: 4px 16px 4px 0; color: #666;">Importo:</td><td style="font-weight: bold;">${formatEuroBE(data.totaleDocumento)}</td></tr>`,
  ];
  if (data.ritenuataAcconto > 0) {
    righeTabella.push(
      `<tr><td style="padding: 4px 16px 4px 0; color: #666;">Netto a pagare:</td><td style="font-weight: bold;">${formatEuroBE(data.nettoAPagare)}</td></tr>`
    );
  }
  if (data.scadenzaFormattata) {
    righeTabella.push(
      `<tr><td style="padding: 4px 16px 4px 0; color: #666;">Scadenza:</td><td>${data.scadenzaFormattata}</td></tr>`
    );
  }

  return `
    <p>Gentile ${data.nomeCliente},</p>
    <p>in allegato trova la ${data.tipoLabel} n. <strong>${data.numero}</strong> del ${data.dataFormattata}.</p>
    <table style="margin: 20px 0; border-collapse: collapse;">
      ${righeTabella.join('\n')}
    </table>
    ${data.iban ? `<p style="color: #666; font-size: 14px;">IBAN per il pagamento: <strong>${data.iban}</strong></p>` : ''}
    <p style="margin-top: 20px; color: #666; font-size: 14px;">Cordiali saluti,<br/><strong>${data.nomeProfessionista}</strong></p>
  `;
}

function wrapFatturaEmailTemplate(bodyHtml: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
      <div style="text-align: center; padding: 24px 0 16px 0; border-bottom: 2px solid #0066cc;">
        <a href="https://tuaequipe.it" target="_blank">
          <img src="https://tuaequipe.it/logo-equipe.png" alt="tuaequipe.it" style="height: 180px; width: auto;" />
        </a>
      </div>
      <div style="padding: 24px 20px;">
        ${bodyHtml}
      </div>
      <div style="text-align: center; padding: 16px 20px; border-top: 1px solid #eee; color: #999; font-size: 12px;">
        <p style="margin: 4px 0;">&copy; ${new Date().getFullYear()} tuaequipe.it</p>
        <p style="margin: 4px 0;">Email inviata tramite tuaequipe.it per conto del professionista</p>
      </div>
    </div>
  `;
}

// ===== ANTEPRIMA PDF (senza emettere) =====
export const anteprimaFatturaPDF = functions
  .region('europe-west1')
  .runWith({ timeoutSeconds: 30, memory: '256MB' })
  .https.onCall(async (data: { fatturaData: any }, context) => {
    const uid = getAuthUid(context);
    const { fatturaData } = data;

    if (!fatturaData || !fatturaData.righe?.length) {
      throw new functions.https.HttpsError('invalid-argument', 'Dati fattura incompleti.');
    }

    const config = await getFatturazioneConfig(uid);

    // Build a temporary fattura object for PDF generation
    const tempFattura = {
      ...fatturaData,
      numero: fatturaData.numero || 0,
      anno: fatturaData.anno || new Date().getFullYear(),
      numeroFormattato: fatturaData.numeroFormattato || 'ANTEPRIMA',
    };

    const pdfInput = buildPDFInput(config, tempFattura);
    const pdfBuffer = await generateFatturaPDF(pdfInput);

    // Return PDF as base64 (avoids signBlob permission issues)
    const pdfBase64 = pdfBuffer.toString('base64');

    return { success: true, pdfBase64 };
  });

// ===== EXPORT STS CON TRACKING =====
// Sovrascrive la funzione base aggiungendo il tracking degli invii
export const exportSTSTracked = functions
  .region('europe-west1')
  .https.onCall(async (data: { anno: number; mese?: number; soloNonInviati?: boolean }, context) => {
    const uid = getAuthUid(context);
    const { anno, mese, soloNonInviati } = data;

    const config = await getFatturazioneConfig(uid);

    const db = getDb();
    const queryRef = db.collection('users').doc(uid).collection('fatture')
      .where('stato', '==', 'emessa')
      .where('anno', '==', anno)
      .where('tipo', '==', 'fattura')
      .where('idoneaSTS', '==', true);

    const snapshot = await queryRef.get();

    let fatture = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter((f: any) => {
        if (mese !== undefined) {
          const meseEmissione = parseInt(f.dataEmissione.split('-')[1], 10);
          if (meseEmissione !== mese) return false;
        }
        // Filtra solo quelle non ancora inviate se richiesto
        if (soloNonInviati && f.inviatoSTS) return false;
        return true;
      });

    if (fatture.length === 0) {
      return { success: true, downloadUrl: null, count: 0, message: soloNonInviati
        ? 'Tutte le fatture idonee sono già state esportate per STS.'
        : 'Nessuna fattura idonea per STS trovata nel periodo.'
      };
    }

    const stsInput: GenerateSTSInput = {
      cfProfessionista: config.codiceFiscale,
      partitaIva: config.partitaIva,
      spese: fatture.map((f: any) => ({
        cfPaziente: f.clienteSnapshot.codiceFiscale,
        flagOpposizione: 0 as const,
        tipoDocumento: 'F' as const,
        dataDocumento: f.dataEmissione,
        numDocumento: f.numeroFormattato || `${f.numero}/${f.anno}`,
        importo: f.totali.totaleDocumento,
        naturaIVA: getNaturaIVA_STS(config.regimeFiscale),
        tipoSpesa: 'SR' as const,
        flagOperazione: 'I' as const,
        pagamentoTracciato: isPagamentoTracciato(f.metodoPagamento),
        dataPagamento: f.dataPagamento || undefined,
      })),
    };

    const xmlContent = generateSTSXML(stsInput);

    const bucket = getStorage().bucket();
    const fileName = mese
      ? `export_sts_${anno}_${String(mese).padStart(2, '0')}.xml`
      : `export_sts_${anno}.xml`;
    const filePath = `fatture/${uid}/sts/${fileName}`;
    const downloadUrl = await saveWithDownloadUrl(bucket, filePath, xmlContent, 'application/xml');

    // Segna tutte le fatture esportate come inviate
    const batch = db.batch();
    const now = admin.firestore.Timestamp.now();
    for (const f of fatture) {
      const ref = db.collection('users').doc(uid).collection('fatture').doc(f.id);
      batch.update(ref, {
        inviatoSTS: true,
        inviatoSTSAt: now,
        updatedAt: now,
      });
    }
    await batch.commit();

    return { success: true, downloadUrl, count: fatture.length, xmlContent };
  });

// ===== RESET FLAG STS (annulla invio) =====
export const resetInvioSTS = functions
  .region('europe-west1')
  .https.onCall(async (data: { fatturaId: string }, context) => {
    const uid = getAuthUid(context);
    const { fatturaId } = data;

    if (!fatturaId) {
      throw new functions.https.HttpsError('invalid-argument', 'fatturaId richiesto.');
    }

    const fatturaRef = getDb().collection('users').doc(uid).collection('fatture').doc(fatturaId);
    const fatturaDoc = await fatturaRef.get();

    if (!fatturaDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Fattura non trovata.');
    }

    await fatturaRef.update({
      inviatoSTS: false,
      inviatoSTSAt: admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.Timestamp.now(),
    });

    return { success: true };
  });
