import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  COTACAO_INTERNA_ATIVA,
  SEGMENTOS_AUTOMOTIVOS,
  NIVEIS_VALIDACAO,
  resumoValidacao,
  termoParaTexto,
  linkTelefone,
  linkEmail,
  linkSite,
  linkWhatsapp,
  parceiroEmBranco,
} from "../../src/config/parceirosPiloto.js";

const ler = (caminho) => fs.readFileSync(new URL(caminho, import.meta.url), "utf8");

test("modelo simplificado: cotação interna desligada, mas o código continua guardado", () => {
  assert.equal(COTACAO_INTERNA_ATIVA, false);
  const tela = ler("../../src/components/ParceirosPiloto.jsx");
  assert.match(tela, /function CotacaoSimulada/);
  // todo uso da cotação na tela passa pela chave
  for (const uso of tela.match(/<CotacaoSimulada|<CotacoesRecebidas/g)) assert.ok(uso);
  assert.equal((tela.match(/COTACAO_INTERNA_ATIVA && (cotando|gerencia|parceiro\.modalidades)/g) || []).length, 4);
  assert.match(tela, /const podeCotar = COTACAO_INTERNA_ATIVA &&/);
  assert.doesNotMatch(tela, /Modalidades de negócio/);
});

test("contato direto: WhatsApp, telefone, e-mail e site", () => {
  assert.equal(linkTelefone("(11) 3333-4444"), "tel:+551133334444");
  assert.equal(linkTelefone("123"), "");
  assert.equal(linkEmail("vendas@exemplo.com.br"), "mailto:vendas@exemplo.com.br");
  assert.equal(linkEmail("sem arroba"), "");
  assert.equal(linkSite("www.exemplo.com.br"), "https://www.exemplo.com.br");
  assert.equal(linkSite("http://x.com"), "http://x.com");
  assert.equal(linkWhatsapp("11 98888-7777"), "https://wa.me/5511988887777");
  assert.equal(parceiroEmBranco().telefone, "");
  const servico = ler("../../src/services/parceirosService.js");
  assert.match(servico, /"whatsapp", "telefone", "email_comercial"/);
});

test("segmentos de todas as linhas automotivas", () => {
  for (const s of ["Linha leve", "Linha pesada", "Motos", "Agrícola", "Náutica", "Máquinas e linha amarela"]) {
    assert.ok(SEGMENTOS_AUTOMOTIVOS.includes(s), s);
  }
});

test("pesquisa por descrição/aplicação só quando há palavra", () => {
  assert.equal(termoParaTexto("bomba gol"), "bomba gol");
  assert.equal(termoParaTexto("Palio"), "Palio");
  assert.equal(termoParaTexto("DP-1003"), "");
  assert.equal(termoParaTexto("0580454001"), "");
  assert.equal(termoParaTexto("DOX-0109"), "");
});

test("validação: três níveis e resumo dos pendentes", () => {
  assert.deepEqual(Object.keys(NIVEIS_VALIDACAO), ["sem_divergencia", "conferir", "conflito"]);
  const itens = [
    { id: "a", situacao_tecnica: "pendente" },
    { id: "b", situacao_tecnica: "pendente" },
    { id: "c", situacao_tecnica: "pendente" },
    { id: "d", situacao_tecnica: "aprovado" },
  ];
  const v = new Map([["b", { nivel: "conferir" }], ["c", { nivel: "conflito" }], ["d", { nivel: "conflito" }]]);
  assert.deepEqual(resumoValidacao(itens, v, { somentePendentes: true }), { sem_divergencia: 1, conferir: 1, conflito: 1 });
});

test("banco: lote só sem divergência, suspeito exige conferência, base oficial só lida", () => {
  const sql = ler("../../supabase/staging-piloto/20261127b_parceiros_validacao_busca.sql");
  assert.match(sql, /where v\.nivel = 'sem_divergencia'/);
  assert.match(sql, /registre a conferência técnica antes de aprovar/);
  assert.match(sql, /join public\.catalogo_chaves c/);
  // nunca grava na base técnica oficial
  assert.doesNotMatch(sql, /(insert into|update|delete from)\s+public\.catalogo_(chaves|pecas|mestre)/i);
  assert.match(sql, /security invoker/); // a pesquisa respeita o RLS de quem pesquisa
  const tela = ler("../../src/components/ParceirosPiloto.jsx");
  assert.match(tela, /Conferir e aprovar/);
  assert.match(tela, /Aprovar os sem divergência/);
});

test("números fictícios (DDD 0) não viram link de WhatsApp nem de telefone", () => {
  assert.equal(linkWhatsapp("(00) 0000-0001"), "");
  assert.equal(linkTelefone("(00) 90000-0002"), "");
  assert.equal(linkWhatsapp("+55 (21) 3333-4444"), "https://wa.me/552133334444");
});

test("modelo final: vendedores na pesquisa e lista de montadoras/modelos automática", () => {
  const tela = ler("../../src/components/ParceirosPiloto.jsx");
  assert.match(tela, /data-testid="vendedores-na-pesquisa"/);
  const sql = ler("../../supabase/staging-piloto/20261127b_parceiros_validacao_busca.sql");
  // atualização automática pelo agendador do banco, fora da tela (limite de 8 s dos usuários)
  assert.match(sql, /cron\.schedule\('paiia-parceiros-vocabulario', '\*\/15 \* \* \* \*', 'select public\.parceiros_garantir_vocabulario\(\)'\)/);
  assert.match(sql, /pg_stat_user_tables/);
  assert.match(sql, /revoke all on function public\.parceiros_recalcular_vocabulario\(\) from anon, public, authenticated/);
  // nenhum gatilho nas tabelas oficiais
  assert.doesNotMatch(sql, /create trigger [\s\S]{0,80} on public\.catalogo_/i);
});

