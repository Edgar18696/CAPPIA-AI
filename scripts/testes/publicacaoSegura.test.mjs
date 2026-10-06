// =============================================================
// PAIIA — TESTES: publicação usa a ficha persistida, aprovação nunca
// aponta para dados antigos, modelos × descrição e Base PAIIA idempotente.
//   node --test scripts/testes/publicacaoSegura.test.mjs
// Sem rede, sem Mercado Livre, sem Bling e sem gravar nada na base.
// Dados reais da ficha 668e6d90 (SKU 7703101596) lidos em 06/10/2026
// (somente leitura): a ficha NÃO é alterada por estes testes.
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import {
  divergenciasAnuncio, digitalAnuncio, aprovadoDaFicha, conferirFichaPersistida,
  modelosConfirmados, modelosFaltandoNaDescricao, TEXTO_MODELOS_FALTANDO,
  estadoBasePAIIA, podeGravarNaBase, decisaoBaseComGravacao, conflitoDeVersao,
} from "../../src/services/publicacaoSegura.js";
import { diferencasAssinatura, mesmaAprovacao, montarRecuperacaoDaFicha } from "../../src/services/fichaConferencia.js";

const FOTOS = [1, 2, 3, 4, 5].map((i) => `https://arqzpqkkpwikyecdbopf.supabase.co/storage/v1/object/public/imagens/x/processadas/foto-${i}.jpg`);
const DESC_7 = "PARAFUSO DE AÇO\n\nCompatível com os veículos:\nDuster\nGrand Scenic\nKangoo\nLaguna\nLogan\nMegane\nSandero\n\nEspecificações Técnicas:\nCondição do item: Produto novo\n\nCódigo de Referência:\n7703101596\n\nGarantia: 3 Meses\n\nATENÇÃO: Antes de efetuar a compra, verifique o código da peça instalada em seu veículo. A compatibilidade deve ser confirmada comparando o código informado neste anúncio com o código da peça do veículo.\n\nIMPORTANTE: Para evitar a compra de uma peça incompatível, confira sempre o código da peça antes de realizar o pedido.";
const DESC_6 = DESC_7.replace("Kangoo\n", "");
const COMPAT_7 = "RENAULT\n\n• Duster\n\n• Grand Scenic\n\n• Kangoo\n\n• Laguna\n\n• Logan\n\n• Megane\n\n• Sandero";
const MODELOS_7 = ["Duster", "Grand Scenic", "Kangoo", "Laguna", "Logan", "Megane", "Sandero"].map((modelo) => ({ montadora: "RENAULT", modelo }));

// Cópia aprovada GRAVADA na base (ficha 668e6d90 em 06/10/2026).
const PERSISTIDO = {
  codigo: "7703101596", oem: "", titulo: "Parafuso Aço Suporte Transmissão Motor Duster Logan Sandero",
  preco: "31.08", descricao: DESC_7, marca: "Torken", gtin: "", fotos: FOTOS, categoriaId: "MLB271145",
  tipoVeiculo: "Carro/Caminhonete", compatibilidades: COMPAT_7, modelosSemDetalhes: [], aplicacoesDetalhadas: [],
  quantidade: 68, quantidadeConfirmada: true, tipoAnuncio: "premium",
  logistica: { confirmado: true, medida: { peso_g: 41, comprimento_cm: 10, largura_cm: 10, altura_cm: 8 } },
};
// Cópia que estava NA MEMÓRIA da aba da Publicação (o que foi validado e publicado).
const MEMORIA = { ...PERSISTIDO, preco: "31.51", descricao: DESC_6 };
const BASE_668E = {
  id: "668e6d90-063d-4ceb-8661-824e30e85832",
  dados_conferencia: {
    salvo_em: "2026-10-06T09:38:07.871Z",
    ficha: { etapa: "publicacao", anuncioConferido: PERSISTIDO, assinaturaAprovada: "[...]", campos: { descricao: DESC_7, preco: "31.08" } },
    base_paiia: { decisao: "autorizado", gravacao: { lote_id: "c36431b2-8f39-466a-8479-05fcbb694cfc", inseridos: 1 }, decidido_em: "2026-10-05T19:28:51.764Z" },
  },
};
const envioDe = (a) => ({
  titulo: a.titulo.slice(0, 60), descricao: a.descricao, preco: a.preco, marca: a.marca, fotos: a.fotos,
  sku: a.codigo, codigo: a.codigo, gtin: a.gtin, categoria_id: a.categoriaId, quantidade: a.quantidade,
  tipoAnuncio: a.tipoAnuncio === "premium" ? "premium" : "classico",
  embalagem: { ...a.logistica.medida },
});

