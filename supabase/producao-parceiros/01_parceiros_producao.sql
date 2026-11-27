-- =====================================================================
-- PAIIA PARCEIROS — PUBLICAÇÃO NA PRODUÇÃO (arqzpqkkpwikyecdbopf)
-- Gerado em 27/11/2026 a partir dos 4 roteiros testados no STAGING
-- (20261126, 20261126b, 20261127, 20261127b), com estas diferenças:
--   * NENHUM dado fictício (sem a Distribuidora Piloto e sem itens de teste);
--   * o banco RECUSA cadastro marcado como fictício (ficticio = false obrigatório);
--   * administrador da parceria: SOMENTE a conta exclusiva comercial@casadainjecaosp.com.br (b329da23…),
--     separada das contas de uso diário (sem anúncios, sem Mercado Livre, sem Bling);
--   * cobrança automática continua travada (cobranca_ativa = false): o PAIIA não cobra.
-- NÃO APLICAR sem a autorização expressa do Edgar.
-- Rodar em UMA transação (o comando do procedimento já faz isso). Reversão: 99_reversao_parceiros.sql
-- =====================================================================

-- ---------- Trava: só roda em banco sem PAIIA Parceiros ----------
do $guard$
begin
  if to_regclass('public.parceiros') is not null or to_regclass('public.parceiros_admins') is not null then
    raise exception 'PAIIA Parceiros já existe neste banco: publicação interrompida, nada foi alterado.';
  end if;
  if not exists (select 1 from auth.users where id = 'b329da23-9444-44ab-8b2f-53ed612c5d2d'
                   and lower(email) = 'comercial@casadainjecaosp.com.br' and email_confirmed_at is not null) then
    raise exception 'Conta administrativa exclusiva não encontrada ou sem e-mail confirmado: nada foi alterado.';
  end if;
  if exists (select 1 from public.paiia_anuncios where usuario_id = 'b329da23-9444-44ab-8b2f-53ed612c5d2d')
     or exists (select 1 from public.contas_marketplace where usuario_id = 'b329da23-9444-44ab-8b2f-53ed612c5d2d')
     or exists (select 1 from public.bling_produtos_vinculo where usuario_id = 'b329da23-9444-44ab-8b2f-53ed612c5d2d') then
    raise exception 'A conta administrativa tem anúncios ou integrações: ela deve ser exclusiva. Nada foi alterado.';
  end if;
end $guard$;



-- #####################################################################
-- ORIGEM: 20261126_parceiros_piloto.sql (sem a seção de dados fictícios)
-- #####################################################################
-- =====================================================================
-- PAIIA PARCEIROS — PILOTO (26/11/2026)
-- SOMENTE STAGING (rzqjxjzwrnubzyrwmflt). NÃO aplicar na produção sem
-- autorização expressa do Edgar. Fica fora de supabase/migrations de propósito.
--
-- Regras do piloto:
--  * dados fictícios (coluna ficticio, sempre true no piloto);
--  * nenhuma cobrança real (cobranca_ativa travada em false);
--  * nenhuma cotação real (situacao da cotação travada em 'simulada');
--  * o catálogo do parceiro fica em tabela própria: NUNCA entra em
--    catalogo_pecas / catalogo_chaves (independência dos resultados técnicos).
-- Reversão: drop table parceiro_cotacoes, parceiro_catalogo_itens, parceiro_contratos, parceiro_usuarios, parceiros_admins, parceiros;
-- ATENÇÃO: depois da etapa 2 (20261126b) NÃO rodar este arquivo de novo (ele recria a política antiga).
-- =====================================================================

