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
      partes.push(duplicadoNaConta ? "diferenciar o envio ou o tipo de anúncio ou unificar num anúncio só; qual manter é decisão sua (histórico, reputação e posição, não só vendas)" : "diferenciar o envio ou o tipo de anúncio entre as contas");
      recomendacao = { acao: duplicadoNaConta ? "unificar (decisão sua)" : "melhorar", texto: partes.join("; ") + ".", regras: ["R1", "R2", "R3", ...(clonado ? ["R5"] : [])] };
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

// =============================================================
// (12/11) CONFERÊNCIA DETALHADA de cada possível duplicidade, separada em
// (1) entre contas e (2) dentro da mesma conta. Confere código da peça,
// quantidade (unidade x kit), marca, aplicações (compatibilidades do ML),
// tipo de anúncio e condições de venda, e mostra o histórico comercial.
// Nunca sugere encerrar só porque outro anúncio vende mais.
// =============================================================

/** Aplicações: compara os veículos compatíveis (ids do catálogo do ML). */
export function compararAplicacoes(x, y) {
  if (!Array.isArray(x) || !Array.isArray(y)) return { situacao: "nao_lidas", texto: "aplicações não lidas" };
  if (!x.length || !y.length) return { situacao: "sem_cadastro", texto: `aplicações cadastradas: ${x.length} x ${y.length}` };
  const A = new Set(x), B = new Set(y);
  const comuns = [...A].filter((v) => B.has(v)).length;
  const menor = Math.min(A.size, B.size), maior = Math.max(A.size, B.size);
  if (!comuns) return { situacao: "diferentes", texto: `nenhum veículo em comum (${A.size} x ${B.size})` };
  if (comuns === A.size && comuns === B.size) return { situacao: "iguais", texto: `mesmos ${comuns} veículos` };
  if (comuns >= 0.9 * menor) return { situacao: "contidas", texto: `${comuns} em comum; um anúncio tem ${maior - menor} veículo(s) a mais (${A.size} x ${B.size})` };
  return { situacao: "parciais", texto: `${comuns} veículo(s) em comum de ${A.size} x ${B.size}` };
}

const pctDif = (a, b) => { const m = Math.min(a, b); return m > 0 ? Math.abs(a - b) / m : null; };

/** Conferência item a item de um par de anúncios. */
export function conferirPar(a, b, compat = {}) {
  const comum = (x, y) => x.some((v) => y.includes(v));
  const sku = a.skus.length && b.skus.length ? comum(a.skus, b.skus) : null;
  const peca = a.pecas.length && b.pecas.length ? comum(a.pecas, b.pecas) : null;
  const marca = a.marca && b.marca ? a.marca === b.marca : null;
  const quantidade = a.unidades === b.unidades;
  const aplic = compararAplicacoes(compat[a.id], compat[b.id]);
  const tipo = a.tipo === b.tipo;
  const envio = a.envio === b.envio;
  const frete = a.frete_gratis === b.frete_gratis;
  const dif = pctDif(a.preco, b.preco);
  const clonado = comum(a.fotos, b.fotos);
  // Identidade: mesmo código (SKU ou peça), mesma quantidade, mesma marca e
  // aplicações que não se contradizem.
  const codigoOk = sku === true || peca === true;
  const identidade = codigoOk && quantidade && marca !== false && aplic.situacao !== "diferentes";
  const mesmasCondicoes = tipo && envio && frete;
  return {
    sku, peca, marca, quantidade, aplicacoes: aplic, tipo, envio, frete_gratis: frete,
    diferenca_preco: dif === null ? null : Math.round(dif * 1000) / 10, clonado,
    identidade_confirmada: identidade, aplicacoes_divergentes: aplic.situacao === "diferentes" || aplic.situacao === "parciais",
    mesmas_condicoes: mesmasCondicoes,
  };
}

