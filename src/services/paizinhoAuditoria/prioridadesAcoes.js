// =============================================================
// PAIIA — Central do Paizinho: CONTA, LINK e AÇÕES nas "Prioridades de hoje" (17/11/2026).
//
// 1) Conta do anúncio: SÓ pelo vínculo real lido no Mercado Livre (seller_id do
//    próprio anúncio, gravado na análise). Sem confirmação → "Conta não identificada".
// 2) Link da Central de Anúncios do ML (área do vendedor), nunca a página pública
//    do produto. O ML abre na conta logada no navegador: o PAIIA não troca de conta,
//    então o aviso diz em qual conta entrar.
// 3) "Resolvido" e "Remover da lista": mexem SÓ na lista do PAIIA e ficam no
//    histórico. Nada aqui chama o Mercado Livre ou o Bling (nenhum anúncio é
//    excluído, pausado ou modificado).
// Funções puras; o armazenamento chega por injeção (localStorage no app).
// =============================================================

/** As três contas Mercado Livre do PAIIA (mesmos ids da Publicação). */
export const CONTAS_ML = Object.freeze([
  Object.freeze({ id: "1729335019", nome: "LOJA ONLINE" }),
  Object.freeze({ id: "824312524", nome: "CIEBR" }),
  Object.freeze({ id: "2412238242", nome: "REVELAÇÃO" }),
]);

export const CONTA_NAO_IDENTIFICADA = "Conta não identificada";

const txt = (v) => String(v ?? "").trim();
const idConta = (v) => txt(v).replace(/\D/g, "");
const mlbValido = (v) => {
  const t = txt(v).toUpperCase().replace(/^MLB-?/, "MLB");
  return /^MLB\d{6,}$/.test(t) ? t : "";
};

export function contaPorId(id) {
  const c = idConta(id);
  return c ? CONTAS_ML.find((x) => x.id === c) || null : null;
}

/**
 * Conta dona do MLB.
 * - vendedor_id do anúncio (seller_id lido no ML durante a análise) = fonte principal;
 * - relatórios antigos (sem vendedor_id por anúncio): a coleta só aceita anúncios cujo
 *   seller_id é o da conta do relatório (os outros são descartados), então a conta do
 *   relatório também é um vínculo conferido no ML;
 * - id desconhecido, ausente ou divergente da conta do relatório → não identificada.
 */
export function contaDoAnuncio(anuncio, rel) {
  const vendedor = idConta(anuncio?.vendedor_id);
  const contaRel = idConta(rel?.conta?.id);
  if (vendedor) {
    const c = contaPorId(vendedor);
    if (!c) return { identificada: false, id: vendedor, nome: CONTA_NAO_IDENTIFICADA, origem: `vendedor ${vendedor} não é uma das 3 contas do PAIIA` };
    if (contaRel && contaRel !== vendedor) return { identificada: false, id: vendedor, nome: CONTA_NAO_IDENTIFICADA, origem: "vendedor do anúncio diferente da conta da análise" };
    return { identificada: true, id: c.id, nome: c.nome, origem: "vendedor do anúncio lido no Mercado Livre" };
  }
  const c = contaPorId(contaRel);
  if (c && mlbValido(anuncio?.item_id)) return { identificada: true, id: c.id, nome: c.nome, origem: "conta da análise (cada anúncio conferido pelo vendedor na leitura do ML)" };
  return { identificada: false, id: "", nome: CONTA_NAO_IDENTIFICADA, origem: "sem vínculo confirmado no Mercado Livre" };
}

/**
 * Link para achar o MLB na Central de Anúncios do Mercado Livre (área do vendedor).
 * Não é o link público do produto. O ML abre na conta que estiver logada no navegador.
 */
export function linkCentralAnuncios(mlb, conta) {
  const m = mlbValido(mlb);
  if (!m) return { url: "", aviso: "MLB inválido: não há como abrir a Central de Anúncios." };
  const url = `https://www.mercadolivre.com.br/anuncios/lista?search=${encodeURIComponent(m)}`;
  const aviso = conta?.identificada
    ? `Abre a Central de Anúncios do Mercado Livre na conta que estiver logada neste navegador (o PAIIA não troca de conta). Entre na conta ${conta.nome} antes; se o ${m} não aparecer, você está em outra conta.`
    : `Conta não identificada: não é possível garantir em qual das 3 contas o ${m} está. A Central de Anúncios abre na conta logada; procure o ${m} em LOJA ONLINE, CIEBR e REVELAÇÃO.`;
  return { url, aviso, mlb: m };
}