create table if not exists public.parceiros (
  id uuid primary key default gen_random_uuid(),
  nome_fantasia text not null,
  razao_social text,
  documento text,                                   -- CNPJ (fictício no piloto)
  tipo_empresa text not null default 'distribuidor'
    check (tipo_empresa in ('fabricante','importador','distribuidor','prestador_servicos','locadora_equipamentos')),
  segmentos text[] not null default '{}',           -- qualquer segmento automotivo, sem preferência
  marcas text[] not null default '{}',
  apresentacao text,
  logotipo_url text,
  site text,
  whatsapp text,
  email_comercial text,
  contatos jsonb not null default '[]'::jsonb,      -- [{nome, funcao, telefone, email}]
  catalogo_tipo text not null default 'itens_paiia'
    check (catalogo_tipo in ('itens_paiia','pdf','site')),
  catalogo_url text,
  catalogo_autorizado boolean not null default false, -- a empresa dona autorizou a integração
  modalidades text[] not null default '{consulta_catalogo,cotacao}',
  -- controle administrativo
  situacao text not null default 'em_analise'
    check (situacao in ('em_analise','aprovado','ativo','suspenso','encerrado','recusado')),
  criterios jsonb not null default '{}'::jsonb,     -- {reputacao:true, qualidade:true, ...}
  aprovado_em timestamptz,
  aprovado_por text,
  mensalidade_centavos integer not null default 19990 check (mensalidade_centavos >= 0),
  cobranca_ativa boolean not null default false check (cobranca_ativa = false),
  vigencia_inicio date,
  vigencia_fim date,
  observacoes_admin text,
  ficticio boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.parceiro_catalogo_itens (
  id uuid primary key default gen_random_uuid(),
  parceiro_id uuid not null references public.parceiros(id) on delete cascade,
  codigo text not null,
  codigo_normalizado text not null,
  codigos_relacionados text[] not null default '{}', -- normalizados (OEM, concorrentes) informados pelo parceiro
  descricao text,
  marca text,
  segmento text,
  aplicacao text,
  disponivel boolean not null default true,
  criado_em timestamptz not null default now()
);
delete from public.parceiro_catalogo_itens a using public.parceiro_catalogo_itens b
  where a.parceiro_id = b.parceiro_id and a.codigo_normalizado = b.codigo_normalizado and a.criado_em > b.criado_em;
create unique index if not exists parceiro_itens_unico_idx on public.parceiro_catalogo_itens (parceiro_id, codigo_normalizado);
create index if not exists parceiro_itens_codigo_idx on public.parceiro_catalogo_itens (codigo_normalizado);
create index if not exists parceiro_itens_relacionados_idx on public.parceiro_catalogo_itens using gin (codigos_relacionados);

create table if not exists public.parceiro_cotacoes (
  id uuid primary key default gen_random_uuid(),
  parceiro_id uuid not null references public.parceiros(id) on delete cascade,
  usuario_id uuid default auth.uid(),
  codigo text not null,
  quantidade integer not null check (quantidade > 0),
  mensagem text,
  situacao text not null default 'simulada' check (situacao = 'simulada'),
  criado_em timestamptz not null default now()
);

alter table public.parceiros enable row level security;
alter table public.parceiro_catalogo_itens enable row level security;
alter table public.parceiro_cotacoes enable row level security;

grant select, insert, update, delete on public.parceiros, public.parceiro_catalogo_itens, public.parceiro_cotacoes to authenticated;
revoke all on public.parceiros, public.parceiro_catalogo_itens, public.parceiro_cotacoes from anon;

-- Piloto: só usuário logado. Leitura do catálogo/perfil por qualquer logado;
-- escrita administrativa por logado (no STAGING só existe o usuário de teste).
drop policy if exists parceiros_leitura on public.parceiros;
create policy parceiros_leitura on public.parceiros for select to authenticated using (true);
drop policy if exists parceiros_escrita on public.parceiros;
create policy parceiros_escrita on public.parceiros for all to authenticated using (true) with check (ficticio = false and cobranca_ativa = false);

drop policy if exists parceiro_itens_leitura on public.parceiro_catalogo_itens;
create policy parceiro_itens_leitura on public.parceiro_catalogo_itens for select to authenticated using (true);
drop policy if exists parceiro_itens_escrita on public.parceiro_catalogo_itens;
create policy parceiro_itens_escrita on public.parceiro_catalogo_itens for all to authenticated using (true) with check (true);

drop policy if exists parceiro_cotacoes_proprias on public.parceiro_cotacoes;
create policy parceiro_cotacoes_proprias on public.parceiro_cotacoes for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid() and situacao = 'simulada');

-- (produção) SEM dados fictícios: a empresa e os itens de teste do piloto NÃO entram.


-- #####################################################################
-- ORIGEM: 20261126b_parceiros_papeis.sql
-- #####################################################################
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
  with check (public.parceiros_eh_admin() and ficticio = false);
create policy parceiros_alterar on public.parceiros for update to authenticated
  using (public.parceiros_eh_admin() or public.parceiros_eh_membro(id))
  with check (ficticio = false);
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


-- #####################################################################
-- ORIGEM: 20261127_parceiros_contrato_extracao.sql
-- #####################################################################
-- =====================================================================
-- PAIIA PARCEIROS — PILOTO, ETAPA 3 (27/11/2026) — SOMENTE STAGING
-- Aplicar depois de 20261126b_parceiros_papeis.sql.
--  * parceiro_controle: critérios, aprovação e observações internas —
--    SÓ o administrador lê e grava (antes ficavam visíveis a qualquer logado).
--  * contrato: mensalidade livre, experiência gratuita, período, renovação,
--    vencimento e motivo de suspensão (admin grava; admin e o próprio parceiro leem).
--  * ativação exige os 6 critérios e a autorização do catálogo (garantido no banco).
--  * rotina de vencimentos (só admin): renova quem tem renovação automática e
--    suspende quem venceu. Nenhuma cobrança (cobranca_ativa continua travada).
--  * itens: equivalências e origem (manual, lista, extração automática).
--  * catálogo: arquivos de até 200 MB, só tipos permitidos, pasta privada.
-- =====================================================================

