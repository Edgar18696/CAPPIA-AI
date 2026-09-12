export const CHAVE_NOVA_CRIACAO_MIDIA = "paiiaNovaCriacaoMidia";

export const TELAS_NOVA_CRIACAO_MIDIA = [
  "foto",
  "banner",
  "bannerStudio",
  "clip",
  "clipIA",
  "midiasAppia",
  "criarMascotePaizinho",
  "novoAnuncio",
];

const CHAVES_TEMPORARIAS_CRIACAO = [
  "imagemBannerSelecionada",
  "imagemClipSelecionada",
  "imagemClipProdutoSelecionada",
  "imagemFotoSelecionada",
  "imagemFotoIASelecionada",
  "abrirBannerAutomatico",
  "abrirClipAutomatico",
  "abrirFotoAutomatico",
  "retornarParaClipIA",
  "paiiaRestaurarCriacaoClip",
  "voltarParaCriacaoClip",
  "abrirModoCriacaoIA",
  "abrirModoMascoteIA",
  "abrirPaizinhoMarketing",
  "clipGeracaoStatus",
  "clipGeracaoMensagem",
  "clipGeracaoErro",
  "clipPremiumFormato",
  "clipPremiumMovimento",
  "clipSelecionadoEstilo",
  "mlAnuncioTeste",
  "novoAnuncioTemporario",
  "rascunhoNovoAnuncioTemp",
  "usarDadosCatalogoNoAnuncio",
  "pecaCatalogoSelecionada",
  "projetoAppiaAtual",
  "anuncioProntoPublicacao",
  "precoSugeridoAppia",
  "dadosPrecificacaoAppia",
  "mlPayloadTeste",
  "bannerPronto",
  "bannerSelecionado",
  "clipPronto",
  "clipSelecionado",
  "bannersSelecionadosPublicacao",
  "clipsSelecionadosPublicacao",
  "clipRemovidoPublicacao",
  "retornarParaMidiasPublicacao",
  "retornarParaNovoAnuncio",
];

export function ehTelaNovaCriacaoMidia(tela) {
  return TELAS_NOVA_CRIACAO_MIDIA.includes(String(tela || ""));
}

export function deveIniciarNovaCriacaoMidia() {
  return localStorage.getItem(CHAVE_NOVA_CRIACAO_MIDIA) === "true";
}

export function sessaoMidiaDeveContinuar() {
  return (
    localStorage.getItem("abrirBannerAutomatico") === "true" ||
    localStorage.getItem("abrirClipAutomatico") === "true" ||
    localStorage.getItem("abrirFotoAutomatico") === "true" ||
    localStorage.getItem("retornarParaClipIA") === "true" ||
    localStorage.getItem("paiiaRestaurarCriacaoClip") === "true" ||
    localStorage.getItem("voltarParaCriarMascote") === "true" ||
    localStorage.getItem("usarDadosCatalogoNoAnuncio") === "true" ||
    localStorage.getItem("retornarParaNovoAnuncio") === "true" ||
    Boolean(localStorage.getItem("voltarParaCriacaoClip"))
  );
}

export function prepararNovaCriacaoMidia() {
  CHAVES_TEMPORARIAS_CRIACAO.forEach((chave) => {
    localStorage.removeItem(chave);
  });
  localStorage.setItem(CHAVE_NOVA_CRIACAO_MIDIA, "true");
}

export const iniciarNovaCriacao = prepararNovaCriacaoMidia;

export function consumirNovaCriacaoMidia() {
  const nova = deveIniciarNovaCriacaoMidia();
  if (nova) {
    localStorage.removeItem(CHAVE_NOVA_CRIACAO_MIDIA);
  }
  return nova;
}
