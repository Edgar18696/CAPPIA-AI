import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import {
  createWorker,
  PSM,
} from "tesseract.js";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  pdfWorker;

/*
 * ============================================================
 * APPIA AI
 * LEITOR PDF + OCR MOTRIO
 * ============================================================
 */

function limparTexto(
  valor = ""
) {
  return String(
    valor || ""
  )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}

/*
 * ============================================================
 * TEXTO NATIVO PDF.JS
 * ============================================================
 */

function organizarItensTexto(
  itens = []
) {
  const linhas =
    new Map();

  for (
    const item of itens
  ) {
    const texto =
      String(
        item?.str || ""
      ).trim();

    if (!texto) {
      continue;
    }

    const transform =
      item?.transform || [];

    const posicaoX =
      Number(
        transform[4]
      ) || 0;

    const posicaoY =
      Math.round(
        Number(
          transform[5]
        ) || 0
      );

    const chaveLinha =
      Math.round(
        posicaoY / 3
      ) * 3;

    if (
      !linhas.has(
        chaveLinha
      )
    ) {
      linhas.set(
        chaveLinha,
        []
      );
    }

    linhas
      .get(
        chaveLinha
      )
      .push({
        texto,
        posicaoX,
      });
  }

  return Array.from(
    linhas.entries()
  )
    .sort(
      (
        [posicaoYA],
        [posicaoYB]
      ) =>
        posicaoYB -
        posicaoYA
    )
    .map(
      ([, itensLinha]) =>
        itensLinha
          .sort(
            (
              itemA,
              itemB
            ) =>
              itemA.posicaoX -
              itemB.posicaoX
          )
          .map(
            (item) =>
              item.texto
          )
          .join(" ")
          .replace(
            /\s+/g,
            " "
          )
          .trim()
    )
    .filter(Boolean)
    .join("\n");
}

/*
 * ============================================================
 * MAGNETI MARELLI — BICOS EM DUAS COLUNAS
 * ============================================================
 *
 * Páginas físicas:
 *
 * 1363 até 1379
 *
 * O catálogo Electronic Systems and Ignition
 * possui duas colunas independentes.
 *
 * O leitor normal organiza:
 *
 * Y -> X
 *
 * Isso pode juntar:
 *
 * coluna esquerda + coluna direita
 *
 * na mesma linha.
 *
 * Para os bicos fazemos:
 *
 * COLUNA ESQUERDA
 * ↓
 * COLUNA DIREITA
 *
 * preservando a sequência de cada aplicação.
 * ============================================================
 */

