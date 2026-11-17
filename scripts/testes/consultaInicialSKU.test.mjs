// =============================================================
// PAIIA — TESTES: consulta inicial pelo SKU no Novo Anúncio (17/11/2026).
// Bling e Mercado Livre SIMULADOS: nada é consultado de verdade e nenhuma
// chamada de escrita existe (os simuladores registram cada chamada).
//   node --test scripts/testes/consultaInicialSKU.test.mjs
//
// Caso real (só o SKU e o nome): 087100 — Válvula Ar Quente Uno 1984–2010,
// já no Bling, disponível 0. IDs, MLBs e saldos abaixo são FICTÍCIOS.
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const C = await import("../../src/services/consultaInicialSKU.js");
const E = C.ESTADO_CONSULTA;
const P = C.PENDENCIA;
const { conferirEstoque } = await import("../../src/services/estoqueBlingPAIIA.js");

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SKU = "087100";
const LOJA = "1729335019";
const CIEBR = "824312524";

function blingSimulado(resposta) {
  const chamadas = [];
  const lerBling = async (sku) => {
    chamadas.push(["saldo_por_sku", sku]);
    if (resposta instanceof Error) throw resposta;
    return typeof resposta === "function" ? resposta(sku) : resposta;
  };
  return { lerBling, chamadas };
}