// ------------------------------------------------------------------
// REPRODUÇÃO dos defeitos (comportamento ANTIGO, documentado)
// ------------------------------------------------------------------
test("REPRODUÇÃO 1 — antes: a Publicação usava a memória e não relia a ficha (6 modelos e 31.51 passaram)", () => {
  // Código antigo: validar/publicar com `anuncio` da memória, sem consultar a base.
  const validadoAntigo = { descricao: MEMORIA.descricao, preco: MEMORIA.preco };
  assert.equal(validadoAntigo.descricao.includes("Kangoo"), false);
  assert.notEqual(validadoAntigo.preco, PERSISTIDO.preco);
});

test("REPRODUÇÃO 2 — antes: na etapa Publicação a assinatura nova era ADOTADA sem atualizar a cópia aprovada", () => {
  const aprovada = JSON.stringify(["T", "31.51", DESC_6, FOTOS, "", "MLB271145", "Torken", "7703101596", "RENAULT\n\n• Duster", "", "", "", "", null, 68]);
  const atual = JSON.stringify(["T", "31.51", DESC_7, FOTOS, "", "MLB271145", "Torken", "7703101596", COMPAT_7, "", "", "", "", null, 68]);
  const mudou = diferencasAssinatura(aprovada, atual);
  assert.deepEqual(mudou, ["descrição", "compatibilidades"]);
  // Regra antiga: etapa === "publicacao" → adota a atual e MANTÉM a aprovação
  // (a cópia aprovada continuava com a descrição antiga).
  const etapa = "publicacao";
  const regraAntigaMantinha = mudou.includes("assinatura ilegível") || etapa === "publicacao";
  assert.equal(regraAntigaMantinha, true);
});

test("REPRODUÇÃO 3 — antes: lote gravado sem o campo ok não era reconhecido (botão de gravar de novo)", () => {
  const salva = BASE_668E.dados_conferencia.base_paiia;
  const telaAntigaReconhecia = Boolean(salva.gravacao?.ok); // decisao.gravacao?.ok
  assert.equal(telaAntigaReconhecia, false);
});

// ------------------------------------------------------------------
// 2. Publicação usa a ficha persistida
// ------------------------------------------------------------------
test("descrição antiga em memória: validação/publicação BLOQUEADA, com os campos divergentes", () => {
  const r = conferirFichaPersistida({ tela: MEMORIA, envio: envioDe(MEMORIA), base: BASE_668E });
  assert.equal(r.ok, false);
  assert.deepEqual(r.divergencias.sort(), ["descrição", "preço"]);
  assert.match(r.motivo, /Nada foi enviado ao Mercado Livre/);
});

test("tela igual à ficha persistida: segue, e a digital é a da ficha (o validado = o publicado)", () => {
  const r = conferirFichaPersistida({ tela: PERSISTIDO, envio: envioDe(PERSISTIDO), base: BASE_668E });
  assert.equal(r.ok, true);
  assert.equal(r.digital, digitalAnuncio(PERSISTIDO));
  assert.notEqual(r.digital, digitalAnuncio(MEMORIA));
});

