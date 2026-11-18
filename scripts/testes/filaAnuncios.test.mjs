// =============================================================
// PAIIA — TESTES (17/11/2026): Central do Paizinho — FILA DE ANÚNCIOS SEM REPETIÇÃO.
// ML e Bling FALSOS (sem rede). Repositório do navegador com armazenamento em memória
// ("fechar e reabrir" = novo repositório lendo o mesmo armazenamento).
//   node --test scripts/testes/filaAnuncios.test.mjs
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const F = await import("../../src/services/paizinhoAuditoria/filaAnuncios.js");
const R = await import("../../src/services/paizinhoAuditoria/filaRepositorio.js");
const { executarAuditoria } = await import("../../src/services/paizinhoAuditoria/index.js");
const { CONTA, AGORA, ITENS, mlFalso, blingFalso } = await import("./apoio/paizinhoAuditoriaFalso.mjs");

const CIEBR = "824312524";
const REVELACAO = "2412238242";

function memoria({ falharEscrita = false } = {}) {
  const m = new Map();
  return {
    falhar: falharEscrita,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem(k, v) { if (this.falhar) throw new Error("QuotaExceededError"); m.set(k, String(v)); },
    removeItem: (k) => m.delete(k),
    dados: m,
  };
}

/** ML falso com N anúncios ativos (cópias do cenário MLB1 com ids próprios) para a conta pedida. */
function mlComAnuncios(conta, n) {
  const base = mlFalso();
  const ids = Array.from({ length: n }, (_, i) => `MLB${7000000000 + i}`);
  const item = (id) => ({ ...ITENS.MLB1, id, seller_id: Number(conta), permalink: `https://produto.mercadolivre.com.br/${id}`, attributes: ITENS.MLB1.attributes.map((a) => (a.id === "SELLER_SKU" ? { ...a, value_name: `SKU-${id}` } : a)) });
  const lidos = [];
  const consultar = async (caminho) => {
    const u = new URL(`https://api${caminho}`);
    if (u.pathname === `/users/${conta}`) return { ok: true, status: 200, dados: { id: Number(conta), nickname: "x", site_id: "MLB" } };
    if (u.pathname === `/users/${conta}/items/search`) {
      const off = Number(u.searchParams.get("offset") || 0);
      return { ok: true, status: 200, dados: { results: ids.slice(off, off + 100), paging: { total: ids.length } } };
    }
    if (u.pathname === "/items") {
      const pedidos = u.searchParams.get("ids").split(",");
      lidos.push(...pedidos);
      return { ok: true, status: 200, dados: pedidos.map((id) => ({ code: 200, body: item(id) })) };
    }
    return base.consultar(caminho.replaceAll(`/users/${conta}`, `/users/${CONTA}`).replace(`seller=${conta}`, `seller=${CONTA}`));
  };
  return { consultar, ids, lidos };
}

/** Uma rodada completa como no navegador: escolhe na fila, analisa, monta e registra. */
async function rodada({ repo, conta, modo, quantidade, ml, falharNoMeio = false }) {
  const estado = await repo.carregar();
  const info = {};
  const escolherIds = (idsAtivos, { total, completa }) => {
    const ined = F.escolherIneditos(idsAtivos, estado, quantidade);
    Object.assign(info, { total, completa, ineditosAntes: ined.ineditosAntes });
    info.escolhidos = modo === F.MODO.NOVOS ? ined.escolhidos : F.escolherReanalise(idsAtivos, estado, quantidade);
    if (falharNoMeio) throw new Error("queda simulada no meio da análise");
    return info.escolhidos;
  };
  const rel = await executarAuditoria({ conta, consultar: ml.consultar, consultarBling: blingFalso, agora: AGORA, opcoesColeta: { limiteItens: quantidade, escolherIds } });
  const m = F.montarRodada({ conta, modo, rel, ativosTotal: info.total, ineditosAntes: info.ineditosAntes, listaCompleta: info.completa });
  assert.equal(m.ok, true, m.erro);
  const r = await repo.registrarRodada(m.rodada);
  return { rel, rodada: m.rodada, r, escolhidos: info.escolhidos };
}

