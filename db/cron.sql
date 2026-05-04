-- =====================================================================
-- Permit Scanner — Cron de scraping V1
-- Cliente: Connection Glass + Shield Pro
-- Data: 2026-05-03
--
-- Cron quinzenal pra Burlington (única cidade ativa V1).
-- LIÇÃO 25/abr (lessons.md): NUNCA usar placeholder literal <PROJECT_REF>.
-- Padrão definitivo: ler URL e service_role_key de app_config.
--
-- Carlos popula app_config após provisionar Supabase do Reginaldo:
--   update app_config set value='https://<ref>.supabase.co'
--     where key='supabase_url';
--   update app_config set value='<service_role_key_real>'
--     where key='service_role_key';
--
-- Validação pós-deploy:
--   SELECT jobname, schedule, active FROM cron.job WHERE jobname like 'scrape-%';
--   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 5;
-- =====================================================================

-- Garante extensions (idempotente)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove job anterior se existir (re-deploy seguro)
select cron.unschedule('scrape-burlington-15d')
  where exists (select 1 from cron.job where jobname='scrape-burlington-15d');

-- Agenda: dia 1 e dia 16 de cada mês, 06:00 UTC (≈ 02:00 EST / 01:00 EDT)
-- Cron expression: minuto hora dia-do-mês mês dia-da-semana
-- '0 6 1,16 * *' = 06:00 UTC nos dias 1 e 16
select cron.schedule(
  'scrape-burlington-15d',
  '0 6 1,16 * *',
  $cron$
    select net.http_post(
      url := (select value from app_config where key = 'supabase_url')
             || '/functions/v1/scrape-burlington-arcgis',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select value from app_config where key = 'service_role_key')
      ),
      body := jsonb_build_object('days_back', 30)
    ) as request_id;
  $cron$
);

-- =====================================================================
-- Notas de operação
-- =====================================================================
--
-- 1. PRIMEIRA EXECUÇÃO MANUAL (após deploy):
--    Disparar via curl pra confirmar que a função funciona ANTES de esperar
--    o cron rodar. Lessons.md 25/abr: "validar com SELECT jobname FROM cron.job
--    e disparar manualmente uma vez pra confirmar escrita".
--
--    curl -X POST https://<ref>.supabase.co/functions/v1/scrape-burlington-arcgis \
--      -H "Authorization: Bearer <ANON_OR_SERVICE_KEY>" \
--      -H "Content-Type: application/json" \
--      -d '{"days_back":30}'
--
-- 2. VALIDAÇÃO SEMANAL:
--    SELECT jobname, status, return_message, start_time, end_time
--    FROM cron.job_run_details
--    WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname='scrape-burlington-15d')
--    ORDER BY start_time DESC LIMIT 10;
--
-- 3. TROCAR HORÁRIO:
--    select cron.unschedule('scrape-burlington-15d');
--    select cron.schedule('scrape-burlington-15d', '<novo cron>', $cron$ ... $cron$);
--
-- 4. CIDADES NOVAS V2+:
--    Quando Backend criar `scrape-permiteyes` (cobre 10 cidades), agendar
--    cron separado:
--      select cron.schedule('scrape-permiteyes-15d', '0 7 1,16 * *', $cron$ ... $cron$);
-- =====================================================================
