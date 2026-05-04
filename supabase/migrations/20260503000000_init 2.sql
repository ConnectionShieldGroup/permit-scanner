-- =====================================================================
-- Permit Scanner — Migration consolidada V1
-- Cliente: Connection Glass + Shield Pro (Reginaldo + Michel)
-- Data: 2026-05-03
-- Backend Architect
--
-- Concatena na ordem:
--   1. db/schema.sql      — extensions, ENUMs, tabelas, RLS, view
--   2. db/triggers.sql    — auto-criação de card + auto-move entre boards
--   3. db/seed-cities.sql — 29 cidades MA (somente Hingham active=true)
--   4. db/cron.sql        — pg_cron quinzenal apontando pra scrape-permiteyes
--
-- Aplicar via:
--   supabase db push                       (CLI)
--   ou colar inteiro no SQL Editor do Supabase Dashboard.
--
-- Idempotente: re-rodar não quebra (todos os CREATE são IF NOT EXISTS,
-- ENUMs em DO $$ ... duplicate_object catch, ON CONFLICT no seed,
-- cron.unschedule guarded). Pode ser aplicado N vezes.
-- =====================================================================


-- =====================================================================
-- PARTE 1 — SCHEMA
-- =====================================================================

create extension if not exists "pgcrypto";
create extension if not exists "pg_cron";
create extension if not exists "pg_net";

-- ENUMs
-- 7 categorias relevantes (decisão Fábio 03/mai). Permits que não batem em nenhuma
-- das palavras-chave dessas 7 são SKIPPED no scraper.
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
    'encontrado',
    'visitado',
    'apresentacao',
    'proposta',
    'cliente',
    'nao_fechado',
    'ativos',
    'reabordar',
    'descartado'
  );
exception when duplicate_object then null; end $$;

-- Tabela permits
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
  updated_at      timestamptz not null default now()
);

do $$ begin
  alter table permits add constraint permits_permit_number_unique unique (permit_number);
exception when duplicate_object then null; end $$;

create index if not exists idx_permits_city_date    on permits (city, permit_date desc);
create index if not exists idx_permits_work_type    on permits (work_type);
create index if not exists idx_permits_created_at   on permits (created_at desc);

-- Trigger updated_at
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

