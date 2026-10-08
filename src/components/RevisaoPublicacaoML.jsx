import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import { useContasML, contasMLConectadas } from "../services/contaMLAtiva";
import { conferirLogistica } from "../services/logistica/logisticaMercadoLivre";
import { verificarDuplicidadeML, nomeDaLoja } from "../services/duplicidadeML";
import {
  listarAnunciosDoCodigo,
  obterAnuncio,
  salvarContaDestino,
  registrarBling,
  registrarResultadoPublicacao,
  cancelarFichaSemConta,
  registrarProdutoBlingCriado,
  conferirDuplicidadeBase,
  skuOficial,
  pendenciaPublicacao,
  publicacaoExiste,
  salvarCompatibilidadesML,
  registrarPublicacaoSemCompatibilidade,
  registrarMLBPublicado,
  salvarRegistroIntegracaoBling,
  garantirRegistroIntegracaoBling,
} from "../services/anuncioPublicacaoService";
import { registroPublicado, conferirIntegracao, precisaConferir, skuOficialBling, registroDaFicha, ESTADO as ESTADO_BLING } from "../services/vinculoBlingPublicacao";
import PainelIntegracaoBling from "./PainelIntegracaoBling";
import { tipoVeiculoParaPublicacao } from "../services/tipoVeiculoAnuncio";
import {
  lerAplicacoesAprovadas,
  resolverCompatibilidades,
  marcaInvalida,
  descricaoAfirmaOriginal,
  conferirPublicacao,
  separarAplicacoesParaML,
  normalizarCondicao,
  situacaoCompatibilidade,
  TEXTO_SEM_APLICACAO,
  TEXTO_VEICULOS_SO_NA_DESCRICAO,
} from "../services/compatibilidadeML";
import { conferirPadroesNoItem, conferirPadroesPublicados, padroesEsperadosConferencia } from "../services/padroesPublicacaoML";
import { normalizarQuantidade, quantidadeDaFicha, conferirEstoque, montarProdutoBling, decidirCriacaoBling, conferirProdutoCriado } from "../services/estoqueBlingPAIIA";
import { conferirFichaPersistida, conferirCompatPersistida, modelosConfirmados, modelosFaltandoNaDescricao, TEXTO_MODELOS_FALTANDO } from "../services/publicacaoSegura";

/*
 * PUBLICAÇÃO no Mercado Livre — etapa que vem DEPOIS da Conferência PAIIA.
 *
 * Esta tela NÃO confere o anúncio de novo: marca, categoria, peso/medidas,
 * descrição e compatibilidade chegam já aprovados pela Conferência
 * (anuncioConferido) e são só mostrados. Aqui o usuário escolhe a conta de
 * destino DESTE anúncio, valida no Mercado Livre e publica.
 *
 * Nada é publicado automaticamente:
 * 1. confere a conexão (conta do usuário logado + token válido);
 * 2. monta o anúncio e mostra tudo para revisão;
 * 3. "Validar no Mercado Livre" só confere os dados (não cria anúncio);
 * 4. "Publicar" exige a caixa de autorização marcada e um segundo clique.
 *
 * Tokens e credenciais nunca passam por aqui: tudo roda na função
 * mercadolivre-publicacao, no servidor.
 */

function obterUrlFoto(foto) {
  if (typeof foto === "string") return foto;
  return foto?.imagem_processada || foto?.imagem_original || foto?.url || foto?.src || "";
}

function precoTexto(valor) {
  const t = String(valor ?? "").trim();
  if (!t) return "";
  const n = t.includes(",") ? Number(t.replace(/\./g, "").replace(",", ".")) : Number(t);
  return Number.isFinite(n) ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : t;
}

const CHAVE_MARCA_PADRAO = "paiia_ml_marca_padrao";

// Lojas (contas Mercado Livre): vêm SEMPRE da base (contas conectadas ao
// PAIIA). O nome amigável sai de nomeDaLoja (services/duplicidadeML.js);
// conta nova conectada aparece sozinha, com o apelido do Mercado Livre.

function lerMarcaPadrao() {
  try {
    return localStorage.getItem(CHAVE_MARCA_PADRAO) || "";
  } catch {
    return "";
  }
}



/*
 * Verificação TÉCNICA da publicação (não é uma segunda conferência):
 * fotos acessíveis, preço, estoque no Bling, peso confirmado na
 * Conferência e frete da conta. "erro" bloqueia; "aviso" não bloqueia.
 */
