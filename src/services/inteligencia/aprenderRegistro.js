function listaUnica(lista = []) {
  return [
    ...new Set(
      lista
        .flat()
        .map((item) =>
          String(item || "").trim()
        )
        .filter(Boolean)
    ),
  ];
}

export function aprenderRegistro({
  baseAtual = {},
  novoRegistro = {},
}) {
  return {
    ...baseAtual,

    equivalentes: listaUnica([
      ...(baseAtual.equivalentes || []),
      ...(novoRegistro.equivalentes || []),
    ]),

    montadoras: listaUnica([
      ...(baseAtual.montadoras || []),
      ...(novoRegistro.montadoras || []),
    ]),

    modelos: listaUnica([
      ...(baseAtual.modelos || []),
      ...(novoRegistro.modelos || []),
    ]),

    motores: listaUnica([
      ...(baseAtual.motores || []),
      ...(novoRegistro.motores || []),
    ]),

    fontes: listaUnica([
      ...(baseAtual.fontes || []),
      ...(novoRegistro.fontes || []),
    ]),

    fabricantes: listaUnica([
      ...(baseAtual.fabricantes || []),
      ...(novoRegistro.fabricantes || []),
    ]),

    totalRegistros:
      Math.max(
        Number(baseAtual.totalRegistros) || 0,
        Number(novoRegistro.totalRegistros) || 0
      ),

    atualizadoEm:
      new Date().toISOString(),
  };
}