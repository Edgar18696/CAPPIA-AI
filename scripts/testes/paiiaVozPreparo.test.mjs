// =============================================================
// PAIIA Voz — ETAPA 2 (02/11/2026): preparação automática da Conferência.
//   node --test scripts/testes/paiiaVozPreparo.test.mjs
// Mercado Livre, Bling e base SIMULADOS (nenhuma chamada real, nada pago).
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { prepararConferenciaVoz, confirmarCategoriaSugerida, preparoAtual, entradaDaFicha } from "../../src/modules/paiiaVoz/servicos/preparoConferenciaVoz.js";
import { mesclarPreparo } from "../../src/modules/paiiaVoz/servicos/preparoFicha.js";
import * as N from "../../src/modules/paiiaVoz/servicos/fichaVozNuvem.js";
import { mesclarNovoAnuncio } from "../../src/services/fichaNovoAnuncio.js";

const ler = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const LOJA = "1729335019";
const API = "https://api.mercadolibre.com";

function ficha(extra = {}) {
  const base = {
    id: "00000000-0000-4000-8000-000000000966", codigo: "856371-305", status_fluxo: "rascunho",
    dados_conferencia: {
      etapa_fluxo: "novo_anuncio",
      novo_anuncio: { codigo: "856371-305", titulo: "Lanterna Dianteira Cristal Ônibus Neobus Mega Plus", preco: "97,92", tipoAnuncio: "premium", tipoVeiculo: "Linha Pesada", medida: { peso_g: 350, comprimento_cm: 20, largura_cm: 10, altura_cm: 10 }, fotos: ["https://f/1.png", "https://f/2.png", "https://f/3.png", "https://f/4.png", "https://f/5.png"] },
      paiia_voz: { complemento: { marca: "Torken", quantidadeEstoque: "10" }, aplicacoes: [{ montadora: "Neobus", modelo: "Mega Plus", motor: "", versao: "", anoInicio: "2013", anoFim: "2016", origem: "manual" }] },
    },
  };
  return structuredClone({ ...base, ...extra, dados_conferencia: { ...base.dados_conferencia, ...(extra.dados_conferencia || {}) } });
}

