// =============================================================
// PAIIA — TESTES: recuperação da Conferência pela ficha da base (F5)
//   node --test scripts/testes/recuperacaoFichaConferencia.test.mjs
// Sem rede: usa o formato real gravado em paiia_anuncios.dados_conferencia.
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { montarRecuperacaoDaFicha, urlsFotosFicha } from "../../src/services/fichaConferencia.js";

const ID = "11111111-2222-3333-4444-555555555555";
const FOTOS = ["https://x.supabase.co/storage/v1/a.jpg", "https://x.supabase.co/storage/v1/b.jpg", "https://x.supabase.co/storage/v1/c.jpg"];
const COMPAT = "RENAULT\n\n• Symbol\n  Motor: 1.6 16v\n  Período: 2009 até 2013\n\n• Logan\n  Motor: 1.6 8v\n  Período: 2010 até 2014";
const MANUAIS = [
  { montadora: "RENAULT", modelo: "Sandero", motor: "1.6 16v", anoInicio: "2010", anoFim: "2014", versao: "", origem: "manual" },
  { montadora: "RENAULT", modelo: "Clio", motor: "", anoInicio: "", anoFim: "", versao: "", origem: "manual" },
];
const LOGISTICA = {
  medida: { peso_g: 1000, comprimento_cm: 61, largura_cm: 34, altura_cm: 8 },
  nivel: "CONFIRMADO_PELO_USUARIO",
  confirmado: true,
  confirmacao: { ok: true, em: "2026-10-05T10:00:00Z" },
  modalidade: "xd_drop_off",
};
// Os 16 blocos preenchidos (campos da ficha).
const CAMPOS = {
  titulo: "Mangueira Direção Hidráulica Symbol 1.6 16v",
  preco: "372.36",
  codigo: "497207698R",
  descricao: "MANGUEIRA DO SISTEMA DE DIREÇÃO HIDRÁULICA",
  marca: "Torken",
  numeroPeca: "497207698R",
  gtin: "7891234567895",
  tipoVeiculo: "Carro/Caminhonete",
  nomePeca: "Mangueira Direção Hidráulica",
  categoriaML: { id: "MLB193805", caminho: "Acessórios > Mangueira Direção Hidráulica", origem: "usuario" },
  compatibilidades: COMPAT,
  observacaoCompatibilidade: "Atenção — confira o código.",
  modoEnvio: "meli",
  lojaOficial: "",
  quantidadeEstoque: "3",
  sku: "497207698R",
  pesoEnvio: "1000", comprimentoEnvio: "61", larguraEnvio: "34", alturaEnvio: "8",
  condicao: "novo",
  tipoGarantia: "vendedor",
  mesesGarantia: "3",
  limiteVenda: "",
  informacaoRegulatoria: "Não se aplica",
  caracteristicasSecundarias: "",
  logistica: LOGISTICA,
  contaDestinoML: "",
  anuncioIdPAIIA: "",
  fotos: FOTOS,
  aplicacoesManuais: MANUAIS,
  // Revisão da Conferência (05/10): dois tipos de compatibilidade e dados técnicos.
  modelosSemDetalhes: [{ montadora: "Renault", modelo: "Laguna" }, { montadora: "Renault", modelo: "Grand Scenic" }],
  aplicacoesBaseExcluidas: ["RENAULT|LOGAN|1.0|2001|2026|"],
  funcaoPeca: "Suporte do conjunto de transmissão e motor",
  fonteFuncao: "Renault Mecânico",
  especificacaoTecnica: "M12 × 1,75 × 35",
  termoComercial: "Parafuso suporte motor",
};
function fichaBase({ aprovada = false, etapa = "conferencia", campos = CAMPOS, salvo = "2026-10-05T10:00:00.000Z", conta = null } = {}) {
  return {
    id: ID,
    codigo: "497207698r",
    titulo: campos.titulo,
    status_fluxo: aprovada ? "conferencia_aprovada" : "rascunho",
    conta_destino_ml_user_id: conta,
    updated_at: salvo,
    dados_conferencia: {
      versao: 3,
      salvo_em: salvo,
      anuncio: { codigo: "497207698r", titulo: "titulo de origem", fotos: FOTOS, imagens: FOTOS, aplicacoes: [] },
      ficha: {
        campos,
        origem: { titulo: "titulo de origem" },
        anuncioConferido: aprovada ? { codigo: "497207698R", titulo: campos.titulo, fotos: FOTOS, tipoVeiculo: "Carro/Caminhonete" } : null,
        payloadTeste: aprovada ? { garantia: { tipo: "vendedor", meses: "3" } } : null,
        assinaturaAprovada: aprovada ? "[assinatura]" : "",
        etapa,
      },
    },
  };
}

