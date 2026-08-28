import { supabase } from "../supabase";

function limparCodigo(valor) {
  return String(valor ?? "")
    .replace(/\s+/g, "")
    .trim()
    .toUpperCase();
}

function limparTexto(valor) {
  return String(valor ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function adicionarSemRepetir(lista, valor) {
  const texto = limparTexto(valor);

  if (!texto) return;

  const jaExiste = lista.some(
    (item) =>
      item.toLowerCase() ===
      texto.toLowerCase()
  );

  if (!jaExiste) {
    lista.push(texto);
  }
}

function valoresUnicos(
  registros,
  campo
) {
  const valores = [];

  for (const registro of registros) {
    adicionarSemRepetir(
      valores,
      registro?.[campo]
    );
  }

  return valores;
}

function separarEquivalentes(valor) {
  return String(valor || "")
    .split(/[,;|/]+/)
    .map(limparCodigo)
    .filter(Boolean);
}

function coletarEquivalentes(
  registros,
  codigoPrincipal
) {
  const equivalentes = [];

  for (const registro of registros) {
    const valores =
      separarEquivalentes(
        registro.codigo_equivalente
      );

    for (const valor of valores) {
      if (
        valor !==
        limparCodigo(codigoPrincipal)
      ) {
        adicionarSemRepetir(
          equivalentes,
          valor
        );
      }
    }
  }

  return equivalentes;
}

function coletarAnos(registros) {
  const anosInicio = registros
    .map((item) =>
      Number(item.ano_inicio)
    )
    .filter(
      (ano) =>
        Number.isInteger(ano) &&
        ano > 1900
    );

  const anosFim = registros
    .map((item) =>
      Number(item.ano_fim)
    )
    .filter(
      (ano) =>
        Number.isInteger(ano) &&
        ano > 1900
    );

  return {
    ano_inicio: anosInicio.length
      ? Math.min(...anosInicio)
      : null,

    ano_fim: anosFim.length
      ? Math.max(...anosFim)
      : null,
  };
}

function montarTitulo(
  item,
  codigo
) {
  const codigoFinal =
    limparCodigo(codigo);

  const partes = [];

  adicionarSemRepetir(
    partes,
    item.peca || "Peça Automotiva"
  );

  adicionarSemRepetir(
    partes,
    item.fabricante
  );

  adicionarSemRepetir(
    partes,
    item.modelo
  );

  adicionarSemRepetir(
    partes,
    item.motor
  );

  const textoBase = partes
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  const espacoCodigo =
    codigoFinal.length + 1;

  const limiteBase =
    Math.max(0, 60 - espacoCodigo);

  const baseCortada =
    textoBase
      .slice(0, limiteBase)
      .trim();

  return `${baseCortada} ${codigoFinal}`
    .trim()
    .slice(0, 60);
}

function montarAplicacoes(
  registros
) {
  const aplicacoes = [];

  for (const item of registros) {
    const partes = [];

    adicionarSemRepetir(
      partes,
      item.montadora
    );

    adicionarSemRepetir(
      partes,
      item.modelo
    );

    adicionarSemRepetir(
      partes,
      item.motor
    );

    const anos = [];

    if (item.ano_inicio) {
      anos.push(item.ano_inicio);
    }

    if (
      item.ano_fim &&
      item.ano_fim !==
        item.ano_inicio
    ) {
      anos.push(item.ano_fim);
    }

    const aplicacao = [
      partes.join(" "),
      anos.length
        ? `(${anos.join(" até ")})`
        : "",
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

    adicionarSemRepetir(
      aplicacoes,
      aplicacao
    );
  }

  return aplicacoes;
}

function montarPeriodo(item) {
  if (
    !item.ano_inicio &&
    !item.ano_fim
  ) {
    return "Não informado";
  }

  if (
    item.ano_inicio &&
    item.ano_fim
  ) {
    return `${item.ano_inicio} até ${item.ano_fim}`;
  }

  return String(
    item.ano_inicio ||
      item.ano_fim
  );
}

function montarDescricao(
  item,
  registros
) {
  const nomePeca = String(
    item.peca || "Peça Automotiva"
  ).toUpperCase();

  const fabricante =
    item.fabricante ||
    "Não informado";

  const aplicacoes =
    montarAplicacoes(registros);

  const motores =
    valoresUnicos(
      registros,
      "motor"
    );

  const equivalentes =
    coletarEquivalentes(
      registros,
      item.codigo_oem
    );

  const periodo =
    montarPeriodo(item);

  const observacoes =
    valoresUnicos(
      registros,
      "observacao"
    )
      .slice(0, 10)
      .join("\n");

  return `
${nomePeca}

FABRICANTE:
${fabricante}

CÓDIGO:
${item.codigo_oem || "Não informado"}

APLICAÇÕES:
${
  aplicacoes.length
    ? aplicacoes
        .slice(0, 100)
        .map(
          (aplicacao) =>
            `• ${aplicacao}`
        )
        .join("\n")
    : "Não informadas"
}

MOTORES:
${
  motores.length
    ? motores.join(", ")
    : "Não informados"
}

ANO:
${periodo}

CÓDIGOS EQUIVALENTES:
${
  equivalentes.length
    ? equivalentes.join(", ")
    : "Não informados"
}

OBSERVAÇÕES:
${
  observacoes ||
  "Compare o código gravado na peça original antes da compra."
}

IMPORTANTE:
• Confirme a aplicação pelo código da peça original.
• Verifique o modelo, ano e motorização do veículo.
• Compare o conector e o formato da peça antes da compra.

CONTEÚDO DA EMBALAGEM:
• 01 peça
`.trim();
}

function consolidarRegistros(
  registros,
  codigoFinal
) {
  const principal =
    registros[0];

  const anos =
    coletarAnos(registros);

  const motores =
    valoresUnicos(
      registros,
      "motor"
    );

  const equivalentes =
    coletarEquivalentes(
      registros,
      codigoFinal
    );

  const modelos =
    valoresUnicos(
      registros,
      "modelo"
    );

  const montadoras =
    valoresUnicos(
      registros,
      "montadora"
    );

  return {
    ...principal,

    codigo_oem:
      principal.codigo_oem ||
      codigoFinal,

    codigo_equivalente:
      equivalentes.join(", "),

    motor:
      motores.join(", "),

    modelo:
      modelos[0] || "",

    montadora:
      montadoras[0] || "",

    ano_inicio:
      anos.ano_inicio,

    ano_fim:
      anos.ano_fim,
  };
}

export async function preencherAnuncioAutomaticamente({
  codigo,
  oem,
  onProgresso,
}) {
  const codigoFinal =
    limparCodigo(codigo || oem);

  if (!codigoFinal) {
    throw new Error(
      "Digite o código da peça ou OEM."
    );
  }

  onProgresso?.(
    15,
    "🔎 Pesquisando o código na base APPIA..."
  );

  let data = [];
  let error = null;

  const {
    data: dadosExatos,
    error: erroExato,
  } = await supabase
    .from("catalogo_mestre")
    .select("*")
    .or(
      `codigo_oem.eq.${codigoFinal},codigo_equivalente.eq.${codigoFinal}`
    )
    .eq("ativo", true)
    .order("prioridade", {
      ascending: true,
    })
    .limit(300);

  if (erroExato) {
    error = erroExato;
  } else if (
    Array.isArray(dadosExatos) &&
    dadosExatos.length > 0
  ) {
    data = dadosExatos;
  } else {
    const {
      data: dadosParciais,
      error: erroParcial,
    } = await supabase
      .from("catalogo_mestre")
      .select("*")
      .or(
        `codigo_oem.ilike.%${codigoFinal}%,codigo_equivalente.ilike.%${codigoFinal}%,peca.ilike.%${codigoFinal}%`
      )
      .eq("ativo", true)
      .order("prioridade", {
        ascending: true,
      })
      .limit(300);

    data =
      dadosParciais || [];

    error =
      erroParcial;
  }

  if (error) {
    console.error(
      "ERRO NA PESQUISA:",
      error
    );

    throw new Error(
      "Erro ao consultar a base técnica do APPIA."
    );
  }

  if (!data.length) {
    throw new Error(
      `O código ${codigoFinal} ainda não está cadastrado na base APPIA.`
    );
  }

  onProgresso?.(
    65,
    "📝 Consolidando aplicações e informações técnicas..."
  );

  const item =
    consolidarRegistros(
      data,
      codigoFinal
    );

  const titulo =
    montarTitulo(
      item,
      codigoFinal
    );

  const descricao =
    montarDescricao(
      item,
      data
    );

  onProgresso?.(
    95,
    "✅ Organizando as informações técnicas..."
  );

  return {
    codigo:
      item.codigo_oem ||
      codigoFinal,

    oem:
      item.codigo_equivalente ||
      "",

    titulo,

    descricao,

    preco: "",

    tipoAnuncio:
      "classico",

    pecaEncontrada: {
      ...item,

      peca:
        item.peca ||
        "Peça Automotiva",

      fabricante:
        item.fabricante ||
        "Não informado",
    },

    resultadosCatalogo:
      data,

    resultadoPrincipal: {
      arquivo:
        item.origem_catalogo ||
        "Base APPIA",

      pagina:
        item.pagina_catalogo ||
        null,
    },
  };
}