function ehPaginaBicosMarelliDuasColunas({
  numeroPagina,
  itens = [],
}) {
  const numero =
    Number(
      numeroPagina
    );

  if (
    !Number.isFinite(
      numero
    )
  ) {
    return false;
  }

  const texto =
    itens
      .map(
        (item) =>
          String(
            item?.str || ""
          )
      )
      .join(" ")
      .toUpperCase();

  /*
   * ============================================================
   * MAGNETI MARELLI — BICOS
   * ============================================================
   *
   * Electronic Systems and Ignition.
   * Páginas físicas 1363 até 1379.
   */

  const ehBicosMarelli =
    numero >= 1363 &&
    numero <= 1379 &&
    (
      /\b(?:IWP|IPM|FEI)[A-Z0-9./-]+\b/.test(
        texto
      ) ||
      texto.includes(
        "FUEL INJECTOR"
      ) ||
      texto.includes(
        "INIETTORE"
      )
    );

  if (
    ehBicosMarelli
  ) {
    return true;
  }

  /*
   * ============================================================
   * MAGNETI MARELLI — WIPER BLADES
   * ============================================================
   *
   * Parts_Wiper-Blades_EN.pdf
   *
   * O catálogo possui duas colunas independentes.
   *
   * Exemplos:
   *
   * SW1300
   * FIAT
   * CINQUECENTO
   * FORD
   * ECOSPORT
   * FIESTA
   * FUSION
   * MITSUBISHI
   *
   * enquanto a coluna direita contém outros
   * códigos/aplicações.
   *
   * Precisamos ler:
   *
   * COLUNA ESQUERDA
   * ↓
   * COLUNA DIREITA
   */

  const possuiCodigoPalheta =
    /\bSW\d{3,5}[A-Z0-9-]*\b/.test(
      texto
    );

  const possuiEstruturaVeiculos =
    (
      texto.includes("FIAT") ||
      texto.includes("FORD") ||
      texto.includes("VOLKSWAGEN") ||
      texto.includes("RENAULT") ||
      texto.includes("PEUGEOT") ||
      texto.includes("CITROEN") ||
      texto.includes("AUDI") ||
      texto.includes("BMW") ||
      texto.includes("MERCEDES") ||
      texto.includes("TOYOTA") ||
      texto.includes("HONDA") ||
      texto.includes("NISSAN") ||
      texto.includes("MITSUBISHI") ||
      texto.includes("HYUNDAI") ||
      texto.includes("KIA") ||
      texto.includes("OPEL") ||
      texto.includes("SEAT") ||
      texto.includes("SKODA")
    );

  const ehWiperBlades =
    numero <= 43 &&
    possuiCodigoPalheta &&
    possuiEstruturaVeiculos;

  if (
    ehWiperBlades
  ) {
    console.log(
      `🧹 Página ${numero}: Wiper Blades detectado em duas colunas.`
    );

    return true;
  }

  return false;
}

function organizarItensTextoDuasColunas(
  itens = []
) {
  const validos =
    itens
      .map(
        (item) => {
          const texto =
            String(
              item?.str || ""
            ).trim();

          const transform =
            item?.transform || [];

          const x =
            Number(
              transform[4]
            );

          const largura =
            Number(
              item?.width
            ) || 0;

          if (
            !texto ||
            !Number.isFinite(
              x
            )
          ) {
            return null;
          }

          return {
            item,

            x,

            centroX:
              x +
              largura / 2,
          };
        }
      )
      .filter(Boolean);

  if (
    validos.length === 0
  ) {
    return "";
  }

  /*
   * Descobre a largura real ocupada
   * pelo conteúdo da página.
   */

  const xs =
    validos.map(
      (registro) =>
        registro.centroX
    );

  const xMin =
    Math.min(
      ...xs
    );

  const xMax =
    Math.max(
      ...xs
    );

  const meio =
    xMin +
    (
      xMax -
      xMin
    ) / 2;

  /*
   * Separa fisicamente as colunas.
   */

  const esquerda =
    validos
      .filter(
        (registro) =>
          registro.centroX <
          meio
      )
      .map(
        (registro) =>
          registro.item
      );

  const direita =
    validos
      .filter(
        (registro) =>
          registro.centroX >=
          meio
      )
      .map(
        (registro) =>
          registro.item
      );

  /*
   * Cada coluna passa separadamente
   * pelo organizador já aprovado.
   */

  const textoEsquerda =
    organizarItensTexto(
      esquerda
    );

  const textoDireita =
    organizarItensTexto(
      direita
    );

  return [
    textoEsquerda,

    textoDireita,
  ]
    .filter(Boolean)
    .join("\n");
}

/*
 * ============================================================
 * VERIFICA SE TEXTO NATIVO É SUFICIENTE
 * ============================================================
 */

function textoPareceSuficiente(
  texto = ""
) {
  const conteudo =
    String(
      texto || ""
    ).trim();

  if (!conteudo) {
    return false;
  }

  const caracteres =
    conteudo.replace(
      /\s/g,
      ""
    ).length;

  const linhas =
    conteudo
      .split(
        /\r?\n/
      )
      .map(
        (linha) =>
          limparTexto(
            linha
          )
      )
      .filter(Boolean);

  if (
    caracteres < 80
  ) {
    return false;
  }

  if (
    linhas.length < 4
  ) {
    return false;
  }

  return true;
}

