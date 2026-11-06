// =============================================================
// (06/11/2026) Categoria simplificada: atributos obrigatórios preenchidos só com
// informação confiável; pendentes visíveis; gravados na decisão; Publicação lê.
//   node --test scripts/testes/categoriaSimples.test.mjs
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { montarAtributosCategoria, registrarAtributo, extrasDaDecisao, assinaturaAtributos, linhasRotuladas } from "../../src/services/atributosCategoriaML.js";
import { registrarConfirmacao, conferirCategoriaParaPublicar } from "../../src/services/categoriaML.js";

const CAPA = ["Borracha lisa", "Borracha envolvida", "Tecido trançado", "Trançado aço inox", "Termoplástico", "Resistente ao fogo", "Corrugado", "Revestimento PVC", "Cobertura EPDM"];
// Atributos reais da MLB458928 (Mangueiras), lidos em 06/11/2026, + um MATERIAL de exemplo.
const ATRIB = [
  { id: "BRAND", name: "Marca", tags: { required: true, catalog_required: true }, value_type: "string" },
  { id: "PART_NUMBER", name: "Número de peça", tags: { required: true, catalog_required: true }, value_type: "string" },
  { id: "COVER_TYPE", name: "Tipo de capa", tags: { required: true, catalog_required: true }, value_type: "string", values: CAPA.map((n, i) => ({ id: String(100 + i), name: n })) },
  { id: "VEHICLE_TYPE", name: "Tipo de veículo", tags: { required: true }, value_type: "list", values: [{ id: "1", name: "Carro/Caminhonete" }] },
  { id: "GTIN", name: "Código universal de produto", tags: { conditional_required: true } },
  { id: "LENGTH", name: "Comprimento", tags: {} },
];
const MATERIAL = { id: "MATERIAL", name: "Material", tags: { required: true }, values: [{ id: "m1", name: "PVC" }, { id: "m2", name: "Borracha" }] };
const ficha = { marca: "Torken", numeroPeca: "173373897R", tipoVeiculo: "Carro/Caminhonete", textos: ["Material: PVC\nCondição do item: Produto novo", "", "Tubo De PVC Mangueira De Combustível Absorção"] };

test("MLB458928: Marca/Número/Tipo de veículo vêm dos campos; Tipo de capa fica PENDENTE (PVC é material, não capa)", () => {
  const r = montarAtributosCategoria({ categoriaId: "MLB458928", atributosBrutos: ATRIB, ficha });
  assert.equal(r.lido, true);
  assert.deepEqual(r.itens.map((i) => [i.id, i.pendente, i.valor]), [["BRAND", false, "Torken"], ["PART_NUMBER", false, "173373897R"], ["COVER_TYPE", true, ""], ["VEHICLE_TYPE", false, "Carro/Caminhonete"]]);
  assert.deepEqual(r.pendentes.map((p) => p.id), ["COVER_TYPE"]);
  assert.equal(r.completo, false);
  assert.ok(!r.itens.some((i) => i.id === "GTIN" || i.id === "LENGTH"), "só obrigatórios; GTIN tem bloco próprio");
});

test("Material: só com linha “Material: …” e valor IGUAL a uma opção oficial; parecido = pendente com aviso", () => {
  const r = montarAtributosCategoria({ categoriaId: "MLBX1", atributosBrutos: [MATERIAL], ficha });
  assert.deepEqual([r.itens[0].valor, r.itens[0].valueId, r.itens[0].origem, r.completo], ["PVC", "m1", "da ficha", true]);
  assert.deepEqual(r.paraGravar, { categoria_id: "MLBX1", valores: { MATERIAL: { value_id: "m1", value_name: "PVC", nome: "Material", origem: "ficha" } } });
  const duvida = montarAtributosCategoria({ categoriaId: "MLBX1", atributosBrutos: [MATERIAL], ficha: { textos: ["Material: plástico PVC flexível"] } });
  assert.equal(duvida.itens[0].pendente, true);
  assert.match(duvida.itens[0].duvida, /não é uma opção/);
  const sem = montarAtributosCategoria({ categoriaId: "MLBX1", atributosBrutos: [MATERIAL], ficha: { textos: ["Tubo de PVC"] } });
  assert.equal(sem.itens[0].pendente, true, "PVC solto no título não preenche (sem rótulo)");
  assert.equal(sem.itens[0].duvida, undefined);
});

