function limpar(texto = "") {
  return String(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ABREVIACOES = {
  vw: "volkswagen",
  gm: "chevrolet",
  chev: "chevrolet",
  mb: "mercedes",
  mercedesbenz: "mercedes",
};

export function normalizarPesquisa(
  termo
) {
  const texto = limpar(termo);

  return texto
    .split(" ")
    .map(
      (palavra) =>
        ABREVIACOES[
          palavra
        ] || palavra
    )
    .join(" ");
}