// =============================================================
// PAIIA — (08/11) Conferências DEPOIS da publicação, em segundo plano.
//   Testes: scripts/testes/publicacaoSegundoPlano.test.mjs
//
// Assim que o Mercado Livre confirma o MLB, a tela é liberada. As conferências que
// faltam (anúncio ativo, estoque no ML, vínculo no Bling) ficam REGISTRADAS na ficha
// (dados_conferencia.pos_publicacao) e são retomadas sozinhas sempre que o PAIIA estiver
// aberto, em qualquer aparelho da conta.
//
// Regras:
//  • SÓ LEITURA: nenhuma conferência publica, cadastra, vincula ou altera estoque
//    (nada pode ser duplicado por uma nova tentativa).
//  • Nada é marcado "ok" sem a confirmação real (ML ativo / Bling integrado).
//  • Falha = pendência registrada (aparece na Central de Publicação) + nova tentativa
//    automática, com intervalo crescente.
// Funções puras (sem rede): as consultas entram por parâmetro.
// =============================================================
import { situacaoAnuncioML } from "./pilotoPublicacao.js";

export const CHAVE_POS = "pos_publicacao";
export const VERSAO_POS = "2026-11-08.1";
/** Intervalos entre tentativas (min). Depois do último, repete nele. */
export const INTERVALOS_MIN = [1, 2, 5, 10, 15, 30, 60];
/** Depois disto sem concluir, para de tentar sozinho (a pendência continua na Central). */
export const HORAS_LIMITE = 48;
export const CONFERENCIAS = ["ativo", "estoque", "vinculo"];
export const ROTULO_CONFERENCIA = { ativo: "Anúncio ativo no Mercado Livre", estoque: "Estoque no Mercado Livre", vinculo: "Vínculo no Bling" };
const FINAIS_OK = ["ok", "nao_aplica"];
const txt = (v) => String(v ?? "").trim();
const iso = (ms) => new Date(ms).toISOString();

/** Registro inicial (gravado na ficha logo depois da confirmação do MLB). */
export function iniciarRegistroPos({ mlb, conta, sku = "", quantidade = null, agora = Date.now() } = {}) {
  const m = txt(mlb).toUpperCase();
  if (!/^MLB\d{6,}$/.test(m)) return null;
  const q = Number(quantidade);
  const pend = (texto) => ({ estado: "pendente", texto, em: iso(agora) });
  return {
    versao: VERSAO_POS,
    mlb: m,
    conta: txt(conta),
    sku: txt(sku),
    quantidade: Number.isFinite(q) && q > 0 ? q : null,
    iniciado_em: iso(agora),
    tentativas: 0,
    proxima_em: iso(agora),
    concluido: false,
    desistiu: false,
    ativo: pend("Aguardando o Mercado Livre ativar."),
    estoque: pend("Aguardando a leitura do anúncio."),
    vinculo: pend("Aguardando a conferência no Bling."),
  };
}

/** A conferência desta ficha está na hora de rodar? */
export function devidaAgora(reg, agora = Date.now()) {
  if (!reg || reg.concluido || reg.desistiu) return false;
  const p = Date.parse(reg.proxima_em || 0);
  return !Number.isFinite(p) || p <= agora;
}

function intervaloMin(tentativas) {
  return INTERVALOS_MIN[Math.min(Math.max(0, tentativas - 1), INTERVALOS_MIN.length - 1)];
}

/** Estoque: a quantidade do anúncio no ML tem de ser a da ficha. Sem os dois números: não se aplica. */
export function avaliarEstoque(item, quantidade) {
  const disp = Number(item?.available_quantity);
  if (!Number.isFinite(disp)) return { estado: "pendente", texto: "O Mercado Livre não informou a quantidade ainda." };
  if (!quantidade) return { estado: "nao_aplica", texto: `Quantidade no ML: ${disp} un. (ficha sem quantidade para comparar).` };
  return disp === Number(quantidade)
    ? { estado: "ok", texto: `${disp} un. no Mercado Livre, igual à ficha.` }
    : { estado: "erro", texto: `Mercado Livre com ${disp} un.; a ficha tem ${quantidade} un. Confira o estoque.` };
}

/**
 * UMA rodada das conferências (só leitura). deps:
 *   consultarItem(mlb) → item do ML ou null
 *   conferirVinculo() → { estado: "ok"|"pendente"|"erro"|"nao_aplica", texto, registroBling? }
 * Devolve { registro, registroBling? } — o registro novo para gravar na ficha.
 */
