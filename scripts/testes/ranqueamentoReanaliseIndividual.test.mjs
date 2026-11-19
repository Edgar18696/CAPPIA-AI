// =============================================================
// PAIIA — TESTES (19/11/2026): Ranqueamento — reanálise de UM anúncio sem apagar a lista,
// busca nas análises anteriores e pendências antigas com o texto atual.
// Regra do Edgar: a reanálise individual NUNCA apaga nem substitui a lista atual de 20;
// histórico, decisões e os demais anúncios são preservados.
// ML e Bling FALSOS (sem rede); fila em armazenamento de memória.
//   node --test scripts/testes/ranqueamentoReanaliseIndividual.test.mjs
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const { juntarAnuncioAoRelatorio } = await import("../../src/services/paizinhoAuditoria/juntarRelatorio.js");
const F = await import("../../src/services/paizinhoAuditoria/filaAnuncios.js");
const R = await import("../../src/services/paizinhoAuditoria/filaRepositorio.js");
const { executarAuditoria } = await import("../../src/services/paizinhoAuditoria/index.js");
const { CONTA, AGORA, ITENS, mlFalso, blingFalso } = await import("./apoio/paizinhoAuditoriaFalso.mjs");

function memoria() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
/** ML falso com N anúncios (cópias dos cenários do teste, ids próprios). */
function mlComAnuncios(n) {
  const base = mlFalso();
  const ids = Array.from({ length: n }, (_, i) => `MLB${7100000000 + i}`);
  const item = (id) => ({ ...ITENS[`MLB${(ids.indexOf(id) % 6) + 1}`], id, seller_id: Number(CONTA), attributes: ITENS[`MLB${(ids.indexOf(id) % 6) + 1}`].attributes.map((a) => (a.id === "SELLER_SKU" ? { ...a, value_name: `SKU-${id}` } : a)) });
  const consultar = async (caminho) => {
    const u = new URL(`https://api${caminho}`);
    if (u.pathname === `/users/${CONTA}/items/search`) { const o = Number(u.searchParams.get("offset") || 0); return { ok: true, status: 200, dados: { results: ids.slice(o, o + 100), paging: { total: ids.length } } }; }
    if (u.pathname === "/items") return { ok: true, status: 200, dados: u.searchParams.get("ids").split(",").map((id) => ({ code: 200, body: item(id) })) };
    return base.consultar(caminho);
  };
  return { consultar, ids };
}
const analisar = (ml, escolherIds, limiteItens) => executarAuditoria({ conta: CONTA, consultar: ml.consultar, consultarBling: blingFalso, agora: AGORA, opcoesColeta: { limiteItens, escolherIds } });

test("juntar: a reanálise de UM anúncio troca só a linha dele; os outros 20 e a ordem ficam iguais", async () => {
  const ml = mlComAnuncios(30);
  const lista20 = await analisar(ml, (ids) => ids.slice(0, 20), 20);
  const alvo = lista20.anuncios[5].item_id;
  const um = await analisar(ml, () => [alvo], 1);
  const j = juntarAnuncioAoRelatorio(lista20, um, alvo);
  assert.equal(j.ok, true);
  assert.equal(j.acrescentado, false);
  assert.equal(j.rel.anuncios.length, 20, "continua com 20");
  assert.deepEqual(j.rel.anuncios.map((a) => a.item_id), lista20.anuncios.map((a) => a.item_id), "mesma ordem");
  for (const a of lista20.anuncios.filter((x) => x.item_id !== alvo)) assert.deepEqual(j.rel.anuncios.find((x) => x.item_id === a.item_id), a, `${a.item_id} intacto`);
  assert.ok(j.rel.anuncios.find((x) => x.item_id === alvo).reanalisado_em);
  // achados e prioridades dos outros: os mesmos e na mesma ordem relativa
  const outros = (lista) => lista.filter((x) => x.item_id !== alvo).map((x) => `${x.item_id}|${x.area}|${x.problema}`);
  assert.deepEqual(outros(j.rel.prioridades), outros(lista20.prioridades));
  for (const s of lista20.secoes) assert.deepEqual(outros(j.rel.secoes.find((x) => x.chave === s.chave).achados), outros(s.achados));
  assert.deepEqual(j.rel.resumo, lista20.resumo, "números do topo da rodada não mudam");
  assert.equal(j.rel.gerado_em, lista20.gerado_em);
});

