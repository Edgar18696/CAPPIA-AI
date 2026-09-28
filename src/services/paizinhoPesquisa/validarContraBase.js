// =============================================================
// PAIZINHO — VALIDAÇÃO DA PESQUISA EXTERNA CONTRA A BASE PAIIA
// -------------------------------------------------------------
// O resultado da pesquisa externa NUNCA é aceito sozinho. Aqui ele é
// comparado com os registros que já temos (catálogos PDF importados):
//
//   • Mesma peça? fabricante e tipo de peça precisam bater com a base
//     (quando a base tem o código ou um código equivalente/OEM).
//   • Cada aplicação externa recebe um veredito:
//       corroborada_pela_base  → a base (catálogo importado) tem o mesmo
//                                veículo para o código ou equivalente
//       fonte_oficial_forte    → 2+ fontes oficiais diferentes concordam
//                                (mesmo veículo, cilindrada e anos)
//       conflito_entre_fontes  → fontes externas com anos diferentes
//       nao_confirmada         → só uma pista fraca: NÃO preenche
//       conflito_com_base      → anos divergentes da base: NÃO preenche
//   • Divergência de fabricante/tipo de peça → nada é preenchido.
//
// Nada é gravado aqui. Quando o resultado é seguro, só PREPARA a
// proposta de incorporação à Base PAIIA (linhas prontas), que fica
// aguardando aprovação. Zero informação é melhor que aplicação errada.
// =============================================================

import { supabase } from "../../supabase";
import { normalizarCodigo, variantesEscrita } from "./codigoPaizinho.js";
import { STATUS_PESQUISA, chaveFabricante, familiaPeca } from "./validarResultadoPesquisa.js";
import {
  ORIGEM_PESQUISA_EXTERNA,
  montarLinhasBase,
  podeGravarNaBase,
} from "./gravarPesquisaNaBase.js";

export const VEREDITO_APLICACAO = {
  CORROBORADA: "corroborada_pela_base",
  FONTE_FORTE: "fonte_oficial_forte",
  NAO_CONFIRMADA: "nao_confirmada",
  CONFLITO: "conflito_com_base",
  CONFLITO_FONTES: "conflito_entre_fontes",
};

export const ROTULO_VEREDITO = {
  corroborada_pela_base: "Confirmada: consta no catálogo interno PAIIA",
  fonte_oficial_forte: "Confirmada: 2 fontes oficiais concordam (veículo, motor e anos)",
  nao_confirmada: "Não confirmado — revisão",
  conflito_com_base: "Não confirmado — diverge do catálogo interno",
  conflito_entre_fontes: "Não confirmado — fontes externas informam anos diferentes",
};

export const ORIGEM = {
  CATALOGO_INTERNO: "Catálogo interno PAIIA",
  ARQUIVO_ORIGINAL: "Arquivo original (PDF importado)",
  PESQUISA_EXTERNA: "Pesquisa externa",
};

const CAMPOS_BASE =
  "id,codigo_oem,codigo_equivalente,fabricante,peca,montadora,modelo,motor,ano_inicio,ano_fim,origem_catalogo,observacao";

function texto(v) {
  return String(v ?? "").replace(/\s+/g, " ").trim();
}

