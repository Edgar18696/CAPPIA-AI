import { buscarCodigoPrincipal } from "./buscarCodigoPrincipal";
import { buscarAplicacoes } from "./buscarAplicacoes";
import { buscarEquivalencias } from "./buscarEquivalencias";
import { gerarDiagnostico } from "./gerarDiagnostico";
import { auditoriaCatalogo } from "./auditoriaCatalogo";
import { motorEspecialistas } from "./motorEspecialistas";

function texto(valor) {
  return String(valor || "")
    .trim()
    .toLowerCase();
}

function chaveRegistro(item) {
  return [
    texto(item?.codigo_oem),
    texto(item?.codigo_equivalente),
    texto(item?.fabricante),
    texto(item?.peca),
    texto(item?.montadora),
    texto(item?.modelo),
    texto(item?.motor),
    texto(item?.ano_inicio),
    texto(item?.ano_fim),
  ].join("|");
}

export async function motorInteligencia(
  codigo
) {
  const codigoEntrada = texto(codigo);

  if (!codigoEntrada) {
    return null;
  }

  const codigoPrincipal = texto(
    await buscarCodigoPrincipal(
      codigoEntrada
    )
  );

  const codigoBusca =
    codigoPrincipal || codigoEntrada;

  const resultados =
    await Promise.all([
      buscarAplicacoes(
        codigoEntrada
      ),

      codigoPrincipal &&
      codigoPrincipal !== codigoEntrada
        ? buscarAplicacoes(
            codigoPrincipal
          )
        : Promise.resolve([]),
    ]);

  const registrosUnidos =
    resultados.flat();

  const registros = [
    ...new Map(
      registrosUnidos.map(
        (item) => [
          chaveRegistro(item),
          item,
        ]
      )
    ).values(),
  ];

  if (!registros.length) {
    return null;
  }

  const equivalentes =
    buscarEquivalencias(
      registros
    );

  const diagnostico =
    gerarDiagnostico(
      registros,
      equivalentes
    );

  const auditoria =
    auditoriaCatalogo(
      registros
    );

  const inteligencia =
    motorEspecialistas(
      registros
    );

  return {
    codigoPrincipal: codigoBusca,
    registros,
    equivalentes,
    diagnostico,
    auditoria,
    inteligencia,
  };
}