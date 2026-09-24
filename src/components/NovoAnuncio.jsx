import {
  useEffect,
  useState,
} from "react";
import { supabase } from "../supabase";
import PainelCatalogo from "./PainelCatalogo";
import ChecklistAnuncio from "./ChecklistAnuncio";
import PainelFotosAnuncio from "./PainelFotosAnuncio";
import PontuacaoAnuncio from "./PontuacaoAnuncio";
import AnaliseIA from "./AnaliseIA";
import AssistenteAnuncio from "./AssistenteAnuncio";

import DadosPeca from "./DadosPeca";
import useNovoAnuncio from "../hooks/useNovoAnuncio";
import { deveIniciarNovaCriacaoMidia } from "../services/limparEstadoTemporarioMidia";
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
} from "../services/paizinhoPesquisa/validarResultadoPesquisa";

const MENSAGEM_BASE_NAO_ENCONTROU =
  "Produto ainda não encontrado na Base PAIIA.";

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
  anuncioEditando,
  setAnuncioEditando,
}) {
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

  if (deveIniciarNovaCriacaoMidia()) {
    return;
  }

  const dadosTemporarios =
    localStorage.getItem(
      "novoAnuncioTemporario"
    );

  if (!dadosTemporarios) {
    return;
  }

  try {
    const dados =
      JSON.parse(dadosTemporarios);

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
        const salvo =
          localStorage.getItem(
            "novoAnuncioTemporario"
          ) ||
          localStorage.getItem(
            "rascunhoNovoAnuncioTemp"
          );

        if (!salvo) {
          return;
        }

        const dados = JSON.parse(salvo);

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

    setFotosAnuncio(
      (fotosAtuais) => {
        const atuais =
          Array.isArray(
            fotosAtuais
          )
            ? fotosAtuais
            : [];

        const todas = [
          ...rascunho.fotos,
          ...atuais,
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

const [calculandoCustosML, setCalculandoCustosML] =
  useState(false);

const [resultadoCustosML, setResultadoCustosML] =
  useState(null);
const [mostrarCalculoFreteML, setMostrarCalculoFreteML] =
  useState(false);

const [pesoFreteML, setPesoFreteML] =
  useState("");

const [alturaFreteML, setAlturaFreteML] =
  useState("");

const [larguraFreteML, setLarguraFreteML] =
  useState("");

const [comprimentoFreteML, setComprimentoFreteML] =
  useState("");

/*
 * A modalidade do anúncio agora faz parte da precificação.
 * Usamos uma comissão-base sugerida e mantemos o campo
 * editável caso a categoria possua uma taxa diferente.
 */
useEffect(() => {
  if (canalVenda === "site_proprio") {
    return;
  }

  if (canalVenda === "shopee") {
    setComissaoPrecificacao("20");
    return;
  }

  setComissaoPrecificacao(
    tipoAnuncio === "premium"
      ? "17"
      : "12"
  );
}, [tipoAnuncio, canalVenda]);

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

function calcularPrecoComMargem(
  margemLiquida
) {
  const custoMercadoria =
    numeroPrecificacao(custo);

  const frete =
    numeroPrecificacao(
      fretePrecificacao
    );

  const despesas =
    numeroPrecificacao(
      despesasPrecificacao
    );

  const comissao =
    numeroPrecificacao(
      comissaoPrecificacao
    );

  const imposto =
    numeroPrecificacao(
      impostoPrecificacao
    );

  const custoTotal =
    custoMercadoria +
    frete +
    despesas;

  const percentualTotal =
    comissao +
    imposto +
    margemLiquida;

  if (
    custoTotal <= 0 ||
    percentualTotal >= 100
  ) {
    return 0;
  }

  return (
    custoTotal /
    (1 - percentualTotal / 100)
  );
}

const precoMargem10 =
  calcularPrecoComMargem(10);

const precoMargem15 =
  calcularPrecoComMargem(15);

const precoMargem20 =
  calcularPrecoComMargem(20);

const custoTotalPrecificacao =
  numeroPrecificacao(custo) +
  numeroPrecificacao(
    fretePrecificacao
  ) +
  numeroPrecificacao(
    despesasPrecificacao
  );

const precoAtualNumero =
  numeroPrecificacao(preco);

const taxasPercentuais =
  numeroPrecificacao(
    comissaoPrecificacao
  ) +
  numeroPrecificacao(
    impostoPrecificacao
  );

const lucroLiquidoAtual =
  precoAtualNumero > 0
    ? precoAtualNumero -
      custoTotalPrecificacao -
      precoAtualNumero *
        (taxasPercentuais / 100)
    : 0;

const margemLiquidaAtual =
  precoAtualNumero > 0
    ? (
        lucroLiquidoAtual /
        precoAtualNumero
      ) * 100
    : 0;

const markupAtual =
  custoTotalPrecificacao > 0 &&
  precoAtualNumero > 0
    ? (
        (
          precoAtualNumero /
          custoTotalPrecificacao
        ) -
        1
      ) * 100
    : 0;

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

  setCusto(
    custoRealDetalhado
      .toFixed(2)
      .replace(".", ",")
  );

  setDespesasPrecificacao(
    "0,00"
  );

  setMostrarCustoDetalhado(
    false
  );
}

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

  setPreco(valorFormatado);
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

  if (dadosPrecificacao?.custo) {
    setCusto(
      String(
        dadosPrecificacao.custo
      )
    );
  }

  if (!precoSugerido) {
    return;
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

      localStorage.setItem(
        "novoAnuncioTemporario",
        JSON.stringify({
          ...dados,
          preco:
            precoSugerido,
          custo:
            dadosPrecificacao?.custo ||
            dados?.custo ||
            "",
        })
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
    return (
      localStorage.getItem(
        "clipPronto"
      ) ||
      localStorage.getItem(
        "clipSelecionado"
      ) ||
      ""
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
  });

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

  if (!codigoFinal) {
    alert(
      "Digite o código da peça ou OEM."
    );
    return;
  }

  if (processando) {
    return;
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

    localStorage.setItem(
      "rascunhoNovoAnuncioTemp",
      JSON.stringify({
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
      })
    );

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
      String(erro?.message || "").trim() ===
      MENSAGEM_BASE_NAO_ENCONTROU
    ) {
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
async function executarPesquisaPaizinho(
  codigoFinal
) {
  // O código digitado é preservado como "Código pesquisado".
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
          "Dados encontrados pelo Paizinho em fonte original — pendentes de validação/auditoria. Confira a fonte antes de publicar." +
          (naoConfirmados.length
            ? ` Não confirmado: ${naoConfirmados.join("; ")}.`
            : ""),
        origemPesquisaPaizinho: true,
      };

      const auditoriaPaizinho = {
        aprovado: false,
        origemPesquisaPaizinho: true,
        problemas: [
          "Pendente de validação/auditoria (pesquisa em fonte original).",
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
        localStorage.setItem(
          "rascunhoNovoAnuncioTemp",
          JSON.stringify({
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
          })
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

  localStorage.setItem(
    "novoAnuncioTemporario",
    JSON.stringify(
      dadosAnuncio
    )
  );

  localStorage.setItem(
    "rascunhoNovoAnuncioTemp",
    JSON.stringify(
      dadosAnuncio
    )
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

    localStorage.setItem(
      "novoAnuncioTemporario",
      JSON.stringify(
        dadosLeves
      )
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

    localStorage.setItem(
      "novoAnuncioTemporario",
      JSON.stringify(
        dadosLeves
      )
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
    localStorage.setItem(
      chaveRascunhoTemp,
      JSON.stringify({
        codigo,
        oem,
        titulo,
        descricao,
        preco,
        tipoAnuncio,
        pecaEncontrada,
        fotos: fotosAnuncio || [],
        clip: clipAnuncio || "",
      })
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
    localStorage.setItem(
      chaveRascunhoTemp,
      JSON.stringify({
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
      })
    );

    localStorage.setItem(
      "novoAnuncioTemporario",
      JSON.stringify({
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
      })
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

  function continuarParaPublicacao() {
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

        localStorage.setItem(
          chaveRascunhoTemp,
          JSON.stringify({
            ...rascunho,
            fotos: [],
          })
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
    <div style={{ marginTop: "25px" }}>
      <div style={cardStyle}>
        <h2 style={tituloPagina}>
          🤖 Criador Inteligente de Anúncios
        </h2>

        <p style={subtituloPagina}>
          Informe o código da peça, revise os dados,
          adicione fotos e finalize o anúncio.
        </p>
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
/>

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
</div>

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

        <section style={centralInteligenciaAnuncioStyle}>
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
        onClick={() => {
          setCanalVenda("mercado_livre");
          setTipoAnuncio("classico");
        }}
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
        onClick={() => {
          setCanalVenda("mercado_livre");
          setTipoAnuncio("premium");
        }}
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
        onClick={() => {
          setCanalVenda("shopee");
        }}
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
        onClick={() => {
          setCanalVenda("site_proprio");
        }}
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
          : canalVenda === "shopee"
            ? "20%"
            : tipoAnuncio === "premium"
              ? "17%"
              : "12%"}
      </strong>
      . {canalVenda === "site_proprio"
        ? "Informe abaixo a taxa/comissão do seu site."
        : "Você pode ajustar a comissão abaixo se a categoria tiver outra taxa."}
    </div>
  </div>


  <button
    type="button"
    onClick={() =>
      setMostrarCalculoFreteML(
        (atual) => !atual
      )
    }
    style={{
      width: "100%",
      marginTop: "14px",
      marginBottom: "12px",
      padding: "13px 16px",
      borderRadius: "12px",
      border: "1px solid #38bdf8",
      background:
        mostrarCalculoFreteML
          ? "linear-gradient(135deg,#0c4a6e,#0f172a)"
          : "#082f49",
      color: "#bae6fd",
      fontWeight: "800",
      textAlign: "left",
      cursor: "pointer",
    }}
  >
    🚚{" "}
    {mostrarCalculoFreteML
      ? "Fechar cálculo de frete Mercado Livre"
      : "Quero calcular meu frete Mercado Livre"}
  </button>

  {mostrarCalculoFreteML && (
    <div
      style={{
        width: "100%",
        marginBottom: "14px",
        padding: "14px",
        borderRadius: "12px",
        border: "1px solid #334155",
        background: "#020617",
      }}
    >
      <div
        style={{
          color: "#94a3b8",
          fontSize: "12px",
          lineHeight: 1.5,
          marginBottom: "12px",
        }}
      >
        Informe o peso e as medidas da embalagem. O PAIIA consulta
        o Mercado Livre e preenche o campo de frete automaticamente.
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(4, minmax(0, 1fr))",
          gap: "10px",
          width: "100%",
        }}
      >
        <label style={{ color: "#cbd5e1", fontSize: "12px" }}>
          Peso (kg)
          <input
            value={pesoFreteML}
            onChange={(e) =>
              setPesoFreteML(e.target.value)
            }
            placeholder="Ex.: 0,350"
            style={campoPrecificacaoAppia}
          />
        </label>

        <label style={{ color: "#cbd5e1", fontSize: "12px" }}>
          Altura (cm)
          <input
            value={alturaFreteML}
            onChange={(e) =>
              setAlturaFreteML(e.target.value)
            }
            placeholder="Ex.: 8"
            style={campoPrecificacaoAppia}
          />
        </label>

        <label style={{ color: "#cbd5e1", fontSize: "12px" }}>
          Largura (cm)
          <input
            value={larguraFreteML}
            onChange={(e) =>
              setLarguraFreteML(e.target.value)
            }
            placeholder="Ex.: 15"
            style={campoPrecificacaoAppia}
          />
        </label>

        <label style={{ color: "#cbd5e1", fontSize: "12px" }}>
          Comprimento (cm)
          <input
            value={comprimentoFreteML}
            onChange={(e) =>
              setComprimentoFreteML(e.target.value)
            }
            placeholder="Ex.: 20"
            style={campoPrecificacaoAppia}
          />
        </label>
      </div>

      <button
        type="button"
        onClick={calcularCustosMercadoLivre}
        disabled={calculandoCustosML}
        style={{
          width: "100%",
          marginTop: "12px",
          padding: "12px 16px",
          borderRadius: "10px",
          border: "none",
          background:
            "linear-gradient(135deg,#0369a1,#0284c7)",
          color: "#ffffff",
          fontWeight: "800",
          cursor:
            calculandoCustosML
              ? "wait"
              : "pointer",
          opacity:
            calculandoCustosML
              ? 0.7
              : 1,
        }}
      >
        {calculandoCustosML
          ? "⏳ Consultando Mercado Livre..."
          : "🚚 Calcular frete Mercado Livre"}
      </button>
    </div>
  )}

  <div
    style={{
      display: "grid",
      gridTemplateColumns:
        "repeat(5, minmax(0, 1fr))",
      gap: "10px",
      width: "100%",
      marginTop: "14px",
    }}
  >
    <label
      style={{
        color: "#cbd5e1",
        fontSize: "12px",
      }}
    >
      Custo da mercadoria

      <input
        value={custo}
        onChange={(e) =>
          setCusto(
            e.target.value
          )
        }
        placeholder="0,00"
        style={campoPrecificacaoAppia}
      />
    </label>

    <label
  style={{
    color: "#cbd5e1",
    fontSize: "12px",
  }}
>
  Frete

  <input
    value={fretePrecificacao}
    onChange={(e) =>
      setFretePrecificacao(
        e.target.value
      )
    }
    placeholder="0,00"
    style={campoPrecificacaoAppia}
  />
</label>

   <label
  style={{
    color: "#cbd5e1",
    fontSize: "12px",
  }}
>
  Embalagem

  <input
    value={despesasPrecificacao}
    onChange={(e) =>
      setDespesasPrecificacao(
        e.target.value
      )
    }
    placeholder="3,00"
    style={campoPrecificacaoAppia}
  />
</label>

    <label
      style={{
        color: "#cbd5e1",
        fontSize: "12px",
      }}
    >
      Comissão %

      <input
        value={
          comissaoPrecificacao
        }
        onChange={(e) =>
          setComissaoPrecificacao(
            e.target.value
          )
        }
        placeholder="17"
        style={campoPrecificacaoAppia}
      />
    </label>

    <label
  style={{
    color: "#cbd5e1",
    fontSize: "12px",
  }}
>
  Impostos %

  <input
    value={impostoPrecificacao}
    onChange={(e) =>
      setImpostoPrecificacao(
        e.target.value
      )
    }
    placeholder="8"
    style={campoPrecificacaoAppia}
  />
</label>

  </div>

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

  <div
    style={{
      marginTop: "14px",
      padding: "12px",
      borderRadius: "12px",
      background: "#020617",
      border:
        "1px solid #334155",
      color: "#cbd5e1",
      fontSize: "12px",
      lineHeight: 1.6,
      width: "100%",
    }}
  >
    🧮 <strong>Fórmula PAIIA</strong>
    <br />
    Preço = custo total ÷
    [1 − (comissão + impostos +
    margem líquida)]
  </div>

  <div
    style={{
      display: "grid",
      gridTemplateColumns:
        "repeat(auto-fit,minmax(180px,1fr))",
      gap: "10px",
      width: "100%",
      marginTop: "14px",
    }}
  >
    <button
      type="button"
      onClick={() =>
        aplicarPrecoSugerido(
          precoMargem10
        )
      }
      style={{
        ...botaoPrecoSugestao,
        border:
          "1px solid #f59e0b",
      }}
    >
      <span>
        🔶 Conservador
      </span>

      <strong>
        {precoMargem10 > 0
          ? formatarPrecoAppia(
              precoMargem10
            )
          : "—"}
      </strong>

      <small>
        10% líquido
      </small>
    </button>

    <button
      type="button"
      onClick={() =>
        aplicarPrecoSugerido(
          precoMargem15
        )
      }
      style={{
        ...botaoPrecoSugestao,
        border:
          "1px solid #22c55e",
        background:
          "linear-gradient(135deg,#052e16,#0f172a)",
      }}
    >
      <span>
        🟢 Recomendado
      </span>

      <strong>
        {precoMargem15 > 0
          ? formatarPrecoAppia(
              precoMargem15
            )
          : "—"}
      </strong>

      <small>
        15% líquido
      </small>
    </button>

    <button
      type="button"
      onClick={() =>
        aplicarPrecoSugerido(
          precoMargem20
        )
      }
      style={{
        ...botaoPrecoSugestao,
        border:
          "1px solid #38bdf8",
      }}
    >
      <span>
        🔵 Ideal
      </span>

      <strong>
        {precoMargem20 > 0
          ? formatarPrecoAppia(
              precoMargem20
            )
          : "—"}
      </strong>

      <small>
        20% líquido
      </small>
    </button>
  </div>

  <div
    style={{
      width: "100%",
      marginTop: "14px",
    }}
  >
  <label
    style={{
      display: "block",
      color: "#cbd5e1",
      fontSize: "12px",
      fontWeight: "bold",
    }}
  >
    Preço final do anúncio

    <input
      value={preco}
      onChange={(e) =>
        setPreco(e.target.value)
      }
      placeholder="0,00"
      style={{
        ...campoPrecificacaoAppia,
        marginTop: "6px",
        fontSize: "18px",
        fontWeight: "bold",
        color: "#86efac",
      }}
    />
  </label>
  </div>

  {precoAtualNumero > 0 &&
  custoTotalPrecificacao > 0 && (
    <div
      style={{
        display: "grid",
        gridTemplateColumns:
          "repeat(auto-fit,minmax(150px,1fr))",
        gap: "10px",
        width: "100%",
        marginTop: "14px",
      }}
    >
      <div style={resultadoPrecoAppia}>
  <span>Custo base</span>

  <strong>
    {formatarPrecoAppia(
      custoTotalPrecificacao
    )}
  </strong>
</div>

      <div style={resultadoPrecoAppia}>
        <span>Lucro líquido</span>

        <strong>
          {formatarPrecoAppia(
            lucroLiquidoAtual
          )}
        </strong>
      </div>

      <div style={resultadoPrecoAppia}>
        <span>Margem líquida</span>

        <strong>
          {margemLiquidaAtual.toFixed(1)}%
        </strong>
      </div>

      <div style={resultadoPrecoAppia}>
        <span>Markup</span>

        <strong>
          {markupAtual.toFixed(1)}%
        </strong>
      </div>
    </div>
  )}

{precoAtualNumero > 0 &&
  custoTotalPrecificacao > 0 && (() => {
    const valorComissao =
      precoAtualNumero *
      (
        numeroPrecificacao(
          comissaoPrecificacao
        ) / 100
      );

    const valorImposto =
      precoAtualNumero *
      (
        numeroPrecificacao(
          impostoPrecificacao
        ) / 100
      );
const custoTotalVenda =
  custoTotalPrecificacao +
  valorComissao +
  valorImposto;

    const lucroFinal =
      precoAtualNumero -
      custoTotalPrecificacao -
      valorComissao -
      valorImposto;

    const margemFinal =
      precoAtualNumero > 0
        ? (
            lucroFinal /
            precoAtualNumero
          ) * 100
        : 0;

    return (
      <div
        style={{
          marginTop: "14px",
          width: "100%",
          padding: "16px",
          borderRadius: "12px",
          border: "1px solid #334155",
          background: "#020617",
        }}
      >
        <div
          style={{
            color: "#67e8f9",
            fontWeight: "bold",
            fontSize: "14px",
            marginBottom: "12px",
          }}
        >
          🧾 Memória do cálculo
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "1fr auto",
            gap: "9px 20px",
            color: "#cbd5e1",
            fontSize: "13px",
          }}
        >
          <span>
            💰 Preço de venda
          </span>

          <strong>
            {formatarPrecoAppia(
              precoAtualNumero
            )}
          </strong>

          <span>
            📦 Custo da mercadoria
          </span>

          <strong>
            -{" "}
            {formatarPrecoAppia(
              numeroPrecificacao(
                custo
              )
            )}
          </strong>

          <span>
            🚚 Frete
          </span>

          <strong>
            -{" "}
            {formatarPrecoAppia(
              numeroPrecificacao(
                fretePrecificacao
              )
            )}
          </strong>

          <span>
  📦 Embalagem
</span>

          <strong>
            -{" "}
            {formatarPrecoAppia(
              numeroPrecificacao(
                despesasPrecificacao
              )
            )}
          </strong>

          <span>
            🛒 Comissão{" "}
            {numeroPrecificacao(
              comissaoPrecificacao
            )}
            %
          </span>

          <strong>
            -{" "}
            {formatarPrecoAppia(
              valorComissao
            )}
          </strong>

          <span>
  🏛️ Impostos{" "}
  {numeroPrecificacao(
    impostoPrecificacao
  )}
  %
</span>

<strong>
  -{" "}
  {formatarPrecoAppia(
    valorImposto
  )}
</strong>
<span
  style={{
    color: "#ffffff",
    fontWeight: "bold",
  }}
>
  💸 Custo total da venda
</span>

<strong
  style={{
    color: "#fbbf24",
  }}
>
  {formatarPrecoAppia(
    custoTotalVenda
  )}
</strong>
        </div>

        <div
          style={{
            marginTop: "14px",
            paddingTop: "14px",
            borderTop:
              "1px solid #334155",
            display: "flex",
            justifyContent:
              "space-between",
            gap: "15px",
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              color: "#ffffff",
              fontWeight: "bold",
            }}
          >
            💵 Lucro líquido
          </span>

          <strong
            style={{
              color:
                margemFinal >= 15
                  ? "#22c55e"
                  : margemFinal >= 10
                    ? "#facc15"
                    : "#f87171",
              fontSize: "18px",
            }}
          >
            {formatarPrecoAppia(
              lucroFinal
            )}{" "}
            ({margemFinal.toFixed(1)}%)
          </strong>
        </div>
      </div>
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
        <div
          role="radiogroup"
          aria-label="Categoria da concorrência"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexWrap: "wrap",
          }}
        >
          {["original", "importado"].map((categoria) => {
            const selecionada =
              categoriaConcorrencia === categoria;
            const rotulo =
              categoria === "original"
                ? "Original"
                : "Importado";

            return (
              <label
                key={categoria}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "7px",
                  padding: "10px 13px",
                  borderRadius: "10px",
                  border: selecionada
                    ? "1px solid #67e8f9"
                    : "1px solid #475569",
                  background: selecionada
                    ? "rgba(8,145,178,.22)"
                    : "#020617",
                  color: selecionada
                    ? "#cffafe"
                    : "#e2e8f0",
                  fontWeight: "800",
                  cursor: pesquisandoConcorrencia
                    ? "wait"
                    : "pointer",
                  opacity: pesquisandoConcorrencia
                    ? 0.7
                    : 1,
                }}
              >
                <input
                  type="radio"
                  name="categoria-concorrencia"
                  value={categoria}
                  checked={selecionada}
                  disabled={pesquisandoConcorrencia}
                  onChange={() => {
                    setCategoriaConcorrencia(categoria);
                    setResultadoConcorrencia(null);
                    setErroConcorrencia("");
                  }}
                />
                {rotulo}
              </label>
            );
          })}
        </div>

        <button
          type="button"
          onClick={pesquisarConcorrenciaPaizinho}
          disabled={
            pesquisandoConcorrencia ||
            !categoriaConcorrencia
          }
          style={{
            padding: "13px 18px",
            borderRadius: "10px",
            border: "1px solid #38bdf8",
            background: "#1d4ed8",
            color: "#ffffff",
            fontWeight: "bold",
            cursor: pesquisandoConcorrencia
              ? "wait"
              : categoriaConcorrencia
                ? "pointer"
                : "not-allowed",
            opacity:
              pesquisandoConcorrencia ||
              !categoriaConcorrencia
                ? 0.55
                : 1,
            whiteSpace: "normal",
          }}
        >
          {pesquisandoConcorrencia
            ? "⏳ Paizinho pesquisando..."
            : "🤖 Paizinho, pesquisar a concorrência"}
        </button>
      </div>
    </div>

    <div
      style={{
        marginBottom: "12px",
        color: categoriaConcorrencia
          ? "#a5f3fc"
          : "#fde68a",
        fontSize: "12px",
        fontWeight: "700",
        textAlign: "right",
      }}
    >
      {resultadoConcorrencia
        ? `Concorrência — ${
            resultadoConcorrencia.classificacao.tipo === "original"
              ? "Peças originais"
              : "Peças importadas"
          }`
        : categoriaConcorrencia === "original"
          ? "Comparando peças originais"
          : categoriaConcorrencia === "importado"
            ? "Comparando peças importadas"
            : "Escolha Original ou Importado para pesquisar."}
    </div>

    <div
      style={{
        display: "grid",
        gridTemplateColumns:
          "repeat(auto-fit,minmax(190px,1fr))",
        gap: "10px",
      }}
    >
      <div
        style={{
          padding: "12px",
          borderRadius: "10px",
          border: "1px solid #334155",
          background: "#020617",
        }}
      >
        <div
          style={{
            color: "#94a3b8",
            fontSize: "11px",
            fontWeight: "bold",
          }}
        >
          SEU PREÇO
        </div>

        <strong
          style={{
            color: "#f8fafc",
            fontSize: "16px",
          }}
        >
          {preco
            ? `R$ ${preco}`
            : "Não informado"}
        </strong>
      </div>

      <div
        style={{
          padding: "12px",
          borderRadius: "10px",
          border: "1px solid #334155",
          background: "#020617",
        }}
      >
        <div
          style={{
            color: "#94a3b8",
            fontSize: "11px",
            fontWeight: "bold",
          }}
        >
          🟡 MENOR PREÇO
        </div>

        <strong
          style={{
            color: resultadoConcorrencia
              ? "#86efac"
              : "#f8fafc",
            fontSize: "14px",
          }}
        >
          {resultadoConcorrencia?.mercadoGeral?.quantidade > 0
            ? formatarPrecoAppia(
                resultadoConcorrencia.mercadoGeral.minimo
              )
            : resultadoConcorrencia
              ? "Nenhum comparável encontrado"
              : "Aguardando pesquisa"}
        </strong>
      </div>

      <div
        style={{
          padding: "12px",
          borderRadius: "10px",
          border: "1px solid #334155",
          background: "#020617",
        }}
      >
        <div
          style={{
            color: "#94a3b8",
            fontSize: "11px",
            fontWeight: "bold",
          }}
        >
          🟠 PREÇO MÉDIO
        </div>

        <strong
          style={{
            color: resultadoConcorrencia
              ? "#86efac"
              : "#f8fafc",
            fontSize: "14px",
          }}
        >
          {resultadoConcorrencia?.mercadoGeral?.quantidade > 0
            ? formatarPrecoAppia(
                resultadoConcorrencia.mercadoGeral.media
              )
            : resultadoConcorrencia
              ? "Nenhum comparável encontrado"
              : "Aguardando pesquisa"}
        </strong>
      </div>

      <div
        style={{
          padding: "12px",
          borderRadius: "10px",
          border: "1px solid #334155",
          background: "#020617",
        }}
      >
        <div
          style={{
            color: "#94a3b8",
            fontSize: "11px",
            fontWeight: "bold",
          }}
        >
          📊 MAIOR PREÇO
        </div>

        <strong
          style={{
            color: resultadoConcorrencia
              ? "#86efac"
              : "#f8fafc",
            fontSize: "14px",
          }}
        >
          {resultadoConcorrencia?.mercadoGeral?.quantidade > 0
            ? formatarPrecoAppia(
                resultadoConcorrencia.mercadoGeral.maximo
              )
            : resultadoConcorrencia
              ? "Sem comparáveis"
              : "Aguardando pesquisa"}
        </strong>
      </div>
    </div>

    <div
      style={{
        marginTop: "10px",
        padding: "10px 12px",
        borderRadius: "10px",
        border: "1px dashed #475569",
        background: "#0f172a",
        color: "#94a3b8",
        fontSize: "11px",
      }}
    >
      A menor faixa, a média e a maior faixa consideram somente a categoria escolhida.
    </div>

    <div
      style={{
        marginTop: "12px",
        padding: "12px",
        borderRadius: "10px",
        border: "1px solid #334155",
        background: "#020617",
        color: "#cbd5e1",
        fontSize: "12px",
        lineHeight: 1.5,
      }}
    >
      <strong
        style={{
          color: "#67e8f9",
        }}
      >
        💡 Análise do Paizinho:
      </strong>{" "}

      {erroConcorrencia
        ? `⚠️ ${erroConcorrencia}`
        : resultadoConcorrencia
          ? resultadoConcorrencia.analise
          : "Clique em ‘Paizinho, pesquisar a concorrência’. O PAIIA pesquisará Mercado Livre e Shopee e trará as faixas de preço para esta tela."}
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

          const url =
            resultadoConcorrencia
              ?.fontes?.[0]?.url ||
            montarUrlPesquisaMercadoLivre(
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

          const url =
            resultadoConcorrencia
              ?.fontes?.[1]?.url ||
            montarUrlPesquisaShopee(
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

    <div
      style={{
        marginTop: "10px",
        color: "#94a3b8",
        fontSize: "11px",
        textAlign: "center",
      }}
    >
      🔎 Pesquisa:{" "}
      {resultadoConcorrencia?.termo ||
        [
          codigo || oem || "",
          titulo ||
            pecaEncontrada?.peca ||
            "",
        ]
          .filter(Boolean)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim() ||
        "aguardando peça"}
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
  id="secao-fotos-anuncio"
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


        <section style={secaoStyle}>
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
