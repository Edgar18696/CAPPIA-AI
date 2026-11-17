-- =============================================================
-- PAIIA — Central de Promoções: SELEÇÃO de anúncios por campanha.
-- PROPOSTA (17/11/2026). NÃO APLICADA. Só aplicar com autorização
-- específica do Edgar. Não altera nenhuma tabela existente.
--
-- Uma linha por USUÁRIO + CAMPANHA + CONTA ML + MLB (sem duplicidade).
-- Guarda só a escolha: nada de token, nada de preço de venda aplicado.
-- Remover = preencher removido_em (fica o histórico); incluir de novo reativa.
-- Mesmo formato do registro local (src/services/promocoes/selecao.js).
-- =============================================================

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
  campanha_id   text not null,
  conta_ml      text not null check (conta_ml ~ '^[0-9]{3,20}$'),
  meta          integer check (meta is null or (meta between 1 and 5000)),
  atualizado_em timestamptz not null default now(),
  primary key (usuario_id, campanha_id, conta_ml)
);

-- Cada usuário só enxerga e altera a própria seleção.
alter table public.paiia_promocoes_selecao enable row level security;
alter table public.paiia_promocoes_metas   enable row level security;

create policy "selecao: dono le"       on public.paiia_promocoes_selecao for select using (auth.uid() = usuario_id);
create policy "selecao: dono inclui"   on public.paiia_promocoes_selecao for insert with check (auth.uid() = usuario_id);
create policy "selecao: dono altera"   on public.paiia_promocoes_selecao for update using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);
-- Sem política de DELETE: remover é marcar removido_em.

create policy "metas: dono le"         on public.paiia_promocoes_metas for select using (auth.uid() = usuario_id);
create policy "metas: dono grava"      on public.paiia_promocoes_metas for insert with check (auth.uid() = usuario_id);
create policy "metas: dono altera"     on public.paiia_promocoes_metas for update using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);
