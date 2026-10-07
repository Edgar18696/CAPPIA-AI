/*
 * PUBLICAÇÃO SEGURA — funções puras (sem React, sem rede).
 *
 * Regras definidas pelo usuário em 06/10/2026 (após o MLB7755979208):
 *  1. A Publicação usa a FICHA PERSISTIDA (paiia_anuncios.dados_conferencia)
 *     como fonte de verdade. Antes de VALIDAR e de novo antes de PUBLICAR a
 *     ficha é relida pelo ID e comparada com o que está na tela; havendo
 *     divergência relevante, nada é validado/publicado.
 *  2. "Aprovado" nunca aponta para dados diferentes dos atuais: a cópia
 *     aprovada é comparada campo a campo com os dados atuais.
 *  3. Modelos confirmados que não aparecem na descrição são avisados antes
 *     da aprovação/validação/publicação. Nada é completado sozinho.
 *  4. Base PAIIA (catalogo_pecas): só com o clique explícito "Confirmar
 *     gravação na base PAIIA"; lote já gravado é reconhecido e nunca é
 *     gravado de novo (F5, reabrir a ficha, duplo clique).
 * Testes: scripts/testes/publicacaoSegura.test.mjs
 */

// ---------------------------------------------------------------
// Normalização (compara CONTEÚDO, não formato)
// ---------------------------------------------------------------
const txt = (v) =>
  String(v ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");
const semAcento = (v) => String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "");
const num = (v) => {
  const t = String(v ?? "").trim();
  if (!t) return "";
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) ? n : t;
};
const qtd = (v) => {
  const t = String(v ?? "").trim();
  return /^\d+$/.test(t) && Number(t) >= 1 ? Number(t) : "";
};
const urlFoto = (f) =>
  typeof f === "string" ? f : f?.imagem_processada || f?.imagem_original || f?.url || f?.src || "";
