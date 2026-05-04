# Permit Scanner — Reginaldo + Michel (Connection Glass + Shield Pro)

> Sistema de prospecção B2B via building permits de Massachusetts.
> Status: V1 em construção (03/mai/2026).
> Cliente: Reginaldo + Michel (BA, instalado 18/abr).

## Objetivo

Scraper automatizado que coleta permits de construção em 30 cidades de Massachusetts a cada 15 dias e entrega leads qualificados pro time de vendas em formato visual: lista filtrável + kanban de pipeline + criação de rotas no Google Maps.

## Cidades alvo (30)

**Norte/NW Boston:** Burlington, Lexington, Winchester, Stoneham, Reading, Wakefield, Wilmington, North Reading, Medford, Melrose, Arlington, Malden, Billerica, Bedford, Waltham

**South Shore:** Abington, Whitman, Hanover, Hingham, Weymouth, Braintree, Quincy, Norwell, Scituate, Marshfield, Pembroke, Hanson, East Bridgewater, Brockton, Randolph

## Tipos de permit relevantes (7 categorias — definição Fábio 03/mai)

Permits que NÃO se enquadram em nenhuma das 7 categorias são SKIPPED no scraper (não vão pro banco nem aparecem no portal):

- **New Construction** — casa nova / new home / new single family / new dwelling / construct new
- **Kitchen Renovation** — kitchen remodel / kitchen renovation
- **Bath Renovation** — bathroom remodel / bath renovation
- **Addition** — addition / room addition / garage addition / second story addition
- **Renovation** — interior / residential / commercial renovation, remodel, alteration, build-out, tenant fit-out, basement remodel
- **Building Permit** — RESI./COMM. genérico que não bate em outra categoria
- **Foundation Permit** — foundation

## Dados a coletar por permit

- Nome do solicitante (applicant)
- Endereço da obra
- Telefone (quando disponível)
- Email (quando disponível)
- Tipo de obra
- Cidade
- Data do permit
- Valor estimado (quando disponível)
- Status do permit
- Permit number (identificador único)

## Decisões de arquitetura

### Stack
- **Frontend:** Vite + React + Tailwind + shadcn/ui (clonado do `lovable-portal`)
- **Visual base:** dark theme + gold accent (clonado do `cambridge-permits-portal.html` do evento 30/abr)
- **Drag-and-drop:** `@hello-pangea/dnd` (já provado em `lovable-portal/src/pages/Kanban.tsx`)
- **Backend:** Supabase (banco Postgres + Edge Functions)
- **Scraper:** Edge Function por cidade (Python/Node dependendo da plataforma)
- **Cron:** `pg_cron` rodando 1x a cada 15 dias
- **Deploy:** Vercel (free tier no início)
- **Maps:** Google Maps URL scheme (`https://www.google.com/maps/dir/?api=1&waypoints=...`)

### Decisão "ir direto na fonte" (não Shovels.ai)
Fábio decidiu 03/mai não usar agregador (Shovels.ai). O sistema scrapa direto da prefeitura de cada cidade. Justificativa: replicar exatamente o que a Shovels faz, customizado pro cliente. **Custo recorrente zero** (vs ~$200-500/mês da Shovels).

### Decisão "pasta do cliente"
Todo o código mora em `builds/connection-glass-shield-pro/permit-scanner/` (do Reginaldo, separado do nosso lovable-portal). Amanhã 04/mai vai pro GitHub do Reginaldo.

## Páginas (4 totais)

### 1. Página Principal (Lista de Permits)
- Cards com info-resumo: endereço, cidade, tipo, data, applicant, telefone/email, valor
- **Filtros:** cidade (dropdown 30 opções) + mês (date range)
- Botão "Adicionar ao kanban" → cria card no Kanban Pipeline com status `encontrado`
- Botão "Selecionar pra rota" → marca permit pra entrar no Google Maps
- Botão "Criar rota" → abre Google Maps com permits selecionados

### 2. Kanban Pipeline (6 colunas)
1. **Permits encontrados** (recém-coletados pelo scraper)
2. **Visitados** (time foi até a obra)
3. **Apresentação enviada** (mandou material da empresa)
4. **Proposta enviada** (orçamento formal)
5. **Cliente** → AUTO-MOVE pro Kanban "Clientes Ativos"
6. **Não fechado** → AUTO-MOVE pro Kanban "Clientes Não Efetivados"

Drag-and-drop livre entre as 6 colunas. Filtros cidade + mês iguais à página principal.

### 3. Kanban Clientes Ativos
Recebe cards arrastados pra coluna 5 do Pipeline. Pode ter sub-colunas por estágio do cliente (definir com Reginaldo): em obra, finalizado, recompra, etc. **V1 simplifica:** 1 coluna só "Ativos" + drag-out se quiser voltar.

