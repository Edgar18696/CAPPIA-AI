import { supabase } from "../../../../supabase";
import { parserBoschBicosOnline } from "./parserBoschBicosOnline";
import { salvarCatalogo } from "../../salvarCatalogo";
import {
  buscarPaginaBosch,
  salvarPaginaBosch,
} from "./buscarPaginaBosch";

function normalizarCodigo(valor = "") {
  return String(valor || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .trim();
}

export async function importarBoschBicosOnline({
  codigo,
  fabricante = "",
  onProgresso,
}) {
const entrada = String(
  codigo || ""
).trim();

  if (!entrada) {
    throw new Error(
      "Informe um código Bosch ou uma URL."
    );
  }

  onProgresso?.(
    "Consultando catálogo Bosch..."
  );

let pesquisa;

try {
  pesquisa =
    await buscarPaginaBosch(entrada);
} catch (erro) {
  pesquisa = {
    sucesso: false,
    codigo: normalizarCodigo(entrada),
    origem: "nao_encontrado",
  };
}

  /*
   * O produto já foi encontrado no catálogo PDF.
   * Não precisa abrir página online nem importar novamente.
   */
if (
  pesquisa?.origem ===
    "catalogo_tecnico_appia" ||
  pesquisa?.origem ===
    "catalogo_pdf_bosch"
) {
    const registros = Array.isArray(
      pesquisa.registros
    )
      ? pesquisa.registros
      : [];

    if (registros.length === 0) {
      throw new Error(
        "Nenhum registro Bosch foi encontrado no catálogo importado."
      );
    }

    onProgresso?.(
      `${registros.length} registro(s) encontrado(s) no catálogo Bosch.`
    );

    return {
      sucesso: true,
      quantidade: registros.length,
      registros,
      codigo:
        pesquisa.codigo ||
        normalizarCodigo(codigo),
     origem:
     pesquisa.origem,
      mensagem:
        "Produto encontrado no catálogo Bosch já importado.",
    };
  }

const urlFinal = String(
  pesquisa?.url || ""
).trim();

if (!urlFinal) {
  return {
    sucesso: true,
    quantidade: 0,
    registros: [],
    codigo:
      pesquisa.codigo ||
      normalizarCodigo(entrada),
    origem:
      pesquisa.origem ||
      "nao_encontrado",
    mensagem:
      "Código não possui página Bosch Online. O catálogo PDF continua sendo utilizado normalmente.",
  };
}

  onProgresso?.(
    "Abrindo página Bosch..."
  );

  const { data, error } =
    await supabase.functions.invoke(
      "importar-bosch-online",
      {
        body: {
          url: urlFinal,
        },
      }
    );

  if (error) {
    console.error(
      "Erro na função importar-bosch-online:",
      error
    );

    throw new Error(
      error.message ||
        "Erro ao abrir a página Bosch."
    );
  }

  if (!data?.html) {
    throw new Error(
      "A página Bosch não retornou conteúdo."
    );
  }

  onProgresso?.(
    "Interpretando dados Bosch..."
  );

  const registros =
    parserBoschBicosOnline({
      html: data.html,
      url: urlFinal,
    });

  if (
    !Array.isArray(registros) ||
    registros.length === 0
  ) {
    throw new Error(
      "Nenhum produto Bosch foi identificado na página."
    );
  }

  onProgresso?.(
    `Salvando ${registros.length} registro(s)...`
  );

  const resultadoSalvar =
    await salvarCatalogo({
      registros,
      fabricante: "Bosch",
      origemCatalogo:
        "Catálogo Bosch Online",
    });

  const primeiroRegistro =
    registros[0] || {};

  const codigoEncontrado =
    normalizarCodigo(
      primeiroRegistro.codigo_oem ||
        primeiroRegistro.codigo ||
        primeiroRegistro.codigo_equivalente ||
        codigo
    );

  if (codigoEncontrado) {
    await salvarPaginaBosch({
      codigo: codigoEncontrado,
      url: urlFinal,
      titulo:
        primeiroRegistro.peca ||
        primeiroRegistro.descricao ||
        "",
      categoria:
        primeiroRegistro.categoria ||
        "",
    });
  }

  onProgresso?.(
    "Importação Bosch concluída."
  );

  return {
    sucesso: true,
    quantidade: registros.length,
    registros,
    resultadoSalvar,
    codigo: codigoEncontrado,
    url: urlFinal,
    origem: "catalogo_online_bosch",
  };
}