test("juntar: anúncio de rodada anterior é ACRESCENTADO (21), sem tirar ninguém; outra conta ou anúncio ausente = recusado", async () => {
  const ml = mlComAnuncios(30);
  const lista20 = await analisar(ml, (ids) => ids.slice(0, 20), 20);
  const deFora = ml.ids[25];
  const um = await analisar(ml, () => [deFora], 1);
  const j = juntarAnuncioAoRelatorio(lista20, um, deFora);
  assert.equal(j.acrescentado, true);
  assert.equal(j.rel.anuncios.length, 21);
  assert.deepEqual(j.rel.anuncios.slice(0, 20), lista20.anuncios);
  assert.equal(juntarAnuncioAoRelatorio(lista20, { ...um, conta: { id: "824312524" } }, deFora).ok, false);
  assert.equal(juntarAnuncioAoRelatorio(lista20, um, "MLB0000000001").ok, false);
  assert.equal(juntarAnuncioAoRelatorio(null, um, deFora).rel.anuncios.length, 1, "sem lista atual: mostra só ele");
});

test("fluxo completo: lista de 20 aberta → reanalisar 1 → fila e histórico atualizados, decisões preservadas, lista intacta", async () => {
  const arm = memoria();
  const repo = R.repositorioNavegador(arm, CONTA);
  const ml = mlComAnuncios(30);
  // rodada 1: 20 inéditos
  let estado = await repo.carregar();
  const rel1 = await analisar(ml, (ids) => F.escolherIneditos(ids, estado, 20).escolhidos, 20);
  await repo.registrarRodada(F.montarRodada({ conta: CONTA, modo: F.MODO.NOVOS, rel: rel1, ativosTotal: 30, ineditosAntes: 30 }).rodada);
  // uma decisão do usuário: remover da lista uma pendência
  estado = await repo.carregar();
  const p = F.pendenciasAbertas(estado)[0];
  await repo.registrarAcao({ id: "dec1", conta: CONTA, acao: "removido", mlb: p.item_id, area: p.area, motivo: "Outro motivo", em: "2026-11-19T11:00:00Z" });
  const eventosAntes = (await repo.carregar()).eventos.length;
  // reanálise individual do mesmo anúncio
  const um = await analisar(ml, () => [p.item_id], 1);
  estado = await repo.carregar();
  const mr = F.montarRodada({ conta: CONTA, modo: estado.anuncios[p.item_id] ? F.MODO.REANALISE : F.MODO.NOVOS, rel: um, ativosTotal: 30, ineditosAntes: 10 });
  assert.equal((await repo.registrarRodada(mr.rodada)).ok, true);
  const depois = await repo.carregar();
  assert.equal(depois.anuncios[p.item_id].analises, 2, "reanálise registrada");
  assert.equal(F.indicadores(depois).analisados, 20, "não conta como inédito");
  assert.equal(depois.eventos.length, eventosAntes + 1, "histórico só acrescenta");
  assert.ok(depois.eventos.some((e) => e.tipo === "removido" && e.mlb === p.item_id), "decisão anterior continua no histórico");
  assert.equal(F.statusPendencia(depois, p), F.STATUS.REMOVIDA, "removida continua removida");
  const j = juntarAnuncioAoRelatorio(rel1, um, p.item_id);
  assert.equal(j.rel.anuncios.length, 20);
});

test("busca nas análises anteriores: por MLB, SKU ou título, mais recente primeiro", () => {
  const e = F.estadoVazio(CONTA);
  e.anuncios = {
    MLB4520920619: { mlb: "MLB4520920619", sku: "H8201443067", titulo: "Sonda Lambda Logan Sandero Kwid", ultima_analise_em: "2026-11-19T13:42:00Z" },
    MLB1111111111: { mlb: "MLB1111111111", sku: "X1", titulo: "Bobina", ultima_analise_em: "2026-11-19T14:00:00Z" },
  };
  assert.deepEqual(F.buscarAnalisados(e, "MLB4520920619").map((a) => a.mlb), ["MLB4520920619"]);
  assert.deepEqual(F.buscarAnalisados(e, "h8201443067").map((a) => a.mlb), ["MLB4520920619"], "SKU, sem diferenciar maiúsculas");
  assert.deepEqual(F.buscarAnalisados(e, "sonda").map((a) => a.mlb), ["MLB4520920619"]);
  assert.deepEqual(F.buscarAnalisados(e, "MLB").map((a) => a.mlb), ["MLB1111111111", "MLB4520920619"]);
  assert.deepEqual(F.buscarAnalisados(e, " "), []);
});

