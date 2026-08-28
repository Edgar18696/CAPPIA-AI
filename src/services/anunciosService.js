export function criarAnuncioVazio() {
  return {
    codigo: "",
    oem: "",
    titulo: "",
    descricao: "",
    preco: "",
    tipoAnuncio: "classico",
    pecaEncontrada: null,
    diagnostico: null,
    auditoria: null,
    fotos: [],
  };
}

export function normalizarCodigo(valor) {
  return String(valor ?? "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
}

export function montarTituloCatalogo(resultado) {
  const codigo = normalizarCodigo(resultado?.termo);
  const trecho = String(resultado?.trecho || "");

  const nomePeca =
    trecho.match(
      /(sensor|sonda|bomba|bico|válvula|vela|bobina|filtro|alternador|motor de partida|palheta)[^,.:\n]*/i
    )?.[0] || "Peça Automotiva";

  return `${nomePeca} Bosch ${codigo}`
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

export function montarDescricaoCatalogo(resultado) {
  const codigo = normalizarCodigo(resultado?.termo);

  return `
${montarTituloCatalogo(resultado).toUpperCase()}

FABRICANTE:
Bosch

CÓDIGO CONSULTADO:
${codigo}

CATÁLOGO CONSULTADO:
${resultado?.arquivo || "Catálogo oficial Bosch"}

PÁGINA:
${resultado?.pagina || "-"}

INFORMAÇÕES ENCONTRADAS:
${resultado?.trecho || "Nenhuma informação complementar encontrada."}

IMPORTANTE:
Compare sempre o código gravado na peça original antes da compra.

Para confirmação da aplicação, verifique também:
• Modelo do veículo
• Ano
• Motorização
• Conector da peça
• Código da peça original

CONTEÚDO DA EMBALAGEM:
• 01 peça
`.trim();
}

export function montarAnuncioDoCatalogo(resultado) {
  const codigo = normalizarCodigo(resultado?.termo);

  return {
    codigo,
    oem: "",
    titulo: montarTituloCatalogo(resultado),
    descricao: montarDescricaoCatalogo(resultado),
    preco: "",
    tipoAnuncio: "classico",
    pecaEncontrada: {
      peca: montarTituloCatalogo(resultado),
      fabricante: "Bosch",
      codigo_oem: codigo,
      observacao: resultado?.trecho || "",
      arquivo_catalogo: resultado?.arquivo || "",
      pagina_catalogo: resultado?.pagina || null,
    },
    diagnostico: null,
    auditoria: null,
    fotos: [],
  };
}

export function salvarAnuncioTemporario(anuncio) {
  localStorage.setItem(
    "rascunhoNovoAnuncioTemp",
    JSON.stringify(anuncio)
  );

  localStorage.setItem(
    "usarDadosCatalogoNoAnuncio",
    "true"
  );
}

export function carregarAnuncioTemporario() {
  const salvo = localStorage.getItem(
    "rascunhoNovoAnuncioTemp"
  );

  if (!salvo) return criarAnuncioVazio();

  try {
    return {
      ...criarAnuncioVazio(),
      ...JSON.parse(salvo),
    };
  } catch {
    return criarAnuncioVazio();
  }
}

export function limparAnuncioTemporario() {
  localStorage.removeItem("rascunhoNovoAnuncioTemp");
  localStorage.removeItem("usarDadosCatalogoNoAnuncio");
  localStorage.removeItem("fotosSelecionadasAnuncio");
}