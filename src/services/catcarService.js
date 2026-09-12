const CATCAR_API =
  "http://localhost:8787";

function normalizarCodigo(
  valor = ""
) {
  return String(valor || "")
    .trim()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toUpperCase()
    .replace(
      /[^A-Z0-9]/g,
      ""
    );
}

export async function consultarCatCarOEM(
  codigo
) {
  const codigoNormalizado =
    normalizarCodigo(
      codigo
    );

  if (!codigoNormalizado) {
    return {
      encontrado: false,
      codigo_pesquisado: "",
      aplicacoes: [],
      registros: [],
    };
  }

  const url =
    `${CATCAR_API}/catcar/oem?codigo=` +
    encodeURIComponent(
      codigoNormalizado
    );

  try {
    const resposta =
      await fetch(url);

    if (!resposta.ok) {
      throw new Error(
        `Erro CatCar: ${resposta.status}`
      );
    }

    const data =
      await resposta.json();

    return {
      encontrado:
        Boolean(
          data?.encontrado
        ),

      codigo_pesquisado:
        data?.codigo_pesquisado ||
        codigoNormalizado,

      fabricante:
        data?.fabricante ||
        "renault",

      origem:
        data?.origem ||
        "catcar",

      confirmado:
        Boolean(
          data?.confirmado
        ),

      total_registros:
        Number(
          data?.total_registros ||
          0
        ),

      total_aplicacoes_consolidadas:
        Number(
          data
            ?.total_aplicacoes_consolidadas ||
          0
        ),

      oems:
        Array.isArray(
          data?.oems
        )
          ? data.oems
          : [],

      substitutos:
        Array.isArray(
          data?.substitutos
        )
          ? data.substitutos
          : [],

      descricoes:
        Array.isArray(
          data?.descricoes
        )
          ? data.descricoes
          : [],

      aplicacoes:
        Array.isArray(
          data?.aplicacoes
        )
          ? data.aplicacoes
          : [],

      registros:
        Array.isArray(
          data?.registros
        )
          ? data.registros
          : [],
    };
  } catch (erro) {
    console.error(
      "Erro ao consultar CatCar:",
      erro
    );

    return {
      encontrado: false,
      codigo_pesquisado:
        codigoNormalizado,
      aplicacoes: [],
      registros: [],
      erro:
        erro?.message ||
        "Falha ao consultar CatCar.",
    };
  }
}

export async function verificarCatCarOnline() {
  try {
    const resposta =
      await fetch(
        `${CATCAR_API}/catcar/status`
      );

    if (!resposta.ok) {
      return false;
    }

    const data =
      await resposta.json();

    return Boolean(
      data?.online
    );
  } catch {
    return false;
  }
}

export default consultarCatCarOEM;
