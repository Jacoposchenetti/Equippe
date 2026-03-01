import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT_DIR = process.cwd();
const FIREBASERC_PATH = join(ROOT_DIR, '.firebaserc');

const TARGET_FUNCTIONS = [
  'sendWelcomeEmail',
  'sendProfessionVerificationEmail',
  'sendProfessionStatusEmail',
  'sendProfessionApprovedEmail',
  'sendProfessionRejectedEmail',
  'sendNewMessageEmail',
  'sendTeamMessageEmail',
  'sendTeamInviteEmail',
  'sendTeamRequestStatusEmail',
  'sendReferralReceivedEmail',
  'sendReferralStatusEmail',
];

const ERROR_PATTERNS = [
  'Errore invio email',
  'RESEND_API_KEY',
  'finished with status: \'error\'',
  'Unhandled error',
  'permission_denied',
];

function loadProjectId() {
  try {
    const firebasercRaw = readFileSync(FIREBASERC_PATH, 'utf8');
    const firebaserc = JSON.parse(firebasercRaw);
    return firebaserc?.projects?.default || null;
  } catch {
    return null;
  }
}

function runCommand(command) {
  return execSync(command, {
    cwd: ROOT_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });
}

function main() {
  const projectId = loadProjectId();

  if (!projectId) {
    console.error('❌ Impossibile leggere il projectId da .firebaserc');
    process.exit(1);
  }

  console.log('🔎 Smoke test email Firebase');
  console.log(`📦 Project: ${projectId}`);
  console.log('📄 Recupero log Cloud Functions...');

  let logOutput = '';

  try {
    logOutput = runCommand(`firebase functions:log --project ${projectId}`);
  } catch (error) {
    const stderr = error?.stderr?.toString() || '';
    const stdout = error?.stdout?.toString() || '';
    console.error('❌ Errore eseguendo firebase functions:log');
    if (stdout.trim()) console.error(stdout);
    if (stderr.trim()) console.error(stderr);
    process.exit(1);
  }

  const lines = logOutput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    console.error('❌ Nessun log disponibile. Esegui prima qualche azione utente e riprova.');
    process.exit(1);
  }

  const summary = TARGET_FUNCTIONS.map((functionName) => {
    const related = lines.filter((line) => line.includes(functionName));
    const okCount = related.filter((line) => line.includes("finished with status: 'ok'"))
      .length;
    const errorLines = related.filter((line) =>
      ERROR_PATTERNS.some((pattern) => line.toLowerCase().includes(pattern.toLowerCase()))
    );

    return {
      functionName,
      seen: related.length > 0,
      okCount,
      errorCount: errorLines.length,
      hasFailureStatus: related.some((line) =>
        line.includes("finished with status: 'error'")
      ),
    };
  });

  const seenFunctions = summary.filter((item) => item.seen).length;
  const functionsWithOk = summary.filter((item) => item.okCount > 0).length;
  const functionsWithFailures = summary.filter(
    (item) => item.errorCount > 0 || item.hasFailureStatus
  ).length;

  console.log('\n📊 Risultato:');
  for (const item of summary) {
    if (!item.seen) {
      console.log(`- ⚪ ${item.functionName}: nessun log recente`);
      continue;
    }

    if (item.hasFailureStatus || item.errorCount > 0) {
      console.log(
        `- ❌ ${item.functionName}: ok=${item.okCount}, errori=${item.errorCount}`
      );
      continue;
    }

    if (item.okCount > 0) {
      console.log(`- ✅ ${item.functionName}: ok=${item.okCount}`);
      continue;
    }

    console.log(`- ⚠️ ${item.functionName}: visto nei log ma senza esecuzioni OK`);
  }

  const globalErrorLines = lines.filter((line) =>
    line.toLowerCase().includes('errore invio email') ||
    line.toLowerCase().includes('resend_api_key') ||
    line.includes("finished with status: 'error'")
  );

  console.log('\n🧪 Esito smoke test:');
  console.log(`- Funzioni viste nei log: ${seenFunctions}/${TARGET_FUNCTIONS.length}`);
  console.log(`- Funzioni con almeno un OK: ${functionsWithOk}`);
  console.log(`- Funzioni con segnali di errore: ${functionsWithFailures}`);
  console.log(`- Errori email globali trovati: ${globalErrorLines.length}`);

  if (globalErrorLines.length > 0 || functionsWithFailures > 0) {
    console.error('\n❌ Smoke test FALLITO: presenti errori nei log email.');
    process.exit(2);
  }

  if (functionsWithOk === 0) {
    console.error('\n⚠️ Smoke test INCONCLUSIVO: nessuna funzione email con stato OK nei log recenti.');
    process.exit(3);
  }

  console.log('\n✅ Smoke test SUPERATO: nessun errore email rilevato nei log recenti.');
}

main();