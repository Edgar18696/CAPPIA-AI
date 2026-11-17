// =============================================================
// PAIIA — TESTES: publicação VERIFICADA (16/11/2026).
// Checagem antes de publicar (SKU, conta, MLB, vínculo no Bling), marca
// de envio, gravação do MLB, duplicidade, falhas e retomadas.
// TUDO SIMULADO: Supabase FALSO em memória + respostas simuladas do
// Mercado Livre e do Bling. Nenhum anúncio real, nada no Bling real.
//   node --test scripts/testes/publicacaoVerificada.test.mjs
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { register } from "node:module";

register("./simulacao/ganchoSupabaseFalso.mjs", import.meta.url);
const { banco, zerarBanco } = await import("./simulacao/supabaseFalso.mjs");
const S = await import("../../src/services/anuncioPublicacaoService.js");
const { checarAntesDePublicar, publicarVerificado, retomarPublicacao, criadosDesde, respostaIncerta, envioPendenteDaFicha, CHAVE_ENVIO } = await import("../../src/services/publicacaoVerificada.js");
const { CHAVES_DA_PUBLICACAO_ANTERIOR, CONTAS_PUBLICACAO_ML } = await import("../../src/services/contasPublicacaoML.js");
const ler = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

// Dados fictícios: nenhum produto, MLB ou ID Bling real.
const SKU = "TESTE-PUB-001";
const LOJA = "1729335019";
const CIEBR = "824312524";
const REV = "2412238242";
const BLING_ID = "990000001";
const LOJA_BLING = "204883484"; // LojaOnlineSP (mapa fixo do PAIIA)
const MLB_NOVO = "MLB9000000001";
const MLB_ANTIGO = "MLB9000000002";

async function fichaPronta({ conta = LOJA, plano = true } = {}) {
  zerarBanco();
  const ap = await S.salvarFichaAprovada({ anuncioId: "", codigo: SKU, titulo: "Peça teste", dadosConferencia: { versao: 2, anuncio: { codigo: SKU, sku: SKU } } });
  assert.equal(ap.ok, true);
  const ct = await S.salvarContaDestino({ anuncioId: ap.anuncioId, codigo: SKU, titulo: "Peça teste", contaId: conta, contaNome: "teste" });
  assert.equal(ct.ok, true);
  if (plano) {
    const r = await S.registrarContasPublicacao({ anuncioId: ap.anuncioId, plano: { versao: 1, selecionadas: [conta], confirmadas: [conta], conta_desta_ficha: conta, fila: [], impedidas: [], verificacao: [] }, codigo: SKU, titulo: "Peça teste", contaNome: "teste" });
    assert.equal(r.ok, true);
  }
  return ap.anuncioId;
}

// ---- Mercado Livre simulado (ml_consulta GET por conta) ----
function mlFalso({ itens = [], falhaBusca = false } = {}) {
  const chamadas = [];
  const consultar = (conta) => async (caminho) => {
    chamadas.push({ conta, caminho });
    if (falhaBusca) return { ok: false, erro: "ML fora do ar (simulado)" };
    const busca = caminho.match(/^\/users\/(\d+)\/items\/search\?seller_sku=(.+)$/);
    if (busca) {
      const sku = decodeURIComponent(busca[2]);
      return { ok: true, dados: { results: itens.filter((i) => String(i.seller_id) === busca[1] && i.seller_custom_field === sku).map((i) => i.id) } };
    }
    const item = caminho.match(/^\/items\/(MLB\d+)$/);
    if (item) {
      const it = itens.find((i) => i.id === item[1]);
      return it ? { ok: true, dados: it } : { ok: false, erro: "não encontrado" };
    }
    return { ok: false, erro: `rota não simulada: ${caminho}` };
  };
  return { consultar, chamadas };
}
const itemML = (id, { conta = LOJA, sku = SKU, criado = new Date().toISOString(), status = "active" } = {}) => ({ id, seller_id: Number(conta), seller_custom_field: sku, status, date_created: criado, permalink: `https://exemplo.invalid/${id}`, attributes: [] });

// ---- Bling simulado (somente leitura) ----
function blingFalso({ produto = { id: BLING_ID, codigo: SKU }, ambiguo = false, falha = false, anuncios = [], falhaAnuncios = false, loja = LOJA_BLING } = {}) {
  const chamadas = [];
  return {
    chamadas,
    lerBling: async (sku) => { chamadas.push(["saldo_por_sku", sku]); return falha ? { ok: false, mensagem: "o Bling não respondeu em 40 s" } : produto ? { ok: true, encontrado: true, ambiguo, produto } : { ok: true, encontrado: false }; },
    anunciosBling: async (a) => { chamadas.push(["anuncios_consultar", a]); return falhaAnuncios ? { ok: false, erro: "Bling 503 (simulado)" } : { ok: true, id_loja: loja, anuncios }; },
  };
}

