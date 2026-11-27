// (26/11/2026) PAIIA PARCEIROS — PILOTO, SÓ NO STAGING.
// Regras fixas do piloto (pedido do Edgar):
//  * aparece só no ambiente de teste (STAGING); na produção nada muda;
//  * dados fictícios, mensalidade fictícia de R$ 199,90 e NENHUMA cobrança;
//  * (27/11) modelo simplificado: o PAIIA é pesquisa técnica + aproximação; o comprador
//    fala DIRETO com o fornecedor (WhatsApp, telefone, e-mail, site). Sem pedidos,
//    pagamentos ou cotação interna — o código da cotação fica guardado, desligado;
//  * o catálogo do parceiro fica separado: nunca muda a ordem nem o conteúdo
//    dos resultados técnicos (nenhuma empresa compra prioridade);
//  * qualquer segmento automotivo, sem preferência de linha.

export const MENSALIDADE_FICTICIA_CENTAVOS = 19990;

// (27/11) Cotação interna e pedidos FORA da interface (decisão do Edgar). O código continua
// no projeto para uso futuro: basta ligar esta chave (e revisar com ele antes).
export const COTACAO_INTERNA_ATIVA = false;

// Todas as linhas automotivas, sem preferência. O parceiro marca as suas e pode acrescentar outras.
export const SEGMENTOS_AUTOMOTIVOS = [
  "Linha leve", "Linha pesada", "Utilitários", "Motos", "Agrícola", "Máquinas e linha amarela", "Náutica",
  "Injeção eletrônica", "Ignição", "Elétrica", "Diesel", "Arrefecimento", "Ar-condicionado", "Motor",
  "Suspensão e direção", "Freios", "Transmissão e embreagem", "Escapamento", "Filtros", "Lubrificantes",
  "Funilaria e carroceria", "Vidros e iluminação", "Acessórios", "Pneus e rodas", "Ferramentas e equipamentos",
];

/** Validação técnica automática dos itens enviados (calculada no banco). */
export const NIVEIS_VALIDACAO = {
  sem_divergencia: { rotulo: "Sem divergências identificadas", icone: "✅", cor: "#34d399" },
  conferir: { rotulo: "Necessita conferência", icone: "⚠️", cor: "#fbbf24" },
  conflito: { rotulo: "Conflito identificado", icone: "⛔", cor: "#f87171" },
};

/** Conta os itens por nível de validação (só os pendentes, se pedido). */
export function resumoValidacao(itens = [], validacao = new Map(), { somentePendentes = false } = {}) {
  const r = { sem_divergencia: 0, conferir: 0, conflito: 0 };
  for (const i of itens) {
    if (somentePendentes && i.situacao_tecnica !== "pendente") continue;
    const nivel = validacao.get(i.id)?.nivel || "sem_divergencia";
    r[nivel] = (r[nivel] || 0) + 1;
  }
  return r;
}

/** Termo com palavra de 3+ letras (ex.: "bomba gol") também procura em descrição e aplicação. */
export function termoParaTexto(termo) {
  const t = String(termo ?? "").trim();
  return /(^|\s)[A-Za-zÀ-ú]{3,}(\s|$)/.test(t) ? t.slice(0, 80) : "";
}

export function linkTelefone(numero) {
  const d = numeroBrasil(numero);
  return d ? `tel:+${d}` : "";
}