/*
 * ============================================================
 * ABRIR PDF
 * ============================================================
 */

async function abrirPdf(
  arquivo,
  onProgresso
) {
  if (!arquivo) {
    throw new Error(
      "Nenhum arquivo PDF foi informado."
    );
  }

  onProgresso?.(
    "📦 Carregando arquivo PDF..."
  );

  const buffer =
    await arquivo.arrayBuffer();

  onProgresso?.(
    "📚 Abrindo estrutura do PDF..."
  );

  const tarefa =
    pdfjsLib.getDocument({
      data:
        buffer,

      stopAtErrors:
        false,

      isEvalSupported:
        false,
    });

  let timeoutId =
    null;

  try {
    const pdf =
      await Promise.race([
        tarefa.promise,

        new Promise(
          (
            _,
            rejeitar
          ) => {
            timeoutId =
              setTimeout(
                () => {
                  rejeitar(
                    new Error(
                      "O PDF demorou mais de 60 segundos para abrir. O arquivo pode estar danificado ou protegido."
                    )
                  );
                },
                60000
              );
          }
        ),
      ]);

    if (
      timeoutId
    ) {
      clearTimeout(
        timeoutId
      );

      timeoutId =
        null;
    }

    return pdf;
  } catch (
    erro
  ) {
    if (
      timeoutId
    ) {
      clearTimeout(
        timeoutId
      );
    }

    try {
      await tarefa.destroy();
    } catch {
      // Ignora erro de encerramento.
    }

    throw erro;
  }
}

/*
 * ============================================================
 * WORKER OCR
 * ============================================================
 */

let workerOcr =
  null;

let promessaWorkerOcr =
  null;

async function obterWorkerOcr(
  onProgresso
) {
  if (
    workerOcr
  ) {
    return workerOcr;
  }

  if (
    promessaWorkerOcr
  ) {
    return promessaWorkerOcr;
  }

  onProgresso?.(
    "🧠 Preparando leitor OCR..."
  );

  promessaWorkerOcr =
    createWorker(
      "por"
    )
      .then(
        (
          worker
        ) => {
          workerOcr =
            worker;

          promessaWorkerOcr =
            null;

          return workerOcr;
        }
      )
      .catch(
        (
          erro
        ) => {
          promessaWorkerOcr =
            null;

          workerOcr =
            null;

          throw erro;
        }
      );

  return promessaWorkerOcr;
}

/*
 * ============================================================
 * RENDERIZA PÁGINA
 * ============================================================
 */

async function renderizarPagina(
  pagina
) {
  if (
    !pagina
  ) {
    throw new Error(
      "Página PDF inválida para OCR."
    );
  }

  const escala =
    3;

  const viewport =
    pagina.getViewport({
      scale:
        escala,
    });

  const canvas =
    document.createElement(
      "canvas"
    );

  canvas.width =
    Math.ceil(
      viewport.width
    );

  canvas.height =
    Math.ceil(
      viewport.height
    );

  const contexto =
    canvas.getContext(
      "2d",
      {
        alpha:
          false,

        willReadFrequently:
          true,
      }
    );

  if (
    !contexto
  ) {
    throw new Error(
      "Não foi possível criar o contexto Canvas para OCR."
    );
  }

  contexto.fillStyle =
    "#ffffff";

  contexto.fillRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  const tarefaRender =
    pagina.render({
      canvasContext:
        contexto,

      viewport,

      background:
        "rgb(255,255,255)",
    });

  await tarefaRender.promise;

  return canvas;
}

/*
 * ============================================================
 * NORMALIZA REFERÊNCIA MOTRIO
 * ============================================================
 */
function normalizarCodigoMotrio(
  valor = ""
) {
  return String(
    valor || ""
  )
    .replace(
      /\D/g,
      ""
    )
    .trim();
}

