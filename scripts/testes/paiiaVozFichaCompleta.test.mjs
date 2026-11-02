// =============================================================
// PAIIA Voz — ETAPA 1 (02/11/2026): ficha COMPLETA direto do Voz.
//   node --test scripts/testes/paiiaVozFichaCompleta.test.mjs
// Banco, base e armazenamento SIMULADOS (nenhuma chamada real, nada pago).
// Casos: peça EXISTENTE na base, peça NOVA (só voz) e ficha INCOMPLETA;
// sincronização celular → ficha → computador; Novo Anúncio preservado.
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import * as N from "../../src/modules/paiiaVoz/servicos/fichaVozNuvem.js";
import * as G from "../../src/modules/paiiaVoz/servicos/fotosVozLocal.js";
import * as F from "../../src/modules/paiiaVoz/servicos/fichaVoz.js";
import * as R from "../../src/modules/paiiaVoz/servicos/rascunhoRapido.js";
import { interpretarFala } from "../../src/modules/paiiaVoz/servicos/interpretarFala.js";
import { consultarBaseVoz } from "../../src/modules/paiiaVoz/servicos/consultaBaseVoz.js";
import { dadosCompletosVoz, aplicacoesEstruturadasVoz, tipoVeiculoVoz } from "../../src/modules/paiiaVoz/servicos/fichaCompletaVoz.js";
import { mesclarNovoAnuncio, rascunhoDaFicha, montarNovoAnuncioParaFicha } from "../../src/services/fichaNovoAnuncio.js";

const img = (nome, n = 10) => new File([new Uint8Array(n)], nome, { type: "image/jpeg" });
const falar = (f, texto) => F.aplicarInterpretacao(f, interpretarFala(texto), { origem: "voz", textoOriginal: texto }).ficha;
const incluir = (f, ap) => { const g = structuredClone(f); F.incluirAplicacao(g, ap, { origem: "usuario" }); return g; };
const confirmarTodas = (f) => (f.aplicacoes || []).reduce((acc, a) => F.confirmarAplicacao(acc, a.id, true), f);

