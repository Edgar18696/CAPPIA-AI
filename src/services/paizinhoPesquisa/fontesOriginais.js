// =============================================================
// PAIZINHO — FONTES ORIGINAIS / OFICIAIS
// -------------------------------------------------------------
// Lista de domínios que PODEM CONFIRMAR dados técnicos (aplicação,
// OEM, equivalência, especificação) na pesquisa externa do Paizinho.
//
// Regra: "A internet ajuda a localizar, mas a fonte original confirma."
//   - Só domínios desta lista (ou subdomínios deles) confirmam dados.
//   - Marketplaces, lojas, blogs e fóruns NUNCA confirmam (são no máximo
//     "pista" para localizar o fabricante/código).
//   - Domínio desconhecido = não confirma.
//
// Prioridade (menor = mais forte):
//   1 = catálogo oficial da montadora / OEM
//   2 = site ou catálogo oficial do fabricante da peça
//   3 = documentação técnica oficial
//   4 = catálogo técnico oficial de fabricante reconhecido / plataforma
//       oficial alimentada pelos fabricantes (ex.: TecDoc)
//
// Os domínios foram conferidos na revisão dos Catálogos Online
// (teste feito no Brasil em 23/09/2026). Endereços bloqueados no Brasil
// continuam aqui como fonte técnica válida, mas o servidor pode não
// conseguir abri-los.
// =============================================================

export const TIPO_FONTE = {
  MONTADORA: "montadora_oficial",
  FABRICANTE: "fabricante_oficial",
  DOCUMENTACAO: "documentacao_oficial",
  CATALOGO_RECONHECIDO: "catalogo_oficial_reconhecido",
  PISTA: "pista_nao_confirma",
  DESCONHECIDA: "desconhecida_nao_confirma",
};

export const ROTULO_TIPO_FONTE = {
  [TIPO_FONTE.MONTADORA]: "Catálogo oficial da montadora",
  [TIPO_FONTE.FABRICANTE]: "Site/catálogo oficial do fabricante",
  [TIPO_FONTE.DOCUMENTACAO]: "Documentação técnica oficial",
  [TIPO_FONTE.CATALOGO_RECONHECIDO]: "Catálogo oficial reconhecido",
  [TIPO_FONTE.PISTA]: "Pista (não confirma)",
  [TIPO_FONTE.DESCONHECIDA]: "Fonte não verificada (não confirma)",
};

