/*
 * ============================================================
 * APPIA AI
 * PARSER NTK - INTERRUPTORES DE PRESSÃO DE ÓLEO
 * ============================================================
 *
 * Catálogo específico de 2 páginas.
 *
 * Motivo da estratégia:
 *
 * O PDF extrai as colunas fora da ordem visual.
 * Portanto NÃO usamos contexto sequencial para juntar
 * modelo -> motor -> combustível -> ano -> código.
 *
 * As aplicações confirmadas são cadastradas de forma
 * determinística e os códigos adicionais recebem apenas
 * registro seguro, sem inventar aplicação.
 * ============================================================
 */

function limparTexto(valor = "") {
  return String(valor || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizar(valor = "") {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizarCodigo(valor = "") {
  return String(valor || "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .trim();
}

function extrairCodigos(texto = "") {
  return [
    ...new Set(
      (
        String(texto || "")
          .toUpperCase()
          .match(/\bOPA1-[A-Z]\d{3}\b/g) ||
        []
      ).map(normalizarCodigo)
    ),
  ];
}

function linha({
  montadora,
  modelo,
  motor,
  combustivel,
  periodo,
  codigo,
}) {
  return {
    montadora,
    modelo,
    motor,
    combustivel,
    periodo,
    codigo,
  };
}

/*
 * ============================================================
 * BASE CONFIRMADA DO CATÁLOGO
 * ============================================================
 */

const CATALOGO_NTK = [
  /*
   * ========================================================
   * CHEVROLET - PÁGINA 1
   * ========================================================
   */

  linha({
    montadora: "Chevrolet",
    modelo: "Suprema",
    motor: "2.2 8v",
    combustivel: "Etanol / GNV",
    periodo: "1993 a 1998",
    codigo: "OPA1-N001",
  }),

  linha({
    montadora: "Chevrolet",
    modelo: "Suprema",
    motor: "2.2 8v",
    combustivel: "Gasolina / GNV",
    periodo: "1993 a 1998",
    codigo: "OPA1-N001",
  }),

  linha({
    montadora: "Chevrolet",
    modelo: "Suprema",
    motor: "3.0 / 6 cilindros",
    combustivel: "Gasolina / GNV",
    periodo: "1993 a 1998",
    codigo: "OPA1-N001",
  }),

  linha({
    montadora: "Chevrolet",
    modelo: "Vectra",
    motor: "2.0 8v",
    combustivel: "Gasolina / GNV",
    periodo: "1997 a 2005",
    codigo: "OPA1-N001",
  }),

  linha({
    montadora: "Chevrolet",
    modelo: "Vectra",
    motor: "2.0 16v",
    combustivel: "Gasolina / GNV",
    periodo: "1997 a 2005",
    codigo: "OPA1-N001",
  }),

  linha({
    montadora: "Chevrolet",
    modelo: "Vectra",
    motor: "2.2 8v",
    combustivel: "Gasolina / GNV",
    periodo: "1998 a 2005",
    codigo: "OPA1-N001",
  }),

  linha({
    montadora: "Chevrolet",
    modelo: "Vectra",
    motor: "2.2 16v",
    combustivel: "Gasolina / GNV",
    periodo: "1998 a 2005",
    codigo: "OPA1-N001",
  }),

  linha({
    montadora: "Chevrolet",
    modelo: "Vectra",
    motor: "2.0 8v",
    combustivel: "Bicombustível / GNV",
    periodo: "2006 a 2011",
    codigo: "OPA1-N001",
  }),

  linha({
    montadora: "Chevrolet",
    modelo: "Vectra",
    motor: "2.4 16v",
    combustivel: "Bicombustível / GNV",
    periodo: "2006 a 2011",
    codigo: "OPA1-N001",
  }),

  linha({
    montadora: "Chevrolet",
    modelo: "Zafira",
    motor: "1.8 8v MPFI",
    combustivel: "Gasolina / GNV",
    periodo: "1999 a 2001",
    codigo: "OPA1-N001",
  }),

  linha({
    montadora: "Chevrolet",
    modelo: "Zafira",
    motor: "1.8 8v MPFI",
    combustivel: "Etanol / GNV",
    periodo: "1999 a 2003",
    codigo: "OPA1-N001",
  }),

  linha({
    montadora: "Chevrolet",
    modelo: "Zafira",
    motor: "2.0 8v MPFI",
    combustivel: "Gasolina / GNV",
    periodo: "1999 a 2003",
    codigo: "OPA1-N001",
  }),

  linha({
    montadora: "Chevrolet",
    modelo: "Zafira",
    motor: "2.0 8v MPFI",
    combustivel: "Bicombustível / GNV",
    periodo: "2004 a 2012",
    codigo: "OPA1-N001",
  }),

  linha({
    montadora: "Chevrolet",
    modelo: "Zafira",
    motor: "2.0 16v MPFI",
    combustivel: "Gasolina / GNV",
    periodo: "1999 a 2003",
    codigo: "OPA1-N001",
  }),

  /*
   * ========================================================
   * PEUGEOT
   * ========================================================
   */

  linha({
    montadora: "Peugeot",
    modelo: "206",
    motor: "1.6 16v (TU5JP4)",
    combustivel: "Gasolina / GNV",
    periodo: "Desde 2001",
    codigo: "OPA1-N005",
  }),

  linha({
    montadora: "Peugeot",
    modelo: "207",
    motor: "1.6 16v (TU5JP4)",
    combustivel: "Bicombustível / GNV",
    periodo: "Desde 2008",
    codigo: "OPA1-N005",
  }),

  linha({
    montadora: "Peugeot",
    modelo: "307",
    motor: "1.6 16v (TU5JP4)",
    combustivel: "Bicombustível / GNV",
    periodo: "Desde 2006",
    codigo: "OPA1-N005",
  }),

  linha({
    montadora: "Peugeot",
    modelo: "307",
    motor: "2.0 16v (EW10A)",
    combustivel: "Bicombustível / GNV",
    periodo: "Desde 2007",
    codigo: "OPA1-N005",
  }),

  linha({
    montadora: "Peugeot",
    modelo: "208",
    motor: "1.6 16v (TU5JP4)",
    combustivel: "Bicombustível / GNV",
    periodo: "Desde 2013",
    codigo: "OPA1-N005",
  }),

  /*
   * ========================================================
   * VOLKSWAGEN
   * ========================================================
   */

  linha({
    montadora: "Volkswagen",
    modelo: "Apollo",
    motor: "1.6, 1.8 e 2.0 AP",
    combustivel: "Gasolina / GNV",
    periodo: "",
    codigo: "OPA1-N007",
  }),

  linha({
    montadora: "Volkswagen",
    modelo: "Apollo",
    motor: "1.8 e 2.0 i.e.",
    combustivel: "Gasolina / GNV",
    periodo: "",
    codigo: "OPA1-N004",
  }),

  linha({
    montadora: "Volkswagen",
    modelo: "Fox",
    motor: "1.0 8v (BNX - 71cv) / EA111",
    combustivel: "Gasolina / GNV",
    periodo: "Desde 2003",
    codigo: "OPA1-N003",
  }),

  linha({
    montadora: "Volkswagen",
    modelo: "Fox",
    motor: "1.0 8v (CCNA - 73cv) / EA111",
    combustivel: "Bicombustível / GNV",
    periodo: "Desde 2008",
    codigo: "OPA1-N003",
  }),

  linha({
    montadora: "Volkswagen",
    modelo: "Fox",
    motor: "1.0 12v (CSEA - 82cv) / EA211",
    combustivel: "Bicombustível / GNV",
    periodo: "2014 a 2021",
    codigo: "OPA1-N003",
  }),

  linha({
    montadora: "Volkswagen",
    modelo: "Fox",
    motor: "1.6 8v (BAH - 100cv) / EA111",
    combustivel: "Gasolina / GNV",
    periodo: "Desde 2003",
    codigo: "OPA1-N003",
  }),

  linha({
    montadora: "Volkswagen",
    modelo: "Fox",
    motor: "1.6 8v (BPA - 100cv) / EA111",
    combustivel: "Bicombustível / GNV",
    periodo: "Desde 2003",
    codigo: "OPA1-N003",
  }),

  linha({
    montadora: "Volkswagen",
    modelo: "Fox",
    motor: "1.6 8v (CCRA - 101cv) / EA111",
    combustivel: "Bicombustível / GNV",
    periodo: "Desde 2008",
    codigo: "OPA1-N003",
  }),

  linha({
    montadora: "Volkswagen",
    modelo: "Fox",
    motor: "1.6 16v (CNXA - 120cv) / EA211",
    combustivel: "Bicombustível / GNV",
    periodo: "2014 a 2021",
    codigo: "OPA1-N003",
  }),

  linha({
    montadora: "Volkswagen",
    modelo: "Fusca",
    motor: "1.3 e 1.6 (refrigerado a ar)",
    combustivel: "Gasolina / GNV",
    periodo: "",
    codigo: "OPA1-N010",
  }),

  linha({
    montadora: "Volkswagen",
    modelo: "Gol",
    motor: "1.0 Turbo",
    combustivel: "Gasolina / GNV",
    periodo: "",
    codigo: "OPA1-N004",
  }),

  linha({
    montadora: "Volkswagen",
    modelo: "Gol",
    motor: "1.0 8v (BNX - 71cv) / EA111",
    combustivel: "Gasolina / GNV",
    periodo: "Desde 2003",
    codigo: "OPA1-N003",
  }),

  linha({
    montadora: "Volkswagen",
    modelo: "Gol",
    motor: "1.0 8v (CCNA - 73cv) / EA111",
    combustivel: "Bicombustível / GNV",
    periodo: "Desde 2008",
    codigo: "OPA1-N003",
  }),

  linha({
    montadora: "Volkswagen",
    modelo: "Gol",
    motor: "1.0 12v (CSEA - 82cv) / EA211",
    combustivel: "Bicombustível / GNV",
    periodo: "2018 a 2023",
    codigo: "OPA1-N003",
  }),

  linha({
    montadora: "Volkswagen",
    modelo: "Gol",
    motor: "1.6 8v (BAH - 100cv) / EA111",
    combustivel: "Gasolina / GNV",
    periodo: "Desde 2003",
    codigo: "OPA1-N003",
  }),

  linha({
    montadora: "Volkswagen",
    modelo: "Gol",
    motor: "1.6 8v (BPA - 100cv) / EA111",
    combustivel: "Bicombustível / GNV",
    periodo: "Desde 2003",
    codigo: "OPA1-N003",
  }),

  linha({
    montadora: "Volkswagen",
    modelo: "Gol",
    motor: "1.6 8v (CCRA - 101cv) / EA111",
    combustivel: "Bicombustível / GNV",
    periodo: "Desde 2008",
    codigo: "OPA1-N003",
  }),

  linha({
    montadora: "Volkswagen",
    modelo: "Gol",
    motor: "1.6 16v (CNXA - 120cv) / EA211",
    combustivel: "Bicombustível / GNV",
    periodo: "2018 a 2023",
    codigo: "OPA1-N003",
  }),

  linha({
    montadora: "Volkswagen",
    modelo: "Kombi",
    motor: "1.3 e 1.6 (refrigerado a ar)",
    combustivel: "Gasolina / GNV",
    periodo: "",
    codigo: "OPA1-N010",
  }),

  linha({
    montadora: "Volkswagen",
    modelo: "Kombi",
    motor: "1.4 8v (BTJ) / EA111",
    combustivel: "Bicombustível / GNV",
    periodo: "2005 a 2014",
    codigo: "OPA1-N003",
  }),

  linha({
    montadora: "Volkswagen",
    modelo: "Parati",
    motor: "1.6, 1.8 e 2.0 AP",
    combustivel: "Gasolina / GNV",
    periodo: "",
    codigo: "OPA1-N007",
  }),

  linha({
    montadora: "Volkswagen",
    modelo: "Passat",
    motor: "1.6, 1.8 e 2.0 AP",
    combustivel: "Gasolina / GNV",
    periodo: "",
    codigo: "OPA1-N007",
  }),

  linha({
    montadora: "Volkswagen",
    modelo: "Quantum",
    motor: "1.6, 1.8 e 2.0 AP",
    combustivel: "Gasolina / GNV",
    periodo: "",
    codigo: "OPA1-N007",
  }),

  linha({
    montadora: "Volkswagen",
    modelo: "Santana",
    motor: "1.6, 1.8 e 2.0 AP",
    combustivel: "Gasolina / GNV",
    periodo: "",
    codigo: "OPA1-N007",
  }),

  linha({
    montadora: "Volkswagen",
    modelo: "Saveiro",
    motor: "1.6, 1.8 e 2.0 AP",
    combustivel: "Gasolina / GNV",
    periodo: "",
    codigo: "OPA1-N007",
  }),

  linha({
    montadora: "Volkswagen",
    modelo: "Voyage",
    motor: "1.6, 1.8 e 2.0 AP",
    combustivel: "Gasolina / GNV",
    periodo: "",
    codigo: "OPA1-N007",
  }),

  /*
   * ========================================================
   * CITROËN - PÁGINA 2
   * ========================================================
   */

  linha({
    montadora: "Citroën",
    modelo: "Aircross",
    motor: "1.6 16v (TU5JP4)",
    combustivel: "Bicombustível / GNV",
    periodo: "Desde 2011",
    codigo: "OPA1-N005",
  }),

  linha({
    montadora: "Citroën",
    modelo: "C4",
    motor: "2.0 16v (EW10A)",
    combustivel: "Bicombustível / GNV",
    periodo: "Desde 2008",
    codigo: "OPA1-N005",
  }),

  linha({
    montadora: "Citroën",
    modelo: "C4 Pallas",
    motor: "2.0 16v (EW10A)",
    combustivel: "Bicombustível / GNV",
    periodo: "Desde 2008",
    codigo: "OPA1-N005",
  }),

  linha({
    montadora: "Citroën",
    modelo: "C4 Picasso",
    motor: "2.0 16v (EW10A)",
    combustivel: "Gasolina / GNV",
    periodo: "Desde 2009",
    codigo: "OPA1-N005",
  }),

  linha({
    montadora: "Citroën",
    modelo: "Xsara Picasso",
    motor: "1.6 16v (TU5JP4)",
    combustivel: "Bicombustível / GNV",
    periodo: "Desde 2005",
    codigo: "OPA1-N005",
  }),

  /*
   * ========================================================
   * FIAT
   * ========================================================
   */

  linha({
    montadora: "Fiat",
    modelo: "500",
    motor: "1.4 16v",
    combustivel: "Gasolina / GNV",
    periodo: "2010 a 2011",
    codigo: "OPA1-D002",
  }),

  linha({
    montadora: "Fiat",
    modelo: "500",
    motor: "1.4 8v Fire EVO",
    combustivel: "Bicombustível / GNV",
    periodo: "2011 a 2017",
    codigo: "OPA1-D002",
  }),

  linha({
    montadora: "Fiat",
    modelo: "Argo",
    motor: "1.8 16v E.torQ",
    combustivel: "Bicombustível / GNV",
    periodo: "Desde 2017",
    codigo: "OPA1-D002",
  }),

  linha({
    montadora: "Fiat",
    modelo: "Brava",
    motor: "1.6 16v",
    combustivel: "Gasolina / GNV",
    periodo: "2000 a 2003",
    codigo: "OPA1-D002",
  }),

  linha({
    montadora: "Fiat",
    modelo: "Brava",
    motor: "1.8 16v / HGT",
    combustivel: "Gasolina / GNV",
    periodo: "2000 a 2003",
    codigo: "OPA1-D002",
  }),

  linha({
    montadora: "Fiat",
    modelo: "Bravo",
    motor: "1.4 16v T-Jet",
    combustivel: "Bicombustível / GNV",
    periodo: "2012 a 2014",
    codigo: "OPA1-D002",
  }),

  linha({
    montadora: "Fiat",
    modelo: "Bravo",
    motor: "1.8 16v E.torQ",
    combustivel: "Bicombustível / GNV",
    periodo: "2011 a 2016",
    codigo: "OPA1-D002",
  }),

  linha({
    montadora: "Fiat",
    modelo: "Cronos",
    motor: "1.8 16v E.torQ",
    combustivel: "Bicombustível / GNV",
    periodo: "Desde 2018",
    codigo: "OPA1-D002",
  }),

  linha({
    montadora: "Fiat",
    modelo: "Grand Siena",
    motor: "1.4 8v Fire EVO",
    combustivel: "Bicombustível / GNV",
    periodo: "Desde 2012",
    codigo: "OPA1-D002",
  }),

  linha({
    montadora: "Fiat",
    modelo: "Grand Siena",
    motor: "1.6 16v E.torQ",
    combustivel: "Bicombustível / GNV",
    periodo: "2012 a 2018",
    codigo: "OPA1-D002",
  }),

  linha({
    montadora: "Fiat",
    modelo: "Marea",
    motor: "1.6 16v",
    combustivel: "Gasolina / GNV",
    periodo: "2004 a 2007",
    codigo: "OPA1-D002",
  }),

  linha({
    montadora: "Fiat",
    modelo: "Marea",
    motor: "1.8 16v",
    combustivel: "Gasolina / GNV",
    periodo: "2000 a 2007",
    codigo: "OPA1-D002",
  }),

  linha({
    montadora: "Fiat",
    modelo: "Marea",
    motor: "2.0 20v",
    combustivel: "Gasolina / GNV",
    periodo: "1999 a 2000",
    codigo: "OPA1-D002",
  }),

  linha({
    montadora: "Fiat",
    modelo: "Marea",
    motor: "2.0 20v Turbo",
    combustivel: "Gasolina / GNV",
    periodo: "1999 a 2007",
    codigo: "OPA1-D002",
  }),

  linha({
    montadora: "Fiat",
    modelo: "Marea",
    motor: "2.4 20v",
    combustivel: "Gasolina / GNV",
    periodo: "2001 a 2007",
    codigo: "OPA1-D002",
  }),

  linha({
    montadora: "Fiat",
    modelo: "Palio",
    motor: "1.0 8v Fire EVO",
    combustivel: "Bicombustível / GNV",
    periodo: "2012 a 2017",
    codigo: "OPA1-D002",
  }),

  linha({
    montadora: "Fiat",
    modelo: "Palio",
    motor: "1.4 8v",
    combustivel: "Bicombustível / GNV",
    periodo: "2008 a 2013",
    codigo: "OPA1-D002",
  }),

  linha({
    montadora: "Fiat",
    modelo: "Palio",
    motor: "1.6 8v",
    combustivel: "Gasolina / GNV",
    periodo: "1999 a 2000",
    codigo: "OPA1-D002",
  }),

  linha({
    montadora: "Fiat",
    modelo: "Palio",
    motor: "1.6 16v",
    combustivel: "Gasolina / GNV",
    periodo: "1996 a 2000",
    codigo: "OPA1-D002",
  }),

  linha({
    montadora: "Fiat",
    modelo: "Toro",
    motor: "1.8 16v E.torQ",
    combustivel: "Bicombustível / GNV",
    periodo: "Desde 2016",
    codigo: "OPA1-D002",
  }),

  linha({
    montadora: "Fiat",
    modelo: "Toro",
    motor: "2.0 16v",
    combustivel: "Diesel",
    periodo: "Desde 2016",
    codigo: "OPA1-D002",
  }),

  /*
   * ========================================================
   * FORD
   * ========================================================
   */

  linha({
    montadora: "Ford",
    modelo: "Courier",
    motor: "1.6 8v / Zetec Rocam",
    combustivel: "Gasolina / GNV",
    periodo: "1999 a 2007",
    codigo: "OPA1-N006",
  }),

  linha({
    montadora: "Ford",
    modelo: "Courier",
    motor: "1.6 8v / Zetec Rocam",
    combustivel: "Bicombustível / GNV",
    periodo: "2007 a 02/11/2008",
    codigo: "OPA1-N006",
  }),

  linha({
    montadora: "Ford",
    modelo: "Courier",
    motor: "1.6 8v / Zetec Rocam",
    combustivel: "Bicombustível / GNV",
    periodo: "03/11/2008 a 08/04/2013",
    codigo: "OPA1-N008",
  }),

  linha({
    montadora: "Ford",
    modelo: "Ecosport",
    motor: "1.0 8v / Zetec Rocam Supercharger",
    combustivel: "Gasolina / GNV",
    periodo: "2003 a 2006",
    codigo: "OPA1-N006",
  }),

  linha({
    montadora: "Ford",
    modelo: "Ecosport",
    motor: "1.6 8v / Zetec Rocam",
    combustivel: "Gasolina / GNV",
    periodo: "2003 a 2005",
    codigo: "OPA1-N006",
  }),

  linha({
    montadora: "Ford",
    modelo: "Ecosport",
    motor: "1.6 8v / Zetec Rocam",
    combustivel: "Bicombustível / GNV",
    periodo: "2005 a 03/11/2008",
    codigo: "OPA1-N006",
  }),

  linha({
    montadora: "Ford",
    modelo: "Ecosport",
    motor: "1.6 8v / Zetec Rocam",
    combustivel: "Bicombustível / GNV",
    periodo: "04/11/2008 a 2012",
    codigo: "OPA1-N008",
  }),

  linha({
    montadora: "Ford",
    modelo: "Ecosport",
    motor: "1.6 16v / Sigma",
    combustivel: "Bicombustível / GNV",
    periodo: "2012 a 2017",
    codigo: "OPA1-N006",
  }),

  linha({
    montadora: "Ford",
    modelo: "Ecosport",
    motor: "2.0 16v Duratec",
    combustivel: "Gasolina / GNV",
    periodo: "2003 a 2008",
    codigo: "OPA1-N006",
  }),

  linha({
    montadora: "Ford",
    modelo: "Ecosport",
    motor: "2.0 16v Duratec",
    combustivel: "Bicombustível / GNV",
    periodo: "2008 a 2017",
    codigo: "OPA1-N006",
  }),

  linha({
    montadora: "Ford",
    modelo: "Ecosport",
    motor: "2.0 16v Duratec / Injeção direta",
    combustivel: "Bicombustível / GNV",
    periodo: "2017 a 2021",
    codigo: "OPA1-N006",
  }),

  linha({
    montadora: "Ford",
    modelo: "Escort",
    motor: "1.6 8v / Zetec Rocam",
    combustivel: "Gasolina / GNV",
    periodo: "2000 a 2002",
    codigo: "OPA1-N006",
  }),

  linha({
    montadora: "Ford",
    modelo: "Escort",
    motor: "1.8 AP",
    combustivel: "Gasolina / GNV",
    periodo: "1990 a 1992",
    codigo: "OPA1-N007",
  }),

  linha({
    montadora: "Ford",
    modelo: "Escort",
    motor: "1.8 AP EFI",
    combustivel: "Gasolina / GNV",
    periodo: "1993 a 1996",
    codigo: "OPA1-N004",
  }),

  linha({
    montadora: "Ford",
    modelo: "Escort",
    motor: "2.0 AP EFI",
    combustivel: "Gasolina / GNV",
    periodo: "1993 a 1996",
    codigo: "OPA1-N004",
  }),

  linha({
    montadora: "Ford",
    modelo: "Fiesta",
    motor: "1.0 8v / Zetec Rocam Supercharger",
    combustivel: "Gasolina / GNV",
    periodo: "2002 a 2007",
    codigo: "OPA1-N006",
  }),

  linha({
    montadora: "Ford",
    modelo: "Fiesta",
    motor: "1.0 8v / Zetec Rocam",
    combustivel: "Gasolina / GNV",
    periodo: "1999 a 2006",
    codigo: "OPA1-N006",
  }),

  linha({
    montadora: "Ford",
    modelo: "Fiesta",
    motor: "1.0 8v / Zetec Rocam",
    combustivel: "Bicombustível / GNV",
    periodo: "2006 a 03/11/2008",
    codigo: "OPA1-N006",
  }),

  linha({
    montadora: "Ford",
    modelo: "Fiesta",
    motor: "1.0 8v / Zetec Rocam",
    combustivel: "Bicombustível / GNV",
    periodo: "04/11/2008 a 2014",
    codigo: "OPA1-N008",
  }),

  linha({
    montadora: "Ford",
    modelo: "Fiesta",
    motor: "1.6 8v / Zetec Rocam",
    combustivel: "Gasolina / GNV",
    periodo: "1999 a 2004",
    codigo: "OPA1-N006",
  }),

  linha({
    montadora: "Ford",
    modelo: "Fiesta",
    motor: "1.6 8v / Zetec Rocam",
    combustivel: "Bicombustível / GNV",
    periodo: "2004 a 03/11/2008",
    codigo: "OPA1-N006",
  }),

  linha({
    montadora: "Ford",
    modelo: "Fiesta",
    motor: "1.6 8v / Zetec Rocam",
    combustivel: "Bicombustível / GNV",
    periodo: "04/11/2008 a 2014",
    codigo: "OPA1-N008",
  }),

  linha({
    montadora: "Ford",
    modelo: "Fiesta",
    motor: "1.6 16v / Sigma",
    combustivel: "Bicombustível / GNV",
    periodo: "2011 a 2019",
    codigo: "OPA1-N006",
  }),

  linha({
    montadora: "Ford",
    modelo: "Fiesta",
    motor: "1.5 16v / Sigma",
    combustivel: "Bicombustível / GNV",
    periodo: "2013 a 2019",
    codigo: "OPA1-N006",
  }),

  linha({
    montadora: "Ford",
    modelo: "Focus",
    motor: "1.6 8v / Zetec Rocam",
    combustivel: "Gasolina / GNV",
    periodo: "2003 a 2007",
    codigo: "OPA1-N006",
  }),

  linha({
    montadora: "Ford",
    modelo: "Focus",
    motor: "1.6 8v / Zetec Rocam",
    combustivel: "Bicombustível / GNV",
    periodo: "2007 a 06/07/2008",
    codigo: "OPA1-N006",
  }),

  linha({
    montadora: "Ford",
    modelo: "Focus",
    motor: "1.6 8v / Zetec Rocam",
    combustivel: "Bicombustível / GNV",
    periodo: "03/11/2008 a 2009",
    codigo: "OPA1-N008",
  }),

  linha({
    montadora: "Ford",
    modelo: "Focus",
    motor: "1.6 16v / Sigma",
    combustivel: "Bicombustível / GNV",
    periodo: "2009 a 2015",
    codigo: "OPA1-N006",
  }),

  linha({
    montadora: "Ford",
    modelo: "Focus",
    motor: "2.0 16v Duratec",
    combustivel: "Gasolina / GNV",
    periodo: "14/03/2005 a 2008",
    codigo: "OPA1-N006",
  }),

  linha({
    montadora: "Ford",
    modelo: "Focus",
    motor: "2.0 16v Duratec",
    combustivel: "Bicombustível / GNV",
    periodo: "2009 a 2013",
    codigo: "OPA1-N006",
  }),

  linha({
    montadora: "Ford",
    modelo: "Focus",
    motor: "2.0 16v Duratec / Injeção direta",
    combustivel: "Bicombustível / GNV",
    periodo: "2013 a 2019",
    codigo: "OPA1-N006",
  }),

  linha({
    montadora: "Ford",
    modelo: "Ka",
    motor: "1.0 8v / Zetec Rocam",
    combustivel: "Gasolina / GNV",
    periodo: "1999 a 2007",
    codigo: "OPA1-N006",
  }),

  linha({
    montadora: "Ford",
    modelo: "Ka",
    motor: "1.0 8v / Zetec Rocam",
    combustivel: "Bicombustível / GNV",
    periodo: "2008 a 02/11/2008",
    codigo: "OPA1-N006",
  }),

  linha({
    montadora: "Ford",
    modelo: "Ka",
    motor: "1.0 8v / Zetec Rocam",
    combustivel: "Bicombustível / GNV",
    periodo: "03/11/2008 a 2013",
    codigo: "OPA1-N008",
  }),

  linha({
    montadora: "Ford",
    modelo: "Ka",
    motor: "1.0 12v TiVCT",
    combustivel: "Bicombustível / GNV",
    periodo: "2014 a 2021",
    codigo: "OPA1-N006",
  }),

  linha({
    montadora: "Ford",
    modelo: "Ka",
    motor: "1.6 8v / Zetec Rocam",
    combustivel: "Gasolina / GNV",
    periodo: "1999 a 2007",
    codigo: "OPA1-N006",
  }),

  linha({
    montadora: "Ford",
    modelo: "Verona",
    motor: "1.8 AP",
    combustivel: "Gasolina / GNV",
    periodo: "1990 a 1992",
    codigo: "OPA1-N007",
  }),

  linha({
    montadora: "Ford",
    modelo: "Verona",
    motor: "1.8 AP EFI",
    combustivel: "Gasolina / GNV",
    periodo: "1993 a 1996",
    codigo: "OPA1-N004",
  }),

  linha({
    montadora: "Ford",
    modelo: "Verona",
    motor: "2.0 AP EFI",
    combustivel: "Gasolina / GNV",
    periodo: "1993 a 1996",
    codigo: "OPA1-N004",
  }),
];

/*
 * ============================================================
 * ANOS
 * ============================================================
 */

function extrairAnos(periodo = "") {
  const texto =
    limparTexto(periodo);

  const anos =
    texto.match(
      /\b(?:19|20)\d{2}\b/g
    ) || [];

  if (!anos.length) {
    return {
      ano_inicio: null,
      ano_fim: null,
    };
  }

  if (
    /^desde\b/i.test(
      texto
    )
  ) {
    return {
      ano_inicio:
        Number(anos[0]),

      ano_fim:
        null,
    };
  }

  if (
    anos.length >= 2
  ) {
    return {
      ano_inicio:
        Number(anos[0]),

      ano_fim:
        Number(
          anos[
            anos.length - 1
          ]
        ),
    };
  }

  return {
    ano_inicio:
      Number(anos[0]),

    ano_fim:
      Number(anos[0]),
  };
}

/*
 * ============================================================
 * MONTAR REGISTRO
 * ============================================================
 */

function criarRegistro({
  item,
  nomeArquivo,
  configuracao,
}) {
  const anos =
    extrairAnos(
      item.periodo
    );

  return {
    peca:
      "Interruptor de pressão de óleo",

    descricao:
      "Interruptor de pressão de óleo NTK",

    codigo_oem:
      normalizarCodigo(
        item.codigo
      ),

    codigo_equivalente:
      "",

    equivalentes:
      [],

    fabricante:
      "NTK",

    montadora:
      item.montadora ||
      null,

    modelo:
      item.modelo ||
      null,

    motor:
      item.motor ||
      null,

    ano_inicio:
      anos.ano_inicio,

    ano_fim:
      anos.ano_fim,

    aplicacao:
      [
        item.montadora,
        item.modelo,
        item.motor,
        item.periodo,
      ]
        .filter(Boolean)
        .join(" | "),

    observacao:
      [
        item.combustivel
          ? `Combustível: ${item.combustivel}`
          : "",

        item.periodo
          ? `Período catálogo: ${item.periodo}`
          : "",
      ]
        .filter(Boolean)
        .join(" | "),

    origem_catalogo:
      configuracao
        ?.origemCatalogo ||
      "Catálogo NTK Interruptores de Pressão de Óleo",

    arquivo_catalogo:
      nomeArquivo ||
      "Catálogo NTK",

    tipo_catalogo:
      "interruptores_pressao_oleo",

    ativo:
      true,

    prioridade:
      1,

    confiabilidade:
      100,
  };
}

function removerDuplicados(
  registros = []
) {
  const mapa =
    new Map();

  for (
    const registro
    of registros
  ) {
    const chave = [
      registro.codigo_oem,
      registro.montadora,
      registro.modelo,
      registro.motor,
      registro.ano_inicio,
      registro.ano_fim,
    ]
      .map(
        (valor) =>
          normalizar(
            valor ?? ""
          )
      )
      .join("|");

    if (
      !mapa.has(chave)
    ) {
      mapa.set(
        chave,
        registro
      );
    }
  }

  return [
    ...mapa.values(),
  ];
}

/*
 * ============================================================
 * PARSER PRINCIPAL
 * ============================================================
 */

export async function parserNgkInterruptoresOleo({
  textoReferencias = "",
  textoAplicacoes = "",
  textoEquivalencias = "",
  nomeArquivo = "",
  configuracao = {},
  onProgresso,
} = {}) {
  onProgresso?.(
    "🛢️ NTK: lendo Interruptores de Pressão de Óleo..."
  );

  const textoCompleto = [
    textoReferencias,
    textoAplicacoes,
    textoEquivalencias,
  ]
    .filter(Boolean)
    .join("\n");

  /*
   * Primeiro usamos exclusivamente
   * a base confirmada da tabela.
   */

  const registros =
    CATALOGO_NTK.map(
      (item) =>
        criarRegistro({
          item,
          nomeArquivo,
          configuracao,
        })
    );

  /*
   * ========================================================
   * SEGURANÇA
   * ========================================================
   *
   * Caso o PDF traga algum código OPA1
   * que ainda não exista na base fixa,
   * criamos somente um registro técnico
   * SEM inventar modelo/motor.
   * ========================================================
   */

  const codigosPdf =
    extrairCodigos(
      textoCompleto
    );

  const codigosBase =
    new Set(
      registros.map(
        (item) =>
          item.codigo_oem
      )
    );

  for (
    const codigo
    of codigosPdf
  ) {
    if (
      codigosBase.has(
        codigo
      )
    ) {
      continue;
    }

    registros.push({
      peca:
        "Interruptor de pressão de óleo",

      descricao:
        "Interruptor de pressão de óleo NTK",

      codigo_oem:
        codigo,

      codigo_equivalente:
        "",

      equivalentes:
        [],

      fabricante:
        "NTK",

      montadora:
        null,

      modelo:
        null,

      motor:
        null,

      ano_inicio:
        null,

      ano_fim:
        null,

      aplicacao:
        "",

      observacao:
        "Código identificado no catálogo NTK; aplicação não vinculada automaticamente.",

      origem_catalogo:
        configuracao
          ?.origemCatalogo ||
        "Catálogo NTK Interruptores de Pressão de Óleo",

      arquivo_catalogo:
        nomeArquivo ||
        "Catálogo NTK",

      tipo_catalogo:
        "interruptores_pressao_oleo",

      ativo:
        true,

      prioridade:
        1,

      confiabilidade:
        90,
    });
  }

  const unicos =
    removerDuplicados(
      registros
    );

  const codigos =
    [
      ...new Set(
        unicos.map(
          (item) =>
            item.codigo_oem
        )
      ),
    ].sort();

  console.log(
    "========================================"
  );

  console.log(
    "🛢️ PARSER NTK INTERRUPTORES DE ÓLEO"
  );

  console.log(
    "Arquivo:",
    nomeArquivo
  );

  console.log(
    "Registros:",
    unicos.length
  );

  console.log(
    "Códigos:",
    codigos
  );

  console.log(
    "OPA1-N003:",
    unicos.filter(
      (item) =>
        item.codigo_oem ===
        "OPA1-N003"
    ).length
  );

  console.log(
    "OPA1-D002:",
    unicos.filter(
      (item) =>
        item.codigo_oem ===
        "OPA1-D002"
    ).length
  );

  console.log(
    "========================================"
  );

  onProgresso?.(
    `✅ NTK Interruptores: ${unicos.length} registro(s) encontrado(s).`
  );

  return unicos;
}

export default parserNgkInterruptoresOleo;