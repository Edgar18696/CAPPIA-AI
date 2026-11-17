// =============================================================
// PAIIA — Central de Promoções: SELEÇÃO DE ANÚNCIOS (17/11/2026).
//
// Quais anúncios participam de cada campanha, por USUÁRIO + CAMPANHA + CONTA + MLB.
// - Sem duplicidade: a chave conta+MLB é única na campanha.
// - Remover não apaga: marca removido_em (fica o histórico); incluir de novo reativa.
// - Mudou o preço desde a seleção? O anúncio CONTINUA selecionado, vira
//   "Revisão necessária" e não pode ser aprovado até você conferir.
// - Um MLB não entra em duas campanhas com períodos que se cruzam.
// - Seleção ≠ aprovação ≠ ativação: aqui só se escolhe; nada de preço é alterado.
//
// Armazenamento por ADAPTADOR. Hoje: navegador (adaptadorLocal). O formato de cada
// registro é o mesmo da tabela prevista no Supabase (paiia_promocoes_selecao, ainda
// NÃO criada — depende de autorização), para a troca não mudar a tela.
// =============================================================
import { CAMPANHAS_PROMOCOES, campanhaPorId, campanhasConflitantes } from "./campanhas.js";

const txt = (v) => (v === null || v === undefined ? "" : String(v)).trim();
const conta_ = (c) => txt(c).replace(/\D/g, "");
const mlb_ = (m) => txt(m).toUpperCase();
const num = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
export const VERSAO_SELECAO = 1;
export const LIMITE_META = 5000;
export const EVENTO_SELECAO = "paiia-promocoes-selecao";

export const chaveSelecao = (usuarioId, campanhaId) => `paiiaPromocoes:selecao:${txt(campanhaId)}:${txt(usuarioId) || "sem-usuario"}`;
export const chaveItemSelecao = (conta, mlb) => `${conta_(conta)}:${mlb_(mlb)}`;

export function selecaoVazia(usuarioId, campanhaId) {
  return { tipo: "paiia-promocoes-selecao", versao: VERSAO_SELECAO, campanha: txt(campanhaId), usuario: txt(usuarioId), itens: {}, metas: {}, atualizado_em: null };
}

/** Adaptador do navegador (localStorage). Um documento por usuário e campanha. */
export function adaptadorLocal(storage) {
  return {
    tipo: "navegador",
    ler(usuarioId, campanhaId) {
      try {
        const v = JSON.parse(storage?.getItem(chaveSelecao(usuarioId, campanhaId)) || "null");
        return v && v.tipo === "paiia-promocoes-selecao" && v.campanha === txt(campanhaId) && v.usuario === txt(usuarioId) ? v : selecaoVazia(usuarioId, campanhaId);
      } catch { return selecaoVazia(usuarioId, campanhaId); }
    },
    gravar(doc) {
      try { storage.setItem(chaveSelecao(doc.usuario, doc.campanha), JSON.stringify(doc)); } catch { return false; }
      // Avisa as outras telas abertas (Ranqueamento ↔ Central de Promoções).
      try { if (typeof window !== "undefined" && window.dispatchEvent) window.dispatchEvent(new Event(EVENTO_SELECAO)); } catch { /* sem janela (testes) */ }
      return true;
    },
  };
}

/**
 * Sugestão pura: dos anúncios aptos e ainda não selecionados, os de maior quantidade
 * vendida (lida no ML) e, no empate, maior estoque. Anúncio sem estoque não entra.
 * @param {Array} linhas linhas da simulação
 * @param {{ vagas: number, selecionado: (l)=>boolean, apto: (l)=>boolean }} o
 */
export function sugerirAnuncios(linhas, { vagas, selecionado = () => false, apto = () => true }) {
  const n = Math.max(0, Math.floor(Number(vagas) || 0));
  if (!n) return [];
  return (linhas || [])
    .filter((l) => !selecionado(l) && apto(l) && Number(l.estoque) > 0)
    .sort((a, b) => (num(b.vendidos) ?? -1) - (num(a.vendidos) ?? -1) || (num(b.estoque) ?? 0) - (num(a.estoque) ?? 0) || String(a.id).localeCompare(String(b.id)))
    .slice(0, n);
}

/**
 * Seleção de uma campanha para um usuário.
 * @param {{ adaptador, usuarioId: string, campanhaId: string, campanhas?: Array, agora?: () => string }} o
 */
