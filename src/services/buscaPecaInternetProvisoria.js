import { pesquisarConcorrencia } from "./pesquisarConcorrencia";

export const FONTE_EXTERNA_PROVISORIA = "externa_provisoria";

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
  { nome: "Sensor de Rotação", padroes: [/sensor\s*de\s*rota/i] },
  { nome: "Sensor MAP", padroes: [/sensor\s*map/i] },
];

function limparTexto(valor) {
  return String(valor ?? "").replace(/\s+/g, " ").trim();
}

function normalizarCodigo(valor) {
  return String(valor ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
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

function votar(valores) {
  const contagem = new Map();

  for (const valor of valores) {
    const texto = limparTexto(valor);
    if (!texto || texto === A_CONFIRMAR) {
      continue;
    }

    const chave = texto.toLowerCase();
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

  if (ordenado[0].votos < 2) {
    return A_CONFIRMAR;
  }

  return ordenado[0].valor;
}

async function buscarTitulosPublicos(codigo) {
  try {
    const resultado = await pesquisarConcorrencia({
      codigo,
      titulo: codigo,
    });

    const titulos = [
      ...(resultado?.anuncios?.mercadoLivre || []),
      ...(resultado?.anuncios?.shopee || []),
    ]
      .map((item) => limparTexto(item?.titulo))
      .filter(Boolean);

    return titulos.filter((titulo) =>
      contemCodigoExato(titulo, normalizarCodigo(codigo))
    );
  } catch (erro) {
    console.warn("⚠️ Fonte externa provisória indisponível:", erro);
    return [];
  }
}

export async function buscarPecaInternetProvisoria(codigo, onProgresso) {
  const codigoPesquisado = limparTexto(codigo);

  if (!codigoPesquisado || normalizarCodigo(codigoPesquisado).length < 5) {
    return null;
  }

  onProgresso?.(
    30,
    "🌐 Código não encontrado no catálogo interno. Consultando fonte externa provisória..."
  );

  const titulos = await buscarTitulosPublicos(codigoPesquisado);

  if (!titulos.length) {
    return null;
  }

  const peca = votar(titulos.map((titulo) => primeiroMatch(titulo, PECAS)));
  const fabricante = votar(
    titulos.map((titulo) => primeiroMatch(titulo, FABRICANTES))
  );

  return {
    registros: [
      {
        peca,
        fabricante,
        codigo_oem: codigoPesquisado,
        codigo_equivalente: A_CONFIRMAR,
        montadora: "",
        modelo: "",
        motor: A_CONFIRMAR,
        ano_inicio: null,
        ano_fim: null,
        origem: FONTE_EXTERNA_PROVISORIA,
        origem_catalogo: FONTE_EXTERNA_PROVISORIA,
        observacao:
          "Fonte externa_provisoria. Dados a confirmar. Não gravar no catálogo mestre.",
        confiabilidade: 20,
        fonte_provisoria: true,
      },
    ],
    peca,
    fabricante,
    equivalentes: [],
    conflitos: [],
    totalFontes: titulos.length,
    fonte: FONTE_EXTERNA_PROVISORIA,
  };
}
