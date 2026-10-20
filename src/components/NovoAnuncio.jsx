import {
  useEffect,
  useRef,
  useState,
} from "react";
import { supabase } from "../supabase";
import { idContaMLAtivaOpcional, useContasML, contasMLConectadas } from "../services/contaMLAtiva";
import { consultorML, modalidadesDaConta } from "../services/consultaMLLeitura";
import { CHAVE_COMISSOES_REFERENCIA, lerComissoesReferencia, comissaoDeReferencia, textoPorcentagem, criarConsultaComCache, assinaturaRecalculo, precisaRecalcular, soFaltaPreco, resumoFrete } from "../services/precificacaoSimples";
import {
  calcularFreteEPrecos,
  situacaoFrete,
  parametrosCotacao,
  baseDePrecificacao,
  precoComMargem,
  resultadoDoPreco,
  prontoParaCotar,
  reais as reaisFrete,
} from "../services/fretePrecificacao";
import {
  buscarDimensoesProduto,
  salvarDimensoesProduto,
  STATUS_DIMENSOES,
  ORIGEM_DIMENSOES,
} from "../services/precificacao/dimensoesProduto";
import PainelCatalogo from "./PainelCatalogo";
import ChecklistAnuncio from "./ChecklistAnuncio";
import PainelFotosAnuncio from "./PainelFotosAnuncio";
import PontuacaoAnuncio from "./PontuacaoAnuncio";
import AnaliseIA from "./AnaliseIA";
import AssistenteAnuncio from "./AssistenteAnuncio";

import DadosPeca from "./DadosPeca";
import useNovoAnuncio, {
  gravarRascunhoAnuncio,
} from "../hooks/useNovoAnuncio";
import {
  decidirAberturaNovoAnuncio,
  escolherRascunho,
  fichaDoRascunho,
  marcarDonoFotosAnuncio,
  precificacaoDoAnuncioEmAndamento,
} from "../services/aberturaNovoAnuncio";
import { enderecoDaFicha } from "../services/fichasCentral";
import useFichaNovoAnuncio from "../hooks/useFichaNovoAnuncio";
import { OPCOES_TIPO_VEICULO, TIPO_CARRO, normalizarTipoVeiculo } from "../services/tipoVeiculoAnuncio";
import { kgParaG, medidaDoNovoAnuncio, textoMedida } from "../services/dadosTecnicosAnuncio";
import {
  gerarAnuncioV2,
} from "../services/inteligencia";

import {
  limparAnuncioTemporario,
} from "../services/anunciosService";

import {
  preencherAnuncioAutomaticamente,
} from "../services/preencherAnuncioService";

// Paizinho — pesquisa em fontes originais (só quando a Base PAIIA não encontra o código)
import PainelPesquisaPaizinho from "./PainelPesquisaPaizinho";
import {
  pesquisarFontesOriginais,
} from "../services/paizinhoPesquisa/pesquisarFontesOriginais";
import {
  MENSAGENS as MENSAGENS_PAIZINHO,
  STATUS_PESQUISA as STATUS_PAIZINHO,
} from "../services/paizinhoPesquisa/validarResultadoPesquisa";
import {
  complementoUtil,
} from "../services/paizinhoPesquisa/complementarBase";
// Fonte própria PAIIA (conhecimento validado) — 1ª etapa da busca
import {
  buscarConhecimentoValidado,
  resultadoDoConhecimento,
} from "../services/paizinhoPesquisa/conhecimentoValidado";
import {
  montarCamposCriarAnuncio,
} from "../services/paizinhoPesquisa/montarAnuncioPesquisa";

const MENSAGEM_BASE_NAO_ENCONTROU =
  "Produto ainda não encontrado na Base PAIIA.";

// Criar Anúncio trabalha SOMENTE com a base interna PAIIA (catálogos/PDFs
// importados e auditados). A pesquisa externa (Claude/internet) fica
// DESACOPLADA deste fluxo — os módulos continuam no projeto para uso futuro
// (manutenção/descoberta de catálogos), mas não são chamados aqui.
const PESQUISA_EXTERNA_CRIAR_ANUNCIO_ATIVA = false;
const MENSAGEM_NAO_ENCONTRADO_CATALOGOS =
  "Código não encontrado em nossos catálogos. Verifique o código informado ou consulte os catálogos disponíveis.";

// Mensagens do serviço que significam "a Base PAIIA não tem esse código"
// (não são erros técnicos): mostram o aviso na tela, sem alerta.
function ehNaoEncontradoNosCatalogos(mensagem) {
  const texto = String(mensagem || "").trim();
  return (
    texto === MENSAGEM_BASE_NAO_ENCONTROU ||
    texto.startsWith("Nenhum resultado foi encontrado para")
  );
}

import {
  marcarAnuncioPronto,
} from "../services/projetoAtualService";

import {
  analisarAnuncio,
} from "../services/copilotoIA";

import {
  gerarParecerIA,
} from "../services/copilotoEspecialista";

import CopilotoChat from "./CopilotoChat";

import {
  motorCopilotoIA,
} from "../services/motorCopilotoIA";



function limitarTituloMercadoLivre(
  tituloOriginal,
  codigoFinal = ""
) {
  const LIMITE = 60;

  const tituloLimpo = String(
    tituloOriginal || ""
  )
    .replace(/\s+/g, " ")
    .trim();

  const codigoLimpo = String(
    codigoFinal || ""
  )
    .replace(/\s+/g, "")
    .trim();

  if (!tituloLimpo) {
    return codigoLimpo.slice(
      0,
      LIMITE
    );
  }

  const tituloSemCodigo =
    codigoLimpo
      ? tituloLimpo
          .replace(
            new RegExp(
              `\\s*${codigoLimpo.replace(
                /[.*+?^${}()|[\]\\]/g,
                "\\$&"
              )}\\s*$`,
              "i"
            ),
            ""
          )
          .trim()
      : tituloLimpo;

  const espacoCodigo =
    codigoLimpo
      ? codigoLimpo.length + 1
      : 0;

  const limiteTexto =
    Math.max(
      0,
      LIMITE - espacoCodigo
    );

  let parteTexto =
    tituloSemCodigo.slice(
      0,
      limiteTexto
    );

  if (
    tituloSemCodigo.length >
      limiteTexto &&
    parteTexto.includes(" ")
  ) {
    parteTexto =
      parteTexto
        .replace(
          /\s+\S*$/,
          ""
        )
        .trim();
  }

  return [
    parteTexto,
    codigoLimpo,
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, LIMITE);
}

