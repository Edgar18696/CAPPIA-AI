// =============================================================
// PAIIA Voz — (08/11) Envio ANTES de Preço; frete de VENDA (Mercado Livre) separado do de compra.
//   node --test scripts/testes/paiiaVozOrdemEnvioPreco.test.mjs
// Sem rede: a consulta ao Mercado Livre é simulada (respostas no formato oficial).
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { register } from "node:module";

register("./simulacao/ganchoSupabaseFalso.mjs", import.meta.url);

const R = await import("../../src/modules/paiiaVoz/servicos/rascunhoRapido.js");
const F = await import("../../src/modules/paiiaVoz/servicos/fichaVoz.js");
const C = await import("../../src/modules/paiiaVoz/servicos/completarVoz.js");
const P = await import("../../src/modules/paiiaVoz/servicos/passoFinalVoz.js");
const V = await import("../../src/modules/paiiaVoz/servicos/freteVendaVoz.js");
const K = await import("../../src/modules/paiiaVoz/servicos/calculadoraPreco.js");
const ler = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

const ORDEM = ["fotos", "codigo", "descricao", "envio", "preco", "compat", "categoria", "finalizar"];

function fichaComEnvio({ peso = "300", c = "20", l = "10", a = "8" } = {}) {
  let f = F.aplicarInterpretacao(F.criarFichaVoz({ id: "ev", agora: 1 }), { itens: [{ campo: "codigoPrincipal", valor: "IWP211" }], naoEntendido: [], avisos: [] }).ficha;
  for (const [k, v] of [["peso", peso], ["comprimento", c], ["largura", l], ["altura", a]]) { const r = C.definirCampoDireto(f, k, v, { origem: "digitado" }); assert.ok(r.ok, `${k}: ${r.erro}`); f = r.ficha; }
  return f;
}
// Mercado Livre simulado (formato oficial de shipping_preferences e shipping_options/free)
function mlFalso({ custo = 23.45, falhar = false } = {}) {
  const chamadas = [];
  return {
    chamadas,
    deps: {
      modalidades: async () => ({ ok: true, modalidades: [{ tipo: "drop_off", padrao: true }] }),
      consultar: async (caminho) => {
        chamadas.push(caminho);
        if (falhar) return { ok: false, status: 503, erro: "Mercado Livre indisponível." };
        return { ok: true, status: 200, dados: { coverage: { all_country: { list_cost: custo, currency_id: "BRL", billable_weight: 400, discount: { rate: 0.5, promoted_amount: custo * 2 } } } } };
      },
    },
  };
}

test("1) ordem: Fotos, Código, Título e Descrição, ENVIO, PREÇO, Compat., Categoria, Finalizar", () => {
  assert.deepEqual(R.ETAPAS, ORDEM);
  assert.deepEqual(P.ETAPAS_OBRIGATORIAS, ORDEM.slice(0, -1));
  assert.equal(R.proximaEtapa("descricao", 1), "envio");
  assert.equal(R.proximaEtapa("envio", 1), "preco");
  assert.equal(R.proximaEtapa("preco", 1), "compat");
  assert.equal(R.proximaEtapa("preco", -1), "envio");
  assert.equal(R.proximaEtapa("envio", -1), "descricao");
  assert.equal(R.proximaEtapa("compat", -1), "preco");
});

test("2) botões Voltar/Próximo de cada etapa seguem a nova ordem", () => {
  const t = ler("src/modules/paiiaVoz/PaiiaVozRapido.jsx");
  const bloco = (e) => { const i = t.indexOf(`{etapa === "${e}" && (`); return t.slice(i, t.indexOf("</section>", i)); };
  assert.ok(bloco("descricao").includes('navEtapa("codigo", "envio")'));
  assert.ok(bloco("envio").includes('navEtapa("descricao", "preco")'));
  assert.ok(bloco("preco").includes('navEtapa("envio", "compat")'));
  assert.ok(bloco("compat").includes('navEtapa("preco", "categoria")'));
  assert.ok(t.indexOf('{etapa === "envio" && (') < t.indexOf('{etapa === "preco" && ('), "Envio aparece antes do Preço no código da tela");
  assert.ok(t.includes("{ROTULOS_ETAPAS[e]}") && t.includes(": i + 1}"), "numeração da barra vem da ordem");
});

test("3) Envio: com peso e medidas, consulta o frete de venda do Mercado Livre (só leitura) e guarda na ficha", async () => {
  const f = fichaComEnvio();
  const ml = mlFalso();
  const r = await V.cotarFreteVendaVoz(f, { conta: "123456", preco: 79, deps: ml.deps });
  assert.ok(r.ok, r.erro);
  assert.equal(ml.chamadas.length, 1);
  assert.match(ml.chamadas[0], /^\/users\/123456\/shipping_options\/free\?dimensions=20x10x8%2C300&item_price=79\.00/);
  assert.equal(r.registro.valor, 23.45);
  assert.equal(r.registro.origem, "mercado_livre");
  const g = V.registrarFreteVenda(f, r.registro);
  const s = V.situacaoFreteVenda(g, 85);
  assert.equal(s.estado, "ok");
  assert.equal(s.valor, 23.45);
  assert.match(s.texto, /Frete de venda do Mercado Livre: R\$ 23,45/);
});

