-- =====================================================================
-- PAIIA — EXCLUSÃO DEFINITIVA de ficha abandonada (Central de Publicação)
-- Migração preparada em 27/10/2026. NÃO EXECUTADA. Só com autorização.
--
-- O que faz: cria UMA função, public.paiia_excluir_ficha_definitivo, que
-- apaga uma única ficha do próprio usuário, numa única transação, somente
-- se ela for comprovadamente segura. Não cria política DELETE, não altera
-- tabelas, colunas, políticas, gatilhos nem dados existentes.
--
-- Base da auditoria (produção, 27/10/2026):
--  - RLS ligado (não forçado) nas 3 tabelas; políticas só SELECT/INSERT/
--    UPDATE com auth.uid() = usuario_id; nenhuma política DELETE.
--  - paiia_anuncios_publicacoes.anuncio_id -> paiia_anuncios.id ON DELETE
--    CASCADE (única chave que aponta para as fichas).
--  - paiia_registro_mlb.anuncio_id sem chave estrangeira; gatilho
--    paiia_registro_mlb_proteger só em INSERT/UPDATE (a função NÃO grava
--    nessa tabela).
--  - status_fluxo: rascunho, conferencia_aprovada, publicando, publicado,
--    publicado_com_pendencia, erro_publicacao, cancelado.
--  - status_publicacao: pendente, validado, publicado,
--    publicado_com_pendencia, erro.
--  - status_bling: nao_verificado, encontrado, nao_encontrado, ambiguo,
--    vinculado, preparado_para_criar, erro.
--
-- Regra geral: NA DÚVIDA, NÃO APAGA. Qualquer condição não comprovada
-- devolve { ok:false, motivo } e nada é alterado.
-- =====================================================================

begin;

