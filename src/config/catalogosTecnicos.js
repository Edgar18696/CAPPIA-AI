// =============================================================
// CATÁLOGOS TÉCNICOS — UMA SÓ TELA (26/11/2026)
// Um cartão por fabricante, em 3 grupos. Cada cartão junta:
//   - a pesquisa na Base PAIIA (catálogos já importados), filtrada pelo fabricante;
//   - o acesso ao catálogo oficial (links de CATALOGOS_ONLINE), quando houver.
// Os catálogos retirados da tela continuam em catalogosOnline.js (histórico) e
// NENHUM dado importado no banco é apagado: só deixam de aparecer aqui.
// =============================================================
import { CATALOGOS_ONLINE } from "./catalogosOnline.js";

export const GRUPOS_CATALOGOS_TECNICOS = [
  { id: "montadora", titulo: "Montadoras e peças genuínas", icone: "🚗" },
  { id: "oe", titulo: "Componentes originais (OE)", icone: "⚙️" },
  { id: "reposicao", titulo: "Reposição", icone: "🔧" },
];

// filtros: textos procurados no fabricante OU na origem do registro da Base PAIIA.
// oficiais: ids de CATALOGOS_ONLINE (o 1º é o principal).
export const FABRICANTES_CATALOGOS = [
  // 1 — Montadoras e peças genuínas
  { id: "renault", nome: "Renault Mecânico", grupo: "montadora", filtros: ["renault", "motrio", "catcar"], oficiais: ["renault-mecanico-loja", "renault-motrio-pdf"], catcar: true },
  { id: "vw", nome: "Volkswagen", grupo: "montadora", filtros: ["volkswagen"], oficiais: ["pecas-vw", "reparador-vw"] },
  { id: "fiat", nome: "Fiat / Stellantis", grupo: "montadora", filtros: ["fiat", "mopar"], oficiais: ["fiat-reparador", "mopar-brasil"] },
  { id: "chevrolet", nome: "Chevrolet / GM", grupo: "montadora", filtros: ["chevrolet", "general motors"], oficiais: ["peca-chevrolet", "cepchev"] },
  { id: "toyota", nome: "Toyota", grupo: "montadora", filtros: ["toyota"], oficiais: [] },
  { id: "honda", nome: "Honda", grupo: "montadora", filtros: ["honda"], oficiais: [] },
  { id: "nissan", nome: "Nissan", grupo: "montadora", filtros: ["nissan"], oficiais: [] },
  { id: "ford", nome: "Ford", grupo: "montadora", filtros: ["ford", "motorcraft"], oficiais: ["reparador-ford"] },
  { id: "hyundai", nome: "Hyundai", grupo: "montadora", filtros: ["hyundai"], oficiais: ["hyundai-mobis"] },
  { id: "peugeot", nome: "Peugeot / Citroën", grupo: "montadora", filtros: ["peugeot", "citro"], oficiais: ["service-box"] },
  { id: "mitsubishi", nome: "Mitsubishi", grupo: "montadora", filtros: ["mitsubishi"], oficiais: ["mit-pecas"] },
  { id: "bmw", nome: "BMW / MINI", grupo: "montadora", filtros: ["bmw"], oficiais: ["realoem"] },
  { id: "volvo", nome: "Volvo (caminhões e ônibus)", grupo: "montadora", filtros: ["volvo"], oficiais: ["volvo-pecas-caminhoes"] },

  // 2 — Fabricantes de componentes originais (OE)
  { id: "denso", nome: "DENSO", grupo: "oe", filtros: ["denso"], oficiais: ["denso-oficial-brasil"] },
  { id: "bosch", nome: "Bosch", grupo: "oe", filtros: ["bosch"], excluirFiltros: ["gauss"], oficiais: ["bosch-catalogo-online-br", "bosch-pesquisa-veiculos"] },
  { id: "magneti", nome: "Magneti Marelli / Cofap", grupo: "oe", filtros: ["magneti", "marelli", "cofap", "weber"], oficiais: ["mm-cofap"] },
  { id: "ngk", nome: "NGK / NTK", grupo: "oe", filtros: ["ngk", "ntk"], oficiais: ["ngk-consulta-rapida", "ngk-catalogos-pdf"] },
  { id: "continental", nome: "Continental / VDO", grupo: "oe", filtros: ["continental", "vdo", "siemens"], oficiais: ["vdo-catalogo-expresso", "continental-catalogos"] },
  { id: "valeo", nome: "Valeo", grupo: "oe", filtros: ["valeo"], oficiais: ["valeo"] },
  { id: "delphi", nome: "Delphi", grupo: "oe", filtros: ["delphi"], oficiais: ["delphi-brasil"] },
  { id: "mahle", nome: "MAHLE", grupo: "oe", filtros: ["mahle"], oficiais: ["mahle-catalogo"] },
  { id: "kostal", nome: "KOSTAL", grupo: "oe", filtros: ["kostal"], oficiais: ["kostal"] },
  { id: "motorservice", nome: "MS Motorservice (KS / Pierburg)", grupo: "oe", filtros: ["pierburg", "motorservice"], oficiais: ["ms-catweb"] },

  // 3 — Reposição
  { id: "tsa", nome: "TSA", grupo: "reposicao", filtros: ["tsa"], oficiais: ["tsa-produtos"] },
  { id: "gauss", nome: "Gauss", grupo: "reposicao", filtros: ["gauss"], oficiais: [] },
  { id: "mte", nome: "MTE-Thomson", grupo: "reposicao", filtros: ["mte"], oficiais: ["mte-cate"] },
  { id: "ds", nome: "DS", grupo: "reposicao", filtros: ["ds ind", "ds —"], oficiais: ["ds-industria"] },
  { id: "3rho", nome: "3-RHO", grupo: "reposicao", filtros: ["3-rho", "3rho"], oficiais: ["3rho"] },
  { id: "tecfil", nome: "TECFIL (filtros)", grupo: "reposicao", filtros: ["tecfil"], oficiais: [] },
  { id: "fraslemobility", nome: "Nakata / Fras-le Mobility", grupo: "reposicao", filtros: ["nakata", "fras-le", "fremax", "controil"], oficiais: ["nakata", "auto-experts"] },
  { id: "tecdoc", nome: "TecDoc Brasil (multimarcas)", grupo: "reposicao", filtros: [], oficiais: ["tecdoc-brasil"] },
];

