import {
  CODIGOS_AMOSTRA_FASE2,
  interpretarBlocoBruto,
} from "./interpretarBlocoBruto.js";
import { ehTokenCodigoTecnico, tokensDeIdentificador } from "./montarBlocosBrutos.js";

export const TAMANHO_LOTE_VALIDACAO_FASE2 = 50;

const PREFERENCIA_VISUAL = {
  TB0032: { pagina: 375, ordem_bloco: 2 },
};

const TIPOS_COTA = [
  "produto",
  "tabela_referencia",
  "aplicacao",
  "cabecalho",
  "indice",
  "varios_codigos",
  "indefinido",
];

function blocoContemCodigo(texto, codigo) {
  const bruto = String(texto || "").toUpperCase();
  const alvo = String(codigo || "").toUpperCase();
  const padrao = new RegExp(`(^|[^A-Z0-9])${alvo}([^A-Z0-9]|$)`);
  return padrao.test(bruto);
}

function idBloco(bloco) {
  return bloco?.id || `${bloco?.pagina}:${bloco?.ordem_bloco}:${String(bloco?.texto_original || "").slice(0, 40)}`;
}

function contarCodigosTecnicos(texto = "") {
  return tokensDeIdentificador(texto).filter((token) => ehTokenCodigoTecnico(token))
    .length;
}

export function escolherAmostraPorCodigo(blocos, codigo) {
  const candidatos = (blocos || []).filter((bloco) =>
    blocoContemCodigo(bloco.texto_original, codigo)
  );

  if (candidatos.length === 0) {
    return null;
  }

  const preferido = PREFERENCIA_VISUAL[codigo];
  if (preferido) {
    const visual = candidatos.find(
      (bloco) =>
        Number(bloco.pagina) === preferido.pagina &&
        Number(bloco.ordem_bloco) === preferido.ordem_bloco
    );
    if (visual) {
      return visual;
    }
  }

  return [...candidatos].sort((a, b) => {
    const tamanho =
      String(a.texto_original || "").length -
      String(b.texto_original || "").length;
    if (tamanho !== 0) {
      return tamanho;
    }
    return Number(a.pagina || 0) - Number(b.pagina || 0);
  })[0];
}

function ordenarPorPagina(blocos = []) {
  return [...blocos].sort((a, b) => {
    const pagina = Number(a.pagina || 0) - Number(b.pagina || 0);
    if (pagina !== 0) {
      return pagina;
    }
    return Number(a.ordem_bloco || 0) - Number(b.ordem_bloco || 0);
  });
}

function espalharPorPagina(blocos = [], quantidade) {
  const ordenados = ordenarPorPagina(blocos);
  if (quantidade <= 0 || ordenados.length === 0) {
    return [];
  }
  if (ordenados.length <= quantidade) {
    return ordenados;
  }

  const escolhidos = [];
  const vistos = new Set();
  const passo = (ordenados.length - 1) / Math.max(1, quantidade - 1);

  for (let indice = 0; indice < quantidade; indice += 1) {
    const posicao = Math.round(indice * passo);
    const bloco = ordenados[posicao];
    const chave = idBloco(bloco);
    if (!vistos.has(chave)) {
      vistos.add(chave);
      escolhidos.push(bloco);
    }
  }

  for (const bloco of ordenados) {
    if (escolhidos.length >= quantidade) {
      break;
    }
    const chave = idBloco(bloco);
    if (!vistos.has(chave)) {
      vistos.add(chave);
      escolhidos.push(bloco);
    }
  }

  return escolhidos;
}

function tipoBalde(bloco, interpretacao) {
  const tipo = interpretacao?.classificacao_candidata || "indefinido";
  if (TIPOS_COTA.includes(tipo) && tipo !== "varios_codigos") {
    return tipo;
  }
  if (
    tipo === "indefinido" &&
    contarCodigosTecnicos(bloco.texto_original) >= 3
  ) {
    return "varios_codigos";
  }
  return "indefinido";
}

export function montarLoteValidacaoFase2(
  blocos = [],
  { tamanho = TAMANHO_LOTE_VALIDACAO_FASE2 } = {}
) {
  const lote = [];
  const vistos = new Set();

  const incluir = (bloco, amostraCodigo) => {
    if (!bloco || lote.length >= tamanho) {
      return false;
    }
    const chave = idBloco(bloco);
    if (vistos.has(chave)) {
      return false;
    }
    vistos.add(chave);
    lote.push({
      bloco,
      amostraCodigo,
    });
    return true;
  };

  for (const codigo of CODIGOS_AMOSTRA_FASE2) {
    incluir(escolherAmostraPorCodigo(blocos, codigo), codigo);
  }

  const baldes = Object.fromEntries(TIPOS_COTA.map((tipo) => [tipo, []]));

  for (const bloco of blocos || []) {
    if (vistos.has(idBloco(bloco))) {
      continue;
    }
    const interpretacao = interpretarBlocoBruto({
      texto_original: bloco.texto_original,
      linhas_originais: bloco.linhas_originais,
    });
    baldes[tipoBalde(bloco, interpretacao)].push(bloco);
  }

  const filas = TIPOS_COTA.map((tipo) => ({
    tipo,
    itens: espalharPorPagina(baldes[tipo], tamanho),
    indice: 0,
  }));

  let progresso = true;
  while (lote.length < tamanho && progresso) {
    progresso = false;
    for (const fila of filas) {
      if (lote.length >= tamanho) {
        break;
      }
      while (fila.indice < fila.itens.length) {
        const bloco = fila.itens[fila.indice];
        fila.indice += 1;
        if (incluir(bloco, fila.tipo)) {
          progresso = true;
          break;
        }
      }
    }
  }

  if (lote.length < tamanho) {
    for (const bloco of ordenarPorPagina(blocos)) {
      if (lote.length >= tamanho) {
        break;
      }
      incluir(bloco, "complemento");
    }
  }

  return lote;
}

export function resumirLoteInterpretacao(resultados = []) {
  const itens = resultados || [];
  const total = itens.length;
  const classificacao = (tipo) =>
    itens.filter(
      (item) => item.interpretacao?.classificacao_candidata === tipo
    ).length;

  const confiancas = itens
    .map((item) => Number(item.interpretacao?.confianca))
    .filter((valor) => Number.isFinite(valor));

  return {
    totalAnalisado: total,
    produtosCandidatos: classificacao("produto"),
    tabelasReferencias: classificacao("tabela_referencia"),
    aplicacoes: classificacao("aplicacao"),
    indefinidos: classificacao("indefinido"),
    cabecalhos: classificacao("cabecalho"),
    indices: classificacao("indice"),
    revisaoManual: itens.filter((item) => item.interpretacao?.revisao_manual)
      .length,
    confiancaMedia:
      confiancas.length === 0
        ? 0
        : Number(
            (
              confiancas.reduce((soma, valor) => soma + valor, 0) /
              confiancas.length
            ).toFixed(4)
          ),
  };
}
