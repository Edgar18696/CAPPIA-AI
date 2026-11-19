// =============================================================
// PAIIA — Central do Paizinho: leitura do RELATÓRIO DA MANHÃ e o
// TESTE LOCAL com dados reais (somente leitura).
//   - Produção: lê o último relatório gravado pela função das 03h
//     (tabela paiia_paizinho_relatorios; sem a tabela → "não ativado").
//   - Análise no navegador (site e npm run dev; liberada no site em 12/11):
//     roda o mesmo motor no navegador usando as funções que o PAIIA já usa
//     (ml_consulta GET, paizinho-leitura-ml e bling-integracao).
//     O resultado fica SÓ neste navegador (localStorage).
// =============================================================
import { supabase } from "../../supabase";
import { consultorML } from "../consultaMLLeitura";
import { executarAuditoria, CONTAS_AUDITORIA, contaLiberada } from "./index.js";
import { CONTA_PADRAO, CONTA_LEGADO } from "./contas.js";
import { CHAVE_TESTE_LOCAL, idDe, chaveDaConta, lerRelatorioDaConta, guardarRelatorioDaConta, conferirRelatorioDaConta } from "./relatoriosPorConta.js";
import { roteadorConsultas, consultorComercial as leitorComercial } from "./leituraComercial.js";
import { MODO, montarRodada, escolherIneditos, escolherReanalise, novoId } from "./filaAnuncios.js";
import { repositorioNavegador, repositorioBanco, enviarRegistroParaBanco, ORIGEM } from "./filaRepositorio.js";
import { lerHistorico } from "./prioridadesAcoes.js";
import { novaRetomada, retomadaValida, consultaComRetomada, parouPorLogin, MSG_LOGIN_INVALIDO } from "./retomada.js";

const consultorComercial = (conta) => leitorComercial(conta, (nome, opcoes) => supabase.functions.invoke(nome, opcoes));

export const CONTA_PILOTO = CONTA_LEGADO;
// (17/11) Uma chave por conta: o relatório de uma conta nunca aparece na outra (relatoriosPorConta.js).
export { CONTAS_AUDITORIA, CONTA_PADRAO, CHAVE_TESTE_LOCAL, chaveDaConta, conferirRelatorioDaConta };

/** Último relatório do servidor. { estado: "ok"|"vazio"|"nao_ativado"|"erro", registro } */
export async function lerUltimoRelatorio(conta = CONTA_PADRAO.id) {
  try {
    const { data, error } = await supabase
      .from("paiia_paizinho_relatorios")
      .select("id, conta_ml, conta_nome, status, data_referencia, iniciado_em, concluido_em, relatorio, erro")
      .eq("conta_ml", idDe(conta))
      .order("iniciado_em", { ascending: false })
      .limit(1);
    if (error) {
      const semTabela = ["PGRST205", "42P01"].includes(error.code) || /does not exist|Could not find the table/i.test(error.message || "");
      return { estado: semTabela ? "nao_ativado" : "erro", erro: error.message };
    }
    return data?.length ? { estado: "ok", registro: data[0] } : { estado: "vazio" };
  } catch (e) {
    return { estado: "erro", erro: String(e?.message || e) };
  }
}

/** Relatório desta conta guardado neste navegador (nunca o de outra conta). */
export function lerRelatorioTesteLocal(conta = CONTA_PADRAO.id) {
  return lerRelatorioDaConta(conta, globalThis.localStorage);
}
export function guardarRelatorioTesteLocal(rel) {
  return guardarRelatorioDaConta(rel, globalThis.localStorage);
}

function impostoDoPerfil() {
  try {
    const p = JSON.parse(localStorage.getItem("paiiaPerfilCustos") || "null");
    const n = Number(String(p?.impostoPercentual ?? "").replace(",", "."));
    return Number.isFinite(n) && n >= 0 && String(p?.impostoPercentual ?? "").trim() !== "" ? n : null;
  } catch { return null; }
}

