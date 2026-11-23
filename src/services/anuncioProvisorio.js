// =============================================================
// PAIIA — Anúncio pré-montado no "Buscar e Montar" (23/11/2026).
//
// Funções PURAS (sem rede): escolhem a fonte, montam título e descrição
// provisórios e decidem o que pode ser preenchido sem apagar o que o
// usuário digitou.
//
// Regras do Edgar:
//  - só informação confirmada: nada de aplicação, equivalência, marca ou
//    característica inventada; o que falta vai para "[A CONFIRMAR]";
//  - título até 60 caracteres, com o código e SEM marca;
//  - nunca substituir o que o usuário digitou ou corrigiu;
//  - fontes (nessa ordem): ficha PAIIA do código > anúncio ML nosso com o
//    MESMO SKU (REVELAÇÃO > LOJA ONLINE > CIEBR) > nome do Bling (SKU exato).
//    Anúncio só "parecido" (SKU diferente) NUNCA é fonte.
// =============================================================

export const LIMITE_TITULO_ML = 60;
export const MARCA_A_CONFIRMAR = "[A CONFIRMAR]";

// Ordem das contas como fonte de texto: REVELAÇÃO é a prioritária.
export const ORDEM_CONTAS_FONTE = Object.freeze(["2412238242", "1729335019", "824312524"]);

export const FONTE = Object.freeze({
  FICHA: "ficha_paiia",
  ML: "anuncio_ml",
  BLING: "bling",
  NENHUMA: "",
});

// Marcas/fabricantes que nunca entram no título (a marca vai no campo Marca).
const MARCAS = [
  "torken", "bosch", "magneti marelli", "marelli", "delphi", "denso", "ngk", "ntk", "valeo", "mte",
  "mte-thomson", "thomson", "gauss", "vdo", "continental", "siemens", "mahle", "cofap", "hella",
  "walbro", "kostal", "lumen", "dpl", "multi", "3rho", "tsa", "iga", "kitec", "fiat original",
  "gm original", "vw original", "original", "genuino", "genuíno", "paraflu", "wahler", "sachs",
];

const txt = (v) => String(v ?? "").trim();
const semAcento = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "");
const norm = (v) => semAcento(v).toUpperCase().replace(/[^A-Z0-9]/g, "");
const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Tira as marcas conhecidas (palavra inteira, sem diferença de acento/maiúscula). */
export function tirarMarcas(texto) {
  let t = ` ${txt(texto)} `;
  const ordenadas = [...MARCAS].sort((a, b) => b.length - a.length);
  for (const m of ordenadas) {
    const padrao = escapar(m).replace(/\s+/g, "\\s+");
    t = t.replace(new RegExp(`(^|[^\\p{L}\\p{N}])${padrao}(?=$|[^\\p{L}\\p{N}])`, "giu"), "$1 ");
  }
  return t.replace(/\s+-\s+(?=-|$)/g, " ").replace(/\s{2,}/g, " ").replace(/^[\s\-–—|,;:]+|[\s\-–—|,;:]+$/g, "").trim();
}

/** O código aparece no texto (qualquer grafia: "0 258 003 300" = "0258003300")? */
export function textoTemCodigo(texto, codigo) {
  const c = norm(codigo);
  if (!c) return true;
  const partes = txt(texto).split(/[^A-Za-z0-9]+/).filter(Boolean).map((p) => norm(p));
  for (let i = 0; i < partes.length; i++) {
    let junto = "";
    for (let j = i; j < partes.length && junto.length < c.length; j++) {
      junto += partes[j];
      if (junto === c) return true;
    }
  }
  return false;
}

/** Corta em palavra inteira até o limite. */
function cortarPalavras(texto, limite) {
  const t = txt(texto).replace(/\s+/g, " ");
  if (t.length <= limite) return t;
  const palavras = t.split(" ");
  let out = "";
  for (const p of palavras) {
    const prox = out ? `${out} ${p}` : p;
    if (prox.length > limite) break;
    out = prox;
  }
  return out || t.slice(0, limite).trim();
}

