// =============================================================
// PAIIA — TESTES: ficha persistente DESDE o Novo Anúncio (mesma ficha
// até a publicação). Simulação com Supabase FALSO em memória: nada vai
// para a base real, para o Mercado Livre ou para o Bling.
//   node --test scripts/testes/fichaNovoAnuncio.test.mjs
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

register("./simulacao/ganchoSupabaseFalso.mjs", import.meta.url);

// Navegador de mentira (localStorage + endereço).
class Armazenamento {
  constructor() { this.m = new Map(); }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
  get length() { return this.m.size; }
}
globalThis.localStorage = new Armazenamento();
globalThis.window = { location: { href: "https://www.paiia.com.br/", search: "" }, history: { state: null, replaceState() {} } };

const { banco, zerarBanco } = await import("./simulacao/supabaseFalso.mjs");
const {
  podeCriarFicha, fichaCompleta, montarNovoAnuncioParaFicha, mesclarNovoAnuncio, fichaFechada,
  rascunhoDaFicha, fichaSoNoNovoAnuncio, ETAPA_NOVO_ANUNCIO,
} = await import("../../src/services/fichaNovoAnuncio.js");
const { salvarFichaNovoAnuncio, lerFichaNovoAnuncio } = await import("../../src/services/fichaNovoAnuncioService.js");
const { listarFichasCentral } = await import("../../src/services/fichasCentralService.js");
const {
  salvarRascunhoFicha, salvarFichaAprovada, salvarContaDestino, registrarMLBPublicado, obterAnuncio, publicacaoExiste,
} = await import("../../src/services/anuncioPublicacaoService.js");
const {
  resumoFichaCentral, ESTADO_CENTRAL, guardarAnuncioEmAndamento, lerAnuncioEmAndamento, rascunhoLocalJaNaBase, telaInicialDoEndereco,
} = await import("../../src/services/fichasCentral.js");
const { prepararNovaCriacaoMidia } = await import("../../src/services/limparEstadoTemporarioMidia.js");
const { registroPublicado } = await import("../../src/services/vinculoBlingPublicacao.js");
const { fichaDoNovoAnuncioAoAbrir, fichaDoRascunhoLocal } = await import("../../src/hooks/useFichaNovoAnuncio.js");

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ler = (rel) => fs.readFileSync(path.join(RAIZ, rel), "utf8").replace(/\r\n/g, "\n");

const PARCIAL = { codigo: "8200030640", titulo: "Sensor Renault 8200030640", preco: "", descricao: "", fotos: [] };
const COMPLETO = {
  ...PARCIAL, descricao: "Sensor original de reposição...", preco: "149,90", tipoAnuncio: "classico",
  pecaEncontrada: { peca: "Sensor", fabricante: "Renault", categoria_nome: "Sensores", aplicacoes: [{ montadora: "RENAULT", modelo: "Clio", ano_inicio: 2003, ano_fim: 2012 }] },
  fotos: [{ imagem_processada: "https://x/foto1.png" }, { imagem_processada: "data:image/png;base64,AAAA" }],
  embalagem: { pesoFreteML: "0.2", alturaFreteML: "5", larguraFreteML: "8", comprimentoFreteML: "10" },
  precificacao: { custo: "60" },
};
const linhas = () => banco.tabelas.paiia_anuncios;
async function central() {
  const r = await listarFichasCentral();
  assert.equal(r.ok, true);
  return r.fichas.map(resumoFichaCentral);
}

test("0) regras puras: quando criar, completa, sem imagem embutida", () => {
  assert.equal(podeCriarFicha({ codigo: "8200030640" }), false, "só o código digitado ainda não cria");
  assert.equal(podeCriarFicha(PARCIAL), true);
  assert.equal(podeCriarFicha({ titulo: "x" }), false, "sem código/OEM não cria");
  assert.equal(fichaCompleta(PARCIAL), false);
  assert.equal(fichaCompleta(COMPLETO), true);
  const m = montarNovoAnuncioParaFicha(COMPLETO);
  assert.deepEqual(m.anuncio.fotos, ["https://x/foto1.png"], "base64 não vai para a ficha");
  assert.equal(m.novo_anuncio.embalagem.pesoFreteML, "0.2");
  assert.equal(m.novo_anuncio.marca, "Renault");
  assert.equal(m.novo_anuncio.categoria, "Sensores");
  assert.equal(m.novo_anuncio.completa, true);
});