// (12/11) Leituras do Bling guardadas neste navegador por 24 h: se a sessão
// expirar no meio, a próxima rodada continua de onde parou (~30 SKUs/min).
// Guarda só os campos que a auditoria usa. Nada é gravado no Bling.
export const CHAVE_CACHE_BLING = "paiiaPaizinhoBlingCache";
const VALIDADE_CACHE_BLING_MS = 24 * 60 * 60 * 1000;
const CAMPOS_BLING = ["codigo", "nome", "peso_bruto", "peso_liquido", "pesoBruto", "pesoLiquido", "largura", "altura", "profundidade", "precoCusto", "preco_custo", "custo"];

export function resumirProdutoBling(p) {
  if (!p || typeof p !== "object") return null;
  const out = {};
  for (const c of CAMPOS_BLING) if (p[c] !== undefined) out[c] = p[c];
  return out;
}

// (17/11) Caches do Bling também separados por conta.
function lerCacheBling(conta, agora = Date.now(), base = CHAVE_CACHE_BLING) {
  try {
    const id = idDe(conta);
    const c = JSON.parse(localStorage.getItem(chaveDaConta(base, id)) || (id === CONTA_LEGADO.id ? localStorage.getItem(base) : null) || "null");
    if (!c || c.conta !== id || typeof c.itens !== "object") return {};
    const validos = {};
    for (const [sku, v] of Object.entries(c.itens)) if (agora - Number(v?.lidoEm || 0) < VALIDADE_CACHE_BLING_MS) validos[sku] = v;
    return validos;
  } catch { return {}; }
}
function gravarCacheBling(conta, itens, base = CHAVE_CACHE_BLING) {
  try { localStorage.setItem(chaveDaConta(base, conta), JSON.stringify({ conta: idDe(conta), itens })); } catch { /* sem espaço: segue sem cache */ }
}

// (12/11) Preço de custo: ação SOMENTE LEITURA "custo_por_sku" da bling-integracao
// (só GET no Bling; não grava nem no Bling nem no PAIIA). Também guardado 24 h.
export const CHAVE_CACHE_CUSTO = "paiiaPaizinhoCustoCache";
export const CHAVE_CACHE_ULTIMA_COMPRA = "paiiaPaizinhoUltimaCompraCache";
/** Guarda só o necessário da resposta de custo_por_sku. */
export function resumirCusto(d) {
  return {
    ok: true,
    encontrado: d?.encontrado !== false,
    ambiguo: d?.ambiguo === true,
    // (12/11) "S" simples, "E" composição (kit) — para conferir anúncio de kit/par.
    formato: d?.produto?.formato ?? null,
    produto_id: d?.produto?.id ?? null,
    custo: d?.custo ? {
      fornecedor_precoCusto: d.custo.fornecedor_precoCusto ?? null,
      fornecedores: (Array.isArray(d.custo.fornecedores) ? d.custo.fornecedores : []).map((f) => ({ padrao: f?.padrao === true, precoCusto: f?.precoCusto ?? null })),
    } : null,
  };
}

/**
 * Análise com dados reais de UMA conta (somente leitura). (17/11) A conta vem do seletor
 * da Central; tudo (ML, caches e relatório guardado) fica separado por conta.
 */
