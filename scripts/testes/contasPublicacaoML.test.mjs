// =============================================================
// PAIIA — TESTES: contas da publicação no Mercado Livre (14/11/2026).
// Conta escolhida só na etapa final de Publicação (LOJA ONLINE, REVELAÇÃO,
// CIEBR: 1, 2 ou as 3), verificação SEPARADA por conta, impedimento de uma
// conta não bloqueia as outras, confirmação final com as contas exatas.
// Tudo com consultas FALSAS: nada vai ao Mercado Livre, ao Bling ou à base real.
//   node --test scripts/testes/contasPublicacaoML.test.mjs
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

register("./simulacao/ganchoSupabaseFalso.mjs", import.meta.url);

const { banco, zerarBanco } = await import("./simulacao/supabaseFalso.mjs");
const C = await import("../../src/services/contasPublicacaoML.js");
const { salvarFichaAprovada, registrarContasPublicacao, registrarMLBPublicado, obterAnuncio, CHAVES_PRESERVADAS_FICHA, prepararFichaProximaConta } = await import("../../src/services/anuncioPublicacaoService.js");

const { registroPublicado } = await import("../../src/services/vinculoBlingPublicacao.js");

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ler = (rel) => fs.readFileSync(path.join(RAIZ, rel), "utf8").replace(/\r\n/g, "\n");

const LOJA = "1729335019";
const REV = "2412238242";
const CIE = "824312524";
const MEDIDA = { peso_g: 300, comprimento_cm: 20, largura_cm: 15, altura_cm: 10 };
const BASE = { custo: 40, despesas: 2, comissao: 12, imposto: 6 };
const DADOS = {
  sku: "TESTE-CONTAS-001", codigo: "TESTE-CONTAS-001", preco: "129,90", quantidade: "3", medida: MEDIDA,
  registroFrete: { conta: LOJA, modalidade: "drop_off", categoria: "MLB1234", tipoAnuncio: "classico", base: BASE, medida: MEDIDA, final: { custo_vendedor: 20.5 } },
};

/** Mercado Livre FALSO por conta: só responde leituras (GET); registra cada caminho pedido. */
function mlFalso({ frete = {}, falhaFrete = {}, modalidades = {}, itensSku = {}, possiveis = {}, conectadas = [LOJA, REV, CIE], base = {}, explode = {} } = {}) {
  const chamadas = [];
  const deps = {
    conectada: (id) => conectadas.includes(id),
    modalidades: async (id) => ({ ok: true, modalidades: modalidades[id] || [{ tipo: "drop_off", padrao: true }] }),
    consultar: (id) => async (caminho) => {
      chamadas.push({ conta: id, caminho });
      if (explode[id]) throw new Error(`queda simulada em ${id}`);
      if (caminho.includes("/shipping_options/free")) {
        if (falhaFrete[id]) return { ok: false, status: 500, erro: "Mercado Livre indisponível." };
        return { ok: true, status: 200, dados: { coverage: { all_country: { list_cost: frete[id] ?? 20.5, billable_weight: 400, currency_id: "BRL" } } } };
      }
      if (caminho.includes("/items/search")) return { ok: true, dados: { results: [...(itensSku[id] || []), ...(possiveis[id] || [])].map((x) => x.id), paging: { total: 0 } } };
      const m = caminho.match(/^\/items\/(MLB\d+)$/);
      if (m) {
        const it = [...(itensSku[id] || []), ...(possiveis[id] || [])].find((x) => x.id === m[1]);
        return { ok: true, dados: { id: it.id, seller_id: Number(id), status: "active", title: it.title || "Peça", seller_custom_field: it.sku || "", attributes: it.pn ? [{ id: "PART_NUMBER", value_name: it.pn }] : [] } };
      }
      return { ok: false, erro: `caminho inesperado ${caminho}` };
    },
    duplicidadeBase: async ({ contaId }) => (base[contaId] === "erro" ? { ok: false, erro: "base fora do ar" } : { ok: true, registros: base[contaId] || [] }),
    duplicidadeML: (a) => import("../../src/services/duplicidadeML.js").then((d) => d.verificarDuplicidadeML(a)),
  };
  return { deps, chamadas };
}
const porConta = (v, id) => v.resultados.find((r) => r.conta === id);

