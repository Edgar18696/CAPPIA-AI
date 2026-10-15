/*
 * PAIIA — RECONHECIMENTO AUTOMÁTICO DE SKU (somente leitura).
 *
 * Ao digitar o código no Novo Anúncio, mostra o que JÁ existe:
 *  - Bling: produto com este SKU (busca exata, ativos e inativos);
 *  - Mercado Livre: anúncios deste SKU em CADA conta (REVELAÇÃO,
 *    LOJA ONLINE, CIEBR), com a mesma conferência usada na Publicação;
 *  - Base PAIIA: fichas deste código (com conta e MLB, quando houver).
 *
 * Regras:
 *  - Nada é criado, alterado, registrado ou publicado aqui.
 *  - Falha, tempo esgotado, conta não conectada ou resultado grande demais
 *    = "Verificação incompleta". NUNCA vira "não existe".
 *  - "Não encontrado" só quando a consulta terminou sem erro. No Bling a
 *    busca é pela grafia exata do SKU (a varredura completa do cadastro
 *    continua acontecendo na hora de criar o produto).
 *  - Não substitui as conferências da Publicação (que continuam iguais).
 */
import { verificarDuplicidadeML, normalizarCodigoComparacao, nomeDaLoja } from "./duplicidadeML.js";

export const ESTADO_RECONHECIMENTO = Object.freeze({
  ENCONTRADO: "encontrado",
  POSSIVEL: "possivel",
  AMBIGUO: "ambiguo",
  NAO_ENCONTRADO: "nao_encontrado",
  INCOMPLETA: "incompleta",
});

export const TEXTO_INCOMPLETA = "Verificação incompleta";

/** As três contas do Mercado Livre da loja (sempre aparecem no quadro). */
export const CONTAS_ML_LOJA = Object.freeze(["2412238242", "1729335019", "824312524"]);

/** Espera depois da última tecla antes de consultar. */
export const ESPERA_DIGITACAO_MS = 1200;
/** Resultado reaproveitado (mesmo código) por este tempo. */
export const VALIDADE_CACHE_MS = 10 * 60 * 1000;
/** Tempo máximo de cada parte (Bling, base, cada conta). */
export const TEMPO_MAXIMO_MS = 60 * 1000;

const txt = (v) => String(v ?? "").trim();

export function chaveCodigo(codigo) {
  return normalizarCodigoComparacao(codigo);
}

/** Código completo o bastante para consultar (pelo menos 4 letras/números). */
export function codigoProntoParaConsultar(codigo) {
  return chaveCodigo(codigo).length >= 4;
}

const incompleta = (motivo) => ({ estado: ESTADO_RECONHECIMENTO.INCOMPLETA, motivo: txt(motivo) || "a consulta não terminou" });

/** Resposta de bling-integracao:saldo_por_sku → situação no Bling. */
export function avaliarBling(resp) {
  if (!resp || typeof resp !== "object") return incompleta("sem resposta do Bling");
  const prod = resp.produto && typeof resp.produto === "object" ? resp.produto : null;
  if (resp.ambiguo === true) {
    const candidatos = (Array.isArray(resp.candidatos) ? resp.candidatos : []).map((p) => ({ id: txt(p?.id), codigo: txt(p?.codigo), nome: txt(p?.nome) }));
    return { estado: ESTADO_RECONHECIMENTO.AMBIGUO, candidatos, motivo: "mais de um produto no Bling com este SKU" };
  }
  // Achou o produto (mesmo que a leitura do saldo tenha falhado depois).
  if (resp.encontrado === true && prod && txt(prod.id)) {
    return { estado: ESTADO_RECONHECIMENTO.ENCONTRADO, produto: { id: txt(prod.id), codigo: txt(prod.codigo), nome: txt(prod.nome) } };
  }
  if (resp.ok === true && resp.encontrado === false) return { estado: ESTADO_RECONHECIMENTO.NAO_ENCONTRADO };
  return incompleta(resp.erro || resp.mensagem || "o Bling não respondeu de forma segura");
}