function conferir({ campos, quantidadeConfirmada = false, preparo, validacao, estoque, fotosUrls, logistica, ficha, duplicado, duplicidadeML, duplicidadeBase, possivelConfirmado, skuEnvio, codigoPesquisado = "", descricao, compatML, aplicacoes, modelosSemDetalhes = [], tipoVeiculoPub = null, compatTexto, condicaoEnvio = "", semCompatConfirmada = false, semCompatAutorizadaPublicacao = false }) {
  const itens = [];

  // Condição: a APROVADA na ficha (novo/usado). Nunca assume "novo".
  if (!condicaoEnvio) itens.push({ item: "Condição", nivel: "erro", texto: "Condição não confirmada na Conferência (novo ou usado). O PAIIA não assume nenhum valor." });
  else itens.push({ item: "Condição", nivel: "ok", texto: condicaoEnvio === "usado" ? "Usado (vai ao Mercado Livre como used)." : "Novo (vai ao Mercado Livre como new)." });

  // Sem aplicação estruturada = anúncio SEM compatibilidade no ML: bloqueia,
  // salvo confirmação explícita "publicar sem compatibilidade" na Conferência.
  const sitCompat = situacaoCompatibilidade({ aplicacoes, descricao, semCompatibilidadeConfirmada: semCompatConfirmada || semCompatAutorizadaPublicacao });
  if (sitCompat.bloqueia) {
    // semCompatOpcao: este é o ÚNICO bloqueio que a opção "Publicar sem
    // compatibilidade — vou cadastrar manualmente depois" pode liberar.
    itens.push({ item: "Compatibilidades", nivel: "erro", semCompatOpcao: true, texto: `${sitCompat.soNaDescricao ? TEXTO_VEICULOS_SO_NA_DESCRICAO : TEXTO_SEM_APLICACAO} Volte à Conferência para cadastrar as aplicações (ou marcar "Publicar sem compatibilidade").` });
  } else if (sitCompat.semAplicacao && semCompatAutorizadaPublicacao && !semCompatConfirmada) {
    itens.push({ item: "Compatibilidades", nivel: "aviso", texto: "Publicação SEM compatibilidade, autorizada por você na Publicação (cadastro manual no Mercado Livre depois). Nenhum veículo será vinculado agora." });
  } else if (sitCompat.semAplicacao) {
    itens.push({ item: "Compatibilidades", nivel: "aviso", texto: `Publicação SEM compatibilidade, confirmada explicitamente na Conferência.${sitCompat.soNaDescricao ? " Atenção: a descrição cita veículos." : ""}` });
  }

  // Ficha do anúncio na base PAIIA: a conta de destino precisa estar gravada.
  if (!ficha?.disponivel) itens.push({ item: "Ficha do anúncio", nivel: "erro", texto: ficha?.erro || "Base PAIIA indisponível: a conta de destino não pôde ser gravada." });
  else if (!ficha?.gravada) itens.push({ item: "Ficha do anúncio", nivel: "erro", texto: "Escolha a conta: ela é gravada na ficha deste anúncio antes de publicar." });
  else itens.push({ item: "Ficha do anúncio", nivel: "ok", texto: `Conta gravada na base PAIIA (anúncio ${String(ficha.anuncioId).slice(0, 8)}).` });
  if (duplicado) itens.push({ item: "Duplicidade", nivel: "erro", texto: `Este código já está publicado nesta conta (${duplicado}). Publicar de novo criaria anúncio duplicado.` });
  // SKU oficial (SKU específico ou o próprio código da peça).
  if (!skuEnvio) itens.push({ item: "SKU", nivel: "erro", texto: "Sem SKU: o anúncio precisa sair com SKU (o código da peça)." });
  else itens.push({ item: "SKU", nivel: "ok", texto: `SKU enviado ao Mercado Livre (igual ao produto do Bling): ${skuEnvio}.${codigoPesquisado && codigoPesquisado !== skuEnvio ? ` Código pesquisado na ficha: ${codigoPesquisado}.` : ""}` });
  // Proteção A: base PAIIA (código/SKU normalizado + conta + MLB + status).
  if (duplicidadeBase?.carregando) itens.push({ item: "Duplicidade na base PAIIA", nivel: "aviso", texto: "Conferindo na base PAIIA..." });
  else if (duplicidadeBase?.erro) itens.push({ item: "Duplicidade na base PAIIA", nivel: "erro", texto: `Não foi possível conferir a base PAIIA (${duplicidadeBase.erro}). Sem essa conferência a publicação fica bloqueada.` });
  else if (duplicidadeBase?.registros?.length) itens.push({ item: "Duplicidade na base PAIIA", nivel: "erro", texto: `A base PAIIA já registra este código publicado nesta conta: ${duplicidadeBase.registros.map((p) => `${p.mlb_id || "sem MLB"} (${p.status_publicacao})`).join(", ")}. Publicação bloqueada.` });
  else if (duplicidadeBase?.verificado) itens.push({ item: "Duplicidade na base PAIIA", nivel: "ok", texto: "A base PAIIA não registra este código publicado nesta conta." });
  // Mesmo SKU + MESMA conta + anúncio já existente no Mercado Livre = bloqueia.
  // (O mesmo SKU em OUTRA conta é permitido: cada conta tem o seu MLB.)
  if (duplicidadeML?.carregando) itens.push({ item: "Duplicidade na conta", nivel: "aviso", texto: "Conferindo no Mercado Livre se este SKU/código já está anunciado nesta conta (maiúsculas, minúsculas, espaços e anúncios antigos)..." });
  else if (duplicidadeML?.erro) itens.push({ item: "Duplicidade na conta", nivel: "erro", texto: `Não foi possível conferir anúncios deste SKU/código nesta conta (${duplicidadeML.erro}). Sem essa conferência a publicação fica bloqueada.` });
  else if (duplicidadeML?.duplicados?.length) itens.push({ item: "Duplicidade na conta", nivel: "erro", texto: `Este SKU/código já tem anúncio nesta conta: ${duplicidadeML.duplicados.map((d) => `${d.id} (${d.status}; ${d.motivo})`).join(", ")}. Publicar de novo criaria duplicidade (em outra conta é permitido).` });
  else if (duplicidadeML?.ativosBase?.length) itens.push({ item: "Duplicidade na conta", nivel: "erro", texto: `O anúncio registrado na base ainda existe no Mercado Livre nesta conta: ${duplicidadeML.ativosBase.join(", ")}.` });
  else if (duplicidadeML?.possiveis?.length && !possivelConfirmado) itens.push({ item: "Possível duplicidade na conta", nivel: "erro", texto: `Anúncio desta conta com o mesmo código, mas SKU diferente/vazio: ${duplicidadeML.possiveis.map((d) => `${d.id} (${d.status}; ${d.motivo})`).join(", ")}. Confira no Mercado Livre; só publique se NÃO for o mesmo produto (marque a confirmação abaixo).` });
  else if (duplicidadeML?.possiveis?.length) itens.push({ item: "Possível duplicidade na conta", nivel: "aviso", texto: `Você confirmou que ${duplicidadeML.possiveis.map((d) => d.id).join(", ")} NÃO é o mesmo produto.` });
  else if (duplicidadeML?.verificado) itens.push({ item: "Duplicidade na conta", nivel: "ok", texto: `Nenhum anúncio deste SKU/código nesta conta (${duplicidadeML.buscas} buscas, ${duplicidadeML.candidatos} anúncios conferidos). O mesmo SKU em outras contas não bloqueia.` });
  if (estoque?.ambiguo) itens.push({ item: "Bling", nivel: "erro", texto: "Mais de um produto no Bling com este SKU: resolva no Bling antes (o PAIIA não escolhe sozinho)." });

  // Marca: a marca REAL aprovada. Código OEM/"original" não é marca.
  const problemaMarca = marcaInvalida(campos.marca);
  if (!String(campos.marca || "").trim()) itens.push({ item: "Marca", nivel: "erro", texto: "Sem marca aprovada. Informe a marca real na Conferência (não invente)." });
  else if (problemaMarca) itens.push({ item: "Marca", nivel: "erro", texto: problemaMarca });
  else itens.push({ item: "Marca", nivel: "ok", texto: campos.marca });

  // Descrição: sem afirmar original/genuína; curta demais = aviso.
  const desc = String(descricao || "").trim();
  if (!desc) itens.push({ item: "Descrição", nivel: "erro", texto: "Sem descrição. Use \"Montar descrição padrão\" na Conferência." });
  else if (descricaoAfirmaOriginal(desc)) itens.push({ item: "Descrição", nivel: "erro", texto: "A descrição afirma \"original/genuína\" sem comprovação. Corrija na Conferência." });
  else if (desc.length < 200) itens.push({ item: "Descrição", nivel: "aviso", texto: `Descrição curta (${desc.length} caracteres). Confira se tem peça, aplicações, códigos e a orientação de conferir o código.` });
  else itens.push({ item: "Descrição", nivel: "ok", texto: `${desc.length} caracteres.` });

  // Modelos confirmados × descrição: bloqueia validar/publicar até revisar.
  // O PAIIA não altera a descrição sozinho e não inventa ano/motor/aplicação.
  const faltamModelos = modelosFaltandoNaDescricao({ modelos: modelosConfirmados({ aplicacoes, modelosSemDetalhes }), descricao: desc });
  if (desc && faltamModelos.length) {
    itens.push({ item: "Modelos na descrição", nivel: "erro", texto: `${TEXTO_MODELOS_FALTANDO} Faltando: ${faltamModelos.join(", ")}. Revise a descrição na Conferência ("← Voltar à Conferência").` });
  }

  // Tipo de veículo: SÓ o confirmado na ficha (⑤). A Publicação não troca;
  // categoria que não aceita o tipo da ficha = erro (o usuário ajusta).
  if (tipoVeiculoPub && tipoVeiculoPub.texto) {
    const nivel = tipoVeiculoPub.estado === "ok" || tipoVeiculoPub.estado === "nao_se_aplica" ? "ok" : "erro";
    itens.push({ item: "Tipo de veículo", nivel, texto: tipoVeiculoPub.texto });
  }

  // Compatibilidades aprovadas → veículos do catálogo do Mercado Livre.
  // Modelos confirmados SEM ano/motor: ficam na descrição e na busca, mas
  // NÃO vão para a tabela oficial do ML (zero aplicação > aplicação errada).
  if (modelosSemDetalhes.length) {
    itens.push({ item: "Modelos sem detalhes", nivel: "ok", texto: `${modelosSemDetalhes.length} modelo(s) confirmado(s) sem ano/motor (${modelosSemDetalhes.map((a) => a.modelo).join(", ")}) ficam na descrição e na busca; não são vinculados à tabela de compatibilidade do Mercado Livre.` });
  }
  if (!aplicacoes.length && !modelosSemDetalhes.length && String(compatTexto || "").trim()) {
    itens.push({ item: "Compatibilidades", nivel: "aviso", texto: "O texto de compatibilidade aprovado não está no formato de aplicações (montadora / • modelo / Motor / Período). Nenhum veículo será vinculado: revise na Conferência." });
  }
  if (aplicacoes.length) {
    if (!compatML || compatML.carregando) itens.push({ item: "Compatibilidades", nivel: "erro", texto: `Procurando no catálogo do ML os veículos das ${aplicacoes.length} aplicação(ões) aprovada(s)...` });
    else if (compatML.erro) itens.push({ item: "Compatibilidades", nivel: "erro", texto: `Catálogo de veículos não consultado (${compatML.erro}). Reconsulte antes de publicar.` });
    else if (!compatML.veiculos.length) itens.push({ item: "Compatibilidades", nivel: "aviso", texto: `Nenhum veículo do catálogo confirma as aplicações aprovadas. Se publicar assim, o anúncio fica PUBLICADO COM PENDÊNCIA.` });
    else itens.push({ item: "Compatibilidades", nivel: "ok", texto: `${compatML.veiculos.length} veículo(s) do catálogo serão vinculados (${compatML.descartados.length} descartado(s) por não confirmar os dados aprovados).` });
  }

  // Fotos
  const checks = preparo?.fotos_check || [];
  const boas = checks.filter((c) => c.ok).length;
  if (!fotosUrls.length) itens.push({ item: "Fotos", nivel: "erro", texto: "Nenhuma foto." });
  else if (!preparo) itens.push({ item: "Fotos", nivel: "aviso", texto: "Conferindo fotos..." });
  else if (boas === 0) itens.push({ item: "Fotos", nivel: "erro", texto: "Nenhuma foto abre por endereço público https." });
  else
    itens.push({
      item: "Fotos",
      nivel: boas < fotosUrls.length ? "aviso" : "ok",
      texto: `${boas} de ${fotosUrls.length} foto(s) abrem por https e são imagens.${boas < fotosUrls.length ? " As outras ficam de fora." : ""}`,
    });

  // Preço
  const t = String(campos.preco).trim();
  const preco = t.includes(",") ? Number(t.replace(/\./g, "").replace(",", ".")) : Number(t);
  itens.push(
    Number.isFinite(preco) && preco > 0
      ? { item: "Preço", nivel: "ok", texto: preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) }
      : { item: "Preço", nivel: "erro", texto: "Preço inválido." }
  );

  // Estoque: UMA quantidade confirmada (ficha = Conferência = Publicação =
  // validação = payload do ML). Nunca assume 1. SKU fora do Bling exige a
  // criação do produto no Bling antes de validar no Mercado Livre.
  const est = conferirEstoque({ quantidade: campos.quantidade, confirmada: quantidadeConfirmada, bling: estoque });
  itens.push({ item: "Estoque", nivel: est.nivel, texto: est.texto });

  // Peso e embalagem (bloqueia sem medida validada/informada, fora do
  // limite, sem simulação com os valores atuais ou sem confirmação).
  // Peso e as 3 medidas da embalagem são obrigatórios (o ML exige em
  // várias categorias/contas, ex.: CIEBR). Só medidas DESTE produto,
  // confirmadas na Conferência; nunca de outro anúncio.
  const MEDIDAS = [["peso_g", "peso"], ["altura_cm", "altura"], ["largura_cm", "largura"], ["comprimento_cm", "comprimento"]];
  const faltamMedidas = MEDIDAS.filter(([k]) => !(Number(String(logistica?.medida?.[k] ?? "").replace(",", ".")) > 0)).map(([, n]) => n);
  if (faltamMedidas.length) {
    itens.push({ item: "Peso e medidas", nivel: "erro", texto: `${TEXTO_MEDIDAS_OBRIGATORIAS} Falta: ${faltamMedidas.join(", ")}. Informe e confirme na Conferência (bloco Peso e Embalagem).` });
  }
  const log = conferirLogistica({
    medidaEnvio: logistica?.medida,
    origem: logistica?.origem,
    nivel: logistica?.nivel,
    validacao: logistica?.validacao,
    simulacao: logistica?.simulacao,
    confirmado: logistica?.confirmado,
  });
  itens.push({
    item: "Peso e embalagem",
    nivel: log.nivel,
    texto: log.nivel === "ok" ? log.texto : `${log.texto} (vem da Conferência: use "← Voltar à Conferência").`,
  });

  // Frete
  const frete = preparo?.frete;
  if (!preparo) itens.push({ item: "Frete", nivel: "aviso", texto: "Conferindo..." });
  else if (frete?.erro) itens.push({ item: "Frete", nivel: "aviso", texto: `Não foi possível ler as preferências de envio: ${frete.erro}` });
  else {
    const modos = (frete?.modos || []).join(", ") || "nenhum";
    const gratis = Number.isFinite(preco) && preco >= 79;
    itens.push({
      item: "Frete",
      nivel: "aviso",
      texto: `Modos de envio da conta: ${modos}. Peso e medidas enviados: os do bloco PESO E EMBALAGEM.${gratis ? " Com preço a partir de R$ 79 o frete grátis é obrigatório e o custo fica com o vendedor." : ""}`,
    });
  }

  // Padrões fixos de todo anúncio novo (garantia, retirada, regulatória):
  // conferidos NO ITEM que a função monta para o Mercado Livre.
  const montado = validacao?.ok && validacao?.padroes_ml && validacao?.item ? validacao : preparo;
  if (!preparo) itens.push({ item: "Padrões ML", nivel: "aviso", texto: "Conferindo garantia, retirada e informação regulatória..." });
  else if (preparo.ok === false) itens.push({ item: "Padrões ML", nivel: "erro", texto: "Não foi possível montar o anúncio para conferir garantia, retirada e informação regulatória." });
  else if (!montado?.padroes_ml || !montado?.item) {
    itens.push({ item: "Padrões ML", nivel: "erro", texto: "A função de publicação em uso ainda não aplica os padrões fixos (garantia 3 meses do vendedor, Ofereço retirada, informação regulatória). Publicação bloqueada até a nova versão da função ser publicada." });
  } else {
    for (const c of conferirPadroesNoItem(montado.item, montado.padroes_ml)) itens.push(c);
    (montado.limitacoes_padroes || []).forEach((t, i) => itens.push({ item: `Limitação ML ${i + 1}`, nivel: "aviso", texto: t }));
  }
  return itens;
}

const TEXTO_MEDIDAS_OBRIGATORIAS = "Peso e medidas da embalagem são obrigatórios para esta publicação.";
const ehFaltaMedidasML = (c) => /seller[._]package|package[._]dimensions/i.test(`${c?.codigo || ""} ${c?.mensagem || ""}`);

// Toda chamada leva a conta ML escolhida (conta_ml). Sem conta: não chama.
async function chamar(acao, extra = {}, contaML = "") {
  if (!contaML) return { ok: false, codigo: "conta_nao_selecionada", erro: "Selecione a conta Mercado Livre desta publicação." };
  const { data, error } = await supabase.functions.invoke("mercadolivre-publicacao", {
    body: { acao, conta_ml: String(contaML), ...extra },
  });
  if (error) return { ok: false, erro: error.message || "Falha ao falar com o servidor." };
  return data || { ok: false, erro: "Resposta vazia do servidor." };
}

