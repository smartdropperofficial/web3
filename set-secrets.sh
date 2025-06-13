 #!/bin/bash
set -e

echo "🚀 Impostazione secrets su Fly.io..."

fly secrets set \
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6Ikp..." \
SUPABASE_URL="https://xikxhxkjsqqizaygrzod.supabase.co" \
PORT=4000 \
JWT_SECRETKEY="5de31381ac..." \
NODE_ENV="production" \
PRIVATE_KEY_DEV="0x92db14e..." \
POLYGON_RPC_URL="https://polygon-mainnet.g.alchemy.com/v2/..." \
--stage

echo "✅ Tutti i secrets sono stati impostati con successo."