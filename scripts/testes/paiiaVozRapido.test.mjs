// =============================================================
// PAIIA Voz — ANÚNCIO RÁPIDO (sem rede, sem banco, dados fictícios).
//   node --test scripts/testes/paiiaVozRapido.test.mjs
// Fotos (até 5, trocar/excluir, fundo branco local), código, título,
// descrição organizada e envio ao Novo Anúncio.
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

register("./simulacao/ganchoSupabaseFalso.mjs", import.meta.url);

const R = await import("../../src/modules/paiiaVoz/servicos/rascunhoRapido.js");
const F = await import("../../src/modules/paiiaVoz/servicos/fichaVoz.js");
const E = await import("../../src/modules/paiiaVoz/servicos/edicaoPorVoz.js");
const B = await import("../../src/modules/paiiaVoz/servicos/fundoBranco.js");
const G = await import("../../src/modules/paiiaVoz/servicos/fotosVozLocal.js");

const nova = () => F.criarFichaVoz({ id: "rap", agora: 1 });
const comCodigo = (f, c) => F.aplicarInterpretacao(f, { itens: [{ campo: "codigoPrincipal", valor: c }], naoEntendido: [], avisos: [] }).ficha;

// ---------------------------------------------------------------
// Fotos
// ---------------------------------------------------------------
const img = (nome, tipo = "image/jpeg") => Object.assign(new Blob([new Uint8Array(8)], { type: tipo }), { name: nome });

test("fotos: até 5, trocar mantendo a posição, excluir e acrescentar", async () => {
  assert.equal(G.MAX_FOTOS_POR_FICHA, 5);
  const g = G.criarGuardaFotos({ armazenamento: G.armazenamentoMemoria(), agora: () => 1 });
  const r = await g.adicionar("F", ["a", "b", "c", "d", "e", "f"].map((x) => img(`${x}.jpg`)));
  assert.equal(r.guardadas.length, 5);
  assert.equal(r.recusadas.length, 1);
  const lista = await g.listar("F");
  await g.substituir(lista[1].id, img("b2.png", "image/png"));
  const depois = await g.listar("F");
  assert.deepEqual(depois.map((x) => x.nome), ["a.jpg", "b2.png", "c.jpg", "d.jpg", "e.jpg"], "trocada no mesmo lugar");
  await g.remover(depois[4].id);
  assert.equal((await g.adicionar("F", [img("g.jpg")])).guardadas.length, 1, "depois de excluir, cabe outra");
  await assert.rejects(() => g.substituir(depois[0].id, new Blob(["x"], { type: "text/plain" })), /não é imagem/);
});

test("fotos: original sempre guardada; versão tratada só se escolhida", async () => {
  const g = G.criarGuardaFotos({ armazenamento: G.armazenamentoMemoria(), agora: () => 1 });
  const { guardadas: [reg] } = await g.adicionar("F", [img("peca.jpg")]);
  const tratadaBlob = new Blob([new Uint8Array(4)], { type: "image/jpeg" });
  await g.salvarTratada(reg.id, { blob: tratadaBlob, fundo: 0.6 });
  let atual = (await g.listar("F"))[0];
  assert.equal(atual.blob.size, 8, "original intacta");
  assert.equal(g.arquivoEscolhido(atual).size, 8, "sem escolha → original");
  await g.escolherVersao(reg.id, "tratada");
  atual = (await g.listar("F"))[0];
  const arq = g.arquivoEscolhido(atual);
  assert.equal(arq.size, 4);
  assert.equal(arq.name, "peca-fundo-branco.jpg", "extensão segue o tipo da imagem tratada (jpeg)");
  // tratamento não aplicável: não dá para escolher a tratada
  const { guardadas: [r2] } = await g.adicionar("F", [img("outra.jpg")]);
  await g.salvarTratada(r2.id, { blob: null, motivo: "fundo não é liso" });
  await g.escolherVersao(r2.id, "tratada");
  assert.equal((await g.listar("F"))[1].versao, "original");
  // trocar a foto descarta a tratada antiga
  await g.substituir(reg.id, img("nova.jpg"));
  const trocada = (await g.listar("F"))[0];
  assert.equal(trocada.tratada, null);
  assert.equal(trocada.versao, "original");
});

// ---------------------------------------------------------------
// Fundo branco (imagem sintética)
// ---------------------------------------------------------------
function imagemSintetica({ w = 60, h = 40, fundo = [180, 175, 170], peca = [40, 40, 45], ruido = 6, buraco = false } = {}) {
  const data = new Uint8ClampedArray(w * h * 4);
  let s = 7;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return (s % (2 * ruido + 1)) - ruido; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const dentro = x >= 20 && x < 40 && y >= 10 && y < 30;
    const furo = buraco && x >= 27 && x < 33 && y >= 17 && y < 23; // "furo" da peça com a cor do fundo
    const c = dentro && !furo ? peca : fundo;
    data[i] = c[0] + rnd(); data[i + 1] = c[1] + rnd(); data[i + 2] = c[2] + rnd(); data[i + 3] = 255;
  }
  return { width: w, height: h, data };
}
const px = (im, x, y) => Array.from(im.data.slice((y * im.width + x) * 4, (y * im.width + x) * 4 + 3));

test("fundo branco: pinta só o fundo ligado à borda; a peça não muda", () => {
  const im = imagemSintetica({ buraco: true });
  const r = B.fundoBranco(im);
  assert.equal(r.aplicavel, true);
  assert.deepEqual(px(r.imagem, 2, 2), [255, 255, 255]);
  assert.deepEqual(px(r.imagem, 55, 35), [255, 255, 255]);
  assert.deepEqual(px(r.imagem, 25, 15), px(im, 25, 15), "miolo da peça intacto");
  assert.deepEqual(px(r.imagem, 30, 20), px(im, 30, 20), "furo dentro da peça NÃO vira branco (não está ligado à borda)");
  assert.ok(r.fundo > 0.6 && r.fundo < 0.9);
  assert.deepEqual(Array.from(im.data.slice(0, 3)).every((v) => v < 200), true, "a imagem original não foi alterada");
});

