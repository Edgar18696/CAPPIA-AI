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
  Deno.env.get("SUPABASE_URL") || "";

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
 * INDEXADOR CATCAR — V4
 * ============================================================
 *
 * DOIS MODOS:
 *
 * 1. INDEXAÇÃO NORMAL
 *
 * Renault
 *   ↓
 * vários modelos
 *   ↓
 * rodízio entre modelos
 *   ↓
 * catcar_indice
 *
 *
 * 2. BUSCA DIRECIONADA
 *
 * codigoAlvo
 *   ↓
 * percorre Renault
 *   ↓
 * procura OEM exato
 *   ↓
 * encontrou
 *   ↓
 * salva aplicação
 *   ↓
 * encerra
 *
 * ============================================================
 */


/*
 * ============================================================
 * NORMALIZAÇÃO
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


function normalizarTexto(
  valor = ""
) {
  return String(
    valor || ""
  )
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}


/*
 * ============================================================
 * HTML
 * ============================================================
 */

function limparHtml(
  valor = ""
) {
  return String(
    valor || ""
  )
    .replace(
      /<script[\s\S]*?<\/script>/gi,
      " "
    )
    .replace(
      /<style[\s\S]*?<\/style>/gi,
      " "
    )
    .replace(
      /<[^>]+>/g,
      " "
    )
    .replace(
      /&nbsp;/gi,
      " "
    )
    .replace(
      /&amp;/gi,
      "&"
    )
    .replace(
      /&quot;/gi,
      '"'
    )
    .replace(
      /&#39;/gi,
      "'"
    )
    .replace(
      /&lt;/gi,
      "<"
    )
    .replace(
      /&gt;/gi,
      ">"
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}


function decodificarHtml(
  valor = ""
) {
  return String(
    valor || ""
  )
    .replace(
      /&amp;/gi,
      "&"
    )
    .replace(
      /&#38;/gi,
      "&"
    )
    .replace(
      /&quot;/gi,
      '"'
    )
    .replace(
      /&#39;/gi,
      "'"
    )
    .replace(
      /&lt;/gi,
      "<"
    )
    .replace(
      /&gt;/gi,
      ">"
    );
}


/*
 * ============================================================
 * URL CATCAR
 * ============================================================
 */

function normalizarUrl(
  href = ""
) {
  let url =
    decodificarHtml(
      href
    ).trim();

  if (!url) {
    return null;
  }

  if (
    url.startsWith("//")
  ) {
    url =
      `https:${url}`;
  } else if (
    url.startsWith("/")
  ) {
    url =
      `https://www.catcar.info${url}`;
  } else if (
    url.startsWith("?")
  ) {
    url =
      `https://www.catcar.info/renault/${url}`;
  }

  if (
    !url.startsWith(
      "https://www.catcar.info/renault/"
    ) &&
    !url.startsWith(
      "http://www.catcar.info/renault/"
    )
  ) {
    return null;
  }

  return url.replace(
    /^http:\/\//i,
    "https://"
  );
}


/*
 * ============================================================
 * DECODIFICAR PARÂMETRO l
 * ============================================================
 */

function decodificarParametroL(
  url = ""
) {
  try {
    const objetoUrl =
      new URL(
        url
      );

    const parametro =
      objetoUrl.searchParams.get(
        "l"
      );

    if (!parametro) {
      return "";
    }

    let valor =
      decodeURIComponent(
        parametro
      )
        .replace(
          /-/g,
          "+"
        )
        .replace(
          /_/g,
          "/"
        );

    while (
      valor.length % 4 !== 0
    ) {
      valor += "=";
    }

    try {
      return atob(
        valor
      );
    } catch {
      return "";
    }
  } catch {
    return "";
  }
}


/*
 * ============================================================
 * NÍVEL CATCAR
 * ============================================================
 *
 * Aproximadamente:
 *
 * 20 = modelo
 * 30 = versão
 * 40 = grupo
 * 50 = página técnica
 * ============================================================
 */

function obterNivelCatcar(
  url = ""
) {
  const interno =
    decodificarParametroL(
      url
    );

  const match =
    interno.match(
      /st==(\d+)/i
    );

  if (!match) {
    return 0;
  }

  return (
    Number(
      match[1]
    ) || 0
  );
}


/*
 * ============================================================
 * PRIORIDADE
 * ============================================================
 */

function calcularPrioridade(
  url = "",
  texto = ""
) {
  const nivel =
    obterNivelCatcar(
      url
    );

  let pontos =
    nivel * 2;

  const interno =
    decodificarParametroL(
      url
    );

  const conteudo =
    normalizarTexto(
      `${interno} ${texto}`
    );

  const palavrasTecnicas = [
    "injection",
    "fuel",
    "engine",
    "electrical",
    "electric",
    "sensor",
    "exhaust",
    "ignition",
    "emission",
    "pollution",
    "cooling",
    "air conditioning",
    "brake",
    "steering",
    "gearbox",
    "transmission",
  ];

  for (
    const palavra
    of palavrasTecnicas
  ) {
    if (
      conteudo.includes(
        palavra
      )
    ) {
      pontos += 5;
    }
  }

  return pontos;
}


/*
 * ============================================================
 * FETCH
 * ============================================================
 */

async function buscarPagina(
  url: string
) {
  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () =>
        controller.abort(),
      8000
    );

  try {
    const resposta =
      await fetch(
        url,
        {
          method: "GET",

          signal:
            controller.signal,

          headers: {
            "User-Agent":
              "Mozilla/5.0 PAIIA-AI/4.0",

            Accept:
              "text/html,application/xhtml+xml",

            "Accept-Language":
              "en-US,en;q=0.9",
          },
        }
      );

    if (
      !resposta.ok
    ) {
      throw new Error(
        `HTTP ${resposta.status}`
      );
    }

    return await resposta.text();
  } finally {
    clearTimeout(
      timer
    );
  }
}


