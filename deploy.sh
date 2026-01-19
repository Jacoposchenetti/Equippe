#!/bin/bash
# Script di deployment per Aruba

echo "🚀 Inizio deployment su Aruba..."

# 1. Build del progetto
echo "📦 Building del progetto..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build fallito. Interrompo il deployment."
    exit 1
fi

echo "✅ Build completato con successo!"

# 2. Preparazione file per upload
echo "📁 Preparazione file per l'upload..."

# Controlla se esiste la cartella .next
if [ ! -d ".next" ]; then
    echo "❌ Cartella .next non trovata. Assicurati che il build sia completato."
    exit 1
fi

echo "📋 File pronti per l'upload:"
echo "   - .next/ (cartella build Next.js)"
echo "   - public/ (assets statici)"
echo "   - .htaccess (configurazione server)"
echo "   - package.json"

echo ""
echo "📤 ISTRUZIONI PER L'UPLOAD SU ARUBA:"
echo "============================================="
echo ""
echo "1. Connettiti al tuo hosting Aruba via FTP/SFTP"
echo "2. Carica tutti i file nella cartella public_html/"
echo "3. Struttura da caricare:"
echo "   public_html/"
echo "   ├── .next/ (tutta la cartella)"
echo "   ├── public/ (contenuto della cartella, non la cartella stessa)"
echo "   ├── .htaccess"
echo "   └── package.json"
echo ""
echo "4. Assicurati che il file .htaccess sia nella root (public_html/)"
echo "5. Configura le variabili d'ambiente nel pannello Aruba"
echo ""
echo "🌍 Il sito sarà disponibile su: https://tuaequipe.it"
echo ""

# 3. Creazione archivio per facilità di upload (opzionale)
read -p "Vuoi creare un archivio ZIP per l'upload? (y/n): " create_zip

if [[ $create_zip == "y" || $create_zip == "Y" ]]; then
    echo "📦 Creazione archivio deployment..."
    
    # Rimuovi archivio precedente se esiste
    rm -f deployment.zip
    
    # Crea archivio con i file necessari
    zip -r deployment.zip .next public .htaccess package.json -x "public/firebase-messaging-sw.js.map"
    
    echo "✅ Archivio deployment.zip creato!"
    echo "   Puoi estrarre questo file direttamente nella cartella public_html/ su Aruba"
fi

echo ""
echo "🔧 CONFIGURAZIONI AGGIUNTIVE NECESSARIE:"
echo "========================================="
echo ""
echo "1. FIREBASE CONFIGURATION:"
echo "   - Aggiorna le regole Firebase per il dominio produzione"
echo "   - Configura l'autenticazione per tuaequipe.it"
echo "   - Aggiorna le autorizzazioni CORS"
echo ""
echo "2. VARIABILI D'AMBIENTE:"
echo "   Nel pannello Aruba, configura:"
echo "   - NODE_ENV=production"
echo "   - NEXT_PUBLIC_FIREBASE_* (tutte le variabili Firebase)"
echo ""
echo "3. DNS SETTINGS:"
echo "   - Assicurati che tuaequipe.it punti al tuo hosting Aruba"
echo "   - Configura il certificato SSL"
echo ""
echo "🎉 Deployment preparato! Buona fortuna!"