import { supabase } from "../supabase";

const CHAVE_LOCAL = "paiiaMascoteOficial";

function chaveLocal(userId) {
  return `${CHAVE_LOCAL}:${userId}`;
}

function lerLocal(userId) {
  try {
    const bruto = localStorage.getItem(
      chaveLocal(userId)
    );
    return bruto ? JSON.parse(bruto) : null;
  } catch {
    return null;
  }
}

function gravarLocal(userId, mascote) {
  localStorage.setItem(
    chaveLocal(userId),
    JSON.stringify(mascote)
  );
}

export async function obterUsuarioMascote() {
  const { data, error } =
    await supabase.auth.getUser();

  if (error || !data?.user?.id) {
    throw new Error(
      "Faça login para criar ou usar o mascote da marca."
    );
  }

  return data.user;
}

export async function buscarMascoteOficial(userId) {
  const id = String(userId || "").trim();

  if (!id) {
    return null;
  }

  const { data, error } = await supabase
    .from("mascotes_marca")
    .select("*")
    .eq("user_id", id)
    .eq("oficial", true)
    .eq("ativo", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!error && data) {
    gravarLocal(id, data);
    return data;
  }

  return lerLocal(id);
}

export async function salvarMascoteOficial({
  userId,
  nome,
  empresa,
  imagemBase,
  descricaoOriginal,
  promptBase,
  cores,
  roupaAcessorios,
  logoAssociado,
  estiloVisual,
  caracteristicas,
}) {
  const agora = new Date().toISOString();

  const registro = {
    user_id: userId,
    nome: nome || "",
    empresa: empresa || "",
    imagem_base: imagemBase,
    descricao_original: descricaoOriginal || "",
    prompt_base: promptBase || "",
    cores: cores || "",
    roupa_acessorios: roupaAcessorios || "",
    logo_associado: logoAssociado || "",
    estilo_visual: estiloVisual || "",
    caracteristicas: caracteristicas || "",
    ativo: true,
    oficial: true,
    updated_at: agora,
  };

  await supabase
    .from("mascotes_marca")
    .update({
      oficial: false,
      updated_at: agora,
    })
    .eq("user_id", userId)
    .eq("oficial", true);

  const { data, error } = await supabase
    .from("mascotes_marca")
    .insert([
      {
        ...registro,
        created_at: agora,
      },
    ])
    .select()
    .single();

  const salvo = error ? { id: `local-${Date.now()}`, ...registro, created_at: agora } : data;
  gravarLocal(userId, salvo);

  await registrarMascoteNaGaleria({
    userId,
    imagemBase,
  });

  return salvo;
}

async function registrarMascoteNaGaleria({
  userId,
  imagemBase,
}) {
  const url = String(imagemBase || "").trim();

  if (!userId || !url) {
    return;
  }

  const { data: existentes, error: erroBusca } =
    await supabase
      .from("processamentos")
      .select("id")
      .eq("user_id", userId)
      .eq("tipo", "mascote")
      .eq("imagem_processada", url)
      .limit(1);

  if (erroBusca) {
    throw new Error(
      "Não foi possível verificar a Galeria: " +
        erroBusca.message
    );
  }

  if (Array.isArray(existentes) && existentes.length > 0) {
    return existentes[0];
  }

  const { error } = await supabase
    .from("processamentos")
    .insert([
      {
        user_id: userId,
        imagem_original: url,
        imagem_processada: url,
        status: "finalizado",
        tipo: "mascote",
      },
    ]);

  if (error) {
    throw new Error(
      "O mascote oficial foi salvo, mas não entrou na Galeria: " +
        error.message
    );
  }
}

export async function publicarImagemMascote({
  userId,
  imagem,
}) {
  const valor = String(imagem || "").trim();
  const jaNoStorage =
    /\/storage\/v1\/object\/public\/imagens\//.test(
      valor
    );

  if (/^https?:\/\//i.test(valor) && jaNoStorage) {
    return valor;
  }

  const resposta = await fetch(valor);
  const blob = await resposta.blob();
  const extensao =
    blob.type === "image/jpeg" ? "jpg" : "png";
  const caminho = `${userId}/marketing/mascotes/oficial-${Date.now()}.${extensao}`;

  const { error } = await supabase.storage
    .from("imagens")
    .upload(caminho, blob, {
      contentType: blob.type || "image/png",
      upsert: true,
    });

  if (error) {
    throw new Error(
      "Não foi possível salvar a imagem do mascote: " +
        error.message
    );
  }

  const { data } = supabase.storage
    .from("imagens")
    .getPublicUrl(caminho);

  const url = data?.publicUrl || "";

  if (!/^https?:\/\//i.test(url)) {
    throw new Error(
      "A imagem do mascote foi salva, mas a URL pública não ficou disponível."
    );
  }

  return url;
}

