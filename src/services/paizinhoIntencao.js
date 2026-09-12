function normalizar(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function inferirPedidoPaizinho(
  frase,
  { mascoteOficial, logoOficial } = {}
) {
  const original = String(frase || "").trim();
  const t = normalizar(original);

  const querMascote = /\b(mascote|personagem|mascot)\b/.test(
    t
  );
  const querLogo = /\b(logo|logotipo|logomarca)\b/.test(t);
  const querClip =
    /\b(clip|video|reels|shorts|filme|comercial)\b/.test(
      t
    ) &&
    !querMascote &&
    !querLogo;

  let tipo = "mascote";

  if (querMascote) {
    tipo = "mascote";
  } else if (querLogo) {
    tipo = "logo";
  } else if (querClip) {
    tipo = "clip";
  }

  const marcaMatch =
    original.match(
      /(?:minha marca|marca|empresa)\s+([A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9&._-]*)/i
    ) ||
    original.match(
      /\b(?:da|do|para a|para o)\s+([A-ZÁÉÍÓÚÂÊÔÃÕ][A-Za-zÀ-ÿ0-9&._-]*)/
    );

  const coresMatch = original.match(
    /cores?\s+([^.]{3,80})/i
  );

  const empresa =
    marcaMatch?.[1] ||
    mascoteOficial?.empresa ||
    logoOficial?.empresa ||
    "";

  const descricao =
    original ||
    (tipo === "logo"
      ? "Logo profissional da marca, limpo e memorável."
      : "Mascote da marca, moderno e memorável para autopeças.");

  return {
    tipo,
    empresa,
    nome: mascoteOficial?.nome || "",
    descricao,
    cores:
      coresMatch?.[1]?.trim() ||
      mascoteOficial?.cores ||
      logoOficial?.cores ||
      "",
    estilo: mascoteOficial?.estilo_visual || "",
  };
}
