// =============================================================
// PAIIA — Regras do Mercado Livre — Anúncios: CRUZAMENTO entre contas.
// Funções puras (sem rede): recebem os anúncios já lidos (GET /items/{id})
// de cada conta e devolvem os grupos do mesmo produto, o risco pelas regras
// oficiais (catalogoRegras.js) e uma recomendação PENDENTE de autorização.
// Nada aqui altera anúncios.
// =============================================================

const txt = (v) => String(v ?? "").trim();
/** Código para comparar: só letras e números, maiúsculas (o original nunca é alterado). */
export const codigo = (v) => txt(v).toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Z0-9]/g, "");
const norm = (v) => txt(v).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

function atributo(item, id) {
  const a = (item?.attributes || []).find((x) => x?.id === id);
  return a ? txt(a.value_name ?? a.values?.[0]?.name) : "";
}

/**
 * Quantas unidades o título anuncia: "Kit 4" / "4 Bicos" / "4x Bobinas" → 4,
 * "Par" → 2, "Jogo" sem número → "jogo". Kit sem número = 1 (produto único).
 */
export function unidadesAnunciadas(titulo) {
  const t = norm(titulo);
  const kit = t.match(/\bkit (?:com |c )?(\d{1,2})\b/);
  if (kit && Number(kit[1]) > 1) return Number(kit[1]);
  const inicio = t.match(/^(\d{1,2}) ?x? [a-z]/) || t.match(/\b(\d{1,2})x [a-z]/);
  if (inicio && Number(inicio[1]) > 1) return Number(inicio[1]);
  const un = t.match(/\b(\d{1,2}) ?(?:u|un|und|unid|unidades|pcs|pecas)\b/);
  if (un && Number(un[1]) > 1) return Number(un[1]);
  if (/\bpar\b/.test(t)) return 2;
  if (/\bjogo\b/.test(t)) return "jogo";
  return 1;
}

/** SKUs do anúncio (campo do vendedor, atributo e variações), normalizados. */
export function skusDoAnuncio(item) {
  const out = new Set();
  const add = (v) => { const c = codigo(v); if (c.length >= 3) out.add(c); };
  add(item?.seller_custom_field);
  add(atributo(item, "SELLER_SKU"));
  for (const v of item?.variations || []) {
    add(v?.seller_custom_field);
    for (const a of v?.attributes || []) if (a?.id === "SELLER_SKU") add(a.value_name);
  }
  return [...out];
}

/**
 * Códigos de um atributo ("A / B", "A, B"). Só vale como código o que tem
 * número e 4+ caracteres: "Renault" no campo OEM não é código (caso real de
 * 12/11 que juntava 17 peças diferentes).
 */
function codigosDoAtributo(item, id, marca = "") {
  return atributo(item, id).split(/[\/,;|]+/).map(codigo).filter((c) => c.length >= 4 && /\d/.test(c) && c !== marca);
}
/** Vários códigos num atributo = conjunto (ex.: jogo pré e pós): compara o conjunto inteiro. */
const chaveConjunto = (lista) => (lista.length ? [...new Set(lista)].sort().join("+") : "");

