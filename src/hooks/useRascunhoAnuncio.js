import { useEffect } from "react";

export function useRascunhoAnuncio({
  chaveRascunhoTemp,
  anuncioEditando,
  dados,
  setDados,
}) {
  useEffect(() => {
    if (anuncioEditando) return;

    const temConteudo =
      dados.codigo ||
      dados.oem ||
      dados.titulo ||
      dados.descricao ||
      dados.preco ||
      dados.fotos?.length > 0;

    if (!temConteudo) return;

    localStorage.setItem(chaveRascunhoTemp, JSON.stringify(dados));
  }, [chaveRascunhoTemp, anuncioEditando, dados]);

  function carregarRascunho() {
    const salvo = localStorage.getItem(chaveRascunhoTemp);
    if (!salvo) return null;

    const rascunho = JSON.parse(salvo);
    setDados(rascunho);
    return rascunho;
  }

  function limparRascunho() {
    localStorage.removeItem(chaveRascunhoTemp);
  }

  return {
    carregarRascunho,
    limparRascunho,
  };
}