// Só fotos com endereço público contam (imagem embutida não vai para a ficha
// nem para o Mercado Livre; não pode derrubar a aprovação depois do F5).
const fotos = (l) => (Array.isArray(l) ? l : []).map((f) => String(urlFoto(f) || "").trim()).filter((u) => /^https?:\/\//i.test(u));
const medida = (m) =>
  m && typeof m === "object" ? [num(m.peso_g), num(m.comprimento_cm), num(m.largura_cm), num(m.altura_cm)] : null;
const chaveModelo = (v) => semAcento(txt(v)).toUpperCase();
const modelos = (l) =>
  [...new Set((Array.isArray(l) ? l : []).map((a) => chaveModelo(typeof a === "string" ? a : `${a?.montadora || ""}|${a?.modelo || ""}`)).filter((x) => x && x !== "|"))].sort();
const aplicacoes = (l) =>
  [...new Set((Array.isArray(l) ? l : []).map((a) =>
    [a?.montadora, a?.modelo, a?.motor, a?.versao, a?.anoInicio ?? a?.ano_inicio, a?.anoFim ?? a?.ano_fim].map((x) => chaveModelo(x)).join("|")
  ))].sort();
const condicao = (v) => {
  const t = semAcento(String(v ?? "")).trim().toLowerCase();
  return ["novo", "nova", "new"].includes(t) ? "novo" : ["usado", "usada", "used"].includes(t) ? "usado" : t;
};
const tipoVeiculo = (v) => chaveModelo(typeof v === "object" && v ? v.value_name || v.nome || v.value_id || "" : v).replace(/\s*\/\s*/g, "/");

/**
 * Campos relevantes do anúncio aprovado (anuncioConferido). Qualquer
 * diferença real em um deles exige nova Conferência / bloqueia a publicação.
 */
export const CAMPOS_RELEVANTES = [
  ["titulo", "título", (a) => txt(a?.titulo)],
  ["descricao", "descrição", (a) => txt(a?.descricao)],
  ["preco", "preço", (a) => num(a?.preco)],
  ["marca", "marca", (a) => txt(a?.marca).toUpperCase()],
  ["fotos", "fotos", (a) => fotos(a?.fotos)],
  ["codigo", "SKU/código", (a) => txt(a?.codigo || a?.oem).toUpperCase()],
  ["tipoAnuncio", "tipo de anúncio", (a) => (a?.tipoAnuncio === undefined || a?.tipoAnuncio === null || a?.tipoAnuncio === "" ? "" : String(a.tipoAnuncio).toLowerCase() === "premium" ? "premium" : "classico")],
  ["gtin", "GTIN", (a) => txt(a?.gtin)],
  ["categoriaId", "categoria", (a) => txt(a?.categoriaId)],
  ["tipoVeiculo", "tipo de veículo", (a) => tipoVeiculo(a?.tipoVeiculo)],
  ["compatibilidades", "compatibilidades", (a) => txt(a?.compatibilidades)],
  ["modelosSemDetalhes", "modelos sem detalhes", (a) => modelos(a?.modelosSemDetalhes)],
  ["aplicacoesDetalhadas", "aplicações", (a) => aplicacoes(a?.aplicacoesDetalhadas)],
  ["logistica", "peso/medidas", (a) => medida(a?.logistica?.medida)],
  ["quantidade", "quantidade", (a) => qtd(a?.quantidade)],
  // Novos no fim (06/10/2026, após o MLB5342409793 sair "novo" com ficha "usado"):
  ["condicao", "condição", (a) => condicao(a?.condicao)],
  ["semCompatibilidadeConfirmada", "publicar sem compatibilidade", (a) => (a?.semCompatibilidadeConfirmada === true ? "sim" : "")],
];

/**
 * Campos relevantes diferentes entre dois anúncios (rótulos legíveis).
 * somenteCamposDe: campos ausentes (undefined) nesse lado não são comparados
 * — uma cópia aprovada antiga, de antes de o campo existir, não derruba nada.
 */
export function divergenciasAnuncio(atual, aprovado, { somenteCamposDe = null } = {}) {
  if (!atual || !aprovado) return ["ficha aprovada ausente"];
  const dif = [];
  for (const [chave, rotulo, canon] of CAMPOS_RELEVANTES) {
    if (somenteCamposDe && somenteCamposDe[chave] === undefined) continue;
    if (JSON.stringify(canon(atual)) !== JSON.stringify(canon(aprovado))) dif.push(rotulo);
  }
  return dif;
}

/** Impressão digital da cópia aprovada (o que foi validado = o que é publicado). */
export function digitalAnuncio(a) {
  if (!a) return "";
  return JSON.stringify(CAMPOS_RELEVANTES.map(([, , canon]) => canon(a)));
}

// ---------------------------------------------------------------
// Ficha persistida (paiia_anuncios) → cópia aprovada
// ---------------------------------------------------------------
/** Cópia aprovada guardada na ficha da base (ou null). */
export function aprovadoDaFicha(anuncioBase) {
  const ficha = anuncioBase?.dados_conferencia?.ficha || null;
  if (!ficha?.anuncioConferido || !ficha?.assinaturaAprovada) return null;
  return ficha.anuncioConferido;
}

/**
 * Antes de VALIDAR / PUBLICAR: compara a tela com a ficha persistida.
 *  tela    = anúncio aprovado que a Publicação está usando (memória);
 *  envio   = o que vai ao Mercado Livre (campos da tela de Publicação);
 *  base    = linha de paiia_anuncios lida AGORA pelo ID.
 * Devolve { ok, motivo, divergencias[], digital } — ok:false = NÃO segue.
 */
export function conferirFichaPersistida({ tela, envio, base }) {
  if (!base) return { ok: false, motivo: "Não foi possível reler a ficha deste anúncio na base PAIIA. Nada foi enviado.", divergencias: [] };
  const persistido = aprovadoDaFicha(base);
  if (!persistido) {
    return { ok: false, motivo: "A ficha gravada não tem uma Conferência aprovada. Refaça a Conferência antes de validar/publicar.", divergencias: [] };
  }
  // Campos que a cópia gravada não tem (ficha antiga) não são comparados.
  const divergencias = [...divergenciasAnuncio(tela, persistido, { somenteCamposDe: persistido })];
  // O que vai ao ML (Publicação) também precisa bater com a ficha.
  if (envio) {
    const doEnvio = {
      titulo: envio.titulo,
      descricao: envio.descricao,
      preco: envio.preco,
      marca: envio.marca,
      fotos: envio.fotos,
      codigo: envio.sku || envio.codigo,
      gtin: envio.gtin,
      categoriaId: envio.categoria_id,
      tipoAnuncio: envio.tipoAnuncio,
      quantidade: envio.quantidade,
      condicao: envio.condicao,
      logistica: envio.embalagem ? { medida: envio.embalagem } : undefined,
      // Tipo de veículo que vai ao ML (VEHICLE_TYPE) = o confirmado na ficha.
      tipoVeiculo: envio.tipo_veiculo,
    };
    // Título no ML: até 60 caracteres (a Publicação corta igual).
    const persistidoEnvio = { ...persistido, titulo: String(persistido.titulo || "").slice(0, 60), codigo: persistido.sku || persistido.codigo || persistido.oem };
    for (const d of divergenciasAnuncio(doEnvio, persistidoEnvio, { somenteCamposDe: doEnvio })) {
      // Sem categoria aprovada, a Publicação pode sugerir uma: não é divergência.
      if (d === "categoria" && !String(persistido.categoriaId || "").trim()) continue;
      // Ficha antiga sem quantidade na cópia aprovada: a quantidade é confirmada na Publicação.
      if (d === "quantidade" && !qtd(persistido.quantidade)) continue;
      if (!divergencias.includes(d)) divergencias.push(d);
    }
  }
  if (divergencias.length) {
    return {
      ok: false,
      motivo: `A tela está diferente da ficha gravada na base PAIIA (${divergencias.join(", ")}). Nada foi enviado ao Mercado Livre. Recarregue a ficha e confira de novo.`,
      divergencias,
    };
  }
  return { ok: true, motivo: "", divergencias: [], digital: digitalAnuncio(persistido) };
}

// ---------------------------------------------------------------
// Modelos confirmados × descrição
// ---------------------------------------------------------------
const palavraNormal = (v) => ` ${semAcento(String(v ?? "")).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;

/** Modelos confirmados (aplicações detalhadas + modelos sem detalhes), sem repetição. */
export function modelosConfirmados({ aplicacoes = [], modelosSemDetalhes = [] } = {}) {
  const vistos = new Map();
  for (const a of [...(aplicacoes || []), ...(modelosSemDetalhes || [])]) {
    const nome = txt(typeof a === "string" ? a : a?.modelo);
    const k = palavraNormal(nome).trim();
    if (k && !vistos.has(k)) vistos.set(k, nome);
  }
  return [...vistos.values()];
}

/**
 * Modelos confirmados que NÃO aparecem na descrição (palavra inteira, sem
 * diferenciar maiúsculas/acentos). Nunca altera a descrição.
 */
export function modelosFaltandoNaDescricao({ modelos: lista = [], descricao = "" } = {}) {
  const d = palavraNormal(descricao);
  return (lista || []).filter((m) => {
    const k = palavraNormal(m).trim();
    return k && !d.includes(` ${k} `);
  });
}

export const TEXTO_MODELOS_FALTANDO = "Há modelos confirmados que não aparecem na descrição.";

// ---------------------------------------------------------------
// Base PAIIA (catalogo_pecas) — autorização explícita + idempotência
// ---------------------------------------------------------------
/**
 * Situação da Base PAIIA guardada na ficha (dados_conferencia.base_paiia).
 * Lote gravado = gravacao com lote_id (ou ok:true / inseridos > 0), mesmo
 * em fichas antigas que guardaram a gravação sem o campo "ok".
 */
export function estadoBasePAIIA(base) {
  const b = base && typeof base === "object" ? base : null;
  const g = b?.gravacao && typeof b.gravacao === "object" ? b.gravacao : null;
  const revertido = Boolean(g?.revertido || g?.status === "revertido");
  const gravado = Boolean(g && !revertido && (g.lote_id || g.loteId || g.ok === true || Number(g.inseridos) > 0));
  return {
    decisao: b?.decisao || "",
    gravado,
    revertido,
    loteId: g?.lote_id || g?.loteId || "",
    inseridos: g?.inseridos ?? null,
    gravadoEm: g?.gravado_em || (gravado ? b?.decidido_em || "" : ""),
  };
}

/**
 * Pode gravar na base AGORA? Só com:
 *  - decisão "autorizado" (o usuário respondeu SIM),
 *  - clique explícito em "Confirmar gravação na base PAIIA" (confirmacao),
 *  - nenhum lote já gravado para esta ficha (relido da base),
 *  - nenhuma gravação em andamento.
 * Publicar, criar no Bling, estoque ou concluir a ficha NUNCA autorizam.
 */
export function podeGravarNaBase({ estado, confirmacao, emAndamento = false }) {
  if (confirmacao !== "CONFIRMAR_GRAVACAO_BASE_PAIIA") return { pode: false, motivo: "Gravação na base PAIIA só com o clique em \"Confirmar gravação na base PAIIA\"." };
  if (emAndamento) return { pode: false, motivo: "Gravação já em andamento." };
  if (!estado) return { pode: false, motivo: "Não foi possível reler a ficha: nada foi gravado." };
  if (estado.gravado) return { pode: false, jaGravado: true, motivo: `Já gravado na base PAIIA${estado.loteId ? ` (lote ${String(estado.loteId).slice(0, 8)})` : ""}. Nada foi gravado de novo.` };
  if (estado.decisao !== "autorizado") return { pode: false, motivo: "Sem autorização para gravar na base PAIIA (responda \"SIM, SALVAR NA BASE\" antes)." };
  return { pode: true, motivo: "" };
}

/** Nova decisão não pode apagar uma gravação já feita. */
export function decisaoBaseComGravacao(anterior, nova) {
  const est = estadoBasePAIIA(anterior);
  if (est.gravado) return { ...anterior, ...nova, decisao: "autorizado", gravacao: anterior.gravacao };
  return nova;
}

// ---------------------------------------------------------------
// Concorrência: nunca sobrescrever uma ficha mais nova com cópia antiga
// ---------------------------------------------------------------
/**
 * versaoEsperada = salvo_em que esta tela leu/gravou por último.
 * Se a base tem outra versão (gravada por outra aba/computador), NÃO grava.
 */
export function conflitoDeVersao({ versaoEsperada, versaoNaBase }) {
  const esperada = String(versaoEsperada || "");
  const naBase = String(versaoNaBase || "");
  if (!esperada || !naBase) return false; // ficha nova ou antiga sem versão
  return esperada !== naBase;
}

// ---------------------------------------------------------------
// Compatibilidade estruturada persistida na ficha (06/10/2026)
// ---------------------------------------------------------------
/**
 * Registro gravado em dados_conferencia.compatibilidades_ml: aplicações
 * aprovadas + versões do catálogo do ML que as confirmam (IDs MLB...).
 */
export function montarCompatibilidadesPersistidas({ aplicacoes = [], compat = null, agora = new Date().toISOString() } = {}) {
  const veiculos = (Array.isArray(compat?.veiculos) ? compat.veiculos : [])
    .filter((v) => /^MLB\d+$/.test(String(v?.id || "")))
    .map((v) => ({ id: String(v.id), nome: String(v.nome || ""), aplicacao: String(v.aplicacao || "") }));
  return {
    dominio: compat?.dominio || "MLB-CARS_AND_VANS",
    gerado_em: agora,
    aplicacoes: (Array.isArray(aplicacoes) ? aplicacoes : []).map((a) => ({
      montadora: a?.montadora || "", modelo: a?.modelo || "", motor: a?.motor || "",
      anoInicio: a?.anoInicio ?? null, anoFim: a?.anoFim ?? null,
    })),
    veiculos,
    total: veiculos.length,
    descartados: Array.isArray(compat?.descartados) ? compat.descartados.length : 0,
    sem_catalogo: Array.isArray(compat?.semCatalogo) ? compat.semCatalogo.map((s) => `${s.aplicacao}: ${s.motivo}`) : [],
  };
}

/** IDs persistidos na ficha (linha de paiia_anuncios), ordenados. */
export function idsCompatPersistidos(anuncioBase) {
  const l = anuncioBase?.dados_conferencia?.compatibilidades_ml?.veiculos;
  return Array.isArray(l) ? [...new Set(l.map((v) => String(v?.id || "")).filter(Boolean))].sort() : null;
}

/**
 * Antes de PUBLICAR: os IDs que serão enviados ao ML precisam ser os mesmos
 * gravados na ficha. { ok, motivo }.
 */
export function conferirCompatPersistida({ idsEnvio = [], base }) {
  const persistidos = idsCompatPersistidos(base);
  const envio = [...new Set((idsEnvio || []).map(String))].sort();
  if (!envio.length) return { ok: true, motivo: "" };
  if (!persistidos) return { ok: false, motivo: "As versões do catálogo do Mercado Livre não estão gravadas na ficha. Reconsulte o catálogo antes de publicar." };
  if (JSON.stringify(persistidos) !== JSON.stringify(envio)) {
    return { ok: false, motivo: `As compatibilidades na tela (${envio.length}) estão diferentes das gravadas na ficha (${persistidos.length}). Reconsulte o catálogo antes de publicar.` };
  }
  return { ok: true, motivo: "" };
}
