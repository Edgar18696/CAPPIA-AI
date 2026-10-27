// Criação segura no Bling (13/10/2026): consulta exata em ativos/inativos,
// varredura em blocos com recibo e retomada, tentativas só em GET,
// classificação do POST e decisão da criação incerta. Nada vai à rede.
import testBase from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// (27/10/2026) O código desta Edge Function fica no Supabase e não está no
// GitHub: sem o arquivo na pasta, os testes aparecem como PULADOS (não como
// aprovados nem como falha). Com o arquivo presente, rodam normalmente.
const ARQUIVO = new URL("../../supabase/functions/_shared/blingCriacaoSegura.js", import.meta.url);
const PRESENTE = fs.existsSync(ARQUIVO);
const MOTIVO = "Edge Function _shared/blingCriacaoSegura.js fora do repositório (fica no Supabase)";
const test = PRESENTE ? testBase : (nome, ...resto) => testBase.skip(nome, { skip: MOTIVO }, resto[resto.length - 1]);
const S = PRESENTE ? await import(ARQUIVO.href) : {};

const SEGREDO = "segredo-de-teste";
const USUARIO = "usuario-1";
const SKU = "8200442891";

// Bling falso: ativos (criterio 2), inativos (3), excluídos (4).
function catalogo({ ativos = 950, inativos = 130, extras2 = [], extras3 = [] } = {}) {
  const c = {
    2: [...Array.from({ length: ativos }, (_, i) => ({ id: 1000 + i, codigo: `A${i}`, nome: `Produto ${i}`, situacao: "A" })), ...extras2],
    3: [...Array.from({ length: inativos }, (_, i) => ({ id: 5000 + i, codigo: `I${i}`, nome: `Inativo ${i}`, situacao: "I" })), ...extras3],
    4: [
      { id: 9001, codigo: SKU, nome: "Antigo excluído 1", situacao: "E" },
      { id: 9002, codigo: SKU, nome: "Antigo excluído 2", situacao: "E" },
    ],
  };
  const chamadas = [];
  const falhas = new Map(); // "criterio:pagina" -> quantas vezes falhar
  async function blingGet(caminho) {
    chamadas.push(caminho);
    const u = new URL("https://x" + caminho);
    const criterio = Number(u.searchParams.get("criterio") || 1);
    const codigos = u.searchParams.getAll("codigos[]");
    const pagina = Number(u.searchParams.get("pagina") || 1);
    const chave = `${criterio}:${pagina}`;
    if (falhas.get(chave) > 0) {
      falhas.set(chave, falhas.get(chave) - 1);
      const e = new Error("Bling respondeu HTTP 504.");
      e.status = 504;
      throw e;
    }
    const base = criterio === 1 ? [...c[2], ...c[3]] : c[criterio] || [];
    if (codigos.length) return { data: base.filter((p) => codigos.includes(p.codigo)) };
    return { data: base.slice((pagina - 1) * 100, pagina * 100) };
  }
  return { c, chamadas, falhas, blingGet };
}

test("GET: só erros temporários são repetidos (504/503/502/500/408/rede), no máximo 3 vezes", () => {
  assert.equal(S.esperaNovaTentativaGet({ status: 504, tentativa: 0 }), 1500);
  assert.equal(S.esperaNovaTentativaGet({ status: 503, tentativa: 1 }), 3000);
  assert.equal(S.esperaNovaTentativaGet({ status: 502, tentativa: 2 }), 6000);
  assert.equal(S.esperaNovaTentativaGet({ status: 504, tentativa: 3 }), null);
  assert.equal(S.esperaNovaTentativaGet({ erroRede: true, tentativa: 0 }), 1500);
  for (const s of [400, 401, 403, 404, 409, 422, 429]) assert.equal(S.esperaNovaTentativaGet({ status: s, tentativa: 0 }), null, `HTTP ${s}`);
});

test("busca exata: só critério 2 (ativos) e 3 (inativos); excluídos nunca contam", async () => {
  const b = catalogo();
  const r = await S.buscarExatoAtivosInativos({ blingGet: b.blingGet, sku: SKU });
  assert.deepEqual(r, []);
  assert.equal(b.chamadas.length, 2);
  assert.match(b.chamadas[0], /criterio=2/);
  assert.match(b.chamadas[1], /criterio=3/);
  assert.ok(b.chamadas.every((c) => !/criterio=4|criterio=5/.test(c)));
  // Mesmo que o Bling devolva um "E" num critério errado, ele é ignorado.
  const b2 = catalogo({ extras2: [{ id: 9003, codigo: SKU, nome: "x", situacao: "E" }] });
  assert.deepEqual(await S.buscarExatoAtivosInativos({ blingGet: b2.blingGet, sku: SKU }), []);
});

