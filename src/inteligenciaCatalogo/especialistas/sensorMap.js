export function especialistaSensorMAP() {
  return {
    obrigatorios: ["fabricante", "codigo_oem", "motor", "modelo", "montadora"],
    recomendados: ["pressao", "tensao", "pinos", "combustivel"],
  };
}