test("fundo branco: recusa fundo bagunçado e foto sem fundo", () => {
  const w = 40;
  const h = 30;
  const listrado = { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const v = (x + y) % 2 ? 230 : 20;
    listrado.data.set([v, (v * 3) % 255, 255 - v, 255], i);
  }
  assert.equal(B.fundoBranco(listrado).aplicavel, false);
  const tudoPeca = imagemSintetica({ fundo: [40, 40, 45] });
  assert.equal(B.fundoBranco(tudoPeca).aplicavel, false);
  assert.equal(B.fundoBranco({ width: 0, height: 0, data: new Uint8ClampedArray(0) }).aplicavel, false);
});

// ---------------------------------------------------------------
// Código
// ---------------------------------------------------------------
test("código: falado, digitado, soletrado, sem código; ano não é código", () => {
  assert.deepEqual(R.lerCodigoDaFala("0280158276").codigo, "0280158276");
  assert.equal(R.lerCodigoDaFala("o código é 16600-3AC0A").codigo, "16600-3AC0A");
  const sol = R.lerCodigoDaFala("zero dois oito zero um cinco oito dois sete seis");
  assert.equal(sol.codigo, "0280158276");
  assert.equal(sol.soletrado, true);
  assert.equal(R.lerCodigoDaFala("sem código").pular, true);
  assert.equal(R.lerCodigoDaFala("não tem").pular, true);
  assert.match(R.lerCodigoDaFala("2013/2014").erro, /parece ano/);
  assert.match(R.lerCodigoDaFala("bico injetor").erro, /Não entendi/);
});

// ---------------------------------------------------------------
// Título
// ---------------------------------------------------------------
test("título: avisos (60, original, marca, montadora) e ajuste sem quebrar palavra", () => {
  const f = nova();
  const longo = "Lanterna Dianteira Original Torken Neobus Mega Plus Esquerda Cristal LED 12V 24V";
  const av = R.avaliarTitulo(longo, f);
  assert.equal(av.ok, false);
  assert.ok(av.avisos.some((a) => /80 caracteres/.test(a)));
  assert.ok(av.avisos.some((a) => /original/.test(a)));
  assert.ok(av.avisos.some((a) => /Torken/.test(a)));
  assert.ok(av.avisos.some((a) => /montadora/.test(a)));
  const aj = R.ajustarTitulo(longo, f);
  assert.ok(aj.length <= 60, aj);
  assert.ok(!/original|torken|neobus/i.test(aj), aj);
  const comCod = R.ajustarTitulo("Lanterna Dianteira Esquerda Cristal LED Mega Plus Ônibus 12V 24V Bivolt Nova - ABC123", f);
  assert.ok(comCod.endsWith(" - ABC123") && comCod.length <= 60, comCod);
  assert.equal(R.avaliarTitulo("Bico injetor March 1.6 16V - 0280158276", f).avisos.length, 0);
});

test("título: sugestões nunca são aplicadas sozinhas", () => {
  let f = comCodigo(nova(), "0280158276");
  f = F.incorporarResultadoBase(f, { encontrado: true, origem: "base_validada", rotulo: "Base validada PAIIA", descricao: "Bico injetor", aplicacoes: [{ texto: "Nissan March 1.6 16V 2012 2019", montadora: "Nissan", modelos: ["March"], motores: ["1.6 16V"], anoInicio: 2012, anoFim: 2019, fonte: "Catálogo" }], codigos: [] }).ficha;
  const s1 = R.sugestoesTitulo(f);
  assert.ok(s1.includes("Bico injetor - 0280158276"), s1.join(" | "));
  assert.ok(!s1.some((s) => /March/.test(s)), "aplicação não conferida não entra na sugestão");
  assert.equal(R.estadoRapido(f).titulo.valor, "", "nada aplicado sozinho");
  f = F.confirmarAplicacao(f, f.aplicacoes[0].id, true);
  assert.ok(R.sugestoesTitulo(f).includes("Bico injetor March 1.6 16V - 0280158276"));
});

test("edição por voz: substituir, trocar, tirar, acrescentar, apagar e desfazer", () => {
  const t = "Lanterna dianteira esquerda cristal LED";
  assert.equal(E.editarPorVoz(t, "troca dianteira por traseira").texto, "Lanterna traseira esquerda cristal LED");
  assert.equal(E.editarPorVoz(t, "muda cristal pra fumê").texto, "Lanterna dianteira esquerda fumê LED");
  assert.equal(E.editarPorVoz(t, "tira LED.").texto, "Lanterna dianteira esquerda cristal");
  assert.equal(E.editarPorVoz(t, "acrescenta 12 e 24 volts").texto, `${t} 12 e 24 volts`);
  assert.equal(E.editarPorVoz(t, "apaga tudo").texto, "");
  assert.equal(E.editarPorVoz(t, "desfazer", { anterior: "antes" }).texto, "antes");
  assert.equal(E.editarPorVoz(t, "Farol Volvo B270F").texto, "Farol Volvo B270F", "padrão do título: substitui");
  assert.equal(E.editarPorVoz("Linha 1", "linha 2", { padrao: "acrescentar", separador: "\n" }).texto, "Linha 1\nlinha 2");
  const nada = E.editarPorVoz(t, "troca âmbar por fumê");
  assert.equal(nada.acao, "nao-achou");
  assert.equal(nada.texto, t);
  assert.equal(E.comandoNavegacao("Próximo"), "proximo");
  assert.equal(E.comandoNavegacao("voltar"), "voltar");
  assert.equal(E.comandoNavegacao("próximo farol"), null);
});

