/*
 * Peso, medidas e validação logística dos anúncios NOVOS do Mercado Livre.
 *
 * Hierarquia oficial (30/09/2026): MEDIDO E VALIDADO > CONFIRMADO PELO USUÁRIO >
 * REFERÊNCIA DO MARKETPLACE > PADRÃO PAIIA > NÃO VALIDADO. A medida própria do
 * usuário sempre vale mais que o padrão compartilhado. Referência do marketplace
 * (limites, média da categoria, simulação) nunca é medida do produto. Bling e
 * embalagem de anúncio antigo: NÃO VALIDADO, só comparação.
 *
 * Regras fixas:
 *   - nunca inventar peso ou dimensões;
 *   - nunca substituir medida validada por média de categoria;
 *   - nunca alterar automaticamente medida informada pelo usuário;
 *   - nunca reduzir medidas para caber no limite do marketplace.
 *
 * Funções puras (sem rede): usadas pela tela e pelos testes.
 */

/*
 * NÍVEIS OFICIAIS DE CONFIANÇA (hierarquia, 30/09/2026).
 * "O usuário confirmou" NÃO é "o PAIIA comprovou": MEDIDO_E_VALIDADO exige um
 * processo de validação definido pelo PAIIA (ainda não existe). O navegador
 * nunca promove nível; só o servidor, e por enquanto só até CONFIRMADO_PELO_USUARIO.
 */
export const NIVEL = {
  MEDIDO_E_VALIDADO: "MEDIDO_E_VALIDADO",
  CONFIRMADO_PELO_USUARIO: "CONFIRMADO_PELO_USUARIO",
  REFERENCIA_MARKETPLACE: "REFERENCIA_MARKETPLACE",
  PADRAO_PAIIA: "PADRAO_PAIIA",
  NAO_VALIDADO: "NAO_VALIDADO",
};

export const ORDEM_NIVEL = [
  NIVEL.MEDIDO_E_VALIDADO,
  NIVEL.CONFIRMADO_PELO_USUARIO,
  NIVEL.REFERENCIA_MARKETPLACE,
  NIVEL.PADRAO_PAIIA,
  NIVEL.NAO_VALIDADO,
];

export const ROTULO_NIVEL = {
  [NIVEL.MEDIDO_E_VALIDADO]: "MEDIDO E VALIDADO",
  [NIVEL.CONFIRMADO_PELO_USUARIO]: "CONFIRMADO PELO USUÁRIO",
  [NIVEL.REFERENCIA_MARKETPLACE]: "REFERÊNCIA DO MARKETPLACE",
  [NIVEL.PADRAO_PAIIA]: "PADRÃO PAIIA",
  [NIVEL.NAO_VALIDADO]: "NÃO VALIDADO",
};

// Só estes níveis podem ir para o marketplace como medida do produto.
export const NIVEIS_ENVIAVEIS = [NIVEL.MEDIDO_E_VALIDADO, NIVEL.CONFIRMADO_PELO_USUARIO];

// Nomes usados antes de 30/09/2026 → nível oficial.
export function normalizarNivel(valor) {
  const v = String(valor || "").toUpperCase();
  if (ORDEM_NIVEL.includes(v)) return v;
  // "VALIDADO" antigo era só a confirmação do usuário (não havia processo do PAIIA).
  if (v === "VALIDADO" || v === "INFORMADO_PELO_USUARIO" || v === "MANUAL") return NIVEL.CONFIRMADO_PELO_USUARIO;
  if (v === "REFERENCIA_ML") return NIVEL.REFERENCIA_MARKETPLACE;
  if (v === "BLING_NAO_VALIDADO" || v === "ESTIMADO") return NIVEL.NAO_VALIDADO;
  return null;
}

// Compatibilidade com o código anterior (mesmos valores dos níveis novos).
export const ORIGEM_MEDIDA = {
  VALIDADO: NIVEL.MEDIDO_E_VALIDADO,
  INFORMADO_USUARIO: NIVEL.CONFIRMADO_PELO_USUARIO,
  REFERENCIA_ML: NIVEL.REFERENCIA_MARKETPLACE,
  BLING_NAO_VALIDADO: NIVEL.NAO_VALIDADO,
};
export const ROTULO_ORIGEM_MEDIDA = ROTULO_NIVEL;
export const ORIGENS_ENVIAVEIS = NIVEIS_ENVIAVEIS;

