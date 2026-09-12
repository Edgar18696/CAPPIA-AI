create table if not exists public.mascotes_marca (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  nome text,
  empresa text,
  imagem_base text not null,
  descricao_original text,
  prompt_base text,
  cores text,
  roupa_acessorios text,
  logo_associado text,
  estilo_visual text,
  caracteristicas text,
  ativo boolean not null default true,
  oficial boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mascotes_marca_user_id_idx
  on public.mascotes_marca (user_id);

create unique index if not exists mascotes_marca_oficial_unico
  on public.mascotes_marca (user_id)
  where oficial = true;

alter table public.mascotes_marca enable row level security;

drop policy if exists mascotes_marca_select_own on public.mascotes_marca;
create policy mascotes_marca_select_own
  on public.mascotes_marca
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists mascotes_marca_insert_own on public.mascotes_marca;
create policy mascotes_marca_insert_own
  on public.mascotes_marca
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists mascotes_marca_update_own on public.mascotes_marca;
create policy mascotes_marca_update_own
  on public.mascotes_marca
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