// ---------------------------------------------------------------
// Descrição
// ---------------------------------------------------------------
test("descrição: preserva o que foi dito, tira marca/original, separa medidas, segue o modelo da loja", () => {
  let f = comCodigo(nova(), "ABC123");
  f = R.definirTitulo(f, "Lanterna Dianteira Esquerda Cristal LED - ABC123");
  f = R.definirTextoDescricao(f, "lanterna dianteira lado esquerdo lente cristal com LED\nfunciona em 12 e 24 volts\nmede 30 cm de comprimento e pesa 800 gramas\nproduto original Torken com garantia");
  const o = R.organizarDescricao(f);
  const linhas = o.texto.split("\n");
  assert.equal(linhas[0], "Lanterna Dianteira Esquerda Cristal LED", "1ª linha = nome do produto (título sem o código)");
  assert.ok(o.informacoes.includes("Lanterna dianteira lado esquerdo lente cristal com LED."));
  assert.ok(o.informacoes.includes("Funciona em 12 e 24 volts."));
  assert.ok(!/30 cm|800 gramas/.test(o.texto), "medidas fora da descrição");
  assert.deepEqual(o.medidas, ["Mede 30 cm de comprimento e pesa 800 gramas."]);
  assert.ok(!/original|torken/i.test(o.texto));
  assert.ok(o.avisos.some((a) => /Torken/.test(a)) && o.avisos.some((a) => /original/.test(a)));
  assert.ok(o.texto.includes("Especificações Técnicas:\nCondição do item: Produto novo\n"));
  assert.ok(o.texto.includes("Código de Referência:\nABC123"));
  assert.ok(o.texto.includes("Garantia: 3 Meses"));
  assert.ok(!o.texto.includes("Compatível com os veículos:"), "sem aplicação conferida, sem lista de veículos");
});

test("descrição: aplicações só as conferidas; texto final editado à mão é respeitado", () => {
  let f = R.definirTitulo(nova(), "Bico injetor");
  f = R.definirTextoDescricao(f, "bico de 4 furos");
  const c = JSON.parse(JSON.stringify(f));
  const { id } = F.incluirAplicacao(c, { texto: "March", montadora: "Nissan", modelos: ["March"], motores: ["1.6 16V"], anoInicio: 2012, anoFim: 2019 }, { origem: "usuario", agora: 1 });
  f = c;
  assert.ok(!R.organizarDescricao(f).texto.includes("March"));
  f = F.confirmarAplicacao(f, id, true);
  assert.ok(R.organizarDescricao(f).texto.includes("Compatível com os veículos:\nMarch 1.6 16V 2012 à 2019"));
  f = R.definirDescricaoFinal(f, "Texto final que eu escrevi.");
  assert.equal(R.descricaoParaEnvio(f), "Texto final que eu escrevi.");
  f = R.definirDescricaoFinal(f, null);
  assert.ok(R.descricaoParaEnvio(f).startsWith("Bico injetor"));
});

// ---------------------------------------------------------------
// Validação e envio
// ---------------------------------------------------------------
test("envio: exige título (≤ 60) e descrição; código e fotos são avisos", () => {
  let f = nova();
  let v = R.validarRapido(f, { fotos: 0 });
  assert.equal(v.pronto, false);
  assert.deepEqual(v.faltando, ["título", "descrição (fale ou digite como é a peça)"]);
  f = R.definirTitulo(f, "x".repeat(61));
  assert.ok(R.validarRapido(f).faltando.some((x) => /até 60/.test(x)));
  f = R.definirTitulo(f, "Lanterna dianteira esquerda");
  f = R.definirTextoDescricao(f, "lente cristal");
  v = R.validarRapido(f, { fotos: 0 });
  assert.equal(v.pronto, true);
  assert.ok(v.avisos.some((a) => /Sem código/.test(a)));
  assert.ok(v.avisos.some((a) => /Nenhuma foto/.test(a)));
});

test("envio: dados para o Novo Anúncio (título e descrição do rascunho, marca padrão Torken)", () => {
  let f = comCodigo(nova(), "ABC123");
  f = R.definirTitulo(f, "Lanterna dianteira esquerda - ABC123");
  f = R.definirTextoDescricao(f, "lente cristal\npeso 1 kg");
  const { dados, complemento } = R.mapearRapidoParaNovoAnuncio(f, { agora: 5 });
  assert.equal(dados.codigo, "ABC123");
  assert.equal(dados.titulo, "Lanterna dianteira esquerda - ABC123");
  assert.ok(dados.descricao.startsWith("Lanterna dianteira esquerda\n\nLente cristal."));
  assert.equal(dados.preco, "");
  assert.equal(dados.origemPaiiaVoz, "rap");
  assert.equal(complemento.marca, "Torken");
  assert.deepEqual(complemento.medidas, ["Peso 1 kg."]);
});

test("etapas: navegação e estado guardado na ficha (F5)", () => {
  assert.deepEqual(R.ETAPAS, ["fotos", "codigo", "titulo", "descricao", "enviar"]);
  assert.equal(R.proximaEtapa("fotos"), "codigo");
  assert.equal(R.proximaEtapa("enviar"), "enviar");
  assert.equal(R.proximaEtapa("fotos", -1), "fotos");
  let f = R.irParaEtapa(nova(), "titulo");
  f = R.definirTitulo(f, "Farol direito");
  const arm = { m: new Map(), getItem(k) { return this.m.get(k) ?? null; }, setItem(k, v) { this.m.set(k, v); }, removeItem(k) { this.m.delete(k); } };
  F.guardarFichaVoz(f, arm);
  const lida = F.lerFichaVoz(arm);
  assert.equal(R.estadoRapido(lida).etapa, "titulo");
  assert.equal(R.estadoRapido(lida).titulo.valor, "Farol direito");
  assert.equal(R.estadoRapido(F.criarFichaVoz()).etapa, "fotos", "ficha nova começa nas fotos");
});

