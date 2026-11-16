// =============================================================
// PAIIA — TESTES: finalização em DOIS cliques nas três contas (16/11/2026).
// Caso de diagnóstico: SKU 8200263342 (último anúncio com problema; o produto
// chegou a ser excluído do Bling para tentar refazer).
// Tudo SIMULADO: Mercado Livre e Bling falsos. Nada é publicado nem gravado.
//   node --test scripts/testes/finalizacaoDoisCliques.test.mjs
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { register } from "node:module";

register("./simulacao/ganchoSupabaseFalso.mjs", import.meta.url);
const { reconhecerSKU, contasParaConsultar } = await import("../../src/services/reconhecimentoSKU.js");
const Q = await import("../../src/services/produtoExistenteSKU.js");
const F = await import("../../src/services/finalizacaoPublicacao.js");
const { SITUACAO_CONTA, montarPlanoContas } = await import("../../src/services/contasPublicacaoML.js");
const { executarPiloto } = await import("../../src/services/pilotoPublicacao.js");
const ler = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

const SKU = "8200263342";
const LOJA = "1729335019";
const CIEBR = "824312524";
const REV = "2412238242";
const FICHA = "ficha-8200263342";
const E = F.ESTADO_FINAL;

// ---- Mercado Livre simulado (somente leitura) ----
function mlFalso({ itens = [], falhar = [] } = {}) {
  const chamadas = [];
  const consultarML = async (conta, caminho) => {
    chamadas.push({ conta: String(conta), caminho });
    if (falhar.includes(String(conta))) return { ok: false, erro: "ML fora do ar (simulado)" };
    const daConta = itens.filter((i) => String(i.seller_id) === String(conta));
    const skusDe = (i) => [i.seller_custom_field, ...(i.attributes || []).filter((a) => a.id === "SELLER_SKU").map((a) => a.value_name), ...(i.variations || []).flatMap((v) => (v.attributes || []).filter((a) => a.id === "SELLER_SKU").map((a) => a.value_name))].filter(Boolean);
    const s = caminho.match(/\/items\/search\?seller_sku=([^&]+)/);
    if (s) return { ok: true, dados: { results: daConta.filter((i) => skusDe(i).includes(decodeURIComponent(s[1]))).map((i) => i.id) } };
    const q = caminho.match(/\/items\/search\?q=([^&]+)/);
    if (q) return { ok: true, dados: { results: daConta.filter((i) => i.title.includes(decodeURIComponent(q[1]))).map((i) => i.id), paging: { total: 0 } } };
    const it = caminho.match(/^\/items\/(MLB\d+)$/);
    if (it) { const x = itens.find((i) => i.id === it[1]); return x ? { ok: true, dados: x } : { ok: false, status: 404, erro: "not_found" }; }
    return { ok: false, erro: `rota não simulada ${caminho}` };
  };
  return { consultarML, chamadas };
}
const item = (id, conta, extra = {}) => ({ id, seller_id: Number(conta), status: "active", title: "Peça teste", attributes: [], ...extra });

// ---- Bling simulado ----
const BLING = {
  excluido: async () => ({ ok: true, encontrado: false }),
  existe: async () => ({ ok: true, encontrado: true, produto: { id: "16000000777", codigo: SKU, nome: "Peça" } }),
  ambiguo: async () => ({ ok: true, ambiguo: true, candidatos: [{ id: "1", codigo: SKU }, { id: "2", codigo: `${SKU} ` }] }),
  fora: async () => ({ ok: false, erro: "Bling 503 (simulado)" }),
};

const fichaAtual = (extra = {}) => ({ id: FICHA, codigo: SKU, titulo: "Peça", status_fluxo: "conferencia_aprovada", conta_destino_ml_user_id: "", updated_at: "2026-11-16T10:00:00Z", publicacao: null, ...extra });
const liberada = (conta) => ({ conta, situacao: SITUACAO_CONTA.LIBERADA, impedimentos: [], itens: [{ item: "Duplicidade", nivel: "ok", texto: "ok" }] });
const todasLiberadas = () => [LOJA, CIEBR, REV].map(liberada);