export async function rodarTesteLocal({ conta = CONTA_PADRAO.id, limiteItens = 100, concorrencia = 0, aoProgredir, escolherIds, continuar = false, tipo = "" } = {}) {
  const escolhida = contaLiberada(conta);
  if (!escolhida) throw new Error("Conta não liberada para a análise.");
  // (Pacote 1) Login conferido ANTES de começar; memória de retomada por conta e tipo de rodada.
  try { aoProgredir?.("Conferindo o login do PAIIA"); } catch { /* ignora */ }
  await conferirLogin();
  const chaveRet = `${escolhida.id}|${tipo}`;
  if (!(continuar && retomadaValida(retomadas.get(chaveRet), { limiteItens, chave: chaveRet }))) retomadas.set(chaveRet, novaRetomada({ agora: new Date().toISOString(), limiteItens, chave: chaveRet }));
  const ret = retomadas.get(chaveRet);
  const cache = lerCacheBling(escolhida.id);
  let novos = 0;
  const consultarBlingServidor = async (sku) => {
    const { data, error } = await supabase.functions.invoke("bling-integracao", { body: { acao: "buscar_produto", codigo: sku } });
    if (error) {
      // O corpo da resposta de erro traz o motivo real (ex.: "Usuário não autenticado").
      let erro = error.message;
      try { const corpo = await error.context?.json?.(); if (corpo?.erro || corpo?.error) erro = corpo.erro || corpo.error; } catch { /* mantém a mensagem */ }
      return { ok: false, erro, status: error.context?.status };
    }
    return data?.ok ? { ok: true, produto: data.produto || null, encontrado: data.encontrado } : { ok: false, encontrado: data?.encontrado, erro: data?.erro };
  };
  const consultarBling = async (sku) => {
    const guardado = cache[sku];
    if (guardado) return { ok: true, produto: guardado.produto, encontrado: guardado.encontrado, doCache: true };
    const r = await consultarBlingServidor(sku);
    if (r.ok || r.encontrado === false) {
      cache[sku] = { produto: resumirProdutoBling(r.produto), encontrado: r.encontrado !== false && !!r.produto, lidoEm: Date.now() };
      if (++novos % 25 === 0) gravarCacheBling(escolhida.id, cache);
    }
    return r;
  };
  const cacheCusto = lerCacheBling(escolhida.id, Date.now(), CHAVE_CACHE_CUSTO);
  let novosCusto = 0;
  const consultarCusto = async (sku) => {
    const guardado = cacheCusto[sku];
    if (guardado) return { ...guardado.resposta, doCache: true };
    const { data, error } = await supabase.functions.invoke("bling-integracao", { body: { acao: "custo_por_sku", sku } });
    if (error) {
      let erro = error.message;
      try { const corpo = await error.context?.json?.(); if (corpo?.erro || corpo?.error) erro = corpo.erro || corpo.error; } catch { /* mantém */ }
      return { ok: false, erro, status: error.context?.status };
    }
    if (!data?.ok) return { ok: false, erro: data?.erro || "resposta inesperada", status: data?.status };
    const resposta = resumirCusto(data);
    cacheCusto[sku] = { resposta, lidoEm: Date.now() };
    if (++novosCusto % 25 === 0) gravarCacheBling(escolhida.id, cacheCusto, CHAVE_CACHE_CUSTO);
    return resposta;
  };
  // (18/11) Última compra no Bling (função paizinho-bling-compras, SÓ LEITURA), em partes, com cache de 24 h.
  const consultarUltimasCompras = async (skus, idsPorSku) => {
    const cache = lerCacheBling(escolhida.id, Date.now(), CHAVE_CACHE_ULTIMA_COMPRA);
    const ultimas = {};
    const faltam = skus.filter((s) => { const g = cache[s]; if (g) { ultimas[s] = g.resposta; return false; } return true; });
    let inicioEm = 0; let partes = 0; let completa = true;
    while (faltam.some((s) => ultimas[s] === undefined) && partes < 8) {
      const pedir = faltam.filter((s) => ultimas[s] === undefined);
      const { data, error } = await supabase.functions.invoke("paizinho-bling-compras", { body: { skus: pedir, idsPorSku, inicioEm } });
      if (error || !data?.ok) return { ok: false, erro: data?.erro || error?.message || "sem resposta" };
      for (const [s, u] of Object.entries(data.ultimas || {})) if (u) ultimas[s] = u;
      partes++;
      if (!data.parcial || data.proximo === null || data.proximo === undefined) break;
      inicioEm = data.proximo;
      if (partes >= 8) completa = false;
    }
    for (const s of faltam) { if (ultimas[s] === undefined) ultimas[s] = null; cache[s] = { resposta: ultimas[s], lidoEm: Date.now() }; }
    gravarCacheBling(escolhida.id, cache, CHAVE_CACHE_ULTIMA_COMPRA);
    return { ok: true, ultimas, completa };
  };
  const buscarConcorrentes = concorrencia > 0 ? async (item) => {
    const a = (id) => (item.attributes || []).find((x) => x.id === id)?.value_name || "";
    const marca = a("BRAND");
    const original = /^(renault|volkswagen|vw|chevrolet|gm|fiat|ford|toyota|honda|hyundai|nissan|peugeot|citroen)$/i.test(marca.trim());
    const { data, error } = await supabase.functions.invoke("concorrencia", { body: { codigo: a("PART_NUMBER") || a("OEM"), titulo: item.title, fabricante: marca, categoria: original ? "original" : "equivalente" } });
    if (error || !data?.sucesso) return { ok: false, erro: error?.message || data?.error || "sem resultado" };
    return { ok: true, faixaComparavel: data.faixaComparavel, palavrasChaveSugeridas: data.palavrasChaveSugeridas };
  } : null;
  let rel;
  try {
    rel = await executarAuditoria({
      conta: escolhida.id,
      // (12/11) Vendas, visitas e custo de envio pela função paizinho-leitura-ml;
      // o resto continua pela mercadolivre-publicacao. As duas só leem.
      // (Pacote 1) O que já deu certo no ML volta da memória na retomada; mesmo período.
      consultar: consultaComRetomada(roteadorConsultas({ principal: consultorML(escolhida.id), comercial: consultorComercial(escolhida.id) }), ret),
      agora: ret.agora,
      consultarBling,
      consultarCusto,
      consultarUltimasCompras,
      buscarConcorrentes,
      config: { impostoPercentual: impostoDoPerfil() },
      opcoesColeta: { limiteItens, limiteConcorrencia: concorrencia, ...(escolherIds ? { escolherIds } : {}) },
      origem: "teste_local",
      aoProgredir,
    });
  } catch (e) {
    throw new Error(`${escolhida.nome}: ${String(e?.message || e)}`, { cause: e });
  } finally {
    if (novos) gravarCacheBling(escolhida.id, cache);
    if (novosCusto) gravarCacheBling(escolhida.id, cacheCusto, CHAVE_CACHE_CUSTO);
  }
  conferirRelatorioDaConta(rel, escolhida);
  // Terminou sem queda de login: a memória da retomada não é mais necessária.
  if (!parouPorLogin(rel) && retomadas.get(chaveRet) === ret) retomadas.delete(chaveRet);
  guardarRelatorioTesteLocal(rel);
  return rel;
}

