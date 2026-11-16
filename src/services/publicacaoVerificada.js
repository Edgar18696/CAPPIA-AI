// =============================================================
// PAIIA — PUBLICAÇÃO VERIFICADA no Mercado Livre (16/11/2026).
//
// Três peças puras (tudo chega por injeção; os testes usam respostas
// simuladas do ML e do Bling — nada sai da máquina):
//
// 1) checarAntesDePublicar: NA HORA do toque em Publicar confere
//    SKU, CONTA, MLB e VÍNCULO NO BLING. Qualquer leitura que falhar
//    BLOQUEIA (nada é enviado sem certeza).
// 2) publicarVerificado: checagem → marca "envio em andamento" na ficha
//    → UM envio → grava o MLB (com novas tentativas só da GRAVAÇÃO).
//    O envio NUNCA é repetido aqui. Resposta perdida = "incerto": a marca
//    fica na ficha e a próxima tentativa passa pela retomada.
// 3) retomarPublicacao: ficha com MLB → só conclui (nada publicado de
//    novo); envio incerto → procura no ML o anúncio deste SKU criado
//    depois da marca: 1 achado = adota (grava o MLB), 0 = libera nova
//    tentativa, 2+ = você confere. Falha de leitura = aguarda.
//
// Somente leitura no ML e no Bling. As únicas gravações são na ficha do
// PAIIA (marca do envio e MLB), por funções injetadas.
// =============================================================
import { CONTAS_PUBLICACAO_ML, nomeContaPublicacao } from "./contasPublicacaoML.js";
import { mlbRegistradoDaFicha } from "./pilotoPublicacao.js";
import { blingIdDaPublicacao } from "./blingRegistrado.js";
import { lojaBlingDaConta, normalizarMLB } from "./vinculoBlingPublicacao.js";
import { normalizarCodigoComparacao, skusDoAnuncio } from "./duplicidadeML.js";

/** Chave da marca de envio em dados_conferencia (fica até o MLB ser gravado ou o ML confirmar que nada foi criado). */
export const CHAVE_ENVIO = "envio_publicacao";

const txt = (v) => String(v ?? "").trim();
const idConta = (v) => txt(v).replace(/\D/g, "");
const norm = (v) => normalizarCodigoComparacao(v);

async function seguro(fn) {
  try {
    const r = await fn();
    return r ?? { ok: false, erro: "sem resposta" };
  } catch (e) {
    return { ok: false, erro: txt(e?.message || e) || "falha inesperada" };
  }
}

/** Marca de envio gravada na ficha (ou null). */
export function envioPendenteDaFicha(ficha) {
  const e = ficha?.dados_conferencia?.[CHAVE_ENVIO];
  return e && typeof e === "object" && e.iniciado_em ? e : null;
}

/**
 * Confere SKU, conta, MLB e vínculo no Bling ANTES do envio.
 *
 * entrada: { anuncioId, contaId, sku, usoBling: "usar" | "sem", automatico }
 *   automatico = publicação automática (regra 08/11): outros anúncios do
 *   mesmo SKU viram AVISO; falhas de leitura continuam bloqueando.
 *   conferirDuplicidade = false: não consulta duplicidade (a publicação
 *   automática não faz essa leitura antes do envio — regra 13/11).
 * deps (somente leitura):
 *   obterFicha(anuncioId) → { ok, anuncio }
 *   contaConectada(contaId) → boolean
 *   duplicidadeBase({ codigo, sku, contaId }) → { ok, registros }
 *   duplicidadeML({ conta, sku }) → { verificado, duplicados, possiveis } | { erro }
 *   lerBling(sku) → { ok, encontrado, ambiguo, produto: { id, codigo } }
 *   anunciosBling({ id_loja, id_produto }) → { ok, id_loja, anuncios: [{ mlb, produto_id }] }
 */