test("publicação: área ligada na produção, sem dado fictício", async () => {
  const cfg = await import("../../src/config/parceirosPiloto.js");
  assert.equal(cfg.PARCEIROS_NA_PRODUCAO, true); // publicado com autorização do Edgar (27/11)
  assert.equal(cfg.pilotoParceirosAtivo("producao", false), false);
  assert.equal(cfg.pilotoParceirosAtivo("producao", true), true);
  assert.equal(cfg.pilotoParceirosAtivo("staging"), true);
  assert.equal(cfg.modoTesteParceiros("producao"), false);
  assert.equal(cfg.modoTesteParceiros("staging"), true);
  const servico = ler("../../src/services/parceirosService.js");
  assert.match(servico, /registro\.ficticio = ambienteSupabase !== "producao"/);
  const tela = ler("../../src/components/ParceirosPiloto.jsx");
  assert.match(tela, /\{EM_TESTE && <span className="pp-selo">PILOTO · TESTE · DADOS FICTÍCIOS<\/span>\}/);
  const prod = ler("../../supabase/producao-parceiros/01_parceiros_producao.sql");
  assert.doesNotMatch(prod, /00000000-0000-4000-a000-000000000001|exemplo\.invalid|EXEMPLO-\d/);
  assert.doesNotMatch(prod, /insert into public\.parceiros \(|insert into public\.parceiro_catalogo_itens/);
  assert.match(prod, /check \(ficticio = false\)/);
  assert.equal((prod.match(/insert into public\.parceiros_admins/g) || []).length, 1);
  assert.match(prod, /PAIIA Parceiros já existe neste banco/);
  const rev = ler("../../supabase/producao-parceiros/99_reversao_parceiros.sql");
  assert.doesNotMatch(rev, /drop table/i); // reversão guarda os dados, não apaga
  assert.doesNotMatch(rev, /catalogo_(pecas|chaves|mestre)/);
});

test("cadastro: olhinho na senha e na confirmação; link de confirmação volta para o site oficial", () => {
  const login = ler("../../src/components/Login.jsx");
  assert.match(login, /type=\{mostrarSenha \? "text" : "password"\}/); // login (já existia)
  assert.match(login, /type=\{mostrarSenhaCadastro \? "text" : "password"\}/);
  assert.match(login, /type=\{mostrarConfirmacao \? "text" : "password"\}/);
  assert.equal((login.match(/data-paiia-cadastro-olho=/g) || []).length, 2);
  const app = ler("../../src/App.jsx");
  assert.match(app, /emailRedirectTo:\s*ambienteSupabase === "producao"\s*\?\s*"https:\/\/www\.paiia\.com\.br"/);
  const prod = ler("../../supabase/producao-parceiros/01_parceiros_producao.sql");
  assert.match(prod, /lower\(email\) = 'comercial@casadainjecaosp\.com\.br' and email_confirmed_at is not null/);
  assert.doesNotMatch(prod, /597ee814/); // conta de uso diário nunca vira administradora
});

test("visitante sem conta não consulta a área de parceiros; frase de teste só fora da produção", () => {
  const cat = ler("../../src/components/Catalogos.jsx");
  assert.match(cat, /const parceirosVisiveis = PILOTO_PARCEIROS && logado;/);
  assert.match(cat, /\{parceirosVisiveis && <ParceirosPiloto \/>\}/);
  assert.match(cat, /\{parceirosVisiveis && ITENS_DISTRIBUIDOR_ATIVO && <ParceirosNaPesquisa/);
  assert.match(cat, /data-testid="parceiros-visitante"/);
  const tela = ler("../../src/components/ParceirosPiloto.jsx");
  assert.match(tela, /\{EM_TESTE && " Sem cobrança real\."\}/);
});

test("distribuidores: só nome, logotipo e link do catálogo online; nada entra na base nem na pesquisa", async () => {
  const cfg = await import("../../src/config/parceirosPiloto.js");
  assert.equal(cfg.ITENS_DISTRIBUIDOR_ATIVO, false);
  assert.equal(cfg.linkCatalogoParceiro({ catalogo_url: "www.dist.com.br/catalogo", site: "dist.com.br" }), "https://www.dist.com.br/catalogo");
  assert.equal(cfg.linkCatalogoParceiro({ site: "dist.com.br" }), "https://dist.com.br");
  assert.equal(cfg.linkCatalogoParceiro({}), "");
  const cat = ler("../../src/components/Catalogos.jsx");
  assert.match(cat, /parceirosVisiveis && ITENS_DISTRIBUIDOR_ATIVO && <ParceirosNaPesquisa/);
  assert.match(cat, /aoPesquisar=\{parceirosVisiveis && ITENS_DISTRIBUIDOR_ATIVO \? setPesquisaParceiros : null\}/);
  const tela = ler("../../src/components/ParceirosPiloto.jsx");
  assert.match(tela, /\{ITENS_DISTRIBUIDOR_ATIVO && <CatalogoDoParceiro/);
  assert.match(tela, /\{!ITENS_DISTRIBUIDOR_ATIVO \? null : p\.id \?/); // envio de arquivo/itens desligado
  assert.match(tela, /target="_blank" rel="noopener noreferrer" className="pp-cartao"/);
  // usuário comum não abre o perfil com contatos: só admin e o próprio parceiro
  assert.match(tela, /modo === "ver" && aberto && \(papel\.admin \|\| papel\.parceiros\.includes\(aberto\.id\)\)/);
});
