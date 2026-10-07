// =============================================================
// PAIIA — TESTES: Tipo de veículo (⑤ Características principais)
//   node --test scripts/testes/tipoVeiculoAnuncio.test.mjs
// Sem rede. Sugestão automática SIM; decisão automática NÃO; usuário
// pode trocar SEMPRE; escolha manual não é sobrescrita; publica o tipo
// da ficha; confere depois de publicar.
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  OPCOES_TIPO_VEICULO, TIPO_CARRO, TIPO_PESADA, ORIGEM_MANUAL, ORIGEM_SUGESTAO,
  normalizarTipoVeiculo, sugestaoPorAplicacoes, sugestaoPorCategoria, sugerirTipoVeiculo,
  aplicarSugestaoTipoVeiculo, escolherTipoVeiculo, tipoVeiculoNaCategoria, tipoVeiculoParaPublicacao,
} from "../../src/services/tipoVeiculoAnuncio.js";
import { tipoVeiculoDaCategoria, conferirPublicacao } from "../../src/services/compatibilidadeML.js";
import { conferirFichaPersistida } from "../../src/services/publicacaoSegura.js";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ler = (rel) => fs.readFileSync(path.join(RAIZ, rel), "utf8").replace(/\r\n/g, "\n");

// Atributos reais das categorias (formato GET /categories/{id}/attributes).
const ATTR = {
  carro: [{ id: "VEHICLE_TYPE", tags: { catalog_required: true, fixed: true, required: true }, values: [{ id: "11377043", name: "Carro/Caminhonete" }] }],
  pesada: [{ id: "VEHICLE_TYPE", tags: { fixed: true, required: true }, values: [{ id: "13222040", name: "Linha Pesada" }] }],
  moto: [{ id: "VEHICLE_TYPE", tags: { fixed: true, required: true }, values: [{ id: "15279767", name: "Moto/Quadriciclo" }] }],
  nautica: [{ id: "BRAND", values: [] }],
};
const CAT = Object.fromEntries(Object.entries(ATTR).map(([k, v]) => [k, tipoVeiculoDaCategoria(v)]));
const OBRIG = (k) => ({ id: "VEHICLE_TYPE", nome: "Tipo de veículo", preenchido: false, valores: ATTR[k][0].values.map((v) => ({ id: v.id, nome: v.name })) });

const APL_CARRO = [{ montadora: "RENAULT", modelo: "Duster", motor: "1.6" }, { montadora: "Nissan", modelo: "Kicks" }];
const APL_PESADA = [{ montadora: "MERCEDES-BENZ", modelo: "Atego 1719" }, { montadora: "Scania", modelo: "R 440" }];

test("A) opções: exatamente Carro/Caminhonete e Linha Pesada (nunca 'Linha Leve')", () => {
  assert.deepEqual([...OPCOES_TIPO_VEICULO], ["Carro/Caminhonete", "Linha Pesada"]);
  assert.equal(normalizarTipoVeiculo("Carro / Caminhonete"), TIPO_CARRO);
  assert.equal(normalizarTipoVeiculo("carro/caminhonete"), TIPO_CARRO);
  assert.equal(normalizarTipoVeiculo("LINHA PESADA"), TIPO_PESADA);
  assert.equal(normalizarTipoVeiculo({ value_name: "Linha Pesada" }), TIPO_PESADA);
  assert.equal(normalizarTipoVeiculo("Linha Leve"), "", "Linha Leve não é opção e não vira Carro sozinho");
  assert.equal(normalizarTipoVeiculo("Moto/Quadriciclo"), "");
  assert.equal(normalizarTipoVeiculo(""), "");
  const mod = ler("src/services/tipoVeiculoAnuncio.js").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.equal(/Linha Leve/i.test(mod), false, "código não oferece Linha Leve");
});

test("B) sugestão pelas aplicações confirmadas (só quando todas concordam)", () => {
  assert.equal(sugestaoPorAplicacoes(APL_CARRO), TIPO_CARRO);
  assert.equal(sugestaoPorAplicacoes(APL_PESADA), TIPO_PESADA);
  assert.equal(sugestaoPorAplicacoes([{ montadora: "Volkswagen", modelo: "Constellation 24.280" }]), TIPO_PESADA);
  assert.equal(sugestaoPorAplicacoes([{ montadora: "Ford", modelo: "Cargo 1719" }]), TIPO_PESADA);
  assert.equal(sugestaoPorAplicacoes([...APL_CARRO, ...APL_PESADA]), "", "misturado: o usuário decide");
  assert.equal(sugestaoPorAplicacoes([{ montadora: "Honda", modelo: "CG 160 moto" }]), "");
  assert.equal(sugestaoPorAplicacoes([{ montadora: "Marca Desconhecida", modelo: "X" }]), "");
  assert.equal(sugestaoPorAplicacoes([]), "");
});

