// =============================================================
// PAIIA Voz — PACOTE C (03/11/2026): CONVERSA “COMPLETAR A FICHA”.
//   Testes: scripts/testes/paiiaVozCompletar.test.mjs
//
// Depois de fotos, código, título e descrição, o PAIIA pergunta — uma coisa
// por vez — SÓ o que ainda falta e grava na MESMA ficha do Voz:
//   marca → estoque → preço → aplicações → tipo de veículo → peso/medidas →
//   conta → modalidade → (conferências automáticas) → categoria sugerida.
// Regras:
//  • nada é inventado: marca, preço, estoque, aplicações e medidas só o que
//    foi DITO; aplicação tirada da descrição só entra com o seu “sim”;
//  • a qualquer momento dá para corrigir (“na verdade o preço é 42”), pular
//    (“pular”, “não sei”, “depois”) e seguir a conversa;
//  • conferências/categoria/modalidade usam os serviços de sempre (o componente
//    executa a ação pedida aqui); publicação continua exigindo a Revisão.
// Funções puras: sem React, sem rede, sem banco.
// =============================================================

import { aplicarInterpretacao, incluirAplicacao, rechavearAplicacao, confirmarAplicacao, resumoAplicacao, codigoPrincipal } from "./fichaVoz.js";
import { interpretarFala, interpretarAplicacao, separarAplicacoes, MONTADORAS } from "./interpretarFala.js";
import { semAcento, lerPreco, lerInteiro } from "./numerosFalados.js";
import { lerPesoEMedidas } from "./pesoMedidasVoz.js";
import { dadosCompletosVoz } from "./fichaCompletaVoz.js";
import { estadoRapido, definirTextoDescricao, definirTitulo, lerCodigoDaFala, LIMITE_TITULO, pesoMedidasParaEnvio } from "./rascunhoRapido.js";
import { TIPO_CARRO, TIPO_PESADA } from "../../../services/tipoVeiculoAnuncio.js";

export const VERSAO_COMPLETAR = "2026-11-03.1";
const txt = (v) => String(v ?? "").trim();
const norm = (v) => semAcento(String(v ?? "")).toLowerCase().replace(/[.!?]+$/, "").trim();
const copia = (o) => JSON.parse(JSON.stringify(o));
const cap = (s) => txt(s).replace(/\s+/g, " ").replace(/(^|\s)(\p{L})/gu, (m, a, b) => a + b.toUpperCase());

export const RE_PULAR = /^(?:pular|pula|pule|pula essa|nao sei|nao sei agora|nao sei ainda|sei la|nao tenho|nao tenho agora|nao lembro|nao sei dizer|depois|depois eu vejo|deixa pra depois|deixa para depois|deixa pendente|fica pendente|mais tarde|passa|passar)$/;
export const RE_SIM = /^(?:sim|s|isso|isso mesmo|confirmo|confirma|pode|pode sim|pode confirmar|certo|correto|ok|esta certo|ta certo|exato|positivo|beleza|claro)$/;
export const RE_NAO = /^(?:nao|n|nao e|errado|esta errado|ta errado|negativo|nao tem|nenhuma|nenhum|so essa|so esse|so isso|acabou|mais nenhuma|nao tem mais)$/;
const RE_SEM_APLICACAO = /^(?:sem aplicacao|nao tem aplicacao|nao sei a aplicacao|sem compatibilidade)$/;
export const LINHA_MEDIDAS = "Medidas da embalagem:";

/** Contas conhecidas (nomes falados → conta). As contas reais conectadas vêm do componente. */
export function contaDaFala(texto, contas = []) {
  const k = norm(texto);
  const achar = (re) => contas.find((c) => re.test(norm(c.nome)));
  if (/online|onlo|loja on/.test(k)) return achar(/online/)?.id || "";
  if (/\bcie|ciebr|ci e/.test(k)) return achar(/cie/)?.id || "";
  if (/revela/.test(k)) return achar(/revela/)?.id || "";
  return "";
}

export function estadoCompletar(ficha) {
  const c = ficha?.completar || {};
  return {
    pulados: Array.isArray(c.pulados) ? c.pulados : [],
    historico: Array.isArray(c.historico) ? c.historico : [],
    conta: txt(c.conta),
    modalidade: c.modalidade === "premium" || c.modalidade === "classico" ? c.modalidade : "",
    tipoVeiculo: [TIPO_CARRO, TIPO_PESADA].includes(c.tipoVeiculo) ? c.tipoVeiculo : "",
    peso: c.peso && typeof c.peso === "object" ? c.peso : {},
    aplicacoesFim: Boolean(c.aplicacoesFim),
    conferencia: c.conferencia && typeof c.conferencia === "object" ? c.conferencia : null,
  };
}

/** O que a conferência precisa estar em dia (mudou → confere de novo). */
export function assinaturaCompletar(ficha, { fotos = 0 } = {}) {
  const d = dadosCompletosVoz(ficha, { fotos });
  const c = estadoCompletar(ficha);
  return JSON.stringify([codigoPrincipal(ficha)?.codigo || "", estadoRapido(ficha).titulo.valor, d.marca, d.quantidade, d.preco, d.tipoVeiculo, d.medida, d.aplicacoes.map((a) => [a.montadora, a.modelo, a.anoInicio, a.anoFim]), c.conta, c.modalidade, fotos]);
}

function candidataAplicacao(ficha) {
  return (ficha?.aplicacoes || []).find((a) => !a.confirmada && !a.recusada) || null;
}

/** Veículo com ano escrito na descrição (ex.: “Master 3 2012 a 2026”) ainda não oferecido. Nunca vira aplicação sem o seu “sim”. */
export function aplicacaoNaDescricao(ficha) {
  const recusadas = (estadoCompletarBruto(ficha).descricaoRecusadas || []).map(norm);
  // o nome da peça (1ª palavra do título, ex.: “Presilha”) não faz parte do modelo
  const peca = norm(estadoRapido(ficha).titulo.valor.split(/\s+/)[0] || "");
  for (const linha of String(estadoRapido(ficha).descricao.texto || "").split(/\n+/)) {
    const l = txt(linha);
    if (!l || norm(l).startsWith(norm(LINHA_MEDIDAS)) || !/\b(19|20)\d{2}\b/.test(l) || l.length > 80) continue;
    // só o trecho com o ano (ex.: “presilha do acabamento lateral, Renault Master 3 2012 a 2026” → “Renault Master 3 2012 a 2026”)
    const trecho = txt(l.split(/[,;]/).find((x) => /\b(19|20)\d{2}\b/.test(x)) || l);
    const l2 = peca.length >= 4 ? trecho.replace(/^([^\s]+)\s+/, (m, w) => (norm(w) === peca ? "" : m)) : trecho;
    if ([l, l2].some((x) => recusadas.includes(norm(x)) || (ficha?.aplicacoes || []).some((a) => norm(a.texto) === norm(x)))) continue;
    const ap = interpretarAplicacao(l2);
    if (ap && ap.modelos.length && ap.modelos.join(" ").length <= 30) return { ...ap, texto: l2 };
  }
  return null;
}
const estadoCompletarBruto = (ficha) => (ficha?.completar && typeof ficha.completar === "object" ? ficha.completar : {});

