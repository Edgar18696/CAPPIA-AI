const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
};

function json(
  body: unknown,
  status = 200
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type":
          "application/json; charset=utf-8",
      },
    }
  );
}

function normalizarFormato(
  valor = ""
) {
  const texto = String(valor)
    .trim()
    .toLowerCase();

  if (
    texto.includes("mercadolivre") ||
    texto.includes("mercado_livre") ||
    texto.includes("mercado livre")
  ) {
    return {
      nome: "Mercado Livre Técnico",
      size: "1024x1024",
      orientacao: "quadrado",
    };
  }

  if (
    texto.includes("story") ||
    texto.includes("reel") ||
    texto.includes("vertical")
  ) {
    return {
      nome: "Story / Reels",
      size: "1024x1536",
      orientacao: "vertical",
    };
  }

  if (
    texto.includes("facebook") &&
    !texto.includes("quadrado")
  ) {
    return {
      nome: "Facebook Feed",
      size: "1024x1536",
      orientacao: "vertical",
    };
  }

  if (
    texto.includes("instagram") ||
    texto.includes("feed")
  ) {
    return {
      nome: "Instagram Feed",
      size: "1024x1536",
      orientacao: "vertical",
    };
  }

  return {
    nome: "Instagram / Facebook Quadrado",
    size: "1024x1024",
    orientacao: "quadrado",
  };
}

function normalizarPaleta(
  valor = ""
) {
  const texto = String(valor)
    .trim()
    .toLowerCase();

  if (
    /vermelh|laranja|oferta|impacto/.test(
      texto
    )
  ) {
    return {
      nome: "Vermelho Impacto",
      descricao:
        "vermelho profundo, laranja energético, amarelo dourado em pequenos detalhes, preto premium",
    };
  }

  if (
    /preto|grafite|dark|escuro|neon/.test(
      texto
    )
  ) {
    return {
      nome: "Grafite Neon",
      descricao:
        "grafite escuro, preto automotivo, azul elétrico, ciano neon e discretos reflexos violetas",
    };
  }

  if (
    /branco|clean|claro/.test(
      texto
    )
  ) {
    return {
      nome: "Clean Vibrante",
      descricao:
        "branco premium, cinza muito claro, azul royal e ciano em detalhes luminosos",
    };
  }

  return {
    nome: "Azul Elétrico",
    descricao:
      "azul royal intenso, azul elétrico, ciano neon, preto profundo e reflexos metálicos",
  };
}

const MODELOS = {
  promocao: {
    nome: "Promoção",
    headline:
      "OFERTA ESPECIAL",
    apoio:
      "APROVEITE ESTA CONDIÇÃO!",
    objetivo:
      "forte apelo de compra, preço dominante e sensação de oportunidade",
  },

  produto: {
    nome: "Produto em Destaque",
    headline:
      "PRODUTO EM DESTAQUE",
    apoio:
      "QUALIDADE PARA O SEU CARRO",
    objetivo:
      "valorizar o produto, transmitir confiança e destacar a peça como protagonista",
  },

  premium: {
    nome: "Premium",
    headline:
      "QUALIDADE PREMIUM",
    apoio:
      "DESEMPENHO E CONFIANÇA",
    objetivo:
      "campanha sofisticada, acabamento premium e percepção de alto valor",
  },

  pronta_entrega: {
    nome: "Pronta Entrega",
    headline:
      "PRONTA ENTREGA",
    apoio:
      "APROVEITE AGORA",
    objetivo:
      "destacar disponibilidade imediata, agilidade e incentivo à compra",
  },

  comunicado: {
    nome: "Comunicado",
    headline:
      "COMUNICADO",
    apoio:
      "INFORMAÇÃO IMPORTANTE",
    objetivo:
      "comunicação institucional clara, moderna e profissional",
  },
};

function normalizarModelo(
  valor = ""
) {
  const texto = String(valor)
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .trim()
    .toLowerCase();

  if (
    /promoc|oferta/.test(
      texto
    )
  ) {
    return MODELOS.promocao;
  }

  if (
    /premium|sofistic/.test(
      texto
    )
  ) {
    return MODELOS.premium;
  }

  if (
    /pronta|entrega|estoque/.test(
      texto
    )
  ) {
    return MODELOS.pronta_entrega;
  }

  if (
    /comunic|institucional|aviso/.test(
      texto
    )
  ) {
    return MODELOS.comunicado;
  }

  return MODELOS.produto;
}

