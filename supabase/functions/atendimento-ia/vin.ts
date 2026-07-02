export type VinInfo = {
  chassi?: string;
  montadora?: string;
  modelo?: string;
  ano?: string;
  motor?: string;
};

export function extrairChassi(texto: string) {
  const encontrado = texto
    .toUpperCase()
    .match(/\b[A-HJ-NPR-Z0-9]{17}\b/);

  return encontrado ? encontrado[0] : "";
}

export function decodificarVinBasico(chassi: string): VinInfo {
  if (!chassi) return {};

  const vin = chassi.toUpperCase();

  const anoCodigo = vin[9];

  const anos: Record<string, string> = {
    A: "2010",
    B: "2011",
    C: "2012",
    D: "2013",
    E: "2014",
    F: "2015",
    G: "2016",
    H: "2017",
    J: "2018",
    K: "2019",
    L: "2020",
    M: "2021",
    N: "2022",
    P: "2023",
    R: "2024",
    S: "2025",
    T: "2026",
  };

  let montadora = "";

  if (vin.startsWith("93Y")) montadora = "Renault";
  if (vin.startsWith("9BW")) montadora = "Volkswagen";
  if (vin.startsWith("9BD")) montadora = "Fiat";
  if (vin.startsWith("9BG")) montadora = "Chevrolet";
  if (vin.startsWith("93H")) montadora = "Honda";
  if (vin.startsWith("9BR")) montadora = "Toyota";
  if (vin.startsWith("93X")) montadora = "Mitsubishi";

  return {
    chassi: vin,
    montadora,
    ano: anos[anoCodigo] || "",
  };
}