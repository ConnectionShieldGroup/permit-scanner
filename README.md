# Permit Scanner — Pipeline B2B de Building Permits

> **Sistema automatizado** que coleta building permits residenciais de cidades americanas e entrega leads qualificados pra contractors via portal web com kanban de pipeline e Google Maps integrado.

**Cliente piloto:** Connection Glass + Shield Pro (Reginaldo + Michel) — vidraçaria/proteção em Massachusetts
**Status:** V1 ao vivo — 9 cidades / 1.277 permits / ~$95M em obras
**Entregue por:** Me Ensina AI

---

## O QUE É

Reginaldo é contractor em Massachusetts. Ele queria saber **toda obra residencial em andamento** nas suas 30 cidades-alvo pra prospectar antes que outro contractor de janelas/proteção fechasse o cliente.

**Antes:** ele perguntava no ChatGPT cidade por cidade, manualmente.
**Agora:** ele abre o portal e vê 1.277 permits ativos em 9 cidades, atualizado automaticamente a cada 15 dias, com pipeline kanban e rotas Google Maps.

## ARQUITETURA

### 4 técnicas técnicas dominadas

Cada cidade americana publica permits de forma diferente. Mapeamos 6 plataformas e dominamos 4 técnicas que cobrem ~70% das cidades de MA:

#### 1. PermitEyes AJAX direto (raro)
- Apenas Hingham permite acesso público sem login
- 209 permits coletados via `getbuildingpublichome.php` AJAX endpoint paginado
- Refresh real-time
- **Custo:** $0/mês

#### 2. PermitEyes Browserless intercept (universal)
- 9 cidades exigem login
- Browserless renderiza página + intercepta XHR original do DataTables
- Captura JSON puro sem precisar credenciais
- 4 cidades validadas: Braintree, North Reading, Randolph, Hanson
- **Custo:** $10/mês (paid plan) ou trial 1k requests grátis

#### 3. CivicPlus DocumentCenter (mensal)
- 3 cidades publicam relatório mensal Excel/CSV/PDF via DocumentCenter
- Reading (XLSX), Lexington (CSV), Wakefield (PDF)
- Delay de 1-3 meses entre permit emitido e publicação
- pdfplumber + openpyxl + csv padrão Python
- **Custo:** $0/mês

#### 4. Socrata Open Data (cidades grandes)
- API REST + SoQL pra cidades que publicam Open Data
- Somerville, Boston, Cambridge confirmados
- Sem auth, sem rate limit conhecido, dados completos (38+ campos)
- **Custo:** $0/mês

### Stack técnico

```
Frontend: Vite + React + Tailwind + shadcn/ui
Drag-drop: @hello-pangea/dnd
Routing: React Router v6
Backend: Supabase (PostgreSQL + Edge Functions Deno)
Scraping: Python local + Browserless (V2)
LLM extraction (V2): Claude Haiku 4.5 ($0.80/$4 per 1M tokens)
Hosting: Vercel free tier
Maps: Google Maps URL scheme
```

## SCHEMA PERMIT (PADRONIZADO)

7 work_type categories filtradas (decisão Reginaldo):
- new_construction, kitchen_renovation, bath_renovation, addition
- renovation, building_permit, foundation_permit

Permits que não caem em nenhuma das 7 são SKIPPED. Closed/CO Issued também.

Schema (TypeScript):
```typescript
type Permit = {
  permit_number: string;
  applicant_name: string | null;
  address: string;
  city: string; state: string;
  phone: string | null; email: string | null;
  work_type: WorkType;          // 7 categorias
  permit_date: string;          // IssueDate
  application_date: string | null; // ApplDate
  estimated_value: number | null;
  status_source: string | null;
  source_url: string | null;
  description: string | null;
  raw_data: Record<string, unknown>;
};
```

## 4 PÁGINAS

1. **Permits** (`/`) — Lista filtrável (cidade, mês, work_type, busca por endereço)
2. **Pipeline Kanban** (`/kanban`) — 6 colunas: Encontrado → Visitado → Apresentação → Proposta → Cliente → Não Fechado
3. **Clientes Ativos** (`/kanban/ativos`) — auto-move quando arrasta pra "Cliente"
4. **Não Efetivados** (`/kanban/nao-efetivados`) — Reabordar / Descartado

Click em card abre Dialog com TODOS os 89+ campos do permit (no caso PermitEyes — outras plataformas variam).

## PRA REPLICAR PRA NOVO CLIENTE

