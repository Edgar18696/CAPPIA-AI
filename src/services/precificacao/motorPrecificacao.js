function numeroSeguro(valor) {
  const texto = String(valor ?? "")
    .replace(/[^\d,.-]/g, "")
    .trim();

  if (!texto) {
    return 0;
  }

  const normalizado =
    texto.includes(",")
      ? texto
          .replace(/\./g, "")
          .replace(",", ".")
      : texto;

  const numero = Number(normalizado);

  return Number.isFinite(numero)
    ? numero
    : 0;
}

function arredondarPreco(valor) {
  if (!Number.isFinite(valor)) {
    return 0;
  }

  return Math.round(valor * 100) / 100;
}

function calcularPercentual(
  valor,
  percentual
) {
  return (
    numeroSeguro(valor) *
    (numeroSeguro(percentual) / 100)
  );
}

export function motorPrecificacao({
  custoProduto = 0,
  frete = 0,
  embalagem = 0,
  outrosCustos = 0,

  comissaoPercentual = 0,
  impostoPercentual = 0,

  margemDesejadaPercentual = 35,

  taxaFixa = 0,
} = {}) {
  const custoProdutoFinal =
    numeroSeguro(custoProduto);

  const freteFinal =
    numeroSeguro(frete);

  const embalagemFinal =
    numeroSeguro(embalagem);

  const outrosCustosFinal =
    numeroSeguro(outrosCustos);

  const taxaFixaFinal =
    numeroSeguro(taxaFixa);

  const comissaoFinal =
    numeroSeguro(comissaoPercentual);

  const impostoFinal =
    numeroSeguro(impostoPercentual);

  const margemDesejadaFinal =
    numeroSeguro(
      margemDesejadaPercentual
    );

  const custoOperacional =
    custoProdutoFinal +
    freteFinal +
    embalagemFinal +
    outrosCustosFinal +
    taxaFixaFinal;

  const percentualDescontos =
    comissaoFinal +
    impostoFinal;

  const percentualDisponivel =
    100 -
    percentualDescontos -
    margemDesejadaFinal;

  let precoMinimo = 0;
  let precoRecomendado = 0;

  if (
    custoOperacional > 0 &&
    100 - percentualDescontos > 0
  ) {
    precoMinimo =
      custoOperacional /
      (
        1 -
        percentualDescontos / 100
      );
  }

  if (
    custoOperacional > 0 &&
    percentualDisponivel > 0
  ) {
    precoRecomendado =
      custoOperacional /
      (
        percentualDisponivel /
        100
      );
  }

  const comissaoEstimada =
    calcularPercentual(
      precoRecomendado,
      comissaoFinal
    );

  const impostoEstimado =
    calcularPercentual(
      precoRecomendado,
      impostoFinal
    );

  const lucroEstimado =
    precoRecomendado -
    custoOperacional -
    comissaoEstimada -
    impostoEstimado;

  const margemRealPercentual =
    precoRecomendado > 0
      ? (
          lucroEstimado /
          precoRecomendado
        ) * 100
      : 0;

  const valido =
    custoOperacional > 0 &&
    percentualDisponivel > 0;

  const problemas = [];

  if (custoProdutoFinal <= 0) {
    problemas.push(
      "Informe o custo do produto."
    );
  }

  if (
    percentualDescontos >= 100
  ) {
    problemas.push(
      "A soma de comissão e impostos é inválida."
    );
  }

  if (
    percentualDisponivel <= 0
  ) {
    problemas.push(
      "A margem desejada é incompatível com as taxas informadas."
    );
  }

  return {
    valido,

    problemas,

    custos: {
      produto:
        arredondarPreco(
          custoProdutoFinal
        ),

      frete:
        arredondarPreco(
          freteFinal
        ),

      embalagem:
        arredondarPreco(
          embalagemFinal
        ),

      outros:
        arredondarPreco(
          outrosCustosFinal
        ),

      taxaFixa:
        arredondarPreco(
          taxaFixaFinal
        ),

      total:
        arredondarPreco(
          custoOperacional
        ),
    },

    taxas: {
      comissaoPercentual:
        comissaoFinal,

      impostoPercentual:
        impostoFinal,

      margemDesejadaPercentual:
        margemDesejadaFinal,

      percentualDescontos,

      comissaoEstimada:
        arredondarPreco(
          comissaoEstimada
        ),

      impostoEstimado:
        arredondarPreco(
          impostoEstimado
        ),
    },

    resultado: {
      precoMinimo:
        arredondarPreco(
          precoMinimo
        ),

      precoRecomendado:
        arredondarPreco(
          precoRecomendado
        ),

      lucroEstimado:
        arredondarPreco(
          lucroEstimado
        ),

      margemRealPercentual:
        arredondarPreco(
          margemRealPercentual
        ),
    },
  };
}

export default motorPrecificacao;