function corrigirCodigoMotrioOcr(
  valor = ""
) {
  let texto =
    String(
      valor || ""
    )
      .toUpperCase()
      .replace(
        /[^A-Z0-9]/g,
        ""
      );

  const mapa = {
    B: "8",
    O: "0",
    Q: "0",
    D: "0",
    G: "6",
    S: "5",
    I: "1",
    L: "1",
    Z: "2",
    A: "4",
    T: "7",
  };

  texto =
    texto
      .split("")
      .map(
        (caractere) =>
          mapa[caractere] ??
          caractere
      )
      .join("");

  for (
    let indice = 0;
    indice <=
      texto.length - 10;
    indice += 1
  ) {
    const candidato =
      texto.slice(
        indice,
        indice + 10
      );

    if (
      /^(?:866|855)\d{7}$/.test(
        candidato
      )
    ) {
      return candidato;
    }
  }

  return "";
}

function ehCodigoMotrio(
  codigo = ""
) {
  return (
    /^\d{10}$/.test(
      codigo
    ) &&
    (
      codigo.startsWith(
        "866"
      ) ||
      codigo.startsWith(
        "855"
      )
    )
  );
}

/*
 * ============================================================
 * OCR ESTRUTURAL
 * ============================================================
 */
/*
 * ============================================================
 * MOTRIO — DETECÇÃO DE PÁGINAS DE FILTROS
 * ============================================================
 */

function normalizarTextoMotrio(
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
      /\s+/g,
      " "
    )
    .trim();
}

function ehPaginaFiltroMotrio({
  texto = "",
  numeroPagina,
}) {
  const normalizado =
    normalizarTextoMotrio(
      texto
    );

  if (
    normalizado.includes(
      "filtros de ar"
    ) ||
    normalizado.includes(
      "filtro de ar"
    ) ||
    normalizado.includes(
      "filtros de cabine"
    ) ||
    normalizado.includes(
      "filtro de cabine"
    ) ||
    normalizado.includes(
      "filtros de combustivel"
    ) ||
    normalizado.includes(
      "filtro de combustivel"
    ) ||
    normalizado.includes(
      "filtros de oleo"
    ) ||
    normalizado.includes(
      "filtro de oleo"
    )
  ) {
    return true;
  }

  const paginasFiltros =
    new Set([
      27,

      29,
      30,

      32,
      33,

      35,
      36,
    ]);

  return paginasFiltros.has(
    Number(
      numeroPagina
    )
  );
}

/*
 * ============================================================
 * EXTRAI REFERÊNCIAS MOTRIO DO OCR NUMÉRICO
 * ============================================================
 */

function extrairCodigosMotrioNumericos(
  texto = ""
) {
  const encontrados =
    new Set();

  const linhas =
    String(
      texto || ""
    )
      .split(
        /\r?\n/
      )
      .map(
        (linha) =>
          String(
            linha || ""
          )
            .replace(
              /\D/g,
              ""
            )
            .trim()
      )
      .filter(Boolean);

  for (
    const linha
    of linhas
  ) {
    if (
      ehCodigoMotrio(
        linha
      )
    ) {
      encontrados.add(
        linha
      );

      continue;
    }

    for (
      let indice = 0;
      indice <=
        linha.length - 10;
      indice += 1
    ) {
      const candidato =
        linha.slice(
          indice,
          indice + 10
        );

      if (
        ehCodigoMotrio(
          candidato
        )
      ) {
        encontrados.add(
          candidato
        );
      }
    }
  }

  return Array.from(
    encontrados
  );
}

/*
 * ============================================================
 * OCR NUMÉRICO — SOMENTE COLUNA REF. MOTRIO
 * ============================================================
 */

