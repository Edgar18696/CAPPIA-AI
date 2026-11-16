// =============================================================
// PAIIA — TESTES: produto JÁ existente pelo SKU (16/11/2026).
// Caso real: SKU 7527362 (Flange Tampa de Combustível) já no Bling e
// anunciado no ML; o MLB do PARAFUSO (outro SKU) chegou a ser gravado nela.
// Tudo SIMULADO: ML e Bling falsos, Supabase falso em memória.
//   node --test scripts/testes/produtoExistenteSKU.test.mjs
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { register } from "node:module";

register("./simulacao/ganchoSupabaseFalso.mjs", import.meta.url);
const { banco, zerarBanco } = await import("./simulacao/supabaseFalso.mjs");
const { reconhecerSKU, contasParaConsultar } = await import("../../src/services/reconhecimentoSKU.js");
const Q = await import("../../src/services/produtoExistenteSKU.js");
const S = await import("../../src/services/anuncioPublicacaoService.js");
const ler = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

const FLANGE = "7527362";
const LOJA = "1729335019";
const CIEBR = "824312524";
const REV = "2412238242";
const MLB_FLANGE = "MLB7998237230";
const MLB_PARAFUSO = "MLB5560614343";
const SKU_PARAFUSO = "8200642489";

// Anúncio da flange: SKU só na VARIAÇÃO (o anúncio em si não tem seller_custom_field).
const itemFlange = { id: MLB_FLANGE, seller_id: Number(LOJA), status: "active", title: "Flange Tampa De Combustível Uno Elba Fiorino Prêmio", attributes: [], variations: [{ id: 1, attributes: [{ id: "SELLER_SKU", value_name: FLANGE }] }] };
const itemParafuso = { id: MLB_PARAFUSO, seller_id: Number(LOJA), status: "active", title: "Parafuso", seller_custom_field: SKU_PARAFUSO, attributes: [] };

function mlFalso({ itens = [itemFlange, itemParafuso], falhar = [] } = {}) {
  const chamadas = [];
  const consultarML = async (conta, caminho) => {
    chamadas.push({ conta, caminho });
    if (falhar.includes(String(conta))) return { ok: false, erro: "ML fora do ar (simulado)" };
    const daConta = itens.filter((i) => String(i.seller_id) === String(conta));
    const sku = caminho.match(/\/items\/search\?seller_sku=([^&]+)/);
    if (sku) {
      const v = decodeURIComponent(sku[1]);
      return { ok: true, dados: { results: daConta.filter((i) => [i.seller_custom_field, ...(i.variations || []).flatMap((x) => (x.attributes || []).map((a) => a.value_name))].includes(v)).map((i) => i.id) } };
    }
    const q = caminho.match(/\/items\/search\?q=([^&]+)/);
    if (q) return { ok: true, dados: { results: daConta.filter((i) => i.title.includes(decodeURIComponent(q[1]))).map((i) => i.id), paging: { total: 0 } } };
    const it = caminho.match(/^\/items\/(MLB\d+)$/);
    if (it) {
      const x = itens.find((i) => i.id === it[1]);
      return x ? { ok: true, dados: x } : { ok: false, status: 404, erro: "not_found" };
    }
    return { ok: false, erro: `rota não simulada ${caminho}` };
  };
  return { consultarML, chamadas };
}
const bling = { chamadas: 0, ler: async () => { bling.chamadas += 1; return { ok: true, encontrado: true, produto: { id: "16000000001", codigo: FLANGE, nome: "Flange" } }; } };
// Registro interno com o MLB do PARAFUSO gravado por engano no SKU da flange.
const registroComParafuso = async () => ({ ok: true, registros: [{ id: "r1", sku: FLANGE, sku_normalizado: FLANGE, ml_user_id: LOJA, mlb_id: MLB_PARAFUSO, situacao: "ativo" }] });
const contas = contasParaConsultar([{ ml_user_id: LOJA }, { ml_user_id: CIEBR }, { ml_user_id: REV }]);

function fichaFlange({ mlb = "", conta = LOJA, status = "conferencia_aprovada", id = "ficha-flange", atualizada = "2026-11-15T12:00:00Z" } = {}) {
  return { id, codigo: FLANGE, titulo: "Flange Tampa", status_fluxo: status, conta_destino_ml_user_id: conta, updated_at: atualizada, publicacao: mlb ? { ml_user_id: conta, mlb_id: mlb, publicado_em: atualizada } : { ml_user_id: conta, mlb_id: null } };
}
async function reconhecer({ fichas, ml = mlFalso(), lerRegistro = registroComParafuso } = {}) {
  return reconhecerSKU({ codigo: FLANGE, contas, lerBling: bling.ler, lerBase: async () => ({ ok: true, anuncios: fichas }), consultarML: ml.consultarML, lerRegistro });
}
const linha = (q, conta) => q.linhas.find((l) => l.conta === conta);

test("ordem das contas no quadro: LOJA ONLINE, CIEBR, REVELAÇÃO", () => {
  const q = Q.quadroProdutoExistente({ fichas: [fichaFlange()] });
  assert.deepEqual(q.linhas.map((l) => l.nome), ["LOJA ONLINE", "CIEBR", "REVELAÇÃO"]);
});