test("o que vai ao ML também é conferido (campo editado só na Publicação bloqueia)", () => {
  const envio = { ...envioDe(PERSISTIDO), preco: "31.51" };
  const r = conferirFichaPersistida({ tela: PERSISTIDO, envio, base: BASE_668E });
  assert.equal(r.ok, false);
  assert.deepEqual(r.divergencias, ["preço"]);
  const semFicha = conferirFichaPersistida({ tela: PERSISTIDO, envio: envioDe(PERSISTIDO), base: null });
  assert.equal(semFicha.ok, false);
  const naoAprovada = conferirFichaPersistida({ tela: PERSISTIDO, envio: envioDe(PERSISTIDO), base: { dados_conferencia: { ficha: { campos: {} } } } });
  assert.equal(naoAprovada.ok, false);
  assert.match(naoAprovada.motivo, /não tem uma Conferência aprovada/);
});

test("formato diferente não é divergência (espaços, número como texto, ordem da medida)", () => {
  const formatoOutro = {
    ...PERSISTIDO, preco: 31.08, descricao: DESC_7.replace(/\n/g, "\r\n") + "  ", marca: " torken ",
    quantidade: "68", logistica: { confirmado: true, medida: { altura_cm: "8", largura_cm: 10, comprimento_cm: "10", peso_g: "41" } },
    fotos: FOTOS.map((url) => ({ url })), tipoVeiculo: "Carro / Caminhonete",
  };
  assert.deepEqual(divergenciasAnuncio(formatoOutro, PERSISTIDO), []);
});

test("F5: a recuperação monta a tela a partir da ficha da base (não da memória)", () => {
  const rec = montarRecuperacaoDaFicha({ ...BASE_668E, codigo: "7703101596", conta_destino_ml_user_id: "1729335019" }, null);
  assert.equal(rec.ok, true);
  assert.equal(rec.fichaConferencia.anuncioConferido.descricao, DESC_7);
  assert.equal(rec.fichaConferencia.anuncioConferido.preco, "31.08");
  assert.equal(rec.fichaConferencia.etapa, "publicacao");
  // F5 não muda qual versão seria publicada: a tela recuperada = ficha persistida.
  assert.equal(conferirFichaPersistida({ tela: rec.fichaConferencia.anuncioConferido, envio: envioDe(PERSISTIDO), base: BASE_668E }).ok, true);
});

test("retorno à Central de Publicação e reabertura: mesma ficha, mesma cópia aprovada", () => {
  const primeira = montarRecuperacaoDaFicha({ ...BASE_668E, codigo: "7703101596" }, null);
  const reaberta = montarRecuperacaoDaFicha({ ...BASE_668E, codigo: "7703101596" }, primeira.fichaConferencia);
  assert.equal(reaberta.id, primeira.id);
  assert.equal(digitalAnuncio(reaberta.fichaConferencia.anuncioConferido), digitalAnuncio(PERSISTIDO));
});

test("cópia local MAIS NOVA (campos) com cópia aprovada da base: a divergência aparece (não publica calado)", () => {
  const local = { campos: { anuncioIdPAIIA: BASE_668E.id, preco: "31.51", descricao: DESC_6 }, salvoEm: "2099-01-01T00:00:00.000Z" };
  const rec = montarRecuperacaoDaFicha({ ...BASE_668E, codigo: "7703101596" }, local);
  // Os campos da tela vêm da cópia local; a aprovação, da base.
  const telaAtual = { ...rec.fichaConferencia.anuncioConferido, preco: rec.fichaConferencia.campos.preco, descricao: rec.fichaConferencia.campos.descricao };
  assert.deepEqual(divergenciasAnuncio(telaAtual, rec.fichaConferencia.anuncioConferido).sort(), ["descrição", "preço"]);
});