test("4) sem peso/medidas, sem conta ou com falha do ML: nada inventado, frete PENDENTE (não é zero)", async () => {
  const semMedida = F.aplicarInterpretacao(F.criarFichaVoz({ id: "x", agora: 1 }), { itens: [{ campo: "codigoPrincipal", valor: "IWP211" }], naoEntendido: [], avisos: [] }).ficha;
  assert.match((await V.cotarFreteVendaVoz(semMedida, { conta: "1", preco: 79, deps: mlFalso().deps })).erro, /peso e as 3 medidas/);
  assert.match((await V.cotarFreteVendaVoz(fichaComEnvio(), { conta: "", preco: 79, deps: mlFalso().deps })).erro, /conta/);
  const falha = await V.cotarFreteVendaVoz(fichaComEnvio(), { conta: "1", preco: 79, deps: mlFalso({ falhar: true }).deps });
  assert.equal(falha.ok, false);
  const s = V.situacaoFreteVenda(fichaComEnvio(), 80);
  assert.equal(s.estado, "pendente");
  assert.equal(s.valor, null, "pendente não vira zero");
  assert.match(s.texto, /Frete pendente/);
});

test("5) Preço: o frete de venda entra no preço sugerido, SEPARADO do frete de compra; pendente não sugere preço", () => {
  const plano = { custo: "30", frete: "2", despesas: "1", comissao: "17", impostos: "8", margem: "20" };
  const comVenda = K.calcularPrecoVenda({ ...plano, freteVenda: "23,45" });
  assert.ok(comVenda.ok);
  assert.equal(comVenda.partes.frete, 2, "frete de compra");
  assert.equal(comVenda.partes.freteVenda, 23.45, "frete de venda");
  assert.equal(comVenda.preco, Math.ceil(((30 + 2 + 23.45 + 1) / (1 - 0.45)) * 100) / 100);
  const pend = K.calcularPrecoVenda({ ...plano, fretePendente: true });
  assert.equal(pend.ok, false);
  assert.match(pend.erro, /Frete pendente/);
  assert.equal(K.precoParaUsar({ ...plano, fretePendente: true }), null, "sem frete não oferece 'Usar Preço Sugerido'");
  const an = K.analisarVenda({ venda: "120", custo: "30", frete: "2", freteVenda: "23,45", despesas: "1", comissao: "17", impostos: "8" });
  assert.equal(an.partes.freteVenda, 23.45);
  assert.equal(an.sobra, Math.round((120 - 20.4 - 9.6 - 2 - 23.45 - 1 - 30) * 100) / 100);
});

test("6) estimativa identificada quando não há cotação; mudar peso/medidas ou faixa de preço pede nova cotação", async () => {
  let f = V.definirFreteEstimado(fichaComEnvio(), "18,90");
  let s = V.situacaoFreteVenda(f, 90);
  assert.equal(s.estado, "estimativa");
  assert.match(s.texto, /Estimativa informada por você: R\$ 18,90 \(não é cotação do Mercado Livre\)/);
  f = V.definirFreteEstimado(f, "");
  assert.equal(V.situacaoFreteVenda(f).estado, "pendente", "apagar a estimativa volta a pendente");
  const r = await V.cotarFreteVendaVoz(fichaComEnvio(), { conta: "1", preco: 79, deps: mlFalso().deps });
  f = V.registrarFreteVenda(fichaComEnvio(), r.registro);
  assert.equal(V.situacaoFreteVenda(f, 150).estado, "outra_faixa", "R$ 150 está em outra faixa que R$ 79");
  f = C.definirCampoDireto(f, "peso", "900", { origem: "digitado" }).ficha;
  assert.equal(V.situacaoFreteVenda(f, 85).estado, "pendente", "peso mudou: cotação antiga não vale");
});

test("7) preço para cotar: o Preço de Venda, senão o sugerido sem frete de venda, senão a referência identificada", () => {
  const f = fichaComEnvio();
  assert.deepEqual(V.precoParaCotar(f), { preco: 79, origem: "referencia" });
  assert.equal(V.precoParaCotar(f, { custo: "30", comissao: "17", margem: "20" }).origem, "sugerido");
  const comPreco = C.definirCampoDireto(f, "preco", "120", { origem: "digitado" }).ficha;
  assert.deepEqual(V.precoParaCotar(comPreco), { preco: 120, origem: "preco" });
});

test("8) navegar entre as etapas não perde nada: o frete fica na ficha (guardada no aparelho)", async () => {
  const r = await V.cotarFreteVendaVoz(fichaComEnvio(), { conta: "1", preco: 79, deps: mlFalso().deps });
  let f = V.registrarFreteVenda(fichaComEnvio(), r.registro);
  f = C.definirValorCalculadora(f, "custo", "30", { origem: "digitado" });
  for (const e of ORDEM) f = R.irParaEtapa(f, e);
  for (const e of [...ORDEM].reverse()) f = R.irParaEtapa(f, e);
  assert.equal(f.freteVenda.valor, 23.45);
  assert.equal(C.valoresCalculadoraDaFicha(f).custo.valor, "30");
  assert.equal(C.valoresCamposDiretos(f).peso, "300");
});

test("9) tela: Envio mostra o frete de venda; a calculadora mostra Frete de compra e Frete de venda separados", () => {
  const t = ler("src/modules/paiiaVoz/PaiiaVozRapido.jsx");
  const envio = t.slice(t.indexOf('{etapa === "envio" && ('), t.indexOf('{etapa === "preco" && ('));
  assert.ok(envio.includes("data-pv-frete-venda") && envio.includes("consultarFreteVenda"), "consulta no Envio");
  assert.ok(!envio.includes("O PAIIA não estima frete"), "texto antigo do frete só na finalização retirado");
  const calc = ler("src/modules/paiiaVoz/CalculadoraPrecoVoz.jsx");
  assert.ok(calc.includes('["frete", "Frete de compra"'), "frete de compra");
  assert.ok(calc.includes("data-pv-calc-frete-venda") && calc.includes("Frete de venda (Mercado Livre)"), "frete de venda separado");
  assert.ok(calc.includes("data-pv-calc-frete-pendente") && calc.includes("Frete pendente"));
});
