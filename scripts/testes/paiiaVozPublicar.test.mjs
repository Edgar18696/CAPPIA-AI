// =============================================================
// PAIIA Voz — ETAPA 4 (02/11/2026): botão Publicar pela rotina EXISTENTE.
//   node --test scripts/testes/paiiaVozPublicar.test.mjs
// Tudo SIMULADO (nenhuma chamada real, nada publicado, nada pago).
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { prepararConferenciaVoz, confirmarCategoriaSugerida } from "../../src/modules/paiiaVoz/servicos/preparoConferenciaVoz.js";
import { mesclarPreparo } from "../../src/modules/paiiaVoz/servicos/preparoFicha.js";
import { aprovarRevisao, comRevisao } from "../../src/modules/paiiaVoz/servicos/revisaoCelularVoz.js";
import { montarAprovacaoDoVoz, registroFreteDoPreparo } from "../../src/modules/paiiaVoz/servicos/publicacaoVoz.js";
import { camposDitosNaFala } from "../../src/modules/paiiaVoz/servicos/fichaCompletaVoz.js";
import { aprovadoDaFicha, conferirFichaPersistida, divergenciasAnuncio } from "../../src/services/publicacaoSegura.js";
import { origemFotosAprovadas } from "../../src/services/fotosDaFicha.js";
import { situacaoFrete } from "../../src/services/fretePrecificacao.js";
import { conferirLogistica } from "../../src/services/logistica/logisticaMercadoLivre.js";
import { quantidadeDaFicha } from "../../src/services/estoqueBlingPAIIA.js";
import { aplicacoesDaFicha } from "../../src/services/compatibilidadeML.js";
import { tipoVeiculoParaPublicacao } from "../../src/services/tipoVeiculoAnuncio.js";

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


async function aprovada(w = mundo()) {
  const row = await conferido(ficha(), w);
  const c = confirmarCategoriaSugerida(row.dados_conferencia.paiia_voz.preparo);
  row.dados_conferencia = mesclarPreparo(row.dados_conferencia, { ...row.dados_conferencia.paiia_voz.preparo, categoria: { decisao: c.decisao } });
  await conferido(row, w);
  row.dados_conferencia = comRevisao(row.dados_conferencia, aprovarRevisao(row, { agora: "2026-11-02T13:00:00.000Z" }).revisao);
  return row;
}

test("anúncio rápido: 'marca Torken preço 97,92 quantidade 10' vai para os CAMPOS; frase de descrição continua descrição", () => {
  const c = camposDitosNaFala("marca Torken preço 97,92 quantidade 10");
  assert.ok(c);
  assert.deepEqual(c.interpretacao.itens.map((i) => [i.campo, i.valor]), [["marca", "Torken"], ["preco", 97.92], ["quantidade", 10]]);
  assert.equal(camposDitosNaFala("lanterna dianteira cristal LED esquerda"), null);
  assert.equal(camposDitosNaFala("serve no ônibus Neobus Mega Plus 2013 a 2016"), null);
  assert.equal(camposDitosNaFala("peso 350 gramas caixa 20 x 10 x 10 cm"), null);
});

test("sem revisão aprovada: não monta nada para publicar", async () => {
  const row = await conferido(ficha());
  const m = montarAprovacaoDoVoz(row);
  assert.equal(m.ok, false);
  assert.match(m.erro, /não foi aprovada/);
});

test("revisão aprovada → ficha aprovada no FORMATO DA CONFERÊNCIA, aceita pelas conferências da Publicação existente", async () => {
  const row = await aprovada();
  const m = montarAprovacaoDoVoz(row, { agora: "2026-11-02T13:05:00.000Z" });
  assert.equal(m.ok, true, m.erro);
  const a = m.anuncioConferido;
  assert.equal(a.codigo, "856371-305");
  assert.equal(a.preco, "97.92");
  assert.equal(a.tipoAnuncio, "premium");
  assert.equal(a.marca, "Torken");
  assert.equal(a.categoriaId, "MLB456155");
  assert.equal(a.categoriaDecisao.confirmada.id, "MLB456155");
  assert.equal(a.tipoVeiculo, "Linha Pesada");
  assert.equal(a.quantidade, 10);
  assert.equal(a.fotos.length, 5);
  assert.equal(m.conta, LOJA);
  // A publicação existente reconhece a ficha aprovada
  const base = { id: row.id, dados_conferencia: m.dados };
  assert.deepEqual(aprovadoDaFicha(base), a);
  assert.equal(origemFotosAprovadas(base).ok, true, origemFotosAprovadas(base).motivo);
  const envio = { titulo: a.titulo, descricao: a.descricao, preco: a.preco, marca: a.marca, fotos: a.fotos, sku: a.codigo, gtin: "", categoria_id: a.categoriaId, tipoAnuncio: a.tipoAnuncio, quantidade: a.quantidade, condicao: "novo", embalagem: a.logistica.medida, tipo_veiculo: "Linha Pesada" };
  const fp = conferirFichaPersistida({ tela: a, envio, base });
  assert.equal(fp.ok, true, fp.motivo);
  assert.deepEqual(divergenciasAnuncio(a, aprovadoDaFicha(base)), []);
  assert.deepEqual(quantidadeDaFicha(a), { valor: 10, confirmada: true, origem: "conferencia" });
  const ap = aplicacoesDaFicha(a);
  assert.equal(ap.origem, "lista_aprovada");
  assert.equal(ap.lista.length, 1);
  assert.equal(tipoVeiculoParaPublicacao(a.tipoVeiculo, null).tipoFicha, "Linha Pesada");
  // Frete: o MESMO registro que a precificação grava, válido para a Publicação
  const s = situacaoFrete({ registro: a.freteML, atual: { conta: LOJA, medida: a.logistica.medida, modalidade: a.logistica.modalidade, categoria: a.categoriaId, tipoAnuncio: "premium", preco: a.preco } });
  assert.equal(s.estado, "ok", s.motivos.join("; "));
  // Peso e embalagem: a MESMA conferência da Publicação (simulação oficial com a medida atual)
  const L = a.logistica;
  const cl = conferirLogistica({ medidaEnvio: L.medida, origem: L.origem, nivel: L.nivel, validacao: L.validacao, simulacao: L.simulacao, confirmado: L.confirmado });
  assert.notEqual(cl.nivel, "erro", cl.texto);
  assert.equal(L.simulacao.origem, "mercado_livre");
  // Ficha: dados do Voz e do Novo Anúncio continuam; vira etapa "publicacao"
  assert.ok(m.dados.paiia_voz?.revisao?.aprovada && m.dados.novo_anuncio);
  assert.equal(m.dados.ficha.etapa, "publicacao");
  assert.equal(m.dados.etapa_fluxo, undefined);
});

