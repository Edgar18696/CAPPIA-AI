import { useState } from "react";

export default function useGaleriaState() {
  const [
    filtroGaleria,
    setFiltroGaleria,
  ] = useState("todos");

  const [
    galeria,
    setGaleria,
  ] = useState([]);

  const [
    selecionadas,
    setSelecionadas,
  ] = useState([]);

  const [
    paginaAtual,
    setPaginaAtual,
  ] = useState(1);

  const [
    buscaGaleria,
    setBuscaGaleria,
  ] = useState("");

  const [
    totalFotosIA,
    setTotalFotosIA,
  ] = useState(0);

  const [
    totalBannersIA,
    setTotalBannersIA,
  ] = useState(0);

  const [
    totalProcessamentos,
    setTotalProcessamentos,
  ] = useState(0);

  const [
    imagensSelecionadas,
    setImagensSelecionadas,
  ] = useState([]);

  const [
    baixandoLote,
    setBaixandoLote,
  ] = useState(false);

  const itensPorPagina = 12;

  return {
    filtroGaleria,
    setFiltroGaleria,

    galeria,
    setGaleria,

    selecionadas,
    setSelecionadas,

    paginaAtual,
    setPaginaAtual,

    buscaGaleria,
    setBuscaGaleria,

    totalFotosIA,
    setTotalFotosIA,

    totalBannersIA,
    setTotalBannersIA,

    totalProcessamentos,
    setTotalProcessamentos,

    imagensSelecionadas,
    setImagensSelecionadas,

    baixandoLote,
    setBaixandoLote,

    itensPorPagina,
  };
}