export const CUSTO_CREDITOS_CRIAR_MASCOTE = 10;

export const PACOTES_CREDITOS_PAIIA = [
  { creditos: 10 },
  { creditos: 30 },
  { creditos: 60 },
  { creditos: 120 },
];

export function rotuloCustoCriarMascote() {
  return `Criar Mascote • ${CUSTO_CREDITOS_CRIAR_MASCOTE} créditos`;
}

export async function consultarCreditosPaiia() {
  const { data, error } = await supabase.rpc("consultar_creditos_appia");

  if (error) {
    throw new Error(
      "Não foi possível consultar os créditos: " + error.message
    );
  }

  return Math.max(0, Number(data || 0));
}

export function montarPromptMascotePaizinho({
  origem = "zero",
  nome = "",
  estilo = "",
  cores = "",
  roupaAcessorios = "",
  expressao = "",
  observacoes = "",
  temLogo = false,
  temFoto = false,
  cenaPrompt = "",
} = {}) {
  const partes = [
    "Criar um mascote original da marca, personagem único, sem logotipo escrito no corpo e sem texto visível.",
  ];

  if (nome.trim()) {
    partes.push(`Nome do mascote: ${nome.trim()}.`);
  }

  if (estilo.trim()) {
    partes.push(`Estilo visual: ${estilo.trim()}.`);
  }

  if (cores.trim()) {
    partes.push(`Cores da marca: ${cores.trim()}.`);
  }

  if (roupaAcessorios.trim()) {
    partes.push(`Roupa e acessórios: ${roupaAcessorios.trim()}.`);
  }

  if (expressao.trim()) {
    partes.push(`Expressão: ${expressao.trim()}.`);
  }

  if (origem === "logo" || temLogo) {
    partes.push(
      "Usar o logo enviado apenas como referência de identidade visual, sem copiar texto do logo no personagem."
    );
  }

  if (origem === "foto" || temFoto) {
    partes.push(
      "Usar a foto de referência como base do personagem, preservando traços principais."
    );
  }

  if (origem === "zero") {
    partes.push("Criar do zero, com cara de oficina automotiva e atitude amigável.");
  }

  if (observacoes.trim()) {
    partes.push(`Observações: ${observacoes.trim()}.`);
  }

  if (cenaPrompt) {
    partes.push(String(cenaPrompt).trim());
  }

  partes.push(
    "O mascote deve servir para Banner, Clip e campanhas, com leitura clara em formato quadrado."
  );

  return partes.join(" ");
}

const CHAVE_RASCUNHO = "paiiaMascoteCriacaoRascunho";

export function lerRascunhoMascote() {
  try {
    const bruto = localStorage.getItem(CHAVE_RASCUNHO);
    return bruto ? JSON.parse(bruto) : null;
  } catch {
    return null;
  }
}

export function gravarRascunhoMascote(dados) {
  localStorage.setItem(CHAVE_RASCUNHO, JSON.stringify(dados || {}));
}

export async function salvarMascoteNoKit(params) {
  return salvarMascoteOficial(params);
}

export async function gerarImagemMascotePaiia({
  prompt,
  descricao,
  nome,
  cores,
  estilo,
  logoUrl,
  fotoReferenciaUrl,
  cenaId,
  cenaNome,
}) {
  const { data: sessao, error: erroSessao } =
    await supabase.auth.getSession();
  const token = sessao?.session?.access_token || "";

  if (erroSessao || !token) {
    throw new Error("Faça login para gerar o mascote.");
  }

  const { data, error } = await supabase.functions.invoke(
    "gerar-mascote-ia",
    {
      body: {
        prompt,
        descricao: descricao || prompt,
        nome,
        cores,
        estilo,
        logoUrl,
        fotoReferenciaUrl,
        cenaId,
        cenaNome,
      },
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (error) {
    throw new Error(
      data?.erro ||
        error.message ||
        "Não foi possível gerar o mascote. Nenhum crédito PAIIA foi usado."
    );
  }

  if (!data?.sucesso) {
    const falha = new Error(
      data?.erro ||
        "Não foi possível gerar o mascote. Nenhum crédito PAIIA foi usado."
    );
    falha.saldoInsuficiente = Boolean(data?.saldoInsuficiente);
    throw falha;
  }

  const imagem = String(data?.imagem || data?.opcoes?.[0] || "").trim();
  if (!imagem) {
    throw new Error(
      "A geração terminou sem imagem. Nenhum crédito PAIIA foi usado."
    );
  }

  return {
    imagem,
    promptBase: data?.prompt_base || prompt,
    saldo: data?.saldo,
  };
}
