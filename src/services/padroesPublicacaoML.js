// =============================================================
// PAIIA — PADRÕES FIXOS DE TODO ANÚNCIO NOVO NO MERCADO LIVRE
// -------------------------------------------------------------
// Usado pela função mercadolivre-publicacao (montagem/validação/
// publicação/releitura) e pelo site (Conferência, ficha, publicação).
// JavaScript puro: sem rede, sem Deno, sem React.
//
// Campos OFICIAIS do Mercado Livre (descobertos em anúncios reais e
// em POST /items/validate, 04/10/2026):
//   Garantia ............ item.sale_terms
//                         WARRANTY_TYPE  value_id "2230280" = "Garantia do vendedor"
//                         WARRANTY_TIME  value_name "3 meses"
//   Retirada ............ item.shipping.local_pick_up = true ("Ofereço retirada")
//                         (a preferência da conta vem false: vai explícito por anúncio)
//   Inf. regulatória .... atributo INMETRO_CERTIFICATION_REGISTRATION_NUMBER
//                         value_id "-1" = "Não se aplica"
//                         (só quando a CATEGORIA oferece o atributo; o QR code
//                         regulatório é imagem e nunca é inventado)
// Regra: nunca inventar valor nem forçar campo incompatível. Se o ML exigir
// uma decisão do usuário, bloqueia com o motivo; se só não oferecer o campo,
// mostra a limitação e segue.
// =============================================================

export const VERSAO_PADROES_ML = "2026-10-04.1";

export const GARANTIA_ML = Object.freeze({
  tipo: "vendedor",
  tipo_id: "WARRANTY_TYPE",
  tipo_value_id: "2230280",
  tipo_nome: "Garantia do vendedor",
  tempo_id: "WARRANTY_TIME",
  tempo_value_name: "3 meses",
  meses: 3,
});

export const RETIRADA_ML = Object.freeze({ campo: "shipping.local_pick_up", valor: true });

export const REGULATORIA_ML = Object.freeze({
  atributo: "INMETRO_CERTIFICATION_REGISTRATION_NUMBER",
  value_id_nao_se_aplica: "-1",
  qr_code: "REGULATORY_INFORMATION_QR_CODE",
});

export const LINHAS_FIXAS = Object.freeze({
  garantia: "Garantia: 3 meses — vendedor",
  retirada: "Retirada: Ofereço retirada",
  regulatoria: "Informação regulatória: Não se aplica",
});