function depsChecagem({ ml = { verificado: true, duplicados: [], possiveis: [] }, base = null, bling = blingFalso(), conectadas = [LOJA, CIEBR, REV] } = {}) {
  return {
    obterFicha: (id) => S.obterAnuncio(id),
    contaConectada: (id) => conectadas.includes(String(id)),
    duplicidadeBase: base ? async () => base : (a) => S.conferirDuplicidadeBase(a),
    duplicidadeML: async () => ml,
    lerBling: bling.lerBling,
    anunciosBling: bling.anunciosBling,
  };
}
const itensDe = (r, item) => r.itens.filter((i) => i.item === item);

// =============================================================
// 1) As 3 contas e a checagem por conta
// =============================================================
test("as três contas da publicação: LOJA ONLINE, CIEBR e REVELAÇÃO com os IDs certos", () => {
  const mapa = Object.fromEntries(CONTAS_PUBLICACAO_ML.map((c) => [c.nome, c.id]));
  assert.deepEqual(mapa, { "LOJA ONLINE": LOJA, CIEBR, "REVELAÇÃO": REV });
});

test("painel das contas aparece sempre (mesmo sem contas carregadas) e lista as 3 antes de conferir", () => {
  const a = ler("src/components/AutorizacaoUnicaPublicacao.jsx");
  assert.match(a, /if \(ativo \|\| !anuncioId\) return null;/);
  assert.doesNotMatch(a, /!\(contas \|\| \[\]\)\.length\) return null/);
  assert.match(a, /data-paiia-lista-contas-publicacao/);
  assert.match(a, /CONTAS_PUBLICACAO_ML\.map\(\(c\) =>/);
  assert.match(a, /data-paiia-contas-sem-conexao/);
});

test("LOJA ONLINE tudo certo: SKU, conta, MLB, Bling e vínculo conferidos; nada gravado", async () => {
  const id = await fichaPronta();
  const bling = blingFalso();
  const antes = JSON.stringify(banco.tabelas);
  const r = await checarAntesDePublicar({ anuncioId: id, contaId: LOJA, sku: SKU, deps: depsChecagem({ bling }) });
  assert.equal(r.ok, true, r.bloqueios.join(" | "));
  for (const item of ["SKU", "Conta", "Duplicidade", "Bling", "Vínculo Bling"]) assert.equal(itensDe(r, item)[0]?.nivel, "ok", item);
  assert.equal(r.blingProdutoId, BLING_ID);
  assert.deepEqual(bling.chamadas[1], ["anuncios_consultar", { id_loja: LOJA_BLING, id_produto: BLING_ID }]);
  assert.equal(JSON.stringify(banco.tabelas), antes, "a checagem não grava nada");
  assert.equal(banco.funcoes.length, 0, "nenhuma função real chamada");
});

for (const [nome, conta] of [["CIEBR", CIEBR], ["REVELAÇÃO", REV]]) {
  test(`${nome}: liberada; sem loja Bling ligada o vínculo vira aviso (sem consultar anúncios do Bling)`, async () => {
    const id = await fichaPronta({ conta });
    const bling = blingFalso();
    const r = await checarAntesDePublicar({ anuncioId: id, contaId: conta, sku: SKU, deps: depsChecagem({ bling }) });
    assert.equal(r.ok, true, r.bloqueios.join(" | "));
    assert.equal(itensDe(r, "Vínculo Bling")[0].nivel, "aviso");
    assert.match(itensDe(r, "Conta")[0].texto, new RegExp(nome));
    assert.equal(bling.chamadas.filter(([a]) => a === "anuncios_consultar").length, 0);
  });
}

// =============================================================
// 2) SKU
// =============================================================
test("SKU do envio diferente do SKU da ficha: bloqueia", async () => {
  const id = await fichaPronta();
  const r = await checarAntesDePublicar({ anuncioId: id, contaId: LOJA, sku: "OUTRO-999", deps: depsChecagem({ bling: blingFalso({ produto: { id: BLING_ID, codigo: "OUTRO-999" } }) }) });
  assert.equal(r.ok, false);
  assert.match(r.bloqueios.join(" "), /SKU: O SKU gravado na publicação desta ficha \(TESTE-PUB-001\) é diferente do SKU do envio \(OUTRO-999\)/);
  // Sem SKU gravado na publicação: compara com o código/SKU da Conferência.
  banco.tabelas.paiia_anuncios_publicacoes.forEach((p) => { p.sku = null; });
  const r2 = await checarAntesDePublicar({ anuncioId: id, contaId: LOJA, sku: "OUTRO-999", deps: depsChecagem({ bling: blingFalso({ produto: { id: BLING_ID, codigo: "OUTRO-999" } }) }) });
  assert.match(r2.bloqueios.join(" "), /SKU: O SKU do envio \(OUTRO-999\) não é o código nem o SKU desta ficha \(TESTEPUB001\)/);
});

