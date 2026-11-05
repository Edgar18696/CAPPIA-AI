// =============================================================
// PAIIA Voz — conversa “Completar a ficha” (fluxo único, 03/11/2026).
//   node --test scripts/testes/paiiaVozCompletar.test.mjs
// Puro (sem rede): só o que foi dito entra na ficha; nada é inventado.
// Ordem: código → título → descrição → marca → preço → estoque → peso →
// medidas → aplicações → tipo → conta → modalidade → conferência → categoria.
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { criarFichaVoz, aplicarInterpretacao, incluirAplicacao } from "../../src/modules/paiiaVoz/servicos/fichaVoz.js";
import { definirTitulo, definirTextoDescricao, descricaoParaEnvio, mapearRapidoParaNovoAnuncio, ETAPAS, ROTULOS_ETAPAS } from "../../src/modules/paiiaVoz/servicos/rascunhoRapido.js";
import { dadosCompletosVoz } from "../../src/modules/paiiaVoz/servicos/fichaCompletaVoz.js";
import * as C from "../../src/modules/paiiaVoz/servicos/completarVoz.js";

const ler = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const CONTAS = [{ id: "2412238242", nome: "REVELAÇÃO" }, { id: "1729335019", nome: "LOJA ONLINE" }, { id: "824312524", nome: "CIEBR" }];
const OPC = { fotos: 4, contas: CONTAS, agora: 5 };
const dizer = (f, t, o = {}) => C.responderCompletar(f, t, { ...OPC, ...o });
const campo = (f, fotos = 4) => C.proximaPerguntaCompletar(f, { fotos })?.campo || null;
const dados = (f, fotos = 4) => dadosCompletosVoz(f, { fotos });

/** Responde pelo roteiro (por pergunta) até parar; devolve { ficha, vistos }. */
function conversar(f, roteiro, { fotos = 4, ate = null, limite = 25 } = {}) {
  const vistos = [];
  for (let i = 0; i < limite; i++) {
    const p = C.proximaPerguntaCompletar(f, { fotos });
    if (!p || p.acao || p.campo === ate) { vistos.push(p?.campo || "fim"); break; }
    vistos.push(p.campo);
    const resp = roteiro[p.campo];
    assert.ok(resp !== undefined, `sem resposta para ${p.campo}`);
    f = C.responderCompletar(f, resp, { ...OPC, fotos }).ficha;
  }
  return { ficha: f, vistos };
}

/** Igual à ficha de teste: 4 fotos, código, título e “Master 3 2012 a 2026” dito na descrição. */
function fichaPresilha() {
  let f = criarFichaVoz({ agora: 1, id: "v-presilha" });
  f = aplicarInterpretacao(f, { itens: [{ campo: "codigoPrincipal", valor: "242101345R" }], naoEntendido: [], avisos: [] }, { origem: "digitado", agora: 1 }).ficha;
  f = definirTitulo(f, "Presilha Plástica Acabamento Lateral Master 3", { origem: "digitado", agora: 2 });
  f = definirTextoDescricao(f, "Master 3 2012 a 2026", { agora: 3 });
  incluirAplicacao(f, { texto: "Master 3 2012 a 2026", montadora: "", modelos: ["Master 3"], motores: [], anoInicio: 2012, anoFim: 2026, tipoVeiculo: "" }, { origem: "usuario", agora: 3 });
  return f;
}
const ROTEIRO = { marca: "Torken", preco: "39,90", quantidade: "10", peso: "200 gramas", medidas: "20 por 10 por 5", montadora: "Renault", confirmarAplicacao: "sim", aplicacaoDescricao: "sim", maisAplicacao: "não", tipoVeiculo: "carro", conta: "Loja Online", modalidade: "Premium" };

test("8 etapas (Rodada 1): Fotos, Código, Descrição/Título, Preço, Envio, Compat., Categoria, Finalizar", () => {
  assert.deepEqual(ETAPAS, ["fotos", "codigo", "descricao", "preco", "envio", "compat", "categoria", "finalizar"]);
  assert.equal(ROTULOS_ETAPAS.finalizar, "Finalizar");
  const f = ler("src/modules/paiiaVoz/PaiiaVozRapido.jsx");
  assert.ok(f.includes('onClick={() => irPara("codigo")} data-pr-continuar>Continuar →</button></div>'), "Continuar das fotos vai para o Código");
  assert.ok(!f.includes('rr.etapa === "fotos" && nav === "proximo" ? "enviar"'));
});

