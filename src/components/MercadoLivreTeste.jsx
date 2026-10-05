import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabase";
import PesoEmbalagemML from "./PesoEmbalagemML";
import RevisaoPublicacaoML from "./RevisaoPublicacaoML";
import { normalizarQuantidade } from "../services/estoqueBlingPAIIA";
import {
  lerAplicacoesAprovadas,
  inferirTipoVeiculo,
  valorTipoVeiculo,
  tipoVeiculoDaCategoria,
  tipoVeiculoParaFicha,
  marcaInvalida,
  descricaoAfirmaOriginal,
  montarDescricaoPadrao,
} from "../services/compatibilidadeML";
import { useContasML, contasMLConectadas } from "../services/contaMLAtiva";
import { GARANTIA_ML, LINHAS_FIXAS, padroesEsperadosConferencia } from "../services/padroesPublicacaoML";
import {
  obterAnuncio,
  salvarFichaAprovada,
  salvarRascunhoFicha,
  registrarDecisaoBase,
  publicacaoExiste,
  pendenciaPublicacao,
} from "../services/anuncioPublicacaoService";
import { montarRecuperacaoDaFicha, urlsFotosFicha, mesmaAprovacao, diferencasAssinatura } from "../services/fichaConferencia";
import {
  separarModelos,
  separarAplicacoesBase,
  juntarModelos,
  separarAplicacoesLegadas,
  extrairDadosDescricao,
  termosConfirmados,
  gerarIntencoesBusca,
  separarSugestoesConcorrentes,
} from "../services/inteligenciaBusca";

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

const ROTULO_ORIGEM_CATEGORIA_AUTO = "encontrada automaticamente no Mercado Livre — confira";
const ROTULO_ORIGEM_CATEGORIA = {
  automatica: ROTULO_ORIGEM_CATEGORIA_AUTO,
  base: "definida pelo PAIIA para este produto",
  escolhida: "escolhida por você para este código",
  agora: "escolhida agora",
};

// =====================================================
// CATEGORIA MERCADO LIVRE AUTOMÁTICA (sem suposição)
// Consulta o próprio Mercado Livre (domain_discovery) pelo NOME DA PEÇA
// e pelo título; aplicação serve só de contexto. Só escolhe sozinho
// quando há UMA categoria real (com ID) do ramo do veículo que bate com
// o tipo da peça. Se houver dúvida, devolve as opções e fica PENDENTE.
// =====================================================
const PALAVRAS_IGNORADAS_CATEGORIA = new Set([
  "para", "com", "sem", "kit", "peca", "pecas", "original", "novo", "nova",
  "oem", "marca", "jogo", "unidade", "carro", "carros", "veiculo", "veiculos",
  "automotivo", "automotiva", "linha", "motor", "flex", "gasolina", "alcool",
  "diesel", "valvulas", "valvula16", "torken", "kits", "jogos", "conjunto",
  "conjuntos", "acompanha", "acompanham", "incluso", "inclusos", "inclui",
]);

// Mesma peça com outro nome no Mercado Livre (só equivalências certas).
const SINONIMOS_TIPO_PECA = {
  bico: ["injetor"],
  injetor: ["bico"],
};

function radicalPalavra(p) {
  if (p.length > 6 && p.endsWith("es")) return p.slice(0, -2);
  if (p.length > 4 && p.endsWith("s")) return p.slice(0, -1);
  return p;
}

function palavrasDaPeca(texto, ignorar) {
  return normalizarTexto(texto)
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((p) => p.length >= 4 && !/\d/.test(p) && !PALAVRAS_IGNORADAS_CATEGORIA.has(p) && !ignorar.has(p))
    .map(radicalPalavra);
}

// =====================================================
// PRODUTO PRINCIPAL (é ele que define a categoria)
// Itens que acompanham a peça (presilhas, parafusos, mangueira, filtro,
// sensor, anel, conector...) e a palavra "KIT" nunca definem a categoria.
// A posição no título é só auxílio: fontes superiores (Base, cadastro, nome
// da peça) mandam. "e"/vírgula/parênteses não quebram nomes compostos.
// =====================================================
// Palavras que NÃO são a peça (marca, montadora, modelo, comercial): servem
// só de contexto. Modelos/motores da aplicação confirmada entram também.
const MARCAS_E_MONTADORAS_CONTEXTO = new Set([
  "renault", "fiat", "vw", "volkswagen", "chevrolet", "gm", "ford", "honda", "toyota",
  "hyundai", "kia", "nissan", "peugeot", "citroen", "mitsubishi", "jeep", "dodge", "ram",
  "chrysler", "bmw", "audi", "mercedes", "benz", "volvo", "subaru", "suzuki", "jac",
  "chery", "caoa", "land", "rover", "troller", "iveco", "scania", "mwm", "cummins",
  "bosch", "magneti", "marelli", "delphi", "ngk", "denso", "mte", "mte-thomson", "torken",
  "vdo", "siemens", "continental", "valeo", "sachs", "skf", "tecfil", "sabo", "nytron",
  "gauss", "dayco", "gates", "cofap", "monroe", "nakata", "trw", "fras-le", "fraslle", "hella",
  "original", "originais", "genuino", "genuina", "novo", "nova", "novos", "novas", "premium",
  "promocao", "oferta", "importado", "importada", "nacional", "paralelo", "similar",
  "qualidade", "garantia", "pronta", "entrega", "envio", "imediato", "frete", "gratis",
]);
const MODELOS_CONTEXTO = new Set([
  "symbol", "clio", "sandero", "logan", "duster", "kangoo", "megane", "scenic", "fluence",
  "captur", "kwid", "oroch", "master", "trafic", "gol", "voyage", "saveiro", "fox", "polo",
  "golf", "jetta", "passat", "bora", "parati", "santana", "amarok", "up", "virtus", "nivus",
  "palio", "uno", "siena", "strada", "punto", "linea", "doblo", "idea", "toro", "mobi",
  "argo", "cronos", "ducato", "onix", "prisma", "cobalt", "spin", "corsa", "celta", "classic",
  "agile", "montana", "astra", "vectra", "zafira", "meriva", "cruze", "s10", "trailblazer",
  "captiva", "malibu", "tracker", "ka", "fiesta", "ecosport", "focus", "fusion", "ranger",
  "courier", "civic", "fit", "city", "hrv", "crv", "corolla", "etios", "hilux", "yaris",
  "hb20", "tucson", "ix35", "santa", "fe", "creta", "azera", "sonata", "elantra", "i30",
  "sportage", "cerato", "picanto", "sorento", "march", "versa", "kicks", "sentra", "frontier",
  "livina", "tiida", "206", "207", "208", "2008", "307", "308", "408", "partner", "c3", "c4",
  "xsara", "picasso", "aircross", "berlingo", "jumper", "boxer", "l200", "pajero", "lancer",
  "asx", "outlander", "renegade", "compass", "e36", "e46",
]);
const PALAVRAS_KIT = new Set(["kit", "kits", "jogo", "jogos", "conjunto", "conjuntos", "conj", "cj", "jg", "par", "pares", "unidade", "unidades", "un", "und", "unid", "pcs", "pecas", "peca", "x"]);
const PALAVRAS_PULAR = new Set(["para", "p/", "pra"]);
const CONECTORES_NOME = new Set(["de", "da", "do", "dos", "das", "d", "a"]);
// Separadores fortes: depois deles vêm itens que acompanham.
const SEPARADORES_FORTES = new Set(["+", "&", ";", "|", "com", "c/", "acompanha", "acompanham", "inclui", "incluso", "inclusos", "inclusa", "inclusas", "incluindo", "mais", "compativel", "-", "–"]);
// Separadores fracos ("e", vírgula, parênteses): só separam quando o que vem
// depois é claramente um item acompanhante — nomes compostos são preservados
// (ex.: "Sensor de Pressão e Temperatura").
const SEPARADORES_FRACOS = new Set(["e", ",", "(", ")"]);
const ITENS_ACOMPANHANTES = new Set([
  "presilha", "trava", "fixacao", "parafuso", "arruela", "conector", "anel", "aneis", "oring",
  "o-ring", "borracha", "abracadeira", "junta", "graxa", "grampo", "vedacao", "retentor", "porca",
  "mangueira", "filtro", "pre-filtro", "prefiltro", "chicote", "plug", "suporte", "coxim",
  "sensor", "pressostato", "boia", "tampa", "cinta", "bucha", "pino", "mola", "adesivo", "manual",
]);
// Substantivos que costumam ser o NOME da peça (para achar onde ela começa
// no título quando há marca/montadora/código antes).
const NUCLEOS_DE_PECA = new Set([
  "bico", "injetor", "mangueira", "bomba", "sensor", "sonda", "bobina", "pressostato", "valvula",
  "filtro", "cabo", "vela", "junta", "correia", "polia", "tensor", "rolamento", "amortecedor",
  "pastilha", "disco", "tambor", "lona", "cilindro", "pistao", "anel", "atuador", "corpo",
  "regulador", "modulo", "rele", "chicote", "interruptor", "alternador", "radiador",
  "reservatorio", "tampa", "termostato", "eletroventilador", "ventoinha", "flauta", "galeria",
  "coxim", "bucha", "bieleta", "terminal", "pivo", "homocinetica", "tulipa", "trambulador",
  "embreagem", "plato", "retentor", "tubo", "cano", "mecanismo", "palheta", "moldura", "porca",
  "presilha", "trava", "maquina", "fechadura", "farol", "lanterna", "retrovisor", "caixa",
  "coletor", "catalisador", "silencioso", "cabecote", "bronzina", "biela", "comando", "tucho",
  "engrenagem", "corrente", "carter", "bujao", "solenoide", "medidor", "boia", "motor",
  "partida", "arranque", "borboleta", "unidade", "kit-reparo", "reparo", "acionador",
  "servo", "cubo", "mancal", "eixo", "semi-eixo", "barra", "bandeja", "balanca", "mola",
  "batente", "coifa", "cruzeta", "diferencial", "volante", "chave", "ignicao", "tanque",
  "trocador", "intercooler", "turbina", "turbo", "compressor", "condensador", "evaporador",
  "ventilador", "resistencia", "lampada", "vareta", "pedal", "alavanca", "suporte",
]);