function chaveTexto(v) {
  return texto(v)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const APELIDOS_MONTADORA = [
  [/^(vw|volkswagen)/, "volkswagen"],
  [/^(gm|chevrolet|chevy)/, "chevrolet"],
  [/^(mercedes|mb\b|mercedes benz)/, "mercedes"],
  [/^(citroen|citroën)/, "citroen"],
  [/^(hyundai|hyunday)/, "hyundai"],
];

export function chaveMontadora(v) {
  const k = chaveTexto(v);
  for (const [re, nome] of APELIDOS_MONTADORA) if (re.test(k)) return nome;
  return k.split(" ")[0] || "";
}

// Grupos citados como "montadora" em catálogos (ex.: "PSA C3" = Citroën C3).
const GRUPOS_MONTADORA = {
  psa: ["citroen", "peugeot", "ds"],
  stellantis: ["fiat", "jeep", "citroen", "peugeot", "chrysler", "dodge", "ram", "ds"],
};

export function montadoraCompativel(a, b) {
  const x = chaveMontadora(a);
  const y = chaveMontadora(b);
  if (!x || !y) return false;
  if (x === y) return true;
  return Boolean(GRUPOS_MONTADORA[x]?.includes(y) || GRUPOS_MONTADORA[y]?.includes(x));
}

// Nome do modelo sem números/motor: "PALIO WEEKEND 1.6 L4 E-TORQ" → "palio weekend"
const PALAVRAS_MOTOR = new Set(["l4", "l6", "v6", "v8", "cil", "e", "torq", "etorq", "flex", "turbo", "tsi", "mpi", "fire", "evo", "sohc", "dohc"]);
function nomeModelo(v) {
  const partes = chaveTexto(v).split(" ").filter(Boolean);
  if (!partes.length) return "";
  // 1ª palavra é sempre o modelo ("206", "C3"); depois só palavras sem números
  const [primeira, ...resto] = partes;
  return [primeira, ...resto.filter((p) => !/\d/.test(p) && !PALAVRAS_MOTOR.has(p))].join(" ");
}

function cilindrada(a) {
  const m = texto([a.modelo, a.versao, a.motor].join(" ")).match(/(\d)[.,](\d)/);
  return m ? `${m[1]}.${m[2]}` : "";
}

/**
 * Mesmo veículo (montadora + nome do modelo + cilindrada) com anos
 * diferentes em fontes externas = conflito entre fontes.
 */
export function conflitoDeAnosEntreFontes(a, todas) {
  const nomeA = nomeModelo(a.modelo);
  const cilA = cilindrada(a);
  return todas.some((b) => {
    if (b === a) return false;
    if (!montadoraCompativel(a.montadora, b.montadora)) return false;
    if (!nomeA || nomeA !== nomeModelo(b.modelo)) return false;
    const cilB = cilindrada(b);
    if (cilA && cilB && cilA !== cilB) return false;
    // Fonte sem ano não contradiz ninguém; só há conflito com anos dos dois lados.
    const temAnoA = a.ano_inicio != null || a.ano_fim != null;
    const temAnoB = b.ano_inicio != null || b.ano_fim != null;
    if (!temAnoA || !temAnoB) return false;
    return (a.ano_inicio ?? null) !== (b.ano_inicio ?? null) || (a.ano_fim ?? null) !== (b.ano_fim ?? null);
  });
}

/** "Santa Fe 2.7 V6" × "SANTA FÉ" → mesma família de modelo? */
export function mesmoModelo(a, b) {
  const x = chaveTexto(a);
  const y = chaveTexto(b);
  if (!x || !y) return false;
  // Variantes que são OUTRO veículo para aplicação (Palio × Palio Weekend)
  if (["weekend"].some((w) => x.split(" ").includes(w) !== y.split(" ").includes(w))) return false;
  if (x === y || x.startsWith(`${y} `) || y.startsWith(`${x} `)) return true;
  const px = x.split(" ").filter((p) => p.length >= 2 && !/^\d/.test(p));
  const py = y.split(" ").filter((p) => p.length >= 2 && !/^\d/.test(p));
  if (!px.length || !py.length) return false;
  // primeiro nome do modelo precisa bater (evita "Gol" casar com "Golf")
  return px[0] === py[0];
}

function ano(v) {
  const n = parseInt(String(v ?? "").replace(/\D/g, ""), 10);
  return Number.isFinite(n) && n >= 1950 && n <= 2100 ? n : null;
}

/** true = períodos compatíveis (ou algum sem ano); false = não se cruzam */
export function anosCompativeis(a, b) {
  const a1 = ano(a.ano_inicio);
  const a2 = ano(a.ano_fim) ?? a1;
  const b1 = ano(b.ano_inicio);
  const b2 = ano(b.ano_fim) ?? b1;
  if (a1 == null || b1 == null) return true;
  return a1 <= (b2 ?? 2100) && b1 <= (a2 ?? 2100);
}

/** Registros da base (exceto os da própria pesquisa externa) para os códigos. */
export async function buscarRegistrosRelacionados(codigos, { cliente = supabase, limiteCodigos = 10 } = {}) {
  const formas = new Set();
  const principais = [];
  for (const c of codigos) {
    const k = normalizarCodigo(c);
    if (!k || principais.includes(k)) continue;
    principais.push(k);
  }
  principais.slice(0, limiteCodigos).forEach((k, i) => {
    formas.add(k);
    // formas de escrita só para o código digitado (o primeiro)
    if (i === 0) for (const f of variantesEscrita(k)) formas.add(f);
  });
  const lista = [...formas].slice(0, 16);
  const consultas = [];
  for (const forma of lista) {
    for (const coluna of ["codigo_oem", "codigo_equivalente"]) {
      consultas.push(
        cliente
          .from("catalogo_pecas")
          .select(CAMPOS_BASE)
          .eq(coluna, forma)
          .eq("ativo", true)
          .limit(200)
          .then((r) => ({ forma, coluna, ...r }))
      );
    }
  }
  const respostas = await Promise.allSettled(consultas);
  const vistos = new Set();
  const registros = [];
  const erros = [];
  for (const r of respostas) {
    if (r.status !== "fulfilled") {
      erros.push(String(r.reason?.message || r.reason));
      continue;
    }
    if (r.value.error) {
      erros.push(r.value.error.message);
      continue;
    }
    for (const reg of r.value.data || []) {
      if (texto(reg.origem_catalogo) === ORIGEM_PESQUISA_EXTERNA) continue; // não é evidência independente
      if (vistos.has(reg.id)) continue;
      vistos.add(reg.id);
      registros.push({ ...reg, codigoRelacionado: r.value.forma });
    }
  }
  return { registros, erros, codigosConsultados: principais.slice(0, limiteCodigos) };
}

function fonteOficial(url, consultadas) {
  const f = (consultadas || []).find((x) => x.url === url);
  return Boolean(f && f.oficial && f.prioridade <= 3);
}

/** Outra fonte oficial (URL diferente) traz o mesmo veículo com os mesmos anos? */
export function concordaComOutraFonte(a, todas, consultadas) {
  const nomeA = nomeModelo(a.modelo);
  const cilA = cilindrada(a);
  if (!nomeA || a.ano_inicio == null) return false;
  const fontesA = new Set(a.fontes || []);
  return todas.some((b) => {
    if (b === a) return false;
    const outras = (b.fontes || []).filter((u) => !fontesA.has(u) && fonteOficial(u, consultadas));
    if (!outras.length) return false;
    if (!montadoraCompativel(a.montadora, b.montadora) || nomeA !== nomeModelo(b.modelo)) return false;
    const cilB = cilindrada(b);
    if (!cilA || !cilB || cilA !== cilB) return false;
    return (a.ano_inicio ?? null) === (b.ano_inicio ?? null) && (a.ano_fim ?? null) === (b.ano_fim ?? null);
  });
}

/**
 * Compara o resultado validado da pesquisa externa com a Base PAIIA.
 * Puro quanto à decisão; a busca de registros é injetável (testes).
 */
export function compararPesquisaComRegistros(validado, registros, { pecaBase = null } = {}) {
  const c = validado?.confirmado || {};
  const consultadas = validado?.fontesConsultadas || [];
  const divergencias = [];

  // Mesma peça? Fabricante: só contra registros do PRÓPRIO código (peças
  // equivalentes/OEM são de outras marcas por natureza). Tipo de peça:
  // contra todos os registros relacionados.
  const codigoNorm = normalizarCodigo(validado?.codigoPesquisado);
  const diretos = registros.filter((r) => codigoNorm && normalizarCodigo(r.codigo_oem) === codigoNorm);
  const referencias = [pecaBase, ...registros].filter(Boolean);
  const referenciasFab = [pecaBase, ...diretos].filter(Boolean);
  const fabs = [...new Set(referenciasFab.map((r) => chaveFabricante(r.fabricante)).filter(Boolean))];
  const fabExt = c.fabricante ? chaveFabricante(c.fabricante) : "";
  if (fabExt && fabs.length && !fabs.includes(fabExt)) {
    divergencias.push(
      `Fabricante: catálogo interno “${referenciasFab.find((r) => r.fabricante)?.fabricante}” × pesquisa externa “${c.fabricante}”`
    );
  }
  const tipos = [...new Set(referencias.map((r) => familiaPeca(r.peca)).filter(Boolean))];
  const descricaoTipo = c.descricao || c.descricaoReferencia || "";
  const tipoExt = descricaoTipo ? familiaPeca(descricaoTipo) : "";
  if (tipoExt && tipos.length && !tipos.includes(tipoExt)) {
    divergencias.push(
      `Tipo de peça: catálogo interno “${referencias.find((r) => r.peca)?.peca}” × pesquisa externa “${descricaoTipo}”`
    );
  }

  // Registros de OUTROS códigos (equivalentes) só servem de prova de
  // aplicação quando o tipo de peça externo é conhecido (e já conferido acima).
  const registrosAplicacao = diretos.length || tipoExt ? registros : [];
  const registrosComVeiculo = registrosAplicacao.filter((r) => texto(r.montadora) && texto(r.modelo));
  const todasExternas = c.aplicacoes || [];
  const aplicacoes = todasExternas.map((a) => {
    const cilA = cilindrada(a);
    const mesmos = registrosComVeiculo.filter((r) => {
      if (!montadoraCompativel(r.montadora, a.montadora) || !mesmoModelo(r.modelo, a.modelo)) return false;
      // 1.4 não confirma 1.8: com cilindrada dos dois lados, precisa bater
      const cilR = cilindrada(r);
      return !(cilA && cilR && cilA !== cilR);
    });
    const compativeis = mesmos.filter((r) => anosCompativeis(r, a));
    // Evidência forte = 2+ fontes oficiais DIFERENTES com o mesmo veículo e
    // os mesmos anos. Uma página só (mesmo verificada) não basta: a leitura
    // da IA pode errar motor/ano, e aplicação errada é pior que nenhuma.
    const forte = (a.confirmacoes || 0) >= 2 || concordaComOutraFonte(a, todasExternas, consultadas);
    let veredito;
    let referencia = null;
    if (compativeis.length) {
      veredito = VEREDITO_APLICACAO.CORROBORADA;
      referencia = compativeis[0];
    } else if (mesmos.length) {
      veredito = VEREDITO_APLICACAO.CONFLITO; // mesmo veículo, anos que não se cruzam
      referencia = mesmos[0];
    } else if (conflitoDeAnosEntreFontes(a, todasExternas)) {
      veredito = VEREDITO_APLICACAO.CONFLITO_FONTES;
    } else if (forte) {
      veredito = VEREDITO_APLICACAO.FONTE_FORTE;
    } else {
      veredito = VEREDITO_APLICACAO.NAO_CONFIRMADA;
    }
    // Corroborada: o anúncio usa o veículo como está no catálogo interno
    // (montadora/modelo/motor/anos do PDF importado); o texto externo fica guardado.
    const dadosVeiculo =
      veredito === VEREDITO_APLICACAO.CORROBORADA && referencia
        ? {
            montadora: texto(referencia.montadora) || a.montadora,
            modelo: texto(referencia.modelo) || a.modelo,
            motor: texto(referencia.motor),
            ano_inicio: referencia.ano_inicio ?? a.ano_inicio ?? null,
            ano_fim: referencia.ano_fim ?? a.ano_fim ?? null,
            aplicacaoExterna: {
              montadora: a.montadora,
              modelo: a.modelo,
              motor: a.motor,
              ano_inicio: a.ano_inicio ?? null,
              ano_fim: a.ano_fim ?? null,
            },
          }
        : {};
    return {
      ...a,
      ...dadosVeiculo,
      veredito,
      vereditoRotulo: ROTULO_VEREDITO[veredito],
      referenciaBase: referencia
        ? {
            codigo: referencia.codigo_oem,
            origem: referencia.origem_catalogo,
            observacao: String(referencia.observacao || "").slice(0, 160) || null,
            veiculo: [referencia.montadora, referencia.modelo, referencia.motor].filter(Boolean).join(" "),
            anos: [referencia.ano_inicio, referencia.ano_fim].filter(Boolean).join("–"),
          }
        : null,
    };
  });

  let situacao;
  if (divergencias.length) situacao = "divergente";
  else if (aplicacoes.some((a) => a.veredito === VEREDITO_APLICACAO.CORROBORADA)) situacao = "corroborada";
  else if (registros.length) situacao = "base_sem_mesmo_veiculo";
  else situacao = "sem_registro_na_base";

  return { situacao, divergencias, aplicacoes, registrosBase: registros.length, registrosDiretos: diretos.length };
}

const ACEITAS = new Set([VEREDITO_APLICACAO.CORROBORADA, VEREDITO_APLICACAO.FONTE_FORTE]);

/**
 * Aplica o resultado da comparação: só o que tem evidência confiável
 * fica em "confirmado" (e vai para os campos do anúncio). O resto fica
 * listado como "Não confirmado" para revisão.
 */
export function aplicarValidacaoBase(validado, comparacao) {
  if (!validado) return validado;
  const c = validado.confirmado || {};
  const identificado =
    validado.status === STATUS_PESQUISA.ENCONTRADO || validado.status === STATUS_PESQUISA.CONFLITO;

  const resultado = {
    ...validado,
    validacaoBase: comparacao,
    aplicacoesNaoConfirmadas: [],
  };
  if (!identificado || !comparacao) return resultado;

  if (comparacao.divergencias.length) {
    // Mesma peça não garantida: nada externo é usado.
    resultado.status = STATUS_PESQUISA.CONFLITO;
    resultado.mensagem = "A pesquisa externa diverge do catálogo interno PAIIA — Não confirmado, revisão necessária.";
    resultado.conflitos = [
      ...(validado.conflitos || []),
      ...comparacao.divergencias.map((d) => ({ campo: d, valores: [] })),
    ];
    resultado.aplicacoesNaoConfirmadas = comparacao.aplicacoes.map((a) => ({
      ...a,
      veredito: VEREDITO_APLICACAO.CONFLITO,
      vereditoRotulo: "Não confirmado — a peça pesquisada diverge do catálogo interno",
    }));
    resultado.confirmado = { ...c, aplicacoes: [] };
    return resultado;
  }

  // Sem duplicatas (duas fontes externas podem apontar para o mesmo veículo da base)
  const vistas = new Set();
  const aceitas = comparacao.aplicacoes.filter((a) => {
    if (!ACEITAS.has(a.veredito)) return false;
    const k =
      a.veredito === VEREDITO_APLICACAO.FONTE_FORTE
        ? [chaveMontadora(a.montadora), nomeModelo(a.modelo), cilindrada(a), a.ano_inicio, a.ano_fim].join("|")
        : [a.montadora, a.modelo, a.versao, a.motor, a.ano_inicio, a.ano_fim].map(chaveTexto).join("|");
    if (vistas.has(k)) return false;
    vistas.add(k);
    return true;
  });
  resultado.aplicacoesNaoConfirmadas = comparacao.aplicacoes.filter((a) => !ACEITAS.has(a.veredito));
  resultado.confirmado = { ...c, aplicacoes: aceitas };
  return resultado;
}

/** Origem de cada informação do resultado externo (para o painel e a auditoria). */
export function mapearOrigens(validado) {
  const c = validado?.confirmado || {};
  const ext = (fontes) => ({ origem: ORIGEM.PESQUISA_EXTERNA, fontes: fontes || [] });
  const origens = {};
  if (c.fabricante) origens.fabricante = ext(c.fabricanteFontes);
  if (c.descricao) origens.descricao = ext(c.descricaoFontes);
  if ((c.codigosOem || []).length) origens.codigosOem = ext([...new Set(c.codigosOem.flatMap((x) => x.fontes || []))]);
  if ((c.codigosEquivalentes || []).length || (c.codigosSubstitutos || []).length) {
    origens.codigosEquivalentes = ext([
      ...new Set([...(c.codigosEquivalentes || []), ...(c.codigosSubstitutos || [])].flatMap((x) => x.fontes || [])),
    ]);
  }
  origens.aplicacoes = (c.aplicacoes || []).map((a) => ({
    veiculo: [a.montadora, a.modelo, a.versao, a.motor].filter(Boolean).join(" "),
    anos: [a.ano_inicio, a.ano_fim].filter(Boolean).join("–"),
    origem:
      a.veredito === VEREDITO_APLICACAO.CORROBORADA
        ? `${ORIGEM.PESQUISA_EXTERNA} + ${ORIGEM.CATALOGO_INTERNO}`
        : ORIGEM.PESQUISA_EXTERNA,
    fontes: a.fontes || [],
    catalogoInterno: a.referenciaBase?.origem || null,
    veredito: a.vereditoRotulo || "",
  }));
  return origens;
}

/**
 * Prepara (sem gravar) a incorporação à Base PAIIA do que foi validado.
 * Fica "aguardando aprovação"; nada entra na base automaticamente.
 */
export function prepararIncorporacao(validado, { dataConsulta = new Date() } = {}) {
  const decisao = podeGravarNaBase(validado);
  if (validado?.status !== STATUS_PESQUISA.ENCONTRADO) {
    return { pronta: false, motivo: decisao.motivo || "Resultado com conflito ou não identificado — nada a incorporar.", linhas: [] };
  }
  if (!decisao.pode) return { pronta: false, motivo: decisao.motivo, linhas: [] };
  // Só o que é NOVO: aplicação corroborada já está no catálogo interno.
  const aplicacoesConfirmadas = validado.confirmado?.aplicacoes || [];
  const novas = aplicacoesConfirmadas.filter((a) => a.veredito !== VEREDITO_APLICACAO.CORROBORADA);
  const jaNaBase = (validado.validacaoBase?.registrosDiretos || 0) > 0;
  if (jaNaBase && !novas.length) {
    return {
      pronta: false,
      motivo: "O código já consta no catálogo interno PAIIA e nenhuma aplicação nova foi confirmada — nada a incorporar.",
      linhas: [],
    };
  }
  if (aplicacoesConfirmadas.length && !novas.length) {
    return { pronta: false, motivo: "Aplicações já constam no catálogo interno PAIIA — nada novo a incorporar.", linhas: [] };
  }
  const linhas = montarLinhasBase(
    { ...validado, confirmado: { ...(validado.confirmado || {}), aplicacoes: novas } },
    { dataConsulta }
  );
  return {
    pronta: true,
    situacao: "aguardando_aprovacao",
    motivo: "",
    codigo: validado.codigoPesquisado,
    preparadaEm: new Date(dataConsulta).toISOString(),
    fontes: validado.fontesOficiaisUsadas || [],
    validacaoBase: validado.validacaoBase?.situacao || "",
    linhas,
  };
}

/** Busca + comparação + aplicação, em um passo (usado pelo orquestrador). */
export async function validarPesquisaContraBase(validado, { cliente = supabase, pecaBase = null } = {}) {
  const c = validado?.confirmado || {};
  const codigos = [
    validado?.codigoPesquisado,
    ...(c.codigosOem || []).map((x) => x.codigo),
    ...(c.codigosEquivalentes || []).map((x) => x.codigo),
    ...(c.codigosSubstitutos || []).map((x) => x.codigo),
  ].filter(Boolean);
  let busca = { registros: [], erros: [], codigosConsultados: [] };
  try {
    busca = await buscarRegistrosRelacionados(codigos, { cliente });
  } catch (e) {
    busca.erros.push(String(e?.message || e));
  }
  // Base inacessível (todas as consultas falharam): não há como validar,
  // então nenhuma aplicação externa é aceita e nada fica pronto para incorporar.
  if (busca.erros.length && !busca.registros.length) {
    const aplicacoesExternas = c.aplicacoes || [];
    const falha = {
      ...validado,
      confirmado: { ...c, aplicacoes: [] },
      aplicacoesNaoConfirmadas: aplicacoesExternas.map((a) => ({
        ...a,
        veredito: VEREDITO_APLICACAO.NAO_CONFIRMADA,
        vereditoRotulo: ROTULO_VEREDITO[VEREDITO_APLICACAO.NAO_CONFIRMADA],
      })),
      validacaoBase: {
        situacao: "falha_na_comparacao",
        divergencias: [],
        aplicacoes: [],
        registrosBase: 0,
        codigosConsultados: busca.codigosConsultados,
        errosConsulta: busca.erros,
      },
    };
    falha.origens = mapearOrigens(falha);
    falha.propostaIncorporacao = {
      pronta: false,
      motivo: "Não foi possível comparar com a Base PAIIA — nada a incorporar.",
      linhas: [],
    };
    return falha;
  }
  const comparacao = compararPesquisaComRegistros(validado, busca.registros, { pecaBase });
  comparacao.codigosConsultados = busca.codigosConsultados;
  comparacao.errosConsulta = busca.erros;
  const aplicado = aplicarValidacaoBase(validado, comparacao);
  aplicado.origens = mapearOrigens(aplicado);
  aplicado.propostaIncorporacao = prepararIncorporacao(aplicado);
  return aplicado;
}