-- ---------- Controle administrativo (só administrador) ----------
create table if not exists public.parceiro_controle (
  parceiro_id uuid primary key references public.parceiros(id) on delete cascade,
  criterios jsonb not null default '{}'::jsonb,
  aprovado_em timestamptz,
  aprovado_por text,
  observacoes_admin text,
  atualizado_em timestamptz not null default now()
);
alter table public.parceiro_controle enable row level security;
revoke all on public.parceiro_controle from anon;
grant select, insert, update, delete on public.parceiro_controle to authenticated;
drop policy if exists parceiro_controle_admin on public.parceiro_controle;
create policy parceiro_controle_admin on public.parceiro_controle for all to authenticated
  using (public.parceiros_eh_admin()) with check (public.parceiros_eh_admin());

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='parceiros' and column_name='criterios') then
    insert into public.parceiro_controle (parceiro_id, criterios, aprovado_em, aprovado_por, observacoes_admin)
    select p.id, p.criterios, p.aprovado_em, p.aprovado_por, c.observacoes_admin
      from public.parceiros p left join public.parceiro_contratos c on c.parceiro_id = p.id
    on conflict (parceiro_id) do nothing;
  end if;
end $$;

-- ---------- Contrato ----------
alter table public.parceiro_contratos add column if not exists experiencia_dias integer not null default 0;
alter table public.parceiro_contratos add column if not exists periodo_meses integer not null default 12;
alter table public.parceiro_contratos add column if not exists renovacao_automatica boolean not null default false;
alter table public.parceiro_contratos add column if not exists suspensao_motivo text;
alter table public.parceiro_contratos drop constraint if exists parceiro_contratos_experiencia_check;
alter table public.parceiro_contratos add constraint parceiro_contratos_experiencia_check check (experiencia_dias between 0 and 365);
alter table public.parceiro_contratos drop constraint if exists parceiro_contratos_periodo_check;
alter table public.parceiro_contratos add constraint parceiro_contratos_periodo_check check (periodo_meses between 1 and 60);

-- ---------- Proteção da tabela parceiros (refeita sem os campos que mudaram de lugar) ----------
create or replace function public.parceiros_proteger() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_crit jsonb;
begin
  if public.parceiros_eh_admin() then
    if new.situacao in ('aprovado','ativo') and new.situacao is distinct from old.situacao then
      select criterios into v_crit from public.parceiro_controle where parceiro_id = new.id;
      if coalesce((select bool_and(coalesce((v_crit ->> k)::boolean, false))
                     from unnest(array['reputacao','qualidade','catalogo_confiavel','capacidade_fornecimento','atendimento','atualizacao_tecnica']) k), false) = false
         or not new.catalogo_autorizado then
        raise exception 'Para aprovar ou ativar: marque os 6 critérios e a autorização do catálogo.';
      end if;
    end if;
    return new;
  end if;
  if new.situacao is distinct from old.situacao
     or new.ficticio is distinct from old.ficticio
     or (new.catalogo_situacao is distinct from old.catalogo_situacao and new.catalogo_situacao <> 'pendente') then
    raise exception 'Somente o administrador pode aprovar, ativar, suspender ou encerrar a parceria.';
  end if;
  if new.catalogo_arquivo is distinct from old.catalogo_arquivo
     or new.catalogo_url is distinct from old.catalogo_url
     or new.catalogo_tipo is distinct from old.catalogo_tipo then
    new.catalogo_situacao := 'pendente';
  end if;
  return new;
end $$;

alter table public.parceiros drop column if exists criterios;
alter table public.parceiros drop column if exists aprovado_em;
alter table public.parceiros drop column if exists aprovado_por;
alter table public.parceiro_contratos drop column if exists observacoes_admin;

-- ---------- Rotina de vencimentos (só administrador; sem cobrança) ----------
create or replace function public.parceiros_verificar_vencimentos() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_renovados int := 0; v_suspensos int := 0;
begin
  if not public.parceiros_eh_admin() then raise exception 'Somente o administrador.'; end if;

  with r as (
    update public.parceiro_contratos c
       set vigencia_inicio = c.vigencia_fim + 1,
           vigencia_fim = (c.vigencia_fim + make_interval(months => c.periodo_meses))::date,
           suspensao_motivo = null,
           atualizado_em = now()
     where c.renovacao_automatica and c.vigencia_fim is not null and c.vigencia_fim < current_date
       and exists (select 1 from public.parceiros p where p.id = c.parceiro_id and p.situacao = 'ativo')
    returning 1)
  select count(*) into v_renovados from r;

  with s as (
    update public.parceiros p
       set situacao = 'suspenso', atualizado_em = now()
      from public.parceiro_contratos c
     where c.parceiro_id = p.id and p.situacao = 'ativo'
       and not c.renovacao_automatica and c.vigencia_fim is not null and c.vigencia_fim < current_date
    returning p.id)
  update public.parceiro_contratos c
     set suspensao_motivo = 'Vencida em ' || to_char(c.vigencia_fim, 'DD/MM/YYYY') || ' (suspensa automaticamente)'
    from s where s.id = c.parceiro_id;
  get diagnostics v_suspensos = row_count;

  return jsonb_build_object('renovados', v_renovados, 'suspensos', v_suspensos);
