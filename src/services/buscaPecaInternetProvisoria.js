import {
  supabase,
  supabaseKey,
  supabaseUrl,
} from "../supabase";

export const FONTE_EXTERNA_PROVISORIA = "mercado_livre_provisorio";
export const ROTULO_FONTE_MERCADO_LIVRE =
  "Mercado Livre — dados provisórios";

const A_CONFIRMAR = "A confirmar";

const FABRICANTES = [
  { nome: "Bosch", padroes: [/\bbosch\b/i] },
  { nome: "Magneti Marelli", padroes: [/magneti\s*marelli/i, /\bmarelli\b/i] },
  { nome: "Delphi", padroes: [/\bdelphi\b/i] },
  { nome: "Denso", padroes: [/\bdenso\b/i] },
  { nome: "NGK", padroes: [/\bngk\b/i] },
  { nome: "NTK", padroes: [/\bntk\b/i] },
  { nome: "Valeo", padroes: [/\bvaleo\b/i] },
];

const PECAS = [
  { nome: "Bico Injetor", padroes: [/bico\s*injetor/i, /\binjetor\b/i] },
  { nome: "Sonda Lambda", padroes: [/sonda\s*lambda/i, /\blambda\b/i] },
  { nome: "Bobina de Ignição", padroes: [/bobina/i] },
  { nome: "Sensor de Detonação", padroes: [/sensor\s*de\s*detona/i, /\bknock\b/i] },
  { nome: "Sensor de Rotação", padroes: [/sensor\s*de\s*rota/i] },
  { nome: "Sensor MAP", padroes: [/sensor\s*map/i] },
];

const MONTADORAS = [
  {
    nome: "Fiat",
    padroes: [/\bfiat\b/i],
    modelos: [
      "Uno", "Palio", "Siena", "Strada", "Fiorino", "Doblo", "Idea",
      "Punto", "Linea", "Toro", "Argo", "Cronos", "Mobi", "Weekend",
    ],
  },
  {
    nome: "Volkswagen",
    padroes: [/\bvolkswagen\b/i, /\bvw\b/i],
    modelos: [
      "Gol", "Voyage", "Parati", "Saveiro", "Fox", "Polo", "Golf",
      "Jetta", "Passat", "Up", "Virtus", "Nivus", "Kombi",
    ],
  },
  {
    nome: "Chevrolet",
    padroes: [/\bchevrolet\b/i, /\bgm\b/i],
    modelos: [
      "Celta", "Corsa", "Prisma", "Onix", "Agile", "Montana", "S10",
      "Spin", "Cobalt", "Cruze", "Astra", "Vectra", "Meriva",
    ],
  },
  {
    nome: "Ford",
    padroes: [/\bford\b/i],
    modelos: ["Ka", "Fiesta", "Focus", "EcoSport", "Ranger", "Courier"],
  },
  {
    nome: "Renault",
    padroes: [/\brenaul?t\b/i],
    modelos: [
      "Clio", "Sandero", "Logan", "Duster", "Kwid", "Captur", "Megane",
      "Scenic", "Symbol", "Kangoo",
    ],
  },
  {
    nome: "Honda",
    padroes: [/\bhonda\b/i],
    modelos: ["Civic", "Fit", "City", "HR-V", "WR-V", "CR-V"],
  },
  {
    nome: "Toyota",
    padroes: [/\btoyota\b/i],
    modelos: ["Corolla", "Etios", "Hilux", "Yaris"],
  },
  {
    nome: "Hyundai",
    padroes: [/\bhyundai\b/i],
    modelos: ["HB20", "Creta", "i30", "Tucson"],
  },
  {
    nome: "Nissan",
    padroes: [/\bnissan\b/i],
    modelos: ["March", "Versa", "Sentra", "Kicks"],
  },
  {
    nome: "Peugeot",
    padroes: [/\bpeugeot\b/i],
    modelos: ["206", "207", "208", "307", "308", "2008"],
  },
];

function limparTexto(valor) {
  return String(valor ?? "").replace(/\s+/g, " ").trim();
}

