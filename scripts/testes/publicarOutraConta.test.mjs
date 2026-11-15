// =============================================================
// PAIIA — TESTES (15/11/2026): "Publicar em outra conta do Mercado Livre".
// Qualquer ficha publicada, a qualquer momento: escolher LOJA ONLINE, CIEBR ou REVELAÇÃO;
// cada conta com a SUA ficha e o SEU MLB; nada duplicado; nada publicado aqui.
// Caso de teste: SKU 7527362 (flange). O MLB5560614343 (parafuso 8200642689) NUNCA pode
// aparecer como MLB da flange. MLBs "MLB6…" abaixo são fictícios (só teste).
//   node --test scripts/testes/publicarOutraConta.test.mjs
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { register } from "node:module";

register("./simulacao/ganchoSupabaseFalso.mjs", import.meta.url);
const F = await import("./simulacao/supabaseFalso.mjs");
const C = await import("../../src/services/contasPublicacaoML.js");
const S = await import("../../src/services/anuncioPublicacaoService.js");
const ler = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

const LOJA = "1729335019";
const REV = "2412238242";
const CIEBR = "824312524";
const PARAFUSO_MLB = "MLB5560614343";
const porConta = (q) => Object.fromEntries(q.map((l) => [l.nome, l]));

// Ficha real 4ab28be5 depois da correção: aprovada, LOJA ONLINE, sem MLB (MLB do parafuso só no histórico).
const FLANGE_APROVADA = { id: "4ab28be5-194e-45c8-b0da-4b8c0875a1af", codigo: "7527362", status_fluxo: "conferencia_aprovada", conta_destino_ml_user_id: LOJA,
  integracao_bling: null, publicacao: { ml_user_id: LOJA, mlb_id: null, status_publicacao: "pendente" } };

test("1) caso 7527362 hoje: nenhuma conta publicada; LOJA ONLINE com ficha em andamento; MLB do parafuso nunca aparece", () => {
  const q = porConta(C.situacaoContasDoProduto({ fichas: [{ ...FLANGE_APROVADA, integracao_bling: { mlb: PARAFUSO_MLB } }] }));
  assert.equal(q["LOJA ONLINE"].estado, "em_andamento");
  assert.equal(q["LOJA ONLINE"].ficha, FLANGE_APROVADA.id);
  assert.equal(q["REVELAÇÃO"].estado, "disponivel");
  assert.equal(q.CIEBR.estado, "disponivel");
  assert.ok(!JSON.stringify(q).includes(PARAFUSO_MLB), "registro do Bling/histórico nunca vira MLB da conta");
  // Ficha ainda não publicada: escolhe a conta na própria publicação (não por aqui).
  assert.match(C.podePublicarEmOutraConta({ fichaOrigem: FLANGE_APROVADA, conta: REV, quadro: Object.values(q) }).motivo, /ainda não foi publicada/);
});

test("2) flange publicada na LOJA ONLINE: REVELAÇÃO e CIEBR disponíveis; LOJA ONLINE recusada (não duplica)", () => {
  const pub = { ...FLANGE_APROVADA, status_fluxo: "publicado", publicacao: { ml_user_id: LOJA, mlb_id: "MLB6000000001", status_publicacao: "publicado" } };
  const quadro = C.situacaoContasDoProduto({ fichas: [pub] });
  const q = porConta(quadro);
  assert.deepEqual([q["LOJA ONLINE"].estado, q["LOJA ONLINE"].mlb], ["publicada", "MLB6000000001"]);
  assert.equal(q["REVELAÇÃO"].estado, "disponivel");
  assert.equal(C.podePublicarEmOutraConta({ fichaOrigem: pub, conta: REV, quadro }).ok, true);
  assert.match(C.podePublicarEmOutraConta({ fichaOrigem: pub, conta: LOJA, quadro }).motivo, /já é a publicação em LOJA ONLINE/);
  assert.equal(C.podePublicarEmOutraConta({ fichaOrigem: pub, conta: "999", quadro }).ok, false, "conta fora da lista");
  // Já publicada em REVELAÇÃO por outra ficha (dias antes) → recusada.
  const rev = { id: "r1", codigo: "7527362", status_fluxo: "publicado", publicacao: { ml_user_id: REV, mlb_id: "MLB6000000002", status_publicacao: "publicado" } };
  const q2 = C.situacaoContasDoProduto({ fichas: [pub, rev] });
  assert.match(C.podePublicarEmOutraConta({ fichaOrigem: pub, conta: REV, quadro: q2 }).motivo, /já está publicado em REVELAÇÃO \(MLB6000000002\)/);
  // Ficha de CIEBR em andamento → reabre a MESMA (não cria outra).
  const ci = { id: "c1", codigo: "7527362", status_fluxo: "conferencia_aprovada", publicacao: null };
  const q3 = C.situacaoContasDoProduto({ fichas: [pub, ci], continuacoes: { [CIEBR]: { ficha: "c1" } } });
  assert.deepEqual(C.podePublicarEmOutraConta({ fichaOrigem: pub, conta: CIEBR, quadro: q3 }), { ok: true, existente: "c1" });
  // Ficha cancelada não conta.
  assert.equal(porConta(C.situacaoContasDoProduto({ fichas: [{ ...rev, status_fluxo: "cancelado" }] }))["REVELAÇÃO"].estado, "disponivel");
});

