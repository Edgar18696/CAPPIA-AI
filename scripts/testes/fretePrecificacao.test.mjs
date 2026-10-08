// =============================================================
// PAIIA — TESTES (09/10/2026): frete do Mercado Livre e precificação
// calculados JUNTOS; faixas de preço; desatualização; estimativa.
//   node --test scripts/testes/fretePrecificacao.test.mjs
// Mercado Livre simulado com os valores REAIS lidos da API em 08/10/2026
// (conta LOJA ONLINE, embalagem 8×10×15 cm, 200 g, Clássico).
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ler = (f) => fs.readFileSync(path.join(RAIZ, f), "utf8");

const F = await import("../../src/services/fretePrecificacao.js");
const { faixaDoPreco, rotuloFaixa, mesmaFaixa, precoComMargem, resultadoDoPreco, parametrosCotacao, caminhoCotacao, lerRespostaCotacao, cotarNoPreco,
  estimativaPAIIA, convergirPreco, sugestaoFaixa, criarCotadorPorFaixa, calcularFreteEPrecos, situacaoFrete, conferirCotacao, linhasTabela, baseDePrecificacao, ORIGEM_FRETE } = F;

// [limite inferior, custo vendedor, frete cheio, desconto]
const TABELA = [[0, 5.65, 8.07, 0.3], [19, 6.85, 9.79, 0.3], [49, 8.15, 11.64, 0.3], [79, 12.95, 25.9, 0.5], [100, 14.95, 29.9, 0.5], [120, 16.95, 33.9, 0.5], [150, 19.05, 38.1, 0.5], [200, 21.65, 43.3, 0.5]];
function mlFalso({ falha = null, peso = 200, extra = 0 } = {}) {
  const chamadas = [];
  const consultar = async (caminho) => {
    chamadas.push(caminho);
    if (falha === "indisponivel") return { ok: false, status: 503, erro: "Service Unavailable" };
    if (falha === "token") return { ok: false, status: 401, erro: "invalid access token" };
    if (falha === "timeout") throw new Error("timeout");
    if (falha === "vazio") return { ok: true, dados: {} };
    const u = new URL("https://x" + caminho);
    const preco = Number(u.searchParams.get("item_price"));
    const linha = [...TABELA].reverse().find(([lim]) => preco >= lim);
    return { ok: true, status: 200, dados: { coverage: { all_country: { list_cost: Math.round((linha[1] + extra) * 100) / 100, currency_id: "BRL", billable_weight: peso, discount: { rate: linha[3], type: "mandatory", promoted_amount: linha[2] } } } } };
  };
  return { consultar, chamadas };
}
const PARAMS = parametrosCotacao({ conta: "1729335019", medida: { peso_g: 200, comprimento_cm: 8, largura_cm: 10, altura_cm: 15 }, modalidade: "xd_drop_off", categoria: "MLB194431", tipoAnuncio: "classico" });
const BASE = baseDePrecificacao({ custo: "30,00", despesas: "3,00", comissao: "12", imposto: "8" });

test("faixas de preço do frete: limites exatos", () => {
  const pares = [[78.99, 79], [99.99, 100], [119.99, 120], [149.99, 150], [199.99, 200]];
  for (const [a, b] of pares) {
    assert.equal(mesmaFaixa(a, b), false, `${a} × ${b}`);
    assert.equal(faixaDoPreco(b) - faixaDoPreco(a), 1);
  }
  assert.equal(rotuloFaixa(78.99), "R$ 49,00 a R$ 78,99");
  assert.equal(rotuloFaixa(79), "R$ 79,00 a R$ 99,99");
  assert.equal(rotuloFaixa(250), "a partir de R$ 200,00");
});

