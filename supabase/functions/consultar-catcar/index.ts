import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",

  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",

  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
};

const supabaseUrl =
  Deno.env.get(
    "SUPABASE_URL"
  ) || "";

const serviceRoleKey =
  Deno.env.get(
    "SUPABASE_SERVICE_ROLE_KEY"
  ) || "";

const supabase =
  createClient(
    supabaseUrl,
    serviceRoleKey
  );


/*
 * ============================================================
 * PAIIA AI
 * CONSULTA CATCAR — V4
 * ============================================================
 *
 * ESTA FUNÇÃO SOMENTE CONSULTA.
 *
 * Ela NÃO:
 *
 * - navega no CatCar
 * - baixa páginas
 * - indexa modelos
 * - grava registros
 * - faz varredura online
 *
 * FLUXO:
 *
 * usuário
 *   ↓
 * consultar-catcar
 *   ↓
 * catcar_indice
 *   ↓
 * resposta imediata
 *
 * A indexação será feita por outra Edge Function.
 * ============================================================
 */


/*
 * ============================================================
 * NORMALIZAR CÓDIGO
 * ============================================================
 */

function normalizarCodigo(
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
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )
      .replace(
        /[^a-z0-9]/g,
        ""
      );


  const mapa:
    Record<
      string,
      string
    > = {
      renault:
        "renault",

      dacia:
        "renault",
    };


  return (
    mapa[chave] ||
    chave
  );
}


/*
 * ============================================================
 * RESPOSTA JSON
 * ============================================================
 */

function responderJson(
  dados: unknown,
  status = 200
) {
  return new Response(
    JSON.stringify(
      dados
    ),
    {
      status,

      headers: {
        ...corsHeaders,

        "Content-Type":
          "application/json; charset=utf-8",
      },
    }
  );
}


/*
 * ============================================================
 * CONSULTAR ÍNDICE
 * ============================================================
 */

async function consultarIndice({
  codigo,
  montadora,
}: {
  codigo: string;
  montadora: string;
}) {
  /*
   * Busca EXATA.
   *
   * Nada de ILIKE.
   * Nada de aproximação.
   */

  const {
    data,
    error,
  } =
    await supabase
      .from(
        "catcar_indice"
      )
      .select("*")
      .eq(
        "codigo_oem",
        codigo
      )
      .eq(
        "montadora",
        montadora
      )
      .eq(
        "confirmado",
        true
      )
      .order(
        "modelo",
        {
          ascending:
            true,
          nullsFirst:
            false,
        }
      )
      .limit(
        300
      );


  if (error) {
    console.error(
      "❌ Erro consultando catcar_indice:",
      error
    );

    throw new Error(
      `Erro na base CatCar: ${error.message}`
    );
  }


  return Array.isArray(
    data
  )
    ? data
    : [];
}


/*
 * ============================================================
 * REMOVER DUPLICADOS
 * ============================================================
 */

