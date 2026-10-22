// =============================================================
// PAIIA Voz — TESTES (sem rede, sem banco, dados fictícios).
//   node --test scripts/testes/paiiaVoz.test.mjs
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

register("./simulacao/ganchoSupabaseFalso.mjs", import.meta.url);

const { lerPreco, lerInteiro, lerCodigoFalado, inteiroPorExtenso } = await import("../../src/modules/paiiaVoz/servicos/numerosFalados.js");
const { interpretarFala, interpretarAplicacao, pareceCodigo } = await import("../../src/modules/paiiaVoz/servicos/interpretarFala.js");
const F = await import("../../src/modules/paiiaVoz/servicos/fichaVoz.js");
const { consultarBaseVoz } = await import("../../src/modules/paiiaVoz/servicos/consultaBaseVoz.js");
const { criarReconhecedor, suportaReconhecimento } = await import("../../src/modules/paiiaVoz/servicos/reconhecimentoVoz.js");
const { candidatosDeCodigo } = await import("../../src/modules/paiiaVoz/servicos/codigoNaFoto.js");
const { pedirAcaoPaiiaVoz, consumirAcaoPaiiaVoz } = await import("../../src/modules/paiiaVoz/servicos/acaoInicial.js");

class Armazenamento {
  constructor() { this.m = new Map(); }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
  key(i) { return [...this.m.keys()][i] ?? null; }
  get length() { return this.m.size; }
}

const FRASE = "código 0280158276 descrição bico injetor marca Torken preço 65,91 quantidade 2 aplicação Nissan March 1.6 16V 2012 a 2019";

function fichaCom(...frases) {
  let f = F.criarFichaVoz({ agora: 1, id: "voz-teste" });
  for (const t of frases) f = F.aplicarInterpretacao(f, interpretarFala(t), { agora: 2, textoOriginal: t }).ficha;
  return f;
}

// ---------------------------------------------------------------
test("preço falado: formatos numéricos, por extenso e ambíguo", () => {
  assert.equal(lerPreco("65,91"), 65.91);
  assert.equal(lerPreco("R$ 65,91"), 65.91);
  assert.equal(lerPreco("1.234,50"), 1234.5);
  assert.equal(lerPreco("65.91"), 65.91);
  assert.equal(lerPreco("65 e 91"), 65.91);
  assert.equal(lerPreco("65 reais e 91 centavos"), 65.91);
  assert.equal(lerPreco("sessenta e cinco reais e noventa e um centavos"), 65.91);
  assert.equal(lerPreco("cem reais"), 100);
  assert.equal(lerPreco("sessenta e cinco e noventa e um"), null, "ambíguo não é adivinhado");
  assert.equal(lerPreco("barato"), null);
});

test("quantidade e números por extenso", () => {
  assert.equal(lerInteiro("2"), 2);
  assert.equal(lerInteiro("dez unidades"), 10);
  assert.equal(lerInteiro("duas peças"), 2);
  assert.equal(inteiroPorExtenso("mil duzentos e trinta e quatro"), 1234);
  assert.equal(lerInteiro("algumas"), null);
});

test("código soletrado vira texto e fica marcado para conferir", () => {
  const r = lerCodigoFalado("zero dois oito zero bê traço doze");
  assert.equal(r.codigo, "0280B-12");
  assert.equal(r.soletrado, true);
  assert.ok(r.duvidas.some((d) => d.includes("12")));
  assert.deepEqual(lerCodigoFalado("0280158276"), { codigo: "0280158276", soletrado: false, duvidas: [] });
  assert.equal(lerCodigoFalado("A R dois dois U").codigo, "AR22U");
});

test("frase completa vira os campos certos", () => {
  const r = interpretarFala(FRASE);
  const por = Object.fromEntries(r.itens.map((i) => [i.campo, i.valor]));
  assert.equal(por.codigo, "0280158276");
  assert.equal(por.descricao, "Bico injetor");
  assert.equal(por.marca, "Torken");
  assert.equal(por.preco, 65.91);
  assert.equal(por.quantidade, 2);
  assert.deepEqual(por.aplicacao.modelos, ["March"]);
  assert.deepEqual(por.aplicacao.motores, ["1.6 16V"]);
  assert.equal(por.aplicacao.montadora, "Nissan");
  assert.equal(por.aplicacao.anoInicio, 2012);
  assert.equal(por.aplicacao.anoFim, 2019);
  assert.deepEqual(r.naoEntendido, []);
});

