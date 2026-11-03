// =============================================================
// PAIIA Voz — Pacote A (03/11/2026): grafia do código e buscas com/sem traço.
//   node --test scripts/testes/paiiaVozCodigoGrafia.test.mjs
// Bling/ML/base SIMULADOS: só leitura; nenhum SKU é alterado sozinho.
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { criarFichaVoz, aplicarInterpretacao, codigoPrincipal, incorporarResultadoBase } from "../../src/modules/paiiaVoz/servicos/fichaVoz.js";
import { mapearRapidoParaNovoAnuncio } from "../../src/modules/paiiaVoz/servicos/rascunhoRapido.js";
import { juntarTexto } from "../../src/modules/paiiaVoz/servicos/fichaVozNuvem.js";
import { prepararConferenciaVoz, grafiasAlternativasSKU } from "../../src/modules/paiiaVoz/servicos/preparoConferenciaVoz.js";
import { variantesDeBusca, normalizarCodigoComparacao } from "../../src/services/duplicidadeML.js";

const LOJA = "1729335019";
const API = "https://api.mercadolibre.com";
const principal = (f, valor, origem = "digitado") => aplicarInterpretacao(f, { itens: [{ campo: "codigoPrincipal", valor }], naoEntendido: [], avisos: [] }, { origem, agora: 1 }).ficha;

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


test("corrigir 2421-01345R para 242101345R: vale a grafia digitada (a anterior só no histórico)", () => {
  let f = criarFichaVoz({ agora: 1, id: "v1" });
  f = principal(f, "2421-01345R", "foto");
  assert.equal(codigoPrincipal(f).codigo, "2421-01345R");
  f = principal(f, "242101345R");
  const cp = codigoPrincipal(f);
  assert.equal(cp.codigo, "242101345R");
  assert.equal(cp.normalizado, "242101345R");
  assert.deepEqual(cp.grafiasAnteriores, ["2421-01345R"]);
  assert.equal(f.codigos.length, 1, "não duplica o código");
  // e o contrário também (o usuário manda na grafia)
  f = principal(f, "2421-01345R");
  assert.equal(codigoPrincipal(f).codigo, "2421-01345R");
  // o que vai para a ficha da conta é a grafia corrigida
  f = principal(f, "242101345R");
  assert.equal(mapearRapidoParaNovoAnuncio(f).dados.codigo, "242101345R");
});

test("sugestão da base com outra grafia NÃO troca o código escolhido", () => {
  let f = principal(criarFichaVoz({ agora: 1, id: "v2" }), "242101345R");
  f = incorporarResultadoBase(f, { encontrado: true, origem: "base", rotulo: "Base PAIIA", codigos: ["2421-01345R"], aplicacoes: [] }, { agora: 2 }).ficha;
  assert.equal(codigoPrincipal(f).codigo, "242101345R");
});

test("ficha da conta: a correção feita no Voz chega (não é tratada como edição do computador)", () => {
  assert.deepEqual(juntarTexto("2421-01345R", "2421-01345R", "242101345R"), { valor: "242101345R", conflito: false });
  // editado no computador continua vencendo
  assert.equal(juntarTexto("2421 01345R", "2421-01345R", "242101345R").valor, "2421 01345R");
});

test("buscas reconhecem com traço, sem traço e com espaço", () => {
  for (const c of ["2421-01345R", "242101345R", "2421 01345R", "2421-01345-r"]) assert.equal(normalizarCodigoComparacao(c), "242101345R");
  const v = variantesDeBusca("2421-01345R");
  assert.ok(v.includes("2421-01345R") && v.includes("242101345R"));
  assert.deepEqual(grafiasAlternativasSKU("2421-01345R"), ["242101345R"]);
  assert.deepEqual(grafiasAlternativasSKU("2421 01345R"), ["242101345R", "2421-01345R"]);
  assert.deepEqual(grafiasAlternativasSKU("242101345R"), []);
});

test("Bling: não achou com traço, achou sem traço → PERGUNTA (nada alterado, só leituras)", async () => {
  const w = mundo();
  const lidas = [];
  w.deps.lerSaldoBling = async (sku) => { lidas.push(sku); return sku === "856371305" ? { ok: true, encontrado: true, produto: { id: 777, codigo: "856371305" }, saldoFisicoTotal: 10, saldoVirtualTotal: 10 } : { ok: true, encontrado: false }; };
  const p = await prepararConferenciaVoz(ficha(), { conta: LOJA, deps: w.deps });
  const b = p.verificacoes.bling;
  assert.equal(b.estado, "pergunta");
  assert.match(b.texto, /existe como 856371305/);
  assert.match(b.texto, /Nada é alterado sozinho/);
  assert.equal(b.grafiaBling, "856371305");
  assert.deepEqual(lidas, ["856371-305", "856371305"]);
  assert.equal(p.pronto, false, "não fica pronto para publicar com o SKU divergente");
});

test("Bling: achou com a grafia da ficha → igual a antes; não achou em nenhuma → mesma pergunta de antes", async () => {
  const w = mundo();
  const p = await prepararConferenciaVoz(ficha(), { conta: LOJA, deps: w.deps });
  assert.equal(p.verificacoes.bling.estado, "ok");
  assert.equal(w.chamadas.filter((c) => c[0] === "BLING").length, 1, "só uma leitura quando acha");
  const w2 = mundo({ blingEncontrado: false });
  const p2 = await prepararConferenciaVoz(ficha(), { conta: LOJA, deps: w2.deps });
  assert.match(p2.verificacoes.bling.texto, /não existe no Bling\. O PAIIA não cria produto/);
});