/*
 * ============================================================
 * LINKS
 * ============================================================
 */

type LinkCatcar = {
  url: string;
  texto: string;
  nivel: number;
  prioridade: number;
};


function extrairLinks(
  html: string
) {
  const mapa =
    new Map<
      string,
      LinkCatcar
    >();

  const regex =
    /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  for (
    const match
    of html.matchAll(
      regex
    )
  ) {
    const url =
      normalizarUrl(
        match[1] || ""
      );

    if (!url) {
      continue;
    }

    const texto =
      limparHtml(
        match[2] || ""
      );

    const nivel =
      obterNivelCatcar(
        url
      );

    const prioridade =
      calcularPrioridade(
        url,
        texto
      );

    mapa.set(
      url,
      {
        url,
        texto,
        nivel,
        prioridade,
      }
    );
  }

  return Array.from(
    mapa.values()
  );
}


/*
 * ============================================================
 * MODELOS PRIORITÁRIOS
 * ============================================================
 */

const MODELOS_PRIORITARIOS = [
  "clio ii",
  "clio iii",
  "clio iv",
  "kangoo",
  "kangoo ii",
  "logan",
  "sandero",
  "duster",
  "megane",
  "megane ii",
  "megane iii",
  "scenic",
  "scenic ii",
  "master",
  "master ii",
  "master iii",
  "fluence",
  "captur",
  "kwid",
  "trafic",
];


function pontuarModelo(
  texto = ""
) {
  const normalizado =
    normalizarTexto(
      texto
    );

  for (
    let i = 0;
    i <
    MODELOS_PRIORITARIOS.length;
    i++
  ) {
    const modelo =
      MODELOS_PRIORITARIOS[
        i
      ];

    if (
      normalizado.includes(
        normalizarTexto(
          modelo
        )
      )
    ) {
      return (
        MODELOS_PRIORITARIOS.length -
        i
      );
    }
  }

  return 0;
}


/*
 * ============================================================
 * PEGAR TODOS OS MODELOS
 * ============================================================
 */

function obterLinksModelos(
  links: LinkCatcar[]
) {
  const modelos =
    links
      .filter(
        (link) =>
          link.nivel === 20
      )
      .map(
        (link) => ({
          ...link,

          prioridadeModelo:
            pontuarModelo(
              link.texto
            ),
        })
      )
      .sort(
        (a, b) => {
          if (
            b.prioridadeModelo !==
            a.prioridadeModelo
          ) {
            return (
              b.prioridadeModelo -
              a.prioridadeModelo
            );
          }

          return a.texto.localeCompare(
            b.texto
          );
        }
      );

  const mapa =
    new Map<
      string,
      typeof modelos[number]
    >();

  for (
    const modelo
    of modelos
  ) {
    const chave =
      normalizarTexto(
        modelo.texto
      );

    if (!chave) {
      continue;
    }

    if (
      !mapa.has(
        chave
      )
    ) {
      mapa.set(
        chave,
        modelo
      );
    }
  }

  return Array.from(
    mapa.values()
  );
}


/*
 * ============================================================
 * SELECIONAR MODELOS POR OFFSET
 * ============================================================
 */

function selecionarLinksModelos({
  links,
  maxModelos,
  offsetModelos,
}: {
  links: LinkCatcar[];
  maxModelos: number;
  offsetModelos: number;
}) {
  return obterLinksModelos(
    links
  ).slice(
    offsetModelos,
    offsetModelos +
      maxModelos
  );
}


/*
 * ============================================================
 * TÍTULO / CONTEXTO
 * ============================================================
 */

function extrairTitulo(
  html: string
) {
  const match =
    html.match(
      /<title[^>]*>([\s\S]*?)<\/title>/i
    );

  return match
    ? limparHtml(
        match[1]
      )
    : "";
}


function interpretarTitulo(
  titulo = ""
) {
  const limpo =
    String(
      titulo || ""
    )
      .replace(
        /\s*-\s*Catcar\.info.*$/i,
        ""
      )
      .trim();

  const partes =
    limpo
      .split(",")
      .map(
        (item) =>
          item.trim()
      )
      .filter(Boolean);

  return {
    modelo:
      partes[0] ||
      null,

    tipo:
      partes[1] ||
      null,

    grupo:
      partes[2] ||
      null,

    subgrupo:
      partes
        .slice(3)
        .join(", ") ||
      null,
  };
}


