-- =====================================================================
-- PAIIA PARCEIROS — PILOTO, ETAPA 2 (26/11/2026): PAPÉIS E PROTEÇÃO NO BANCO
-- SOMENTE STAGING. Aplicar depois de 20261126_parceiros_piloto.sql.
--
-- Três perfis:
--  * ADMINISTRADOR (tabela parceiros_admins): cadastra, aprova, define
--    mensalidade e vigência, ativa, suspende ou encerra; aprova itens/catálogos.
--  * PARCEIRO (tabela parceiro_usuarios): atualiza os PRÓPRIOS dados comerciais,
--    envia itens e arquivo de catálogo (sempre para aprovação técnica) e vê as
--    cotações simuladas recebidas.
--  * USUÁRIO COMUM (qualquer logado): vê só parceiros ativos na vigência e itens
--    aprovados, e registra cotação simulada.
-- Mensalidade, vigência e observações internas ficam em parceiro_contratos,
-- que o usuário comum não lê. Cobrança continua travada em false.
-- =====================================================================

-- ---------- Papéis ----------
create table if not exists public.parceiros_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now()
);
create table if not exists public.parceiro_usuarios (
  parceiro_id uuid not null references public.parceiros(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (parceiro_id, user_id)
);
alter table public.parceiros_admins enable row level security;
alter table public.parceiro_usuarios enable row level security;
revoke all on public.parceiros_admins, public.parceiro_usuarios from anon, authenticated;
grant select on public.parceiro_usuarios to authenticated;
drop policy if exists parceiro_usuarios_proprio on public.parceiro_usuarios;
create policy parceiro_usuarios_proprio on public.parceiro_usuarios for select to authenticated using (user_id = auth.uid());

-- ---------- Contrato (só administrador e o próprio parceiro leem) ----------
create table if not exists public.parceiro_contratos (
  parceiro_id uuid primary key references public.parceiros(id) on delete cascade,
  mensalidade_centavos integer not null default 19990 check (mensalidade_centavos >= 0),
  cobranca_ativa boolean not null default false check (cobranca_ativa = false),
  vigencia_inicio date,
  vigencia_fim date,
  observacoes_admin text,
  atualizado_em timestamptz not null default now()
);
alter table public.parceiro_contratos enable row level security;

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='parceiros' and column_name='mensalidade_centavos') then
    insert into public.parceiro_contratos (parceiro_id, mensalidade_centavos, vigencia_inicio, vigencia_fim, observacoes_admin)
    select id, mensalidade_centavos, vigencia_inicio, vigencia_fim, observacoes_admin from public.parceiros
    on conflict (parceiro_id) do nothing;
    drop policy if exists parceiros_escrita on public.parceiros;
    alter table public.parceiros drop column mensalidade_centavos, drop column cobranca_ativa,
      drop column vigencia_inicio, drop column vigencia_fim, drop column observacoes_admin;
  end if;
end $$;

-- Arquivo de catálogo enviado pelo parceiro (fica pendente até a aprovação técnica).
alter table public.parceiros add column if not exists catalogo_arquivo text;
alter table public.parceiros add column if not exists catalogo_situacao text not null default 'sem_envio';
alter table public.parceiros drop constraint if exists parceiros_catalogo_situacao_check;
alter table public.parceiros add constraint parceiros_catalogo_situacao_check
  check (catalogo_situacao in ('sem_envio','pendente','aprovado','recusado'));

alter table public.parceiro_catalogo_itens add column if not exists situacao_tecnica text not null default 'pendente';
alter table public.parceiro_catalogo_itens drop constraint if exists parceiro_itens_situacao_check;
alter table public.parceiro_catalogo_itens add constraint parceiro_itens_situacao_check
  check (situacao_tecnica in ('pendente','aprovado','recusado'));
alter table public.parceiro_catalogo_itens add column if not exists analise_motivo text;
alter table public.parceiro_catalogo_itens add column if not exists analisado_em timestamptz;
-- Itens fictícios do piloto já conferidos.
update public.parceiro_catalogo_itens set situacao_tecnica = 'aprovado', analisado_em = coalesce(analisado_em, now())
 where parceiro_id = '00000000-0000-4000-a000-000000000001' and situacao_tecnica = 'pendente' and analisado_em is null;

-- ---------- Funções de papel ----------
create or replace function public.parceiros_eh_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.parceiros_admins where user_id = auth.uid());
$$;

create or replace function public.parceiros_eh_membro(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.parceiro_usuarios where parceiro_id = p and user_id = auth.uid());
$$;

create or replace function public.parceiros_visivel(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.parceiros pa
    left join public.parceiro_contratos c on c.parceiro_id = pa.id
    where pa.id = p and pa.situacao = 'ativo'
      and (c.vigencia_inicio is null or c.vigencia_inicio <= current_date)
      and (c.vigencia_fim is null or c.vigencia_fim >= current_date)
  );
$$;

