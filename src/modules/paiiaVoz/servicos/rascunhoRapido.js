// =============================================================
// PAIIA Voz — ANÚNCIO RÁPIDO (fotos → código → título → descrição → enviar).
//   Testes: scripts/testes/paiiaVozRapido.test.mjs
//
// O usuário já conhece a peça: o PAIIA só pergunta, organiza e confere.
//  • Título: o que você falar/digitar (até 60). Sugestões são só sugestões.
//  • Descrição: o seu texto é preservado e organizado no modelo da loja.
//    Medidas e peso NÃO vão para a descrição (ficam para os campos da
//    plataforma). Marca e "original/genuína" são retirados, com aviso.
//  • Aplicações: as conferidas por você E as encontradas na Base PAIIA (08/11)
//    entram em "Compatível com os veículos"; desmarcadas por você ficam de fora.
// Funções puras: guardam tudo dentro da ficha do PAIIA Voz (F5 não perde).
// =============================================================

import { semAcento, lerCodigoFalado } from "./numerosFalados.js";
import { pareceCodigo, pareceAno } from "./interpretarFala.js";
import {
  aplicacoesConfirmadas,
  codigoPrincipal,
  codigosParaDescricao,
  linhasCodigosReferencia,
  aplicarCodigosNoTexto,
  limparTextoAnuncio,
  TEXTO_ATENCAO,
  TEXTO_IMPORTANTE,
} from "./fichaVoz.js";
import { lerPesoEMedidas, camposDadosTecnicos, textoPesoMedidas } from "./pesoMedidasVoz.js";
// (23/10 - E6) Inicial maiúscula em cada palavra (preserva códigos, siglas, acentos e aplicações).
import { padronizarTitulo, padronizarDescricao } from "../../../services/padronizarTextoAnuncio.js";

// (04/11/2026) 7 etapas aprovadas: Fotos, Código, Descrição/Título, Preço/Custo/Estoque,
// Peso/Medidas/Frete, Compatibilidade e Finalizar (as antigas “titulo”/“enviar” viram “descricao”/“finalizar”).
// (08/11) Envio ANTES do Preço: o frete de venda do Mercado Livre entra no preço sugerido.
export const ETAPAS = ["fotos", "codigo", "descricao", "envio", "preco", "compat", "categoria", "finalizar"];
export const ROTULOS_ETAPAS = { fotos: "Fotos", codigo: "Código", descricao: "Título e Descrição", preco: "Preço", envio: "Envio", compat: "Compat.", categoria: "Categoria", finalizar: "Finalizar" };
const ETAPAS_ANTIGAS = { titulo: "descricao", enviar: "finalizar" };
export const LIMITE_TITULO = 60;
export const MARCA_PADRAO = "Torken";

export const PERGUNTAS = {
  fotos: "Tire ou escolha até 5 fotos da peça. Pode continuar com menos. Quando terminar, toque em Continuar ou diga “próximo”.",
  codigo: "Qual é o código da peça? Fale ou digite. Se não tiver, diga “sem código”.",
  descricao: "Primeiro o Título: toque no 🎤 do Título e fale. Depois a Descrição (cada fala é acrescentada).",
  preco: "Calculadora (opcional, com o Custo da Mercadoria) e depois toque no 🎤 e fale: preço de venda, marca e estoque. Ele passa sozinho para o próximo campo.",
  envio: "Toque no 🎤 e fale o peso embalado (gramas) e as medidas — “20 por 10 por 5” preenche as três.",
  compat: "Diga o veículo e os anos (ex.: Renault Master 2013 a 2022) e marque só as aplicações certas.",
  categoria: "Confira a categoria do Mercado Livre. Se estiver certa, é só seguir; se não, toque em Alterar categoria.",
  finalizar: "Confira as pendências. A finalização confere no Bling e no Mercado Livre e só executa o que você autorizar.",
};

const txt = (v) => String(v ?? "").trim();
const n = (s) => semAcento(String(s ?? "")).toLowerCase();
const copia = (o) => JSON.parse(JSON.stringify(o));