test("cotação real nos limites: o frete muda exatamente na troca de faixa", async () => {
  const { consultar } = mlFalso();
  const esperado = { 78.99: 8.15, 79: 12.95, 99.99: 12.95, 100: 14.95, 119.99: 14.95, 120: 16.95, 149.99: 16.95, 150: 19.05, 199.99: 19.05, 200: 21.65 };
  for (const [p, f] of Object.entries(esperado)) {
    const c = await cotarNoPreco({ params: PARAMS, preco: Number(p), consultar });
    assert.equal(c.ok, true);
    assert.equal(c.custo_vendedor, f, `preço ${p}`);
    assert.equal(c.peso_cobrado_g, 200);
    assert.equal(c.origem, ORIGEM_FRETE.ML);
  }
  const c79 = await cotarNoPreco({ params: PARAMS, preco: 79, consultar });
  assert.equal(c79.frete_cheio, 25.9);
  assert.equal(c79.desconto_pct, 50);
});

test("chamada ao ML: conta, medidas C×L×A arredondadas para cima, modalidade, tipo, categoria, preço", () => {
  const p = parametrosCotacao({ conta: "1729335019", medida: { peso_g: 200.4, comprimento_cm: 8.2, largura_cm: 10, altura_cm: 15 }, modalidade: "xd_drop_off", categoria: "MLB194431", tipoAnuncio: "premium" });
  const c = caminhoCotacao(p, 78.99);
  assert.match(c, /^\/users\/1729335019\/shipping_options\/free\?/);
  assert.match(c, /dimensions=9x10x15%2C201/);
  assert.match(c, /item_price=78\.99/);
  assert.match(c, /listing_type_id=gold_pro/);
  assert.match(c, /logistic_type=xd_drop_off/);
  assert.match(c, /category_id=MLB194431/);
  assert.match(c, /verbose=true/);
});

test("convergência preço × frete nas 3 margens (o preço fica na faixa do frete usado)", async () => {
  const { consultar } = mlFalso();
  const r = await calcularFreteEPrecos({ params: PARAMS, base: BASE, precoFinal: 0, consultar });
  assert.equal(r.ok, true);
  for (const k of ["conservador", "recomendado", "ideal"]) {
    const m = r.registro.margens[k];
    const cot = await cotarNoPreco({ params: PARAMS, preco: m.preco, consultar });
    assert.equal(m.frete, cot.custo_vendedor, `${k}: frete do preço ${m.preco}`);
    assert.equal(precoComMargem({ base: BASE, frete: m.frete, margem: m.margem }), m.preco);
    assert.equal(m.origem, ORIGEM_FRETE.ML);
  }
});

test("convergência atravessa a faixa: frete da faixa baixa empurra o preço para cima de R$ 79 → nova cotação", async () => {
  const { consultar } = mlFalso();
  // custo que, com o frete de R$ 8,15, dá preço ≥ R$ 79 → recota em 12,95
  const base = baseDePrecificacao({ custo: "43,00", despesas: "3,00", comissao: "12", imposto: "8" });
  const cot = criarCotadorPorFaixa({ params: PARAMS, consultar });
  const r = await convergirPreco({ base, margem: 15, cotarFaixa: cot });
  assert.equal(r.ok, true);
  assert.ok(r.voltas.length >= 2, JSON.stringify(r.voltas));
  assert.equal(r.cotacao.custo_vendedor, faixaDoPreco(r.preco) >= 3 ? 12.95 : 8.15);
  assert.equal(mesmaFaixa(r.preco, r.voltas.at(-1).preco_cotado), true);
});

test("sugestão de faixa (R$ 79,00 → R$ 78,99): mostra a diferença e sugere; nunca altera o preço", async () => {
  const { consultar } = mlFalso();
  const cot = criarCotadorPorFaixa({ params: PARAMS, consultar });
  const s = await sugestaoFaixa({ preco: 79, base: BASE, cotarFaixa: cot });
  assert.equal(s.limite, 79);
  assert.equal(s.atual.preco, 79);
  assert.equal(s.alternativa.preco, 78.99);
  assert.equal(s.diferencaFrete, 4.8);
  assert.equal(s.vantajosa, true);
  assert.match(s.texto, /Sugestão: R\$ 78,99\. Você decide\./);
  // longe do limite: sem sugestão
  assert.equal(await sugestaoFaixa({ preco: 95, base: BASE, cotarFaixa: cot }), null);
  // outros limites
  for (const lim of [100, 120, 150, 200]) {
    const x = await sugestaoFaixa({ preco: lim, base: BASE, cotarFaixa: cot });
    assert.equal(x.alternativa.preco, Math.round((lim - 0.01) * 100) / 100);
    assert.ok(x.diferencaFrete > 0);
  }
});

