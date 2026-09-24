// =============================================================
// PAIZINHO — MONTAR CAMPOS DO CRIAR ANÚNCIO A PARTIR DA PESQUISA
// -------------------------------------------------------------
// Usa SOMENTE dados confirmados em fonte original (resultado de
// validarResultadoPesquisa). Nada é inventado: campo sem confirmação
// fica vazio e entra na lista "não confirmado". O código digitado pelo
// usuário é preservado.
//
// Título e descrição seguem o padrão de anúncio da loja:
//   • título: [peça] + [modelos] + [motorização] + " - " + [código],
//     até 60 caracteres, sem marca e sem nome de montadora;
//   • descrição: nome do produto, "Compatível com os veículos:",
//     "Especificações Técnicas:", "Código de Referência:", garantia e
//     avisos — sem citar marca do item nem montadora.
// =============================================================

import { STATUS_PESQUISA } from "./validarResultadoPesquisa.js";

const LIMITE_TITULO = 60;

export const ORIGEM_PESQUISA = "Pesquisa externa PAIIA — fonte original";

function texto(v) {
  return String(v ?? "").replace(/\s+/g, " ").trim();
}

function capitalizar(frase) {
  const t = texto(frase);
  if (!t) return "";
  return t
    .toLowerCase()
    .split(" ")
    .map((p, i) => (p.length <= 2 && i > 0 ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(" ");
}

function periodo(a) {
  if (a.ano_inicio && a.ano_fim) return `${a.ano_inicio} à ${a.ano_fim}`;
  if (a.ano_inicio) return `${a.ano_inicio} em diante`;
  if (a.ano_fim) return `até ${a.ano_fim}`;
  return "";
}

function cortarTitulo(t) {
  const limpo = texto(t);
  if (limpo.length <= LIMITE_TITULO) return limpo;
  let saida = "";
  for (const p of limpo.split(" ")) {
    const tentativa = saida ? `${saida} ${p}` : p;
    if (tentativa.length > LIMITE_TITULO) break;
    saida = tentativa;
  }
  return saida;
}

function unicos(lista) {
  return [...new Set(lista.map(texto).filter(Boolean))];
}

export function montarTituloPesquisa({ codigoPesquisado, confirmado }) {
  const peca = capitalizar(confirmado?.descricao);
  if (!peca) return ""; // sem descrição confirmada, não inventa título
  const codigo = texto(codigoPesquisado);
  const sufixo = codigo ? ` - ${codigo}` : "";
  const aplicacoes = confirmado?.aplicacoes || [];
  const modelos = unicos(aplicacoes.map((a) => a.modelo));
  const motores = unicos(aplicacoes.map((a) => a.motor));

  let meio = "";
  const cabe = (m) => `${peca}${m ? " " + m : ""}${sufixo}`.length <= LIMITE_TITULO;
  for (const m of modelos) {
    const tentativa = meio ? `${meio} ${m}` : m;
    if (!cabe(tentativa)) break;
    meio = tentativa;
  }
  for (const m of motores) {
    const tentativa = meio ? `${meio} ${m}` : m;
    if (!cabe(tentativa)) break;
    meio = tentativa;
  }
  const titulo = `${peca}${meio ? " " + meio : ""}${sufixo}`;
  return titulo.length <= LIMITE_TITULO ? titulo : cortarTitulo(titulo);
}

function linhaVeiculo(a) {
  return [texto(a.modelo), texto(a.versao), texto(a.motor), texto(a.combustivel), periodo(a)]
    .filter(Boolean)
    .join(" ");
}

export function montarDescricaoPesquisa({ codigoPesquisado, confirmado }) {
  const peca = capitalizar(confirmado?.descricao);
  if (!peca) return ""; // sem saber o que é a peça, não gera descrição

  const linhas = [peca, ""];

  const aplicacoes = confirmado.aplicacoes || [];
  if (aplicacoes.length) {
    linhas.push("Compatível com os veículos:");
    for (const a of aplicacoes) linhas.push(linhaVeiculo(a));
    linhas.push("");
  }

  linhas.push("Especificações Técnicas:");
  linhas.push("Condição do item: Produto novo");
  for (const e of confirmado.especificacoes || []) {
    linhas.push(`${texto(e.nome)}: ${texto(e.valor)}`);
  }
  linhas.push("");

  const codigos = unicos([
    codigoPesquisado,
    ...(confirmado.codigosOem || []).map((c) => c.codigo),
    ...(confirmado.codigosSubstitutos || []).map((c) => c.codigo),
    ...(confirmado.codigosEquivalentes || []).map((c) => c.codigo),
  ]);
  linhas.push("Código de Referência:");
  linhas.push(codigos.join(" / "));
  linhas.push("");
  linhas.push("Garantia: 3 Meses");
  linhas.push("");
  linhas.push(
    "ATENÇÃO: Antes de efetuar a compra, verifique o código da peça instalada em seu veículo. A compatibilidade deve ser confirmada comparando o código informado neste anúncio com o código da peça do veículo."
  );
  linhas.push("");
  linhas.push(
    "IMPORTANTE: Para evitar a compra de uma peça incompatível, confira sempre o código da peça antes de realizar o pedido."
  );
  return linhas.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Lista clara do que NÃO foi confirmado em fonte original. */
export function listarNaoConfirmados(validado) {
  const c = validado?.confirmado || {};
  const lista = [];
  if (!c.descricao) lista.push("Nome/tipo da peça");
  if (!c.fabricante) lista.push("Fabricante");
  if (!c.codigosOem?.length) lista.push("Código OEM da montadora");
  if (!c.codigosSubstitutos?.length && !c.codigosEquivalentes?.length) {
    lista.push("Códigos substitutos/equivalentes");
  }
  const apps = c.aplicacoes || [];
  if (!apps.length) {
    lista.push("Aplicações (veículos, modelos, anos e motores)");
  } else {
    const semAno = apps.filter((a) => !a.ano_inicio && !a.ano_fim).length;
    const semMotor = apps.filter((a) => !a.motor).length;
    if (semAno) lista.push(`Anos de ${semAno} aplicação(ões) — a fonte não informa`);
    if (semMotor) lista.push(`Motor de ${semMotor} aplicação(ões) — a fonte não informa`);
    const semComb = apps.filter((a) => !a.combustivel).length;
    if (semComb) lista.push(`Combustível de ${semComb} aplicação(ões) — a fonte não informa`);
  }
  if (!c.especificacoes?.length) lista.push("Especificações técnicas");
  for (const cf of validado?.conflitos || []) lista.push(`${cf.campo} — fontes divergentes`);
  return lista;
}

/**
 * Converte o resultado validado nos campos do Criar Anúncio.
 * Retorna campos vazios quando não há confirmação.
 */
export function montarCamposCriarAnuncio(validado) {
  const codigoPesquisado = texto(validado?.codigoPesquisado);
  const confirmado = validado?.confirmado || {};
  const identificado =
    validado?.status === STATUS_PESQUISA.ENCONTRADO ||
    validado?.status === STATUS_PESQUISA.CONFLITO;
  const naoConfirmados = listarNaoConfirmados(identificado ? validado : { confirmado: {} });

  if (!identificado) {
    return {
      codigo: codigoPesquisado,
      oem: "",
      titulo: "",
      descricao: "",
      pecaEncontrada: null,
      naoConfirmados,
    };
  }

  // Com conflito entre fontes oficiais, título e descrição NÃO são gerados
  // automaticamente: a revisão humana decide. Os dados coerentes ficam no painel.
  const emConflito = validado?.status === STATUS_PESQUISA.CONFLITO;

  const oem = (confirmado.codigosOem || []).map((c) => c.codigo).join(", ");
  const equivalentes = unicos([
    ...(confirmado.codigosSubstitutos || []).map((c) => c.codigo),
    ...(confirmado.codigosEquivalentes || []).map((c) => c.codigo),
  ]).join(", ");
  const fontes = validado?.fontesOficiaisUsadas || [];

  const aplicacoes = (confirmado.aplicacoes || []).map((a) => ({
    montadora: a.montadora,
    modelo: [a.modelo, a.versao].filter(Boolean).join(" "),
    motor: a.motor,
    combustivel: a.combustivel || "",
    ano_inicio: a.ano_inicio,
    ano_fim: a.ano_fim,
    observacao: [a.combustivel ? `Combustível: ${a.combustivel}` : "", `Fonte: ${(a.fontes || []).join(" | ")}`]
      .filter(Boolean)
      .join(" | "),
    codigo_oem: codigoPesquisado,
    codigo_equivalente: oem,
    origem_catalogo: ORIGEM_PESQUISA,
    tipo_referencia: "aplicacao_veiculo",
    fontes: a.fontes,
  }));

  const unicaAplicacao = aplicacoes.length === 1 ? aplicacoes[0] : null;

  return {
    codigo: codigoPesquisado, // preservado exatamente como digitado
    oem,
    titulo: emConflito ? "" : montarTituloPesquisa({ codigoPesquisado, confirmado }),
    descricao: emConflito ? "" : montarDescricaoPesquisa({ codigoPesquisado, confirmado }),
    naoConfirmados,
    pecaEncontrada: {
      // formato compatível com o painel "Catálogo Oficial Consultado"
      peca: capitalizar(confirmado.descricao),
      fabricante: texto(confirmado.fabricante),
      codigo: codigoPesquisado,
      codigo_pesquisado: codigoPesquisado,
      codigo_oem: codigoPesquisado,
      codigo_equivalente: [oem, equivalentes].filter(Boolean).join(", "),
      codigos_oem_montadora: (confirmado.codigosOem || []).map((c) => c.codigo),
      codigos_substitutos: (confirmado.codigosSubstitutos || []).map((c) => c.codigo),
      codigos_equivalentes: (confirmado.codigosEquivalentes || []).map((c) => c.codigo),
      montadora: unicaAplicacao?.montadora || "",
      modelo: unicaAplicacao?.modelo || "",
      motor: unicaAplicacao?.motor || "",
      combustivel: unicaAplicacao?.combustivel || "",
      observacao: naoConfirmados.length
        ? `Não confirmado em fonte original: ${naoConfirmados.join("; ")}.`
        : "",
      origem_catalogo: fontes.length ? `${ORIGEM_PESQUISA}: ${fontes.join(" | ")}` : ORIGEM_PESQUISA,
      aplicacoes,
      especificacoes: confirmado.especificacoes || [],
      origem: "paizinho_fontes_originais",
      pendenteValidacao: false,
      emConflito,
      confianca: validado?.confianca || "baixa",
      fontes,
    },
  };
}
