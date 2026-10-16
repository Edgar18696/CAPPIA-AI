// =============================================================
// PAIIA — TESTES: reconhecimento automático de SKU (Melhoria 1).
// Bling, Mercado Livre e base PAIIA FALSOS: nada é consultado de verdade,
// nada é gravado, criado ou publicado.
//   node --test scripts/testes/reconhecimentoSKU.test.mjs
//
// Caso REAL (dados informados pela Rosana), usado só nos testes 1 e 1b:
//   SKU 8200375417 · Bling ID 16719384929 · MLB5398000317 · conta LOJA ONLINE.
//   Esse MLB é SÓ da LOJA ONLINE: nunca é colocado nas outras contas.
// Todos os outros cenários (anúncio em outras contas, grafias, falhas...)
// usam dados FICTÍCIOS: SKU 9900123456, Bling 99000001, MLB9900000001.
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const R = await import("../../src/services/reconhecimentoSKU.js");
const E = R.ESTADO_RECONHECIMENTO;
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ler = (rel) => fs.readFileSync(path.join(RAIZ, rel), "utf8").replace(/\r\n/g, "\n");

const REVELACAO = "2412238242";
const LOJA_ONLINE = "1729335019";
const CIEBR = "824312524";
const SKU = "8200375417";
const BLING_ID = "16719384929";
const MLB = "MLB5398000317";
// Fictícios (não existem): usados em todos os cenários que não são o caso real.
const SKU_FIC = "9900123456";
const BLING_FIC = "99000001";
const MLB_FIC = "MLB9900000001";
const TODAS = [
  { id: REVELACAO, nome: "REVELAÇÃO", conectada: true },
  { id: LOJA_ONLINE, nome: "LOJA ONLINE", conectada: true },
  { id: CIEBR, nome: "CIEBR", conectada: true },
];

