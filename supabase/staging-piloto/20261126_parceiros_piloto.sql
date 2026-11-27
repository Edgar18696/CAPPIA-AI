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
  ficticio boolean not null default true,
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
create policy parceiros_escrita on public.parceiros for all to authenticated using (true) with check (ficticio = true and cobranca_ativa = false);

drop policy if exists parceiro_itens_leitura on public.parceiro_catalogo_itens;
create policy parceiro_itens_leitura on public.parceiro_catalogo_itens for select to authenticated using (true);
drop policy if exists parceiro_itens_escrita on public.parceiro_catalogo_itens;
create policy parceiro_itens_escrita on public.parceiro_catalogo_itens for all to authenticated using (true) with check (true);

drop policy if exists parceiro_cotacoes_proprias on public.parceiro_cotacoes;
create policy parceiro_cotacoes_proprias on public.parceiro_cotacoes for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid() and situacao = 'simulada');

-- ---------------------------------------------------------------------
-- DADOS FICTÍCIOS DO PILOTO (empresa inventada, contatos inválidos de propósito)
-- ---------------------------------------------------------------------
insert into public.parceiros (id, nome_fantasia, razao_social, documento, tipo_empresa, segmentos, marcas,
  apresentacao, site, whatsapp, email_comercial, contatos, catalogo_tipo, catalogo_autorizado, modalidades,
  situacao, criterios, aprovado_em, aprovado_por, mensalidade_centavos, vigencia_inicio, vigencia_fim, observacoes_admin)
values ('00000000-0000-4000-a000-000000000001',
  'Distribuidora Piloto (FICTÍCIA)', 'Distribuidora Piloto de Autopeças Ltda (FICTÍCIA)', '00.000.000/0001-00',
  'distribuidor', '{Injeção eletrônica,Sensores,Arrefecimento,Suspensão,Freios}', '{DENSO,TSA,Marca Exemplo}',
  'Empresa fictícia criada só para testar o PAIIA Parceiros no ambiente de teste. Nenhum dado é real.',
  'https://exemplo.invalid', '(00) 00000-0000', 'comercial@exemplo.invalid',
  '[{"nome":"Contato Comercial (fictício)","funcao":"Vendas","telefone":"(00) 0000-0000","email":"vendas@exemplo.invalid"},
    {"nome":"Contato Compras (fictício)","funcao":"Compras","telefone":"(00) 0000-0001","email":"compras@exemplo.invalid"}]',
  'itens_paiia', true, '{consulta_catalogo,cotacao,venda,compra,servicos,locacao_equipamentos}',
  'ativo',
  '{"reputacao":true,"qualidade":true,"catalogo_confiavel":true,"capacidade_fornecimento":true,"atendimento":true,"atualizacao_tecnica":true}',
  now(), 'Edgar (simulação)', 19990, current_date, current_date + 365,
  'Mensalidade fictícia R$ 199,90 — simulação, sem cobrança.')
on conflict (id) do nothing;

insert into public.parceiro_catalogo_itens (parceiro_id, codigo, codigo_normalizado, codigos_relacionados, descricao, marca, segmento, aplicacao)
values
 ('00000000-0000-4000-a000-000000000001','DOX-0109','DOX0109','{}','Sonda lambda (item fictício de teste)','DENSO','Sensores','Conferir aplicação nos Catálogos Técnicos'),
 ('00000000-0000-4000-a000-000000000001','EXEMPLO-1001','EXEMPLO1001','{TESTE1001}','Bico injetor (item fictício)','Marca Exemplo','Injeção eletrônica','Item fictício — sem aplicação real'),
 ('00000000-0000-4000-a000-000000000001','EXEMPLO-2002','EXEMPLO2002','{}','Bomba d''água (item fictício)','Marca Exemplo','Arrefecimento','Item fictício — sem aplicação real'),
 ('00000000-0000-4000-a000-000000000001','EXEMPLO-3003','EXEMPLO3003','{}','Pastilha de freio (item fictício)','Marca Exemplo','Freios','Item fictício — sem aplicação real')
on conflict do nothing;
