# ⚠️ Assicurati di aver già fatto login con: flyctl auth login

Write-Host "🚀 Impostazione secrets su Fly.io..."

flyctl secrets set `
    SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhpa3hoeHdpcWZpaWFpa3Vsa3h6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTY3NzQxOTY0NywiZXhwIjoxOTkyOTk1NjQ3fQ.E2HU9f8vW_bJO46EW6I35Mos9_LtN31TQR61-YHKZs4" `
    SUPABASE_URL="https://xikxhxwiqfiiaikulkxz.supabase.co" `
    PORT=8080 `
    JWT_SECRETKEY="5de3137c6578837a57f0e0ebddc40d21efc966e692efcd96d8ccfef6d51c744a" `
    NODE_ENV="production" `
    PRIVATE_KEY_DEV="0x92db14e..." `
    POLYGON_RPC_URL="https://polygon-mainnet.g.alchemy.com/v2/7-s5qTDGTktcQ3wxNR7vSiVpTVW5jeco" `
    --stage

Write-Host "✅ Tutti i secrets sono stati impostati con successo."


# Set-ExecutionPolicy Bypass -Scope Process -Force
# .\set-secrets.ps1
