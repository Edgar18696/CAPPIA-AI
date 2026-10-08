// =============================================================
// PAIIA — TESTES (08/10/2026): dados técnicos com uma fonte só, tipo de
// veículo padrão, registro do Bling que não pode sumir, Central e ficha
// publicada que nunca volta a parecer nova.
//   node --test scripts/testes/fluxoAnuncioCompleto.test.mjs
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

register("./simulacao/ganchoSupabaseFalso.mjs", import.meta.url);

const {
  numeroBR, kgParaG, gParaKgTexto, medidaDoNovoAnuncio, camposNovoAnuncioDaMedida, tipoVeiculoDaFicha,
  edicoesDoNovoAnuncio, textoMedida, CAMPOS_ASSINATURA_TECNICOS,
} = await import("../../src/services/dadosTecnicosAnuncio.js");
const { montarNovoAnuncioParaFicha, rascunhoDaFicha, dadosTecnicosDaFicha } = await import("../../src/services/fichaNovoAnuncio.js");
const { preservarChavesDaFicha, CHAVES_PRESERVADAS_FICHA } = await import("../../src/services/anuncioPublicacaoService.js");
const { registroDaFichaOuPublicacao, ESTADO } = await import("../../src/services/vinculoBlingPublicacao.js");
const { estadoFichaCentral, ESTADO_CENTRAL, TEXTO_ESTADO_CENTRAL, enderecoComTela, enderecoDaFicha } = await import("../../src/services/fichasCentral.js");

test("unidades: kg ↔ g sem confundir", () => {
  assert.equal(numeroBR("0,350"), 0.35);
  assert.equal(numeroBR("1.234,5"), 1234.5);
  assert.equal(kgParaG("0,350"), 350);
  assert.equal(kgParaG("0.2"), 200);
  assert.equal(kgParaG("2"), 2000, "2 kg = 2000 g (não 2 g)");
  assert.equal(gParaKgTexto(350), "0,35");
  assert.equal(gParaKgTexto(2000), "2");
  assert.equal(kgParaG(""), 0);
  assert.equal(kgParaG("abc"), 0);
});

test("medida do Novo Anúncio → ficha (g/cm) e volta (kg/cm)", () => {
  const m = medidaDoNovoAnuncio({ pesoFreteML: "0,350", comprimentoFreteML: "20", larguraFreteML: "10", alturaFreteML: "10" });
  assert.deepEqual(m, { peso_g: 350, comprimento_cm: 20, largura_cm: 10, altura_cm: 10 });
  assert.equal(medidaDoNovoAnuncio({ pesoFreteML: "0,350", comprimentoFreteML: "20", larguraFreteML: "", alturaFreteML: "10" }), null, "incompleta = null");
  assert.deepEqual(camposNovoAnuncioDaMedida(m), { pesoFreteML: "0,35", comprimentoFreteML: "20", larguraFreteML: "10", alturaFreteML: "10" });
  assert.match(textoMedida(m), /350 g \(0,35 kg\) · 20 × 10 × 10 cm/);
});

test("tipo de veículo: ficha nova sem valor = Carro/Caminhonete; salvo vence", () => {
  assert.equal(tipoVeiculoDaFicha(""), "Carro/Caminhonete");
  assert.equal(tipoVeiculoDaFicha("Linha Pesada"), "Linha Pesada");
  assert.equal(tipoVeiculoDaFicha("Linha Leve"), "Carro/Caminhonete", "valor inválido não vira opção");
});

test("Novo Anúncio grava tipo de veículo, medida (g) e marcas de edição na MESMA ficha", () => {
  const m = montarNovoAnuncioParaFicha({
    codigo: "8200442891", titulo: "Anel", descricao: "d", preco: "63,36", fotos: ["https://x/1.jpg"],
    embalagem: { pesoFreteML: "0,2", comprimentoFreteML: "8", larguraFreteML: "10", alturaFreteML: "15" },
    tipoVeiculo: "Linha Pesada", edicoes: { tipoVeiculo: "2026-10-08T10:00:00Z" },
  }, "00000000-0000-4000-8000-000000000001");
  assert.equal(m.anuncio.tipoVeiculo, "Linha Pesada");
  assert.deepEqual(m.anuncio.embalagem, { peso_g: 200, comprimento_cm: 8, largura_cm: 10, altura_cm: 15 });
  assert.equal(m.novo_anuncio.tipoVeiculo, "Linha Pesada");
  assert.equal(m.anuncio.edicoes.tipoVeiculo, "2026-10-08T10:00:00Z");
  assert.equal(m.anuncio.fichaIdPAIIA, "00000000-0000-4000-8000-000000000001");
});