/* CONFIGURAÇÃO DE EMBALAGEM — a chave da base é SKU + configuração. Lista
 * fechada (sem texto livre, para não levar informação da conta). */
export const TIPOS_EMBALAGEM = [
  { id: "caixa_padrao", rotulo: "Caixa padrão / embalagem leve" },
  { id: "caixa_reforcada", rotulo: "Embalagem reforçada" },
  { id: "caixa_fabricante", rotulo: "Caixa do fabricante" },
  { id: "envelope", rotulo: "Envelope / saco" },
  { id: "tubo", rotulo: "Tubo" },
  { id: "kit_multiplo", rotulo: "Kit / várias peças na mesma caixa" },
  { id: "outra", rotulo: "Outra" },
];
export const CONFIG_EMBALAGEM_PADRAO = "caixa_padrao";
export function rotuloEmbalagem(id) {
  return TIPOS_EMBALAGEM.find((t) => t.id === id)?.rotulo || id || "—";
}

/* Tolerâncias de agrupamento: HIPÓTESE INICIAL, configurável (tabela
 * logistica_tolerancias). Não é regra universal nem promove nível sozinha. */
export const TOLERANCIA_HIPOTESE = { lado_max_dif_cm: 1, peso_max_dif_pct: 10, hipotese: true };

export const AVISO_PERMANENTE =
  "⚠️ Confira peso e dimensões da embalagem pronta para envio. O Mercado Livre pode calcular o frete considerando peso e volume. Informações incorretas podem aumentar o custo do frete ou impedir o envio.";

export const AVISO_FORA_DO_LIMITE = "⚠️ EMBALAGEM FORA DO LIMITE DE ENVIO";

// Divisor do peso cúbico observado na simulação oficial do ML
// (/users/{id}/shipping_options/free → billable_weight): C × L × A (cm) ÷ 6.000 = kg.
export const DIVISOR_CUBICO = 6000;

/*
 * Limites por modalidade — Central de Ajuda do Mercado Livre,
 * "Como o custo de envio é calculado por medidas e peso"
 * (mercadolivre.com.br/ajuda/3163), consultada em 30/09/2026.
 * A API não informa mínimos nem bloqueia valores acima do máximo.
 */
export const FONTE_LIMITES = "Central de Ajuda do Mercado Livre — artigo 3163 (consultado em 30/09/2026)";

export const LIMITES_MODALIDADE = {
  correios: {
    nome: "Envios tradicionais (Correios)",
    peso_max_g: 30000,
    soma_max_cm: 200,
    lado_max_cm: 100,
  },
  agencia_coleta: {
    nome: "Agências Mercado Livre ou Coleta",
    peso_max_g: 50000,
    soma_max_cm: 300,
    lado_max_cm: 200,
  },
  full: {
    nome: "Centro de distribuição (Full)",
    peso_max_g: 25000,
    soma_max_cm: 260,
    lado_max_cm: 120,
  },
};

// logistic_type do ML → grupo de limites da documentação.
export const MODALIDADES = {
  drop_off: { rotulo: "Mercado Envios — Correios (drop_off)", limites: "correios" },
  xd_drop_off: { rotulo: "Mercado Envios — Agências Mercado Livre (xd_drop_off)", limites: "agencia_coleta" },
  cross_docking: { rotulo: "Mercado Envios — Coleta (cross_docking)", limites: "agencia_coleta" },
  fulfillment: { rotulo: "Mercado Envios Full (fulfillment)", limites: "full" },
  self_service: { rotulo: "Mercado Envios Flex (self_service)", limites: null },
};