/** Resumo do anúncio com tudo o que o cruzamento usa. */
export function fichaCruzamento(item, conta) {
  const marca = codigo(atributo(item, "BRAND"));
  return {
    id: txt(item.id),
    conta: txt(conta?.id ?? item.seller_id),
    conta_nome: txt(conta?.nome),
    titulo: txt(item.title),
    preco: Number(item.price) || 0,
    status: txt(item.status),
    tipo: txt(item.listing_type_id),
    envio: txt(item.shipping?.logistic_type) || txt(item.shipping?.mode) || "?",
    frete_gratis: item.shipping?.free_shipping === true,
    vendidos_total: Number.isFinite(Number(item.sold_quantity)) ? Number(item.sold_quantity) : null,
    estoque: Number(item.available_quantity) || 0,
    criado_em: txt(item.date_created).slice(0, 10),
    catalogo: txt(item.catalog_product_id) || null,
    no_catalogo: item.catalog_listing === true,
    marca,
    marca_nome: atributo(item, "BRAND"),
    unidades: unidadesAnunciadas(item.title),
    skus: skusDoAnuncio(item),
    gtins: codigosDoAtributo(item, "GTIN").filter((c) => /^\d{8,14}$/.test(c)),
    pecas: [chaveConjunto(codigosDoAtributo(item, "PART_NUMBER", marca))].filter(Boolean),
    oems: [chaveConjunto(codigosDoAtributo(item, "OEM", marca))].filter(Boolean),
    fotos: (item.pictures || []).map((p) => txt(p?.id)).filter(Boolean),
    sub_status: Array.isArray(item.sub_status) ? item.sub_status.map(String) : [],
    tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
    link: txt(item.permalink),
    visitas30: null,
  };
}

/**
 * Sinais FORTES de mesmo produto (ligam anúncios no grupo). Sempre exigem a
 * mesma quantidade (unidade x par x kit): kit e unidade são produtos diferentes.
 * OEM sozinho NÃO liga (marcas diferentes com o mesmo código original são
 * produtos diferentes): só OEM + mesma marca.
 */
export function sinaisEntre(a, b) {
  if (a.unidades !== b.unidades) return [];
  const comum = (x, y) => x.some((v) => y.includes(v));
  // (12/11) O SKU é o código do produto no nosso estoque: SKUs DIFERENTES =
  // produtos diferentes, mesmo com código de peça ou catálogo em comum (casos
  // reais: bucha superior x inferior, sonda x conector, unidade x kit 2 un.).
  if (a.skus.length && b.skus.length && !comum(a.skus, b.skus)) return [];
  const s = [];
  if (comum(a.gtins, b.gtins)) s.push("GTIN igual");
  if (a.marca && a.marca === b.marca && comum(a.pecas, b.pecas)) s.push("código da peça e marca iguais");
  if (a.marca && a.marca === b.marca && comum(a.oems, b.oems)) s.push("código OEM e marca iguais");
  if (comum(a.skus, b.skus)) s.push("SKU igual");
  if (a.catalogo && a.catalogo === b.catalogo) s.push("mesmo produto de catálogo");
  // Fotos iguais NÃO bastam para dizer que é o mesmo produto (a mesma foto pode
  // estar em peças diferentes, ex.: bobina dianteira e traseira). Só agravam o
  // risco quando outro sinal já confirmou o mesmo produto.
  if (s.length && comum(a.fotos, b.fotos)) s.push("mesmas fotos (clonagem)");
  return s;
}

const PRECO_PARECIDO = 0.05; // até 5% de diferença = mesmo preço na prática

/**
 * Risco entre DOIS anúncios do mesmo produto, pelas regras oficiais.
 * Alto: mesmo envio e mesmo tipo de anúncio com preço parecido, ou fotos
 *       clonadas, ou na MESMA conta (R1, R2, R5).
 * Médio: mesmo envio e mesmo tipo, mas preço diferente (R4 é ambígua) (R4, R7).
 * Baixo: envio ou tipo de anúncio diferentes (R1, R3, R4).
 */