test("só com as fichas (sem ler o ML): nada é afirmado como 'sem anúncio'; ficha preparada é a fonte", () => {
  const q = Q.quadroProdutoExistente({ fichas: [fichaFlange()] });
  assert.equal(q.existe, true);
  assert.equal(q.fonte.id, "ficha-flange");
  assert.equal(linha(q, LOJA).estado, Q.ESTADO_QUADRO.EM_ANDAMENTO);
  for (const c of [CIEBR, REV]) assert.equal(linha(q, c).estado, Q.ESTADO_QUADRO.INCOMPLETA);
  assert.equal(Q.acaoDaConta(linha(q, CIEBR), q.fonte).tipo, "nenhuma");
});

test("7527362: flange anunciada na LOJA ONLINE (SKU na VARIAÇÃO); MLB do parafuso separado e nunca usado", async () => {
  const fichas = [fichaFlange()];
  const r = await reconhecer({ fichas });
  const q = Q.quadroProdutoExistente({ fichas, reconhecimento: r });
  const loja = linha(q, LOJA);
  assert.equal(loja.estado, Q.ESTADO_QUADRO.ANUNCIADA);
  assert.deepEqual(loja.anuncios.map((a) => a.mlb), [MLB_FLANGE]);
  assert.deepEqual(loja.outraPeca.map((o) => o.mlb), [MLB_PARAFUSO]);
  assert.match(loja.outraPeca[0].motivo, /OUTRO SKU/);
  assert.equal(linha(q, CIEBR).estado, Q.ESTADO_QUADRO.DISPONIVEL);
  assert.equal(linha(q, REV).estado, Q.ESTADO_QUADRO.DISPONIVEL);
  assert.equal(q.bling.estado, "encontrado");
  assert.equal(q.bling.produto.id, "16000000001");
  // Ficha ainda sem MLB (o do parafuso foi retirado): conta nova = abrir a ficha preparada e escolher a conta.
  const a = Q.acaoDaConta(linha(q, CIEBR), q.fonte);
  assert.deepEqual([a.tipo, a.ficha], ["abrir", "ficha-flange"]);
  assert.equal(Q.acaoDaConta(loja, q.fonte).tipo, "nenhuma", "conta já anunciada: nada de duplicar");
});

test("ficha publicada com o MLB da flange: CIEBR/REVELAÇÃO aproveitam os dados (preparar ficha)", async () => {
  const fichas = [fichaFlange({ mlb: MLB_FLANGE, status: "publicado" })];
  const q = Q.quadroProdutoExistente({ fichas, reconhecimento: await reconhecer({ fichas }) });
  assert.equal(q.fonte.publicada, true);
  assert.equal(q.fonte.mlb, MLB_FLANGE);
  for (const c of [CIEBR, REV]) {
    const a = Q.acaoDaConta(linha(q, c), q.fonte);
    assert.deepEqual([a.tipo, a.ficha, a.conta], ["preparar", "ficha-flange", c]);
  }
});

test("ficha com o MLB do PARAFUSO gravado: não vira fonte 'publicada' e o MLB aparece como de outra peça", async () => {
  const fichas = [fichaFlange({ mlb: MLB_PARAFUSO, status: "publicado" })];
  const q = Q.quadroProdutoExistente({ fichas, reconhecimento: await reconhecer({ fichas, lerRegistro: async () => ({ ok: true, registros: [] }) }) });
  const loja = linha(q, LOJA);
  assert.deepEqual(loja.anuncios.map((a) => a.mlb), [MLB_FLANGE]);
  assert.ok(loja.outraPeca.some((o) => o.mlb === MLB_PARAFUSO && o.ficha === "ficha-flange"));
  assert.equal(q.fonte.publicada, false, "nunca aproveita como publicada pelo MLB de outra peça");
  assert.equal(Q.acaoDaConta(linha(q, CIEBR), q.fonte).tipo, "abrir");
});

test("conta com ML fora do ar: 'não conferida' e nenhuma ação (nunca vira 'sem anúncio')", async () => {
  const fichas = [fichaFlange({ mlb: MLB_FLANGE, status: "publicado" })];
  const q = Q.quadroProdutoExistente({ fichas, reconhecimento: await reconhecer({ fichas, ml: mlFalso({ falhar: [CIEBR] }) }) });
  assert.equal(linha(q, CIEBR).estado, Q.ESTADO_QUADRO.INCOMPLETA);
  assert.equal(Q.acaoDaConta(linha(q, CIEBR), q.fonte).tipo, "nenhuma");
  assert.equal(linha(q, REV).estado, Q.ESTADO_QUADRO.DISPONIVEL);
});

test("anúncio parecido (mesmo código no título, SKU diferente) na conta: 'conferir', sem ação", async () => {
  const parecido = { id: "MLB7000000001", seller_id: Number(REV), status: "active", title: `Flange ${FLANGE} tampa`, seller_custom_field: "X-1", attributes: [] };
  const fichas = [fichaFlange({ mlb: MLB_FLANGE, status: "publicado" })];
  const q = Q.quadroProdutoExistente({ fichas, reconhecimento: await reconhecer({ fichas, ml: mlFalso({ itens: [itemFlange, parecido] }) }) });
  assert.equal(linha(q, REV).estado, Q.ESTADO_QUADRO.CONFERIR);
  assert.equal(Q.acaoDaConta(linha(q, REV), q.fonte).tipo, "nenhuma");
});