end $$;
revoke all on function public.parceiros_verificar_vencimentos() from anon, public;
grant execute on function public.parceiros_verificar_vencimentos() to authenticated;

-- ---------- Itens: equivalências e origem ----------
alter table public.parceiro_catalogo_itens add column if not exists equivalencias text[] not null default '{}';
alter table public.parceiro_catalogo_itens add column if not exists origem text not null default 'manual';
alter table public.parceiro_catalogo_itens drop constraint if exists parceiro_itens_origem_check;
alter table public.parceiro_catalogo_itens add constraint parceiro_itens_origem_check
  check (origem in ('manual','lista','extracao_planilha','extracao_pdf'));

create or replace function public.parceiro_itens_proteger() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.codigo_normalizado := upper(regexp_replace(coalesce(new.codigo, ''), '[^A-Za-z0-9]', '', 'g'));
  -- Equivalências informadas pelo parceiro viram chaves de busca (só valem depois de aprovadas).
  new.codigos_relacionados := coalesce((
    select array_agg(distinct n) from (
      select upper(regexp_replace(e, '[^A-Za-z0-9]', '', 'g')) n from unnest(coalesce(new.equivalencias, '{}')) e
    ) x where length(n) >= 3 and n <> new.codigo_normalizado), '{}');
  if public.parceiros_eh_admin() then
    if tg_op = 'UPDATE' and new.situacao_tecnica is distinct from old.situacao_tecnica then
      new.analisado_em := now();
    end if;
    return new;
  end if;
  new.situacao_tecnica := 'pendente';
  new.analisado_em := null;
  new.analise_motivo := null;
  return new;
end $$;

-- Aprovação em bloco dos itens pendentes de um parceiro (só administrador).
create or replace function public.parceiros_aprovar_pendentes(p_parceiro uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.parceiros_eh_admin() then raise exception 'Somente o administrador.'; end if;
  update public.parceiro_catalogo_itens set situacao_tecnica = 'aprovado', analisado_em = now()
   where parceiro_id = p_parceiro and situacao_tecnica = 'pendente';
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.parceiros_aprovar_pendentes(uuid) from anon, public;
grant execute on function public.parceiros_aprovar_pendentes(uuid) to authenticated;

-- ---------- Catálogos maiores, com limites seguros ----------
update storage.buckets
   set file_size_limit = 209715200, -- 200 MB por arquivo
       public = false,
       allowed_mime_types = array['application/pdf','text/csv','text/plain','application/vnd.ms-excel',
         'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
 where id = 'parceiros-catalogos';


-- #####################################################################
-- ORIGEM: 20261127b_parceiros_validacao_busca.sql
-- #####################################################################
-- (27/11/2026) PAIIA Parceiros — etapa 4, SÓ STAGING.
-- Modelo simplificado: o PAIIA aproxima comprador e fornecedor (contato direto);
-- não há pedidos, pagamentos nem cotação interna. Este arquivo:
--  1) telefone comercial da empresa (contato direto);
--  2) pesquisa nos catálogos aprovados por descrição e aplicação (sem acento, todas as palavras);
--  3) VALIDAÇÃO TÉCNICA automática dos itens enviados: sem divergências / necessita conferência / conflito;
--  4) aprovação em lote só dos itens sem divergência; item suspeito só é aprovado um a um,
--     com o registro da conferência técnica.
-- A base técnica oficial (catalogo_chaves, catalogo_pecas) é SÓ LIDA para comparar: nada é gravado nela
-- e nada dos parceiros substitui os dados oficiais.

alter table public.parceiros add column if not exists telefone text;

-- ---------- Texto sem acento, minúsculo, só letras/números, com espaços nas pontas ----------
create or replace function public.parceiros_texto_busca(t text) returns text
language sql immutable as $$
  select ' ' || trim(regexp_replace(lower(translate(coalesce(t, ''),
    'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
    'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')), '[^a-z0-9]+', ' ', 'g')) || ' '
$$;

-- ---------- Famílias de peça (para comparar o TIPO de peça, sem inventar nada) ----------
create table if not exists public.parceiro_familias_peca (
  padrao text primary key,
  familia text not null,
  prioridade integer not null default 50
);
alter table public.parceiro_familias_peca enable row level security;
drop policy if exists parceiro_familias_ler on public.parceiro_familias_peca;
create policy parceiro_familias_ler on public.parceiro_familias_peca for select to authenticated using (true);
grant select on public.parceiro_familias_peca to authenticated;

