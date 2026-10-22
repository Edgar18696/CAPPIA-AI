// =============================================================
// PAIIA Voz — FICHA DE TRABALHO (funções puras, sem React, sem rede).
//   Testes: scripts/testes/paiiaVoz.test.mjs
//
// Regras:
//  • Tudo que é dito entra como sugestão; campo CONFIRMADO pelo usuário
//    não é trocado por um novo ditado (precisa desconfirmar antes).
//  • Códigos: o código original dito/digitado é preservado; duplicados
//    são reconhecidos pela forma normalizada; um código é o principal (SKU).
//  • Aplicações: "informada" (usuário) ou com fonte (base PAIIA/catálogo).
//    Só as CONFIRMADAS pelo usuário vão para o título e a descrição.
//    Nunca se inventa modelo, motor ou ano.
//  • A ficha não toca no banco: o envio ao Novo Anúncio usa a abertura
//    existente (iniciarAnuncioNovo) e a ficha oficial nasce lá.
// =============================================================

import { normalizarCodigo } from "../../../services/paizinhoPesquisa/codigoPaizinho.js";
import { semAcento } from "./numerosFalados.js";
import { MONTADORAS } from "./interpretarFala.js";

export const CHAVE_FICHA_VOZ = "paiiaVozFicha";
export const CHAVE_COMPLEMENTO_VOZ = "paiiaVozComplemento";
export const VALIDADE_COMPLEMENTO_MS = 48 * 60 * 60 * 1000;
export const CAMPOS_SIMPLES = ["descricao", "marca", "preco", "custo", "quantidade"];
export const ROTULOS = {
  codigo: "Código da peça",
  descricao: "Descrição (nome da peça)",
  marca: "Marca",
  preco: "Preço de venda",
  custo: "Custo",
  quantidade: "Quantidade em estoque",
  aplicacao: "Aplicação",
};

const LIMITE_HISTORICO = 60;
const txt = (v) => String(v ?? "").trim();