test("ficha de outra conta em andamento: abre a ficha dela (não cria outra)", async () => {
  const fichas = [fichaFlange({ mlb: MLB_FLANGE, status: "publicado" }), fichaFlange({ id: "ficha-ciebr", conta: CIEBR, status: "conferencia_aprovada" })];
  const q = Q.quadroProdutoExistente({ fichas, reconhecimento: await reconhecer({ fichas }) });
  const a = Q.acaoDaConta(linha(q, CIEBR), q.fonte);
  assert.deepEqual([linha(q, CIEBR).estado, a.tipo, a.ficha], [Q.ESTADO_QUADRO.EM_ANDAMENTO, "abrir", "ficha-ciebr"]);
});

test("fichasExistentes: ignora canceladas e a ficha aberta agora", () => {
  const l = Q.fichasExistentes([fichaFlange({ id: "a" }), { ...fichaFlange({ id: "b" }), status_fluxo: "cancelado" }, fichaFlange({ id: "atual" })], "atual");
  assert.deepEqual(l.map((f) => f.id), ["a"]);
});

test("reconhecimento só lê ML e Bling: nenhuma função de criar/publicar chamada", async () => {
  const ml = mlFalso();
  await reconhecer({ fichas: [fichaFlange()], ml });
  assert.ok(ml.chamadas.every((c) => c.caminho.startsWith("/users/") || c.caminho.startsWith("/items/")));
  assert.ok(ml.chamadas.some((c) => String(c.conta) === CIEBR) && ml.chamadas.some((c) => String(c.conta) === REV), "as 3 contas lidas");
});

test("aproveitar para CIEBR (base falsa): ficha nova com os mesmos dados, sem MLB nem Bling da LOJA; nada externo", async () => {
  zerarBanco();
  const fotos = [{ url: "https://exemplo.invalid/flange-1.jpg" }];
  const ap = await S.salvarFichaAprovada({ anuncioId: "", codigo: FLANGE, titulo: "Flange Tampa", dadosConferencia: { versao: 2, anuncio: { codigo: FLANGE, titulo: "Flange Tampa", descricao: "Descrição preparada", fotos } } });
  await S.salvarContaDestino({ anuncioId: ap.anuncioId, codigo: FLANGE, titulo: "Flange Tampa", contaId: LOJA, contaNome: "LOJA ONLINE" });
  await S.registrarMLBPublicado({ anuncioId: ap.anuncioId, contaId: LOJA, mlb: MLB_FLANGE, sku: FLANGE, blingProdutoId: "16000000001", registro: { mlb: MLB_FLANGE, bling_produto_id: "16000000001" } });
  const r = await S.prepararFichaOutraConta({ anuncioId: ap.anuncioId, conta: CIEBR });
  assert.equal(r.ok, true, r.erro);
  const nova = (await S.obterAnuncio(r.anuncioId)).anuncio;
  assert.equal(nova.dados_conferencia.anuncio.descricao, "Descrição preparada");
  assert.deepEqual(nova.dados_conferencia.anuncio.fotos, fotos);
  assert.equal(nova.dados_conferencia.integracao_bling, undefined);
  assert.notEqual(nova.publicacao?.mlb_id, MLB_FLANGE);
  assert.equal(banco.funcoes.length, 0, "nada no ML nem no Bling");
  // Repetir não cria outra ficha.
  const again = await S.prepararFichaOutraConta({ anuncioId: ap.anuncioId, conta: CIEBR });
  assert.equal(again.anuncioId, r.anuncioId);
});

test("Novo Anúncio: 'Buscar' lê as fichas do código ANTES de pesquisar; havendo ficha, nada é apagado", () => {
  const t = ler("src/components/NovoAnuncio.jsx");
  assert.match(t, /buscarEMontarAnuncio=\{buscarComReconhecimento\}/);
  const g = t.slice(t.indexOf("async function buscarComReconhecimento()"), t.indexOf("async function buscarEMontarAnuncio()"));
  const leitura = g.indexOf("lerFichasDoCodigo(");
  const retorno = g.indexOf("setProdutoExistente({ codigo: cod, fichas: outras });");
  assert.ok(leitura > 0 && retorno > leitura);
  assert.ok(g.slice(retorno, g.indexOf("return;", retorno) + 7).includes("return;"), "não segue para a pesquisa");
  assert.match(t, /<ProdutoExistenteSKU[\s\S]*?onPesquisarMesmoAssim=\{pesquisarComoNova\}/);
  const p = ler("src/components/ProdutoExistenteSKU.jsx");
  assert.doesNotMatch(p, /useEffect/, "o painel não consulta ML/Bling sozinho (só pelo botão — regra de 17/10)");
  assert.doesNotMatch(p, /"publicar"|criar_produto/);
});