test("1-2) 20 inéditos, depois mais 20 sem repetição; indicadores por conta", async () => {
  const arm = memoria();
  const repo = R.repositorioNavegador(arm, CONTA);
  const ml = mlComAnuncios(CONTA, 55);
  const a = await rodada({ repo, conta: CONTA, modo: F.MODO.NOVOS, quantidade: 20, ml });
  assert.equal(a.r.ok, true);
  assert.equal(a.rodada.anuncios.length, 20);
  const b = await rodada({ repo, conta: CONTA, modo: F.MODO.NOVOS, quantidade: 20, ml });
  const repetidos = b.rodada.anuncios.filter((x) => a.rodada.anuncios.some((y) => y.mlb === x.mlb));
  assert.deepEqual(repetidos, [], "nenhum anúncio repetido na 2ª rodada");
  // só os escolhidos foram lidos a fundo (não a conta inteira)
  assert.equal(new Set(ml.lidos).size, 40);
  const ind = F.indicadores(await repo.carregar());
  assert.deepEqual([ind.total, ind.analisados, ind.restantes], [55, 40, 15]);
  assert.ok(ind.pendentes > 0, "o cenário MLB1 tem prejuízo: pendente");
  // 3ª rodada pega só os 15 que faltam; 4ª: nada inédito
  const c = await rodada({ repo, conta: CONTA, modo: F.MODO.NOVOS, quantidade: 20, ml });
  assert.equal(c.rodada.anuncios.length, 15);
  assert.equal(F.indicadores(await repo.carregar()).restantes, 0);
  assert.deepEqual(F.escolherIneditos(ml.ids, await repo.carregar(), 20).escolhidos, []);
});

test("3) fechar e reabrir: o progresso continua (novo repositório lendo o mesmo armazenamento)", async () => {
  const arm = memoria();
  const ml = mlComAnuncios(CONTA, 30);
  await rodada({ repo: R.repositorioNavegador(arm, CONTA), conta: CONTA, modo: F.MODO.NOVOS, quantidade: 20, ml });
  const reaberto = R.repositorioNavegador(arm, CONTA);
  const e = await reaberto.carregar();
  assert.equal(F.indicadores(e).analisados, 20);
  const d = await rodada({ repo: reaberto, conta: CONTA, modo: F.MODO.NOVOS, quantidade: 20, ml });
  assert.equal(d.rodada.anuncios.length, 10, "só os 10 restantes");
});

test("4) contas não se misturam: fila e histórico da CIEBR não aparecem na LOJA ONLINE nem na REVELAÇÃO", async () => {
  const arm = memoria();
  const ciebr = R.repositorioNavegador(arm, CIEBR);
  await rodada({ repo: ciebr, conta: CIEBR, modo: F.MODO.NOVOS, quantidade: 20, ml: mlComAnuncios(CIEBR, 25) });
  assert.equal(F.indicadores(await ciebr.carregar()).analisados, 20);
  assert.equal(F.indicadores(await R.repositorioNavegador(arm, CONTA).carregar()).analisados, 0);
  assert.equal(F.indicadores(await R.repositorioNavegador(arm, REVELACAO).carregar()).analisados, 0);
  // rodada de uma conta não entra na fila de outra
  const r = await ciebr.carregar();
  const rodadaCiebr = Object.values(r.rodadas)[0];
  assert.equal(F.aplicarRodada(F.estadoVazio(REVELACAO), { ...rodadaCiebr, anuncios: [] }).aplicada, false);
  // relatório de outra conta não vira rodada
  const relLoja = await executarAuditoria({ conta: CONTA, consultar: mlFalso().consultar, consultarBling: blingFalso, agora: AGORA });
  assert.equal(F.montarRodada({ conta: CIEBR, modo: F.MODO.NOVOS, rel: relLoja }).ok, false);
});

