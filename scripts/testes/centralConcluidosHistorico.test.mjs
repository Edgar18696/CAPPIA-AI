// =============================================================
// PAIIA — TESTES (14/11/2026): Central de Publicação com lista de TRABALHO
// limpa. Anúncio publicado + confirmado + Bling concluído sai da lista sozinho
// e fica no Histórico (nada é apagado). Pendência real volta para a lista.
//   node --test scripts/testes/centralConcluidosHistorico.test.mjs
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { fichaConcluida, resumoFichaCentral, ESTADO_CENTRAL } = await import("../../src/services/fichasCentral.js");
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ler = (rel) => fs.readFileSync(path.join(RAIZ, rel), "utf8").replace(/\r\n/g, "\n");

const LOJA = "1729335019";
const REV = "2412238242";
const pub = (o = {}) => ({ mlb_id: "MLB5560614343", status_publicacao: "publicado", conta_nome: "LOJA ONLINE", publicado_em: "2026-11-14T20:15:56Z", ml_user_id: LOJA, bling_produto_id: "16735643770", ...o });
const integ = (estado = "integrado") => ({ mlb: "MLB5560614343", estado, bling_produto_id: "16735643770", bling_loja_id: "204883484" });
const posOk = { mlb: "MLB5560614343", concluido: false, ativo: { estado: "ok" }, vinculo: { estado: "ok" } };
// Caso real 8200642689 (ficha f5ad389b): publicado, integrado, conferências ok.
const REAL = { id: "f5ad389b", codigo: "8200642689", titulo: "Parafuso Aço Temperado Cabeçote Laguna Megane", status_fluxo: "publicado", updated_at: "2026-11-14T20:25:04Z", publicacao: pub(), integracao_bling: integ(), pos_publicacao: posOk };

test("1) publicado + Bling integrado + conferências sem falha = CONCLUÍDO (vai para o Histórico)", () => {
  assert.equal(fichaConcluida(REAL), true);
  const r = resumoFichaCentral(REAL);
  assert.equal(r.concluida, true);
  assert.equal(r.estado, ESTADO_CENTRAL.INTEGRADO_BLING);
  assert.equal(r.mlb, "MLB5560614343");
  assert.equal(r.conta, "LOJA ONLINE");
  assert.equal(r.publicadoEm, "2026-11-14T20:15:56Z");
  assert.equal(r.codigo, "8200642689");
  // Conferência em segundo plano já concluída também conta.
  assert.equal(fichaConcluida({ ...REAL, pos_publicacao: { ...posOk, concluido: true } }), true);
  // Ficha antiga, sem registro de pós-publicação: integrado basta.
  assert.equal(fichaConcluida({ ...REAL, pos_publicacao: null }), true);
  // Caso real de agora: conferência de ESTOQUE ainda rodando em segundo plano não segura o anúncio na lista.
  assert.equal(fichaConcluida({ ...REAL, pos_publicacao: { ...posOk, estoque: { estado: "pendente" }, tentativas: 5 } }), true);
});

test("2) continua na lista de TRABALHO: Bling pendente, publicação com pendência, erro, falha ou conferência em andamento", () => {
  assert.equal(fichaConcluida({ ...REAL, integracao_bling: integ("aguardando_importacao") }), false, "Aguardando Bling");
  assert.equal(fichaConcluida({ ...REAL, integracao_bling: integ("produto_incorreto") }), false, "produto errado no Bling");
  assert.equal(fichaConcluida({ ...REAL, status_fluxo: "publicado_com_pendencia", publicacao: pub({ status_publicacao: "publicado_com_pendencia" }) }), false, "publicado com pendência");
  assert.equal(fichaConcluida({ ...REAL, pos_publicacao: { ...posOk, ativo: { estado: "erro", texto: "anúncio não está ativo" } } }), false, "falha real = pendência");
  assert.equal(fichaConcluida({ ...REAL, pos_publicacao: { ...posOk, ativo: { estado: "pendente" } } }), false, "ainda não confirmado no Mercado Livre");
  assert.equal(fichaConcluida({ ...REAL, pos_publicacao: { ...posOk, estoque: { estado: "erro", texto: "estoque divergente" } } }), false, "falha de estoque = pendência");
  assert.equal(fichaConcluida({ ...REAL, pos_publicacao: { ...posOk, desistiu: true } }), false, "tentativas encerradas: conferir");
  assert.equal(fichaConcluida({ ...REAL, publicacao: null, integracao_bling: null, status_fluxo: "conferencia_aprovada" }), false, "não publicado");
  assert.equal(fichaConcluida({ id: "x", status_fluxo: "rascunho" }), false, "rascunho");
  assert.equal(fichaConcluida(null), false);
  // Pendência aparece no resumo (vai para a lista como pendência).
  const r = resumoFichaCentral({ ...REAL, pos_publicacao: { ...posOk, ativo: { estado: "erro", texto: "anúncio não está ativo" } } });
  assert.equal(r.concluida, false);
  assert.match(r.pendencia, /anúncio não está ativo/);
});

test("3) conta SEM etapa de Bling (sem registro e sem produto Bling): publicado sem pendência também conclui", () => {
  const semBling = { id: "r1", codigo: "X1", status_fluxo: "publicado", publicacao: pub({ ml_user_id: REV, conta_nome: "REVELAÇÃO", bling_produto_id: "" }), integracao_bling: null, pos_publicacao: null };
  assert.equal(resumoFichaCentral(semBling).estado, ESTADO_CENTRAL.PUBLICADO);
  assert.equal(fichaConcluida(semBling), true);
  // LOJA ONLINE com produto Bling mas sem registro da integração: o Bling ainda falta.
  const lojaSemReg = { ...REAL, integracao_bling: null };
  assert.equal(resumoFichaCentral(lojaSemReg).estado, ESTADO_CENTRAL.AGUARDANDO_BLING);
  assert.equal(fichaConcluida(lojaSemReg), false);
});

test("4) tela: lista de trabalho sem concluídos; Histórico com SKU, MLB, conta, data e situação; nada é apagado", () => {
  const p = ler("src/components/PainelFichasCentral.jsx");
  assert.ok(p.includes("const trabalho = estado.fichas.filter((f) => !f.concluida);"));
  assert.ok(p.includes("const fichas = mostrarTodas ? trabalho : trabalho.slice(0, 12);"), "lista de trabalho = só não concluídos");
  assert.ok(p.includes("const contagem = trabalho.reduce("), "legenda conta só o trabalho");
  const i = p.indexOf("data-paiia-historico-central");
  assert.ok(i > 0, "seção Histórico");
  const hist = p.slice(i, p.indexOf("</details>", i));
  for (const campo of ["f.codigo", "f.mlb", "f.conta", "dataCurta(f.publicadoEm)", "f.texto"]) assert.ok(hist.includes(campo), campo);
  assert.ok(!hist.includes("excluir"), "Histórico sem Excluir (não exige clique)");
  assert.ok(p.includes("data-paiia-central-limpa"), "aviso de Central limpa");
  // Concluir NÃO grava nada: é só filtro de tela.
  const svc = ler("src/services/fichasCentral.js");
  const f = svc.slice(svc.indexOf("export function fichaConcluida"), svc.indexOf("/** Linha pronta para a tela"));
  assert.equal(/supabase|insert|update|delete|arquivad/.test(f), false, "fichaConcluida é só leitura");
  assert.ok(ler("src/services/fichasCentralService.js").includes("export async function listarFichasCentral({ limite = 200 } = {})"), "concluídos não empurram fichas em andamento para fora");
});
