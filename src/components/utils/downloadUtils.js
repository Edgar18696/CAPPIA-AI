import {
  supabase,
} from "../../supabase";

function detectarExtensao(
  tipo = "",
  url = ""
) {
  const mime =
    String(
      tipo || ""
    ).toLowerCase();

  const endereco =
    String(
      url || ""
    ).toLowerCase();

  if (
    mime.includes("jpeg") ||
    mime.includes("jpg")
  ) {
    return "jpg";
  }

  if (
    mime.includes("webp")
  ) {
    return "webp";
  }

  if (
    mime.includes("png")
  ) {
    return "png";
  }

  if (
    mime.includes("gif")
  ) {
    return "gif";
  }

  if (
    mime.includes("mp4")
  ) {
    return "mp4";
  }

  if (
    mime.includes("webm")
  ) {
    return "webm";
  }

  if (
    mime.includes(
      "quicktime"
    )
  ) {
    return "mov";
  }

  if (
    endereco.includes(
      ".mp4"
    )
  ) {
    return "mp4";
  }

  if (
    endereco.includes(
      ".webm"
    )
  ) {
    return "webm";
  }

  if (
    endereco.includes(
      ".mov"
    )
  ) {
    return "mov";
  }

  if (
    endereco.includes(
      ".jpg"
    ) ||
    endereco.includes(
      ".jpeg"
    )
  ) {
    return "jpg";
  }

  if (
    endereco.includes(
      ".webp"
    )
  ) {
    return "webp";
  }

  if (
    endereco.includes(
      ".gif"
    )
  ) {
    return "gif";
  }

  return "png";
}

async function baixarArquivo(
  url,
  prefixo = "appia-ai"
) {
  if (!url) {
    throw new Error(
      "Nenhum arquivo foi informado para download."
    );
  }

  const resposta =
    await fetch(
      url
    );

  if (
    !resposta.ok
  ) {
    throw new Error(
      "Não foi possível baixar o arquivo."
    );
  }

  const blob =
    await resposta.blob();

  const extensao =
    detectarExtensao(
      blob.type,
      url
    );

  const objectUrl =
    URL.createObjectURL(
      blob
    );

  const link =
    document.createElement(
      "a"
    );

  link.href =
    objectUrl;

  link.download =
    `${prefixo}-${Date.now()}.${extensao}`;

  document.body.appendChild(
    link
  );

  link.click();

  document.body.removeChild(
    link
  );

  window.setTimeout(
    () => {
      URL.revokeObjectURL(
        objectUrl
      );
    },
    3000
  );
}

async function prepararVideoWhatsApp(
  url
) {
  if (!url) {
    throw new Error(
      "Nenhum vídeo foi informado."
    );
  }

  console.log(
    "📱 Preparando vídeo para download..."
  );

  const {
    data,
    error,
  } =
    await supabase
      .functions
      .invoke(
        "preparar-video-whatsapp",
        {
          body: {
            videoUrl:
              url,
          },
        }
      );

  if (error) {
    console.error(
      "❌ ERRO PREPARAR VÍDEO:",
      error
    );

    throw new Error(
      error.message ||
        "Não foi possível preparar o vídeo."
    );
  }

  if (
    !data?.sucesso
  ) {
    throw new Error(
      data?.erro ||
        "Não foi possível preparar o vídeo."
    );
  }

  const videoPreparado =
    data?.video_url ||
    data?.videoUrl ||
    "";

  if (
    !videoPreparado
  ) {
    throw new Error(
      "A preparação terminou sem retornar o vídeo."
    );
  }

  console.log(
    "✅ VÍDEO PREPARADO:",
    videoPreparado
  );

  return videoPreparado;
}

export async function baixarImagem(
  url
) {
  return baixarArquivo(
    url,
    "appia-ai"
  );
}

export async function baixarClip(
  url
) {
  const videoPreparado =
    await prepararVideoWhatsApp(
      url
    );

  return baixarArquivo(
    videoPreparado,
    "paiia-video"
  );
}

export async function baixarVideo(
  url
) {
  const videoPreparado =
    await prepararVideoWhatsApp(
      url
    );

  return baixarArquivo(
    videoPreparado,
    "paiia-video"
  );
}