test("ficha nova só com fotos: pergunta na ordem do fluxo, uma por vez", () => {
  const r = conversar(criarFichaVoz({ agora: 1, id: "nova" }), {
    codigo: "dois quatro dois um zero um três quatro cinco erre", titulo: "Presilha Plástica Acabamento Lateral Master 3",
    descricao: "presilha do acabamento lateral, Renault Master 3 2012 a 2026", ...ROTEIRO,
  }, { fotos: 4 });
  assert.deepEqual(r.vistos, ["codigo", "titulo", "descricao", "marca", "preco", "quantidade", "peso", "medidas", "aplicacaoDescricao", "confirmarAplicacao", "maisAplicacao", "conta", "modalidade", "conferir"]);
  const d = dados(r.ficha);
  assert.equal(mapearRapidoParaNovoAnuncio(r.ficha).dados.codigo, "242101345R");
  assert.deepEqual([d.marca, d.preco, d.quantidade], ["Torken", "39,90", "10"]);
  assert.deepEqual(d.medida, { peso_g: 200, comprimento_cm: 20, largura_cm: 10, altura_cm: 5 });
  assert.deepEqual(d.aplicacoes.map((a) => [a.montadora, a.modelo, a.anoInicio, a.anoFim]), [["Renault", "Master 3", "2012", "2026"]]);
  assert.equal(d.completa, true, d.pendencias.join(" | "));
  assert.ok(!descricaoParaEnvio(r.ficha).includes("200 g"), "peso/medidas não vão no texto");
});

test("abertura e campos visíveis: mostra o que já tem, o que falta e qual está sendo perguntado", () => {
  const f = fichaPresilha();
  assert.equal(C.aberturaCompletar(f, { fotos: 4 }).texto, "Já tenho suas fotos, código e título. Qual é a marca da peça?");
  const cs = C.camposDaFicha(f, { fotos: 4 });
  assert.deepEqual(cs.map((c) => c.id), ["fotos", "codigo", "titulo", "descricao", "marca", "preco", "quantidade", "peso", "medidas", "aplicacoes", "tipo", "conta", "modalidade"]);
  assert.equal(cs.find((c) => c.atual).id, "marca");
  assert.equal(cs.find((c) => c.id === "codigo").valor, "242101345R");
  const g = dizer(f, "marca Torken, 10 peças, 39,90").ficha;
  const cs2 = C.camposDaFicha(g, { fotos: 4 });
  assert.deepEqual(["marca", "preco", "quantidade"].map((id) => cs2.find((c) => c.id === id).valor), ["Torken", "R$ 39,90", "10"]);
  assert.equal(cs2.find((c) => c.atual).id, "peso", "não repete o que já foi dito");
  const h = dizer(g, "não sei").ficha;
  assert.equal(C.camposDaFicha(h, { fotos: 4 }).find((c) => c.id === "peso").pendente, true);
});

test("várias respostas de uma vez e correções a qualquer momento", () => {
  let f = fichaPresilha();
  let r = dizer(f, "marca Torken, 10 peças, 39,90");
  f = r.ficha;
  assert.deepEqual([dados(f).marca, dados(f).quantidade, dados(f).preco], ["Torken", "10", "39,90"]);
  assert.equal(r.pergunta.campo, "peso");
  r = dizer(f, "na verdade o preço é 42");
  f = r.ficha;
  assert.equal(dados(f).preco, "42,00");
  assert.equal(r.pergunta.campo, "peso", "a correção não perde a pergunta");
  f = dizer(f, "pesa 150 gramas").ficha;
  f = dizer(f, "200 gramas e 20 por 10 por 5 centímetros").ficha;
  assert.deepEqual(dados(f).medida, { peso_g: 200, comprimento_cm: 20, largura_cm: 10, altura_cm: 5 });
  assert.ok(!dados(f).pendencias.some((p) => /dois pesos/.test(p)));
});