// ---------- Mercado Livre falso (mesmas regras da API: SKU exato, q= livre) ----------
const norm = (v) => String(v ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
function item({ id, conta, sku = "", titulo = "", status = "active", sub_status = [] }) {
  return { id, seller_id: Number(conta), status, sub_status, title: titulo, seller_custom_field: sku || null, attributes: sku ? [{ id: "SELLER_SKU", value_name: sku }] : [] };
}
function mlFalso(itens, { falhaConta = "", muitos = false, chamadas = [] } = {}) {
  return async (conta, caminho) => {
    chamadas.push({ conta, caminho });
    if (falhaConta && conta === falhaConta) return { ok: false, erro: "HTTP 504 do Mercado Livre" };
    let m = caminho.match(/^\/users\/(\d+)\/items\/search\?seller_sku=(.+)$/);
    if (m) {
      const sku = decodeURIComponent(m[2]);
      return { ok: true, dados: { results: itens.filter((i) => String(i.seller_id) === m[1] && i.seller_custom_field === sku).map((i) => i.id) } };
    }
    m = caminho.match(/^\/users\/(\d+)\/items\/search\?q=([^&]+)&limit=50$/);
    if (m) {
      if (muitos) return { ok: true, dados: { results: [], paging: { total: 180 } } };
      const q = norm(decodeURIComponent(m[2]));
      const achados = itens.filter((i) => String(i.seller_id) === m[1] && (norm(i.title).includes(q) || norm(i.seller_custom_field).includes(q)));
      return { ok: true, dados: { results: achados.map((i) => i.id), paging: { total: achados.length } } };
    }
    m = caminho.match(/^\/items\/(MLB\d+)$/);
    if (m) {
      const it = itens.find((i) => i.id === m[1]);
      return it ? { ok: true, dados: it } : { ok: false, status: 404, erro: "not_found" };
    }
    return { ok: false, erro: `caminho inesperado ${caminho}` };
  };
}
const blingAchou = { ok: true, encontrado: true, sku: SKU, produto: { id: Number(BLING_ID), codigo: SKU, nome: "Peça Renault 8200375417" } };
const blingFic = { ok: true, encontrado: true, sku: SKU_FIC, produto: { id: Number(BLING_FIC), codigo: SKU_FIC, nome: "Peça fictícia 9900123456" } };
const blingNaoAchou = { ok: true, encontrado: false, sku: SKU_FIC, mensagem: "Produto não encontrado no Bling por este SKU." };
const baseVazia = { ok: true, disponivel: true, anuncios: [] };
// Ficha da base: caso real (LOJA ONLINE) ou fictícia (qualquer conta).
const fichaBase = ({ codigo, conta, nome, mlb, bling }) => ({
  ok: true, disponivel: true,
  anuncios: [{ id: "f1", codigo, titulo: "Peça", status_fluxo: "publicado", conta_destino_ml_user_id: conta, conta_destino_nome: nome, publicacao: { ml_user_id: conta, conta_nome: nome, mlb_id: mlb, bling_produto_id: Number(bling), status_publicacao: "publicado" } }],
});
const baseReal = () => fichaBase({ codigo: SKU, conta: LOJA_ONLINE, nome: "LOJA ONLINE", mlb: MLB, bling: BLING_ID });
const baseFic = (conta, nome) => fichaBase({ codigo: SKU_FIC, conta, nome, mlb: MLB_FIC, bling: BLING_FIC });
async function rodar({ codigo = SKU_FIC, contas = TODAS, bling = blingFic, base = baseVazia, itens = [], opcoesML = {}, tempoMaximoMs } = {}) {
  const chamadas = { bling: [], base: [], ml: [] };
  const r = await R.reconhecerSKU({
    codigo, contas, tempoMaximoMs,
    lerBling: async (s) => { chamadas.bling.push(s); if (bling instanceof Error) throw bling; return typeof bling === "function" ? bling() : bling; },
    lerBase: async (c) => { chamadas.base.push(c); if (base instanceof Error) throw base; return base; },
    consultarML: mlFalso(itens, { ...opcoesML, chamadas: chamadas.ml }),
    agora: () => "2026-10-15T12:00:00.000Z",
  });
  return { r, chamadas };
}
const contaDe = (r, id) => r.contas.find((c) => c.conta === id);

test("1) caso real 8200375417: Bling 16719384929 e MLB5398000317 na LOJA ONLINE", async () => {
  const itens = [item({ id: MLB, conta: LOJA_ONLINE, sku: SKU, titulo: "Peça Renault 8200375417" })];
  const { r } = await rodar({ codigo: SKU, bling: blingAchou, itens, base: baseReal() });
  assert.equal(r.bling.estado, E.ENCONTRADO);
  assert.equal(r.bling.produto.id, BLING_ID);
  assert.equal(r.bling.produto.codigo, SKU);
  const lo = contaDe(r, LOJA_ONLINE);
  assert.equal(lo.estado, E.ENCONTRADO);
  assert.deepEqual(lo.anuncios.map((a) => a.mlb), [MLB]);
  assert.equal(lo.nome, "LOJA ONLINE");
  assert.equal(contaDe(r, REVELACAO).estado, E.NAO_ENCONTRADO);
  assert.equal(contaDe(r, CIEBR).estado, E.NAO_ENCONTRADO);
  assert.equal(r.base.estado, E.ENCONTRADO);
  assert.equal(r.base.fichas[0].mlb, MLB);
  assert.equal(r.base.fichas[0].blingProdutoId, BLING_ID);
  assert.equal(r.resumo.existe, true);
  assert.equal(r.resumo.completo, true);
  assert.equal(r.resumo.titulo, "Este SKU já existe");
});

test("1b) caso real: MLB5398000317 é só da LOJA ONLINE (REVELAÇÃO e CIEBR consultadas à parte)", async () => {
  const itens = [item({ id: MLB, conta: LOJA_ONLINE, sku: SKU, titulo: "Peça Renault 8200375417" })];
  const { r, chamadas } = await rodar({ codigo: SKU, bling: blingAchou, itens, base: baseReal() });
  // cada conta foi consultada na SUA própria busca
  for (const conta of [REVELACAO, LOJA_ONLINE, CIEBR]) {
    assert.ok(chamadas.ml.some((c) => c.conta === conta && c.caminho.startsWith(`/users/${conta}/items/search`)), `conta ${conta} consultada`);
  }
  assert.deepEqual(r.contas.filter((c) => c.estado === E.ENCONTRADO).map((c) => c.nome), ["LOJA ONLINE"]);
  for (const c of r.contas.filter((x) => x.conta !== LOJA_ONLINE)) {
    assert.equal(c.estado, E.NAO_ENCONTRADO, c.nome);
    assert.equal(JSON.stringify(c).includes(MLB), false, `${c.nome} não mostra o MLB da LOJA ONLINE`);
  }
  assert.equal(r.base.fichas[0].conta, "LOJA ONLINE");
});

test("2) anúncio fictício aparece só na conta onde está (testado nas três contas)", async () => {
  for (const conta of [REVELACAO, LOJA_ONLINE, CIEBR]) {
    const { r } = await rodar({ itens: [item({ id: MLB_FIC, conta, sku: SKU_FIC, titulo: "Peça" })] });
    for (const c of r.contas) assert.equal(c.estado, c.conta === conta ? E.ENCONTRADO : E.NAO_ENCONTRADO, `${conta} → ${c.conta}`);
  }
});

test("3) grafias diferentes do mesmo SKU fictício (9900-123456, espaços, pontos)", async () => {
  for (const digitado of ["9900-123456", " 9900123456 ", "9900 123456", "9900.123456"]) {
    const { r } = await rodar({ codigo: digitado, itens: [item({ id: MLB_FIC, conta: CIEBR, sku: SKU_FIC, titulo: "Peça" })] });
    assert.equal(contaDe(r, CIEBR).estado, E.ENCONTRADO, digitado);
    assert.equal(R.chaveCodigo(digitado), SKU_FIC);
  }
  // SKU_FIC gravado no ML com hífen também é reconhecido pelo SKU_FIC normalizado.
  const { r } = await rodar({ itens: [item({ id: MLB_FIC, conta: REVELACAO, sku: "9900-123456", titulo: "Peça" })] });
  assert.equal(contaDe(r, REVELACAO).estado, E.ENCONTRADO);
});

test("4) falha no Bling = Verificação incompleta (nunca 'não existe')", async () => {
  for (const bling of [{ ok: false, erro: "Bling 504" }, null, new Error("rede caiu"), { ok: true }]) {
    const { r } = await rodar({ bling });
    assert.equal(r.bling.estado, E.INCOMPLETA, JSON.stringify(bling));
    assert.notEqual(r.bling.estado, E.NAO_ENCONTRADO);
    assert.equal(r.resumo.completo, false);
    assert.equal(r.resumo.titulo, R.TEXTO_INCOMPLETA, "nada achado + uma falha = incompleta, não 'nada encontrado'");
  }
  const { r } = await rodar({ bling: { ok: false, encontrado: true, produto: { id: BLING_FIC, codigo: SKU_FIC, nome: "x" }, mensagem: "Não foi possível ler o saldo." } });
  assert.equal(r.bling.estado, E.ENCONTRADO, "achou o produto, só o saldo falhou");
});

test("5) Bling: não encontrado (grafia exata) e ambíguo", async () => {
  let { r } = await rodar({ bling: blingNaoAchou });
  assert.equal(r.bling.estado, E.NAO_ENCONTRADO);
  assert.equal(r.resumo.titulo, "Nada encontrado com este SKU");
  ({ r } = await rodar({ bling: { ok: true, encontrado: true, ambiguo: true, candidatos: [{ id: 1, codigo: SKU_FIC }, { id: 2, codigo: "9900-123456" }] } }));
  assert.equal(r.bling.estado, E.AMBIGUO);
  assert.equal(r.bling.candidatos.length, 2);
  assert.equal(r.resumo.existe, true);
});

test("6) falha em uma conta do ML = incompleta só nela; as outras continuam", async () => {
  const { r } = await rodar({ itens: [item({ id: MLB_FIC, conta: CIEBR, sku: SKU_FIC })], opcoesML: { falhaConta: LOJA_ONLINE } });
  assert.equal(contaDe(r, LOJA_ONLINE).estado, E.INCOMPLETA);
  assert.match(contaDe(r, LOJA_ONLINE).motivo, /504/);
  assert.equal(contaDe(r, CIEBR).estado, E.ENCONTRADO);
  assert.equal(contaDe(r, REVELACAO).estado, E.NAO_ENCONTRADO);
  assert.equal(r.resumo.completo, false);
  assert.equal(r.resumo.existe, true);
});

test("7) conta não conectada / contas não lidas = incompleta, sem consultar", async () => {
  const contas = R.contasParaConsultar([{ ml_user_id: LOJA_ONLINE, nickname: "LOJAONLINE" }]);
  assert.deepEqual(contas.map((c) => [c.id, c.conectada]), [[REVELACAO, false], [LOJA_ONLINE, true], [CIEBR, false]]);
  const { r, chamadas } = await rodar({ contas });
  assert.equal(contaDe(r, REVELACAO).estado, E.INCOMPLETA);
  assert.match(contaDe(r, REVELACAO).motivo, /não conectada/);
  assert.ok(chamadas.ml.every((c) => c.conta === LOJA_ONLINE), "só consulta a conta conectada");
  const semLeitura = R.contasParaConsultar([], "HTTP 500");
  assert.ok(semLeitura.every((c) => !c.conectada && /não foi possível ler as contas/.test(c.motivo)));
  assert.equal(semLeitura.length, 3, "as três contas sempre aparecem");
});

test("8) busca grande demais = incompleta (conferência manual), nunca 'não existe'", async () => {
  const { r } = await rodar({ opcoesML: { muitos: true } });
  for (const c of r.contas) {
    assert.equal(c.estado, E.INCOMPLETA);
    assert.match(c.motivo, /muitos anúncios/);
  }
});

test("9) só semelhança de título / SKU diferente = POSSÍVEL (pede conferência), não confirmado (fictício)", async () => {
  const itens = [item({ id: "MLB1111111111", conta: REVELACAO, sku: "", titulo: "Peça fictícia 9900123456 modelo X" }), item({ id: "MLB2222222222", conta: CIEBR, sku: "K2-9900123456", titulo: "Kit 2 peças fictícias 9900123456" })];
  const { r } = await rodar({ itens });
  assert.equal(contaDe(r, REVELACAO).estado, E.POSSIVEL);
  assert.equal(contaDe(r, REVELACAO).possiveis[0].mlb, "MLB1111111111");
  assert.equal(contaDe(r, CIEBR).estado, E.POSSIVEL);
  assert.equal(r.resumo.possivel, true);
});

test("10) anúncio encerrado/excluído e anúncio de outro vendedor não contam", async () => {
  const itens = [
    item({ id: MLB_FIC, conta: LOJA_ONLINE, sku: SKU_FIC, status: "closed" }),
    item({ id: "MLB3333333333", conta: REVELACAO, sku: SKU_FIC, status: "inactive", sub_status: ["deleted"] }),
  ];
  const { r } = await rodar({ itens });
  assert.equal(contaDe(r, LOJA_ONLINE).estado, E.NAO_ENCONTRADO);
  assert.equal(contaDe(r, REVELACAO).estado, E.NAO_ENCONTRADO);
  // anúncio pausado CONTA (existe)
  const { r: r2 } = await rodar({ itens: [item({ id: MLB_FIC, conta: LOJA_ONLINE, sku: SKU_FIC, status: "paused" })] });
  assert.equal(contaDe(r2, LOJA_ONLINE).estado, E.ENCONTRADO);
  assert.equal(contaDe(r2, LOJA_ONLINE).anuncios[0].status, "paused");
});

test("11) base PAIIA: ficha encontrada, sem ficha e falha (incompleta)", async () => {
  let { r } = await rodar({ base: baseFic(CIEBR, "CIEBR") });
  assert.equal(r.base.estado, E.ENCONTRADO);
  assert.equal(r.base.fichas[0].conta, "CIEBR");
  ({ r } = await rodar({ base: { ok: false, erro: "base fora do ar" } }));
  assert.equal(r.base.estado, E.INCOMPLETA);
  ({ r } = await rodar({ base: new Error("timeout") }));
  assert.equal(r.base.estado, E.INCOMPLETA);
});

test("12) tempo esgotado = incompleta", async () => {
  const { r } = await rodar({ bling: () => new Promise(() => {}), tempoMaximoMs: 30 });
  assert.equal(r.bling.estado, E.INCOMPLETA);
  assert.match(r.bling.motivo, /tempo esgotado/);
});

test("13) código curto não consulta; contas consultadas uma de cada vez", async () => {
  assert.equal(R.codigoProntoParaConsultar("820"), false);
  assert.equal(R.codigoProntoParaConsultar("82-0"), false);
  assert.equal(R.codigoProntoParaConsultar("BIP415"), true);
  const { r, chamadas } = await rodar({ codigo: "82" });
  assert.equal(r, null);
  assert.equal(chamadas.ml.length + chamadas.bling.length + chamadas.base.length, 0);
  const ordem = (await rodar({})).chamadas.ml.map((c) => c.conta);
  const trocas = ordem.filter((c, i) => i && c !== ordem[i - 1]).length;
  assert.equal(trocas, 2, "REVELAÇÃO → LOJA ONLINE → CIEBR, sem intercalar");
});

test("14) cache: sem consultas repetidas; incompleta não fica guardada; 'verificar de novo' consulta", async () => {
  let relogio = 0;
  const cache = R.criarCacheReconhecimento({ validadeMs: 1000, relogio: () => relogio });
  let n = 0;
  const completo = async () => { n++; return { resumo: { completo: true } }; };
  await Promise.all([cache.obter("9900123456|x", completo), cache.obter("9900123456|x", completo)]);
  assert.equal(n, 1, "duas telas ao mesmo tempo = uma consulta");
  await cache.obter("9900123456|x", completo);
  assert.equal(n, 1, "mesmo código de novo = sem nova consulta");
  await cache.obter("9900123456|x", completo, { forcar: true });
  assert.equal(n, 2, "'Verificar de novo' consulta");
  relogio = 5000;
  await cache.obter("9900123456|x", completo);
  assert.equal(n, 3, "vencido = consulta");
  let m = 0;
  const incompletaFn = async () => { m++; return { resumo: { completo: false } }; };
  await cache.obter("OUTRO|x", incompletaFn);
  await cache.obter("OUTRO|x", incompletaFn);
  assert.equal(m, 2, "incompleta tenta de novo na próxima vez");
});

test("15) só leituras no ML/Bling/base; única gravação = registro interno (sem apagar)", () => {
  const svc = ler("src/services/reconhecimentoSKUService.js");
  const regras = ler("src/services/reconhecimentoSKU.js");
  const tela = ler("src/components/PainelSKUExistente.jsx");
  const reg = ler("src/services/registroMLBService.js");
  const acoes = [...svc.matchAll(/acao: "([a-z_]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(acoes, ["ml_consulta", "saldo_por_sku"]);
  assert.ok(svc.includes('metodo: "GET"'));
  // Nenhum acesso direto a tabelas no reconhecimento: a base é lida por
  // listarAnunciosDoCodigo e o registro pelo serviço do registro.
  assert.equal(/\.from\(|\.(insert|update|upsert)\(/.test(svc + regras + tela), false);
  assert.ok(svc.includes("lerBase: listarAnunciosDoCodigo"));
  assert.ok(svc.includes("lerRegistro: lerRegistroDoSKU"));
  const codigoSvc = svc.replace(/\/\*[\s\S]*?\*\//g, "").replace(/"mercadolivre-publicacao"/g, "");
  assert.equal(/criar_produto|publicar|estoque|conferir_cadastro_sku/i.test(codigoSvc), false);
  assert.deepEqual([...svc.matchAll(/functions\.invoke\("([a-z-]+)"/g)].map((m) => m[1]).sort(), ["bling-integracao", "mercadolivre-publicacao"]);
  assert.equal(/functions\.invoke|supabase/.test(regras + tela), false, "regras e tela não chamam o servidor direto");
  // O serviço do registro só toca a tabela do registro e nunca apaga.
  assert.deepEqual([...new Set([...reg.matchAll(/\.from\(([A-Za-z_"]+)\)/g)].map((m) => m[1]))], ["T"]);
  assert.ok(reg.includes('const T = "paiia_registro_mlb";'));
  assert.equal(/\.delete\(|\.upsert\(|functions\.invoke/.test(reg), false);
});

test("16) Novo Anúncio mostra o quadro; Publicação e canais intactos", () => {
  const dp = ler("src/components/DadosPrincipaisAnuncio.jsx");
  assert.ok(dp.includes('import PainelSKUExistente from "./PainelSKUExistente";'));
  const iCampo = dp.indexOf('placeholder="Código da peça"');
  const iQuadro = dp.indexOf("<PainelSKUExistente codigo={codigo} />");
  assert.ok(iCampo > 0 && iQuadro > iCampo && iQuadro < dp.indexOf('placeholder="Código OEM"'), "quadro logo abaixo do código");
  assert.ok(ler("src/components/NovoAnuncio.jsx").includes("<DadosPeca"), "Novo Anúncio usa os Dados da peça");
  const tela = ler("src/components/PainelSKUExistente.jsx");
  assert.ok(tela.includes("ESPERA_DIGITACAO_MS"), "espera o código parar de mudar");
  assert.equal(R.ESPERA_DIGITACAO_MS >= 1000, true);
  assert.equal(ler("src/components/RevisaoPublicacaoML.jsx").includes("PainelSKUExistente"), false, "Publicação não muda");
  assert.ok(ler("src/components/MercadoLivreTeste.jsx").includes("EscolherCanaisPublicacao"), "escolha de canais preservada");
});
