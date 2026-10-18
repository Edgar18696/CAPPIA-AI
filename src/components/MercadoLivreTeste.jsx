import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabase";
import PesoEmbalagemML from "./PesoEmbalagemML";
import RevisaoPublicacaoML from "./RevisaoPublicacaoML";
import EscolherCanaisPublicacao from "./EscolherCanaisPublicacao";
import { normalizarQuantidade } from "../services/estoqueBlingPAIIA";
import {
  lerAplicacoesAprovadas,
  tipoVeiculoDaCategoria,
  marcaInvalida,
  descricaoAfirmaOriginal,
  montarDescricaoPadrao,
  situacaoCompatibilidade,
  textoSoModelosSemDetalhes,
  TEXTO_SEM_APLICACAO,
  TEXTO_VEICULOS_SO_NA_DESCRICAO,
} from "../services/compatibilidadeML";
import { useContasML, contasMLConectadas } from "../services/contaMLAtiva";
import {
  OPCOES_TIPO_VEICULO,
  TIPO_CARRO,
  ORIGEM_MANUAL,
  ORIGEM_SUGESTAO,
  normalizarTipoVeiculo,
  sugerirTipoVeiculo,
  aplicarSugestaoTipoVeiculo,
  escolherTipoVeiculo,
  tipoVeiculoNaCategoria,
} from "../services/tipoVeiculoAnuncio";
import { GARANTIA_ML, LINHAS_FIXAS, padroesEsperadosConferencia } from "../services/padroesPublicacaoML";
import PainelCategoriaML from "./PainelCategoriaML";
import { avaliarCategorias, registrarConfirmacao, desfazerConfirmacao, conferirCategoriaParaPublicar, mesclarRejeicoes, rejeicaoManual, ORIGEM_CATEGORIA } from "../services/categoriaML";
import { consultarPreditor, lerDetalheCategoria, lerEvidenciaMesmoCodigo, lerRejeicoesDoSKU } from "../services/categoriaMLBusca";
import { exigenciasAtributos, ATRIBUTO_MOTIVO_SEM_GTIN } from "../services/categoriaPublicacaoML";
import {
  listarAnunciosDoCodigo,
  registrarCategoriasRejeitadas,
  obterAnuncio,
  salvarFichaAprovada,
  salvarRascunhoFicha,
  registrarDecisaoBase,
  publicacaoExiste,
} from "../services/anuncioPublicacaoService";
import { montarRecuperacaoDaFicha, urlsFotosFicha, mesmaAprovacao, diferencasAssinatura } from "../services/fichaConferencia";
import { fotosIniciaisConferencia, guardarFotosEmMemoria, simuladorEhDoAnuncio, decidirFotosDaFicha, situacaoFotosNaTela, juntarHistoricoFotos, listaUrls, marcaDasFotos, MEMORIA_FOTOS_DONO } from "../services/fotosDaFicha";
import FichaPublicadaPAIIA from "./FichaPublicadaPAIIA";
import { fichaSoNoNovoAnuncio, rascunhoDaFicha, idFichaValido } from "../services/fichaNovoAnuncio";
import { abrirFichaNoNovoAnuncio } from "../services/aberturaNovoAnuncio";
import {
  edicoesDoNovoAnuncio,
  medidaCompletaFicha,
  gParaKgTexto,
  CAMPOS_ASSINATURA_TECNICOS,
} from "../services/dadosTecnicosAnuncio";
import { rascunhoDaFicha as rascunhoNovoAnuncioDaFicha } from "../services/fichaNovoAnuncio";
import {
  tipoAnuncioDaFicha,
  compararVersoesFicha,
  decidirAberturaFicha,
  camposQueInvalidam,
  motivoBloqueioPublicacao,
  ESTADO_GRAVACAO,
  TEXTO_GRAVACAO,
  TEXTO_CAMPO_ALTERADO,
} from "../services/persistenciaFicha";
import { divergenciasAnuncio, modelosConfirmados, modelosFaltandoNaDescricao, TEXTO_MODELOS_FALTANDO, estadoBasePAIIA, podeGravarNaBase } from "../services/publicacaoSegura";
import {
  separarModelos,
  separarAplicacoesBase,
  juntarModelos,
  separarAplicacoesLegadas,
  extrairDadosDescricao,
  termosConfirmados,
  gerarIntencoesBusca,
  separarSugestoesConcorrentes,
  identificarCodigos,
} from "../services/inteligenciaBusca";
import {
  SINONIMOS_TIPO_PECA,
  extrairProdutoPrincipal,
  nucleoDoProduto,
  identificarProdutoPrincipal,
  decidirNomePeca,
  ROTULO_ORIGEM_NOME,
  ORIGENS_NOME_USUARIO,
} from "../services/nomePecaFicha";