function extrairPreco(
  texto = ""
) {
  const original =
    String(texto || "");

  const encontrado =
    original.match(
      /(?:r\$\s*)?(\d{1,6}(?:[.\s]\d{3})*(?:,\d{2})|\d{1,6}(?:\.\d{2})?)/i
    );

  if (!encontrado?.[1]) {
    return "";
  }

  const valor =
    encontrado[1]
      .replace(/\s/g, "")
      .trim();

  return valor.includes(",")
    ? `R$ ${valor}`
    : `R$ ${valor.replace(".", ",")}`;
}
function montarPrompt({
  descricao,
  paleta,
  formato,
  variacao,
  modelo,
  temLogo,
  temDetalheTecnico,
}: {
  descricao: string;
  paleta: string;
  formato: string;
  variacao: number;
  modelo: string;
  temLogo: boolean;
  temDetalheTecnico: boolean;
}) {
  const dadosFormato =
    normalizarFormato(
      formato
    );

  const dadosPaleta =
    normalizarPaleta(
      paleta
    );

  const dadosModelo =
    normalizarModelo(
      modelo
    );

  const pedido =
    String(descricao || "")
      .trim()
      .slice(0, 2600);

  const modoTecnico =
    formato ===
      "mercadoLivre" ||
    /MODO MERCADO LIVRE TÉCNICO/i.test(
      pedido
    );

  /*
   * =========================================
   * MERCADO LIVRE TÉCNICO
   * =========================================
   */
  if (modoTecnico) {
    return `
Crie uma IMAGEM TÉCNICA PROFISSIONAL DE AUTOPEÇA para complementar um anúncio no Mercado Livre.

A PRIMEIRA IMAGEM enviada é a FOTO REAL DO PRODUTO PRINCIPAL.

${
  temDetalheTecnico
    ? `A SEGUNDA IMAGEM enviada é uma FOTO DE DETALHE DA MESMA PEÇA.
Ela pode mostrar conector, terminais, pinos, fios, ponta, furos, encaixe, rosca ou outro detalhe técnico.
NÃO trate essa segunda imagem como um segundo produto.`
    : "Nenhuma foto técnica adicional foi enviada."
}

${
  temLogo
    ? temDetalheTecnico
      ? "A TERCEIRA IMAGEM enviada é o LOGOTIPO REAL DA EMPRESA."
      : "A SEGUNDA IMAGEM enviada é o LOGOTIPO REAL DA EMPRESA."
    : "Nenhum logotipo foi enviado."
}

OBJETIVO:
Criar uma imagem quadrada técnica, extremamente limpa, profissional e fácil de conferir antes da compra.

FORMATO VISUAL:
- quadrado;
- composição equivalente a 1200x1200;
- fundo branco;
- iluminação de estúdio limpa;
- aparência de catálogo técnico automotivo;
- produto principal grande e centralizado;
- informações técnicas organizadas ao redor da peça;
- excelente legibilidade;
- bastante espaço visual;
- sem poluição.

INFORMAÇÕES FORNECIDAS PELO USUÁRIO:
${pedido || "Sem informações técnicas adicionais."}

REGRAS ABSOLUTAS SOBRE O PRODUTO:
- Preserve fielmente a peça real enviada.
- NÃO mudar formato físico.
- NÃO alterar quantidade de fios.
- NÃO alterar quantidade de pinos.
- NÃO inventar furos.
- NÃO inventar conectores.
- NÃO inventar terminais.
- NÃO inventar roscas.
- NÃO inventar encaixes.
- NÃO inventar códigos.
- NÃO inventar medidas.
- NÃO inventar especificações.
- NÃO inventar aplicações.
- Se uma informação não foi fornecida ou não é claramente visível, simplesmente não mostrar.
- É melhor omitir uma informação do que apresentar uma informação técnica incorreta.

FOTO DE DETALHE:
${
  temDetalheTecnico
    ? `- Usar a segunda foto somente como ampliação visual da mesma peça.
- Pode criar um quadro circular ou retangular de detalhe.
- Pode usar uma linha discreta apontando do produto principal para o detalhe.
- Preservar exatamente o conector, terminal, ponta, furos ou encaixe mostrado na foto.
- NÃO duplicar a peça como se fossem dois produtos.`
    : "- Não criar detalhe técnico que não esteja visível na foto principal."
}

TEXTOS:
- Mostrar somente as informações técnicas realmente fornecidas pelo usuário.
- Textos curtos.
- Tipografia limpa e profissional.
- Alta legibilidade.
- Não criar frases promocionais.

NÃO MOSTRAR:
- preço;
- promoção;
- desconto;
- telefone;
- WhatsApp;
- e-mail;
- endereço;
- CTA comercial;
- “compre agora”;
- “oferta”;
- “pronta entrega”;
- aplicações não informadas.

LOGOTIPO:
${
  temLogo
    ? `- Usar o logotipo enviado de forma pequena e discreta.
- Preservar identidade, proporção e cores.
- O logotipo nunca deve competir visualmente com a peça.`
    : "- Não inventar logotipo nem nome de empresa."
}

RESULTADO:
Uma imagem técnica automotiva profissional, limpa e confiável, pronta para complementar as fotos de um anúncio do Mercado Livre.
`;
  }

  /*
   * =========================================
   * BANNER EXPRESS NORMAL
   * =========================================
   */

  const preco =
    extrairPreco(
      pedido
    );

  const direcoes = [
    "composição diagonal dinâmica, profundidade cinematográfica, feixes de luz e energia visual",
    "campanha automotiva premium com fundo tecnológico, luz de recorte e grande impacto no feed",
    "composição comercial vibrante, painéis geométricos, iluminação de estúdio e sensação de velocidade",
    "direção de arte moderna com contraste alto, halo luminoso, textura automotiva e acabamento publicitário sofisticado",
  ];

  const direcao =
    direcoes[
      Math.abs(
        variacao || 0
      ) %
        direcoes.length
    ];

  return `
Crie um BANNER PUBLICITÁRIO AUTOMOTIVO COMPLETO, profissional, moderno, vibrante e comercial.

A PRIMEIRA IMAGEM enviada é a FOTO REAL DO PRODUTO.

${
  temLogo
    ? "A SEGUNDA IMAGEM enviada é o LOGOTIPO REAL DA EMPRESA."
    : "Nenhum logotipo foi enviado."
}

MISSÃO:
Transformar a foto real do produto em uma campanha publicitária de autopeças com direção de arte comparável a um anúncio profissional criado por designer experiente.

MODELO ESCOLHIDO:
${dadosModelo.nome}

OBJETIVO DO MODELO:
${dadosModelo.objetivo}

FORMATO:
${dadosFormato.nome}, orientação ${dadosFormato.orientacao}.

PALETA BASE:
${dadosPaleta.nome}: ${dadosPaleta.descricao}.

DIREÇÃO DE ARTE:
${direcao}.

INFORMAÇÕES ADICIONAIS DO USUÁRIO:
${pedido || "Sem informações adicionais."}

TEXTOS PRINCIPAIS:
- Headline sugerida: "${dadosModelo.headline}"
- Apoio sugerido: "${dadosModelo.apoio}"
${
  preco
    ? `- PREÇO EXATO OBRIGATÓRIO: "${preco}"`
    : "- Não há preço informado. NÃO invente preço."
}

REGRAS IMPORTANTES SOBRE A FOTO DO PRODUTO:
- Preserve fielmente o produto fornecido.
- Não trocar o modelo da peça.
- Não inventar conectores, fios, pinos ou componentes.
- Não modificar formato, cor funcional ou detalhes técnicos importantes.
- Remover visualmente o fundo original quando necessário.
- Integrar a peça ao cenário com iluminação, sombra e profundidade profissionais.
- O produto deve ser protagonista e ocupar aproximadamente 40% a 60% da composição.
- Não criar outro produto diferente do original.

REGRAS IMPORTANTES SOBRE O LOGOTIPO:
${
  temLogo
    ? `- Usar o logotipo enviado como referência visual.
- Preservar ao máximo desenho, proporção, cores e identidade.
- Colocar o logo em posição premium, sem competir com produto e preço.
- NÃO inventar outro nome de empresa.`
    : "- Não inventar logotipo ou nome de empresa."
}

REGRAS DE TEXTO:
- Pouco texto.
- Headline forte, curta e fácil de ler.
- Tipografia publicitária robusta e moderna.
- Hierarquia clara: produto + headline + preço (quando houver) + CTA.
- Se houver preço, escrevê-lo EXATAMENTE como informado.
- NÃO inventar descontos.
- NÃO inventar telefone.
- NÃO inventar endereço.
- NÃO inventar site.
- NÃO inventar garantia.
- NÃO inventar especificações técnicas.
- NÃO inventar aplicações automotivas.
- NÃO inventar benefícios técnicos que o usuário não informou.

ESTILO:
- impacto visual alto;
- profissional;
- vibrante;
- sofisticado;
- automotivo;
- contraste forte;
- profundidade;
- luzes de recorte;
- textura técnica discreta;
- painéis geométricos modernos;
- acabamento de campanha de rede social;
- visual limpo, sem poluição;
- não parecer template genérico.

CTA:
Escolha apenas UMA chamada curta coerente com o modelo, como:
"APROVEITE AGORA"
"CONSULTE APLICAÇÕES"
"FALE COM A GENTE"
"PRONTA ENTREGA"

IMPORTANTE:
O resultado final deve ser uma ARTE PUBLICITÁRIA COMPLETA.
Não gere apenas um fundo.
Não gere mockup.
Não gere quadro em branco.
Não escreva explicações fora do banner.
`;
}
async function fonteParaBlob(
  fonte: string,
  nomePadrao: string
) {
  const valor =
    String(fonte || "")
      .trim();

  if (!valor) {
    throw new Error(
      `Imagem ausente: ${nomePadrao}`
    );
  }

  if (
    valor.startsWith(
      "data:"
    )
  ) {
    const match =
      valor.match(
        /^data:([^;]+);base64,(.+)$/s
      );

    if (!match) {
      throw new Error(
        `Data URL inválida: ${nomePadrao}`
      );
    }

    const mime =
      match[1] ||
      "image/png";

    const binario =
      atob(match[2]);

    const bytes =
      new Uint8Array(
        binario.length
      );

    for (
      let i = 0;
      i < binario.length;
      i += 1
    ) {
      bytes[i] =
        binario.charCodeAt(i);
    }

    return new File(
      [bytes],
      nomePadrao,
      {
        type: mime,
      }
    );
  }

  if (
    valor.startsWith(
      "http://"
    ) ||
    valor.startsWith(
      "https://"
    )
  ) {
    const resposta =
      await fetch(
        valor
      );

    if (!resposta.ok) {
      throw new Error(
        `Não foi possível baixar ${nomePadrao}.`
      );
    }

    const blob =
      await resposta.blob();

    return new File(
      [blob],
      nomePadrao,
      {
        type:
          blob.type ||
          "image/png",
      }
    );
  }

  throw new Error(
    `Formato de imagem não suportado: ${nomePadrao}`
  );
}

