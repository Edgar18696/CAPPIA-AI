// =============================================================
// PAIIA Voz — ETAPA 2 (02/11/2026): PREPARAÇÃO AUTOMÁTICA DA CONFERÊNCIA.
//   Testes: scripts/testes/paiiaVozPreparo.test.mjs
//
// Usa a ficha montada pelo Voz (Etapa 1) para rodar as MESMAS conferências
// da Conferência/Publicação — categoria, compatibilidade, duplicidade,
// SKU/estoque no Bling e frete × preço — sem cliques no computador.
// Tudo é LEITURA: nada é publicado, nada é criado no Bling, nenhuma
// categoria é confirmada sozinha (a sugestão vira pergunta curta no Voz).
// As consultas reais são injetadas (deps) para os testes rodarem sem rede.
// =============================================================

import { consultarPreditor, lerDetalheCategoria, lerEvidenciaMesmoCodigo, lerRejeicoesDoSKU } from "../../../services/categoriaMLBusca.js";
import { avaliarCategorias, conferirCategoriaParaPublicar, registrarConfirmacao, mesclarRejeicoes } from "../../../services/categoriaML.js";
import { resolverCompatibilidades, compatibilidadeNaoExigivel } from "../../../services/compatibilidadeML.js";
import { verificarDuplicidadeML, avaliarRegistrosBase, situacaoMLBRegistrado, nomeDaLoja } from "../../../services/duplicidadeML.js";
import { conferirEstoque } from "../../../services/estoqueBlingPAIIA.js";
import { parametrosCotacao, prontoParaCotar, cotarNoPreco, reais } from "../../../services/fretePrecificacao.js";

export const VERSAO_PREPARO = "2026-11-02.1";
const txt = (v) => String(v ?? "").trim();
const num = (v) => {
  const t = txt(v);
  if (!t) return NaN;
  return Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
};

/** Entrada das conferências a partir da ficha da conta (paiia_anuncios). */
export function entradaDaFicha(row) {
  const d = row?.dados_conferencia || {};
  const na = d.novo_anuncio || {};
  const voz = d.paiia_voz || {};
  const comp = voz.complemento || {};
  const preco = num(na.preco);
  return {
    fichaId: txt(row?.id),
    codigo: txt(na.codigo || row?.codigo),
    titulo: txt(na.titulo || row?.titulo),
    preco: Number.isFinite(preco) && preco > 0 ? Math.round(preco * 100) / 100 : null,
    tipoAnuncio: txt(na.tipoAnuncio).toLowerCase() === "premium" ? "premium" : "classico",
    tipoVeiculo: txt(na.tipoVeiculo),
    medida: na.medida && typeof na.medida === "object" ? na.medida : null,
    fotos: Array.isArray(na.fotos) ? na.fotos.filter(Boolean) : [],
    marca: txt(comp.marca),
    quantidade: txt(comp.quantidadeEstoque),
    aplicacoes: Array.isArray(voz.aplicacoes) ? voz.aplicacoes : [],
    conta: txt(voz.preparo?.conta),
    categoriaDecisao: voz.preparo?.categoria?.decisao || null,
  };
}

/** Assinatura do que as conferências usaram (mudou → preparo desatualizado). */
export function assinaturaEntrada(e, conta = e?.conta) {
  return JSON.stringify([txt(conta), e.codigo, e.titulo, e.preco, e.tipoAnuncio, e.tipoVeiculo, e.medida, e.fotos.length, e.marca, e.quantidade,
    e.aplicacoes.map((a) => [a.montadora, a.modelo, a.motor, a.anoInicio, a.anoFim])]);
}

const item = (estado, texto, extra = {}) => ({ estado, texto, ...extra }); // estado: ok | pergunta | bloqueio | erro | aguardando

function termosCategoria(e) {
  const principal = e.titulo.split(/\s+/).slice(0, 3).join(" ");
  const ap = e.aplicacoes[0];
  return [e.titulo, principal, ap ? [principal, ap.montadora, ap.modelo].filter(Boolean).join(" ") : ""];
}

