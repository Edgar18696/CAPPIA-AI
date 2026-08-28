import {
  pesquisarCatalogo,
} from "./catalogoService";

import {
  motorMercado,
} from "./precificacao";

import {
  analisarAnuncio,
} from "./copilotoIA";

import {
  gerarParecerIA,
} from "./copilotoEspecialista";

import {
  executarEspecialistas,
  montarRespostaEspecialistas,
  montarResultadoCopiloto,
  diretorIA,
} from "./copiloto";

function textoSeguro(valor) {
  return String(valor ?? "").trim();
}

export async function motorCopilotoIA({
  pergunta = "",
  codigo = "",
  oem = "",
  titulo = "",
  descricao = "",
  preco = "",
  custo = "",
  fotos = [],
  diagnostico = null,
  auditoria = null,
  pecaEncontrada = null,
  pontuacao = 0,
} = {}) {
  const codigoBusca =
    textoSeguro(
      codigo || oem
    );

  const recomendacoes =
    analisarAnuncio({
      titulo,
      descricao,
      preco,
      fotos,
      diagnostico,
      auditoria,
    });

  const parecer =
    gerarParecerIA({
      recomendacoes,
      pontuacao,
      diagnostico,
    });

  let catalogo = [];
  let mercado = null;

  try {
    if (codigoBusca) {
      catalogo =
        await pesquisarCatalogo({
          fabricante: "",
          termo: codigoBusca,
        });
    }
  } catch (erro) {
    console.warn(
      "Copiloto: erro ao consultar catálogo:",
      erro
    );
  }

  try {
    if (
      codigoBusca ||
      titulo
    ) {
      mercado =
        await motorMercado({
          codigo:
            codigoBusca,

          descricao:
            titulo ||
            descricao,

          shopee: {
            precos: [],
            concorrentes: 0,
          },

          amazon: {
            precos: [],
            concorrentes: 0,
          },
        });
    }
  } catch (erro) {
    console.warn(
      "Copiloto: erro ao consultar mercado:",
      erro
    );
  }

  const contexto = {
    pergunta,
    codigo,
    oem,
    titulo,
    descricao,
    preco,
    custo,
    fotos,
    diagnostico,
    auditoria,
    pecaEncontrada,
    pontuacao,
    catalogo,
    mercado,
    recomendacoes,
    parecer,
  };

  const especialistas =
    executarEspecialistas(
      contexto
    );

  const decisaoFinal =
    diretorIA(
      especialistas
    );

  const {
    tecnico,
    comercial,
    seo,
    marketplace,
    auditoria:
      auditoriaIA,
    publicacao,
  } = especialistas;

  const respostaEspecialistas =
    montarRespostaEspecialistas({
      tecnico,
      comercial,
      seo,
      marketplace,
      auditoria:
        auditoriaIA,
      publicacao,
    });

  const resposta =
    `${decisaoFinal.emoji} ${decisaoFinal.titulo}

${decisaoFinal.texto}

${respostaEspecialistas}`;

  return montarResultadoCopiloto({
    resposta,

    recomendacoes,

    parecer,

    mercado,

    catalogo,

    especialistas: {
      tecnico,
      comercial,
      seo,
      marketplace,
      auditoria:
        auditoriaIA,
      publicacao,
    },
  });
}

export default motorCopilotoIA;