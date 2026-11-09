// (10/11) SKU 39038558 / MLB5535014431: ficha JÁ publicada voltava a rodar a publicação automática
// ("Continuar" na Central herdava o ?auto= da rodada anterior), parava em "Publicação" e a Central
// mostrava "pronta para publicar". Agora: o MLB da ficha é reconhecido e nada é publicado de novo.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { register } from "node:module";
register("./simulacao/ganchoSupabaseFalso.mjs", import.meta.url);
const { banco, zerarBanco } = await import("./simulacao/supabaseFalso.mjs");
const { executarPiloto, mlbRegistradoDaFicha } = await import("../../src/services/pilotoPublicacao.js");
const { fichaJaPublicada, estadoFichaCentral, resumoFichaCentral, enderecoDaFicha, ESTADO_CENTRAL } = await import("../../src/services/fichasCentral.js");
const S = await import("../../src/services/anuncioPublicacaoService.js");
const ler = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const MLB = "MLB5535014431";
const L = { passo: 100, intervalo: 5, estavel: 3, ativo: 60, vinculo: 60, intervaloML: 5 };

function tela({ mlbJa = { mlb: "" }, integrado = false, item = { status: "active" } } = {}) {
  const s = { cliques: [], etapas: [], publicados: [], consultas: 0, leiturasVinculo: 0 };
  const el = (attrs = {}) => ({ disabled: false, checked: false, attrs, hasAttribute: (a) => a in attrs, getAttribute: (a) => attrs[a] ?? null });
  const p = {
    mlbJaPublicado: typeof mlbJa === "function" ? mlbJa : async () => mlbJa,
    achar: (sel) => (sel === "[data-paiia-revisao-ml]" ? el() : sel === "[data-paiia-bling-estoque]" ? el({ "data-paiia-bling-estoque": "" }) : sel === "[data-paiia-publicar-ml]" ? el({ "data-paiia-publicar-ml": "" }) : null),
    clicar: (e) => s.cliques.push(Object.keys(e.attrs)[0]),
    texto: () => "",
    esperar: (ms) => new Promise((ok) => setTimeout(ok, ms)),
    progresso: (e, t) => s.etapas.push([e, t || ""]),
    consultarItem: async () => { s.consultas += 1; return item; },
    relerIntegracao: async () => { s.leiturasVinculo += 1; return integrado ? "integrado" : "aguardando"; },
    publicado: async (pub) => s.publicados.push(pub),
  };
  return { p, s };
}

test("ficha com MLB: NÃO publica de novo; só confere o anúncio ativo e o vínculo no Bling", async () => {
  const { p, s } = tela({ mlbJa: { mlb: MLB, link: "https://x/MLB5535014431" } });
  const r = await executarPiloto(p, { limites: L });
  assert.equal(r.ok, true);
  assert.equal(r.jaExistia, true);
  assert.equal(r.mlb, MLB);
  assert.deepEqual(s.cliques, [], "nenhum toque na tela (nem canais, nem Bling, nem Publicar)");
  assert.equal(s.publicados.length, 1);
  assert.equal(s.publicados[0].jaExistia, true);
  assert.ok(s.consultas >= 1, "consulta o status do MLB no ML");
  assert.equal(s.leiturasVinculo, 1, "vínculo: uma leitura; o resto segue em segundo plano");
  assert.match(r.pendencia, /vínculo no Bling em conferência: segue sozinho em segundo plano/);
  assert.ok(s.etapas.some(([, t]) => /já está publicada no Mercado Livre \(MLB5535014431\): nada é publicado de novo/.test(t)));
});

test("ficha com MLB e vínculo já integrado: concluído sem aviso de vínculo", async () => {
  const { p } = tela({ mlbJa: { mlb: MLB }, integrado: true });
  const r = await executarPiloto(p, { limites: L });
  assert.equal(r.ok, true); assert.equal(r.vinculo, true);
});

test("não deu para ler a ficha: pausa ANTES de tudo, nada enviado", async () => {
  const { p, s } = tela({ mlbJa: { erro: "sem conexão" } });
  const r = await executarPiloto(p, { limites: L });
  assert.equal(r.ok, false);
  assert.equal(r.antesDoEnvio, true);
  assert.match(r.texto, /Não consegui conferir se esta ficha já foi publicada \(sem conexão\)\. Nada foi enviado/);
  assert.deepEqual(s.cliques, []);
});

test("ficha sem MLB: segue o fluxo normal (canais, Bling, ...)", async () => {
  const { p, s } = tela({ mlbJa: { mlb: "" } });
  await executarPiloto(p, { limites: L });
  assert.ok(s.etapas.some(([e]) => e === "bling"), "passou da etapa de canais para o Bling");
  assert.equal(s.publicados.length, 0);
});

test("MLB reconhecido em qualquer registro da ficha (publicação, registro do Bling, pós-publicação)", () => {
  assert.equal(mlbRegistradoDaFicha({ publicacao: { mlb_id: MLB } }), MLB);
  assert.equal(mlbRegistradoDaFicha({ publicacao: { mlb_id: null }, dados_conferencia: { integracao_bling: { mlb: MLB } } }), MLB);
  assert.equal(mlbRegistradoDaFicha({ dados_conferencia: { pos_publicacao: { mlb: "mlb5535014431" } } }), MLB);
  assert.equal(mlbRegistradoDaFicha({ integracao_bling: { mlb: MLB } }), MLB, "linha da Central");
  assert.equal(mlbRegistradoDaFicha({ publicacao: { mlb_id: "" }, dados_conferencia: {} }), "");
});