-- "a.b" é um tipo dentro de "a": bomba.agua e bomba.combustivel são diferentes entre si,
-- mas ambos combinam com "bomba" (genérico).
insert into public.parceiro_familias_peca (padrao, familia, prioridade) values
  ('sonda lambda', 'sonda_lambda', 95), ('sensor lambda', 'sonda_lambda', 95), ('sensor de oxigenio', 'sonda_lambda', 95), ('lambda', 'sonda_lambda', 80),
  ('sensor de nivel', 'sensor.nivel', 90), ('boia', 'sensor.nivel', 70),
  ('sensor de rotacao', 'sensor.rotacao', 90), ('sensor de temperatura', 'sensor.temperatura', 90),
  ('sensor de pressao', 'sensor.pressao', 90), ('sensor map', 'sensor.pressao', 90), ('sensor de detonacao', 'sensor.detonacao', 90),
  ('sensor de posicao', 'sensor.posicao', 90), ('sensor', 'sensor', 10),
  ('bomba d agua', 'bomba.agua', 90), ('bomba de agua', 'bomba.agua', 90), ('bomba dagua', 'bomba.agua', 90),
  ('bomba de combustivel', 'bomba.combustivel', 90), ('bomba combustivel', 'bomba.combustivel', 90), ('bomba eletrica', 'bomba.combustivel', 85),
  ('bomba de oleo', 'bomba.oleo', 90), ('bomba injetora', 'bomba.injetora', 90), ('bomba de alta', 'bomba.injetora', 90),
  ('bomba de direcao', 'bomba.direcao', 90), ('bomba', 'bomba', 10),
  ('bico injetor', 'bico_injetor', 90), ('injetor', 'bico_injetor', 80), ('bico', 'bico_injetor', 60),
  ('bobina', 'bobina', 80), ('vela de ignicao', 'vela', 90), ('vela aquecedora', 'vela_aquecedora', 95), ('vela', 'vela', 60),
  ('valvula termostatica', 'valvula.termostatica', 90), ('termostat', 'valvula.termostatica', 85), ('valvula', 'valvula', 10),
  ('radiador de ar quente', 'radiador_aquecimento', 95), ('radiador', 'radiador', 80),
  ('condensador', 'condensador', 80), ('compressor', 'compressor', 80), ('evaporador', 'evaporador', 80),
  ('eletroventilador', 'ventilacao', 80), ('ventoinha', 'ventilacao', 80), ('motor ventilador', 'ventilacao', 85),
  ('motor de partida', 'motor_partida', 90), ('alternador', 'alternador', 80), ('regulador de voltagem', 'regulador_voltagem', 90),
  ('amortecedor', 'amortecedor', 80), ('pastilha', 'freio.pastilha', 80), ('disco de freio', 'freio.disco', 85), ('lona de freio', 'freio.lona', 85),
  ('filtro secador', 'filtro.secador', 90), ('filtro de oleo', 'filtro.oleo', 90), ('filtro de ar', 'filtro.ar', 90),
  ('filtro de combustivel', 'filtro.combustivel', 90), ('filtro de cabine', 'filtro.cabine', 90), ('filtro', 'filtro', 10),
  ('corpo de borboleta', 'corpo_borboleta', 90), ('regulador de pressao', 'regulador_pressao', 90),
  ('pressostato', 'pressostato', 80), ('porta escova', 'porta_escova', 85), ('correia', 'correia', 70), ('embreagem', 'embreagem', 70)
on conflict (padrao) do update set familia = excluded.familia, prioridade = excluded.prioridade;

create or replace function public.parceiros_familia(t text) returns text
language sql stable security definer set search_path = public as $$
  select f.familia from public.parceiro_familias_peca f
   where public.parceiros_texto_busca(t) like '% ' || f.padrao || '%'
   order by f.prioridade desc, length(f.padrao) desc
   limit 1
$$;

create or replace function public.parceiros_familias_compativeis(a text, b text) returns boolean
language sql immutable as $$
  select a is null or b is null or a = b or a like b || '.%' or b like a || '.%'
$$;

-- Primeira palavra (montadora/modelo), com apelidos comuns de montadora.
create or replace function public.parceiros_primeira_palavra(t text) returns text
language sql immutable as $$
  select case w when 'vw' then 'volkswagen' when 'gm' then 'chevrolet' when 'mb' then 'mercedes' else w end
    from (select split_part(trim(public.parceiros_texto_busca(t)), ' ', 1) w) x
$$;

-- Vocabulário de montadoras e modelos (primeira palavra) tirado da base técnica oficial.
-- Cópia só de leitura, para a validação ficar rápida; atualizar quando a base oficial mudar.
create table if not exists public.parceiro_vocab_aplicacao (
  tipo text not null check (tipo in ('montadora', 'modelo')),
  palavra text not null,
  primary key (tipo, palavra)
);
alter table public.parceiro_vocab_aplicacao enable row level security; -- sem políticas: só as funções leem

-- ATUALIZAÇÃO AUTOMÁTICA (27/11): a lista guarda uma "assinatura" da base oficial — o contador
-- de inclusões/alterações/exclusões que o próprio banco mantém para catalogo_pecas (leitura
-- instantânea, mesmo com 1,37 milhão de linhas). A cada 15 minutos o agendador do banco
-- (pg_cron) confere a assinatura e, se a base oficial mudou (importação, correção,
-- desativação), recalcula a lista. O recálculo leva ~6-12 s na produção, por isso NÃO roda
-- dentro da tela (o limite das consultas dos usuários é 8 s).
-- Nada é gravado na base oficial; nenhum gatilho é colocado nas tabelas oficiais.
create table if not exists public.parceiro_vocab_estado (
  id integer primary key default 1 check (id = 1),
  assinatura text not null default '',
  palavras integer not null default 0,
  atualizado_em timestamptz
);
alter table public.parceiro_vocab_estado enable row level security; -- sem políticas: só as funções leem
insert into public.parceiro_vocab_estado (id) values (1) on conflict (id) do nothing;

