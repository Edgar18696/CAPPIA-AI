/**
 * Referência técnica sem aplicação de veículo confirmada.
 * Contrato genérico para qualquer catálogo (Bosch, Marelli, futuros).
 */

export const TIPO_REFERENCIA_APLICACAO = "aplicacao_veiculo";
export const TIPO_REFERENCIA_NOTA = "nota_tecnica";

export const AVISO_CODIGO_SEM_APLICACAO =
  "Código encontrado no catálogo — aplicação de veículo não informada nesta referência.";

function texto(valor) {
  return String(valor ?? "").replace(/\s+/g, " ").trim();
}

export function temAplicacaoVeiculoConfirmada(registro = {}) {
  if (texto(registro.tipo_referencia).toLowerCase() === TIPO_REFERENCIA_NOTA) {
    return false;
  }

  return Boolean(
    texto(registro.montadora) ||
      texto(registro.modelo) ||
      texto(registro.motor) ||
      registro.ano_inicio != null ||
      registro.ano_fim != null
  );
}

export function tipoReferenciaDe(registro = {}) {
  const declarado = texto(registro.tipo_referencia).toLowerCase();
  if (declarado === TIPO_REFERENCIA_NOTA) {
    return TIPO_REFERENCIA_NOTA;
  }
  if (declarado === TIPO_REFERENCIA_APLICACAO) {
    return TIPO_REFERENCIA_APLICACAO;
  }
  if (
    texto(registro.montadora) ||
    texto(registro.modelo) ||
    texto(registro.motor) ||
    registro.ano_inicio != null ||
    registro.ano_fim != null
  ) {
    return TIPO_REFERENCIA_APLICACAO;
  }
  if (texto(registro.observacao)) {
    return TIPO_REFERENCIA_NOTA;
  }
  return TIPO_REFERENCIA_APLICACAO;
}

export function ehReferenciaTecnicaSemAplicacao(registro = {}) {
  return tipoReferenciaDe(registro) === TIPO_REFERENCIA_NOTA;
}

export function pareceLinhaNotaTecnica(linha = "") {
  const valor = texto(linha)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

  if (!valor) {
    return false;
  }

  return (
    valor.includes("UTILIZAR O P/N") ||
    valor.includes("UTILIZAR O PN") ||
    valor.includes("PART NUMBER") ||
    valor.includes("MALHA DE CARACTERISTICAS") ||
    valor.includes("CARACTERISTICAS SIMILARES") ||
    valor.includes("VER NOTA") ||
    valor.includes("NOTA TECNICA") ||
    valor.includes("REFERENCIA TECNICA") ||
    (valor.includes("SUBSTITUI") && valor.includes("P/N")) ||
    (valor.startsWith("(") && valor.includes("UTILIZAR"))
  );
}

export function montarRegistroNotaTecnica({
  codigo_oem,
  peca,
  fabricante,
  origem_catalogo,
  pagina_catalogo,
  observacao,
  codigo_equivalente = "",
  prioridade = 1,
  confiabilidade = 90,
}) {
  return {
    peca: texto(peca) || "Peça Automotiva",
    codigo_oem: texto(codigo_oem),
    codigo_equivalente: texto(codigo_equivalente) || null,
    fabricante: texto(fabricante),
    origem_catalogo: texto(origem_catalogo),
    montadora: null,
    modelo: null,
    motor: null,
    ano_inicio: null,
    ano_fim: null,
    observacao: texto(observacao),
    pagina_catalogo: pagina_catalogo ?? null,
    tipo_referencia: TIPO_REFERENCIA_NOTA,
    ativo: true,
    prioridade,
    confiabilidade,
  };
}

export function chaveInsertNotaTecnica(registro = {}) {
  return [
    texto(registro.origem_catalogo).toUpperCase(),
    texto(registro.codigo_oem).toUpperCase().replace(/[^A-Z0-9]/g, ""),
    TIPO_REFERENCIA_NOTA,
    registro.pagina_catalogo ?? "",
    texto(registro.observacao).toUpperCase(),
  ].join("|");
}

