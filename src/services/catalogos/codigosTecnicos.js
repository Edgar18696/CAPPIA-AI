// (26/11/2026) Regras puras dos Catálogos Técnicos (sem banco, sem rede).
// Usadas pela busca da Base PAIIA (Buscar e Montar, PAIIA Voz, Catálogos Técnicos).

/*
 * ============================================================
 * DENSO: com e sem hífen, com e sem o sufixo RC
 * ============================================================
 * "439000-0830RC" / "BC261430-1270RC": prefixo opcional de 2 letras
 * + 6 dígitos + 4 dígitos + "RC" opcional. O código gravado no catálogo
 * (oficial, completo) é sempre o que aparece no resultado.
 */
const RE_DENSO_COMPACTO = /^([A-Z]{2})?(\d{6})(\d{4})(RC)?$/;

/** Formas gravadas possíveis de um código DENSO digitado (com hífen, com e sem RC). */
export function formasDenso(compacto) {
  const m = RE_DENSO_COMPACTO.exec(String(compacto || ""));
  if (!m) return [];
  const [, prefixo = "", a, b] = m;
  return [`${prefixo}${a}-${b}RC`, `${prefixo}${a}-${b}`];
}

/**
 * Forma compacta "irmã" (com ↔ sem RC). Só é usada quando a forma digitada
 * não acha nada: a correspondência exata tem prioridade.
 */
export function compactoAlternativoDenso(compacto) {
  const m = RE_DENSO_COMPACTO.exec(String(compacto || ""));
  if (!m) return "";
  const [, prefixo = "", a, b, rc] = m;
  return rc ? `${prefixo}${a}${b}` : `${prefixo}${a}${b}RC`;
}

/*
 * ============================================================
 * HIERARQUIA DAS FONTES
 * ============================================================
 * 1 = montadora / peça genuína; 2 = fabricante de componente original (OE);
 * 3 = reposição. Na mesma ordem, mercado brasileiro antes do estrangeiro.
 */
export const GRUPOS_FABRICANTES = [
  { id: "montadora", ordem: 1, titulo: "Montadoras e peças genuínas" },
  { id: "oe", ordem: 2, titulo: "Fabricantes de componentes originais (OE)" },
  { id: "reposicao", ordem: 3, titulo: "Reposição" },
];

const MONTADORAS = [
  "RENAULT", "VOLKSWAGEN", "VW", "FIAT", "CHEVROLET", "GM", "GENERAL MOTORS", "TOYOTA", "HONDA", "NISSAN",
  "FORD", "HYUNDAI", "KIA", "PEUGEOT", "CITROEN", "CITROËN", "STELLANTIS", "JEEP", "MITSUBISHI", "MERCEDES",
  "BMW", "AUDI", "VOLVO", "MOPAR", "MOTRIO", "CATCAR",
];
const OE = [
  "DENSO", "BOSCH", "MAGNETI MARELLI", "MARELLI", "COFAP", "NGK", "NTK", "NITERRA", "CONTINENTAL", "VDO",
  "VALEO", "DELPHI", "HELLA", "MAHLE", "KOSTAL", "PIERBURG", "MOTORSERVICE",
];
const REPOSICAO = ["TSA", "GAUSS", "EURO", "MTE", "DS ", "3-RHO", "3RHO", "NAKATA", "FRAS-LE"];

const contem = (texto, lista) => lista.some((nome) => ` ${texto} `.includes(` ${nome.trim()} `) || texto.startsWith(nome));

/** Grupo da fonte de um registro do catálogo (pelo fabricante e pela origem). */
export function grupoDaFonte(registro = {}) {
  const fabricante = String(registro.fabricante || "").toUpperCase().trim();
  const origem = String(registro.origem_catalogo || "").toUpperCase();
  for (const texto of [fabricante, origem]) {
    if (!texto) continue;
    if (contem(texto, REPOSICAO)) return "reposicao";
    if (contem(texto, OE)) return "oe";
    if (contem(texto, MONTADORAS)) return "montadora";
  }
  return "oe";
}

/** Fonte estrangeira (ex.: catálogo europeu): vem depois das brasileiras. */
export function ehFonteEstrangeira(registro = {}) {
  return /EUROPA|EUROPE|\(EUA\)|USA|GLOBAL/i.test(String(registro.origem_catalogo || ""));
}

