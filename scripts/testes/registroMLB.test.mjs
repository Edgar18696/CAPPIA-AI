// =============================================================
// PAIIA — TESTES: registro interno de anúncios (paiia_registro_mlb) no site.
// Mercado Livre, Bling e Supabase FALSOS: nada é publicado, nada vai ao
// Bling, nenhum anúncio real é tocado.
//   node --test scripts/testes/registroMLB.test.mjs
// Caso real (dados informados): SKU 8200375417 · Bling 16719384929 ·
// MLB5398000317 · LOJA ONLINE. Os demais cenários usam dados FICTÍCIOS (99...).
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

register("./simulacao/ganchoSupabaseFalso.mjs", import.meta.url);
const { banco, zerarBanco, USUARIO } = await import("./simulacao/supabaseFalso.mjs");
const RM = await import("../../src/services/registroMLB.js");
const R = await import("../../src/services/reconhecimentoSKU.js");
const S = await import("../../src/services/registroMLBService.js");
const { conferirDuplicidadeBase, salvarFichaAprovada, salvarContaDestino, registrarMLBPublicado } = await import("../../src/services/anuncioPublicacaoService.js");

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ler = (rel) => fs.readFileSync(path.join(RAIZ, rel), "utf8").replace(/\r\n/g, "\n");
const E = R.ESTADO_RECONHECIMENTO;
const C = RM.ESTADO_CONTA;
const REV = "2412238242", LOJA = "1729335019", CIE = "824312524";
const TODAS = [{ id: REV, nome: "REVELAÇÃO", conectada: true }, { id: LOJA, nome: "LOJA ONLINE", conectada: true }, { id: CIE, nome: "CIEBR", conectada: true }];
const SKU = "8200375417", MLB = "MLB5398000317", BLING = 16719384929;
const AGORA = "2026-10-16T12:00:00.000Z";