// ------------------------------------------------------------------
// 3. Aprovação e alterações posteriores
// ------------------------------------------------------------------
test("alteração após aprovação: qualquer campo relevante diferente invalida", () => {
  const casos = {
    título: { titulo: "Outro título" }, descrição: { descricao: DESC_6 }, preço: { preco: "31.51" }, marca: { marca: "Outra" },
    fotos: { fotos: FOTOS.slice(0, 4) }, "SKU/código": { codigo: "7703101597" }, categoria: { categoriaId: "MLB1" },
    "tipo de veículo": { tipoVeiculo: "Moto" }, compatibilidades: { compatibilidades: "RENAULT\n\n• Duster" },
    "peso/medidas": { logistica: { medida: { peso_g: 50, comprimento_cm: 10, largura_cm: 10, altura_cm: 8 } } },
    quantidade: { quantidade: 67 }, "modelos sem detalhes": { modelosSemDetalhes: [{ montadora: "RENAULT", modelo: "Clio" }] },
    "tipo de anúncio": { tipoAnuncio: "classico" },
  };
  for (const [rotulo, mudanca] of Object.entries(casos)) {
    assert.deepEqual(divergenciasAnuncio({ ...PERSISTIDO, ...mudanca }, PERSISTIDO), [rotulo], rotulo);
  }
  assert.deepEqual(divergenciasAnuncio({ ...PERSISTIDO }, PERSISTIDO), []);
});

test("aprovação antiga sem campos novos (ex.: tipo de veículo, GTIN) não cai sozinha", () => {
  const { tipoVeiculo: _t, gtin: _g, modelosSemDetalhes: _m, aplicacoesDetalhadas: _a, ...antiga } = PERSISTIDO;
  assert.deepEqual(divergenciasAnuncio({ ...PERSISTIDO }, antiga, { somenteCamposDe: antiga }), []);
  assert.deepEqual(divergenciasAnuncio({ ...PERSISTIDO, preco: "40" }, antiga, { somenteCamposDe: antiga }), ["preço"]);
});

test("assinatura ganhou tipo de veículo e GTIN: aprovação antiga (15 campos) não cai; mudança real cai", () => {
  const base15 = ["T", "31.51", DESC_7, FOTOS, "", "MLB271145", "Torken", "7703101596", COMPAT_7, "", "", "", "", null, 68];
  const atual17 = JSON.stringify([...base15, "Carro/Caminhonete", ""]);
  assert.equal(mesmaAprovacao(JSON.stringify(base15), atual17), true);
  const aprovada17 = JSON.stringify([...base15, "Carro/Caminhonete", ""]);
  assert.deepEqual(diferencasAssinatura(aprovada17, JSON.stringify([...base15, "Moto", ""])), ["tipo de veículo"]);
});

// ------------------------------------------------------------------
// 4. Modelos × descrição
// ------------------------------------------------------------------
test("modelo adicionado depois da descrição: avisa e mostra qual falta (nada é alterado)", () => {
  const modelos = modelosConfirmados({ modelosSemDetalhes: MODELOS_7 });
  assert.equal(modelos.length, 7);
  assert.deepEqual(modelosFaltandoNaDescricao({ modelos, descricao: DESC_6 }), ["Kangoo"]);
  assert.deepEqual(modelosFaltandoNaDescricao({ modelos, descricao: DESC_7 }), []);
  assert.equal(TEXTO_MODELOS_FALTANDO, "Há modelos confirmados que não aparecem na descrição.");
});

test("modelos × descrição: sem diferenciar maiúsculas/acentos; palavra inteira; sem inventar", () => {
  assert.deepEqual(modelosFaltandoNaDescricao({ modelos: ["Mégane", "Grand Scenic"], descricao: "serve MEGANE e grand  scénic" }), []);
  assert.deepEqual(modelosFaltandoNaDescricao({ modelos: ["Ka"], descricao: "Kangoo" }), ["Ka"]);
  assert.deepEqual(modelosFaltandoNaDescricao({ modelos: [], descricao: "" }), []);
  // Aplicações detalhadas + modelos sem detalhes, sem repetir.
  assert.deepEqual(modelosConfirmados({ aplicacoes: [{ modelo: "Logan", motor: "1.6" }], modelosSemDetalhes: [{ modelo: "LOGAN" }, { modelo: "Duster" }] }), ["Logan", "Duster"]);
});

