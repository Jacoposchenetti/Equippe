# Script di deployment per Aruba (Windows PowerShell)

Write-Host "Build completato con successo!" -ForegroundColor Green

Write-Host "ISTRUZIONI PER UPLOAD SU ARUBA:" -ForegroundColor Magenta
Write-Host "================================"
Write-Host ""
Write-Host "1. Connettiti al tuo hosting Aruba via FTP/SFTP"
Write-Host "2. Carica i seguenti file nella cartella public_html/:"
Write-Host ""
Write-Host "STRUTTURA DA CARICARE:"
Write-Host "public_html/"
Write-Host "├── .next/ (tutta la cartella)"
Write-Host "├── .htaccess (file nella root)"
Write-Host "├── package.json"
Write-Host "└── contenuto di public/ (NON la cartella stessa)"
Write-Host ""
Write-Host "CONFIGURAZIONI FIREBASE NECESSARIE:"
Write-Host "- Aggiungi tuaequipe.it nei domini autorizzati"
Write-Host "- Configura CORS per il storage"
Write-Host "- Aggiorna le regole di sicurezza"
Write-Host ""
Write-Host "Il sito sara disponibile su: https://tuaequipe.it" -ForegroundColor Green
Write-Host ""
Write-Host "Consulta DEPLOYMENT.md per istruzioni dettagliate." -ForegroundColor Yellow

pause