test("reabrir o Novo Anúncio: dado técnico mais recente da MESMA ficha", () => {
  const na = { salvo_em: "2026-10-08T10:00:00Z", tipoVeiculo: "Linha Pesada", medida: { peso_g: 200, comprimento_cm: 8, largura_cm: 10, altura_cm: 15 } };
  // Conferência gravada DEPOIS: vence.
  const d1 = { salvo_em: "2026-10-08T11:00:00Z", novo_anuncio: na, ficha: { campos: { tipoVeiculo: "Carro/Caminhonete", logistica: { medida: { peso_g: 350, comprimento_cm: 20, largura_cm: 10, altura_cm: 10 } } } } };
  assert.deepEqual(dadosTecnicosDaFicha(d1), { tipoVeiculo: "Carro/Caminhonete", pesoFreteML: "0,35", comprimentoFreteML: "20", larguraFreteML: "10", alturaFreteML: "10", edicoes: {} });
  // Novo Anúncio mais recente: vence.
  const d2 = { ...d1, salvo_em: "2026-10-08T09:00:00Z" };
  assert.equal(dadosTecnicosDaFicha(d2).tipoVeiculo, "Linha Pesada");
  assert.equal(dadosTecnicosDaFicha(d2).pesoFreteML, "0,2");
  // Sem nada: padrão Carro/Caminhonete, sem medida inventada.
  assert.deepEqual(dadosTecnicosDaFicha({}), { tipoVeiculo: "Carro/Caminhonete", edicoes: {} });
  const r = rascunhoDaFicha({ id: "00000000-0000-4000-8000-000000000001", codigo: "X1", dados_conferencia: { novo_anuncio: { codigo: "X1", ...na } } });
  assert.equal(r.tipoVeiculo, "Linha Pesada");
  assert.equal(r.pesoFreteML, "0,2");
});

test("Conferência: edição do Novo Anúncio DEPOIS dela é edição real; abrir não é", () => {
  const medidaNova = { peso_g: 500, comprimento_cm: 20, largura_cm: 10, altura_cm: 10 };
  const fichaSalva = { campos: { tipoVeiculo: "Carro/Caminhonete", logistica: { medida: { peso_g: 350, comprimento_cm: 20, largura_cm: 10, altura_cm: 10 } }, edicoesNovoAnuncio: { embalagem: "2026-10-08T10:00:00Z" } } };
  // abrir de novo (sem edição nova): nada muda
  const a = edicoesDoNovoAnuncio({ anuncio: { tipoVeiculo: "Carro/Caminhonete", embalagem: medidaNova, edicoes: { embalagem: "2026-10-08T10:00:00Z" } }, fichaSalva });
  assert.deepEqual(a.campos, []);
  assert.equal(a.medida, undefined);
  // editado no Novo Anúncio depois: aplica e marca o campo
  const b = edicoesDoNovoAnuncio({ anuncio: { embalagem: medidaNova, edicoes: { embalagem: "2026-10-08T12:00:00Z" } }, fichaSalva });
  assert.deepEqual(b.campos, ["peso e medidas"]);
  assert.deepEqual(b.medida, medidaNova);
  assert.equal(b.marcas.embalagem, "2026-10-08T12:00:00Z");
  assert.ok(CAMPOS_ASSINATURA_TECNICOS["peso e medidas"].includes("peso e medidas confirmados"));
  // ficha nova (sem Conferência): só preenche, sem "edição após aprovação"
  const c = edicoesDoNovoAnuncio({ anuncio: { tipoVeiculo: "Linha Pesada", embalagem: medidaNova }, fichaSalva: null });
  assert.equal(c.tipoVeiculo, "Linha Pesada");
  assert.deepEqual(c.campos, []);
});

