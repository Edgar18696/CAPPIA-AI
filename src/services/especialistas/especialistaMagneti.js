export function analisarMagneti(
  analise = {}
) {
  const resultados = Array.isArray(
    analise.resultadosOrdenados
  )
    ? analise.resultadosOrdenados
    : [];

  const registrosMagneti =
    resultados.filter((item) => {
      const texto = [
        item?.fabricante,
        item?.origem_catalogo,
        item?.marca,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        texto.includes("magneti") ||
        texto.includes("marelli")
      );
    });

  const encontrado =
    registrosMagneti.length > 0;

  return {
    ativo: true,
    fabricante: "Magneti Marelli",
    encontrado,
    totalRegistros:
      registrosMagneti.length,
    registros: registrosMagneti,
    observacoes: encontrado
      ? [
          "Registro Magneti Marelli localizado na base técnica.",
        ]
      : [],
  };
}

export default analisarMagneti;