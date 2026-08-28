function codigoTexto(valor) {
  return String(valor || "").trim();
}

export function montarBaseMestre(registros) {
  const base = {
    codigo: "",
    fabricante: "",
    montadoras: new Set(),
    modelos: new Set(),
    motores: new Set(),
    anos: [],
    equivalentes: new Set(),
    observacoes: new Set(),
    combustiveis: new Set(),
  };

  registros.forEach((item) => {
    const codigoOem = codigoTexto(item.codigo_oem);
    const codigoEq = codigoTexto(item.codigo_equivalente);

    if (!base.codigo) {
      base.codigo = codigoOem || codigoEq || "";
    }

    if (!base.fabricante && item.fabricante)
      base.fabricante = item.fabricante;

    if (item.montadora) base.montadoras.add(item.montadora);
    if (item.modelo) base.modelos.add(item.modelo);
    if (item.motor) base.motores.add(item.motor);

    if (codigoEq) base.equivalentes.add(codigoEq);

    if (item.observacao) base.observacoes.add(item.observacao);
    if (item.combustivel) base.combustiveis.add(item.combustivel);

    if (item.ano_inicio || item.ano_fim) {
      base.anos.push({
        inicio: item.ano_inicio,
        fim: item.ano_fim,
      });
    }
  });

  return {
    ...base,
    montadoras: [...base.montadoras],
    modelos: [...base.modelos],
    motores: [...base.motores],
    equivalentes: [...base.equivalentes],
    observacoes: [...base.observacoes],
    combustiveis: [...base.combustiveis],
  };
}