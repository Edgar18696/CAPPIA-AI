// =============================================================
// PAIIA — Aplicações escritas na DESCRIÇÃO de um anúncio MANUAL (19/10/2026).
//
// No anúncio manual o usuário já pesquisou as aplicações antes de escrever a
// descrição: ela é a fonte autorizada. Este serviço só LÊ o que está escrito
// (montadora, modelo, motor, versão, anos). Não completa, não amplia e não
// troca nada: linha que não dá para ler com segurança fica listada como
// "não interpretada" (nada é descartado em silêncio).
//
// Formatos aceitos (uma aplicação por linha, ou na mesma linha após
// "Aplicação:"; vários modelos separados por "/" ou "," compartilham motor
// e anos):
//   Aplicação: Renault Clio II 1.6 16V 2009 a 2016
//   Renault Logan / Sandero 1.6 8V 2008 até 2014
//   RENAULT            (cabeçalho)   •  Clio 1.0 16V 2003-2012
//   VW Gol G5 1.0 a partir de 2009      Fiat Palio 1.0 2012
// =============================================================

const MONTADORAS = [
  ["Renault", ["renault"]],
  ["Volkswagen", ["volkswagen", "vw"]],
  ["Chevrolet", ["chevrolet", "gm"]],
  ["Fiat", ["fiat"]],
  ["Ford", ["ford"]],
  ["Peugeot", ["peugeot"]],
  ["Citroën", ["citroen"]],
  ["Toyota", ["toyota"]],
  ["Honda", ["honda"]],
  ["Hyundai", ["hyundai"]],
  ["Kia", ["kia"]],
  ["Nissan", ["nissan"]],
  ["Mitsubishi", ["mitsubishi"]],
  ["Jeep", ["jeep"]],
  ["Dodge", ["dodge"]],
  ["RAM", ["ram"]],
  ["Chrysler", ["chrysler"]],
  ["BMW", ["bmw"]],
  ["Audi", ["audi"]],
  ["Mercedes-Benz", ["mercedes-benz", "mercedes benz", "mercedes"]],
  ["Volvo", ["volvo"]],
  ["Subaru", ["subaru"]],
  ["Suzuki", ["suzuki"]],
  ["JAC", ["jac"]],
  ["Chery", ["chery", "caoa chery"]],
  ["Land Rover", ["land rover"]],
  ["Troller", ["troller"]],
  ["Iveco", ["iveco"]],
  ["Mini", ["mini"]],
  ["Smart", ["smart"]],
  ["Lifan", ["lifan"]],
  ["Effa", ["effa"]],
];
const CARROCERIAS = new Set(["hatch", "sedan", "sedã", "sw", "wagon", "perua", "furgao", "furgão", "cabine", "dupla", "simples", "coupe", "cupe", "conversivel", "van", "pickup", "pick-up"]);
const RUIDO = new Set(["original", "novo", "nova", "compativel", "compatível", "com", "para", "p/", "modelos", "modelo", "veiculos", "veículos", "carros", "linha"]);

const limpar = (v) => String(v ?? "").replace(/�/g, "").replace(/\s+/g, " ").trim();
const norm = (v) => limpar(v).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function montadoraNoInicio(texto) {
  const t = norm(texto);
  for (const [nome, apelidos] of MONTADORAS) {
    for (const a of apelidos) {
      if (t === a || t.startsWith(a + " ")) return { nome, resto: limpar(texto).slice(a.length).trim() };
    }
  }
  return null;
}