export function riscoDoPar(a, b, sinais) {
  const mesmaConta = a.conta === b.conta;
  const clonado = sinais.includes("mesmas fotos (clonagem)");
  const mesmoEnvio = a.envio === b.envio && a.frete_gratis === b.frete_gratis;
  const mesmoTipo = a.tipo === b.tipo;
  const menor = Math.min(a.preco, b.preco);
  const precoParecido = menor > 0 && Math.abs(a.preco - b.preco) / menor <= PRECO_PARECIDO;
  const motivos = [];
  if (mesmaConta) motivos.push("na mesma conta");
  if (clonado) motivos.push("fotos iguais (clonagem)");
  if (mesmoEnvio) motivos.push("mesmo envio"); else motivos.push("envio diferente");
  if (mesmoTipo) motivos.push("mesmo tipo de anúncio"); else motivos.push("tipo de anúncio diferente");
  motivos.push(precoParecido ? "preço parecido" : "preço diferente");
  let nivel;
  let regras;
  // R1 permite repetir o mesmo produto (inclusive na mesma conta) com outra forma
  // de envio ou de pagamento: na mesma conta só é alto com envio e tipo iguais.
  if (clonado || (mesmoEnvio && mesmoTipo && (precoParecido || mesmaConta))) { nivel = "alto"; regras = ["R1", "R2", ...(clonado ? ["R5"] : []), "R3"]; }
  else if (mesmoEnvio && mesmoTipo) { nivel = "medio"; regras = ["R4", "R7"]; }
  else { nivel = "baixo"; regras = ["R1", "R3", "R4"]; }
  return { nivel, motivos, regras };
}

const PESO_NIVEL = { alto: 3, medio: 2, baixo: 1 };

/** Junta os anúncios em grupos do mesmo produto (união por sinais fortes). */
export function agruparMesmoProduto(fichas) {
  const pai = fichas.map((_, i) => i);
  const raiz = (i) => (pai[i] === i ? i : (pai[i] = raiz(pai[i])));
  // Índices por chave para não comparar todos com todos.
  const indice = new Map();
  const chaves = (f) => [
    ...f.gtins.map((c) => `g:${c}`),
    ...f.skus.map((c) => `s:${c}`),
    ...(f.marca ? f.pecas.map((c) => `p:${f.marca}:${c}`) : []),
    ...(f.marca ? f.oems.map((c) => `o:${f.marca}:${c}`) : []),
    ...(f.catalogo ? [`c:${f.catalogo}`] : []),
  ].map((k) => `${f.unidades}|${k}`);
  fichas.forEach((f, i) => {
    for (const k of chaves(f)) {
      const lista = indice.get(k) || [];
      lista.push(i);
      indice.set(k, lista);
    }
  });
  const pares = new Map();
  for (const lista of indice.values()) {
    if (lista.length < 2 || lista.length > 50) continue; // chave genérica demais (ex.: foto padrão)
    for (let x = 0; x < lista.length; x++) {
      for (let y = x + 1; y < lista.length; y++) {
        const [i, j] = [lista[x], lista[y]];
        const chave = `${i}-${j}`;
        if (pares.has(chave)) continue;
        const sinais = sinaisEntre(fichas[i], fichas[j]);
        if (!sinais.length) continue;
        pares.set(chave, { i, j, sinais });
        pai[raiz(i)] = raiz(j);
      }
    }
  }
  const grupos = new Map();
  fichas.forEach((f, i) => {
    const r = raiz(i);
    if (!grupos.has(r)) grupos.set(r, { membros: [], pares: [] });
    grupos.get(r).membros.push(i);
  });
  for (const p of pares.values()) grupos.get(raiz(p.i)).pares.push(p);
  return [...grupos.values()].filter((g) => g.membros.length > 1);
}

/** Qual anúncio manter: o que mais vendeu (histórico); empate → mais visitas → mais antigo. */
export function melhorAnuncio(membros) {
  return [...membros].sort((a, b) =>
    (b.vendidos_total ?? -1) - (a.vendidos_total ?? -1) ||
    (b.visitas30 ?? -1) - (a.visitas30 ?? -1) ||
    a.criado_em.localeCompare(b.criado_em))[0];
}

/**
 * Relatório do cruzamento. `contas` = [{ id, nome }]; `anuncios` = { [contaId]: [item ML] }.
 * Devolve grupos com contas, MLBs, sinais, risco (pior par), recomendação e regras.
 */
