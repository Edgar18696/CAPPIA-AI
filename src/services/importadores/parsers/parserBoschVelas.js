function limparTexto(valor = "") {
  return String(valor)
    .replace(/\s+/g, " ")
    .trim();
}

function normalizarCodigo(valor = "") {
  return String(valor)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function extrairPagina(linha = "") {
  const resultado = linha.match(
    /^---\s*PÁGINA\s+(\d+)\s*---$/i
  );

  return resultado
    ? Number(resultado[1])
    : null;
}

function extrairCodigosVela(linha = "") {
  const codigosNumericos = [];
  const codigosComerciais = [];
  const tipoPorCodigo = new Map();

  const padroesBosch = [
    {
      re: /\bF\s*000\s*KE[A-Z0-9]\s*[A-Z]?\s*\d{2,4}\b/gi,
      tipo: "vela",
    },
    {
      re: /\b0\s*242\s*\d{3}\s*\d{3}(?:\s*-\s*\d+)?\b/gi,
      tipo: "vela",
    },
    {
      re: /\b0\s*241\s*\d{3}\s*\d{3}(?:\s*-\s*\d+)?\b/gi,
      tipo: "vela",
    },
    {
      re: /\bF\s*000\s*ZS[A-Z0-9]?\s*\d{3,4}\b/gi,
      tipo: "bobina",
    },
    {
      re: /\b0\s*221\s*\d{3}\s*\d{3}\b/gi,
      tipo: "bobina",
    },
    {
      re: /\b9\s*220\s*081\s*\d{3}\b/gi,
      tipo: "bobina",
    },
    {
      re: /\bF\s*000\s*CS[A-Z0-9]?\s*\d{3,4}\b/gi,
      tipo: "cabo",
    },
    {
      re: /\bF\s*000\s*99[A-Z]\s*\d{3}\b/gi,
      tipo: "cabo",
    },
    {
      re: /\b9\s*295\s*080\s*\d{3}\b/gi,
      tipo: "cabo",
    },
  ];

  const padroesComerciais = [
    /\b(?:FGR|FR|HR|WR|YR|ZR|VR|MR|WKR|FGRT)\s*\d(?:\s*[A-Z0-9]){1,14}\b/gi,
  ];

  for (const { re, tipo } of padroesBosch) {
    const resultados = linha.match(re) || [];
    for (const resultado of resultados) {
      const codigo = normalizarCodigo(resultado);
      if (!codigo || codigosNumericos.includes(codigo)) {
        continue;
      }
      codigosNumericos.push(codigo);
      tipoPorCodigo.set(codigo, tipo);
    }
  }

  for (const padrao of padroesComerciais) {
    const resultados = linha.match(padrao) || [];
    for (const resultado of resultados) {
      const codigo = normalizarCodigo(resultado.replace(/\+$/, ""));
      if (!codigo || codigosComerciais.includes(codigo)) {
        continue;
      }
      if (codigosNumericos.includes(codigo)) {
        continue;
      }
      codigosComerciais.push(codigo);
      tipoPorCodigo.set(codigo, "vela");
    }
  }

  return {
    codigosNumericos,
    codigosComerciais,
    tipoPorCodigo,
  };
}

function tipoPecaPorCodigo(codigo, tipoPorCodigo) {
  const tipo = tipoPorCodigo.get(codigo) || "vela";
  if (tipo === "bobina") {
    return "Bobina de Ignição";
  }
  if (tipo === "cabo") {
    return "Cabo de Ignição";
  }
  return "Vela de Ignição";
}

function linhaEhCabecalho(linha = "") {
  return (
    /Autopeças Bosch/i.test(linha) ||
    /Nº da Vela/i.test(linha) ||
    /Observação Vela/i.test(linha) ||
    /Código Simplificado/i.test(linha) ||
    /Data de aplicação/i.test(linha) ||
    /A lista completa de observações/i.test(
      linha
    ) ||
    /^c[oó]digo$/i.test(linha) ||
    /^n[uú]mero da vela$/i.test(linha) ||
    /^mm$/i.test(linha) ||
    /Cil\.\s*Valv/i.test(linha) ||
    /Potência\s*\(cv\)/i.test(linha)
  );
}

const ALIASES_MONTADORA = [
  ["HAFEI (SONGHUAJIANG)", "HAFEI"],
  ["JAC (JIANGHUAI AUTOMOBILE)", "JAC"],
  ["SAAB (SAAB AUTOMOBILE AB)", "SAAB"],
  ["ASIA (ASIA MOTORS)", "ASIA (ASIA MOTORS)"],
  ["VW (VOLKSWAGEN)", "VOLKSWAGEN"],
  ["MINI (BMW)", "MINI"],
  ["SMART (MCC)", "SMART"],
  ["LAND ROVER GROUP", "LAND ROVER"],
  ["EFFA MOTORS", "EFFA MOTORS"],
  ["ALFA ROMEO", "ALFA ROMEO"],
  ["MERCEDES-BENZ", "MERCEDES-BENZ"],
  ["MERCEDES BENZ", "MERCEDES-BENZ"],
  ["ROLLS-ROYCE", "ROLLS-ROYCE"],
  ["VOLKSWAGEN", "VOLKSWAGEN"],
  ["MITSUBISHI", "MITSUBISHI"],
  ["CHEVROLET", "CHEVROLET"],
  ["CHRYSLER", "CHRYSLER"],
  ["CADILLAC", "CADILLAC"],
  ["MASERATI", "MASERATI"],
  ["SSANGYONG", "SSANGYONG"],
  ["DAIHATSU", "DAIHATSU"],
  ["FERRARI", "FERRARI"],
  ["HYUNDAI", "HYUNDAI"],
  ["PEUGEOT", "PEUGEOT"],
  ["PORSCHE", "PORSCHE"],
  ["RENAULT", "RENAULT"],
  ["CITROËN", "CITROEN"],
  ["CITROEN", "CITROEN"],
  ["AVTOVAZ", "AVTOVAZ"],
  ["BENTLEY", "BENTLEY"],
  ["DAEWOO", "DAEWOO"],
  ["JAGUAR", "JAGUAR"],
  ["JINBEI", "JINBEI"],
  ["MERCURY", "MERCURY"],
  ["NISSAN", "NISSAN"],
  ["SUBARU", "SUBARU"],
  ["SUZUKI", "SUZUKI"],
  ["TOYOTA", "TOYOTA"],
  ["TROLLER", "TROLLER"],
  ["AGRALE", "AGRALE"],
  ["CHANA", "CHANA"],
  ["CHERY", "CHERY"],
  ["DODGE", "DODGE"],
  ["GEELY", "GEELY"],
  ["GURGEL", "GURGEL"],
  ["HAIMA", "HAIMA"],
  ["HONDA", "HONDA"],
  ["LEXUS", "LEXUS"],
  ["MAZDA", "MAZDA"],
  ["MIURA", "MIURA"],
  ["VOLVO", "VOLVO"],
  ["ASIA MOTORS", "ASIA (ASIA MOTORS)"],
  ["LAND ROVER", "LAND ROVER"],
  ["AUDI", "AUDI"],
  ["FIAT", "FIAT"],
  ["FORD", "FORD"],
  ["JEEP", "JEEP"],
  ["LADA", "LADA"],
  ["SEAT", "SEAT"],
  ["BMW", "BMW"],
  ["IVECO", "IVECO"],
  ["MINI", "MINI"],
  ["SAAB", "SAAB"],
  ["KIA", "KIA"],
  ["JAC", "JAC"],
  ["PUMA", "PUMA"],
  ["SMART", "SMART"],
  ["VW", "VOLKSWAGEN"],
  ["MG", "MG"],
].sort((a, b) => b[0].length - a[0].length);

function partirMontadorasCabecalho(texto = "") {
  const partes = [];
  let atual = "";
  let profundidade = 0;
  for (const ch of String(texto)) {
    if (ch === "(") profundidade += 1;
    if (ch === ")") profundidade = Math.max(0, profundidade - 1);
    if (ch === "," && profundidade === 0) {
      if (atual.trim()) partes.push(atual.trim());
      atual = "";
      continue;
    }
    atual += ch;
  }
  if (atual.trim()) partes.push(atual.trim());
  return partes;
}

function canonizarMontadora(valor = "") {
  const texto = limparTexto(valor).toUpperCase();
  if (!texto) return "";
  const alias = ALIASES_MONTADORA.find(
    ([origem]) => origem === texto
  );
  return alias ? alias[1] : "";
}

function montadorasDoBanner(linha = "") {
  const texto = limparTexto(linha);
  const banner = texto.match(/^B\d+\s*\|\s*(.+)$/i);
  if (!banner) return [];
  return partirMontadorasCabecalho(banner[1])
    .map(canonizarMontadora)
    .filter(Boolean);
}

function identificarMontadoraLinha(linha = "") {
  if (!linha || linhaEhCabecalho(linha)) {
    return null;
  }

  const doBanner = montadorasDoBanner(linha);
  if (doBanner.length === 1) {
    return { nome: doBanner[0], origem: "banner" };
  }
  if (doBanner.length > 1) {
    return { nome: doBanner[0], origem: "banner_multi", lista: doBanner };
  }

  const nome = canonizarMontadora(linha);
  if (!nome) return null;
  if (limparTexto(linha).includes(",")) return null;
  return { nome, origem: "linha" };
}

function linhaPareceMontadora(linha = "") {
  return Boolean(identificarMontadoraLinha(linha));
}

function normalizarNomeMontadora(linha = "") {
  return identificarMontadoraLinha(linha)?.nome || limparTexto(linha);
}

const OBSERVACOES_TECNICAS = new Set([
  "NGK",
  "NTK",
  "BOSCH",
  "CHAMPION",
  "DENSO",
  "BERU",
  "ELD",
  "ELG",
  "ELK",
  "DOV",
  "DOZ",
  "BO",
  "XJB",
  "XJC",
  "WW",
  "TSZ",
  "CEC",
  "FE",
  "GS",
  "ZE",
  "AG",
  "Y03",
  "WI3",
  "WI5",
  "EAT",
  "GNV",
  "GASOLINA",
  "DIESEL",
  "FLEX",
  "ALCOOL",
  "ÁLCOOL",
]);

const NAO_E_MODELO = [...OBSERVACOES_TECNICAS];

function linhaEhObservacaoTecnica(linha = "") {
  const texto = limparTexto(linha);
  if (!texto || texto.length > 40) return false;
  if (/Ignição dupla|elétrodos|bobina de ignição/i.test(texto)) {
    return true;
  }
  const tokens = texto
    .split(/[,;/|]+/)
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);
  return (
    tokens.length > 0 &&
    tokens.every((t) => OBSERVACOES_TECNICAS.has(t))
  );
}

