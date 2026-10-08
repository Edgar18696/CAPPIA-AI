// =============================================================
// PAIIA — TESTES (08/10/2026): MLB antigo excluído no Mercado Livre não
// bloqueia para sempre; qualquer dúvida continua bloqueando; checagem por
// conta; histórico preservado; Bling existente localizado; vínculo manual.
//   node --test scripts/testes/mlbExcluidoDuplicidade.test.mjs
// Sem rede (Mercado Livre e Bling simulados).
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { register } from "node:module";

register("./simulacao/ganchoSupabaseFalso.mjs", import.meta.url);

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ler = (f) => fs.readFileSync(path.join(RAIZ, f), "utf8");

const { anuncioEncerradoML, situacaoMLBRegistrado, avaliarRegistrosBase, verificarDuplicidadeML, textoMLBAnterior } = await import("../../src/services/duplicidadeML.js");
const { mesclarMLBsAnteriores, CHAVES_PRESERVADAS_FICHA, preservarChavesDaFicha } = await import("../../src/services/anuncioPublicacaoService.js");
const { textoSituacaoMLBAtual } = await import("../../src/services/situacaoMLBAtual.js");
const { passosBling, PASSOS_BLING, AVISO_VINCULO_MANUAL, AVISO_AUTOMATICA } = await import("../../src/services/vinculoBlingPublicacao.js");
const { decidirCriacaoBling } = await import("../../src/services/estoqueBlingPAIIA.js");

const CONTA = "1729335019";
const OUTRA = "824312524";
const MLB = "MLB5351282473";
const item = (extra) => ({ ok: true, status: 200, dados: { id: MLB, seller_id: Number(CONTA), status: "active", sub_status: [], ...extra } });
const sit = (resp, conta = CONTA, mlb = MLB) => situacaoMLBRegistrado({ mlb, conta, resp });

test("closed → libera (encerrado)", () => {
  const s = sit(item({ status: "closed" }));
  assert.equal(s.libera, true);
  assert.equal(anuncioEncerradoML({ status: "closed" }), true);
});

test("inactive + deleted (caso real MLB5351282473) → libera", () => {
  const s = sit(item({ status: "inactive", sub_status: ["forbidden", "deleted"] }));
  assert.equal(s.libera, true);
  assert.equal(s.motivo, "excluído/encerrado no Mercado Livre");
  assert.deepEqual(s.sub_status, ["forbidden", "deleted"]);
});

test("inactive SEM deleted, active, paused, under_review → bloqueiam", () => {
  for (const extra of [{ status: "inactive", sub_status: ["forbidden"] }, { status: "inactive" }, { status: "active" }, { status: "paused" }, { status: "under_review" }]) {
    const s = sit(item(extra));
    assert.equal(s.libera, false, JSON.stringify(extra));
    assert.match(s.motivo, /ainda existe no Mercado Livre nesta conta/);
  }
});

test("não encontrado (404) → bloqueia (não é tratado como excluído)", () => {
  const s = sit({ ok: false, status: 404, erro: "Item with id MLB5351282473 not found" });
  assert.equal(s.libera, false);
  assert.match(s.motivo, /não encontrou este MLB \(não é tratado como excluído\)/);
});

test("erro de API, token, timeout, resposta vazia → bloqueia", () => {
  for (const resp of [{ ok: false, status: 500, erro: "Erro interno" }, { ok: false, status: 401, erro: "invalid access token" }, { ok: false, erro: "timeout" }, null, undefined, {}]) {
    const s = sit(resp);
    assert.equal(s.libera, false, JSON.stringify(resp));
    assert.match(s.motivo, /não foi possível confirmar|não encontrou/);
  }
});

test("vendedor diferente → bloqueia, mesmo excluído", () => {
  const s = sit(item({ seller_id: Number(OUTRA), status: "closed" }));
  assert.equal(s.libera, false);
  assert.match(s.motivo, /vendedor diferente/);
});

