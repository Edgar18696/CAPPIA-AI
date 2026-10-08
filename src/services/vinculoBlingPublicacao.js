// =============================================================
// PAIIA — Integração do anúncio NOVO com a Gestão de Anúncios do Bling.
//
// Fluxo (somente para anúncios publicados pelo PAIIA a partir desta versão):
//   produto Bling localizado/criado → SKU oficial = `codigo` do produto Bling
//   → publica no Mercado Livre → MLB → salva NA HORA (aguardando_importacao)
//   → o usuário traz SOMENTE ESTE MLB pelo Bling ("Trazer dados do canal" →
//     "Pelo MLB ou link"; importação automática da loja DESLIGADA)
//   → o PAIIA confere pela API de LEITURA (anuncios_consultar)
//   → só com loja + produto + MLB conferidos: "integrado".
//
// Este módulo NUNCA grava no Bling nem no Mercado Livre: não cria produto,
// não cria vínculo (/produtos/lojas está fora do fluxo ML), não importa,
// não publica, não altera estoque/preço/custo/fiscal. Só as ações de
// leitura `anuncios_consultar` e `anuncios_buscar_mlb` (GET /anuncios).
// =============================================================

export const ACAO_LEITURA = "anuncios_consultar";
/** Busca paginada de UM MLB na loja (somente leitura). */
export const ACAO_BUSCA_MLB = "anuncios_buscar_mlb";
export const CHAVE_REGISTRO = "integracao_bling";

export const ESTADO = Object.freeze({
  AGUARDANDO: "aguardando_importacao",
  INTEGRADO: "integrado",
  PRODUTO_INCORRETO: "produto_incorreto",
  ERRO_CONSULTA: "erro_consulta",
});

export const TEXTO_ESTADO = Object.freeze({
  [ESTADO.AGUARDANDO]: "Publicado no ML — falta trazer para o Bling",
  [ESTADO.INTEGRADO]: "Publicado no ML e integrado ao Bling",
  [ESTADO.PRODUTO_INCORRETO]: "Anúncio encontrado no Bling, mas vinculado ao produto errado",
  [ESTADO.ERRO_CONSULTA]: "Não foi possível confirmar no Bling — tente verificar novamente",
});

/** Conta Mercado Livre → loja Bling (mesma tabela da função bling-integracao). Nunca adivinha. */
export const LOJAS_ML_BLING = Object.freeze([
  Object.freeze({ ml_user_id: "1729335019", nome: "LOJA ONLINE", bling_loja_id: "204883484", bling_loja_nome: "LojaOnlineSP" }),
]);
export function lojaBlingDaConta(mlUserId) {
  const id = String(mlUserId ?? "").replace(/\D/g, "");
  const l = LOJAS_ML_BLING.filter((x) => x.ml_user_id === id);
  return l.length === 1 ? l[0] : null;
}

/** Tela oficial do Bling para trazer anúncios da própria conta. */
export const URL_BLING_TRAZER = "https://novo.bling.com.br/ads/list/import?option=my";
/**
 * Vínculo Mercado Livre → Bling: SEMPRE MANUAL (confirmação humana).
 * O PAIIA só orienta e depois CONFERE por leitura ("Já trouxe — verificar
 * agora"). Nunca ativa importação automática nem escolhe/vincula produto.
 */
export const AVISO_VINCULO_MANUAL = "VÍNCULO MANUAL NO BLING — NÃO USAR IMPORTAÇÃO/VÍNCULO AUTOMÁTICO.";
export function passosBling({ lojaNome = "", sku = "" } = {}) {
  const t = (v) => String(v ?? "").trim();
  const loja = t(lojaNome) || "a loja correta desta conta";
  return [
    "No PAIIA: copie o MLB (📋 Copiar MLB).",
    `Abra o Bling → Trazer dados do canal → Trazer anúncios novos da minha conta → escolha a loja correta (${loja}).`,
    "Escolha \"Pelo MLB ou link\" e cole este MLB.",
    `O Bling localiza/sugere o produto EXISTENTE pelo mesmo SKU${t(sku) ? ` (${t(sku)})` : ""}: confira se é o produto certo. Não crie produto novo.`,
    "Você confirma manualmente o relacionamento do anúncio com esse produto (nada é vinculado sozinho).",
    "Volte ao PAIIA e clique em \"🔎 Já trouxe — verificar agora\".",
  ];
}
export const PASSOS_BLING = Object.freeze(passosBling({ lojaNome: "LojaOnlineSP" }));
// Compatibilidade com quem importava o aviso antigo: agora é o aviso do vínculo manual.
export const AVISO_AUTOMATICA = AVISO_VINCULO_MANUAL;

