// src/motorCatalogo/resolverConflitos.js

export function resolverConflitos(resultados = []) {
  const auditoria = [];

  const dadosConsolidados = {
    codigoPrincipal: "",
    descricao: "",
    fabricante: "",
    categoria: "",
    codigos: [],
    equivalencias: [],
    aplicacoes: [],
    observacoes: [],
    alertas: [],
    confiabilidade: 0,
  };

  for (const resultado of resultados) {
    if (!resultado) continue;

    const fonte = normalizarTexto(resultado.fonte || "importado");
    const pesoFonte = calcularPesoFonte(fonte);

    analisarCampoTexto({
      campo: "descricao",
      valor: resultado.descricao,
      fonte,
      pesoFonte,
      dadosConsolidados,
      auditoria,
    });

    analisarCampoTexto({
      campo: "fabricante",
      valor: resultado.fabricante,
      fonte,
      pesoFonte,
      dadosConsolidados,
      auditoria,
    });

    analisarCampoTexto({
      campo: "categoria",
      valor: resultado.categoria,
      fonte,
      pesoFonte,
      dadosConsolidados,
      auditoria,
    });

    analisarLista({
      campo: "codigos",
      valores: [
        resultado.codigo,
        resultado.codigoPrincipal,
        resultado.oem,
        ...(resultado.codigos || []),
      ],
      fonte,
      pesoFonte,
      dadosConsolidados,
      auditoria,
    });

    analisarLista({
      campo: "equivalencias",
      valores: resultado.equivalencias || [],
      fonte,
      pesoFonte,
      dadosConsolidados,
      auditoria,
    });

    analisarAplicacoes({
      valores: resultado.aplicacoes || [],
      fonte,
      pesoFonte,
      dadosConsolidados,
      auditoria,
    });

    analisarLista({
      campo: "observacoes",
      valores: resultado.observacoes || [],
      fonte,
      pesoFonte,
      dadosConsolidados,
      auditoria,
    });
  }

  dadosConsolidados.codigoPrincipal =
    escolherCodigoPrincipal(dadosConsolidados.codigos) || "";

  dadosConsolidados.confiabilidade = calcularConfiabilidadeFinal(auditoria);

  return {
    dadosConsolidados,
    auditoria,
  };
}

function calcularPesoFonte(fonte) {
  const pesos = {
    fiat: 50,
    renault: 50,
    vw: 50,
    volkswagen: 50,
    gm: 50,
    chevrolet: 50,
    ford: 50,
    nissan: 50,
    peugeot: 50,
    citroen: 50,
    citroën: 50,

    bosch: 40,

    magneti: 30,
    "magneti marelli": 30,
    marelli: 30,
    delphi: 30,
    denso: 30,
    ngk: 30,
    vdo: 30,
    continental: 30,
    valeo: 30,
    mopar: 30,

    appia_validada: 25,
    appia: 20,
    distribuidor: 15,
    importado: 5,
  };

  return pesos[fonte] || 5;
}

function analisarCampoTexto({
  campo,
  valor,
  fonte,
  pesoFonte,
  dadosConsolidados,
  auditoria,
}) {
  if (!valor || typeof valor !== "string") return;

  const texto = limparTexto(valor);

  if (!texto) return;

  if (!dadosConsolidados[campo]) {
    dadosConsolidados[campo] = texto;

    auditoria.push({
      tipo: `${campo}_aceito`,
      campo,
      valor: texto,
      fonte,
      pesoFonte,
      motivo: "Primeira informação válida encontrada.",
      confianca: classificarConfianca(pesoFonte),
    });

    return;
  }

  const atual = dadosConsolidados[campo];

  if (normalizarTexto(atual) === normalizarTexto(texto)) {
    auditoria.push({
      tipo: `${campo}_confirmado`,
      campo,
      valor: texto,
      fonte,
      pesoFonte,
      motivo: "Informação confirmada por outra fonte.",
      confianca: classificarConfianca(pesoFonte),
    });

    return;
  }

  const pesoAtual = buscarPesoValor(auditoria, campo, atual);

  if (pesoFonte > pesoAtual) {
    dadosConsolidados.alertas.push(
      `Campo ${campo} alterado de "${atual}" para "${texto}" por fonte mais confiável.`
    );

    dadosConsolidados[campo] = texto;

    auditoria.push({
      tipo: `${campo}_substituido`,
      campo,
      valor: texto,
      valorAnterior: atual,
      fonte,
      pesoFonte,
      motivo: "Fonte atual possui maior peso técnico.",
      confianca: classificarConfianca(pesoFonte),
    });
  } else {
    auditoria.push({
      tipo: `${campo}_rejeitado`,
      campo,
      valor: texto,
      fonte,
      pesoFonte,
      motivo: "Informação diferente, mas fonte possui menor peso técnico.",
      confianca: "baixa",
    });
  }
}

