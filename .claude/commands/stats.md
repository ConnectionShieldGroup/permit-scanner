---
description: Mostra estatísticas atuais do banco de permits — total, por cidade, top valores, distribuição por categoria
allowed-tools: Bash, Read
---

# Estatísticas do Permit Scanner

Reginaldo quer ver o estado atual do sistema.

## Passo 1: ler credenciais Supabase

```bash
source "$(git rev-parse --show-toplevel)/.creds/supabase.env"
```

## Passo 2: rodar queries SQL via REST API

Use curl + service_role key (não exibir a key na resposta).

### Total geral

```bash
curl -s -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  "$SUPABASE_URL/rest/v1/permits?select=count" -H "Prefer: count=exact" -I
```

### Distribuição por cidade

```bash
curl -s -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  "$SUPABASE_URL/rest/v1/permits?select=city" \
  | python3 -c "import sys,json; from collections import Counter; d=json.load(sys.stdin); c=Counter(p['city'] for p in d); [print(f'{n:>5} {city}') for city,n in c.most_common()]"
```

### Top 10 maior valor

```bash
curl -s -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  "$SUPABASE_URL/rest/v1/permits?select=city,address,applicant_name,estimated_value,description&order=estimated_value.desc.nullslast&limit=10"
```

### Distribuição por categoria (work_type)

Idem mas agrupado por work_type.

### Total em obras (sum estimated_value)

```bash
curl -s -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  "$SUPABASE_URL/rest/v1/rpc/sum_estimated_value"
```

## Passo 3: relatar pra Reginaldo

Formato:

```
📊 Estado atual do Permit Scanner:

TOTAL: X permits / $YM em obras

Por cidade:
  ### Somerville
  ### Hingham
  ...

Por categoria:
  ### Renovation
  ### Bath Renovation
  ...

Top oportunidade:
  $XXXk — [endereço] — [applicant]
  Descrição: [...]
```

## Em caso de erro

Se Supabase fora do ar ou credenciais inválidas, dizer claramente. Não inventar números.
