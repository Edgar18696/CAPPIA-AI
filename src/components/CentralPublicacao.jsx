import { useMemo, useState } from "react";
import Button from "./ui/Button";
import { supabase } from "../supabase";

function formatarMoeda(valor) {
  if (
    typeof valor === "number" &&
    Number.isFinite(valor)
  ) {
    return valor.toLocaleString(
      "pt-BR",
      {
        style: "currency",
        currency: "BRL",
      }
    );
  }

  const texto =
    String(valor ?? "").trim();

  if (!texto) {
    return "R$ 0,00";
  }

  const normalizado =
    texto.includes(",")
      ? texto
          .replace(/\./g, "")
          .replace(",", ".")
      : texto;

  const numero =
    Number(normalizado);

  if (!Number.isFinite(numero)) {
    return "R$ 0,00";
  }

  return numero.toLocaleString(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL",
    }
  );
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

function montarCompatibilidades(
  pecaEncontrada
) {
  const aplicacoes =
    Array.isArray(
      pecaEncontrada?.aplicacoes
    )
      ? pecaEncontrada.aplicacoes
      : [];

  return aplicacoes
    .map((item) => {
      const anoInicio =
        item?.ano_inicio ||
        item?.anoInicial ||
        item?.ano_de ||
        "";

      const anoFim =
        item?.ano_fim ||
        item?.anoFinal ||
        item?.ano_ate ||
        "";

      let anos = "";

      if (anoInicio && anoFim) {
        anos =
          `${anoInicio} a ${anoFim}`;
      } else {
        anos =
          anoInicio ||
          anoFim ||
          "";
      }

      return [
        item?.montadora,
        item?.modelo,
        item?.motor,
        anos,
        item?.combustivel,
      ]
        .filter(Boolean)
        .join(" ");
    })
    .filter(Boolean)
    .join("\n");
}

function obterFabricante(
  pecaEncontrada
) {
  return (
    pecaEncontrada?.fabricante ||
    pecaEncontrada?.marca ||
    pecaEncontrada?.brand ||
    ""
  );
}


function normalizarPrecoParaWoo(valor) {
  if (
    typeof valor === "number" &&
    Number.isFinite(valor)
  ) {
    return valor.toFixed(2);
  }

  const texto = String(valor ?? "")
    .replace(/R\$/gi, "")
    .replace(/\s/g, "")
    .trim();

  if (!texto) {
    return "";
  }

  const normalizado =
    texto.includes(",")
      ? texto
          .replace(/\./g, "")
          .replace(",", ".")
      : texto;

  const numero =
    Number(
      normalizado.replace(
        /[^\d.-]/g,
        ""
      )
    );

  return Number.isFinite(numero)
    ? numero.toFixed(2)
    : "";
}

function obterAplicacoes(
  pecaEncontrada
) {
  return Array.isArray(
    pecaEncontrada?.aplicacoes
  )
    ? pecaEncontrada.aplicacoes
    : [];
}

function valoresUnicos(
  valores = []
) {
  return [
    ...new Set(
      valores
        .map((valor) =>
          String(valor || "").trim()
        )
        .filter(Boolean)
    ),
  ];
}

