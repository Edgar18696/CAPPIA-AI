import { quebrarModelos } from "./util";

export function montarAplicacoesAgrupadas(registros) {
  const grupos = {};

  registros.forEach((item) => {
    const montadora = item.montadora || "OUTRAS APLICAÇÕES";

    if (!grupos[montadora]) {
      grupos[montadora] = new Set();
    }

    const modelos = quebrarModelos(item.modelo);
    const motor = item.motor || "";
    const ano =
      item.ano_inicio || item.ano_fim
        ? `${item.ano_inicio || "-"} até ${item.ano_fim || "-"}`
        : "";

    modelos.forEach((modelo) => {
      grupos[montadora].add([modelo, motor, ano].filter(Boolean).join(" "));
    });
  });

  return Object.entries(grupos)
    .map(([montadora, linhas]) => {
      const itens = [...linhas]
        .filter(Boolean)
        .map((linha) => `• ${linha}`)
        .join("\n");

      return `${montadora.toUpperCase()}\n${itens}`;
    })
    .join("\n\n");
}