test("escolha do usuário: gravada na decisão, vale só para a mesma categoria, mantida ao reconfirmar; Publicação lê", () => {
  let r = montarAtributosCategoria({ categoriaId: "MLB458928", atributosBrutos: ATRIB, ficha });
  const capa = r.pendentes[0];
  const salvos = registrarAtributo(null, { categoriaId: "MLB458928", atributo: capa, valueId: "107", valueName: "Revestimento PVC", agora: "t" });
  r = montarAtributosCategoria({ categoriaId: "MLB458928", atributosBrutos: ATRIB, ficha, salvos });
  assert.equal(r.completo, true);
  assert.deepEqual(r.itens.find((i) => i.id === "COVER_TYPE"), { id: "COVER_TYPE", nome: "Tipo de capa", valores: capa.valores, tipo: "lista", valor: "Revestimento PVC", valueId: "107", origem: "confirmado por você", pendente: false });
  // outra categoria: o valor salvo não vale
  assert.equal(montarAtributosCategoria({ categoriaId: "MLB999", atributosBrutos: ATRIB, ficha, salvos }).completo, false);
  // reconfirmar a categoria mantém os atributos
  const dec = registrarConfirmacao({ atributos: salvos }, { candidata: { id: "MLB458928", caminho: "x" }, avaliacao: null });
  assert.deepEqual(dec.atributos, salvos);
  // Publicação: atributos_extras da decisão confirmada (campos próprios ficam de fora)
  assert.deepEqual(extrasDaDecisao({ ...dec, atributos: r.paraGravar }), { COVER_TYPE: { value_id: "107" } });
  assert.deepEqual(extrasDaDecisao({ confirmada: { id: "MLB1" }, atributos: r.paraGravar }), {}, "categoria diferente: nada");
  // assinatura estável (aprovação cai se mudar)
  assert.equal(assinaturaAtributos(r.paraGravar), "COVER_TYPE=107|revestimento pvc");
  // apagar (alterar) volta a pendente
  const limpo = registrarAtributo(salvos, { categoriaId: "MLB458928", atributo: capa, valueId: "", valueName: "" });
  assert.equal(montarAtributosCategoria({ categoriaId: "MLB458928", atributosBrutos: ATRIB, ficha, salvos: limpo }).completo, false);
});

test("Marca vazia: pendente apontando o campo Marca (nada inventado); valor salvo que deixou de ser opção oficial = pendente", () => {
  const r = montarAtributosCategoria({ categoriaId: "MLB458928", atributosBrutos: ATRIB, ficha: { ...ficha, marca: "" } });
  assert.deepEqual(r.pendentes.map((p) => [p.id, p.campoProprio || ""]), [["BRAND", "Marca"], ["COVER_TYPE", ""]]);
  const velho = { categoria_id: "MLB458928", valores: { COVER_TYPE: { value_id: "999", value_name: "Capa antiga" } } };
  assert.equal(montarAtributosCategoria({ categoriaId: "MLB458928", atributosBrutos: ATRIB, ficha, salvos: velho }).completo, false);
  assert.deepEqual(linhasRotuladas(["• Material: PVC.", "Cor - preto"]), { material: "PVC" });
});

test("validações preservadas: categoria só confirmada por clique; incompatível exige revisão explícita", () => {
  const det = { id: "MLB1", niveis: ["Casa"], caminho: "Casa", listingAllowed: true };
  const r = conferirCategoriaParaPublicar({ categoriaId: "MLB1", decisao: { confirmada: { id: "MLB1" } }, detalhe: det });
  assert.equal(r.ok, false);
  assert.ok(r.motivos.some((m) => /incompatível/.test(m)));
  assert.equal(conferirCategoriaParaPublicar({ categoriaId: "MLB458928", decisao: null, detalhe: null }).ok, false);
});

test("tela: uma opção + Buscar Categoria + Trocar; exceções em “Avançado”; atributos abaixo; aprovação bloqueada com pendente", () => {
  const p = fs.readFileSync(new URL("../../src/components/PainelCategoriaML.jsx", import.meta.url), "utf8");
  for (const t of ["Usar esta categoria", "🔎 Buscar Categoria", ">Trocar<", "data-paiia-categoria-avancado", "✅ Atributos completos", "data-paiia-atributo-pendente", "Seguir para a Revisão final"]) assert.ok(p.includes(t), t);
  const av = p.slice(p.indexOf("data-paiia-categoria-avancado"));
  assert.ok(av.includes("<Revisao c={c}") && av.includes("<RejeitarManual"), "revisar/rejeitar só no Avançado");
  const m = fs.readFileSync(new URL("../../src/components/MercadoLivreTeste.jsx", import.meta.url), "utf8");
  assert.match(m, /Atributos obrigatórios da categoria \(bloco ⑮\)/);
  assert.match(m, /\/\^MLB\\d\+\$\/i\.test\(termo\)/);
  assert.match(m, /assinaturaAtributos\(atributosCategoria\.paraGravar\)/);
  const pub = fs.readFileSync(new URL("../../src/components/RevisaoPublicacaoML.jsx", import.meta.url), "utf8");
  assert.match(pub, /useState\(\(\) => extrasDaDecisao\(anuncio\?\.categoriaDecisao\)\)/);
});