/*
 * ============================================================
 * CÉLULAS
 * ============================================================
 */

function extrairCelulas(
  linha = ""
) {
  return Array.from(
    linha.matchAll(
      /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi
    )
  )
    .map(
      (match) =>
        limparHtml(
          match[1] ||
          ""
        )
    )
    .filter(Boolean);
}


/*
 * ============================================================
 * POSSÍVEL OEM
 * ============================================================
 */

function pareceCodigoOem(
  valor = ""
) {
  const codigo =
    normalizarCodigo(
      valor
    );

  if (
    !codigo ||
    codigo.length < 5 ||
    codigo.length > 24
  ) {
    return false;
  }

  const bloqueados =
    new Set([
      "CODE",
      "PARTNUMBER",
      "PARTNO",
      "NUMBER",
      "DESCRIPTION",
      "DESIGNATION",
      "REPLACEMENT",
      "NOTE",
      "NOTES",
      "POSITION",
      "QUANTITY",
    ]);

  if (
    bloqueados.has(
      codigo
    )
  ) {
    return false;
  }

  if (
    !/\d/.test(
      codigo
    )
  ) {
    return false;
  }

  return true;
}


/*
 * ============================================================
 * EXTRAIR PEÇAS
 * ============================================================
 */

function extrairPecas(
  html: string,
  paginaUrl: string
) {
  const registros:
    any[] = [];

  const contexto =
    interpretarTitulo(
      extrairTitulo(
        html
      )
    );

  const linhas =
    html.match(
      /<tr[\s\S]*?<\/tr>/gi
    ) || [];

  for (
    const linha
    of linhas
  ) {
    const celulas =
      extrairCelulas(
        linha
      );

    if (
      celulas.length < 2
    ) {
      continue;
    }

    let indiceCodigo =
      -1;

    if (
      pareceCodigoOem(
        celulas[1]
      )
    ) {
      indiceCodigo =
        1;
    } else {
      for (
        let i = 1;
        i <
        Math.min(
          celulas.length,
          4
        );
        i++
      ) {
        if (
          pareceCodigoOem(
            celulas[i]
          )
        ) {
          indiceCodigo =
            i;

          break;
        }
      }
    }

    if (
      indiceCodigo < 0
    ) {
      continue;
    }

    const codigo =
      normalizarCodigo(
        celulas[
          indiceCodigo
        ]
      );

    if (!codigo) {
      continue;
    }

    const posicao =
      indiceCodigo > 0
        ? celulas[0] ||
          null
        : null;

    const depoisCodigo =
      celulas.slice(
        indiceCodigo + 1
      );

    const codigoSubstituto =
      depoisCodigo[0] ||
      null;

    const descricaoOriginal =
      depoisCodigo[1] ||
      depoisCodigo[0] ||
      null;

    const observacao =
      depoisCodigo.length >
      2
        ? depoisCodigo
            .slice(2)
            .join(" | ")
        : null;

    registros.push({
      codigo_oem:
        codigo,

      montadora:
        "renault",

      modelo:
        contexto.modelo,

      tipo:
        contexto.tipo,

      motor:
        null,

      cambio:
        null,

      ano_inicio:
        null,

      ano_fim:
        null,

      grupo:
        contexto.grupo,

      subgrupo:
        contexto.subgrupo,

      posicao,

      codigo_substituto:
        codigoSubstituto,

      descricao_original:
        descricaoOriginal,

      observacao,

      pagina_url:
        paginaUrl,

      diagrama_url:
        null,

      origem:
        "catcar",

      confirmado:
        true,
    });
  }

  return registros;
}


/*
 * ============================================================
 * CHAVE ÚNICA
 * ============================================================
 */