const historico = (f) => ({ id: f.id, conta: f.conta_nome || f.conta, titulo: f.titulo, sku: f.skus.join(", "), marca: f.marca_nome, unidades: f.unidades, tipo: f.tipo, envio: f.envio, frete_gratis: f.frete_gratis, preco: f.preco, vendidos_total: f.vendidos_total, visitas30: f.visitas30, criado_em: f.criado_em, estoque: f.estoque, link: f.link });

/**
 * Classifica um par já conferido. Devolve { atencao, nivel, motivo, recomendacao, regras }.
 * Mesma conta: R1 é explícita — só é proibido com as MESMAS condições de venda.
 * Entre contas: as regras oficiais não dizem se a duplicidade vale entre contas
 * (lacuna): o máximo é "melhorar/diferenciar", nunca "encerrar".
 */
export function classificarPar(c, mesmaConta) {
  if (!c.identidade_confirmada) {
    return { atencao: c.aplicacoes_divergentes, nivel: "conferir", motivo: c.aplicacoes.situacao === "diferentes" ? "mesmo código, mas aplicações diferentes: pode ser produto diferente ou cadastro incompleto" : "identidade não confirmada (código, quantidade ou marca)", recomendacao: "Conferir o cadastro antes de qualquer decisão.", regras: [] };
  }
  if (mesmaConta) {
    if (c.mesmas_condicoes) {
      return { atencao: true, nivel: "alto", motivo: "mesmo produto, na mesma conta, com o mesmo tipo de anúncio e o mesmo envio", recomendacao: "Diferenciar a condição de venda (envio ou tipo) ou unificar num anúncio só, juntando as aplicações (R3). A escolha de qual manter é sua: considere histórico, reputação do anúncio e posição na busca, não só as vendas.", regras: ["R1", "R2", "R3"] };
    }
    return { atencao: false, nivel: "permitido", motivo: `condições de venda diferentes (${[!c.tipo && "tipo", !c.envio && "envio", !c.frete_gratis && "frete"].filter(Boolean).join(", ")})`, recomendacao: "Manter: a regra oficial permite repetir com outra forma de envio ou pagamento.", regras: ["R1"] };
  }
  if (c.clonado) {
    return { atencao: true, nivel: "alto", motivo: "fotos idênticas entre contas (clonagem)", recomendacao: "Usar fotos próprias em cada conta.", regras: ["R5"] };
  }
  if (c.mesmas_condicoes && c.diferenca_preco !== null && c.diferenca_preco <= 5) {
    return { atencao: true, nivel: "alto", motivo: "mesmo produto, mesmo tipo, mesmo envio e preço praticamente igual nas duas contas", recomendacao: "Diferenciar de verdade a condição de venda entre as contas (envio ou tipo). As regras não dizem se vale entre contas do mesmo dono: consultar o suporte do ML antes de encerrar qualquer anúncio.", regras: ["R1", "R4", "R7"] };
  }
  if (c.mesmas_condicoes) {
    return { atencao: false, nivel: "medio", motivo: "mesmas condições; só o preço é diferente (regra ambígua)", recomendacao: "Acompanhar; se quiser reduzir o risco, diferenciar envio ou tipo.", regras: ["R4", "R7"] };
  }
  return { atencao: false, nivel: "baixo", motivo: "condições de venda diferentes entre as contas", recomendacao: "Manter.", regras: ["R1", "R3"] };
}

