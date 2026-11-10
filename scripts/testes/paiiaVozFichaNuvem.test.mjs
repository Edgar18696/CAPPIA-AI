// =============================================================
// PAIIA Voz — ficha na conta (31/10/2026): celular → ficha → computador.
//   node --test scripts/testes/paiiaVozFichaNuvem.test.mjs
// Banco e armazenamento SIMULADOS em memória (nenhuma chamada real, nada pago).
// Testes de regressão: falham se as fotos do Voz deixarem de ir para a ficha,
// se houver envio/cobrança duplicada, se o computador perder a edição dele,
// ou se a padronização (E6) sumir do caminho do Voz.
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as N from "../../src/modules/paiiaVoz/servicos/fichaVozNuvem.js";
import * as G from "../../src/modules/paiiaVoz/servicos/fotosVozLocal.js";
import * as IA from "../../src/modules/paiiaVoz/servicos/fotoIAVoz.js";
import * as F from "../../src/modules/paiiaVoz/servicos/fichaVoz.js";
import * as R from "../../src/modules/paiiaVoz/servicos/rascunhoRapido.js";
import { mesclarNovoAnuncio, rascunhoDaFicha } from "../../src/services/fichaNovoAnuncio.js";

const ler = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const img = (nome, n = 10) => new File([new Uint8Array(n)], nome, { type: "image/jpeg" });
const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
async function ate(cond, ms = 4000) { const t = Date.now(); while (Date.now() - t < ms) { if (await cond()) return true; await espera(10); } return false; }

/** "Banco" + "armazenamento" em memória, com as mesmas regras da salvarFichaNovoAnuncio. */
function contaFalsa() {
  const fichas = new Map();
  const arquivos = new Map();
  const c = { criadas: 0, gravacoes: 0, enviosOriginal: 0, enviosTratada: 0, falharOriginal: new Set() };
  let n = 0;
  const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
  return {
    c, fichas, arquivos,
    enviarOriginal: async (reg) => {
      if (c.falharOriginal.has(reg.nome)) throw new Error("sem internet");
      c.enviosOriginal++;
      const caminho = `u1/originais/${reg.id}-${reg.nome}`;
      arquivos.set(caminho, reg.blob);
      return { caminho, url: `https://arm/${caminho}` };
    },
    enviarTratada: async (reg) => {
      c.enviosTratada++;
      const caminho = `u1/prontas/1200x1200-voz-${reg.id}-${c.enviosTratada}.png`;
      arquivos.set(caminho, reg.tratada.blob);
      return { caminho, url: `https://arm/${caminho}` };
    },
    lerFicha: async (fichaId) => {
      const f = fichas.get(fichaId);
      return f ? { ok: true, ficha: structuredClone(f) } : { ok: false, naoEncontrada: true, erro: "Ficha não encontrada." };
    },
    salvarFicha: async ({ fichaId, codigo, titulo, montado, paiiaVoz }) => {
      c.gravacoes++;
      const agora = new Date(Date.now() + c.gravacoes).toISOString();
      if (fichaId) {
        const atual = fichas.get(fichaId);
        if (!atual) return { ok: false, fechada: true, excluida: true };
        if (["publicado", "cancelado"].includes(atual.status_fluxo)) return { ok: false, fechada: true };
        atual.dados_conferencia = mesclarNovoAnuncio(atual.dados_conferencia, montado, agora, { paiiaVoz });
        atual.titulo = titulo || atual.titulo;
        atual.codigo = codigo || atual.codigo;
        return { ok: true, fichaId, nova: false, salvoEm: agora };
      }
      if (!codigo) return { ok: false, erro: "Sem código" };
      c.criadas++;
      const novo = id();
      fichas.set(novo, { id: novo, codigo, titulo, status_fluxo: "rascunho", dados_conferencia: mesclarNovoAnuncio({}, montado, agora, { paiiaVoz }) });
      return { ok: true, fichaId: novo, nova: true, salvoEm: agora };
    },
  };
}

