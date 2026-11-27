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