async function finalizar({ itens = [], falhar = [], bling = BLING.excluido, fichas = [fichaAtual()], ficha = { id: FICHA }, verificacoes = todasLiberadas(), fotos = 4, registros = [] } = {}) {
  const ml = mlFalso({ itens, falhar });
  const contas = contasParaConsultar([{ ml_user_id: LOJA }, { ml_user_id: CIEBR }, { ml_user_id: REV }]);
  const rec = await reconhecerSKU({ codigo: SKU, contas, lerBling: bling, lerBase: async () => ({ ok: true, anuncios: fichas }), consultarML: ml.consultarML, lerRegistro: async () => ({ ok: true, registros }) });
  rec.identidades = await Q.identidadesDasFichas({ codigo: SKU, fichas, reconhecimento: rec, consultarML: ml.consultarML });
  const quadro = Q.quadroProdutoExistente({ fichas, reconhecimento: rec });
  const res = F.situacaoFinalDasContas({ ficha, quadro, verificacoes, fotos });
  return { res, ml, linha: (c) => res.linhas.find((l) => l.conta === c) };
}

test("ordem e nomes: LOJA ONLINE, CIEBR, REVELAÇÃO; rótulos PUBLICADO / JÁ EXISTENTE / PENDENTE", async () => {
  const { res } = await finalizar();
  assert.deepEqual(res.linhas.map((l) => l.nome), ["LOJA ONLINE", "CIEBR", "REVELAÇÃO"]);
  assert.equal(F.ROTULO_FINAL[E.PUBLICADO], "PUBLICADO");
  assert.equal(F.ROTULO_FINAL[E.JA_EXISTENTE], "JÁ EXISTENTE");
  assert.equal(F.ROTULO_FINAL[E.PENDENTE], "PENDENTE");
});

test("8200263342 — produto EXCLUÍDO do Bling e nenhum anúncio: as 3 contas PENDENTES com o 2º clique; Bling cadastrado sem duplicar", async () => {
  const { res, ml } = await finalizar();
  for (const l of res.linhas) {
    assert.equal(l.estado, E.PENDENTE, l.nome);
    assert.equal(l.acao.tipo, "publicar");
    assert.equal(l.acao.texto, `✅ Confirmar Publicação na ${l.nome}`);
  }
  assert.equal(res.bling.cadastrar, true);
  assert.match(res.bling.texto, /cadastro protegido: confere o SKU antes e nunca duplica/);
  assert.ok(["1729335019", "824312524", "2412238242"].every((c) => ml.chamadas.some((x) => x.conta === c)), "as três contas lidas");
  assert.ok(ml.chamadas.every((x) => x.caminho.startsWith("/users/") || x.caminho.startsWith("/items/")), "só leitura");
});

test("produto JÁ no Bling: reaproveitado (nada é cadastrado de novo)", async () => {
  const { res } = await finalizar({ bling: BLING.existe });
  assert.equal(res.bling.ok, true);
  assert.equal(res.bling.cadastrar, undefined);
  assert.match(res.bling.texto, /produto 16000000777 .* reaproveitado, nada é cadastrado de novo/);
});

test("anúncio já existe na LOJA ONLINE com o SKU só na VARIAÇÃO: JÁ EXISTENTE + MLB, sem botão; CIEBR/REVELAÇÃO pendentes", async () => {
  const loja = item("MLB8000000001", LOJA, { variations: [{ id: 5, attributes: [{ id: "SELLER_SKU", value_name: SKU }] }] });
  const { linha } = await finalizar({ itens: [loja] });
  assert.equal(linha(LOJA).estado, E.JA_EXISTENTE);
  assert.deepEqual(linha(LOJA).mlbs, ["MLB8000000001"]);
  assert.equal(linha(LOJA).acao.tipo, "nenhuma", "nunca duplica na mesma conta");
  assert.equal(linha(CIEBR).estado, E.PENDENTE);
  assert.equal(linha(REV).estado, E.PENDENTE);
});

test("esta ficha JÁ publicou na CIEBR (MLB real): PUBLICADO, nada reenviado; LOJA aponta 'outra conta'", async () => {
  const mlb = "MLB8000000002";
  const fichas = [fichaAtual({ status_fluxo: "publicado", conta_destino_ml_user_id: CIEBR, publicacao: { ml_user_id: CIEBR, mlb_id: mlb } })];
  const { linha } = await finalizar({ itens: [item(mlb, CIEBR, { seller_custom_field: SKU })], fichas, ficha: { id: FICHA, mlb, conta: CIEBR } });
  assert.equal(linha(CIEBR).estado, E.PUBLICADO);
  assert.deepEqual(linha(CIEBR).mlbs, [mlb]);
  assert.equal(linha(CIEBR).acao.tipo, "nenhuma");
  assert.equal(linha(LOJA).estado, E.IMPEDIDO);
  assert.match(linha(LOJA).motivos[0], /use "Publicar em outra conta"/);
});

