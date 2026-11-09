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
import { avaliarCategorias, conferirCategoriaParaPublicar, registrarConfirmacao, mesclarRejeicoes, ORIGEM_CATEGORIA } from "../../../services/categoriaML.js";
import { preferenciaDaPeca, preferenciaDoTermo, resolverCategoriaPreferida, atributosFixosDaPreferencia, caminhoDaPreferencia } from "../../../services/categoriaPreferidaML.js";
import { resolverCompatibilidades, compatibilidadeNaoExigivel } from "../../../services/compatibilidadeML.js";
import { montarAtributosCategoria } from "../../../services/atributosCategoriaML.js";
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

// (09/11) Categoria preferida da peça (regra permanente: relés) — ID SEMPRE da API do ML.
async function categoriaPreferida(pref, deps, cache) {
  if (!pref) return null;
  try {
    return await resolverCategoriaPreferida(pref, { consultar: (t) => consultarPreditor(t, deps.lerJson), lerDetalhe: (id) => lerDetalheCategoria(id, deps.lerJson, cache), storage: deps.storage });
  } catch (x) {
    return { ok: false, motivo: `Categoria preferida não consultada (${x?.message || x}).` };
  }
}

/**
 * (09/11) Atributos obrigatórios da categoria para a tela do Voz (Modelo, Tipo de produto…).
 * Marca, Número da peça e Tipo de veículo vêm dos campos da ficha (não aparecem aqui).
 * exigir: categoria fora de “Acessórios para Veículos” — a etapa só fica feita com tudo preenchido.
 */
export function atributosDaCategoria(det, e, salvos) {
  if (!det?.lido) return null;
  const r = montarAtributosCategoria({ categoriaId: det.id, atributosBrutos: det.atributosBrutos, ficha: { marca: e.marca, numeroPeca: e.codigo, tipoVeiculo: e.tipoVeiculo, textos: [e.titulo] }, salvos });
  if (!r.lido) return null;
  const pendentes = r.pendentes.filter((p) => !p.campoProprio).map((p) => ({ id: p.id, nome: p.nome, tipo: p.tipo, valores: (p.valores || []).slice(0, 80), duvida: p.duvida || "" }));
  return {
    categoria_id: det.id,
    completo: pendentes.length === 0,
    exigir: (det.niveis || [])[0] !== "Acessórios para Veículos",
    pendentes,
    preenchidos: r.itens.filter((i) => !i.pendente && !i.campoProprio).map((i) => ({ id: i.id, nome: i.nome, valor: i.valor, origem: i.origem })),
  };
}

/** (09/11) Categoria confirmada = a preferida da peça → grava os valores fixos (ex.: Tipo de produto “Relé”) que faltarem. */
export function comAtributosFixos(decisao, det, titulo) {
  const id = txt(decisao?.confirmada?.id).toUpperCase();
  const pref = preferenciaDaPeca(titulo);
  if (!id || !pref || !det?.lido || !caminhoDaPreferencia(det.niveis, pref)) return decisao;
  const fixos = atributosFixosDaPreferencia(pref, { categoriaId: id, atributosBrutos: det.atributosBrutos });
  if (!fixos) return decisao;
  const antes = decisao.atributos && txt(decisao.atributos.categoria_id).toUpperCase() === id ? decisao.atributos.valores || {} : {};
  if (Object.keys(fixos.valores).every((k) => antes[k])) return decisao;
  return { ...decisao, preferencia: decisao.preferencia || pref.id, atributos: { categoria_id: id, valores: { ...fixos.valores, ...antes } } };
}