test("resposta ambígua (outro MLB, sem status) e registro sem MLB → bloqueiam", () => {
  assert.equal(sit({ ok: true, dados: { id: "MLB1", seller_id: Number(CONTA), status: "closed" } }).libera, false);
  assert.equal(sit({ ok: true, dados: { id: MLB, seller_id: Number(CONTA) } }).libera, false);
  assert.equal(situacaoMLBRegistrado({ mlb: "", conta: CONTA, resp: item({ status: "closed" }) }).libera, false);
  assert.equal(situacaoMLBRegistrado({ mlb: MLB, conta: "", resp: item({ status: "closed" }) }).libera, false);
});

const REG = [{ id: "p1", anuncio_id: "0e114aeb", ml_user_id: CONTA, mlb_id: MLB, status_publicacao: "publicado" }];

test("base × ML: conferindo bloqueia; excluído confirmado libera com o texto do histórico", () => {
  assert.equal(avaliarRegistrosBase({ registros: REG, ml: null }).estado, "conferindo");
  assert.equal(avaliarRegistrosBase({ registros: REG, ml: { carregando: true } }).estado, "conferindo");
  const conf = { ...sit(item({ status: "inactive", sub_status: ["deleted"] })), mlb: MLB };
  const av = avaliarRegistrosBase({ registros: REG, ml: { verificado: true, duplicados: [], possiveis: [], conferidosBase: [conf] } });
  assert.equal(av.estado, "ok");
  assert.equal(av.anteriores[0].texto, "MLB anterior: MLB5351282473 — excluído/encerrado no Mercado Livre — não bloqueia nova publicação.");
  assert.equal(textoMLBAnterior({ mlb: MLB }), av.anteriores[0].texto);
});

test("base × ML: erro na consulta ou MLB não conferido continuam bloqueando", () => {
  assert.equal(avaliarRegistrosBase({ registros: REG, ml: { erro: "token expirado" } }).estado, "bloqueia");
  assert.equal(avaliarRegistrosBase({ registros: REG, ml: { verificado: true, duplicados: [], possiveis: [], conferidosBase: [] } }).estado, "bloqueia");
  const naoAchou = { ...sit({ ok: false, status: 404, erro: "not found" }), mlb: MLB };
  const av = avaliarRegistrosBase({ registros: REG, ml: { verificado: true, duplicados: [], possiveis: [], conferidosBase: [naoAchou] } });
  assert.equal(av.estado, "bloqueia");
  assert.match(av.pendentes[0].motivo, /não encontrou/);
});

// Mercado Livre simulado: busca por conta + itens.
function mlFalso({ itens, buscaSku = {}, buscaLivre = {} }) {
  const chamadas = [];
  const consultar = async (caminho) => {
    chamadas.push(caminho);
    const m = caminho.match(/^\/users\/(\d+)\/items\/search\?(seller_sku|q)=([^&]+)/);
    if (m) {
      const [, conta, tipo] = m;
      const ids = (tipo === "seller_sku" ? buscaSku : buscaLivre)[conta] || [];
      return { ok: true, dados: { results: ids, paging: { total: ids.length } } };
    }
    const i = caminho.match(/^\/items\/(MLB\d+)$/);
    if (i) return itens[i[1]] ? { ok: true, dados: itens[i[1]] } : { ok: false, status: 404, erro: "not found" };
    return { ok: false, erro: "fora do teste" };
  };
  return { consultar, chamadas };
}

test("busca de duplicidade: anúncio excluído (inactive+deleted) achado pela busca não bloqueia", async () => {
  const { consultar } = mlFalso({ itens: { [MLB]: { id: MLB, seller_id: Number(CONTA), status: "inactive", sub_status: ["forbidden", "deleted"], attributes: [{ id: "SELLER_SKU", value_name: "8200442891" }], title: "Anel" } }, buscaSku: { [CONTA]: [MLB] } });
  const r = await verificarDuplicidadeML({ conta: CONTA, codigos: ["8200442891"], consultar });
  assert.equal(r.verificado, true);
  assert.deepEqual(r.duplicados, []);
});

