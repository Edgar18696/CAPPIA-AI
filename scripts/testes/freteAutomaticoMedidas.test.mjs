// Publicação automática: medidas confirmadas mudaram (mangueira 8108010U2020: 80×30×20 → 60×20×10 cm, 350 g)
// → o frete da ficha fica desatualizado e é RECALCULADO no ML (cotação oficial), sem o procedimento antigo.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { situacaoFrete, calcularFreteEPrecos, parametrosCotacao } from "../../src/services/fretePrecificacao.js";

const CONTA = "1729335019";
const consultar = async () => ({ ok: true, dados: { coverage: { all_country: { list_cost: 19.85, billable_weight: 350, currency_id: "BRL" } } } });
const medidaNova = { peso_g: 350, comprimento_cm: 60, largura_cm: 20, altura_cm: 10 };

test("1) medidas mudaram: frete da ficha desatualizado; recalculado com as medidas confirmadas fica válido (R$ 19,85)", async () => {
  const params0 = parametrosCotacao({ conta: CONTA, medida: { peso_g: 350, comprimento_cm: 80, largura_cm: 30, altura_cm: 20 }, modalidade: "me2", categoria: "MLB191833", tipoAnuncio: "classico" });
  const antigo = await calcularFreteEPrecos({ params: params0, base: { custo: 40, despesas: 0, comissao: 12, imposto: 0 }, precoFinal: "89,90", consultar, estimar: false });
  assert.equal(antigo.ok, true, antigo.erro);
  const atual = { conta: CONTA, medida: medidaNova, modalidade: "me2", categoria: "MLB191833", tipoAnuncio: "classico", preco: "89,90" };
  assert.equal(situacaoFrete({ registro: antigo.registro, atual }).estado, "desatualizado");
  const novo = await calcularFreteEPrecos({ params: parametrosCotacao(atual), base: antigo.registro.base, precoFinal: "89,90", consultar, estimar: false });
  assert.equal(novo.ok, true, novo.erro);
  assert.equal(situacaoFrete({ registro: novo.registro, atual }).estado, "ok");
  assert.equal(novo.registro.final.custo_vendedor ?? novo.registro.final.frete, 19.85);
});

test("2) só no modo automático e só com cotação oficial (estimar:false); a tela normal continua igual", () => {
  const r = fs.readFileSync(new URL("../../src/components/RevisaoPublicacaoML.jsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  const f = r.slice(r.indexOf("async function conferirFretePublicacao()"), r.indexOf("useEffect(", r.indexOf("async function conferirFretePublicacao()")));
  assert.ok(f.includes("const auto = Boolean(autoPublicacao || autoPublicacaoDaUrl());") && f.includes("if (auto && contaEscolhida)") && f.includes('if (s0.estado !== "ok")'));
  assert.ok(f.includes("nova.origem === ORIGEM_FRETE.SIMULACAO"), "cotação simulada nunca vale");
});

test("3) caminho único: fluxo antigo montado mas OCULTO com a autorização única; manual só se pedido", () => {
  const m = fs.readFileSync(new URL("../../src/components/MercadoLivreTeste.jsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  assert.ok(m.includes('const modoAutorizacaoUnica = (Boolean(autoPiloto) || lojaOnlineConectada) && !publicacaoManual;'));
  assert.ok(m.includes('data-paiia-fluxo-antigo={modoAutorizacaoUnica ? "oculto" : "visivel"}') && m.includes("data-paiia-fluxo-antigo-base"));
  assert.ok(fs.readFileSync(new URL("../../src/components/AutorizacaoUnicaPublicacao.jsx", import.meta.url), "utf8").includes("data-paiia-publicacao-manual"));
});

test("4) (correção 12/11) recálculo pela cotação no preço com as medidas atuais — sem depender do custo/margens; reconfere quando a autorização chega; pausa rápida com o motivo", () => {
  const r = fs.readFileSync(new URL("../../src/components/RevisaoPublicacaoML.jsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  assert.ok(r.includes("const nova = await cotarNoPreco({ params, preco: campos.preco") && !r.includes("calcularFreteEPrecos({ params, base"), "não exige custo nem a tabela de margens");
  assert.ok(r.includes("autoPublicacao, JSON.stringify(logistica?.medida || null)]);"), "reconfere o frete quando a autorização chega ou as medidas mudam");
  assert.ok(r.includes("if (!c.ok && !(auto && c.diferenca)) return { ok: false, motivo: c.motivo };"), "cotação oficial diferente vale no automático (informada); falha da cotação continua bloqueando");
  assert.ok(r.includes("data-paiia-bloqueios-detalhe"));
  const p = fs.readFileSync(new URL("../../src/services/pilotoPublicacao.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  assert.ok(p.includes("estavel >= (L.estavel || 4)"), "bloqueio estável = pausa já, sem esperar minutos");
});