test("código sem palavra-chave, outro código e texto não entendido", () => {
  assert.equal(interpretarFala("0280158276").itens[0].campo, "codigo");
  assert.equal(interpretarFala("outro código 16600-3AC0A").itens[0].campo, "codigoAdicional");
  assert.equal(interpretarFala("código principal 1660 03AC0A").itens[0].campo, "codigoPrincipal");
  const r = interpretarFala("bom dia tudo bem");
  assert.equal(r.itens.length, 0);
  assert.deepEqual(r.naoEntendido, ["bom dia tudo bem"]);
  assert.ok(interpretarFala("preço barato").avisos.length > 0);
  assert.ok(interpretarFala("marca").avisos[0].includes("Faltou"));
  assert.equal(pareceCodigo("bico injetor"), false);
});

test("aplicações: vários modelos, várias aplicações, anos e motor sem inventar", () => {
  const r = interpretarFala("aplicação Gol, Parati e Saveiro 1.6 8V 2008 a 2014; Fox 1.0 2010");
  const aps = r.itens.filter((i) => i.campo === "aplicacao").map((i) => i.valor);
  assert.equal(aps.length, 2);
  assert.deepEqual(aps[0].modelos, ["Gol", "Parati", "Saveiro"]);
  assert.deepEqual(aps[0].motores, ["1.6 8V"]);
  assert.deepEqual([aps[1].anoInicio, aps[1].anoFim], [2010, 2010]);
  const semAno = interpretarAplicacao("Kicks 1.6");
  assert.equal(semAno.anoInicio, null);
  assert.equal(semAno.anoFim, null);
  const invertido = interpretarAplicacao("Uno 2015 a 2010");
  assert.deepEqual([invertido.anoInicio, invertido.anoFim], [2010, 2015]);
});

// ---------------------------------------------------------------
test("ficha: códigos sem duplicar (escrita diferente) e um principal", () => {
  const f = fichaCom("código 0280158276", "código 0 280 158 276", "outro código 16600-3AC0A");
  assert.equal(f.codigos.length, 2);
  assert.equal(F.codigoPrincipal(f).codigo, "0280158276");
  const g = F.definirCodigoPrincipal(f, "166003AC0A");
  assert.equal(F.codigoPrincipal(g).codigo, "16600-3AC0A");
  assert.equal(g.codigos.filter((c) => c.principal).length, 1);
  const h = F.removerCodigo(g, "166003AC0A");
  assert.equal(F.codigoPrincipal(h).codigo, "0280158276", "removido o principal, o próximo assume");
});

test("ficha: campo conferido não é trocado por novo ditado; edição manual troca", () => {
  let f = fichaCom("preço 65,91");
  f = F.confirmarCampo(f, "preco", true);
  const r = F.aplicarInterpretacao(f, interpretarFala("preço 70"), { agora: 3 });
  assert.equal(r.ficha.campos.preco.valor, 65.91);
  assert.ok(r.avisos.some((a) => a.includes("já foi confirmado")));
  const g = F.editarCampo(r.ficha, "preco", 70, { agora: 4 });
  assert.equal(g.campos.preco.valor, 70);
  assert.equal(g.campos.preco.confirmado, false);
  assert.equal(g.campos.preco.anterior, 65.91);
});

test("ficha: aplicação informada não vai ao anúncio até ser confirmada", () => {
  let f = fichaCom(FRASE);
  assert.equal(f.aplicacoes.length, 1);
  assert.equal(f.aplicacoes[0].origem, "usuario");
  assert.equal(F.montarDescricao(f).includes("Compatível com os veículos"), false);
  assert.equal(F.montarTitulo(f).includes("March"), false);
  f = F.confirmarAplicacao(f, f.aplicacoes[0].id, true);
  assert.ok(F.montarDescricao(f).includes("March 1.6 16V 2012 à 2019"));
  assert.ok(F.montarTitulo(f).includes("March"));
});