// Anos: "2009 a 2016", "2009 até 2016", "2009-2016", "2009/2016",
// "a partir de 2009", "até 2016", ou um ano só. Devolve o texto sem os anos.
function lerAnos(texto) {
  const t = limpar(texto);
  let m = t.match(/\b(19[5-9]\d|20[0-4]\d)\s*(?:a|à|ate|até|-|–|—|\/|ao)\s*(19[5-9]\d|20[0-4]\d)\b/i);
  if (m) {
    const a = Number(m[1]), b = Number(m[2]);
    if (a > b) return { erro: `anos invertidos (${m[0]})` };
    return { anoInicio: a, anoFim: b, resto: limpar(t.replace(m[0], " ")) };
  }
  m = t.match(/\b(?:a\s+partir\s+de|desde)\s+(19[5-9]\d|20[0-4]\d)\b/i);
  if (m) return { anoInicio: Number(m[1]), anoFim: null, resto: limpar(t.replace(m[0], " ")) };
  m = t.match(/\b(?:at[eé])\s+(19[5-9]\d|20[0-4]\d)\b/i);
  if (m) return { anoInicio: null, anoFim: Number(m[1]), resto: limpar(t.replace(m[0], " ")) };
  const todos = t.match(/\b(19[5-9]\d|20[0-4]\d)\b/g) || [];
  if (todos.length === 1) return { anoInicio: Number(todos[0]), anoFim: Number(todos[0]), resto: limpar(t.replace(todos[0], " ")) };
  if (todos.length > 1) return { erro: "vários anos soltos (escreva o período como 2009 a 2016)" };
  return { anoInicio: null, anoFim: null, resto: t };
}

// Motor: "1.6", "1.6 16V", "2.0 Turbo", "1.0 8V Flex"... Só o que está escrito.
function lerMotor(texto) {
  const t = limpar(texto).replace(/(\d),(\d)/g, "$1.$2");
  const m = t.match(/\b(\d\.\d)\s*(?:(\d{1,2})\s*v\b)?(\s*turbo\b)?/i);
  let motor = "";
  let resto = t;
  if (m) {
    motor = [m[1], m[2] ? `${m[2]}V` : "", m[3] ? "Turbo" : ""].filter(Boolean).join(" ");
    resto = limpar(t.slice(0, m.index) + " | " + t.slice(m.index + m[0].length));
  } else {
    const v = t.match(/\b(8|12|16|20|24)\s*v\b/i);
    if (v) {
      motor = `${v[1]}V`;
      resto = limpar(t.slice(0, v.index) + " | " + t.slice(v.index + v[0].length));
    }
  }
  return { motor, resto };
}

function separarModelos(texto) {
  return limpar(texto).split(/\s*(?:\/|,|;|\be\b)\s*/i).map(limpar).filter(Boolean);
}

/** Lê uma linha "Montadora Modelo(s) motor versão anos". Nunca inventa. */
export function lerLinhaAplicacao(linhaBruta, montadoraAtual = "") {
  let linha = limpar(linhaBruta).replace(/^[•\-*–>]+\s*/, "").replace(/^(aplica[cç](?:[aã]o|[oõ]es)|compat[ií]vel com|compatibilidade|serve (?:no|na|nos|nas|para))\s*:?\s*/i, "");
  linha = limpar(linha.replace(/[.;]+$/, ""));
  if (!linha) return { vazia: true };
  const mont = montadoraNoInicio(linha);
  const montadora = mont?.nome || montadoraAtual;
  const semMontadora = mont ? mont.resto : linha;
  if (!montadora) return { naoLida: true, motivo: "montadora não identificada" };
  const anos = lerAnos(semMontadora);
  if (anos.erro) return { naoLida: true, motivo: anos.erro };
  const motor = lerMotor(anos.resto);
  // Antes do motor: modelo(s) e carroceria; depois do motor: versão.
  const [antes, depois = ""] = motor.resto.split("|");
  const palavras = limpar(antes).split(" ").filter(Boolean);
  const carroceria = [];
  const modeloPalavras = [];
  for (const p of palavras) {
    const n = norm(p);
    if (RUIDO.has(n)) continue;
    if (CARROCERIAS.has(n) && modeloPalavras.length) carroceria.push(p);
    else modeloPalavras.push(p);
  }
  const versao = limpar([...carroceria, ...limpar(depois).split(" ").filter((p) => !RUIDO.has(norm(p)) && !/^(flex|gasolina|alcool|álcool|etanol|diesel|mpfi|mpi|8v|16v)$/i.test(p))].join(" "));
  const modelos = separarModelos(modeloPalavras.join(" "));
  if (!modelos.length) {
    return mont && !anos.anoInicio && !anos.anoFim && !motor.motor ? { cabecalho: montadora } : { naoLida: true, motivo: "modelo não identificado" };
  }
  if (modelos.some((m) => !/[a-z]/i.test(m) || m.length > 30)) return { naoLida: true, motivo: "modelo não identificado com segurança" };
  return {
    aplicacoes: modelos.map((modelo) => ({
      montadora,
      modelo,
      motor: motor.motor,
      versao,
      anoInicio: anos.anoInicio,
      anoFim: anos.anoFim,
    })),
  };
}

