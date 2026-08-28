export function classificarPeca(nomePeca = "") {
  const texto = nomePeca.toLowerCase();

  if (texto.includes("bico"))
    return {
      familia: "injecao",
      tipo: "bicoInjetor",
    };

  if (texto.includes("map"))
    return {
      familia: "injecao",
      tipo: "sensorMAP",
    };

  if (texto.includes("maf"))
    return {
      familia: "injecao",
      tipo: "sensorMAF",
    };

  if (texto.includes("tbi"))
    return {
      familia: "injecao",
      tipo: "tbi",
    };

  if (texto.includes("sonda"))
    return {
      familia: "sensores",
      tipo: "sondaLambda",
    };

  if (texto.includes("temperatura"))
    return {
      familia: "sensores",
      tipo: "temperatura",
    };

  if (texto.includes("rotação"))
    return {
      familia: "sensores",
      tipo: "rotacao",
    };

  if (texto.includes("fase"))
    return {
      familia: "sensores",
      tipo: "fase",
    };

  if (texto.includes("bobina"))
    return {
      familia: "ignicao",
      tipo: "bobina",
    };

  return {
    familia: "geral",
    tipo: "generico",
  };
}