function normalizarTexto(valor = "") {
  return String(valor || "")
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase()
    .trim();
}
// =====================================================
// IDENTIFICAÇÃO / APLICAÇÕES / CATEGORIA (Conferência)
// Regra: nada é deduzido. Só entra o que veio da base/catálogo
// ou o que o usuário confirmou. Campo ausente fica em branco.
// =====================================================
function limparCampoTexto(valor) {
  return String(valor ?? "")
    .replace(/�/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function chaveProduto(codigo) {
  return String(codigo || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function normalizarAplicacao(item, origem) {
  if (!item || typeof item !== "object") return null;
  const a = {
    montadora: limparCampoTexto(item.montadora || item.marca_veiculo || item.marcaVeiculo || item.marca),
    modelo: limparCampoTexto(item.modelo || item.veiculo || item.modelo_veiculo || item.modeloVeiculo),
    motor: limparCampoTexto(item.motor || item.motorizacao || item.motor_descricao),
    anoInicio: limparCampoTexto(item.ano_inicio || item.anoInicial || item.ano_de || item.anoDe || item.anoInicio),
    anoFim: limparCampoTexto(item.ano_fim || item.anoFinal || item.ano_ate || item.anoAte || item.anoFim),
    versao: limparCampoTexto(item.versao || item.versao_motor || item.versaoMotor),
    origem,
  };
  if (!a.montadora && !a.modelo) return null;
  return a;
}

function textoAnosAplicacao(a) {
  if (a.anoInicio && a.anoFim && a.anoInicio === a.anoFim) return a.anoInicio;
  if (a.anoInicio && a.anoFim) return `${a.anoInicio} a ${a.anoFim}`;
  if (a.anoInicio) return `a partir de ${a.anoInicio}`;
  if (a.anoFim) return `até ${a.anoFim}`;
  return "";
}

// "Renault Symbol — 1.6 16V — 2009 a 2013 — Privilège"
function textoAplicacao(a) {
  return [
    [a.montadora, a.modelo].filter(Boolean).join(" "),
    a.motor,
    textoAnosAplicacao(a),
    a.versao,
  ]
    .filter(Boolean)
    .join(" — ");
}

function chaveAplicacao(a) {
  return [a?.montadora, a?.modelo, a?.motor, a?.anoInicio, a?.anoFim, a?.versao].join("|").toUpperCase();
}

function juntarAplicacoes(listas) {
  const vistos = new Set();
  const saida = [];
  listas.flat().forEach((a) => {
    if (!a) return;
    const chave = [a.montadora, a.modelo, a.motor, a.anoInicio, a.anoFim, a.versao]
      .join("|")
      .toUpperCase();
    if (vistos.has(chave)) return;
    vistos.add(chave);
    saida.push(a);
  });
  return saida;
}

const CHAVE_APLICACOES_MANUAIS = "paiiaAplicacoesManuaisPorCodigo";
const CHAVE_CATEGORIA_ML = "paiiaCategoriaMLPorCodigo";

function lerMapaLocal(chave) {
  try {
    const dados = JSON.parse(localStorage.getItem(chave) || "{}");
    return dados && typeof dados === "object" ? dados : {};
  } catch {
    return {};
  }
}

function gravarNoMapaLocal(chave, produto, valor) {
  if (!produto) return;
  try {
    const mapa = lerMapaLocal(chave);
    if (valor === null) delete mapa[produto];
    else mapa[produto] = valor;
    localStorage.setItem(chave, JSON.stringify(mapa));
  } catch (erro) {
    console.warn("PAIIA: não foi possível guardar no navegador.", erro?.name || erro);
  }
}

// =====================================================
// FICHA PERSISTENTE DA CONFERÊNCIA (uma por código do anúncio)
// Guarda o que já foi conferido/confirmado para não sumir ao ir para a
// Central, escolher conta, validar, voltar ou atualizar a tela.
// Merge seguro: valor vazio/null/undefined NUNCA apaga um valor
// confirmado; só um valor NOVO vindo da origem (Criar Anúncio/Central),
// diferente do que veio da última vez, substitui o que foi conferido.
// =====================================================
const CHAVE_CONFERENCIA = "paiiaConferenciaPorCodigo";
const MAX_CONFERENCIAS_SALVAS = 40;

function valorVazio(v) {
  if (v === undefined || v === null) return true;
  if (typeof v === "string") return !v.trim();
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "object") return Object.values(v).every(valorVazio);
  return false;
}

function mesmoValor(a, b) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function valorPreservado(ficha, campo, doAnuncio) {
  const salvo = ficha?.campos?.[campo];
  if (valorVazio(salvo)) return doAnuncio;
  if (valorVazio(doAnuncio)) return salvo;
  const origem = ficha?.origem || {};
  if (Object.prototype.hasOwnProperty.call(origem, campo) && !mesmoValor(doAnuncio, origem[campo])) {
    return doAnuncio; // a origem mudou de verdade depois da conferência
  }
  return salvo;
}

// Seta "← Voltar" entre blocos da Conferência: só ROLA até o bloco anterior.
function BotaoVoltarBloco({ alvo, children }) {
  return (
    <button
      type="button"
      data-paiia-navegacao
      data-paiia-voltar-bloco={alvo}
      onClick={() => {
        try {
          document.getElementById(alvo)?.scrollIntoView({ behavior: "smooth", block: "start" });
        } catch {
          // sem rolagem
        }
      }}
      style={{ display: "block", marginBottom: "8px", padding: "4px 10px", borderRadius: "8px", border: "1px solid #475569", background: "transparent", color: "#cbd5e1", cursor: "pointer", fontSize: "12px" }}
    >
      {children}
    </button>
  );
}

// Depois de PUBLICAR: o que este navegador guardava para levar esta ficha ao
// Novo Anúncio/Central/Conferência é limpo (a ficha publicada continua na
// base e abre pela Central). Rascunhos de OUTRAS fichas não são tocados.
function limparEstadoLocalDaFichaPublicada(id, chave) {
  const daFicha = (texto) => {
    try {
      const o = JSON.parse(texto || "null");
      return Boolean(o && id && String(o.fichaIdPAIIA || o.fichaId || "") === String(id));
    } catch {
      return false;
    }
  };
  try {
    for (const k of ["mlAnuncioTeste", "anuncioProntoPublicacao", "novoAnuncioTemporario", "rascunhoNovoAnuncioTemp", "paiiaAnuncioEmAndamento"]) {
      if (daFicha(localStorage.getItem(k))) localStorage.removeItem(k);
    }
    if (chave) {
      const mapa = JSON.parse(localStorage.getItem(CHAVE_CONFERENCIA) || "{}");
      if (mapa[chave] && String(mapa[chave]?.campos?.anuncioIdPAIIA || "") === String(id)) {
        delete mapa[chave];
        localStorage.setItem(CHAVE_CONFERENCIA, JSON.stringify(mapa));
      }
    }
  } catch {
    // sem acesso ao navegador
  }
}

function gravarFichaConferencia(chave, ficha) {
  if (!chave) return;
  try {
    const mapa = lerMapaLocal(CHAVE_CONFERENCIA);
    mapa[chave] = ficha;
    Object.keys(mapa)
      .sort((a, b) => String(mapa[b]?.salvoEm || "").localeCompare(String(mapa[a]?.salvoEm || "")))
      .slice(MAX_CONFERENCIAS_SALVAS)
      .forEach((k) => delete mapa[k]);
    localStorage.setItem(CHAVE_CONFERENCIA, JSON.stringify(mapa));
  } catch (erro) {
    console.warn("PAIIA: não foi possível guardar a ficha da conferência.", erro?.name || erro);
  }
}

// Criação da ficha (uma por anúncio em andamento): se duas gravações
// chegarem juntas (modo de desenvolvimento roda efeitos 2x), só a primeira
// cria; as outras esperam o MESMO ID.
const criandoFichaPorCodigo = new Map();

// Só guarda cópias leves (sem imagens embutidas em base64).
function copiaLeve(valor, limite = 150000) {
  try {
    const txt = JSON.stringify(valor ?? null);
    if (txt.length > limite || txt.includes("data:image") || txt.includes("data:video")) return null;
    return JSON.parse(txt);
  } catch {
    return null;
  }
}

// Categoria já definida para o produto (nunca por suposição):
// 1) vinda do anúncio/base com ID do Mercado Livre;
// 2) escolhida antes pelo usuário para este mesmo código.
function lerCategoriaDefinida(anuncio) {
  const peca = anuncio?.pecaEncontrada || {};
  const id = limparCampoTexto(
    anuncio?.categoriaId || anuncio?.categoria_id || anuncio?.categoriaML?.id ||
      peca.categoria_id || peca.categoriaId || peca.categoria_ml_id
  );
  if (id) {
    return {
      id,
      caminho: limparCampoTexto(
        anuncio?.categoriaCaminho || anuncio?.categoriaML?.caminho ||
          peca.categoria_caminho || peca.categoria_nome || peca.categoria_ml_nome
      ),
      origem: "base",
    };
  }
  const salva = lerMapaLocal(CHAVE_CATEGORIA_ML)[chaveProduto(anuncio?.codigo || anuncio?.oem)];
  if (salva?.id) {
    return { id: salva.id, caminho: limparCampoTexto(salva.caminho), origem: "escolhida" };
  }
  return null;
}

// =====================================================
// NOME DA PEÇA → núcleo (usado para detectar conflito Base × título).
// A categoria do ML é decidida em services/categoriaML.js (09/10/2026):
// o PAIIA nunca escolhe sozinho.
// =====================================================

function formatarCompatibilidadesLegiveis(
  aplicacoes = [],
  textoOriginal = ""
) {
  if (
    !Array.isArray(aplicacoes) ||
    aplicacoes.length === 0
  ) {
    return String(
      textoOriginal || ""
    )
      .replace(/\uFFFD/g, "")
      .trim();
  }

  const limpar = (valor) =>
    String(valor || "")
      .replace(/\uFFFD/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const vistos = new Set();
  const registrosUnicos = [];

  aplicacoes.forEach((item) => {
    const montadora =
      limpar(
        item?.montadora ||
        item?.marca_veiculo ||
        item?.marcaVeiculo ||
        item?.marca
      );

    const modelo =
      limpar(
        item?.modelo ||
        item?.veiculo ||
        item?.modelo_veiculo ||
        item?.modeloVeiculo
      );

    const motor =
      limpar(
        item?.motor ||
        item?.motorizacao ||
        item?.motor_descricao
      );

    const anoInicio =
      limpar(
        item?.ano_inicio ||
        item?.anoInicial ||
        item?.ano_de ||
        item?.anoDe
      );

    const anoFim =
      limpar(
        item?.ano_fim ||
        item?.anoFinal ||
        item?.ano_ate ||
        item?.anoAte
      );

    const chave = [
      montadora,
      modelo,
      motor,
      anoInicio,
      anoFim,
    ]
      .join("|")
      .toUpperCase();

    if (!chave.replace(/\|/g, "")) {
      return;
    }

    if (vistos.has(chave)) {
      return;
    }

    vistos.add(chave);

    registrosUnicos.push({
      montadora,
      modelo,
      motor,
      anoInicio,
      anoFim,
    });
  });

  registrosUnicos.sort(
    (a, b) => {
      return (
        a.montadora.localeCompare(
          b.montadora,
          "pt-BR"
        ) ||
        a.modelo.localeCompare(
          b.modelo,
          "pt-BR"
        ) ||
        a.motor.localeCompare(
          b.motor,
          "pt-BR"
        )
      );
    }
  );

  const grupos = {};

  registrosUnicos.forEach(
    (item) => {
      const montadora =
        item.montadora ||
        "OUTROS";

      if (!grupos[montadora]) {
        grupos[montadora] = [];
      }

      grupos[montadora].push(
        item
      );
    }
  );

  const blocos = [];

  Object.entries(grupos).forEach(
    ([montadora, itens]) => {
      blocos.push(
        montadora.toUpperCase()
      );

      itens.forEach((item) => {
        let bloco =
          `• ${
            item.modelo ||
            "Modelo não informado"
          }`;

        if (item.motor) {
          bloco +=
            `\n  Motor: ${item.motor}`;
        }

        // Só o período CONFIRMADO: nada de "até Atual" ou ano inventado.
        if (item.anoInicio && item.anoFim) {
          bloco +=
            item.anoInicio === item.anoFim
              ? `\n  Período: ${item.anoInicio}`
              : `\n  Período: ${item.anoInicio} até ${item.anoFim}`;
        } else if (item.anoInicio) {
          bloco += `\n  Período: a partir de ${item.anoInicio}`;
        } else if (item.anoFim) {
          bloco += `\n  Período: até ${item.anoFim}`;
        }

        blocos.push(bloco);
      });

      blocos.push("");
    }
  );

  return blocos
    .join("\n\n")
    .trim();
}
function sugerirCategoriaPorTitulo(
  titulo = ""
) {
  const texto =
    normalizarTexto(titulo);

  if (
    texto.includes("sensor map") ||
    texto.includes("sensor de pressao") ||
    texto.includes("sensor pressão")
  ) {
    return (
      "Acessórios para Veículos > " +
      "Peças de Carros e Caminhonetes > " +
      "Injeção > Sensores > Sensor MAP"
    );
  }

  if (
    texto.includes("sonda lambda") ||
    texto.includes("sensor oxigenio") ||
    texto.includes("sensor de oxigenio")
  ) {
    return (
      "Acessórios para Veículos > " +
      "Peças de Carros e Caminhonetes > " +
      "Injeção > Sonda Lambda"
    );
  }

  if (
    texto.includes("bico injetor") ||
    texto.includes("injetor")
  ) {
    return (
      "Acessórios para Veículos > " +
      "Peças de Carros e Caminhonetes > " +
      "Injeção > Bicos Injetores"
    );
  }

  if (
    texto.includes("bomba de combustivel") ||
    texto.includes("bomba combustível")
  ) {
    return (
      "Acessórios para Veículos > " +
      "Peças de Carros e Caminhonetes > " +
      "Injeção > Bombas de Combustível"
    );
  }

  if (
    texto.includes("bobina")
  ) {
    return (
      "Acessórios para Veículos > " +
      "Peças de Carros e Caminhonetes > " +
      "Ignição > Bobinas"
    );
  }

  if (
    texto.includes("vela de ignicao") ||
    texto.includes("vela ignicao")
  ) {
    return (
      "Acessórios para Veículos > " +
      "Peças de Carros e Caminhonetes > " +
      "Ignição > Velas"
    );
  }

  return "";
}

function obterUrlFoto(foto) {
  if (typeof foto === "string") {
    return foto;
  }

  return (
    foto?.imagem_processada ||
    foto?.imagem_original ||
    foto?.url ||
    foto?.src ||
    ""
  );
}

function obterDimensoesFoto(url) {
  return new Promise((resolve) => {
    if (!url) {
      resolve({
        largura: 0,
        altura: 0,
        ok: false,
        aberta: false,
        quadrada: false,
      });
      return;
    }

    const imagem = new Image();

    imagem.onload = () => {
      const largura =
        Number(imagem.naturalWidth || 0);

      const altura =
        Number(imagem.naturalHeight || 0);

      resolve({
        largura,
        altura,
        ok:
          largura >= 1200 &&
          altura >= 1200,
        aberta: true,
        quadrada:
          largura > 0 &&
          largura === altura,
      });
    };

    imagem.onerror = () => {
      resolve({
        largura: 0,
        altura: 0,
        ok: false,
        aberta: false,
        quadrada: false,
      });
    };

    imagem.src = url;
  });
}

// Mesma imagem (endereço igual, sem parâmetros) = foto repetida.
function chaveFoto(url) {
  return String(url || "")
    .split("#")[0]
    .split("?")[0]
    .trim()
    .toLowerCase();
}

// De onde vem a imagem usada no anúncio (somente informação; nada é alterado).
function origemFoto(foto) {
  if (typeof foto === "string") return "Endereço (URL)";
  if (foto?.imagem_processada) return "Processada (Foto IA PAIIA)";
  if (foto?.imagem_original) return "Original (sem processamento)";
  if (foto?.url || foto?.src) return "Endereço (URL)";
  return "—";
}

function numeroPositivo(valor) {
  const n = Number(String(valor ?? "").replace(",", "."));
  return Number.isFinite(n) && n > 0;
}

function ConferenciaPAIIA({
  usuario,
  setScreen,
}) {
  const anuncio = useMemo(() => {
    let dadosLocal = null;

    try {
      const salvo =
        localStorage.getItem(
          "mlAnuncioTeste"
        );

      dadosLocal =
        salvo
          ? JSON.parse(salvo)
          : null;
    } catch (erro) {
      console.warn(
        "Não foi possível ler mlAnuncioTeste:",
        erro
      );
    }

    const dadosMemoria =
      window.__paiiaAnuncioSimulador &&
      typeof window.__paiiaAnuncioSimulador ===
        "object"
        ? window.__paiiaAnuncioSimulador
        : null;

    // Memória de OUTRA ficha (aba usada antes para outro anúncio) nunca se
    // mistura com o anúncio levado à Conferência.
    if (
      dadosMemoria &&
      dadosLocal &&
      !simuladorEhDoAnuncio(dadosMemoria, dadosLocal)
    ) {
      return dadosLocal;
    }

    if (
      dadosMemoria &&
      dadosLocal
    ) {
      return {
        ...dadosLocal,
        ...dadosMemoria,

        fotos:
          Array.isArray(
            dadosMemoria?.fotos
          ) &&
          dadosMemoria.fotos.length > 0
            ? dadosMemoria.fotos
            : Array.isArray(
                dadosLocal?.fotos
              )
              ? dadosLocal.fotos
              : [],

        imagens:
          Array.isArray(
            dadosMemoria?.imagens
          ) &&
          dadosMemoria.imagens.length > 0
            ? dadosMemoria.imagens
            : Array.isArray(
                dadosLocal?.imagens
              )
              ? dadosLocal.imagens
              : [],

        aplicacoes:
          Array.isArray(
            dadosMemoria?.aplicacoes
          ) &&
          dadosMemoria.aplicacoes.length > 0
            ? dadosMemoria.aplicacoes
            : Array.isArray(
                dadosLocal?.aplicacoes
              )
              ? dadosLocal.aplicacoes
              : [],

        pecaEncontrada:
          dadosMemoria?.pecaEncontrada ||
          dadosLocal?.pecaEncontrada ||
          null,
      };
    }

    return (
      dadosMemoria ||
      dadosLocal ||
      null
    );
  }, []);

  // Ficha persistente deste anúncio (por código). Ver CHAVE_CONFERENCIA.
  const chaveConferencia = chaveProduto(anuncio?.codigo || anuncio?.oem);
  // Ficha criada já no NOVO ANÚNCIO: a Conferência continua NELA (mesmo ID).
  const fichaIdDoAnuncio = idFichaValido(anuncio?.fichaIdPAIIA) ? String(anuncio.fichaIdPAIIA) : "";
  const [fichaSalva] = useState(() => {
    const local = chaveConferencia ? lerMapaLocal(CHAVE_CONFERENCIA)[chaveConferencia] || null : null;
    // Cópia local de OUTRA ficha do mesmo código não é usada nesta.
    const idLocal = String(local?.campos?.anuncioIdPAIIA || "");
    if (fichaIdDoAnuncio && idLocal && idLocal !== fichaIdDoAnuncio) return null;
    return local;
  });
  // Dados técnicos editados no NOVO ANÚNCIO (mesma ficha): tipo de veículo e
  // peso/medidas. Ficha sem Conferência: só preenche. Com Conferência: o que
  // foi editado lá DEPOIS é edição real (avisa e pede reconferência).
  const [edicoesNA] = useState(() => edicoesDoNovoAnuncio({ anuncio, fichaSalva }));
  // Registro ÚNICO de frete × precificação (Novo Anúncio): a Conferência
  // usa ESTE (não calcula outro frete); vale o mais recente da mesma ficha.
  const [registroFreteConf] = useState(() => {
    const a = anuncio?.freteML && typeof anuncio.freteML === "object" ? anuncio.freteML : null;
    const f = fichaSalva?.campos?.freteML && typeof fichaSalva.campos.freteML === "object" ? fichaSalva.campos.freteML : null;
    if (a && f) return String(a.calculado_em || "") >= String(f.calculado_em || "") ? a : f;
    return a || f || null;
  });
  const camposEditadosNoNovoAnuncioRef = useRef(
    edicoesNA.campos.flatMap((c) => CAMPOS_ASSINATURA_TECNICOS[c] || [])
  );
  // Versão (dados_conferencia.salvo_em) da ficha da base que esta tela leu ou
  // gravou por último. Toda gravação confere: se a base estiver em outra
  // versão (outra aba/computador gravou depois), NADA é gravado — uma cópia
  // antiga nunca sobrescreve a ficha mais nova.
  const versaoFichaRef = useRef({
    id: String(fichaSalva?.campos?.anuncioIdPAIIA || ""),
    versao: String(fichaSalva?.versaoBase || ""),
  });
  const versaoEsperadaPara = (id) => (id && versaoFichaRef.current.id === id ? versaoFichaRef.current.versao : "");
  const conflitoFichaRef = useRef(false);
  // EDIÇÃO REAL DO USUÁRIO. Abrir, F5, Voltar, Central ou ?ficha= são
  // LEITURA: só uma edição real (ou ação explícita do fluxo, como aprovar)
  // grava a ficha ou derruba a aprovação. Carregar, normalizar, sugerir
  // ou preencher automaticamente NÃO conta como edição.
  const usuarioEditouRef = useRef(false);
  function marcarInteracao(e) {
    if (!e || !e.isTrusted) return;
    const alvo = e.target && e.target.closest ? e.target : null;
    if (alvo && alvo.closest("[data-paiia-navegacao]")) return;
    if (e.type === "click" && !(alvo && alvo.closest("button,[role=button],input,select,textarea,label"))) return;
    usuarioEditouRef.current = true;
  }
  const propsInteracao = { onInputCapture: marcarInteracao, onChangeCapture: marcarInteracao, onClickCapture: marcarInteracao };
  // Primeira gravação da Conferência numa ficha que ainda não tem a
  // Conferência salva (abrir a Conferência deste anúncio é a ação explícita).
  const gravacaoInicialPermitidaRef = useRef(!fichaSalva);
  // Conflito de versões: NUNCA resolvido sozinho; as duas versões ficam.
  const [conflito, setConflito] = useState(null);
  const [resolvendoConflito, setResolvendoConflito] = useState("");
  // Indicador: salvando | salvo | nao_salvo | conflito.
  const [gravacao, setGravacao] = useState(() => ({ estado: fichaSalva?.versaoBase ? ESTADO_GRAVACAO.SALVO : "", erro: "" }));
  const [gravacaoPendente, setGravacaoPendente] = useState(false);
  // Aviso quando uma edição real invalida a Conferência.
  const [avisoAprovacao, setAvisoAprovacao] = useState("");
  // Campos que já estavam diferentes da aprovação ao carregar (formato,
  // normalização, sugestão): nunca derrubam a aprovação.
  const divergentesNoCarregamentoRef = useRef([]);
  // Assinatura da Conferência como estava antes da 1ª edição real.
  const assinaturaCarregadaRef = useRef("");
  // Depois de CADA gravação confirmada, a cópia local passa a partir da
  // versão devolvida pela base: a própria aba nunca conflita consigo mesma.
  function atualizarVersaoLocal(id, versao) {
    if (!chaveConferencia || !versao) return;
    try {
      const mapa = lerMapaLocal(CHAVE_CONFERENCIA);
      const atual = mapa[chaveConferencia];
      if (!atual) return;
      const idLocal = String(atual?.campos?.anuncioIdPAIIA || "");
      if (id && idLocal && idLocal !== String(id)) return;
      mapa[chaveConferencia] = { ...atual, versaoBase: String(versao) };
      localStorage.setItem(CHAVE_CONFERENCIA, JSON.stringify(mapa));
    } catch {
      // sem espaço: a versão fica na memória desta tela
    }
  }
  // Gravações da ficha (rascunho e ficha aprovada) uma de cada vez: a versão
  // lida por uma é a gravada pela anterior.
  const filaGravacaoRef = useRef(Promise.resolve());
  function naFilaDeGravacao(tarefa) {
    const p = filaGravacaoRef.current.then(tarefa, tarefa);
    filaGravacaoRef.current = p.catch(() => {});
    return p;
  }
  const origemConferenciaRef = useRef({});
  function inicial(campo, doAnuncio) {
    origemConferenciaRef.current[campo] = doAnuncio;
    return valorPreservado(fichaSalva, campo, doAnuncio);
  }

  const [
    bannerAtual,
    setBannerAtual,
  ] = useState(() => {
    return (
      anuncio?.banner ||
      localStorage.getItem(
        "bannerPronto"
      ) ||
      localStorage.getItem(
        "bannerSelecionado"
      ) ||
      ""
    );
  });

  const [
    clipAtual,
    setClipAtual,
  ] = useState(() => {
    return (
      anuncio?.clip ||
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
    bannersSelecionados,
    setBannersSelecionados,
  ] = useState(() => {
    try {
      const salvo =
        localStorage.getItem(
          "bannersSelecionadosPublicacao"
        );

      const lista =
        salvo
          ? JSON.parse(salvo)
          : [];

      if (
        Array.isArray(lista) &&
        lista.length > 0
      ) {
        return lista;
      }
    } catch {}

    return bannerAtual
      ? [bannerAtual]
      : [];
  });

  const [
    clipsSelecionados,
    setClipsSelecionados,
  ] = useState(() => {
    try {
      const salvo =
        localStorage.getItem(
          "clipsSelecionadosPublicacao"
        );

      const lista =
        salvo
          ? JSON.parse(salvo)
          : [];

      if (
        Array.isArray(lista) &&
        lista.length > 0
      ) {
        return lista;
      }
    } catch {}

    return clipAtual
      ? [clipAtual]
      : [];
  });

  useEffect(() => {
    function sincronizarMidiasSelecionadas() {
      try {
       const midiasTemporarias =
  window.__paiiaMidiasPublicacao ||
  {};

const bannersLocal =
  JSON.parse(
    localStorage.getItem(
      "bannersSelecionadosPublicacao"
    ) || "[]"
  );

const clipsLocal =
  JSON.parse(
    localStorage.getItem(
      "clipsSelecionadosPublicacao"
    ) || "[]"
  );

const banners =
  Array.isArray(
    midiasTemporarias.banners
  ) &&
  midiasTemporarias.banners.length > 0
    ? midiasTemporarias.banners
    : bannersLocal;

const clips =
  Array.isArray(
    midiasTemporarias.clips
  ) &&
  midiasTemporarias.clips.length > 0
    ? midiasTemporarias.clips
    : clipsLocal;

        setBannersSelecionados(
          Array.isArray(banners)
            ? banners
            : []
        );

        setClipsSelecionados(
          Array.isArray(clips)
            ? clips
            : []
        );

        if (
          Array.isArray(banners) &&
          banners.length > 0
        ) {
          setBannerAtual(
            banners[
              banners.length - 1
            ]
          );
        }

        if (
          Array.isArray(clips) &&
          clips.length > 0
        ) {
          setClipAtual(
            clips[
              clips.length - 1
            ]
          );
        }
      } catch (erro) {
        console.error(
          "Erro ao sincronizar mídias selecionadas:",
          erro
        );
      }
    }

    sincronizarMidiasSelecionadas();

    window.addEventListener(
      "focus",
      sincronizarMidiasSelecionadas
    );

    return () => {
      window.removeEventListener(
        "focus",
        sincronizarMidiasSelecionadas
      );
    };
  }, []);

  function removerBannerSelecionado(
    url
  ) {
    const novas =
      bannersSelecionados.filter(
        (item) =>
          item !== url
      );

    setBannersSelecionados(
      novas
    );

    localStorage.setItem(
      "bannersSelecionadosPublicacao",
      JSON.stringify(novas)
    );

    setBannerAtual(
      novas[
        novas.length - 1
      ] || ""
    );
  }

  function removerClipSelecionado(
    url
  ) {
    const novos =
      clipsSelecionados.filter(
        (item) =>
          item !== url
      );

    setClipsSelecionados(
      novos
    );

    localStorage.setItem(
      "clipsSelecionadosPublicacao",
      JSON.stringify(novos)
    );

    setClipAtual(
      novos[
        novos.length - 1
      ] || ""
    );
  }

  const [
    statusClipAtual,
    setStatusClipAtual,
  ] = useState(() => {
    return (
      localStorage.getItem(
        "clipGeracaoStatus"
      ) || ""
    );
  });

  const [
    mensagemClipAtual,
    setMensagemClipAtual,
  ] = useState(() => {
    return (
      localStorage.getItem(
        "clipGeracaoMensagem"
      ) || ""
    );
  });

  function sincronizarClipDoAnuncio() {
    const status =
      localStorage.getItem(
        "clipGeracaoStatus"
      ) || "";

    const mensagem =
      localStorage.getItem(
        "clipGeracaoMensagem"
      ) || "";

    const clipRemovido =
      localStorage.getItem(
        "clipRemovidoPublicacao"
      ) === "true";

    const clipEncontrado =
      clipRemovido
        ? ""
        : (
            localStorage.getItem(
              "clipPronto"
            ) ||
            localStorage.getItem(
              "clipSelecionado"
            ) ||
            anuncio?.clip ||
            ""
          );

    setStatusClipAtual(status);
    setMensagemClipAtual(mensagem);

    if (clipEncontrado) {
      setClipAtual(
        clipEncontrado
      );

      try {
        const salvo =
          localStorage.getItem(
            "mlAnuncioTeste"
          );

        if (salvo) {
          const dados =
            JSON.parse(salvo);

          if (
            dados?.clip !==
            clipEncontrado
          ) {
            localStorage.setItem(
              "mlAnuncioTeste",
              JSON.stringify({
                ...dados,
                clip:
                  clipEncontrado,
              })
            );
          }
        }
      } catch (erro) {
        console.error(
          "Erro ao atualizar Clip no simulador:",
          erro
        );
      }
    }
  }

  useEffect(() => {
    sincronizarClipDoAnuncio();

    const intervalo =
      window.setInterval(
        sincronizarClipDoAnuncio,
        2000
      );

    function aoClipPronto() {
      sincronizarClipDoAnuncio();
    }

    function aoClipErro() {
      sincronizarClipDoAnuncio();
    }

    window.addEventListener(
      "appia:clip-pronto",
      aoClipPronto
    );

    window.addEventListener(
      "appia:clip-erro",
      aoClipErro
    );

    return () => {
      window.clearInterval(
        intervalo
      );

      window.removeEventListener(
        "appia:clip-pronto",
        aoClipPronto
      );

      window.removeEventListener(
        "appia:clip-erro",
        aoClipErro
      );
    };
  }, []);

useEffect(() => {
  const retornarParaMidias =
    localStorage.getItem(
      "retornarParaMidiasPublicacao"
    ) === "true";

  if (retornarParaMidias) {
    localStorage.removeItem(
      "retornarParaMidiasPublicacao"
    );

    window.setTimeout(() => {
      const secao =
        document.getElementById(
          "secao-midias-publicacao"
        );

      secao?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 250);

    return;
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
}, []);

const [
  fotos,
  setFotos,
] = useState(() => {
  // Fotos em memória SÓ da MESMA ficha (dono = ID da ficha/código). Memória
  // de outro anúncio (aba usada antes) é ignorada: valem as fotos DESTE.
  let fotosIniciais = fotosIniciaisConferencia({
    memoria: window.__paiiaFotosPublicacao,
    donoMemoria: window[MEMORIA_FOTOS_DONO],
    anuncio,
  }).fotos;

  const bannerUrl =
    window.__paiiaBannerParaFotos ||
    "";

  if (bannerUrl) {
    const jaExiste =
      fotosIniciais.some(
        (foto) =>
          obterUrlFoto(foto) ===
          bannerUrl
      );

    if (
      !jaExiste &&
      fotosIniciais.length < 6
    ) {
      fotosIniciais.push({
        id:
          `banner-${Date.now()}`,

        imagem_processada:
          bannerUrl,

        imagem_original:
          bannerUrl,

        tipo:
          "banner",

        created_at:
          new Date().toISOString(),
      });
    }

    window.__paiiaBannerParaFotos =
      "";
  }

  guardarFotosEmMemoria(window, fotosIniciais, anuncio);

  return fotosIniciais;
});
function salvarFotosNoSimulador(
  novasFotos
) {
  const lista =
    Array.isArray(novasFotos)
      ? novasFotos
      : [];

  setFotos(lista);

  // =====================================================
  // FOTOS DA PUBLICAÇÃO
  // Guardamos em memória para não estourar localStorage.
  // =====================================================
  guardarFotosEmMemoria(window, lista, anuncio);
  // Toda mudança de fotos nesta tela é ação do usuário (botões): intencional.
  setFotosConfirmadasNaTela(true);

  try {
    const salvo =
      localStorage.getItem(
        "mlAnuncioTeste"
      );

    const base =
      salvo
        ? JSON.parse(salvo)
        : {};

    // NÃO gravamos fotos aqui.
    // Banner pode ser base64 e estourar o Storage.
    const {
      fotos: _fotosAntigas,
      ...baseLimpa
    } = base;

    localStorage.setItem(
      "mlAnuncioTeste",
      JSON.stringify(
        baseLimpa
      )
    );
  } catch (erro) {
    console.warn(
      "Estado leve preservado. Fotos mantidas em memória:",
      erro
    );
  }
}
function escolherBannerParaFotos(
  banner
) {
  const url =
    banner?.imagem_processada ||
    banner?.imagem_original ||
    "";

  if (!url) {
    alert(
      "Este banner não possui imagem válida."
    );
    return;
  }

  const jaExiste =
    fotos.some(
      (foto) =>
        obterUrlFoto(foto) === url
    );

  if (jaExiste) {
    alert(
      "✅ Este banner já está nas fotos."
    );
    return;
  }

  if (fotos.length >= 6) {
    alert(
      "⚠️ O anúncio já possui 6 imagens. Remova uma foto antes de adicionar o banner."
    );
    return;
  }

  const novasFotos = [
    ...fotos,
    {
      id:
        `banner-${Date.now()}`,

      imagem_processada:
        url,

      imagem_original:
        banner?.imagem_original ||
        url,

      tipo:
        "banner",

      created_at:
        banner?.created_at ||
        new Date().toISOString(),
    },
  ];

  salvarFotosNoSimulador(
    novasFotos
  );
}

function moverFoto(
    index,
    direcao
  ) {
    const destino =
      index + direcao;

    if (
      destino < 0 ||
      destino >= fotos.length
    ) {
      return;
    }

    const novas = [
      ...fotos,
    ];

    const atual =
      novas[index];

    novas[index] =
      novas[destino];

    novas[destino] =
      atual;

    salvarFotosNoSimulador(
      novas
    );
  }

  function excluirFotoPublicacao(
    index
  ) {
    const item =
      fotos[index];

    const url =
      obterUrlFoto(item);

    const novas =
      fotos.filter(
        (_, indice) =>
          indice !== index
      );

    salvarFotosNoSimulador(
      novas
    );

    if (
      url &&
      bannersSelecionados.includes(
        url
      )
    ) {
      removerBannerSelecionado(
        url
      );
    }
  }

  function trocarFotoPublicacao(
    index
  ) {
    const input =
      document.createElement(
        "input"
      );

    input.type = "file";
    input.accept =
      "image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp";

    input.onchange = () => {
      const arquivo =
        input.files?.[0];

      if (!arquivo) {
        return;
      }

      if (
        !String(
          arquivo.type || ""
        ).startsWith(
          "image/"
        )
      ) {
        alert(
          "Selecione uma imagem."
        );
        return;
      }

      const url =
        URL.createObjectURL(
          arquivo
        );

      const novas = [
        ...fotos,
      ];

      const anterior =
        obterUrlFoto(
          novas[index]
        );

      novas[index] = {
        id:
          `foto-trocada-${Date.now()}`,
        imagem_processada:
          url,
        tipo: "foto",
        nome:
          arquivo.name,
      };

      salvarFotosNoSimulador(
        novas
      );

      if (
        anterior &&
        bannersSelecionados.includes(
          anterior
        )
      ) {
        removerBannerSelecionado(
          anterior
        );
      }
    };

    input.click();
  }

  const [
    dimensoesFotos,
    setDimensoesFotos,
  ] = useState([]);

  const [
    validandoFotos,
    setValidandoFotos,
  ] = useState(false);

  // Fotos repetidas: mesma imagem mais de uma vez no anúncio.
  const indicesRepetidos = useMemo(() => {
    const vistos = new Map();
    const repetidos = new Set();
    fotos.forEach((foto, indice) => {
      const chave = chaveFoto(obterUrlFoto(foto));
      if (!chave) return;
      if (vistos.has(chave)) {
        repetidos.add(indice);
        repetidos.add(vistos.get(chave));
      } else {
        vistos.set(chave, indice);
      }
    });
    return repetidos;
  }, [fotos]);

  // Contas Mercado Livre (somente leitura) para o passo seguinte à conferência.
  const estadoContasML = useContasML();
  const contasMLDisponiveis = contasMLConectadas(estadoContasML);
  const contaMLAtivaConferencia =
    contasMLDisponiveis.find((c) => c.ativa) || null;

  // Conta Mercado Livre de DESTINO deste anúncio (marketplaceAccountId).
  // Pertence ao anúncio (fica na ficha dele), não à "conta ativa" global:
  // trabalhar com outra conta em outro computador não muda este destino.
  const [contaDestinoML, setContaDestinoML] = useState(() =>
    String(fichaSalva?.campos?.contaDestinoML || "")
  );
  // ID da ficha deste anúncio na base PAIIA (paiia_anuncios). A conta de
  // destino verdadeira é lida/gravada lá; aqui fica só o cache do ID.
  const [anuncioIdPAIIA, setAnuncioIdPAIIA] = useState(() =>
    String(fichaSalva?.campos?.anuncioIdPAIIA || fichaIdDoAnuncio || "")
  );
  // =====================================================
  // FOTOS POR ID DA FICHA (services/fotosDaFicha). Lê a ficha na base (só
  // LEITURA) para saber as fotos do Novo Anúncio DESTA ficha, a marca e o
  // histórico das fotos da Conferência. Abrir nunca grava nada.
  //  - Fotos sem relação com esta ficha: aprovação e publicação bloqueadas
  //    até o usuário escolher (usar as do Novo Anúncio ou confirmar).
  //  - Fotos de outro anúncio que estavam gravadas: ignoradas ao abrir e
  //    guardadas no histórico da ficha na próxima gravação (nada apagado).
  // =====================================================
  const [fotosNovoAnuncioFicha, setFotosNovoAnuncioFicha] = useState(() =>
    anuncioIdPAIIA ? null : listaUrls(anuncio?.fotos)
  );
  const [fotosDaBase, setFotosDaBase] = useState({ lida: false, marca: String(fichaSalva?.campos?.fotosFichaId || ""), fotos: listaUrls(fichaSalva?.campos?.fotos), historico: Array.isArray(fichaSalva?.campos?.fotosHistorico) ? fichaSalva.campos.fotosHistorico : [], ignoradas: [], motivoIgnoradas: "", erro: "" });
  const [fotosConfirmadasNaTela, setFotosConfirmadasNaTela] = useState(false);
  const [ignoradasRestauradas, setIgnoradasRestauradas] = useState(false);
  useEffect(() => {
    const id = anuncioIdPAIIA;
    if (!id) return undefined;
    let ativo = true;
    (async () => {
      const r = await obterAnuncio(id).catch(() => null);
      if (!ativo) return;
      if (!r?.ok) {
        setFotosNovoAnuncioFicha([]);
        setFotosDaBase((b) => ({ ...b, lida: true, erro: "Não foi possível reler a ficha na base para conferir as fotos." }));
        return;
      }
      const d = r.anuncio?.dados_conferencia || {};
      const campos = d.ficha?.campos || {};
      const conferido = d.ficha?.anuncioConferido || null;
      const fotosConf = listaUrls(campos.fotos).length ? campos.fotos : conferido?.fotos;
      const dec = decidirFotosDaFicha({ fichaId: id, fotosConferencia: fotosConf, marcaConferencia: campos.fotosFichaId || conferido?.fotosFichaId || "", fotosNovoAnuncio: d.novo_anuncio?.fotos });
      setFotosNovoAnuncioFicha(listaUrls(d.novo_anuncio?.fotos));
      setFotosDaBase({
        lida: true,
        marca: String(campos.fotosFichaId || conferido?.fotosFichaId || ""),
        fotos: listaUrls(fotosConf),
        historico: Array.isArray(campos.fotosHistorico) ? campos.fotosHistorico : [],
        ignoradas: dec.ignoradas,
        motivoIgnoradas: dec.motivo,
        erro: "",
      });
    })();
    return () => { ativo = false; };
  }, [anuncioIdPAIIA]);
  const situacaoFotos = situacaoFotosNaTela({
    fichaId: anuncioIdPAIIA,
    fotosTela: fotos,
    fotosNovoAnuncio: fotosNovoAnuncioFicha,
    marcaBase: fotosDaBase.marca,
    fotosBase: fotosDaBase.fotos,
    confirmadasNaTela: fotosConfirmadasNaTela,
  });
  if (fotosDaBase.erro && situacaoFotos.estado === "confirmar") situacaoFotos.motivo = `${fotosDaBase.erro} Confirme que estas fotos são deste anúncio.`;
  const ignoradasNaAbertura = !ignoradasRestauradas && fotosDaBase.ignoradas.length && !listaUrls(fotos).some((u) => fotosDaBase.ignoradas.includes(u)) ? fotosDaBase.ignoradas : [];
  // Ficha aprovada gravada na base PAIIA (fonte da recuperação no F5).
  const [fichaBase, setFichaBase] = useState({ pronta: false, erro: "" });
  // Rascunho desta Conferência já confirmado na base (mesmo ID): só então o
  // endereço passa a ter ?ficha=<ID>. Ficha recuperada pelo F5 já vem confirmada.
  const [fichaConfirmada, setFichaConfirmada] = useState(() =>
    Boolean(window.__paiiaFichaRecuperada) && window.__paiiaFichaRecuperada === String(fichaSalva?.campos?.anuncioIdPAIIA || "")
  );
  const [avisoRascunho, setAvisoRascunho] = useState("");
  const fichaBaseGravadaRef = useRef("");
  // Uma gravação por vez (o modo de desenvolvimento roda efeitos 2x; sem
  // esta trava saíam duas fichas iguais no mesmo segundo).
  const gravandoFichaRef = useRef(false);
  const montadoRef = useRef(true);
  useEffect(() => {
    montadoRef.current = true;
    return () => { montadoRef.current = false; };
  }, []);
  const contaDestinoConectada = contasMLDisponiveis.some(
    (c) => String(c.ml_user_id) === contaDestinoML
  );
  // Simulação de frete/peso: usa a conta de destino do anúncio; enquanto ela
  // não foi escolhida, a conta ativa serve só para a simulação (leitura).
  const contaSimulacaoML = contaDestinoConectada
    ? contaDestinoML
    : String(contaMLAtivaConferencia?.ml_user_id || "");

  // Peso e medidas vindos do bloco PESO E EMBALAGEM (PAIIA).
  const [
    logisticaConferencia,
    setLogisticaConferencia,
  ] = useState(() => {
    // Peso/medidas digitados no Novo Anúncio (mesma ficha) entram aqui como
    // ponto de partida (a confirmar). O valor da ficha vale, salvo edição
    // feita no Novo Anúncio depois dela.
    if (edicoesNA.medida && medidaCompletaFicha(edicoesNA.medida)) {
      return { medida: { ...edicoesNA.medida }, origem: "NOVO_ANUNCIO", confirmado: false, confirmacao: null, config_embalagem: fichaSalva?.campos?.logistica?.config_embalagem || "caixa_padrao", modalidade: fichaSalva?.campos?.logistica?.modalidade || "" };
    }
    return fichaSalva?.campos?.logistica || null;
  });
  const [logisticaInicial] = useState(() => logisticaConferencia);

  // Anúncio exatamente como foi aprovado na conferência.
  const [
    anuncioConferido,
    setAnuncioConferido,
  ] = useState(() => {
    const salvo = (fichaSalva?.assinaturaAprovada && fichaSalva?.anuncioConferido) || null;
    // Fichas aprovadas antes deste campo existir: o tipo de veículo
    // aprovado fica em campos.tipoVeiculo (F5 não perde o valor).
    if (salvo && !salvo.tipoVeiculo && fichaSalva?.campos?.tipoVeiculo) {
      return { ...salvo, tipoVeiculo: fichaSalva.campos.tipoVeiculo };
    }
    return salvo;
  });
  // Assinatura do que foi aprovado: enquanto nada mudar, o "Anúncio pronto"
  // continua valendo ao voltar para a Conferência.
  const assinaturaAprovadaRef = useRef(
    (fichaSalva?.anuncioConferido && fichaSalva?.assinaturaAprovada) || ""
  );
  // Aprovação guardada quando um campo relevante muda de verdade: se o
  // usuário desfizer e os dados voltarem a ser os aprovados, ela volta.
  const aprovacaoGuardadaRef = useRef(
    (!fichaSalva?.anuncioConferido && fichaSalva?.aprovacaoAnterior?.assinatura && fichaSalva.aprovacaoAnterior) || null
  );

  // Etapa do fluxo DESTE anúncio: "conferencia" → "publicacao".
  // Fica na ficha: depois de aprovada, a Conferência não reaparece ao voltar
  // da Central/atualizar; só volta se o usuário pedir para editar/revisar
  // ou se algum dado aprovado mudar.
  const [etapaFluxo, setEtapaFluxo] = useState(() =>
    fichaSalva?.etapa === "publicacao" &&
    fichaSalva?.anuncioConferido &&
    fichaSalva?.assinaturaAprovada
      ? "publicacao"
      : "conferencia"
  );
  // Canais de publicação: a Publicação do ML (a de hoje) só aparece depois
  // que a tela "Escolher canais de publicação" libera o Mercado Livre.
  const [mercadoLivreLiberado, setMercadoLivreLiberado] = useState(false);
  function setRevisandoPublicacaoML(abrir) {
    setEtapaFluxo(abrir ? "publicacao" : "conferencia");
    window.scrollTo?.({ top: 0 });
  }

  useEffect(() => {
    let ativo = true;

    async function analisarFotos() {
      const resultados =
        await Promise.all(
          fotos.map(async (foto) => {
            const url =
              obterUrlFoto(foto);

            return {
              url,
              ...(await obterDimensoesFoto(
                url
              )),
            };
          })
        );

      if (ativo) {
        setDimensoesFotos(
          resultados
        );
      }
    }

    analisarFotos();

    return () => {
      ativo = false;
    };
  }, [fotos]);

  const [tituloAnuncio, setTituloAnuncio] =
    useState(() =>
      inicial("titulo", anuncio?.titulo || "")
    );

  const [preco, setPreco] =
    useState(() =>
      inicial("preco", String(anuncio?.preco || ""))
    );

  const [codigo, setCodigo] =
    useState(() =>
      inicial("codigo", anuncio?.codigo || "")
    );

  const [
    pesquisandoConcorrencia,
    setPesquisandoConcorrencia,
  ] = useState(false);

  const [
    resultadoConcorrencia,
    setResultadoConcorrencia,
  ] = useState(null);

  const [
    erroConcorrencia,
    setErroConcorrencia,
  ] = useState("");

  const [
    descricao,
    setDescricao,
  ] = useState(() =>
    inicial("descricao", anuncio?.descricao || "")
  );

  // Categoria vinda da base PAIIA ou guardada no navegador para o código.
  // (09/10/2026) NÃO é mais definitiva: entra como candidata HERDADA e passa
  // pela mesma conferência (services/categoriaML.js).
  const categoriaDefinida = useMemo(
    () => lerCategoriaDefinida(anuncio),
    [anuncio]
  );

  // Categoria só vale CONFIRMADA (registro categoriaDecisao na ficha). A da
  // ficha sem confirmação, a da base e a do navegador viram candidatas.
  const [{ categoriaInicial, herdadasCategoria, decisaoInicial }] = useState(() => {
    const doAnuncio = categoriaDefinida
      ? { id: categoriaDefinida.id, caminho: categoriaDefinida.caminho || categoriaDefinida.id, origem: categoriaDefinida.origem }
      : null;
    const escolhida = inicial("categoriaML", doAnuncio);
    const decisaoSalva = fichaSalva?.campos?.categoriaDecisao && typeof fichaSalva.campos.categoriaDecisao === "object" ? fichaSalva.campos.categoriaDecisao : null;
    const conf = decisaoSalva?.confirmada;
    const confirmada = conf?.id && (valorVazio(escolhida) || !escolhida?.id || escolhida.id === conf.id)
      ? { id: conf.id, caminho: conf.caminho || escolhida?.caminho || conf.id, origem: "confirmada" }
      : null;
    const herdadas = [];
    const juntar = (c, origem) => {
      if (c?.id && c.id !== confirmada?.id && !herdadas.some((h) => h.id === c.id)) herdadas.push({ id: c.id, caminho: c.caminho || "", origem });
    };
    if (!confirmada && escolhida?.id) {
      const daBase = doAnuncio && escolhida.id === doAnuncio.id;
      juntar(escolhida, daBase ? (doAnuncio.origem === "base" ? ORIGEM_CATEGORIA.BASE : ORIGEM_CATEGORIA.NAVEGADOR) : ORIGEM_CATEGORIA.FICHA);
    }
    if (doAnuncio) juntar(doAnuncio, doAnuncio.origem === "base" ? ORIGEM_CATEGORIA.BASE : ORIGEM_CATEGORIA.NAVEGADOR);
    const decisao = decisaoSalva ? (confirmada ? decisaoSalva : desfazerConfirmacao(decisaoSalva, "categoria da ficha mudou")) : null;
    return { categoriaInicial: confirmada, herdadasCategoria: herdadas, decisaoInicial: decisao };
  });
  // Registro da decisão (rastreabilidade): apresentadas, origem, escolhida,
  // data/hora, escolha manual, descartadas/rejeitadas, motivo sem GTIN.
  const [decisaoCategoria, setDecisaoCategoria] = useState(decisaoInicial);
  const decisaoCategoriaRef = useRef(decisaoInicial);
  decisaoCategoriaRef.current = decisaoCategoria;

  const [
    categoria,
    setCategoria,
  ] = useState(
    () => categoriaInicial?.caminho || categoriaInicial?.id || ""
  );

  const [
    origemCategoria,
    setOrigemCategoria,
  ] = useState(categoriaInicial?.origem || "");

  const [marca, setMarca] =
    useState(() => inicial("marca", ""));

  const [
    numeroPeca,
    setNumeroPeca,
  ] = useState(() =>
    inicial("numeroPeca", anuncio?.codigo || "")
  );

  const [gtin, setGtin] =
    useState(() => inicial("gtin", ""));

  // TIPO DE VEÍCULO (⑤): o PAIIA SUGERE (categoria + aplicações), o usuário
  // pode trocar SEMPRE. Escolha manual (origem "manual") fica salva na ficha
  // e nenhuma sugestão a sobrescreve depois.
  const [
    tipoVeiculoOrigem,
    setTipoVeiculoOrigem,
  ] = useState(() => {
    if (edicoesNA.tipoVeiculo) return ORIGEM_MANUAL; // escolhido no Novo Anúncio
    const salva = fichaSalva?.campos?.tipoVeiculoOrigem;
    if (salva === ORIGEM_MANUAL || salva === ORIGEM_SUGESTAO || salva === "padrao") return salva;
    return fichaSalva?.campos?.tipoVeiculo ? ORIGEM_SUGESTAO : "padrao";
  });
  const [
    tipoVeiculo,
    setTipoVeiculo,
  ] = useState(() => {
    // 1º o valor SALVO na ficha; 2º o escolhido no Novo Anúncio (mesma
    // ficha); sem nenhum = padrão "Carro/Caminhonete". Nunca vem de outro
    // anúncio e nunca é trocado sozinho por sugestão.
    if (edicoesNA.tipoVeiculo) {
      origemConferenciaRef.current.tipoVeiculo = edicoesNA.tipoVeiculo;
      return edicoesNA.tipoVeiculo;
    }
    const salvo = normalizarTipoVeiculo(fichaSalva?.campos?.tipoVeiculo);
    if (salvo) {
      origemConferenciaRef.current.tipoVeiculo = salvo;
      return salvo;
    }
    origemConferenciaRef.current.tipoVeiculo = TIPO_CARRO;
    return TIPO_CARRO;
  });
  function escolherTipoVeiculoManual(valor) {
    const e = escolherTipoVeiculo(valor);
    setTipoVeiculo(e.valor);
    setTipoVeiculoOrigem(e.origem);
  }

  const [
  compatibilidades,
  setCompatibilidades,
] = useState(() => {
  const aplicacoesDisponiveis =
    Array.isArray(
      anuncio?.aplicacoes
    ) &&
    anuncio.aplicacoes.length > 0
      ? anuncio.aplicacoes
      : Array.isArray(
          anuncio?.pecaEncontrada
            ?.aplicacoes
        )
        ? anuncio.pecaEncontrada
            .aplicacoes
        : [];

  return inicial("compatibilidades", formatarCompatibilidadesLegiveis(
    aplicacoesDisponiveis,
    anuncio?.compatibilidades || ""
  ));
});

const [
  observacaoCompatibilidade,
  setObservacaoCompatibilidade,
] = useState(() =>
  inicial("observacaoCompatibilidade", anuncio?.observacaoCompatibilidade || "")
);

// Aplicações confirmadas: base/catálogo (automática) + cadastradas e
// confirmadas pelo usuário (manual). Nada é completado por suposição.
const produtoAtual = chaveProduto(anuncio?.codigo || anuncio?.oem);
// Aplicações manuais antigas com VÁRIOS modelos numa linha (sem motor/ano)
// viram "modelos confirmados sem detalhes" — nada é inventado nem apagado.
const [legadoAplicacoes] = useState(() => {
  const salvas = lerMapaLocal(CHAVE_APLICACOES_MANUAIS)[produtoAtual];
  const lista = Array.isArray(salvas) ? salvas.map((a) => normalizarAplicacao(a, "manual")).filter(Boolean) : [];
  return separarAplicacoesLegadas(lista);
});
const [aplicacoesManuais, setAplicacoesManuais] = useState(() => legadoAplicacoes.detalhadas);
// Aplicações vindas da base que o usuário removeu/editou NESTE anúncio.
const [aplicacoesBaseExcluidas, setAplicacoesBaseExcluidas] = useState(() => inicial("aplicacoesBaseExcluidas", []) || []);
const [novosModelos, setNovosModelos] = useState({ montadora: "", modelos: "" });
const [modeloEditando, setModeloEditando] = useState({ indice: -1, montadora: "", modelo: "" });
const [aplicacaoEditando, setAplicacaoEditando] = useState(null);
const NOVA_APLICACAO_VAZIA = { montadora: "", modelo: "", motor: "", anoInicio: "", anoFim: "", versao: "" };
const [novaAplicacao, setNovaAplicacao] = useState(NOVA_APLICACAO_VAZIA);
const [avisoNovaAplicacao, setAvisoNovaAplicacao] = useState("");

const aplicacoesCompatibilidade =
  Array.isArray(
    anuncio?.aplicacoes
  ) &&
  anuncio.aplicacoes.length > 0
    ? anuncio.aplicacoes
    : Array.isArray(
        anuncio?.pecaEncontrada
          ?.aplicacoes
      )
      ? anuncio.pecaEncontrada
          .aplicacoes
      : [];

// Base/catálogo: linha SÓ com montadora + modelo(s) (sem motor, ano e versão)
// é "modelo confirmado sem detalhes" — vai para a área própria, nunca para a
// lista detalhada nem para a tabela oficial do ML. Nada é inventado.
const aplicacoesBaseSeparadas = useMemo(
  () => separarAplicacoesBase(aplicacoesCompatibilidade.map((a) => normalizarAplicacao(a, "base")).filter(Boolean)),
  [anuncio] // eslint-disable-line react-hooks/exhaustive-deps
);
const aplicacoesBaseTodas = aplicacoesBaseSeparadas.detalhadas;
// Modelos confirmados SEM detalhes (montadora + modelo; sem ano/motor/versão).
// Os da base SEMPRE voltam (também em fichas salvas antes desta regra), salvo
// os que o usuário removeu/editou neste anúncio (ficam em aplicacoesBaseExcluidas).
const chaveModeloBase = (m) => chaveAplicacao({ montadora: m?.montadora, modelo: m?.modelo });
const chavesModelosBase = new Set(aplicacoesBaseSeparadas.modelos.map(chaveModeloBase));
const [modelosSemDetalhes, setModelosSemDetalhes] = useState(() =>
  juntarModelos(
    inicial("modelosSemDetalhes", []) || [],
    legadoAplicacoes.modelos,
    aplicacoesBaseSeparadas.modelos.filter((m) => !aplicacoesBaseExcluidas.includes(chaveModeloBase(m)))
  )
);
function excluirModeloDaBase(m) {
  const k = chaveModeloBase(m);
  if (chavesModelosBase.has(k)) setAplicacoesBaseExcluidas((prev) => [...new Set([...prev, k])]);
}
const aplicacoesBase = useMemo(
  () => aplicacoesBaseTodas.filter((a) => !aplicacoesBaseExcluidas.includes(chaveAplicacao(a))),
  [aplicacoesBaseTodas, aplicacoesBaseExcluidas]
);
const aplicacoesConfirmadas = useMemo(
  () => juntarAplicacoes([aplicacoesBase, aplicacoesManuais]),
  [aplicacoesBase, aplicacoesManuais]
);

const nomePecaBase = limparCampoTexto(
  anuncio?.pecaEncontrada?.peca || anuncio?.pecaEncontrada?.familia || ""
);
// NOME DA PEÇA (18/10/2026): preenchido sozinho só com fonte confiável
// (base/catálogo, cadastro, ou o tipo de peça reconhecido no título, sem
// veículo/anos/motor/código). Ambíguo → sugestões a confirmar. O nome
// digitado/confirmado pelo usuário (nomePecaOrigem) nunca é sobrescrito.
// Abrir a ficha não grava nada: só uma edição real grava (com a origem).
const [decisaoNomeInicial] = useState(() => {
  const contexto = new Set(
    aplicacoesConfirmadas.flatMap((a) => [a.montadora, a.modelo, a.motor, a.versao])
      .filter(Boolean).flatMap((t) => normalizarTexto(t).split(/\s+/))
  );
  return decidirNomePeca({
    salvo: inicial("nomePeca", nomePecaBase),
    origemSalva: fichaSalva?.campos?.nomePecaOrigem || "",
    base: nomePecaBase,
    cadastro: limparCampoTexto(anuncio?.produtoPrincipal || anuncio?.produto?.nome || ""),
    titulo: tituloAnuncio,
    descricao,
    contexto,
  });
});
const [nomePeca, setNomePeca] = useState(() => decisaoNomeInicial.nome);
const [nomePecaOrigem, setNomePecaOrigem] = useState(() => decisaoNomeInicial.origem || "");
function editarNomePeca(valor, origem = "manual") {
  setNomePeca(valor);
  setNomePecaOrigem(limparCampoTexto(valor) ? origem : "");
}
// Dados técnicos ANTIGOS da peça (16/10/2026: os 4 campos manuais saíram da
// tela). Os valores já registrados em fichas antigas são PRESERVADOS: seguem
// gravados na ficha, aparecem só para leitura e alimentam a Inteligência de
// Busca. Nada é apagado.
const [funcaoPeca] = useState(() => inicial("funcaoPeca", ""));
const [fonteFuncao] = useState(() => inicial("fonteFuncao", ""));
const [especificacaoTecnica] = useState(() => inicial("especificacaoTecnica", ""));
const [termoComercial] = useState(() => inicial("termoComercial", ""));

// Produto principal = o que define a Categoria ML (itens inclusos não).
const produtoPrincipal = useMemo(() => {
  // Montadora/modelo/motor/versão da aplicação: contexto, nunca a peça.
  const doVeiculo = new Set(
    aplicacoesConfirmadas.flatMap((a) => [a.montadora, a.modelo, a.motor, a.versao])
      .filter(Boolean).flatMap((t) => normalizarTexto(t).split(/\s+/))
  );
  const r = identificarProdutoPrincipal({ anuncio, nomePeca, nomePecaBase, titulo: tituloAnuncio, descricao, contexto: doVeiculo });
  // Na lista "acompanha" mostra só os itens (sem montadora/modelo/motor).
  const acompanha = r.acompanha
    .map((item) => item.split(/\s+/).filter((w) => !doVeiculo.has(normalizarTexto(w)) && !/\d/.test(w)).join(" ").trim())
    .filter(Boolean);
  return { ...r, acompanha, contexto: doVeiculo };
}, [anuncio, nomePeca, nomePecaBase, tituloAnuncio, descricao, aplicacoesConfirmadas]);

// Texto do bloco ⑨ (o que a Publicação lê): aplicações detalhadas +
// modelos sem detalhes ("• Logan", sem motor/período). Nada é completado.
function textoCompatibilidadesDe(lista, modelos = modelosSemDetalhes) {
  return formatarCompatibilidadesLegiveis(
    [
      ...lista.map((a) => ({
        montadora: a.montadora,
        modelo: a.modelo,
        motor: [a.motor, a.versao].filter(Boolean).join(" "),
        ano_inicio: a.anoInicio,
        ano_fim: a.anoFim,
      })),
      ...modelos.map((m) => ({ montadora: m.montadora, modelo: m.modelo })),
    ],
    ""
  );
}

function atualizarTextoCompat({ manuais = aplicacoesManuais, modelos = modelosSemDetalhes, base = aplicacoesBase } = {}) {
  const todas = juntarAplicacoes([base, manuais]);
  setCompatibilidades(todas.length || modelos.length ? textoCompatibilidadesDe(todas, modelos) : "");
}

function salvarAplicacoesManuais(lista, base = aplicacoesBase) {
  setAplicacoesManuais(lista);
  gravarNoMapaLocal(CHAVE_APLICACOES_MANUAIS, produtoAtual, lista.length ? lista : null);
  atualizarTextoCompat({ manuais: lista, base });
}

function salvarModelos(lista) {
  const limpa = juntarModelos(lista);
  setModelosSemDetalhes(limpa);
  atualizarTextoCompat({ modelos: limpa });
}

// A) Modelos confirmados sem detalhes — vários de uma vez.
function adicionarModelos() {
  const montadora = limparCampoTexto(novosModelos.montadora);
  const lista = separarModelos(novosModelos.modelos);
  if (!montadora || !lista.length) {
    setAvisoNovaAplicacao("Informe a montadora e pelo menos um modelo (separe por vírgula).");
    return;
  }
  setAvisoNovaAplicacao("");
  salvarModelos([...modelosSemDetalhes, ...lista.map((modelo) => ({ montadora, modelo }))]);
  setNovosModelos({ montadora, modelos: "" });
}
function salvarEdicaoModelo() {
  const { indice, montadora, modelo } = modeloEditando;
  if (indice < 0) return;
  if (!limparCampoTexto(montadora) || !limparCampoTexto(modelo)) {
    setAvisoNovaAplicacao("Modelo e montadora não podem ficar em branco (use Remover).");
    return;
  }
  setAvisoNovaAplicacao("");
  excluirModeloDaBase(modelosSemDetalhes[indice]);
  salvarModelos(modelosSemDetalhes.map((m, i) => (i === indice ? { montadora: limparCampoTexto(montadora), modelo: limparCampoTexto(modelo) } : m)));
  setModeloEditando({ indice: -1, montadora: "", modelo: "" });
}
function removerModelo(indice) {
  excluirModeloDaBase(modelosSemDetalhes[indice]);
  salvarModelos(modelosSemDetalhes.filter((_, i) => i !== indice));
  if (modeloEditando.indice === indice) setModeloEditando({ indice: -1, montadora: "", modelo: "" });
}

// B) Aplicação detalhada (cadastrar, editar, remover).
function confirmarNovaAplicacao() {
  const a = normalizarAplicacao(novaAplicacao, "manual");
  if (!a || !a.montadora || !a.modelo) {
    setAvisoNovaAplicacao("Informe pelo menos a montadora e o modelo.");
    return;
  }
  const anoValido = (v) => !v || /^\d{4}$/.test(v);
  if (!anoValido(a.anoInicio) || !anoValido(a.anoFim)) {
    setAvisoNovaAplicacao("Ano com 4 dígitos (ex.: 2012), ou deixe em branco.");
    return;
  }
  if (a.anoInicio && a.anoFim && Number(a.anoInicio) > Number(a.anoFim)) {
    setAvisoNovaAplicacao("O ano inicial não pode ser maior que o ano final.");
    return;
  }
  setAvisoNovaAplicacao("");
  let manuais = aplicacoesManuais;
  let base = aplicacoesBase;
  if (aplicacaoEditando?.origem === "manual") {
    manuais = manuais.filter((_, i) => i !== aplicacaoEditando.indice);
  } else if (aplicacaoEditando?.origem === "base") {
    const excl = [...new Set([...aplicacoesBaseExcluidas, aplicacaoEditando.chave])];
    setAplicacoesBaseExcluidas(excl);
    base = aplicacoesBaseTodas.filter((x) => !excl.includes(chaveAplicacao(x)));
  }
  const semDetalhe = !a.motor && !a.anoInicio && !a.anoFim && !a.versao;
  if (semDetalhe) {
    // Só montadora + modelo = modelo sem detalhes (área própria).
    salvarAplicacoesManuais(manuais, base);
    const modelos = juntarModelos(modelosSemDetalhes, [{ montadora: a.montadora, modelo: a.modelo }]);
    setModelosSemDetalhes(modelos);
    atualizarTextoCompat({ manuais, modelos, base });
  } else {
    salvarAplicacoesManuais(juntarAplicacoes([manuais, [a]]), base);
  }
  setAplicacaoEditando(null);
  setNovaAplicacao(NOVA_APLICACAO_VAZIA);
}

function editarAplicacao(a) {
  const indice = a.origem === "manual" ? aplicacoesManuais.indexOf(a) : -1;
  setAplicacaoEditando({ origem: a.origem, indice, chave: chaveAplicacao(a) });
  setNovaAplicacao({ montadora: a.montadora, modelo: a.modelo, motor: a.motor, anoInicio: a.anoInicio, anoFim: a.anoFim, versao: a.versao });
  setAvisoNovaAplicacao("");
}
function cancelarEdicaoAplicacao() {
  setAplicacaoEditando(null);
  setNovaAplicacao(NOVA_APLICACAO_VAZIA);
}
function removerAplicacao(a) {
  if (a.origem === "manual") {
    salvarAplicacoesManuais(aplicacoesManuais.filter((x) => x !== a));
  } else {
    const excl = [...new Set([...aplicacoesBaseExcluidas, chaveAplicacao(a)])];
    setAplicacoesBaseExcluidas(excl);
    atualizarTextoCompat({ base: aplicacoesBaseTodas.filter((x) => !excl.includes(chaveAplicacao(x))) });
  }
  if (aplicacaoEditando) cancelarEdicaoAplicacao();
}

const totalCompatibilidades = aplicacoesConfirmadas.length + modelosSemDetalhes.length;
useEffect(() => {
  if (aplicacoesConfirmadas.length > 0 || modelosSemDetalhes.length > 0) {
    setCompatibilidades(textoCompatibilidadesDe(aplicacoesConfirmadas, modelosSemDetalhes));
  }
  // Linha antiga convertida: grava já no formato novo (sem perder nada).
  if (legadoAplicacoes.convertidas) {
    gravarNoMapaLocal(CHAVE_APLICACOES_MANUAIS, produtoAtual, legadoAplicacoes.detalhadas.length ? legadoAplicacoes.detalhadas : null);
  }
}, [anuncio]); // eslint-disable-line react-hooks/exhaustive-deps
  const [
    canalVendaPublicacao,
    setCanalVendaPublicacao,
  ] = useState(() => {
    return (
      localStorage.getItem(
        "canalVendaAppia"
      ) ||
      anuncio?.canalVenda ||
      "mercado_livre"
    );
  });

  // TIPO DE ANÚNCIO (Clássico/Premium) PERTENCE À FICHA: vem dela. A
  // preferência do navegador só sugere o tipo de uma ficha NOVA sem tipo.
  const [
    modalidade,
    setModalidade,
  ] = useState(() => {
    let preferencia = "";
    try {
      preferencia = localStorage.getItem("tipoAnuncioAppia") || "";
    } catch {
      preferencia = "";
    }
    return tipoAnuncioDaFicha({ fichaSalva, anuncio, preferencia });
  });

  useEffect(() => {
    const canalSalvo =
      localStorage.getItem(
        "canalVendaAppia"
      );

    if (canalSalvo) {
      setCanalVendaPublicacao(
        canalSalvo
      );
    }
    // (O tipo de anúncio NÃO é mais trocado pela preferência do navegador.)
  }, []);

  const [
    modoEnvio,
    setModoEnvio,
  ] = useState(() => inicial("modoEnvio", "meli"));

  const [
    lojaOficial,
    setLojaOficial,
  ] = useState(() => inicial("lojaOficial", ""));

  const [
    quantidadeEstoque,
    setQuantidadeEstoque,
  ] = useState(() => inicial("quantidadeEstoque", ""));

  const [
    sku,
    setSku,
  ] = useState(() =>
    inicial("sku", anuncio?.codigo || "")
  );

  const [
    larguraFabrica,
    setLarguraFabrica,
  ] = useState(() => inicial("larguraFabrica", ""));

  const [
    alturaFabrica,
    setAlturaFabrica,
  ] = useState(() => inicial("alturaFabrica", ""));

  const [
    comprimentoFabrica,
    setComprimentoFabrica,
  ] = useState(() => inicial("comprimentoFabrica", ""));

  const [
    pesoFabrica,
    setPesoFabrica,
  ] = useState(() => inicial("pesoFabrica", ""));

  const [
    larguraEnvio,
    setLarguraEnvio,
  ] = useState(() => inicial("larguraEnvio", edicoesNA.medida ? String(edicoesNA.medida.largura_cm).replace(".", ",") : ""));

  const [
    alturaEnvio,
    setAlturaEnvio,
  ] = useState(() => inicial("alturaEnvio", edicoesNA.medida ? String(edicoesNA.medida.altura_cm).replace(".", ",") : ""));

  const [
    comprimentoEnvio,
    setComprimentoEnvio,
  ] = useState(() => inicial("comprimentoEnvio", edicoesNA.medida ? String(edicoesNA.medida.comprimento_cm).replace(".", ",") : ""));

  const [
    pesoEnvio,
    setPesoEnvio,
  ] = useState(() => inicial("pesoEnvio", edicoesNA.medida ? gParaKgTexto(edicoesNA.medida.peso_g) : ""));

  const [
    condicao,
    setCondicao,
  ] = useState(() => inicial("condicao", "novo"));

  // "Publicar sem compatibilidade": só com marcação EXPLÍCITA do usuário
  // (sem aplicação estruturada, a aprovação/publicação fica bloqueada).
  const [
    semCompatConfirmado,
    setSemCompatConfirmado,
  ] = useState(() => inicial("semCompatibilidadeConfirmada", false) === true);

  // Garantia FIXA de todo anúncio novo: 3 meses, garantia do vendedor
  // (padrão PAIIA; nunca sem garantia, nunca garantia de fábrica).
  const tipoGarantia = GARANTIA_ML.tipo;
  const mesesGarantia = String(GARANTIA_ML.meses);

  const [
    limiteVenda,
    setLimiteVenda,
  ] = useState(() => inicial("limiteVenda", ""));

  // Informação regulatória: padrão "Não se aplica" (enviado só quando a
  // categoria do ML oferece o campo; conferido na Publicação).
  const informacaoRegulatoria = "Não se aplica";

  const [
    caracteristicasSecundarias,
    setCaracteristicasSecundarias,
  ] = useState(() => inicial("caracteristicasSecundarias", ""));

  const [
    validado,
    setValidado,
  ] = useState(() => Boolean(assinaturaAprovadaRef.current && fichaSalva?.payloadTeste));

  const [
    payloadTeste,
    setPayloadTeste,
  ] = useState(() => (assinaturaAprovadaRef.current && fichaSalva?.payloadTeste) || null);

  const [
    pendenciasRevisao,
    setPendenciasRevisao,
  ] = useState([]);
const [
  termoCategoria,
  setTermoCategoria,
] = useState(() =>
  limparCampoTexto(
    anuncio?.pecaEncontrada?.peca ||
      anuncio?.pecaEncontrada?.familia ||
      ""
  )
);

const [
  categoriaId,
  setCategoriaId,
] = useState(categoriaInicial?.id || "");

const categoriaIdRef = useRef(categoriaInicial?.id || "");
useEffect(() => {
  categoriaIdRef.current = categoriaId;
}, [categoriaId]);

// TIPO DE VEÍCULO = atributo VEHICLE_TYPE da CATEGORIA no Mercado Livre
// (leitura). Cada ramo de categoria tem o seu valor: Carro/Caminhonete,
// Moto/Quadriciclo, Linha Pesada; categorias náuticas não têm o campo.
// O PAIIA só usa os valores que o ML oferece — nunca inventa.
const [tipoVeiculoML, setTipoVeiculoML] = useState({ estado: "inicial", existe: null, valores: [] });
useEffect(() => {
  let ativo = true;
  if (!categoriaId) {
    setTipoVeiculoML({ estado: "sem_categoria", existe: null, valores: [] });
    return undefined;
  }
  if (!contaSimulacaoML) {
    setTipoVeiculoML({ estado: "sem_conta", existe: null, valores: [] });
    return undefined;
  }
  setTipoVeiculoML((t) => ({ ...t, estado: "carregando" }));
  (async () => {
    try {
      const { data, error } = await supabase.functions.invoke("mercadolivre-publicacao", {
        body: { acao: "ml_consulta", conta_ml: String(contaSimulacaoML), metodo: "GET", caminho: `/categories/${categoriaId}/attributes` },
      });
      if (!ativo) return;
      const lista = !error && data?.ok && Array.isArray(data.dados) ? data.dados : null;
      if (!lista) {
        setTipoVeiculoML({ estado: "erro", existe: null, valores: [] });
        return;
      }
      setTipoVeiculoML({ estado: "ok", ...tipoVeiculoDaCategoria(lista) });
    } catch {
      if (ativo) setTipoVeiculoML({ estado: "erro", existe: null, valores: [] });
    }
  })();
  return () => { ativo = false; };
}, [categoriaId, contaSimulacaoML]);
// SUGESTÃO do Tipo de veículo (categoria ML + aplicações confirmadas).
// Só preenche enquanto o usuário não escolheu à mão; nunca trava o campo.
const sugestaoTipoVeiculo = useMemo(
  () => sugerirTipoVeiculo({
    infoCategoria: tipoVeiculoML.estado === "ok" ? tipoVeiculoML : null,
    aplicacoes: aplicacoesConfirmadas,
  }),
  [tipoVeiculoML, aplicacoesConfirmadas]
);
// (08/10/2026) A sugestão NÃO troca mais o valor sozinha: a ficha nova nasce
// com "Carro/Caminhonete" e só o usuário troca. A sugestão vira só um aviso.
const sugestaoDiferente = Boolean(
  normalizarTipoVeiculo(sugestaoTipoVeiculo.valor) &&
  normalizarTipoVeiculo(sugestaoTipoVeiculo.valor) !== normalizarTipoVeiculo(tipoVeiculo) &&
  aplicarSugestaoTipoVeiculo
)
// O tipo escolhido cabe na categoria do ML? (não troca nada sozinho)
const tipoVeiculoCategoria = tipoVeiculoNaCategoria(
  tipoVeiculo,
  tipoVeiculoML.estado === "ok" ? tipoVeiculoML : null
);
// Conflito: fonte superior (Base/cadastro/nome da peça) × título.
const [conflitoProduto, setConflitoProduto] = useState(null);

// CONFIRMAÇÃO da categoria = sempre um clique do usuário (nunca automática).
// Fica registrada na ficha (categoriaDecisao) com data/hora, origem, o que
// foi apresentado e o que foi descartado. (09/10/2026: a escolha NÃO é mais
// gravada no navegador como "categoria do código".)
function confirmarCategoria(candidata, revisao = null) {
  if (!candidata?.id) return;
  const caminho = candidata.caminho || candidata.nome || candidata.id;
  categoriaIdRef.current = candidata.id;
  setCategoria(caminho);
  setCategoriaId(candidata.id);
  setOrigemCategoria("confirmada");
  setDecisaoCategoria((d) => registrarConfirmacao(d, { candidata, avaliacao: avaliacaoCategoria, revisao }));
}
function trocarCategoria() {
  setDecisaoCategoria((d) => desfazerConfirmacao(d, "o usuário pediu para trocar a categoria"));
  categoriaIdRef.current = "";
  setCategoriaId("");
  setCategoria("");
  setOrigemCategoria("");
}
// Motivo de não ter GTIN: só valor oficial da categoria, escolhido pelo usuário.
function escolherMotivoSemGtin(valor) {
  setDecisaoCategoria((d) => ({
    ...(d || {}),
    motivoSemGtin: valor?.id ? { id: String(valor.id), nome: String(valor.nome || "") } : null,
    historico: [...((d && d.historico) || []), { acao: "motivo_sem_gtin", id: valor?.id || "", data: new Date().toISOString() }].slice(-30),
  }));
}

// Categoria com ID mas sem o nome: só consulta o nome no ML (não troca o ID).
useEffect(() => {
  if (!categoriaId || (categoria && categoria !== categoriaId)) return undefined;
  let ativo = true;
  (async () => {
    try {
      const r = await fetch(`https://api.mercadolibre.com/categories/${encodeURIComponent(categoriaId)}`);
      if (!r.ok) return;
      const d = await r.json();
      const caminho = Array.isArray(d?.path_from_root)
        ? d.path_from_root.map((n) => n?.name).filter(Boolean).join(" > ")
        : d?.name || "";
      if (ativo && caminho) setCategoria(caminho);
    } catch {
      // sem nome: continua mostrando o ID
    }
  })();
  return () => {
    ativo = false;
  };
}, [categoriaId]); // eslint-disable-line react-hooks/exhaustive-deps

const [carregandoCategoria, setCarregandoCategoria] = useState(false);
const [erroCategoria, setErroCategoria] = useState("");
const [avaliacaoCategoria, setAvaliacaoCategoria] = useState(null);
const [evidenciaCategoria, setEvidenciaCategoria] = useState(null);
const [detalhesCategoria, setDetalhesCategoria] = useState({});
const [rejeicoesSKU, setRejeicoesSKU] = useState(() => (Array.isArray(decisaoInicial?.rejeitadas) ? decisaoInicial.rejeitadas : []));
const [restricoesSKU, setRestricoesSKU] = useState(() => (Array.isArray(decisaoInicial?.restricoes) ? decisaoInicial.restricoes : []));
const cacheDetalhesCategoriaRef = useRef({});
const termosExtrasCategoriaRef = useRef([]);
// Obrigatórios/condicionais da categoria selecionada (motivo sem GTIN).
const exigenciaCategoria = useMemo(() => {
  const d = categoriaId ? detalhesCategoria[categoriaId] : null;
  if (!d) return null;
  return exigenciasAtributos({
    atributos: d.atributosBrutos,
    preenchidos: (d.atributos?.obrigatorios || []).map((a) => a.id),
    gtin,
    motivoSemGtin: decisaoCategoria?.motivoSemGtin || null,
  });
}, [categoriaId, detalhesCategoria, gtin, decisaoCategoria?.motivoSemGtin]);
const exigenciaGtin = useMemo(() => {
  // Exigido pelo ML = bloqueia; só condicional (o ML não exigiu) = AVISO opcional.
  if (!exigenciaCategoria?.motivoExigido && !exigenciaCategoria?.motivoSugerido) return null;
  const def = (detalhesCategoria[categoriaId]?.atributosBrutos || []).find((a) => a?.id === ATRIBUTO_MOTIVO_SEM_GTIN);
  return {
    exigido: true,
    obrigatorio: Boolean(exigenciaCategoria.motivoExigido),
    categoriaId,
    valores: (def?.values || []).map((v) => ({ id: String(v.id), nome: String(v.name) })),
    escolhido: exigenciaCategoria.motivoSemGtin,
  };
}, [exigenciaCategoria, detalhesCategoria, categoriaId]);

  // Cópia aprovada montada com os dados ATUAIS da Conferência. É a mesma
  // usada ao aprovar e para conferir, depois, se a aprovação ainda vale.
  function montarAnuncioConferidoAtual() {
    return {
      codigo: numeroPeca || codigo,
      oem: anuncio?.oem || "",
      titulo: tituloAnuncio,
      preco,
      descricao,
      tipoAnuncio: modalidade,
      marca,
      gtin,
      fotos: fotos.map(obterUrlFoto).filter(Boolean),
      // Marca: estas fotos foram aprovadas PARA esta ficha (a Publicação confere).
      fotosFichaId: situacaoFotos.estado === "ok" ? marcaDasFotos(anuncioIdPAIIA, fotos.map(obterUrlFoto).filter(Boolean)) : "",
      categoria,
      categoriaId,
      // Decisão da categoria (confirmação do usuário + rastreabilidade) e
      // motivo de não ter GTIN: a Publicação confere de novo antes de publicar.
      categoriaDecisao: copiaLeve(decisaoCategoria, 60000),
      compatibilidades,
      // Tipo de veículo aprovado (vai como VEHICLE_TYPE na Publicação).
      tipoVeiculo,
      nomePeca,
      // UMA quantidade confirmada (Estoque da Conferência): a mesma vai para
      // a Publicação, a validação, o Bling e o Mercado Livre.
      quantidade: normalizarQuantidade(quantidadeEstoque),
      quantidadeConfirmada: Boolean(normalizarQuantidade(quantidadeEstoque)),
      // Compatibilidade estruturada e dados técnicos confirmados da peça.
      aplicacoesDetalhadas: aplicacoesConfirmadas,
      modelosSemDetalhes,
      dadosTecnicos: { funcao: funcaoPeca, fonteFuncao, especificacao: especificacaoTecnica, termoComercial },
      condicao,
      // Só true quando o usuário marcou "publicar sem compatibilidade".
      semCompatibilidadeConfirmada: semCompatConfirmado === true,
      logistica: logisticaConferencia,
      // Frete × precificação (registro único; a Publicação confere de novo).
      freteML: registroFreteConf,
      // Padrões fixos: vão para a ficha e para a Publicação.
      padroesML: padroesEsperadosConferencia(),
    };
  }
  const montarAnuncioConferidoRef = useRef(montarAnuncioConferidoAtual);
  montarAnuncioConferidoRef.current = montarAnuncioConferidoAtual;

  // Modelos confirmados (compatibilidade aprovada) que NÃO aparecem na
  // descrição: aviso na Conferência e bloqueio na aprovação/publicação.
  const modelosFaltandoDescricao = useMemo(
    () =>
      modelosFaltandoNaDescricao({
        modelos: modelosConfirmados({ aplicacoes: lerAplicacoesAprovadas({ texto: compatibilidades }), modelosSemDetalhes }),
        descricao,
      }),
    [compatibilidades, modelosSemDetalhes, descricao]
  );

  // Qualquer mudança depois da aprovação exige conferir de novo
  // (a publicação real usa SOMENTE o que foi aprovado na conferência).
  const assinaturaConferencia = JSON.stringify([
    tituloAnuncio,
    preco,
    descricao,
    fotos.map(obterUrlFoto),
    categoria,
    categoriaId,
    marca,
    numeroPeca,
    compatibilidades,
    pesoEnvio,
    comprimentoEnvio,
    larguraEnvio,
    alturaEnvio,
    logisticaConferencia?.medida || null,
    normalizarQuantidade(quantidadeEstoque),
    // Novos no fim (aprovações antigas sem eles não caem sozinhas).
    tipoVeiculo,
    gtin,
    modalidade,
    condicao,
    semCompatConfirmado === true,
    // (09/10/2026) Categoria CONFIRMADA e motivo de não ter GTIN.
    decisaoCategoria?.confirmada?.id || "",
    decisaoCategoria?.motivoSemGtin?.id || "",
  ]);

  // A aprovação compara o CONTEÚDO (não o formato): abrir/revisar, F5,
  // navegar ou abrir uma ficha antiga na versão nova não derrubam a
  // aprovação. Só uma alteração real em campo relevante exige validar de
  // novo — e, se o usuário desfizer, a aprovação guardada volta.
  useEffect(() => {
    if (!usuarioEditouRef.current) assinaturaCarregadaRef.current = assinaturaConferencia;
    const aprovada = assinaturaAprovadaRef.current;
    if (aprovada && anuncioConferido) {
      // (09/10/2026) Categoria confirmada diferente da que está na cópia
      // aprovada (inclusive ficha aprovada antes da regra, sem decisão):
      // edição real → a Conferência precisa ser aprovada de novo.
      const decisaoMudou = Boolean(usuarioEditouRef.current) &&
        String(anuncioConferido?.categoriaDecisao?.confirmada?.id || "") !== String(decisaoCategoria?.confirmada?.id || "");
      if (mesmaAprovacao(aprovada, assinaturaConferencia) && !decisaoMudou) {
        // Diagnóstico: só o FORMATO mudou (antes, isso derrubava a aprovação).
        if (typeof window !== "undefined" && aprovada !== assinaturaConferencia) {
          try {
            const a = JSON.parse(aprovada), b = JSON.parse(assinaturaConferencia);
            window.__paiiaSoFormatoMudou = a.map((v, i) => (JSON.stringify(v) !== JSON.stringify(b[i]) ? i : -1)).filter((i) => i >= 0);
          } catch { /* assinatura antiga ilegível */ }
        }
        return;
      }
      let mudou = diferencasAssinatura(aprovada, assinaturaConferencia);
      if (decisaoMudou && !mudou.includes("categoria confirmada")) mudou = [...mudou, "categoria confirmada"];
      // Assinatura antiga ilegível, ou etapa PUBLICAÇÃO: a aprovação só é
      // mantida se a CÓPIA APROVADA for igual aos dados atuais, campo a campo
      // (ex.: quantidade confirmada na Publicação, que atualiza as duas).
      // Antes, a assinatura nova era adotada calada e a cópia aprovada podia
      // continuar antiga (caso MLB7755979208: descrição sem o Kangoo).
      if (mudou.includes("assinatura ilegível") || etapaFluxo === "publicacao") {
        const divergentes = divergenciasAnuncio(montarAnuncioConferidoRef.current(), anuncioConferido, { somenteCamposDe: anuncioConferido });
        if (!divergentes.length) {
          assinaturaAprovadaRef.current = assinaturaConferencia;
          return;
        }
        mudou = divergentes;
      }
      // Carregamento / normalização / sugestão automática: a aprovação
      // fica. Só a edição REAL do usuário invalida — e só nos campos que
      // ele mudou (os que já vieram diferentes ao carregar não contam).
      // Edição feita no NOVO ANÚNCIO depois da Conferência (tipo de veículo,
      // peso/medidas) é edição real: invalida SÓ esses campos, com aviso.
      const externos = mudou.filter((c) => camposEditadosNoNovoAnuncioRef.current.includes(c));
      if (!usuarioEditouRef.current && !externos.length) {
        divergentesNoCarregamentoRef.current = [...new Set([...divergentesNoCarregamentoRef.current, ...mudou])];
        if (typeof window !== "undefined") window.__paiiaDivergenciasCarregamento = divergentesNoCarregamentoRef.current;
        return;
      }
      let desdeCarga = [];
      try {
        desdeCarga = assinaturaCarregadaRef.current ? diferencasAssinatura(assinaturaCarregadaRef.current, assinaturaConferencia) : [];
      } catch {
        desdeCarga = [];
      }
      let invalidam = usuarioEditouRef.current
        ? camposQueInvalidam({ usuarioEditou: true, mudou, divergentesNoCarregamento: divergentesNoCarregamentoRef.current, mudaramDesdeCarregamento: desdeCarga })
        : [];
      invalidam = [...new Set([...invalidam, ...externos])];
      if (!usuarioEditouRef.current) {
        divergentesNoCarregamentoRef.current = [...new Set([...divergentesNoCarregamentoRef.current, ...mudou.filter((c) => !externos.includes(c))])];
      }
      camposEditadosNoNovoAnuncioRef.current = [];
      if (!invalidam.length) return;
      mudou = invalidam;
      setAvisoAprovacao(`${TEXTO_CAMPO_ALTERADO} (${mudou.join(", ")})${externos.length ? " — alterado no Novo Anúncio." : ""}`);
      if (typeof window !== "undefined") window.__paiiaDiferencasAprovacao = mudou;
      // Dado aprovado mudou de verdade: a aprovação é invalidada (nova
      // Conferência). Se o usuário desfizer, a aprovação guardada volta.
      aprovacaoGuardadaRef.current = { assinatura: aprovada, anuncioConferido, payloadTeste, campos: mudou };
      assinaturaAprovadaRef.current = "";
      setAnuncioConferido(null);
      setEtapaFluxo("conferencia");
      setValidado(false);
      return;
    }
    const guardada = aprovacaoGuardadaRef.current;
    if (guardada && mesmaAprovacao(guardada.assinatura, assinaturaConferencia)) {
      aprovacaoGuardadaRef.current = null;
      assinaturaAprovadaRef.current = guardada.assinatura;
      setAvisoAprovacao("");
      setAnuncioConferido(guardada.anuncioConferido);
      setPayloadTeste(guardada.payloadTeste || null);
      setValidado(Boolean(guardada.payloadTeste));
      setPendenciasRevisao([]);
    }
  }, [assinaturaConferencia]); // eslint-disable-line react-hooks/exhaustive-deps

  function importarBannerDoComputador() {
    const input =
      document.createElement("input");

    input.type = "file";
    input.accept =
      "image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp";

    input.onchange = () => {
      const arquivo =
        input.files?.[0];

      if (!arquivo) {
        return;
      }

      if (
        !String(
          arquivo.type || ""
        ).startsWith("image/")
      ) {
        alert(
          "Selecione uma imagem para o Banner."
        );
        return;
      }

      const urlBanner =
        URL.createObjectURL(
          arquivo
        );

      if (
        bannerAtual &&
        String(
          bannerAtual
        ).startsWith("blob:")
      ) {
        URL.revokeObjectURL(
          bannerAtual
        );
      }

      setBannerAtual(
        urlBanner
      );
    };

    input.click();
  }

  function removerBannerAtual() {
    if (
      bannerAtual &&
      String(
        bannerAtual
      ).startsWith("blob:")
    ) {
      URL.revokeObjectURL(
        bannerAtual
      );
    }

    setBannerAtual("");
  }

  function abrirGerenciadorClip() {
    localStorage.setItem(
      "retornarParaMidiasPublicacao",
      "true"
    );

    localStorage.removeItem(
      "retornarParaNovoAnuncio"
    );

    setScreen?.("clipIA");
  }

  async function buscarClipConcluidoNaGaleria() {
    const urlsFotos = fotos
      .map(obterUrlFoto)
      .filter(Boolean);

    if (urlsFotos.length === 0) {
      return null;
    }

    const {
      data: dadosUsuario,
      error: erroUsuario,
    } = await supabase.auth.getUser();

    if (erroUsuario) {
      throw erroUsuario;
    }

    const usuario =
      dadosUsuario?.user;

    if (!usuario?.id) {
      return null;
    }

    const { data, error } =
      await supabase
        .from("processamentos")
        .select(
          "imagem_processada, imagem_original, tipo, status, created_at"
        )
        .eq(
          "user_id",
          usuario.id
        )
        .in(
          "tipo",
          ["clip", "video"]
        )
        .eq(
          "status",
          "finalizado"
        )
        .in(
          "imagem_original",
          urlsFotos
        )
        .not(
          "imagem_processada",
          "is",
          null
        )
        .order(
          "created_at",
          { ascending: false }
        )
        .limit(1);

    if (error) {
      throw error;
    }

    return Array.isArray(data) &&
      data.length > 0
      ? data[0]
      : null;
  }

  async function verificarAndamentoClip() {
    sincronizarClipDoAnuncio();

    const status =
      localStorage.getItem(
        "clipGeracaoStatus"
      ) || "";

    const clipEncontrado =
      localStorage.getItem(
        "clipPronto"
      ) ||
      localStorage.getItem(
        "clipSelecionado"
      ) ||
      "";

    if (clipEncontrado) {
      setClipAtual(clipEncontrado);
      setStatusClipAtual("pronto");
      setMensagemClipAtual(
        "✅ Clip pronto e disponível."
      );
      return;
    }

    if (status === "erro") {
      abrirGerenciadorClip();
      return;
    }

    if (status !== "gerando") {
      abrirGerenciadorClip();
      return;
    }

    setMensagemClipAtual(
      "🔄 Verificando o andamento do Clip..."
    );

    try {
      const clipGaleria =
        await buscarClipConcluidoNaGaleria();

      const urlClip =
        clipGaleria?.imagem_processada ||
        "";

      if (!urlClip) {
        setStatusClipAtual("gerando");
        setMensagemClipAtual(
          "⏳ O Clip ainda está sendo gerado. Aguarde mais um pouco e atualize novamente."
        );
        return;
      }

      localStorage.removeItem(
        "clipRemovidoPublicacao"
      );

      localStorage.setItem(
        "clipPronto",
        urlClip
      );

      localStorage.setItem(
        "clipSelecionado",
        urlClip
      );

      localStorage.setItem(
        "clipGeracaoStatus",
        "pronto"
      );

      localStorage.setItem(
        "clipGeracaoMensagem",
        "✅ Clip pronto, recuperado da Galeria e vinculado ao anúncio"
      );

      setClipAtual(urlClip);
      setStatusClipAtual("pronto");
      setMensagemClipAtual(
        "✅ Clip pronto e recuperado da Galeria."
      );

      try {
        const salvo =
          localStorage.getItem(
            "mlAnuncioTeste"
          );

        if (salvo) {
          const dados =
            JSON.parse(salvo);

          localStorage.setItem(
            "mlAnuncioTeste",
            JSON.stringify({
              ...dados,
              clip: urlClip,
            })
          );
        }
      } catch (erro) {
        console.error(
          "Erro ao vincular Clip recuperado ao simulador:",
          erro
        );
      }

      window.dispatchEvent(
        new CustomEvent(
          "appia:clip-pronto",
          {
            detail: {
              urlClip,
            },
          }
        )
      );
    } catch (erro) {
      console.error(
        "Erro ao verificar andamento do Clip:",
        erro
      );

      setStatusClipAtual("gerando");
      setMensagemClipAtual(
        "⚠️ Não foi possível consultar a Galeria agora. O Clip pode continuar sendo gerado em segundo plano."
      );
    }
  }

  function importarClipDoComputador() {
    const input =
      document.createElement("input");

    input.type = "file";
    input.accept = "video/mp4,.mp4";

    input.onchange = () => {
      const arquivo =
        input.files?.[0];

      if (!arquivo) {
        return;
      }

      const nome =
        String(
          arquivo.name || ""
        ).toLowerCase();

      const ehMp4 =
        arquivo.type === "video/mp4" ||
        nome.endsWith(".mp4");

      if (!ehMp4) {
        alert(
          "Selecione um vídeo MP4."
        );
        return;
      }

      const urlClip =
        URL.createObjectURL(
          arquivo
        );

      localStorage.removeItem(
        "clipRemovidoPublicacao"
      );

      setClipAtual(urlClip);
      setStatusClipAtual("pronto");
      setMensagemClipAtual(
        "✅ Clip MP4 importado para o anúncio."
      );
    };

    input.click();
  }

  function removerClipAtual() {
    if (
      clipAtual &&
      String(clipAtual).startsWith(
        "blob:"
      )
    ) {
      URL.revokeObjectURL(
        clipAtual
      );
    }

    localStorage.setItem(
      "clipRemovidoPublicacao",
      "true"
    );

    localStorage.removeItem(
      "clipPronto"
    );

    localStorage.removeItem(
      "clipSelecionado"
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

    try {
      const salvo =
        localStorage.getItem(
          "mlAnuncioTeste"
        );

      if (salvo) {
        const dados =
          JSON.parse(salvo);

        localStorage.setItem(
          "mlAnuncioTeste",
          JSON.stringify({
            ...dados,
            clip: "",
            clip_url: "",
          })
        );
      }
    } catch (erro) {
      console.error(
        "Erro ao remover Clip do anúncio de teste:",
        erro
      );
    }

    setClipAtual("");
    setStatusClipAtual("");
    setMensagemClipAtual("");
  }

  function abrirClipAtual() {
    if (!clipAtual) {
      verificarAndamentoClip();
      return;
    }

    window.open(
      clipAtual,
      "_blank",
      "noopener,noreferrer"
    );
  }

function formatarPrecoMercado(valor) {
  const numero = Number(valor);

  if (!Number.isFinite(numero)) {
    return "—";
  }

  return numero.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function normalizarCodigoMercado(valor = "") {
  return String(valor || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

async function pesquisarConcorrenciaPaizinho() {
  const codigoBusca =
    String(codigo || numeroPeca || "").trim();

  const tituloBusca =
    String(tituloAnuncio || "").trim();

  const termoBusca =
    [codigoBusca, tituloBusca]
      .filter(Boolean)
      .join(" ")
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
            fabricante:
              String(marca || "").trim(),
            peca: tituloBusca,
            categoria:
              String(categoria || "").trim(),
          },
        }
      );

    if (error) {
      throw new Error(
        error?.message ||
          "A função de concorrência não respondeu."
      );
    }

    if (!data?.ok && !data?.sucesso) {
      throw new Error(
        data?.erro ||
          data?.error ||
          "Não foi possível coletar preços da concorrência."
      );
    }

    const converterPreco = (valor) => {
      if (typeof valor === "number") {
        return Number.isFinite(valor)
          ? valor
          : null;
      }

      const texto = String(valor ?? "")
        .replace(/R\$/gi, "")
        .replace(/\s/g, "")
        .trim();

      if (!texto) {
        return null;
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
        : null;
    };

    const prepararItens = (
      lista,
      marketplacePadrao
    ) => {
      return (Array.isArray(lista) ? lista : [])
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
          preco: converterPreco(
            item?.preco ?? item?.price
          ),
          link:
            item?.link ||
            item?.url ||
            "",
          fonte: item?.fonte || "",
          categoria:
            item?.categoria || "",
        }))
        .filter(
          (item) =>
            Number.isFinite(item.preco) &&
            item.preco > 0
        );
    };

    const itensMercadoLivre =
      prepararItens(
        data?.mercadoLivre,
        "Mercado Livre"
      );

    const itensShopee =
      prepararItens(
        data?.shopee,
        "Shopee"
      );

    const todosItens = [
      ...itensMercadoLivre,
      ...itensShopee,
    ];

    const precos = todosItens
      .map((item) => item.preco)
      .filter(
        (valor) =>
          Number.isFinite(valor) &&
          valor > 0
      )
      .sort((a, b) => a - b);

    if (!precos.length) {
      throw new Error(
        "O Paizinho pesquisou, mas não encontrou preços comparáveis no Mercado Livre ou Shopee."
      );
    }

    const media =
      precos.reduce(
        (total, valor) => total + valor,
        0
      ) / precos.length;

    const indiceBaixo = Math.floor(
      (precos.length - 1) * 0.2
    );

    const indiceAlto = Math.ceil(
      (precos.length - 1) * 0.8
    );

    const faixaMin = precos[indiceBaixo];
    const faixaMax = precos[indiceAlto];
    const menor = precos[0];

    const precoUsuario = converterPreco(preco);

    let analise =
      `O Paizinho encontrou ${precos.length} preço(s) comparável(is): ` +
      `${itensMercadoLivre.length} no Mercado Livre e ` +
      `${itensShopee.length} na Shopee.`;

    if (
      Number.isFinite(precoUsuario) &&
      precoUsuario > 0
    ) {
      const diferencaPercentual =
        ((precoUsuario - media) / media) * 100;

      if (precoUsuario < faixaMin) {
        analise =
          `Seu preço está abaixo da faixa principal encontrada e ` +
          `${Math.abs(diferencaPercentual).toFixed(1)}% abaixo da média. ` +
          `Foram usados ${itensMercadoLivre.length} resultado(s) do Mercado Livre e ` +
          `${itensShopee.length} da Shopee.`;
      } else if (precoUsuario > faixaMax) {
        analise =
          `Seu preço está acima da faixa principal encontrada e ` +
          `${Math.abs(diferencaPercentual).toFixed(1)}% acima da média. ` +
          `Foram usados ${itensMercadoLivre.length} resultado(s) do Mercado Livre e ` +
          `${itensShopee.length} da Shopee.`;
      } else {
        analise =
          `Seu preço está dentro da faixa principal encontrada e ` +
          `${Math.abs(diferencaPercentual).toFixed(1)}% ` +
          `${diferencaPercentual >= 0 ? "acima" : "abaixo"} da média. ` +
          `Foram usados ${itensMercadoLivre.length} resultado(s) do Mercado Livre e ` +
          `${itensShopee.length} da Shopee.`;
      }
    }

    const palavrasChaveSugeridas =
      (Array.isArray(data?.palavrasChaveSugeridas)
        ? data.palavrasChaveSugeridas
        : [])
        .map((item) => {
          if (typeof item === "string") {
            return {
              termo: item,
              ocorrencias: 1,
            };
          }

          return {
            termo: String(
              item?.termo ||
                item?.palavra ||
                item?.keyword ||
                ""
            ).trim(),
            ocorrencias: Number(
              item?.ocorrencias ||
                item?.quantidade ||
                1
            ),
          };
        })
        .filter((item) => item.termo);

    setResultadoConcorrencia({
      menor,
      media,
      faixaMin,
      faixaMax,
      quantidade: precos.length,
      analise,
      termo:
        data?.termo || termoBusca,
      mercadoLivre: itensMercadoLivre,
      shopee: itensShopee,
      itens: todosItens.slice(0, 10),
      palavrasChaveSugeridas,
      diagnostico:
        data?.diagnostico || null,
    });

    console.log(
      "✅ CONCORRÊNCIA PAIIA:",
      data
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
    setPesquisandoConcorrencia(false);
  }
}

// Palavras do veículo (montadora/modelo/motor) só como contexto:
// não contam como "tipo da peça" na escolha da categoria.
function palavrasVeiculoConferencia() {
  return aplicacoesConfirmadas.flatMap((a) => [a.montadora, a.modelo, a.motor, a.versao]).filter(Boolean);
}

// =====================================================
// CATEGORIA DO MERCADO LIVRE (09/10/2026) — cruza preditor oficial,
// caminho/domínio, tipo de veículo, anúncios do mesmo código, atributos e
// categorias REJEITADAS do SKU (services/categoriaML.js). Nunca confirma
// sozinho; categoria herdada (ficha/base/navegador) só entra como candidata.
// =====================================================
async function chamarPublicacaoML(corpo) {
  const { data, error } = await supabase.functions.invoke("mercadolivre-publicacao", { body: corpo });
  if (error) return { ok: false, erro: error.message || "Falha ao falar com o servidor." };
  return data || { ok: false, erro: "Resposta vazia do servidor." };
}
function textoPecaCategoria() {
  return [produtoPrincipal.principal, nomePeca, tituloAnuncio].filter(Boolean).join(" ");
}
async function avaliarCategoria() {
  setCarregandoCategoria(true);
  setErroCategoria("");
  try {
    const principal = produtoPrincipal.principal;
    const ignorar = new Set(palavrasVeiculoConferencia().flatMap((t) => normalizarTexto(t).split(/\s+/)));
    const doTitulo = extrairProdutoPrincipal(tituloAnuncio, produtoPrincipal.contexto).principal;
    // Base/nome da peça × título indicando peças diferentes: não decide.
    let conflitoPrincipal = null;
    if (principal && doTitulo && !/^(título|descrição)/.test(produtoPrincipal.fonte)) {
      const nb = nucleoDoProduto(principal, ignorar);
      const nt = nucleoDoProduto(doTitulo, ignorar);
      const iguais = nb === nt || (SINONIMOS_TIPO_PECA[nb] || []).includes(nt);
      if (nt && !iguais) conflitoPrincipal = { fonte: produtoPrincipal.fonte, base: principal, titulo: doTitulo };
    }
    setConflitoProduto(conflitoPrincipal);
    const contexto = aplicacoesConfirmadas[0];
    const termos = [
      principal,
      nomePeca,
      doTitulo && doTitulo !== principal ? doTitulo : "",
      contexto && principal ? [principal, contexto.montadora, contexto.modelo].filter(Boolean).join(" ") : "",
      ...termosExtrasCategoriaRef.current,
    ];
    const codigoSku = numeroPeca || codigo;
    const [consultas, rej, evidencia] = await Promise.all([
      consultarPreditor(termos),
      lerRejeicoesDoSKU({
        codigo: codigoSku,
        listarFichas: listarAnunciosDoCodigo,
        lerItem: (mlb, conta) => chamarPublicacaoML({ acao: "ml_consulta", conta_ml: String(conta || contaSimulacaoML || ""), metodo: "GET", caminho: `/items/${mlb}` }),
      }),
      lerEvidenciaMesmoCodigo(codigoSku, (c) => chamarPublicacaoML({ ...c, conta_ml: String(contaSimulacaoML || "") })),
    ]);
    const rejeicoes = mesclarRejeicoes(decisaoCategoriaRef.current?.rejeitadas || [], rej.lista).lista;
    setRejeicoesSKU(rejeicoes);
    // MLB restrito sem motivo comprovado: só histórico (não rejeita categoria).
    setRestricoesSKU(rej.restricoes || []);
    // Histórico do SKU gravado na ficha (só acrescenta; nunca apaga).
    if (anuncioIdPAIIA && rej.lista.length) registrarCategoriasRejeitadas({ anuncioId: anuncioIdPAIIA, rejeicoes: rej.lista }).catch(() => {});
    const ids = new Set([
      ...consultas.flatMap((q) => q.sugestoes.map((x) => x.category_id)),
      ...Object.keys(evidencia.porCategoria || {}),
      ...herdadasCategoria.map((h) => h.id),
      ...rejeicoes.map((r) => r.categoria_id),
      categoriaIdRef.current,
    ].filter(Boolean));
    const detalhes = {};
    await Promise.all([...ids].slice(0, 16).map(async (id) => {
      detalhes[id] = await lerDetalheCategoria(id, undefined, cacheDetalhesCategoriaRef.current);
    }));
    const av = avaliarCategorias({ tipoVeiculo, textoPeca: textoPecaCategoria(), consultas, detalhes, evidencia, rejeicoes, herdadas: herdadasCategoria });
    if (conflitoPrincipal) {
      av.conflitos.unshift("Conflito na identificação do produto principal (Base/nome da peça × título): confirme qual é a peça antes de escolher a categoria.");
      av.sugerida = null;
    }
    if (!principal) av.alertas.unshift("O PAIIA não identificou a peça principal: informe o nome técnico da peça.");
    av.restricoes = rej.restricoes || [];
    setDetalhesCategoria((d) => ({ ...d, ...detalhes }));
    setEvidenciaCategoria(evidencia);
    setAvaliacaoCategoria(av);
    // Confirmada antes e agora REJEITADA para o SKU: desfaz (histórico fica).
    const conf = decisaoCategoriaRef.current?.confirmada?.id;
    if (conf && rejeicoes.some((r) => r.categoria_id === conf) && decisaoCategoriaRef.current?.revisao?.categoria_id !== conf) {
      setDecisaoCategoria((d) => desfazerConfirmacao(d, "categoria rejeitada pelo Mercado Livre para este SKU"));
      categoriaIdRef.current = "";
      setCategoriaId("");
      setCategoria("");
      setOrigemCategoria("");
    }
    if (rej.erros.length) setErroCategoria(`Histórico do SKU lido em parte (${rej.erros.slice(0, 3).join("; ")}).`);
  } catch (erro) {
    console.error("❌ ERRO CATEGORIA MERCADO LIVRE:", erro);
    setErroCategoria("Não foi possível conferir a categoria no Mercado Livre agora. Tente de novo.");
  } finally {
    setCarregandoCategoria(false);
  }
}

// Rejeição por DECISÃO MANUAL (com justificativa): fica na ficha e no histórico.
function rejeitarCategoriaManual(candidata, justificativa) {
  const r = rejeicaoManual({ categoria_id: candidata?.id, justificativa });
  if (!r) return;
  const atual = decisaoCategoriaRef.current || {};
  const lista = mesclarRejeicoes([...(atual.rejeitadas || []), ...rejeicoesSKU], [r]).lista;
  let nova = { ...atual, rejeitadas: lista, historico: [...(atual.historico || []), { acao: "rejeitou_manual", id: r.categoria_id, justificativa: r.justificativa, data: r.registrado_em }].slice(-30) };
  if (nova.confirmada?.id === r.categoria_id) {
    nova = desfazerConfirmacao(nova, "categoria rejeitada manualmente");
    categoriaIdRef.current = "";
    setCategoriaId("");
    setCategoria("");
    setOrigemCategoria("");
  }
  decisaoCategoriaRef.current = nova;
  setDecisaoCategoria(nova);
  setRejeicoesSKU(lista);
  if (anuncioIdPAIIA) registrarCategoriasRejeitadas({ anuncioId: anuncioIdPAIIA, rejeicoes: [r] }).catch(() => {});
  avaliarCategoria();
}

// Busca manual: acrescenta o termo às consultas e confere tudo de novo.
async function buscarCategoriaManual() {
  const termo = String(termoCategoria || "").trim();
  if (termo) termosExtrasCategoriaRef.current = [...new Set([...termosExtrasCategoriaRef.current, termo])].slice(-3);
  await avaliarCategoria();
}

// Ao abrir a Conferência: confere SEMPRE (inclusive a categoria herdada).
// Trocar o tipo de veículo confere de novo (o ramo da categoria depende dele).
const categoriaAvaliadaRef = useRef(false);
const tipoAvaliadoRef = useRef(String(tipoVeiculo || ""));
useEffect(() => {
  if (categoriaAvaliadaRef.current) return;
  categoriaAvaliadaRef.current = true;
  avaliarCategoria();
}, []); // eslint-disable-line react-hooks/exhaustive-deps
useEffect(() => {
  if (tipoAvaliadoRef.current === String(tipoVeiculo || "")) return undefined;
  const t = setTimeout(() => {
    tipoAvaliadoRef.current = String(tipoVeiculo || "");
    avaliarCategoria();
  }, 400);
  return () => clearTimeout(t);
}, [tipoVeiculo]); // eslint-disable-line react-hooks/exhaustive-deps
// Situação da categoria SELECIONADA agora (mostrada no bloco ⑮ e usada na aprovação).
const categoriaNaTela = useMemo(() => conferirCategoriaParaPublicar({
  categoriaId,
  decisao: decisaoCategoria,
  rejeicoes: rejeicoesSKU,
  detalhe: categoriaId ? detalhesCategoria[categoriaId] || null : null,
  tipoVeiculo,
  textoPeca: textoPecaCategoria(),
  exigencias: null,
}), [categoriaId, decisaoCategoria, rejeicoesSKU, detalhesCategoria, tipoVeiculo, produtoPrincipal.principal, nomePeca, tituloAnuncio]); // eslint-disable-line react-hooks/exhaustive-deps

  // Grava a ficha da conferência a cada alteração (uma por código).
  // Assim nada do que foi conferido some ao navegar ou atualizar a tela.
  const camposFicha = {
    // Fotos POR ID DA FICHA: o histórico guarda (sem apagar) fotos de outro
    // anúncio ignoradas. A MARCA vai só junto das fotos (montarDadosFicha).
    fotosHistorico: fotosDaBase.ignoradas.length
      ? juntarHistoricoFotos(fotosDaBase.historico, { fotos: fotosDaBase.ignoradas, motivo: fotosDaBase.motivoIgnoradas || "fotos de outro anúncio ignoradas" })
      : fotosDaBase.historico,
    titulo: tituloAnuncio,
    preco,
    codigo,
    descricao,
    marca,
    numeroPeca,
    gtin,
    tipoVeiculo,
    tipoVeiculoOrigem,
    // Tipo de anúncio salvo NA FICHA (não na preferência do navegador).
    tipoAnuncio: modalidade,
    freteML: registroFreteConf,
    nomePeca,
    nomePecaOrigem,
    // Sem confirmação, a categoria que veio da ficha continua guardada como
    // HERDADA (não confirmada) — nada se perde, e ela segue sem valer sozinha.
    categoriaML: categoriaId
      ? { id: categoriaId, caminho: categoria, origem: origemCategoria }
      : herdadasCategoria.find((h) => h.origem === ORIGEM_CATEGORIA.FICHA)
        ? { ...herdadasCategoria.find((h) => h.origem === ORIGEM_CATEGORIA.FICHA), origem: "herdada_nao_confirmada" }
        : null,
    // Rastreabilidade da categoria (apresentadas, origem, escolhida, data,
    // manual, descartadas/rejeitadas, motivo sem GTIN).
    categoriaDecisao: copiaLeve(decisaoCategoria, 60000),
    compatibilidades,
    observacaoCompatibilidade,
    modelosSemDetalhes,
    aplicacoesBaseExcluidas,
    funcaoPeca,
    fonteFuncao,
    especificacaoTecnica,
    termoComercial,
    modoEnvio,
    lojaOficial,
    quantidadeEstoque,
    sku,
    larguraFabrica,
    alturaFabrica,
    comprimentoFabrica,
    pesoFabrica,
    larguraEnvio,
    alturaEnvio,
    comprimentoEnvio,
    pesoEnvio,
    condicao,
    semCompatibilidadeConfirmada: semCompatConfirmado,
    tipoGarantia,
    mesesGarantia,
    limiteVenda,
    informacaoRegulatoria,
    caracteristicasSecundarias,
    logistica: copiaLeve(logisticaConferencia, 60000),
    contaDestinoML,
    anuncioIdPAIIA,
    // Até quando as edições do Novo Anúncio já foram trazidas para cá.
    edicoesNovoAnuncio: edicoesNA.marcas,
  };
  const assinaturaFicha = JSON.stringify([camposFicha, Boolean(anuncioConferido), validado, etapaFluxo]);
  useEffect(() => {
    if (!chaveConferencia) return;
    const conferidoLeve = anuncioConferido && assinaturaAprovadaRef.current ? copiaLeve(anuncioConferido) : null;
    const payloadLeve = conferidoLeve && validado ? copiaLeve(payloadTeste) : null;
    gravarFichaConferencia(chaveConferencia, {
      campos: camposFicha,
      origem: origemConferenciaRef.current,
      anuncioConferido: conferidoLeve,
      payloadTeste: payloadLeve,
      assinaturaAprovada: conferidoLeve ? assinaturaAprovadaRef.current : "",
      aprovacaoAnterior: conferidoLeve ? null : copiaLeve(aprovacaoGuardadaRef.current),
      etapa: conferidoLeve ? etapaFluxo : "conferencia",
      salvoEm: new Date().toISOString(),
      versaoBase: versaoFichaRef.current.id === anuncioIdPAIIA ? versaoFichaRef.current.versao : "",
    });
  }, [assinaturaFicha]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ao entrar na PUBLICAÇÃO: grava a ficha aprovada na base PAIIA (mesmo ID
  // se já existir) com tudo o que foi aprovado. É dela que o F5/reabertura
  // recupera o anúncio — não do estado da tela nem do navegador.
  useEffect(() => {
    if (etapaFluxo !== "publicacao" || !anuncioConferido || !assinaturaAprovadaRef.current) return;
    const chaveGravacao = `${anuncioIdPAIIA}|${assinaturaAprovadaRef.current}`;
    if (fichaBaseGravadaRef.current === chaveGravacao && fichaBase.pronta) return;
    // Abrir uma ficha já aprovada (F5, ?ficha=, Central, Voltar) é LEITURA:
    // a ficha aprovada só é gravada por ação explícita (aprovar/finalizar).
    if (!usuarioEditouRef.current && !gravacaoInicialPermitidaRef.current) {
      if (!fichaBase.pronta) setFichaBase({ pronta: true, erro: "" });
      return;
    }
    if (conflitoFichaRef.current) {
      if (!fichaBase.pronta) setFichaBase({ pronta: true, erro: "" });
      return;
    }
    if (gravandoFichaRef.current) return;
    gravandoFichaRef.current = true;
    (async () => {
      // Anúncio de origem COMPLETO o bastante para reconstruir a tela em
      // qualquer computador: fotos aprovadas (URLs), dados e base de peça.
      // (O mlAnuncioTeste do navegador não guarda fotos — por isso não serve.)
      const { fotos: _f, imagens: _i, banners: _b, ...resto } = anuncio || {};
      const anuncioLeve = copiaLeve(resto, 150000) || copiaLeve({
        codigo: anuncio?.codigo, oem: anuncio?.oem, titulo: anuncio?.titulo, descricao: anuncio?.descricao,
        preco: anuncio?.preco, tipoAnuncio: anuncio?.tipoAnuncio, aplicacoes: anuncio?.aplicacoes,
      }, 150000) || {};
      const fotosAprovadas = Array.isArray(anuncioConferido.fotos) ? anuncioConferido.fotos : [];
      const dados = {
        versao: 2,
        anuncio: { ...anuncioLeve, fotos: fotosAprovadas, imagens: fotosAprovadas },
        ficha: copiaLeve({
          campos: { ...camposFicha, anuncioIdPAIIA: "" },
          origem: origemConferenciaRef.current,
          anuncioConferido,
          payloadTeste: copiaLeve(payloadTeste),
          assinaturaAprovada: assinaturaAprovadaRef.current,
          etapa: "publicacao",
        }, 200000),
      };
      // Rascunho ainda sendo criado: usa o MESMO ID (nunca duas fichas).
      const idRascunho = anuncioIdPAIIA || (criandoFichaPorCodigo.has(chaveConferencia) ? await criandoFichaPorCodigo.get(chaveConferencia).catch(() => "") : "") || idFichaRef.current || "";
      if (conflitoFichaRef.current) {
        gravandoFichaRef.current = false;
        if (montadoRef.current) setFichaBase({ pronta: true, erro: "" });
        return;
      }
      if (montadoRef.current) setGravacao({ estado: ESTADO_GRAVACAO.SALVANDO, erro: "" });
      const r = await naFilaDeGravacao(() =>
        salvarFichaAprovada({
          anuncioId: idRascunho,
          codigo: anuncio?.codigo || anuncio?.oem || anuncioConferido.codigo,
          titulo: anuncioConferido.titulo,
          dadosConferencia: dados,
          versaoEsperada: versaoEsperadaPara(idRascunho),
        })
      );
      gravandoFichaRef.current = false;
      if (r.ok && r.versao) {
        versaoFichaRef.current = { id: r.anuncioId, versao: r.versao };
        atualizarVersaoLocal(r.anuncioId, r.versao);
      }
      if (r.ok) gravacaoInicialPermitidaRef.current = false;
      if (r.conflito) {
        conflitoFichaRef.current = true;
        if (montadoRef.current) {
          setFichaBase({ pronta: true, erro: "" });
          abrirConflitoRef.current?.();
        }
        return;
      }
      // O ID criado nunca é descartado (mesmo se o efeito foi refeito).
      if (r.ok) {
        fichaBaseGravadaRef.current = `${r.anuncioId}|${assinaturaAprovadaRef.current}`;
        if (!montadoRef.current) return;
        if (r.anuncioId !== anuncioIdPAIIA) setAnuncioIdPAIIA(r.anuncioId);
        setFichaBase({ pronta: true, erro: "" });
        setGravacao({ estado: ESTADO_GRAVACAO.SALVO, erro: "" });
      } else if (montadoRef.current) {
        setFichaBase({ pronta: true, erro: r.erro || "Não foi possível gravar a ficha na base PAIIA." });
        setGravacao({ estado: ESTADO_GRAVACAO.NAO_SALVO, erro: r.erro || "" });
      }
    })();
  }, [etapaFluxo, anuncioConferido, anuncioIdPAIIA]); // eslint-disable-line react-hooks/exhaustive-deps

  // =====================================================
  // RASCUNHO NA BASE PAIIA desde o início do anúncio
  // Uma ficha por anúncio em andamento; toda alteração da Conferência é
  // gravada nela (fonte de verdade do F5, do "voltar" e de outro navegador).
  // =====================================================
  const fotosFicha = urlsFotosFicha(fotos);
  const fotosForaDaFicha = (Array.isArray(fotos) ? fotos.length : 0) - fotosFicha.length;
  const aprovadoAgora = Boolean(anuncioConferido && assinaturaAprovadaRef.current);
  // A confirmação das fotos (marca) também precisa chegar à base.
  const assinaturaRascunho = JSON.stringify([assinaturaFicha, fotosFicha, aplicacoesManuais, aprovadoAgora, situacaoFotos.estado === "ok"]);
  const idFichaRef = useRef(anuncioIdPAIIA);
  useEffect(() => { if (anuncioIdPAIIA) idFichaRef.current = anuncioIdPAIIA; }, [anuncioIdPAIIA]);
  const rascunhoRef = useRef({ timer: 0, gravando: false, pendente: false, ultima: "", confirmadoNestaTela: fichaConfirmada, fechada: "" });
  function montarDadosFicha() {
    const { fotos: _f, imagens: _i, banners: _b, ...resto } = anuncio || {};
    const anuncioLeve = copiaLeve(resto, 150000) || copiaLeve({
      codigo: anuncio?.codigo, oem: anuncio?.oem, titulo: anuncio?.titulo, descricao: anuncio?.descricao,
      preco: anuncio?.preco, tipoAnuncio: anuncio?.tipoAnuncio, aplicacoes: anuncio?.aplicacoes,
      compatibilidades: anuncio?.compatibilidades,
    }, 150000) || {};
    const aprovado = Boolean(anuncioConferido && assinaturaAprovadaRef.current);
    // Marca = esta ficha + ESTA lista de fotos (só quando são desta ficha).
    const fotosFichaId = situacaoFotos.estado === "ok" ? marcaDasFotos(anuncioIdPAIIA || idFichaRef.current, fotosFicha) : "";
    const campos = { ...camposFicha, anuncioIdPAIIA: "", fotos: fotosFicha, fotosFichaId, aplicacoesManuais };
    const ficha =
      copiaLeve({
        campos,
        origem: origemConferenciaRef.current,
        anuncioConferido: aprovado ? anuncioConferido : null,
        payloadTeste: aprovado && validado ? copiaLeve(payloadTeste) : null,
        assinaturaAprovada: aprovado ? assinaturaAprovadaRef.current : "",
        aprovacaoAnterior: aprovado ? null : aprovacaoGuardadaRef.current,
        etapa: aprovado ? etapaFluxo : "conferencia",
        fotosForaDaFicha,
      }, 400000) ||
      copiaLeve({ campos, origem: origemConferenciaRef.current, etapa: "conferencia", assinaturaAprovada: "" }, 400000);
    return {
      versao: 3,
      salvo_em: new Date().toISOString(),
      anuncio: { ...anuncioLeve, fotos: fotosFicha, imagens: fotosFicha },
      ficha,
    };
  }
  const montarDadosRef = useRef(montarDadosFicha);
  montarDadosRef.current = montarDadosFicha;
  const assinaturaRascunhoRef = useRef(assinaturaRascunho);
  assinaturaRascunhoRef.current = assinaturaRascunho;
  const aprovadoRef = useRef(aprovadoAgora);
  aprovadoRef.current = aprovadoAgora;

  async function gravarRascunhoNaBase() {
    const st = rascunhoRef.current;
    st.timer = 0;
    if (montadoRef.current) setGravacaoPendente(false);
    if (!chaveConferencia || !anuncio) return { ok: true };
    // Sem edição real e sem ação explícita: abrir/navegar não grava nada.
    if (!usuarioEditouRef.current && !gravacaoInicialPermitidaRef.current) return { ok: true, semEdicao: true };
    if (st.gravando) { st.pendente = true; return { ok: true, emAndamento: true }; }
    const assinatura = assinaturaRascunhoRef.current;
    if (assinatura === st.ultima && idFichaRef.current) return { ok: true };
    st.gravando = true;
    try {
      let id = idFichaRef.current || "";
      if (!id && criandoFichaPorCodigo.has(chaveConferencia)) {
        id = (await criandoFichaPorCodigo.get(chaveConferencia).catch(() => "")) || "";
      }
      if (id && st.fechada === id) return { ok: true, fechada: true }; // ficha publicada/cancelada: nunca é regravada
      // Conflito aberto: nenhuma versão sobrescreve a outra até o usuário escolher.
      if (conflitoFichaRef.current) return { ok: false, conflito: true, erro: "Esta ficha possui duas versões diferentes." };
      if (montadoRef.current) setGravacao({ estado: ESTADO_GRAVACAO.SALVANDO, erro: "" });
      const dados = montarDadosRef.current();
      const pedido = naFilaDeGravacao(() =>
        salvarRascunhoFicha({
          anuncioId: id,
          codigo: anuncio?.codigo || anuncio?.oem || codigo,
          titulo: tituloAnuncio,
          dadosConferencia: dados,
          aprovada: aprovadoRef.current,
          // Ficha antiga (já publicada) guardada para este código: só nesta
          // abertura da Conferência vira um anúncio NOVO; depois, nunca.
          // Ficha CONHECIDA (veio do Novo Anúncio, da base ou já gravada aqui)
          // nunca vira outra ficha: publicada = não grava mais nada.
          criarSeFechada: !st.confirmadoNestaTela && !fichaIdDoAnuncio && !String(fichaSalva?.campos?.anuncioIdPAIIA || "") && !window.__paiiaFichaRecuperada && !st.publicadaNestaTela,
          versaoEsperada: versaoEsperadaPara(id),
        })
      );
      if (!id) {
        criandoFichaPorCodigo.set(chaveConferencia, pedido.then((r) => (r.ok ? r.anuncioId : "")));
      }
      const r = await pedido;
      if (!id) criandoFichaPorCodigo.delete(chaveConferencia);
      if (r.ok && r.versao) {
        versaoFichaRef.current = { id: r.anuncioId, versao: r.versao };
        atualizarVersaoLocal(r.anuncioId, r.versao);
      }
      if (r.conflito) {
        conflitoFichaRef.current = true;
        if (montadoRef.current) abrirConflitoRef.current?.();
        return { ok: false, conflito: true, erro: "Esta ficha possui duas versões diferentes." };
      } else if (r.ok) {
        gravacaoInicialPermitidaRef.current = false;
        if (montadoRef.current) setGravacao({ estado: ESTADO_GRAVACAO.SALVO, erro: "" });
        st.ultima = assinatura;
        st.confirmadoNestaTela = true;
        idFichaRef.current = r.anuncioId;
        if (montadoRef.current) {
          if (r.anuncioId !== anuncioIdPAIIA) setAnuncioIdPAIIA(r.anuncioId);
          setFichaConfirmada(true);
          setAvisoRascunho("");
        }
      } else if (r.fechada) {
        st.fechada = id;
        if (montadoRef.current) setAvisoRascunho("Esta ficha já foi publicada: alterações aqui não são gravadas nela.");
        return { ok: true, fechada: true };
      } else {
        if (montadoRef.current) {
          setAvisoRascunho(r.erro || "Não foi possível gravar o rascunho na base PAIIA.");
          setGravacao({ estado: ESTADO_GRAVACAO.NAO_SALVO, erro: r.erro || "" });
        }
        return { ok: false, erro: r.erro || "Não foi possível gravar o rascunho na base PAIIA." };
      }
      return { ok: true };
    } catch (erro) {
      if (montadoRef.current) setGravacao({ estado: ESTADO_GRAVACAO.NAO_SALVO, erro: String(erro?.message || erro || "") });
      return { ok: false, erro: String(erro?.message || erro || "falha ao gravar") };
    } finally {
      st.gravando = false;
      if (st.pendente) {
        st.pendente = false;
        gravarRascunhoNaBase();
      }
    }
  }
  const gravarRascunhoRef = useRef(gravarRascunhoNaBase);
  gravarRascunhoRef.current = gravarRascunhoNaBase;

  // Cada alteração grava na MESMA ficha (pequena espera para juntar a digitação).
  useEffect(() => {
    if (!chaveConferencia || !anuncio) return undefined;
    // Só grava depois de edição real (ou na 1ª abertura da Conferência).
    if (!usuarioEditouRef.current && !gravacaoInicialPermitidaRef.current) return undefined;
    const st = rascunhoRef.current;
    window.clearTimeout(st.timer);
    setGravacaoPendente(true);
    st.timer = window.setTimeout(() => gravarRascunhoRef.current(), st.ultima ? 800 : 0);
    return undefined;
  }, [assinaturaRascunho]); // eslint-disable-line react-hooks/exhaustive-deps

  // =====================================================
  // CONFLITO DE VERSÕES — nunca escolhido sozinho, nada é descartado.
  // =====================================================
  function fichaDestaTela() {
    const local = chaveConferencia ? lerMapaLocal(CHAVE_CONFERENCIA)[chaveConferencia] || null : null;
    return {
      campos: { ...camposFicha, fotos: fotosFicha },
      anuncioConferido: anuncioConferido && assinaturaAprovadaRef.current ? anuncioConferido : null,
      assinaturaAprovada: anuncioConferido ? assinaturaAprovadaRef.current : "",
      salvoEm: String(local?.salvoEm || ""),
    };
  }
  async function abrirConflito(baseLida) {
    const id = idFichaRef.current || anuncioIdPAIIA;
    if (!id) return;
    let base = baseLida || null;
    if (!base) {
      const r = await obterAnuncio(id);
      if (!r.ok) {
        if (montadoRef.current) setGravacao({ estado: ESTADO_GRAVACAO.NAO_SALVO, erro: r.erro || "" });
        return;
      }
      base = r.anuncio;
    }
    conflitoFichaRef.current = true;
    const local = fichaDestaTela();
    if (!montadoRef.current) return;
    setConflito({
      id,
      versaoTela: local.salvoEm,
      versaoBase: String(base?.dados_conferencia?.salvo_em || base?.updated_at || ""),
      diferencas: compararVersoesFicha(local, base?.dados_conferencia?.ficha || {}),
      base,
    });
    setGravacao({ estado: ESTADO_GRAVACAO.CONFLITO, erro: "" });
  }
  const abrirConflitoRef = useRef(null);
  abrirConflitoRef.current = abrirConflito;

  // Manter a versão DESTA TELA: grava por cima da versão da base que o
  // usuário viu (se a base mudar de novo, o conflito reaparece). A versão
  // da base substituída fica guardada na própria ficha (versoes_substituidas).
  async function manterVersaoDaTela() {
    const c = conflito;
    if (!c || resolvendoConflito) return;
    setResolvendoConflito("tela");
    const dadosBase = c.base?.dados_conferencia || {};
    const dados = montarDadosRef.current();
    dados.versoes_substituidas = [
      ...(Array.isArray(dadosBase.versoes_substituidas) ? dadosBase.versoes_substituidas.slice(-2) : []),
      copiaLeve({ substituida_em: new Date().toISOString(), salvo_em: dadosBase.salvo_em || "", ficha: dadosBase.ficha || null, anuncio: dadosBase.anuncio || null }, 250000) || { substituida_em: new Date().toISOString(), salvo_em: dadosBase.salvo_em || "" },
    ];
    const r = await naFilaDeGravacao(() =>
      salvarRascunhoFicha({
        anuncioId: c.id,
        codigo: anuncio?.codigo || anuncio?.oem || codigo,
        titulo: tituloAnuncio,
        dadosConferencia: dados,
        aprovada: aprovadoRef.current,
        criarSeFechada: false,
        versaoEsperada: String(dadosBase.salvo_em || ""),
      })
    );
    if (!montadoRef.current) return;
    setResolvendoConflito("");
    if (r.ok) {
      conflitoFichaRef.current = false;
      versaoFichaRef.current = { id: c.id, versao: r.versao };
      atualizarVersaoLocal(c.id, r.versao);
      rascunhoRef.current.ultima = assinaturaRascunhoRef.current;
      fichaBaseGravadaRef.current = `${c.id}|${assinaturaAprovadaRef.current}`;
      gravacaoInicialPermitidaRef.current = false;
      setConflito(null);
      setFichaConfirmada(true);
      setFichaBase({ pronta: true, erro: "" });
      setGravacao({ estado: ESTADO_GRAVACAO.SALVO, erro: "" });
    } else if (r.conflito) {
      abrirConflito();
    } else {
      setGravacao({ estado: ESTADO_GRAVACAO.NAO_SALVO, erro: r.erro || "" });
    }
  }
  // Usar a versão da BASE: a cópia desta tela é guardada no navegador
  // (paiiaVersaoDescartada:<ID>) antes de a tela ser remontada pela base.
  function usarVersaoDaBase() {
    const c = conflito;
    if (!c || resolvendoConflito) return;
    setResolvendoConflito("base");
    try {
      const mapa = lerMapaLocal(CHAVE_CONFERENCIA);
      localStorage.setItem(`paiiaVersaoDescartada:${c.id}`, JSON.stringify({ guardada_em: new Date().toISOString(), copia: mapa[chaveConferencia] || null }));
      const rec = montarRecuperacaoDaFicha(c.base, null);
      if (!rec.ok) {
        setResolvendoConflito("");
        setGravacao({ estado: ESTADO_GRAVACAO.NAO_SALVO, erro: rec.erro });
        return;
      }
      mapa[rec.chave] = rec.fichaConferencia;
      localStorage.setItem(CHAVE_CONFERENCIA, JSON.stringify(mapa));
      localStorage.setItem("mlAnuncioTeste", JSON.stringify({ ...rec.anuncio, fichaIdPAIIA: c.id }));
      window.__paiiaAnuncioSimulador = null;
      guardarFotosEmMemoria(window, rec.fotos, { fichaIdPAIIA: c.id, codigo: rec.anuncio?.codigo });
      window.__paiiaFichaRecuperada = rec.id;
      const url = new URL(window.location.href);
      url.searchParams.set("ficha", c.id);
      url.searchParams.set("tela", "mercadoLivreTeste");
      url.hash = ""; // sem #: senão o navegador só rola e não recarrega
      window.location.replace(url.toString());
    } catch (erro) {
      setResolvendoConflito("");
      setGravacao({ estado: ESTADO_GRAVACAO.NAO_SALVO, erro: String(erro?.message || erro) });
    }
  }

  // Ao abrir: compara (só LEITURA) a versão desta tela com a da base.
  // Mesma versão → segue. Versões diferentes com o mesmo conteúdo → adota a
  // versão (cura o falso conflito). Conteúdo diferente → conflito visível.
  useEffect(() => {
    const id = anuncioIdPAIIA;
    if (!id) return undefined;
    let ativo = true;
    const inicial = typeof window !== "undefined" ? window.__paiiaConflitoInicial : null;
    if (inicial && inicial.id === id) {
      window.__paiiaConflitoInicial = null;
      abrirConflito(inicial.base);
      return undefined;
    }
    if (window.__paiiaFichaRecuperada === id) {
      setGravacao({ estado: ESTADO_GRAVACAO.SALVO, erro: "" });
      return undefined;
    }
    if (!fichaSalva) return undefined;
    (async () => {
      const r = await obterAnuncio(id);
      if (!ativo || !r.ok || publicacaoExiste(r.anuncio.publicacao)) return;
      const d = r.anuncio.dados_conferencia || {};
      if (!d.ficha) return; // base ainda sem Conferência: nada a comparar
      const local = chaveConferencia ? lerMapaLocal(CHAVE_CONFERENCIA)[chaveConferencia] || null : null;
      const dec = decidirAberturaFicha({ id, local, baseDados: d, baseAtualizadaEm: r.anuncio.updated_at });
      if (dec.acao === "mesma_versao") {
        setGravacao({ estado: ESTADO_GRAVACAO.SALVO, erro: "" });
        setFichaConfirmada(true);
        return;
      }
      if (dec.acao === "conteudo_igual") {
        versaoFichaRef.current = { id, versao: String(d.salvo_em || "") };
        atualizarVersaoLocal(id, d.salvo_em);
        setGravacao({ estado: ESTADO_GRAVACAO.SALVO, erro: "" });
        setFichaConfirmada(true);
        return;
      }
      if (dec.diferencas.length) abrirConflito(r.anuncio);
    })();
    return () => { ativo = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function usarFotosDoNovoAnuncio() {
    const lista = (fotosNovoAnuncioFicha || []).map((u, i) => ({ imagem_processada: u, imagem_original: u, ordem: i, capa: i === 0 }));
    if (!lista.length) return;
    usuarioEditouRef.current = true;
    salvarFotosNoSimulador(lista);
  }
  // Escolha consciente do usuário: estas fotos são deste anúncio.
  function confirmarFotosDaFicha() {
    usuarioEditouRef.current = true;
    setFotosConfirmadasNaTela(true);
  }
  // Troca manual intencional: volta as fotos que tinham sido ignoradas.
  function restaurarFotosIgnoradas() {
    const lista = fotosDaBase.ignoradas.map((u, i) => ({ imagem_processada: u, imagem_original: u, ordem: i, capa: i === 0 }));
    if (!lista.length) return;
    setIgnoradasRestauradas(true);
    salvarFotosNoSimulador(lista);
  }

  const pendenteDeGravar = gravacaoPendente || gravacao.estado === ESTADO_GRAVACAO.SALVANDO;
  const estadoIndicador = conflito ? ESTADO_GRAVACAO.CONFLITO : pendenteDeGravar ? ESTADO_GRAVACAO.SALVANDO : gravacao.estado;
  const indicadorGravacao = estadoIndicador ? (
    <div
      data-paiia-indicador-gravacao={estadoIndicador}
      style={{
        display: "inline-block",
        margin: "8px 0 0",
        padding: "4px 12px",
        borderRadius: "999px",
        fontSize: "13px",
        fontWeight: "bold",
        background: estadoIndicador === ESTADO_GRAVACAO.SALVO ? "#14532d" : estadoIndicador === ESTADO_GRAVACAO.SALVANDO ? "#1e3a8a" : "#7f1d1d",
        color: estadoIndicador === ESTADO_GRAVACAO.SALVO ? "#bbf7d0" : estadoIndicador === ESTADO_GRAVACAO.SALVANDO ? "#bfdbfe" : "#fecaca",
      }}
    >
      {TEXTO_GRAVACAO[estadoIndicador]}
      {estadoIndicador === ESTADO_GRAVACAO.NAO_SALVO && gravacao.erro ? ` — ${gravacao.erro}` : ""}
    </div>
  ) : null;
  const horario = (v) => {
    const d = new Date(v);
    return v && !Number.isNaN(d.getTime()) ? d.toLocaleString("pt-BR") : "—";
  };
  const painelConflito = conflito ? (
    <section data-paiia-conflito-versoes style={{ ...bloco, border: "2px solid #f87171", background: "#450a0a" }}>
      <h3 style={{ color: "#fecaca", margin: "0 0 8px" }}>⚠ Esta ficha possui duas versões diferentes.</h3>
      <p style={{ color: "#fecaca", margin: "0 0 4px" }}>
        Versão desta tela: <b data-paiia-conflito-versao-tela>{horario(conflito.versaoTela)}</b> · Versão da base: <b data-paiia-conflito-versao-base>{horario(conflito.versaoBase)}</b>
      </p>
      <p style={{ ...textoAuxiliar, color: "#fca5a5" }}>
        Nenhuma das duas foi descartada. Enquanto você não escolher, nada é gravado e a publicação fica bloqueada.
      </p>
      {conflito.diferencas.length ? (
        <table data-paiia-conflito-diferencas style={{ width: "100%", borderCollapse: "collapse", margin: "8px 0", color: "#fee2e2", fontSize: "13px" }}>
          <thead>
            <tr><th style={{ textAlign: "left" }}>Campo</th><th style={{ textAlign: "left" }}>Nesta tela</th><th style={{ textAlign: "left" }}>Na base</th></tr>
          </thead>
          <tbody>
            {conflito.diferencas.map((d) => (
              <tr key={d.campo} data-paiia-conflito-campo={d.campo}>
                <td style={{ padding: "4px 6px", borderTop: "1px solid #7f1d1d" }}>{d.rotulo}</td>
                <td style={{ padding: "4px 6px", borderTop: "1px solid #7f1d1d" }}>{String(d.tela || "—").slice(0, 120)}</td>
                <td style={{ padding: "4px 6px", borderTop: "1px solid #7f1d1d" }}>{String(d.base || "—").slice(0, 120)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p style={{ ...textoAuxiliar, color: "#fca5a5" }}>As versões têm horários diferentes.</p>
      )}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <button type="button" data-paiia-navegacao data-paiia-manter-versao-tela onClick={manterVersaoDaTela} disabled={Boolean(resolvendoConflito)} style={{ ...botaoPrincipal, padding: "10px 16px" }}>
          {resolvendoConflito === "tela" ? "⏳ Gravando..." : "Manter versão desta tela"}
        </button>
        <button type="button" data-paiia-navegacao data-paiia-usar-versao-base onClick={usarVersaoDaBase} disabled={Boolean(resolvendoConflito)} style={botaoSecundario}>
          {resolvendoConflito === "base" ? "⏳ Abrindo..." : "Usar versão da base"}
        </button>
      </div>
    </section>
  ) : null;
  // Aviso das fotos desta ficha (Conferência e etapa de publicação).
  const painelAvisoFotos = (situacaoFotos.estado === "outra_origem" || situacaoFotos.estado === "confirmar") && (
          <div
            data-paiia-aviso-fotos-outra-ficha={situacaoFotos.estado}
            style={{ marginTop: "12px", padding: "12px", borderRadius: "10px", border: "1px solid #f59e0b", background: "#451a03", color: "#fde68a", fontSize: "13px", lineHeight: 1.5 }}
          >
            <strong>⚠ Confira as fotos desta ficha.</strong> {situacaoFotos.motivo} A aprovação e a publicação ficam bloqueadas até você escolher. Nada é apagado.
            {listaUrls(fotosNovoAnuncioFicha).length > 0 && (
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", margin: "8px 0" }}>
                {listaUrls(fotosNovoAnuncioFicha).slice(0, 6).map((u) => (
                  <img key={u} src={u} alt="Foto do Novo Anúncio" style={{ width: "64px", height: "64px", objectFit: "contain", background: "#fff", borderRadius: "6px" }} />
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "8px" }}>
              {listaUrls(fotosNovoAnuncioFicha).length > 0 && (
                <button type="button" data-paiia-usar-fotos-novo-anuncio onClick={usarFotosDoNovoAnuncio} style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #fbbf24", background: "#b45309", color: "#fff", fontWeight: "bold", cursor: "pointer" }}>
                  Usar as fotos do Novo Anúncio desta ficha
                </button>
              )}
              <button type="button" data-paiia-confirmar-fotos-ficha onClick={confirmarFotosDaFicha} style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #64748b", background: "transparent", color: "#e2e8f0", cursor: "pointer" }}>
                Confirmo: estas fotos são deste anúncio
              </button>
            </div>
          </div>
        );
  const motivoBloqueioFicha = motivoBloqueioPublicacao({
    conflito: Boolean(conflito),
    gravacao: gravacao.estado,
    pendente: gravacaoPendente,
    erroFicha: fichaBase.erro || "",
    aprovada: Boolean(anuncioConferido),
  }) || (situacaoFotos.estado !== "ok" ? `Fotos desta ficha — ${situacaoFotos.motivo}` : "");

  // Saindo da tela com gravação pendente: grava na hora.
  useEffect(() => () => {
    const st = rascunhoRef.current;
    if (st.timer) {
      window.clearTimeout(st.timer);
      gravarRascunhoRef.current();
    }
  }, []);

  // Endereço da página identifica a ficha (?ficha=<ID>) desde a Conferência:
  // o F5 reabre a MESMA ficha, na etapa em que o usuário estava.
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const confirmada = fichaConfirmada || (fichaBase.pronta && !fichaBase.erro);
      if (anuncioIdPAIIA && confirmada && url.searchParams.get("ficha") !== anuncioIdPAIIA) {
        url.searchParams.set("ficha", anuncioIdPAIIA);
        window.history.replaceState(window.history.state, "", url.toString());
      }
    } catch {
      // sem acesso ao endereço: segue sem o atalho do F5
    }
  }, [anuncioIdPAIIA, fichaConfirmada, fichaBase]);

  // =====================================================
  // VOLTAR = SÓ NAVEGAR. Antes de sair desta tela a ficha é gravada na
  // base PAIIA (mesma ficha, mesmo ID). Se a gravação falhar, a tela NÃO é
  // abandonada em silêncio: o aviso fica aqui com "Tentar de novo" ou
  // "Sair mesmo assim". Nada é apagado, recriado ou publicado ao voltar.
  // =====================================================
  const [saida, setSaida] = useState({ salvando: false, tela: "", erro: "" });
  async function salvarFichaAntesDeSair() {
    try {
      salvarEstadoAtualDoTeste();
    } catch {
      // cópia do navegador é só conveniência
    }
    const st = rascunhoRef.current;
    if (st.timer) {
      window.clearTimeout(st.timer);
      st.timer = 0;
    }
    // Gravação em andamento: espera terminar (até ~10 s).
    for (let i = 0; i < 40 && st.gravando; i++) {
      await new Promise((ok) => setTimeout(ok, 250));
    }
    if (!chaveConferencia || !anuncio) return { ok: true };
    const pendente = assinaturaRascunhoRef.current !== st.ultima || !idFichaRef.current;
    if (!pendente) return { ok: true };
    const r = await gravarRascunhoRef.current();
    return r || { ok: true };
  }
  async function sairPara(tela, { semSalvar = false } = {}) {
    if (saida.salvando) return;
    if (!semSalvar) {
      setSaida({ salvando: true, tela, erro: "" });
      const r = await salvarFichaAntesDeSair();
      if (!r.ok) {
        if (montadoRef.current) setSaida({ salvando: false, tela, erro: r.erro || "Não foi possível salvar a ficha na base PAIIA." });
        return;
      }
    }
    if (montadoRef.current) setSaida({ salvando: false, tela: "", erro: "" });
    setScreen?.(tela);
  }
  const NOME_TELA = { centralPublicacao: "Central de Publicação", novoAnuncio: "Anúncio" };

  // ← Voltar ao Anúncio: só NAVEGA. Termina o salvamento da MESMA ficha,
  // relê a ficha na base e abre o Novo Anúncio com os dados DELA (fotos,
  // preço, frete, tipo de veículo, peso/medidas). Não cria ficha, não limpa
  // nada, não derruba aprovação.
  async function voltarAoNovoAnuncio() {
    if (saida.salvando) return;
    setSaida({ salvando: true, tela: "novoAnuncio", erro: "" });
    const r = await salvarFichaAntesDeSair();
    if (!r.ok) {
      if (montadoRef.current) setSaida({ salvando: false, tela: "novoAnuncio", erro: r.erro || "Não foi possível salvar a ficha na base PAIIA." });
      return;
    }
    const id = idFichaRef.current || anuncioIdPAIIA;
    try {
      const lida = id ? await obterAnuncio(id) : null;
      const rasc = lida?.ok ? rascunhoNovoAnuncioDaFicha(lida.anuncio) : null;
      if (rasc) {
        // Rascunho DESTA ficha (com as fotos dela) + limpa o que é de outro anúncio.
        abrirFichaNoNovoAnuncio(rasc);
      } else if (idFichaValido(id)) {
        // Sem a releitura: o Novo Anúncio abre pedindo ESTA ficha (nunca o
        // rascunho de outra; sem o dela aqui, relê pela base).
        const url = new URL(window.location.href);
        url.searchParams.set("tela", "novoAnuncio");
        url.searchParams.set("ficha", id);
        window.history.replaceState(window.history.state, "", url.toString());
      }
    } catch {
      // sem a releitura: o Novo Anúncio abre com o rascunho deste navegador
    }
    if (montadoRef.current) setSaida({ salvando: false, tela: "", erro: "" });
    setScreen?.("novoAnuncio");
  }

  // Volta da Publicação para um bloco da Conferência (ex.: ⑨) e rola até ele.
  const [rolarParaBloco, setRolarParaBloco] = useState("");
  function voltarParaBloco(id) {
    setRevisandoPublicacaoML(false);
    setRolarParaBloco(id);
  }
  useEffect(() => {
    if (!rolarParaBloco || etapaFluxo === "publicacao") return undefined;
    const t = setTimeout(() => {
      try {
        document.getElementById(rolarParaBloco)?.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch {
        // sem rolagem
      }
      setRolarParaBloco("");
    }, 150);
    return () => clearTimeout(t);
  }, [rolarParaBloco, etapaFluxo]);

  // Publicado: esta ficha está FECHADA (nunca regravada, nunca vira outra
  // ficha) e o estado do Novo Anúncio/Central deste navegador que apontava
  // para ela é limpo — um anúncio publicado não volta a parecer novo.
  function marcarPublicada(id) {
    rascunhoRef.current.fechada = id || idFichaRef.current || anuncioIdPAIIA;
    rascunhoRef.current.publicadaNestaTela = true;
    window.clearTimeout(rascunhoRef.current.timer);
    setGravacaoPendente(false);
    limparEstadoLocalDaFichaPublicada(id || anuncioIdPAIIA, chaveConferencia);
  }
  function abrirTelaFinal(id) {
    const alvo = id || idFichaRef.current || anuncioIdPAIIA;
    if (!alvo) return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("ficha", alvo);
      url.searchParams.set("tela", "mercadoLivreTeste");
      // Sem # (ex.: #na-etapa-... do Novo Anúncio): com o mesmo endereço + #
      // o navegador só rola a página e a tela final não abre.
      url.hash = "";
      window.location.assign(url.toString());
    } catch {
      setScreen?.("centralPublicacao");
    }
  }
  const avisoSaida = saida.erro ? (
    <section data-paiia-erro-ao-sair style={{ ...bloco, border: "1px solid #f87171", color: "#fecaca" }}>
      <p style={{ margin: "0 0 8px" }}>
        ❌ A ficha NÃO foi salva na base PAIIA: {saida.erro} Os dados continuam nesta tela e na cópia deste navegador.
      </p>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <button type="button" onClick={() => sairPara(saida.tela)} style={botaoSecundario}>🔁 Tentar salvar de novo</button>
        <button type="button" onClick={() => setSaida({ salvando: false, tela: "", erro: "" })} style={botaoSecundario}>Ficar nesta tela</button>
        <button type="button" data-paiia-sair-sem-salvar onClick={() => sairPara(saida.tela, { semSalvar: true })} style={botaoSecundario}>
          Sair mesmo assim para {NOME_TELA[saida.tela] || "a outra tela"}
        </button>
      </div>
    </section>
  ) : saida.salvando ? (
    <p data-paiia-salvando-ao-sair style={{ ...textoAuxiliar, color: "#bfdbfe" }}>⏳ Salvando a ficha antes de sair...</p>
  ) : null;

  function salvarEstadoAtualDoTeste() {
  try {
    const salvo =
      localStorage.getItem(
        "mlAnuncioTeste"
      );

    const base =
      salvo
        ? JSON.parse(salvo)
        : {};

    // Mídias possuem armazenamento próprio.
    // Não duplicamos Banner e Clip dentro
    // do mlAnuncioTeste.
    const {
      banner,
      banners,
      clip,
      clips,
      ...baseLimpa
    } = base;

  localStorage.setItem(
  "mlAnuncioTeste",
  JSON.stringify({
    ...baseLimpa,

    titulo:
      tituloAnuncio,

    codigo,

    preco,

    descricao,

    compatibilidades,

    observacaoCompatibilidade,

    canalVenda:
      canalVendaPublicacao,

    tipoAnuncio:
      modalidade,
  })
);
  } catch (erro) {
    console.error(
      "Erro ao preservar dados do simulador:",
      erro
    );
  }
}
  function exportarAnuncio() {
    if (!payloadTeste) {
      alert(
        "Valide o anúncio antes de exportar."
      );
      return;
    }

    const codigoArquivo =
      String(
        codigo ||
          numeroPeca ||
          "anuncio"
      )
        .trim()
        .replace(
          /[^a-zA-Z0-9-_]+/g,
          "-"
        ) || "anuncio";

    const blob =
      new Blob(
        [
          JSON.stringify(
            payloadTeste,
            null,
            2
          ),
        ],
        {
          type:
            "application/json;charset=utf-8",
        }
      );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;
    link.download =
      `appia-${codigoArquivo}.json`;

    document.body.appendChild(
      link
    );

    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  }

  function abrirMidiasAppia() {
    salvarEstadoAtualDoTeste();

    setScreen?.(
      "midiasAppia"
    );
  }

  function irParaCentralPublicacao() {
    sairPara("centralPublicacao");
  }

  async function validarAnuncio() {
    salvarEstadoAtualDoTeste();

    const faltando = [];

    // Fotos desta ficha: sem relação com o Novo Anúncio dela (ou ainda
    // conferindo) = não aprova.
    if (situacaoFotos.estado !== "ok") {
      faltando.push(`Fotos desta ficha — ${situacaoFotos.motivo}`);
    }

    setPendenciasRevisao([]);

    if (tituloAnuncio.trim().length > 60) {
      alert(
        "⚠ O título do Mercado Livre não pode passar de 60 caracteres."
      );
      setValidado(false);
      setPayloadTeste(null);
      setPendenciasRevisao([
        "Título acima de 60 caracteres.",
      ]);
      return;
    }

    if (!tituloAnuncio.trim()) {
      faltando.push(
        "Título"
      );
    }

    if (!preco) {
      faltando.push(
        "Preço"
      );
    }

    if (!descricao.trim()) {
      faltando.push(
        "Descrição"
      );
    }

    if (!fotos.length) {
      faltando.push(
        "Fotos"
      );
    }

    if (indicesRepetidos.size > 0) {
      alert(
        "❌ Publicação bloqueada.\n\n" +
          `${indicesRepetidos.size} foto(s) repetida(s) no anúncio. Remova as duplicadas no bloco ④ Fotos.`
      );
      setValidado(false);
      setPayloadTeste(null);
      setPendenciasRevisao([
        `${indicesRepetidos.size} foto(s) repetida(s): remova as duplicadas.`,
      ]);
      return;
    }

    if (fotos.length) {
      setValidandoFotos(true);

      const verificacaoFotos =
        await Promise.all(
          fotos.map(async (foto) => {
            const url =
              obterUrlFoto(foto);

            return {
              url,
              ...(await obterDimensoesFoto(
                url
              )),
            };
          })
        );

      setDimensoesFotos(
        verificacaoFotos
      );

      setValidandoFotos(false);

      const fotosInvalidas =
        verificacaoFotos.filter(
          (item) => !item.ok
        );

      if (fotosInvalidas.length) {
        alert(
          "❌ Publicação bloqueada.\n\n" +
          `${fotosInvalidas.length} foto(s) estão abaixo de 1200 x 1200 ou não puderam ser verificadas.\n\n` +
          "O PAIIA exige no mínimo 1200 x 1200 para o padrão de publicação."
        );

        setValidado(false);
        setPayloadTeste(null);
        setPendenciasRevisao([
          `${fotosInvalidas.length} foto(s) abaixo de 1200 x 1200 ou não verificadas.`,
        ]);
        return;
      }
    }

    // Categoria: confirmada por você, não rejeitada para o SKU, compatível
    // (caminho/domínio/tipo de veículo) e com o motivo sem GTIN quando exigido.
    const gtinPendente = (exigenciaCategoria?.pendentes || []).filter((p) => p.id === ATRIBUTO_MOTIVO_SEM_GTIN || p.tipo === "leitura");
    const confCategoria = conferirCategoriaParaPublicar({
      categoriaId,
      decisao: decisaoCategoria,
      rejeicoes: rejeicoesSKU,
      detalhe: categoriaId ? detalhesCategoria[categoriaId] || null : null,
      tipoVeiculo,
      textoPeca: textoPecaCategoria(),
      exigencias: exigenciaCategoria ? { ok: gtinPendente.length === 0, pendentes: gtinPendente } : null,
    });
    if (!confCategoria.ok) {
      faltando.push(...confCategoria.motivos.map((m) => `Categoria (bloco ⑮): ${m}`));
    }

    if (!marca.trim()) {
      faltando.push(
        "Marca"
      );
    }

    if (!numeroPeca.trim()) {
      faltando.push(
        "Número da peça"
      );
    }

    // Peso e medidas: nunca inventados. Vale a medida do bloco PESO E
    // EMBALAGEM (PAIIA) ou a embalagem de envio digitada no bloco ⑥.
    const medidaEnvioManual = [
      pesoEnvio,
      comprimentoEnvio,
      larguraEnvio,
      alturaEnvio,
    ].every(numeroPositivo);

    if (
      !logisticaConferencia?.medida &&
      !medidaEnvioManual
    ) {
      faltando.push(
        "Peso e medidas da embalagem"
      );
    }

    // Conferência ÚNICA: a publicação usa só a medida confirmada aqui.
    // Confirmar no bloco ⑥ evita ter de conferir de novo na publicação.
    if (
      contaSimulacaoML &&
      logisticaConferencia?.medida &&
      !logisticaConferencia?.confirmado
    ) {
      faltando.push(
        "Confirmação de peso e medidas (botão Confirmar no bloco ⑥)"
      );
    }

    // Só exige quando a categoria do ML tem Tipo de veículo (ou ainda não
    // foi possível conferir); categoria sem o campo não pede nada.
    if (
      !(tipoVeiculoML.estado === "ok" && tipoVeiculoML.existe === false) &&
      !normalizarTipoVeiculo(tipoVeiculo)
    ) {
      faltando.push(
        "Tipo de veículo"
      );
    }
    // Tipo escolhido que a categoria do ML não aceita: o PAIIA não troca
    // sozinho; o usuário ajusta a categoria ou o tipo.
    if (tipoVeiculoCategoria.estado === "incompativel") {
      faltando.push(
        "Tipo de veículo compatível com a categoria ML"
      );
    }

    if (!modoEnvio) {
      faltando.push(
        "Modo de envio"
      );
    }

    // Estoque: quantidade confirmada pelo usuário (nunca assumida).
    if (!normalizarQuantidade(quantidadeEstoque)) {
      faltando.push(
        "Estoque — informe a quantidade confirmada (número inteiro, 1 ou mais). O PAIIA não assume quantidade."
      );
    }

    if (!condicao) {
      faltando.push(
        "Condição"
      );
    }

    // Compatibilidade: sem aplicação estruturada o anúncio sairia SEM
    // compatibilidade no ML. Bloqueia, salvo confirmação explícita.
    const situacaoCompat = situacaoCompatibilidade({
      aplicacoes: aplicacoesConfirmadas,
      modelosSemDetalhes,
      descricao,
      semCompatibilidadeConfirmada: semCompatConfirmado,
    });
    if (situacaoCompat.bloqueia) {
      faltando.push(
        `Compatibilidade — ${situacaoCompat.soNaDescricao ? TEXTO_VEICULOS_SO_NA_DESCRICAO : TEXTO_SEM_APLICACAO} Cadastre as aplicações no bloco ⑨ ou marque "Publicar sem compatibilidade" se for intencional.`
      );
    }

    // Marca real (código OEM/"original" não é marca) e descrição sem
    // afirmar original/genuína sem comprovação.
    const problemaMarca = marca.trim() ? marcaInvalida(marca) : "";
    if (problemaMarca) {
      faltando.push(`Marca — ${problemaMarca}`);
    }
    if (descricaoAfirmaOriginal(descricao)) {
      faltando.push(
        'Descrição — afirma "original/genuína" sem comprovação. Use "Montar descrição padrão" ou corrija o texto.'
      );
    }
    // Modelos confirmados × descrição: só avisa. A descrição (que o usuário
    // pode ter editado) nunca é alterada sozinha; nada é inventado.
    if (modelosFaltandoDescricao.length) {
      faltando.push(
        `Descrição — ${TEXTO_MODELOS_FALTANDO} Faltando: ${modelosFaltandoDescricao.join(", ")}. Revise o texto (ou use "Montar descrição padrão"); nenhum ano, motor ou aplicação é inventado.`
      );
    }

    if (
      faltando.length > 0
    ) {
      setValidado(false);

      setPayloadTeste(
        null
      );

      setPendenciasRevisao(
        faltando.map(
          (item) =>
            item.includes(" — ")
              ? item
              : `${item} precisa ser preenchido.`
        )
      );

      alert(
        "⚠ Corrija antes de aprovar:\n\n" +
          faltando.join("\n")
      );

      return;
    }

    const imagensPublicacao = [
      ...fotos
        .map(
          obterUrlFoto
        )
        .filter(Boolean),
      ...bannersSelecionados.filter(
        Boolean
      ),
    ].filter(
      (url, index, lista) =>
        lista.indexOf(url) ===
        index
    );

    const videosPublicacao =
      clipsSelecionados
        .filter(Boolean)
        .filter(
          (url, index, lista) =>
            lista.indexOf(url) ===
            index
        );

    const payload = {
      modo:
        "SIMULADOR",

      titulo:
        tituloAnuncio,

      codigo,

      preco,

      categoria: {
  caminho:
    categoria,

  idMercadoLivre:
    categoriaId || null,
},

      venda: {
        canal:
          canalVendaPublicacao,

        modalidade,

        lojaOficial,

        estoque:
          quantidadeEstoque,

        sku,

        limiteUnidades:
          limiteVenda,
      },

      atributos: {
        marca,

        numeroPeca,

        gtin,

        tipoVeiculo,

        caracteristicasSecundarias,

        informacaoRegulatoria,
      },

      embalagemFabrica: {
        largura:
          larguraFabrica,

        altura:
          alturaFabrica,

        comprimento:
          comprimentoFabrica,

        peso:
          pesoFabrica,
      },

      embalagemEnvio: {
        largura:
          larguraEnvio,

        altura:
          alturaEnvio,

        comprimento:
          comprimentoEnvio,

        peso:
          pesoEnvio,
      },

      compatibilidade: {
        dados:
          compatibilidades,

        observacao:
          observacaoCompatibilidade,
      },

      imagens:
        imagensPublicacao,

      fotos:
        imagensPublicacao,

      banners:
        bannersSelecionados,

      videos:
        videosPublicacao,

      clips:
        videosPublicacao,

      envio:
        modoEnvio,

      pagamento:
        "Mercado Pago",

      descricao,

      condicao,

      garantia: {
        tipo:
          tipoGarantia,

        meses:
          mesesGarantia,
      },

      // Padrões fixos do Mercado Livre (garantia, retirada, regulatória).
      padroesML:
        padroesEsperadosConferencia(),
    };

    setPayloadTeste(
      payload
    );

    setValidado(true);
    setPendenciasRevisao([]);
    assinaturaAprovadaRef.current = assinaturaConferencia;
    aprovacaoGuardadaRef.current = null;
    divergentesNoCarregamentoRef.current = [];
    setAvisoAprovacao("");

    // Fotos do produto na ordem aprovada (banner e vídeo ficam separados).
    setAnuncioConferido(montarAnuncioConferidoAtual());

    localStorage.setItem(
      "mlPayloadTeste",
      JSON.stringify(
        payload
      )
    );

    alert(
      "✅ Simulação aprovada.\n\nNenhum dado foi enviado ao Mercado Livre."
    );
  }

  if (!anuncio) {
    return (
      <div
        style={{
          width: "100%",
          maxWidth: "1180px",
          margin:
            "30px auto",
        }}
      >
        <section style={cabecalho}>
          <h2
            style={{
              color:
                "#67e8f9",
            }}
          >
            🧪 Simulador Mercado Livre
          </h2>

          <p
            style={{
              color:
                "#fca5a5",
            }}
          >
            Nenhum anúncio de teste
            foi encontrado.
          </p>

          <button
            type="button"
            onClick={() =>
              setScreen?.(
                "centralPublicacao"
              )
            }
            style={botaoSecundario}
          >
            ← Voltar à Central de Publicação
          </button>
        </section>
      </div>
    );
  }

  // Etapa PUBLICAÇÃO: a Conferência já foi aprovada. Aqui só se escolhe a
  // conta de destino, valida no Mercado Livre e publica — sem conferir de novo.
  if (etapaFluxo === "publicacao" && anuncioConferido) {
    return (
      <div
        data-paiia-etapa-publicacao
        {...propsInteracao}
        data-paiia-tipo-anuncio={modalidade}
        data-paiia-aprovada={anuncioConferido ? "sim" : "nao"}
        style={{
          width: "100%",
          maxWidth: "1180px",
          margin: "30px auto",
        }}
      >
        <section style={cabecalho}>
          <h2 style={{ color: "#86efac", margin: "0 0 6px 0" }}>
            ✅ Conferência PAIIA aprovada
          </h2>
          <p style={{ color: "#bfdbfe", margin: 0 }}>
            {anuncioConferido.titulo} · Código {anuncioConferido.codigo}
          </p>
          {indicadorGravacao}
          <button
            type="button"
            data-paiia-editar-conferencia
            data-paiia-navegacao
            onClick={() => setRevisandoPublicacaoML(false)}
            style={{ ...botaoSecundario, marginTop: "12px" }}
          >
            ← Voltar à Conferência (editar)
          </button>
        </section>

        {painelConflito}
        {painelAvisoFotos && <section style={bloco}>{painelAvisoFotos}</section>}
        {!fichaBase.pronta ? (
          <section style={{ ...bloco, color: "#94a3b8" }} data-paiia-gravando-ficha>
            ⏳ Gravando a ficha aprovada deste anúncio na base PAIIA...
          </section>
        ) : (
          <>
            {fichaBase.erro && (
              <section style={{ ...bloco, color: "#fca5a5" }} data-paiia-erro-ficha>
                ❌ {fichaBase.erro} Sem a ficha na base, o F5 não consegue recuperar este anúncio e a publicação fica bloqueada.
              </section>
            )}
            <DecisaoBasePAIIA
              anuncioId={anuncioIdPAIIA}
              existeNaBase={Boolean(anuncio?.pecaEncontrada)}
              anuncioConferido={anuncioConferido}
              aplicacoes={aplicacoesConfirmadas}
              nomePeca={nomePeca}
            />
            <EscolherCanaisPublicacao
              key={anuncioIdPAIIA || "sem-ficha"}
              anuncioId={anuncioIdPAIIA}
              temContaML={contasMLDisponiveis.length > 0}
              onLiberarML={setMercadoLivreLiberado}
              onIrCentral={() => sairPara("centralPublicacao")}
            />
            {mercadoLivreLiberado && (
            <RevisaoPublicacaoML
              anuncio={registroFreteConf ? { ...anuncioConferido, freteML: registroFreteConf } : anuncioConferido}
              titulo={anuncioConferido.titulo}
              contaDestino={contaDestinoML}
              onContaDestino={setContaDestinoML}
              anuncioId={anuncioIdPAIIA}
              onAnuncioId={setAnuncioIdPAIIA}
              onFechar={() => setRevisandoPublicacaoML(false)}
              onVoltarCompatibilidades={() => voltarParaBloco("conf-bloco-9")}
              onPublicado={marcarPublicada}
              onAbrirTelaFinal={abrirTelaFinal}
              bloqueioFicha={motivoBloqueioFicha}
              quantidadeFicha={quantidadeEstoque}
              onQuantidadeConfirmada={(q) => {
                // Mesma quantidade na ficha: campo Estoque + anúncio aprovado.
                setQuantidadeEstoque(String(q));
                setAnuncioConferido((a) => (a ? { ...a, quantidade: q, quantidadeConfirmada: true } : a));
              }}
            />
            )}
          </>
        )}

        {avisoSaida}
        <div style={acoes}>
          <button
            type="button"
            data-paiia-voltar-central
            data-paiia-navegacao
            onClick={() => sairPara("centralPublicacao")}
            disabled={saida.salvando}
            style={botaoSecundario}
          >
            ← Voltar à Central de Publicação
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      {...propsInteracao}
      data-paiia-tela-conferencia
      data-paiia-tipo-anuncio={modalidade}
      data-paiia-aprovada={anuncioConferido ? "sim" : "nao"}
      style={{
        width: "100%",
        maxWidth: "1180px",
        margin: "30px auto",
      }}
    >
      {painelConflito}
      {avisoAprovacao && (
        <section data-paiia-aviso-aprovacao style={{ ...bloco, border: "2px solid #f59e0b", color: "#fde68a" }}>
          ⚠ {avisoAprovacao}
        </section>
      )}
      <section style={cabecalho} data-paiia-conferencia-paiia>
        {indicadorGravacao}
        <div
          style={{
            fontSize: "42px",
          }}
        >
          📋
        </div>

        <h2
          style={{
            color: "#67e8f9",
            margin:
              "8px 0 6px 0",
          }}
        >
          Conferência PAIIA — Mercado Livre
        </h2>

        <p
          style={{
            color: "#bfdbfe",
            margin: 0,
          }}
        >
          Confira os 16 blocos do anúncio. Nesta etapa nada é enviado ao
          Mercado Livre. Depois da Revisão final aprovada você escolhe a
          conta, valida no Mercado Livre e só publica com a sua autorização.
        </p>

        <p
          data-paiia-ficha-rascunho={fichaConfirmada && anuncioIdPAIIA ? anuncioIdPAIIA : ""}
          style={{ margin: "8px 0 0", fontSize: 12, color: avisoRascunho ? "#fca5a5" : fichaConfirmada ? "#86efac" : "#94a3b8" }}
        >
          {avisoRascunho
            ? `⚠ ${avisoRascunho} Sem a ficha na base, o F5 não consegue recuperar este anúncio.`
            : fichaConfirmada && anuncioIdPAIIA
              ? `💾 Ficha ${anuncioIdPAIIA.slice(0, 8)} salva na base PAIIA — o F5 e outro navegador reabrem este mesmo anúncio.`
              : "⏳ Criando a ficha deste anúncio na base PAIIA..."}
          {fotosForaDaFicha > 0 && ` ${fotosForaDaFicha} foto(s) sem endereço público (imagem embutida) não vão para a ficha: use fotos da Galeria.`}
        </p>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center", marginTop: "10px" }}>
          <button type="button" data-paiia-navegacao data-paiia-voltar-novo-anuncio onClick={voltarAoNovoAnuncio} disabled={saida.salvando} style={botaoSecundario}>
            ← Voltar ao Anúncio (fotos, preço, frete, dados técnicos)
          </button>
          <button type="button" data-paiia-navegacao data-paiia-voltar-central onClick={() => sairPara("centralPublicacao")} disabled={saida.salvando} style={botaoSecundario}>
            ← Voltar à Central de Publicação
          </button>
        </div>
        {avisoSaida}
      </section>

      {/* 1 - DADOS DO ANÚNCIO */}
      <section style={bloco} id="conf-bloco-1">
        <h3 style={titulo}>
          ① Dados do anúncio
        </h3>

        <Campo
          label="Título Mercado Livre"
          value={tituloAnuncio}
          onChange={
            setTituloAnuncio
          }
          placeholder="Produto + modelos + motor + ano + código"
          maxLength={60}
        />

        <div
          style={{
            marginTop: "7px",
            display: "flex",
            justifyContent:
              "space-between",
            gap: "10px",
            flexWrap: "wrap",
            fontSize: "12px",
          }}
        >
          <span
            style={{
              color: "#94a3b8",
            }}
          >
            Sugestão: produto + principais modelos + motor + ano + código.
          </span>

          <strong
            style={{
              color:
                tituloAnuncio.length >= 55
                  ? "#facc15"
                  : "#86efac",
            }}
          >
            {tituloAnuncio.length}/60
          </strong>
        </div>

        <div style={gradeDois}>
          <Campo
            label="Código"
            value={codigo}
            onChange={setCodigo}
            placeholder="Código da peça"
          />

          <Campo
            label="Preço"
            value={preco}
            onChange={setPreco}
            placeholder="0,00"
          />
        </div>

        <div
          style={{
            marginTop: "12px",
            padding: "12px",
            borderRadius: "10px",
            border:
              "1px solid #334155",
            background:
              "#020617",
            color: "#cbd5e1",
            fontSize: "13px",
          }}
        >
          🖼 {fotos.length} foto(s)
          recebida(s) do anúncio.
        </div>

        {painelAvisoFotos}
        {situacaoFotos.estado === "verificando" && fotos.length > 0 && (
          <div data-paiia-fotos-verificando style={{ marginTop: "8px", color: "#94a3b8", fontSize: "12px" }}>⏳ {situacaoFotos.motivo}</div>
        )}
        {ignoradasNaAbertura.length > 0 && (
          <div data-paiia-fotos-ignoradas={ignoradasNaAbertura.length} style={{ marginTop: "12px", padding: "12px", borderRadius: "10px", border: "1px solid #38bdf8", background: "#082f49", color: "#bae6fd", fontSize: "13px", lineHeight: 1.5 }}>
            ℹ️ {ignoradasNaAbertura.length} foto(s) que estavam gravadas nesta Conferência não são desta ficha e foram ignoradas: a ficha abre com as fotos do Novo Anúncio dela.
            Elas ficam guardadas no histórico da ficha (nada foi apagado).
            <div style={{ marginTop: "8px" }}>
              <button type="button" data-paiia-restaurar-fotos-ignoradas onClick={restaurarFotosIgnoradas} style={{ padding: "6px 10px", borderRadius: "8px", border: "1px solid #38bdf8", background: "transparent", color: "#e0f2fe", cursor: "pointer" }}>
                Restaurar as fotos ignoradas (só se foi intencional)
              </button>
            </div>
          </div>
        )}
      </section>

      {/* PEÇA — DADOS TÉCNICOS (só da peça; aplicações ficam no bloco ⑨) */}
      <section data-paiia-identificacao style={bloco}>
        <h3 style={titulo}>
          🔩 Peça — dados técnicos
        </h3>
        <p style={{ ...textoAuxiliar, marginTop: 0 }}>
          Só informações reais da PEÇA (base PAIIA, catálogo ou descrição do próprio anúncio). Veículos/aplicações: bloco ⑨ Compatibilidades. Palavras-chave: geradas automaticamente na Inteligência de Busca.
        </p>

        <div style={gradeDois}>
          <div data-paiia-nome-peca-bloco data-paiia-nome-peca-origem={nomePecaOrigem || ""}>
            <Campo
              label="Nome da peça"
              value={nomePeca}
              onChange={(v) => editarNomePeca(v, "manual")}
              placeholder="Ex.: Parafuso de aço, sensor, bico injetor..."
            />
            {nomePeca && nomePecaOrigem && ROTULO_ORIGEM_NOME[nomePecaOrigem] && (
              <div style={{ color: "#94a3b8", fontSize: "12px", marginTop: "2px" }}>Origem: {ROTULO_ORIGEM_NOME[nomePecaOrigem]}</div>
            )}
            {decisaoNomeInicial.estado === "confirmar" && !ORIGENS_NOME_USUARIO.has(nomePecaOrigem) && (
              <div data-paiia-nome-peca-confirmar style={{ marginTop: "6px", padding: "6px 8px", border: "1px solid #a16207", borderRadius: "6px", color: "#fde68a", fontSize: "13px" }}>
                ⚠ {decisaoNomeInicial.motivo}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "4px" }}>
                  {decisaoNomeInicial.sugestoes.map((sg) => (
                    <button key={sg.fonte + sg.nome} type="button" data-paiia-nome-peca-sugestao={sg.nome} onClick={() => editarNomePeca(sg.nome, "confirmado")} style={{ padding: "3px 8px", borderRadius: "6px", border: "1px solid #64748b", background: "#1e293b", color: "#e2e8f0", cursor: "pointer" }}>
                      Usar “{sg.nome}” ({sg.fonte})
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <label style={labelStyle}>
            Código / OEM
            <div data-paiia-codigo-oem style={{ ...campo, display: "grid", gap: "4px", color: "#e2e8f0" }}>
              {(() => {
                const ids = identificarCodigos({
                  codigo,
                  numeroPeca,
                  oem: anuncio?.oem,
                  codigoOemBase: anuncio?.pecaEncontrada?.codigo_oem,
                  equivalentesBase: anuncio?.pecaEncontrada?.codigo_equivalente,
                });
                if (!ids.length) return "—";
                return ids.map((c) => (
                  <div key={c.compacto} data-paiia-codigo-identificado={c.compacto}>
                    <strong>{c.codigo}</strong>{" "}
                    <span style={{ color: "#94a3b8", fontSize: "12px" }}>— {c.papeis.join(" · ")}</span>
                  </div>
                ));
              })()}
            </div>
          </label>
        </div>
        <p style={{ ...textoAuxiliar, marginTop: "6px" }}>
          {nomePecaBase
            ? "Nome vindo da base/catálogo do PAIIA. Corrija se necessário."
            : nomePeca
              ? "Corrija se necessário: o nome que você digitar ou confirmar é mantido."
              : "Nenhuma fonte confiável informou o nome da peça. Informe para usar na identificação."}{" "}
          O mesmo código escrito com ou sem espaços, pontos ou hífens aparece uma vez só.
        </p>

        {(() => {
          // Características técnicas JÁ confirmadas: as registradas nesta
          // ficha (campos antigos, preservados) e as rotuladas na descrição
          // do próprio anúncio. Só leitura; nada é inventado nem apagado.
          const lidos = extrairDadosDescricao(descricao);
          const itens = [];
          const vistos = new Set();
          const add = (rotulo, valor, fonte) => {
            const v = String(valor || "").trim();
            const k = normalizarTexto(v);
            if (!v || vistos.has(k)) return;
            vistos.add(k);
            itens.push({ rotulo, valor: v, fonte });
          };
          add("Função / localização", funcaoPeca, fonteFuncao || "registrado nesta ficha");
          add("Especificação / medida", especificacaoTecnica, "registrado nesta ficha");
          for (const f of lidos.funcoes) add("Função / localização", f, "descrição do anúncio");
          for (const m of lidos.medidas) add("Medida", m, "descrição do anúncio");
          if (!itens.length) return null;
          return (
            <div data-paiia-caracteristicas-confirmadas style={{ marginTop: "8px", padding: "10px 12px", borderRadius: "9px", border: "1px solid #334155", background: "#020617" }}>
              <div style={{ color: "#94a3b8", fontSize: "12px", fontWeight: "bold", marginBottom: "6px" }}>Características técnicas confirmadas</div>
              {itens.map((x) => (
                <div key={`${x.rotulo}-${x.valor}`} style={{ color: "#e2e8f0", fontSize: "13px" }}>
                  {x.rotulo}: <strong>{x.valor}</strong> <span style={{ color: "#64748b", fontSize: "11px" }}>({x.fonte})</span>
                </div>
              ))}
            </div>
          );
        })()}
      </section>

      {/* PAIIA - INTELIGÊNCIA DE BUSCA */}
      <section
        style={{
          ...bloco,
          border: "1px solid #0891b2",
          background:
            "linear-gradient(135deg,#0f172a,#083344)",
          boxShadow:
            "0 12px 30px rgba(8,145,178,.10)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            gap: "14px",
            flexWrap: "wrap",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              textAlign: "left",
              flex: "1 1 520px",
            }}
          >
            <h3
              style={{
                ...titulo,
                marginBottom: "6px",
              }}
            >
              🔎 PAIIA — Inteligência de Busca
            </h3>

            <div
              style={{
                color: "#a5f3fc",
                fontSize: "13px",
                lineHeight: "1.5",
              }}
            >
              Palavras-chave geradas AUTOMATICAMENTE com os dados confirmados
              do próprio produto: código/SKU/OEM (com e sem espaços, pontos e
              hífens), peça, categoria, sinônimos equivalentes, marca,
              características e veículos confirmados. Nada para preencher.
              Concorrentes ficam separados, só como sugestão.
            </div>
          </div>

          <button
            type="button"
            onClick={
              pesquisarConcorrenciaPaizinho
            }
            disabled={
              pesquisandoConcorrencia
            }
            style={{
              padding: "13px 18px",
              borderRadius: "10px",
              border:
                "1px solid #22d3ee",
              background: "#0e7490",
              color: "#ffffff",
              fontWeight: "bold",
              fontSize: "14px",
              cursor:
                pesquisandoConcorrencia
                  ? "wait"
                  : "pointer",
              opacity:
                pesquisandoConcorrencia
                  ? 0.75
                  : 1,
              whiteSpace: "nowrap",
            }}
          >
            {pesquisandoConcorrencia
              ? "⏳ Consultando concorrentes..."
              : resultadoConcorrencia
                ? "🔄 Atualizar sugestões de concorrentes"
                : "Ver sugestões de concorrentes (secundário)"}
          </button>
        </div>

        {(() => {
          // FONTE = dados confirmados do próprio produto (nunca concorrente).
          const lidos = extrairDadosDescricao(descricao);
          const pecaBase = anuncio?.pecaEncontrada || {};
          const dadosBusca = {
            codigos: [
              codigo, numeroPeca, anuncio?.oem,
              ...String(pecaBase.codigo_oem || "").split(/[,;\n]+/),
              ...String(pecaBase.codigo_equivalente || "").split(/[,;\n]+/),
              ...lidos.codigos,
            ],
            nomePeca,
            // Termo antigo digitado na ficha (preservado; o campo saiu da tela).
            termoComercial,
            funcao: funcaoPeca || lidos.funcoes[0] || "",
            medidas: [especificacaoTecnica, ...lidos.medidas].filter(Boolean),
            categoria: categoriaId ? categoria : "",
            marca,
            fabricante: pecaBase.fabricante || pecaBase.marca || "",
            aplicacoes: aplicacoesConfirmadas,
            modelos: modelosSemDetalhes,
          };
          const confirmados = termosConfirmados(dadosBusca);
          const intencoes = gerarIntencoesBusca(dadosBusca);
          const sugeridasConcorrentes = separarSugestoesConcorrentes(
            Array.isArray(resultadoConcorrencia?.palavrasChaveSugeridas) ? resultadoConcorrencia.palavrasChaveSugeridas : [],
            confirmados
          );
          const rotuloOrigem = {
            codigo: "Código/OEM", variacao: "Mesmo código, outra escrita", peca: "Peça", categoria: "Categoria",
            sinonimo: "Sinônimo equivalente (dicionário PAIIA)", marca: "Marca", fabricante: "Fabricante (base/catálogo)",
            funcao: "Função/localização", medida: "Especificação",
            montadora: "Montadora", modelo: "Modelo confirmado", motor: "Motor", ano: "Ano", versao: "Versão",
          };
          const caixa = { padding: "14px", borderRadius: "12px", border: "1px solid #164e63", background: "#020617", textAlign: "left" };
          const tituloCaixa = { color: "#67e8f9", fontSize: "12px", fontWeight: "bold", marginBottom: "10px" };
          return (
            <>
              <div data-paiia-termos-confirmados style={caixa}>
                <div style={tituloCaixa}>PALAVRAS-CHAVE AUTOMÁTICAS (DADOS CONFIRMADOS DO PRODUTO)</div>
                {confirmados.length ? (
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {confirmados.map((t) => (
                      <span key={`${t.origem}-${t.termo}`} title={rotuloOrigem[t.origem] || ""} style={{ ...chipPalavra, border: t.origem === "codigo" ? "1px solid #60a5fa" : chipPalavra.border }}>
                        {t.termo}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: "#94a3b8", fontSize: "13px" }}>Aguardando código, nome da peça ou compatibilidades confirmadas.</div>
                )}
              </div>

              <div data-paiia-intencoes-busca style={{ ...caixa, marginTop: "12px", background: "#082f49" }}>
                <div style={tituloCaixa}>🔍 COMO O COMPRADOR PODE PROCURAR ({intencoes.length})</div>
                {intencoes.length ? (
                  <div style={{ display: "grid", gap: "4px" }}>
                    {intencoes.map((x) => (
                      <div key={x.texto} data-tipo-busca={x.tipo} style={{ color: "#f8fafc", fontSize: "13px" }}>
                        {x.tipo === "codigo" ? "🔢" : x.tipo === "funcao" ? "🛠" : x.tipo === "sinonimo" ? "🔁" : "🚗"} {x.texto}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: "#94a3b8", fontSize: "13px" }}>Aguardando código ou nome da peça.</div>
                )}
                <div style={{ color: "#94a3b8", fontSize: "11px", marginTop: "8px" }}>
                  Buscas por código (quem conhece a peça) e por intenção (peça + veículo, ano/motor só quando confirmados, medida). O título continua com até 60 caracteres; estas buscas usam o conjunto completo.
                </div>
              </div>

              <details data-paiia-sugestoes-concorrentes style={{ ...caixa, marginTop: "12px", border: "1px dashed #334155" }}>
                <summary style={{ color: "#94a3b8", fontSize: "12px", cursor: "pointer" }}>
                  Sugestões de concorrentes — NÃO confirmadas, não usadas ({erroConcorrencia ? "erro" : sugeridasConcorrentes.length})
                </summary>
                <div style={{ color: "#94a3b8", fontSize: "12px", margin: "8px 0" }}>
                  {erroConcorrencia
                    ? `⚠️ ${erroConcorrencia}`
                    : "Palavras que aparecem em anúncios de concorrentes. Servem só para você avaliar sinônimos; não entram nos dados confirmados nem nas buscas acima."}
                </div>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {sugeridasConcorrentes.map((t) => (
                    <span key={t.termo} style={{ ...chipPalavra, opacity: 0.7, borderStyle: "dashed" }}>{t.termo}</span>
                  ))}
                </div>
              </details>

              <div style={{ marginTop: "12px", padding: "10px 12px", borderRadius: "9px", border: "1px dashed #155e75", color: "#94a3b8", background: "rgba(2,6,23,.55)", fontSize: "11px", lineHeight: "1.5", textAlign: "left" }}>
                ℹ️ Nesta etapa a PAIIA apenas organiza as buscas. O título e a descrição não são alterados automaticamente.
              </div>
            </>
          );
        })()}
      </section>

      {/* 2 - VENDA */}
      <section style={bloco}>
        <h3 style={titulo}>
          ② Condições de venda
        </h3>

        <div style={gradeDois}>
          <label style={labelStyle}>
            Canal / tipo de anúncio

            <div
              style={{
                ...campo,
                minHeight: "44px",
                display: "flex",
                alignItems: "center",
                fontWeight: "700",
                border:
                  canalVendaPublicacao ===
                  "shopee"
                    ? "1px solid #fb923c"
                    : modalidade ===
                        "premium"
                      ? "1px solid #22c55e"
                      : "1px solid #38bdf8",
                color:
                  canalVendaPublicacao ===
                  "shopee"
                    ? "#fdba74"
                    : modalidade ===
                        "premium"
                      ? "#86efac"
                      : "#7dd3fc",
              }}
            >
              {canalVendaPublicacao ===
              "shopee"
                ? "🟠 Shopee"
                : modalidade ===
                    "premium"
                  ? "🟢 Mercado Livre Premium"
                  : "🔵 Mercado Livre Clássico"}
            </div>

            <span
              style={{
                display: "block",
                marginTop: "6px",
                color: "#94a3b8",
                fontSize: "11px",
                lineHeight: 1.4,
              }}
            >
              Definido automaticamente na
              Inteligência Comercial do anúncio.
            </span>
          </label>

          <Campo
            label="Estoque (quantidade confirmada)"
            value={
              quantidadeEstoque
            }
            onChange={
              setQuantidadeEstoque
            }
            placeholder="Ex.: 68"
          />

          <Campo
            label="SKU"
            value={sku}
            onChange={setSku}
            placeholder="Código interno"
          />

          <Campo
            label="Loja oficial"
            value={
              lojaOficial
            }
            onChange={
              setLojaOficial
            }
            placeholder="Ex.: Torken"
          />
        </div>
      </section>

      {/* 3 - ENTREGA */}
      <section style={bloco}>
        <h3 style={titulo}>
          ③ Forma de entrega
        </h3>

        <label style={labelStyle}>
          Modo de envio

          <select
            value={modoEnvio}
            onChange={(e) =>
              setModoEnvio(
                e.target.value
              )
            }
            style={campo}
          >
            <option value="">
              Selecione
            </option>

            <option value="meli">
              Mercado Envios
            </option>

            <option value="full">
              Mercado Envios Full
            </option>

            <option value="flex">
              Mercado Envios Flex
            </option>

            <option value="retirada">
              Retirada
            </option>
          </select>
        </label>

        <p data-paiia-padrao-retirada style={{ color: "#bbf7d0", fontSize: 13, margin: "8px 0 0" }}>
          ✅ {LINHAS_FIXAS.retirada} — sempre ativa em todo anúncio novo, junto com o modo de envio.
        </p>
      </section>

      {/* 4 - FOTOS E MÍDIAS OPCIONAIS */}
      <section style={bloco} id="conf-bloco-4">
        <BotaoVoltarBloco alvo="conf-bloco-1">← Voltar aos Dados do anúncio (①)</BotaoVoltarBloco>
        <h3 style={titulo}>
          ④ Fotos do anúncio
        </h3>

        <div style={gradeFotos}>
          {fotos.map(
            (foto, index) => {
              const url =
                obterUrlFoto(
                  foto
                );

              const dimensao =
                dimensoesFotos[index];

              return (
                <div
                  key={
                    typeof foto ===
                    "string"
                      ? `${foto}-${index}`
                      : foto?.id ||
                        `${url}-${index}`
                  }
                  style={{
                    ...fotoCard,
                    position:
                      "relative",
                    height: "auto",
                    minHeight:
                      "170px",
                    padding:
                      "8px",
                    display:
                      "flex",
                    flexDirection:
                      "column",
                    gap: "7px",
                    border:
                      dimensao?.ok === false
                        ? "2px solid #ef4444"
                        : dimensao?.ok
                          ? "2px solid #22c55e"
                          : "1px solid #334155",
                  }}
                >
                  {index === 0 && (
                    <div
                      style={{
                        position:
                          "absolute",
                        top: "7px",
                        left: "7px",
                        zIndex: 3,
                        padding:
                          "4px 7px",
                        borderRadius:
                          "7px",
                        background:
                          "#16a34a",
                        color:
                          "#ffffff",
                        fontSize:
                          "10px",
                        fontWeight:
                          "bold",
                      }}
                    >
                      ⭐ CAPA
                    </div>
                  )}

                  <div
                    style={{
                      position:
                        "relative",
                      width: "100%",
                      height:
                        "120px",
                      borderRadius:
                        "8px",
                      overflow:
                        "hidden",
                      background:
                        "#ffffff",
                      display:
                        "flex",
                      alignItems:
                        "center",
                      justifyContent:
                        "center",
                    }}
                  >
                    {url ? (
                      <img
                        src={url}
                        alt={`Foto ${
                          index + 1
                        }`}
                        style={{
                          width:
                            "100%",
                          height:
                            "100%",
                          objectFit:
                            "contain",
                        }}
                      />
                    ) : (
                      <span
                        style={{
                          color:
                            "#64748b",
                        }}
                      >
                        Sem imagem
                      </span>
                    )}

                    {dimensao && (
                      <span
                        style={{
                          position:
                            "absolute",
                          left: "5px",
                          right: "5px",
                          bottom:
                            "5px",
                          padding:
                            "3px 5px",
                          borderRadius:
                            "6px",
                          background:
                            "rgba(2,6,23,0.88)",
                          color:
                            dimensao.ok
                              ? "#86efac"
                              : "#fca5a5",
                          fontSize:
                            "10px",
                          fontWeight:
                            "bold",
                          textAlign:
                            "center",
                        }}
                      >
                        {dimensao.aberta === false
                          ? "❌ não abriu"
                          : `${dimensao.largura} × ${dimensao.altura}${
                              dimensao.quadrada
                                ? " · quadrada"
                                : " · NÃO quadrada"
                            }`}
                      </span>
                    )}
                  </div>

                  <div
                    data-paiia-foto-origem
                    style={{
                      fontSize: "10px",
                      color: "#94a3b8",
                      lineHeight: 1.4,
                    }}
                  >
                    Foto {index + 1}
                    {index === 0 ? " (capa)" : ""} · {origemFoto(foto)}
                    {indicesRepetidos.has(index) && (
                      <div
                        data-paiia-foto-repetida
                        style={{
                          color: "#fca5a5",
                          fontWeight: "bold",
                        }}
                      >
                        ⚠ REPETIDA
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      display:
                        "grid",
                      gridTemplateColumns:
                        "repeat(2,1fr)",
                      gap: "6px",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        moverFoto(
                          index,
                          -1
                        )
                      }
                      disabled={
                        index === 0
                      }
                      style={{
                        padding:
                          "7px",
                        borderRadius:
                          "7px",
                        border:
                          "1px solid #2563eb",
                        background:
                          index === 0
                            ? "#1e293b"
                            : "#1d4ed8",
                        color:
                          "#ffffff",
                        cursor:
                          index === 0
                            ? "not-allowed"
                            : "pointer",
                      }}
                    >
                      ⬅
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        moverFoto(
                          index,
                          1
                        )
                      }
                      disabled={
                        index ===
                        fotos.length - 1
                      }
                      style={{
                        padding:
                          "7px",
                        borderRadius:
                          "7px",
                        border:
                          "1px solid #2563eb",
                        background:
                          index ===
                          fotos.length - 1
                            ? "#1e293b"
                            : "#1d4ed8",
                        color:
                          "#ffffff",
                        cursor:
                          index ===
                          fotos.length - 1
                            ? "not-allowed"
                            : "pointer",
                      }}
                    >
                      ➡
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        trocarFotoPublicacao(
                          index
                        )
                      }
                      style={{
                        padding:
                          "7px",
                        borderRadius:
                          "7px",
                        border:
                          "1px solid #22d3ee",
                        background:
                          "#083344",
                        color:
                          "#cffafe",
                        cursor:
                          "pointer",
                      }}
                    >
                      🔄 Trocar
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        excluirFotoPublicacao(
                          index
                        )
                      }
                      style={{
                        padding:
                          "7px",
                        borderRadius:
                          "7px",
                        border:
                          "1px solid #ef4444",
                        background:
                          "#450a0a",
                        color:
                          "#fecaca",
                        cursor:
                          "pointer",
                      }}
                    >
                      🗑
                    </button>
                  </div>
                </div>
              );
            }
          )}
        </div>

        <div
          style={{
            marginTop: "10px",
            padding: "10px 12px",
            borderRadius: "9px",
            border:
              "1px solid #2563eb",
            background:
              "#0b1736",
            color:
              "#bfdbfe",
            fontSize: "12px",
            textAlign: "center",
          }}
        >
          ⭐ A primeira imagem é a capa. Use ⬅ ➡ para mudar a ordem,
          🔄 para trocar e 🗑 para excluir.
        </div>

        <div style={resumoLinha}>
          <span>Fotos</span>

          <strong>
            {fotos.length}
          </strong>
        </div>

       <div
  style={{
    ...resumoLinha,
    border:
      dimensoesFotos.some(
        (item) => !item.ok
      )
        ? "1px solid #ef4444"
        : "1px solid #22c55e",
  }}
>
  <span>
    📐 Resolução mínima
  </span>

  <strong
    style={{
      color:
        dimensoesFotos.some(
          (item) => !item.ok
        )
          ? "#fca5a5"
          : "#86efac",
    }}
  >
    {dimensoesFotos.length === 0
      ? "Verificando..."
      : dimensoesFotos.every(
            (item) => item.ok
          )
        ? "✅ Todas 1200 × 1200 ou maiores"
        : "❌ Corrigir fotos abaixo de 1200 × 1200"}
  </strong>
</div>

        <div
          data-paiia-conferencia-fotos
          style={{
            ...resumoLinha,
            display: "grid",
            gap: "4px",
            border:
              indicesRepetidos.size > 0 ||
              dimensoesFotos.some((item) => item.aberta === false)
                ? "1px solid #ef4444"
                : "1px solid #334155",
          }}
        >
          <span>
            🔁 Fotos repetidas:{" "}
            <strong style={{ color: indicesRepetidos.size ? "#fca5a5" : "#86efac" }}>
              {indicesRepetidos.size
                ? `${indicesRepetidos.size} — remova as duplicadas`
                : "nenhuma"}
            </strong>
          </span>
          <span>
            ⬛ Imagens quadradas:{" "}
            <strong>
              {dimensoesFotos.length === 0
                ? "verificando..."
                : `${dimensoesFotos.filter((item) => item.quadrada).length} de ${dimensoesFotos.length}`}
            </strong>
            {dimensoesFotos.some((item) => item.aberta && !item.quadrada) &&
              " — o padrão PAIIA é 1200 × 1200 (quadrada)."}
          </span>
          <span>
            🚫 Imagens que não abriram:{" "}
            <strong style={{ color: dimensoesFotos.some((item) => item.aberta === false) ? "#fca5a5" : "#86efac" }}>
              {dimensoesFotos.filter((item) => item.aberta === false).length}
            </strong>
          </span>
          <span style={{ color: "#fde68a" }}>
            ℹ️ Padrão PAIIA/Mercado Livre: 1200 × 1200, fundo branco, peça em
            destaque, sem deformar e sem alterar características reais. O PAIIA
            não corrige nem modifica a peça automaticamente: confira cada foto.
          </span>
        </div>

        <div
          id="secao-midias-publicacao"
          style={{
            marginTop: "18px",
            paddingTop: "18px",
            borderTop:
              "1px solid #1e3a5f",
            scrollMarginTop: "130px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
              marginBottom: "14px",
            }}
          >
            <div>
              <h4
                style={{
                  color: "#67e8f9",
                  margin: "0 0 4px 0",
                  fontSize: "18px",
                }}
              >
                🎬 Clip do anúncio
              </h4>

              <p
                style={{
                  ...textoAuxiliar,
                  margin: 0,
                }}
              >
                Opcional. Adicione um vídeo ao anúncio quando quiser.
              </p>
            </div>

            <strong
              style={{
                color:
                  clipsSelecionados.length
                    ? "#86efac"
                    : "#94a3b8",
                padding: "7px 11px",
                borderRadius: "999px",
                border:
                  clipsSelecionados.length
                    ? "1px solid #22c55e"
                    : "1px solid #475569",
                background:
                  clipsSelecionados.length
                    ? "#052e16"
                    : "#0f172a",
                fontSize: "12px",
              }}
            >
              {clipsSelecionados.length
                ? `✅ ${clipsSelecionados.length} selecionado(s)`
                : "○ Opcional"}
            </strong>
          </div>

          {clipsSelecionados.length > 0 && (
            <div
              style={{
                marginBottom: "14px",
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit,minmax(220px,320px))",
                justifyContent: "center",
                gap: "12px",
              }}
            >
              {clipsSelecionados.map(
                (url, index) => (
                  <div
                    key={`${url}-${index}`}
                    style={{
                      padding: "10px",
                      borderRadius: "14px",
                      border:
                        "1px solid #334155",
                      background: "#020617",
                    }}
                  >
                    <video
                      src={url}
                      controls
                      preload="metadata"
                      playsInline
                      style={{
                        width: "100%",
                        aspectRatio: "16 / 9",
                        objectFit: "contain",
                        borderRadius: "10px",
                        background: "#000000",
                        display: "block",
                      }}
                    />

                    <button
                      type="button"
                      onClick={() =>
                        removerClipSelecionado(
                          url
                        )
                      }
                      style={{
                        width: "100%",
                        marginTop: "8px",
                        padding: "8px",
                        borderRadius: "9px",
                        border:
                          "1px solid #ef4444",
                        background: "#450a0a",
                        color: "#fecaca",
                        cursor: "pointer",
                        fontWeight: "bold",
                      }}
                    >
                      🗑 Remover clip
                    </button>
                  </div>
                )
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              salvarEstadoAtualDoTeste();

              localStorage.setItem(
                "retornarParaMidiasPublicacao",
                "true"
              );

              localStorage.setItem(
                "abaMidiasAppia",
                "videos"
              );

              setScreen?.(
                "midiasAppia"
              );
            }}
            style={{
              width: "100%",
              padding: "14px 18px",
              borderRadius: "12px",
              border:
                "1px solid #22d3ee",
              background:
                clipsSelecionados.length
                  ? "#0f172a"
                  : "linear-gradient(135deg,#2563eb,#0891b2)",
              color: "#ffffff",
              fontWeight: "bold",
              cursor: "pointer",
              fontSize: "15px",
            }}
          >
            {clipsSelecionados.length
              ? "🎬 Trocar Clip"
              : "🎬 Escolher Clip"}
          </button>
        </div>
      </section>

      {/* 5 - CARACTERÍSTICAS */}
      <section style={bloco}>
        <h3 style={titulo}>
          ⑤ Características principais
        </h3>

        <div style={gradeDois}>
          <Campo
            label="Marca"
            value={marca}
            onChange={setMarca}
            placeholder="Ex.: Bosch"
          />

          <Campo
            label="Número da peça"
            value={numeroPeca}
            onChange={
              setNumeroPeca
            }
            placeholder="Código da peça"
          />

          <Campo
            label="GTIN / EAN"
            value={gtin}
            onChange={setGtin}
            placeholder="Opcional"
          />

          <label style={labelStyle}>
            Tipo de veículo
            <select
              data-paiia-tipo-veiculo
              data-paiia-tipo-veiculo-origem={tipoVeiculoOrigem || "vazio"}
              value={normalizarTipoVeiculo(tipoVeiculo)}
              onChange={(e) => escolherTipoVeiculoManual(e.target.value)}
              style={campo}
            >
              {!normalizarTipoVeiculo(tipoVeiculo) && <option value="">Selecione...</option>}
              {OPCOES_TIPO_VEICULO.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
            <span data-paiia-tipo-veiculo-ajuda style={{ ...textoAuxiliar, fontWeight: "normal" }}>
              {tipoVeiculoOrigem === ORIGEM_MANUAL && normalizarTipoVeiculo(tipoVeiculo)
                ? "Escolhido por você — salvo na ficha; o PAIIA não troca."
                : tipoVeiculoOrigem === "padrao" && normalizarTipoVeiculo(tipoVeiculo)
                  ? "Padrão de ficha nova (Carro/Caminhonete). Pode trocar na seta."
                  : normalizarTipoVeiculo(tipoVeiculo)
                    ? "Salvo na ficha. Pode trocar na seta."
                    : tipoVeiculo && !normalizarTipoVeiculo(tipoVeiculo)
                      ? `Valor antigo "${tipoVeiculo}" não é uma das opções: escolha Carro/Caminhonete ou Linha Pesada.`
                      : "Escolha Carro/Caminhonete ou Linha Pesada."}
              {sugestaoDiferente && (
                <span data-paiia-tipo-veiculo-sugestao> O PAIIA sugere {sugestaoTipoVeiculo.valor}{sugestaoTipoVeiculo.origem === "categoria" ? " pela categoria do Mercado Livre" : sugestaoTipoVeiculo.origem === "aplicacoes" ? " pelas aplicações confirmadas" : ""} — troque só se for o caso (nada é trocado sozinho).</span>
              )}
              {tipoVeiculoML.estado === "carregando"
                ? " Lendo a categoria no Mercado Livre..."
                : tipoVeiculoML.estado === "sem_categoria"
                  ? " (Defina a Categoria ML no bloco ⑮ para o PAIIA conferir.)"
                  : tipoVeiculoML.estado === "sem_conta"
                    ? " (Sem conta Mercado Livre conectada: categoria não conferida.)"
                    : tipoVeiculoML.estado === "erro"
                      ? " (Não foi possível ler a categoria no Mercado Livre agora.)"
                      : ""}
            </span>
            {sugestaoTipoVeiculo.divergencia && tipoVeiculoOrigem !== ORIGEM_MANUAL && (
              <span data-paiia-tipo-veiculo-divergencia style={{ ...textoAuxiliar, fontWeight: "normal", color: "#fbbf24" }}>
                ⚠ As aplicações confirmadas indicam {sugestaoTipoVeiculo.aplicacoes}, mas a categoria é de {sugestaoTipoVeiculo.valor}. Confira a categoria.
              </span>
            )}
            {(tipoVeiculoCategoria.estado === "incompativel" || tipoVeiculoCategoria.estado === "nao_se_aplica") && (
              <span
                data-paiia-tipo-veiculo-categoria={tipoVeiculoCategoria.estado}
                style={{ ...textoAuxiliar, fontWeight: "normal", color: tipoVeiculoCategoria.estado === "incompativel" ? "#f87171" : "#94a3b8" }}
              >
                {tipoVeiculoCategoria.estado === "incompativel" ? "⚠ " : ""}{tipoVeiculoCategoria.texto}
              </span>
            )}
          </label>
        </div>
      </section>

      {/* 6 - EMBALAGEM */}
      <section style={bloco} id="conf-bloco-6">
        <BotaoVoltarBloco alvo="conf-bloco-4">← Voltar às Fotos (④)</BotaoVoltarBloco>
        <h3 style={titulo}>
          ⑥ Peso e Embalagem
        </h3>

        <div data-paiia-conferencia-peso style={{ marginBottom: "16px" }}>
          {contaSimulacaoML ? (
            <PesoEmbalagemML
              sku={sku || numeroPeca || codigo}
              categoriaId={categoriaId}
              preco={preco}
              tipoAnuncio={modalidade}
              contaML={contaSimulacaoML}
              onChange={setLogisticaConferencia}
              valorInicial={logisticaInicial}
              registroFrete={registroFreteConf}
              semTitulo
            />
          ) : (
            <p style={textoAuxiliar}>
              Sem conta Mercado Livre ativa: informe a embalagem de envio
              abaixo (peso e medidas). O PAIIA não inventa peso nem medida.
            </p>
          )}

        </div>

        {/* Com conta ML ativa, o bloco PESO E EMBALAGEM acima é o principal:
            as medidas de fábrica/envio ficam recolhidas (continuam valendo). */}
        <details
          data-paiia-outras-medidas
          open={!contaSimulacaoML}
          style={{ marginTop: "4px" }}
        >
          <summary style={{ color: "#64748b", fontSize: "12px", cursor: "pointer" }}>
            Outras medidas de embalagem (fábrica e envio manual)
          </summary>

        <h4 style={subtitulo}>
          📦 Embalagem de fábrica
        </h4>

        <div style={gradeQuatro}>
          <Campo
            label="Largura cm"
            value={larguraFabrica}
            onChange={
              setLarguraFabrica
            }
          />

          <Campo
            label="Altura cm"
            value={alturaFabrica}
            onChange={
              setAlturaFabrica
            }
          />

          <Campo
            label="Comprimento cm"
            value={
              comprimentoFabrica
            }
            onChange={
              setComprimentoFabrica
            }
          />

          <Campo
            label="Peso kg"
            value={pesoFabrica}
            onChange={
              setPesoFabrica
            }
          />
        </div>

        <h4 style={subtitulo}>
          🚚 Embalagem de envio
        </h4>

        <div style={gradeQuatro}>
          <Campo
            label="Largura cm"
            value={larguraEnvio}
            onChange={
              setLarguraEnvio
            }
          />

          <Campo
            label="Altura cm"
            value={alturaEnvio}
            onChange={
              setAlturaEnvio
            }
          />

          <Campo
            label="Comprimento cm"
            value={
              comprimentoEnvio
            }
            onChange={
              setComprimentoEnvio
            }
          />

          <Campo
            label="Peso kg"
            value={pesoEnvio}
            onChange={
              setPesoEnvio
            }
          />
        </div>
        </details>
      </section>

      {/* 7 - SECUNDÁRIAS */}
      <section style={bloco}>
        <h3 style={titulo}>
          ⑦ Características secundárias
        </h3>

        {/* Compatibilidade tem UM lugar de edição: o bloco ⑨. Aqui só leitura,
            sempre igual ao texto gerado lá (sem a lista crua da base). */}
        <div data-paiia-compat-resumo style={{ whiteSpace: "pre-wrap", color: "#e2e8f0", fontSize: 14, background: "rgba(15,23,42,.6)", border: "1px solid #334155", borderRadius: 10, padding: 12, minHeight: 60 }}>
          {String(compatibilidades || "").trim() || "As aplicações confirmadas aparecerão aqui."}
        </div>
        <span style={textoAuxiliar}>Para incluir, editar ou remover, use o bloco ⑨ Compatibilidades.</span>
      </section>

      {/* 8 - REGULATÓRIA */}
      <section style={bloco}>
        <h3 style={titulo}>
          ⑧ Informação regulatória
        </h3>

        <p data-paiia-padrao-regulatoria style={{ color: "#bbf7d0", fontSize: 14, margin: 0 }}>
          ✅ {LINHAS_FIXAS.regulatoria}
        </p>
        <p style={{ color: "#94a3b8", fontSize: 12, margin: "6px 0 0" }}>
          Padrão fixo. Só é enviado quando a categoria do Mercado Livre oferece o campo; se o ML exigir o número do registro, a Publicação mostra e bloqueia.
        </p>
      </section>

      {/* 9 - COMPATIBILIDADE */}
      <section
  id="conf-bloco-9"
  style={{
    ...bloco,
    border:
      "1px solid #2563eb",
  }}
>
  <BotaoVoltarBloco alvo="conf-bloco-6">← Voltar ao Peso e Embalagem (⑥)</BotaoVoltarBloco>
  <h3 style={titulo}>
    ⑨ Compatibilidades
  </h3>

  <div
    style={{
      display: "flex",
      justifyContent:
        "space-between",
      alignItems: "center",
      gap: "12px",
      flexWrap: "wrap",
      marginBottom: "12px",
    }}
  >
    <p
      style={{
        ...textoAuxiliar,
        margin: 0,
      }}
    >
      Automáticas: vindas confirmadas da Base Mestre e dos catálogos
      técnicos do PAIIA. Manuais: cadastradas e confirmadas por você.
      O PAIIA não completa compatibilidade por suposição.
    </p>

    <span
      style={{
        padding:
          "7px 12px",
        borderRadius:
          "999px",
        border:
          "1px solid #22c55e",
        background:
          "#052e16",
        color:
          "#86efac",
        fontSize:
          "12px",
        fontWeight:
          "bold",
      }}
    >
      🚗 {totalCompatibilidades} aplicação(ões)
    </span>
  </div>

  {legadoAplicacoes.convertidas > 0 && (
    <p data-paiia-legado-convertido style={{ ...textoAuxiliar, color: "#fde68a" }}>
      ℹ️ {legadoAplicacoes.convertidas} linha(s) antiga(s) com vários modelos foram separadas em "Modelos confirmados — detalhes não informados" (sem inventar ano/motor).
    </p>
  )}

  {/* A) MODELOS CONFIRMADOS SEM DETALHES */}
  <div data-paiia-modelos-sem-detalhes style={{ padding: "12px", borderRadius: "10px", border: "1px solid #334155", background: "#020617", marginBottom: "12px" }}>
    <div style={{ color: "#e2e8f0", fontWeight: "bold", fontSize: "13px", marginBottom: "4px" }}>
      🚘 Modelos confirmados — detalhes não informados ({modelosSemDetalhes.length})
    </div>
    <p style={{ ...textoAuxiliar, margin: "0 0 8px" }}>
      A peça serve nesses modelos; ano, motor e versão não são informados (o PAIIA não completa).
    </p>
    <div style={{ display: "grid", gap: "6px", marginBottom: "8px" }}>
      {modelosSemDetalhes.length ? modelosSemDetalhes.map((m, i) =>
        modeloEditando.indice === i ? (
          <div key={`ed-${i}`} style={{ ...linhaAplicacao, gap: "6px", flexWrap: "wrap" }}>
            <input value={modeloEditando.montadora} onChange={(e) => setModeloEditando({ ...modeloEditando, montadora: e.target.value })} style={{ ...campo, maxWidth: 160 }} />
            <input value={modeloEditando.modelo} onChange={(e) => setModeloEditando({ ...modeloEditando, modelo: e.target.value })} style={{ ...campo, maxWidth: 220 }} />
            <span style={{ display: "flex", gap: "6px" }}>
              <button type="button" data-paiia-salvar-modelo onClick={salvarEdicaoModelo} style={botaoMini}>Salvar</button>
              <button type="button" onClick={() => setModeloEditando({ indice: -1, montadora: "", modelo: "" })} style={botaoMini}>Cancelar</button>
            </span>
          </div>
        ) : (
          <div key={`${m.montadora}-${m.modelo}`} data-paiia-modelo={`${m.montadora} ${m.modelo}`} style={linhaAplicacao}>
            <span>{m.montadora} {m.modelo}</span>
            <span style={{ display: "flex", gap: "6px" }}>
              <button type="button" data-paiia-editar-modelo onClick={() => setModeloEditando({ indice: i, montadora: m.montadora, modelo: m.modelo })} style={botaoMini}>Editar</button>
              <button type="button" data-paiia-remover-modelo onClick={() => removerModelo(i)} style={botaoMini}>Remover</button>
            </span>
          </div>
        )
      ) : (
        <span style={textoAuxiliar}>Nenhum modelo sem detalhes.</span>
      )}
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "minmax(140px, 1fr) minmax(220px, 3fr) auto", gap: "8px", alignItems: "end" }}>
      <Campo label="Montadora *" value={novosModelos.montadora} onChange={(v) => setNovosModelos({ ...novosModelos, montadora: v })} placeholder="Renault" />
      <Campo label="Modelos (separe por vírgula) *" value={novosModelos.modelos} onChange={(v) => setNovosModelos({ ...novosModelos, modelos: v })} placeholder="Logan, Sandero, Duster, Kangoo" />
      <button type="button" data-paiia-adicionar-modelos onClick={adicionarModelos} style={{ ...botaoMini, padding: "9px 14px", background: "#2563eb", border: "1px solid #2563eb", color: "#fff" }}>
        ➕ Adicionar modelos
      </button>
    </div>
  </div>

  {/* B) APLICAÇÕES DETALHADAS */}
  <div style={{ color: "#e2e8f0", fontWeight: "bold", fontSize: "13px", margin: "4px 0 6px" }}>
    🔧 Aplicações detalhadas ({aplicacoesConfirmadas.length})
  </div>
  <div data-paiia-lista-aplicacoes style={{ display: "grid", gap: "6px", marginBottom: "12px" }}>
    {aplicacoesConfirmadas.length ? (
      aplicacoesConfirmadas.map((a, i) => (
        <div key={i} data-paiia-aplicacao={textoAplicacao(a)} style={linhaAplicacao}>
          <span>{textoAplicacao(a)}</span>
          <span style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <span style={seloOrigemAplicacao(a.origem)}>{a.origem === "manual" ? "manual" : "base"}</span>
            <button type="button" data-paiia-editar-aplicacao onClick={() => editarAplicacao(a)} style={botaoMini}>Editar</button>
            <button type="button" data-paiia-remover-aplicacao onClick={() => removerAplicacao(a)} style={botaoMini}>Remover</button>
          </span>
        </div>
      ))
    ) : (
      <div style={{ ...linhaAplicacao, color: modelosSemDetalhes.length ? "#94a3b8" : "#fbbf24", fontWeight: "bold" }}>
        {modelosSemDetalhes.length ? "Nenhuma aplicação detalhada (há modelos confirmados acima)." : "⚠ PENDENTE — sem aplicação confirmada"}
      </div>
    )}
    {!aplicacoesConfirmadas.length && (
      <div data-paiia-sem-aplicacao style={{ marginTop: "8px", padding: "10px", borderRadius: "8px", border: "1px solid #f59e0b", background: "#451a03", color: "#fde68a", fontSize: "12px" }}>
        <div data-paiia-compat-so-modelos={modelosSemDetalhes.length ? "sim" : "nao"} style={{ fontWeight: "bold" }}>⚠ {modelosSemDetalhes.length ? textoSoModelosSemDetalhes(modelosSemDetalhes) : TEXTO_SEM_APLICACAO}</div>
        {situacaoCompatibilidade({ aplicacoes: aplicacoesConfirmadas, modelosSemDetalhes, descricao }).soNaDescricao && (
          <div data-paiia-veiculos-so-na-descricao style={{ marginTop: "6px" }}>{TEXTO_VEICULOS_SO_NA_DESCRICAO}</div>
        )}
        <label style={{ display: "flex", gap: "6px", alignItems: "center", marginTop: "8px", cursor: "pointer" }}>
          <input type="checkbox" data-paiia-publicar-sem-compat checked={semCompatConfirmado} onChange={(e) => setSemCompatConfirmado(e.target.checked)} />
          Publicar sem compatibilidade (confirmo que este anúncio não terá veículos vinculados no Mercado Livre)
        </label>
      </div>
    )}
    {aplicacoesBaseExcluidas.length > 0 && (
      <span style={textoAuxiliar}>
        {aplicacoesBaseExcluidas.length} aplicação(ões) da base removida(s) só deste anúncio.{" "}
        <button type="button" onClick={() => { setAplicacoesBaseExcluidas([]); const modelos = juntarModelos(modelosSemDetalhes, aplicacoesBaseSeparadas.modelos); setModelosSemDetalhes(modelos); atualizarTextoCompat({ base: aplicacoesBaseTodas, modelos }); }} style={botaoMini}>Restaurar</button>
      </span>
    )}
  </div>

  <div data-paiia-aplicacao-manual style={{ padding: "12px", borderRadius: "10px", border: `1px solid ${aplicacaoEditando ? "#f59e0b" : "#334155"}`, background: "#020617", marginBottom: "12px" }}>
    <div style={{ color: "#e2e8f0", fontWeight: "bold", fontSize: "13px", marginBottom: "6px" }}>
      {aplicacaoEditando ? "✏️ Editar aplicação detalhada" : "➕ Cadastrar aplicação detalhada"}
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "8px" }}>
      <Campo label="Montadora *" value={novaAplicacao.montadora} onChange={(v) => setNovaAplicacao({ ...novaAplicacao, montadora: v })} placeholder="Renault" />
      <Campo label="Modelo *" value={novaAplicacao.modelo} onChange={(v) => setNovaAplicacao({ ...novaAplicacao, modelo: v })} placeholder="Symbol" />
      <Campo label="Motor" value={novaAplicacao.motor} onChange={(v) => setNovaAplicacao({ ...novaAplicacao, motor: v })} placeholder="1.6 16V" />
      <Campo label="Ano inicial" value={novaAplicacao.anoInicio} onChange={(v) => setNovaAplicacao({ ...novaAplicacao, anoInicio: v })} placeholder="2009" maxLength={4} />
      <Campo label="Ano final" value={novaAplicacao.anoFim} onChange={(v) => setNovaAplicacao({ ...novaAplicacao, anoFim: v })} placeholder="2013" maxLength={4} />
      <Campo label="Versão" value={novaAplicacao.versao} onChange={(v) => setNovaAplicacao({ ...novaAplicacao, versao: v })} placeholder="Opcional" />
    </div>
    <p style={{ ...textoAuxiliar, marginTop: "6px" }}>
      Preencha só o que você confirmou. Campo em branco fica em branco — o PAIIA não completa ano, motor ou versão. Só montadora + modelo vai para "Modelos confirmados".
    </p>
    {avisoNovaAplicacao && <p style={{ color: "#fca5a5", fontSize: "12px", margin: "6px 0 0" }}>⚠ {avisoNovaAplicacao}</p>}
    <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
      <button type="button" data-paiia-confirmar-aplicacao onClick={confirmarNovaAplicacao} style={{ ...botaoMini, padding: "8px 14px", background: "#2563eb", border: "1px solid #2563eb", color: "#fff" }}>
        {aplicacaoEditando ? "✔ Salvar alteração" : "✔ Confirmar aplicação"}
      </button>
      {aplicacaoEditando && (
        <button type="button" onClick={cancelarEdicaoAplicacao} style={{ ...botaoMini, padding: "8px 14px" }}>Cancelar</button>
      )}
    </div>
  </div>

  <details>
    <summary style={{ color: "#64748b", fontSize: "12px", cursor: "pointer" }}>
      Texto das compatibilidades (gerado a partir da lista; pode ajustar)
    </summary>
    <AreaTexto
      value={compatibilidades}
      onChange={
        setCompatibilidades
      }
      placeholder="As aplicações confirmadas aparecerão aqui."
      minHeight="180px"
    />
  </details>
</section>

      {/* 10 - PAGAMENTO */}
      <section style={bloco}>
        <h3 style={titulo}>
          ⑩ Forma de pagamento
        </h3>

        <div style={resumoLinha}>
          <span>
            Mercado Pago
          </span>

          <strong
            style={{
              color: "#86efac",
            }}
          >
            ✅ Padrão Mercado Livre
          </strong>
        </div>
      </section>

      {/* 11 - DESCRIÇÃO */}
      <section style={bloco}>
        <h3 style={titulo}>
          ⑪ Descrição
        </h3>

        <AreaTexto
          value={descricao}
          onChange={
            setDescricao
          }
          placeholder="Descrição completa do anúncio"
          minHeight="220px"
        />
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
          <button
            type="button"
            data-paiia-montar-descricao
            onClick={() => {
              const nova = montarDescricaoPadrao({
                nomePeca,
                titulo: tituloAnuncio,
                aplicacoes: lerAplicacoesAprovadas({ texto: compatibilidades }),
                codigos: [numeroPeca, codigo, anuncio?.oem].filter(Boolean),
                condicao,
                mesesGarantia,
              });
              if (descricao.trim() && descricao.trim() !== nova && !window.confirm("Substituir a descrição atual pela descrição padrão montada com os dados aprovados?")) return;
              setDescricao(nova);
            }}
            style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "#334155", color: "#e2e8f0", cursor: "pointer", fontWeight: 700 }}
          >
            📝 Montar descrição padrão
          </button>
          <span style={{ color: "#94a3b8", fontSize: 12 }}>
            Usa só dados aprovados: peça, aplicações (modelo, motor, anos), códigos, condição, garantia e a orientação de conferir o código. Sem marca, sem montadora e sem "original".
          </span>
        </div>
        {descricaoAfirmaOriginal(descricao) && (
          <p style={{ color: "#fca5a5", fontSize: 13 }} data-paiia-descricao-original>
            ⚠ A descrição afirma "original/genuína". Sem comprovação isso não pode ser publicado.
          </p>
        )}
        {modelosFaltandoDescricao.length > 0 && (
          <p style={{ color: "#fde68a", fontSize: 13 }} data-paiia-modelos-fora-descricao={modelosFaltandoDescricao.join("|")}>
            ⚠ {TEXTO_MODELOS_FALTANDO} Faltando: <b>{modelosFaltandoDescricao.join(", ")}</b>. Revise a descrição antes de aprovar
            (o PAIIA não altera o texto sozinho e não inventa ano, motor ou aplicação).
          </p>
        )}
      </section>

      {/* 12 - LIMITE */}
      <section style={bloco}>
        <h3 style={titulo}>
          ⑫ Limite de unidades por venda
        </h3>

        <Campo
          label="Máximo por compra"
          value={limiteVenda}
          onChange={
            setLimiteVenda
          }
          placeholder="Opcional"
        />
      </section>

      {/* 13 - CONDIÇÃO */}
      <section style={bloco}>
        <h3 style={titulo}>
          ⑬ Condição
        </h3>

        <label style={labelStyle}>
          Condição do produto

          <select
            value={condicao}
            onChange={(e) =>
              setCondicao(
                e.target.value
              )
            }
            style={campo}
          >
            <option value="novo">
              Novo
            </option>

            <option value="usado">
              Usado
            </option>
          </select>
        </label>
      </section>

      {/* 14 - GARANTIA */}
      <section style={bloco}>
        <h3 style={titulo}>
          ⑭ Garantia
        </h3>

        <p data-paiia-padrao-garantia style={{ color: "#bbf7d0", fontSize: 14, margin: 0 }}>
          ✅ {LINHAS_FIXAS.garantia}
        </p>
        <p style={{ color: "#94a3b8", fontSize: 12, margin: "6px 0 0" }}>
          Padrão fixo de todo anúncio novo (Garantia do vendedor, 3 meses).
        </p>
      </section>

      {/* 15 - CATEGORIA */}
      <section
        style={{
          ...bloco,
          border:
            "1px solid #22d3ee",
        }}
      >
        <h3 style={titulo}>
  ⑮ Categoria Mercado Livre
</h3>

<div data-paiia-categoria-definida style={{ marginBottom: "10px" }}>
  {conflitoProduto && !categoriaId ? (
    <div data-paiia-conflito-produto style={{ color: "#fde68a", fontSize: "12px", marginBottom: "8px", lineHeight: 1.6 }}>
      <div style={{ color: "#fbbf24", fontWeight: "bold", fontSize: "13px" }}>
        PENDENTE — conflito na identificação do produto principal
      </div>
      <div>{conflitoProduto.fonte.startsWith("Base") ? "Base" : conflitoProduto.fonte}: <strong style={{ color: "#f8fafc" }}>{conflitoProduto.base}</strong></div>
      <div>Título: <strong style={{ color: "#f8fafc" }}>{conflitoProduto.titulo}</strong></div>
    </div>
  ) : produtoPrincipal.principal ? (
    <div data-paiia-produto-principal style={{ color: "#cbd5e1", fontSize: "12px", marginBottom: "8px", lineHeight: 1.5 }}>
      Produto principal (define a categoria): <strong style={{ color: "#f8fafc" }}>{produtoPrincipal.principal}</strong>
      {produtoPrincipal.fonte ? ` · fonte: ${produtoPrincipal.fonte}` : ""}
      {produtoPrincipal.acompanha.length ? (
        <div data-paiia-itens-inclusos style={{ color: "#94a3b8" }}>
          Acompanha (não define a categoria): {produtoPrincipal.acompanha.join(", ")}
        </div>
      ) : null}
    </div>
  ) : null}
</div>

<PainelCategoriaML
  carregando={carregandoCategoria}
  erro={erroCategoria}
  avaliacao={avaliacaoCategoria}
  evidencia={evidenciaCategoria}
  decisao={decisaoCategoria}
  categoriaId={categoriaId}
  categoriaCaminho={categoria}
  rejeicoes={rejeicoesSKU}
  restricoes={restricoesSKU}
  onRejeitarManual={rejeitarCategoriaManual}
  problemasSelecionada={categoriaId && !carregandoCategoria ? categoriaNaTela.motivos : []}
  exigenciaGtin={exigenciaGtin}
  onConfirmar={confirmarCategoria}
  onTrocar={trocarCategoria}
  onMotivoSemGtin={escolherMotivoSemGtin}
  termo={termoCategoria}
  onTermo={setTermoCategoria}
  onBuscar={buscarCategoriaManual}
/>

</section>

      {/* 16 - REVISÃO FINAL */}
      <section
        id="conf-bloco-16"
        style={{
          ...bloco,
          border: validado
            ? "1px solid #22c55e"
            : "1px solid #334155",
        }}
      >
        <BotaoVoltarBloco alvo="conf-bloco-9">← Voltar às Compatibilidades (⑨)</BotaoVoltarBloco>
        <h3 style={titulo}>
          ⑯ Revisão final
        </h3>

        <div
          data-paiia-conferencia-resumo
          style={{
            ...resumoLinha,
            display: "grid",
            gap: "4px",
            marginBottom: "10px",
          }}
        >
          <span>
            🏷️ Categoria ML:{" "}
            <strong data-paiia-revisao-categoria style={{ color: categoriaId && decisaoCategoria?.confirmada?.id === categoriaId ? "#86efac" : "#fca5a5" }}>
              {categoriaId && decisaoCategoria?.confirmada?.id === categoriaId
                ? `${categoria || categoriaId} (${categoriaId}) — confirmada por você`
                : "PENDENTE — confirme a categoria no bloco ⑮"}
            </strong>
          </span>
          <span>
            🚗 Aplicações / compatibilidade:{" "}
            <strong
              data-paiia-revisao-aplicacoes
              style={{
                color: aplicacoesConfirmadas.length || modelosSemDetalhes.length || String(compatibilidades || "").trim()
                  ? "#86efac"
                  : "#fbbf24",
              }}
            >
              {aplicacoesConfirmadas.length || modelosSemDetalhes.length
                ? `${aplicacoesConfirmadas.length} detalhada(s) + ${modelosSemDetalhes.length} modelo(s) sem detalhes — lista no bloco ⑨`
                : String(compatibilidades || "").trim()
                  ? "texto informado no bloco ⑨"
                  : "⚠ PENDENTE — sem aplicação confirmada"}
            </strong>
          </span>
          <span>
            📷 Fotos: <strong>{fotos.length}</strong>
            {indicesRepetidos.size ? ` · ${indicesRepetidos.size} repetida(s)` : ""}
          </span>
          <span>
            ⚖️ Peso e medidas:{" "}
            <strong
              style={{
                color:
                  logisticaConferencia?.medida ||
                  [pesoEnvio, comprimentoEnvio, larguraEnvio, alturaEnvio].every(numeroPositivo)
                    ? "#86efac"
                    : "#fca5a5",
              }}
            >
              {logisticaConferencia?.medida ||
              [pesoEnvio, comprimentoEnvio, larguraEnvio, alturaEnvio].every(numeroPositivo)
                ? "informados (bloco ⑥)"
                : "pendente"}
            </strong>
          </span>
        </div>

        <div
          style={{
            padding: "16px",
            borderRadius: "12px",
            background: "#020617",
            border: validado
              ? "1px solid #22c55e"
              : pendenciasRevisao.length
                ? "1px solid #ef4444"
                : "1px solid #334155",
          }}
        >
          <div
            style={{
              color: validado
                ? "#86efac"
                : pendenciasRevisao.length
                  ? "#fca5a5"
                  : "#cbd5e1",
              fontWeight: "bold",
              fontSize: "16px",
            }}
          >
            {validado
              ? "🟢 Pronto para publicar"
              : pendenciasRevisao.length
                ? "🔴 Corrigir antes de publicar"
                : "⚪ Aguardando validação do anúncio"}
          </div>

          <div
            style={{
              marginTop: "14px",
              display: "grid",
              gap: "8px",
              color: "#cbd5e1",
              fontSize: "13px",
            }}
          >
            <span>
              {tituloAnuncio.trim() &&
              tituloAnuncio.trim().length <= 60
                ? "✅"
                : "❌"}{" "}
              Título até 60 caracteres
            </span>

            <span>
              {preco ? "✅" : "❌"}{" "}
              Preço
            </span>

            <span>
              {descricao.trim()
                ? "✅"
                : "❌"}{" "}
              Descrição
            </span>

            <span>
              {fotos.length > 0 &&
              dimensoesFotos.length === fotos.length &&
              dimensoesFotos.every(
                (item) => item.ok
              )
                ? "✅"
                : "❌"}{" "}
              Fotos 1200 × 1200 ou maiores
            </span>

            <span>
              {categoria.trim()
                ? "✅"
                : "❌"}{" "}
              Categoria
            </span>

            <span>
              {marca.trim()
                ? "✅"
                : "❌"}{" "}
              Marca
            </span>

            <span>
              {numeroPeca.trim()
                ? "✅"
                : "❌"}{" "}
              Número da peça
            </span>

            <span>
              {normalizarTipoVeiculo(tipoVeiculo) && tipoVeiculoCategoria.estado !== "incompativel"
                ? "✅"
                : "❌"}{" "}
              Tipo de veículo
            </span>

            <span>
              {modoEnvio
                ? "✅"
                : "❌"}{" "}
              Forma de entrega
            </span>

            <span>
              {condicao
                ? "✅"
                : "❌"}{" "}
              Condição
            </span>

            <span data-paiia-resumo-garantia>
              ✅ {LINHAS_FIXAS.garantia}
            </span>

            <span data-paiia-resumo-retirada>
              ✅ {LINHAS_FIXAS.retirada}
            </span>

            <span data-paiia-resumo-regulatoria>
              ✅ {LINHAS_FIXAS.regulatoria}
            </span>
          </div>

          {pendenciasRevisao.length > 0 && (
            <div
              style={{
                marginTop: "16px",
                padding: "12px",
                borderRadius: "10px",
                background: "#450a0a",
                border:
                  "1px solid #991b1b",
                color: "#fecaca",
                fontSize: "13px",
              }}
            >
              <strong>
                Pendências encontradas:
              </strong>

              <div
                style={{
                  marginTop: "8px",
                  display: "grid",
                  gap: "5px",
                }}
              >
                {pendenciasRevisao.map(
                  (item, index) => (
                    <span
                      key={`${item}-${index}`}
                    >
                      • {item}
                    </span>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {validado &&
        payloadTeste && (
          <section
            style={{
              ...bloco,
              border:
                "1px solid #22c55e",
              background:
                "linear-gradient(180deg,#052e16,#0f172a)",
            }}
          >
            <h3
              style={{
                ...titulo,
                color: "#86efac",
                textAlign: "center",
              }}
            >
              ✅ Anúncio pronto
            </h3>

            <div
              data-paiia-proximo-passo-ml
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))",
                gap: "12px",
              }}
            >
              <button
                type="button"
                data-paiia-voltar-conferencia
                data-paiia-navegacao
                onClick={() => window.scrollTo?.({ top: 0, behavior: "smooth" })}
                style={{ ...botaoSecundario, width: "100%", padding: "14px" }}
              >
                ↑ Voltar ao início da Conferência
              </button>
              <button
                type="button"
                data-paiia-abrir-revisao-ml
                onClick={() => setRevisandoPublicacaoML(true)}
                disabled={!anuncioConferido}
                style={{
                  ...botaoPrincipal,
                  width: "100%",
                  padding: "14px",
                  background: "linear-gradient(135deg,#16a34a,#22c55e)",
                  opacity: !anuncioConferido ? 0.5 : 1,
                }}
              >
                ✅ Finalizar e escolher canais
              </button>
            </div>
            <p style={{ ...textoAuxiliar, marginTop: "10px", textAlign: "center" }}>
              {contasMLDisponiveis.length
                ? "Abre \"Escolher canais de publicação\" (Mercado Livre, Shopee, Site próprio). No Mercado Livre você escolhe REVELAÇÃO, LOJA ONLINE ou CIEBR, confere, valida e só publica com autorização explícita. Nada é publicado automaticamente."
                : "Abre \"Escolher canais de publicação\". Nenhuma conta Mercado Livre conectada: para publicar no Mercado Livre, conecte em Contas Marketplace."}
            </p>
            <details style={{ marginTop: "12px" }}>
              <summary style={{ ...textoAuxiliar, cursor: "pointer" }}>Outras opções (fora do caminho principal)</summary>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "8px" }}>
                <button type="button" onClick={abrirMidiasAppia} style={botaoSecundario}>🎞️ Exportar Mídias</button>
                <button type="button" onClick={exportarAnuncio} style={botaoSecundario}>⬇️ Exportar Anúncio</button>
                <button type="button" onClick={irParaCentralPublicacao} style={botaoSecundario}>🚀 Central de Publicação</button>
              </div>
            </details>

          </section>
        )}

      {avisoSaida}
      <div style={acoes}>
        <button
          type="button"
          data-paiia-voltar-central
          data-paiia-navegacao
          onClick={() => sairPara("centralPublicacao")}
          disabled={saida.salvando}
          style={botaoSecundario}
        >
          ← Voltar à Central de Publicação
        </button>

        <button
          type="button"
          onClick={validarAnuncio}
          disabled={validandoFotos}
          style={{
            ...botaoPrincipal,
            opacity:
              validandoFotos
                ? 0.6
                : 1,
            cursor:
              validandoFotos
                ? "not-allowed"
                : "pointer",
          }}
        >
          {validandoFotos
            ? "📐 Verificando fotos..."
            : "🧪 Validar Publicação"}
        </button>
      </div>
    </div>
  );
}

function Campo({
  label,
  value,
  onChange,
  placeholder = "",
  maxLength,
}) {
  return (
    <label style={labelStyle}>
      {label}

      <input
        value={value}
        onChange={(e) =>
          onChange(
            e.target.value
          )
        }
        placeholder={placeholder}
        maxLength={maxLength}
        style={campo}
      />
    </label>
  );
}

function AreaTexto({
  label = "",
  value,
  onChange,
  placeholder = "",
  minHeight = "120px",
}) {
  return (
    <label style={labelStyle}>
      {label}

      <textarea
        value={value}
        onChange={(e) =>
          onChange(
            e.target.value
          )
        }
        placeholder={placeholder}
        style={{
          ...campo,
          minHeight,
          resize: "vertical",
          lineHeight: 1.5,
        }}
      />
    </label>
  );
}

const cabecalho = {
  padding: "26px",
  borderRadius: "18px",
  border:
    "1px solid #2563eb",
  background:
    "linear-gradient(135deg,#172554,#0f172a)",
  textAlign: "center",
};

const bloco = {
  marginTop: "18px",
  padding: "20px",
  borderRadius: "15px",
  background: "#0f172a",
  border:
    "1px solid #1e293b",
};

const titulo = {
  color: "#67e8f9",
  marginTop: 0,
  marginBottom: "15px",
};

const subtitulo = {
  color: "#e2e8f0",
  marginTop: "18px",
  marginBottom: "8px",
};

const textoAuxiliar = {
  color: "#94a3b8",
  fontSize: "12px",
  lineHeight: 1.5,
  marginTop: 0,
};

const campo = {
  width: "100%",
  padding: "11px",
  marginTop: "6px",
  borderRadius: "10px",
  border:
    "1px solid #334155",
  background: "#020617",
  color: "#ffffff",
  boxSizing: "border-box",
};

const labelStyle = {
  display: "block",
  color: "#cbd5e1",
  marginTop: "12px",
  fontSize: "12px",
  fontWeight: "bold",
};

const gradeDois = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(220px,1fr))",
  gap: "12px",
};

const gradeQuatro = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(150px,1fr))",
  gap: "10px",
};

const gradeFotos = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
};

const fotoCard = {
  width: "120px",
  height: "120px",
  borderRadius: "10px",
  border:
    "1px solid #334155",
  background: "#ffffff",
  padding: "5px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const linhaAplicacao = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "10px",
  padding: "8px 10px",
  borderRadius: "8px",
  border: "1px solid #1e293b",
  background: "#020617",
  color: "#e2e8f0",
  fontSize: "13px",
  textAlign: "left",
};

const seloOrigemAplicacao = (origem) => ({
  padding: "2px 8px",
  borderRadius: "999px",
  fontSize: "11px",
  fontWeight: "bold",
  border: `1px solid ${origem === "manual" ? "#a855f7" : "#22c55e"}`,
  color: origem === "manual" ? "#d8b4fe" : "#86efac",
  whiteSpace: "nowrap",
});

const chipPalavra = {
  padding: "5px 10px",
  borderRadius: "999px",
  border: "1px solid #0891b2",
  background: "#083344",
  color: "#a5f3fc",
  fontSize: "12px",
};

const botaoMini = {
  padding: "4px 10px",
  borderRadius: "8px",
  border: "1px solid #334155",
  background: "#0f172a",
  color: "#e2e8f0",
  fontSize: "12px",
  cursor: "pointer",
};

const resumoLinha = {
  marginTop: "10px",
  padding: "12px",
  borderRadius: "10px",
  border:
    "1px solid #334155",
  background: "#020617",
  color: "#cbd5e1",
  display: "flex",
  justifyContent:
    "space-between",
  gap: "15px",
  flexWrap: "wrap",
};

const acoes = {
  display: "flex",
  justifyContent: "center",
  gap: "12px",
  marginTop: "20px",
  marginBottom: "30px",
  flexWrap: "wrap",
};

const botaoSecundario = {
  padding: "12px 18px",
  borderRadius: "10px",
  border:
    "1px solid #475569",
  background: "#334155",
  color: "#ffffff",
  cursor: "pointer",
  fontWeight: "bold",
};

const botaoPrincipal = {
  padding: "12px 20px",
  borderRadius: "10px",
  border:
    "1px solid #22c55e",
  background:
    "linear-gradient(135deg,#15803d,#22c55e)",
  color: "#ffffff",
  cursor: "pointer",
  fontWeight: "bold",
};

const cardInteligenciaPreco = {
  padding: "14px",
  borderRadius: "10px",
  border: "1px solid #334155",
  background: "#020617",
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  textAlign: "left",
};

const labelInteligenciaPreco = {
  color: "#94a3b8",
  fontSize: "12px",
  fontWeight: "bold",
};

const valorInteligenciaPreco = {
  color: "#f8fafc",
  fontSize: "18px",
};

// =====================================================
// RECUPERAÇÃO DA FICHA (F5 / reabertura / outro navegador)
// Com ?ficha=<ID> no endereço, o anúncio é remontado a partir da ficha
// gravada na base PAIIA (Supabase) — a fonte de verdade —, na MESMA ficha e
// na etapa em que o usuário estava (Conferência ou Publicação). Nunca cria
// outra ficha, nunca apaga dados e nunca manda para a Home.
// =====================================================
function lerFichaDoEndereco() {
  try {
    const id = new URL(window.location.href).searchParams.get("ficha") || "";
    return /^[0-9a-f-]{36}$/i.test(id) ? id : "";
  } catch {
    return "";
  }
}

export default function MercadoLivreTeste(props) {
  const [fichaUrl] = useState(lerFichaDoEndereco);
  // Sem ?ficha=: o anúncio levado à Conferência pode apontar uma ficha que
  // JÁ FOI PUBLICADA (cópia antiga deste navegador). Ela abre como ficha
  // publicada — nunca vira um anúncio novo nem cria outra ficha.
  const [fichaDoAnuncio] = useState(() => {
    if (fichaUrl) return "";
    try {
      const a = JSON.parse(localStorage.getItem("mlAnuncioTeste") || "null");
      return idFichaValido(a?.fichaIdPAIIA) ? String(a.fichaIdPAIIA) : "";
    } catch {
      return "";
    }
  });
  const [estado, setEstado] = useState(() => ({ pronto: !fichaUrl && !fichaDoAnuncio, erro: "", publicada: null }));

  useEffect(() => {
    if (!fichaDoAnuncio) return undefined;
    let ativo = true;
    (async () => {
      const r = await obterAnuncio(fichaDoAnuncio);
      if (!ativo) return;
      if (r.ok && publicacaoExiste(r.anuncio.publicacao)) {
        setEstado({ pronto: false, erro: "", publicada: r.anuncio });
        return;
      }
      setEstado({ pronto: true, erro: "", publicada: null });
    })();
    return () => { ativo = false; };
  }, [fichaDoAnuncio]);

  useEffect(() => {
    if (!fichaUrl) return undefined;
    let ativo = true;
    (async () => {
      const r = await obterAnuncio(fichaUrl);
      if (!ativo) return;
      if (!r.ok) {
        setEstado({ pronto: false, erro: r.erro || "Não foi possível ler a ficha deste anúncio na base PAIIA." });
        return;
      }
      if (publicacaoExiste(r.anuncio.publicacao)) {
        // O MLB já existe (com ou sem pendência): nunca reabre para publicar
        // de novo. Abre a ficha PUBLICADA (MLB, conta e etapa do Bling).
        setEstado({ pronto: false, erro: "", publicada: r.anuncio });
        return;
      }
      if (r.anuncio.status_fluxo === "cancelado") {
        setEstado({ pronto: false, erro: "Esta ficha foi cancelada (o anúncio continuou em outra ficha)." });
        return;
      }
      // Ficha ainda no NOVO ANÚNCIO: volta para ele com os dados da base
      // (mesma ficha). Nada é criado, publicado ou apagado.
      if (fichaSoNoNovoAnuncio(r.anuncio)) {
        const rasc = rascunhoDaFicha(r.anuncio);
        if (!rasc) {
          setEstado({ pronto: false, erro: "A ficha existe, mas ainda não tem dados do Novo Anúncio para recuperar." });
          return;
        }
        try {
          // Rascunho DESTA ficha (com as fotos dela) + limpa o que é de outro anúncio.
          abrirFichaNoNovoAnuncio(rasc);
        } catch (erro) {
          setEstado({ pronto: false, erro: `Não foi possível preparar o Novo Anúncio: ${erro?.name || erro}` });
          return;
        }
        props.setScreen?.("novoAnuncio");
        return;
      }
      // A base é a fonte: a cópia do navegador é refeita a partir dela.
      try {
        const chaveLocal = String(r.anuncio.codigo || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
        const mapa = JSON.parse(localStorage.getItem("paiiaConferenciaPorCodigo") || "{}");
        const local = mapa[chaveLocal] || null;
        const decisao = decidirAberturaFicha({ id: r.anuncio.id, local, baseDados: r.anuncio.dados_conferencia || {}, baseAtualizadaEm: r.anuncio.updated_at });
        if (decisao.acao === "conflito") {
          // A cópia DESTE navegador é mais nova e diferente da base: NÃO é
          // descartada. A tela abre com ela e mostra o conflito para escolha.
          const recBase = montarRecuperacaoDaFicha(r.anuncio, null);
          let atual = null;
          try {
            atual = JSON.parse(localStorage.getItem("mlAnuncioTeste") || "null");
          } catch {
            atual = null;
          }
          if (!atual || String(atual.codigo || "").toUpperCase().replace(/[^A-Z0-9]/g, "") !== chaveLocal) {
            localStorage.setItem("mlAnuncioTeste", JSON.stringify({ ...(recBase.ok ? recBase.anuncio : {}), fichaIdPAIIA: r.anuncio.id }));
          }
          const fotosLocaisBrutas = (local?.campos?.fotos?.length ? local.campos.fotos : local?.anuncioConferido?.fotos) || [];
          // Cópia local também passa pela regra das fotos POR ID DA FICHA.
          const fotosLocais = fotosLocaisBrutas.length
            ? decidirFotosDaFicha({ fichaId: r.anuncio.id, fotosConferencia: fotosLocaisBrutas, marcaConferencia: local?.campos?.fotosFichaId || "", fotosNovoAnuncio: r.anuncio.dados_conferencia?.novo_anuncio?.fotos }).fotos
            : [];
          window.__paiiaAnuncioSimulador = null;
          window.__paiiaFichaRecuperada = null;
          guardarFotosEmMemoria(window, fotosLocais.length ? fotosLocais : recBase.ok ? recBase.fotos : [], { fichaIdPAIIA: r.anuncio.id, codigo: r.anuncio.codigo });
          window.__paiiaConflitoInicial = { id: r.anuncio.id, base: r.anuncio };
          setEstado({ pronto: true, erro: "" });
          return;
        }
        if (local && decisao.acao === "usar_base" && decisao.diferencas.length) {
          // Cópia local MAIS ANTIGA e diferente: a base vale, mas a cópia é guardada.
          try {
            localStorage.setItem(`paiiaVersaoDescartada:${r.anuncio.id}`, JSON.stringify({ guardada_em: new Date().toISOString(), copia: local }));
          } catch {
            // sem espaço
          }
        }
        const rec = montarRecuperacaoDaFicha(r.anuncio, local);
        if (!rec.ok) {
          setEstado({ pronto: false, erro: rec.erro });
          return;
        }
        window.__paiiaAnuncioSimulador = null;
        guardarFotosEmMemoria(window, rec.fotos, { fichaIdPAIIA: rec.id, codigo: rec.anuncio?.codigo || r.anuncio.codigo });
        window.__paiiaFichaRecuperada = rec.id;
        localStorage.setItem("mlAnuncioTeste", JSON.stringify(rec.anuncio));
        mapa[rec.chave] = rec.fichaConferencia;
        localStorage.setItem("paiiaConferenciaPorCodigo", JSON.stringify(mapa));
        if (rec.aplicacoesManuais) {
          const manuais = JSON.parse(localStorage.getItem("paiiaAplicacoesManuaisPorCodigo") || "{}");
          if (rec.aplicacoesManuais.length) manuais[rec.chave] = rec.aplicacoesManuais;
          else delete manuais[rec.chave];
          localStorage.setItem("paiiaAplicacoesManuaisPorCodigo", JSON.stringify(manuais));
        }
      } catch (erro) {
        setEstado({ pronto: false, erro: `Não foi possível preparar a tela: ${erro?.name || erro}` });
        return;
      }
      setEstado({ pronto: true, erro: "" });
    })();
    return () => { ativo = false; };
  }, [fichaUrl]);

  // Saiu da Conferência/Publicação: o endereço deixa de apontar a ficha
  // (exceto quando a própria ficha volta para o Novo Anúncio).
  useEffect(() => () => {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has("ficha") && url.searchParams.get("tela") !== "novoAnuncio") {
        url.searchParams.delete("ficha");
        window.history.replaceState(window.history.state, "", url.toString());
      }
    } catch {
      // ignora
    }
  }, []);

  if (estado.publicada) {
    return <FichaPublicadaPAIIA ficha={estado.publicada} setScreen={props.setScreen} />;
  }
  if (!estado.pronto) {
    return (
      <div data-paiia-recuperando-ficha style={{ width: "100%", maxWidth: "1180px", margin: "30px auto" }}>
        <section style={cabecalho}>
          {estado.erro ? (
            <>
              <p style={{ color: "#fca5a5" }}>❌ {estado.erro}</p>
              <button type="button" onClick={() => props.setScreen?.("centralPublicacao")} style={botaoSecundario}>
                ← Voltar à Central de Publicação
              </button>
            </>
          ) : (
            <p style={{ color: "#bfdbfe" }}>⏳ Recuperando a ficha do anúncio na base PAIIA...</p>
          )}
        </section>
      </div>
    );
  }
  return <ConferenciaPAIIA {...props} />;
}

// =====================================================
// BASE PAIIA — autorização OBRIGATÓRIA para incorporar conhecimento
// Publicar NÃO autoriza alimentar a base. Só com "SIM, SALVAR NA BASE" e
// confirmação após a simulação; "NÃO" não bloqueia publicação nem Bling.
// =====================================================
function DecisaoBasePAIIA({ anuncioId, existeNaBase, anuncioConferido, aplicacoes, nomePeca }) {
  const [decisao, setDecisao] = useState({ carregando: true, valor: "", simulacao: null, gravacao: null, erro: "", ocupado: "" });
  // Trava contra duplo clique (o estado do React só muda no próximo render).
  const gravandoRef = useRef(false);

  useEffect(() => {
    let ativo = true;
    if (!anuncioId || existeNaBase) {
      setDecisao((d) => ({ ...d, carregando: false }));
      return undefined;
    }
    (async () => {
      const r = await obterAnuncio(anuncioId);
      if (!ativo) return;
      const salva = r.ok ? r.anuncio.dados_conferencia?.base_paiia : null;
      // Lote já gravado (mesmo em fichas antigas, gravadas sem o campo "ok")
      // é reconhecido: a tela mostra "✅ Gravado" e não oferece gravar de novo.
      const est = estadoBasePAIIA(salva);
      setDecisao((d) => ({ ...d, carregando: false, valor: est.gravado ? "autorizado" : salva?.decisao || "", gravacao: est.gravado ? { ...salva.gravacao, ok: true } : salva?.gravacao || null }));
    })();
    return () => { ativo = false; };
  }, [anuncioId, existeNaBase]);

  if (existeNaBase || !anuncioId || decisao.carregando) return null;

  // Só dados conferidos/aprovados; nada é completado por suposição.
  function montarRegistros() {
    const c = anuncioConferido || {};
    const categoriaFolha = String(c.categoria || "").split(">").pop().trim();
    const medida = c.logistica?.confirmado ? c.logistica.medida : null;
    const obs = [
      "Confirmado pelo usuário na Conferência PAIIA",
      c.gtin ? `GTIN ${c.gtin}` : "",
      c.marca ? `marca anunciada ${c.marca}` : "",
      c.categoriaId ? `categoria ML ${c.categoriaId}` : "",
      medida ? `embalagem ${medida.peso_g} g ${medida.comprimento_cm}x${medida.largura_cm}x${medida.altura_cm} cm (confirmada)` : "",
    ].filter(Boolean).join(" · ");
    const base = {
      codigo_oem: c.codigo,
      peca: nomePeca || c.titulo,
      fabricante: c.marca || "",
      origem_catalogo: "Conferência PAIIA (aprovado pelo usuário)",
      categoria: categoriaFolha,
      confiabilidade: 90,
      observacao: obs,
    };
    const lista = (aplicacoes || []).filter((a) => a.montadora || a.modelo);
    if (!lista.length) return [{ ...base, tipo_referencia: "nota_tecnica" }];
    return lista.map((a) => ({
      ...base,
      montadora: a.montadora || "",
      modelo: a.modelo || "",
      motor: a.motor || "",
      ano_inicio: a.anoInicio ? Number(a.anoInicio) : undefined,
      ano_fim: a.anoFim ? Number(a.anoFim) : undefined,
      tipo_referencia: "aplicacao_veiculo",
    }));
  }

  async function responder(valor) {
    setDecisao((d) => ({ ...d, ocupado: valor, erro: "" }));
    const r = await registrarDecisaoBase({ anuncioId, decisao: valor === "sim" ? "autorizado" : "nao_salvar" });
    if (!r.ok) {
      setDecisao((d) => ({ ...d, ocupado: "", erro: r.erro || "Não foi possível registrar a decisão." }));
      return;
    }
    let simulacao = null;
    if (valor === "sim") {
      // Primeiro só SIMULA (nada é gravado): mostra o que entraria na base.
      const { data, error } = await supabase.functions.invoke("catalogo-escrita", {
        body: { acao: "simular_lote", registros: montarRegistros(), meta: { catalogo: "Conferência PAIIA" } },
      });
      simulacao = error ? { ok: false, erro: error.message } : data || { ok: false, erro: "Resposta vazia." };
    }
    setDecisao((d) => ({ ...d, ocupado: "", valor: valor === "sim" ? "autorizado" : "nao_salvar", simulacao }));
  }

  // ÚNICO caminho de gravação deste produto em catalogo_pecas: o clique em
  // "Confirmar gravação na base PAIIA". Publicar, criar no Bling, estoque ou
  // concluir a ficha nunca chegam aqui.
  async function confirmarGravacao() {
    if (gravandoRef.current) return;
    gravandoRef.current = true;
    try {
      setDecisao((d) => ({ ...d, ocupado: "gravar", erro: "" }));
      // Relê a ficha AGORA (F5, outra aba, reabertura): lote já gravado = não grava.
      const atual = await obterAnuncio(anuncioId);
      const estado = atual.ok ? estadoBasePAIIA(atual.anuncio.dados_conferencia?.base_paiia) : null;
      const pode = podeGravarNaBase({ estado, confirmacao: "CONFIRMAR_GRAVACAO_BASE_PAIIA" });
      if (!pode.pode) {
        setDecisao((d) => ({
          ...d,
          ocupado: "",
          ...(pode.jaGravado ? { valor: "autorizado", gravacao: { ...atual.anuncio.dados_conferencia.base_paiia.gravacao, ok: true } } : {}),
          erro: pode.jaGravado ? "" : pode.motivo,
        }));
        return;
      }
      const { data, error } = await supabase.functions.invoke("catalogo-escrita", {
        body: { acao: "gravar_lote", registros: montarRegistros(), meta: { catalogo: "Conferência PAIIA" } },
      });
      const gravacao = error ? { ok: false, erro: error.message } : data || { ok: false };
      if (gravacao.ok) {
        // Grava COM "ok" e lote: F5/reabrir reconhecem e não gravam de novo.
        const reg = await registrarDecisaoBase({
          anuncioId,
          decisao: "autorizado",
          detalhe: { gravacao: { ok: true, lote_id: gravacao.lote_id || gravacao.loteId || null, inseridos: gravacao.inseridos ?? null, gravado_em: new Date().toISOString() } },
        });
        if (!reg.ok) gravacao.avisoRegistro = reg.erro || "Gravado na base, mas o registro na ficha falhou.";
      }
      setDecisao((d) => ({ ...d, ocupado: "", gravacao }));
    } finally {
      gravandoRef.current = false;
    }
  }

  return (
    <section data-paiia-decisao-base style={{ ...bloco, border: "1px solid #a855f7" }}>
      <strong style={{ color: "#e9d5ff" }}>📚 Base PAIIA</strong>
      {!decisao.valor ? (
        <>
          <p style={{ color: "#e2e8f0", margin: "8px 0" }}>
            Este produto ainda não existe na base PAIIA. Deseja salvar os dados conferidos na base para reaproveitamento futuro?
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" data-paiia-base-sim disabled={!!decisao.ocupado} onClick={() => responder("sim")} style={botaoPrincipal}>
              SIM, SALVAR NA BASE
            </button>
            <button type="button" data-paiia-base-nao disabled={!!decisao.ocupado} onClick={() => responder("nao")} style={botaoSecundario}>
              NÃO, SOMENTE ESTE ANÚNCIO
            </button>
          </div>
          <p style={{ ...textoAuxiliar, marginTop: 8 }}>Publicar não salva nada na base: são decisões separadas.</p>
        </>
      ) : decisao.valor === "nao_salvar" ? (
        <p data-paiia-base-decisao="nao" style={{ color: "#94a3b8", margin: "8px 0 0" }}>
          Decidido: <b>somente este anúncio</b>. Nada é incorporado à base PAIIA; a publicação e o Bling seguem normalmente.
        </p>
      ) : (
        <div data-paiia-base-decisao="sim" style={{ color: "#e2e8f0", fontSize: 14, marginTop: 8 }}>
          <div>
            {decisao.gravacao?.ok
              ? "Base PAIIA"
              : `Você respondeu SIM (${montarRegistros().length} registro(s), só dados conferidos). Ainda NÃO foi gravado: só grava com o botão abaixo.`}
          </div>
          {decisao.gravacao?.ok ? (
            <div data-paiia-base-gravado={decisao.gravacao.lote_id || "sim"} style={{ color: "#86efac" }}>
              ✅ Gravado na base PAIIA{decisao.gravacao.lote_id ? ` (lote ${String(decisao.gravacao.lote_id).slice(0, 8)})` : ""}. Nada mais será gravado para este anúncio.
              {decisao.gravacao.avisoRegistro && <div style={{ color: "#fde68a" }}>⚠ {decisao.gravacao.avisoRegistro}</div>}
            </div>
          ) : (
            <>
              {decisao.simulacao && (
                <div style={{ color: decisao.simulacao.ok ? "#bae6fd" : "#fca5a5" }}>
                  {decisao.simulacao.ok
                    ? `Simulação: ${decisao.simulacao.novos ?? decisao.simulacao.resumo?.novos ?? "?"} novo(s), ${decisao.simulacao.existentes ?? decisao.simulacao.resumo?.existentes ?? "?"} já existente(s). Nada foi gravado ainda.`
                    : `Simulação indisponível: ${decisao.simulacao.erro}`}
                </div>
              )}
              <button type="button" data-paiia-base-confirmar disabled={!!decisao.ocupado} onClick={confirmarGravacao} style={{ ...botaoPrincipal, marginTop: 8 }}>
                {decisao.ocupado === "gravar" ? "⏳ Gravando..." : "Confirmar gravação na base PAIIA"}
              </button>
              {decisao.gravacao && !decisao.gravacao.ok && <div style={{ color: "#fca5a5" }}>❌ {decisao.gravacao.erro}</div>}
            </>
          )}
        </div>
      )}
      {decisao.erro && <p style={{ color: "#fca5a5" }}>❌ {decisao.erro}</p>}
    </section>
  );
}
