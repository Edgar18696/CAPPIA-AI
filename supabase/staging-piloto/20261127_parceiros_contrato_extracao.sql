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