test("nada é inventado: “sim” não vira marca; aplicação só com sim; montadora perguntada", () => {
  let r = dizer(fichaPresilha(), "sim");
  assert.equal(dados(r.ficha).marca, "");
  assert.match(r.resposta, /^Não entendi/);
  let f = conversar(fichaPresilha(), ROTEIRO, { ate: "montadora" }).ficha;
  assert.equal(campo(f), "montadora");
  f = dizer(f, "Renault").ficha;
  assert.equal(campo(f), "confirmarAplicacao");
  assert.equal(dados(f).aplicacoes.length, 0, "ainda não confirmada");
  r = dizer(f, "não");
  assert.equal(dados(r.ficha).aplicacoes.length, 0);
  assert.equal(r.pergunta.campo, "aplicacao");
  r = dizer(r.ficha, "Renault Master 2013 a 2022");
  assert.equal(r.pergunta.campo, "confirmarAplicacao");
  r = dizer(r.ficha, "não, é Renault Master 2014 a 2022");
  assert.match(r.pergunta.texto, /Renault Master 2014 à 2022/);
  r = dizer(r.ficha, "sim");
  assert.deepEqual(dados(r.ficha).aplicacoes.map((a) => [a.montadora, a.modelo, a.anoInicio]), [["Renault", "Master", "2014"]]);
  r = dizer(r.ficha, "Kangoo 2010");
  assert.equal(r.pergunta.campo, "montadora", "veículo sem montadora: pergunta, não deduz");
});

test("aplicação escrita na descrição: oferecida sem o nome da peça; só entra com sim", () => {
  let f = criarFichaVoz({ agora: 1, id: "v-desc" });
  f = aplicarInterpretacao(f, { itens: [{ campo: "codigoPrincipal", valor: "242101345R" }], naoEntendido: [], avisos: [] }, { origem: "digitado", agora: 1 }).ficha;
  f = definirTitulo(f, "Presilha Plástica Acabamento Lateral Master 3", { origem: "digitado", agora: 2 });
  f = definirTextoDescricao(f, "Presilha Master 3 2012 a 2026", { agora: 3 });
  f = conversar(f, ROTEIRO, { ate: "aplicacaoDescricao" }).ficha;
  assert.match(C.proximaPerguntaCompletar(f, { fotos: 4 }).texto, /Na descrição tem “Master 3 2012 a 2026”/);
  let r = dizer(f, "sim");
  assert.equal(r.pergunta.campo, "montadora");
  r = dizer(r.ficha, "é Renault");
  assert.equal(r.pergunta.campo, "confirmarAplicacao");
  assert.equal(dados(r.ficha).aplicacoes.length, 0);
  r = dizer(r.ficha, "sim");
  assert.deepEqual(dados(r.ficha).aplicacoes.map((a) => [a.montadora, a.modelo, a.anoInicio, a.anoFim]), [["Renault", "Master 3", "2012", "2026"]]);
  assert.equal(dizer(f, "não").pergunta.campo, "aplicacao", "“não”: a linha não volta");
});

test("“não sei” registra pendência e segue, sem laço, em qualquer pergunta", () => {
  for (const t of ["não sei", "Não sei.", "sei lá", "não tenho", "não lembro", "deixa pendente", "depois eu vejo", "pular"]) {
    const r = dizer(fichaPresilha(), t);
    assert.ok(C.estadoCompletar(r.ficha).pulados.includes("marca"), t);
    assert.equal(r.pergunta.campo, "preco", t);
  }
  const r = conversar(fichaPresilha(), Object.fromEntries(["marca", "preco", "quantidade", "peso", "medidas", "montadora", "confirmarAplicacao", "aplicacaoDescricao", "aplicacao", "maisAplicacao", "tipoVeiculo", "conta", "modalidade"].map((k) => [k, "não sei"])));
  assert.deepEqual(r.vistos, ["marca", "preco", "quantidade", "peso", "medidas", "montadora", "tipoVeiculo", "conta", "modalidade", "fim"]);
  assert.match(C.fimCompletar(r.ficha, { fotos: 4 }).texto, /você deixou pendente: marca, preço, estoque, peso, medidas da embalagem, aplicações, tipo de veículo, conta, modalidade/);
});

