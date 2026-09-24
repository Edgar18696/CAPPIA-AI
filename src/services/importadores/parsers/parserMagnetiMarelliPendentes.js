const MONTADORAS = [
  "ALFA ROMEO",
  "MERCEDES-BENZ",
  "LAND ROVER",
  "ABARTH",
  "CITROEN",
  "CITROËN",
  "VOLKSWAGEN",
  "CHEVROLET",
  "MITSUBISHI",
  "HYUNDAI",
  "RENAULT",
  "PEUGEOT",
  "NISSAN",
  "TOYOTA",
  "HONDA",
  "SUZUKI",
  "SUBARU",
  "JAGUAR",
  "PORSCHE",
  "FERRARI",
  "MASERATI",
  "LANCIA",
  "IVECO",
  "DACIA",
  "DAEWOO",
  "CHRYSLER",
  "JEEP",
  "MINI",
  "SMART",
  "SKODA",
  "ŠKODA",
  "SEAT",
  "OPEL",
  "SAAB",
  "VOLVO",
  "AUDI",
  "BMW",
  "FIAT",
  "FORD",
  "KIA",
  "DS",
  "VW",
];

function limpar(valor = "") {
  return String(valor || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function linhasDe(texto = "") {
  return String(texto || "")
    .split(/\r?\n/)
    .map(limpar)
    .filter(Boolean);
}

function montadoraDe(linha = "") {
  const texto = limpar(linha)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  return (
    MONTADORAS.map((m) => m.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase())
      .sort((a, b) => b.length - a.length)
      .find((m) => texto === m || texto.startsWith(`${m} `)) || ""
  );
}

function soMontadora(linha = "") {
  const texto = limpar(linha)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  return MONTADORAS.map((m) => m.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()).some(
    (m) => texto === m
  );
}

function anosDe(texto = "") {
  const t = limpar(texto);
  let m = t.match(/(\d{2})\/(\d{2})\s*à(?:\s*(\d{2})\/(\d{2}))?/i);
  if (m) {
    const y = (yy) => {
      const n = Number(yy);
      return n <= 30 ? 2000 + n : 1900 + n;
    };
    return { ano_inicio: y(m[2]), ano_fim: m[4] ? y(m[4]) : null };
  }
  m = t.match(/\((\d{4})\s*à\s*(\d{4})\)/);
  if (m) return { ano_inicio: Number(m[1]), ano_fim: Number(m[2]) };
  m = t.match(/\b(19|20)(\d{2})\s*à\s*(19|20)(\d{2})\b/);
  if (m) return { ano_inicio: Number(m[1] + m[2]), ano_fim: Number(m[3] + m[4]) };
  m = t.match(/\b(\d{2})\s*à\s*(\d{2})\b/);
  if (m && Number(m[1]) <= 31 && Number(m[2]) <= 31) {
    const y = (yy) => (Number(yy) <= 30 ? 2000 + Number(yy) : 1900 + Number(yy));
    return { ano_inicio: y(m[1]), ano_fim: y(m[2]) };
  }
  return { ano_inicio: null, ano_fim: null };
}

function ehLixo(linha = "") {
  return /GLOW PLUG|NICKEL PLATINUM|PRODUCT TYPE|Buyers guide|Magneti Marelli Parts|IT-EN |page |Pagina|NUMBER OF CYLINDERS|declina comunque|reproduction/i.test(
    linha
  );
}

function baseRegistro({ peca, codigo, equivalente, montadora, modelo, motor, anos, origem, arquivo, tipo }) {
  return {
    peca,
    codigo_oem: codigo,
    codigo_equivalente: equivalente || null,
    fabricante: "Magneti Marelli",
    origem_catalogo: origem,
    montadora: montadora || null,
    modelo: modelo || null,
    motor: motor || null,
    ano_inicio: anos?.ano_inicio ?? null,
    ano_fim: anos?.ano_fim ?? null,
    arquivo_catalogo: arquivo,
    tipo_catalogo: tipo,
    ativo: true,
    prioridade: 1,
    confiabilidade: 90,
  };
}

export function parseGlow(texto, ctx) {
  const registros = [];
  let montadora = "";
  let modelo = "";
  let cilindrada = "";
  for (const linha of linhasDe(texto)) {
    if (ehLixo(linha) || /^(GLOW|TYPE|CC kW|PLUG V)$/i.test(linha)) continue;
    if (soMontadora(linha)) {
      montadora = limpar(linha).toUpperCase().replace("CITROËN", "CITROEN");
      modelo = "";
      cilindrada = "";
      continue;
    }
    if (/^\d\.\d$/.test(linha)) {
      cilindrada = linha;
      continue;
    }
    const glow = linha.match(
      /^(\d{2,3})\s+(\d{2}\/\d{2}\s*à(?:\s*\d{2}\/\d{2})?)\s+(\d)\s+(.+?)\s+(U[CY][A-Z0-9]{2,6})\s+(ISS|SR)\b/i
    );
    if (glow && montadora) {
      const anos = anosDe(glow[2]);
      registros.push(
        baseRegistro({
          peca: "Vela aquecedora",
          codigo: glow[5].toUpperCase(),
          equivalente: null,
          montadora,
          modelo,
          motor: [cilindrada, glow[4], `${glow[3]} cil.`].filter(Boolean).join(" ").trim(),
          anos,
          ...ctx,
        })
      );
      continue;
    }
    if (montadora && !/^\d/.test(linha) && linha.length > 2 && linha.length < 60 && !/\bU[CY][A-Z0-9]{2,6}\b/i.test(linha)) {
      modelo = linha.replace(/\s+TDi$/i, " TDi").trim();
    }
  }
  return registros;
}

export function parseSpark(texto, ctx) {
  const registros = [];
  let montadora = "";
  let modelo = "";
  const reCod = /\bS[NPI][A-Z]\d{3,5}-\d{1,2}\b/gi;
  for (const linha of linhasDe(texto)) {
    if (ehLixo(linha) || /^kW NICKEL/i.test(linha)) continue;
    if (soMontadora(linha)) {
      montadora = limpar(linha).toUpperCase();
      modelo = "";
      continue;
    }
    const codigos = linha.match(reCod) || [];
    if (codigos.length && montadora) {
      const anos = anosDe(linha);
      const motor = linha
        .replace(reCod, "")
        .replace(/\d{2}\/\d{2}\s*à(?:\s*\d{2}\/\d{2})?/g, "")
        .replace(/\b\d{2,3}\s*$/, "")
        .trim();
      for (const codigo of codigos) {
        registros.push(
          baseRegistro({
            peca: "Vela de ignição",
            codigo: codigo.toUpperCase(),
            equivalente: null,
            montadora,
            modelo,
            motor: motor || null,
            anos,
            ...ctx,
          })
        );
      }
      continue;
    }
    if (montadora && !codigos.length && /\(/.test(linha) && linha.length < 80 && !/^\d{2}\/\d{2}/.test(linha)) {
      modelo = linha;
    }
  }
  return registros;
}

export function parseArms(texto, ctx) {
  const registros = [];
  let montadora = "";
  let modelo = "";
  let anos = { ano_inicio: null, ano_fim: null };
  for (const linha of linhasDe(texto)) {
    if (ehLixo(linha) || /^(OEM|LONG SHORT)$/i.test(linha)) continue;
    if (soMontadora(linha) || linha === "CITROËN") {
      montadora = limpar(linha).toUpperCase().replace("CITROËN", "CITROEN");
      modelo = "";
      continue;
    }
    const y = linha.match(/^(\d{2})\s*à\s*(\d{2})$/);
    if (y) {
      anos = anosDe(linha);
      for (let i = registros.length - 1; i >= 0; i--) {
        if (registros[i].modelo !== modelo) break;
        if (!registros[i].ano_inicio) {
          registros[i].ano_inicio = anos.ano_inicio;
          registros[i].ano_fim = anos.ano_fim;
        }
      }
      continue;
    }
    const m = linha.match(/^(30118\d{7})\s+(ARM\d{3,4})\s+(.+)$/i);
    if (m && montadora) {
      const oes = m[3]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      registros.push(
        baseRegistro({
          peca: "Bandeja / braço oscilante",
          codigo: m[2].toUpperCase(),
          equivalente: oes[0] || m[1],
          montadora,
          modelo,
          motor: null,
          anos,
          ...ctx,
        })
      );
      continue;
    }
    if (montadora && !/^\d/.test(linha) && linha.length < 40) modelo = linha;
  }
  return registros;
}

export function parseSensores(texto, ctx) {
  const registros = [];
  let montadora = "";
  let modelo = "";
  let motor = "";
  let anos = { ano_inicio: null, ano_fim: null };
  const reCod = /\b((?:MWSS|SPA|SAA|SAG|APS|ATS|SPS)[A-Z0-9]*)\b/i;
  for (const linha of linhasDe(texto)) {
    if (ehLixo(linha) || /^kW DESCRIPTION/i.test(linha)) continue;
    if (soMontadora(linha)) {
      montadora = limpar(linha).toUpperCase();
      modelo = "";
      motor = "";
      continue;
    }
    const y = anosDe(linha);
    if (y.ano_inicio) anos = y;
    const mot = linha.match(/^(\d\.\d\b.*?)(?:\s+\d{2,3}\s+\d{2}\/)?/);
    if (/^\d\.\d/.test(linha) && montadora) {
      motor = (linha.match(/^(\d\.\d(?:\s+[A-Z0-9]+)?)/) || [])[1] || "";
    }
    const cm = linha.match(reCod);
    const oe = linha.match(/\bOE\s+([A-Z0-9]+)/i);
    if (cm && montadora && oe) {
      const pecaMatch =
        (linha.match(
          /(Coolant temperature sensor|Oil pressure switches|Crankshaft sensor|Intake pressure sensor|Air temperature sensor|ABS sensor|Exhaust gas pressure sensor|Camshaft sensor|Lambda sensor|Knock sensor)/i
        ) || [])[1] || "Sensor";
      registros.push(
        baseRegistro({
          peca: pecaMatch || "Sensor",
          codigo: cm[1].toUpperCase(),
          equivalente: oe[1].toUpperCase(),
          montadora,
          modelo,
          motor: motor || null,
          anos,
          ...ctx,
        })
      );
      continue;
    }
    if (montadora && /\(/.test(linha) && !reCod.test(linha) && linha.length < 70 && !/\bOE\b/i.test(linha)) {
      modelo = linha;
    }
  }
  return registros;
}

export function parseSwitchgear(texto, ctx) {
  const registros = [];
  let montadora = "";
  let modelo = "";
  let anos = { ano_inicio: null, ano_fim: null };
  for (const linha of linhasDe(texto)) {
    if (ehLixo(linha) || /^(PIN|[a-z]{1,3})$/i.test(linha)) continue;
    if (soMontadora(linha)) {
      montadora = limpar(linha).toUpperCase();
      modelo = "";
      continue;
    }
    const withYears = linha.match(/^(.{3,70}?)\s*\((\d{2}\/\d{2}\s*à(?:\s*\d{2}\/\d{2})?)\)\s*$/);
    if (withYears && montadora && !/^DA\d/i.test(linha)) {
      modelo = withYears[1].trim();
      anos = anosDe(withYears[2]);
      continue;
    }
    const da = linha.match(/^DA(\d{5})\b/i);
    if (da && montadora && modelo) {
      registros.push(
        baseRegistro({
          peca: "Chave / comando",
          codigo: `DA${da[1]}`,
          equivalente: null,
          montadora,
          modelo,
          motor: null,
          anos,
          ...ctx,
        })
      );
    }
  }
  return registros;
}

export function parseLighting(texto, ctx) {
  const registros = [];
  for (const linha of linhasDe(texto)) {
    if (ehLixo(linha)) continue;
    const m = linha.match(
      /^(LL[A-Z]\d{3}|LRB\d{3})\s+(\d{9,14})\s+(.+?)\s+(\d{2}\/\d{2}|20\d{2})\s*à\s*(\d{2}\/\d{2}|20\d{2})?\s*$/i
    );
    if (!m) continue;
    const resto = m[3].trim();
    const mont = montadoraDe(resto);
    if (!mont) continue;
    const modelo = resto.slice(mont.length).trim();
    const anos = anosDe(`${m[4]} à ${m[5] || ""}`);
    registros.push(
      baseRegistro({
        peca: "Iluminação",
        codigo: m[1].toUpperCase(),
        equivalente: m[2],
        montadora: mont.replace("VW", "VOLKSWAGEN"),
        modelo: modelo || null,
        motor: null,
        anos,
        ...ctx,
      })
    );
  }
  return registros;
}

export function parseAirSprings(texto, ctx) {
  const registros = [];
  let produto = "";
  let eq = "";
  for (const linha of linhasDe(texto)) {
    if (ehLixo(linha) || /Applicazione per codice/i.test(linha)) continue;
    const cab = linha.match(/^(\d{4,6}CFG)\s+[–\-]\s+(\d{6,15})$/i);
    if (cab) {
      produto = cab[1].toUpperCase();
      eq = cab[2];
      continue;
    }
    if (!produto) continue;
    if (/^RIMORCHI|TRAILER|BUS /i.test(linha) && linha.length < 20) continue;
    const brand = montadoraDe(linha) || (linha.match(/^([A-Z][A-Z\/]{2,20})\b/) || [])[1];
    if (!brand) continue;
    const modelo = linha.slice(String(brand).length).replace(/RIMORCHI\/TRAILER/i, "").trim();
    registros.push(
      baseRegistro({
        peca: "Mola pneumática",
        codigo: produto,
        equivalente: eq,
        montadora: String(brand).toUpperCase(),
        modelo: modelo || "RIMORCHI/TRAILER",
        motor: null,
        anos: { ano_inicio: null, ano_fim: null },
        ...ctx,
      })
    );
  }
  return registros;
}

export function parseTimingKits(texto, ctx) {
  const registros = [];
  const re = /(\d{12})\s*[–-]\s*(MCK\d{4})/gi;
  let m;
  const vistos = new Set();
  while ((m = re.exec(texto))) {
    const chave = m[2].toUpperCase();
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    registros.push(
      baseRegistro({
        peca: "Kit corrente de distribuição",
        codigo: chave,
        equivalente: m[1],
        montadora: null,
        modelo: null,
        motor: null,
        anos: { ano_inicio: null, ano_fim: null },
        ...ctx,
      })
    );
  }
  return registros;
}

export function parseMirrors(texto, ctx) {
  const registros = [];
  let montadora = "";
  let modelo = "";
  let anos = { ano_inicio: null, ano_fim: null };
  let ultimoLongo = "";
  for (const linha of linhasDe(texto)) {
    if (ehLixo(linha) || /OPPOSITE|FITTING SIDE|PRODUCT TYPE/i.test(linha)) continue;
    if (soMontadora(linha)) {
      montadora = limpar(linha).toUpperCase();
      modelo = "";
      continue;
    }
    const ym = linha.match(/^(.{3,80}?)\s*\((\d{4}\s*à\s*\d{4})\)\s*$/);
    if (ym && montadora && !/^\d{6,}/.test(linha)) {
      modelo = ym[1].trim();
      anos = anosDe(`(${ym[2]})`);
      continue;
    }
    if (/^\d{10,14}$/.test(linha)) {
      ultimoLongo = linha;
      continue;
    }
    const rv = linha.match(/\b((?:RV|SV)\d{4,8})\b/i);
    if (rv && montadora && modelo) {
      registros.push(
        baseRegistro({
          peca: "Retrovisor",
          codigo: rv[1].toUpperCase(),
          equivalente: ultimoLongo || null,
          montadora,
          modelo,
          motor: null,
          anos,
          ...ctx,
        })
      );
    }
  }
  return registros;
}

export function parseWeber(texto, ctx) {
  const registros = [];
  const blocos = String(texto || "").split(/\n(?=[0-9]{2,2}\/[0-9]{2}[A-Z]|^\d{2}[A-Z]{3,})/m);
  const linhas = linhasDe(texto);
  let codigo = "";
  let eq = "";
  let montadora = "";
  for (const linha of linhas) {
    if (/^\d{2}\/\d{2}[A-Z0-9]+$/i.test(linha) || /^\d{2}[A-Z]{3,}\d[A-Z0-9]*$/i.test(linha)) {
      codigo = linha.toUpperCase();
      eq = "";
      montadora = "";
      continue;
    }
    if (/^\d{10,14}$/.test(linha) && codigo) {
      continue;
    }
    if (/^\d{5}\.\d{3}$/.test(linha) && codigo) {
      eq = linha;
      continue;
    }
    const mont = montadoraDe(linha);
    if (mont && codigo) {
      montadora = mont;
      const modelo = linha.slice(mont.length).trim();
      const anos = anosDe(linha);
      registros.push(
        baseRegistro({
          peca: "Carburador Weber",
          codigo,
          equivalente: eq || null,
          montadora,
          modelo: modelo || null,
          motor: modelo || null,
          anos,
          ...ctx,
        })
      );
    }
  }
  void blocos;
  return registros;
}

export function parsearCatalogoPendente(tipo, texto, ctx) {
  switch (tipo) {
    case "velas_aquecedoras":
      return parseGlow(texto, ctx);
    case "velas_ignicao":
      return parseSpark(texto, ctx);
    case "bandejas":
      return parseArms(texto, ctx);
    case "sensores":
      return parseSensores(texto, ctx);
    case "switchgear":
      return parseSwitchgear(texto, ctx);
    case "iluminacao":
    case "iluminacao_rhd":
      return parseLighting(texto, ctx);
    case "air_springs":
      return parseAirSprings(texto, ctx);
    case "kits_corrente":
      return parseTimingKits(texto, ctx);
    case "espelhos":
      return parseMirrors(texto, ctx);
    case "carburadores":
      return parseWeber(texto, ctx);
    default:
      return [];
  }
}