/**
 * Próxima pergunta (só o que falta). null = nada mais a perguntar.
 * @returns {{ campo, texto, apId?, acao? } | null}
 */
export function proximaPerguntaCompletar(ficha, { fotos = 0 } = {}) {
  const c = estadoCompletar(ficha);
  const pulou = (x) => c.pulados.includes(x);
  const d = dadosCompletosVoz(ficha, { fotos });
  if (!codigoPrincipal(ficha) && !pulou("codigo")) return { campo: "codigo", texto: "Qual é o código da peça? Fale ou digite; para traço, diga “traço”." };
  if (!estadoRapido(ficha).titulo.valor && !pulou("titulo")) return { campo: "titulo", texto: "Qual é o título do anúncio? (até 60 caracteres)" };
  // (03/11) Fluxo único: código → título → descrição → marca, preço, estoque → peso → medidas → aplicações.
  if (!txt(estadoRapido(ficha).descricao.texto) && !pulou("descricao")) return { campo: "descricao", texto: "Descreva a peça em poucas palavras (o que é, lado, detalhes)." };
  if (!d.marca && !pulou("marca")) return { campo: "marca", texto: "Qual é a marca da peça?" };
  if (!d.preco && !pulou("preco")) return { campo: "preco", texto: "Qual é o preço de venda?" };
  if (!d.quantidade && !pulou("quantidade")) return { campo: "quantidade", texto: "Quantas unidades você tem em estoque?" };
  // Peso e as 3 medidas da embalagem: perguntas separadas (o que já foi dito, em qualquer lugar, conta).
  if (!d.medida && !pulou("pesoMedidas")) {
    const pm = pesoMedidasParaEnvio(ficha)?.campos || {};
    if (!pm.pesoFreteML && !pulou("peso")) return { campo: "peso", texto: "Qual é o peso da peça já embalada? Ex.: 200 gramas ou 1,2 quilo." };
    const faltam = [["comprimentoFreteML", "comprimento"], ["larguraFreteML", "largura"], ["alturaFreteML", "altura"]].filter(([k]) => !pm[k]).map(([, r]) => r);
    if (faltam.length && !pulou("medidas")) return { campo: "medidas", texto: faltam.length === 3 ? "Quais são as medidas da embalagem: comprimento, largura e altura? Ex.: 20 por 10 por 5 centímetros." : `Falta ${faltam.join(" e ")} da embalagem (em centímetros).` };
  }
  const cand = candidataAplicacao(ficha);
  if (cand && !pulou("aplicacao")) {
    const resumo = resumoAplicacao(cand);
    if (!txt(cand.montadora)) return { campo: "montadora", apId: cand.id, texto: `${(cand.modelos || []).join(" / ") || "Esse veículo"} é de qual montadora?` };
    return { campo: "confirmarAplicacao", apId: cand.id, texto: `${cand.aceita ? "Confere" : "Tenho"} a aplicação ${cand.montadora} ${resumo}${cand.origem === "usuario" ? "" : ` (${(cand.fontes || [])[0] || "base"})`}. Confirmo?` };
  }
  const daDescricao = !d.aplicacoes.length && !pulou("aplicacao") ? aplicacaoNaDescricao(ficha) : null;
  if (daDescricao) return { campo: "aplicacaoDescricao", texto: `Na descrição tem “${daDescricao.texto}”. É a aplicação da peça?` };
  if (!d.aplicacoes.length && !pulou("aplicacao")) return { campo: "aplicacao", texto: "Para qual veículo é a peça? Diga montadora, modelo e anos (ex.: Renault Master 2013 a 2022). Se não tiver, diga “sem aplicação”." };
  if (d.aplicacoes.length && !c.aplicacoesFim && !pulou("aplicacao")) return { campo: "maisAplicacao", texto: "Tem mais alguma aplicação? Diga o veículo ou “não”." };
  if (!d.tipoVeiculo && !pulou("tipoVeiculo")) return { campo: "tipoVeiculo", texto: "É peça de carro (ou caminhonete) ou de linha pesada?" };
  if (!c.conta && !pulou("conta")) return { campo: "conta", texto: "Em qual conta vai publicar: Loja Online, CIEBR ou Revelação?" };
  if (!c.modalidade && !pulou("modalidade")) return { campo: "modalidade", texto: "Premium ou Clássico? A loja usa Premium." };
  if (!c.conta) return null;
  // Conferências automáticas (só leitura) — o componente executa e devolve o resultado.
  const assin = assinaturaCompletar(ficha, { fotos });
  if (!c.conferencia || c.conferencia.assinatura !== assin) return { campo: "conferir", acao: "conferir", texto: "Conferindo categoria, duplicidade, Bling e frete…" };
  // Sem tipo de veículo o Mercado Livre não sugere categoria: pergunta de novo, uma vez.
  if (!d.tipoVeiculo && !pulou("tipoCategoria") && (c.conferencia.pendencias || []).some((p) => /Categoria: diga o tipo/i.test(p))) return { campo: "tipoCategoria", texto: "Para achar a categoria preciso do tipo de veículo: carro (ou caminhonete) ou linha pesada?" };
  if (c.conferencia.sugerida && !pulou("categoria")) return { campo: "categoria", texto: `A categoria sugerida é ${c.conferencia.sugerida}. Confirmo?` };
  // Modelo que o catálogo de veículos do Mercado Livre não reconheceu: pergunta o nome como aparece lá.
  if (c.conferencia.compatSemCatalogo && !pulou("compatModelo")) {
    const a = (ficha?.aplicacoes || []).find((x) => x.confirmada);
    if (a) return { campo: "compatModelo", apId: a.id, texto: `O Mercado Livre não achou “${(a.modelos || []).join(" / ")}” no catálogo de veículos. Diga o modelo como aparece lá (ex.: “Master”), ou “pular” para decidir na revisão.` };
  }
  return null;
}

