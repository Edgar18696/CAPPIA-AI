// =============================================================
// PAIIA — ATRIBUTOS OBRIGATÓRIOS E CONDICIONAIS DA CATEGORIA (ML)
// -------------------------------------------------------------
// Usado pela função mercadolivre-publicacao (preparar/validar/publicar)
// e pelo site (Conferência e Publicação). Cópia IDÊNTICA em
// supabase/functions/_shared/categoriaPublicacaoML.js.
// JavaScript puro: sem rede, sem Deno, sem React.
//
// Regras:
// - Obrigatório = tags.required ou tags.catalog_required da categoria.
// - Condicional = tags.conditional_required. Só BLOQUEIA quando o próprio
//   Mercado Livre o exige para ESTE anúncio: consulta oficial POST
//   /categories/{id}/attributes/conditional ("required_attributes") ou
//   tag required/catalog_required. O PAIIA não é mais rígido que o ML.
// - EMPTY_GTIN_REASON (motivo de não ter GTIN): sem GTIN e o ML não exigiu
//   = só AVISO (opcional); exigido pelo ML = bloqueia e pede o valor.
//   (09/10/2026: em MLB116875 o ML validou sem o motivo, só com aviso.)
// - O PAIIA NUNCA escolhe o motivo sozinho: o valor tem de ser um dos
//   valores oficiais da categoria, escolhido pelo usuário.
// - Atributos da categoria não lidos = não dá para conferir = bloqueia.
// =============================================================

export const ATRIBUTO_MOTIVO_SEM_GTIN = "EMPTY_GTIN_REASON";

const txt = (v) => String(v ?? "").trim();
const soDigitos = (v) => txt(v).replace(/\D/g, "");

function valoresDe(a) {
  return (Array.isArray(a?.values) ? a.values : []).map((v) => ({ id: txt(v?.id), nome: txt(v?.name) })).filter((v) => v.id);
}

/** Obrigatórios e condicionais da categoria (lista de /categories/{id}/attributes). null = não lidos. */
export function resumoAtributosCategoria(atributos) {
  if (!Array.isArray(atributos)) return null;
  const obrigatorios = [];
  const condicionais = [];
  for (const a of atributos) {
    const id = txt(a?.id);
    if (!id) continue;
    const t = a?.tags || {};
    const item = { id, nome: txt(a?.name) || id, valores: valoresDe(a) };
    if (t.required || t.catalog_required) obrigatorios.push(item);
    else if (t.conditional_required) condicionais.push(item);
  }
  return { obrigatorios, condicionais };
}

/** Ids exigidos pela consulta oficial de condicionais (aceita objetos ou textos). */
export function idsExigidosML(resposta) {
  const lista = Array.isArray(resposta?.required_attributes) ? resposta.required_attributes : Array.isArray(resposta) ? resposta : [];
  return [...new Set(lista.map((x) => txt(typeof x === "string" ? x : x?.id)).filter(Boolean))];
}

/**
 * O que a categoria exige DESTE anúncio.
 *  atributos ......... lista da categoria (null = não lida → bloqueia)
 *  preenchidos ....... ids de atributos que o anúncio já envia/cobre
 *  gtin .............. GTIN da ficha ("" = sem GTIN)
 *  motivoSemGtin ..... { id, nome } escolhido pelo usuário (ou null)
 *  exigidosML ........ ids devolvidos pela consulta oficial de condicionais
 *                      (null = consulta não feita; só a regra do GTIN vale)
 * Devolve { ok, lidos, obrigatorios, condicionais, pendentes[], avisos[], enviar[], motivoSemGtin, motivoExigido, motivoSugerido }.
 * @param {{ atributos?: any[] | null, preenchidos?: string[], gtin?: string, motivoSemGtin?: { id?: string, nome?: string } | null, exigidosML?: string[] | null }} [entrada]
 */