function semear() {
  F.zerarBanco();
  const T = F.banco.tabelas;
  T.paiia_anuncios.push({
    id: "f1a00000-0000-4000-8000-000000000001", usuario_id: F.USUARIO, codigo: "7527362", codigo_normalizado: "7527362", titulo: "Flange Tampa De Combustivel 10 Furos Uno Elba Fiorino Premio",
    status_fluxo: "publicado", conta_destino_ml_user_id: LOJA, updated_at: "2026-11-20T10:00:00.000Z",
    dados_conferencia: {
      versao: 2, salvo_em: "2026-11-15T09:56:00.236Z",
      anuncio: { codigo: "7527362", titulo: "Flange Tampa De Combustivel 10 Furos Uno Elba Fiorino Premio", fotos: ["https://x/f1.png", "https://x/f2.png", "https://x/f3.png"] },
      ficha: { campos: { titulo: "Flange Tampa De Combustivel 10 Furos Uno Elba Fiorino Premio", preco: "36.54", quantidadeEstoque: "1", categoriaML: { id: "MLB188061" }, compatibilidades: "FIAT • Elba • Fiorino • Premio", descricao: "Flange…", fotos: ["https://x/f1.png", "https://x/f2.png", "https://x/f3.png"], anuncioIdPAIIA: "", contaDestinoML: LOJA },
        anuncioConferido: { codigo: "7527362", fotos: ["https://x/f1.png", "https://x/f2.png", "https://x/f3.png"] }, assinaturaAprovada: "a1", etapa: "publicacao" },
      base_paiia: { decisao: "nao" },
      integracao_bling: { mlb: "MLB6000000001", estado: "integrado", bling_produto_id: "16735738672" },
      pos_publicacao: { mlb: "MLB6000000001", concluido: true },
      mlb_trocado: [{ mlb: PARAFUSO_MLB }],
      mlbs_anteriores: [{ mlb: "MLB6000000009" }],
    },
  });
  T.paiia_anuncios_publicacoes.push({ id: "p1", anuncio_id: "f1a00000-0000-4000-8000-000000000001", marketplace: "mercado_livre", ml_user_id: LOJA, mlb_id: "MLB6000000001", status_publicacao: "publicado", sku: "7527362", bling_produto_id: "16735738672" });
}

