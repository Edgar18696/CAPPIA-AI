// =============================================================
// PAIIA — TESTES: tela "Escolher canais de publicação".
// Supabase FALSO em memória: nada vai para a base real, para o
// Mercado Livre, para o Bling, para a Shopee ou para o WooCommerce.
//   node --test scripts/testes/canaisPublicacao.test.mjs
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

register("./simulacao/ganchoSupabaseFalso.mjs", import.meta.url);

const { banco, zerarBanco, supabase } = await import("./simulacao/supabaseFalso.mjs");
const C = await import("../../src/services/canaisPublicacao.js");
const {
  salvarFichaAprovada, salvarRascunhoFicha, salvarContaDestino, registrarMLBPublicado, registrarCanaisPublicacao,
  obterAnuncio, CHAVES_PRESERVADAS_FICHA,
} = await import("../../src/services/anuncioPublicacaoService.js");
const { listarFichasCentral } = await import("../../src/services/fichasCentralService.js");
const { resumoFichaCentral, estadoFichaCentral, ESTADO_CENTRAL } = await import("../../src/services/fichasCentral.js");
const { registroPublicado } = await import("../../src/services/vinculoBlingPublicacao.js");

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ler = (rel) => fs.readFileSync(path.join(RAIZ, rel), "utf8").replace(/\r\n/g, "\n");

// Código fictício: nenhum produto real.
const COD = "TESTE-CANAIS-001";
const CONTA = "1729335019";
const linhas = () => banco.tabelas.paiia_anuncios;
const pubs = () => banco.tabelas.paiia_anuncios_publicacoes;
const dadosConf = () => ({ versao: 2, anuncio: { codigo: COD, titulo: "Peça teste" }, ficha: { campos: { quantidadeEstoque: "2" }, anuncioConferido: { codigo: COD }, assinaturaAprovada: "[x]", etapa: "publicacao" } });
async function fichaAprovada({ conta = false } = {}) {
  zerarBanco();
  const ap = await salvarFichaAprovada({ anuncioId: "", codigo: COD, titulo: "Peça teste", dadosConferencia: dadosConf() });
  assert.equal(ap.ok, true);
  if (conta) {
    const ct = await salvarContaDestino({ anuncioId: ap.anuncioId, codigo: COD, titulo: "Peça teste", contaId: CONTA, contaNome: "LOJA ONLINE" });
    assert.equal(ct.ok, true);
  }
  return ap.anuncioId;
}
async function central() {
  const r = await listarFichasCentral();
  assert.equal(r.ok, true);
  return r.fichas.map(resumoFichaCentral);
}
const ML = { mercado_livre: true, shopee: false, woocommerce: false };
const ML_SHOPEE = { mercado_livre: true, shopee: true, woocommerce: false };
const SO_OUTROS = { mercado_livre: false, shopee: true, woocommerce: true };
const SO_SITE = { mercado_livre: false, shopee: false, woocommerce: true };

test("1) regras puras: 3 canais, ML marcado por padrão, Shopee/Woo com integração pendente", () => {
  assert.deepEqual(C.CANAIS_PUBLICACAO.map((c) => c.id), ["mercado_livre", "shopee", "woocommerce"]);
  assert.deepEqual(C.CANAIS_PUBLICACAO.map((c) => c.nome), ["Mercado Livre", "Shopee", "Site próprio — WooCommerce"]);
  assert.deepEqual(C.selecaoPadrao(), ML);
  assert.equal(C.CANAIS_PUBLICACAO.find((c) => c.id === "shopee").situacao, C.SITUACAO_CANAL.INTEGRACAO_PENDENTE);
  assert.equal(C.CANAIS_PUBLICACAO.find((c) => c.id === "woocommerce").situacao, C.SITUACAO_CANAL.INTEGRACAO_PENDENTE);
  assert.equal(C.CANAIS_PUBLICACAO.find((c) => c.id === "mercado_livre").situacao, C.SITUACAO_CANAL.DISPONIVEL);
  // Um, dois ou todos; canal desconhecido é ignorado; nenhum = erro.
  assert.deepEqual(C.canaisSelecionados({ ...SO_SITE, amazon: true }), ["woocommerce"]);
  assert.deepEqual(C.canaisSelecionados({ mercado_livre: true, shopee: true, woocommerce: true }), ["mercado_livre", "shopee", "woocommerce"]);
  assert.equal(C.erroSelecao({}), "Marque pelo menos um canal de publicação.");
  assert.equal(C.erroSelecao(SO_SITE), "");
  assert.equal(C.situacaoDaSelecao(ML_SHOPEE), C.SITUACAO_CANAIS.MERCADO_LIVRE);
  assert.equal(C.situacaoDaSelecao(SO_OUTROS), C.SITUACAO_CANAIS.AGUARDANDO_INTEGRACAO);
  assert.equal(C.resumoCanais(ML_SHOPEE), "Mercado Livre · Shopee (Integração pendente)");
});