// Retirados da tela na revisão de 26/11/2026 (continuam em catalogosOnline.js).
export const CATALOGOS_RETIRADOS = {
  "gm-parts-eua": "Bloqueado no Brasil (Access Denied) e voltado à frota dos EUA.",
  "mopar-eua": "Site dos EUA; a versão brasileira (Mopar Oficial Brasil) continua.",
  "stellantis-iop": "Portal pago dos EUA (Jeep, Ram, Dodge, Chrysler) só por VIN.",
  "erwin-vw-group": "Indisponível no Brasil (atende só mercados europeus).",
  "erwin-audi": "Indisponível no Brasil (só UE, Noruega, Suíça e Reino Unido).",
  "pecas-ford": "Página institucional sem pesquisa por código.",
  "toyota-parts-eua": "Bloqueado no Brasil (erro 403) e voltado à frota dos EUA.",
  "toyota-tis": "Assinatura paga, frota da América do Norte.",
  "nissan-pecas": "Página institucional sem pesquisa por código.",
  "hyundai-techinfo": "Assinatura paga, frota da América do Norte.",
  "kia-pecas": "Não é catálogo: só um formulário com chassi.",
  "kia-kgis": "Assinatura paga, com CAPTCHA, fora do Brasil.",
  "mitsubishi-techinfo-eu": "Assinatura paga, frota europeia.",
  "mb-b2b-connect": "Sem versão Brasil (o endereço /br vai para a Alemanha).",
  "mb-pecas-brasil": "Sem catálogo online: só direciona às concessionárias.",
  "bmw-aos": "Assinatura paga; para consulta de código o RealOEM continua.",
  "volvo-cars-tis": "O Brasil não está entre os mercados do VIDA.",
  "volvo-trucks-catalogo": "Brochura; o catálogo Volvo Peças continua.",
  "jlr-topix": "Assinatura paga, só campanhas por VIN.",
  "bosch-pesquisa-produtos": "Repetido: o Catálogo Online Bosch Brasil já pesquisa por código.",
  "mm-parts-services": "Foco no mercado europeu; o catálogo Magneti Marelli Cofap continua.",
  "ngk-app": "Página para baixar o app; a Consulta Rápida no navegador continua.",
  "denso-find-my-part": "Foco EUA/Canadá; substituído por \"DENSO — Catálogo Oficial Brasil\".",
  "denso-velas": "PDFs globais de velas; substituído por \"DENSO — Catálogo Oficial Brasil\".",
  "vdo-tecdoc": "Cobertura europeia; o Catálogo Web VDO (Brasil) continua.",
  "mte-pdf": "Repetido: o Cat-E da MTE-Thomson já pesquisa por veículo e código.",
  "tsa-downloads": "PDF só depois de formulário; o catálogo TSA 2025 já está no PAIIA para importar.",
  "ms-loja": "Loja B2B com login de cliente, não é catálogo técnico.",
  "hella": "Cobertura europeia (TecDoc).",
  "baixe-catalogo": "Agregador de terceiros, não é fonte primária.",
  "fraga-placa": "Serviço B2B pago para integrar sistemas (página em inglês).",
};

const porId = new Map(CATALOGOS_ONLINE.map((c) => [c.id, c]));

/** Catálogos oficiais (links) de um fabricante, sem os retirados. */
export function oficiaisDoFabricante(fabricante) {
  return (fabricante?.oficiais || [])
    .filter((id) => !CATALOGOS_RETIRADOS[id])
    .map((id) => porId.get(id))
    .filter(Boolean);
}

/** Catálogos online que continuam na tela. */
export function catalogosOnlineMantidos() {
  return CATALOGOS_ONLINE.filter((c) => !CATALOGOS_RETIRADOS[c.id]);
}

/** O registro da Base PAIIA pertence a este fabricante? (fabricante ou origem do catálogo) */
export function registroDoFabricante(registro, fabricante) {
  if (!fabricante) return true;
  const texto = `${registro?.fabricante || ""} | ${registro?.origem_catalogo || ""}`.toLowerCase();
  if ((fabricante.excluirFiltros || []).some((f) => texto.includes(f))) return false;
  return (fabricante.filtros || []).some((f) => texto.includes(f));
}

/** Procura o fabricante pelo nome digitado (ex.: "denso", "vw", "gm"). */
export function fabricantePeloTexto(texto) {
  const t = String(texto || "").trim().toLowerCase();
  if (!t) return null;
  return FABRICANTES_CATALOGOS.find((f) => f.nome.toLowerCase() === t || f.id === t || f.filtros.includes(t)) || null;
}
