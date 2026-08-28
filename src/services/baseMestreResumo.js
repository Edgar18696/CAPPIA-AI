import { supabase } from "../supabase";

async function contarRegistros(tabela) {
  const { count, error } = await supabase
    .from(tabela)
    .select("*", {
      count: "exact",
      head: true,
    });

  if (error) {
    console.error(
      `Erro ao contar registros de ${tabela}:`,
      error
    );

    return 0;
  }

  return count || 0;
}

async function carregarCampoDistinto({
  tabela,
  campo,
}) {
  const tamanhoPagina = 1000;
  const valores = new Set();

  let inicio = 0;
  let continuar = true;

  while (continuar) {
    const { data, error } = await supabase
      .from(tabela)
      .select(campo)
      .range(
        inicio,
        inicio + tamanhoPagina - 1
      );

    if (error) {
      console.error(
        `Erro ao carregar ${campo} de ${tabela}:`,
        error
      );

      return 0;
    }

    const registros =
      Array.isArray(data)
        ? data
        : [];

    registros.forEach((registro) => {
      const valor = String(
        registro?.[campo] || ""
      ).trim();

      if (valor) {
        valores.add(valor);
      }
    });

    continuar =
      registros.length === tamanhoPagina;

    inicio += tamanhoPagina;
  }

  return valores.size;
}

export async function obterResumoBaseMestre() {
  try {
    const [
      totalPecas,
      totalCompatibilidades,
      totalFabricantes,
      totalCatalogos,
    ] = await Promise.all([
      contarRegistros(
        "catalogo_mestre"
      ),

      contarRegistros(
        "catalogo_pecas"
      ),

      carregarCampoDistinto({
        tabela: "catalogo_mestre",
        campo: "fabricante",
      }),

      carregarCampoDistinto({
        tabela: "catalogo_mestre",
        campo: "origem_catalogo",
      }),
    ]);

    return {
      sucesso: true,

      totalPecas,
      totalFabricantes,
      totalCatalogos,
      totalCompatibilidades,
    };
  } catch (erro) {
    console.error(
      "Erro ao obter resumo da Base Mestre:",
      erro
    );
console.log({
  totalPecas,
  totalFabricantes,
  totalCatalogos,
  totalCompatibilidades,
});
    return {
      sucesso: false,

      totalPecas: 0,
      totalFabricantes: 0,
      totalCatalogos: 0,
      totalCompatibilidades: 0,
    };
  }
}

export default obterResumoBaseMestre;