/** Texto final quando não há mais perguntas. */
export function fimCompletar(ficha, { fotos = 0 } = {}) {
  const c = estadoCompletar(ficha);
  const d = dadosCompletosVoz(ficha, { fotos });
  // O que você deixou pendente aparece uma vez só (sem repetir o mesmo assunto da conferência).
  const pul = new Set(c.pulados);
  const repetida = (t) => ((pul.has("peso") || pul.has("medidas") || pul.has("pesoMedidas")) && /^(Frete: falta|Peso e medidas)/i.test(t))
    || (pul.has("aplicacao") && /^Compatibilidade: nenhuma aplica/i.test(t))
    || ((pul.has("tipoVeiculo") || pul.has("tipoCategoria")) && /^(Tipo de veículo|Categoria: diga o tipo)/i.test(t));
  const faltam = (c.conferencia?.pendencias || []).filter((t) => !repetida(t));
  // pendente que depois foi respondido (ex.: tipo de veículo dito na categoria) não aparece
  const respondido = { marca: d.marca, quantidade: d.quantidade, preco: d.preco, tipoVeiculo: d.tipoVeiculo, tipoCategoria: d.tipoVeiculo, aplicacao: d.aplicacoes.length, peso: d.medida, medidas: d.medida, pesoMedidas: d.medida, conta: c.conta, modalidade: c.modalidade };
  const aindaPendentes = [...new Set(c.pulados.filter((p) => !respondido[p]).map((p) => ROTULO[p] || p))];
  if (aindaPendentes.length) faltam.unshift(`você deixou pendente: ${aindaPendentes.join(", ")}`);
  if (!faltam.length && d.completa) return { pronto: true, texto: "Tudo conferido! Confira a revisão abaixo e toque em “Aprovar revisão”." };
  return { pronto: false, texto: `Quase pronto. Ainda falta: ${faltam.join("; ") || d.pendencias.join("; ")}` };
}

const ROTULO = { descricao: "descrição", compatModelo: "modelo no catálogo", codigo: "código", titulo: "título", marca: "marca", quantidade: "estoque", preco: "preço", aplicacao: "aplicações", tipoVeiculo: "tipo de veículo", pesoMedidas: "peso/medidas", peso: "peso", medidas: "medidas da embalagem", tipoCategoria: "tipo de veículo (categoria)", conta: "conta", modalidade: "modalidade", categoria: "categoria" };

/** Abertura: o que já tem + a primeira pergunta. */
export function aberturaCompletar(ficha, { fotos = 0 } = {}) {
  const tem = [];
  if (fotos) tem.push("suas fotos");
  if (codigoPrincipal(ficha)) tem.push("código");
  if (estadoRapido(ficha).titulo.valor) tem.push("título");
  const p = proximaPerguntaCompletar(ficha, { fotos });
  const ja = tem.length ? `Já tenho ${tem.length > 1 ? `${tem.slice(0, -1).join(", ")} e ${tem.at(-1)}` : tem[0]}. ` : "";
  return { texto: `${ja}${p ? p.texto : fimCompletar(ficha, { fotos }).texto}`, pergunta: p };
}

function comCompletar(ficha, mudar) {
  const f = copia(ficha);
  f.completar = { ...estadoCompletar(f), ...(f.completar || {}) };
  mudar(f.completar, f);
  return f;
}

function linhaMedidas(p) {
  const partes = [];
  if (p.peso_g > 0) partes.push(`${p.peso_g} g`);
  if (p.comprimento_cm > 0 && p.largura_cm > 0 && p.altura_cm > 0) partes.push(`${p.comprimento_cm} x ${p.largura_cm} x ${p.altura_cm} cm`);
  else for (const [k, r] of [["comprimento_cm", "comprimento"], ["largura_cm", "largura"], ["altura_cm", "altura"]]) if (p[k] > 0) partes.push(`${r} ${p[k]} cm`);
  return partes.length ? `${LINHA_MEDIDAS} ${partes.join(", ")}` : "";
}

/** Grava peso/medidas como UMA linha da descrição (a mesma leitura de sempre a separa para os campos). */
function gravarMedidas(f, novos) {
  const atual = estadoCompletar(f).peso;
  const p = { ...atual };
  for (const k of ["peso_g", "comprimento_cm", "largura_cm", "altura_cm"]) if (novos[k] > 0) p[k] = novos[k];
  const r = estadoRapido(f);
  const linhas = String(r.descricao.texto || "").split("\n").filter((l) => !norm(l).startsWith(norm(LINHA_MEDIDAS)));
  while (linhas.length && !linhas.at(-1).trim()) linhas.pop();
  const g = definirTextoDescricao(f, [...linhas, linhaMedidas(p)].filter((l, i) => i > 0 || l.trim()).join("\n"));
  g.completar = { ...estadoCompletar(f), ...(f.completar || {}), peso: p };
  return g;
}

/** Campos ditos (marca/preço/estoque) em qualquer resposta, inclusive várias juntas: "marca Torken, 10 peças, 39,90". */
function camposDitos(texto, campoAtual) {
  const itens = [];
  const partes = String(texto ?? "").split(/;|,(?!\d)|\s+e\s+(?=(?:marca|pre[cç]o|estoque|quantidade|r\$|\d))/i).map(txt).filter(Boolean);
  for (const parte of partes) {
    const k = norm(parte);
    const r = interpretarFala(parte);
    const ok = r.itens.filter((i) => ["marca", "preco", "quantidade"].includes(i.campo));
    if (ok.length && !r.naoEntendido.some((x) => /\d/.test(x))) { itens.push(...ok); continue; }
    const q = k.match(/^(?:tenho|sao|e|estoque de|estoque)?\s*(\d{1,5})\s*(?:unidades?|pecas?|un|pcs?|no estoque|em estoque)$/);
    if (q) { itens.push({ campo: "quantidade", valor: Number(q[1]) }); continue; }
    if (/^(?:r\$|rs)\s*\d|\d\s*reais\b|^\d+,\d{2}$/.test(k) || (campoAtual === "preco" && lerPreco(parte.replace(/^(?:o\s+)?(?:pre[cç]o\s+)?(?:[eé]\s+)?/i, "")) !== null)) {
      const v = lerPreco(parte.replace(/^(?:o\s+)?(?:pre[cç]o\s+)?(?:[eé]\s+)?/i, "").replace(/reais?/i, ""));
      if (v !== null && v > 0) { itens.push({ campo: "preco", valor: v }); continue; }
    }
    if (campoAtual === "quantidade") {
      const v = lerInteiro(parte.replace(/^(?:tenho|s[aã]o|[eé])\s+/i, ""));
      if (v !== null && v > 0) { itens.push({ campo: "quantidade", valor: v }); continue; }
    }
    if (campoAtual === "marca" && partes.length === 1) {
      const m = txt(parte.replace(/^(?:a\s+)?(?:marca\s+)?(?:[eé]\s+)?(?:da\s+)?/i, ""));
      if (m && m.length <= 40 && !/\d{3,}/.test(m) && !RE_SIM.test(norm(m)) && !RE_NAO.test(norm(m))) itens.push({ campo: "marca", valor: cap(m) });
    }
  }
  return itens;
}