test("base PAIIA: encontrado vira sugestão; não encontrado não bloqueia", () => {
  let f = R.registrarConsultaBase(nova(), { encontrado: false, erro: "" });
  assert.equal(R.estadoRapido(f).base.estado, "nada");
  f = R.definirTitulo(f, "Peça X");
  f = R.definirTextoDescricao(f, "detalhe");
  assert.equal(R.validarRapido(f).pronto, true);
  f = R.registrarConsultaBase(f, { encontrado: true, rotulo: "Base validada PAIIA", descricao: "Bico injetor", aplicacoes: [{}, {}], codigos: ["16600-3AC0A"] });
  const b = R.estadoRapido(f).base;
  assert.deepEqual([b.estado, b.aplicacoes, b.aproveitado], ["encontrado", 2, false]);
  assert.equal(R.estadoRapido(R.marcarBaseAproveitada(f)).base.aproveitado, true);
});

// ---------------------------------------------------------------
// Novo Anúncio recebendo a ficha pronta do PAIIA Voz (22/10/2026)
// ---------------------------------------------------------------
import fsNA from "node:fs";
const lerNA = (p) => fsNA.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("Novo Anúncio + PAIIA Voz: sem o botão 'Buscar e Montar' e sem busca pelo Enter; outros fluxos iguais", () => {
  const dp = lerNA("src/components/DadosPeca.jsx");
  assert.match(dp, /fichaPaiiaVoz = false/, "padrão: fluxos normais mantêm o botão");
  assert.match(dp, /\{fichaPaiiaVoz \? \([^]*aviso-ficha-paiia-voz[^]*\) : \([^]*onClick=\{buscarEMontarAnuncio\}[^]*Buscar e Montar Anúncio/);
  assert.match(dp, /const buscar = fichaPaiiaVoz \? \(\) => \{\} : buscarEMontarAnuncio;/);
  assert.match(dp, /<DadosPrincipaisAnuncio[^]*buscarEMontarAnuncio=\{buscar\}/);
  const na = lerNA("src/components/NovoAnuncio.jsx");
  assert.match(na, /fichaPaiiaVoz=\{Boolean\(origemPaiiaVoz\)\}/);
  assert.equal((na.match(/(?<!function )buscarEMontarAnuncio\(/g) || []).length, 0, "a busca nunca é chamada sozinha pela tela");
  assert.match(na, /async function buscarEMontarAnuncio\(\)/, "a pesquisa por código continua existindo para os outros fluxos");
});

test("Novo Anúncio + PAIIA Voz: a marca de origem vai no rascunho (vale depois do F5) e não passa para outro anúncio", () => {
  const na = lerNA("src/components/NovoAnuncio.jsx");
  assert.match(na, /abertura\.modo === "novo" \? abertura\.dados\?\.origemPaiiaVoz : abertura\.rascunho\?\.origemPaiiaVoz/);
  assert.match(na, /anuncioEditando\s*\?\s*""/, "editar anúncio existente: fluxo normal");
  assert.match(na, /\.\.\.\(origemPaiiaVoz \? \{ origemPaiiaVoz \} : \{\}\),\n(?:    \.\.\.\(vozPesoMedidas \? \{ vozPesoMedidas \} : \{\}\),\n)?  \};/);
  const { dados } = R.mapearRapidoParaNovoAnuncio(comCodigo(nova(), "0280158276"));
  assert.equal(dados.origemPaiiaVoz, "rap");
});

test("Novo Anúncio + PAIIA Voz: sem a barra superior (Voltar à Central / Ir para); seções e outros fluxos iguais", () => {
  const na = lerNA("src/components/NovoAnuncio.jsx");
  assert.match(na, /\{!origemPaiiaVoz && \(\n\s*<nav data-paiia-etapas-novo-anuncio[^]*Voltar à Central de Publicação[^]*Ir para:[^]*<\/nav>\n\s*\)\}/, "a barra só some na ficha do Voz");
  assert.equal((na.match(/<nav data-paiia-etapas-novo-anuncio/g) || []).length, 1);
  for (const id of ["na-etapa-dados", "na-etapa-dados-tecnicos", "na-etapa-preco-frete", "na-etapa-finalizar"]) {
    assert.match(na, new RegExp(`id="${id}"`), `seção ${id} continua`);
  }
  assert.equal((na.match(/<BotaoVoltarEtapaNA alvo=/g) || []).length, 4, "botões de voltar dentro das seções continuam");
  assert.match(na, /onClick=\{continuarParaPublicacao\}/, "Continuar para Publicação continua");
});

// ---------------------------------------------------------------
// (22/10/2026) Frete SIMULADO do modo teste × 3 preços × PAIIA real.
// ---------------------------------------------------------------
const FP = await import("../../src/services/fretePrecificacao.js");
// Mesma tabela fictícia do modo teste (freteSimulado.js), para o teste ficar independente.
const TAB_SIM = [[0, 5], [19, 6.5], [49, 8], [79, 12], [100, 14], [120, 16], [150, 18], [200, 20]];
function consultaSimulada(caminho) {
  const u = new URL("https://x" + caminho);
  const preco = Number(u.searchParams.get("item_price"));
  const custo = [...TAB_SIM].reverse().find(([l]) => preco >= l)[1];
  return { ok: true, status: 200, simulacao: true, dados: { coverage: { all_country: { list_cost: custo, currency_id: "BRL", billable_weight: 350, discount: { rate: 0, promoted_amount: custo } } } } };
}
const paramsSim = FP.parametrosCotacao({ conta: "900000001", medida: { peso_g: 350, comprimento_cm: 20, largura_cm: 10, altura_cm: 10 }, modalidade: "xd_drop_off", categoria: "", tipoAnuncio: "premium" });
// custo 40 + frete de compra 5 (= 45 no custo) · embalagem 3 · comissão 17% · impostos 8%
const baseSim = FP.baseDePrecificacao({ custo: 45, despesas: 3, comissao: 17, imposto: 8 });

test("Frete SIMULADO: os 3 preços batem com a conta feita à mão (10%, 15% e 20% líquidos)", async () => {
  const r = await FP.calcularFreteEPrecos({ params: paramsSim, base: baseSim, precoFinal: 0, consultar: async (c) => consultaSimulada(c), estimar: false });
  assert.equal(r.ok, true, r.erro);
  const m = r.registro.margens;
  // Conservador: 48 ÷ 0,65 = 73,85 (frete 8) → 56 ÷ 0,65 = 86,15 (frete 12) → 60 ÷ 0,65 = 92,31 (mesma faixa).
  assert.deepEqual([m.conservador.preco, m.conservador.frete, m.conservador.comissaoValor, m.conservador.impostoValor, m.conservador.resultado], [92.31, 12, 15.69, 7.38, 9.24]);
  // Recomendado: 48 ÷ 0,60 = 80 (frete 12) → 100 (frete 14) → 62 ÷ 0,60 = 103,33.
  assert.deepEqual([m.recomendado.preco, m.recomendado.frete, m.recomendado.comissaoValor, m.recomendado.impostoValor, m.recomendado.resultado], [103.33, 14, 17.57, 8.27, 15.49]);
  // Ideal: 48 ÷ 0,55 = 87,27 (frete 12) → 109,09 (frete 14) → 62 ÷ 0,55 = 112,73.
  assert.deepEqual([m.ideal.preco, m.ideal.frete, m.ideal.comissaoValor, m.ideal.impostoValor, m.ideal.resultado], [112.73, 14, 19.16, 9.02, 22.55]);
  for (const [k, alvo] of [["conservador", 10], ["recomendado", 15], ["ideal", 20]]) {
    const x = m[k];
    assert.ok(Math.abs((x.resultado / x.preco) * 100 - alvo) < 0.02, `${k}: margem ${x.margemPct}% ≈ ${alvo}% (diferença só do arredondamento em centavos)`);
    assert.equal(FP.faixaDoPreco(x.preco), FP.faixaDoPreco(x.preco_cotado), `${k}: frete da mesma faixa do preço`);
    assert.equal(x.origem, FP.ORIGEM_FRETE.SIMULACAO);
  }
  assert.equal(r.registro.origem, FP.ORIGEM_FRETE.SIMULACAO, "o registro inteiro fica marcado como SIMULAÇÃO");
});

test("Frete SIMULADO nunca libera a publicação; a cotação oficial continua igual", async () => {
  const r = await FP.calcularFreteEPrecos({ params: paramsSim, base: baseSim, precoFinal: 103.33, consultar: async (c) => consultaSimulada(c), estimar: false });
  assert.equal(r.ok, true, r.erro);
  assert.equal(r.registro.final.origem, FP.ORIGEM_FRETE.SIMULACAO);
  const s = FP.situacaoFrete({ registro: r.registro, atual: { ...paramsSim, preco: 103.33, base: baseSim } });
  assert.equal(s.estado, "simulacao");
  assert.notEqual(s.estado, "ok", "a Publicação exige estado ok");
  assert.match(s.motivos[0], /SIMULAÇÃO — NÃO É COTAÇÃO OFICIAL/);
  const nova = await FP.cotarNoPreco({ params: paramsSim, preco: 103.33, consultar: async (c) => consultaSimulada(c) });
  assert.equal(FP.conferirCotacao({ registro: r.registro, nova }).ok, false, "conferência na publicação recusa");
  // Cotação oficial (sem a marca): mesmo caminho de antes → origem mercado_livre e estado ok.
  const oficial = async (c) => { const x = consultaSimulada(c); delete x.simulacao; return x; };
  const o = await FP.calcularFreteEPrecos({ params: paramsSim, base: baseSim, precoFinal: 103.33, consultar: oficial, estimar: false });
  assert.equal(o.registro.origem, FP.ORIGEM_FRETE.ML);
  assert.equal(FP.situacaoFrete({ registro: o.registro, atual: { ...paramsSim, preco: 103.33, base: baseSim } }).estado, "ok");
  assert.equal(o.registro.margens.recomendado.preco, 103.33, "mesma fórmula e mesmos preços");
  // Uma margem simulada contamina o cálculo todo (nunca vira "mercado_livre").
  let n = 0;
  const misto = async (c) => { const x = consultaSimulada(c); if (n++ > 0) delete x.simulacao; return x; };
  const mx = await FP.calcularFreteEPrecos({ params: paramsSim, base: baseSim, precoFinal: 0, consultar: misto, estimar: false });
  assert.equal(mx.registro.origem, FP.ORIGEM_FRETE.SIMULACAO);
});

test("PAIIA real: frete simulado é recusado e o Novo Anúncio só usa a cotação oficial", async () => {
  const cfg = lerNA("src/config/modoTesteLocal.js");
  assert.match(cfg, /export const MODO_TESTE_LOCAL = false;/);
  const L = await import("../../src/services/consultaMLLeitura.js");
  assert.equal(L.FRETE_SIMULADO_PERMITIDO, false, "fora do servidor de teste a simulação fica desligada");
  const c = lerNA("src/services/consultaMLLeitura.js");
  assert.match(c, /if \(data\.simulacao === true && !FRETE_SIMULADO_PERMITIDO\) \{\n\s*return \{ ok: false, erro: "Resposta SIMULADA recusada/);
  const na = lerNA("src/components/NovoAnuncio.jsx");
  assert.match(na, /const freteUsavelNA = \(registro\) =>\n\s*registro\?\.origem === "mercado_livre" \|\| \(FRETE_SIMULADO_PERMITIDO && registro\?\.origem === "simulacao_teste"\);/);
  assert.equal((na.match(/registroFreteML\?\.origem === "mercado_livre"/g) || []).length, 0, "todas as checagens passam por freteUsavelNA");
  assert.match(na, /return m && m\.preco > 0 && freteUsavelNA\(registroFreteML\) \? m\.preco : 0;/);
  assert.match(na, /🧪 SIMULAÇÃO — NÃO É COTAÇÃO OFICIAL/);
  const rev = lerNA("src/components/RevisaoPublicacaoML.jsx");
  assert.match(rev, /if \(s\.estado !== "ok"\) return \{ ok: false/, "Publicação continua exigindo frete ok");
});

test("Aviso de falha ao sair pelo menu: só ficha do PAIIA Voz, só no navegador (nada na base)", async () => {
  const A = await import("../../src/services/avisoFichaNaoSalva.js");
  const d = {};
  const ls = { getItem: (k) => (k in d ? d[k] : null), setItem: (k, v) => { d[k] = String(v); }, removeItem: (k) => { delete d[k]; } };
  assert.equal(A.lerAvisoFichaNaoSalva(ls), null);
  A.registrarAvisoFichaNaoSalva({ codigo: "0280158276", titulo: "Bico", fichaId: "f1", erro: "falha simulada" }, ls);
  assert.equal(A.lerAvisoFichaNaoSalva(ls).erro, "falha simulada");
  A.limparAvisoFichaNaoSalva(ls);
  assert.equal(A.lerAvisoFichaNaoSalva(ls), null);
  assert.equal(A.falhaQueMereceAviso({ ok: false, erro: "x" }), true);
  assert.equal(A.falhaQueMereceAviso({ ok: true }), false);
  assert.equal(A.falhaQueMereceAviso({ ok: true, vazio: true }), false);
  assert.equal(A.falhaQueMereceAviso({ ok: false, fechada: true }), false);
  // "Abrir o Novo Anúncio de novo" só retoma o anúncio guardado pela Home se for o DESTA ficha.
  assert.equal(A.anuncioGuardadoEhDoAviso({ resumo: { fichaId: "f1", codigo: "0280158276" } }, { fichaId: "f1" }), true);
  assert.equal(A.anuncioGuardadoEhDoAviso({ resumo: { fichaId: "f2", codigo: "0280158276" } }, { fichaId: "f1", codigo: "0280158276" }), false);
  assert.equal(A.anuncioGuardadoEhDoAviso({ resumo: { codigo: "0 280-158 276" } }, { codigo: "0280158276" }), true);
  assert.equal(A.anuncioGuardadoEhDoAviso(null, { codigo: "0280158276" }), false);
  const h = lerNA("src/hooks/useFichaNovoAnuncio.js");
  assert.match(h, /const pendente = Boolean\(st\.timer\) \|\| \(avisar && st\.falhou\);/, "outros fluxos: igual a antes (só grava se havia pendência)");
  const na = lerNA("src/components/NovoAnuncio.jsx");
  assert.match(na, /avisarFalhaAoSair: Boolean\(origemPaiiaVoz\),/);
  const app = lerNA("src/App.jsx");
  assert.match(app, /\{screen !== "login" && screen !== "novoAnuncio" && <AvisoFichaNaoSalva setScreen=\{setScreen\} \/>\}/);
  assert.equal(/supabase/.test(lerNA("src/services/avisoFichaNaoSalva.js")), false, "o aviso não usa a base");
});

// ---------------------------------------------------------------
// (22/10/2026) Preparação do teste com microfone USB: códigos falados,
// comandos de correção, avisos, teste do microfone e peso/medidas.
// ---------------------------------------------------------------
test("Voz · códigos falados com letras, números e espaços (etapa Código)", () => {
  const casos = [
    ["0280158276", "0280158276"], ["0 280 158 276", "0280158276"], ["zero dois oito zero um cinco oito dois sete seis", "0280158276"],
    ["o código é 0280158276", "0280158276"], ["é 0280158276", "0280158276"], ["o código dela é 0280158276", "0280158276"],
    ["IWP 065", "IWP065"], ["F 000 99 0 123", "F000990123"], ["0 4 4 5 1 1 0 2 3 5", "0445110235"],
    ["16600-3AC0A", "16600-3AC0A"], ["código 16600 3AC0A", "166003AC0A"], ["é 1 6 6 0 0 traço 3 AC zero a", "16600-3AC0A"],
  ];
  for (const [fala, esperado] of casos) assert.equal(R.lerCodigoDaFala(fala).codigo, esperado, fala);
  assert.equal(R.lerCodigoDaFala("IWP 065").soletrado, true, "blocos juntados: pede conferência letra a letra");
  assert.match(R.lerCodigoDaFala("2015").erro, /parece ano/);
  assert.match(R.lerCodigoDaFala("bico injetor do march").erro, /Não entendi/);
  assert.equal(R.lerCodigoDaFala("não tem código").pular, true);
});

test("Voz · comandos de correção (formas faladas) e nada é apagado por fala não entendida", () => {
  const t = "Bico Injetor March Versa 1.6 16V - 0280158276";
  const ed = (fala, campo = "titulo") => E.editarPorVoz(t, fala, { padrao: campo === "titulo" ? "substituir" : "acrescentar", anterior: t, campo });
  assert.equal(ed("troque 16V por 16 válvulas").texto, "Bico Injetor March Versa 1.6 16 válvulas - 0280158276");
  assert.equal(ed("substitua Versa por Kicks").texto, "Bico Injetor March Kicks 1.6 16V - 0280158276");
  assert.equal(ed("mude March para Note").texto, "Bico Injetor Note Versa 1.6 16V - 0280158276");
  assert.equal(ed("apague Versa").texto, "Bico Injetor March 1.6 16V - 0280158276");
  assert.equal(ed("tire 16V").texto, "Bico Injetor March Versa 1.6 - 0280158276");
  assert.equal(ed("acrescente Flex").texto, `${t} Flex`);
  assert.equal(ed("desfaça").acao, "desfazer");
  assert.equal(ed("muda o título para Bico Injetor Versa").texto, "Bico Injetor Versa");
  assert.equal(ed("o título é Bico Injetor Nissan March").texto, "Bico Injetor Nissan March");
  for (const fala of ["troque o motor", "apague isso aí", "o carro é March 2015", "a descrição é teste", "tira original"]) {
    const e = ed(fala);
    assert.equal(e.texto, t, `“${fala}” não pode alterar o título`);
    assert.ok(["nao-entendeu", "nao-achou", "nao-parece"].includes(e.acao), fala);
    assert.match(e.aviso, /Nada foi alterado|Vá para/);
  }
  assert.equal(ed("Bico injetor Nissan March 1.6 flex").acao, "substituir", "título completo falado continua valendo");
  const d = "Bico de 4 furos.\nVazão conferida.\nConector oval";
  assert.equal(E.editarPorVoz(d, "apaga a última frase", { padrao: "acrescentar", separador: "\n", campo: "descricao" }).texto, "Bico de 4 furos.\nVazão conferida.");
  assert.equal(E.editarPorVoz(d, "ok", { padrao: "acrescentar", separador: "\n", campo: "descricao" }).texto, d, "“ok” não entra na descrição");
  assert.equal(E.editarPorVoz(d, "troque o lado", { padrao: "acrescentar", separador: "\n", campo: "descricao" }).texto, d);
  const tela = lerNA("src/modules/paiiaVoz/PaiiaVozRapido.jsx");
  assert.equal((tela.match(/\["nada", "nao-achou", "nao-entendeu", "nao-parece"\]\.includes\(e\.acao\)/g) || []).length, 2, "título e descrição respeitam o 'nada foi alterado'");
});

test("Voz · modo conversa: “o código é …”, “a marca é …” e “corrige o código para …”", async () => {
  const C = await import("../../src/modules/paiiaVoz/servicos/conversaVoz.js");
  let f = F.criarFichaVoz();
  f = C.conversar(f, "o código é 0280158276").ficha;
  assert.deepEqual(f.codigos.map((c) => c.codigo), ["0280158276"]);
  f = C.conversar(f, "a marca é Bosch").ficha;
  assert.equal(f.campos.marca.valor, "Bosch");
  f = C.conversar(f, "corrige o código para 0280158277").ficha;
  assert.deepEqual(f.codigos.map((c) => [c.codigo, c.principal]), [["0280158277", true]], "o código errado sai; o novo vira o principal");
  f = C.conversar(f, "o preço é 89,90").ficha;
  assert.equal(f.campos.preco.valor, 89.9);
});

test("Voz · aviso ao abrir quando não há reconhecimento de voz ou microfone", async () => {
  const V = await import("../../src/modules/paiiaVoz/servicos/reconhecimentoVoz.js");
  const chrome = { webkitSpeechRecognition: function () {}, isSecureContext: true, navigator: { mediaDevices: { getUserMedia() {} } } };
  assert.equal(V.diagnosticoVoz(chrome).aviso, "");
  assert.match(V.diagnosticoVoz({ isSecureContext: true, navigator: {} }).aviso, /não tem reconhecimento de voz/);
  assert.match(V.diagnosticoVoz({ ...chrome, isSecureContext: false }).aviso, /endereço seguro/);
  assert.match(V.diagnosticoVoz({ ...chrome, navigator: {} }).aviso, /acesso ao microfone/);
  assert.match(V.MENSAGENS_ERRO["no-speech"], /Testar microfone/);
  const tela = lerNA("src/modules/paiiaVoz/PaiiaVozRapido.jsx");
  assert.match(tela, /\{avisoVoz && <p className="pr-erro" role="status" data-pv-aviso-sem-voz>/);
});

test("Voz · Testar microfone: nível, microfone padrão do Chrome (USB) e mensagens; nada é gravado", async () => {
  const T = await import("../../src/modules/paiiaVoz/servicos/testeMicrofone.js");
  assert.equal(T.nivelDoSinal(new Float32Array(512)), 0);
  assert.equal(T.nivelDoSinal(new Float32Array(512).fill(1)), 100);
  assert.ok(T.nivelDoSinal(new Float32Array(512).fill(0.1)) >= T.NIVEL_VOZ, "voz normal passa do limite");
  assert.ok(T.nivelDoSinal(new Float32Array(512).fill(0.002)) < T.NIVEL_VOZ, "ruído baixo não");
  const windows = [
    { kind: "audioinput", deviceId: "default", groupId: "g2", label: "Padrão - Microfone (USB Audio Device)" },
    { kind: "audioinput", deviceId: "communications", groupId: "g1", label: "Comunicações - Microfone (Realtek)" },
    { kind: "audioinput", deviceId: "a1", groupId: "g1", label: "Microfone (Realtek)" },
    { kind: "audioinput", deviceId: "b2", groupId: "g2", label: "Microfone (USB Audio Device)" },
    { kind: "audiooutput", deviceId: "x", label: "Alto-falantes" },
  ];
  const l = T.listaMicrofones(windows);
  assert.equal(l.nomePadrao, "Microfone (USB Audio Device)");
  assert.deepEqual(l.lista.map((m) => [m.nome, m.padrao, m.usb]), [["Microfone (Realtek)", false, false], ["Microfone (USB Audio Device)", true, true]]);
  assert.match(T.mensagemErroMicrofone({ name: "NotAllowedError" }), /bloqueou o microfone/);
  assert.match(T.mensagemErroMicrofone({ name: "NotFoundError" }), /Nenhum microfone/);
  assert.match(T.mensagemErroMicrofone({ name: "NotReadableError" }), /em uso por outro programa/);
  assert.match(T.mensagemErroMicrofone({}, { seguro: false }), /endereço seguro/);
  const comp = lerNA("src/modules/paiiaVoz/TesteMicrofone.jsx");
  assert.equal(/MediaRecorder|localStorage|indexedDB|fetch\(|supabase|\.connect\(ctx\.destination\)/.test(comp), false, "não grava, não guarda, não envia, não toca no alto-falante");
  assert.match(comp, /getTracks\(\)\.forEach\(\(t\) => t\.stop\(\)\)/, "solta o microfone ao parar");
});

test("Voz · peso e medidas ditos → Dados técnicos (só vazios) e o frete espera a conferência", async () => {
  const P = await import("../../src/modules/paiiaVoz/servicos/pesoMedidasVoz.js");
  const c = (frases) => P.camposDadosTecnicos(P.lerPesoEMedidas(frases));
  assert.deepEqual(c(["Peso 350 gramas."]), { pesoFreteML: "0,35" });
  assert.deepEqual(c(["Pesa 0,35 kg."]), { pesoFreteML: "0,35" });
  assert.deepEqual(c(["Medidas 20 por 10 por 10."]), { comprimentoFreteML: "20", larguraFreteML: "10", alturaFreteML: "10" });
  assert.deepEqual(c(["200 por 100 por 100 mm"]), { comprimentoFreteML: "20", larguraFreteML: "10", alturaFreteML: "10" });
  assert.deepEqual(c(["Comprimento 20, largura 10, altura 10."]), { comprimentoFreteML: "20", larguraFreteML: "10", alturaFreteML: "10" });
  assert.deepEqual(c(["Diâmetro 10 mm."]), {}, "medida da peça não vai para a embalagem");
  const dois = P.lerPesoEMedidas(["Peso 50 gramas.", "Embalagem 20 por 10 por 10 e pesa 350 gramas."]);
  assert.equal(dois.peso_g, 350);
  assert.match(dois.duvidas[0], /dois pesos/);
  // Mapeamento da ficha do Voz
  let f = R.irParaEtapa(F.criarFichaVoz(), "descricao");
  f = R.definirTextoDescricao(f, "Bico de 4 furos.\nPeso 350 gramas.\nMedidas 20 por 10 por 10.");
  f = R.definirTitulo(f, "Bico Injetor March 1.6 - 0280158276");
  const { dados } = R.mapearRapidoParaNovoAnuncio(f);
  assert.deepEqual(dados.pesoMedidasVoz.campos, { pesoFreteML: "0,35", comprimentoFreteML: "20", larguraFreteML: "10", alturaFreteML: "10" });
  assert.equal(dados.pesoMedidasVoz.texto, "350 g · 20 × 10 × 10 cm (C × L × A)");
  assert.equal(/Peso 350|Medidas 20/.test(dados.descricao), false, "continua fora da descrição");
  assert.equal(R.mapearRapidoParaNovoAnuncio(R.definirTextoDescricao(f, "Bico de 4 furos.")).dados.pesoMedidasVoz, undefined);
  // Novo Anúncio: só campos vazios, conferência antes do frete, vale no F5
  const na = lerNA("src/components/NovoAnuncio.jsx");
  assert.match(na, /if \(String\(atuais\[campo\] \?\? ""\)\.trim\(\)\) continue; \/\/ já tinha valor: não substitui/);
  assert.match(na, /setters\[campo\]\(\(atual\) => \(String\(atual \?\? ""\)\.trim\(\) \? atual : valor\)\);/);
  assert.match(na, /medida: pesoMedidasVozPendente \? null : medidaFreteNA,/, "frete não cota antes do “Conferi”");
  assert.match(na, /\.\.\.\(vozPesoMedidas \? \{ vozPesoMedidas \} : \{\}\),/, "vai no rascunho (F5)");
  assert.match(na, /setVozPesoMedidas\(dados\.vozPesoMedidas && typeof dados\.vozPesoMedidas === "object" \? dados\.vozPesoMedidas : null\);/);
  assert.match(na, /abertura\.dados\.origemPaiiaVoz && pm/, "só para ficha do PAIIA Voz");
});

test("Publicação (22/10): página inicial de produção preservada + cartão PAIIA Voz; topo igual", () => {
  const home = lerNA("src/components/Home.jsx");
  for (const tela of ["bannerStudio", "criarMascotePaizinho", "novoAnuncio", "centralPaizinho"]) { // Clip IA: em produção não tem cartão na página inicial (continua igual)
    assert.match(home, new RegExp(`tela: "${tela}"`), `cartão ${tela} continua na página inicial`);
  }
  assert.equal((home.match(/tela: "paiiaVoz"/g) || []).length, 1, "um cartão PAIIA Voz");
  const app = lerNA("src/App.jsx");
  assert.equal((app.match(/Paizinho IA\n/g) || []).length, 2, "botão Paizinho IA do topo como em produção");
  assert.equal(/data-paiia-topo-voz/.test(app), false);
  assert.match(app, /\{screen === "paiiaVoz" && \(\n  <PaiiaVoz/);
  const na = lerNA("src/components/NovoAnuncio.jsx");
  assert.match(na, /\{ml && origemPaiiaVoz && freteUsavelNA\(registroFreteML\)/, "conta das 3 opções só na ficha do PAIIA Voz");
});