function gerarChaveUnica(
  registro: any
) {
  return [
    registro.codigo_oem,
    registro.montadora,
    registro.modelo,
    registro.tipo,
    registro.grupo,
    registro.subgrupo,
    registro.posicao,
    registro.pagina_url,
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
}


/*
 * ============================================================
 * SALVAR ÍNDICE
 * ============================================================
 */

async function salvarIndice(
  registros: any[]
) {
  if (
    registros.length === 0
  ) {
    return 0;
  }

  const mapa =
    new Map<
      string,
      any
    >();

  for (
    const registro
    of registros
  ) {
    const chaveUnica =
      gerarChaveUnica(
        registro
      );

    if (!chaveUnica) {
      continue;
    }

    if (
      !mapa.has(
        chaveUnica
      )
    ) {
      mapa.set(
        chaveUnica,
        {
          ...registro,

          chave_unica:
            chaveUnica,

          atualizado_em:
            new Date()
              .toISOString(),
        }
      );
    }
  }

  const dados =
    Array.from(
      mapa.values()
    );

  if (
    dados.length === 0
  ) {
    return 0;
  }

  const tamanhoLote =
    100;

  let total =
    0;

  for (
    let inicio = 0;
    inicio <
    dados.length;
    inicio +=
      tamanhoLote
  ) {
    const lote =
      dados.slice(
        inicio,
        inicio +
          tamanhoLote
      );

    const {
      error,
    } =
      await supabase
        .from(
          "catcar_indice"
        )
        .upsert(
          lote,
          {
            onConflict:
              "chave_unica",

            ignoreDuplicates:
              true,
          }
        );

    if (error) {
      console.error(
        "❌ Erro salvando lote:",
        error
      );

      continue;
    }

    total +=
      lote.length;
  }

  return total;
}


/*
 * ============================================================
 * CONSULTAR SE OEM JÁ ESTÁ INDEXADO
 * ============================================================
 */

async function consultarCodigoNoIndice(
  codigo: string
) {
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
        "renault"
      )
      .eq(
        "confirmado",
        true
      )
      .limit(
        300
      );

  if (error) {
    console.warn(
      "⚠️ Erro consultando índice:",
      error
    );

    return [];
  }

  return Array.isArray(
    data
  )
    ? data
    : [];
}


/*
 * ============================================================
 * FILA
 * ============================================================
 */

type ItemFila = {
  url: string;
  texto: string;
  nivel: number;
  prioridade: number;
};


type RamoModelo = {
  nome: string;

  fila:
    ItemFila[];

  visitadas:
    Set<string>;

  agendadas:
    Set<string>;

  paginas:
    number;

  paginasComPecas:
    number;

  registrosExtraidos:
    number;

  registrosSalvos:
    number;
};


/*
 * ============================================================
 * FILHOS DO RAMO
 * ============================================================
 */

function adicionarFilhos({
  ramo,
  links,
  nivelAtual,
}: {
  ramo: RamoModelo;
  links: LinkCatcar[];
  nivelAtual: number;
}) {
  for (
    const link
    of links
  ) {
    if (
      link.nivel <=
      nivelAtual
    ) {
      continue;
    }

    if (
      link.nivel >
      50
    ) {
      continue;
    }

    if (
      ramo.visitadas.has(
        link.url
      ) ||
      ramo.agendadas.has(
        link.url
      )
    ) {
      continue;
    }

    ramo.fila.push({
      url:
        link.url,

      texto:
        link.texto,

      nivel:
        link.nivel,

      prioridade:
        link.prioridade,
    });

    ramo.agendadas.add(
      link.url
    );
  }

  ramo.fila.sort(
    (a, b) =>
      b.prioridade -
      a.prioridade
  );
}


/*
 * ============================================================
 * PROCESSAR UMA PÁGINA NORMAL
 * ============================================================
 */

async function processarUmaPagina(
  ramo: RamoModelo
) {
  const item =
    ramo.fila.shift();

  if (!item) {
    return {
      processou:
        false,
    };
  }

  if (
    ramo.visitadas.has(
      item.url
    )
  ) {
    return {
      processou:
        false,
    };
  }

  ramo.visitadas.add(
    item.url
  );

  ramo.paginas +=
    1;

  let html =
    "";

  try {
    html =
      await buscarPagina(
        item.url
      );
  } catch (
    erro
  ) {
    console.warn(
      "⚠️ Falha CatCar:",
      item.url,
      erro
    );

    return {
      processou:
        true,

      erro:
        true,
    };
  }

  const pecas =
    extrairPecas(
      html,
      item.url
    );

  let salvos =
    0;

  if (
    pecas.length > 0
  ) {
    ramo.paginasComPecas +=
      1;

    ramo.registrosExtraidos +=
      pecas.length;

    salvos =
      await salvarIndice(
        pecas
      );

    ramo.registrosSalvos +=
      salvos;
  }

  if (
    item.nivel < 50
  ) {
    const links =
      extrairLinks(
        html
      );

    adicionarFilhos({
      ramo,
      links,
      nivelAtual:
        item.nivel,
    });
  }

  return {
    processou:
      true,

    nivel:
      item.nivel,

    pecas:
      pecas.length,

    salvos,
  };
}


/*
 * ============================================================
 * PROCESSAR UMA PÁGINA PROCURANDO OEM
 * ============================================================
 */