### 4. Kanban Clientes Não Efetivados
Recebe cards da coluna 6 do Pipeline. Pode ter coluna "Reabordar em 90 dias" + "Descartado" + "Tentar de novo". V1 simplifica: 2 colunas (Reabordar / Descartado).

## Fluxo automático entre kanbans

```
[Permits encontrados] → [Visitados] → [Apresentação] → [Proposta] → [Cliente] ────────► Kanban Clientes Ativos
                                                                  ↘
                                                                   [Não fechado] ─────► Kanban Não Efetivados
```

Trigger: quando card é arrastado pra coluna 5 ou 6 no Pipeline, Edge Function `move-to-kanban` move pro outro board automaticamente.

## Banco de dados (Supabase)

### Tabela `permits`
```sql
id uuid primary key
permit_number text unique
applicant_name text
address text
city text
state text default 'MA'
phone text
email text
work_type text -- 'new_construction', 'kitchen_renovation', 'bath_renovation', 'addition'
permit_date date
estimated_value numeric
status_source text -- status no portal da cidade
created_at timestamptz default now()
updated_at timestamptz default now()
raw_data jsonb -- payload original do scraper pra debug
```

### Tabela `kanban_cards`
```sql
id uuid primary key
permit_id uuid references permits(id)
board text -- 'pipeline', 'ativos', 'nao_efetivados'
column_status text -- 'encontrado', 'visitado', 'apresentacao', 'proposta', 'cliente', 'nao_fechado', 'ativos_em_obra', 'reabordar', 'descartado'
notes text
moved_at timestamptz default now()
created_at timestamptz default now()
```

### Trigger automático
Quando `kanban_cards.column_status` muda pra `cliente` → board vira `ativos`. Quando muda pra `nao_fechado` → board vira `nao_efetivados`.

## Scraper

### Edge Function `scrape-city-permits`
- Roda via cron a cada 15 dias (SQL `cron.schedule('*/15 * * *', ...)`)
- Itera pelas 30 cidades baseado em `cities_config` (tabela com URL + plataforma + parser por cidade)
- Pra cada cidade: invoca Edge Function específica `scrape-{platform}` (ex: `scrape-viewpoint-cloud`, `scrape-tyler-energov`)
- Faz upsert por `permit_number` (idempotente)
- Cria card automático em `kanban_cards` com `column_status='encontrado'` pra cada permit novo

### Parsers por plataforma
Baseado no mapeamento `cidades-mapeamento.md`:
- `scrape-viewpoint-cloud` (provavelmente cobre 60-70% das cidades)
- `scrape-tyler-energov` (algumas cidades grandes)
- `scrape-opengov` (pouco uso em MA mas existe)
- `scrape-citizenserve` (raro)
- `scrape-html-generic` (fallback HTML)
- `request-foia` (cidade sem portal = email automatizado pro records officer)

## Google Maps integration

V1 simples: URL scheme oficial.

```javascript
const waypoints = selectedPermits.map(p => encodeURIComponent(p.address)).join('|')
const url = `https://www.google.com/maps/dir/?api=1&waypoints=${waypoints}`
window.open(url, '_blank')
```

V2 (futuro): Google Maps JS API com otimização de rota.

## Páginas e rotas

```
/                   Página principal (lista de permits)
/kanban             Kanban Pipeline (6 colunas)
/kanban/ativos      Kanban Clientes Ativos
/kanban/nao-efetivados  Kanban Clientes Não Efetivados
```

## V1 ativo: 4 cidades, 516 permits, $37M em obras

Após investigação coordenada (Carlos + ChatGPT) em 03/mai:

### Wakefield (107 permits) — adicionado 03/mai 16h
- **Fonte:** CivicPlus DocumentCenter publica PDF mensal
- **URL pattern:** `https://www.wakefieldma.gov/DocumentCenter/View/<id>/Building-Permits-Issued-<Month>-<Year>-PDF`
- **Estrutura:** PDF com 9 colunas extraíveis via pdfplumber: Record #, Type, Amount Paid, Date Paid, Owner Name, Full Address, Estimated Cost, Description, Contractor Name
- **Volume:** ~36 permits/mês (~13 qualificados após filtro)
- **Tool:** `tools/process-wakefield-pdf.py`

### Lexington (158 permits) — adicionado 03/mai 15h
- **Fonte:** CivicPlus DocumentCenter publica CSV mensal
- **URL pattern:** `https://www.lexingtonma.gov/DocumentCenter/View/<id>` (.xlsx extension mas é CSV text)
- **Estrutura:** 9 colunas — Record #, Permit/License Issued Date, Street No, Street Name, Applicant Name, Record Type, Project Cost, Work Description, Occupancy Type
- **Filtro chave:** Occupancy Type contém "Residential" (skip Commercial)
- **Volume:** ~80 qualificados/mês (de ~330 total)
- **Tool:** `tools/process-lexington-csv.py`
- **Limitação:** sem phone/email no CSV (V2 enriquece via OpenGov login)