/** Mercado Livre / Bling / base simulados; registra cada chamada (prova de que só há leitura). */
function mundo({ preditor = [{ category_id: "MLB456155", category_name: "Lanternas de Pisca", domain_id: "MLB-VEHICLE_TURN_SIGNAL_LIGHTS" }], skuAtivo = null, blingEncontrado = true, saldo = 10, registrosBase = [], tipoCategoria = "Linha Pesada", atributoSemValor = false } = {}) {
  const chamadas = [];
  const categorias = {
    MLB456155: { name: "Lanternas de Pisca", path: ["Acessórios para Veículos", "Peças de Linha Pesada", "Iluminação", "Lanternas de Pisca"], tipo: tipoCategoria },
    MLB22735: { name: "Pisca Pisca", path: ["Acessórios para Veículos", "Peças de Carros e Caminhonetes", "Iluminação", "Faróis", "Pisca Pisca"], tipo: "Carro/Caminhonete" },
    MLB456156: { name: "Lanternas Laterais", path: ["Acessórios para Veículos", "Peças de Linha Pesada", "Iluminação", "Lanternas Laterais"], tipo: tipoCategoria },
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
        // (Etapa 2) obrigatório que a ficha não preenche → a categoria NÃO é aceita sozinha
        ...(atributoSemValor ? [{ id: "POSITION", name: "Posição", tags: { required: true }, values: [{ id: "1", name: "Dianteira" }, { id: "2", name: "Traseira" }] }] : []),
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

test("lanterna (Linha Pesada, LOJA ONLINE): tudo conferido; categoria ÚNICA válida com atributos conferidos é SELECIONADA sozinha (Etapa 2)", async () => {
  const w = mundo({ registrosBase: [{ mlb_id: "MLB7920523934", status_publicacao: "publicado_com_pendencia", anuncio_id: "antiga" }] });
  const p = await prepararConferenciaVoz(ficha(), { conta: LOJA, deps: w.deps });
  const v = p.verificacoes;
  assert.equal(v.categoria.estado, "ok", v.categoria.texto);
  assert.equal(v.categoria.automatica, true);
  assert.equal(v.categoria.id, "MLB456155");
  assert.equal(p.categoria.decisao.confirmada.id, "MLB456155", "a decisão automática é gravada no preparo (mesmo registro)");
  assert.equal(v.compatibilidade.estado, "ok", v.compatibilidade.texto);
  assert.match(v.compatibilidade.texto, /Linha Pesada/);
  assert.equal(v.duplicidade.estado, "ok", v.duplicidade.texto);
  assert.match(v.duplicidade.texto, /MLB7920523934 — excluído\/encerrado/);
  assert.equal(v.bling.estado, "ok", v.bling.texto);
  assert.match(v.bling.texto, /disponível 10/);
  assert.equal(v.frete.estado, "ok", v.frete.texto);
  assert.match(v.frete.texto, /R\$ 13,85/);
  assert.deepEqual(p.perguntas.map((q) => q.id), []);
  assert.equal(p.pronto, true);
  // Só leitura: nenhuma ação além de consultas
  assert.ok(w.chamadas.every((c) => c[0] === "GET" || c[0] === "BLING" || c[1] === "evidencia_codigo" || (c[0] === "POST" && /^\/catalog_domains\//.test(c[2]))), JSON.stringify(w.chamadas));
});

test("categoria com atributo obrigatório SEM valor na ficha: vira PERGUNTA (nada presumido)", async () => {
  const p = await prepararConferenciaVoz(ficha(), { conta: LOJA, deps: mundo({ atributoSemValor: true }).deps });
  assert.equal(p.verificacoes.categoria.estado, "pergunta", p.verificacoes.categoria.texto);
  assert.equal(p.verificacoes.categoria.sugerida, "MLB456155");
});

test("duas categorias válidas: vira PERGUNTA (nunca escolhe sozinho)", async () => {
  const w = mundo({ preditor: [{ category_id: "MLB456155", domain_id: "MLB-VEHICLE_TURN_SIGNAL_LIGHTS" }, { category_id: "MLB456156", domain_id: "MLB-VEHICLE_TURN_SIGNAL_LIGHTS" }] });
  const p = await prepararConferenciaVoz(ficha(), { conta: LOJA, deps: w.deps });
  const validas = (p.verificacoes.categoria.avaliacao?.candidatas || []).filter((c) => c.compativel && !c.rejeitada).length;
  assert.ok(validas >= 2, `cenário precisa de 2 válidas (tem ${validas})`);
  assert.notEqual(p.verificacoes.categoria.estado, "ok", p.verificacoes.categoria.texto);
  assert.notEqual(p.verificacoes.categoria.automatica, true);
});

test("confirmar a categoria no Voz usa o MESMO registro da Conferência e, reconferindo, fica tudo ✅", async () => {
  const w = mundo({ atributoSemValor: true });
  const row = ficha();
  const p1 = await prepararConferenciaVoz(row, { conta: LOJA, deps: w.deps });
  const c = confirmarCategoriaSugerida(p1, { agora: "2026-11-02T12:01:00.000Z" });
  assert.equal(c.ok, true);
  assert.equal(c.decisao.confirmada.id, "MLB456155");
  assert.equal(c.decisao.confirmada.manual, true);
  assert.equal(c.decisao.confirmada.sugerida, true);
  row.dados_conferencia = mesclarPreparo(row.dados_conferencia, { ...p1, categoria: { decisao: c.decisao } });
  const p2 = await prepararConferenciaVoz(row, { conta: LOJA, deps: w.deps });
  assert.equal(p2.verificacoes.categoria.estado, "ok", p2.verificacoes.categoria.texto);
  assert.equal(p2.pronto, true, JSON.stringify(p2.perguntas.concat(p2.bloqueios)));
  assert.equal(p2.categoria.decisao.confirmada.id, "MLB456155");
});

test("categoria de CARRO confirmada para peça de Linha Pesada → BLOQUEIO (regra oficial)", async () => {
  const w = mundo({ preditor: [{ category_id: "MLB22735", domain_id: "MLB-VEHICLE_TURN_SIGNAL_LIGHTS" }] });
  const row = ficha();
  const p1 = await prepararConferenciaVoz(row, { conta: LOJA, deps: w.deps });
  assert.notEqual(p1.verificacoes.categoria.sugerida, "MLB22735", "não sugere categoria de carro para Linha Pesada");
});

test("sem conta: pergunta a conta e não consulta nada no Mercado Livre", async () => {
  const w = mundo();
  const p = await prepararConferenciaVoz(ficha(), { conta: "", deps: w.deps });
  assert.equal(p.verificacoes.conta.estado, "pergunta");
  for (const k of ["categoria", "compatibilidade", "duplicidade", "frete"]) assert.equal(p.verificacoes[k].estado, "aguardando");
  assert.ok(!w.chamadas.some((c) => c[1] === "ml_consulta"));
});

test("anúncio ATIVO do mesmo SKU na conta → BLOQUEIO de duplicidade", async () => {
  const w = mundo({ skuAtivo: "MLB5499135577" });
  const p = await prepararConferenciaVoz(ficha(), { conta: LOJA, deps: w.deps });
  assert.equal(p.verificacoes.duplicidade.estado, "bloqueio", p.verificacoes.duplicidade.texto);
  assert.match(p.verificacoes.duplicidade.texto, /MLB5499135577/);
  assert.equal(p.pronto, false);
});

test("SKU fora do Bling: pergunta (o PAIIA não cria produto); estoque acima do Bling bloqueia", async () => {
  let p = await prepararConferenciaVoz(ficha(), { conta: LOJA, deps: mundo({ blingEncontrado: false }).deps });
  assert.equal(p.verificacoes.bling.estado, "pergunta");
  assert.match(p.verificacoes.bling.texto, /não cria produto sem a sua autorização/);
  p = await prepararConferenciaVoz(ficha(), { conta: LOJA, deps: mundo({ saldo: 3 }).deps });
  assert.equal(p.verificacoes.bling.estado, "bloqueio");
});

test("dados faltando viram PERGUNTAS curtas; nada é inventado", async () => {
  const row = ficha();
  row.dados_conferencia.paiia_voz = { complemento: { marca: "", quantidadeEstoque: "" }, aplicacoes: [] };
  delete row.dados_conferencia.novo_anuncio.medida;
  row.dados_conferencia.novo_anuncio.preco = "";
  delete row.dados_conferencia.novo_anuncio.tipoVeiculo;
  const p = await prepararConferenciaVoz(row, { conta: LOJA, deps: mundo().deps });
  const ids = p.perguntas.map((q) => q.id);
  for (const k of ["marca", "bling", "categoria", "compatibilidade", "frete"]) assert.ok(ids.includes(k), k);
  assert.match(p.verificacoes.marca.texto, /não presume/);
  assert.match(p.verificacoes.bling.texto, /não assume/);
  assert.match(p.verificacoes.frete.texto, /Preço/);
  assert.equal(p.pronto, false);
});

test("Carro com aplicação sem veículo no catálogo: pergunta 'publicar sem compatibilidade?' (regra de carro preservada)", async () => {
  const row = ficha();
  row.dados_conferencia.novo_anuncio.tipoVeiculo = "Carro/Caminhonete";
  row.dados_conferencia.paiia_voz.aplicacoes = [{ montadora: "Marca Desconhecida", modelo: "X", motor: "1.0", anoInicio: "2010", anoFim: "2012" }];
  const p = await prepararConferenciaVoz(row, { conta: LOJA, deps: mundo({ tipoCategoria: "Carro/Caminhonete" }).deps });
  assert.equal(p.verificacoes.compatibilidade.estado, "pergunta");
  assert.match(p.verificacoes.compatibilidade.texto, /Publicar sem compatibilidade/);
});

test("preparo gravado na ficha: preservado pelo Voz e pelo Novo Anúncio; vira desatualizado se a ficha mudar", async () => {
  const w = mundo();
  const row = ficha();
  const p = await prepararConferenciaVoz(row, { conta: LOJA, deps: w.deps });
  row.dados_conferencia = mesclarPreparo(row.dados_conferencia, p);
  assert.equal(preparoAtual(row).valido, true);
  assert.equal(entradaDaFicha(row).conta, LOJA, "a conta escolhida fica na ficha");
  // Novo Anúncio grava (sem paiiaVoz): preparo continua
  const d2 = mesclarNovoAnuncio(row.dados_conferencia, { anuncio: {}, novo_anuncio: { ...row.dados_conferencia.novo_anuncio } });
  assert.ok(d2.paiia_voz.preparo, "Novo Anúncio preserva o preparo");
  // Voz sincroniza: preparo continua
  const contaF = { lerFicha: async () => ({ ok: true, ficha: { ...row, dados_conferencia: d2 } }), salvarFicha: async ({ paiiaVoz }) => { contaF.ultimo = paiiaVoz; return { ok: true, fichaId: row.id }; } };
  const r = await N.sincronizarFichaVoz({ fichaVozId: "v", fichaIdPAIIA: row.id, codigo: "856371-305", titulo: "Lanterna Dianteira Cristal Ônibus Neobus Mega Plus", descricao: "", preco: "97,92", oem: "" }, [], { usuarioId: "u1", ...contaF });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.ok(contaF.ultimo.preparo, "sincronização do Voz preserva o preparo");
  // Preço mudou → desatualizado
  row.dados_conferencia.novo_anuncio.preco = "99,90";
  assert.equal(preparoAtual(row).valido, false);
});

test("serviço: só leitura no ML/Bling; grava apenas paiia_voz.preparo e só antes da Conferência", () => {
  const s = ler("src/modules/paiiaVoz/servicos/preparoVozService.js");
  assert.ok(s.includes('acao: "saldo_por_sku"'));
  assert.equal(/acao:\s*"(publicar|criar|produto_criar|vinculo_loja_criar|anuncio)/.test(s), false);
  assert.ok(s.includes("fichaSoNoNovoAnuncio(r.ficha)") && s.includes("fichaFechada(r.ficha)"));
  const m = ler("src/modules/paiiaVoz/servicos/preparoConferenciaVoz.js");
  assert.equal(/acao:\s*"publicar"/.test(m), false);
  assert.ok(m.includes("conferirCategoriaParaPublicar") && m.includes("avaliarCategorias") && m.includes("verificarDuplicidadeML") && m.includes("conferirEstoque") && m.includes("cotarNoPreco") && m.includes("resolverCompatibilidades"), "reaproveita as conferências oficiais");
});