function tipoDaFala(k) {
  if (/linha pesada|pesad|caminhao|onibus|carreta|cavalo|trator|micro ?onibus/.test(k)) return TIPO_PESADA;
  if (/\bcarro|caminhonete|picape|pickup|utilitario|suv\b|passeio/.test(k)) return TIPO_CARRO;
  return "";
}

function montadoraDaFala(texto) {
  const k = ` ${norm(texto)} `;
  for (const mt of MONTADORAS) {
    if (new RegExp(`(?<![a-z0-9])${mt.replace(/[-\s]/g, "[-\\s]?")}(?![a-z0-9])`).test(k)) return mt === "vw" ? "Volkswagen" : mt === "gm" ? "Chevrolet" : cap(mt);
  }
  const t = txt(texto).replace(/^(?:[eé]\s+)?(?:da\s+|de\s+)?/i, "");
  return t && t.length <= 25 && !/\d/.test(t) ? cap(t) : "";
}

/**
 * Responde à fala/digitação durante a conversa.
 * @returns {{ ficha, resposta, pergunta, acao?, anotado[] }}
 */
export function responderCompletar(ficha, texto, { fotos = 0, contas = [], agora = Date.now(), origem = "voz" } = {}) {
  const fala = txt(texto);
  const k = norm(fala);
  const atual = proximaPerguntaCompletar(ficha, { fotos });
  let f = copia(ficha);
  const anotado = [];
  let acao = "";
  if (!fala) return { ficha: f, resposta: "", pergunta: atual, anotado };

  if (RE_PULAR.test(k) && atual) {
    // Todas as perguntas de aplicação contam como “aplicações” (senão a mesma pergunta voltaria).
    const chave = ["maisAplicacao", "aplicacaoDescricao", "montadora", "confirmarAplicacao"].includes(atual.campo) ? "aplicacao" : atual.campo;
    f = comCompletar(f, (c) => { if (!c.pulados.includes(chave)) c.pulados.push(chave); });
    anotado.push(`${ROTULO[chave] || "isso"} fica pendente`);
  } else {
    // 1) Marca, preço e estoque ditos a qualquer momento (corrige o que já estava).
    const itens = camposDitos(fala, atual?.campo);
    if (itens.length) {
      f = aplicarInterpretacao(f, { itens, naoEntendido: [], avisos: [] }, { origem, agora, textoOriginal: fala }).ficha;
      for (const i of itens) anotado.push(i.campo === "preco" ? `preço R$ ${Number(i.valor).toFixed(2).replace(".", ",")}` : i.campo === "quantidade" ? `estoque ${i.valor}` : `marca ${i.valor}`);
    }
    // 2) Peso/medidas ditos a qualquer momento.
    const pm = lerPesoEMedidas([fala]);
    const temMedida = ["peso_g", "comprimento_cm", "largura_cm", "altura_cm"].some((x) => pm[x] > 0);
    if (temMedida && (["pesoMedidas", "peso", "medidas"].includes(atual?.campo) || /\b(g|gr|gramas?|kg|quilos?|cm|centimetros?|mm|milimetros?|peso|pesa|medidas?|embalagem)\b/.test(k))) {
      f = gravarMedidas(f, pm);
      anotado.push(`peso/medidas (${[pm.peso_g > 0 && `${pm.peso_g} g`, pm.comprimento_cm > 0 && `${pm.comprimento_cm} × ${pm.largura_cm || "?"} × ${pm.altura_cm || "?"} cm`].filter(Boolean).join(", ")})`);
    }
    // 3) Resposta à pergunta atual.
    const campo = atual?.campo;
    if (campo === "descricao" && !itens.length && !temMedida) {
      const atualTxt = String(estadoRapido(f).descricao.texto || "");
      f = definirTextoDescricao(f, [atualTxt.trim(), fala].filter(Boolean).join("\n"));
      anotado.push("descrição");
    } else if (campo === "codigo" && !itens.length) {
      const c = lerCodigoDaFala(fala, { falado: origem === "voz" });
      if (c.codigo) {
        f = aplicarInterpretacao(f, { itens: [{ campo: "codigoPrincipal", valor: c.codigo, soletrado: c.soletrado, duvidas: c.duvidas }], naoEntendido: [], avisos: [] }, { origem, agora, textoOriginal: fala }).ficha;
        anotado.push(`código ${c.codigo}${c.soletrado ? " (confira letra por letra)" : ""}`);
      }
    } else if (campo === "titulo" && !itens.length) {
      const t = txt(fala).replace(/^(?:o\s+)?t[ií]tulo\s+(?:[eé]\s+)?/i, "").slice(0, LIMITE_TITULO);
      if (t.length >= 8 && !RE_SIM.test(k) && !RE_NAO.test(k)) { f = definirTitulo(f, cap(t), { origem, agora }); anotado.push(`título “${cap(t)}”`); }
    } else if (campo === "compatModelo" && !itens.length) {
      const a = f.aplicacoes.find((x) => x.id === atual.apId);
      const modelo = cap(txt(fala).replace(/^(?:o\s+)?(?:modelo\s+)?(?:[eé]\s+)?/i, ""));
      if (a && modelo && norm(modelo) === norm((a.modelos || []).join(" "))) {
        // mesmo nome de novo: não insiste; fica para decidir na revisão
        f = comCompletar(f, (c) => { if (!c.pulados.includes("compatModelo")) c.pulados.push("compatModelo"); });
        anotado.push("o modelo continua o mesmo; a compatibilidade fica para a revisão");
      } else if (a && modelo && modelo.length <= 30 && !RE_SIM.test(k) && !RE_NAO.test(k)) {
        // a aplicação antiga sai; a nova (mesma montadora, motor e anos) só vale com o seu “sim”
        a.confirmada = false;
        a.recusada = true;
        anotarAplicacao(f, { texto: `${a.montadora} ${modelo}`, montadora: a.montadora, modelos: [modelo], motores: a.motores || [], anoInicio: a.anoInicio, anoFim: a.anoFim, tipoVeiculo: a.tipoVeiculo || "" }, agora);
        f = comCompletar(f, (c) => { if (c.conferencia) c.conferencia = { ...c.conferencia, compatSemCatalogo: false }; });
        anotado.push(`modelo ${modelo}`);
      }
    } else if (campo === "montadora" && !itens.length && RE_NAO.test(k)) {
      const a = f.aplicacoes.find((x) => x.id === atual.apId);
      if (a) a.recusada = true;
      anotado.push("aplicação descartada (não entra no anúncio)");
    } else if (campo === "montadora" && !itens.length) {
      const m = montadoraDaFala(fala);
      if (m) {
        const a = f.aplicacoes.find((x) => x.id === atual.apId);
        if (a) {
          a.montadora = m;
          rechavearAplicacao(f, a.id);
          anotado.push(`montadora ${m}`);
        }
      }
    } else if (campo === "confirmarAplicacao" && !itens.length) {
      if (RE_SIM.test(k)) { f = confirmarAplicacao(f, atual.apId, true, { agora }); anotado.push("aplicação confirmada"); }
      else if (RE_NAO.test(k)) { const a = f.aplicacoes.find((x) => x.id === atual.apId); if (a) a.recusada = true; anotado.push("aplicação descartada (não entra no anúncio)"); }
      else {
        // Corrigiu dizendo o veículo certo: descarta a sugerida e anota a dita.
        const novas = aplicacoesDitas(fala);
        if (novas.length) { const a = f.aplicacoes.find((x) => x.id === atual.apId); if (a) a.recusada = true; for (const ap of novas) { anotarAplicacao(f, ap, agora); anotado.push(`aplicação ${[ap.montadora, resumoAplicacao(ap)].filter(Boolean).join(" ")}`); } }
      }
    } else if (campo === "aplicacaoDescricao" && !itens.length) {
      const cand = aplicacaoNaDescricao(f);
      if (cand && RE_SIM.test(k)) {
        anotarAplicacao(f, cand, agora);
        anotado.push(`aplicação ${resumoAplicacao(cand)}${cand.montadora ? "" : " (falta a montadora)"}`);
      } else if (cand && RE_NAO.test(k)) {
        f = comCompletar(f, (c) => { c.descricaoRecusadas = [...(c.descricaoRecusadas || []), cand.texto]; });
        anotado.push("essa linha não é aplicação");
      } else {
        const novas = aplicacoesDitas(fala);
        if (novas.length && cand) f = comCompletar(f, (c) => { c.descricaoRecusadas = [...(c.descricaoRecusadas || []), cand.texto]; });
        for (const ap of novas) { anotarAplicacao(f, ap, agora); anotado.push(`aplicação ${[ap.montadora, resumoAplicacao(ap)].filter(Boolean).join(" ")}`); }
      }
    } else if ((campo === "aplicacao" || campo === "maisAplicacao") && !itens.length && !temMedida) {
      if (RE_SEM_APLICACAO.test(k) || (campo === "aplicacao" && RE_NAO.test(k))) { f = comCompletar(f, (c) => { if (!c.pulados.includes("aplicacao")) c.pulados.push("aplicacao"); }); anotado.push("sem aplicação (a compatibilidade fica pendente)"); }
      else if (campo === "maisAplicacao" && RE_NAO.test(k)) { f = comCompletar(f, (c) => { c.aplicacoesFim = true; }); anotado.push("aplicações encerradas"); }
      else {
        const novas = aplicacoesDitas(fala);
        for (const ap of novas) {
          anotarAplicacao(f, ap, agora); // confirmada só com o seu “sim” para o texto completo
          anotado.push(`aplicação ${[ap.montadora, resumoAplicacao(ap)].filter(Boolean).join(" ")}`);
        }
      }
    } else if (campo === "tipoVeiculo" || campo === "tipoCategoria") {
      const t = tipoDaFala(k);
      if (t) { f = comCompletar(f, (c) => { c.tipoVeiculo = t; }); anotado.push(`tipo ${t}`); }
    } else if (campo === "conta") {
      const id = contaDaFala(fala, contas);
      if (id) { f = comCompletar(f, (c) => { c.conta = id; }); anotado.push(`conta ${contas.find((x) => x.id === id)?.nome || id}`); }
    } else if (campo === "modalidade") {
      const m = /classic/.test(k) ? "classico" : /premium|premio|primeiro|^pode|^sim|^isso|^ok/.test(k) ? "premium" : "";
      if (m) { f = comCompletar(f, (c) => { c.modalidade = m; }); anotado.push(m === "premium" ? "Premium" : "Clássico"); }
    } else if (campo === "categoria") {
      if (RE_SIM.test(k)) {
        acao = "confirmarCategoria";
        f = comCompletar(f, (c) => { if (c.conferencia) c.conferencia = { ...c.conferencia, sugerida: "" }; });
        anotado.push("categoria (confirmando e conferindo de novo…)");
      }
      else if (RE_NAO.test(k)) { f = comCompletar(f, (c) => { if (!c.pulados.includes("categoria")) c.pulados.push("categoria"); }); anotado.push("categoria fica para conferir na revisão"); }
    }
  }
  const pergunta = proximaPerguntaCompletar(f, { fotos });
  let resposta;
  if (!anotado.length) resposta = `Não entendi. ${atual ? atual.texto : ""}${atual && atual.campo !== "conferir" ? " (Se não souber, diga “pular”.)" : ""}`.trim();
  else resposta = `Anotei: ${anotado.join(", ")}.${acao ? "" : ` ${pergunta ? pergunta.texto : fimCompletar(f, { fotos }).texto}`}`;
  f = comCompletar(f, (c) => {
    c.historico = [...c.historico, { quem: "voce", texto: fala }, { quem: "paiia", texto: resposta }].slice(-12);
  });
  return { ficha: f, resposta, pergunta, acao: acao || pergunta?.acao || "", anotado };
}