async function extrairCodigosMotrioFiltros({
  canvas,
  worker,
  numeroPagina,
  textoPagina,
  onProgresso,
}) {
  if (
    !ehPaginaFiltroMotrio({
      texto:
        textoPagina,

      numeroPagina,
    })
  ) {
    return [];
  }

  try {
    onProgresso?.(
      `🔢 Lendo referências Motrio da página ${numeroPagina}...`
    );

    const rectangle = {
      left:
        Math.round(
          canvas.width *
            0.035
        ),

      top:
        Math.round(
          canvas.height *
            0.17
        ),

      width:
        Math.round(
          canvas.width *
            0.24
        ),

      height:
        Math.round(
          canvas.height *
            0.75
        ),
    };

    await worker.setParameters({
      tessedit_char_whitelist:
        "0123456789",

      tessedit_pageseg_mode:
        PSM.SPARSE_TEXT,
    });

    const resultado =
      await worker.recognize(
        canvas,
        {
          rectangle,
        }
      );

    const textoNumerico =
      String(
        resultado
          ?.data
          ?.text ||
        ""
      );

    const codigos =
      extrairCodigosMotrioNumericos(
        textoNumerico
      );

    console.log(
      `🔢 MOTRIO FILTROS PÁGINA ${numeroPagina}:`,
      {
        bruto:
          textoNumerico,

        codigos,
      }
    );

    await worker.setParameters({
      tessedit_char_whitelist:
        "",

      tessedit_pageseg_mode:
        PSM.AUTO,
    });

    return codigos;
  } catch (erro) {
    console.warn(
      `⚠️ OCR Motrio filtros página ${numeroPagina}:`,
      erro
    );

    try {
      await worker.setParameters({
        tessedit_char_whitelist:
          "",

        tessedit_pageseg_mode:
          PSM.AUTO,
      });
    } catch {
      // Ignora restauração.
    }

    return [];
  }
}

/*
 * ============================================================
 * PALAVRAS DOS BLOCOS OCR
 * ============================================================
 */

function extrairPalavrasDosBlocos(
  blocos = []
) {
  const palavras =
    [];

  for (
    const bloco
    of blocos || []
  ) {
    for (
      const paragrafo
      of bloco?.paragraphs || []
    ) {
      for (
        const linha
        of paragrafo?.lines || []
      ) {
        for (
          const palavra
          of linha?.words || []
        ) {
          const texto =
            String(
              palavra?.text || ""
            ).trim();

          const bbox =
            palavra?.bbox;

          if (
            !texto ||
            !bbox
          ) {
            continue;
          }

          palavras.push({
            texto,

            x0:
              Number(
                bbox.x0
              ) || 0,

            y0:
              Number(
                bbox.y0
              ) || 0,

            x1:
              Number(
                bbox.x1
              ) || 0,

            y1:
              Number(
                bbox.y1
              ) || 0,
          });
        }
      }
    }
  }

  return palavras;
}

/*
 * ============================================================
 * ORGANIZA OCR PELAS POSIÇÕES X / Y
 * ============================================================
 */