test("5) Resolvido, Remover da lista (com motivo) e Reanalisar (não conta como inédito)", async () => {
  const arm = memoria();
  const repo = R.repositorioNavegador(arm, CONTA);
  const ml = mlComAnuncios(CONTA, 25);
  await rodada({ repo, conta: CONTA, modo: F.MODO.NOVOS, quantidade: 20, ml });
  let e = await repo.carregar();
  const [p1, p2] = F.pendenciasAbertas(e);
  assert.ok(p1 && p2);
  const pend0 = F.indicadores(e).pendentes;
  // Resolvido: registra, não apaga histórico
  assert.equal((await repo.registrarAcao({ id: "a1", conta: CONTA, acao: "resolvido", mlb: p1.item_id, area: p1.area, em: "2026-11-17T12:00:00Z" })).ok, true);
  e = await repo.carregar();
  assert.equal(F.statusPendencia(e, p1), F.STATUS.RESOLVIDA);
  assert.ok(e.eventos.some((x) => x.tipo === "resolvido" && x.mlb === p1.item_id));
  assert.ok(e.eventos.some((x) => x.tipo === "analise" && x.mlb === p1.item_id), "análise continua no histórico");
  // Remover: exige motivo; com motivo sai só da lista
  assert.equal((await repo.registrarAcao({ id: "a2", conta: CONTA, acao: "removido", mlb: p2.item_id, area: p2.area, em: "2026-11-17T12:01:00Z" })).ok, false);
  assert.equal((await repo.registrarAcao({ id: "a3", conta: CONTA, acao: "removido", mlb: p2.item_id, area: p2.area, motivo: "Anúncio será tratado depois", em: "2026-11-17T12:01:00Z" })).ok, true);
  e = await repo.carregar();
  assert.equal(F.statusPendencia(e, p2), F.STATUS.REMOVIDA);
  assert.ok(!F.pendenciasAbertas(e).some((x) => x.item_id === p2.item_id && x.area === p2.area));
  assert.ok(F.indicadores(e).pendentes <= pend0);
  // mesma ação de novo (clique duplo / recarga) não duplica
  const antes = e.eventos.length;
  assert.equal((await repo.registrarAcao({ id: "a1", conta: CONTA, acao: "resolvido", mlb: p1.item_id, area: p1.area, em: "x" })).ja, true);
  assert.equal((await repo.carregar()).eventos.length, antes);
  // Reanalisar: só já analisados, não muda "analisados" nem "restantes"
  const ind1 = F.indicadores(await repo.carregar());
  const re = await rodada({ repo, conta: CONTA, modo: F.MODO.REANALISE, quantidade: 20, ml });
  assert.ok(re.rodada.anuncios.every((x) => e.anuncios[x.mlb]), "só anúncios já analisados");
  e = await repo.carregar();
  const ind2 = F.indicadores(e);
  assert.equal(ind2.analisados, ind1.analisados);
  assert.equal(e.anuncios[p1.item_id].analises, 2);
  assert.ok(e.eventos.some((x) => x.tipo === "reanalise"));
  // a reanálise ainda achou o problema marcado como resolvido → reaberto, com aviso; removido continua fora
  assert.equal(F.statusPendencia(e, p1), F.STATUS.ABERTA);
  assert.equal(e.pendencias[F.chavePendencia(p1.item_id, p1.area)].reaberta, true);
  assert.equal(F.statusPendencia(e, p2), F.STATUS.REMOVIDA);
  // Voltar para a lista
  await repo.registrarAcao({ id: "a4", conta: CONTA, acao: "devolvido", mlb: p2.item_id, area: p2.area, em: "2026-11-17T12:05:00Z" });
  assert.equal(F.statusPendencia(await repo.carregar(), p2), F.STATUS.ABERTA);
});

