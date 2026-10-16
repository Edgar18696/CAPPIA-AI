/*
 * INTELIGÊNCIA DE BUSCA E DADOS TÉCNICOS DA PEÇA — funções puras.
 *
 * Regras (definidas pelo usuário):
 *  - Fonte principal = dados CONFIRMADOS do próprio produto: base PAIIA,
 *    anúncio, descrição (interpretada como DADO, não como palavras soltas),
 *    características técnicas e compatibilidades confirmadas.
 *  - Concorrente é só fonte SECUNDÁRIA de sugestão: fica separado e nunca
 *    entra nas palavras confirmadas nem nas buscas montadas.
 *  - Nada é inventado: sem ano, motor, versão, função ou medida que não
 *    estejam nos dados. Zero informação é melhor que informação inventada.
 *  - (16/10/2026) A Inteligência de Busca é AUTOMÁTICA: o usuário não digita
 *    palavras-chave. Os termos saem do código/SKU/OEM (com e sem espaços,
 *    pontos e hífens), nome e categoria da peça, sinônimos do dicionário
 *    PAIIA (só frases equivalentes de verdade), marca/fabricante,
 *    características técnicas confirmadas e veículos confirmados.
 *  - Os termos servem à pesquisa e à preparação do anúncio. Título e
 *    descrição NUNCA são alterados por aqui.
 * Testes: scripts/testes/inteligenciaBusca.test.mjs
 */

const limpar = (v) => String(v ?? "").replace(/\s+/g, " ").trim();
const chave = (v) =>
  limpar(v)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

// ---------------------------------------------------------------
// Modelos confirmados sem detalhes (lista digitada pelo usuário)
// ---------------------------------------------------------------

/** "Logan, Sandero; Duster / Kangoo e Laguna" → ["Logan","Sandero","Duster","Kangoo","Laguna"]. */
export function separarModelos(texto) {
  const vistos = new Set();
  const saida = [];
  for (const parte of String(texto || "").split(/[,;/\n]+|\s+e\s+/i)) {
    const m = limpar(parte);
    if (!m) continue;
    const k = chave(m);
    if (vistos.has(k)) continue;
    vistos.add(k);
    saida.push(m);
  }
  return saida;
}

/** Junta modelos sem detalhes sem repetir (montadora + modelo, sem acento/caixa). */
export function juntarModelos(...listas) {
  const vistos = new Set();
  const saida = [];
  for (const m of listas.flat()) {
    const montadora = limpar(m?.montadora);
    const modelo = limpar(m?.modelo);
    if (!montadora || !modelo) continue;
    const k = `${chave(montadora)}|${chave(modelo)}`;
    if (vistos.has(k)) continue;
    vistos.add(k);
    saida.push({ montadora, modelo });
  }
  return saida;
}

/**
 * Aplicações manuais antigas: uma linha só com montadora e VÁRIOS modelos
 * separados por vírgula (sem motor/ano/versão) era a única forma de cadastrar
 * "modelos sem detalhes". Converte para a lista estruturada, sem inventar nada.
 * Devolve { detalhadas, modelos, convertidas }.
 */
export function separarAplicacoesLegadas(aplicacoes = []) {
  const detalhadas = [];
  const modelos = [];
  let convertidas = 0;
  for (const a of aplicacoes || []) {
    const semDetalhe = !limpar(a?.motor) && !limpar(a?.anoInicio) && !limpar(a?.anoFim) && !limpar(a?.versao);
    const varios = /[,;/]/.test(String(a?.modelo || ""));
    if (semDetalhe && varios && limpar(a?.montadora)) {
      convertidas++;
      for (const modelo of separarModelos(a.modelo)) modelos.push({ montadora: limpar(a.montadora), modelo });
    } else {
      detalhadas.push(a);
    }
  }
  return { detalhadas, modelos: juntarModelos(modelos), convertidas };
}

/**
 * Aplicações da BASE/catálogo: linha só com montadora + modelo(s) (sem motor,
 * ano e versão) vira "modelo confirmado sem detalhes" — nunca aplicação
 * detalhada nem linha da tabela oficial do ML. Devolve { detalhadas, modelos }.
 */