test("2) registro: preço/frete/regras reservados (null) e mantidos se já existirem", () => {
  const r = C.montarRegistroCanais(ML_SHOPEE, null, "2026-10-15T10:00:00.000Z");
  assert.equal(r.versao, 1);
  assert.deepEqual(r.selecionados, ["mercado_livre", "shopee"]);
  assert.equal(r.situacao, "mercado_livre");
  assert.deepEqual(r.canais.shopee, { selecionado: true, situacao: "integracao_pendente", preco: null, frete: null, regras: null });
  assert.equal(r.canais.woocommerce.selecionado, false);
  const futuro = { ...r, canais: { ...r.canais, shopee: { ...r.canais.shopee, preco: 199.9 } } };
  const r2 = C.montarRegistroCanais(SO_OUTROS, futuro);
  assert.equal(r2.canais.shopee.preco, 199.9, "valor futuro de preço não se perde ao trocar canais");
  assert.equal(C.registroCanaisValido(r2), true);
  assert.equal(C.registroCanaisValido({ versao: 1, canais: {} }), false, "registro sem canal marcado não vale");
  assert.equal(C.fichaAguardandoIntegracao(r2), true);
  assert.equal(C.fichaAguardandoIntegracao(r), false);
  assert.equal(C.fichaAguardandoIntegracao(null), false, "ficha antiga, sem registro: não muda de situação");
  assert.equal(C.mercadoLivreEscolhido(null), true, "ficha antiga, sem registro: ML como hoje");
});

test("3) como a tela abre: nova/antiga, salva com ML, salva sem ML, publicada, sem ID", () => {
  const M = C.MODO_CANAIS;
  assert.deepEqual(C.modoInicialCanais({ temId: false }), { modo: M.SEM_FICHA, selecao: ML, liberarML: true });
  const antiga = { status_fluxo: "conferencia_aprovada", dados_conferencia: dadosConf() };
  assert.deepEqual(C.modoInicialCanais({ temId: true, anuncio: antiga }), { modo: M.ESCOLHENDO, selecao: ML, liberarML: false });
  const comML = { ...antiga, dados_conferencia: { ...dadosConf(), canais_publicacao: C.montarRegistroCanais(ML_SHOPEE) } };
  assert.deepEqual(C.modoInicialCanais({ temId: true, anuncio: comML }), { modo: M.RESUMO, selecao: ML_SHOPEE, liberarML: true });
  const semML = { ...antiga, dados_conferencia: { ...dadosConf(), canais_publicacao: C.montarRegistroCanais(SO_OUTROS) } };
  assert.deepEqual(C.modoInicialCanais({ temId: true, anuncio: semML }), { modo: M.AGUARDANDO, selecao: SO_OUTROS, liberarML: false });
  for (const st of ["publicando", "publicado", "publicado_com_pendencia", "cancelado"]) {
    assert.equal(C.modoInicialCanais({ temId: true, anuncio: { ...semML, status_fluxo: st } }).modo, M.FECHADA, st);
    assert.equal(C.modoInicialCanais({ temId: true, anuncio: { ...semML, status_fluxo: st } }).liberarML, true, "publicada: Publicação do ML como hoje");
  }
  assert.equal(C.modoInicialCanais({ temId: true, anuncio: antiga, publicada: true }).modo, M.FECHADA);
});

test("4) ML + Shopee: grava na ficha, F5 recupera, situação da ficha e conta NÃO mudam", async () => {
  const id = await fichaAprovada({ conta: true });
  const antes = JSON.parse(JSON.stringify(linhas()[0]));
  const pubAntes = JSON.stringify(pubs());
  const r = await registrarCanaisPublicacao({ anuncioId: id, selecao: ML_SHOPEE });
  assert.equal(r.ok, true, r.erro);
  const l = linhas()[0];
  assert.equal(linhas().length, 1, "não cria outra ficha");
  assert.equal(l.status_fluxo, antes.status_fluxo);
  assert.equal(l.conta_destino_ml_user_id, CONTA, "conta ML intacta");
  assert.equal(JSON.stringify(pubs()), pubAntes, "publicação/MLB/Bling/estoque intactos");
  const { canais_publicacao, ...resto } = l.dados_conferencia;
  assert.deepEqual(resto, antes.dados_conferencia, "nenhum outro dado da ficha muda");
  assert.deepEqual(canais_publicacao.selecionados, ["mercado_livre", "shopee"]);
  // F5: lê da base e abre no mesmo lugar.
  const f5 = await obterAnuncio(id);
  assert.deepEqual(C.selecaoInicial(f5.anuncio.dados_conferencia), ML_SHOPEE);
  assert.equal(C.modoInicialCanais({ temId: true, anuncio: f5.anuncio }).modo, C.MODO_CANAIS.RESUMO);
  const [f] = await central();
  assert.equal(f.estado, ESTADO_CENTRAL.PRONTO_PUBLICAR, "com ML continua Pronto para publicar");
  assert.equal(f.canais, "Mercado Livre · Shopee (Integração pendente)");
});