// ------------------------------------------------------------------
// 1. Base PAIIA: autorização explícita + idempotência
// ------------------------------------------------------------------
test("produto já gravado (ficha 668e6d90, lote sem 'ok') é reconhecido como GRAVADO", () => {
  const e = estadoBasePAIIA(BASE_668E.dados_conferencia.base_paiia);
  assert.equal(e.gravado, true);
  assert.equal(e.loteId, "c36431b2-8f39-466a-8479-05fcbb694cfc");
});

test("tentativa de gravar duas vezes: recusada (inclusive após F5/reabrir, que releem a ficha)", () => {
  const e = estadoBasePAIIA(BASE_668E.dados_conferencia.base_paiia);
  const r = podeGravarNaBase({ estado: e, confirmacao: "CONFIRMAR_GRAVACAO_BASE_PAIIA" });
  assert.equal(r.pode, false);
  assert.equal(r.jaGravado, true);
  assert.match(r.motivo, /Nada foi gravado de novo/);
  // Duplo clique: a segunda chamada chega com a gravação em andamento.
  const novo = estadoBasePAIIA({ decisao: "autorizado" });
  assert.equal(podeGravarNaBase({ estado: novo, confirmacao: "CONFIRMAR_GRAVACAO_BASE_PAIIA", emAndamento: true }).pode, false);
});

test("produto novo sem autorização: nada é gravado (publicar/Bling/estoque não autorizam)", () => {
  for (const base of [null, {}, { decisao: "nao_salvar" }, { decisao: "" }]) {
    const e = estadoBasePAIIA(base);
    assert.equal(e.gravado, false);
    assert.equal(podeGravarNaBase({ estado: e, confirmacao: "CONFIRMAR_GRAVACAO_BASE_PAIIA" }).pode, false);
  }
  // Mesmo autorizado, sem o clique explícito de confirmação: não grava.
  const aut = estadoBasePAIIA({ decisao: "autorizado" });
  for (const c of [undefined, "", "PUBLICAR", "CRIAR_PRODUTO_BLING", true]) {
    assert.equal(podeGravarNaBase({ estado: aut, confirmacao: c }).pode, false, String(c));
  }
  assert.equal(podeGravarNaBase({ estado: aut, confirmacao: "CONFIRMAR_GRAVACAO_BASE_PAIIA" }).pode, true);
});

test("nova decisão nunca apaga uma gravação já feita (evita regravar depois)", () => {
  const anterior = BASE_668E.dados_conferencia.base_paiia;
  const r = decisaoBaseComGravacao(anterior, { decisao: "nao_salvar", decidido_em: "2026-10-07" });
  assert.equal(estadoBasePAIIA(r).gravado, true);
  assert.equal(r.gravacao.lote_id, anterior.gravacao.lote_id);
  assert.deepEqual(decisaoBaseComGravacao(null, { decisao: "nao_salvar" }), { decisao: "nao_salvar" });
});

test("lote revertido não conta como gravado; gravação com erro também não", () => {
  assert.equal(estadoBasePAIIA({ decisao: "autorizado", gravacao: { lote_id: "x", status: "revertido" } }).gravado, false);
  assert.equal(estadoBasePAIIA({ decisao: "autorizado", gravacao: { ok: false, erro: "falhou" } }).gravado, false);
  assert.equal(estadoBasePAIIA({ decisao: "autorizado", gravacao: { ok: true, lote_id: "y", inseridos: 1 } }).gravado, true);
});