/* ------------------------------------------------------------ */
/* Histórico das ações (só a lista do PAIIA)                    */
/* ------------------------------------------------------------ */

export const CHAVE_HISTORICO = "paiia_paizinho_prioridades_historico_v1";
export const ACAO = Object.freeze({ RESOLVIDO: "resolvido", REMOVIDO: "removido", DEVOLVIDO: "devolvido" });
export const ROTULO_ACAO = Object.freeze({ resolvido: "✅ Resolvido", removido: "🗑️ Removido da lista", devolvido: "↩️ Voltou para a lista" });
export const MOTIVOS_REMOCAO = Object.freeze([
  "Já corrigido manualmente no Mercado Livre",
  "Não é problema (análise não se aplica)",
  "Anúncio será tratado depois",
  "Outro motivo",
]);

/** Chave do item na lista: o mesmo MLB pode ter achados de assuntos diferentes. */
export const chaveAchado = (a) => `${mlbValido(a?.item_id) || txt(a?.item_id)}|${txt(a?.area)}`;

export function lerHistorico(armazenamento) {
  try {
    const h = JSON.parse(armazenamento?.getItem(CHAVE_HISTORICO) || "[]");
    return Array.isArray(h) ? h.filter((x) => x && x.chave && x.acao) : [];
  } catch {
    return [];
  }
}

/**
 * Registra uma ação. Remover exige motivo. Devolve { ok, historico, erro }.
 * Nunca chama o Mercado Livre ou o Bling.
 */
export function registrarAcao(armazenamento, { acao, achado, conta, motivo = "", rel = null, agora = new Date() }) {
  if (!Object.values(ACAO).includes(acao)) return { ok: false, erro: "Ação desconhecida." };
  if (!achado?.item_id) return { ok: false, erro: "Anúncio sem MLB." };
  const m = txt(motivo);
  if (acao === ACAO.REMOVIDO && !m) return { ok: false, erro: "Informe o motivo para remover da lista." };
  const historico = lerHistorico(armazenamento);
  const reg = {
    id: `${agora.getTime()}-${historico.length + 1}`,
    em: agora.toISOString(),
    acao,
    chave: chaveAchado(achado),
    item_id: txt(achado.item_id),
    area: txt(achado.area),
    sku: txt(achado.sku),
    titulo: txt(achado.titulo).slice(0, 120),
    problema: txt(achado.problema).slice(0, 240),
    conta_id: conta?.identificada ? conta.id : "",
    conta_nome: conta?.nome || CONTA_NAO_IDENTIFICADA,
    motivo: m,
    relatorio_de: txt(rel?.gerado_em),
  };
  const novo = [...historico, reg];
  try {
    armazenamento.setItem(CHAVE_HISTORICO, JSON.stringify(novo));
  } catch {
    return { ok: false, erro: "Não foi possível gravar o histórico neste navegador." };
  }
  return { ok: true, historico: novo, registro: reg };
}

/** Última ação de cada item (por chave). */
export function ultimaAcaoPorChave(historico) {
  const m = new Map();
  for (const h of historico || []) m.set(h.chave, h);
  return m;
}

/**
 * Separa a lista de prioridades entre o que aparece e o que saiu.
 * - Removido da lista: fica fora (também nas análises seguintes) até "Voltar para a lista".
 * - Resolvido: fica fora deste relatório; se uma análise FEITA DEPOIS ainda encontrar o
 *   mesmo problema, ele volta (com o aviso "marcado como resolvido em ...").
 */
export function separarPrioridades(lista, historico, rel) {
  const ultima = ultimaAcaoPorChave(historico);
  const geradoEm = Date.parse(txt(rel?.gerado_em)) || 0;
  const visiveis = [];
  const fora = [];
  for (const a of lista || []) {
    const h = ultima.get(chaveAchado(a));
    if (!h || h.acao === ACAO.DEVOLVIDO) { visiveis.push({ achado: a, acao: null }); continue; }
    if (h.acao === ACAO.REMOVIDO) { fora.push({ achado: a, acao: h }); continue; }
    const marcadoEm = Date.parse(h.em) || 0;
    if (geradoEm && geradoEm > marcadoEm) visiveis.push({ achado: a, acao: h, reapareceu: true });
    else fora.push({ achado: a, acao: h });
  }
  return { visiveis, fora };
}