const txt = (v) => String(v ?? "").trim();
export function normalizarMLB(v) {
  const t = txt(v).toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^MLB\d{6,}$/.test(t) ? t : "";
}

/**
 * SKU OFICIAL do anúncio = `codigo` do produto do Bling, EXATAMENTE como está
 * (hífen, letras, zeros, maiúsculas/minúsculas). Sem produto Bling único → "".
 * Não normaliza, não corta espaços internos, não altera o cadastro.
 */
export function skuOficialBling(bling) {
  if (!bling || !bling.encontrado || bling.ambiguo) return "";
  const c = bling.produto?.codigo;
  return typeof c === "string" || typeof c === "number" ? String(c) : "";
}

/** Registro salvo NA HORA em que o Mercado Livre devolve o MLB. */
export function registroPublicado({ mlb, contaId, contaNome = "", skuOficial, codigoPesquisado = "", produtoBlingId, preco, agora = new Date().toISOString() }) {
  const loja = lojaBlingDaConta(contaId);
  const n = Number(preco);
  return {
    estado: ESTADO.AGUARDANDO,
    mlb: normalizarMLB(mlb),
    sku_oficial: String(skuOficial ?? ""),
    codigo_pesquisado: String(codigoPesquisado ?? ""),
    bling_produto_id: txt(produtoBlingId) || null,
    ml_user_id: txt(contaId),
    conta_nome: txt(contaNome),
    bling_loja_id: loja?.bling_loja_id || null,
    bling_loja_nome: loja?.bling_loja_nome || null,
    preco_publicado: Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null,
    publicado_em: agora,
    bling_anuncio_id: null,
    produto_encontrado_id: null,
    mensagem: TEXTO_ESTADO[ESTADO.AGUARDANDO],
    verificado_em: null,
    tentativas: 0,
  };
}

/** Pode/precisa conferir no Bling? (nunca para registros sem MLB/loja/produto) */
export function precisaConferir(reg) {
  return Boolean(reg && normalizarMLB(reg.mlb) && reg.bling_loja_id && reg.bling_produto_id && reg.estado !== ESTADO.INTEGRADO);
}

/** Estado vindo da ficha (recuperação após F5). Registros antigos/sem chave → null. */
export function registroDaFicha(dadosConferencia) {
  const r = dadosConferencia?.[CHAVE_REGISTRO];
  if (!r || !normalizarMLB(r.mlb) || !Object.values(ESTADO).includes(r.estado)) return null;
  return r;
}

/**
 * Registro do Bling de uma ficha PUBLICADA. Se o registro não ficou gravado
 * na ficha (caso do MLB5351282473), ele é refeito a partir da publicação
 * gravada (MLB, conta, produto Bling, SKU) — sem inventar nada: sem MLB,
 * sem loja Bling da conta ou sem produto Bling, não há registro.
 * O estado refeito é sempre "aguardando" até a leitura no Bling confirmar.
 */
export function registroDaFichaOuPublicacao(dadosConferencia, publicacao) {
  const salvo = registroDaFicha(dadosConferencia);
  if (salvo) return salvo;
  const p = publicacao || {};
  const mlb = normalizarMLB(p.mlb_id);
  const loja = lojaBlingDaConta(p.ml_user_id);
  if (!mlb || !loja || !txt(p.bling_produto_id)) return null;
  return {
    ...registroPublicado({
      mlb,
      contaId: p.ml_user_id,
      contaNome: p.conta_nome || "",
      skuOficial: p.sku || "",
      produtoBlingId: p.bling_produto_id,
      preco: null,
      agora: p.publicado_em || new Date().toISOString(),
    }),
    refeito_da_publicacao: true,
  };
}

/**
 * Regra de integração (pura): na resposta de anuncios_consultar filtrada por
 * loja + produto esperado, tem de existir EXATAMENTE UM anúncio com o MLB
 * publicado e com produto.id = produto esperado.
 */
