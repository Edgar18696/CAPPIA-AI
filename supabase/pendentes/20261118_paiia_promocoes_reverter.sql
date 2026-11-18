-- =============================================================
-- PAIIA — Central de Promoções: REVERSÃO da proposta 20261118_paiia_promocoes_selecao.sql.
-- NÃO APLICAR sem autorização do Edgar. Remove SÓ os objetos criados por aquela proposta
-- (prefixo paiia_promocoes_). Não toca em nenhuma tabela existente do PAIIA.
-- ATENÇÃO: apaga as seleções, metas e rascunhos gravados nelas. Antes, se quiser guardar:
--   select * from public.paiia_promocoes_selecao;   (exportar pelo painel)
-- =============================================================
begin;
drop table if exists public.paiia_promocoes_selecao;
drop table if exists public.paiia_promocoes_metas;
drop table if exists public.paiia_promocoes_campanhas;
drop function if exists public.paiia_promocoes_conta_do_usuario(text);
commit;