function organizarPalavrasOcrPorLinha(
  palavras = []
) {
  if (
    !Array.isArray(
      palavras
    ) ||
    palavras.length === 0
  ) {
    return "";
  }

  const ordenadas =
    [...palavras]
      .sort(
        (
          a,
          b
        ) => {
          const centroYA =
            (
              a.y0 +
              a.y1
            ) / 2;

          const centroYB =
            (
              b.y0 +
              b.y1
            ) / 2;

          if (
            Math.abs(
              centroYA -
              centroYB
            ) > 8
          ) {
            return (
              centroYA -
              centroYB
            );
          }

          return (
            a.x0 -
            b.x0
          );
        }
      );

  const linhas =
    [];

  for (
    const palavra
    of ordenadas
  ) {
    const centroY =
      (
        palavra.y0 +
        palavra.y1
      ) / 2;

    let linhaEncontrada =
      null;

    for (
      const linha
      of linhas
    ) {
      if (
        Math.abs(
          linha.centroY -
          centroY
        ) <= 12
      ) {
        linhaEncontrada =
          linha;

        break;
      }
    }

    if (
      !linhaEncontrada
    ) {
      linhaEncontrada = {
        centroY,
        palavras: [],
      };

      linhas.push(
        linhaEncontrada
      );
    }

    linhaEncontrada
      .palavras
      .push(
        palavra
      );

    linhaEncontrada.centroY =
      linhaEncontrada
        .palavras
        .reduce(
          (
            soma,
            item
          ) =>
            soma +
            (
              item.y0 +
              item.y1
            ) /
              2,
          0
        ) /
      linhaEncontrada
        .palavras
        .length;
  }

  return linhas
    .sort(
      (
        a,
        b
      ) =>
        a.centroY -
        b.centroY
    )
    .map(
      (linha) =>
        linha
          .palavras
          .sort(
            (
              a,
              b
            ) =>
              a.x0 -
              b.x0
          )
          .map(
            (palavra) =>
              palavra.texto
          )
          .join(" ")
          .replace(
            /\s+/g,
            " "
          )
          .trim()
    )
    .filter(Boolean)
    .join("\n");
}

/*
 * ============================================================
 * MOTRIO — CÓDIGOS DIRETO DO OCR POSICIONAL
 * ============================================================
 */

function extrairCodigosMotrioDasPalavras({
  palavras = [],
  canvas,
  numeroPagina,
}) {
  const encontrados =
    new Set();

  if (
    !Array.isArray(
      palavras
    ) ||
    palavras.length === 0 ||
    !canvas
  ) {
    return [];
  }

  const xMin =
    canvas.width *
    0.09;

  const xMax =
    canvas.width *
    0.25;

  const yMin =
    canvas.height *
    0.18;

  const yMax =
    canvas.height *
    0.92;

  const palavrasColuna =
    palavras.filter(
      (palavra) => {
        const centroX =
          (
            palavra.x0 +
            palavra.x1
          ) / 2;

        const centroY =
          (
            palavra.y0 +
            palavra.y1
          ) / 2;

        return (
          centroX >= xMin &&
          centroX <= xMax &&
          centroY >= yMin &&
          centroY <= yMax
        );
      }
    );

  for (
    const palavra
    of palavrasColuna
  ) {
    const codigo =
      corrigirCodigoMotrioOcr(
        palavra.texto
      );

    if (
      codigo &&
      ehCodigoMotrio(
        codigo
      )
    ) {
      encontrados.add(
        codigo
      );
    }
  }

  const ordenadas =
    [...palavrasColuna]
      .sort(
        (
          a,
          b
        ) => {
          const yA =
            (
              a.y0 +
              a.y1
            ) / 2;

          const yB =
            (
              b.y0 +
              b.y1
            ) / 2;

          if (
            Math.abs(
              yA -
              yB
            ) > 10
          ) {
            return (
              yA -
              yB
            );
          }

          return (
            a.x0 -
            b.x0
          );
        }
      );

  for (
    let indice = 0;
    indice <
      ordenadas.length;
    indice += 1
  ) {
    const atual =
      ordenadas[
        indice
      ];

    const proxima =
      ordenadas[
        indice + 1
      ];

    if (
      !proxima
    ) {
      continue;
    }

    const centroYAtual =
      (
        atual.y0 +
        atual.y1
      ) / 2;

    const centroYProxima =
      (
        proxima.y0 +
        proxima.y1
      ) / 2;

    if (
      Math.abs(
        centroYAtual -
        centroYProxima
      ) > 12
    ) {
      continue;
    }

    const unido =
      `${atual.texto}${proxima.texto}`;

    const codigo =
      corrigirCodigoMotrioOcr(
        unido
      );

    if (
      codigo &&
      ehCodigoMotrio(
        codigo
      )
    ) {
      encontrados.add(
        codigo
      );
    }
  }

  const resultado =
    Array.from(
      encontrados
    );

  console.log(
    `🔢 MOTRIO POSICIONAL PÁGINA ${numeroPagina}:`,
    {
      palavrasColuna:
        palavrasColuna.map(
          (item) =>
            item.texto
        ),

      codigos:
        resultado,
    }
  );

  return resultado;
}