test("3) preparar REVELAÇÃO a partir da flange publicada: ficha nova com os mesmos dados aprovados, SEM MLB/Bling/conferências da LOJA; ligada à origem", async () => {
  semear();
  const r = await S.prepararFichaOutraConta({ anuncioId: "f1a00000-0000-4000-8000-000000000001", conta: REV });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.nova, true);
  const T = F.banco.tabelas;
  const nova = T.paiia_anuncios.find((a) => a.id === r.anuncioId);
  const d = nova.dados_conferencia;
  assert.equal(nova.codigo, "7527362");
  assert.equal(d.ficha.campos.titulo, "Flange Tampa De Combustivel 10 Furos Uno Elba Fiorino Premio");
  assert.equal(d.ficha.campos.preco, "36.54");
  assert.equal(d.ficha.campos.categoriaML.id, "MLB188061");
  assert.equal(d.ficha.campos.compatibilidades, "FIAT • Elba • Fiorino • Premio");
  assert.equal(d.ficha.campos.fotos.length, 3);
  assert.equal(d.ficha.campos.anuncioIdPAIIA, r.anuncioId);
  assert.equal(d.ficha.campos.contaDestinoML, "", "a conta é escolhida/conferida na ficha nova");
  for (const k of ["integracao_bling", "pos_publicacao", "mlbs_anteriores", "mlb_trocado"]) assert.equal(d[k], undefined, `${k} da outra conta não vai junto`);
  assert.ok(!JSON.stringify(d).includes("MLB6000000001") || d.contas_publicacao.origem.mlb === "MLB6000000001", "o MLB da LOJA só aparece como ORIGEM");
  assert.ok(!JSON.stringify(nova).includes(PARAFUSO_MLB), "MLB do parafuso nunca");
  assert.deepEqual(d.contas_publicacao.sugeridas, [REV]);
  assert.equal(d.contas_publicacao.pendente, true);
  assert.equal(d.contas_publicacao.origem.ficha, "f1a00000-0000-4000-8000-000000000001");
  // Origem: só a ligação nova; MLB, Bling e o resto intactos.
  const origem = T.paiia_anuncios.find((a) => a.id === "f1a00000-0000-4000-8000-000000000001");
  assert.equal(origem.dados_conferencia.contas_publicacao.continuacoes[REV].ficha, r.anuncioId);
  assert.equal(origem.dados_conferencia.integracao_bling.mlb, "MLB6000000001");
  assert.equal(origem.status_fluxo, "publicado");
  // Nenhuma publicação nova com MLB; Mercado Livre e Bling não foram chamados.
  assert.equal(T.paiia_anuncios_publicacoes.filter((p) => p.mlb_id).length, 1);
  assert.equal(F.banco.funcoes.length, 0, "nada enviado ao ML/Bling");
  assert.ok(!F.banco.chamadas.some((c) => c.op === "delete"));
});

test("4) escolher de novo a mesma conta reabre a MESMA ficha; LOJA ONLINE (desta ficha) é recusada", async () => {
  semear();
  const a = await S.prepararFichaOutraConta({ anuncioId: "f1a00000-0000-4000-8000-000000000001", conta: REV });
  const b = await S.prepararFichaOutraConta({ anuncioId: "f1a00000-0000-4000-8000-000000000001", conta: REV });
  assert.equal(b.ok, true, JSON.stringify(b));
  assert.equal(b.anuncioId, a.anuncioId);
  assert.equal(b.nova, false);
  assert.equal(F.banco.tabelas.paiia_anuncios.filter((x) => x.codigo === "7527362" && x.status_fluxo !== "cancelado").length, 2, "só uma ficha nova");
  const c = await S.prepararFichaOutraConta({ anuncioId: "f1a00000-0000-4000-8000-000000000001", conta: LOJA });
  assert.equal(c.ok, false);
  assert.match(c.erro, /já é a publicação em LOJA ONLINE/);
});

test("5) quadro pela base: LOJA publicada (MLB próprio), REVELAÇÃO em andamento depois de preparada, CIEBR disponível", async () => {
  semear();
  await S.prepararFichaOutraConta({ anuncioId: "f1a00000-0000-4000-8000-000000000001", conta: REV });
  const r = await S.contasDoProduto("f1a00000-0000-4000-8000-000000000001");
  assert.equal(r.ok, true, JSON.stringify(r));
  const q = porConta(r.quadro);
  assert.deepEqual([q["LOJA ONLINE"].estado, q["LOJA ONLINE"].mlb], ["publicada", "MLB6000000001"]);
  assert.equal(q["REVELAÇÃO"].estado, "em_andamento");
  assert.equal(q.CIEBR.estado, "disponivel");
});

test("6) tela: bloco só em ficha publicada com MLB na publicação; escolher só prepara e abre a ficha (nunca publica)", () => {
  const f = ler("src/components/FichaPublicadaPAIIA.jsx");
  assert.ok(f.includes("{/^MLB\\d{6,}$/i.test(String(pub.mlb_id || \"\")) && <PublicarOutraConta"));
  const t = ler("src/components/PublicarOutraConta.jsx");
  assert.ok(t.includes("prepararFichaOutraConta({ anuncioId, conta })"));
  assert.ok(!/functions\.invoke|chamar\(|"publicar"|registrarMLBPublicado/.test(t), "nada de publicar/ML/Bling na tela");
  assert.ok(t.includes("enderecoDaFicha("), "abre a ficha sem auto= (enderecoDaFicha apaga a autorização)");
});