test("Preço | Frete ML | Comissão/custos | Resultado/margem", () => {
  const r = resultadoDoPreco({ preco: 79, frete: 12.95, base: BASE });
  assert.equal(r.comissaoValor, 9.48);
  assert.equal(r.impostoValor, 6.32);
  assert.equal(r.custosSemFrete, 48.8);
  assert.equal(r.resultado, 17.25);
  assert.equal(r.margemPct, 21.8);
});

test("preço final: cotado no próprio preço; registro guarda tudo o que originou a cotação", async () => {
  const { consultar } = mlFalso();
  const r = await calcularFreteEPrecos({ params: PARAMS, base: BASE, precoFinal: 63.36, consultar, agora: () => "2026-10-09T12:00:00Z" });
  const g = r.registro;
  assert.equal(g.conta, "1729335019");
  assert.deepEqual(g.medida, { peso_g: 200, comprimento_cm: 8, largura_cm: 10, altura_cm: 15 });
  assert.equal(g.modalidade, "xd_drop_off");
  assert.equal(g.categoria, "MLB194431");
  assert.equal(g.tipoAnuncio, "classico");
  assert.equal(g.origem, ORIGEM_FRETE.ML);
  assert.equal(g.final.preco_cotado, 63.36);
  assert.equal(g.final.custo_vendedor, 8.15);
  assert.equal(g.final.frete_cheio, 11.64);
  assert.equal(g.final.desconto_pct, 30);
  assert.equal(g.final.peso_cobrado_g, 200);
  assert.equal(g.final.cotado_em, "2026-10-09T12:00:00Z");
  assert.equal(g.final.faixa_rotulo, "R$ 49,00 a R$ 78,99");
  assert.equal(linhasTabela(g).length, 4);
});

test("API indisponível / token inválido / timeout / resposta vazia: nunca vira cotação real", async () => {
  for (const falha of ["indisponivel", "token", "timeout", "vazio"]) {
    const { consultar } = mlFalso({ falha });
    const c = await cotarNoPreco({ params: PARAMS, preco: 63.36, consultar });
    assert.equal(c.ok, false, falha);
    const r = await calcularFreteEPrecos({ params: PARAMS, base: BASE, precoFinal: 63.36, consultar });
    assert.equal(r.ok, true, `${falha}: estimativa para analisar`);
    assert.equal(r.registro.origem, ORIGEM_FRETE.ESTIMATIVA);
    const s = situacaoFrete({ registro: r.registro, atual: { ...PARAMS, preco: 63.36 } });
    assert.equal(s.estado, "estimativa", "publicação bloqueada");
  }
  assert.equal(lerRespostaCotacao({ ok: true, dados: { coverage: { all_country: { list_cost: 10 } } } }).ok, false, "sem peso cobrado = ambígua");
});

test("estimativa PAIIA: identificada; acima de 500 g não estima", () => {
  const e = estimativaPAIIA({ medida: { peso_g: 200, comprimento_cm: 8, largura_cm: 10, altura_cm: 15 }, preco: 79 });
  assert.equal(e.origem, ORIGEM_FRETE.ESTIMATIVA);
  assert.equal(e.custo_vendedor, 12.95);
  assert.equal(estimativaPAIIA({ medida: { peso_g: 900, comprimento_cm: 8, largura_cm: 10, altura_cm: 15 }, preco: 79 }).ok, false);
});

