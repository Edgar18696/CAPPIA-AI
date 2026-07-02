import { extrairChassi, decodificarVinBasico } from "./vin.ts";
import { buscarVin } from "./vinDatabase.ts";
import { CATEGORIAS_TECNICAS } from "./categorias.ts";
export type Contexto = {
  marca?: string;
  modelo?: string;
  ano?: string;
  motor?: string;
  chassi?: string;
  codigo?: string;
  peca?: string;
  categoriaTecnica?: string;

  tipoConsulta?: {
    consultaCodigo: boolean;
    consultaChassi: boolean;
    consultaAplicacao: boolean;
    consultaEquivalencia: boolean;
    consultaOEM: boolean;
    perguntaGeral: boolean;
  };

  mensagemOriginal?: string;
};

function normalizar(texto = "") {
  return texto
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}
function identificarCategoriaTecnica(peca?: string) {
  if (!peca) return "GERAL";

  const texto = normalizar(peca);

  for (const categoria of CATEGORIAS_TECNICAS) {
    for (const palavra of categoria.palavras) {
      if (texto.includes(normalizar(palavra))) {
        return categoria.categoria;
      }
    }
  }

  return "GERAL";
}
export async function extrairContexto(mensagem: string): Promise<Contexto> {  const texto = normalizar(mensagem);

  const chassiEncontrado = extrairChassi(mensagem);
  const dadosVin = decodificarVinBasico(chassiEncontrado);
  let dadosBanco = null;

if (chassiEncontrado.length >= 7) {
  dadosBanco = await buscarVin(chassiEncontrado.substring(0, 7));
}

  const anos = texto.match(/\b(19|20)\d{2}\b/g) || [];
  const motores = texto.match(/\b\d\.\d\b/g) || [];

  const modelos = [
    "gol", "voyage", "fox", "polo", "golf",
    "sandero", "logan", "duster", "clio", "kwid",
    "onix", "prisma", "spin", "cobalt", "cruze",
    "uno", "palio", "siena", "strada", "mobi",
    "argo", "toro", "hb20", "creta", "tucson",
    "ix35", "civic", "fit", "city", "corolla",
    "etios", "hilux", "versa", "march", "sentra",
    "frontier"
  ];

  const marcas = [
    "chevrolet", "gm", "volkswagen", "vw", "fiat",
    "renault", "ford", "hyundai", "kia", "honda",
    "toyota", "nissan", "citroen", "peugeot", "jeep",
    "mitsubishi"
  ];

  const pecas = [
    "sensor map", "sensor maf", "sensor rotacao",
    "sonda lambda", "bico injetor",
    "valvula solenoide", "bobina", "tbi",
    "corpo borboleta", "interruptor oleo",
    "interruptor luz freio", "resistencia ventoinha",
    "cinta airbag", "chicote airbag", "fechadura",
    "mangueira", "rele auxiliar"
  ];

  const modelo = modelos.find((m) => texto.includes(m));
  const marca = marcas.find((m) => texto.includes(m));
  const peca = pecas.find((p) => texto.includes(normalizar(p)));

  const codigo = texto
    .split(/\s+/)
    .find((p) => /[a-z0-9]{5,}/i.test(p) && /\d/.test(p));
    const tipoConsulta = {
  consultaCodigo: !!codigo,
  consultaChassi: chassiEncontrado.length >= 17,
  consultaAplicacao:
    texto.includes("serve") ||
    texto.includes("aplica") ||
    texto.includes("compat"),
  consultaEquivalencia:
    texto.includes("equivalente") ||
    texto.includes("equivalencia") ||
    texto.includes("substitui"),
  consultaOEM:
    texto.includes("oem") ||
    texto.includes("original"),
  perguntaGeral: !codigo && !chassiEncontrado && !peca,
};

  return {
  marca:
    marca ||
    dadosBanco?.montadora ||
    dadosVin.montadora,

  modelo:
    modelo ||
    dadosBanco?.modelo,

  ano:
    anos[0] ||
    String(dadosBanco?.ano_inicio || "") ||
    dadosVin.ano,

  motor:
    motores[0] ||
    dadosBanco?.motor,

  chassi: chassiEncontrado,

codigo,

peca,

categoriaTecnica: identificarCategoriaTecnica(peca),

tipoConsulta,

mensagemOriginal: mensagem,
};
}