/**
 * Título provisório: nome sem marca + código, até 60 caracteres, sem cortar o
 * código. Sem nome confiável → "" (o PAIIA não inventa o tipo da peça).
 */
export function montarTituloProvisorio({ nome = "", codigo = "", limite = LIMITE_TITULO_ML } = {}) {
  const cod = txt(codigo).replace(/\s+/g, "");
  const limpo = tirarMarcas(nome).replace(/\s+/g, " ").trim();
  if (!limpo || norm(limpo) === norm(cod)) return "";
  if (!cod || textoTemCodigo(limpo, cod)) return cortarPalavras(limpo, limite);
  const espaco = limite - cod.length - 1;
  if (espaco <= 0) return cod.slice(0, limite);
  const base = cortarPalavras(limpo, espaco);
  return base ? `${base} ${cod}` : cod;
}

/** Título já revisado pelo usuário (ficha): só respeita o limite. */
export function tituloDaFicha(titulo, limite = LIMITE_TITULO_ML) {
  return cortarPalavras(titulo, limite);
}

const valorAtributo = (lista, id) => txt((Array.isArray(lista) ? lista : []).find((a) => a?.id === id)?.value_name);

/**
 * Anúncio ML lido (GET /items/{id}) → dados úteis e confirmados pelo próprio anúncio.
 * Só o que o anúncio declara: nome, número da peça; a marca NUNCA vai para o título.
 */
export function dadosDoItemML(item) {
  if (!item || typeof item !== "object") return null;
  return {
    mlb: txt(item.id).toUpperCase(),
    titulo: txt(item.title),
    numeroPeca: valorAtributo(item.attributes, "PART_NUMBER"),
    marca: valorAtributo(item.attributes, "BRAND"),
    tipo: txt(item.listing_type_id),
  };
}

/** Ordem das contas (REVELAÇÃO primeiro; contas desconhecidas no fim). */
function posicaoConta(conta) {
  const i = ORDEM_CONTAS_FONTE.indexOf(String(conta || ""));
  return i < 0 ? ORDEM_CONTAS_FONTE.length : i;
}

/**
 * Escolhe a fonte do texto.
 * fichas: [{ id, titulo, descricao, publicada, atualizada }] (do mesmo código; já com o texto lido)
 * ml: [{ conta, nome, anuncios: [{ mlb, titulo, descricao?, numeroPeca? }] }] (SÓ duplicados de SKU)
 * bling: { estado, produto: { nome, codigo } } (avaliarBlingInicial)
 * Devolve { fonte, rotulo, titulo, descricaoBase, nome, extras }.
 */
export function escolherFonte({ fichas = [], ml = [], bling = null } = {}) {
  const comTexto = (Array.isArray(fichas) ? fichas : []).filter((f) => txt(f?.titulo) || txt(f?.descricao));
  const ficha = [...comTexto].sort((a, b) => (Number(Boolean(b.publicada)) - Number(Boolean(a.publicada))) || txt(b.atualizada).localeCompare(txt(a.atualizada)))[0];
  if (ficha) {
    return { fonte: FONTE.FICHA, rotulo: `ficha do PAIIA${ficha.publicada ? " já publicada" : ""}`, fichaId: txt(ficha.id), titulo: txt(ficha.titulo), descricaoBase: String(ficha.descricao ?? "").trim(), nome: txt(ficha.titulo) };
  }
  const contas = (Array.isArray(ml) ? ml : []).filter((m) => Array.isArray(m?.anuncios) && m.anuncios.some((a) => txt(a?.titulo)));
  contas.sort((a, b) => posicaoConta(a.conta) - posicaoConta(b.conta));
  if (contas.length) {
    const c = contas[0];
    const a = c.anuncios.find((x) => txt(x?.titulo));
    return { fonte: FONTE.ML, rotulo: `anúncio ${a.mlb} da conta ${c.nome || c.conta}`, mlb: txt(a.mlb), conta: txt(c.conta), titulo: "", descricaoBase: String(a.descricao ?? "").trim(), nome: txt(a.titulo), numeroPeca: txt(a.numeroPeca) };
  }
  const nomeBling = bling?.estado === "encontrado" ? txt(bling?.produto?.nome) : "";
  if (nomeBling) return { fonte: FONTE.BLING, rotulo: `produto do Bling (ID ${txt(bling.produto.id)})`, titulo: "", descricaoBase: "", nome: nomeBling };
  return { fonte: FONTE.NENHUMA, rotulo: "", titulo: "", descricaoBase: "", nome: "" };
}