/*
 * ============================================================
 * OCR DA PÁGINA
 * ============================================================
 */

async function extrairTextoOcr({
  pagina,
  numeroPagina,
  onProgresso,
}) {
  try {
    onProgresso?.(
      `🔎 OCR necessário na página ${numeroPagina}...`
    );

    const canvas =
      await renderizarPagina(
        pagina
      );

    const worker =
      await obterWorkerOcr(
        onProgresso
      );

    onProgresso?.(
      `🧠 Lendo tabela da página ${numeroPagina}...`
    );

    await worker.setParameters({
      tessedit_char_whitelist:
        "",

      tessedit_pageseg_mode:
        PSM.AUTO,
    });

    const resultado =
      await worker.recognize(
        canvas,
        {},
        {
          text:
            true,

          blocks:
            true,
        }
      );

    const palavras =
      extrairPalavrasDosBlocos(
        resultado
          ?.data
          ?.blocks ||
          []
      );

    const textoPosicional =
      organizarPalavrasOcrPorLinha(
        palavras
      );

    const textoNormal =
      String(
        resultado
          ?.data
          ?.text ||
        ""
      )
        .split(
          /\r?\n/
        )
        .map(
          (linha) =>
            limparTexto(
              linha
            )
        )
        .filter(Boolean)
        .join("\n");

    let texto =
      textoPosicional ||
      textoNormal;

    const codigosMotrio =
      await extrairCodigosMotrioFiltros({
        canvas,

        worker,

        numeroPagina,

        textoPagina:
          texto,

        onProgresso,
      });

    if (
      codigosMotrio.length >
      0
    ) {
      texto =
        [
          texto,

          "--- REFERENCIAS MOTRIO OCR ---",

          ...codigosMotrio,
        ]
          .filter(Boolean)
          .join("\n");
    }

    console.log(
      `📊 OCR POSICIONAL PÁGINA ${numeroPagina}:`,
      {
        blocos:
          Array.isArray(
            resultado
              ?.data
              ?.blocks
          )
            ? resultado
                .data
                .blocks
                .length
            : 0,

        palavras:
          palavras.length,

        usouPosicional:
          Boolean(
            textoPosicional
          ),

        codigosMotrio,

        preview:
          texto.slice(
            0,
            2200
          ),
      }
    );

    console.log(
      `🔎 OCR página ${numeroPagina}:`,
      {
        caracteres:
          texto.length,

        modo:
          codigosMotrio.length
            ? "ocr_posicional_mais_coluna_motrio"
            : "ocr_posicional_unico",

        palavras:
          palavras.length,

        referenciasMotrio:
          codigosMotrio.length,

        preview:
          texto.slice(
            0,
            2200
          ),
      }
    );

    return texto;
  } catch (
    erro
  ) {
    console.error(
      `❌ Erro OCR página ${numeroPagina}:`,
      erro
    );

    return "";
  }
}

/*
 * ============================================================
 * EXTRAIR PÁGINAS PDF
 * ============================================================
 */