// ---------- Fontes que PODEM confirmar ----------
export const FONTES_ORIGINAIS = [
  // 1 — Montadoras / OEM
  { dominio: "pecachevrolet.com.br", nome: "Peça Chevrolet (GM Brasil)", marca: "Chevrolet / GM", tipo: TIPO_FONTE.MONTADORA, prioridade: 1 },
  { dominio: "gmparts.com", nome: "GM Parts (EUA)", marca: "Chevrolet / GM", tipo: TIPO_FONTE.MONTADORA, prioridade: 1 },
  { dominio: "mecanico.renault.com.br", nome: "Mecânico Renault", marca: "Renault", tipo: TIPO_FONTE.MONTADORA, prioridade: 1 },
  { dominio: "reparador.fiat.com.br", nome: "Fiat Reparador", marca: "Fiat", tipo: TIPO_FONTE.MONTADORA, prioridade: 1 },
  { dominio: "moparoficial.com.br", nome: "Mopar Oficial Brasil", marca: "Stellantis", tipo: TIPO_FONTE.MONTADORA, prioridade: 1 },
  { dominio: "mopar.com", nome: "Mopar (EUA)", marca: "Stellantis", tipo: TIPO_FONTE.MONTADORA, prioridade: 1 },
  { dominio: "servicebox-parts.com", nome: "Service Box (PSA/Stellantis)", marca: "Peugeot / Citroën", tipo: TIPO_FONTE.MONTADORA, prioridade: 1 },
  { dominio: "pecas.vw.com.br", nome: "Peças VW", marca: "Volkswagen", tipo: TIPO_FONTE.MONTADORA, prioridade: 1 },
  { dominio: "reparadorvw.com.br", nome: "Reparador VW", marca: "Volkswagen", tipo: TIPO_FONTE.DOCUMENTACAO, prioridade: 3 },
  { dominio: "ford.com.br", nome: "Ford Brasil", marca: "Ford", tipo: TIPO_FONTE.MONTADORA, prioridade: 1 },
  { dominio: "reparadorford.com.br", nome: "Reparador Ford", marca: "Ford", tipo: TIPO_FONTE.DOCUMENTACAO, prioridade: 3 },
  { dominio: "autoparts.toyota.com", nome: "Toyota Parts (EUA)", marca: "Toyota", tipo: TIPO_FONTE.MONTADORA, prioridade: 1 },
  { dominio: "nissan.com.br", nome: "Nissan Brasil", marca: "Nissan", tipo: TIPO_FONTE.MONTADORA, prioridade: 1 },
  { dominio: "hyundaimobis.com.br", nome: "Hyundai Mobis Brasil", marca: "Hyundai", tipo: TIPO_FONTE.MONTADORA, prioridade: 1 },
  { dominio: "kia.com.br", nome: "Kia Brasil", marca: "Kia", tipo: TIPO_FONTE.MONTADORA, prioridade: 1 },
  { dominio: "mitsubishimotors.com.br", nome: "Mitsubishi Brasil", marca: "Mitsubishi", tipo: TIPO_FONTE.MONTADORA, prioridade: 1 },
  { dominio: "mercedes-benz.com.br", nome: "Mercedes-Benz Brasil", marca: "Mercedes-Benz", tipo: TIPO_FONTE.MONTADORA, prioridade: 1 },
  { dominio: "volvopecas.com.br", nome: "Volvo Peças", marca: "Volvo", tipo: TIPO_FONTE.MONTADORA, prioridade: 1 },
  { dominio: "volvotrucks.com.br", nome: "Volvo Trucks Brasil", marca: "Volvo", tipo: TIPO_FONTE.MONTADORA, prioridade: 1 },

  // 2 — Fabricantes de peças (sites/catálogos oficiais)
  { dominio: "boschaftermarket.com", nome: "Bosch Autopeças", marca: "Bosch", tipo: TIPO_FONTE.FABRICANTE, prioridade: 2 },
  { dominio: "bosch.com.br", nome: "Bosch Brasil", marca: "Bosch", tipo: TIPO_FONTE.FABRICANTE, prioridade: 2 },
  { dominio: "mmcofap.com.br", nome: "Magneti Marelli Cofap", marca: "Magneti Marelli", tipo: TIPO_FONTE.FABRICANTE, prioridade: 2 },
  { dominio: "magnetimarelli-parts-and-services.com", nome: "Magneti Marelli Parts & Services", marca: "Magneti Marelli", tipo: TIPO_FONTE.FABRICANTE, prioridade: 2 },
  { dominio: "ngkntk.com.br", nome: "NGK/NTK Brasil", marca: "NGK / NTK", tipo: TIPO_FONTE.FABRICANTE, prioridade: 2 },
  { dominio: "densoautoparts.com", nome: "DENSO Auto Parts", marca: "Denso", tipo: TIPO_FONTE.FABRICANTE, prioridade: 2 },
  { dominio: "denso.com", nome: "DENSO", marca: "Denso", tipo: TIPO_FONTE.FABRICANTE, prioridade: 2 },
  { dominio: "delphiautoparts.com", nome: "Delphi", marca: "Delphi", tipo: TIPO_FONTE.FABRICANTE, prioridade: 2 },
  { dominio: "delphi.catalogofraga.com.br", nome: "Catálogo Fraga-Delphi", marca: "Delphi", tipo: TIPO_FONTE.FABRICANTE, prioridade: 2 },
  { dominio: "continental-aftermarket.com", nome: "Continental Aftermarket", marca: "Continental / VDO", tipo: TIPO_FONTE.FABRICANTE, prioridade: 2 },
  { dominio: "vdo.com", nome: "VDO", marca: "Continental / VDO", tipo: TIPO_FONTE.FABRICANTE, prioridade: 2 },
  { dominio: "catalogoexpresso.com.br", caminho: "/vdo", nome: "Catálogo Web VDO", marca: "Continental / VDO", tipo: TIPO_FONTE.FABRICANTE, prioridade: 2 },
  { dominio: "catalogoexpresso.com.br", caminho: "/valeo", nome: "Catálogo Web Valeo", marca: "Valeo", tipo: TIPO_FONTE.FABRICANTE, prioridade: 2 },
  { dominio: "mte-thomson.com.br", nome: "MTE-Thomson", marca: "MTE-Thomson", tipo: TIPO_FONTE.FABRICANTE, prioridade: 2 },
  { dominio: "tsadobrasil.com.br", nome: "TSA do Brasil", marca: "TSA", tipo: TIPO_FONTE.FABRICANTE, prioridade: 2 },
  { dominio: "ds.ind.br", nome: "DS Indústria", marca: "DS", tipo: TIPO_FONTE.FABRICANTE, prioridade: 2 },
  { dominio: "3rho.com.br", nome: "3-RHO", marca: "3-RHO", tipo: TIPO_FONTE.FABRICANTE, prioridade: 2 },
  { dominio: "kostalbrasil.com.br", nome: "Kostal Brasil", marca: "Kostal", tipo: TIPO_FONTE.FABRICANTE, prioridade: 2 },
  { dominio: "ms-motorservice.com.br", nome: "MS Motorservice (KS/Pierburg)", marca: "MS Motorservice", tipo: TIPO_FONTE.FABRICANTE, prioridade: 2 },
  { dominio: "catalogo.mahle.com", nome: "Catálogo Mahle", marca: "Mahle", tipo: TIPO_FONTE.FABRICANTE, prioridade: 2 },
  { dominio: "valeoservice.com.br", nome: "Valeo Service", marca: "Valeo", tipo: TIPO_FONTE.FABRICANTE, prioridade: 2 },
  { dominio: "hella.com", nome: "HELLA", marca: "Hella", tipo: TIPO_FONTE.FABRICANTE, prioridade: 2 },
  { dominio: "catalogonakata.com.br", nome: "Catálogo Nakata", marca: "Nakata", tipo: TIPO_FONTE.FABRICANTE, prioridade: 2 },
  { dominio: "autoexperts.parts", nome: "Auto Experts (Fras-le Mobility)", marca: "Fras-le / Nakata", tipo: TIPO_FONTE.FABRICANTE, prioridade: 2 },

  // 4 — Plataforma oficial alimentada pelos fabricantes
  { dominio: "web.tecalliance.net", nome: "TecDoc (TecAlliance)", marca: "Multimarcas", tipo: TIPO_FONTE.CATALOGO_RECONHECIDO, prioridade: 4 },
  { dominio: "tecalliance.com.br", nome: "TecAlliance Brasil", marca: "Multimarcas", tipo: TIPO_FONTE.CATALOGO_RECONHECIDO, prioridade: 4 },
];