test("MLB antigo excluído + OUTRO MLB ativo do mesmo SKU na mesma conta → BLOQUEIA e mostra o MLB encontrado", async () => {
  const NOVO = "MLB9998887776";
  const { consultar } = mlFalso({
    itens: {
      [MLB]: { id: MLB, seller_id: Number(CONTA), status: "inactive", sub_status: ["deleted"], attributes: [{ id: "SELLER_SKU", value_name: "8200442891" }] },
      [NOVO]: { id: NOVO, seller_id: Number(CONTA), status: "active", attributes: [{ id: "SELLER_SKU", value_name: "8200442891" }], title: "Anel de vedação" },
    },
    buscaSku: { [CONTA]: [MLB, NOVO] },
  });
  const r = await verificarDuplicidadeML({ conta: CONTA, codigos: ["8200442891"], consultar });
  assert.deepEqual(r.duplicados.map((d) => d.id), [NOVO]);
  // e a avaliação da base, mesmo com o MLB antigo confirmado excluído, não esconde o duplicado
  const conf = { ...sit({ ok: true, dados: { id: MLB, seller_id: Number(CONTA), status: "inactive", sub_status: ["deleted"] } }), mlb: MLB };
  assert.equal(avaliarRegistrosBase({ registros: REG, ml: { ...r, conferidosBase: [conf] } }).estado, "ok");
  assert.equal(r.duplicados.length > 0, true, "duplicado real continua bloqueando (item 'Duplicidade na conta')");
});

test("duplicidade é POR CONTA: anúncio ativo do SKU em OUTRA conta não bloqueia esta", async () => {
  const OUTRO = "MLB1112223334";
  const { consultar, chamadas } = mlFalso({
    itens: { [OUTRO]: { id: OUTRO, seller_id: Number(OUTRA), status: "active", attributes: [{ id: "SELLER_SKU", value_name: "8200442891" }] } },
    buscaSku: { [OUTRA]: [OUTRO] },
  });
  const r = await verificarDuplicidadeML({ conta: CONTA, codigos: ["8200442891"], consultar });
  assert.deepEqual(r.duplicados, []);
  assert.ok(chamadas.every((c) => !c.includes(`/users/${OUTRA}/`)), "nunca busca na outra conta");
  // item de outra conta que aparecesse na busca desta conta é ignorado
  const m2 = mlFalso({ itens: { [OUTRO]: { id: OUTRO, seller_id: Number(OUTRA), status: "active", attributes: [{ id: "SELLER_SKU", value_name: "8200442891" }] } }, buscaSku: { [CONTA]: [OUTRO] } });
  assert.deepEqual((await verificarDuplicidadeML({ conta: CONTA, codigos: ["8200442891"], consultar: m2.consultar })).duplicados, []);
});

test("histórico do MLB antigo: acrescenta, nunca apaga, não duplica; preservado nas gravações da ficha", () => {
  const um = mesclarMLBsAnteriores([], [{ mlb: MLB, conta: CONTA, status: "inactive", sub_status: ["forbidden", "deleted"], ficha_origem: "0e114aeb" }], "2026-10-08T17:00:00Z");
  assert.equal(um.mudou, true);
  assert.equal(um.lista[0].texto, "MLB anterior: MLB5351282473 — excluído/encerrado no Mercado Livre — não bloqueia nova publicação.");
  assert.equal(um.lista[0].ficha_origem, "0e114aeb");
  const dois = mesclarMLBsAnteriores(um.lista, [{ mlb: MLB, conta: CONTA, status: "closed" }], "2026-10-09T00:00:00Z");
  assert.equal(dois.mudou, false, "o mesmo MLB não é gravado de novo");
  assert.deepEqual(dois.lista, um.lista, "nada é apagado nem reescrito");
  assert.ok(CHAVES_PRESERVADAS_FICHA.includes("mlbs_anteriores"));
  const out = preservarChavesDaFicha({ mlbs_anteriores: um.lista }, { versao: 9, ficha: {} });
  assert.deepEqual(out.mlbs_anteriores, um.lista);
});

