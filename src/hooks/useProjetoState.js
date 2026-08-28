import { useState } from "react";

export default function useProjetoState() {
  const [projetos, setProjetos] = useState([]);

  const [nomeProjeto, setNomeProjeto] =
    useState("");

  const [
    descricaoProjeto,
    setDescricaoProjeto,
  ] = useState("");

  const [
    statusProjeto,
    setStatusProjeto,
  ] = useState("Em andamento");

  const [
    novoStatus,
    setNovoStatus,
  ] = useState("Em andamento");

  const [
    editandoProjeto,
    setEditandoProjeto,
  ] = useState(null);

  const [
    buscaProjeto,
    setBuscaProjeto,
  ] = useState("");

  const [
    imagemProjeto,
    setImagemProjeto,
  ] = useState("");

  const [
    arquivoProjeto,
    setArquivoProjeto,
  ] = useState(null);

  const [
    totalProjetos,
    setTotalProjetos,
  ] = useState(0);

  const [
    projetosAndamento,
    setProjetosAndamento,
  ] = useState(0);

  const [
    projetosConcluidos,
    setProjetosConcluidos,
  ] = useState(0);

  const [
    projetosPausados,
    setProjetosPausados,
  ] = useState(0);

  const [
    ultimosProjetos,
    setUltimosProjetos,
  ] = useState([]);

  return {
    projetos,
    setProjetos,

    nomeProjeto,
    setNomeProjeto,

    descricaoProjeto,
    setDescricaoProjeto,

    statusProjeto,
    setStatusProjeto,

    novoStatus,
    setNovoStatus,

    editandoProjeto,
    setEditandoProjeto,

    buscaProjeto,
    setBuscaProjeto,

    imagemProjeto,
    setImagemProjeto,

    arquivoProjeto,
    setArquivoProjeto,

    totalProjetos,
    setTotalProjetos,

    projetosAndamento,
    setProjetosAndamento,

    projetosConcluidos,
    setProjetosConcluidos,

    projetosPausados,
    setProjetosPausados,

    ultimosProjetos,
    setUltimosProjetos,
  };
}