test("busca exata acha ativo e inativo com a mesma escrita", async () => {
  const b = catalogo({ extras3: [{ id: 7777, codigo: SKU, nome: "Inativo igual", situacao: "I" }] });
  const r = await S.buscarExatoAtivosInativos({ blingGet: b.blingGet, sku: SKU });
  assert.equal(r.length, 1);
  assert.equal(r[0].id, 7777);
});

test("cobertura: a busca exata NÃO acha o SKU escrito com hífen — a varredura acha", async () => {
  const b = catalogo({ extras2: [{ id: 8888, codigo: "8200-442891", nome: "Mesmo SKU com hífen", situacao: "A" }] });
  assert.deepEqual(await S.buscarExatoAtivosInativos({ blingGet: b.blingGet, sku: SKU }), []);
  let achado = null;
  for (let pagina = 1; pagina && !achado;) {
    const bl = await S.lerBlocoCadastro({ blingGet: b.blingGet, sku: SKU, criterio: 2, pagina });
    if (bl.achados.length) achado = bl.achados[0];
    pagina = bl.proxima;
  }
  assert.equal(achado?.id, 8888);
});

test("bloco: lê N páginas, para na página curta e indica a próxima", async () => {
  const b = catalogo({ ativos: 2550 });
  const b1 = await S.lerBlocoCadastro({ blingGet: b.blingGet, sku: SKU, criterio: 2, pagina: 1, paginas: 12 });
  assert.deepEqual([b1.de, b1.ate, b1.fim, b1.proxima, b1.lidos], [1, 12, false, 13, 1200]);
  const b2 = await S.lerBlocoCadastro({ blingGet: b.blingGet, sku: SKU, criterio: 2, pagina: 13, paginas: 12 });
  assert.deepEqual([b2.de, b2.ate, b2.fim, b2.proxima], [13, 24, false, 25]);
  const b3 = await S.lerBlocoCadastro({ blingGet: b.blingGet, sku: SKU, criterio: 2, pagina: 25, paginas: 12 });
  assert.deepEqual([b3.de, b3.ate, b3.fim, b3.proxima], [25, 26, true, null]);
  await assert.rejects(S.lerBlocoCadastro({ blingGet: b.blingGet, sku: SKU, criterio: 4, pagina: 1 }), /Critério inválido/);
});

async function recibosCompletos(b, { usuarioId = USUARIO, sku = SKU, agora = Date.now() } = {}) {
  const recibos = [];
  for (const criterio of [2, 3]) {
    for (let pagina = 1; pagina;) {
      const bl = await S.lerBlocoCadastro({ blingGet: b.blingGet, sku, criterio, pagina });
      recibos.push(await S.assinarRecibo(SEGREDO, { usuarioId, sku, bloco: bl, agora }));
      pagina = bl.proxima;
    }
  }
  return recibos;
}

test("recibos: cobertura completa de ativos + inativos é aceita", async () => {
  const b = catalogo({ ativos: 2550 });
  const recibos = await recibosCompletos(b);
  const r = await S.conferirCobertura({ segredo: SEGREDO, recibos, usuarioId: USUARIO, sku: SKU });
  assert.equal(r.ok, true, r.motivo);
  assert.equal(r.paginas, 26 + 2);
});

test("recibos: buraco, falta de inativos, adulteração, vencido, outro SKU/usuário e SKU achado são recusados", async () => {
  const b = catalogo({ ativos: 2550 });
  const ok = await recibosCompletos(b);
  const conf = (recibos, extra = {}) => S.conferirCobertura({ segredo: SEGREDO, recibos, usuarioId: USUARIO, sku: SKU, ...extra });
  assert.match((await conf(ok.filter((_, i) => i !== 1))).motivo, /páginas faltando/);
  assert.match((await conf(ok.filter((r) => r.dados.c === 2))).motivo, /inativos\) não foi feita/);
  assert.match((await conf(ok.slice(0, 2).concat(ok.filter((r) => r.dados.c === 3)))).motivo, /não chegou ao fim|páginas faltando/);
  const adulterado = ok.map((r, i) => (i === 0 ? { ...r, dados: { ...r.dados, n: 0, ate: 30, fim: true } } : r));
  assert.match((await conf(adulterado)).motivo, /adulterado/);
  assert.match((await conf(ok, { agora: Date.now() + 16 * 60_000 })).motivo, /venceu/);
  assert.match((await conf(ok, { desde: Date.now() + 1000 })).motivo, /anterior à última tentativa/);
  assert.equal((await S.conferirCobertura({ segredo: SEGREDO, recibos: ok, usuarioId: "outro", sku: SKU })).ok, false);
  assert.equal((await S.conferirCobertura({ segredo: SEGREDO, recibos: ok, usuarioId: USUARIO, sku: "8200442892" })).ok, false);
  assert.equal((await S.conferirCobertura({ segredo: "outro-segredo", recibos: ok, usuarioId: USUARIO, sku: SKU })).ok, false);
  const bAchou = catalogo({ extras3: [{ id: 1, codigo: "82.00.442.891", nome: "x", situacao: "I" }] });
  assert.match((await conf(await recibosCompletos(bAchou))).motivo, /achou este SKU/);
});