export async function checarAntesDePublicar({ anuncioId, contaId, sku, usoBling = "usar", automatico = false, conferirDuplicidade = true, deps = {} }) {
  const itens = [];
  const add = (item, nivel, texto) => itens.push({ item, nivel, texto });
  const conta = idConta(contaId);
  const skuEnvio = txt(sku);
  const r = { itens, conta, sku: skuEnvio, mlbDaFicha: "", envioPendente: null, blingProdutoId: "" };

  // Ficha persistida: fonte de verdade para conta, SKU e MLB.
  const lida = anuncioId ? await seguro(() => deps.obterFicha(anuncioId)) : { ok: false, erro: "ficha sem ID" };
  const ficha = lida?.ok ? lida.anuncio : null;
  if (!ficha) {
    add("Ficha", "erro", `Não foi possível reler a ficha na base PAIIA (${txt(lida?.erro) || "sem resposta"}).`);
    return fechar(r);
  }
  const dc = ficha.dados_conferencia || {};

  // ---- MLB: esta ficha já publicou? envio anterior sem resposta?
  r.mlbDaFicha = mlbRegistradoDaFicha(ficha);
  r.envioPendente = envioPendenteDaFicha(ficha);
  if (r.mlbDaFicha) add("MLB", "erro", `Esta ficha já está publicada (${r.mlbDaFicha}). Nada é publicado de novo: só a retomada das conferências.`);
  else if (r.envioPendente) add("MLB", "erro", `Um envio anterior desta ficha ficou sem resposta (${r.envioPendente.iniciado_em}). Antes de publicar de novo, a retomada confere no Mercado Livre se o anúncio foi criado.`);

  // ---- SKU
  const skuNorm = norm(skuEnvio);
  if (!skuNorm) add("SKU", "erro", "Sem SKU no envio: nada é publicado sem SKU.");
  else {
    const skuPub = txt(ficha.publicacao?.sku);
    const conhecidos = [dc.anuncio?.sku, dc.anuncio?.codigo, dc.ficha?.anuncioConferido?.sku, dc.ficha?.anuncioConferido?.codigo, ficha.codigo].map(norm).filter(Boolean);
    if (skuPub && norm(skuPub) !== skuNorm) add("SKU", "erro", `O SKU gravado na publicação desta ficha (${skuPub}) é diferente do SKU do envio (${skuEnvio}).`);
    else if (conhecidos.length && !conhecidos.includes(skuNorm)) add("SKU", "erro", `O SKU do envio (${skuEnvio}) não é o código nem o SKU desta ficha (${[...new Set(conhecidos)].join(", ")}).`);
    else add("SKU", "ok", `SKU ${skuEnvio} confere com a ficha.`);
  }

  // ---- Conta
  const contaFicha = idConta(ficha.conta_destino_ml_user_id);
  const plano = dc.contas_publicacao && !dc.contas_publicacao.pendente ? dc.contas_publicacao : null;
  const contaPub = idConta(ficha.publicacao?.ml_user_id);
  if (!CONTAS_PUBLICACAO_ML.some((c) => c.id === conta)) add("Conta", "erro", `Conta ${conta || "(vazia)"} fora das contas da publicação (LOJA ONLINE, CIEBR, REVELAÇÃO).`);
  else if (!contaFicha) add("Conta", "erro", "A conta de destino não está gravada na ficha.");
  else if (contaFicha !== conta) add("Conta", "erro", `A ficha está gravada para ${nomeContaPublicacao(contaFicha)}, mas o envio iria para ${nomeContaPublicacao(conta)}.`);
  else if (plano && idConta(plano.conta_desta_ficha) && idConta(plano.conta_desta_ficha) !== conta) add("Conta", "erro", `As contas confirmadas reservam esta ficha para ${nomeContaPublicacao(plano.conta_desta_ficha)}, não para ${nomeContaPublicacao(conta)}.`);
  else if (contaPub && contaPub !== conta) add("Conta", "erro", `A publicação desta ficha está registrada em ${nomeContaPublicacao(contaPub)}.`);
  else if (!(await seguro(async () => ({ ok: Boolean(await deps.contaConectada(conta)) }))).ok) add("Conta", "erro", `${nomeContaPublicacao(conta)} não está conectada ao PAIIA.`);
  else add("Conta", "ok", `${nomeContaPublicacao(conta)} (ID ${conta}) confere com a ficha e está conectada.`);
  const contaOk = !itens.some((i) => i.item === "Conta" && i.nivel === "erro");

  // ---- Duplicidade do SKU nesta conta (base PAIIA + Mercado Livre)
  const outros = automatico ? "aviso" : "erro";
  let ativosML = [];
  if (!conferirDuplicidade) add("Duplicidade", "aviso", "Publicação automática: outros anúncios do SKU são conferidos depois; a repetição da mesma autorização é barrada no servidor.");
  else if (skuNorm && contaOk) {
    const base = await seguro(() => deps.duplicidadeBase({ codigo: ficha.codigo || skuEnvio, sku: skuEnvio, contaId: conta }));
    if (!base?.ok) add("Duplicidade", "erro", `Base PAIIA não conferida (${txt(base?.erro) || "sem resposta"}).`);
    else {
      const daFicha = (base.registros || []).filter((x) => txt(x.anuncio_id) !== txt(anuncioId));
      if (daFicha.length) add("Duplicidade", outros, `A base PAIIA já registra este SKU nesta conta: ${daFicha.map((x) => x.mlb_id || x.id).join(", ")}.`);
    }
    const ml = await seguro(() => deps.duplicidadeML({ conta, sku: skuEnvio }));
    if (ml?.erro || !ml?.verificado) add("Duplicidade", "erro", `Mercado Livre não conferido (${txt(ml?.erro) || "sem resposta"}).`);
    else {
      ativosML = (ml.duplicados || []).map((d) => normalizarMLB(d.id)).filter(Boolean);
      if (ativosML.length) add("Duplicidade", outros, `Já existe anúncio deste SKU nesta conta: ${ativosML.join(", ")}.`);
      else if ((ml.possiveis || []).length) add("Duplicidade", "aviso", `Possível duplicidade (mesmo código, SKU diferente): ${ml.possiveis.map((d) => d.id).join(", ")}.`);
      else add("Duplicidade", "ok", "Nenhum anúncio ativo deste SKU nesta conta.");
    }
  }

  // ---- Bling: produto do SKU e vínculo na loja desta conta
  if (usoBling === "sem") add("Bling", "aviso", "Publicação sem Bling (escolhida na ficha): produto e vínculo não conferidos.");
  else if (skuNorm) {
    const b = await seguro(() => deps.lerBling(skuEnvio));
    const registrado = txt(blingIdDaPublicacao(ficha.publicacao) || dc.integracao_bling?.bling_produto_id);
    if (!b?.ok) add("Bling", "erro", `O Bling não respondeu à consulta do SKU (${txt(b?.erro || b?.mensagem) || "sem resposta"}). Nada foi criado nem alterado no Bling.`);
    else if (b.ambiguo) add("Bling", "erro", "Mais de um produto no Bling com este SKU: resolva no Bling antes de publicar.");
    else if (!b.encontrado || !txt(b.produto?.id)) add("Bling", "erro", `O SKU ${skuEnvio} não está cadastrado no Bling: cadastre (ou escolha publicar sem Bling) antes.`);
    else if (txt(b.produto?.codigo) && txt(b.produto.codigo) !== skuEnvio) add("Bling", "erro", `O código do produto no Bling (${b.produto.codigo}) não é exatamente o SKU do envio (${skuEnvio}).`);
    else if (registrado && registrado !== txt(b.produto.id)) add("Bling", "erro", `A ficha registra o produto Bling ${registrado}, mas o SKU aponta o produto ${b.produto.id}.`);
    else {
      r.blingProdutoId = txt(b.produto.id);
      add("Bling", "ok", `Produto Bling ${r.blingProdutoId} (código ${txt(b.produto.codigo) || skuEnvio}).`);
      const loja = contaOk ? lojaBlingDaConta(conta) : null;
      if (!loja) add("Vínculo Bling", "aviso", `${nomeContaPublicacao(conta)} não tem loja Bling ligada ao PAIIA: o vínculo é conferido depois, na Gestão de Anúncios do Bling.`);
      else {
        const v = await seguro(() => deps.anunciosBling({ id_loja: loja.bling_loja_id, id_produto: r.blingProdutoId }));
        if (!v?.ok) add("Vínculo Bling", "erro", `Vínculo do produto na loja ${loja.bling_loja_nome} não conferido (${txt(v?.erro) || "sem resposta"}).`);
        else if (txt(v.id_loja) && txt(v.id_loja) !== loja.bling_loja_id) add("Vínculo Bling", "erro", "O Bling respondeu sobre outra loja: vínculo não conferido.");
        else {
          const ligados = [...new Set((v.anuncios || []).filter((a) => txt(a.produto_id) === r.blingProdutoId).map((a) => normalizarMLB(a.mlb)).filter(Boolean))];
          const ativos = ligados.filter((m) => ativosML.includes(m));
          if (ativos.length) add("Vínculo Bling", outros, `O produto Bling já está vinculado a anúncio ATIVO desta conta: ${ativos.join(", ")}.`);
          else if (ligados.length) add("Vínculo Bling", "aviso", `Vínculos antigos (não ativos no ML) ficam como histórico: ${ligados.join(", ")}.`);
          else add("Vínculo Bling", "ok", `Nenhum anúncio desta conta vinculado ao produto na loja ${loja.bling_loja_nome}.`);
        }
      }
    }
  }
  return fechar(r);
}