export function estadoRapido(ficha) {
  const r = ficha?.rapido || {};
  return {
    etapa: ETAPAS.includes(r.etapa) ? r.etapa : ETAPAS_ANTIGAS[r.etapa] || "fotos",
    titulo: { valor: txt(r.titulo?.valor), origem: r.titulo?.origem || "", anterior: r.titulo?.anterior ?? null },
    descricao: { texto: String(r.descricao?.texto ?? ""), anterior: r.descricao?.anterior ?? null, final: r.descricao?.final ?? null },
    codigoPulado: Boolean(r.codigoPulado),
    base: r.base || null, // resumo da consulta: { estado, rotulo, descricao, aplicacoes, codigos, aproveitado }
  };
}

function comRapido(ficha, mudar, agora = Date.now()) {
  const f = copia(ficha);
  f.rapido = estadoRapido(f);
  mudar(f.rapido, f);
  f.versao = (Number(f.versao) || 0) + 1;
  f.atualizadaEm = agora;
  return f;
}

export const irParaEtapa = (ficha, etapa) => comRapido(ficha, (r) => { if (ETAPAS.includes(etapa)) r.etapa = etapa; });
export function proximaEtapa(etapa, passo = 1) {
  const i = ETAPAS.indexOf(etapa);
  return ETAPAS[Math.min(ETAPAS.length - 1, Math.max(0, (i < 0 ? 0 : i) + passo))];
}

// ---------------------------------------------------------------
// Código
// ---------------------------------------------------------------
const PULAR_CODIGO = /^(?:sem codigo|nao tem(?: codigo)?|nao sei|nao tenho|pula|pular|depois|nenhum)$/;

/** Fala/digitação da etapa do código → { codigo, soletrado, duvidas } | { pular: true } | { erro } */
// (22/10/2026) Na etapa Código a pessoa está DIZENDO um código: aceita
// blocos de letras e números com espaços ("IWP 065", "F 000 99 0 123"),
// dígitos ditos um a um ("0 4 4 5 1 1 0 2 3 5") e ignora o "é" de
// "o código (dela) é …" / "é 0280…". Ano continua não sendo código.
const RE_PREFIXO_CODIGO = /^(?:(?:o|a)\s+)?(?:c[oó]digo|cod|refer[eê]ncia|sku|n[uú]mero)(?:\s+(?:da\s+pe[cç]a|dela|dele|dessa\s+pe[cç]a|desta\s+pe[cç]a))?(?:\s+(?:[eé]|eh|seria|fica))?\s*[:=-]?\s*/i;
const RE_LIGACAO_CODIGO = /^(?:[eé]|eh|seria|fica|sendo|é\s+o|e\s+o)\s+(?=\S)/i;
/** Código "compacto" plausível depois de juntar as partes: 4–25 caracteres, ≥ 3 dígitos. */
function codigoCompactoPlausivel(codigo) {
  const c = String(codigo || "");
  return /^[A-Z0-9][A-Z0-9.\-/]{3,24}$/.test(c) && (c.match(/\d/g) || []).length >= 3;
}
export function lerCodigoDaFala(fala, { falado = false } = {}) {
  let t = txt(fala).replace(/[.!?]+$/, "");
  const k = n(t);
  if (PULAR_CODIGO.test(k)) return { pular: true };
  t = t.replace(RE_PREFIXO_CODIGO, "");
  for (let i = 0; i < 2 && RE_LIGACAO_CODIGO.test(t) && /\d/.test(t); i++) t = t.replace(RE_LIGACAO_CODIGO, "");
  t = t.trim();
  if (!t) return { erro: "Não ouvi o código. Fale de novo ou digite." };
  if (pareceAno(t)) return { erro: `“${t}” parece ano, não código. Se for mesmo o código, digite-o.` };
  const c = lerCodigoFalado(t, { falado });
  const naoEntendeu = c.duvidas.some((d) => /não foi entendido/.test(d));
  const tokens = t.split(/\s+/).length;
  const aceito = c.codigo && /\d/.test(c.codigo) && !naoEntendeu && tokens <= 16 && (pareceCodigo(t) || c.soletrado || codigoCompactoPlausivel(c.codigo));
  if (!aceito) {
    return { erro: `Não entendi “${t}” como código. Fale devagar, em blocos ou letra por letra (ex.: “I W P zero seis cinco”), ou digite.` };
  }
  // Juntou blocos separados por espaço: conferir antes de enviar.
  const juntou = !c.soletrado && tokens > 1 && !pareceCodigo(t);
  return { codigo: c.codigo, soletrado: c.soletrado || juntou, duvidas: c.duvidas };
}

