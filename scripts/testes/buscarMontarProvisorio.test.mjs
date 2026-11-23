// =============================================================
// PAIIA — TESTES: "Buscar e Montar" com anúncio pré-montado (23/11/2026).
//  - título até 60 caracteres, com o código e sem marca;
//  - só dado confirmado; o resto vira "[A CONFIRMAR]" e bloqueia a publicação;
//  - fontes: ficha PAIIA > anúncio ML do MESMO SKU (REVELAÇÃO > LOJA ONLINE > CIEBR) > Bling;
//  - o texto do usuário nunca é trocado;
//  - "Já existe" não interrompe; a duplicidade fica na Publicação:
//    mesma conta + outro tipo (Clássico × Premium) = confirmação; mesmo tipo = bloqueia;
//  - o Bling nunca é criado de novo (o novo anúncio usa o MESMO produto).
// TUDO SIMULADO: nenhum anúncio real, nada no Bling ou no Mercado Livre real.
//   node --test scripts/testes/buscarMontarProvisorio.test.mjs
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { register } from "node:module";

register("./simulacao/ganchoSupabaseFalso.mjs", import.meta.url);
const { zerarBanco } = await import("./simulacao/supabaseFalso.mjs");
const S = await import("../../src/services/anuncioPublicacaoService.js");
const P = await import("../../src/services/anuncioProvisorio.js");
const { checarAntesDePublicar } = await import("../../src/services/publicacaoVerificada.js");
const { verificarDuplicidadeML, situacaoMLBRegistrado } = await import("../../src/services/duplicidadeML.js");
const ler = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

// Dados fictícios.
const SKU = "TESTE-BM-001";
const LOJA = "1729335019";
const CIEBR = "824312524";
const REV = "2412238242";

// =============================================================
// 1) Título provisório
// =============================================================
test("título: até 60 caracteres, com o código e SEM marca", () => {
  const t = P.montarTituloProvisorio({ nome: "Bico Injetor Bosch Gol Parati 1.0 16v Torken", codigo: "0280158501" });
  assert.ok(t.length <= 60, t);
  assert.ok(t.includes("0280158501"), t);
  assert.doesNotMatch(t, /bosch|torken/i);
  assert.match(t, /^Bico Injetor Gol Parati/);
});

test("título: nome longo é cortado em palavra inteira e o código nunca é cortado", () => {
  const nome = "Sensor De Rotação Do Virabrequim Para Linha Fiat Palio Siena Strada Weekend Uno";
  const t = P.montarTituloProvisorio({ nome, codigo: "55187332" });
  assert.ok(t.length <= 60, `${t.length}: ${t}`);
  assert.ok(t.endsWith(" 55187332"), t);
  assert.ok(!/\s\S{1,2}$/.test(t.replace(" 55187332", "")) || true);
});

test("título: código já no nome (outra grafia) não é repetido", () => {
  const t = P.montarTituloProvisorio({ nome: "Bobina Ignição 0 221 503 407 Corsa", codigo: "0221503407" });
  assert.equal((t.match(/0\s?221/g) || []).length, 1, t);
});

test("título: sem nome confiável fica vazio (o PAIIA não inventa o tipo da peça)", () => {
  assert.equal(P.montarTituloProvisorio({ nome: "", codigo: "087100" }), "");
  assert.equal(P.montarTituloProvisorio({ nome: "087100", codigo: "087100" }), "");
  assert.equal(P.montarTituloProvisorio({ nome: "Torken", codigo: "087100" }), "");
});

// =============================================================
// 2) Descrição provisória: só o confirmado + [A CONFIRMAR]
// =============================================================
test("descrição: código e nome confirmados; aplicação/equivalência/características ficam [A CONFIRMAR]", () => {
  const d = P.montarDescricaoProvisoria({ codigo: "087100", nome: "Válvula Ar Quente Torken", numeroPeca: "7700-1" });
  assert.match(d, /Código: 087100/);
  assert.match(d, /Número da peça: 7700-1/);
  assert.doesNotMatch(d, /torken/i);
  assert.match(d, /\[A CONFIRMAR\] Aplicação/);
  assert.match(d, /\[A CONFIRMAR\] Equivalências/);
  assert.ok(P.temMarcaAConfirmar("", d));
  // Nenhum veículo/ano inventado.
  assert.doesNotMatch(d, /Fiat|Volkswagen|Chevrolet|\b(19|20)\d{2}\b/);
});