function fechar(r) {
  r.bloqueios = r.itens.filter((i) => i.nivel === "erro").map((i) => `${i.item}: ${i.texto}`);
  r.avisos = r.itens.filter((i) => i.nivel === "aviso").map((i) => `${i.item}: ${i.texto}`);
  r.ok = r.bloqueios.length === 0;
  return r;
}

/** Resposta do servidor sem certeza sobre a criação (tempo esgotado, rede, 5xx). */
export function respostaIncerta(resp) {
  if (!resp || resp.incerto) return true;
  if (resp.ok && resp.publicado) return !normalizarMLB(resp.item_id);
  const t = `${resp.codigo || ""} ${resp.erro || ""} ${resp.status || ""}`;
  return /timeout|tempo esgotado|timed? ?out|ECONN|network|rede|fetch|5\d\d|gateway|sem resposta|Failed to send|falar com o servidor|resposta vazia|indispon/i.test(t);
}

/**
 * Checagem → marca de envio → UM envio → gravação do MLB.
 * deps: checar() → resultado de checarAntesDePublicar
 *       marcarEnvio(marca) → { ok }        (grava dados_conferencia.envio_publicacao)
 *       enviar() → resposta da função mercadolivre-publicacao (acao "publicar")
 *       gravarMLB({ mlb, link }) → { ok, erro }
 *       limparEnvio() → { ok }
 */