/** ML simulado: itens por conta; só GET (ml_consulta). Registra toda chamada. */
function mlSimulado({ itens = {}, falha = "" } = {}) {
  const chamadas = [];
  const consultarML = async (conta, caminho) => {
    chamadas.push({ conta, caminho, metodo: "GET" });
    if (falha) return { ok: false, erro: falha };
    const lista = itens[conta] || [];
    if (caminho.includes("/items/search")) {
      const q = decodeURIComponent((caminho.match(/(?:seller_sku|q)=([^&]+)/) || [])[1] || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      const achados = lista.filter((it) => JSON.stringify(it).toUpperCase().replace(/[^A-Z0-9]/g, "").includes(q)).map((it) => it.id);
      return { ok: true, dados: { results: achados, paging: { total: achados.length } } };
    }
    const id = caminho.replace("/items/", "");
    const it = Object.values(itens).flat().find((x) => x.id === id);
    return it ? { ok: true, dados: it } : { ok: false, erro: "não encontrado" };
  };
  return { consultarML, chamadas };
}

const PRODUTO_087100 = { ok: true, encontrado: true, produto: { id: "16000000001", codigo: "087100", nome: "Válvula Ar Quente Uno 1984-2010" }, saldoFisicoTotal: 0, saldoVirtualTotal: 0, depositos: [{ descricao: "Geral", saldoFisico: 0, saldoVirtual: 0 }] };

test("1. caso 087100: produto no Bling com disponível 0 → pendência de estoque logo no início, com a frase pedida", async () => {
  const b = blingSimulado(PRODUTO_087100);
  const m = mlSimulado();
  const r = await C.consultarSKUInicial({ codigo: SKU, conta: LOJA, nomeConta: "LOJA ONLINE", lerBling: b.lerBling, consultarML: m.consultarML });
  assert.equal(r.bling.estado, E.ENCONTRADO);
  assert.equal(r.bling.produto.id, "16000000001");
  assert.equal(r.bling.produto.nome, "Válvula Ar Quente Uno 1984-2010");
  assert.equal(r.bling.fisico, 0);
  assert.equal(r.bling.disponivel, 0);
  assert.deepEqual(r.bling.depositos.map((d) => d.nome), ["Geral"]);
  assert.equal(r.bling.texto, "Produto encontrado no Bling. Estoque disponível: 0. Regularizar estoque para publicar.");
  assert.deepEqual(C.pendenciasConsulta(r), [P.ESTOQUE_ZERO]);
  assert.equal(C.podeSeguirParaPublicar(r), false);
  assert.match(C.textoEstoque(r.bling), /físico 0 · disponível 0 · depósito Geral/);
  // Bling e ML conferidos separadamente: produto no Bling NÃO cria anúncio no ML.
  assert.equal(r.ml.estado, E.NAO_ENCONTRADO);
  assert.equal(r.ml.anuncios.length, 0);
});

test("2. Regularizar estoque: abre o produto certo pelo ID e só orienta (nenhuma escrita)", async () => {
  const b = blingSimulado(PRODUTO_087100);
  const r = await C.consultarBlingInicial({ codigo: SKU, lerBling: b.lerBling });
  assert.equal(C.linkProdutoBling(r.produto.id), "https://www.bling.com.br/produtos.php#edit/16000000001");
  const guia = C.orientacaoRegularizarEstoque(r, SKU).join(" ");
  assert.match(guia, /ID 16000000001/);
  assert.match(guia, /não altera a quantidade/);
  assert.match(guia, /depósito Geral/);
  assert.deepEqual(b.chamadas, [["saldo_por_sku", SKU]], "só a leitura do saldo");
});

test("3. Verificar estoque novamente: relê SÓ o Bling e libera quando o disponível sobe (ficha não é refeita)", async () => {
  let saldo = 0;
  const b = blingSimulado(() => ({ ...PRODUTO_087100, saldoFisicoTotal: saldo, saldoVirtualTotal: saldo }));
  const m = mlSimulado();
  const r1 = await C.consultarSKUInicial({ codigo: SKU, conta: LOJA, lerBling: b.lerBling, consultarML: m.consultarML });
  assert.deepEqual(C.pendenciasConsulta(r1), [P.ESTOQUE_ZERO]);
  const chamadasML = m.chamadas.length;
  saldo = 3; // o usuário lançou a entrada no Bling
  const r2 = { ...r1, bling: await C.consultarBlingInicial({ codigo: SKU, lerBling: b.lerBling }) };
  assert.equal(r2.bling.disponivel, 3);
  assert.equal(r2.bling.pendencia, "");
  assert.equal(C.podeSeguirParaPublicar(r2), true);
  assert.equal(m.chamadas.length, chamadasML, "reler o estoque não reconsulta o ML");
});

test("4. anúncio já existente na conta selecionada (inclusive em variação): conta, MLB, título, situação e link; sem criar outro", async () => {
  const m = mlSimulado({ itens: { [LOJA]: [
    { id: "MLB9000000001", seller_id: LOJA, status: "active", title: "Válvula Ar Quente Fiat Uno", attributes: [], variations: [{ id: 1, attribute_combinations: [], attributes: [{ id: "SELLER_SKU", value_name: "087100" }] }], permalink: "https://produto.mercadolivre.com.br/MLB-9000000001-valvula" },
  ] } });
  const r = await C.consultarMLInicial({ codigo: SKU, conta: LOJA, nome: "LOJA ONLINE", consultarML: m.consultarML });
  assert.equal(r.estado, E.ENCONTRADO);
  assert.equal(r.pendencia, P.ML_DUPLICADO);
  assert.equal(r.nome, "LOJA ONLINE");
  assert.deepEqual(r.anuncios.map((a) => [a.mlb, a.titulo, a.situacao]), [["MLB9000000001", "Válvula Ar Quente Fiat Uno", "ativo"]]);
  assert.equal(r.anuncios[0].link, "https://produto.mercadolivre.com.br/MLB-9000000001");
  assert.match(r.texto, /possível duplicidade/);
  assert.ok(m.chamadas.every((c) => c.metodo === "GET" && c.conta === LOJA), "só leitura e só a conta selecionada");
});

test("5. MLB de outro SKU (código no título) não é vinculado: fica como 'possível — confira'", async () => {
  const m = mlSimulado({ itens: { [LOJA]: [
    { id: "MLB9000000002", seller_id: LOJA, status: "paused", title: "Kit 087100 + junta", attributes: [{ id: "SELLER_SKU", value_name: "KIT-555" }], variations: [] },
  ] } });
  const r = await C.consultarMLInicial({ codigo: SKU, conta: LOJA, consultarML: m.consultarML });
  assert.equal(r.estado, E.POSSIVEL);
  assert.equal(r.anuncios.length, 0, "nunca conta como anúncio deste SKU");
  assert.equal(r.possiveis[0].mlb, "MLB9000000002");
  assert.equal(r.possiveis[0].situacao, "pausado");
});

test("6. anúncio do mesmo SKU em OUTRA conta não aparece na conta selecionada", async () => {
  const m = mlSimulado({ itens: { [CIEBR]: [{ id: "MLB9000000003", seller_id: CIEBR, status: "active", title: "Válvula", attributes: [{ id: "SELLER_SKU", value_name: "087100" }] }] } });
  const r = await C.consultarMLInicial({ codigo: SKU, conta: LOJA, consultarML: m.consultarML });
  assert.equal(r.estado, E.NAO_ENCONTRADO);
  assert.ok(m.chamadas.every((c) => c.conta === LOJA));
});

test("7. falha do Bling → 'não foi possível verificar', nunca 'não existe'", async () => {
  for (const resp of [new Error("rede caiu"), { ok: false, erro: "401" }, null, { ok: false, mensagem: "o Bling não respondeu em 40 s" }]) {
    const r = await C.consultarBlingInicial({ codigo: SKU, lerBling: blingSimulado(resp).lerBling });
    assert.equal(r.estado, E.NAO_VERIFICADO);
    assert.equal(r.pendencia, P.BLING_NAO_VERIFICADO);
    assert.match(r.texto, /Não foi possível verificar/);
    assert.match(r.texto, /NÃO quer dizer que o produto não existe/);
  }
  const lento = await C.consultarBlingInicial({ codigo: SKU, lerBling: () => new Promise(() => {}), tempoMaximoMs: 20 });
  assert.equal(lento.estado, E.NAO_VERIFICADO);
  assert.match(lento.texto, /tempo esgotado/);
});

test("8. falha do ML, conta não conectada ou sem conta → 'não foi possível verificar'", async () => {
  const falha = await C.consultarMLInicial({ codigo: SKU, conta: LOJA, consultarML: mlSimulado({ falha: "403" }).consultarML });
  assert.equal(falha.estado, E.NAO_VERIFICADO);
  assert.match(falha.texto, /NÃO quer dizer que não há anúncio/);
  const m = mlSimulado();
  const desconectada = await C.consultarMLInicial({ codigo: SKU, conta: CIEBR, conectada: false, consultarML: m.consultarML });
  assert.equal(desconectada.estado, E.NAO_VERIFICADO);
  assert.match(desconectada.texto, /não conectada/);
  const semConta = await C.consultarMLInicial({ codigo: SKU, conta: "", consultarML: m.consultarML });
  assert.equal(semConta.estado, E.NAO_VERIFICADO);
  assert.equal(m.chamadas.length, 0, "sem conta conectada, nada é chamado");
});

test("9. Bling devolve produto com OUTRO código → não é aproveitado", async () => {
  const r = await C.consultarBlingInicial({ codigo: SKU, lerBling: blingSimulado({ ok: true, encontrado: true, produto: { id: "77", codigo: "087101", nome: "Outra" }, saldoVirtualTotal: 5 }).lerBling });
  assert.equal(r.estado, E.OUTRO_CODIGO);
  assert.equal(r.pendencia, P.BLING_OUTRO_CODIGO);
  assert.equal(r.disponivel, null, "estoque de outro produto não é usado");
});

test("10. Bling ambíguo, não encontrado, estoque positivo e saldo não lido", async () => {
  const amb = C.avaliarBlingInicial({ ambiguo: true, candidatos: [{ id: 1, codigo: "087100" }, { id: 2, codigo: "87100" }] }, SKU);
  assert.equal(amb.pendencia, P.BLING_AMBIGUO);
  const nao = C.avaliarBlingInicial({ ok: true, encontrado: false }, SKU);
  assert.equal(nao.estado, E.NAO_ENCONTRADO);
  assert.equal(nao.pendencia, "");
  const ok = C.avaliarBlingInicial({ ...PRODUTO_087100, saldoFisicoTotal: 4, saldoVirtualTotal: 4, depositos: undefined }, SKU);
  assert.equal(ok.pendencia, "");
  assert.match(C.textoEstoque(ok), /depósito não informado pelo Bling/);
  const semSaldo = C.avaliarBlingInicial({ ok: false, encontrado: true, produto: PRODUTO_087100.produto, mensagem: "saldo indisponível" }, SKU);
  assert.equal(semSaldo.pendencia, P.ESTOQUE_NAO_LIDO);
});

test("11. código curto não consulta; ML e Bling correm em paralelo", async () => {
  const b = blingSimulado(PRODUTO_087100);
  const m = mlSimulado();
  assert.equal(await C.consultarSKUInicial({ codigo: "08", conta: LOJA, lerBling: b.lerBling, consultarML: m.consultarML }), null);
  assert.equal(b.chamadas.length + m.chamadas.length, 0);
  let ordem = [];
  const lerBling = async () => { ordem.push("bling-inicio"); await new Promise((ok) => setTimeout(ok, 30)); ordem.push("bling-fim"); return PRODUTO_087100; };
  const consultarML = async (conta, caminho) => { ordem.push("ml"); return m.consultarML(conta, caminho); };
  await C.consultarSKUInicial({ codigo: SKU, conta: LOJA, lerBling, consultarML });
  assert.ok(ordem.indexOf("ml") < ordem.indexOf("bling-fim"), "o ML não espera o Bling");
});

test("12. Publicação: disponível 0 no Bling → mensagem de estoque (não de cadastro)", () => {
  const r = conferirEstoque({ quantidade: 1, confirmada: true, bling: PRODUTO_087100 });
  assert.equal(r.nivel, "erro");
  assert.equal(r.estoqueZero, true);
  assert.match(r.texto, /Estoque disponível: 0\. Regularizar estoque para publicar\./);
  assert.equal(conferirEstoque({ quantidade: 1, confirmada: true, bling: { ...PRODUTO_087100, saldoVirtualTotal: 2 } }).nivel, "ok");
});

test("13. telas novas: nenhuma escrita no Bling ou no ML, nada publicado, estoque nunca alterado", () => {
  const fontes = ["src/components/AvisoSKU.jsx", "src/services/consultaInicialSKU.js"].map((f) => fs.readFileSync(path.join(raiz, f), "utf8"));
  for (const s of fontes) {
    for (const proibido of ["criar_produto", "lancar_estoque", "estoque_inicial", "acao: \"publicar", "definirContaMLAtiva", "metodo: \"POST\"", "metodo: \"PUT\"", "registrarProdutoBling", "aplicarGravacoesRegistro"]) {
      assert.ok(!s.includes(proibido), `não pode conter ${proibido}`);
    }
  }
  const tela = fontes[0];
  assert.match(tela, /Regularizar estoque no Bling/);
  assert.match(tela, /Verificar estoque novamente e continuar/);
  assert.match(tela, /Abrir anúncio existente/);
  const na = fs.readFileSync(path.join(raiz, "src/components/NovoAnuncio.jsx"), "utf8");
  assert.match(na, /avisoCodigo=\{<AvisoSKU codigo=\{codigo\}/);
  assert.ok(!na.includes("data-paiia-conferir-sku"), "sem botão Conferir: a consulta é automática");
  assert.ok(!na.includes("data-paiia-consulta-inicial"), "sem o painel grande");
  const dp = fs.readFileSync(path.join(raiz, "src/components/DadosPrincipaisAnuncio.jsx"), "utf8");
  assert.match(dp, /placeholder="Código da peça"[\s\S]{0,80}\{avisoCodigo\}/, "aviso logo abaixo do campo Código");
  assert.match(tela, /ESPERA_DIGITACAO_SKU_MS/, "consulta sozinha depois de uma pausa na digitação");
  const rev = fs.readFileSync(path.join(raiz, "src/components/RevisaoPublicacaoML.jsx"), "utf8");
  assert.match(rev, /data-paiia-bling-estoque-zero/);
  assert.match(rev, /onClick=\{relerBling\}[^>]*>Verificar estoque novamente e continuar/);
});

test("14. links: só MLB válido e só endereço do Mercado Livre", () => {
  assert.equal(C.linkAnuncioML("MLB1234567"), "https://produto.mercadolivre.com.br/MLB-1234567");
  assert.equal(C.linkAnuncioML("MLB1234567", "https://golpe.example/x"), "https://produto.mercadolivre.com.br/MLB-1234567");
  assert.equal(C.linkAnuncioML("xyz"), "");
  assert.equal(C.linkProdutoBling(""), "");
});

// ---------------- versão rápida: aviso ao lado do SKU ----------------
const FICHA_RASCUNHO = { id: "f-rasc", codigo: SKU, titulo: "Válvula", status_fluxo: "rascunho", updated_at: "2026-11-17T10:00:00Z", publicacao: null };
const FICHA_PUBLICADA_LOJA = { id: "f-pub", codigo: SKU, titulo: "Válvula", status_fluxo: "publicado", updated_at: "2026-11-16T10:00:00Z", publicacao: { ml_user_id: LOJA, mlb_id: "MLB9000000001" } };
const ITEM_LOJA = { id: "MLB9000000001", seller_id: LOJA, status: "active", title: "Válvula Ar Quente", attributes: [{ id: "SELLER_SKU", value_name: "087100" }] };
const fichasSimuladas = (lista, chamadas = []) => async (cod) => { chamadas.push(cod); return { ok: true, anuncios: lista }; };

test("15. com Bling e ML: consulta tudo em paralelo; aviso 'Já existe' com pendência de estoque", async () => {
  const b = blingSimulado(PRODUTO_087100);
  const m = mlSimulado({ itens: { [LOJA]: [ITEM_LOJA] } });
  const r = await C.consultarSKURapido({ codigo: SKU, contas: [{ id: LOJA, nome: "LOJA ONLINE" }, { id: CIEBR, nome: "CIEBR" }], blingConectado: true, lerBling: b.lerBling, consultarML: m.consultarML, lerFichas: fichasSimuladas([FICHA_PUBLICADA_LOJA]) });
  assert.equal(r.resumo.tipo, "existe");
  assert.equal(r.resumo.texto, "Já existe");
  assert.equal(r.resumo.alerta, true);
  assert.equal(r.bling.pendencia, P.ESTOQUE_ZERO);
  assert.deepEqual(r.ml.map((x) => [x.conta, x.estado]), [[LOJA, E.ENCONTRADO], [CIEBR, E.NAO_ENCONTRADO]]);
  // anunciado na LOJA (MLB confirmado com este SKU) e livre na CIEBR → aproveitar para a CIEBR
  assert.deepEqual(r.oportunidades.aproveitar, [{ ficha: "f-pub", conta: CIEBR, nome: "CIEBR" }]);
  assert.equal(r.oportunidades.continuar, null);
  assert.ok(m.chamadas.every((c) => c.metodo === "GET"));
});

test("16. só Mercado Livre (Bling não conectado): o Bling NÃO é consultado nem exigido", async () => {
  const b = blingSimulado(PRODUTO_087100);
  const m = mlSimulado();
  const r = await C.consultarSKURapido({ codigo: SKU, contas: [{ id: LOJA, nome: "LOJA ONLINE" }], blingConectado: false, lerBling: b.lerBling, consultarML: m.consultarML, lerFichas: fichasSimuladas([]) });
  assert.equal(b.chamadas.length, 0);
  assert.equal(r.bling.estado, E.SEM_INTEGRACAO);
  assert.equal(r.bling.pendencia, "");
  assert.equal(r.resumo.tipo, "nao_encontrado");
  assert.equal(r.resumo.texto, "Não encontrado");
});

test("17. só Bling (nenhuma conta ML conectada): o ML não é consultado", async () => {
  const b = blingSimulado({ ok: true, encontrado: false });
  const m = mlSimulado();
  const r = await C.consultarSKURapido({ codigo: SKU, contas: [], blingConectado: true, lerBling: b.lerBling, consultarML: m.consultarML, lerFichas: fichasSimuladas([]) });
  assert.equal(m.chamadas.length, 0);
  assert.deepEqual(r.ml, []);
  assert.equal(r.resumo.tipo, "nao_encontrado");
});

test("18. falha em qualquer parte e nada encontrado → 'Consulta indisponível' (nunca 'Não encontrado')", async () => {
  const r = await C.consultarSKURapido({ codigo: SKU, contas: [{ id: LOJA, nome: "LOJA ONLINE" }], blingConectado: true, lerBling: blingSimulado(new Error("rede")).lerBling, consultarML: mlSimulado().consultarML, lerFichas: fichasSimuladas([]) });
  assert.equal(r.resumo.tipo, "indisponivel");
  assert.equal(r.resumo.texto, "Consulta indisponível");
  const r2 = await C.consultarSKURapido({ codigo: SKU, contas: [{ id: LOJA, nome: "LOJA ONLINE" }], blingConectado: false, consultarML: mlSimulado({ falha: "403" }).consultarML, lerFichas: fichasSimuladas([]) });
  assert.equal(r2.resumo.tipo, "indisponivel");
  const r3 = await C.consultarSKURapido({ codigo: SKU, contas: [], blingConectado: false, lerFichas: async () => ({ ok: false, erro: "base fora" }) });
  assert.equal(r3.resumo.tipo, "indisponivel");
});

test("19. integração lenta não segura o usuário: tempo máximo por parte", async () => {
  const inicio = Date.now();
  const r = await C.consultarSKURapido({ codigo: SKU, contas: [{ id: LOJA, nome: "LOJA ONLINE" }], blingConectado: true, lerBling: () => new Promise(() => {}), consultarML: () => new Promise(() => {}), lerFichas: () => new Promise(() => {}), tempoMaximoMs: 30 });
  assert.ok(Date.now() - inicio < 1000);
  assert.equal(r.resumo.tipo, "indisponivel");
});

test("20. ficha preparada do mesmo SKU → 'Continuar ficha' (a ficha aberta agora não conta)", async () => {
  const r = await C.consultarSKURapido({ codigo: SKU, contas: [], blingConectado: false, lerFichas: fichasSimuladas([FICHA_RASCUNHO, { ...FICHA_RASCUNHO, id: "f-atual" }]), fichaAtualId: "f-atual" });
  assert.equal(r.resumo.tipo, "existe");
  assert.deepEqual(r.oportunidades.continuar, { ficha: "f-rasc", titulo: "Válvula" });
  assert.deepEqual(r.fichas.lista.map((f) => f.id), ["f-rasc"]);
});

test("21. aproveitar só com MLB CONFIRMADO deste SKU e conta destino VERIFICADA livre", async () => {
  // MLB da ficha é de outro SKU no ML → nada a aproveitar
  const outro = { ...ITEM_LOJA, attributes: [{ id: "SELLER_SKU", value_name: "999999" }], title: "Outra peça" };
  const r1 = await C.consultarSKURapido({ codigo: SKU, contas: [{ id: LOJA, nome: "LOJA ONLINE" }, { id: CIEBR, nome: "CIEBR" }], blingConectado: false, consultarML: mlSimulado({ itens: { [LOJA]: [outro] } }).consultarML, lerFichas: fichasSimuladas([FICHA_PUBLICADA_LOJA]) });
  assert.deepEqual(r1.oportunidades.aproveitar, []);
  // conta destino não verificada (falha) → nada a aproveitar
  const m = mlSimulado({ itens: { [LOJA]: [ITEM_LOJA] } });
  const consultarML = (conta, caminho) => (conta === CIEBR ? Promise.resolve({ ok: false, erro: "403" }) : m.consultarML(conta, caminho));
  const r2 = await C.consultarSKURapido({ codigo: SKU, contas: [{ id: LOJA, nome: "LOJA ONLINE" }, { id: CIEBR, nome: "CIEBR" }], blingConectado: false, consultarML, lerFichas: fichasSimuladas([FICHA_PUBLICADA_LOJA]) });
  assert.deepEqual(r2.oportunidades.aproveitar, []);
  assert.equal(r2.resumo.tipo, "existe");
  assert.equal(r2.resumo.incompleto, true);
});

test("22. cache: mesmo SKU não é consultado de novo; falha não fica guardada; pedidos simultâneos viram um", async () => {
  let agora = 0;
  const cache = C.criarCacheConsulta({ validadeMs: 1000, relogio: () => agora });
  let n = 0;
  const consulta = async () => { n++; return { resumo: { tipo: "existe", incompleto: false } }; };
  const chave = C.chaveConsulta({ codigo: "087-100", contas: [{ id: CIEBR }, { id: LOJA }], blingConectado: true });
  assert.equal(chave, C.chaveConsulta({ codigo: "087100", contas: [{ id: LOJA }, { id: CIEBR }], blingConectado: true }));
  await Promise.all([cache.obter(chave, consulta), cache.obter(chave, consulta)]);
  await cache.obter(chave, consulta);
  assert.equal(n, 1);
  agora = 2000;
  await cache.obter(chave, consulta);
  assert.equal(n, 2, "vencido → consulta de novo");
  let f = 0;
  const falha = async () => { f++; return { resumo: { tipo: "indisponivel", incompleto: true } }; };
  await cache.obter("x", falha);
  await cache.obter("x", falha);
  assert.equal(f, 2, "resultado incompleto não é reaproveitado");
});
