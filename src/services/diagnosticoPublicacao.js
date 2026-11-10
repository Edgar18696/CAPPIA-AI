// =============================================================
// (10/11) DIAGNÓSTICO DE PUBLICAÇÃO — TEMPORÁRIO, SOMENTE LEITURA.
// Confere um SKU/MLB pela sessão do PAIIA e pelas integrações que já existem:
//   ficha(s) e publicação na base PAIIA, registro interno do MLB, anúncio no
//   Mercado Livre (GET), busca do SKU na conta (GET), duplicidade (GET) e o
//   produto/vínculo no Bling (consultas de leitura).
// NUNCA grava: as consultas são injetadas e só aceitam leitura (ver LEITURAS_*).
// Não mostra token, chave ou dado de acesso: só os campos do anúncio/ficha.
// =============================================================
import { verificarDuplicidadeML, nomeDaLoja } from "./duplicidadeML.js";
import { lojaBlingDaConta, avaliarPorProduto, normalizarMLB, ACAO_LEITURA, ACAO_BUSCA_MLB, ESTADO, TEXTO_ESTADO } from "./vinculoBlingPublicacao.js";

/** Únicas ações do Bling permitidas aqui (todas de leitura). */
export const LEITURAS_BLING = Object.freeze(["saldo_por_sku", ACAO_LEITURA, ACAO_BUSCA_MLB]);
const txt = (v) => String(v ?? "").trim();
const normSku = (v) => txt(v).toUpperCase().replace(/[^A-Z0-9]/g, "");
const attr = (item, id) => (item?.attributes || []).find((a) => a?.id === id)?.value_name || "";

/**
 * Protege as consultas: Mercado Livre só GET; Bling só as ações de leitura.
 * Qualquer outra coisa é recusada ANTES de sair do aparelho.
 */