// (Pacote 1) Retomada segura: memória da última rodada interrompida, por conta e tipo (só nesta página).
const retomadas = new Map();
export const podeContinuar = (conta, tipo, limiteItens) => {
  const chave = `${idDe(conta)}|${tipo}`;
  return retomadaValida(retomadas.get(chave), { limiteItens, chave });
};

/** (Pacote 1) Confere o login no servidor ANTES de começar (sessão encerrada por "Sair" em outro aparelho). */
async function conferirLogin() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) throw new Error(MSG_LOGIN_INVALIDO);
}

/* ------------------------------------------------------------ */
/* (17/11) FILA SEM REPETIÇÃO                                    */
/* ------------------------------------------------------------ */
const armazenamento = () => globalThis.localStorage;
const CHAVE_RODADA_A_GRAVAR = "paiia_paizinho_fila_a_gravar";
const chaveAGravar = (conta) => chaveDaConta(CHAVE_RODADA_A_GRAVAR, conta);

/**
 * Abre a fila da conta: no BANCO se a migração já foi aplicada; senão NESTE NAVEGADOR.
 * Também tenta gravar uma rodada que ficou pendente (falha ao salvar) e informa quanto
 * do registro do navegador ainda não foi para o banco.
 */
export async function abrirFila(conta) {
  const id = idDe(conta);
  const local = repositorioNavegador(armazenamento(), id);
  let repo = local;
  let avisoBanco = "";
  let estado;
  try {
    const banco = repositorioBanco(supabase, id);
    estado = await banco.carregar();
    repo = banco;
  } catch (e) {
    avisoBanco = e?.semEstrutura
      ? "Banco da fila ainda não ativado (migração aguardando aprovação): o progresso fica guardado neste navegador."
      : `Banco indisponível agora (${String(e?.message || e)}): usando o registro deste navegador.`;
    estado = await local.carregar();
  }
  const reenviada = await regravarRodadaPendente(repo, id);
  const importadas = await importarHistoricoAntigo(repo, id);
  if (reenviada || importadas) estado = await repo.carregar();
  const naoEnviados = repo.origem === ORIGEM.BANCO ? local.registro().length : 0;
  return { repo, estado, origem: repo.origem, avisoBanco, naoEnviados };
}

/**
 * (17/11) Resolvido/Remover feitos antes da fila (histórico só do navegador) entram na fila
 * como ações, com id fixo ("legado:..."): importar de novo não duplica.
 */
