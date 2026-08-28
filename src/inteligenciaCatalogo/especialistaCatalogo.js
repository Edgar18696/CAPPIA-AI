import { especialistaBicoInjetor } from "./especialistas/bicoInjetor";
import { especialistaSensorMAP } from "./especialistas/sensorMap";
import { especialistaSondaLambda } from "./especialistas/sondaLambda";

export function obterEspecialista(nomePeca = "") {
  const texto = nomePeca.toLowerCase();

  if (texto.includes("bico")) return especialistaBicoInjetor();
  if (texto.includes("map")) return especialistaSensorMAP();
  if (texto.includes("sonda")) return especialistaSondaLambda();

  return {
    obrigatorios: [],
    recomendados: [],
  };
}