export async function publicarVerificado({ conta, sku, autorizacaoId = "", deps, tentativasGravacao = 3, agora = () => new Date().toISOString() }) {
  const chk = await deps.checar();
  if (!chk?.ok) return { ok: false, fase: "checagem", enviado: false, bloqueios: chk?.bloqueios || ["checagem sem resposta"], checagem: chk };

  const marca = { conta: idConta(conta), sku: txt(sku), iniciado_em: agora(), ...(autorizacaoId ? { autorizacao_id: autorizacaoId } : {}) };
  const m = await seguro(() => deps.marcarEnvio(marca));
  if (!m?.ok) return { ok: false, fase: "marca", enviado: false, erro: `A ficha não registrou o início do envio (${txt(m?.erro) || "sem resposta"}). Nada foi enviado ao Mercado Livre.` };

  let resp;
  try {
    resp = await deps.enviar();
  } catch (e) {
    resp = { ok: false, erro: txt(e?.message || e) || "sem resposta", codigo: "sem_resposta" };
  }
  if (respostaIncerta(resp)) {
    return { ok: false, fase: "envio", enviado: "incerto", marca, resposta: resp, erro: `Sem resposta clara do Mercado Livre (${txt(resp?.erro) || "sem resposta"}). Nada será reenviado: a retomada confere na conta se o anúncio foi criado.` };
  }
  if (!(resp.ok && resp.publicado)) {
    // O ML recusou: nada foi criado. A marca sai para permitir corrigir e tentar de novo.
    await seguro(() => deps.limparEnvio());
    return { ok: false, fase: "ml", enviado: false, resposta: resp, erro: txt(resp.erro) || "O Mercado Livre não publicou." };
  }

  const mlb = normalizarMLB(resp.item_id);
  let g = null;
  for (let i = 0; i < Math.max(1, tentativasGravacao); i += 1) {
    g = await seguro(() => deps.gravarMLB({ mlb, link: resp.link || "" }));
    if (g?.ok) break;
  }
  if (!g?.ok) {
    // MLB criado, gravação falhou: a marca FICA (a retomada adota este MLB sem publicar de novo).
    return { ok: true, fase: "gravacao", mlb, link: resp.link || "", gravado: false, resposta: resp, pendencia: `Anúncio ${mlb} criado, mas não ficou gravado na ficha (${txt(g?.erro) || "sem resposta"}). A retomada grava sem publicar de novo.` };
  }
  await seguro(() => deps.limparEnvio());
  return { ok: true, fase: "concluido", mlb, link: resp.link || "", gravado: true, resposta: resp };
}