export async function importarHistoricoAntigo(repo, conta) {
  let n = 0;
  for (const h of lerHistorico(armazenamento(), conta)) {
    const r = await repo.registrarAcao({ id: `legado:${h.id}`, conta: idDe(conta), acao: h.acao, mlb: h.item_id, area: h.area, motivo: h.motivo || "", problema: h.problema, titulo: h.titulo, em: h.em });
    if (r.ok && !r.ja) n++;
  }
  return n;
}

async function regravarRodadaPendente(repo, conta) {
  let pendente;
  try { pendente = JSON.parse(armazenamento().getItem(chaveAGravar(conta)) || "null"); } catch { pendente = null; }
  if (!pendente?.id) return false;
  const r = await repo.registrarRodada(pendente);
  if (r.ok) { try { armazenamento().removeItem(chaveAGravar(conta)); } catch { /* segue */ } return true; }
  return false;
}

/** Envia ao banco o registro deste navegador (mesma ordem; nada duplica). */
export async function enviarFilaDoNavegador(conta) {
  const local = repositorioNavegador(armazenamento(), conta);
  return enviarRegistroParaBanco(local.registro(), repositorioBanco(supabase, conta));
}

/**
 * Analisa uma rodada da fila (somente leitura no ML e no Bling) e só depois registra.
 * modo "novos": N anúncios nunca analisados nesta conta; "reanalise": N já analisados.
 * Falha no meio → nada registrado. Falha ao salvar → a rodada fica guardada e é gravada
 * na próxima abertura (mesmo id: não duplica).
 */
export async function analisarFila({ conta, modo, quantidade = 20, concorrencia = 0, aoProgredir, fila, continuar = false }) {
  const id = idDe(conta);
  const aberta = fila || (await abrirFila(id));
  const estadoAntes = aberta.estado;
  const info = { ativosTotal: null, ineditosAntes: null, listaCompleta: true, escolhidos: [] };
  const escolherIds = (idsAtivos, { total, completa }) => {
    info.ativosTotal = total || idsAtivos.length;
    info.listaCompleta = completa;
    const ined = escolherIneditos(idsAtivos, estadoAntes, quantidade);
    info.ineditosAntes = ined.ineditosAntes;
    info.escolhidos = modo === MODO.NOVOS ? ined.escolhidos : escolherReanalise(idsAtivos, estadoAntes, quantidade);
    if (!info.escolhidos.length) throw new Error(modo === MODO.NOVOS ? "Não há anúncios inéditos nesta conta: todos já foram analisados." : "Ainda não há anúncios analisados para reanalisar nesta conta.");
    return info.escolhidos;
  };
  // (Pacote 1) continuar = retoma a rodada interrompida pela queda do login (mesma conta e tipo).
  const rel = await rodarTesteLocal({ conta: id, limiteItens: quantidade, concorrencia, aoProgredir, escolherIds, continuar, tipo: modo });
  const m = montarRodada({ id: novoId(), conta: id, modo, rel, ativosTotal: info.ativosTotal, ineditosAntes: info.ineditosAntes, listaCompleta: info.listaCompleta });
  if (!m.ok) return { rel, registrada: false, erro: m.erro, estado: estadoAntes };
  try { armazenamento().setItem(chaveAGravar(id), JSON.stringify(m.rodada)); } catch { /* segue: grava direto */ }
  const r = await aberta.repo.registrarRodada(m.rodada);
  if (!r.ok) return { rel, registrada: false, erro: `Análise concluída, mas não foi salva ainda (${r.erro}). Ela fica guardada e é gravada ao abrir de novo.`, estado: estadoAntes };
  try { armazenamento().removeItem(chaveAGravar(id)); } catch { /* segue */ }
  return { rel, registrada: true, rodada: m.rodada, estado: await aberta.repo.carregar() };
}

/** Resolvido / Remover da lista / Voltar para a lista — só no histórico da fila desta conta. */
export async function registrarAcaoFila(fila, { acao, achado, motivo = "" }) {
  return fila.repo.registrarAcao({
    id: novoId(), conta: idDe(fila.estado.conta), acao, mlb: achado.item_id, area: achado.area, motivo,
    severidade: achado.severidade, problema: achado.problema, sugestao: achado.sugestao, titulo: achado.titulo, em: new Date().toISOString(),
  });
}