create or replace function public.paiia_excluir_ficha_definitivo(
  p_ficha_id uuid,
  p_versao   timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_ficha public.paiia_anuncios%rowtype;
  v_dc    jsonb;
  v_txt   text;
  v_pubs  integer := 0;
  v_apag  integer := 0;
begin
  -- 1) Sessão e parâmetros
  if v_uid is null then
    return jsonb_build_object('ok', false, 'motivo', 'sem_sessao',
      'mensagem', 'Sessão expirada: entre de novo no PAIIA.');
  end if;
  if p_ficha_id is null or p_versao is null then
    return jsonb_build_object('ok', false, 'motivo', 'parametros',
      'mensagem', 'Ficha ou versão não informada: nada foi apagado.');
  end if;

  -- 2) Ficha do PRÓPRIO usuário, travada até o fim da transação.
  --    Ficha de outro usuário responde igual a "não encontrada".
  select * into v_ficha
    from public.paiia_anuncios a
   where a.id = p_ficha_id
     and a.usuario_id = v_uid
   for update;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'nao_encontrada',
      'mensagem', 'Ficha não encontrada: nada foi apagado.');
  end if;

  -- 3) Versão: outro computador/aba alterou a ficha -> não apaga.
  if v_ficha.updated_at is distinct from p_versao then
    return jsonb_build_object('ok', false, 'motivo', 'versao_alterada',
      'mensagem', 'A ficha mudou em outro computador ou aba: nada foi apagado. Atualize a lista.');
  end if;

  -- 4) Só fichas iniciadas e abandonadas.
  if v_ficha.status_fluxo not in ('rascunho', 'conferencia_aprovada') then
    return jsonb_build_object('ok', false, 'motivo', 'status_protegido',
      'mensagem', 'Ficha publicada, em publicação, com erro de publicação ou cancelada: protegida.');
  end if;

  -- 5) Ficha 510959620: sempre protegida.
  if strpos(upper(coalesce(v_ficha.codigo, '') || ' ' || coalesce(v_ficha.codigo_normalizado, '') || ' ' || coalesce(v_ficha.titulo, '')), '510959620') > 0
     or v_ficha.id::text like '510959620%' then
    return jsonb_build_object('ok', false, 'motivo', 'ficha_510959620',
      'mensagem', 'Ficha protegida (510959620).');
  end if;

  -- 6) Linhas de publicação (são apagadas pelo CASCADE): travadas e
  --    conferidas uma a uma. Só passam linhas do mesmo usuário, pendentes
  --    ou validadas, sem MLB, sem link, sem data de publicação, sem erro de
  --    publicação, sem produto no Bling e com status Bling SEGURO.
  --    Status vazio (de publicação ou de Bling) = protegido. (ajuste 27/10)
  perform 1 from public.paiia_anuncios_publicacoes p
   where p.anuncio_id = v_ficha.id
   for update;
  if exists (
    select 1 from public.paiia_anuncios_publicacoes p
     where p.anuncio_id = v_ficha.id
       and (   p.usuario_id is distinct from v_uid
            or coalesce(btrim(p.mlb_id), '') <> ''
            or coalesce(btrim(p.mlb_link), '') <> ''
            or p.publicado_em is not null
            or coalesce(btrim(p.erro_publicacao), '') <> ''
            or p.status_publicacao is null
            or p.status_publicacao not in ('pendente', 'validado')
            or p.bling_produto_id is not null
            or p.status_bling is null
            or p.status_bling not in ('nao_verificado', 'nao_encontrado', 'preparado_para_criar'))
  ) then
    return jsonb_build_object('ok', false, 'motivo', 'publicacao_vinculada',
      'mensagem', 'A ficha tem publicação, MLB, link, erro de publicação ou Bling registrado (ou status Bling desconhecido): protegida.');
  end if;
  select count(*) into v_pubs from public.paiia_anuncios_publicacoes p where p.anuncio_id = v_ficha.id;

  -- 7) Registro interno de MLBs: qualquer registro ligado a esta ficha
  --    (de qualquer usuário) protege. A tabela é só LIDA.
  if exists (select 1 from public.paiia_registro_mlb r where r.anuncio_id = v_ficha.id) then
    return jsonb_build_object('ok', false, 'motivo', 'registro_mlb',
      'mensagem', 'A ficha tem MLB no registro interno: protegida.');
  end if;

  -- 8) Dados da ficha que indicam vínculo importante.
  v_dc := coalesce(v_ficha.dados_conferencia, '{}'::jsonb);
  if jsonb_typeof(v_dc) <> 'object' then
    return jsonb_build_object('ok', false, 'motivo', 'dados_inesperados',
      'mensagem', 'Dados da ficha em formato inesperado: protegida.');
  end if;
  if (v_dc ? 'mlbs_anteriores' and coalesce(v_dc -> 'mlbs_anteriores', 'null'::jsonb) not in ('null'::jsonb, '[]'::jsonb, '{}'::jsonb))
     or (v_dc ? 'versoes_substituidas' and coalesce(v_dc -> 'versoes_substituidas', 'null'::jsonb) not in ('null'::jsonb, '[]'::jsonb, '{}'::jsonb)) then
    return jsonb_build_object('ok', false, 'motivo', 'historico_mlb',
      'mensagem', 'A ficha tem histórico de MLB ou versões anteriores: protegida.');
  end if;
  if v_dc ? 'integracao_bling' and coalesce(v_dc -> 'integracao_bling', 'null'::jsonb) not in ('null'::jsonb, '{}'::jsonb) then
    return jsonb_build_object('ok', false, 'motivo', 'integracao_bling',
      'mensagem', 'A ficha tem integração com o Bling: protegida.');
  end if;
  if (v_dc #> '{base_paiia,gravacao}') is not null and (v_dc #> '{base_paiia,gravacao}') <> 'null'::jsonb
     or coalesce(v_dc #>> '{base_paiia,decisao}', '') = 'autorizado' then
    return jsonb_build_object('ok', false, 'motivo', 'base_paiia',
      'mensagem', 'A ficha gravou (ou está autorizada a gravar) dados na Base PAIIA: protegida.');
  end if;

  -- 9) Referência indireta nos lotes de gravação da Base PAIIA (resumo,
  --    observação ou qualquer campo): se o ID da ficha aparecer, protege.
  v_txt := v_ficha.id::text;
  if exists (select 1 from public.catalogo_escrita_lote l where strpos(to_jsonb(l)::text, v_txt) > 0)
     or exists (select 1 from public.catalogo_escrita_lote_item i where strpos(to_jsonb(i)::text, v_txt) > 0) then
    return jsonb_build_object('ok', false, 'motivo', 'lote_base_paiia',
      'mensagem', 'A ficha aparece num lote da Base PAIIA: protegida.');
  end if;

  -- 10) Apaga SÓ esta ficha (as linhas de publicação conferidas no item 6
  --     saem pelo CASCADE). Condição repetida: dono, status e versão.
  delete from public.paiia_anuncios a
   where a.id = v_ficha.id
     and a.usuario_id = v_uid
     and a.updated_at = p_versao
     and a.status_fluxo in ('rascunho', 'conferencia_aprovada');
  get diagnostics v_apag = row_count;
  if v_apag <> 1 then
    raise exception 'paiia_excluir_ficha_definitivo: esperado 1 registro, apagados %', v_apag;
  end if;

  return jsonb_build_object('ok', true, 'motivo', 'apagada', 'ficha_id', v_ficha.id,
    'publicacoes_pendentes_apagadas', v_pubs,
    'mensagem', 'Ficha excluída definitivamente.');
end;
$$;

comment on function public.paiia_excluir_ficha_definitivo(uuid, timestamptz) is
  'PAIIA 27/10/2026: exclusão definitiva de UMA ficha abandonada do próprio usuário. Na dúvida, não apaga. Não grava no registro de MLBs, Bling, Base PAIIA nem fotos.';

-- Só usuários logados podem chamar (nunca anônimo / público).
revoke all on function public.paiia_excluir_ficha_definitivo(uuid, timestamptz) from public;
revoke all on function public.paiia_excluir_ficha_definitivo(uuid, timestamptz) from anon;
grant execute on function public.paiia_excluir_ficha_definitivo(uuid, timestamptz) to authenticated;

commit;

-- ---------------------------------------------------------------------
-- REVERTER (só se autorizado): remove a função; nenhum dado é afetado.
--   drop function if exists public.paiia_excluir_ficha_definitivo(uuid, timestamptz);
-- ---------------------------------------------------------------------
