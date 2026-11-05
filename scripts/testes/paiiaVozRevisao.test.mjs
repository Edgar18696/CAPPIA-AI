// =============================================================
// PAIIA Voz — ETAPA 3 (02/11/2026): revisão simplificada no celular.
//   node --test scripts/testes/paiiaVozRevisao.test.mjs
// Mercado Livre, Bling e base SIMULADOS (nenhuma chamada real, nada pago).
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { prepararConferenciaVoz, confirmarCategoriaSugerida } from "../../src/modules/paiiaVoz/servicos/preparoConferenciaVoz.js";
import { mesclarPreparo } from "../../src/modules/paiiaVoz/servicos/preparoFicha.js";
import { montarRevisao, aprovarRevisao, comRevisao, comModalidade } from "../../src/modules/paiiaVoz/servicos/revisaoCelularVoz.js";
import * as N from "../../src/modules/paiiaVoz/servicos/fichaVozNuvem.js";

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
function mundo({ preditor = [{ category_id: "MLB456155", category_name: "Lanternas de Pisca", domain_id: "MLB-VEHICLE_TURN_SIGNAL_LIGHTS" }], skuAtivo = null, blingEncontrado = true, saldo = 10, registrosBase = [], tipoCategoria = "Linha Pesada", atributoSemValor = false } = {}) {
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


async function conferido(row, w = mundo()) {
  const p = await prepararConferenciaVoz(row, { conta: LOJA, deps: w.deps });
  row.dados_conferencia = mesclarPreparo(row.dados_conferencia, p);
  return row;
}
async function prontaParaAprovar() {
  const w = mundo({ atributoSemValor: true }); // categoria com dúvida → confirmada por você (caminho manual)
  const row = await conferido(ficha(), w);
  const c = confirmarCategoriaSugerida(row.dados_conferencia.paiia_voz.preparo);
  row.dados_conferencia = mesclarPreparo(row.dados_conferencia, { ...row.dados_conferencia.paiia_voz.preparo, categoria: { decisao: c.decisao } });
  return conferido(row, w);
}

test("sem conferência: revisão mostra os dados e pede 'Conferir'; não aprova", () => {
  const r = montarRevisao(ficha());
  assert.equal(r.dados.titulo, "Lanterna Dianteira Cristal Ônibus Neobus Mega Plus");
  assert.equal(r.dados.sku, "856371-305");
  assert.equal(r.dados.marca, "Torken");
  assert.equal(r.dados.fotos.length, 5);
  assert.equal(r.dados.preco, "R$ 97,92");
  assert.equal(r.dados.modalidade, "Premium");
  assert.equal(r.dados.estoque, "10");
  assert.equal(r.dados.medida, "350 g · 20 × 10 × 10 cm");
  assert.deepEqual(r.dados.aplicacoes, ["Neobus Mega Plus 2013 a 2016"]);
  assert.deepEqual(r.pendencias.map((p) => p.id), ["conferir"]);
  assert.equal(r.podeAprovar, false);
  assert.equal(aprovarRevisao(ficha()).ok, false);
});

test("categoria única válida com atributos conferidos: selecionada sozinha, sem pendência (Etapa 2)", async () => {
  const r0 = montarRevisao(await conferido(ficha()));
  assert.deepEqual(r0.pendencias.map((p) => p.id), []);
  assert.equal(r0.podeAprovar, true);
});

test("só o que precisa de correção aparece: categoria com dúvida vira a ÚNICA pendência, com o botão de confirmar", async () => {
  const r = montarRevisao(await conferido(ficha(), mundo({ atributoSemValor: true })));
  assert.deepEqual(r.pendencias.map((p) => p.id), ["categoria"]);
  assert.equal(r.pendencias[0].sugerida, "MLB456155");
  assert.equal(r.podeAprovar, false);
});

test("tudo conferido + categoria confirmada → nenhuma pendência; APROVAÇÃO gravada na ficha com assinatura", async () => {
  const row = await prontaParaAprovar();
  const r = montarRevisao(row);
  assert.deepEqual(r.pendencias, []);
  assert.equal(r.podeAprovar, true);
  assert.equal(r.dados.categoria, "MLB456155 — Acessórios para Veículos > Peças de Linha Pesada > Iluminação > Lanternas de Pisca");
  assert.match(r.dados.frete, /R\$ 13,85/);
  const a = aprovarRevisao(row, { agora: "2026-11-02T13:00:00.000Z", usuario: "u1" });
  assert.equal(a.ok, true);
  assert.equal(a.revisao.conta, LOJA);
  assert.equal(a.revisao.categoria, "MLB456155");
  assert.deepEqual(a.revisao.resumo, { titulo: "Lanterna Dianteira Cristal Ônibus Neobus Mega Plus", sku: "856371-305", preco: "R$ 97,92", modalidade: "Premium", estoque: "10", fotos: 5 });
  row.dados_conferencia = comRevisao(row.dados_conferencia, a.revisao);
  assert.equal(montarRevisao(row).aprovada, true);
});

test("dado mudou depois da aprovação → aprovação deixa de valer sozinha e a conferência pede refazer", async () => {
  const row = await prontaParaAprovar();
  row.dados_conferencia = comRevisao(row.dados_conferencia, aprovarRevisao(row).revisao);
  row.dados_conferencia.novo_anuncio.preco = "89,90";
  const r = montarRevisao(row);
  assert.equal(r.aprovada, false);
  assert.equal(r.revisaoAnteriorInvalida, true);
  assert.ok(r.pendencias.some((p) => p.id === "conferir"));
  assert.equal(r.podeAprovar, false);
  // descrição também invalida
  const row2 = await prontaParaAprovar();
  row2.dados_conferencia = comRevisao(row2.dados_conferencia, aprovarRevisao(row2).revisao);
  row2.dados_conferencia.novo_anuncio.descricao = "outra";
  assert.equal(montarRevisao(row2).aprovada, false);
});

test("Clássico é o padrão SEM pergunta (decisão 07/11); trocar para Premium exige nova conferência (frete muda)", async () => {
  const row = ficha();
  row.dados_conferencia.novo_anuncio.tipoAnuncio = "classico";
  await conferido(row);
  assert.equal(montarRevisao(row).pendencias.some((p) => p.id === "modalidade"), false, "Clássico não vira pergunta obrigatória");
  row.dados_conferencia = comModalidade(row.dados_conferencia, "premium", "2026-11-02T13:00:00.000Z");
  assert.equal(row.dados_conferencia.novo_anuncio.tipoAnuncio, "premium");
  assert.ok(montarRevisao(row).pendencias.some((p) => p.id === "conferir"), "frete foi cotado como Clássico: reconferir");
  const row2 = ficha();
  row2.dados_conferencia = comModalidade(row2.dados_conferencia, "classico");
  await conferido(row2);
  assert.equal(montarRevisao(row2).pendencias.some((p) => p.id === "modalidade"), false);
});

test("(regra 08/11) outro anúncio do mesmo SKU não vira pendência; falha de consulta continua bloqueando", async () => {
  const row = await conferido(ficha(), mundo({ skuAtivo: "MLB5499135577" }));
  const r = montarRevisao(row);
  assert.ok(!r.pendencias.some((p) => p.id === "duplicidade"));
  const c = await import("../../src/modules/paiiaVoz/servicos/preparoConferenciaVoz.js");
  assert.ok(String(c.prepararConferenciaVoz).length > 0);
  assert.ok(fs.readFileSync(new URL("../../src/modules/paiiaVoz/servicos/preparoConferenciaVoz.js", import.meta.url), "utf8").includes('Duplicidade: Mercado Livre não conferido (${ml.erro}). Publicação bloqueada.'));
});

test("compatibilidade de carro sem veículo continua pendente (não aprova sem decisão)", async () => {
  const row = ficha();
  row.dados_conferencia.novo_anuncio.tipoVeiculo = "Carro/Caminhonete";
  row.dados_conferencia.paiia_voz.aplicacoes = [{ montadora: "Marca Desconhecida", modelo: "X", motor: "1.0", anoInicio: "2010", anoFim: "2012" }];
  await conferido(row, mundo({ tipoCategoria: "Carro/Caminhonete" }));
  const r = montarRevisao(row);
  assert.ok(r.pendencias.some((p) => p.id === "compatibilidade"));
  assert.equal(r.podeAprovar, false);
});

test("foto sem fundo branco: só aviso (não bloqueia)", async () => {
  const row = await prontaParaAprovar();
  row.dados_conferencia.paiia_voz.fotos = [{ id: "a", versao: "tratada", usar: true }, { id: "b", versao: "original", usar: true }];
  const r = montarRevisao(row);
  assert.deepEqual(r.pendencias.map((p) => [p.id, p.tipo]), [["fotos_tratadas", "aviso"]]);
  assert.equal(r.podeAprovar, true);
});

test("sincronização do Voz preserva a aprovação gravada", async () => {
  const row = await prontaParaAprovar();
  row.dados_conferencia = comRevisao(row.dados_conferencia, aprovarRevisao(row).revisao);
  const contaF = { lerFicha: async () => ({ ok: true, ficha: structuredClone(row) }), salvarFicha: async ({ paiiaVoz }) => { contaF.ultimo = paiiaVoz; return { ok: true, fichaId: row.id }; } };
  const r = await N.sincronizarFichaVoz({ fichaVozId: "v", fichaIdPAIIA: row.id, codigo: "856371-305", titulo: "Lanterna Dianteira Cristal Ônibus Neobus Mega Plus", descricao: "", preco: "97,92", oem: "" }, [], { usuarioId: "u1", ...contaF });
  assert.equal(r.ok, true);
  assert.equal(contaF.ultimo.revisao?.aprovada, true);
});

test("tela e serviço: aprovação sem avisos do navegador; nada de publicar", () => {
  const tela = ler("src/modules/paiiaVoz/PreparoPublicacaoVoz.jsx");
  assert.equal(/\balert\(|\bconfirm\(|window\.prompt/.test(tela), false, "sem alert/confirm");
  assert.equal(/publicar\(|acao:\s*"publicar"/.test(tela), false);
  const s = ler("src/modules/paiiaVoz/servicos/preparoVozService.js");
  assert.ok(s.includes("aprovarRevisao(") && s.includes("fichaSoNoNovoAnuncio(r.ficha)") && s.includes('.eq("updated_at", r.ficha.updated_at)'));
  assert.equal(/acao:\s*"publicar"/.test(s), false);
});