test("ficha antiga: tela mostra histórico + situação atual lida do ML, sem reescrever", () => {
  assert.equal(textoSituacaoMLBAtual({ mlb: MLB, conta: CONTA, resp: item({ status: "inactive", sub_status: ["deleted"] }) }).texto, "anúncio excluído/encerrado");
  assert.match(textoSituacaoMLBAtual({ mlb: MLB, conta: CONTA, resp: item({ status: "active" }) }).texto, /^anúncio existe \(active\)/);
  assert.match(textoSituacaoMLBAtual({ mlb: MLB, conta: CONTA, resp: { ok: false, erro: "timeout" } }).texto, /^não foi possível confirmar/);
  const fp = ler("src/components/FichaPublicadaPAIIA.jsx");
  assert.ok(fp.includes("Histórico da ficha:") && fp.includes("Situação atual no Mercado Livre:"));
  assert.equal(/mercadolivre-publicacao|"publicar"|registrarResultadoPublicacao|registrarMLBPublicado|salvarFicha/.test(fp), false, "tela final não publica nem regrava a ficha");
  const svc = ler("src/services/situacaoMLBAtual.js");
  assert.ok(svc.includes('acao: "ml_consulta"') && svc.includes('metodo: "GET"'));
  assert.equal(/"publicar"|validar_item|gravar_|update\(|insert\(/.test(svc), false, "só leitura");
});

test("Publicação: o MLB guardado de outra ficha não bloqueia sozinho; precisa da conferência real no ML", () => {
  const rv = ler("src/components/RevisaoPublicacaoML.jsx");
  assert.equal(rv.includes("Publicar de novo criaria anúncio duplicado"), false);
  assert.equal(rv.includes("Escolha outra conta."), false);
  assert.ok(rv.includes("avaliarRegistrosBase({ registros: duplicidadeBase.registros, ml: duplicidadeML })"));
  assert.ok(rv.includes("avaliarRegistrosBase({ registros: base.registros || [], ml: noML })"), "conferido de novo na hora do clique");
  assert.ok(rv.includes("registrarMLBsAnteriores({ anuncioId: ficha.anuncioId, registros: anterioresEncerrados })"));
  // a ficha que JÁ tem MLB próprio continua sem caminho para publicar de novo
  assert.ok(rv.includes("Esta ficha já foi publicada"));
});

test("Bling: SKU existente é localizado e NADA é criado; ID antigo do histórico não é usado", () => {
  const leitura = { ok: true, encontrado: true, produto: { id: 16717123217, codigo: "8200442891" } };
  const d = decidirCriacaoBling(leitura);
  assert.equal(d.acao, "ja_existe");
  assert.equal(String(d.produto.id), "16717123217");
  assert.equal(decidirCriacaoBling({ ok: true, encontrado: false }).acao, "criar", "só cria quando a leitura atual diz que não existe (e com clique)");
  assert.equal(decidirCriacaoBling({ ok: false, erro: "timeout" }).acao, "erro");
  const rv = ler("src/components/RevisaoPublicacaoML.jsx");
  // o produto ligado à publicação vem da leitura ATUAL do Bling (estoque), nunca da ficha antiga
  assert.ok(rv.includes("produtoBlingId: estoque?.encontrado && !estoque?.ambiguo ? estoque?.produto?.id"));
});

test("vínculo ML → Bling continua MANUAL; nenhum texto de vínculo automático", () => {
  assert.equal(AVISO_VINCULO_MANUAL, "VÍNCULO MANUAL NO BLING — NÃO USAR IMPORTAÇÃO/VÍNCULO AUTOMÁTICO.");
  assert.equal(AVISO_AUTOMATICA, AVISO_VINCULO_MANUAL);
  const p = passosBling({ lojaNome: "LojaOnlineSP", sku: "8200442891" });
  assert.match(p.join(" "), /Pelo MLB ou link/);
  assert.match(p.join(" "), /produto EXISTENTE pelo mesmo SKU \(8200442891\)/);
  assert.match(p.join(" "), /confirma manualmente/);
  assert.match(p.at(-1), /Já trouxe — verificar agora/);
  for (const t of [...p, ...PASSOS_BLING]) assert.equal(/Vínculo automático|Mesmo código SKU →/i.test(t), false, t);
  const painel = ler("src/components/PainelIntegracaoBling.jsx");
  assert.ok(painel.includes("data-paiia-vinculo-manual") && painel.includes("AVISO_VINCULO_MANUAL"));
  for (const f of ["src/components/PainelIntegracaoBling.jsx", "src/components/FichaPublicadaPAIIA.jsx", "src/services/vinculoBlingPublicacao.js"]) {
    assert.equal(/vinculo_loja_criar/.test(ler(f)), false, `${f} não cria vínculo`);
  }
});