export function avaliarPorProduto(reg, resposta) {
  const r = resposta || {};
  if (!r.ok) return { estado: ESTADO.ERRO_CONSULTA, mensagem: r.erro ? `${TEXTO_ESTADO[ESTADO.ERRO_CONSULTA]} (${r.erro})` : TEXTO_ESTADO[ESTADO.ERRO_CONSULTA] };
  if (String(r.id_loja ?? "") !== String(reg.bling_loja_id)) return { estado: ESTADO.ERRO_CONSULTA, mensagem: "Consulta feita em outra loja: não confirmado." };
  const mlb = normalizarMLB(reg.mlb);
  const iguais = (r.anuncios || []).filter((a) => normalizarMLB(a?.mlb) === mlb);
  const certos = iguais.filter((a) => String(a?.produto_id ?? "") === String(reg.bling_produto_id));
  if (certos.length === 1 && iguais.length === 1) return { estado: ESTADO.INTEGRADO, mensagem: TEXTO_ESTADO[ESTADO.INTEGRADO], bling_anuncio_id: certos[0].id_anuncio ?? null };
  if (iguais.length > 1) return { estado: ESTADO.ERRO_CONSULTA, mensagem: `O MLB aparece ${iguais.length} vezes no Bling: confira na Gestão de Anúncios.` };
  if (iguais.length === 1) return { estado: ESTADO.PRODUTO_INCORRETO, mensagem: TEXTO_ESTADO[ESTADO.PRODUTO_INCORRETO], produto_encontrado_id: iguais[0].produto_id ?? null, bling_anuncio_id: iguais[0].id_anuncio ?? null };
  return null; // não está ligado ao produto esperado (talvez ainda não importado)
}

/** MLB exatamente igual ("MLB" + mesmos dígitos; MLB123 ≠ MLB1234). */
export function mesmoMLB(a, b) {
  const x = normalizarMLB(a);
  return x !== "" && x === normalizarMLB(b);
}

/**
 * Conferência (só leitura). consultar(corpo) → resposta da função bling-integracao.
 * completa=true (botão "Já trouxe — verificar agora") também procura o MLB na
 * listagem da loja para detectar produto errado; a verificação automática
 * periódica usa só a consulta por produto (mais leve).
 */
export async function conferirIntegracao({ registro, consultar, completa = false, agora = () => new Date().toISOString() }) {
  const reg = { ...(registro || {}) };
  if (!precisaConferir(reg)) return { registro: reg, chamadas: [] };
  const chamadas = [];
  const chamar = async (corpo) => {
    chamadas.push(corpo);
    try { return await consultar(corpo); } catch (e) { return { ok: false, erro: String(e?.message || e).slice(0, 150) }; }
  };
  const fim = (parcial) => ({ registro: { ...reg, ...parcial, verificado_em: agora(), tentativas: Number(reg.tentativas || 0) + 1 }, chamadas });

  const esperado = { produto_id: reg.bling_produto_id, loja_id: reg.bling_loja_id, mlb: reg.mlb };
  const r1 = await chamar({ acao: ACAO_LEITURA, id_loja: String(reg.bling_loja_id), id_produto: String(reg.bling_produto_id), esperado });
  const a1 = avaliarPorProduto(reg, r1);
  if (a1) return fim(a1);
  if (!completa) return fim({ estado: ESTADO.AGUARDANDO, mensagem: "Ainda não apareceu no Bling." });

  // Verificação completa: busca PAGINADA do MLB exato na loja (só esta loja,
  // só Mercado Livre; o servidor para na 1ª ocorrência). Diz se ainda não
  // foi trazido ou se foi trazido ligado a OUTRO produto.
  const r2 = await chamar({ acao: ACAO_BUSCA_MLB, id_loja: String(reg.bling_loja_id), mlb: normalizarMLB(reg.mlb) });
  if (!r2?.ok) return fim({ estado: ESTADO.ERRO_CONSULTA, mensagem: r2?.erro ? `${TEXTO_ESTADO[ESTADO.ERRO_CONSULTA]} (${r2.erro})` : TEXTO_ESTADO[ESTADO.ERRO_CONSULTA] });
  if (String(r2.id_loja ?? "") !== String(reg.bling_loja_id)) return fim({ estado: ESTADO.ERRO_CONSULTA, mensagem: "Consulta feita em outra loja: não confirmado." });
  if (!r2.encontrado) return fim({ estado: ESTADO.AGUARDANDO, mensagem: "Ainda não apareceu no Bling." });
  const det = r2.anuncio || null;
  if (!det || !mesmoMLB(det.mlb, reg.mlb)) return fim({ estado: ESTADO.ERRO_CONSULTA, mensagem: TEXTO_ESTADO[ESTADO.ERRO_CONSULTA] });
  if (String(det.produto_id ?? "") === String(reg.bling_produto_id)) {
    return fim({ estado: ESTADO.INTEGRADO, mensagem: TEXTO_ESTADO[ESTADO.INTEGRADO], bling_anuncio_id: det.id_anuncio ?? null });
  }
  return fim({ estado: ESTADO.PRODUTO_INCORRETO, mensagem: TEXTO_ESTADO[ESTADO.PRODUTO_INCORRETO], produto_encontrado_id: det.produto_id ?? null, bling_anuncio_id: det.id_anuncio ?? null });
}
