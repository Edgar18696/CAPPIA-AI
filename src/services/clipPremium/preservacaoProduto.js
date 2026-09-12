export const REGRAS_PRESERVACAO_PRODUTO = [
  "Preservar fielmente o produto original da imagem enviada.",
  "Manter formato, proporções, cores e acabamento reais.",
  "Preservar conectores, pinos, furos, encaixes e quantidade de componentes.",
  "Preservar marca, gravações e textos existentes no produto.",
  "Não duplicar o produto e não inventar outra peça.",
  "Manter o produto inteiro no enquadramento do primeiro ao último frame.",
  "Evitar zoom que corte a peça.",
  "Evitar que o produto saia do quadro.",
  "Fundo e movimento não podem comprometer a leitura do produto.",
  "Não adicionar mãos, pessoas, ferramentas, veículos ou objetos extras.",
];

export function textoPreservacaoProduto() {
  return REGRAS_PRESERVACAO_PRODUTO.join(" ");
}
