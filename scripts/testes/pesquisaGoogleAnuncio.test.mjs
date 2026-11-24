// =============================================================
// PAIIA — TESTES: pré-montagem pelo Google no "Buscar e Montar" (24/11/2026).
// Fixture = resultados REAIS de UMA busca no Google pelo 307941822A (+ 1 Shopee
// e 1 resultado sem o código, que devem ser ignorados). Nada vai à rede.
//   node --test scripts/testes/pesquisaGoogleAnuncio.test.mjs
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { register } from "node:module";

register("./simulacao/ganchoSupabaseFalso.mjs", import.meta.url);
const G = await import("../../src/services/pesquisaGoogleAnuncio.js");
const F = await import("../../src/services/fontesAnuncioProvisorio.js");
const { FONTE, temMarcaAConfirmar } = await import("../../src/services/anuncioProvisorio.js");
const ler = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const FIX = JSON.parse(ler("scripts/testes/fixtures/google-307941822A.json"));
const COD = "307941822A";

test("307941822A: título como o modelo aprovado", () => {
  const r = G.montarPeloGoogle({ codigo: COD, resultados: FIX.resultados, quando: "2026-11-24T12:00:00Z" });
  assert.equal(r.titulo, "Caixa De Fusíveis VW Santana Quantum 307941822A");
  assert.ok(r.titulo.length <= 60);
});

test("só o que está escrito: Santana e Quantum (várias fontes) entram; Gol (1 fonte), anos e motores ficam [A CONFIRMAR]", () => {
  const { descricao, org } = G.montarPeloGoogle({ codigo: COD, resultados: FIX.resultados, quando: "2026-11-24T12:00:00Z" });
  assert.deepEqual(org.modelos.map((m) => m.nome), ["Santana", "Quantum"]);
  assert.ok(org.modelos.every((m) => m.fontes >= 2));
  assert.match(descricao, /\[A CONFIRMAR\] VW Gol \(citado em apenas 1 fonte\)/);
  assert.match(descricao, /\[A CONFIRMAR\] Motores citados: 1\.8, 2\.0/);
  assert.match(descricao, /\[A CONFIRMAR\] Anos citados \(as fontes divergem\)/);
  assert.match(descricao, /CÓDIGOS DE REFERÊNCIA\n307941822A · 307\.941\.822\.A\n/);
  assert.ok(temMarcaAConfirmar(descricao), "a descrição bloqueia a publicação até ser conferida");
  // Cada modelo do título aparece escrito em pelo menos 2 resultados.
  for (const m of org.modelos) assert.ok(FIX.resultados.filter((r) => r.titulo.includes(m.nome)).length >= 2);
});

