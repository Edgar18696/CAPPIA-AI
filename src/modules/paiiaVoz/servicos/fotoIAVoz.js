// =============================================================
// PAIIA Voz — FUNDO BRANCO COM O FOTO IA OFICIAL (fila em paralelo).
//   Testes: scripts/testes/paiiaVozFotoIA.test.mjs
//
// Usa EXATAMENTE as funções do Foto IA (src/services/fotoIA), sem alterá-las:
//   1) envia a original (enviarOriginalFotoIA)
//   2) recorte LOCAL no aparelho (recortarLocalmente, o mesmo da Foto IA —
//      sem créditos e sem cota mensal). O recorte antigo na função "foto-ia"
//      (recortarFotoIA → Replicate) só roda se o recorte local não for passado.
//   3) composição no navegador com os pixels ORIGINAIS (comporFotoFinal)
// Diferenças do Foto IA: o resultado fica na ficha do PAIIA Voz (não grava
// na Galeria) e só vai ao anúncio se o usuário escolher "Fundo branco".
//
// Segurança de custo:
//  • DESLIGADO por padrão. No modo teste existe só a SIMULAÇÃO gratuita.
//  • O modo real só aparece se o build tiver VITE_PAIIA_VOZ_FOTO_IA_REAL=1
//    (autorização) e o usuário ligar.
//  • Cada foto ganha uma CHAVE guardada no aparelho ANTES da 1ª chamada.
//  • Depois do F5 NADA que possa gerar nova cobrança roda sozinho:
//      - "na fila" / "enviando" (ainda sem recorte): continua (sem custo);
//      - recorte já baixado ("compondo"): o recorte fica guardado no aparelho,
//        então a foto termina SEM chamar o recorte de novo;
//      - recorte em andamento quando a página fechou: vira "interrompida" e só
//        continua se você tocar em "Retomar" (no modo real o provedor pode
//        cobrar de novo; o limite do mês não conta a mesma chave duas vezes).
//  • Foto que FALHOU também só é repetida quando você pede.
// =============================================================

export const ESTADOS_ATIVOS = ["na-fila", "enviando", "recortando", "compondo"];
// Trabalhos realmente em andamento NESTA página (some no F5).
const EM_ANDAMENTO = {};
export const ROTULOS_ESTADO = {
  "na-fila": "na fila",
  enviando: "enviando a foto",
  recortando: "removendo o fundo",
  compondo: "montando a foto branca",
  pronta: "fundo branco pronto",
  falhou: "falhou",
  interrompida: "interrompida ao atualizar a página",
};
export const CONCORRENCIA_PADRAO = 3;
const CHAVE_MODO = "paiiaVozFotoIAModo";

const novaChave = () => (globalThis.crypto?.randomUUID?.() || `voz-${Date.now()}-${Math.random().toString(36).slice(2)}`);

/**
 * Modos disponíveis neste ambiente.
 * @param {{ modoTeste: boolean, realLiberado: boolean }} amb
 */
export function modosDisponiveis({ modoTeste = false, realLiberado = false } = {}) {
  if (modoTeste) return ["desligado", "simulacao"];
  return realLiberado ? ["desligado", "real"] : ["desligado"];
}
export function modoPadrao(amb) {
  // (31/10/2026) Com o modo real AUTORIZADO no build, o fundo branco começa
  // sozinho (sem abrir a Foto IA). Sem a autorização, nunca há modo real.
  if (amb?.modoTeste) return "simulacao";
  return amb?.realLiberado ? "real" : "desligado";
}
export function lerModo(amb, storage = globalThis.localStorage) {
  const disp = modosDisponiveis(amb);
  try {
    const salvo = storage?.getItem(CHAVE_MODO);
    if (salvo && disp.includes(salvo)) return salvo;
  } catch {
    // sem localStorage
  }
  return modoPadrao(amb);
}
export function gravarModo(modo, storage = globalThis.localStorage) {
  try { storage?.setItem(CHAVE_MODO, modo); } catch { /* sem localStorage */ }
}

/** Estado da IA de uma foto, para a tela. */
export function situacaoIA(reg) {
  const ia = reg?.ia;
  if (!ia) return { estado: "", rotulo: "", ativo: false };
  return { estado: ia.estado, rotulo: ROTULOS_ESTADO[ia.estado] || ia.estado, ativo: ESTADOS_ATIVOS.includes(ia.estado), erro: ia.erro || "", tentativa: ia.tentativa || 1 };
}

/**
 * Executor de UMA foto com as funções oficiais (injetadas para teste).
 * @param deps { supabase, usuarioId, enviarOriginalFotoIA, recortarFotoIA, comporFotoFinal, baixar }
 * @returns (reg, salvar) => Promise<{ tratada }>  — salvar(iaParcial, extras) persiste o progresso
 */