/** Resultado de verificarDuplicidadeML (uma conta) → situação na conta. */
export function avaliarContaML({ conta, nome = "", conectada = true, resultado = null, erro = "", motivo = "" }) {
  const base = { conta: txt(conta), nome: nome || nomeDaLoja(conta) };
  if (!conectada) return { ...base, ...incompleta(motivo || "conta não conectada ao PAIIA") };
  if (erro) return { ...base, ...incompleta(erro) };
  if (!resultado || typeof resultado !== "object") return { ...base, ...incompleta("sem resposta do Mercado Livre") };
  if (resultado.erro) return { ...base, ...incompleta(resultado.erro) };
  const mapa = (l) => (Array.isArray(l) ? l : []).map((d) => ({ mlb: txt(d?.id).toUpperCase(), status: txt(d?.status), titulo: txt(d?.titulo), motivo: txt(d?.motivo) }));
  const confirmados = mapa(resultado.duplicados);
  const possiveis = mapa(resultado.possiveis);
  if (confirmados.length) return { ...base, estado: ESTADO_RECONHECIMENTO.ENCONTRADO, anuncios: confirmados, possiveis };
  if (possiveis.length) return { ...base, estado: ESTADO_RECONHECIMENTO.POSSIVEL, anuncios: [], possiveis };
  if (resultado.verificado === true) return { ...base, estado: ESTADO_RECONHECIMENTO.NAO_ENCONTRADO, anuncios: [], possiveis: [] };
  return { ...base, ...incompleta("resposta do Mercado Livre sem confirmação") };
}

/** Resposta de listarAnunciosDoCodigo → fichas deste código na base PAIIA. */
export function avaliarBase(resp) {
  if (!resp || resp.ok !== true) return incompleta(resp?.erro || "base PAIIA indisponível");
  const fichas = (Array.isArray(resp.anuncios) ? resp.anuncios : []).map((a) => ({
    id: txt(a?.id),
    codigo: txt(a?.codigo),
    titulo: txt(a?.titulo),
    status: txt(a?.status_fluxo),
    conta: txt(a?.publicacao?.conta_nome) || txt(a?.conta_destino_nome),
    contaId: txt(a?.publicacao?.ml_user_id) || txt(a?.conta_destino_ml_user_id),
    mlb: txt(a?.publicacao?.mlb_id).toUpperCase(),
    blingProdutoId: txt(a?.publicacao?.bling_produto_id),
  }));
  return fichas.length ? { estado: ESTADO_RECONHECIMENTO.ENCONTRADO, fichas } : { estado: ESTADO_RECONHECIMENTO.NAO_ENCONTRADO, fichas: [] };
}

/** Resumo para a tela: completo? existe algo? */
export function resumoReconhecimento(r) {
  const partes = [r?.bling, r?.base, ...(Array.isArray(r?.contas) ? r.contas : [])].filter(Boolean);
  const incompletas = partes.filter((p) => p.estado === ESTADO_RECONHECIMENTO.INCOMPLETA).length;
  const existe = partes.some((p) => p.estado === ESTADO_RECONHECIMENTO.ENCONTRADO || p.estado === ESTADO_RECONHECIMENTO.AMBIGUO);
  const possivel = partes.some((p) => p.estado === ESTADO_RECONHECIMENTO.POSSIVEL);
  let titulo;
  if (existe) titulo = "Este SKU já existe";
  else if (possivel) titulo = "Possível anúncio deste SKU — confira";
  else if (incompletas) titulo = TEXTO_INCOMPLETA;
  else titulo = "Nada encontrado com este SKU";
  return { completo: incompletas === 0 && partes.length > 0, incompletas, existe, possivel, titulo };
}

function comTempo(promessa, ms, motivo) {
  let t;
  return Promise.race([
    promessa,
    new Promise((_, rej) => { t = setTimeout(() => rej(new Error(motivo)), ms); }),
  ]).finally(() => clearTimeout(t));
}

/**
 * Consulta tudo (somente leitura).
 * - lerBling(sku) → resposta de saldo_por_sku
 * - lerBase(codigo) → resposta de listarAnunciosDoCodigo
 * - consultarML(conta, caminho) → resposta de ml_consulta GET ({ ok, dados, erro })
 * - contas: [{ id, nome, conectada }]
 * Contas consultadas uma de cada vez (menos carga no Mercado Livre).
 */