function celular() {
  const conta = contaFalsa();
  const guarda = G.criarGuardaFotos({ armazenamento: G.armazenamentoMemoria() });
  const deps = { usuarioId: "u1", guarda, enviarOriginal: conta.enviarOriginal, enviarTratada: conta.enviarTratada, lerFicha: conta.lerFicha, salvarFicha: conta.salvarFicha };
  let ficha = F.criarFichaVoz({ id: "voz-8563" });
  const voz = () => {
    const { dados } = R.mapearRapidoParaNovoAnuncio(ficha);
    return { fichaVozId: ficha.id, fichaIdPAIIA: ficha.fichaIdPAIIA || "", codigo: dados.codigo, titulo: R.estadoRapido(ficha).titulo.valor, descricao: dados.descricao, preco: dados.preco, oem: dados.oem };
  };
  const sinc = async () => {
    const r = await N.sincronizarFichaVoz(voz(), await guarda.listar(ficha.id), deps);
    if (r.ok) ficha = { ...ficha, fichaIdPAIIA: r.fichaIdPAIIA };
    return r;
  };
  return {
    conta, guarda, deps, sinc,
    get ficha() { return ficha; },
    set ficha(f) { ficha = { ...f, fichaIdPAIIA: ficha.fichaIdPAIIA || f.fichaIdPAIIA }; },
  };
}
const comCodigo = (f, cod) => F.aplicarInterpretacao(f, { itens: [{ campo: "codigoPrincipal", valor: cod }], naoEntendido: [], avisos: [] }, { origem: "digitado", textoOriginal: cod }).ficha;

test("sem código: nada sai do aparelho (fotos guardadas), nenhuma ficha criada", async () => {
  const cel = celular();
  await cel.guarda.adicionar(cel.ficha.id, [img("a.jpg")]);
  const r = await cel.sinc();
  assert.equal(r.estado, "aguardando-codigo");
  assert.equal(cel.conta.c.criadas, 0);
  assert.equal(cel.conta.c.enviosOriginal, 0);
  assert.equal((await cel.guarda.listar(cel.ficha.id)).length, 1, "foto continua no aparelho");
});

test("sem login: não grava nada e avisa", async () => {
  const cel = celular();
  cel.ficha = comCodigo(cel.ficha, "8563-71-305");
  const r = await N.sincronizarFichaVoz({ codigo: "8563-71-305" }, [], { ...cel.deps, usuarioId: "" });
  assert.equal(r.estado, "sem-login");
  assert.equal(cel.conta.c.gravacoes, 0);
});