create or replace function public.parceiros_vocabulario_assinatura() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select s.n_tup_ins::text || ':' || s.n_tup_upd::text || ':' || s.n_tup_del::text
                      from pg_stat_user_tables s where s.relid = 'public.catalogo_pecas'::regclass), 'sem-estatistica')
$$;
revoke all on function public.parceiros_vocabulario_assinatura() from anon, public;

-- Recalcula a lista (uso interno: sem permissão direta para os usuários).
create or replace function public.parceiros_recalcular_vocabulario() returns integer
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  perform pg_advisory_xact_lock(hashtext('parceiro_vocab_aplicacao'));
  delete from public.parceiro_vocab_aplicacao;
  -- (27/11) uma só leitura da base: primeiro os pares distintos, depois a função (mesmo resultado, bem mais rápido)
  insert into public.parceiro_vocab_aplicacao (tipo, palavra)
  with v as materialized (select distinct montadora, modelo from public.catalogo_pecas where ativo)
  select distinct 'montadora', public.parceiros_primeira_palavra(montadora) from (select distinct montadora from v) m
   where coalesce(montadora, '') <> ''
  union
  select distinct 'modelo', w from (select public.parceiros_primeira_palavra(modelo) w from (select distinct modelo from v) d) x
   where length(w) >= 3 and w !~ '^[0-9]+$'
     and w not in ('novo', 'nova', 'new', 'grand', 'classe', 'serie', 'linha', 'todos', 'ano', 'motor', 'flex', 'diesel');
  get diagnostics n = row_count;
  update public.parceiro_vocab_estado
     set assinatura = public.parceiros_vocabulario_assinatura(), palavras = n, atualizado_em = now()
   where id = 1;
  return n;
end $$;
revoke all on function public.parceiros_recalcular_vocabulario() from anon, public, authenticated;

-- Confere a assinatura e só recalcula quando a base oficial mudou. Devolve true se recalculou.
create or replace function public.parceiros_garantir_vocabulario() returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if (select assinatura from public.parceiro_vocab_estado where id = 1) is distinct from public.parceiros_vocabulario_assinatura() then
    perform public.parceiros_recalcular_vocabulario();
    return true;
  end if;
  return false;
end $$;
revoke all on function public.parceiros_garantir_vocabulario() from anon, public, authenticated;

-- Forçar manualmente (só administrador); normalmente não é preciso.
create or replace function public.parceiros_atualizar_vocabulario() returns integer
language plpgsql security definer set search_path = public as $$
begin
  if not (public.parceiros_eh_admin() or auth.uid() is null) then raise exception 'Somente o administrador.'; end if;
  return public.parceiros_recalcular_vocabulario();
end $$;
revoke all on function public.parceiros_atualizar_vocabulario() from anon, public;
grant execute on function public.parceiros_atualizar_vocabulario() to authenticated;
select public.parceiros_atualizar_vocabulario();

-- ---------- Validação técnica dos itens de um parceiro ----------
-- Só o administrador e o próprio parceiro (para corrigir antes da aprovação).
create or replace function public.parceiros_validacao_itens(p_parceiro uuid)
returns table (item_id uuid, nivel text, motivos text[])
language plpgsql volatile security definer set search_path = public as $$
#variable_conflict use_column
declare
  ano_max integer := extract(year from current_date)::integer + 1;
