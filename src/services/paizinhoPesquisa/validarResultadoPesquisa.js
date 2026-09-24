// =============================================================
// PAIZINHO — VALIDAÇÃO DA PESQUISA EM FONTES ORIGINAIS
// -------------------------------------------------------------
// Função pura (sem rede, sem banco): recebe o que o pesquisador externo
// encontrou em cada fonte e decide o que pode ser CONFIRMADO.
//
// Regras:
//   1. Só fonte original/oficial confirma (ver fontesOriginais.js).
//   2. Marketplace, loja, blog, fórum = pista; nunca confirma.
//   3. A fonte oficial precisa mencionar o CÓDIGO PESQUISADO; senão é descartada.
//   4. Dado sem fonte oficial fica VAZIO. Zero é melhor do que aplicação errada.
//   5. Duas fontes oficiais divergentes → conflito, nada é escolhido em silêncio.
//   6. O código digitado pelo usuário nunca é trocado.
// =============================================================

import { classificarFonte, ROTULO_TIPO_FONTE } from "./fontesOriginais.js";
import {
  normalizarCodigo as normalizarCodigoBase,
  textoContemCodigo,
  listaContemCodigo,
} from "./codigoPaizinho.js";

export const STATUS_PESQUISA = {
  ENCONTRADO: "encontrado",
  CONFLITO: "conflito",
  NAO_IDENTIFICADO: "nao_identificado",
  INDISPONIVEL: "indisponivel",
};

export const MENSAGENS = {
  PESQUISANDO:
    "Código não encontrado na base PAIIA. O Paizinho está pesquisando fontes originais…",
  NAO_IDENTIFICADO:
    "Não encontrei informações suficientes em fontes originais para identificar esta peça com segurança.",
  CONFLITO: "Conflito entre fontes — revisão necessária.",
};

// ---------- Normalização ----------
export function normalizarCodigo(valor) {
  return normalizarCodigoBase(valor);
}