export async function extrairPaginasPdf({
  arquivo,
  paginaInicial = 1,
  paginaFinal,
  tipo = "catálogo",
  onProgresso,
}) {
  const pdf =
    await abrirPdf(
      arquivo,
      onProgresso
    );

  onProgresso?.(
    `📄 PDF aberto com ${pdf.numPages} páginas.`
  );

  const inicio =
    Math.max(
      1,
      Number(
        paginaInicial
      ) || 1
    );

  const fim =
    Math.min(
      Number(
        paginaFinal
      ) ||
        pdf.numPages,

      pdf.numPages
    );

  if (
    inicio > fim
  ) {
    throw new Error(
      `Faixa de páginas inválida: ${inicio} até ${fim}.`
    );
  }

  const paginas =
    [];

  for (
    let numeroPagina =
      inicio;

    numeroPagina <=
    fim;

    numeroPagina += 1
  ) {
    onProgresso?.(
      `📄 Extraindo ${tipo}: página ${numeroPagina} de ${fim}...`
    );

    let pagina =
      null;

    try {
      pagina =
        await pdf.getPage(
          numeroPagina
        );

      const conteudo =
        await pagina
          .getTextContent();

      const itensTexto =
        conteudo?.items ||
        [];

      /*
       * ======================================================
       * MARELLI — DUAS COLUNAS
       * ======================================================
       */

      const usarDuasColunasMarelli =
        ehPaginaBicosMarelliDuasColunas({
          numeroPagina,

          itens:
            itensTexto,
        });

      let texto =
        usarDuasColunasMarelli
          ? organizarItensTextoDuasColunas(
              itensTexto
            )
          : organizarItensTexto(
              itensTexto
            );

      if (
        usarDuasColunasMarelli
      ) {
        console.log(
          `💉 Página ${numeroPagina}: leitura Marelli em duas colunas.`
        );
      }

      const suficiente =
        textoPareceSuficiente(
          texto
        );

      if (
        !suficiente
      ) {
        const textoOcr =
          await extrairTextoOcr({
            pagina,

            numeroPagina,

            onProgresso,
          });

        if (
          textoOcr &&
          textoOcr.length >
            texto.length
        ) {
          texto =
            textoOcr;

          console.log(
            `✅ Página ${numeroPagina}: OCR utilizado.`
          );
        } else {
          console.log(
            `ℹ️ Página ${numeroPagina}: mantido texto PDF.js.`
          );
        }
      } else {
        console.log(
          `📄 Página ${numeroPagina}: texto PDF.js suficiente.`
        );
      }

     if (
  numeroPagina ===
  27
) {
  console.log(
    "🔎 TEXTO FINAL PÁGINA 27:",
    texto
  );
}

/*
 * ======================================================
 * DIAGNÓSTICO MARELLI — LOCALIZAR IWP099
 * ======================================================
 */

if (
  String(texto || "")
    .toUpperCase()
    .includes("IWP099")
) {
  console.log(
    "🎯 IWP099 ENCONTRADO NA PÁGINA:",
    numeroPagina
  );

  console.log(
    "💉 TEXTO COMPLETO DA PÁGINA IWP099:",
    texto
  );
}

      paginas.push({
        numeroPagina,

        pagina:
          numeroPagina,

        texto,

        conteudo:
          texto,
      });
    } catch (
      erro
    ) {
      console.error(
        `❌ Erro ao processar página ${numeroPagina}:`,
        erro
      );

      paginas.push({
        numeroPagina,

        pagina:
          numeroPagina,

        texto:
          "",

        conteudo:
          "",

        erro:
          String(
            erro?.message ||
              erro
          ),
      });
    } finally {
      try {
        pagina
          ?.cleanup
          ?.();
      } catch {
        // Ignora cleanup.
      }
    }
  }

  return paginas;
}

/*
 * ============================================================
 * EXTRAI FAIXA
 * ============================================================
 */

export async function extrairFaixaPdf({
  arquivo,
  paginaInicial = 1,
  paginaFinal,
  tipo = "catálogo",
  onProgresso,
}) {
  const paginas =
    await extrairPaginasPdf({
      arquivo,

      paginaInicial,

      paginaFinal,

      tipo,

      onProgresso,
    });

  return paginas
    .map(
      (pagina) =>
        [
          `--- PÁGINA ${pagina.numeroPagina} ---`,

          pagina.texto,
        ].join(
          "\n"
        )
    )
    .join(
      "\n\n"
    );
}