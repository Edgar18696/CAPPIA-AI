// =====================================================================
// (23/10/2026 - E6) Padronização de maiúsculas do título e da descrição
// do anúncio (PAIIA Voz e Novo Anúncio).
//
// Regra da loja: a inicial de cada palavra em maiúscula, preservando:
//   - códigos e tudo que tem número (0258003300, 2.0, 16v, 10mm, HB20);
//   - siglas (LED, ABS, EGR, MPFI, VW, GM...) e palavras curtas já em
//     maiúsculas (SW, GTI);
//   - grafias com maiúscula no meio (E.TorQ, McLaren);
//   - acentos (ômega -> Ômega). Nenhum acento é inventado ou retirado.
// Na descrição ficam EXATAMENTE como estão:
//   - o bloco de aplicações/compatibilidades e o bloco de códigos
//     (do rótulo até a próxima linha em branco);
//   - os textos fixos do modelo oficial da loja (rótulos, ATENÇÃO,
//     IMPORTANTE, "Condição do item: Produto novo", "Garantia: 3 Meses").
// Só muda letra maiúscula/minúscula: nenhuma palavra é acrescentada,
// retirada ou trocada. Função pura: não grava nada em lugar nenhum.
// =====================================================================

// Siglas: sempre em maiúsculas (também quando ditas/digitadas em minúsculas).
export const SIGLAS = new Set([
  "abs", "arla", "bmw", "cdi", "cvt", "dohc", "dpf", "ecu", "egr", "gl", "gli",
  "gm", "gnv", "gti", "gts", "led", "mpfi", "obd", "oem", "pcm", "pwm", "sohc",
  "spfi", "suv", "sw", "tbi", "tdi", "tsi", "ntc", "usb", "vvt", "vvti", "vw",
]);

// Conectivos: só ficam em minúsculas se a opção "conectivosMinusculos" for usada.
export const CONECTIVOS = new Set([
  "a", "as", "o", "os", "e", "de", "da", "das", "do", "dos", "em", "na", "nas",
  "no", "nos", "com", "sem", "para", "por", "ou", "à", "às", "ao", "aos",
]);

// Unidades: depois de um número ficam como estão (10 mm, 2 kg).
const UNIDADES = new Set(["mm", "cm", "m", "kg", "g", "ml", "l", "v", "w", "a", "ah", "bar", "psi", "nm", "pol"]);

const ROMANOS = new Set(["ii", "iii", "iv", "vi", "vii", "viii", "ix", "xi", "xii"]);

const temLetra = (s) => /\p{L}/u.test(s);
const temNumero = (s) => /\p{N}/u.test(s);
const maiuscula = (s) => s.toLocaleUpperCase("pt-BR");
const minuscula = (s) => s.toLocaleLowerCase("pt-BR");

function inicialMaiuscula(parte) {
  const i = parte.search(/\p{L}/u);
  if (i < 0) return parte;
  return parte.slice(0, i) + maiuscula(parte.charAt(i)) + parte.slice(i + 1);
}

