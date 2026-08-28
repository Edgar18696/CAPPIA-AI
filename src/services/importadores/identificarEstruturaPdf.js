function normalizar(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

const PALAVRAS_APLICACOES = [
  "aplicacoes",
  "aplicação",
  "application",
  "applications",
  "vehicle application",
  "veiculos",
  "veículos",
];

const PALAVRAS_EQUIVALENCIAS = [
  "equivalencias",
  "equivalência",
  "cross reference",
  "interchange",
  "equivalents",
  "oem",
];

const FABRICANTES = [
  "bosch",
  "magneti",
  "marelli",
  "delphi",
  "denso",
  "ngk",
  "ntk",
  "fiat",
  "renault",
  "gm",
  "chevrolet",
  "volkswagen",
  "vw",
  "ford",
  "toyota",
  "honda",
  "nissan",
  "hyundai",
  "kia",
  "mitsubishi",
  "peugeot",
  "citroen",
  "mercedes",
  "bmw",
  "audi",
];

export function identificarEstruturaPdf(
  paginas = []
) {
  const resultado = {
    fabricante: "",

    paginaInicialAplicacoes: null,
    paginaFinalAplicacoes: null,

    paginaInicialEquivalencias: null,
    paginaFinalEquivalencias: null,

    paginasAplicacoes: [],
    paginasEquivalencias: [],

    confianca: 0,
  };

  let fabricante = "";

  for (const pagina of paginas) {
    const numero =
      pagina.numeroPagina;

    const texto = normalizar(
      pagina.texto
    );

    if (!fabricante) {
      const encontrado =
        FABRICANTES.find((nome) =>
          texto.includes(nome)
        );

      if (encontrado) {
        fabricante = encontrado;
      }
    }

    if (
      PALAVRAS_APLICACOES.some(
        (palavra) =>
          texto.includes(palavra)
      )
    ) {
      resultado.paginasAplicacoes.push(
        numero
      );
    }

    if (
      PALAVRAS_EQUIVALENCIAS.some(
        (palavra) =>
          texto.includes(palavra)
      )
    ) {
      resultado.paginasEquivalencias.push(
        numero
      );
    }
  }

  resultado.fabricante =
    fabricante;

  if (
    resultado.paginasAplicacoes.length
  ) {
    resultado.paginaInicialAplicacoes =
      resultado.paginasAplicacoes[0];

    resultado.paginaFinalAplicacoes =
      resultado.paginasAplicacoes.at(-1);
  }

  if (
    resultado.paginasEquivalencias
      .length
  ) {
    resultado.paginaInicialEquivalencias =
      resultado.paginasEquivalencias[0];

    resultado.paginaFinalEquivalencias =
      resultado.paginasEquivalencias.at(-1);
  }

  let pontos = 0;

  if (fabricante) pontos += 30;

  if (
    resultado.paginasAplicacoes
      .length
  )
    pontos += 35;

  if (
    resultado.paginasEquivalencias
      .length
  )
    pontos += 35;

  resultado.confianca =
    Math.min(pontos, 100);

  return resultado;
}