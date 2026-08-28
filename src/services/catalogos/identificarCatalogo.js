function normalizarCodigo(valor = "") {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .trim();
}

export default function identificarCatalogo(
  codigoDigitado = ""
) {
  const codigo = normalizarCodigo(
    codigoDigitado
  );

  if (!codigo) {
    return {
      encontrado: false,
      fabricante: "",
      tipo: "",
      codigo: "",
    };
  }

  if (
    codigo.startsWith("0") ||
    codigo.startsWith("F000") ||
    codigo.startsWith("F00")
  ) {
    return {
      encontrado: true,
      fabricante: "bosch",
      tipo: identificarTipoBosch(codigo),
      codigo,
    };
  }

  if (
    codigo.startsWith("IWP") ||
    codigo.startsWith("BIP") ||
    codigo.startsWith("MAM")
  ) {
    return {
      encontrado: true,
      fabricante: "magneti_marelli",
      tipo: "bicos_injetores",
      codigo,
    };
  }

  if (
    codigo.startsWith("OZA") ||
    codigo.startsWith("LZA")
  ) {
    return {
      encontrado: true,
      fabricante: "ngk",
      tipo: "sondas",
      codigo,
    };
  }

  if (
    codigo.startsWith("DCP") ||
    codigo.startsWith("DCRI") ||
    codigo.startsWith("DENSO")
  ) {
    return {
      encontrado: true,
      fabricante: "denso",
      tipo: "injecao",
      codigo,
    };
  }

  if (
    codigo.startsWith("930") ||
    codigo.startsWith("253") ||
    codigo.startsWith("255") ||
    codigo.startsWith("820")
  ) {
    return {
      encontrado: true,
      fabricante: "renault",
      tipo: "pecas_originais",
      codigo,
    };
  }

  if (
    codigo.startsWith("518") ||
    codigo.startsWith("519") ||
    codigo.startsWith("520")
  ) {
    return {
      encontrado: true,
      fabricante: "fiat",
      tipo: "pecas_originais",
      codigo,
    };
  }

  return {
    encontrado: true,
    fabricante: "catalogo_universal",
    tipo: "pesquisa_geral",
    codigo,
  };
}

function identificarTipoBosch(codigo) {
  if (
    codigo.startsWith("0258") ||
    codigo.startsWith("LS")
  ) {
    return "sondas";
  }

  if (
    codigo.startsWith("F000TE") ||
    codigo.startsWith("0580")
  ) {
    return "bombas";
  }

  if (
    codigo.startsWith("0221") ||
    codigo.startsWith("F000ZS")
  ) {
    return "bobinas";
  }

  if (
    codigo.startsWith("028015") ||
    codigo.startsWith("0280")
  ) {
    return "injecao";
  }

  return "geral";
}