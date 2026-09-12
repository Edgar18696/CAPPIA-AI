import { supabase } from "../supabase";

async function contarRegistros(tabela) {
  try {
    const { count, error } = await supabase
      .from(tabela)
      .select("*", {
        count: "estimated",
        head: true,
      });

    if (error) {
      console.error(
        `Erro ao contar registros de ${tabela}:`,
        error
      );

      return 0;
    }

    return Number(count || 0);
  } catch (erro) {
    console.error(
      `Falha inesperada ao contar ${tabela}:`,
      erro
    );

    return 0;
  }
}

async function carregarCampoDistinto({
  tabela,
  campo,
}) {
  try {
    /*
     * Não vamos mais percorrer centenas
     * de milhares de registros.
     *
     * Para o resumo visual do PAIIA,
     * uma amostra grande é suficiente
     * e evita sobrecarregar o banco.
     */
    const limite = 10000;

    const { data, error } = await supabase
      .from(tabela)
      .select(campo)
      .not(campo, "is", null)
      .limit(limite);

    if (error) {
      console.error(
        `Erro ao carregar ${campo} de ${tabela}:`,
        error
      );

      return 0;
    }

    const valores = new Set();

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

    return valores.size;
  } catch (erro) {
    console.error(
      `Falha inesperada ao carregar ${campo}:`,
      erro
    );

    return 0;
  }
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