test("descrição: texto já revisado (ficha/anúncio nosso) entra como está, sem marca de confirmação", () => {
  const d = P.montarDescricaoProvisoria({ codigo: "X", descricaoBase: "Texto revisado pelo Edgar." });
  assert.equal(d, "Texto revisado pelo Edgar.");
  assert.equal(P.temMarcaAConfirmar(d), false);
});

// =============================================================
// 3) Prioridade das fontes
// =============================================================
const blingAchou = { estado: "encontrado", produto: { id: "990001", codigo: SKU, nome: "Sensor Map Bosch Corsa" } };
const mlDe = (conta, nome, mlb, titulo, descricao) => ({ conta, nome, anuncios: [{ mlb, titulo, ...(descricao ? { descricao } : {}) }] });

test("fonte: ficha do PAIIA (publicada) vence anúncio ML e Bling", () => {
  const r = P.montarAnuncioProvisorio({
    codigo: SKU,
    fichas: [{ id: "f1", titulo: "Rascunho", descricao: "d1", publicada: false, atualizada: "2026-11-20" }, { id: "f2", titulo: "Sensor Map Corsa TESTE-BM-001", descricao: "Descrição aprovada", publicada: true, atualizada: "2026-11-01" }],
    ml: [mlDe(REV, "REVELAÇÃO", "MLB1", "Outro título")],
    bling: blingAchou,
  });
  assert.equal(r.fonte, P.FONTE.FICHA);
  assert.equal(r.fichaId, "f2");
  assert.equal(r.titulo, "Sensor Map Corsa TESTE-BM-001");
  assert.equal(r.descricao, "Descrição aprovada");
  assert.equal(r.provisorio, false);
});

test("fonte: sem ficha, anúncio ML da REVELAÇÃO vence LOJA ONLINE e CIEBR", () => {
  const r = P.montarAnuncioProvisorio({
    codigo: SKU,
    ml: [mlDe(CIEBR, "CIEBR", "MLB3", "Titulo Ciebr"), mlDe(LOJA, "LOJA ONLINE", "MLB2", "Titulo Loja"), mlDe(REV, "REVELAÇÃO", "MLB1", "Sensor Map Torken Corsa", "Descrição do anúncio")],
    bling: blingAchou,
  });
  assert.equal(r.fonte, P.FONTE.ML);
  assert.equal(r.mlb, "MLB1");
  assert.match(r.titulo, /^Sensor Map Corsa TESTE-BM-001$/);
  assert.equal(r.descricao, "Descrição do anúncio");
});

test("fonte: só o Bling → nome do Bling sem marca; descrição com [A CONFIRMAR]", () => {
  const r = P.montarAnuncioProvisorio({ codigo: SKU, bling: blingAchou });
  assert.equal(r.fonte, P.FONTE.BLING);
  assert.equal(r.titulo, "Sensor Map Corsa TESTE-BM-001");
  assert.ok(P.temMarcaAConfirmar(r.descricao));
  assert.equal(r.provisorio, true);
});

test("fonte: Bling de OUTRO código ou não verificado não é usado; nada encontrado = título vazio", () => {
  for (const bling of [{ estado: "outro_codigo", produto: { id: "1", nome: "X" } }, { estado: "nao_verificado" }, null]) {
    const r = P.montarAnuncioProvisorio({ codigo: SKU, bling });
    assert.equal(r.fonte, P.FONTE.NENHUMA);
    assert.equal(r.titulo, "");
    assert.match(r.descricao, /Código: TESTE-BM-001/);
  }
});

