import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  pilotoParceirosAtivo,
  pendenciasAprovacao,
  parceiroVisivel,
  codigosParaParceiros,
  agruparItensPorParceiro,
  formatarMensalidade,
  linkWhatsapp,
  CRITERIOS_SELECAO,
  MENSALIDADE_FICTICIA_CENTAVOS,
  perfilParaParceiro,
  rotuloPerfil,
  lerListaDeItens,
} from "../../src/config/parceirosPiloto.js";

const todosCriterios = Object.fromEntries(CRITERIOS_SELECAO.map((c) => [c.id, true]));
const ativo = (extra = {}) => ({
  id: "a", nome_fantasia: "Alfa", situacao: "ativo", criterios: todosCriterios, catalogo_autorizado: true,
  vigencia_inicio: "2026-11-01", vigencia_fim: "2027-11-01", ...extra,
});
const hoje = new Date("2026-11-26T12:00:00Z");

test("área ativa no STAGING e, após a publicação autorizada, na produção", () => {
  assert.equal(pilotoParceirosAtivo("staging"), true);
  assert.equal(pilotoParceirosAtivo("producao"), true);
  assert.equal(pilotoParceirosAtivo("producao", false), false);
  assert.equal(pilotoParceirosAtivo("desconhecido"), false);
});

test("mensalidade fictícia de R$ 199,90", () => {
  assert.equal(MENSALIDADE_FICTICIA_CENTAVOS, 19990);
  assert.match(formatarMensalidade(), /199,90/);
});

test("aprovação exige os 6 critérios e a autorização do catálogo", () => {
  assert.deepEqual(pendenciasAprovacao(ativo()), []);
  assert.equal(pendenciasAprovacao(ativo({ criterios: { reputacao: true } })).length, 5);
  assert.ok(pendenciasAprovacao(ativo({ catalogo_autorizado: false })).some((p) => /Autoriza/.test(p)));
});

test("só parceiro ativo, aprovado e na vigência aparece nas pesquisas", () => {
  assert.equal(parceiroVisivel(ativo(), hoje), true);
  assert.equal(parceiroVisivel(ativo({ situacao: "em_analise" }), hoje), false);
  assert.equal(parceiroVisivel(ativo({ situacao: "suspenso" }), hoje), false);
  assert.equal(parceiroVisivel(ativo({ vigencia_fim: "2026-11-25" }), hoje), false);
  assert.equal(parceiroVisivel(ativo({ vigencia_inicio: "2026-12-01" }), hoje), false);
  // (27/11) Os critérios agora ficam só com o administrador; o banco não deixa ativar sem eles.
  assert.ok(pendenciasAprovacao(ativo({ criterios: {} })).length > 0);
});

test("vigência vem do contrato quando ele é lido (o banco também filtra)", () => {
  assert.equal(parceiroVisivel(ativo({ vigencia_fim: null, contrato: { vigencia_fim: "2026-11-01" } }), hoje), false);
  assert.equal(parceiroVisivel(ativo({ vigencia_inicio: null, vigencia_fim: null, contrato: null }), hoje), true);
});

test("códigos para os parceiros: digitado + códigos técnicos encontrados", () => {
  const c = codigosParaParceiros("md-186992", [{ codigo_oem: "DOX-0109" }, { codigo_oem: "DOX-0109" }, { codigo_oem: "" }]);
  assert.deepEqual(c, ["MD186992", "DOX0109"]);
  assert.deepEqual(codigosParaParceiros("ab", []), []);
});

test("ordem dos parceiros é neutra (alfabética) e só os visíveis entram", () => {
  const parceiros = [
    ativo({ id: "z", nome_fantasia: "Zeta", mensalidade_centavos: 99999 }),
    ativo({ id: "a", nome_fantasia: "Alfa" }),
    ativo({ id: "s", nome_fantasia: "Suspensa", situacao: "suspenso" }),
  ];
  const itens = [
    { id: 1, parceiro_id: "z", codigo: "X" },
    { id: 2, parceiro_id: "a", codigo: "X" },
    { id: 3, parceiro_id: "s", codigo: "X" },
    { id: 4, parceiro_id: "a", codigo: "Y", disponivel: false },
  ];
  const g = agruparItensPorParceiro(itens, parceiros, hoje);
  assert.deepEqual(g.map((x) => x.parceiro.nome_fantasia), ["Alfa", "Zeta"]);
  assert.equal(g[0].itens.length, 1);
});