/**
 * Aplicação dita/aceita na conversa: anotada SEM confirmar. Ela só vai para a ficha
 * depois do seu “sim” para o texto completo (montadora, modelo, motor e anos).
 */
function anotarAplicacao(f, ap, agora) {
  const r = incluirAplicacao(f, ap, { origem: "usuario", agora, confirmada: false });
  const a = f.aplicacoes.find((x) => x.id === r.id);
  if (a) { a.aceita = true; a.recusada = false; }
  return a;
}

function aplicacoesDitas(fala0) {
  // “não, é Renault Master 2014 a 2022” / “na verdade é …” → só o veículo
  const fala = txt(fala0).replace(/^(?:n[aã]o|na verdade|errado|corrig\w*)[\s,.;:!-]*/i, "").replace(/^(?:[eé]|seria|serve (?:no|na|para))\s+/i, "");
  const lista = separarAplicacoes(fala).length ? separarAplicacoes(fala) : [interpretarAplicacao(fala)].filter(Boolean);
  return lista.filter((a) => a && (a.modelos || []).length);
}

/** Registra o resultado da conferência (vinda da Revisão de sempre) na conversa. */
export function registrarConferencia(ficha, { fotos = 0, revisao, sugerida = "" } = {}) {
  const pend = (revisao?.pendencias || []).filter((p) => p.tipo !== "aviso" && !(p.id === "categoria" && sugerida) && p.id !== "modalidade").map((p) => p.texto);
  return comCompletar(ficha, (c) => {
    const compat = (revisao?.pendencias || []).find((p) => p.id === "compatibilidade");
    c.conferencia = { assinatura: assinaturaCompletar(ficha, { fotos }), pendencias: pend, sugerida: txt(sugerida), compatSemCatalogo: Boolean(compat && /n[aã]o encontrad[oa] no cat[aá]logo/i.test(compat.texto || "")), em: new Date().toISOString() };
  });
}