/** Ordem de prioridade: grupo (1-2-3) e, no mesmo grupo, Brasil antes do exterior. */
export function prioridadeDaFonte(registro = {}) {
  const grupo = GRUPOS_FABRICANTES.find((g) => g.id === grupoDaFonte(registro));
  return (grupo?.ordem || 2) * 10 + (ehFonteEstrangeira(registro) ? 5 : 0);
}

/*
 * ============================================================
 * DIVERGÊNCIA ENTRE FONTES
 * ============================================================
 * O mesmo código encontrado em catálogos diferentes com peça diferente
 * (ex.: "Compressor" numa fonte e "Condensador" noutra) é sinalizado para
 * conferência. Nada é escolhido automaticamente.
 */
const nomeBase = (peca) =>
  String(peca || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\b(PRE|POS)-CATALISADOR\b|\bUNIVERSAL\b|\bDO AR CONDICIONADO\b|\(.*?\)/g, "")
    .replace(/[^A-Z ]/g, " ")
    .split(/\s+/)
    .filter((p) => p.length > 2)
    .slice(0, 2)
    .join(" ");

export function divergenciaEntreFontes(registros = []) {
  const porOrigem = new Map();
  for (const r of registros) {
    const nome = nomeBase(r?.peca);
    if (!nome) continue;
    const origem = r?.origem_catalogo || "Base PAIIA";
    if (!porOrigem.has(origem)) porOrigem.set(origem, new Set());
    porOrigem.get(origem).add(nome);
  }
  if (porOrigem.size < 2) return null;
  const nomes = new Set([...porOrigem.values()].flatMap((s) => [...s]));
  if (nomes.size < 2) return null;
  return {
    mensagem: "Fontes divergentes: o mesmo código aparece como peças diferentes em catálogos diferentes. Confira antes de anunciar.",
    fontes: [...porOrigem.entries()].map(([origem, s]) => ({ origem, pecas: [...s] })),
  };
}

/*
 * ============================================================
 * PERÍODOS CONSECUTIVOS
 * ============================================================
 * Aplicações idênticas (mesma montadora, modelo, motor, peça, código e
 * origem) com anos seguidos ou sobrepostos viram UMA linha
 * ("2011 até 2016"). Nenhuma informação se perde: as linhas originais
 * ficam em "agrupadas" e as observações diferentes são somadas (ou não,
 * com juntarObservacoes = false — continuam nas linhas de "agrupadas").
 */
const chaveAplicacao = (r) =>
  [r.montadora, r.modelo, r.motor, r.peca, r.codigo_oem, r.origem_catalogo, r.tipo_referencia]
    .map((v) => String(v ?? "").trim().toUpperCase())
    .join("|");

export function agruparPeriodosConsecutivos(registros = [], { juntarObservacoes = true } = {}) {
  const grupos = new Map();
  const saida = [];
  for (const r of registros) {
    const temAnos = Number.isFinite(Number(r?.ano_inicio)) && r?.ano_inicio !== null && r?.ano_inicio !== "";
    if (!temAnos || !r?.montadora) {
      saida.push(r);
      continue;
    }
    const k = chaveAplicacao(r);
    if (!grupos.has(k)) {
      grupos.set(k, []);
      saida.push({ __grupo: k });
    }
    grupos.get(k).push(r);
  }
  const resultado = [];
  for (const item of saida) {
    if (!item?.__grupo) {
      resultado.push(item);
      continue;
    }
    const lista = [...grupos.get(item.__grupo)].sort((a, b) => Number(a.ano_inicio) - Number(b.ano_inicio));
    let atual = null;
    for (const r of lista) {
      const ini = Number(r.ano_inicio);
      const fim = r.ano_fim === null || r.ano_fim === undefined || r.ano_fim === "" ? null : Number(r.ano_fim);
      const fimAtual = atual ? atual.ano_fim : undefined;
      const encosta = atual && fimAtual !== null && ini <= Number(fimAtual) + 1;
      if (encosta) {
        atual.ano_fim = fim === null ? null : Math.max(Number(fimAtual), fim);
        atual.agrupadas.push(r);
        if (juntarObservacoes && r.observacao && !String(atual.observacao || "").includes(r.observacao)) {
          atual.observacao = [atual.observacao, r.observacao].filter(Boolean).join(" | ");
        }
      } else {
        if (atual) resultado.push(atual);
        atual = { ...r, ano_inicio: ini, ano_fim: fim, agrupadas: [r] };
      }
    }
    if (atual) resultado.push(atual);
  }
  return resultado.map((r) => {
    if (r?.agrupadas?.length !== 1) return r;
    const resto = { ...r };
    delete resto.agrupadas;
    return resto;
  });
}