async function processarPaginaComAlvo({
  ramo,
  codigoAlvo,
}: {
  ramo: RamoModelo;
  codigoAlvo: string;
}) {
  const item =
    ramo.fila.shift();

  if (!item) {
    return {
      processou:
        false,

      encontrados:
        [],
    };
  }

  if (
    ramo.visitadas.has(
      item.url
    )
  ) {
    return {
      processou:
        false,

      encontrados:
        [],
    };
  }

  ramo.visitadas.add(
    item.url
  );

  ramo.paginas +=
    1;

  let html =
    "";

  try {
    html =
      await buscarPagina(
        item.url
      );
 } catch (
  erro
) {
  console.warn(
    "⚠️ Busca OEM — falha:",
    {
      modelo:
        ramo.nome,

      url:
        item.url,

      erro:
        erro instanceof Error
          ? erro.message
          : String(erro),
    }
  );

  return {
    processou:
      true,

    encontrados:
      [],
  };
}

     /*
   * Primeiro verifica se o código aparece
   * em algum lugar no HTML.
   *
   * Isso evita trabalho desnecessário.
   */

  const htmlNormalizado =
    normalizarCodigo(
      limparHtml(
        html
      )
    );

  const contemAlvo =
    htmlNormalizado.includes(
      codigoAlvo
    );

  const pecas =
    extrairPecas(
      html,
      item.url
    );

  /*
   * Continuamos indexando as peças
   * que encontramos no caminho.
   */

  if (
    pecas.length > 0
  ) {
    ramo.paginasComPecas +=
      1;

    ramo.registrosExtraidos +=
      pecas.length;

    const salvos =
      await salvarIndice(
        pecas
      );

    ramo.registrosSalvos +=
      salvos;
  }

  /*
   * Correspondência EXATA.
   */

  const encontrados =
    contemAlvo
      ? pecas.filter(
          (registro) =>
            normalizarCodigo(
              registro
                ?.codigo_oem ||
              ""
            ) ===
            codigoAlvo
        )
      : [];

  if (
    encontrados.length >
    0
  ) {
    /*
     * Garante que o alvo
     * foi gravado.
     */

    await salvarIndice(
      encontrados
    );

    return {
      processou:
        true,

      encontrados,

      pagina:
        item.url,

      nivel:
        item.nivel,
    };
  }

  /*
   * Ainda não encontrou.
   * Continua descendo.
   */

  if (
    item.nivel < 50
  ) {
    const links =
      extrairLinks(
        html
      );

    adicionarFilhos({
      ramo,
      links,
      nivelAtual:
        item.nivel,
    });
  }

  return {
    processou:
      true,

    encontrados:
      [],

    pagina:
      item.url,

    nivel:
      item.nivel,
  };
}
/*
 * ============================================================
 * BUSCA DIRECIONADA POR OEM
 * ============================================================
 */

/*
 * ============================================================
 * BUSCA DIRECIONADA POR OEM — V5
 * ============================================================
 *
 * ESTRATÉGIA:
 *
 * MODELO 1
 *   ↓
 * versão
 *   ↓
 * grupo
 *   ↓
 * página técnica
 *   ↓
 * procura OEM
 *
 * Só depois passa ao MODELO 2.
 *
 * Não divide 1 ou 2 páginas entre 80 modelos.
 * ============================================================
 */