function normalizarTexto(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function texto(valor) {
  return String(valor ?? "").trim();
}

function anoOuNulo(valor) {
  const n = parseInt(String(valor ?? "").replace(/\D/g, ""), 10);
  if (!Number.isFinite(n)) return null;
  if (n >= 1950 && n <= 2100) return n;
  return null;
}

const FABRICANTES_CONHECIDOS = [
  ["bosch", /\bbosch\b/],
  ["magneti marelli", /magneti|marelli|cofap/],
  ["ngk", /\bngk\b/],
  ["ntk", /\bntk\b/],
  ["denso", /\bdenso\b/],
  ["delphi", /\bdelphi\b/],
  ["continental vdo", /\bvdo\b|continental/],
  ["mte-thomson", /mte|thomson/],
  ["mahle", /\bmahle\b/],
  ["valeo", /\bvaleo\b/],
  ["hella", /\bhella\b/],
  ["tsa", /\btsa\b/],
  ["ds", /^ds\b|\bds industria\b/],
  ["3-rho", /3 ?rho/],
  ["kostal", /\bkostal\b/],
  ["pierburg", /pierburg|motorservice/],
  ["nakata", /\bnakata\b/],
];

export function chaveFabricante(nome) {
  const t = normalizarTexto(nome);
  if (!t) return "";
  const achado = FABRICANTES_CONHECIDOS.find(([, re]) => re.test(t));
  return achado ? achado[0] : t;
}

// Família da peça — só para comparar se duas fontes falam da MESMA peça
const FAMILIAS_PECA = [
  ["sonda lambda", /sonda|lambda|sensor de oxigenio|oxygen sensor|o2 sensor/],
  ["bico injetor", /bico|injetor|injector|valvula injetora/],
  ["bobina de ignicao", /bobina|ignition coil/],
  ["vela de ignicao", /vela de ignicao|spark plug|\bvela\b/],
  ["vela aquecedora", /vela aquecedora|glow plug/],
  ["cabo de vela", /cabo de vela|cabos de ignicao|ignition cable|ignition lead/],
  ["bomba de combustivel", /bomba de combustivel|fuel pump|bomba eletrica/],
  ["sensor de rotacao", /sensor de rotacao|crankshaft|sensor de posicao do virabrequim/],
  ["sensor de fase", /sensor de fase|camshaft|posicao do comando/],
  ["sensor map", /\bmap\b|pressao absoluta/],
  ["sensor de temperatura", /sensor de temperatura|temperature sensor/],
  ["sensor de detonacao", /detonacao|knock/],
  ["corpo de borboleta", /corpo de borboleta|throttle body|tbi/],
  ["valvula solenoide", /solenoide|solenoid/],
];

export function familiaPeca(descricao) {
  const t = normalizarTexto(descricao);
  if (!t) return "";
  const achado = FAMILIAS_PECA.find(([, re]) => re.test(t));
  return achado ? achado[0] : t;
}

function chaveAplicacao(a) {
  return [
    normalizarTexto(a.montadora),
    normalizarTexto(a.modelo),
    normalizarTexto(a.versao),
    normalizarTexto(a.motor),
  ].join("|");
}

function mencionaCodigo(fonte, codigoNorm) {
  if (!codigoNorm) return false;
  // Código exato: lista de códigos igual após normalizar, ou texto com o
  // código inteiro (só separadores de escrita). "5181133" não casa com
  // "51811330" nem com "5181133-1".
  if (normalizarCodigo(fonte?.codigoMencionado) === codigoNorm) return true;
  if (
    listaContemCodigo(
      [
        ...(fonte?.dados?.codigos_oem || []),
        ...(fonte?.dados?.codigos_equivalentes || []),
        ...(fonte?.dados?.codigos_substitutos || []),
        fonte?.dados?.codigo_fabricante,
      ],
      codigoNorm
    )
  ) {
    return true;
  }
  return [fonte?.evidencia, fonte?.trecho, fonte?.titulo].some((t) =>
    textoContemCodigo(t, codigoNorm)
  );
}

// ---------- Validação principal ----------
/**
 * @param {object} p
 * @param {string} p.codigoPesquisado  código exatamente como o usuário digitou
 * @param {Array}  p.fontes            [{ url, titulo, evidencia, dados:{...} }]
 */
export function validarResultadoPesquisa({ codigoPesquisado, fontes = [] }) {
  const codigoOriginal = texto(codigoPesquisado);
  const codigoNorm = normalizarCodigo(codigoOriginal);

  const consultadas = [];
  const descartadas = [];
  const oficiaisValidas = [];

  for (const fonte of Array.isArray(fontes) ? fontes : []) {
    const cls = classificarFonte(fonte?.url);
    const registro = {
      url: texto(fonte?.url),
      titulo: texto(fonte?.titulo),
      nome: cls.nome,
      tipo: cls.tipo,
      tipoRotulo: ROTULO_TIPO_FONTE[cls.tipo] || cls.tipo,
      prioridade: cls.prioridade,
      oficial: cls.oficial,
      evidencia: texto(fonte?.evidencia || fonte?.trecho).slice(0, 400),
      verificacaoPagina: fonte?.verificacaoPagina ?? null,
      verificacaoMotivo: texto(fonte?.verificacaoMotivo),
    };
    consultadas.push(registro);

    if (!cls.podeConfirmar) {
      descartadas.push({
        ...registro,
        motivo:
          cls.tipo === "pista_nao_confirma"
            ? "Marketplace/loja/blog/fórum: serve só como pista, não confirma aplicação."
            : "Fonte sem origem técnica verificável: não confirma.",
        dados: fonte?.dados || null,
      });
      continue;
    }

    if (!mencionaCodigo(fonte, codigoNorm)) {
      descartadas.push({
        ...registro,
        motivo: "Fonte oficial não mostra o código pesquisado: descartada.",
        dados: fonte?.dados || null,
      });
      continue;
    }

    oficiaisValidas.push({ ...registro, dados: fonte?.dados || {} });
  }

  const conflitos = [];

  // --- Campos únicos: fabricante e descrição ---
  function consolidarUnico(campo, chaveFn, rotulo) {
    const porChave = new Map();
    for (const f of oficiaisValidas) {
      const valor = texto(f.dados?.[campo]);
      if (!valor) continue;
      const k = chaveFn(valor);
      if (!porChave.has(k)) porChave.set(k, { valores: [], fontes: [] });
      const item = porChave.get(k);
      item.valores.push({ valor, prioridade: f.prioridade });
      item.fontes.push(f.url);
    }
    if (porChave.size === 0) return { valor: "", fontes: [] };
    if (porChave.size > 1) {
      conflitos.push({
        campo: rotulo,
        valores: [...porChave.values()].map((i) => ({
          valor: i.valores[0].valor,
          fontes: [...new Set(i.fontes)],
        })),
      });
      return { valor: "", fontes: [], conflito: true };
    }
    const unico = [...porChave.values()][0];
    const melhor = unico.valores.sort((a, b) => a.prioridade - b.prioridade)[0];
    return { valor: melhor.valor, fontes: [...new Set(unico.fontes)] };
  }

  const fabricante = consolidarUnico("fabricante", chaveFabricante, "Fabricante");
  const descricao = consolidarUnico("descricao", familiaPeca, "Descrição / tipo de peça");

  // --- Listas de códigos: união com rastreio de fonte (não inventa nada) ---
  function consolidarLista(campo) {
    const mapa = new Map();
    for (const f of oficiaisValidas) {
      for (const bruto of f.dados?.[campo] || []) {
        const valor = texto(bruto);
        const k = normalizarCodigo(valor);
        if (!k || k === codigoNorm) continue;
        if (!mapa.has(k)) mapa.set(k, { codigo: valor, fontes: [] });
        mapa.get(k).fontes.push(f.url);
      }
    }
    return [...mapa.values()].map((i) => ({ ...i, fontes: [...new Set(i.fontes)] }));
  }

  const codigosOem = consolidarLista("codigos_oem");
  const codigosEquivalentes = consolidarLista("codigos_equivalentes");
  const codigosSubstitutos = consolidarLista("codigos_substitutos");

  // --- Aplicações ---
  const aplicacoesPorChave = new Map();
  const aplicacoesDescartadas = [];
  for (const f of oficiaisValidas) {
    for (const bruta of f.dados?.aplicacoes || []) {
      const a = {
        montadora: texto(bruta?.montadora),
        modelo: texto(bruta?.modelo),
        versao: texto(bruta?.versao),
        motor: texto(bruta?.motor),
        combustivel: texto(bruta?.combustivel),
        ano_inicio: anoOuNulo(bruta?.ano_inicio),
        ano_fim: anoOuNulo(bruta?.ano_fim),
      };
      if (!a.montadora || !a.modelo) {
        aplicacoesDescartadas.push({
          aplicacao: a,
          fonte: f.url,
          motivo: "Aplicação incompleta (sem montadora ou modelo): não usada.",
        });
        continue;
      }
      const k = chaveAplicacao(a);
      if (!aplicacoesPorChave.has(k)) aplicacoesPorChave.set(k, []);
      aplicacoesPorChave.get(k).push({ ...a, fonte: f.url, prioridade: f.prioridade });
    }
  }

  const aplicacoesConfirmadas = [];
  for (const lista of aplicacoesPorChave.values()) {
    const periodos = new Set(lista.map((x) => `${x.ano_inicio ?? ""}-${x.ano_fim ?? ""}`));
    const base = lista[0];
    if (periodos.size > 1) {
      conflitos.push({
        campo: `Aplicação ${[base.montadora, base.modelo, base.versao, base.motor]
          .filter(Boolean)
          .join(" ")}`,
        valores: lista.map((x) => ({
          valor: `${x.ano_inicio ?? "?"} a ${x.ano_fim ?? "?"}`,
          fontes: [x.fonte],
        })),
      });
      continue;
    }
    // Combustível só fica se todas as fontes que o citam concordarem.
    const combustiveis = new Set(
      lista.map((x) => normalizarTexto(x.combustivel)).filter(Boolean)
    );
    const combustivel =
      combustiveis.size === 1 ? lista.find((x) => x.combustivel)?.combustivel || "" : "";
    aplicacoesConfirmadas.push({
      montadora: base.montadora,
      modelo: base.modelo,
      versao: base.versao,
      motor: base.motor,
      combustivel,
      ano_inicio: base.ano_inicio,
      ano_fim: base.ano_fim,
      fontes: [...new Set(lista.map((x) => x.fonte))],
      confirmacoes: new Set(lista.map((x) => x.fonte)).size,
    });
  }

  // --- Especificações técnicas ---
  const especPorNome = new Map();
  for (const f of oficiaisValidas) {
    for (const e of f.dados?.especificacoes || []) {
      const nome = texto(e?.nome);
      const valor = texto(e?.valor);
      if (!nome || !valor) continue;
      const k = normalizarTexto(nome);
      if (!especPorNome.has(k)) especPorNome.set(k, []);
      especPorNome.get(k).push({ nome, valor, fonte: f.url });
    }
  }
  const especificacoes = [];
  for (const lista of especPorNome.values()) {
    const valores = new Set(lista.map((x) => normalizarTexto(x.valor)));
    if (valores.size > 1) {
      conflitos.push({
        campo: `Especificação: ${lista[0].nome}`,
        valores: lista.map((x) => ({ valor: x.valor, fontes: [x.fonte] })),
      });
      continue;
    }
    especificacoes.push({
      nome: lista[0].nome,
      valor: lista[0].valor,
      fontes: [...new Set(lista.map((x) => x.fonte))],
    });
  }

  // --- Status e confiança ---
  const temIdentificacao = Boolean(fabricante.valor || descricao.valor);
  const fontesOficiaisUsadas = [...new Set(oficiaisValidas.map((f) => f.url))];
  const melhorPrioridade = oficiaisValidas.reduce((m, f) => Math.min(m, f.prioridade), 99);

  let status;
  if (oficiaisValidas.length === 0 || (!temIdentificacao && aplicacoesConfirmadas.length === 0 && conflitos.length === 0)) {
    status = STATUS_PESQUISA.NAO_IDENTIFICADO;
  } else if (conflitos.length > 0) {
    status = STATUS_PESQUISA.CONFLITO;
  } else {
    status = STATUS_PESQUISA.ENCONTRADO;
  }

  let confianca = "baixa";
  if (status !== STATUS_PESQUISA.NAO_IDENTIFICADO) {
    if (fontesOficiaisUsadas.length >= 2 && melhorPrioridade <= 2 && conflitos.length === 0) {
      confianca = "alta";
    } else {
      confianca = "média";
    }
  }

  // Se não identificou, nada é "confirmado" — zero é melhor do que dado errado.
  const identificado = status !== STATUS_PESQUISA.NAO_IDENTIFICADO;

  return {
    codigoPesquisado: codigoOriginal,
    status,
    mensagem:
      status === STATUS_PESQUISA.NAO_IDENTIFICADO
        ? MENSAGENS.NAO_IDENTIFICADO
        : status === STATUS_PESQUISA.CONFLITO
        ? MENSAGENS.CONFLITO
        : "Peça identificada em fonte original.",
    confianca,
    confirmado: identificado
      ? {
          fabricante: fabricante.valor,
          fabricanteFontes: fabricante.fontes,
          descricao: descricao.valor,
          descricaoFontes: descricao.fontes,
          codigosOem: codigosOem,
          codigosEquivalentes: codigosEquivalentes,
          codigosSubstitutos: codigosSubstitutos,
          aplicacoes: aplicacoesConfirmadas,
          especificacoes,
        }
      : {
          fabricante: "",
          fabricanteFontes: [],
          descricao: "",
          descricaoFontes: [],
          codigosOem: [],
          codigosEquivalentes: [],
          codigosSubstitutos: [],
          aplicacoes: [],
          especificacoes: [],
        },
    conflitos,
    fontesConsultadas: consultadas,
    fontesOficiaisUsadas,
    descartadas,
    aplicacoesDescartadas,
  };
}