test("MLB de OUTRO SKU gravado na ficha (caso do parafuso): ficha não conta como publicada; conta bloqueada até corrigir", async () => {
  const outro = "MLB8000000003";
  const fichas = [fichaAtual({ status_fluxo: "publicado", conta_destino_ml_user_id: LOJA, publicacao: { ml_user_id: LOJA, mlb_id: outro } })];
  const { linha } = await finalizar({ itens: [item(outro, LOJA, { seller_custom_field: "8200642489" })], fichas, ficha: { id: FICHA, mlb: outro, conta: LOJA } });
  assert.equal(linha(LOJA).estado, E.IMPEDIDO);
  assert.match(linha(LOJA).motivos[0], /é de outro produto\/conta no Mercado Livre: corrija pelo Diagnóstico/);
  assert.deepEqual(linha(LOJA).mlbs, [], "o MLB de outro SKU nunca é mostrado como desta peça");
});

test("MLB de outro SKU numa ficha ANTIGA (não a aberta): ignorado com aviso; a conta segue pendente", async () => {
  const outro = "MLB8000000004";
  const fichas = [fichaAtual(), fichaAtual({ id: "ficha-antiga", status_fluxo: "publicado", conta_destino_ml_user_id: LOJA, publicacao: { ml_user_id: LOJA, mlb_id: outro } })];
  const { linha } = await finalizar({ itens: [item(outro, LOJA, { seller_custom_field: "8200642489" })], fichas });
  assert.equal(linha(LOJA).estado, E.PENDENTE);
  assert.ok(linha(LOJA).avisos.some((a) => /MLB8000000004 não é desta peça e é ignorado/.test(a)));
});

test("envio anterior sem resposta na REVELAÇÃO: PENDENTE com 'Retomar com segurança' (nunca reenvia às cegas)", async () => {
  const { linha } = await finalizar({ ficha: { id: FICHA, envio: { conta: REV, sku: SKU, iniciado_em: "2026-11-16T12:00:00Z" } } });
  assert.equal(linha(REV).estado, E.PENDENTE);
  assert.equal(linha(REV).acao.tipo, "retomar");
  assert.match(linha(REV).acao.texto, /Retomar com segurança na REVELAÇÃO/);
});

test("ML fora do ar numa conta: só ela fica IMPEDIDA (motivo claro); as outras seguem", async () => {
  const { linha } = await finalizar({ falhar: [REV] });
  assert.equal(linha(REV).estado, E.IMPEDIDO);
  assert.match(linha(REV).motivos.join(" "), /Mercado Livre não conferido nesta conta/);
  assert.equal(linha(LOJA).estado, E.PENDENTE);
});

test("sem fotos / Bling ambíguo / Bling fora: IMPEDIDO nas três, com o motivo", async () => {
  for (const [cfg, re] of [[{ fotos: 0 }, /a ficha não tem fotos/], [{ bling: BLING.ambiguo }, /mais de um produto com este SKU/], [{ bling: BLING.fora }, /Bling não conferido/]]) {
    const { res } = await finalizar(cfg);
    for (const l of res.linhas) {
      assert.equal(l.estado, E.IMPEDIDO, `${l.nome} ${re}`);
      assert.match(l.motivos.join(" "), re);
      assert.equal(l.acao.tipo, "nenhuma");
    }
  }
});

test("exigência da conta não cumprida (frete/estoque): IMPEDIDO com o motivo da conta", async () => {
  const verificacoes = [liberada(LOJA), { conta: CIEBR, situacao: SITUACAO_CONTA.IMPEDIDA, impedimentos: ["Frete: O Mercado Livre não cotou o frete nesta conta (sem resposta)."], itens: [] }, liberada(REV)];
  const { linha } = await finalizar({ verificacoes });
  assert.equal(linha(CIEBR).estado, E.IMPEDIDO);
  assert.match(linha(CIEBR).motivos[0], /Frete: O Mercado Livre não cotou/);
});

test("anúncio parecido (mesmo código no título, SKU diferente): CONFERIR — o 2º clique já diz 'conferi'", async () => {
  const parecido = item("MLB8000000005", CIEBR, { title: `Peça ${SKU} kit`, seller_custom_field: "OUTRO-1" });
  const { linha } = await finalizar({ itens: [parecido] });
  assert.equal(linha(CIEBR).estado, E.CONFERIR);
  assert.equal(linha(CIEBR).acao.conferida, true);
  assert.match(linha(CIEBR).acao.texto, /Confirmar Publicação na CIEBR \(conferi: não é o mesmo anúncio\)/);
});

