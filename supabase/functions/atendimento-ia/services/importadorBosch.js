import { parserBosch } from "./parserBosch";
import { parserBoschEquivalencias } from "./parserBoschEquivalencias";

export function importarBosch(texto) {
  const aplicacoes = parserBosch(texto);

  const equivalencias =
    parserBoschEquivalencias(texto);

  const mapa = new Map();

  for (const item of aplicacoes) {
    mapa.set(item.codigo_bosch, {
      ...item,
      equivalentes: [],
    });
  }

  for (const eq of equivalencias) {
    if (!mapa.has(eq.codigo_bosch)) {
      mapa.set(eq.codigo_bosch, {
        fabricante: "Bosch",
        codigo_bosch: eq.codigo_bosch,
        montadora: null,
        modelo: null,
        motor: null,
        combustivel: null,
        equivalentes: [],
      });
    }

    mapa
      .get(eq.codigo_bosch)
      .equivalentes.push({
        fabricante:
          eq.fabricante,
        codigo:
          eq.codigo_equivalente,
      });
  }

  const resultado = [];

  for (const registro of mapa.values()) {
    resultado.push({
      fabricante: "Bosch",

      codigo_oem:
        registro.codigo_bosch,

      codigo_equivalente:
        registro.equivalentes
          .map((e) => e.codigo)
          .join(", "),

      peca:
        "Sonda Lambda",

      montadora:
        registro.montadora,

      modelo:
        registro.modelo,

      motor:
        registro.motor,

      combustivel:
        registro.combustivel,

      origem_catalogo:
        "Bosch",

      ativo: true,

      prioridade: 1,

      confiabilidade: 100,

      equivalentes:
        registro.equivalentes,
    });
  }

  return resultado;
}