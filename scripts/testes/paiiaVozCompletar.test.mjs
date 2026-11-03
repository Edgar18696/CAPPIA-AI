// =============================================================
// PAIIA Voz — Pacote C (03/11/2026): conversa “Completar a ficha”.
//   node --test scripts/testes/paiiaVozCompletar.test.mjs
// Puro (sem rede): só o que foi dito entra na ficha; nada é inventado.
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { criarFichaVoz, aplicarInterpretacao, incluirAplicacao } from "../../src/modules/paiiaVoz/servicos/fichaVoz.js";
import { definirTitulo, definirTextoDescricao, descricaoParaEnvio, mapearRapidoParaNovoAnuncio } from "../../src/modules/paiiaVoz/servicos/rascunhoRapido.js";
import { dadosCompletosVoz } from "../../src/modules/paiiaVoz/servicos/fichaCompletaVoz.js";
import * as C from "../../src/modules/paiiaVoz/servicos/completarVoz.js";

const ler = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const CONTAS = [{ id: "2412238242", nome: "REVELAÇÃO" }, { id: "1729335019", nome: "LOJA ONLINE" }, { id: "824312524", nome: "CIEBR" }];
const OPC = { fotos: 4, contas: CONTAS, agora: 5 };

/** Igual à ficha de teste do celular: 4 fotos, código, título e “Master 3 2012 a 2026” dito na descrição. */
function fichaPresilha() {
  let f = criarFichaVoz({ agora: 1, id: "v-presilha" });
  f = aplicarInterpretacao(f, { itens: [{ campo: "codigoPrincipal", valor: "242101345R" }], naoEntendido: [], avisos: [] }, { origem: "digitado", agora: 1 }).ficha;
  f = definirTitulo(f, "Presilha Plástica Acabamento Lateral Master 3", { origem: "digitado", agora: 2 });
  f = definirTextoDescricao(f, "Master 3 2012 a 2026", { agora: 3 });
  incluirAplicacao(f, { texto: "Master 3 2012 a 2026", montadora: "", modelos: ["Master 3"], motores: [], anoInicio: 2012, anoFim: 2026, tipoVeiculo: "" }, { origem: "usuario", agora: 3 });
  return f;
}
const dizer = (f, t) => C.responderCompletar(f, t, OPC);

test("abertura: diz o que já tem e pergunta só o que falta", () => {
  const a = C.aberturaCompletar(fichaPresilha(), { fotos: 4 });
  assert.equal(a.texto, "Já tenho suas fotos, código e título. Qual é a marca da peça?");
  assert.equal(a.pergunta.campo, "marca");
});

test("conversa completa da presilha: chega à conferência com a ficha completa, sem inventar nada", () => {
  let f = fichaPresilha();
  const passos = [];
  const roteiro = { marca: "Torken", quantidade: "10", preco: "39,90", montadora: "Renault", confirmarAplicacao: "sim", maisAplicacao: "não", tipoVeiculo: "carro", pesoMedidas: "200 gramas, 20 por 10 por 5", conta: "Loja Online", modalidade: "Premium" };
  for (let i = 0; i < 15; i++) {
    const p = C.proximaPerguntaCompletar(f, { fotos: 4 });
    if (!p || p.acao) { passos.push(p?.campo || "fim"); break; }
    passos.push(p.campo);
    const r = dizer(f, roteiro[p.campo]);
    assert.ok(r.anotado.length, `entendeu a resposta de ${p.campo}`);
    f = r.ficha;
  }
  assert.deepEqual(passos.filter((x) => x !== "tipoVeiculo"), ["marca", "quantidade", "preco", "montadora", "confirmarAplicacao", "maisAplicacao", "pesoMedidas", "conta", "modalidade", "conferir"]);
  const d = dadosCompletosVoz(f, { fotos: 4 });
  assert.equal(d.marca, "Torken");
  assert.equal(d.quantidade, "10");
  assert.equal(d.preco, "39,90");
  assert.deepEqual(d.medida, { peso_g: 200, comprimento_cm: 20, largura_cm: 10, altura_cm: 5 });
  assert.equal(d.aplicacoes.length, 1);
  assert.equal(d.aplicacoes[0].montadora, "Renault");
  assert.equal(d.aplicacoes[0].modelo, "Master 3");
  assert.equal(d.aplicacoes[0].anoInicio, "2012");
  assert.ok(d.tipoVeiculo, "tipo de veículo definido");
  assert.equal(d.completa, true, d.pendencias.join(" | "));
  assert.equal(C.estadoCompletar(f).conta, "1729335019");
  assert.equal(C.estadoCompletar(f).modalidade, "premium");
  // peso/medidas não vão no texto da descrição (vão para os campos)
  assert.ok(!descricaoParaEnvio(f).includes("200 g"));
  assert.ok(mapearRapidoParaNovoAnuncio(f).dados.pesoMedidasVoz?.campos?.pesoFreteML);
});

