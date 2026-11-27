-- =====================================================================
-- PAIIA PARCEIROS — REVERSÃO (desfaz 01_parceiros_producao.sql)
-- Serve para a produção e para o STAGING. Rodar em UMA transação.
--
-- O que faz:
--  1) desliga o agendador da lista de montadoras/modelos;
--  2) retira as permissões dos arquivos (logotipos e catálogos) e fecha o logotipo público;
--  3) apaga as funções do PAIIA Parceiros (com elas saem as regras de acesso e os gatilhos);
--  4) NÃO APAGA DADOS: move as tabelas para a pasta "parceiros_revertido_<data_hora>",
--     que o site e a API não enxergam. Assim, nada que os parceiros cadastraram se perde
--     e a publicação pode ser refeita depois.
-- Não toca em nenhuma outra tabela do PAIIA (catalogo_*, fichas, anúncios etc.).
-- Os arquivos já enviados continuam guardados nos buckets (privados).
-- =====================================================================
do $reversao$
declare
  esq text := 'parceiros_revertido_' || to_char(clock_timestamp(), 'YYYYMMDD_HH24MISS_MS');
  t text;
  movidas int := 0;
begin
  -- 1) agendador
  if to_regclass('cron.job') is not null then
    perform cron.unschedule(j.jobid) from cron.job j where j.jobname = 'paiia-parceiros-vocabulario';
  end if;

  -- 2) arquivos
  drop policy if exists parceiros_logos_gravar on storage.objects;
  drop policy if exists parceiros_logos_apagar on storage.objects;
  drop policy if exists parceiros_catalogos_gravar on storage.objects;
  drop policy if exists parceiros_catalogos_ler on storage.objects;
  update storage.buckets set public = false where id in ('parceiros-logos', 'parceiros-catalogos');

  -- 3) funções (cascade leva junto as regras de acesso e os gatilhos que dependem delas)
  drop function if exists public.parceiros_buscar_texto(text) cascade;
  drop function if exists public.parceiros_aprovar_pendentes(uuid) cascade;
  drop function if exists public.parceiros_validacao_itens(uuid) cascade;
  drop function if exists public.parceiro_itens_conferencia() cascade;
  drop function if exists public.parceiro_itens_proteger() cascade;
  drop function if exists public.parceiros_proteger() cascade;
  drop function if exists public.parceiros_verificar_vencimentos() cascade;
  drop function if exists public.parceiros_atualizar_vocabulario() cascade;
  drop function if exists public.parceiros_garantir_vocabulario() cascade;
  drop function if exists public.parceiros_recalcular_vocabulario() cascade;
  drop function if exists public.parceiros_vocabulario_assinatura() cascade;
  drop function if exists public.parceiros_contas_do_parceiro(uuid) cascade;
  drop function if exists public.parceiros_vincular_usuario(uuid, text) cascade;
  drop function if exists public.parceiros_desvincular_usuario(uuid, uuid) cascade;
  drop function if exists public.parceiros_meu_papel() cascade;
  drop function if exists public.parceiros_visivel(uuid) cascade;
  drop function if exists public.parceiros_eh_membro(uuid) cascade;
  drop function if exists public.parceiros_eh_admin() cascade;
  drop function if exists public.parceiros_pasta(text) cascade;
  drop function if exists public.parceiros_familia(text) cascade;
  drop function if exists public.parceiros_familias_compativeis(text, text) cascade;
  drop function if exists public.parceiros_primeira_palavra(text) cascade;
  drop function if exists public.parceiros_texto_busca(text) cascade;

  -- 4) tabelas guardadas fora do alcance do site
  execute format('create schema %I', esq);
  execute format('revoke all on schema %I from public', esq);
  foreach t in array array['parceiro_cotacoes', 'parceiro_catalogo_itens', 'parceiro_contratos', 'parceiro_controle',
                           'parceiro_usuarios', 'parceiros_admins', 'parceiro_vocab_aplicacao', 'parceiro_vocab_estado',
                           'parceiro_familias_peca', 'parceiros'] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I set schema %I', t, esq);
      execute format('revoke all on %I.%I from anon, authenticated', esq, t);
      movidas := movidas + 1;
    end if;
  end loop;

  raise notice 'PAIIA Parceiros revertido: % tabela(s) guardadas em %; funções, permissões e agendador retirados.', movidas, esq;
end $reversao$;
