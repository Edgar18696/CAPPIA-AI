// =============================================================
// PAIIA — Black Friday 2026: CÓPIA DE SEGURANÇA DOS PREÇOS ORIGINAIS (17/11/2026).
//
// Antes de 27/11, guarda o preço normal de CADA anúncio ativo da conta (lido no ML),
// para a conferência de 01/12 saber o preço a que cada anúncio deve voltar.
// - Uma cópia por conta; nunca mistura contas.
// - Só é gravada ANTES do início da campanha (depois disso o preço lido pode já ter desconto).
// - Anúncio que já estava em promoção na leitura fica marcado (o preço normal dele é o original_price).
// - Fica no navegador E num arquivo que você baixa; o arquivo pode ser carregado de volta.
// Funções puras: não alteram preço, anúncio nem estoque; não gravam no banco.
// =============================================================
import { CAMPANHA_BF } from "./calendario.js";

const txt = (v) => (v === null || v === undefined ? "" : String(v)).trim();
const ms = (iso) => new Date(iso).getTime();
export const VERSAO_COPIA = 1;

export const chaveCopiaPrecos = (usuarioId, conta) => `paiiaBlackFriday:${CAMPANHA_BF.id}:precos-originais:${txt(usuarioId) || "sem-usuario"}:${txt(conta).replace(/\D/g, "")}`;

/**
 * Monta a cópia a partir da leitura COMPLETA de uma conta.
 * @returns {{ ok: true, copia } | { ok: false, motivo }}
 */
export function montarCopiaPrecos(leituraConta, { agora = new Date().toISOString(), campanha = CAMPANHA_BF } = {}) {
  if (!leituraConta?.conta) return { ok: false, motivo: "Consulte a conta antes de gravar a cópia." };
  if (leituraConta.completa === false) return { ok: false, motivo: "A leitura está incompleta: retome a consulta antes de gravar a cópia dos preços." };
  if (ms(agora) >= ms(campanha.inicio)) return { ok: false, motivo: "A campanha já começou: a cópia dos preços originais só é gravada antes do início (os preços lidos agora podem estar com desconto)." };
  const lidoEm = leituraConta.lido_em || agora;
  if (ms(lidoEm) >= ms(campanha.inicio)) return { ok: false, motivo: "Esta leitura foi feita depois do início da campanha." };
  const itens = {};
  let emPromocao = 0;
  for (const x of leituraConta.itens || []) {
    const it = x?.item;
    if (!it?.id || !(Number(it.price) > 0)) continue;
    if (String(it.seller_id ?? leituraConta.conta) !== String(leituraConta.conta)) continue; // nunca mistura contas
    const original = Number(it.original_price) > Number(it.price) ? Number(it.original_price) : (x.precoVenda?.ativa && Number(x.precoVenda.regular) > 0 ? Number(x.precoVenda.regular) : null);
    if (original) emPromocao++;
    itens[String(it.id).toUpperCase()] = { preco: Number(it.price), preco_normal: original || Number(it.price), em_promocao: !!original, sku: txt(it.seller_custom_field) || null, titulo: txt(it.title) };
  }
  const total = Object.keys(itens).length;
  if (!total) return { ok: false, motivo: "Nenhum anúncio com preço nesta leitura." };
  return { ok: true, copia: { tipo: "paiia-bf-precos-originais", versao: VERSAO_COPIA, campanha: campanha.id, conta: String(leituraConta.conta), nome: txt(leituraConta.nome), lido_em: lidoEm, gravado_em: agora, total, em_promocao: emPromocao, itens } };
}

/** Confere um arquivo/registro de cópia (formato, campanha e conta). */
export function validarCopia(obj, conta, campanha = CAMPANHA_BF) {
  if (!obj || obj.tipo !== "paiia-bf-precos-originais") return { ok: false, motivo: "Arquivo não é uma cópia de preços originais do PAIIA." };
  if (obj.campanha !== campanha.id) return { ok: false, motivo: `Cópia de outra campanha (${txt(obj.campanha)}).` };
  if (conta && String(obj.conta) !== String(conta)) return { ok: false, motivo: `Cópia de outra conta (${txt(obj.nome) || obj.conta}). Escolha essa conta antes de carregar.` };
  if (!obj.itens || typeof obj.itens !== "object" || !Object.keys(obj.itens).length) return { ok: false, motivo: "Cópia sem anúncios." };
  for (const [id, v] of Object.entries(obj.itens)) {
    if (!/^MLB\d+$/i.test(id) || !(Number(v?.preco_normal) > 0)) return { ok: false, motivo: `Cópia com item inválido (${id}).` };
  }
  return { ok: true, copia: obj };
}

/** Preço normal de referência por MLB (para a conferência de 01/12). */
export const precosDaCopia = (copia) => Object.fromEntries(Object.entries(copia?.itens || {}).map(([id, v]) => [id.toUpperCase(), Number(v.preco_normal)]));

/** Lê/grava no armazenamento do navegador (um registro por usuário e conta). */
export function lerCopiaGuardada(storage, usuarioId, conta) {
  try { const v = validarCopia(JSON.parse(storage.getItem(chaveCopiaPrecos(usuarioId, conta)) || "null"), conta); return v.ok ? v.copia : null; } catch { return null; }
}
export function guardarCopia(storage, usuarioId, copia) {
  try { storage.setItem(chaveCopiaPrecos(usuarioId, copia.conta), JSON.stringify(copia)); return true; } catch { return false; }
}
