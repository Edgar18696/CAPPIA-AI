// =============================================================
// PAIIA — CATEGORIA DO MERCADO LIVRE (regras puras, sem rede/React)
// -------------------------------------------------------------
// Caso real (08/10/2026): 8200442891 (anel de vedação/segmento do câmbio
// automático DP0) foi publicado DUAS vezes em MLB47095 "Jogo de Anéis
// Motor" (domínio de anéis de PISTÃO) e o Mercado Livre encerrou os dois
// anúncios por "categoria incorreta" (MLB5351282473 e MLB7770899950).
//
// Regras definitivas:
// 1. Nunca escolher pela 1ª sugestão do preditor.
// 2. Anúncios reais do mesmo código são EVIDÊNCIA, nunca prova.
// 3. Cruzar: identificação técnica da peça, tipo de veículo, preditor
//    oficial, caminho/domínio da categoria, anúncios do mesmo código,
//    atributos obrigatórios/condicionais e categorias rejeitadas do SKU.
// 4. Conflito entre as fontes = o PAIIA NÃO sugere; mostra as alternativas.
// 5. Categoria herdada (ficha, base, navegador) não é definitiva: entra
//    como candidata e passa pela mesma avaliação.
// 6. Categoria rejeitada pelo ML para o SKU: nunca reutilizada nem
//    pré-selecionada; só com revisão explícita registrada.
// 7. Mesmo sem conflito, a categoria só vale depois da confirmação do
//    usuário (registro com data/hora, origem e escolha manual).
// Testes: scripts/testes/categoriaML.test.mjs
// =============================================================

export const VERSAO_REGRA_CATEGORIA = "2026-10-09.1";

export const ORIGEM_CATEGORIA = Object.freeze({
  PREDITOR: "preditor",
  EVIDENCIA: "anuncios_mesmo_codigo",
  FICHA: "ficha_anterior",
  BASE: "base_paiia",
  NAVEGADOR: "navegador",
  BUSCA: "busca_manual",
  REJEITADA: "historico_rejeicao",
});

export const ROTULO_ORIGEM_CATEGORIA = Object.freeze({
  preditor: "preditor oficial do Mercado Livre",
  anuncios_mesmo_codigo: "anúncios reais do mesmo código",
  ficha_anterior: "ficha anterior (herdada — revalidada)",
  base_paiia: "Base PAIIA (herdada — revalidada)",
  navegador: "escolha antiga guardada no navegador (herdada — revalidada)",
  busca_manual: "busca manual",
  historico_rejeicao: "histórico de rejeição do Mercado Livre",
});

