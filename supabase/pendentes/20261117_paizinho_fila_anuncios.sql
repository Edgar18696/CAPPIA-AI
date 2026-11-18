-- =============================================================
-- PAIIA — Central do Paizinho: FILA DE ANÚNCIOS SEM REPETIÇÃO (17/11/2026)
-- PENDENTE — NÃO APLICADO. Aplicar só com autorização do Edgar.
--
-- Histórico permanente por conta Mercado Livre (LOJA ONLINE, CIEBR, REVELAÇÃO):
--   paiia_paizinho_rodadas     uma linha por análise concluída (id gerado no navegador)
--   paiia_paizinho_anuncios    situação atual de cada anúncio (conta + MLB)
--   paiia_paizinho_pendencias  pendências por anúncio e assunto (aberta/resolvida/removida)
--   paiia_paizinho_eventos     histórico: análises, reanálises e mudanças de situação
-- Gravação só pelas duas funções abaixo (uma transação cada; o id impede duplicar).
-- Mesmas regras de src/services/paizinhoAuditoria/filaAnuncios.js.
-- Nada aqui toca anúncios, preços, estoque ou o Bling. Só tabelas novas.
-- Desfazer: ver o bloco "DESFAZER" no fim.
-- =============================================================

create table if not exists public.paiia_paizinho_rodadas (
  id text primary key,
  usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  conta_ml text not null check (conta_ml in ('1729335019', '824312524', '2412238242')),
  modo text not null check (modo in ('novos', 'reanalise')),
  em timestamptz not null,
  relatorio_de text,
  ativos_total integer,
  ineditos_antes integer,
  ineditos_depois integer,
  lista_completa boolean not null default true,
  quantidade integer not null,
  mlbs text[] not null,
  registrada_em timestamptz not null default now()
);
create index if not exists paiia_paizinho_rodadas_conta_idx on public.paiia_paizinho_rodadas (usuario_id, conta_ml, em desc);

create table if not exists public.paiia_paizinho_anuncios (
  usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  conta_ml text not null check (conta_ml in ('1729335019', '824312524', '2412238242')),
  mlb text not null check (mlb ~ '^MLB[0-9]+$'),
  sku text,
  titulo text,
  pontuacao integer,
  resultado jsonb,
  situacao text not null default 'analisado' check (situacao in ('analisado', 'pendente', 'resolvido')),
  analises integer not null default 1,
  primeira_analise_em timestamptz not null,
  ultima_analise_em timestamptz not null,
  primary key (usuario_id, conta_ml, mlb)
);

create table if not exists public.paiia_paizinho_pendencias (
  usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  conta_ml text not null,
  mlb text not null,
  area text not null,
  severidade text,
  problema text,
  sugestao text,
  impacto_rs numeric(12,2),
  status text not null default 'aberta' check (status in ('aberta', 'resolvida', 'removida')),
  detectada_em timestamptz not null,
  ultima_vez_em timestamptz not null,
  resolvida_em timestamptz,
  motivo text,
  reaberta boolean not null default false,
  primary key (usuario_id, conta_ml, mlb, area)
);

create table if not exists public.paiia_paizinho_eventos (
  id text primary key,
  usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  conta_ml text not null,
  mlb text not null,
  area text,
  tipo text not null check (tipo in ('analise', 'reanalise', 'resolvido', 'removido', 'devolvido')),
  rodada_id text references public.paiia_paizinho_rodadas(id) on delete restrict,
  em timestamptz not null,
  situacao_antes text,
  situacao_depois text,
  dados jsonb
);
create index if not exists paiia_paizinho_eventos_conta_idx on public.paiia_paizinho_eventos (usuario_id, conta_ml, em desc);

-- Leitura: só o dono. Escrita: só pelas funções abaixo (sem insert/update/delete direto).
alter table public.paiia_paizinho_rodadas enable row level security;
alter table public.paiia_paizinho_anuncios enable row level security;
alter table public.paiia_paizinho_pendencias enable row level security;
alter table public.paiia_paizinho_eventos enable row level security;
drop policy if exists "dono le rodadas" on public.paiia_paizinho_rodadas;
create policy "dono le rodadas" on public.paiia_paizinho_rodadas for select to authenticated using (usuario_id = auth.uid());
drop policy if exists "dono le anuncios" on public.paiia_paizinho_anuncios;
create policy "dono le anuncios" on public.paiia_paizinho_anuncios for select to authenticated using (usuario_id = auth.uid());
drop policy if exists "dono le pendencias" on public.paiia_paizinho_pendencias;
create policy "dono le pendencias" on public.paiia_paizinho_pendencias for select to authenticated using (usuario_id = auth.uid());
drop policy if exists "dono le eventos" on public.paiia_paizinho_eventos;
create policy "dono le eventos" on public.paiia_paizinho_eventos for select to authenticated using (usuario_id = auth.uid());