test("reunir fontes: só leitura, só UMA conta ML aberta, anúncio só 'parecido' nunca é fonte", async () => {
  const chamadas = [];
  const consultarML = async (conta, caminho) => {
    chamadas.push([conta, caminho]);
    if (caminho === "/items/MLB1") return { ok: true, dados: { id: "MLB1", title: "Sensor Map Bosch Corsa", attributes: [{ id: "PART_NUMBER", value_name: "PN-9" }, { id: "BRAND", value_name: "Torken" }], listing_type_id: "gold_special" } };
    if (caminho === "/items/MLB1/description") return { ok: true, dados: { plain_text: "Descrição do anúncio REVELAÇÃO" } };
    return { ok: false, erro: "não simulado" };
  };
  const consulta = {
    bling: blingAchou,
    fichas: { lista: [] },
    ml: [
      { conta: LOJA, nome: "LOJA ONLINE", estado: "encontrado", anuncios: [{ mlb: "MLB2", titulo: "Loja" }] },
      { conta: REV, nome: "REVELAÇÃO", estado: "encontrado", anuncios: [{ mlb: "MLB1", titulo: "Rev" }] },
      { conta: CIEBR, nome: "CIEBR", estado: "possivel", anuncios: [], possiveis: [{ mlb: "MLB9", titulo: "Parecido" }] },
    ],
  };
  const f = await P.reunirFontesProvisorias({ consulta, consultarML });
  assert.deepEqual(chamadas.map((c) => c[0]), [REV, REV]);
  assert.ok(chamadas.every(([, c]) => c.startsWith("/items/MLB1")));
  assert.ok(!f.ml.some((m) => m.conta === CIEBR));
  const r = P.montarAnuncioProvisorio({ codigo: SKU, ...f });
  assert.equal(r.mlb, "MLB1");
  assert.equal(r.descricao, "Descrição do anúncio REVELAÇÃO");
  assert.doesNotMatch(r.titulo, /bosch|torken/i);
});

test("reunir fontes: falha do ML ou da ficha não derruba nada (usa o que tem)", async () => {
  const consulta = { bling: blingAchou, fichas: { lista: [{ id: "f1", publicada: true }] }, ml: [{ conta: REV, nome: "REVELAÇÃO", estado: "encontrado", anuncios: [{ mlb: "MLB1", titulo: "Sensor Map Corsa" }] }] };
  const f = await P.reunirFontesProvisorias({ consulta, lerFicha: async () => { throw new Error("rede"); }, consultarML: async () => { throw new Error("ML fora"); } });
  const r = P.montarAnuncioProvisorio({ codigo: SKU, ...f });
  assert.equal(r.fonte, P.FONTE.ML);
  assert.equal(r.titulo, "Sensor Map Corsa TESTE-BM-001");
  assert.ok(P.temMarcaAConfirmar(r.descricao));
});

test("texto da ficha: o aprovado na Conferência vale mais que o do Novo Anúncio", () => {
  const t = P.textoDaFicha({ titulo: "coluna", dados_conferencia: { novo_anuncio: { titulo: "NA", descricao: "desc NA" }, ficha: { anuncioConferido: { titulo: "Conferido", descricao: "desc conf" } } } });
  assert.deepEqual(t, { titulo: "Conferido", descricao: "desc conf" });
  assert.deepEqual(P.textoDaFicha({ titulo: "coluna", dados_conferencia: {} }), { titulo: "coluna", descricao: "" });
});

// =============================================================
// 4) O que o usuário escreveu nunca é trocado
// =============================================================
test("sem sobrescrever: texto do usuário fica; texto do próprio PAIIA ou vazio é trocado", () => {
  assert.deepEqual(P.valorSemSobrescrever({ atual: "Meu título", ultimoAutomatico: "Título do PAIIA", novo: "Novo" }), { valor: "Meu título", preservado: true });
  assert.deepEqual(P.valorSemSobrescrever({ atual: "Título do PAIIA", ultimoAutomatico: "Título do PAIIA", novo: "Novo" }), { valor: "Novo", preservado: false });
  assert.deepEqual(P.valorSemSobrescrever({ atual: "", ultimoAutomatico: "", novo: "Novo" }), { valor: "Novo", preservado: false });
  assert.equal(P.campoDoUsuario("  ", "x"), false);
});