test("várias respostas de uma vez e correções a qualquer momento", () => {
  let f = fichaPresilha();
  let r = dizer(f, "marca Torken, 10 peças, 39,90");
  f = r.ficha;
  let d = dadosCompletosVoz(f, { fotos: 4 });
  assert.deepEqual([d.marca, d.quantidade, d.preco], ["Torken", "10", "39,90"]);
  assert.equal(r.pergunta.campo, "montadora", "pula direto para o que falta");
  r = dizer(f, "na verdade o preço é 42");
  f = r.ficha;
  assert.equal(dadosCompletosVoz(f, { fotos: 4 }).preco, "42,00");
  assert.equal(r.pergunta.campo, "montadora", "a correção não perde a pergunta");
  // peso em duas vezes: a linha é única e sem dúvida de “dois pesos”
  f = dizer(f, "pesa 150 gramas").ficha;
  f = dizer(f, "200 gramas e 20 por 10 por 5 centímetros").ficha;
  d = dadosCompletosVoz(f, { fotos: 4 });
  assert.deepEqual(d.medida, { peso_g: 200, comprimento_cm: 20, largura_cm: 10, altura_cm: 5 });
  assert.ok(!d.pendencias.some((p) => /dois pesos/.test(p)));
});

test("nada é inventado: “sim” não vira marca; aplicação da descrição só entra com o seu sim; “não” descarta", () => {
  let f = fichaPresilha();
  let r = dizer(f, "sim");
  assert.equal(dadosCompletosVoz(r.ficha, { fotos: 4 }).marca, "");
  assert.match(r.resposta, /^Não entendi/);
  f = dizer(f, "marca Torken, 10 peças, 39,90").ficha;
  f = dizer(f, "Renault").ficha;
  assert.equal(dadosCompletosVoz(f, { fotos: 4 }).aplicacoes.length, 0, "ainda não confirmada");
  r = dizer(f, "não");
  assert.equal(dadosCompletosVoz(r.ficha, { fotos: 4 }).aplicacoes.length, 0);
  assert.equal(r.pergunta.campo, "aplicacao", "pergunta o veículo certo");
  r = dizer(r.ficha, "Renault Master 2013 a 2022");
  assert.equal(r.pergunta.campo, "confirmarAplicacao");
  r = dizer(r.ficha, "sim");
  const ap = dadosCompletosVoz(r.ficha, { fotos: 4 }).aplicacoes;
  assert.deepEqual(ap.map((a) => [a.montadora, a.modelo, a.anoInicio, a.anoFim]), [["Renault", "Master", "2013", "2022"]]);
  // veículo sem montadora dita: pergunta a montadora (não deduz)
  r = dizer(fichaPresilha(), "marca Torken, 3 peças, 10,00");
  r = dizer(r.ficha, "não");
  r = dizer(r.ficha, "Kangoo 2010");
  assert.equal(r.pergunta.campo, "montadora");
});

test("aplicação escrita na descrição: oferecida, só entra com sim; montadora perguntada (não deduzida)", () => {
  let f = criarFichaVoz({ agora: 1, id: "v-desc" });
  f = aplicarInterpretacao(f, { itens: [{ campo: "codigoPrincipal", valor: "242101345R" }], naoEntendido: [], avisos: [] }, { origem: "digitado", agora: 1 }).ficha;
  f = definirTitulo(f, "Presilha Plástica Acabamento Lateral Master 3", { origem: "digitado", agora: 2 });
  f = definirTextoDescricao(f, "Presilha de acabamento\nMaster 3 2012 a 2026", { agora: 3 });
  f = dizer(f, "marca Torken, 10 peças, 39,90").ficha;
  let p = C.proximaPerguntaCompletar(f, { fotos: 4 });
  assert.equal(p.campo, "aplicacaoDescricao");
  assert.match(p.texto, /Na descrição tem “Master 3 2012 a 2026”/);
  assert.equal(dadosCompletosVoz(f, { fotos: 4 }).aplicacoes.length, 0, "não entra sozinha");
  let r = dizer(f, "sim");
  assert.equal(r.pergunta.campo, "montadora");
  r = dizer(r.ficha, "é Renault");
  assert.equal(dadosCompletosVoz(r.ficha, { fotos: 4 }).aplicacoes.length, 0, "só grava depois do sim para o texto completo");
  assert.equal(r.pergunta.campo, "confirmarAplicacao");
  assert.match(r.pergunta.texto, /Confere a aplicação Renault Master 3 2012 à 2026\. Confirmo\?/);
  r = dizer(r.ficha, "sim");
  assert.deepEqual(dadosCompletosVoz(r.ficha, { fotos: 4 }).aplicacoes.map((a) => [a.montadora, a.modelo, a.anoInicio, a.anoFim]), [["Renault", "Master 3", "2012", "2026"]]);
  assert.equal(r.pergunta.campo, "maisAplicacao");
  // “não”: a linha não volta a ser oferecida
  const r2 = dizer(f, "não");
  assert.equal(r2.pergunta.campo, "aplicacao");
});

