begin;

alter table public.creditos_appia
  add column if not exists saldo_reservado integer not null default 0;

alter table public.creditos_appia
  add column if not exists migrado_carteira_paiia_em timestamptz;

create table if not exists public.operacoes_creditos_paiia (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  chave_idempotencia text not null,
  recurso text not null,
  creditos integer not null,
  status text not null default 'reservado',
  metadados jsonb not null default '{}'::jsonb,
  resultado jsonb not null default '{}'::jsonb,
  motivo_liberacao text,
  reservado_em timestamptz not null default now(),
  confirmado_em timestamptz,
  liberado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint operacoes_creditos_paiia_pkey primary key (id),
  constraint operacoes_creditos_paiia_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade,
  constraint operacoes_creditos_paiia_creditos_check check (creditos > 0),
  constraint operacoes_creditos_paiia_status_check
    check (status in ('reservado', 'confirmado', 'liberado')),
  constraint operacoes_creditos_paiia_user_id_chave_idempotencia_key
    unique (user_id, chave_idempotencia)
);

create index if not exists operacoes_creditos_paiia_user_created_idx
  on public.operacoes_creditos_paiia (user_id, created_at desc);

alter table public.operacoes_creditos_paiia enable row level security;

drop policy if exists usuario_visualiza_proprias_operacoes_creditos
  on public.operacoes_creditos_paiia;

create policy usuario_visualiza_proprias_operacoes_creditos
  on public.operacoes_creditos_paiia
  for select
  to authenticated
  using (auth.uid() = user_id);
grant select on table public.operacoes_creditos_paiia to authenticated;
grant all on table public.operacoes_creditos_paiia to service_role;

create or replace function public.paiia_confirmar_consumo(
  p_operacao_id uuid,
  p_resultado jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_operacao public.operacoes_creditos_paiia%rowtype;
  v_saldo integer;
  v_reservado integer;
begin
  if v_user_id is null then
    raise exception 'AUTENTICACAO_OBRIGATORIA';
  end if;

  select *
  into v_operacao
  from public.operacoes_creditos_paiia
  where id = p_operacao_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'OPERACAO_NAO_ENCONTRADA';
  end if;

  if v_operacao.status = 'confirmado' then
    select saldo, saldo_reservado
    into v_saldo, v_reservado
    from public.creditos_appia
    where user_id = v_user_id;

    return jsonb_build_object(
      'operacao_id', v_operacao.id,
      'status', 'confirmado',
      'creditos', v_operacao.creditos,
      'saldo', v_saldo,
      'reservado', v_reservado,
      'idempotente', true
    );
  end if;

  if v_operacao.status = 'liberado' then
    raise exception 'RESERVA_JA_LIBERADA';
  end if;

  update public.creditos_appia
  set saldo_reservado = saldo_reservado - v_operacao.creditos,
      total_utilizado = total_utilizado + v_operacao.creditos,
      updated_at = now()
  where user_id = v_user_id
    and saldo_reservado >= v_operacao.creditos
  returning saldo, saldo_reservado
  into v_saldo, v_reservado;

  if not found then
    raise exception 'SALDO_RESERVADO_INCONSISTENTE';
  end if;

  update public.operacoes_creditos_paiia
  set status = 'confirmado',
      resultado = coalesce(p_resultado, '{}'::jsonb),
      confirmado_em = now(),
      liberado_em = null,
      motivo_liberacao = null,
      updated_at = now()
  where id = v_operacao.id;

  return jsonb_build_object(
    'operacao_id', v_operacao.id,
    'status', 'confirmado',
    'creditos', v_operacao.creditos,
    'saldo', v_saldo,
    'reservado', v_reservado,
    'idempotente', false
  );
end;
$function$;

create or replace function public.paiia_liberar_reserva(
  p_operacao_id uuid,
  p_motivo text default 'geracao_falhou',
  p_resultado jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_operacao public.operacoes_creditos_paiia%rowtype;
  v_saldo integer;
  v_reservado integer;
begin
  if v_user_id is null then
    raise exception 'AUTENTICACAO_OBRIGATORIA';
  end if;

  select *
  into v_operacao
  from public.operacoes_creditos_paiia
  where id = p_operacao_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'OPERACAO_NAO_ENCONTRADA';
  end if;

  if v_operacao.status = 'liberado' then
    select saldo, saldo_reservado
    into v_saldo, v_reservado
    from public.creditos_appia
    where user_id = v_user_id;

    return jsonb_build_object(
      'operacao_id', v_operacao.id,
      'status', 'liberado',
      'creditos', v_operacao.creditos,
      'saldo', v_saldo,
      'reservado', v_reservado,
      'idempotente', true
    );
  end if;

  if v_operacao.status = 'confirmado' then
    raise exception 'CONSUMO_JA_CONFIRMADO';
  end if;

  update public.creditos_appia
  set saldo = saldo + v_operacao.creditos,
      saldo_reservado = saldo_reservado - v_operacao.creditos,
      updated_at = now()
  where user_id = v_user_id
    and saldo_reservado >= v_operacao.creditos
  returning saldo, saldo_reservado
  into v_saldo, v_reservado;

  if not found then
    raise exception 'SALDO_RESERVADO_INCONSISTENTE';
  end if;

  update public.operacoes_creditos_paiia
  set status = 'liberado',
      resultado = coalesce(p_resultado, '{}'::jsonb),
      motivo_liberacao = coalesce(
        nullif(trim(p_motivo), ''),
        'geracao_falhou'
      ),
      liberado_em = now(),
      confirmado_em = null,
      updated_at = now()
  where id = v_operacao.id;

  return jsonb_build_object(
    'operacao_id', v_operacao.id,
    'status', 'liberado',
    'creditos', v_operacao.creditos,
    'saldo', v_saldo,
    'reservado', v_reservado,
    'idempotente', false
  );
end;
$function$;

revoke all on function public.paiia_confirmar_consumo(uuid, jsonb)
from public, anon;

revoke all on function public.paiia_liberar_reserva(uuid, text, jsonb)
from public, anon;

grant execute
on function public.paiia_confirmar_consumo(uuid, jsonb)
to authenticated, service_role;

grant execute
on function public.paiia_liberar_reserva(uuid, text, jsonb)
to authenticated, service_role;

commit;