function modeloVeiculoValido(valor = "") {
  const modelo = limparTexto(valor);
  if (!modelo || modelo.length < 2) {
    return "";
  }

  const chave = modelo.toUpperCase();
  if (NAO_E_MODELO.includes(chave) || linhaEhObservacaoTecnica(modelo)) {
    return "";
  }
  if (/^SP\s*\d+$/i.test(modelo)) {
    return "";
  }
  if (/^c[oó]digo$/i.test(modelo)) {
    return "";
  }
  if (
    /F\s*000|0\s*22[12]|9\s*220|9\s*295|0\s*242/i.test(modelo)
  ) {
    return "";
  }
  const { codigosNumericos, codigosComerciais } =
    extrairCodigosVela(modelo);
  if (codigosNumericos.length || codigosComerciais.length) {
    return "";
  }
  if (linhaPareceMontadora(modelo)) {
    return "";
  }

  return modelo;
}

function linhaPareceModelo(linha = "") {
  const {
    codigosNumericos,
    codigosComerciais,
  } = extrairCodigosVela(linha);

  if (
    !linha ||
    linha.length > 60 ||
    linha.length < 2 ||
    linhaEhCabecalho(linha) ||
    linhaEhObservacaoTecnica(linha) ||
    /^c[oó]digo$/i.test(linha) ||
    /^sp\s*\d+$/i.test(linha) ||
    /^n[uú]mero$/i.test(linha) ||
    linhaPareceMontadora(linha) ||
    !modeloVeiculoValido(linha) ||
    codigosNumericos.length > 0 ||
    codigosComerciais.length > 0 ||
    /\d{2}\.\d{2}/.test(linha) ||
    /Gasolina|Álcool|Flex|Diesel|Híbrido|GNV/i.test(
      linha
    )
  ) {
    return false;
  }

  return (
    /^\d{2,4}(?:\s*\/\s*\d{2,4})?$/.test(linha) ||
    /^[A-ZÀ-Ú][A-Za-zÀ-ÿ0-9 .()/+-]+$/.test(linha)
  );
}

