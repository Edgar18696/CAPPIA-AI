import { quebrarModelos, unicos } from "./util";

export function montarTitulo(registros, codigoFinal) {
  const primeiro = registros[0] || {};
  const peca = primeiro.peca || "Peça Automotiva";

  const montadoras = unicos(registros.map((item) => item.montadora));
  const modelos = unicos(registros.flatMap((item) => quebrarModelos(item.modelo)));
  const motores = unicos(registros.map((item) => item.motor));

  const partes = [
    peca,
    ...montadoras.slice(0, 1),
    ...modelos.slice(0, 4),
    motores[0],
    codigoFinal,
  ].filter(Boolean);

  let titulo = "";

  for (const parte of partes) {
    const tentativa = titulo ? `${titulo} ${parte}` : parte;
    if (tentativa.length <= 60) titulo = tentativa;
  }

  return titulo || `${peca} ${codigoFinal}`.slice(0, 60);
}