function novoId(prefixo = "v") {
  const r = globalThis.crypto?.randomUUID?.();
  return r || `${prefixo}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function criarFichaVoz({ agora = Date.now(), id } = {}) {
  return {
    id: id || novoId("voz"),
    versao: 1,
    criadaEm: agora,
    atualizadaEm: agora,
    campos: {},
    codigos: [],
    aplicacoes: [],
    historico: [],
    atributos: {},
    peca: null,
    conversa: novaConversa(),
  };
}

/** Estado da conversa guardado na ficha (sobrevive ao F5). */
export function novaConversa() {
  return { pendente: null, pulados: [], aplicacaoAtual: null, veiculoParcial: null, anosPendentes: null, apresentou: false };
}

const copia = (f) => JSON.parse(JSON.stringify(f));

function tocar(f, agora) {
  f.versao = (Number(f.versao) || 0) + 1;
  f.atualizadaEm = agora;
  return f;
}

// ---------------------------------------------------------------
// Códigos
// ---------------------------------------------------------------
function adicionarCodigo(f, codigo, { origem, principal = false, soletrado = false, agora, fonte = "" }) {
  const original = txt(codigo).toUpperCase();
  const normalizado = normalizarCodigo(original);
  if (!normalizado) return { mudou: false, aviso: "Código vazio." };
  let existente = f.codigos.find((c) => c.normalizado === normalizado);
  let mudou = false;
  if (!existente) {
    existente = { codigo: original, normalizado, origem, fonte, em: agora, principal: false, soletrado, conferido: !soletrado };
    f.codigos.push(existente);
    mudou = true;
  }
  if (principal || !f.codigos.some((c) => c.principal)) {
    f.codigos.forEach((c) => { c.principal = c === existente; });
    mudou = true;
  }
  return { mudou };
}

export function definirCodigoPrincipal(ficha, normalizado, { agora = Date.now() } = {}) {
  const f = copia(ficha);
  if (!f.codigos.some((c) => c.normalizado === normalizado)) return f;
  f.codigos.forEach((c) => { c.principal = c.normalizado === normalizado; });
  return tocar(f, agora);
}

export function conferirCodigo(ficha, normalizado, conferido = true, { agora = Date.now() } = {}) {
  const f = copia(ficha);
  const c = f.codigos.find((x) => x.normalizado === normalizado);
  if (!c) return f;
  c.conferido = Boolean(conferido);
  return tocar(f, agora);
}

export function removerCodigo(ficha, normalizado, { agora = Date.now() } = {}) {
  const f = copia(ficha);
  const era = f.codigos.find((c) => c.normalizado === normalizado);
  f.codigos = f.codigos.filter((c) => c.normalizado !== normalizado);
  if (era?.principal && f.codigos.length) f.codigos[0].principal = true;
  return tocar(f, agora);
}

export const codigoPrincipal = (f) => (f?.codigos || []).find((c) => c.principal) || null;
export const codigosAdicionais = (f) => (f?.codigos || []).filter((c) => !c.principal);

// ---------------------------------------------------------------
// Aplicações
// ---------------------------------------------------------------
export function chaveAplicacao(ap) {
  const n = (s) => semAcento(s).toLowerCase().replace(/\s+/g, " ").trim();
  return [
    (ap.modelos || []).map(n).sort().join("+"),
    (ap.motores || []).map(n).sort().join("+"),
    ap.anoInicio || "",
    ap.anoFim || "",
  ].join("|");
}

/** Inclui (mutando a ficha f) uma aplicação; devolve { mudou, aviso?, id? }. */
export function incluirAplicacao(f, ap, opcoes) {
  return adicionarAplicacao(f, ap, opcoes);
}

function adicionarAplicacao(f, ap, { origem, fonte = "", agora, confirmada = false }) {
  if (!ap || !((ap.modelos || []).length)) return { mudou: false, aviso: `Aplicação sem modelo de veículo: "${txt(ap?.texto)}" — diga o modelo (ex.: "aplicação Gol 1.6 2010 a 2015").` };
  const chave = chaveAplicacao(ap);
  const existente = f.aplicacoes.find((a) => a.chave === chave);
  if (existente) {
    // Mesma aplicação de outra fonte: guarda a fonte a mais, sem duplicar.
    if (fonte && !existente.fontes.includes(fonte)) existente.fontes.push(fonte);
    if (origem !== "usuario" && existente.origem === "usuario") existente.origem = origem;
    return { mudou: Boolean(fonte), id: existente.id };
  }
  const id = novoId("ap");
  f.aplicacoes.push({
    id,
    chave,
    texto: txt(ap.texto),
    montadora: txt(ap.montadora),
    modelos: [...(ap.modelos || [])],
    motores: [...(ap.motores || [])],
    anoInicio: ap.anoInicio || null,
    anoFim: ap.anoFim || null,
    origem,
    fontes: fonte ? [fonte] : [],
    confirmada: Boolean(confirmada),
    tipoVeiculo: txt(ap.tipoVeiculo),
    em: agora,
  });
  return { mudou: true, id };
}

/** Recalcula a chave da aplicação (mutando f) depois de mudar modelos/anos; junta se ficou igual a outra. */
export function rechavearAplicacao(f, id) {
  const a = f.aplicacoes.find((x) => x.id === id);
  if (!a) return null;
  a.chave = chaveAplicacao(a);
  const igual = f.aplicacoes.find((x) => x !== a && x.chave === a.chave);
  if (igual) {
    igual.fontes = [...new Set([...(igual.fontes || []), ...(a.fontes || [])])];
    if (!igual.tipoVeiculo && a.tipoVeiculo) igual.tipoVeiculo = a.tipoVeiculo;
    f.aplicacoes = f.aplicacoes.filter((x) => x !== a);
    return igual.id;
  }
  return a.id;
}

export function confirmarAplicacao(ficha, id, confirmada = true, { agora = Date.now() } = {}) {
  const f = copia(ficha);
  const a = f.aplicacoes.find((x) => x.id === id);
  if (!a) return f;
  a.confirmada = Boolean(confirmada);
  return tocar(f, agora);
}

export function removerAplicacao(ficha, id, { agora = Date.now() } = {}) {
  const f = copia(ficha);
  f.aplicacoes = f.aplicacoes.filter((a) => a.id !== id);
  return tocar(f, agora);
}

// ---------------------------------------------------------------
// Campos simples
// ---------------------------------------------------------------
function definirCampo(f, campo, valor, { origem, agora }) {
  const atual = f.campos[campo];
  if (atual && atual.confirmado && String(atual.valor) !== String(valor)) {
    return { mudou: false, aviso: `${ROTULOS[campo]} já foi confirmado (${formatarValor(campo, atual.valor)}). Para trocar, desmarque a confirmação.` };
  }
  if (atual && String(atual.valor) === String(valor)) return { mudou: false };
  f.campos[campo] = { valor, origem, em: agora, confirmado: false, anterior: atual ? atual.valor : undefined };
  return { mudou: true };
}

export function editarCampo(ficha, campo, valor, { agora = Date.now(), origem = "digitado" } = {}) {
  const f = copia(ficha);
  if (!CAMPOS_SIMPLES.includes(campo)) return f;
  const atual = f.campos[campo];
  const vazio = valor === "" || valor === null || valor === undefined;
  if (vazio) {
    delete f.campos[campo];
    return tocar(f, agora);
  }
  // Edição manual é decisão do usuário: troca mesmo se confirmado e desconfirma.
  f.campos[campo] = { valor, origem, em: agora, confirmado: false, anterior: atual ? atual.valor : undefined };
  return tocar(f, agora);
}

export function confirmarCampo(ficha, campo, confirmado = true, { agora = Date.now() } = {}) {
  const f = copia(ficha);
  if (!f.campos[campo]) return f;
  f.campos[campo].confirmado = Boolean(confirmado);
  return tocar(f, agora);
}

export function formatarValor(campo, valor) {
  if (valor === null || valor === undefined || valor === "") return "";
  if (campo === "preco" || campo === "custo") {
    const n = Number(valor);
    return Number.isFinite(n) ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : String(valor);
  }
  return String(valor);
}

// ---------------------------------------------------------------
// Aplicar o que foi falado/digitado
// ---------------------------------------------------------------
/**
 * @param interpretacao resultado de interpretarFala()
 * @returns {{ ficha, mudancas: string[], avisos: string[] }}
 */
export function aplicarInterpretacao(ficha, interpretacao, { agora = Date.now(), origem = "voz", textoOriginal = "" } = {}) {
  const f = copia(ficha);
  const mudancas = [];
  const avisos = [...(interpretacao?.avisos || [])];
  for (const item of interpretacao?.itens || []) {
    if (item.campo === "codigo" || item.campo === "codigoPrincipal" || item.campo === "codigoAdicional") {
      const principal = item.campo === "codigoPrincipal" || (item.campo === "codigo" && !f.codigos.length);
      // (22/10/2026) "corrige o código para X": o principal antigo estava errado e sai da ficha.
      const antigo = item.correcao ? f.codigos.find((c) => c.principal) : null;
      const r = adicionarCodigo(f, item.valor, { origem, principal, soletrado: Boolean(item.soletrado), agora });
      if (antigo && antigo.normalizado !== normalizarCodigo(item.valor)) {
        f.codigos = f.codigos.filter((c) => c !== antigo);
        mudancas.push(`Código ${antigo.codigo} trocado por ${item.valor}`);
      }
      if (r.aviso) avisos.push(r.aviso);
      if (r.mudou) mudancas.push(`Código ${item.valor}${principal ? " (principal)" : ""}`);
      if (item.soletrado) avisos.push(`Confira o código ${item.valor} letra por letra (foi ditado).`);
      (item.duvidas || []).forEach((d) => avisos.push(`Código ${item.valor}: ${d}.`));
      continue;
    }
    if (item.campo === "aplicacao") {
      const r = adicionarAplicacao(f, item.valor, { origem: "usuario", agora });
      if (r.aviso) avisos.push(r.aviso);
      if (r.mudou) mudancas.push(`Aplicação informada: ${resumoAplicacao(item.valor)}`);
      continue;
    }
    if (CAMPOS_SIMPLES.includes(item.campo)) {
      const r = definirCampo(f, item.campo, item.valor, { origem, agora });
      if (r.aviso) avisos.push(r.aviso);
      if (r.mudou) mudancas.push(`${ROTULOS[item.campo]}: ${formatarValor(item.campo, item.valor)}`);
    }
  }
  if (textoOriginal) {
    f.historico.push({ em: agora, origem, texto: txt(textoOriginal).slice(0, 500) });
    if (f.historico.length > LIMITE_HISTORICO) f.historico = f.historico.slice(-LIMITE_HISTORICO);
  }
  if (mudancas.length || textoOriginal) tocar(f, agora);
  return { ficha: f, mudancas, avisos };
}

// ---------------------------------------------------------------
// Resultado da base PAIIA / catálogo (consultaBaseVoz)
// ---------------------------------------------------------------
export function incorporarResultadoBase(ficha, resultado, { agora = Date.now() } = {}) {
  const f = copia(ficha);
  const mudancas = [];
  const avisos = [];
  if (!resultado || !resultado.encontrado) return { ficha: f, mudancas, avisos };
  for (const ap of resultado.aplicacoes || []) {
    const r = adicionarAplicacao(f, ap, { origem: resultado.origem, fonte: ap.fonte || resultado.rotulo, agora });
    if (r.mudou) mudancas.push(`Aplicação da ${resultado.rotulo}: ${resumoAplicacao(ap)}`);
  }
  for (const c of resultado.codigos || []) {
    const r = adicionarCodigo(f, c, { origem: resultado.origem, agora, fonte: resultado.rotulo });
    if (r.mudou) mudancas.push(`Código de referência da ${resultado.rotulo}: ${c}`);
  }
  if (resultado.descricao && !f.campos.descricao) {
    definirCampo(f, "descricao", resultado.descricao, { origem: resultado.origem, agora });
    mudancas.push(`Descrição sugerida pela ${resultado.rotulo}: ${resultado.descricao}`);
  }
  if (mudancas.length) tocar(f, agora);
  return { ficha: f, mudancas, avisos };
}

// ---------------------------------------------------------------
// Título e descrição no padrão da loja
// ---------------------------------------------------------------
export function resumoAplicacao(ap) {
  if (!ap) return "";
  const anos = ap.anoInicio && ap.anoFim
    ? (ap.anoInicio === ap.anoFim ? `${ap.anoInicio}` : `${ap.anoInicio} à ${ap.anoFim}`)
    : ap.anoInicio ? `${ap.anoInicio} em diante` : "";
  return [(ap.modelos || []).join(" / "), (ap.motores || []).join(" "), anos].filter(Boolean).join(" ");
}

const RE_PROIBIDAS = new RegExp(`(?<![\\p{L}\\p{N}])(original|originais|genu[ií]n[ao]s?|${MONTADORAS.map((m) => m.replace(/[-\s]/g, "[-\\s]?")).join("|")})(?![\\p{L}\\p{N}])`, "giu");

/** Tira marca, "original"/"genuína" e nomes de montadora (regras da loja). */
export function limparTextoAnuncio(texto, { marca = "" } = {}) {
  let s = semAcentoSeguro(String(texto ?? ""));
  s = s.replace(RE_PROIBIDAS, " ");
  const m = txt(marca);
  if (m) s = s.replace(new RegExp(`(?<![\\p{L}\\p{N}])${m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "giu"), " ");
  return s.replace(/\s{2,}/g, " ").trim();
}
// Mantém acentos; só usado para manter a função pura.
const semAcentoSeguro = (s) => s;