function motorValido(item = "") {
  const motor = limparTexto(item);
  if (!motor || motor.length < 2) return false;
  const chave = motor.toUpperCase().replace(/\s+/g, "");
  if (OBSERVACOES_TECNICAS.has(motor.toUpperCase()) || OBSERVACOES_TECNICAS.has(chave)) {
    return false;
  }
  if (/^SP\d+$/i.test(chave)) return false;
  if (/^P\d{2,4}$/i.test(chave)) return false;
  if (/^KE0|^ZS0|^99C|^CS0/i.test(chave)) return false;
  if (/^WI\d/i.test(chave)) return false;
  if (/^\d+V$/i.test(chave)) return false;
  if (/^F000/i.test(chave)) return false;
  if (/^0\d{9,}$/i.test(chave)) return false;
  if (!/[A-Z]/i.test(motor) || !/\d|<|\./.test(motor)) return false;
  return true;
}

function extrairMotor(linha = "") {
  const antesDaData =
    linha.split(
      /\b\d{2}\.\d{2}\s*(?:►||→|-)/i
    )[0] || "";

  const textoMotor = antesDaData.replace(
    /\bM\s+(\d)/gi,
    "M$1"
  );

  const candidatos =
    textoMotor.match(
      /(?:[A-Z0-9.-]+(?:<[^>]+>)?|\([A-Z0-9 .-]+\))+/g
    ) || [];

  const validos = candidatos
    .map(limparTexto)
    .filter(motorValido);

  return validos.length
    ? validos[validos.length - 1]
    : "";
}