function analisarLista({
  campo,
  valores,
  fonte,
  pesoFonte,
  dadosConsolidados,
  auditoria,
}) {
  if (!Array.isArray(valores)) return;

  for (const valor of valores) {
    if (!valor) continue;

    const texto = limparTexto(String(valor));
    if (!texto) continue;

    const jaExiste = dadosConsolidados[campo].some(
      (item) => normalizarTexto(item) === normalizarTexto(texto)
    );

    if (jaExiste) {
      auditoria.push({
        tipo: `${campo}_confirmado`,
        campo,
        valor: texto,
        fonte,
        pesoFonte,
        motivo: "Valor confirmado por outra fonte.",
        confianca: classificarConfianca(pesoFonte),
      });

      continue;
    }

    dadosConsolidados[campo].push(texto);

    auditoria.push({
      tipo: `${campo}_aceito`,
      campo,
      valor: texto,
      fonte,
      pesoFonte,
      motivo: "Valor novo aceito na Base Mestre.",
      confianca: classificarConfianca(pesoFonte),
    });
  }
}

function analisarAplicacoes({
  valores,
  fonte,
  pesoFonte,
  dadosConsolidados,
  auditoria,
}) {
  if (!Array.isArray(valores)) return;

  for (const valor of valores) {
    if (!valor) continue;

    const texto = limparTexto(String(valor));
    if (!texto) continue;

    if (aplicacaoGenerica(texto)) {
      dadosConsolidados.alertas.push(
        `Aplicação suspeita rejeitada: ${texto}`
      );

      auditoria.push({
        tipo: "aplicacao_rejeitada",
        campo: "aplicacoes",
        valor: texto,
        fonte,
        pesoFonte,
        motivo: "Aplicação genérica demais para anúncio técnico seguro.",
        confianca: "baixa",
      });

      continue;
    }

    const jaExiste = dadosConsolidados.aplicacoes.some(
      (item) => normalizarTexto(item) === normalizarTexto(texto)
    );

    if (jaExiste) {
      auditoria.push({
        tipo: "aplicacao_confirmada",
        campo: "aplicacoes",
        valor: texto,
        fonte,
        pesoFonte,
        motivo: "Aplicação confirmada por outra fonte.",
        confianca: classificarConfianca(pesoFonte),
      });

      continue;
    }

    dadosConsolidados.aplicacoes.push(texto);

    auditoria.push({
      tipo: "aplicacao_aceita",
      campo: "aplicacoes",
      valor: texto,
      fonte,
      pesoFonte,
      motivo: "Aplicação específica aceita.",
      confianca: classificarConfianca(pesoFonte),
    });
  }
}

function aplicacaoGenerica(texto) {
  const t = normalizarTexto(texto);

  const termosGenericos = [
    "todos",
    "todas",
    "diversos",
    "varios",
    "vários",
    "universal",
    "linha completa",
    "varias aplicacoes",
    "várias aplicações",
    "consulte",
  ];

  return termosGenericos.some((termo) => t.includes(normalizarTexto(termo)));
}

function escolherCodigoPrincipal(codigos = []) {
  if (!codigos.length) return "";

  const bosch = codigos.find((codigo) => /^0\d{9}$/.test(codigo));
  if (bosch) return bosch;

  return codigos[0];
}

function calcularConfiabilidadeFinal(auditoria = []) {
  if (!auditoria.length) return 0;

  let pontos = 0;

  for (const item of auditoria) {
    if (item.tipo?.includes("aceito")) pontos += item.pesoFonte || 5;
    if (item.tipo?.includes("confirmado")) pontos += 10;
    if (item.tipo?.includes("substituido")) pontos += 8;
    if (item.tipo?.includes("rejeitado")) pontos -= 5;
  }

  return Math.max(0, Math.min(100, pontos));
}

function classificarConfianca(peso) {
  if (peso >= 40) return "alta";
  if (peso >= 25) return "media";
  return "baixa";
}

function buscarPesoValor(auditoria, campo, valor) {
  const registro = auditoria
    .filter((item) => item.campo === campo)
    .reverse()
    .find((item) => normalizarTexto(item.valor) === normalizarTexto(valor));

  return registro?.pesoFonte || 0;
}

function limparTexto(texto) {
  return String(texto)
    .replace(/\s+/g, " ")
    .trim();
}

function normalizarTexto(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}