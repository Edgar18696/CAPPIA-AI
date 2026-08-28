import {
  listarConfiguracoes,
  obterConfiguracao,
} from "./configuracoes";

function adicionarErro(
  erros,
  fabricante,
  mensagem
) {
  erros.push({
    fabricante:
      fabricante || "Não informado",
    mensagem,
  });
}

function validarConfiguracao(
  configuracao,
  indice,
  erros,
  avisos
) {
  const fabricante =
    configuracao?.fabricante ||
    `Configuração ${indice + 1}`;

  if (!configuracao) {
    adicionarErro(
      erros,
      fabricante,
      "Configuração inválida."
    );

    return;
  }

  if (!configuracao.fabricante) {
    adicionarErro(
      erros,
      fabricante,
      "O campo fabricante não foi informado."
    );
  }

  if (!configuracao.origemCatalogo) {
    adicionarErro(
      erros,
      fabricante,
      "O campo origemCatalogo não foi informado."
    );
  }

  if (
    !Array.isArray(configuracao.chaves) ||
    configuracao.chaves.length === 0
  ) {
    adicionarErro(
      erros,
      fabricante,
      "Nenhuma chave de fabricante foi configurada."
    );
  }

  if (
    typeof configuracao.parser !==
    "function"
  ) {
    adicionarErro(
      erros,
      fabricante,
      "O parser não existe ou não é uma função."
    );
  }

  if (
    !configuracao.formatoParser
  ) {
    adicionarErro(
      erros,
      fabricante,
      "O formatoParser não foi informado."
    );
  }

  if (
    !["texto", "paginas"].includes(
      configuracao.formatoParser
    )
  ) {
    adicionarErro(
      erros,
      fabricante,
      `Formato de parser inválido: ${configuracao.formatoParser}`
    );
  }

  if (
    !Number.isInteger(
      configuracao.paginaInicialAplicacoes
    ) ||
    configuracao.paginaInicialAplicacoes < 1
  ) {
    adicionarErro(
      erros,
      fabricante,
      "paginaInicialAplicacoes inválida."
    );
  }

  if (
    !Number.isInteger(
      configuracao.paginaFinalAplicacoes
    ) ||
    configuracao.paginaFinalAplicacoes < 1
  ) {
    adicionarErro(
      erros,
      fabricante,
      "paginaFinalAplicacoes inválida."
    );
  }

  if (
    configuracao.paginaFinalAplicacoes <
    configuracao.paginaInicialAplicacoes
  ) {
    adicionarErro(
      erros,
      fabricante,
      "A página final de aplicações é menor que a página inicial."
    );
  }

  if (
    configuracao.paginaInicialAplicacoes ===
      1 &&
    configuracao.paginaFinalAplicacoes ===
      1
  ) {
    avisos.push({
      fabricante,
      mensagem:
        "As páginas de aplicações ainda estão configuradas provisoriamente como 1 até 1.",
    });
  }

  if (
    configuracao.paginaInicialEquivalencias &&
    configuracao.paginaFinalEquivalencias &&
    configuracao.paginaFinalEquivalencias <
      configuracao.paginaInicialEquivalencias
  ) {
    adicionarErro(
      erros,
      fabricante,
      "A página final de equivalências é menor que a página inicial."
    );
  }
}

function validarChavesDuplicadas(
  configuracoes,
  erros
) {
  const chavesEncontradas =
    new Map();

  for (const configuracao of configuracoes) {
    const fabricante =
      configuracao.fabricante ||
      "Não informado";

    for (const chaveOriginal of
      configuracao.chaves || []) {
      const chave = String(
        chaveOriginal || ""
      )
        .trim()
        .toLowerCase();

      if (!chave) {
        adicionarErro(
          erros,
          fabricante,
          "Foi encontrada uma chave vazia."
        );

        continue;
      }

      if (chavesEncontradas.has(chave)) {
        adicionarErro(
          erros,
          fabricante,
          `A chave "${chave}" também pertence a "${chavesEncontradas.get(
            chave
          )}".`
        );

        continue;
      }

      chavesEncontradas.set(
        chave,
        fabricante
      );
    }
  }

  return chavesEncontradas;
}

function validarBuscaDasChaves(
  configuracoes,
  erros
) {
  for (const configuracao of configuracoes) {
    const fabricante =
      configuracao.fabricante ||
      "Não informado";

    for (const chave of
      configuracao.chaves || []) {
      const encontrada =
        obterConfiguracao(chave);

      if (!encontrada) {
        adicionarErro(
          erros,
          fabricante,
          `A chave "${chave}" não foi encontrada pelo obterConfiguracao().`
        );

        continue;
      }

      if (
        encontrada !== configuracao
      ) {
        adicionarErro(
          erros,
          fabricante,
          `A chave "${chave}" está apontando para outra configuração.`
        );
      }
    }
  }
}

export function testarImportadorUniversal() {
  const erros = [];
  const avisos = [];

  let configuracoes = [];

  try {
    configuracoes =
      listarConfiguracoes();
  } catch (error) {
    return {
      sucesso: false,
      totalFabricantes: 0,
      totalChaves: 0,
      erros: [
        {
          fabricante:
            "Importador Universal",
          mensagem:
            error?.message ||
            "Não foi possível carregar as configurações.",
        },
      ],
      avisos: [],
    };
  }

  if (
    !Array.isArray(configuracoes)
  ) {
    return {
      sucesso: false,
      totalFabricantes: 0,
      totalChaves: 0,
      erros: [
        {
          fabricante:
            "Importador Universal",
          mensagem:
            "listarConfiguracoes() não retornou um array.",
        },
      ],
      avisos: [],
    };
  }

  if (configuracoes.length === 0) {
    adicionarErro(
      erros,
      "Importador Universal",
      "Nenhuma configuração foi encontrada."
    );
  }

  configuracoes.forEach(
    (configuracao, indice) => {
      validarConfiguracao(
        configuracao,
        indice,
        erros,
        avisos
      );
    }
  );

  const chavesEncontradas =
    validarChavesDuplicadas(
      configuracoes,
      erros
    );

  validarBuscaDasChaves(
    configuracoes,
    erros
  );

  return {
    sucesso: erros.length === 0,
    totalFabricantes:
      configuracoes.length,
    totalChaves:
      chavesEncontradas.size,
    fabricantes:
      configuracoes.map(
        (configuracao) => ({
          fabricante:
            configuracao.fabricante,
          chaves:
            configuracao.chaves,
          formatoParser:
            configuracao.formatoParser,
          paginasAplicacoes: `${configuracao.paginaInicialAplicacoes} até ${configuracao.paginaFinalAplicacoes}`,
          parserValido:
            typeof configuracao.parser ===
            "function",
        })
      ),
    erros,
    avisos,
  };
}

export function executarTesteImportador() {
  const resultado =
    testarImportadorUniversal();

  console.group(
    "🧪 Teste do Importador Universal"
  );

  console.log(
    "Fabricantes:",
    resultado.totalFabricantes
  );

  console.log(
    "Chaves:",
    resultado.totalChaves
  );

  if (resultado.sucesso) {
    console.log(
      "✅ Importador Universal validado com sucesso."
    );
  } else {
    console.error(
      "❌ Foram encontrados erros no Importador Universal."
    );
  }

  if (resultado.erros.length > 0) {
    console.table(resultado.erros);
  }

  if (resultado.avisos.length > 0) {
    console.table(resultado.avisos);
  }

  console.table(
    resultado.fabricantes || []
  );

  console.groupEnd();

  return resultado;
}