// ---------------------------------------------------------------
// Detalhes da peça (lado, lente, tecnologia, tensão) — ditos na conversa
// ---------------------------------------------------------------
export const ORDEM_ATRIBUTOS = ["lado", "lente", "tecnologia", "tensao"];
export const ROTULOS_ATRIBUTOS = { lado: "Lado", lente: "Lente", tecnologia: "Tecnologia", tensao: "Tensão", posicao: "Posição" };

/** Valor do atributo pronto para o texto ("esquerda" para peça feminina). */
export function textoAtributo(chave, valor, genero = "m") {
  const v = txt(valor);
  if (!v) return "";
  if (chave === "lado") {
    if (v === "par") return "par (esquerdo e direito)";
    if (v === "esquerdo") return genero === "f" ? "esquerda" : "esquerdo";
    if (v === "direito") return genero === "f" ? "direita" : "direito";
  }
  return v;
}

export function definirAtributo(ficha, chave, valor, { agora = Date.now(), origem = "voz" } = {}) {
  const f = copia(ficha);
  f.atributos = f.atributos || {};
  if (!txt(valor)) delete f.atributos[chave];
  else f.atributos[chave] = { valor: txt(valor), origem, em: agora };
  return tocar(f, agora);
}

/** Nome completo: descrição + lado, lente, tecnologia e tensão (sem marca/montadora). */
export function nomeDaPeca(ficha, { sem = [] } = {}) {
  const marca = ficha?.campos?.marca?.valor || "";
  const base = limparTextoAnuncio(ficha?.campos?.descricao?.valor || "", { marca });
  if (!base) return "";
  const genero = ficha?.peca?.genero || "m";
  const baixo = semAcento(base).toLowerCase();
  const extras = ORDEM_ATRIBUTOS
    .filter((k) => !sem.includes(k))
    .map((k) => textoAtributo(k, ficha?.atributos?.[k]?.valor, genero))
    .filter((v) => v && !baixo.includes(semAcento(v).toLowerCase()));
  return [base, ...extras].join(" ");
}

