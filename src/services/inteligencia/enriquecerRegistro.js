import motorInteligenciaPeca from "./motorInteligenciaPeca";
import identificarFamiliaPorCodigo from "./identificarFamiliaPorCodigo";

function textoValido(valor) {
  const texto = String(
    valor || ""
  ).trim();

  if (!texto) {
    return "";
  }

  const genericos = [
    "peça automotiva",
    "peca automotiva",
    "peças automotivas",
    "pecas automotivas",
    "não identificada",
    "nao identificada",
  ];

  return genericos.includes(
    texto.toLowerCase()
  )
    ? ""
    : texto;
}

export function enriquecerRegistro(
  registro = {}
) {
  const codigo =
    registro.codigo_oem ||
    registro.codigo_equivalente ||
    registro.codigo ||
    "";

  const textoTecnico = [
    registro.peca,
    registro.descricao,
    registro.fabricante,
    registro.montadora,
    registro.modelo,
    registro.motor,
    registro.observacao,
    registro.origem_catalogo,
  ]
    .filter(Boolean)
    .join(" ");

  const inteligencia =
    motorInteligenciaPeca({
      codigo,

      descricao:
        registro.peca ||
        registro.descricao ||
        "",

      texto:
        textoTecnico,
    });

  const familiaCatalogo =
    textoValido(
      registro.familia
    ) ||
    textoValido(
      registro.peca
    );

  const familiaCodigo =
    textoValido(
      identificarFamiliaPorCodigo(
        codigo
      )
    );

  const familiaInteligencia =
    textoValido(
      inteligencia.familia
    );

  const familia =
    familiaCatalogo ||
    familiaCodigo ||
    familiaInteligencia ||
    "Peça Automotiva";

  const peca =
    textoValido(
      registro.peca
    ) ||
    textoValido(
      registro.descricao
    ) ||
    familia;

  return {
    ...registro,

    peca,

    familia,

    familia_catalogo:
      registro.familia_catalogo ||
      familiaCatalogo ||
      familia,

    categoria:
      registro.categoria ||
      inteligencia.categoria,

    sistema:
      registro.sistema ||
      inteligencia.sistema,

    tipo:
      registro.tipo ||
      inteligencia.tipo,

    palavrasChave:
      registro.palavrasChave ||
      inteligencia.palavrasChave,

    confianca_inteligencia:
      inteligencia.confianca,

    inteligencia: {
      ...inteligencia,

      familia,

      descricao:
        peca,

      aplicacoes: [
        {
          montadora:
            registro.montadora || "",

          modelo:
            registro.modelo || "",

          motor:
            registro.motor || "",

          ano_inicio:
            registro.ano_inicio ?? null,

          ano_fim:
            registro.ano_fim ?? null,

          observacao:
            registro.observacao || "",
        },
      ],
    },
  };
}

export default enriquecerRegistro;