test("título: padrão da loja, até 60, sem marca, montadora nem 'original'", () => {
  let f = fichaCom("código 0280158276 descrição Bico Injetor Original Bosch marca Bosch", "aplicação Nissan March 1.6 2012 a 2019", "aplicação Versa 1.6 2012 a 2019", "aplicação Kicks 1.6 2017 a 2020", "aplicação Sentra Tiida Livina 2.0 2010 a 2016");
  f.aplicacoes.forEach((a) => { f = F.confirmarAplicacao(f, a.id, true); });
  const t = F.montarTitulo(f);
  assert.ok(t.length <= 60, t);
  assert.ok(t.endsWith(" - 0280158276"), t);
  assert.ok(!/bosch|original|nissan/i.test(t), t);
  const d = F.montarDescricao(f);
  assert.ok(!/bosch|original|nissan/i.test(d), d);
  for (const secao of ["Compatível com os veículos:", "Especificações Técnicas:", "Condição do item: Produto novo", "Código de Referência:", "Garantia: 3 Meses", F.TEXTO_ATENCAO, F.TEXTO_IMPORTANTE]) {
    assert.ok(d.includes(secao), secao);
  }
});

test("aplicações: mesma aplicação da base e do usuário não duplica e guarda a fonte", async () => {
  let f = fichaCom("código 0280158276 aplicação March 1.6 2012 a 2019");
  const res = await consultarBaseVoz("0280158276", {
    buscarValidado: async () => [
      { modelo: "March", motor: "1.6", ano_inicio: 2012, ano_fim: 2019, montadora: "Nissan", peca: "Bico injetor", codigos_oem: ["16600-3AC0A"], codigos_equivalentes: [] },
      { modelo: "Versa", motor: "1.6", ano_inicio: 2012, ano_fim: 2019, montadora: "Nissan", peca: "Bico injetor", codigos_oem: [], codigos_equivalentes: [] },
    ],
  });
  const r = F.incorporarResultadoBase(f, res);
  assert.equal(r.ficha.aplicacoes.length, 2);
  const march = r.ficha.aplicacoes.find((a) => a.modelos[0] === "March");
  assert.equal(march.origem, "base_validada");
  assert.deepEqual(march.fontes, ["Base validada PAIIA"], "sem fonte na linha, vale o nome da base");
  assert.equal(march.confirmada, false, "da base também precisa do aceite do usuário");
  assert.ok(r.ficha.codigos.some((c) => c.codigo === "16600-3AC0A"));
  assert.equal(r.ficha.campos.descricao.valor, "Bico injetor");
});

test("consulta: base validada primeiro, catálogo depois, nada inventado", async () => {
  const chamadas = [];
  const base = await consultarBaseVoz("0280158276", {
    buscarValidado: async () => { chamadas.push("validado"); return []; },
    pesquisarCatalogo: async ({ termo }) => {
      chamadas.push(`catalogo:${termo}`);
      return [
        { modelo: "Gol", motor: "1.0", ano_inicio: 2010, ano_fim: 2014, peca: "Sensor", arquivo: "Bosch 2020", pagina: 12, equivalencias: "123-ABC, 0280158276" },
        { modelo: "", motor: "1.6", peca: "Sensor" },
      ];
    },
  });
  assert.deepEqual(chamadas, ["validado", "catalogo:0280158276"]);
  assert.equal(base.origem, "catalogo");
  assert.equal(base.aplicacoes.length, 1, "linha sem modelo é descartada");
  assert.ok(base.aplicacoes[0].fonte.includes("pág. 12"));
  assert.deepEqual(base.codigos, ["123-ABC"], "o próprio código não volta como referência");
  const nada = await consultarBaseVoz("999", { buscarValidado: async () => [], pesquisarCatalogo: async () => [] });
  assert.equal(nada.encontrado, false);
  assert.equal(nada.aplicacoes.length, 0);
  const falha = await consultarBaseVoz("999", { buscarValidado: async () => { throw new Error("offline"); }, pesquisarCatalogo: async () => [] });
  assert.equal(falha.encontrado, false);
  assert.ok(falha.erro.includes("offline"));
  assert.equal((await consultarBaseVoz("", {})).erro.startsWith("Informe"), true);
});

