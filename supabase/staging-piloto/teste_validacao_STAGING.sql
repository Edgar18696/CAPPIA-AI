-- Rodar só no STAGING. Teste da validação técnica, da aprovação em lote e da pesquisa por texto.
-- Tudo dentro de uma transação desfeita no fim; mostra "N verificações, F falha(s)".
create temp table resultado (perfil text, teste text, ok boolean, detalhe text) on commit drop;
grant all on resultado to authenticated;

do $$
declare
  v_admin uuid := (select user_id from public.parceiros_admins limit 1);
  v_parc uuid := (select id from auth.users where id not in (select user_id from public.parceiros_admins) order by created_at limit 1);
  v_comum uuid := (select id from auth.users where id not in (select user_id from public.parceiros_admins) order by created_at desc limit 1);
  pid uuid := '00000000-0000-4000-a000-000000000001';
  n int;
  t text;
  falhou boolean;
begin
  insert into public.parceiro_usuarios values (pid, v_parc) on conflict do nothing;

  -------------------- PARCEIRO envia itens --------------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_parc, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.parceiro_catalogo_itens (parceiro_id, codigo, descricao, aplicacao, equivalencias, situacao_tecnica) values
    (pid, 'VAL-1', 'Bomba de combustível (teste)', '', '{DOX-0109}', 'aprovado'),
    (pid, 'VAL-2', 'Radiador (teste)', 'Fiat Palio 2012', '{9015003500}', 'pendente'),
    (pid, 'VAL-3', 'Sensor de rotação (teste)', 'Gol 2015-2010', '{}', 'pendente'),
    (pid, 'VAL-4', 'Filtro de óleo quadrado (teste)', 'Linha leve', '{}', 'pendente'),
    (pid, 'VAL-5', 'Sonda lambda universal (teste)', '', '{DOX-0109}', 'pendente'),
    (pid, 'VAL-6', '', '', '{}', 'pendente');
  select count(*) into n from public.parceiro_catalogo_itens where codigo like 'VAL-%' and situacao_tecnica = 'pendente';
  insert into resultado values ('parceiro', 'tudo o que envia entra pendente', n = 6, n::text);
  select count(*) into n from public.parceiros_validacao_itens(pid);
  insert into resultado values ('parceiro', 'vê a validação do próprio catálogo', n > 0, n::text);
  falhou := false;
  begin perform public.parceiros_aprovar_pendentes(pid); exception when others then falhou := true; end;
  insert into resultado values ('parceiro', 'não aprova em lote', falhou, '');
  reset role;

  -------------------- LISTA DE MONTADORAS/MODELOS: atualização automática --------------------
  -- simula "a base oficial mudou": assinatura antiga e uma palavra faltando
  update public.parceiro_vocab_estado set assinatura = 'antiga' where id = 1;
  delete from public.parceiro_vocab_aplicacao where tipo = 'modelo' and palavra = 'sprinter';

  -------------------- ADMINISTRADOR --------------------
  -- o que o agendador (pg_cron) executa a cada 15 minutos
  perform public.parceiros_garantir_vocabulario();
  select count(*) into n from cron.job where jobname = 'paiia-parceiros-vocabulario' and schedule = '*/15 * * * *' and active;
  insert into resultado values ('admin', 'agendador da lista de montadoras/modelos ativo (15 min)', n = 1, n::text);
  select count(*) into n from public.parceiro_vocab_estado
   where id = 1 and assinatura = public.parceiros_vocabulario_assinatura() and palavras > 0;
  insert into resultado values ('admin', 'lista de montadoras/modelos se atualiza sozinha quando a base oficial muda', n = 1, n::text);
  select count(*) into n from public.parceiro_vocab_aplicacao where tipo = 'modelo' and palavra = 'sprinter';
  insert into resultado values ('admin', 'palavra que faltava voltou (sprinter)', n = 1, n::text);
  select assinatura into t from public.parceiro_vocab_estado where id = 1;
  perform public.parceiros_garantir_vocabulario();
  select count(*) into n from public.parceiro_vocab_estado where id = 1 and assinatura = t;
  insert into resultado values ('admin', 'sem mudança na base oficial, não recalcula à toa', n = 1, n::text);
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select v.nivel || ' | ' || array_to_string(v.motivos, ' | ') into t from public.parceiros_validacao_itens(pid) v
    join public.parceiro_catalogo_itens i on i.id = v.item_id where i.codigo = 'VAL-1';
  insert into resultado values ('admin', 'VAL-1 conflito com a base oficial (sonda x bomba)', t like 'conflito%base técnica oficial%', t);
  select v.nivel || ' | ' || array_to_string(v.motivos, ' | ') into t from public.parceiros_validacao_itens(pid) v
    join public.parceiro_catalogo_itens i on i.id = v.item_id where i.codigo = 'VAL-2';
  insert into resultado values ('admin', 'VAL-2 aplicação diferente da base oficial', t like 'conferir%aplicação cita%', t);
  select v.nivel || ' | ' || array_to_string(v.motivos, ' | ') into t from public.parceiros_validacao_itens(pid) v
    join public.parceiro_catalogo_itens i on i.id = v.item_id where i.codigo = 'VAL-3';
  insert into resultado values ('admin', 'VAL-3 ano invertido', t like 'conferir%Ano inválido%', t);
  select v.nivel into t from public.parceiros_validacao_itens(pid) v
    join public.parceiro_catalogo_itens i on i.id = v.item_id where i.codigo = 'VAL-4';
  insert into resultado values ('admin', 'VAL-4 sem divergências', t = 'sem_divergencia', t);
  select v.nivel || ' | ' || array_to_string(v.motivos, ' | ') into t from public.parceiros_validacao_itens(pid) v
    join public.parceiro_catalogo_itens i on i.id = v.item_id where i.codigo = 'VAL-5';
  insert into resultado values ('admin', 'VAL-5 sonda lambda bate com a base oficial; conflito só com VAL-1 (bomba)',
    t not like '%base técnica oficial%' and t like 'conflito%VAL-1%', t);
  select v.nivel into t from public.parceiros_validacao_itens(pid) v
    join public.parceiro_catalogo_itens i on i.id = v.item_id where i.codigo = 'VAL-6';
  insert into resultado values ('admin', 'VAL-6 sem descrição: conferir', t = 'conferir', t);
  select v.nivel into t from public.parceiros_validacao_itens(pid) v
    join public.parceiro_catalogo_itens i on i.id = v.item_id where i.codigo = 'PL-801';
  insert into resultado values ('admin', 'PL-801 x DP-1001: mesma equivalência, peças diferentes', t = 'conflito', t);

  n := public.parceiros_aprovar_pendentes(pid);
  select count(*) into n from public.parceiro_catalogo_itens where codigo like 'VAL-%' and situacao_tecnica = 'aprovado';
  select string_agg(codigo, ',' order by codigo) into t from public.parceiro_catalogo_itens where codigo like 'VAL-%' and situacao_tecnica = 'aprovado';
  insert into resultado values ('admin', 'lote aprova só os sem divergência', t = 'VAL-4', coalesce(t, 'nenhum'));

  falhou := false;
  begin
    update public.parceiro_catalogo_itens set situacao_tecnica = 'aprovado' where parceiro_id = pid and codigo = 'VAL-1';
  exception when others then falhou := true; t := sqlerrm; end;
  insert into resultado values ('admin', 'item em conflito não é aprovado sem conferência', falhou, coalesce(t, ''));
  update public.parceiro_catalogo_itens set situacao_tecnica = 'aprovado', analise_motivo = 'Conferido com o fornecedor (teste)'
   where parceiro_id = pid and codigo = 'VAL-2';
  select count(*) into n from public.parceiro_catalogo_itens where codigo = 'VAL-2' and situacao_tecnica = 'aprovado';
  insert into resultado values ('admin', 'com o registro da conferência, aprova um a um', n = 1, n::text);
  select count(*) into n from public.catalogo_chaves where codigo_normalizado = 'DOX0109';
  insert into resultado values ('admin', 'base técnica oficial intacta', n >= 1, n::text);
  reset role;

  -------------------- USUÁRIO COMUM --------------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_comum, 'role', 'authenticated')::text, true);
  set local role authenticated;
  falhou := false;
  begin perform public.parceiros_validacao_itens(pid); exception when others then falhou := true; end;
  insert into resultado values ('usuario', 'não lê a validação interna', falhou, '');
  select string_agg(codigo, ',') into t from public.parceiros_buscar_texto('filtro oleo');
  insert into resultado values ('usuario', 'pesquisa por descrição sem acento acha item aprovado', t like '%VAL-4%', coalesce(t, 'nada'));
  select count(*) into n from public.parceiros_buscar_texto('sensor rotacao') where codigo = 'VAL-3';
  insert into resultado values ('usuario', 'pesquisa não mostra item pendente', n = 0, n::text);
  select count(*) into n from public.parceiros_buscar_texto('Palio') where codigo = 'VAL-2';
  insert into resultado values ('usuario', 'pesquisa por aplicação acha item aprovado', n = 1, n::text);
  falhou := false;
  begin perform public.parceiros_aprovar_pendentes(pid); exception when others then falhou := true; end;
  insert into resultado values ('usuario', 'não aprova', falhou, '');
  falhou := false;
  begin perform public.parceiros_recalcular_vocabulario(); exception when others then falhou := true; end;
  insert into resultado values ('usuario', 'não mexe direto na lista de montadoras/modelos', falhou, '');
  reset role;
end $$;

do $fim$ begin raise exception 'RESULTADO|% verificações, % falha(s)|%',
  (select count(*) from resultado), (select count(*) from resultado where not ok),
  coalesce((select string_agg('FALHA [' || perfil || '] ' || teste || ' (' || left(coalesce(detalhe,''),160) || ')', '|' order by perfil desc, teste) from resultado where not ok), 'nenhuma');
end $fim$;