async function conferirCategoria(e, deps, conta) {
  if (!e.titulo) return item("pergunta", "Categoria: falta o título da peça.");
  if (!e.tipoVeiculo) return item("pergunta", "Categoria: diga o tipo de veículo (carro ou linha pesada).");
  const lerItem = (mlb, c) => deps.chamarPublicacao({ acao: "ml_consulta", conta_ml: txt(c || conta), metodo: "GET", caminho: `/items/${mlb}` });
  const [consultas, rej, evidencia] = await Promise.all([
    consultarPreditor(termosCategoria(e), deps.lerJson),
    lerRejeicoesDoSKU({ codigo: e.codigo, listarFichas: deps.listarFichas, lerItem }),
    lerEvidenciaMesmoCodigo(e.codigo, (c) => deps.chamarPublicacao({ ...c, conta_ml: txt(conta) })),
  ]);
  const rejeicoes = mesclarRejeicoes(e.categoriaDecisao?.rejeitadas || [], rej.lista).lista;
  const ids = new Set([...consultas.flatMap((q) => q.sugestoes.map((s) => s.category_id)), ...Object.keys(evidencia.porCategoria || {}), ...rejeicoes.map((r) => r.categoria_id), e.categoriaDecisao?.confirmada?.id].filter(Boolean));
  const detalhes = {};
  const cache = {};
  for (const id of [...ids].slice(0, 16)) detalhes[id] = await lerDetalheCategoria(id, deps.lerJson, cache);
  const avaliacao = avaliarCategorias({ tipoVeiculo: e.tipoVeiculo, textoPeca: e.titulo, consultas, detalhes, evidencia, rejeicoes });
  avaliacao.restricoes = rej.restricoes || [];
  const conf = e.categoriaDecisao?.confirmada?.id;
  if (conf) {
    const ok = conferirCategoriaParaPublicar({ categoriaId: conf, decisao: e.categoriaDecisao, rejeicoes, detalhe: detalhes[conf] || null, tipoVeiculo: e.tipoVeiculo, textoPeca: e.titulo });
    if (ok.ok) return item("ok", `Categoria ${conf} — ${detalhes[conf]?.caminho || e.categoriaDecisao.confirmada.caminho} (confirmada por você).`, { id: conf, avaliacao: resumoAvaliacao(avaliacao), decisao: e.categoriaDecisao });
    return item("bloqueio", `Categoria ${conf}: ${ok.motivos.join(" ")}`, { id: conf, avaliacao: resumoAvaliacao(avaliacao), decisao: e.categoriaDecisao });
  }
  if (avaliacao.sugerida) {
    const c = avaliacao.candidatas.find((x) => x.id === avaliacao.sugerida);
    return item("pergunta", `Categoria sugerida pelo Mercado Livre: ${c.id} — ${c.caminho}. Confirma?`, { sugerida: c.id, caminho: c.caminho, avaliacao: resumoAvaliacao(avaliacao) });
  }
  return item("pergunta", `Categoria: o PAIIA não conseguiu uma sugestão segura (${[...avaliacao.conflitos, ...avaliacao.alertas].slice(0, 2).join(" ") || "sem sugestão"}). Escolha no computador.`, { avaliacao: resumoAvaliacao(avaliacao) });
}
// Guarda o necessário para registrar a confirmação depois (sem respostas brutas).
function resumoAvaliacao(a) {
  return {
    versao: a.versao, sugerida: a.sugerida, conflitos: a.conflitos, alertas: a.alertas, restricoes: a.restricoes || [],
    candidatas: (a.candidatas || []).slice(0, 8).map((c) => ({ id: c.id, caminho: c.caminho, dominio: c.dominio, origens: c.origens, compativel: c.compativel, rejeitada: c.rejeitada, rejeicoes: c.rejeicoes || [], evidencia: c.evidencia, bloqueios: c.bloqueios || [] })),
  };
}