async function conferirCategoria(e, deps, conta) {
  if (!e.titulo) return item("pergunta", "Categoria: falta o título da peça.");
  if (!e.tipoVeiculo) return item("pergunta", "Categoria: diga o tipo de veículo (carro ou linha pesada).");
  const lerItem = (mlb, c) => deps.chamarPublicacao({ acao: "ml_consulta", conta_ml: txt(c || conta), metodo: "GET", caminho: `/items/${mlb}` });
  const conf = e.categoriaDecisao?.confirmada?.id;
  const cache = {};
  // Regra permanente (relés): só quando NÃO há categoria confirmada (nunca troca a sua escolha).
  const pref = conf ? null : preferenciaDaPeca(e.titulo);
  const [consultas, rej, evidencia, prefRes] = await Promise.all([
    consultarPreditor(termosCategoria(e), deps.lerJson),
    lerRejeicoesDoSKU({ codigo: e.codigo, listarFichas: deps.listarFichas, lerItem }),
    lerEvidenciaMesmoCodigo(e.codigo, (c) => deps.chamarPublicacao({ ...c, conta_ml: txt(conta) })),
    categoriaPreferida(pref, deps, cache),
  ]);
  const rejeicoes = mesclarRejeicoes(e.categoriaDecisao?.rejeitadas || [], rej.lista).lista;
  const ids = new Set([prefRes?.id, e.categoriaDecisao?.confirmada?.id, ...consultas.flatMap((q) => q.sugestoes.map((s) => s.category_id)), ...Object.keys(evidencia.porCategoria || {}), ...rejeicoes.map((r) => r.categoria_id)].filter(Boolean));
  const detalhes = {};
  for (const id of [...ids].slice(0, 16)) detalhes[id] = await lerDetalheCategoria(id, deps.lerJson, cache);
  const avaliacao = avaliarCategorias({
    tipoVeiculo: e.tipoVeiculo, textoPeca: e.titulo, textoProduto: e.titulo, consultas, detalhes, evidencia, rejeicoes,
    herdadas: prefRes?.id ? [{ id: prefRes.id, origem: ORIGEM_CATEGORIA.PREFERENCIA }] : [],
    preferencia: prefRes?.ok ? { id: prefRes.id, rotulo: pref.rotulo } : null,
  });
  avaliacao.restricoes = rej.restricoes || [];
  if (pref && prefRes && !prefRes.ok) avaliacao.alertas.push(prefRes.motivo);
  if (conf) {
    const ok = conferirCategoriaParaPublicar({ categoriaId: conf, decisao: e.categoriaDecisao, rejeicoes, detalhe: detalhes[conf] || null, tipoVeiculo: e.tipoVeiculo, textoPeca: e.titulo });
    const caminho = detalhes[conf]?.caminho || e.categoriaDecisao.confirmada.caminho;
    const automatica = Boolean(e.categoriaDecisao?.automatica);
    const decisao = comAtributosFixos(e.categoriaDecisao, detalhes[conf], e.titulo);
    if (ok.ok) return item("ok", `Categoria ${conf} — ${caminho} (${automatica ? "selecionada automaticamente" : "confirmada por você"}).`, { id: conf, caminho, automatica, preferencia: decisao?.preferencia || "", avaliacao: resumoAvaliacao(avaliacao), decisao, atributos: atributosDaCategoria(detalhes[conf], e, decisao?.atributos) });
    return item("bloqueio", `Categoria ${conf}: ${ok.motivos.join(" ")}`, { id: conf, caminho, avaliacao: resumoAvaliacao(avaliacao), decisao: e.categoriaDecisao });
  }
  // (09/11) Regra permanente: categoria preferida válida → já SELECIONADA (você pode trocar).
  if (pref && avaliacao.preferida && avaliacao.preferida === avaliacao.sugerida) {
    const c = avaliacao.candidatas.find((x) => x.id === avaliacao.preferida);
    const det = detalhes[c.id];
    if (det?.lido && det.listingAllowed !== false) {
      const base = registrarConfirmacao(e.categoriaDecisao || null, { candidata: c, avaliacao, agora: new Date().toISOString() });
      const fixos = atributosFixosDaPreferencia(pref, { categoriaId: c.id, atributosBrutos: det.atributosBrutos });
      const antes = base.atributos && txt(base.atributos.categoria_id).toUpperCase() === c.id ? base.atributos.valores || {} : {};
      const dec = { ...base, automatica: true, preferencia: pref.id, atributos: fixos ? { categoria_id: c.id, valores: { ...fixos.valores, ...antes } } : base.atributos };
      const ok = conferirCategoriaParaPublicar({ categoriaId: c.id, decisao: dec, rejeicoes, detalhe: det, tipoVeiculo: e.tipoVeiculo, textoPeca: e.titulo });
      if (ok.ok) return item("ok", `Categoria ${c.id} — ${c.caminho} (regra permanente do PAIIA: ${pref.rotulo}; ID conferido agora na API do Mercado Livre).`, { id: c.id, caminho: c.caminho, automatica: true, preferencia: pref.id, avaliacao: resumoAvaliacao(avaliacao), decisao: dec, atributos: atributosDaCategoria(det, e, dec.atributos) });
    }
  }
  if (avaliacao.sugerida) {
    const c = avaliacao.candidatas.find((x) => x.id === avaliacao.sugerida);
    // (Etapa 2) Seleção AUTOMÁTICA só sem nenhuma dúvida: UMA única categoria válida (compatível e
    // não rejeitada), sem conflitos, aprovada pela mesma regra de publicação (ramo/tipo/rejeições)
    // e com TODOS os atributos obrigatórios já preenchidos pela ficha. Senão: pergunta (nada presumido).
    const validas = (avaliacao.candidatas || []).filter((x) => x.compativel && !x.rejeitada);
    const det = detalhes[c?.id] || null;
    if (c && validas.length === 1 && validas[0].id === c.id && !(avaliacao.conflitos || []).length && det?.lido && det.listingAllowed !== false) {
      const atr = montarAtributosCategoria({ categoriaId: c.id, atributosBrutos: det.atributosBrutos, ficha: { marca: e.marca, numeroPeca: e.codigo, tipoVeiculo: e.tipoVeiculo, textos: [e.titulo] } });
      const dec = { ...registrarConfirmacao(e.categoriaDecisao || null, { candidata: c, avaliacao, agora: new Date().toISOString() }), automatica: true };
      const ok = conferirCategoriaParaPublicar({ categoriaId: c.id, decisao: dec, rejeicoes, detalhe: det, tipoVeiculo: e.tipoVeiculo, textoPeca: e.titulo });
      if (atr.lido && atr.completo && ok.ok) return item("ok", `Categoria ${c.id} — ${c.caminho} (selecionada automaticamente: única categoria válida, atributos obrigatórios conferidos).`, { id: c.id, caminho: c.caminho, automatica: true, avaliacao: resumoAvaliacao(avaliacao), decisao: dec });
    }
    return item("pergunta", `Categoria sugerida pelo Mercado Livre: ${c.id} — ${c.caminho}. Confirma?`, { sugerida: c.id, caminho: c.caminho, avaliacao: resumoAvaliacao(avaliacao) });
  }
  return item("pergunta", `Categoria: o PAIIA não conseguiu uma sugestão segura (${[...avaliacao.conflitos, ...avaliacao.alertas].slice(0, 2).join(" ") || "sem sugestão"}). Escolha no computador.`, { avaliacao: resumoAvaliacao(avaliacao) });
}
// Guarda o necessário para registrar a confirmação depois (sem respostas brutas).
function resumoAvaliacao(a) {
  return {
    versao: a.versao, sugerida: a.sugerida, preferida: a.preferida || null, conflitos: a.conflitos, alertas: a.alertas, restricoes: a.restricoes || [],
    candidatas: (a.candidatas || []).slice(0, 8).map((c) => ({ id: c.id, caminho: c.caminho, dominio: c.dominio, origens: c.origens, compativel: c.compativel, rejeitada: c.rejeitada, rejeicoes: c.rejeicoes || [], evidencia: c.evidencia, bloqueios: c.bloqueios || [],
      // (09/11) Nomes dos atributos obrigatórios/condicionais (sem valores) para a tela mostrar.
      atributos: c.atributos ? { obrigatorios: (c.atributos.obrigatorios || []).map((x) => ({ id: x.id, nome: x.nome })), condicionais: (c.atributos.condicionais || []).map((x) => ({ id: x.id, nome: x.nome })) } : null })),
  };
}