test("Conferência regrava a ficha sem perder o registro do Bling (caso MLB5351282473)", () => {
  const antigos = { integracao_bling: { mlb: "MLB5351282473", estado: "aguardando_importacao" }, compatibilidades_ml: { total: 0 }, novo_anuncio: { a: 1 }, versoes_substituidas: [{ x: 1 }], base_paiia: { b: 1 }, publicacao_sem_compatibilidade: { autorizado: true } };
  const novos = { versao: 3, salvo_em: "agora", ficha: { campos: {} }, anuncio: {} };
  const out = preservarChavesDaFicha(antigos, novos);
  for (const k of CHAVES_PRESERVADAS_FICHA) assert.deepEqual(out[k], antigos[k], k);
  assert.equal(out.salvo_em, "agora");
  // valor novo explícito (ex.: versoes_substituidas da restauração) vale
  assert.deepEqual(preservarChavesDaFicha(antigos, { versoes_substituidas: [{ y: 2 }] }).versoes_substituidas, [{ y: 2 }]);
});

test("ficha publicada sem registro gravado: registro refeito da publicação (sem inventar)", () => {
  const pub = { mlb_id: "MLB5351282473", ml_user_id: "1729335019", conta_nome: "LOJA ONLINE", bling_produto_id: 16716871254, sku: "8200442891", publicado_em: "2026-10-08T10:46:52.474Z" };
  const r = registroDaFichaOuPublicacao({}, pub);
  assert.equal(r.mlb, "MLB5351282473");
  assert.equal(r.estado, ESTADO.AGUARDANDO);
  assert.equal(r.bling_loja_id, "204883484");
  assert.equal(r.bling_produto_id, "16716871254");
  assert.equal(r.sku_oficial, "8200442891");
  assert.equal(r.refeito_da_publicacao, true);
  // sem produto Bling / conta sem loja Bling / sem MLB → sem registro
  assert.equal(registroDaFichaOuPublicacao({}, { ...pub, bling_produto_id: null }), null);
  assert.equal(registroDaFichaOuPublicacao({}, { ...pub, ml_user_id: "824312524" }), null);
  assert.equal(registroDaFichaOuPublicacao({}, { ...pub, mlb_id: null }), null);
  // registro gravado vence
  const gravado = { mlb: "MLB5351282473", estado: ESTADO.INTEGRADO, bling_loja_id: "204883484", bling_produto_id: "16716871254" };
  assert.equal(registroDaFichaOuPublicacao({ integracao_bling: gravado }, pub).estado, ESTADO.INTEGRADO);
});

test("Central: publicada sem vínculo do Bling = Aguardando Bling; integrada = fluxo concluído", () => {
  const pub = { mlb_id: "MLB5351282473", status_publicacao: "publicado", ml_user_id: "1729335019", bling_produto_id: 16716871254 };
  assert.equal(estadoFichaCentral({ status_fluxo: "publicado", publicacao: pub }), ESTADO_CENTRAL.AGUARDANDO_BLING);
  assert.equal(estadoFichaCentral({ status_fluxo: "publicado", publicacao: pub, integracao_bling: { estado: "integrado", mlb: "MLB5351282473" } }), ESTADO_CENTRAL.INTEGRADO_BLING);
  // anúncio antigo, conta sem loja Bling: só "Publicado no Mercado Livre"
  assert.equal(estadoFichaCentral({ status_fluxo: "publicado", publicacao: { ...pub, ml_user_id: "824312524" } }), ESTADO_CENTRAL.PUBLICADO);
  assert.equal(TEXTO_ESTADO_CENTRAL[ESTADO_CENTRAL.INTEGRADO_BLING], "Integrado ao Bling · Fluxo concluído");
});

test("#etapa do Novo Anúncio não vai para outras telas (senão a tela final não abre)", () => {
  const id = "00000000-0000-4000-8000-000000000001";
  const href = `https://paiia.com.br/?tela=novoAnuncio&ficha=${id}#na-etapa-dados-tecnicos`;
  assert.equal(new URL(enderecoDaFicha(href, id)).hash, "");
  assert.equal(new URL(enderecoComTela(href, "centralPublicacao")).hash, "");
  assert.equal(new URL(enderecoComTela(href, "novoAnuncio")).hash, "#na-etapa-dados-tecnicos", "no Novo Anúncio a etapa continua (F5)");
});
