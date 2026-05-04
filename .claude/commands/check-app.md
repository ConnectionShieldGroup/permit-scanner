---
description: Testa se o app web tá no ar, se Supabase responde, e se o cron tá agendado. Use quando suspeitar que algo travou.
allowed-tools: Bash, Read
---

# Health check do sistema

Reginaldo quer saber se tá tudo rodando.

## Passo 1: testar app Vercel

```bash
curl -s -I https://permit-scanner.vercel.app | head -1
```

Esperado: `HTTP/2 200`

## Passo 2: testar Supabase

```bash
source "$(git rev-parse --show-toplevel)/.creds/supabase.env"

curl -s -o /dev/null -w "%{http_code}" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  "$SUPABASE_URL/rest/v1/permits?select=count&limit=1"
```

Esperado: `200`

## Passo 3: verificar cron (executar dentro do Supabase SQL Editor)

```sql
SELECT jobname, schedule, active
FROM cron.job
WHERE jobname LIKE '%permiteyes%' OR jobname LIKE '%scrape%';
```

Esperado: 1 row, `active=true`, schedule `0 15 1,16 * *`

## Passo 4: relatar

```
🟢 STATUS DO SISTEMA — [data/hora]

✅ App Vercel: ONLINE (200)
✅ Banco Supabase: ONLINE (200)
✅ Cron quinzenal: ATIVO (próxima execução: dia X)

Último scrape executado: [data — se disponível em cities_config.last_run]
Total de permits no banco: X

Tudo operacional.
```

Se algo falhar:
- App down → "🔴 App fora do ar — fala com Fábio imediato"
- Supabase down → "🔴 Banco inacessível — verificar Supabase Dashboard"
- Cron inativo → "⚠️ Cron pausado — pode ser manutenção, fala com Fábio"
