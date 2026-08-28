function limparCodigo(valor) {
  return String(valor || "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^\dA-Z.-]/g, "")
    .trim();
}

function normalizarCodigoBosch(valor) {
  return String(valor || "")
    .replace(/[^\d]/g, "")
    .trim();
}

export function parserBoschEquivalencias(texto) {
  const linhas = String(texto || "")
    .split(/\r?\n/)
    .map((linha) => linha.trim())
    .filter(Boolean);

  const equivalencias = [];

  let codigoBoschAtual = null;
  let fabricanteAtual = "OEM";

  const fabricantes = [
    "NGK",
    "NTK",
    "DENSO",
    "DELPHI",
    "FIAT",
    "FORD",
    "GM",
    "CHEVROLET",
    "RENAULT",
    "VOLKSWAGEN",
    "VW",
    "MERCEDES-BENZ",
    "MERCEDES",
    "MOPAR",
    "MAGNETI MARELLI",
    "MARELLI",
  ];

  for (const linha of linhas) {
    const linhaMaiuscula = linha.toUpperCase();

    const fabricanteEncontrado = fabricantes.find(
      (fabricante) =>
        linhaMaiuscula === fabricante ||
        linhaMaiuscula.startsWith(`${fabricante} `)
    );

    if (fabricanteEncontrado) {
      fabricanteAtual = fabricanteEncontrado;
    }

    const codigosBosch =
      linha.match(/0\s?258\s?\d{3}\s?\d{3}/g) || [];

    if (codigosBosch.length > 0) {
      codigoBoschAtual = normalizarCodigoBosch(
        codigosBosch[0]
      );

      const restanteLinha = linha.replace(
        /0\s?258\s?\d{3}\s?\d{3}/g,
        " "
      );

      const candidatos = restanteLinha
        .split(/\s{2,}|[;,|]/)
        .map(limparCodigo)
        .filter(
          (codigo) =>
            codigo.length >= 5 &&
            codigo !== codigoBoschAtual
        );

      for (const codigo of candidatos) {
        equivalencias.push({
          codigo_bosch: codigoBoschAtual,
          fabricante: fabricanteAtual,
          codigo_equivalente: codigo,
        });
      }

      continue;
    }

    if (!codigoBoschAtual) {
      continue;
    }

    const candidatos = linha
      .split(/\s{2,}|[;,|]/)
      .map(limparCodigo)
      .filter(
        (codigo) =>
          codigo.length >= 5 &&
          !/^0258\d{6}$/.test(codigo)
      );

    for (const codigo of candidatos) {
      equivalencias.push({
        codigo_bosch: codigoBoschAtual,
        fabricante: fabricanteAtual,
        codigo_equivalente: codigo,
      });
    }
  }

  const unicas = new Map();

  for (const item of equivalencias) {
    const chave = [
      item.codigo_bosch,
      item.fabricante,
      item.codigo_equivalente,
    ].join("|");

    unicas.set(chave, item);
  }

  return Array.from(unicas.values());
}