// =============================================================
// PAIIA Voz — (04/11/2026) “Finalizar anúncio”: tela única, operações
// autorizadas, registro e retomada sem repetir; 7 etapas do celular;
// remover ficha de teste.   node --test scripts/testes/paiiaVozFinalizar.test.mjs
// Bling, Mercado Livre e base SIMULADOS: nenhuma chamada real.
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { prepararConferenciaVoz, confirmarCategoriaSugerida } from "../../src/modules/paiiaVoz/servicos/preparoConferenciaVoz.js";
import { mesclarPreparo } from "../../src/modules/paiiaVoz/servicos/preparoFicha.js";
import * as Fz from "../../src/modules/paiiaVoz/servicos/finalizarAnuncioVoz.js";
import * as C from "../../src/modules/paiiaVoz/servicos/completarVoz.js";
import { criarFichaVoz } from "../../src/modules/paiiaVoz/servicos/fichaVoz.js";
import { ETAPAS } from "../../src/modules/paiiaVoz/servicos/rascunhoRapido.js";

const ler = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const LOJA = "1729335019";
const API = "https://api.mercadolibre.com";

function ficha(extra = {}) {
  const base = {
    id: "00000000-0000-4000-8000-000000000966", codigo: "856371-305", status_fluxo: "rascunho",
    dados_conferencia: {
      etapa_fluxo: "novo_anuncio",
      novo_anuncio: { codigo: "856371-305", titulo: "Lanterna Dianteira Cristal Ônibus Neobus Mega Plus", preco: "97,92", tipoAnuncio: "premium", tipoVeiculo: "Linha Pesada", medida: { peso_g: 350, comprimento_cm: 20, largura_cm: 10, altura_cm: 10 }, descricao: "Lanterna Dianteira Cristal Ônibus Mega Plus", fotos: ["https://f/1.png", "https://f/2.png", "https://f/3.png", "https://f/4.png", "https://f/5.png"] },
      paiia_voz: { complemento: { marca: "Torken", quantidadeEstoque: "10" }, aplicacoes: [{ montadora: "Neobus", modelo: "Mega Plus", motor: "", versao: "", anoInicio: "2013", anoFim: "2016", origem: "manual" }] },
    },
  };
  return structuredClone({ ...base, ...extra, dados_conferencia: { ...base.dados_conferencia, ...(extra.dados_conferencia || {}) } });
}