test("Shopee e resultados sem o código são ignorados; links sem rastreamento; Mercado Livre identificado", () => {
  const { descricao, org } = G.montarPeloGoogle({ codigo: COD, resultados: FIX.resultados });
  assert.ok(!org.fontes.some((f) => /shopee/.test(f.link)));
  assert.ok(!org.fontes.some((f) => /exemplo\.com\.br/.test(f.link)));
  assert.ok(!/srsltid/.test(descricao));
  assert.equal(org.fontes.filter((f) => f.ml).length, 2);
  assert.match(descricao, /FONTES CONSULTADAS \(Google/);
  assert.match(descricao, /- Mercado Livre: Caixa Fusível Santana Quantum 00/);
  assert.ok(!/18x11x10/.test(descricao), "medida só da Shopee não entra");
});

test("a padronização de texto do PAIIA não altera seções nem linhas de fonte da pré-montagem", async () => {
  const { padronizarDescricao } = await import("../../src/services/padronizarTextoAnuncio.js");
  const d = G.montarPeloGoogle({ codigo: COD, resultados: FIX.resultados, quando: "2026-11-24T12:00:00Z" }).descricao;
  assert.equal(padronizarDescricao(d), d);
});

test("Google França: nome da peça traduzido pelo glossário e marcado; sigla sem tradução fica e marca incompleto", () => {
  assert.deepEqual(G.traduzirNomePeca("Sonde Lambda"), { texto: "Sonda Lambda", completo: true, original: "Sonde Lambda" });
  assert.equal(G.traduzirNomePeca("Boîte à fusibles").texto, "Caixa de Fusíveis");
  assert.equal(G.traduzirNomePeca("Capteur PMH").texto, "Sensor PMH");
  assert.equal(G.traduzirNomePeca("Capteur PMH").completo, false);
  const res = [
    { titulo: "Sonde lambda Renault Clio III 1.2 8200986579", trecho: "Sonde lambda origine Renault 8200986579", link: "https://www.a.fr/x", idioma: "fr" },
    { titulo: "8200986579 Sonde Lambda Renault Modus Clio", trecho: "Référence 8200986579, compatible Clio III", link: "https://www.b.fr/y", idioma: "fr" },
  ];
  const r = G.montarPeloGoogle({ codigo: "8200986579", resultados: res });
  assert.equal(r.titulo, "Sonda Lambda Renault Clio 8200986579");
  assert.match(r.descricao, /\[A CONFIRMAR\] Nome traduzido do francês \(original: "Sonde Lambda"\)/);
  assert.match(r.descricao, /FONTES CONSULTADAS \(Google França/);
  assert.ok(!/Renault III/.test(r.descricao), "algarismo romano não vira modelo");
});

test("função: França só quando o Brasil não cita o código; no máximo 2 buscas; não repete o Brasil", () => {
  const s = ler("supabase/functions/paiia-pesquisa-google/index.ts");
  assert.match(s, /if \(!guardada\) \{\s*const br = await buscar\("br"/);
  assert.match(s, /if \(!cita\(resultados\)\) \{\s*const fr = await buscar\("fr"/);
  assert.match(s, /if \(guardada && \(guardada\.status === "encontrado" \|\| tentouFranca\)\)/);
});

test("90469560 (resultados reais): marcas, lojas e fabricantes de peça não viram modelo; siglas e acentos certos", () => {
  const F2 = JSON.parse(ler("scripts/testes/fixtures/google-90469560.json"));
  const { titulo, descricao, org } = G.montarPeloGoogle({ codigo: "90469560", resultados: F2.resultados });
  assert.equal(titulo, "Válvula EGR GM Vectra Omega 90469560");
  const todos = [...org.modelos, ...org.modelosAConfirmar].map((m) => m.nome.toLowerCase());
  for (const x of ["opel", "vauxhall", "autodoc", "rrr", "bogap", "delphi"]) assert.ok(!todos.includes(x), `${x} não é modelo`);
  assert.ok(!/CARACTERÍSTICAS ENCONTRADAS/.test(descricao), "\"0 V\" e \"16V\" não viram característica");
});

test("sem resultado útil: título vazio (nada é inventado)", () => {
  assert.equal(G.montarPeloGoogle({ codigo: COD, resultados: [] }).titulo, "");
  assert.equal(G.montarPeloGoogle({ codigo: COD, resultados: [{ titulo: "Kit Embreagem Gol", trecho: "sem código", link: "https://x.com.br/a" }] }).titulo, "");
});

test("provisório: Google só entra sem ficha/anúncio nosso; falha da pesquisa mantém o provisório anterior", () => {
  const base = { fonte: FONTE.NENHUMA, rotulo: "", titulo: "", descricao: "INFORMAÇÕES CONFIRMADAS\nCódigo: X", provisorio: true };
  const ok = F.provisorioComGoogle(base, { codigo: COD, g: { ok: true, resultados: FIX.resultados, reaproveitada: true, buscado_em: "2026-11-24T12:00:00Z" } });
  assert.equal(ok.fonte, FONTE.GOOGLE);
  assert.equal(ok.titulo, "Caixa De Fusíveis VW Santana Quantum 307941822A");
  assert.match(ok.rotulo, /pesquisa no Google \(\d+ fontes, 2 do Mercado Livre, reaproveitada\)/);
  const falhou = F.provisorioComGoogle(base, { codigo: COD, g: { ok: false, resultados: [], erro: "limite" } });
  assert.equal(falhou.fonte, FONTE.NENHUMA);
  assert.equal(falhou.titulo, "");
  assert.equal(falhou.googleErro, "limite");
});

test("montarProvisorioDasFontes só chama o Google quando pedido (sem catálogo)", () => {
  const s = ler("src/services/fontesAnuncioProvisorio.js");
  assert.match(s, /if \(!pesquisarGoogle \|\| prov\.fonte === FONTE\.FICHA \|\| prov\.fonte === FONTE\.ML\) return prov;/);
  const na = ler("src/components/NovoAnuncio.jsx");
  assert.match(na, /montarProvisorioDasFontes\(\{ codigo: codigoFinal, contas, fichaAtualId: fichaNovo\.fichaId \|\| "", pesquisarGoogle: semCatalogo \}\)/);
});

test("a pesquisa do Paizinho (mesma tabela) nunca reaproveita uma linha do Google", async () => {
  const A = await import("../../src/services/paizinhoPesquisa/auditoriaPesquisaExterna.js");
  const linhas = [
    { id: "g", codigo_normalizado: "307941822A", provedor: "serpapi_google", status: "encontrado", status_validacao: "pendente_validacao", criado_em: new Date().toISOString() },
    { id: "p", codigo_normalizado: "0258003300", provedor: "edge", status: "encontrado", status_validacao: "pendente_validacao", criado_em: new Date().toISOString() },
  ];
  const cliente = { from: () => {
    let r = [...linhas];
    const q = {
      select: () => q, order: () => q, limit: () => Promise.resolve({ data: r, error: null }),
      eq: (c, v) => ((r = r.filter((x) => x[c] === v)), q),
      in: (c, v) => ((r = r.filter((x) => v.includes(x[c]))), q),
      neq: (c, v) => ((r = r.filter((x) => x[c] != null && x[c] !== v)), q),
      gte: (c, v) => ((r = r.filter((x) => String(x[c]) >= v)), q),
      or: (f) => { assert.equal(f, "provedor.is.null,provedor.neq.serpapi_google"); r = r.filter((x) => x.provedor == null || x.provedor !== "serpapi_google"); return q; },
    };
    return q;
  } };
  const vazio = { getItem: () => null, setItem: () => {} };
  assert.equal(await A.buscarPesquisaRecente("307941822A", { cliente, armazenamento: vazio }), null);
  assert.equal((await A.buscarPesquisaRecente("0258003300", { cliente, armazenamento: vazio }))?.id, "p");
});

test("função do servidor: login, reaproveitamento 30 dias, limite diário, 1 busca, chave nunca devolvida", () => {
  const s = ler("supabase/functions/paiia-pesquisa-google/index.ts");
  assert.match(s, /admin\.auth\.getUser\(jwt\)/);
  assert.match(s, /const VALIDADE_DIAS = 30;/);
  assert.match(s, /LIMITE_DIARIO/);
  assert.equal((s.match(/serpapi\.com\/search\.json/g) || []).length, 1, "uma única chamada de busca");
  assert.ok(s.indexOf("reaproveitada: true") < s.indexOf("serpapi.com/search.json"), "reaproveita ANTES de pagar");
  assert.doesNotMatch(s, /responder\(\{[^}]*chave/i, "a chave não vai na resposta");
  assert.match(s, /ehShopee/);
});