export function separarAplicacoesBase(aplicacoes = []) {
  const semDetalhe = (a) =>
    limpar(a?.montadora) && limpar(a?.modelo) && !limpar(a?.motor) && !limpar(a?.anoInicio) && !limpar(a?.anoFim) && !limpar(a?.versao);
  const lista = (aplicacoes || []).filter(Boolean);
  return {
    detalhadas: lista.filter((a) => !semDetalhe(a)),
    modelos: juntarModelos(
      lista.filter(semDetalhe).flatMap((a) => separarModelos(a.modelo).map((modelo) => ({ montadora: limpar(a.montadora), modelo })))
    ),
  };
}

// ---------------------------------------------------------------
// Descrição do próprio anúncio → DADOS (não palavras soltas)
// ---------------------------------------------------------------

/** "M12x1,75-35" → "M12 × 1,75 × 35" (rosca métrica × passo × comprimento). */
export function extrairMedidas(texto) {
  const saida = [];
  const re = /\bM\s?(\d{1,2})\s*[x×X*]\s*(\d{1,2}(?:[.,]\d{1,2})?)(?:\s*[x×X*-]\s*(\d{1,3}(?:[.,]\d+)?))?(?:\s*mm)?\b/g;
  let m;
  while ((m = re.exec(String(texto || "")))) {
    const passo = m[2].replace(".", ",");
    saida.push([`M${m[1]}`, passo, m[3] ? m[3].replace(".", ",") : ""].filter(Boolean).join(" × "));
  }
  return [...new Set(saida)];
}

/** Só linhas ROTULADAS viram função/localização (ex.: "Função: ...", "Localização: ..."). */
export function extrairFuncoes(texto) {
  const saida = [];
  for (const linha of String(texto || "").split(/\r?\n/)) {
    const m = linha.match(/^\s*(?:fun[cç][aã]o|localiza[cç][aã]o|posi[cç][aã]o|aplica[cç][aã]o t[eé]cnica)\s*[:\-–]\s*(.+)$/i);
    if (m && limpar(m[1])) saida.push(limpar(m[1]));
  }
  return [...new Set(saida)];
}

/**
 * Código/OEM: precisa ter pelo menos UM número. Palavra só com letras
 * ("informado", "peça", "referência") nunca é código.
 */
export function pareceCodigo(valor) {
  const t = limpar(valor).toUpperCase();
  return /\d/.test(t) && t.replace(/[^A-Z0-9]/g, "").length >= 4;
}

/** Códigos rotulados na descrição ("Código: 7703101596", "Código:- 7703101596", "Ref.: ..."). */
export function extrairCodigos(texto) {
  const saida = [];
  const re = /(?:c[oó]d(?:igo)?(?:\s+de\s+refer[eê]ncia)?|ref(?:er[eê]ncia)?\.?|oem)\s*[:.\-–]*\s*([A-Z0-9][A-Z0-9./-]{4,})/gi;
  let m;
  while ((m = re.exec(String(texto || "")))) {
    const c = m[1].replace(/[./-]+$/, "").toUpperCase();
    if (pareceCodigo(c)) saida.push(c);
  }
  return [...new Set(saida)];
}

export function extrairDadosDescricao(texto) {
  return { medidas: extrairMedidas(texto), funcoes: extrairFuncoes(texto), codigos: extrairCodigos(texto) };
}

// ---------------------------------------------------------------
// Inteligência de Busca
// ---------------------------------------------------------------