-- Situação do anúncio: pendente (alguma aberta), resolvido (nenhuma aberta e alguma resolvida), analisado.
create or replace function public.paizinho_situacao(p_usuario uuid, p_conta text, p_mlb text)
returns text language sql stable set search_path = public as $$
  select case
    when exists (select 1 from paiia_paizinho_pendencias where usuario_id = p_usuario and conta_ml = p_conta and mlb = p_mlb and status = 'aberta') then 'pendente'
    when exists (select 1 from paiia_paizinho_pendencias where usuario_id = p_usuario and conta_ml = p_conta and mlb = p_mlb and status = 'resolvida') then 'resolvido'
    else 'analisado' end;
$$;

-- Registra UMA rodada concluída (tudo ou nada). Mesmo id de novo = ignorado.
create or replace function public.paizinho_registrar_rodada(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_conta text := p->>'conta';
  v_em timestamptz := (p->>'em')::timestamptz;
  v_n int;
  a jsonb;
  pd jsonb;
  v_mlb text;
  v_antes text;
  v_depois text;
  v_existia boolean;
  v_areas text[];
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'erro', 'Usuário não autenticado.'); end if;
  if v_conta not in ('1729335019', '824312524', '2412238242') then return jsonb_build_object('ok', false, 'erro', 'Conta não liberada.'); end if;
  if jsonb_array_length(coalesce(p->'anuncios', '[]'::jsonb)) = 0 then return jsonb_build_object('ok', false, 'erro', 'Rodada sem anúncios.'); end if;

  insert into paiia_paizinho_rodadas (id, usuario_id, conta_ml, modo, em, relatorio_de, ativos_total, ineditos_antes, ineditos_depois, lista_completa, quantidade, mlbs)
  values (p->>'id', v_uid, v_conta, p->>'modo', v_em, p->>'relatorio_de', (p->>'ativos_total')::int, (p->>'ineditos_antes')::int, (p->>'ineditos_depois')::int,
          coalesce((p->>'lista_completa')::boolean, true), jsonb_array_length(p->'anuncios'),
          array(select x->>'mlb' from jsonb_array_elements(p->'anuncios') x))
  on conflict (id) do nothing;
  get diagnostics v_n = row_count;
  if v_n = 0 then return jsonb_build_object('ok', true, 'ja_registrada', true); end if;

  for a in select * from jsonb_array_elements(p->'anuncios') loop
    v_mlb := upper(a->>'mlb');
    select situacao into v_antes from paiia_paizinho_anuncios where usuario_id = v_uid and conta_ml = v_conta and mlb = v_mlb;
    v_existia := found;
    insert into paiia_paizinho_anuncios (usuario_id, conta_ml, mlb, sku, titulo, pontuacao, resultado, analises, primeira_analise_em, ultima_analise_em)
    values (v_uid, v_conta, v_mlb, a->>'sku', a->>'titulo', (a->>'pontuacao')::int, a->'resultado', 1, v_em, v_em)
    on conflict (usuario_id, conta_ml, mlb) do update set
      sku = excluded.sku, titulo = excluded.titulo, pontuacao = excluded.pontuacao, resultado = excluded.resultado,
      analises = paiia_paizinho_anuncios.analises + 1, ultima_analise_em = excluded.ultima_analise_em;

    v_areas := array(select x->>'area' from jsonb_array_elements(coalesce(a->'pendencias', '[]'::jsonb)) x);
    for pd in select * from jsonb_array_elements(coalesce(a->'pendencias', '[]'::jsonb)) loop
      insert into paiia_paizinho_pendencias (usuario_id, conta_ml, mlb, area, severidade, problema, sugestao, impacto_rs, status, detectada_em, ultima_vez_em, reaberta)
      values (v_uid, v_conta, v_mlb, pd->>'area', pd->>'severidade', pd->>'problema', pd->>'sugestao', (pd->>'impacto_rs')::numeric, 'aberta', v_em, v_em, false)
      on conflict (usuario_id, conta_ml, mlb, area) do update set
        severidade = excluded.severidade, problema = excluded.problema, sugestao = excluded.sugestao, impacto_rs = excluded.impacto_rs,
        ultima_vez_em = excluded.ultima_vez_em,
        reaberta = (paiia_paizinho_pendencias.status = 'resolvida'),
        status = case when paiia_paizinho_pendencias.status = 'removida' then 'removida' else 'aberta' end,
        resolvida_em = case when paiia_paizinho_pendencias.status = 'removida' then paiia_paizinho_pendencias.resolvida_em else null end,
        motivo = case when paiia_paizinho_pendencias.status = 'removida' then paiia_paizinho_pendencias.motivo else '' end;
    end loop;
    update paiia_paizinho_pendencias set status = 'resolvida', resolvida_em = v_em, motivo = 'não encontrada na reanálise', reaberta = false
      where usuario_id = v_uid and conta_ml = v_conta and mlb = v_mlb and status = 'aberta' and not (area = any(v_areas));

    v_depois := paizinho_situacao(v_uid, v_conta, v_mlb);
    update paiia_paizinho_anuncios set situacao = v_depois where usuario_id = v_uid and conta_ml = v_conta and mlb = v_mlb;
    insert into paiia_paizinho_eventos (id, usuario_id, conta_ml, mlb, tipo, rodada_id, em, situacao_antes, situacao_depois, dados)
    values ((p->>'id') || ':' || v_mlb, v_uid, v_conta, v_mlb, case when v_existia then 'reanalise' else 'analise' end, p->>'id', v_em,
            case when v_existia then v_antes else null end, v_depois,
            jsonb_build_object('sku', a->>'sku', 'titulo', a->>'titulo', 'pontuacao', a->'pontuacao', 'pendencias', jsonb_array_length(coalesce(a->'pendencias', '[]'::jsonb))));
  end loop;
  return jsonb_build_object('ok', true);
