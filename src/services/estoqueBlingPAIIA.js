/*
 * ESTOQUE ÚNICO + PRODUTO NO BLING — funções puras (sem rede).
 *
 * Regras (definidas pelo usuário em 05/10/2026):
 *  - UMA única quantidade confirmada por anúncio: a mesma na ficha,
 *    Conferência, Publicação, validação e no payload do Mercado Livre.
 *  - Nunca assumir quantidade 1 (nem nenhuma outra) automaticamente.
 *  - SKU existente no Bling: mostrar físico e disponível vindos do Bling.
 *  - SKU inexistente no Bling: exigir a quantidade confirmada pelo usuário.
 *  - Criar produto no Bling só com clique/autorização, com os dados
 *    confirmados da ficha (nada inventado), conferindo duplicidade antes
 *    e relendo o Bling depois.
 * Testes: scripts/testes/estoqueBlingPAIIA.test.mjs
 */

const texto = (v) => String(v ?? "").replace(/\s+/g, " ").trim();
const normalizarSku = (v) => texto(v).toUpperCase().replace(/[^A-Z0-9]/g, "");

/** "68" → 68. Vazio, zero, negativo, fração ou texto → null (nunca 1). */
export function normalizarQuantidade(valor) {
  const t = texto(valor);
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return Number.isSafeInteger(n) && n >= 1 ? n : null;
}

/**
 * Quantidade do anúncio a partir da ficha.
 *  1) aprovada na Conferência (anuncioConferido.quantidade) → confirmada;
 *  2) ficha antiga (só o campo "Estoque" da Conferência) → mostrada, mas
 *     o usuário precisa CONFIRMAR na Publicação;
 *  3) nada → vazio (a Publicação exige a quantidade).
 */
export function quantidadeDaFicha(anuncio = {}, quantidadeCampoFicha = "") {
  const aprovada = normalizarQuantidade(anuncio?.quantidade);
  if (aprovada) {
    return { valor: aprovada, confirmada: anuncio?.quantidadeConfirmada !== false, origem: "conferencia" };
  }
  const antiga = normalizarQuantidade(quantidadeCampoFicha);
  if (antiga) return { valor: antiga, confirmada: false, origem: "ficha_campo_estoque" };
  return { valor: null, confirmada: false, origem: "nenhuma" };
}

/**
 * Situação do estoque para a validação da Publicação.
 * bling = resposta de saldo_por_sku; qtd = quantidade do anúncio.
 * Devolve { nivel: "ok"|"aviso"|"erro", texto }.
 */
export function conferirEstoque({ quantidade, confirmada, bling }) {
  const qtd = normalizarQuantidade(quantidade);
  if (!qtd) {
    return { nivel: "erro", texto: "Quantidade não informada: informe e confirme a quantidade (o PAIIA não assume nenhum valor)." };
  }
  if (bling === null || bling === undefined) {
    return { nivel: "aviso", texto: `Anúncio: ${qtd}. Consultando o Bling...` };
  }
  if (bling?.ambiguo) {
    return { nivel: "erro", texto: "Mais de um produto no Bling com este SKU: resolva no Bling antes." };
  }
  if (bling?.encontrado && bling?.saldoVirtualTotal != null) {
    const disp = Number(bling.saldoVirtualTotal);
    const fis = bling.saldoFisicoTotal != null ? Number(bling.saldoFisicoTotal) : null;
    const base = `Bling (SKU ${bling?.produto?.codigo || "—"}): físico ${fis ?? "—"} · disponível ${disp}. Anúncio: ${qtd}.`;
    if (qtd > disp) return { nivel: "erro", texto: `${base} A quantidade do anúncio é maior que o disponível no Bling.` };
    if (!confirmada) return { nivel: "erro", texto: `${base} Confirme a quantidade do anúncio.` };
    return { nivel: "ok", texto: base };
  }
  if (bling?.encontrado) {
    return {
      nivel: confirmada ? "aviso" : "erro",
      texto: `Anúncio: ${qtd}. Produto existe no Bling, mas o saldo não pôde ser lido${bling?.mensagem ? ` (${bling.mensagem})` : ""}.${confirmada ? "" : " Confirme a quantidade."}`,
    };
  }
  if (bling?.encontrado === false) {
    return confirmada
      ? { nivel: "erro", texto: `Quantidade confirmada: ${qtd}. SKU não existe no Bling: crie o produto no Bling (botão "Criar produto no Bling") antes de validar no Mercado Livre.` }
      : { nivel: "erro", texto: `Quantidade: ${qtd} (ainda não confirmada). SKU não existe no Bling: confirme a quantidade e crie o produto no Bling.` };
  }
  return {
    nivel: confirmada ? "aviso" : "erro",
    texto: `Anúncio: ${qtd}. Não foi possível consultar o Bling agora.${confirmada ? "" : " Confirme a quantidade."}`,
  };
}