/** Separa (1) entre contas e (2) dentro da mesma conta, par a par, com a conferência. */
export function separarDuplicidades({ contas, anuncios, visitas = {}, compat = {} }) {
  const fichas = [];
  for (const c of contas) for (const it of anuncios[c.id] || []) {
    const f = fichaCruzamento(it, c);
    if (visitas[f.id] !== undefined) f.visitas30 = visitas[f.id];
    fichas.push(f);
  }
  const grupos = agruparMesmoProduto(fichas);
  const entre = [], dentro = [];
  for (const g of grupos) {
    const membros = g.membros.map((i) => fichas[i]);
    for (let x = 0; x < membros.length; x++) for (let y = x + 1; y < membros.length; y++) {
      const a = membros[x], b = membros[y];
      if (!sinaisEntre(a, b).length) continue;
      const c = conferirPar(a, b, compat);
      const mesma = a.conta === b.conta;
      const cl = classificarPar(c, mesma);
      (mesma ? dentro : entre).push({ a: historico(a), b: historico(b), sinais: sinaisEntre(a, b), conferencia: c, ...cl, situacao: "pendente de autorização" });
    }
  }
  const ordem = { alto: 0, conferir: 1, medio: 2, baixo: 3, permitido: 4 };
  const vendas = (p) => (p.a.vendidos_total || 0) + (p.b.vendidos_total || 0);
  const ord = (l) => l.sort((p, q) => Number(q.atencao) - Number(p.atencao) || ordem[p.nivel] - ordem[q.nivel] || vendas(q) - vendas(p));
  const resumo = (l) => { const r = { total: l.length, atencao: l.filter((p) => p.atencao).length }; for (const p of l) r[p.nivel] = (r[p.nivel] || 0) + 1; return r; };
  return { entre_contas: ord(entre), mesma_conta: ord(dentro), resumo: { entre_contas: resumo(entre), mesma_conta: resumo(dentro) } };
}

// =============================================================
// (12/11) RELATÓRIO ENTRE CONTAS, uma linha por PRODUTO (a mesma peça não é
// contada várias vezes). Não presume que o mesmo produto em contas diferentes
// seja proibido: as regras oficiais não tratam disso (lacuna). Separa:
//   - "Precisa de atenção": fotos copiadas entre contas (R5) ou a mesma oferta
//     idêntica (tipo, envio e preço) nas contas (R7/R12, zona cinzenta);
//   - "Conferir cadastro": mesmo código, aplicações divergentes;
//   - "Acompanhar": só o preço diferencia (R4 ambígua);
//   - "Permitido": condições de venda diferentes entre as contas (R1).
// =============================================================
const SITUACOES_ENTRE = {
  atencao: { ordem: 1, nome: "Precisa de atenção" },
  conferir: { ordem: 2, nome: "Conferir cadastro" },
  acompanhar: { ordem: 3, nome: "Acompanhar (só o preço difere)" },
  permitido: { ordem: 4, nome: "Permitido (condições diferentes)" },
};

