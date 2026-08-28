function numeroSeguro(valor) {
  const numero = Number(
    String(valor ?? "")
      .replace(/\./g, "")
      .replace(",", ".")
      .trim()
  );

  return Number.isFinite(numero)
    ? numero
    : 0;
}

export function especialistaComercial({
  preco = 0,
  custo = 0,
  mercado = null,
} = {}) {
  const precoVenda =
    numeroSeguro(preco);

  const custoProduto =
    numeroSeguro(custo);

  const precoMercado =
    numeroSeguro(
      mercado?.resumo?.precoMedio
    );

  const concorrentes =
    Number(
      mercado?.resumo?.concorrentes ||
      0
    );

  const lucro =
    precoVenda - custoProduto;

  const margem =
    precoVenda > 0
      ? (lucro / precoVenda) * 100
      : 0;

  const diferencaMercado =
    precoMercado > 0
      ? (
          ((precoVenda -
            precoMercado) /
            precoMercado) *
          100
        )
      : 0;

  const alertas = [];

  if (!precoVenda) {
    alertas.push(
      "Preço de venda não informado."
    );
  }

  if (!custoProduto) {
    alertas.push(
      "Custo não informado."
    );
  }

  if (
    precoMercado > 0 &&
    diferencaMercado > 10
  ) {
    alertas.push(
      "Preço acima da média do mercado."
    );
  }

  if (
    precoMercado > 0 &&
    diferencaMercado < -10
  ) {
    alertas.push(
      "Preço abaixo da média do mercado."
    );
  }

  let status =
    "AGUARDANDO";

  if (
    precoVenda &&
    custoProduto
  ) {
    status =
      margem >= 30
        ? "APROVADO"
        : margem >= 15
          ? "REVISAR"
          : "ALERTA";
  }

  let recomendacao =
    "Informe preço e custo.";

  if (status === "APROVADO") {
    recomendacao =
      `Lucro estimado de R$ ${lucro.toFixed(
        2
      )} com margem de ${margem.toFixed(
        1
      )}%.`;
  }

  if (status === "REVISAR") {
    recomendacao =
      "A margem pode melhorar antes da publicação.";
  }

  if (status === "ALERTA") {
    recomendacao =
      "Margem muito baixa para publicação.";
  }

  return {
    especialista:
      "comercial",

    status,

    precoVenda,

    custoProduto,

    lucro,

    margem:
      Number(
        margem.toFixed(1)
      ),

    precoMercado,

    diferencaMercado:
      Number(
        diferencaMercado.toFixed(
          1
        )
      ),

    concorrentes,

    alertas,

    recomendacao,

    resumo: {
      possuiPreco:
        precoVenda > 0,

      possuiCusto:
        custoProduto > 0,

      lucroPositivo:
        lucro > 0,

      margemSaudavel:
        margem >= 30,
    },
  };
}

export default especialistaComercial;