function montarDadosWooCommerce(
  anuncio,
  titulo
) {
  const pecaEncontrada =
    anuncio?.pecaEncontrada ||
    null;

  const diagnostico =
    anuncio?.diagnostico ||
    null;

  const aplicacoes =
    obterAplicacoes(
      pecaEncontrada
    );

  const fabricante =
    String(
      pecaEncontrada?.fabricante ||
      pecaEncontrada?.marca ||
      diagnostico?.fabricante ||
      ""
    ).trim();

  const nomePeca =
    String(
      pecaEncontrada?.peca ||
      diagnostico?.peca ||
      titulo ||
      ""
    ).trim();

  const montadoras =
    valoresUnicos(
      aplicacoes.map(
        (item) =>
          item?.montadora
      )
    );

  const modelos =
    valoresUnicos(
      aplicacoes.map(
        (item) =>
          item?.modelo ||
          item?.veiculo
      )
    );

  const motores =
    valoresUnicos(
      aplicacoes.map(
        (item) =>
          item?.motor
      )
    );

  const codigos = valoresUnicos([
    anuncio?.codigo,
    anuncio?.oem,
    pecaEncontrada?.codigo_oem,
    pecaEncontrada?.codigo_equivalente,
  ]);

  const breveDescricao =
    [
      nomePeca,
      fabricante
        ? `Marca/Fabricante: ${fabricante}.`
        : "",
      montadoras.length
        ? `Aplicações: ${montadoras
            .slice(0, 4)
            .join(", ")}.`
        : "",
      codigos.length
        ? `Código: ${codigos[0]}.`
        : "",
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

  const categoria =
    String(
      pecaEncontrada?.categoria ||
      pecaEncontrada?.familia ||
      diagnostico?.categoria ||
      diagnostico?.familia ||
      nomePeca ||
      "Peças Automotivas"
    ).trim();

  const tags =
    valoresUnicos([
      ...codigos,
      fabricante,
      nomePeca,
      ...montadoras,
      ...modelos.slice(0, 8),
      ...motores.slice(0, 5),
    ]).slice(0, 20);

  return {
    breveDescricao,
    categoria,
    tags,
    fabricante,
    montadoras,
    modelos,
    motores,
    aplicacoes,
  };
}

export default function CentralPublicacao({
  cardStyle,
  setScreen,
}) {
  const anuncio = useMemo(() => {
    try {
      const salvo =
        localStorage.getItem(
          "anuncioProntoPublicacao"
        );

      return salvo
        ? JSON.parse(salvo)
        : null;
    } catch (erro) {
      console.error(
        "Erro ao recuperar anúncio pronto:",
        erro
      );

      return null;
    }
  }, []);

  const [tituloEditavel, setTituloEditavel] =
    useState(() =>
      String(anuncio?.titulo || "").slice(0, 60)
    );

  const [publicandoWoo, setPublicandoWoo] =
    useState(false);

  function atualizarTitulo(valor) {
    const novoTitulo =
      String(valor || "").slice(0, 60);

    setTituloEditavel(novoTitulo);

    if (!anuncio) {
      return;
    }

    const anuncioAtualizado = {
      ...anuncio,
      titulo: novoTitulo,
    };

    localStorage.setItem(
      "anuncioProntoPublicacao",
      JSON.stringify(anuncioAtualizado)
    );
  }

  const fotos =
    Array.isArray(anuncio?.fotos)
      ? anuncio.fotos
      : [];

  const fotoPrincipal =
    obterUrlFoto(fotos[0]);

  function abrirSimuladorMercadoLivre() {
    const pecaEncontrada =
      anuncio?.pecaEncontrada ||
      null;

    const aplicacoes =
      Array.isArray(
        pecaEncontrada?.aplicacoes
      )
        ? pecaEncontrada.aplicacoes
        : [];

    const compatibilidades =
      montarCompatibilidades(
        pecaEncontrada
      );

    const fabricante =
      obterFabricante(
        pecaEncontrada
      );

    const fotosCompletas = [
      ...(Array.isArray(
        anuncio?.fotos
      )
        ? anuncio.fotos
        : []),
      ...(Array.isArray(
        anuncio?.banners
      )
        ? anuncio.banners
        : []),
    ];

    const fotosUrls =
      fotosCompletas
        .map(obterUrlFoto)
        .filter(Boolean);

    const bannersUrls =
      (Array.isArray(
        anuncio?.banners
      )
        ? anuncio.banners
        : [])
        .map(obterUrlFoto)
        .filter(Boolean);

    const clips =
      Array.isArray(
        anuncio?.clips
      )
        ? anuncio.clips
        : [];

    const videos =
      clips.length > 0
        ? clips
        : anuncio?.clip
          ? [anuncio.clip]
          : [];

    /*
     * Mantém o anúncio COMPLETO somente em memória.
     * Assim fotos, banners e aplicações não estouram
     * a quota do localStorage.
     */
    window.__paiiaAnuncioSimulador = {
      codigo:
        anuncio?.codigo || "",

      oem:
        anuncio?.oem || "",

      titulo:
        tituloEditavel || "",

      descricao:
        anuncio?.descricao || "",

      preco:
        anuncio?.preco || "",

      tipoAnuncio:
        anuncio?.tipoAnuncio ||
        "classico",

      fotos:
        fotosCompletas,

      imagens:
        fotosCompletas,

      banners:
        Array.isArray(
          anuncio?.banners
        )
          ? anuncio.banners
          : [],

      clip:
        anuncio?.clip || "",

      clips,

      videos,

      pecaEncontrada,

      fabricante,

      marca:
        fabricante,

      aplicacoes,

      compatibilidades,

      totalCompatibilidades:
        aplicacoes.length,

      status:
        "rascunho_teste",
    };

    localStorage.setItem(
      "mlModoTeste",
      "true"
    );

    /*
     * localStorage recebe SOMENTE uma versão leve.
     * Fotos são reduzidas às URLs e o objeto técnico
     * é reduzido aos campos usados pelo simulador.
     */
    const pecaEncontradaLeve =
      pecaEncontrada
        ? {
            peca:
              pecaEncontrada?.peca ||
              "",
            familia:
              pecaEncontrada?.familia ||
              "",
            fabricante:
              pecaEncontrada?.fabricante ||
              pecaEncontrada?.marca ||
              "",
            marca:
              pecaEncontrada?.marca ||
              pecaEncontrada?.fabricante ||
              "",
            codigo_oem:
              pecaEncontrada?.codigo_oem ||
              "",
            codigo_equivalente:
              pecaEncontrada?.codigo_equivalente ||
              "",
            aplicacoes,
          }
        : null;

    const anuncioLeve = {
      codigo:
        anuncio?.codigo || "",

      oem:
        anuncio?.oem || "",

      titulo:
        tituloEditavel || "",

      descricao:
        anuncio?.descricao || "",

      preco:
        anuncio?.preco || "",

      tipoAnuncio:
        anuncio?.tipoAnuncio ||
        "classico",

      fotos:
        fotosUrls,

      imagens:
        fotosUrls,

      banners:
        bannersUrls,

      clip:
        anuncio?.clip || "",

      clips,

      videos,

      pecaEncontrada:
        pecaEncontradaLeve,

      fabricante,

      marca:
        fabricante,

      aplicacoes,

      compatibilidades,

      totalCompatibilidades:
        aplicacoes.length,

      status:
        "rascunho_teste",
    };

    try {
      localStorage.setItem(
        "mlAnuncioTeste",
        JSON.stringify(
          anuncioLeve
        )
      );
    } catch (erroStorage) {
      console.warn(
        "mlAnuncioTeste não coube no localStorage. O simulador usará a cópia em memória.",
        erroStorage
      );

      /*
       * Último fallback: salva apenas os campos essenciais.
       * O anúncio completo continua disponível em
       * window.__paiiaAnuncioSimulador.
       */
      try {
        localStorage.setItem(
          "mlAnuncioTeste",
          JSON.stringify({
            codigo:
              anuncio?.codigo || "",
            oem:
              anuncio?.oem || "",
            titulo:
              tituloEditavel || "",
            descricao:
              anuncio?.descricao || "",
            preco:
              anuncio?.preco || "",
            tipoAnuncio:
              anuncio?.tipoAnuncio ||
              "classico",
            fotos:
              fotosUrls,
            imagens:
              fotosUrls,
            banners:
              bannersUrls,
            fabricante,
            marca:
              fabricante,
            compatibilidades,
            totalCompatibilidades:
              aplicacoes.length,
            status:
              "rascunho_teste",
          })
        );
      } catch (erroStorageMinimo) {
        console.warn(
          "Não foi possível salvar nem a versão mínima do simulador no localStorage.",
          erroStorageMinimo
        );
      }
    }

    if (
      typeof setScreen !==
      "function"
    ) {
      console.error(
        "CentralPublicacao: setScreen não foi recebido."
      );

      alert(
        "Não foi possível abrir o simulador."
      );

      return;
    }

    setScreen(
      "mercadoLivreTeste"
    );
  }

  function voltarAnuncio() {
    if (anuncio) {
      const dadosRetorno = {
        codigo: anuncio?.codigo || "",
        oem: anuncio?.oem || "",
        titulo: tituloEditavel || anuncio?.titulo || "",
        descricao: anuncio?.descricao || "",
        preco: anuncio?.preco || "",
        tipoAnuncio:
          anuncio?.tipoAnuncio || "classico",
        pecaEncontrada:
          anuncio?.pecaEncontrada || null,
        diagnostico:
          anuncio?.diagnostico || null,
        auditoria:
          anuncio?.auditoria || null,
        fotos:
          Array.isArray(anuncio?.fotos)
            ? anuncio.fotos
            : [],
        banners:
          Array.isArray(anuncio?.banners)
            ? anuncio.banners
            : [],
        clip: anuncio?.clip || "",
        clips:
          Array.isArray(anuncio?.clips)
            ? anuncio.clips
            : [],
      };

      localStorage.setItem(
        "novoAnuncioTemporario",
        JSON.stringify(dadosRetorno)
      );

      localStorage.setItem(
        "rascunhoNovoAnuncioTemp",
        JSON.stringify(dadosRetorno)
      );
    }

    setScreen?.(
      "novoAnuncio"
    );
  }

  async function enviarCasaDaInjecao() {
    if (publicandoWoo) {
      return;
    }

    const titulo =
      String(
        tituloEditavel ||
        anuncio?.titulo ||
        ""
      ).trim();

    if (!titulo) {
      alert(
        "Informe o título do anúncio antes de enviar para a Casa da Injeção."
      );
      return;
    }

    const dadosWoo =
      montarDadosWooCommerce(
        anuncio,
        titulo
      );

    const precoWoo =
      normalizarPrecoParaWoo(
        anuncio?.preco
      );

    if (!precoWoo) {
      alert(
        "O preço do anúncio não é válido para envio ao site."
      );
      return;
    }

    const imagens = [
      ...(Array.isArray(anuncio?.fotos)
        ? anuncio.fotos
        : []),
      ...(Array.isArray(anuncio?.banners)
        ? anuncio.banners
        : []),
    ]
      .map(obterUrlFoto)
      .filter((url) =>
        String(url || "")
          .trim()
          .startsWith("https://")
      );

    setPublicandoWoo(true);

    try {
      const {
        data: resultado,
        error,
      } =
        await supabase.functions.invoke(
          "publicar-woocommerce",
          {
            body: {
              titulo,

              descricao:
                anuncio?.descricao || "",

              breve_descricao:
                dadosWoo.breveDescricao,

              codigo:
                anuncio?.codigo ||
                anuncio?.oem ||
                "",

              oem:
                anuncio?.oem || "",

              sku:
                anuncio?.codigo ||
                anuncio?.oem ||
                "",

              preco:
                precoWoo,

              estoque:
                Number(
                  anuncio?.estoque ?? 0
                ) || 0,

              imagens,

              categoria:
                dadosWoo.categoria,

              tags:
                dadosWoo.tags,

              fabricante:
                dadosWoo.fabricante,

              montadoras:
                dadosWoo.montadoras,

              modelos:
                dadosWoo.modelos,

              motores:
                dadosWoo.motores,

              aplicacoes:
                dadosWoo.aplicacoes,
            },
          }
        );

      if (error) {
        throw new Error(
          error?.message ||
          "A função publicar-woocommerce não respondeu."
        );
      }

      if (!resultado?.sucesso) {
        throw new Error(
          resultado?.erro ||
          "Não foi possível enviar o produto para o WooCommerce."
        );
      }

      alert(
        `✅ Produto enviado para a Casa da Injeção como RASCUNHO.\n\nID WooCommerce: ${resultado?.produto?.id || "-"}`
      );
    } catch (erro) {
      console.error(
        "Erro ao enviar para WooCommerce:",
        erro
      );

      alert(
        erro instanceof Error
          ? erro.message
          : "Erro ao enviar produto para a Casa da Injeção."
      );
    } finally {
      setPublicandoWoo(false);
    }
  }

  function abrirRevisaoSite() {
    localStorage.setItem(
      "siteAnuncioRevisao",
      JSON.stringify({
        ...anuncio,
        titulo:
          tituloEditavel ||
          anuncio?.titulo ||
          "",
      })
    );

    setScreen?.(
  "publicacaoSite"
);
  }

  function abrirContas() {
    setScreen?.(
      "contasMarketplace"
    );
  }

  if (!anuncio) {
    return (
      <div
        style={{
          width: "100%",
          maxWidth: "1180px",
          margin: "30px auto 0",
        }}
      >
        <section
          style={{
            ...cardStyle,

            padding: "30px",

            borderRadius:
              "18px",

            border:
              "1px solid #334155",

            background:
              "#0f172a",

            textAlign:
              "center",
          }}
        >
          <div
            style={{
              fontSize: "46px",
              marginBottom:
                "10px",
            }}
          >
            📤
          </div>

          <h2
            style={{
              color: "#67e8f9",

              margin:
                "0 0 10px 0",
            }}
          >
            Central de Publicação
          </h2>

          <p
            style={{
              color: "#94a3b8",

              marginBottom:
                "20px",
            }}
          >
            Nenhum anúncio pronto para
            publicação foi encontrado.
          </p>

          <Button
            type="button"
            variant="gray"
            onClick={voltarAnuncio}
          >
            ⬅ Voltar ao Anúncio
          </Button>
        </section>
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "1180px",
        margin: "30px auto 0",
      }}
    >
      <section
        style={{
          ...cardStyle,

          padding: "28px",

          borderRadius:
            "18px",

          border:
            "1px solid #22c55e",

          background:
            "linear-gradient(135deg,#052e16,#0f172a)",

          textAlign:
            "center",
        }}
      >
        <div
          style={{
            fontSize: "48px",
          }}
        >
          🚀
        </div>

        <h2
          style={{
            color: "#86efac",

            margin:
              "8px 0 6px 0",

            fontSize: "30px",
          }}
        >
          Anúncio pronto para publicação
        </h2>

        <p
          style={{
            color: "#bbf7d0",

            margin: 0,

            fontSize: "14px",
          }}
        >
          Revise os dados abaixo e escolha
          onde deseja publicar.
        </p>
      </section>

      <section style={blocoStyle}>
        <div
          style={{
            textAlign:
              "center",

            marginBottom:
              "18px",
          }}
        >
          <h3
            style={{
              ...tituloBloco,

              marginBottom:
                "6px",
            }}
          >
            🛒 Canais de Publicação
          </h3>

          <p
            style={{
              color:
                "#94a3b8",

              margin:
                0,

              fontSize:
                "13px",
            }}
          >
            As integrações oficiais serão
            conectadas às contas do usuário.
          </p>
        </div>

        <div style={gradeMarketplaces}>
          <MarketplaceCard
            icone="🟡"
            titulo="Mercado Livre"
            descricao="Teste todo o processo antes de conectar sua conta real."
            onClick={
              abrirSimuladorMercadoLivre
            }
            textoBotao="🧪 Testar Publicação"
          />

          <MarketplaceCard
            icone="🟠"
            titulo="Shopee"
            descricao="Publicação automática na Shopee."
            onClick={
              abrirContas
            }
          />

          <MarketplaceCard
            icone="🔵"
            titulo="Amazon"
            descricao="Publicação automática na Amazon."
            onClick={
              abrirContas
            }
          />

          <MarketplaceCard
            icone="🌐"
            titulo="Casa da Injeção"
            descricao="Envia este anúncio para o WooCommerce como rascunho para revisão."
            onClick={
              abrirRevisaoSite
            }
            textoBotao={
              "🌐 Revisar Anúncio do Site"
            }
          />
        </div>
      </section>

      <section
        style={{
          ...blocoStyle,

          border:
            "1px solid #2563eb",

          background:
            "linear-gradient(135deg,#172554,#0f172a)",
        }}
      >
        <div
          style={{
            textAlign:
              "center",
          }}
        >
          <div
            style={{
              fontSize:
                "38px",

              marginBottom:
                "8px",
            }}
          >
            🤖
          </div>

          <h3
            style={{
              color:
                "#67e8f9",

              margin:
                "0 0 8px 0",
            }}
          >
            Paizinho PAIIA
          </h3>

          <p
            style={{
              color:
                "#bfdbfe",

              margin:
                "0 auto",

              maxWidth:
                "760px",

              lineHeight:
                1.6,
            }}
          >
            O anúncio está pronto. Antes da
            conexão real com os marketplaces,
            você pode validar o fluxo completo
            usando o simulador.
          </p>
        </div>
      </section>

      <section
        style={{
          ...blocoStyle,

          textAlign:
            "center",
        }}
      >
        <div
          style={{
            display:
              "flex",

            justifyContent:
              "center",

            gap:
              "12px",

            flexWrap:
              "wrap",
          }}
        >
          <Button
            type="button"
            variant="gray"
            onClick={voltarAnuncio}
          >
            ⬅ Voltar ao Anúncio
          </Button>

          <button
            type="button"
            onClick={
              abrirContas
            }
            style={
              botaoSecundario
            }
          >
            🔗 Contas Marketplace
          </button>

        </div>
      </section>
    </div>
  );
}