/**
 * Estoque quando o anúncio NÃO usa o Bling (Bling opcional, 17/10/2026).
 * escolhido=false → o usuário ainda não escolheu (usar o Bling ou seguir sem).
 * Nada é consultado no Bling: vale só a quantidade confirmada da ficha.
 */
export function conferirEstoqueSemBling({ quantidade, confirmada, escolhido }) {
  const qtd = normalizarQuantidade(quantidade);
  if (!qtd) {
    return { nivel: "erro", texto: "Quantidade não informada: informe e confirme a quantidade (o PAIIA não assume nenhum valor)." };
  }
  if (!escolhido) {
    return { nivel: "erro", texto: `Anúncio: ${qtd}. Escolha no bloco do Bling: usar o Bling neste anúncio ou publicar sem Bling.` };
  }
  if (!confirmada) {
    return { nivel: "erro", texto: `Quantidade: ${qtd} (ainda não confirmada). Sem Bling: confirme a quantidade do anúncio.` };
  }
  return { nivel: "ok", texto: `Sem Bling neste anúncio. Quantidade confirmada: ${qtd}.` };
}

/**
 * Cadastro que SERIA criado no Bling, só com dados confirmados da ficha.
 * Devolve { produto, faltando[] } — com algo faltando, a criação fica bloqueada.
 */