/**
 * (Rodada 1 — etapa 7 "Categoria") Só a conferência da CATEGORIA, sem conta: catálogo público do
 * Mercado Livre + histórico do SKU (as rejeições usam a conta de cada ficha antiga). Mesma regra
 * da etapa 8: automática só sem dúvida; senão pergunta. Só lê.
 */
export async function conferirSoCategoriaVoz(row, { deps } = {}) {
  return conferirCategoria(entradaDaFicha(row), deps, "");
}

/**
 * (05/11/2026) “Não é esta — procurar outra”: a MESMA busca da Conferência do
 * computador (preditor do ML com o termo digitado + termos da peça, caminho,
 * domínio e atributos, regras de compatibilidade e rejeições do SKU). Só lê.
 * Devolve { ok, avaliacao } — nada é confirmado aqui.
 */
export async function buscarCategoriasVoz(row, termo, { conta = "", deps } = {}) {
  const e = entradaDaFicha(row);
  const contaId = txt(conta || e.conta).replace(/\D/g, "");
  // (09/11) Busca LIVRE: o termo digitado vale sozinho (antes ia junto com os termos da ficha e a
  // sugestão antiga — ex.: MLB431130 — sempre voltava). Código MLB digitado: lido direto na API.
  const digitado = txt(termo);
  const idDigitado = /^MLB\d+$/i.test(digitado) ? digitado.toUpperCase() : "";
  const termos = idDigitado ? [] : digitado ? [digitado] : [...new Set(termosCategoria(e).filter(Boolean))];
  if (!termos.length && !idDigitado) return { ok: false, erro: "Digite o nome técnico da peça para buscar." };
  // Categoria preferida (relés): da peça ou citada no termo (“Semicondutores”, “Componentes Eletrônicos”…).
  const prefProduto = preferenciaDaPeca(e.titulo);
  const pref = (digitado && !idDigitado ? preferenciaDoTermo(digitado) : null) || prefProduto;
  const cache = {};
  const lerItem = (mlb, c) => deps.chamarPublicacao({ acao: "ml_consulta", conta_ml: txt(c || contaId), metodo: "GET", caminho: `/items/${mlb}` });
  const [consultas, rej, prefRes] = await Promise.all([
    termos.length ? consultarPreditor(termos, deps.lerJson) : Promise.resolve([]),
    lerRejeicoesDoSKU({ codigo: e.codigo, listarFichas: deps.listarFichas, lerItem }),
    categoriaPreferida(pref, deps, cache),
  ]);
  const rejeicoes = mesclarRejeicoes(e.categoriaDecisao?.rejeitadas || [], rej.lista).lista;
  const doTermo = consultas.flatMap((q) => q.sugestoes.map((s) => s.category_id));
  const ids = new Set([idDigitado, prefRes?.id, ...doTermo, ...rejeicoes.map((r) => r.categoria_id)].filter(Boolean));
  const detalhes = {};
  for (const id of [...ids].slice(0, 16)) detalhes[id] = await lerDetalheCategoria(id, deps.lerJson, cache);
  const herdadas = [
    ...(idDigitado ? [{ id: idDigitado, origem: ORIGEM_CATEGORIA.BUSCA }] : []),
    ...(prefRes?.id ? [{ id: prefRes.id, origem: ORIGEM_CATEGORIA.PREFERENCIA }] : []),
  ];
  const avaliacao = avaliarCategorias({ tipoVeiculo: e.tipoVeiculo || "Carro/Caminhonete", textoPeca: digitado && !idDigitado ? digitado : e.titulo, textoProduto: e.titulo, consultas, detalhes, evidencia: null, rejeicoes, herdadas });
  avaliacao.restricoes = rej.restricoes || [];
  if (prefRes && !prefRes.ok) avaliacao.alertas.push(prefRes.motivo);
  // A escolha mostrada é a do SEU termo (nunca a sugestão anterior da ficha).
  const porId = Object.fromEntries(avaliacao.candidatas.map((c) => [c.id, c]));
  const doTermoCompat = doTermo.find((id) => porId[id]?.compativel) || "";
  const termoCitaPref = Boolean(prefRes?.id && digitado && preferenciaDoTermo(digitado));
  const buscada = idDigitado || doTermoCompat || (termoCitaPref ? prefRes.id : "") || doTermo[0] || "";
  return { ok: true, avaliacao: resumoAvaliacao(avaliacao), buscada };
}