function normalizarCodigo(valor) {
  return String(valor ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function normalizarChave(valor) {
  return limparTexto(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function contemCodigoExato(texto, codigoNormalizado) {
  if (!codigoNormalizado || codigoNormalizado.length < 5) {
    return false;
  }

  const bruto = limparTexto(texto);
  if (!bruto) {
    return false;
  }

  if (normalizarCodigo(bruto).includes(codigoNormalizado)) {
    return true;
  }

  const flexivel = codigoNormalizado.split("").join("[\\s.\\-/]*");
  return new RegExp(flexivel, "i").test(bruto);
}

function primeiroMatch(texto, lista) {
  for (const item of lista) {
    if (item.padroes.some((padrao) => padrao.test(texto))) {
      return item.nome;
    }
  }
  return "";
}

function votar(valores, minimo = 2) {
  const contagem = new Map();

  for (const valor of valores) {
    const texto = limparTexto(valor);
    if (!texto || texto === A_CONFIRMAR) {
      continue;
    }

    const chave = normalizarChave(texto);
    const atual = contagem.get(chave) || { valor: texto, votos: 0 };
    atual.votos += 1;
    contagem.set(chave, atual);
  }

  const ordenado = [...contagem.values()].sort((a, b) => b.votos - a.votos);

  if (!ordenado.length) {
    return A_CONFIRMAR;
  }

  if (ordenado.length > 1 && ordenado[0].votos === ordenado[1].votos) {
    return A_CONFIRMAR;
  }

  if (ordenado[0].votos < minimo) {
    return A_CONFIRMAR;
  }

  return ordenado[0].valor;
}

function extrairModelos(texto, montadoraInfo) {
  const encontrados = [];
  for (const modelo of montadoraInfo.modelos) {
    const flexivel = modelo.replace(/[-\s]/g, "[\\s-]*");
    if (new RegExp(`\\b${flexivel}\\b`, "i").test(texto)) {
      encontrados.push(modelo);
    }
  }
  return encontrados;
}

function extrairMotores(texto) {
  const matches = String(texto || "").match(
    /\b\d\.\d(?:\s*(?:16v|8v|fire|flex|mpi|turbo))?\b/gi
  ) || [];
  return [...new Set(matches.map((item) => limparTexto(item)))];
}

function extrairAnos(texto) {
  const periodo = String(texto || "").match(
    /\b((?:19|20)\d{2})\s*(?:a|até|ate|-|\/)\s*((?:19|20)\d{2}|\d{2})\b/i
  );

  if (periodo) {
    const inicio = Number(periodo[1]);
    let fim = Number(periodo[2]);
    if (fim < 100) {
      fim = fim >= 80 ? 1900 + fim : 2000 + fim;
    }
    if (inicio >= 1980 && fim >= inicio && fim <= 2035) {
      return { ano_inicio: inicio, ano_fim: fim };
    }
  }

  return { ano_inicio: null, ano_fim: null };
}

function extrairEquivalentes(texto, codigoPesquisado) {
  const codigoBase = normalizarCodigo(codigoPesquisado);
  const candidatos = String(texto || "").match(
    /\b[A-Z]{0,4}\d{5,14}[A-Z]{0,3}\b/gi
  ) || [];

  const unicos = [];
  for (const candidato of candidatos) {
    const normalizado = normalizarCodigo(candidato);
    if (!normalizado || normalizado === codigoBase || normalizado.length < 6) {
      continue;
    }
    if (!unicos.includes(normalizado)) {
      unicos.push(normalizado);
    }
  }
  return unicos;
}

function parsearTitulo(titulo, codigoPesquisado) {
  const peca = primeiroMatch(titulo, PECAS);
  const fabricante = primeiroMatch(titulo, FABRICANTES);
  const aplicacoes = [];

  for (const info of MONTADORAS) {
    const modelos = extrairModelos(titulo, info);
    if (!modelos.length) {
      continue;
    }
    for (const modelo of modelos) {
      aplicacoes.push({
        montadora: info.nome,
        modelo,
      });
    }
  }

  return {
    peca,
    fabricante,
    aplicacoes,
    motores: extrairMotores(titulo),
    anos: extrairAnos(titulo),
    equivalentes: extrairEquivalentes(titulo, codigoPesquisado),
    titulo,
  };
}

function votarComNivel(valores) {
  const coincidente = votar(valores, 2);
  if (coincidente !== A_CONFIRMAR) {
    return { valor: coincidente, nivel: "confirmado" };
  }

  const encontrados = [
    ...new Set(
      valores
        .map((valor) => limparTexto(valor))
        .filter((valor) => valor && valor !== A_CONFIRMAR)
    ),
  ];

  if (encontrados.length === 1) {
    return { valor: encontrados[0], nivel: "a_confirmar" };
  }

  return { valor: A_CONFIRMAR, nivel: "a_confirmar" };
}

function cruzarAnuncios(titulos, codigoPesquisado) {
  const extraidos = titulos.map((titulo) =>
    parsearTitulo(titulo, codigoPesquisado)
  );

  const pecaInfo = votarComNivel(extraidos.map((item) => item.peca));
  const fabricanteInfo = votarComNivel(
    extraidos.map((item) => item.fabricante)
  );
  const peca = pecaInfo.valor;
  const fabricante = fabricanteInfo.valor;

  const equivalentesContagem = new Map();
  for (const item of extraidos) {
    const vistos = new Set();
    for (const codigo of item.equivalentes) {
      if (vistos.has(codigo)) {
        continue;
      }
      vistos.add(codigo);
      equivalentesContagem.set(
        codigo,
        (equivalentesContagem.get(codigo) || 0) + 1
      );
    }
  }

  const equivalentesConfirmados = [...equivalentesContagem.entries()]
    .filter(([, votos]) => votos >= 2)
    .map(([codigo]) => codigo);
  const equivalentesProvisorios = [...equivalentesContagem.entries()]
    .filter(([, votos]) => votos === 1)
    .map(([codigo]) => codigo);

  const equivalentes = equivalentesConfirmados.length
    ? equivalentesConfirmados
    : equivalentesProvisorios;
  const oemNivel =
    equivalentesConfirmados.length > 0 ? "confirmado" : "a_confirmar";

  const grupos = new Map();
  for (const item of extraidos) {
    for (const aplicacao of item.aplicacoes) {
      const chave = `${normalizarChave(aplicacao.montadora)}|${normalizarChave(aplicacao.modelo)}`;
      const grupo = grupos.get(chave) || {
        montadora: aplicacao.montadora,
        modelo: aplicacao.modelo,
        votos: 0,
        motores: [],
        anosInicio: [],
        anosFim: [],
      };
      grupo.votos += 1;
      grupo.motores.push(...item.motores);
      if (item.anos.ano_inicio) {
        grupo.anosInicio.push(String(item.anos.ano_inicio));
      }
      if (item.anos.ano_fim) {
        grupo.anosFim.push(String(item.anos.ano_fim));
      }
      grupos.set(chave, grupo);
    }
  }

  const aplicacoes = [...grupos.values()]
    .sort((a, b) => {
      if (b.votos !== a.votos) {
        return b.votos - a.votos;
      }
      return `${a.montadora} ${a.modelo}`.localeCompare(
        `${b.montadora} ${b.modelo}`,
        "pt-BR"
      );
    })
    .map((grupo) => {
      const confirmado = grupo.votos >= 2;
      const nivelConcordancia = confirmado ? "confirmado" : "a_confirmar";

      let motor = "";
      let anoInicio = null;
      let anoFim = null;

      if (confirmado) {
        const motorVotado = votar(grupo.motores, 2);
        motor = motorVotado === A_CONFIRMAR ? "" : motorVotado;
        const inicioVotado = votar(grupo.anosInicio, 2);
        const fimVotado = votar(grupo.anosFim, 2);
        anoInicio =
          inicioVotado === A_CONFIRMAR ? null : Number(inicioVotado) || null;
        anoFim = fimVotado === A_CONFIRMAR ? null : Number(fimVotado) || null;
      } else {
        const motoresUnicos = [...new Set(grupo.motores.filter(Boolean))];
        motor = motoresUnicos.join(" / ");
        const inicios = [...new Set(grupo.anosInicio)];
        const fins = [...new Set(grupo.anosFim)];
        anoInicio = inicios.length === 1 ? Number(inicios[0]) || null : null;
        anoFim = fins.length === 1 ? Number(fins[0]) || null : null;
      }

      return {
        peca,
        fabricante,
        pecaNivel: pecaInfo.nivel,
        fabricanteNivel: fabricanteInfo.nivel,
        codigo_oem: codigoPesquisado,
        codigo_equivalente: equivalentes.length
          ? equivalentes.join(", ")
          : A_CONFIRMAR,
        oemNivel,
        montadora: grupo.montadora,
        modelo: grupo.modelo,
        motor,
        ano_inicio: anoInicio,
        ano_fim: anoFim,
        origem: FONTE_EXTERNA_PROVISORIA,
        origem_catalogo: ROTULO_FONTE_MERCADO_LIVRE,
        nivelConcordancia,
        observacao: confirmado
          ? "CONFIRMADO entre anúncios do Mercado Livre. Ainda provisório para o catálogo PAIIA."
          : "ENCONTRADO NO MERCADO LIVRE — A CONFIRMAR",
        confiabilidade: confirmado ? 35 : 15,
        fonte_provisoria: true,
      };
    });

  if (!aplicacoes.length) {
    aplicacoes.push({
      peca,
      fabricante,
      pecaNivel: pecaInfo.nivel,
      fabricanteNivel: fabricanteInfo.nivel,
      codigo_oem: codigoPesquisado,
      codigo_equivalente: equivalentes.length
        ? equivalentes.join(", ")
        : A_CONFIRMAR,
      oemNivel,
      montadora: "",
      modelo: "",
      motor: "",
      ano_inicio: null,
      ano_fim: null,
      origem: FONTE_EXTERNA_PROVISORIA,
      origem_catalogo: ROTULO_FONTE_MERCADO_LIVRE,
      nivelConcordancia: "a_confirmar",
      observacao: "ENCONTRADO NO MERCADO LIVRE — A CONFIRMAR",
      confiabilidade: 15,
      fonte_provisoria: true,
    });
  }

  return {
    peca,
    fabricante,
    pecaNivel: pecaInfo.nivel,
    fabricanteNivel: fabricanteInfo.nivel,
    equivalentes,
    oemNivel,
    registros: aplicacoes,
    totalAnuncios: titulos.length,
  };
}

function extrairAnunciosMercadoLivre(payload) {
  if (Array.isArray(payload?.mercadoLivre)) {
    return payload.mercadoLivre;
  }

  if (Array.isArray(payload?.mercado_livre)) {
    return payload.mercado_livre;
  }

  if (Array.isArray(payload?.data?.mercadoLivre)) {
    return payload.data.mercadoLivre;
  }

  return [];
}

async function chamarConcorrenciaDireto(corpo) {
  const resposta = await fetch(
    `${supabaseUrl}/functions/v1/concorrencia`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify(corpo),
    }
  );

  if (!resposta.ok) {
    throw new Error(`Mercado Livre HTTP ${resposta.status}`);
  }

  return resposta.json();
}

async function buscarAnunciosMercadoLivre(codigo) {
  const corpo = {
    termo: codigo,
    codigo,
    titulo: codigo,
    marketplaces: ["mercado_livre"],
  };

  console.info("[PAIIA_FALLBACK] 4 chamada Mercado Livre", {
    codigo,
    rota: "functions/v1/concorrencia",
  });

  let payload = null;

  try {
    const { data, error } = await supabase.functions.invoke("concorrencia", {
      body: corpo,
    });

    if (error) {
      throw error;
    }

    payload = data;
  } catch (erroInvoke) {
    console.warn(
      "[PAIIA_FALLBACK] invoke falhou, tentando fetch direto:",
      erroInvoke?.message || erroInvoke
    );
    payload = await chamarConcorrenciaDireto(corpo);
  }

  const anuncios = extrairAnunciosMercadoLivre(payload);
  const codigoNormalizado = normalizarCodigo(codigo);
  const titulos = [...new Set(
    anuncios
      .map((item) => limparTexto(item?.titulo))
      .filter((titulo) => contemCodigoExato(titulo, codigoNormalizado))
  )].slice(0, 20);

  console.info("[PAIIA_FALLBACK] 5 resposta Mercado Livre", {
    anunciosRecebidos: anuncios.length,
    anunciosComCodigoExato: titulos.length,
  });

  return titulos;
}

export async function buscarPecaInternetProvisoria(codigo, onProgresso) {
  const codigoPesquisado = limparTexto(codigo);

  if (!codigoPesquisado || normalizarCodigo(codigoPesquisado).length < 5) {
    return null;
  }

  onProgresso?.(
    30,
    "🌐 Código não encontrado no catálogo interno. Pesquisando o código exato no Mercado Livre..."
  );

  let titulos = [];

  try {
    titulos = await buscarAnunciosMercadoLivre(codigoPesquisado);
  } catch (erro) {
    console.warn("⚠️ Mercado Livre indisponível no fallback:", erro);
    return null;
  }

  if (!titulos.length) {
    return null;
  }

  onProgresso?.(
    42,
    `🌐 ${titulos.length} anúncio(s) do Mercado Livre com o código exato. Cruzando dados...`
  );

  const cruzado = cruzarAnuncios(titulos, codigoPesquisado);

  return {
    registros: cruzado.registros,
    peca: cruzado.peca,
    fabricante: cruzado.fabricante,
    equivalentes: cruzado.equivalentes,
    conflitos: [],
    totalFontes: titulos.length,
    totalAnuncios: titulos.length,
    fonte: FONTE_EXTERNA_PROVISORIA,
  };
}