const reg = (o) => ({ id: o.mlb_id, sku: o.sku || "99000100", sku_normalizado: RM.normalizarSku(o.sku || "99000100"), sku_confirmado: o.sku_confirmado ?? true, ml_user_id: o.ml_user_id, conta_nome: o.conta_nome || null, mlb_id: o.mlb_id, situacao: o.situacao || "desconhecida", origem: o.origem || "carga_inicial", conferido_em: o.conferido_em || null, ...o });
const item = ({ id, conta, sku = "", status = "active", sub_status = [], titulo = "Peça" }) => ({ id, seller_id: Number(conta), status, sub_status, title: titulo, seller_custom_field: sku || null, attributes: sku ? [{ id: "SELLER_SKU", value_name: sku }] : [] });
const norm = (v) => String(v ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
function mlFalso(itens, { falhaItens = [], falhaBusca = [], chamadas = [] } = {}) {
  return async (conta, caminho) => {
    chamadas.push({ conta, caminho });
    let m = caminho.match(/^\/items\/(MLB\d+)$/);
    if (m) {
      if (falhaItens.includes(m[1])) return { ok: false, erro: "HTTP 503 do Mercado Livre" };
      const it = itens.find((i) => i.id === m[1]);
      return it ? { ok: true, dados: it } : { ok: false, status: 404, erro: "not_found" };
    }
    if (falhaBusca.includes(conta)) return { ok: false, erro: "HTTP 504 do Mercado Livre" };
    m = caminho.match(/^\/users\/(\d+)\/items\/search\?seller_sku=(.+)$/);
    if (m) return { ok: true, dados: { results: itens.filter((i) => String(i.seller_id) === m[1] && i.seller_custom_field === decodeURIComponent(m[2]) && i.status !== "closed").map((i) => i.id) } };
    m = caminho.match(/^\/users\/(\d+)\/items\/search\?q=([^&]+)&limit=50$/);
    if (m) {
      const q = norm(decodeURIComponent(m[2]));
      const a = itens.filter((i) => String(i.seller_id) === m[1] && (norm(i.title).includes(q) || norm(i.seller_custom_field).includes(q)));
      return { ok: true, dados: { results: a.map((i) => i.id), paging: { total: a.length } } };
    }
    return { ok: false, erro: "caminho inesperado" };
  };
}
async function reconhecer({ codigo = "99000100", registros = [], itens = [], lerRegistro, opcoesML = {}, contas = TODAS } = {}) {
  const chamadas = [];
  const r = await R.reconhecerSKU({
    codigo, contas,
    lerBling: async () => ({ ok: true, encontrado: false }),
    lerBase: async () => ({ ok: true, anuncios: [] }),
    lerRegistro: lerRegistro || (async () => ({ ok: true, registros })),
    consultarML: mlFalso(itens, { ...opcoesML, chamadas }),
    agora: () => AGORA,
  });
  return { r, chamadas, conta: (id) => r.contas.find((c) => c.conta === id) };
}

// ---------------- regras puras ----------------
test("1) situação do anúncio no ML: pausado/inativo/em revisão EXISTEM; encerrado e excluído são histórico", () => {
  assert.equal(RM.situacaoDoItemML({ status: "active" }), "ativo");
  assert.equal(RM.situacaoDoItemML({ status: "paused" }), "pausado");
  assert.equal(RM.situacaoDoItemML({ status: "under_review" }), "em_revisao");
  assert.equal(RM.situacaoDoItemML({ status: "inactive" }), "inativo");
  assert.equal(RM.situacaoDoItemML({ status: "closed" }), "encerrado");
  assert.equal(RM.situacaoDoItemML({ status: "inactive", sub_status: ["deleted"] }), "excluido");
  assert.equal(RM.situacaoDoItemML({ status: "?" }), "desconhecida");
  for (const s of ["ativo", "pausado", "em_revisao", "inativo"]) assert.equal(RM.situacaoFinal(s), false, s);
});

test("2) MLB registrado conferido agora: existe / histórico / pendente (falha nunca libera)", () => {
  const r0 = reg({ mlb_id: "MLB9900000101", ml_user_id: LOJA });
  const av = (resp, r = r0) => RM.avaliarMLBRegistrado({ registro: r, resp, agora: AGORA });
  let a = av({ ok: true, dados: item({ id: "MLB9900000101", conta: LOJA, sku: "99000100", status: "paused" }) });
  assert.equal(a.estado, "existe"); assert.equal(a.situacao, "pausado"); assert.equal(a.atualizar.situacao, "pausado"); assert.equal(a.atualizar.conferido_em, AGORA);
  a = av({ ok: true, dados: item({ id: "MLB9900000101", conta: LOJA, status: "closed" }) });
  assert.equal(a.estado, "historico"); assert.equal(a.atualizar.situacao, "encerrado");
  for (const resp of [null, { ok: false, erro: "HTTP 500" }, { ok: false, status: 404, erro: "not_found" }, { ok: true, dados: {} },
    { ok: true, dados: item({ id: "MLB9900000101", conta: REV }) }, { ok: true, dados: { id: "MLB9900000101", seller_id: Number(LOJA), status: "???" } }]) {
    const p = av(resp);
    assert.equal(p.estado, "pendente", JSON.stringify(resp)); assert.equal(p.atualizar, null, "falha não grava nada");
  }
  // histórico: não é reconsultado nem alterado
  const h = av(null, reg({ mlb_id: "MLB9900000102", ml_user_id: LOJA, situacao: "excluido", conferido_em: AGORA }));
  assert.equal(h.estado, "historico"); assert.equal(h.atualizar, null);
  // SKU diferente no anúncio: aviso, sem trocar a identidade; SKU igual confirma pendente
  a = av({ ok: true, dados: item({ id: "MLB9900000101", conta: LOJA, sku: "OUTRO-1" }) });
  assert.equal(a.atualizar.sku_ml_divergente, "OUTRO-1"); assert.equal("sku" in a.atualizar, false);
  a = av({ ok: true, dados: item({ id: "MLB9900000101", conta: LOJA, sku: "9900-0100" }) }, { ...r0, sku_confirmado: false });
  assert.equal(a.atualizar.sku_confirmado, true);
});

test("3) situação da conta: histórico sozinho NÃO libera; só a busca ao vivo concluída sem anúncio", () => {
  const hist = [{ mlb: "MLB9900000102", estado: "historico", situacao: "excluido" }];
  assert.equal(RM.decidirConta({ conta: LOJA, avaliados: hist, busca: { verificado: true, duplicados: [], possiveis: [] } }).estado, C.LIVRE);
  assert.equal(RM.decidirConta({ conta: LOJA, avaliados: hist, busca: { erro: "HTTP 504" } }).estado, C.PENDENTE);
  assert.equal(RM.decidirConta({ conta: LOJA, avaliados: hist, busca: null }).estado, C.PENDENTE);
  assert.equal(RM.decidirConta({ conta: LOJA, avaliados: [], busca: { verificado: true, duplicados: [], possiveis: [] }, erroRegistro: "fora do ar" }).estado, C.PENDENTE);
  assert.equal(RM.decidirConta({ conta: LOJA, conectada: false, avaliados: [], busca: null }).estado, C.PENDENTE);
  // MLB registrado sem resposta segura: pendente mesmo com busca vazia
  assert.equal(RM.decidirConta({ conta: LOJA, avaliados: [{ mlb: "MLB9900000101", estado: "pendente", motivo: "HTTP 503" }], busca: { verificado: true, duplicados: [], possiveis: [] } }).estado, C.PENDENTE);
  // busca ao vivo acha anúncio ativo que o registro tinha como histórico: EXISTE (bloqueia)
  const d = RM.decidirConta({ conta: LOJA, avaliados: hist, busca: { verificado: true, duplicados: [{ id: "MLB9900000102", status: "active" }], possiveis: [] } });
  assert.equal(d.estado, C.PUBLICADO);
  // pausado bloqueia; parecido pede conferência; anúncio confirmado vira "novo" se fora do registro
  assert.equal(RM.decidirConta({ conta: LOJA, avaliados: [{ mlb: "MLB9900000101", estado: "existe", situacao: "pausado" }], busca: { verificado: true, duplicados: [], possiveis: [] } }).estado, C.PUBLICADO);
  assert.equal(RM.decidirConta({ conta: LOJA, avaliados: [], busca: { verificado: true, duplicados: [], possiveis: [{ id: "MLB9900000103", status: "active" }] } }).estado, C.POSSIVEL);
  const n = RM.decidirConta({ conta: LOJA, avaliados: [], busca: { verificado: true, duplicados: [{ id: "MLB9900000104", status: "active" }], possiveis: [] } });
  assert.deepEqual(n.novos.map((x) => x.mlb), ["MLB9900000104"]);
});

test("4) linhas e campos: identidade nunca é atualizada; SKU confirmado nunca volta; publicado começa pendente", () => {
  assert.deepEqual(RM.camposAtualizaveis({ sku: "X", mlb_id: "MLB1", ml_user_id: "1", origem: "x", situacao: "ativo", sku_confirmado: false }), { situacao: "ativo" });
  const p = RM.linhaPublicadaPAIIA({ sku: SKU, conta: LOJA, contaNome: "LOJA ONLINE", mlb: MLB, blingProdutoId: BLING });
  assert.equal(p.sku_confirmado, false); assert.equal(p.origem, "publicado_paiia"); assert.equal(p.situacao, "ativo"); assert.equal(RM.linhaValida(p), true);
  const u = RM.linhaConfirmadaUsuario({ sku: "99000100", conta: LOJA, mlb: "MLB9900000103", status: "active" });
  assert.equal(u.sku_confirmado, false); assert.equal(u.origem, "confirmado_usuario");
  const m = RM.linhaConfirmadaML({ sku: "99000100", conta: LOJA, mlb: "MLB9900000104", status: "paused" });
  assert.equal(m.sku_confirmado, true); assert.equal(m.situacao, "pausado"); assert.equal(RM.linhaValida(m), true);
  assert.equal(RM.linhaValida({ ...m, sku_confirmado: false }), false, "confirmado_ml exige SKU confirmado");
  assert.equal(RM.linhaValida({ ...m, mlb_id: "MLB12" }), false);
});

// ---------------- reconhecimento com o registro ----------------
test("5) caso real: MLB5398000317 registrado na LOJA ONLINE é conferido agora e só a LOJA ONLINE fica ocupada", async () => {
  const registros = [reg({ sku: SKU, mlb_id: MLB, ml_user_id: LOJA, conta_nome: "LOJA ONLINE", bling_produto_id: BLING })];
  const itens = [item({ id: MLB, conta: LOJA, sku: SKU, titulo: "Peça Renault 8200375417" })];
  const { r, conta, chamadas } = await reconhecer({ codigo: SKU, registros, itens });
  assert.equal(conta(LOJA).estado, E.ENCONTRADO);
  assert.equal(conta(LOJA).estadoConta, C.PUBLICADO);
  assert.deepEqual(conta(LOJA).anuncios.map((a) => [a.mlb, a.situacao]), [[MLB, "ativo"]]);
  assert.equal(conta(REV).estadoConta, C.LIVRE); assert.equal(conta(CIE).estadoConta, C.LIVRE);
  assert.ok(chamadas.some((c) => c.conta === LOJA && c.caminho === `/items/${MLB}`), "conferido na conta dele");
  assert.equal(chamadas.some((c) => c.conta !== LOJA && c.caminho === `/items/${MLB}`), false, "nunca conferido em outra conta");
  assert.equal(r.gravacoes.inserir.length, 0, "já registrado: nada novo");
  assert.deepEqual(r.gravacoes.atualizar.map((u) => [u.registro.mlb_id, u.campos.situacao]), [[MLB, "ativo"]]);
  assert.equal(r.registro.estado, E.ENCONTRADO);
});

test("6) anúncio confirmado pelo ML fora do registro: registrar automático; parecido: só com confirmação", async () => {
  const itens = [item({ id: "MLB9900000201", conta: CIE, sku: "99000100", status: "paused" }), item({ id: "MLB9900000202", conta: REV, sku: "", titulo: "Peça 99000100 kit" })];
  const { r, conta } = await reconhecer({ itens });
  assert.equal(conta(CIE).estadoConta, C.PUBLICADO, "pausado conta como existente");
  assert.deepEqual(r.gravacoes.inserir.map((l) => [l.mlb_id, l.ml_user_id, l.origem, l.sku_confirmado, l.situacao]), [["MLB9900000201", CIE, "confirmado_ml", true, "pausado"]]);
  assert.equal(conta(REV).estadoConta, C.POSSIVEL);
  assert.equal(r.gravacoes.inserir.some((l) => l.mlb_id === "MLB9900000202"), false, "parecido não é gravado sozinho");
});

test("7) falhas viram 'Verificação pendente' (registro, MLB registrado, busca) e nada é gravado por falha", async () => {
  let { r, conta } = await reconhecer({ lerRegistro: async () => ({ ok: false, erro: "tabela indisponível" }) });
  assert.equal(r.registro.estado, E.INCOMPLETA);
  for (const id of [REV, LOJA, CIE]) assert.equal(conta(id).estadoConta, C.PENDENTE);
  assert.equal(R.TEXTO_INCOMPLETA, "Verificação pendente");
  assert.equal(r.gravacoes.inserir.length + r.gravacoes.atualizar.length, 0);
  ({ r, conta } = await reconhecer({ registros: [reg({ mlb_id: "MLB9900000301", ml_user_id: LOJA })], itens: [item({ id: "MLB9900000301", conta: LOJA, sku: "99000100" })], opcoesML: { falhaItens: ["MLB9900000301"] } }));
  assert.equal(conta(LOJA).estadoConta, C.PENDENTE);
  assert.equal(r.gravacoes.atualizar.length, 0, "sem resposta segura: registro não muda");
  ({ conta } = await reconhecer({ opcoesML: { falhaBusca: [CIE] } }));
  assert.equal(conta(CIE).estadoConta, C.PENDENTE);
  ({ conta } = await reconhecer({ contas: [{ id: REV, nome: "REVELAÇÃO", conectada: false, motivo: "conta não conectada ao PAIIA" }, ...TODAS.slice(1)], registros: [reg({ mlb_id: "MLB9900000302", ml_user_id: REV })] }));
  assert.equal(conta(REV).estadoConta, C.PENDENTE);
});

test("8) histórico (excluído) + busca sem anúncio = livre, mostrando o histórico; nada é alterado no histórico", async () => {
  const registros = [reg({ mlb_id: "MLB9900000401", ml_user_id: LOJA, situacao: "excluido", conferido_em: AGORA })];
  const { r, conta, chamadas } = await reconhecer({ registros });
  assert.equal(conta(LOJA).estadoConta, C.LIVRE);
  assert.deepEqual(conta(LOJA).historico.map((h) => h.mlb), ["MLB9900000401"]);
  assert.equal(chamadas.some((c) => c.caminho === "/items/MLB9900000401"), false, "histórico não é reconsultado");
  assert.equal(r.gravacoes.atualizar.length, 0);
});

test("9) mesmo SKU em contas diferentes: cada conta decide sozinha", async () => {
  const registros = [reg({ mlb_id: "MLB9900000501", ml_user_id: REV }), reg({ mlb_id: "MLB9900000502", ml_user_id: CIE })];
  const itens = [item({ id: "MLB9900000501", conta: REV, sku: "99000100" }), item({ id: "MLB9900000502", conta: CIE, sku: "99000100", status: "closed" })];
  const { conta } = await reconhecer({ registros, itens });
  assert.equal(conta(REV).estadoConta, C.PUBLICADO);
  assert.equal(conta(CIE).estadoConta, C.LIVRE, "encerrado confirmado agora + busca vazia");
  assert.equal(conta(LOJA).estadoConta, C.LIVRE);
});

test("10) os 16 MLBs da carga (14 desconhecidos + 2 excluídos) são preservados: histórico intocado, nenhuma linha some", async () => {
  zerarBanco();
  const linhas = [];
  for (let i = 0; i < 14; i += 1) linhas.push({ usuario_id: USUARIO, ...reg({ mlb_id: `MLB99000006${String(i).padStart(2, "0")}`, ml_user_id: LOJA, sku: "99000600" }) });
  linhas.push({ usuario_id: USUARIO, ...reg({ mlb_id: "MLB9900000690", ml_user_id: LOJA, sku: "99000600", situacao: "excluido", conferido_em: AGORA, sku_confirmado: false }) });
  linhas.push({ usuario_id: USUARIO, ...reg({ mlb_id: "MLB9900000691", ml_user_id: LOJA, sku: "99000600", situacao: "excluido", conferido_em: AGORA, sku_confirmado: false }) });
  banco.tabelas.paiia_registro_mlb.push(...linhas);
  const antesExcluidos = JSON.stringify(banco.tabelas.paiia_registro_mlb.filter((l) => l.situacao === "excluido"));
  const lido = await S.lerRegistroDoSKU("99000600");
  assert.equal(lido.ok, true); assert.equal(lido.registros.length, 16);
  const itens = lido.registros.filter((l) => l.situacao !== "excluido").map((l, i) => item({ id: l.mlb_id, conta: LOJA, sku: "99000600", status: i % 2 ? "paused" : "active" }));
  const { r } = await reconhecer({ codigo: "99000600", registros: lido.registros, itens });
  const g = await S.aplicarGravacoesRegistro(r.gravacoes);
  assert.equal(g.falhas.length, 0); assert.equal(g.atualizados, 14);
  assert.equal(banco.tabelas.paiia_registro_mlb.length, 16, "nenhuma linha some nem é duplicada");
  assert.equal(JSON.stringify(banco.tabelas.paiia_registro_mlb.filter((l) => l.situacao === "excluido")), antesExcluidos, "os 2 excluídos ficam idênticos");
  assert.equal(banco.chamadas.some((c) => c.tabela === "paiia_registro_mlb" && c.op === "delete"), false);
});

// ---------------- serviço do registro (Supabase falso) ----------------
test("11) gravar no registro: novo; repetido na mesma conta = já registrado; outra conta = conflito sem gravar", async () => {
  zerarBanco();
  const l = RM.linhaConfirmadaML({ sku: "99000700", conta: LOJA, mlb: "MLB9900000701", status: "active" });
  assert.deepEqual(await S.registrarLinha(l), { ok: true, novo: true });
  const de_novo = await S.registrarLinha(l);
  assert.equal(de_novo.ok, true); assert.equal(de_novo.novo, false);
  const outra = await S.registrarLinha({ ...l, ml_user_id: CIE });
  assert.equal(outra.ok, false); assert.equal(outra.conflito, true);
  assert.equal(banco.tabelas.paiia_registro_mlb.length, 1);
  assert.equal((await S.registrarLinha({ ...l, mlb_id: "XYZ" })).ok, false, "linha inválida não é enviada");
  // atualização nunca toca histórico
  banco.tabelas.paiia_registro_mlb[0].situacao = "encerrado";
  banco.tabelas.paiia_registro_mlb[0].conferido_em = AGORA;
  const r = await S.atualizarConferencia(banco.tabelas.paiia_registro_mlb[0], { situacao: "ativo" });
  assert.equal(r.ignorado, true); assert.equal(banco.tabelas.paiia_registro_mlb[0].situacao, "encerrado");
});

test("12) publicação: grava 'publicado pelo PAIIA' (SKU pendente) e confirma o SKU só depois; falha não desfaz nada", async () => {
  zerarBanco();
  const r1 = await S.registrarPublicadoNoRegistro({ sku: SKU, conta: LOJA, contaNome: "LOJA ONLINE", mlb: MLB, anuncioId: "f1", blingProdutoId: BLING, esperar: async () => {} });
  assert.equal(r1.ok, true);
  const l = banco.tabelas.paiia_registro_mlb[0];
  assert.deepEqual([l.mlb_id, l.ml_user_id, l.origem, l.sku_confirmado, l.situacao, l.bling_produto_id], [MLB, LOJA, "publicado_paiia", false, "ativo", BLING]);
  assert.equal((await S.confirmarSkuPublicado({ mlb: MLB, conta: LOJA })).ok, true);
  assert.equal(banco.tabelas.paiia_registro_mlb[0].sku_confirmado, true);
  // falha ao gravar: 3 tentativas, ok:false (a tela avisa; nada é republicado)
  zerarBanco();
  banco.falhar = { "paiia_registro_mlb:insert": true };
  let tentativas = 0;
  const r2 = await S.registrarPublicadoNoRegistro({ sku: SKU, conta: LOJA, mlb: MLB, esperar: async () => { tentativas += 1; } });
  assert.equal(r2.ok, false); assert.equal(tentativas, 3);
  const rev = ler("src/components/RevisaoPublicacaoML.jsx");
  assert.ok(rev.includes("registrarPublicadoNoRegistro({") && rev.includes("NÃO publique de novo"));
  assert.ok(/if \(g\.ok && !g\.comPendencia && r\?\.ok && r\.publicado && r\.item_id\) \{\s*await confirmarSkuPublicado/.test(rev), "SKU confirmado só sem pendência");
});

test("13) Publicação: MLB do registro NESTA conta entra na conferência; histórico e outras contas não; falha bloqueia", async () => {
  zerarBanco();
  const ap = await salvarFichaAprovada({ anuncioId: "", codigo: "99000800", titulo: "Peça", dadosConferencia: { ficha: {} } });
  await salvarContaDestino({ anuncioId: ap.anuncioId, codigo: "99000800", titulo: "Peça", contaId: LOJA, contaNome: "LOJA ONLINE" });
  banco.tabelas.paiia_registro_mlb.push(
    { usuario_id: USUARIO, ...reg({ sku: "99000800", mlb_id: "MLB9900000801", ml_user_id: LOJA, situacao: "pausado" }) },
    { usuario_id: USUARIO, ...reg({ sku: "99000800", mlb_id: "MLB9900000802", ml_user_id: LOJA, situacao: "excluido", conferido_em: AGORA }) },
    { usuario_id: USUARIO, ...reg({ sku: "99000800", mlb_id: "MLB9900000803", ml_user_id: CIE, situacao: "ativo" }) },
  );
  let d = await conferirDuplicidadeBase({ codigo: "99000800", sku: "9900-0800", contaId: LOJA });
  assert.equal(d.ok, true);
  assert.deepEqual(d.registros.map((x) => x.mlb_id), ["MLB9900000801"], "só o não-histórico desta conta");
  d = await conferirDuplicidadeBase({ codigo: "99000800", sku: "99000800", contaId: REV });
  assert.deepEqual(d.registros, [], "outra conta: o registro da LOJA ONLINE/CIEBR não bloqueia");
  banco.falhar = { "paiia_registro_mlb:select": true };
  d = await conferirDuplicidadeBase({ codigo: "99000800", sku: "99000800", contaId: LOJA });
  assert.equal(d.ok, false, "registro indisponível = BLOQUEIA");
  assert.match(d.erro, /registro interno/);
});

test("14) publicado + falha no registro: o MLB fica na publicação e continua bloqueando nova publicação na conta", async () => {
  zerarBanco();
  const ap = await salvarFichaAprovada({ anuncioId: "", codigo: "99000900", titulo: "Peça", dadosConferencia: { ficha: {} } });
  await salvarContaDestino({ anuncioId: ap.anuncioId, codigo: "99000900", titulo: "Peça", contaId: LOJA, contaNome: "LOJA ONLINE" });
  await registrarMLBPublicado({ anuncioId: ap.anuncioId, contaId: LOJA, mlb: "MLB9900000901", sku: "99000900", registro: { mlb: "MLB9900000901" } });
  banco.falhar = { "paiia_registro_mlb:insert": true };
  const r = await S.registrarPublicadoNoRegistro({ sku: "99000900", conta: LOJA, mlb: "MLB9900000901", esperar: async () => {} });
  assert.equal(r.ok, false);
  banco.falhar = {};
  const d = await conferirDuplicidadeBase({ codigo: "99000900", sku: "99000900", contaId: LOJA });
  assert.deepEqual(d.registros.map((x) => x.mlb_id), ["MLB9900000901"], "a publicação guarda o MLB e bloqueia");
  assert.equal(banco.tabelas.paiia_anuncios_publicacoes[0].mlb_id, "MLB9900000901");
});

test("15) Publicação mantém o bloqueio pelo registro interno (quadro de SKU removido)", () => {
  // Quadro de SKU do Novo Anúncio removido (17/10/2026: sem busca automática).
  assert.equal(fs.existsSync(path.join(RAIZ, "src/components/PainelSKUExistente.jsx")), false);
  const svc = ler("src/services/anuncioPublicacaoService.js");
  assert.ok(svc.includes("registrosQueBloqueiam(reg.registros, conta)"));
  assert.ok(svc.includes("registro interno de anúncios indisponível"));
  const rev = ler("src/components/RevisaoPublicacaoML.jsx");
  assert.equal((rev.match(/registrarPublicadoNoRegistro\(/g) || []).length, 1, "registro só depois de publicação confirmada pelo ML");
  assert.ok(rev.indexOf("registrarPublicadoNoRegistro({") > rev.indexOf("if (r?.ok && r.publicado && r.item_id) {"));
});
