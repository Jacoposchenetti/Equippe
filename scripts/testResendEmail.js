import { Resend } from 'resend';

async function testEmail() {
  const apiKey = process.env.RESEND_API_KEY;
  
  if (!apiKey) {
    console.error('❌ RESEND_API_KEY non trovata nelle variabili d\'ambiente');
    console.log('Esegui: $env:RESEND_API_KEY="la_tua_chiave"');
    process.exit(1);
  }
  
  const resend = new Resend(apiKey);
  
  const testConfig = {
    from: 'Equipe <noreply@tuaequipe.it>',
    to: 'admin@tuaequipe.it',
    subject: 'Test Configurazione Resend - tuaequipe.it',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #4F46E5;">✅ Test Email Resend</h1>
        <p>Questa è un'email di test per verificare la configurazione di Resend con il dominio <strong>tuaequipe.it</strong>.</p>
        
        <h2>Dettagli Configurazione:</h2>
        <ul>
          <li><strong>From:</strong> noreply@tuaequipe.it</li>
          <li><strong>To:</strong> admin@tuaequipe.it</li>
          <li><strong>Dominio:</strong> tuaequipe.it</li>
          <li><strong>DNS:</strong> SPF e DKIM configurati</li>
        </ul>
        
        <p>Se ricevi questa email, la configurazione è corretta! 🎉</p>
        
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #E5E7EB;">
        <p style="color: #6B7280; font-size: 12px;">
          Test inviato il ${new Date().toLocaleString('it-IT')}
        </p>
      </div>
    `
  };
  
  console.log('📧 Invio email di test...');
  console.log('From:', testConfig.from);
  console.log('To:', testConfig.to);
  console.log('Subject:', testConfig.subject);
  console.log('');
  
  try {
    const result = await resend.emails.send(testConfig);
    
    console.log('✅ Email inviata con successo!');
    console.log('');
    console.log('📊 Risultato Resend:');
    console.log(JSON.stringify(result, null, 2));
    console.log('');
    console.log('🔍 Controlla la casella admin@tuaequipe.it per verificare la ricezione.');
    console.log('💡 Controlla anche la cartella Spam se non vedi l\'email.');
    
  } catch (error) {
    console.error('❌ Errore durante l\'invio:');
    console.error('');
    console.error('Messaggio:', error.message);
    if (error.response) {
      console.error('Response:', JSON.stringify(error.response, null, 2));
    }
    console.error('');
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testEmail();
