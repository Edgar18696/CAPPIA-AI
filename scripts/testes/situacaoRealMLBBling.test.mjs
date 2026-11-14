// =============================================================
// PAIIA — TESTES (14/11/2026): situação REAL do anúncio no Mercado Livre e
// vínculo REAL no Bling (caso SKU 7700762751 / MLB5559219337 / produto Bling
// 16735464254). Tudo com Mercado Livre, Bling e base FALSOS: nada vai ao
// Mercado Livre, ao Bling ou à base real.
//   node --test scripts/testes/situacaoRealMLBBling.test.mjs
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

register("./simulacao/ganchoSupabaseFalso.mjs", import.meta.url);

const { banco, zerarBanco } = await import("./simulacao/supabaseFalso.mjs");
const D = await import("../../src/services/duplicidadeML.js");
const C = await import("../../src/services/contasPublicacaoML.js");
const { textoSituacaoMLBAtual } = await import("../../src/services/situacaoMLBAtual.js");
const { resumoFichaPublicada } = await import("../../src/services/situacaoFichaPublicada.js");
const B = await import("../../src/services/estoqueBlingPAIIA.js");
const { diagnosticarPublicacao } = await import("../../src/services/diagnosticoPublicacao.js");
const S = await import("../../src/services/anuncioPublicacaoService.js");
const { registroPublicado } = await import("../../src/services/vinculoBlingPublicacao.js");

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ler = (rel) => fs.readFileSync(path.join(RAIZ, rel), "utf8").replace(/\r\n/g, "\n");

const LOJA = "1729335019";
const REV = "2412238242";
const CIE = "824312524";
const SKU = "7700762751";
const MLB_LOJA = "MLB5559219337";
const MLB_REV = "MLB7995352352";
const PROD = "16735464254";
const LOJA_BLING = "204883484";

const itemML = (id, seller, extra = {}) => ({ id, seller_id: Number(seller), status: "active", sub_status: [], price: 48, title: "Alavanca Trava Fechadura Porta Traseira Trafic 7700762751", attributes: [{ id: "SELLER_SKU", value_name: SKU }], ...extra });

// ------------------------------------------------------------------
test("1) situação real no ML: ativo, pausado, encerrado e excluído são diferentes", () => {
  assert.equal(D.classificarSituacaoML({ status: "active" }), "ativo");
  assert.equal(D.classificarSituacaoML({ status: "paused" }), "pausado");
  assert.equal(D.classificarSituacaoML({ status: "closed" }), "encerrado");
  assert.equal(D.classificarSituacaoML({ status: "inactive", sub_status: ["deleted"] }), "excluido");
  assert.equal(D.classificarSituacaoML({ status: "closed", sub_status: ["deleted"] }), "excluido", "excluído vence encerrado");
  assert.equal(D.classificarSituacaoML({ status: "under_review" }), "em_revisao");
  assert.equal(D.classificarSituacaoML({ status: "inactive" }), "inativo");
  assert.equal(D.classificarSituacaoML(null), "desconhecida");

  const resp = (extra) => ({ ok: true, dados: itemML(MLB_LOJA, LOJA, extra) });
  const enc = D.situacaoMLBRegistrado({ mlb: MLB_LOJA, conta: LOJA, resp: resp({ status: "closed", price: 46.08 }) });
  assert.equal(enc.libera, true);
  assert.equal(enc.situacao, "encerrado");
  assert.equal(enc.preco, 46.08);
  assert.equal(D.situacaoMLBRegistrado({ mlb: MLB_LOJA, conta: LOJA, resp: resp({ status: "paused" }) }).libera, false, "pausado continua existindo");
  assert.equal(D.situacaoMLBRegistrado({ mlb: MLB_LOJA, conta: REV, resp: resp({}) }).libera, false, "outra conta não libera");
  assert.equal(D.situacaoMLBRegistrado({ mlb: MLB_LOJA, conta: LOJA, resp: { ok: false, erro: "timeout" } }).situacao, "nao_confirmada");

  assert.match(textoSituacaoMLBAtual({ mlb: MLB_LOJA, conta: LOJA, resp: resp({ status: "closed" }) }).texto, /^anúncio encerrado \(finalizado\)/);
  assert.match(textoSituacaoMLBAtual({ mlb: MLB_LOJA, conta: LOJA, resp: resp({ status: "inactive", sub_status: ["deleted"] }) }).texto, /^anúncio excluído/);
  assert.match(textoSituacaoMLBAtual({ mlb: MLB_LOJA, conta: LOJA, resp: resp({ status: "paused" }) }).texto, /^anúncio pausado/);
  const t = textoSituacaoMLBAtual({ mlb: MLB_LOJA, conta: LOJA, resp: resp({ status: "closed" }) });
  assert.equal(t.registro.libera, true, "leitura completa vai junto (para retomar com segurança)");
});