const semAcento = (v) => String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "");
const norm = (v) => ` ${semAcento(v).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
const txt = (v) => String(v ?? "").trim();
const idCat = (v) => (/^MLB\d+$/i.test(txt(v)) ? txt(v).toUpperCase() : "");

// ---------- Sistema (ramo técnico) da peça e da categoria ----------
// Só sistemas bem separados no catálogo do ML; o resto fica "não identificado"
// (sem conflito de domínio — mas também sem prova de compatibilidade).
const SISTEMAS = [
  {
    id: "transmissao",
    rotulo: "transmissão/câmbio",
    peca: [" cambio", " transmissao", " transmissoes", " caixa de marcha", " caixas de marcha", " embreagem", " diferencial", " conversor de torque", " trambulador", " semi eixo", " semieixo", " homocinetic", " cardan", " caixa de transferencia", " dp0 ", " al4 ", " dp2 ", " cvt "],
    categoria: [" transmissao", " transmissoes", " transmisso ", " cambio", " cambios", " caixas de marchas", " embreagens", " diferenciais", " cardan", " conversores de torque", " trizetas", " semiarvores"],
    dominio: /GEARBOX|TRANSMISSION|CLUTCH|DIFFERENTIAL|TORQUE_CONVERTER|CV_JOINT|DRIVESHAFT/,
  },
  {
    id: "motor",
    rotulo: "motor",
    peca: [" pistao", " pistoes", " anel de pistao", " aneis de pistao", " biela", " virabrequim", " cabecote", " bloco do motor", " bronzina", " tucho", " balancim", " comando de valvula", " junta do cabecote", " valvula de admissao", " valvula de escape", " carter do motor"],
    categoria: [" motor ", " motores "],
    dominio: /ENGINE/,
  },
  {
    id: "freio",
    rotulo: "freio",
    peca: [" freio", " freios", " pastilha", " pinca de freio", " cilindro mestre", " lona de freio"],
    categoria: [" freios ", " freio "],
    dominio: /BRAKE/,
  },
  {
    id: "suspensao",
    rotulo: "suspensão/direção",
    peca: [" amortecedor", " bandeja", " pivo ", " bieleta", " terminal de direcao", " caixa de direcao", " barra estabilizadora", " mola helicoidal"],
    categoria: [" suspensao", " direcao "],
    dominio: /SUSPENSION|SHOCK_ABSORBER|STEERING/,
  },
  {
    id: "ignicao",
    rotulo: "ignição",
    peca: [" bobina", " vela de ignicao", " velas de ignicao", " cabo de vela", " cabos de vela", " distribuidor de ignicao"],
    categoria: [" ignicao "],
    dominio: /IGNITION|SPARK_PLUG/,
  },
];

const RAMO_POR_TIPO = [
  { tipo: /carro|caminhonete/, ramo: "Peças de Carros e Caminhonetes" },
  { tipo: /linha pesada|caminhao|onibus/, ramo: "Peças de Linha Pesada" },
  { tipo: /moto|quadriciclo/, ramo: "Peças de Motos e Quadriciclos" },
];

/** Sistemas citados no texto da peça (nome técnico / produto principal). */
export function sistemasDaPeca(texto) {
  const t = norm(texto);
  return SISTEMAS.filter((s) => s.peca.some((p) => t.includes(p))).map((s) => s.id);
}

/** Sistema da categoria pelo caminho (do 3º nível em diante) e pelo domínio. */
export function sistemaDaCategoria({ niveis = [], dominio = "" } = {}) {
  const dom = txt(dominio).toUpperCase();
  for (const s of SISTEMAS) if (dom && s.dominio.test(dom)) return s.id;
  const caminho = norm((niveis || []).slice(2).join(" "));
  for (const s of SISTEMAS) if (s.categoria.some((p) => caminho.includes(p))) return s.id;
  return "";
}

export const rotuloSistema = (id) => SISTEMAS.find((s) => s.id === id)?.rotulo || id || "não identificado";

function ramoEsperado(tipoVeiculo) {
  const t = norm(tipoVeiculo);
  return RAMO_POR_TIPO.find((r) => r.tipo.test(t))?.ramo || "";
}

// ---------- Histórico de rejeições do SKU ----------
// (09/10/2026) "forbidden" NÃO significa categoria errada: o ML restringe
// anúncios por vários motivos. Só vira CATEGORIA REJEITADA com evidência
// específica de categoria incorreta (motivo confirmado) ou por decisão
// manual com justificativa. Sem motivo comprovado = só histórico
// ("motivo da restrição não confirmado"), sem contaminar a categoria.

/**
 * Motivos CONFIRMADOS no painel do Mercado Livre (a API não informa o motivo).
 * MLB7770899950 (8200442891, LojaOnlineSP): "Finalizado pelo Mercado Livre —
 * Estava em uma categoria incorreta." — lido no painel em 09/10/2026.
 */
export const MOTIVOS_CONFIRMADOS_ML = Object.freeze({
  MLB7770899950: "Finalizado pelo Mercado Livre: estava em uma categoria incorreta (confirmado no painel do ML em 09/10/2026).",
});

export const TEXTO_RESTRICAO_NAO_CONFIRMADA = "motivo da restrição não confirmado";

/** O motivo informado é evidência específica de categoria incorreta? */
export function motivoEhCategoriaIncorreta(motivo) {
  const t = norm(motivo);
  return /categori[ao]s? (incorret|errad|invalid|inadequad)/.test(t) || /(incorret|errad)\w* categori/.test(t);
}

/**
 * MLBs anteriores lidos no ML → { rejeicoes, restricoes }.
 * rejeicoes: só com motivo de CATEGORIA INCORRETA comprovado.
 * restricoes: MLB restrito/moderado (forbidden) sem motivo comprovado.
 */
export function classificarMLBsAnteriores(lidos = [], { motivosConhecidos = MOTIVOS_CONFIRMADOS_ML, agora = new Date().toISOString() } = {}) {
  const rejeicoes = [];
  const restricoes = [];
  for (const l of lidos || []) {
    const mlb = txt(l?.mlb || l?.id).toUpperCase();
    const categoria = idCat(l?.categoria_id || l?.category_id);
    const sub = (Array.isArray(l?.sub_status) ? l.sub_status : []).map((s) => txt(s).toLowerCase());
    if (!mlb || !sub.includes("forbidden")) continue;
    const motivo = txt(motivosConhecidos?.[mlb]);
    const base = { categoria_id: categoria, mlb, conta: txt(l?.conta), status_ml: txt(l?.status), sub_status_ml: sub, registrado_em: agora };
    if (categoria && motivo && motivoEhCategoriaIncorreta(motivo)) rejeicoes.push({ ...base, motivo, origem: "motivo_confirmado" });
    else restricoes.push({ ...base, motivo: motivo || TEXTO_RESTRICAO_NAO_CONFIRMADA, origem: "leitura_ml" });
  }
  return { rejeicoes, restricoes };
}

/** Só as rejeições comprovadas (compatibilidade com quem só precisa delas). */
export function rejeicoesDosMLBs(lidos = [], opcoes = {}) {
  return classificarMLBsAnteriores(lidos, opcoes).rejeicoes;
}

/** Rejeição por DECISÃO MANUAL (com justificativa registrada). */
export function rejeicaoManual({ categoria_id, justificativa, agora = new Date().toISOString() } = {}) {
  const cat = idCat(categoria_id);
  const j = txt(justificativa);
  if (!cat || j.length < 10) return null;
  return { categoria_id: cat, mlb: "", motivo: `Rejeitada por decisão manual: ${j}`, justificativa: j, origem: "manual", registrado_em: agora };
}

/** Só acrescenta (nunca apaga): chave = categoria + MLB (manual: categoria + justificativa). */
export function mesclarRejeicoes(antigas = [], novas = []) {
  const chave = (r) => `${idCat(r?.categoria_id)}|${txt(r?.mlb).toUpperCase()}|${r?.origem === "manual" ? txt(r?.justificativa) : ""}`;
  const out = (Array.isArray(antigas) ? antigas : []).filter((r) => idCat(r?.categoria_id)).map((r) => ({ ...r }));
  let mudou = false;
  for (const n of novas || []) {
    if (!idCat(n?.categoria_id)) continue;
    if (out.some((r) => chave(r) === chave(n))) continue;
    out.push({ ...n, categoria_id: idCat(n.categoria_id) });
    mudou = true;
  }
  return { lista: out, mudou };
}

/** Rejeições de UMA categoria (todas as ocorrências, com MLB e motivo). */
export function rejeicoesDaCategoria(id, rejeicoes = []) {
  const c = idCat(id);
  return c ? (rejeicoes || []).filter((r) => idCat(r?.categoria_id) === c) : [];
}

// ---------- Avaliação de UMA categoria ----------
/**
 * detalhe = { id, nome, niveis[], caminho, dominio, listingAllowed, atributos? (resumo), tipoVeiculo? {existe, valores[]} }
 */
export function avaliarUmaCategoria(detalhe, { tipoVeiculo = "Carro/Caminhonete", sistemasPeca = [], rejeicoes = [] } = {}) {
  const alertas = [];
  const bloqueios = [];
  const niveis = Array.isArray(detalhe?.niveis) ? detalhe.niveis : [];
  if (!niveis.length) bloqueios.push("caminho da categoria não lido no Mercado Livre");
  else if (niveis[0] !== "Acessórios para Veículos") bloqueios.push(`categoria fora de "Acessórios para Veículos" (${niveis[0]})`);
  else {
    const ramo = ramoEsperado(tipoVeiculo);
    if (ramo && niveis[1] !== ramo) bloqueios.push(`ramo "${niveis[1] || "?"}" não é o do tipo de veículo (${tipoVeiculo} → ${ramo})`);
  }
  if (detalhe?.listingAllowed === false) bloqueios.push("a categoria não aceita anúncios (listing_allowed = false)");
  if (Array.isArray(detalhe?.filhos) && detalhe.filhos.length) bloqueios.push("categoria com subcategorias (o ML exige a categoria final)");
  const sistemaCat = sistemaDaCategoria(detalhe || {});
  if (sistemasPeca.length && sistemaCat && !sistemasPeca.includes(sistemaCat)) {
    bloqueios.push(`domínio de ${rotuloSistema(sistemaCat)} para peça de ${sistemasPeca.map(rotuloSistema).join("/")}`);
  }
  if (sistemasPeca.length > 1) alertas.push(`a peça cita mais de um sistema (${sistemasPeca.map(rotuloSistema).join(", ")})`);
  if (!sistemasPeca.length) alertas.push("o PAIIA não identificou o sistema técnico da peça — confira o caminho com atenção");
  const tv = detalhe?.tipoVeiculo;
  if (tv?.existe && tv.valores?.length) {
    const alvo = norm(tipoVeiculo);
    if (!tv.valores.some((v) => norm(v.nome) === alvo)) bloqueios.push(`o Tipo de veículo "${tipoVeiculo}" não existe nesta categoria (aceita: ${tv.valores.map((v) => v.nome).join(", ")})`);
  }
  const rej = rejeicoesDaCategoria(detalhe?.id, rejeicoes);
  return {
    sistema: sistemaCat,
    compativel: bloqueios.length === 0 && rej.length === 0,
    rejeitada: rej.length > 0,
    rejeicoes: rej,
    bloqueios,
    alertas,
  };
}

// ---------- Cruzamento de todas as fontes ----------
/**
 * entrada = {
 *   tipoVeiculo, textoPeca (nome técnico/produto principal),
 *   consultas: [{ termo, sugestoes: [{ category_id, domain_id, domain_name }] }],
 *   detalhes: { [id]: detalhe },
 *   evidencia: { estado: "ok"|"indisponivel"|"sem_resultado"|"nao_consultada", total, porCategoria: {id: {anuncios, vendedores}} },
 *   rejeicoes: [...], herdadas: [{ id, caminho, origem }]
 * }
 * Devolve { candidatas[], sugerida, conflitos[], alertas[], sistemasPeca[] }.
 * `sugerida` só existe SEM conflito — e mesmo assim precisa ser confirmada.
 */
export function avaliarCategorias({ tipoVeiculo = "Carro/Caminhonete", textoPeca = "", consultas = [], detalhes = {}, evidencia = null, rejeicoes = [], herdadas = [] } = {}) {
  const sistemasPeca = sistemasDaPeca(textoPeca);
  const mapa = new Map();
  const garantir = (id) => {
    const c = idCat(id);
    if (!c) return null;
    if (!mapa.has(c)) mapa.set(c, { id: c, origens: [], preditor: [], evidencia: null, herdadaDe: [] });
    return mapa.get(c);
  };
  // Preditor: posição em cada consulta (1 = 1ª sugestão daquela consulta).
  for (const q of consultas || []) {
    (q?.sugestoes || []).forEach((s, i) => {
      const c = garantir(s?.category_id);
      if (!c) return;
      if (!c.origens.includes(ORIGEM_CATEGORIA.PREDITOR)) c.origens.push(ORIGEM_CATEGORIA.PREDITOR);
      c.preditor.push({ termo: txt(q.termo), posicao: i + 1 });
      if (s?.domain_id && !c.dominioPreditor) c.dominioPreditor = txt(s.domain_id);
    });
  }
  const ev = evidencia && typeof evidencia === "object" ? evidencia : { estado: "nao_consultada" };
  for (const [id, e] of Object.entries(ev.porCategoria || {})) {
    const c = garantir(id);
    if (!c) continue;
    if (!c.origens.includes(ORIGEM_CATEGORIA.EVIDENCIA)) c.origens.push(ORIGEM_CATEGORIA.EVIDENCIA);
    c.evidencia = { anuncios: Number(e?.anuncios) || 0, vendedores: Number(e?.vendedores) || 0 };
  }
  for (const h of herdadas || []) {
    const c = garantir(h?.id);
    if (!c) continue;
    const o = Object.values(ORIGEM_CATEGORIA).includes(h.origem) ? h.origem : ORIGEM_CATEGORIA.FICHA;
    if (!c.origens.includes(o)) c.origens.push(o);
    c.herdadaDe.push(o);
  }
  for (const r of rejeicoes || []) {
    const c = garantir(r?.categoria_id);
    if (c && !c.origens.includes(ORIGEM_CATEGORIA.REJEITADA)) c.origens.push(ORIGEM_CATEGORIA.REJEITADA);
  }

  const candidatas = [...mapa.values()].map((c) => {
    const d = detalhes?.[c.id] || { id: c.id };
    const av = avaliarUmaCategoria({ ...d, id: c.id, dominio: d.dominio || c.dominioPreditor || "" }, { tipoVeiculo, sistemasPeca, rejeicoes });
    return {
      ...c,
      nome: txt(d.nome),
      caminho: txt(d.caminho) || (Array.isArray(d.niveis) ? d.niveis.join(" > ") : ""),
      niveis: Array.isArray(d.niveis) ? d.niveis : [],
      dominio: txt(d.dominio || c.dominioPreditor),
      atributos: d.atributos || null,
      ...av,
    };
  });

  const conflitos = [];
  const alertas = [];
  const porId = Object.fromEntries(candidatas.map((c) => [c.id, c]));
  // Voto de cada consulta ao preditor = 1ª categoria COMPATÍVEL na ordem do ML.
  const votos = [];
  const avisadas = new Set();
  for (const q of consultas || []) {
    const ids = (q?.sugestoes || []).map((s) => idCat(s?.category_id)).filter(Boolean);
    if (!ids.length) continue;
    const primeira = porId[ids[0]];
    if (primeira && !primeira.compativel && !avisadas.has(primeira.id)) {
      avisadas.add(primeira.id);
      alertas.push(`O preditor do ML sugeriu primeiro ${primeira.id} ${primeira.nome ? `(${primeira.nome})` : ""} para "${txt(q.termo)}" — ${primeira.rejeitada ? "categoria REJEITADA para este SKU" : primeira.bloqueios.join("; ")}.`);
    }
    const voto = ids.find((id) => porId[id]?.compativel);
    if (voto) votos.push({ termo: txt(q.termo), id: voto });
  }
  const votados = [...new Set(votos.map((v) => v.id))];
  if (!(consultas || []).some((q) => (q?.sugestoes || []).length)) conflitos.push("O preditor do Mercado Livre não respondeu ou não sugeriu categoria.");
  else if (!votados.length) conflitos.push("O preditor do Mercado Livre não sugeriu nenhuma categoria compatível com a peça e o tipo de veículo.");
  else if (votados.length > 1) conflitos.push(`O preditor indicou categorias compatíveis diferentes conforme o termo (${votados.join(", ")}).`);

  // Evidência (anúncios reais do mesmo código): só confirma ou contradiz.
  const comEvidencia = candidatas.filter((c) => c.evidencia?.anuncios > 0).sort((a, b) => b.evidencia.anuncios - a.evidencia.anuncios);
  const evidenciaCompat = comEvidencia.filter((c) => c.compativel);
  if (ev.estado === "ok" && comEvidencia.length) {
    const topo = comEvidencia[0];
    if (!topo.compativel) alertas.push(`A maioria dos anúncios do mesmo código (${topo.evidencia.anuncios}) está em ${topo.id} ${topo.nome ? `(${topo.nome})` : ""}, que NÃO serve: ${topo.rejeitada ? "categoria REJEITADA para este SKU" : topo.bloqueios.join("; ")}. Anúncios de outros vendedores não são prova.`);
    if (votados.length === 1 && evidenciaCompat.length && evidenciaCompat[0].id !== votados[0]) {
      conflitos.push(`O preditor indica ${votados[0]}, mas os anúncios do mesmo código (compatíveis) usam ${evidenciaCompat[0].id}.`);
    }
    if (!votados.length && evidenciaCompat.length) {
      alertas.push(`Os anúncios do mesmo código usam ${evidenciaCompat.map((c) => c.id).join(", ")} — evidência, não prova: confira e decida.`);
    }
  } else if (ev.estado === "indisponivel") {
    alertas.push("Anúncios do mesmo código: consulta indisponível agora (sem evidência).");
  }

  // Herdada diferente da sugestão do preditor = conflito; rejeitada = alerta forte.
  for (const h of herdadas || []) {
    const c = porId[idCat(h?.id)];
    if (!c) continue;
    if (c.rejeitada) alertas.push(`A categoria ${c.id} ${h.origem === ORIGEM_CATEGORIA.NAVEGADOR ? "guardada no navegador" : "herdada"} está REJEITADA para este SKU e NÃO foi reaproveitada.`);
    else if (!c.compativel) alertas.push(`A categoria herdada ${c.id} não passou na revalidação: ${c.bloqueios.join("; ")}.`);
    else if (votados.length === 1 && c.id !== votados[0]) conflitos.push(`A categoria herdada ${c.id} é diferente da indicada pelo preditor (${votados[0]}).`);
  }

  const sugerida = conflitos.length === 0 && votados.length === 1 ? votados[0] : null;
  const ordem = (c) => (c.id === sugerida ? 0 : c.rejeitada ? 4 : !c.compativel ? 3 : c.preditor.length || c.evidencia ? 1 : 2);
  candidatas.sort((a, b) => ordem(a) - ordem(b) || (b.evidencia?.anuncios || 0) - (a.evidencia?.anuncios || 0) || (Math.min(...a.preditor.map((p) => p.posicao), 99) - Math.min(...b.preditor.map((p) => p.posicao), 99)));
  return { versao: VERSAO_REGRA_CATEGORIA, candidatas, sugerida, conflitos, alertas, sistemasPeca, votos };
}

// ---------- Decisão do usuário (rastreabilidade) ----------
/**
 * Registro gravado na ficha (campos.categoriaDecisao):
 * { versao, confirmada: {id, caminho, dominio, origem[], manual, sugerida, data},
 *   apresentadas[], descartadas[], rejeitadas[], conflitos[], alertas[],
 *   revisao: {categoria_id, tipo, justificativa, data} | null, historico[] }
 */
export function registrarConfirmacao(decisaoAnterior, { candidata, avaliacao, agora = new Date().toISOString(), revisao = null } = {}) {
  const ant = decisaoAnterior && typeof decisaoAnterior === "object" ? decisaoAnterior : {};
  if (!candidata?.id) return ant;
  const apresentadas = (avaliacao?.candidatas || []).map((c) => ({
    id: c.id, caminho: c.caminho, dominio: c.dominio, origens: c.origens, compativel: c.compativel, rejeitada: c.rejeitada,
    evidencia: c.evidencia, bloqueios: c.bloqueios,
  }));
  const descartadas = apresentadas
    .filter((c) => c.id !== candidata.id)
    .map((c) => ({ id: c.id, motivo: c.rejeitada ? "categoria REJEITADA para este SKU" : !c.compativel ? (c.bloqueios || []).join("; ") || "incompatível" : "não escolhida pelo usuário" }));
  const historico = [...(Array.isArray(ant.historico) ? ant.historico : []), { acao: "confirmou", id: candidata.id, data: agora, sugerida: avaliacao?.sugerida || null }].slice(-30);
  return {
    versao: VERSAO_REGRA_CATEGORIA,
    confirmada: {
      id: candidata.id,
      caminho: candidata.caminho,
      dominio: candidata.dominio,
      origem: candidata.origens || [],
      manual: true,
      sugerida: avaliacao?.sugerida === candidata.id,
      data: agora,
    },
    apresentadas,
    descartadas,
    rejeitadas: (avaliacao?.candidatas || []).filter((c) => c.rejeitada).flatMap((c) => c.rejeicoes),
    // MLBs restritos pelo ML SEM motivo comprovado (histórico; não rejeitam categoria).
    restricoes: Array.isArray(avaliacao?.restricoes) ? avaliacao.restricoes : (ant.restricoes || []),
    conflitos: avaliacao?.conflitos || [],
    alertas: avaliacao?.alertas || [],
    revisao: revisao && revisao.categoria_id === candidata.id ? revisao : null,
    motivoSemGtin: ant.motivoSemGtin || null,
    historico,
  };
}

/** Desfaz a confirmação (troca de categoria / rejeição nova) sem apagar o histórico. */
export function desfazerConfirmacao(decisao, motivo, agora = new Date().toISOString()) {
  if (!decisao?.confirmada) return decisao || null;
  return {
    ...decisao,
    confirmada: null,
    historico: [...(decisao.historico || []), { acao: "desfeita", id: decisao.confirmada.id, motivo, data: agora }].slice(-30),
  };
}

/**
 * A categoria pode ser usada (Conferência aprovar / Publicação publicar)?
 * Devolve { ok, motivos[] } — qualquer motivo BLOQUEIA.
 */
export function conferirCategoriaParaPublicar({ categoriaId, decisao, rejeicoes = [], detalhe = null, tipoVeiculo = "Carro/Caminhonete", textoPeca = "", exigencias = null } = {}) {
  const motivos = [];
  const id = idCat(categoriaId);
  if (!id) motivos.push("Categoria do Mercado Livre não definida.");
  else if (!decisao?.confirmada?.id) motivos.push(`Categoria ${id} não confirmada por você na Conferência (categoria herdada precisa ser revalidada e confirmada).`);
  else if (idCat(decisao.confirmada.id) !== id) motivos.push(`A categoria do envio (${id}) é diferente da confirmada (${decisao.confirmada.id}).`);
  if (id) {
    const rej = rejeicoesDaCategoria(id, [...(rejeicoes || []), ...(decisao?.rejeitadas || [])]);
    const revisada = decisao?.revisao?.categoria_id === id && txt(decisao.revisao.justificativa).length >= 10;
    if (rej.length && !revisada) motivos.push(`CATEGORIA REJEITADA: ${id} já teve anúncio deste SKU encerrado pelo Mercado Livre (${rej.map((r) => `${r.mlb}: ${r.motivo}`).join("; ")}).`);
    if (detalhe) {
      const av = avaliarUmaCategoria({ ...detalhe, id }, { tipoVeiculo, sistemasPeca: sistemasDaPeca(textoPeca), rejeicoes: [] });
      const revisadaIncompat = decisao?.revisao?.categoria_id === id && decisao.revisao.tipo === "incompativel" && txt(decisao.revisao.justificativa).length >= 10;
      if (av.bloqueios.length && !revisadaIncompat) motivos.push(`Categoria ${id} incompatível: ${av.bloqueios.join("; ")}.`);
    } else motivos.push(`Caminho/domínio da categoria ${id} não conferido agora no Mercado Livre.`);
  }
  if (exigencias && !exigencias.ok) for (const p of exigencias.pendentes) motivos.push(p.texto);
  return { ok: motivos.length === 0, motivos };
}