/** Confirma (pelo Voz) a categoria sugerida, com o MESMO registro da Conferência. */
export function confirmarCategoriaSugerida(preparo, { agora = new Date().toISOString() } = {}) {
  const cat = preparo?.verificacoes?.categoria;
  const av = cat?.avaliacao;
  const id = cat?.sugerida;
  const candidata = av?.candidatas?.find((c) => c.id === id);
  if (!id || !candidata) return { ok: false, erro: "Não há categoria sugerida para confirmar." };
  const decisao = registrarConfirmacao(preparo?.categoria?.decisao || null, { candidata, avaliacao: av, agora });
  return { ok: true, decisao };
}

async function conferirCompatibilidade(e, deps, conta) {
  if (!e.aplicacoes.length) return item("pergunta", "Compatibilidade: nenhuma aplicação confirmada. Confirme as aplicações ou diga que o anúncio sai sem compatibilidade.");
  const consultar = (caminho, metodo = "GET", corpo) => deps.chamarPublicacao({ acao: "ml_consulta", conta_ml: txt(conta), metodo, caminho, ...(corpo ? { corpo } : {}) });
  let r;
  try { r = await resolverCompatibilidades(e.aplicacoes, consultar); } catch (x) { r = { erro: x?.message || String(x) }; }
  if (r?.erro) return item("erro", `Compatibilidade: catálogo de veículos não consultado (${r.erro}).`);
  const n = r.veiculos.length;
  if (n) return item("ok", `Compatibilidade: ${n} veículo(s) do catálogo confirmam as aplicações aprovadas.`, { veiculos: r.veiculos.map((v) => v.id), semCatalogo: r.semCatalogo.length });
  if (compatibilidadeNaoExigivel(e.tipoVeiculo)) return item("ok", "Compatibilidade: Linha Pesada — o catálogo do Mercado Livre não tem estas aplicações; ficam na ficha e na descrição, sem pendência.", { veiculos: [] });
  return item("pergunta", `Compatibilidade: nenhum veículo do catálogo confirmou as aplicações (${r.semCatalogo.map((s) => s.motivo).slice(0, 2).join("; ")}). Publicar sem compatibilidade?`, { veiculos: [] });
}

async function conferirDuplicidade(e, deps, conta) {
  const base = await deps.conferirDuplicidadeBase({ codigo: e.codigo, sku: e.codigo, contaId: conta });
  if (!base?.ok) return item("erro", `Duplicidade: base PAIIA não conferida (${base?.erro || "erro"}). Publicação bloqueada.`);
  const outros = (base.registros || []).filter((p) => txt(p.anuncio_id) !== e.fichaId);
  const consultar = (caminho) => deps.chamarPublicacao({ acao: "ml_consulta", conta_ml: txt(conta), metodo: "GET", caminho });
  const ml = await verificarDuplicidadeML({ conta, codigos: [e.codigo], consultar });
  if (ml?.erro) return item("erro", `Duplicidade: Mercado Livre não conferido (${ml.erro}). Publicação bloqueada.`);
  // Mesma regra da Publicação: cada MLB registrado é conferido no ML; só excluído/encerrado libera.
  const conferidosBase = [];
  const jaListados = new Set([...ml.duplicados, ...ml.possiveis].map((d) => String(d.id).toUpperCase()));
  for (const p of outros) {
    const mlb = txt(p.mlb_id).toUpperCase();
    if (mlb && jaListados.has(mlb)) continue;
    const resp = /^MLB\d+$/.test(mlb) ? await consultar(`/items/${mlb}`) : null;
    conferidosBase.push({ ...situacaoMLBRegistrado({ mlb, conta, resp }), mlb: mlb || "sem MLB", ficha_origem: p?.anuncio_id || "" });
  }
  const av = avaliarRegistrosBase({ registros: outros, ml: { ...ml, conferidosBase } });
  if (ml.duplicados.length) return item("bloqueio", `Duplicidade: já existe anúncio deste SKU nesta conta (${ml.duplicados.map((d) => `${d.id} ${d.status}`).join(", ")}).`, { duplicados: ml.duplicados.map((d) => d.id) });
  if (av.estado !== "ok") return item("bloqueio", `Duplicidade: ${av.pendentes.map((p) => `${p.mlb}: ${p.motivo}`).join("; ")}.`);
  if (ml.possiveis.length) return item("pergunta", `Duplicidade: possível anúncio parecido nesta conta (${ml.possiveis.map((d) => d.id).join(", ")}). Confira antes de publicar.`, { possiveis: ml.possiveis.map((d) => d.id) });
  return item("ok", `Duplicidade: nenhum anúncio deste SKU na ${nomeDaLoja(conta)} (${ml.buscas} buscas).${av.anteriores.length ? ` ${av.anteriores.map((a) => a.texto).join(" ")}` : ""}`);
}