/** (05/11) Categoria ESCOLHIDA por você (sugerida ou de outra busca): mesmo registro da Conferência. */
export function confirmarCategoriaEscolhida(preparo, { candidata, avaliacao, revisao = null, agora = new Date().toISOString() } = {}) {
  if (!candidata?.id) return { ok: false, erro: "Escolha uma categoria." };
  if (candidata.rejeitada && !revisao) return { ok: false, erro: "Categoria rejeitada para este SKU: só com revisão registrada." };
  if (!candidata.compativel && !revisao) return { ok: false, erro: "Categoria não passou na conferência: só com revisão registrada." };
  return { ok: true, decisao: registrarConfirmacao(preparo?.categoria?.decisao || null, { candidata, avaliacao, revisao, agora }) };
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
  if (n) {
    // (Etapa 2) Só os anos/versões que o catálogo CONFIRMOU — um intervalo nunca vale inteiro por conta de parte dele.
    const porAplicacao = {};
    for (const v of r.veiculos) (porAplicacao[v.aplicacao] = porAplicacao[v.aplicacao] || []).push(v.nome);
    const resumo = Object.entries(porAplicacao).map(([ap, nomes]) => `${ap}: ${nomes.join("; ")}`).join(" · ");
    return item("ok", `Compatibilidade: ${n} veículo(s) confirmados pelo catálogo do Mercado Livre — ${resumo}.`, { veiculos: r.veiculos.map((v) => v.id), validados: r.veiculos.map((v) => ({ id: v.id, nome: v.nome, aplicacao: v.aplicacao })), semCatalogo: r.semCatalogo.length });
  }
  // Falta o motor de uma aplicação: UMA pergunta com as opções do próprio catálogo (nada presumido).
  const pm = (r.perguntasMotor || [])[0];
  if (pm && !compatibilidadeNaoExigivel(e.tipoVeiculo)) return item("pergunta", `Compatibilidade: qual é o motor do ${pm.aplicacao}? (opções do catálogo do Mercado Livre)`, { veiculos: [], perguntaMotor: pm });
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
  // (Regra definitiva 08/11) Outros anúncios do mesmo SKU NÃO bloqueiam: o usuário pode anunciar a mesma
  // peça mais de uma vez. Só falha de consulta para; a repetição da MESMA autorização é barrada no servidor.
  const existentes = [...new Set([...ml.duplicados.map((d) => `${d.id} ${d.status}`), ...av.pendentes.map((p) => p.mlb), ...ml.possiveis.map((d) => d.id)])];
  if (existentes.length) return item("ok", `Duplicidade: já existem anúncios deste SKU nesta conta (${existentes.join(", ")}). Será criado um anúncio ADICIONAL, como você pediu.`, { existentes, duplicados: ml.duplicados.map((d) => d.id) });;
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
    categoria: { decisao: v.categoria?.automatica && v.categoria?.estado === "ok" ? v.categoria.decisao : e.categoriaDecisao },
  };
}

/** O preparo gravado ainda vale para a ficha atual? */
export function preparoAtual(row) {
  const p = row?.dados_conferencia?.paiia_voz?.preparo;
  if (!p?.assinatura) return { valido: false, preparo: p || null, motivo: "ainda não preparado" };
  const e = entradaDaFicha(row);
  return p.assinatura === assinaturaEntrada(e, p.conta) ? { valido: true, preparo: p } : { valido: false, preparo: p, motivo: "a ficha mudou depois da última conferência" };
}
