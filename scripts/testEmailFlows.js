import { Resend } from 'resend';

// Inizializza Resend
const apiKey = process.env.RESEND_API_KEY;
if (!apiKey) {
  console.error('❌ RESEND_API_KEY non trovata');
  console.log('Esegui: $env:RESEND_API_KEY="la_tua_chiave"');
  process.exit(1);
}
const resend = new Resend(apiKey);

const EMAIL_TO_TEST = process.argv[2] || 'udemyteam2025@gmail.com';

async function testVerificationEmail() {
  console.log('\n═══════════════════════════════════════');
  console.log('📧 TEST 1: Invio Email via Resend');
  console.log('═══════════════════════════════════════');
  
  try {
    console.log('📤 Invio email di test verifica...');
    const result = await resend.emails.send({
      from: 'Equipe <noreply@tuaequipe.it>',
      to: EMAIL_TO_TEST,
      subject: '[TEST] Verifica il tuo indirizzo email - Equipé',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #0066cc; margin: 0;">Equipé</h1>
          </div>
          <h2 style="color: #0066cc;">🧪 Test Email di Verifica</h2>
          <p>Ciao!</p>
          <p>Questa è un'email di <strong>test</strong> per verificare che il sistema di invio email funzioni correttamente.</p>
          <p>Se ricevi questa email, il sistema Resend con il dominio <code>tuaequipe.it</code> funziona! ✅</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="https://tuaequipe.it" 
               style="background-color: #0066cc; color: white; padding: 14px 28px; 
                      text-decoration: none; border-radius: 8px; display: inline-block;
                      font-weight: bold; font-size: 16px;">
              Verifica Email (test)
            </a>
          </p>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #999; font-size: 12px;">Test inviato il ${new Date().toLocaleString('it-IT')}</p>
        </div>
      `,
    });

    console.log(`✅ Email di verifica inviata!`);
    console.log(`   Resend ID: ${result.data?.id || JSON.stringify(result)}`);
    return true;
  } catch (error) {
    console.error('❌ Errore:', error.message || error);
    return false;
  }
}

async function testPasswordResetEmail() {
  console.log('\n═══════════════════════════════════════');
  console.log('🔑 TEST 2: Email Reset Password');
  console.log('═══════════════════════════════════════');
  
  try {
    console.log('📤 Invio email test reset password...');
    const result = await resend.emails.send({
      from: 'Equipe <noreply@tuaequipe.it>',
      to: EMAIL_TO_TEST,
      subject: '[TEST] Reimposta la tua password - Equipé',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #0066cc; margin: 0;">Equipé</h1>
          </div>
          <h2 style="color: #0066cc;">🧪 Test Email Reset Password</h2>
          <p>Ciao!</p>
          <p>Questa è un'email di <strong>test</strong> per verificare il flusso di reimpostazione password.</p>
          <p>Se ricevi questa email, il sistema funziona correttamente! ✅</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="https://tuaequipe.it" 
               style="background-color: #0066cc; color: white; padding: 14px 28px; 
                      text-decoration: none; border-radius: 8px; display: inline-block;
                      font-weight: bold; font-size: 16px;">
              Reimposta Password (test)
            </a>
          </p>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #999; font-size: 12px;">Test inviato il ${new Date().toLocaleString('it-IT')}</p>
        </div>
      `,
    });

    console.log(`✅ Email reset password inviata!`);
    console.log(`   Resend ID: ${result.data?.id || JSON.stringify(result)}`);
    return true;
  } catch (error) {
    console.error('❌ Errore:', error.message || error);
    return false;
  }
}

async function main() {
  console.log('🧪 Test Email Flows per Equipé');
  console.log(`📬 Email di test: ${EMAIL_TO_TEST}`);
  console.log(`🕐 ${new Date().toLocaleString('it-IT')}`);

  const v = await testVerificationEmail();
  const r = await testPasswordResetEmail();

  console.log('\n═══════════════════════════════════════');
  console.log('📊 RISULTATI');
  console.log('═══════════════════════════════════════');
  console.log(`   Email verifica:  ${v ? '✅ OK' : '❌ FALLITO'}`);
  console.log(`   Reset password:  ${r ? '✅ OK' : '❌ FALLITO'}`);
  console.log(`\n💡 Controlla la casella ${EMAIL_TO_TEST} (anche spam) per verificare la ricezione.`);
  
  process.exit(0);
}

main();