test("Central: MLB no registro do Bling = publicada (Concluir Bling), nunca 'pronta para publicar'", () => {
  const row = { status_fluxo: "publicando", conta_destino_ml_user_id: "1729335019", publicacao: { mlb_id: null, status_publicacao: "pendente", ml_user_id: "1729335019" }, integracao_bling: { mlb: MLB, estado: "aguardando_importacao" } };
  assert.equal(fichaJaPublicada(row), true);
  assert.equal(estadoFichaCentral(row), ESTADO_CENTRAL.AGUARDANDO_BLING);
  const r = resumoFichaCentral(row);
  assert.equal(r.publicado, true); assert.equal(r.mlb, MLB);
  const soRegistro = { status_fluxo: "conferencia_aprovada", conta_destino_ml_user_id: "1", publicacao: null, integracao_bling: { mlb: MLB } };
  assert.equal(fichaJaPublicada(soRegistro), true);
  assert.notEqual(estadoFichaCentral(soRegistro), ESTADO_CENTRAL.PRONTO_PUBLICAR);
  assert.equal(estadoFichaCentral({ status_fluxo: "conferencia_aprovada", conta_destino_ml_user_id: "1", publicacao: null }), ESTADO_CENTRAL.PRONTO_PUBLICAR, "sem MLB continua igual");
});

test("'Continuar' na Central não herda o nº de autorização da rodada anterior", () => {
  const u = new URL(enderecoDaFicha("https://www.paiia.com.br/?tela=paiiaVoz&auto=aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee&ficha=x", "11111111-2222-4333-8444-000000000001"));
  assert.equal(u.searchParams.get("auto"), null);
  assert.equal(u.searchParams.get("ficha"), "11111111-2222-4333-8444-000000000001");
  assert.equal(u.searchParams.get("tela"), "mercadoLivreTeste");
});

async function fichaComConta() {
  const ap = await S.salvarFichaAprovada({ anuncioId: "", codigo: "39038558", titulo: "Botão Volante Comando Voz Fone Cruze 1.4", dadosConferencia: { versao: 2, anuncio: { codigo: "39038558" } } });
  assert.equal(ap.ok, true);
  const ct = await S.salvarContaDestino({ anuncioId: ap.anuncioId, codigo: "39038558", titulo: "x", contaId: "1729335019", contaNome: "LOJA ONLINE" });
  assert.equal(ct.ok, true);
  return ap.anuncioId;
}
const registro = { mlb: MLB, estado: "aguardando_importacao", bling_produto_id: "16732475335" };

test("MLB devolvido: ficha marcada PUBLICADA na hora (resiste a fechar a tela antes do fim)", async () => {
  zerarBanco();
  const id = await fichaComConta();
  const r = await S.registrarMLBPublicado({ anuncioId: id, contaId: "1729335019", mlb: MLB, link: "https://x", sku: "39038558", blingProdutoId: "16732475335", registro });
  assert.equal(r.ok, true, r.erro);
  const f = banco.tabelas.paiia_anuncios.find((l) => l.id === id);
  const pub = banco.tabelas.paiia_anuncios_publicacoes.filter((l) => l.anuncio_id === id);
  assert.equal(f.status_fluxo, "publicado");
  assert.equal(pub.length, 1);
  assert.equal(pub[0].mlb_id, MLB);
  assert.equal(f.dados_conferencia.integracao_bling.mlb, MLB);
});

test("sem a linha da publicação: é criada com o MLB (antes a gravação não fazia nada)", async () => {
  zerarBanco();
  const ap = await S.salvarFichaAprovada({ anuncioId: "", codigo: "39038558", titulo: "x", dadosConferencia: { versao: 2 } });
  assert.equal(banco.tabelas.paiia_anuncios_publicacoes.filter((l) => l.anuncio_id === ap.anuncioId).length, 0);
  const r = await S.registrarMLBPublicado({ anuncioId: ap.anuncioId, contaId: "1729335019", mlb: MLB, sku: "39038558", registro });
  assert.equal(r.ok, true, r.erro);
  const pub = banco.tabelas.paiia_anuncios_publicacoes.filter((l) => l.anuncio_id === ap.anuncioId);
  assert.equal(pub.length, 1);
  assert.equal(pub[0].mlb_id, MLB);
  assert.equal(pub[0].marketplace, "mercado_livre");
});

test("'publicado com pendência' não é rebaixado para 'publicado'; preço/estoque não são tocados", async () => {
  zerarBanco();
  const id = await fichaComConta();
  banco.tabelas.paiia_anuncios.find((l) => l.id === id).status_fluxo = "publicado_com_pendencia";
  await S.registrarMLBPublicado({ anuncioId: id, contaId: "1729335019", mlb: MLB, registro });
  assert.equal(banco.tabelas.paiia_anuncios.find((l) => l.id === id).status_fluxo, "publicado_com_pendencia");
  const s = ler("src/services/anuncioPublicacaoService.js");
  const corpo = s.slice(s.indexOf("export async function registrarMLBPublicado"), s.indexOf("export async function garantirRegistroIntegracaoBling"));
  assert.ok(!/preco|estoque|quantidade|condicao/i.test(corpo.replace(/\/\/.*$/gm, "")), "só MLB/status/registro");
});

test("tela: a rotina lê a ficha antes de começar e mostra 'já está publicado'", () => {
  const c = ler("src/components/PilotoAutomaticoPublicacao.jsx");
  assert.ok(c.includes("mlbJaPublicado: async () =>") && c.includes("mlbRegistradoDaFicha(r.anuncio)"));
  assert.ok(c.includes("Este anúncio já está publicado — nada foi publicado de novo"));
});
