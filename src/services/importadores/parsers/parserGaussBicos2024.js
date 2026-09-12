export const FONTE_GAUSS_BICOS_2024 =
  "Gauss — Catálogo de Produtos 01/2024";

export const PECA_GAUSS_BICO = "Bico Injetor";

const FUROS_VALIDOS = new Set([1, 2, 3, 4, 5, 6, 8, 10, 12]);

const ROTULOS = [
  "Magneti Marelli",
  "Citroën / Peugeot",
  "Citroen / Peugeot",
  "Fiat / Jeep",
  "Kia/Hyundai",
  "Kia / Hyundai",
  "VW/ Audi/ Seat",
  "VW/Seat",
  "VW / Seat",
  "Mercedes-Benz",
  "Mercedes Benz",
  "ALFA ROMEO",
  "Alfa Romeo",
  "VOLKSWAGEN",
  "CHEVROLET",
  "Chevrolet",
  "MITSUBISHI",
  "Mitsubishi",
  "HYUNDAI",
  "Hyundai",
  "RENAULT",
  "Renault",
  "PEUGEOT",
  "Peugeot",
  "CITROËN",
  "CITROEN",
  "Citroën",
  "Citroen",
  "NISSAN",
  "Nissan",
  "HONDA",
  "Honda",
  "TOYOTA",
  "Toyota",
  "CHERY",
  "Chery",
  "JEEP",
  "Jeep",
  "SEAT",
  "Seat",
  "AUDI",
  "Audi",
  "FORD",
  "Ford",
  "FIAT",
  "Fiat",
  "BOSCH",
  "Bosch",
  "DELPHI",
  "Delphi",
  "DENSO",
  "Denso",
  "SAGEM",
  "Sagem",
  "VALEO",
  "Valeo",
  "DEKA",
  "Deka",
  "SIEMENS",
  "Siemens",
  "VÁRIAS",
  "VARIAS",
  "HONDA",
  "KIA",
  "Kia",
  "GM",
  "MB",
  "VW",
];

const MONTADORAS = {
  "ALFA ROMEO": "Alfa Romeo",
  AUDI: "Audi",
  BMW: "BMW",
  CHERY: "Chery",
  CHEVROLET: "Chevrolet",
  CITROEN: "Citroën",
  "CITROËN": "Citroën",
  FIAT: "Fiat",
  FORD: "Ford",
  GM: "GM",
  HONDA: "Honda",
  HYUNDAI: "Hyundai",
  JEEP: "Jeep",
  KIA: "Kia",
  MB: "Mercedes-Benz",
  "MERCEDES BENZ": "Mercedes-Benz",
  "MERCEDES-BENZ": "Mercedes-Benz",
  MITSUBISHI: "Mitsubishi",
  NISSAN: "Nissan",
  PEUGEOT: "Peugeot",
  RENAULT: "Renault",
  SEAT: "Seat",
  TOYOTA: "Toyota",
  VOLKSWAGEN: "Volkswagen",
  VW: "Volkswagen",
};

const MODELOS_NUMERICOS = new Set([
  "106",
  "205",
  "206",
  "207",
  "208",
  "306",
  "307",
  "308",
  "405",
  "406",
  "407",
  "408",
  "2008",
  "3008",
  "5008",
]);

