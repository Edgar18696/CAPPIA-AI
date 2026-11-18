// =============================================================
// PAIIA — TESTES (18/11/2026): Ranqueamento com REVELAÇÃO como conta padrão e
// a AUDITORIA POR ANÚNCIO (preço, custo do Bling, margem, visitas, vendas, fotos,
// compatibilidades, frete, problema e correção). Sem rede.
//   node --test scripts/testes/auditoriaRevelacao.test.mjs
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ler = (f) => fs.readFileSync(path.join(RAIZ, f), "utf8");
const T = await import("../../src/services/paizinhoAuditoria/textosAnuncio.js");
const C = await import("../../src/services/paizinhoAuditoria/contas.js");

test("custo ausente vira 'Custo não informado' (nunca zero, nunca inventado); margem só com dados", () => {
  assert.equal(T.textoCusto({ custo: null }), "Custo não informado");
  assert.equal(T.textoCusto({ custo: 0 }), "Custo não informado", "zero não é custo");
  assert.equal(T.textoCusto({}), "Custo não informado");
  assert.match(T.textoCusto({ custo: 80 }), /80,00/);
  assert.match(T.textoCusto({ custo: 80, custo_a_confirmar: true }), /a confirmar/);
  assert.equal(T.textoMargem({ margem_pct: null }), "Margem não calculada");
  assert.equal(T.textoMargem({ margem_pct: 24.6, margem_com_imposto: true }), "24,6%");
  assert.equal(T.textoMargem({ margem_pct: 30, margem_com_imposto: false }), "30% (antes do imposto)");
});

test("REVELAÇÃO é a conta padrão; registros antigos sem conta continuam da LOJA ONLINE", () => {
  assert.equal(C.CONTA_PADRAO.id, "2412238242");
  assert.equal(C.CONTA_LEGADO.id, "1729335019");
  assert.match(ler("src/services/paizinhoAuditoria/relatoriosPorConta.js"), /id === CONTA_LEGADO\.id\) rel = ler\(CHAVE_TESTE_LOCAL\)/);
  assert.match(ler("src/services/paizinhoAuditoria/relatorioService.js"), /id === CONTA_LEGADO\.id \? localStorage\.getI/);
});

test("relatório traz por anúncio: fotos, compatibilidades, margem com/sem imposto, palavras-chave e problemas com a correção", () => {
  const rel = ler("src/services/paizinhoAuditoria/relatorio.js");
  for (const campo of ["fotos: f.fotos", "compat: f.compat", "margem_com_imposto:", "palavras: (f.concorrencia?.palavrasChaveSugeridas", "achados: f.achados.map((a) => ({ area: a.area, severidade: a.severidade, positivo: !!a.positivo, problema: a.problema, sugestao: a.sugestao }))"]) assert.ok(rel.includes(campo), campo);
});

test("tela: auditoria por anúncio só mostra (sem escrita), com 'Como corrigir', Enviar para Promoções e filtros", () => {
  const tela = ler("src/components/AuditoriaAnuncios.jsx");
  assert.match(tela, /Como corrigir: \{x\.sugestao\}/);
  assert.match(tela, /textoCusto\(a\)/);
  assert.match(tela, /<EnviarParaPromocoes conta=/);
  assert.match(tela, /\["problemas", "Com problema"\], \["urgentes", "Só urgentes"\], \["sem_custo", "Custo não informado"\], \["todos", "Todos"\]/);
  assert.doesNotMatch(tela, /functions\.invoke|\.from\(|fetch\(|method:/, "nada é gravado nem alterado");
  const rank = ler("src/components/RelatorioManhaPaizinho.jsx");
  assert.match(rank, /<AuditoriaAnuncios rel=\{rel\} \/>/);
  assert.match(rank, /<PrioridadesPaizinho rel=\{rel\}/, "Prioridades (Resolvido / Remover da lista) continuam");
});
