-- Fase 2: interpretação candidata (não altera tabelas da Fase 1 nem catalogo_pecas)

create table if not exists public.catalogo_bloco_interpretacao (
  id uuid primary key default gen_random_uuid(),
  bloco_bruto_id uuid not null unique
    references public.catalogo_bloco_bruto (id) on delete cascade,
  lote_id uuid not null
    references public.catalogo_importacao_lote (id) on delete cascade,
  pagina integer not null,
  ordem_bloco integer not null,
  classificacao_candidata text not null default 'indefinido'
    check (classificacao_candidata in (
      'produto',
      'aplicacao',
      'equivalencia',
      'tabela_referencia',
      'cabecalho',
      'indice',
      'continuacao',
      'outro',
      'indefinido'
    )),
  codigo_peca text,
  descricao text,
  oem text,
  fabricante_marca text,
  aplicacoes jsonb not null default '[]'::jsonb,
  equivalencias jsonb not null default '[]'::jsonb,
  evidencias jsonb not null default '{}'::jsonb,
  confianca numeric(5, 4),
  motivo_classificacao text,
  revisao_manual boolean not null default true,
  status_interpretacao text not null default 'revisao_manual'
    check (status_interpretacao in (
      'candidato',
      'indefinido',
      'revisao_manual',
      'rejeitado'
    )),
  amostra_codigo text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_interpretacao_lote
  on public.catalogo_bloco_interpretacao (lote_id);

create index if not exists idx_interpretacao_status
  on public.catalogo_bloco_interpretacao (status_interpretacao);

create index if not exists idx_interpretacao_bloco
  on public.catalogo_bloco_interpretacao (bloco_bruto_id);

alter table public.catalogo_bloco_interpretacao enable row level security;

drop policy if exists catalogo_interpretacao_auth_all on public.catalogo_bloco_interpretacao;
create policy catalogo_interpretacao_auth_all
  on public.catalogo_bloco_interpretacao
  for all
  to authenticated
  using (true)
  with check (true);

grant select, insert, update, delete on table public.catalogo_bloco_interpretacao to authenticated, service_role;