// ------------------------------------------------------------------
// Concorrência: cópia antiga não sobrescreve ficha mais nova
// ------------------------------------------------------------------
test("aba com cópia antiga não sobrescreve a ficha gravada por outra aba", () => {
  assert.equal(conflitoDeVersao({ versaoEsperada: "2026-10-05T19:00:00.000Z", versaoNaBase: "2026-10-06T09:38:07.871Z" }), true);
  assert.equal(conflitoDeVersao({ versaoEsperada: "2026-10-06T09:38:07.871Z", versaoNaBase: "2026-10-06T09:38:07.871Z" }), false);
  assert.equal(conflitoDeVersao({ versaoEsperada: "", versaoNaBase: "2026-10-06T09:38:07.871Z" }), false);
  assert.equal(conflitoDeVersao({ versaoEsperada: "x", versaoNaBase: "" }), false);
});

test("aprovadoDaFicha: só vale cópia com assinatura aprovada", () => {
  assert.equal(aprovadoDaFicha(BASE_668E), PERSISTIDO);
  assert.equal(aprovadoDaFicha({ dados_conferencia: { ficha: { anuncioConferido: PERSISTIDO } } }), null);
  assert.equal(aprovadoDaFicha(null), null);
});

test("foto embutida (data:/blob:) não derruba a aprovação; foto pública trocada derruba", () => {
  const comEmbutida = { ...PERSISTIDO, fotos: [...FOTOS, "data:image/png;base64,AAAA", "blob:https://x/1"] };
  assert.deepEqual(divergenciasAnuncio(comEmbutida, PERSISTIDO), []);
  assert.deepEqual(divergenciasAnuncio({ ...PERSISTIDO, fotos: [...FOTOS.slice(0, 4), "https://outra/foto.jpg"] }, PERSISTIDO), ["fotos"]);
});

test("ficha antiga gravada sem tipo de veículo: a tela (que completa pelo campo) não é bloqueada por isso", () => {
  const { tipoVeiculo: _t, ...antiga } = PERSISTIDO;
  const base = { dados_conferencia: { ficha: { anuncioConferido: antiga, assinaturaAprovada: "[...]" } } };
  assert.equal(conferirFichaPersistida({ tela: PERSISTIDO, envio: envioDe(PERSISTIDO), base }).ok, true);
  assert.equal(conferirFichaPersistida({ tela: { ...PERSISTIDO, descricao: DESC_6 }, envio: envioDe(PERSISTIDO), base }).ok, false);
});

test("tipo de anúncio: ficha gravada 'premium' × tela 'Clássico' (caso real 668e6d90) bloqueia", () => {
  const tela = { ...PERSISTIDO, tipoAnuncio: "classico" };
  const r = conferirFichaPersistida({ tela, envio: { ...envioDe(PERSISTIDO), tipoAnuncio: "classico" }, base: BASE_668E });
  assert.equal(r.ok, false);
  assert.deepEqual(r.divergencias, ["tipo de anúncio"]);
});

test("F5 na aba ANTIGA: cópia local feita sobre versão anterior não volta por cima da ficha atual", () => {
  const base = { ...BASE_668E, codigo: "7703101596" };
  const localAntiga = { campos: { anuncioIdPAIIA: BASE_668E.id, titulo: "Título da aba antiga" }, versaoBase: "2026-10-05T10:00:00.000Z", salvoEm: "2099-01-01T00:00:00.000Z" };
  const rec = montarRecuperacaoDaFicha(base, localAntiga);
  assert.notEqual(rec.fichaConferencia.campos.titulo, "Título da aba antiga");
  // Cópia local da MESMA versão (F5 logo após digitar): continua valendo.
  const localAtual = { ...localAntiga, versaoBase: BASE_668E.dados_conferencia.salvo_em, campos: { ...localAntiga.campos, titulo: "Digitado agora" } };
  assert.equal(montarRecuperacaoDaFicha(base, localAtual).fichaConferencia.campos.titulo, "Digitado agora");
  // Cópia local antiga sem versão (formato anterior): regra antiga (data) mantida.
  const semVersao = { campos: { anuncioIdPAIIA: BASE_668E.id, titulo: "Sem versão" }, salvoEm: "2099-01-01T00:00:00.000Z" };
  assert.equal(montarRecuperacaoDaFicha(base, semVersao).fichaConferencia.campos.titulo, "Sem versão");
});
