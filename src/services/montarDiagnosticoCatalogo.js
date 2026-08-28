function unico(lista) {
  return [...new Set(lista.filter(Boolean))].sort();
}

export function montarDiagnosticoCatalogo(
  registros = []
) {
  if (!registros.length) {
    return null;
  }

  const primeiro = registros[0];

  return {
    codigo:
      primeiro.codigo_oem,

    peca:
      primeiro.peca,

    fabricante:
      primeiro.fabricante,

    origem:
      primeiro.origem_catalogo,

    equivalencias: unico(
      registros.flatMap((r) =>
        String(
          r.codigo_equivalente || ""
        )
          .split(",")
          .map((c) => c.trim())
      )
    ),

    montadoras: unico(
      registros.map(
        (r) => r.montadora
      )
    ),

    modelos: unico(
      registros.map(
        (r) => r.modelo
      )
    ),

    motores: unico(
      registros.map(
        (r) => r.motor
      )
    ),

    aplicacoes: registros.map(
      (r) => ({
        montadora: r.montadora,
        modelo: r.modelo,
        motor: r.motor,
        anoInicio:
          r.ano_inicio,
        anoFim:
          r.ano_fim,
      })
    ),

    totalAplicacoes:
      registros.length,
  };
}