export function cruzarContas({ contas, anuncios, visitas = {} }) {
  const fichas = [];
  for (const c of contas) for (const it of anuncios[c.id] || []) {
    const f = fichaCruzamento(it, c);
    if (visitas[f.id] !== undefined) f.visitas30 = visitas[f.id];
    fichas.push(f);
  }
  const grupos = agruparMesmoProduto(fichas).map((g) => {
    const membros = g.membros.map((i) => fichas[i]);
    let pior = null;
    const pares = g.pares.map((p) => {
      const a = fichas[p.i];
      const b = fichas[p.j];
      const r = riscoDoPar(a, b, p.sinais);
      const par = { a: a.id, b: b.id, sinais: p.sinais, ...r };
      if (!pior || PESO_NIVEL[r.nivel] > PESO_NIVEL[pior.nivel]) pior = par;
      return par;
    });
    const contasDoGrupo = [...new Set(membros.map((m) => m.conta_nome || m.conta))];
    const manter = melhorAnuncio(membros);
    const clonado = pares.some((p) => p.sinais.includes("mesmas fotos (clonagem)"));
    const mesmaConta = membros.length > new Set(membros.map((m) => m.conta)).size;
    const porId = Object.fromEntries(membros.map((m) => [m.id, m]));
    const duplicadoNaConta = pares.some((p) => p.nivel === "alto" && porId[p.a].conta === porId[p.b].conta);
    let recomendacao;
    if (pior.nivel === "baixo") {
      recomendacao = { acao: "manter", texto: "Já há diferença de envio ou de tipo de anúncio entre as contas.", regras: ["R1", "R3"] };
    } else if (pior.nivel === "medio") {
      recomendacao = { acao: "melhorar", texto: "Só o preço diferencia os anúncios (regra ambígua): diferenciar de verdade o envio ou o tipo de anúncio entre as contas.", regras: ["R1", "R4"] };
    } else {
      const partes = [];
      if (duplicadoNaConta) partes.push("há anúncio repetido dentro da mesma conta com o mesmo envio e o mesmo tipo");
      if (clonado) partes.push("trocar as fotos copiadas por fotos próprias em cada conta (R5)");
      partes.push("diferenciar o envio ou o tipo de anúncio; se não for possível, avaliar encerrar os demais e manter o de melhor desempenho");
      recomendacao = { acao: duplicadoNaConta ? "encerrar (sugerir)" : "melhorar", texto: partes.join("; ") + ".", regras: ["R1", "R2", "R3", ...(clonado ? ["R5"] : [])] };
    }
    return {
      contas: contasDoGrupo,
      entre_contas: contasDoGrupo.length > 1,
      mesma_conta: mesmaConta,
      duplicado_na_conta: duplicadoNaConta,
      titulo: manter.titulo,
      anuncios: membros.map((m) => ({ id: m.id, conta: m.conta_nome || m.conta, titulo: m.titulo, preco: m.preco, tipo: m.tipo, envio: m.envio, frete_gratis: m.frete_gratis, vendidos_total: m.vendidos_total, visitas30: m.visitas30, estoque: m.estoque, criado_em: m.criado_em, skus: m.skus, link: m.link })),
      sinais: [...new Set(pares.flatMap((p) => p.sinais))],
      risco: pior.nivel,
      motivos_risco: pior.motivos,
      regras_risco: pior.regras,
      manter_sugerido: manter.id,
      recomendacao: { ...recomendacao, situacao: "pendente de autorização" },
    };
  });
  grupos.sort((x, y) => PESO_NIVEL[y.risco] - PESO_NIVEL[x.risco] || y.anuncios.length - x.anuncios.length);
  const porNivel = { alto: 0, medio: 0, baixo: 0 };
  for (const g of grupos) porNivel[g.risco]++;
  return {
    anuncios_lidos: Object.fromEntries(contas.map((c) => [c.nome || c.id, (anuncios[c.id] || []).length])),
    grupos_total: grupos.length,
    grupos_entre_contas: grupos.filter((g) => g.entre_contas).length,
    grupos_mesma_conta: grupos.filter((g) => g.mesma_conta).length,
    grupos_duplicado_na_conta: grupos.filter((g) => g.duplicado_na_conta).length,
    por_risco: porNivel,
    grupos,
  };
}
