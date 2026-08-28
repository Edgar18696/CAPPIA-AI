import motorInteligenciaPeca from "../../inteligencia/motorInteligenciaPeca";

function extrairCodigo(linha = "") {
  const encontrado = String(linha).match(
    /\b(?:F\s*\d{3}[A-Z0-9\s]*|\d{10}|0\s*\d{3}\s*\d{3}\s*\d{3})\b/i
  );

  if (!encontrado) {
    return null;
  }

  return encontrado[0]
    .replace(/\s+/g, "")
    .toUpperCase();
}

export async function parserBoschSensores({
  textoAplicacoes = "",
  nomeArquivo = "Catálogo Bosch Sensores",
}) {
  return textoAplicacoes
    .split(/\r?\n/)
    .map((linha) => linha.trim())
    .filter(Boolean)
    .map((linha) => {
      const codigo =
        extrairCodigo(linha);

      const inteligencia =
        motorInteligenciaPeca({
          codigo,
          descricao: linha,
          texto: linha,
        });

      return {
        peca: inteligencia.familia,

        descricao: linha,

        codigo_oem: codigo,

        codigo_equivalente: null,

        fabricante: "Bosch",

        origem_catalogo:
          nomeArquivo,

        montadora: null,

        modelo: null,

        motor: null,

        ano_inicio: null,

        ano_fim: null,

        familia: inteligencia.familia,

        categoria: inteligencia.categoria,

        sistema: inteligencia.sistema,

        tipo: inteligencia.tipo,

        palavrasChave:
          inteligencia.palavrasChave,

        confianca:
          inteligencia.confianca,
      };
    });
}

export default parserBoschSensores;