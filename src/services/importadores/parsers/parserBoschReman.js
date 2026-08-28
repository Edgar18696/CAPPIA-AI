import enriquecerRegistro from "../../inteligencia/enriquecerRegistro";

function limparTexto(valor = "") {
  return String(valor)
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizarCodigo(valor = "") {
  return limparTexto(valor)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function separarPaginas(texto = "") {
  const partes = String(texto).split(
    /---\s*PÁGINA\s+(\d+)\s*---/i
  );

  const paginas = [];

  for (
    let indice = 1;
    indice < partes.length;
    indice += 2
  ) {
    paginas.push({
      numeroPagina:
        Number(partes[indice]) || 1,
      texto: partes[indice + 1] || "",
    });
  }

  if (paginas.length === 0) {
    paginas.push({
      numeroPagina: 1,
      texto: String(texto),
    });
  }

  return paginas;
}

function extrairCodigosBosch(texto = "") {
  const encontrados = String(texto).match(
    /\b(?:0\s*445\s*12\d\s*\d{3}|0\s*986\s*43\d\s*\d{3})\b/gi
  );

  if (!encontrados) {
    return [];
  }

  return [
    ...new Set(
      encontrados.map(normalizarCodigo)
    ),
  ];
}

function identificarMontadora(texto = "") {
  const conteudo =
    limparTexto(texto).toUpperCase();

  const marcas = [
    ["MERCEDES-BENZ", "Mercedes-Benz"],
    ["MERCEDES BENZ", "Mercedes-Benz"],
    ["VOLKSWAGEN", "Volkswagen"],
    ["IVECO", "Iveco"],
    ["SCANIA", "Scania"],
    ["VOLVO", "Volvo"],
    ["FORD", "Ford"],
    ["FIAT", "Fiat"],
    ["RENAULT", "Renault"],
    ["MAN", "MAN"],
    ["CUMMINS", "Cummins"],
    ["AGRALE", "Agrale"],
  ];

  for (const [termo, marca] of marcas) {
    if (conteudo.includes(termo)) {
      return marca;
    }
  }

  return null;
}

function extrairAnos(texto = "") {
  const anos = String(texto).match(
    /\b(?:19|20)\d{2}\b/g
  );

  if (!anos?.length) {
    return {
      ano_inicio: null,
      ano_fim: null,
    };
  }

  const numeros = anos
    .map(Number)
    .filter(Boolean)
    .sort((a, b) => a - b);

  return {
    ano_inicio:
      numeros[0] || null,
    ano_fim:
      numeros.length > 1
        ? numeros[numeros.length - 1]
        : null,
  };
}

function removerDuplicados(registros = []) {
  const mapa = new Map();

  registros.forEach((registro) => {
    const chave = [
      registro.codigo_oem,
      registro.codigo_equivalente,
      registro.montadora,
      registro.modelo,
      registro.pagina_catalogo,
    ].join("|");

    if (!mapa.has(chave)) {
      mapa.set(chave, registro);
    }
  });

  return Array.from(mapa.values());
}
function identificarMotorReman(
  texto = ""
) {
  const conteudo =
    limparTexto(texto);

  const padroes = [
    /\bOM\s*\d{3,4}(?:\s*[A-Z]{1,3})?\b/i,

    /\bCUMMINS(?:\s+ISF|\s+ISB|\s+ISC|\s+ISL|\s+ISX)?(?:\s+\d\.\d)?\b/i,

    /\bMWM(?:\s+SPRINT)?(?:\s+\d\.\d)?\b/i,

    /\bPOWER\s*STROKE(?:\s+\d\.\d)?\b/i,

    /\bDURATORQ(?:\s+\d\.\d)?\b/i,

    /\bMAXION(?:\s+\d\.\d)?\b/i,

    /\bFPT(?:\s+\d\.\d)?\b/i,

    /\b\d\.\d\s*(?:TDI|CDI|HDi|JTD|dCi|CRDi|TDCi|D-4D|DI-D)\b/i,

    /\b\d\.\d\s*(?:V6|V8)\b/i,

    /\b\d\.\d\s*(?:TURBO\s*)?DIESEL\b/i,
  ];

  for (const padrao of padroes) {
    const encontrado =
      conteudo.match(padrao);

    if (encontrado) {
      return limparTexto(
        encontrado[0]
      );
    }
  }

  return null;
}
function criarRegistro({
  codigoPrincipal,
  equivalentes = [],
  linha,
  pagina,
  origemCatalogo,
  montadora,
}) {
  const anos = extrairAnos(linha);

  return {
    peca:
      "Injetor Diesel Common Rail Remanufaturado",

    codigo_oem: codigoPrincipal,

    codigo_equivalente:
      equivalentes.length > 0
        ? equivalentes.join(" | ")
        : null,

    fabricante: "Bosch",

    origem_catalogo:
      origemCatalogo,

    montadora:
      montadora || null,

    modelo:
      limparTexto(linha) || null,

motor:
  identificarMotorReman(
    linha
  ),
    ano_inicio:
      anos.ano_inicio,

    ano_fim:
      anos.ano_fim,

    observacao:
      `Página ${pagina}. Catálogo Bosch Reman CRIN HPC. ${limparTexto(
        linha
      )}`,

    pagina_catalogo:
      pagina,

    ativo: true,

    prioridade: 1,

    confiabilidade: 95,
  };
}

export function parserBoschReman({
  textoAplicacoes = "",
  configuracao = {},
  nomeArquivo = "",
  onProgresso,
} = {}) {
  const origemCatalogo =
    configuracao.origemCatalogo ||
    nomeArquivo ||
    "Bosch Diesel Reman CRIN HPC 2020";

  const paginas =
    separarPaginas(textoAplicacoes);

  const registros = [];

  let montadoraAtual = null;

  onProgresso?.(
    "♻️ Interpretando catálogo Bosch Reman CRIN HPC..."
  );

  paginas.forEach((pagina) => {
    const linhas = String(
      pagina.texto || ""
    )
      .split(/\r?\n/)
      .map(limparTexto)
      .filter(Boolean);

    linhas.forEach((linha) => {
      const montadora =
        identificarMontadora(linha);

      if (montadora) {
        montadoraAtual = montadora;
      }

      const codigos =
        extrairCodigosBosch(linha);

      if (codigos.length < 2) {
        return;
      }

      const codigoNovo =
        codigos.find((codigo) =>
          codigo.startsWith("0445")
        ) || codigos[0];

      const codigosReman =
        codigos.filter(
          (codigo) =>
            codigo !== codigoNovo
        );

      registros.push(
        criarRegistro({
          codigoPrincipal:
            codigoNovo,
          equivalentes:
            codigosReman,
          linha,
          pagina:
            pagina.numeroPagina,
          origemCatalogo,
          montadora:
            montadoraAtual,
        })
      );

      codigosReman.forEach(
        (codigoReman) => {
          registros.push(
            criarRegistro({
              codigoPrincipal:
                codigoReman,
              equivalentes: [
                codigoNovo,
                ...codigosReman.filter(
                  (codigo) =>
                    codigo !==
                    codigoReman
                ),
              ],
              linha,
              pagina:
                pagina.numeroPagina,
              origemCatalogo,
              montadora:
                montadoraAtual,
            })
          );
        }
      );
    });
  });

  const registrosUnicos =
    removerDuplicados(registros);

  onProgresso?.(
    `✅ ${registrosUnicos.length} registros Bosch Reman encontrados.`
  );

 return registrosUnicos.map(
  (registro) =>
    enriquecerRegistro(registro)
);
}

export default parserBoschReman;