test("peso e medidas: separados; parcial pergunta só o que falta; peso sem unidade não é chutado", () => {
  let f = conversar(fichaPresilha(), ROTEIRO, { ate: "peso" }).ficha;
  assert.match(dizer(f, "200").resposta, /^Não entendi/);
  let r = dizer(f, "200 gramas");
  assert.equal(r.pergunta.campo, "medidas");
  r = dizer(r.ficha, "comprimento 20 centímetros");
  assert.match(r.pergunta.texto, /Falta largura e altura/);
  r = dizer(r.ficha, "largura 10 cm e altura 5 cm");
  assert.deepEqual(dados(r.ficha).medida, { peso_g: 200, comprimento_cm: 20, largura_cm: 10, altura_cm: 5 });
  assert.notEqual(r.pergunta.campo, "medidas");
});

test("conferência: categoria só com sim; sem tipo pergunta de novo; mudou algo → confere de novo", () => {
  let f = conversar(fichaPresilha(), ROTEIRO).ficha;
  assert.equal(C.proximaPerguntaCompletar(f, { fotos: 4 }).acao, "conferir");
  f = C.registrarConferencia(f, { fotos: 4, revisao: { pendencias: [{ id: "categoria", tipo: "pergunta", texto: "Categoria…" }, { id: "fotos_tratadas", tipo: "aviso", texto: "x" }] }, sugerida: "MLB123 — Presilhas" });
  assert.equal(campo(f), "categoria");
  const r = dizer(f, "sim");
  assert.equal(r.acao, "confirmarCategoria");
  f = C.registrarConferencia(f, { fotos: 4, revisao: { pendencias: [] }, sugerida: "" });
  assert.equal(C.proximaPerguntaCompletar(f, { fotos: 4 }), null);
  assert.equal(C.fimCompletar(f, { fotos: 4 }).pronto, true);
  assert.equal(C.proximaPerguntaCompletar(dizer(f, "o preço é 45").ficha, { fotos: 4 }).acao, "conferir");
  // sem tipo de veículo: o ML não sugere categoria → pergunta o tipo de novo
  let g = conversar(fichaPresilha(), { ...ROTEIRO, montadora: "não", aplicacao: "sem aplicação", tipoVeiculo: "não sei" }).ficha;
  g = C.registrarConferencia(g, { fotos: 4, revisao: { pendencias: [{ id: "categoria", tipo: "pergunta", texto: "Categoria: diga o tipo de veículo (carro ou linha pesada)." }] }, sugerida: "" });
  assert.equal(campo(g), "tipoCategoria");
  const r2 = dizer(g, "linha pesada");
  assert.equal(dados(r2.ficha).tipoVeiculo, "Linha Pesada");
  assert.equal(r2.acao, "conferir");
});

test("modelo fora do catálogo do ML: pergunta o nome de lá; repetido não entra em laço", () => {
  let f = conversar(fichaPresilha(), ROTEIRO).ficha;
  f = C.registrarConferencia(f, { fotos: 4, revisao: { pendencias: [{ id: "compatibilidade", tipo: "pergunta", texto: "Compatibilidade: nenhum veículo do catálogo confirmou as aplicações (modelo Master 3 não encontrado no catálogo). Publicar sem compatibilidade?" }] }, sugerida: "" });
  assert.equal(campo(f), "compatModelo");
  let r = dizer(f, "Master");
  assert.match(r.pergunta.texto, /Renault Master 2012 à 2026/);
  r = dizer(r.ficha, "sim");
  assert.equal(dados(r.ficha).aplicacoes[0].modelo, "Master");
  assert.equal(C.proximaPerguntaCompletar(r.ficha, { fotos: 4 }).acao, "conferir");
  assert.ok(C.estadoCompletar(dizer(f, "Master 3").ficha).pulados.includes("compatModelo"));
});