test("pendência que some na reanálise fica resolvida ('não encontrada'); situação do anúncio acompanha", () => {
  let e = F.estadoVazio(CONTA);
  const rod = (id, pendencias) => ({ id, conta: CONTA, modo: "novos", em: `2026-11-1${id}T10:00:00Z`, anuncios: [{ mlb: "MLB9000000001", sku: "S", titulo: "t", pontuacao: 50, resultado: {}, pendencias }] });
  e = F.aplicarRodada(e, rod("1", [{ area: "margem", severidade: "alta", problema: "p", sugestao: "s" }])).estado;
  assert.equal(e.anuncios.MLB9000000001.situacao, F.SITUACAO.PENDENTE);
  e = F.aplicarRodada(e, { ...rod("2", []), modo: "reanalise" }).estado;
  assert.equal(e.pendencias["MLB9000000001|margem"].status, F.STATUS.RESOLVIDA);
  assert.equal(e.pendencias["MLB9000000001|margem"].motivo, "não encontrada na reanálise");
  assert.equal(e.anuncios.MLB9000000001.situacao, F.SITUACAO.RESOLVIDO);
  assert.equal(e.anuncios.MLB9000000001.analises, 2);
});

test("6) falha no meio da análise: nada registrado; falha ao salvar: nada pela metade; mesma rodada de novo não duplica", async () => {
  const arm = memoria();
  const repo = R.repositorioNavegador(arm, CONTA);
  const ml = mlComAnuncios(CONTA, 30);
  await assert.rejects(() => rodada({ repo, conta: CONTA, modo: F.MODO.NOVOS, quantidade: 20, ml, falharNoMeio: true }), /queda simulada/);
  assert.equal(F.indicadores(await repo.carregar()).analisados, 0, "nada registrado");
  // análise ok, mas a escrita falha (sem espaço): estado anterior intacto
  const ok1 = await rodada({ repo, conta: CONTA, modo: F.MODO.NOVOS, quantidade: 20, ml });
  assert.equal(ok1.r.ok, true);
  const antes = await repo.carregar();
  arm.falhar = true;
  const relFalho = await executarAuditoria({ conta: CONTA, consultar: ml.consultar, consultarBling: blingFalso, agora: AGORA, opcoesColeta: { limiteItens: 10, escolherIds: (ids) => F.escolherIneditos(ids, antes, 10).escolhidos } });
  const m = F.montarRodada({ conta: CONTA, modo: F.MODO.NOVOS, rel: relFalho, ativosTotal: 30, ineditosAntes: 10 });
  const falhou = await repo.registrarRodada(m.rodada);
  assert.equal(falhou.ok, false);
  assert.match(falhou.erro, /Não foi possível salvar/);
  assert.equal(F.indicadores(await repo.carregar()).analisados, 20, "nenhum registro pela metade");
  // escrita volta: a MESMA rodada (guardada para regravar) entra uma vez só
  arm.falhar = false;
  assert.equal((await repo.registrarRodada(m.rodada)).ok, true);
  const dup = await repo.registrarRodada(m.rodada);
  assert.equal(dup.ja, true);
  const e = await repo.carregar();
  assert.equal(F.indicadores(e).analisados, 30);
  assert.equal(e.eventos.filter((x) => x.tipo === "analise").length, 30, "um evento de 1ª análise por anúncio");
  assert.equal(R.repositorioNavegador(arm, CONTA).registro().filter((x) => x.tipo === "rodada").length, 2);
});

test("leitura incompleta não é registrada como análise concluída", async () => {
  const rel = await executarAuditoria({ conta: CONTA, consultar: mlFalso().consultar, consultarBling: blingFalso, agora: AGORA });
  assert.equal(F.montarRodada({ conta: CONTA, modo: F.MODO.NOVOS, rel: { ...rel, leitura_incompleta: { bling: { lidos: 1, total: 6 } } } }).ok, false);
  assert.equal(F.montarRodada({ conta: CONTA, modo: "outro", rel }).ok, false);
});