create or replace function public.parceiros_meu_papel() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'admin', public.parceiros_eh_admin(),
    'parceiros', coalesce((select jsonb_agg(parceiro_id) from public.parceiro_usuarios where user_id = auth.uid()), '[]'::jsonb)
  );
$$;

create or replace function public.parceiros_pasta(nome text) returns uuid
language plpgsql immutable as $$
begin
  return split_part(nome, '/', 1)::uuid;
exception when others then
  return null;
end $$;

-- Vincular/desvincular a conta de login do parceiro (só administrador).
create or replace function public.parceiros_vincular_usuario(p_parceiro uuid, p_email text) returns text
language plpgsql security definer set search_path = public, auth as $$
declare v_user uuid;
begin
  if not public.parceiros_eh_admin() then raise exception 'Somente o administrador pode vincular contas.'; end if;
  select id into v_user from auth.users where lower(email) = lower(trim(p_email));
  if v_user is null then raise exception 'Nenhuma conta do PAIIA com este e-mail.'; end if;
  insert into public.parceiro_usuarios (parceiro_id, user_id) values (p_parceiro, v_user) on conflict do nothing;
  return 'ok';
end $$;

create or replace function public.parceiros_desvincular_usuario(p_parceiro uuid, p_user uuid) returns text
language plpgsql security definer set search_path = public as $$
begin
  if not public.parceiros_eh_admin() then raise exception 'Somente o administrador pode desvincular contas.'; end if;
  delete from public.parceiro_usuarios where parceiro_id = p_parceiro and user_id = p_user;
  return 'ok';
end $$;

create or replace function public.parceiros_contas_do_parceiro(p_parceiro uuid)
returns table (user_id uuid, email text)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.parceiros_eh_admin() then raise exception 'Somente o administrador.'; end if;
  return query select u.id, u.email::text from public.parceiro_usuarios pu join auth.users u on u.id = pu.user_id
   where pu.parceiro_id = p_parceiro order by u.email;
end $$;

revoke all on function public.parceiros_vincular_usuario(uuid, text), public.parceiros_desvincular_usuario(uuid, uuid),
  public.parceiros_contas_do_parceiro(uuid) from anon, public;
grant execute on function public.parceiros_eh_admin(), public.parceiros_eh_membro(uuid), public.parceiros_visivel(uuid),
  public.parceiros_meu_papel(), public.parceiros_vincular_usuario(uuid, text), public.parceiros_desvincular_usuario(uuid, uuid),
  public.parceiros_contas_do_parceiro(uuid) to authenticated;

-- ---------- Proteção dos campos administrativos ----------
create or replace function public.parceiros_proteger() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.parceiros_eh_admin() then
    return new;
  end if;
  if new.situacao is distinct from old.situacao
     or new.criterios is distinct from old.criterios
     or new.aprovado_em is distinct from old.aprovado_em
     or new.aprovado_por is distinct from old.aprovado_por
     or new.ficticio is distinct from old.ficticio
     or (new.catalogo_situacao is distinct from old.catalogo_situacao and new.catalogo_situacao <> 'pendente') then
    raise exception 'Somente o administrador pode aprovar, ativar, suspender ou encerrar a parceria.';
  end if;
  -- Catálogo mudado pelo parceiro volta para a aprovação técnica.
  if new.catalogo_arquivo is distinct from old.catalogo_arquivo
     or new.catalogo_url is distinct from old.catalogo_url
     or new.catalogo_tipo is distinct from old.catalogo_tipo then
    new.catalogo_situacao := 'pendente';
  end if;
  return new;
end $$;
drop trigger if exists parceiros_proteger on public.parceiros;
create trigger parceiros_proteger before update on public.parceiros
  for each row execute function public.parceiros_proteger();

create or replace function public.parceiro_itens_proteger() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.codigo_normalizado := upper(regexp_replace(coalesce(new.codigo, ''), '[^A-Za-z0-9]', '', 'g'));
  if public.parceiros_eh_admin() then
    if tg_op = 'UPDATE' and new.situacao_tecnica is distinct from old.situacao_tecnica then
      new.analisado_em := now();
    end if;
    return new;
  end if;
  -- Item enviado ou mudado pelo parceiro: sempre para aprovação técnica.
  new.situacao_tecnica := 'pendente';
  new.analisado_em := null;
  new.analise_motivo := null;
  return new;
end $$;
drop trigger if exists parceiro_itens_proteger on public.parceiro_catalogo_itens;
create trigger parceiro_itens_proteger before insert or update on public.parceiro_catalogo_itens
  for each row execute function public.parceiro_itens_proteger();

-- ---------- Políticas ----------
grant select, insert, update, delete on public.parceiro_contratos to authenticated;
revoke all on public.parceiro_contratos from anon;