## V1 anterior: Hingham + Reading (2 cidades, 251 permits)

Após investigação intensiva 03/mai noite: **2 cidades das 30 publicam dados extraíveis sem render JS / sem login**:

### Reading (42 permits) — adicionado 03/mai
- **Fonte:** CivicPlus DocumentCenter publica Excel (.xlsx) MENSAL
- **URL pattern:** `https://www.readingma.gov/DocumentCenter/View/<id>/<Month-Year>---Building-Permits-Issued`
- **Estrutura:** 17 colunas no Excel: Record #, Type, Address (Street No + Name), Applicant Name+Email+Phone, Owner, Date Submitted, Project Cost, Issued Date, Permit For, Work Description, Status
- **Limitação:** publica com 2-3 meses delay. Last available: Feb 2026 (em 03/mai). Cutoff usado: 120 dias em vez de 45.
- **Volume:** ~120 permits/mês total → ~30-40 qualificados (após filtro 7 categorias + skip closed)
- **Tool:** `tools/process-reading-xlsx.py`

### Hingham (209 permits) — V1 inicial

Definida 03/mai 13:00 EDT após CORREÇÃO de erro de mapeamento (ver seção "Erro corrigido" abaixo).

Justificativa de Hingham:
- **AJAX endpoint público validado em real-time** retornando JSON estruturado: `https://permiteyes.us/hingham/ajax/getbuildingpublichome.php`
- **84 permits reais retornados** na primeira chamada (sample: ID 961, 2 Aberdeen Road, RESI., Permit Issued)
- 17 colunas por linha incluindo: ID, datas, número casa, rua, applicant, owner, tipo, permit number, status
- Sem login obrigatório, sem CAPTCHA
- **Bonus inesperado:** o endpoint AJAX é o MESMO padrão pras 9 outras cidades PermitEyes (North Reading, Bedford, Whitman, Norwell, Scituate, Hanson, Braintree, Randolph, e Marshfield variant). Parser único cobre 10 cidades em V2.

URL pra scraper (descoberta refinada 03/mai 14h):

O endpoint é **DataTables server-side com paginação + ordering**. Hingham tem **53.562 permits totais** no banco PermitEyes. Padrão de uso:

```
GET https://permiteyes.us/hingham/ajax/getbuildingpublichome.php
   ?draw=1
   &start=0
   &length=500
   &order[0][column]=6
   &order[0][dir]=desc

Headers: User-Agent: Mozilla/5.0

Response: JSON {
  "draw": 1,
  "recordsTotal": 53562,
  "recordsFiltered": 53562,
  "data": [[col0, col1, ..., col16], ...]
}
```

Coluna 6 = IssueDate (data de emissão do permit). Ordenação desc retorna mais recentes primeiro.

**Janela temporal aplicada client-side:**
- Primeira execução: cutoff = hoje - 45 dias
- Cron quinzenal: cutoff = hoje - 15 dias
- UNIQUE em `permits.permit_number` garante idempotência (sem duplicar)

500 permits/page cobrem ~45 dias em Hingham (volume médio de ~5-15 permits/dia). Pra cidades de volume maior, pode-se aumentar `length` ou paginar.

### Erro corrigido (registro pra lessons.md)

O subagent inicial classificou "Burlington" como cidade EASY com API ArcGIS pública. Validação em real-time revelou que o portal `navburl-burlington.opendata.arcgis.com` é de **Burlington Ontario, Canadá** (geometry latitude 43.3°N, -79.8°W; tags "Burlington Ontario"; URL `mapping.burlington.ca`). NÃO é Burlington Massachusetts.

Burlington MA real usa OpenGov SPA React (HARD — V4). Foi descartada da V1.

**Lição:** validar geografia (extent + tags + URL TLD) antes de classificar cidade EASY. Não confiar em match de nome só.

Mapeamento completo das 30 cidades em [`cidades-mapeamento.md`](./cidades-mapeamento.md).

## Estratégia de cobertura por fases (revisada pós Hingham pilot)

