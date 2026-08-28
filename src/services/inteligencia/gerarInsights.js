function listaUnica(lista = []) {
  return [
    ...new Set(
      lista
        .map((item) =>
          String(item || "").trim()
        )
        .filter(Boolean)
    ),
  ];
}

export function gerarInsights(base = {}) {
  const insights = [];

  const fabricantes =
    listaUnica(base.fabricantes);

  const fontes =
    listaUnica(base.fontes);

  const montadoras =
    listaUnica(base.montadoras);

  const modelos =
    listaUnica(base.modelos);

  const motores =
    listaUnica(base.motores);

  if (fabricantes.length >= 2) {
    insights.push(
      `Código confirmado por ${fabricantes.length} fabricantes.`
    );
  }

  if (fontes.length >= 2) {
    insights.push(
      `Informações provenientes de ${fontes.length} catálogos oficiais.`
    );
  }

  if (montadoras.length >= 5) {
    insights.push(
      "Peça com ampla aplicação entre montadoras."
    );
  }

  if (modelos.length >= 10) {
    insights.push(
      "Grande cobertura de modelos."
    );
  }

  if (motores.length >= 10) {
    insights.push(
      "Compatível com diversos motores."
    );
  }

  return insights;
}