export function criarExecutorFotoIA(deps) {
  const { supabase, usuarioId, enviarOriginalFotoIA, recortarFotoIA, comporFotoFinal } = deps;
  const baixar = deps.baixar || (async (url) => {
    const r = await fetch(url);
    if (!r.ok) throw Object.assign(new Error("Não foi possível baixar o recorte da foto."), { temporario: true });
    return r.blob();
  });
  return async function executar(reg, salvar) {
    let ia = { ...(reg.ia || {}) };
    if (!ia.chave) ia.chave = novaChave();
    let enviado = reg.iaEnviado || null;
    // (31/10/2026) A original já enviada para a ficha é reaproveitada (sem envio duplicado).
    if (!ia.caminhoOriginal && reg.nuvem?.original?.caminho) {
      ia = { ...ia, caminhoOriginal: reg.nuvem.original.caminho, urlOriginal: reg.nuvem.original.url };
    }
    if (!ia.caminhoOriginal) {
      ia = { ...ia, estado: "enviando" };
      await salvar(ia);
      const envio = deps.garantirOriginal
        ? { ...(await deps.garantirOriginal(reg)), arquivoEnviado: null }
        : await enviarOriginalFotoIA({ supabase, usuarioId, arquivo: arquivoDe(reg) });
      enviado = envio.arquivoEnviado || null;
      ia = { ...ia, caminhoOriginal: envio.caminho, urlOriginal: envio.url, estado: "recortando" };
      await salvar(ia, { iaEnviado: enviado });
    } else {
      ia = { ...ia, estado: "recortando" };
      await salvar(ia);
    }
    let blobRecorte = reg.iaRecorte || null;
    if (!blobRecorte && deps.recortarLocal) {
      // (10/11/2026) RECORTE LOCAL (o mesmo da Foto IA): no próprio aparelho,
      // sem a função "foto-ia", sem créditos e sem a cota mensal. A foto vai
      // ao recorte já reduzida (até 2560 px) — a mesma usada na composição.
      if (!enviado && deps.normalizar) {
        try { enviado = (await deps.normalizar(arquivoDe(reg)))?.arquivo || null; } catch { enviado = null; }
      }
      const recorte = await deps.recortarLocal(enviado || reg.blob);
      blobRecorte = recorte.blob;
      ia = { ...ia, local: true, estado: "compondo" };
      await salvar(ia, { iaRecorte: blobRecorte, ...(enviado ? { iaEnviado: enviado } : {}) });
    } else if (!blobRecorte) {
      const recorte = await recortarFotoIA({
        supabase,
        caminho: ia.caminhoOriginal,
        chave: ia.chave,
        aoTentar: (n) => { if (n > 1) salvar({ ...ia, tentativa: n }).catch(() => {}); },
      });
      blobRecorte = await baixar(recorte.recorteUrl);
      ia = { ...ia, uso: recorte.uso || null, estado: "compondo" };
      // recorte guardado no aparelho: um F5 daqui em diante não chama o recorte de novo
      await salvar(ia, { iaRecorte: blobRecorte });
    } else {
      ia = { ...ia, estado: "compondo" };
      await salvar(ia);
    }
    const final = await comporFotoFinal({ original: enviado || reg.blob, recorte: blobRecorte, fundo: "branco" });
    return { ia: { ...ia, estado: "pronta", erro: "" }, tratada: { blob: final.blob, origem: "fotoIA", baixaResolucao: Boolean(final.baixaResolucao), em: Date.now() } };
  };
}

function arquivoDe(reg) {
  const F = globalThis.File;
  if (typeof F === "function" && !(reg.blob instanceof F)) {
    try { return new F([reg.blob], reg.nome || "foto.jpg", { type: reg.tipo || reg.blob.type }); } catch { /* usa o blob */ }
  }
  return reg.blob;
}

/**
 * Fila de tratamento: até N fotos ao mesmo tempo, retomável após F5.
 * @param { guarda, executar, concorrencia, aoMudar }
 */
