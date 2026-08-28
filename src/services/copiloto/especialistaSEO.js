function textoSeguro(valor) {
  return String(valor ?? "").trim();
}

export function especialistaSEO({
  titulo = "",
  descricao = "",
  codigo = "",
  oem = "",
} = {}) {
  const tituloFinal =
    textoSeguro(titulo);

  const descricaoFinal =
    textoSeguro(descricao);

  const codigoFinal =
    textoSeguro(codigo || oem);

  const alertas = [];

  let pontos = 100;

  const possuiCodigo =
    codigoFinal &&
    tituloFinal
      .toUpperCase()
      .includes(
        codigoFinal.toUpperCase()
      );

  if (!tituloFinal) {
    alertas.push(
      "Título não informado."
    );
    pontos -= 40;
  }

  if (
    tituloFinal &&
    tituloFinal.length < 45
  ) {
    alertas.push(
      "Título pode aproveitar melhor os 60 caracteres."
    );
    pontos -= 10;
  }

  if (
    tituloFinal.length > 60
  ) {
    alertas.push(
      "Título acima do limite recomendado."
    );
    pontos -= 10;
  }

  if (
    codigoFinal &&
    !possuiCodigo
  ) {
    alertas.push(
      "Inclua o código da peça no título."
    );
    pontos -= 10;
  }

  if (!descricaoFinal) {
    alertas.push(
      "Descrição não preenchida."
    );
    pontos -= 30;
  }

  if (
    descricaoFinal.length < 300
  ) {
    alertas.push(
      "Descrição muito curta."
    );
    pontos -= 10;
  }

  pontos = Math.max(
    0,
    Math.min(100, pontos)
  );

  let status = "APROVADO";

  if (pontos < 80) {
    status = "REVISAR";
  }

  if (pontos < 60) {
    status = "ALERTA";
  }

  let estrelas = "★★★★★";

  if (pontos < 90)
    estrelas = "★★★★☆";

  if (pontos < 75)
    estrelas = "★★★☆☆";

  if (pontos < 60)
    estrelas = "★★☆☆☆";

  if (pontos < 40)
    estrelas = "★☆☆☆☆";

  return {
    especialista: "seo",

    status,

    pontos,

    estrelas,

    titulo: tituloFinal,

    descricao:
      descricaoFinal,

    caracteresTitulo:
      tituloFinal.length,

    caracteresDescricao:
      descricaoFinal.length,

    possuiCodigo,

    alertas,

    recomendacao:
      status ===
      "APROVADO"
        ? "SEO em excelente condição para publicação."
        : status ===
          "REVISAR"
        ? "O SEO pode melhorar antes da publicação."
        : "O anúncio precisa de melhorias para ganhar relevância.",

    resumo: {
      tituloOk:
        tituloFinal.length >=
        45,

      descricaoOk:
        descricaoFinal.length >=
        300,

      codigoNoTitulo:
        possuiCodigo,

      pontuacao:
        pontos,
    },
  };
}

export default especialistaSEO;