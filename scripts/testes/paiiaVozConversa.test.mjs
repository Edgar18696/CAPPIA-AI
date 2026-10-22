// =============================================================
// PAIIA Voz — CONVERSA NATURAL (sem rede, sem banco, dados fictícios).
//   node --test scripts/testes/paiiaVozConversa.test.mjs
// Inclui o diálogo real do teste no Samsung (lanterna de ônibus Neobus).
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

register("./simulacao/ganchoSupabaseFalso.mjs", import.meta.url);

const C = await import("../../src/modules/paiiaVoz/servicos/conversaVoz.js");
const F = await import("../../src/modules/paiiaVoz/servicos/fichaVoz.js");
const { pareceCodigo, pareceAno } = await import("../../src/modules/paiiaVoz/servicos/interpretarFala.js");

function dialogo(falas) {
  let f = F.criarFichaVoz({ id: "voz-teste", agora: 1 });
  const respostas = [];
  for (const t of falas) {
    const r = C.conversar(f, t, { agora: 2 });
    f = r.ficha;
    respostas.push(r.texto);
  }
  return { f, respostas };
}
const atr = (f) => Object.fromEntries(Object.entries(f.atributos || {}).map(([k, v]) => [k, v.valor]));

// ---------------------------------------------------------------
test("diálogo do Samsung: lanterna dianteira de ônibus Neobus Mega Plus", () => {
  const { f, respostas } = dialogo([
    "Tenho uma lanterna dianteira de ônibus Neobus Mega Plus",
    "2013 e 2014",
    "Esquerdo, cristal, LED, 12 e 24 volts",
  ]);
  assert.match(respostas[0], /^Entendi\. Vamos montar a ficha dessa lanterna dianteira\./);
  assert.match(respostas[0], /Você sabe o ano do ônibus\?$/);
  assert.match(respostas[1], /^Anotei os anos informados: 2013 e 2014\./);
  assert.match(respostas[1], /A lanterna dianteira é de qual lado\?$/);
  assert.match(respostas[2], /^Anotei: lado esquerdo, lente cristal, tecnologia LED e tensão 12V\/24V\./);
  assert.equal(f.campos.descricao.valor, "Lanterna dianteira");
  assert.deepEqual(atr(f), { posicao: "dianteira", lado: "esquerdo", lente: "cristal", tecnologia: "LED", tensao: "12V/24V" });
  assert.equal(f.codigos.length, 0, "ano NÃO virou código");
  assert.equal(f.aplicacoes.length, 1);
  const ap = f.aplicacoes[0];
  assert.deepEqual([ap.tipoVeiculo, ap.montadora, ap.modelos, ap.anoInicio, ap.anoFim], ["Ônibus", "Neobus", ["Mega Plus"], 2013, 2014]);
  assert.equal(ap.origem, "usuario");
  assert.equal(ap.confirmada, false, "aplicação dita fica para conferência");
  assert.ok(respesNaoTemNaoEntendi(respostas));
});

function respesNaoTemNaoEntendi(rs) {
  return rs.every((r) => !/Não entendi|Comece com a palavra|Não consegui encaixar/.test(r));
}

test("diálogo do Samsung, na ordem em que foi falado de verdade", () => {
  const { f, respostas } = dialogo(["Ônibus Neobus Mega Plus", "Ano 2013/2014", "Lanterna dianteira cristal LED", "Lado esquerdo", "12 e 24 volts"]);
  assert.ok(respesNaoTemNaoEntendi(respostas), respostas.join(" | "));
  assert.match(respostas[0], /Anotei o veículo: ônibus Neobus Mega Plus/);
  assert.match(respostas[0], /Qual é a peça\?/);
  assert.match(respostas[1], /Anotei os anos informados: 2013 e 2014/);
  assert.equal(f.codigos.length, 0, "2013/2014 não é código, nem 12 e 24 volts");
  assert.equal(f.aplicacoes[0].anoInicio, 2013);
  assert.equal(f.aplicacoes[0].anoFim, 2014);
  assert.equal(atr(f).tensao, "12V/24V");
  assert.equal(atr(f).lado, "esquerdo");
});