drop policy if exists parceiros_leitura on public.parceiros;
drop policy if exists parceiros_escrita on public.parceiros;
drop policy if exists parceiros_ver on public.parceiros;
drop policy if exists parceiros_criar on public.parceiros;
drop policy if exists parceiros_alterar on public.parceiros;
drop policy if exists parceiros_apagar on public.parceiros;
create policy parceiros_ver on public.parceiros for select to authenticated
  using (public.parceiros_visivel(id) or public.parceiros_eh_admin() or public.parceiros_eh_membro(id));
create policy parceiros_criar on public.parceiros for insert to authenticated
  with check (public.parceiros_eh_admin() and ficticio = true);
create policy parceiros_alterar on public.parceiros for update to authenticated
  using (public.parceiros_eh_admin() or public.parceiros_eh_membro(id))
  with check (ficticio = true);
create policy parceiros_apagar on public.parceiros for delete to authenticated
  using (public.parceiros_eh_admin());

drop policy if exists parceiro_contratos_ver on public.parceiro_contratos;
drop policy if exists parceiro_contratos_admin on public.parceiro_contratos;
create policy parceiro_contratos_ver on public.parceiro_contratos for select to authenticated
  using (public.parceiros_eh_admin() or public.parceiros_eh_membro(parceiro_id));
create policy parceiro_contratos_admin on public.parceiro_contratos for all to authenticated
  using (public.parceiros_eh_admin())
  with check (public.parceiros_eh_admin() and cobranca_ativa = false);

drop policy if exists parceiro_itens_leitura on public.parceiro_catalogo_itens;
drop policy if exists parceiro_itens_escrita on public.parceiro_catalogo_itens;
drop policy if exists parceiro_itens_ver on public.parceiro_catalogo_itens;
drop policy if exists parceiro_itens_gravar on public.parceiro_catalogo_itens;
create policy parceiro_itens_ver on public.parceiro_catalogo_itens for select to authenticated
  using ((situacao_tecnica = 'aprovado' and public.parceiros_visivel(parceiro_id))
         or public.parceiros_eh_admin() or public.parceiros_eh_membro(parceiro_id));
create policy parceiro_itens_gravar on public.parceiro_catalogo_itens for all to authenticated
  using (public.parceiros_eh_admin() or public.parceiros_eh_membro(parceiro_id))
  with check (public.parceiros_eh_admin() or public.parceiros_eh_membro(parceiro_id));

drop policy if exists parceiro_cotacoes_proprias on public.parceiro_cotacoes;
drop policy if exists parceiro_cotacoes_ver on public.parceiro_cotacoes;
drop policy if exists parceiro_cotacoes_criar on public.parceiro_cotacoes;
drop policy if exists parceiro_cotacoes_apagar on public.parceiro_cotacoes;
create policy parceiro_cotacoes_ver on public.parceiro_cotacoes for select to authenticated
  using (usuario_id = auth.uid() or public.parceiros_eh_admin() or public.parceiros_eh_membro(parceiro_id));
create policy parceiro_cotacoes_criar on public.parceiro_cotacoes for insert to authenticated
  with check (usuario_id = auth.uid() and situacao = 'simulada' and public.parceiros_visivel(parceiro_id));
create policy parceiro_cotacoes_apagar on public.parceiro_cotacoes for delete to authenticated
  using (public.parceiros_eh_admin());
revoke update on public.parceiro_cotacoes from authenticated;

-- ---------- Arquivos: logotipo (público, só leitura por endereço) e catálogo (privado) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('parceiros-logos', 'parceiros-logos', true, 1048576, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 1048576, allowed_mime_types = array['image/png','image/jpeg','image/webp'];
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('parceiros-catalogos', 'parceiros-catalogos', false, 20971520,
        array['application/pdf','text/csv','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do update set public = false, file_size_limit = 20971520;

drop policy if exists parceiros_logos_gravar on storage.objects;
drop policy if exists parceiros_logos_apagar on storage.objects;
drop policy if exists parceiros_catalogos_gravar on storage.objects;
drop policy if exists parceiros_catalogos_ler on storage.objects;
-- Sem política de leitura no logotipo: o arquivo abre pelo endereço público, mas a pasta não pode ser listada.
create policy parceiros_logos_gravar on storage.objects for insert to authenticated
  with check (bucket_id = 'parceiros-logos'
    and (public.parceiros_eh_admin() or public.parceiros_eh_membro(public.parceiros_pasta(name))));
create policy parceiros_logos_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'parceiros-logos'
    and (public.parceiros_eh_admin() or public.parceiros_eh_membro(public.parceiros_pasta(name))));
create policy parceiros_catalogos_gravar on storage.objects for insert to authenticated
  with check (bucket_id = 'parceiros-catalogos'
    and (public.parceiros_eh_admin() or public.parceiros_eh_membro(public.parceiros_pasta(name))));
create policy parceiros_catalogos_ler on storage.objects for select to authenticated
  using (bucket_id = 'parceiros-catalogos'
    and (public.parceiros_eh_admin() or public.parceiros_eh_membro(public.parceiros_pasta(name))));