/**
 * (03/11/2026) Outras grafias do mesmo código para PROCURAR no Bling (só leitura):
 * sem traços/espaços/pontos e com espaços trocados por traço. Nunca muda o SKU.
 */
export function grafiasAlternativasSKU(codigo) {
  const t = txt(codigo).toUpperCase();
  if (!t) return [];
  const semSep = t.replace(/[^A-Z0-9]/g, "");
  const comTraco = t.replace(/\s+/g, "-");
  return [...new Set([semSep, comTraco])].filter((v) => v && v !== t && v !== txt(codigo));
}

async function conferirBling(e, deps) {
  if (!e.codigo) return item("pergunta", "Bling: falta o SKU.");
  let bling;
  try { bling = await deps.lerSaldoBling(e.codigo); } catch { bling = { ok: false }; }
  // Não achou com a grafia da ficha: procura as outras grafias (só leitura) e PERGUNTA.
  if (bling?.encontrado === false) {
    for (const g of grafiasAlternativasSKU(e.codigo)) {
      let alt;
      try { alt = await deps.lerSaldoBling(g); } catch { alt = null; }
      const skuBling = txt(alt?.produto?.codigo) || g;
      if (alt?.encontrado && !alt.ambiguo) {
        return item("pergunta", `Bling: o SKU ${e.codigo} não existe com essa grafia, mas existe como ${skuBling} (produto ${alt.produto?.id || "?"}). Para usar esse produto, corrija o código da ficha para ${skuBling}. Nada é alterado sozinho.${num(e.quantidade) > 0 ? "" : " Falta também o estoque."}`, { encontrado: false, grafiaBling: skuBling, produtoId: alt.produto?.id || null });
      }
    }
  }
  const q = num(e.quantidade);
  if (!(q > 0)) return item("pergunta", "Estoque: diga a quantidade (o PAIIA não assume nenhum valor).", { encontrado: Boolean(bling?.encontrado) });
  const r = conferirEstoque({ quantidade: e.quantidade, confirmada: true, bling });
  if (bling?.encontrado === false) return item("pergunta", `Bling: o SKU ${e.codigo} não existe no Bling. O PAIIA não cria produto sem a sua autorização — crie no Bling ou autorize a criação.`, { encontrado: false });
  return item(r.nivel === "ok" ? "ok" : r.nivel === "aviso" ? "pergunta" : "bloqueio", r.texto, { encontrado: Boolean(bling?.encontrado), produtoId: bling?.produto?.id || null, disponivel: bling?.saldoVirtualTotal ?? null });
}