test("aplicação dita: confirma o texto completo antes de gravar; correção no lugar", () => {
  let f = dizer(fichaPresilha(), "marca Torken, 10 peças, 39,90").ficha;
  f = dizer(f, "não").ficha; // descarta a da descrição
  let r = dizer(f, "Renault Master 2.3 2013 a 2022");
  assert.equal(dadosCompletosVoz(r.ficha, { fotos: 4 }).aplicacoes.length, 0);
  assert.equal(r.pergunta.campo, "confirmarAplicacao");
  assert.match(r.pergunta.texto, /Renault Master 2\.3 2013 à 2022/);
  r = dizer(r.ficha, "não, é Renault Master 2014 a 2022");
  assert.equal(r.pergunta.campo, "confirmarAplicacao", "a corrigida também é confirmada");
  assert.match(r.pergunta.texto, /Renault Master 2014 à 2022/);
  r = dizer(r.ficha, "sim");
  assert.deepEqual(dadosCompletosVoz(r.ficha, { fotos: 4 }).aplicacoes.map((a) => [a.modelo, a.anoInicio]), [["Master", "2014"]]);
});

test("ficha sem código e sem título: pergunta primeiro; código falado sem traço não dito", () => {
  let f = criarFichaVoz({ agora: 1, id: "v-vazia" });
  let r = C.responderCompletar(f, "2421-01345 R", { fotos: 0, contas: CONTAS, origem: "voz" });
  assert.equal(C.proximaPerguntaCompletar(f, { fotos: 0 }).campo, "codigo");
  assert.match(r.resposta, /código 242101345R/);
  assert.equal(r.pergunta.campo, "titulo");
  r = C.responderCompletar(r.ficha, "Presilha Plástica Acabamento Lateral Master 3", { fotos: 0, contas: CONTAS, origem: "voz" });
  assert.equal(r.pergunta.campo, "marca");
  // digitado com traço: preservado
  const d = C.responderCompletar(criarFichaVoz({ agora: 1, id: "v2" }), "2421-01345R", { fotos: 0, contas: CONTAS, origem: "digitado" });
  assert.match(d.resposta, /código 2421-01345R/);
  // sem fotos: o fim avisa (o PAIIA não inventa foto)
  assert.match(C.fimCompletar(r.ficha, { fotos: 0 }).texto, /Fotos/);
});

test("compatibilidade: modelo fora do catálogo do ML → pergunta o nome de lá, confirma e confere de novo", () => {
  let f = fichaPresilha();
  for (const t of ["marca Torken, 10 peças, 39,90", "Renault", "sim", "não", "carro", "200 g, 20 x 10 x 5 cm", "Loja Online", "premium"]) {
    const p = C.proximaPerguntaCompletar(f, { fotos: 4 });
    if (p?.campo === "tipoVeiculo" || t !== "carro") f = dizer(f, t).ficha;
  }
  f = C.registrarConferencia(f, { fotos: 4, revisao: { pendencias: [{ id: "compatibilidade", tipo: "pergunta", texto: "Compatibilidade: nenhum veículo do catálogo confirmou as aplicações (modelo Master 3 não encontrado no catálogo). Publicar sem compatibilidade?" }] }, sugerida: "" });
  let p = C.proximaPerguntaCompletar(f, { fotos: 4 });
  assert.equal(p.campo, "compatModelo");
  assert.match(p.texto, /não achou “Master 3”/);
  let r = dizer(f, "Master");
  assert.equal(r.pergunta.campo, "confirmarAplicacao");
  assert.match(r.pergunta.texto, /Renault Master 2012 à 2026/);
  r = dizer(r.ficha, "sim");
  assert.deepEqual(dadosCompletosVoz(r.ficha, { fotos: 4 }).aplicacoes.map((a) => [a.montadora, a.modelo, a.anoInicio, a.anoFim]), [["Renault", "Master", "2012", "2026"]]);
  assert.equal(C.proximaPerguntaCompletar(r.ficha, { fotos: 4 }).acao, "conferir", "aplicação mudou: confere de novo");
  // outro motivo (período/motor) não é “modelo fora do catálogo”: não pergunta o modelo
  const f3 = C.registrarConferencia(f, { fotos: 4, revisao: { pendencias: [{ id: "compatibilidade", tipo: "pergunta", texto: "Compatibilidade: nenhum veículo do catálogo confirmou as aplicações (nenhum veículo do catálogo confirma todos os dados aprovados (período, motor)). Publicar sem compatibilidade?" }] }, sugerida: "" });
  assert.equal(C.proximaPerguntaCompletar(f3, { fotos: 4 }), null);
  // repetir o mesmo nome não entra em laço
  assert.ok(C.estadoCompletar(dizer(f, "Master 3").ficha).pulados.includes("compatModelo"));
  // “pular” deixa a decisão para a revisão (nada é publicado sem compatibilidade sozinho)
  const r2 = dizer(f, "pular");
  assert.ok(C.estadoCompletar(r2.ficha).pulados.includes("compatModelo"));
});

