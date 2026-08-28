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

function arredondar(valor) {
  return Math.round(
    numeroSeguro(valor) * 100
  ) / 100;
}

export function motorConcorrencia({
  precoUsuario = 0,
  precoMedio = 0,
  menorPreco = 0,
  maiorPreco = 0,
  concorrentes = 0,
} = {}) {
  const precoUsuarioFinal =
    numeroSeguro(precoUsuario);

  const precoMedioFinal =
    numeroSeguro(precoMedio);

  const menorPrecoFinal =
    numeroSeguro(menorPreco);

  const maiorPrecoFinal =
    numeroSeguro(maiorPreco);

  const totalConcorrentes =
    numeroSeguro(concorrentes);

  let nivelConcorrencia =
    "sem_dados";

  if (totalConcorrentes > 0) {
    if (totalConcorrentes <= 5) {
      nivelConcorrencia = "baixa";
    } else if (
      totalConcorrentes <= 20
    ) {
      nivelConcorrencia = "media";
    } else {
      nivelConcorrencia = "alta";
    }
  }

  let diferencaMercado = 0;

  if (
    precoUsuarioFinal > 0 &&
    precoMedioFinal > 0
  ) {
    diferencaMercado =
      (
        (
          precoUsuarioFinal -
          precoMedioFinal
        ) /
        precoMedioFinal
      ) *
      100;
  }

  let competitividade = 0;

  if (
    precoUsuarioFinal > 0 &&
    precoMedioFinal > 0
  ) {
    const diferencaAbsoluta =
      Math.abs(
        diferencaMercado
      );

    if (diferencaMercado <= -8) {
      competitividade = 5;
    } else if (
      diferencaAbsoluta <= 5
    ) {
      competitividade = 5;
    } else if (
      diferencaAbsoluta <= 10
    ) {
      competitividade = 4;
    } else if (
      diferencaAbsoluta <= 20
    ) {
      competitividade = 3;
    } else {
      competitividade = 2;
    }
  }

  let oportunidade =
    "aguardando_dados";

  if (
    precoMedioFinal > 0 &&
    precoUsuarioFinal > 0
  ) {
    if (
      precoUsuarioFinal <
        precoMedioFinal * 0.85
    ) {
      oportunidade =
        "aumentar_margem";
    } else if (
      precoUsuarioFinal >
        precoMedioFinal * 1.15
    ) {
      oportunidade =
        "revisar_preco";
    } else {
      oportunidade =
        "preco_competitivo";
    }
  }

  return {
    concorrentes:
      totalConcorrentes,

    nivelConcorrencia,

    mercado: {
      menorPreco:
        arredondar(
          menorPrecoFinal
        ),

      precoMedio:
        arredondar(
          precoMedioFinal
        ),

      maiorPreco:
        arredondar(
          maiorPrecoFinal
        ),
    },

    usuario: {
      preco:
        arredondar(
          precoUsuarioFinal
        ),

      diferencaMercadoPercentual:
        arredondar(
          diferencaMercado
        ),

      competitividade,
    },

    oportunidade,
  };
}

export default motorConcorrencia;