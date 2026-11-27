-- Rodar só no STAGING. Mostra apenas as FALHAS (nenhuma linha = tudo certo); tudo é desfeito no fim.
-- Teste dos 3 perfis no STAGING, tudo dentro de uma transação desfeita no fim.
create temp table resultado (perfil text, teste text, ok boolean, detalhe text) on commit drop;
grant all on resultado to authenticated;

do $$
declare
  v_admin uuid := (select user_id from public.parceiros_admins limit 1);
  v_parc uuid := (select id from auth.users where id not in (select user_id from public.parceiros_admins) order by created_at limit 1);
  v_comum uuid := (select id from auth.users where id not in (select user_id from public.parceiros_admins) order by created_at desc limit 1);
  pid uuid := '00000000-0000-4000-a000-000000000001';
  n int;
  aprovados int := (select count(*) from public.parceiro_catalogo_itens where parceiro_id = '00000000-0000-4000-a000-000000000001' and situacao_tecnica = 'aprovado');
  r jsonb;
begin
  insert into public.parceiro_usuarios values (pid, v_parc) on conflict do nothing;
  -- um segundo parceiro, em análise (não deve aparecer para o usuário comum)
  insert into public.parceiros (id, nome_fantasia, situacao, ficticio) values ('00000000-0000-4000-a000-0000000000ff', 'Em Análise Teste', 'em_analise', true);
  insert into public.parceiro_catalogo_itens (parceiro_id, codigo, codigo_normalizado, situacao_tecnica) values (pid, 'PEND-1', 'PEND1', 'pendente');

  -------------------- USUÁRIO COMUM --------------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_comum, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.parceiros;
  insert into resultado values ('usuario', 'vê só parceiros ativos (1)', n = 1, n::text);
  select count(*) into n from public.parceiro_contratos;
  insert into resultado values ('usuario', 'não lê mensalidade/contrato', n = 0, n::text);
  select count(*) into n from public.parceiro_catalogo_itens where codigo = 'PEND-1';
  insert into resultado values ('usuario', 'não vê item pendente', n = 0, n::text);
  select count(*) into n from public.parceiro_catalogo_itens;
  insert into resultado values ('usuario', 'vê só os itens aprovados', n = aprovados, n::text || ' de ' || aprovados);
  select count(*) into n from public.parceiro_controle;
  insert into resultado values ('usuario', 'não lê critérios nem observações internas', n = 0, n::text);
  begin
    update public.parceiros set nome_fantasia = 'X' where id = pid;
    get diagnostics n = row_count;
    insert into resultado values ('usuario', 'não altera dados do parceiro', n = 0, n::text);
  exception when others then insert into resultado values ('usuario', 'não altera dados do parceiro', true, sqlerrm); end;
  begin
    insert into public.parceiros (nome_fantasia) values ('Invasor');
    insert into resultado values ('usuario', 'não cadastra parceiro', false, 'inseriu');
  exception when others then insert into resultado values ('usuario', 'não cadastra parceiro', true, sqlerrm); end;
  insert into public.parceiro_cotacoes (parceiro_id, codigo, quantidade) values (pid, 'DOX-0109', 2);
  insert into resultado values ('usuario', 'registra cotação simulada', true, '');
  begin
    insert into public.parceiro_cotacoes (parceiro_id, codigo, quantidade, situacao) values (pid, 'DOX-0109', 2, 'enviada');
    insert into resultado values ('usuario', 'não envia cotação real', false, 'inseriu');
  exception when others then insert into resultado values ('usuario', 'não envia cotação real', true, sqlerrm); end;
  begin
    insert into public.parceiro_cotacoes (parceiro_id, codigo, quantidade) values ('00000000-0000-4000-a000-0000000000ff', 'X', 1);
    insert into resultado values ('usuario', 'não cota parceiro não ativo', false, 'inseriu');
  exception when others then insert into resultado values ('usuario', 'não cota parceiro não ativo', true, sqlerrm); end;
  reset role;

  -------------------- PARCEIRO --------------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_parc, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.parceiros set apresentacao = 'Atualizado pelo parceiro' where id = pid;
  get diagnostics n = row_count;
  insert into resultado values ('parceiro', 'atualiza os próprios dados comerciais', n = 1, n::text);
  select count(*) into n from public.parceiro_contratos where parceiro_id = pid;
  insert into resultado values ('parceiro', 'lê o próprio contrato', n = 1, n::text);
  begin
    update public.parceiros set situacao = 'suspenso' where id = pid;
    insert into resultado values ('parceiro', 'não muda a situação', false, 'alterou');
  exception when others then insert into resultado values ('parceiro', 'não muda a situação', true, sqlerrm); end;
  update public.parceiro_controle set criterios = '{}' where parceiro_id = pid;
  get diagnostics n = row_count;
  insert into resultado values ('parceiro', 'não muda critérios de aprovação', n = 0, n::text);
  select count(*) into n from public.parceiro_controle;
  insert into resultado values ('parceiro', 'não lê observações internas do administrador', n = 0, n::text);
  update public.parceiro_contratos set experiencia_dias = 365, renovacao_automatica = true where parceiro_id = pid;
  get diagnostics n = row_count;
  insert into resultado values ('parceiro', 'não muda experiência nem renovação', n = 0, n::text);
  begin
    perform public.parceiros_verificar_vencimentos();
    insert into resultado values ('parceiro', 'não roda a rotina de vencimentos', false, 'rodou');
  exception when others then insert into resultado values ('parceiro', 'não roda a rotina de vencimentos', true, sqlerrm); end;
  update public.parceiros set contatos = '[{"nome":"Vendedor Teste","funcao":"Representante"}]' where id = pid;
  get diagnostics n = row_count;
  insert into resultado values ('parceiro', 'cadastra os próprios vendedores/representantes', n = 1, n::text);
  update public.parceiro_contratos set mensalidade_centavos = 0 where parceiro_id = pid;
  get diagnostics n = row_count;
  insert into resultado values ('parceiro', 'não muda a mensalidade', n = 0, n::text);
  update public.parceiro_contratos set vigencia_fim = '2099-01-01' where parceiro_id = pid;
  get diagnostics n = row_count;
  insert into resultado values ('parceiro', 'não muda a vigência', n = 0, n::text);
  insert into public.parceiro_catalogo_itens (parceiro_id, codigo, codigo_normalizado, situacao_tecnica) values (pid, 'NOVO-9', 'NOVO9', 'aprovado');
  select count(*) into n from public.parceiro_catalogo_itens where codigo = 'NOVO-9' and situacao_tecnica = 'pendente';
  insert into resultado values ('parceiro', 'item enviado fica pendente (mesmo tentando aprovar)', n = 1, n::text);
  update public.parceiros set catalogo_arquivo = 'x/teste.pdf' where id = pid;
  select count(*) into n from public.parceiros where id = pid and catalogo_situacao = 'pendente';
  insert into resultado values ('parceiro', 'arquivo de catálogo fica pendente', n = 1, n::text);
  select count(*) into n from public.parceiro_cotacoes where parceiro_id = pid;
  insert into resultado values ('parceiro', 'vê as cotações recebidas', n >= 1, n::text);
  select count(*) into n from public.parceiros where id = '00000000-0000-4000-a000-0000000000ff';
  insert into resultado values ('parceiro', 'não vê outro parceiro em análise', n = 0, n::text);
  begin
    perform public.parceiros_vincular_usuario(pid, 'qualquer@exemplo.invalid');
    insert into resultado values ('parceiro', 'não vincula contas', false, 'vinculou');
  exception when others then insert into resultado values ('parceiro', 'não vincula contas', true, sqlerrm); end;
  reset role;

  -------------------- ADMINISTRADOR --------------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.parceiros set situacao = 'suspenso' where id = pid;
  get diagnostics n = row_count;
  insert into resultado values ('admin', 'suspende a parceria', n = 1, n::text);
  update public.parceiro_contratos set mensalidade_centavos = 25000 where parceiro_id = pid;
  get diagnostics n = row_count;
  insert into resultado values ('admin', 'define a mensalidade', n = 1, n::text);
  begin
    update public.parceiro_contratos set cobranca_ativa = true where parceiro_id = pid;
    insert into resultado values ('admin', 'nem o admin liga cobrança', false, 'ligou');
  exception when others then insert into resultado values ('admin', 'nem o admin liga cobrança', true, sqlerrm); end;
  update public.parceiro_catalogo_itens set situacao_tecnica = 'aprovado', analise_motivo = 'Conferido (teste)' where codigo = 'NOVO-9';
  select count(*) into n from public.parceiro_catalogo_itens where codigo = 'NOVO-9' and situacao_tecnica = 'aprovado' and analisado_em is not null;
  insert into resultado values ('admin', 'aprova item técnico', n = 1, n::text);
  select count(*) into n from public.parceiros;
  insert into resultado values ('admin', 'vê todos os parceiros', n >= 2, n::text);
  select count(*) into n from public.parceiro_controle where parceiro_id = pid;
  insert into resultado values ('admin', 'lê critérios e observações internas', n = 1, n::text);
  begin
    update public.parceiros set situacao = 'ativo' where id = '00000000-0000-4000-a000-0000000000ff';
    insert into resultado values ('admin', 'não ativa sem os 6 critérios', false, 'ativou');
  exception when others then insert into resultado values ('admin', 'não ativa sem os 6 critérios', true, sqlerrm); end;
  -- vencimento sem renovação: suspende
  update public.parceiros set situacao = 'ativo' where id = pid;
  update public.parceiro_contratos set vigencia_inicio = '2025-01-01', vigencia_fim = current_date - 1, renovacao_automatica = false where parceiro_id = pid;
  r := public.parceiros_verificar_vencimentos();
  select count(*) into n from public.parceiros p join public.parceiro_contratos c on c.parceiro_id = p.id
   where p.id = pid and p.situacao = 'suspenso' and c.suspensao_motivo like 'Vencida em%';
  insert into resultado values ('admin', 'vencida sem renovação é suspensa', n = 1, r::text);
  -- vencimento com renovação automática: renova pelo período
  update public.parceiros set situacao = 'ativo' where id = pid;
  update public.parceiro_contratos set vigencia_fim = current_date - 1, renovacao_automatica = true, periodo_meses = 12 where parceiro_id = pid;
  r := public.parceiros_verificar_vencimentos();
  select count(*) into n from public.parceiros p join public.parceiro_contratos c on c.parceiro_id = p.id
   where p.id = pid and p.situacao = 'ativo' and c.vigencia_inicio = current_date and c.vigencia_fim > current_date + 300;
  insert into resultado values ('admin', 'com renovação automática é renovada', n = 1, r::text);
  update public.parceiro_contratos set mensalidade_centavos = 0, experiencia_dias = 60 where parceiro_id = pid;
  get diagnostics n = row_count;
  insert into resultado values ('admin', 'define mensalidade livre e experiência gratuita', n = 1, n::text);
  reset role;
end $$;

do $fim$ begin raise exception 'RESULTADO|% verificações, % falha(s)|%',
  (select count(*) from resultado), (select count(*) from resultado where not ok),
  coalesce((select string_agg('FALHA [' || perfil || '] ' || teste || ' (' || left(coalesce(detalhe,''),60) || ')', '|' order by perfil desc, teste) from resultado where not ok), 'nenhuma');
end $fim$;
