// =============================================================
// PAIIA — (09/11) CATEGORIA PREFERIDA por tipo de peça (regra permanente: relés automotivos).
//   Configuração: src/config/preferenciasCategoriaML.js
//   Testes: scripts/testes/categoriaReles.test.mjs
//
//  • Reconhece o PRODUTO PRINCIPAL (ex.: “Relé Auxiliar 12V”), sem confundir com módulos,
//    temporizadores, pisca/intermitente, soquetes ou chicotes.
//  • O ID da categoria vem SEMPRE da API do Mercado Livre: o ID já aprendido (guardado neste
//    aparelho) ou o preditor oficial — e só vale se o caminho for exatamente o configurado,
//    a categoria aceitar anúncio e for a categoria final. Nada de código inventado.
//  • Esta categoria fica fora de “Acessórios para Veículos”: é a ÚNICA exceção permitida, e só
//    para a peça certa. Para outras peças continua exigindo revisão registrada.
// Só leitura: nada é gravado no Mercado Livre.
// =============================================================
import { PREFERENCIAS_CATEGORIA_ML } from "../config/preferenciasCategoriaML.js";

const semAcento = (v) => String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "");
const norm = (v) => ` ${semAcento(v).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
const txt = (v) => String(v ?? "").trim();

export const CHAVE_CATEGORIAS_PREFERIDAS = "paiiaCategoriaPreferida";
const PRIMEIRA_PALAVRA_RELE = new Set(["rele", "reles", "minirele", "microrele"]);

/** Preferência que vale para o produto principal do texto (título/nome técnico), ou null. */
export function preferenciaDaPeca(texto, preferencias = PREFERENCIAS_CATEGORIA_ML) {
  const t = norm(texto);
  if (!t.trim()) return null;
  for (const p of preferencias) {
    if ((p.excluir || []).some((x) => t.includes(norm(x)))) continue;
    const primeira = t.trim().split(" ")[0];
    if (PRIMEIRA_PALAVRA_RELE.has(primeira) || (p.principal || []).some((x) => t.includes(norm(x)))) return p;
  }
  return null;
}

export const ehReleAutomotivo = (texto) => preferenciaDaPeca(texto)?.id === "reles_automotivos";

/** O caminho lido no ML é exatamente o da preferência? */
export function caminhoDaPreferencia(niveis, pref) {
  const a = (Array.isArray(niveis) ? niveis : []).map((n) => norm(n));
  const b = (pref?.niveis || []).map((n) => norm(n));
  return a.length > 0 && a.length === b.length && a.every((n, i) => n === b[i]);
}

/** O termo digitado cita a categoria preferida (ex.: “Semicondutores”, “Componentes Eletrônicos”, “Relé”)? */
export function preferenciaDoTermo(termo, preferencias = PREFERENCIAS_CATEGORIA_ML) {
  const t = norm(termo);
  if (!t.trim()) return null;
  for (const p of preferencias) {
    if (p.niveis.slice(1).some((n) => t.includes(norm(n)) || norm(n).includes(t))) return p;
    if (preferenciaDaPeca(termo, [p])) return p;
  }
  return null;
}

/**
 * Categoria fora de “Acessórios para Veículos” permitida para ESTA peça?
 * (só a categoria preferida da própria peça; o resto continua bloqueado)
 */
export function permitidaForaDeVeiculos(detalhe, textoPeca) {
  const pref = preferenciaDaPeca(textoPeca);
  return Boolean(pref && caminhoDaPreferencia(detalhe?.niveis, pref));
}

const lerAprendidos = (s) => { try { return JSON.parse(s?.getItem(CHAVE_CATEGORIAS_PREFERIDAS) || "{}") || {}; } catch { return {}; } };
const armazenamento = (s) => s || (typeof globalThis.localStorage !== "undefined" ? globalThis.localStorage : null);

/** ID já confirmado pela API para esta preferência (neste aparelho), ou "". */
export function idAprendido(pref, { storage } = {}) {
  return txt(lerAprendidos(armazenamento(storage))[pref?.id]?.id).toUpperCase();
}

/** Guarda o ID confirmado pela API (só como atalho: é conferido de novo a cada uso). */
export function guardarIdAprendido(pref, { id, caminho }, { storage, agora = new Date().toISOString() } = {}) {
  const s = armazenamento(storage);
  if (!s || !pref?.id || !/^MLB\d+$/i.test(txt(id))) return false;
  try {
    const m = lerAprendidos(s);
    m[pref.id] = { id: txt(id).toUpperCase(), caminho: txt(caminho), conferidaEm: agora };
    s.setItem(CHAVE_CATEGORIAS_PREFERIDAS, JSON.stringify(m));
    return true;
  } catch {
    return false;
  }
}

/** Motivo para a categoria (com o caminho certo) NÃO servir agora, ou "". */
function motivoInvalida(det) {
  if (det?.listingAllowed === false) return "o Mercado Livre não aceita anúncios nela agora (listing_allowed = false)";
  if (Array.isArray(det?.filhos) && det.filhos.length) return "ela tem subcategorias (o Mercado Livre exige a categoria final)";
  return "";
}

/**
 * Acha o ID OFICIAL da categoria preferida na API do Mercado Livre e confere se continua ativa.
 * deps: { consultar(termos) → [{ sugestoes: [{category_id}] }], lerDetalhe(id) → detalhe, storage }
 * Devolve { ok, id, detalhe, caminho } ou { ok:false, id?, motivo }.
 */
export async function resolverCategoriaPreferida(pref, { consultar, lerDetalhe, storage } = {}) {
  if (!pref || typeof lerDetalhe !== "function") return { ok: false, motivo: "preferência não configurada" };
  const nome = pref.niveis.join(" > ");
  const vistos = new Set();
  let achada;
  const conferir = async (id) => {
    const c = txt(id).toUpperCase();
    if (!/^MLB\d+$/.test(c) || vistos.has(c)) return null;
    vistos.add(c);
    const det = await lerDetalhe(c);
    return det?.lido && caminhoDaPreferencia(det.niveis, pref) ? det : null;
  };
  achada = await conferir(idAprendido(pref, { storage }));
  if (!achada && typeof consultar === "function") {
    const consultas = await consultar([...pref.termosBusca]);
    for (const id of (consultas || []).flatMap((q) => (q?.sugestoes || []).map((s) => s?.category_id))) {
      achada = await conferir(id);
      if (achada) break;
    }
  }
  if (!achada) return { ok: false, motivo: `O Mercado Livre não devolveu agora a categoria “${nome}” (consulta à API sem resultado).` };
  const motivo = motivoInvalida(achada);
  if (motivo) return { ok: false, id: achada.id, detalhe: achada, motivo: `A categoria ${achada.id} — ${nome} não serve agora: ${motivo}.` };
  guardarIdAprendido(pref, { id: achada.id, caminho: achada.caminho || nome }, { storage });
  return { ok: true, id: achada.id, detalhe: achada, caminho: achada.caminho || nome };
}

/**
 * Valores fixos da preferência (ex.: Tipo de produto = “Relé”) — só quando o valor é
 * EXATAMENTE uma opção oficial do atributo na categoria. Formato de decisao.atributos.
 */
export function atributosFixosDaPreferencia(pref, { categoriaId, atributosBrutos } = {}) {
  const id = txt(categoriaId).toUpperCase();
  if (!pref?.atributosFixos || !id || !Array.isArray(atributosBrutos)) return null;
  const valores = {};
  for (const [attr, valor] of Object.entries(pref.atributosFixos)) {
    const a = atributosBrutos.find((x) => x?.id === attr);
    const o = (a?.values || []).find((v) => norm(v?.name) === norm(valor));
    if (o) valores[attr] = { value_id: String(o.id), value_name: String(o.name), nome: txt(a.name) || attr, origem: "ficha" };
  }
  return Object.keys(valores).length ? { categoria_id: id, valores } : null;
}
