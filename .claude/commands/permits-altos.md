---
description: Lista os permits acima de um valor pra priorizar follow-up. Use ao priorizar visitas e cold calls.
allowed-tools: Bash, Read
argument-hint: <valor mínimo em USD>
---

# Permits altos — priorizar leads

Reginaldo quer ver permits acima de $$ARGUMENTS pra focar follow-up nos maiores.

Default: $50.000 se nada for passado.

## Passo 1: ler credenciais

```bash
source "$(git rev-parse --show-toplevel)/.creds/supabase.env"
VALOR="${ARGUMENTS:-50000}"
```

## Passo 2: query no Supabase

```bash
curl -s -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  "$SUPABASE_URL/rest/v1/permits?select=city,address,applicant_name,phone,email,estimated_value,description,permit_date&estimated_value=gte.$VALOR&order=estimated_value.desc&limit=30"
```

## Passo 3: formatar lista

Pra cada permit:

```
💰 $XXX,XXX — [Cidade]
📍 [endereço]
👤 [applicant]
📞 [telefone se tiver] | ✉️ [email se tiver]
📝 [primeira linha da descrição]
🗓 Permit emitido: [data]
🔗 Ver no app: https://permit-scanner.vercel.app

---
```

Ordenar por valor decrescente.

## Passo 4: sugestão final

Termina com:
"Sugestão: clique no card no app pra ver detalhes completos e arrastar pro Pipeline.

Pra criar rota Google Maps com os 5 mais próximos, abra o app e selecione os checkboxes."

## Em caso de zero resultados

Se ninguém acima do valor, sugere reduzir threshold. Exemplo: "Nenhum permit acima de $200k. Tente /permits-altos 100000"
