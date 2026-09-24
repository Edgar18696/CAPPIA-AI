// Banner Express — cenário com IA (OpenAI).
// localhost ("npm run dev"): servidor local da IA (vite.config.js), com a
//   chave OPENAI_API_KEY guardada só no computador (.env.local).
// Produção: função Supabase "banner-openai" (precisa de deploy).
// A IA recebe a FOTO REAL já posicionada + máscara que protege a peça.
// Nenhum dado comercial é enviado à IA.

export const FUNCAO_BANNER_IA = "banner-openai";
export const ROTA_LOCAL_BANNER_IA = "/__paiia/banner-openai";
export const TEMPO_LIMITE_IA_MS = 180000;

const MENSAGENS = {
  SERVIDOR_LOCAL_INATIVO:
    "O \"npm run dev\" que está aberto foi iniciado antes da atualização e não carregou o servidor da IA. Rode ATIVAR_OPENAI_LOCAL.ps1 (botão direito > Executar com o PowerShell): ele configura a chave e reinicia o npm run dev.",
  FUNCAO_NAO_PUBLICADA:
    "A função banner-openai ainda não foi publicada no Supabase (deploy pendente).",
  SEM_CHAVE:
    "Chave OPENAI_API_KEY não encontrada no computador. Rode ATIVAR_OPENAI_LOCAL.ps1 na pasta do projeto.",
  CHAVE_INVALIDA: "A OpenAI recusou a chave (OPENAI_API_KEY inválida ou revogada).",
  SEM_CREDITO_OPENAI: "A conta OpenAI está sem crédito/limite de uso para imagens.",
  LIMITE_OPENAI: "Limite de uso da OpenAI atingido agora. Aguarde um pouco e tente novamente.",
  MODELO_SEM_ACESSO:
    "A conta OpenAI não tem acesso aos modelos de imagem (pode exigir verificação da organização na OpenAI).",
  MODERACAO: "A OpenAI recusou esta imagem pelo filtro de segurança. Tente outra foto ou outro fundo.",
  CONEXAO_OPENAI: "O computador não conseguiu conectar à OpenAI (internet/firewall).",
  OPENAI_INDISPONIVEL: "A OpenAI está instável agora. Tente novamente em instantes.",
  TEMPO_ESGOTADO: "A OpenAI demorou demais para responder. Tente novamente.",
  NAO_AUTORIZADO: "Faça login no PAIIA para gerar com IA.",
};

export function explicarErroIA(codigo, mensagemOriginal = "") {
  const base = MENSAGENS[codigo];
  if (base) return base;
  return mensagemOriginal || "A IA não conseguiu criar o cenário.";
}

function criarFalha(codigo, mensagem, detalhe = "") {
  const erro = new Error(explicarErroIA(codigo, mensagem));
  erro.codigo = codigo || "FALHA_IA";
  erro.detalhe = detalhe || mensagem || "";
  return erro;
}

async function lerErroFuncao(erro) {
  try {
    const contexto = erro?.context;
    if (contexto && typeof contexto.json === "function") {
      const corpo = await contexto.json();
      return {
        status: contexto.status || 0,
        mensagem: corpo?.erro || corpo?.message || erro?.message || "",
        codigo: corpo?.codigo || (contexto.status === 404 ? "FUNCAO_NAO_PUBLICADA" : ""),
      };
    }
  } catch {
    // corpo não é JSON
  }
  // "Failed to send a request to the Edge Function": função inexistente
  // (sem deploy) ou sem rede — o navegador bloqueia antes da resposta.
  if (erro?.name === "FunctionsFetchError" || /Failed to send a request/i.test(erro?.message || "")) {
    return { status: 0, mensagem: erro?.message || "", codigo: "FUNCAO_NAO_PUBLICADA" };
  }
  return { status: 0, mensagem: erro?.message || "", codigo: "" };
}

function comTempoLimite(promessa, tempoLimite) {
  let temporizador;
  const limite = new Promise((_, rejeitar) => {
    temporizador = setTimeout(() => rejeitar(criarFalha("TEMPO_ESGOTADO")), tempoLimite);
  });
  return Promise.race([promessa, limite]).finally(() => clearTimeout(temporizador));
}

