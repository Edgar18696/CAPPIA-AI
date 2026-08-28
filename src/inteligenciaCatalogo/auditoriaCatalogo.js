import { unicos } from "./util";

function texto(valor) {
  return String(valor || "").trim();
}

function numero(valor) {
  const convertido = Number(valor);

  return Number.isFinite(convertido)
    ? convertido
    : null;
}

export function auditoriaCatalogo(
  registros
) {
  const lista = Array.isArray(
    registros
  )
    ? registros
    : [];

  const fabricantes = unicos(
    lista.map((r) => r.fabricante)
  );

  const montadoras = unicos(
    lista.map((r) => r.montadora)
  );

  const motores = unicos(
    lista.map((r) => r.motor)
  );

  const fontes = unicos(
    lista.map(
      (r) =>
        r.origem_catalogo ||
        r.fonte
    )
  );

  const confiabilidades =
    lista
      .map((r) =>
        numero(
          r.confiabilidade
        )
      )
      .filter(
        (v) => v !== null
      );

  const confiabilidade =
    confiabilidades.length
      ? Math.round(
          confiabilidades.reduce(
            (a, b) => a + b,
            0
          ) /
            confiabilidades.length
        )
      : 0;

  const problemas = [];

  if (
    fabricantes.length > 1
  ) {
    problemas.push(
      "Mais de um fabricante encontrado."
    );
  }

  if (
    montadoras.length === 0
  ) {
    problemas.push(
      "Nenhuma montadora encontrada."
    );
  }

  if (
    motores.length === 0
  ) {
    problemas.push(
      "Motor não informado."
    );
  }

  if (
    fontes.length === 0
  ) {
    problemas.push(
      "Origem do catálogo não informada."
    );
  }

  if (
    confiabilidade > 0 &&
    confiabilidade < 70
  ) {
    problemas.push(
      "Confiabilidade abaixo do recomendado."
    );
  }

  const status =
    problemas.length === 0
      ? "APROVADO"
      : "REVISAR";

  return {
    status,
    resultado: status,
    situacao: status,

    aprovado:
      status === "APROVADO",

    fabricantes,
    montadoras,
    motores,
    fontes,

    confiabilidade,

    totalRegistros:
      lista.length,

    problemas,
  };
}