test("1) começar e preencher só parte → F5 → recupera da base (mesma ficha)", async () => {
  zerarBanco();
  const r = await salvarFichaNovoAnuncio({ fichaId: "", codigo: PARCIAL.codigo, titulo: PARCIAL.titulo, montado: montarNovoAnuncioParaFicha(PARCIAL) });
  assert.equal(r.ok, true); assert.equal(r.nova, true);
  const id = r.fichaId;
  assert.equal(linhas().length, 1);
  assert.equal(linhas()[0].status_fluxo, "rascunho");
  assert.equal(linhas()[0].dados_conferencia.etapa_fluxo, ETAPA_NOVO_ANUNCIO);
  // Mais digitação: MESMA ficha.
  const r2 = await salvarFichaNovoAnuncio({ fichaId: id, codigo: PARCIAL.codigo, titulo: PARCIAL.titulo, montado: montarNovoAnuncioParaFicha({ ...PARCIAL, preco: "149,90" }) });
  assert.equal(r2.fichaId, id); assert.equal(linhas().length, 1);
  // F5 em outro navegador: lê a base e monta o rascunho.
  const lido = await lerFichaNovoAnuncio(id);
  assert.equal(fichaSoNoNovoAnuncio(lido.ficha), true);
  const rasc = rascunhoDaFicha(lido.ficha);
  assert.equal(rasc.fichaId, id);
  assert.equal(rasc.titulo, PARCIAL.titulo);
  assert.equal(rasc.preco, "149,90");
  // Navegador com o rascunho desta ficha → o Novo Anúncio reabre nela.
  localStorage.setItem("novoAnuncioTemporario", JSON.stringify({ ...rasc, fichaIdPAIIA: id }));
  assert.equal(fichaDoRascunhoLocal(), id);
  assert.equal(fichaDoNovoAnuncioAoAbrir().id, id);
  assert.equal(telaInicialDoEndereco(`?tela=novoAnuncio&ficha=${id}`, "home", { fichaNovoAnuncioLocal: id }), "novoAnuncio");
});

test("2) começar → Home → Central: a ficha aparece como Em andamento", async () => {
  zerarBanco();
  globalThis.localStorage = new Armazenamento();
  const r = await salvarFichaNovoAnuncio({ codigo: PARCIAL.codigo, titulo: PARCIAL.titulo, montado: montarNovoAnuncioParaFicha(PARCIAL) });
  localStorage.setItem("rascunhoNovoAnuncioTemp", JSON.stringify({ ...PARCIAL, fichaIdPAIIA: r.fichaId }));
  // Home: guarda e limpa (criação nova).
  guardarAnuncioEmAndamento(localStorage);
  prepararNovaCriacaoMidia();
  assert.equal(localStorage.getItem("rascunhoNovoAnuncioTemp"), null);
  const fichas = await central();
  assert.equal(fichas.length, 1);
  assert.equal(fichas[0].estado, ESTADO_CENTRAL.EM_ANDAMENTO);
  assert.equal(fichas[0].noNovoAnuncio, true);
  assert.equal(fichas[0].completa, false);
  // O rascunho local guardado é a MESMA ficha: não aparece duas vezes.
  assert.equal(rascunhoLocalJaNaBase(lerAnuncioEmAndamento(localStorage), fichas), true);
  // Completa → "Aguardando Conferência".
  await salvarFichaNovoAnuncio({ fichaId: r.fichaId, codigo: COMPLETO.codigo, titulo: COMPLETO.titulo, montado: montarNovoAnuncioParaFicha(COMPLETO) });
  assert.equal((await central())[0].estado, ESTADO_CENTRAL.AGUARDANDO_CONFERENCIA);
});

test("3) fechar/reabrir pelo ?ficha= em outro navegador → recupera", async () => {
  zerarBanco();
  globalThis.localStorage = new Armazenamento();
  const r = await salvarFichaNovoAnuncio({ codigo: COMPLETO.codigo, titulo: COMPLETO.titulo, montado: montarNovoAnuncioParaFicha(COMPLETO) });
  // Sem o rascunho local desta ficha: abre pela BASE (wrapper da ficha).
  assert.equal(telaInicialDoEndereco(`?tela=novoAnuncio&ficha=${r.fichaId}`, "home", { fichaNovoAnuncioLocal: "" }), "mercadoLivreTeste");
  const base = await obterAnuncio(r.fichaId);
  assert.equal(base.ok, true);
  assert.equal(fichaSoNoNovoAnuncio(base.anuncio), true, "volta para o Novo Anúncio");
  const rasc = rascunhoDaFicha(base.anuncio);
  assert.equal(rasc.descricao, COMPLETO.descricao);
  assert.equal(rasc.fotos[0].imagem_processada, "https://x/foto1.png");
  // peso volta em kg com vírgula (0,2 kg = 200 g), a partir da medida da ficha
  assert.equal(rasc.pesoFreteML, "0,2", "peso/medidas voltam");
  assert.equal(rasc.custo, "60");
  const mlt = ler("src/components/MercadoLivreTeste.jsx");
  assert.ok(/fichaSoNoNovoAnuncio\(r\.anuncio\)[\s\S]{0,1600}props\.setScreen\?\.\("novoAnuncio"\)/.test(mlt), "wrapper devolve ao Novo Anúncio");
});