-- Tabela kanban_cards
create table if not exists kanban_cards (
  id            uuid primary key default gen_random_uuid(),
  permit_id     uuid not null references permits(id) on delete cascade,
  board         kanban_board not null default 'pipeline',
  column_status kanban_column not null default 'encontrado',
  notes         text,
  moved_at      timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

do $$ begin
  alter table kanban_cards add constraint kanban_cards_permit_board_unique
    unique (permit_id, board);
exception when duplicate_object then null; end $$;

create index if not exists idx_kanban_cards_board_column on kanban_cards (board, column_status);
create index if not exists idx_kanban_cards_permit       on kanban_cards (permit_id);
create index if not exists idx_kanban_cards_moved_at     on kanban_cards (moved_at desc);

-- Tabela cities_config
create table if not exists cities_config (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  state       text not null default 'MA',
  platform    text not null,
  base_url    text not null,
  parser_name text not null,
  active      boolean not null default false,
  last_run    timestamptz,
  notes       text,
  created_at  timestamptz not null default now()
);

do $$ begin
  alter table cities_config add constraint cities_config_name_state_unique
    unique (name, state);
exception when duplicate_object then null; end $$;

create index if not exists idx_cities_config_active on cities_config (active) where active = true;

-- Tabela app_config (secrets do cron)
create table if not exists app_config (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

drop trigger if exists tg_app_config_updated_at on app_config;
create trigger tg_app_config_updated_at
  before update on app_config
  for each row execute function set_updated_at();

insert into app_config (key, value) values
  ('supabase_url', 'PLACEHOLDER_REPLACE_AT_DEPLOY'),
  ('service_role_key', 'PLACEHOLDER_REPLACE_AT_DEPLOY')
on conflict (key) do nothing;

-- RLS
alter table permits         enable row level security;
alter table kanban_cards    enable row level security;
alter table cities_config   enable row level security;
alter table app_config      enable row level security;

drop policy if exists "permits_select_public" on permits;
create policy "permits_select_public" on permits
  for select using (true);

drop policy if exists "permits_write_service" on permits;
create policy "permits_write_service" on permits
  for all to service_role using (true) with check (true);

drop policy if exists "kanban_select_public" on kanban_cards;
create policy "kanban_select_public" on kanban_cards
  for select using (true);

drop policy if exists "kanban_update_public" on kanban_cards;
create policy "kanban_update_public" on kanban_cards
  for update using (true) with check (true);

drop policy if exists "kanban_insert_service" on kanban_cards;
create policy "kanban_insert_service" on kanban_cards
  for insert to service_role with check (true);

drop policy if exists "kanban_delete_service" on kanban_cards;
create policy "kanban_delete_service" on kanban_cards
  for delete to service_role using (true);

drop policy if exists "cities_select_public" on cities_config;
create policy "cities_select_public" on cities_config
  for select using (true);

drop policy if exists "cities_write_service" on cities_config;
create policy "cities_write_service" on cities_config
  for all to service_role using (true) with check (true);

drop policy if exists "app_config_service_only" on app_config;
create policy "app_config_service_only" on app_config
  for all to service_role using (true) with check (true);

-- View
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


-- =====================================================================
-- PARTE 2 — TRIGGERS
-- =====================================================================

-- Trigger 1: criar card automaticamente quando novo permit chega
create or replace function fn_create_card_on_new_permit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into kanban_cards (permit_id, board, column_status)
  values (new.id, 'pipeline', 'encontrado')
  on conflict (permit_id, board) do nothing;
  return new;
end;
$$;

drop trigger if exists tg_create_card_on_new_permit on permits;
create trigger tg_create_card_on_new_permit
  after insert on permits
  for each row execute function fn_create_card_on_new_permit();

comment on function fn_create_card_on_new_permit() is
  'Cria 1 kanban_card em pipeline/encontrado pra cada permit novo. Idempotente via ON CONFLICT.';

-- Trigger 2: auto-move entre boards quando column_status muda
create or replace function fn_kanban_auto_move()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.column_status is not distinct from old.column_status
     and new.board is not distinct from old.board then
    return new;
  end if;

  if new.column_status = 'cliente' and new.board = 'pipeline' then
    new.board := 'ativos';
    new.column_status := 'ativos';
    new.moved_at := now();
    return new;
  end if;

  if new.column_status = 'nao_fechado' and new.board = 'pipeline' then
    new.board := 'nao_efetivados';
    new.column_status := 'reabordar';
    new.moved_at := now();
    return new;
  end if;

  if new.column_status is distinct from old.column_status then
    new.moved_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists tg_kanban_auto_move on kanban_cards;
create trigger tg_kanban_auto_move
  before update of column_status, board on kanban_cards
  for each row execute function fn_kanban_auto_move();

comment on function fn_kanban_auto_move() is
  'Auto-move card entre boards quando column_status vira cliente ou nao_fechado.';


-- =====================================================================
-- PARTE 3 — SEED CITIES
--
-- ATENÇÃO: db/seed-cities.sql original tem Hingham DUPLICADO (linha 15
-- como "Norte/NW" e linha 107 como "South Shore"). Aqui consolidamos em
-- 1 só registro com active=true e URL canônica /publicview.php.
-- 29 cidades únicas (não 30 — Burlington Ontario foi removida do escopo).
-- =====================================================================

insert into cities_config (name, state, platform, base_url, parser_name, active, notes) values

  -- ===== ÚNICA ATIVA V1 =====
  ('Hingham',          'MA', 'permiteyes',
   'https://permiteyes.us/hingham/publicview.php',
   'scrape-permiteyes', true,
   'V1 ALVO. AJAX endpoint /ajax/getbuildingpublichome.php retorna JSON com 84+ permits reais. Padrão cobre 9 outras cidades PermitEyes em V2.'),

  -- ===== Norte/NW Boston (14 — sem Burlington) =====
  ('Lexington',        'MA', 'opengov_viewpoint',
   'https://lexingtonma.portal.opengov.com/',
   'scrape-opengov-viewpoint', false,
   'SPA React. Search público mas precisa Puppeteer ou interceptar XHR. V4.'),

  ('Winchester',       'MA', 'civicplus_custom',
   'https://www.winchester.us/899/Online-Building-Permits',
   'scrape-html-generic', false,
   'Login obrigatório. Backlog V6+ ou abandona.'),

  ('Stoneham',         'MA', 'opengov_viewpoint',
   'https://stonehamma.portal.opengov.com/',
   'scrape-opengov-viewpoint', false,
   'SPA React. Public records search via portal. V4.'),

  ('Reading',          'MA', 'opengov_viewpoint',
   'https://readingma.portal.opengov.com/',
   'scrape-opengov-viewpoint', false,
   'SPA React. Tem também Monthly Building Permit Report PDF. V4.'),

  ('Wakefield',        'MA', 'foia_only',
   'https://www.wakefield.ma.us/inspectional-services-zoning',
   'request-foia', false,
   'Building permits NÃO estão online. FOIA via c.66. Excluído V1-V5.'),

  ('Wilmington',       'MA', 'foia_only',
   'https://www.wilmingtonma.gov/building-inspector',
   'request-foia', false,
   'Sem portal público. Town Hall ou FOIA. Excluído V1-V5.'),

  ('North Reading',    'MA', 'permiteyes',
   'https://permiteyes.us/northreading/publicview.php',
   'scrape-permiteyes', false,
   'PermitEyes publicview ABERTO. EASY-MEDIUM. V2.'),

  ('Medford',          'MA', 'citizenserve',
   'https://www2.citizenserve.com/Portal/?installationid=315',
   'scrape-citizenserve', false,
   'Login obrigatório. Backlog V6+.'),

  ('Melrose',          'MA', 'simplicity_mapsonline',
   'https://www.mapsonline.net/simplicity/building_permits.php?client=melrosema',
   'scrape-simplicity', false,
   'MapsOnline padrão. HTML estável. V3.'),

  ('Arlington',        'MA', 'opengov_viewpoint',
   'https://arlingtonma.portal.opengov.com/',
   'scrape-opengov-viewpoint', false,
   'SPA React. V4.'),

  ('Malden',           'MA', 'tyler_energov',
   'https://maldenma-energovweb.tylerhost.net/apps/SelfService',
   'scrape-tyler-energov', false,
   'Tyler EnerGov self-service exige conta. Backlog V6+.'),

  ('Billerica',        'MA', 'simplicity_mapsonline',
   'https://www.mapsonline.net/simplicity/building_permits.php?client=billericama&use_react=yes',
   'scrape-simplicity', false,
   'MapsOnline com React. Endpoint público. V3.'),

  ('Bedford',          'MA', 'permiteyes',
   'https://permiteyes.us/bedford/publicview.php',
   'scrape-permiteyes', false,
   'PermitEyes — confirmar publicview ativo. V2.'),

  ('Waltham',          'MA', 'custom',
   'https://www.city.waltham.ma.us/building-department/pages/issued-permits',
   'scrape-waltham-custom', false,
   'Sistema custom. Search by address público. V5.'),

  -- ===== South Shore (14 — sem Hingham, já ativada acima) =====
  ('Abington',         'MA', 'opengov_viewpoint',
   'https://abingtonma.portal.opengov.com/',
   'scrape-opengov-viewpoint', false,
   'OpenGov padrão. V4.'),

  ('Whitman',          'MA', 'permiteyes',
   'https://permiteyes.us/whitman/publicview.php',
   'scrape-permiteyes', false,
   'PermitEyes — confirmar publicview ativo. V2.'),

  ('Hanover',          'MA', 'opengov_viewpoint',
   'https://hanoverma.portal.opengov.com/',
   'scrape-opengov-viewpoint', false,
   'OpenGov + alias ViewpointCloud. V4.'),

  ('Weymouth',         'MA', 'opengov_viewpoint',
   'https://www.weymouth.ma.us/1675/Online-Permit-Application',
   'scrape-opengov-viewpoint', false,
   'Provável OpenGov via auth.viewpointcloud.com. V4.'),

  ('Braintree',        'MA', 'permiteyes',
   'https://permiteyes.us/braintree/publicview.php',
   'scrape-permiteyes', false,
   'PermitEyes — confirmar publicview ativo. V2.'),

  ('Quincy',           'MA', 'opengov_viewpoint',
   'https://quincyma.viewpointcloud.com/search',
   'scrape-opengov-viewpoint', false,
   'SPA React. Cidade grande = volume alto. V4.'),

  ('Norwell',          'MA', 'permiteyes',
   'https://permiteyes.us/norwell/publichome.php',
   'scrape-permiteyes', false,
   'PermitEyes publichome confirmado. V2.'),

  ('Scituate',         'MA', 'permiteyes',
   'https://permiteyes.us/scituate/publicview.php',
   'scrape-permiteyes', false,
   'PermitEyes — todos permits online desde 2021. V2.'),

  ('Marshfield',       'MA', 'permiteyes_net',
   'https://permiteyes.net/MarBldg/user_logins.asp',
   'scrape-permiteyes-net', false,
   'Variant PermitEyes (.net + ASP). Public Records Search. V2.'),

  ('Pembroke',         'MA', 'simplicity_mapsonline',
   'https://www.mapsonline.net/pembrokema/permit_public_portal.php',
   'scrape-simplicity', false,
   'MapsOnline permit_public_portal ABERTO. ALVO TOP V3.'),

  ('Hanson',           'MA', 'permiteyes',
   'https://permiteyes.us/hanson/publicview.php',
   'scrape-permiteyes', false,
   'PermitEyes — confirmar URL ativo. V2.'),

  ('East Bridgewater', 'MA', 'simplicity_mapsonline',
   'https://www.mapsonline.net/eastbridgewaterma/online_permits/',
   'scrape-simplicity', false,
   'Dois portais (SmartGov + MapsOnline). V3.'),

  ('Brockton',         'MA', 'citizenserve',
   'https://www4.citizenserve.com/Portal/PortalController?Action=showSearchPage&ctzPagePrefix=Portal_&installationID=390',
   'scrape-citizenserve', false,
   'CitizenServe search público (sem login). Cidade grande. V5.'),

  ('Randolph',         'MA', 'permiteyes',
   'https://permiteyes.us/randolph/publicview.php',
   'scrape-permiteyes', false,
   'PermitEyes publicview confirmado. 20 tipos de permit. V2.')

on conflict (name, state) do update
  set platform    = excluded.platform,
      base_url    = excluded.base_url,
      parser_name = excluded.parser_name,
      notes       = excluded.notes;
-- Nota: ON CONFLICT NÃO atualiza `active` (preserva ativações manuais).


-- =====================================================================
-- PARTE 4 — CRON
--
-- Aponta pra scrape-permiteyes (não scrape-burlington-arcgis do plano antigo).
-- Schedule: dia 1 e 16 de cada mês, 06:00 UTC (~02:00 EST / 01:00 EDT).
-- =====================================================================

-- Remove jobs antigos se existirem (re-deploy seguro)
do $$ begin
  if exists (select 1 from cron.job where jobname = 'scrape-burlington-15d') then
    perform cron.unschedule('scrape-burlington-15d');
  end if;
  if exists (select 1 from cron.job where jobname = 'scrape-permiteyes-15d') then
    perform cron.unschedule('scrape-permiteyes-15d');
  end if;
end $$;

-- Agenda novo job
select cron.schedule(
  'scrape-permiteyes-15d',
  '0 6 1,16 * *',
  $cron$
    select net.http_post(
      url := (select value from app_config where key = 'supabase_url')
             || '/functions/v1/scrape-permiteyes',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select value from app_config where key = 'service_role_key')
      ),
      body := jsonb_build_object()
    ) as request_id;
  $cron$
);

-- =====================================================================
-- VALIDAÇÃO PÓS-DEPLOY (Carlos roda manualmente):
--
-- 1. Confere job criado:
--    SELECT jobname, schedule, active FROM cron.job WHERE jobname like 'scrape-%';
--
-- 2. Substitui placeholders:
--    UPDATE app_config SET value='https://<ref>.supabase.co' WHERE key='supabase_url';
--    UPDATE app_config SET value='<service_role_key>'        WHERE key='service_role_key';
--
-- 3. Dispara manualmente uma vez:
--    curl -X POST https://<ref>.supabase.co/functions/v1/scrape-permiteyes \
--      -H "Content-Type: application/json" \
--      -d '{"city_slug":"hingham"}'
--
-- 4. Confere resultado:
--    SELECT count(*) FROM permits WHERE city='Hingham';
--    SELECT board, column_status, count(*) FROM kanban_cards GROUP BY 1,2;
--
-- 5. Confere histórico do cron:
--    SELECT jobname, status, return_message, start_time
--    FROM cron.job_run_details jrd
--    JOIN cron.job j USING (jobid)
--    WHERE jobname = 'scrape-permiteyes-15d'
--    ORDER BY start_time DESC LIMIT 10;
-- =====================================================================