test("código falado sem traço; digitado com traço preservado; sem fotos o fim avisa", () => {
  const vazia = criarFichaVoz({ agora: 1, id: "v0" });
  assert.match(dizer(vazia, "2421-01345 R", { origem: "voz", fotos: 0 }).resposta, /código 242101345R/);
  assert.match(dizer(vazia, "2421-01345R", { origem: "digitado", fotos: 0 }).resposta, /código 2421-01345R/);
  assert.match(C.fimCompletar(vazia, { fotos: 0 }).texto, /Fotos/);
});

test("tela: cartão com microfone, situação (falando/ouvindo/processando/preenchido/aguardando), campos visíveis e digitação", () => {
  const c = ler("src/modules/paiiaVoz/CompletarVoz.jsx");
  for (const t of ["data-pv-completar-mic", "data-pv-completar-situacao", "🔊 PAIIA falando", "🎤 Ouvindo", "⏳", "✅ Preenchido", "Aguardando sua resposta", "Voz indisponível neste aparelho: digite", "data-pv-completar-campos", "data-pv-completar-entrada", "speechSynthesis"]) assert.ok(c.includes(t), t);
  const f = ler("src/modules/paiiaVoz/PaiiaVozRapido.jsx");
  assert.ok(f.includes("vozConversaRef.current"), "microfone volta sozinho depois de cada pergunta");
  assert.ok(f.includes("data-pv-conversa-opcional"), "conversa só opcional");
  assert.ok(f.includes("Ignorei o que o microfone ouviu enquanto o PAIIA falava"));
  assert.ok(!/publicar\(|salvarFichaAprovada|aprovarRevisaoEGravar/.test(c), "a conversa não aprova nem publica");
});

test("microfone: “sim” e depois “sim” (duas perguntas) são duas respostas; repetição na MESMA escuta continua ignorada", async () => {
  const { criarReconhecedor } = await import("../../src/modules/paiiaVoz/servicos/reconhecimentoVoz.js");
  const fila = [];
  class Fake { start() { const f = fila.shift(); queueMicrotask(() => { for (const t of f) this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: t }], { isFinal: true })] }); this.onend?.(); }); } stop() {} }
  const recebidas = [];
  const rec = criarReconhecedor({ janela: { SpeechRecognition: Fake }, onFinal: (t) => recebidas.push(t), agora: () => 1000 });
  fila.push(["sim", "sim"]); rec.iniciar(); await new Promise((r) => setTimeout(r, 5));
  assert.deepEqual(recebidas, ["sim"], "o celular entregou duas vezes na mesma escuta");
  fila.push(["sim"]); rec.iniciar(); await new Promise((r) => setTimeout(r, 5));
  assert.deepEqual(recebidas, ["sim", "sim"], "nova pergunta, nova escuta");
});

// ---------------- (04/11) campos diretos: toque no campo e fale ----------------
test("campos diretos: marca, preço, estoque, peso (g) e medidas (cm) — e avança para o próximo vazio", () => {
  let f = criarFichaVoz({ agora: 1, id: "dd" });
  const passo = (c, t, o) => { const r = C.definirCampoDireto(f, c, t, o); assert.ok(r.ok, `${c}: ${r.erro}`); f = r.ficha; return r; };
  assert.equal(C.proximoCampoDireto(f), "marca");
  passo("marca", "Torken");
  assert.equal(C.proximoCampoDireto(f, "marca"), "preco");
  assert.equal(passo("preco", "39,90").valor, "39,90");
  passo("quantidade", "10 peças");
  assert.equal(passo("peso", "200").valor, "200", "campo em gramas");
  assert.equal(passo("comprimento", "20 por 10 por 5").tres, true, "uma frase preenche as 3 medidas");
  assert.equal(C.proximoCampoDireto(f, "comprimento"), "aplicacoes", "depois das medidas: aplicações (custo é opcional)");
  passo("altura", "6");
  { const v = C.valoresCamposDiretos(f); assert.deepEqual([v.marca, v.preco, v.quantidade, v.peso, v.comprimento, v.largura, v.altura], ["Torken", "39,90", "10", "200", "20", "10", "6"]); }
  assert.deepEqual(dados(f, 1).medida, { peso_g: 200, comprimento_cm: 20, largura_cm: 10, altura_cm: 6 });
  passo("peso", "1,2 quilo");
  assert.equal(C.valoresCamposDiretos(f).peso, "1200");
  assert.ok(!dados(f, 1).pendencias.some((p) => /dois pesos/.test(p)), "corrigir não cria dúvida");
  // nada inventado
  assert.equal(C.definirCampoDireto(f, "preco", "não sei").ok, false);
  assert.equal(C.definirCampoDireto(f, "quantidade", "muitas").ok, false);
  assert.equal(C.definirCampoDireto(f, "marca", "").ok, false);
});

