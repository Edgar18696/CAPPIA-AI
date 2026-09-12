import {
  unicos,
  quebrarModelos,
} from "./util";

function texto(valor) {
  return String(valor || "").trim();
}

function numero(valor) {
  const convertido = Number(valor);

  return Number.isFinite(convertido)
    ? convertido
    : null;
}

export function gerarDiagnostico(
  registros,
  equivalentes
) {
  const listaRegistros = Array.isArray(
    registros
  )
    ? registros
    : [];

  const listaEquivalentes =
    Array.isArray(equivalentes)
      ? equivalentes
      : [];

  const primeiro =
    listaRegistros[0] || {};

  const montadoras = unicos(
    listaRegistros.map(
      (registro) =>
        registro.montadora
    )
  );

  const modelos = unicos(
    listaRegistros.flatMap(
      (registro) =>
        quebrarModelos(
          registro.modelo
        )
    )
  );

  const motores = unicos(
    listaRegistros.map(
      (registro) =>
        registro.motor
    )
  );

  const anos = unicos(
    listaRegistros.map(
      (registro) => {
        const anoInicio = texto(
          registro.ano_inicio
        );

        const anoFim = texto(
          registro.ano_fim
        );

        if (
          !anoInicio &&
          !anoFim
        ) {
          return "";
        }

        return `${
          anoInicio || "-"
        } até ${
          anoFim || "-"
        }`;
      }
    )
  );

  const fontes = unicos(
    listaRegistros.map(
      (registro) =>
        registro.origem_catalogo ||
        registro.fonte ||
        "Base Mestre PAIIA"
    )
  );

  const paginas = unicos(
    listaRegistros.map(
      (registro) =>
        registro.pagina_catalogo ||
        registro.pagina ||
        ""
    )
  );

  const fabricantes = unicos(
    listaRegistros.map(
      (registro) =>
        registro.fabricante
    )
  );

  const confiabilidades =
    listaRegistros
      .map((registro) =>
        numero(
          registro.confiabilidade
        )
      )
      .filter(
        (valor) =>
          valor !== null
      );

  const confiabilidade =
    confiabilidades.length > 0
      ? Math.round(
          confiabilidades.reduce(
            (total, valor) =>
              total + valor,
            0
          ) /
            confiabilidades.length
        )
      : 0;

  const origemPrincipal =
    texto(
      primeiro.origem_catalogo
    ) ||
    texto(primeiro.fonte) ||
    fontes[0] ||
    "Base Mestre PAIIA";

  const paginaPrincipal =
    texto(
      primeiro.pagina_catalogo
    ) ||
    texto(primeiro.pagina) ||
    paginas[0] ||
    "";

  return {
    codigoPrincipal:
      primeiro.codigo_oem ||
      primeiro.codigo_equivalente ||
      "",

    fabricante:
      primeiro.fabricante ||
      fabricantes[0] ||
      "",

    fabricantes,

    origemCatalogo:
      origemPrincipal,

    arquivoCatalogo:
      origemPrincipal,

    paginaCatalogo:
      paginaPrincipal,

    paginas,

    fontes,

    totalFontes:
      fontes.length,

    confiabilidade,

    totalMontadoras:
      montadoras.length,

    totalModelos:
      modelos.length,

    totalMotores:
      motores.length,

    totalAplicacoes:
      listaRegistros.length,

    totalEquivalentes:
      listaEquivalentes.length,

    anos,

    montadoras,

    modelos,

    motores,
  };
}