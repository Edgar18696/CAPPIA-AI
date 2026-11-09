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
import { criarFichaVoz, guardarFichaVoz, guardarNaListaVoz, lerFichaVoz, retirarDaListaVoz, CHAVE_COMPLEMENTO_VOZ } from "./fichaVoz.js";
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

// -------------------------------------------------------------
// (09/11) Publicação PENDENTE ou PAUSADA: "Salvar e Criar Próximo Anúncio".
// A ficha já está salva na conta (fichaIdPAIIA + enviadaEm): vai para "Fichas guardadas"
// neste aparelho, inteira (fotos, códigos, descrição, aplicações), e o Voz abre vazio.
// NÃO é marcada publicada; continua na Central de Publicação com o status real. Nada é
// enviado ao Mercado Livre: para publicar, abra a ficha de novo e autorize.
// -------------------------------------------------------------
export const CHAVE_VOZ_LIBERADAS = "paiiaVozLiberadas";

const lerLiberadas = (s) => { try { return JSON.parse(s.getItem(CHAVE_VOZ_LIBERADAS) || "{}") || {}; } catch { return {}; } };

/** Marca (feita pela tela da Publicação) para o Voz abrir vazio ao voltar. */
export function marcarFichaLiberada(fichaIdPAIIA, { storage, agora = Date.now() } = {}) {
  const id = txt(fichaIdPAIIA);
  if (!id) return false;
  try {
    const s = storage || globalThis.localStorage;
    const m = lerLiberadas(s);
    m[id] = { em: agora };
    s.setItem(CHAVE_VOZ_LIBERADAS, JSON.stringify(m));
    return true;
  } catch {
    return false;
  }
}
export function fichaLiberada(fichaIdPAIIA, { storage } = {}) {
  const id = txt(fichaIdPAIIA);
  return Boolean(id && lerLiberadas(storage || globalThis.localStorage)[id]);
}
function consumirLiberada(fichaIdPAIIA, s) {
  try { const m = lerLiberadas(s); delete m[txt(fichaIdPAIIA)]; s.setItem(CHAVE_VOZ_LIBERADAS, JSON.stringify(m)); } catch { /* sem acesso */ }
}
const salvaNaConta = (f) => Boolean(txt(f?.fichaIdPAIIA) && f?.enviadaEm);

export function avisoFichaPendente(ficha) {
  const cod = (ficha?.codigos || []).find((c) => c.principal)?.codigo || "";
  return `💾 A ficha anterior${cod ? ` (${cod})` : ""} ficou salva: na sua conta, na Central de Publicação (publicação pendente — nada foi enviado ao Mercado Livre), e em “Fichas guardadas” neste aparelho. Ficha nova e limpa: pode falar o próximo código.`;
}

/** Guarda a ficha (já salva na conta) e abre uma nova e vazia. Não salva na conta = não troca. */
export function liberarFichaPendente(ficha, { storage, agora = Date.now() } = {}) {
  if (!salvaNaConta(ficha)) return { ok: false, motivo: "A ficha ainda não está salva na sua conta: termine o envio (etapa 7) antes de começar outra peça. Nada foi trocado." };
  const s = storage || globalThis.localStorage;
  const g = guardarNaListaVoz(ficha, s);
  if (!g.ok) return { ok: false, motivo: `Não consegui guardar a ficha (${g.erro}). Nada foi trocado.` };
  try { s.removeItem(CHAVE_COMPLEMENTO_VOZ); } catch { /* sem acesso */ }
  consumirLiberada(ficha.fichaIdPAIIA, s);
  const nova = criarFichaVoz({ agora });
  guardarFichaVoz(nova, s);
  return { ok: true, nova, aviso: avisoFichaPendente(ficha) };
}

/** Ao abrir o Voz: ficha publicada → ficha nova e limpa; liberada (pendente) → guardada + nova; senão a de sempre. */
export function abrirFichaVoz({ storage, agora = Date.now() } = {}) {
  const f = lerFichaVoz(storage);
  if (!f) return { ficha: criarFichaVoz({ agora }), aviso: "" };
  const pub = publicacaoDaFicha(f.fichaIdPAIIA, { storage });
  if (vozDeveAbrirLimpo(f, { publicacao: pub })) {
    return { ficha: limparAposPublicacao(f, pub.mlb, { storage, agora }), aviso: avisoFichaPublicada(f, pub.mlb), limpou: true };
  }
  if (fichaLiberada(f.fichaIdPAIIA, { storage }) && salvaNaConta(f)) {
    const r = liberarFichaPendente(f, { storage, agora });
    if (r.ok) return { ficha: r.nova, aviso: r.aviso, limpou: true, liberou: true };
  }
  return { ficha: f, aviso: "" };
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