export function montarProdutoBling({ anuncio = {}, titulo = "", quantidade, logistica } = {}) {
  const medida = logistica?.medida || null;
  const num = (v) => {
    const n = Number(String(v ?? "").replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const produto = {
    codigo: texto(anuncio?.codigo || anuncio?.oem),
    nome: texto(titulo || anuncio?.titulo).slice(0, 120),
    marca: texto(anuncio?.marca),
    preco: texto(anuncio?.preco),
    gtin: texto(anuncio?.gtin),
    estoque_inicial: normalizarQuantidade(quantidade),
    pesoBruto_g: num(medida?.peso_g),
    dimensoes_cm: {
      profundidade: num(medida?.comprimento_cm),
      largura: num(medida?.largura_cm),
      altura: num(medida?.altura_cm),
    },
    tipo: "P",
    situacao: "A",
    formato: "S",
  };
  const precoNum = Number(produto.preco.includes(",") ? produto.preco.replace(/\./g, "").replace(",", ".") : produto.preco);
  const faltando = [];
  if (!produto.codigo) faltando.push("SKU/código");
  if (!produto.nome) faltando.push("descrição/nome do produto");
  if (!produto.marca) faltando.push("marca");
  if (!(Number.isFinite(precoNum) && precoNum > 0)) faltando.push("preço");
  if (!produto.estoque_inicial) faltando.push("estoque inicial (quantidade confirmada)");
  if (!produto.pesoBruto_g) faltando.push("peso");
  if (!produto.dimensoes_cm.profundidade) faltando.push("comprimento");
  if (!produto.dimensoes_cm.largura) faltando.push("largura");
  if (!produto.dimensoes_cm.altura) faltando.push("altura");
  if (!(medida && logistica?.confirmado)) faltando.push("peso e medidas confirmados na Conferência");
  return { produto, faltando };
}

/**
 * Releitura IMEDIATAMENTE antes de criar: decide se pode criar.
 *  "criar"     → SKU não existe no Bling (leitura ok);
 *  "ja_existe" → NÃO cria: mostra o produto existente;
 *  "ambiguo"   → NÃO cria: mais de um produto com o SKU;
 *  "erro"      → NÃO cria: leitura falhou (na dúvida, nunca cria).
 *  "produto_registrado" → (14/11) NÃO cria: o SKU sumiu da busca do Bling, mas
 *                outra ficha deste SKU já registrou um produto Bling (ID).
 *                Provável: produto inativo, excluído ou com o código alterado.
 * registrados: produtosBlingRegistradosDoSku(...) das outras fichas do SKU.
 */
export function decidirCriacaoBling(leitura, { registrados = [] } = {}) {
  if (!leitura || leitura.ok === false && !leitura.encontrado) return { acao: "erro", motivo: leitura?.mensagem || leitura?.erro || "Não foi possível consultar o Bling." };
  if (leitura.ambiguo) return { acao: "ambiguo", motivo: "Mais de um produto no Bling com este SKU." };
  if (leitura.encontrado) return { acao: "ja_existe", motivo: "O SKU já existe no Bling: nada é criado.", produto: leitura.produto || null };
  if (leitura.encontrado === false && leitura.ok !== false) {
    const regs = Array.isArray(registrados) ? registrados.filter((r) => r?.produto_id) : [];
    if (regs.length) return { acao: "produto_registrado", motivo: textoProdutoForaDaBusca(regs), produtos: regs };
    return { acao: "criar" };
  }
  return { acao: "erro", motivo: "Resposta do Bling sem confirmação de que o SKU não existe." };
}

/**
 * (14/11) Produtos Bling já REGISTRADOS por outras fichas deste SKU (publicação
 * ou registro da integração). fichas = listarAnunciosDoCodigo(...).anuncios.
 * Devolve [{ produto_id, ficha, mlb, conta }] sem repetir o mesmo produto.
 */
export function produtosBlingRegistradosDoSku(fichas, { excetoFicha = "" } = {}) {
  const out = new Map();
  for (const f of Array.isArray(fichas) ? fichas : []) {
    if (!f || String(f.id || "") === String(excetoFicha || "")) continue;
    const pub = f.publicacao || {};
    const reg = f.integracao_bling || {};
    for (const id of [pub.bling_produto_id, reg.bling_produto_id]) {
      const pid = String(id ?? "").trim();
      if (!pid || out.has(pid)) continue;
      out.set(pid, { produto_id: pid, ficha: String(f.id || ""), mlb: String(pub.mlb_id || reg.mlb || ""), conta: String(pub.ml_user_id || reg.ml_user_id || "") });
    }
  }
  return [...out.values()];
}

/**
 * (14/11) Produto Bling pelo SKU × pelo ID registrado (só leitura).
 *  "ok"            — a busca pelo SKU acha o MESMO ID registrado (ou não há registro);
 *  "outro_id"      — a busca acha OUTRO produto com este SKU (confira duplicidade no Bling);
 *  "fora_da_busca" — a busca não acha, mas há produto registrado (inativo/excluído/código alterado?);
 *  "nao_existe"    — a busca não acha e não há registro;
 *  "erro"          — leitura falhou.
 */
export function situacaoProdutoBling({ leitura, registrados = [] }) {
  const regs = Array.isArray(registrados) ? registrados.filter((r) => r?.produto_id) : [];
  if (!leitura || (leitura.ok === false && !leitura.encontrado)) return { estado: "erro", texto: `Bling não consultado (${leitura?.mensagem || leitura?.erro || "sem resposta"}).` };
  if (leitura.ambiguo) return { estado: "outro_id", texto: "Mais de um produto no Bling com este SKU: resolva no Bling (o PAIIA não escolhe sozinho)." };
  if (leitura.encontrado) {
    const id = String(leitura.produto?.id ?? "");
    const outros = regs.filter((r) => r.produto_id !== id);
    if (regs.length && outros.length === regs.length) {
      return { estado: "outro_id", texto: `A busca pelo SKU acha o produto ${id}, mas este SKU tinha o produto ${regs.map((r) => r.produto_id).join(", ")} registrado (MLB ${regs.map((r) => r.mlb || "—").join(", ")}). Confira no Bling se há dois cadastros do mesmo SKU.` };
    }
    return { estado: "ok", texto: `Produto no Bling: ID ${id} (SKU ${leitura.produto?.codigo || "—"}).` };
  }
  if (regs.length) return { estado: "fora_da_busca", texto: textoProdutoForaDaBusca(regs) };
  return { estado: "nao_existe", texto: "SKU não encontrado no Bling e nenhum produto Bling registrado para ele." };
}

function textoProdutoForaDaBusca(regs) {
  const lista = regs.map((r) => `${r.produto_id}${r.mlb ? ` (MLB ${r.mlb})` : ""}`).join(", ");
  return `O SKU não aparece na busca do Bling, mas o produto Bling ${lista} já foi registrado para ele. Provável: produto inativo, excluído ou com o código alterado no Bling. Confira em Produtos → Situação: Todos/Excluídos. O PAIIA NÃO cria outro produto.`;
}

/**
 * Depois de criar: relê o Bling e confere ID, SKU e estoque.
 * Devolve { ok, problemas[] }.
 */
export function conferirProdutoCriado({ enviado, criado, releitura }) {
  const problemas = [];
  const id = criado?.produto?.id;
  if (!id) problemas.push("O Bling não devolveu o ID do produto.");
  if (!releitura?.encontrado || releitura?.ambiguo) problemas.push("O SKU não foi encontrado (ou está duplicado) na releitura do Bling.");
  if (releitura?.produto?.id && id && String(releitura.produto.id) !== String(id)) problemas.push(`ID relido (${releitura.produto.id}) diferente do criado (${id}).`);
  if (releitura?.produto?.codigo && normalizarSku(releitura.produto.codigo) !== normalizarSku(enviado?.codigo)) problemas.push(`SKU relido (${releitura.produto.codigo}) diferente do enviado (${enviado?.codigo}).`);
  const esperado = normalizarQuantidade(enviado?.estoque_inicial);
  const fisico = releitura?.saldoFisicoTotal;
  if (esperado && fisico != null && Number(fisico) !== esperado) problemas.push(`Estoque relido no Bling (${fisico}) diferente do estoque inicial (${esperado}).`);
  if (esperado && fisico == null) problemas.push("Estoque não pôde ser relido no Bling: confira o saldo no Bling.");
  return { ok: problemas.length === 0, problemas };
}