/** Mercado Livre / Bling / base simulados; registra cada chamada (prova de que só há leitura). */
function mundo({ preditor = [{ category_id: "MLB456155", category_name: "Lanternas de Pisca", domain_id: "MLB-VEHICLE_TURN_SIGNAL_LIGHTS" }], skuAtivo = null, blingEncontrado = true, saldo = 10, registrosBase = [], tipoCategoria = "Linha Pesada" } = {}) {
  const chamadas = [];
  const categorias = {
    MLB456155: { name: "Lanternas de Pisca", path: ["Acessórios para Veículos", "Peças de Linha Pesada", "Iluminação", "Lanternas de Pisca"], tipo: tipoCategoria },
    MLB22735: { name: "Pisca Pisca", path: ["Acessórios para Veículos", "Peças de Carros e Caminhonetes", "Iluminação", "Faróis", "Pisca Pisca"], tipo: "Carro/Caminhonete" },
  };
  const lerJson = async (url) => {
    chamadas.push(["GET", url]);
    if (url.startsWith(`${API}/sites/MLB/domain_discovery/search`)) return preditor;
    const m = url.match(/categories\/(MLB\d+)(\/attributes)?$/);
    if (m && categorias[m[1]]) {
      const c = categorias[m[1]];
      if (m[2]) return [
        { id: "BRAND", name: "Marca", tags: { required: true } },
        { id: "PART_NUMBER", name: "Número de peça", tags: { required: true } },
        { id: "VEHICLE_TYPE", name: "Tipo de veículo", tags: { required: true }, values: [{ id: "1", name: c.tipo }] },
      ];
      return { id: m[1], name: c.name, path_from_root: c.path.map((name) => ({ name })), settings: { catalog_domain: "MLB-VEHICLE_TURN_SIGNAL_LIGHTS", listing_allowed: true } };
    }
    return null;
  };
  const chamarPublicacao = async (corpo) => {
    chamadas.push([corpo.metodo || "POST", corpo.acao, corpo.caminho || "", corpo.conta_ml]);
    assert.ok(["ml_consulta", "evidencia_codigo"].includes(corpo.acao), `ação não permitida: ${corpo.acao}`);
    if (corpo.acao === "evidencia_codigo") return { ok: false, estado: "indisponivel" };
    const c = corpo.caminho;
    if (corpo.metodo === "POST") {
      assert.match(c, /^\/catalog_domains\//, "POST só para leitura do catálogo de veículos");
      if (/BRAND\/top_values/.test(c)) return { ok: true, dados: [{ id: 9, name: "Fiat" }, { id: 8, name: "Volkswagen" }] };
      return { ok: true, dados: [] };
    }
    if (/\/items\/search\?seller_sku=/.test(c)) return { ok: true, dados: { results: skuAtivo ? [skuAtivo] : [] } };
    if (/\/items\/search\?q=/.test(c)) return { ok: true, dados: { results: skuAtivo ? [skuAtivo] : [], paging: { total: skuAtivo ? 1 : 0 } } };
    if (c === "/items/MLB7920523934") return { ok: true, dados: { id: "MLB7920523934", seller_id: Number(LOJA), status: "closed", sub_status: ["deleted"] } };
    if (skuAtivo && c === `/items/${skuAtivo}`) return { ok: true, dados: { id: skuAtivo, seller_id: Number(LOJA), status: "active", title: "Lanterna", seller_custom_field: "856371-305", attributes: [{ id: "SELLER_SKU", value_name: "856371-305" }] } };
    if (/\/shipping_options\/free/.test(c)) return { ok: true, dados: { coverage: { all_country: { list_cost: 13.85, billable_weight: 350, currency_id: "BRL" } } } };
    return { ok: false, erro: `não simulado: ${c}` };
  };
  const deps = {
    lerJson, chamarPublicacao,
    listarFichas: async () => ({ ok: true, anuncios: [] }),
    conferirDuplicidadeBase: async () => ({ ok: true, registros: registrosBase }),
    lerSaldoBling: async (sku) => { chamadas.push(["BLING", "saldo_por_sku", sku]); return blingEncontrado ? { ok: true, encontrado: true, produto: { id: 16728159989, codigo: sku }, saldoFisicoTotal: saldo, saldoVirtualTotal: saldo } : { ok: true, encontrado: false }; },
    modalidadesDaConta: async () => ({ ok: true, modalidades: [{ tipo: "xd_drop_off", padrao: true }] }),
    agora: () => "2026-11-02T12:00:00.000Z",
  };
  return { deps, chamadas };
}


async function conferido(row, w = mundo()) {
  const p = await prepararConferenciaVoz(row, { conta: LOJA, deps: w.deps });
  row.dados_conferencia = mesclarPreparo(row.dados_conferencia, p);
  return row;
}
async function prontaParaAprovar() {
  const w = mundo();
  const row = await conferido(ficha(), w);
  const c = confirmarCategoriaSugerida(row.dados_conferencia.paiia_voz.preparo);
  row.dados_conferencia = mesclarPreparo(row.dados_conferencia, { ...row.dados_conferencia.paiia_voz.preparo, categoria: { decisao: c.decisao } });
  return conferido(row, w);
}


const AUT = (row, ops, extra = {}) => ({ confirmada: true, em: "2026-11-04T10:00:00.000Z", por: "u1", sessao: "S1", assinatura: Fz.assinaturaFinalizar(row, ops), ...extra });

/** Ficha + “servidor” simulado: guarda o registro, conta cada escrita, simula queda. */
function servidor(row0, { mlbExistente = "", falhaConferir = "", quedaEm = "", blingExiste = false } = {}) {
  let row = structuredClone(row0);
  const escritas = [];
  let caiu = false;
  const deps = {
    agora: () => "2026-11-04T10:05:00.000Z",
    lerFicha: async () => ({ ok: true, ficha: structuredClone(row) }),
    gravarFinalizacao: async (_id, mudar) => {
      const voz = row.dados_conferencia.paiia_voz || {};
      row.dados_conferencia.paiia_voz = { ...voz, finalizacao: mudar(voz.finalizacao || {}) };
      return { ok: true, ficha: structuredClone(row) };
    },
    conferir: {
      bling_criar: async () => (falhaConferir === "bling_criar" ? { ok: false, erro: "Bling fora" } : blingExiste || escritas.includes("bling_criar") ? { ok: true, feito: true, blingProdutoId: "777" } : { ok: true }),
      ml_publicar: async () => (falhaConferir === "ml_publicar" ? { ok: false, erro: "ML fora" } : mlbExistente || escritas.includes("ml_publicar") ? { ok: true, feito: true, mlb: mlbExistente || "MLB111" } : { ok: true }),
      ml_compat: async (ctx) => (escritas.includes("ml_compat") ? { ok: true, feito: true } : ctx.mlb || ctx.registro.mlb ? { ok: true } : { ok: true, bloqueia: true, texto: "sem anúncio" }),
      bling_vinculo: async () => ({ ok: true }),
    },
    executar: {
      bling_criar: async () => { escritas.push("bling_criar"); return { ok: true, blingProdutoId: "777", texto: "criado com estoque 0" }; },
      ml_publicar: async () => { if (quedaEm === "ml_publicar" && !caiu) { caiu = true; escritas.push("ml_publicar"); throw new Error("conexão caiu"); } escritas.push("ml_publicar"); return { ok: true, mlb: "MLB111" }; },
      ml_compat: async () => { escritas.push("ml_compat"); return { ok: true, texto: "1 gravada" }; },
      bling_vinculo: async () => ({ ok: true, texto: "LojaOnlineSP automático" }),
    },
  };
  return { deps, escritas, row: () => row };
}
async function pronta(opts = {}) {
  const w = mundo(opts);
  const row = await conferido(ficha(), w);
  const c = confirmarCategoriaSugerida(row.dados_conferencia.paiia_voz.preparo);
  row.dados_conferencia = mesclarPreparo(row.dados_conferencia, { ...row.dados_conferencia.paiia_voz.preparo, categoria: { decisao: c.decisao } });
  return conferido(row, w);
}

test("situação: tudo conferido → operações planejadas; execução real NÃO liberada nesta versão", async () => {
  const row = await pronta();
  const s = Fz.situacaoFinalizar(row);
  // (05/11) catálogo não validou veículos (Linha Pesada sem catálogo): “Gravar compatibilidades” não aparece
  assert.deepEqual(s.ops.map((o) => o.id), ["ml_publicar", "bling_vinculo"]);
  assert.deepEqual(s.compat, { informadas: 1, validadas: 0 });
  assert.ok(s.ops.every((o) => !o.marcada), "nenhuma operação vem marcada (Publicar no ML desmarcado)");
  assert.equal(s.pendencias.filter((p) => p.tipo !== "aviso").length, 0);
  assert.equal(s.podeExecutar, false);
  assert.match(s.motivo, /Marque/);
  const m = Fz.situacaoFinalizar(row, { marcar: { ml_publicar: true } });
  assert.match(m.motivo, /não liberada/);
  assert.equal(m.ops.find((o) => o.id === "bling_vinculo").marcada, true, "vínculo (leitura) acompanha a publicação");
  assert.equal(Fz.situacaoFinalizar(row, { liberado: true }).podeExecutar, false, "liberado mas nada marcado");
  assert.equal(Fz.situacaoFinalizar(row, { liberado: true, marcar: { ml_publicar: true } }).podeExecutar, true);
  assert.equal(Fz.publicacaoRealLiberada({}), false, "padrão: desligado");
});

test("SKU ausente no Bling: informa e só segue com autorização ESPECÍFICA (estoque inicial 0); sem ela, pendência", async () => {
  const row = await pronta({ blingEncontrado: false });
  assert.equal(Fz.skuAusenteNoBling(row), true);
  let s = Fz.situacaoFinalizar(row, { liberado: true });
  assert.equal(s.ops[0].id, "bling_criar");
  assert.equal(s.ops[0].marcada, false, "nunca marcada sozinha");
  assert.match(s.ops[0].detalhe, /estoque da ficha/, "(D1) mesma quantidade da ficha em todo lugar");
  assert.equal(s.podeExecutar, false);
  assert.ok(s.pendencias.some((p) => p.id === "bling"));
  s = Fz.situacaoFinalizar(row, { liberado: true, autorizarBling: true });
  assert.equal(s.ops[0].marcada, true);
  assert.equal(s.podeExecutar, true);
  assert.equal(s.ops.find((o) => o.id === "ml_publicar").marcada, false, "autorizar o Bling não marca a publicação");
});

test("executar: só com confirmação explícita e com a ficha igual à confirmada", async () => {
  const row = await pronta();
  const sv = servidor(row);
  const ops = ["ml_publicar", "ml_compat", "bling_vinculo"];
  assert.equal((await Fz.executarFinalizacao(row.id, { marcadas: ops, autorizacao: null, deps: sv.deps })).ok, false);
  const mudada = structuredClone(row); mudada.dados_conferencia.novo_anuncio.preco = "10,00";
  const r = await Fz.executarFinalizacao(row.id, { marcadas: ops, autorizacao: AUT(mudada, ops), deps: sv.deps });
  assert.equal(r.ok, false);
  assert.match(r.erro, /mudou/);
  assert.deepEqual(sv.escritas, [], "nada executado");
});

test("executar: ordem Bling → ML → compatibilidades → vínculo; cada resultado registrado na ficha", async () => {
  const row = await pronta({ blingEncontrado: false });
  const sv = servidor(row);
  const ops = ["bling_criar", "ml_publicar", "ml_compat", "bling_vinculo"];
  const r = await Fz.executarFinalizacao(row.id, { marcadas: ops, autorizacao: AUT(row, ops), deps: sv.deps });
  assert.equal(r.ok, true, r.erro);
  assert.deepEqual(sv.escritas, ["bling_criar", "ml_publicar", "ml_compat"]);
  const reg = Fz.estadoFinalizacao(sv.row());
  assert.equal(reg.mlb, "MLB111");
  assert.equal(reg.blingProdutoId, "777");
  assert.ok(ops.every((id) => reg.ops[id].estado === "ok"));
  assert.deepEqual(reg.autorizacao.ops, ops);
});

test("retomar: o que já foi feito NÃO é repetido (nem com dois toques)", async () => {
  const row = await pronta();
  const sv = servidor(row);
  const ops = ["ml_publicar", "ml_compat", "bling_vinculo"];
  await Fz.executarFinalizacao(row.id, { marcadas: ops, autorizacao: AUT(row, ops), deps: sv.deps });
  const r2 = await Fz.executarFinalizacao(row.id, { marcadas: ops, autorizacao: AUT(row, ops), deps: sv.deps });
  assert.equal(r2.ok, true);
  assert.deepEqual(sv.escritas, ["ml_publicar", "ml_compat"], "publicou uma vez só");
});

test("anúncio já existe no ML para esta ficha: conferência antes marca como feito e NÃO publica de novo", async () => {
  const row = await pronta();
  const sv = servidor(row, { mlbExistente: "MLB999" });
  const ops = ["ml_publicar", "ml_compat"];
  const r = await Fz.executarFinalizacao(row.id, { marcadas: ops, autorizacao: AUT(row, ops), deps: sv.deps });
  assert.equal(r.ok, true);
  assert.deepEqual(sv.escritas, ["ml_compat"]);
  assert.equal(Fz.estadoFinalizacao(sv.row()).ops.ml_publicar.jaEstava, true);
  assert.equal(Fz.estadoFinalizacao(sv.row()).mlb, "MLB999");
});

test("queda no meio da publicação: fica INCERTO; retomada confere no ML e não publica duas vezes", async () => {
  const row = await pronta();
  const sv = servidor(row, { quedaEm: "ml_publicar" });
  const ops = ["ml_publicar", "ml_compat"];
  const r1 = await Fz.executarFinalizacao(row.id, { marcadas: ops, autorizacao: AUT(row, ops), deps: sv.deps });
  assert.equal(r1.ok, false);
  assert.equal(Fz.estadoFinalizacao(sv.row()).ops.ml_publicar.estado, "incerto");
  const r2 = await Fz.executarFinalizacao(row.id, { marcadas: ops, autorizacao: AUT(row, ops), deps: sv.deps });
  assert.equal(r2.ok, true, r2.erro);
  assert.equal(sv.escritas.filter((x) => x === "ml_publicar").length, 1, "não repetiu a publicação");
});

test("sem conseguir conferir antes: para e NÃO executa (nada às cegas)", async () => {
  const row = await pronta();
  const sv = servidor(row, { falhaConferir: "ml_publicar" });
  const ops = ["ml_publicar", "ml_compat"];
  const r = await Fz.executarFinalizacao(row.id, { marcadas: ops, autorizacao: AUT(row, ops), deps: sv.deps });
  assert.equal(r.ok, false);
  assert.equal(r.parou, "ml_publicar");
  assert.deepEqual(sv.escritas, []);
});

test("outro aparelho executando agora: não mexe", async () => {
  const row = await pronta();
  const ops = ["ml_publicar"];
  row.dados_conferencia.paiia_voz.finalizacao = { ops: { ml_publicar: { estado: "executando", inicio: "2026-11-04T10:03:00.000Z", sessao: "OUTRA" } } };
  const sv = servidor(row);
  const r = await Fz.executarFinalizacao(row.id, { marcadas: ops, autorizacao: AUT(row, ops), deps: sv.deps });
  assert.equal(r.ok, false);
  assert.match(r.erro, /outro aparelho/);
  assert.deepEqual(sv.escritas, []);
});

test("ligações reais: Bling criar pela ação EXISTENTE criar_produto (com autorização); ML publicar e compatibilidades continuam BLOQUEADAS; vínculo só lê", () => {
  const f = ler("src/modules/paiiaVoz/servicos/finalizarDepsReais.js");
  for (const op of ["ml_publicar", "ml_compat"]) assert.ok(f.includes(`async ${op}() { return { ok: false, bloqueado: true, erro: NAO_LIBERADO }; }`), op);
  assert.ok(f.includes("async bling_criar(ctx) { return cadastrarNoBlingVoz(ctx.row, { chamarBling }); }"), "cadastro pelo serviço que relê e confere");
  assert.ok(!/acao: "publicar"|gravar_compatibilidades|estoque_atualizar|update_stock|alterar_estoque/.test(f), "nenhuma outra escrita real");
  assert.ok(/\.eq\("updated_at", r\.ficha\.updated_at\)/.test(f), "registro gravado com trava de versão");
});

test("tela única: confere sozinha, uma confirmação + um botão; Bling com autorização própria; rotina atual mantida enquanto não liberado", () => {
  const f = ler("src/modules/paiiaVoz/FinalizarAnuncioVoz.jsx");
  assert.ok(f.includes("Conferência AUTOMÁTICA ao abrir"));
  // (Rodada 2) UM botão principal; nada da seção antiga de operações na tela
  assert.equal((f.match(/data-pv-continuar-publicacao/g) || []).length, 1, "um botão Finalizar e Enviar");
  for (const x of ["data-pv-finalizar-executar", "data-pv-finalizar-confirmo", "data-pv-finalizar-operacoes", "data-pv-rotina-atual"]) assert.ok(!f.includes(x), `sem ${x}`);
  const app = ler("src/App.jsx");
  assert.ok(app.includes('screen === "finalizarAnuncio"'), "a mesma tela no computador");
});

test("celular: 8 etapas; estado de cada etapa (concluída/pendência); campos seguem só dentro da etapa", () => {
  assert.deepEqual(ETAPAS, ["fotos", "codigo", "descricao", "preco", "envio", "compat", "categoria", "finalizar"]);
  let f = criarFichaVoz({ agora: 1, id: "e7" });
  let e = C.estadoEtapasVoz(f, { fotos: 0, etapaAtual: "preco", ordem: ETAPAS });
  assert.equal(e.fotos, "pe"); assert.equal(e.codigo, "pe"); assert.equal(e.envio, "");
  // (07/11) Ordem da etapa: Preço de Venda → Marca → Estoque (custo só na calculadora).
  assert.equal(C.proximoCampoDireto(f, "", { etapa: "preco" }), "preco");
  f = C.definirCampoDireto(f, "preco", "39,90").ficha;
  assert.equal(C.proximoCampoDireto(f, "preco", { etapa: "preco" }), "marca");
  f = C.definirCampoDireto(f, "marca", "Torken").ficha;
  assert.equal(C.proximoCampoDireto(f, "marca", { etapa: "preco" }), "quantidade", "custo fica na calculadora");
  f = C.definirCampoDireto(f, "quantidade", "10").ficha;
  assert.equal(C.proximoCampoDireto(f, "quantidade", { etapa: "preco" }), "", "fim da etapa: não pula para outra");
  e = C.estadoEtapasVoz(f, { fotos: 2, etapaAtual: "envio", ordem: ETAPAS });
  assert.equal(e.preco, "ok"); assert.equal(e.fotos, "ok");
  f = C.definirTipoVeiculoVoz(f, "Carro/Caminhonete");
  assert.equal(f.completar.tipoVeiculo, "Carro/Caminhonete");
  const tela = ler("src/modules/paiiaVoz/PaiiaVozRapido.jsx");
  assert.ok(tela.includes("grid-template-columns: repeat(8,"), "8 etapas numa linha");
  for (const b of ["descricao", "preco", "envio", "compat", "finalizar"]) assert.ok(tela.includes(`data-pr-bloco="${b}"`), b);
  assert.ok(tela.includes("<FinalizarAnuncioVoz"));
});

test("remover ficha de teste: confirmação com código/data/fotos; só a ficha selecionada; 05b4911c preservada; exclusão de sempre", () => {
  const tela = ler("src/modules/paiiaVoz/PaiiaVozRapido.jsx");
  assert.ok(tela.includes("data-pv-remover-confirmacao") && tela.includes("removendo.codigo") && tela.includes("removendo.data") && tela.includes("removendo.fotos"));
  assert.ok(tela.includes('const FICHAS_PRESERVADAS = ["05b4911c"];'));
  assert.ok(tela.includes("excluirFichaDefinitivamente(f.fichaIdPAIIA)"), "só o ID desta ficha");
  assert.ok(tela.includes("if (!res.apagada && !res.naoEncontrada)"), "recusada → nada local é apagado");
  assert.ok(tela.includes("descartarRascunhoLocalDaFicha("), "limpa os dados temporários dela");
});

test("catálogo do ML não confirma os veículos: só segue com a decisão explícita “sem compatibilidade” (e sem gravar compatibilidade)", async () => {
  const row = await pronta();
  row.dados_conferencia.paiia_voz.preparo.verificacoes.compatibilidade = { estado: "pergunta", texto: "Compatibilidade: nenhum veículo do catálogo confirmou as aplicações (x). Publicar sem compatibilidade?" };
  let s = Fz.situacaoFinalizar(row, { liberado: true });
  assert.equal(s.compatSemCatalogo, true);
  assert.equal(s.podeExecutar, false);
  s = Fz.situacaoFinalizar(row, { liberado: true, semCompatibilidade: true, marcar: { ml_publicar: true } });
  assert.equal(s.podeExecutar, true);
  assert.ok(!s.ops.some((o) => o.id === "ml_compat"));
});

test("nada do que existia some: fotos do anúncio (original/fundo branco), avisos de tratamento, faltando e peso/medidas para os Dados técnicos", () => {
  const tela = ler("src/modules/paiiaVoz/PaiiaVozRapido.jsx");
  for (const t of ["data-pr-envio-fotos", "data-pr-envio-foto", "data-pr-usar-tratada", "data-pr-aviso-interrompidas", "data-pr-aviso-tratando", "data-pr-faltando", "data-pr-peso-medidas-envio", "data-pr-modo-conversa", "data-pv-dados-bling", "data-pr-aproveitar", "data-pr-sugestao", "data-pr-editar-final", "data-pv-confirmar-envio", "data-pv-conversa-opcional", "data-pv-manter-mic"]) assert.ok(tela.includes(t), t);
  // (Rodada 2) a "rotina atual" saiu da tela: o caminho único é Finalizar e Enviar → Publicação (mesmo serviço)
  assert.ok(ler("src/modules/paiiaVoz/FinalizarAnuncioVoz.jsx").includes("prepararPublicacaoVoz"), "Publicação continua pelo mesmo serviço");
});

test("entrada (04/11): PAIIA Voz abre SEMPRE nas 7 etapas; modo conversa guardado no aparelho não volta a ser a entrada; nada é apagado", async () => {
  const mem = new Map([["paiiaVozModo", "conversa"], ["paiiaVozFicha", "{\"id\":\"antiga\"}"]]);
  globalThis.localStorage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  const f = ler("src/modules/paiiaVoz/PaiiaVoz.jsx");
  assert.ok(f.includes('return "rapido";\n}'), "entrada fixa nas 7 etapas");
  assert.ok(!/localStorage\.setItem\(CHAVE_MODO, m\)/.test(f), "escolher a conversa não fica guardado");
  assert.ok(f.includes("data-pr-modo-conversa") === false && ler("src/modules/paiiaVoz/PaiiaVozRapido.jsx").includes("data-pr-modo-conversa"), "modo conversa continua disponível pelo link");
  assert.ok(f.includes("data-pv-versao-nova") && f.includes("window.location.reload()"), "aviso de versão nova com Atualizar");
  assert.ok(!/removeItem|limparFicha|descartarFichaVoz\(\)/.test(f.slice(f.indexOf("function modoInicial"), f.indexOf("function PaiiaVozConversa("))), "entrada não apaga ficha nem fotos");
  assert.ok(ler("src/modules/paiiaVoz/PaiiaVozRapido.jsx").includes("data-pr-enviada"), "ficha já enviada: aviso nas 7 etapas");
  delete globalThis.localStorage;
});

test("etapas sem a caixa extra “Digite uma informação da peça”/OK: cada campo com o seu microfone (inclusive o Código) e digitação direta", () => {
  const tela = ler("src/modules/paiiaVoz/PaiiaVozRapido.jsx");
  assert.ok(!tela.includes("data-pr-entrada") && !tela.includes("Digite uma informação da peça") && !tela.includes("enviarDigitado"), "caixa extra removida");
  assert.ok(tela.includes('{micCampo("codigo", "Código")}') && tela.includes('{micCampo("titulo", "Título")}') && tela.includes('{micCampo("", "Descrição")}') && tela.includes("{micCampo(c.id, c.rotulo)}"), "microfone ao lado de cada campo");
  assert.ok(tela.includes('ditando={ouvindo && campoVoz !== "codigoAdicional" && parcial ? parcial : ""} onSalvar'), "código mostra a fala no próprio campo");
  assert.ok(tela.includes("onBlur={() => { setFocado(false); if (texto !== valor) onSalvar(texto); }}"), "digitação direta no campo é salva");
  assert.ok(tela.includes("data-pv-microfone"), "microfone principal continua");
  assert.ok(ler("src/modules/paiiaVoz/CompletarVoz.jsx").includes("data-pv-completar-entrada"), "conversa opcional mantém a sua resposta digitada");
});

test("compatibilidade: confirmada / ambígua / pendente; ditada NÃO conta como confirmada", () => {
  assert.equal(C.situacaoAplicacao({ montadora: "Renault", modelos: ["Master"], anoInicio: 2013, confirmada: false }).estado, "pendente");
  assert.equal(C.situacaoAplicacao({ montadora: "", modelos: ["Master"], anoInicio: null, confirmada: false }).estado, "ambigua");
  assert.deepEqual(C.situacaoAplicacao({ montadora: "", modelos: ["Master"], anoInicio: null }).faltas, ["montadora", "anos"]);
  assert.equal(C.situacaoAplicacao({ montadora: "Renault", modelos: ["Master"], anoInicio: 2013, confirmada: true }).estado, "confirmada");
  let f = criarFichaVoz({ agora: 1, id: "cp" });
  f = C.definirCampoDireto(f, "aplicacoes", "Renault Master 2013 a 2022").ficha;
  assert.equal(f.aplicacoes.length, 1);
  assert.equal(f.aplicacoes[0].confirmada, false, "dita = pendente até você marcar");
  const tela = ler("src/modules/paiiaVoz/PaiiaVozRapido.jsx");
  assert.ok(tela.includes("data-pv-aplicacao-estado") && tela.includes("data-pv-aplicacoes-contagem"));
});

test("etapa 3: Título primeiro, depois Descrição; o Título já vem ativo", () => {
  const tela = ler("src/modules/paiiaVoz/PaiiaVozRapido.jsx");
  assert.ok(tela.indexOf('data-pv-campo-direto="titulo"') < tela.indexOf('data-pv-campo-direto="descricao"'), "Título antes da Descrição");
  assert.ok(tela.includes('const inicial = e === "descricao" && !estadoRapido(fichaRef.current).titulo.valor ? "titulo" : "";'));
  assert.match(ler("src/modules/paiiaVoz/servicos/rascunhoRapido.js"), /descricao: "Título e Descrição"/);
});

test("nova ficha: abre vazia; a anterior nunca é apagada sozinha (guardar ou descartar com confirmação); guardadas reabrem", async () => {
  const mem = new Map();
  const arm = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  const Fv = await import("../../src/modules/paiiaVoz/servicos/fichaVoz.js");
  const a = { ...criarFichaVoz({ agora: 1, id: "f1" }) };
  assert.equal(Fv.guardarNaListaVoz(a, arm).ok, true);
  assert.equal(Fv.guardarNaListaVoz({ ...a }, arm).ok, true, "guardar de novo atualiza, não duplica");
  assert.deepEqual(Fv.listarFichasGuardadas(arm).map((x) => x.id), ["f1"]);
  assert.equal(Fv.retirarDaListaVoz("f1", arm).id, "f1");
  assert.equal(Fv.listarFichasGuardadas(arm).length, 0);
  const tela = ler("src/modules/paiiaVoz/PaiiaVozRapido.jsx");
  const inicio = tela.slice(tela.indexOf("function iniciarFichaNova("), tela.indexOf("async function novaFicha("));
  assert.ok(!/limparFicha|descartarFichaVoz|removeItem/.test(inicio), "iniciar nova ficha não apaga nada");
  for (const t of ["setParcial(\"\")", "setOuvidoCodigo(null)", "setNuvem({ estado: \"\", texto: \"\" })", "setRecenteCompletar(\"\")", "setVersaoRevisao((v) => v + 1)", "criarFichaVoz()"]) assert.ok(inicio.includes(t), t);
  assert.ok(tela.includes("data-pv-nova-guardar") && tela.includes("data-pv-nova-descartar") && tela.includes("data-pv-nova-cancelar"));
  assert.ok(tela.includes("faxina(fichaId, { manter: listarFichasGuardadas().map((x) => x.id) })"), "fotos das fichas guardadas protegidas");
  assert.ok(tela.includes("key={`${ficha.id}-${versaoRevisao}`}"), "Finalizar não herda seleções da ficha anterior");
});

test("peso/medidas não aparecem no campo Descrição nem na descrição comercial; continuam nos dados técnicos", async () => {
  const R = await import("../../src/modules/paiiaVoz/servicos/rascunhoRapido.js");
  let f = criarFichaVoz({ agora: 1, id: "pm" });
  f = R.definirTextoDescricao(f, "presilha do acabamento");
  f = C.definirCampoDireto(f, "peso", "200").ficha;
  f = C.definirCampoDireto(f, "comprimento", "20 por 10 por 5").ficha;
  assert.ok(!/200 g|20 X 10/i.test(R.descricaoParaEnvio(f)), "descrição comercial sem medidas");
  assert.deepEqual(R.pesoMedidasParaEnvio(f).campos, { pesoFreteML: "0,2", comprimentoFreteML: "20", larguraFreteML: "10", alturaFreteML: "5" });
  const tela = ler("src/modules/paiiaVoz/PaiiaVozRapido.jsx");
  assert.ok(tela.includes("valor={semLinhaMedidas(r.descricao.texto)}") && tela.includes("comLinhaMedidas(v, estadoRapido(fichaRef.current).descricao.texto)"), "campo Descrição não mostra a linha de medidas e não a perde ao editar");
});

// ---------------- (04/11) Segundo pacote ----------------
test("códigos: SKU principal + 4 adicionais → os 5 na ficha, na descrição e nos dados de exportação (Bling/ML)", async () => {
  const Fv = await import("../../src/modules/paiiaVoz/servicos/fichaVoz.js");
  const R = await import("../../src/modules/paiiaVoz/servicos/rascunhoRapido.js");
  const P = await import("../../src/modules/paiiaVoz/servicos/publicacaoVoz.js");
  let f = criarFichaVoz({ agora: 1, id: "c5" });
  const ad = (v, soletrado = false) => { f = Fv.aplicarInterpretacao(f, { itens: [{ campo: "codigoAdicional", valor: v, soletrado }] }).ficha; };
  f = Fv.aplicarInterpretacao(f, { itens: [{ campo: "codigoPrincipal", valor: "242101345R" }] }).ficha;
  ad("7703072360"); ad("8200459187"); ad("A-1234"); ad("XYZ 99");
  ad("7703072360"); // repetido: não duplica
  f = R.definirTitulo(f, "Presilha Plástica Master 3");
  assert.equal(f.codigos.length, 5);
  assert.equal(Fv.codigoPrincipal(f).codigo, "242101345R", "um único principal");
  const esperado = "242101345R / 7703072360 / 8200459187 / A-1234 / XYZ 99";
  const desc = R.descricaoParaEnvio(f);
  assert.ok(desc.includes("Códigos de Referência:") && desc.includes(esperado), desc);
  const { dados } = R.mapearRapidoParaNovoAnuncio(f);
  assert.equal(dados.codigo, "242101345R");
  assert.equal(dados.oem, "7703072360, 8200459187, A-1234, XYZ 99");
  assert.ok(dados.descricao.includes(esperado));
  // dados preparados para a publicação (ML; o Bling recebe pelo vínculo do anúncio)
  assert.ok(ler("src/modules/paiiaVoz/servicos/publicacaoVoz.js").includes('oem: String(d.novo_anuncio?.oem ?? "").trim(),'), "oem não vai mais vazio");
  assert.equal(typeof P.montarAprovacaoDoVoz, "function");
});

test("códigos: ditado/da base só entra depois de conferido; remover/corrigir atualiza a descrição (também a editada à mão)", async () => {
  const Fv = await import("../../src/modules/paiiaVoz/servicos/fichaVoz.js");
  const R = await import("../../src/modules/paiiaVoz/servicos/rascunhoRapido.js");
  let f = criarFichaVoz({ agora: 1, id: "c6" });
  f = Fv.aplicarInterpretacao(f, { itens: [{ campo: "codigoPrincipal", valor: "242101345R" }, { campo: "codigoAdicional", valor: "7703072360", soletrado: true }] }).ficha;
  f = Fv.incorporarResultadoBase(f, { encontrado: true, origem: "base", rotulo: "Base PAIIA", codigos: ["8200459187"], aplicacoes: [] }).ficha;
  assert.ok(!R.descricaoParaEnvio(f).includes("7703072360"), "ditado sem conferir não entra");
  assert.ok(!R.descricaoParaEnvio(f).includes("8200459187"), "equivalência da base sem conferir não entra");
  assert.ok(R.descricaoParaEnvio(f).includes("Código de Referência:\n242101345R"));
  f = Fv.conferirCodigo(f, "7703072360", true);
  f = Fv.conferirCodigo(f, "8200459187", true);
  assert.ok(R.descricaoParaEnvio(f).includes("242101345R / 7703072360 / 8200459187"));
  // texto final editado à mão acompanha a ficha
  f = R.definirDescricaoFinal(f, R.descricaoParaEnvio(f).replace("Presilha", "Presilha editada"));
  f = Fv.removerCodigo(f, "7703072360");
  const d = R.descricaoParaEnvio(f);
  assert.ok(d.includes("242101345R / 8200459187") && !d.includes("7703072360"), d);
  f = Fv.removerCodigo(f, "8200459187");
  assert.ok(R.descricaoParaEnvio(f).includes("Código de Referência:\n242101345R"));
  // ficha antiga com códigos já registrados continua igual
  const antiga = { ...criarFichaVoz({ agora: 1, id: "old" }), codigos: [{ codigo: "856371-305", normalizado: "856371305", principal: true, conferido: true }, { codigo: "123", normalizado: "123", principal: false, conferido: true }] };
  assert.ok(R.descricaoParaEnvio(antiga).includes("856371-305 / 123"));
});

test("Finalizar abre no topo com a escolha da conta primeiro (LOJA ONLINE, REVELAÇÃO, CIEBR); trocar a conta pede nova autorização", () => {
  const tela = ler("src/modules/paiiaVoz/PaiiaVozRapido.jsx");
  assert.ok(tela.includes('if (e === "finalizar") setTimeout(() => { try { window.scrollTo({ top: 0, behavior: "auto" }); }'), "Continuar e a barra usam irPara → topo");
  assert.ok(tela.includes("depoisDaConta={blocoFicha}"), "conta antes do resumo da ficha");
  const f = ler("src/modules/paiiaVoz/FinalizarAnuncioVoz.jsx");
  // (Rodada 2) ordem aprovada: resumo/conferências → conta → modalidade → Bling → decisão → botão no final
  assert.ok(f.indexOf("data-pv-finalizar-dados") < f.indexOf("data-pv-finalizar-contas") && f.indexOf("data-pv-finalizar-contas") < f.indexOf("data-pv-modalidade") && f.indexOf("data-pv-modalidade") < f.indexOf("data-pv-bling=") && f.indexOf("data-pv-bling=") < f.lastIndexOf("data-pv-continuar-publicacao"), "resumo, depois conta, depois o botão no final");
  assert.ok(f.includes('const ORDEM_CONTAS = ["LOJA ONLINE", "REVELAÇÃO", "CIEBR"];') && f.includes("data-pv-conta-opcao") && f.includes("pr-conta-on"));
  assert.ok(f.includes("if (c.id === conta) return; setConta(c.id); setConfirmo(false);"), "mesma conta não mexe; outra conta pede nova autorização");
});

// ---------------- (05/11) Terceiro pacote ----------------
test("compatibilidade: informadas por você ≠ validadas pelo catálogo; “Gravar compatibilidades” só com veículos validados", async () => {
  const row = await pronta();
  row.dados_conferencia.paiia_voz.preparo.verificacoes.compatibilidade = { estado: "ok", texto: "Compatibilidade: 3 veículo(s) do catálogo…", veiculos: ["V1", "V2", "V3"] };
  const s = Fz.situacaoFinalizar(row);
  assert.deepEqual(s.compat, { informadas: 1, validadas: 3 });
  const op = s.ops.find((o) => o.id === "ml_compat");
  assert.ok(op && /3 veículo\(s\) validado\(s\) pelo catálogo/.test(op.detalhe));
  row.dados_conferencia.paiia_voz.preparo.verificacoes.compatibilidade = { estado: "pergunta", texto: "Compatibilidade: nenhum veículo do catálogo confirmou as aplicações (x).", veiculos: [] };
  assert.ok(!Fz.situacaoFinalizar(row).ops.some((o) => o.id === "ml_compat"), "nada validado → operação não aparece");
  const tela = ler("src/modules/paiiaVoz/FinalizarAnuncioVoz.jsx");
  assert.ok(tela.includes("data-pv-compat-informadas") && tela.includes("data-pv-compat-validadas"));
});

test("aplicações: “16 válvulas”, “16”, “16V” vão para o motor, nunca para o nome do modelo; nomes não são trocados", async () => {
  const { interpretarAplicacao } = await import("../../src/modules/paiiaVoz/servicos/interpretarFala.js");
  const casos = {
    "Renault Symbol 1.6 16V 2008 a 2012": [["Symbol"], ["1.6 16V"]],
    "Renault Symbol 1.6 16 2008 a 2012": [["Symbol"], ["1.6 16V"]],
    "Renault Symbol 16 1.6 2008 a 2012": [["Symbol"], ["1.6 16V"]],
    "Renault Clio 1.6 16 válvulas 2008 a 2016": [["Clio"], ["1.6 16V"]],
    "Renault Clio 1.6 16 v 2008 a 2016": [["Clio"], ["1.6 16V"]],
    "Clio 2 1.6 16V 2008 a 2016": [["Clio 2"], ["1.6 16V"]],
    "Peugeot 206 1.6 16v 2005": [["206"], ["1.6 16V"]],
    "Gol 1.0 8 válvulas 2010": [["Gol"], ["1.0 8V"]],
    "Fiat Uno 1.0 2010": [["Uno"], ["1.0"]],
  };
  for (const [t, [modelos, motores]] of Object.entries(casos)) {
    const r = interpretarAplicacao(t);
    assert.deepEqual([r.modelos, r.motores], [modelos, motores], t);
  }
});

test("Finalizar: versão antiga da página não autoriza; autorização vale só para o que estava na tela; categoria: rejeitar e procurar outra", async () => {
  const V = await import("../../src/modules/paiiaVoz/servicos/versaoSite.js");
  assert.equal(V.compararVersoes("index-AAA.js", '<script src="/assets/index-AAA.js">').estado, "ok");
  assert.equal(V.compararVersoes("index-AAA.js", '<script src="/assets/index-BBB.js">').estado, "desatualizada");
  assert.equal(V.compararVersoes("index-AAA.js", "").estado, "indisponivel");
  const r = await V.conferirVersaoSite({ doc: { scripts: [{ src: "https://x/assets/index-AAA.js" }] }, buscar: async () => ({ ok: true, text: async () => '<script src="/assets/index-NOVO.js">' }) });
  assert.deepEqual([r.estado, r.atual, r.noAr], ["desatualizada", "index-AAA.js", "index-NOVO.js"]);
  const tela = ler("src/modules/paiiaVoz/FinalizarAnuncioVoz.jsx");
  assert.ok(tela.includes("const pronto = Boolean(conta) && versaoOk &&") && tela.includes("data-pv-finalizar-atualizar"), "página antiga não mostra o botão de finalizar");
  assert.ok(tela.includes("const v = await conferirVersao();") && tela.includes("Atualize a página (versão nova do PAIIA) antes de finalizar"), "versão conferida de novo na hora");
  assert.ok(tela.includes("data-pv-alterar-categoria") && tela.includes("<PainelCategoriaML"), "Alterar categoria abre a mesma busca");
  // escolha só com confirmação; incompatível/rejeitada só com revisão registrada
  const P = await import("../../src/modules/paiiaVoz/servicos/preparoConferenciaVoz.js");
  assert.equal(P.confirmarCategoriaEscolhida({}, { candidata: null }).ok, false);
  assert.equal(P.confirmarCategoriaEscolhida({}, { candidata: { id: "MLB1", compativel: false } }).ok, false);
  const ok = P.confirmarCategoriaEscolhida({}, { candidata: { id: "MLB2", compativel: true, caminho: "A > B" }, avaliacao: { sugerida: "MLB1", candidatas: [{ id: "MLB1", compativel: true }, { id: "MLB2", compativel: true }] } });
  assert.equal(ok.ok, true);
  assert.equal(ok.decisao.confirmada.id, "MLB2");
  assert.equal(ok.decisao.confirmada.sugerida, false, "registrado que não era a sugerida");
});

test("editar aplicação: corrige o MESMO registro (sem duplicar), separa modelo/motor/válvulas, volta a pendente e é validada de novo", async () => {
  const Fv = await import("../../src/modules/paiiaVoz/servicos/fichaVoz.js");
  const P = await import("../../src/modules/paiiaVoz/servicos/preparoConferenciaVoz.js");
  const FC = await import("../../src/modules/paiiaVoz/servicos/fichaCompletaVoz.js");
  let f = criarFichaVoz({ agora: 1, id: "ed" });
  f = C.definirCampoDireto(f, "aplicacoes", "Renault Clio 2 16 2008 a 2016").ficha; // ditado com erro
  f = C.definirCampoDireto(f, "aplicacoes", "Renault Symbol 1.6 16V 2008 a 2012").ficha;
  const [clio, symbol] = f.aplicacoes;
  f = Fv.confirmarAplicacao(f, clio.id, true);
  f = Fv.confirmarAplicacao(f, symbol.id, true);
  const antes = P.assinaturaEntrada({ ...P.entradaDaFicha({ dados_conferencia: { novo_anuncio: {}, paiia_voz: { aplicacoes: FC.aplicacoesEstruturadasVoz(f) } } }) });
  const r = Fv.editarAplicacao(f, clio.id, "Renault Clio 1.6 16V 2008 a 2016");
  assert.equal(r.ok, true, r.erro);
  assert.equal(r.ficha.aplicacoes.length, 2, "não criou outra");
  const ed = r.ficha.aplicacoes.find((a) => a.id === clio.id);
  assert.deepEqual([ed.modelos, ed.motores, ed.anoInicio, ed.anoFim, ed.montadora], [["Clio"], ["1.6 16V"], 2008, 2016, "Renault"]);
  assert.equal(ed.confirmada, false, "corrigida = precisa confirmar de novo");
  assert.equal(r.ficha.aplicacoes.find((a) => a.id === symbol.id).confirmada, true, "a outra continua igual");
  // não dito de novo: montadora e anos continuam
  const r2 = Fv.editarAplicacao(r.ficha, clio.id, "Clio 1.6 16 válvulas");
  assert.equal(Fv.textoAplicacao(r2.aplicacao), "Renault Clio 1.6 16V 2008 a 2016");
  // virar igual à outra: recusado, sem duplicar
  const r3 = Fv.editarAplicacao(r2.ficha, clio.id, "Renault Symbol 1.6 16V 2008 a 2012");
  assert.equal(r3.ok, false);
  assert.equal(Fv.editarAplicacao(r2.ficha, clio.id, "não sei").ok, false, "nada inventado");
  // a conferência anterior deixa de valer (assinatura muda) → nova validação no catálogo
  let g = Fv.confirmarAplicacao(r2.ficha, clio.id, true);
  const depois = P.assinaturaEntrada({ ...P.entradaDaFicha({ dados_conferencia: { novo_anuncio: {}, paiia_voz: { aplicacoes: FC.aplicacoesEstruturadasVoz(g) } } }) });
  assert.notEqual(antes, depois);
  const tela = ler("src/modules/paiiaVoz/PaiiaVozRapido.jsx");
  assert.ok(tela.includes("data-pv-editar-aplicacao") && tela.includes("micCampo(`ap:${a.id}`, \"Aplicação\")") && tela.includes('startsWith("ap:")) { salvarAplicacaoEditada('), "Editar por teclado e microfone");
  assert.ok(tela.includes("c.aplicacoes || [], c.tipoVeiculo"), "correção salva na conta");
});