export function linkEmail(email) {
  const e = String(email || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? `mailto:${e}` : "";
}

export function linkSite(site) {
  const s = String(site || "").trim();
  if (!s || /\s/.test(s)) return "";
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

export const TIPOS_EMPRESA = [
  { id: "fabricante", rotulo: "Fabricante" },
  { id: "importador", rotulo: "Importador" },
  { id: "distribuidor", rotulo: "Distribuidor" },
  { id: "prestador_servicos", rotulo: "Prestador de serviços" },
  { id: "locadora_equipamentos", rotulo: "Locação de equipamentos" },
];

// "ativa" = já funciona no piloto; as outras ficam previstas (aparecem como "em breve").
export const MODALIDADES = [
  { id: "consulta_catalogo", rotulo: "Consulta de catálogo", ativa: true },
  { id: "cotacao", rotulo: "Solicitação de cotação", ativa: true },
  { id: "venda", rotulo: "Venda", ativa: false },
  { id: "compra", rotulo: "Compra", ativa: false },
  { id: "servicos", rotulo: "Serviços", ativa: false },
  { id: "locacao_equipamentos", rotulo: "Locação de equipamentos", ativa: false },
];

export const SITUACOES = [
  { id: "em_analise", rotulo: "Em análise", cor: "#fbbf24" },
  { id: "aprovado", rotulo: "Aprovado (aguardando início)", cor: "#60a5fa" },
  { id: "ativo", rotulo: "Ativo", cor: "#34d399" },
  { id: "suspenso", rotulo: "Suspenso", cor: "#f97316" },
  { id: "encerrado", rotulo: "Encerrado", cor: "#94a3b8" },
  { id: "recusado", rotulo: "Recusado", cor: "#f87171" },
];

// Seleção criteriosa: os 6 critérios do planejamento.
export const CRITERIOS_SELECAO = [
  { id: "reputacao", rotulo: "Reputação no mercado" },
  { id: "qualidade", rotulo: "Qualidade e procedência dos produtos" },
  { id: "catalogo_confiavel", rotulo: "Confiabilidade dos catálogos" },
  { id: "capacidade_fornecimento", rotulo: "Capacidade de fornecimento" },
  { id: "atendimento", rotulo: "Atendimento comercial" },
  { id: "atualizacao_tecnica", rotulo: "Atualização das informações técnicas" },
];

// (27/11) PUBLICAÇÃO: a área só aparece na produção quando esta chave virar true —
// e só depois de aplicar no banco oficial supabase/producao-parceiros/01_parceiros_producao.sql.
// Enquanto for false, a produção continua exatamente como hoje.
export const PARCEIROS_NA_PRODUCAO = true;

export function pilotoParceirosAtivo(ambiente, naProducao = PARCEIROS_NA_PRODUCAO) {
  return ambiente === "staging" || (ambiente === "producao" && naProducao === true);
}

// Textos de teste ("PILOTO", "simulação", "fictício") só aparecem fora da produção.
export function modoTesteParceiros(ambiente) {
  return ambiente !== "producao";
}

export function normalizarCodigoParceiro(valor) {
  return String(valor ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function formatarMensalidade(centavos = MENSALIDADE_FICTICIA_CENTAVOS) {
  const reais = (Number(centavos) || 0) / 100;
  return reais.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function rotuloDe(lista, id) {
  return lista.find((x) => x.id === id)?.rotulo || id || "";
}

/** Para aprovar/ativar: os 6 critérios marcados e a empresa autorizou a integração do catálogo. */
export function pendenciasAprovacao(parceiro = {}) {
  // (27/11) Os critérios ficam no controle administrativo (só o administrador lê).
  const criterios = parceiro.controle?.criterios || parceiro.criterios || {};
  const faltam = CRITERIOS_SELECAO.filter((c) => !criterios[c.id]).map((c) => c.rotulo);
  if (!parceiro.catalogo_autorizado) faltam.push("Autorização da empresa para integrar o catálogo");
  if (!String(parceiro.nome_fantasia || "").trim()) faltam.push("Nome da empresa");
  return faltam;
}

/**
 * Só parceiro ATIVO e dentro da vigência aparece nas pesquisas. O banco garante isso
 * e também não deixa ativar sem os 6 critérios; aqui é só a mesma regra na tela.
 */
export function parceiroVisivel(parceiro = {}, hoje = new Date()) {
  if (parceiro.situacao !== "ativo") return false;
  const dia = hoje.toISOString().slice(0, 10);
  const c = parceiro.contrato || parceiro;
  if (c.vigencia_inicio && dia < c.vigencia_inicio) return false;
  if (c.vigencia_fim && dia > c.vigencia_fim) return false;
  return true;
}

/** Perfil de quem está usando: administrador, parceiro (dono de um cadastro) ou usuário comum. */
export function perfilParaParceiro(papel, parceiroId) {
  if (papel?.admin) return "admin";
  if (parceiroId && (papel?.parceiros || []).includes(parceiroId)) return "parceiro";
  return "usuario";
}

export function rotuloPerfil(papel) {
  if (papel?.admin) return "Administrador";
  if (papel?.parceiros?.length) return "Parceiro comercial";
  return "Usuário";
}

export const SITUACOES_TECNICAS = {
  pendente: { rotulo: "Aguardando aprovação técnica", cor: "#fbbf24" },
  aprovado: { rotulo: "Aprovado", cor: "#34d399" },
  recusado: { rotulo: "Recusado", cor: "#f87171" },
  sem_envio: { rotulo: "Nenhum arquivo enviado", cor: "#94a3b8" },
};

/** Lista colada pelo parceiro: uma linha por item, campos separados por ; ou tab. */
export function lerListaDeItens(texto = "") {
  return String(texto)
    .split(/\r?\n/)
    .map((linha) => linha.split(/[;\t]/).map((s) => s.trim()))
    .filter((c) => c[0] && !/^c[oó]digo$/i.test(c[0]))
    .map(([codigo, descricao = "", marca = "", segmento = "", aplicacao = "", equivalencias = ""]) => {
      const item = { codigo, descricao, marca, segmento };
      if (aplicacao) item.aplicacao = aplicacao;
      if (equivalencias) item.equivalencias = equivalencias.split(/[,/|]+/).map((s) => s.trim()).filter(Boolean);
      return item;
    })
    .slice(0, 500);
}

/** Códigos usados para procurar nos catálogos dos parceiros: o digitado + os códigos técnicos achados. */
export function codigosParaParceiros(termo, resultadosTecnicos = []) {
  const codigos = new Set();
  const n = normalizarCodigoParceiro(termo);
  if (n.length >= 3) codigos.add(n);
  for (const r of resultadosTecnicos || []) {
    const c = normalizarCodigoParceiro(r?.codigo_oem);
    if (c.length >= 3) codigos.add(c);
  }
  return [...codigos].slice(0, 60);
}

/**
 * Junta itens dos parceiros por empresa. Ordem NEUTRA (alfabética pelo nome):
 * mensalidade ou qualquer outro fator comercial não muda a ordem.
 */
export function agruparItensPorParceiro(itens = [], parceiros = [], hoje = new Date()) {
  const porId = new Map(parceiros.filter((p) => parceiroVisivel(p, hoje)).map((p) => [p.id, p]));
  const grupos = new Map();
  for (const item of itens) {
    const parceiro = porId.get(item.parceiro_id);
    if (!parceiro || item.disponivel === false) continue;
    if (!grupos.has(parceiro.id)) grupos.set(parceiro.id, { parceiro, itens: [] });
    grupos.get(parceiro.id).itens.push(item);
  }
  return [...grupos.values()].sort((a, b) =>
    String(a.parceiro.nome_fantasia).localeCompare(String(b.parceiro.nome_fantasia), "pt-BR")
  );
}

/** Número brasileiro plausível (DDD 11-99, 10-11 dígitos); fictícios como "(00) ..." não viram link. */
function numeroBrasil(numero) {
  let d = String(numero || "").replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
  if (d.length < 10 || d.length > 11 || /^0/.test(d) || /^(\d)\1+$/.test(d)) return "";
  return `55${d}`;
}

export function linkWhatsapp(numero) {
  const d = numeroBrasil(numero);
  return d ? `https://wa.me/${d}` : "";
}

export function parceiroEmBranco() {
  return {
    nome_fantasia: "",
    razao_social: "",
    documento: "",
    tipo_empresa: "distribuidor",
    segmentos: [],
    marcas: [],
    apresentacao: "",
    logotipo_url: "",
    site: "",
    whatsapp: "",
    telefone: "",
    email_comercial: "",
    contatos: [],
    catalogo_tipo: "itens_paiia",
    catalogo_url: "",
    catalogo_autorizado: false,
    modalidades: ["consulta_catalogo", "cotacao"],
    situacao: "em_analise",
    controle: { criterios: {}, observacoes_admin: "" },
    contrato: contratoEmBranco(),
  };
}

/* ------------------------------------------------------------------ */
/* (27/11) Contatos individuais, contrato, experiência e vencimento    */
/* ------------------------------------------------------------------ */

export const FUNCOES_CONTATO = ["Vendedor", "Representante", "Compras", "Comercial", "Financeiro", "Outro"];

export function contatoEmBranco() {
  return { nome: "", funcao: "Vendedor", regiao: "", telefone: "", email: "" };
}

/** Só guarda contatos com nome; limpa espaços. */
export function limparContatos(contatos = []) {
  return (contatos || [])
    .map((c) => ({
      nome: String(c?.nome || "").trim(),
      funcao: String(c?.funcao || "").trim(),
      regiao: String(c?.regiao || "").trim(),
      telefone: String(c?.telefone || "").trim(),
      email: String(c?.email || "").trim(),
    }))
    .filter((c) => c.nome)
    .slice(0, 50);
}

export function hojeISO(hoje = new Date()) {
  const d = new Date(hoje.getTime() - hoje.getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 10);
}

export function somarDias(dataISO, dias) {
  if (!dataISO) return "";
  const d = new Date(`${dataISO}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + (Number(dias) || 0));
  return d.toISOString().slice(0, 10);
}

/** Fim do período: início + N meses − 1 dia (ex.: 01/12/2026 + 12 meses = 30/11/2027). */
export function fimDoPeriodo(inicioISO, meses) {
  if (!inicioISO) return "";
  const d = new Date(`${inicioISO}T12:00:00Z`);
  const dia = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + (Number(meses) || 0));
  const ultimo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(dia, ultimo));
  return somarDias(d.toISOString().slice(0, 10), -1);
}

export function contratoEmBranco(hoje = new Date()) {
  const inicio = hojeISO(hoje);
  return {
    mensalidade_centavos: MENSALIDADE_FICTICIA_CENTAVOS,
    experiencia_dias: 30,
    periodo_meses: 12,
    vigencia_inicio: inicio,
    vigencia_fim: fimDoPeriodo(inicio, 12),
    renovacao_automatica: false,
    suspensao_motivo: "",
  };
}

/** Situação do contrato para mostrar ao administrador e ao próprio parceiro. */
export function situacaoContrato(contrato, hoje = new Date()) {
  if (!contrato) return { tipo: "sem_contrato", rotulo: "Sem contrato", cor: "#94a3b8" };
  const dia = hojeISO(hoje);
  const { vigencia_inicio: ini, vigencia_fim: fim } = contrato;
  if (ini && dia < ini) return { tipo: "futuro", rotulo: `Começa em ${dataCurta(ini)}`, cor: "#60a5fa" };
  if (fim && dia > fim) {
    return contrato.renovacao_automatica
      ? { tipo: "renovar", rotulo: `Venceu em ${dataCurta(fim)} — será renovado`, cor: "#60a5fa" }
      : { tipo: "vencido", rotulo: `Vencido em ${dataCurta(fim)} — suspensão automática`, cor: "#f87171" };
  }
  const fimExperiencia = ini && Number(contrato.experiencia_dias) > 0 ? somarDias(ini, Number(contrato.experiencia_dias) - 1) : "";
  if (fimExperiencia && dia <= fimExperiencia) {
    return { tipo: "experiencia", rotulo: `Experiência gratuita até ${dataCurta(fimExperiencia)}`, cor: "#34d399" };
  }
  if (fim) {
    const dias = Math.round((new Date(`${fim}T12:00:00Z`) - new Date(`${dia}T12:00:00Z`)) / 86400000);
    if (dias <= 30) {
      return {
        tipo: "vencendo",
        rotulo: `Vence em ${dias} dia(s) — ${contrato.renovacao_automatica ? "renovação automática" : "sem renovação automática"}`,
        cor: "#fbbf24",
      };
    }
    return { tipo: "vigente", rotulo: `Vigente até ${dataCurta(fim)}`, cor: "#34d399" };
  }
  return { tipo: "vigente", rotulo: "Vigente (sem data de fim)", cor: "#34d399" };
}

export function dataCurta(valor) {
  if (!valor) return "";
  const [a, m, d] = String(valor).slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

/** Valor digitado em reais ("1.299,90", "199.9", "250") para centavos. */
export function reaisParaCentavos(texto) {
  let s = String(texto ?? "").trim().replace(/[^\d,.]/g, "");
  if (!s) return 0;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : 0;
}

// Limite por arquivo de catálogo. O plano atual do Supabase aceita até 50 MB por arquivo
// (testado em 27/11: 35 MB passou, 60 MB recusado com 413). A pasta do catálogo já aceita
// 200 MB: se o plano for ampliado, basta subir este número.
export const LIMITE_CATALOGO_BYTES = 50 * 1024 * 1024;