/**
 * Anúncios desta conta com este SKU criados a partir de `desde`
 * (margem de 2 min para relógios diferentes). consultar = ml_consulta GET.
 */
export async function criadosDesde({ conta, sku, desde, consultar, margemMs = 120_000 }) {
  const c = idConta(conta);
  const s = norm(sku);
  if (!c || !s) return { ok: false, erro: "conta ou SKU ausente" };
  const busca = await seguro(() => consultar(`/users/${c}/items/search?seller_sku=${encodeURIComponent(txt(sku))}`));
  if (!busca?.ok) return { ok: false, erro: txt(busca?.erro) || "busca indisponível" };
  const limite = Date.parse(desde || "") - margemMs;
  const achados = [];
  for (const id of Array.isArray(busca.dados?.results) ? busca.dados.results : []) {
    const it = await seguro(() => consultar(`/items/${id}`));
    if (!it?.ok || !it.dados?.id) return { ok: false, erro: txt(it?.erro) || `não foi possível abrir ${id}` };
    const d = it.dados;
    if (idConta(d.seller_id) !== c) continue;
    if (!skusDoAnuncio(d).some((x) => norm(x) === s)) continue;
    const criado = Date.parse(d.date_created || "");
    if (Number.isFinite(limite) && Number.isFinite(criado) && criado < limite) continue;
    achados.push({ id: normalizarMLB(d.id), status: d.status, link: d.permalink || "", criado_em: d.date_created || "" });
  }
  return { ok: true, achados };
}

/**
 * Retomada (F5, "Tentar de novo", Central). Nunca publica.
 * deps: obterFicha(anuncioId), consultar(conta) → (caminho) → ml_consulta GET COM O TOKEN da conta do envio,
 *       gravarMLB({ mlb, link }), limparEnvio()
 * → { acao: "concluir" | "adotado" | "liberado" | "conferir" | "aguardar" | "publicar", ... }
 */
export async function retomarPublicacao({ anuncioId, deps }) {
  const lida = await seguro(() => deps.obterFicha(anuncioId));
  if (!lida?.ok) return { acao: "aguardar", texto: `Ficha não relida (${txt(lida?.erro) || "sem resposta"}). Nada foi enviado.` };
  const ficha = lida.anuncio;
  const mlbJa = mlbRegistradoDaFicha(ficha);
  const envio = envioPendenteDaFicha(ficha);
  if (mlbJa) {
    if (envio) await seguro(() => deps.limparEnvio());
    return { acao: "concluir", mlb: mlbJa, texto: `Ficha já publicada (${mlbJa}): seguem só as conferências.` };
  }
  if (!envio) return { acao: "publicar", texto: "Nenhum envio pendente: a publicação segue pela checagem normal." };
  const r = await criadosDesde({ conta: envio.conta, sku: envio.sku, desde: envio.iniciado_em, consultar: deps.consultar(envio.conta) });
  if (!r.ok) return { acao: "aguardar", texto: `Não deu para conferir no Mercado Livre se o envio criou o anúncio (${r.erro}). Nada foi reenviado.` };
  if (r.achados.length > 1) return { acao: "conferir", mlbs: r.achados.map((a) => a.id), texto: `Mais de um anúncio deste SKU criado depois do envio (${r.achados.map((a) => a.id).join(", ")}): confira na conta antes de qualquer passo.` };
  if (r.achados.length === 1) {
    const a = r.achados[0];
    const g = await seguro(() => deps.gravarMLB({ mlb: a.id, link: a.link }));
    if (!g?.ok) return { acao: "aguardar", mlb: a.id, texto: `O anúncio ${a.id} foi criado, mas a ficha não gravou (${txt(g?.erro) || "sem resposta"}). Tente a retomada de novo; nada é publicado.` };
    await seguro(() => deps.limparEnvio());
    return { acao: "adotado", mlb: a.id, link: a.link, texto: `O envio anterior criou ${a.id}: gravado na ficha, nada foi publicado de novo.` };
  }
  const l = await seguro(() => deps.limparEnvio());
  if (!l?.ok) return { acao: "aguardar", texto: `O Mercado Livre não tem anúncio deste envio, mas a ficha não liberou (${txt(l?.erro) || "sem resposta"}).` };
  return { acao: "liberado", texto: "O Mercado Livre confirmou que o envio anterior não criou anúncio: pode publicar de novo (com nova checagem)." };
}