export function aplicacoesConfirmadas(ficha) {
  return (ficha?.aplicacoes || []).filter((a) => a.confirmada);
}

/** [peça] + [modelos] + [motorização] + " - " + [código], até 60 caracteres. */
export function montarTitulo(ficha, limite = 60) {
  const cod = codigoPrincipal(ficha)?.codigo || "";
  if (!nomeDaPeca(ficha)) return "";
  const aps = aplicacoesConfirmadas(ficha);
  const modelos = [...new Set(aps.flatMap((a) => a.modelos))];
  const motores = [...new Set(aps.flatMap((a) => a.motores))];
  const sufixo = cod ? ` - ${cod}` : "";
  // Se não couber em 60, sai primeiro o detalhe menos importante.
  const fora = [];
  const montar = (ms, mts) => [nomeDaPeca(ficha, { sem: fora }), ...ms, ...mts].filter(Boolean).join(" ") + sufixo;
  let ms = [...modelos];
  let mts = [...motores];
  let t = montar(ms, mts);
  for (const k of ["tensao", "lente", "tecnologia"]) { if (t.length <= limite) break; fora.push(k); t = montar(ms, mts); }
  while (t.length > limite && mts.length) { mts.pop(); t = montar(ms, mts); }
  while (t.length > limite && ms.length > 1) { ms.pop(); t = montar(ms, mts); }
  if (t.length > limite) { fora.push("lado"); t = montar(ms, mts); }
  while (t.length > limite && ms.length) { ms.pop(); t = montar(ms, mts); }
  const peca = nomeDaPeca(ficha, { sem: fora });
  if (t.length > limite) {
    const espaco = Math.max(10, limite - sufixo.length);
    t = peca.slice(0, espaco).replace(/\s+\S*$/, "").trim() + sufixo;
  }
  return t.slice(0, limite).trim();
}

