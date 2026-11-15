// =============================================================
// PAIIA — CONTAS DA PUBLICAÇÃO no Mercado Livre (14/11/2026).
//
// A escolha das contas saiu da preparação (Novo Anúncio: o frete lá é só
// ESTIMATIVA de referência) e ficou na etapa final de Publicação:
//   - uma caixa independente por conta: LOJA ONLINE, REVELAÇÃO, CIEBR
//     (1, 2 ou as 3);
//   - cada conta marcada é conferida SEPARADAMENTE (conexão, estoque,
//     duplicidade, frete oficial DAQUELA conta, preço/margem);
//   - impedimento numa conta NUNCA bloqueia as outras liberadas;
//   - nada é publicado sem a confirmação final, que mostra exatamente
//     quais contas serão usadas.
// Tudo aqui é SOMENTE LEITURA: as consultas chegam por injeção (deps) e
// nenhuma delas grava no Mercado Livre, no Bling ou na base.
// =============================================================
import { parametrosCotacao, cotarNoPreco, resultadoDoPreco, reais, ORIGEM_FRETE } from "./fretePrecificacao.js";
import { conferirRegistrosNoML, avaliarRegistrosBase } from "./duplicidadeML.js";

/** As três contas Mercado Livre do PAIIA, na ordem da publicação. */
export const CONTAS_PUBLICACAO_ML = Object.freeze([
  Object.freeze({ id: "1729335019", nome: "LOJA ONLINE" }),
  Object.freeze({ id: "2412238242", nome: "REVELAÇÃO" }),
  Object.freeze({ id: "824312524", nome: "CIEBR" }),
]);

/** Conta que hoje tem a publicação automática (piloto); as outras seguem a Publicação manual. */
export const CONTA_PUBLICACAO_AUTOMATICA = "1729335019";

export const SITUACAO_CONTA = Object.freeze({ LIBERADA: "liberada", CONFERIR: "conferir", IMPEDIDA: "impedida" });

const txt = (v) => String(v ?? "").trim();
const idConta = (v) => txt(v).replace(/\D/g, "");
const numero = (v) => {
  if (typeof v === "number") return v;
  const s = txt(v).replace(/[^\d,.-]/g, "");
  if (!s) return NaN;
  return Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
};

export function nomeContaPublicacao(id) {
  return CONTAS_PUBLICACAO_ML.find((c) => c.id === idConta(id))?.nome || `Conta ${idConta(id) || "?"}`;
}

/** Seleção → ids válidos, sem repetição, sempre na ordem LOJA ONLINE, REVELAÇÃO, CIEBR. */
export function normalizarContasSelecionadas(selecao) {
  const marcadas = new Set();
  if (Array.isArray(selecao)) for (const x of selecao) marcadas.add(idConta(x));
  else if (selecao && typeof selecao === "object") for (const [k, v] of Object.entries(selecao)) if (v === true) marcadas.add(idConta(k));
  return CONTAS_PUBLICACAO_ML.filter((c) => marcadas.has(c.id)).map((c) => c.id);
}

/** Modalidade para cotar NESTA conta: a da estimativa se estiver ativa aqui; senão a padrão da conta. */
export function modalidadeParaConta(modalidades, preferida = "") {
  const lista = Array.isArray(modalidades) ? modalidades : [];
  if (preferida && lista.some((m) => m?.tipo === preferida)) return preferida;
  return lista.find((m) => m?.padrao)?.tipo || lista[0]?.tipo || "";
}

