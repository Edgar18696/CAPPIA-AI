// Criação segura no Bling (13/10/2026): consulta exata em ativos/inativos,
// varredura em blocos com recibo e retomada, tentativas só em GET,
// classificação do POST e decisão da criação incerta. Nada vai à rede.
import test from "node:test";
import assert from "node:assert/strict";

const S = await import("../../supabase/functions/_shared/blingCriacaoSegura.js");
const { conferirCadastroBlingEmBlocos } = await import("../../src/services/estoqueBlingPAIIA.js");

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

test("site: 504 persistente num bloco para a conferência; CONTINUAR retoma do mesmo ponto e completa", async () => {
  const b = catalogo({ ativos: 2550 });
  b.falhas.set("2:13", 1); // bloco que começa na página 13 falha uma vez
  const progresso = [];
  const r1 = await conferirCadastroBlingEmBlocos({ chamar: servidor(b), sku: SKU, aoProgresso: (p) => progresso.push(`${p.criterio}:${p.pagina}`) });
  assert.equal(r1.ok, false);
  assert.deepEqual(r1.falha.criterio, 2);
  assert.equal(r1.falha.pagina, 13);
  assert.equal(r1.retomar.recibos.length, 1, "o bloco 1–12 já conferido é guardado");
  const antes = b.chamadas.length;
  const r2 = await conferirCadastroBlingEmBlocos({ chamar: servidor(b), sku: SKU, retomar: r1.retomar });
  assert.equal(r2.ok, true);
  assert.equal(r2.completo, true);
  assert.ok(!b.chamadas.slice(antes).some((c) => /pagina=1&/.test(c) && /criterio=2/.test(c)), "não relê as páginas já conferidas");
  const cob = await S.conferirCobertura({ segredo: SEGREDO, recibos: r2.recibos, usuarioId: USUARIO, sku: SKU });
  assert.equal(cob.ok, true, cob.motivo);
  assert.deepEqual(progresso.slice(0, 2), ["2:1", "2:13"]);
});

test("site: SKU achado (inativo, escrito com pontos) interrompe e devolve o cadastro existente", async () => {
  const b = catalogo({ extras3: [{ id: 4242, codigo: "82.00.442.891", nome: "Inativo", situacao: "I" }] });
  const r = await conferirCadastroBlingEmBlocos({ chamar: servidor(b), sku: SKU });
  assert.equal(r.ok, true);
  assert.equal(r.completo, false);
  assert.equal(r.achados[0].id, 4242);
});

test("site: os 2 cadastros EXCLUÍDOS do 8200442891 não impedem a criação", async () => {
  const b = catalogo();
  const r = await conferirCadastroBlingEmBlocos({ chamar: servidor(b), sku: SKU });
  assert.equal(r.ok, true);
  assert.equal(r.completo, true);
  assert.deepEqual(r.achados, []);
  assert.ok(b.chamadas.every((c) => /criterio=(2|3)/.test(c)));
});