test("4–6) parcial → continuar → Conferência → voltar → publicação: SEMPRE a mesma ficha", async () => {
  zerarBanco();
  const r = await salvarFichaNovoAnuncio({ codigo: PARCIAL.codigo, titulo: PARCIAL.titulo, montado: montarNovoAnuncioParaFicha(PARCIAL) });
  const id = r.fichaId;
  await salvarFichaNovoAnuncio({ fichaId: id, codigo: COMPLETO.codigo, titulo: COMPLETO.titulo, montado: montarNovoAnuncioParaFicha(COMPLETO) });
  // Conferência abre com o ID do Novo Anúncio e grava o rascunho DELA na mesma ficha.
  const dadosConf = { versao: 3, salvo_em: "2026-10-07T20:00:00.000Z", anuncio: { codigo: COMPLETO.codigo }, ficha: { campos: { titulo: COMPLETO.titulo, tipoVeiculo: "Carro/Caminhonete", tipoVeiculoOrigem: "manual", quantidadeEstoque: "3" }, etapa: "conferencia" } };
  const c1 = await salvarRascunhoFicha({ anuncioId: id, codigo: COMPLETO.codigo, titulo: COMPLETO.titulo, dadosConferencia: dadosConf, criarSeFechada: false, versaoEsperada: "" });
  assert.equal(c1.ok, true); assert.equal(c1.anuncioId, id); assert.equal(c1.nova, false);
  assert.equal(linhas().length, 1, "Conferência não cria outra ficha");
  assert.ok(linhas()[0].dados_conferencia.novo_anuncio, "dados do Novo Anúncio preservados");
  assert.equal((await central())[0].estado, ESTADO_CENTRAL.AGUARDANDO_CONFERENCIA);
  // Conferência → voltar ao Novo Anúncio → editar: mesma ficha, Conferência intacta.
  const v = await salvarFichaNovoAnuncio({ fichaId: id, codigo: COMPLETO.codigo, titulo: COMPLETO.titulo, montado: montarNovoAnuncioParaFicha({ ...COMPLETO, preco: "159,90" }) });
  assert.equal(v.fichaId, id); assert.equal(linhas().length, 1);
  const d = linhas()[0].dados_conferencia;
  assert.equal(d.ficha.campos.tipoVeiculo, "Carro/Caminhonete", "campos da Conferência não somem");
  assert.equal(d.ficha.campos.quantidadeEstoque, "3");
  assert.equal(d.salvo_em, "2026-10-07T20:00:00.000Z", "versão da Conferência intacta (sem conflito)");
  assert.equal(d.novo_anuncio.preco, "159,90");
  assert.equal(d.etapa_fluxo, undefined);
  // Conferência aprovada → conta → publicação: MESMA ficha recebe o MLB.
  const ap = await salvarFichaAprovada({ anuncioId: id, codigo: COMPLETO.codigo, titulo: COMPLETO.titulo, dadosConferencia: { ...dadosConf, ficha: { ...dadosConf.ficha, anuncioConferido: { codigo: COMPLETO.codigo }, assinaturaAprovada: "[x]", etapa: "publicacao" } }, versaoEsperada: "2026-10-07T20:00:00.000Z" });
  assert.equal(ap.anuncioId, id);
  assert.ok(linhas()[0].dados_conferencia.novo_anuncio, "aprovação preserva o Novo Anúncio");
  const ct = await salvarContaDestino({ anuncioId: id, codigo: COMPLETO.codigo, titulo: COMPLETO.titulo, contaId: "1729335019", contaNome: "LOJA ONLINE" });
  assert.equal(ct.anuncioId, id);
  assert.equal((await central())[0].estado, ESTADO_CENTRAL.PRONTO_PUBLICAR);
  const reg = registroPublicado({ mlb: "MLB9999999999", contaId: "1729335019", skuOficial: COMPLETO.codigo, produtoBlingId: "16715641958", preco: 159.9 });
  await registrarMLBPublicado({ anuncioId: id, contaId: "1729335019", mlb: "MLB9999999999", sku: COMPLETO.codigo, registro: reg });
  assert.equal(linhas().length, 1, "publicação não cria outra ficha");
  assert.equal(banco.tabelas.paiia_anuncios_publicacoes.length, 1);
  const pub = await obterAnuncio(id);
  assert.equal(pub.anuncio.publicacao.mlb_id, "MLB9999999999");
  assert.equal(publicacaoExiste(pub.anuncio.publicacao), true);
  assert.equal((await central())[0].estado, ESTADO_CENTRAL.AGUARDANDO_BLING);

  // 7) F5 depois da publicação: o Novo Anúncio NÃO altera a ficha publicada e nada republica.
  assert.equal(fichaFechada(pub.anuncio), true);
  const antes = JSON.stringify(linhas()[0]);
  const f5 = await salvarFichaNovoAnuncio({ fichaId: id, codigo: COMPLETO.codigo, titulo: "outro", montado: montarNovoAnuncioParaFicha({ ...COMPLETO, preco: "1" }) });
  assert.equal(f5.ok, false); assert.equal(f5.fechada, true);
  assert.equal(JSON.stringify(linhas()[0]), antes, "ficha publicada intacta");
  assert.equal(linhas().length, 1, "não cria ficha nova em silêncio");

  // 8) Nenhuma gravação fora da ficha operacional; nenhuma função (ML/Bling) chamada.
  const tabelas = [...new Set(banco.chamadas.map((c) => c.tabela))].sort();
  assert.deepEqual(tabelas, ["paiia_anuncios", "paiia_anuncios_publicacoes"]);
  assert.equal(banco.chamadas.some((c) => c.op === "delete"), false);
  assert.deepEqual(banco.funcoes, [], "nem Mercado Livre nem Bling foram chamados");
});