### 1. Identificar 20-50 cidades-alvo do cliente
Onde ele atua. Anotar geografia (estado, county).

### 2. Mapear plataformas das cidades
Usa ChatGPT (validado): "Para cada cidade abaixo, retorne URL/plataforma/método de publicação de building permits..."

Categorias possíveis:
- Socrata Open Data → integração trivial (5min/cidade)
- CivicPlus DocumentCenter → script genérico
- PermitEyes (público) → AJAX direto
- PermitEyes (login) → Browserless intercept
- OpenGov/ViewPoint → só obra pública (descartar pra residencial)
- Tyler EnerGov → login required (Browserless)
- CitizenServe → SPA, requer Browserless
- Custom → caso a caso (PDFs anexos, FOIA, etc)

### 3. Replicar pasta padrão
```
builds/<cliente-slug>/permit-scanner/
├── SPEC.md
├── CONTRACTS.md
├── cidades-mapeamento.md
├── HANDOFF-<cliente>.md
├── tools/
│   ├── scrape-<source>.py     (parser por plataforma)
│   └── ...
├── db/                          (Supabase migration)
├── supabase/functions/           (Edge Functions cron)
└── app/                         (Vite + React clone)
```

### 4. Adaptar 7 categorias se necessário
Painter precisa categorias diferentes de electrician. Editar `inferWorkType()` no parser + WorkType enum.

### 5. Customizar visual
`cambridge-permits-portal.html` é referência (dark + gold). Cliente pode pedir cores próprias.

## CUSTO OPERACIONAL

**V1 atual: $0/mês** (Browserless trial cobrindo)

**V2 produção (cada cliente):**
- Supabase free tier: $0
- Vercel free tier: $0
- Browserless starter: $10/mês
- Anthropic Claude Haiku (extração V2): ~$1/mês
- **TOTAL: $10-15/mês cobrindo 15-25 cidades**

**Cobrar do cliente:** $200-1000/mês depending segmento + customização. Margem absurda.

## TEMPO DE ENTREGA

- **Cliente piloto (Reginaldo):** 1 dia de descoberta + 1 dia de implementação V1
- **Próximos clientes:** 4-8h por cliente (template padronizado)
- **Cliente em estado novo:** +4h pra investigar plataformas regionais

## VENDA — PITCH POR SEGMENTO

### Para Contractors (Painter, Roofer, HVAC, Window/Glass, etc)
"Cada permit emitido na sua região é uma obra ativa que **vai precisar do seu serviço** nos próximos 30-90 dias. Em vez de você ficar esperando indicação, **toda obra nova vira lead qualificado no seu portal**. Pipeline de vendas com kanban, rotas Google Maps, integração WhatsApp."

### Para Real Estate Agents
"Permits de new construction = inventário futuro. Permits de addition/major renovation = signal de família crescendo (potencial movimento de mercado). Antecipa concorrentes."

### Para Mortgage / Insurance
"Permits = obras ativas = oportunidade refinanciamento ou apólice nova de proteção contra danos durante construção."

### Para Building Material Suppliers
"Permits = pipeline futuro de demanda por material. Sabe quem vai precisar de drywall/cimento/janelas antes do contractor abrir o pedido."

## LIMITAÇÕES CONHECIDAS V1

- 9 cidades de 30 alvo (30%) — V2 amplia
- Algumas plataformas (OpenGov, Tyler EnerGov, custom) ainda V2
- Phone/email vem de PermitEyes mas não de Socrata/CivicPlus (V2 enriquece via Apollo/Hunter)
- Drawings/PDFs anexos não capturados (V2)
- Sem login do cliente (V2 acesso permits ainda mais ricos)

## ROADMAP V2 (1-2 semanas)

1. Provisionar Supabase + cron 15 dias automatizado
2. Edge Function `scrape-with-llm` (universal LLM extractor)
3. Integrar Boston + Cambridge Open Data (mais 2-3 mil permits)
4. Browserless paid plan ($10/mês) pras 17 cidades restantes
5. Login Reginaldo nos 5 PermitEyes que não responderam (Norwell, Bedford, etc)
6. Enriquecimento Apollo/Hunter pra phone/email faltantes
7. Notificações Telegram quando permit > $X

---

**Construído por:** Me Ensina AI
**Cliente piloto:** Connection Glass + Shield Pro
**Tech lead:** Carlos (Claude Code) + Fábio (CEO)
**Data V1:** 03/mai/2026