async function buscarCodigoAlvoRenault({
  codigoAlvo,
  maxPaginas,
  maxModelos,
  offsetModelos = 0,
  modeloAlvo = "",
}: {
  codigoAlvo: string;
  maxPaginas: number;
  maxModelos: number;
  offsetModelos?: number;
  modeloAlvo?: string;
}) {
  /*
   * ========================================================
   * 1. VERIFICAR ÍNDICE
   * ========================================================
   */

  const jaIndexado =
    await consultarCodigoNoIndice(
      codigoAlvo
    );

  if (
    jaIndexado.length > 0
  ) {
    return {
      encontrado:
        true,

      codigo:
        codigoAlvo,

      quantidade:
        jaIndexado.length,

      registros:
        jaIndexado,

      origem:
        "catcar_indice",

      paginas_visitadas:
        0,

      modelos_processados:
        0,

      ja_indexado:
        true,

      offset_modelos:
        offsetModelos,

      modelo_alvo:
        modeloAlvo || null,
    };
  }


  /*
   * ========================================================
   * 2. CARREGAR MODELOS RENAULT
   * ========================================================
   */

  const paginaInicial =
    "https://www.catcar.info/renault/?lang=en";


  const htmlInicial =
    await buscarPagina(
      paginaInicial
    );


  const linksIniciais =
    extrairLinks(
      htmlInicial
    );


  const todosModelos =
    obterLinksModelos(
      linksIniciais
    );


  /*
   * ========================================================
   * 3. ESCOLHER MODELOS
   * ========================================================
   *
   * Se modeloAlvo for informado:
   * pesquisa SOMENTE esse modelo.
   *
   * Caso contrário:
   * mantém exatamente o comportamento da V5.
   * ========================================================
   */

  let modelos =
    todosModelos.slice(
      offsetModelos,
      offsetModelos +
        maxModelos
    );


  if (
    modeloAlvo.trim()
  ) {
    const alvoNormalizado =
      modeloAlvo
        .normalize("NFD")
        .replace(
          /[\u0300-\u036f]/g,
          ""
        )
        .trim()
        .toLowerCase();


    const modelosExatos =
      todosModelos.filter(
        (modelo) => {
          const nomeNormalizado =
            String(
              modelo.texto ||
              ""
            )
              .normalize("NFD")
              .replace(
                /[\u0300-\u036f]/g,
                ""
              )
              .trim()
              .toLowerCase();

          return (
            nomeNormalizado ===
            alvoNormalizado
          );
        }
      );


    /*
     * Se não houver correspondência
     * exata, tenta correspondência parcial.
     */

    const modelosParciais =
      modelosExatos.length >
      0
        ? []
        : todosModelos.filter(
            (modelo) => {
              const nomeNormalizado =
                String(
                  modelo.texto ||
                  ""
                )
                  .normalize("NFD")
                  .replace(
                    /[\u0300-\u036f]/g,
                    ""
                  )
                  .trim()
                  .toLowerCase();

              return (
                nomeNormalizado.includes(
                  alvoNormalizado
                )
              );
            }
          );


    modelos =
      modelosExatos.length >
      0
        ? modelosExatos.slice(
            0,
            1
          )
        : modelosParciais.slice(
            0,
            1
          );


    console.log(
      "🎯 MODELO ALVO CATCAR:",
      {
        solicitado:
          modeloAlvo,

        encontrado:
          modelos[0]
            ?.texto ||
          null,
      }
    );
  }


  /*
   * ========================================================
   * MODELO NÃO LOCALIZADO
   * ========================================================
   */

  if (
    modelos.length === 0
  ) {
    return {
      encontrado:
        false,

      codigo:
        codigoAlvo,

      quantidade:
        0,

      registros:
        [],

      paginas_visitadas:
        1,

      paginas_com_pecas:
        0,

      registros_extraidos:
        0,

      registros_salvos:
        0,

      modelos_processados:
        0,

      modelos_total:
        todosModelos.length,

      offset_modelos:
        offsetModelos,

      proximo_offset_modelos:
        null,

      modelo_alvo:
        modeloAlvo || null,

      modelo_alvo_localizado:
        false,

      ja_indexado:
        false,

      origem:
        null,

      diagnostico:
        [],
    };
  }


  /*
   * ========================================================
   * 4. CONTADORES
   * ========================================================
   */

  let paginasVisitadas =
    1;


  let modelosProcessados =
    0;


  let paginasComPecas =
    0;


  let registrosExtraidos =
    0;


  let registrosSalvos =
    0;


  const diagnostico:
    any[] = [];


  /*
   * ========================================================
   * LIMITE POR MODELO
   * ========================================================
   *
   * Com modeloAlvo:
   * todo o orçamento de páginas
   * fica disponível para aquele modelo.
   *
   * Sem modeloAlvo:
   * mantém limite V5 de 40 páginas.
   * ========================================================
   */

  const maxPaginasPorModelo =
    modeloAlvo.trim()
      ? Math.max(
          1,
          maxPaginas - 1
        )
      : 40;


  /*
   * ========================================================
   * 5. MODELO POR MODELO
   * ========================================================
   */

  for (
    const modelo
    of modelos
  ) {
    if (
      paginasVisitadas >=
      maxPaginas
    ) {
      break;
    }


    modelosProcessados +=
      1;


    console.log(
      "🚗 BUSCA OEM NO MODELO:",
      {
        codigo:
          codigoAlvo,

        modelo:
          modelo.texto,

        modeloNumero:
          modelosProcessados,

        modeloAlvo:
          modeloAlvo ||
          null,

        limitePaginasModelo:
          maxPaginasPorModelo,
      }
    );


    const ramo:
      RamoModelo = {
        nome:
          modelo.texto,

        fila: [
          {
            url:
              modelo.url,

            texto:
              modelo.texto,

            nivel:
              modelo.nivel,

            prioridade:
              modelo.prioridade,
          },
        ],

        visitadas:
          new Set<string>(),

        agendadas:
          new Set<string>([
            modelo.url,
          ]),

        paginas:
          0,

        paginasComPecas:
          0,

        registrosExtraidos:
          0,

        registrosSalvos:
          0,
      };


    /*
     * ======================================================
     * 6. APROFUNDAR NESTE MODELO
     * ======================================================
     */

    while (
      ramo.fila.length >
        0 &&
      ramo.paginas <
        maxPaginasPorModelo &&
      paginasVisitadas <
        maxPaginas
    ) {
      const resultado =
        await processarPaginaComAlvo({
          ramo,

          codigoAlvo,
        });


      if (
        !resultado.processou
      ) {
        continue;
      }


      paginasVisitadas +=
        1;


      /*
       * ====================================================
       * OEM ENCONTRADO
       * ====================================================
       */

      if (
        Array.isArray(
          resultado
            ?.encontrados
        ) &&
        resultado
          .encontrados.length >
          0
      ) {
        const encontrados =
          resultado
            .encontrados;


        await salvarIndice(
          encontrados
        );


        const registrosIndice =
          await consultarCodigoNoIndice(
            codigoAlvo
          );


        const registrosFinal =
          registrosIndice.length >
          0
            ? registrosIndice
            : encontrados;


        console.log(
          "🎯 OEM CATCAR ENCONTRADO:",
          {
            codigo:
              codigoAlvo,

            modelo:
              modelo.texto,

            pagina:
              resultado
                ?.pagina,

            quantidade:
              registrosFinal.length,
          }
        );


        return {
          encontrado:
            true,

          codigo:
            codigoAlvo,

          quantidade:
            registrosFinal.length,

          registros:
            registrosFinal,

          origem:
            "catcar_busca_direcionada",

          paginas_visitadas:
            paginasVisitadas,

          modelos_processados:
            modelosProcessados,

          modelo_encontrado:
            modelo.texto,

          modelo_alvo:
            modeloAlvo ||
            null,

          modelo_alvo_localizado:
            Boolean(
              modeloAlvo.trim()
            ),

          pagina_encontrada:
            resultado
              ?.pagina ||
            null,

          ja_indexado:
            false,

          offset_modelos:
            offsetModelos,

          proximo_offset_modelos:
            null,

          diagnostico,
        };
      }
    }


    /*
     * ======================================================
     * ESTATÍSTICAS DESTE MODELO
     * ======================================================
     */

    paginasComPecas +=
      ramo.paginasComPecas;


    registrosExtraidos +=
      ramo.registrosExtraidos;


    registrosSalvos +=
      ramo.registrosSalvos;


    diagnostico.push({
      modelo:
        ramo.nome,

      paginas:
        ramo.paginas,

      paginas_com_pecas:
        ramo.paginasComPecas,

      registros_extraidos:
        ramo.registrosExtraidos,

      registros_salvos:
        ramo.registrosSalvos,

      fila_restante:
        ramo.fila.length,
    });


    console.log(
      "🔎 MODELO FINALIZADO SEM O OEM:",
      {
        modelo:
          ramo.nome,

        paginas:
          ramo.paginas,

        paginasComPecas:
          ramo
            .paginasComPecas,

        filaRestante:
          ramo.fila.length,
      }
    );
  }


  /*
   * ========================================================
   * 7. NÃO ENCONTRADO
   * ========================================================
   */

  const proximoOffset =
    offsetModelos +
    modelosProcessados;


  return {
    encontrado:
      false,

    codigo:
      codigoAlvo,

    quantidade:
      0,

    registros:
      [],

    paginas_visitadas:
      paginasVisitadas,

    paginas_com_pecas:
      paginasComPecas,

    registros_extraidos:
      registrosExtraidos,

    registros_salvos:
      registrosSalvos,

    modelos_processados:
      modelosProcessados,

    modelos_total:
      todosModelos.length,

    offset_modelos:
      offsetModelos,

    proximo_offset_modelos:
      modeloAlvo.trim()
        ? null
        : proximoOffset <
          todosModelos.length
          ? proximoOffset
          : null,

    modelo_alvo:
      modeloAlvo ||
      null,

    modelo_alvo_localizado:
      Boolean(
        modeloAlvo.trim()
      ),

    ja_indexado:
      false,

    origem:
      null,

    diagnostico,
  };
}
async function indexarRenault({
  maxPaginas,
  maxModelos,
  offsetModelos,
}: {
  maxPaginas: number;
  maxModelos: number;
  offsetModelos: number;
}) {
  const paginaInicial =
    "https://www.catcar.info/renault/?lang=en";


  const htmlInicial =
    await buscarPagina(
      paginaInicial
    );


  const linksIniciais =
    extrairLinks(
      htmlInicial
    );


  const modelos =
    selecionarLinksModelos({
      links:
        linksIniciais,

      maxModelos,

      offsetModelos,
    });


  const ramos:
    RamoModelo[] =
    modelos.map(
      (modelo) => ({
        nome:
          modelo.texto,

        fila: [
          {
            url:
              modelo.url,

            texto:
              modelo.texto,

            nivel:
              modelo.nivel,

            prioridade:
              modelo.prioridade,
          },
        ],

        visitadas:
          new Set<string>(),

        agendadas:
          new Set<string>([
            modelo.url,
          ]),

        paginas:
          0,

        paginasComPecas:
          0,

        registrosExtraidos:
          0,

        registrosSalvos:
          0,
      })
    );


  let paginasVisitadas =
    1;


  let indiceRamo =
    0;


  let semProgresso =
    0;


  while (
    paginasVisitadas <
      maxPaginas &&
    ramos.length > 0
  ) {
    const ramo =
      ramos[
        indiceRamo %
        ramos.length
      ];


    indiceRamo +=
      1;


    if (
      ramo.fila.length ===
      0
    ) {
      semProgresso +=
        1;


      if (
        semProgresso >=
        ramos.length
      ) {
        break;
      }


      continue;
    }


    const resultado =
      await processarUmaPagina(
        ramo
      );


    if (
      resultado.processou
    ) {
      paginasVisitadas +=
        1;

      semProgresso =
        0;
    } else {
      semProgresso +=
        1;
    }
  }


  const paginasComPecas =
    ramos.reduce(
      (
        total,
        ramo
      ) =>
        total +
        ramo.paginasComPecas,
      0
    );


  const registrosExtraidos =
    ramos.reduce(
      (
        total,
        ramo
      ) =>
        total +
        ramo
          .registrosExtraidos,
      0
    );


  const registrosSalvos =
    ramos.reduce(
      (
        total,
        ramo
      ) =>
        total +
        ramo
          .registrosSalvos,
      0
    );


  const filaRestante =
    ramos.reduce(
      (
        total,
        ramo
      ) =>
        total +
        ramo.fila.length,
      0
    );


  return {
    paginas_visitadas:
      paginasVisitadas,

    paginas_com_pecas:
      paginasComPecas,

    registros_extraidos:
      registrosExtraidos,

    registros_salvos:
      registrosSalvos,

    fila_restante:
      filaRestante,

    modelos_encontrados:
      linksIniciais.filter(
        (item) =>
          item.nivel ===
          20
      ).length,

    modelos_processados:
      ramos.length,

    offset_modelos:
      offsetModelos,

    modelos:
      ramos.map(
        (ramo) => ({
          nome:
            ramo.nome,

          paginas:
            ramo.paginas,

          paginas_com_pecas:
            ramo
              .paginasComPecas,

          registros_extraidos:
            ramo
              .registrosExtraidos,

          registros_salvos:
            ramo
              .registrosSalvos,

          fila_restante:
            ramo
              .fila.length,
        })
      ),
  };
}