/** Uma palavra (sem espaços). `anterior` = palavra anterior (para unidades). */
export function padronizarPalavra(palavra, { anterior = "", primeira = false, conectivosMinusculos = false } = {}) {
  const p = String(palavra ?? "");
  if (!p || !temLetra(p)) return p;
  // Códigos, medidas e motorizações (tudo que tem número): nada muda.
  if (temNumero(p)) return p;
  // Separa pontuação das pontas: "(led)," -> "(" + "led" + "),"
  const m = p.match(/^([^\p{L}]*)(.*?)([^\p{L}]*)$/u);
  const [, ini, nucleo, fim] = m;
  const chave = minuscula(nucleo);
  const soLetras = /^\p{L}+$/u.test(nucleo);
  if (soLetras && (SIGLAS.has(chave) || ROMANOS.has(chave))) return ini + maiuscula(nucleo) + fim;
  if (soLetras && UNIDADES.has(chave) && /\p{N}$/u.test(String(anterior))) return p;
  if (soLetras && conectivosMinusculos && !primeira && CONECTIVOS.has(chave) && nucleo === chave) return p;
  const letras = nucleo.replace(/[^\p{L}]/gu, "");
  // Maiúscula no meio de propósito (E.TorQ, McLaren): mantém.
  const resto = nucleo.slice(1).replace(/[^\p{L}]/gu, "");
  if (resto && resto !== minuscula(resto) && resto !== maiuscula(resto)) return p;
  // Tudo em maiúsculas: até 3 letras é sigla (SW, GTI); mais que isso vira Inicial.
  if (letras === maiuscula(letras) && letras !== minuscula(letras)) {
    if (letras.length <= 3) return p;
    return ini + nucleo.split("-").map((s) => inicialMaiuscula(minuscula(s))).join("-") + fim;
  }
  // Minúsculas: inicial maiúscula em cada parte do hífen (pré-catalisador -> Pré-Catalisador).
  return ini + nucleo.split("-").map((s) => inicialMaiuscula(s)).join("-") + fim;
}

/** Uma linha de texto livre: palavra a palavra, espaços preservados. */
export function padronizarLinha(linha, opcoes = {}) {
  const pedacos = String(linha ?? "").split(/(\s+)/);
  let anterior = "";
  let primeira = true;
  return pedacos
    .map((pd) => {
      if (!pd || /^\s+$/.test(pd)) return pd;
      const r = padronizarPalavra(pd, { ...opcoes, anterior, primeira });
      anterior = pd;
      primeira = false;
      return r;
    })
    .join("");
}

/** Título: inicial maiúscula em cada palavra; mesmo comprimento. */
export function padronizarTitulo(titulo, opcoes = {}) {
  if (typeof titulo !== "string") return titulo;
  return padronizarLinha(titulo, opcoes);
}

// ---------------- Descrição ----------------
const semAcento = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "");
const chaveLinha = (s) => minuscula(semAcento(s)).replace(/\s+/g, " ").trim();

// Rótulos de dados técnicos/da fonte. "Rótulo:" sozinho na linha protege o bloco
// abaixo (até a primeira linha em branco depois do conteúdo); "Rótulo: valor"
// protege a própria linha. Aplicações, veículos, códigos, equivalências e
// trechos do catálogo ficam exatamente como vieram.
const RE_ROTULO_PROTEGIDO = /^(compativel com|compatibilidade|compativeis|aplicac(ao|oes)|veiculos?|montadoras?|modelos?|motor(es|izacao|izacoes)?|anos?|periodo|codigos?|referencias?|equivalen|oem|sku|catalogos?|fontes?|pagina|informacoes encontradas|origem)\b/;

// Linhas fixas do modelo oficial da loja: ficam como estão.
const RE_LINHA_FIXA = /^(atencao|importante|especificacoes tecnicas:|condicao do item:|garantia:|conteudo da embalagem:)/;

export function padronizarDescricao(descricao, opcoes = {}) {
  if (typeof descricao !== "string") return descricao;
  // estado: "" = texto livre; "abriu" = rótulo protegido sem conteúdo ainda; "bloco" = dentro do bloco
  let estado = "";
  return descricao
    .split(/(\r?\n)/)
    .map((pd) => {
      if (pd === "\n" || pd === "\r\n") return pd;
      const k = chaveLinha(pd.replace(/^[\s•*\-–—]+/, ""));
      if (!k) { if (estado === "bloco") estado = ""; return pd; }
      if (estado) { estado = "bloco"; return pd; }
      const rotulo = RE_ROTULO_PROTEGIDO.test(k) || RE_LINHA_FIXA.test(k);
      if (rotulo && /:\s*$/.test(pd)) { estado = "abriu"; return pd; }
      if (rotulo && /:/.test(pd)) return pd; // "Código OEM: 0258003300"
      if (RE_LINHA_FIXA.test(k)) return pd;
      return padronizarLinha(pd, opcoes);
    })
    .join("");
}