test("FLUXO 8563-71-305: celular → ficha → computador (título formatado, originais, fundo branco, fotos no anúncio)", async () => {
  const cel = celular();
  // 1) celular: 3 fotos, código, título e descrição falados em minúsculas
  await cel.guarda.adicionar(cel.ficha.id, [img("frente.jpg", 11), img("lado.jpg", 12), img("etiqueta.jpg", 13)]);
  cel.ficha = comCodigo(cel.ficha, "8563-71-305");
  cel.ficha = R.definirTitulo(cel.ficha, "lanterna dianteira Cristal LED ônibus megaplus");
  cel.ficha = R.definirTextoDescricao(cel.ficha, "ônibus megaplus 12 e 24 volts\nlente cristal com led");
  assert.equal(R.estadoRapido(cel.ficha).titulo.valor, "Lanterna Dianteira Cristal LED Ônibus Megaplus", "E6: iniciais maiúsculas, LED preservado");

  // 2) primeira sincronização: cria UMA ficha e envia as 3 originais
  let r = await cel.sinc();
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(cel.conta.c.criadas, 1);
  assert.equal(cel.conta.c.enviosOriginal, 3);
  const id = r.fichaIdPAIIA;

  // 3) fundo branco (fila de sempre, executor real com Foto IA FALSO): reaproveita a original já enviada
  const cobradas = new Set();
  let enviosFotoIA = 0;
  const executar = IA.criarExecutorFotoIA({
    supabase: {}, usuarioId: "u1",
    enviarOriginalFotoIA: async () => { enviosFotoIA++; throw new Error("não deveria reenviar"); },
    recortarFotoIA: async ({ chave }) => { cobradas.add(chave); return { sucesso: true, recorteUrl: `https://x/${chave}.png` }; },
    comporFotoFinal: async () => ({ blob: new Blob([new Uint8Array(1200)], { type: "image/png" }) }),
    baixar: async () => new Blob([new Uint8Array(3)], { type: "image/png" }),
    garantirOriginal: (reg) => N.garantirOriginalNaNuvem(reg, cel.deps),
  });
  const fila = IA.criarFilaFotoIA({ guarda: cel.guarda, executar });
  await fila.enfileirarNovas(cel.ficha.id);
  assert.ok(await ate(async () => (await cel.guarda.listar(cel.ficha.id)).every((x) => x.ia?.estado === "pronta")), "3 fotos prontas");
  assert.equal(enviosFotoIA, 0, "nenhum envio duplicado da original");
  assert.equal(cobradas.size, 3, "cada foto tratada uma vez");
  const regs = await cel.guarda.listar(cel.ficha.id);
  assert.ok(regs.every((x) => x.versao === "tratada"), "fundo branco entra sozinho");
  assert.ok(regs.every((x) => x.blob.size >= 11), "originais intactas no aparelho");

  // 4) segunda sincronização: envia as 3 tratadas e troca na MESMA ficha (sem criar outra)
  r = await cel.sinc();
  assert.equal(r.ok, true);
  assert.equal(cel.conta.c.criadas, 1, "continua uma ficha só");
  assert.equal(cel.conta.c.enviosOriginal, 3, "originais não são reenviadas");
  assert.equal(cel.conta.c.enviosTratada, 3);
  // de novo, sem mudança: nada reenviado
  await cel.sinc();
  assert.equal(cel.conta.c.enviosOriginal + cel.conta.c.enviosTratada, 6, "sem envios desnecessários");

  // 5) computador: abre a ficha pela base (Central → Novo Anúncio)
  const row = (await cel.conta.lerFicha(id)).ficha;
  const rasc = rascunhoDaFicha(row);
  assert.equal(rasc.codigo, "8563-71-305");
  assert.equal(rasc.titulo, "Lanterna Dianteira Cristal LED Ônibus Megaplus");
  assert.ok(rasc.descricao.includes("12 E 24 Volts"), rasc.descricao);
  assert.equal(rasc.fotos.length, 3, "3 fotos no anúncio do computador");
  assert.ok(rasc.fotos.every((f) => /\/prontas\/1200x1200-voz-/.test(f.imagem_processada)), "versão com fundo branco");
  assert.equal(rasc.origemPaiiaVoz, "voz-8563");
  const meta = row.dados_conferencia.paiia_voz;
  assert.equal(meta.fotos.length, 3);
  assert.ok(meta.fotos.every((f) => /\/originais\//.test(f.original) && /\/prontas\//.test(f.tratada)), "originais preservadas e registradas na ficha");
  for (const f of meta.fotos) assert.ok(cel.conta.arquivos.has(f.original.replace("https://arm/", "")), "arquivo original guardado");
});

test("computador manda: título editado e foto retirada no computador não voltam pelo Voz", async () => {
  const cel = celular();
  await cel.guarda.adicionar(cel.ficha.id, [img("a.jpg"), img("b.jpg")]);
  cel.ficha = comCodigo(cel.ficha, "ABC123");
  cel.ficha = R.definirTitulo(cel.ficha, "farol direito");
  const { fichaIdPAIIA: id } = await cel.sinc();
  // no computador: troca o título e tira a 1ª foto (o Novo Anúncio grava novo_anuncio inteiro)
  const f = cel.conta.fichas.get(id);
  const na = f.dados_conferencia.novo_anuncio;
  f.dados_conferencia = mesclarNovoAnuncio(f.dados_conferencia, { novo_anuncio: { ...na, titulo: "Farol Direito Gol G5 - ABC123", fotos: na.fotos.slice(1) } });
  assert.ok(f.dados_conferencia.paiia_voz, "registro do Voz sobrevive à gravação do Novo Anúncio");
  // no celular: muda o título e sincroniza
  cel.ficha = R.definirTitulo(cel.ficha, "farol direito novo");
  const r = await cel.sinc();
  assert.deepEqual(r.conflitos, ["titulo"]);
  const depois = cel.conta.fichas.get(id).dados_conferencia.novo_anuncio;
  assert.equal(depois.titulo, "Farol Direito Gol G5 - ABC123", "fica o do computador");
  assert.equal(depois.fotos.length, 1, "a foto retirada no computador não volta");
});

test("falha de envio: nada se perde, as outras vão e a que falhou vai na próxima vez", async () => {
  const cel = celular();
  await cel.guarda.adicionar(cel.ficha.id, [img("ok.jpg"), img("ruim.jpg")]);
  cel.ficha = comCodigo(cel.ficha, "XYZ9");
  cel.conta.c.falharOriginal.add("ruim.jpg");
  let r = await cel.sinc();
  assert.equal(r.ok, true);
  assert.equal(r.erros.length, 1);
  assert.equal(cel.conta.fichas.get(r.fichaIdPAIIA).dados_conferencia.novo_anuncio.fotos.length, 1);
  assert.equal((await cel.guarda.listar(cel.ficha.id)).length, 2, "as duas continuam no aparelho");
  cel.conta.c.falharOriginal.clear();
  r = await cel.sinc();
  assert.equal(r.erros.length, 0);
  assert.equal(cel.conta.fichas.get(r.fichaIdPAIIA).dados_conferencia.novo_anuncio.fotos.length, 2);
  assert.equal(cel.conta.c.enviosOriginal, 2, "a que já tinha ido não foi reenviada");
});

test("fundo branco falhou: a original continua no anúncio; desmarcar no Voz tira só a foto do Voz", async () => {
  const cel = celular();
  await cel.guarda.adicionar(cel.ficha.id, [img("a.jpg"), img("b.jpg")]);
  cel.ficha = comCodigo(cel.ficha, "K1");
  const regs = await cel.guarda.listar(cel.ficha.id);
  await cel.guarda.salvarIA(regs[0].id, { estado: "falhou", erro: "Não foi possível recortar" });
  let r = await cel.sinc();
  const fotos = cel.conta.fichas.get(r.fichaIdPAIIA).dados_conferencia.novo_anuncio.fotos;
  assert.equal(fotos.length, 2);
  assert.ok(fotos.every((u) => /\/originais\//.test(u)));
  await cel.guarda.marcarUso(regs[1].id, false);
  r = await cel.sinc();
  assert.equal(cel.conta.fichas.get(r.fichaIdPAIIA).dados_conferencia.novo_anuncio.fotos.length, 1);
});

test("ficha na Conferência, publicada ou excluída: o Voz não altera", async () => {
  const cel = celular();
  cel.ficha = comCodigo(cel.ficha, "P1");
  const { fichaIdPAIIA: id } = await cel.sinc();
  const f = cel.conta.fichas.get(id);
  f.dados_conferencia = { ...f.dados_conferencia, etapa_fluxo: undefined, ficha: { campos: {} } };
  delete f.dados_conferencia.etapa_fluxo;
  const g0 = cel.conta.c.gravacoes;
  cel.ficha = R.definirTitulo(cel.ficha, "outro");
  assert.equal((await cel.sinc()).estado, "na-conferencia");
  assert.equal(cel.conta.c.gravacoes, g0, "nenhuma gravação");
  cel.conta.fichas.delete(id);
  assert.equal((await cel.sinc()).estado, "excluida");
  assert.equal(cel.conta.c.criadas, 1, "ficha excluída não é recriada");
});

test("duas sincronizações ao mesmo tempo: a original é enviada uma vez só", async () => {
  const cel = celular();
  await cel.guarda.adicionar(cel.ficha.id, [img("a.jpg")]);
  const [reg] = await cel.guarda.listar(cel.ficha.id);
  let envios = 0;
  const deps = { ...cel.deps, enviarOriginal: async (r) => { envios++; await espera(30); return cel.conta.enviarOriginal(r); } };
  await Promise.all([N.garantirOriginalNaNuvem(reg, deps), N.garantirOriginalNaNuvem(reg, deps), N.garantirOriginalNaNuvem(reg, deps)]);
  assert.equal(envios, 1);
});

test("simulação (modo teste): não chama o Foto IA/Replicate e marca a origem", async () => {
  const guarda = G.criarGuardaFotos({ armazenamento: G.armazenamentoMemoria() });
  await guarda.adicionar("S", [img("a.jpg")]);
  const fila = IA.criarFilaFotoIA({ guarda, executar: IA.criarExecutorSimulado({ compor: async () => new Blob([new Uint8Array(5)], { type: "image/png" }), espera: 1 }) });
  await fila.enfileirarNovas("S");
  assert.ok(await ate(async () => (await guarda.listar("S"))[0].ia?.estado === "pronta"));
  const [r] = await guarda.listar("S");
  assert.equal(r.tratada.origem, "simulacao");
  assert.equal(r.versao, "tratada");
});

test("você escolheu a original: o fundo branco pronto NÃO troca sozinho", async () => {
  const guarda = G.criarGuardaFotos({ armazenamento: G.armazenamentoMemoria() });
  await guarda.adicionar("M", [img("a.jpg")]);
  const [reg] = await guarda.listar("M");
  await guarda.escolherVersao(reg.id, "original");
  const fila = IA.criarFilaFotoIA({ guarda, executar: IA.criarExecutorSimulado({ compor: async () => new Blob([1]), espera: 1 }) });
  await fila.enfileirarNovas("M");
  assert.ok(await ate(async () => (await guarda.listar("M"))[0].ia?.estado === "pronta"));
  assert.equal((await guarda.listar("M"))[0].versao, "original");
});

test("trocar a foto zera o envio e o tratamento (a nova foto vai de novo, a antiga não é usada)", async () => {
  const cel = celular();
  await cel.guarda.adicionar(cel.ficha.id, [img("a.jpg")]);
  cel.ficha = comCodigo(cel.ficha, "T1");
  await cel.sinc();
  const [reg] = await cel.guarda.listar(cel.ficha.id);
  await cel.guarda.substituir(reg.id, img("b.jpg"));
  const [novo] = await cel.guarda.listar(cel.ficha.id);
  assert.equal(novo.nuvem, null);
  assert.equal(novo.ia, null);
});

test("regressão do código: Voz ligado à ficha, envio pela MESMA ficha, trava do modo real e E6 no caminho", () => {
  const tela = ler("src/modules/paiiaVoz/PaiiaVozRapido.jsx");
  assert.ok(tela.includes('import { sincronizarFichaVoz, garantirOriginalNaNuvem } from "./servicos/fichaVozNuvem";'));
  assert.ok(tela.includes("salvarFicha: salvarFichaNovoAnuncio"), "grava pela mesma função do Novo Anúncio");
  assert.ok(tela.includes("abrirFichaNoNovoAnuncio({ ...rasc, ...extra });"), "Enviar abre a MESMA ficha");
  assert.ok(/executar: modoIA === "real"\n\s+\? criarExecutorFotoIA\([^)]*garantirOriginal/.test(tela), "real reaproveita a original enviada");
  assert.ok(tela.includes(": criarExecutorSimulado(),"), "fora do modo real nada pago é chamado");
  assert.match(tela, /realLiberado: true/, "(10/11) recorte local grátis: fundo branco ligado em qualquer build");
  assert.ok(tela.includes("data-pr-na-conta="), "cada foto mostra se já está na ficha");
  assert.ok(!/from\("processamentos"\)|comporESalvarFotoIA/.test(tela), "não grava na Galeria");
  const servico = ler("src/modules/paiiaVoz/servicos/fichaVozNuvem.js");
  const codigoServico = servico.replace(/\/\/.*$/gm, "");
  assert.ok(!/supabase|\.from\(|\.rpc\(|storage|fetch\(|bling|mercadolivre/i.test(codigoServico), "sem acesso direto a banco/armazenamento/Bling/ML (só pelas funções de sempre)");
  const rr = ler("src/modules/paiiaVoz/servicos/rascunhoRapido.js");
  assert.ok(rr.includes("r.titulo = { valor: padronizarTitulo("), "E6 no título do Voz");
  assert.ok(rr.includes("texto: padronizarDescricao(String(texto"), "E6 na descrição do Voz");
  const fv = ler("src/modules/paiiaVoz/servicos/fichaVoz.js");
  assert.ok(fv.includes("return padronizarTitulo(t.slice(0, limite).trim());"), "E6 no título montado pela conversa");
});
