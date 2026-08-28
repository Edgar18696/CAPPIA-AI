export function simularImportacao(
  registros = []
) {
  const resumo = {
    total: registros.length,

    fabricantes: {},

    montadoras: {},

    modelos: {},

    motores: {},

    codigosDuplicados: [],

    codigosUnicos: 0,
  };

  const codigos = new Set();

  for (const registro of registros) {
    const codigo =
      String(
        registro.codigo_oem || ""
      ).trim();

    if (codigo) {
      if (codigos.has(codigo)) {
        resumo.codigosDuplicados.push(
          codigo
        );
      }

      codigos.add(codigo);
    }

    const fabricante =
      registro.fabricante || "Não informado";

    resumo.fabricantes[
      fabricante
    ] =
      (resumo.fabricantes[
        fabricante
      ] || 0) + 1;

    const montadora =
      registro.montadora || "-";

    resumo.montadoras[
      montadora
    ] =
      (resumo.montadoras[
        montadora
      ] || 0) + 1;

    const modelo =
      registro.modelo || "-";

    resumo.modelos[
      modelo
    ] =
      (resumo.modelos[
        modelo
      ] || 0) + 1;

    const motor =
      registro.motor || "-";

    resumo.motores[
      motor
    ] =
      (resumo.motores[
        motor
      ] || 0) + 1;
  }

  resumo.codigosUnicos =
    codigos.size;

  return resumo;
}