export function classificarRegistrosCatalogo(registros = []) {
  const lista = Array.isArray(registros) ? registros : [];
  const aplicacoes = [];
  const notas = [];

  for (const registro of lista) {
    if (ehReferenciaTecnicaSemAplicacao(registro)) {
      notas.push(registro);
    } else if (temAplicacaoVeiculoConfirmada(registro)) {
      aplicacoes.push(registro);
    } else if (texto(registro.observacao)) {
      notas.push({
        ...registro,
        tipo_referencia: TIPO_REFERENCIA_NOTA,
        montadora: null,
        modelo: null,
        motor: null,
        ano_inicio: null,
        ano_fim: null,
      });
    }
  }

  return {
    aplicacoes,
    notas,
    aplicacaoConfirmada: aplicacoes.length > 0,
    somenteNotaTecnica: aplicacoes.length === 0 && notas.length > 0,
  };
}

export function resumirApresentacaoCriarAnuncio({ registros = [], termo = "" }) {
  const classificado = classificarRegistrosCatalogo(registros);
  const base =
    classificado.aplicacoes[0] ||
    classificado.notas[0] ||
    registros[0] ||
    {};

  const peca = texto(base.peca) || "Peça Automotiva";
  const fabricante = texto(base.fabricante);
  const codigo = texto(base.codigo_oem) || texto(termo);

  if (classificado.somenteNotaTecnica) {
    const nota = classificado.notas[0] || {};
    const partesTitulo = [peca];
    if (
      fabricante &&
      !peca.toLowerCase().includes(fabricante.toLowerCase())
    ) {
      partesTitulo.push(fabricante);
    }
    partesTitulo.push(codigo);
    const titulo = partesTitulo.filter(Boolean).join(" ").slice(0, 60);
    const descricao = [
      AVISO_CODIGO_SEM_APLICACAO,
      "",
      `Código: ${codigo}`,
      fabricante ? `Fabricante: ${fabricante}` : "",
      peca ? `Peça: ${peca}` : "",
      nota.origem_catalogo ? `Fonte: ${nota.origem_catalogo}` : "",
      nota.pagina_catalogo != null ? `Página: ${nota.pagina_catalogo}` : "",
      nota.observacao ? `Referência técnica: ${nota.observacao}` : "",
    ]
      .filter((linha) => linha !== "")
      .join("\n");

    return {
      encontrado: true,
      aplicacaoConfirmada: false,
      avisoAplicacao: AVISO_CODIGO_SEM_APLICACAO,
      titulo,
      descricao,
      montadora: null,
      modelo: null,
      motor: null,
      ano_inicio: null,
      ano_fim: null,
      aplicacoes: [],
      referenciasTecnicas: classificado.notas.map((item) => ({
        codigo_oem: item.codigo_oem,
        origem_catalogo: item.origem_catalogo || null,
        pagina_catalogo: item.pagina_catalogo ?? null,
        observacao: item.observacao || null,
        fabricante: item.fabricante || null,
        peca: item.peca || null,
        tipo_referencia: TIPO_REFERENCIA_NOTA,
      })),
      somenteNotaTecnica: classificado.somenteNotaTecnica,
    };
  }

  return {
    encontrado: registros.length > 0,
    aplicacaoConfirmada: classificado.aplicacaoConfirmada,
    somenteNotaTecnica: classificado.somenteNotaTecnica,
    avisoAplicacao: null,
    titulo: null,
    descricao: null,
    montadora: texto(base.montadora) || null,
    modelo: texto(base.modelo) || null,
    motor: texto(base.motor) || null,
    ano_inicio: base.ano_inicio ?? null,
    ano_fim: base.ano_fim ?? null,
    aplicacoes: classificado.aplicacoes,
    referenciasTecnicas: classificado.notas.map((item) => ({
      codigo_oem: item.codigo_oem,
      origem_catalogo: item.origem_catalogo || null,
      pagina_catalogo: item.pagina_catalogo ?? null,
      observacao: item.observacao || null,
      tipo_referencia: TIPO_REFERENCIA_NOTA,
    })),
  };
}