test("pendência antiga 'PREJUÍZO de R$ 7,91' aparece com o texto atual (estimado, não realizado, Importante) sem mudar o registro", () => {
  const antigo = "PREJUÍZO de R$ 7,91 por venda (antes dos impostos): preço R$ 121,00 − tarifa R$ 20,57 − frete R$ 16,95 − custo R$ 91,39.";
  const e = F.estadoVazio("2412238242");
  e.anuncios.MLB4520920619 = { mlb: "MLB4520920619", sku: "H8201443067", titulo: "Sonda Lambda", resultado: { vendas30: 0 }, ultima_analise_em: "2026-11-19T13:42:00Z", situacao: "pendente" };
  e.pendencias["MLB4520920619|margem"] = { chave: "MLB4520920619|margem", mlb: "MLB4520920619", area: "margem", severidade: "alta", problema: antigo, sugestao: "Revisar preço ou frete deste anúncio.", status: "aberta", ultima_vez_em: "2026-11-19T13:42:00Z" };
  const copia = JSON.stringify(e);
  const [p] = F.pendenciasAbertas(e);
  assert.equal(p.problema, "Prejuízo estimado de R$ 7,91 por venda (custo cadastrado no Bling, antes dos impostos): preço R$ 121,00 − tarifa R$ 20,57 − frete R$ 16,95 − custo R$ 91,39. Nenhuma venda nos últimos 30 dias: prejuízo estimado por venda, não realizado.");
  assert.equal(p.severidade, "media", "Importante (zero vendas)");
  assert.equal(p.registro_anterior, true);
  assert.equal(p.analisado_em, "2026-11-19T13:42:00Z");
  assert.equal(JSON.stringify(e), copia, "registro guardado não muda");
  // com vendas: continua Urgente
  e.anuncios.MLB4520920619.resultado.vendas30 = 3;
  assert.equal(F.pendenciasAbertas(e)[0].severidade, "alta");
  assert.doesNotMatch(F.pendenciasAbertas(e)[0].problema, /não realizado/);
  // outros textos/assuntos: como estão
  assert.deepEqual(F.textoAtualDaPendencia({ area: "conteudo", problema: "Só 1 foto(s).", severidade: "media" }, {}), { problema: "Só 1 foto(s).", severidade: "media", registro_anterior: false });
  assert.equal(F.textoAtualDaPendencia({ area: "margem", problema: "Possível prejuízo de R$ 3,00 por venda …", severidade: "media" }, {}).registro_anterior, false);
});

test("serviço e tela: reanálise individual não grava por cima da lista; junta e guarda cópia; botão e bloco 'análises anteriores'", () => {
  const svc = fs.readFileSync(path.join(RAIZ, "src/services/paizinhoAuditoria/relatorioService.js"), "utf8");
  assert.match(svc, /export async function reanalisarAnuncio\(/);
  assert.match(svc, /guardar: false \}\);/, "a análise de 1 anúncio não sobrescreve a lista");
  assert.match(svc, /juntarAnuncioAoRelatorio\(atual, relUm, m\)/);
  assert.match(svc, /:anterior`, id\), JSON\.stringify\(atual\)/, "cópia da lista antes de juntar");
  assert.match(svc, /if \(guardar\) guardarRelatorioTesteLocal\(rel\);/);
  const tela = fs.readFileSync(path.join(RAIZ, "src/components/RelatorioManhaPaizinho.jsx"), "utf8");
  assert.match(tela, /data-paizinho-anteriores/);
  assert.match(tela, /buscarAnalisados\(filaDaConta\.estado, busca\)/);
  assert.match(fs.readFileSync(path.join(RAIZ, "src/components/AuditoriaAnuncios.jsx"), "utf8"), /data-paizinho-reanalisar-um/);
});
