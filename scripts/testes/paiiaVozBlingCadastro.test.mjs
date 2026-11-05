// PAIIA Voz × Bling real (ação existente criar_produto): autorização única, sem duplicar,
// sucesso só com produto + SKU + saldo oficial relidos.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { cadastrarNoBlingVoz, conferirAntesVoz, conferirIncertaVoz, produtoDaFicha } from "../../src/modules/paiiaVoz/servicos/blingCadastroVoz.js";
import { montarCorpoEstoqueInicial } from "./apoio/blingProdutoServidor.mjs";
import { servidorBling } from "./apoio/servidorBlingSimulado.mjs";

const row = (o = {}) => ({ id: "f1", codigo: "8200647826", dados_conferencia: { novo_anuncio: { codigo: "8200647826", titulo: "Sensor Renault", preco: "89,90", medida: { peso_g: 300, comprimento_cm: 20, largura_cm: 10, altura_cm: 8 }, ...o }, paiia_voz: { complemento: { marca: "Torken", quantidadeEstoque: "1" } } } });
const ctx = (r, ops = {}) => ({ row: r, entrada: { codigo: "8200647826", quantidade: "1" }, registro: { ops } });

test("0) servidor: estoque inicial por BALANÇO (repetir não soma) e dados obrigatórios conferidos", () => {
  assert.equal(montarCorpoEstoqueInicial({ produtoId: 1, depositoId: 2, quantidade: 1 }).operacao, "B");
  const { produto, faltando } = produtoDaFicha(row());
  assert.deepEqual(faltando, []);
  assert.deepEqual([produto.codigo, produto.marca, produto.estoque_inicial, produto.pesoBruto_g], ["8200647826", "Torken", 1, 300]);
});

for (const dep of ["padrao", "unico"]) {
  test(`1) depósito ${dep}: cadastra UMA vez, relê e só então diz sucesso (saldo 1)`, async () => {
    const s = servidorBling({ deposito: dep });
    const r = await cadastrarNoBlingVoz(row(), { chamarBling: s.chamar });
    assert.equal(r.ok, true, r.erro);
    assert.equal(r.tipo, "criado");
    assert.match(r.texto, /saldo oficial 1 un/);
    assert.equal(s.st.criacoes, 1);
    assert.deepEqual(s.st.chamadas, ["criar_produto", "saldo_por_sku"], "releitura obrigatória depois de criar");
    // 2º toque: não cadastra de novo (servidor responde ja_existia)
    const r2 = await cadastrarNoBlingVoz(row(), { chamarBling: s.chamar });
    assert.equal(r2.tipo, "ja_existia");
    assert.equal(s.st.criacoes, 1);
  });
}

test("2) sem depósito identificado: produto criado, estoque NÃO confirmado → não segue; depois do lançamento manual, segue sem recriar", async () => {
  const s = servidorBling({ deposito: "nenhum" });
  const r = await cadastrarNoBlingVoz(row(), { chamarBling: s.chamar });
  assert.equal(r.ok, false);
  assert.equal(r.estoquePendente, true);
  assert.match(r.erro, /estoque inicial não foi confirmado.*Lance 1 un\. no Bling/);
  const op = { bling_criar: { estado: "erro", erro: r.erro } };
  const a = await conferirAntesVoz(ctx(row(), op), { chamarBling: s.chamar });
  assert.equal(a.bloqueia, true, "saldo 0 ≠ 1: continua pendente");
  s.st.produtos[0].saldo = 1; // você lançou no Bling
  const b = await conferirAntesVoz(ctx(row(), op), { chamarBling: s.chamar });
  assert.equal(b.feito, true);
  assert.equal(s.st.criacoes, 1, "nada cadastrado outra vez");
});

test("3) resposta incerta: não diz sucesso, bloqueia nova criação até conferir; conferido 'criado' → estoque pendente, sem recriar", async () => {
  const s = servidorBling({ falhaRede: true });
  const r = await cadastrarNoBlingVoz(row(), { chamarBling: s.chamar });
  assert.equal(r.incerto, true);
  const r2 = await cadastrarNoBlingVoz(row(), { chamarBling: s.chamar });
  assert.equal(r2.incerto, true, "o servidor bloqueia enquanto a incerteza não é conferida");
  assert.equal(s.st.criacoes, 1);
  const c = await conferirIncertaVoz("8200647826", { chamarBling: s.chamar });
  assert.equal(c.criado, true);
  const op = { bling_criar: { estado: "incerto", erro: r.erro } };
  assert.equal((await conferirAntesVoz(ctx(row(), op), { chamarBling: s.chamar })).bloqueia, true, "saldo ainda não lançado");
  assert.equal(s.st.criacoes, 1);
});

test("4) SKU já existente: aproveita o cadastro e NÃO altera o estoque (saldo oficial continua 5)", async () => {
  const s = servidorBling({ existe: "8200647826" });
  const r = await cadastrarNoBlingVoz(row(), { chamarBling: s.chamar });
  assert.equal(r.tipo, "ja_existia");
  assert.match(r.texto, /saldo oficial 5 \(não alterado\)/);
  assert.equal(s.st.criacoes + s.st.estoques.length, 0);
  // produto que já existia (nunca tentado pelo PAIIA): não exige saldo = ficha
  assert.equal((await conferirAntesVoz(ctx(row(), {}), { chamarBling: s.chamar })).feito, true);
});

test("5) ficha incompleta: nada é enviado; tela tem UMA autorização (opção A) e o botão Conferir no Bling", async () => {
  const s = servidorBling();
  const r = await cadastrarNoBlingVoz(row({ medida: null }), { chamarBling: s.chamar });
  assert.equal(r.tipo, "faltando");
  assert.equal(s.st.chamadas.length, 0);
  const f = fs.readFileSync(new URL("../../src/modules/paiiaVoz/FinalizarAnuncioVoz.jsx", import.meta.url), "utf8");
  assert.ok(f.includes("estoque inicial de {qtdFicha || \"?\"} un.</b>, e confirmo que conferi que este SKU não existe no Bling escrito com hífen, espaço ou ponto."));
  assert.equal((f.match(/data-pv-autorizo-bling-cadastro/g) || []).length, 1);
  assert.ok(f.includes("data-pv-bling-conferir-incerta"));
  const d = fs.readFileSync(new URL("../../src/modules/paiiaVoz/servicos/finalizarDepsReais.js", import.meta.url), "utf8");
  assert.ok(/async ml_publicar\(\) \{ return \{ ok: false, bloqueado: true, erro: NAO_LIBERADO \}; \}/.test(d), "publicação no ML continua bloqueada nesta tela");
});