function limpar(valor = "") {
  return String(valor || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizarCodigoGauss(valor = "") {
  return String(valor || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function ehCodigoGauss(valor = "") {
  return /^GI\d{3,6}$/i.test(normalizarCodigoGauss(valor));
}

function rotuloRegex() {
  const alts = [...new Set(ROTULOS)]
    .sort((a, b) => b.length - a.length)
    .map((item) =>
      item
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        .replace(/\s+/g, "\\s+")
    );
  return new RegExp(`(?:^|\\s)(${alts.join("|")})\\s*:`, "ig");
}

function repararTextoCatalogo(texto = "") {
  return limpar(texto)
    .replace(/(\d{5})-\s+([A-Z0-9])/g, "$1-$2")
    .replace(/\bIWM\s+(\d)/gi, "IWM$1")
    .replace(/\bIWP\s+(\d)/gi, "IWP$1")
    .replace(/\bIPE\s+(\d)/gi, "IPE$1")
    .replace(/\bIPM\s+(\d)/gi, "IPM$1")
    .replace(/\bICD\s+(\d)/gi, "ICD$1")
    .replace(/\b0\s+280\s+/g, "0 280 ");
}

function pareceModeloVeiculo(texto = "") {
  const t = limpar(texto);
  if (!t) return false;
  const primeiro = t.split(/[\s,/]/)[0];
  if (MODELOS_NUMERICOS.has(primeiro)) return true;
  if (/^C\d\b/i.test(primeiro)) return true;
  if (/^\d{6,}/.test(primeiro.replace(/\s/g, ""))) return false;
  if (/^(IWP|IWM|IPE|IPM|ICD|BOSCH)\b/i.test(t)) return false;
  if (/^0\s*280\b/.test(t)) return false;
  if (/^[A-Z0-9]{6,}$/i.test(primeiro) && /\d/.test(primeiro) && /[A-Z]/i.test(primeiro)) {
    return false;
  }
  return /[A-Za-zÀ-ÿ]/.test(primeiro);
}

function pareceCodigoOem(texto = "") {
  const t = limpar(texto);
  if (!t) return false;
  const head = t.split(/[;,]/)[0].trim();
  if (MODELOS_NUMERICOS.has(head.split(/\s/)[0]) && /\d(?:[.,]\d)|16V|8V|i\b|Flex/i.test(t)) {
    return false;
  }
  if (/^(IWP|IWM|IPE|IPM|ICD)\s*\d/i.test(head)) return true;
  if (/^0\s*280\b/.test(head)) return true;
  if (/^0K0/i.test(head)) return true;
  if (/^\d{3}\s\d{3}\s\d{2}/.test(head)) return true;
  if (/^\d{2,3}\s\d{3}\s\d{3}\b/.test(head)) return true;
  if (/^\d{5}-/.test(head)) return true;
  if (/^\d{6,}/.test(head.replace(/\s/g, ""))) return true;
  if (/^\d{2}[A-Z]\d{3}[A-Z]\b/i.test(head)) return true;
  if (/^[A-Z]{1,5}\d[A-Z0-9.\-]{4,}$/i.test(head.split(/\s/)[0])) return true;
  if (/^[A-Z]\d{5,}$/i.test(head.split(/\s/)[0])) return true;
  return false;
}

const FABRICANTES_PECA_ROTULO = new Set([
  "magneti marelli",
  "bosch",
  "delphi",
  "denso",
  "sagem",
  "valeo",
  "deka",
  "siemens",
  "vdo",
]);

function ehRotuloFabricantePeca(rotulo = "") {
  return FABRICANTES_PECA_ROTULO.has(
    limpar(rotulo)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
  );
}

function detectarFabricantePeca(texto = "") {
  const t = limpar(texto).toLowerCase();
  const mapa = [
    ["magneti marelli", "Magneti Marelli"],
    ["bosch", "Bosch"],
    ["delphi", "Delphi"],
    ["denso", "Denso"],
    ["sagem", "Sagem"],
    ["valeo", "Valeo"],
    ["deka", "Deka"],
    ["siemens", "Siemens"],
    ["vdo", "VDO"],
  ];
  for (const [chave, nome] of mapa) {
    if (t.includes(chave)) return nome;
  }
  return "";
}

function adicionarCodigo(lista, vistos, originalBruto) {
  const original = limpar(originalBruto)
    .replace(/^[,;:]+/, "")
    .replace(/[,;:]+$/, "");
  if (!original) return;
  const normalizado = normalizarCodigoGauss(original);
  if (!normalizado || normalizado.length < 5 || normalizado.length > 22) return;
  if (ehCodigoGauss(normalizado)) return;
  if (!/\d/.test(normalizado)) return;
  if (
    /^(TODOS|FLEX|GASOLINA|ALCOOL|MPI|MPFI|DOHC|SOHC|TOTALFLEX|TETRAFUEL)$/i.test(
      normalizado
    )
  ) {
    return;
  }
  if (/^(19|20)\d{2}$/.test(normalizado)) return;
  if (vistos.has(normalizado)) return;
  vistos.add(normalizado);
  lista.push({ original, normalizado });
}

function extrairCodigosSubstitui(texto = "") {
  const bruto = repararTextoCatalogo(texto);
  const encontrados = [];
  const vistos = new Set();
  const padroes = [
    /\bIWP\d{2,4}\b/gi,
    /\bIWM\d{4,6}\b/gi,
    /\bIPE\d{2,4}\b/gi,
    /\bIPM\d{2,4}\b/gi,
    /\bICD\d{3,6}\b/gi,
    /\b0\s*280\s*\d{3}\s*\d{3}\b/g,
    /\b\d{3}\s\d{3}\s\d{2,3}(?:\s\d)?\b/g,
    /\b\d{2,3}\s\d{3}\s\d{3}\b/g,
    /\b032\s*906\s*031\s*[A-Z]\b/gi,
    /\b0?3[026]\s*906\s*031\s*[A-Z]?\b/gi,
    /\b06A906031[A-Z]{0,3}\b/gi,
    /\b16450-[A-Z]{3}-\d{3}X?\b/gi,
    /\b\d{5}-[A-Z0-9]{2,8}\b/gi,
    /\b0K0[0-9A-Z]{2,4}\s*\d{4,6}\b/gi,
    /\bGN1[A-Z0-9]{6,14}\b/gi,
    /\bH331[A-Z0-9]{5,12}\b/gi,
    /\b01F002A\b/gi,
    /\b\d{2}[A-Z]\d{3}[A-Z]\b/g,
    /\b1984\s*E0\b/gi,
    /\b1984-87\b/g,
    /\b348001\b/g,
    /\bH106845\b/gi,
    /\bSV107683NPN\b/gi,
    /\b\d{2}\.\d{3}\.\d{3}\b/g,
    /\b\d{7,12}[A-Z]{0,3}\b/g,
    /\b[A-Z]{2,5}\d[A-Z0-9.]{5,16}\b/g,
    /\b[A-Z]{1,3}\d{5,10}[A-Z]{0,4}\b/g,
  ];

  for (const re of padroes) {
    for (const match of bruto.matchAll(re)) {
      adicionarCodigo(encontrados, vistos, match[0]);
    }
  }

  const filtrados = encontrados.filter((item) => {
    const n = item.normalizado;
    return !encontrados.some(
      (outro) =>
        outro.normalizado !== n &&
        outro.normalizado.startsWith(n) &&
        outro.normalizado.length > n.length
    );
  });

  return filtrados;
}

function partirSubstituiAplicacao(corpo = "") {
  const re = rotuloRegex();
  let match;
  let inicioApp = -1;
  while ((match = re.exec(corpo))) {
    if (ehRotuloFabricantePeca(match[1])) continue;
    const depois = corpo.slice(match.index + match[0].length);
    if (pareceModeloVeiculo(depois) && !pareceCodigoOem(depois)) {
      inicioApp = match.index;
      break;
    }
  }
  if (inicioApp < 0) {
    return { substitui: limpar(corpo), aplicacao: "" };
  }
  return {
    substitui: limpar(corpo.slice(0, inicioApp)),
    aplicacao: limpar(corpo.slice(inicioApp)),
  };
}

function completarAno(valor) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return null;
  if (String(valor).length === 4) return n;
  return n >= 90 ? 1900 + n : 2000 + n;
}

function extrairFaixasAno(texto = "") {
  const faixas = [];
  for (const match of texto.matchAll(/(\d{2}|\d{4})\s*[>\-–]\s*(\d{2}|\d{4})?/g)) {
    faixas.push({
      inicio: completarAno(match[1]),
      fim: match[2] ? completarAno(match[2]) : null,
    });
  }
  const unico = texto.match(/\((\d{4})\)/);
  if (!faixas.length && unico) {
    faixas.push({
      inicio: Number(unico[1]),
      fim: Number(unico[1]),
    });
  }
  return faixas;
}

function anosUnicos(texto = "") {
  const faixas = extrairFaixasAno(texto);
  if (!faixas.length) return { ano_inicio: null, ano_fim: null };
  const chaves = faixas.map((item) => `${item.inicio}|${item.fim ?? ""}`);
  if (new Set(chaves).size !== 1) return { ano_inicio: null, ano_fim: null };
  return {
    ano_inicio: faixas[0].inicio,
    ano_fim: faixas[0].fim,
  };
}

function motoresUnicos(texto = "") {
  const encontrados = [
    ...texto.matchAll(/\b(\d(?:[.,]\d)(?:\s*\/\s*\d(?:[.,]\d))?)\b/g),
  ]
    .map((match) => match[1].replace(",", ".").replace(/\s+/g, ""))
    .filter((valor) => {
      const n = Number(String(valor).split("/")[0]);
      return n >= 0.8 && n <= 8;
    });
  const unicos = [...new Set(encontrados)];
  if (unicos.length !== 1) return null;
  return unicos[0];
}

function combustivelUnico(texto = "") {
  const t = texto.toLowerCase();
  const tipos = new Set();
  if (
    t.includes("flex") ||
    t.includes("hi - flex") ||
    t.includes("hi-flex") ||
    t.includes("tetrafuel")
  ) {
    tipos.add("Flex");
  }
  if (t.includes("álcool") || t.includes("alcool")) tipos.add("Álcool");
  if (t.includes("gasolina")) tipos.add("Gasolina");
  if (t.includes("diesel")) tipos.add("Diesel");
  if (tipos.size === 1) return [...tipos][0];
  return null;
}

function sistemaUnico(texto = "") {
  const t = texto.toUpperCase();
  const tipos = [];
  if (t.includes("MPFI")) tipos.push("MPFI");
  else if (t.includes("MPI")) tipos.push("MPI");
  if (t.includes("SPI")) tipos.push("SPI");
  if (t.includes("EFI")) tipos.push("EFI");
  const unicos = [...new Set(tipos)];
  if (unicos.length !== 1) return null;
  return unicos[0];
}

function mapearMontadora(rotulo = "") {
  const chave = limpar(rotulo)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  if (chave === "VARIAS") return null;
  return MONTADORAS[chave] || MONTADORAS[limpar(rotulo).toUpperCase()] || null;
}

function nomeModelo(parte = "") {
  let texto = limpar(parte)
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b\d{2,4}\s*[>\-–]\s*\d{0,4}/g, " ")
    .replace(/\b(MPI|MPFI|SPI|EFI|DOHC|SOHC|FLEX|TETRAFUEL|GASOLINA|ÁLCOOL|ALCOOL|TODOS|TOTAL|MARCHAS)\b/gi, " ")
    .replace(/\b\d(?:[.,]\d)(?:\s*\/\s*\d(?:[.,]\d))?\b/g, " ")
    .replace(/\b\d{1,2}V\b/gi, " ")
    .replace(/\bV6\b/gi, " ")
    .replace(/\b\d\s*Cil\.?\b/gi, " ")
    .replace(/\b\dcc\b/gi, " ");

  const deslocamento = texto.search(/\b\d(?:[.,]\d)\b/);
  if (deslocamento > 0) {
    texto = texto.slice(0, deslocamento);
  }

  texto = texto.replace(/\s+/g, " ").trim();
  texto = texto.replace(/\s+\d+$/, "").trim();

  const palavras = texto.split(/\s+/).filter(Boolean);
  if (
    palavras.length >= 2 &&
    /^(Gol|Parati|Saveiro|Quantum|Santana|Palio|Siena|Strada|Fox|Voyage)$/i.test(
      palavras[palavras.length - 1]
    ) &&
    /^(Gol|Parati|Saveiro|Quantum|Santana|Palio)$/i.test(palavras[0]) &&
    palavras[0].toLowerCase() !== palavras[palavras.length - 1].toLowerCase()
  ) {
    texto = palavras[0];
  }

  if (!texto) return "";
  if (/^\d+([.,]\d+)?$/.test(texto)) return "";
  if (!/[A-Za-zÀ-ÿ]/.test(texto)) return "";
  if (texto.length > 40) texto = texto.split(" ").slice(0, 4).join(" ");
  return texto;
}

function extrairAplicacoes(textoAplicacao = "") {
  const texto = limpar(textoAplicacao);
  if (!texto) return [];

  const re = rotuloRegex();
  const ocorrencias = [...texto.matchAll(re)];
  const blocos = [];

  if (!ocorrencias.length) {
    return [
      {
        montadora: null,
        modelo: null,
        trecho: texto,
      },
    ];
  }

  for (let i = 0; i < ocorrencias.length; i++) {
    const rotulo = ocorrencias[i][1];
    const inicio = ocorrencias[i].index + ocorrencias[i][0].length;
    const fim =
      i + 1 < ocorrencias.length ? ocorrencias[i + 1].index : texto.length;
    const corpo = limpar(texto.slice(inicio, fim));
    const montadora = mapearMontadora(rotulo);
    if (ehRotuloFabricantePeca(rotulo) && !montadora) {
      continue;
    }
    const partes = corpo.split(/[,;]/);
    const modelos = [];
    for (const parte of partes) {
      const modelo = nomeModelo(parte);
      if (modelo && !modelos.includes(modelo)) modelos.push(modelo);
    }

    if (!montadora && /varias/i.test(rotulo)) {
      const marcas = [];
      for (const [chave, nome] of Object.entries(MONTADORAS)) {
        if (new RegExp(`\\b${chave}\\b`, "i").test(corpo) && !marcas.includes(nome)) {
          marcas.push(nome);
        }
      }
      if (marcas.length) {
        for (const nome of marcas) {
          blocos.push({
            montadora: nome,
            modelo: null,
            trecho: corpo,
          });
        }
        continue;
      }
    }

    if (modelos.length) {
      for (const modelo of modelos) {
        blocos.push({ montadora, modelo, trecho: corpo });
      }
    } else {
      blocos.push({
        montadora,
        modelo: null,
        trecho: corpo,
      });
    }
  }

  return blocos;
}

function escolherCodigoPrincipal(codigos = [], iwpCompartilhado = false) {
  if (iwpCompartilhado) {
    return (
      codigos.find((item) => /^501\d{5}$/.test(item.normalizado)) ||
      codigos.find((item) => /^0280\d{6}$/.test(item.normalizado)) ||
      codigos.find((item) => !/^IWP\d+$/i.test(item.normalizado)) ||
      codigos[0] ||
      null
    );
  }
  return (
    codigos.find((item) => /^IWP\d+$/i.test(item.normalizado)) ||
    codigos.find((item) => /^0280\d{6}$/.test(item.normalizado)) ||
    codigos[0] ||
    null
  );
}

function limparCabecalhos(texto = "") {
  return limpar(texto)
    .replace(/Nº 32[\s\S]*?BICO INJETOR/gi, " ")
    .replace(/\d+\s+\d{3}\s+GAUSS[\s\S]*?FUROS/gi, " ")
    .replace(/\d{3}\s+GAUSS[\s\S]*?FUROS/gi, " ")
    .replace(/C a t á l o g o[\s\S]*?FUROS/gi, " ")
    .replace(/INJEÇÃO E SENSORES BICO INJETOR A EVOLUÇÃO É GAUSS!/gi, " ")
    .replace(/FOTO\s+CÓD\.\s*GAUSS\s+SUBSTITUI\s+APLICAÇÃO\s+FUROS/gi, " ")
    .replace(/===== PAGINA \d+ =====/gi, " ");
}

function extrairFuros(corpo = "") {
  const match =
    corpo.match(/>\s*(?:\d{2}\s+)?(\d{1,2})\s*$/) ||
    corpo.match(/\)\s+(\d{1,2})\s*$/) ||
    corpo.match(/\btodos\s+(\d{1,2})\s*$/i);
  if (!match) {
    return { furos: null, corpo };
  }
  const valor = Number(match[1]);
  const corpoSemFuros = limpar(corpo.slice(0, match.index + match[0].length - String(match[1]).length));
  if (!FUROS_VALIDOS.has(valor) || valor >= 90) {
    return { furos: null, corpo: corpoSemFuros };
  }
  return {
    furos: valor,
    corpo: corpoSemFuros,
  };
}

export function parseCatalogoGaussBicos(textoBruto = "", opcoes = {}) {
  const texto = limparCabecalhos(repararTextoCatalogo(textoBruto));
  const reGi = /\b(GI\d{4})\b/g;
  const matches = [...texto.matchAll(reGi)];
  const produtos = [];
  const vistosGi = new Set();

  for (let i = 0; i < matches.length; i++) {
    const gi = matches[i][1];
    const antes = texto.slice(Math.max(0, matches[i].index - 16), matches[i].index);
    if (/conjunto do\s*$/i.test(antes)) continue;
    if (vistosGi.has(gi)) continue;
    vistosGi.add(gi);

    const start = matches[i].index + gi.length;
    let end = texto.length;
    for (let j = i + 1; j < matches.length; j++) {
      const proximoAntes = texto.slice(
        Math.max(0, matches[j].index - 16),
        matches[j].index
      );
      if (/conjunto do\s*$/i.test(proximoAntes)) continue;
      end = matches[j].index;
      break;
    }

    let corpo = limparCabecalhos(texto.slice(start, end));
    const extraido = extrairFuros(corpo);
    corpo = extraido.corpo;
    const { substitui, aplicacao } = partirSubstituiAplicacao(corpo);
    const obsMatch = aplicacao.match(/OBS\.?:?\s*(.+)$/i);
    const observacoesCatalogo = obsMatch ? limpar(obsMatch[1]) : "";
    const aplicacaoLimpa = obsMatch
      ? limpar(aplicacao.slice(0, obsMatch.index))
      : aplicacao;
    const equivalentes = extrairCodigosSubstitui(substitui);
    const duvidas = [];

    if (!equivalentes.length) {
      duvidas.push("sem_codigo_substitui");
    }
    if (!aplicacaoLimpa) {
      duvidas.push("aplicacao_nao_separada");
    }

    produtos.push({
      gi_ignorado: gi,
      peca: PECA_GAUSS_BICO,
      fabricante: detectarFabricantePeca(substitui) || null,
      codigo_principal: null,
      equivalentes,
      substitui_original: substitui,
      aplicacao_original: aplicacaoLimpa,
      observacoes_catalogo: observacoesCatalogo || null,
      furos: extraido.furos,
      motor: motoresUnicos(aplicacaoLimpa),
      sistema: sistemaUnico(aplicacaoLimpa),
      combustivel: combustivelUnico(aplicacaoLimpa),
      ...anosUnicos(aplicacaoLimpa),
      aplicacoes: extrairAplicacoes(aplicacaoLimpa),
      fonte_catalogo: FONTE_GAUSS_BICOS_2024,
      arquivo_catalogo: opcoes.nomeArquivo || "catalogo gauss.pdf",
      duvidas,
    });
  }

  marcarDuplicidades(produtos);
  for (const produto of produtos) {
    const iwpCompartilhado = produto.duvidas.some((item) =>
      item.startsWith("codigo_compartilhado:IWP")
    );
    produto.codigo_principal = escolherCodigoPrincipal(
      produto.equivalentes,
      iwpCompartilhado
    );
  }
  return produtos;
}

function marcarDuplicidades(produtos = []) {
  const porCodigo = new Map();
  for (const produto of produtos) {
    for (const codigo of produto.equivalentes) {
      if (!porCodigo.has(codigo.normalizado)) {
        porCodigo.set(codigo.normalizado, []);
      }
      porCodigo.get(codigo.normalizado).push(produto.gi_ignorado);
    }
  }

  for (const produto of produtos) {
    for (const codigo of produto.equivalentes) {
      const gis = [...new Set(porCodigo.get(codigo.normalizado) || [])];
      if (gis.length > 1) {
        produto.duvidas.push(
          `codigo_compartilhado:${codigo.normalizado}:${gis.join(",")}`
        );
      }
    }
    produto.duvidas = [...new Set(produto.duvidas)];
  }
}

function montarObservacao(produto) {
  return [
    produto.aplicacao_original
      ? `Aplicação original: ${produto.aplicacao_original}`
      : "",
    produto.substitui_original
      ? `Substitui original: ${produto.substitui_original}`
      : "",
    produto.furos ? `Furos: ${produto.furos}` : "",
    produto.sistema ? `Sistema: ${produto.sistema}` : "",
    produto.combustivel ? `Combustível: ${produto.combustivel}` : "",
    produto.observacoes_catalogo
      ? `OBS.: ${produto.observacoes_catalogo}`
      : "",
    produto.duvidas.length
      ? `Auditoria: ${produto.duvidas.join(" | ")}`
      : "",
  ]
    .filter(Boolean)
    .join(" | ");
}

function listaEquivalentesCampo(equivalentes = []) {
  const vistos = new Set();
  const valores = [];
  for (const item of equivalentes) {
    for (const valor of [item.normalizado, item.original]) {
      const chave = String(valor || "").toUpperCase();
      if (!valor || vistos.has(chave)) continue;
      vistos.add(chave);
      valores.push(valor);
    }
  }
  return valores.join(", ");
}

export function montarCargaPaiia(produtos = []) {
  const catalogo_pecas = [];
  const catalogo_mestre = [];
  const mestreVisto = new Set();

  for (const produto of produtos) {
    if (!produto.equivalentes.length) continue;

    const codigoEquivalente = listaEquivalentesCampo(produto.equivalentes);
    const observacao = montarObservacao(produto);
    const aplicacoes = produto.aplicacoes.length
      ? produto.aplicacoes
      : [{ montadora: null, modelo: null, trecho: produto.aplicacao_original }];

    for (const aplicacao of aplicacoes) {
      for (const codigo of produto.equivalentes) {
        catalogo_pecas.push({
          peca: produto.peca,
          codigo_oem: codigo.normalizado,
          codigo_equivalente: codigoEquivalente,
          fabricante: produto.fabricante,
          origem_catalogo: produto.fonte_catalogo,
          familia_catalogo: "injecao",
          categoria: "Bico Injetor",
          sistema: produto.sistema,
          tipo: "Bico Injetor",
          montadora: aplicacao.montadora,
          modelo: aplicacao.modelo,
          motor: produto.motor,
          ano_inicio: produto.ano_inicio,
          ano_fim: produto.ano_fim,
          observacao,
          ativo: true,
          prioridade: 1,
          confiabilidade: produto.duvidas.length ? 70 : 100,
          __gauss_gi_ignorado: produto.gi_ignorado,
          __codigo_original: codigo.original,
        });
      }
    }

    for (const codigo of produto.equivalentes) {
      const chave = `${codigo.normalizado}|${(produto.fabricante || "").toUpperCase()}`;
      if (mestreVisto.has(chave)) continue;
      mestreVisto.add(chave);
      catalogo_mestre.push({
        peca: produto.peca,
        codigo_oem: codigo.normalizado,
        codigo_equivalente: codigoEquivalente,
        fabricante: produto.fabricante,
        origem_catalogo: produto.fonte_catalogo,
        observacao,
        ativo: true,
        prioridade: 1,
        confiabilidade: produto.duvidas.length ? 70 : 100,
        __gauss_gi_ignorado: produto.gi_ignorado,
        __codigo_original: codigo.original,
      });
    }
  }

  return { catalogo_pecas, catalogo_mestre };
}

function nuloSeVazio(valor) {
  if (valor === undefined || valor === null) return null;
  if (typeof valor === "string" && !valor.trim()) return null;
  return valor;
}

export function codigoProibidoGauss(valor = "") {
  const n = normalizarCodigoGauss(valor);
  return /^GI\d+$/.test(n) || n === "IWP065";
}

export function prepararLinhaGravacao(registro = {}, tabela = "catalogo_pecas") {
  const base = {
    peca: nuloSeVazio(registro.peca),
    codigo_oem: nuloSeVazio(registro.codigo_oem),
    codigo_equivalente: nuloSeVazio(registro.codigo_equivalente),
    fabricante: nuloSeVazio(registro.fabricante),
    origem_catalogo: nuloSeVazio(registro.origem_catalogo),
    observacao: nuloSeVazio(registro.observacao),
    ativo: registro.ativo !== false,
    prioridade: registro.prioridade || 1,
    confiabilidade: registro.confiabilidade || 100,
  };

  if (tabela === "catalogo_mestre") {
    return base;
  }

  return {
    ...base,
    familia_catalogo: nuloSeVazio(registro.familia_catalogo),
    categoria: nuloSeVazio(registro.categoria),
    sistema: nuloSeVazio(registro.sistema),
    tipo: nuloSeVazio(registro.tipo),
    montadora: nuloSeVazio(registro.montadora),
    modelo: nuloSeVazio(registro.modelo),
    motor: nuloSeVazio(registro.motor),
    ano_inicio: registro.ano_inicio ?? null,
    ano_fim: registro.ano_fim ?? null,
  };
}