export function relatorioEntreContas({ contas, anuncios, visitas = {}, compat = {} }) {
  const fichas = [];
  for (const c of contas) for (const it of anuncios[c.id] || []) {
    const f = fichaCruzamento(it, c);
    if (visitas[f.id] !== undefined) f.visitas30 = visitas[f.id];
    fichas.push(f);
  }
  const linhas = [];
  for (const g of agruparMesmoProduto(fichas)) {
    const membros = g.membros.map((i) => fichas[i]);
    if (new Set(membros.map((m) => m.conta)).size < 2) continue; // só produtos em 2+ contas
    const pares = [];
    for (let x = 0; x < membros.length; x++) for (let y = x + 1; y < membros.length; y++) {
      const a = membros[x], b = membros[y];
      if (a.conta === b.conta || !sinaisEntre(a, b).length) continue;
      const c = conferirPar(a, b, compat);
      pares.push({ a, b, c, cl: classificarPar(c, false) });
    }
    if (!pares.length) continue;
    const clonados = pares.filter((p) => p.c.clonado);
    const identicos = pares.filter((p) => p.cl.nivel === "alto" && !p.c.clonado);
    const conferir = pares.filter((p) => p.cl.nivel === "conferir");
    const soPreco = pares.filter((p) => p.cl.nivel === "medio");
    let situacao, motivo, recomendacao, regras;
    if (clonados.length || identicos.length) {
      situacao = "atencao";
      const partes = [];
      if (clonados.length) partes.push(`fotos idênticas entre contas (${[...new Set(clonados.flatMap((p) => [p.a.conta_nome, p.b.conta_nome]))].join(" e ")})`);
      if (identicos.length) partes.push(`oferta idêntica — mesmo tipo, mesmo envio e preço até 5% de diferença (${[...new Set(identicos.flatMap((p) => [p.a.conta_nome, p.b.conta_nome]))].join(" e ")})`);
      motivo = partes.join("; ");
      const rec = [];
      if (clonados.length) rec.push("Usar fotos próprias em cada conta: clonar publicações e imagens é moderado pelo ML (R5).");
      if (identicos.length) rec.push("Nenhuma regra oficial proíbe o mesmo produto em contas diferentes. O risco é a mesma oferta disputar a mesma busca (R7) e, no catálogo, as contas competirem entre si (R12). Opções: manter e acompanhar; diferenciar a condição de venda entre as contas (tipo ou envio); ou consultar o suporte do ML. Não encerrar sem resposta oficial.");
      recomendacao = rec.join(" ");
      regras = [...(clonados.length ? ["R5"] : []), ...(identicos.length ? ["R7", "R12"] : [])].join(", ");
    } else if (conferir.length) {
      situacao = "conferir";
      motivo = conferir[0].cl.motivo;
      recomendacao = "Revisar o cadastro de aplicações (veículos compatíveis) nas contas: pode ser cadastro incompleto ou produto diferente.";
      regras = "R3";
    } else if (soPreco.length) {
      situacao = "acompanhar";
      motivo = "mesmo tipo e mesmo envio; só o preço é diferente";
      recomendacao = "Manter e acompanhar. A regra sobre preço como diferença é ambígua (R4).";
      regras = "R4";
    } else {
      situacao = "permitido";
      motivo = "condições de venda diferentes entre as contas (tipo ou envio)";
      recomendacao = "Manter.";
      regras = "R1";
    }
    const catalogo = (() => {
      const porCat = {};
      for (const m of membros) if (m.catalogo) (porCat[m.catalogo] = porCat[m.catalogo] || new Set()).add(m.conta);
      return Object.values(porCat).some((s) => s.size > 1);
    })();
    const precos = membros.map((m) => m.preco).filter((v) => v > 0);
    const aplic = [...new Set(pares.map((p) => p.c.aplicacoes.situacao))];
    const mesmaConta = membros.length > new Set(membros.map((m) => m.conta)).size;
    linhas.push({
      situacao, situacao_nome: SITUACOES_ENTRE[situacao].nome, ordem: SITUACOES_ENTRE[situacao].ordem,
      motivo, recomendacao, regras,
      titulo: melhorAnuncio(membros).titulo,
      sku: [...new Set(membros.flatMap((m) => m.skus))].join(", "),
      marca: [...new Set(membros.map((m) => m.marca_nome).filter(Boolean))].join(", "),
      contas: [...new Set(membros.map((m) => m.conta_nome))],
      anuncios: membros.map((m) => ({ ...historico(m), veiculos: Array.isArray(compat[m.id]) ? compat[m.id].length : null, fotos: m.fotos.length })),
      vendas_total: membros.reduce((s, m) => s + (m.vendidos_total || 0), 0),
      diferenca_preco_max: precos.length > 1 ? Math.round((Math.max(...precos) / Math.min(...precos) - 1) * 1000) / 10 : 0,
      fotos_iguais_entre_contas: clonados.length > 0,
      aplicacoes: aplic.join(", "),
      disputa_catalogo: catalogo,
      repetido_na_mesma_conta: mesmaConta,
      pares: pares.length,
      pares_atencao: clonados.length + identicos.length,
    });
  }
  linhas.sort((p, q) => p.ordem - q.ordem || q.vendas_total - p.vendas_total);
  const resumo = { produtos: linhas.length, pares: linhas.reduce((s, l) => s + l.pares, 0), pares_atencao: linhas.reduce((s, l) => s + l.pares_atencao, 0) };
  for (const k of Object.keys(SITUACOES_ENTRE)) resumo[k] = linhas.filter((l) => l.situacao === k).length;
  resumo.atencao_clonagem = linhas.filter((l) => l.situacao === "atencao" && l.fotos_iguais_entre_contas).length;
  return { resumo, linhas };
}