function MarketplaceCard({
  icone,
  titulo,
  descricao,
  onClick,
  textoBotao =
    "🔗 Conectar conta",
  desabilitado = false,
}) {
  return (
    <div style={marketplaceCard}>
      <div
        style={{
          fontSize:
            "34px",
        }}
      >
        {icone}
      </div>

      <strong
        style={{
          color:
            "#ffffff",

          fontSize:
            "17px",
        }}
      >
        {titulo}
      </strong>

      <span
        style={{
          color:
            "#94a3b8",

          fontSize:
            "12px",

          lineHeight:
            1.5,

          textAlign:
            "center",
        }}
      >
        {descricao}
      </span>

      <span
        style={{
          color:
            "#facc15",

          fontSize:
            "11px",

          fontWeight:
            "bold",
        }}
      >
        🧪 Modo seguro
      </span>

      <button
        type="button"
        onClick={onClick}
        disabled={desabilitado}
        style={{
          ...botaoMarketplace,
          opacity:
            desabilitado
              ? 0.65
              : 1,
          cursor:
            desabilitado
              ? "not-allowed"
              : "pointer",
        }}
      >
        {textoBotao}
      </button>
    </div>
  );
}

const blocoStyle = {
  marginTop: "20px",

  padding: "22px",

  borderRadius: "16px",

  background: "#0f172a",

  border:
    "1px solid #1e293b",
};

