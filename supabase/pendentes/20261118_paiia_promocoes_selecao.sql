-- =============================================================
-- PAIIA — Central de Promoções: SELEÇÃO, METAS e CAMPANHAS (rascunhos).
-- PROPOSTA revisada em 18/11/2026. NÃO APLICADA. Só aplicar com autorização
-- específica do Edgar. Projeto: arqzpqkkpwikyecdbopf (o MESMO do site e do local).
--
-- - Só CRIA objetos novos (prefixo paiia_promocoes_): não altera nenhuma tabela,
--   coluna, política ou função existente (contas_marketplace, anúncios, Bling...).
-- - Guarda só escolhas: nada de token, nada de preço aplicado no ML.
-- - Separação: cada linha tem usuario_id (= auth.uid()), campanha_id e conta_ml.
-- - A conta precisa ser do próprio usuário (função paiia_promocoes_conta_do_usuario,
--   que só responde sim/não e nunca devolve token).
-- - Remover da seleção = marcar removido_em (sem DELETE na seleção).
-- - A Black Friday 2026 continua fixa no código (10% Renault / 5% demais):
--   não é gravada em paiia_promocoes_campanhas.
-- Reversão: 20261118_paiia_promocoes_reverter.sql
-- =============================================================
begin;

-- A conta ML informada pertence ao usuário logado? (contas_marketplace não tem
-- política para o navegador; esta função lê só ml_user_id/usuario_id e devolve sim/não.)
create or replace function public.paiia_promocoes_conta_do_usuario(p_conta text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.contas_marketplace
    where usuario_id = auth.uid() and marketplace = 'mercado_livre' and ml_user_id = p_conta
  );
$$;
revoke all on function public.paiia_promocoes_conta_do_usuario(text) from public, anon;
grant execute on function public.paiia_promocoes_conta_do_usuario(text) to authenticated;

create table if not exists public.paiia_promocoes_selecao (
  id               uuid primary key default gen_random_uuid(),
  usuario_id       uuid not null references auth.users(id) on delete cascade,
  campanha_id      text not null check (campanha_id ~ '^[a-z0-9-]{3,60}$'),
  conta_ml         text not null check (conta_ml ~ '^[0-9]{3,20}$'),
  mlb              text not null check (mlb ~ '^MLB[0-9]+$'),
  sku              text,
  titulo           text,
  preco_referencia numeric(12,2),           -- preço do anúncio quando foi selecionado (ou conferido)
  preco_atual      numeric(12,2),           -- último preço lido
  desconto_pct     numeric(4,1) check (desconto_pct is null or (desconto_pct between 5 and 79)), -- desconto individual (campanhas percentuais)
  revisao          boolean not null default false, -- preço mudou: aprovação suspensa até conferir
  revisao_motivo   text,
  origem           text not null default 'central' check (origem in ('central', 'ranqueamento')),
  incluido_em      timestamptz not null default now(),
  removido_em      timestamptz,
  revisado_em      timestamptz,
  atualizado_em    timestamptz not null default now(),
  unique (usuario_id, campanha_id, conta_ml, mlb)
);
create index if not exists paiia_promocoes_selecao_ativos
  on public.paiia_promocoes_selecao (usuario_id, campanha_id, conta_ml)
  where removido_em is null;

-- Meta (50, 100, 200 ou outra) por usuário, campanha e conta.
create table if not exists public.paiia_promocoes_metas (
  usuario_id    uuid not null references auth.users(id) on delete cascade,
  campanha_id   text not null check (campanha_id ~ '^[a-z0-9-]{3,60}$'),
  conta_ml      text not null check (conta_ml ~ '^[0-9]{3,20}$'),
  meta          integer check (meta is null or (meta between 1 and 5000)),
  atualizado_em timestamptz not null default now(),
  primary key (usuario_id, campanha_id, conta_ml)
);

-- Campanhas futuras (rascunhos com desconto percentual).
create table if not exists public.paiia_promocoes_campanhas (
  id                    text primary key check (id ~ '^[a-z0-9-]{3,60}$' and id <> 'black-friday-2026'),
  usuario_id            uuid not null references auth.users(id) on delete cascade,
  nome                  text not null check (length(nome) between 3 and 80),
  inicio                timestamptz not null,
  fim                   timestamptz not null,
  contas                text[] not null check (cardinality(contas) between 1 and 10),
  regra                 text not null default 'percentual' check (regra = 'percentual'),
  desconto_pct          numeric(4,1) not null check (desconto_pct between 5 and 79),
  descontos_por_produto boolean not null default true,
  situacao              text not null default 'rascunho' check (situacao in ('rascunho', 'aprovada', 'encerrada')),
  criado_em             timestamptz not null default now(),
  atualizado_em         timestamptz not null default now(),
  check (fim > inicio and fim - inicio <= interval '14 days'),
  unique (usuario_id, nome)
);

-- Segurança: só usuário logado, só as próprias linhas, só contas dele.
alter table public.paiia_promocoes_selecao   enable row level security;
alter table public.paiia_promocoes_metas     enable row level security;
alter table public.paiia_promocoes_campanhas enable row level security;
revoke all on public.paiia_promocoes_selecao, public.paiia_promocoes_metas, public.paiia_promocoes_campanhas from anon;

create policy paiia_promocoes_selecao_select on public.paiia_promocoes_selecao for select to authenticated
  using (auth.uid() = usuario_id);
create policy paiia_promocoes_selecao_insert on public.paiia_promocoes_selecao for insert to authenticated
  with check (auth.uid() = usuario_id and public.paiia_promocoes_conta_do_usuario(conta_ml));
create policy paiia_promocoes_selecao_update on public.paiia_promocoes_selecao for update to authenticated
  using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id and public.paiia_promocoes_conta_do_usuario(conta_ml));
-- Sem política de DELETE na seleção: remover é marcar removido_em.

create policy paiia_promocoes_metas_select on public.paiia_promocoes_metas for select to authenticated
  using (auth.uid() = usuario_id);
create policy paiia_promocoes_metas_insert on public.paiia_promocoes_metas for insert to authenticated
  with check (auth.uid() = usuario_id and public.paiia_promocoes_conta_do_usuario(conta_ml));
create policy paiia_promocoes_metas_update on public.paiia_promocoes_metas for update to authenticated
  using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id and public.paiia_promocoes_conta_do_usuario(conta_ml));

create policy paiia_promocoes_campanhas_select on public.paiia_promocoes_campanhas for select to authenticated
  using (auth.uid() = usuario_id);
create policy paiia_promocoes_campanhas_insert on public.paiia_promocoes_campanhas for insert to authenticated
  with check (auth.uid() = usuario_id);
create policy paiia_promocoes_campanhas_update on public.paiia_promocoes_campanhas for update to authenticated
  using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);
create policy paiia_promocoes_campanhas_delete on public.paiia_promocoes_campanhas for delete to authenticated
  using (auth.uid() = usuario_id and situacao = 'rascunho');

commit;

-- Conferência depois de aplicar (somente leitura):
--   select table_name from information_schema.tables where table_name like 'paiia_promocoes_%';
--   select tablename, policyname, cmd from pg_policies where tablename like 'paiia_promocoes_%' order by 1, 2;
--   select relname, relrowsecurity from pg_class where relname like 'paiia_promocoes_%';