export function somenteLeitura({ consultarML, consultarBling }) {
  return {
    ml: async (conta, caminho) => {
      if (!/^\/(items|users)\//.test(String(caminho))) return { ok: false, erro: "consulta não permitida no diagnóstico" };
      return consultarML(conta, caminho);
    },
    bling: async (corpo) => {
      if (!LEITURAS_BLING.includes(corpo?.acao)) return { ok: false, erro: "ação do Bling não permitida no diagnóstico" };
      return consultarBling(corpo);
    },
  };
}

const ponto = (lista, nivel, item, texto) => lista.push({ nivel, item, texto });

/**
 * deps: { listarFichas(sku), lerFicha(id), lerRegistro(sku), consultarML(conta, caminho), consultarBling(corpo) }
 * Devolve { sku, mlb, conta, fichas, registros, ml, buscaSku, duplicidade, bling, pontos }.
 */
export async function diagnosticarPublicacao({ sku, mlb = "" }, deps) {
  const q = somenteLeitura(deps);
  const SKU = txt(sku);
  const pontos = [];
  const out = { sku: SKU, mlb: normalizarMLB(mlb), conta: "", fichas: [], registros: [], ml: null, buscaSku: null, duplicidade: null, bling: null, pontos };

  // 1) Fichas na base PAIIA (com a publicação e os registros gravados).
  const lista = await deps.listarFichas(SKU);
  if (!lista?.ok) ponto(pontos, "erro", "Ficha", `Base PAIIA não lida (${lista?.erro || "erro"}).`);
  for (const a of lista?.anuncios || []) {
    const f = await deps.lerFicha(a.id);
    const an = f?.ok ? f.anuncio : a;
    const dc = an?.dados_conferencia || {};
    const pub = an?.publicacao || (Array.isArray(a.paiia_anuncios_publicacoes) ? a.paiia_anuncios_publicacoes[0] : null) || null;
    out.fichas.push({
      id: txt(an?.id || a.id),
      status_fluxo: txt(an?.status_fluxo || a.status_fluxo),
      conta: txt(an?.conta_destino_ml_user_id || a.conta_destino_ml_user_id),
      conta_nome: txt(an?.conta_destino_nome || a.conta_destino_nome),
      atualizada: txt(an?.updated_at || a.updated_at),
      publicacao: pub ? { mlb: txt(pub.mlb_id), status: txt(pub.status_publicacao), conta: txt(pub.ml_user_id), bling_produto_id: txt(pub.bling_produto_id), status_bling: txt(pub.status_bling), publicado_em: txt(pub.publicado_em), pendencia: txt(pub.erro_publicacao).slice(0, 200) } : null,
      registro_bling: dc.integracao_bling ? { mlb: txt(dc.integracao_bling.mlb), estado: txt(dc.integracao_bling.estado), bling_produto_id: txt(dc.integracao_bling.bling_produto_id), bling_loja_id: txt(dc.integracao_bling.bling_loja_id), verificado_em: txt(dc.integracao_bling.verificado_em), mensagem: txt(dc.integracao_bling.mensagem).slice(0, 200) } : null,
      pos_publicacao: dc.pos_publicacao ? { mlb: txt(dc.pos_publicacao.mlb), concluido: dc.pos_publicacao.concluido === true, ativo: dc.pos_publicacao.ativo?.estado || "", vinculo: dc.pos_publicacao.vinculo?.estado || "", proxima_em: txt(dc.pos_publicacao.proxima_em) } : null,
    });
  }
  const fichasComMLB = out.fichas.filter((f) => [f.publicacao?.mlb, f.registro_bling?.mlb, f.pos_publicacao?.mlb].some((m) => normalizarMLB(m)));
  if (!out.mlb) out.mlb = normalizarMLB(fichasComMLB.map((f) => f.publicacao?.mlb || f.registro_bling?.mlb || f.pos_publicacao?.mlb)[0]);
  if (!out.fichas.length) ponto(pontos, "alerta", "Ficha", `Nenhuma ficha com o SKU ${SKU} na base PAIIA.`);
  else if (out.fichas.length > 1) ponto(pontos, "alerta", "Ficha", `${out.fichas.length} fichas com o SKU ${SKU} (ver lista).`);
  for (const f of out.fichas) {
    const mlbs = [...new Set([f.publicacao?.mlb, f.registro_bling?.mlb, f.pos_publicacao?.mlb].map(normalizarMLB).filter(Boolean))];
    const publicada = Boolean(f.publicacao?.mlb) || ["publicado", "publicado_com_pendencia"].includes(f.status_fluxo);
    if (mlbs.length > 1) ponto(pontos, "erro", "Ficha", `Ficha ${f.id.slice(0, 8)}: MLBs diferentes nos registros (${mlbs.join(", ")}).`);
    if (mlbs.length && !publicada) ponto(pontos, "erro", "Status da ficha", `Ficha ${f.id.slice(0, 8)} tem ${mlbs[0]} gravado, mas o status é "${f.status_fluxo || "—"}" e a publicação ${f.publicacao?.mlb ? "tem" : "NÃO tem"} o MLB.`);
    else if (mlbs.length) ponto(pontos, "ok", "Status da ficha", `Ficha ${f.id.slice(0, 8)}: ${f.status_fluxo}; MLB ${mlbs[0]} gravado na publicação${f.registro_bling?.mlb ? " e no registro do Bling" : ""}.`);
  }

  // 2) Registro interno do MLB.
  const reg = await deps.lerRegistro(SKU);
  out.registros = (reg?.registros || []).map((r) => ({ mlb: txt(r.mlb_id), conta: txt(r.ml_user_id), ficha: txt(r.anuncio_id), bling_produto_id: txt(r.bling_produto_id), situacao: txt(r.situacao), situacao_ml: txt(r.situacao_ml), sku_ml_divergente: r.sku_ml_divergente ?? null, conferido_em: txt(r.conferido_em) }));
  const mlbsRegistro = [...new Set(out.registros.map((r) => normalizarMLB(r.mlb)).filter(Boolean))];
  if (mlbsRegistro.length > 1) ponto(pontos, "alerta", "Registro interno", `O SKU tem ${mlbsRegistro.length} MLBs registrados: ${mlbsRegistro.join(", ")}.`);

  // 3) Conta: a da ficha publicada, a da publicação ou a do registro.
  out.conta = txt(fichasComMLB[0]?.publicacao?.conta || fichasComMLB[0]?.conta || out.fichas[0]?.conta || out.registros.find((r) => normalizarMLB(r.mlb) === out.mlb)?.conta);
  if (!out.mlb) { ponto(pontos, "alerta", "Mercado Livre", "Nenhum MLB gravado para este SKU: nada a consultar no Mercado Livre."); return out; }
  if (!out.conta) { ponto(pontos, "erro", "Mercado Livre", "Conta do Mercado Livre não encontrada na ficha: consulta não feita."); return out; }
  const nomeConta = nomeDaLoja(out.conta);

  // 4) O anúncio no Mercado Livre (GET /items).
  const r = await q.ml(out.conta, `/items/${out.mlb}`);
  if (!r?.ok || !r.dados?.id) ponto(pontos, "erro", "Mercado Livre", `Não consegui ler o ${out.mlb} pela conta ${nomeConta} (${r?.erro || r?.status || "sem resposta"}).`);
  else {
    const it = r.dados;
    out.ml = { id: it.id, vendedor: txt(it.seller_id), conta_nome: nomeDaLoja(it.seller_id), status: txt(it.status), sub_status: it.sub_status || [], sku_atributo: attr(it, "SELLER_SKU"), seller_custom_field: txt(it.seller_custom_field), user_product: txt(it.user_product_id), preco: it.price ?? null, quantidade: it.available_quantity ?? null, vendidos: it.sold_quantity ?? null, condicao: txt(it.condition), tipo: txt(it.listing_type_id), titulo: txt(it.title), criado: txt(it.date_created), atualizado: txt(it.last_updated), link: txt(it.permalink) };
    ponto(pontos, txt(it.seller_id) === out.conta ? "ok" : "erro", "Conta vendedora", `${out.mlb} pertence ao vendedor ${it.seller_id} (${nomeDaLoja(it.seller_id)})${txt(it.seller_id) === out.conta ? ", a mesma conta da ficha" : `, DIFERENTE da conta da ficha (${out.conta})`}.`);
    ponto(pontos, it.status === "active" ? "ok" : "alerta", "Status no ML", `Status: ${it.status}${(it.sub_status || []).length ? ` (${it.sub_status.join(", ")})` : ""}; preço ${it.price}; quantidade ${it.available_quantity}; condição ${it.condition}.`);
    const skus = [out.ml.sku_atributo, out.ml.seller_custom_field].filter(Boolean);
    if (!skus.length) ponto(pontos, "erro", "SKU no ML", "O anúncio não tem SKU gravado (nem atributo SKU, nem seller_custom_field): a busca por SKU no painel não o encontra.");
    else ponto(pontos, skus.some((s) => normSku(s) === normSku(SKU)) ? "ok" : "erro", "SKU no ML", `SKU gravado no anúncio: ${skus.join(" / ")}${skus.some((s) => normSku(s) === normSku(SKU)) ? "" : ` (diferente de ${SKU})`}.`);
  }

  // 5) A busca do SKU na conta (é o que o painel usa) e duplicidade.
  const b = await q.ml(out.conta, `/users/${out.conta}/items/search?seller_sku=${encodeURIComponent(SKU)}`);
  out.buscaSku = b?.ok ? { resultados: Array.isArray(b.dados?.results) ? b.dados.results : [], total: b.dados?.paging?.total ?? null } : { erro: txt(b?.erro || "sem resposta") };
  if (out.buscaSku.erro) ponto(pontos, "alerta", "Busca do SKU", `Busca pelo SKU na conta não respondeu (${out.buscaSku.erro}).`);
  else if (!out.buscaSku.resultados.length) ponto(pontos, "alerta", "Busca do SKU", `A busca do Mercado Livre pelo SKU ${SKU} na conta ${nomeConta} não devolve nenhum anúncio${out.ml ? ", embora o anúncio exista (índice da busca ainda não atualizado ou SKU gravado de outro jeito)" : ""}.`);
  else ponto(pontos, out.buscaSku.resultados.includes(out.mlb) ? "ok" : "alerta", "Busca do SKU", `A busca pelo SKU devolve: ${out.buscaSku.resultados.join(", ")}.`);
  const dup = await verificarDuplicidadeML({ conta: out.conta, codigos: [SKU], consultar: (caminho) => q.ml(out.conta, caminho) });
  out.duplicidade = dup?.erro ? { erro: dup.erro } : { duplicados: dup.duplicados || [], possiveis: dup.possiveis || [] };
  if (dup?.erro) ponto(pontos, "alerta", "Duplicidade", `Não conferida (${dup.erro}).`);
  else {
    const outros = [...(dup.duplicados || []), ...(dup.possiveis || [])].filter((d) => normalizarMLB(d.id) !== out.mlb);
    ponto(pontos, outros.length ? "erro" : "ok", "Duplicidade", outros.length ? `Outros anúncios ativos com este SKU na conta: ${outros.map((d) => `${d.id} (${d.status})`).join(", ")}.` : "Nenhum outro anúncio ativo com este SKU na conta.");
  }

  // 6) Bling: produto pelo SKU e vínculo do MLB com ele (loja da conta).
  const bs = await q.bling({ acao: "saldo_por_sku", sku: SKU });
  const prodId = txt(bs?.produto?.id);
  out.bling = { produto: bs?.encontrado ? { id: prodId, codigo: txt(bs.produto?.codigo), nome: txt(bs.produto?.nome) } : null, ambiguo: Boolean(bs?.ambiguo), erro: bs?.ok === false && !bs?.encontrado ? txt(bs?.erro || bs?.mensagem) : "", vinculo: null };
  if (bs?.ambiguo) ponto(pontos, "erro", "Bling", `Mais de um produto no Bling com o SKU ${SKU}.`);
  else if (!bs?.encontrado) ponto(pontos, bs?.ok ? "alerta" : "erro", "Bling", bs?.ok ? `SKU ${SKU} não encontrado no Bling.` : `Bling não consultado (${out.bling.erro || "erro"}).`);
  else ponto(pontos, "ok", "Bling", `Produto no Bling: ID ${prodId} (SKU ${txt(bs.produto?.codigo)}).`);
  const loja = lojaBlingDaConta(out.conta);
  const produtoEsperado = prodId || txt(fichasComMLB[0]?.registro_bling?.bling_produto_id || fichasComMLB[0]?.publicacao?.bling_produto_id);
  if (!loja) ponto(pontos, "alerta", "Vínculo no Bling", `A conta ${nomeConta} não tem loja Bling mapeada: o vínculo não é conferido automaticamente.`);
  else if (produtoEsperado) {
    const regV = { mlb: out.mlb, bling_loja_id: loja.bling_loja_id, bling_produto_id: produtoEsperado };
    const r1 = await q.bling({ acao: ACAO_LEITURA, id_loja: String(loja.bling_loja_id), id_produto: String(produtoEsperado), esperado: { produto_id: produtoEsperado, loja_id: loja.bling_loja_id, mlb: out.mlb } });
    let v = avaliarPorProduto(regV, r1);
    if (!v) {
      const r2 = await q.bling({ acao: ACAO_BUSCA_MLB, id_loja: String(loja.bling_loja_id), mlb: out.mlb });
      if (!r2?.ok) v = { estado: ESTADO.ERRO_CONSULTA, mensagem: `${TEXTO_ESTADO[ESTADO.ERRO_CONSULTA]}${r2?.erro ? ` (${r2.erro})` : ""}` };
      else if (!r2.encontrado) v = { estado: ESTADO.AGUARDANDO, mensagem: `O ${out.mlb} ainda não aparece na loja ${loja.bling_loja_nome} do Bling.` };
      else v = String(r2.anuncio?.produto_id ?? "") === String(produtoEsperado)
        ? { estado: ESTADO.INTEGRADO, mensagem: TEXTO_ESTADO[ESTADO.INTEGRADO] }
        : { estado: ESTADO.PRODUTO_INCORRETO, mensagem: `${TEXTO_ESTADO[ESTADO.PRODUTO_INCORRETO]} (produto ${r2.anuncio?.produto_id ?? "?"}).` };
    }
    out.bling.vinculo = { loja: loja.bling_loja_nome, produto_esperado: produtoEsperado, estado: v.estado, mensagem: v.mensagem };
    ponto(pontos, v.estado === ESTADO.INTEGRADO ? "ok" : v.estado === ESTADO.AGUARDANDO ? "alerta" : "erro", "Vínculo no Bling", `${String(v.mensagem).replace(/\.\s*$/, "")} (loja ${loja.bling_loja_nome}, produto ${produtoEsperado}).`);
    const gravado = fichasComMLB[0]?.registro_bling?.estado || "";
    if (gravado && gravado !== v.estado) ponto(pontos, "alerta", "Vínculo no Bling", `A ficha registra "${gravado}", mas a leitura agora dá "${v.estado}".`);
  }
  return out;
}

/** Texto para copiar (sem nenhum dado de acesso). */
export function textoDiagnostico(d) {
  const linhas = [`Diagnóstico (somente leitura) — SKU ${d.sku} · ${d.mlb || "sem MLB"} · conta ${d.conta || "—"}`];
  for (const p of d.pontos) linhas.push(`${p.nivel === "ok" ? "✅" : p.nivel === "alerta" ? "⚠" : "❌"} ${p.item}: ${p.texto}`);
  if (d.ml) linhas.push(`ML: ${JSON.stringify(d.ml)}`);
  linhas.push(`Fichas: ${JSON.stringify(d.fichas)}`);
  linhas.push(`Registro interno: ${JSON.stringify(d.registros)}`);
  if (d.buscaSku) linhas.push(`Busca do SKU: ${JSON.stringify(d.buscaSku)}`);
  if (d.duplicidade) linhas.push(`Duplicidade: ${JSON.stringify(d.duplicidade)}`);
  if (d.bling) linhas.push(`Bling: ${JSON.stringify(d.bling)}`);
  return linhas.join("\n");
}