/*
 * ============================================================
 * JSON
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
 * HANDLER
 * ============================================================
 */

serve(
  async (
    req
  ) => {
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


    if (
      req.method !==
      "POST"
    ) {
      return responderJson(
        {
          sucesso:
            false,

          mensagem:
            "Método não permitido.",
        },
        405
      );
    }


    try {
      let body:
        any = {};


      try {
        body =
          await req.json();
      } catch {
        body = {};
      }


      /*
       * ======================================================
       * CÓDIGO ALVO
       * ======================================================
       */

      const codigoAlvo =
        normalizarCodigo(
          body
            ?.codigoAlvo ||
          ""
        );


      /*
       * ======================================================
       * TOTAL DE PÁGINAS
       * ======================================================
       */

      const maxPaginas =
        Math.max(
          5,
          Math.min(
            Number(
              body
                ?.maxPaginas ||
              (
                codigoAlvo
                  ? 120
                  : 30
              )
            ),
            codigoAlvo
              ? 300
              : 50
          )
        );


      /*
       * ======================================================
       * QUANTIDADE DE MODELOS
       * ======================================================
       */

      const maxModelos =
        Math.max(
          1,
          Math.min(
            Number(
              body
                ?.maxModelos ||
              (
                codigoAlvo
                  ? 80
                  : 5
              )
            ),
            80
          )
        );


      /*
       * ======================================================
       * OFFSET NORMAL
       * ======================================================
       */

      const offsetModelos =
        Math.max(
          0,
          Number(
            body
              ?.offsetModelos ||
            0
          )
        );


      const inicio =
        Date.now();


      /*
       * ======================================================
       * MODO BUSCA DIRECIONADA
       * ======================================================
       */

      if (
        codigoAlvo
      ) {
        console.log(
          "🎯 PAIIA CATCAR — BUSCA DIRECIONADA:",
          {
            codigoAlvo,

            maxPaginas,

            maxModelos,
          }
        );

const resultado =
  await buscarCodigoAlvoRenault({
    codigoAlvo,

    maxPaginas,

    maxModelos,

    offsetModelos,

    modeloAlvo:
      String(
        body?.modeloAlvo ||
        ""
      ).trim(),
  });
        const tempoMs =
          Date.now() -
          inicio;


        return responderJson(
          {
            sucesso:
              true,

            montadora:
              "renault",

            estrategia:
              "busca_direcionada_oem",

            codigo_alvo:
              codigoAlvo,

            ...resultado,

            tempo_ms:
              tempoMs,

            mensagem:
              resultado
                .encontrado
                ? `${resultado.quantidade} ocorrência(s) encontrada(s) para ${codigoAlvo}.`
                : `Código ${codigoAlvo} não localizado dentro do limite desta execução.`,
          }
        );
      }


      /*
       * ======================================================
       * MODO INDEXAÇÃO NORMAL
       * ======================================================
       */

      console.log(
        "🚀 PAIIA CATCAR V4 — RODÍZIO:",
        {
          maxPaginas,
          maxModelos,
          offsetModelos,
        }
      );


      const resultado =
        await indexarRenault({
          maxPaginas,

          maxModelos,

          offsetModelos,
        });


      const tempoMs =
        Date.now() -
        inicio;


      return responderJson(
        {
          sucesso:
            true,

          montadora:
            "renault",

          estrategia:
            "rodizio_entre_modelos",

          ...resultado,

          tempo_ms:
            tempoMs,
        }
      );
    } catch (
      erro
    ) {
      console.error(
        "❌ indexar-catcar:",
        erro
      );


      return responderJson(
        {
          sucesso:
            false,

          mensagem:
            erro instanceof Error
              ? erro.message
              : "Erro ao indexar CatCar.",
        },
        500
      );
    }
  }
);