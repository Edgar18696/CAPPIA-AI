// (26/11/2026) Modelos de veículos por montadora — usado pela pesquisa alternativa
// (Google) para reconhecer APLICAÇÃO só quando a palavra é um modelo conhecido.
// Antes, qualquer palavra com inicial maiúscula do título virava modelo e era
// colada à montadora mais citada ("Toyota Pré", "Toyota Dark", "Toyota Fiesta").
// Palavras de 1–2 letras e modelos só com números ficam de fora (ambíguos).

export const FAMILIAS_MONTADORA = {
  VW: "vw", Volkswagen: "vw", Audi: "vw-audi", Seat: "vw-seat", Skoda: "vw-skoda",
  GM: "gm", Chevrolet: "gm", Opel: "gm", Vauxhall: "gm",
  Fiat: "fiat", Jeep: "jeep", Dodge: "dodge", Ram: "ram",
  Peugeot: "psa", "Citroën": "psa",
  Renault: "renault", Dacia: "renault",
};

export const familiaDaMontadora = (m) => FAMILIAS_MONTADORA[m] || String(m || "").toLowerCase();

const LISTA = {
  VW: ["Gol", "Voyage", "Parati", "Saveiro", "Fox", "Spacefox", "Crossfox", "Polo", "Golf", "Jetta", "Passat", "Virtus",
    "Nivus", "Kombi", "Santana", "Quantum", "Logus", "Pointer", "Apollo", "Fusca", "Brasilia", "Variant", "Amarok", "Tiguan",
    "Touareg", "Taos", "Tcross", "T-Cross", "Bora", "Beetle", "Sharan", "Touran", "Caddy", "Transporter", "Scirocco", "Corrado", "Vento"],
  GM: ["Celta", "Corsa", "Prisma", "Onix", "Agile", "Montana", "Spin", "Cobalt", "Cruze", "Astra", "Vectra", "Meriva", "Zafira",
    "Omega", "Kadett", "Ipanema", "Monza", "Opala", "Caravan", "Chevette", "Blazer", "Silverado", "Tracker", "Captiva", "Equinox",
    "Trailblazer", "Sonic", "Malibu", "Camaro", "Calibra", "Tigra", "Insignia", "Mokka", "Signum", "Tornado"],
  Fiat: ["Uno", "Palio", "Siena", "Strada", "Fiorino", "Doblo", "Idea", "Punto", "Linea", "Toro", "Argo", "Cronos", "Mobi",
    "Weekend", "Tempra", "Marea", "Brava", "Bravo", "Stilo", "Elba", "Ducato", "Freemont", "Pulse", "Fastback", "Panda", "Croma"],
  Ford: ["Fiesta", "Focus", "EcoSport", "Ecosport", "Ranger", "Courier", "Escort", "Verona", "Versailles", "Royale", "Mondeo",
    "Fusion", "Territory", "Maverick", "Bronco", "Transit", "Belina", "Corcel", "Pampa", "Galaxy", "Mustang", "Explorer"],
  Renault: ["Clio", "Sandero", "Logan", "Duster", "Kwid", "Captur", "Megane", "Mégane", "Scenic", "Scénic", "Symbol", "Kangoo",
    "Fluence", "Laguna", "Twingo", "Oroch", "Master", "Trafic", "Modus", "Espace", "Koleos", "Stepway", "Kardian"],
  Honda: ["Civic", "Fit", "City", "HR-V", "HRV", "WR-V", "WRV", "CR-V", "CRV", "Accord", "Prelude", "Legend", "Odyssey", "Jazz"],
  Toyota: ["Corolla", "Etios", "Hilux", "Yaris", "Camry", "RAV4", "Prius", "Fielder", "SW4", "Bandeirante", "Avensis", "Auris", "Celica", "Land Cruiser", "Previa", "Supra"],
  Hyundai: ["HB20", "Creta", "Tucson", "Santa Fe", "Azera", "Elantra", "Sonata", "Veloster", "Accent", "Getz", "Atos", "Vera Cruz", "Terracan"],
  Kia: ["Sportage", "Sorento", "Cerato", "Picanto", "Soul", "Carnival", "Bongo", "Optima", "Mohave", "Stonic"],
  Nissan: ["March", "Versa", "Sentra", "Kicks", "Frontier", "Livina", "Tiida", "Xterra", "Pathfinder", "Murano", "Altima", "Qashqai", "Micra", "Navara", "Primera"],
  Mitsubishi: ["Lancer", "Pajero", "L200", "Outlander", "ASX", "Eclipse", "Galant", "Airtrek"],
  Peugeot: ["Partner", "Boxer", "Hoggar"],
  "Citroën": ["Picasso", "Xsara", "Saxo", "Berlingo", "Jumper", "Jumpy", "Aircross", "Cactus"],
  Jeep: ["Renegade", "Compass", "Commander", "Cherokee", "Wrangler"],
  "Mercedes-Benz": ["Sprinter", "Accelo", "Atego", "Axor", "Actros", "Vito"],
  Suzuki: ["Vitara", "Jimny", "Swift"],
  Chery: ["Tiggo", "Celer", "Arrizo"],
  Volvo: ["XC60", "XC90"],
};

const norm = (v) => String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** Mapa palavra normalizada → { modelo, montadora }. */
export const MODELOS_CONHECIDOS = (() => {
  const mapa = new Map();
  for (const [montadora, modelos] of Object.entries(LISTA)) {
    for (const modelo of modelos) {
      const k = norm(modelo);
      if (k.length < 3 || /^\d+$/.test(k)) continue;
      if (!mapa.has(k)) mapa.set(k, { modelo, montadora });
    }
  }
  return mapa;
})();

/** Modelo conhecido da palavra (ou null). */
export function modeloConhecido(palavra) {
  return MODELOS_CONHECIDOS.get(norm(palavra)) || null;
}