end $$;

-- Ação do usuário: resolvido / removido (motivo obrigatório) / devolvido. Mesmo id = ignorado.
create or replace function public.paizinho_registrar_acao(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_conta text := p->>'conta';
  v_mlb text := upper(p->>'mlb');
  v_em timestamptz := (p->>'em')::timestamptz;
  v_status text := case p->>'acao' when 'resolvido' then 'resolvida' when 'removido' then 'removida' when 'devolvido' then 'aberta' end;
  v_antes text;
  v_depois text;
  v_n int;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'erro', 'Usuário não autenticado.'); end if;
  if v_conta not in ('1729335019', '824312524', '2412238242') then return jsonb_build_object('ok', false, 'erro', 'Conta não liberada.'); end if;
  if v_status is null then return jsonb_build_object('ok', false, 'erro', 'Ação desconhecida.'); end if;
  if p->>'acao' = 'removido' and coalesce(trim(p->>'motivo'), '') = '' then return jsonb_build_object('ok', false, 'erro', 'Informe o motivo para remover da lista.'); end if;
  if exists (select 1 from paiia_paizinho_eventos where id = p->>'id') then return jsonb_build_object('ok', true, 'ja_registrada', true); end if;

  select situacao into v_antes from paiia_paizinho_anuncios where usuario_id = v_uid and conta_ml = v_conta and mlb = v_mlb;
  insert into paiia_paizinho_pendencias (usuario_id, conta_ml, mlb, area, severidade, problema, sugestao, status, detectada_em, ultima_vez_em, resolvida_em, motivo)
  values (v_uid, v_conta, v_mlb, p->>'area', p->>'severidade', p->>'problema', p->>'sugestao', v_status, v_em, v_em, case when v_status = 'aberta' then null else v_em end, coalesce(p->>'motivo', ''))
  on conflict (usuario_id, conta_ml, mlb, area) do update set
    status = excluded.status, resolvida_em = excluded.resolvida_em, motivo = excluded.motivo, reaberta = false;
  if v_antes is not null then
    v_depois := paizinho_situacao(v_uid, v_conta, v_mlb);
    update paiia_paizinho_anuncios set situacao = v_depois where usuario_id = v_uid and conta_ml = v_conta and mlb = v_mlb;
  end if;
  insert into paiia_paizinho_eventos (id, usuario_id, conta_ml, mlb, area, tipo, em, situacao_antes, situacao_depois, dados)
  values (p->>'id', v_uid, v_conta, v_mlb, p->>'area', p->>'acao', v_em, v_antes, v_depois, jsonb_build_object('motivo', coalesce(p->>'motivo', ''), 'titulo', p->>'titulo'))
  on conflict (id) do nothing;
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'ja_registrada', v_n = 0);
end $$;

revoke all on function public.paizinho_registrar_rodada(jsonb) from public, anon;
revoke all on function public.paizinho_registrar_acao(jsonb) from public, anon;
grant execute on function public.paizinho_registrar_rodada(jsonb) to authenticated;
grant execute on function public.paizinho_registrar_acao(jsonb) to authenticated;

-- DESFAZER (apaga SÓ o que esta migração criou):
-- drop function if exists public.paizinho_registrar_acao(jsonb);
-- drop function if exists public.paizinho_registrar_rodada(jsonb);
-- drop function if exists public.paizinho_situacao(uuid, text, text);
-- drop table if exists public.paiia_paizinho_eventos;
-- drop table if exists public.paiia_paizinho_pendencias;
-- drop table if exists public.paiia_paizinho_anuncios;
-- drop table if exists public.paiia_paizinho_rodadas;
