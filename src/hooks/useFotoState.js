import { useState } from "react";

export default function useFotoState() {
  const [
    categoriaFoto,
    setCategoriaFoto,
  ] = useState("autopecas");

  const [
    arquivosFotos,
    setArquivosFotos,
  ] = useState([]);

  const [
    tipoFundoFoto,
    setTipoFundoFoto,
  ] = useState("branco");

  const [
    tamanhoFoto,
    setTamanhoFoto,
  ] = useState("1200x1200");

  const [
    qualidadeFoto,
    setQualidadeFoto,
  ] = useState("alta");

  const [
    destinoFoto,
    setDestinoFoto,
  ] = useState("mercadolivre");

  return {
    categoriaFoto,
    setCategoriaFoto,

    arquivosFotos,
    setArquivosFotos,

    tipoFundoFoto,
    setTipoFundoFoto,

    tamanhoFoto,
    setTamanhoFoto,

    qualidadeFoto,
    setQualidadeFoto,

    destinoFoto,
    setDestinoFoto,
  };
}