// ------------------------------------------------------------------
test("2) tela final: anúncio encerrado NUNCA aparece como 'Publicado' ou 'Fluxo concluído'; histórico separado", () => {
  const base = { publicadoOk: true, integrado: true, publicadoEm: "2026-11-14T11:53:20Z" };
  const enc = resumoFichaPublicada({ ...base, situacaoML: { excluido: true, situacao: "encerrado", confirmada: true } });
  assert.equal(enc.concluido, false);
  assert.equal(enc.encerrado, true);
  assert.match(enc.titulo, /encerrado no Mercado Livre/);
  assert.doesNotMatch(enc.situacaoAtual, /Publicado|concluído/);
  assert.match(enc.historico, /^Publicado em 14\/11\/2026.*integrado ao Bling/);

  const exc = resumoFichaPublicada({ ...base, situacaoML: { excluido: true, situacao: "excluido", confirmada: true } });
  assert.match(exc.titulo, /excluído no Mercado Livre/);

  const ativo = resumoFichaPublicada({ ...base, situacaoML: { excluido: false, situacao: "ativo", confirmada: true } });
  assert.equal(ativo.concluido, true);
  assert.equal(ativo.titulo, "fluxo concluído");

  const lendo = resumoFichaPublicada({ ...base, situacaoML: { carregando: true } });
  assert.equal(lendo.concluido, false, "enquanto confere, não afirma 'concluído'");
  const semLeitura = resumoFichaPublicada({ ...base, situacaoML: { confirmada: false, situacao: "nao_confirmada", texto: "não foi possível confirmar (timeout)" } });
  assert.equal(semLeitura.concluido, false);
  assert.match(semLeitura.situacaoAtual, /Não confirmada/);

  const fp = ler("src/components/FichaPublicadaPAIIA.jsx");
  assert.ok(fp.includes("resumoFichaPublicada({") && fp.includes("data-paiia-final-historico"));
  assert.ok(!fp.includes('"Publicado com pendência" : publicadoOk ? "Publicado"'), "rótulo fixo 'Publicado' saiu");
  assert.ok(fp.includes("data-paiia-retomar") && fp.includes("prepararFichaRepublicacao({ anuncioId: ficha.id, situacao: situacaoML.registro })"));
  assert.ok(fp.includes("disabled={retomar.ocupado || !situacaoML.registro?.libera}"), "retomar só com o ML confirmando o encerramento");
  assert.equal(/mercadolivre-publicacao|"publicar"|registrarResultadoPublicacao|registrarMLBPublicado|salvarFicha|criar_produto/.test(fp), false, "tela final não publica, não regrava a ficha e não cria no Bling");
});