| Fase | Plataforma | Cidades cobertas | Esforço |
|---|---|---|---|
| V1 (hoje 03/mai) | PermitEyes AJAX | Hingham (1) | Trivial — JSON via AJAX |
| V1.1 (mesma noite ou 04/mai) | Mesmo parser | + North Reading, Norwell, Randolph (3 com publicview confirmado) | Trivial — só ativar no seed se AJAX responder |
| V2 (semana 05-09/mai) | PermitEyes login (validar publicview hidden) | + Bedford, Whitman, Scituate, Hanson, Braintree, Marshfield (6) | Baixo — testar endpoint padrão, validar |
| V3 (semana 12-16/mai) | SimpliCity / MapsOnline | Melrose, Billerica, Pembroke, East Bridgewater (4) | Médio — 1 parser por endpoint estável |
| V4 (semana 19-23/mai) | OpenGov / ViewPoint Cloud (Puppeteer + XHR intercept) | Lexington, Stoneham, Reading, Arlington, Abington, Hanover, Quincy, Weymouth, Burlington MA (9) | Alto — SPA React, precisa Puppeteer |
| V5 (final maio) | Custom (Waltham, CitizenServe Brockton) | Waltham, Brockton, Medford (3) | Médio caso a caso |
| Backlog (V6+) | Login obrigatório (Tyler EnerGov, CivicPlus) | Malden, Winchester (2) | Hard — depende do Reginaldo criar contas |
| Excluído V1-V5 | FOIA only / sem portal | Wakefield, Wilmington (2) | Manual ou abandona |

**Cobertura V1+V2+V3+V4+V5 = 26 de 30 cidades (87%) sem login.**

**Vantagem inesperada com PermitEyes:** o parser único (1 Edge Function parametrizada por `city_slug`) cobre **10 cidades** assim que validar publicview de cada. Pode chegar em 30% das cidades já no V1.1, mesma noite.

Os 9 HARD (login) e 2 FOIA podem entrar V6+ ou ficam pra Reginaldo manual.

## Faseamento de entrega

### V1 — Entregar amanhã 04/mai
- Burlington funcionando ponta-a-ponta (API ArcGIS → banco → UI → kanban)
- 4 páginas com UI completa (lista + 3 kanbans)
- Drag-and-drop funcionando
- Auto-move entre kanbans funcionando
- Google Maps abrindo rota
- Cron 15 dias configurado (armado, mesmo que não dispare ainda)
- Deploy Vercel free funcionando
- Reginaldo vê dados reais de Burlington no sistema

### V2 — Semana 05-09/mai
- Parser PermitEyes (10 cidades de uma vez)
- Validação dos publicview.php das cidades a confirmar
- Refinamento UI baseado em feedback do Reginaldo
- Handoff completo pro repo do Claude Code dele

### V3+ — Resto de maio
- SimpliCity (4 cidades)
- OpenGov via Puppeteer (8 cidades)
- Waltham + Brockton custom (2 cidades)
- HARD (login) — decisão Reginaldo

### V3 — Maio fim
- Enriquecimento de leads (cruzar com Zillow recently sold)
- Notificações Telegram pro Reginaldo de leads QUENTES
- Dashboard de conversão (encontrado → cliente %)
- Integração com CRM dele (se tiver GHL ou outro)

## Riscos identificados

1. **Cidades sem portal público** — alguma fração das 30 vai cair em FOIA. V1 só cobre as que têm portal aberto. V2 endereça FOIA.
2. **Anti-scraping** — alguns portais (Tyler EnerGov) podem ter rate limiting / Cloudflare. Solução: respeitar throttle, user-agent realista, retries com backoff.
3. **Dados incompletos** — telefone e email muitas vezes não estão no permit público. V1 entrega o que tem; V2 enriquece via Apollo / Hunter / WhitePages.
4. **Volume baixo numa cidade** — algumas cidades pequenas geram <10 permits/mês. Não é problema, é característica do mercado.

## Handoff pro Claude Code do Reginaldo

Plano definido 03/mai com Fábio:
1. Hoje (03/mai) — sistema construído nessa pasta `builds/connection-glass-shield-pro/permit-scanner/`
2. Amanhã (04/mai) — Fábio joga no GitHub do Reginaldo (clonando do nosso template)
3. Reginaldo recebe: URL do app no Vercel + acesso ao Supabase + repo no GitHub dele
4. Convite como collaborator no GitHub
5. Doc `wiki/clients/business-accelerator/reginaldo-connection-glass/permit-scanner.md` no repo dele com URLs, credenciais, como mexer

## Decisões pendentes (confirmar com Fábio)

- [x] **Cidade-piloto V1: Burlington** (decidida 03/mai pós-mapeamento — única com API pública)
- [ ] Visual: clonar tema do `cambridge-permits-portal.html` do evento (dark + gold) — **recomendado**
- [ ] Login das cidades restritas — Reginaldo cria conta dele ou criamos conta com email da empresa? (decisão V2)
- [ ] Sub-colunas dos Kanbans 3 e 4 (Ativos / Não Efetivados) — V1 simplifica (1 coluna no Ativos / 2 colunas Reabordar+Descartado no Não Efetivados); refinar depois com Reginaldo

## Time acionado

- **Backend Architect** (subagent) — banco + Edge Functions + cron
- **Victor** (subagent) — 4 páginas UI
- **Carlos (Eu)** — orquestração + integração + handoff
- **Fábio** — decisões finais + relação com Reginaldo + GitHub dele