async function chamarServidorLocal(corpo, tempoLimite, fetchImpl) {
  let resposta;
  try {
    resposta = await comTempoLimite(
      fetchImpl(ROTA_LOCAL_BANNER_IA, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      }),
      tempoLimite
    );
  } catch (erro) {
    if (erro?.codigo) throw erro;
    throw criarFalha("SERVIDOR_LOCAL_INATIVO", "", erro?.message);
  }
  const tipo = String(resposta.headers.get("content-type") || "");
  if (!tipo.includes("application/json")) {
    // O Vite devolveu a página do app: servidor local da IA não carregado.
    throw criarFalha("SERVIDOR_LOCAL_INATIVO", "", `HTTP ${resposta.status}`);
  }
  const dados = await resposta.json();
  if (!resposta.ok || !dados?.sucesso) {
    throw criarFalha(dados?.codigo || "FALHA_IA", dados?.erro, JSON.stringify(dados?.tentativas || ""));
  }
  return dados;
}

async function chamarFuncaoSupabase(supabase, corpo, tempoLimite) {
  if (!supabase?.functions?.invoke) {
    throw criarFalha("FUNCAO_NAO_PUBLICADA");
  }
  const { data, error } = await comTempoLimite(
    supabase.functions.invoke(FUNCAO_BANNER_IA, { body: corpo }),
    tempoLimite
  );
  if (error) {
    const detalhe = await lerErroFuncao(error);
    throw criarFalha(detalhe.codigo || "FALHA_IA", detalhe.mensagem, error?.message);
  }
  if (!data?.sucesso || !data?.imagem) {
    throw criarFalha(data?.codigo || "FALHA_IA", data?.erro);
  }
  return { ...data, origem: data.origem || "openai-supabase" };
}

export async function gerarCenarioComIA({
  supabase,
  referencia,
  mascara = "",
  tamanho,
  formato,
  paleta,
  estilo,
  cenario,
  zonasLivres = [],
  pedestal = false,
  variacao = 0,
  modo = "",
  zonaProduto = "",
  tempoLimite = TEMPO_LIMITE_IA_MS,
  modoLocal = Boolean(import.meta.env?.DEV),
  fetchImpl = (...args) => fetch(...args),
}) {
  const corpo = {
    referencia,
    mascara,
    tamanho,
    formato,
    paleta,
    estilo,
    cenario,
    zonasLivres,
    pedestal,
    variacao,
    modo,
    zonaProduto,
  };

  let dados;
  if (modoLocal) {
    try {
      dados = await chamarServidorLocal(corpo, tempoLimite, fetchImpl);
    } catch (erro) {
      // Sem chave no computador: usa a chave já configurada no Supabase
      // (segredo OPENAI_API_KEY, o mesmo das outras IAs do PAIIA).
      if (erro?.codigo !== "SEM_CHAVE" || !supabase?.functions?.invoke) throw erro;
      try {
        dados = await chamarFuncaoSupabase(supabase, corpo, tempoLimite);
      } catch (erroSupabase) {
        if (erroSupabase?.codigo === "FUNCAO_NAO_PUBLICADA") {
          throw criarFalha(
            "SEM_CHAVE_LOCAL_E_FUNCAO_NAO_PUBLICADA",
            "A chave OpenAI do PAIIA está guardada no Supabase (segredo OPENAI_API_KEY), mas a função banner-openai ainda não foi publicada lá. Publique a função (deploy) para usar essa chave."
          );
        }
        throw erroSupabase;
      }
    }
  } else {
    dados = await chamarFuncaoSupabase(supabase, corpo, tempoLimite);
  }

  return {
    imagem: dados.imagem,
    origem: dados.origem || "openai",
    modelo: dados.modelo || "",
    qualidade: dados.qualidade || "",
    duracaoMs: dados.duracaoMs || 0,
    idPedido: dados.idPedido || "",
    usouMascara: Boolean(dados.usouMascara),
  };
}