// ------------------------------------------------------------------
/** Mercado Livre FALSO por conta (só GET): itens por conta, com status. */
function mlFalso({ itens = {}, registros = {}, falha = {} } = {}) {
  const chamadas = [];
  const deps = {
    conectada: () => true,
    modalidades: async () => ({ ok: true, modalidades: [{ tipo: "drop_off", padrao: true }] }),
    consultar: (id) => async (caminho) => {
      chamadas.push({ conta: id, caminho });
      if (caminho.includes("/shipping_options/free")) return { ok: true, status: 200, dados: { coverage: { all_country: { list_cost: 6.85, billable_weight: 250, currency_id: "BRL" } } } };
      if (caminho.includes("/items/search")) {
        // A busca do ML NÃO devolve anúncio encerrado (como no caso real).
        const ativos = Object.values(itens[id] || {}).filter((it) => !D.anuncioEncerradoML(it)).map((it) => it.id);
        return { ok: true, dados: { results: ativos, paging: { total: ativos.length } } };
      }
      const m = caminho.match(/^\/items\/(MLB\d+)$/);
      if (m) {
        if (falha[m[1]]) return { ok: false, erro: falha[m[1]] };
        const it = Object.values(itens).map((x) => x[m[1]]).find(Boolean);
        return it ? { ok: true, dados: it } : { ok: false, status: 404, erro: "not_found" };
      }
      return { ok: false, erro: `caminho inesperado ${caminho}` };
    },
    duplicidadeBase: async ({ contaId }) => ({ ok: true, registros: registros[contaId] || [] }),
    duplicidadeML: (a) => D.verificarDuplicidadeML(a),
  };
  return { deps, chamadas };
}
const DADOS = { sku: SKU, codigo: SKU, preco: "48,00", quantidade: "1", medida: { peso_g: 250, comprimento_cm: 15, largura_cm: 10, altura_cm: 10 }, registroFrete: { conta: REV, modalidade: "drop_off", categoria: "MLB194431", tipoAnuncio: "classico", base: { custo: 18.6, despesas: 0, comissao: 12, imposto: 8 }, medida: { peso_g: 250, comprimento_cm: 15, largura_cm: 10, altura_cm: 10 } } };
const porConta = (v, id) => v.resultados.find((r) => r.conta === id);

test("3) publicação: MLB registrado ENCERRADO no ML não bloqueia (vira histórico); ativo/pausado/sem leitura bloqueiam", async () => {
  const regLoja = { [LOJA]: [{ id: "p1", anuncio_id: "dc8788d6", mlb_id: MLB_LOJA, status_publicacao: "publicado" }] };

  // Caso real: MLB5559219337 encerrado na LOJA ONLINE.
  const enc = mlFalso({ itens: { [LOJA]: { [MLB_LOJA]: itemML(MLB_LOJA, LOJA, { status: "closed", price: 46.08 }) } }, registros: regLoja });
  const v1 = await C.verificarContasPublicacao({ selecao: [LOJA, REV, CIE], dados: DADOS, deps: enc.deps });
  const loja = porConta(v1, LOJA);
  assert.equal(loja.situacao, "liberada", JSON.stringify(loja.itens));
  const dup = loja.itens.find((i) => i.item === "Duplicidade");
  assert.equal(dup.nivel, "ok");
  assert.match(dup.texto, /Histórico: MLB5559219337 encerrado \(finalizado\) no Mercado Livre — não bloqueia/);
  assert.deepEqual(loja.duplicidade.anteriores.map((a) => [a.mlb, a.situacao]), [[MLB_LOJA, "encerrado"]]);
  assert.ok(enc.chamadas.some((c) => c.conta === LOJA && c.caminho === `/items/${MLB_LOJA}`), "MLB registrado lido NA conta dele");
  assert.equal(porConta(v1, REV).situacao, "liberada");

  // Excluído também libera.
  const exc = mlFalso({ itens: { [LOJA]: { [MLB_LOJA]: itemML(MLB_LOJA, LOJA, { status: "inactive", sub_status: ["deleted"] }) } }, registros: regLoja });
  assert.equal(porConta(await C.verificarContasPublicacao({ selecao: [LOJA], dados: DADOS, deps: exc.deps }), LOJA).situacao, "liberada");

  // Pausado = ainda existe: bloqueia.
  const pau = mlFalso({ itens: { [LOJA]: { [MLB_LOJA]: itemML(MLB_LOJA, LOJA, { status: "paused" }) } }, registros: regLoja });
  const vp = porConta(await C.verificarContasPublicacao({ selecao: [LOJA], dados: DADOS, deps: pau.deps }), LOJA);
  assert.equal(vp.situacao, "impedida");
  assert.match(vp.impedimentos.join(" "), /já tem anúncio nesta conta: MLB5559219337 \(paused\)/);

  // Sem leitura do ML para o MLB registrado: bloqueia (na dúvida, nunca libera).
  const sem = mlFalso({ itens: { [LOJA]: {} }, registros: regLoja, falha: { [MLB_LOJA]: "timeout" } });
  const vs = porConta(await C.verificarContasPublicacao({ selecao: [LOJA, CIE], dados: DADOS, deps: sem.deps }), LOJA);
  assert.equal(vs.situacao, "impedida");
  assert.match(vs.impedimentos.join(" "), /ainda existe ou não pôde ser confirmada.*MLB5559219337 \(não foi possível confirmar no Mercado Livre \(timeout\)\)/);
});

