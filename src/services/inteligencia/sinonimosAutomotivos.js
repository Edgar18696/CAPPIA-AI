const SINONIMOS_AUTOMOTIVOS = {
  map: [
    "sensor map",
    "sensor de pressão",
    "sensor de pressão do coletor",
    "pressão do coletor",
  ],

  maf: [
    "sensor maf",
    "medidor de massa de ar",
    "sensor de fluxo de ar",
    "fluxo de ar",
  ],

  lambda: [
    "sonda lambda",
    "sensor de oxigênio",
    "sonda de oxigênio",
  ],

  bico: [
    "bico injetor",
    "injetor",
    "injetor de combustível",
    "eletroinjetor",
  ],

  bomba: [
    "bomba de combustível",
    "bomba combustível",
    "módulo de combustível",
  ],

  bobina: [
    "bobina de ignição",
    "bobina ignição",
  ],

  tbi: [
    "corpo de borboleta",
    "corpo borboleta",
    "válvula borboleta",
  ],

  vela: [
    "vela de ignição",
    "vela ignição",
  ],

  cabo: [
    "cabo de vela",
    "cabo ignição",
  ],

  sensor: [
    "sensor automotivo",
  ],

  pedal: [
    "pedal acelerador",
    "sensor pedal",
  ],

  acelerador: [
    "pedal acelerador",
    "corpo de borboleta",
  ],

  ventoinha: [
    "eletroventilador",
    "motor ventoinha",
  ],

  fechadura: [
    "trava elétrica",
    "fecho porta",
  ],

  interruptor: [
    "chave",
    "switch",
  ],

  rele: [
    "relé",
    "relay",
  ],

  modulo: [
    "módulo",
    "central",
    "ecu",
  ],
};

function normalizarTexto(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function expandirSinonimosAutomotivos(
  termo
) {
  const termoNormalizado =
    normalizarTexto(termo);

  if (!termoNormalizado) {
    return [];
  }

  const palavras =
    termoNormalizado
      .split(/\s+/)
      .filter(Boolean);

  const termosExpandidos =
    new Set([
      termoNormalizado,
      ...palavras,
    ]);

  for (const palavra of palavras) {
    const sinonimos =
      SINONIMOS_AUTOMOTIVOS[
        palavra
      ];

    if (!sinonimos) {
      continue;
    }

    for (const sinonimo of sinonimos) {
      termosExpandidos.add(
        sinonimo
      );
    }
  }

  return Array.from(
    termosExpandidos
  );
}

export default SINONIMOS_AUTOMOTIVOS;