test("WhatsApp fictício (zeros) não vira link", () => {
  assert.equal(linkWhatsapp("(00) 00000-0000"), "");
  assert.equal(linkWhatsapp("(11) 91234-5678"), "https://wa.me/5511912345678");
});

test("perfis: administrador, parceiro (só da própria empresa) e usuário comum", () => {
  assert.equal(perfilParaParceiro({ admin: true, parceiros: [] }, "x"), "admin");
  assert.equal(perfilParaParceiro({ admin: false, parceiros: ["x"] }, "x"), "parceiro");
  assert.equal(perfilParaParceiro({ admin: false, parceiros: ["x"] }, "y"), "usuario");
  assert.equal(perfilParaParceiro({ admin: false, parceiros: [] }, "x"), "usuario");
  assert.equal(rotuloPerfil({ admin: false, parceiros: ["x"] }), "Parceiro comercial");
  assert.equal(rotuloPerfil({ admin: false, parceiros: [] }), "Usuário");
});

test("lista colada pelo parceiro: código ; descrição ; marca ; segmento", () => {
  const l = lerListaDeItens("Código;Descrição\nABC-1 ; Bomba ; Marca X ; Injeção\r\n\nXYZ-2\tFiltro");
  assert.deepEqual(l, [
    { codigo: "ABC-1", descricao: "Bomba", marca: "Marca X", segmento: "Injeção" },
    { codigo: "XYZ-2", descricao: "Filtro", marca: "", segmento: "" },
  ]);
});

test("independência: o piloto nunca grava nos catálogos técnicos nem cobra", () => {
  const servico = fs.readFileSync(new URL("../../src/services/parceirosService.js", import.meta.url), "utf8");
  assert.doesNotMatch(servico, /from\(\s*["']catalogo_(pecas|chaves)["']\s*\)/);
  assert.match(servico, /cobranca_ativa: false/);
  assert.match(servico, /situacao: "simulada"/);
  const sql = fs.readFileSync(new URL("../../supabase/staging-piloto/20261126_parceiros_piloto.sql", import.meta.url), "utf8");
  assert.match(sql, /check \(cobranca_ativa = false\)/);
  assert.match(sql, /check \(situacao = 'simulada'\)/);
  assert.doesNotMatch(sql, /insert into public\.catalogo_/i);
});

test("banco: papéis e travas da etapa 2", () => {
  const sql = fs.readFileSync(new URL("../../supabase/staging-piloto/20261126b_parceiros_papeis.sql", import.meta.url), "utf8");
  assert.match(sql, /create policy parceiros_criar[\s\S]*?parceiros_eh_admin\(\)/);
  assert.match(sql, /Somente o administrador pode aprovar, ativar, suspender ou encerrar/);
  assert.match(sql, /new\.situacao_tecnica := 'pendente'/);
  assert.match(sql, /parceiro_contratos_ver[\s\S]*?parceiros_eh_admin\(\) or public\.parceiros_eh_membro/);
  assert.match(sql, /cobranca_ativa boolean not null default false check \(cobranca_ativa = false\)/);
  assert.match(sql, /parceiro_cotacoes_criar[\s\S]*?situacao = 'simulada'/);
  assert.doesNotMatch(sql, /catalogo_pecas|catalogo_chaves/);
});

test("Catálogos Técnicos mostram a área de parceiros só no STAGING", () => {
  const tela = fs.readFileSync(new URL("../../src/components/Catalogos.jsx", import.meta.url), "utf8");
  assert.match(tela, /pilotoParceirosAtivo\(ambienteSupabase\)/);
  assert.match(tela, /PILOTO_PARCEIROS && <ParceirosPiloto \/>/);
  assert.match(tela, /aoPesquisar=\{PILOTO_PARCEIROS \? setPesquisaParceiros : null\}/);
});
