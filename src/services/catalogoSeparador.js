function normalizarCodigo(valor) {
  return String(valor || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .trim();
}

function encontrarCodigosBosch(texto) {
  const encontrados =
    String(texto || "").match(
      /\b(?:0\s?258\s?\d{3}\s?\d{3}|0\s?280\s?\d{3}\s?\d{3}|F\s?\d{3}\s?[A-Z0-9]{3}\s?\d{3})\b/gi
    ) || [];

  return [
    ...new Set(
      encontrados
        .map(normalizarCodigo)
        .filter(
          (codigo) =>
            codigo.length === 10
        )
    ),
  ];
}

function criarRegexCodigo(codigo) {
  const partes =
    codigo.match(
      /^(.)(.{3})(.{3})(.{3})$/
    );

  if (!partes) {
    return null;
  }

  const [
    ,
    grupo1,
    grupo2,
    grupo3,
    grupo4,
  ] = partes;

  return new RegExp(
    `${grupo1}\\s*${grupo2}\\s*${grupo3}\\s*${grupo4}`,
    "gi"
  );
}

export function separarCatalogoPorCodigo(
  texto
) {
  const textoCompleto =
    String(texto || "");

  const codigos =
    encontrarCodigosBosch(
      textoCompleto
    );

  const ocorrencias = [];

  for (const codigo of codigos) {
    const regex =
      criarRegexCodigo(codigo);

    if (!regex) {
      continue;
    }

    let resultado;

    while (
      (resultado =
        regex.exec(
          textoCompleto
        )) !== null
    ) {
      ocorrencias.push({
        codigo,
        inicio:
          resultado.index,
        fimCodigo:
          regex.lastIndex,
      });
    }
  }

  ocorrencias.sort(
    (a, b) =>
      a.inicio - b.inicio
  );

  const blocos = [];

  ocorrencias.forEach(
    (
      ocorrencia,
      indice
    ) => {
      const proxima =
        ocorrencias[
          indice + 1
        ];

      const fim =
        proxima
          ? proxima.inicio
          : textoCompleto.length;

      const conteudo =
        textoCompleto
          .slice(
            ocorrencia.fimCodigo,
            fim
          )
          .replace(
            /[ \t]+/g,
            " "
          )
          .replace(
            /\n{3,}/g,
            "\n\n"
          )
          .trim();

      if (!conteudo) {
        return;
      }

      blocos.push({
        codigo:
          ocorrencia.codigo,

        texto:
          `${ocorrencia.codigo}\n${conteudo}`,
      });
    }
  );

  return blocos;
}

export function dividirBlocosGrandes(
  blocos,
  tamanhoMaximo = 7000
) {
  const resultado = [];

  for (const bloco of blocos) {
    if (
      bloco.texto.length <=
      tamanhoMaximo
    ) {
      resultado.push(
        bloco
      );

      continue;
    }

    const partes = [];

    for (
      let inicio = 0;
      inicio <
      bloco.texto.length;
      inicio +=
      tamanhoMaximo
    ) {
      partes.push(
        bloco.texto.slice(
          inicio,
          inicio +
            tamanhoMaximo
        )
      );
    }

    partes.forEach(
      (
        parte,
        indice
      ) => {
        resultado.push({
          codigo:
            bloco.codigo,

          parte:
            indice + 1,

          totalPartes:
            partes.length,

          texto:
            parte,
        });
      }
    );
  }

  return resultado;
}