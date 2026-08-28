const CHAVE_PROJETO_ATUAL =
  "projetoAppiaAtual";

export function lerProjetoAtual() {
  try {
    const salvo =
      localStorage.getItem(
        CHAVE_PROJETO_ATUAL
      );

    return salvo
      ? JSON.parse(salvo)
      : null;
  } catch (erro) {
    console.error(
      "Erro ao ler projeto:",
      erro
    );
    return null;
  }
}

export function salvarProjetoAtual(
  alteracoes = {}
) {
  try {
    const projeto =
      lerProjetoAtual() || {};

    const atualizado = {
      ...projeto,
      ...alteracoes,
      updated_at:
        new Date().toISOString(),
    };

    localStorage.setItem(
      CHAVE_PROJETO_ATUAL,
      JSON.stringify(
        atualizado
      )
    );

    window.dispatchEvent(
      new CustomEvent(
        "appia:projeto-atualizado",
        {
          detail: atualizado,
        }
      )
    );

    return atualizado;
  } catch (erro) {
    console.error(
      "Erro ao salvar projeto:",
      erro
    );
    return null;
  }
}

export function marcarFotoPronta({
  imagem = "",
  fotos = [],
} = {}) {
  return salvarProjetoAtual({
    foto_pronta: true,
    imagem,
    fotos,
  });
}

export function marcarBannerPronto({
  banner_url = "",
  formato = "",
} = {}) {
  return salvarProjetoAtual({
    banner_pronto: true,
    banner_url,
    banner_formato: formato,
  });
}

export function marcarClipPronto({
  clip_url = "",
  estilo = "",
  formato = "",
  duracao = 0,
} = {}) {
  return salvarProjetoAtual({
    clip_pronto: true,
    clip_url,
    clip_estilo: estilo,
    clip_formato: formato,
    clip_duracao: duracao,
  });
}

export function marcarAnuncioPronto({
  anuncio_id = null,
  titulo = "",
  descricao = "",
  preco = "",
} = {}) {
  return salvarProjetoAtual({
    anuncio_pronto: true,
    anuncio_id,
    titulo,
    descricao,
    preco,
  });
}

export function marcarPublicado({
  marketplace = "",
  publicacao_id = null,
  publicacao_url = "",
} = {}) {
  return salvarProjetoAtual({
    publicado: true,
    marketplace,
    publicacao_id,
    publicacao_url,
    publicado_em:
      new Date().toISOString(),
  });
}

export function limparProjetoAtual() {
  localStorage.removeItem(
    CHAVE_PROJETO_ATUAL
  );

  window.dispatchEvent(
    new CustomEvent(
      "appia:projeto-atualizado",
      {
        detail: null,
      }
    )
  );
}