/** Acrescenta uma fala do PAIIA ao histórico (abertura/resultado das ações). */
export function anotarFalaPaiia(ficha, texto) {
  return comCompletar(ficha, (c) => { c.historico = [...c.historico, { quem: "paiia", texto: txt(texto) }].slice(-12); });
}

/**
 * (03/11) Campos visíveis da ficha, na ordem do fluxo, com o valor atual (ou vazio)
 * e qual está sendo perguntado agora. Só leitura.
 */
export function camposDaFicha(ficha, { fotos = 0 } = {}) {
  const d = dadosCompletosVoz(ficha, { fotos });
  const c = estadoCompletar(ficha);
  const r = estadoRapido(ficha);
  const pm = pesoMedidasParaEnvio(ficha)?.campos || {};
  const atual = proximaPerguntaCompletar(ficha, { fotos })?.campo || "";
  const grupo = { aplicacaoDescricao: "aplicacoes", aplicacao: "aplicacoes", montadora: "aplicacoes", confirmarAplicacao: "aplicacoes", maisAplicacao: "aplicacoes", compatModelo: "aplicacoes", tipoCategoria: "tipo", tipoVeiculo: "tipo", categoria: "categoria", conferir: "categoria" };
  const desc = txt(r.descricao.texto).split("\n").filter((l) => !norm(l).startsWith(norm(LINHA_MEDIDAS))).join(" ").slice(0, 70);
  const lista = [
    ["fotos", "Fotos", fotos ? `${fotos}` : ""],
    ["codigo", "Código", codigoPrincipal(ficha)?.codigo || ""],
    ["titulo", "Título", r.titulo.valor],
    ["descricao", "Descrição", desc],
    ["marca", "Marca", d.marca],
    ["preco", "Preço", d.preco ? `R$ ${d.preco}` : ""],
    ["quantidade", "Estoque", d.quantidade],
    ["peso", "Peso", pm.pesoFreteML ? `${pm.pesoFreteML} kg` : ""],
    ["medidas", "Medidas (C × L × A)", [pm.comprimentoFreteML, pm.larguraFreteML, pm.alturaFreteML].some(Boolean) ? `${pm.comprimentoFreteML || "?"} × ${pm.larguraFreteML || "?"} × ${pm.alturaFreteML || "?"} cm` : ""],
    ["aplicacoes", "Aplicações", d.aplicacoes.map((a) => [a.montadora, a.modelo, a.anoInicio && a.anoFim ? `${a.anoInicio}–${a.anoFim}` : a.anoInicio].filter(Boolean).join(" ")).join("; ")],
    ["tipo", "Tipo de veículo", d.tipoVeiculo],
    ["conta", "Conta", c.conta ? (c.conta === "1729335019" ? "LOJA ONLINE" : c.conta === "824312524" ? "CIEBR" : c.conta === "2412238242" ? "REVELAÇÃO" : c.conta) : ""],
    ["modalidade", "Modalidade", c.modalidade === "premium" ? "Premium" : c.modalidade === "classico" ? "Clássico" : ""],
  ];
  return lista.map(([id, rotulo, valor]) => ({
    id, rotulo, valor: txt(valor),
    pendente: !txt(valor) && (c.pulados.includes(id) || (id === "aplicacoes" && c.pulados.includes("aplicacao")) || (id === "tipo" && (c.pulados.includes("tipoVeiculo") || c.pulados.includes("tipoCategoria"))) || (["peso", "medidas"].includes(id) && c.pulados.includes("pesoMedidas"))),
    atual: (grupo[atual] || atual) === id,
  }));
}

// ---------------------------------------------------------------
// (04/11/2026) Campos da ficha preenchidos DIRETAMENTE (toque no campo e fale
// ou digite). Mesmas regras da conversa: só o que foi dito; nada é inventado.
// ---------------------------------------------------------------
export const CAMPOS_DIRETOS = Object.freeze([
  { id: "marca", rotulo: "Marca", etapa: "preco" },
  { id: "preco", rotulo: "Preço de venda (R$)", etapa: "preco" },
  { id: "custo", rotulo: "Custo (R$)", opcional: true, etapa: "preco" },
  { id: "quantidade", rotulo: "Estoque (quantidade a anunciar)", etapa: "preco" },
  { id: "peso", rotulo: "Peso embalado (gramas)", etapa: "envio" },
  { id: "comprimento", rotulo: "Comprimento (cm)", etapa: "envio" },
  { id: "largura", rotulo: "Largura (cm)", etapa: "envio" },
  { id: "altura", rotulo: "Altura (cm)", etapa: "envio" },
  { id: "aplicacoes", rotulo: "Veículo e anos (diga e marque abaixo)", etapa: "compat" },
]);
/** Campos diretos de uma etapa (04/11: 7 etapas). */
export const camposDaEtapa = (etapa) => CAMPOS_DIRETOS.filter((c) => c.etapa === etapa);