test("envio: validação e mapeamento para o Novo Anúncio", () => {
  const vazio = F.validarParaEnvio(F.criarFichaVoz());
  assert.equal(vazio.pronto, false);
  assert.deepEqual(vazio.faltando, ["código da peça", "descrição (nome da peça)", "preço de venda"]);
  let f = fichaCom(FRASE, "outro código 16600-3AC0A", "custo 30");
  const v = F.validarParaEnvio(f);
  assert.equal(v.pronto, true);
  assert.ok(v.avisos.some((a) => a.includes("Nenhuma aplicação confirmada")));
  const { dados, complemento } = F.mapearParaNovoAnuncio(f, { agora: 10 });
  assert.equal(dados.codigo, "0280158276");
  assert.equal(dados.oem, "16600-3AC0A");
  assert.equal(dados.preco, "65,91");
  assert.equal(dados.custo, "30,00");
  assert.equal(dados.origemPaiiaVoz, "voz-teste");
  assert.ok(dados.titulo && dados.descricao);
  assert.deepEqual(complemento, { fichaVozId: "voz-teste", codigoNormalizado: "0280158276", marca: "Torken", quantidadeEstoque: "2", em: 10 });
});

test("envio: código ditado e não conferido fica fora das referências e gera aviso", () => {
  const f = fichaCom("código 0280158276 descrição sensor preço 10", "outro código a bê um dois três");
  const ref = f.codigos.find((c) => !c.principal);
  assert.equal(ref.conferido, false);
  assert.ok(F.validarParaEnvio(f).avisos.some((a) => a.includes("não foi conferido")));
  assert.equal(F.mapearParaNovoAnuncio(f).dados.oem, "");
  const g = F.conferirCodigo(f, ref.normalizado, true);
  assert.equal(F.mapearParaNovoAnuncio(g).dados.oem, ref.codigo);
});

test("complemento da Conferência: só o mesmo código e por 48 h", () => {
  const s = new Armazenamento();
  s.setItem(F.CHAVE_COMPLEMENTO_VOZ, JSON.stringify({ codigoNormalizado: "0280158276", marca: "Torken", quantidadeEstoque: "2", em: 1000 }));
  assert.deepEqual(F.complementoParaConferencia(s, "0 280 158 276", { agora: 2000 }), { marca: "Torken", quantidadeEstoque: "2" });
  assert.deepEqual(F.complementoParaConferencia(s, "999", { agora: 2000 }), { marca: "", quantidadeEstoque: "" });
  assert.deepEqual(F.complementoParaConferencia(s, "0280158276", { agora: 1000 + F.VALIDADE_COMPLEMENTO_MS + 1 }), { marca: "", quantidadeEstoque: "" });
  s.setItem(F.CHAVE_COMPLEMENTO_VOZ, "{quebrado");
  assert.deepEqual(F.complementoParaConferencia(s, "0280158276"), { marca: "", quantidadeEstoque: "" });
});

test("ficha guardada no aparelho: ida e volta, e dado corrompido é ignorado", () => {
  const s = new Armazenamento();
  const f = fichaCom(FRASE);
  assert.equal(F.guardarFichaVoz(f, s), true);
  assert.deepEqual(F.lerFichaVoz(s), JSON.parse(JSON.stringify(f)));
  s.setItem(F.CHAVE_FICHA_VOZ, "{x");
  assert.equal(F.lerFichaVoz(s), null);
  s.setItem(F.CHAVE_FICHA_VOZ, JSON.stringify({ campos: {} }));
  assert.equal(F.lerFichaVoz(s), null);
  F.descartarFichaVoz(s);
  assert.equal(s.getItem(F.CHAVE_FICHA_VOZ), null);
  assert.equal(F.fichaVazia(F.criarFichaVoz()), true);
});

test("histórico guarda só texto (sem áudio) e é limitado", () => {
  let f = F.criarFichaVoz();
  for (let i = 0; i < 80; i++) f = F.aplicarInterpretacao(f, interpretarFala(`quantidade ${i}`), { agora: i, textoOriginal: `quantidade ${i}` }).ficha;
  assert.equal(f.historico.length, 60);
  assert.equal(typeof f.historico[0].texto, "string");
  assert.ok(!JSON.stringify(f).includes("audio"));
});