test("envio do registro do navegador ao banco: na ordem, sem duplicar, para no primeiro erro", async () => {
  const arm = memoria();
  const local = R.repositorioNavegador(arm, CONTA);
  await rodada({ repo: local, conta: CONTA, modo: F.MODO.NOVOS, quantidade: 5, ml: mlComAnuncios(CONTA, 10) });
  const p = F.pendenciasAbertas(await local.carregar())[0];
  await local.registrarAcao({ id: "x1", conta: CONTA, acao: "resolvido", mlb: p.item_id, area: p.area, em: "2026-11-17T13:00:00Z" });
  // "banco" falso com as mesmas regras (como o SQL): idempotente pelo id
  let estadoBanco = F.estadoVazio(CONTA);
  const ordem = [];
  const banco = {
    registrarRodada: async (r) => { ordem.push("rodada"); const x = F.aplicarRodada(estadoBanco, r); estadoBanco = x.estado; return { ok: true, ja: !!x.ja }; },
    registrarAcao: async (a) => { ordem.push("acao"); const x = F.aplicarAcao(estadoBanco, a); estadoBanco = x.estado; return { ok: true, ja: !!x.ja }; },
  };
  assert.deepEqual(await R.enviarRegistroParaBanco(local.registro(), banco), { ok: true, enviados: 2, jaExistiam: 0 });
  assert.deepEqual(ordem, ["rodada", "acao"]);
  assert.deepEqual(await R.enviarRegistroParaBanco(local.registro(), banco), { ok: true, enviados: 0, jaExistiam: 2 });
  assert.deepEqual(F.indicadores(estadoBanco), F.indicadores(await local.carregar()), "banco = navegador");
  const quebrado = { registrarRodada: async () => ({ ok: false, erro: "fora do ar" }), registrarAcao: async () => ({ ok: true }) };
  assert.equal((await R.enviarRegistroParaBanco(local.registro(), quebrado)).ok, false);
});

test("banco sem a migração é reconhecido (usa o navegador); SQL pendente segue as mesmas regras e não toca ML/Bling", () => {
  assert.equal(R.semEstruturaNoBanco({ code: "PGRST205", message: "Could not find the table" }), true);
  assert.equal(R.semEstruturaNoBanco({ code: "PGRST202", message: "Could not find the function" }), true);
  assert.equal(R.semEstruturaNoBanco({ code: "42501", message: "permission denied" }), false);
  const sql = fs.readFileSync(path.join(RAIZ, "supabase/pendentes/20261117_paizinho_fila_anuncios.sql"), "utf8");
  assert.match(sql, /PENDENTE — NÃO APLICADO/);
  assert.match(sql, /on conflict \(id\) do nothing;\s+get diagnostics v_n = row_count;\s+if v_n = 0 then return jsonb_build_object\('ok', true, 'ja_registrada', true\)/, "rodada idempotente");
  assert.match(sql, /status = case when paiia_paizinho_pendencias.status = 'removida' then 'removida' else 'aberta' end/, "removida continua fora; resolvida reabre");
  assert.match(sql, /motivo = 'não encontrada na reanálise'/);
  assert.match(sql, /'removido' and coalesce\(trim\(p->>'motivo'\), ''\) = ''/, "remover exige motivo");
  for (const t of ["paiia_paizinho_rodadas", "paiia_paizinho_anuncios", "paiia_paizinho_pendencias", "paiia_paizinho_eventos"]) assert.match(sql, new RegExp(`alter table public.${t} enable row level security`));
  const codigo = sql.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  assert.doesNotMatch(codigo, /drop table|bling|contas_marketplace|produtos/i, "só tabelas novas; nada de Bling/contas/produtos");
  // a fila não chama ML/Bling/Supabase nas regras puras
  const puro = fs.readFileSync(path.join(RAIZ, "src/services/paizinhoAuditoria/filaAnuncios.js"), "utf8");
  assert.doesNotMatch(puro, /^import /m, "regras puras: sem importações");
  assert.doesNotMatch(puro, /fetch\(|invoke\(|\.rpc\(|\.from\(/);
});
