function normalizarTexto(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function calcularConfianca({
  codigoPesquisado = "",
  registroPrincipal = {},
  registros = [],
  equivalentes = [],
  fabricante = "",
  familia = "",
} = {}) {
  const codigoBusca =
    normalizarTexto(codigoPesquisado);

  const codigoOem =
    normalizarTexto(
      registroPrincipal.codigo_oem ||
        registroPrincipal.codigo ||
        registroPrincipal.oem
    );

  const codigoEquivalente =
    normalizarTexto(
      registroPrincipal.codigo_equivalente ||
        registroPrincipal.equivalente
    );

  let pontos = 0;
  const motivos = [];

  if (
    codigoBusca &&
    codigoOem === codigoBusca
  ) {
    pontos += 45;
    motivos.push(
      "Código OEM encontrado com correspondência exata."
    );
  } else if (
    codigoBusca &&
    codigoEquivalente === codigoBusca
  ) {
    pontos += 40;
    motivos.push(
      "Código equivalente encontrado com correspondência exata."
    );
  } else if (
    codigoBusca &&
    (
      codigoOem.includes(codigoBusca) ||
      codigoEquivalente.includes(
        codigoBusca
      )
    )
  ) {
    pontos += 25;
    motivos.push(
      "Código encontrado com correspondência parcial."
    );
  }

  if (fabricante) {
    pontos += 10;
    motivos.push(
      "Fabricante identificado."
    );
  }

  if (familia) {
    pontos += 10;
    motivos.push(
      "Família da peça identificada."
    );
  }

  if (
    Array.isArray(registros) &&
    registros.length > 0
  ) {
    pontos += 10;
    motivos.push(
      `${registros.length} registro(s) técnico(s) encontrado(s).`
    );
  }

  if (
    Array.isArray(registros) &&
    registros.length >= 5
  ) {
    pontos += 10;
    motivos.push(
      "Existem múltiplas aplicações confirmadas."
    );
  }

  if (
    Array.isArray(equivalentes) &&
    equivalentes.length > 0
  ) {
    pontos += 10;
    motivos.push(
      `${equivalentes.length} código(s) equivalente(s) encontrado(s).`
    );
  }

  if (
    registroPrincipal.origem_catalogo ||
    registroPrincipal.fonte ||
    registroPrincipal.arquivo_catalogo
  ) {
    pontos += 5;
    motivos.push(
      "Fonte técnica identificada."
    );
  }

  const percentual = Math.min(
    pontos,
    100
  );

  let nivel = "Baixa";

  if (percentual >= 90) {
    nivel = "Muito alta";
  } else if (percentual >= 75) {
    nivel = "Alta";
  } else if (percentual >= 50) {
    nivel = "Média";
  }

  return {
    percentual,
    nivel,
    motivos,
  };
}