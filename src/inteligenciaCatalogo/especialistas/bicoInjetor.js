export function especialistaBicoInjetor() {
  return {
    obrigatorios: [
      "fabricante",
      "codigo_oem",
      "codigo_equivalente",
      "motor",
      "modelo",
      "montadora",
      "ano_inicio",
      "ano_fim",
    ],
    recomendados: [
      "combustivel",
      "quantidade_furos",
      "impedancia",
      "vazao",
      "pressao",
      "tipo_conector",
    ],
  };
}