-- =============================================================
-- PAIIA — Central do Paizinho Inteligente (PILOTO LOJA ONLINE)
-- PENDENTE — NÃO APLICADO. Aplicar só com autorização do Edgar.
--
-- 1) paiia_paizinho_relatorios: um relatório da manhã por execução.
--    Leitura: só o dono (RLS). Gravação: só a função paizinho-auditoria
--    (service role). Nenhuma tela grava aqui.
-- 2) paiia_tabela_renault: preços da tabela Renault (opcional), para a
--    regra das peças Renault de lotes antigos sem custo.
-- =============================================================

create table if not exists public.paiia_paizinho_relatorios (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  conta_ml text not null,
  conta_nome text,
  origem text not null default 'agendamento_03h',
  status text not null default 'executando' check (status in ('executando', 'concluido', 'erro')),
  data_referencia date,
  iniciado_em timestamptz not null default now(),
  concluido_em timestamptz,
  relatorio jsonb,
  erro text,
  criado_em timestamptz not null default now()
);

create index if not exists paiia_paizinho_relatorios_dono_idx
  on public.paiia_paizinho_relatorios (usuario_id, conta_ml, iniciado_em desc);

alter table public.paiia_paizinho_relatorios enable row level security;

drop policy if exists "dono le os proprios relatorios" on public.paiia_paizinho_relatorios;
create policy "dono le os proprios relatorios"
  on public.paiia_paizinho_relatorios for select
  to authenticated
  using (usuario_id = auth.uid());
-- Sem políticas de insert/update/delete: só a service role (função) grava.

create table if not exists public.paiia_tabela_renault (
  codigo text primary key,
  descricao text,
  preco numeric(12,2) not null check (preco > 0),
  vigencia date,
  atualizado_em timestamptz not null default now()
);
alter table public.paiia_tabela_renault enable row level security;
-- Sem políticas: só a função (service role) lê; a importação é feita pelo painel.