test("8b) salvar a ficha nunca grava na base de conhecimento (código)", () => {
  for (const arq of ["src/services/fichaNovoAnuncio.js", "src/services/fichaNovoAnuncioService.js", "src/hooks/useFichaNovoAnuncio.js"]) {
    const t = ler(arq).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    assert.equal(/catalogo_pecas|paiia_conhecimento_validado|catalogo-escrita|functions\.invoke|mercadolivre-|bling-integracao/.test(t), false, arq);
  }
  const svc = ler("src/services/fichaNovoAnuncioService.js");
  assert.equal((svc.match(/\.from\(/g) || []).length, 3, "só paiia_anuncios");
  assert.ok(/const T = "paiia_anuncios";/.test(svc));
});

test("9) mesclar nunca apaga o que é de outras etapas", () => {
  const atuais = { salvo_em: "v1", ficha: { campos: { a: 1 } }, integracao_bling: { estado: "aguardando_importacao", mlb: "MLB1234567" }, base_paiia: { decisao: "nao_salvar" }, anuncio: { aplicacoes: [1], codigo: "X" } };
  const m = mesclarNovoAnuncio(atuais, montarNovoAnuncioParaFicha(COMPLETO), "t");
  assert.equal(m.salvo_em, "v1");
  assert.deepEqual(m.ficha, atuais.ficha);
  assert.deepEqual(m.integracao_bling, atuais.integracao_bling);
  assert.deepEqual(m.base_paiia, atuais.base_paiia);
  assert.equal(m.novo_anuncio.salvo_em, "t");
  assert.equal(m.anuncio.codigo, COMPLETO.codigo);
  assert.equal(m.etapa_fluxo, undefined, "já tem Conferência");
});

test("10) Novo Anúncio: código novo = ficha nova; mesmo código = mesma ficha; Continuar grava antes", () => {
  const na = ler("src/components/NovoAnuncio.jsx");
  assert.ok(/if \(!fichaNovo\.fichaServeParaCodigo\(codigoFinal\)\) \{\s*fichaNovo\.novaFicha\(\);/.test(na));
  const cont = na.slice(na.indexOf("async function continuarParaPublicacao()"), na.indexOf("function recuperarRascunho()"));
  assert.ok(cont.indexOf("await fichaNovo.salvarAgora()") < cont.indexOf('"anuncioProntoPublicacao"'));
  assert.ok(cont.includes("fichaIdPAIIA: fichaIdAtual"));
  assert.ok(na.includes("fichaIdPAIIA: fichaNovo.fichaId"), "rascunho do navegador guarda o ID da ficha");
  const conf = ler("src/components/MercadoLivreTeste.jsx");
  assert.ok(conf.includes('String(fichaSalva?.campos?.anuncioIdPAIIA || fichaIdDoAnuncio || "")'), "Conferência continua na ficha do Novo Anúncio");
  const cen = ler("src/components/CentralPublicacao.jsx");
  assert.equal((cen.match(/fichaIdPAIIA:/g) || []).length, 4, "Central leva o ID em todos os caminhos");
});