test("POST: criado só com ID; 504/5xx/rede/sem ID = incerto; 4xx = recusado", () => {
  assert.deepEqual(S.classificarRespostaCriacao({ status: 201, dados: { data: { id: 123 } } }), { resultado: "criado", id: 123 });
  assert.equal(S.classificarRespostaCriacao({ status: 200, dados: {} }).resultado, "incerto");
  for (const s of [408, 500, 502, 503, 504]) assert.equal(S.classificarRespostaCriacao({ status: s }).resultado, "incerto", `HTTP ${s}`);
  assert.equal(S.classificarRespostaCriacao({ erroRede: true }).resultado, "incerto");
  for (const s of [400, 401, 403, 409, 422, 429]) assert.equal(S.classificarRespostaCriacao({ status: s }).resultado, "recusado", `HTTP ${s}`);
});

test("criação incerta: leitura falhou = bloqueia; 1 achado = criado; 0 só vira 'não criado' após 2 min", () => {
  assert.equal(S.decidirIncerteza({ leituraOk: false }).estado, "pendente");
  assert.equal(S.decidirIncerteza({ leituraOk: true, achados: [{ id: 1 }] }).estado, "resolvido_criado");
  assert.equal(S.decidirIncerteza({ leituraOk: true, achados: [{ id: 1 }, { id: 2 }] }).estado, "pendente");
  assert.equal(S.decidirIncerteza({ leituraOk: true, achados: [], idadeMs: 30_000 }).estado, "pendente");
  assert.equal(S.decidirIncerteza({ leituraOk: true, achados: [], idadeMs: 121_000 }).estado, "resolvido_nao_criado");
});

// Servidor falso que usa as MESMAS regras (bloco + recibo) para o site.
function servidor(b) {
  return async (corpo) => {
    if (corpo.acao !== "conferir_cadastro_sku") return { ok: false, erro: "ação" };
    try {
      const bl = await S.lerBlocoCadastro({ blingGet: b.blingGet, sku: corpo.sku, criterio: corpo.criterio, pagina: corpo.pagina });
      return { ok: true, ...bl, recibo: await S.assinarRecibo(SEGREDO, { usuarioId: USUARIO, sku: corpo.sku, bloco: bl }) };
    } catch (e) {
      return { ok: false, temporario: true, erro: `Não foi possível ler o cadastro do Bling: ${e.message}` };
    }
  };
}

test("site (17/10/2026): sem varredura paginada do cadastro antes de criar", async () => {
  const fs = await import("node:fs");
  const est = fs.readFileSync(new URL("../../src/services/estoqueBlingPAIIA.js", import.meta.url), "utf8");
  const rev = fs.readFileSync(new URL("../../src/components/RevisaoPublicacaoML.jsx", import.meta.url), "utf8");
  assert.equal(/conferirCadastroBlingEmBlocos|conferir_cadastro_sku/.test(est + rev), false);
  assert.equal(/recibos:/.test(rev), false, "criar_produto vai sem recibos (verificação pontual no servidor)");
  assert.match(rev, /acao: "criar_produto", confirmado: true, confirmacao: "CRIAR_PRODUTO_BLING", produto: enviado/);
});

test("site (17/10/2026): criar só com a conferência manual marcada; dúvida de escrita nunca cria nem vincula", async () => {
  const fs = await import("node:fs");
  const rev = fs.readFileSync(new URL("../../src/components/RevisaoPublicacaoML.jsx", import.meta.url), "utf8");
  assert.match(rev, /produto: enviado, conferencia_manual: true \}/);
  assert.match(rev, /if \(!conferiSkuBling\) return;/);
  assert.match(rev, /disabled=\{cadastroBling\.faltando\.length > 0 \|\| criacaoBling\?\.ocupado \|\| !conferiSkuBling\}/);
  const i = rev.indexOf("if (r.duvida_sku) {");
  const bloco = rev.slice(i, rev.indexOf("return;", i));
  assert.ok(i > 0 && !/usarCadastroExistente|finalizarCriacaoBling/.test(bloco), "dúvida não vincula nem finaliza");
});
