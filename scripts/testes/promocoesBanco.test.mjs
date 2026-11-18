// =============================================================
// PAIIA — TESTES (18/11/2026): Central de Promoções — gravação no BANCO
// (só ligada no modo de teste/STAGING), anúncios de exemplo e o modo staging.
// Supabase FALSO (sem rede): confere o que seria enviado ao banco.
//   node --test scripts/testes/promocoesBanco.test.mjs
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const BD = await import("../../src/services/promocoes/armazenamentoSupabase.js");
const SEL = await import("../../src/services/promocoes/selecao.js");
const CAMP = await import("../../src/services/promocoes/campanhas.js");
const EX = await import("../../src/services/promocoes/anunciosExemplo.js");
const L = await import("../../src/services/blackFriday/leitura.js");
const PL = await import("../../src/services/blackFriday/planilha.js");
const ler = (f) => fs.readFileSync(path.join(RAIZ, f), "utf8");

const LOJA = "1729335019", CIEBR = "824312524";
const U = "00000000-0000-4000-8000-000000000001";

/** Supabase falso: guarda as tabelas em memória e registra cada chamada. */
function supabaseFalso({ falharUpsert = false } = {}) {
  const tabelas = { paiia_promocoes_selecao: [], paiia_promocoes_metas: [], paiia_promocoes_campanhas: [] };
  const chamadas = [];
  const chaves = { paiia_promocoes_selecao: ["usuario_id", "campanha_id", "conta_ml", "mlb"], paiia_promocoes_metas: ["usuario_id", "campanha_id", "conta_ml"], paiia_promocoes_campanhas: ["id"] };
  const from = (t) => {
    const q = { filtros: [] };
    const api = {
      select() { q.op = "select"; return api; },
      eq(c, v) { q.filtros.push((r) => r[c] === v); return api; },
      in(c, vs) { q.filtros.push((r) => vs.includes(r[c])); return api; },
      upsert(linhas) {
        chamadas.push({ t, op: "upsert", linhas: structuredClone(linhas) });
        if (falharUpsert) return Promise.resolve({ error: { message: "permission denied" } });
        for (const l of linhas) {
          const k = chaves[t].map((c) => l[c]).join("|");
          const i = tabelas[t].findIndex((r) => chaves[t].map((c) => r[c]).join("|") === k);
          if (i >= 0) tabelas[t][i] = { ...tabelas[t][i], ...l }; else tabelas[t].push({ ...l });
        }
        return Promise.resolve({ error: null });
      },
      delete() { q.op = "delete"; return api; },
      then(ok, err) {
        const filtra = (r) => q.filtros.every((f) => f(r));
        if (q.op === "delete") { chamadas.push({ t, op: "delete" }); tabelas[t] = tabelas[t].filter((r) => !filtra(r)); return Promise.resolve({ error: null }).then(ok, err); }
        return Promise.resolve({ data: structuredClone(tabelas[t].filter(filtra)), error: null }).then(ok, err);
      },
    };
    return api;
  };
  return { from, tabelas, chamadas };
}

const anuncio = (id, conta = LOJA, preco = 100) => ({ conta, id, sku: `S-${id}`, titulo: `Peça ${id}`, preco_original: preco });

test("banco (STAGING): carrega, inclui sem duplicar, meta e retirada SEM apagar linha", async () => {
  const sb = supabaseFalso();
  const a = BD.criarArmazenamentoSupabase({ supabase: sb, usuarioId: U });
  await a.carregar();
  const s = SEL.criarSelecao({ adaptador: a.adaptadorSelecao, usuarioId: U, campanhaId: "black-friday-2026" });
  s.incluir([anuncio("MLB1"), anuncio("MLB2"), anuncio("MLB1")]);
  s.definirMeta(LOJA, 100);
  s.remover([SEL.chaveItemSelecao(LOJA, "MLB2")]);
  await a.aguardar();
  const sel = sb.tabelas.paiia_promocoes_selecao;
  assert.equal(sel.length, 2, "MLB1 não duplica");
  assert.ok(sel.every((r) => r.usuario_id === U && r.campanha_id === "black-friday-2026" && r.conta_ml === LOJA));
  assert.ok(sel.find((r) => r.mlb === "MLB2").removido_em, "retirar = removido_em");
  assert.equal(sb.chamadas.filter((c) => c.op === "delete" && c.t === "paiia_promocoes_selecao").length, 0, "nunca apaga linha da seleção");
  assert.deepEqual(sb.tabelas.paiia_promocoes_metas.map((m) => [m.conta_ml, m.meta]), [[LOJA, 100]]);
  // Outra instância (outro aparelho) lê o mesmo banco: a seleção aparece
  const b = BD.criarArmazenamentoSupabase({ supabase: sb, usuarioId: U });
  await b.carregar();
  const s2 = SEL.criarSelecao({ adaptador: b.adaptadorSelecao, usuarioId: U, campanhaId: "black-friday-2026" });
  assert.deepEqual(s2.listar(LOJA).map((r) => r.mlb), ["MLB1"]);
  assert.equal(s2.meta(LOJA), 100);
  // só manda o que mudou
  const antes = sb.chamadas.length;
  s2.revisar([{ conta: LOJA, id: "MLB1", preco_original: 100 }]);
  await b.aguardar();
  assert.equal(sb.chamadas.length, antes, "sem mudança, nada é enviado");
  s2.revisar([{ conta: LOJA, id: "MLB1", preco_original: 130 }]);
  await b.aguardar();
  const ult = sb.chamadas.at(-1);
  assert.equal(ult.linhas.length, 1);
  assert.equal(ult.linhas[0].revisao, true, "preço mudou → revisão gravada no banco");
});