/** Código só com letras e números (para comparar): "0 280-158.276" → "0280158276". */
export function codigoCompacto(valor) {
  return limpar(valor).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Formas de escrever o MESMO código que o comprador digita: como foi
 * informado, sem separadores e, se o original tinha pontos/hífens, com
 * espaços. Nunca cria agrupamento novo nem outro código.
 */
export function variacoesCodigo(valor) {
  const original = limpar(valor).toUpperCase();
  if (!pareceCodigo(original)) return [];
  const compacto = codigoCompacto(original);
  const comEspacos = original.replace(/[.\-_/]+/g, " ").replace(/\s+/g, " ").trim();
  const saida = [];
  for (const v of [original, compacto, comEspacos]) if (v && !saida.includes(v)) saida.push(v);
  return saida;
}

/**
 * Identificação dos códigos da peça, sem repetir o mesmo código escrito de
 * outro jeito. papeis: código/SKU do anúncio, número da peça, OEM, OEM da
 * base, equivalente da base. Só entra o que veio dos dados (nada inventado).
 * Devolve [{ codigo, compacto, papeis: [..], variacoes: [..] }].
 */
export function identificarCodigos({ codigo, numeroPeca, oem, codigoOemBase, equivalentesBase } = {}) {
  const fontes = [
    [codigo, "Código / SKU"],
    [numeroPeca, "Número da peça"],
    [oem, "OEM"],
    ...String(codigoOemBase || "").split(/[,;\n]+/).map((c) => [c, "OEM (base PAIIA)"]),
    ...String(equivalentesBase || "").split(/[,;\n]+/).map((c) => [c, "Equivalente (base PAIIA)"]),
  ];
  const porCompacto = new Map();
  for (const [valor, papel] of fontes) {
    const t = limpar(valor).toUpperCase();
    if (!pareceCodigo(t)) continue;
    const k = codigoCompacto(t);
    const atual = porCompacto.get(k);
    if (atual) {
      if (!atual.papeis.includes(papel)) atual.papeis.push(papel);
      for (const v of variacoesCodigo(t)) if (!atual.variacoes.includes(v)) atual.variacoes.push(v);
    } else {
      porCompacto.set(k, { codigo: t, compacto: k, papeis: [papel], variacoes: variacoesCodigo(t) });
    }
  }
  return [...porCompacto.values()];
}

function normalizarCodigos(lista) {
  const vistos = new Set();
  const saida = [];
  for (const c of lista || []) {
    const t = limpar(c).toUpperCase();
    const k = t.replace(/[^A-Z0-9]/g, "");
    if (!pareceCodigo(t) || vistos.has(k)) continue;
    vistos.add(k);
    saida.push(t);
  }
  return saida;
}

/** "M12 × 1,75 × 35" → "M12 1,75" (forma curta que o comprador digita). */
function medidaCurta(medida) {
  const partes = limpar(medida).split(/\s*×\s*/);
  return partes.slice(0, 2).join(" ");
}

// ---------------------------------------------------------------
// Sinônimos: SÓ frases que nomeiam a MESMA peça (dicionário PAIIA).
// Cada grupo vale inteiro; palavra solta nunca vira sinônimo (ex.: "botão"
// sozinho pode ser outra peça). Para ampliar: acrescentar grupos aqui.
// ---------------------------------------------------------------
export const SINONIMOS_PECA = Object.freeze([
  ["sonda lambda", "sensor de oxigênio", "sensor lambda"],
  ["bico injetor", "injetor de combustível", "válvula injetora"],
  ["sensor de fase", "sensor de posição do comando", "sensor do comando de válvulas"],
  ["bobina de ignição", "bobina ignição"],
  ["corpo de borboleta", "corpo de aceleração", "tbi"],
  ["atuador de marcha lenta", "motor de passo", "válvula iac"],
  ["válvula termostática", "termostato"],
  ["eletroventilador", "ventoinha do radiador"],
  ["interruptor do eletroventilador", "cebolão da ventoinha", "cebolão do radiador"],
  ["flauta de combustível", "galeria de combustível", "tubo distribuidor de combustível"],
  ["coxim do motor", "calço do motor"],
  ["junta homocinética", "homocinética"],
  ["mecanismo do limpador", "galhada do limpador", "articulação do limpador"],
  ["interruptor do teto solar", "botão do teto solar", "chave do teto solar"],
  ["interruptor do vidro elétrico", "botão do vidro elétrico", "chave do vidro elétrico"],
  ["interruptor da luz de freio", "interruptor do pedal de freio"],
]);

// Palavras que não identificam a peça (sozinhas) ou que não podem ser usadas
// ("original"/"genuína" sem comprovação — regra do usuário).
const GENERICAS = new Set(["peca", "pecas", "automotiva", "automotivo", "produto", "novo", "nova", "item", "unidade", "qualidade", "kit", "jogo", "conjunto", "acessorio", "acessorios"]);
const PROIBIDAS = new Set(["original", "originais", "genuina", "genuino", "genuinas", "genuinos", "oem"]);

/** Tira "original"/"genuína" e devolve "" se só sobraram palavras genéricas. */
export function limparTermoBusca(termo) {
  const palavras = limpar(termo).split(" ").filter((p) => p && !PROIBIDAS.has(chave(p)));
  const t = palavras.join(" ");
  const uteis = palavras.filter((p) => !GENERICAS.has(chave(p)) && !LIGACAO.has(chave(p)));
  if (!uteis.length || chave(t).length < 3) return "";
  return t;
}

// Comparação por palavra: sem acento/caixa, sem "do/da/de" e sem plural
// simples ("bicos injetores" = "bico injetor").
const raiz = (p) => (p.length > 4 && /res$/.test(p) ? p.slice(0, -2) : p.length > 3 && /s$/.test(p) ? p.slice(0, -1) : p);
const palavrasChave = (t) =>
  chave(t).replace(/[^a-z0-9 ]+/g, " ").split(" ").filter((p) => p && !LIGACAO.has(p)).map(raiz);
const semLigacao = (t) => palavrasChave(t).join(" ");
// Peça principal do texto = 1ª palavra que não é número, genérica nem proibida.
const nucleo = (t) => palavrasChave(t).find((p) => !/^\d/.test(p) && !GENERICAS.has(p) && !PROIBIDAS.has(p)) || "";
/**
 * O texto nomeia a peça da frase do dicionário? A frase precisa começar pela
 * MESMA peça principal do texto e todas as suas palavras precisam estar no
 * texto. "Interruptor do eletroventilador" NÃO é "eletroventilador".
 */
function contemFrase(texto, frase) {
  const f = palavrasChave(frase);
  if (!f.length || nucleo(texto) !== f[0]) return false;
  const doTexto = new Set(palavrasChave(texto));
  return f.every((p) => doTexto.has(p));
}

/**
 * Sinônimos do dicionário para os nomes confirmados da peça.
 * Ex.: "Interruptor Botão Elétrico Teto Solar" contém "interruptor teto
 * solar" → "botão do teto solar", "chave do teto solar".
 * Devolve [{ termo, de }] (de = frase do dicionário encontrada).
 */
export function sinonimosDaPeca(...textos) {
  const saida = [];
  const vistos = new Set();
  const fonte = textos.flat().map(limpar).filter(Boolean);
  for (const grupo of SINONIMOS_PECA) {
    const achada = grupo.find((frase) => fonte.some((t) => contemFrase(t, frase)));
    if (!achada) continue;
    for (const outro of grupo) {
      if (outro === achada || fonte.some((t) => contemFrase(t, outro))) continue;
      const k = semLigacao(outro);
      if (vistos.has(k)) continue;
      vistos.add(k);
      saida.push({ termo: outro, de: achada });
    }
  }
  return saida;
}

/** Último nível da categoria do ML ("... > Interruptores" → "Interruptores"). */
export function nomeCategoria(caminho) {
  const partes = String(caminho || "").split(/\s*[>›/]\s*/).map(limpar).filter(Boolean);
  return partes[partes.length - 1] || "";
}

function anoDaAplicacao(a) {
  const ini = limpar(a?.anoInicio);
  const fim = limpar(a?.anoFim);
  if (ini && fim && ini === fim) return ini;
  if (ini && fim) return `${ini} a ${fim}`;
  return ini || fim || "";
}

// Palavras de ligação que não ajudam a busca ("do conjunto de ... e ...").
const LIGACAO = new Set(["a", "o", "as", "os", "de", "da", "do", "das", "dos", "e", "em", "no", "na", "nos", "nas", "para", "com", "por", "ao", "conjunto", "lado", "parte"]);

/**
 * Nome da peça + função/localização CONFIRMADA → como o comprador procura.
 * "Parafuso de Aço" + "Suporte do conjunto de transmissão e motor" →
 *   ["Parafuso suporte motor", "Parafuso suporte transmissão motor"]
 * Usa só palavras que estão no nome e na função (nada é acrescentado).
 */
export function termosDaFuncao(nomePeca, funcao) {
  const base = limpar(nomePeca).split(" ")[0] || "";
  const palavras = limpar(funcao)
    .split(" ")
    .map((p) => p.replace(/[.,;:()]/g, ""))
    .filter((p) => p && !LIGACAO.has(chave(p)));
  if (!base || !palavras.length) return [];
  const minus = (t) => t.toLowerCase();
  const saida = [];
  // Forma curta (1ª + última palavra) só quando a última é um item à parte
  // ("... transmissão E motor" → "suporte motor"). "abertura do teto solar"
  // não vira "comando solar" (termo sem sentido).
  const ultimaIsolada = /\s(?:e)\s+\S+\s*$/i.test(limpar(funcao));
  if (palavras.length >= 2 && ultimaIsolada) saida.push([base, minus(palavras[0]), minus(palavras[palavras.length - 1])].join(" "));
  saida.push([base, ...palavras.map(minus)].join(" "));
  const vistos = new Set();
  return saida.filter((t) => {
    const k = chave(t);
    if (vistos.has(k) || k.split(" ").length < 2) return false;
    vistos.add(k);
    return true;
  });
}

/** Termos de busca da peça, na ordem: digitado pelo usuário → derivados da função → nome. */
function nomesDeBusca(dados) {
  const lista = [limpar(dados.termoComercial), ...termosDaFuncao(dados.nomePeca, dados.funcao), limpar(dados.nomePeca)].filter(Boolean);
  const vistos = new Set();
  return lista.filter((t) => {
    const k = chave(t);
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
}

/**
 * Dados confirmados do produto → termos (chips) com a origem de cada um.
 * Ordem (regra do usuário): código/OEM → nome da peça → função/localização →
 * especificação/medida → montadora → modelos confirmados → motor/ano/versão
 * (só confirmados). Concorrentes NUNCA entram aqui.
 * dados: { codigos, nomePeca, termoComercial, funcao, medida, medidas,
 *   categoria, marca, fabricante, aplicacoes, modelos }
 */
export function termosConfirmados(dados = {}) {
  const lista = [];
  const vistos = new Set();
  const add = (termo, origem) => {
    const t = limpar(termo);
    if (!t) return;
    const k = chave(t);
    if (vistos.has(k)) return;
    vistos.add(k);
    lista.push({ termo: t, origem });
  };
  const addLimpo = (termo, origem) => add(limparTermoBusca(termo), origem);
  for (const c of normalizarCodigos(dados.codigos)) add(c, "codigo");
  // Mesmo código escrito de outro jeito (como veio em cada fonte, sem
  // espaços/pontos/hífens e com espaços) — nunca outro código.
  for (const c of dados.codigos || []) for (const v of variacoesCodigo(c)) add(v, "variacao");
  addLimpo(dados.nomePeca, "peca");
  for (const t of nomesDeBusca(dados)) addLimpo(t, "peca");
  addLimpo(nomeCategoria(dados.categoria), "categoria");
  for (const s of sinonimosDaPeca(dados.nomePeca, dados.termoComercial)) addLimpo(s.termo, "sinonimo");
  addLimpo(dados.marca, "marca");
  addLimpo(dados.fabricante, "fabricante");
  addLimpo(dados.funcao, "funcao");
  for (const m of [].concat(dados.medida || [], dados.medidas || [])) add(m, "medida");
  const veiculos = [...(dados.modelos || []), ...(dados.aplicacoes || [])];
  for (const a of veiculos) add(a?.montadora, "montadora");
  for (const a of veiculos) add(a?.modelo, "modelo");
  for (const a of dados.aplicacoes || []) add(a?.motor, "motor");
  for (const a of dados.aplicacoes || []) add(anoDaAplicacao(a), "ano");
  for (const a of dados.aplicacoes || []) add(a?.versao, "versao");
  return lista;
}

/**
 * Buscas por INTENÇÃO (várias frases curtas, não uma frase gigante).
 * Usa só dados confirmados; cada frase diz de onde veio.
 */
export function gerarIntencoesBusca(dados = {}, limite = 30) {
  const saida = [];
  const vistos = new Set();
  const add = (partes, tipo) => {
    const texto = limpar(partes.filter(Boolean).join(" "));
    if (!texto) return;
    const k = chave(texto);
    if (vistos.has(k)) return;
    vistos.add(k);
    saida.push({ texto, tipo });
  };
  const codigos = normalizarCodigos(dados.codigos);
  // Como o comprador chama a peça: digitado pelo usuário, derivado da
  // função/localização confirmada ou, por último, o nome da peça.
  const nomes = nomesDeBusca(dados).map(limparTermoBusca).filter(Boolean);
  const nome = nomes[0] || "";
  const medida = limpar([].concat(dados.medida || [], dados.medidas || [])[0]);
  const aplicacoes = (dados.aplicacoes || []).filter((a) => limpar(a?.modelo));
  const modelos = (dados.modelos || []).filter((m) => limpar(m?.modelo));

  // 1) Quem conhece o código
  for (const c of codigos) {
    add([c], "codigo");
    if (nome) add([nome, c], "codigo");
  }
  if (!nome) return saida.slice(0, limite);

  // 2) Quem não conhece o código: peça + veículo (+ ano/motor quando confirmados)
  const montadoras = [...new Set([...aplicacoes, ...modelos].map((a) => limpar(a.montadora)).filter(Boolean))];
  for (const a of aplicacoes) {
    add([nome, a.modelo], "intencao");
    const ano = anoDaAplicacao(a);
    if (ano) add([nome, a.modelo, ano], "intencao");
    if (limpar(a.motor)) add([nome, a.modelo, a.motor], "intencao");
  }
  // Modelos confirmados sem detalhes: só peça + modelo (sem ano/motor).
  for (const m of modelos) add([nome, m.modelo], "intencao");
  // 3) Peça + montadora (+ medida) — quem procura pela especificação
  for (const mt of montadoras) {
    add([nome, mt], "intencao");
    if (medida) add([nome, mt, medidaCurta(medida)], "intencao");
  }
  if (medida && !montadoras.length) add([nome, medidaCurta(medida)], "intencao");
  // Outras formas confirmadas de chamar a peça (ex.: com "transmissão").
  for (const outro of nomes.slice(1)) {
    for (const mt of montadoras) add([outro, mt], "intencao");
    if (!montadoras.length) add([outro], "intencao");
  }
  // Sinônimos do dicionário (mesma peça): peça + modelo/montadora confirmados.
  for (const s of sinonimosDaPeca(dados.nomePeca, dados.termoComercial)) {
    const outro = limparTermoBusca(s.termo);
    if (!outro) continue;
    for (const c of codigos.slice(0, 1)) add([outro, c], "sinonimo");
    for (const a of aplicacoes.slice(0, 4)) add([outro, a.modelo], "sinonimo");
    for (const m of modelos.slice(0, 4)) add([outro, m.modelo], "sinonimo");
    if (!aplicacoes.length && !modelos.length) add([outro], "sinonimo");
  }
  // Fabricante + código (quem procura pela marca da peça no catálogo).
  const fabricante = limparTermoBusca(dados.fabricante);
  if (fabricante) for (const c of codigos.slice(0, 2)) add([fabricante, c], "codigo");
  // 4) Função/localização técnica confirmada (quando diferente do nome)
  const funcao = limpar(dados.funcao);
  if (funcao && !chave(nome).includes(chave(funcao))) add([limpar(dados.nomePeca) || nome, funcao], "funcao");
  return saida.slice(0, limite);
}

/**
 * Sugestões de concorrentes: SEPARADAS e marcadas como não confirmadas.
 * Nunca entram nos termos confirmados nem nas buscas montadas. Só sobra o
 * que ainda não está nos dados confirmados (para o usuário avaliar).
 */
export function separarSugestoesConcorrentes(sugeridas = [], confirmados = [], limite = 12) {
  // Já confirmado (termo inteiro ou palavra de um termo confirmado): não repete.
  const ja = new Set();
  for (const t of confirmados) {
    const k = chave(t?.termo ?? t);
    ja.add(k);
    for (const p of k.split(/\s+/)) if (p.length >= 3) ja.add(p);
  }
  const vistos = new Set();
  const saida = [];
  for (const s of sugeridas || []) {
    const termo = limpar(s?.termo ?? s);
    const k = chave(termo);
    if (!termo || k.length < 3 || ja.has(k) || vistos.has(k)) continue;
    // Frase cujas palavras já estão todas nos dados confirmados: repetida.
    const palavras = k.split(/\s+/).filter((p) => p.length >= 3);
    if (palavras.length > 1 && palavras.every((p) => ja.has(p))) continue;
    vistos.add(k);
    saida.push({ termo, origem: "concorrencia", confirmado: false });
  }
  return saida.slice(0, limite);
}
