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

/** Códigos rotulados na descrição ("Código: 7703101596", "Código:- 7703101596", "Ref.: ..."). */
export function extrairCodigos(texto) {
  const saida = [];
  const re = /(?:c[oó]d(?:igo)?(?:\s+de\s+refer[eê]ncia)?|ref(?:er[eê]ncia)?\.?|oem)\s*[:.\-–]*\s*([A-Z0-9][A-Z0-9./-]{4,})/gi;
  let m;
  while ((m = re.exec(String(texto || "")))) saida.push(m[1].replace(/[./-]+$/, "").toUpperCase());
  return [...new Set(saida)];
}

export function extrairDadosDescricao(texto) {
  return { medidas: extrairMedidas(texto), funcoes: extrairFuncoes(texto), codigos: extrairCodigos(texto) };
}

// ---------------------------------------------------------------
// Inteligência de Busca
// ---------------------------------------------------------------

function normalizarCodigos(lista) {
  const vistos = new Set();
  const saida = [];
  for (const c of lista || []) {
    const t = limpar(c).toUpperCase();
    const k = t.replace(/[^A-Z0-9]/g, "");
    if (k.length < 4 || vistos.has(k)) continue;
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
  if (palavras.length >= 2) saida.push([base, minus(palavras[0]), minus(palavras[palavras.length - 1])].join(" "));
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
 * dados: { codigos, nomePeca, termoComercial, funcao, medida, aplicacoes, modelos }
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
  for (const c of normalizarCodigos(dados.codigos)) add(c, "codigo");
  add(dados.nomePeca, "peca");
  for (const t of nomesDeBusca(dados)) add(t, "peca");
  add(dados.funcao, "funcao");
  add(dados.medida, "medida");
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
  const nomes = nomesDeBusca(dados);
  const nome = nomes[0] || "";
  const medida = limpar(dados.medida);
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
    vistos.add(k);
    saida.push({ termo, origem: "concorrencia", confirmado: false });
  }
  return saida.slice(0, limite);
}