test("C) sugestão pela categoria ML; categoria prevalece e avisa divergência", () => {
  assert.equal(sugestaoPorCategoria(CAT.carro), TIPO_CARRO);
  assert.equal(sugestaoPorCategoria(CAT.pesada), TIPO_PESADA);
  assert.equal(sugestaoPorCategoria(CAT.moto), "");
  assert.equal(sugestaoPorCategoria(CAT.nautica), "");
  assert.deepEqual(sugerirTipoVeiculo({ infoCategoria: CAT.pesada, aplicacoes: APL_PESADA }), { valor: TIPO_PESADA, origem: "categoria", divergencia: false, aplicacoes: TIPO_PESADA });
  const d = sugerirTipoVeiculo({ infoCategoria: CAT.carro, aplicacoes: APL_PESADA });
  assert.equal(d.valor, TIPO_CARRO); assert.equal(d.divergencia, true);
  assert.equal(sugerirTipoVeiculo({ infoCategoria: null, aplicacoes: APL_CARRO }).origem, "aplicacoes");
  assert.equal(sugerirTipoVeiculo({}).valor, "");
});

test("D) sugestão preenche, mas NÃO é decisão: o usuário troca e a escolha manual não é mais sobrescrita", () => {
  // 1) sugestão pelas aplicações
  let st = { valor: "", origem: "" };
  let r = aplicarSugestaoTipoVeiculo({ atual: st.valor, origem: st.origem, sugestao: TIPO_CARRO });
  assert.deepEqual([r.valor, r.origem, r.mudou], [TIPO_CARRO, ORIGEM_SUGESTAO, true]);
  st = r;
  // 2) categoria muda a sugestão enquanto não houve escolha manual
  r = aplicarSugestaoTipoVeiculo({ atual: st.valor, origem: st.origem, sugestao: TIPO_PESADA });
  assert.equal(r.valor, TIPO_PESADA); st = r;
  // 3) usuário troca manualmente
  st = escolherTipoVeiculo("Carro/Caminhonete");
  assert.deepEqual(st, { valor: TIPO_CARRO, origem: ORIGEM_MANUAL });
  // 4) novas sugestões (categoria, aplicações, F5) não mexem mais
  for (const s of [TIPO_PESADA, TIPO_CARRO, "", "Linha Pesada"]) {
    r = aplicarSugestaoTipoVeiculo({ atual: st.valor, origem: st.origem, sugestao: s });
    assert.deepEqual([r.valor, r.origem, r.mudou], [TIPO_CARRO, ORIGEM_MANUAL, false]);
  }
  // 5) o usuário pode trocar de novo quando quiser
  st = escolherTipoVeiculo(TIPO_PESADA);
  assert.deepEqual(st, { valor: TIPO_PESADA, origem: ORIGEM_MANUAL });
  // sem sugestão: mantém
  assert.equal(aplicarSugestaoTipoVeiculo({ atual: TIPO_CARRO, origem: ORIGEM_SUGESTAO, sugestao: "" }).mudou, false);
});

test("E) tipo × categoria: confere sem trocar sozinho", () => {
  assert.deepEqual(tipoVeiculoNaCategoria(TIPO_CARRO, CAT.carro).valor, { id: "11377043", nome: "Carro/Caminhonete" });
  assert.equal(tipoVeiculoNaCategoria(TIPO_PESADA, CAT.pesada).estado, "ok");
  const inc = tipoVeiculoNaCategoria(TIPO_PESADA, CAT.carro);
  assert.equal(inc.estado, "incompativel");
  assert.match(inc.texto, /aceita só: Carro\/Caminhonete/);
  assert.equal(tipoVeiculoNaCategoria(TIPO_CARRO, CAT.nautica).estado, "nao_se_aplica");
  assert.equal(tipoVeiculoNaCategoria("", CAT.carro).estado, "sem_tipo");
  assert.equal(tipoVeiculoNaCategoria(TIPO_CARRO, null).estado, "nao_lida");
});

test("F) Publicação envia EXATAMENTE o tipo da ficha (VEHICLE_TYPE da categoria) ou bloqueia", () => {
  const ok = tipoVeiculoParaPublicacao("Carro / Caminhonete", OBRIG("carro"));
  assert.deepEqual(ok.extra, { id: "VEHICLE_TYPE", value_id: "11377043" });
  assert.equal(ok.nome, "Carro/Caminhonete");
  const p = tipoVeiculoParaPublicacao(TIPO_PESADA, OBRIG("pesada"));
  assert.deepEqual(p.extra, { id: "VEHICLE_TYPE", value_id: "13222040" });
  const inc = tipoVeiculoParaPublicacao(TIPO_PESADA, OBRIG("carro"));
  assert.equal(inc.estado, "incompativel"); assert.equal(inc.extra, null, "não troca para o valor da categoria");
  const sem = tipoVeiculoParaPublicacao("", OBRIG("carro"));
  assert.equal(sem.estado, "sem_tipo"); assert.equal(sem.extra, null);
  const na = tipoVeiculoParaPublicacao(TIPO_CARRO, null);
  assert.equal(na.estado, "nao_se_aplica"); assert.equal(na.extra, null);
});

