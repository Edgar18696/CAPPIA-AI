export function parserPaginaBosch(texto) {
  const linhas = texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const resultado = [];

  let montadora = "";

  const montadoras = [
    "ALFA ROMEO",
    "ASIA (ASIA MOTORS)",
    "AUDI",
    "BMW",
    "CHERY",
    "CHEVROLET",
    "CHRYSLER",
    "CITROEN",
    "DAEWOO",
    "DODGE",
    "FIAT",
    "FORD",
    "HONDA",
    "HYUNDAI",
    "IVECO",
    "JEEP",
    "KIA",
    "LAND ROVER",
    "MERCEDES",
    "MITSUBISHI",
    "NISSAN",
    "PEUGEOT",
    "PORSCHE",
    "RENAULT",
    "SUBARU",
    "SUZUKI",
    "TOYOTA",
    "VOLKSWAGEN",
    "VOLVO",
  ];

  for (const linha of linhas) {
    const textoLinha = linha.toUpperCase();

    if (
      montadoras.some((m) =>
        textoLinha.startsWith(m)
      )
    ) {
      montadora = linha;
      continue;
    }

    const codigosBosch =
      linha.match(
        /0\s?258\s?\d{3}\s?\d{3}/g
      );

    if (!codigosBosch) continue;

    const codigos = codigosBosch.map((c) =>
      c.replace(/\s/g, "")
    );

    const antesCodigos = linha
      .split(/0\s?258/)
      [0]
      .trim();

    resultado.push({
      montadora,

      descricao: antesCodigos,

      codigo_pre:
        codigos[0] || null,

      codigo_pos:
        codigos[1] || null,

      codigo_universal_pre:
        codigos[2] || null,

      codigo_universal_pos:
        codigos[3] || null,
    });
  }

  return resultado;
}