test("A/B) F5 com ficha em rascunho: MESMA ficha, todos os 16 blocos, fica na Conferência", () => {
  const r = montarRecuperacaoDaFicha(fichaBase());
  assert.equal(r.ok, true);
  assert.equal(r.id, ID);
  assert.equal(r.chave, "497207698R");
  assert.equal(r.fichaConferencia.etapa, "conferencia");
  assert.equal(r.fichaConferencia.campos.anuncioIdPAIIA, ID, "mesmo ID: não cria outra ficha");
  for (const [k, v] of Object.entries(CAMPOS)) {
    if (k === "anuncioIdPAIIA") continue;
    assert.deepEqual(r.fichaConferencia.campos[k], v, `campo ${k}`);
  }
});

test("C) compatibilidades e aplicações manuais (inclusive modelo sem detalhes) voltam separadas e intactas", () => {
  const r = montarRecuperacaoDaFicha(fichaBase());
  assert.equal(r.fichaConferencia.campos.compatibilidades, COMPAT);
  assert.deepEqual(r.aplicacoesManuais, MANUAIS);
  assert.equal(r.aplicacoesManuais.length, 2);
  assert.equal(r.aplicacoesManuais[1].motor, "", "modelo sem detalhes continua sem detalhes (nada inventado)");
});

test("D) tipo de veículo volta com o VALOR escolhido (não vazio)", () => {
  const r = montarRecuperacaoDaFicha(fichaBase());
  assert.equal(r.fichaConferencia.campos.tipoVeiculo, "Carro/Caminhonete");
});

test("E) fotos voltam na ordem; só endereços públicos vão para a ficha", () => {
  const r = montarRecuperacaoDaFicha(fichaBase());
  assert.deepEqual(r.fotos, FOTOS);
  assert.deepEqual(r.anuncio.fotos, FOTOS);
  const lista = urlsFotosFicha([{ imagem_processada: FOTOS[0] }, "data:image/png;base64,AAAA", { url: FOTOS[1] }, "blob:http://x/1", FOTOS[2]]);
  assert.deepEqual(lista, FOTOS);
});

test("F) peso e medidas voltam CONFIRMADOS", () => {
  const r = montarRecuperacaoDaFicha(fichaBase());
  assert.deepEqual(r.fichaConferencia.campos.logistica, LOGISTICA);
  assert.equal(r.fichaConferencia.campos.logistica.confirmacao.ok, true);
});

test("G) categoria ML volta a mesma", () => {
  const r = montarRecuperacaoDaFicha(fichaBase());
  assert.deepEqual(r.fichaConferencia.campos.categoriaML, CAMPOS.categoriaML);
});

test("aprovada e na Publicação: volta aprovada e na Publicação, com a conta da base", () => {
  const r = montarRecuperacaoDaFicha(fichaBase({ aprovada: true, etapa: "publicacao", conta: "2412238242" }));
  assert.equal(r.fichaConferencia.etapa, "publicacao");
  assert.equal(r.fichaConferencia.assinaturaAprovada, "[assinatura]");
  assert.equal(r.fichaConferencia.campos.contaDestinoML, "2412238242");
  assert.ok(r.fichaConferencia.payloadTeste);
});

