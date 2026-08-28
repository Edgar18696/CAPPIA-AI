function tamanho(lista) {
  return Array.isArray(lista)
    ? lista.length
    : 0;
}

export function calcularQualidadeBase(
  base = {}
) {
  let nota = 0;

  if (base.codigoPrincipal) nota += 10;

  if (base.peca) nota += 10;

  if (base.fabricante) nota += 10;

  nota += Math.min(
    tamanho(base.equivalentes),
    10
  );

  nota += Math.min(
    tamanho(base.aplicacoes),
    20
  );

  nota += Math.min(
    tamanho(base.fontes) * 5,
    20
  );

  nota += Math.min(
    tamanho(base.montadoras),
    10
  );

  nota += Math.min(
    tamanho(base.modelos),
    10
  );

  if (base.insights?.length) {
    nota += 10;
  }

  nota = Math.min(nota, 100);

  return {
    nota,

    nivel:
      nota >= 95
        ? "Excelente"
        : nota >= 80
        ? "Muito Boa"
        : nota >= 60
        ? "Boa"
        : nota >= 40
        ? "Regular"
        : "Baixa",
  };
}