export function exigenciasAtributos({ atributos, preenchidos = [], gtin = "", motivoSemGtin = null, exigidosML = null } = {}) {
  const resumo = resumoAtributosCategoria(atributos);
  if (!resumo) {
    return {
      ok: false, lidos: false, obrigatorios: [], condicionais: [], enviar: [], avisos: [], motivoSemGtin: null, motivoExigido: false, motivoSugerido: false,
      pendentes: [{ id: "", nome: "Atributos da categoria", tipo: "leitura", texto: "Os atributos da categoria não puderam ser lidos no Mercado Livre agora: obrigatórios e condicionais NÃO foram conferidos." }],
    };
  }
  const cobertos = new Set((preenchidos || []).map(txt).filter(Boolean));
  const pendentes = [];
  const avisos = [];
  const enviar = [];
  for (const o of resumo.obrigatorios) {
    if (!cobertos.has(o.id)) pendentes.push({ id: o.id, nome: o.nome, tipo: "obrigatorio", valores: o.valores, texto: `Atributo obrigatório da categoria sem valor: ${o.nome}.` });
  }
  // GTIN: com GTIN não precisa de motivo. Sem GTIN: BLOQUEIA só se o ML
  // exigir (consulta oficial ou tag required); senão é só AVISO opcional.
  const defMotivo = (atributos || []).find((a) => txt(a?.id) === ATRIBUTO_MOTIVO_SEM_GTIN) || null;
  const temGtin = Boolean(soDigitos(gtin));
  let motivoValido = null;
  const exigidoPeloML = Array.isArray(exigidosML) && exigidosML.includes(ATRIBUTO_MOTIVO_SEM_GTIN);
  const motivoExigido = Boolean(defMotivo && !temGtin && (exigidoPeloML || defMotivo.tags?.required || defMotivo.tags?.catalog_required));
  const motivoSugerido = Boolean(defMotivo && !temGtin && !motivoExigido && defMotivo.tags?.conditional_required);
  if (motivoExigido || motivoSugerido) {
    const valores = valoresDe(defMotivo);
    motivoValido = valores.find((v) => v.id === txt(motivoSemGtin?.id)) || null;
    // A pendência de obrigatório (se o ML marcar como required) vira esta, mais clara.
    for (let i = pendentes.length - 1; i >= 0; i--) if (pendentes[i].id === ATRIBUTO_MOTIVO_SEM_GTIN) pendentes.splice(i, 1);
    if (motivoValido) enviar.push({ id: ATRIBUTO_MOTIVO_SEM_GTIN, value_id: motivoValido.id });
    else if (motivoSugerido) {
      avisos.push({
        id: ATRIBUTO_MOTIVO_SEM_GTIN,
        nome: txt(defMotivo.name) || "Motivo de não ter GTIN",
        tipo: "aviso",
        valores,
        texto: motivoSemGtin?.id
          ? "AVISO: o motivo de ausência do GTIN escolhido não é um valor desta categoria e NÃO será enviado (o Mercado Livre não exigiu o motivo nesta validação)."
          : "AVISO: sem GTIN (código de barras). O Mercado Livre não exigiu o motivo de ausência nesta validação — informar é opcional.",
      });
    } else {
      pendentes.push({
        id: ATRIBUTO_MOTIVO_SEM_GTIN,
        nome: txt(defMotivo.name) || "Motivo de não ter GTIN",
        tipo: "condicional",
        valores,
        texto: motivoSemGtin?.id
          ? "O motivo de ausência do GTIN escolhido não é um valor aceito por esta categoria. Escolha um dos valores oficiais."
          : "Sem GTIN (código de barras): o Mercado Livre EXIGE o MOTIVO de ausência do GTIN para este anúncio. Escolha um dos valores oficiais — o PAIIA não escolhe sozinho.",
      });
    }
  }
  // Demais condicionais que a consulta oficial do ML disse serem exigidos agora.
  for (const id of Array.isArray(exigidosML) ? exigidosML : []) {
    if (id === ATRIBUTO_MOTIVO_SEM_GTIN || cobertos.has(id) || pendentes.some((p) => p.id === id)) continue;
    const def = resumo.condicionais.find((c) => c.id === id) || resumo.obrigatorios.find((c) => c.id === id) || { id, nome: id, valores: [] };
    pendentes.push({ id, nome: def.nome, tipo: "condicional", valores: def.valores, texto: `O Mercado Livre exige o atributo condicional ${def.nome} para este anúncio nesta categoria.` });
  }
  return { ok: pendentes.length === 0, lidos: true, obrigatorios: resumo.obrigatorios, condicionais: resumo.condicionais, pendentes, avisos, enviar, motivoSemGtin: motivoValido, motivoExigido, motivoSugerido };
}

/** Acrescenta ao item os atributos decididos (sem duplicar nem trocar os que já existem). */
export function aplicarAtributosDecididos(item, enviar = []) {
  const atributos = Array.isArray(item?.attributes) ? [...item.attributes] : [];
  for (const a of enviar || []) {
    if (!a?.id || atributos.some((x) => x?.id === a.id)) continue;
    atributos.push({ ...a });
  }
  return { ...(item || {}), attributes: atributos };
}
