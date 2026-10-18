// NOME DA PEÇA (18/10/2026) — extração do produto principal (movida de
// MercadoLivreTeste.jsx SEM mudança de regra: a categoria continua igual) e a
// DECISÃO do nome da peça da Conferência (decidirNomePeca).
// Regra: nada é inventado. O nome manual confirmado nunca é sobrescrito.

export function normalizarTexto(valor = "") {
  return String(valor || "")
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase()
    .trim();
}
export function limparCampoTexto(valor) {
  return String(valor ?? "")
    .replace(/\uFFFD/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const PALAVRAS_IGNORADAS_CATEGORIA = new Set([
  "para", "com", "sem", "kit", "peca", "pecas", "original", "novo", "nova",
  "oem", "marca", "jogo", "unidade", "carro", "carros", "veiculo", "veiculos",
  "automotivo", "automotiva", "linha", "motor", "flex", "gasolina", "alcool",
  "diesel", "valvulas", "valvula16", "torken", "kits", "jogos", "conjunto",
  "conjuntos", "acompanha", "acompanham", "incluso", "inclusos", "inclui",
]);

// Mesma peça com outro nome no Mercado Livre (só equivalências certas).
export const SINONIMOS_TIPO_PECA = {
  bico: ["injetor"],
  injetor: ["bico"],
};

function radicalPalavra(p) {
  if (p.length > 6 && p.endsWith("es")) return p.slice(0, -2);
  if (p.length > 4 && p.endsWith("s")) return p.slice(0, -1);
  return p;
}

export function palavrasDaPeca(texto, ignorar) {
  return normalizarTexto(texto)
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((p) => p.length >= 4 && !/\d/.test(p) && !PALAVRAS_IGNORADAS_CATEGORIA.has(p) && !ignorar.has(p))
    .map(radicalPalavra);
}

// =====================================================
// PRODUTO PRINCIPAL (é ele que define a categoria)
// Itens que acompanham a peça (presilhas, parafusos, mangueira, filtro,
// sensor, anel, conector...) e a palavra "KIT" nunca definem a categoria.
// A posição no título é só auxílio: fontes superiores (Base, cadastro, nome
// da peça) mandam. "e"/vírgula/parênteses não quebram nomes compostos.
// =====================================================
// Palavras que NÃO são a peça (marca, montadora, modelo, comercial): servem
// só de contexto. Modelos/motores da aplicação confirmada entram também.
const MARCAS_E_MONTADORAS_CONTEXTO = new Set([
  "renault", "fiat", "vw", "volkswagen", "chevrolet", "gm", "ford", "honda", "toyota",
  "hyundai", "kia", "nissan", "peugeot", "citroen", "mitsubishi", "jeep", "dodge", "ram",
  "chrysler", "bmw", "audi", "mercedes", "benz", "volvo", "subaru", "suzuki", "jac",
  "chery", "caoa", "land", "rover", "troller", "iveco", "scania", "mwm", "cummins",
  "bosch", "magneti", "marelli", "delphi", "ngk", "denso", "mte", "mte-thomson", "torken",
  "vdo", "siemens", "continental", "valeo", "sachs", "skf", "tecfil", "sabo", "nytron",
  "gauss", "dayco", "gates", "cofap", "monroe", "nakata", "trw", "fras-le", "fraslle", "hella",
  "original", "originais", "genuino", "genuina", "novo", "nova", "novos", "novas", "premium",
  "promocao", "oferta", "importado", "importada", "nacional", "paralelo", "similar",
  "qualidade", "garantia", "pronta", "entrega", "envio", "imediato", "frete", "gratis",
]);
const MODELOS_CONTEXTO = new Set([
  "symbol", "clio", "sandero", "logan", "duster", "kangoo", "megane", "scenic", "fluence",
  "captur", "kwid", "oroch", "master", "trafic", "gol", "voyage", "saveiro", "fox", "polo",
  "golf", "jetta", "passat", "bora", "parati", "santana", "amarok", "up", "virtus", "nivus",
  "palio", "uno", "siena", "strada", "punto", "linea", "doblo", "idea", "toro", "mobi",
  "argo", "cronos", "ducato", "onix", "prisma", "cobalt", "spin", "corsa", "celta", "classic",
  "agile", "montana", "astra", "vectra", "zafira", "meriva", "cruze", "s10", "trailblazer",
  "captiva", "malibu", "tracker", "ka", "fiesta", "ecosport", "focus", "fusion", "ranger",
  "courier", "civic", "fit", "city", "hrv", "crv", "corolla", "etios", "hilux", "yaris",
  "hb20", "tucson", "ix35", "santa", "fe", "creta", "azera", "sonata", "elantra", "i30",
  "sportage", "cerato", "picanto", "sorento", "march", "versa", "kicks", "sentra", "frontier",
  "livina", "tiida", "206", "207", "208", "2008", "307", "308", "408", "partner", "c3", "c4",
  "xsara", "picasso", "aircross", "berlingo", "jumper", "boxer", "l200", "pajero", "lancer",
  "asx", "outlander", "renegade", "compass", "e36", "e46",
]);
const PALAVRAS_KIT = new Set(["kit", "kits", "jogo", "jogos", "conjunto", "conjuntos", "conj", "cj", "jg", "par", "pares", "unidade", "unidades", "un", "und", "unid", "pcs", "pecas", "peca", "x"]);
const PALAVRAS_PULAR = new Set(["para", "p/", "pra"]);
const CONECTORES_NOME = new Set(["de", "da", "do", "dos", "das", "d", "a"]);
// Separadores fortes: depois deles vêm itens que acompanham.
const SEPARADORES_FORTES = new Set(["+", "&", ";", "|", "com", "c/", "acompanha", "acompanham", "inclui", "incluso", "inclusos", "inclusa", "inclusas", "incluindo", "mais", "compativel", "-", "–"]);
// Separadores fracos ("e", vírgula, parênteses): só separam quando o que vem
// depois é claramente um item acompanhante — nomes compostos são preservados
// (ex.: "Sensor de Pressão e Temperatura").
const SEPARADORES_FRACOS = new Set(["e", ",", "(", ")"]);
const ITENS_ACOMPANHANTES = new Set([
  "presilha", "trava", "fixacao", "parafuso", "arruela", "conector", "anel", "aneis", "oring",
  "o-ring", "borracha", "abracadeira", "junta", "graxa", "grampo", "vedacao", "retentor", "porca",
  "mangueira", "filtro", "pre-filtro", "prefiltro", "chicote", "plug", "suporte", "coxim",
  "sensor", "pressostato", "boia", "tampa", "cinta", "bucha", "pino", "mola", "adesivo", "manual",
]);
// Substantivos que costumam ser o NOME da peça (para achar onde ela começa
// no título quando há marca/montadora/código antes).
export const NUCLEOS_DE_PECA = new Set([
  "bico", "injetor", "mangueira", "bomba", "sensor", "sonda", "bobina", "pressostato", "valvula",
  "filtro", "cabo", "vela", "junta", "correia", "polia", "tensor", "rolamento", "amortecedor",
  "pastilha", "disco", "tambor", "lona", "cilindro", "pistao", "anel", "atuador", "corpo",
  "regulador", "modulo", "rele", "chicote", "interruptor", "alternador", "radiador",
  "reservatorio", "tampa", "termostato", "eletroventilador", "ventoinha", "flauta", "galeria",
  "coxim", "bucha", "bieleta", "terminal", "pivo", "homocinetica", "tulipa", "trambulador",
  "embreagem", "plato", "retentor", "tubo", "cano", "mecanismo", "palheta", "moldura", "porca",
  "presilha", "trava", "maquina", "fechadura", "farol", "lanterna", "retrovisor", "caixa",
  "coletor", "catalisador", "silencioso", "cabecote", "bronzina", "biela", "comando", "tucho",
  "engrenagem", "corrente", "carter", "bujao", "solenoide", "medidor", "boia", "motor",
  "partida", "arranque", "borboleta", "unidade", "kit-reparo", "reparo", "acionador",
  "servo", "cubo", "mancal", "eixo", "semi-eixo", "barra", "bandeja", "balanca", "mola",
  "batente", "coifa", "cruzeta", "diferencial", "volante", "chave", "ignicao", "tanque",
  "trocador", "intercooler", "turbina", "turbo", "compressor", "condensador", "evaporador",
  "ventilador", "resistencia", "lampada", "vareta", "pedal", "alavanca", "suporte",
]);

function normalizarPalavra(p) {
  return normalizarTexto(p).replace(/[^a-z0-9/+&;|,()\-–]/g, "");
}

function ehContextoDoTitulo(n, contexto) {
  if (!n) return true;
  if (/\d/.test(n)) return true; // código, OEM, motor (1.6, 16v), anos, quantidade
  if (/^(?:flex|gasolina|alcool|etanol|diesel|gnv|turbo16v|\d*v|cv|hp|valvulas?)$/.test(n)) return true;
  return MARCAS_E_MONTADORAS_CONTEXTO.has(n) || MODELOS_CONTEXTO.has(n) || contexto.has(n);
}

export function singularDaPeca(texto) {
  const palavras = texto.split(" ");
  const primeira = normalizarTexto(palavras[0] || "");
  if (!/s$/.test(primeira) || NUCLEOS_DE_PECA.has(primeira)) return texto;
  let antesDoDe = true;
  return palavras.map((w) => {
    const n = normalizarTexto(w);
    if (CONECTORES_NOME.has(n)) { antesDoDe = false; return w; }
    if (!antesDoDe || w.length <= 3) return w;
    if (/(?:or|ar|er)es$/i.test(w)) return w.slice(0, -2);
    if (/[õo]es$/i.test(w)) return w.slice(0, -3) + "ão";
    if (/[^s]s$/i.test(w)) return w.slice(0, -1);
    return w;
  }).join(" ");
}

// Separa, no título, marca/código/montadora/modelo/motor/anos/quantidade/
// Kit e itens acompanhantes; depois identifica a peça principal.
export function extrairProdutoPrincipal(texto, contexto = new Set()) {
  const t = limparCampoTexto(texto)
    .replace(/\bc\/\s*/gi, " c/ ")
    .replace(/\bp\/\s*/gi, " p/ ")
    .replace(/([+&;|,()])/g, " $1 ")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return { principal: "", acompanha: [] };
  const tokens = t.split(" ").map((w) => ({ w, n: normalizarPalavra(w) }));
  const ehNucleo = (n) => NUCLEOS_DE_PECA.has(n) || NUCLEOS_DE_PECA.has(radicalPalavra(n)) ||
    NUCLEOS_DE_PECA.has(n.replace(/es$/, "")) || NUCLEOS_DE_PECA.has(n.replace(/oes$/, "ao"));
  const pulavel = (n) => PALAVRAS_KIT.has(n) || PALAVRAS_PULAR.has(n) || CONECTORES_NOME.has(n) ||
    ehContextoDoTitulo(n, contexto) || SEPARADORES_FRACOS.has(n);
  // Início: 1º substantivo de peça antes de um separador forte; sem ele,
  // a 1ª palavra que não é marca/modelo/código/Kit (só como auxílio).
  let inicio = -1;
  for (let i = 0; i < tokens.length; i++) {
    if (SEPARADORES_FORTES.has(tokens[i].n)) break;
    if (ehNucleo(tokens[i].n)) { inicio = i; break; }
  }
  if (inicio < 0) {
    inicio = tokens.findIndex((x) => !pulavel(x.n) && !SEPARADORES_FORTES.has(x.n));
  }
  if (inicio < 0) return { principal: "", acompanha: [] };
  const nome = [];
  let quebraFraca = false;
  let i = inicio;
  for (; i < tokens.length; i++) {
    const { w, n } = tokens[i];
    if (SEPARADORES_FORTES.has(n)) break;
    if (PALAVRAS_PULAR.has(n)) continue;
    if (SEPARADORES_FRACOS.has(n)) {
      const prox = tokens.slice(i + 1).find((x) => !SEPARADORES_FRACOS.has(x.n));
      if (!prox || n === "(" || n === ")" || ITENS_ACOMPANHANTES.has(prox.n) || ITENS_ACOMPANHANTES.has(radicalPalavra(prox.n)) || ehContextoDoTitulo(prox.n, contexto)) {
        quebraFraca = !!prox && (ITENS_ACOMPANHANTES.has(prox.n) || ITENS_ACOMPANHANTES.has(radicalPalavra(prox.n)));
        break;
      }
      if (n === "e") nome.push(w);
      continue;
    }
    if (i > inicio && (ehContextoDoTitulo(n, contexto) || PALAVRAS_KIT.has(n))) break;
    nome.push(w);
  }
  while (nome.length && (CONECTORES_NOME.has(normalizarTexto(nome[nome.length - 1])) || normalizarTexto(nome[nome.length - 1]) === "e")) nome.pop();
  // Acompanhantes: o que vem depois do separador, sem marca/modelo/código.
  const acompanha = [];
  let atual = [];
  const fechar = () => {
    const txt = atual.join(" ").trim();
    if (txt && palavrasDaPeca(txt, new Set()).length) acompanha.push(txt);
    atual = [];
  };
  let depois = quebraFraca;
  for (let j = i; j < tokens.length; j++) {
    const { w, n } = tokens[j];
    if (SEPARADORES_FORTES.has(n)) { depois = true; fechar(); continue; }
    if (!depois) continue;
    if (SEPARADORES_FRACOS.has(n) || ehContextoDoTitulo(n, contexto) || PALAVRAS_KIT.has(n) || PALAVRAS_PULAR.has(n)) { fechar(); continue; }
    if (ITENS_ACOMPANHANTES.has(n) || ITENS_ACOMPANHANTES.has(radicalPalavra(n))) fechar();
    atual.push(w);
  }
  fechar();
  return { principal: singularDaPeca(nome.join(" ")), acompanha };
}

export function nucleoDoProduto(texto, ignorar = new Set()) {
  return palavrasDaPeca(extrairProdutoPrincipal(texto, ignorar).principal, ignorar)[0] || "";
}

// Ordem de prioridade (só dados reais): 1) Base PAIIA/catálogo, 2) cadastro
// confirmado, 3) nome da peça no anúncio, 4) título (marca, aplicação,
// código e inclusos separados), 5) descrição (apoio). Uma fonte superior
// vale mais que a posição das palavras no título.
export function identificarProdutoPrincipal({ anuncio, nomePeca, nomePecaBase, titulo, descricao, contexto = new Set() }) {
  const peca = anuncio?.pecaEncontrada || {};
  const editado = limparCampoTexto(nomePeca) && limparCampoTexto(nomePeca) !== limparCampoTexto(nomePecaBase);
  const fontes = [
    [editado ? "" : peca.peca, "Base PAIIA"],
    [editado ? "" : peca.familia, "Base PAIIA (família)"],
    [anuncio?.produtoPrincipal || anuncio?.nomePeca || anuncio?.produto?.nome, "cadastro do produto"],
    [nomePeca, "nome da peça na Conferência"],
    [titulo, "título do anúncio"],
    [String(descricao || "").split(/[\n.]/)[0], "descrição (apoio)"],
  ];
  for (const [texto, fonte] of fontes) {
    const r = extrairProdutoPrincipal(texto, contexto);
    if (r.principal) return { ...r, fonte };
  }
  return { principal: "", acompanha: [], fonte: "" };
}

// =====================================================
// DECISÃO DO NOME DA PEÇA (Conferência)
// Ordem: 1) nome MANUAL/CONFIRMADO pelo usuário (nunca sobrescrito);
// 2) Base PAIIA / catálogo; 3) cadastro do produto; 4) título do anúncio
// (veículo, anos, motor, código e inclusos separados). A descrição é só
// APOIO: sozinha ou em conflito com o título, vira SUGESTÃO a confirmar.
// Nome antigo já gravado numa ficha (sem origem) é mantido.
// =====================================================
export const ORIGENS_NOME_USUARIO = new Set(["manual", "confirmado"]);
export const ROTULO_ORIGEM_NOME = {
  manual: "digitado por você",
  confirmado: "confirmado por você",
  base: "base PAIIA / catálogo",
  cadastro: "cadastro do produto",
  anuncio: "título do anúncio",
  ficha: "gravado nesta ficha",
};

// Palavras do nome que são TIPO DE PEÇA conhecido (sinônimos e plural
// incluídos). Sem nenhuma, o nome não é confiável para preencher sozinho.
function tiposDePeca(nome) {
  return normalizarTexto(nome).replace(/[^a-z0-9 -]+/g, " ").split(/\s+/)
    .map((p) => (NUCLEOS_DE_PECA.has(p) ? p : radicalPalavra(p)))
    .filter((p) => NUCLEOS_DE_PECA.has(p));
}

export function decidirNomePeca({ salvo = "", origemSalva = "", base = "", cadastro = "", titulo = "", descricao = "", contexto = new Set() } = {}) {
  // salvo = o valor PRESERVADO da ficha (valorPreservado: o gravado, ou a
  // base se ela mudou depois da Conferência), como sempre foi.
  const s = limparCampoTexto(salvo);
  const b = limparCampoTexto(base);
  if (s && ORIGENS_NOME_USUARIO.has(origemSalva)) return { nome: s, origem: origemSalva, estado: "ok", sugestoes: [] };
  // Nome gravado (ficha antiga sem origem, ou vindo da base): fica como está.
  // Só o nome que o PAIIA tirou do título é recalculado (o título pode mudar).
  if (s && origemSalva !== "anuncio") return { nome: s, origem: s === b ? "base" : origemSalva || "ficha", estado: "ok", sugestoes: [] };
  if (b) return { nome: b, origem: "base", estado: "ok", sugestoes: [] };
  const c = limparCampoTexto(cadastro);
  if (c) return { nome: c, origem: "cadastro", estado: "ok", sugestoes: [] };
  const doTitulo = limparCampoTexto(extrairProdutoPrincipal(titulo, contexto).principal);
  const linhaDescricao = String(descricao || "").split(/[\n.]/).map((x) => x.trim()).find(Boolean) || "";
  const daDescricao = limparCampoTexto(extrairProdutoPrincipal(linhaDescricao, contexto).principal);
  const tiposTitulo = tiposDePeca(doTitulo);
  const tiposDescricao = tiposDePeca(daDescricao);
  const equivalentes = (x, y) => x === y || (SINONIMOS_TIPO_PECA[x] || []).includes(y);
  if (doTitulo) {
    // Conflito: a descrição começa por OUTRO tipo de peça, que o título não cita.
    const conflito = tiposTitulo.length && tiposDescricao.length &&
      !tiposDescricao.some((d) => tiposTitulo.some((t) => equivalentes(t, d)));
    if (conflito) {
      return { nome: "", origem: "", estado: "confirmar", motivo: "O título e a descrição indicam peças diferentes. Confirme o nome da peça.", sugestoes: [{ nome: doTitulo, fonte: "título do anúncio" }, { nome: daDescricao, fonte: "descrição do anúncio" }] };
    }
    if (!tiposTitulo.length) {
      const sugestoes = [{ nome: doTitulo, fonte: "título do anúncio" }];
      if (tiposDescricao.length) sugestoes.push({ nome: daDescricao, fonte: "descrição do anúncio" });
      return { nome: s, origem: s ? "anuncio" : "", estado: "confirmar", motivo: "O PAIIA não reconheceu com segurança o tipo de peça no título. Confirme o nome.", sugestoes };
    }
    return { nome: doTitulo, origem: "anuncio", estado: "ok", sugestoes: [] };
  }
  if (s) return { nome: s, origem: "anuncio", estado: "ok", sugestoes: [] };
  if (tiposDescricao.length) {
    return { nome: "", origem: "", estado: "confirmar", motivo: "O título não identifica a peça; a descrição sugere um nome. Confirme.", sugestoes: [{ nome: daDescricao, fonte: "descrição do anúncio" }] };
  }
  return { nome: "", origem: "", estado: "vazio", sugestoes: [] };
}