// ------------------------------------------------------------------
test("4) Bling: SKU fora da busca + produto 16735464254 registrado = NÃO cria outro produto", () => {
  const fichas = [
    { id: "dc8788d6", publicacao: { bling_produto_id: PROD, mlb_id: MLB_LOJA, ml_user_id: LOJA }, integracao_bling: { bling_produto_id: PROD, mlb: MLB_LOJA } },
    { id: "05183a61", publicacao: { bling_produto_id: "", mlb_id: MLB_REV, ml_user_id: REV }, integracao_bling: { bling_produto_id: "" } },
    { id: "atual", publicacao: null },
  ];
  const regs = B.produtosBlingRegistradosDoSku(fichas, { excetoFicha: "atual" });
  assert.deepEqual(regs, [{ produto_id: PROD, ficha: "dc8788d6", mlb: MLB_LOJA, conta: LOJA }], "um produto, sem repetir");

  const naoAchou = { ok: true, encontrado: false };
  const dec = B.decidirCriacaoBling(naoAchou, { registrados: regs });
  assert.equal(dec.acao, "produto_registrado");
  assert.match(dec.motivo, /produto Bling 16735464254 \(MLB MLB5559219337\).*inativo, excluído ou com o código alterado.*NÃO cria outro produto/);
  assert.equal(B.decidirCriacaoBling(naoAchou).acao, "criar", "SKU novo de verdade continua podendo ser criado");
  assert.equal(B.decidirCriacaoBling({ ok: false, erro: "fora do ar" }, { registrados: regs }).acao, "erro");

  assert.equal(B.situacaoProdutoBling({ leitura: naoAchou, registrados: regs }).estado, "fora_da_busca");
  assert.equal(B.situacaoProdutoBling({ leitura: { ok: true, encontrado: true, produto: { id: PROD, codigo: SKU } }, registrados: regs }).estado, "ok");
  const outro = B.situacaoProdutoBling({ leitura: { ok: true, encontrado: true, produto: { id: "999", codigo: SKU } }, registrados: regs });
  assert.equal(outro.estado, "outro_id");
  assert.match(outro.texto, /dois cadastros do mesmo SKU/);
  assert.equal(B.situacaoProdutoBling({ leitura: naoAchou, registrados: [] }).estado, "nao_existe");

  const rv = ler("src/components/RevisaoPublicacaoML.jsx");
  assert.ok(rv.includes("produtosBlingRegistradosDoSku(ficha.outros, { excetoFicha: ficha.anuncioId })"));
  assert.ok(/async function criarProdutoBling\(\) \{\n\s+if \(cadastroBling\.faltando\.length\) return;\n[^\n]*\n\s+if \(produtosBlingDoSku\.length\) return;/.test(rv), "criação bloqueada no próprio clique");
  const i = rv.indexOf('data-paiia-bling-estado="fora-da-busca"');
  const j = rv.indexOf('data-paiia-bling-estado="nao-encontrado"');
  assert.ok(i > 0 && j > i, "o aviso vem ANTES do caminho que oferece criar");
  assert.equal(rv.slice(i, j).includes("Criar produto no Bling"), false, "no aviso não há botão de criar");
});

// ------------------------------------------------------------------
async function fichaPublicada({ conta, mlb, produto = PROD }) {
  const dadosConf = {
    versao: 2,
    anuncio: { codigo: SKU, descricao: "Alavanca Trava Fechadura Porta Traseira\n\nAplicação: Renault Trafic 1989 a 2001" },
    ficha: {
      campos: { quantidadeEstoque: "1", fotos: ["https://x/f1.png", "https://x/f2.png", "https://x/f3.png"], descricao: "Alavanca…", aplicacoes: [{ montadora: "Renault", modelo: "Trafic", ano_inicio: 1989, ano_fim: 2001 }] },
      anuncioConferido: { codigo: SKU, preco: 48, fotos: ["https://x/f1.png", "https://x/f2.png", "https://x/f3.png"], aplicacoes: [{ montadora: "Renault", modelo: "Trafic", ano_inicio: 1989, ano_fim: 2001 }] },
      assinaturaAprovada: "[x]",
      etapa: "publicacao",
    },
  };
  const ap = await S.salvarFichaAprovada({ anuncioId: "", codigo: SKU, titulo: "Alavanca Trava Fechadura Porta Traseira Trafic", dadosConferencia: dadosConf });
  assert.equal(ap.ok, true, ap.erro);
  const plano = C.montarPlanoContas({ selecao: [conta], resultados: [{ conta, nome: C.nomeContaPublicacao(conta), situacao: "liberada" }] });
  assert.equal((await S.registrarContasPublicacao({ anuncioId: ap.anuncioId, plano, codigo: SKU, titulo: "Alavanca", contaNome: C.nomeContaPublicacao(conta) })).ok, true);
  const reg = registroPublicado({ mlb, contaId: conta, skuOficial: SKU, produtoBlingId: produto, preco: 48 });
  const r = await S.registrarMLBPublicado({ anuncioId: ap.anuncioId, contaId: conta, mlb, sku: SKU, registro: reg });
  assert.equal(r.ok, true, r.erro);
  return ap.anuncioId;
}

test("5) retomar ficha de MLB encerrado (base FALSA): ficha nova com fotos/descrição/aplicações; histórico intacto; sem duplicar", async () => {
  zerarBanco();
  const antiga = await fichaPublicada({ conta: LOJA, mlb: MLB_LOJA });
  const pubAntes = JSON.stringify((await S.obterAnuncio(antiga)).anuncio.publicacao);

  // Sem o ML confirmar o encerramento: não retoma.
  const ativo = D.situacaoMLBRegistrado({ mlb: MLB_LOJA, conta: LOJA, resp: { ok: true, dados: itemML(MLB_LOJA, LOJA) } });
  const r0 = await S.prepararFichaRepublicacao({ anuncioId: antiga, situacao: ativo });
  assert.equal(r0.ok, false);
  assert.match(r0.erro, /não confirmou que o MLB5559219337 está encerrado ou excluído/);
  const deOutro = D.situacaoMLBRegistrado({ mlb: "MLB111", conta: LOJA, resp: { ok: true, dados: itemML("MLB111", LOJA, { status: "closed" }) } });
  assert.equal((await S.prepararFichaRepublicacao({ anuncioId: antiga, situacao: deOutro })).ok, false, "leitura de OUTRO MLB não serve");
  assert.equal(banco.tabelas.paiia_anuncios.length, 1, "nada criado");

  const encerrado = D.situacaoMLBRegistrado({ mlb: MLB_LOJA, conta: LOJA, resp: { ok: true, dados: itemML(MLB_LOJA, LOJA, { status: "closed", price: 46.08 }) } });
  const r1 = await S.prepararFichaRepublicacao({ anuncioId: antiga, situacao: encerrado });
  assert.equal(r1.ok, true, r1.erro);
  assert.equal(r1.nova, true);
  const r2 = await S.prepararFichaRepublicacao({ anuncioId: antiga, situacao: encerrado });
  assert.equal(r2.anuncioId, r1.anuncioId, "toque repetido reabre a MESMA ficha");
  assert.equal(banco.tabelas.paiia_anuncios.length, 2);

  const nova = (await S.obterAnuncio(r1.anuncioId)).anuncio;
  const dc = nova.dados_conferencia;
  assert.equal(nova.publicacao, null, "nada publicado");
  assert.equal(nova.conta_destino_ml_user_id ?? null, null, "conta só com a conferência e a confirmação");
  assert.deepEqual(dc.ficha.campos.fotos, ["https://x/f1.png", "https://x/f2.png", "https://x/f3.png"], "fotos preservadas");
  assert.ok(String(dc.ficha.campos.fotosFichaId).startsWith(`${r1.anuncioId}:`), "fotos valendo na ficha nova");
  assert.deepEqual(dc.ficha.anuncioConferido.aplicacoes, [{ montadora: "Renault", modelo: "Trafic", ano_inicio: 1989, ano_fim: 2001 }], "aplicações preservadas");
  assert.match(dc.anuncio.descricao, /Renault Trafic 1989 a 2001/, "descrição preservada");
  assert.equal(dc.ficha.anuncioConferido.preco, 48, "preço aprovado preservado");
  assert.equal(dc.integracao_bling, undefined, "vínculo Bling da publicação antiga NÃO é reaproveitado");
  assert.equal(dc.republicacao, undefined);
  assert.deepEqual(dc.contas_publicacao.sugeridas, [LOJA]);
  assert.equal(dc.contas_publicacao.origem.motivo, "republicacao");
  assert.equal(dc.contas_publicacao.origem.mlb, MLB_LOJA);
  assert.equal(dc.mlbs_anteriores.length, 1);
  assert.equal(dc.mlbs_anteriores[0].mlb, MLB_LOJA);
  assert.equal(dc.mlbs_anteriores[0].situacao, "encerrado_no_ml");
  assert.equal(dc.mlbs_anteriores[0].preco_no_ml, 46.08);
  assert.equal(dc.mlbs_anteriores[0].bling_produto_id, PROD);

  const velha = (await S.obterAnuncio(antiga)).anuncio;
  assert.equal(JSON.stringify(velha.publicacao), pubAntes, "publicação antiga (histórico) intacta");
  assert.equal(velha.dados_conferencia.republicacao.ficha, r1.anuncioId);
  assert.equal(velha.dados_conferencia.integracao_bling.bling_produto_id, PROD, "registro Bling antigo intacto");
  assert.ok(S.CHAVES_PRESERVADAS_FICHA.includes("republicacao"));
  assert.ok(C.CHAVES_DA_PUBLICACAO_ANTERIOR.includes("republicacao"), "ponteiro não passa para a ficha nova");

  // A ficha nova passa pela conferência ao vivo: LOJA ONLINE liberada porque o MLB antigo está encerrado.
  const ml = mlFalso({ itens: { [LOJA]: { [MLB_LOJA]: itemML(MLB_LOJA, LOJA, { status: "closed" }) } }, registros: { [LOJA]: banco.tabelas.paiia_anuncios_publicacoes.filter((p) => p.ml_user_id === LOJA) } });
  const v = porConta(await C.verificarContasPublicacao({ selecao: [LOJA], dados: DADOS, deps: ml.deps }), LOJA);
  assert.equal(v.situacao, "liberada", JSON.stringify(v.itens));
  assert.equal(banco.funcoes.length, 0, "nem Mercado Livre nem Bling chamados");
});

// ------------------------------------------------------------------
test("6) diagnóstico: cada MLB lido na SUA conta; MLB pesquisado na conta certa; Bling pelo SKU e pelo ID", async () => {
  const chamadas = [];
  const fichas = {
    dc8788d6: { id: "dc8788d6", status_fluxo: "publicado", conta_destino_ml_user_id: LOJA, publicacao: { mlb_id: MLB_LOJA, status_publicacao: "publicado", ml_user_id: LOJA, bling_produto_id: PROD }, dados_conferencia: { integracao_bling: { mlb: MLB_LOJA, estado: "integrado", bling_produto_id: PROD, bling_loja_id: LOJA_BLING } } },
    "05183a61": { id: "05183a61", status_fluxo: "publicado_com_pendencia", conta_destino_ml_user_id: REV, publicacao: { mlb_id: MLB_REV, status_publicacao: "publicado_com_pendencia", ml_user_id: REV, bling_produto_id: "" }, dados_conferencia: {} },
  };
  const deps = {
    // a mais recente primeiro (como a base devolve)
    listarFichas: async () => ({ ok: true, anuncios: [{ id: "05183a61" }, { id: "dc8788d6" }] }),
    lerFicha: async (id) => ({ ok: true, anuncio: fichas[id] }),
    lerRegistro: async () => ({ ok: true, registros: [{ mlb_id: MLB_LOJA, ml_user_id: LOJA, anuncio_id: "dc8788d6", bling_produto_id: PROD }, { mlb_id: MLB_REV, ml_user_id: REV, anuncio_id: "05183a61" }] }),
    consultarML: async (conta, caminho) => {
      chamadas.push([conta, caminho]);
      if (caminho === `/items/${MLB_LOJA}`) return conta === LOJA ? { ok: true, dados: itemML(MLB_LOJA, LOJA, { status: "closed", price: 46.08 }) } : { ok: false, erro: "Access to the requested resource is forbidden" };
      if (caminho === `/items/${MLB_REV}`) return conta === REV ? { ok: true, dados: itemML(MLB_REV, REV) } : { ok: false, erro: "forbidden" };
      if (/items\/search/.test(caminho)) return { ok: true, dados: { results: [], paging: { total: 0 } } };
      return { ok: false, erro: "?" };
    },
    consultarBling: async (corpo) => {
      chamadas.push(["bling", corpo.acao]);
      if (corpo.acao === "saldo_por_sku") return { ok: true, encontrado: false };
      if (corpo.acao === "anuncios_consultar") return { ok: true, id_loja: LOJA_BLING, anuncios: [{ mlb: MLB_LOJA, produto_id: PROD, id_anuncio: 68760690 }] };
      return { ok: true, id_loja: LOJA_BLING, encontrado: false };
    },
  };
  const d = await diagnosticarPublicacao({ sku: SKU, mlb: MLB_LOJA }, deps);
  assert.equal(d.conta, LOJA, "MLB5559219337 lido pela LOJA ONLINE, não pela ficha mais recente");
  assert.equal(d.ml.status, "closed");
  assert.equal(d.ml.preco, 46.08);
  const linhas = Object.fromEntries(d.mlbs.map((m) => [m.mlb, m]));
  assert.equal(linhas[MLB_LOJA].situacao, "encerrado");
  assert.equal(linhas[MLB_LOJA].conta, LOJA);
  assert.equal(linhas[MLB_REV].situacao, "ativo");
  assert.equal(linhas[MLB_REV].conta, REV);
  assert.ok(chamadas.some((c) => c[0] === REV && c[1] === `/items/${MLB_REV}`) && chamadas.some((c) => c[0] === LOJA && c[1] === `/items/${MLB_LOJA}`));
  assert.equal(d.bling.situacao, "fora_da_busca");
  assert.match(d.pontos.find((p) => p.item === "Bling").texto, /produto Bling 16735464254/);
  assert.equal(d.bling.vinculo.estado, "integrado", "vínculo conferido pelo ID registrado mesmo com o SKU fora da busca");
  assert.ok(chamadas.filter((c) => c[0] === "bling").every((c) => ["saldo_por_sku", "anuncios_consultar", "anuncios_buscar_mlb"].includes(c[1])), "só leituras");
});