/**
 * Aplicações da descrição de um anúncio MANUAL.
 * Lê as linhas da seção de aplicação (depois de "Aplicação:", "Compatível
 * com", "Aplicações", ou cabeçalho de montadora) até a próxima seção.
 * Devolve { detalhadas, modelos (sem motor/ano), naoLidas:[{linha,motivo}], lidas }.
 */
export function extrairAplicacoesDaDescricao(texto) {
  const linhas = String(texto || "").split(/\r?\n/);
  const detalhadas = [];
  const modelos = [];
  const naoLidas = [];
  let naSecao = false;
  let montadora = "";
  let lidas = 0;
  const meioSecao = /\b(aplica[cç](?:[aã]o|[oõ]es)|compat[ií]vel com)\s*:\s*(.+)$/i;
  const inicioSecao = /^\s*(aplica[cç](?:[aã]o|[oõ]es)|compat[ií]vel com|compatibilidades?|ve[ií]culos compat[ií]veis|serve (?:no|na|nos|nas|para))\s*:?/i;
  const outraSecao = /^\s*(c[oó]digo|refer[eê]ncia|especifica|caracter[ií]stica|garantia|aten[cç][aã]o|observa|conte[uú]do|itens|medidas|peso|marca|condi[cç][aã]o|envio|frete|d[uú]vidas|importante|produto)\b/i;
  for (const bruta of linhas) {
    const linha = limpar(bruta);
    if (!linha) { if (naSecao && lidas) naSecao = false; continue; }
    if (inicioSecao.test(linha)) {
      naSecao = true;
      montadora = "";
      const resto = limpar(linha.replace(inicioSecao, ""));
      if (!resto) continue;
      processar(resto);
      continue;
    }
    if (!naSecao) {
      // "... Aplicação: Renault Clio 1.6 2009 a 2016" no meio da linha.
      const m = linha.match(meioSecao);
      if (m) { montadora = ""; processar(m[2]); }
      continue;
    }
    if (outraSecao.test(linha)) { naSecao = false; continue; }
    processar(linha);
  }
  function processar(linha) {
    const r = lerLinhaAplicacao(linha, montadora);
    if (r.vazia) return;
    if (r.cabecalho) { montadora = r.cabecalho; return; }
    if (r.naoLida) { naoLidas.push({ linha, motivo: r.motivo }); return; }
    if (montadoraNoInicio(linha)) montadora = r.aplicacoes[0].montadora;
    lidas += 1;
    for (const a of r.aplicacoes) {
      if (!a.motor && !a.anoInicio && !a.anoFim) modelos.push({ montadora: a.montadora, modelo: a.modelo });
      else detalhadas.push(a);
    }
  }
  const unicos = (lista, chave) => lista.filter((a, i) => lista.findIndex((b) => chave(b) === chave(a)) === i);
  return {
    detalhadas: unicos(detalhadas, (a) => norm([a.montadora, a.modelo, a.motor, a.versao, a.anoInicio, a.anoFim].join("|"))),
    modelos: unicos(modelos, (a) => norm(`${a.montadora}|${a.modelo}`)),
    naoLidas,
  };
}

/** Assinatura da descrição (para saber se as aplicações já foram lidas desta descrição). */
export function assinaturaDescricao(texto) {
  return norm(texto).replace(/\s+/g, " ");
}