begin
  if not (public.parceiros_eh_admin() or public.parceiros_eh_membro(p_parceiro)) then
    raise exception 'Somente o administrador ou o próprio parceiro.';
  end if;
  -- a lista de montadoras/modelos é mantida em dia pelo agendador (pg_cron, a cada 15 min)
  return query
  with it as (
    select i.id, i.codigo, i.codigo_normalizado as cn, coalesce(i.descricao, '') as descricao,
           coalesce(i.aplicacao, '') as aplicacao, i.origem, coalesce(i.equivalencias, '{}') as eqs,
           public.parceiros_familia(i.descricao) as fam
      from public.parceiro_catalogo_itens i
     where i.parceiro_id = p_parceiro
  ),
  refs as (
    select it.id, it.codigo as exib, it.cn as n, 'codigo'::text as tipo from it
    union
    select it.id, e, upper(regexp_replace(e, '[^A-Za-z0-9]', '', 'g')), 'equivalencia' from it, unnest(it.eqs) e
  ),
  -- base técnica oficial: mesmo código / equivalência com tipo de peça diferente
  oficial as (
    select r.id, r.exib, r.tipo, string_agg(distinct c.peca, ' / ') as pecas,
           bool_or(public.parceiros_familias_compativeis(it.fam, public.parceiros_familia(c.peca))) as algum_compativel,
           bool_or(public.parceiros_familia(c.peca) is not null) as alguma_familia
      from refs r
      join it on it.id = r.id
      join public.catalogo_chaves c on c.codigo_normalizado = r.n and c.ativo
     where length(r.n) >= 4
     group by r.id, r.exib, r.tipo
  ),
  -- aplicações da base oficial para o código / equivalência
  aplic as (
    select r.id,
           array_agg(distinct public.parceiros_primeira_palavra(p.montadora)) as montadoras,
           array_agg(distinct public.parceiros_primeira_palavra(p.modelo)) as modelos,
           string_agg(distinct initcap(p.montadora) || ' ' || initcap(split_part(p.modelo, ' ', 1)), ', ') as resumo
      from refs r
      join public.catalogo_chaves c on c.codigo_normalizado = r.n and c.ativo
      join public.catalogo_pecas p on p.codigo_oem = c.codigo_tecnico_principal and p.ativo
     where length(r.n) >= 4
     group by r.id
  ),
  citados as (
    select it.id,
           array(select distinct w from unnest(string_to_array(trim(public.parceiros_texto_busca(it.aplicacao)), ' ')) w
                  where exists (select 1 from public.parceiro_vocab_aplicacao v
                                 where v.tipo = 'montadora' and v.palavra = public.parceiros_primeira_palavra(w))) as monts,
           array(select distinct w from unnest(string_to_array(trim(public.parceiros_texto_busca(it.aplicacao)), ' ')) w
                  where exists (select 1 from public.parceiro_vocab_aplicacao v
                                 where v.tipo = 'modelo' and v.palavra = w)) as mods
      from it where it.aplicacao <> ''
  ),
  compartilhadas as (
    select a.id, a.exib, ob.codigo as outro, ob.descricao as outra_desc,
           public.parceiros_familias_compativeis(oa.fam, ob.fam) as compativel
      from refs a
      join refs b on b.n = a.n and b.id <> a.id and b.tipo = 'equivalencia'
      join it oa on oa.id = a.id
      join it ob on ob.id = b.id
     where a.tipo = 'equivalencia' and length(a.n) >= 4
  ),
  m as (
    select o.id, 'conflito'::text as nv,
           format('%s %s consta na base técnica oficial como "%s"; aqui está descrito como "%s".',
                  case o.tipo when 'codigo' then 'O código' else 'A equivalência' end, o.exib, o.pecas, it.descricao) as motivo
      from oficial o join it on it.id = o.id
     where o.alguma_familia and not o.algum_compativel
    union all
    select s.id, case when s.compativel then 'conferir' else 'conflito' end,
           case when s.compativel then format('A equivalência %s também está no item %s: possível duplicidade.', s.exib, s.outro)
                else format('A equivalência %s também está no item %s ("%s"), de outro tipo de peça.', s.exib, s.outro, s.outra_desc) end
      from compartilhadas s
    union all
    select r.id, 'conferir', format('A equivalência %s é o código de outro produto deste catálogo (%s).', r.exib, o2.codigo)
      from refs r join it o2 on o2.cn = r.n and o2.id <> r.id
     where r.tipo = 'equivalencia'
    union all
    select it.id, 'conferir', 'Sem descrição: confira o que é o produto.'
      from it where length(regexp_replace(it.descricao, '[^A-Za-zÀ-ú]', '', 'g')) < 4
    union all
    select it.id, 'conferir', 'Lido automaticamente de PDF: confira código e descrição.'
      from it where it.origem = 'extracao_pdf'
    union all
    select it.id, 'conferir', format('Ano inválido ou período invertido na aplicação ("%s").', it.aplicacao)
      from it
     where exists (select 1 from regexp_matches(it.aplicacao, '(19\d\d|20\d\d)', 'g') y
                    where y[1]::integer < 1950 or y[1]::integer > ano_max)
        or exists (select 1 from regexp_matches(it.aplicacao, '((?:19|20)\d\d)\s*(?:-|/|a|ate|até)\s*((?:19|20)\d\d)', 'gi') y
                    where y[1]::integer > y[2]::integer)
    union all
    select c.id, 'conferir', format('A aplicação cita %s, mas a base técnica oficial indica: %s.',
                                    initcap(array_to_string(c.monts || c.mods, ', ')), left(a.resumo, 160))
      from citados c join aplic a on a.id = c.id
     where (cardinality(c.monts) > 0 and not (array(select public.parceiros_primeira_palavra(x) from unnest(c.monts) x) && a.montadoras))
        or (cardinality(c.mods) > 0 and not (c.mods && a.modelos))
  )
  select it.id,
         case when bool_or(m.nv = 'conflito') then 'conflito'
              when bool_or(m.nv = 'conferir') then 'conferir'
              else 'sem_divergencia' end,
         coalesce(array_agg(distinct m.motivo) filter (where m.motivo is not null), '{}')
    from it left join m on m.id = it.id
   group by it.id;
