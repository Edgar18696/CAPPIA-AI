function texto(valor) {
  return String(valor || "").trim();
}

function listaUnica(lista = []) {
  return [
    ...new Set(
      lista
        .flat()
        .map(texto)
        .filter(Boolean)
    ),
  ];
}

export function consolidarBaseMestre({
  registros = [],
} = {}) {
  if (registros.length === 0) {
    return null;
  }

  const principal = registros[0];

  const fabricantes = listaUnica(
    registros.map(
      (r) => r.fabricante
    )
  );

  const montadoras = listaUnica(
    registros.map(
      (r) => r.montadoras || []
    )
  );

  const modelos = listaUnica(
    registros.map(
      (r) => r.modelos || []
    )
  );

  const motores = listaUnica(
    registros.map(
      (r) => r.motores || []
    )
  );

  const equivalentes = listaUnica(
    registros.map(
      (r) => r.equivalentes || []
    )
  );

  const fontes = listaUnica(
    registros.map(
      (r) => r.fontes || []
    )
  );

  let confianca = 60;

  confianca +=
    Math.min(
      fabricantes.length * 5,
      20
    );

  confianca +=
    Math.min(
      fontes.length * 3,
      20
    );

  confianca = Math.min(
    confianca,
    100
  );

  return {
    ...principal,

    fabricantes,

    montadoras,

    modelos,

    motores,

    equivalentes,

    fontes,

    confianca: {
      percentual: confianca,

      nivel:
        confianca >= 95
          ? "Muito alta"
          : confianca >= 80
          ? "Alta"
          : confianca >= 60
          ? "Média"
          : "Baixa",

      fontesConfirmadas:
        fabricantes.length,
    },
  };
}