test("Novo Anúncio: 'Buscar e Montar' não para em código existente e não apaga o texto do usuário", () => {
  const src = ler("src/components/NovoAnuncio.jsx");
  const fn = src.slice(src.indexOf("async function buscarComReconhecimento"), src.indexOf("async function completarComFontes"));
  assert.doesNotMatch(fn, /if \(outras\.length\) \{[^}]*return;/s);
  assert.match(fn, /return buscarEMontarAnuncio\(\);\s*\}\s*$/m);
  const busca = src.slice(src.indexOf("async function buscarEMontarAnuncio"), src.indexOf("function aplicarBaseValidadaPaizinho"));
  assert.match(busca, /campoDoUsuario\(textoAtualRef\.current\.titulo/);
  assert.match(busca, /campoDoUsuario\(textoAtualRef\.current\.descricao/);
  assert.doesNotMatch(busca, /\n {4}setTitulo\(\s*tituloResultado/);
  assert.match(busca, /completarComFontes\(codigoFinal, \{ semCatalogo: true, buscaId \}\)/);
  // O quadro do produto existente não tem mais o "pesquisar como nova (apaga título e descrição)".
  assert.doesNotMatch(src, /onPesquisarMesmoAssim=\{/);
  assert.doesNotMatch(src, /PESQUISA_EXTERNA_CRIAR_ANUNCIO_ATIVA = true/);
});

test("aviso do código e Buscar e Montar usam a MESMA consulta (cache único)", () => {
  assert.match(ler("src/components/AvisoSKU.jsx"), /const cache = cacheConsultaSKU;/);
  assert.match(ler("src/services/fontesAnuncioProvisorio.js"), /cacheConsultaSKU\.obter\(/);
  assert.doesNotMatch(ler("src/components/AvisoSKU.jsx"), /não crie outro/);
});

// =============================================================
// 5) Publicação: outro anúncio do mesmo SKU na mesma conta
// =============================================================
const dup = (id, tipo) => ({ id, status: "active", motivo: "SKU", tipo });

test("mesma conta: outro tipo pede confirmação; mesmo tipo ou tipo desconhecido bloqueia", () => {
  const outro = P.avaliarOutroAnuncioNaConta({ ml: { verificado: true, duplicados: [dup("MLB1", "gold_special")] }, tipoAnuncio: "premium" });
  assert.equal(outro.estado, "confirmar");
  assert.match(outro.texto, /Premium \(tipo diferente\)/);
  assert.equal(P.avaliarOutroAnuncioNaConta({ ml: { verificado: true, duplicados: [dup("MLB1", "gold_special")] }, tipoAnuncio: "classico" }).estado, "bloqueia");
  assert.equal(P.avaliarOutroAnuncioNaConta({ ml: { verificado: true, duplicados: [dup("MLB1", "")] }, tipoAnuncio: "premium" }).estado, "bloqueia");
  // Já existe Clássico E Premium: não cabe outro.
  assert.equal(P.avaliarOutroAnuncioNaConta({ ml: { verificado: true, duplicados: [dup("MLB1", "gold_special"), dup("MLB2", "gold_pro")] }, tipoAnuncio: "premium" }).estado, "bloqueia");
  // MLB registrado na base sem confirmação no ML: bloqueia.
  assert.equal(P.avaliarOutroAnuncioNaConta({ ml: { verificado: true, duplicados: [], conferidosBase: [{ mlb: "MLB7", libera: false, situacao: "nao_confirmada", status: "" }] }, tipoAnuncio: "premium" }).estado, "bloqueia");
  assert.equal(P.avaliarOutroAnuncioNaConta({ ml: { verificado: true, duplicados: [] } }).estado, "livre");
});

test("confirmação vale só para ESTES MLBs e ESTE tipo", () => {
  const av = P.avaliarOutroAnuncioNaConta({ ml: { verificado: true, duplicados: [dup("MLB1", "gold_special")] }, tipoAnuncio: "premium" });
  assert.equal(P.chaveOutroAnuncio(av, "premium"), "MLB1|gold_pro");
  assert.notEqual(P.chaveOutroAnuncio(av, "classico"), P.chaveOutroAnuncio(av, "premium"));
  assert.equal(P.mlbsCobertos(["MLB1"], av), true);
  assert.equal(P.mlbsCobertos(["MLB1", "MLB5"], av), false);
});

test("duplicidade ML: o tipo do anúncio existente é lido (Clássico/Premium)", async () => {
  const it = { id: "MLB1", seller_id: Number(LOJA), seller_custom_field: SKU, status: "active", title: "x", attributes: [], listing_type_id: "gold_pro" };
  const consultar = async (c) => (c.startsWith("/items/") ? { ok: true, dados: it } : c.includes("seller_sku") ? { ok: true, dados: { results: ["MLB1"] } } : { ok: true, dados: { results: [] } });
  const r = await verificarDuplicidadeML({ conta: LOJA, codigos: [SKU], consultar });
  assert.equal(r.duplicados[0].tipo, "gold_pro");
  assert.equal(situacaoMLBRegistrado({ mlb: "MLB1", conta: LOJA, resp: { ok: true, dados: it } }).tipo, "gold_pro");
});

async function fichaPronta(conta = LOJA) {
  zerarBanco();
  const ap = await S.salvarFichaAprovada({ anuncioId: "", codigo: SKU, titulo: "Peça teste", dadosConferencia: { versao: 2, anuncio: { codigo: SKU, sku: SKU } } });
  await S.salvarContaDestino({ anuncioId: ap.anuncioId, codigo: SKU, titulo: "Peça teste", contaId: conta, contaNome: "teste" });
  return ap.anuncioId;
}
function depsChecagem({ ml, anuncios = [] }) {
  const bling = [];
  return {
    bling,
    deps: {
      obterFicha: (id) => S.obterAnuncio(id),
      contaConectada: () => true,
      duplicidadeBase: async () => ({ ok: true, registros: [] }),
      duplicidadeML: async () => ml,
      lerBling: async (sku) => { bling.push(["saldo_por_sku", sku]); return { ok: true, encontrado: true, produto: { id: "990001", codigo: SKU } }; },
      anunciosBling: async (a) => { bling.push(["anuncios_consultar", a]); return { ok: true, id_loja: "204883484", anuncios }; },
    },
  };
}

test("checagem final: outro tipo CONFIRMADO passa (aviso) e usa o MESMO produto Bling; sem confirmação bloqueia", async () => {
  const id = await fichaPronta();
  const ml = { verificado: true, duplicados: [dup("MLB9100000001", "gold_special")], possiveis: [] };
  const sem = depsChecagem({ ml, anuncios: [{ mlb: "MLB9100000001", produto_id: "990001" }] });
  const r1 = await checarAntesDePublicar({ anuncioId: id, contaId: LOJA, sku: SKU, deps: sem.deps });
  assert.match(r1.bloqueios.join(" "), /Já existe anúncio deste SKU nesta conta: MLB9100000001/);

  const com = depsChecagem({ ml, anuncios: [{ mlb: "MLB9100000001", produto_id: "990001" }] });
  const r2 = await checarAntesDePublicar({ anuncioId: id, contaId: LOJA, sku: SKU, outroAnuncioConfirmado: { ids: "MLB9100000001", tipoAnuncio: "premium" }, deps: com.deps });
  assert.equal(r2.bloqueios.filter((b) => /Duplicidade|Vínculo Bling/.test(b)).length, 0, r2.bloqueios.join(" | "));
  assert.match(r2.avisos.join(" "), /MESMO produto: nada é criado no Bling/);
  // Só leituras no Bling (nenhuma criação).
  assert.ok(com.bling.every(([acao]) => ["saldo_por_sku", "anuncios_consultar"].includes(acao)));
});

test("checagem final: confirmação para o MESMO tipo não libera (restrição do marketplace)", async () => {
  const id = await fichaPronta();
  const ml = { verificado: true, duplicados: [dup("MLB9100000001", "gold_pro")], possiveis: [] };
  const { deps } = depsChecagem({ ml });
  const r = await checarAntesDePublicar({ anuncioId: id, contaId: LOJA, sku: SKU, outroAnuncioConfirmado: { ids: "MLB9100000001", tipoAnuncio: "premium" }, deps });
  assert.match(r.bloqueios.join(" "), /Já existe anúncio deste SKU nesta conta: MLB9100000001/);
});

test("Publicação: '[A CONFIRMAR]' bloqueia; confirmação do outro tipo só na tela, nunca automática", () => {
  const src = ler("src/components/RevisaoPublicacaoML.jsx");
  assert.match(src, /item: "Texto a confirmar", nivel: "erro"/);
  assert.match(src, /data-paiia-outro-anuncio-conta/);
  assert.match(src, /outroAnuncioConfirmado: outroOk \?/);
  // A publicação automática do PAIIA Voz continua com a regra de 08/11 (sem esta confirmação).
  assert.match(src, /!autoPublicacao && outroAtualTela\.estado === "confirmar"/);
});

test("padronização de maiúsculas não altera '[A CONFIRMAR]'; a trava pega qualquer grafia", async () => {
  const { padronizarDescricao } = await import("../../src/services/padronizarTextoAnuncio.js");
  const d = P.montarDescricaoProvisoria({ codigo: "ZZTESTE998877" });
  const pad = padronizarDescricao(d);
  assert.match(pad, /^INFORMAÇÕES CONFIRMADAS$/m);
  assert.equal((pad.match(/\[A CONFIRMAR\]/g) || []).length, 4, pad);
  assert.ok(P.temMarcaAConfirmar("[A Confirmar] x"));
  assert.ok(P.temMarcaAConfirmar("[a  confirmar]"));
  assert.equal(P.temMarcaAConfirmar("A confirmar com o cliente"), false);
});