// ---------------------------------------------------------------
// Título
// ---------------------------------------------------------------
const RE_ORIGINAL = /(?<![\p{L}\p{N}])(originais|original|genu[ií]n[ao]s?)(?![\p{L}\p{N}])/giu;

function marcasProibidas(ficha) {
  return [...new Set([MARCA_PADRAO, txt(ficha?.campos?.marca?.valor)].filter(Boolean))];
}

/** Avisos do título (não muda nada sozinho). */
export function avaliarTitulo(titulo, ficha) {
  const t = txt(titulo);
  const avisos = [];
  if (!t) return { comprimento: 0, avisos: ["Falta o título."], ok: false };
  if (t.length > LIMITE_TITULO) avisos.push(`O título tem ${t.length} caracteres; o Mercado Livre aceita até ${LIMITE_TITULO}.`);
  if (RE_ORIGINAL.test(t)) avisos.push("Tire a palavra “original/genuína” do título (regra da loja).");
  RE_ORIGINAL.lastIndex = 0;
  for (const m of marcasProibidas(ficha)) {
    if (new RegExp(`(?<![\\p{L}\\p{N}])${m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "iu").test(t)) avisos.push(`A marca “${m}” não vai no título (fica no campo Marca).`);
  }
  if (limparTextoAnuncio(t) !== t.replace(/\s{2,}/g, " ")) avisos.push("O título cita montadora; pela regra da loja ela fica fora do título.");
  return { comprimento: t.length, avisos, ok: t.length <= LIMITE_TITULO };
}

/** "Ajustar ao padrão": tira original/marca/montadora e corta em 60 sem quebrar palavra (mantém " - código" no fim). */
export function ajustarTitulo(titulo, ficha) {
  let t = limparTextoAnuncio(txt(titulo).replace(RE_ORIGINAL, " "), { marca: txt(ficha?.campos?.marca?.valor) });
  t = t.replace(new RegExp(`(?<![\\p{L}\\p{N}])${MARCA_PADRAO}(?![\\p{L}\\p{N}])`, "giu"), " ").replace(/\s{2,}/g, " ").replace(/\s+-\s*$/, "").trim();
  t = padronizarTitulo(t); // (E6) sugestões já com iniciais maiúsculas
  if (t.length <= LIMITE_TITULO) return t;
  const sufixo = t.match(/\s-\s[\w./-]+$/)?.[0] || "";
  let corpo = sufixo ? t.slice(0, -sufixo.length) : t;
  const espaco = LIMITE_TITULO - sufixo.length;
  corpo = corpo.slice(0, espaco + 1).replace(/\s+\S*$/, "").trim();
  return (corpo + sufixo).slice(0, LIMITE_TITULO).trim();
}

export function definirTitulo(ficha, valor, { origem = "voz", agora = Date.now() } = {}) {
  return comRapido(ficha, (r) => {
    r.titulo = { valor: padronizarTitulo(txt(valor).replace(/\s{2,}/g, " ")), origem, anterior: r.titulo.valor };
  }, agora);
}

/** Sugestões de título (nunca aplicadas sozinhas). */
export function sugestoesTitulo(ficha) {
  const r = estadoRapido(ficha);
  const cod = codigoPrincipal(ficha)?.codigo || "";
  const lista = [];
  const add = (t) => { const a = ajustarTitulo(t, ficha); if (a && !lista.includes(a) && n(a) !== n(r.titulo.valor)) lista.push(a); };
  const peca = txt(r.base?.descricao) || txt(ficha?.campos?.descricao?.valor);
  if (peca) {
    const aps = aplicacoesConfirmadas(ficha);
    const modelos = [...new Set(aps.flatMap((a) => a.modelos))];
    const motores = [...new Set(aps.flatMap((a) => a.motores))];
    add([peca, ...modelos, ...motores].join(" ") + (cod ? ` - ${cod}` : ""));
    add(peca + (cod ? ` - ${cod}` : ""));
  }
  if (r.titulo.valor && cod && !n(r.titulo.valor).includes(n(cod))) add(`${r.titulo.valor} - ${cod}`);
  if (r.titulo.valor && (r.titulo.valor.length > LIMITE_TITULO || avaliarTitulo(r.titulo.valor, ficha).avisos.length)) add(r.titulo.valor);
  return lista.slice(0, 4);
}

// ---------------------------------------------------------------
// Descrição
// ---------------------------------------------------------------
/**
 * (08/11) Como cada aplicação entra na Descrição Organizada:
 *  "confirmada" (marcada por você) · "base" (encontrada na Base PAIIA, já na descrição, a conferir)
 *  · "fora" (informada por você e não marcada, ou desmarcada). A validação do Mercado Livre
 *  continua na Finalizar e usa só as confirmadas.
 */
export function situacaoNaDescricao(a) {
  if (a?.confirmada) return { estado: "confirmada", texto: "confirmada por você · na descrição" };
  if (a && a.origem && a.origem !== "usuario" && !a.recusada) return { estado: "base", texto: "encontrada na Base PAIIA · já na descrição (marque para confirmar)" };
  return { estado: "fora", texto: a?.recusada ? "desmarcada · fora da descrição" : "fora da descrição até você marcar" };
}
export const aplicacoesDaDescricao = (ficha) => (ficha?.aplicacoes || []).filter((a) => situacaoNaDescricao(a).estado !== "fora");
const RE_LINHA_APLICACAO = /^Aplica[çc](?:ão|ões|ao|oes)\s*:/i;

const RE_MEDIDA = /(\b\d+(?:[.,]\d+)?\s*(?:mm|cm|m|metros?|cent[ií]metros?|mil[ií]metros?|kg|quilos?|g|gramas?|pol(?:egadas?)?|")(?![\p{L}])|\b(?:peso|pesa|medidas?|mede|comprimento|largura|altura|di[aâ]metro|espessura)\b)/iu;

/** Frases do texto livre (cada fala vira uma linha; pontuação também separa). */
export function frasesDoTexto(texto) {
  return String(texto ?? "")
    .split(/\n+|(?<=[.!?;])\s+/)
    .map((f) => f.trim().replace(/^[-•*]\s*/, ""))
    .filter(Boolean);
}

function arrumarFrase(f) {
  let s = f.replace(/\s{2,}/g, " ").trim();
  if (!s) return "";
  s = s.charAt(0).toUpperCase() + s.slice(1);
  if (!/[.!?:]$/.test(s)) s += ".";
  return s;
}

/**
 * Organiza a descrição no modelo da loja, preservando o que foi dito.
 * @returns {{ texto, informacoes[], medidas[], avisos[] }}
 */
export function organizarDescricao(ficha) {
  const r = estadoRapido(ficha);
  const avisos = [];
  const medidas = [];
  const informacoes = [];
  const marcas = marcasProibidas(ficha);
  const aps = aplicacoesDaDescricao(ficha);
  // (08/11) Com a lista "Compatível com os veículos", a linha "Aplicação: …" do texto (Base validada)
  // não se repete — retirada INTEIRA antes de separar as frases (ela usa ";" entre os veículos).
  const texto = aps.length ? String(r.descricao.texto ?? "").split("\n").filter((l) => !RE_LINHA_APLICACAO.test(l.trim())).join("\n") : r.descricao.texto;
  for (const bruta of frasesDoTexto(texto)) {
    if (RE_MEDIDA.test(bruta)) {
      medidas.push(arrumarFrase(bruta));
      continue;
    }
    let f = bruta;
    if (RE_ORIGINAL.test(f)) { avisos.push("Retirei “original/genuína” da descrição (regra da loja)."); f = f.replace(RE_ORIGINAL, " "); }
    RE_ORIGINAL.lastIndex = 0;
    for (const m of marcas) {
      const re = new RegExp(`(?<![\\p{L}\\p{N}])(?:da |de |marca )?${m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "giu");
      if (re.test(f)) { avisos.push(`Retirei a marca “${m}” da descrição (ela vai no campo Marca).`); f = f.replace(re, " "); }
    }
    f = arrumarFrase(f.replace(/\s+([,.;:!?])/g, "$1"));
    if (f && f !== "." && !informacoes.includes(f)) informacoes.push(f);
  }
  if (medidas.length) avisos.push("Medidas e peso não vão na descrição: ficam anotados para os campos da plataforma no Novo Anúncio.");

  const titulo = txt(r.titulo.valor);
  const nomeBruto = titulo.replace(/\s+-\s+[\w./-]+$/, "").trim() || txt(r.base?.descricao) || txt(ficha?.campos?.descricao?.valor);
  // mesmo texto do título, sem marca, "original" e montadora (sem cortar)
  let nome = limparTextoAnuncio(nomeBruto.replace(RE_ORIGINAL, " "), { marca: txt(ficha?.campos?.marca?.valor) });
  for (const m of marcas) nome = nome.replace(new RegExp(`(?<![\\p{L}\\p{N}])${m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "giu"), " ");
  nome = nome.replace(/\s{2,}/g, " ").trim();
  const linhas = [];
  if (nome) linhas.push(nome, "");
  if (informacoes.length) linhas.push(...informacoes, "");
  if (aps.length) {
    linhas.push("Compatível com os veículos:");
    for (const a of aps) {
      for (const modelo of a.modelos) {
        const anos = a.anoInicio && a.anoFim ? (a.anoInicio === a.anoFim ? `${a.anoInicio}` : `${a.anoInicio} à ${a.anoFim}`) : a.anoInicio ? `${a.anoInicio} em diante` : "";
        linhas.push([limparTextoAnuncio(modelo), a.motores.join(" "), anos].filter(Boolean).join(" "));
      }
    }
    linhas.push("");
  }
  linhas.push("Especificações Técnicas:", "Condição do item: Produto novo", "");
  // (04/11) principal + TODOS os adicionais conferidos (sem repetir)
  const codigos = codigosParaDescricao(ficha);
  if (codigos.length) linhas.push(...linhasCodigosReferencia(codigos), "");
  linhas.push("Garantia: 3 Meses", "", TEXTO_ATENCAO, "", TEXTO_IMPORTANTE);
  return { texto: padronizarDescricao(linhas.join("\n")), informacoes, medidas, avisos: [...new Set(avisos)] };
}

export function definirTextoDescricao(ficha, texto, { agora = Date.now() } = {}) {
  return comRapido(ficha, (r) => {
    r.descricao = { ...r.descricao, anterior: r.descricao.texto, texto: padronizarDescricao(String(texto ?? "")) };
  }, agora);
}

/** Texto final editado à mão (null = volta a organizar automaticamente). */
export function definirDescricaoFinal(ficha, texto, { agora = Date.now() } = {}) {
  return comRapido(ficha, (r) => { r.descricao = { ...r.descricao, final: texto === null ? null : padronizarDescricao(String(texto)) }; }, agora);
}

export function descricaoParaEnvio(ficha) {
  const r = estadoRapido(ficha);
  // (04/11) Texto editado à mão: a seção de códigos acompanha os códigos da ficha.
  return r.descricao.final !== null && r.descricao.final !== undefined ? padronizarDescricao(aplicarCodigosNoTexto(r.descricao.final, codigosParaDescricao(ficha))) : organizarDescricao(ficha).texto;
}

// ---------------------------------------------------------------
// Base PAIIA (sugestão de aproveitamento)
// ---------------------------------------------------------------
export function registrarConsultaBase(ficha, resultado, { agora = Date.now() } = {}) {
  return comRapido(ficha, (r) => {
    // (07/11) "falha": a consulta não terminou (erro/sem resposta) — diferente de "nada" (base respondeu sem o código).
    const codigo = txt(resultado?.codigo);
    r.base = resultado?.encontrado
      ? { estado: "encontrado", codigo, rotulo: resultado.rotulo, descricao: txt(resultado.descricao), aplicacoes: (resultado.aplicacoes || []).length, codigos: [...(resultado.codigos || [])], aproveitado: false }
      : { estado: resultado?.falhou ? "falha" : "nada", codigo, rotulo: "", descricao: "", aplicacoes: 0, codigos: [], aproveitado: false, erro: resultado?.erro || "" };
  }, agora);
}
/** (07/11) Resultado resumido da pesquisa do SKU (mostrado logo abaixo do campo Código da Peça). */
export function resumoDaBase(base) {
  if (!base) return "";
  if (base.estado === "encontrado") {
    const a = Number(base.aplicacoes) || 0;
    const c = (base.codigos || []).length;
    return `Encontrado na Base PAIIA — ${a} ${a === 1 ? "aplicação" : "aplicações"} e ${c} ${c === 1 ? "código" : "códigos"} de referência.`;
  }
  if (base.estado === "nada") return "Não encontrado na Base PAIIA — continue preenchendo manualmente.";
  if (base.estado === "falha") return "Falha na pesquisa na Base PAIIA — tente novamente ou continue manualmente.";
  return "";
}
export const marcarBaseAproveitada =(ficha) => comRapido(ficha, (r) => { if (r.base) r.base.aproveitado = true; });

// ---------------------------------------------------------------
// Conferir antes de enviar e montar os dados do Novo Anúncio
// ---------------------------------------------------------------
export function validarRapido(ficha, { fotos = 0 } = {}) {
  const r = estadoRapido(ficha);
  const faltando = [];
  const avisos = [];
  const t = avaliarTitulo(r.titulo.valor, ficha);
  if (!r.titulo.valor) faltando.push("título");
  else if (!t.ok) faltando.push(`título com até ${LIMITE_TITULO} caracteres`);
  avisos.push(...t.avisos.filter((a) => !/^Falta o título|^O título tem/.test(a)));
  const org = organizarDescricao(ficha);
  if (!org.informacoes.length && r.descricao.final === null) faltando.push("descrição (fale ou digite como é a peça)");
  if (!codigoPrincipal(ficha)) avisos.push("Sem código: o SKU terá de ser preenchido no Novo Anúncio.");
  // (07/11) Só os códigos ADICIONAIS pedem conferência; o principal já foi confirmado no próprio campo.
  (ficha?.codigos || []).filter((c) => !c.principal && c.conferido === false).forEach((c) => avisos.push(`Confira o código ${c.codigo} letra por letra (foi ditado).`));
  if (!fotos) avisos.push("Nenhuma foto: adicione no Novo Anúncio.");
  const sit = (ficha?.aplicacoes || []).map((a) => situacaoNaDescricao(a).estado);
  const pend = sit.filter((e) => e === "fora").length;
  const daBase = sit.filter((e) => e === "base").length;
  if (pend) avisos.push(`${pend} aplicação(ões) não conferida(s) ficam de fora da descrição.`);
  if (daBase) avisos.push(`${daBase} aplicação(ões) da Base PAIIA já estão na descrição; confirme na Compatibilidade — a validação do Mercado Livre é feita na Finalizar.`);
  if (!aplicacoesConfirmadas(ficha).length) avisos.push("Nenhuma aplicação conferida: a compatibilidade será feita na Conferência.");
  if (org.medidas.length) avisos.push("Medidas/peso ditos ficam para os campos da plataforma (não vão na descrição).");
  return { pronto: faltando.length === 0, faltando, avisos: [...new Set(avisos)] };
}

/** Peso/medidas ditos, prontos para os Dados técnicos ({ campos, texto, frases, duvidas }) ou null. */
export function pesoMedidasParaEnvio(ficha) {
  const lido = lerPesoEMedidas(organizarDescricao(ficha).medidas);
  const campos = camposDadosTecnicos(lido);
  if (!Object.keys(campos).length) return null;
  return { campos, texto: textoPesoMedidas(lido), frases: lido.frases, duvidas: lido.duvidas };
}

export function mapearRapidoParaNovoAnuncio(ficha, { agora = Date.now() } = {}) {
  const r = estadoRapido(ficha);
  const cp = codigoPrincipal(ficha);
  const preco = Number(ficha?.campos?.preco?.valor);
  const dados = {
    codigo: cp?.codigo || "",
    oem: codigosParaDescricao(ficha).slice(cp ? 1 : 0).join(", "),
    titulo: r.titulo.valor,
    descricao: descricaoParaEnvio(ficha),
    preco: Number.isFinite(preco) && preco > 0 ? preco.toFixed(2).replace(".", ",") : "",
    origemPaiiaVoz: ficha?.id || "",
  };
  // (22/10/2026) Peso/medidas ditos → Dados técnicos do Novo Anúncio (só campos
  // vazios lá; o frete só usa depois da sua conferência).
  const pm = pesoMedidasParaEnvio(ficha);
  if (pm) dados.pesoMedidasVoz = pm;
  const complemento = {
    fichaVozId: ficha?.id || "",
    codigoNormalizado: cp?.normalizado || "",
    marca: txt(ficha?.campos?.marca?.valor) || MARCA_PADRAO,
    quantidadeEstoque: ficha?.campos?.quantidade ? String(ficha.campos.quantidade.valor) : "",
    medidas: organizarDescricao(ficha).medidas,
    em: agora,
  };
  return { dados, complemento };
}
