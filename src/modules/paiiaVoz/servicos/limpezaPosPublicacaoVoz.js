// =============================================================
// PAIIA Voz — (08/11) Limpeza automática depois da publicação.
//   Testes: scripts/testes/publicacaoSegundoPlano.test.mjs
//
// Publicou (MLB confirmado pelo Mercado Livre e salvo na ficha da conta) → o Voz abre
// com uma ficha nova e vazia, sem o botão "Nova ficha limpa".
//  • A ficha anterior fica salva: na conta (paiia_anuncios, com MLB, fotos, códigos,
//    aplicações, preço e histórico) e uma cópia neste aparelho (histórico local).
//  • Nada é apagado: nem a ficha da conta, nem a Galeria, nem as fotos deste aparelho.
//  • Ficha NÃO publicada (ou publicação que falhou): continua aberta como está.
// =============================================================
import { criarFichaVoz, guardarFichaVoz, lerFichaVoz, retirarDaListaVoz, CHAVE_COMPLEMENTO_VOZ } from "./fichaVoz.js";
import { guardarHistoricoVoz, marcarFichaPublicada, publicacaoDaFicha, vozDeveAbrirLimpo } from "../../../services/posPublicacao.js";

const txt = (v) => String(v ?? "").trim();

export function avisoFichaPublicada(ficha, mlb) {
  const cod = (ficha?.codigos || []).find((c) => c.principal)?.codigo || "";
  return `✅ A ficha anterior${cod ? ` (${cod})` : ""} foi publicada${mlb ? ` (${mlb})` : ""} e está salva na sua conta. Ficha nova e limpa: pode falar o próximo código.`;
}

/**
 * Troca a ficha publicada por uma nova e vazia. Devolve a ficha nova (já guardada).
 * Limpa só dados TEMPORÁRIOS da peça anterior (complemento da conferência); a lista
 * "Fichas guardadas" perde só esta ficha (que já está publicada e salva).
 */
export function limparAposPublicacao(fichaPublicada, mlb, { storage, agora = Date.now() } = {}) {
  const s = storage || globalThis.localStorage;
  guardarHistoricoVoz(fichaPublicada, mlb, { storage: s, agora });
  try { retirarDaListaVoz(fichaPublicada.id, s); } catch { /* sem lista */ }
  try { s.removeItem(CHAVE_COMPLEMENTO_VOZ); } catch { /* sem acesso */ }
  const nova = criarFichaVoz({ agora });
  guardarFichaVoz(nova, s);
  return nova;
}

/** Ao abrir o Voz: ficha publicada → ficha nova e limpa; senão a ficha de sempre. */
export function abrirFichaVoz({ storage, agora = Date.now() } = {}) {
  const f = lerFichaVoz(storage);
  if (!f) return { ficha: criarFichaVoz({ agora }), aviso: "" };
  const pub = publicacaoDaFicha(f.fichaIdPAIIA, { storage });
  if (!vozDeveAbrirLimpo(f, { publicacao: pub })) return { ficha: f, aviso: "" };
  return { ficha: limparAposPublicacao(f, pub.mlb, { storage, agora }), aviso: avisoFichaPublicada(f, pub.mlb), limpou: true };
}

/**
 * Outro aparelho publicou? Lê a ficha da conta (só leitura). Publicada com MLB → marca
 * localmente e devolve o MLB. Erro de leitura ou não publicada → "" (nada muda).
 */
export async function conferirPublicadaNaConta(ficha, { lerFicha, storage } = {}) {
  const id = txt(ficha?.fichaIdPAIIA);
  if (!id || !ficha?.enviadaEm || publicacaoDaFicha(id, { storage })) return "";
  let r;
  try { r = await lerFicha(id); } catch { return ""; }
  const mlb = txt(r?.ficha?.publicacao?.mlb_id).toUpperCase();
  if (!r?.ok || !/^MLB\d{6,}$/.test(mlb)) return "";
  marcarFichaPublicada(id, mlb, { storage });
  return mlb;
}