// ---------------------------------------------------------------
test("reconhecimento de voz: sem suporte → null; com suporte → parcial, final e erro", () => {
  assert.equal(suportaReconhecimento({}), false);
  assert.equal(criarReconhecedor({ janela: {} }), null);
  let instancia = null;
  class FalsoSR {
    constructor() { instancia = this; }
    start() { this.iniciado = true; }
    stop() { this.onend?.(); }
  }
  const eventos = [];
  const rec = criarReconhecedor({
    janela: { webkitSpeechRecognition: FalsoSR },
    onParcial: (t) => eventos.push(["parcial", t]),
    onFinal: (t) => eventos.push(["final", t]),
    onErro: (m) => eventos.push(["erro", m]),
    onEstado: (v) => eventos.push(["estado", v]),
  });
  rec.iniciar();
  assert.equal(instancia.lang, "pt-BR");
  assert.equal(rec.ouvindo, true);
  instancia.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: "código zero" }], { isFinal: false })] });
  instancia.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: "código 0280158276" }], { isFinal: true })] });
  instancia.onerror({ error: "not-allowed" });
  rec.parar();
  assert.deepEqual(eventos.filter((e) => e[0] !== "estado").map((e) => e[0]), ["parcial", "final", "erro"]);
  assert.equal(eventos.find((e) => e[0] === "final")[1], "código 0280158276");
  assert.ok(eventos.find((e) => e[0] === "erro")[1].includes("microfone"));
  assert.equal(rec.ouvindo, false);
});

test("foto: candidatos a código sem datas, anos ou palavras", () => {
  const texto = "BOSCH 0 280 158 276\nMADE IN BRAZIL 12/05/2021 2021\nREF: 0280158276 | 16600-3AC0A lote AB";
  const c = candidatosDeCodigo(texto);
  assert.ok(c.includes("0280158276"));
  assert.ok(c.includes("16600-3AC0A"));
  assert.ok(!c.some((x) => /2021|BOSCH|BRAZIL/.test(x)));
});

test("ação da página inicial é lida uma única vez e expira", () => {
  const s = new Armazenamento();
  pedirAcaoPaiiaVoz("microfone", s);
  assert.equal(consumirAcaoPaiiaVoz(s), "microfone");
  assert.equal(consumirAcaoPaiiaVoz(s), "");
  pedirAcaoPaiiaVoz("invalida", s);
  assert.equal(consumirAcaoPaiiaVoz(s), "");
  pedirAcaoPaiiaVoz("foto", s);
  assert.equal(consumirAcaoPaiiaVoz(s, Date.now() + 200000), "");
});

// ---------------------------------------------------------------
// Integração com a abertura do Novo Anúncio (sem React, sem rede)
// ---------------------------------------------------------------
test("envio usa a abertura oficial: dados chegam ao anúncio NOVO e o complemento some ao abrir outra ficha", async () => {
  globalThis.localStorage = new Armazenamento();
  globalThis.window = { location: { href: "https://www.paiia.com.br/" }, history: { state: null, replaceState() {} } };
  const ab = await import("../../src/services/aberturaNovoAnuncio.js");
  const f = fichaCom(FRASE);
  const { dados, complemento } = F.mapearParaNovoAnuncio(f);
  ab.iniciarAnuncioNovo({ dados });
  localStorage.setItem(F.CHAVE_COMPLEMENTO_VOZ, JSON.stringify(complemento));
  const decisao = ab.decidirAberturaNovoAnuncio({ storage: localStorage, href: "https://www.paiia.com.br/?tela=novoAnuncio" });
  assert.equal(decisao.modo, "novo");
  assert.equal(decisao.dados.codigo, "0280158276");
  assert.equal(decisao.dados.preco, "65,91");
  assert.ok(decisao.dados.descricao.includes("Garantia: 3 Meses"));
  assert.deepEqual(F.complementoParaConferencia(localStorage, "0280158276"), { marca: "Torken", quantidadeEstoque: "2" });
  assert.ok(ab.CHAVES_DE_UM_ANUNCIO.includes(F.CHAVE_COMPLEMENTO_VOZ));
  ab.limparChavesDeOutroAnuncio("", localStorage);
  assert.equal(localStorage.getItem(F.CHAVE_COMPLEMENTO_VOZ), null, "outro anúncio não herda marca/quantidade");
});
