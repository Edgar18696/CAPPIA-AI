/*
 * Parser geométrico — Magneti Marelli Electronic Systems and Ignition 2020
 * TYPE no mesmo Y da linha de aplicação. N aplicações por TYPE. Sem OTHER.
 */

const ORIGEM =
  "Catálogo Magneti Marelli Electronic Systems and Ignition 2020";

const MONTADORAS = new Set([
  "ABARTH","ALFA ROMEO","AUDI","BMW","CHEVROLET","CHRYSLER","CITROEN","CITROËN",
  "DACIA","FIAT","FORD","HONDA","HYUNDAI","IVECO","JEEP","KIA","LANCIA",
  "MERCEDES","MERCEDES-BENZ","MINI","NISSAN","OPEL","PEUGEOT","PORSCHE",
  "RENAULT","SAAB","SEAT","SKODA","SSANGYONG","SUZUKI","TOYOTA","VOLKSWAGEN",
  "VOLVO","VW","LAND ROVER","JAGUAR","MITSUBISHI","MAZDA","SUBARU","SMART",
  "VAUXHALL",
]);

const PAGINA_APP_INI = 15;
const PAGINA_APP_FIM = 1250;
const PAGINA_XREF_INI = 2200;

function norm(t = "") {
  return String(t || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function compact(t) {
  return String(t || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function ehMontadoraMm2020(t) {
  const n = norm(t);
  if (n === "VW") return "VOLKSWAGEN";
  if (n === "MERCEDES") return "MERCEDES-BENZ";
  if (n === "CITROEN") return "CITROEN";
  if (MONTADORAS.has(n)) return n;
  return "";
}

const PREFIXO_TIPO =
  /^(?:IWP|IWD|IHP|IPM|FEI|TB|PAS|SVF|SAG|SPA|IAW|MJD|KIT|AMM)[A-Z0-9]+$/i;

function ehCodigoTipo(t) {
  const c = compact(t);
  return PREFIXO_TIPO.test(c) || /^B\d{3,4}$/i.test(c);
}

export function ehTokenTipoMm2020(texto) {
  const t = String(texto || "").trim();
  if (!t || /\s/.test(t)) return false;
  if (/^\d+\.\d+/.test(t)) return false;
  if (/[(),]/.test(t)) return false;
  if (
    /HDI|TDI|JTD|VTI|DTI|CDTI|VR6|HGT|MPI|TURBO|PETROL|DIESEL|4MOTION|BIOFLEX/i.test(
      t
    )
  ) {
    return false;
  }
  const c = compact(t);
  if (c.length < 4 || c.length > 18) return false;
  if (/^B\d{1,2}$/i.test(c)) return false;
  if (PREFIXO_TIPO.test(c) || /^KITEC/i.test(c) || /^B\d{3,4}$/i.test(c)) {
    return true;
  }
  if (/^\d{2}[A-Z]{2,6}\d+[A-Z0-9]*$/i.test(c) && !/^\d{10,}/.test(c)) {
    return true;
  }
  return false;
}

export function ehModeloMm2020(t) {
  const s = String(t || "").trim();
  if (!s || ehMontadoraMm2020(s)) return false;
  if (/applied\s+to\s+cylinder/i.test(s)) return false;
  if (/^(?:KW|TYPE|GROUP|GRUPPO|CHASSIS:|ENGINE:)/i.test(s)) return false;
  if (/TYPE TYPE/i.test(s)) return false;
  if (/^\d{1,4}$/.test(s)) return false;
  if (/\b(?:PETROL|DIESEL|BENZINA|GASOLINE)\b/i.test(s)) return false;
  if (ehCodigoTipo(s) || ehTokenTipoMm2020(s)) return false;
  if (/^\d+\.\d+/.test(s)) return false;
  const letras = (s.match(/[A-Za-zÀ-ÿ]/g) || []).length;
  if (letras < 2 && !/^\d{2,4}\s*\(/.test(s)) return false;
  const soLixo = s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]/g, "");
  if (!soLixo || /^(a)+$/i.test(soLixo) && s.length <= 8) return false;
  if (/^[A-Z0-9-]+$/.test(s) && /\d/.test(s) && !s.includes("(")) return false;
  if ((s.match(/\b[A-Za-zÀ-ÿ]\b/g) || []).length >= 3) return false;
  if (/^[A-Z0-9]+(?:-[A-Z0-9]+){1,}$/.test(s) && !/\s/.test(s)) return false;
  if (/^[A-Z0-9]{8,}$/.test(s)) return false;
  if (/^\d{2,4}\b/.test(s) && s.includes("(") && s.length <= 48 && s.split(/\s+/).length <= 8) {
    return true;
  }
  if (s.includes("(") && s.includes(")") && /[A-Za-zÀ-ÿ]/.test(s) && s.split(/\s+/).length <= 10) {
    return true;
  }
  return /[A-Za-zÀ-ÿ]/.test(s) && s.split(/\s+/).length <= 8 && !/^\d/.test(s);
}

function ehLinhaAplicacao(t) {
  return /\b(?:PETROL|DIESEL|BENZINA|GASOLINE|CNG|LPG|ETHANOL)\b/i.test(t);
}

function motorDe(t) {
  if (/applied\s+to\s+cylinder/i.test(t)) return null;
  const m = t.match(/^(.*?)(?=\b(?:PETROL|DIESEL|BENZINA|GASOLINE|CNG|LPG|ETHANOL)\b)/i);
  const v = (m ? m[1] : "")
    .replace(/\b\d{2}\/\d{2}\b.*$/g, "")
    .replace(/^ENGINE:\s*/i, "")
    .replace(/^[^\w.]+/, "")
    .trim();
  return v || null;
}

function periodoDe(t) {
  const datas = [...String(t).matchAll(/\b(\d{2}\/\d{2})\b/g)].map((x) => x[1]);
  return { inicio: datas[0] || null, fim: datas[1] || null };
}

function anoCheio(mmYY) {
  if (!mmYY || !/^\d{2}\/\d{2}$/.test(mmYY)) return null;
  const yy = Number(mmYY.slice(3));
  if (Number.isNaN(yy)) return null;
  return yy >= 70 ? 1900 + yy : 2000 + yy;
}

function observacaoDe(t) {
  const partes = [];
  const cyl = String(t).match(/Applied to cylinders?:?\s*[0-9,\s]+/i);
  if (cyl) partes.push(cyl[0].replace(/\s+/g, " ").trim());
  const eng = String(t).match(/ENGINE:\s*[A-Z0-9,.\s/_-]+/i);
  if (eng) {
    const limpo = eng[0]
      .replace(/\s+(?:IWP|IWD|FEI|TB|PAS)\d\S*$/i, "")
      .replace(/\s+B\d\S*$/i, "")
      .replace(/\s+[A-Z0-9]{3,}\d\s*$/i, "")
      .replace(/\s+/g, " ")
      .trim();
    if (/ENGINE:\s*\S/i.test(limpo)) partes.push(limpo);
  }
  const ch = String(t).match(/CHASSIS:\s*[A-Z0-9,.\s/_-→\uF0E0]+/i);
  if (ch) {
    const limpo = ch[0]
      .replace(/\s+(?:IWP|IWD|FEI|TB|PAS|B)\d\S*$/i, "")
      .replace(/\s+/g, " ")
      .trim();
    if (/CHASSIS:\s*\S/i.test(limpo)) partes.push(limpo);
  }
  return partes.join(" | ") || null;
}

export function identificarPecaMm2020(tipo = "") {
  const codigo = compact(tipo);
  if (/^TB\d/.test(codigo) || /^48CPD/.test(codigo)) return "Corpo de Borboleta";
  if (/^(?:FEI|IPM|IWP)/.test(codigo)) return "Injetor de Combustível";
  if (/^(?:IAW|MJD)/.test(codigo)) return "Módulo de Injeção";
  if (/^PAS\d/.test(codigo)) return "Sensor do Pedal do Acelerador";
  if (/^B\d{3,4}$/.test(codigo)) return "Atuador de Marcha Lenta";
  return "Sistema Eletrônico";
}

function linhasDe(itens) {
  const mapa = new Map();
  for (const item of itens) {
    const y = Math.round(item.y);
    if (!mapa.has(y)) mapa.set(y, []);
    mapa.get(y).push(item);
  }
  return [...mapa.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([y, pedacos]) => {
      const ord = pedacos.sort((a, b) => a.x - b.x);
      return {
        y,
        texto: ord.map((p) => p.texto).join(" ").replace(/\s+/g, " ").trim(),
        itens: ord,
      };
    });
}

function cabecalhos(linhas, seed = { montadora: "", modelo: "" }) {
  let montadora = seed.montadora || "";
  let modelo = seed.modelo || "";
  return linhas.map((l) => {
    const m = ehMontadoraMm2020(l.texto);
    if (m) {
      montadora = m;
      modelo = "";
    } else if (ehModeloMm2020(l.texto) && montadora) {
      modelo = l.texto;
    }
    return { ...l, montadora, modelo };
  });
}

function ultimoCabecalho(ctx) {
  const last = [...ctx].reverse().find((l) => l.montadora);
  return last
    ? { montadora: last.montadora, modelo: last.modelo }
    : { montadora: "", modelo: "" };
}

function paginaSoTipo(linhas) {
  const topo = linhas.slice(0, 8).map((l) => l.texto).join(" ");
  return /TYPE/i.test(topo) && !linhas.some((l) => ehMontadoraMm2020(l.texto));
}

function linhaMaisProxima(linhas, y, maxDist = 16) {
  let best = null;
  let dist = 9999;
  for (const l of linhas) {
    if (!ehLinhaAplicacao(l.texto)) continue;
    const d = Math.abs(l.y - y);
    if (d < dist) {
      dist = d;
      best = l;
    }
  }
  return dist <= maxDist ? best : null;
}

function chaveApp(a) {
  return [
    compact(a.codigo_oem),
    a.peca || "",
    a.codigo_equivalente || "",
    a.montadora || "",
    a.modelo || "",
    a.motor || "",
    a.ano_inicio ?? "",
    a.ano_fim ?? "",
    a.fabricante || "",
    a.origem_catalogo || "",
  ].join("|");
}

async function paginaItens(doc, cache, n) {
  if (cache.has(n)) return cache.get(n);
  if (n < 1 || n > doc.numPages) {
    cache.set(n, []);
    return [];
  }
  const page = await doc.getPage(n);
  const tc = await page.getTextContent();
  const itens = (tc.items || [])
    .map((item) => {
      const tr = item.transform || [];
      return {
        texto: String(item.str || "").replace(/\u00a0/g, " ").trim(),
        x: Number(tr[4]) || 0,
        y: Number(tr[5]) || 0,
      };
    })
    .filter((i) => i.texto);
  cache.set(n, itens);
  return itens;
}

function montarRegistro({ tipo, app, usarPrev, hit, oemPorTipo }) {
  const per = periodoDe(app.texto);
  const modelo = app.modelo || null;
  const montadora = app.montadora || null;
  const oems = oemPorTipo.get(compact(tipo)) || [];
  const codigoOem = tipo;
  const equivalentes = [...new Set([tipo, ...oems])].filter(
    (c) => compact(c) !== compact(codigoOem)
  );
  return {
    peca: identificarPecaMm2020(tipo),
    descricao: identificarPecaMm2020(tipo),
    codigo_oem: codigoOem,
    codigo_equivalente: equivalentes.length ? equivalentes.join(", ") : tipo,
    equivalentes,
    fabricante: "Magneti Marelli",
    montadora,
    modelo,
    motor: motorDe(app.texto),
    ano_inicio: anoCheio(per.inicio),
    ano_fim: anoCheio(per.fim),
    observacao: observacaoDe(app.texto),
    aplicacao: app.texto,
    origem_catalogo: ORIGEM,
    arquivo_catalogo: "Parts_Electronic systems and ignition_EN.pdf",
    tipo_catalogo: "sistemas_eletronicos",
    ativo: true,
    _type: tipo,
    _pagina: usarPrev ? hit.pagina - 1 : hit.pagina,
  };
}

export async function parsearMm2020Geometrico(doc, onProgresso) {
  const cache = new Map();
  const fimApp = Math.min(PAGINA_APP_FIM, doc.numPages);
  const hits = [];

  for (let n = PAGINA_APP_INI; n <= fimApp; n++) {
    const itens = await paginaItens(doc, cache, n);
    for (const item of itens) {
      if (ehTokenTipoMm2020(item.texto)) {
        hits.push({ pagina: n, ...item });
      }
    }
    if (n % 200 === 0) onProgresso?.(`scan aplicações p.${n}`);
  }

  const oemPorTipo = new Map();
  if (doc.numPages >= PAGINA_XREF_INI) {
    for (let n = PAGINA_XREF_INI; n <= doc.numPages; n++) {
      const itens = await paginaItens(doc, cache, n);
      const ord = [...itens].sort((a, b) => b.y - a.y || a.x - b.x);
      for (let i = 0; i < ord.length; i++) {
        if (!ehTokenTipoMm2020(ord[i].texto)) continue;
        const tipo = ord[i].texto.trim();
        const chave = compact(tipo);
        if (!oemPorTipo.has(chave)) oemPorTipo.set(chave, []);
        for (let j = Math.max(0, i - 3); j <= Math.min(ord.length - 1, i + 3); j++) {
          const viz = compact(ord[j].texto);
          if (/^\d{10,14}$/.test(viz) && viz !== chave) {
            oemPorTipo.get(chave).push(ord[j].texto.trim());
          }
        }
      }
    }
  }

  const registros = [];

  for (const hit of hits) {
    const itensEsq = await paginaItens(doc, cache, hit.pagina);
    const itensPrev = await paginaItens(doc, cache, hit.pagina - 1);
    const itensPrev2 = await paginaItens(doc, cache, hit.pagina - 2);
    const linEsq = linhasDe(itensEsq);
    if (hit.pagina >= PAGINA_XREF_INI) continue;
    const ctxPrev2 = cabecalhos(linhasDe(itensPrev2));
    const ctxPrev = cabecalhos(linhasDe(itensPrev), ultimoCabecalho(ctxPrev2));
    const ctxEsq = cabecalhos(linEsq, ultimoCabecalho(ctxPrev));
    const soTipo = paginaSoTipo(linEsq);
    const usarPrev = soTipo;
    const mesma = linhaMaisProxima(ctxEsq, hit.y);
    const prev = linhaMaisProxima(ctxPrev, hit.y);
    const app = usarPrev ? prev || mesma : mesma || prev;
    if (!app || !ehLinhaAplicacao(app.texto)) continue;
    if (!app.montadora && !app.modelo) continue;
    const tipo = hit.texto.trim();
    registros.push(montarRegistro({ tipo, app, usarPrev, hit, oemPorTipo }));
  }

  const vistos = new Set();
  const unicos = [];
  for (const r of registros) {
    const k = chaveApp(r);
    if (vistos.has(k)) continue;
    vistos.add(k);
    unicos.push(r);
  }

  return unicos.map(({ _type, _pagina, ...row }) => {
    const modelo = row.modelo && !/^other/i.test(row.modelo) ? row.modelo : null;
    const motor =
      row.motor && !/applied\s+to\s+cylinder/i.test(row.motor) ? row.motor : null;
    const modeloLimpo =
      modelo && !/applied\s+to\s+cylinder/i.test(modelo) ? modelo : null;
    return {
      ...row,
      modelo: modeloLimpo,
      motor,
    };
  });
}

export const ORIGEM_MM2020 = ORIGEM;
