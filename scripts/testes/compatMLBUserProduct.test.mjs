// =============================================================
// (06/11/2026) MLB5511376521 (173373897R): respostas REAIS lidas no Mercado Livre.
//  - /user-products/{MLBU}/compatibilities → 400 “Missing request parameter”
//    não derruba mais a conferência (vale /items/{MLB}/compatibilities).
//  - Anúncio em categoria NÁUTICA: o PAIIA diz que a categoria impede os veículos
//    (por isso 0 de 36) e não oferece reenviar.
//   node --test scripts/testes/compatMLBUserProduct.test.mjs
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { lerCompatibilidadesDoMLB, conferirCompatibilidadesMLB, categoriaRecebeVeiculos } from "../../src/services/correcaoCompatMLB.js";

const NAUTICA = ["Acessórios para Veículos", "Peças Náuticas", "Motores e Peças", "Sistema de Combustível", "Mangueiras de Combustível"].map((name) => ({ name }));
const CARRO = ["Acessórios para Veículos", "Peças de Carros e Caminhonetes", "Motor", "Mangueira, Linha e Tubulações", "Mangueiras"].map((name) => ({ name }));
function ml({ categoria = "MLB271725", caminho = NAUTICA } = {}) {
  const chamadas = [];
  const consultar = async (c) => {
    chamadas.push(c);
    if (c === "/items/MLB5511376521") return { ok: true, dados: { id: "MLB5511376521", category_id: categoria, user_product_id: "MLBU5809924400", status: "active" } };
    if (c === "/items/MLB5511376521/compatibilities") return { ok: true, dados: { products: [] } };
    if (c === "/user-products/MLBU5809924400/compatibilities") return { ok: false, status: 400, erro: "Missing request parameter" };
    if (c === `/categories/${categoria}`) return { ok: true, dados: { id: categoria, path_from_root: caminho } };
    if (/BRAND\/top_values/.test(c)) return { ok: true, dados: [] };
    return { ok: false, erro: "?" };
  };
  return { consultar, chamadas };
}
const ficha = { id: "e91fdf5b", dados_conferencia: { ficha: { anuncioConferido: { tipoVeiculo: "Carro/Caminhonete", compatibilidades: "", aplicacoesDetalhadas: [] } } } };

test("400 do MLBU não derruba: lê o anúncio, 0 compatibilidades, aviso explicando", async () => {
  const r = await lerCompatibilidadesDoMLB("MLB5511376521", ml().consultar);
  assert.equal(r.ok, true);
  assert.equal(r.ids.size, 0);
  assert.match(r.avisoUserProduct, /MLBU5809924400.*Missing request parameter/);
  assert.equal(r.categoria.id, "MLB271725");
});

test("categoria náutica bloqueia (motivo claro); categoria de carro não", async () => {
  const r = await conferirCompatibilidadesMLB({ ficha, mlb: "MLB5511376521", consultar: ml().consultar });
  assert.equal(r.ok, true);
  assert.equal(r.noAnuncio, 0);
  assert.match(r.categoriaBloqueia, /Peças Náuticas.*fora de “Peças de Carros e Caminhonetes”/);
  const ok = await conferirCompatibilidadesMLB({ ficha, mlb: "MLB5511376521", consultar: ml({ categoria: "MLB458928", caminho: CARRO }).consultar });
  assert.equal(ok.categoriaBloqueia, "");
  assert.equal(categoriaRecebeVeiculos(null).ok, true, "sem caminho lido: não bloqueia por suposição");
});

test("tela: não oferece reenviar quando a categoria bloqueia", async () => {
  const fs = await import("node:fs");
  const t = fs.readFileSync(new URL("../../src/components/CorrecaoCompatMLB.jsx", import.meta.url), "utf8");
  assert.ok(t.indexOf("d.categoriaBloqueia ?") < t.indexOf("data-paiia-enviar-compat-mlb"), "bloqueio da categoria vem antes do botão de envio");
  assert.match(t, /data-paiia-compat-mlb-aviso-up/);
});