test("aprovação vencida (ficha mudou) ou frete sem cotação oficial → não monta", async () => {
  const row = await aprovada();
  row.dados_conferencia.novo_anuncio.preco = "89,90";
  assert.match(montarAprovacaoDoVoz(row).erro, /mudou depois da aprovação/);
  const row2 = await aprovada();
  const p = row2.dados_conferencia.paiia_voz.preparo;
  p.verificacoes.frete.cotacao = { ...p.verificacoes.frete.cotacao, origem: "simulacao_teste" };
  assert.equal(registroFreteDoPreparo(p), null);
  assert.match(montarAprovacaoDoVoz(row2).erro, /cotação oficial/);
  // Cotação feita com outra medida → não serve como simulação do peso/embalagem
  const row3 = await aprovada();
  const f3 = row3.dados_conferencia.paiia_voz.preparo.verificacoes.frete;
  f3.params = { ...f3.params, medida: { ...f3.params.medida, peso_g: 900 } };
  assert.match(montarAprovacaoDoVoz(row3).erro, /Peso\/medidas mudaram/);
});

test("Publicação existente: modo simples só automatiza LEITURAS; publicar exige toque + confirmação; fora dele nada muda", () => {
  const f = ler("src/components/RevisaoPublicacaoML.jsx");
  assert.ok(f.includes("modoSimples = false"), "padrão: comportamento antigo");
  assert.ok(f.includes("{!modoSimples && (<label"), "caixa 'autorizo' continua no fluxo normal");
  assert.ok(f.includes("onClick={modoSimples ? tocarPublicarSimples : publicar}"));
  assert.match(f, /function tocarPublicarSimples\(\) \{[\s\S]*?if \(!autorizado\) \{\s*setAutorizado\(true\);\s*setArmado\(true\);\s*return;\s*\}\s*publicar\(\);/);
  // publicar() continua exigindo autorização, zero bloqueios e a confirmação (armado); a validação prévia é
  // dispensada SÓ na publicação automática (13/11: o servidor valida no ML dentro da publicação).
  assert.match(f, /async function publicar\(\) \{\s*if \(!autorizado \|\| \(!autoPublicacao && !validacao\?\.valido\) \|\| bloqueios\.length > 0\) return;\s*if \(!armado\) \{/);
  // automações do modo simples: só usarBlingNesteAnuncio (leitura) e validarNoML (não publica)
  const auto = f.slice(f.indexOf("const autoSimplesRef"), f.indexOf("function tocarPublicarSimples"));
  assert.ok(auto.includes("await usarBlingNesteAnuncio()") && auto.includes("await validarNoML()"));
  assert.equal(/publicar\(\)|criarProduto|setAutorizado/.test(auto), false, "nenhuma escrita automática");
});

test("serviço da Etapa 4: usa salvarFichaAprovada/salvarContaDestino de sempre e nunca regrava ficha publicada", () => {
  const s = ler("src/modules/paiiaVoz/servicos/publicarVozService.js");
  assert.ok(s.includes("salvarFichaAprovada(") && s.includes("salvarContaDestino("));
  assert.ok(s.indexOf("fichaFechada(r.ficha)") < s.indexOf("salvarFichaAprovada("), "ficha publicada é recusada antes de gravar");
  assert.ok(s.includes("s.anuncioId !== r.ficha.id"));
  assert.equal(/functions\.invoke|acao:\s*"publicar"/.test(s), false, "não chama o Mercado Livre");
  const t = ler("src/modules/paiiaVoz/PreparoPublicacaoVoz.jsx");
  assert.ok(t.includes("<RevisaoPublicacaoML") && t.includes("modoSimples"), "publica pela tela existente");
});

test("Bling: vínculo automático só é verificado/anunciado na LojaOnlineSP (regra já existente)", async () => {
  const { lojaBlingDaConta, vinculoAutomaticoDaLoja } = await import("../../src/services/vinculoBlingPublicacao.js");
  assert.equal(lojaBlingDaConta(LOJA)?.bling_loja_id, "204883484");
  assert.equal(lojaBlingDaConta("824312524"), null);
  assert.equal(lojaBlingDaConta("2412238242"), null);
  assert.equal(vinculoAutomaticoDaLoja("204883484"), true);
});