/** Itens que o PAIIA não confirmou (viram linhas "[A CONFIRMAR]"). */
export const PENDENCIAS_PADRAO = Object.freeze([
  "Aplicação (montadora, modelo, motor e ano): não encontrada nos catálogos.",
  "Equivalências e códigos de outras marcas.",
  "Características técnicas (medidas, conector, tensão).",
]);

/**
 * Descrição provisória: só o que é confirmado + o bloco "[A CONFIRMAR]".
 * O bloco impede a publicação até ser conferido e apagado.
 */
export function montarDescricaoProvisoria({ codigo = "", nome = "", numeroPeca = "", descricaoBase = "", pendencias = PENDENCIAS_PADRAO } = {}) {
  const base = String(descricaoBase || "").trim();
  if (base) return base; // texto já publicado/revisado por nós: fica como está
  const linhas = [];
  const nomeLimpo = tirarMarcas(nome);
  if (nomeLimpo) linhas.push(nomeLimpo, "");
  linhas.push("INFORMAÇÕES CONFIRMADAS");
  if (txt(codigo)) linhas.push(`Código: ${txt(codigo)}`);
  if (txt(numeroPeca) && norm(numeroPeca) !== norm(codigo)) linhas.push(`Número da peça: ${txt(numeroPeca)}`);
  linhas.push("");
  linhas.push(`${MARCA_A_CONFIRMAR} Confira e apague esta parte antes de publicar:`);
  for (const p of pendencias) linhas.push(`${MARCA_A_CONFIRMAR} ${p}`);
  return linhas.join("\n");
}

/** Monta o anúncio provisório a partir das fontes. */
export function montarAnuncioProvisorio({ codigo = "", fichas = [], ml = [], bling = null } = {}) {
  const f = escolherFonte({ fichas, ml, bling });
  const titulo = f.fonte === FONTE.FICHA && f.titulo ? tituloDaFicha(f.titulo) : montarTituloProvisorio({ nome: f.nome, codigo });
  const descricao = montarDescricaoProvisoria({ codigo, nome: f.nome, numeroPeca: f.numeroPeca, descricaoBase: f.descricaoBase });
  return { ...f, titulo, descricao, provisorio: f.fonte !== FONTE.FICHA || !f.descricaoBase };
}

/**
 * Texto de uma ficha da base: o APROVADO na Conferência vale mais; depois o
 * do Novo Anúncio. row = linha de paiia_anuncios (com dados_conferencia).
 */
export function textoDaFicha(row) {
  const d = row?.dados_conferencia && typeof row.dados_conferencia === "object" ? row.dados_conferencia : {};
  const conf = d.ficha?.anuncioConferido || {};
  const na = d.novo_anuncio || {};
  const a = d.anuncio || {};
  return {
    titulo: txt(conf.titulo) || txt(na.titulo) || txt(a.titulo) || txt(row?.titulo),
    descricao: String(conf.descricao || na.descricao || a.descricao || "").trim(),
  };
}

const comTempo = (p, ms) => {
  let t;
  return Promise.race([Promise.resolve(p), new Promise((_, rej) => { t = setTimeout(() => rej(new Error("tempo esgotado")), ms); })]).finally(() => clearTimeout(t));
};

