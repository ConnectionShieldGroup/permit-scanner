---
description: Investiga se uma cidade nova tem dados públicos coletáveis e propõe plano de ativação
allowed-tools: WebFetch, Bash, Read
argument-hint: <Nome da cidade>
---

# Adicionar nova cidade

Reginaldo quer adicionar a cidade $ARGUMENTS ao sistema.

## Passo 1: pesquisar plataforma

Investigue qual plataforma a prefeitura usa pra publicar permits. Pesquise URLs prováveis:

- `<cidade>ma.portal.opengov.com` (OpenGov)
- `<cidade>ma.viewpointcloud.com` (ViewPoint Cloud)
- `permiteyes.us/<cidade>/publicview.php` (PermitEyes)
- `permiteyes.us/<cidade>/publichome.php`
- `mapsonline.net/<cidade>ma/public_permit_reports.html.php` (SimpliCity)
- `data.<cidade>ma.gov` (Socrata Open Data)
- `<cidade>ma.gov/<id>/Building-Permit-Activity` (CivicPlus DocumentCenter)

Use WebFetch ou curl pra testar cada URL.

## Passo 2: classificar viabilidade

Categorias:

| Tier | Descrição | Tempo de ativação |
|---|---|---|
| 🟢 EASY | Open Data (Socrata, ArcGIS) ou PermitEyes público sem login | 30 min |
| 🟡 MEDIUM | CivicPlus mensal (XLSX/CSV/PDF) ou PermitEyes via Browserless | 1-2 horas |
| 🟠 HARD | OpenGov/ViewPoint (precisa Browserless render JS), CitizenServe SPA, Tyler EnerGov com login | 3-5 horas |
| 🔴 VERY_HARD | Sem portal público (FOIA only), Cloudflare bloqueando, custom system | semanas |

## Passo 3: propor plano

Reportar pra Reginaldo:

```
🏙 Análise da cidade: [Nome]

Plataforma identificada: [PermitEyes / OpenGov / etc]
URL: [link]
Tier: [🟢/🟡/🟠/🔴]
Esforço estimado: [tempo]

Recomendação: [ativar agora / V2 com Browserless / pedir Reginaldo criar conta / FOIA / etc]

[Se EASY ou MEDIUM possível agora:]
Quer que eu execute a ativação? (preciso aprovação antes de criar parser novo)

[Se HARD ou VERY_HARD:]
Esse aqui é mais complexo. Recomendo conversar com Fábio antes de começar — pode ser que precise solução específica.
```

## Passo 4: se aprovado e for EASY

1. Criar parser em `tools/process-<cidade>.py`
2. Inserir na `cities_config` table do Supabase com `active=true`
3. Rodar scrape inicial
4. Adicionar JSON em `app/src/lib/<cidade>-real.json`
5. Atualizar `app/src/lib/types.ts` adicionando cidade no `ACTIVE_CITIES`
6. Atualizar `app/src/lib/mock-permits.ts` com import do novo JSON
7. Build + commit + push (Vercel deploya automático)

## Em caso de cidade fora de Massachusetts

Avisar que sistema atual cobre só MA. Pra outros estados (RI, NH, CT), seria projeto separado — Fábio decide.