test("pular, sem aplicação e tipo de veículo dito", () => {
  let f = fichaPresilha();
  let r = dizer(f, "pular");
  assert.equal(r.pergunta.campo, "quantidade");
  assert.ok(C.estadoCompletar(r.ficha).pulados.includes("marca"));
  f = r.ficha;
  f = dizer(f, "10").ficha;
  f = dizer(f, "R$ 39,90").ficha;
  f = dizer(f, "não").ficha; // descarta a da descrição
  r = dizer(f, "sem aplicação");
  assert.equal(r.pergunta.campo, "tipoVeiculo");
  r = dizer(r.ficha, "linha pesada");
  assert.equal(dadosCompletosVoz(r.ficha, { fotos: 4 }).tipoVeiculo, "Linha Pesada");
  assert.equal(r.pergunta.campo, "pesoMedidas");
  assert.match(C.fimCompletar(r.ficha, { fotos: 4 }).texto, /deixado para depois: marca, aplicações/);
});

test("conferência: mudou algo depois → confere de novo; categoria sugerida só com sim", () => {
  let f = fichaPresilha();
  for (const t of ["marca Torken, 10 peças, 39,90", "Renault", "sim", "não", "carro", "200 g, 20 x 10 x 5 cm", "CIEBR", "premium"]) {
    const p = C.proximaPerguntaCompletar(f, { fotos: 4 });
    if (p?.campo === "tipoVeiculo" || t !== "carro") f = dizer(f, t).ficha;
  }
  assert.equal(C.proximaPerguntaCompletar(f, { fotos: 4 }).acao, "conferir");
  f = C.registrarConferencia(f, { fotos: 4, revisao: { pendencias: [{ id: "categoria", tipo: "pergunta", texto: "Categoria…" }, { id: "fotos_tratadas", tipo: "aviso", texto: "x" }] }, sugerida: "MLB123 — Presilhas" });
  let p = C.proximaPerguntaCompletar(f, { fotos: 4 });
  assert.equal(p.campo, "categoria");
  let r = dizer(f, "sim");
  assert.equal(r.acao, "confirmarCategoria");
  f = C.registrarConferencia(f, { fotos: 4, revisao: { pendencias: [] }, sugerida: "" });
  assert.equal(C.proximaPerguntaCompletar(f, { fotos: 4 }), null);
  assert.equal(C.fimCompletar(f, { fotos: 4 }).pronto, true);
  f = dizer(f, "o preço é 45").ficha;
  assert.equal(C.proximaPerguntaCompletar(f, { fotos: 4 }).acao, "conferir", "preço mudou: confere de novo");
});

test("tela: conversa na etapa final, voz do navegador, ações pelos serviços de sempre; publicação inalterada", () => {
  const f = ler("src/modules/paiiaVoz/PaiiaVozRapido.jsx");
  assert.ok(f.includes("CompletarVoz"));
  assert.ok(f.includes("prepararEGravar") && f.includes("definirModalidadeEGravar") && f.includes("confirmarCategoriaEGravar"));
  const c = ler("src/modules/paiiaVoz/CompletarVoz.jsx");
  assert.ok(c.includes("speechSynthesis"));
  assert.ok(!/publicar\(|salvarFichaAprovada|aprovarRevisaoEGravar/.test(c + f.slice(f.indexOf("// ---------------- Completar"))), "a conversa não aprova nem publica");
  const r = ler("src/modules/paiiaVoz/servicos/rascunhoRapido.js");
  assert.ok(r.includes('export const ETAPAS = ["fotos", "codigo", "titulo", "descricao", "enviar"];'), "as 5 etapas continuam");
});
