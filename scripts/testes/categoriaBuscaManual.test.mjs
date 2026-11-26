// =============================================================
// (25/11/2026) Bloco ⑮ — busca MANUAL de categoria: só o termo digitado,
// consulta nova a cada busca, resultado próprio (sem a sugestão automática),
// código MLB direto e aviso claro quando nada é encontrado.
//   node --test scripts/testes/categoriaBuscaManual.test.mjs
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buscarCategoriasManual } from "../../src/services/categoriaMLBusca.js";

const RAMO = ["Acessórios para Veículos", "Peças de Carros e Caminhonetes"];
const CATS = {
  MLB270881: { name: "Colunas de Direção", path: [...RAMO, "Direção", "Colunas de Direção"] },
  MLB191833: { name: "Rolamentos", path: [...RAMO, "Transmissão", "Rolamentos"] },
  MLB116464: { name: "Câmbios", path: [...RAMO, "Transmissão", "Câmbios"] },
  MLB1000: { name: "Rolamentos industriais", path: ["Indústria e Comércio", "Rolamentos"] },
};
const PREDITOR = {
  rolamento: ["MLB191833", "MLB1000"],
  "câmbio": ["MLB116464"],
  "rolamento câmbio": ["MLB191833", "MLB116464"],
  "eixo intermediário": ["MLB270881"],
};
function falsoML() {
  const chamadas = [];
  const lerJson = async (url) => {
    chamadas.push(url);
    const q = url.match(/domain_discovery\/search\?q=([^&]+)/);
    if (q) return (PREDITOR[decodeURIComponent(q[1]).toLowerCase()] || []).map((id) => ({ category_id: id, category_name: CATS[id].name, domain_id: "MLB-X" }));
    const m = url.match(/categories\/(MLB\d+)(\/attributes)?$/);
    if (!m || !CATS[m[1]]) return null;
    if (m[2]) return [];
    return { id: m[1], name: CATS[m[1]].name, path_from_root: CATS[m[1]].path.map((name) => ({ name })), settings: {}, children_categories: [] };
  };
  return { lerJson, chamadas };
}
const base = { tipoVeiculo: "Carro/Caminhonete", rejeicoes: [] };

test("cada termo consulta o ML SÓ com o termo digitado e devolve as categorias dele (não a automática)", async () => {
  const esperado = { Rolamento: ["MLB191833", "MLB1000"], "Câmbio": ["MLB116464"], "Rolamento câmbio": ["MLB191833", "MLB116464"], "Eixo intermediário": ["MLB270881"] };
  for (const [termo, ids] of Object.entries(esperado)) {
    const ml = falsoML();
    const r = await buscarCategoriasManual({ ...base, termo, lerJson: ml.lerJson });
    const preditor = ml.chamadas.filter((u) => u.includes("domain_discovery"));
    assert.equal(preditor.length, 1, termo);
    assert.ok(preditor[0].includes(`q=${encodeURIComponent(termo)}&`), termo);
    assert.deepEqual(r.avaliacao.candidatas.map((c) => c.id).sort(), [...ids].sort(), termo);
    if (termo !== "Eixo intermediário") assert.ok(!r.avaliacao.candidatas.some((c) => c.id === "MLB270881"), `${termo}: sem Colunas de Direção`);
  }
});

test("busca repetida faz consulta NOVA (sem cache)", async () => {
  const ml = falsoML();
  await buscarCategoriasManual({ ...base, termo: "Rolamento", lerJson: ml.lerJson });
  await buscarCategoriasManual({ ...base, termo: "Rolamento", lerJson: ml.lerJson });
  assert.equal(ml.chamadas.filter((u) => u.includes("domain_discovery")).length, 2);
  assert.equal(ml.chamadas.filter((u) => u.endsWith("/categories/MLB191833")).length, 2);
});

test("categoria fora de Acessórios para Veículos aparece, mas com o motivo (não pode ser usada direto)", async () => {
  const r = await buscarCategoriasManual({ ...base, termo: "Rolamento", lerJson: falsoML().lerJson });
  const ind = r.avaliacao.candidatas.find((c) => c.id === "MLB1000");
  assert.equal(ind.compativel, false);
  assert.match(ind.bloqueios.join(" "), /fora de "Acessórios para Veículos"/);
  assert.equal(r.avaliacao.candidatas.find((c) => c.id === "MLB191833").compativel, true);
  assert.equal(r.mensagem, "");
});

test("código MLB: lido direto, sem preditor", async () => {
  const ml = falsoML();
  const r = await buscarCategoriasManual({ ...base, termo: " mlb270881 ", lerJson: ml.lerJson });
  assert.equal(r.tipo, "codigo");
  assert.equal(ml.chamadas.filter((u) => u.includes("domain_discovery")).length, 0);
  assert.deepEqual(r.avaliacao.candidatas.map((c) => [c.id, c.compativel, c.caminho]), [["MLB270881", true, [...RAMO, "Direção", "Colunas de Direção"].join(" > ")]]);
  const inexistente = await buscarCategoriasManual({ ...base, termo: "MLB999", lerJson: ml.lerJson });
  assert.equal(inexistente.encontradas, 0);
  assert.match(inexistente.mensagem, /não encontrou a categoria MLB999/);
});

test("nada encontrado / ML sem resposta / termo vazio: aviso claro", async () => {
  const nada = await buscarCategoriasManual({ ...base, termo: "xyzabc", lerJson: falsoML().lerJson });
  assert.equal(nada.encontradas, 0);
  assert.match(nada.mensagem, /Nenhuma categoria encontrada no Mercado Livre para “xyzabc”/);
  const fora = await buscarCategoriasManual({ ...base, termo: "Rolamento", lerJson: async () => null });
  assert.match(fora.mensagem, /não respondeu/);
  const vazio = await buscarCategoriasManual({ ...base, termo: "  ", lerJson: falsoML().lerJson });
  assert.equal(vazio.tipo, "vazio");
  assert.match(vazio.mensagem, /Digite/);
});

test("categoria rejeitada para o SKU continua marcada na busca manual", async () => {
  const r = await buscarCategoriasManual({ ...base, termo: "Câmbio", rejeicoes: [{ categoria_id: "MLB116464", mlb: "MLB1", motivo: "x" }], lerJson: falsoML().lerJson });
  assert.equal(r.avaliacao.candidatas[0].rejeitada, true);
  assert.match(r.mensagem, /Nenhuma das 1/);
});

test("tela: busca manual tem resultado próprio, descarta resposta antiga e não usa os termos automáticos", () => {
  const m = fs.readFileSync(new URL("../../src/components/MercadoLivreTeste.jsx", import.meta.url), "utf8");
  const f = m.slice(m.indexOf("async function buscarCategoriaManual()"), m.indexOf("function limparBuscaCategoriaManual()"));
  assert.ok(f.includes("buscarCategoriasManual({ termo"), "consulta só o termo");
  assert.ok(f.includes("seq !== buscaCategoriaSeqRef.current"), "descarta resposta antiga");
  assert.ok(!f.includes("avaliarCategoria()") && !f.includes("termosExtrasCategoriaRef.current ="), "não mistura com a automática");
  assert.ok(m.includes("buscaManual={buscaCategoriaManual}"));
  const p = fs.readFileSync(new URL("../../src/components/PainelCategoriaML.jsx", import.meta.url), "utf8");
  assert.ok(p.includes("data-paiia-categoria-busca-manual") && p.includes("data-paiia-categoria-busca-nenhuma") && p.includes("Voltar à sugestão automática"));
});