// ---------- Fontes que NUNCA confirmam (no máximo pista) ----------
export const DOMINIOS_PISTA = [
  "mercadolivre.com.br",
  "mercadolivre.com",
  "mercadolibre.com",
  "shopee.com.br",
  "shopee.com",
  "amazon.com.br",
  "amazon.com",
  "aliexpress.com",
  "magazineluiza.com.br",
  "magalu.com.br",
  "americanas.com.br",
  "casasbahia.com.br",
  "olx.com.br",
  "ebay.com",
  "shein.com",
  "reclameaqui.com.br",
  "youtube.com",
  "facebook.com",
  "instagram.com",
  "tiktok.com",
  "blogspot.com",
  "wordpress.com",
  "medium.com",
  "realoem.com", // útil, mas não oficial
  "cepchev.com.br", // útil, mas não oficial
  "baixecatalogo.com.br", // agregador, não é fonte primária
];

function hostDaUrl(url) {
  try {
    return new URL(String(url || "").trim()).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function caminhoDaUrl(url) {
  try {
    return new URL(String(url || "").trim()).pathname.toLowerCase();
  } catch {
    return "";
  }
}

function hostCombina(host, dominio) {
  const d = dominio.toLowerCase();
  return host === d || host.endsWith("." + d);
}

/**
 * Classifica uma URL.
 * Retorna { oficial, podeConfirmar, tipo, prioridade, nome, marca, host }.
 */
export function classificarFonte(url) {
  const host = hostDaUrl(url);
  if (!host) {
    return {
      oficial: false,
      podeConfirmar: false,
      tipo: TIPO_FONTE.DESCONHECIDA,
      prioridade: 99,
      nome: "URL inválida",
      marca: "",
      host: "",
    };
  }

  if (DOMINIOS_PISTA.some((d) => hostCombina(host, d))) {
    return {
      oficial: false,
      podeConfirmar: false,
      tipo: TIPO_FONTE.PISTA,
      prioridade: 90,
      nome: host,
      marca: "",
      host,
    };
  }

  const caminho = caminhoDaUrl(url);
  const candidatas = FONTES_ORIGINAIS.filter(
    (f) => hostCombina(host, f.dominio) && (!f.caminho || caminho.startsWith(f.caminho))
  );
  if (candidatas.length > 0) {
    const f = candidatas.sort((a, b) => a.prioridade - b.prioridade)[0];
    return {
      oficial: true,
      podeConfirmar: true,
      tipo: f.tipo,
      prioridade: f.prioridade,
      nome: f.nome,
      marca: f.marca,
      host,
    };
  }

  return {
    oficial: false,
    podeConfirmar: false,
    tipo: TIPO_FONTE.DESCONHECIDA,
    prioridade: 95,
    nome: host,
    marca: "",
    host,
  };
}

/** Domínios oficiais (sem repetição), úteis para restringir a busca no servidor. */
export function dominiosOficiais({ tipos } = {}) {
  const lista = FONTES_ORIGINAIS.filter((f) => !tipos || tipos.includes(f.tipo)).map(
    (f) => f.dominio
  );
  return [...new Set(lista)];
}
