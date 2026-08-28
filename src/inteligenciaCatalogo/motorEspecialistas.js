import { classificarPeca } from "./classificadorPeca";
import { obterEspecialista } from "./especialistaCatalogo";

function texto(valor) {
  return String(valor || "").trim();
}

export function motorEspecialistas(
  registros
) {
  const lista = Array.isArray(
    registros
  )
    ? registros
    : [];

  const primeiro =
    lista[0] || {};

  const peca = texto(
    primeiro.peca
  );

  const fabricante = texto(
    primeiro.fabricante
  );

  const classificacao =
    classificarPeca(peca);

  const especialista =
    obterEspecialista(peca);

  return {
    peca,

    fabricante,

    classificacao,

    especialista,

    totalRegistros:
      lista.length,

    origemCatalogo:
      primeiro.origem_catalogo ||
      primeiro.fonte ||
      "Base Mestre APPIA",

    confiabilidade:
      Number(
        primeiro.confiabilidade || 0
      ),
  };
}