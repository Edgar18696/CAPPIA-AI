import {
  TIPO_REFERENCIA_APLICACAO,
  TIPO_REFERENCIA_NOTA,
  pareceLinhaNotaTecnica,
  montarRegistroNotaTecnica,
} from "../referenciaTecnica.js";

function limparTexto(valor) {
  return String(valor || "")
    .replace(/\r/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizar(valor) {
  return limparTexto(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function separarLinhas(texto) {
  return String(texto || "")
    .split(/\r?\n/)
    .map(limparTexto)
    .filter(Boolean);
}

function limparCodigo(valor) {
  return String(valor || "")
    .replace(/\s+/g, "")
    .replace(/\(\d+\)/g, "")
    .replace(/[^A-Z0-9]/gi, "")
    .toUpperCase()
    .trim();
}

function formatarCodigoBosch(valor) {
  const codigo = limparCodigo(valor);

  if (/^F000(TE|DR|KP)[A-Z0-9]{4}$/.test(codigo)) {
    return [
      codigo.slice(0, 1),
      codigo.slice(1, 4),
      codigo.slice(4, 7),
      codigo.slice(7),
    ].join(" ");
  }

  if (/^(0580|0280)\d{6}$/.test(codigo) || /^1\d{9}$/.test(codigo)) {
    return [
      codigo.slice(0, 1),
      codigo.slice(1, 4),
      codigo.slice(4, 7),
      codigo.slice(7),
    ].join(" ");
  }

  return codigo;
}

function extrairPagina(linha) {
  const resultado = String(linha || "").match(
    /^---\s*PÁGINA\s+(\d+)\s*---$/i
  );

  return resultado ? Number(resultado[1]) : null;
}

const MONTADORAS = [
  "ALFA ROMEO",
  "ASIA MOTORS",
  "AUDI",
  "BMW",
  "CHEVROLET",
  "CHERY",
  "CHRYSLER",
  "CITROEN",
  "CITROËN",
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
  "MERCEDES-BENZ",
  "MERCEDES BENZ",
  "MITSUBISHI",
  "NISSAN",
  "PEUGEOT",
  "PORSCHE",
  "RENAULT",
  "SEAT",
  "SUBARU",
  "SUZUKI",
  "TOYOTA",
  "VOLKSWAGEN",
  "VW",
  "VW (VOLKSWAGEN)",
  "VOLVO",
];

function identificarMontadora(linha) {
  const texto = normalizar(linha);

  const montadora = MONTADORAS.find((item) => {
    const nome = normalizar(item);

    return texto === nome;
  });

  if (!montadora) {
    return "";
  }

  if (
    normalizar(montadora) === "VW" ||
    normalizar(montadora) === "VW (VOLKSWAGEN)"
  ) {
    return "Volkswagen";
  }

  if (
    normalizar(montadora) === "MERCEDES BENZ"
  ) {
    return "Mercedes-Benz";
  }

  return montadora;
}

const PADRAO_F000TE =
  /\bF\s*000\s*TE[A-Z0-9]\s*[A-Z0-9]{3}\b/gi;
const PADRAO_0580 =
  /\b(?:0\s*)?580\s*\d{3}\s*\d{3}\b|\b0580\d{6}\b/gi;
const PADRAO_0280 =
  /\b0\s*280\s*\d{3}\s*\d{3}\b/gi;
// Regulador de pressão (F 000 DR0 206) e bomba da tabela INMETRO (F 000 KP0 016):
// antes não eram reconhecidos e esses códigos nunca entravam na base.
const PADRAO_F000DR =
  /\bF\s*000\s*DR[A-Z0-9]\s*[A-Z0-9]{3}\b/gi;
const PADRAO_F000KP =
  /\bF\s*000\s*KP[A-Z0-9]\s*[A-Z0-9]{3}\b/gi;
const PADRAO_BOSCH_10 =
  /\b1\s*\d{3}\s*\d{3}\s*\d{3}\b|\b1\d{9}\b/g;
const PADRAO_OEM =
  /\b\d{7,10}[A-Z]?\b/g;
const PADRAO_OEM_MONTADORA =
  /\b[A-Z0-9]{0,2}[A-Z][A-Z0-9]{0,2}\s+\d{3}\s+\d{3}(?:\s+[A-Z]\b)?/gi;

function coletarPadrao(linha, padrao) {
  return Array.from(
    new Set(
      (String(linha || "").match(padrao) || [])
        .map((codigo) => formatarCodigoBosch(codigo))
        .map(limparCodigo)
        .filter(Boolean)
    )
  );
}

function ehMedidaOuDataOuNota(token) {
  const texto = String(token || "");
  const compacto = limparCodigo(texto);
  if (!compacto) return true;
  if (/^(2019|2020|2011|1999|301)$/.test(compacto)) return true;
  if (/^\d{1,4}$/.test(compacto)) return true;
  if (/\b\d{2}[./]\d{2}\b/.test(texto)) return true;
  if (/\b(?:bar|l\/h|ohm|Ω|mm)\b/i.test(texto)) return true;
  return false;
}

function extrairCodigosF000(linha) {
  return coletarPadrao(linha, PADRAO_F000TE);
}

function extrairCodigosBombas(linha) {
  return coletarPadrao(linha, PADRAO_0580).filter((codigo) =>
    /^0580\d{6}$/.test(codigo)
  );
}

function extrairCodigosRegulador(linha) {
  return [
    ...coletarPadrao(linha, PADRAO_0280),
    ...coletarPadrao(linha, PADRAO_F000DR),
  ];
}

function extrairCodigosF000DR(linha) {
  return coletarPadrao(linha, PADRAO_F000DR);
}

function extrairCodigosF000KP(linha) {
  return coletarPadrao(linha, PADRAO_F000KP);
}

function extrairCodigosBosch10(linha) {
  return coletarPadrao(linha, PADRAO_BOSCH_10).filter((codigo) =>
    /^1\d{9}$/.test(codigo)
  );
}

function extrairCodigosOem(linha) {
  const semConhecidos = String(linha || "")
    .replace(PADRAO_F000TE, " ")
    .replace(PADRAO_0580, " ")
    .replace(PADRAO_0280, " ")
      .replace(PADRAO_F000DR, " ")
      .replace(PADRAO_F000KP, " ")
    .replace(PADRAO_BOSCH_10, " ")
    .replace(/\b\d{2}[./]\d{2}\b/g, " ")
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:bar|l\/h|Ω)\b/gi, " ");

  const numericos = (semConhecidos.match(PADRAO_OEM) || [])
    .map(limparCodigo)
    .filter((codigo) => {
      if (!codigo || ehMedidaOuDataOuNota(codigo)) return false;
      if (/^(F000TE|F000DR|F000KP|0580|0280|1\d{9})/.test(codigo) && codigo.length >= 10) {
        return false;
      }
      return /^\d{7,10}[A-Z]?$/.test(codigo);
    });

  const montadora = (String(linha || "").match(PADRAO_OEM_MONTADORA) || [])
    .map((codigo) => limparCodigo(codigo))
    .filter((codigo) => {
      if (!codigo || codigo.length < 8 || codigo.length > 12) return false;
      if (/^(F000TE|0580|0280)/.test(codigo)) return false;
      if (/^\d+$/.test(codigo)) return false;
      return /[A-Z]/.test(codigo);
    });

  return Array.from(new Set([...numericos, ...montadora]));
}

function ehCodigoDePeca(valor) {
  const compacto = limparCodigo(valor);
  if (!compacto) return false;
  if (/^F000(TE|DR|KP)[A-Z0-9]{4}$/.test(compacto)) return true;
  if (/^(0580|0280)\d{6}$/.test(compacto)) return true;
  if (/^1\d{9}$/.test(compacto)) return true;
  if (/^\d{7,10}[A-Z]?$/.test(compacto)) return true;
  return extrairTodosCodigosPeca(valor).length > 0 &&
    restoSemPecaMedida(valor).length < 3;
}

function identificarLayoutFicha(linha) {
  const texto = normalizar(linha);

  if (
    texto.includes("BOLETIM INFORMATIVO") ||
    texto.includes("NBR 15754")
  ) {
    return "BOLETIM_TESTE";
  }

  if (
    texto.includes("CONJUNTO SENSOR DE NIVEL") ||
    (texto.includes("NUMERO ORIGINAL") && texto.includes("IDENTIFICACAO"))
  ) {
    return "SENSOR_NIVEL";
  }
  if (
    texto.includes("CONJUNTO BOMBA DE COMBUSTIVEL") &&
    (texto.includes("NUMERO ORIGINAL") || texto.includes("SENSOR DE NIVEL"))
  ) {
    return "CONJUNTO_BOMBA";
  }
  if (
    texto.includes("KIT DE REPOSICAO") &&
    texto.includes("VEICULO") &&
    texto.includes("BOMBA ELETRICA")
  ) {
    return "KIT_REPOSICAO";
  }
  if (
    texto.includes("PRE-FILTRO") &&
    texto.includes("VEICULO") &&
    (texto.includes("KIT DE REPOSICAO") || texto.includes("BOMBA ELETRICA"))
  ) {
    return "PRE_FILTRO";
  }
  if (
    texto.includes("REGULADOR DE PRESSAO") &&
    texto.includes("VEICULO")
  ) {
    return "REGULADOR";
  }
  if (
    texto.includes("BOMBA ELETRICA") &&
    texto.includes("VEICULO") &&
    !texto.includes("KIT DE REPOSICAO") &&
    !texto.includes("PRE-FILTRO") &&
    !texto.includes("CONJUNTO")
  ) {
    return "BOMBA_ELETRICA";
  }
  return "";
}

function classificarCodigosRelacionados(linha, layout, principal) {
  const principalNorm = limparCodigo(principal);
  const saida = [];
  const ja = new Set();

  function adicionar(codigo, papel) {
    const compacto = limparCodigo(codigo);
    if (!compacto || compacto === principalNorm || ja.has(compacto)) {
      return;
    }
    ja.add(compacto);
    saida.push({ codigo: compacto, papel });
  }

  for (const codigo of extrairCodigosBombas(linha)) {
    adicionar(codigo, "bomba_eletrica");
  }
  for (const codigo of extrairCodigosRegulador(linha)) {
    adicionar(codigo, "regulador");
  }
  for (const codigo of extrairCodigosBosch10(linha)) {
    if (codigo.startsWith("1587")) {
      adicionar(codigo, "sensor_nivel");
    } else if (codigo.startsWith("1582")) {
      adicionar(codigo, "conjunto_sensor");
    } else {
      adicionar(codigo, "identificacao_peca");
    }
  }
  for (const codigo of extrairCodigosF000(linha)) {
    if (layout === "PRE_FILTRO" || layout === "CONJUNTO_BOMBA") {
      adicionar(codigo, "kit_reposicao");
    } else if (layout === "SENSOR_NIVEL") {
      adicionar(codigo, "kit_reposicao");
    } else {
      adicionar(codigo, "kit_reposicao");
    }
  }

  for (const codigo of extrairCodigosOem(linha)) {
    adicionar(codigo, "numero_original_oem");
  }

  return saida;
}

function extrairTodosCodigosPeca(linha) {
  return Array.from(
    new Set([
      ...extrairCodigosF000(linha),
      ...extrairCodigosBombas(linha),
      ...extrairCodigosRegulador(linha),
      ...extrairCodigosF000KP(linha),
      ...extrairCodigosBosch10(linha),
      ...extrairCodigosOem(linha),
    ])
  );
}

function temDataAplicacao(linha) {
  return /\b\d{2}[./]\d{2}\b/.test(String(linha || ""));
}

function restoSemPecaMedida(linha) {
  return limparTexto(
    String(linha || "")
      .replace(PADRAO_F000TE, " ")
      .replace(PADRAO_0580, " ")
      .replace(PADRAO_0280, " ")
      .replace(PADRAO_F000DR, " ")
      .replace(PADRAO_F000KP, " ")
      .replace(PADRAO_BOSCH_10, " ")
      .replace(PADRAO_OEM, " ")
      .replace(PADRAO_OEM_MONTADORA, " ")
      .replace(/\b\d{2}[./]\d{2}\b/g, " ")
      .replace(/[►→]/g, " ")
      .replace(/\b\d+(?:[.,]\d+)?\s*(?:bar|l\/h)\b/gi, " ")
      .replace(/\b\d+\s*Ω(?:\s*±\s*\d+\s*Ω)?/gi, " ")
      .replace(/\b(?:externo|interno)\b/gi, " ")
      .replace(/\(\d+\)/g, " ")
  );
}

function extrairCodigoProduto(linha, categoriaAtual = "", fichaAtual = null, layoutAtual = "") {
  const f000 = extrairCodigosF000(linha);
  const bombas = extrairCodigosBombas(linha);
  const conj1582 = extrairCodigosBosch10(linha).filter((c) =>
    c.startsWith("1582")
  );
  const ident1587 = extrairCodigosBosch10(linha).filter((c) =>
    c.startsWith("1587")
  );
  const oem = extrairCodigosOem(linha);
  const resto = restoSemPecaMedida(linha);
  const categoria = normalizar(categoriaAtual);
  const layout = String(layoutAtual || fichaAtual?.layout || "");
  const identificacaoPura = resto.length <= 24;

  if (temDataAplicacao(linha)) {
    return "";
  }

  if (/\bsubstitui\b/i.test(linha)) {
    return "";
  }

  if (oem.length && (f000.length || bombas.length || ident1587.length || conj1582.length)) {
    return "";
  }

  if (layout === "BOLETIM_TESTE") {
    if (bombas.length === 1 && f000.length === 0 && ident1587.length === 0) {
      return formatarCodigoBosch(bombas[0]);
    }
    const kp = extrairCodigosF000KP(linha);
    if (kp.length === 1 && bombas.length === 0 && f000.length === 0) {
      return formatarCodigoBosch(kp[0]);
    }
    return "";
  }

  if (layout === "REGULADOR" || categoria.includes("REGULADOR DE PRESSAO")) {
    const dr = extrairCodigosF000DR(linha);
    if (
      dr.length === 1 &&
      f000.length === 0 &&
      bombas.length === 0 &&
      oem.length === 0 &&
      identificacaoPura
    ) {
      return formatarCodigoBosch(dr[0]);
    }
  }

  if (
    layout === "CONJUNTO_BOMBA" ||
    categoria.includes("CONJUNTO BOMBA")
  ) {
    if (
      f000.length === 1 &&
      bombas.length === 0 &&
      oem.length === 0 &&
      ident1587.length === 0 &&
      identificacaoPura
    ) {
      return formatarCodigoBosch(f000[0]);
    }
    if (
      bombas.length === 1 &&
      f000.length === 0 &&
      oem.length === 0 &&
      ident1587.length === 0 &&
      identificacaoPura
    ) {
      return formatarCodigoBosch(bombas[0]);
    }
    if (
      conj1582.length === 1 &&
      f000.length === 0 &&
      oem.length === 0 &&
      bombas.length === 0 &&
      resto.length <= 8
    ) {
      return formatarCodigoBosch(conj1582[0]);
    }
    return "";
  }

  if (layout === "SENSOR_NIVEL" || categoria.includes("SENSOR DE NIVEL")) {
    if (
      f000.length === 1 &&
      ident1587.length === 0 &&
      oem.length === 0 &&
      bombas.length === 0 &&
      identificacaoPura
    ) {
      return formatarCodigoBosch(f000[0]);
    }
    return "";
  }

  if (
    layout === "KIT_REPOSICAO" ||
    categoria.includes("KIT DE REPOSICAO")
  ) {
    if (
      f000.length === 1 &&
      oem.length === 0 &&
      ident1587.length === 0 &&
      identificacaoPura
    ) {
      return formatarCodigoBosch(f000[0]);
    }
    return "";
  }

  if (
    layout === "BOMBA_ELETRICA" ||
    categoria.includes("BOMBA ELETRICA")
  ) {
    if (
      bombas.length === 1 &&
      f000.length === 0 &&
      oem.length === 0 &&
      ident1587.length === 0 &&
      identificacaoPura
    ) {
      return formatarCodigoBosch(bombas[0]);
    }
    return "";
  }

  if (
    f000.length === 1 &&
    oem.length === 0 &&
    ident1587.length === 0 &&
    resto.length <= 24
  ) {
    return formatarCodigoBosch(f000[0]);
  }

  if (
    conj1582.length === 1 &&
    f000.length === 0 &&
    oem.length === 0 &&
    resto.length <= 8
  ) {
    return formatarCodigoBosch(conj1582[0]);
  }

  if (
    bombas.length === 1 &&
    f000.length === 0 &&
    oem.length === 0 &&
    ident1587.length === 0 &&
    resto.length <= 24 &&
    (categoria.includes("BOMBA ELETRICA") ||
      categoria.includes("CONJUNTO BOMBA"))
  ) {
    return formatarCodigoBosch(bombas[0]);
  }

  if (
    !fichaAtual?.principal &&
    f000[0]
  ) {
    return formatarCodigoBosch(f000[0]);
  }

  if (!fichaAtual?.principal && conj1582[0] && resto.length <= 8) {
    return formatarCodigoBosch(conj1582[0]);
  }

  return "";
}

function extrairEspecificacoes(linha) {
  const pressao = String(linha || "").match(
    /\b\d+(?:[.,]\d+)?\s*bar\b/i
  );

  const vazao = String(linha || "").match(
    /\b\d+(?:[.,]\d+)?\s*l\/h\b/i
  );

  return {
    pressao: pressao
      ? limparTexto(pressao[0])
      : "",

    vazao: vazao
      ? limparTexto(vazao[0])
      : "",
  };
}

function extrairPeriodo(linha) {
  const texto = String(linha || "");

  const faixa = texto.match(
    /\b(\d{2})[./](\d{2})\s*[^\dA-Z]{0,5}\s*(\d{2})[./](\d{2})\b/i
  );

  if (faixa) {
    const mesInicio = Number(faixa[1]);
    const anoInicio = converterAno(faixa[2]);

    const mesFim = Number(faixa[3]);
    const anoFim = converterAno(faixa[4]);

    return {
      mes_inicio: mesInicio,
      ano_inicio: anoInicio,
      mes_fim: mesFim,
      ano_fim: anoFim,
    };
  }

  const aberto = texto.match(
    /\b(\d{2})[./](\d{2})(?!\s*[^\dA-Z]{0,5}\s*\d{2}[./]\d{2})/
  );

  if (aberto) {
    return {
      mes_inicio: Number(aberto[1]),
      ano_inicio: converterAno(aberto[2]),
      mes_fim: null,
      ano_fim: null,
    };
  }

  return {
    mes_inicio: null,
    ano_inicio: null,
    mes_fim: null,
    ano_fim: null,
  };
}

function converterAno(valor) {
  const ano = Number(valor);

  if (ano >= 70) {
    return 1900 + ano;
  }

  return 2000 + ano;
}

function removerPeriodo(texto) {
  return limparTexto(
    String(texto || "").replace(
      /\b\d{2}[./]\d{2}\s*[^\dA-Z]{0,5}\s*(?:\d{2}[./]\d{2})?/gi,
      " "
    )
  );
}

function removerCodigos(texto) {
  return limparTexto(
    String(texto || "")
      .replace(PADRAO_F000TE, " ")
      .replace(PADRAO_0580, " ")
      .replace(PADRAO_0280, " ")
      .replace(PADRAO_F000DR, " ")
      .replace(PADRAO_F000KP, " ")
      .replace(PADRAO_BOSCH_10, " ")
      .replace(PADRAO_OEM, " ")
      .replace(PADRAO_OEM_MONTADORA, " ")
  );
}

function separarModeloMotor(texto) {
  const conteudo = removerCodigos(
    removerPeriodo(texto)
  );

  const inicioMotor = conteudo.search(
    /\b\d(?:[.,]\d)\s*[A-Z0-9.-]*/i
  );

  if (inicioMotor < 0) {
    return {
      modelo: conteudo,
      motor: "",
    };
  }

  return {
    modelo: limparTexto(
      conteudo.slice(0, inicioMotor)
    ),

    motor: limparTexto(
      conteudo.slice(inicioMotor)
    ),
  };
}

function pareceCabecalho(linha) {
  if (extrairTodosCodigosPeca(linha).length > 0) {
    return false;
  }

  const texto = normalizar(linha);

  return (
    texto.includes("KIT DE REPOSICAO VEICULO") ||
    texto.includes("DATA DE APLICACAO") ||
    texto.includes("BOMBA ELETRICA VEICULO") ||
    texto.includes("PRE-FILTRO") ||
    texto.includes("NUMERO ORIGINAL") ||
    texto.includes("IDENTIFICACAO") ||
    texto.includes("CONJUNTO SENSOR DE NIVEL VEICULO") ||
    texto.includes("KITS DE REPOSICAO") ||
    texto.includes("INFORMACOES ADICIONAIS") ||
    texto.includes("AUTOPECAS BOSCH") ||
    texto.includes("BOMBAS DE COMBUSTIVEL BOSCH") ||
    texto.includes("DE ACORDO COM A PORTARIA") ||
    texto.includes("VALORES DE REFERENCIA") ||
    texto.includes("BOLETIM INFORMATIVO") ||
    (texto.includes("CERTIFICACAO NAO OBRIGATORIA") &&
      !texto.includes("SUBSTITUI"))
  );
}

function ehNotaFiltroEnsaio(linha) {
  const texto = normalizar(linha);
  return (
    texto.includes("UTILIZAR O P/N") ||
    texto.includes("MALHA DE CARACTERISTICAS") ||
    (texto.includes("ENSAIO") && texto.includes("FILTRO")) ||
    (texto.includes("NBR 15754") && texto.includes("FILTRO"))
  );
}

function proximaLinhaUtil(linhas, indice) {
  for (let j = indice + 1; j < linhas.length; j += 1) {
    if (extrairPagina(linhas[j])) continue;
    if (pareceCabecalho(linhas[j])) continue;
    return linhas[j];
  }
  return "";
}

function pareceObservacao(linha) {
  const texto = normalizar(linha);

  return (
    texto.includes("COMPATIVEL COM") ||
    texto.includes("CERTIFICACAO") ||
    texto.includes("APLICACAO ANTERIOR") ||
    texto.includes("NAO ACOMPANHA") ||
    texto.includes("INTERCAMBIAVEL") ||
    texto.includes("JET PUMP") ||
    texto.includes("COM SISTEMA DE JET") ||
    texto.includes("BOMBA DE COMBUSTIVEL COM SISTEMA")
  );
}

function textoEhNotaNaoModelo(valor) {
  const texto = normalizar(valor);

  if (!texto) {
    return false;
  }

  if (ehCodigoDePeca(valor) || ehCodigoDePeca(texto)) {
    return true;
  }

  return (
    texto.includes("JET PUMP") ||
    texto.includes("COM SISTEMA") ||
    texto.startsWith("BOMBA DE COMBUSTIVEL") ||
    texto.includes("INFORMACOES ADICIONAIS") ||
    texto.includes("NAO ACOMPANHA") ||
    /^1\s*\d{3}\s*\d{3}\s*\d{3}$/.test(texto) ||
    /^\d{7,10}[A-Z]?$/.test(texto.replace(/\s+/g, ""))
  );
}

const MARCADORES_NOTA_MESMA_LINHA = [
  /\(\d+\)\s*Bomba de combustível com sistema/i,
  /Bomba de combustível com sistema/i,
  /\bcom sistema de jet pump\b/i,
  /\bjet pump\b/i,
  /\butilizar o p\/n\b/i,
  /\bmalha de caracter/i,
  /\brefer[eê]ncia t[eé]cnica\b/i,
  /\bnota t[eé]cnica\b/i,
  /\bver nota\b/i,
];

function separarAplicacaoENotaDeLinha(linha = "") {
  const bruta = String(linha || "");
  if (!bruta) {
    return { veiculo: "", nota: "", temNota: false };
  }

  let corte = -1;
  for (const marcador of MARCADORES_NOTA_MESMA_LINHA) {
    const achado = bruta.search(marcador);
    if (achado >= 0 && (corte < 0 || achado < corte)) {
      corte = achado;
    }
  }

  if (corte > 0) {
    return {
      veiculo: limparTexto(bruta.slice(0, corte)),
      nota: limparTexto(bruta.slice(corte)),
      temNota: true,
    };
  }

  return {
    veiculo: bruta,
    nota: "",
    temNota: pareceLinhaNotaTecnica(bruta) || pareceObservacao(bruta),
  };
}

function definirTipoPeca(
  categoriaAtual,
  pressao = "",
  vazao = ""
) {
  let descricao = (
    categoriaAtual ||
    "Bomba de Combustível"
  ).trim();

  if (
    !normalizar(descricao).includes("BOSCH")
  ) {
    descricao += " Bosch";
  }

  const detalhes = [];

  if (pressao) {
    detalhes.push(pressao);
  }

  if (vazao) {
    detalhes.push(vazao);
  }

  if (detalhes.length > 0) {
    descricao += ` - ${detalhes.join(" / ")}`;
  }

  return descricao;
}
function tipoPorCodigoRelacionado(
  codigo,
  categoriaAtual,
  pressao = "",
  vazao = ""
) {
  const compacto = limparCodigo(codigo);
  if (/^0580/.test(compacto)) {
    return definirTipoPeca(
      "Bomba Elétrica de Combustível",
      pressao,
      vazao
    );
  }
  if (/^F000DR/.test(compacto)) {
    return definirTipoPeca("Regulador de Pressão de Combustível", pressao, vazao);
  }
  if (/^F000KP/.test(compacto)) {
    return definirTipoPeca("Bomba Elétrica de Combustível", pressao, vazao);
  }
  if (/^1582/.test(compacto) || /^F000TE1/.test(compacto) && compacto.length > 10) {
    return definirTipoPeca(categoriaAtual, pressao, vazao);
  }
  if (/^F000TE/.test(compacto)) {
    return definirTipoPeca(categoriaAtual, pressao, vazao);
  }
  return definirTipoPeca(categoriaAtual, pressao, vazao);
}

function identificarCategoriaCatalogo(linha) {
  const texto = normalizar(linha);

  if (texto.includes("BOLETIM INFORMATIVO") || texto.includes("NBR 15754")) {
    return "Bomba Elétrica de Combustível";
  }

  if (texto.includes("KIT DE REPOSICAO")) {
    return "Kit de Reposição da Bomba de Combustível";
  }

  if (texto.includes("CONJUNTO BOMBA DE COMBUSTIVEL")) {
    return "Conjunto Bomba de Combustível";
  }

  if (texto.includes("BOMBA ELETRICA")) {
    return "Bomba Elétrica de Combustível";
  }

  if (
    texto.includes("CONJUNTO SENSOR DE NIVEL") ||
    texto === "SENSOR DE NIVEL"
  ) {
    return "Sensor de Nível de Combustível";
  }

  if (texto.includes("REGULADOR DE PRESSAO")) {
    return "Regulador de Pressão de Combustível";
  }

  if (
    texto.includes("PRE-FILTRO") ||
    texto.includes("PREFILTRO")
  ) {
    return "Pré-filtro da Bomba de Combustível";
  }

  return "";
}
function adicionarRegistro(mapa, registro) {
  const chave = [
    registro.tipo_referencia || "",
    registro.codigo_oem,
    registro.codigo_principal || "",
    registro.montadora,
    registro.modelo,
    registro.motor,
    registro.ano_inicio,
    registro.ano_fim,
    registro.pagina_catalogo ?? "",
    registro.observacao || "",
  ]
    .map(normalizar)
    .join("|");

  if (!mapa.has(chave)) {
    mapa.set(chave, registro);
    return;
  }

  const existente = mapa.get(chave);

  const equivalentes = new Set(
    [
      existente.codigo_equivalente,
      registro.codigo_equivalente,
    ]
      .join(",")
      .split(/[,;|]+/)
      .map(limparTexto)
      .filter(Boolean)
  );

  existente.codigo_equivalente =
    Array.from(equivalentes).join(", ");

  const observacoes = new Set(
    [
      existente.observacao,
      registro.observacao,
    ]
      .join("|")
      .split("|")
      .map(limparTexto)
      .filter(Boolean)
  );

  existente.observacao =
    Array.from(observacoes).join(" | ");
}

function criarFicha(principal, categoria, pressao, vazao, layout = "", pagina = null) {
  return {
    principal: limparCodigo(principal),
    categoria,
    layout: layout || "",
    pressao,
    vazao,
    montadora: "",
    pagina: pagina ?? null,
    observacoes: [],
    aplicacoes: [],
    relacionados: new Set(),
    relacionados_tipados: [],
  };
}

function emitirFicha(mapa, ficha, origem) {
  if (!ficha?.principal) {
    return;
  }

  const relacionados = [...ficha.relacionados]
    .map(limparCodigo)
    .filter((codigo) => codigo && codigo !== ficha.principal);

  const observacaoFicha = Array.from(
    new Set(
      [
        ficha.pressao ? `Pressão: ${ficha.pressao}` : "",
        ficha.vazao ? `Vazão: ${ficha.vazao}` : "",
        ...ficha.observacoes,
      ].filter(Boolean)
    )
  ).join(" | ");

  const aplicacoes = ficha.aplicacoes.length ? ficha.aplicacoes : [];

  if (!aplicacoes.length) {
    const equivalentes = relacionados.join(", ");
    adicionarRegistro(
      mapa,
      montarRegistroNotaTecnica({
        codigo_oem: ficha.principal,
        peca: definirTipoPeca(ficha.categoria, ficha.pressao, ficha.vazao),
        fabricante: "Bosch",
        origem_catalogo: origem,
        pagina_catalogo: ficha.pagina,
        observacao: observacaoFicha || null,
        codigo_equivalente: equivalentes,
      })
    );
    for (const relacionado of relacionados) {
      adicionarRegistro(
        mapa,
        montarRegistroNotaTecnica({
          codigo_oem: relacionado,
          peca: tipoPorCodigoRelacionado(
            relacionado,
            ficha.categoria,
            ficha.pressao,
            ficha.vazao
          ),
          fabricante: "Bosch",
          origem_catalogo: origem,
          pagina_catalogo: ficha.pagina,
          observacao: observacaoFicha || null,
          codigo_equivalente: [ficha.principal, ...relacionados]
            .filter((codigo) => codigo !== relacionado)
            .join(", "),
        })
      );
    }
    return;
  }

  for (const app of aplicacoes) {
    adicionarRegistro(mapa, {
      peca: definirTipoPeca(ficha.categoria, ficha.pressao, ficha.vazao),
      codigo_oem: ficha.principal,
      codigo_principal: ficha.principal,
      codigo_equivalente: relacionados.join(", "),
      fabricante: "Bosch",
      origem_catalogo: origem,
      montadora: app.montadora,
      modelo: ehCodigoDePeca(app.modelo) ? "" : app.modelo,
      motor: app.motor || "",
      ano_inicio: app.ano_inicio ?? null,
      ano_fim: app.ano_fim ?? null,
      observacao: observacaoFicha,
      pagina_catalogo: app.pagina,
      tipo_referencia: TIPO_REFERENCIA_APLICACAO,
      ativo: true,
      prioridade: 1,
      confiabilidade: 95,
    });

    for (const relacionado of [
      ...new Set([
        ...relacionados,
        ...(app.relacionados || []).map(limparCodigo),
      ]),
    ].filter((codigo) => codigo && codigo !== ficha.principal)) {
      adicionarRegistro(mapa, {
        peca: tipoPorCodigoRelacionado(
          relacionado,
          ficha.categoria,
          ficha.pressao,
          ficha.vazao
        ),
        codigo_oem: relacionado,
        codigo_principal: ficha.principal,
        codigo_equivalente: [ficha.principal, ...relacionados]
          .filter((codigo) => codigo !== relacionado)
          .join(", "),
        fabricante: "Bosch",
        origem_catalogo: origem,
        montadora: app.montadora,
        modelo: ehCodigoDePeca(app.modelo) ? "" : app.modelo,
        motor: app.motor || "",
        ano_inicio: app.ano_inicio ?? null,
        ano_fim: app.ano_fim ?? null,
        observacao: observacaoFicha,
        pagina_catalogo: app.pagina,
        tipo_referencia: TIPO_REFERENCIA_APLICACAO,
        ativo: true,
        prioridade: 1,
        confiabilidade: 95,
      });
    }
  }
}

export async function parserBoschBombas({
  textoAplicacoes = "",
  nomeArquivo = "",
  onProgresso,
}) {
  const linhas = separarLinhas(
    textoAplicacoes
  );

  const registros = new Map();
  const origem =
    nomeArquivo ||
    "Catálogo Bosch Bombas de Combustível 2019-2020";

  let paginaAtual = null;
  let montadoraAtual = "";
  let modeloAtual = "";
  let motorAtual = "";
  let categoriaAtual =
    "Kit de Reposição da Bomba de Combustível";
  let layoutAtual = "KIT_REPOSICAO";
  let ficha = null;

  for (
    let indice = 0;
    indice < linhas.length;
    indice += 1
  ) {
    const linha = linhas[indice];
    const layoutEncontrado = identificarLayoutFicha(linha);
    if (layoutEncontrado) {
      if (
        layoutEncontrado === "BOLETIM_TESTE" &&
        layoutAtual !== "BOLETIM_TESTE"
      ) {
        emitirFicha(registros, ficha, origem);
        ficha = null;
        montadoraAtual = "";
        modeloAtual = "";
        motorAtual = "";
      }
      layoutAtual = layoutEncontrado;
    }
    const categoriaEncontrada =
      identificarCategoriaCatalogo(linha);

    if (categoriaEncontrada) {
      categoriaAtual = categoriaEncontrada;
    }

    const pagina = extrairPagina(linha);

    if (pagina) {
      paginaAtual = pagina;
      continue;
    }

    if (pareceCabecalho(linha)) {
      continue;
    }

    const codigoProdutoBruto = extrairCodigoProduto(
      linha,
      categoriaAtual,
      ficha,
      layoutAtual
    );

    let codigoProduto = codigoProdutoBruto;
    if (
      codigoProduto &&
      extrairCodigosF000(linha).length > 0 &&
      extrairCodigosBombas(linha).length === 0 &&
      (layoutAtual === "SENSOR_NIVEL" ||
        layoutAtual === "CONJUNTO_BOMBA")
    ) {
      if (!identificarMontadora(proximaLinhaUtil(linhas, indice))) {
        codigoProduto = "";
      }
    }

    if (
      !codigoProduto &&
      (layoutAtual === "SENSOR_NIVEL" ||
        normalizar(categoriaAtual).includes("SENSOR DE NIVEL")) &&
      !temDataAplicacao(linha) &&
      !ehNotaFiltroEnsaio(linha)
    ) {
      const ident = extrairCodigosBosch10(linha).filter(
        (codigo) => codigo.startsWith("1582") || codigo.startsWith("1587")
      );
      if (
        ident.length === 1 &&
        extrairCodigosF000(linha).length === 0 &&
        extrairCodigosOem(linha).length === 0 &&
        extrairCodigosBombas(linha).length === 0 &&
        restoSemPecaMedida(linha).length <= 8 &&
        identificarMontadora(proximaLinhaUtil(linhas, indice))
      ) {
        codigoProduto = formatarCodigoBosch(ident[0]);
      }
    }

    if (codigoProduto) {
      emitirFicha(registros, ficha, origem);
      const especificacoes = extrairEspecificacoes(linha);
      ficha = criarFicha(
        codigoProduto,
        categoriaAtual,
        especificacoes.pressao,
        especificacoes.vazao,
        layoutAtual,
        paginaAtual
      );
      if (layoutAtual === "BOLETIM_TESTE") {
        ficha.observacoes.push(linha);
      }
      const classificadosCabeca = classificarCodigosRelacionados(
        linha,
        layoutAtual,
        ficha.principal
      );
      for (const item of classificadosCabeca) {
        ficha.relacionados.add(item.codigo);
        ficha.relacionados_tipados.push(item);
      }
      montadoraAtual = "";
      modeloAtual = "";
      motorAtual = "";
      continue;
    }

    if (pareceLinhaNotaTecnica(linha)) {
      const partidosNota = separarAplicacaoENotaDeLinha(linha);
      const soNota =
        !montadoraAtual ||
        !partidosNota.veiculo ||
        (!temDataAplicacao(partidosNota.veiculo) &&
          !separarModeloMotor(partidosNota.veiculo).modelo);
      if (soNota) {
        const equivalentesNota = extrairTodosCodigosPeca(linha)
          .map(limparCodigo)
          .filter(Boolean);
        for (const codigoNota of equivalentesNota) {
          adicionarRegistro(
            registros,
            montarRegistroNotaTecnica({
              codigo_oem: codigoNota,
              peca: definirTipoPeca(categoriaAtual, "", ""),
              fabricante: "Bosch",
              origem_catalogo: origem,
              pagina_catalogo: paginaAtual,
              observacao: linha,
              codigo_equivalente: equivalentesNota
                .filter((codigo) => codigo !== codigoNota)
                .join(", "),
            })
          );
        }
        continue;
      }
    }

    if (!ficha?.principal) {
      continue;
    }

    const classificadosLinha = classificarCodigosRelacionados(
      linha,
      ficha.layout || layoutAtual,
      ficha.principal
    );

    if (ehNotaFiltroEnsaio(linha)) {
      continue;
    }

    const montadora = identificarMontadora(linha);

    if (montadora) {
      montadoraAtual = montadora;
      ficha.montadora = montadora;
      modeloAtual = "";
      motorAtual = "";
      for (const item of classificadosLinha) {
        ficha.relacionados.add(item.codigo);
        ficha.relacionados_tipados.push(item);
      }
      continue;
    }

    if (!montadoraAtual) {
      for (const item of classificadosLinha) {
        ficha.relacionados.add(item.codigo);
        ficha.relacionados_tipados.push(item);
      }
      continue;
    }

    const partidos = separarAplicacaoENotaDeLinha(linha);
    const linhaVeiculo = partidos.veiculo || linha;
    const periodo = extrairPeriodo(linhaVeiculo) || extrairPeriodo(linha);
    const relacionadosLinha = classificadosLinha.map((item) => item.codigo);

    if (partidos.nota) {
      ficha.observacoes.push(partidos.nota);
    }

    const {
      modelo: modeloBruto,
      motor: motorBruto,
    } = separarModeloMotor(linhaVeiculo);

    const modeloSemCodigo = removerCodigos(modeloBruto);
    const modeloLinha =
      textoEhNotaNaoModelo(modeloSemCodigo) ||
      textoEhNotaNaoModelo(modeloBruto)
        ? ""
        : modeloSemCodigo;
    const motorLinha = textoEhNotaNaoModelo(modeloBruto)
      ? ""
      : removerCodigos(motorBruto);

    const modeloFinal = ehCodigoDePeca(modeloLinha)
      ? ""
      : modeloLinha;

    if (modeloFinal) {
      modeloAtual = modeloFinal;
      if (motorLinha) {
        motorAtual = motorLinha;
      }
    }

    const modeloApp = modeloFinal || modeloAtual;
    const motorApp = motorLinha || motorAtual || "";
    const aplicacaoValida =
      Boolean(montadoraAtual) &&
      Boolean(modeloApp) &&
      !ehCodigoDePeca(modeloApp);

    if (
      aplicacaoValida &&
      (modeloFinal || periodo.ano_inicio || motorLinha)
    ) {
      ficha.aplicacoes.push({
        montadora: montadoraAtual,
        modelo: modeloApp,
        motor: motorApp,
        ano_inicio: periodo.ano_inicio ?? null,
        ano_fim: periodo.ano_fim ?? null,
        pagina: paginaAtual,
        relacionados: relacionadosLinha,
      });
      continue;
    }

    for (const item of classificadosLinha) {
      ficha.relacionados.add(item.codigo);
      ficha.relacionados_tipados.push(item);
    }

    if (!periodo.ano_inicio && relacionadosLinha.length === 0 && !partidos.temNota) {
      continue;
    }

    if (
      indice > 0 &&
      indice % 200 === 0
    ) {
      onProgresso?.(
        `⛽ Bosch Bombas: ${registros.size} fichas em montagem...`
      );
    }
  }

  emitirFicha(registros, ficha, origem);

  const resultado = Array.from(registros.values());

  onProgresso?.(
    `✅ Bosch Bombas encontrou ${resultado.length} registros.`
  );

  return resultado;
}

export {
  extrairTodosCodigosPeca,
  limparCodigo,
  extrairCodigosOem,
  extrairCodigosBombas,
  extrairCodigosF000,
  extrairCodigosBosch10,
  extrairCodigosRegulador,
  extrairCodigosF000DR,
  extrairCodigosF000KP,
};