function normalizarPalavra(p) {
  return normalizarTexto(p).replace(/[^a-z0-9/+&;|,()\-–]/g, "");
}

function ehContextoDoTitulo(n, contexto) {
  if (!n) return true;
  if (/\d/.test(n)) return true; // código, OEM, motor (1.6, 16v), anos, quantidade
  if (/^(?:flex|gasolina|alcool|etanol|diesel|gnv|turbo16v|\d*v|cv|hp|valvulas?)$/.test(n)) return true;
  return MARCAS_E_MONTADORAS_CONTEXTO.has(n) || MODELOS_CONTEXTO.has(n) || contexto.has(n);
}

function singularDaPeca(texto) {
  const palavras = texto.split(" ");
  const primeira = normalizarTexto(palavras[0] || "");
  if (!/s$/.test(primeira) || NUCLEOS_DE_PECA.has(primeira)) return texto;
  let antesDoDe = true;
  return palavras.map((w) => {
    const n = normalizarTexto(w);
    if (CONECTORES_NOME.has(n)) { antesDoDe = false; return w; }
    if (!antesDoDe || w.length <= 3) return w;
    if (/(?:or|ar|er)es$/i.test(w)) return w.slice(0, -2);
    if (/[õo]es$/i.test(w)) return w.slice(0, -3) + "ão";
    if (/[^s]s$/i.test(w)) return w.slice(0, -1);
    return w;
  }).join(" ");
}

// Separa, no título, marca/código/montadora/modelo/motor/anos/quantidade/
// Kit e itens acompanhantes; depois identifica a peça principal.
function extrairProdutoPrincipal(texto, contexto = new Set()) {
  const t = limparCampoTexto(texto)
    .replace(/\bc\/\s*/gi, " c/ ")
    .replace(/\bp\/\s*/gi, " p/ ")
    .replace(/([+&;|,()])/g, " $1 ")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return { principal: "", acompanha: [] };
  const tokens = t.split(" ").map((w) => ({ w, n: normalizarPalavra(w) }));
  const ehNucleo = (n) => NUCLEOS_DE_PECA.has(n) || NUCLEOS_DE_PECA.has(radicalPalavra(n)) ||
    NUCLEOS_DE_PECA.has(n.replace(/es$/, "")) || NUCLEOS_DE_PECA.has(n.replace(/oes$/, "ao"));
  const pulavel = (n) => PALAVRAS_KIT.has(n) || PALAVRAS_PULAR.has(n) || CONECTORES_NOME.has(n) ||
    ehContextoDoTitulo(n, contexto) || SEPARADORES_FRACOS.has(n);
  // Início: 1º substantivo de peça antes de um separador forte; sem ele,
  // a 1ª palavra que não é marca/modelo/código/Kit (só como auxílio).
  let inicio = -1;
  for (let i = 0; i < tokens.length; i++) {
    if (SEPARADORES_FORTES.has(tokens[i].n)) break;
    if (ehNucleo(tokens[i].n)) { inicio = i; break; }
  }
  if (inicio < 0) {
    inicio = tokens.findIndex((x) => !pulavel(x.n) && !SEPARADORES_FORTES.has(x.n));
  }
  if (inicio < 0) return { principal: "", acompanha: [] };
  const nome = [];
  let quebraFraca = false;
  let i = inicio;
  for (; i < tokens.length; i++) {
    const { w, n } = tokens[i];
    if (SEPARADORES_FORTES.has(n)) break;
    if (PALAVRAS_PULAR.has(n)) continue;
    if (SEPARADORES_FRACOS.has(n)) {
      const prox = tokens.slice(i + 1).find((x) => !SEPARADORES_FRACOS.has(x.n));
      if (!prox || n === "(" || n === ")" || ITENS_ACOMPANHANTES.has(prox.n) || ITENS_ACOMPANHANTES.has(radicalPalavra(prox.n)) || ehContextoDoTitulo(prox.n, contexto)) {
        quebraFraca = !!prox && (ITENS_ACOMPANHANTES.has(prox.n) || ITENS_ACOMPANHANTES.has(radicalPalavra(prox.n)));
        break;
      }
      if (n === "e") nome.push(w);
      continue;
    }
    if (i > inicio && (ehContextoDoTitulo(n, contexto) || PALAVRAS_KIT.has(n))) break;
    nome.push(w);
  }
  while (nome.length && (CONECTORES_NOME.has(normalizarTexto(nome[nome.length - 1])) || normalizarTexto(nome[nome.length - 1]) === "e")) nome.pop();
  // Acompanhantes: o que vem depois do separador, sem marca/modelo/código.
  const acompanha = [];
  let atual = [];
  const fechar = () => {
    const txt = atual.join(" ").trim();
    if (txt && palavrasDaPeca(txt, new Set()).length) acompanha.push(txt);
    atual = [];
  };
  let depois = quebraFraca;
  for (let j = i; j < tokens.length; j++) {
    const { w, n } = tokens[j];
    if (SEPARADORES_FORTES.has(n)) { depois = true; fechar(); continue; }
    if (!depois) continue;
    if (SEPARADORES_FRACOS.has(n) || ehContextoDoTitulo(n, contexto) || PALAVRAS_KIT.has(n) || PALAVRAS_PULAR.has(n)) { fechar(); continue; }
    if (ITENS_ACOMPANHANTES.has(n) || ITENS_ACOMPANHANTES.has(radicalPalavra(n))) fechar();
    atual.push(w);
  }
  fechar();
  return { principal: singularDaPeca(nome.join(" ")), acompanha };
}