/**
 * Junta as fontes (SÓ LEITURA). Nunca lança: o que falhar só fica de fora.
 * consulta: resultado de consultarSKURapido (Bling, fichas e as contas ML, já com a duplicidade).
 * lerFicha(id) → { ok, ficha: row }; consultarML(conta, caminho) → { ok, dados }.
 * Só UMA conta ML é aberta (a primeira na ordem REVELAÇÃO > LOJA ONLINE > CIEBR com anúncio deste SKU).
 */
export async function reunirFontesProvisorias({ consulta = null, lerFicha = null, consultarML = null, maxFichas = 3, tempoMaximoMs = 15000 } = {}) {
  const fichas = [];
  const lista = Array.isArray(consulta?.fichas?.lista) ? consulta.fichas.lista.slice(0, maxFichas) : [];
  if (typeof lerFicha === "function") {
    const lidas = await Promise.all(lista.map((f) => comTempo(lerFicha(f.id), tempoMaximoMs).catch(() => null)));
    lidas.forEach((r, i) => {
      if (!r?.ok || !r.ficha) return;
      fichas.push({ id: lista[i].id, publicada: lista[i].publicada, atualizada: lista[i].atualizada, ...textoDaFicha(r.ficha) });
    });
  }
  const ml = (Array.isArray(consulta?.ml) ? consulta.ml : [])
    .filter((m) => m?.estado === "encontrado" && Array.isArray(m.anuncios) && m.anuncios.length)
    .map((m) => ({ conta: m.conta, nome: m.nome, anuncios: m.anuncios.map((a) => ({ mlb: a.mlb, titulo: a.titulo })) }))
    .sort((a, b) => posicaoConta(a.conta) - posicaoConta(b.conta));
  if (!fichas.some((f) => f.titulo || f.descricao) && ml.length && typeof consultarML === "function") {
    const alvo = ml[0].anuncios[0];
    const [item, desc] = await Promise.all([
      comTempo(consultarML(ml[0].conta, `/items/${alvo.mlb}`), tempoMaximoMs).catch(() => null),
      comTempo(consultarML(ml[0].conta, `/items/${alvo.mlb}/description`), tempoMaximoMs).catch(() => null),
    ]);
    const dados = item?.ok ? dadosDoItemML(item.dados) : null;
    if (dados && dados.mlb === txt(alvo.mlb).toUpperCase()) {
      if (dados.titulo) alvo.titulo = dados.titulo;
      alvo.numeroPeca = dados.numeroPeca;
    }
    const texto = desc?.ok ? txt(desc.dados?.plain_text) : "";
    if (texto) alvo.descricao = texto;
  }
  return { fichas, ml, bling: consulta?.bling || null };
}

/** O texto ainda tem algo marcado como não confirmado? */
export function temMarcaAConfirmar(...textos) {
  // Qualquer grafia ("[A Confirmar]", "[a confirmar]", sem acento...): na dúvida, bloqueia.
  return textos.some((t) => /\[\s*a\s+confirmar\s*\]/i.test(semAcento(t)));
}

/**
 * Campo pertence ao usuário (não pode ser trocado pelo PAIIA) quando tem
 * texto e esse texto NÃO é o último que o próprio PAIIA preencheu.
 */
export function campoDoUsuario(atual, ultimoAutomatico) {
  const a = txt(atual);
  return Boolean(a) && a !== txt(ultimoAutomatico);
}

/**
 * Decide o valor final de um campo: o do usuário fica; senão entra o novo
 * (vazio não apaga nada que o usuário escreveu).
 */
export function valorSemSobrescrever({ atual = "", ultimoAutomatico = "", novo = "" } = {}) {
  if (campoDoUsuario(atual, ultimoAutomatico)) return { valor: atual, preservado: true };
  return { valor: novo, preservado: false };
}

