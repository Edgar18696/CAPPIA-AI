begin;

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