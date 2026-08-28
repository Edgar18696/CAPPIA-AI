import { supabase } from "../../supabase";

/*
 * ============================================================
 * PAIIA AI
 * CONSULTA TÉCNICA CATCAR
 * ============================================================
 *
 * FLUXO:
 *
 * código OEM
 *    ↓
 * montadora
 *    ↓
 * Edge Function consultar-catcar
 *    ↓
 * aplicações técnicas
 *    ↓
 * PAIIA
 *
 * IMPORTANTE:
 *
 * O navegador NÃO acessa o CatCar diretamente.
 * A consulta externa será feita pelo backend.
 *
 * Isso evita:
 *
 * - CORS
 * - bloqueios do navegador
 * - exposição da lógica
 * - inconsistência de consulta
 *
 * ============================================================
 */


/*
 * ============================================================
 * NORMALIZAR CÓDIGO
 * ============================================================
 */

export function normalizarCodigoCatcar(
  valor = ""
) {
  return String(
    valor || ""
  )
    .trim()
    .toUpperCase()
    .replace(
      /[^A-Z0-9]/g,
      ""
    );
}


/*
 * ============================================================
 * NORMALIZAR MONTADORA
 * ============================================================
 */

function normalizarMontadora(
  valor = ""
) {
  const chave =
    String(
      valor || ""
    )
      .trim()
      .toLowerCase()
      .replace(
        /[^a-z0-9]/g,
        ""
      );


  const mapa = {
    renault: "renault",

    dacia: "renault",

    nissan: "nissan",

    infiniti: "nissan",

    opel: "opel",

    gm: "opel",

    chevrolet: "opel",

    volkswagen: "volkswagen",

    vw: "volkswagen",

    audi: "audi",

    seat: "seat",

    skoda: "skoda",

    fiat: "fiat",

    alfa: "alfaromeo",

    alfaromeo:
      "alfaromeo",

    ford: "ford",

    peugeot: "peugeot",

    citroen: "citroen",

    citroën: "citroen",

    hyundai: "hyundai",

    kia: "kia",

    toyota: "toyota",

    lexus: "lexus",

    honda: "honda",

    mitsubishi:
      "mitsubishi",

    mazda: "mazda",

    mercedes:
      "mercedes",

    mercedesbenz:
      "mercedes",

    bmw: "bmw",

    mini: "bmw",

    volvo: "volvo",
  };


  return (
    mapa[chave] ||
    chave
  );
}


/*
 * ============================================================
 * REMOVER APLICAÇÕES DUPLICADAS
 * ============================================================
 */

function removerDuplicados(
  registros = []
) {
  const mapa =
    new Map();


  for (
    const registro
    of registros
  ) {
    if (!registro) {
      continue;
    }


    const chave = [
      registro.codigo_oem ||
        "",

      registro.montadora ||
        "",

      registro.modelo ||
        "",

      registro.tipo ||
        "",

      registro.motor ||
        "",

      registro.cambio ||
        "",

      registro.ano_inicio ||
        "",

      registro.ano_fim ||
        "",

      registro.grupo ||
        "",

      registro.subgrupo ||
        "",

      registro.posicao ||
        "",
    ]
      .map(
        (valor) =>
          String(
            valor || ""
          )
            .trim()
            .toUpperCase()
      )
      .join("|");


    if (
      !mapa.has(
        chave
      )
    ) {
      mapa.set(
        chave,
        registro
      );
    }
  }


  return Array.from(
    mapa.values()
  );
}


/*
 * ============================================================
 * VALIDAR RESULTADO
 * ============================================================
 */

function validarResultado(
  registro,
  codigoPesquisa
) {
  const procurado =
    normalizarCodigoCatcar(
      codigoPesquisa
    );


  const codigoRegistro =
    normalizarCodigoCatcar(
      registro?.codigo_oem ||
      registro?.codigo ||
      ""
    );


  if (!procurado) {
    return false;
  }


  /*
   * REGRA PAIIA:
   *
   * resultado CatCar só entra se
   * corresponder exatamente ao OEM.
   */

  return (
    codigoRegistro ===
    procurado
  );
}


/*
 * ============================================================
 * CONSULTA PRINCIPAL
 * ============================================================
 */

export async function consultarCatcar({
  codigoOem,

  montadora,

  onProgresso,
}) {
  const codigo =
    normalizarCodigoCatcar(
      codigoOem
    );


  const catalogo =
    normalizarMontadora(
      montadora
    );


  if (!codigo) {
    return {
      sucesso: false,

      encontrado: false,

      registros: [],

      quantidade: 0,

      mensagem:
        "Código OEM não informado.",
    };
  }


  if (!catalogo) {
    return {
      sucesso: false,

      encontrado: false,

      registros: [],

      quantidade: 0,

      mensagem:
        "Montadora não identificada.",
    };
  }


  try {
    onProgresso?.(
      `🔎 Consultando catálogo ${String(
        montadora || catalogo
      ).toUpperCase()}...`
    );


    console.log(
      "🔎 CATCAR CONSULTA:",
      {
        codigo,
        montadora,
        catalogo,
      }
    );


    /*
     * ========================================================
     * BACKEND
     * ========================================================
     *
     * A Edge Function será responsável por:
     *
     * - consultar o catálogo
     * - localizar TODAS as ocorrências
     * - extrair modelos
     * - extrair versões/tipos
     * - extrair motor
     * - extrair câmbio
     * - extrair anos quando disponíveis
     * - extrair grupo/subgrupo
     * - extrair posição da peça
     * - extrair diagrama
     */

    const {
      data,
      error,
    } =
      await supabase.functions.invoke(
        "consultar-catcar",
        {
          body: {
            codigo,
            montadora:
              catalogo,
          },
        }
      );


    if (error) {
      console.error(
        "❌ Erro consultar-catcar:",
        error
      );


      return {
        sucesso: false,

        encontrado: false,

        registros: [],

        quantidade: 0,

        mensagem:
          "Não foi possível consultar o catálogo técnico.",
      };
    }


    const registrosRecebidos =
      Array.isArray(
        data?.registros
      )
        ? data.registros
        : [];


    /*
     * ========================================================
     * VALIDAÇÃO DE CREDIBILIDADE
     * ========================================================
     */

    const registrosValidos =
      registrosRecebidos.filter(
        (registro) =>
          validarResultado(
            registro,
            codigo
          )
      );


    const registros =
      removerDuplicados(
        registrosValidos
      );


    if (
      registros.length === 0
    ) {
      return {
        sucesso: true,

        encontrado: false,

        codigo_oem:
          codigo,

        montadora:
          catalogo,

        registros: [],

        quantidade: 0,

        mensagem:
          "Código não localizado no catálogo técnico.",
      };
    }


    console.log(
      "✅ CATCAR RESULTADOS CONFIRMADOS:",
      registros.length
    );


    return {
      sucesso: true,

      encontrado: true,

      codigo_oem:
        codigo,

      montadora:
        catalogo,

      quantidade:
        registros.length,

      registros,

      possui_diagrama:
        registros.some(
          (registro) =>
            Boolean(
              registro
                ?.diagrama_url
            )
        ),

      origem:
        "catalogo_oem",
    };
  } catch (
    erro
  ) {
    console.error(
      "❌ Erro na consulta CatCar:",
      erro
    );


    return {
      sucesso: false,

      encontrado: false,

      registros: [],

      quantidade: 0,

      mensagem:
        erro instanceof Error
          ? erro.message
          : "Erro ao consultar catálogo técnico.",
    };
  }
}


export default consultarCatcar;