const virg = (v) => String(v ?? "").replace(".", ",");

/** Valores atuais dos campos diretos (para mostrar nos campos). */
export function valoresCamposDiretos(ficha) {
  const d = dadosCompletosVoz(ficha, { fotos: 1 });
  const pm = pesoMedidasParaEnvio(ficha)?.campos || {};
  const g = pm.pesoFreteML ? Math.round(Number(String(pm.pesoFreteML).replace(",", ".")) * 1000) : "";
  const aps = ficha?.aplicacoes || [];
  return {
    marca: d.marca, preco: d.preco, custo: d.custo || "", quantidade: d.quantidade,
    aplicacoes: aps.length ? `${aps.filter((a) => a.confirmada).length} confirmada(s) de ${aps.filter((a) => !a.recusada).length}: ${aps.filter((a) => !a.recusada).map((a) => [a.montadora, resumoAplicacao(a)].filter(Boolean).join(" ")).join("; ")}` : "",
    peso: g ? String(g) : "",
    comprimento: pm.comprimentoFreteML || "", largura: pm.larguraFreteML || "", altura: pm.alturaFreteML || "",
  };
}

/**
 * Grava UM campo a partir do que foi dito/digitado nele.
 * @returns {{ ficha, ok, erro?, valor? }}
 */
export function definirCampoDireto(ficha, campoId, texto, { origem = "voz", agora = Date.now() } = {}) {
  const t = txt(texto).replace(/[.!?]+$/, "");
  if (!t) return { ficha, ok: false, erro: "Não ouvi nada. Fale de novo ou digite." };
  let f = ficha;
  const item = (campo, valor) => aplicarInterpretacao(f, { itens: [{ campo, valor }], naoEntendido: [], avisos: [] }, { origem, agora, textoOriginal: t }).ficha;
  if (campoId === "marca") {
    const m = cap(t.replace(/^(?:a\s+)?(?:marca\s+)?(?:[eé]\s+)?(?:da\s+)?/i, ""));
    if (!m || m.length > 40) return { ficha, ok: false, erro: "Não entendi a marca." };
    return { ficha: item("marca", m), ok: true, valor: m };
  }
  if (campoId === "preco") {
    const v = lerPreco(t.replace(/^(?:o\s+)?(?:pre[cç]o\s+)?(?:[eé]\s+)?/i, "").replace(/\s*reais?\b/i, ""));
    if (!(v > 0)) return { ficha, ok: false, erro: "Não entendi o preço (ex.: 39,90)." };
    return { ficha: item("preco", v), ok: true, valor: Number(v).toFixed(2).replace(".", ",") };
  }
  if (campoId === "custo") {
    const v = lerPreco(t.replace(/^(?:o\s+)?(?:pre[cç]o\s+de\s+)?(?:custo\s+)?(?:[eé]\s+)?/i, "").replace(/\s*reais?\b/i, ""));
    if (!(v > 0)) return { ficha, ok: false, erro: "Não entendi o custo (ex.: 12,50)." };
    return { ficha: item("custo", v), ok: true, valor: Number(v).toFixed(2).replace(".", ",") };
  }
  if (campoId === "aplicacoes") {
    // anotadas DESMARCADAS: só entram no anúncio quando você marcar (confirmação)
    const novas = /^(?:n[aã]o\s+sei|sei\s+l[aá]|sem\s+aplica|nenhum|pular|deixa)/i.test(t.trim()) ? [] : aplicacoesDitas(t);
    if (!novas.length) return { ficha, ok: false, erro: "Não entendi o veículo (ex.: Renault Master 2013 a 2022)." };
    const g = JSON.parse(JSON.stringify(f));
    for (const ap of novas) incluirAplicacao(g, ap, { origem: "usuario", agora, confirmada: false });
    return { ficha: g, ok: true, valor: novas.map((a) => [a.montadora, resumoAplicacao(a)].filter(Boolean).join(" ")).join("; "), confirmar: true };
  }
  if (campoId === "quantidade") {
    const v = lerInteiro(t.replace(/^(?:tenho|s[aã]o|[eé]|estoque(?:\s+de)?)\s+/i, "").replace(/\s*(?:unidades?|pe[cç]as?|un|pcs?)$/i, ""));
    if (!(Number.isInteger(v) && v > 0)) return { ficha, ok: false, erro: "Não entendi o estoque (ex.: 10)." };
    return { ficha: item("quantidade", v), ok: true, valor: String(v) };
  }
  if (campoId === "peso") {
    // campo em gramas: número sem unidade = gramas (é a unidade do campo); “1,2 quilo” também vale
    const comUnidade = /\b(g|gr|grs|gramas?|kg|kgs|quilos?|kilos?|quilogramas?)\b/i.test(t) ? t : `${t} gramas`;
    const pm = lerPesoEMedidas([comUnidade]);
    if (!(pm.peso_g > 0)) return { ficha, ok: false, erro: "Não entendi o peso (ex.: 200 ou 1,2 quilo)." };
    return { ficha: gravarMedidas(f, { peso_g: pm.peso_g }), ok: true, valor: String(pm.peso_g) };
  }
  if (["comprimento", "largura", "altura"].includes(campoId)) {
    // “20 por 10 por 5” num campo preenche os três; senão só este (em cm se não disser a unidade)
    const tripla = lerPesoEMedidas([/\b(cm|mm|m|centimetros?|milimetros?|metros?)\b/i.test(t) ? t : `${t} cm`]);
    if (tripla.comprimento_cm > 0 && tripla.largura_cm > 0 && tripla.altura_cm > 0) {
      return { ficha: gravarMedidas(f, tripla), ok: true, valor: `${virg(tripla.comprimento_cm)} × ${virg(tripla.largura_cm)} × ${virg(tripla.altura_cm)}`, tres: true };
    }
    const um = lerPesoEMedidas([`${campoId} ${/\b(cm|mm|m|centimetros?|milimetros?|metros?)\b/i.test(t) ? t : `${t} cm`}`]);
    const v = um[`${campoId}_cm`];
    if (!(v > 0)) return { ficha, ok: false, erro: `Não entendi ${campoId === "altura" ? "a altura" : `o ${campoId}`} (ex.: 20).` };
    return { ficha: gravarMedidas(f, { [`${campoId}_cm`]: v }), ok: true, valor: virg(v) };
  }
  return { ficha, ok: false, erro: "Campo desconhecido." };
}