test("tela: texto ditado aparece no próprio campo; campo ativo à vista; voz das perguntas opcional (desligada)", () => {
  const f = ler("src/modules/paiiaVoz/PaiiaVozRapido.jsx");
  assert.ok(f.includes("const mostrado = ditando ? ditando : focado ? texto : valor;"), "campo mostra o que está sendo ditado");
  assert.ok(f.includes('ditando={ouvindo && campoVoz !== "codigoAdicional" ? parcial || " " : ""} onSalvar'), "código");
  assert.ok(f.includes('ditando={ouvindo && !campoVoz ? parcial || " " : ""} acrescentar'), "descrição");
  assert.ok(f.includes('ditando={campoVoz === "titulo" && ouvindo ? parcial || " " : ""}'), "título");
  assert.ok(f.includes("data-pv-campo-mic") && f.includes("data-pv-dados-diretos"));
  assert.ok(f.includes('el.scrollIntoView?.({ block: "nearest" })') && f.includes("r.bottom > window.innerHeight"), "só rola se estiver fora da tela");
  assert.ok(f.includes("|${marcaCompletos(ficha)}|"), "custo/peso/medidas/aplicações salvam na conta");
  assert.ok(f.includes('localStorage.getItem("paiiaVozFalar") === "1"'), "perguntas faladas só se ligadas");
  assert.ok(!ler("src/modules/paiiaVoz/CompletarVoz.jsx").includes("scrollIntoView"), "o cartão não puxa a página");
});

test("campos diretos: custo opcional, aplicações ditas ficam SEM confirmação; Bling só preenche o que está vazio", () => {
  let f = criarFichaVoz({ agora: 1, id: "cb" });
  let r = C.definirCampoDireto(f, "custo", "18,50"); assert.ok(r.ok); f = r.ficha;
  assert.equal(C.valoresCamposDiretos(f).custo, "18,50");
  assert.equal(dados(f, 1).custo, "18,50");
  r = C.definirCampoDireto(f, "aplicacoes", "Gol 2010 a 2014"); assert.ok(r.ok, r.erro); f = r.ficha;
  assert.ok(/0 confirmada/.test(C.valoresCamposDiretos(f).aplicacoes), "aplicação dita não é confirmada sozinha");
  assert.equal(C.definirCampoDireto(f, "aplicacoes", "não sei").ok, false);
  r = C.definirCampoDireto(f, "marca", "Torken"); f = r.ficha;
  const b = C.usarDadosDoBling(f, { marca: "OUTRA", preco: 50, precoCusto: 20, peso_bruto: 0.3, profundidade: 12, largura: 8, altura: 4 });
  assert.equal(C.valoresCamposDiretos(b.ficha).marca, "Torken", "não sobrescreve a marca já dita");
  assert.equal(C.valoresCamposDiretos(b.ficha).custo, "18,50", "não sobrescreve o custo já dito");
  assert.equal(C.valoresCamposDiretos(b.ficha).peso, "300");
  assert.ok(b.usados.includes("preco") && !b.usados.includes("marca"));
});

test("tela: frete não estimado; envio mostra pendências e revisão; conversa só opcional", () => {
  const f = ler("src/modules/paiiaVoz/PaiiaVozRapido.jsx");
  assert.ok(f.includes("data-pv-frete-info") && f.includes("O PAIIA não estima frete"));
  assert.ok(f.includes("data-pv-pendencias-envio") && f.includes("data-pv-ficha-completa"));
  assert.ok(f.includes("data-pv-conversa-opcional") && f.includes("useState(false);\n  const conversaAbertaRef"), "conversa fechada por padrão");
  assert.ok(f.includes("data-pv-dados-bling"), "Bling só quando pedido");
});