export const TEXTO_ATENCAO = "ATENÇÃO: Antes de efetuar a compra, verifique o código da peça instalada em seu veículo. A compatibilidade deve ser confirmada comparando o código informado neste anúncio com o código da peça do veículo.";
export const TEXTO_IMPORTANTE = "IMPORTANTE: Para evitar a compra de uma peça incompatível, confira sempre o código da peça antes de realizar o pedido.";

/** Descrição no modelo oficial da loja (só aplicações confirmadas). */
export function montarDescricao(ficha) {
  const marca = ficha?.campos?.marca?.valor || "";
  const peca = nomeDaPeca(ficha);
  if (!peca) return "";
  const linhas = [peca.charAt(0).toUpperCase() + peca.slice(1), ""];
  const aps = aplicacoesConfirmadas(ficha);
  if (aps.length) {
    linhas.push("Compatível com os veículos:");
    for (const a of aps) {
      for (const modelo of a.modelos) {
        const anos = a.anoInicio && a.anoFim
          ? (a.anoInicio === a.anoFim ? `${a.anoInicio}` : `${a.anoInicio} à ${a.anoFim}`)
          : a.anoInicio ? `${a.anoInicio} em diante` : "";
        linhas.push([limparTextoAnuncio(modelo, { marca }), a.motores.join(" "), anos].filter(Boolean).join(" "));
      }
    }
    linhas.push("");
  }
  linhas.push("Especificações Técnicas:", "Condição do item: Produto novo", "");
  const codigos = (ficha?.codigos || []).filter((c) => c.conferido !== false).map((c) => c.codigo);
  if (codigos.length) linhas.push("Código de Referência:", codigos.join(" / "), "");
  linhas.push("Garantia: 3 Meses", "", TEXTO_ATENCAO, "", TEXTO_IMPORTANTE);
  return linhas.join("\n");
}