/** Próximo campo direto ainda vazio, depois de `atual` (ou o primeiro). */
export function proximoCampoDireto(ficha, atual = "", { etapa = "" } = {}) {
  const v = valoresCamposDiretos(ficha);
  // (04/11) Com etapa: só os campos dela, na ordem, sem voltar ao começo (no fim da etapa → "").
  if (etapa) {
    const ids = camposDaEtapa(etapa).filter((c) => !c.opcional && c.id !== "aplicacoes").map((c) => c.id);
    const i = ids.indexOf(atual);
    return ids.slice(i + 1).find((id) => !txt(v[id])) || "";
  }
  const ordem = CAMPOS_DIRETOS.map((c) => c.id);
  const i = ordem.indexOf(atual);
  const depois = [...ordem.slice(i + 1), ...ordem.slice(0, Math.max(0, i + 1))];
  const opcional = new Set(CAMPOS_DIRETOS.filter((c) => c.opcional).map((c) => c.id));
  return depois.find((id) => !txt(v[id]) && !opcional.has(id)) || "";
}

/**
 * (04/11) Dados do cadastro Bling (bling-integracao:buscar_produto, só leitura) →
 * preenche SÓ os campos ainda vazios da ficha. Nada é gravado no Bling.
 * @returns {{ ficha, usados: string[] }}
 */
export function usarDadosDoBling(ficha, produto, { agora = Date.now() } = {}) {
  if (!produto || typeof produto !== "object") return { ficha, usados: [] };
  const v = valoresCamposDiretos(ficha);
  const n = (x) => { const y = Number(String(x ?? "").replace(",", ".")); return Number.isFinite(y) && y > 0 ? y : 0; };
  const candidatos = {
    marca: txt(produto.marca),
    preco: n(produto.preco) ? String(n(produto.preco)).replace(".", ",") : "",
    custo: n(produto.precoCusto ?? produto.preco_custo ?? produto.custo) ? String(n(produto.precoCusto ?? produto.preco_custo ?? produto.custo)).replace(".", ",") : "",
    peso: n(produto.peso_bruto ?? produto.pesoBruto ?? produto.peso_liquido ?? produto.pesoLiquido) ? String(Math.round(n(produto.peso_bruto ?? produto.pesoBruto ?? produto.peso_liquido ?? produto.pesoLiquido) * 1000)) : "",
    comprimento: n(produto.profundidade) ? String(n(produto.profundidade)) : "",
    largura: n(produto.largura) ? String(n(produto.largura)) : "",
    altura: n(produto.altura) ? String(n(produto.altura)) : "",
  };
  let f = ficha;
  const usados = [];
  for (const [id, valor] of Object.entries(candidatos)) {
    if (!valor || txt(v[id])) continue; // nunca sobrescreve o que já está na ficha
    const r = definirCampoDireto(f, id, valor, { origem: "bling", agora });
    if (r.ok) { f = r.ficha; usados.push(id); }
  }
  return { ficha: f, usados };
}

/** (04/11) Tipo de veículo escolhido na etapa Compatibilidade (vale quando as aplicações não decidem). */
export function definirTipoVeiculoVoz(ficha, tipo) {
  const t = [TIPO_CARRO, TIPO_PESADA].includes(tipo) ? tipo : "";
  return comCompletar(ficha, (c) => { c.tipoVeiculo = t; });
}

/**
 * (04/11) Situação de cada etapa para a barra superior:
 * "ok" (concluída), "pe" (passou sem completar) ou "" (ainda não).
 */
export function estadoEtapasVoz(ficha, { fotos = 0, etapaAtual = "", ordem = [] } = {}) {
  const v = valoresCamposDiretos(ficha);
  const r = estadoRapido(ficha);
  const completos = dadosCompletosVoz(ficha, { fotos });
  const feito = {
    fotos: fotos > 0,
    codigo: Boolean(codigoPrincipal(ficha)?.codigo),
    descricao: Boolean(txt(r.titulo.valor) && txt(r.descricao.texto || r.descricao.final)),
    preco: Boolean(txt(v.marca) && txt(v.preco) && txt(v.quantidade)),
    envio: Boolean(txt(v.peso) && txt(v.comprimento) && txt(v.largura) && txt(v.altura)),
    compat: (ficha?.aplicacoes || []).some((a) => a.confirmada) && Boolean(completos.tipoVeiculo),
    // (Rodada 1) Etapa 7: a categoria só conta como feita quando o servidor a confirmou (automática ou escolhida).
    categoria: Boolean(ficha?.categoriaVoz?.ok && ficha?.categoriaVoz?.id),
    finalizar: false,
  };
  const iAtual = ordem.indexOf(etapaAtual);
  return Object.fromEntries(ordem.map((e, i) => [e, feito[e] ? "ok" : i < iAtual ? "pe" : ""]));
}

/**
 * (04/11) Situação de uma aplicação na etapa Compatibilidade:
 *  "confirmada" — você marcou; "ambigua" — falta montadora/anos ou há mais de um modelo;
 *  "pendente" — ainda não marcada. Ditada NÃO é confirmada.
 */
export function situacaoAplicacao(a) {
  const faltas = [];
  if (!txt(a?.montadora)) faltas.push("montadora");
  if (!a?.anoInicio) faltas.push("anos");
  if ((a?.modelos || []).length > 1) faltas.push("mais de um modelo");
  if (a?.confirmada) return { estado: "confirmada", texto: faltas.length ? `confirmada por você (atenção: ${faltas.join(", ")})` : "confirmada por você", faltas };
  if (faltas.length) return { estado: "ambigua", texto: `ambígua — falta ${faltas.join(", ")}: fale de novo com montadora, modelo e anos`, faltas };
  return { estado: "pendente", texto: "pendente — marque se estiver certa", faltas };
}