test("outra ficha do SKU em andamento na CIEBR: IMPEDIDO (continue por ela, não duplica)", async () => {
  const fichas = [fichaAtual(), fichaAtual({ id: "ficha-ciebr-123", conta_destino_ml_user_id: CIEBR })];
  const { linha } = await finalizar({ fichas });
  assert.equal(linha(CIEBR).estado, E.IMPEDIDO);
  assert.match(linha(CIEBR).motivos.join(" "), /Outra ficha deste SKU está em andamento nesta conta \(ficha-ci\)/);
});

test("2º clique: plano com UMA conta (a escolhida); 'conferi' só quando a conta estava em CONFERIR", () => {
  const verifConferir = { conta: CIEBR, nome: "CIEBR", situacao: SITUACAO_CONTA.CONFERIR, impedimentos: [], itens: [] };
  const p1 = montarPlanoContas({ selecao: [CIEBR], resultados: [verifConferir], conferidas: { [CIEBR]: true } });
  assert.deepEqual([p1.conta_desta_ficha, p1.fila], [CIEBR, []]);
  const p2 = montarPlanoContas({ selecao: [CIEBR], resultados: [verifConferir], conferidas: {} });
  assert.equal(p2.conta_desta_ficha, "", "sem o 2º clique 'conferi', nada é liberado");
  const p3 = montarPlanoContas({ selecao: [REV], resultados: [liberada(REV)] });
  assert.equal(p3.conta_desta_ficha, REV);
});

// ---- Piloto nas 3 contas ----
function telaPiloto({ conta = CIEBR } = {}) {
  const s = { leiturasVinculo: 0, cliques: [] };
  const el = (attrs = {}) => ({ disabled: false, checked: false, attrs, hasAttribute: (a) => a in attrs, getAttribute: (a) => attrs[a] ?? null });
  const p = {
    mlbJaPublicado: async () => ({ mlb: "MLB8000000009" }),
    achar: () => el(),
    clicar: (e) => s.cliques.push(e),
    texto: () => "",
    esperar: (ms) => new Promise((ok) => setTimeout(ok, ms)),
    progresso: () => {},
    consultarItem: async () => ({ status: "active" }),
    relerIntegracao: async () => { s.leiturasVinculo += 1; return "aguardando"; },
    vinculoAplicavel: () => conta === LOJA,
    publicado: async () => {},
  };
  return { p, s };
}
const L = { passo: 100, intervalo: 5, estavel: 3, ativo: 60, vinculo: 5000, intervaloML: 5 };

test("piloto CIEBR/REVELAÇÃO: sem loja Bling ligada não espera vínculo; avisa onde fazer; nada reenviado", async () => {
  for (const conta of [CIEBR, REV]) {
    const { p, s } = telaPiloto({ conta });
    const ini = Date.now();
    const r = await executarPiloto(p, { limites: L });
    assert.equal(r.ok, true);
    assert.equal(r.vinculo, false);
    assert.equal(s.leiturasVinculo, 0, "não lê o vínculo de uma loja que não existe");
    assert.ok(Date.now() - ini < 2000, "não espera o tempo do vínculo");
    assert.match(r.pendencia, /vínculo no Bling desta conta: faça na Gestão de Anúncios do Bling/);
    assert.equal(s.cliques.length, 0, "ficha já publicada: nenhum toque em Publicar");
  }
});

test("piloto LOJA ONLINE: continua conferindo o vínculo como antes", async () => {
  const { p, s } = telaPiloto({ conta: LOJA });
  await executarPiloto(p, { limites: { ...L, vinculo: 60 } });
  assert.ok(s.leiturasVinculo >= 1);
});

// ---- Tela: exatamente dois toques ----
test("tela: só dois toques de publicação — 'Conferir e Publicar' e 'Confirmar Publicação na <conta>' — nas três contas", () => {
  const a = ler("src/components/AutorizacaoUnicaPublicacao.jsx");
  assert.ok(a.includes('"🔎 Conferir e Publicar"'));
  assert.ok(a.includes("onClick={conferir}") && a.includes("onClick={() => confirmar(l)}"));
  assert.ok(!a.includes('type="checkbox"'), "sem caixas de marcar nem 'autorizo' separado");
  assert.ok(a.includes("onAutorizar?.(linha.conta, id, plano);") && !a.includes("CONTA_PUBLICACAO_AUTOMATICA"), "piloto para qualquer das 3 contas");
  const pil = ler("src/components/PilotoAutomaticoPublicacao.jsx");
  assert.ok(pil.includes("vinculoAplicavel: () => Boolean(lojaBlingDaConta(dadosRef.current.conta || conta))"));
  const m = ler("src/components/MercadoLivreTeste.jsx");
  assert.ok(m.includes("fotos={Array.isArray(anuncioConferido?.fotos) ? anuncioConferido.fotos.length : 0}"));
});