function extrairAnos(linha = "") {
  const datas = [
    ...linha.matchAll(
      /\b(\d{2})\.(\d{2})\b/g
    ),
  ];

  if (!datas.length) {
    return {
      anoInicio: null,
      anoFim: null,
    };
  }

  const converterAno = (ano) => {
    const numero = Number(ano);

    return numero <= 30
      ? 2000 + numero
      : 1900 + numero;
  };

  return {
    anoInicio: converterAno(
      datas[0][2]
    ),

    anoFim:
      datas.length >= 2
        ? converterAno(
            datas[datas.length - 1][2]
          )
        : null,
  };
}

export async function parserBoschVelas({
  textoAplicacoes = "",
  nomeArquivo = "",
  onProgresso,
}) {
  onProgresso?.(
    "🧠 Executando parser Bosch Velas..."
  );

  const linhas = String(textoAplicacoes)
    .replace(/\r/g, "")
    .split("\n")
    .map(limparTexto)
    .filter(Boolean);

  const registros = [];
  const chavesUnicas = new Set();
  const relatorio = {
    rejeitados_sem_montadora: 0,
    observacoes_anexadas: 0,
    trocas_montadora: 0,
  };

  let paginaAtual = null;
  let montadoraAtual = "";
  let modeloAtual = "";
  let ultimosIndices = [];

  for (const linha of linhas) {
    const paginaEncontrada =
      extrairPagina(linha);

    if (paginaEncontrada) {
      paginaAtual = paginaEncontrada;
      continue;
    }

    if (linhaEhCabecalho(linha)) {
      continue;
    }

    const montadoraLinha = identificarMontadoraLinha(linha);
    if (montadoraLinha?.nome) {
      montadoraAtual = montadoraLinha.nome;
      modeloAtual = "";
      ultimosIndices = [];
      relatorio.trocas_montadora += 1;
      continue;
    }

    const {
      codigosNumericos,
      codigosComerciais,
      tipoPorCodigo,
    } = extrairCodigosVela(linha);

    if (
      linhaEhObservacaoTecnica(linha) &&
      codigosNumericos.length === 0 &&
      codigosComerciais.length === 0
    ) {
      if (ultimosIndices.length) {
        for (const indice of ultimosIndices) {
          const atual = registros[indice].observacao || "";
          if (!atual.split(/\s*\|\s*/).includes(linha)) {
            registros[indice].observacao = atual
              ? `${atual} | ${linha}`
              : linha;
          }
        }
        relatorio.observacoes_anexadas += 1;
      }
      continue;
    }

    if (linhaPareceModelo(linha)) {
      modeloAtual = modeloVeiculoValido(linha);
      ultimosIndices = [];
      continue;
    }

    if (
      codigosNumericos.length === 0 &&
      codigosComerciais.length === 0
    ) {
      continue;
    }

    if (!montadoraAtual) {
      relatorio.rejeitados_sem_montadora += 1;
      continue;
    }

    const modelo = modeloVeiculoValido(modeloAtual);

    const continuacaoCodigo =
      /^(?:FGR|FR|HR|WR|YR|ZR|VR|MR|WKR|FQR|FQ|UR|Y)\s*\d/i.test(linha) ||
      /^F\s*000/i.test(linha) ||
      /^0\s*22[12]/i.test(linha) ||
      /^0\s*24[12]/i.test(linha);

    const motor = continuacaoCodigo ? "" : extrairMotor(linha);

    const {
      anoInicio,
      anoFim,
    } = extrairAnos(linha);

    const todosCodigos = [
      ...new Set([...codigosComerciais, ...codigosNumericos]),
    ];

    const codigosPrincipais =
      codigosComerciais.length > 0
        ? codigosComerciais
        : codigosNumericos;

    const indicesDestaLinha = [];

    for (const codigo of codigosPrincipais) {
      const equivalentes = todosCodigos.filter(
        (item) => item !== codigo
      );

      const chave = [
        codigo,
        equivalentes.join(","),
        montadoraAtual,
        modelo,
        motor,
        anoInicio || "",
        anoFim || "",
        linha,
      ].join("|");

      if (chavesUnicas.has(chave)) {
        continue;
      }

      chavesUnicas.add(chave);

      registros.push({
        codigo_oem: codigo,
        codigo_equivalente: equivalentes.join(", "),
        peca: tipoPecaPorCodigo(codigo, tipoPorCodigo),
        fabricante: "Bosch",
        origem_catalogo:
          nomeArquivo ||
          "Catálogo Bosch Velas, Cabos e Bobinas 2019-2020",
        montadora: montadoraAtual,
        modelo: modelo || null,
        motor,
        ano_inicio: anoInicio,
        ano_fim: anoFim,
        aplicacao: linha,
        observacao: linha,
        pagina_catalogo: paginaAtual,
      });
      indicesDestaLinha.push(registros.length - 1);

      for (const extra of equivalentes) {
        const chaveExtra = [
          extra,
          codigo,
          montadoraAtual,
          modelo,
          motor,
          anoInicio || "",
          anoFim || "",
          linha,
        ].join("|");
        if (chavesUnicas.has(chaveExtra)) {
          continue;
        }
        chavesUnicas.add(chaveExtra);
        registros.push({
          codigo_oem: extra,
          codigo_equivalente: [codigo, ...equivalentes.filter((item) => item !== extra)].join(", "),
          peca: tipoPecaPorCodigo(extra, tipoPorCodigo),
          fabricante: "Bosch",
          origem_catalogo:
            nomeArquivo ||
            "Catálogo Bosch Velas, Cabos e Bobinas 2019-2020",
          montadora: montadoraAtual,
          modelo: modelo || null,
          motor,
          ano_inicio: anoInicio,
          ano_fim: anoFim,
          aplicacao: linha,
          observacao: linha,
          pagina_catalogo: paginaAtual,
        });
        indicesDestaLinha.push(registros.length - 1);
      }
    }

    ultimosIndices = indicesDestaLinha;
  }

  const codigosUnicos = new Set(
    registros.map(
      (registro) =>
        registro.codigo_oem
    )
  );

  onProgresso?.(
    `✅ ${registros.length} aplicações de velas encontradas — ${codigosUnicos.size} códigos únicos.`
  );

  console.log(
    "Parser Bosch Velas:",
    registros.length,
    "aplicações;",
    codigosUnicos.size,
    "códigos únicos."
  );

  registros.relatorioParser = relatorio;
  return registros;
}