export function numeroPositivo(valor) {
  if (valor === null || valor === undefined) return 0;
  const t = String(valor).trim().replace(/\s/g, "");
  if (!t) return 0;
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/* Normaliza { peso_g, comprimento_cm, largura_cm, altura_cm } sem arredondar
 * nem alterar o que o usuário digitou (só converte texto em número). */
export function normalizarMedida(m) {
  if (!m) return null;
  return {
    peso_g: numeroPositivo(m.peso_g),
    comprimento_cm: numeroPositivo(m.comprimento_cm),
    largura_cm: numeroPositivo(m.largura_cm),
    altura_cm: numeroPositivo(m.altura_cm),
  };
}

export function medidaCompleta(m) {
  const n = normalizarMedida(m);
  return Boolean(n && n.peso_g && n.comprimento_cm && n.largura_cm && n.altura_cm);
}

export function pesoCubicoG(m) {
  const n = normalizarMedida(m);
  if (!n || !n.comprimento_cm || !n.largura_cm || !n.altura_cm) return 0;
  return Math.round(((n.comprimento_cm * n.largura_cm * n.altura_cm) / DIVISOR_CUBICO) * 1000);
}

// Peso que o ML considera: o maior entre o físico e o cúbico.
export function pesoConsideradoG(m) {
  const n = normalizarMedida(m);
  if (!n) return 0;
  return Math.max(n.peso_g || 0, pesoCubicoG(n));
}

export function formatarPeso(g) {
  const n = Number(g) || 0;
  if (!n) return "—";
  return n >= 1000
    ? `${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} kg`
    : `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} g`;
}

export function formatarDimensoes(m) {
  const n = normalizarMedida(m);
  if (!n || !n.comprimento_cm || !n.largura_cm || !n.altura_cm) return "—";
  const f = (v) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  return `${f(n.comprimento_cm)} × ${f(n.largura_cm)} × ${f(n.altura_cm)} cm`;
}

export function formatarReais(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";
}

// Texto no formato da API de frete: "CxLxA,peso" (cm, gramas inteiros).
export function dimensoesParaApi(m) {
  const n = normalizarMedida(m);
  if (!medidaCompleta(n)) return "";
  const r = (v) => Math.ceil(v); // o ML só aceita inteiros; arredonda PARA CIMA, nunca para baixo
  return `${r(n.comprimento_cm)}x${r(n.largura_cm)}x${r(n.altura_cm)},${r(n.peso_g)}`;
}

export function limitesDaModalidade(logisticType) {
  const mod = MODALIDADES[logisticType];
  if (!mod || !mod.limites) return null;
  return { chave: mod.limites, ...LIMITES_MODALIDADE[mod.limites] };
}

export function rotuloModalidade(logisticType) {
  return MODALIDADES[logisticType]?.rotulo || (logisticType ? `Mercado Envios (${logisticType})` : "não identificada");
}

/*
 * Confere a embalagem contra os limites da modalidade.
 * Retorna { dentro, excedidos: [{ campo, valor, limite, texto }], limites, modalidade }.
 * NÃO altera nem sugere valores menores.
 */
export function validarLimites(m, logisticType) {
  const n = normalizarMedida(m);
  const limites = limitesDaModalidade(logisticType);
  const modalidade = rotuloModalidade(logisticType);
  if (!limites) {
    return {
      dentro: null,
      excedidos: [],
      limites: null,
      modalidade,
      observacao: "Limites desta modalidade não encontrados na documentação consultada.",
    };
  }
  const excedidos = [];
  if (n?.peso_g > limites.peso_max_g) {
    excedidos.push({ campo: "Peso", valor: formatarPeso(n.peso_g), limite: formatarPeso(limites.peso_max_g) });
  }
  const lados = n ? [n.comprimento_cm, n.largura_cm, n.altura_cm] : [];
  const maior = Math.max(0, ...lados);
  if (maior > limites.lado_max_cm) {
    excedidos.push({ campo: "Maior lado", valor: `${maior} cm`, limite: `${limites.lado_max_cm} cm` });
  }
  const soma = lados.reduce((a, b) => a + b, 0);
  if (soma > limites.soma_max_cm) {
    excedidos.push({ campo: "Soma dos lados (C + L + A)", valor: `${soma} cm`, limite: `${limites.soma_max_cm} cm` });
  }
  return {
    dentro: excedidos.length === 0,
    excedidos: excedidos.map((e) => ({ ...e, texto: `${e.campo}: ${e.valor} (limite ${e.limite})` })),
    limites,
    modalidade,
  };
}

/*
 * Escolhe a medida que será enviada ao marketplace, pela hierarquia.
 * propria = medida própria salva do SKU+config ({ medida, nivel }).
 * informado = valores digitados agora na tela.
 * Referência do marketplace, PADRÃO PAIIA e Bling NUNCA são escolhidos sozinhos.
 */
export function escolherMedidaParaEnvio({ propria, informado, validado } = {}) {
  const salva = propria || (validado ? { medida: validado, nivel: NIVEL.CONFIRMADO_PELO_USUARIO } : null);
  if (medidaCompleta(informado)) {
    const igual = salva && mesmaMedida(informado, salva.medida);
    return {
      nivel: igual ? normalizarNivel(salva.nivel) : NIVEL.CONFIRMADO_PELO_USUARIO,
      medida: normalizarMedida(informado),
      recomendado: salva && !igual ? { medida: normalizarMedida(salva.medida), nivel: normalizarNivel(salva.nivel) } : null,
    };
  }
  if (salva && medidaCompleta(salva.medida)) {
    return { nivel: normalizarNivel(salva.nivel), medida: normalizarMedida(salva.medida), recomendado: null };
  }
  return { nivel: null, medida: null, recomendado: null };
}

// Iguais quando peso e lados batem (a ordem dos lados não importa).
export function mesmaMedida(a, b) {
  const x = normalizarMedida(a);
  const y = normalizarMedida(b);
  if (!medidaCompleta(x) || !medidaCompleta(y)) return false;
  const lx = [x.comprimento_cm, x.largura_cm, x.altura_cm].sort((p, q) => p - q);
  const ly = [y.comprimento_cm, y.largura_cm, y.altura_cm].sort((p, q) => p - q);
  return x.peso_g === y.peso_g && lx.every((v, i) => v === ly[i]);
}

/* Mesma configuração física? Usa a tolerância recebida (padrão = hipótese
 * inicial de 1 cm por lado e 10% no peso). Só informa — não troca medida. */
export function mesmaConfiguracaoFisica(a, b, tolerancia = TOLERANCIA_HIPOTESE) {
  const x = normalizarMedida(a);
  const y = normalizarMedida(b);
  if (!medidaCompleta(x) || !medidaCompleta(y)) return false;
  const lado = Number(tolerancia?.lado_max_dif_cm ?? TOLERANCIA_HIPOTESE.lado_max_dif_cm);
  const pct = Number(tolerancia?.peso_max_dif_pct ?? TOLERANCIA_HIPOTESE.peso_max_dif_pct);
  if (Math.abs(x.peso_g - y.peso_g) > (pct / 100) * Math.max(x.peso_g, y.peso_g)) return false;
  const lx = [x.comprimento_cm, x.largura_cm, x.altura_cm].sort((p, q) => p - q);
  const ly = [y.comprimento_cm, y.largura_cm, y.altura_cm].sort((p, q) => p - q);
  return lx.every((v, i) => Math.abs(v - ly[i]) <= lado);
}

/* Divergência entre fontes para o aviso da tela (peso considerado pelo ML
 * > 10% ou lado > 1 cm). Só informa — não troca nenhuma medida. */
export function divergentes(a, b) {
  const x = normalizarMedida(a);
  const y = normalizarMedida(b);
  if (!medidaCompleta(x) || !medidaCompleta(y)) return false;
  const px = pesoConsideradoG(x);
  const py = pesoConsideradoG(y);
  if (Math.abs(px - py) > 0.1 * Math.max(px, py)) return true;
  const lx = [x.comprimento_cm, x.largura_cm, x.altura_cm].sort((p, q) => p - q);
  const ly = [y.comprimento_cm, y.largura_cm, y.altura_cm].sort((p, q) => p - q);
  return lx.some((v, i) => Math.abs(v - ly[i]) > 1);
}

/* Comparação de cenários de frete (atual × proposto). */
export function compararCustos(atual, proposto) {
  const a = Number(atual);
  const p = Number(proposto);
  if (!Number.isFinite(a) || !Number.isFinite(p)) return null;
  const diferenca = Math.round((p - a) * 100) / 100;
  return {
    diferenca,
    tipo: diferenca < 0 ? "economia" : diferenca > 0 ? "aumento" : "igual",
    texto:
      diferenca < 0
        ? `Economia estimada de ${formatarReais(-diferenca)} por envio`
        : diferenca > 0
          ? `Aumento estimado de ${formatarReais(diferenca)} por envio`
          : "Sem diferença no custo estimado",
  };
}

/* Resumo do bloco para a conferência antes de publicar. */
export function conferirLogistica({ medidaEnvio, origem, nivel, validacao, simulacao, confirmado }) {
  const n = normalizarNivel(nivel || origem);
  if (!medidaCompleta(medidaEnvio) || !NIVEIS_ENVIAVEIS.includes(n)) {
    return {
      nivel: "erro",
      texto: "Sem peso e medidas confirmados. Referência do marketplace, PADRÃO PAIIA e Bling não são usados como medida do produto sem a sua confirmação.",
    };
  }
  if (validacao && validacao.dentro === false) {
    return { nivel: "erro", texto: `${AVISO_FORA_DO_LIMITE}: ${validacao.excedidos.map((e) => e.texto).join("; ")}.` };
  }
  if (!simulacao?.ok || simulacao.dimensoes !== dimensoesParaApi(medidaEnvio)) {
    return { nivel: "erro", texto: "Simule o frete no Mercado Livre com a medida atual antes de publicar." };
  }
  if (!confirmado) {
    return { nivel: "erro", texto: "Confirme peso e embalagem (fica registrado no histórico do PAIIA)." };
  }
  return {
    nivel: validacao?.dentro === null ? "aviso" : "ok",
    texto: `${formatarDimensoes(medidaEnvio)}, ${formatarPeso(medidaEnvio.peso_g)} (${ROTULO_NIVEL[n]}). ML considera ${formatarPeso(
      simulacao.peso_considerado_g
    )}; frete estimado ${formatarReais(simulacao.custo_vendedor)}.${validacao?.dentro === null ? ` ${validacao.observacao}` : ""}`,
  };
}

/* ------------------------------------------------------------------
 * BASE COMPARTILHADA (aprovada em 30/09/2026)
 * Visível só com 2+ contribuições independentes e consistentes.
 * Estágios: REFERÊNCIA COMPARTILHADA EM OBSERVAÇÃO | DIVERGENTE.
 * Não é PADRÃO PAIIA (bloqueado). Usar só preenche os campos: vira
 * CONFIRMADO PELO USUÁRIO apenas depois da confirmação explícita.
 * ------------------------------------------------------------------ */
export const ESTAGIO_BASE = {
  EM_OBSERVACAO: "REFERENCIA_COMPARTILHADA_EM_OBSERVACAO",
  DIVERGENTE: "DIVERGENTE",
};
export const ROTULO_ESTAGIO = {
  [ESTAGIO_BASE.EM_OBSERVACAO]: "REFERÊNCIA COMPARTILHADA EM OBSERVAÇÃO",
  [ESTAGIO_BASE.DIVERGENTE]: "DIVERGENTE",
};
export const TEXTO_REFERENCIA_OBSERVACAO = "Referência compartilhada em observação — confira sua embalagem.";
export const TEXTO_DIVERGENTE = "medidas divergentes — confira sua embalagem";
export const TEXTO_SEM_REFERENCIA = "sem referência compartilhada";
export const TEXTO_CONSENTIMENTO =
  "Quando ativado, peso e medidas confirmados poderão contribuir anonimamente para melhorar as referências logísticas do PAIIA. Dados pessoais, comerciais, preços, estoque, vendas e identificação da sua conta não são compartilhados.";

// Medida sugerida pela referência compartilhada (lados do maior para o menor).
// Em DIVERGENTE não existe medida única.
export function medidaDaReferencia(ref) {
  if (!ref || ref.estagio !== ESTAGIO_BASE.EM_OBSERVACAO) return null;
  const m = normalizarMedida(ref);
  return medidaCompleta(m) ? m : null;
}

export function textoFaixa(faixa) {
  if (!faixa) return "—";
  const f = (v) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  return `peso ${f(faixa.peso_g_min)}–${f(faixa.peso_g_max)} g · lados ${f(faixa.maior_lado_cm_min)}–${f(faixa.maior_lado_cm_max)} × ${f(
    faixa.lado_medio_cm_min
  )}–${f(faixa.lado_medio_cm_max)} × ${f(faixa.menor_lado_cm_min)}–${f(faixa.menor_lado_cm_max)} cm`;
}

export function mesAno(data) {
  const d = new Date(String(data || "").slice(0, 10) + "T12:00:00Z");
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR", { month: "short", year: "numeric", timeZone: "UTC" });
}

// Medida própria mais antiga que a validade configurada → "referência antiga".
export function referenciaAntiga(confirmadoEm, validadeMeses = 18, agora = new Date()) {
  const d = new Date(confirmadoEm);
  if (Number.isNaN(d.getTime())) return false;
  const limite = new Date(agora);
  limite.setMonth(limite.getMonth() - Number(validadeMeses || 18));
  return d < limite;
}

// Nível a exibir para a medida que será enviada: só depois de confirmada
// (ou se for igual à medida própria já registrada). Senão, "a confirmar".
export function nivelExibido({ confirmado, propria, medida, nivel }) {
  if (!medidaCompleta(medida)) return null;
  if (confirmado) return nivel || NIVEL.CONFIRMADO_PELO_USUARIO;
  if (propria && mesmaMedida(propria.medida, medida)) return normalizarNivel(propria.nivel);
  return null;
}