const txt = (v) => (v == null ? "" : String(v).trim());
const semAcento = (s) => txt(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Situação da informação regulatória para uma categoria.
 * atributosCategoria: resposta de GET /categories/{id}/attributes (ou null se não lida).
 * atributosInformados: atributos que o anúncio já leva (um número real tem prioridade).
 */
export function resolverRegulatoria(atributosCategoria, atributosInformados = []) {
  const informado = (atributosInformados || []).find((a) => txt(a?.id).toUpperCase() === REGULATORIA_ML.atributo);
  if (informado && (txt(informado.value_name) || (txt(informado.value_id) && txt(informado.value_id) !== REGULATORIA_ML.value_id_nao_se_aplica))) {
    return { situacao: "informado", enviar: null, texto: `Informação regulatória: ${txt(informado.value_name) || txt(informado.value_id)} (informado)`, bloqueia: false };
  }
  if (!Array.isArray(atributosCategoria)) {
    return {
      situacao: "nao_lido",
      enviar: null,
      texto: "Informação regulatória: não conferida (atributos da categoria não foram lidos)",
      limitacao: "Não foi possível ler os atributos da categoria no Mercado Livre; a informação regulatória não foi enviada.",
      bloqueia: false,
    };
  }
  const def = atributosCategoria.find((a) => txt(a?.id) === REGULATORIA_ML.atributo);
  if (!def) {
    return {
      situacao: "nao_oferecido",
      enviar: null,
      texto: "Informação regulatória: campo não oferecido pelo Mercado Livre nesta categoria",
      limitacao: "A categoria não tem o campo de informação regulatória (INMETRO); nada é enviado.",
      bloqueia: false,
    };
  }
  const tags = def.tags || {};
  if (tags.read_only) {
    return { situacao: "somente_leitura", enviar: null, texto: "Informação regulatória: campo somente leitura nesta categoria", limitacao: "O ML marca o campo regulatório como somente leitura; nada é enviado.", bloqueia: false };
  }
  if (tags.required || tags.catalog_required || tags.conditional_required) {
    // O ML exige valor: "Não se aplica" seria inventar uma declaração. Decisão do usuário.
    return {
      situacao: "exige_decisao",
      enviar: null,
      texto: "Informação regulatória: o Mercado Livre EXIGE o número do registro INMETRO nesta categoria",
      bloqueio: "O Mercado Livre exige a informação regulatória (registro INMETRO) nesta categoria. Informe o número real do registro do produto; o PAIIA não declara \"Não se aplica\" em campo obrigatório.",
      bloqueia: true,
    };
  }
  return {
    situacao: "nao_se_aplica",
    enviar: { id: REGULATORIA_ML.atributo, value_id: REGULATORIA_ML.value_id_nao_se_aplica },
    texto: LINHAS_FIXAS.regulatoria,
    bloqueia: false,
  };
}

/**
 * Aplica os três padrões a um item montado para POST /items (ou /items/validate).
 * Não altera o objeto recebido. Retorna { item, padroes, limitacoes, bloqueios }.
 *  - atributosCategoria: GET /categories/{id}/attributes (null = não lido)
 *  - modosFrete: shipping_preferences.modes da conta (null = não lido)
 */
export function aplicarPadroesML(item, { atributosCategoria = null, modosFrete = null } = {}) {
  const novo = { ...item };
  const limitacoes = [];
  const bloqueios = [];

  // 1) Garantia: sempre vendedor, 3 meses (substitui qualquer garantia anterior).
  const outrosTermos = (Array.isArray(item?.sale_terms) ? item.sale_terms : []).filter(
    (t) => ![GARANTIA_ML.tipo_id, GARANTIA_ML.tempo_id].includes(txt(t?.id).toUpperCase())
  );
  novo.sale_terms = [
    ...outrosTermos,
    { id: GARANTIA_ML.tipo_id, value_id: GARANTIA_ML.tipo_value_id },
    { id: GARANTIA_ML.tempo_id, value_name: GARANTIA_ML.tempo_value_name },
  ];

  // 2) Retirada: local_pick_up explícito. O modo só é informado se a conta
  // tiver me2 (é o modo dos anúncios atuais); free_shipping nunca é enviado
  // (o ML aplica o frete grátis obrigatório sozinho).
  const envio = { ...(item?.shipping && typeof item.shipping === "object" ? item.shipping : {}) };
  envio.local_pick_up = true;
  if (!envio.mode && Array.isArray(modosFrete) && modosFrete.includes("me2")) envio.mode = "me2";
  if (Array.isArray(modosFrete) && !modosFrete.includes("me2")) {
    limitacoes.push(`A conta não tem Mercado Envios (me2) nas preferências (${modosFrete.join(", ") || "nenhum"}); a retirada vai sem definir o modo de envio.`);
  }
  if (modosFrete == null) limitacoes.push("Preferências de envio da conta não lidas; a retirada vai sem definir o modo de envio.");
  delete envio.free_shipping;
  novo.shipping = envio;

  // 3) Informação regulatória.
  const atributos = Array.isArray(item?.attributes) ? [...item.attributes] : [];
  const reg = resolverRegulatoria(atributosCategoria, atributos);
  if (reg.enviar && !atributos.some((a) => txt(a?.id).toUpperCase() === REGULATORIA_ML.atributo)) atributos.push(reg.enviar);
  if (reg.limitacao) limitacoes.push(reg.limitacao);
  if (reg.bloqueio) bloqueios.push(reg.bloqueio);
  novo.attributes = atributos;

  const padroes = {
    versao: VERSAO_PADROES_ML,
    garantia: { tipo: GARANTIA_ML.tipo, value_id: GARANTIA_ML.tipo_value_id, tempo: GARANTIA_ML.tempo_value_name, texto: LINHAS_FIXAS.garantia },
    retirada: { local_pick_up: true, modo: envio.mode || null, texto: LINHAS_FIXAS.retirada },
    regulatoria: { situacao: reg.situacao, atributo: REGULATORIA_ML.atributo, value_id: reg.enviar?.value_id || null, texto: reg.texto },
  };
  return { item: novo, padroes, limitacoes, bloqueios };
}

/** Padrões esperados para exibir na Conferência antes de conhecer a categoria. */
export function padroesEsperadosConferencia() {
  return {
    versao: VERSAO_PADROES_ML,
    garantia: { tipo: GARANTIA_ML.tipo, value_id: GARANTIA_ML.tipo_value_id, tempo: GARANTIA_ML.tempo_value_name, texto: LINHAS_FIXAS.garantia },
    retirada: { local_pick_up: true, texto: LINHAS_FIXAS.retirada },
    regulatoria: { situacao: "nao_se_aplica", atributo: REGULATORIA_ML.atributo, value_id: REGULATORIA_ML.value_id_nao_se_aplica, texto: LINHAS_FIXAS.regulatoria },
  };
}

function garantiaDoItem(item) {
  const termos = Array.isArray(item?.sale_terms) ? item.sale_terms : [];
  const tipo = termos.find((t) => txt(t?.id) === GARANTIA_ML.tipo_id);
  const tempo = termos.find((t) => txt(t?.id) === GARANTIA_ML.tempo_id);
  const tipoOk = txt(tipo?.value_id) === GARANTIA_ML.tipo_value_id || semAcento(tipo?.value_name) === semAcento(GARANTIA_ML.tipo_nome);
  const st = tempo?.value_struct;
  const tempoOk =
    semAcento(tempo?.value_name) === semAcento(GARANTIA_ML.tempo_value_name) ||
    (st && Number(st.number) === GARANTIA_ML.meses && /^m[eê]s|^meses/i.test(txt(st.unit)));
  return {
    ok: Boolean(tipoOk && tempoOk),
    recebido: `${txt(tipo?.value_name) || txt(tipo?.value_id) || "sem tipo"} / ${txt(tempo?.value_name) || "sem tempo"}`,
  };
}

function regulatoriaDoItem(item) {
  const a = (item?.attributes || []).find((x) => txt(x?.id) === REGULATORIA_ML.atributo);
  if (!a) return { presente: false, recebido: "ausente" };
  const naoSeAplica = txt(a.value_id) === REGULATORIA_ML.value_id_nao_se_aplica;
  return { presente: true, naoSeAplica, recebido: naoSeAplica ? "Não se aplica (-1)" : txt(a.value_name) || txt(a.value_id) || "vazio" };
}

/**
 * Validação ANTES de publicar: o item que vai ao ML leva os três padrões?
 * Retorna itens no formato da conferência ({ item, nivel, texto }).
 */
export function conferirPadroesNoItem(item, padroes) {
  const itens = [];
  const g = garantiaDoItem(item);
  itens.push({ item: "Garantia", nivel: g.ok ? "ok" : "erro", texto: g.ok ? LINHAS_FIXAS.garantia : `Garantia fora do padrão (${g.recebido}). Padrão: 3 meses, garantia do vendedor.` });
  const ret = item?.shipping?.local_pick_up === true;
  itens.push({ item: "Retirada", nivel: ret ? "ok" : "erro", texto: ret ? LINHAS_FIXAS.retirada : "O anúncio não está com \"Ofereço retirada\" ativo." });
  const sit = padroes?.regulatoria?.situacao;
  const r = regulatoriaDoItem(item);
  if (sit === "exige_decisao") itens.push({ item: "Informação regulatória", nivel: "erro", texto: padroes.regulatoria.texto + " — informe o número real." });
  else if (sit === "nao_se_aplica") itens.push({ item: "Informação regulatória", nivel: r.naoSeAplica ? "ok" : "erro", texto: r.naoSeAplica ? LINHAS_FIXAS.regulatoria : `Esperado "Não se aplica"; no item: ${r.recebido}.` });
  else if (sit === "informado") itens.push({ item: "Informação regulatória", nivel: r.presente ? "ok" : "erro", texto: padroes.regulatoria.texto });
  else itens.push({ item: "Informação regulatória", nivel: "aviso", texto: padroes?.regulatoria?.texto || "Informação regulatória: situação não conferida." });
  return itens;
}

/**
 * Releitura DEPOIS de publicar (GET /items/{id}): compara com os padrões enviados.
 * Retorna { itens, pendencias } no mesmo formato de conferirPublicacao.
 */
export function conferirPadroesPublicados(itemML, padroes) {
  const itens = [];
  if (!itemML?.id) return { itens, pendencias: ["Padrões ML (garantia/retirada/regulatória): anúncio não relido."] };
  const g = garantiaDoItem(itemML);
  itens.push({ item: "Garantia", esperado: "3 meses — vendedor", recebido: g.recebido, ok: g.ok, obrigatorio: true });
  const ret = itemML?.shipping?.local_pick_up;
  itens.push({ item: "Retirada", esperado: "Ofereço retirada", recebido: ret === true ? "Ofereço retirada" : ret === false ? "desativada" : "não informada", ok: ret === true, obrigatorio: true });
  const sit = padroes?.regulatoria?.situacao;
  const r = regulatoriaDoItem(itemML);
  if (sit === "nao_se_aplica") itens.push({ item: "Informação regulatória", esperado: "Não se aplica", recebido: r.recebido, ok: Boolean(r.naoSeAplica), obrigatorio: true });
  else if (sit === "informado") itens.push({ item: "Informação regulatória", esperado: "valor informado", recebido: r.recebido, ok: r.presente, obrigatorio: true });
  else itens.push({ item: "Informação regulatória", esperado: padroes?.regulatoria?.texto || "não enviada", recebido: r.recebido, ok: true, obrigatorio: false });
  const pendencias = itens.filter((i) => i.obrigatorio && !i.ok).map((i) => `${i.item}: esperado ${i.esperado}, recebido ${i.recebido}.`);
  return { itens, pendencias };
}