test("sem SKU: bloqueia e não consulta o Bling", async () => {
  const id = await fichaPronta();
  const bling = blingFalso();
  const r = await checarAntesDePublicar({ anuncioId: id, contaId: LOJA, sku: "  ", deps: depsChecagem({ bling }) });
  assert.equal(r.ok, false);
  assert.match(r.bloqueios.join(" "), /Sem SKU no envio/);
  assert.equal(bling.chamadas.length, 0);
});

test("código no Bling com outra grafia (hífen) do SKU do envio: bloqueia", async () => {
  const id = await fichaPronta();
  const r = await checarAntesDePublicar({ anuncioId: id, contaId: LOJA, sku: SKU, deps: depsChecagem({ bling: blingFalso({ produto: { id: BLING_ID, codigo: "TESTEPUB001" } }) }) });
  assert.equal(r.ok, false);
  assert.match(r.bloqueios.join(" "), /não é exatamente o SKU do envio/);
});

// =============================================================
// 3) Conta
// =============================================================
test("conta do envio diferente da conta gravada na ficha: bloqueia", async () => {
  const id = await fichaPronta({ conta: LOJA });
  const r = await checarAntesDePublicar({ anuncioId: id, contaId: CIEBR, sku: SKU, deps: depsChecagem() });
  assert.equal(r.ok, false);
  assert.match(r.bloqueios.join(" "), /gravada para LOJA ONLINE, mas o envio iria para CIEBR/);
});

test("conta fora das 3 contas: bloqueia", async () => {
  const id = await fichaPronta();
  const r = await checarAntesDePublicar({ anuncioId: id, contaId: "123456", sku: SKU, deps: depsChecagem() });
  assert.equal(r.ok, false);
  assert.match(r.bloqueios.join(" "), /fora das contas da publicação/);
});

test("conta desconectada: bloqueia (e não consulta duplicidade nem vínculo dessa conta)", async () => {
  const id = await fichaPronta();
  const bling = blingFalso();
  const r = await checarAntesDePublicar({ anuncioId: id, contaId: LOJA, sku: SKU, deps: depsChecagem({ conectadas: [CIEBR], bling }) });
  assert.equal(r.ok, false);
  assert.match(r.bloqueios.join(" "), /LOJA ONLINE não está conectada/);
  assert.equal(itensDe(r, "Duplicidade").length, 0);
  assert.equal(bling.chamadas.filter(([a]) => a === "anuncios_consultar").length, 0);
});

test("plano das contas reserva a ficha para outra conta: bloqueia", async () => {
  const id = await fichaPronta({ conta: LOJA, plano: false });
  await S.registrarContasPublicacao({ anuncioId: id, plano: { versao: 1, selecionadas: [REV], confirmadas: [REV], conta_desta_ficha: REV, fila: [], impedidas: [], verificacao: [] }, codigo: SKU, contaNome: "REVELAÇÃO" });
  // registrarContasPublicacao grava também a conta de destino: volta a ficha para LOJA para simular a divergência.
  banco.tabelas.paiia_anuncios[0].conta_destino_ml_user_id = LOJA;
  const r = await checarAntesDePublicar({ anuncioId: id, contaId: LOJA, sku: SKU, deps: depsChecagem() });
  assert.equal(r.ok, false);
  assert.match(r.bloqueios.join(" "), /reservam esta ficha para REVELAÇÃO/);
});

test("ficha não relida (base fora): bloqueia antes de qualquer outra leitura", async () => {
  const id = await fichaPronta();
  banco.falhar = { "paiia_anuncios:select": true };
  const bling = blingFalso();
  const r = await checarAntesDePublicar({ anuncioId: id, contaId: LOJA, sku: SKU, deps: depsChecagem({ bling }) });
  assert.equal(r.ok, false);
  assert.match(r.bloqueios[0], /Ficha: Não foi possível reler a ficha/);
  assert.equal(bling.chamadas.length, 0);
});

// =============================================================
// 4) MLB e duplicidade
// =============================================================
test("ficha que já tem MLB: bloqueia (nunca publica de novo)", async () => {
  const id = await fichaPronta();
  await S.registrarMLBPublicado({ anuncioId: id, contaId: LOJA, mlb: MLB_NOVO, link: "", sku: SKU, blingProdutoId: BLING_ID, registro: { mlb: MLB_NOVO, bling_produto_id: BLING_ID } });
  const r = await checarAntesDePublicar({ anuncioId: id, contaId: LOJA, sku: SKU, deps: depsChecagem({ base: { ok: true, registros: [] } }) });
  assert.equal(r.ok, false);
  assert.equal(r.mlbDaFicha, MLB_NOVO);
  assert.match(r.bloqueios.join(" "), /já está publicada \(MLB9000000001\)/);
});

