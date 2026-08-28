export function buscarEquivalencias(registros) {
  const lista = [];

  registros.forEach((item) => {
    String(item.codigo_oem || "")
      .split(/[,;/\n]/)
      .forEach((c) => lista.push(c.trim()));

    String(item.codigo_equivalente || "")
      .split(/[,;/\n]/)
      .forEach((c) => lista.push(c.trim()));
  });

  return [...new Set(lista.filter(Boolean))].sort();
}