// Planos e Pagamentos: sem exibição de créditos (a lógica interna de créditos não muda).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const tela = readFileSync(new URL("../../src/components/PlanosPagamentos.jsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");
// Só o que é exibido: textos JSX e propriedades titulo/valor (o código interno não exibido fica de fora).
const exibido = tela.slice(tela.indexOf("\n  return (\n"));

test("1) sem o cartão 'Créditos disponíveis' e sem o saldo", () => {
  assert.doesNotMatch(exibido, /Créditos disponíveis/);
  assert.doesNotMatch(exibido, /carteira\?\.saldo/);
});

test("2) sem a seção 'Comprar créditos adicionais' e sem o botão", () => {
  assert.doesNotMatch(tela, /Comprar créditos adicionais/);
  assert.doesNotMatch(tela, /Os pacotes de créditos ainda serão configurados/);
});

test("3) nenhuma outra menção visível a créditos (o cartão de crédito como forma de pagamento continua)", () => {
  const semCartao = exibido.replace(/Cartão de crédito/g, "");
  assert.doesNotMatch(semCartao, /créditos?\b/i);
  assert.doesNotMatch(tela, /60 créditos de Clip IA/);
});

test("4) preservados: Plano Profissional Ouro, R$ 149,90/mês, dados da conta e renovação", () => {
  assert.ok(tela.includes('nome: "Plano Profissional Ouro"') && tela.includes('preco: "R$ 149,90"') && tela.includes('periodo: "/mês"'));
  assert.ok(exibido.includes('titulo="Conta"') && exibido.includes('titulo="Renovação"'));
  assert.ok(tela.includes('"Clip IA incluído na assinatura"'));
});