end $$;
revoke all on function public.parceiros_validacao_itens(uuid) from anon, public;
grant execute on function public.parceiros_validacao_itens(uuid) to authenticated;

-- ---------- Aprovação em lote: só o que não tem divergência ----------
create or replace function public.parceiros_aprovar_pendentes(p_parceiro uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.parceiros_eh_admin() then raise exception 'Somente o administrador.'; end if;
  perform set_config('paiia.lote_validado', 'on', true);
  update public.parceiro_catalogo_itens i set situacao_tecnica = 'aprovado', analisado_em = now()
   where i.parceiro_id = p_parceiro and i.situacao_tecnica = 'pendente'
     and i.id in (select v.item_id from public.parceiros_validacao_itens(p_parceiro) v where v.nivel = 'sem_divergencia');
  get diagnostics n = row_count;
  perform set_config('paiia.lote_validado', 'off', true);
  return n;
end $$;
revoke all on function public.parceiros_aprovar_pendentes(uuid) from anon, public;
grant execute on function public.parceiros_aprovar_pendentes(uuid) to authenticated;

-- ---------- Item suspeito: aprovar só com o registro da conferência técnica ----------
create or replace function public.parceiro_itens_conferencia() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_nivel text;
begin
  if new.situacao_tecnica = 'aprovado' and old.situacao_tecnica is distinct from 'aprovado'
     and coalesce(current_setting('paiia.lote_validado', true), 'off') <> 'on' then
    select v.nivel into v_nivel from public.parceiros_validacao_itens(new.parceiro_id) v where v.item_id = new.id;
    if coalesce(v_nivel, 'sem_divergencia') <> 'sem_divergencia' and coalesce(trim(new.analise_motivo), '') = '' then
      raise exception 'Item % com %: registre a conferência técnica antes de aprovar.',
        new.codigo, case v_nivel when 'conflito' then 'conflito identificado' else 'pontos a conferir' end;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists parceiro_itens_validar on public.parceiro_catalogo_itens;
create trigger parceiro_itens_validar before update on public.parceiro_catalogo_itens
  for each row execute function public.parceiro_itens_conferencia();

-- ---------- Pesquisa por descrição e aplicação (itens aprovados de parceiros visíveis) ----------
-- Todas as palavras precisam aparecer (sem acento). Respeita o RLS de quem pesquisa.
create or replace function public.parceiros_buscar_texto(p_termo text)
returns setof public.parceiro_catalogo_itens
language sql stable security invoker set search_path = public as $$
  with palavras as (
    select w from unnest(string_to_array(trim(public.parceiros_texto_busca(p_termo)), ' ')) w
     where length(w) >= 2 limit 6
  )
  select i.* from public.parceiro_catalogo_itens i
   where i.situacao_tecnica = 'aprovado'
     and public.parceiros_visivel(i.parceiro_id)
     and exists (select 1 from palavras)
     and not exists (
       select 1 from palavras p
        where public.parceiros_texto_busca(concat_ws(' ', i.descricao, i.aplicacao, i.marca, i.segmento)) not like '% ' || p.w || '%')
   order by i.codigo
   limit 100
$$;
revoke all on function public.parceiros_buscar_texto(text) from anon, public;
grant execute on function public.parceiros_buscar_texto(text) to authenticated;

-- ---------- Agendador: lista de montadoras/modelos em dia com a base oficial ----------
-- Roda como dono do banco (sem o limite de 8 s dos usuários). Sem mudança, só lê o contador.
create extension if not exists pg_cron;
select cron.schedule('paiia-parceiros-vocabulario', '*/15 * * * *', 'select public.parceiros_garantir_vocabulario()');


-- =====================================================================
-- PRODUÇÃO: administrador único e conferência final
-- =====================================================================
alter table public.parceiros add constraint parceiros_sem_ficticio_producao check (ficticio = false);
insert into public.parceiros_admins (user_id) values ('b329da23-9444-44ab-8b2f-53ed612c5d2d');

do $conferencia$
declare n_adm int; n_parc int; n_itens int; n_vinc int; n_cot int;
begin
  select count(*) into n_adm from public.parceiros_admins;
  select count(*) into n_parc from public.parceiros;
  select count(*) into n_itens from public.parceiro_catalogo_itens;
  select count(*) into n_vinc from public.parceiro_usuarios;
  select count(*) into n_cot from public.parceiro_cotacoes;
  if n_adm <> 1 or not exists (select 1 from public.parceiros_admins where user_id = 'b329da23-9444-44ab-8b2f-53ed612c5d2d') then
    raise exception 'Administrador diferente do esperado: publicação desfeita.';
  end if;
  if n_parc + n_itens + n_vinc + n_cot > 0 then
    raise exception 'Há dados nas tabelas novas (% parceiros, % itens): publicação desfeita.', n_parc, n_itens;
  end if;
  raise notice 'PAIIA Parceiros publicado: 1 administrador, 0 parceiros, 0 itens, nenhum dado fictício.';
end $conferencia$;