test("banco (STAGING): rascunhos de campanha gravados/excluídos; BF nunca vai para a tabela", async () => {
  const sb = supabaseFalso();
  const a = BD.criarArmazenamentoSupabase({ supabase: sb, usuarioId: U });
  await a.carregar();
  const arm = CAMP.armazemCampanhas(a.storageCampanhas, U);
  const r = arm.salvar({ nome: "Natal 2026", inicio: "2026-12-15T00:00:00-03:00", fim: "2026-12-24T23:59:00-03:00", contas: [LOJA, CIEBR], desconto_pct: 15 }, { agora: "2026-11-18T12:00:00Z" });
  assert.equal(r.ok, true);
  await a.aguardar();
  assert.equal(sb.tabelas.paiia_promocoes_campanhas.length, 1);
  const linha = sb.tabelas.paiia_promocoes_campanhas[0];
  assert.equal(linha.usuario_id, U); assert.equal(Number(linha.desconto_pct), 15); assert.equal(linha.situacao, "rascunho");
  assert.ok(!sb.tabelas.paiia_promocoes_campanhas.some((c) => c.id === "black-friday-2026"));
  assert.deepEqual(arm.todas().map((c) => c.id), ["black-friday-2026", r.campanha.id]);
  arm.excluir(r.campanha.id);
  await a.aguardar();
  assert.equal(sb.tabelas.paiia_promocoes_campanhas.length, 0);
});

test("banco (STAGING): erro ao gravar avisa e recarrega do banco (sem fingir que gravou)", async () => {
  const sb = supabaseFalso({ falharUpsert: true });
  const erros = [];
  const a = BD.criarArmazenamentoSupabase({ supabase: sb, usuarioId: U, aoErro: (m) => erros.push(m) });
  await a.carregar();
  const s = SEL.criarSelecao({ adaptador: a.adaptadorSelecao, usuarioId: U, campanhaId: "black-friday-2026" });
  s.incluir([anuncio("MLB1")]);
  await a.aguardar();
  assert.match(erros[0], /Não foi possível gravar no banco: permission denied/);
  assert.equal(s.listar(LOJA).length, 0, "depois do erro a lista volta ao que está no banco");
});

test("anúncios de EXEMPLO: fictícios e marcados, mesma forma da leitura real, mistura útil para testar", () => {
  const lt = EX.montarLeituraExemplo({ conta: LOJA, nome: "LOJA ONLINE", agora: "2026-11-18T12:00:00Z" });
  assert.equal(lt.exemplo, true);
  const itens = lt.contas[LOJA].itens;
  assert.equal(itens.length, 40);
  assert.ok(itens.every((x) => /^MLB9\d+$/.test(x.item.id) && x.item.title.startsWith("[EXEMPLO]")));
  assert.deepEqual(EX.montarLeituraExemplo({ conta: LOJA, nome: "x", agora: "2026-11-18T12:00:00Z" }).contas[LOJA].itens.map((x) => x.item.id), itens.map((x) => x.item.id), "sempre os mesmos");
  const ls = L.montarSimulacao(lt, { perfil: { impostoPct: 6, custoPedido: 0 } });
  const cnt = (f) => ls.filter(f).length;
  assert.ok(cnt((l) => l.classe === "renault") > 0 && cnt((l) => l.classe === "demais") > 0 && cnt((l) => l.classe === "revisao") > 0);
  assert.ok(cnt((l) => PL.classificarParaPlanilha(l).lista === "PRONTO") > 0, "há PRONTO");
  assert.ok(cnt((l) => PL.classificarParaPlanilha(l).lista === "BLOQUEADO") > 0, "há BLOQUEADO");
  assert.ok(cnt((l) => l.margem_pct === null) > 0, "há margem não verificada");
  const semImposto = L.montarSimulacao(lt, { perfil: { impostoPct: null, custoPedido: 0 } });
  assert.ok(semImposto.filter(PL.selecionavel).length > 0, "sem imposto dá para selecionar");
});

test("modo staging: só com banco de teste, nunca a produção; produção continua como antes; exemplos só no teste", () => {
  const sb = ler("src/supabase.js");
  assert.match(sb, /env\.MODE === "staging" \? "staging" : "producao"/);
  assert.match(sb, /String\(env\.VITE_SUPABASE_URL\)\.includes\(PRODUCAO_REF\)/, "bloqueia a produção no modo staging");
  assert.match(sb, /const PRODUCAO_REF = "arqzpqkkpwikyecdbopf"/);
  assert.match(sb, /AMBIENTE DE TESTE \(STAGING\)/);
  const tela = ler("src/components/BlackFridayPaizinho.jsx");
  assert.match(tela, /const NO_BANCO = ambienteSupabase === "staging";/);
  assert.match(tela, /\{NO_BANCO && <div style=\{S\.aviso\}>🧪 <strong>Modo de teste/, "botão de exemplos só no modo de teste");
  assert.match(tela, /adaptador: NO_BANCO \? banco\.adaptadorSelecao : adaptadorLocal\(localStorage\)/);
  const gitignore = ler(".gitignore");
  assert.match(gitignore, /\*\.local/, "o arquivo com a chave do STAGING não vai para o git");
});