test("aprovada mas o usuário estava revisando a Conferência: volta na Conferência", () => {
  const r = montarRecuperacaoDaFicha(fichaBase({ aprovada: true, etapa: "conferencia" }));
  assert.equal(r.fichaConferencia.etapa, "conferencia");
  assert.equal(r.fichaConferencia.assinaturaAprovada, "[assinatura]");
});

test("ficha antiga (só aprovada, formato v2 sem campos.fotos): usa as fotos aprovadas", () => {
  const base = fichaBase({ aprovada: true, etapa: "publicacao", campos: { ...CAMPOS, fotos: undefined } });
  base.dados_conferencia.anuncio.fotos = [];
  const r = montarRecuperacaoDaFicha(base);
  assert.deepEqual(r.fotos, FOTOS);
});

test("cópia local MAIS NOVA da mesma ficha (F5 logo após digitar) mantém o que foi digitado", () => {
  const local = { salvoEm: "2026-10-05T10:00:05.000Z", campos: { ...CAMPOS, anuncioIdPAIIA: ID, titulo: "Titulo digitado agora" } };
  const r = montarRecuperacaoDaFicha(fichaBase(), local);
  assert.equal(r.fichaConferencia.campos.titulo, "Titulo digitado agora");
  assert.deepEqual(r.fotos, FOTOS, "fotos continuam as da base");
});

test("cópia local MAIS VELHA ou de OUTRA ficha não substitui a base", () => {
  const velha = { salvoEm: "2026-10-05T09:00:00.000Z", campos: { ...CAMPOS, anuncioIdPAIIA: ID, titulo: "velho" } };
  const outra = { salvoEm: "2026-10-05T11:00:00.000Z", campos: { ...CAMPOS, anuncioIdPAIIA: "outra-ficha", titulo: "outra" } };
  assert.equal(montarRecuperacaoDaFicha(fichaBase(), velha).fichaConferencia.campos.titulo, CAMPOS.titulo);
  assert.equal(montarRecuperacaoDaFicha(fichaBase(), outra).fichaConferencia.campos.titulo, CAMPOS.titulo);
});

test("J) vários F5 seguidos: sempre o mesmo ID, nada novo é criado", () => {
  let base = fichaBase();
  for (let i = 0; i < 5; i++) {
    const r = montarRecuperacaoDaFicha(base);
    assert.equal(r.id, ID);
    assert.equal(r.fichaConferencia.campos.anuncioIdPAIIA, ID);
    // a tela regrava a MESMA ficha com o que recuperou
    base = { ...base, dados_conferencia: { ...base.dados_conferencia, ficha: { ...base.dados_conferencia.ficha, campos: { ...r.fichaConferencia.campos, anuncioIdPAIIA: "" } } } };
  }
});

test("ficha sem dados da Conferência: mensagem clara (sem Home, sem criar outra)", () => {
  const r = montarRecuperacaoDaFicha({ id: ID, codigo: "X", dados_conferencia: {} });
  assert.equal(r.ok, false);
  assert.match(r.erro, /ainda não tem dados/);
});

test("K/L) modelos sem detalhes, exclusões e dados técnicos voltam no F5 / outra aba", () => {
  const r = montarRecuperacaoDaFicha(fichaBase());
  const c = r.fichaConferencia.campos;
  assert.deepEqual(c.modelosSemDetalhes, CAMPOS.modelosSemDetalhes);
  assert.deepEqual(c.aplicacoesBaseExcluidas, CAMPOS.aplicacoesBaseExcluidas);
  assert.equal(c.funcaoPeca, CAMPOS.funcaoPeca);
  assert.equal(c.fonteFuncao, "Renault Mecânico");
  assert.equal(c.especificacaoTecnica, "M12 × 1,75 × 35");
  assert.equal(c.termoComercial, "Parafuso suporte motor");
});