export async function rodadaPosPublicacao(reg, { consultarItem, conferirVinculo, agora = Date.now() } = {}) {
  const r = JSON.parse(JSON.stringify(reg || {}));
  if (!r.mlb || r.concluido) return { registro: r };
  const em = iso(agora);
  const marcar = (id, parcial) => { r[id] = { ...(r[id] || {}), ...parcial, em }; };

  // 1) Mercado Livre: status + quantidade (uma leitura só).
  if (!FINAIS_OK.includes(r.ativo?.estado) || !FINAIS_OK.includes(r.estoque?.estado)) {
    let item = null;
    let falha = "";
    try { item = await consultarItem(r.mlb); } catch (e) { falha = txt(e?.message || e); }
    if (!item) {
      const t = `Não consegui consultar o anúncio no Mercado Livre${falha ? ` (${falha.slice(0, 120)})` : ""}. Nova tentativa automática.`;
      if (!FINAIS_OK.includes(r.ativo?.estado)) marcar("ativo", { estado: "erro", texto: t });
      if (!FINAIS_OK.includes(r.estoque?.estado)) marcar("estoque", { estado: "pendente", texto: "Aguardando a leitura do anúncio." });
    } else {
      if (!FINAIS_OK.includes(r.ativo?.estado)) {
        const s = situacaoAnuncioML(item);
        marcar("ativo", s.fim && s.ok ? { estado: "ok", texto: "Ativo no Mercado Livre." } : s.fim ? { estado: "erro", texto: s.texto } : { estado: "pendente", texto: s.texto });
      }
      if (!FINAIS_OK.includes(r.estoque?.estado)) marcar("estoque", avaliarEstoque(item, r.quantidade));
    }
  }

  // 2) Bling: vínculo (só leitura; quem vincula é o Bling).
  let registroBling;
  if (!FINAIS_OK.includes(r.vinculo?.estado)) {
    let v;
    try { v = await conferirVinculo(); } catch (e) { v = { estado: "erro", texto: `Não consegui consultar o Bling (${txt(e?.message || e).slice(0, 120)}). Nova tentativa automática.` }; }
    const estado = ["ok", "pendente", "erro", "nao_aplica"].includes(v?.estado) ? v.estado : "erro";
    marcar("vinculo", { estado, texto: txt(v?.texto) || (estado === "ok" ? "Integrado ao Bling." : "Sem resposta do Bling.") });
    registroBling = v?.registroBling;
  }

  r.tentativas = (Number(r.tentativas) || 0) + 1;
  r.ultima_em = em;
  r.concluido = CONFERENCIAS.every((id) => FINAIS_OK.includes(r[id]?.estado));
  if (r.concluido) {
    r.concluido_em = em;
    r.proxima_em = null;
  } else {
    const limite = Date.parse(r.iniciado_em || em) + HORAS_LIMITE * 3600_000;
    const prox = agora + intervaloMin(r.tentativas) * 60_000;
    if (prox > limite) { r.desistiu = true; r.proxima_em = null; } else r.proxima_em = iso(prox);
  }
  return { registro: r, ...(registroBling ? { registroBling } : {}) };
}

/** Texto da pendência para a Central (vazio quando concluído ou ainda no começo, sem erro). */
export function pendenciaPos(reg) {
  if (!reg || reg.concluido) return "";
  const erros = CONFERENCIAS.filter((id) => reg[id]?.estado === "erro").map((id) => `${ROTULO_CONFERENCIA[id]}: ${txt(reg[id].texto)}`);
  const pend = CONFERENCIAS.filter((id) => reg[id]?.estado === "pendente").map((id) => ROTULO_CONFERENCIA[id]);
  const partes = [];
  if (erros.length) partes.push(`⚠ ${erros.join(" · ")}`);
  if (pend.length) partes.push(`⏳ Em conferência: ${pend.join(", ")}`);
  if (reg.desistiu) partes.push("Tentativas automáticas encerradas: confira manualmente.");
  return partes.join(" · ");
}

// -------------------------------------------------------------
// PAIIA Voz: fichas publicadas (para o Voz abrir limpo depois).
// Marca local, gravada SÓ depois do MLB confirmado e salvo.
// -------------------------------------------------------------
export const CHAVE_VOZ_PUBLICADAS = "paiiaVozPublicadas";
export const CHAVE_VOZ_HISTORICO = "paiiaVozFichasPublicadas";
export const MAX_HISTORICO_VOZ = 50;

export function marcarFichaPublicada(fichaId, mlb, { storage, agora = Date.now() } = {}) {
  const id = txt(fichaId);
  if (!id || !/^MLB\d{6,}$/i.test(txt(mlb))) return false;
  try {
    const s = storage || globalThis.localStorage;
    const m = JSON.parse(s.getItem(CHAVE_VOZ_PUBLICADAS) || "{}") || {};
    m[id] = { mlb: txt(mlb).toUpperCase(), em: agora };
    // guarda só as 100 mais recentes
    const ordem = Object.entries(m).sort((a, b) => (b[1]?.em || 0) - (a[1]?.em || 0)).slice(0, 100);
    s.setItem(CHAVE_VOZ_PUBLICADAS, JSON.stringify(Object.fromEntries(ordem)));
    return true;
  } catch {
    return false;
  }
}

export function publicacaoDaFicha(fichaId, { storage } = {}) {
  const id = txt(fichaId);
  if (!id) return null;
  try {
    const m = JSON.parse((storage || globalThis.localStorage).getItem(CHAVE_VOZ_PUBLICADAS) || "{}") || {};
    return m[id]?.mlb ? m[id] : null;
  } catch {
    return null;
  }
}

/** Guarda uma cópia da ficha publicada do Voz neste aparelho (histórico; nada é apagado). */
export function guardarHistoricoVoz(ficha, mlb, { storage, agora = Date.now() } = {}) {
  if (!ficha?.id) return false;
  try {
    const s = storage || globalThis.localStorage;
    const l = JSON.parse(s.getItem(CHAVE_VOZ_HISTORICO) || "[]");
    const lista = (Array.isArray(l) ? l : []).filter((f) => f?.id !== ficha.id);
    s.setItem(CHAVE_VOZ_HISTORICO, JSON.stringify([{ ...ficha, mlb: txt(mlb).toUpperCase(), publicadaEm: agora }, ...lista].slice(0, MAX_HISTORICO_VOZ)));
    return true;
  } catch {
    return false;
  }
}

/**
 * O Voz deve abrir limpo? Só quando a ficha atual tem a ficha da conta (fichaIdPAIIA)
 * e ela está PUBLICADA (marca local ou leitura da conta). Ficha não publicada: continua.
 */
export function vozDeveAbrirLimpo(ficha, { publicacao } = {}) {
  return Boolean(ficha?.fichaIdPAIIA && publicacao?.mlb && /^MLB\d{6,}$/i.test(publicacao.mlb));
}
