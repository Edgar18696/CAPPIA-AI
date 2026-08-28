import identificarFamilia from "./identificarFamilia";
import identificarFabricante from "./identificarFabricante";
import identificarFamiliaPorCodigo from "./identificarFamiliaPorCodigo";
import identificarCategoriaPorCodigo from "./identificarCategoriaPorCodigo";
import identificarSistemaPorCodigo from "./identificarSistemaPorCodigo";
import normalizarCodigo from "./normalizarCodigo";

function montarCategoria(familia = "") {
  const texto = String(familia || "").toLowerCase();

  if (texto.includes("sensor")) {
    return "Sensores";
  }

  if (texto.includes("bico")) {
    return "Injeção de Combustível";
  }

  if (texto.includes("bomba")) {
    return "Sistema de Combustível";
  }

  if (
    texto.includes("bobina") ||
    texto.includes("vela")
  ) {
    return "Ignição";
  }

  if (
    texto.includes("sonda") ||
    texto.includes("lambda")
  ) {
    return "Controle de Emissões";
  }

  if (texto.includes("filtro")) {
    return "Filtragem";
  }

  if (texto.includes("palheta")) {
    return "Limpeza";
  }

  if (
    texto.includes("alternador") ||
    texto.includes("bateria")
  ) {
    return "Sistema Elétrico";
  }

  if (
    texto.includes("diesel") ||
    texto.includes("common rail")
  ) {
    return "Injeção Diesel";
  }

  return "Peças Automotivas";
}

function montarSistema(familia = "") {
  const texto = String(familia || "").toLowerCase();

  if (
    texto.includes("map") ||
    texto.includes("maf") ||
    texto.includes("tps") ||
    texto.includes("bico")
  ) {
    return "Injeção Eletrônica";
  }

  if (
    texto.includes("diesel") ||
    texto.includes("common rail")
  ) {
    return "Injeção Diesel";
  }

  if (texto.includes("bomba")) {
    return "Alimentação de Combustível";
  }

  if (
    texto.includes("bobina") ||
    texto.includes("vela")
  ) {
    return "Sistema de Ignição";
  }

  if (
    texto.includes("lambda") ||
    texto.includes("sonda")
  ) {
    return "Controle de Emissões";
  }

  if (texto.includes("abs")) {
    return "Sistema de Freios";
  }

  if (texto.includes("filtro")) {
    return "Filtragem";
  }

  if (texto.includes("palheta")) {
    return "Sistema de Limpeza";
  }

  if (
    texto.includes("alternador") ||
    texto.includes("bateria")
  ) {
    return "Sistema Elétrico";
  }

  return "Sistema Automotivo";
}

function montarTipo(familia = "") {
  const texto = String(familia || "").toLowerCase();

  if (
    texto.includes("sonda") ||
    texto.includes("lambda")
  ) {
    return "Sonda Lambda";
  }

  if (texto.includes("sensor")) {
    return "Sensor";
  }

  if (texto.includes("bico")) {
    return "Bico Injetor";
  }

  if (texto.includes("bomba")) {
    return "Bomba";
  }

  if (texto.includes("bobina")) {
    return "Bobina";
  }

  if (texto.includes("vela")) {
    return "Vela";
  }

  if (texto.includes("filtro")) {
    return "Filtro";
  }

  if (texto.includes("palheta")) {
    return "Palheta";
  }

  if (texto.includes("alternador")) {
    return "Alternador";
  }

  if (texto.includes("bateria")) {
    return "Bateria";
  }

  return "Peça";
}

function montarPalavrasChave({
  familia,
  fabricante,
  categoria,
  sistema,
  tipo,
  descricao,
}) {
  return Array.from(
    new Set(
      [
        familia,
        fabricante,
        categoria,
        sistema,
        tipo,

        ...String(descricao || "")
          .split(/\s+/)
          .map((item) => item.trim())
          .filter((item) => item.length >= 3),
      ].filter(Boolean)
    )
  ).slice(0, 15);
}

export function motorInteligenciaPeca({
  codigo = "",
  descricao = "",
  texto = "",
} = {}) {
  const codigoNormalizado =
    normalizarCodigo(codigo);

  const textoCompleto = [
    descricao,
    texto,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  const identificacaoPorCodigo =
    identificarFamiliaPorCodigo(
      codigoNormalizado
    );

  const familiaPorCodigo =
    identificacaoPorCodigo?.familia ||
    null;

  const catalogoPorCodigo =
    identificacaoPorCodigo?.catalogo ||
    null;

  const fabricantePorCodigo =
    identificacaoPorCodigo?.fabricante ||
    null;

  const familiaPorTexto =
    identificarFamilia(
      textoCompleto
    );

  const familia =
    familiaPorCodigo ||
    familiaPorTexto ||
    "Peça Automotiva";

  const fabricanteIdentificado =
    identificarFabricante({
      codigo: codigoNormalizado,
      texto: textoCompleto,
    });

  const fabricante =
    fabricantePorCodigo ||
    fabricanteIdentificado ||
    "Não identificado";

  const categoriaPorCodigo =
    identificarCategoriaPorCodigo(
      codigoNormalizado
    );

  const categoria =
    categoriaPorCodigo ||
    montarCategoria(familia);

  const sistemaPorCodigo =
    identificarSistemaPorCodigo(
      codigoNormalizado
    );

  const sistema =
    sistemaPorCodigo ||
    montarSistema(familia);

  const tipo =
    montarTipo(familia);

  let confianca = 50;

  if (familiaPorTexto) {
    confianca = 75;
  }

  if (familiaPorCodigo) {
    confianca = 90;
  }

  if (
    familiaPorCodigo &&
    categoriaPorCodigo &&
    sistemaPorCodigo
  ) {
    confianca = 100;
  }

  return {
    codigoOriginal: codigo,

    codigo: codigoNormalizado,

    descricao:
      descricao ||
      texto ||
      "",

    fabricante,

    familia,

    categoria,

    sistema,

    tipo,

    catalogo:
      catalogoPorCodigo,

    origemIdentificacao:
      familiaPorCodigo
        ? "codigo"
        : familiaPorTexto
          ? "texto"
          : "desconhecida",

    palavrasChave:
      montarPalavrasChave({
        familia,
        fabricante,
        categoria,
        sistema,
        tipo,
        descricao: textoCompleto,
      }),

    equivalentes: [],

    aplicacoes: [],

    confianca,
  };
}

export default motorInteligenciaPeca;