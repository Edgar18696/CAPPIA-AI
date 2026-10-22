// =============================================================
// PAIIA Voz — FOTOS GUARDADAS SÓ NESTE APARELHO (IndexedDB do navegador).
//   Testes: scripts/testes/paiiaVozMobile.test.mjs
//
// Por que: a ficha já fica no localStorage, mas foto não cabe lá. Sem
// isto, um F5 (ou o Android fechar a aba para economizar memória) apaga
// as fotos tiradas. Aqui cada foto vira um registro no banco local do
// navegador, ligado ao id da ficha.
//
// Nada sai do aparelho: não envia ao Supabase, ao Mercado Livre ou ao
// Bling. As fotos ficam até "Nova ficha", "Remover" ou expirarem
// (mesma validade da ficha: 48 h).
// O armazenamento é injetável para os testes (memória) e para o navegador
// (IndexedDB).
// =============================================================

export const VALIDADE_FOTOS_MS = 48 * 60 * 60 * 1000;
export const MAX_FOTOS_POR_FICHA = 5; // anúncio rápido: até 5 fotos (não é obrigatório usar as 5)
const BANCO = "paiia-voz";
const TABELA = "fotos";

/** Armazenamento em memória (testes e navegador sem IndexedDB). */
export function armazenamentoMemoria() {
  const mapa = new Map();
  return {
    tipo: "memoria",
    async put(reg) { mapa.set(reg.id, { ...reg }); },
    async getAll() { return [...mapa.values()].map((r) => ({ ...r })); },
    async delete(id) { mapa.delete(id); },
    // ler + gravar de uma vez (duas atualizações da mesma foto não se atropelam)
    async atualizar(id, mudar) { const r = mapa.get(id); if (!r) return null; const novo = mudar({ ...r }); mapa.set(id, { ...novo }); return { ...novo }; },
  };
}

/** Armazenamento no IndexedDB do navegador. */
export function armazenamentoIndexedDB(idb = globalThis.indexedDB) {
  if (!idb) return null;
  let aberto = null;
  const abrir = () => {
    if (aberto) return aberto;
    aberto = new Promise((ok, falha) => {
      const req = idb.open(BANCO, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(TABELA)) db.createObjectStore(TABELA, { keyPath: "id" });
      };
      req.onsuccess = () => ok(req.result);
      req.onerror = () => { aberto = null; falha(req.error || new Error("IndexedDB indisponível")); };
    });
    return aberto;
  };
  const operar = async (modo, fazer) => {
    const db = await abrir();
    return new Promise((ok, falha) => {
      const tx = db.transaction(TABELA, modo);
      const req = fazer(tx.objectStore(TABELA));
      tx.oncomplete = () => ok(req?.result);
      tx.onerror = () => falha(tx.error || new Error("falha no IndexedDB"));
      tx.onabort = () => falha(tx.error || new Error("operação cancelada (espaço cheio?)"));
    });
  };
  return {
    tipo: "indexeddb",
    put: (reg) => operar("readwrite", (s) => s.put(reg)),
    getAll: () => operar("readonly", (s) => s.getAll()),
    delete: (id) => operar("readwrite", (s) => s.delete(id)),
    // ler + gravar na MESMA transação (atualizações da mesma foto não se atropelam)
    atualizar: async (id, mudar) => {
      const db = await abrir();
      return new Promise((ok, falha) => {
        const tx = db.transaction(TABELA, "readwrite");
        const loja = tx.objectStore(TABELA);
        let novo = null;
        const g = loja.get(id);
        g.onsuccess = () => {
          if (!g.result) return;
          novo = mudar({ ...g.result });
          loja.put(novo);
        };
        tx.oncomplete = () => ok(novo);
        tx.onerror = () => falha(tx.error || new Error("falha no IndexedDB"));
        tx.onabort = () => falha(tx.error || new Error("operação cancelada (espaço cheio?)"));
      });
    },
  };
}

