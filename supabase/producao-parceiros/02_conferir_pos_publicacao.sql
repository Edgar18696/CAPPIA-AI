-- PAIIA Parceiros — conferência depois da publicação (SÓ LEITURA; pode rodar quantas vezes quiser)
select
  (select count(*) from pg_tables where schemaname = 'public' and tablename like 'parceir%')                    as tabelas_10,
  (select count(*) from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public' and p.proname like 'parceir%')                                                  as funcoes_23,
  (select count(*) from public.parceiros_admins)                                                                as administradores_1,
  (select left(user_id::text, 8) from public.parceiros_admins limit 1)                                          as administrador,
  (select count(*) from public.parceiros where ficticio)                                                        as parceiros_ficticios_0,
  (select count(*) from public.parceiros where id = '00000000-0000-4000-a000-000000000001')                     as distribuidora_piloto_0,
  (select count(*) from public.parceiro_vocab_aplicacao)                                                        as lista_montadoras_modelos,
  (select count(*) from cron.job where jobname = 'paiia-parceiros-vocabulario' and active)                      as agendador_1,
  (select count(*) from public.catalogo_pecas)                                                                  as base_tecnica_pecas,
  (select count(*) from public.catalogo_chaves)                                                                 as base_tecnica_chaves;
