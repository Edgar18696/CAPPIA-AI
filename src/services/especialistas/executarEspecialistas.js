import { analisarBosch } from "./especialistaBosch";
import { analisarMagneti } from "./especialistaMagneti";
import { analisarRenault } from "./especialistaRenault";

function executarSeguro(
  nome,
  especialista,
  analise
) {
  try {
    const resultado =
      especialista(analise);

    return {
      ativo: true,
      fabricante: nome,
      encontrado:
        Boolean(resultado?.encontrado),
      ...(resultado || {}),
    };
  } catch (error) {
    console.error(
      `Erro no especialista ${nome}:`,
      error
    );

    return {
      ativo: false,
      fabricante: nome,
      encontrado: false,
      erro:
        error?.message ||
        "Erro ao executar especialista.",
      observacoes: [],
    };
  }
}

export function executarEspecialistas(
  analise
) {
  if (!analise?.principal) {
    return {};
  }

  return {
    bosch: executarSeguro(
      "Bosch",
      analisarBosch,
      analise
    ),

    magneti: executarSeguro(
      "Magneti Marelli",
      analisarMagneti,
      analise
    ),

    renault: executarSeguro(
      "Renault",
      analisarRenault,
      analise
    ),
  };
}

export default executarEspecialistas;