// ---------------------------------------------------------------
// Conferência antes de enviar ao Novo Anúncio
// ---------------------------------------------------------------
export function validarParaEnvio(ficha) {
  const faltando = [];
  const avisos = [];
  const cp = codigoPrincipal(ficha);
  if (!cp) faltando.push("código da peça");
  if (!txt(ficha?.campos?.descricao?.valor)) faltando.push("descrição (nome da peça)");
  const preco = Number(ficha?.campos?.preco?.valor);
  if (!(Number.isFinite(preco) && preco > 0)) faltando.push("preço de venda");
  (ficha?.codigos || []).filter((c) => c.conferido === false).forEach((c) => avisos.push(`O código ${c.codigo} foi ditado e ainda não foi conferido letra por letra.`));
  const aps = ficha?.aplicacoes || [];
  const pendentes = aps.filter((a) => !a.confirmada);
  if (!aplicacoesConfirmadas(ficha).length) avisos.push("Nenhuma aplicação confirmada: a descrição sairá sem a lista de veículos (zero é melhor do que aplicação errada).");
  if (pendentes.length) avisos.push(`${pendentes.length} aplicação(ões) ainda não confirmada(s) ficarão de fora do título e da descrição.`);
  if (!ficha?.campos?.quantidade) avisos.push("Quantidade não informada: preencha na Conferência.");
  if (!ficha?.campos?.marca) avisos.push("Marca não informada: preencha na Conferência.");
  return { pronto: faltando.length === 0, faltando, avisos };
}

const precoTexto = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n.toFixed(2).replace(".", ",") : "";
};

/**
 * Dados para iniciarAnuncioNovo({ dados }) (campos que o Novo Anúncio já
 * aceita) + complemento para a Conferência (marca e quantidade).
 */
export function mapearParaNovoAnuncio(ficha, { agora = Date.now() } = {}) {
  const cp = codigoPrincipal(ficha);
  const dados = {
    codigo: cp?.codigo || "",
    oem: codigosAdicionais(ficha).filter((c) => c.conferido !== false).map((c) => c.codigo).join(", "),
    titulo: montarTitulo(ficha),
    descricao: montarDescricao(ficha),
    preco: precoTexto(ficha?.campos?.preco?.valor),
    origemPaiiaVoz: ficha?.id || "",
  };
  const custo = precoTexto(ficha?.campos?.custo?.valor);
  if (custo) dados.custo = custo;
  const complemento = {
    fichaVozId: ficha?.id || "",
    codigoNormalizado: cp?.normalizado || "",
    marca: txt(ficha?.campos?.marca?.valor),
    quantidadeEstoque: ficha?.campos?.quantidade ? String(ficha.campos.quantidade.valor) : "",
    em: agora,
  };
  return { dados, complemento };
}

/**
 * Marca/quantidade ditos no PAIIA Voz para a Conferência deste código.
 * Só vale para o MESMO código e por 48 h; senão devolve vazio.
 */
export function complementoParaConferencia(storage, codigo, { agora = Date.now() } = {}) {
  const vazio = { marca: "", quantidadeEstoque: "" };
  try {
    const s = storage || globalThis.localStorage;
    const bruto = s?.getItem(CHAVE_COMPLEMENTO_VOZ);
    if (!bruto) return vazio;
    const c = JSON.parse(bruto);
    if (!c || normalizarCodigo(codigo) !== c.codigoNormalizado || !c.codigoNormalizado) return vazio;
    if (!(agora - Number(c.em || 0) <= VALIDADE_COMPLEMENTO_MS)) return vazio;
    return { marca: txt(c.marca), quantidadeEstoque: txt(c.quantidadeEstoque) };
  } catch {
    return vazio;
  }
}

// ---------------------------------------------------------------
// Guardar a ficha neste aparelho (continua depois de F5/fechar)
// ---------------------------------------------------------------
export function guardarFichaVoz(ficha, storage) {
  try {
    (storage || globalThis.localStorage).setItem(CHAVE_FICHA_VOZ, JSON.stringify(ficha));
    return true;
  } catch {
    return false;
  }
}

export function lerFichaVoz(storage) {
  try {
    const bruto = (storage || globalThis.localStorage).getItem(CHAVE_FICHA_VOZ);
    if (!bruto) return null;
    const f = JSON.parse(bruto);
    if (!f || typeof f !== "object" || !Array.isArray(f.codigos) || !Array.isArray(f.aplicacoes) || typeof f.campos !== "object") return null;
    return f;
  } catch {
    return null;
  }
}

export function descartarFichaVoz(storage) {
  try {
    (storage || globalThis.localStorage).removeItem(CHAVE_FICHA_VOZ);
  } catch {
    // sem acesso ao navegador
  }
}

export function fichaVazia(f) {
  return !f || (!f.codigos?.length && !f.aplicacoes?.length && !Object.keys(f.campos || {}).length && !Object.keys(f.atributos || {}).length && !f.conversa?.veiculoParcial && !f.conversa?.anosPendentes);
}