function montarTituloMercadoLivreInteligente({
  resultado,
  pecaResultado,
  codigoResultado,
  oemResultado,
}) {
  const codigoFinal = String(
    codigoResultado ||
      oemResultado ||
      ""
  )
    .replace(/\s+/g, "")
    .trim();

  const nomeProduto = String(
    pecaResultado?.peca ||
      resultado?.diagnostico?.peca ||
      ""
  )
    .replace(/\s+/g, " ")
    .trim();

  const fabricante = String(
    pecaResultado?.fabricante ||
      resultado?.diagnostico
        ?.fabricante ||
      ""
  )
    .replace(/\s+/g, " ")
    .trim();

  const descricaoBase = String(
    resultado?.descricao || ""
  )
    .replace(/[□�]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const aplicacoesBrutas = [
    ...(Array.isArray(
      pecaResultado?.aplicacoes
    )
      ? pecaResultado.aplicacoes
      : []),

    ...(Array.isArray(
      resultado?.resultadosCatalogo
    )
      ? resultado.resultadosCatalogo
      : []),

    ...(Array.isArray(
      resultado?.aplicacoes
    )
      ? resultado.aplicacoes
      : []),
  ];

  const ignorarComoModelo = new Set([
    "classic",
    "sedan",
    "hatch",
    "hatchback",
    "wagon",
    "sw",
    "pickup",
    "pick-up",
    "flex",
    "gasolina",
    "alcool",
    "etanol",
    "diesel",
    "powertrain",
  ]);

  function pareceCodigoTecnico(
    valor = ""
  ) {
    const texto = String(
      valor || ""
    ).trim();

    if (!texto) {
      return true;
    }

    const normalizado =
      texto.replace(
        /[^A-Za-z0-9]/g,
        ""
      );

    if (!normalizado) {
      return true;
    }

    const temLetra =
      /[A-Za-z]/.test(
        normalizado
      );

    const temNumero =
      /\d/.test(
        normalizado
      );

    if (
      temLetra &&
      temNumero
    ) {
      return true;
    }

    if (
      /^\d+$/.test(
        normalizado
      )
    ) {
      return true;
    }

    return false;
  }

  function simplificarModelo(
    modelo = ""
  ) {
    const original = String(
      modelo || ""
    )
      .replace(/[□�]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!original) {
      return "";
    }

    const partes = original
      .split(" ")
      .map((parte) =>
        parte
          .replace(
            /^[^A-Za-zÀ-ÿ0-9]+|[^A-Za-zÀ-ÿ0-9-]+$/g,
            ""
          )
          .trim()
      )
      .filter(Boolean);

    for (const parte of partes) {
      const normalizada =
        parte.toLowerCase();

      if (
        parte.length < 3 ||
        ignorarComoModelo.has(
          normalizada
        ) ||
        pareceCodigoTecnico(
          parte
        )
      ) {
        continue;
      }

      return parte;
    }

    return "";
  }

  const modelosCandidatos = [];

  for (
    const item of aplicacoesBrutas
  ) {
    if (
      String(item?.tipo_referencia || "")
        .toLowerCase() === "nota_tecnica"
    ) {
      continue;
    }

    const camposModelo = [
      item?.modelo,
      item?.veiculo,
    ];

    for (
      const campo of camposModelo
    ) {
      const simples =
        simplificarModelo(
          campo
        );

      if (
        simples &&
        !modelosCandidatos.some(
          (atual) =>
            atual.toLowerCase() ===
            simples.toLowerCase()
        )
      ) {
        modelosCandidatos.push(
          simples
        );
      }
    }
  }

  const descricaoNormalizada =
    descricaoBase.toLowerCase();

  const modelosPriorizados = [
    ...modelosCandidatos.filter(
      (modelo) =>
        descricaoNormalizada.includes(
          modelo.toLowerCase()
        )
    ),
    ...modelosCandidatos.filter(
      (modelo) =>
        !descricaoNormalizada.includes(
          modelo.toLowerCase()
        )
    ),
  ];

  const modelosEscolhidos =
    modelosPriorizados.slice(
      0,
      3
    );

  const baseFallback = String(
    resultado?.titulo || ""
  )
    .replace(/[□�]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  let titulo = [
    nomeProduto ||
      baseFallback,
    fabricante,
    ...modelosEscolhidos,
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  if (!titulo) {
    titulo =
      baseFallback ||
      "Peça Automotiva";
  }

  if (
    fabricante &&
    nomeProduto
      .toLowerCase()
      .includes(
        fabricante.toLowerCase()
      )
  ) {
    titulo = [
      nomeProduto,
      ...modelosEscolhidos,
    ]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }

  return limitarTituloMercadoLivre(
    titulo,
    codigoFinal
  );
}


export default function NovoAnuncio({
  usuario,
  cardStyle,
  setScreen,
  fotosAnuncio,
  setFotosAnuncio,
  anuncioEditando: anuncioEditandoApp,
  setAnuncioEditando,
}) {
  // ABERTURA decidida uma vez: criação nova, ficha pedida (?ficha=) ou o
  // anúncio em andamento (services/aberturaNovoAnuncio). Um anúncio novo
  // nunca herda nada de outro; a ficha B mostra só os dados de B.
  const [abertura] = useState(() => decidirAberturaNovoAnuncio());
  // Criação nova pedida / ficha pedida: a edição antiga (Meus Anúncios,
  // Projetos, Meus Rascunhos) que ficou no App não vale aqui.
  const anuncioEditando = abertura.ignorarEdicao ? null : anuncioEditandoApp;
  useEffect(() => {
    if (abertura.ignorarEdicao && anuncioEditandoApp) {
      setAnuncioEditando?.(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // ?ficha= sem o rascunho dela neste navegador: relê a ficha pela base
  // (a Conferência devolve para cá com os dados DELA).
  useEffect(() => {
    if (!abertura.recarregarDaBase) return;
    try {
      window.history.replaceState(window.history.state, "", enderecoDaFicha(window.location.href, abertura.fichaId));
    } catch {
      return;
    }
    setScreen?.("mercadoLivreTeste");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [
    projetoAtual,
    setProjetoAtual,
  ] = useState(() => {
    try {
      const salvo =
        localStorage.getItem(
          "projetoAppiaAtual"
        );

      return salvo
        ? JSON.parse(salvo)
        : null;
    } catch {
      localStorage.removeItem(
        "projetoAppiaAtual"
      );

      return null;
    }
  });
useEffect(() => {
  if (anuncioEditando) {
    return;
  }

  if (abertura.modo === "novo") {
    // Anúncio novo: só o que veio com o pedido (ex.: custo da Precificação).
    if (abertura.dados) {
      aplicarExtrasRascunho(abertura.dados);
    }
    return;
  }

  // O rascunho escolhido na abertura (o mais recente DESTE anúncio/ficha):
  // o F5 não volta a uma versão antiga e nunca abre outra ficha.
  const dadosRestaurar = abertura.rascunho;

  if (!dadosRestaurar) {
    return;
  }

  try {
    const dados = dadosRestaurar;

    setCodigo(
      dados.codigo || ""
    );

    setOem(
      dados.oem || ""
    );

    setTitulo(
      dados.titulo || ""
    );

    setDescricao(
      dados.descricao || ""
    );

    setPreco(
      dados.preco || ""
    );

    setTipoAnuncio(
      dados.tipoAnuncio ||
        "classico"
    );

    setPecaEncontrada(
      dados.pecaEncontrada ||
        null
    );

    setDiagnostico(
      dados.diagnostico ||
        null
    );

    setAuditoria(
      dados.auditoria ||
        null
    );

    aplicarExtrasRascunho(dados);
  } catch (erro) {
    console.error(
      "Erro ao recuperar anúncio temporário:",
      erro
    );
  }
}, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        // Mesmo anúncio da abertura (o rascunho mais recente DELE).
        const dados =
          abertura.modo === "novo"
            ? null
            : escolherRascunho(localStorage, { fichaId: abertura.fichaId || "" });

        if (!dados) {
          return;
        }

        if (
          String(
            dados?.descricao || ""
          ).trim()
        ) {
          setDescricao(
            String(dados.descricao)
          );
        }

        if (
          String(
            dados?.titulo || ""
          ).trim()
        ) {
          setTitulo(
            String(dados.titulo)
          );
        }

        if (
          String(
            dados?.preco ?? ""
          ).trim()
        ) {
          setPreco(
            String(dados.preco)
          );
        }
      } catch (erro) {
        console.error(
          "Erro ao restaurar dados ao voltar para o anúncio:",
          erro
        );
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const fotoPronta =
      localStorage.getItem(
        "fotoPronta"
      );

    if (!fotoPronta) {
      return;
    }

    setFotosAnuncio((fotosAtuais) => {
      const fotos =
        Array.isArray(fotosAtuais)
          ? fotosAtuais
          : [];

      const jaExiste =
        fotos.some(
          (foto) =>
            foto.imagem_processada ===
            fotoPronta
        );

      localStorage.removeItem(
        "fotoPronta"
      );

      if (jaExiste) {
        return fotos;
      }

      return [
        {
          id: `foto-${Date.now()}`,
          imagem_processada:
            fotoPronta,
          tipo: "foto",
          created_at:
            new Date().toISOString(),
        },
        ...fotos,
      ];
    });
  }, [setFotosAnuncio]);
useEffect(() => {
  const voltarParaFotos =
    localStorage.getItem(
      "voltarParaFotosAnuncio"
    );

  if (
    voltarParaFotos !==
    "true"
  ) {
    return;
  }

  localStorage.removeItem(
    "voltarParaFotosAnuncio"
  );

  setTimeout(() => {
    const secao =
      document.getElementById(
        "secao-fotos-anuncio"
      );

    secao?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, 150);
}, []);

  useEffect(() => {
  const rascunhoSalvo =
    localStorage.getItem(
      "rascunhoNovoAnuncioTemp"
    );

  if (!rascunhoSalvo) {
    return;
  }

  try {
    const rascunho =
      JSON.parse(
        rascunhoSalvo
      );

    if (
      !Array.isArray(
        rascunho.fotos
      ) ||
      rascunho.fotos.length === 0
    ) {
      return;
    }

    // Só as fotos do MESMO anúncio da abertura (nunca de outra ficha).
    if (
      abertura.modo === "novo" ||
      fichaDoRascunho(rascunho) !== (abertura.fichaId || "")
    ) {
      return;
    }

    setFotosAnuncio(
      (fotosAtuais) => {
        const atuais =
          Array.isArray(
            fotosAtuais
          )
            ? fotosAtuais
            : [];

        // As fotos em memória mandam (ordem, capa e versão completa).
        // O rascunho (só URLs) só repõe quando a memória está vazia.
        if (atuais.length) {
          return atuais;
        }

        const todas = [
          ...rascunho.fotos,
        ];

        return todas.filter(
          (
            foto,
            index,
            lista
          ) => {
            const url =
              foto?.imagem_processada ||
              foto?.imagem_original ||
              foto?.url ||
              foto?.src ||
              "";

            return (
              url &&
              index ===
                lista.findIndex(
                  (item) =>
                    (
                      item?.imagem_processada ||
                      item?.imagem_original ||
                      item?.url ||
                      item?.src ||
                      ""
                    ) === url
                )
            );
          }
        );
      }
    );
  } catch (erro) {
    console.error(
      "Erro ao recuperar fotos do fluxo:",
      erro
    );
  }
}, [setFotosAnuncio]);

  const [codigo, setCodigo] = useState("");
const [oem, setOem] = useState("");
const [titulo, setTitulo] = useState("");
const [descricao, setDescricao] = useState("");
const [preco, setPreco] = useState("");
const [tipoAnuncio, setTipoAnuncio] =
  useState("classico");

const [canalVenda, setCanalVenda] =
  useState(() =>
    localStorage.getItem("canalVendaAppia") ||
    "mercado_livre"
  );

const [pesquisandoConcorrencia, setPesquisandoConcorrencia] =
  useState(false);
const [resultadoConcorrencia, setResultadoConcorrencia] =
  useState(null);
const [erroConcorrencia, setErroConcorrencia] =
  useState("");
const [categoriaConcorrencia, setCategoriaConcorrencia] =
  useState("");

const [custo, setCusto] =
  useState("");
const [fretePrecificacao, setFretePrecificacao] =
  useState("");
// (19/10) Frete de COMPRA (o que você paga para receber a peça, por
// unidade): entra no custo. Frete de VENDA é outro valor: no Mercado Livre
// vem da cotação oficial; na Shopee/site é o que você informar.
const [freteCompraPrecificacao, setFreteCompraPrecificacao] =
  useState("");
// Conta Mercado Livre DESTE anúncio para cotar o frete ("" = conta ativa).
const [contaAnuncioML, setContaAnuncioML] =
  useState("");

const [despesasPrecificacao, setDespesasPrecificacao] =
  useState("3,00");

const [comissaoPrecificacao, setComissaoPrecificacao] =
  useState("12");

const [impostoPrecificacao, setImpostoPrecificacao] =
  useState("8");

const [mostrarCustoDetalhado, setMostrarCustoDetalhado] =
  useState(false);

const [custoCompraDetalhado, setCustoCompraDetalhado] =
  useState("");

const [freteCompraDetalhado, setFreteCompraDetalhado] =
  useState("");

const [embalagemDetalhada, setEmbalagemDetalhada] =
  useState("");

const [despesasFixasMensais, setDespesasFixasMensais] =
  useState("");

const [vendasMediasMes, setVendasMediasMes] =
  useState("");

const [outrosCustosDetalhados, setOutrosCustosDetalhados] =
  useState("");

const [, setCalculandoCustosML] =
  useState(false);

const [resultadoCustosML, setResultadoCustosML] =
  useState(null);
const [, setMostrarCalculoFreteML] =
  useState(false);

const [pesoFreteML, setPesoFreteML] =
  useState("");

const [alturaFreteML, setAlturaFreteML] =
  useState("");

const [larguraFreteML, setLarguraFreteML] =
  useState("");

const [comprimentoFreteML, setComprimentoFreteML] =
  useState("");

// FRETE ML × PRECIFICAÇÃO: UM registro (cotação oficial do ML da conta
// ativa) que segue a ficha até a Conferência, a Publicação e o Bling.
const [registroFreteML, setRegistroFreteML] =
  useState(null);

// DADOS TÉCNICOS (uma fonte só): tipo de veículo da ficha (anúncio novo =
// Carro/Caminhonete) e o MESMO peso/medidas do cálculo de frete.
const [tipoVeiculoNA, setTipoVeiculoNA] =
  useState(TIPO_CARRO);
// Quando o usuário editou cada dado técnico aqui (a Conferência usa isso
// para saber que houve edição real depois dela).
const [edicoesDadosTecnicos, setEdicoesDadosTecnicos] =
  useState({});
function alterarDadoTecnico(campo, valor) {
  const agora = new Date().toISOString();
  if (campo === "tipoVeiculo") {
    setTipoVeiculoNA(normalizarTipoVeiculo(valor) || TIPO_CARRO);
    setEdicoesDadosTecnicos((e) => ({ ...e, tipoVeiculo: agora }));
    return;
  }
  const setters = { pesoFreteML: setPesoFreteML, alturaFreteML: setAlturaFreteML, larguraFreteML: setLarguraFreteML, comprimentoFreteML: setComprimentoFreteML };
  setters[campo]?.(valor);
  setEdicoesDadosTecnicos((e) => ({ ...e, embalagem: agora }));
}
function zerarDadosTecnicos() {
  setRegistroFreteML(null);
  setTipoVeiculoNA(TIPO_CARRO);
  setEdicoesDadosTecnicos({});
  setPesoFreteML("");
  setAlturaFreteML("");
  setLarguraFreteML("");
  setComprimentoFreteML("");
}

/*
 * COMISSÃO (19/10/2026): referência por canal/tipo (Clássico 12%,
 * Premium 17%, Shopee 20% — ajustáveis nas opções avançadas). A troca de
 * tipo/canal FEITA PELO USUÁRIO aplica a referência; abrir/F5/reabrir a
 * ficha NUNCA sobrescreve a comissão salva (antes, o efeito voltava para
 * 12/17% ao restaurar e a cotação ficava "desatualizada").
 */
const [comissoesReferencia] = useState(() => {
  try {
    return lerComissoesReferencia(localStorage.getItem(CHAVE_COMISSOES_REFERENCIA));
  } catch {
    return lerComissoesReferencia(null);
  }
});
// true = a comissão atual foi escolhida/restaurada (não é o padrão inicial).
const comissaoDefinidaRef = useRef(false);
useEffect(() => {
  if (comissaoDefinidaRef.current) return;
  const ref = comissaoDeReferencia({ canal: canalVenda, tipo: tipoAnuncio, refs: comissoesReferencia });
  if (ref !== null) setComissaoPrecificacao(textoPorcentagem(ref));
}, [tipoAnuncio, canalVenda]); // eslint-disable-line react-hooks/exhaustive-deps
function marcarEdicaoPrecificacao(campo) {
  const agora = new Date().toISOString();
  setEdicoesDadosTecnicos((e) => ({ ...e, [campo]: agora }));
}
/** Clássico/Premium escolhido pelo usuário: aplica a comissão de referência e recalcula sozinho. */
function escolherTipoAnuncio(tipo) {
  setCanalVenda("mercado_livre");
  if (tipo !== tipoAnuncio || canalVenda !== "mercado_livre") {
    setTipoAnuncio(tipo);
    setComissaoPrecificacao(textoPorcentagem(comissaoDeReferencia({ canal: "mercado_livre", tipo, refs: comissoesReferencia })));
    comissaoDefinidaRef.current = true;
    marcarEdicaoPrecificacao("tipoAnuncio");
  }
}
function escolherCanal(canal) {
  if (canal === canalVenda) return;
  setCanalVenda(canal);
  const ref = comissaoDeReferencia({ canal, tipo: tipoAnuncio, refs: comissoesReferencia });
  if (ref !== null) {
    setComissaoPrecificacao(textoPorcentagem(ref));
    comissaoDefinidaRef.current = true;
  }
}
function alterarComissao(valor) {
  comissaoDefinidaRef.current = true;
  setComissaoPrecificacao(valor);
}
/** Preço final digitado/escolhido pelo usuário (nunca muda sozinho). */
function alterarPrecoFinal(valor) {
  setPreco(valor);
  marcarEdicaoPrecificacao("preco");
}

useEffect(() => {
  localStorage.setItem(
    "canalVendaAppia",
    canalVenda
  );

  localStorage.setItem(
    "tipoAnuncioAppia",
    tipoAnuncio
  );
}, [canalVenda, tipoAnuncio]);

function numeroPrecificacao(valor) {
  const texto = String(valor ?? "")
    .replace(/[^\d,.-]/g, "")
    .trim();

  if (!texto) {
    return 0;
  }

  const normalizado =
    texto.includes(",")
      ? texto
          .replace(/\./g, "")
          .replace(",", ".")
      : texto;

  const numero = Number(normalizado);

  return Number.isFinite(numero)
    ? numero
    : 0;
}

// (19/10) UMA fórmula só (services/fretePrecificacao): custo da mercadoria
// + frete de compra + embalagem; comissão e impostos sobre o preço; frete
// de VENDA: no Mercado Livre o da cotação oficial (nunca inventado nem
// zero), na Shopee/site o informado por você.
function basePrecificacaoAtual() {
  return baseDePrecificacao({
    custo: numeroPrecificacao(custo) + numeroPrecificacao(freteCompraPrecificacao),
    despesas: despesasPrecificacao,
    comissao: comissaoPrecificacao,
    imposto: impostoPrecificacao,
  });
}
function calcularPrecoComMargem(
  margemLiquida
) {
  if (canalVenda === "mercado_livre") {
    // Preços CONVERGIDOS com o frete cotado na faixa de cada preço. Sem
    // cotação válida não há preço (nada de frete zero ou inventado).
    const chave = { 10: "conservador", 15: "recomendado", 20: "ideal" }[margemLiquida];
    const m = chave ? registroFreteML?.margens?.[chave] : null;
    return m && m.preco > 0 && registroFreteML?.origem === "mercado_livre" ? m.preco : 0;
  }
  return precoComMargem({ base: basePrecificacaoAtual(), frete: numeroPrecificacao(fretePrecificacao), margem: margemLiquida });
}

const precoMargem10 =
  calcularPrecoComMargem(10);

const precoMargem15 =
  calcularPrecoComMargem(15);

const precoMargem20 =
  calcularPrecoComMargem(20);

const precoAtualNumero =
  numeroPrecificacao(preco);

const despesaFixaPorVenda =
  numeroPrecificacao(
    despesasFixasMensais
  ) > 0 &&
  numeroPrecificacao(
    vendasMediasMes
  ) > 0
    ? numeroPrecificacao(
        despesasFixasMensais
      ) /
      numeroPrecificacao(
        vendasMediasMes
      )
    : 0;

const custoRealDetalhado =
  numeroPrecificacao(
    custoCompraDetalhado
  ) +
  numeroPrecificacao(
    freteCompraDetalhado
  ) +
  numeroPrecificacao(
    embalagemDetalhada
  ) +
  despesaFixaPorVenda +
  numeroPrecificacao(
    outrosCustosDetalhados
  );

function usarCustoDetalhadoNaPrecificacao() {
  if (
    !Number.isFinite(
      custoRealDetalhado
    ) ||
    custoRealDetalhado <= 0
  ) {
    alert(
      "Informe pelo menos o custo da mercadoria no cálculo detalhado."
    );
    return;
  }

  // Frete de compra vai para o campo próprio (não é somado duas vezes).
  setCusto(
    (custoRealDetalhado - numeroPrecificacao(freteCompraDetalhado))
      .toFixed(2)
      .replace(".", ",")
  );
  setFreteCompraPrecificacao(
    numeroPrecificacao(freteCompraDetalhado) > 0
      ? numeroPrecificacao(freteCompraDetalhado).toFixed(2).replace(".", ",")
      : ""
  );

  setDespesasPrecificacao(
    "0,00"
  );

  setMostrarCustoDetalhado(
    false
  );
}

// (19/10) Calculadora antiga de custos do ML: fora da janela de precificação.
// eslint-disable-next-line no-unused-vars
async function calcularCustosMercadoLivre() {
  if (!usuario?.id) {
    alert(
      "Usuário não identificado. Entre novamente no PAIIA."
    );
    return;
  }

  const peso =
    numeroPrecificacao(
      pesoFreteML
    );

  const altura =
    numeroPrecificacao(
      alturaFreteML
    );

  const largura =
    numeroPrecificacao(
      larguraFreteML
    );

  const comprimento =
    numeroPrecificacao(
      comprimentoFreteML
    );

  if (
    peso <= 0 ||
    altura <= 0 ||
    largura <= 0 ||
    comprimento <= 0
  ) {
    alert(
      "Informe peso, altura, largura e comprimento da embalagem."
    );
    return;
  }

  const custoProduto =
    numeroPrecificacao(
      custoCompraDetalhado ||
      custo
    );

  /*
   * Se o usuário ainda não escolheu
   * o preço final, usamos o preço
   * recomendado atual como referência
   * para a consulta ao Mercado Livre.
   */
  const precoInformado =
    numeroPrecificacao(preco);

  const precoReferencia =
    precoInformado > 0
      ? precoInformado
      : precoMargem15;

  if (precoReferencia <= 0) {
    alert(
      "Informe primeiro o custo da mercadoria."
    );
    return;
  }

  try {
    setCalculandoCustosML(
      true
    );

    const { data, error } =
      await supabase.functions.invoke(
        "calcular-custos-mercado-livre",
        {
          body: {
            usuarioId:
              usuario.id,

            conta_ml:
              await idContaMLAtivaOpcional(),

            precoVenda:
              precoReferencia,

            custoProduto,

            categoriaId:
              pecaEncontrada
                ?.categoria_id ||
              diagnostico
                ?.categoria_id ||
              "",

            listingTypeId:
              tipoAnuncio ===
              "premium"
                ? "gold_pro"
                : "gold_special",

            shippingMode:
              "me2",

            logisticType:
              "drop_off",

            peso,
            altura,
            largura,
            comprimento,

            freteGratis:
              true,
          },
        }
      );

    if (error) {
      throw new Error(
        error.message ||
          "A função de custos não respondeu."
      );
    }

    if (!data?.ok) {
      throw new Error(
        data?.erro ||
          "Não foi possível calcular os custos do Mercado Livre."
      );
    }

    setResultadoCustosML(
      data
    );

    const freteCalculado =
      Number(
        data?.freteVendedor
      );

    if (
      !Number.isFinite(
        freteCalculado
      ) ||
      freteCalculado <= 0
    ) {
      throw new Error(
        "O Mercado Livre não retornou um valor válido de frete."
      );
    }

    const freteFormatado =
      freteCalculado
        .toFixed(2)
        .replace(".", ",");

    /*
     * Preenche o frete principal.
     * Os preços Conservador,
     * Recomendado e Ideal serão
     * recalculados automaticamente.
     */
    setFretePrecificacao(
      freteFormatado
    );

    setFreteCompraDetalhado(
      freteFormatado
    );

    setMostrarCalculoFreteML(
      false
    );

    // Frete automático: registra o resultado e grava na base PAIIA
    // o peso/medidas confirmados pelo usuário (MANUAL/ESTIMADO).
    registrarFreteManual(
      freteCalculado,
      peso,
      altura,
      largura,
      comprimento
    );

    console.log(
      "✅ FRETE MERCADO LIVRE:",
      data
    );
  } catch (erro) {
    console.error(
      "❌ ERRO FRETE ML:",
      erro
    );

    alert(
      erro?.message ||
        "Não foi possível calcular o frete do Mercado Livre."
    );
  } finally {
    setCalculandoCustosML(
      false
    );
  }
}

function aplicarPrecoSugerido(valor) {
  if (!valor || valor <= 0) {
    alert(
      "Informe primeiro o custo da mercadoria."
    );
    return;
  }

  const valorFormatado =
    Number(valor)
      .toFixed(2)
      .replace(".", ",");

  alterarPrecoFinal(valorFormatado);
}

function formatarPrecoAppia(
  valor
) {
  return Number(
    valor || 0
  ).toLocaleString(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL",
    }
  );
}
  useEffect(() => {
  const precoSugerido =
    localStorage.getItem(
      "precoSugeridoAppia"
    );

  let dadosPrecificacao = {};

  try {
    dadosPrecificacao =
      JSON.parse(
        localStorage.getItem(
          "dadosPrecificacaoAppia"
        ) || "{}"
      );
  } catch {
    dadosPrecificacao = {};
  }

  // Consumidas aqui: preço/custo de uma precificação nunca passam para
  // outro anúncio (o anúncio novo recebe os dele no pedido de criação).
  localStorage.removeItem("precoSugeridoAppia");
  localStorage.removeItem("dadosPrecificacaoAppia");

  if (
    abertura.modo === "novo" ||
    !precoSugerido ||
    !(
      precificacaoDoAnuncioEmAndamento(dadosPrecificacao) ||
      fichaDoRascunho(dadosPrecificacao) === (abertura.fichaId || "")
    )
  ) {
    return;
  }

  if (dadosPrecificacao?.custo) {
    setCusto(
      String(
        dadosPrecificacao.custo
      )
    );
  }

  setPreco(
    precoSugerido
  );

  const salvo =
    localStorage.getItem(
      "novoAnuncioTemporario"
    );

  if (salvo) {
    try {
      const dados =
        JSON.parse(salvo);

      gravarRascunhoAnuncio(
      "novoAnuncioTemporario",
      {
        ...extrasRascunho,
        ...({
          ...dados,
          preco:
            precoSugerido,
          custo:
            dadosPrecificacao?.custo ||
            dados?.custo ||
            "",
        }),
      }
    );
    } catch (erro) {
      console.error(
        "Erro ao atualizar preço retornado:",
        erro
      );
    }
  }

  localStorage.removeItem(
    "precoSugeridoAppia"
  );
}, []);

  const [
    clipAnuncio,
    setClipAnuncio,
  ] = useState(() => {
    // Clip DESTE anúncio: novo = nenhum; ficha reaberta = o da ficha;
    // volta do Clip IA = o recém-escolhido (ou o do rascunho).
    if (abertura.modo === "novo") {
      return "";
    }
    if (abertura.modo === "ficha") {
      return String(abertura.rascunho?.clip || "");
    }
    return (
      localStorage.getItem(
        "clipPronto"
      ) ||
      localStorage.getItem(
        "clipSelecionado"
      ) ||
      String(abertura.rascunho?.clip || "")
    );
  });

  const [
    statusGeracaoClip,
    setStatusGeracaoClip,
  ] = useState(() => {
    return (
      localStorage.getItem(
        "clipGeracaoStatus"
      ) || ""
    );
  });

  const [
    mensagemGeracaoClip,
    setMensagemGeracaoClip,
  ] = useState(() => {
    return (
      localStorage.getItem(
        "clipGeracaoMensagem"
      ) || ""
    );
  });

  useEffect(() => {
    function sincronizarClip() {
      const status =
        localStorage.getItem(
          "clipGeracaoStatus"
        ) || "";

      const mensagem =
        localStorage.getItem(
          "clipGeracaoMensagem"
        ) || "";

      const clipPronto =
        localStorage.getItem(
          "clipPronto"
        ) || "";

      setStatusGeracaoClip(
        status
      );

      setMensagemGeracaoClip(
        mensagem
      );

      if (
        status === "pronto" &&
        clipPronto
      ) {
        setClipAnuncio(
          clipPronto
        );
      }
    }

    function aoClipGerando() {
      sincronizarClip();
    }

    function aoClipPronto(
      evento
    ) {
      const urlClip =
        evento?.detail
          ?.urlClip ||
        localStorage.getItem(
          "clipPronto"
        ) ||
        "";

      if (urlClip) {
        setClipAnuncio(
          urlClip
        );
      }

      sincronizarClip();
    }

    function aoClipErro() {
      sincronizarClip();
    }

    window.addEventListener(
      "appia:clip-gerando",
      aoClipGerando
    );

    window.addEventListener(
      "appia:clip-pronto",
      aoClipPronto
    );

    window.addEventListener(
      "appia:clip-erro",
      aoClipErro
    );

    const intervalo =
      window.setInterval(
        sincronizarClip,
        2000
      );

    sincronizarClip();

    return () => {
      window.removeEventListener(
        "appia:clip-gerando",
        aoClipGerando
      );

      window.removeEventListener(
        "appia:clip-pronto",
        aoClipPronto
      );

      window.removeEventListener(
        "appia:clip-erro",
        aoClipErro
      );

      window.clearInterval(
        intervalo
      );
    };
  }, []);


  const [pecaEncontrada, setPecaEncontrada] = useState(null);
  const [diagnostico, setDiagnostico] = useState(null);
  const [auditoria, setAuditoria] = useState(null);

  /*
   * ============================================
   * FRETE AUTOMÁTICO MERCADO LIVRE
   * (Calcule o preço ideal)
   * Busca peso/medidas em fontes confiáveis (base PAIIA → catálogo →
   * anúncio próprio no ML). Sem dado confiável, NÃO calcula: pede os dados.
   * Estimativa por categoria é só sugestão e nunca calcula sozinha.
   * ============================================
   */
  // ===== FRETE ML × PRECIFICAÇÃO (ordem: CONTA → PESO/EMBALAGEM → COTAÇÃO
  // ML → PRECIFICAÇÃO). Cotação oficial da conta ativa; sem cotação real,
  // ESTIMATIVA PAIIA identificada (publicação bloqueada). =====
  const estadoContasNA = useContasML();
  // (19/10) Conta Mercado Livre DO ANÚNCIO (escolhida aqui entre as contas
  // conectadas em Contas Marketplace); sem escolha, a conta ativa.
  const contasConectadasNA = contasMLConectadas(estadoContasNA);
  const contaEscolhidaNA = contasConectadasNA.find((c) => String(c.ml_user_id) === String(contaAnuncioML)) || null;
  const contaAtivaNA = contaEscolhidaNA || contasConectadasNA.find((c) => c.ativa) || null;
  const contaFreteId = String(contaAtivaNA?.ml_user_id || "");
  const [modalidadesFrete, setModalidadesFrete] = useState({ carregando: false, lista: [], erro: "" });
  const [modalidadeFreteML, setModalidadeFreteML] = useState("");
  useEffect(() => {
    let ativo = true;
    (async () => {
      if (canalVenda !== "mercado_livre" || !contaFreteId) {
        if (ativo) setModalidadesFrete({ carregando: false, lista: [], erro: "" });
        return;
      }
      if (ativo) setModalidadesFrete((m) => ({ ...m, carregando: true, erro: "" }));
      const r = await modalidadesDaConta(contaFreteId);
      if (!ativo) return;
      setModalidadesFrete({ carregando: false, lista: r.modalidades || [], erro: r.ok ? "" : r.erro });
      setModalidadeFreteML((atual) => (atual && (r.modalidades || []).some((x) => x.tipo === atual) ? atual : r.modalidades?.[0]?.tipo || ""));
    })();
    return () => { ativo = false; };
  }, [contaFreteId, canalVenda]);
  const medidaFreteNA = medidaDoNovoAnuncio({ pesoFreteML, alturaFreteML, larguraFreteML, comprimentoFreteML });
  const paramsFreteNA = parametrosCotacao({
    conta: contaFreteId,
    medida: medidaFreteNA,
    modalidade: modalidadeFreteML,
    categoria: pecaEncontrada?.categoria_id || diagnostico?.categoria_id || "",
    tipoAnuncio,
  });
  const baseFreteNA = basePrecificacaoAtual();
  const situacaoFreteNA = situacaoFrete({ registro: registroFreteML, atual: { ...paramsFreteNA, preco, base: baseFreteNA } });
  const [cotacaoFrete, setCotacaoFrete] = useState({ ocupado: false, erro: "" });
  // Cotações já feitas nesta tela (por caminho = conta, medidas, modalidade,
  // tipo, categoria e preço): trocar Clássico ↔ Premium ou a comissão
  // reaproveita, sem nova consulta e sem pedir confirmação de novo.
  const cacheCotacoesRef = useRef(new Map());
  const consultaFreteCacheada = (conta) => criarConsultaComCache({ consultar: consultorML(conta), cache: cacheCotacoesRef.current });
  const assinaturaFreteNA = assinaturaRecalculo({ params: paramsFreteNA, base: baseFreteNA, preco: numeroPrecificacao(preco) });
  const ultimaTentativaFreteRef = useRef("");
  async function cotarFreteEPrecos() {
    const falta = prontoParaCotar(paramsFreteNA);
    if (falta.length) {
      setCotacaoFrete({ ocupado: false, erro: `Antes de cotar o frete: ${falta.join(", ")}.` });
      return;
    }
    if (!(baseFreteNA.custo > 0)) {
      setCotacaoFrete({ ocupado: false, erro: "Informe o custo da mercadoria para calcular os preços." });
      return;
    }
    setCotacaoFrete({ ocupado: true, erro: "" });
    ultimaTentativaFreteRef.current = assinaturaFreteNA;
    const r = await calcularFreteEPrecos({ params: paramsFreteNA, base: baseFreteNA, precoFinal: numeroPrecificacao(preco), consultar: consultaFreteCacheada(contaFreteId), estimar: false });
    if (!r.ok) {
      // Falhou: mostra o motivo REAL e não deixa preço de outra cotação na tela.
      setRegistroFreteML(null);
      setCotacaoFrete({ ocupado: false, erro: r.erro, falhou: true });
      return;
    }
    setRegistroFreteML(r.registro);
    const ref = r.registro.final ? r.registro.final.custo_vendedor : r.registro.margens.recomendado.frete;
    setFretePrecificacao(Number(ref).toFixed(2).replace(".", ","));
    setCotacaoFrete({ ocupado: false, erro: "" });
  }
  // RECÁLCULO AUTOMÁTICO (19/10/2026): com conta, peso/medidas, modalidade
  // e custo prontos, cota e calcula sozinho; e recalcula sozinho quando
  // tipo, comissão, custos, medidas, modalidade, conta ou o preço mudam
  // (cotações iguais vêm do cache). Uma tentativa por conjunto de dados:
  // erro não entra em laço (o botão continua para tentar de novo).
  const precisaRecalcularNA = canalVenda === "mercado_livre" && !cotacaoFrete.ocupado && precisaRecalcular({
    pronto: !prontoParaCotar(paramsFreteNA).length && baseFreteNA.custo > 0,
    situacao: situacaoFreteNA,
    registro: registroFreteML,
    preco: numeroPrecificacao(preco),
    assinatura: assinaturaFreteNA,
    ultimaTentativa: ultimaTentativaFreteRef.current,
  });
  useEffect(() => {
    if (!precisaRecalcularNA) return undefined;
    const t = setTimeout(() => { cotarFreteEPrecos(); }, 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [precisaRecalcularNA, assinaturaFreteNA]);

  const [dimensoesFrete, setDimensoesFrete] = useState(null);
  const [, setStatusFreteAuto] = useState("idle");
  const [, setFreteAutoInfo] = useState(null);
  const [, setErroFreteAuto] = useState("");
  const [estimativaFrete, setEstimativaFrete] = useState(null);
  // Embalagem do anúncio ML / catálogo: SÓ COMPARAÇÃO (não é medida física real).
  const [, setComparacoesFrete] = useState([]);
  const [dimensoesManuaisDeEstimativa, setDimensoesManuaisDeEstimativa] =
    useState(null);
  const ultimoFreteAutoRef = useRef("");
  const inputFotosComputadorRef = useRef(null);
  const [envioFotosPC, setEnvioFotosPC] = useState({ ocupado: false, texto: "", notas: [], erros: [] });
  // Salvar a ficha antes de sair do Novo Anúncio pela seta "Voltar".
  const [saidaNA, setSaidaNA] = useState({ salvando: false, erro: "" });
  const [, setAvisoGravacaoFrete] = useState("");

  function conferirGravacaoFrete(resultadoGravacao) {
    setAvisoGravacaoFrete(
      resultadoGravacao?.ok
        ? ""
        : "⚠️ Peso e medidas NÃO foram gravados na base PAIIA (a próxima pesquisa não vai reaproveitar)."
    );
  }

  const chavePecaFrete = pecaEncontrada
    ? [
        pecaEncontrada.codigo_oem,
        pecaEncontrada.codigo_equivalente,
        pecaEncontrada.peca,
      ]
        .map((v) => String(v || ""))
        .join("|")
    : "";

  function codigosParaFrete() {
    const extras = String(
      pecaEncontrada?.codigo_equivalente || ""
    )
      .split(/[,;/|]/)
      .map((c) => c.trim());
    return [
      codigo,
      pecaEncontrada?.codigo_oem,
      ...extras,
    ].filter(Boolean);
  }

  function formatarNumeroFrete(valor, casas = 2) {
    return Number(valor || 0)
      .toFixed(casas)
      .replace(".", ",");
  }

  // eslint-disable-next-line no-unused-vars
  function textoEmbalagemFrete(d) {
    if (!d) return "";
    const n = (v) =>
      String(Math.round(Number(v) * 10) / 10).replace(".", ",");
    return `${n(d.comprimento_cm)} × ${n(d.largura_cm)} × ${n(d.altura_cm)} cm`;
  }

  function limparFreteAutomaticoAnterior() {
    const anterior = ultimoFreteAutoRef.current;
    if (anterior) {
      setFretePrecificacao((atual) =>
        atual === anterior ? "" : atual
      );
      setFreteCompraDetalhado((atual) =>
        atual === anterior ? "" : atual
      );
    }
    ultimoFreteAutoRef.current = "";
  }

  /* 1) Peça identificada → procurar peso e medidas confiáveis. */
  useEffect(() => {
    let ativo = true;

    limparFreteAutomaticoAnterior();
    setDimensoesFrete(null);
    setFreteAutoInfo(null);
    setEstimativaFrete(null);
    setComparacoesFrete([]);
    setErroFreteAuto("");
    setDimensoesManuaisDeEstimativa(null);
    setAvisoGravacaoFrete("");

    if (!chavePecaFrete) {
      setStatusFreteAuto("idle");
      return () => {
        ativo = false;
      };
    }

    setStatusFreteAuto("buscando");

    (async () => {
      try {
        const resultado = await buscarDimensoesProduto({
          codigos: codigosParaFrete(),
          peca: pecaEncontrada,
          usuarioId: usuario?.id,
        });

        if (!ativo) return;

        if (resultado?.confiavel) {
          setDimensoesFrete(resultado);
          setStatusFreteAuto("dimensoes_ok");

          // Deixa os dados à vista no cálculo manual, para correção — SÓ em
          // campo vazio: o que a ficha/usuário já tem nunca é sobrescrito.
          setPesoFreteML((atual) =>
            String(atual || "").trim() ? atual : formatarNumeroFrete(resultado.peso_g / 1000, 3)
          );
          setComprimentoFreteML((atual) =>
            String(atual || "").trim() ? atual : String(resultado.comprimento_cm).replace(".", ",")
          );
          setLarguraFreteML((atual) =>
            String(atual || "").trim() ? atual : String(resultado.largura_cm).replace(".", ",")
          );
          setAlturaFreteML((atual) =>
            String(atual || "").trim() ? atual : String(resultado.altura_cm).replace(".", ",")
          );

          // Só a medida própria do usuário chega aqui: nada é gravado
          // automaticamente (o navegador não promove nível de confiança).
        } else {
          setEstimativaFrete(resultado?.estimativa || null);
          setComparacoesFrete(resultado?.comparacoes || []);
          setStatusFreteAuto("sem_dados");
        }
      } catch (erro) {
        console.error("Erro ao buscar peso/medidas:", erro);
        if (ativo) setStatusFreteAuto("sem_dados");
      }
    })();

    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chavePecaFrete]);

  async function calcularFreteAutomatico(d) {
    if (!usuario?.id || !d?.confiavel) return;

    const precoInformado = numeroPrecificacao(preco);
    const precoReferencia =
      precoInformado > 0 ? precoInformado : precoMargem15;

    if (precoReferencia <= 0) {
      setStatusFreteAuto("aguardando_custo");
      return;
    }

    setStatusFreteAuto("calculando");
    setErroFreteAuto("");

    try {
      const { data, error } = await supabase.functions.invoke(
        "calcular-custos-mercado-livre",
        {
          body: {
            usuarioId: usuario.id,
            conta_ml: await idContaMLAtivaOpcional(),
            precoVenda: precoReferencia,
            custoProduto: numeroPrecificacao(
              custoCompraDetalhado || custo
            ),
            categoriaId:
              pecaEncontrada?.categoria_id ||
              diagnostico?.categoria_id ||
              "",
            listingTypeId:
              tipoAnuncio === "premium"
                ? "gold_pro"
                : "gold_special",
            shippingMode: "me2",
            logisticType: "drop_off",
            peso: d.peso_g / 1000,
            altura: d.altura_cm,
            largura: d.largura_cm,
            comprimento: d.comprimento_cm,
            freteGratis: true,
          },
        }
      );

      if (error) {
        throw new Error(
          error.message || "A função de custos não respondeu."
        );
      }
      if (!data?.ok) {
        // Sem conta ML conectada/token: frete fica PENDENTE (nada é estimado).
        const semConexao =
          data?.etapa === "conta_marketplace" ||
          /conta mercado livre|access_token|token/i.test(String(data?.erro || ""));
        throw new Error(
          semConexao
            ? "a conta Mercado Livre ainda não está conectada ao PAIIA (Contas Marketplace)."
            : data?.erro ||
              "Não foi possível calcular os custos do Mercado Livre."
        );
      }

      const valor = Number(data?.freteVendedor);
      if (!Number.isFinite(valor) || valor <= 0) {
        throw new Error(
          "O Mercado Livre não retornou um valor válido de frete."
        );
      }

      const formatado = formatarNumeroFrete(valor);
      const anterior = ultimoFreteAutoRef.current;

      // Não sobrescreve um frete que o usuário digitou por conta própria.
      setFretePrecificacao((atual) =>
        !atual || atual === anterior ? formatado : atual
      );
      setFreteCompraDetalhado((atual) =>
        !atual || atual === anterior ? formatado : atual
      );
      ultimoFreteAutoRef.current = formatado;

      setResultadoCustosML(data);
      setFreteAutoInfo({
        valor,
        manual: d.status === STATUS_DIMENSOES.MANUAL,
        peso_g: d.peso_g,
        comprimento_cm: d.comprimento_cm,
        largura_cm: d.largura_cm,
        altura_cm: d.altura_cm,
        status: d.status,
        nivel: d.nivel,
        origem: d.origem,
      });
      setStatusFreteAuto("ok");
    } catch (erro) {
      console.error("❌ FRETE AUTOMÁTICO ML:", erro);
      // Não deixa um frete automático antigo no cálculo quando falhar.
      limparFreteAutomaticoAnterior();
      setResultadoCustosML(null);
      setErroFreteAuto(
        erro?.message ||
          "Não foi possível calcular o frete do Mercado Livre."
      );
      setStatusFreteAuto("erro");
    }
  }

  /* 2) (Substituído no Mercado Livre pela cotação ÚNICA frete × preço:
   *     o cálculo antigo não roda mais — evita dois fretes diferentes.) */
  useEffect(() => {
    if (!dimensoesFrete?.confiavel) return undefined;
    if (canalVenda === "mercado_livre") return undefined;
    if (canalVenda !== "mercado_livre") return undefined;

    if (numeroPrecificacao(custo) <= 0 && numeroPrecificacao(preco) <= 0) {
      setStatusFreteAuto("aguardando_custo");
      return undefined;
    }

    const temporizador = setTimeout(() => {
      calcularFreteAutomatico(dimensoesFrete);
    }, 900);

    return () => clearTimeout(temporizador);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dimensoesFrete, custo, tipoAnuncio, canalVenda]);

  // eslint-disable-next-line no-unused-vars
  function usarEstimativaParaRevisar() {
    if (!estimativaFrete) return;
    const valores = {
      peso: formatarNumeroFrete(estimativaFrete.peso_g / 1000, 3),
      comprimento: String(estimativaFrete.comprimento_cm),
      largura: String(estimativaFrete.largura_cm),
      altura: String(estimativaFrete.altura_cm),
    };
    setPesoFreteML(valores.peso);
    setComprimentoFreteML(valores.comprimento);
    setLarguraFreteML(valores.largura);
    setAlturaFreteML(valores.altura);
    setEdicoesDadosTecnicos((e) => ({ ...e, embalagem: new Date().toISOString() }));
    setDimensoesManuaisDeEstimativa(valores);
    setMostrarCalculoFreteML(true);
  }

  /*
   * Chamado pelo cálculo MANUAL depois que o ML devolve o frete:
   * grava na base PAIIA os dados que o usuário confirmou.
   */
  function registrarFreteManual(valor, peso, altura, largura, comprimento) {
    const pesoG = Math.round(peso * 1000);
    const iguaisConfiaveis =
      dimensoesFrete?.confiavel &&
      Math.round(dimensoesFrete.peso_g) === pesoG &&
      Number(dimensoesFrete.comprimento_cm) === comprimento &&
      Number(dimensoesFrete.largura_cm) === largura &&
      Number(dimensoesFrete.altura_cm) === altura;

    const est = dimensoesManuaisDeEstimativa;
    const iguaisEstimativa =
      est &&
      numeroPrecificacao(est.peso) === peso &&
      numeroPrecificacao(est.comprimento) === comprimento &&
      numeroPrecificacao(est.largura) === largura &&
      numeroPrecificacao(est.altura) === altura;

    const status = iguaisConfiaveis
      ? dimensoesFrete.status
      : iguaisEstimativa
        ? STATUS_DIMENSOES.ESTIMADO
        : STATUS_DIMENSOES.MANUAL;

    const origem = iguaisConfiaveis
      ? dimensoesFrete.origem
      : iguaisEstimativa
        ? ORIGEM_DIMENSOES.ESTIMATIVA
        : ORIGEM_DIMENSOES.MANUAL;

    if (!iguaisConfiaveis && pecaEncontrada) {
      salvarDimensoesProduto({
        codigos: codigosParaFrete(),
        peca: pecaEncontrada,
        peso_g: pesoG,
        comprimento_cm: comprimento,
        largura_cm: largura,
        altura_cm: altura,
        status,
        origem,
        detalheOrigem: iguaisEstimativa
          ? "Sugestão por categoria usada sem alteração"
          : "",
      }).then(conferirGravacaoFrete);
    }

    ultimoFreteAutoRef.current = formatarNumeroFrete(valor);

    // Novos dados confirmados pelo usuário passam a valer para os
    // recálculos (ex.: mudança de custo). Estimativa nunca recalcula sozinha.
    if (!iguaisConfiaveis) {
      setDimensoesFrete(
        status === STATUS_DIMENSOES.MANUAL
          ? {
              confiavel: true,
              peso_g: pesoG,
              comprimento_cm: comprimento,
              largura_cm: largura,
              altura_cm: altura,
              status,
              nivel: "CONFIRMADO_PELO_USUARIO",
              origem,
            }
          : null
      );
    }

    setFreteAutoInfo({
      valor,
      manual: true,
      peso_g: pesoG,
      comprimento_cm: comprimento,
      largura_cm: largura,
      altura_cm: altura,
      status,
      origem,
    });
    setStatusFreteAuto("ok");
    setErroFreteAuto("");
  }

  const [mostrarRecursosIA, setMostrarRecursosIA] = useState(false);
  const [mostrarAplicacoes, setMostrarAplicacoes] = useState(false);
const [veioDaCentralTecnica, setVeioDaCentralTecnica] =
  useState(false);
  const [pontuacaoAnuncio, setPontuacaoAnuncio] = useState({
    pontos: 0,
    anuncioPronto: false,
  });

  const [processando, setProcessando] = useState(false);
  const [etapaProcessamento, setEtapaProcessamento] = useState("");
  const [pesquisaPaizinho, setPesquisaPaizinho] = useState(null);
  const [progressoProcessamento, setProgressoProcessamento] =
    useState(0);

  const chaveRascunhoTemp = "rascunhoNovoAnuncioTemp";

  useEffect(() => {
    const dadosSalvos = localStorage.getItem(
      "pecaCatalogoSelecionada"
    );
console.log(
  "PEÇA SALVA:",
  dadosSalvos
);
    if (!dadosSalvos) return;
    // Usada uma vez: não volta a preencher o próximo anúncio.
    localStorage.removeItem("pecaCatalogoSelecionada");
    // Ficha reaberta: só os dados DELA.
    if (abertura.modo === "ficha") return;

    try {
      const dados = JSON.parse(dadosSalvos);
      console.log(
  "DADOS RECUPERADOS:",
  dados
);

      setCodigo(dados.codigo || "");
      setOem(dados.oem || "");

      if (dados.peca) {
        setTitulo(
          `${dados.peca} ${dados.codigo || ""}`.trim()
        );
      }

      if (dados.aplicacoes?.length) {
        const aplicacoes = dados.aplicacoes
          .map((item) => {
            const anos =
              item.ano_inicio && item.ano_fim
                ? `${item.ano_inicio} até ${item.ano_fim}`
                : item.ano_inicio ||
                  item.ano_fim ||
                  "";

            return [
              item.montadora,
              item.modelo,
              item.motor,
              anos,
            ]
              .filter(Boolean)
              .join(" ");
          })
          .filter(Boolean)
          .join("\n");

        setDescricao(
          `APLICAÇÕES:\n\n${aplicacoes}`
        );
      }

 setPecaEncontrada({
  codigo_oem: dados.codigo || "",
  codigo_equivalente: dados.oem || "",
  peca: dados.peca || "",
  fabricante: dados.fabricante || "",
  origem_catalogo: "Central Técnica PAIIA AI",
  aplicacoes: dados.aplicacoes || [],
});

setMostrarAplicacoes(true);
setMostrarRecursosIA(false);
setProcessando(false);
setEtapaProcessamento("");
setProgressoProcessamento(100);

setDiagnostico(
  dados.diagnostico || null
);

setAuditoria(
  dados.auditoria || null
);

setVeioDaCentralTecnica(true);
    
    } catch (erro) {
      console.error(
        "Erro ao carregar peça do catálogo:",
        erro
      );

      localStorage.removeItem(
        "pecaCatalogoSelecionada"
      );
    }
  }, []);

  // FICHA PERSISTENTE NA BASE PAIIA desde o Novo Anúncio (mesma ficha até
  // a publicação). Não cria anúncio no ML, produto no Bling nem registro na
  // base de conhecimento: é só a ficha operacional deste anúncio.
  const fichaNovo = useFichaNovoAnuncio({
    abertura,
    desativado: Boolean(anuncioEditando) || Boolean(abertura.recarregarDaBase),
    estado: {
      codigo, oem, titulo, descricao, preco, tipoAnuncio, pecaEncontrada,
      fotos: fotosAnuncio, clip: clipAnuncio, canalVenda, categoriaConcorrencia,
      precificacao: {
        custo, fretePrecificacao, despesasPrecificacao, comissaoPrecificacao, impostoPrecificacao,
        freteCompraPrecificacao, contaAnuncioML,
        custoCompraDetalhado, freteCompraDetalhado, embalagemDetalhada, despesasFixasMensais,
        vendasMediasMes, outrosCustosDetalhados,
      },
      embalagem: { pesoFreteML, alturaFreteML, larguraFreteML, comprimentoFreteML },
      tipoVeiculo: tipoVeiculoNA,
      edicoes: edicoesDadosTecnicos,
      freteML: registroFreteML,
    },
  });

  // Dados extras do anúncio que também precisam voltar da Galeria.
  const extrasRascunho = {
    // ID da ficha na base: o rascunho do navegador volta sempre para ELA.
    fichaIdPAIIA: fichaNovo.fichaId || "",
    clip: clipAnuncio || "",
    canalVenda,
    categoriaConcorrencia,
    custo,
    fretePrecificacao,
    freteCompraPrecificacao,
    contaAnuncioML,
    despesasPrecificacao,
    comissaoPrecificacao,
    impostoPrecificacao,
    mostrarCustoDetalhado,
    custoCompraDetalhado,
    freteCompraDetalhado,
    embalagemDetalhada,
    despesasFixasMensais,
    vendasMediasMes,
    outrosCustosDetalhados,
    pesoFreteML,
    alturaFreteML,
    larguraFreteML,
    comprimentoFreteML,
    tipoVeiculo: tipoVeiculoNA,
    edicoesDadosTecnicos,
    freteML: registroFreteML,
    mostrarAplicacoes,
  };

  function aplicarExtrasRascunho(dados) {
    if (!dados || typeof dados !== "object") return;

    const texto = (chave, setter) => {
      if (
        typeof dados[chave] === "string" &&
        dados[chave] !== ""
      ) {
        setter(dados[chave]);
      }
    };

    texto("categoriaConcorrencia", setCategoriaConcorrencia);
    texto("custo", setCusto);
    texto("fretePrecificacao", setFretePrecificacao);
    texto("freteCompraPrecificacao", setFreteCompraPrecificacao);
    texto("contaAnuncioML", setContaAnuncioML);
    texto("despesasPrecificacao", setDespesasPrecificacao);
    if (typeof dados.comissaoPrecificacao === "string" && dados.comissaoPrecificacao !== "") comissaoDefinidaRef.current = true;
    texto("comissaoPrecificacao", setComissaoPrecificacao);
    texto("impostoPrecificacao", setImpostoPrecificacao);
    texto("custoCompraDetalhado", setCustoCompraDetalhado);
    texto("freteCompraDetalhado", setFreteCompraDetalhado);
    texto("embalagemDetalhada", setEmbalagemDetalhada);
    texto("despesasFixasMensais", setDespesasFixasMensais);
    texto("vendasMediasMes", setVendasMediasMes);
    texto("outrosCustosDetalhados", setOutrosCustosDetalhados);
    texto("pesoFreteML", setPesoFreteML);
    texto("alturaFreteML", setAlturaFreteML);
    texto("larguraFreteML", setLarguraFreteML);
    texto("comprimentoFreteML", setComprimentoFreteML);
    // Tipo de veículo DESTA ficha (nunca de outro anúncio); sem valor = padrão.
    setTipoVeiculoNA(normalizarTipoVeiculo(dados.tipoVeiculo) || TIPO_CARRO);
    const ed = dados.edicoesDadosTecnicos || dados.edicoes;
    setEdicoesDadosTecnicos(ed && typeof ed === "object" ? { ...ed } : {});
    // Registro de frete × precificação DESTA ficha (nunca de outro anúncio).
    if (dados.freteML && typeof dados.freteML === "object") {
      setRegistroFreteML(dados.freteML);
      if (dados.freteML.modalidade) setModalidadeFreteML(String(dados.freteML.modalidade));
    } else {
      setRegistroFreteML(null);
    }

    if (dados.mostrarCustoDetalhado === true) {
      setMostrarCustoDetalhado(true);
    }

    if (
      dados.mostrarAplicacoes === true ||
      (Array.isArray(dados.pecaEncontrada?.aplicacoes) &&
        dados.pecaEncontrada.aplicacoes.length)
    ) {
      setMostrarAplicacoes(true);
    }
  }

  // As funções do componente continuam aqui embaixo.

  useNovoAnuncio({
    anuncioEditando,
    fotosAnuncio,
    setFotosAnuncio,

    codigo,
    setCodigo,

    oem,
    setOem,

    titulo,
    setTitulo,

    descricao,
    setDescricao,

    preco,
    setPreco,

    tipoAnuncio,
    setTipoAnuncio,

    pecaEncontrada,
    setPecaEncontrada,

    diagnostico,
    setDiagnostico,

    auditoria,
    setAuditoria,

    extrasRascunho,

    abertura,
  });

  // Dono das fotos que ficam na memória do App: a ficha desta tela. Outra
  // abertura (outra ficha / anúncio novo) troca essas fotos pelas dela.
  useEffect(() => {
    marcarDonoFotosAnuncio(anuncioEditando ? "edicao" : fichaNovo.fichaId);
  }, [anuncioEditando, fichaNovo.fichaId]);

  // Outro anúncio na MESMA tela (outro código): nada do anterior passa —
  // fotos, preço, custo/precificação, clip.
  function zerarDadosDoAnuncioAnterior() {
    setFotosAnuncio([]);
    setPreco("");
    setClipAnuncio("");
    ["clipPronto", "clipSelecionado", "clipSelecionadoEstilo"].forEach((chave) => localStorage.removeItem(chave));
    setCusto("");
    setFretePrecificacao("");
    setCustoCompraDetalhado("");
    setFreteCompraDetalhado("");
    setEmbalagemDetalhada("");
    setOutrosCustosDetalhados("");
    setCategoriaConcorrencia("");
    setResultadoConcorrencia(null);
    setResultadoCustosML(null);
  }

function montarUrlPesquisaMercadoLivre(termo = "") {
  const busca = String(termo || "")
    .trim()
    .replace(/\s+/g, "-");

  return `https://lista.mercadolivre.com.br/${encodeURIComponent(busca)}`;
}

function montarUrlPesquisaShopee(termo = "") {
  return (
    "https://shopee.com.br/search?keyword=" +
    encodeURIComponent(
      String(termo || "").trim()
    )
  );
}

async function pesquisarConcorrenciaPaizinho() {
  if (!categoriaConcorrencia) {
    alert(
      "Escolha se deseja comparar com peças originais ou importadas."
    );
    return;
  }

  const codigoBusca = String(
    codigo || oem || ""
  ).trim();

  const tituloBusca = String(
    titulo || pecaEncontrada?.peca || ""
  ).trim();

  const classificacao =
    categoriaConcorrencia === "original"
      ? {
          tipo: "original",
          rotulo: "Peças originais",
          busca: "original OEM",
        }
      : {
          tipo: "paralela",
          rotulo: "Peças importadas",
          busca: "",
        };

  const fabricanteBusca = String(
    pecaEncontrada?.fabricante ||
      diagnostico?.fabricante ||
      ""
  ).trim();

  const termoBusca = [
    codigoBusca,
    tituloBusca,
    classificacao.busca,
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  if (!termoBusca) {
    alert(
      "Informe o código ou o título da peça antes de pesquisar a concorrência."
    );
    return;
  }

  setPesquisandoConcorrencia(true);
  setErroConcorrencia("");
  setResultadoConcorrencia(null);

  try {
    const { data, error } =
      await supabase.functions.invoke(
        "concorrencia",
        {
          body: {
            termo: termoBusca,
            codigo: codigoBusca,
            titulo: tituloBusca,
            fabricante: fabricanteBusca,
            peca:
              pecaEncontrada?.peca ||
              tituloBusca,
            categoria:
              classificacao.tipo,
            marketplaces: [
              "mercado_livre",
              "shopee",
            ],
          },
        }
      );
console.log(
  "📦 RESPOSTA CONCORRÊNCIA:",
  data
);
    if (error) {
      throw new Error(
        error?.message ||
          "A função de concorrência não respondeu."
      );
    }

    if (data?.ok === false) {
      throw new Error(
        data?.erro ||
          data?.error ||
          "Não foi possível coletar preços da concorrência."
      );
    }

    function converterPrecoMercado(
      valor
    ) {
      if (typeof valor === "number") {
        return Number.isFinite(valor)
          ? valor
          : null;
      }

      const textoPreco = String(
        valor ?? ""
      )
        .replace(/R\$/gi, "")
        .replace(/\s/g, "")
        .trim();

      if (!textoPreco) {
        return null;
      }

      const normalizado =
        textoPreco.includes(",")
          ? textoPreco
              .replace(/\./g, "")
              .replace(",", ".")
          : textoPreco;

      const numero =
        Number(normalizado);

      return Number.isFinite(numero)
        ? numero
        : null;
    }

    function prepararItensMercado(
      lista,
      marketplacePadrao
    ) {
      return (
        Array.isArray(lista)
          ? lista
          : []
      )
        .map((item, index) => ({
          id:
            item?.id ||
            `${marketplacePadrao}-${index}`,

          marketplace:
            item?.marketplace ||
            marketplacePadrao,

          titulo:
            item?.titulo ||
            item?.title ||
            "",

          preco:
            converterPrecoMercado(
              item?.preco ??
                item?.price
            ),

          link:
            item?.link ||
            item?.url ||
            "",

          fonte:
            item?.fonte || "",

          categoria:
            item?.categoria || "",
        }))
        .filter((item) => {
          if (
            !Number.isFinite(item.preco) ||
            item.preco <= 0
          ) {
            return false;
          }

          const categoriaItem = String(
            item.categoria || ""
          ).toLowerCase();

          return categoriaConcorrencia === "original"
            ? categoriaItem === "original"
            : categoriaItem === "paralela" ||
                categoriaItem === "equivalente" ||
                categoriaItem === "importado";
        });
    }

    function calcularFaixaMercado(
      itens = []
    ) {
      const precos = itens
        .map(
          (item) =>
            Number(item?.preco)
        )
        .filter(
          (valor) =>
            Number.isFinite(valor) &&
            valor > 0
        )
        .sort(
          (a, b) => a - b
        );

      if (!precos.length) {
        return {
          minimo: null,
          maximo: null,
          media: null,
          quantidade: 0,
        };
      }

      const media =
        precos.reduce(
          (total, valor) =>
            total + valor,
          0
        ) / precos.length;

      return {
        minimo: precos[0],
        maximo:
          precos[
            precos.length - 1
          ],
        media,
        quantidade:
          precos.length,
      };
    }

    const itensMercadoLivre =
      prepararItensMercado(
        data?.mercadoLivre,
        "Mercado Livre"
      );

    const itensShopee =
      prepararItensMercado(
        data?.shopee,
        "Shopee"
      );

    const mercadoLivre =
      calcularFaixaMercado(
        itensMercadoLivre
      );

    const shopee =
      calcularFaixaMercado(
        itensShopee
      );

    const todosItens = [
      ...itensMercadoLivre,
      ...itensShopee,
    ];

    const precosBrutos =
      todosItens
        .map(
          (item) =>
            Number(item?.preco)
        )
        .filter(
          (valor) =>
            Number.isFinite(valor) &&
            valor > 0
        )
        .sort(
          (a, b) => a - b
        );

    if (!precosBrutos.length) {
      throw new Error(
        "O Paizinho pesquisou, mas não encontrou preços comparáveis no Mercado Livre ou Shopee."
      );
    }

    function mediana(lista = []) {
      if (!lista.length) {
        return 0;
      }

      const meio =
        Math.floor(
          lista.length / 2
        );

      return lista.length % 2
        ? lista[meio]
        : (
            lista[meio - 1] +
            lista[meio]
          ) / 2;
    }

    const medianaPrecos =
  mediana(precosBrutos);

/*
 * =====================================================
 * FILTRO ANTI-PREÇO FALSO — PAIZINHO
 * =====================================================
 *
 * Evita que parcela, acessório, frete ou anúncio
 * incorreto distorça a comparação.
 *
 * Exemplo:
 * R$ 7,18 não pode entrar junto de peças
 * vendidas na faixa de R$ 100 / R$ 200.
 */

const precoUsuarioReferencia =
  numeroPrecificacao(preco);

const referenciaMercado =
  precoUsuarioReferencia > 0
    ? precoUsuarioReferencia
    : medianaPrecos;

const limiteMinimoMediana =
  medianaPrecos > 0
    ? medianaPrecos * 0.55
    : 0;

const limiteMinimoUsuario =
  referenciaMercado > 0
    ? referenciaMercado * 0.35
    : 0;

const limiteMinimo =
  Math.max(
    limiteMinimoMediana,
    limiteMinimoUsuario
  );

const limiteMaximo =
  medianaPrecos > 0
    ? medianaPrecos * 2.5
    : Infinity;

let precosComparaveis =
  precosBrutos.filter(
    (valor) =>
      valor >= limiteMinimo &&
      valor <= limiteMaximo
  );

/*
 * Nunca devolve automaticamente os preços
 * absurdamente baixos para o cálculo.
 */
if (!precosComparaveis.length) {
  precosComparaveis =
    precosBrutos.filter(
      (valor) =>
        valor >= limiteMinimoUsuario
    );
}

/*
 * Última segurança.
 */
if (!precosComparaveis.length) {
  precosComparaveis = [
    medianaPrecos,
  ].filter(
    (valor) =>
      Number.isFinite(valor) &&
      valor > 0
  );
}

    
    const faixaMin =
      precosComparaveis[0];

    const faixaMax =
      precosComparaveis[
        precosComparaveis.length - 1
      ];

    const mediaGeral =
      precosComparaveis.reduce(
        (total, valor) =>
          total + valor,
        0
      ) /
      precosComparaveis.length;

    const mercadoGeral = {
      minimo: faixaMin,
      maximo: faixaMax,
      media: mediaGeral,
      quantidade:
        precosComparaveis.length,
      descartados:
        precosBrutos.length -
        precosComparaveis.length,
    };

    const precoUsuario =
      numeroPrecificacao(preco);

    let analise =
      `O Paizinho encontrou ${precosComparaveis.length} preço(s) comparável(is): ` +
      `${itensMercadoLivre.length} no Mercado Livre e ` +
      `${itensShopee.length} na Shopee.`;

    if (
      precoUsuario > 0 &&
      Number.isFinite(mediaGeral) &&
      mediaGeral > 0
    ) {
      const diferenca =
        ((precoUsuario -
          mediaGeral) /
          mediaGeral) *
        100;

      if (
        precoUsuario <
        faixaMin
      ) {
        analise =
          `Seu preço está abaixo da faixa principal encontrada e ` +
          `${Math.abs(
            diferenca
          ).toFixed(1)}% abaixo da média.`;
      } else if (
        precoUsuario >
        faixaMax
      ) {
        analise =
          `Seu preço está acima da faixa principal encontrada e ` +
          `${Math.abs(
            diferenca
          ).toFixed(1)}% acima da média.`;
      } else {
        analise =
          `Seu preço está dentro da faixa principal encontrada e ` +
          `${Math.abs(
            diferenca
          ).toFixed(1)}% ` +
          `${diferenca >= 0
            ? "acima"
            : "abaixo"} da média.`;
      }
    }

    const urlMercadoLivre =
      montarUrlPesquisaMercadoLivre(
        termoBusca
      );

    const urlShopee =
      montarUrlPesquisaShopee(
        termoBusca
      );

    setResultadoConcorrencia({
      termo:
        data?.termo ||
        termoBusca,

      classificacao,

      mercadoLivre,
      shopee,
      mercadoGeral,

      anuncios: {
        mercadoLivre:
          itensMercadoLivre,
        shopee:
          itensShopee,
      },

      fontes: [
        {
          nome:
            "Mercado Livre",
          url:
            urlMercadoLivre,
        },
        {
          nome: "Shopee",
          url:
            urlShopee,
        },
      ],

      analise,
    });

    console.log(
      "✅ CONCORRÊNCIA PAIIA:",
      {
        bruto: data,
        mercadoLivre,
        shopee,
        mercadoGeral,
      }
    );
  } catch (erroPesquisa) {
    console.error(
      "❌ Erro ao pesquisar concorrência:",
      erroPesquisa
    );

    setErroConcorrencia(
      erroPesquisa?.message ||
        "Não foi possível pesquisar a concorrência agora."
    );
  } finally {
    setPesquisandoConcorrencia(
      false
    );
  }
}

async function buscarEMontarAnuncio() {
  const codigoFinal = String(
    codigo || oem || ""
  ).trim();
  // Campo onde o usuário digitou: o valor volta para ele se o código
  // não for encontrado, para conferir/corrigir sem digitar de novo.
  const digitadoNoOem = !String(codigo || "").trim() && Boolean(String(oem || "").trim());

  if (!codigoFinal) {
    alert(
      "Digite o código da peça ou OEM."
    );
    return;
  }

  if (processando) {
    return;
  }

  // Outro código = outro anúncio: a próxima gravação cria OUTRA ficha (a
  // anterior continua salva na base e aparece na Central).
  if (!fichaNovo.fichaServeParaCodigo(codigoFinal)) {
    fichaNovo.novaFicha();
    // Outro anúncio: nada técnico do anterior (tipo, peso, medidas) passa.
    zerarDadosTecnicos();
    // ...nem fotos, preço, custo ou clip do anúncio anterior.
    zerarDadosDoAnuncioAnterior();
  }

  setOem("");
  setTitulo("");
  setDescricao("");
  setPecaEncontrada(null);
  setDiagnostico(null);
  setAuditoria(null);
  setPesquisaPaizinho(null);
  setMostrarAplicacoes(false);
  localStorage.removeItem(
    "novoAnuncioTemporario"
  );
  localStorage.removeItem(
    "rascunhoNovoAnuncioTemp"
  );

  setProcessando(true);
  setProgressoProcessamento(5);
  setEtapaProcessamento(
    "🔎 Iniciando pesquisa técnica..."
  );

  try {
    // 1ª etapa: BASE VALIDADA PAIIA (fonte própria). Se o código já foi
    // pesquisado e validado antes, usa esse conhecimento e não repete a
    // pesquisa externa. Só registros com status "validado" entram aqui.
    setEtapaProcessamento(
      "🔎 Consultando a Base validada PAIIA..."
    );
    const linhasBaseValidada =
      await buscarConhecimentoValidado(
        codigoFinal
      );

    if (linhasBaseValidada.length > 0) {
      aplicarBaseValidadaPaizinho(
        codigoFinal,
        linhasBaseValidada
      );
      return;
    }

    // 2ª etapa: CATÁLOGOS INTERNOS (3ª: pesquisa externa, mais abaixo)
    const resultado =
      await preencherAnuncioAutomaticamente({
        codigo: codigoFinal,
        oem: "",
        permitirBuscaInternet: false,

        onProgresso: (
          progresso,
          etapa
        ) => {
          setProgressoProcessamento(
            progresso
          );

          setEtapaProcessamento(
            etapa
          );
        },
      });

    const codigoResultado =
      resultado?.codigo ||
      codigoFinal;

    const oemResultado =
      resultado?.oem ||
      "";

    const pecaResultado =
      resultado?.pecaEncontrada ||
      null;

    const tituloResultado =
      resultado?.avisoAplicacao && !resultado?.aplicacaoConfirmada
        ? resultado?.titulo ||
          montarTituloMercadoLivreInteligente({
            resultado,
            pecaResultado,
            codigoResultado,
            oemResultado,
          })
        : montarTituloMercadoLivreInteligente({
            resultado,
            pecaResultado,
            codigoResultado,
            oemResultado,
          });

    const fontesAplicacoes = [
  ...(Array.isArray(
    resultado?.baseMestre?.aplicacoes
  )
    ? resultado.baseMestre.aplicacoes
    : []),

  ...(Array.isArray(
    resultado?.diagnostico
      ?.baseMestre?.aplicacoes
  )
    ? resultado.diagnostico
        .baseMestre.aplicacoes
    : []),

  ...(Array.isArray(
    resultado?.inteligencia?.registros
  )
    ? resultado.inteligencia.registros
    : []),

  ...(Array.isArray(
    pecaResultado?.aplicacoes
  )
    ? pecaResultado.aplicacoes
    : []),

  ...(Array.isArray(
    resultado?.resultadosCatalogo
  )
    ? resultado.resultadosCatalogo
    : []),

  ...(Array.isArray(
    resultado?.aplicacoes
  )
    ? resultado.aplicacoes
    : []),
];

console.log(
  "PAIIA_APLICACOES_BRUTAS",
  fontesAplicacoes
);
console.table(
  fontesAplicacoes.map(
    (item, index) => ({
      index,
      montadora:
        item?.montadora || "",
      modelo:
        item?.modelo || "",
      motor:
        item?.motor || "",
      ano_inicio:
        item?.ano_inicio || "",
      ano_fim:
        item?.ano_fim || "",
      observacao:
        item?.observacao || "",
      codigo_oem:
        item?.codigo_oem || "",
      codigo_equivalente:
        item?.codigo_equivalente || "",
      origem_catalogo:
        item?.origem_catalogo || "",
    })
  )
);

function limparCampoDescricao(
  valor = ""
) {
  return String(valor || "")
    .replace(/[□�]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function limparMotorDescricao(
  valor = ""
) {
  let texto =
    limparCampoDescricao(valor);

  if (!texto) {
    return "";
  }

  /*
   * O catálogo pode trazer depois do motor:
   * período, combustível, códigos Bosch
   * e até informações da aplicação seguinte.
   *
   * Aqui preservamos a identificação do motor
   * e retiramos somente o conteúdo posterior.
   */

  texto = texto
    .replace(
      /\s+\d{2}[./]\d{2}\s+(?:até|a|-)?\s*\d{2}[./]\d{2}.*$/i,
      ""
    )
    .replace(
      /\s+\d{2}[./]\d{2}\s+.*$/i,
      ""
    )
    .replace(
      /\s+(?:gasolina|flex|etanol|álcool|alcool|diesel)\b.*$/i,
      ""
    )
    .replace(
      /\s+\d\s+\d{3}\s+\d{3}\s+\d{3}\b.*$/i,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();

  return texto;
}

const aplicacoesValidas = [];
const aplicacoesVistas = new Set();

for (
  const item of fontesAplicacoes
) {
  const montadora =
    limparCampoDescricao(
      item?.montadora
    );

  const modelo =
    limparCampoDescricao(
      item?.modelo
    );

  const motor =
    limparMotorDescricao(
      item?.motor
    );

  const anoInicio =
    limparCampoDescricao(
      item?.ano_inicio
    );

  const anoFim =
    limparCampoDescricao(
      item?.ano_fim
    );

  if (
    !montadora &&
    !modelo &&
    !motor
  ) {
    continue;
  }

  if (
    String(item?.tipo_referencia || "")
      .toLowerCase() === "nota_tecnica"
  ) {
    continue;
  }

  const chave = [
    montadora,
    modelo,
    motor,
    anoInicio,
    anoFim,
  ]
    .join("|")
    .toUpperCase();

  if (
    aplicacoesVistas.has(chave)
  ) {
    continue;
  }

  aplicacoesVistas.add(chave);

  aplicacoesValidas.push({
    montadora,
    modelo,
    motor,
    anoInicio,
    anoFim,
    nivelConcordancia:
      item?.nivelConcordancia || "",
  });
}

const gruposAplicacoes = {};

for (
  const item of aplicacoesValidas
) {
  const montadora =
    item.montadora ||
    "OUTROS";

  if (
    !gruposAplicacoes[
      montadora
    ]
  ) {
    gruposAplicacoes[
      montadora
    ] = [];
  }

  gruposAplicacoes[
    montadora
  ].push(item);
}

const linhasDescricao = [];

if (resultado?.fallbackExterno) {
  const confirmadas = aplicacoesValidas.filter(
    (item) => item.nivelConcordancia === "confirmado"
  );
  const provisórias = aplicacoesValidas.filter(
    (item) => item.nivelConcordancia !== "confirmado"
  );

  const montarLinhaMl = (item) => {
    const periodo =
      item.anoInicio && item.anoFim
        ? `${item.anoInicio} até ${item.anoFim}`
        : item.anoInicio
          ? `A partir de ${item.anoInicio}`
          : item.anoFim
            ? `Até ${item.anoFim}`
            : "A confirmar";

    return [
      item.montadora || "A confirmar",
      item.modelo || "A confirmar",
      item.motor || "A confirmar",
      periodo,
    ].join(" | ");
  };

  linhasDescricao.push("APLICAÇÕES DO PRODUTO");
  linhasDescricao.push("Fonte: Mercado Livre — dados provisórios");
  linhasDescricao.push("Auditoria: REVISAR");
  linhasDescricao.push("");

  linhasDescricao.push("CONFIRMADO");
  linhasDescricao.push("(coincidiu em mais de um anúncio)");
  linhasDescricao.push("");
  if (confirmadas.length) {
    for (const item of confirmadas) {
      linhasDescricao.push(montarLinhaMl(item));
    }
  } else {
    linhasDescricao.push("Nenhuma aplicação com concordância entre anúncios.");
  }

  linhasDescricao.push("");
  linhasDescricao.push("ENCONTRADO NO MERCADO LIVRE — A CONFIRMAR");
  linhasDescricao.push("(apareceu em um anúncio ou sem concordância suficiente)");
  linhasDescricao.push("");
  if (provisórias.length) {
    for (const item of provisórias) {
      linhasDescricao.push(montarLinhaMl(item));
    }
  } else {
    linhasDescricao.push("Nenhuma aplicação adicional encontrada.");
  }
} else if (resultado?.avisoAplicacao) {
  linhasDescricao.push(resultado.avisoAplicacao);
  linhasDescricao.push("");
  linhasDescricao.push("APLICAÇÃO DE VEÍCULO");
  linhasDescricao.push("Não informada nesta referência técnica.");
  if (resultado?.referenciasTecnicas?.length) {
    linhasDescricao.push("");
    for (const nota of resultado.referenciasTecnicas) {
      if (nota.origem_catalogo) {
        linhasDescricao.push(`Fonte: ${nota.origem_catalogo}`);
      }
      if (nota.pagina_catalogo != null) {
        linhasDescricao.push(`Página: ${nota.pagina_catalogo}`);
      }
      if (nota.observacao) {
        linhasDescricao.push(`Referência técnica: ${nota.observacao}`);
      }
    }
  }
} else {
  linhasDescricao.push("APLICAÇÕES DO PRODUTO");
  linhasDescricao.push("");

for (
  const [
    montadora,
    itens,
  ] of Object.entries(
    gruposAplicacoes
  )
) {
  linhasDescricao.push(
    montadora.toUpperCase()
  );

  linhasDescricao.push("");

  for (const item of itens) {
    linhasDescricao.push(
      `• ${
        item.modelo ||
        "Modelo não informado"
      }`
    );

    if (item.motor) {
      linhasDescricao.push(
        `  Motor: ${item.motor}`
      );
    }

    if (
      item.anoInicio ||
      item.anoFim
    ) {
      const periodo =
        item.anoInicio &&
        item.anoFim
          ? `${item.anoInicio} até ${item.anoFim}`
          : item.anoInicio
            ? `A partir de ${item.anoInicio}`
            : `Até ${item.anoFim}`;

      linhasDescricao.push(
        `  Período: ${periodo}`
      );
    }

    linhasDescricao.push("");
  }
}
}

const descricaoResultado =
  resultado?.avisoAplicacao && aplicacoesValidas.length === 0
    ? String(resultado?.descricao || linhasDescricao.join("\n"))
        .replace(/[□�]+/g, " ")
        .trim()
    : aplicacoesValidas.length > 0
    ? linhasDescricao
        .join("\n")
        .trim()
    : String(
        resultado?.descricao || ""
      )
        .replace(/[□�]+/g, " ")
        .trim();

    const diagnosticoResultado = {
      ...(
        resultado?.diagnostico ||
        {}
      ),

      baseMestre:
        resultado?.baseMestre ||
        resultado?.diagnostico
          ?.baseMestre ||
        pecaResultado
          ?.baseMestre ||
        null,

      codigoPrincipal:
        resultado?.diagnostico
          ?.codigoPrincipal ||
        codigoResultado,

      peca:
        resultado?.diagnostico
          ?.peca ||
        pecaResultado?.peca ||
        "Peça Automotiva",

      fabricante:
        resultado?.diagnostico
          ?.fabricante ||
        pecaResultado
          ?.fabricante ||
        "Não informado",

      totalAplicacoes:
        resultado?.aplicacaoConfirmada === false
          ? 0
          : resultado
          ?.resultadosCatalogo
          ?.length ||
        pecaResultado
          ?.aplicacoes
          ?.length ||
        0,

      aplicacaoConfirmada:
        resultado?.aplicacaoConfirmada ?? true,

      avisoAplicacao:
        resultado?.avisoAplicacao || null,

      referenciasTecnicas:
        resultado?.referenciasTecnicas || [],

      arquivoCatalogo:
        resultado
          ?.resultadoPrincipal
          ?.arquivo ||
        pecaResultado
          ?.origem_catalogo ||
        "Base PAIIA",

      paginaCatalogo:
        resultado
          ?.resultadoPrincipal
          ?.pagina ||
        pecaResultado
          ?.pagina_catalogo ||
        "-",
    };

    const auditoriaResultado =
      resultado?.auditoria || {
        aprovado: false,
        status: "REVISAR",

        confiabilidade:
          Number(
            pecaResultado
              ?.confiabilidade
          ) || 0,

        problemas: [],
      };

    setCodigo(
      codigoResultado
    );

    setOem(
      oemResultado
    );

    setTitulo(
      tituloResultado
    );

    setDescricao(
      descricaoResultado
    );

    setPreco(
      resultado?.preco || ""
    );

    setTipoAnuncio(
      resultado?.tipoAnuncio ||
      "classico"
    );

    setPecaEncontrada(
      pecaResultado
    );

    setDiagnostico(
      diagnosticoResultado
    );

    setAuditoria(
      auditoriaResultado
    );

    setMostrarAplicacoes(true);
    setMostrarRecursosIA(false);

    gravarRascunhoAnuncio(
      "rascunhoNovoAnuncioTemp",
      {
        ...extrasRascunho,
        ...({
        codigo:
          codigoResultado,

        oem:
          oemResultado,

        titulo:
          tituloResultado,

        descricao:
          descricaoResultado,

        preco:
          resultado?.preco ||
          "",

        tipoAnuncio:
          resultado
            ?.tipoAnuncio ||
          "classico",

        pecaEncontrada:
          pecaResultado,

        diagnostico:
          diagnosticoResultado,

        auditoria:
          auditoriaResultado,

        baseMestre:
          resultado?.baseMestre ||
          diagnosticoResultado
            .baseMestre ||
          null,

        fotos:
          Array.isArray(
            fotosAnuncio
          )
            ? fotosAnuncio
            : [],
      }),
      }
    );

    // Base PAIIA achou o código mas sem aplicação de veículo.
    // Regra: catálogo interno primeiro; pesquisa externa (paga) SÓ quando
    // o código não existe internamente. Aqui o código existe num catálogo
    // interno, então NÃO há consulta externa automática: o painel do
    // Paizinho avisa e deixa a pesquisa externa como opção manual.
    if (
      aplicacoesValidas.length === 0 &&
      !resultado?.fallbackExterno
    ) {
      setPesquisaPaizinho({
        status: "interno_sem_aplicacao",
        codigoPesquisado: codigoFinal,
        origemFallback: "interno_sem_aplicacao",
        catalogosInternos:
          resultado?.baseMestre?.fontes || [],
        contextoComplemento: {
          pecaBase: pecaResultado,
          oemBase: oemResultado,
          diagnosticoBase: diagnosticoResultado,
          auditoriaBase: auditoriaResultado,
        },
      });
    }

    setProgressoProcessamento(
      100
    );

    setEtapaProcessamento(
      "✅ Anúncio preenchido com sucesso!"
    );

    setTimeout(() => {
      setProcessando(false);
      setEtapaProcessamento("");
      setProgressoProcessamento(0);
    }, 1000);
  } catch (erro) {
    // Base PAIIA não tem o código → Paizinho pesquisa em fontes originais.
    // Erros técnicos continuam no fluxo antigo (alerta).
    if (
      ehNaoEncontradoNosCatalogos(erro?.message)
    ) {
      if (!PESQUISA_EXTERNA_CRIAR_ANUNCIO_ATIVA) {
        // Sem pesquisa externa: só o aviso. Nada de aplicação, veículo,
        // motor, OEM ou descrição — o código digitado fica no campo.
        if (digitadoNoOem) {
          setOem(codigoFinal);
        } else {
          setCodigo(codigoFinal);
        }
        setPesquisaPaizinho({
          status: "nao_encontrado_catalogos",
          codigoPesquisado: codigoFinal,
          mensagem: MENSAGEM_NAO_ENCONTRADO_CATALOGOS,
        });
        setProcessando(false);
        setEtapaProcessamento("");
        setProgressoProcessamento(0);
        return;
      }
      await executarPesquisaPaizinho(
        codigoFinal
      );
      return;
    }

    console.error(
      "ERRO AO PREENCHER ANÚNCIO:",
      erro
    );

    setProcessando(false);
    setEtapaProcessamento("");
    setProgressoProcessamento(0);

    alert(
      erro?.message ||
      "Não foi possível preencher o anúncio automaticamente."
    );
  }
}
// Preenche o anúncio com o conhecimento VALIDADO da fonte própria PAIIA
// (sem catálogo e sem pesquisa externa). O código digitado é preservado.
function aplicarBaseValidadaPaizinho(
  codigoFinal,
  linhas
) {
  const validado =
    resultadoDoConhecimento(
      linhas,
      codigoFinal
    );
  const campos =
    montarCamposCriarAnuncio(validado);

  setCodigo(codigoFinal);
  if (campos.oem) setOem(campos.oem);
  if (campos.titulo) setTitulo(campos.titulo);
  if (campos.descricao) setDescricao(campos.descricao);

  if (campos.pecaEncontrada) {
    const fontesBase =
      validado?.baseValidada?.fontes || [];
    const diagnosticoBase = {
      codigoPrincipal: codigoFinal,
      fabricante:
        campos.pecaEncontrada.fabricante || "",
      totalAplicacoes:
        campos.pecaEncontrada.aplicacoes
          ?.length || 0,
      arquivoCatalogo: "Base validada PAIIA",
      paginaCatalogo: "",
      fontes: fontesBase,
      confianca: validado?.confianca || "",
      avisoAplicacao:
        "Dados da Base validada PAIIA (confirmados antes em catálogo interno ou em 2+ fontes oficiais). Nenhuma pesquisa externa foi feita.",
      origemBaseValidada: true,
    };
    const auditoriaBase = {
      aprovado: true,
      origemBaseValidada: true,
      problemas: [],
    };
    setPecaEncontrada({
      ...campos.pecaEncontrada,
      origem_catalogo: "Base validada PAIIA",
      origem: "paiia_conhecimento_validado",
    });
    setDiagnostico(diagnosticoBase);
    setAuditoria(auditoriaBase);
    setMostrarAplicacoes(true);
  }

  setPesquisaPaizinho({
    status: validado.status,
    mensagem: validado.mensagem,
    validado,
    campos,
    codigoPesquisado: codigoFinal,
    origemFallback: "base_validada",
  });

  setProgressoProcessamento(100);
  setEtapaProcessamento(
    "✅ Encontrado na Base validada PAIIA."
  );
  setTimeout(() => {
    setProcessando(false);
    setEtapaProcessamento("");
    setProgressoProcessamento(0);
  }, 800);
}

async function executarPesquisaPaizinho(
  codigoFinal,
  { forcar = false } = {}
) {
  // Pesquisa externa desacoplada do Criar Anúncio (não chama Claude/internet).
  if (!PESQUISA_EXTERNA_CRIAR_ANUNCIO_ATIVA) {
    setPesquisaPaizinho({
      status: "nao_encontrado_catalogos",
      codigoPesquisado: codigoFinal,
      mensagem: MENSAGEM_NAO_ENCONTRADO_CATALOGOS,
    });
    setProcessando(false);
    setEtapaProcessamento("");
    setProgressoProcessamento(0);
    return;
  }
  // O código digitado é preservado como "Código pesquisado".
  setProcessando(true);
  setCodigo(codigoFinal);
  setPesquisaPaizinho({
    status: "pesquisando",
    codigoPesquisado: codigoFinal,
  });
  setProgressoProcessamento(15);
  setEtapaProcessamento(
    MENSAGENS_PAIZINHO.PESQUISANDO
  );

  try {
    const {
      data: sessao,
    } = await supabase.auth.getUser();

    const resultado =
      await pesquisarFontesOriginais(
        codigoFinal,
        {
          userId:
            sessao?.user?.id || null,
          usarCache: !forcar,
          onProgresso: (
            etapa,
            valor
          ) => {
            setEtapaProcessamento(etapa);
            setProgressoProcessamento(valor);
          },
        }
      );

    const campos =
      resultado?.campos || {};

    // Só dado confirmado em fonte original preenche o anúncio.
    if (campos.oem) {
      setOem(campos.oem);
    }

    if (campos.titulo) {
      setTitulo(campos.titulo);
    }

    if (campos.descricao) {
      setDescricao(campos.descricao);
    }

    const fontesUsadas =
      resultado?.validado
        ?.fontesOficiaisUsadas || [];

    const naoConfirmados =
      campos.naoConfirmados || [];

    if (campos.pecaEncontrada) {
      // Mostra a peça, o fabricante e as aplicações confirmadas no
      // painel do catálogo, sempre como "REVISAR" (pendente de validação).
      const diagnosticoPaizinho = {
        codigoPrincipal: codigoFinal,
        fabricante:
          campos.pecaEncontrada.fabricante || "",
        totalAplicacoes:
          campos.pecaEncontrada.aplicacoes
            ?.length || 0,
        arquivoCatalogo:
          fontesUsadas.length
            ? `Fonte original: ${fontesUsadas.join(" | ")}`
            : "Fonte original",
        paginaCatalogo: "",
        fontes: fontesUsadas,
        confianca:
          resultado?.validado?.confianca || "",
        avisoAplicacao:
          "Dados encontrados pelo Paizinho em fonte original (Pesquisa externa PAIIA). Confira a fonte antes de publicar." +
          (naoConfirmados.length
            ? ` Não confirmado: ${naoConfirmados.join("; ")}.`
            : ""),
        origemPesquisaPaizinho: true,
      };

      const auditoriaPaizinho = {
        aprovado:
          resultado?.status ===
            STATUS_PAIZINHO.ENCONTRADO &&
          resultado?.validado
            ?.confianca === "alta",
        origemPesquisaPaizinho: true,
        problemas: [
          "Dados de pesquisa externa em fonte original — confira a fonte antes de publicar.",
          ...naoConfirmados.map(
            (item) => `Não confirmado: ${item}`
          ),
        ],
      };

      setPecaEncontrada(
        campos.pecaEncontrada
      );
      setDiagnostico(
        diagnosticoPaizinho
      );
      setAuditoria(
        auditoriaPaizinho
      );
      setMostrarAplicacoes(true);

      try {
        gravarRascunhoAnuncio(
      "rascunhoNovoAnuncioTemp",
      {
        ...extrasRascunho,
        ...({
            codigo: codigoFinal,
            oem: campos.oem || "",
            titulo: campos.titulo || "",
            descricao:
              campos.descricao || "",
            preco: "",
            tipoAnuncio: "classico",
            pecaEncontrada:
              campos.pecaEncontrada,
            diagnostico:
              diagnosticoPaizinho,
            auditoria:
              auditoriaPaizinho,
            baseMestre: null,
            fotos: Array.isArray(
              fotosAnuncio
            )
              ? fotosAnuncio
              : [],
          }),
      }
    );
      } catch {
        // rascunho é só conveniência
      }
    }

    setPesquisaPaizinho({
      ...resultado,
      codigoPesquisado: codigoFinal,
    });
  } catch (erroPaizinho) {
    console.error(
      "[PAIZINHO_PESQUISA] falha:",
      erroPaizinho
    );

    setPesquisaPaizinho({
      status: "indisponivel",
      codigoPesquisado: codigoFinal,
      mensagem:
        MENSAGENS_PAIZINHO.NAO_IDENTIFICADO,
    });
  } finally {
    setProcessando(false);
    setEtapaProcessamento("");
    setProgressoProcessamento(0);
  }
}

async function complementarComPesquisaPaizinho(
  codigoFinal,
  {
    pecaBase,
    oemBase,
    diagnosticoBase,
    auditoriaBase,
  } = {}
) {
  // Pesquisa externa desacoplada do Criar Anúncio (não chama Claude/internet).
  if (!PESQUISA_EXTERNA_CRIAR_ANUNCIO_ATIVA) {
    return;
  }
  try {
    setEtapaProcessamento(
      "Base PAIIA sem aplicação de veículo para este código. O Paizinho está pesquisando fontes originais…"
    );
    setProgressoProcessamento(60);

    const {
      data: sessao,
    } = await supabase.auth.getUser();

    // A pesquisa externa é comparada com a peça da base e com os
    // catálogos importados; nada é gravado (só proposta de incorporação).
    const resultado =
      await pesquisarFontesOriginais(
        codigoFinal,
        {
          userId:
            sessao?.user?.id || null,
          pecaBase,
          onProgresso: (
            etapa
          ) => {
            setEtapaProcessamento(etapa);
          },
        }
      );

    const divergenciasBase =
      resultado?.validado?.validacaoBase?.divergencias || [];
    const util =
      complementoUtil(
        resultado?.validado
      ) &&
      resultado?.validado?.status ===
        STATUS_PAIZINHO.ENCONTRADO;

    if (util) {
      const campos =
        resultado?.campos || {};

      if (campos.titulo) {
        setTitulo(campos.titulo);
      }

      if (campos.descricao) {
        setDescricao(campos.descricao);
      }

      if (!oemBase && campos.oem) {
        setOem(campos.oem);
      }

      const aplicacoesExternas =
        campos.pecaEncontrada
          ?.aplicacoes || [];

      setPecaEncontrada({
        ...(pecaBase || {}),
        aplicacoes: [
          ...(Array.isArray(
            pecaBase?.aplicacoes
          )
            ? pecaBase.aplicacoes
            : []),
          ...aplicacoesExternas,
        ],
      });

      setDiagnostico({
        ...(diagnosticoBase || {}),
        totalAplicacoes:
          aplicacoesExternas.length,
        aplicacaoConfirmada: true,
        avisoAplicacao:
          "Aplicações completadas pelo Paizinho em fonte original e conferidas com o catálogo interno. Confira a fonte antes de publicar.",
      });

      setAuditoria({
        ...(auditoriaBase || {}),
        aprovado: false,
        problemas: [
          ...((auditoriaBase?.problemas) || []),
          "Aplicações vindas de pesquisa externa validada — confira a fonte.",
        ],
      });

      setMostrarAplicacoes(true);
    }

    setPesquisaPaizinho({
      ...resultado,
      codigoPesquisado: codigoFinal,
      origemFallback: "base_incompleta",
      divergenciasBase,
      gravacaoBase: null,
    });
  } catch (erroComplemento) {
    // O complemento nunca quebra o anúncio já montado pela base.
    console.warn(
      "[PAIZINHO_PESQUISA] complemento falhou:",
      erroComplemento
    );
  }
}

async function analisarAntesDePublicar() {
  const temDadosObrigatorios =
    Boolean(
      titulo &&
      descricao &&
      preco &&
      fotosUnicas.length > 0
    );

  if (!temDadosObrigatorios) {
    alert(
      "⚠ Complete título, descrição, preço e pelo menos uma foto antes de publicar."
    );
    return;
  }

  const resultado =
    await motorCopilotoIA({
      pergunta:
        "Posso publicar este anúncio?",
      codigo,
      oem,
      titulo,
      descricao,
      preco,
      fotos: fotosUnicas,
      diagnostico,
      auditoria,
      pecaEncontrada,
      pontuacao:
        pontuacaoAnuncio?.pontos || 0,
    });

  const aprovadoTecnico =
    auditoria?.aprovado === true;

  const temDiagnostico =
    Boolean(diagnostico);

  const pontuacao =
    Number(
      pontuacaoAnuncio?.pontos || 0
    );

  const podePublicar =
    aprovadoTecnico ||
    temDiagnostico ||
    pontuacao >= 80;

  const decisao =
    resultado?.resposta ||
    "Análise concluída.";

  const confirmar =
  window.confirm(
    podePublicar
      ? `✅ Anúncio pronto para publicação.

O PAIIA concluiu a análise técnica e os dados obrigatórios estão preenchidos.

Deseja continuar para a publicação?`
      : `⚠ O anúncio ainda possui pontos para revisar.

${decisao}

Deseja publicar mesmo assim?`
  );

  if (!confirmar) {
    return;
  }

  await finalizarAnuncio();
}
  function abrirCentralPrecificacao() {
  const dadosAnuncio = {
    codigo,
    oem,
    titulo,
    descricao,
    preco,
    custo,
    tipoAnuncio,
    canalVenda,
    pecaEncontrada,
    diagnostico,
    auditoria,
    fotos: Array.isArray(
      fotosAnuncio
    )
      ? fotosAnuncio
      : [],
    clip: clipAnuncio || "",
  };

  gravarRascunhoAnuncio(
      "novoAnuncioTemporario",
      {
        ...extrasRascunho,
        ...(dadosAnuncio),
      }
    );

  gravarRascunhoAnuncio(
      "rascunhoNovoAnuncioTemp",
      {
        ...extrasRascunho,
        ...(dadosAnuncio),
      }
    );

  let dadosPrecificacaoSalvos = {};

  try {
    dadosPrecificacaoSalvos =
      JSON.parse(
        localStorage.getItem(
          "dadosPrecificacaoAppia"
        ) || "{}"
      );
  } catch {
    dadosPrecificacaoSalvos = {};
  }

  localStorage.setItem(
    "dadosPrecificacaoAppia",
    JSON.stringify({
      ...dadosPrecificacaoSalvos,

      // A precificação volta para ESTA ficha (nunca para outro anúncio).
      fichaIdPAIIA:
        fichaNovo.fichaId || "",

      codigo:
        codigo || oem || "",

      descricao:
        titulo ||
        pecaEncontrada?.peca ||
        descricao ||
        "",

      custo:
        custo || "",

      precoAtual:
        preco || "",
    })
  );

  localStorage.setItem(
    "retornarParaNovoAnuncio",
    "true"
  );

  setScreen(
    "centralPrecificacao"
  );
}
  // =====================================================
  // 📁 FOTO PRONTA DO COMPUTADOR (Área de Trabalho, pastas...)
  // Foto já em 1200×1200: enviada SEM alteração. Outro tamanho: ajustada para
  // 1200×1200 (padrão do Mercado Livre) sem cortar, centralizada em fundo
  // branco. O endereço público entra na MESMA lista de fotos e, com ela, na
  // MESMA ficha da base (nenhuma ficha nova é criada pelo envio).
  // =====================================================
  async function prepararFotoPronta(arquivo) {
    const endereco = URL.createObjectURL(arquivo);
    try {
      const img = await new Promise((ok, falha) => {
        const i = new Image();
        i.onload = () => ok(i);
        i.onerror = () => falha(new Error("arquivo não é uma imagem válida"));
        i.src = endereco;
      });
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (w === 1200 && h === 1200) {
        return { blob: arquivo, tipo: arquivo.type || "image/jpeg", ajustada: false, w, h };
      }
      const tela = document.createElement("canvas");
      tela.width = 1200;
      tela.height = 1200;
      const ctx = tela.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 1200, 1200);
      const escala = Math.min(1200 / w, 1200 / h);
      const dw = Math.round(w * escala);
      const dh = Math.round(h * escala);
      ctx.drawImage(img, Math.round((1200 - dw) / 2), Math.round((1200 - dh) / 2), dw, dh);
      const blob = await new Promise((ok) => tela.toBlob(ok, "image/jpeg", 0.92));
      if (!blob) throw new Error("não foi possível preparar a imagem");
      return { blob, tipo: "image/jpeg", ajustada: true, w, h };
    } finally {
      URL.revokeObjectURL(endereco);
    }
  }

  // Navegação entre as etapas da MESMA página: só rola até o bloco (e guarda
  // a etapa no endereço, para o F5 voltar a ela). Não grava, não limpa nada.
  function irParaEtapaNA(alvo) {
    try {
      const url = new URL(window.location.href);
      url.hash = alvo;
      window.history.replaceState(window.history.state, "", url.toString());
      document.getElementById(alvo)?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch {
      // sem rolagem
    }
  }
  // ← Voltar à Central: termina o salvamento da MESMA ficha antes de sair.
  // Se não salvar, avisa e fica na tela (nada é perdido).
  async function voltarCentralDoNovoAnuncio() {
    if (saidaNA.salvando) return;
    setSaidaNA({ salvando: true, erro: "" });
    const r = await fichaNovo.salvarAgora();
    if (!r.ok && !r.vazio && !r.fechada) {
      setSaidaNA({ salvando: false, erro: r.erro || "falha ao salvar" });
      return;
    }
    setSaidaNA({ salvando: false, erro: "" });
    setScreen?.("centralPublicacao");
  }
  // F5 / reabertura: volta para a etapa em que estava (#na-etapa-...).
  useEffect(() => {
    const alvo = String(window.location.hash || "").replace(/^#/, "");
    if (!/^(na-etapa-|secao-fotos-anuncio)/.test(alvo)) return undefined;
    const t = setTimeout(() => {
      try {
        document.getElementById(alvo)?.scrollIntoView({ block: "start" });
      } catch {
        // sem rolagem
      }
    }, 600);
    return () => clearTimeout(t);
  }, []);

  async function buscarFotosNoComputador(lista) {
    const arquivos = Array.from(lista || []).filter((a) => /^image\/(jpeg|png|webp)$/i.test(a.type || ""));
    const recusados = Array.from(lista || []).length - arquivos.length;
    if (!arquivos.length) {
      setEnvioFotosPC({ ocupado: false, texto: recusados ? "Escolha imagens JPG, PNG ou WEBP." : "", erros: [] });
      return;
    }
    if (!usuario?.id) {
      setEnvioFotosPC({ ocupado: false, texto: "Entre no PAIIA para enviar fotos.", erros: [] });
      return;
    }
    const novas = [];
    const erros = [];
    const notas = [];
    for (let i = 0; i < arquivos.length; i++) {
      const arq = arquivos[i];
      setEnvioFotosPC({ ocupado: true, texto: `⏳ Enviando ${i + 1} de ${arquivos.length}: ${arq.name}`, erros });
      try {
        const p = await prepararFotoPronta(arq);
        const ext = p.tipo === "image/png" ? "png" : p.tipo === "image/webp" ? "webp" : "jpg";
        const caminho = `${usuario.id}/prontas/1200x1200-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage.from("imagens").upload(caminho, p.blob, { upsert: false, contentType: p.tipo });
        if (error) throw new Error(error.message || "falha no envio");
        const { data } = supabase.storage.from("imagens").getPublicUrl(caminho);
        if (!data?.publicUrl) throw new Error("sem endereço público");
        novas.push({ imagem_processada: data.publicUrl, imagem_original: data.publicUrl, origem: "computador", nome_arquivo: arq.name, created_at: new Date().toISOString() });
        notas.push(p.ajustada ? `${arq.name}: ${p.w}×${p.h} → ajustada para 1200×1200 (sem cortar)` : `${arq.name}: já em 1200×1200 — enviada sem alteração`);
      } catch (erro) {
        erros.push(`${arq.name}: ${erro?.message || erro}`);
      }
    }
    if (novas.length) {
      setFotosAnuncio((atuais) => {
        const lista = Array.isArray(atuais) ? atuais : [];
        return [...lista, ...novas].map((f, ordem) => ({ ...f, ordem, capa: ordem === 0 }));
      });
    }
    setEnvioFotosPC({
      ocupado: false,
      texto: `${novas.length} foto(s) do computador adicionada(s)${recusados ? ` · ${recusados} arquivo(s) ignorado(s) (não é imagem JPG/PNG/WEBP)` : ""}.`,
      notas,
      erros,
    });
  }

  function escolherFotosGaleria() {
  // =====================================================
  // PRESERVA AS FOTOS EM MEMÓRIA
  // Evita colocar imagens pesadas no localStorage.
  // =====================================================
  window.__paiiaFotosNovoAnuncio =
    Array.isArray(fotosAnuncio)
      ? fotosAnuncio
      : [];

  // =====================================================
  // SALVA SOMENTE OS DADOS LEVES DO ANÚNCIO
  // =====================================================
  try {
    const dadosLeves = {
      codigo,
      oem,
      titulo,
      descricao,
      preco,
      tipoAnuncio,
      pecaEncontrada,
      diagnostico,
      auditoria,
      clip:
        clipAnuncio || "",
    };

    gravarRascunhoAnuncio(
      "novoAnuncioTemporario",
      {
        ...extrasRascunho,
        ...(dadosLeves),
      }
    );

    // Reserva com as fotos só por referência (URL, ordem e capa).
    gravarRascunhoAnuncio(
      "rascunhoNovoAnuncioTemp",
      {
        ...extrasRascunho,
        ...dadosLeves,
        fotos: Array.isArray(fotosAnuncio)
          ? fotosAnuncio
          : [],
      }
    );
  } catch (erro) {
    console.error(
      "Erro ao preservar anúncio antes da Galeria:",
      erro
    );
  }

  // =====================================================
  // MARCA O MODO DA GALERIA
  // =====================================================
  localStorage.setItem(
    "modoGaleria",
    "selecionarParaAnuncio"
  );

  localStorage.setItem(
    "abrirGaleriaAnuncio",
    "true"
  );

  localStorage.setItem(
    "abrirUltimasFotos",
    "true"
  );

  localStorage.setItem(
    "abrirGaleriaNaAba",
    "foto"
  );

  localStorage.setItem(
    "galeriaAbaFixa",
    "foto"
  );

  setScreen(
    "galeria"
  );
}
function escolherBannerGaleria() {
  // Preserva as imagens já escolhidas
  window.__paiiaFotosNovoAnuncio =
    Array.isArray(fotosAnuncio)
      ? fotosAnuncio
      : [];

  try {
    const dadosLeves = {
      codigo,
      oem,
      titulo,
      descricao,
      preco,
      tipoAnuncio,
      pecaEncontrada,
      diagnostico,
      auditoria,
      clip:
        clipAnuncio || "",
    };

    gravarRascunhoAnuncio(
      "novoAnuncioTemporario",
      {
        ...extrasRascunho,
        ...(dadosLeves),
      }
    );

    // Reserva com as fotos só por referência (URL, ordem e capa).
    gravarRascunhoAnuncio(
      "rascunhoNovoAnuncioTemp",
      {
        ...extrasRascunho,
        ...dadosLeves,
        fotos: Array.isArray(fotosAnuncio)
          ? fotosAnuncio
          : [],
      }
    );
  } catch (erro) {
    console.error(
      "Erro ao preservar anúncio antes de escolher banner:",
      erro
    );
  }

  localStorage.setItem(
    "modoGaleria",
    "selecionarParaAnuncio"
  );

  localStorage.setItem(
    "abrirGaleriaAnuncio",
    "true"
  );

  localStorage.setItem(
    "abrirGaleriaNaAba",
    "banner"
  );

  localStorage.setItem(
    "galeriaAbaFixa",
    "banner"
  );

  localStorage.removeItem(
    "abrirUltimasFotos"
  );

  setScreen(
    "galeria"
  );
}
  function obterFotoPrincipal() {
    const foto =
      fotosUnicas[0];

    return (
      foto?.imagem_processada ||
      foto?.imagem_original ||
      ""
    );
  }

  function salvarFluxoMidiasIA() {
    gravarRascunhoAnuncio(
      chaveRascunhoTemp,
      {
        ...extrasRascunho,
        ...({
        codigo,
        oem,
        titulo,
        descricao,
        preco,
        tipoAnuncio,
        pecaEncontrada,
        fotos: fotosAnuncio || [],
        clip: clipAnuncio || "",
      }),
      }
    );

    localStorage.setItem(
      "retornarParaNovoAnuncio",
      "true"
    );
  }

  function abrirFotoIA() {
    const fotoPrincipal =
      obterFotoPrincipal();

    if (!fotoPrincipal) {
      alert(
        "Escolha pelo menos uma foto antes de abrir a Foto IA."
      );
      return;
    }

    salvarFluxoMidiasIA();

    localStorage.setItem(
      "imagemFotoSelecionada",
      fotoPrincipal
    );

    localStorage.setItem(
      "abrirFotoAutomatico",
      "true"
    );

    setScreen("foto");
  }

  function importarBannerDaGaleria() {
    gravarRascunhoAnuncio(
      chaveRascunhoTemp,
      {
        ...extrasRascunho,
        ...({
        codigo,
        oem,
        titulo,
        descricao,
        preco,
        tipoAnuncio,
        pecaEncontrada,
        diagnostico,
        auditoria,
        fotos: fotosAnuncio || [],
        clip: clipAnuncio || "",
      }),
      }
    );

    gravarRascunhoAnuncio(
      "novoAnuncioTemporario",
      {
        ...extrasRascunho,
        ...({
        codigo,
        oem,
        titulo,
        descricao,
        preco,
        tipoAnuncio,
        pecaEncontrada,
        diagnostico,
        auditoria,
        fotos: fotosAnuncio || [],
        clip: clipAnuncio || "",
      }),
      }
    );

    localStorage.setItem(
      "modoGaleria",
      "selecionarParaAnuncio"
    );

    localStorage.setItem(
      "filtroGaleriaAnuncio",
      "banner"
    );

    localStorage.setItem(
      "retornarParaNovoAnuncio",
      "true"
    );

    setScreen("galeria");
  }

  function importarClipDaGaleria() {
    salvarFluxoMidiasIA();

    localStorage.setItem(
      "modoGaleria",
      "selecionarClipParaAnuncio"
    );

    localStorage.setItem(
      "filtroGaleriaAnuncio",
      "clip"
    );

    localStorage.setItem(
      "retornarParaNovoAnuncio",
      "true"
    );

    setScreen("galeria");
  }

  function abrirBannerStudio() {
  salvarFluxoMidiasIA();

  // Banner deve ser independente das fotos do anúncio
  localStorage.removeItem(
    "imagemBannerSelecionada"
  );

  localStorage.removeItem(
    "abrirBannerAutomatico"
  );

  // Marca de onde o usuário veio
  localStorage.setItem(
    "retornarParaNovoAnuncio",
    "true"
  );

  localStorage.setItem(
    "voltarParaMidiasAnuncio",
    "true"
  );

  setScreen(
    "bannerStudio"
  );
}

  function abrirClipIA() {
    const fotoPrincipal =
      obterFotoPrincipal();

    if (!fotoPrincipal) {
      alert(
        "Escolha pelo menos uma foto antes de abrir o Clip IA."
      );
      return;
    }

    salvarFluxoMidiasIA();

    // Nova geração: remove qualquer Clip/imagem antiga
    // antes de enviar a foto atual do anúncio.
    setClipAnuncio("");

    localStorage.removeItem(
      "clipPronto"
    );

    localStorage.removeItem(
      "clipSelecionado"
    );

    localStorage.removeItem(
      "clipSelecionadoEstilo"
    );

    localStorage.removeItem(
      "clipGeracaoStatus"
    );

    localStorage.removeItem(
      "clipGeracaoMensagem"
    );

    localStorage.removeItem(
      "clipGeracaoErro"
    );

    localStorage.removeItem(
      "imagemClipSelecionada"
    );

    localStorage.setItem(
      "imagemClipSelecionada",
      fotoPrincipal
    );

    localStorage.setItem(
      "abrirClipAutomatico",
      "true"
    );

    localStorage.setItem(
      "clipDescricaoPeca",
      [
        pecaEncontrada?.peca,
        titulo,
        codigo || oem,
      ]
        .filter(Boolean)
        .join(" ")
    );

    localStorage.setItem(
      "clipFamiliaPeca",
      String(
        pecaEncontrada?.familia ||
        pecaEncontrada?.peca ||
        ""
      )
    );

    setScreen("clipIA");
  }


  function abrirClipParaRevisao() {
    localStorage.setItem(
      "voltarParaMidiasAnuncio",
      "true"
    );

    localStorage.setItem(
      "retornarParaNovoAnuncio",
      "true"
    );

    setScreen("clipIA");
  }


  async function salvarRascunho() {
    if (!titulo && !codigo && !oem) {
      alert(
        "Preencha pelo menos o título, o código ou o OEM."
      );
      return;
    }

    if (!usuario?.id) {
      alert("Faça login para salvar o anúncio.");
      return;
    }

    const fotoPrincipal =
      fotosAnuncio?.[0]?.imagem_processada ||
      fotosAnuncio?.[0]?.imagem_original ||
      null;

    const dadosRascunho = {
      user_id: usuario.id,
      codigo: String(codigo || ""),
      oem: String(oem || ""),
      titulo,
      descricao,
      preco: preco ? Number(preco) : null,
      tipo: tipoAnuncio,
      foto_principal: fotoPrincipal,
      fotos: fotosAnuncio || [],
      clip_url: clipAnuncio || null,
      status: "rascunho",
      updated_at: new Date().toISOString(),
    };

    let resultado;

    if (anuncioEditando?.id) {
      resultado = await supabase
        .from("rascunhos_anuncios")
        .update(dadosRascunho)
        .eq("id", anuncioEditando.id)
        .eq("user_id", usuario.id);
    } else {
      resultado = await supabase
        .from("rascunhos_anuncios")
        .insert([dadosRascunho]);
    }

    if (resultado.error) {
      alert(
        "Erro ao salvar rascunho: " +
          resultado.error.message
      );
      return;
    }
marcarAnuncioPronto({
  titulo,
  descricao,
  preco,
});
    alert("💾 Anúncio salvo com sucesso!");
  }

  async function continuarParaPublicacao() {
    // A ficha é gravada na base ANTES de seguir. Se falhar, avisa e só
    // segue se o usuário quiser (os dados continuam no navegador).
    const gravacao = await fichaNovo.salvarAgora();
    if (!gravacao.ok && !gravacao.vazio && !gravacao.fechada) {
      const seguir = window.confirm(
        `Não foi possível salvar a ficha na base PAIIA: ${gravacao.erro || "erro desconhecido"}.\n\nOs dados continuam neste navegador. Seguir para a Central de Publicação mesmo assim?`
      );
      if (!seguir) return;
    }
    const fichaIdAtual = gravacao.fichaId || fichaNovo.fichaId || "";
    let dadosSalvos = {};

    try {
      const salvo =
        localStorage.getItem(
          "novoAnuncioTemporario"
        ) ||
        localStorage.getItem(
          "rascunhoNovoAnuncioTemp"
        );

      dadosSalvos = salvo
        ? JSON.parse(salvo)
        : {};
    } catch {
      dadosSalvos = {};
    }

    const tituloFinal =
      String(
        titulo ||
        dadosSalvos?.titulo ||
        ""
      ).trim();

    const descricaoFinal =
      String(
        descricao ||
        dadosSalvos?.descricao ||
        ""
      ).trim();

    const precoOrigem =
      preco ||
      dadosSalvos?.preco ||
      "";

    const precoFinal = Number(
      String(precoOrigem)
        .replace(/\./g, "")
        .replace(",", ".")
        .trim()
    );

    if (!tituloFinal) {
      alert(
        "Preencha o título antes de continuar."
      );
      return;
    }

    if (!descricaoFinal) {
      alert(
        "Preencha a descrição antes de continuar."
      );
      return;
    }

    if (
      !Number.isFinite(precoFinal) ||
      precoFinal <= 0
    ) {
      alert(
        "Informe um preço válido antes de continuar."
      );
      return;
    }

    if (!fotosUnicas.length) {
      alert(
        "Adicione pelo menos uma foto antes de continuar."
      );
      return;
    }

    localStorage.setItem(
      "anuncioProntoPublicacao",
      JSON.stringify({
        codigo:
          codigo ||
          dadosSalvos?.codigo ||
          "",
        oem:
          oem ||
          dadosSalvos?.oem ||
          "",
        titulo: tituloFinal,
        descricao: descricaoFinal,
        preco: precoFinal,
        tipoAnuncio:
          tipoAnuncio ||
          dadosSalvos?.tipoAnuncio ||
          "classico",
        fotos: fotosUnicas,
        clip:
          clipAnuncio ||
          dadosSalvos?.clip ||
          "",
        pecaEncontrada:
          pecaEncontrada ||
          dadosSalvos?.pecaEncontrada ||
          null,
        diagnostico:
          diagnostico ||
          dadosSalvos?.diagnostico ||
          null,
        auditoria:
          auditoria ||
          dadosSalvos?.auditoria ||
          null,
        // Dados técnicos (uma fonte): tipo de veículo e peso/medidas em g/cm.
        tipoVeiculo: tipoVeiculoNA,
        ...(medidaDoNovoAnuncio({ pesoFreteML, alturaFreteML, larguraFreteML, comprimentoFreteML })
          ? { embalagem: medidaDoNovoAnuncio({ pesoFreteML, alturaFreteML, larguraFreteML, comprimentoFreteML }) }
          : {}),
        edicoes: edicoesDadosTecnicos,
        // Registro único de frete × precificação (segue até a Publicação).
        ...(registroFreteML ? { freteML: registroFreteML } : {}),
        // MESMA ficha da base: a Conferência continua nela (não cria outra).
        fichaIdPAIIA: fichaIdAtual,
      })
    );

    setScreen(
      "centralPublicacao"
    );
  }

  function recuperarRascunho() {
    const salvo = localStorage.getItem(chaveRascunhoTemp);

    if (!salvo) {
      alert("Nenhum rascunho encontrado.");
      return;
    }

    try {
      const rascunho = JSON.parse(salvo);

      setCodigo(rascunho.codigo || "");
      setOem(rascunho.oem || "");
      setTitulo(rascunho.titulo || "");
      setDescricao(rascunho.descricao || "");
      setPreco(rascunho.preco || "");

      setTipoAnuncio(
        rascunho.tipoAnuncio || "classico"
      );

      setPecaEncontrada(
        rascunho.pecaEncontrada || null
      );

      setFotosAnuncio(rascunho.fotos || []);
      setClipAnuncio(rascunho.clip || "");

      if (rascunho.clip) {
        localStorage.setItem(
          "clipPronto",
          rascunho.clip
        );
      }

      alert("✅ Rascunho recuperado!");
    } catch {
      alert("Não foi possível recuperar o rascunho.");
    }
  }

  function limparAnuncio() {
    // Anúncio novo: a ficha anterior continua salva na base (Central).
    fichaNovo.novaFicha();
    zerarDadosTecnicos();
    setCodigo("");
    setOem("");
    setTitulo("");
    setDescricao("");
    setPreco("");
    setTipoAnuncio("classico");

    setPecaEncontrada(null);
    setDiagnostico(null);
    setAuditoria(null);

    setFotosAnuncio([]);
    setClipAnuncio("");
    setAnuncioEditando?.(null);

    localStorage.removeItem(
      "clipPronto"
    );

    localStorage.removeItem(
      "clipSelecionado"
    );

    localStorage.removeItem(
      "clipSelecionadoEstilo"
    );

    setProcessando(false);
    setEtapaProcessamento("");
    setProgressoProcessamento(0);

    limparAnuncioTemporario();

    localStorage.removeItem(
      "rascunhoNovoAnuncioTemp"
    );

    localStorage.removeItem(
      "usarDadosCatalogoNoAnuncio"
    );

    localStorage.removeItem(
      "fotosSelecionadasAnuncio"
    );

    alert("🧹 Anúncio limpo.");
  }

  function limparFotos() {
    setFotosAnuncio([]);

    localStorage.removeItem(
      "fotosSelecionadasAnuncio"
    );

    const salvo = localStorage.getItem(
      chaveRascunhoTemp
    );

    if (salvo) {
      try {
        const rascunho = JSON.parse(salvo);

        gravarRascunhoAnuncio(
      chaveRascunhoTemp,
      {
        ...extrasRascunho,
        ...({
            ...rascunho,
            fotos: [],
          }),
      }
    );
      } catch {
        localStorage.removeItem(chaveRascunhoTemp);
      }
    }

    alert("🗑️ Fotos removidas.");
  }

  async function copiarAnuncio() {
    if (!titulo && !descricao) {
      alert("O anúncio ainda está vazio.");
      return;
    }

    try {
      await navigator.clipboard.writeText(
        `${titulo || ""}\n\n${descricao || ""}`.trim()
      );

      alert("✅ Anúncio copiado!");
    } catch {
      alert("Não foi possível copiar o anúncio.");
    }
  }

  const fotosUnicas = (fotosAnuncio || []).filter(
    (foto, index, lista) =>
      index ===
      lista.findIndex(
        (item) =>
          (item.imagem_processada ||
            item.imagem_original) ===
          (foto.imagem_processada ||
            foto.imagem_original)
      )
  );

  const recomendacoesIA =
    analisarAnuncio({
      titulo,
      descricao,
      preco,
      fotos: fotosUnicas,
      diagnostico,
      auditoria,
    });

  const parecerIA =
    gerarParecerIA({
      recomendacoes:
        recomendacoesIA,
      pontuacao:
        pontuacaoAnuncio?.pontos ||
        0,
      diagnostico,
    });

  

  const etapasConcluidas =
    (codigo || oem ? 1 : 0) +
    (titulo ? 1 : 0) +
    (descricao ? 1 : 0) +
    (fotosUnicas.length > 0 ? 1 : 0);

  const progressoAnuncio = Math.round(
    (etapasConcluidas / 4) * 100
  );

  const fotoIAConcluida =
    fotosUnicas.length > 0;

  const bannerIAConcluido =
    fotosUnicas.some(
      (foto) => foto.tipo === "banner"
    );

  const clipIAConcluido =
    Boolean(clipAnuncio);

  const totalMidiasConcluidas =
    Number(fotoIAConcluida) +
    Number(bannerIAConcluido) +
    Number(clipIAConcluido);

  const progressoProducao = Math.round(
    (totalMidiasConcluidas / 3) * 100
  );

  const kitMidiasFinalizado =
    totalMidiasConcluidas === 3;

  return (
    <div style={{ marginTop: "25px" }} {...fichaNovo.propsInteracao}>
      <div style={cardStyle}>
        <h2 style={tituloPagina}>
          🤖 Criador Inteligente de Anúncios
        </h2>

        <p style={subtituloPagina}>
          Informe o código da peça, revise os dados,
          adicione fotos e finalize o anúncio.
        </p>
        <p
          data-paiia-ficha-novo-anuncio={fichaNovo.status.estado || "sem_ficha"}
          style={{
            fontSize: "12px",
            margin: "4px 0 12px",
            color:
              fichaNovo.status.estado === "erro" || fichaNovo.status.estado === "fechada"
                ? "#fca5a5"
                : fichaNovo.status.estado === "salvo"
                  ? "#86efac"
                  : "#94a3b8",
          }}
        >
          {fichaNovo.status.estado === "salvando"
            ? "⏳ Salvando a ficha na base PAIIA..."
            : fichaNovo.status.estado === "erro"
              ? `⚠ A ficha NÃO foi salva na base PAIIA: ${fichaNovo.status.erro} Os dados continuam neste navegador; nova tentativa na próxima alteração.`
              : fichaNovo.status.estado === "fechada"
                ? `⚠ ${fichaNovo.status.erro} Para começar um anúncio novo, use "Limpar anúncio".`
                : fichaNovo.fichaId
                  ? `💾 Ficha salva na base PAIIA (ID ${fichaNovo.fichaId.slice(0, 8)})${fichaNovo.status.em ? ` · ${new Date(fichaNovo.status.em).toLocaleTimeString("pt-BR")}` : ""}`
                  : "A ficha é criada na base PAIIA assim que houver o código da peça e algum dado do anúncio."}
        </p>
        <nav data-paiia-etapas-novo-anuncio style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center", margin: "0 0 12px" }}>
          <button type="button" data-paiia-navegacao data-paiia-voltar-central-na onClick={voltarCentralDoNovoAnuncio} disabled={saidaNA.salvando} style={botaoEtapaNA}>
            ← Voltar à Central de Publicação
          </button>
          <span style={{ color: "#64748b", fontSize: 12 }}>Ir para:</span>
          {[["na-etapa-dados", "Dados da peça"], ["secao-fotos-anuncio", "Fotos"], ["na-etapa-dados-tecnicos", "Dados técnicos"], ["na-etapa-preco-frete", "Preço e frete"], ["na-etapa-finalizar", "Finalizar"]].map(([alvo, nome]) => (
            <button key={alvo} type="button" data-paiia-navegacao data-paiia-ir-etapa={alvo} onClick={() => irParaEtapaNA(alvo)} style={botaoEtapaNA}>
              {nome}
            </button>
          ))}
        </nav>
        {saidaNA.salvando && <p data-paiia-salvando-ao-sair style={{ color: "#bfdbfe", fontSize: 12 }}>⏳ Salvando a ficha antes de sair...</p>}
        {saidaNA.erro && (
          <p data-paiia-erro-ao-sair style={{ color: "#fca5a5", fontSize: 13 }}>
            ❌ A ficha NÃO foi salva na base PAIIA: {saidaNA.erro} Os dados continuam nesta tela.{" "}
            <button type="button" data-paiia-navegacao onClick={voltarCentralDoNovoAnuncio} style={botaoEtapaNA}>🔁 Tentar salvar de novo</button>{" "}
            <button type="button" data-paiia-navegacao onClick={() => setSaidaNA({ salvando: false, erro: "" })} style={botaoEtapaNA}>Ficar nesta tela</button>
          </p>
        )}
        <div id="na-etapa-dados">
        <DadosPeca
  codigo={codigo}
  setCodigo={setCodigo}
  oem={oem}
  setOem={setOem}
  titulo={titulo}
  setTitulo={setTitulo}
  descricao={descricao}
  setDescricao={setDescricao}
  preco={preco}
  setPreco={setPreco}
  tipoAnuncio={tipoAnuncio}
  setTipoAnuncio={setTipoAnuncio}
  pecaEncontrada={pecaEncontrada}
  buscarEMontarAnuncio={buscarEMontarAnuncio}
  processando={processando}
  etapaProcessamento={etapaProcessamento}
  progressoProcessamento={progressoProcessamento}
  avisoNaoEncontrado={
    pesquisaPaizinho?.status === "nao_encontrado_catalogos"
      ? pesquisaPaizinho?.mensagem || MENSAGEM_NAO_ENCONTRADO_CATALOGOS
      : ""
  }
/>
        </div>

<section
  id="secao-fotos-anuncio"
  style={{
    ...secaoStyle,
    minHeight: "285px",
    padding: "26px",
    border: "1px solid #2563eb",
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-start",
  }}
>
  <BotaoVoltarEtapaNA alvo="na-etapa-dados">← Voltar aos Dados da peça</BotaoVoltarEtapaNA>
  <h3
    style={{
      ...tituloSecao,
      marginBottom: "18px",
      fontSize: "21px",
    }}
  >
    ③ 🖼 Imagens do Anúncio
  </h3>

  <div
  style={{
    display: "flex",
    gap: "12px",
    justifyContent: "center",
    flexWrap: "wrap",
    marginBottom: "18px",
  }}
>
  <button
    type="button"
    onClick={escolherFotosGaleria}
    style={{
      ...botaoAzul,
      minWidth: "310px",
      padding: "16px 24px",
      fontSize: "15px",
      fontWeight: "bold",
    }}
  >
    🖼 Escolher Foto
  </button>

  <button
    type="button"
    onClick={escolherBannerGaleria}
    style={{
      ...botaoEscuro,
      minWidth: "310px",
      padding: "16px 24px",
      fontSize: "15px",
      fontWeight: "bold",
    }}
  >
    🎨 Escolher Banner
  </button>

  <button
    type="button"
    data-paiia-buscar-foto-computador
    onClick={() => inputFotosComputadorRef.current?.click()}
    disabled={envioFotosPC.ocupado}
    style={{
      ...botaoEscuro,
      minWidth: "310px",
      padding: "16px 24px",
      fontSize: "15px",
      fontWeight: "bold",
      border: "1px solid #22c55e",
    }}
  >
    {envioFotosPC.ocupado ? "⏳ Enviando fotos..." : "📁 Buscar foto pronta no computador"}
  </button>
  <input
    ref={inputFotosComputadorRef}
    data-paiia-input-foto-computador
    type="file"
    accept="image/jpeg,image/png,image/webp"
    multiple
    style={{ display: "none" }}
    onChange={(e) => {
      const lista = e.target.files;
      buscarFotosNoComputador(lista);
      e.target.value = "";
    }}
  />
</div>
{(envioFotosPC.texto || envioFotosPC.erros?.length > 0) && (
  <div data-paiia-envio-fotos-computador style={{ color: "#cbd5e1", fontSize: 13, marginBottom: 12, textAlign: "center" }}>
    <div>{envioFotosPC.texto}</div>
    {(envioFotosPC.notas || []).map((n) => <div key={n} style={{ color: "#94a3b8", fontSize: 12 }}>{n}</div>)}
    {(envioFotosPC.erros || []).map((n) => <div key={n} style={{ color: "#fca5a5", fontSize: 12 }}>❌ {n}</div>)}
  </div>
)}

  <div
    style={{
      width: "100%",
      flex: 1,
      minHeight: "145px",
      padding: fotosUnicas.length > 0
        ? "8px"
        : "22px",
      borderRadius: "14px",
      border: "1px dashed #334155",
      background: "#0f172a",
      display: "flex",
      alignItems:
        fotosUnicas.length > 0
          ? "stretch"
          : "center",
      justifyContent: "center",
    }}
  >
    {fotosUnicas.length > 0 ? (
      <PainelFotosAnuncio
        fotosAnuncio={fotosUnicas}
        setFotosAnuncio={setFotosAnuncio}
      />
    ) : (
      <div
        style={{
          color: "#64748b",
          textAlign: "center",
          fontSize: "14px",
          lineHeight: 1.5,
        }}
      >
        🖼 Nenhuma imagem selecionada ainda.
        <br />
        Escolha as fotos da Galeria PAIIA para montar o anúncio.
      </div>
    )}
  </div>

  {fotosUnicas.length > 0 && (
    <button
      type="button"
      onClick={limparFotos}
      style={{
        ...botaoVermelho,
        alignSelf: "center",
        marginTop: "14px",
      }}
    >
      🗑️ Limpar fotos do anúncio
    </button>
  )}
</section>

<section id="na-etapa-dados-tecnicos" data-paiia-dados-tecnicos style={{ ...secaoStyle, border: "1px solid #0ea5e9" }}>
  <BotaoVoltarEtapaNA alvo="secao-fotos-anuncio">← Voltar às Fotos</BotaoVoltarEtapaNA>
  <h3 style={tituloSecao}>🔩 Dados técnicos — tipo de veículo, peso e medidas</h3>
  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: "10px", width: "100%" }}>
    <label style={{ color: "#cbd5e1", fontSize: "12px" }}>
      Tipo de veículo
      <select
        data-paiia-na-tipo-veiculo
        value={tipoVeiculoNA}
        onChange={(e) => alterarDadoTecnico("tipoVeiculo", e.target.value)}
        style={campoPrecificacaoAppia}
      >
        {OPCOES_TIPO_VEICULO.map((v) => (
          <option key={v} value={v}>{v}</option>
        ))}
      </select>
    </label>
    <label style={{ color: "#cbd5e1", fontSize: "12px" }}>
      Peso (kg){kgParaG(pesoFreteML) ? ` = ${kgParaG(pesoFreteML)} g` : ""}
      <input data-paiia-na-peso value={pesoFreteML} onChange={(e) => alterarDadoTecnico("pesoFreteML", e.target.value)} placeholder="Ex.: 0,350" style={campoPrecificacaoAppia} />
    </label>
    <label style={{ color: "#cbd5e1", fontSize: "12px" }}>
      Comprimento (cm)
      <input data-paiia-na-comprimento value={comprimentoFreteML} onChange={(e) => alterarDadoTecnico("comprimentoFreteML", e.target.value)} placeholder="Ex.: 20" style={campoPrecificacaoAppia} />
    </label>
    <label style={{ color: "#cbd5e1", fontSize: "12px" }}>
      Largura (cm)
      <input data-paiia-na-largura value={larguraFreteML} onChange={(e) => alterarDadoTecnico("larguraFreteML", e.target.value)} placeholder="Ex.: 15" style={campoPrecificacaoAppia} />
    </label>
    <label style={{ color: "#cbd5e1", fontSize: "12px" }}>
      Altura (cm)
      <input data-paiia-na-altura value={alturaFreteML} onChange={(e) => alterarDadoTecnico("alturaFreteML", e.target.value)} placeholder="Ex.: 8" style={campoPrecificacaoAppia} />
    </label>
  </div>
  <p data-paiia-na-medida-resumo style={{ color: "#94a3b8", fontSize: 12, margin: "8px 0 0" }}>
    {medidaDoNovoAnuncio({ pesoFreteML, alturaFreteML, larguraFreteML, comprimentoFreteML })
      ? `Embalagem: ${textoMedida(medidaDoNovoAnuncio({ pesoFreteML, alturaFreteML, larguraFreteML, comprimentoFreteML }))}. `
      : "Peso e medidas da embalagem ainda incompletos. "}
    São os MESMOS valores do cálculo de frete (um só lugar): ficam na ficha e vão para a Conferência (⑥ Peso e Embalagem), o Mercado Livre e o Bling. Peso em kg aqui; na Conferência aparece em g.
  </p>
</section>


        <section id="na-etapa-preco-frete" style={centralInteligenciaAnuncioStyle}>
          <BotaoVoltarEtapaNA alvo="na-etapa-dados-tecnicos">← Voltar aos Dados técnicos</BotaoVoltarEtapaNA>
          <div style={centralInteligenciaCabecalho}>
            <div>
              <h3 style={centralInteligenciaTitulo}>
                🧠 Central de Inteligência do Anúncio
              </h3>

              <p style={centralInteligenciaSubtitulo}>
                O PAIIA acompanha técnica, preço, qualidade e
                prontidão enquanto você monta o anúncio.
              </p>
            </div>

            <div
              style={{
                ...centralInteligenciaStatus,
                borderColor:
                  titulo &&
                  descricao &&
                  preco &&
                  fotosUnicas.length > 0
                    ? "#22c55e"
                    : "#f59e0b",
                color:
                  titulo &&
                  descricao &&
                  preco &&
                  fotosUnicas.length > 0
                    ? "#bbf7d0"
                    : "#fde68a",
                background:
                  titulo &&
                  descricao &&
                  preco &&
                  fotosUnicas.length > 0
                    ? "#052e16"
                    : "#422006",
              }}
            >
              {titulo &&
              descricao &&
              preco &&
              fotosUnicas.length > 0
                ? "🟢 Pronto para finalizar"
                : "🟡 Em preparação"}
            </div>
          </div>

          <div style={centralInteligenciaGrade}>
            <div
  style={{
    ...centralInteligenciaCard,
    gridColumn: "1 / -1",
  }}
>
  <span
    style={centralInteligenciaRotulo}
  >
    💰 Inteligência Comercial
  </span>

  <strong
    style={{
      ...centralInteligenciaValor,
      color: preco
        ? "#86efac"
        : "#ffffff",
    }}
  >
    {preco
      ? `Preço atual: R$ ${preco}`
      : "Calcule o preço ideal"}
  </strong>

  <span
    style={centralInteligenciaTexto}
  >
    Informe seus custos. O PAIIA calcula
    preços buscando margem líquida de
    10%, 15% ou 20%.
  </span>

  <div
    style={{
      width: "100%",
      marginTop: "16px",
      padding: "14px",
      borderRadius: "12px",
      border: "1px solid #334155",
      background: "#020617",
    }}
  >
    <div
      style={{
        color: "#e2e8f0",
        fontSize: "13px",
        fontWeight: "700",
        marginBottom: "10px",
      }}
    >
      Tipo de anúncio
    </div>

    <div
      style={{
        display: "grid",
        gridTemplateColumns:
          "repeat(4,minmax(140px,220px))",
        gap: "10px",
      }}
    >
      <button
        type="button"
        data-paiia-ml-tipo="classico"
        data-paiia-ml-tipo-ativo={canalVenda === "mercado_livre" && tipoAnuncio === "classico" ? "sim" : "nao"}
        onClick={() => escolherTipoAnuncio("classico")}
        style={{
          padding: "13px 16px",
          borderRadius: "10px",
          border:
            canalVenda === "mercado_livre" &&
            tipoAnuncio === "classico"
              ? "2px solid #38bdf8"
              : "1px solid #334155",
          background:
            canalVenda === "mercado_livre" &&
            tipoAnuncio === "classico"
              ? "linear-gradient(135deg,#075985,#0f172a)"
              : "#0f172a",
          color: "#ffffff",
          fontWeight: "700",
          cursor: "pointer",
        }}
      >
        🔵 Clássico
      </button>

      <button
        type="button"
        data-paiia-ml-tipo="premium"
        data-paiia-ml-tipo-ativo={canalVenda === "mercado_livre" && tipoAnuncio === "premium" ? "sim" : "nao"}
        onClick={() => escolherTipoAnuncio("premium")}
        style={{
          padding: "13px 16px",
          borderRadius: "10px",
          border:
            canalVenda === "mercado_livre" &&
            tipoAnuncio === "premium"
              ? "2px solid #22c55e"
              : "1px solid #334155",
          background:
            canalVenda === "mercado_livre" &&
            tipoAnuncio === "premium"
              ? "linear-gradient(135deg,#166534,#0f172a)"
              : "#0f172a",
          color: "#ffffff",
          fontWeight: "700",
          cursor: "pointer",
        }}
      >
        🟢 Premium
      </button>

      <button
        type="button"
        data-paiia-canal="shopee"
        onClick={() => escolherCanal("shopee")}
        style={{
          padding: "13px 16px",
          borderRadius: "10px",
          border:
            canalVenda === "shopee"
              ? "2px solid #fb923c"
              : "1px solid #334155",
          background:
            canalVenda === "shopee"
              ? "linear-gradient(135deg,#9a3412,#0f172a)"
              : "#0f172a",
          color: "#ffffff",
          fontWeight: "700",
          cursor: "pointer",
        }}
      >
        🟠 Shopee
      </button>

      <button
        type="button"
        data-paiia-canal="site_proprio"
        onClick={() => escolherCanal("site_proprio")}
        style={{
          padding: "13px 16px",
          borderRadius: "10px",
          border:
            canalVenda === "site_proprio"
              ? "2px solid #a78bfa"
              : "1px solid #334155",
          background:
            canalVenda === "site_proprio"
              ? "linear-gradient(135deg,#6d28d9,#0f172a)"
              : "#0f172a",
          color: "#ffffff",
          fontWeight: "700",
          cursor: "pointer",
        }}
      >
        🌐 Seu Site
      </button>
    </div>

    <div
      style={{
        marginTop: "9px",
        color: "#94a3b8",
        fontSize: "12px",
        lineHeight: 1.5,
      }}
    >
      Comissão-base sugerida para o cálculo:{" "}
      <strong style={{ color: "#67e8f9" }}>
        {canalVenda === "site_proprio"
          ? `${comissaoPrecificacao || "0"}%`
          : `${textoPorcentagem(comissaoDeReferencia({ canal: canalVenda, tipo: tipoAnuncio, refs: comissoesReferencia }))}%`}
      </strong>
      . {canalVenda === "site_proprio"
        ? "Informe abaixo a taxa/comissão do seu site."
        : "Você pode ajustar a comissão abaixo se a categoria tiver outra taxa."}
    </div>
  </div>



  {(() => {
    const rotulo = { color: "#cbd5e1", fontSize: "12px" };
    const fr = resumoFrete(registroFreteML);
    const recalculando = cotacaoFrete.ocupado || precisaRecalcularNA;
    const falta = prontoParaCotar(paramsFreteNA);
    const aguardandoPreco = soFaltaPreco({ situacao: situacaoFreteNA, registro: registroFreteML, preco: numeroPrecificacao(preco) });
    const estadoML = recalculando ? "calculando" : cotacaoFrete.falhou && !registroFreteML ? "erro" : aguardandoPreco ? "aguardando_preco" : situacaoFreteNA.estado;
    return (
      <>
        <div
          data-paiia-precificacao-campos
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
            gap: "10px",
            width: "100%",
            marginTop: "14px",
          }}
        >
          <label style={rotulo}>
            Custo da mercadoria
            <input data-paiia-ml-custo value={custo} onChange={(e) => setCusto(e.target.value)} placeholder="0,00" style={campoPrecificacaoAppia} />
          </label>
          <label style={rotulo} title="Quanto você paga de frete para RECEBER a peça (por unidade). Entra no custo; não é o frete de venda.">
            Frete de compra
            <input data-paiia-frete-compra value={freteCompraPrecificacao} onChange={(e) => setFreteCompraPrecificacao(e.target.value)} placeholder="0,00" style={campoPrecificacaoAppia} />
          </label>
          <label style={rotulo}>
            Embalagem
            <input data-paiia-ml-embalagem value={despesasPrecificacao} onChange={(e) => setDespesasPrecificacao(e.target.value)} placeholder="3,00" style={campoPrecificacaoAppia} />
          </label>
          <label style={rotulo}>
            Comissão %
            <input data-paiia-ml-comissao value={comissaoPrecificacao} onChange={(e) => alterarComissao(e.target.value)} placeholder="12" style={campoPrecificacaoAppia} />
          </label>
          <label style={rotulo}>
            Impostos %
            <input data-paiia-ml-impostos value={impostoPrecificacao} onChange={(e) => setImpostoPrecificacao(e.target.value)} placeholder="8" style={campoPrecificacaoAppia} />
          </label>
          {canalVenda !== "mercado_livre" && (
            <label style={rotulo} title="Frete de VENDA que você paga ao enviar (deixe vazio se o cliente paga). Não é o frete de compra.">
              Frete de venda (se você paga)
              <input data-paiia-frete-venda value={fretePrecificacao} onChange={(e) => setFretePrecificacao(e.target.value)} placeholder="0,00" style={campoPrecificacaoAppia} />
            </label>
          )}
        </div>

        {canalVenda === "mercado_livre" && (
          <div
            id="na-etapa-frete-ml"
            data-paiia-frete-ml-painel
            data-paiia-frete-estado={situacaoFreteNA.estado}
            style={{ width: "100%", marginTop: "12px", padding: "12px", borderRadius: "12px", border: "1px solid #334155", background: "#020617", color: "#e2e8f0", fontSize: "13px", boxSizing: "border-box" }}
          >
            <div style={{ fontWeight: 700, color: "#bae6fd", marginBottom: 8 }}>🚚 Frete de venda — cotação oficial do Mercado Livre</div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <label>
                Conta:{" "}
                <select data-paiia-frete-conta value={contaFreteId} onChange={(e) => setContaAnuncioML(e.target.value)} disabled={!contasConectadasNA.length} style={{ ...campoPrecificacaoAppia, display: "inline-block", width: "auto", padding: "4px 8px", marginTop: 0 }}>
                  {!contasConectadasNA.length && <option value="">nenhuma conta conectada (Contas Marketplace)</option>}
                  {contasConectadasNA.map((c) => (
                    <option key={c.ml_user_id} value={String(c.ml_user_id)}>{c.nome || c.nickname || c.ml_user_id} (ID {c.ml_user_id}){c.ativa ? " · ativa" : ""}</option>
                  ))}
                </select>
              </label>
              <span data-paiia-frete-medida>Embalagem: <b>{medidaFreteNA ? textoMedida(medidaFreteNA) : "⚠ informe peso e as 3 medidas em Dados técnicos"}</b></span>
              <label>
                Modalidade:{" "}
                <select data-paiia-frete-modalidade value={modalidadeFreteML} onChange={(e) => setModalidadeFreteML(e.target.value)} disabled={!modalidadesFrete.lista.length} style={{ ...campoPrecificacaoAppia, display: "inline-block", width: "auto", padding: "4px 8px", marginTop: 0 }}>
                  {!modalidadesFrete.lista.length && <option value="">{modalidadesFrete.carregando ? "lendo..." : "—"}</option>}
                  {modalidadesFrete.lista.map((m) => (
                    <option key={m.tipo} value={m.tipo}>{ROTULO_MODALIDADE_FRETE[m.tipo] || m.tipo}{m.padrao ? " (padrão da conta)" : ""}</option>
                  ))}
                </select>
              </label>
            </div>
            {modalidadesFrete.erro && <p style={{ color: "#fca5a5", fontSize: 12, margin: "6px 0 0" }}>⚠ Modalidades da conta: {modalidadesFrete.erro}</p>}
            <div data-paiia-ml-frete-resumo data-paiia-ml-frete-estado={estadoML} style={{ marginTop: 8, fontSize: 14 }}>
              {recalculando ? (
                <span>⏳ Consultando o frete no Mercado Livre...</span>
              ) : estadoML === "erro" ? (
                <span data-paiia-frete-erro style={{ color: "#fca5a5" }}>⚠ A cotação do Mercado Livre falhou: {cotacaoFrete.erro} Nenhum frete foi considerado e os preços não foram calculados.</span>
              ) : falta.length || !(baseFreteNA.custo > 0) ? (
                <span style={{ color: "#fde68a" }}>Para cotar falta: {[...falta, ...(baseFreteNA.custo > 0 ? [] : ["custo da mercadoria"])].join(", ")}.</span>
              ) : fr && !fr.estimativa ? (
                <span>
                  Frete de venda (pago por você): <b data-paiia-frete-pago>{reaisFrete(fr.valor)}</b>
                  {fr.faixa ? ` · faixa ${fr.faixa}` : ""}
                  {registroFreteML?.final ? " · preço final" : " · opção Recomendado"}
                  <br />
                  {/* (20/10) Peso INFORMADO (embalagem) x peso COBRADO pelo Mercado Livre (billable_weight da resposta) */}
                  <span style={{ fontSize: 13 }}>
                    Peso informado da embalagem: <b data-paiia-frete-peso-informado>{registroFreteML?.pesos?.informado_g ?? "—"} g</b>
                    {registroFreteML?.pesos?.cubico_g ? <span style={{ color: "#94a3b8" }}> (peso cúbico {registroFreteML.pesos.cubico_g} g)</span> : null}
                    {" · "}Peso cobrado pelo Mercado Livre: <b data-paiia-frete-peso-ml>{fr.peso ? `${fr.peso} g` : "—"}</b>
                  </span>
                  <br />
                  {fr.peso && registroFreteML?.pesos?.informado_g && fr.peso !== registroFreteML.pesos.informado_g ? (
                    <span data-paiia-frete-peso-diferente style={{ display: "block", color: "#fde68a", fontSize: 12 }}>
                      ℹ O Mercado Livre cobrou {fr.peso} g (peso informado {registroFreteML.pesos.informado_g} g): o ML usa o maior entre o peso real e o cúbico, com o arredondamento dele. Vale o peso cobrado.
                    </span>
                  ) : null}
                  <span style={{ color: "#94a3b8", fontSize: 12 }}>
                    Origem: <b data-paiia-frete-origem>Mercado Livre — cotação oficial da conta {registroFreteML.conta}</b> · tipo <b data-paiia-frete-tipo-cotado>{registroFreteML.tipoAnuncio === "premium" ? "Premium" : "Clássico"}</b>
                    {fr.cotadoEm ? <> · resposta do ML em <b data-paiia-frete-horario>{new Date(fr.cotadoEm).toLocaleString("pt-BR")}</b></> : ""}
                  </span>
                  {situacaoFreteNA.estado === "ok" || aguardandoPreco ? <span style={{ color: "#86efac" }}> ✔ cotação válida</span> : null}
                  {aguardandoPreco ? <span style={{ color: "#fde68a" }}> · escolha o preço abaixo</span> : null}
                </span>
              ) : (
                <span>Sem cotação ainda.</span>
              )}
            </div>
            {registroFreteML?.cotacoes?.length && !recalculando ? (
              <details data-paiia-frete-cotacoes style={{ marginTop: 6, fontSize: 12, color: "#cbd5e1" }}>
                <summary style={{ cursor: "pointer", color: "#94a3b8" }}>🔎 Conferir as cotações oficiais usadas ({registroFreteML.cotacoes.length})</summary>
                {registroFreteML.cotacoes.map((q) => (
                  <div key={q.consulta.caminho} data-paiia-frete-cotacao style={{ borderTop: "1px solid #1e293b", padding: "6px 0" }}>
                    <b>{q.usos.join(", ")}</b>: preço consultado <b>{reaisFrete(q.consulta.item_price)}</b> · frete <b>{reaisFrete(q.custo_vendedor)}</b>
                    {q.frete_cheio ? ` (cheio ${reaisFrete(q.frete_cheio)}, desconto ${q.desconto_pct}%)` : ""} · peso cobrado <b>{q.peso_cobrado_g} g</b>
                    <br />
                    Medidas/peso enviados: <b>{q.consulta.dimensoes}</b> · modalidade <b>{ROTULO_MODALIDADE_FRETE[q.consulta.logistic_type] || q.consulta.logistic_type}</b> ({q.consulta.logistic_type}) · {q.consulta.listing_type_id === "gold_pro" ? "Premium" : "Clássico"} · conta {q.consulta.conta}
                    {q.status ? ` · HTTP ${q.status}` : ""}
                    <br />
                    Resposta do ML: {q.cotado_em ? new Date(q.cotado_em).toLocaleString("pt-BR") : "—"}
                    {q.reaproveitada ? <span data-paiia-frete-reaproveitada style={{ color: "#fde68a" }}> · reaproveitada da memória desta tela (horário original)</span> : null}
                  </div>
                ))}
              </details>
            ) : null}
            {situacaoFreteNA.estado === "desatualizado" && registroFreteML && !recalculando && !aguardandoPreco && (
              <div data-paiia-frete-desatualizado style={{ color: "#fecaca", marginTop: 6, fontSize: 12 }}>
                ⚠ Cotação desatualizada: {situacaoFreteNA.motivos.join("; ")}.
              </div>
            )}
            <button type="button" data-paiia-cotar-frete onClick={cotarFreteEPrecos} disabled={cotacaoFrete.ocupado} style={{ ...botaoFreteML, marginTop: 8, padding: "5px 10px", fontSize: 12 }}>
              {cotacaoFrete.ocupado ? "⏳ Consultando..." : estadoML === "erro" ? "🔄 Tentar novamente" : "🔄 Consultar frete de novo"}
            </button>
          </div>
        )}
      </>
    );
  })()}


  <div
    style={{
      width: "100%",
      marginTop: "14px",
    }}
  >
    <button
      type="button"
      onClick={() =>
        setMostrarCustoDetalhado(
          (atual) => !atual
        )
      }
      style={{
        width: "100%",
        padding: "13px 16px",
        borderRadius: "11px",
        border: "1px solid #38bdf8",
        background:
          mostrarCustoDetalhado
            ? "linear-gradient(135deg,#0c4a6e,#0f172a)"
            : "#082f49",
        color: "#e0f2fe",
        fontWeight: "800",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      🧮{" "}
      {mostrarCustoDetalhado
        ? "Fechar cálculo detalhado"
        : "Quero calcular meu custo detalhado"}
    </button>
  </div>

  {mostrarCustoDetalhado && (
    <div
      style={{
        width: "100%",
        marginTop: "12px",
        padding: "16px",
        borderRadius: "14px",
        border: "1px solid #0ea5e9",
        background:
          "linear-gradient(135deg,#020617,#082f49)",
      }}
    >
      <div
        style={{
          color: "#67e8f9",
          fontSize: "15px",
          fontWeight: "800",
          marginBottom: "5px",
        }}
      >
        🧾 Custo Real da Peça
      </div>

      <div
        style={{
          color: "#94a3b8",
          fontSize: "12px",
          lineHeight: 1.55,
          marginBottom: "14px",
        }}
      >
        Preencha somente o que souber. A PAIIA transforma
        suas despesas mensais em custo por venda automaticamente.
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit,minmax(180px,1fr))",
          gap: "10px",
        }}
      >
        <label style={{ color: "#cbd5e1", fontSize: "12px" }}>
          Custo de compra da peça
          <input
            value={custoCompraDetalhado}
            onChange={(e) =>
              setCustoCompraDetalhado(
                e.target.value
              )
            }
            placeholder="Ex.: 100,00"
            style={campoPrecificacaoAppia}
          />
        </label>

        <label style={{ color: "#cbd5e1", fontSize: "12px" }}>
          Frete de compra por peça
          <input
            value={freteCompraDetalhado}
            onChange={(e) =>
              setFreteCompraDetalhado(
                e.target.value
              )
            }
            placeholder="Ex.: 5,00"
            style={campoPrecificacaoAppia}
                   />
        </label>

        

        <label style={{ color: "#cbd5e1", fontSize: "12px" }}>
          Embalagem por peça
          <input
            value={embalagemDetalhada}
            onChange={(e) =>
              setEmbalagemDetalhada(
                e.target.value
              )
            }
            placeholder="Ex.: 2,00"
            style={campoPrecificacaoAppia}
          />
        </label>

        <label style={{ color: "#cbd5e1", fontSize: "12px" }}>
          Despesas fixas mensais
          <input
            value={despesasFixasMensais}
            onChange={(e) =>
              setDespesasFixasMensais(
                e.target.value
              )
            }
            placeholder="Ex.: 10.000,00"
            style={campoPrecificacaoAppia}
          />
        </label>

        <label style={{ color: "#cbd5e1", fontSize: "12px" }}>
          Vendas médias por mês
          <input
            value={vendasMediasMes}
            onChange={(e) =>
              setVendasMediasMes(
                e.target.value
              )
            }
            placeholder="Ex.: 1000"
            style={campoPrecificacaoAppia}
          />
        </label>

        <label style={{ color: "#cbd5e1", fontSize: "12px" }}>
          Outros custos por peça
          <input
            value={outrosCustosDetalhados}
            onChange={(e) =>
              setOutrosCustosDetalhados(
                e.target.value
              )
            }
            placeholder="Ex.: 1,50"
            style={campoPrecificacaoAppia}
          />
        </label>
      </div>

      <div
        style={{
          marginTop: "14px",
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit,minmax(180px,1fr))",
          gap: "10px",
        }}
      >
        <div style={resultadoPrecoAppia}>
          <span>Despesa fixa por venda</span>
          <strong>
            {formatarPrecoAppia(
              despesaFixaPorVenda
            )}
          </strong>
          <small>
            despesas mensais ÷ vendas/mês
          </small>
        </div>

        <div
          style={{
            ...resultadoPrecoAppia,
            border: "1px solid #22c55e",
            background:
              "linear-gradient(135deg,#052e16,#0f172a)",
          }}
        >
          <span>Custo real por peça</span>
          <strong
            style={{
              color: "#86efac",
            }}
          >
            {formatarPrecoAppia(
              custoRealDetalhado
            )}
          </strong>
          <small>
            compra + frete + embalagem + fixas + outros
          </small>
        </div>
      </div>

      <div
        style={{
          marginTop: "12px",
          padding: "11px 12px",
          borderRadius: "10px",
          border: "1px solid #334155",
          background: "#020617",
          color: "#cbd5e1",
          fontSize: "12px",
          lineHeight: 1.55,
        }}
      >
        💡 Exemplo: se a empresa tem R$ 10.000 de despesas
        fixas e vende 1.000 peças por mês, a PAIIA adiciona
        R$ 10,00 de custo fixo a cada venda.
      </div>

      <button
        type="button"
        onClick={
          usarCustoDetalhadoNaPrecificacao
        }
        style={{
          width: "100%",
          marginTop: "12px",
          padding: "13px 16px",
          borderRadius: "10px",
          border: "none",
          background:
            "linear-gradient(135deg,#15803d,#22c55e)",
          color: "#ffffff",
          fontWeight: "800",
          cursor: "pointer",
        }}
      >
        ✅ Usar este custo na precificação
      </button>
    </div>
  )}

  {(() => {
    const ml = canalVenda === "mercado_livre";
    const base = basePrecificacaoAtual();
    const freteManual = numeroPrecificacao(fretePrecificacao);
    const final = registroFreteML?.final || null;
    const recalculando = ml && (cotacaoFrete.ocupado || precisaRecalcularNA);
    const resultado = !(precoAtualNumero > 0) || !(base.custo > 0)
      ? null
      : ml
        ? final && registroFreteML?.origem === "mercado_livre" && !recalculando && Math.round(final.preco * 100) === Math.round(precoAtualNumero * 100) && Math.round(Number(final.preco_cotado) * 100) === Math.round(precoAtualNumero * 100)
          ? { ...final, frete: final.custo_vendedor }
          : null
        : resultadoDoPreco({ preco: precoAtualNumero, frete: freteManual, base });
    const precos = [[10, "conservador", "🔶 Conservador", "#f59e0b", precoMargem10], [15, "recomendado", "🟢 Recomendado", "#22c55e", precoMargem15], [20, "ideal", "🔵 Ideal", "#38bdf8", precoMargem20]];
    const linha = (nome, valor, sinal = "") => (
      <>
        <span>{nome}</span>
        <strong>{sinal}{reaisFrete(valor)}</strong>
      </>
    );
    return (
      <>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
            gap: "10px",
            width: "100%",
            marginTop: "14px",
          }}
        >
          {precos.map(([margem, chave, nome, cor, valor]) => {
            // (20/10) frete oficial e peso cobrado usados NESTA opção
            const mg = ml && registroFreteML?.origem === "mercado_livre" && !recalculando ? registroFreteML?.margens?.[chave] : null;
            return (
              <button key={chave} type="button" data-paiia-ml-margem={chave} disabled={!(valor > 0) || recalculando} onClick={() => aplicarPrecoSugerido(valor)} style={{ ...botaoPrecoSugestao, border: `1px solid ${cor}`, opacity: valor > 0 && !recalculando ? 1 : 0.55 }}>
                <span>{nome}</span>
                <strong>{valor > 0 ? formatarPrecoAppia(valor) : "—"}</strong>
                <small>{margem}% líquido</small>
                {mg ? (
                  <small data-paiia-ml-margem-frete={chave} style={{ color: "#94a3b8" }}>
                    frete ML {reaisFrete(mg.frete)} · peso cobrado {mg.peso_cobrado_g} g
                    {mg.exato === false && mg.preco_cotado ? ` · cotado em ${reaisFrete(mg.preco_cotado)} (mesma faixa)` : ""}
                  </small>
                ) : null}
              </button>
            );
          })}
        </div>
        {ml && !(precoMargem15 > 0) && !recalculando && (
          <p style={{ color: "#94a3b8", fontSize: 12, margin: "6px 0 0", width: "100%" }}>Os três preços aparecem quando houver cotação oficial do frete (Mercado Livre).</p>
        )}

        <div style={{ width: "100%", marginTop: "14px" }}>
          <label style={{ display: "block", color: "#cbd5e1", fontSize: "12px", fontWeight: "bold" }}>
            Preço final do anúncio
            <input data-paiia-ml-preco value={preco} onChange={(e) => alterarPrecoFinal(e.target.value)} placeholder="0,00" style={{ ...campoPrecificacaoAppia, marginTop: "6px", fontSize: "18px", fontWeight: "bold", color: "#86efac" }} />
          </label>
        </div>

        {resultado && (
          <div data-paiia-ml-resultado style={{ marginTop: "14px", width: "100%", padding: "14px", borderRadius: "12px", border: "1px solid #334155", background: "#020617", boxSizing: "border-box" }}>
            <div style={{ color: resultado.resultado >= 0 ? "#86efac" : "#fca5a5", fontWeight: "bold", fontSize: "15px", marginBottom: 10 }}>
              Resultado: {reaisFrete(resultado.resultado)} por venda · margem líquida <span data-paiia-ml-margem-final>{String(resultado.margemPct).replace(".", ",")}%</span>
            </div>
            {ml && resultado.exato ? (
              <div data-paiia-ml-final-exato style={{ color: "#86efac", fontSize: 12, marginBottom: 8 }}>
                ✔ Preço final cotado no valor exato ({reaisFrete(resultado.preco_cotado)}) · frete ML {reaisFrete(resultado.custo_vendedor)} · peso cobrado {resultado.peso_cobrado_g} g
                {resultado.cotado_em ? ` · resposta do ML em ${new Date(resultado.cotado_em).toLocaleString("pt-BR")}` : ""}
              </div>
            ) : null}
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "6px 20px", color: "#cbd5e1", fontSize: "13px" }}>
              {linha("💰 Preço de venda", resultado.preco)}
              {linha("📦 Custo da mercadoria", numeroPrecificacao(custo), "− ")}
              {linha("🚛 Frete de compra", numeroPrecificacao(freteCompraPrecificacao), "− ")}
              {linha("📦 Embalagem", base.despesas, "− ")}
              {linha(ml ? "🚚 Frete de venda (Mercado Livre)" : "🚚 Frete de venda", resultado.frete, "− ")}
              {linha(`🏷️ Comissão (${String(base.comissao).replace(".", ",")}%)`, resultado.comissaoValor, "− ")}
              {linha(`🧾 Impostos (${String(base.imposto).replace(".", ",")}%)`, resultado.impostoValor, "− ")}
            </div>
          </div>
        )}
        {ml && precoAtualNumero > 0 && !resultado && !recalculando && (
          <p style={{ color: "#fde68a", fontSize: 12, margin: "8px 0 0", width: "100%" }}>O resultado deste preço aparece quando a cotação do frete estiver válida.</p>
        )}
        {ml && registroFreteML?.sugestao && !recalculando && (
          <div data-paiia-frete-sugestao style={{ marginTop: 8, fontSize: 13, width: "100%", color: registroFreteML.sugestao.vantajosa ? "#fde68a" : "#94a3b8" }}>
            💡 Perto do limite de {reaisFrete(registroFreteML.sugestao.limite)}: {registroFreteML.sugestao.texto}
            {registroFreteML.sugestao.vantajosa && (
              <button type="button" data-paiia-usar-sugestao onClick={() => aplicarPrecoSugerido(registroFreteML.sugestao.alternativa.preco)} style={{ ...botaoFreteML, marginLeft: 8, padding: "4px 10px" }}>
                Usar {reaisFrete(registroFreteML.sugestao.alternativa.preco)}
              </button>
            )}
          </div>
        )}
      </>
    );
  })()}

  <div
    style={{
      width: "100%",
      marginTop: "14px",
      padding: "18px",
      borderRadius: "14px",
      border: "1px solid #2563eb",
      background:
        "linear-gradient(135deg,#0f172a,#172554)",
      boxSizing: "border-box",
    }}
  >
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "14px",
        flexWrap: "wrap",
        marginBottom: "14px",
      }}
    >
      <div>
        <strong
          style={{
            color: "#67e8f9",
            fontSize: "17px",
          }}
        >
          🤖 Paizinho — Inteligência de Mercado
        </strong>

        <div
          style={{
            color: "#bfdbfe",
            fontSize: "12px",
            marginTop: "5px",
          }}
        >
          Pesquisa rápida no Mercado Livre e Shopee.
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          flexWrap: "wrap",
          justifyContent: "flex-end",
          maxWidth: "100%",
        }}
      >
        
             </div>
    </div>
        
    
    <div
      style={{
        marginTop: "12px",
        display: "grid",
        gridTemplateColumns:
          "repeat(auto-fit,minmax(220px,1fr))",
        gap: "10px",
      }}
    >
      <button
        type="button"
        onClick={() => {
          const termoManual = [
            codigo || oem || "",
            titulo ||
              pecaEncontrada?.peca ||
              "",
          ]
            .filter(Boolean)
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();

          const url = montarUrlPesquisaMercadoLivre(
  termoManual
);

          window.open(
            url,
            "_blank",
            "noopener,noreferrer"
          );
        }}
        style={{
          padding: "12px 16px",
          borderRadius: "10px",
          border:
            "1px solid #facc15",
          background: "#422006",
          color: "#fde68a",
          fontWeight: "bold",
          cursor: "pointer",
        }}
      >
        🟡 Abrir Mercado Livre
      </button>

      <button
        type="button"
        onClick={() => {
          const termoManual = [
            codigo || oem || "",
            titulo ||
              pecaEncontrada?.peca ||
              "",
          ]
            .filter(Boolean)
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();

          const url = montarUrlPesquisaShopee(
  termoManual
);

          window.open(
            url,
            "_blank",
            "noopener,noreferrer"
          );
        }}
        style={{
          padding: "12px 16px",
          borderRadius: "10px",
        border:
            "1px solid #fb923c",
          background: "#431407",
          color: "#fed7aa",
          fontWeight: "bold",
          cursor: "pointer",
        }}
      >
        🟠 Abrir Shopee
      </button>
    </div>

    
  </div>


</div>

            <div style={centralInteligenciaCard}>
              <span style={centralInteligenciaRotulo}>
                ⭐ Qualidade do Anúncio
              </span>

              <strong style={centralInteligenciaValor}>
                {pontuacaoAnuncio?.pontos || 0} / 100
              </strong>

              <span style={centralInteligenciaTexto}>
                {titulo && descricao
                  ? "Título e descrição preenchidos."
                  : "Complete título e descrição para melhorar a pontuação."}
              </span>
            </div>

            <div style={centralInteligenciaCard}>
              <span style={centralInteligenciaRotulo}>
                📤 Publicação
              </span>

              <strong style={centralInteligenciaValor}>
                {fotosUnicas.length > 0
                  ? `${fotosUnicas.length} foto(s)`
                  : "Sem fotos"}
              </strong>

              <span style={centralInteligenciaTexto}>
                {clipAnuncio
                  ? "Clip disponível. Banner e clip continuam opcionais."
                  : "Foto é obrigatória; banner e clip são opcionais."}
              </span>
            </div>
          </div>

          <div style={parecerEspecialistaStyle}>
            <div style={parecerEspecialistaIcone}>
              {parecerIA?.emoji || "🤖"}
            </div>

            <div style={{ flex: 1 }}>
              <h4 style={parecerEspecialistaTitulo}>
                {parecerIA?.titulo ||
                  "Analisando anúncio..."}
              </h4>

              <p style={parecerEspecialistaTexto}>
                {parecerIA?.texto ||
                  "O PAIIA está analisando o anúncio."}
              </p>
            </div>
          </div>

        </section>
        
        
        {projetoAtual && (
          <section style={projetoAtualStyle}>
            <div style={projetoAtualCabecalho}>
              <div>
                <h3
                  style={{
                    color: "#67e8f9",
                    margin: 0,
                    fontSize: "18px",
                  }}
                >
                  📦 Projeto Atual
                </h3>

                <p
                  style={{
                    color: "#94a3b8",
                    margin: "5px 0 0",
                    fontSize: "12px",
                  }}
                >
                  Todo o conteúdo criado será
                  relacionado a este projeto.
                </p>
              </div>

              <span
                style={{
                  ...projetoStatusStyle,
                  color:
                    projetoAtual.status ===
                    "Concluído"
                      ? "#bbf7d0"
                      : projetoAtual.status ===
                          "Pausado"
                        ? "#fde68a"
                        : "#bae6fd",
                  borderColor:
                    projetoAtual.status ===
                    "Concluído"
                      ? "#22c55e"
                      : projetoAtual.status ===
                          "Pausado"
                        ? "#f59e0b"
                        : "#38bdf8",
                  background:
                    projetoAtual.status ===
                    "Concluído"
                      ? "#052e16"
                      : projetoAtual.status ===
                          "Pausado"
                        ? "#422006"
                        : "#082f49",
                }}
              >
                {projetoAtual.status ||
                  "Em andamento"}
              </span>
            </div>

            <div style={projetoAtualGrade}>
              <div style={projetoAtualItem}>
                <span>Nome</span>
                <strong>
                  {projetoAtual.nome ||
                    projetoAtual.titulo ||
                    "Projeto sem nome"}
                </strong>
              </div>

              <div style={projetoAtualItem}>
                <span>Código</span>
                <strong>
                  {projetoAtual.codigo ||
                    projetoAtual.oem ||
                    codigo ||
                    oem ||
                    "Não informado"}
                </strong>
              </div>

              <div style={projetoAtualItem}>
                <span>ID</span>
                <strong>
                  {projetoAtual.id ||
                    "Projeto local"}
                </strong>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                localStorage.removeItem(
                  "projetoAppiaAtual"
                );

                setProjetoAtual(null);
              }}
              style={botaoFecharProjeto}
            >
              ✕ Fechar Projeto
            </button>
          </section>
        )}

        <div style={barraProgressoBox}>
          <div style={barraTopo}>
            <span>Progresso do anúncio</span>
            <strong>{progressoAnuncio}%</strong>
          </div>

          <div style={barraFundo}>
            <div
              style={{
                ...barraPreenchida,
                width: `${progressoAnuncio}%`,
              }}
            />
          </div>

          <div style={etapasLinha}>
            <span>
              {codigo || oem ? "✅" : "○"} Código
            </span>

            <span>
              {titulo ? "✅" : "○"} Título
            </span>

            <span>
              {descricao ? "✅" : "○"} Descrição
            </span>

            <span>
              {fotosUnicas.length > 0 ? "✅" : "○"}{" "}
              Fotos
            </span>
          </div>
        </div>

{pesquisaPaizinho && (
  <PainelPesquisaPaizinho
    pesquisa={pesquisaPaizinho}
    onPesquisarNovamente={
      !PESQUISA_EXTERNA_CRIAR_ANUNCIO_ATIVA
        ? undefined
        : pesquisaPaizinho?.status ===
        "interno_sem_aplicacao"
        ? processando
          ? undefined
          : async () => {
              // Pesquisa externa pedida pelo usuário (consulta paga).
              setProcessando(true);
              try {
                await complementarComPesquisaPaizinho(
                  pesquisaPaizinho.codigoPesquisado ||
                    codigo,
                  pesquisaPaizinho.contextoComplemento ||
                    {}
                );
              } finally {
                setProcessando(false);
                setEtapaProcessamento("");
                setProgressoProcessamento(0);
              }
            }
        : processando ||
      pesquisaPaizinho?.origemFallback ===
        "base_incompleta"
        ? undefined
        : () =>
            executarPesquisaPaizinho(
              pesquisaPaizinho
                ?.codigoPesquisado ||
                codigo,
              { forcar: true }
            )
    }
  />
)}

{pecaEncontrada && (() => {
  const baseMestreAtual =
    diagnostico?.baseMestre ||
    pecaEncontrada?.baseMestre ||
    {};

  const fontesAplicacoes = [
    ...(
      Array.isArray(
        pecaEncontrada?.aplicacoes
      )
        ? pecaEncontrada.aplicacoes
        : []
    ),

    ...(
      Array.isArray(
        baseMestreAtual?.aplicacoes
      )
        ? baseMestreAtual.aplicacoes
        : []
    ),
  ];

  const aplicacoesNormalizadas =
    fontesAplicacoes
      .map((item) => {
        const montadora =
          String(
            item?.montadora ||
            item?.marca ||
            ""
          ).trim();

        const modelo =
          String(
            item?.modelo ||
            item?.veiculo ||
            ""
          ).trim();

        const motor =
          String(
            item?.motor ||
            item?.motorizacao ||
            ""
          ).trim();

        const anoInicio =
          item?.ano_inicio ??
          item?.anoInicio ??
          null;

        const anoFim =
          item?.ano_fim ??
          item?.anoFim ??
          null;

        const observacao =
          String(
            item?.observacao ||
            item?.obs ||
            ""
          ).trim();

        const origem =
          String(
            item?.origem_catalogo ||
            item?.origem ||
            ""
          ).trim();

        return {
          ...item,

          montadora,
          modelo,
          motor,

          // Mantemos os dois padrões.
          // Alguns módulos antigos usam snake_case
          // e outros usam camelCase.
          ano_inicio:
            anoInicio,

          ano_fim:
            anoFim,

          anoInicio,
          anoFim,

          observacao,
          origem,

          origem_catalogo:
            item?.origem_catalogo ||
            origem,
        };
      })
      .filter(
        (item) =>
          item.montadora ||
          item.modelo ||
          item.motor
      )
      .filter(
        (
          item,
          index,
          lista
        ) => {
          const chave =
            [
              item.montadora,
              item.modelo,
              item.motor,
              item.ano_inicio,
              item.ano_fim,
            ]
              .map(
                (valor) =>
                  String(
                    valor ?? ""
                  )
                    .trim()
                    .toLowerCase()
              )
              .join("|");

          return (
            index ===
            lista.findIndex(
              (outro) => {
                const chaveOutro =
                  [
                    outro.montadora,
                    outro.modelo,
                    outro.motor,
                    outro.ano_inicio,
                    outro.ano_fim,
                  ]
                    .map(
                      (valor) =>
                        String(
                          valor ?? ""
                        )
                          .trim()
                          .toLowerCase()
                    )
                    .join("|");

                return (
                  chaveOutro ===
                  chave
                );
              }
            )
          );
        }
      );

  const pecaPainel = {
    ...pecaEncontrada,

    aplicacoes:
      aplicacoesNormalizadas,

    baseMestre: {
      ...baseMestreAtual,

      aplicacoes:
        aplicacoesNormalizadas,

      totalRegistros:
        aplicacoesNormalizadas
          .length,
    },
  };

  const diagnosticoPainel = {
    ...(
      diagnostico ||
      {}
    ),

    totalAplicacoes:
      aplicacoesNormalizadas
        .length,

    baseMestre: {
      ...baseMestreAtual,

      aplicacoes:
        aplicacoesNormalizadas,

      totalRegistros:
        aplicacoesNormalizadas
          .length,
    },
  };

  return (
    <PainelCatalogo
      pecaEncontrada={
        pecaPainel
      }

      diagnostico={
        diagnosticoPainel
      }

      auditoria={
        auditoria
      }

      mostrarAplicacoes={
        mostrarAplicacoes
      }

      setMostrarAplicacoes={
        setMostrarAplicacoes
      }
    />
  );
})()}
        {diagnostico && (
          <section
  id="secao-diagnostico"
  style={secaoStyle}
>
            <h3 style={tituloSecao}>
              🧠 Diagnóstico Técnico
            </h3>

            {diagnostico?.fonteProvisoria && (
              <div
                style={{
                  margin: "12px 0 16px",
                  padding: "12px 14px",
                  borderRadius: "12px",
                  border: "1px solid #f59e0b",
                  background: "#451a03",
                  color: "#fde68a",
                  fontSize: "14px",
                  lineHeight: 1.5,
                }}
              >
                ⚠️ Mercado Livre — dados provisórios. Auditoria: REVISAR.
                CONFIRMADO = coincidiu em mais de um anúncio.
                ENCONTRADO NO MERCADO LIVRE — A CONFIRMAR = um anúncio
                ou sem concordância. Não grave no catálogo.
              </div>
            )}

            <div style={gradeDiagnostico}>
              <div>
                📌 Código:{" "}
                <b>
                  {diagnostico.codigoPrincipal ||
                    codigo}
                </b>
              </div>

              <div>
                🏭 Fabricante:{" "}
                <b>
                  {diagnostico.fabricante || "-"}
                </b>
              </div>

              <div>
                📄 Ocorrências:{" "}
                <b>
                  {diagnostico.totalAplicacoes || 0}
                </b>
              </div>

              <div>
                📚 Fonte:{" "}
                <b>
                  {diagnostico.arquivoCatalogo || "-"}
                </b>
              </div>

              <div>
                📖 Página:{" "}
                <b>
                  {diagnostico.paginaCatalogo || "-"}
                </b>
              </div>
            </div>
          </section>
        )}

        {auditoria && (
          <section style={secaoStyle}>
            <h3 style={tituloSecao}>
              🔎 Auditoria Técnica
            </h3>

            <p style={{ color: "#e2e8f0" }}>
              Status:{" "}
              <b
                style={{
                  color: auditoria.aprovado
                    ? "#22c55e"
                    : "#f59e0b",
                }}
              >
                {auditoria.aprovado
                  ? "APROVADO"
                  : "REVISAR"}
              </b>
            </p>

            {(auditoria.problemas || []).map(
              (problema) => (
                <div
                  key={problema}
                  style={{
                    color: "#fbbf24",
                    marginTop: "6px",
                  }}
                >
                  ⚠ {problema}
                </div>
              )
            )}
          </section>
        )}

        <div
          style={{
            marginTop: "16px",
            maxHeight: "185px",
            overflowY: "auto",
            borderRadius: "16px",
          }}
        >
          <AssistenteAnuncio
            titulo={titulo}
            descricao={descricao}
            fotosAnuncio={fotosUnicas}
            diagnostico={diagnostico}
            auditoria={auditoria}
            pecaEncontrada={pecaEncontrada}
          />
        </div>


        <section id="na-etapa-finalizar" style={secaoStyle}>
          <BotaoVoltarEtapaNA alvo="na-etapa-preco-frete">← Voltar ao Preço e frete</BotaoVoltarEtapaNA>
          <h3 style={tituloSecao}>
            ⑤ 📋 Finalizar
          </h3>

          <div style={botoesFinal}>
            <button
  type="button"
  onClick={continuarParaPublicacao}
  style={{
    ...botaoPublicar,
    opacity: 1,
    cursor: "pointer",
  }}
>
  ➡️ Continuar para Publicação
</button>
          </div>
        </section>

      </div>
    </div>
  );
}

const parecerEspecialistaStyle = {
  display: "flex",
  alignItems: "center",
  gap: "14px",
  marginTop: "16px",
  padding: "16px",
  borderRadius: "14px",
  border: "1px solid #2563eb",
  background:
    "linear-gradient(135deg,#0f172a,#082f49)",
};

const parecerEspecialistaIcone = {
  fontSize: "42px",
  lineHeight: 1,
};

const parecerEspecialistaTitulo = {
  margin: 0,
  color: "#67e8f9",
  fontSize: "16px",
};

const parecerEspecialistaTexto = {
  margin: "7px 0 0",
  color: "#e2e8f0",
  fontSize: "13px",
  lineHeight: 1.55,
};

const copilotoRecomendacoesBox = {
  marginTop: "16px",
  paddingTop: "16px",
  borderTop: "1px solid #1e40af",
};

const copilotoRecomendacoesCabecalho = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  flexWrap: "wrap",
  marginBottom: "12px",
};

const copilotoRecomendacoesTitulo = {
  margin: 0,
  color: "#ffffff",
  fontSize: "16px",
};

const copilotoRecomendacoesSubtitulo = {
  margin: "5px 0 0",
  color: "#94a3b8",
  fontSize: "12px",
  lineHeight: 1.45,
};

const copilotoRecomendacoesContador = {
  padding: "6px 10px",
  borderRadius: "999px",
  border: "1px solid #2563eb",
  background: "#172554",
  color: "#bfdbfe",
  fontSize: "11px",
  fontWeight: "bold",
};

const copilotoRecomendacoesLista = {
  display: "grid",
  gap: "9px",
};

const copilotoRecomendacaoItem = {
  display: "flex",
  alignItems: "center",
  gap: "11px",
  padding: "12px 13px",
  borderRadius: "12px",
  border: "1px solid #334155",
  background: "#020617",
};

const copilotoRecomendacaoIcone = {
  fontSize: "20px",
};

const copilotoRecomendacaoTexto = {
  color: "#e2e8f0",
  fontSize: "13px",
  fontWeight: "bold",
  lineHeight: 1.45,
};

const copilotoRecomendacaoPrioridade = {
  marginTop: "4px",
  color: "#64748b",
  fontSize: "10px",
  fontWeight: "bold",
};

const centralInteligenciaAnuncioStyle = {
  marginTop: "18px",
  marginBottom: "18px",
  padding: "18px",
  borderRadius: "18px",
  border: "1px solid #0ea5e9",
  background:
    "linear-gradient(135deg,#082f49,#0f172a)",
  boxShadow:
    "0 16px 34px rgba(0,0,0,.22)",
  textAlign: "left",
};

const centralInteligenciaCabecalho = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "14px",
  flexWrap: "wrap",
  marginBottom: "14px",
};

const centralInteligenciaTitulo = {
  margin: 0,
  color: "#67e8f9",
  fontSize: "20px",
};

const centralInteligenciaSubtitulo = {
  margin: "6px 0 0",
  color: "#cbd5e1",
  fontSize: "13px",
  lineHeight: 1.5,
};

const centralInteligenciaStatus = {
  padding: "8px 12px",
  borderRadius: "999px",
  border: "1px solid",
  fontSize: "12px",
  fontWeight: "bold",
};

const centralInteligenciaGrade = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(210px,1fr))",
  gap: "12px",
};

const centralInteligenciaCard = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  padding: "14px",
  minHeight: "145px",
  borderRadius: "14px",
  border: "1px solid #334155",
  background: "#020617",
};

const centralInteligenciaRotulo = {
  color: "#94a3b8",
  fontSize: "12px",
  fontWeight: "bold",
};

const centralInteligenciaValor = {
  color: "#ffffff",
  fontSize: "20px",
};

const centralInteligenciaTexto = {
  color: "#cbd5e1",
  fontSize: "12px",
  lineHeight: 1.45,
};

const centralInteligenciaBotao = {
  marginTop: "auto",
  padding: "9px 12px",
  borderRadius: "10px",
  border: "1px solid #22c55e",
  background:
    "linear-gradient(135deg,#15803d,#22c55e)",
  color: "#ffffff",
  fontWeight: "bold",
};

const projetoAtualStyle = {
  marginBottom: "18px",
  padding: "16px",
  borderRadius: "16px",
  border: "1px solid #2563eb",
  background:
    "linear-gradient(135deg,#0f172a,#172554)",
  boxShadow:
    "0 14px 32px rgba(0,0,0,.2)",
  textAlign: "left",
};

const projetoAtualCabecalho = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  flexWrap: "wrap",
};

const projetoStatusStyle = {
  padding: "7px 11px",
  borderRadius: "999px",
  border: "1px solid",
  fontSize: "11px",
  fontWeight: "bold",
};

const projetoAtualGrade = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(180px,1fr))",
  gap: "10px",
  marginTop: "14px",
};

const projetoAtualItem = {
  display: "flex",
  flexDirection: "column",
  gap: "5px",
  padding: "11px",
  borderRadius: "10px",
  background: "#020617",
  border: "1px solid #334155",
  color: "#e2e8f0",
  fontSize: "12px",
};

const botaoFecharProjeto = {
  marginTop: "12px",
  padding: "8px 12px",
  borderRadius: "9px",
  border: "1px solid #475569",
  background: "#0f172a",
  color: "#cbd5e1",
  cursor: "pointer",
  fontWeight: "bold",
  fontSize: "11px",
};

const tituloPagina = {
  color: "#67e8f9",
  fontSize: "34px",
  marginBottom: "8px",
  textAlign: "center",
};

const subtituloPagina = {
  color: "#94a3b8",
  marginBottom: "22px",
  fontSize: "15px",
  textAlign: "center",
};

const secaoStyle = {
  marginTop: "18px",
  padding: "18px",
  borderRadius: "16px",
  background: "#020617",
  border: "1px solid #1e293b",
};

const secaoEncontrada = {
  marginTop: "18px",
  padding: "16px",
  borderRadius: "16px",
  background: "#052e16",
  border: "1px solid #22c55e",
};

const tituloSecao = {
  color: "#67e8f9",
  marginTop: 0,
  marginBottom: "16px",
};

const barraProgressoBox = {
  background: "#020617",
  border: "1px solid #334155",
  borderRadius: "16px",
  padding: "16px",
  marginBottom: "18px",
};

const barraTopo = {
  display: "flex",
  justifyContent: "space-between",
  color: "#e2e8f0",
  marginBottom: "10px",
};

const barraFundo = {
  height: "12px",
  background: "#1e293b",
  borderRadius: "999px",
  overflow: "hidden",
};

const barraPreenchida = {
  height: "100%",
  background:
    "linear-gradient(135deg,#2563eb,#22d3ee)",
  borderRadius: "999px",
  transition: "0.3s",
};

const etapasLinha = {
  display: "flex",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: "8px",
  marginTop: "12px",
  color: "#cbd5e1",
  fontSize: "14px",
};

const resumoTopo = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  alignItems: "center",
  flexWrap: "wrap",
};

const aplicacoesBox = {
  marginTop: "14px",
  color: "#e2e8f0",
  background: "#064e3b",
  padding: "14px",
  borderRadius: "12px",
};

const gradeDiagnostico = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(180px,1fr))",
  gap: "12px",
  color: "#e2e8f0",
};

const botoesFinal = {
  display: "flex",
  justifyContent: "center",
  gap: "12px",
  flexWrap: "wrap",
};

const painelProducaoIA = {
  marginBottom: "18px",
  padding: "18px",
  borderRadius: "16px",
  boxShadow:
    "0 16px 36px rgba(0,0,0,.22)",
};

const cabecalhoProducaoIA = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  flexWrap: "wrap",
};

const seloProgressoProducao = {
  padding: "8px 12px",
  borderRadius: "999px",
  fontSize: "12px",
  fontWeight: "bold",
};

const listaProducaoIA = {
  display: "grid",
  gap: "9px",
  marginTop: "16px",
};

const itemProducaoIA = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  padding: "11px 12px",
  borderRadius: "10px",
  background: "rgba(2,6,23,.6)",
  color: "#e2e8f0",
  fontSize: "13px",
};

const gradeMidiasIA = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(240px,1fr))",
  gap: "14px",
};

const cardMidiaIA = {
  display: "flex",
  flexDirection: "column",
  minHeight: "260px",
  padding: "18px",
  borderRadius: "16px",
  border: "1px solid #334155",
  background:
    "linear-gradient(145deg,#0f172a,#020617)",
  boxShadow:
    "0 14px 32px rgba(0,0,0,.2)",
};

const iconeMidiaIA = {
  fontSize: "38px",
  marginBottom: "10px",
};

const tituloMidiaIA = {
  color: "#67e8f9",
  fontSize: "18px",
  margin: "0 0 9px 0",
};

const textoMidiaIA = {
  color: "#94a3b8",
  fontSize: "13px",
  lineHeight: 1.55,
  margin: "0 0 18px 0",
  flex: 1,
};

const botaoMidiaIA = {
  width: "100%",
  padding: "13px 16px",
  borderRadius: "11px",
  border: "1px solid #38bdf8",
  background:
    "linear-gradient(135deg,#1d4ed8,#0891b2)",
  color: "#ffffff",
  fontWeight: "bold",
  fontSize: "13px",
};

const botaoLaranja = {
  padding: "14px 24px",
  borderRadius: "12px",
  border: "none",
  background:
    "linear-gradient(135deg,#ea580c,#fb923c)",
  color: "#fff",
  fontWeight: "bold",
  cursor: "pointer",
  minWidth: "170px",
};

const botaoVerde = {
  padding: "14px 24px",
  borderRadius: "12px",
  border: "none",
  background: "#16a34a",
  color: "#fff",
  fontWeight: "bold",
  cursor: "pointer",
  minWidth: "170px",
};

const botaoCinza = {
  padding: "14px 24px",
  borderRadius: "12px",
  border: "none",
  background: "#475569",
  color: "#fff",
  fontWeight: "bold",
  cursor: "pointer",
  minWidth: "170px",
};

const botaoEscuro = {
  padding: "14px 24px",
  borderRadius: "12px",
  border: "1px solid #334155",
  background: "#0f172a",
  color: "#e2e8f0",
  fontWeight: "bold",
  cursor: "pointer",
  minWidth: "190px",
};

const botaoAzul = {
  padding: "14px 24px",
  borderRadius: "12px",
  border: "none",
  background:
    "linear-gradient(135deg,#2563eb,#22d3ee)",
  color: "#fff",
  fontWeight: "bold",
  cursor: "pointer",
  minWidth: "190px",
};

const botaoVermelho = {
  marginTop: "10px",
  padding: "10px 16px",
  borderRadius: "10px",
  border: "none",
  background: "#dc2626",
  color: "#fff",
  fontWeight: "bold",
  cursor: "pointer",
};

const botaoPequeno = {
  padding: "10px 14px",
  borderRadius: "10px",
  border: "none",
  background: "#16a34a",
  color: "#fff",
  fontWeight: "bold",
  cursor: "pointer",
};

const botaoPrecificacao = {
  padding: "14px 24px",
  borderRadius: "12px",
  border: "1px solid #4ade80",
  background:
    "linear-gradient(135deg,#15803d,#22c55e)",
  color: "#ffffff",
  fontWeight: "bold",
  minWidth: "210px",
  boxShadow:
    "0 12px 28px rgba(34,197,94,.18)",
};

const botaoPublicar = {
  padding: "14px 26px",
  borderRadius: "12px",
  border: "1px solid #4ade80",
  background:
    "linear-gradient(135deg,#15803d,#22c55e)",
  color: "#ffffff",
  fontWeight: "bold",
  cursor: "pointer",
  minWidth: "190px",
  boxShadow:
    "0 12px 28px rgba(34,197,94,.2)",
};

const botaoRecursos = {
  width: "100%",
  marginTop: "18px",
  padding: "14px",
  borderRadius: "12px",
  border: "1px solid #334155",
  background: "#020617",
  color: "#67e8f9",
  fontWeight: "bold",
  cursor: "pointer",
};

const recursosBox = {
  marginTop: "18px",
  padding: "18px",
  borderRadius: "16px",
  background: "#020617",
  border: "1px solid #334155",
};
const campoPrecificacaoAppia = {
  display: "block",
  width: "100%",
  marginTop: "6px",
  padding: "10px 11px",
  borderRadius: "9px",
  border: "1px solid #334155",
  background: "#020617",
  color: "#ffffff",
  outline: "none",
  boxSizing: "border-box",
};

const botaoPrecoSugestao = {
  minHeight: "105px",
  padding: "12px",
  borderRadius: "12px",
  background: "#020617",
  color: "#ffffff",
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center",
  gap: "6px",
};

const resultadoPrecoAppia = {
  padding: "11px",
  borderRadius: "10px",
  border: "1px solid #334155",
  background: "#020617",
  color: "#cbd5e1",
  display: "flex",
  flexDirection: "column",
  gap: "5px",
  textAlign: "center",
};

// Seta "← Voltar" entre as etapas do Novo Anúncio: só rola até a anterior.
function BotaoVoltarEtapaNA({ alvo, children }) {
  return (
    <button
      type="button"
      data-paiia-navegacao
      data-paiia-voltar-etapa={alvo}
      onClick={() => {
        try {
          const url = new URL(window.location.href);
          url.hash = alvo;
          window.history.replaceState(window.history.state, "", url.toString());
          document.getElementById(alvo)?.scrollIntoView({ behavior: "smooth", block: "start" });
        } catch {
          // sem rolagem
        }
      }}
      style={{ ...botaoEtapaNA, display: "block", marginBottom: "10px" }}
    >
      {children}
    </button>
  );
}
const botaoFreteML = { padding: "8px 14px", borderRadius: "10px", border: "1px solid #475569", background: "#0f172a", color: "#e2e8f0", cursor: "pointer", fontSize: "13px", fontWeight: 700 };
const ROTULO_MODALIDADE_FRETE = { xd_drop_off: "Agências Mercado Livre", drop_off: "Correios", cross_docking: "Coleta", self_service: "Flex", fulfillment: "Full" };
const botaoEtapaNA = { padding: "5px 10px", borderRadius: "8px", border: "1px solid #475569", background: "transparent", color: "#cbd5e1", cursor: "pointer", fontSize: "12px" };