function contaFalsa() {
  const fichas = new Map();
  const c = { criadas: 0, gravacoes: 0 };
  let n = 0;
  return {
    c, fichas,
    enviarOriginal: async (reg) => ({ caminho: `u1/originais/${reg.id}`, url: `https://arm/u1/originais/${reg.id}` }),
    enviarTratada: async (reg) => ({ caminho: `u1/prontas/${reg.id}.png`, url: `https://arm/u1/prontas/${reg.id}.png` }),
    lerFicha: async (id) => (fichas.has(id) ? { ok: true, ficha: structuredClone(fichas.get(id)) } : { ok: false, naoEncontrada: true }),
    salvarFicha: async ({ fichaId, codigo, titulo, montado, paiiaVoz }) => {
      c.gravacoes++;
      const agora = new Date(Date.now() + c.gravacoes).toISOString();
      if (fichaId) {
        const atual = fichas.get(fichaId);
        atual.dados_conferencia = mesclarNovoAnuncio(atual.dados_conferencia, montado, agora, { paiiaVoz });
        atual.titulo = titulo || atual.titulo;
        return { ok: true, fichaId, salvoEm: agora };
      }
      c.criadas++;
      const id = `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
      fichas.set(id, { id, codigo, titulo, status_fluxo: "rascunho", dados_conferencia: mesclarNovoAnuncio({}, montado, agora, { paiiaVoz }) });
      return { ok: true, fichaId: id, nova: true, salvoEm: agora };
    },
  };
}
function celular(idVoz) {
  const conta = contaFalsa();
  const guarda = G.criarGuardaFotos({ armazenamento: G.armazenamentoMemoria() });
  const deps = { usuarioId: "u1", guarda, enviarOriginal: conta.enviarOriginal, enviarTratada: conta.enviarTratada, lerFicha: conta.lerFicha, salvarFicha: conta.salvarFicha };
  const cel = { conta, guarda, deps, ficha: F.criarFichaVoz({ id: idVoz }) };
  // Mesmo caminho do PaiiaVozRapido.sincronizar().
  cel.sinc = async () => {
    const f = cel.ficha;
    const regs = await guarda.listar(f.id);
    const { dados } = R.mapearRapidoParaNovoAnuncio(f);
    const completos = dadosCompletosVoz(f, { fotos: regs.length });
    const r = await N.sincronizarFichaVoz({ fichaVozId: f.id, fichaIdPAIIA: f.fichaIdPAIIA || "", codigo: dados.codigo, codigoNormalizado: F.codigoPrincipal(f)?.normalizado || "", titulo: R.estadoRapido(f).titulo.valor, descricao: dados.descricao, preco: dados.preco, oem: dados.oem, completos }, regs, deps);
    if (r.ok) cel.ficha = { ...cel.ficha, fichaIdPAIIA: r.fichaIdPAIIA };
    return r;
  };
  cel.naConta = () => conta.fichas.get(cel.ficha.fichaIdPAIIA);
  return cel;
}

// -------------------------------------------------------------
// 1) PEÇA EXISTENTE NA BASE: aproveita só o que o usuário confirmar
// -------------------------------------------------------------
test("peça EXISTENTE: base encontrada → aplicações confirmadas viram dados estruturados (origem base), nada além", async () => {
  const cel = celular("voz-base");
  await cel.guarda.adicionar(cel.ficha.id, [img("1.jpg"), img("2.jpg"), img("3.jpg")]);
  cel.ficha = falar(cel.ficha, "código 0280158276 marca Bosch preço 189,90 quantidade 4");
  const base = await consultarBaseVoz("0280158276", {
    buscarValidado: async () => [
      { modelo: "March", montadora: "Nissan", motor: "1.6", ano_inicio: 2012, ano_fim: 2019, peca: "Bico injetor", fontes: ["Base validada"] },
      { modelo: "Versa", montadora: "Nissan", motor: "1.6", ano_inicio: 2012, ano_fim: 2020, fontes: ["Base validada"] },
    ],
  });
  assert.equal(base.encontrado, true);
  cel.ficha = F.incorporarResultadoBase(cel.ficha, base).ficha;
  // Antes de confirmar: nenhuma aplicação estruturada (não é inventado nada)
  assert.deepEqual(aplicacoesEstruturadasVoz(cel.ficha), []);
  // Confirma só o March
  const march = cel.ficha.aplicacoes.find((a) => a.modelos.includes("March"));
  cel.ficha = F.confirmarAplicacao(cel.ficha, march.id, true);
  cel.ficha = R.definirTitulo(cel.ficha, "Bico Injetor Nissan March 1.6 0280158276");
  cel.ficha = R.definirTextoDescricao(cel.ficha, "bico injetor\npeso 80 gramas caixa 10 x 5 x 5 cm");

  const d = dadosCompletosVoz(cel.ficha, { fotos: 3 });
  assert.equal(d.marca, "Bosch", "marca dita (não troca por Torken)");
  assert.equal(d.preco, "189,90");
  assert.equal(d.quantidade, "4");
  assert.equal(d.aplicacoes.length, 1);
  assert.deepEqual({ ...d.aplicacoes[0], fonte: undefined }, { montadora: "Nissan", modelo: "March", motor: "1.6", versao: "", anoInicio: "2012", anoFim: "2019", tipoVeiculo: "", origem: "base", fonte: undefined });
  assert.equal(d.tipoVeiculo, "Carro/Caminhonete", "regra oficial: Nissan → carro");
  assert.deepEqual(d.medida, { peso_g: 80, comprimento_cm: 10, largura_cm: 5, altura_cm: 5 });
  assert.ok(d.pendencias.some((p) => /1 aplicação\(ões\) ainda não conferida/.test(p)), "Versa não conferido fica de fora e é avisado");
  assert.equal(d.completa, true, "falta só conferir aplicação opcional");

  const r = await cel.sinc();
  assert.equal(r.ok, true, JSON.stringify(r));
  const dc = cel.naConta().dados_conferencia;
  assert.equal(dc.novo_anuncio.tipoVeiculo, "Carro/Caminhonete");
  assert.deepEqual(dc.novo_anuncio.medida, d.medida);
  assert.equal(dc.paiia_voz.complemento.marca, "Bosch");
  assert.equal(dc.paiia_voz.complemento.quantidadeEstoque, "4");
  assert.equal(dc.paiia_voz.aplicacoes.length, 1);
  assert.equal(dc.paiia_voz.completa, true);
  assert.equal(dc.novo_anuncio.fotos.length, 3);
});

// -------------------------------------------------------------
// 2) PEÇA NOVA (fora da base): tudo pela conversa — caso da lanterna de ônibus
// -------------------------------------------------------------
test("peça NOVA: base vazia → conversa completa a ficha; ônibus dito → Linha Pesada; marca só a dita", async () => {
  const cel = celular("voz-nova");
  await cel.guarda.adicionar(cel.ficha.id, ["a", "b", "c", "d", "e"].map((x) => img(`${x}.jpg`)));
  const base = await consultarBaseVoz("856371-305", { buscarValidado: async () => [], pesquisarCatalogo: async () => [] });
  assert.equal(base.encontrado, false);
  cel.ficha = falar(cel.ficha, "código 856371-305 marca Torken preço 97,92 quantidade 10");
  cel.ficha = incluir(cel.ficha, { texto: "ônibus Neobus Mega Plus 2013 a 2016", montadora: "Neobus", modelos: ["Mega Plus"], motores: [], anoInicio: 2013, anoFim: 2016, tipoVeiculo: "Ônibus" });
  cel.ficha = confirmarTodas(cel.ficha);
  cel.ficha = R.definirTitulo(cel.ficha, "Lanterna Dianteira Cristal Ônibus Neobus Mega Plus");
  cel.ficha = R.definirTextoDescricao(cel.ficha, "lanterna dianteira cristal LED esquerda\npeso 350 gramas caixa 20 x 10 x 10 cm");

  const d = dadosCompletosVoz(cel.ficha, { fotos: 5 });
  assert.equal(d.marca, "Torken");
  assert.equal(d.tipoVeiculo, "Linha Pesada");
  assert.equal(d.tipoVeiculoOrigem, "falado");
  assert.deepEqual(d.medida, { peso_g: 350, comprimento_cm: 20, largura_cm: 10, altura_cm: 10 });
  assert.deepEqual(d.aplicacoes.map((a) => [a.montadora, a.modelo, a.anoInicio, a.anoFim, a.origem]), [["Neobus", "Mega Plus", "2013", "2016", "manual"]]);
  assert.deepEqual(d.pendencias, []);
  assert.equal(d.completa, true);

  const r = await cel.sinc();
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.completa, true);
  // Computador: o Novo Anúncio abre a MESMA ficha com tipo e peso/medidas preenchidos
  const rasc = rascunhoDaFicha(cel.naConta());
  assert.equal(rasc.codigo, "856371-305");
  assert.equal(rasc.tipoVeiculo, "Linha Pesada");
  assert.equal(rasc.pesoFreteML, "0,35");
  assert.equal(rasc.comprimentoFreteML, "20");
  assert.equal(rasc.fotos.length, 5);
});

// -------------------------------------------------------------
// 3) FICHA INCOMPLETA: salva o que tem e lista o que falta; nada inventado
// -------------------------------------------------------------
test("ficha INCOMPLETA: só código e 1 foto → salva, sem marca/preço/estoque/tipo inventados, pendências listadas", async () => {
  const cel = celular("voz-incompleta");
  await cel.guarda.adicionar(cel.ficha.id, [img("x.jpg")]);
  cel.ficha = falar(cel.ficha, "código 7700101970");
  const d = dadosCompletosVoz(cel.ficha, { fotos: 1 });
  assert.equal(d.marca, "", "não presume Torken");
  assert.equal(d.preco, "");
  assert.equal(d.quantidade, "");
  assert.equal(d.tipoVeiculo, "");
  assert.equal(d.medida, null);
  assert.deepEqual(d.aplicacoes, []);
  assert.equal(d.completa, false);
  for (const re of [/^Título/, /^Marca/, /^Preço/, /^Estoque/, /^Tipo de veículo/, /^Peso e medidas/, /^Aplicações/]) assert.ok(d.pendencias.some((p) => re.test(p)), String(re));

  const r = await cel.sinc();
  assert.equal(r.ok, true);
  assert.equal(r.completa, false);
  const dc = cel.naConta().dados_conferencia;
  assert.equal(dc.novo_anuncio.tipoVeiculo, undefined, "tipo não gravado sem informação");
  assert.equal(dc.novo_anuncio.medida, undefined);
  assert.equal(dc.paiia_voz.complemento.marca, "");
  assert.ok(dc.paiia_voz.pendencias.length >= 7);
});

test("medida incompleta não vai para a ficha (vira pendência)", () => {
  let f = F.criarFichaVoz({ id: "voz-m" });
  f = R.definirTextoDescricao(f, "peso 200 gramas");
  const d = dadosCompletosVoz(f, { fotos: 1 });
  assert.equal(d.medida, null);
  assert.ok(d.pendencias.some((p) => /Peso e medidas incompletos/.test(p)));
});

test("tipo de veículo: carro + ônibus misturados não decide sozinho", () => {
  const t = tipoVeiculoVoz(null, [{ montadora: "Neobus", modelo: "Mega Plus", tipoVeiculo: "Ônibus" }, { montadora: "Fiat", modelo: "Uno", tipoVeiculo: "Carro" }]);
  assert.equal(t.valor, "");
  assert.equal(tipoVeiculoVoz(null, [{ montadora: "Marca X", modelo: "Y", tipoVeiculo: "Van" }]).valor, "", "van é ambíguo");
});

// -------------------------------------------------------------
// Sincronização e convivência com o Novo Anúncio
// -------------------------------------------------------------
test("computador vence: tipo/medida EDITADOS no Novo Anúncio não são sobrescritos pelo Voz", async () => {
  const cel = celular("voz-conflito");
  await cel.guarda.adicionar(cel.ficha.id, [img("x.jpg")]);
  cel.ficha = falar(cel.ficha, "código 856371-305");
  cel.ficha = incluir(cel.ficha, { texto: "ônibus Neobus Mega Plus", montadora: "Neobus", modelos: ["Mega Plus"], motores: [], tipoVeiculo: "Ônibus" });
  cel.ficha = confirmarTodas(cel.ficha);
  await cel.sinc();
  // No computador: Novo Anúncio troca o tipo (edição registrada) e grava
  const row = cel.naConta();
  const est = { ...rascunhoDaFicha(row), tipoVeiculo: "Carro/Caminhonete", edicoes: { tipoVeiculo: new Date().toISOString() } };
  row.dados_conferencia = mesclarNovoAnuncio(row.dados_conferencia, montarNovoAnuncioParaFicha(est, row.id), new Date(Date.now() + 999).toISOString());
  assert.ok(row.dados_conferencia.paiia_voz?.aplicacoes?.length, "o Novo Anúncio preserva o bloco paiia_voz");
  const r = await cel.sinc();
  assert.equal(r.ok, true);
  assert.ok(r.conflitos.includes("tipo de veículo"));
  assert.equal(cel.naConta().dados_conferencia.novo_anuncio.tipoVeiculo, "Carro/Caminhonete");
});

test("tipo padrão do Novo Anúncio (sem edição) não bloqueia o tipo dito no Voz", async () => {
  const cel = celular("voz-padrao");
  await cel.guarda.adicionar(cel.ficha.id, [img("x.jpg")]);
  cel.ficha = falar(cel.ficha, "código 856371-305");
  await cel.sinc();
  const row = cel.naConta();
  row.dados_conferencia = mesclarNovoAnuncio(row.dados_conferencia, montarNovoAnuncioParaFicha({ ...rascunhoDaFicha(row), tipoVeiculo: "Carro/Caminhonete" }, row.id), new Date(Date.now() + 999).toISOString());
  cel.ficha = incluir(cel.ficha, { texto: "ônibus Neobus Mega Plus", montadora: "Neobus", modelos: ["Mega Plus"], motores: [], tipoVeiculo: "Ônibus" });
  cel.ficha = confirmarTodas(cel.ficha);
  const r = await cel.sinc();
  assert.equal(r.ok, true);
  assert.equal(cel.naConta().dados_conferencia.novo_anuncio.tipoVeiculo, "Linha Pesada");
});

test("chamada antiga (sem completos) continua igual: não grava campos novos", async () => {
  const cel = celular("voz-antigo");
  cel.ficha = falar(cel.ficha, "código 856371-305");
  const r = await N.sincronizarFichaVoz({ fichaVozId: cel.ficha.id, codigo: "856371-305", titulo: "", descricao: "", preco: "", oem: "" }, [], cel.deps);
  assert.equal(r.ok, true);
  const dc = cel.conta.fichas.get(r.fichaIdPAIIA).dados_conferencia;
  assert.equal(dc.paiia_voz.complemento, undefined);
  assert.equal(dc.novo_anuncio.tipoVeiculo, undefined);
});

test("fala real: 'aplicação ônibus Neobus Mega Plus 2013 a 2016' (palavra-chave) → Linha Pesada pela regra oficial, após confirmar", () => {
  let f = falar(F.criarFichaVoz({ id: "voz-fala" }), "código 856371-305 aplicação ônibus Neobus Mega Plus 2013 a 2016");
  assert.equal(dadosCompletosVoz(f, { fotos: 1 }).aplicacoes.length, 0, "não conferida: fica de fora");
  f = confirmarTodas(f);
  const d = dadosCompletosVoz(f, { fotos: 1 });
  assert.equal(d.aplicacoes.length, 1);
  assert.equal(d.tipoVeiculo, "Linha Pesada");
});
