// =============================================================
// PAIIA — Tipo de veículo do anúncio (etapa ⑤ da Conferência).
//
// Regras (07/10/2026):
//  - Opções: "Carro/Caminhonete" e "Linha Pesada" (nunca "Linha Leve").
//  - O PAIIA SUGERE pela categoria ML e pelas aplicações confirmadas.
//  - A sugestão nunca trava o campo: o usuário pode trocar SEMPRE.
//  - Escolha manual fica salva na ficha (origem "manual") e não é mais
//    sobrescrita por sugestão alguma durante o fluxo.
//  - A Publicação envia EXATAMENTE o tipo confirmado na ficha; se a
//    categoria do ML não aceitar esse tipo, bloqueia (não troca sozinho).
//  - Depois de publicar, o MLB relido é comparado com o tipo da ficha.
// Funções puras, sem rede.
// =============================================================

export const TIPO_CARRO = "Carro/Caminhonete";
export const TIPO_PESADA = "Linha Pesada";
export const OPCOES_TIPO_VEICULO = Object.freeze([TIPO_CARRO, TIPO_PESADA]);

export const ORIGEM_MANUAL = "manual";
export const ORIGEM_SUGESTAO = "sugestao";

const semAcento = (v) => String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const chave = (v) => semAcento(v).replace(/[^a-z]/g, "");

/**
 * Uma das duas opções, na grafia oficial, ou "".
 * Aceita "Carro / Caminhonete", "carro/caminhonete", "LINHA PESADA".
 * "Linha Leve", "Moto/Quadriciclo" e qualquer outro texto → "" (não adivinha).
 */
export function normalizarTipoVeiculo(v) {
  const k = chave(typeof v === "object" && v ? v.value_name || v.nome || v.name || "" : v);
  if (!k) return "";
  if (k === "carrocaminhonete" || k === "carroscaminhonetes" || k === "carroecaminhonete" || k === "carrosecaminhonetes") return TIPO_CARRO;
  if (k === "linhapesada") return TIPO_PESADA;
  return "";
}

// ---------- sugestão ----------

const MONTADORAS_CARRO = new Set([
  "chevrolet", "gm", "fiat", "ford", "volkswagen", "vw", "renault", "peugeot", "citroen", "toyota", "honda",
  "hyundai", "kia", "nissan", "mitsubishi", "jeep", "chery", "caoa chery", "suzuki", "subaru", "audi", "bmw",
  "land rover", "jac", "lifan", "byd", "gwm", "mini", "porsche", "dodge", "ram", "chrysler", "smart", "ssangyong",
  "volvo", "mercedes-benz", "mercedes benz", "mercedes", "troller", "effa", "geely", "lexus", "jaguar",
]);
// Montadoras que só fabricam linha pesada (caminhão/ônibus).
const MONTADORAS_PESADA = new Set(["scania", "daf", "man", "agrale", "international", "navistar", "marcopolo", "caio", "busscar", "foton caminhoes", "sinotruk", "shacman", "kenworth", "peterbilt", "freightliner"]);
const MODELO_PESADA = /caminh[aã]o|caminhoes|caminhões|[oô]nibus|micro[- ]?[oô]nibus|\bbus\b|cavalo mec|constellation|\batego\b|\baxor\b|\bactros\b|\baccelo\b|\btector\b|\bstralis\b|\btrakker\b|\bvm ?\d{3}\b|\bfh ?\d{2}\b|\bfm ?\d{2}\b|\bvolksbus\b|\bcargo \d{3,4}\b|\bf-?\d{4}\b/i;
const MODELO_FORA = /\bmoto\b|motocicleta|quadriciclo|trator|n[aá]utic|barco|jet ?ski/i;

/**
 * Sugestão pelas aplicações confirmadas: "Carro/Caminhonete", "Linha Pesada" ou "".
 * Só sugere quando TODAS as aplicações apontam para o mesmo tipo.
 */
export function sugestaoPorAplicacoes(aplicacoes = []) {
  const lista = (Array.isArray(aplicacoes) ? aplicacoes : []).filter((a) => a && (a.montadora || a.modelo));
  if (!lista.length) return "";
  const tipos = new Set();
  for (const a of lista) {
    const mont = semAcento(a.montadora).trim();
    const texto = `${a.modelo || ""} ${a.motor || ""} ${a.versao || ""}`;
    if (MODELO_FORA.test(texto)) return "";
    if (MONTADORAS_PESADA.has(mont) || MODELO_PESADA.test(texto)) tipos.add(TIPO_PESADA);
    else if (MONTADORAS_CARRO.has(mont)) tipos.add(TIPO_CARRO);
    else return ""; // montadora desconhecida: não sugere
  }
  return tipos.size === 1 ? [...tipos][0] : "";
}

/**
 * Sugestão pela categoria do ML (resultado de tipoVeiculoDaCategoria):
 * a categoria com UM tipo entre as duas opções → esse tipo.
 */
export function sugestaoPorCategoria(infoCategoria) {
  if (!infoCategoria?.existe) return "";
  const tipos = [...new Set((infoCategoria.valores || []).map((v) => normalizarTipoVeiculo(v?.nome ?? v?.name)).filter(Boolean))];
  return tipos.length === 1 ? tipos[0] : "";
}

/**
 * Sugestão final. Categoria e aplicações: se as duas existirem e divergirem,
 * vale a da categoria (é o que o ML aceita) e o aviso explica a divergência.
 * Devolve { valor, origem: "categoria"|"aplicacoes"|"", divergencia: bool }.
 */