test("título e descrição: detalhes da peça, sem montadora, só aplicação conferida, até 60", () => {
  const { f } = dialogo(["Tenho uma lanterna dianteira de ônibus Neobus Mega Plus", "2013 e 2014", "Esquerdo, cristal, LED, 12 e 24 volts", "código ABC123"]);
  assert.equal(F.montarTitulo(f), "Lanterna dianteira esquerda cristal LED 12V/24V - ABC123", "sem aplicação conferida, sem modelo");
  const conferida = F.confirmarAplicacao(f, f.aplicacoes[0].id, true);
  const t = F.montarTitulo(conferida);
  assert.ok(t.length <= 60, t);
  assert.ok(t.endsWith("- ABC123"));
  assert.ok(/Mega Plus/.test(t) && /esquerda/.test(t), t);
  assert.ok(!/neobus|torken|original/i.test(t), t);
  const d = F.montarDescricao(conferida);
  assert.equal(d.split("\n")[0], "Lanterna dianteira esquerda cristal LED 12V/24V");
  assert.ok(d.includes("Compatível com os veículos:\nMega Plus 2013 à 2014"));
  assert.ok(d.includes("Especificações Técnicas:\nCondição do item: Produto novo\n"), "especificações só com Produto novo");
  assert.ok(!/neobus/i.test(d));
});

test("título longo: sai primeiro tensão, lente e tecnologia; nunca passa de 60", () => {
  let f = F.criarFichaVoz({ id: "t" });
  f = C.conversar(f, "lanterna traseira lado esquerdo cristal LED 12 e 24 volts ônibus Marcopolo Paradiso G7 1200 2013 a 2019 código 9876543210ABC").ficha;
  f = F.confirmarAplicacao(f, f.aplicacoes[0].id, true);
  const t = F.montarTitulo(f);
  assert.ok(t.length <= 60, `${t} (${t.length})`);
  assert.ok(t.startsWith("Lanterna traseira esquerda"), t);
  assert.ok(t.endsWith("- 9876543210ABC"), t);
});

test("anos nunca viram código; código continua funcionando", () => {
  for (const t of ["2013/2014", "2013 e 2014", "ano 2014", "2013-2014", "2014"]) {
    assert.equal(pareceAno(t), true, t);
    assert.equal(pareceCodigo(t), false, t);
  }
  assert.equal(pareceCodigo("12 e 24 volts"), false);
  assert.equal(pareceCodigo("Nissan March 1.6 16V"), false);
  for (const t of ["0280158276", "16600-3AC0A", "1660 03AC0A", "F 000 99"]) assert.equal(pareceCodigo(t), true, t);
  const { f } = dialogo(["0280158276"]);
  assert.equal(F.codigoPrincipal(f).codigo, "0280158276", "código sem palavra-chave ainda vale");
  const g = dialogo(["código 2014"]).f;
  assert.equal(F.codigoPrincipal(g).codigo, "2014", "com a palavra 'código' até 2014 é código");
});

test("contexto da pergunta: anos curtos, modelo, código, preço, quantidade e 'não sei'", () => {
  const { f, respostas } = dialogo([
    "lanterna traseira",          // → pergunta o veículo
    "ônibus Neobus",              // → pergunta o modelo
    "Mega Plus",                  // → pergunta o ano
    "13/14",                      // ano curto aceito porque foi perguntado
    "não sei",                    // pula o lado
    "sem detalhes",               // pula os detalhes
    "0280 158 276",               // resposta à pergunta do código
    "65 e 91",                    // resposta à pergunta do preço
    "duas",                       // resposta à pergunta da quantidade
  ]);
  assert.match(respostas[0], /Para qual veículo é essa lanterna traseira\?/);
  assert.match(respostas[1], /Qual é o modelo do ônibus Neobus\?/);
  assert.match(respostas[2], /Você sabe o ano do ônibus\?/);
  assert.match(respostas[3], /Anotei os anos informados: 2013 e 2014/);
  assert.match(respostas[4], /seguimos sem essa informação/);
  assert.match(respostas[6], /Código 0280158276/);
  assert.equal(f.campos.preco.valor, 65.91);
  assert.equal(f.campos.quantidade.valor, 2);
  assert.match(respostas[8], /ficha básica está completa/);
  assert.equal(f.atributos.lado, undefined, "lado pulado não foi inventado");
  assert.equal(f.conversa.pendente, null);
});

test("'12 e 24 volts' na hora do código é detalhe, não código", () => {
  const { f, respostas } = dialogo(["lanterna dianteira lado esquerdo cristal", "ônibus Neobus Mega Plus 2013", "12 e 24 volts"]);
  assert.equal(f.codigos.length, 0);
  assert.equal(atr(f).tensao, "12V/24V");
  assert.match(respostas[2], /tensão 12V\/24V/);
});

