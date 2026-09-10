-- Fase 1: lote → páginas → blocos brutos (sem classificação nem catalogo_pecas)

create table if not exists public.catalogo_importacao_lote (
  id uuid primary key default gen_random_uuid(),
  fabricante text not null,
  arquivo_nome text not null,
  arquivo_hash text not null unique,
  arquivo_storage_path text,
  edicao text,
  total_paginas integer not null default 0,
  status text not null default 'extraido'
    check (status in ('extraido', 'classificado', 'revisar', 'aprovado', 'rejeitado')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_lote_fabricante
  on public.catalogo_importacao_lote (fabricante);

create index if not exists idx_lote_status
  on public.catalogo_importacao_lote (status);

create table if not exists public.catalogo_pagina (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references public.catalogo_importacao_lote (id) on delete cascade,
  pagina integer not null,
  texto_pagina text not null default '',
  metodo_extracao text not null default 'pdfjs'
    check (metodo_extracao in ('pdfjs', 'ocr', 'misto')),
  confianca_extracao numeric(5, 4) not null default 1,
  status text not null default 'extraido'
    check (status in ('extraido', 'classificado', 'revisar', 'aprovado', 'rejeitado')),
  unique (lote_id, pagina)
);

create index if not exists idx_pagina_lote
  on public.catalogo_pagina (lote_id);

create table if not exists public.catalogo_bloco_bruto (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references public.catalogo_importacao_lote (id) on delete cascade,
  pagina_id uuid not null references public.catalogo_pagina (id) on delete cascade,
  pagina integer not null,
  pagina_fim integer,
  ordem_bloco integer not null,
  continuacao_de_bloco_id uuid references public.catalogo_bloco_bruto (id) on delete set null,
  cabecalho_secao text,
  linhas_originais jsonb not null default '[]'::jsonb,
  texto_original text not null default '',
  tipo_bloco text not null default 'bruto'
    check (tipo_bloco in (
      'bruto',
      'produto',
      'aplicacao',
      'equivalencia',
      'cabecalho',
      'tabela',
      'continuacao',
      'ruido'
    )),
  codigos_encontrados jsonb not null default '[]'::jsonb,
  contexto_pagina text,
  fonte text not null,
  status text not null default 'extraido'
    check (status in ('extraido', 'classificado', 'revisar', 'aprovado', 'rejeitado')),
  classificado_por text,
  confianca_extracao numeric(5, 4) not null default 1,
  confianca_classificacao numeric(5, 4),
  motivo_suspeita text,
  erro_processamento text,
  tentativas integer not null default 0,
  unique (lote_id, pagina, ordem_bloco)
);

create index if not exists idx_bloco_lote_status
  on public.catalogo_bloco_bruto (lote_id, status);

create index if not exists idx_bloco_continuacao
  on public.catalogo_bloco_bruto (continuacao_de_bloco_id);

create index if not exists idx_bloco_tipo
  on public.catalogo_bloco_bruto (lote_id, tipo_bloco);

alter table public.catalogo_importacao_lote enable row level security;
alter table public.catalogo_pagina enable row level security;
alter table public.catalogo_bloco_bruto enable row level security;

drop policy if exists catalogo_lote_auth_all on public.catalogo_importacao_lote;
create policy catalogo_lote_auth_all
  on public.catalogo_importacao_lote
  for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists catalogo_pagina_auth_all on public.catalogo_pagina;
create policy catalogo_pagina_auth_all
  on public.catalogo_pagina
  for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists catalogo_bloco_auth_all on public.catalogo_bloco_bruto;
create policy catalogo_bloco_auth_all
  on public.catalogo_bloco_bruto
  for all
  to authenticated
  using (true)
  with check (true);

grant select, insert, update, delete on table public.catalogo_importacao_lote to authenticated, service_role;
grant select, insert, update, delete on table public.catalogo_pagina to authenticated, service_role;
grant select, insert, update, delete on table public.catalogo_bloco_bruto to authenticated, service_role;