export function sugerirTipoVeiculo({ infoCategoria = null, aplicacoes = [] } = {}) {
  const cat = sugestaoPorCategoria(infoCategoria);
  const apl = sugestaoPorAplicacoes(aplicacoes);
  if (cat) return { valor: cat, origem: "categoria", divergencia: Boolean(apl && apl !== cat), aplicacoes: apl };
  if (apl) return { valor: apl, origem: "aplicacoes", divergencia: false, aplicacoes: apl };
  return { valor: "", origem: "", divergencia: false, aplicacoes: "" };
}

/**
 * O que fazer com o campo quando chega uma sugestão.
 *  - origem "manual": NUNCA muda (escolha do usuário).
 *  - sem sugestão: mantém o atual.
 *  - senão: aplica a sugestão (origem "sugestao").
 * Devolve { valor, origem, mudou }.
 */
export function aplicarSugestaoTipoVeiculo({ atual = "", origem = "", sugestao = "" } = {}) {
  if (origem === ORIGEM_MANUAL) return { valor: atual, origem, mudou: false };
  const s = normalizarTipoVeiculo(sugestao);
  if (!s) return { valor: atual, origem, mudou: false };
  if (s === atual && origem === ORIGEM_SUGESTAO) return { valor: atual, origem, mudou: false };
  return { valor: s, origem: ORIGEM_SUGESTAO, mudou: s !== atual || origem !== ORIGEM_SUGESTAO };
}

/** Escolha feita pelo usuário no dropdown. */
export function escolherTipoVeiculo(valor) {
  const v = normalizarTipoVeiculo(valor);
  return { valor: v, origem: v ? ORIGEM_MANUAL : "" };
}

// ---------- categoria × tipo escolhido ----------

/**
 * O tipo da ficha cabe na categoria do ML?
 * infoCategoria: { existe, valores:[{id,nome}] } (null = ainda não lida).
 * Devolve { estado, valor?, aceitos[], texto }:
 *   "sem_tipo"      — ficha sem tipo válido
 *   "nao_lida"      — categoria ainda não conferida
 *   "nao_se_aplica" — a categoria não tem o campo (não é enviado)
 *   "ok"            — valor {id,nome} da categoria para enviar
 *   "incompativel"  — a categoria não aceita esse tipo (bloqueia; não troca)
 */
export function tipoVeiculoNaCategoria(tipoFicha, infoCategoria) {
  const tipo = normalizarTipoVeiculo(tipoFicha);
  const valores = Array.isArray(infoCategoria?.valores) ? infoCategoria.valores : [];
  const aceitos = valores.map((v) => String(v?.nome ?? v?.name ?? "")).filter(Boolean);
  if (!infoCategoria) return { estado: tipo ? "nao_lida" : "sem_tipo", valor: null, aceitos, texto: "" };
  if (infoCategoria.existe === false) {
    return { estado: "nao_se_aplica", valor: null, aceitos, texto: "Esta categoria do Mercado Livre não tem Tipo de veículo: fica salvo na ficha, mas não é enviado." };
  }
  if (!tipo) return { estado: "sem_tipo", valor: null, aceitos, texto: "Escolha o Tipo de veículo (Carro/Caminhonete ou Linha Pesada)." };
  const v = valores.find((x) => normalizarTipoVeiculo(x?.nome ?? x?.name) === tipo);
  if (v) return { estado: "ok", valor: { id: String(v.id), nome: String(v.nome ?? v.name) }, aceitos, texto: "" };
  return {
    estado: "incompativel",
    valor: null,
    aceitos,
    texto: `A categoria escolhida no Mercado Livre aceita só: ${aceitos.join(", ") || "nenhum valor"}. Com "${tipo}" a publicação fica bloqueada — troque a categoria (bloco ⑮) ou o Tipo de veículo. O PAIIA não troca sozinho.`,
  };
}

/**
 * Publicação: atributo VEHICLE_TYPE a enviar, a partir SÓ da ficha.
 * attrCategoria = item VEHICLE_TYPE de preparo.obrigatorios ({id, valores:[{id,nome}]}) ou null.
 * Devolve { estado, extra|null, nome, texto } — extra = { id:"VEHICLE_TYPE", value_id }.
 */
export function tipoVeiculoParaPublicacao(tipoFicha, attrCategoria) {
  const tipo = normalizarTipoVeiculo(tipoFicha);
  if (!attrCategoria) {
    return { estado: "nao_se_aplica", extra: null, nome: "", tipoFicha: tipo, texto: tipo ? `${tipo} confirmado na ficha; esta categoria não pede Tipo de veículo (não é enviado).` : "" };
  }
  const r = tipoVeiculoNaCategoria(tipo, { existe: true, valores: attrCategoria.valores || [] });
  if (r.estado === "ok") {
    return { estado: "ok", extra: { id: "VEHICLE_TYPE", value_id: r.valor.id }, nome: r.valor.nome, tipoFicha: tipo, texto: `${r.valor.nome} (confirmado na ficha).` };
  }
  if (r.estado === "sem_tipo") {
    return { estado: "sem_tipo", extra: null, nome: "", tipoFicha: tipo, texto: "A categoria exige Tipo de veículo e ele não está confirmado na ficha. Escolha em ⑤ Características principais (← Voltar à Conferência)." };
  }
  return { estado: "incompativel", extra: null, nome: "", tipoFicha: tipo, texto: r.texto };
}
