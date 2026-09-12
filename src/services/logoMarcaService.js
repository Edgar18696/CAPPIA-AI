import { supabase } from "../supabase";

const CHAVE_LOCAL = "paiiaLogoOficial";

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

function gravarLocal(userId, logo) {
  localStorage.setItem(
    chaveLocal(userId),
    JSON.stringify(logo)
  );
}

export async function buscarLogoOficial(userId) {
  const id = String(userId || "").trim();

  if (!id) {
    return null;
  }

  return lerLocal(id);
}

export async function salvarLogoOficial({
  userId,
  empresa,
  imagemBase,
  descricaoOriginal,
  promptBase,
  cores,
  estiloVisual,
}) {
  const agora = new Date().toISOString();
  const registro = {
    id: `logo-${Date.now()}`,
    user_id: userId,
    empresa: empresa || "",
    imagem_base: imagemBase,
    descricao_original: descricaoOriginal || "",
    prompt_base: promptBase || "",
    cores: cores || "",
    estilo_visual: estiloVisual || "",
    oficial: true,
    created_at: agora,
    updated_at: agora,
  };

  gravarLocal(userId, registro);
  return registro;
}

export async function publicarImagemLogo({
  userId,
  imagem,
}) {
  const valor = String(imagem || "").trim();

  if (/^https?:\/\//i.test(valor)) {
    return valor;
  }

  const resposta = await fetch(valor);
  const blob = await resposta.blob();
  const extensao =
    blob.type === "image/jpeg" ? "jpg" : "png";
  const caminho = `${userId}/marketing/logos/oficial-${Date.now()}.${extensao}`;

  const { error } = await supabase.storage
    .from("imagens")
    .upload(caminho, blob, {
      contentType: blob.type || "image/png",
      upsert: true,
    });

  if (error) {
    throw new Error(
      "Não foi possível salvar o logo: " +
        error.message
    );
  }

  const { data } = supabase.storage
    .from("imagens")
    .getPublicUrl(caminho);

  const url = data?.publicUrl || "";

  if (!/^https?:\/\//i.test(url)) {
    throw new Error(
      "O logo foi salvo, mas a URL pública não ficou disponível."
    );
  }

  return url;
}
