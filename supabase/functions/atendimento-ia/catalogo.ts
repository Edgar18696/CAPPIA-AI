type Contexto = {
  marca?: string;
  modelo?: string;
  ano?: string;
  motor?: string;
  chassi?: string;
  codigo?: string;
  peca?: string;
};

type ItemCatalogo = {
  id?: string;
  montadora?: string;
  modelo?: string;
  ano_inicio?: number;
  ano_fim?: number;
  motor?: string;
  peca?: string;
  codigo_oem?: string;
  codigo_equivalente?: string;
  fabricante?: string;
  observacao?: string;
};

function normalizar(texto = "") {
  return texto
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

function extrairTermos(contexto: Contexto) {
  const texto = normalizar(
    [
      contexto.marca,
      contexto.modelo,
      contexto.motor,
      contexto.codigo,
      contexto.peca,
      contexto.ano,
    ]
      .filter(Boolean)
      .join(" ")
  );

  return texto
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1);
}

function itemBateComAno(item: ItemCatalogo, ano?: string) {
  if (!ano) return true;

  const anoNumero = Number(ano);
  if (!anoNumero) return true;

  const inicio = Number(item.ano_inicio || 0);
  const fim = Number(item.ano_fim || 0);

  if (!inicio && !fim) return true;
  if (inicio && fim) return anoNumero >= inicio && anoNumero <= fim;
  if (inicio && !fim) return anoNumero >= inicio;
  if (!inicio && fim) return anoNumero <= fim;

  return true;
}

function limparTermoParaUrl(termo: string) {
  return encodeURIComponent(termo.replace(/[^\w.-]/g, ""));
}

async function consultarCatalogoPorTermos(
  supabaseUrl: string,
  serviceKey: string,
  termos: string[],
  ano?: string
) {
  if (termos.length === 0) return [];

  const filtros = termos
    .map((termo) => {
      const t = limparTermoParaUrl(termo);

      return [
        `montadora.ilike.*${t}*`,
        `modelo.ilike.*${t}*`,
        `motor.ilike.*${t}*`,
        `peca.ilike.*${t}*`,
        `codigo_oem.ilike.*${t}*`,
        `codigo_equivalente.ilike.*${t}*`,
        `fabricante.ilike.*${t}*`,
        `observacao.ilike.*${t}*`,
      ].join(",");
    })
    .join(",");

  const url =
    `${supabaseUrl}/rest/v1/catalogo_pecas` +
    `?select=*` +
    `&or=(${filtros})` +
    `&limit=100`;

  const resposta = await fetch(url, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!resposta.ok) {
    const erro = await resposta.text();
    console.log("ERRO BUSCAR CATÁLOGO:", erro);
    return [];
  }

  const dados = (await resposta.json()) as ItemCatalogo[];

  return dados
    .filter((item) => itemBateComAno(item, ano))
    .slice(0, 10);
}

export async function buscarCatalogo(
  contexto: Contexto,
  codigosExtras: string[] = []
) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceKey) {
    console.log("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurado.");
    return [];
  }

  const termosBase = extrairTermos(contexto);

  const resultadosBase = await consultarCatalogoPorTermos(
    supabaseUrl,
    serviceKey,
    termosBase,
    contexto.ano
  );

  const codigosLimpos = codigosExtras
    .filter(Boolean)
    .map((c) => normalizar(c))
    .filter((c) => c.length > 1);

  if (codigosLimpos.length === 0) {
    return resultadosBase;
  }

  const resultadosPorCodigos = await consultarCatalogoPorTermos(
    supabaseUrl,
    serviceKey,
    codigosLimpos,
    contexto.ano
  );

  const unidos = [...resultadosBase, ...resultadosPorCodigos];

  const unicos = Array.from(
    new Map(
      unidos.map((item) => [
        item.id ||
          `${item.montadora}-${item.modelo}-${item.motor}-${item.peca}-${item.codigo_oem}-${item.codigo_equivalente}`,
        item,
      ])
    ).values()
  );

  return unicos.slice(0, 10);
}

export function montarContextoCatalogo(itens: ItemCatalogo[]) {
  if (!itens || itens.length === 0) {
    return "Nenhum item encontrado na Base de Conhecimento.";
  }

  return itens
    .map((item, index) => {
      return `
Resultado ${index + 1}:
Montadora: ${item.montadora || "-"}
Modelo: ${item.modelo || "-"}
Ano: ${item.ano_inicio || "-"} até ${item.ano_fim || "-"}
Motor: ${item.motor || "-"}
Peça: ${item.peca || "-"}
OEM: ${item.codigo_oem || "-"}
Equivalente: ${item.codigo_equivalente || "-"}
Fabricante: ${item.fabricante || "-"}
Observação: ${item.observacao || "-"}
`;
    })
    .join("\n");
}