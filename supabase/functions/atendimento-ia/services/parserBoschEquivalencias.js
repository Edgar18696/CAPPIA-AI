export function parserBoschEquivalencias(texto) {
  const linhas = texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const equivalencias = [];

  let codigoBosch = null;

  function limparCodigo(valor) {
    return String(valor || "")
      .replace(/\s/g, "")
      .replace(/[^\dA-Za-z]/g, "");
  }

  for (const linha of linhas) {
    const codigo = limparCodigo(linha);

    // Código Bosch
    if (/^0?258\d{6}$/.test(codigo)) {
      codigoBosch = codigo;
      continue;
    }

    if (!codigoBosch) continue;

    // NGK
    if (/^(OZA|LZA|ILK|PFR|BKR|ZFR)/i.test(codigo)) {
      equivalencias.push({
        codigo_bosch: codigoBosch,
        fabricante: "NGK",
        codigo_equivalente: codigo,
      });
      continue;
    }

    // NTK
    if (/^(OT|OZT|OZA)/i.test(codigo)) {
      equivalencias.push({
        codigo_bosch: codigoBosch,
        fabricante: "NTK",
        codigo_equivalente: codigo,
      });
      continue;
    }

    // Denso
    if (/^(DOX|234|PK)/i.test(codigo)) {
      equivalencias.push({
        codigo_bosch: codigoBosch,
        fabricante: "Denso",
        codigo_equivalente: codigo,
      });
      continue;
    }

    // Delphi
    if (/^(ES|AS|TS)/i.test(codigo)) {
      equivalencias.push({
        codigo_bosch: codigoBosch,
        fabricante: "Delphi",
        codigo_equivalente: codigo,
      });
      continue;
    }

    // OEM numérico
    if (/^\d{6,15}$/.test(codigo)) {
      equivalencias.push({
        codigo_bosch: codigoBosch,
        fabricante: "OEM",
        codigo_equivalente: codigo,
      });
    }
  }

  return equivalencias;
}