test("1) três contas fixas, seleção independente (1, 2 ou 3) e sempre na ordem LOJA ONLINE, REVELAÇÃO, CIEBR", () => {
  assert.deepEqual(C.CONTAS_PUBLICACAO_ML.map((c) => [c.nome, c.id]), [["LOJA ONLINE", LOJA], ["REVELAÇÃO", REV], ["CIEBR", CIE]]);
  assert.deepEqual(C.normalizarContasSelecionadas([CIE, LOJA]), [LOJA, CIE]);
  assert.deepEqual(C.normalizarContasSelecionadas({ [REV]: true, [CIE]: false }), [REV]);
  assert.deepEqual(C.normalizarContasSelecionadas([LOJA, REV, CIE, "999", LOJA]), [LOJA, REV, CIE]);
  assert.deepEqual(C.normalizarContasSelecionadas([]), []);
});

test("2) as três liberadas: cada conta com a SUA cotação oficial de frete e a sua margem", async () => {
  const { deps, chamadas } = mlFalso({ frete: { [LOJA]: 20.5, [REV]: 22.9, [CIE]: 18.4 } });
  const v = await C.verificarContasPublicacao({ selecao: [LOJA, REV, CIE], dados: DADOS, deps });
  assert.deepEqual(v.resultados.map((r) => r.situacao), ["liberada", "liberada", "liberada"]);
  assert.equal(porConta(v, REV).frete.valor, 22.9);
  assert.equal(porConta(v, CIE).frete.valor, 18.4);
  assert.notEqual(porConta(v, LOJA).margem.resultado, porConta(v, REV).margem.resultado, "margem calculada com o frete de cada conta");
  for (const id of [LOJA, REV, CIE]) assert.ok(chamadas.some((c) => c.conta === id && c.caminho.startsWith(`/users/${id}/shipping_options/free`)), `frete cotado na própria conta ${id}`);
  assert.ok(chamadas.every((c) => /^\/(users|items)\//.test(c.caminho)), "só leituras");
});

test("3) impedimento numa conta NÃO bloqueia as outras (duplicidade, frete e queda de consulta)", async () => {
  const { deps } = mlFalso({ itensSku: { [REV]: [{ id: "MLB111", sku: "TESTE-CONTAS-001" }] }, falhaFrete: { [CIE]: true } });
  const v = await C.verificarContasPublicacao({ selecao: [LOJA, REV, CIE], dados: DADOS, deps });
  assert.equal(porConta(v, LOJA).situacao, "liberada");
  assert.equal(porConta(v, REV).situacao, "impedida");
  assert.ok(porConta(v, REV).impedimentos.join(" ").includes("MLB111"));
  assert.equal(porConta(v, CIE).situacao, "impedida");
  assert.ok(/não cotou o frete/.test(porConta(v, CIE).impedimentos.join(" ")));
  assert.deepEqual(C.contasLiberadas(v.resultados), [LOJA]);

  const q = mlFalso({ explode: { [LOJA]: true } });
  const v2 = await C.verificarContasPublicacao({ selecao: [LOJA, REV], dados: DADOS, deps: q.deps });
  assert.equal(porConta(v2, LOJA).situacao, "impedida", "queda numa conta vira impedimento só dela");
  assert.equal(porConta(v2, REV).situacao, "liberada");
});

test("4) conta não conectada, base PAIIA indisponível e SKU já registrado na base: só a conta afetada fica impedida", async () => {
  const { deps } = mlFalso({ conectadas: [LOJA, REV], base: { [REV]: "erro" } });
  const v = await C.verificarContasPublicacao({ selecao: [LOJA, REV, CIE], dados: DADOS, deps });
  assert.equal(porConta(v, CIE).situacao, "impedida");
  assert.ok(/não está conectada/.test(porConta(v, CIE).impedimentos[0]));
  assert.equal(porConta(v, REV).situacao, "impedida");
  assert.ok(/base PAIIA/.test(porConta(v, REV).impedimentos.join(" ")));
  assert.equal(porConta(v, LOJA).situacao, "liberada");

  const b = mlFalso({ base: { [LOJA]: [{ id: "x", mlb_id: "MLB999" }] } });
  const v2 = await C.verificarContasPublicacao({ selecao: [LOJA, CIE], dados: DADOS, deps: b.deps });
  assert.equal(porConta(v2, LOJA).situacao, "impedida");
  assert.equal(porConta(v2, CIE).situacao, "liberada");
});

test("5) estoque e preço conferidos por conta: quantidade inválida e prejuízo com o frete daquela conta", async () => {
  const semEstoque = await C.verificarContasPublicacao({ selecao: [LOJA], dados: { ...DADOS, quantidade: "0" }, deps: mlFalso().deps });
  assert.ok(/Estoque/.test(semEstoque.resultados[0].impedimentos.join(" ")));
  const { deps } = mlFalso({ frete: { [LOJA]: 20, [REV]: 95 } });
  const v = await C.verificarContasPublicacao({ selecao: [LOJA, REV], dados: DADOS, deps });
  assert.equal(porConta(v, LOJA).situacao, "liberada");
  assert.equal(porConta(v, REV).situacao, "impedida");
  assert.ok(/prejuízo/.test(porConta(v, REV).impedimentos.join(" ")));
  const semPreco = await C.verificarContasPublicacao({ selecao: [CIE], dados: { ...DADOS, preco: "" }, deps: mlFalso().deps });
  assert.equal(semPreco.resultados[0].situacao, "impedida");
});

test("6) frete: modalidade ativa da própria conta; sem modalidade ativa = impedida só ali; simulação recusada", async () => {
  assert.equal(C.modalidadeParaConta([{ tipo: "xd_drop_off", padrao: true }, { tipo: "drop_off" }], "drop_off"), "drop_off");
  assert.equal(C.modalidadeParaConta([{ tipo: "cross_docking" }, { tipo: "xd_drop_off", padrao: true }], "drop_off"), "xd_drop_off");
  assert.equal(C.modalidadeParaConta([], "drop_off"), "");
  const { deps, chamadas } = mlFalso({ modalidades: { [REV]: [{ tipo: "xd_drop_off", padrao: true }], [CIE]: [] } });
  const v = await C.verificarContasPublicacao({ selecao: [REV, CIE], dados: DADOS, deps });
  assert.equal(porConta(v, REV).frete.modalidade, "xd_drop_off");
  assert.ok(chamadas.some((c) => c.conta === REV && c.caminho.includes("logistic_type=xd_drop_off")));
  assert.equal(porConta(v, CIE).situacao, "impedida");
  const sim = mlFalso();
  const consultar = sim.deps.consultar;
  sim.deps.consultar = (id) => async (cam) => ({ ...(await consultar(id)(cam)), simulacao: cam.includes("shipping_options") });
  const vs = await C.verificarContasPublicacao({ selecao: [LOJA], dados: DADOS, deps: sim.deps });
  assert.equal(vs.resultados[0].situacao, "impedida");
});

test("7) possível duplicidade: conta fica em 'conferir' e só entra com a sua confirmação daquela conta", async () => {
  const { deps } = mlFalso({ possiveis: { [REV]: [{ id: "MLB222", sku: "OUTRO", pn: "TESTE-CONTAS-001" }] } });
  const v = await C.verificarContasPublicacao({ selecao: [LOJA, REV], dados: DADOS, deps });
  const r = porConta(v, REV);
  assert.equal(r.situacao, "conferir");
  assert.ok(r.itens.some((i) => i.nivel === "conferir" && i.texto.includes("MLB222")));
  assert.equal(porConta(v, LOJA).situacao, "liberada");
  assert.deepEqual(C.contasLiberadas(v.resultados), [LOJA]);
  assert.deepEqual(C.contasLiberadas(v.resultados, { [REV]: true }), [LOJA, REV]);
  assert.equal(C.resumoConfirmacao(v.resultados).fora[0].motivo, "possível duplicidade ainda não conferida");
});

test("8) confirmação final mostra EXATAMENTE as contas usadas e as que ficam de fora; plano com a conta desta ficha e a fila", () => {
  const res = [
    { conta: LOJA, nome: "LOJA ONLINE", situacao: "liberada", impedimentos: [] },
    { conta: REV, nome: "REVELAÇÃO", situacao: "impedida", impedimentos: ["Duplicidade: MLB111"] },
    { conta: CIE, nome: "CIEBR", situacao: "liberada", impedimentos: [] },
  ];
  const r = C.resumoConfirmacao(res);
  assert.deepEqual(r.contas, [LOJA, CIE]);
  assert.equal(r.texto, "Publicar SOMENTE em: LOJA ONLINE, CIEBR. Fora desta publicação: REVELAÇÃO.");
  assert.equal(r.fora[0].nome, "REVELAÇÃO");
  assert.equal(C.resumoConfirmacao([res[1]]).texto, "Nenhuma conta liberada: nada será publicado.");
  const p = C.montarPlanoContas({ selecao: [LOJA, REV, CIE], resultados: res, agora: "2026-11-14T10:00:00.000Z" });
  assert.deepEqual(p.confirmadas, [LOJA, CIE]);
  assert.equal(p.conta_desta_ficha, LOJA);
  assert.deepEqual(p.fila, [CIE]);
  assert.deepEqual(p.impedidas.map((x) => x.conta), [REV]);
  const soRev = C.montarPlanoContas({ selecao: [REV], resultados: [{ conta: REV, nome: "REVELAÇÃO", situacao: "liberada" }] });
  assert.equal(soRev.conta_desta_ficha, REV);
  assert.deepEqual(soRev.fila, []);
});

test("9) verificação vale só para as mesmas contas e os mesmos dados (assinatura)", () => {
  const a = C.assinaturaVerificacao([LOJA, REV], DADOS);
  assert.equal(a, C.assinaturaVerificacao([REV, LOJA], DADOS));
  assert.notEqual(a, C.assinaturaVerificacao([LOJA], DADOS));
  assert.notEqual(a, C.assinaturaVerificacao([LOJA, REV], { ...DADOS, preco: "139,90" }));
  assert.notEqual(a, C.assinaturaVerificacao([LOJA, REV], { ...DADOS, quantidade: "2" }));
});

test("10) estimativa da preparação: conta de referência sem escolha (ativa; senão LOJA ONLINE → REVELAÇÃO → CIEBR)", () => {
  assert.equal(C.contaReferenciaFrete([{ ml_user_id: CIE }, { ml_user_id: REV, ativa: true }]).ml_user_id, REV);
  assert.equal(C.contaReferenciaFrete([{ ml_user_id: CIE }, { ml_user_id: REV }]).ml_user_id, REV);
  assert.equal(C.contaReferenciaFrete([{ ml_user_id: CIE }, { ml_user_id: LOJA }]).ml_user_id, LOJA);
  assert.equal(C.contaReferenciaFrete([]), null);
});

test("11) plano gravado na ficha (base FALSA) com a conta de destino; ficha publicada nunca muda; chave preservada", async () => {
  zerarBanco();
  assert.ok(CHAVES_PRESERVADAS_FICHA.includes("contas_publicacao"));
  const ap = await salvarFichaAprovada({ anuncioId: "", codigo: "TESTE-CONTAS-001", titulo: "Peça teste", dadosConferencia: { versao: 2, anuncio: { codigo: "TESTE-CONTAS-001" } } });
  assert.equal(ap.ok, true);
  const plano = C.montarPlanoContas({ selecao: [REV, CIE], resultados: [{ conta: REV, nome: "REVELAÇÃO", situacao: "liberada" }, { conta: CIE, nome: "CIEBR", situacao: "liberada" }] });
  const r = await registrarContasPublicacao({ anuncioId: ap.anuncioId, plano, codigo: "TESTE-CONTAS-001", titulo: "Peça teste", contaNome: "REVELAÇÃO" });
  assert.equal(r.ok, true, r.erro);
  const f = await obterAnuncio(ap.anuncioId);
  assert.deepEqual(f.anuncio.dados_conferencia.contas_publicacao.confirmadas, [REV, CIE]);
  assert.equal(f.anuncio.conta_destino_ml_user_id, REV);
  const pub = banco.tabelas.paiia_anuncios_publicacoes.find((p) => p.anuncio_id === ap.anuncioId);
  assert.equal(pub.ml_user_id, REV);
  assert.ok(!pub.mlb_id, "nada publicado");

  const vazio = await registrarContasPublicacao({ anuncioId: ap.anuncioId, plano: { confirmadas: [], conta_desta_ficha: "" } });
  assert.equal(vazio.ok, false);

  const reg = registroPublicado({ mlb: "MLB123456789", contaId: REV, skuOficial: "TESTE-CONTAS-001", produtoBlingId: "1", preco: 10 });
  const pb = await registrarMLBPublicado({ anuncioId: ap.anuncioId, contaId: REV, mlb: "MLB123456789", sku: "TESTE-CONTAS-001", registro: reg });
  assert.equal(pb.ok, true, pb.erro);
  const depois = await registrarContasPublicacao({ anuncioId: ap.anuncioId, plano: C.montarPlanoContas({ selecao: [CIE], resultados: [{ conta: CIE, nome: "CIEBR", situacao: "liberada" }] }) });
  assert.equal(depois.ok, false);
  assert.equal(depois.fechada, true);
});

test("12) telas: seletor de conta saiu do frete do Novo Anúncio; Publicação com as 3 caixas e confirmação final", () => {
  const na = ler("src/components/NovoAnuncio.jsx");
  assert.ok(!na.includes("data-paiia-frete-conta"), "sem seletor de conta no frete da preparação");
  assert.ok(na.includes("estimativa de referência"));
  assert.ok(na.includes("const contaAtivaNA = contaReferenciaFrete(contasConectadasNA);"));
  assert.ok(na.includes("calcularFreteEPrecos({ params: paramsFreteNA, base: baseFreteNA"), "cálculo de preço/frete preservado");
  const a = ler("src/components/AutorizacaoUnicaPublicacao.jsx");
  assert.ok(a.includes("CONTAS_PUBLICACAO_ML.map((c) =>") && a.includes('type="checkbox" checked={Boolean(marcadas[c.id])}'), "uma caixa independente por conta");
  assert.ok(a.includes("verificarContasPublicacao({ selecao, dados, deps })"));
  assert.ok(a.includes("disabled={!marcado}") && a.includes("Autorizo publicar SOMENTE em:"), "confirmação final com as contas exatas");
  assert.ok(a.indexOf("onAutorizar?.(") > a.indexOf("async function confirmar()"), "piloto só depois da confirmação");
  const efeito = a.slice(a.indexOf("useEffect(() => {"), a.indexOf("}, [anuncioId]);"));
  assert.ok(efeito.includes("obterAnuncio(anuncioId)") && !/verificar\(|confirmar\(|onAutorizar|onManual|registrarContasPublicacao/.test(efeito), "abrir a ficha só pré-marca contas: nada é conferido ou confirmado sozinho");
  const m = ler("src/components/MercadoLivreTeste.jsx");
  assert.ok(m.includes("contasPermitidas={planoContas ? [planoContas.conta_desta_ficha] : null}"));
  const r = ler("src/components/RevisaoPublicacaoML.jsx");
  assert.ok(r.includes("if ((auto || estimativaDeOutraConta) && contaEscolhida)"), "frete oficial recotado na conta da ficha");
});

// ------------------------- cenários 1, 2 e 3 contas -------------------------
async function cenario(selecao, ml = {}) {
  const { deps } = mlFalso(ml);
  const v = await C.verificarContasPublicacao({ selecao, dados: DADOS, deps });
  return { v, resumo: C.resumoConfirmacao(v.resultados), plano: C.montarPlanoContas({ selecao, resultados: v.resultados }) };
}

test("13) UMA conta (cada uma sozinha): conferida, confirmada e sem fila", async () => {
  for (const [id, nome] of [[LOJA, "LOJA ONLINE"], [REV, "REVELAÇÃO"], [CIE, "CIEBR"]]) {
    const { v, resumo, plano } = await cenario([id]);
    assert.deepEqual(v.contas, [id]);
    assert.equal(resumo.texto, `Publicar SOMENTE em: ${nome}.`);
    assert.equal(plano.conta_desta_ficha, id);
    assert.deepEqual(plano.fila, []);
  }
});

test("14) DUAS contas (todas as combinações): as duas conferidas, 1ª nesta ficha e 2ª na fila", async () => {
  for (const par of [[LOJA, REV], [LOJA, CIE], [REV, CIE]]) {
    const { v, resumo, plano } = await cenario([...par].reverse());
    assert.deepEqual(v.contas, par, "ordem fixa, independente da ordem dos cliques");
    assert.deepEqual(resumo.contas, par);
    assert.equal(plano.conta_desta_ficha, par[0]);
    assert.deepEqual(plano.fila, [par[1]]);
  }
  const { resumo, plano } = await cenario([LOJA, CIE], { falhaFrete: { [LOJA]: true } });
  assert.equal(resumo.texto, "Publicar SOMENTE em: CIEBR. Fora desta publicação: LOJA ONLINE.", "impedimento na 1ª não trava a 2ª");
  assert.equal(plano.conta_desta_ficha, CIE);
});

test("15) TRÊS contas: impedimento em qualquer uma deixa as outras duas disponíveis", async () => {
  const todas = await cenario([LOJA, REV, CIE]);
  assert.equal(todas.resumo.texto, "Publicar SOMENTE em: LOJA ONLINE, REVELAÇÃO, CIEBR.");
  assert.deepEqual(todas.plano.fila, [REV, CIE]);
  for (const impedida of [LOJA, REV, CIE]) {
    const { v, resumo, plano } = await cenario([LOJA, REV, CIE], { itensSku: { [impedida]: [{ id: "MLB777", sku: "TESTE-CONTAS-001" }] } });
    assert.equal(porConta(v, impedida).situacao, "impedida");
    const outras = [LOJA, REV, CIE].filter((x) => x !== impedida);
    assert.deepEqual(resumo.contas, outras);
    assert.deepEqual([plano.conta_desta_ficha, ...plano.fila], outras);
    assert.deepEqual(plano.impedidas.map((x) => x.conta), [impedida]);
  }
  const nenhuma = await cenario([LOJA, REV, CIE], { conectadas: [] });
  assert.deepEqual(nenhuma.resumo.contas, []);
  assert.equal(nenhuma.plano.conta_desta_ficha, "");
});

// ------------------------- fila de contas -------------------------
test("16) ficha da próxima conta: mesma Conferência, fotos remarcadas para o ID novo, nada da publicação anterior", () => {
  const dados = {
    versao: 2, anuncio: { codigo: "X" }, novo_anuncio: { fotos: ["a.jpg"] }, canais_publicacao: { selecionados: ["mercado_livre"] },
    integracao_bling: { mlb: "MLB1" }, mlbs_anteriores: [1], pos_publicacao: { x: 1 }, contas_publicacao: { fila: [REV] },
    ficha: { campos: { anuncioIdPAIIA: "velho", contaDestinoML: LOJA, fotos: ["a.jpg"], fotosFichaId: "velho:1" }, anuncioConferido: { codigo: "X", fotos: ["a.jpg"], fotosFichaId: "velho:1" }, etapa: "publicacao" },
  };
  const d = C.dadosParaProximaConta(dados, { novoId: "novo", origemId: "velho", origemConta: LOJA, origemMlb: "MLB1", sugeridas: [CIE, REV], marcarFotos: (id) => `${id}:m` });
  for (const k of C.CHAVES_DA_PUBLICACAO_ANTERIOR.filter((k) => k !== "contas_publicacao")) assert.equal(d[k], undefined, k);
  assert.deepEqual(d.canais_publicacao, dados.canais_publicacao);
  assert.equal(d.ficha.campos.anuncioIdPAIIA, "novo");
  assert.equal(d.ficha.campos.contaDestinoML, "");
  assert.equal(d.ficha.campos.fotosFichaId, "novo:m");
  assert.equal(d.ficha.anuncioConferido.fotosFichaId, "novo:m");
  assert.deepEqual(d.contas_publicacao, { versao: 1, pendente: true, sugeridas: [REV, CIE], origem: { ficha: "velho", conta: LOJA, mlb: "MLB1" }, criado_em: d.contas_publicacao.criado_em });
  assert.equal(dados.ficha.campos.anuncioIdPAIIA, "velho", "a ficha publicada não é alterada");
  assert.deepEqual(C.situacaoFila({ fila: [CIE, REV] }), { fila: [REV, CIE], continuacoes: {}, proxima: REV, fichaPreparada: "", vazia: false });
  assert.equal(C.situacaoFila({ fila: [] }).vazia, true);
});

async function fichaPublicadaCom(contas, conta) {
  const dadosConf = { versao: 2, anuncio: { codigo: "TESTE-CONTAS-001" }, ficha: { campos: { quantidadeEstoque: "3", fotos: ["https://x/f1.jpg"] }, anuncioConferido: { codigo: "TESTE-CONTAS-001", fotos: ["https://x/f1.jpg"] }, assinaturaAprovada: "[x]", etapa: "publicacao" } };
  const ap = await salvarFichaAprovada({ anuncioId: "", codigo: "TESTE-CONTAS-001", titulo: "Peça teste", dadosConferencia: dadosConf });
  const res = contas.map((c) => ({ conta: c, nome: C.nomeContaPublicacao(c), situacao: "liberada" }));
  const plano = C.montarPlanoContas({ selecao: contas, resultados: res });
  assert.equal(plano.conta_desta_ficha, conta);
  const r = await registrarContasPublicacao({ anuncioId: ap.anuncioId, plano, codigo: "TESTE-CONTAS-001", titulo: "Peça teste", contaNome: C.nomeContaPublicacao(conta) });
  assert.equal(r.ok, true, r.erro);
  return ap.anuncioId;
}
async function publicar(id, conta, mlb) {
  const reg = registroPublicado({ mlb, contaId: conta, skuOficial: "TESTE-CONTAS-001", produtoBlingId: "1", preco: 10 });
  const r = await registrarMLBPublicado({ anuncioId: id, contaId: conta, mlb, sku: "TESTE-CONTAS-001", registro: reg });
  assert.equal(r.ok, true, r.erro);
}

test("17) fila completa (base FALSA): LOJA ONLINE → REVELAÇÃO → CIEBR, uma ficha por conta, sem duplicar e sem publicar sozinho", async () => {
  zerarBanco();
  const a = await fichaPublicadaCom([LOJA, REV, CIE], LOJA);
  const antes = await prepararFichaProximaConta({ anuncioId: a });
  assert.equal(antes.ok, false);
  assert.equal(antes.naoPublicada, true, "a próxima conta só depois de publicar a 1ª");
  assert.equal(banco.tabelas.paiia_anuncios.length, 1);

  await publicar(a, LOJA, "MLB100000001");
  const b1 = await prepararFichaProximaConta({ anuncioId: a });
  assert.equal(b1.ok, true, b1.erro);
  assert.equal(b1.conta, REV);
  assert.equal(b1.nova, true);
  const b2 = await prepararFichaProximaConta({ anuncioId: a });
  assert.equal(b2.anuncioId, b1.anuncioId, "toque repetido reabre a MESMA ficha");
  assert.equal(b2.nova, false);
  assert.equal(banco.tabelas.paiia_anuncios.length, 2);

  const fb = (await obterAnuncio(b1.anuncioId)).anuncio;
  assert.equal(fb.conta_destino_ml_user_id ?? null, null, "conta da ficha nova só com a confirmação");
  assert.equal(fb.publicacao, null, "nada publicado");
  assert.deepEqual(fb.dados_conferencia.contas_publicacao.sugeridas, [REV, CIE]);
  assert.equal(fb.dados_conferencia.contas_publicacao.origem.mlb, "MLB100000001");
  assert.equal(fb.dados_conferencia.ficha.campos.anuncioIdPAIIA, b1.anuncioId);
  assert.ok(String(fb.dados_conferencia.ficha.campos.fotosFichaId).startsWith(`${b1.anuncioId}:`), "fotos continuam valendo na ficha nova");
  assert.equal(fb.dados_conferencia.integracao_bling, undefined);
  const fa = (await obterAnuncio(a)).anuncio;
  assert.equal(fa.publicacao.mlb_id, "MLB100000001", "ficha publicada intacta");
  assert.equal(fa.dados_conferencia.contas_publicacao.continuacoes[REV].ficha, b1.anuncioId);

  // Na ficha de REVELAÇÃO: conferência dela + confirmação (REVELAÇÃO e CIEBR).
  const planoB = C.montarPlanoContas({ selecao: [REV, CIE], resultados: [{ conta: REV, nome: "REVELAÇÃO", situacao: "liberada" }, { conta: CIE, nome: "CIEBR", situacao: "liberada" }] });
  const rb = await registrarContasPublicacao({ anuncioId: b1.anuncioId, plano: planoB, codigo: "TESTE-CONTAS-001", titulo: "Peça teste", contaNome: "REVELAÇÃO" });
  assert.equal(rb.ok, true, rb.erro);
  const fb2 = (await obterAnuncio(b1.anuncioId)).anuncio;
  assert.equal(fb2.conta_destino_ml_user_id, REV);
  assert.equal(fb2.dados_conferencia.contas_publicacao.origem.ficha, a, "origem da fila preservada");
  assert.equal((await prepararFichaProximaConta({ anuncioId: b1.anuncioId })).naoPublicada, true);
  await publicar(b1.anuncioId, REV, "MLB200000002");
  const c = await prepararFichaProximaConta({ anuncioId: b1.anuncioId });
  assert.equal(c.ok, true, c.erro);
  assert.equal(c.conta, CIE);
  assert.deepEqual((await obterAnuncio(c.anuncioId)).anuncio.dados_conferencia.contas_publicacao.sugeridas, [CIE]);

  const planoC = C.montarPlanoContas({ selecao: [CIE], resultados: [{ conta: CIE, nome: "CIEBR", situacao: "liberada" }] });
  assert.equal((await registrarContasPublicacao({ anuncioId: c.anuncioId, plano: planoC, contaNome: "CIEBR" })).ok, true);
  await publicar(c.anuncioId, CIE, "MLB300000003");
  const fim = await prepararFichaProximaConta({ anuncioId: c.anuncioId });
  assert.equal(fim.ok, false);
  assert.equal(fim.concluida, true, "fila concluída");
  const mlbs = banco.tabelas.paiia_anuncios_publicacoes.map((p) => [p.ml_user_id, p.mlb_id]).sort();
  assert.deepEqual(mlbs, [[CIE, "MLB300000003"], [REV, "MLB200000002"], [LOJA, "MLB100000001"]].sort(), "um MLB por conta, cada um na sua ficha");
});

test("18) fila: ficha da próxima conta cancelada é preparada de novo; ficha com 1 conta não tem fila", async () => {
  zerarBanco();
  const a = await fichaPublicadaCom([LOJA, CIE], LOJA);
  await publicar(a, LOJA, "MLB100000009");
  const b = await prepararFichaProximaConta({ anuncioId: a });
  banco.tabelas.paiia_anuncios.find((x) => x.id === b.anuncioId).status_fluxo = "cancelado";
  const b2 = await prepararFichaProximaConta({ anuncioId: a });
  assert.equal(b2.ok, true);
  assert.notEqual(b2.anuncioId, b.anuncioId);
  assert.equal(b2.conta, CIE);

  zerarBanco();
  const s = await fichaPublicadaCom([REV], REV);
  await publicar(s, REV, "MLB100000010");
  assert.equal((await prepararFichaProximaConta({ anuncioId: s })).concluida, true);
});

test("19) telas da fila: tela final e Publicação mostram a próxima conta; nada publica sozinho", () => {
  const f = ler("src/components/FilaContasPublicacao.jsx");
  assert.ok(f.includes("prepararFichaProximaConta({ anuncioId })") && f.includes("onClick={preparar}"));
  assert.ok(!/useEffect|registrarMLBPublicado|onAutorizar/.test(f), "só prepara a ficha quando você toca");
  assert.ok(ler("src/components/FichaPublicadaPAIIA.jsx").includes("<FilaContasPublicacao anuncioId={ficha?.id || \"\"} plano={ficha?.dados_conferencia?.contas_publicacao || null} />"));
  assert.ok(ler("src/components/MercadoLivreTeste.jsx").includes("<FilaContasPublicacao anuncioId={anuncioIdPAIIA} plano={planoContas} publicada={false} />"));
  assert.ok(ler("src/services/fichasCentral.js").includes('url.searchParams.delete("auto");'), "ficha da próxima conta nunca herda a autorização automática anterior");
});