test("anúncio ATIVO do mesmo SKU na conta: bloqueia na publicação manual; aviso na automática (regra 08/11)", async () => {
  const id = await fichaPronta();
  const ml = { verificado: true, duplicados: [{ id: MLB_ANTIGO, status: "active" }], possiveis: [] };
  const manual = await checarAntesDePublicar({ anuncioId: id, contaId: LOJA, sku: SKU, deps: depsChecagem({ ml }) });
  assert.equal(manual.ok, false);
  assert.match(manual.bloqueios.join(" "), /Já existe anúncio deste SKU nesta conta: MLB9000000002/);
  const auto = await checarAntesDePublicar({ anuncioId: id, contaId: LOJA, sku: SKU, automatico: true, deps: depsChecagem({ ml }) });
  assert.equal(auto.ok, true, auto.bloqueios.join(" | "));
  assert.match(auto.avisos.join(" "), /MLB9000000002/);
});

test("automática sem leitura de duplicidade (regra 13/11): não consulta o ML nem a base", async () => {
  const id = await fichaPronta();
  let leituras = 0;
  const deps = { ...depsChecagem(), duplicidadeML: async () => { leituras += 1; return { erro: "não devia" }; }, duplicidadeBase: async () => { leituras += 1; return { ok: false }; } };
  const r = await checarAntesDePublicar({ anuncioId: id, contaId: LOJA, sku: SKU, automatico: true, conferirDuplicidade: false, deps });
  assert.equal(r.ok, true, r.bloqueios.join(" | "));
  assert.equal(leituras, 0);
});

test("outra ficha já publicou o SKU nesta conta (base PAIIA): bloqueia; a própria ficha não conta", async () => {
  const id = await fichaPronta();
  const outra = { ok: true, registros: [{ id: "x", anuncio_id: "outra-ficha", mlb_id: MLB_ANTIGO }, { id: "y", anuncio_id: id, mlb_id: "" }] };
  const r = await checarAntesDePublicar({ anuncioId: id, contaId: LOJA, sku: SKU, deps: depsChecagem({ base: outra }) });
  assert.equal(r.ok, false);
  assert.match(r.bloqueios.join(" "), /A base PAIIA já registra este SKU nesta conta: MLB9000000002\./);
});

