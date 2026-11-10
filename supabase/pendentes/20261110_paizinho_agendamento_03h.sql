-- =============================================================
-- PAIIA — Agendamento da auditoria do Paizinho às 03h (Brasília).
-- PENDENTE — NÃO APLICADO. Só depois de:
--   1) aplicar 20261110_paizinho_relatorios.sql;
--   2) publicar a função paizinho-auditoria (verify_jwt = false);
--   3) criar os segredos PAIZINHO_AUDITORIA_CHAVE e PAIZINHO_AUDITORIA_USUARIO_ID;
--   4) gravar a mesma chave no Vault (abaixo);
--   5) autorização do Edgar.
--
-- 03:00 em Brasília (UTC−3, sem horário de verão) = 06:00 UTC.
-- O pg_cron do Supabase usa UTC.
-- =============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Segredo guardado no Vault (troque o valor ANTES de rodar; nunca no Git):
-- select vault.create_secret('<MESMA CHAVE DE PAIZINHO_AUDITORIA_CHAVE>', 'paizinho_auditoria_chave');

select cron.schedule(
  'paizinho-auditoria-loja-online-03h',
  '0 6 * * *',
  $$
  select net.http_post(
    url := 'https://arqzpqkkpwikyecdbopf.supabase.co/functions/v1/paizinho-auditoria',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-paizinho-chave', (select decrypted_secret from vault.decrypted_secrets where name = 'paizinho_auditoria_chave')
    ),
    body := jsonb_build_object('conta', '1729335019', 'modo', 'executar'),
    timeout_milliseconds := 10000
  );
  $$
);

-- Conferir:   select jobname, schedule, active from cron.job;
-- Histórico:  select * from cron.job_run_details order by start_time desc limit 10;
-- Desligar:   select cron.unschedule('paizinho-auditoria-loja-online-03h');