export async function reconhecerSKU({ codigo, contas = [], lerBling, lerBase, consultarML, tempoMaximoMs = TEMPO_MAXIMO_MS, agora = () => new Date().toISOString() }) {
  const sku = txt(codigo);
  const chave = chaveCodigo(sku);
  if (!codigoProntoParaConsultar(sku)) return null;
  const parteBling = (async () => {
    try { return avaliarBling(await comTempo(Promise.resolve(lerBling(sku)), tempoMaximoMs, "tempo esgotado no Bling")); }
    catch (e) { return incompleta(e?.message || "falha ao consultar o Bling"); }
  })();
  const parteBase = (async () => {
    try { return avaliarBase(await comTempo(Promise.resolve(lerBase(sku)), tempoMaximoMs, "tempo esgotado na base PAIIA")); }
    catch (e) { return incompleta(e?.message || "falha ao consultar a base PAIIA"); }
  })();
  const resultadosContas = [];
  for (const c of contas) {
    if (!c?.conectada) {
      resultadosContas.push(avaliarContaML({ conta: c?.id, nome: c?.nome, conectada: false, motivo: c?.motivo }));
      continue;
    }
    try {
      const resultado = await comTempo(
        verificarDuplicidadeML({ conta: c.id, codigos: [sku], consultar: (caminho) => consultarML(c.id, caminho) }),
        tempoMaximoMs,
        "tempo esgotado no Mercado Livre"
      );
      resultadosContas.push(avaliarContaML({ conta: c.id, nome: c.nome, resultado }));
    } catch (e) {
      resultadosContas.push(avaliarContaML({ conta: c.id, nome: c.nome, erro: e?.message || "falha ao consultar o Mercado Livre" }));
    }
  }
  const r = { codigo: sku, chave, bling: await parteBling, base: await parteBase, contas: resultadosContas, lido_em: agora() };
  return { ...r, resumo: resumoReconhecimento(r) };
}

/**
 * Cache por código (normalizado): evita repetir a consulta a cada tecla,
 * ao voltar à tela ou com duas telas pedindo o mesmo código ao mesmo tempo.
 * Resultado INCOMPLETO não fica guardado (a próxima abertura tenta de novo).
 */
export function criarCacheReconhecimento({ validadeMs = VALIDADE_CACHE_MS, relogio = () => Date.now() } = {}) {
  const guardados = new Map();
  const emAndamento = new Map();
  return {
    async obter(chave, consultar, { forcar = false } = {}) {
      const k = txt(chave);
      if (!k) return null;
      const g = guardados.get(k);
      if (!forcar && g && relogio() - g.em < validadeMs) return g.valor;
      if (emAndamento.has(k)) return emAndamento.get(k);
      const p = (async () => {
        try {
          const valor = await consultar();
          if (valor?.resumo?.completo) guardados.set(k, { em: relogio(), valor });
          else guardados.delete(k);
          return valor;
        } finally {
          emAndamento.delete(k);
        }
      })();
      emAndamento.set(k, p);
      return p;
    },
    limpar() { guardados.clear(); },
    tamanho() { return guardados.size; },
  };
}

/** As três contas da loja, marcando quais estão conectadas no PAIIA. */
export function contasParaConsultar(contasConectadas = [], erroContas = "") {
  const lista = Array.isArray(contasConectadas) ? contasConectadas : [];
  const motivo = txt(erroContas) ? `não foi possível ler as contas conectadas (${txt(erroContas).slice(0, 120)})` : "";
  const ids = [...new Set([...CONTAS_ML_LOJA, ...lista.map((c) => txt(c?.ml_user_id)).filter(Boolean)])];
  return ids.map((id) => {
    const c = lista.find((x) => txt(x?.ml_user_id) === id);
    return { id, nome: nomeDaLoja(id, c?.nickname || ""), conectada: Boolean(c), motivo: c ? "" : motivo };
  });
}
