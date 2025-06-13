# ⚠️ Assicurati di aver già fatto login con: flyctl auth login

Write-Host "🚀 Impostazione secrets su Fly.io..."

flyctl secrets set `
    SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6Ikp..." `
    SUPABASE_URL="https://xikxhxkjsqqizaygrzod.supabase.co" `
    PORT=4000 `
    JWT_SECRETKEY="5de31381ac..." `
    NODE_ENV="production" `
    PRIVATE_KEY_DEV="0x92db14e..." `
    POLYGON_RPC_URL="https://polygon-mainnet.g.alchemy.com/v2/..." `
    --stage

Write-Host "✅ Tutti i secrets sono stati impostati con successo."


# Set-ExecutionPolicy Bypass -Scope Process -Force
# .\set-secrets.ps1