const novoIdFoto = () => `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const ehImagem = (a) => /^image\//i.test(String(a?.type || ""));
const usarPorPadrao = (a) => /^image\/(jpeg|png|webp)$/i.test(String(a?.type || ""));

/**
 * Cria o guarda-fotos.
 * @param {{ armazenamento, agora?: () => number }} opcoes
 */
export function criarGuardaFotos({ armazenamento, agora = () => Date.now() } = {}) {
  const arm = armazenamento || armazenamentoMemoria();

  async function listar(fichaId) {
    const todos = await arm.getAll();
    return todos
      .filter((r) => r.fichaId === fichaId && agora() - (Number(r.criadaEm) || 0) <= VALIDADE_FOTOS_MS)
      .sort((a, b) => (a.ordem ?? a.criadaEm) - (b.ordem ?? b.criadaEm));
  }

  /** Guarda as imagens recebidas. Devolve { guardadas[], recusadas[] }. */
  async function adicionar(fichaId, arquivos) {
    if (!fichaId) throw new Error("ficha sem id");
    const lista = Array.from(arquivos || []);
    const atuais = await listar(fichaId);
    const guardadas = [];
    const recusadas = [];
    let ordem = atuais.length ? Math.max(...atuais.map((r) => Number(r.ordem) || 0)) + 1 : 1;
    for (const a of lista) {
      if (!ehImagem(a)) { recusadas.push({ nome: a?.name || "", motivo: "não é imagem" }); continue; }
      if (atuais.length + guardadas.length >= MAX_FOTOS_POR_FICHA) { recusadas.push({ nome: a?.name || "", motivo: `limite de ${MAX_FOTOS_POR_FICHA} fotos por ficha` }); continue; }
      const reg = {
        id: novoIdFoto(),
        fichaId,
        nome: a.name || `foto-${ordem}.jpg`,
        tipo: a.type,
        tamanho: Number(a.size) || 0,
        blob: a,
        usarNoAnuncio: usarPorPadrao(a), // todas as fotos aceitas pelo anúncio já vêm marcadas
        versao: "original",
        tratada: null,
        ia: null,
        criadaEm: agora(),
        ordem: ordem++,
      };
      await arm.put(reg);
      guardadas.push(reg);
    }
    return { guardadas, recusadas };
  }

  // Atualiza um registro de forma segura (atômica quando o armazenamento permite).
  async function atualizar(id, mudar) {
    if (typeof arm.atualizar === "function") return arm.atualizar(id, mudar);
    const reg = (await arm.getAll()).find((r) => r.id === id);
    if (!reg) return null;
    const novo = mudar({ ...reg });
    await arm.put(novo);
    return novo;
  }

  async function marcarUso(id, usar) {
    return atualizar(id, (reg) => ({ ...reg, usarNoAnuncio: Boolean(usar) }));
  }

  async function remover(id) { await arm.delete(id); }

  /** Troca a imagem de uma foto mantendo a posição; a versão tratada antiga é descartada. */
  async function substituir(id, arquivo) {
    if (!ehImagem(arquivo)) throw new Error("não é imagem");
    // foto nova = tratamento novo (a chave antiga não vale para outra imagem)
    return atualizar(id, (reg) => ({ ...reg, nome: arquivo.name || reg.nome, tipo: arquivo.type, tamanho: Number(arquivo.size) || 0, blob: arquivo, usarNoAnuncio: usarPorPadrao(arquivo), criadaEm: agora(), tratada: null, versao: "original", ia: null, iaEnviado: null, iaRecorte: null }));
  }

  /** Guarda a versão com fundo branco (a original NUNCA é trocada). */
  async function salvarTratada(id, tratada) {
    return atualizar(id, (reg) => ({ ...reg, tratada: tratada ? { ...tratada } : null }));
  }

  /** Progresso do Foto IA (chave, caminho enviado, estado) — guardado antes de cada chamada. */
  async function salvarIA(id, ia, extras = {}) {
    return atualizar(id, (reg) => ({ ...reg, ...extras, ia: ia ? { ...ia, em: agora() } : null }));
  }

  /** Escolhe qual versão vai ao anúncio: "original" ou "tratada". */
  async function escolherVersao(id, versao) {
    return atualizar(id, (reg) => ({ ...reg, versao: versao === "tratada" && reg.tratada?.blob ? "tratada" : "original" }));
  }

  /** Apaga as fotos da ficha (Nova ficha). */
  async function limparFicha(fichaId) {
    for (const r of await arm.getAll()) if (r.fichaId === fichaId) await arm.delete(r.id);
  }

  /** Apaga fotos vencidas ou de fichas que não são a atual. Devolve quantas apagou. */
  async function faxina(fichaAtualId) {
    let n = 0;
    for (const r of await arm.getAll()) {
      const vencida = agora() - (Number(r.criadaEm) || 0) > VALIDADE_FOTOS_MS;
      if (vencida || (fichaAtualId && r.fichaId !== fichaAtualId)) { await arm.delete(r.id); n++; }
    }
    return n;
  }

  /** Converte o registro em File (para o Novo Anúncio). */
  function comoArquivo(reg) {
    const F = globalThis.File;
    if (typeof F === "function" && !(reg.blob instanceof F)) {
      try { return new F([reg.blob], reg.nome, { type: reg.tipo }); } catch { /* usa o blob */ }
    }
    return reg.blob;
  }

  /** Arquivo da versão escolhida (tratada só se aprovada). */
  function arquivoEscolhido(reg) {
    if (reg.versao === "tratada" && reg.tratada?.blob) {
      const tipo = reg.tratada.blob.type || "image/jpeg";
      const ext = /png/i.test(tipo) ? "png" : /webp/i.test(tipo) ? "webp" : "jpg";
      const nome = String(reg.nome || "foto").replace(/\.[a-z0-9]+$/i, "") + `-fundo-branco.${ext}`;
      return comoArquivo({ blob: reg.tratada.blob, nome, tipo });
    }
    return comoArquivo(reg);
  }

  return { tipo: arm.tipo, listar, adicionar, marcarUso, remover, substituir, salvarTratada, salvarIA, escolherVersao, arquivoEscolhido, limparFicha, faxina, comoArquivo };
}
