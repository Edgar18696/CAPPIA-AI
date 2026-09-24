// Banner Express — regras de texto (puras, testáveis em Node).

// Preço só é reconhecido no texto quando vem com "R$" ou "por 99,90".
// Assim "Kit 3 peças" ou "2.0 16v" não viram preço.
export function extrairPrecoDoTexto(texto = "") {
  const original = String(texto || "");
  const encontrado =
    original.match(/r\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)/i) ||
    original.match(/\bpor\s+(?:apenas\s+)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})\b/i);

  if (!encontrado?.[1]) {
    return "";
  }

  return formatarPrecoBanner(encontrado[1]);
}

export function formatarPrecoBanner(valor = "") {
  const texto = String(valor || "").trim();

  if (!texto) {
    return "";
  }

  const semMoeda = texto.replace(/^r\$\s*/i, "").trim();

  if (!/\d/.test(semMoeda)) {
    return "";
  }

  let numero = semMoeda;
  if (!numero.includes(",") && /^\d+\.\d{1,2}$/.test(numero)) {
    numero = numero.replace(".", ",");
  }
  if (/^\d+,\d$/.test(numero)) {
    numero = `${numero}0`;
  }

  return `R$ ${numero}`;
}

// Formato citado explicitamente no texto (senão mantém o escolhido).
export function formatoCitadoNoTexto(texto = "") {
  const pedido = String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (/\b(story|stories|reels|vertical)\b/.test(pedido)) return "story";
  if (/\bstatus\b|whatsapp status/.test(pedido)) return "whatsapp";
  if (/\bquadrado\b|1080x1080/.test(pedido)) return "quadrado";
  if (/\bfacebook\b/.test(pedido)) return "facebook";
  if (/\bfeed\b|\binstagram\b/.test(pedido)) return "instagram";
  return "";
}

// Parâmetros da arte (para reabrir/editar e exportar por canal).
export function assinaturaArteBanner(parametros = {}) {
  return JSON.stringify([
    parametros.formato,
    parametros.paleta,
    parametros.objetivo,
    parametros.imagem,
    parametros.preco,
    parametros.removerFundo,
    parametros.marca?.nome,
    parametros.marca?.logo ? String(parametros.marca.logo).length : 0,
    parametros.marca?.telefone,
    parametros.marca?.email,
    parametros.marca?.site,
    parametros.marca?.endereco,
    parametros.codigo || "",
    JSON.stringify(parametros.exibir || {}),
    parametros.chamadaMl || "",
    JSON.stringify(parametros.diferenciais || []),
  ]);
}