const tituloBloco = {
  color: "#67e8f9",

  marginTop: 0,

  marginBottom: "16px",
};

const resumoAnuncio = {
  display: "grid",

  gridTemplateColumns:
    "minmax(180px,260px) 1fr",

  gap: "20px",

  alignItems:
    "stretch",
};

const fotoBox = {
  minHeight: "220px",

  borderRadius: "14px",

  border:
    "1px solid #334155",

  background: "#ffffff",

  padding: "10px",

  display: "flex",

  alignItems: "center",

  justifyContent:
    "center",

  overflow: "hidden",
};

const dadosAnuncio = {
  display: "grid",

  gap: "10px",
};

const linhaInformacao = {
  padding:
    "12px 14px",

  borderRadius:
    "10px",

  background:
    "#020617",

  border:
    "1px solid #334155",

  color:
    "#cbd5e1",

  display:
    "flex",

  justifyContent:
    "space-between",

  gap:
    "20px",

  flexWrap:
    "wrap",
};

const campoTituloEditavel = {
  width: "100%",
  boxSizing: "border-box",
  padding: "11px 12px",
  borderRadius: "9px",
  border: "1px solid #38bdf8",
  background: "#020617",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: "bold",
  outline: "none",
};

const gradeMarketplaces = {
  display:
    "grid",

  gridTemplateColumns:
    "repeat(auto-fit,minmax(220px,1fr))",

  gap:
    "14px",
};

const marketplaceCard = {
  minHeight:
    "220px",

  padding:
    "18px",

  borderRadius:
    "14px",

  background:
    "#020617",

  border:
    "1px solid #334155",

  display:
    "flex",

  flexDirection:
    "column",

  justifyContent:
    "center",

  alignItems:
    "center",

  gap:
    "10px",
};

const botaoMarketplace = {
  marginTop:
    "5px",

  padding:
    "10px 15px",

  borderRadius:
    "10px",

  border:
    "1px solid #38bdf8",

  background:
    "#082f49",

  color:
    "#bae6fd",

  cursor:
    "pointer",

  fontWeight:
    "bold",
};

const botaoSecundario = {
  padding:
    "13px 20px",

  borderRadius:
    "11px",

  border:
    "1px solid #475569",

  background:
    "#020617",

  color:
    "#e2e8f0",

  cursor:
    "pointer",

  fontWeight:
    "bold",
};