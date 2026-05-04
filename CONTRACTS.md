# Permit Scanner — Contratos Compartilhados

> Backend Architect e Victor devem seguir esses tipos / endpoints / nomes EXATOS.
> Carlos coordena. Quem mudar contrato avisa o outro.

## TypeScript Types (frontend e backend devem usar esses nomes)

```typescript
// Permit (vem do scraper ArcGIS, normalizado)
export type Permit = {
  id: string;                    // uuid
  permit_number: string;         // ex: "B-2026-12345"
  applicant_name: string | null;
  address: string;
  city: string;                  // ex: "Burlington"
  state: string;                 // default 'MA'
  phone: string | null;
  email: string | null;
  work_type: WorkType;
  permit_date: string;           // ISO date 'YYYY-MM-DD'
  estimated_value: number | null;
  status_source: string | null;  // status no portal da cidade
  created_at: string;            // ISO timestamp
  updated_at: string;
  raw_data: Record<string, unknown>;
};

export type WorkType =
  | 'new_construction'
  | 'kitchen_renovation'
  | 'bath_renovation'
  | 'addition'
  | 'other';

// Kanban Card
export type KanbanCard = {
  id: string;                    // uuid
  permit_id: string;             // FK
  permit?: Permit;               // join opcional
  board: KanbanBoard;
  column_status: KanbanColumn;
  notes: string | null;
  moved_at: string;              // ISO timestamp
  created_at: string;
};

export type KanbanBoard = 'pipeline' | 'ativos' | 'nao_efetivados';

export type KanbanColumn =
  // pipeline (board principal — 6 colunas)
  | 'encontrado'
  | 'visitado'
  | 'apresentacao'
  | 'proposta'
  | 'cliente'           // trigger -> move pra board 'ativos'
  | 'nao_fechado'       // trigger -> move pra board 'nao_efetivados'
  // ativos (board de clientes ativos)
  | 'ativos'
  // nao_efetivados (board de não fechados)
  | 'reabordar'
  | 'descartado';

// Filtros da página principal e dos kanbans
export type PermitFilters = {
  city?: string;
  month_start?: string;          // 'YYYY-MM-01'
  month_end?: string;            // 'YYYY-MM-01' (próximo mês)
  work_type?: WorkType;
};
```

## SQL Schema (Backend Architect entrega esses CREATE TABLE)

Ver `db/schema.sql` (a ser criado pelo Backend Architect).

Tabelas:
- `permits` (campos = TypeScript Permit acima)
- `kanban_cards` (campos = TypeScript KanbanCard acima)
- `cities_config` (parametriza scrapers — name, platform, base_url, parser_name, active)

Triggers:
- `tg_kanban_auto_move` — quando `column_status` vira `cliente` → `board='ativos', column_status='ativos'`. Quando vira `nao_fechado` → `board='nao_efetivados', column_status='reabordar'`.
- `tg_create_card_on_new_permit` — quando insere em `permits`, cria `kanban_cards` em `board='pipeline', column_status='encontrado'`.

## Endpoints / RPC

Backend Architect cria essas Edge Functions. Victor consome via `supabase.functions.invoke(...)` ou cliente JS direto.

### `scrape-burlington-arcgis` (Edge Function)
- **Trigger:** cron 15 dias + chamada manual via portal
- **Output:** `{ ok: boolean, inserted: number, updated: number, errors: string[] }`
- **Side effect:** upsert em `permits` (idempotente por `permit_number`)
- **Source:** ArcGIS REST `https://navburl-burlington.opendata.arcgis.com/datasets/building-permits` (formato GeoJSON ou CSV — Backend escolhe)

### `move-card-board` (Edge Function ou trigger SQL)
- **Trigger:** mudança de `column_status` em `kanban_cards`
- **Comportamento:** se `cliente` ou `nao_fechado`, move pra outro board automaticamente

### Selects diretos (Victor faz via Supabase client JS)
- `select * from permits where city=$1 and permit_date between $2 and $3 order by permit_date desc`
- `select kc.*, p.* from kanban_cards kc join permits p on p.id=kc.permit_id where kc.board=$1`

## Variáveis de Ambiente (frontend)

Frontend usa `.env.local`:
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_GOOGLE_MAPS_API_KEY=  # opcional V1, V2 fica essencial
```

Carlos preenche essas vars depois que provisionar o Supabase do Reginaldo.

## Estrutura de pastas (alinhada entre os dois agentes)

```
builds/connection-glass-shield-pro/permit-scanner/
├── SPEC.md                 (Carlos)
├── CONTRACTS.md            (Carlos — este arquivo)
├── cidades-mapeamento.md   (subagent)
├── README.md               (Carlos — handoff Reginaldo)
├── db/                     (Backend Architect)
│   ├── schema.sql
│   ├── triggers.sql
│   └── seed-cities.sql
├── supabase/               (Backend Architect)
│   ├── functions/
│   │   ├── scrape-burlington-arcgis/index.ts
│   │   └── move-card-board/index.ts
│   └── migrations/
│       └── 20260503_init.sql
├── app/                    (Victor)
│   ├── package.json
│   ├── vite.config.ts
│   ├── index.html
│   ├── tailwind.config.ts
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── Permits.tsx       (lista principal)
│   │   │   ├── KanbanPipeline.tsx
│   │   │   ├── KanbanAtivos.tsx
│   │   │   └── KanbanNaoEfetivados.tsx
│   │   ├── components/
│   │   │   ├── PermitCard.tsx
│   │   │   ├── KanbanColumn.tsx
│   │   │   ├── KanbanBoard.tsx
│   │   │   ├── FiltersBar.tsx
│   │   │   └── RouteButton.tsx
│   │   ├── lib/
│   │   │   ├── supabase.ts
│   │   │   ├── types.ts          (copia dos types acima)
│   │   │   └── google-maps.ts
│   │   └── hooks/
│   │       ├── usePermits.ts
│   │       └── useKanban.ts
└── docs/
    └── handoff-reginaldo.md  (Carlos — final)
```

## Regras de não-pisar-no-pé

- Backend NÃO cria Supabase project. Entrega SQL + código de Edge Function. Carlos provisiona.
- Frontend NÃO inventa endpoint. Usa o que CONTRACTS.md define. Se precisar de novo, pede pro Carlos atualizar contrato primeiro.
- Mock data: Frontend pode usar mock no início (5-10 permits hardcoded em `src/lib/mock-permits.ts`). Trocar por Supabase real quando Carlos avisar que tá plugado.
- Stack visual: Frontend clona tema dark + gold de `wiki/apresentacoes/evento-30abr-nova-era/portais-demo/cambridge-permits-portal.html`. Pode ler esse arquivo pra extrair tokens CSS.
- Drag-and-drop: usar `@hello-pangea/dnd` (já provado em `lovable-portal/src/pages/Kanban.tsx` — 653 linhas de referência).
- Roteamento: React Router. Rotas exatas: `/`, `/kanban`, `/kanban/ativos`, `/kanban/nao-efetivados`.
- Idiomas/Texto: PT-BR (cliente fala português, dados em inglês ficam como vêm).