test("G) depois de publicar: confere o VEHICLE_TYPE relido do MLB com o da ficha", () => {
  const base = { conta: "1", sku: "X", preco: 10, quantidade: 1, tipoAnuncio: "classico", fotos: 1 };
  const item = (vt) => ({ id: "MLB1", seller_id: 1, price: 10, available_quantity: 1, listing_type_id: "gold_special", pictures: [{}], attributes: [{ id: "SELLER_SKU", value_name: "X" }, { id: "VEHICLE_TYPE", value_name: vt }] });
  const ok = conferirPublicacao({ itemId: "MLB1", esperado: { ...base, tipoVeiculo: "Carro/Caminhonete" }, item: item("Carro/Caminhonete") });
  assert.equal(ok.itens.find((i) => i.item === "Tipo de veículo").ok, true);
  const errado = conferirPublicacao({ itemId: "MLB1", esperado: { ...base, tipoVeiculo: "Linha Pesada" }, item: item("Carro/Caminhonete") });
  assert.equal(errado.itens.find((i) => i.item === "Tipo de veículo").ok, false);
  assert.ok(errado.pendencias.some((t) => t.startsWith("Tipo de veículo")));
});

test("H) antes de validar/publicar: tipo enviado diferente da ficha gravada = bloqueio", () => {
  const aprovado = { titulo: "Peça", preco: 10, tipoVeiculo: "Carro/Caminhonete" };
  const baseLinha = { dados_conferencia: { ficha: { anuncioConferido: aprovado, assinaturaAprovada: "x" } } };
  assert.equal(conferirFichaPersistida({ tela: aprovado, envio: { tipo_veiculo: "Carro/Caminhonete" }, base: baseLinha }).ok, true);
  const div = conferirFichaPersistida({ tela: aprovado, envio: { tipo_veiculo: "Linha Pesada" }, base: baseLinha });
  assert.equal(div.ok, false); assert.ok(div.divergencias.includes("tipo de veículo"));
  // tela com tipo trocado depois da aprovação também bloqueia
  assert.equal(conferirFichaPersistida({ tela: { ...aprovado, tipoVeiculo: "Linha Pesada" }, envio: null, base: baseLinha }).ok, false);
  // sem tipo enviado (categoria sem o campo): não compara
  assert.equal(conferirFichaPersistida({ tela: aprovado, envio: {}, base: baseLinha }).ok, true);
});

test("I) tela: dropdown sempre editável com as 2 opções; Publicação não deixa escolher outro tipo", () => {
  const mlt = ler("src/components/MercadoLivreTeste.jsx");
  const i = mlt.indexOf("⑤ Características principais");
  const bloco = mlt.slice(i, mlt.indexOf("{/* 6 - EMBALAGEM */}", i));
  const sel = bloco.slice(bloco.indexOf("<select"), bloco.indexOf("</select>"));
  assert.ok(sel.includes("data-paiia-tipo-veiculo"));
  assert.ok(sel.includes("OPCOES_TIPO_VEICULO.map"));
  assert.equal(/disabled/.test(sel), false, "nunca travado");
  assert.ok(sel.includes("escolherTipoVeiculoManual"));
  assert.equal(/Linha Leve/i.test(bloco), false);
  // escolha manual salva na ficha
  const campos = mlt.slice(mlt.indexOf("const camposFicha = {"), mlt.indexOf("};", mlt.indexOf("const camposFicha = {")));
  assert.ok(/tipoVeiculo,\s*\n\s*tipoVeiculoOrigem,/.test(campos));
  // a sugestão passa por aplicarSugestaoTipoVeiculo (respeita "manual")
  assert.ok(mlt.includes("aplicarSugestaoTipoVeiculo({ atual: tipoVeiculo, origem: tipoVeiculoOrigem"));
  assert.equal(mlt.includes("tipoVeiculoParaFicha("), false, "não força mais o valor da categoria");

  const rev = ler("src/components/RevisaoPublicacaoML.jsx");
  assert.ok(rev.includes("tipoVeiculoParaPublicacao(anuncio?.tipoVeiculo, attrTipoVeiculo)"));
  assert.ok(rev.includes('a.id !== "VEHICLE_TYPE"'), "VEHICLE_TYPE não aparece como escolha livre na Publicação");
  assert.ok(rev.includes('id !== "VEHICLE_TYPE" && v'), "extra manual de VEHICLE_TYPE é ignorado");
  assert.ok(rev.includes("tipoVeiculo: tipoVeiculoEnvio"), "verificação pós-publicação usa o tipo enviado (= ficha)");
});