test("outros veículos: caminhão, carro com motor, ônibus com chassi", () => {
  const a = dialogo(["caminhão Scania R440 2015 a 2018, retrovisor esquerdo"]).f;
  assert.equal(a.campos.descricao.valor, "Retrovisor");
  assert.deepEqual([a.aplicacoes[0].tipoVeiculo, a.aplicacoes[0].montadora, a.aplicacoes[0].modelos[0], a.aplicacoes[0].anoInicio, a.aplicacoes[0].anoFim], ["Caminhão", "Scania", "R440", 2015, 2018]);
  assert.equal(atr(a).lado, "esquerdo");
  const b = dialogo(["bico injetor", "Nissan March 1.6 16V", "2012 a 2019"]).f;
  assert.deepEqual([b.aplicacoes[0].montadora, b.aplicacoes[0].modelos, b.aplicacoes[0].motores, b.aplicacoes[0].anoInicio], ["Nissan", ["March"], ["1.6 16V"], 2012]);
  assert.equal(b.codigos.length, 0, "motor 1.6 16V não é código");
  const c = dialogo(["farol direito Volvo B270F 2010"]).f;
  assert.equal(c.campos.descricao.valor, "Farol");
  assert.equal(c.aplicacoes[0].modelos[0], "B270F");
});

test("palavras-chave antigas continuam valendo e a conversa responde", () => {
  const { f, respostas } = dialogo(["código 0280158276 descrição bico injetor marca Torken preço 65,91 quantidade 2 aplicação Nissan March 1.6 16V 2012 a 2019"]);
  assert.equal(F.codigoPrincipal(f).codigo, "0280158276");
  assert.equal(f.campos.descricao.valor, "Bico injetor");
  assert.equal(f.campos.marca.valor, "Torken");
  assert.equal(f.campos.preco.valor, 65.91);
  assert.equal(f.campos.quantidade.valor, 2);
  assert.deepEqual(f.aplicacoes[0].modelos, ["March"]);
  assert.match(respostas[0], /Vamos montar a ficha desse bico injetor/);
  assert.match(respostas[0], /ficha básica está completa/);
});

test("cumprimento e frase sem sentido: pergunta de volta, não inventa", () => {
  const r1 = dialogo(["bom dia, tudo bem?"]);
  assert.match(r1.respostas[0], /^Olá!/);
  assert.match(r1.respostas[0], /Qual é a peça\?/);
  assert.ok(F.fichaVazia(r1.f));
  const r2 = dialogo(["abacaxi azul"]);
  assert.match(r2.respostas[0], /Não consegui encaixar “abacaxi azul”/);
  assert.equal(r2.f.aplicacoes.length, 0);
  assert.ok(F.fichaVazia(r2.f));
  // Como resposta à pergunta do veículo, o que foi dito é anotado como "informado"
  // e NÃO entra no anúncio até você conferir.
  const r3 = dialogo(["lanterna dianteira", "Mega Plus"]);
  assert.equal(r3.f.aplicacoes[0].modelos[0], "Mega Plus");
  assert.equal(r3.f.aplicacoes[0].confirmada, false);
  assert.ok(!/Mega Plus/.test(F.montarTitulo(r3.f)));
});

test("conversa sobrevive ao F5: a pergunta pendente fica guardada na ficha", () => {
  const { f } = dialogo(["Tenho uma lanterna dianteira de ônibus Neobus Mega Plus"]);
  assert.equal(f.conversa.pendente, "anos");
  const armazenamento = { m: new Map(), getItem(k) { return this.m.get(k) ?? null; }, setItem(k, v) { this.m.set(k, v); }, removeItem(k) { this.m.delete(k); } };
  F.guardarFichaVoz(f, armazenamento);
  const lida = F.lerFichaVoz(armazenamento);
  const r = C.conversar(lida, "13/14");
  assert.equal(r.ficha.aplicacoes[0].anoInicio, 2013);
  assert.equal(r.ficha.codigos.length, 0);
});

test("ficha antiga (sem conversa/atributos) continua funcionando", () => {
  const antiga = F.criarFichaVoz({ id: "x" });
  delete antiga.conversa;
  delete antiga.atributos;
  delete antiga.peca;
  const r = C.conversar(antiga, "lanterna traseira esquerda");
  assert.equal(r.ficha.campos.descricao.valor, "Lanterna traseira");
  assert.equal(r.ficha.atributos.lado.valor, "esquerdo");
});

test("aplicação já conferida não muda com anos novos ditos", () => {
  let { f } = dialogo(["lanterna dianteira de ônibus Neobus Mega Plus", "2013 e 2014"]);
  f = F.confirmarAplicacao(f, f.aplicacoes[0].id, true);
  const r = C.conversar(f, "2015");
  assert.equal(r.ficha.aplicacoes[0].anoInicio, 2013);
  assert.ok(r.avisos.some((a) => /já foi conferida/.test(a)));
});