function nucleoDoProduto(texto, ignorar = new Set()) {
  return palavrasDaPeca(extrairProdutoPrincipal(texto, ignorar).principal, ignorar)[0] || "";
}

// Ordem de prioridade (só dados reais): 1) Base PAIIA/catálogo, 2) cadastro
// confirmado, 3) nome da peça no anúncio, 4) título (marca, aplicação,
// código e inclusos separados), 5) descrição (apoio). Uma fonte superior
// vale mais que a posição das palavras no título.
function identificarProdutoPrincipal({ anuncio, nomePeca, nomePecaBase, titulo, descricao, contexto = new Set() }) {
  const peca = anuncio?.pecaEncontrada || {};
  const editado = limparCampoTexto(nomePeca) && limparCampoTexto(nomePeca) !== limparCampoTexto(nomePecaBase);
  const fontes = [
    [editado ? "" : peca.peca, "Base PAIIA"],
    [editado ? "" : peca.familia, "Base PAIIA (família)"],
    [anuncio?.produtoPrincipal || anuncio?.nomePeca || anuncio?.produto?.nome, "cadastro do produto"],
    [nomePeca, "nome da peça na Conferência"],
    [titulo, "título do anúncio"],
    [String(descricao || "").split(/[\n.]/)[0], "descrição (apoio)"],
  ];
  for (const [texto, fonte] of fontes) {
    const r = extrairProdutoPrincipal(texto, contexto);
    if (r.principal) return { ...r, fonte };
  }
  return { principal: "", acompanha: [], fonte: "" };
}

async function lerCaminhoCategoriaML(id, cache) {
  if (cache[id]) return cache[id];
  try {
    const r = await fetch(`https://api.mercadolibre.com/categories/${encodeURIComponent(id)}`);
    if (!r.ok) return (cache[id] = null);
    const d = await r.json();
    const niveis = Array.isArray(d?.path_from_root) ? d.path_from_root.map((n) => n?.name).filter(Boolean) : [];
    return (cache[id] = { id, nome: d?.name || niveis[niveis.length - 1] || "", niveis, caminho: niveis.join(" > ") });
  } catch {
    return (cache[id] = null);
  }
}