test("falha ao ler o ML ou a base: bloqueia (manual e automática com leitura)", async () => {
  const id = await fichaPronta();
  for (const automatico of [false, true]) {
    const r = await checarAntesDePublicar({ anuncioId: id, contaId: LOJA, sku: SKU, automatico, deps: depsChecagem({ ml: { erro: "429 (simulado)" }, base: { ok: false, erro: "timeout (simulado)" } }) });
    assert.equal(r.ok, false);
    assert.match(r.bloqueios.join(" "), /Base PAIIA não conferida \(timeout/);
    assert.match(r.bloqueios.join(" "), /Mercado Livre não conferido \(429/);
  }
});

// =============================================================
// 5) Bling: produto e vínculo
// =============================================================
const casosBling = [
  ["Bling não responde", { falha: true }, /O Bling não respondeu à consulta do SKU/],
  ["mais de um produto com o SKU", { ambiguo: true }, /Mais de um produto no Bling/],
  ["SKU não cadastrado", { produto: null }, /não está cadastrado no Bling/],
  ["consulta de anúncios do Bling falha", { falhaAnuncios: true }, /Vínculo Bling: Vínculo do produto na loja LojaOnlineSP não conferido/],
  ["Bling responde sobre outra loja", { loja: "111" }, /outra loja/],
];
for (const [nome, cfg, re] of casosBling) {
  test(`Bling: ${nome} → bloqueia, nada criado no Bling`, async () => {
    const id = await fichaPronta();
    const bling = blingFalso(cfg);
    const r = await checarAntesDePublicar({ anuncioId: id, contaId: LOJA, sku: SKU, deps: depsChecagem({ bling }) });
    assert.equal(r.ok, false);
    assert.match(r.bloqueios.join(" "), re);
    assert.ok(bling.chamadas.every(([a]) => a === "saldo_por_sku" || a === "anuncios_consultar"), "só leituras");
  });
}

test("Bling: ficha registra outro produto Bling do que o SKU aponta → bloqueia", async () => {
  const id = await fichaPronta();
  await S.registrarProdutoBlingCriado({ anuncioId: id, blingProdutoId: "990000777" });
  const r = await checarAntesDePublicar({ anuncioId: id, contaId: LOJA, sku: SKU, deps: depsChecagem() });
  assert.equal(r.ok, false);
  assert.match(r.bloqueios.join(" "), /registra o produto Bling 990000777, mas o SKU aponta o produto 990000001/);
});

test("Bling: produto já vinculado a anúncio ATIVO desta conta → bloqueia; vínculo antigo (não ativo) → aviso", async () => {
  const id = await fichaPronta();
  const bling = blingFalso({ anuncios: [{ mlb: MLB_ANTIGO, produto_id: BLING_ID }] });
  const ativo = await checarAntesDePublicar({ anuncioId: id, contaId: LOJA, sku: SKU, deps: depsChecagem({ bling, ml: { verificado: true, duplicados: [{ id: MLB_ANTIGO, status: "active" }], possiveis: [] } }) });
  assert.equal(ativo.ok, false);
  assert.match(ativo.bloqueios.join(" "), /Vínculo Bling: O produto Bling já está vinculado a anúncio ATIVO desta conta: MLB9000000002/);
  const historico = await checarAntesDePublicar({ anuncioId: id, contaId: LOJA, sku: SKU, deps: depsChecagem({ bling }) });
  assert.equal(historico.ok, true, historico.bloqueios.join(" | "));
  assert.match(historico.avisos.join(" "), /Vínculos antigos .* MLB9000000002/);
});

test("publicação sem Bling (escolhida): não consulta o Bling, só avisa", async () => {
  const id = await fichaPronta();
  const bling = blingFalso();
  const r = await checarAntesDePublicar({ anuncioId: id, contaId: LOJA, sku: SKU, usoBling: "sem", deps: depsChecagem({ bling }) });
  assert.equal(r.ok, true);
  assert.equal(bling.chamadas.length, 0);
  assert.match(r.avisos.join(" "), /Publicação sem Bling/);
});

// =============================================================
// 6) Envio, gravação, falhas (base falsa + ML simulado)
// =============================================================
function envioSimulado(id, { resposta = { ok: true, publicado: true, item_id: MLB_NOVO, link: "https://exemplo.invalid/MLB9000000001" }, gravar = null, checar = null } = {}) {
  const s = { envios: 0, gravacoes: 0, marcaNoEnvio: null };
  const deps = {
    checar: checar || (() => checarAntesDePublicar({ anuncioId: id, contaId: LOJA, sku: SKU, deps: depsChecagem() })),
    marcarEnvio: (marca) => S.marcarEnvioPublicacao({ anuncioId: id, marca }),
    enviar: async () => {
      s.envios += 1;
      s.marcaNoEnvio = (await S.obterAnuncio(id)).anuncio.dados_conferencia[CHAVE_ENVIO];
      if (typeof resposta === "function") return resposta();
      return resposta;
    },
    gravarMLB: async ({ mlb, link }) => {
      s.gravacoes += 1;
      if (gravar) return gravar(s.gravacoes);
      return S.registrarMLBPublicado({ anuncioId: id, contaId: LOJA, mlb, link, sku: SKU, blingProdutoId: BLING_ID, registro: { mlb, bling_produto_id: BLING_ID } });
    },
    limparEnvio: () => S.limparEnvioPublicacao({ anuncioId: id }),
  };
  return { s, deps };
}
const fichaNaBase = async (id) => (await S.obterAnuncio(id)).anuncio;

test("sucesso: marca gravada ANTES do envio, UM envio, MLB gravado na ficha e marca retirada", async () => {
  const id = await fichaPronta();
  const { s, deps } = envioSimulado(id);
  const r = await publicarVerificado({ conta: LOJA, sku: SKU, deps, agora: () => "2026-11-16T15:00:00.000Z" });
  assert.equal(r.ok, true);
  assert.equal(r.fase, "concluido");
  assert.equal(r.mlb, MLB_NOVO);
  assert.equal(s.envios, 1);
  assert.deepEqual(s.marcaNoEnvio, { conta: LOJA, sku: SKU, iniciado_em: "2026-11-16T15:00:00.000Z" });
  const f = await fichaNaBase(id);
  assert.equal(f.publicacao.mlb_id, MLB_NOVO);
  assert.equal(f.publicacao.sku, SKU);
  assert.equal(f.publicacao.bling_produto_id, BLING_ID);
  assert.equal(f.status_fluxo, "publicado");
  assert.equal(envioPendenteDaFicha(f), null, "marca retirada");
});

test("duplicidade: segundo toque em Publicar na mesma ficha é barrado pela checagem (nenhum 2º envio)", async () => {
  const id = await fichaPronta();
  const a = envioSimulado(id);
  assert.equal((await publicarVerificado({ conta: LOJA, sku: SKU, deps: a.deps })).ok, true);
  const b = envioSimulado(id);
  const r2 = await publicarVerificado({ conta: LOJA, sku: SKU, deps: b.deps });
  assert.equal(r2.ok, false);
  assert.equal(r2.fase, "checagem");
  assert.equal(b.s.envios, 0);
  assert.match(r2.bloqueios.join(" "), /já está publicada \(MLB9000000001\)/);
});

test("checagem bloqueada: nada marcado, nada enviado", async () => {
  const id = await fichaPronta();
  const { s, deps } = envioSimulado(id, { checar: async () => ({ ok: false, bloqueios: ["Conta: simulada"] }) });
  const r = await publicarVerificado({ conta: LOJA, sku: SKU, deps });
  assert.deepEqual([r.ok, r.fase, r.enviado, s.envios], [false, "checagem", false, 0]);
  assert.equal(envioPendenteDaFicha(await fichaNaBase(id)), null);
});

test("base não grava a marca do envio: nada é enviado ao Mercado Livre", async () => {
  const id = await fichaPronta();
  const { s, deps } = envioSimulado(id, { checar: async () => ({ ok: true }) });
  banco.falhar = { "paiia_anuncios:update": true };
  const r = await publicarVerificado({ conta: LOJA, sku: SKU, deps });
  assert.deepEqual([r.ok, r.fase, r.enviado, s.envios], [false, "marca", false, 0]);
  assert.match(r.erro, /Nada foi enviado ao Mercado Livre/);
});

test("ML recusa (erro de validação): nada criado, marca retirada, pode corrigir e tentar de novo", async () => {
  const id = await fichaPronta();
  const { s, deps } = envioSimulado(id, { resposta: { ok: false, publicado: false, erro: "item.attributes inválido (simulado)", codigo: "validacao" } });
  const r = await publicarVerificado({ conta: LOJA, sku: SKU, deps });
  assert.deepEqual([r.ok, r.fase, r.enviado, s.envios, s.gravacoes], [false, "ml", false, 1, 0]);
  assert.equal(envioPendenteDaFicha(await fichaNaBase(id)), null);
  const nova = envioSimulado(id);
  assert.equal((await publicarVerificado({ conta: LOJA, sku: SKU, deps: nova.deps })).ok, true);
});

for (const [nome, resposta] of [
  ["tempo esgotado (exceção)", () => { throw new Error("timeout de 60 s (simulado)"); }],
  ["falha de rede do servidor", { ok: false, erro: "Failed to send a request to the Edge Function" }],
  ["publicado sem MLB válido", { ok: true, publicado: true, item_id: "" }],
]) {
  test(`envio incerto (${nome}): UM envio, marca fica, nada reenviado; nova tentativa bloqueia até a retomada`, async () => {
    const id = await fichaPronta();
    const { s, deps } = envioSimulado(id, { resposta });
    const r = await publicarVerificado({ conta: LOJA, sku: SKU, deps });
    assert.deepEqual([r.ok, r.fase, r.enviado, s.envios, s.gravacoes], [false, "envio", "incerto", 1, 0]);
    assert.match(r.erro, /Nada será reenviado/);
    assert.ok(envioPendenteDaFicha(await fichaNaBase(id)), "marca fica");
    const outra = envioSimulado(id);
    const r2 = await publicarVerificado({ conta: LOJA, sku: SKU, deps: outra.deps });
    assert.equal(r2.fase, "checagem");
    assert.equal(outra.s.envios, 0);
    assert.match(r2.bloqueios.join(" "), /envio anterior desta ficha ficou sem resposta/);
  });
}

test("gravação do MLB falha 2x e grava na 3ª: um único envio", async () => {
  const id = await fichaPronta();
  const { s, deps } = envioSimulado(id, { gravar: (n) => (n < 3 ? { ok: false, erro: "conflito (simulado)" } : S.registrarMLBPublicado({ anuncioId: id, contaId: LOJA, mlb: MLB_NOVO, sku: SKU, registro: { mlb: MLB_NOVO } })) });
  const r = await publicarVerificado({ conta: LOJA, sku: SKU, deps });
  assert.deepEqual([r.ok, r.gravado, s.envios, s.gravacoes], [true, true, 1, 3]);
  assert.equal((await fichaNaBase(id)).publicacao.mlb_id, MLB_NOVO);
});

test("gravação do MLB falha sempre → pendência; a RETOMADA adota o MLB sem publicar de novo", async () => {
  const id = await fichaPronta();
  const { s, deps } = envioSimulado(id, { gravar: () => ({ ok: false, erro: "base fora (simulado)" }) });
  const r = await publicarVerificado({ conta: LOJA, sku: SKU, deps, agora: () => new Date(Date.now() - 1000).toISOString() });
  assert.deepEqual([r.ok, r.fase, r.gravado, s.envios, s.gravacoes], [true, "gravacao", false, 1, 3]);
  assert.match(r.pendencia, /MLB9000000001 criado, mas não ficou gravado/);
  assert.ok(envioPendenteDaFicha(await fichaNaBase(id)), "marca fica para a retomada");
  // Retomada: o ML simulado tem o anúncio criado pelo envio.
  const ml = mlFalso({ itens: [itemML(MLB_NOVO)] });
  const rt = await retomarPublicacao({ anuncioId: id, deps: depsRetomada(id, ml) });
  assert.equal(rt.acao, "adotado");
  assert.equal(rt.mlb, MLB_NOVO);
  const f = await fichaNaBase(id);
  assert.equal(f.publicacao.mlb_id, MLB_NOVO);
  assert.equal(envioPendenteDaFicha(f), null);
  assert.ok(ml.chamadas.every((c) => c.conta === LOJA), "leu com o token da conta do envio");
});

// =============================================================
// 7) Retomada
// =============================================================
function depsRetomada(id, ml) {
  return {
    obterFicha: (x) => S.obterAnuncio(x),
    consultar: ml.consultar,
    gravarMLB: ({ mlb, link }) => S.registrarMLBPublicado({ anuncioId: id, contaId: LOJA, mlb, link, sku: SKU, registro: { mlb } }),
    limparEnvio: () => S.limparEnvioPublicacao({ anuncioId: id }),
  };
}
async function fichaComEnvioIncerto(iniciado = new Date(Date.now() - 60_000).toISOString(), conta = LOJA) {
  const id = await fichaPronta({ conta });
  assert.equal((await S.marcarEnvioPublicacao({ anuncioId: id, marca: { conta, sku: SKU, iniciado_em: iniciado } })).ok, true);
  return id;
}

test("retomada: envio incerto criou o anúncio → adota (grava o MLB), sem publicar", async () => {
  const id = await fichaComEnvioIncerto();
  const rt = await retomarPublicacao({ anuncioId: id, deps: depsRetomada(id, mlFalso({ itens: [itemML(MLB_NOVO)] })) });
  assert.equal(rt.acao, "adotado");
  assert.equal((await fichaNaBase(id)).publicacao.mlb_id, MLB_NOVO);
  assert.equal(banco.funcoes.length, 0, "nenhuma função de publicação chamada");
});

test("retomada: o ML não tem anúncio do envio → libera; a próxima publicação passa pela checagem", async () => {
  const id = await fichaComEnvioIncerto();
  const rt = await retomarPublicacao({ anuncioId: id, deps: depsRetomada(id, mlFalso({ itens: [] })) });
  assert.equal(rt.acao, "liberado");
  assert.equal(envioPendenteDaFicha(await fichaNaBase(id)), null);
  const { s, deps } = envioSimulado(id);
  assert.equal((await publicarVerificado({ conta: LOJA, sku: SKU, deps })).ok, true);
  assert.equal(s.envios, 1);
});

test("retomada: anúncio ANTIGO do SKU (criado antes do envio) e de outra conta são ignorados → libera", async () => {
  const id = await fichaComEnvioIncerto("2026-11-16T15:00:00.000Z");
  const ml = mlFalso({ itens: [itemML(MLB_ANTIGO, { criado: "2026-10-01T10:00:00.000Z" }), itemML("MLB9000000003", { conta: CIEBR })] });
  const rt = await retomarPublicacao({ anuncioId: id, deps: depsRetomada(id, ml) });
  assert.equal(rt.acao, "liberado");
});

test("retomada: dois anúncios novos do SKU → você confere; nada gravado", async () => {
  const id = await fichaComEnvioIncerto();
  const rt = await retomarPublicacao({ anuncioId: id, deps: depsRetomada(id, mlFalso({ itens: [itemML(MLB_NOVO), itemML("MLB9000000004")] })) });
  assert.equal(rt.acao, "conferir");
  assert.deepEqual(rt.mlbs.sort(), [MLB_NOVO, "MLB9000000004"]);
  const f = await fichaNaBase(id);
  assert.equal(f.publicacao?.mlb_id || "", "");
  assert.ok(envioPendenteDaFicha(f), "marca fica");
});

test("retomada: ML fora do ar → aguarda; marca fica e nada é reenviado", async () => {
  const id = await fichaComEnvioIncerto();
  const rt = await retomarPublicacao({ anuncioId: id, deps: depsRetomada(id, mlFalso({ falhaBusca: true })) });
  assert.equal(rt.acao, "aguardar");
  assert.match(rt.texto, /Nada foi reenviado/);
  assert.ok(envioPendenteDaFicha(await fichaNaBase(id)));
});

test("retomada: ficha já com MLB → só conclui (e tira a marca que sobrou)", async () => {
  const id = await fichaComEnvioIncerto();
  await S.registrarMLBPublicado({ anuncioId: id, contaId: LOJA, mlb: MLB_NOVO, sku: SKU, registro: { mlb: MLB_NOVO } });
  const ml = mlFalso();
  const rt = await retomarPublicacao({ anuncioId: id, deps: depsRetomada(id, ml) });
  assert.equal(rt.acao, "concluir");
  assert.equal(ml.chamadas.length, 0);
  assert.equal(envioPendenteDaFicha(await fichaNaBase(id)), null);
});

test("retomada sem envio pendente: segue a publicação normal (nada lido no ML)", async () => {
  const id = await fichaPronta();
  const ml = mlFalso();
  assert.equal((await retomarPublicacao({ anuncioId: id, deps: depsRetomada(id, ml) })).acao, "publicar");
  assert.equal(ml.chamadas.length, 0);
});

test("retomada em CIEBR consulta com a conta CIEBR (não com a conta da tela)", async () => {
  const id = await fichaComEnvioIncerto(new Date(Date.now() - 60_000).toISOString(), CIEBR);
  const ml = mlFalso({ itens: [itemML("MLB9000000005", { conta: CIEBR })] });
  const rt = await retomarPublicacao({ anuncioId: id, deps: { ...depsRetomada(id, ml), gravarMLB: ({ mlb }) => S.registrarMLBPublicado({ anuncioId: id, contaId: CIEBR, mlb, sku: SKU, registro: { mlb } }) } });
  assert.equal(rt.acao, "adotado");
  assert.ok(ml.chamadas.length > 0 && ml.chamadas.every((c) => c.conta === CIEBR));
});

// =============================================================
// 8) Peças auxiliares e ligação na tela
// =============================================================
test("respostaIncerta: só ok+MLB é certeza; recusa do ML com motivo não é incerta", () => {
  assert.equal(respostaIncerta({ ok: true, publicado: true, item_id: MLB_NOVO }), false);
  assert.equal(respostaIncerta({ ok: false, erro: "título longo demais" }), false);
  assert.equal(respostaIncerta(null), true);
  assert.equal(respostaIncerta({ ok: false, erro: "Falha ao falar com o servidor." }), true);
  assert.equal(respostaIncerta({ ok: false, erro: "Gateway 504" }), true);
  // (15/11 × 16/11) MLB devolvido de OUTRA peça: recusado e tratado como incerto (marca fica; retomada procura o deste SKU).
  assert.equal(respostaIncerta({ ok: false, incerto: true, erro: "Publicação NÃO confirmada: MLB de outro produto" }), true);
});

test("criadosDesde: SKU com outra grafia não é adotado", async () => {
  const ml = mlFalso({ itens: [{ ...itemML(MLB_NOVO), seller_custom_field: SKU }] });
  const r = await criadosDesde({ conta: LOJA, sku: "OUTRO", desde: new Date().toISOString(), consultar: ml.consultar(LOJA) });
  assert.deepEqual(r, { ok: true, achados: [] });
});

test("marca do envio não passa para a ficha da próxima conta e é preservada nas regravações", () => {
  assert.ok(CHAVES_DA_PUBLICACAO_ANTERIOR.includes(CHAVE_ENVIO));
  assert.ok(S.CHAVES_PRESERVADAS_FICHA.includes(CHAVE_ENVIO));
});

test("tela de Publicação: checagem + marca + envio único via publicarVerificado; retomada só lê", () => {
  const r = ler("src/components/RevisaoPublicacaoML.jsx");
  const i = r.indexOf("const pv = await publicarVerificado({");
  assert.ok(i > 0);
  assert.equal((r.match(/chamar\("publicar"/g) || []).length, 1, "um único ponto de envio");
  assert.ok(r.indexOf('chamar("publicar"') > i, "o envio está dentro do publicarVerificado");
  assert.match(r, /checar: \(\) => checarAntesDePublicar\(\{/);
  assert.match(r, /conferirDuplicidade: !autoPublicacao/);
  assert.match(r, /data-paiia-retomar-envio/);
  const ret = r.slice(r.indexOf("async function retomarEnvio()"), r.indexOf("async function publicar()"));
  assert.doesNotMatch(ret, /chamar\("publicar"/);
  assert.match(ret, /chamar\("ml_consulta", \{ metodo: "GET", caminho \}, conta\)/);
});

test("MLB devolvido de OUTRA peça (caso 7527362): nada gravado na ficha, marca fica; a retomada acha o anúncio DESTE SKU", async () => {
  const id = await fichaPronta();
  const { s, deps } = envioSimulado(id, { resposta: { ok: false, incerto: true, erro: "Publicação NÃO confirmada: o MLB devolvido é de outro produto.", mlb_devolvido: "MLB9000000099", motivo_mlb: "outro_produto" } });
  const r = await publicarVerificado({ conta: LOJA, sku: SKU, deps, agora: () => new Date(Date.now() - 1000).toISOString() });
  assert.deepEqual([r.ok, r.fase, r.enviado, s.envios, s.gravacoes], [false, "envio", "incerto", 1, 0]);
  const f = await fichaNaBase(id);
  assert.notEqual(f.publicacao?.mlb_id, "MLB9000000099");
  assert.ok(envioPendenteDaFicha(f));
  // O ML simulado tem o anúncio de OUTRO SKU (o devolvido) e o anúncio certo deste SKU.
  const ml = mlFalso({ itens: [itemML("MLB9000000099", { sku: "8200642489" }), itemML(MLB_NOVO)] });
  const rt = await retomarPublicacao({ anuncioId: id, deps: depsRetomada(id, ml) });
  assert.equal(rt.acao, "adotado");
  assert.equal(rt.mlb, MLB_NOVO);
  assert.equal((await fichaNaBase(id)).publicacao.mlb_id, MLB_NOVO);
});