export function criarFilaFotoIA({ guarda, executar, concorrencia = CONCORRENCIA_PADRAO, aoMudar = () => {}, recorteSemCusto = false }) {
  const rodando = {}; // id → true enquanto trata (nesta fila)
  let parado = false;

  async function salvarIA(id, ia, extras) {
    await guarda.salvarIA(id, ia, extras);
    aoMudar(id);
  }

  /** Coloca na fila as fotos ainda sem tratamento (não mexe nas que falharam). */
  async function enfileirarNovas(fichaId) {
    const regs = await guarda.listar(fichaId);
    for (const r of regs) {
      if (!r.ia) await salvarIA(r.id, { estado: "na-fila", chave: novaChave(), criadaEm: Date.now() });
    }
    return processar(fichaId);
  }

  /** Tentar de novo / Retomar (só por pedido do usuário): mesma chave. */
  async function repetir(fichaId, id) {
    const reg = (await guarda.listar(fichaId)).find((r) => r.id === id);
    if (!reg?.ia || !["falhou", "interrompida"].includes(reg.ia.estado)) return;
    await salvarIA(id, { ...reg.ia, estado: "na-fila", erro: "", tentativa: 1 });
    return processar(fichaId);
  }

  /** Inicia o que estiver na fila ou interrompido (F5), respeitando o limite. */
  async function processar(fichaId) {
    if (parado) return [];
    const regs = await guarda.listar(fichaId);
    const iniciadas = [];
    // Recorte que estava em andamento numa página anterior (F5/fechou): não
    // repete sozinho, para não gerar nova cobrança.
    for (const reg of regs) {
      const e = reg.ia?.estado;
      const precisaRecorte = e === "recortando" || (e === "compondo" && !reg.iaRecorte);
      // (10/11/2026) Recorte local não cobra nada: retoma sozinho.
      if (precisaRecorte && !recorteSemCusto && !EM_ANDAMENTO[reg.id] && !rodando[reg.id]) {
        await salvarIA(reg.id, { ...reg.ia, estado: "interrompida" });
        reg.ia = { ...reg.ia, estado: "interrompida" };
      }
    }
    for (const reg of regs) {
      if (Object.keys(rodando).length >= concorrencia) break;
      if (rodando[reg.id] || EM_ANDAMENTO[reg.id] || !reg.ia || !ESTADOS_ATIVOS.includes(reg.ia.estado)) continue;
      rodando[reg.id] = true;
      EM_ANDAMENTO[reg.id] = true;
      const tarefa = (async () => {
        try {
          const { ia, tratada } = await executar(reg, (parcial, extras) => salvarIA(reg.id, parcial, extras));
          await guarda.salvarTratada(reg.id, tratada).catch(() => {});
          // (31/10/2026) pronto: a versão com fundo branco entra sozinha (a original fica guardada)
          if (tratada?.blob) await guarda.usarTratadaAutomatica?.(reg.id).catch(() => {});
          await salvarIA(reg.id, ia);
        } catch (e) {
          const atual = (await guarda.listar(fichaId).catch(() => [])).find((r) => r.id === reg.id);
          if (atual) await salvarIA(reg.id, { ...(atual.ia || reg.ia), estado: "falhou", erro: String(e?.message || e), codigo: e?.codigo || "" }).catch(() => {});
        } finally {
          delete rodando[reg.id];
          delete EM_ANDAMENTO[reg.id];
          if (!parado) processar(fichaId).catch(() => {});
        }
      })();
      iniciadas.push(tarefa);
    }
    return iniciadas;
  }

  return {
    enfileirarNovas,
    repetir,
    processar,
    get emAndamento() { return Object.keys(rodando).length; },
    parar() { parado = true; },
  };
}

/** Resumo para a etapa Enviar. */
export function resumoFotos(regs) {
  const r = { total: regs.length, usadas: 0, prontas: 0, tratando: 0, falharam: 0, interrompidas: 0, comFundoBranco: 0 };
  for (const x of regs) {
    if (x.usarNoAnuncio) r.usadas++;
    const e = x.ia?.estado;
    if (e === "pronta") r.prontas++;
    else if (ESTADOS_ATIVOS.includes(e)) r.tratando++;
    else if (e === "falhou") r.falharam++;
    else if (e === "interrompida") r.interrompidas++;
    if (x.usarNoAnuncio && x.versao === "tratada" && x.tratada?.blob) r.comFundoBranco++;
  }
  return r;
}

/**
 * (31/10/2026) Executor de SIMULAÇÃO (modo teste): não chama o Foto IA nem o
 * Replicate — nada é cobrado. Monta no aparelho uma foto 1200×1200 sobre
 * fundo branco (peça ~80%, sem recorte) só para testar o fluxo completo.
 * `compor(blob)` é injetável (testes); no navegador usa canvas.
 */
export function criarExecutorSimulado({ compor = comporSimuladoCanvas, espera = 300 } = {}) {
  return async function executar(reg, salvar) {
    let ia = { ...(reg.ia || {}), estado: "compondo", simulacao: true };
    await salvar(ia);
    await new Promise((ok) => setTimeout(ok, espera));
    const blob = await compor(reg.blob);
    return { ia: { ...ia, estado: "pronta", erro: "" }, tratada: { blob, origem: "simulacao", baixaResolucao: false, em: Date.now() } };
  };
}

async function comporSimuladoCanvas(blob) {
  const bmp = await createImageBitmap(blob, { imageOrientation: "from-image" });
  const lado = 1200;
  const c = document.createElement("canvas");
  c.width = lado; c.height = lado;
  const g = c.getContext("2d");
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, lado, lado);
  const esc = Math.min((lado * 0.8) / bmp.width, (lado * 0.8) / bmp.height);
  const w = Math.round(bmp.width * esc), h = Math.round(bmp.height * esc);
  g.drawImage(bmp, Math.round((lado - w) / 2), Math.round((lado - h) / 2), w, h);
  bmp.close?.();
  return new Promise((ok, falha) => c.toBlob((b) => (b ? ok(b) : falha(new Error("Não foi possível montar a foto."))), "image/png"));
}