/** Quantidade da ficha: inteiro ≥ 1, senão null. */
export function quantidadeValida(q) {
  const n = numero(q);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

async function seguro(fn) {
  try {
    return await fn();
  } catch (e) {
    return { erro: txt(e?.message || e) || "falha inesperada" };
  }
}

/**
 * Confere UMA conta. Nunca lança erro: qualquer falha vira impedimento
 * só desta conta.
 *
 * dados: { sku, codigo, preco, quantidade, medida, registroFrete, base }
 * deps (somente leitura):
 *   conectada(id) → boolean
 *   modalidades(id) → { ok, modalidades:[{tipo,padrao}], erro }
 *   consultar(id) → consultar(caminho) (ml_consulta GET da conta)
 *   duplicidadeBase({ codigo, sku, contaId }) → { ok, registros, erro }
 *   duplicidadeML({ conta, codigos, consultar }) → { verificado, duplicados, possiveis } | { erro }
 */
export async function verificarContaPublicacao({ contaId, dados = {}, deps = {} }) {
  const id = idConta(contaId);
  const nome = nomeContaPublicacao(id);
  const itens = [];
  const add = (item, nivel, texto) => itens.push({ item, nivel, texto });
  const resultado = { conta: id, nome, itens, frete: null, margem: null, duplicidade: null };

  if (!CONTAS_PUBLICACAO_ML.some((c) => c.id === id)) {
    add("Conta", "erro", "Conta fora da lista de contas da publicação (LOJA ONLINE, REVELAÇÃO, CIEBR).");
    return fechar(resultado);
  }

  // 1) Conexão / exigências da conta.
  const conectada = await seguro(async () => Boolean(await deps.conectada?.(id)));
  if (conectada !== true) {
    add("Conexão", "erro", `${nome} não está conectada ao PAIIA (Contas Marketplace). Conecte a conta para publicar nela.`);
    return fechar(resultado);
  }
  add("Conexão", "ok", `${nome} conectada (ID ${id}).`);

  // 2) Estoque (quantidade da ficha que vai para esta conta).
  const qtd = quantidadeValida(dados.quantidade);
  if (!qtd) add("Estoque", "erro", "Quantidade da ficha ausente ou inválida (precisa ser um número inteiro de 1 para cima).");
  else add("Estoque", "ok", `Quantidade ${qtd} un.`);

  // 3) Preço.
  const preco = numero(dados.preco);
  const precoOk = Number.isFinite(preco) && preco > 0;
  if (!precoOk) add("Preço", "erro", "Preço de venda ausente ou inválido na ficha.");

  // 4) Duplicidade nesta conta: base PAIIA + Mercado Livre (leitura).
  const sku = txt(dados.sku) || txt(dados.codigo);
  if (!sku) {
    add("Duplicidade", "erro", "Sem SKU/código na ficha: a duplicidade não pode ser conferida.");
  } else {
    const dupBase = await seguro(() => deps.duplicidadeBase({ codigo: txt(dados.codigo) || sku, sku, contaId: id }));
    if (!dupBase?.ok) {
      add("Duplicidade", "erro", `Não foi possível conferir a base PAIIA nesta conta (${txt(dupBase?.erro) || "sem resposta"}).`);
    } else {
      const ml = await seguro(() => deps.duplicidadeML({ conta: id, codigos: [sku, txt(dados.codigo)].filter(Boolean), consultar: deps.consultar(id) }));
      const registros = dupBase.registros || [];
      resultado.duplicidade = { base: registros.map((r) => txt(r.mlb_id) || txt(r.id)), ml: ml?.erro ? null : { duplicados: ml?.duplicados || [], possiveis: ml?.possiveis || [] }, anteriores: [] };
      if (ml?.erro) {
        add("Duplicidade", "erro", `Não foi possível conferir os anúncios desta conta no Mercado Livre (${ml.erro}).`);
      } else {
        // (14/11) Cada MLB registrado na base é conferido AGORA no Mercado Livre
        // desta conta: só "excluído" ou "encerrado" confirmado deixa de bloquear
        // (vira histórico). Dúvida, ativo ou pausado continuam bloqueando.
        const jaListados = [...(ml.duplicados || []), ...(ml.possiveis || [])].map((d) => d.id);
        const conferidosBase = await conferirRegistrosNoML({ registros, conta: id, consultar: deps.consultar(id), jaListados });
        const av = avaliarRegistrosBase({ registros, ml: { ...ml, conferidosBase } });
        resultado.duplicidade.anteriores = av.anteriores.map((a) => ({ mlb: a.mlb, situacao: a.situacao, rotulo: a.rotulo || "", ficha_origem: a.ficha_origem || "" }));
        const historico = av.anteriores.length
          ? ` Histórico: ${av.anteriores.map((a) => `${a.mlb} ${a.rotulo || "excluído/encerrado no Mercado Livre"}`).join("; ")} — não bloqueia.`
          : "";
        if ((ml.duplicados || []).length) add("Duplicidade", "erro", `Este SKU já tem anúncio nesta conta: ${ml.duplicados.map((d) => `${d.id} (${d.status})`).join(", ")}.`);
        else if (av.pendentes.length) add("Duplicidade", "erro", `Este SKU já tem publicação registrada nesta conta que ainda existe ou não pôde ser confirmada no Mercado Livre: ${av.pendentes.map((p) => `${p.mlb} (${p.motivo})`).join("; ")}.`);
        else if ((ml.possiveis || []).length) add("Duplicidade", "conferir", `Possível duplicidade (mesmo código, SKU diferente): ${ml.possiveis.map((d) => `${d.id} (${d.status})`).join(", ")}. Confira no Mercado Livre e marque se NÃO for o mesmo produto.${historico}`);
        else add("Duplicidade", "ok", `Nenhum anúncio ativo deste SKU nesta conta.${historico}`);
      }
    }
  }

  // 5) Frete: cotação OFICIAL desta conta, no preço da ficha.
  const reg = dados.registroFrete || null;
  const medida = dados.medida || reg?.medida || null;
  if (!precoOk) {
    add("Frete", "erro", "Sem preço válido não há como cotar o frete desta conta.");
  } else if (!medida) {
    add("Frete", "erro", "Peso e medidas da embalagem ausentes: o frete desta conta não pode ser cotado.");
  } else {
    const mods = await seguro(() => deps.modalidades(id));
    const modalidade = modalidadeParaConta(mods?.modalidades, txt(reg?.modalidade));
    if (!modalidade) {
      add("Frete", "erro", `Sem modalidade de envio ativa nesta conta (${txt(mods?.erro) || "Mercado Envios"}).`);
    } else {
      const params = parametrosCotacao({ conta: id, medida, modalidade, categoria: txt(dados.categoria) || txt(reg?.categoria), tipoAnuncio: txt(dados.tipoAnuncio) || txt(reg?.tipoAnuncio) });
      const c = await seguro(() => cotarNoPreco({ params, preco, consultar: deps.consultar(id) }));
      if (!c?.ok) {
        add("Frete", "erro", `O Mercado Livre não cotou o frete nesta conta (${txt(c?.erro) || "sem resposta"}).`);
      } else if (c.origem === ORIGEM_FRETE.SIMULACAO && !deps.simulacaoPermitida) {
        add("Frete", "erro", "A cotação veio SIMULADA: só vale a cotação oficial do Mercado Livre.");
      } else {
        resultado.frete = { valor: c.custo_vendedor, peso_cobrado_g: c.peso_cobrado_g, modalidade, cotado_em: c.cotado_em || null, origem: c.origem };
        const ref = Number(reg?.final?.custo_vendedor);
        const dif = Number.isFinite(ref) && Math.round(ref * 100) !== Math.round(c.custo_vendedor * 100) ? ` (estimativa da preparação: ${reais(ref)})` : "";
        add("Frete", "ok", `Frete oficial desta conta: ${reais(c.custo_vendedor)} no preço ${reais(preco)} · peso cobrado ${c.peso_cobrado_g} g · ${modalidade}${dif}.`);
      }
    }
  }

  // 6) Preço x custos com o frete DESTA conta (mesmo cálculo da precificação).
  const base = dados.base || reg?.base || null;
  if (precoOk && resultado.frete) {
    if (!(Number(base?.custo) > 0)) {
      add("Preço", "aviso", `Preço ${reais(preco)}. Sem custo na ficha: a margem nesta conta não pôde ser conferida.`);
    } else {
      const r = resultadoDoPreco({ preco, frete: resultado.frete.valor, base });
      resultado.margem = { resultado: r.resultado, margemPct: r.margemPct };
      if (r.resultado <= 0) add("Preço", "erro", `Com o frete desta conta o preço ${reais(preco)} dá prejuízo (${reais(r.resultado)}; margem ${r.margemPct}%). Ajuste o preço antes de publicar aqui.`);
      else add("Preço", "ok", `Preço ${reais(preco)} · resultado ${reais(r.resultado)} (margem ${r.margemPct}%) com o frete desta conta.`);
    }
  }
  return fechar(resultado);
}

function fechar(r) {
  const erros = r.itens.filter((i) => i.nivel === "erro");
  const conferir = r.itens.filter((i) => i.nivel === "conferir");
  r.situacao = erros.length ? SITUACAO_CONTA.IMPEDIDA : conferir.length ? SITUACAO_CONTA.CONFERIR : SITUACAO_CONTA.LIBERADA;
  r.impedimentos = erros.map((i) => `${i.item}: ${i.texto}`);
  r.verificado_em = new Date().toISOString();
  return r;
}

/**
 * Confere TODAS as contas marcadas, cada uma por conta própria (em
 * paralelo): o erro de uma nunca derruba a verificação das outras.
 */
export async function verificarContasPublicacao({ selecao, dados = {}, deps = {} }) {
  const contas = normalizarContasSelecionadas(selecao);
  const resultados = await Promise.all(contas.map(async (contaId) => {
    try {
      return await verificarContaPublicacao({ contaId, dados, deps });
    } catch (e) {
      return fechar({ conta: contaId, nome: nomeContaPublicacao(contaId), itens: [{ item: "Verificação", nivel: "erro", texto: `Falha inesperada ao conferir esta conta (${txt(e?.message || e)}).` }], frete: null, margem: null, duplicidade: null });
    }
  }));
  return { contas, resultados, assinatura: assinaturaVerificacao(contas, dados) };
}

/** O que, se mudar, invalida a verificação (contas, SKU, preço, quantidade, medidas). */
export function assinaturaVerificacao(selecao, dados = {}) {
  const m = dados.medida || dados.registroFrete?.medida || null;
  return JSON.stringify([normalizarContasSelecionadas(selecao), txt(dados.sku) || txt(dados.codigo), numero(dados.preco) || 0, quantidadeValida(dados.quantidade) || 0, m ? [m.peso_g, m.comprimento_cm, m.largura_cm, m.altura_cm] : null]);
}

/**
 * Contas que entram na publicação: as liberadas + as "conferir" que você
 * confirmou (possível duplicidade conferida). Impedidas ficam de fora.
 * conferidas: { [contaId]: true }.
 */
export function contasLiberadas(resultados = [], conferidas = {}) {
  return (resultados || [])
    .filter((r) => r.situacao === SITUACAO_CONTA.LIBERADA || (r.situacao === SITUACAO_CONTA.CONFERIR && conferidas?.[r.conta] === true))
    .map((r) => r.conta);
}

/** Texto da confirmação final: exatamente quais contas serão usadas e quais ficam de fora. */
export function resumoConfirmacao(resultados = [], conferidas = {}) {
  const usar = contasLiberadas(resultados, conferidas);
  const fora = (resultados || []).filter((r) => !usar.includes(r.conta));
  const nomes = usar.map(nomeContaPublicacao);
  return {
    contas: usar,
    nomes,
    fora: fora.map((r) => ({ conta: r.conta, nome: r.nome, motivo: r.situacao === SITUACAO_CONTA.CONFERIR ? "possível duplicidade ainda não conferida" : (r.impedimentos || []).join(" · ") })),
    texto: usar.length
      ? `Publicar SOMENTE em: ${nomes.join(", ")}.${fora.length ? ` Fora desta publicação: ${fora.map((r) => r.nome).join(", ")}.` : ""}`
      : "Nenhuma conta liberada: nada será publicado.",
  };
}

/**
 * Plano gravado na ficha (dados_conferencia.contas_publicacao) depois da
 * confirmação final. Uma ficha publica em UMA conta do Mercado Livre por
 * vez (paiia_anuncios_publicacoes: 1 linha por ficha × marketplace): a
 * primeira conta confirmada é a desta ficha; as demais ficam na fila.
 */
export function montarPlanoContas({ selecao, resultados = [], conferidas = {}, agora = new Date().toISOString() }) {
  const confirmadas = contasLiberadas(resultados, conferidas);
  return {
    versao: 1,
    selecionadas: normalizarContasSelecionadas(selecao),
    confirmadas,
    conta_desta_ficha: confirmadas[0] || "",
    fila: confirmadas.slice(1),
    impedidas: (resultados || []).filter((r) => !confirmadas.includes(r.conta)).map((r) => ({ conta: r.conta, nome: r.nome, situacao: r.situacao, impedimentos: r.impedimentos || [] })),
    verificacao: (resultados || []).map((r) => ({ conta: r.conta, nome: r.nome, situacao: r.situacao, frete: r.frete, margem: r.margem, verificado_em: r.verificado_em })),
    confirmado_em: agora,
  };
}

/**
 * Conta usada SÓ para a estimativa de frete da preparação (Novo Anúncio):
 * a conta ativa; senão a primeira conectada na ordem LOJA ONLINE,
 * REVELAÇÃO, CIEBR; senão qualquer conectada. Não é a conta da publicação.
 */
export function contaReferenciaFrete(contasConectadas = []) {
  const lista = (Array.isArray(contasConectadas) ? contasConectadas : []).filter((c) => idConta(c?.ml_user_id));
  return lista.find((c) => c.ativa)
    || CONTAS_PUBLICACAO_ML.map((x) => lista.find((c) => idConta(c.ml_user_id) === x.id)).find(Boolean)
    || lista[0]
    || null;
}

// ------------------------------------------------------------------
// FILA DE CONTAS (14/11/2026). Uma ficha publica em UMA conta do Mercado
// Livre. Depois de publicada, a próxima conta confirmada ganha a SUA ficha:
// cópia da ficha aprovada (mesmo anúncio, mesmas fotos), sem nada da
// publicação anterior (MLB, vínculo Bling). Na ficha nova a conta passa de
// novo pela conferência daquela conta e pela sua confirmação final.
// ------------------------------------------------------------------

/** Chaves da ficha que pertencem à PUBLICAÇÃO anterior: nunca vão para a ficha da próxima conta. */
export const CHAVES_DA_PUBLICACAO_ANTERIOR = Object.freeze(["integracao_bling", "mlbs_anteriores", "pos_publicacao", "contas_publicacao", "versoes_substituidas", "republicacao", "mlb_trocado"]);

/**
 * Situação da fila numa ficha publicada. A ficha só aponta a PRÓXIMA conta
 * (fila[0]); as seguintes vão junto como sugestão e continuam a partir da
 * ficha nova (que terá a sua própria fila depois da confirmação).
 */
export function situacaoFila(plano) {
  const fila = normalizarContasSelecionadas(plano?.fila || []);
  const continuacoes = plano?.continuacoes && typeof plano.continuacoes === "object" ? plano.continuacoes : {};
  const proxima = fila[0] || "";
  return { fila, continuacoes, proxima, fichaPreparada: proxima ? txt(continuacoes[proxima]?.ficha) : "", vazia: !proxima };
}

/**
 * dados_conferencia da ficha da PRÓXIMA conta: a mesma Conferência aprovada,
 * com a marca das fotos refeita para o ID novo (as fotos continuam valendo),
 * sem as chaves da publicação anterior e com o pedido de contas pendente.
 */
export function dadosParaProximaConta(dados, { novoId, origemId, origemConta = "", origemMlb = "", sugeridas = [], marcarFotos = null, agora = new Date().toISOString() }) {
  const d = JSON.parse(JSON.stringify(dados || {}));
  for (const k of CHAVES_DA_PUBLICACAO_ANTERIOR) delete d[k];
  if (d.ficha && typeof d.ficha === "object") {
    const campos = d.ficha.campos && typeof d.ficha.campos === "object" ? d.ficha.campos : null;
    const conf = d.ficha.anuncioConferido && typeof d.ficha.anuncioConferido === "object" ? d.ficha.anuncioConferido : null;
    if (campos) {
      campos.anuncioIdPAIIA = novoId;
      campos.contaDestinoML = "";
      if (marcarFotos && Array.isArray(campos.fotos) && campos.fotos.length) campos.fotosFichaId = marcarFotos(novoId, campos.fotos);
    }
    if (conf && marcarFotos && Array.isArray(conf.fotos) && conf.fotos.length) conf.fotosFichaId = marcarFotos(novoId, conf.fotos);
    if (conf && conf.fichaIdPAIIA) conf.fichaIdPAIIA = novoId;
  }
  d.contas_publicacao = {
    versao: 1,
    pendente: true,
    sugeridas: normalizarContasSelecionadas(sugeridas),
    origem: { ficha: origemId, conta: idConta(origemConta), mlb: txt(origemMlb) },
    criado_em: agora,
  };
  return d;
}

// ------------------------------------------------------------------
// (14/11) RETOMAR uma ficha cujo MLB foi ENCERRADO ou EXCLUÍDO no Mercado
// Livre. A ficha publicada e a linha de publicação dela ficam INTACTAS
// (histórico). Uma ficha nova recebe a mesma Conferência aprovada (fotos,
// descrição, aplicações, preço) e:
//   - mlbs_anteriores com o MLB encerrado (histórico, não bloqueia);
//   - pedido de conta pendente, sugerindo a MESMA conta;
//   - origem.motivo = "republicacao".
// Nada é publicado e nada vai ao Bling aqui: a conta passa de novo pela
// conferência (duplicidade AO VIVO no ML) e pela confirmação final.
// ------------------------------------------------------------------

/** Pode retomar? Só com o ML confirmando AGORA que ESTE MLB, nesta conta, está encerrado/excluído. */
export function podeRetomarFicha({ publicacao, situacao }) {
  const mlb = txt(publicacao?.mlb_id).toUpperCase();
  const conta = idConta(publicacao?.ml_user_id);
  if (!mlb || !conta) return { pode: false, motivo: "Esta ficha não tem MLB publicado: continue a publicação normal." };
  if (!situacao || situacao.libera !== true) {
    return { pode: false, motivo: `O Mercado Livre não confirmou que o ${mlb} está encerrado ou excluído (${txt(situacao?.motivo) || "sem leitura"}). A ficha não é reaberta.` };
  }
  if (txt(situacao.mlb).toUpperCase() !== mlb || idConta(situacao.conta) !== conta) {
    return { pode: false, motivo: "A leitura do Mercado Livre não é deste MLB/conta: a ficha não é reaberta." };
  }
  return { pode: true, mlb, conta, situacao: txt(situacao.situacao) };
}

/** dados_conferencia da ficha que RETOMA a publicação (função pura). */
export function dadosParaRepublicacao(dados, { novoId, origemId, publicacao, situacao, marcarFotos = null, agora = new Date().toISOString() }) {
  const mlb = txt(publicacao?.mlb_id).toUpperCase();
  const conta = idConta(publicacao?.ml_user_id);
  const d = dadosParaProximaConta(dados, { novoId, origemId, origemConta: conta, origemMlb: mlb, sugeridas: [conta], marcarFotos, agora });
  d.contas_publicacao.origem.motivo = "republicacao";
  d.mlbs_anteriores = [{
    mlb,
    conta,
    status_ml: txt(situacao?.status),
    sub_status_ml: Array.isArray(situacao?.sub_status) ? situacao.sub_status : [],
    situacao: situacao?.situacao === "excluido" ? "excluido_no_ml" : "encerrado_no_ml",
    texto: `MLB anterior: ${mlb} — ${txt(situacao?.rotulo) || "excluído/encerrado no Mercado Livre"} — não bloqueia nova publicação.`,
    ficha_origem: txt(origemId),
    publicado_em: txt(publicacao?.publicado_em),
    preco_no_ml: Number.isFinite(Number(situacao?.preco)) && situacao?.preco !== null ? Number(situacao.preco) : null,
    bling_produto_id: txt(publicacao?.bling_produto_id || dados?.integracao_bling?.bling_produto_id),
    conferido_em: agora,
  }];
  return d;
}

// ------------------------------------------------------------------
// (15/11) PUBLICAR EM OUTRA CONTA, a qualquer momento (dias depois, sem plano
// prévio). Cada conta tem a SUA ficha (cópia da Conferência aprovada) e o SEU
// MLB; todas ligadas à ficha de origem (contas_publicacao.continuacoes/origem).
// Nunca reaproveita MLB, vínculo do Bling ou conferências de outra conta.
// ------------------------------------------------------------------
export const ESTADO_CONTA_PRODUTO = Object.freeze({ PUBLICADA: "publicada", EM_ANDAMENTO: "em_andamento", DISPONIVEL: "disponivel" });
const MLB_OK = /^MLB\d{6,}$/;

/**
 * Quadro das 3 contas para um produto (SKU), a partir das fichas do código
 * (listarAnunciosDoCodigo: com a linha de publicação de cada ficha).
 *  - publicada: alguma ficha publicada nesta conta, com MLB próprio na publicação;
 *  - em_andamento: ficha não publicada com esta conta de destino (ou continuação aberta);
 *  - disponivel: nenhuma das duas.
 * Só a linha de PUBLICAÇÃO conta como MLB da conta (registro do Bling, pós-publicação ou
 * histórico de MLB trocado/encerrado nunca contam). Devolve [{ conta, nome, estado, mlb, ficha }].
 */
export function situacaoContasDoProduto({ fichas = [], continuacoes = {} } = {}) {
  const lista = (Array.isArray(fichas) ? fichas : []).filter((f) => f && f.status_fluxo !== "cancelado");
  return CONTAS_PUBLICACAO_ML.map(({ id, nome }) => {
    const pub = lista.find((f) => idConta(f.publicacao?.ml_user_id) === id && MLB_OK.test(txt(f.publicacao?.mlb_id).toUpperCase()));
    if (pub) return { conta: id, nome, estado: ESTADO_CONTA_PRODUTO.PUBLICADA, mlb: txt(pub.publicacao.mlb_id).toUpperCase(), ficha: txt(pub.id), publicado_em: txt(pub.publicacao.publicado_em) };
    const naoPublicada = (f) => !MLB_OK.test(txt(f.publicacao?.mlb_id).toUpperCase()) && !["publicado", "publicado_com_pendencia", "publicando"].includes(f.status_fluxo);
    const cont = txt(continuacoes?.[id]?.ficha);
    const andamento = lista.find((f) => naoPublicada(f) && (txt(f.id) === cont || idConta(f.publicacao?.ml_user_id || f.conta_destino_ml_user_id) === id));
    if (andamento) return { conta: id, nome, estado: ESTADO_CONTA_PRODUTO.EM_ANDAMENTO, mlb: "", ficha: txt(andamento.id) };
    return { conta: id, nome, estado: ESTADO_CONTA_PRODUTO.DISPONIVEL, mlb: "", ficha: "" };
  });
}

/** Pode preparar a ficha de OUTRA conta a partir desta ficha? → { ok, motivo, existente } */
export function podePublicarEmOutraConta({ fichaOrigem, conta, quadro = [] }) {
  const id = idConta(conta);
  const nome = nomeContaPublicacao(id);
  if (!CONTAS_PUBLICACAO_ML.some((c) => c.id === id)) return { ok: false, motivo: "Conta fora da lista (LOJA ONLINE, REVELAÇÃO, CIEBR)." };
  const pubOrigem = fichaOrigem?.publicacao || null;
  if (!MLB_OK.test(txt(pubOrigem?.mlb_id).toUpperCase())) return { ok: false, motivo: "Esta ficha ainda não foi publicada: escolha a conta na própria publicação dela." };
  if (idConta(pubOrigem.ml_user_id) === id) return { ok: false, motivo: `Esta ficha já é a publicação em ${nome} (${txt(pubOrigem.mlb_id)}).` };
  const linha = quadro.find((l) => l.conta === id);
  if (linha?.estado === ESTADO_CONTA_PRODUTO.PUBLICADA) return { ok: false, motivo: `Este produto já está publicado em ${nome} (${linha.mlb}): não é duplicado.` };
  if (linha?.estado === ESTADO_CONTA_PRODUTO.EM_ANDAMENTO) return { ok: true, existente: linha.ficha };
  return { ok: true, existente: "" };
}
