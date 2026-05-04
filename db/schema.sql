-- =====================================================================
-- Permit Scanner — Schema V1
-- Cliente: Connection Glass + Shield Pro (Reginaldo + Michel)
-- Data: 2026-05-03
-- Backend Architect
--
-- Define as 3 tabelas + ENUMs + RLS + indexes + app_config (secrets do cron).
-- Triggers ficam em triggers.sql. Seed das cidades em seed-cities.sql.
-- Migration consolidada em supabase/migrations/20260503000000_init.sql.
-- =====================================================================

-- Extensions necessárias
create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "pg_cron";    -- agendamento (usado em cron.sql)
create extension if not exists "pg_net";     -- net.http_post (usado em cron.sql)

-- =====================================================================
-- ENUMs (matchando os tipos TypeScript em CONTRACTS.md)
-- =====================================================================

do $$ begin
  create type work_type as enum (
    'new_construction',
    'kitchen_renovation',
    'bath_renovation',
    'addition',
    'renovation',
    'building_permit',
    'foundation_permit'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type kanban_board as enum (
    'pipeline',
    'ativos',
    'nao_efetivados'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type kanban_column as enum (
    -- pipeline (6 colunas)
    'encontrado',
    'visitado',
    'apresentacao',
    'proposta',
    'cliente',
    'nao_fechado',
    -- ativos (1 coluna V1)
    'ativos',
    -- nao_efetivados (2 colunas V1)
    'reabordar',
    'descartado'
  );
exception when duplicate_object then null; end $$;

-- =====================================================================
-- Tabela: permits
-- Fonte de verdade dos building permits coletados pelo scraper.
-- =====================================================================

create table if not exists permits (
  id               uuid primary key default gen_random_uuid(),
  permit_number    text not null,
  applicant_name   text,
  address          text not null,
  city             text not null,
  state            text not null default 'MA',
  phone            text,
  email            text,
  work_type        work_type not null default 'building_permit',
  permit_date      date,                         -- IssueDate (cidade emitiu)
  application_date date,                         -- ApplDate (cidadão pediu)
  estimated_value  numeric(12,2),
  status_source    text,
  source_url       text,                         -- link pro permit no portal
  description      text,                         -- BriefDescription do detalhe
  raw_data         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- UNIQUE constraint OBRIGATÓRIA pra upsert idempotente do scraper
-- (lessons.md 25/abr: "tabelas com upsert onConflict precisam de UNIQUE")
do $$ begin
  alter table permits add constraint permits_permit_number_unique unique (permit_number);
exception when duplicate_object then null; end $$;

-- Indexes pra queries da UI (lista filtrada por cidade + ordenada por data)
create index if not exists idx_permits_city_date
  on permits (city, permit_date desc);

create index if not exists idx_permits_work_type
  on permits (work_type);

create index if not exists idx_permits_created_at
  on permits (created_at desc);

-- Trigger updated_at automático
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tg_permits_updated_at on permits;
create trigger tg_permits_updated_at
  before update on permits
  for each row execute function set_updated_at();

-- =====================================================================
-- Tabela: kanban_cards
-- 1 card por permit (criado automaticamente via trigger). Time arrasta
-- entre colunas. Auto-move pra board='ativos' ou 'nao_efetivados' via trigger.
-- =====================================================================

create table if not exists kanban_cards (
  id            uuid primary key default gen_random_uuid(),
  permit_id     uuid not null references permits(id) on delete cascade,
  board         kanban_board not null default 'pipeline',
  column_status kanban_column not null default 'encontrado',
  notes         text,
  moved_at      timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

-- 1 card por permit por board (evita duplicação se trigger rodar 2x)
do $$ begin
  alter table kanban_cards add constraint kanban_cards_permit_board_unique
    unique (permit_id, board);
exception when duplicate_object then null; end $$;

-- Indexes pra queries do kanban (board específico, ordenado por movimentação)
create index if not exists idx_kanban_cards_board_column
  on kanban_cards (board, column_status);

create index if not exists idx_kanban_cards_permit
  on kanban_cards (permit_id);

create index if not exists idx_kanban_cards_moved_at
  on kanban_cards (moved_at desc);

-- =====================================================================
-- Tabela: cities_config
-- Parametriza scrapers. V1 só Burlington active=true. Demais 29 ficam
-- desativadas (active=false) até parser específico ser criado.
-- =====================================================================

create table if not exists cities_config (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  state       text not null default 'MA',
  platform    text not null,            -- 'arcgis_hub', 'permiteyes', 'opengov_viewpoint', etc.
  base_url    text not null,
  parser_name text not null,            -- nome da Edge Function (ex: 'scrape-burlington-arcgis')
  active      boolean not null default false,
  last_run    timestamptz,
  notes       text,
  created_at  timestamptz not null default now()
);

do $$ begin
  alter table cities_config add constraint cities_config_name_state_unique
    unique (name, state);
exception when duplicate_object then null; end $$;

create index if not exists idx_cities_config_active
  on cities_config (active) where active = true;

-- =====================================================================
-- Tabela: app_config
-- Secrets do cron (service_role_key, supabase_url). Lessons.md 25/abr:
-- nunca usar GUC custom (Supabase managed bloqueia ALTER DATABASE SET).
-- Cron lê secret via (SELECT value FROM app_config WHERE key=...).
-- =====================================================================

create table if not exists app_config (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

drop trigger if exists tg_app_config_updated_at on app_config;
create trigger tg_app_config_updated_at
  before update on app_config
  for each row execute function set_updated_at();

-- Placeholder pro Carlos substituir no deploy (não commitar valor real)
insert into app_config (key, value) values
  ('supabase_url', 'PLACEHOLDER_REPLACE_AT_DEPLOY'),
  ('service_role_key', 'PLACEHOLDER_REPLACE_AT_DEPLOY')
on conflict (key) do nothing;

-- =====================================================================
-- RLS — V1 simples (sem auth de usuário ainda)
-- - anon: SELECT em permits, kanban_cards, cities_config (read-only)
-- - service_role: tudo (já bypassa RLS por default no Supabase)
-- - app_config: SELECT apenas service_role (secrets)
-- =====================================================================

alter table permits         enable row level security;
alter table kanban_cards    enable row level security;
alter table cities_config   enable row level security;
alter table app_config      enable row level security;

-- permits: anon e authenticated podem ler
drop policy if exists "permits_select_public" on permits;
create policy "permits_select_public" on permits
  for select using (true);

-- permits: writes só via service_role (Edge Function do scraper)
drop policy if exists "permits_write_service" on permits;
create policy "permits_write_service" on permits
  for all to service_role using (true) with check (true);

-- kanban_cards: anon pode ler e atualizar (V1 — sem login. UI move cards)
drop policy if exists "kanban_select_public" on kanban_cards;
create policy "kanban_select_public" on kanban_cards
  for select using (true);

drop policy if exists "kanban_update_public" on kanban_cards;
create policy "kanban_update_public" on kanban_cards
  for update using (true) with check (true);

-- INSERT em kanban_cards só via trigger (não pela UI). DELETE só service_role.
drop policy if exists "kanban_insert_service" on kanban_cards;
create policy "kanban_insert_service" on kanban_cards
  for insert to service_role with check (true);

drop policy if exists "kanban_delete_service" on kanban_cards;
create policy "kanban_delete_service" on kanban_cards
  for delete to service_role using (true);

-- cities_config: anon lê, service_role escreve
drop policy if exists "cities_select_public" on cities_config;
create policy "cities_select_public" on cities_config
  for select using (true);

drop policy if exists "cities_write_service" on cities_config;
create policy "cities_write_service" on cities_config
  for all to service_role using (true) with check (true);

-- app_config: SOMENTE service_role (secrets)
drop policy if exists "app_config_service_only" on app_config;
create policy "app_config_service_only" on app_config
  for all to service_role using (true) with check (true);

-- =====================================================================
-- View útil pra UI: kanban_cards com permit JOIN-ado
-- Victor pode usar diretamente: select * from v_kanban_cards_full where board='pipeline'
-- =====================================================================

create or replace view v_kanban_cards_full as
select
  kc.id,
  kc.board,
  kc.column_status,
  kc.notes,
  kc.moved_at,
  kc.created_at as card_created_at,
  p.id            as permit_id,
  p.permit_number,
  p.applicant_name,
  p.address,
  p.city,
  p.state,
  p.phone,
  p.email,
  p.work_type,
  p.permit_date,
  p.estimated_value,
  p.status_source,
  p.created_at    as permit_created_at
from kanban_cards kc
join permits p on p.id = kc.permit_id;

comment on view v_kanban_cards_full is
  'Kanban cards com permit JOIN-ado. Usar em queries da UI pra evitar 2 round-trips.';