test("5) só Shopee e/ou WooCommerce: Aguardando integração, sem nenhuma publicação", async () => {
  for (const sel of [SO_OUTROS, SO_SITE, { mercado_livre: false, shopee: true, woocommerce: false }]) {
    const id = await fichaAprovada({ conta: true });
    banco.funcoes.length = 0;
    const r = await registrarCanaisPublicacao({ anuncioId: id, selecao: sel });
    assert.equal(r.ok, true, r.erro);
    assert.equal(banco.funcoes.length, 0, "nenhuma função (ML/Bling/Shopee/Woo) é chamada");
    assert.equal(linhas()[0].status_fluxo, "conferencia_aprovada", "status no banco não muda (sem SQL novo)");
    assert.equal(linhas()[0].conta_destino_ml_user_id, CONTA, "conta ML não é apagada");
    const [f] = await central();
    assert.equal(f.estado, ESTADO_CENTRAL.AGUARDANDO_INTEGRACAO);
    assert.equal(f.texto, "Aguardando integração");
    assert.notEqual(f.estado, ESTADO_CENTRAL.PRONTO_PUBLICAR, "não aparece pronta para o ML");
    const f5 = await obterAnuncio(id);
    assert.equal(C.modoInicialCanais({ temId: true, anuncio: f5.anuncio }).liberarML, false, "Publicação do ML não abre");
  }
  // Voltar a marcar ML: volta a Pronto para publicar.
  const id = linhas()[0].id;
  assert.equal((await registrarCanaisPublicacao({ anuncioId: id, selecao: ML })).ok, true);
  assert.equal((await central())[0].estado, ESTADO_CENTRAL.PRONTO_PUBLICAR);
});

test("6) nenhum canal marcado: recusado e nada gravado", async () => {
  const id = await fichaAprovada();
  const antes = JSON.stringify(linhas()[0]);
  const r = await registrarCanaisPublicacao({ anuncioId: id, selecao: { mercado_livre: false, shopee: false, woocommerce: false } });
  assert.equal(r.ok, false);
  assert.equal(JSON.stringify(linhas()[0]), antes);
  assert.equal((await registrarCanaisPublicacao({ anuncioId: "", selecao: ML })).ok, false, "sem ID não grava");
});

test("7) as outras gravações da ficha não apagam a escolha dos canais", async () => {
  assert.ok(CHAVES_PRESERVADAS_FICHA.includes("canais_publicacao"));
  const id = await fichaAprovada({ conta: true });
  await registrarCanaisPublicacao({ anuncioId: id, selecao: SO_OUTROS });
  const versao = linhas()[0].dados_conferencia.salvo_em;
  const ap = await salvarFichaAprovada({ anuncioId: id, codigo: COD, titulo: "Peça teste", dadosConferencia: dadosConf(), versaoEsperada: versao });
  assert.equal(ap.ok, true, ap.erro);
  assert.deepEqual(linhas()[0].dados_conferencia.canais_publicacao.selecionados, ["shopee", "woocommerce"], "aprovação de novo preserva");
  const rs = await salvarRascunhoFicha({ anuncioId: id, codigo: COD, titulo: "Peça teste", dadosConferencia: { ...dadosConf(), salvo_em: linhas()[0].dados_conferencia.salvo_em }, versaoEsperada: linhas()[0].dados_conferencia.salvo_em });
  assert.equal(rs.ok, true, rs.erro);
  assert.deepEqual(linhas()[0].dados_conferencia.canais_publicacao.selecionados, ["shopee", "woocommerce"], "rascunho da Conferência preserva");
  // Voltou a editar a Conferência: precisa reaprovar (não fica 'Aguardando integração' antes disso).
  assert.equal((await central())[0].estado, ESTADO_CENTRAL.AGUARDANDO_CONFERENCIA);
});

