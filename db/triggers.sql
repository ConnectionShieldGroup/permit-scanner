-- =====================================================================
-- Permit Scanner — Triggers V1
-- Cliente: Connection Glass + Shield Pro
-- Data: 2026-05-03
--
-- 2 triggers:
-- 1. tg_create_card_on_new_permit — após INSERT em permits, cria 1 card
--    em kanban_cards (board='pipeline', column_status='encontrado').
-- 2. tg_kanban_auto_move — após UPDATE de column_status, se virou
--    'cliente' move pro board 'ativos'; se virou 'nao_fechado' move pro
--    board 'nao_efetivados' / 'reabordar'.
--
-- Decisão: trigger SQL puro resolve o "move-card-board" — NÃO precisa
-- Edge Function pra isso. Menos round-trip, atomic, sem race condition.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Trigger 1: criar card automaticamente quando novo permit chega
-- ---------------------------------------------------------------------

create or replace function fn_create_card_on_new_permit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Idempotente: ON CONFLICT respeita UNIQUE (permit_id, board)
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

-- ---------------------------------------------------------------------
-- Trigger 2: auto-move entre boards quando column_status muda
-- ---------------------------------------------------------------------

create or replace function fn_kanban_auto_move()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Só age se column_status mudou
  if new.column_status is not distinct from old.column_status
     and new.board is not distinct from old.board then
    return new;
  end if;

  -- Cliente fechou → board 'ativos', column 'ativos'
  if new.column_status = 'cliente' and new.board = 'pipeline' then
    new.board := 'ativos';
    new.column_status := 'ativos';
    new.moved_at := now();
    return new;
  end if;

  -- Não fechou → board 'nao_efetivados', column 'reabordar' (default V1)
  if new.column_status = 'nao_fechado' and new.board = 'pipeline' then
    new.board := 'nao_efetivados';
    new.column_status := 'reabordar';
    new.moved_at := now();
    return new;
  end if;

  -- Qualquer outra mudança de coluna apenas atualiza moved_at
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
  'Auto-move card entre boards quando column_status vira cliente ou nao_fechado. BEFORE UPDATE pra editar NEW direto sem segundo UPDATE.';

-- ---------------------------------------------------------------------
-- Validação manual (rodar após aplicar):
--
-- 1. INSERT em permits deve criar 1 row em kanban_cards
--    insert into permits (permit_number, address, city) values ('TEST-001', '1 Main St', 'Burlington');
--    select * from kanban_cards where permit_id in (select id from permits where permit_number='TEST-001');
--    -- Esperado: 1 row, board='pipeline', column_status='encontrado'
--
-- 2. UPDATE column_status='cliente' deve mover pra board='ativos'
--    update kanban_cards set column_status='cliente'
--      where permit_id in (select id from permits where permit_number='TEST-001');
--    select board, column_status from kanban_cards where permit_id in (select id from permits where permit_number='TEST-001');
--    -- Esperado: board='ativos', column_status='ativos'
--
-- 3. UPDATE column_status='nao_fechado' deve mover pra board='nao_efetivados'
--    (precisa criar outro permit pra testar — anterior já foi pra ativos)
--
-- 4. Cleanup
--    delete from permits where permit_number='TEST-001';  -- cascade apaga card
-- ---------------------------------------------------------------------
