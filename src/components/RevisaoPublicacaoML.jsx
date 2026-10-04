import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import { useContasML, contasMLConectadas } from "../services/contaMLAtiva";
import { conferirLogistica } from "../services/logistica/logisticaMercadoLivre";
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
  normalizarCodigo,
  pendenciaPublicacao,
  publicacaoExiste,
} from "../services/anuncioPublicacaoService";
import {
  lerAplicacoesAprovadas,
  resolverCompatibilidades,
  valorTipoVeiculo,
  marcaInvalida,
  descricaoAfirmaOriginal,
  conferirPublicacao,
} from "../services/compatibilidadeML";

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

// Lojas (contas Mercado Livre) da empresa. O vínculo nome ↔ ID vem do
// usuário; conta sem ID ainda não está conectada ao PAIIA.
const LOJAS_ML = [
  { nome: "REVELAÇÃO", ml_user_id: "2412238242" },
  { nome: "LOJA ONLINE", ml_user_id: "1729335019" },
  { nome: "CIEBR", ml_user_id: "" },
];

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
function conferir({ campos, preparo, estoque, fotosUrls, logistica, ficha, duplicado, duplicidadeML, duplicidadeBase, skuEnvio, descricao, compatML, aplicacoes, tipoVeiculoEnvio, tipoVeiculoExigido, compatTexto }) {
  const itens = [];

  // Ficha do anúncio na base PAIIA: a conta de destino precisa estar gravada.
  if (!ficha?.disponivel) itens.push({ item: "Ficha do anúncio", nivel: "erro", texto: ficha?.erro || "Base PAIIA indisponível: a conta de destino não pôde ser gravada." });
  else if (!ficha?.gravada) itens.push({ item: "Ficha do anúncio", nivel: "erro", texto: "Escolha a conta: ela é gravada na ficha deste anúncio antes de publicar." });
  else itens.push({ item: "Ficha do anúncio", nivel: "ok", texto: `Conta gravada na base PAIIA (anúncio ${String(ficha.anuncioId).slice(0, 8)}).` });
  if (duplicado) itens.push({ item: "Duplicidade", nivel: "erro", texto: `Este código já está publicado nesta conta (${duplicado}). Publicar de novo criaria anúncio duplicado.` });
  // SKU oficial (SKU específico ou o próprio código da peça).
  if (!skuEnvio) itens.push({ item: "SKU", nivel: "erro", texto: "Sem SKU: o anúncio precisa sair com SKU (o código da peça)." });
  else itens.push({ item: "SKU", nivel: "ok", texto: `SKU enviado ao Mercado Livre: ${skuEnvio}.` });
  // Proteção A: base PAIIA (código/SKU normalizado + conta + MLB + status).
  if (duplicidadeBase?.carregando) itens.push({ item: "Duplicidade na base PAIIA", nivel: "aviso", texto: "Conferindo na base PAIIA..." });
  else if (duplicidadeBase?.erro) itens.push({ item: "Duplicidade na base PAIIA", nivel: "erro", texto: `Não foi possível conferir a base PAIIA (${duplicidadeBase.erro}). Sem essa conferência a publicação fica bloqueada.` });
  else if (duplicidadeBase?.registros?.length) itens.push({ item: "Duplicidade na base PAIIA", nivel: "erro", texto: `A base PAIIA já registra este código publicado nesta conta: ${duplicidadeBase.registros.map((p) => `${p.mlb_id || "sem MLB"} (${p.status_publicacao})`).join(", ")}. Publicação bloqueada.` });
  else if (duplicidadeBase?.verificado) itens.push({ item: "Duplicidade na base PAIIA", nivel: "ok", texto: "A base PAIIA não registra este código publicado nesta conta." });
  // Mesmo SKU + MESMA conta + anúncio já existente no Mercado Livre = bloqueia.
  // (O mesmo SKU em OUTRA conta é permitido: cada conta tem o seu MLB.)
  if (duplicidadeML?.carregando) itens.push({ item: "Duplicidade na conta", nivel: "aviso", texto: "Conferindo no Mercado Livre se este SKU já está anunciado nesta conta..." });
  else if (duplicidadeML?.erro) itens.push({ item: "Duplicidade na conta", nivel: "erro", texto: `Não foi possível conferir anúncios deste SKU nesta conta (${duplicidadeML.erro}). Sem essa conferência a publicação fica bloqueada.` });
  else if (duplicidadeML?.mlbs?.length) itens.push({ item: "Duplicidade na conta", nivel: "erro", texto: `Este SKU já tem anúncio nesta conta: ${duplicidadeML.mlbs.join(", ")}. Publicar de novo criaria duplicidade (em outra conta é permitido).` });
  else if (duplicidadeML?.ativosBase?.length) itens.push({ item: "Duplicidade na conta", nivel: "erro", texto: `O anúncio registrado na base ainda existe no Mercado Livre nesta conta: ${duplicidadeML.ativosBase.join(", ")}.` });
  else if (duplicidadeML?.verificado) itens.push({ item: "Duplicidade na conta", nivel: "ok", texto: "Nenhum anúncio deste SKU nesta conta. (O mesmo SKU em outras contas não bloqueia.)" });
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

  // Tipo de veículo: vem da Conferência; categoria que exige e sem valor = erro.
  if (tipoVeiculoExigido) {
    if (tipoVeiculoEnvio) itens.push({ item: "Tipo de veículo", nivel: "ok", texto: `${tipoVeiculoEnvio} (aprovado na Conferência; pode revisar abaixo).` });
    else itens.push({ item: "Tipo de veículo", nivel: "erro", texto: "A categoria exige Tipo de veículo e ele não está confirmado. Escolha abaixo (o PAIIA não adivinha)." });
  }

  // Compatibilidades aprovadas → veículos do catálogo do Mercado Livre.
  if (!aplicacoes.length && String(compatTexto || "").trim()) {
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

  // Estoque
  const qtd = Math.floor(Number(campos.quantidade));
  if (!(qtd >= 1)) itens.push({ item: "Estoque", nivel: "erro", texto: "Quantidade precisa ser 1 ou mais." });
  else if (estoque?.ok && estoque.encontrado && estoque.saldoVirtualTotal != null)
    itens.push({
      item: "Estoque",
      nivel: qtd > Number(estoque.saldoVirtualTotal) ? "erro" : "ok",
      texto: `Bling: ${estoque.saldoVirtualTotal} disponível (SKU ${estoque.produto?.codigo}). Anúncio: ${qtd}.`,
    });
  else
    itens.push({
      item: "Estoque",
      nivel: "aviso",
      texto: `Quantidade informada à mão: ${qtd}. ${
        estoque === null
          ? "Consultando o Bling..."
          : estoque?.encontrado === false
            ? "SKU não encontrado no Bling."
            : "O Bling ainda não libera a leitura de estoque para o PAIIA (falta o escopo de Estoques)."
      }`,
    });

  // Peso e embalagem (bloqueia sem medida validada/informada, fora do
  // limite, sem simulação com os valores atuais ou sem confirmação).
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
    texto: log.nivel === "ok" ? log.texto : `${log.texto} (vem da Conferência: use "Editar / revisar a Conferência").`,
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
  return itens;
}

// Toda chamada leva a conta ML escolhida (conta_ml). Sem conta: não chama.
async function chamar(acao, extra = {}, contaML = "") {
  if (!contaML) return { ok: false, codigo: "conta_nao_selecionada", erro: "Selecione a conta Mercado Livre desta publicação." };
  const { data, error } = await supabase.functions.invoke("mercadolivre-publicacao", {
    body: { acao, conta_ml: String(contaML), ...extra },
  });
  if (error) return { ok: false, erro: error.message || "Falha ao falar com o servidor." };
  return data || { ok: false, erro: "Resposta vazia do servidor." };
}

export default function RevisaoPublicacaoML({ anuncio, titulo, onFechar, contaDestino = "", onContaDestino, anuncioId = "", onAnuncioId }) {
  const [conexao, setConexao] = useState(null);
  const [preparo, setPreparo] = useState(null);
  const [validacao, setValidacao] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [ocupado, setOcupado] = useState("conexao");
  const [autorizado, setAutorizado] = useState(false);
  const [armado, setArmado] = useState(false);
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
          setFicha({ carregando: false, disponivel: true, gravada: false, anuncioId: "", erro: "", outros: [{ ...r.anuncio }, ...outros] });
          return;
        }
        if (r.ok) {
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
  // Opções: as 3 lojas da empresa + qualquer outra conta conectada.
  const opcoesConta = [
    ...LOJAS_ML.map((l) => {
      const c = contasConectadas.find((x) => String(x.ml_user_id) === l.ml_user_id);
      return { nome: l.nome, id: l.ml_user_id, conectada: Boolean(c), nickname: c?.nickname || "" };
    }),
    ...contasConectadas
      .filter((c) => !LOJAS_ML.some((l) => l.ml_user_id === String(c.ml_user_id)))
      .map((c) => ({ nome: c.nickname || "Conta", id: String(c.ml_user_id), conectada: true, nickname: c.nickname || "" })),
  ];

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
  const skuEnvio = skuOficial({ sku: anuncio?.sku, codigo: anuncio?.codigo || anuncio?.oem });

  const [campos, setCampos] = useState(() => ({
    titulo: String(titulo || anuncio?.titulo || "").slice(0, 60),
    preco: String(anuncio?.preco ?? ""),
    quantidade: 1,
    tipoAnuncio: anuncio?.tipoAnuncio === "premium" ? "premium" : "classico",
    // Marca e categoria: as APROVADAS na Conferência.
    marca: String(anuncio?.marca || lerMarcaPadrao() || ""),
    codigo: String(anuncio?.codigo || anuncio?.oem || ""),
    gtin: String(anuncio?.gtin || ""),
    categoria_id: String(anuncio?.categoriaId || ""),
  }));
  // Atributos obrigatórios da categoria que o usuário escolhe aqui.
  const [extras, setExtras] = useState({});

  const dadosAnuncio = useMemo(
    () => ({
      ...campos,
      oem: anuncio?.oem || "",
      // SKU oficial vai ao ML como atributo SELLER_SKU.
      sku: skuEnvio,
      descricao: anuncio?.descricao || "",
      fotos: fotosUrls,
      // Só a medida validada/informada e confirmada vai ao ML.
      embalagem:
        logistica?.medida && logistica.confirmado
          ? { ...logistica.medida, nivel: logistica.nivel, origem: logistica.nivel, config_embalagem: logistica.config_embalagem, modalidade: logistica.modalidade }
          : null,
      atributos_extras: Object.entries(extras)
        .filter(([, v]) => v && (v.value_id || v.value_name))
        .map(([id, v]) => ({ id, ...(v.value_id ? { value_id: v.value_id } : { value_name: v.value_name }) })),
    }),
    [campos, anuncio, fotosUrls, extras, logistica, skuEnvio]
  );

  function alterarExtra(id, valor) {
    setExtras((e) => ({ ...e, [id]: valor }));
    setValidacao(null);
    setArmado(false);
  }

  function alterar(campo, valor) {
    setCampos((c) => ({ ...c, [campo]: valor }));
    setValidacao(null);
    setArmado(false);
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

  // Cadastro que SERÁ criado no Bling se o produto não existir (só preparo;
  // nada é enviado ao Bling nesta fase).
  const preparoBling = useMemo(() => ({
    codigo: String(anuncio?.codigo || ""),
    nome: String(titulo || anuncio?.titulo || ""),
    preco: String(anuncio?.preco ?? ""),
    gtin: String(anuncio?.gtin || ""),
    marca: String(anuncio?.marca || ""),
    tipo: "P",
    situacao: "A",
    formato: "S",
    pesoBruto_g: logistica?.medida?.peso_g ?? null,
    dimensoes_cm: logistica?.medida
      ? { largura: logistica.medida.largura_cm, altura: logistica.medida.altura_cm, profundidade: logistica.medida.comprimento_cm }
      : null,
  }), [anuncio, titulo, logistica]);

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
    const variantes = [...new Set([skuEnvio, String(anuncio?.codigo || "").trim(), normalizarCodigo(skuEnvio)].filter(Boolean))];
    const mlbs = new Set();
    for (const v of variantes) {
      const r = await chamar("ml_consulta", { metodo: "GET", caminho: `/users/${conta}/items/search?seller_sku=${encodeURIComponent(v)}` }, conta);
      if (!r?.ok) return { erro: r?.erro || "consulta indisponível" };
      for (const id of Array.isArray(r.dados?.results) ? r.dados.results : []) if (id) mlbs.add(id);
    }
    const ativosBase = [];
    for (const p of registrosBase) {
      if (!/^MLB\d+$/.test(String(p?.mlb_id || ""))) continue;
      const r = await chamar("ml_consulta", { metodo: "GET", caminho: `/items/${p.mlb_id}` }, conta);
      if (!r?.ok) return { erro: r?.erro || `não foi possível consultar ${p.mlb_id}` };
      const it = r.dados || {};
      if (String(it.seller_id || "") === String(conta) && it.status !== "closed") ativosBase.push(`${p.mlb_id} (${it.status})`);
    }
    return { verificado: true, mlbs: [...mlbs], ativosBase };
  }
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
  const aplicacoes = useMemo(
    () => lerAplicacoesAprovadas({ aplicacoes: anuncio?.aplicacoes, texto: anuncio?.compatibilidades }),
    [anuncio]
  );
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

  // Bling: releitura (somente leitura) e criação do produto só DEPOIS da
  // publicação e com autorização explícita (não roda sozinho).
  const [criacaoBling, setCriacaoBling] = useState(null);
  async function relerBling() {
    const sku = String(anuncio?.codigo || "").trim();
    if (!sku) return;
    setEstoque(null);
    try {
      const { data } = await supabase.functions.invoke("bling-integracao", { body: { acao: "saldo_por_sku", sku } });
      setEstoque(data || { ok: false });
    } catch {
      setEstoque({ ok: false });
    }
  }
  async function criarProdutoBling() {
    setCriacaoBling({ ocupado: true });
    const { data, error } = await supabase.functions.invoke("bling-integracao", {
      body: { acao: "criar_produto", confirmado: true, confirmacao: "CRIAR_PRODUTO_BLING", produto: preparoBling },
    });
    const r = error ? { ok: false, erro: error.message } : data || { ok: false, erro: "Resposta vazia." };
    if (r.ok && r.produto?.id && ficha.anuncioId) {
      await registrarProdutoBlingCriado({ anuncioId: ficha.anuncioId, blingProdutoId: r.produto.id });
      await relerBling();
    }
    setCriacaoBling({ ocupado: false, ...r });
  }

  async function validarNoML() {
    setOcupado("validar");
    setValidacao(null);
    setArmado(false);
    const r = await chamar("validar_item", { anuncio: dadosAnuncio }, contaEscolhida);
    setValidacao(r);
    setOcupado("");
  }

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
          : noML?.mlbs?.length || noML?.ativosBase?.length
            ? `Já existe anúncio deste SKU nesta conta no Mercado Livre (${[...(noML.mlbs || []), ...(noML.ativosBase || [])].join(", ")}).`
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
    if (r?.ok && r.publicado && r.item_id) {
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
    }
    setResultado(verificacao ? { ...r, verificacao } : r);
    setArmado(false);
    // Salva o resultado na ficha: MLB, data/hora, SKU, verificação, Bling.
    if (ficha.anuncioId) {
      const g = await registrarResultadoPublicacao({ anuncioId: ficha.anuncioId, contaId: contaEscolhida, resultado: r, bling: estoque, sku: skuEnvio, verificacao });
      setFicha((f) => ({ ...f, resultadoGravado: g.ok, erroResultado: g.ok ? "" : g.erro, modoGravacao: g.modo }));
    }
    setOcupado("");
  }

  const contaOk = Boolean(contaEscolhida) && conexao?.ok && conexao.conectado && conexao.pertence_ao_usuario && String(conexao.ml_user_id) === String(contaEscolhida);
  useEffect(() => {
    setDuplicidadeML(null);
    setDuplicidadeBase(null);
    setCompatML(null);
    if (contaOk) {
      conferirDuplicidadeML(contaEscolhida);
      resolverCompat(contaEscolhida);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contaOk, contaEscolhida]);

  // Tipo de veículo aprovado na Conferência → valor do atributo VEHICLE_TYPE
  // da categoria (pré-preenchido; o usuário pode revisar). Sem valor
  // correspondente: fica em branco e o PAIIA pede a escolha.
  const attrTipoVeiculo = (preparo?.obrigatorios || []).find((a) => a.id === "VEHICLE_TYPE") || null;
  useEffect(() => {
    if (!attrTipoVeiculo?.valores?.length || extras.VEHICLE_TYPE) return;
    const v = valorTipoVeiculo(attrTipoVeiculo.valores, anuncio?.tipoVeiculo);
    if (v) setExtras((e) => (e.VEHICLE_TYPE ? e : { ...e, VEHICLE_TYPE: { value_id: String(v.id), sugerido: true } }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preparo]);
  const tipoVeiculoEnvio = (() => {
    const e = extras.VEHICLE_TYPE;
    if (!e) return "";
    if (e.value_name) return e.value_name;
    return (attrTipoVeiculo?.valores || []).find((v) => String(v.id) === String(e.value_id))?.nome || "";
  })();
  const conferencia = conferir({
    campos, preparo, estoque, fotosUrls, logistica, ficha, duplicado, duplicidadeML, duplicidadeBase, skuEnvio,
    descricao: anuncio?.descricao, compatML, aplicacoes, tipoVeiculoEnvio, tipoVeiculoExigido: Boolean(attrTipoVeiculo && !attrTipoVeiculo.preenchido), compatTexto: anuncio?.compatibilidades,
  });
  const bloqueios = conferencia.filter((c) => c.nivel === "erro");
  // Marca, código e GTIN já têm campo próprio acima.
  const cobertosPelosCampos = {
    BRAND: campos.marca.trim(),
    PART_NUMBER: campos.codigo.trim(),
    GTIN: campos.gtin.trim(),
  };
  const faltando = (preparo?.obrigatorios || []).filter(
    (a) => !a.preenchido && !cobertosPelosCampos[a.id]
  );
  const faltandoSemValor = faltando.filter((a) => !(extras[a.id]?.value_id || extras[a.id]?.value_name));

  return (
    <section data-paiia-revisao-ml style={painel}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h3 style={{ color: "#fde047", margin: 0 }}>🚀 Publicação no Mercado Livre</h3>
        <button type="button" onClick={onFechar} style={botaoCinza}>✏️ Editar / revisar a Conferência</button>
      </div>

      <p style={{ color: "#94a3b8", fontSize: 13, margin: "8px 0 16px" }}>
        A Conferência PAIIA já foi aprovada: os dados abaixo são os aprovados. Escolha a conta, valide e só então confirme. Nada é publicado automaticamente.
      </p>

      {/* 1. Conexão */}
      <div style={bloco}>
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
              const loja = LOJAS_ML.find((l) => l.ml_user_id === String(a.conta_destino_ml_user_id))?.nome || a.conta_destino_nome || "sem conta";
              const publicado = publicacaoExiste(pub);
              return (
                <div key={a.id} style={{ color: "#e2e8f0", fontSize: 13, margin: "4px 0" }}>
                  • {loja} — {publicado ? `publicado (${pub.mlb_id})${pendenciaPublicacao(pub) ? ` — ⚠ COM PENDÊNCIA: ${pendenciaPublicacao(pub).replace(/^PENDÊNCIA — /, "").slice(0, 160)}` : ""}` : "em andamento"} · {new Date(a.updated_at).toLocaleString("pt-BR")}
                  {!publicado && (
                    <button type="button" data-paiia-continuar-ficha onClick={() => continuarFicha(a)} style={{ ...botaoCinza, marginLeft: 8, padding: "4px 10px" }}>
                      Continuar esta ficha
                    </button>
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

      {/* Bling — controle de estoque (somente leitura nesta fase) */}
      <div data-paiia-bling-publicacao style={bloco}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <strong style={subtitulo}>Bling — controle de estoque</strong>
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
          </div>
        ) : estoque?.ok ? (
          <div data-paiia-bling-estado="nao-encontrado" style={{ color: "#e2e8f0", fontSize: 14, lineHeight: 1.7 }}>
            <div>⚠ Produto com SKU <b>{anuncio?.codigo}</b> não existe no Bling.</div>
            <div style={info}>
              Cadastro PREPARADO para criar quando a publicação real for liberada (nada é enviado ao Bling agora):
              {" "}código {preparoBling.codigo} · {preparoBling.nome} · preço {precoTexto(preparoBling.preco) || "—"}
              {preparoBling.gtin ? ` · GTIN ${preparoBling.gtin}` : ""}{preparoBling.marca ? ` · marca ${preparoBling.marca}` : ""}
              {preparoBling.pesoBruto_g ? ` · ${preparoBling.pesoBruto_g} g` : ""}
              {preparoBling.dimensoes_cm ? ` · ${preparoBling.dimensoes_cm.profundidade}×${preparoBling.dimensoes_cm.largura}×${preparoBling.dimensoes_cm.altura} cm` : ""}.
            </div>
            {resultado?.ok && resultado.publicado ? (
              <div style={{ marginTop: 8 }}>
                <button type="button" data-paiia-criar-bling onClick={criarProdutoBling} disabled={criacaoBling?.ocupado} style={botaoAzul}>
                  {criacaoBling?.ocupado ? "⏳ Criando no Bling..." : "Criar produto no Bling e vincular a este anúncio"}
                </button>
                {criacaoBling && !criacaoBling.ocupado && (
                  <p style={criacaoBling.ok ? { ...info, color: "#86efac" } : erro}>
                    {criacaoBling.ok ? `✅ Produto criado no Bling (ID ${criacaoBling.produto?.id}) e vinculado.` : `❌ ${criacaoBling.erro}`}
                  </p>
                )}
              </div>
            ) : (
              <p style={info}>A criação no Bling só fica disponível depois da publicação, com o seu clique (nunca automática). Nada é duplicado: o SKU é conferido de novo antes de criar.</p>
            )}
          </div>
        ) : (
          <p data-paiia-bling-estado="erro" style={aviso}>⚠ Não foi possível consultar o Bling agora{estoque?.mensagem ? `: ${estoque.mensagem}` : estoque?.erro ? `: ${estoque.erro}` : "."}</p>
        )}
      </div>

      {contaOk && (
        <>
          {/* 2. Dados */}
          <div style={bloco}>
            <strong style={subtitulo}>2. Dados que serão enviados</strong>
            <div style={grade}>
              <Campo rotulo="Título (aprovado)">
                <div data-paiia-pub-titulo style={valorAprovado}>{campos.titulo || "—"}</div>
              </Campo>
              <Campo rotulo="Preço (aprovado)">
                <div style={valorAprovado}>{precoTexto(campos.preco) || "—"}</div>
              </Campo>
              <Campo rotulo="Quantidade">
                <input style={entrada} type="number" min={1} value={campos.quantidade} onChange={(e) => alterar("quantidade", e.target.value)} />
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
            {extras.VEHICLE_TYPE?.sugerido && (
              <p style={info} data-paiia-tipo-veiculo-sugerido>Tipo de veículo preenchido com o aprovado na Conferência ({tipoVeiculoEnvio}). Pode revisar acima.</p>
            )}
            {aplicacoes.length > 0 && (
              <div data-paiia-compat-ml style={{ marginTop: 10, color: "#e2e8f0", fontSize: 13 }}>
                <b>Compatibilidades (só as aplicações aprovadas):</b>{" "}
                {aplicacoes.map((a) => `${a.modelo} ${a.motor} ${a.anoInicio || "?"}–${a.anoFim || "?"}`).join(" · ")}
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
          <div style={bloco}>
            <strong style={subtitulo}>3. Validar no Mercado Livre (não publica)</strong>
            <button
              type="button"
              data-paiia-validar-ml
              onClick={validarNoML}
              disabled={!!ocupado || !campos.categoria_id || faltandoSemValor.length > 0}
              style={botaoAzul}
            >
              {ocupado === "validar" ? "⏳ Validando..." : "🔎 Validar dados no Mercado Livre"}
            </button>
            {validacao && validacao.ok && validacao.valido && (
              <p style={{ ...info, color: "#86efac" }}>✅ O Mercado Livre aceitou os dados. Nenhum anúncio foi criado.</p>
            )}
            {validacao && (!validacao.ok || !validacao.valido) && (
              <div style={erro}>
                ❌ {validacao.erro || validacao.mensagem || "O Mercado Livre apontou problemas:"}
                <ul style={{ margin: "6px 0 0 18px" }}>
                  {(validacao.causas || []).map((c, i) => (
                    <li key={i}>{c.mensagem || c.codigo}</li>
                  ))}
                </ul>
                {!(validacao.causas || []).length && validacao.detalhe && (
                  <pre style={{ whiteSpace: "pre-wrap", fontSize: 11, color: "#cbd5e1", margin: "6px 0 0" }}>{validacao.detalhe}</pre>
                )}
              </div>
            )}
          </div>

          {/* 4. Confirmação */}
          <div style={bloco}>
            <strong style={subtitulo}>4. Confirmar publicação real</strong>
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
            {bloqueios.length > 0 && <p style={erro}>Corrija antes de publicar: {bloqueios.map((b) => b.item).join(", ")}.</p>}
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
            {resultado && ficha.erroResultado && <p style={erro}>⚠ O resultado não foi salvo na ficha: {ficha.erroResultado}</p>}
          </div>
        </>
      )}
    </section>
  );
}

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
