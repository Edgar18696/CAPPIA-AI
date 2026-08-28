
import { parserMagnetiSensores } from "./parserMagnetiSensores";

function limparTexto(valor = "") {
  return String(valor || "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizarCodigo(valor = "") {
  return limparTexto(valor)
    .replace(/\s/g, "")
    .toUpperCase();
}

function identificarCodigo(linha = "") {
  const candidatos =
    String(linha).match(
      /\b[A-Z0-9][A-Z0-9.\-]{4,24}\b/g
    ) || [];

  return candidatos.find((codigo) =>
    /\d/.test(codigo)
  );
}

export async function parserMagnetiMarelli({
  textoAplicacoes = "",
  nomeArquivo = "",
  configuracao = {},
  onProgresso,
}) {
  const tipoCatalogo =
    configuracao?.tipoCatalogo ||
    "catalogo_geral";
if (tipoCatalogo === "sensores") {
  return parserMagnetiSensores({
    textoAplicacoes,
    nomeArquivo,
    configuracao,
    onProgresso,
  });
}
  onProgresso?.(
    "🔎 Analisando linhas do catálogo Magneti Marelli..."
  );

  switch (tipoCatalogo) {
    case "sensores":
      onProgresso?.(
        "📗 Parser Magneti: Sensores"
      );
      break;

    case "velas":
      onProgresso?.(
        "📗 Parser Magneti: Velas"
      );
      break;

    case "palhetas":
      onProgresso?.(
        "📗 Parser Magneti: Palhetas"
      );
      break;

    case "bombas_agua":
      onProgresso?.(
        "📗 Parser Magneti: Bombas d'Água"
      );
      break;

    default:
      onProgresso?.(
        `📗 Parser Magneti: ${tipoCatalogo}`
      );
  }

  const linhas = String(
    textoAplicacoes || ""
  )
    .split(/\r?\n/)
    .map(limparTexto)
    .filter(Boolean);

  const registros = [];

  for (const linha of linhas) {
    const codigoEncontrado =
      identificarCodigo(linha);

    if (!codigoEncontrado) {
      continue;
    }

    const codigo =
      normalizarCodigo(
        codigoEncontrado
      );

    const descricao = limparTexto(
      linha.replace(
        codigoEncontrado,
        ""
      )
    );

    if (!descricao) {
      continue;
    }

    registros.push({
      peca:
        configuracao?.pecaPadrao ||
        descricao,

      codigo_oem: codigo,

      codigo_equivalente: "",

      fabricante:
        "Magneti Marelli",

      origem_catalogo:
        configuracao
          ?.origemCatalogo ||
        nomeArquivo ||
        "Catálogo Magneti Marelli",

      montadora: "",

      modelo: "",

      motor: "",

      ano_inicio: null,

      ano_fim: null,

      aplicacao: descricao,

      observacao:
        "Registro importado automaticamente do catálogo Magneti Marelli.",

      prioridade: 1,

      confiabilidade: 70,

      ativo: true,
    });
  }

  onProgresso?.(
    `✅ ${registros.length} registros Magneti Marelli identificados.`
  );

  return registros;
}