export default function RevisaoPublicacaoML({ anuncio, titulo, onFechar, contaDestino = "", onContaDestino, anuncioId = "", onAnuncioId, quantidadeFicha = "", onQuantidadeConfirmada, bloqueioFicha = "", onPublicado, onAbrirTelaFinal, onVoltarCompatibilidades }) {
  const [conexao, setConexao] = useState(null);
  const [preparo, setPreparo] = useState(null);
  const [validacao, setValidacao] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [ocupado, setOcupado] = useState("conexao");
  const [autorizado, setAutorizado] = useState(false);
  const [armado, setArmado] = useState(false);
  // Ficha PERSISTIDA (fonte de verdade): relida pelo ID antes de validar e
  // de novo antes de publicar. digitalValidada = versão da ficha que o
  // Mercado Livre validou; a publicação só segue com essa MESMA versão.
  const [fichaPersistida, setFichaPersistida] = useState(null);
  const [digitalValidada, setDigitalValidada] = useState("");
  const [estoque, setEstoque] = useState(null);
  // Peso e medidas: os CONFIRMADOS na Conferência (não se confere de novo).
  const logistica = anuncio?.logistica || null;
  // Conta de destino DESTE anúncio (marketplaceAccountId). Fonte de verdade:
  // a ficha do anúncio na base PAIIA (paiia_anuncios, pelo ID do anúncio).
  // O navegador guarda só cache. Nunca usa a "conta ativa" global e nada vem
  // pré-selecionado: o usuário escolhe e a escolha é gravada na hora.
  const estadoContas = useContasML();
  const contasConectadas = contasMLConectadas(estadoContas);
  const [contaEscolhida, setContaEscolhidaLocal] = useState("");
  const [ficha, setFicha] = useState({ carregando: true, disponivel: true, gravada: false, anuncioId: anuncioId || "", erro: "", outros: [] });
  const [gravandoConta, setGravandoConta] = useState(false);
  // "Publicar sem compatibilidade — vou cadastrar manualmente depois":
  // autorização gravada NA FICHA (lida da base: F5/Voltar não volta a bloquear).
  const [semCompatAut, setSemCompatAut] = useState({ autorizado: false, gravando: false, erro: "" });

  // Abre a ficha: pelo ID do anúncio (este computador já a conhece) ou lista
  // as fichas existentes deste código para o usuário continuar a certa.
  useEffect(() => {
    let ativo = true;
    (async () => {
      const codigo = anuncio?.codigo || anuncio?.oem || "";
      const lista = await listarAnunciosDoCodigo(codigo);
      if (!ativo) return;
      if (!lista.ok && !lista.disponivel) {
        // Base sem a tabela: só cache local, e a publicação fica bloqueada.
        setContaEscolhidaLocal(String(contaDestino || ""));
        setFicha({ carregando: false, disponivel: false, gravada: false, anuncioId: "", erro: lista.erro, outros: [] });
        return;
      }
      const outros = (lista.anuncios || []).filter((a) => a.id !== anuncioId);
      if (anuncioId) {
        const r = await obterAnuncio(anuncioId);
        if (!ativo) return;
        // Ficha já publicada: este é outro anúncio do mesmo código (nova ficha).
        if (r.ok && publicacaoExiste(r.anuncio.publicacao)) {
          onAnuncioId?.("");
          // (com o registro da integração Bling, para voltar direto à etapa
          //  "falta trazer este MLB para o Bling" depois de um F5)
          setFicha({ carregando: false, disponivel: true, gravada: false, anuncioId: "", erro: "", outros: [{ ...r.anuncio, integracao_bling: r.anuncio.dados_conferencia?.integracao_bling || null }, ...outros] });
          return;
        }
        if (r.ok) {
          setSemCompatAut((s) => ({ ...s, autorizado: r.anuncio.dados_conferencia?.publicacao_sem_compatibilidade?.autorizado === true }));
          const conta = String(r.anuncio.conta_destino_ml_user_id || "");
          setContaEscolhidaLocal(conta);
          onContaDestino?.(conta);
          setFicha({ carregando: false, disponivel: true, gravada: Boolean(conta), anuncioId, erro: "", outros, publicacao: r.anuncio.publicacao });
          return;
        }
      }
      setFicha({ carregando: false, disponivel: true, gravada: false, anuncioId: "", erro: lista.ok ? "" : lista.erro, outros });
    })();
    return () => { ativo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function setContaEscolhida(id, nome) {
    const conta = String(id || "");
    setContaEscolhidaLocal(conta);
    onContaDestino?.(conta);
    if (!ficha.disponivel) return;
    // Mesmo código já publicado nesta conta: não cria ficha duplicada.
    const jaPublicado = (ficha.outros || []).find(
      (a) => publicacaoExiste(a.publicacao) && String(a.publicacao?.ml_user_id) === conta
    );
    if (jaPublicado) {
      setFicha((f) => ({ ...f, gravada: false, erro: `Este código já está publicado em ${nome || "esta conta"} (${jaPublicado.publicacao.mlb_id || "MLB"}). Escolha outra conta.` }));
      return;
    }
    setGravandoConta(true);
    const r = await salvarContaDestino({
      anuncioId: ficha.anuncioId,
      codigo: anuncio?.codigo || anuncio?.oem || "",
      titulo: titulo || anuncio?.titulo || "",
      contaId: conta,
      contaNome: nome || "",
      dadosConferencia: {
        codigo: anuncio?.codigo || "",
        titulo: anuncio?.titulo || "",
        preco: anuncio?.preco || "",
        marca: anuncio?.marca || "",
        gtin: anuncio?.gtin || "",
        categoria: anuncio?.categoria || "",
        categoriaId: anuncio?.categoriaId || "",
        logistica: anuncio?.logistica?.medida ? { medida: anuncio.logistica.medida, confirmado: Boolean(anuncio.logistica.confirmado) } : null,
        padroes_ml: anuncio?.padroesML || padroesEsperadosConferencia(),
      },
    });
    setGravandoConta(false);
    if (r.ok) {
      onAnuncioId?.(r.anuncioId);
      setFicha((f) => ({ ...f, gravada: true, anuncioId: r.anuncioId, erro: "" }));
    } else {
      setFicha((f) => ({ ...f, gravada: false, disponivel: r.disponivel !== false, erro: r.erro }));
    }
  }

  // Continuar uma ficha que já existe (ex.: aberta em outro computador).
  function continuarFicha(a) {
    // A ficha criada aqui no "Próximo passo" (ainda sem conta) é abandonada.
    if (ficha.anuncioId && ficha.anuncioId !== a.id && !ficha.gravada) cancelarFichaSemConta(ficha.anuncioId);
    const conta = String(a.conta_destino_ml_user_id || "");
    onAnuncioId?.(a.id);
    onContaDestino?.(conta);
    setContaEscolhidaLocal(conta);
    setFicha((f) => ({ ...f, anuncioId: a.id, gravada: Boolean(conta), outros: f.outros.filter((x) => x.id !== a.id), publicacao: a.publicacao }));
  }

  const contaInfo = contasConectadas.find((c) => String(c.ml_user_id) === contaEscolhida) || null;
  // Opções: TODAS as contas conectadas na base (uma opção por ID).
  const opcoesConta = [...new Map(contasConectadas
    .filter((c) => String(c.ml_user_id || "").trim())
    .map((c) => [String(c.ml_user_id), { nome: nomeDaLoja(c.ml_user_id, c.nickname), id: String(c.ml_user_id), conectada: true, nickname: c.nickname || "" }])).values()];

  const fotosUrls = useMemo(
    () =>
      // Só as fotos do produto: banners com texto/arte não seguem a
      // política de imagens do Mercado Livre.
      (Array.isArray(anuncio?.fotos) ? anuncio.fotos : [])
        .map(obterUrlFoto)
        .filter(Boolean),
    [anuncio]
  );

  // SKU oficial deste anúncio (SKU específico ou o código da peça).
  // SKU OFICIAL = `codigo` do produto no Bling, exatamente como está lá
  // (hífen, zeros, letras, maiúsculas/minúsculas). Enquanto o Bling não foi
  // lido, só para conferências de duplicidade, vale o código da ficha; a
  // publicação exige o produto Bling (blingPronto) e então sai com o do Bling.
  const codigoPesquisado = String(anuncio?.codigo || anuncio?.oem || "");
  const skuBling = skuOficialBling(estoque);
  const skuEnvio = skuBling || skuOficial({ sku: anuncio?.sku, codigo: anuncio?.codigo || anuncio?.oem });

  // Quantidade: a CONFIRMADA na ficha (nunca 1 por padrão).
  const qtdInicial = quantidadeDaFicha(anuncio, quantidadeFicha);
  const [quantidadeConfirmada, setQuantidadeConfirmada] = useState(qtdInicial.confirmada);
  const [avisoQuantidade, setAvisoQuantidade] = useState("");
  const [campos, setCampos] = useState(() => ({
    titulo: String(titulo || anuncio?.titulo || "").slice(0, 60),
    preco: String(anuncio?.preco ?? ""),
    quantidade: qtdInicial.valor ? String(qtdInicial.valor) : "",
    tipoAnuncio: anuncio?.tipoAnuncio === "premium" ? "premium" : "classico",
    // Marca e categoria: as APROVADAS na Conferência.
    marca: String(anuncio?.marca || lerMarcaPadrao() || ""),
    codigo: String(anuncio?.codigo || anuncio?.oem || ""),
    gtin: String(anuncio?.gtin || ""),
    categoria_id: String(anuncio?.categoriaId || ""),
  }));
  // Atributos obrigatórios da categoria que o usuário escolhe aqui.
  const [extras, setExtras] = useState({});
  // Tipo de veículo: vai EXATAMENTE o confirmado na ficha (⑤ da Conferência),
  // como valor da categoria no ML. Não é escolhido aqui.
  const attrTipoVeiculo = (preparo?.obrigatorios || []).find((a) => a.id === "VEHICLE_TYPE") || null;
  const tipoVeiculoPub = tipoVeiculoParaPublicacao(anuncio?.tipoVeiculo, attrTipoVeiculo);
  const tipoVeiculoEnvio = tipoVeiculoPub.estado === "ok" ? tipoVeiculoPub.nome : "";

  const dadosAnuncio = useMemo(
    () => ({
      ...campos,
      // Mesma quantidade confirmada da ficha (a função recusa se vier vazia).
      quantidade: quantidadeConfirmada ? normalizarQuantidade(campos.quantidade) : null,
      oem: anuncio?.oem || "",
      // SKU oficial vai ao ML como atributo SELLER_SKU.
      sku: skuEnvio,
      descricao: anuncio?.descricao || "",
      // Condição APROVADA na ficha (novo/usado): a função recusa se vier vazia.
      condicao: normalizarCondicao(anuncio?.condicao),
      fotos: fotosUrls,
      // Padrões fixos aprovados na Conferência (a função reaplica no servidor).
      padroes_ml: anuncio?.padroesML || padroesEsperadosConferencia(),
      // Só a medida validada/informada e confirmada vai ao ML.
      embalagem:
        logistica?.medida && logistica.confirmado
          ? { ...logistica.medida, nivel: logistica.nivel, origem: logistica.nivel, config_embalagem: logistica.config_embalagem, modalidade: logistica.modalidade }
          : null,
      atributos_extras: [
        ...Object.entries(extras)
          .filter(([id, v]) => id !== "VEHICLE_TYPE" && v && (v.value_id || v.value_name))
          .map(([id, v]) => ({ id, ...(v.value_id ? { value_id: v.value_id } : { value_name: v.value_name }) })),
        ...(tipoVeiculoPub.extra ? [tipoVeiculoPub.extra] : []),
      ],
      // Conferência (não vai ao ML): tipo enviado = tipo da ficha.
      tipo_veiculo: tipoVeiculoPub.extra ? tipoVeiculoPub.nome : undefined,
    }),
    [campos, anuncio, fotosUrls, extras, logistica, skuEnvio, quantidadeConfirmada, tipoVeiculoPub.extra?.value_id, tipoVeiculoPub.nome]
  );

  function alterarExtra(id, valor) {
    setExtras((e) => ({ ...e, [id]: valor }));
    setValidacao(null);
    setArmado(false);
  }

  function alterar(campo, valor) {
    setCampos((c) => ({ ...c, [campo]: valor }));
    if (campo === "quantidade") { setQuantidadeConfirmada(false); setAvisoQuantidade(""); }
    setValidacao(null);
    setArmado(false);
  }
  // Confirma a quantidade e grava na ficha (Conferência + Publicação).
  function confirmarQuantidade() {
    const q = normalizarQuantidade(campos.quantidade);
    if (!q) {
      setAvisoQuantidade("Informe um número inteiro, 1 ou mais (o PAIIA não assume nenhum valor).");
      return;
    }
    setCampos((c) => ({ ...c, quantidade: String(q) }));
    setQuantidadeConfirmada(true);
    setAvisoQuantidade("");
    setValidacao(null);
    setArmado(false);
    onQuantidadeConfirmada?.(q);
  }

  async function preparar(categoriaId) {
    setOcupado("preparar");
    // Sempre com a categoria aprovada na Conferência (quando houver).
    const r = await chamar("preparar", {
      anuncio: { ...dadosAnuncio, categoria_id: categoriaId ?? dadosAnuncio.categoria_id },
    }, contaEscolhida);
    setPreparo(r);
    if (r?.ok && r.categoria_id && !categoriaId) {
      setCampos((c) => ({ ...c, categoria_id: r.categoria_id }));
    }
    setOcupado("");
  }

  // Conexão da conta escolhida (roda de novo se o usuário trocar a conta).
  useEffect(() => {
    let ativo = true;
    setConexao(null);
    setPreparo(null);
    setValidacao(null);
    setResultado(null);
    setAutorizado(false);
    setArmado(false);
    if (!contaEscolhida) {
      setOcupado("");
      return () => { ativo = false; };
    }
    setOcupado("conexao");
    (async () => {
      const c = await chamar("validar_conexao", {}, contaEscolhida);
      if (!ativo) return;
      setConexao(c);
      setOcupado("");
      if (c?.ok && c.conectado && c.pertence_ao_usuario && String(c.ml_user_id) === String(contaEscolhida)) preparar();
    })();
    return () => { ativo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contaEscolhida]);

  useEffect(() => {
    let ativo = true;
    (async () => {
      // Estoque: somente leitura no Bling, pelo SKU.
      const sku = String(anuncio?.codigo || "").trim();
      if (sku) {
        try {
          const { data } = await supabase.functions.invoke("bling-integracao", {
            body: { acao: "saldo_por_sku", sku },
          });
          if (ativo) setEstoque(data || { ok: false });
        } catch {
          if (ativo) setEstoque({ ok: false });
        }
      } else if (ativo) setEstoque({ ok: false, encontrado: false });
    })();
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mesmo código já PUBLICADO nesta conta por outra ficha → duplicidade.
  const duplicado = (() => {
    const p = (ficha.outros || []).find(
      (a) => publicacaoExiste(a.publicacao) && String(a.publicacao?.ml_user_id) === contaEscolhida
    );
    return p ? p.publicacao.mlb_id || "já publicado" : "";
  })();

  // Cadastro que SERÁ criado no Bling se o produto não existir: só dados
  // confirmados da ficha (nada inventado). Estoque inicial = quantidade
  // CONFIRMADA do anúncio.
  const cadastroBling = useMemo(
    () => montarProdutoBling({ anuncio, titulo: titulo || anuncio?.titulo, quantidade: quantidadeConfirmada ? campos.quantidade : null, logistica }),
    [anuncio, titulo, logistica, quantidadeConfirmada, campos.quantidade]
  );
  const preparoBling = cadastroBling.produto;

  // Estado do Bling gravado na ficha da publicação (somente leitura do Bling).
  useEffect(() => {
    if (!estoque || !ficha.gravada || !ficha.anuncioId) return;
    registrarBling({ anuncioId: ficha.anuncioId, bling: estoque, preparo: estoque.encontrado ? null : preparoBling });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estoque, ficha.gravada, ficha.anuncioId]);

  // Duplicidade REAL no Mercado Livre: anúncios deste SKU na conta escolhida
  // (somente leitura). Não olha outras contas.
  const [duplicidadeML, setDuplicidadeML] = useState(null);
  // Proteção B: Mercado Livre, na conta escolhida (somente leitura).
  //  - busca por SKU (como será enviado, como veio e normalizado);
  //  - confere no ML os MLBs que a base PAIIA registra para esta conta
  //    (pega anúncio antigo publicado SEM SKU, como o MLB5329721847).
  // Qualquer erro de consulta BLOQUEIA.
  async function consultarDuplicidadeML(conta, registrosBase = []) {
    const consultar = (caminho) => chamar("ml_consulta", { metodo: "GET", caminho }, conta);
    let r;
    try {
      r = await verificarDuplicidadeML({ conta, codigos: [skuEnvio, anuncio?.codigo, anuncio?.oem], consultar });
    } catch (e) {
      return { erro: e?.message || "falha na consulta" };
    }
    if (r.erro) return r;
    const ativosBase = [];
    const jaListados = new Set([...r.duplicados, ...r.possiveis].map((d) => d.id));
    for (const p of registrosBase) {
      if (!/^MLB\d+$/.test(String(p?.mlb_id || "")) || jaListados.has(p.mlb_id)) continue;
      const it = await consultar(`/items/${p.mlb_id}`);
      if (!it?.ok) return { erro: it?.erro || `não foi possível consultar ${p.mlb_id}` };
      const d = it.dados || {};
      if (String(d.seller_id || "") === String(conta) && d.status !== "closed") ativosBase.push(`${p.mlb_id} (${d.status})`);
    }
    return { ...r, ativosBase };
  }
  // Possível duplicidade (mesmo código no título/número da peça, SKU
  // diferente): só libera com confirmação explícita, valendo para ESSES MLBs.
  const [possivelConfirmadoIds, setPossivelConfirmadoIds] = useState("");
  const idsPossiveis = (d) => (d?.possiveis || []).map((x) => x.id).sort().join(",");
  const possivelConfirmado = Boolean(possivelConfirmadoIds) && possivelConfirmadoIds === idsPossiveis(duplicidadeML);
  async function consultarDuplicidadeBase(conta) {
    const r = await conferirDuplicidadeBase({ codigo: anuncio?.codigo || anuncio?.oem || "", sku: skuEnvio, contaId: conta });
    return r.ok ? { verificado: true, registros: r.registros } : { erro: r.erro || "base indisponível" };
  }
  const [duplicidadeBase, setDuplicidadeBase] = useState(null);
  async function conferirDuplicidadeML(conta) {
    if (!conta || !skuEnvio) return;
    setDuplicidadeBase({ carregando: true });
    setDuplicidadeML({ carregando: true });
    const base = await consultarDuplicidadeBase(conta);
    setDuplicidadeBase(base);
    setDuplicidadeML(await consultarDuplicidadeML(conta, base.registros || []));
  }

  // Compatibilidades: SOMENTE as aplicações aprovadas na Conferência,
  // casadas com o catálogo de veículos do ML (consultas somente leitura).
  // Só aplicações com dados suficientes (motor e/ou ano confirmados) vão para
  // a tabela do ML; modelos sem detalhes ficam fora (nunca por suposição).
  const todasAplicacoes = useMemo(
    () => lerAplicacoesAprovadas({ aplicacoes: anuncio?.aplicacoes, texto: anuncio?.compatibilidades }),
    [anuncio]
  );
  const separadas = useMemo(() => separarAplicacoesParaML(todasAplicacoes), [todasAplicacoes]);
  const aplicacoes = separadas.detalhadas;
  const modelosSemDetalhes = separadas.semDetalhes;
  const [compatML, setCompatML] = useState(null);
  async function resolverCompat(conta) {
    if (!conta || !aplicacoes.length) { setCompatML(null); return; }
    setCompatML({ carregando: true });
    const consultar = (caminho, metodo = "GET", corpo) => chamar("ml_consulta", { metodo, caminho, ...(corpo ? { corpo } : {}) }, conta);
    try {
      setCompatML(await resolverCompatibilidades(aplicacoes, consultar));
    } catch (e) {
      setCompatML({ erro: e?.message || "falha na consulta" });
    }
  }

  // Leitura (com nova tentativa) do MLB criado e das compatibilidades dele.
  async function relerPublicado(itemId, conta) {
    let item = null;
    let compat = null;
    for (let tentativa = 0; tentativa < 3 && !item; tentativa++) {
      if (tentativa) await new Promise((ok) => setTimeout(ok, 2500));
      const r = await chamar("ml_consulta", { metodo: "GET", caminho: `/items/${itemId}` }, conta);
      if (r?.ok && r.dados?.id) item = r.dados;
    }
    const c = await chamar("ml_consulta", { metodo: "GET", caminho: `/items/${itemId}/compatibilities` }, conta);
    if (c?.ok) compat = c.dados || { products: [] };
    return { item, compat };
  }

  // Bling: releitura (somente leitura) e criação do produto ANTES de validar
  // no Mercado Livre, só com clique/autorização (nunca automática).
  const [criacaoBling, setCriacaoBling] = useState(null);
  const [painelBling, setPainelBling] = useState(false);
  async function lerBling(skuBling = "") {
    const sku = String(skuBling || anuncio?.codigo || "").trim();
    if (!sku) return { ok: false, encontrado: false };
    try {
      const { data } = await supabase.functions.invoke("bling-integracao", { body: { acao: "saldo_por_sku", sku } });
      return data || { ok: false };
    } catch {
      return { ok: false };
    }
  }
  async function relerBling() {
    setEstoque(null);
    setEstoque(await lerBling());
  }
  async function criarProdutoBling() {
    if (cadastroBling.faltando.length) return;
    const enviado = cadastroBling.produto;
    setCriacaoBling({ ocupado: true, etapa: "Conferindo de novo o SKU no Bling..." });
    // 1) Releitura imediatamente antes de criar: se já existir, NÃO cria.
    const antes = await lerBling();
    const decisao = decidirCriacaoBling(antes);
    if (decisao.acao !== "criar") {
      setEstoque(antes);
      setCriacaoBling({ ocupado: false, ok: false, criado: false, jaExistia: decisao.acao === "ja_existe", erro: decisao.motivo });
      return;
    }
    // 2) Criação (a função confere o SKU de novo no servidor).
    setCriacaoBling({ ocupado: true, etapa: "Criando o produto no Bling..." });
    const { data, error } = await supabase.functions.invoke("bling-integracao", {
      body: { acao: "criar_produto", confirmado: true, confirmacao: "CRIAR_PRODUTO_BLING", produto: enviado },
    });
    const r = error ? { ok: false, erro: error.message } : data || { ok: false, erro: "Resposta vazia." };
    if (!r.ok || (!r.criado && !r.ja_existia)) {
      setCriacaoBling({ ocupado: false, ok: false, erro: r.erro || "O Bling não criou o produto." });
      return;
    }
    // 3) Releitura depois: confere ID, SKU e estoque; vincula à ficha.
    //    Se o SKU já existia escrito de outro jeito (ex.: com hífen), relê
    //    pela escrita do Bling: usa ESSE cadastro, nada é criado.
    setCriacaoBling({ ocupado: true, etapa: "Relendo o produto no Bling..." });
    const depois = await lerBling(r.ja_existia ? r.produto?.codigo : "");
    setEstoque(depois);
    const conf = r.ja_existia ? { ok: true, problemas: [] } : conferirProdutoCriado({ enviado, criado: r, releitura: depois });
    const idBling = r.produto?.id || depois?.produto?.id;
    if (idBling && ficha.anuncioId) await registrarProdutoBlingCriado({ anuncioId: ficha.anuncioId, blingProdutoId: idBling });
    setCriacaoBling({ ocupado: false, ok: conf.ok, criado: Boolean(r.criado), jaExistia: Boolean(r.ja_existia), produto: { id: idBling, codigo: enviado.codigo }, problemas: conf.problemas, estoqueInicial: r.estoque_inicial || null });
    setPainelBling(false);
  }

  // Relê a ficha na base e compara com a tela e com o que vai ao ML.
  // Divergência = não segue (nada é validado nem publicado calado).
  async function reconferirFichaPersistida() {
    const id = ficha.anuncioId;
    if (!id) return { ok: false, motivo: "Sem a ficha gravada na base PAIIA: nada é validado nem publicado.", divergencias: [] };
    let r = null;
    let res = null;
    for (let tentativa = 0; tentativa < 2; tentativa++) {
      // 2ª leitura: dá tempo de uma gravação desta tela (ex.: quantidade) chegar à base.
      if (tentativa) await new Promise((ok) => setTimeout(ok, 1500));
      r = await obterAnuncio(id);
      if (r.ok && publicacaoExiste(r.anuncio.publicacao)) {
        return { ok: false, motivo: `Esta ficha já foi publicada (${r.anuncio.publicacao.mlb_id || "MLB"}). Nada é publicado de novo.`, divergencias: [] };
      }
      res = conferirFichaPersistida({ tela: anuncio, envio: dadosAnuncio, base: r.ok ? r.anuncio : null });
      if (res.ok || !res.divergencias.length) break;
    }
    return res;
  }
  function recarregarFicha() {
    try {
      const url = new URL(window.location.href);
      if (ficha.anuncioId) url.searchParams.set("ficha", ficha.anuncioId);
      window.location.assign(url.toString());
    } catch {
      window.location.reload();
    }
  }

  async function validarNoML() {
    setOcupado("validar");
    setValidacao(null);
    setArmado(false);
    setDigitalValidada("");
    // Fonte de verdade: a ficha persistida, relida AGORA.
    const fp = await reconferirFichaPersistida();
    setFichaPersistida(fp);
    if (!fp.ok) {
      setValidacao({ ok: false, erro: `Validação NÃO executada: ${fp.motivo}` });
      setOcupado("");
      return;
    }
    // Duplicidade conferida de novo na validação (base + Mercado Livre).
    await conferirDuplicidadeML(contaEscolhida);
    const r = await chamar("validar_item", { anuncio: dadosAnuncio }, contaEscolhida);
    setValidacao(r);
    if (r?.ok && r.valido) setDigitalValidada(fp.digital);
    setOcupado("");
  }

  // INTEGRAÇÃO COM A GESTÃO DE ANÚNCIOS DO BLING (anúncio novo do PAIIA).
  // Depois do MLB: o usuário traz SOMENTE este MLB pelo Bling; o PAIIA só
  // CONFERE (leitura anuncios_consultar). Nunca grava no Bling, nunca
  // republica, nunca cria produto. /produtos/lojas não faz parte do fluxo ML.
  const [integracao, setIntegracao] = useState(null); // { anuncioId, registro }
  const [verificandoBling, setVerificandoBling] = useState("");
  async function consultarBling(corpo) {
    const { data, error } = await supabase.functions.invoke("bling-integracao", { body: corpo });
    if (error) return { ok: false, erro: error.message || "Falha ao falar com o servidor." };
    return data || { ok: false, erro: "Resposta vazia do servidor." };
  }
  async function verificarIntegracao(alvo, completa) {
    if (!alvo?.anuncioId || !precisaConferir(alvo.registro)) return;
    setVerificandoBling(alvo.anuncioId);
    const { registro: novo } = await conferirIntegracao({ registro: alvo.registro, consultar: consultarBling, completa });
    setVerificandoBling("");
    const mudou = novo.estado !== alvo.registro.estado || novo.bling_anuncio_id !== alvo.registro.bling_anuncio_id;
    if (mudou || completa) await salvarRegistroIntegracaoBling({ anuncioId: alvo.anuncioId, registro: novo });
    setIntegracao((atual) => (atual?.anuncioId === alvo.anuncioId ? { ...atual, registro: novo } : atual));
  }
  // Recuperação após F5: a ficha publicada com integração pendente volta
  // direto para esta etapa (só fichas deste fluxo novo têm o registro).
  useEffect(() => {
    if (integracao) return;
    const pendente = (ficha.outros || []).find((a) => {
      const reg = registroDaFicha({ integracao_bling: a.integracao_bling });
      return publicacaoExiste(a.publicacao) && reg && reg.estado !== ESTADO_BLING.INTEGRADO;
    });
    if (pendente) setIntegracao({ anuncioId: pendente.id, registro: registroDaFicha({ integracao_bling: pendente.integracao_bling }) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ficha.outros]);
  // Conferência automática leve (só leitura) a cada 30 s, por até 30 min.
  useEffect(() => {
    if (!integracao || !precisaConferir(integracao.registro) || integracao.registro.estado !== ESTADO_BLING.AGUARDANDO) return;
    let n = 0;
    const t = setInterval(() => {
      n += 1;
      if (n > 60) return clearInterval(t);
      if (!verificandoBling) verificarIntegracao(integracao, false);
    }, 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [integracao?.anuncioId, integracao?.registro?.estado]);

  async function publicar() {
    if (!autorizado || !validacao?.valido || bloqueios.length > 0) return;
    if (!armado) {
      setArmado(true);
      return;
    }
    // Compatibilidades aprovadas ainda não resolvidas no catálogo: espera.
    if (aplicacoes.length && (!compatML || compatML.carregando || compatML.erro)) {
      setResultado({ ok: false, erro: "Publicação BLOQUEADA: as compatibilidades aprovadas ainda não foram conferidas no catálogo do Mercado Livre." });
      setArmado(false);
      return;
    }
    setOcupado("publicar");
    // Ficha persistida relida NA HORA: tem de ser a MESMA versão validada.
    const fp = await reconferirFichaPersistida();
    setFichaPersistida(fp);
    if (!fp.ok || !digitalValidada || fp.digital !== digitalValidada) {
      setResultado({
        ok: false,
        erro: `Publicação BLOQUEADA: ${fp.ok ? "a ficha gravada mudou depois da validação. Valide de novo." : fp.motivo}`,
      });
      setValidacao(null);
      setDigitalValidada("");
      setArmado(false);
      setOcupado("");
      return;
    }
    // Compatibilidade estruturada GRAVADA na ficha antes de publicar: as
    // aplicações aprovadas e as versões do catálogo ML que serão enviadas.
    // Relida da base; se não bater com a tela, nada é publicado.
    if (aplicacoes.length) {
      const idsTela = (compatML?.veiculos || []).map((v) => v.id);
      const sv = await salvarCompatibilidadesML({ anuncioId: ficha.anuncioId, aplicacoes, compat: compatML });
      const relida = sv.ok ? await obterAnuncio(ficha.anuncioId) : null;
      const cp = sv.ok ? conferirCompatPersistida({ idsEnvio: idsTela, base: relida?.ok ? relida.anuncio : null }) : { ok: false, motivo: `as compatibilidades não puderam ser gravadas na ficha (${sv.erro || "erro"})` };
      if (!cp.ok) {
        setResultado({ ok: false, erro: `Publicação BLOQUEADA: ${cp.motivo}` });
        setArmado(false);
        setOcupado("");
        return;
      }
    }
    // Proteção dupla, conferida de novo NA HORA do clique (sem cache).
    const base = await consultarDuplicidadeBase(contaEscolhida);
    setDuplicidadeBase(base);
    const noML = base.erro ? null : await consultarDuplicidadeML(contaEscolhida, base.registros || []);
    if (noML) setDuplicidadeML(noML);
    const motivo = base.erro
      ? `Base PAIIA não conferida (${base.erro}).`
      : base.registros.length
        ? `A base PAIIA já registra este código publicado nesta conta (${base.registros.map((p) => p.mlb_id || p.status_publicacao).join(", ")}).`
        : noML?.erro
          ? `Mercado Livre não conferido (${noML.erro}).`
          : noML?.duplicados?.length || noML?.ativosBase?.length
            ? `Já existe anúncio deste SKU/código nesta conta no Mercado Livre (${[...(noML.duplicados || []).map((d) => d.id), ...(noML.ativosBase || [])].join(", ")}).`
            : noML?.possiveis?.length && possivelConfirmadoIds !== idsPossiveis(noML)
              ? `Possível duplicidade nesta conta (${noML.possiveis.map((d) => d.id).join(", ")}) sem confirmação.`
              : "";
    if (motivo) {
      setResultado({ ok: false, erro: `Publicação BLOQUEADA: ${motivo}` });
      setArmado(false);
      setOcupado("");
      return;
    }
    const r = await chamar("publicar", {
      anuncio: dadosAnuncio,
      confirmado: true,
      confirmacao: "PUBLICAR",
    }, contaEscolhida);
    let verificacao = null;
    let registroBling = null;
    if (r?.ok && r.publicado && r.item_id) {
      // 1º: salva NA HORA (antes de qualquer outra etapa; resiste a F5/erro):
      // MLB, SKU oficial, código pesquisado, produto Bling, conta, loja Bling,
      // preço e data/hora. Estado: aguardando_importacao.
      registroBling = registroPublicado({
        mlb: r.item_id,
        contaId: contaEscolhida,
        contaNome: contaInfo?.nickname || "",
        skuOficial: skuEnvio,
        codigoPesquisado,
        produtoBlingId: estoque?.encontrado && !estoque?.ambiguo ? estoque?.produto?.id : "",
        preco: campos.preco,
      });
      if (ficha.anuncioId) {
        setIntegracao({ anuncioId: ficha.anuncioId, registro: registroBling });
        await registrarMLBPublicado({
          anuncioId: ficha.anuncioId, contaId: contaEscolhida, mlb: r.item_id, link: r.link, sku: skuEnvio,
          blingProdutoId: registroBling.bling_produto_id, registro: registroBling,
        });
      }
      // Compatibilidades: só os veículos do catálogo que confirmam as
      // aplicações aprovadas (lista mostrada antes da publicação).
      const idsCompat = (compatML?.veiculos || []).map((v) => v.id);
      let envioCompat = null;
      if (idsCompat.length) {
        envioCompat = await chamar("gravar_compatibilidades", {
          item_id: r.item_id,
          produtos: idsCompat.map((id) => ({ id })),
          domain_id: compatML.dominio,
          confirmado: true,
          confirmacao: "COMPATIBILIDADES",
        }, contaEscolhida);
      }
      // Verificação pós-publicação: relê o MLB e compara com o enviado.
      const { item, compat } = await relerPublicado(r.item_id, contaEscolhida);
      // Preço EFETIVAMENTE publicado (relido no MLB), se o ML devolveu.
      const precoLido = Number(item?.price);
      if (registroBling && ficha.anuncioId && Number.isFinite(precoLido) && precoLido > 0 && precoLido !== registroBling.preco_publicado) {
        registroBling = { ...registroBling, preco_publicado: Math.round(precoLido * 100) / 100 };
        setIntegracao({ anuncioId: ficha.anuncioId, registro: registroBling });
        await salvarRegistroIntegracaoBling({ anuncioId: ficha.anuncioId, registro: { preco_publicado: registroBling.preco_publicado } });
      }
      verificacao = conferirPublicacao({
        itemId: r.item_id,
        esperado: {
          conta: contaEscolhida,
          sku: skuEnvio,
          preco: campos.preco,
          quantidade: campos.quantidade,
          tipoAnuncio: campos.tipoAnuncio,
          fotos: fotosUrls.length,
          marca: campos.marca,
          tipoVeiculo: tipoVeiculoEnvio,
          compatibilidades: idsCompat,
          compatibilidadesAprovadas: aplicacoes.length,
          condicao: dadosAnuncio.condicao,
        },
        item,
        compat,
      });
      const presentes = new Set((compat?.products || []).map((p) => String(p?.catalog_product_id || "")));
      const motivoEnvio = envioCompat && !envioCompat.ok
        ? (envioCompat.erro || (envioCompat.resultados || []).filter((x) => !x.ok).map((x) => x.erro).join("; ") || "o ML recusou o envio")
        : "";
      verificacao.compatibilidades = {
        aplicacoes_aprovadas: aplicacoes.length,
        enviados: idsCompat.length,
        aceitos: idsCompat.filter((id) => presentes.has(String(id))).length,
        rejeitados: idsCompat
          .filter((id) => !presentes.has(String(id)))
          .map((id) => ({ id, nome: compatML.veiculos.find((v) => v.id === id)?.nome || id, motivo: motivoEnvio || "não apareceu no anúncio depois do envio" })),
        descartados_antes: (compatML?.descartados || []).map((d) => ({ id: d.id, nome: d.nome, motivo: d.motivo })),
        sem_catalogo: compatML?.semCatalogo || [],
      };
      if (aplicacoes.length && !idsCompat.length && !verificacao.pendencias.some((t) => t.startsWith("Compatibilidades"))) {
        verificacao.pendencias.push("Compatibilidades: havia aplicações aprovadas e nenhum veículo foi vinculado.");
      }
      // Padrões fixos relidos no MLB criado (garantia, retirada, regulatória).
      const padroesEnviados = r.padroes_ml || validacao?.padroes_ml || preparo?.padroes_ml || null;
      const vp = conferirPadroesPublicados(item, padroesEnviados);
      verificacao.itens.push(...vp.itens);
      verificacao.pendencias.push(...vp.pendencias);
      verificacao.padroes_ml = {
        enviados: padroesEnviados,
        limitacoes: r.limitacoes_padroes || [],
        releitura: vp,
        releitura_funcao: r.padroes_publicados || null,
      };
    }
    setResultado(verificacao ? { ...r, verificacao } : r);
    setArmado(false);
    // Salva o resultado na ficha: MLB, data/hora, SKU, verificação, Bling.
    if (ficha.anuncioId) {
      const g = await registrarResultadoPublicacao({ anuncioId: ficha.anuncioId, contaId: contaEscolhida, resultado: r, bling: estoque, sku: skuEnvio, verificacao });
      // O registro do MLB para o Bling tem de ESTAR na ficha (relido e,
      // se preciso, gravado de novo): é ele que leva à etapa do Bling.
      const gr = registroBling ? await garantirRegistroIntegracaoBling({ anuncioId: ficha.anuncioId, registro: registroBling }) : { ok: true };
      setFicha((f) => ({ ...f, resultadoGravado: g.ok && gr.ok, erroResultado: !g.ok ? g.erro : gr.ok ? "" : gr.erro, modoGravacao: g.modo }));
      if (r?.ok && r.publicado && r.item_id) onPublicado?.(ficha.anuncioId);
      // Integração com o Bling: o usuário traz SOMENTE este MLB pelo Bling
      // (painel abaixo) e o PAIIA confere por leitura. Nada é gravado aqui.
    }
    setOcupado("");
  }

  const contaOk = Boolean(contaEscolhida) && conexao?.ok && conexao.conectado && conexao.pertence_ao_usuario && String(conexao.ml_user_id) === String(contaEscolhida);
  useEffect(() => {
    setDuplicidadeML(null);
    setDuplicidadeBase(null);
    setPossivelConfirmadoIds("");
    setCompatML(null);
    if (contaOk) {
      conferirDuplicidadeML(contaEscolhida);
      resolverCompat(contaEscolhida);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contaOk, contaEscolhida]);

  const conferencia = conferir({
    campos, quantidadeConfirmada, preparo, validacao, estoque, fotosUrls, logistica, ficha, duplicado, duplicidadeML, duplicidadeBase, possivelConfirmado, skuEnvio, codigoPesquisado,
    descricao: anuncio?.descricao, compatML, aplicacoes, modelosSemDetalhes, tipoVeiculoPub, compatTexto: anuncio?.compatibilidades,
    condicaoEnvio: dadosAnuncio.condicao, semCompatConfirmada: anuncio?.semCompatibilidadeConfirmada === true,
    semCompatAutorizadaPublicacao: semCompatAut.autorizado,
  });
  // Ficha não salva / conflito de versões / Conferência invalidada: bloqueia.
  if (bloqueioFicha) conferencia.unshift({ item: "Ficha salva na base", nivel: "erro", texto: bloqueioFicha });
  const bloqueios = conferencia.filter((c) => c.nivel === "erro");
  // A opção só aparece quando Compatibilidades (sem aplicação) é o ÚNICO
  // bloqueio. Ela libera exclusivamente esse item; nada mais é aprovado.
  const soCompatPendente = bloqueios.length > 0 && bloqueios.every((b) => b.semCompatOpcao);
  const mostrarOpcaoSemCompat = Boolean(ficha.anuncioId) && !resultado?.publicado && (soCompatPendente || semCompatAut.autorizado);
  async function alterarSemCompat(autorizado) {
    if (!ficha.anuncioId || semCompatAut.gravando) return;
    setSemCompatAut((s) => ({ ...s, gravando: true, erro: "" }));
    setArmado(false);
    const r = await registrarPublicacaoSemCompatibilidade({ anuncioId: ficha.anuncioId, autorizado });
    setSemCompatAut((s) => (r.ok ? { autorizado: r.registro.autorizado === true, gravando: false, erro: "" } : { ...s, gravando: false, erro: r.erro || "Não foi possível gravar na ficha." }));
  }
  // Ordem do fluxo: quantidade confirmada e produto no Bling ANTES de validar no ML.
  const blingPronto = Boolean(estoque?.encontrado && !estoque?.ambiguo);
  const modelosForaDescricao = conferencia.find((c) => c.item === "Modelos na descrição");
  const motivoSemValidar = modelosForaDescricao
    ? modelosForaDescricao.texto
    : !quantidadeConfirmada
    ? "Confirme a quantidade antes de validar no Mercado Livre."
    : !blingPronto
      ? estoque?.encontrado === false
        ? "Crie o produto no Bling (botão acima) antes de validar no Mercado Livre."
        : "O Bling precisa ser consultado (e o SKU encontrado) antes de validar no Mercado Livre."
      : "";
  // Marca, código e GTIN já têm campo próprio acima.
  const cobertosPelosCampos = {
    BRAND: campos.marca.trim(),
    PART_NUMBER: campos.codigo.trim(),
    GTIN: campos.gtin.trim(),
  };
  const faltando = (preparo?.obrigatorios || []).filter(
    (a) => !a.preenchido && !cobertosPelosCampos[a.id] && a.id !== "VEHICLE_TYPE"
  );
  const faltandoSemValor = faltando.filter((a) => !(extras[a.id]?.value_id || extras[a.id]?.value_name));

  return (
    <section data-paiia-revisao-ml style={painel}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h3 style={{ color: "#fde047", margin: 0 }}>🚀 Publicação no Mercado Livre</h3>
        <button type="button" data-paiia-navegacao onClick={onFechar} style={botaoCinza}>← Voltar à Conferência</button>
      </div>
      {bloqueioFicha && (
        <p data-paiia-bloqueio-ficha style={{ ...erro, fontSize: 14, fontWeight: "bold" }}>⛔ Publicação bloqueada: {bloqueioFicha}</p>
      )}

      {/* Anúncio NOVO já publicado: etapa "trazer este MLB para o Bling" (também após F5). */}
      {integracao?.registro && (
        <PainelIntegracaoBling
          registro={integracao.registro}
          verificando={verificandoBling === integracao.anuncioId}
          onVerificar={() => verificarIntegracao(integracao, true)}
        />
      )}

      <p style={{ color: "#94a3b8", fontSize: 13, margin: "8px 0 16px" }}>
        A Conferência PAIIA já foi aprovada: os dados abaixo são os aprovados. Escolha a conta, valide e só então confirme. Nada é publicado automaticamente.
      </p>

      {/* 1. Conexão */}
      <div style={bloco} id="pub-etapa-conta">
        <strong style={subtitulo}>1. PUBLICAR ESTE ANÚNCIO EM:</strong>
        <div data-paiia-conta-ml-publicacao role="radiogroup" style={{ display: "grid", gap: 6, margin: "8px 0" }}>
          {opcoesConta.map((o) => (
            <label
              key={o.nome + o.id}
              data-paiia-opcao-conta={o.nome}
              style={{ color: o.conectada ? "#e2e8f0" : "#64748b", fontSize: 14, cursor: o.conectada ? "pointer" : "not-allowed" }}
            >
              <input
                type="radio"
                name="paiia-conta-destino"
                value={o.id}
                disabled={!o.conectada || gravandoConta || ficha.carregando || publicacaoExiste(ficha.publicacao)}
                checked={Boolean(o.id) && contaEscolhida === o.id}
                onChange={() => setContaEscolhida(o.id, o.nome)}
                style={{ marginRight: 8 }}
              />
              <b>{o.nome}</b>
              {o.conectada ? ` — ${o.nickname} (ID ${o.id})` : " — não conectada"}
            </label>
          ))}
        </div>
        <div data-paiia-ficha-anuncio style={{ ...info, color: ficha.gravada ? "#86efac" : ficha.disponivel ? "#94a3b8" : "#fca5a5" }}>
          {ficha.carregando
            ? "⏳ Abrindo a ficha do anúncio na base PAIIA..."
            : gravandoConta
              ? "⏳ Gravando a conta na ficha do anúncio..."
              : !ficha.disponivel
                ? `❌ ${ficha.erro} A escolha fica só neste navegador e a publicação fica bloqueada.`
                : ficha.gravada
                  ? `✅ Conta gravada na ficha do anúncio (base PAIIA · ${String(ficha.anuncioId).slice(0, 8)}). Vale em qualquer computador; outros anúncios não são afetados.`
                  : ficha.erro
                    ? `❌ ${ficha.erro}`
                    : "Escolha a conta: ela é gravada na hora, só neste anúncio."}
        </div>
        {!ficha.carregando && ficha.disponivel && (ficha.outros || []).length > 0 && (
          <div data-paiia-outras-fichas style={{ marginTop: 8 }}>
            <p style={aviso}>Este código já tem outras fichas na base PAIIA:</p>
            {(ficha.outros || []).map((a) => {
              const pub = a.publicacao;
              const loja = a.conta_destino_ml_user_id ? nomeDaLoja(a.conta_destino_ml_user_id, a.conta_destino_nome) : a.conta_destino_nome || "sem conta";
              const publicado = publicacaoExiste(pub);
              return (
                <div key={a.id} style={{ color: "#e2e8f0", fontSize: 13, margin: "4px 0" }}>
                  • {loja} — {publicado ? `publicado (${pub.mlb_id})${pendenciaPublicacao(pub) ? ` — ⚠ COM PENDÊNCIA: ${pendenciaPublicacao(pub).replace(/^PENDÊNCIA — /, "").slice(0, 160)}` : ""}` : "em andamento"} · {new Date(a.updated_at).toLocaleString("pt-BR")}
                  {!publicado && (
                    <button type="button" data-paiia-continuar-ficha onClick={() => continuarFicha(a)} style={{ ...botaoCinza, marginLeft: 8, padding: "4px 10px" }}>
                      Continuar esta ficha
                    </button>
                  )}
                  {publicado && registroDaFicha({ integracao_bling: a.integracao_bling }) && (
                    <span data-paiia-integracao-bling-outro={a.integracao_bling.estado} style={{ marginLeft: 8, color: a.integracao_bling.estado === ESTADO_BLING.INTEGRADO ? "#86efac" : "#fde68a" }}>
                      · {a.integracao_bling.estado === ESTADO_BLING.INTEGRADO ? "integrado ao Bling" : "falta trazer para o Bling"}
                      {integracao?.anuncioId !== a.id && (
                        <button type="button" data-paiia-ver-integracao onClick={() => setIntegracao({ anuncioId: a.id, registro: registroDaFicha({ integracao_bling: a.integracao_bling }) })} style={{ ...botaoCinza, marginLeft: 8, padding: "4px 10px" }}>
                          Ver
                        </button>
                      )}
                    </span>
                  )}
                </div>
              );
            })}
            <p style={info}>Se não for nenhuma delas, escolha a conta acima: este anúncio vira uma ficha nova.</p>
          </div>
        )}
        {!contaEscolhida && <p style={erro}>Selecione explicitamente a conta Mercado Livre. Nada é validado ou publicado sem conta escolhida.</p>}
        {ocupado === "conexao" && <p style={info}>⏳ Conferindo a conexão...</p>}
        {conexao && !conexao.ok && <p style={erro}>❌ {conexao.erro}</p>}
        {conexao?.ok && !conexao.conectado && <p style={erro}>❌ Nenhuma conta conectada. Use Contas Marketplace.</p>}
        {conexao?.ok && conexao.conectado && (
          <div data-paiia-ml-conexao style={{ color: "#e2e8f0", fontSize: 14, lineHeight: 1.7 }}>
            <div>Conta: <b>{conexao.nickname || "—"}</b> (ID {conexao.ml_user_id})</div>
            <div>
              Token pertence ao seu usuário:{" "}
              {conexao.pertence_ao_usuario ? <b style={{ color: "#22c55e" }}>SIM</b> : <b style={{ color: "#f87171" }}>NÃO</b>}
            </div>
            <div>
              Válido até: {conexao.token_valido_ate ? new Date(conexao.token_valido_ate).toLocaleString("pt-BR") : "—"}
              {conexao.renovado ? " (renovado agora)" : ""}
            </div>
            {conexao.pode_vender === false && (
              <div style={erro}>
                ⚠ O Mercado Livre informa que esta conta ainda não pode vender
                {conexao.bloqueios_venda?.length ? ` (${conexao.bloqueios_venda.join(", ")})` : ""}.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bling — produto e estoque (leitura; criação só com clique) */}
      <div data-paiia-bling-publicacao style={bloco} id="pub-etapa-bling">
        <button type="button" data-paiia-navegacao data-paiia-voltar-etapa="pub-etapa-conta" onClick={() => rolarPara("pub-etapa-conta")} style={botaoVoltarEtapa}>← Voltar à escolha da conta</button>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <strong style={subtitulo}>Bling — produto e estoque</strong>
          <button type="button" data-paiia-reler-bling onClick={relerBling} disabled={estoque === null} style={{ ...botaoCinza, padding: "4px 10px" }}>
            🔄 Reler Bling
          </button>
        </div>
        {estoque === null ? (
          <p style={info}>⏳ Consultando o Bling pelo SKU {anuncio?.codigo || "—"}...</p>
        ) : estoque?.ambiguo ? (
          <div style={erro}>
            ❌ Mais de um produto no Bling com o SKU {anuncio?.codigo}: {(estoque.candidatos || []).map((c) => `${c.codigo} (ID ${c.id})`).join(", ")}. Resolva no Bling: o PAIIA não escolhe sozinho e não cria outro.
          </div>
        ) : estoque?.encontrado ? (
          <div data-paiia-bling-estado="encontrado" style={{ color: "#e2e8f0", fontSize: 14, lineHeight: 1.7 }}>
            <div>✅ Produto já existe no Bling: <b>{estoque.produto?.nome}</b> (ID {estoque.produto?.id}, SKU {estoque.produto?.codigo}).</div>
            <div data-paiia-bling-estoque>Estoque no Bling: físico <b>{estoque.saldoFisicoTotal ?? "—"}</b> · disponível <b>{estoque.saldoVirtualTotal ?? "—"}</b>{estoque.ok === false && estoque.mensagem ? ` — ${estoque.mensagem}` : ""}</div>
            <div style={info}>Na publicação o anúncio é VINCULADO a este produto (nada é duplicado no Bling). Um produto Bling pode atender anúncios em várias contas Mercado Livre, cada um com o seu MLB.</div>
            {criacaoBling && !criacaoBling.ocupado && (
              <div data-paiia-bling-criacao={criacaoBling.ok ? "ok" : "conferir"} style={criacaoBling.ok ? { ...info, color: "#86efac" } : erro}>
                {criacaoBling.jaExistia
                  ? `ℹ O SKU já existia no Bling (ID ${criacaoBling.produto?.id || estoque.produto?.id}): nada foi criado; o anúncio foi vinculado a ele.`
                  : `${criacaoBling.ok ? "✅" : "⚠"} Produto criado no Bling (ID ${criacaoBling.produto?.id}, SKU ${criacaoBling.produto?.codigo}) e vinculado à ficha.`}
                {criacaoBling.estoqueInicial && !criacaoBling.estoqueInicial.ok ? ` Estoque inicial NÃO lançado: ${criacaoBling.estoqueInicial.erro || "erro do Bling"}.` : ""}
                {(criacaoBling.problemas || []).map((p) => <div key={p}>• {p}</div>)}
              </div>
            )}
          </div>
        ) : estoque?.ok ? (
          <div data-paiia-bling-estado="nao-encontrado" style={{ color: "#e2e8f0", fontSize: 14, lineHeight: 1.7 }}>
            <div>⚠ SKU <b>{anuncio?.codigo}</b> não encontrado no Bling.</div>
            {!painelBling ? (
              <div style={{ marginTop: 8 }}>
                <button type="button" data-paiia-abrir-criar-bling onClick={() => { setPainelBling(true); setCriacaoBling(null); }} disabled={!contaOk || criacaoBling?.ocupado} style={botaoAzul}>
                  ➕ Criar produto no Bling
                </button>
                {!contaOk && <p style={info}>Escolha a conta do Mercado Livre primeiro.</p>}
                <p style={info}>Nada é criado sem o seu clique. Antes de criar, o PAIIA confere o SKU de novo no Bling (se já existir, não cria outro).</p>
              </div>
            ) : (
              <div data-paiia-conferir-criar-bling style={{ marginTop: 8, border: "1px solid #334155", borderRadius: 10, padding: 12 }}>
                <strong>Conferir antes de criar no Bling</strong>
                <table style={{ width: "100%", fontSize: 13, marginTop: 6, borderCollapse: "collapse" }}>
                  <tbody>
                    {[
                      ["SKU/código", preparoBling.codigo],
                      ["Descrição/nome", preparoBling.nome],
                      ["Marca", preparoBling.marca],
                      ["Preço", precoTexto(preparoBling.preco)],
                      ["Estoque inicial", preparoBling.estoque_inicial],
                      ["Peso", preparoBling.pesoBruto_g ? `${preparoBling.pesoBruto_g} g` : ""],
                      ["Comprimento", preparoBling.dimensoes_cm?.profundidade ? `${preparoBling.dimensoes_cm.profundidade} cm` : ""],
                      ["Largura", preparoBling.dimensoes_cm?.largura ? `${preparoBling.dimensoes_cm.largura} cm` : ""],
                      ["Altura", preparoBling.dimensoes_cm?.altura ? `${preparoBling.dimensoes_cm.altura} cm` : ""],
                      ["GTIN/EAN", preparoBling.gtin || "(sem GTIN — não é inventado)"],
                    ].map(([k, v]) => (
                      <tr key={k} data-paiia-bling-campo={k}>
                        <td style={{ padding: "3px 8px", color: "#94a3b8", width: 160 }}>{k}</td>
                        <td style={{ padding: "3px 8px", color: v ? "#e2e8f0" : "#fca5a5" }}>{v || "FALTANDO"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {cadastroBling.faltando.length > 0 && (
                  <p data-paiia-bling-faltando style={erro}>❌ Falta (confirme na ficha antes de criar): {cadastroBling.faltando.join(", ")}.</p>
                )}
                <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  <button type="button" data-paiia-confirmar-criar-bling onClick={criarProdutoBling} disabled={cadastroBling.faltando.length > 0 || criacaoBling?.ocupado} style={botaoAzul}>
                    {criacaoBling?.ocupado ? `⏳ ${criacaoBling.etapa || "Criando..."}` : "✔ Confirmar e criar no Bling"}
                  </button>
                  <button type="button" onClick={() => setPainelBling(false)} disabled={criacaoBling?.ocupado} style={botaoCinza}>Cancelar</button>
                </div>
                <p style={info}>Somente este produto. O estoque inicial é lançado só nele; nenhum outro produto do Bling é alterado.</p>
              </div>
            )}
            {criacaoBling && !criacaoBling.ocupado && !criacaoBling.ok && (
              <p data-paiia-bling-criacao="erro" style={erro}>❌ {criacaoBling.erro}</p>
            )}
          </div>
        ) : (
          <p data-paiia-bling-estado="erro" style={aviso}>⚠ Não foi possível consultar o Bling agora{estoque?.mensagem ? `: ${estoque.mensagem}` : estoque?.erro ? `: ${estoque.erro}` : "."}</p>
        )}
      </div>

      {contaOk && (
        <>
          {/* 2. Dados */}
          <div style={bloco} id="pub-etapa-dados">
            <button type="button" data-paiia-navegacao data-paiia-voltar-etapa="pub-etapa-bling" onClick={() => rolarPara("pub-etapa-bling")} style={botaoVoltarEtapa}>← Voltar ao Bling (produto e estoque)</button>
            <strong style={subtitulo}>2. Dados que serão enviados</strong>
            <div style={grade}>
              <Campo rotulo="Título (aprovado)">
                <div data-paiia-pub-titulo style={valorAprovado}>{campos.titulo || "—"}</div>
              </Campo>
              <Campo rotulo="Preço (aprovado)">
                <div style={valorAprovado}>{precoTexto(campos.preco) || "—"}</div>
              </Campo>
              <Campo rotulo="Quantidade (a mesma da ficha)">
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input data-paiia-pub-quantidade style={entrada} type="number" min={1} step={1} placeholder="Informe" value={campos.quantidade} onChange={(e) => alterar("quantidade", e.target.value)} />
                  {!quantidadeConfirmada && (
                    <button type="button" data-paiia-confirmar-quantidade onClick={confirmarQuantidade} style={{ ...botaoAzul, padding: "6px 10px", whiteSpace: "nowrap" }}>✔ Confirmar</button>
                  )}
                </div>
                <div data-paiia-quantidade-estado style={{ fontSize: 12, marginTop: 4, color: quantidadeConfirmada ? "#86efac" : "#fde68a" }}>
                  {quantidadeConfirmada
                    ? `✅ ${campos.quantidade} unidade(s) confirmada(s) — gravada na ficha; é esta que vai ao Mercado Livre${estoque?.encontrado ? "" : " e ao Bling"}.`
                    : avisoQuantidade || (qtdInicial.origem === "ficha_campo_estoque" && campos.quantidade === String(qtdInicial.valor)
                      ? `Valor da ficha (${qtdInicial.valor}). Confirme para usar.`
                      : "Informe e confirme a quantidade (o PAIIA não assume nenhum valor).")}
                </div>
              </Campo>
              <Campo rotulo="Tipo de anúncio (aprovado)">
                <div style={valorAprovado}>{campos.tipoAnuncio === "premium" ? "Premium" : "Clássico"}</div>
              </Campo>
              <Campo rotulo="Marca (aprovada)">
                <div data-paiia-pub-marca style={valorAprovado}>{campos.marca || "—"}</div>
              </Campo>
              <Campo rotulo="Código da peça (Part Number)">
                <div style={valorAprovado}>{campos.codigo || "—"}</div>
              </Campo>
              <Campo rotulo="GTIN/EAN">
                <div style={valorAprovado}>{campos.gtin || "—"}</div>
              </Campo>
              <Campo rotulo="Categoria Mercado Livre (aprovada)">
                <div data-paiia-pub-categoria style={valorAprovado}>
                  {anuncio?.categoria || "—"}{campos.categoria_id ? ` (${campos.categoria_id})` : ""}
                </div>
              </Campo>
              <Campo rotulo="Peso e medidas (confirmados)">
                <div data-paiia-pub-peso style={valorAprovado}>
                  {logistica?.medida
                    ? `${logistica.medida.peso_g} g · ${logistica.medida.comprimento_cm}×${logistica.medida.largura_cm}×${logistica.medida.altura_cm} cm${logistica.confirmado ? "" : " (não confirmados)"}`
                    : "—"}
                </div>
              </Campo>
            </div>

            <p style={info}>
              Condição: Novo · Fotos com endereço público: {preparo?.item?.pictures?.length ?? "—"} de {fotosUrls.length} ·
              Descrição: {String(anuncio?.descricao || "").length} caracteres
            </p>

            {/* Fotos que serão enviadas, na ordem: a primeira é a capa. */}
            <div data-paiia-revisao-fotos style={{ marginTop: 10 }}>
              <strong style={{ color: "#e2e8f0", fontSize: 13 }}>
                Fotos do anúncio ({fotosUrls.length}) — a 1ª é a capa
              </strong>
              {fotosUrls.length === 0 ? (
                <p style={erro}>❌ Nenhuma foto.</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(110px,1fr))", gap: 8, marginTop: 8 }}>
                  {fotosUrls.map((url, i) => (
                    <figure key={`${url}-${i}`} style={{ margin: 0, padding: 6, borderRadius: 8, border: i === 0 ? "2px solid #22c55e" : "1px solid #334155", background: "#020617" }}>
                      <div style={{ height: 96, borderRadius: 6, background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                        <img src={url} alt={`Foto ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                      </div>
                      <figcaption style={{ color: i === 0 ? "#86efac" : "#94a3b8", fontSize: 11, textAlign: "center", marginTop: 4 }}>
                        {i === 0 ? "⭐ Capa · 1" : `Foto ${i + 1}`}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              )}
              <p style={info}>Banner e vídeo não entram nas fotos do produto no Mercado Livre.</p>
            </div>
            {preparo && !preparo.ok && <p style={erro}>❌ {preparo.erro}</p>}
            {faltando.length > 0 && (
              <div data-paiia-ml-obrigatorios style={{ marginTop: 10 }}>
                <p style={aviso}>⚠ Atributos obrigatórios desta categoria: preencha antes de validar.</p>
                <div style={grade}>
                  {faltando.map((a) => (
                    <Campo key={a.id} rotulo={a.nome}>
                      {a.valores?.length ? (
                        <select
                          style={entrada}
                          value={extras[a.id]?.value_id || ""}
                          onChange={(e) => alterarExtra(a.id, e.target.value ? { value_id: e.target.value } : null)}
                        >
                          <option value="">Selecione...</option>
                          {a.valores.map((v) => (
                            <option key={v.id} value={v.id}>{v.nome}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          style={entrada}
                          value={extras[a.id]?.value_name || ""}
                          onChange={(e) => alterarExtra(a.id, e.target.value ? { value_name: e.target.value } : null)}
                        />
                      )}
                    </Campo>
                  ))}
                </div>
              </div>
            )}
            {(preparo?.avisos || []).map((a) => (
              <p key={a} style={aviso}>⚠ {a}</p>
            ))}
            {attrTipoVeiculo && (
              <p style={tipoVeiculoPub.estado === "ok" ? info : erro} data-paiia-tipo-veiculo-publicacao={tipoVeiculoPub.estado}>
                Tipo de veículo: {tipoVeiculoPub.estado === "ok" ? <b>{tipoVeiculoPub.nome}</b> : null} {tipoVeiculoPub.estado === "ok" ? "— confirmado na ficha. Para trocar, use \"← Voltar à Conferência\" (⑤ Características principais)." : tipoVeiculoPub.texto}
              </p>
            )}
            {aplicacoes.length > 0 && (
              <div data-paiia-compat-ml style={{ marginTop: 10, color: "#e2e8f0", fontSize: 13 }}>
                <b>Compatibilidades (só as aplicações aprovadas):</b>{" "}
                {aplicacoes.map((a) => [a.modelo, a.motor, a.anoInicio && a.anoFim ? (a.anoInicio === a.anoFim ? a.anoInicio : `${a.anoInicio}–${a.anoFim}`) : a.anoInicio ? `a partir de ${a.anoInicio}` : a.anoFim ? `até ${a.anoFim}` : ""].filter(Boolean).join(" ")).join(" · ")}
                {compatML?.carregando && <p style={info}>⏳ Procurando os veículos no catálogo do Mercado Livre...</p>}
                {compatML?.erro && (
                  <p style={erro}>
                    ❌ {compatML.erro}{" "}
                    <button type="button" onClick={() => resolverCompat(contaEscolhida)} style={{ ...botaoCinza, padding: "4px 10px" }}>🔄 Reconsultar catálogo</button>
                  </p>
                )}
                {compatML?.veiculos && (
                  <>
                    <div style={{ marginTop: 4 }}>Serão vinculados {compatML.veiculos.length} veículo(s):</div>
                    {compatML.veiculos.map((v) => <div key={v.id} data-paiia-compat-veiculo style={{ color: "#86efac" }}>✓ {v.nome}</div>)}
                    {compatML.descartados.length > 0 && <div style={{ marginTop: 4, color: "#94a3b8" }}>Descartados (não confirmam os dados aprovados):</div>}
                    {compatML.descartados.map((d) => <div key={d.id} data-paiia-compat-descartado style={{ color: "#94a3b8" }}>✗ {d.nome} — {d.motivo}</div>)}
                    {compatML.semCatalogo.map((x) => <div key={x.aplicacao} style={{ color: "#facc15" }}>⚠ {x.aplicacao}: {x.motivo}</div>)}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Verificação técnica (não é uma segunda conferência) */}
          <div data-paiia-ml-conferencia style={bloco}>
            <strong style={subtitulo}>Verificação técnica da publicação</strong>
            <div data-paiia-padroes-ml style={{ margin: "8px 0", padding: "8px 10px", borderRadius: 8, background: "#0b1220", border: "1px solid #334155", color: "#e2e8f0", fontSize: 13, display: "grid", gap: 2 }}>
              <span>{(preparo?.padroes_ml || padroesEsperadosConferencia()).garantia.texto}</span>
              <span>{(preparo?.padroes_ml || padroesEsperadosConferencia()).retirada.texto}</span>
              <span>{(preparo?.padroes_ml || padroesEsperadosConferencia()).regulatoria.texto}</span>
            </div>
            <table style={{ width: "100%", marginTop: 8, borderCollapse: "collapse", fontSize: 13 }}>
              <tbody>
                {conferencia.map((c) => (
                  <tr key={c.item} data-item={c.item} data-nivel={c.nivel} style={{ borderTop: "1px solid #1f2937" }}>
                    <td style={{ padding: "6px 8px", width: 30 }}>{c.nivel === "ok" ? "✅" : c.nivel === "erro" ? "❌" : "⚠️"}</td>
                    <td style={{ padding: "6px 8px", color: "#e2e8f0", fontWeight: "bold", width: 130 }}>{c.item}</td>
                    <td style={{ padding: "6px 8px", color: c.nivel === "erro" ? "#fca5a5" : c.nivel === "aviso" ? "#fde68a" : "#bbf7d0" }}>{c.texto}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 3. Validação */}
          <div style={bloco} id="pub-etapa-validar">
            <button type="button" data-paiia-navegacao data-paiia-voltar-etapa="pub-etapa-dados" onClick={() => rolarPara("pub-etapa-dados")} style={botaoVoltarEtapa}>← Voltar aos dados que serão enviados</button>
            <strong style={subtitulo}>3. Validar no Mercado Livre (não publica)</strong>
            <button
              type="button"
              data-paiia-validar-ml
              onClick={validarNoML}
              disabled={!!ocupado || !campos.categoria_id || faltandoSemValor.length > 0 || Boolean(motivoSemValidar)}
              style={botaoAzul}
            >
              {ocupado === "validar" ? "⏳ Validando..." : "🔎 Validar dados no Mercado Livre"}
            </button>
            {motivoSemValidar && <p data-paiia-motivo-sem-validar style={{ ...info, color: "#fde68a" }}>⚠ {motivoSemValidar}</p>}
            {fichaPersistida && !fichaPersistida.ok && (
              <div data-paiia-ficha-divergente={(fichaPersistida.divergencias || []).join("|")} style={{ ...erro, marginTop: 8 }}>
                ❌ {fichaPersistida.motivo}
                {fichaPersistida.divergencias?.length > 0 && (
                  <div style={{ marginTop: 6 }}>
                    <button type="button" data-paiia-recarregar-ficha onClick={recarregarFicha} style={botaoCinza}>
                      🔄 Recarregar a ficha gravada
                    </button>{" "}
                    <span style={{ color: "#cbd5e1" }}>Depois confira os dados (ou use "← Voltar à Conferência").</span>
                  </div>
                )}
              </div>
            )}
            {validacao && validacao.ok && validacao.valido && (
              <p style={{ ...info, color: "#86efac" }}>✅ O Mercado Livre aceitou os dados. Nenhum anúncio foi criado.</p>
            )}
            {validacao && (!validacao.ok || !validacao.valido) && (
              <div style={erro}>
                ❌ {validacao.erro || validacao.mensagem || "O Mercado Livre apontou problemas:"}
                <ul style={{ margin: "6px 0 0 18px" }}>
                  {(validacao.causas || []).map((c, i) => (
                    <li key={i} data-paiia-causa-ml={c.codigo || ""}>{ehFaltaMedidasML(c) ? TEXTO_MEDIDAS_OBRIGATORIAS : c.mensagem || c.codigo}</li>
                  ))}
                </ul>
                {!(validacao.causas || []).length && validacao.detalhe && (
                  <pre style={{ whiteSpace: "pre-wrap", fontSize: 11, color: "#cbd5e1", margin: "6px 0 0" }}>{validacao.detalhe}</pre>
                )}
              </div>
            )}
          </div>

          {/* 4. Confirmação */}
          <div style={bloco} id="pub-etapa-publicar">
            <button type="button" data-paiia-navegacao data-paiia-voltar-etapa="pub-etapa-validar" onClick={() => rolarPara("pub-etapa-validar")} style={botaoVoltarEtapa}>← Voltar à validação no Mercado Livre</button>
            <strong style={subtitulo}>4. Confirmar publicação real</strong>
            {duplicidadeML?.possiveis?.length > 0 && !duplicidadeML?.duplicados?.length && (
              <label data-paiia-possivel-duplicidade style={{ display: "flex", gap: 8, alignItems: "flex-start", color: "#fde047", fontSize: 14, margin: "8px 0" }}>
                <input
                  type="checkbox"
                  checked={possivelConfirmado}
                  onChange={(e) => {
                    setPossivelConfirmadoIds(e.target.checked ? idsPossiveis(duplicidadeML) : "");
                    setArmado(false);
                  }}
                />
                Conferi no Mercado Livre: {duplicidadeML.possiveis.map((d) => d.id).join(", ")} NÃO é o mesmo produto deste anúncio.
              </label>
            )}
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start", color: "#e2e8f0", fontSize: 14, margin: "8px 0" }}>
              <input
                type="checkbox"
                data-paiia-autorizo-ml
                checked={autorizado}
                onChange={(e) => {
                  setAutorizado(e.target.checked);
                  setArmado(false);
                }}
              />
              Revisei os dados e autorizo publicar este anúncio na conta <b>{conexao.nickname}</b> (ID {conexao.ml_user_id}) do Mercado Livre.
            </label>
            <button
              type="button"
              data-paiia-publicar-ml
              onClick={publicar}
              disabled={!autorizado || !validacao?.valido || !!ocupado || resultado?.publicado || bloqueios.length > 0}
              style={{ ...botaoVerde, opacity: !autorizado || !validacao?.valido ? 0.5 : 1 }}
            >
              {ocupado === "publicar"
                ? "⏳ Publicando..."
                : armado
                  ? "⚠ Clique de novo para CONFIRMAR a publicação"
                  : "🚀 Publicar no Mercado Livre"}
            </button>
            {mostrarOpcaoSemCompat && (
              <div data-paiia-opcao-sem-compat style={{ margin: "10px 0", padding: "10px", borderRadius: 8, border: "1px solid #f59e0b", background: "#451a03", color: "#fde68a", fontSize: 13 }}>
                <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer", fontWeight: "bold" }}>
                  <input
                    type="checkbox"
                    data-paiia-autorizar-sem-compat
                    checked={semCompatAut.autorizado}
                    disabled={semCompatAut.gravando}
                    onChange={(e) => alterarSemCompat(e.target.checked)}
                  />
                  Publicar sem compatibilidade — vou cadastrar manualmente depois
                </label>
                <div style={{ marginTop: 4 }}>
                  O anúncio sai SEM veículos vinculados no Mercado Livre. As compatibilidades da ficha não são alteradas e nenhum outro item é liberado por esta opção.
                  {semCompatAut.gravando ? " ⏳ Gravando na ficha..." : semCompatAut.autorizado ? " ✓ Autorização gravada na ficha." : ""}
                </div>
                {semCompatAut.erro && <div style={{ color: "#fca5a5", marginTop: 4 }}>❌ {semCompatAut.erro}</div>}
                {onVoltarCompatibilidades && (
                  <button type="button" data-paiia-navegacao data-paiia-voltar-compat onClick={() => onVoltarCompatibilidades()} style={{ ...botaoVoltarEtapa, marginTop: 8 }}>
                    ← Voltar às Compatibilidades (⑨ da Conferência) para cadastrar as aplicações
                  </button>
                )}
              </div>
            )}
            {bloqueios.length > 0 && <p style={erro}>Corrija antes de publicar: {bloqueios.map((b) => b.item).join(", ")}.</p>}
            {!mostrarOpcaoSemCompat && bloqueios.some((b) => b.item === "Compatibilidades") && onVoltarCompatibilidades && (
              <button type="button" data-paiia-navegacao data-paiia-voltar-compat onClick={() => onVoltarCompatibilidades()} style={botaoVoltarEtapa}>
                ← Voltar às Compatibilidades (⑨ da Conferência)
              </button>
            )}
            {!validacao?.valido && <p style={info}>Valide os dados antes de publicar.</p>}
            {resultado?.ok && resultado.publicado && (() => {
              const v = resultado.verificacao;
              const pend = v?.pendencias || ["Verificação pós-publicação não executada."];
              const ok = pend.length === 0;
              return (
                <div data-paiia-resultado-publicacao={ok ? "publicado" : "publicado_com_pendencia"} style={{ marginTop: 8 }}>
                  <p style={{ ...info, color: ok ? "#86efac" : "#fde68a", fontWeight: 700 }}>
                    {ok ? "✅ PUBLICADO" : "⚠ PUBLICADO COM PENDÊNCIA"}: {resultado.item_id}{" "}
                    {resultado.link && <a href={resultado.link} target="_blank" rel="noreferrer" style={{ color: "#67e8f9" }}>abrir anúncio</a>}
                    {resultado.descricao_enviada === false && " (a descrição não foi enviada; revise no Mercado Livre)"}
                  </p>
                  {!ok && (
                    <div style={{ ...aviso }}>
                      {pend.map((t) => <div key={t} data-paiia-pendencia>• {t}</div>)}
                      <div style={{ marginTop: 4 }}>Processo NÃO concluído. Não publique de novo: o MLB já existe — a correção é feita no mesmo anúncio.</div>
                    </div>
                  )}
                  {v?.itens?.length > 0 && (
                    <table data-paiia-verificacao style={{ marginTop: 6, fontSize: 12, color: "#e2e8f0", borderCollapse: "collapse" }}>
                      <tbody>
                        {v.itens.map((i) => (
                          <tr key={i.item} data-ok={i.ok ? "1" : "0"}>
                            <td style={{ padding: "2px 8px" }}>{i.ok ? "✅" : "❌"} {i.item}</td>
                            <td style={{ padding: "2px 8px", color: "#94a3b8" }}>enviado: {String(i.esperado)}</td>
                            <td style={{ padding: "2px 8px", color: "#94a3b8" }}>no ML: {String(i.recebido)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {v?.compatibilidades && (
                    <p style={info} data-paiia-compat-resultado>
                      Compatibilidades: {v.compatibilidades.enviados} enviada(s), {v.compatibilidades.aceitos} aceita(s), {v.compatibilidades.rejeitados.length} rejeitada(s)
                      {v.compatibilidades.rejeitados.length > 0 && ` — ${v.compatibilidades.rejeitados.map((x) => `${x.nome}: ${x.motivo}`).join("; ")}`}.
                    </p>
                  )}
                </div>
              );
            })()}
            {resultado && !resultado.ok && <p style={erro}>❌ {resultado.erro}</p>}
            {resultado && ficha.resultadoGravado && <p style={{ ...info, color: "#86efac" }}>💾 Resultado salvo na ficha do anúncio (MLB, data/hora, Bling e estoque).</p>}
            {resultado?.ok && resultado.publicado && ficha.anuncioId && (
              <button type="button" data-paiia-navegacao data-paiia-abrir-tela-final onClick={() => onAbrirTelaFinal?.(ficha.anuncioId)} style={{ ...botaoVerde, marginTop: 8 }}>
                ➡ Continuar: vincular no Bling e concluir (tela final da ficha)
              </button>
            )}
            {resultado && ficha.erroResultado && <p style={erro}>⚠ O resultado não foi salvo na ficha: {ficha.erroResultado}</p>}
          </div>
        </>
      )}
    </section>
  );
}

// Seta "← Voltar" dentro da Publicação: só ROLA até a etapa anterior
// (navegação pura: não grava, não valida, não publica, não chama o Bling).
function rolarPara(id) {
  try {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch {
    // sem rolagem
  }
}
const botaoVoltarEtapa = { display: "block", marginBottom: 8, padding: "4px 10px", borderRadius: 8, border: "1px solid #475569", background: "transparent", color: "#cbd5e1", cursor: "pointer", fontSize: 12 };

function Campo({ rotulo, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, color: "#94a3b8", fontSize: 12 }}>
      {rotulo}
      {children}
    </label>
  );
}

const painel = { marginTop: 20, padding: 22, borderRadius: 18, border: "1px solid #facc15", background: "#0f172a" };
const bloco = { marginTop: 14, padding: 14, borderRadius: 12, border: "1px solid #334155", background: "#111827" };
const subtitulo = { color: "#e2e8f0", fontSize: 15 };
const grade = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginTop: 10 };
const entrada = { padding: "9px 10px", borderRadius: 8, border: "1px solid #334155", background: "#0b1220", color: "#e2e8f0", fontSize: 14 };
const valorAprovado = { padding: "9px 10px", borderRadius: 8, border: "1px solid #14532d", background: "#052e16", color: "#e2e8f0", fontSize: 14, minHeight: 20 };
const info = { color: "#94a3b8", fontSize: 13, margin: "8px 0 0" };
const aviso = { color: "#facc15", fontSize: 13, margin: "6px 0 0" };
const erro = { color: "#fca5a5", fontSize: 13, margin: "8px 0 0" };
const botaoBase = { marginTop: 8, padding: "10px 16px", borderRadius: 10, border: "none", fontWeight: "bold", cursor: "pointer" };
const botaoAzul = { ...botaoBase, background: "#2563eb", color: "#fff" };
const botaoVerde = { ...botaoBase, background: "#16a34a", color: "#fff" };
const botaoCinza = { ...botaoBase, marginTop: 0, background: "#334155", color: "#e2e8f0" };
