import executarEspecialistas from "./especialistas/executarEspecialistas";
function texto(valor) {
  return String(valor || "").trim();
}

function normalizar(valor) {
  return texto(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function listaUnica(resultados, campo) {
  return [
    ...new Set(
      resultados
        .map((item) => texto(item?.[campo]))
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

function listarEquivalentes(resultados) {
  return [
    ...new Set(
      resultados.flatMap((item) =>
        separarCodigos(item.codigo_equivalente)
      )
    ),
  ];
}

function calcularPontuacaoRegistro(
  item,
  termoNormalizado
) {
  let pontos = 0;

  const codigoOem = normalizar(
    item.codigo_oem
  );

  const codigoEquivalente = normalizar(
    item.codigo_equivalente
  );

  const peca = normalizar(item.peca);
  const fabricante = normalizar(
    item.fabricante
  );
  const montadora = normalizar(
    item.montadora
  );
  const modelo = normalizar(item.modelo);
  const motor = normalizar(item.motor);

  if (
    termoNormalizado &&
    codigoOem === termoNormalizado
  ) {
    pontos += 100;
  }

  if (
    termoNormalizado &&
    codigoEquivalente === termoNormalizado
  ) {
    pontos += 95;
  }

  if (
    termoNormalizado &&
    codigoOem.includes(termoNormalizado)
  ) {
    pontos += 50;
  }

  if (
    termoNormalizado &&
    codigoEquivalente.includes(
      termoNormalizado
    )
  ) {
    pontos += 45;
  }

  if (
    termoNormalizado &&
    peca.includes(termoNormalizado)
  ) {
    pontos += 35;
  }

  if (
    termoNormalizado &&
    fabricante.includes(termoNormalizado)
  ) {
    pontos += 25;
  }

  if (
    termoNormalizado &&
    montadora.includes(termoNormalizado)
  ) {
    pontos += 20;
  }

  if (
    termoNormalizado &&
    modelo.includes(termoNormalizado)
  ) {
    pontos += 20;
  }

  if (
    termoNormalizado &&
    motor.includes(termoNormalizado)
  ) {
    pontos += 15;
  }

  if (item.codigo_oem) pontos += 12;
  if (item.peca) pontos += 10;
  if (item.fabricante) pontos += 8;
  if (item.origem_catalogo) pontos += 8;
  if (item.montadora) pontos += 6;
  if (item.modelo) pontos += 6;
  if (item.motor) pontos += 5;

  pontos += Number(
    item.confiabilidade || 0
  ) / 10;

  pontos -= Number(
    item.prioridade || 0
  );

  return pontos;
}

function ordenarResultados(
  resultados,
  termoNormalizado
) {
  return [...resultados].sort(
    (a, b) =>
      calcularPontuacaoRegistro(
        b,
        termoNormalizado
      ) -
      calcularPontuacaoRegistro(
        a,
        termoNormalizado
      )
  );
}

function escolherMaisFrequente(
  resultados,
  campo
) {
  const contagem = new Map();

  resultados.forEach((item) => {
    const valor = texto(item?.[campo]);

    if (!valor) return;

    contagem.set(
      valor,
      (contagem.get(valor) || 0) + 1
    );
  });

  return (
    [...contagem.entries()].sort(
      (a, b) => b[1] - a[1]
    )[0]?.[0] || ""
  );
}

function gerarDivergencias({
  pecas,
  fabricantes,
  motores,
  modelos,
  codigosOem,
}) {
  const divergencias = [];

  if (pecas.length > 1) {
    divergencias.push(
      "A pesquisa retornou descrições de peças diferentes."
    );
  }

  if (codigosOem.length > 1) {
    divergencias.push(
      "Foram encontrados vários códigos OEM relacionados."
    );
  }

  if (fabricantes.length > 1) {
    divergencias.push(
      "Existem registros de fabricantes diferentes."
    );
  }

  if (motores.length > 1) {
    divergencias.push(
      "Existem aplicações para motorizações diferentes."
    );
  }

  if (modelos.length > 15) {
    divergencias.push(
      "A peça possui ampla aplicação; confirme veículo, ano e motor."
    );
  }

  return divergencias;
}

function gerarAlertas({
  totalResultados,
  fabricantes,
  catalogos,
  motores,
  divergencias,
  confianca,
}) {
  const alertas = [];

  if (totalResultados === 1) {
    alertas.push({
      tipo: "info",
      texto:
        "Somente um registro foi encontrado para esta pesquisa.",
    });
  }

  if (fabricantes.length > 1) {
    alertas.push({
      tipo: "info",
      texto: `Foram encontrados ${fabricantes.length} fabricantes.`,
    });
  }

  if (catalogos.length > 1) {
    alertas.push({
      tipo: "sucesso",
      texto: `A informação aparece em ${catalogos.length} catálogos.`,
    });
  }

  if (motores.length > 1) {
    alertas.push({
      tipo: "alerta",
      texto:
        "Confira a motorização antes de concluir a venda.",
    });
  }

  divergencias.forEach((textoAlerta) => {
    alertas.push({
      tipo: "alerta",
      texto: textoAlerta,
    });
  });

  if (
    confianca >= 90 &&
    divergencias.length === 0
  ) {
    alertas.push({
      tipo: "ok",
      texto:
        "Cadastro com alto índice de consistência.",
    });
  }

  if (!alertas.length) {
    alertas.push({
      tipo: "ok",
      texto:
        "Nenhuma divergência técnica relevante encontrada.",
    });
  }

  return alertas;
}

function gerarRecomendacoes({
  principal,
  totalResultados,
  divergencias,
  modelos,
  motores,
}) {
  const recomendacoes = [];

  if (principal?.codigo_oem) {
    recomendacoes.push(
      `Utilize o código ${principal.codigo_oem} como referência principal.`
    );
  }

  if (totalResultados > 20) {
    recomendacoes.push(
      "Refine a pesquisa por fabricante, veículo ou motor."
    );
  }

  if (motores.length > 1) {
    recomendacoes.push(
      "Confirme a motorização instalada no veículo."
    );
  }

  if (modelos.length > 10) {
    recomendacoes.push(
      "Inclua as aplicações completas na descrição do anúncio."
    );
  }

  if (divergencias.length > 0) {
    recomendacoes.push(
      "Revise as divergências antes de publicar ou vender."
    );
  }

  if (!recomendacoes.length) {
    recomendacoes.push(
      "O registro principal pode ser utilizado como base técnica."
    );
  }

  return recomendacoes;
}

function gerarParecer({
  confianca,
  divergencias,
  catalogos,
}) {
  if (confianca >= 90) {
    return catalogos.length > 1
      ? "Os dados apresentam alta consistência e estão apoiados por múltiplas fontes técnicas."
      : "Os dados apresentam alta consistência dentro da fonte técnica disponível.";
  }

  if (confianca >= 75) {
    return divergencias.length > 0
      ? "Os dados são utilizáveis, porém existem pontos que devem ser conferidos antes da aplicação."
      : "Os dados apresentam consistência adequada para consulta técnica e criação de anúncio.";
  }

  return "A pesquisa possui baixa confirmação técnica. Recomenda-se validar o código diretamente na peça ou em documentação oficial.";
}

function montarTituloAnuncio({
  principal,
  melhorFabricante,
}) {
  const partes = [
    principal.peca,
    melhorFabricante,
    principal.codigo_oem ||
      principal.codigo_equivalente,
    principal.montadora,
    principal.modelo,
    principal.motor,
  ].filter(Boolean);

  return partes
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

function montarDescricaoAnuncio({
  principal,
  equivalentes,
  montadoras,
  modelos,
  motores,
  catalogos,
}) {
  const linhas = [
    principal.peca &&
      `Produto: ${principal.peca}`,
    principal.codigo_oem &&
      `Código OEM: ${principal.codigo_oem}`,
    equivalentes.length > 0 &&
      `Códigos equivalentes: ${equivalentes.join(
        ", "
      )}`,
    principal.fabricante &&
      `Fabricante: ${principal.fabricante}`,
    montadoras.length > 0 &&
      `Montadoras: ${montadoras.join(", ")}`,
    modelos.length > 0 &&
      `Modelos: ${modelos.join(", ")}`,
    motores.length > 0 &&
      `Motores: ${motores.join(", ")}`,
    catalogos.length > 0 &&
      `Fontes técnicas: ${catalogos.join(
        ", "
      )}`,
    "",
    "Antes da compra, compare o código da peça instalada no veículo.",
  ].filter(
    (linha) =>
      linha !== false &&
      linha !== undefined &&
      linha !== null
  );

  return linhas.join("\n");
}

function gerarSeo({
  principal,
  fabricantes,
  montadoras,
  modelos,
  motores,
  equivalentes,
}) {
  const palavrasChave = [
    principal.peca,
    principal.codigo_oem,
    ...equivalentes,
    ...fabricantes,
    ...montadoras,
    ...modelos,
    ...motores,
  ]
    .map((item) => texto(item))
    .filter(Boolean);

  return {
    palavrasChave: [
      ...new Set(palavrasChave),
    ],
    tituloSeo: [
      principal.peca,
      principal.codigo_oem,
      principal.fabricante,
    ]
      .filter(Boolean)
      .join(" "),
  };
}

export function motorAnaliseTecnica(
  resultados = [],
  termo = ""
) {
  if (!Array.isArray(resultados)) {
    return null;
  }

  const registrosValidos =
    resultados.filter(Boolean);

  if (!registrosValidos.length) {
    return null;
  }

  const termoNormalizado =
    normalizar(termo);

    const resultadosOrdenados =
    ordenarResultados(
      registrosValidos,
      termoNormalizado
    );

  const totalResultados =
    resultadosOrdenados.length;

  const principal =
    resultadosOrdenados[0];

  const fabricantes = listaUnica(
    resultadosOrdenados,
    "fabricante"
  );

  const montadoras = listaUnica(
    resultadosOrdenados,
    "montadora"
  );

  const modelos = listaUnica(
    resultadosOrdenados,
    "modelo"
  );

  const motores = listaUnica(
    resultadosOrdenados,
    "motor"
  );

  const catalogos = listaUnica(
    resultadosOrdenados,
    "origem_catalogo"
  );

  const pecas = listaUnica(
    resultadosOrdenados,
    "peca"
  );

  const codigosOem = listaUnica(
    resultadosOrdenados,
    "codigo_oem"
  );

  const equivalentes =
    listarEquivalentes(
      resultadosOrdenados
    );

  const melhorFabricante =
    escolherMaisFrequente(
      resultadosOrdenados,
      "fabricante"
    ) ||
    principal.fabricante ||
    "";

  const melhorCatalogo =
    escolherMaisFrequente(
      resultadosOrdenados,
      "origem_catalogo"
    ) ||
    principal.origem_catalogo ||
    "";

  const melhorAplicacao = {
    montadora:
      principal.montadora ||
      montadoras[0] ||
      "",
    modelo:
      principal.modelo ||
      modelos[0] ||
      "",
    motor:
      principal.motor ||
      motores[0] ||
      "",
    anoInicio:
      principal.ano_inicio || "",
    anoFim:
      principal.ano_fim || "",
  };

  const codigosSubstituidos = [
    ...new Set(
      resultadosOrdenados.flatMap(
        (item) =>
          separarCodigos(
            item.codigo_substituido ||
              item.codigo_anterior ||
              item.substituido_por
          )
      )
    ),
  ];

  const equivalentesConfirmados =
    equivalentes.filter(
      (codigo) =>
        resultadosOrdenados.some(
          (item) =>
            normalizar(
              item.codigo_oem
            ) === normalizar(codigo)
        )
    );

  const divergencias =
    gerarDivergencias({
      pecas,
      fabricantes,
      motores,
      modelos,
      codigosOem,
    });

  let confianca = 55;

  const codigoPrincipal =
    normalizar(
      principal.codigo_oem ||
        principal.codigo_equivalente
    );

  if (
    termoNormalizado &&
    codigoPrincipal ===
      termoNormalizado
  ) {
    confianca += 20;
  }

  if (catalogos.length >= 2) {
    confianca += 10;
  }

  if (catalogos.length >= 3) {
    confianca += 5;
  }

  if (resultadosOrdenados.length >= 3) {
    confianca += 5;
  }

  if (principal.peca) {
    confianca += 5;
  }

  if (
    principal.montadora &&
    principal.modelo
  ) {
    confianca += 5;
  }

  confianca -=
    divergencias.length * 5;

  confianca = Math.max(
    40,
    Math.min(99, confianca)
  );

  const alertas = gerarAlertas({
    totalResultados:
      resultadosOrdenados.length,
    fabricantes,
    catalogos,
    motores,
    divergencias,
    confianca,
  });

  const recomendacoes =
    gerarRecomendacoes({
      principal,
      totalResultados:
        resultadosOrdenados.length,
      divergencias,
      modelos,
      motores,
    });

  const parecerTecnico =
    gerarParecer({
      confianca,
      divergencias,
      catalogos,
    });

  const anuncioAutomatico = {
    titulo: montarTituloAnuncio({
      principal,
      melhorFabricante,
    }),

    descricao:
      montarDescricaoAnuncio({
        principal,
        equivalentes,
        montadoras,
        modelos,
        motores,
        catalogos,
      }),
  };

  const seo = gerarSeo({
    principal,
    fabricantes,
    montadoras,
    modelos,
    motores,
    equivalentes,
  });

  const resumoExecutivo = [
    `${resultadosOrdenados.length} registro(s) encontrado(s).`,
    `${fabricantes.length} fabricante(s).`,
    `${catalogos.length} catálogo(s) consultado(s).`,
    `${modelos.length} modelo(s) identificado(s).`,
    `Confiança técnica de ${confianca}%.`,
  ].join(" ");
const especialistas =
  executarEspecialistas({
    principal,
    resultadosOrdenados,
    totalResultados:
      resultadosOrdenados.length,
    fabricantes,
    montadoras,
    modelos,
    motores,
    catalogos,
    pecas,
    codigosOem,
    equivalentes,
    confianca,
    melhorCatalogo,
    melhorFabricante,
    melhorAplicacao,
    codigosSubstituidos,
    equivalentesConfirmados,
    divergencias,
    alertas,
    recomendacoes,
    parecerTecnico,
    anuncioAutomatico,
    seo,
    resumoExecutivo,
  });
 return {
  principal,

  resultadosOrdenados,

  totalResultados,

  fabricantes,

  montadoras,

  modelos,

  motores,

  catalogos,

  pecas,

  codigosOem,

  equivalentes,

  confianca,

  melhorCatalogo,

  melhorFabricante,

  melhorAplicacao,

  codigosSubstituidos,

  equivalentesConfirmados,

  divergencias,

  alertas,

  recomendacoes,

  parecerTecnico,

  anuncioAutomatico,

  seo,

  resumoExecutivo,

  especialistas,
};
}