function removerDuplicados(
  registros: any[]
) {
  const mapa =
    new Map<
      string,
      any
    >();


  for (
    const registro
    of registros
  ) {
    if (!registro) {
      continue;
    }


    const chave = [
      registro
        ?.codigo_oem ||
        "",

      registro
        ?.montadora ||
        "",

      registro
        ?.modelo ||
        "",

      registro
        ?.tipo ||
        "",

      registro
        ?.motor ||
        "",

      registro
        ?.grupo ||
        "",

      registro
        ?.subgrupo ||
        "",

      registro
        ?.posicao ||
        "",

      registro
        ?.pagina_url ||
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
 * VALIDAR REGISTROS
 * ============================================================
 *
 * Mesmo vindo do banco,
 * fazemos uma última trava.
 *
 * O código retornado precisa ser
 * exatamente igual ao pesquisado.
 * ============================================================
 */

function validarRegistros({
  registros,
  codigo,
  montadora,
}: {
  registros: any[];
  codigo: string;
  montadora: string;
}) {
  return registros.filter(
    (registro) => {
      const codigoRegistro =
        normalizarCodigo(
          registro
            ?.codigo_oem ||
          ""
        );


      const montadoraRegistro =
        normalizarMontadora(
          registro
            ?.montadora ||
          ""
        );


      return (
        codigoRegistro ===
          codigo &&
        montadoraRegistro ===
          montadora &&
        registro
          ?.confirmado !==
          false
      );
    }
  );
}


/*
 * ============================================================
 * HANDLER
 * ============================================================
 */

serve(
  async (
    req
  ) => {
    /*
     * ========================================================
     * CORS
     * ========================================================
     */

    if (
      req.method ===
      "OPTIONS"
    ) {
      return new Response(
        "ok",
        {
          headers:
            corsHeaders,
        }
      );
    }


    /*
     * Somente POST.
     */

    if (
      req.method !==
      "POST"
    ) {
      return responderJson(
        {
          sucesso:
            false,

          encontrado:
            false,

          quantidade:
            0,

          registros:
            [],

          mensagem:
            "Método não permitido.",
        },
        405
      );
    }


    try {
      /*
       * ======================================================
       * BODY
       * ======================================================
       */

      let body:
        Record<
          string,
          any
        > = {};


      try {
        body =
          await req.json();
      } catch {
        return responderJson(
          {
            sucesso:
              false,

            encontrado:
              false,

            quantidade:
              0,

            registros:
              [],

            mensagem:
              "Requisição inválida.",
          },
          400
        );
      }


      /*
       * ======================================================
       * CÓDIGO
       * ======================================================
       */

      const codigo =
        normalizarCodigo(
          body
            ?.codigo ||
          body
            ?.codigoOem ||
          body
            ?.codigo_oem ||
          ""
        );


      /*
       * ======================================================
       * MONTADORA
       * ======================================================
       */

      const montadora =
        normalizarMontadora(
          body
            ?.montadora ||
          ""
        );


      console.log(
        "🔎 PAIIA CONSULTA CATCAR:",
        {
          codigo,
          montadora,
        }
      );


      /*
       * ======================================================
       * VALIDAÇÕES
       * ======================================================
       */

      if (!codigo) {
        return responderJson(
          {
            sucesso:
              false,

            encontrado:
              false,

            quantidade:
              0,

            registros:
              [],

            mensagem:
              "Código OEM não informado.",
          },
          400
        );
      }


      if (!montadora) {
        return responderJson(
          {
            sucesso:
              false,

            encontrado:
              false,

            quantidade:
              0,

            registros:
              [],

            mensagem:
              "Montadora não informada.",
          },
          400
        );
      }


      /*
       * ======================================================
       * CATÁLOGOS HABILITADOS
       * ======================================================
       *
       * Por enquanto Renault.
       *
       * Depois adicionamos:
       *
       * Fiat
       * GM
       * Volkswagen
       * Ford
       * Peugeot
       * Citroën
       * etc.
       * ======================================================
       */

      const montadorasHabilitadas =
        new Set([
          "renault",
        ]);


      if (
        !montadorasHabilitadas.has(
          montadora
        )
      ) {
        return responderJson(
          {
            sucesso:
              true,

            encontrado:
              false,

            quantidade:
              0,

            registros:
              [],

            codigo_oem:
              codigo,

            montadora,

            origem:
              null,

            indice_consultado:
              true,

            mensagem:
              "Catálogo OEM ainda não habilitado para esta montadora.",
          }
        );
      }


      /*
       * ======================================================
       * CONSULTA LOCAL
       * ======================================================
       */

      const inicio =
        Date.now();


      const registrosBanco =
        await consultarIndice({
          codigo,
          montadora,
        });


      const registrosValidos =
        validarRegistros({
          registros:
            registrosBanco,

          codigo,

          montadora,
        });


      const registros =
        removerDuplicados(
          registrosValidos
        );


      const tempoMs =
        Date.now() -
        inicio;


      /*
       * ======================================================
       * ENCONTRADO
       * ======================================================
       */

      if (
        registros.length >
        0
      ) {
        console.log(
          "✅ CATCAR ÍNDICE:",
          {
            codigo,

            quantidade:
              registros.length,

            tempo_ms:
              tempoMs,
          }
        );


        return responderJson(
          {
            sucesso:
              true,

            encontrado:
              true,

            codigo_oem:
              codigo,

            montadora,

            quantidade:
              registros.length,

            registros,

            origem:
              "catcar_indice",

            indice_consultado:
              true,

            tempo_ms:
              tempoMs,

            mensagem:
              `${registros.length} ocorrência(s) encontrada(s) no catálogo OEM.`,
          }
        );
      }


      /*
       * ======================================================
       * NÃO ENCONTRADO
       * ======================================================
       *
       * MUITO IMPORTANTE:
       *
       * NÃO iniciamos indexação aqui.
       *
       * A consulta termina imediatamente.
       * ======================================================
       */

      console.log(
        "⚠️ CATCAR ÍNDICE SEM RESULTADO:",
        {
          codigo,

          montadora,

          tempo_ms:
            tempoMs,
        }
      );


      return responderJson(
        {
          sucesso:
            true,

          encontrado:
            false,

          codigo_oem:
            codigo,

          montadora,

          quantidade:
            0,

          registros:
            [],

          origem:
            null,

          indice_consultado:
            true,

          tempo_ms:
            tempoMs,

          mensagem:
            "Código ainda não localizado no índice do catálogo OEM.",
        }
      );
    } catch (
      erro
    ) {
      console.error(
        "❌ consultar-catcar:",
        erro
      );


      return responderJson(
        {
          sucesso:
            false,

          encontrado:
            false,

          quantidade:
            0,

          registros:
            [],

          mensagem:
            erro instanceof Error
              ? erro.message
              : "Erro na consulta técnica.",
        },
        500
      );
    }
  }
);