test("8) ficha publicada: canais não mudam e nada da publicação é tocado", async () => {
  const id = await fichaAprovada({ conta: true });
  const reg = registroPublicado({ mlb: "MLB9999999999", contaId: CONTA, skuOficial: COD, produtoBlingId: "1", preco: 10 });
  await registrarMLBPublicado({ anuncioId: id, contaId: CONTA, mlb: "MLB9999999999", sku: COD, registro: reg });
  const antes = JSON.stringify({ a: linhas(), p: pubs() });
  const r = await registrarCanaisPublicacao({ anuncioId: id, selecao: SO_OUTROS });
  assert.equal(r.ok, false);
  assert.equal(r.fechada, true);
  assert.equal(JSON.stringify({ a: linhas(), p: pubs() }), antes, "ficha publicada intacta");
  const [f] = await central();
  assert.notEqual(f.estado, ESTADO_CENTRAL.AGUARDANDO_INTEGRACAO);
  // Mesmo com registro sem ML gravado antes, publicada continua publicada.
  assert.equal(estadoFichaCentral({ status_fluxo: "publicado", publicacao: { mlb_id: "MLB1" }, canais: C.montarRegistroCanais(SO_OUTROS) }), ESTADO_CENTRAL.PUBLICADO);
});

test("9) última publicação com erro: não deixa tirar o Mercado Livre", async () => {
  const id = await fichaAprovada({ conta: true });
  linhas()[0].status_fluxo = "erro_publicacao";
  const antes = JSON.stringify(linhas()[0]);
  const r = await registrarCanaisPublicacao({ anuncioId: id, selecao: SO_OUTROS });
  assert.equal(r.ok, false);
  assert.match(r.erro, /Confira o resultado no Mercado Livre/);
  assert.equal(JSON.stringify(linhas()[0]), antes);
  assert.equal((await registrarCanaisPublicacao({ anuncioId: id, selecao: ML_SHOPEE })).ok, true, "manter o ML continua permitido");
  assert.equal(estadoFichaCentral({ status_fluxo: "erro_publicacao", conta_destino_ml_user_id: CONTA, canais: C.montarRegistroCanais(SO_OUTROS) }), ESTADO_CENTRAL.PRONTO_PUBLICAR, "erro de publicação nunca é escondido");
});

test("10) ficha alterada ao mesmo tempo (outra aba): não sobrescreve", async () => {
  const id = await fichaAprovada();
  const original = supabase.from;
  supabase.from = (t) => {
    const q = original(t);
    const upd = q.update.bind(q);
    q.update = (d) => {
      // Outra aba grava a ficha entre a leitura e a gravação.
      linhas()[0].updated_at = "2099-01-01T00:00:00.000Z";
      linhas()[0].dados_conferencia = { ...linhas()[0].dados_conferencia, mudanca_outra_aba: true };
      return upd(d);
    };
    return q;
  };
  try {
    const r = await registrarCanaisPublicacao({ anuncioId: id, selecao: SO_OUTROS });
    assert.equal(r.ok, false);
    assert.match(r.erro, /mudou ao mesmo tempo/);
    assert.equal(linhas()[0].dados_conferencia.mudanca_outra_aba, true, "gravação da outra aba preservada");
    assert.equal(linhas()[0].dados_conferencia.canais_publicacao, undefined);
  } finally {
    supabase.from = original;
  }
});

test("11) tela e Conferência: ML continua o mesmo fluxo; Shopee/Woo não chamam nada", () => {
  const tela = ler("src/components/EscolherCanaisPublicacao.jsx");
  const regras = ler("src/services/canaisPublicacao.js");
  assert.equal(/functions\.invoke|fetch\(|chamarPublicacaoML|bling|shopee\.com|wp-json|woocommerce\/v/i.test(tela.replace(/Bling/g, "")), false, "a tela não chama integração");
  assert.equal(/import/.test(regras), false, "regras puras: sem rede");
  assert.ok(tela.includes("Escolher canais de publicação"));
  assert.ok(tela.includes("TEXTO_INTEGRACAO_PENDENTE"));
  const mlt = ler("src/components/MercadoLivreTeste.jsx");
  assert.ok(mlt.includes("✅ Finalizar e escolher canais"));
  assert.equal(mlt.includes("✅ Finalizar e escolher conta"), false);
  // A Publicação do ML só aparece liberada pela tela de canais — e com as MESMAS props de antes.
  assert.ok(mlt.includes("{mercadoLivreLiberado && (\n            <RevisaoPublicacaoML"));
  // A Publicação do ML em si não foi modificada para isto.
  assert.equal(ler("src/components/RevisaoPublicacaoML.jsx").includes("canais_publicacao"), false);
});
