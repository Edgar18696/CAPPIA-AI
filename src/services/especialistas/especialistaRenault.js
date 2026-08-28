function texto(valor) {
  return String(valor || "").trim();
}

function normalizar(valor) {
  return texto(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function listaUnica(valores = []) {
  return [
    ...new Set(
      valores
        .map((valor) => texto(valor))
        .filter(Boolean)
    ),
  ];
}

function separarCodigos(valor) {
  return texto(valor)
    .split(/[,;|/\n]+/)
    .map((codigo) => codigo.trim())
    .filter(Boolean);
}

function registroRenault(registro = {}) {
  const conteudo = normalizar(
    [
      registro.fabricante,
      registro.montadora,
      registro.origem_catalogo,
      registro.marca,
      registro.observacao,
    ]
      .filter(Boolean)
      .join(" ")
  );

  return conteudo.includes("renault");
}

function montarFaixaAnos(registros = []) {
  const anosInicio = registros
    .map((item) => Number(item.ano_inicio))
    .filter(Number.isFinite);

  const anosFim = registros
    .map((item) => Number(item.ano_fim))
    .filter(Number.isFinite);

  const inicio =
    anosInicio.length > 0
      ? Math.min(...anosInicio)
      : null;

  const fim =
    anosFim.length > 0
      ? Math.max(...anosFim)
      : null;

  if (inicio && fim) {
    return `${inicio} a ${fim}`;
  }

  if (inicio) {
    return `A partir de ${inicio}`;
  }

  if (fim) {
    return `Até ${fim}`;
  }

  return "";
}

function extrairCodigosSubstituidos(
  registros = []
) {
  return listaUnica(
    registros.flatMap((item) => [
      ...separarCodigos(
        item.codigo_substituido
      ),
      ...separarCodigos(
        item.codigo_anterior
      ),
      ...separarCodigos(
        item.substituido_por
      ),
    ])
  );
}

function gerarObservacoes({
  encontrado,
  modelos,
  motores,
  faixaAnos,
  catalogos,
  codigosSubstituidos,
}) {
  const observacoes = [];

  if (!encontrado) {
    return observacoes;
  }

  if (modelos.length > 0) {
    observacoes.push(
      `${modelos.length} modelo(s) Renault identificado(s).`
    );
  }

  if (motores.length > 1) {
    observacoes.push(
      "Existem aplicações para motorizações diferentes; confirme o motor do veículo."
    );
  }

  if (faixaAnos) {
    observacoes.push(
      `Faixa de aplicação localizada: ${faixaAnos}.`
    );
  }

  if (codigosSubstituidos.length > 0) {
    observacoes.push(
      "O cadastro possui informação de substituição de código Renault."
    );
  }

  if (catalogos.length > 1) {
    observacoes.push(
      "A aplicação Renault aparece em mais de uma fonte técnica."
    );
  }

  observacoes.push(
    "Antes da aplicação, confirme o código da peça instalada, modelo, ano e motorização."
  );

  return observacoes;
}

function calcularIndiceRenault({
  encontrado,
  codigoRenault,
  modelos,
  motores,
  catalogos,
  totalRegistros,
}) {
  if (!encontrado) {
    return 0;
  }

  let indice = 55;

  if (codigoRenault) {
    indice += 15;
  }

  if (modelos.length > 0) {
    indice += 10;
  }

  if (motores.length > 0) {
    indice += 5;
  }

  if (catalogos.length > 0) {
    indice += 5;
  }

  if (totalRegistros >= 2) {
    indice += 5;
  }

  if (totalRegistros >= 5) {
    indice += 4;
  }

  return Math.min(99, indice);
}

export function analisarRenault(
  analise = {}
) {
  const resultados = Array.isArray(
    analise.resultadosOrdenados
  )
    ? analise.resultadosOrdenados
    : [];

  const registrosRenault =
    resultados.filter(registroRenault);

  const principalFabricante =
    normalizar(
      analise.principal?.fabricante
    );

  const principalMontadora =
    normalizar(
      analise.principal?.montadora
    );

  const principalCatalogo =
    normalizar(
      analise.principal?.origem_catalogo
    );

  const encontrado =
    registrosRenault.length > 0 ||
    principalFabricante.includes("renault") ||
    principalMontadora.includes("renault") ||
    principalCatalogo.includes("renault");

  if (!encontrado) {
    return {
      ativo: true,
      fabricante: "Renault",
      encontrado: false,
      indiceRenault: 0,
      observacoes: [],
    };
  }

  const registrosAnalise =
    registrosRenault.length > 0
      ? registrosRenault
      : [analise.principal].filter(Boolean);

  const principalRenault =
    registrosAnalise[0] ||
    analise.principal ||
    {};

  const codigoRenault = texto(
    principalRenault.codigo_oem ||
      principalRenault.codigo_equivalente ||
      analise.principal?.codigo_oem ||
      analise.principal
        ?.codigo_equivalente
  );

  const modelos = listaUnica(
    registrosAnalise.map(
      (item) => item.modelo
    )
  );

  const motores = listaUnica(
    registrosAnalise.map(
      (item) => item.motor
    )
  );

  const montadoras = listaUnica(
    registrosAnalise.map(
      (item) => item.montadora
    )
  );

  const catalogos = listaUnica(
    registrosAnalise.map(
      (item) => item.origem_catalogo
    )
  );

  const equivalentes = listaUnica(
    registrosAnalise.flatMap((item) =>
      separarCodigos(
        item.codigo_equivalente
      )
    )
  ).filter(
    (codigo) =>
      normalizar(codigo) !==
      normalizar(codigoRenault)
  );

  const codigosSubstituidos =
    extrairCodigosSubstituidos(
      registrosAnalise
    );

  const faixaAnos =
    montarFaixaAnos(
      registrosAnalise
    );

  const indiceRenault =
    calcularIndiceRenault({
      encontrado,
      codigoRenault,
      modelos,
      motores,
      catalogos,
      totalRegistros:
        registrosAnalise.length,
    });

  const observacoes =
    gerarObservacoes({
      encontrado,
      modelos,
      motores,
      faixaAnos,
      catalogos,
      codigosSubstituidos,
    });

  return {
    ativo: true,

    fabricante: "Renault",

    encontrado: true,

    aplicacaoOficial:
      catalogos.some((item) =>
        normalizar(item).includes(
          "renault"
        )
      ),

    registroPrincipal:
      principalRenault,

    codigoRenault,

    peca:
      texto(principalRenault.peca),

    montadoras,

    modelos,

    motores,

    faixaAnos,

    catalogos,

    equivalentes,

    codigosSubstituidos,

    totalRegistros:
      registrosAnalise.length,

    indiceRenault,

    confianca: indiceRenault,

    observacoes,
  };
}

export default analisarRenault;