// ---------------- Publicação: outro anúncio do mesmo SKU na mesma conta ----------------
export const TIPO_ML = Object.freeze({ classico: "gold_special", premium: "gold_pro" });
export const NOME_TIPO_ML = Object.freeze({ gold_special: "Clássico", gold_pro: "Premium", free: "Grátis" });

/**
 * Mesmo SKU já anunciado NESTA conta (ativo/pausado): o Mercado Livre não aceita
 * dois anúncios iguais do mesmo produto na mesma conta, mas aceita o mesmo
 * produto em Clássico e em Premium. Então:
 *  - "livre": nenhum anúncio ativo deste SKU nesta conta;
 *  - "confirmar": todos os existentes são de OUTRO tipo → pede a sua confirmação;
 *  - "bloqueia": algum é do MESMO tipo, de tipo desconhecido, ou um MLB
 *    registrado não foi confirmado no ML (na dúvida, bloqueia).
 * ml: resultado de consultarDuplicidadeML (duplicados com .tipo; conferidosBase com .tipo).
 */
export function avaliarOutroAnuncioNaConta({ ml = null, tipoAnuncio = "classico" } = {}) {
  const tipoNovo = TIPO_ML[tipoAnuncio === "premium" ? "premium" : "classico"];
  const vazio = { estado: "livre", existentes: [], ids: "", texto: "" };
  if (!ml || ml.erro || ml.carregando) return vazio;
  const existentes = [
    ...(ml.duplicados || []).map((d) => ({ mlb: txt(d.id).toUpperCase(), tipo: txt(d.tipo) })),
    ...(ml.conferidosBase || []).filter((c) => !c.libera && txt(c.status) && c.situacao !== "nao_confirmada").map((c) => ({ mlb: txt(c.mlb).toUpperCase(), tipo: txt(c.tipo) })),
  ];
  const incertos = (ml.conferidosBase || []).filter((c) => !c.libera && (!txt(c.status) || c.situacao === "nao_confirmada"));
  if (!existentes.length && !incertos.length) return vazio;
  const ids = existentes.map((e) => e.mlb).sort().join(",");
  const lista = existentes.map((e) => `${e.mlb} (${NOME_TIPO_ML[e.tipo] || "tipo não informado"})`).join(", ");
  const nomeNovo = NOME_TIPO_ML[tipoNovo];
  if (incertos.length) {
    return { estado: "bloqueia", existentes, ids, texto: `MLB registrado nesta conta sem confirmação no Mercado Livre (${incertos.map((c) => c.mlb).join(", ")}). Publicação bloqueada até confirmar.` };
  }
  if (existentes.some((e) => !e.tipo || e.tipo === tipoNovo)) {
    return { estado: "bloqueia", existentes, ids, texto: `Já existe anúncio deste SKU nesta conta: ${lista}. O Mercado Livre não permite outro anúncio ${nomeNovo} igual na mesma conta. Para outro anúncio aqui, escolha o outro tipo (Clássico/Premium) ou publique em outra conta.` };
  }
  return { estado: "confirmar", existentes, ids, texto: `Já existe anúncio deste SKU nesta conta: ${lista}. Este novo será ${nomeNovo} (tipo diferente). Confirme para continuar.` };
}

/** Chave da confirmação: vale só para ESTES MLBs e ESTE tipo (mudou algo = confirmar de novo). */
export function chaveOutroAnuncio(av, tipoAnuncio = "classico") {
  return av?.estado === "confirmar" && av.ids ? `${av.ids}|${TIPO_ML[tipoAnuncio === "premium" ? "premium" : "classico"]}` : "";
}

/** Todos os MLBs pendentes estão entre os existentes de outro tipo (já avaliados)? */
export function mlbsCobertos(mlbs = [], av = null) {
  if (av?.estado !== "confirmar") return false;
  const ids = new Set((av.existentes || []).map((e) => e.mlb));
  const lista = (Array.isArray(mlbs) ? mlbs : []).map((m) => txt(m).toUpperCase());
  return lista.length > 0 && lista.every((m) => ids.has(m));
}
