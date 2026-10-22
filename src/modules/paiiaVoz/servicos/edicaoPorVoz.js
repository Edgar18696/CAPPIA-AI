// =============================================================
// PAIIA Voz — CORRIGIR TEXTO FALANDO (título e descrição).
//   Testes: scripts/testes/paiiaVozRapido.test.mjs
//
//   "acrescenta 12 e 24 volts"         → junta no fim
//   "troca dianteira por traseira"     → substitui o trecho
//   "tira LED" / "apaga LED"           → remove o trecho
//   "apaga tudo" / "começar de novo"   → limpa
//   "desfazer"                         → volta ao texto anterior
// Qualquer outra fala: o padrão da etapa (título = substituir tudo;
// descrição = acrescentar). O teclado continua valendo para tudo.
// =============================================================

import { semAcento } from "./numerosFalados.js";

const n = (s) => semAcento(String(s ?? "")).toLowerCase();

/** Acha "trecho" em "texto" ignorando acento e maiúsculas; devolve [início, fim] ou null. */
export function acharTrecho(texto, trecho) {
  const t = String(texto ?? "");
  const alvo = n(trecho).trim().replace(/\s+/g, " ");
  if (!alvo) return null;
  // normalização caractere a caractere (mesmo tamanho) para mapear posições
  const chars = Array.from(t);
  const norm = chars.map((c) => { const x = n(c); return x.length === 1 ? x : c.toLowerCase(); }).join("");
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${alvo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+")}(?![\\p{L}\\p{N}])`, "u");
  const m = norm.match(re);
  if (!m) return null;
  return [m.index, m.index + m[0].length];
}

const arrumar = (s) => String(s ?? "").replace(/\s+([,.;:!?])/g, "$1").replace(/\s{2,}/g, " ").replace(/^[\s,;:-]+|[\s,;:-]+$/g, "").trim();

// (22/10/2026) Verbos nas formas faladas mais comuns (troca/troque/trocar…).
const V_ACRESCENTAR = "(?:acrescent[ae]r?|adicion[ae]r?|inclu(?:i|a|ir)|coloc[ae]r?|coloque|poe|bot[ae]r?|escrev[ae]r? tambem)";
const V_TROCAR = "(?:troc[ae]r?|troque|substitu(?:i|a|ir)|mud[ae]r?|corrig(?:e|ir)|corrija|alter[ae]r?)";
const V_REMOVER = "(?:tir[ae]r?|remov[ae]r?|apag[ae]r?|apague|exclu(?:i|a|ir)|retir[ae]r?)";
const RE_COMANDO = new RegExp(`^(?:${V_ACRESCENTAR}|${V_TROCAR}|${V_REMOVER}|desfa(?:z|ca|zer)|volta(?:r)? como|limpa(?:r)?|zera(?:r)?|recomecar)(?:\\s|$)`);
// Fala de conversa (não é um título): nunca substitui o título já preenchido.
const RE_CONVERSA = /^(?:o carro|a peca|ela|ele|isso|essa|esse|serve|tem|tenho|nao|sim|pode|quero|acho|aquele|aquela|o que|como|qual|porque|por que|e pra|e para|eu|voce|vou|vamos|ta|esta|ok|beleza|certo)(?:\s|$)/;

/**
 * @param atual texto atual
 * @param fala o que foi dito/digitado
 * @param opcoes { padrao: "substituir"|"acrescentar", separador, anterior, campo: "titulo"|"descricao" }
 * @returns {{ texto, acao, aviso? }}
 *   acao "nao-entendeu": parecia comando, mas não foi entendido — NADA muda.
 *   acao "nao-parece": fala de conversa na etapa Título — NADA muda.
 */
export function editarPorVoz(atual, fala, { padrao = "substituir", separador = " ", anterior = null, campo = "" } = {}) {
  const texto = String(atual ?? "");
  const f = String(fala ?? "").trim().replace(/[.!?]+$/, "").trim();
  const k = n(f);
  if (!k) return { texto, acao: "nada" };

  if (/^(?:apaga(?:r)? tudo|apague tudo|limpa(?:r)?(?: tudo)?|comecar de novo|zera(?:r)?(?: tudo)?|recomecar)$/.test(k)) return { texto: "", acao: "limpar" };
  if (/^(?:desfaz(?:er)?|desfaca|volta(?:r)? como (?:era|estava))$/.test(k)) {
    return anterior !== null && anterior !== undefined ? { texto: String(anterior), acao: "desfazer" } : { texto, acao: "nada", aviso: "Não há o que desfazer." };
  }
  // "o título é …", "muda o título para …", "a descrição é …": troca o texto inteiro.
  let m = k.match(new RegExp(`^(?:(?:${V_TROCAR}|coloc[ae]r?|coloque|bot[ae]r?)\\s+(?:o\\s+|a\\s+)?(titulo|descricao)\\s+(?:para|pra|por|como)\\s+|(?:o\\s+|a\\s+)?(?:novo\\s+|nova\\s+)?(titulo|descricao)\\s+(?:e|eh|sera|fica|vai ser)\\s+|(?:novo\\s+|nova\\s+)?(titulo|descricao)\\s*:\\s*)(.+)$`));
  if (m) {
    const alvo = m[1] || m[2] || m[3];
    if (campo && alvo !== campo) return { texto, acao: "nao-entendeu", aviso: `Você está na etapa ${campo === "titulo" ? "Título" : "Descrição"}. Vá para “${alvo === "titulo" ? "Título" : "Descrição"}” para mudar ${alvo === "titulo" ? "o título" : "a descrição"}. Nada foi alterado.` };
    const novo = f.slice(f.length - m[4].length).trim();
    return { texto: arrumar(novo), acao: "substituir" };
  }
  // "apaga a última frase/linha"
  if (new RegExp(`^${V_REMOVER}\\s+(?:a\\s+|o\\s+)?(?:ultima|ultimo)\\s+(?:frase|linha|parte|trecho|coisa)$`).test(k)) {
    const linhas = texto.split(/\n/);
    if (linhas.length > 1) return { texto: linhas.slice(0, -1).join("\n").trim(), acao: "remover" };
    const frases = texto.split(/(?<=[.!?;])\s+/);
    if (frases.length > 1) return { texto: arrumar(frases.slice(0, -1).join(" ")), acao: "remover" };
    return texto ? { texto: "", acao: "remover" } : { texto, acao: "nada", aviso: "Não há frase para apagar." };
  }
  m = k.match(new RegExp(`^${V_ACRESCENTAR}\\s+(.+)$`));
  if (m) {
    const extra = f.slice(f.length - m[1].length).trim();
    return { texto: arrumar(texto ? `${texto}${separador}${extra}` : extra), acao: "acrescentar" };
  }
  m = k.match(new RegExp(`^${V_TROCAR}\\s+(?:a palavra\\s+|o trecho\\s+)?(.+?)\\s+(?:por|pra|para)\\s+(.+)$`));
  if (m) {
    const posDe = acharTrecho(texto, m[1]);
    if (!posDe) return { texto, acao: "nao-achou", aviso: `Não encontrei “${m[1]}” no texto. Nada foi alterado.` };
    const novo = f.slice(f.length - m[2].length).trim();
    return { texto: arrumar(texto.slice(0, posDe[0]) + novo + texto.slice(posDe[1])), acao: "trocar" };
  }
  m = k.match(new RegExp(`^${V_REMOVER}\\s+(?:a palavra\\s+|o trecho\\s+)?(.+)$`));
  if (m) {
    const pos = acharTrecho(texto, m[1]);
    if (!pos) return { texto, acao: "nao-achou", aviso: `Não encontrei “${m[1]}” no texto. Nada foi alterado.` };
    return { texto: arrumar(texto.slice(0, pos[0]) + " " + texto.slice(pos[1])), acao: "remover" };
  }
  // Começou como comando mas não foi entendido: NUNCA vira texto (nem apaga o que existe).
  if (RE_COMANDO.test(k)) {
    return { texto, acao: "nao-entendeu", aviso: `Não entendi o comando “${f}”. Nada foi alterado. Exemplos: “troca March por Kicks”, “tira LED”, “acrescenta Flex”, “desfaz”.` };
  }
  // Palavras soltas de conversa ("ok", "beleza") não entram no texto.
  if (/^(?:ok|okay|beleza|certo|ta|ta bom|ta certo|isso|uhum|hum|ah|eh|entao|pronto)$/.test(k)) return { texto, acao: "nada" };
  if (padrao === "acrescentar") return { texto: arrumar(texto ? `${texto}${separador}${f}` : f), acao: "acrescentar" };
  // Título já preenchido + fala de conversa: não troca (diga "o título é …").
  if (texto.trim() && RE_CONVERSA.test(k)) {
    return { texto, acao: "nao-parece", aviso: `“${f}” não parece um título. Nada foi alterado. Para trocar, diga “o título é …” ou fale o título completo.` };
  }
  return { texto: arrumar(f), acao: "substituir" };
}

/** "próximo", "continuar", "voltar" — navegação falada entre as etapas. */
export function comandoNavegacao(fala) {
  const k = n(fala).replace(/[.!?]+$/, "").trim();
  if (/^(?:proximo|proxima|continuar|continua|avancar|avanca|pode seguir|seguir|ok proximo|pronto)$/.test(k)) return "proximo";
  if (/^(?:voltar|volta|anterior|etapa anterior)$/.test(k)) return "voltar";
  return null;
}