test("desatualizado: troca de conta, peso, cada medida, modalidade, categoria, tipo, preço em outra faixa", async () => {
  const { consultar } = mlFalso();
  const { registro } = await calcularFreteEPrecos({ params: PARAMS, base: BASE, precoFinal: 78.99, consultar });
  const atual = { ...PARAMS, preco: 78.99 };
  assert.equal(situacaoFrete({ registro, atual }).estado, "ok");
  assert.equal(situacaoFrete({ registro, atual: { ...atual, preco: 60 } }).estado, "ok", "mesma faixa");
  const casos = [
    [{ conta: "824312524" }, /conta mudou/],
    [{ medida: { ...PARAMS.medida, peso_g: 350 } }, /peso mudou \(200 → 350\)/],
    [{ medida: { ...PARAMS.medida, comprimento_cm: 20 } }, /comprimento mudou/],
    [{ medida: { ...PARAMS.medida, largura_cm: 12 } }, /largura mudou/],
    [{ medida: { ...PARAMS.medida, altura_cm: 9 } }, /altura mudou/],
    [{ modalidade: "self_service" }, /modalidade mudou/],
    [{ categoria: "MLB1747" }, /categoria mudou/],
    [{ tipoAnuncio: "premium" }, /tipo de anúncio mudou/],
    [{ preco: 79 }, /outra faixa de frete/],
  ];
  for (const [mud, re] of casos) {
    const s = situacaoFrete({ registro, atual: { ...atual, ...mud } });
    assert.equal(s.estado, "desatualizado", JSON.stringify(mud));
    assert.ok(s.motivos.some((m) => re.test(m)), `${JSON.stringify(mud)} → ${s.motivos.join(" | ")}`);
  }
  assert.equal(situacaoFrete({ registro: null, atual }).estado, "sem_cotacao");
});

test("Conferência/Publicação: nova leitura só confere; diferença manda recalcular", async () => {
  const { registro } = await calcularFreteEPrecos({ params: PARAMS, base: BASE, precoFinal: 78.99, consultar: mlFalso().consultar });
  const igual = await cotarNoPreco({ params: PARAMS, preco: 78.99, consultar: mlFalso().consultar });
  assert.equal(conferirCotacao({ registro, nova: igual }).ok, true);
  const mudou = await cotarNoPreco({ params: PARAMS, preco: 78.99, consultar: mlFalso({ extra: 1 }).consultar });
  const c = conferirCotacao({ registro, nova: mudou });
  assert.equal(c.ok, false);
  assert.match(c.motivo, /frete R\$ 8,15 → R\$ 9,15.*recalcule/);
  const pesoMudou = await cotarNoPreco({ params: PARAMS, preco: 78.99, consultar: mlFalso({ peso: 350 }).consultar });
  assert.match(conferirCotacao({ registro, nova: pesoMudou }).motivo, /peso cobrado 200 g → 350 g/);
  const erro = await cotarNoPreco({ params: PARAMS, preco: 78.99, consultar: mlFalso({ falha: "token" }).consultar });
  assert.match(conferirCotacao({ registro, nova: erro }).motivo, /não foi possível confirmar/);
});

test("uma consulta por faixa (sem chamadas repetidas)", async () => {
  const m = mlFalso();
  await calcularFreteEPrecos({ params: PARAMS, base: BASE, precoFinal: 0, consultar: m.consultar });
  const faixas = new Set(m.chamadas.map((c) => faixaDoPreco(Number(new URL("https://x" + c).searchParams.get("item_price")))));
  assert.equal(m.chamadas.length, faixas.size);
});

test("telas: frete manual fora do fluxo ML; Publicação e Conferência usam o registro", () => {
  const na = ler("src/components/NovoAnuncio.jsx");
  assert.ok(na.includes("data-paiia-frete-ml-painel"));
  assert.ok(na.includes("calcularFreteEPrecos"));
  const rv = ler("src/components/RevisaoPublicacaoML.jsx");
  assert.ok(rv.includes("situacaoFrete(") && rv.includes("conferirCotacao("));
  const pe = ler("src/components/PesoEmbalagemML.jsx");
  assert.ok(pe.includes("conferirCotacao(") || pe.includes("registroFrete"));
});