export function criarSelecao({ adaptador, usuarioId, campanhaId, campanhas = CAMPANHAS_PROMOCOES, agora = () => new Date().toISOString() }) {
  const campanha = campanhaPorId(campanhaId, campanhas);
  if (!campanha) throw new Error(`Campanha desconhecida: ${campanhaId}`);
  if (!txt(usuarioId)) throw new Error("Entre no PAIIA para selecionar anúncios.");
  const ler = () => adaptador.ler(usuarioId, campanha.id);
  const gravar = (doc) => { doc.atualizado_em = agora(); return adaptador.gravar(doc); };
  const ativo = (r) => !!r && !r.removido_em;

  /** Em qual outra campanha (com período cruzado) o MLB já está selecionado. */
  function conflito(conta, mlb) {
    const k = chaveItemSelecao(conta, mlb);
    for (const outra of campanhasConflitantes(campanha.id, campanhas)) {
      if (ativo(adaptador.ler(usuarioId, outra.id).itens?.[k])) return outra;
    }
    return null;
  }

  return {
    campanha,
    /** Registros ativos (opcionalmente só de uma conta). */
    listar(conta) {
      const c = conta ? conta_(conta) : "";
      return Object.values(ler().itens).filter((r) => ativo(r) && (!c || r.conta_ml === c));
    },
    /** Mapa chave conta:MLB → registro ativo. */
    mapa(conta) { return new Map(this.listar(conta).map((r) => [chaveItemSelecao(r.conta_ml, r.mlb), r])); },
    meta(conta) { return num(ler().metas?.[conta_(conta)]); },
    definirMeta(conta, valor) {
      const v = valor === null || valor === "" ? null : Math.floor(Number(valor));
      if (v !== null && !(v > 0 && v <= LIMITE_META)) return { ok: false, motivo: `Meta inválida: use um número de 1 a ${LIMITE_META}.` };
      const doc = ler(); doc.metas = { ...(doc.metas || {}) }; doc.metas[conta_(conta)] = v;
      return gravar(doc) ? { ok: true, meta: v } : { ok: false, motivo: "Não foi possível gravar a meta." };
    },
    /**
     * Inclui anúncios. Cada um: { conta, id|mlb, sku, titulo, preco_original }.
     * Respeita a meta da conta (não passa dela), não duplica e não aceita conta fora da campanha.
     */
    incluir(anuncios, { origem = "central" } = {}) {
      const doc = ler();
      const out = { incluidos: [], ja_estavam: [], recusados: [] };
      for (const a of anuncios || []) {
        const conta = conta_(a.conta), mlb = mlb_(a.mlb || a.id);
        if (!/^MLB\d+$/.test(mlb)) { out.recusados.push({ mlb, motivo: "MLB inválido." }); continue; }
        if (!campanha.contas.includes(conta)) { out.recusados.push({ mlb, motivo: "Conta fora desta campanha." }); continue; }
        const k = chaveItemSelecao(conta, mlb);
        if (ativo(doc.itens[k])) { out.ja_estavam.push(mlb); continue; }
        const meta = num(doc.metas?.[conta]);
        const naConta = Object.values(doc.itens).filter((r) => ativo(r) && r.conta_ml === conta).length;
        if (meta !== null && naConta >= meta) { out.recusados.push({ mlb, motivo: `Meta de ${meta} anúncio(s) da conta atingida: retire um ou aumente a meta.` }); continue; }
        const outra = conflito(conta, mlb);
        if (outra) { out.recusados.push({ mlb, motivo: `Já está na campanha "${outra.nome}", com datas que se cruzam (descontos conflitantes).` }); continue; }
        const preco = num(a.preco_original);
        doc.itens[k] = {
          usuario_id: txt(usuarioId), campanha_id: campanha.id, conta_ml: conta, mlb, sku: txt(a.sku) || null, titulo: txt(a.titulo) || null,
          preco_referencia: preco, origem: txt(origem) || "central", incluido_em: agora(), removido_em: null,
          revisao: false, revisao_motivo: null, preco_atual: preco,
        };
        out.incluidos.push(mlb);
      }
      if (out.incluidos.length && !gravar(doc)) return { ...out, incluidos: [], recusados: [...out.recusados, ...out.incluidos.map((mlb) => ({ mlb, motivo: "Não foi possível gravar." }))] };
      return out;
    },
    /** Retira da campanha (fica registrado quando saiu). */
    remover(chaves) {
      const doc = ler(); let n = 0;
      for (const k of chaves || []) { const r = doc.itens[k]; if (ativo(r)) { r.removido_em = agora(); n++; } }
      if (n) gravar(doc);
      return n;
    },
    /** Retira todos os anúncios ativos de uma conta. */
    limpar(conta) { return this.remover(this.listar(conta).map((r) => chaveItemSelecao(r.conta_ml, r.mlb))); },
    /**
     * Confere a seleção com a leitura nova: preço diferente do preço da seleção → continua
     * selecionado, mas com "Revisão necessária" (nunca é retirado sozinho).
     * @param {Array<{conta, id, preco_original}>} linhas
     */
    revisar(linhas) {
      const doc = ler(); const novas = []; let mudou = false;
      for (const l of linhas || []) {
        const r = doc.itens[chaveItemSelecao(l.conta, l.id)];
        if (!ativo(r)) continue;
        const atual = num(l.preco_original);
        if (atual === null) continue;
        if (r.preco_atual !== atual) { r.preco_atual = atual; mudou = true; }
        // Veio sem preço (ex.: do Ranqueamento): o 1º preço lido vira a referência.
        if (r.preco_referencia === null) { r.preco_referencia = atual; mudou = true; continue; }
        if (r.preco_referencia !== null && Math.abs(atual - r.preco_referencia) >= 0.01 && !r.revisao) {
          r.revisao = true; r.revisao_motivo = `Preço mudou de R$ ${r.preco_referencia.toFixed(2).replace(".", ",")} para R$ ${atual.toFixed(2).replace(".", ",")} desde a seleção.`;
          novas.push(r.mlb); mudou = true;
        }
      }
      if (mudou) gravar(doc);
      return { novas };
    },
    /** Você conferiu o anúncio: o preço atual vira a referência e a revisão sai. */
    confirmarRevisao(chave) {
      const doc = ler(); const r = doc.itens[chave];
      if (!ativo(r) || !r.revisao) return false;
      r.preco_referencia = r.preco_atual; r.revisao = false; r.revisao_motivo = null; r.revisado_em = agora();
      return gravar(doc);
    },
  };
}

/** Atalho para o futuro botão "Enviar para Promoções" do Ranqueamento (ainda não ligado). */
export function enviarParaPromocoes({ adaptador, usuarioId, campanhaId, anuncio }) {
  return criarSelecao({ adaptador, usuarioId, campanhaId }).incluir([anuncio], { origem: "ranqueamento" });
}