async function descobrirCategoriaML({ termos, nomePeca, tipoVeiculo, palavrasVeiculo }) {
  const consultas = [...new Set(termos.map((t) => limparCampoTexto(t)).filter(Boolean))].slice(0, 3);
  if (!consultas.length) {
    return { escolhida: null, opcoes: [], motivo: "sem nome da peça nem título para consultar o Mercado Livre." };
  }
  const ignorar = new Set(palavrasVeiculo.flatMap((t) => normalizarTexto(t).split(/\s+/)));
  // Tipo da peça = 1ª palavra significativa do NOME DA PEÇA (ou do título),
  // ex.: "pressostato", "sonda", "bico". Qualificadores (direção, óleo...)
  // não bastam sozinhos para escolher a categoria.
  // Só o PRODUTO PRINCIPAL conta ("Kit", presilhas, filtro... não).
  const nucleo = nucleoDoProduto(limparCampoTexto(nomePeca) || consultas[0], ignorar);
  const tipoPeca = new Set(nucleo ? [nucleo, ...(SINONIMOS_TIPO_PECA[nucleo] || [])] : []);
  if (!tipoPeca.size) {
    return { escolhida: null, opcoes: [], motivo: "não foi possível identificar o tipo da peça (informe o nome da peça)." };
  }
  const cache = {};
  const ordemPorConsulta = [];
  const ids = [];
  for (const q of consultas) {
    try {
      const r = await fetch(`https://api.mercadolibre.com/sites/MLB/domain_discovery/search?q=${encodeURIComponent(q)}&limit=8`);
      if (!r.ok) continue;
      const lista = await r.json();
      const ordem = (Array.isArray(lista) ? lista : []).map((it) => it?.category_id).filter(Boolean);
      ordemPorConsulta.push(ordem);
      ordem.forEach((id) => { if (!ids.includes(id)) ids.push(id); });
    } catch {
      // segue para a próxima consulta
    }
  }
  if (!ordemPorConsulta.length) {
    return { escolhida: null, opcoes: [], motivo: "o Mercado Livre não respondeu à consulta de categorias." };
  }
  const detalhes = (await Promise.all(ids.slice(0, 12).map((id) => lerCaminhoCategoriaML(id, cache)))).filter(Boolean);
  const porId = Object.fromEntries(detalhes.map((c) => [c.id, c]));
  // Só categorias de peças de veículo; carro/caminhonete fica no ramo próprio.
  const ehCarro = /carro|caminhonete/i.test(String(tipoVeiculo || "Carro"));
  const doVeiculo = detalhes.filter((c) => c.niveis[0] === "Acessórios para Veículos");
  const noRamo = (c) => c && c.niveis[0] === "Acessórios para Veículos" && (!ehCarro || c.niveis[1] === "Peças de Carros e Caminhonetes");
  const doRamo = doVeiculo.filter(noRamo);
  const opcoes = [...doRamo, ...doVeiculo.filter((c) => !doRamo.includes(c))].map((c) => ({ id: c.id, nome: c.nome, caminho: c.caminho }));
  if (!opcoes.length) {
    return { escolhida: null, opcoes: [], motivo: "o Mercado Livre não retornou categoria de peça automotiva para esta peça." };
  }
  // A categoria precisa conter o TIPO DA PEÇA (ex.: "injetor", "sonda",
  // "pressostato") no seu caminho — montadora/modelo/motor não contam.
  const temTipoPeca = (c) => {
    const doCaminho = new Set(palavrasDaPeca(c.niveis.slice(2).join(" "), new Set()));
    return [...tipoPeca].some((p) => doCaminho.has(p));
  };
  // "Kit" não leva a uma categoria genérica de kits.
  const ehCategoriaDeKit = (c) => /^kits?\b/i.test(normalizarTexto(c.nome));
  // Voto de cada consulta = 1ª categoria (na ordem do próprio ML) do ramo
  // do veículo que contém o tipo da peça. Só escolhe se todos concordam.
  const votos = ordemPorConsulta
    .map((ordem) => ordem.find((id) => noRamo(porId[id]) && temTipoPeca(porId[id]) && !ehCategoriaDeKit(porId[id])))
    .filter(Boolean);
  const distintos = [...new Set(votos)];
  if (distintos.length === 1) {
    const c = porId[distintos[0]];
    return { escolhida: { id: c.id, nome: c.nome, caminho: c.caminho }, opcoes, motivo: "" };
  }
  return {
    escolhida: null,
    opcoes,
    motivo: distintos.length > 1
      ? "o Mercado Livre indicou mais de uma categoria possível para esta peça. Escolha a correta abaixo."
      : "nenhuma categoria retornada pelo Mercado Livre corresponde com segurança ao tipo da peça. Escolha abaixo ou ajuste o nome da peça e busque de novo.",
  };
}

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
  const [fichaSalva] = useState(() =>
    chaveConferencia ? lerMapaLocal(CHAVE_CONFERENCIA)[chaveConferencia] || null : null
  );
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
  const fotosMemoria =
    Array.isArray(
      window.__paiiaFotosPublicacao
    )
      ? window.__paiiaFotosPublicacao
      : [];

  let fotosIniciais =
    fotosMemoria.length > 0
      ? [...fotosMemoria]
      : Array.isArray(
          anuncio?.fotos
        )
        ? [...anuncio.fotos]
        : [];

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

  window.__paiiaFotosPublicacao =
    fotosIniciais;

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
  window.__paiiaFotosPublicacao =
    lista;

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
    String(fichaSalva?.campos?.anuncioIdPAIIA || "")
  );
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
  ] = useState(() => fichaSalva?.campos?.logistica || null);

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

  // Categoria já definida para este produto (base PAIIA ou escolhida
  // antes pelo usuário). Sem categoria definida = PENDENTE: o PAIIA não
  // preenche categoria por suposição.
  const categoriaDefinida = useMemo(
    () => lerCategoriaDefinida(anuncio),
    [anuncio]
  );

  // Categoria (nome + caminho + ID MLB + origem) decidida em conjunto.
  const [categoriaInicial] = useState(() => {
    const doAnuncio = categoriaDefinida
      ? { id: categoriaDefinida.id, caminho: categoriaDefinida.caminho || categoriaDefinida.id, origem: categoriaDefinida.origem }
      : null;
    const escolhida = inicial("categoriaML", doAnuncio);
    return valorVazio(escolhida) ? null : escolhida;
  });

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

  const [
    tipoVeiculo,
    setTipoVeiculo,
  ] = useState(() =>
    // Sugerido pelas aplicações aprovadas (todas de automóvel/caminhonete).
    // Na dúvida fica em branco e a Conferência pede a confirmação.
    inicial(
      "tipoVeiculo",
      inferirTipoVeiculo(
        lerAplicacoesAprovadas({ aplicacoes: anuncio?.aplicacoes, texto: anuncio?.compatibilidades })
      )
    )
  );

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
const [nomePeca, setNomePeca] = useState(() => inicial("nomePeca", nomePecaBase));
// Dados técnicos da PEÇA (só confirmados: base, descrição ou fonte técnica).
const [funcaoPeca, setFuncaoPeca] = useState(() => inicial("funcaoPeca", ""));
const [fonteFuncao, setFonteFuncao] = useState(() => inicial("fonteFuncao", ""));
const [especificacaoTecnica, setEspecificacaoTecnica] = useState(() => inicial("especificacaoTecnica", ""));
// Como o comprador procura a peça (opcional, confirmado pelo usuário).
const [termoComercial, setTermoComercial] = useState(() => inicial("termoComercial", ""));

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

  const [
    modalidade,
    setModalidade,
  ] = useState(() => {
    return (
      localStorage.getItem(
        "tipoAnuncioAppia"
      ) ||
      anuncio?.tipoAnuncio ||
      "classico"
    );
  });

  useEffect(() => {
    const canalSalvo =
      localStorage.getItem(
        "canalVendaAppia"
      );

    const modalidadeSalva =
      localStorage.getItem(
        "tipoAnuncioAppia"
      );

    if (canalSalvo) {
      setCanalVendaPublicacao(
        canalSalvo
      );
    }

    if (modalidadeSalva) {
      setModalidade(
        modalidadeSalva
      );
    }
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
  ] = useState(() => inicial("larguraEnvio", ""));

  const [
    alturaEnvio,
    setAlturaEnvio,
  ] = useState(() => inicial("alturaEnvio", ""));

  const [
    comprimentoEnvio,
    setComprimentoEnvio,
  ] = useState(() => inicial("comprimentoEnvio", ""));

  const [
    pesoEnvio,
    setPesoEnvio,
  ] = useState(() => inicial("pesoEnvio", ""));

  const [
    condicao,
    setCondicao,
  ] = useState(() => inicial("condicao", "novo"));

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
// Categoria com UM só valor (fixo pelo ML): seleciona e SALVA esse valor.
// Com vários: só ajusta a grafia do valor escolhido para a do ML.
useEffect(() => {
  if (tipoVeiculoML.estado !== "ok" || !tipoVeiculoML.existe) return;
  const novo = tipoVeiculoParaFicha(tipoVeiculoML, tipoVeiculo);
  if (novo !== tipoVeiculo) setTipoVeiculo(novo);
}, [tipoVeiculoML]); // eslint-disable-line react-hooks/exhaustive-deps
const [motivoCategoria, setMotivoCategoria] = useState("");
// Conflito: fonte superior (Base/cadastro/nome da peça) × título.
const [conflitoProduto, setConflitoProduto] = useState(null);

// Escolha explícita do usuário fica guardada para este código (só neste
// navegador). A escolha automática NÃO é guardada como "confirmada":
// é refeita a cada conferência, até o usuário escolher.
function escolherCategoria(opcao, origem = "agora", automatica = false) {
  if (!opcao?.id) return;
  categoriaIdRef.current = opcao.id;
  setCategoria(opcao.caminho || opcao.nome || opcao.id);
  setCategoriaId(opcao.id);
  setOrigemCategoria(origem);
  setMotivoCategoria("");
  if (automatica) return;
  gravarNoMapaLocal(CHAVE_CATEGORIA_ML, chaveProduto(numeroPeca || codigo), {
    id: opcao.id,
    caminho: opcao.caminho || opcao.nome || "",
    salvoEm: new Date().toISOString(),
  });
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

const [
  buscandoCategoria,
  setBuscandoCategoria,
] = useState(false);

const [
  opcoesCategoria,
  setOpcoesCategoria,
] = useState([]);

const [
  erroCategoria,
  setErroCategoria,
] = useState("");

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
  ]);

  // A aprovação compara o CONTEÚDO (não o formato): abrir/revisar, F5,
  // navegar ou abrir uma ficha antiga na versão nova não derrubam a
  // aprovação. Só uma alteração real em campo relevante exige validar de
  // novo — e, se o usuário desfizer, a aprovação guardada volta.
  useEffect(() => {
    const aprovada = assinaturaAprovadaRef.current;
    if (aprovada && anuncioConferido) {
      if (mesmaAprovacao(aprovada, assinaturaConferencia)) {
        // Diagnóstico: só o FORMATO mudou (antes, isso derrubava a aprovação).
        if (typeof window !== "undefined" && aprovada !== assinaturaConferencia) {
          try {
            const a = JSON.parse(aprovada), b = JSON.parse(assinaturaConferencia);
            window.__paiiaSoFormatoMudou = a.map((v, i) => (JSON.stringify(v) !== JSON.stringify(b[i]) ? i : -1)).filter((i) => i >= 0);
          } catch { /* assinatura antiga ilegível */ }
        }
        return;
      }
      const mudou = diferencasAssinatura(aprovada, assinaturaConferencia);
      if (typeof window !== "undefined") window.__paiiaDiferencasAprovacao = mudou;
      // Assinatura antiga ilegível, ou PUBLICAÇÃO (sem edição; diferença
      // vinda da recuperação): adota a atual e mantém a aprovação.
      if (mudou.includes("assinatura ilegível") || etapaFluxo === "publicacao") {
        assinaturaAprovadaRef.current = assinaturaConferencia;
        return;
      }
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

async function consultarCategoriaML(termos, automatica, permitirEscolha = true) {
  setBuscandoCategoria(true);
  setErroCategoria("");
  try {
    const r = await descobrirCategoriaML({
      termos,
      nomePeca: automatica ? produtoPrincipal.principal : termos[0],
      tipoVeiculo,
      palavrasVeiculo: palavrasVeiculoConferencia(),
    });
    setOpcoesCategoria(r.opcoes);
    // Nunca troca uma categoria já selecionada: só preenche quando vazia
    // e quando há UMA categoria segura. Senão fica PENDENTE com as opções.
    if (permitirEscolha && !categoriaIdRef.current && r.escolhida) {
      escolherCategoria(r.escolhida, automatica ? "automatica" : "agora", automatica);
      setMotivoCategoria("");
    } else if (!categoriaIdRef.current) {
      setMotivoCategoria(r.motivo);
    }
    if (!automatica && !r.opcoes.length) {
      setErroCategoria(r.motivo || "Nenhuma categoria encontrada para esta peça.");
    }
  } catch (erro) {
    console.error("❌ ERRO CATEGORIA MERCADO LIVRE:", erro);
    if (!categoriaIdRef.current) setMotivoCategoria("não foi possível consultar o Mercado Livre agora.");
    if (!automatica) setErroCategoria("Não foi possível consultar a categoria no Mercado Livre.");
  } finally {
    setBuscandoCategoria(false);
  }
}

// Busca manual (ferramenta auxiliar): consulta/troca; nunca apaga a atual.
async function atualizarCategoria() {
  const termo = String(termoCategoria || "").trim();
  if (!termo) {
    alert("Digite o nome da peça para buscar a categoria.");
    return;
  }
  // Mesmo na busca manual, "Kit" e itens inclusos não definem a categoria.
  const principal = extrairProdutoPrincipal(termo, produtoPrincipal.contexto).principal || termo;
  await consultarCategoriaML([...new Set([principal, termo])], false);
}

// Automática: ao abrir a Conferência sem categoria definida, consulta o ML
// pelo nome da peça e pelo título (aplicação só como contexto).
const categoriaAutoTentadaRef = useRef(false);
useEffect(() => {
  if (categoriaAutoTentadaRef.current || categoriaIdRef.current) return;
  categoriaAutoTentadaRef.current = true;
  const contexto = aplicacoesConfirmadas[0];
  const principal = produtoPrincipal.principal;
  if (!principal) {
    setMotivoCategoria("não foi possível identificar a peça principal (informe o nome da peça).");
    return;
  }
  // Título só entra se a peça principal dele for a mesma; se a base e o
  // título indicarem peças principais diferentes, não escolhe por suposição.
  const ignorar = new Set(palavrasVeiculoConferencia().flatMap((t) => normalizarTexto(t).split(/\s+/)));
  const doTitulo = extrairProdutoPrincipal(tituloAnuncio, produtoPrincipal.contexto).principal;
  const nucleoBase = nucleoDoProduto(principal, ignorar);
  const nucleoTitulo = doTitulo ? nucleoDoProduto(doTitulo, ignorar) : "";
  const tiposIguais = (a, b) => a === b || (SINONIMOS_TIPO_PECA[a] || []).includes(b);
  const fonteSuperior = !/^(título|descrição)/.test(produtoPrincipal.fonte);
  if (fonteSuperior && nucleoTitulo && !tiposIguais(nucleoBase, nucleoTitulo)) {
    // Conflito: não decide sozinho. Só mostra as opções; nada é escolhido.
    setConflitoProduto({ fonte: produtoPrincipal.fonte, base: principal, titulo: doTitulo });
    consultarCategoriaML([principal, doTitulo], false, false).then(() => {
      if (!categoriaIdRef.current) {
        setMotivoCategoria("confirme qual é o produto principal (corrija o nome da peça se preciso) e só então escolha a categoria abaixo.");
      }
    });
    return;
  }
  const termos = [
    principal,
    doTitulo && doTitulo !== principal ? doTitulo : "",
    contexto ? [principal, contexto.montadora, contexto.modelo].filter(Boolean).join(" ") : "",
  ];
  consultarCategoriaML(termos, true);
}, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Grava a ficha da conferência a cada alteração (uma por código).
  // Assim nada do que foi conferido some ao navegar ou atualizar a tela.
  const camposFicha = {
    titulo: tituloAnuncio,
    preco,
    codigo,
    descricao,
    marca,
    numeroPeca,
    gtin,
    tipoVeiculo,
    nomePeca,
    categoriaML: categoriaId || categoria ? { id: categoriaId, caminho: categoria, origem: origemCategoria } : null,
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
    tipoGarantia,
    mesesGarantia,
    limiteVenda,
    informacaoRegulatoria,
    caracteristicasSecundarias,
    logistica: copiaLeve(logisticaConferencia, 60000),
    contaDestinoML,
    anuncioIdPAIIA,
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
    });
  }, [assinaturaFicha]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ao entrar na PUBLICAÇÃO: grava a ficha aprovada na base PAIIA (mesmo ID
  // se já existir) com tudo o que foi aprovado. É dela que o F5/reabertura
  // recupera o anúncio — não do estado da tela nem do navegador.
  useEffect(() => {
    if (etapaFluxo !== "publicacao" || !anuncioConferido || !assinaturaAprovadaRef.current) return;
    const chaveGravacao = `${anuncioIdPAIIA}|${assinaturaAprovadaRef.current}`;
    if (fichaBaseGravadaRef.current === chaveGravacao && fichaBase.pronta) return;
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
      const r = await salvarFichaAprovada({
        anuncioId: idRascunho,
        codigo: anuncio?.codigo || anuncio?.oem || anuncioConferido.codigo,
        titulo: anuncioConferido.titulo,
        dadosConferencia: dados,
      });
      gravandoFichaRef.current = false;
      // O ID criado nunca é descartado (mesmo se o efeito foi refeito).
      if (r.ok) {
        fichaBaseGravadaRef.current = `${r.anuncioId}|${assinaturaAprovadaRef.current}`;
        if (!montadoRef.current) return;
        if (r.anuncioId !== anuncioIdPAIIA) setAnuncioIdPAIIA(r.anuncioId);
        setFichaBase({ pronta: true, erro: "" });
      } else if (montadoRef.current) {
        setFichaBase({ pronta: true, erro: r.erro || "Não foi possível gravar a ficha na base PAIIA." });
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
  const assinaturaRascunho = JSON.stringify([assinaturaFicha, fotosFicha, aplicacoesManuais, aprovadoAgora]);
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
    const campos = { ...camposFicha, anuncioIdPAIIA: "", fotos: fotosFicha, aplicacoesManuais };
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
    if (!chaveConferencia || !anuncio) return;
    if (st.gravando) { st.pendente = true; return; }
    const assinatura = assinaturaRascunhoRef.current;
    if (assinatura === st.ultima && idFichaRef.current) return;
    st.gravando = true;
    try {
      let id = idFichaRef.current || "";
      if (!id && criandoFichaPorCodigo.has(chaveConferencia)) {
        id = (await criandoFichaPorCodigo.get(chaveConferencia).catch(() => "")) || "";
      }
      if (id && st.fechada === id) return; // ficha publicada/cancelada: nunca é regravada
      const dados = montarDadosRef.current();
      const pedido = salvarRascunhoFicha({
        anuncioId: id,
        codigo: anuncio?.codigo || anuncio?.oem || codigo,
        titulo: tituloAnuncio,
        dadosConferencia: dados,
        aprovada: aprovadoRef.current,
        // Ficha antiga (já publicada) guardada para este código: só nesta
        // abertura da Conferência vira um anúncio NOVO; depois, nunca.
        criarSeFechada: !st.confirmadoNestaTela,
      });
      if (!id) {
        criandoFichaPorCodigo.set(chaveConferencia, pedido.then((r) => (r.ok ? r.anuncioId : "")));
      }
      const r = await pedido;
      if (!id) criandoFichaPorCodigo.delete(chaveConferencia);
      if (r.ok) {
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
      } else if (montadoRef.current) {
        setAvisoRascunho(r.erro || "Não foi possível gravar o rascunho na base PAIIA.");
      }
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
    const st = rascunhoRef.current;
    window.clearTimeout(st.timer);
    st.timer = window.setTimeout(() => gravarRascunhoRef.current(), st.ultima ? 800 : 0);
    return undefined;
  }, [assinaturaRascunho]); // eslint-disable-line react-hooks/exhaustive-deps

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
    salvarEstadoAtualDoTeste();

    setScreen?.(
      "centralPublicacao"
    );
  }

  async function validarAnuncio() {
    salvarEstadoAtualDoTeste();

    const faltando = [];

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

    if (!categoria.trim()) {
      faltando.push(
        "Categoria"
      );
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
      !tipoVeiculo.trim()
    ) {
      faltando.push(
        "Tipo de veículo"
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

    // Fotos do produto na ordem aprovada (banner e vídeo ficam separados).
    setAnuncioConferido({
      codigo: numeroPeca || codigo,
      oem: anuncio?.oem || "",
      titulo: tituloAnuncio,
      preco,
      descricao,
      tipoAnuncio: modalidade,
      marca,
      gtin,
      fotos: fotos.map(obterUrlFoto).filter(Boolean),
      categoria,
      categoriaId,
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
      logistica: logisticaConferencia,
      // Padrões fixos: vão para a ficha e para a Publicação.
      padroesML: padroesEsperadosConferencia(),
    });

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
            ⬅ Voltar
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
          <button
            type="button"
            data-paiia-editar-conferencia
            onClick={() => setRevisandoPublicacaoML(false)}
            style={{ ...botaoSecundario, marginTop: "12px" }}
          >
            ✏️ Editar / revisar a Conferência
          </button>
        </section>

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
            <RevisaoPublicacaoML
              anuncio={anuncioConferido}
              titulo={anuncioConferido.titulo}
              contaDestino={contaDestinoML}
              onContaDestino={setContaDestinoML}
              anuncioId={anuncioIdPAIIA}
              onAnuncioId={setAnuncioIdPAIIA}
              onFechar={() => setRevisandoPublicacaoML(false)}
              quantidadeFicha={quantidadeEstoque}
              onQuantidadeConfirmada={(q) => {
                // Mesma quantidade na ficha: campo Estoque + anúncio aprovado.
                setQuantidadeEstoque(String(q));
                setAnuncioConferido((a) => (a ? { ...a, quantidade: q, quantidadeConfirmada: true } : a));
              }}
            />
          </>
        )}

        <div style={acoes}>
          <button
            type="button"
            onClick={() => setScreen?.("centralPublicacao")}
            style={botaoSecundario}
          >
            ⬅ Central de Publicação
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "1180px",
        margin: "30px auto",
      }}
    >
      <section style={cabecalho} data-paiia-conferencia-paiia>
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
      </section>

      {/* 1 - DADOS DO ANÚNCIO */}
      <section style={bloco}>
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
      </section>

      {/* PEÇA — DADOS TÉCNICOS (só da peça; aplicações ficam no bloco ⑨) */}
      <section data-paiia-identificacao style={bloco}>
        <h3 style={titulo}>
          🔩 Peça — dados técnicos
        </h3>
        <p style={{ ...textoAuxiliar, marginTop: 0 }}>
          Só informações da PEÇA confirmadas (base PAIIA, descrição do anúncio ou fonte técnica). Veículos/aplicações: bloco ⑨ Compatibilidades.
        </p>

        <div style={gradeDois}>
          <Campo
            label="Nome da peça"
            value={nomePeca}
            onChange={setNomePeca}
            placeholder="Ex.: Parafuso de aço, sensor, bico injetor..."
          />
          <label style={labelStyle}>
            Código / OEM
            <div data-paiia-codigo-oem style={{ ...campo, display: "flex", alignItems: "center", color: "#e2e8f0" }}>
              {[...new Set([numeroPeca, codigo, anuncio?.oem].map((c) => String(c || "").trim()).filter(Boolean))].join(" · ") || "—"}
            </div>
          </label>
          <Campo
            label="Função / localização da peça"
            value={funcaoPeca}
            onChange={setFuncaoPeca}
            placeholder="Só se confirmada (ex.: Suporte do conjunto de transmissão e motor)"
          />
          <Campo
            label="Fonte da função/localização"
            value={fonteFuncao}
            onChange={setFonteFuncao}
            placeholder="Ex.: Renault Mecânico, catálogo, base PAIIA"
          />
          <Campo
            label="Especificação técnica / medida"
            value={especificacaoTecnica}
            onChange={setEspecificacaoTecnica}
            placeholder="Ex.: M12 × 1,75 × 35"
          />
          <Campo
            label="Como o comprador procura (opcional)"
            value={termoComercial}
            onChange={setTermoComercial}
            placeholder="Opcional — se vazio, o PAIIA usa a função (ex.: Parafuso suporte motor)"
          />
        </div>
        <p style={{ ...textoAuxiliar, marginTop: "6px" }}>
          {nomePecaBase
            ? "Nome vindo da base/catálogo do PAIIA. Corrija se necessário."
            : "A base não informou o nome da peça. Informe para usar na identificação."}{" "}
          Campo em branco fica em branco — o PAIIA não inventa função nem medida.
        </p>

        {(() => {
          // Dados lidos da DESCRIÇÃO do próprio anúncio (como dado, não palavra solta).
          const lidos = extrairDadosDescricao(descricao);
          const sugestoes = [
            ...lidos.medidas.filter((m) => normalizarTexto(m) !== normalizarTexto(especificacaoTecnica)).map((m) => ({ rotulo: `Medida: ${m}`, aplicar: () => setEspecificacaoTecnica(m) })),
            ...lidos.funcoes.filter((f) => normalizarTexto(f) !== normalizarTexto(funcaoPeca)).map((f) => ({ rotulo: `Função: ${f}`, aplicar: () => { setFuncaoPeca(f); if (!fonteFuncao.trim()) setFonteFuncao("Descrição do anúncio"); } })),
          ];
          if (!sugestoes.length) return null;
          return (
            <div data-paiia-dados-descricao style={{ marginTop: "8px", display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
              <span style={textoAuxiliar}>Encontrado na descrição:</span>
              {sugestoes.map((x) => (
                <button key={x.rotulo} type="button" onClick={x.aplicar} style={botaoMini}>
                  Usar {x.rotulo}
                </button>
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
              Buscas montadas com os dados CONFIRMADOS do próprio
              produto: código, peça, função, medida e compatibilidades.
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
          const dadosBusca = {
            codigos: [numeroPeca, codigo, anuncio?.oem, ...lidos.codigos],
            nomePeca,
            termoComercial,
            funcao: funcaoPeca,
            medida: especificacaoTecnica,
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
            codigo: "Código/OEM", peca: "Peça", funcao: "Função/localização", medida: "Especificação",
            montadora: "Montadora", modelo: "Modelo confirmado", motor: "Motor", ano: "Ano", versao: "Versão",
          };
          const caixa = { padding: "14px", borderRadius: "12px", border: "1px solid #164e63", background: "#020617", textAlign: "left" };
          const tituloCaixa = { color: "#67e8f9", fontSize: "12px", fontWeight: "bold", marginBottom: "10px" };
          return (
            <>
              <div data-paiia-termos-confirmados style={caixa}>
                <div style={tituloCaixa}>DADOS CONFIRMADOS DO PRODUTO</div>
                {confirmados.length ? (
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {confirmados.map((t) => (
                      <span key={`${t.origem}-${t.termo}`} title={rotuloOrigem[t.origem] || ""} style={{ ...chipPalavra, border: t.origem === "codigo" ? "1px solid #60a5fa" : chipPalavra.border }}>
                        {t.termo}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: "#94a3b8", fontSize: "13px" }}>Preencha o código, a peça e as compatibilidades para montar as buscas.</div>
                )}
              </div>

              <div data-paiia-intencoes-busca style={{ ...caixa, marginTop: "12px", background: "#082f49" }}>
                <div style={tituloCaixa}>🔍 COMO O COMPRADOR PODE PROCURAR ({intencoes.length})</div>
                {intencoes.length ? (
                  <div style={{ display: "grid", gap: "4px" }}>
                    {intencoes.map((x) => (
                      <div key={x.texto} data-tipo-busca={x.tipo} style={{ color: "#f8fafc", fontSize: "13px" }}>
                        {x.tipo === "codigo" ? "🔢" : x.tipo === "funcao" ? "🛠" : "🚗"} {x.texto}
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
      <section style={bloco}>
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

          {tipoVeiculoML.estado === "ok" && tipoVeiculoML.existe ? (
            <label style={labelStyle}>
              Tipo de veículo
              <select
                data-paiia-tipo-veiculo
                value={(valorTipoVeiculo(tipoVeiculoML.valores, tipoVeiculo) || {}).nome || ""}
                onChange={(e) => setTipoVeiculo(e.target.value)}
                disabled={tipoVeiculoML.fixo}
                style={campo}
              >
                {!tipoVeiculoML.fixo && <option value="">Selecione (valores do Mercado Livre)</option>}
                {tipoVeiculoML.valores.map((v) => (
                  <option key={v.id} value={v.nome}>{v.nome}</option>
                ))}
              </select>
              <span style={{ ...textoAuxiliar, fontWeight: "normal" }}>
                {tipoVeiculoML.fixo
                  ? "Definido pela categoria no Mercado Livre (valor único) — selecionado e salvo na ficha."
                  : "Valores oferecidos pelo Mercado Livre para esta categoria."}
              </span>
            </label>
          ) : tipoVeiculoML.estado === "ok" && tipoVeiculoML.existe === false ? (
            <label style={labelStyle}>
              Tipo de veículo
              <div data-paiia-tipo-veiculo-nao-se-aplica style={{ ...campo, display: "flex", alignItems: "center", color: "#94a3b8" }}>
                Não se aplica — esta categoria do Mercado Livre não tem esse campo
              </div>
            </label>
          ) : (
            <div style={labelStyle}>
              <Campo
                label="Tipo de veículo"
                value={tipoVeiculo}
                onChange={setTipoVeiculo}
                placeholder="Não informado (ex.: Carro/Caminhonete)"
              />
              <span style={{ ...textoAuxiliar, fontWeight: "normal" }}>
                {tipoVeiculoML.estado === "carregando"
                  ? "Lendo o Tipo de veículo da categoria no Mercado Livre..."
                  : tipoVeiculoML.estado === "sem_categoria"
                    ? "Defina a Categoria ML (bloco ⑮) para o PAIIA ler os valores do Mercado Livre."
                    : tipoVeiculoML.estado === "sem_conta"
                      ? "Sem conta Mercado Livre conectada: confirme o tipo manualmente."
                      : "Não foi possível ler a categoria no Mercado Livre agora: confirme o tipo manualmente."}
              </span>
            </div>
          )}
        </div>
      </section>

      {/* 6 - EMBALAGEM */}
      <section style={bloco}>
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
              valorInicial={fichaSalva?.campos?.logistica || null}
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
  style={{
    ...bloco,
    border:
      "1px solid #2563eb",
  }}
>
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

<div
  data-paiia-categoria-definida
  style={{
    padding: "14px 16px",
    borderRadius: "12px",
    border: categoriaId || categoria.trim() ? "1px solid #22c55e" : "1px solid #f59e0b",
    background: "#020617",
    marginBottom: "14px",
  }}
>
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
  {categoriaId || categoria.trim() ? (
    <>
      <div style={{ color: "#86efac", fontWeight: "bold", marginBottom: "6px" }}>
        ✅ Categoria Mercado Livre selecionada
      </div>
      <div style={{ color: "#f8fafc", fontWeight: "bold", lineHeight: 1.5 }}>{categoria || categoriaId}</div>
      <div style={{ marginTop: "6px", color: "#94a3b8", fontSize: "12px" }}>
        {categoriaId ? <>ID Mercado Livre: <strong>{categoriaId}</strong></> : "sem ID do Mercado Livre — use a busca abaixo para confirmar"}
        {origemCategoria ? ` · ${ROTULO_ORIGEM_CATEGORIA[origemCategoria] || origemCategoria}` : ""}
      </div>
    </>
  ) : (
    <>
      <div style={{ color: "#fbbf24", fontWeight: "bold" }}>
        {buscandoCategoria ? "⏳ Procurando a categoria no Mercado Livre..." : "Categoria Mercado Livre: PENDENTE"}
      </div>
      {!buscandoCategoria && motivoCategoria && (
        <div data-paiia-motivo-categoria style={{ marginTop: "6px", color: "#fde68a", fontSize: "12px" }}>
          Motivo: {motivoCategoria}
        </div>
      )}
    </>
  )}
</div>

<p style={textoAuxiliar}>
  {categoriaId || categoria.trim()
    ? "Busca auxiliar: consulte, confira ou escolha outra categoria. A categoria selecionada só muda se você escolher outra."
    : "Digite o nome da peça e o PAIIA consulta o Mercado Livre para encontrar a categoria."}
</p>

<div
  style={{
    display: "grid",
    gridTemplateColumns:
      "1fr auto",
    gap: "12px",
    alignItems: "end",
    marginBottom: "16px",
  }}
>
  <Campo
    label="Nome da peça"
    value={termoCategoria}
    onChange={setTermoCategoria}
    placeholder="Ex.: Sensor de nível, bomba de combustível, radiador..."
  />

  <button
    type="button"
    onClick={atualizarCategoria}
    disabled={buscandoCategoria}
    style={{
      ...botaoCategoria,
      opacity:
        buscandoCategoria
          ? 0.65
          : 1,
      cursor:
        buscandoCategoria
          ? "wait"
          : "pointer",
    }}
  >
    {buscandoCategoria
      ? "⏳ Buscando..."
      : "🤖 Buscar Categoria Mercado Livre"}
  </button>
</div>

{erroCategoria && (
  <div
    style={{
      padding: "12px",
      marginBottom: "14px",
      borderRadius: "10px",
      border:
        "1px solid #f59e0b",
      background:
        "rgba(245,158,11,0.08)",
      color: "#fde68a",
      fontSize: "13px",
    }}
  >
    ⚠️ {erroCategoria}
  </div>
)}

{opcoesCategoria.length > 0 && (
  <div
    style={{
      marginBottom: "16px",
    }}
  >
    <div
      style={{
        color: "#bfdbfe",
        fontWeight: "bold",
        marginBottom: "8px",
      }}
    >
      🔎 Categorias encontradas na busca
    </div>

    <div
      style={{
        display: "grid",
        gap: "8px",
      }}
    >
      {opcoesCategoria.map(
        (opcao) => (
          <button
            key={opcao.id}
            type="button"
            onClick={() =>
              escolherCategoria(
                opcao,
                "agora"
              )
            }
            style={{
              padding:
                "12px 14px",
              borderRadius:
                "10px",
              border:
                opcao.id ===
                categoriaId
                  ? "1px solid #22d3ee"
                  : "1px solid #334155",
              background:
                "#0f172a",
              color:
                "#e2e8f0",
              textAlign:
                "left",
              cursor:
                "pointer",
            }}
          >
            {opcao.caminho}

            <span
              style={{
                display: "block",
                marginTop: "4px",
                color: "#64748b",
                fontSize: "11px",
              }}
            >
              {opcao.id}
              {opcao.id === categoriaId
                ? " · selecionada"
                : " · clique para usar esta categoria"}
            </span>
          </button>
        )
      )}
    </div>
  </div>
)}

<details style={{ marginTop: "6px" }}>
  <summary style={{ color: "#64748b", fontSize: "12px", cursor: "pointer" }}>
    Editar o nome da categoria manualmente
  </summary>
  <AreaTexto
    value={categoria}
    onChange={setCategoria}
    placeholder="Categoria selecionada"
  />
</details>

</section>

      {/* 16 - REVISÃO FINAL */}
      <section
        style={{
          ...bloco,
          border: validado
            ? "1px solid #22c55e"
            : "1px solid #334155",
        }}
      >
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
            <strong data-paiia-revisao-categoria style={{ color: categoria.trim() || categoriaId ? "#86efac" : "#fca5a5" }}>
              {categoria.trim() || categoriaId
                ? `${categoria || categoriaId}${categoriaId ? ` (${categoriaId})` : " — sem ID do Mercado Livre"}`
                : "PENDENTE"}
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
              {tipoVeiculo.trim()
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
                onClick={() => window.scrollTo?.({ top: 0, behavior: "smooth" })}
                style={{ ...botaoSecundario, width: "100%", padding: "14px" }}
              >
                ← Voltar
              </button>
              <button
                type="button"
                data-paiia-abrir-revisao-ml
                onClick={() => setRevisandoPublicacaoML(true)}
                disabled={!anuncioConferido || contasMLDisponiveis.length === 0}
                style={{
                  ...botaoPrincipal,
                  width: "100%",
                  padding: "14px",
                  background: "linear-gradient(135deg,#16a34a,#22c55e)",
                  opacity: !anuncioConferido || contasMLDisponiveis.length === 0 ? 0.5 : 1,
                }}
              >
                ✅ Finalizar e escolher conta
              </button>
            </div>
            <p style={{ ...textoAuxiliar, marginTop: "10px", textAlign: "center" }}>
              {contasMLDisponiveis.length
                ? "Abre a Publicação DESTA ficha (REVELAÇÃO, LOJA ONLINE ou CIEBR). Nada é publicado: lá você confere, valida no Mercado Livre e só publica com autorização explícita."
                : "Nenhuma conta Mercado Livre conectada: conecte em Contas Marketplace para publicar de verdade."}
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

      <div style={acoes}>
        <button
          type="button"
          onClick={() =>
            setScreen?.(
              "centralPublicacao"
            )
          }
          style={botaoSecundario}
        >
          ⬅ Voltar
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

const botaoCategoria = {
  marginTop: "12px",
  padding: "11px 16px",
  borderRadius: "10px",
  border:
    "1px solid #38bdf8",
  background: "#082f49",
  color: "#bae6fd",
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
  const [estado, setEstado] = useState(() => ({ pronto: !fichaUrl, erro: "" }));

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
        // O MLB já existe (com ou sem pendência): nunca reabre para publicar de novo.
        const pend = pendenciaPublicacao(r.anuncio.publicacao);
        setEstado({ pronto: false, erro: `Este anúncio já foi publicado (${r.anuncio.publicacao.mlb_id || "MLB"})${pend ? ` e está COM PENDÊNCIA: ${pend.replace(/^PENDÊNCIA — /, "")} A correção é feita no mesmo MLB, sem publicar de novo.` : "."}` });
        return;
      }
      if (r.anuncio.status_fluxo === "cancelado") {
        setEstado({ pronto: false, erro: "Esta ficha foi cancelada (o anúncio continuou em outra ficha)." });
        return;
      }
      // A base é a fonte: a cópia do navegador é refeita a partir dela.
      try {
        const chaveLocal = String(r.anuncio.codigo || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
        const mapa = JSON.parse(localStorage.getItem("paiiaConferenciaPorCodigo") || "{}");
        const rec = montarRecuperacaoDaFicha(r.anuncio, mapa[chaveLocal] || null);
        if (!rec.ok) {
          setEstado({ pronto: false, erro: rec.erro });
          return;
        }
        window.__paiiaAnuncioSimulador = null;
        window.__paiiaFotosPublicacao = rec.fotos;
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

  // Saiu da Conferência/Publicação: o endereço deixa de apontar a ficha.
  useEffect(() => () => {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has("ficha")) {
        url.searchParams.delete("ficha");
        window.history.replaceState(window.history.state, "", url.toString());
      }
    } catch {
      // ignora
    }
  }, []);

  if (!estado.pronto) {
    return (
      <div data-paiia-recuperando-ficha style={{ width: "100%", maxWidth: "1180px", margin: "30px auto" }}>
        <section style={cabecalho}>
          {estado.erro ? (
            <>
              <p style={{ color: "#fca5a5" }}>❌ {estado.erro}</p>
              <button type="button" onClick={() => props.setScreen?.("centralPublicacao")} style={botaoSecundario}>
                ⬅ Central de Publicação
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
      setDecisao((d) => ({ ...d, carregando: false, valor: salva?.decisao || "", gravacao: salva?.gravacao || null }));
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

  async function confirmarGravacao() {
    setDecisao((d) => ({ ...d, ocupado: "gravar", erro: "" }));
    const { data, error } = await supabase.functions.invoke("catalogo-escrita", {
      body: { acao: "gravar_lote", registros: montarRegistros(), meta: { catalogo: "Conferência PAIIA" } },
    });
    const gravacao = error ? { ok: false, erro: error.message } : data || { ok: false };
    if (gravacao.ok) {
      await registrarDecisaoBase({ anuncioId, decisao: "autorizado", detalhe: { gravacao: { lote_id: gravacao.lote_id || gravacao.loteId || null, inseridos: gravacao.inseridos ?? null } } });
    }
    setDecisao((d) => ({ ...d, ocupado: "", gravacao }));
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
          <div>Autorizado salvar na base PAIIA ({montarRegistros().length} registro(s), só dados conferidos).</div>
          {decisao.gravacao?.ok ? (
            <div style={{ color: "#86efac" }}>✅ Gravado na base PAIIA{decisao.gravacao.lote_id ? ` (lote ${String(decisao.gravacao.lote_id).slice(0, 8)})` : ""}.</div>
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
