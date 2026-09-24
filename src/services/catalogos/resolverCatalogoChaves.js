import { supabase } from "../../supabase.js";

const TIPOS_TECNICOS = new Set(["oem", "equivalente", "fabricante"]);

export function normalizarCodigoChave(valor) {
  return String(valor ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function idProdutoChave(chave) {
  return `${chave?.origem_catalogo || ""}::${chave?.codigo_tecnico_principal_normalizado || ""}`;
}

function ordenarPecasPeloPrincipal(registros, principalNormalizado) {
  return [...registros].sort((a, b) => {
    const pa =
      normalizarCodigoChave(a?.codigo_oem) === principalNormalizado ? 0 : 1;
    const pb =
      normalizarCodigoChave(b?.codigo_oem) === principalNormalizado ? 0 : 1;
    return pa - pb;
  });
}

async function consultarChavesPorCodigoNormalizado(compacto, cliente) {
  if (!compacto) {
    return [];
  }

  const { data, error } = await cliente
    .from("catalogo_chaves")
    .select("*")
    .eq("codigo_normalizado", compacto)
    .eq("ativo", true)
    .limit(20);

  if (error) {
    console.warn("⚠️ catalogo_chaves:", error);
    return [];
  }

  return Array.isArray(data) ? data : [];
}

async function consultarChavesDoProduto(
  origemCatalogo,
  principalNormalizado,
  cliente
) {
  const { data, error } = await cliente
    .from("catalogo_chaves")
    .select("*")
    .eq("origem_catalogo", origemCatalogo)
    .eq("codigo_tecnico_principal_normalizado", principalNormalizado)
    .eq("ativo", true)
    .limit(80);

  if (error) {
    throw error;
  }

  return Array.isArray(data) ? data : [];
}

async function consultarPecasDaOrigem(origemCatalogo, codigosOem, cliente) {
  const unicos = [...new Set((codigosOem || []).filter(Boolean))];
  if (!unicos.length) {
    return [];
  }

  const { data, error } = await cliente
    .from("catalogo_pecas")
    .select("*")
    .eq("origem_catalogo", origemCatalogo)
    .eq("ativo", true)
    .in("codigo_oem", unicos)
    .limit(300);

  if (error) {
    throw error;
  }

  return Array.isArray(data) ? data : [];
}

function montarEquivalentesDocumentados(chavesIrmas) {
  const vistos = new Set();
  const equivalentes = [];

  for (const chave of chavesIrmas) {
    if (!TIPOS_TECNICOS.has(chave.tipo_chave)) {
      continue;
    }

    const normalizado = normalizarCodigoChave(chave.codigo_normalizado);
    if (!normalizado || vistos.has(normalizado)) {
      continue;
    }

    vistos.add(normalizado);
    equivalentes.push({
      codigo_exibido: chave.codigo_exibido,
      codigo_normalizado: normalizado,
      tipo_chave: chave.tipo_chave,
      marca_chave: chave.marca_chave,
    });
  }

  return equivalentes;
}

function montarAplicacoes(pecas) {
  const vistos = new Set();
  const aplicacoes = [];

  for (const peca of pecas) {
    const chaveApp = [
      peca.montadora || "",
      peca.modelo || "",
      peca.motor || "",
      peca.ano_inicio ?? "",
      peca.ano_fim ?? "",
      peca.origem_catalogo || "",
    ].join("|");

    if (vistos.has(chaveApp)) {
      continue;
    }

    vistos.add(chaveApp);
    aplicacoes.push({
      montadora: peca.montadora || null,
      modelo: peca.modelo || null,
      motor: peca.motor || null,
      ano_inicio: peca.ano_inicio ?? null,
      ano_fim: peca.ano_fim ?? null,
      origem_catalogo: peca.origem_catalogo || null,
    });
  }

  return aplicacoes;
}

async function montarProduto(chaveEntrada, chavesIrmas, termo, compacto, cliente) {
  const tecnicos = chavesIrmas.filter((chave) =>
    TIPOS_TECNICOS.has(chave.tipo_chave)
  );
  const codigosOem = [
    ...new Set(
      tecnicos.flatMap((chave) =>
        [chave.codigo_exibido, chave.codigo_normalizado].filter(Boolean)
      )
    ),
  ];
  const tecnicosNorm = new Set(
    tecnicos.map((chave) => normalizarCodigoChave(chave.codigo_normalizado))
  );

  const lote = await consultarPecasDaOrigem(
    chaveEntrada.origem_catalogo,
    codigosOem,
    cliente
  );

  const pecas = ordenarPecasPeloPrincipal(
    lote.filter((registro) => {
      if (registro.origem_catalogo !== chaveEntrada.origem_catalogo) {
        return false;
      }
      return tecnicosNorm.has(normalizarCodigoChave(registro.codigo_oem));
    }),
    chaveEntrada.codigo_tecnico_principal_normalizado
  );

  return {
    codigo_pesquisado: String(termo ?? "").trim(),
    codigo_pesquisado_normalizado: compacto,
    tipo_chave: chaveEntrada.tipo_chave,
    marca_chave: chaveEntrada.marca_chave,
    origem_catalogo: chaveEntrada.origem_catalogo,
    codigo_tecnico_principal: chaveEntrada.codigo_tecnico_principal,
    codigo_tecnico_principal_normalizado:
      chaveEntrada.codigo_tecnico_principal_normalizado,
    equivalentes: montarEquivalentesDocumentados(chavesIrmas),
    aplicacoes: montarAplicacoes(pecas),
    pecas,
  };
}

export async function resolverProdutosPorChave(termo, cliente = supabase) {
  const compacto = normalizarCodigoChave(termo);
  if (!compacto) {
    return [];
  }

  const entradas = await consultarChavesPorCodigoNormalizado(compacto, cliente);
  if (!entradas.length) {
    return [];
  }

  const grupos = new Map();
  for (const chave of entradas) {
    const id = idProdutoChave(chave);
    if (!grupos.has(id)) {
      grupos.set(id, chave);
    }
  }

  const produtos = [];
  for (const representante of grupos.values()) {
    const irmas = await consultarChavesDoProduto(
      representante.origem_catalogo,
      representante.codigo_tecnico_principal_normalizado,
      cliente
    );
    const entrada =
      irmas.find(
        (chave) => normalizarCodigoChave(chave.codigo_normalizado) === compacto
      ) || representante;
    produtos.push(
      await montarProduto(entrada, irmas, termo, compacto, cliente)
    );
  }

  return produtos;
}