async function conferirFrete(e, deps, conta, categoriaId) {
  if (!e.preco) return item("pergunta", "Preço: diga o preço de venda.");
  const mods = await deps.modalidadesDaConta(conta);
  const modalidade = mods?.modalidades?.[0]?.tipo || "";
  const params = parametrosCotacao({ conta, medida: e.medida, modalidade, categoria: categoriaId || "", tipoAnuncio: e.tipoAnuncio });
  const falta = prontoParaCotar(params);
  if (falta.length) return item("pergunta", `Frete: falta ${falta.join(", ")}.`);
  const consultar = (caminho) => deps.chamarPublicacao({ acao: "ml_consulta", conta_ml: txt(conta), metodo: "GET", caminho });
  const c = await cotarNoPreco({ params, preco: e.preco, consultar });
  if (!c.ok) return item("erro", `Frete: cotação oficial não obtida (${c.erro}).`);
  return item("ok", `Frete: ${reais(c.custo_vendedor)} por envio (${c.faixa_rotulo}, peso cobrado ${c.peso_cobrado_g} g, ${e.tipoAnuncio === "premium" ? "Premium" : "Clássico"}). Preço ${reais(e.preco)}.`, { custo: c.custo_vendedor, faixa: c.faixa_rotulo, modalidade, cotado_em: c.cotado_em, cotacao: c, params });
}

/**
 * Roda todas as conferências (somente leitura) e devolve o PREPARO para gravar na ficha.
 * deps: { lerJson, chamarPublicacao(corpo), listarFichas(codigo), conferirDuplicidadeBase(args), lerSaldoBling(sku), modalidadesDaConta(conta), agora? }
 */
export async function prepararConferenciaVoz(row, { conta = "", deps } = {}) {
  const e = entradaDaFicha(row);
  const contaId = txt(conta || e.conta).replace(/\D/g, "");
  const v = {};
  v.sku = e.codigo ? item("ok", `SKU: ${e.codigo}.`) : item("pergunta", "SKU: diga o código da peça.");
  v.marca = e.marca ? item("ok", `Marca: ${e.marca}.`) : item("pergunta", "Marca: diga a marca (o PAIIA não presume).");
  v.fotos = e.fotos.length ? item("ok", `Fotos: ${e.fotos.length} na ficha.`) : item("pergunta", "Fotos: tire ao menos uma foto.");
  v.bling = await conferirBling(e, deps);
  if (!contaId) {
    v.conta = item("pergunta", "Conta: em qual conta do Mercado Livre publicar? (REVELAÇÃO, LOJA ONLINE ou CIEBR)");
    for (const k of ["categoria", "compatibilidade", "duplicidade", "frete"]) v[k] = item("aguardando", "Aguardando a escolha da conta.");
  } else {
    v.conta = item("ok", `Conta: ${nomeDaLoja(contaId)} (${contaId}).`);
    v.categoria = await conferirCategoria(e, deps, contaId);
    v.compatibilidade = await conferirCompatibilidade(e, deps, contaId);
    v.duplicidade = await conferirDuplicidade(e, deps, contaId);
    v.frete = await conferirFrete(e, deps, contaId, v.categoria.estado === "ok" ? v.categoria.id : v.categoria.sugerida);
  }
  const perguntas = Object.entries(v).filter(([, x]) => x.estado === "pergunta").map(([k, x]) => ({ id: k, texto: x.texto }));
  const bloqueios = Object.entries(v).filter(([, x]) => x.estado === "bloqueio" || x.estado === "erro").map(([k, x]) => ({ id: k, texto: x.texto }));
  const agora = typeof deps?.agora === "function" ? deps.agora() : new Date().toISOString();
  return {
    versao: VERSAO_PREPARO,
    em: agora,
    conta: contaId,
    assinatura: assinaturaEntrada(e, contaId),
    verificacoes: v,
    perguntas,
    bloqueios,
    pronto: perguntas.length === 0 && bloqueios.length === 0 && Object.values(v).every((x) => x.estado === "ok"),
    categoria: { decisao: e.categoriaDecisao },
  };
}

/** O preparo gravado ainda vale para a ficha atual? */
export function preparoAtual(row) {
  const p = row?.dados_conferencia?.paiia_voz?.preparo;
  if (!p?.assinatura) return { valido: false, preparo: p || null, motivo: "ainda não preparado" };
  const e = entradaDaFicha(row);
  return p.assinatura === assinaturaEntrada(e, p.conta) ? { valido: true, preparo: p } : { valido: false, preparo: p, motivo: "a ficha mudou depois da última conferência" };
}