Deno.serve(
  async (req) => {
    if (
      req.method ===
      "OPTIONS"
    ) {
      return new Response(
        "ok",
        {
          headers:
            corsHeaders,
        }
      );
    }

    if (
      req.method !== "POST"
    ) {
      return json(
        {
          sucesso: false,
          erro:
            "Método não permitido.",
        },
        405
      );
    }

    try {
      const apiKey =
        Deno.env.get(
          "OPENAI_API_KEY"
        );

      if (!apiKey) {
        return json({
          sucesso: false,
          origem:
            "supabase",
          erro:
            "OPENAI_API_KEY não configurada no Supabase.",
          codigo:
            "missing_openai_api_key",
        });
      }

      const body =
        await req.json();

      const descricao =
        String(
          body?.descricao ||
            ""
        );

      const paleta =
        String(
          body?.paleta ||
            "azul"
        );

      const formato =
        String(
          body?.formato ||
            "facebook"
        );

      const variacao =
        Number(
          body?.variacao || 0
        );

      const modelo =
        String(
          body?.modelo ||
            "produto"
        );

      const imagemProduto =
  String(
    body?.imagemProduto ||
      body?.imagem ||
      ""
  );

const imagemDetalheTecnico =
  String(
    body?.imagemDetalheTecnico ||
      ""
  );

const logo =
  String(
    body?.logo ||
      ""
  );

      if (
        !imagemProduto
      ) {
        return json({
          sucesso: false,
          origem:
            "banner-ia",
          erro:
            "A foto do produto é obrigatória.",
          codigo:
            "missing_product_image",
        });
      }

      const dadosFormato =
        normalizarFormato(
          formato
        );

      const prompt =
        montarPrompt({
          descricao,
          paleta,
          formato,
          variacao,
          modelo,
          temLogo:
            Boolean(logo),
          temDetalheTecnico:
            Boolean(
              imagemDetalheTecnico
            ),
        });

      console.log(
        "🎨 APPIA BANNER COMPLETO:",
        {
          formato:
            dadosFormato.nome,
          size:
            dadosFormato.size,
          modelo,
          paleta,
          variacao,
          temLogo:
            Boolean(logo),
          temDetalheTecnico:
            Boolean(
              imagemDetalheTecnico
            ),
          temPreco:
            Boolean(
              extrairPreco(
                descricao
              )
            ),
        }
      );

      const produtoArquivo =
  await fonteParaBlob(
    imagemProduto,
    "produto.png"
  );

let detalheTecnicoArquivo:
  File | null =
  null;

if (
  imagemDetalheTecnico
) {
  detalheTecnicoArquivo =
    await fonteParaBlob(
      imagemDetalheTecnico,
      "detalhe-tecnico.png"
    );
}

let logoArquivo:
  File | null =
  null;

      if (logo) {
        logoArquivo =
          await fonteParaBlob(
            logo,
            "logo.png"
          );
      }

      const form =
        new FormData();

      form.append(
        "model",
        "gpt-image-2"
      );

      form.append(
        "prompt",
        prompt
      );

      form.append(
        "size",
        dadosFormato.size
      );

      form.append(
        "quality",
        "high"
      );

      form.append(
        "output_format",
        "png"
      );

      form.append(
        "image[]",
        produtoArquivo,
        produtoArquivo.name
      );

      if (
        detalheTecnicoArquivo
      ) {
        form.append(
          "image[]",
          detalheTecnicoArquivo,
          detalheTecnicoArquivo.name
        );
      }

      if (
        logoArquivo
      ) {
        form.append(
          "image[]",
          logoArquivo,
          logoArquivo.name
        );
      }

      const resposta =
        await fetch(
          "https://api.openai.com/v1/images/edits",
          {
            method: "POST",
            headers: {
              Authorization:
                `Bearer ${apiKey}`,
            },
            body:
              form,
          }
        );

      const dados =
        await resposta.json();

      if (
        !resposta.ok
      ) {
        console.error(
          "❌ OPENAI BANNER COMPLETO:",
          dados
        );

        return json({
          sucesso: false,
          origem:
            "openai",
          statusOpenAI:
            resposta.status,
          erro:
            dados?.error
              ?.message ||
            "Falha ao criar o banner completo.",
          codigo:
            dados?.error
              ?.code ||
            null,
          tipo:
            dados?.error
              ?.type ||
            null,
          parametro:
            dados?.error
              ?.param ||
            null,
          detalhe:
            dados?.error ||
            dados,
        });
      }

      const imagemBase64 =
        dados?.data?.[0]
          ?.b64_json;

      if (
        !imagemBase64
      ) {
        console.error(
          "❌ SEM IMAGEM:",
          dados
        );

        return json({
          sucesso: false,
          origem:
            "openai",
          erro:
            "A IA respondeu, mas não retornou a arte do banner.",
          detalhe:
            dados,
        });
      }

      const dataUrl =
        `data:image/png;base64,${imagemBase64}`;

      return json({
        sucesso: true,
        imagem:
          dataUrl,
        arteCompleta:
          true,
        formato:
          dadosFormato.nome,
        size:
          dadosFormato.size,
        modelo:
          normalizarModelo(
            modelo
          ).nome,
        paleta:
          normalizarPaleta(
            paleta
          ).nome,
        preco:
          extrairPreco(
            descricao
          ),
        variacao,
      });
    } catch (erro) {
      console.error(
        "❌ BANNER IA:",
        erro
      );

      return json({
        sucesso: false,
        origem:
          "banner-ia",
        erro:
          erro instanceof
          Error
            ? erro.message
            : "Erro inesperado ao gerar banner.",
      });
    }
  }
);