import { supabase } from "../../supabase";

function normalizarCodigo(valor) {
  return String(valor || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .trim();
}

function separarCodigos(valor) {
  if (Array.isArray(valor)) {
    return valor.filter(Boolean);
  }

  return String(valor || "")
    .split(/[,;|/\n]+/)
    .map((codigo) => codigo.trim())
    .filter(Boolean);
}

function gerarVariantesCodigo(valor) {
  const original = String(valor || "")
    .trim()
    .toUpperCase();

  const normalizado =
    normalizarCodigo(original);

  const variantes = new Set();

  if (original) {
    variantes.add(original);
  }

  if (normalizado) {
    variantes.add(normalizado);
  }

  // Padrão Bosch:
  // 0258986770 -> 0 258 986 770
  if (
    /^\d{10}$/.test(normalizado) &&
    normalizado.startsWith("0")
  ) {
    variantes.add(
      `${normalizado.slice(0, 1)} ${normalizado.slice(
        1,
        4
      )} ${normalizado.slice(
        4,
        7
      )} ${normalizado.slice(7, 10)}`
    );
  }

  return Array.from(variantes);
}

function montarBaseAplicacao(
  registro = {}
) {
  const codigoPrincipal =
    registro.codigo_oem ||
    registro.codigo_equivalente ||
    "";

  return {
    ...registro,

    codigoOriginal:
      codigoPrincipal,

    codigoPrincipal:
      normalizarCodigo(
        codigoPrincipal
      ),

    codigoNormalizado:
      normalizarCodigo(
        codigoPrincipal
      ),

    peca:
      registro.peca ||
      "Peça automotiva",

    fabricante:
      registro.fabricante ||
      "Não identificado",

    familia:
      registro.familia ||
      registro.peca ||
      "Não identificada",

    equivalentes:
      separarCodigos(
        registro.codigo_equivalente
      ),

    montadoras:
      registro.montadora
        ? [registro.montadora]
        : [],

    modelos:
      registro.modelo
        ? [registro.modelo]
        : [],

    motores:
      registro.motor
        ? [registro.motor]
        : [],

    aplicacoes:
      registro.montadora ||
      registro.modelo ||
      registro.motor
        ? [
            {
              montadora:
                registro.montadora || "",

              modelo:
                registro.modelo || "",

              motor:
                registro.motor || "",

              anoInicio:
                registro.ano_inicio ??
                null,

              anoFim:
                registro.ano_fim ??
                null,

              observacao:
                registro.observacao ||
                "",

              origem:
                registro.origem_catalogo ||
                "Base APPIA",
            },
          ]
        : [],

    fontes:
      registro.origem_catalogo
        ? [
            registro.origem_catalogo,
          ]
        : [],

    totalRegistros: 1,

    confianca: {
      percentual:
        Number(
          registro.confiabilidade
        ) || 0,

      nivel:
        Number(
          registro.confiabilidade
        ) >= 80
          ? "Alta"
          : Number(
                registro.confiabilidade
              ) >= 60
            ? "Média"
            : "Baixa",

      motivos: [],
    },
  };
}

export async function buscarBaseMestre(
  codigo
) {
  const codigoNormalizado =
    normalizarCodigo(codigo);

  if (!codigoNormalizado) {
    return null;
  }

  const variantes =
    gerarVariantesCodigo(codigo);

  const filtros = [];

  variantes.forEach((variante) => {
    filtros.push(
      `codigo_oem.ilike.%${variante}%`
    );

    filtros.push(
      `codigo_equivalente.ilike.%${variante}%`
    );
  });

  const { data, error } =
    await supabase
      .from("catalogo_mestre")
      .select("*")
      .or(
        filtros.join(",")
      )
      .eq("ativo", true)
      .limit(1)
      .maybeSingle();

  if (error) {
    console.error(
      "ERRO AO BUSCAR CATÁLOGO MESTRE:",
      error
    );

    return null;
  }

  if (!data) {
    console.log(
      "🤖 PAIZINHO APPIA — Código não encontrado:",
      codigoNormalizado
    );

    return null;
  }

  console.log(
    "🤖 PAIZINHO APPIA — Código encontrado:",
    codigoNormalizado
  );

  console.log(
    "📚 Fonte:",
    data.origem_catalogo ||
      "Base Mestre APPIA"
  );

  return montarBaseAplicacao(
    data
  );
}

export async function salvarBaseMestre(
  base
) {
  // A importação já grava em catalogo_mestre.
  // Evita consultar a antiga tabela base_mestre_appia.
  return base || null;
}