import {
  memo,
  useMemo,
  useState,
} from "react";

const CATEGORIAS = [
  {
    id: "fundos",
    nome: "Fundos",
    icone: "🎨",
  },
  {
    id: "selos",
    nome: "Selos",
    icone: "⭐",
  },
  {
    id: "logos",
    nome: "Logos",
    icone: "🏭",
  },
  {
    id: "elementos",
    nome: "Elementos",
    icone: "✨",
  },
  {
    id: "uploads",
    nome: "Uploads",
    icone: "📂",
  },
];

const FUNDOS = [
  {
    id: "fundo-clean",
    nome: "Clean Branco",
    categoria: "Clean",
    valor:
      "linear-gradient(135deg,#ffffff 0%,#e2e8f0 100%)",
  },
  {
    id: "fundo-automotivo",
    nome: "Automotivo Azul",
    categoria: "Automotivo",
    valor:
      "linear-gradient(135deg,#0f172a 0%,#1d4ed8 55%,#22d3ee 100%)",
  },
  {
    id: "fundo-racing",
    nome: "Racing Vermelho",
    categoria: "Racing",
    valor:
      "linear-gradient(135deg,#111827 0%,#7f1d1d 52%,#ef4444 100%)",
  },
  {
    id: "fundo-carbono",
    nome: "Carbono",
    categoria: "Carbono",
    valor:
      "repeating-linear-gradient(45deg,#020617 0 12px,#111827 12px 24px)",
  },
  {
    id: "fundo-metal",
    nome: "Metal Prata",
    categoria: "Metal",
    valor:
      "linear-gradient(135deg,#f8fafc 0%,#94a3b8 48%,#e2e8f0 100%)",
  },
  {
    id: "fundo-marketplace",
    nome: "Marketplace",
    categoria: "Mercado Livre",
    valor:
      "linear-gradient(135deg,#facc15 0%,#fef08a 55%,#ffffff 100%)",
  },
  {
    id: "fundo-shopee",
    nome: "Shopee",
    categoria: "Shopee",
    valor:
      "linear-gradient(135deg,#f97316 0%,#fb923c 52%,#fff7ed 100%)",
  },
  {
    id: "fundo-instagram",
    nome: "Instagram",
    categoria: "Instagram",
    valor:
      "linear-gradient(135deg,#7c3aed 0%,#db2777 52%,#f97316 100%)",
  },
];

const SELOS = [
  {
    id: "selo-envio",
    nome: "Envio Imediato",
    texto: "🚚 ENVIO IMEDIATO",
    fundo: "#2563eb",
    cor: "#ffffff",
  },
  {
    id: "selo-premium",
    nome: "Produto Premium",
    texto: "⭐ PRODUTO PREMIUM",
    fundo: "#713f12",
    cor: "#fde68a",
  },
  {
    id: "selo-garantia",
    nome: "Garantia",
    texto: "🛡 GARANTIA",
    fundo: "#14532d",
    cor: "#dcfce7",
  },
  {
    id: "selo-original",
    nome: "Peça Original",
    texto: "🔧 PEÇA ORIGINAL",
    fundo: "#0f172a",
    cor: "#ffffff",
  },
  {
    id: "selo-qualidade",
    nome: "Alta Qualidade",
    texto: "💎 ALTA QUALIDADE",
    fundo: "#164e63",
    cor: "#cffafe",
  },
  {
    id: "selo-oferta",
    nome: "Oferta",
    texto: "⚡ OFERTA",
    fundo: "#b91c1c",
    cor: "#ffffff",
  },
  {
    id: "selo-promocao",
    nome: "Promoção",
    texto: "🔥 PROMOÇÃO",
    fundo: "#9a3412",
    cor: "#ffedd5",
  },
  {
    id: "selo-pronta-entrega",
    nome: "Pronta Entrega",
    texto: "📦 PRONTA ENTREGA",
    fundo: "#1d4ed8",
    cor: "#dbeafe",
  },
];

const LOGOS = [
  {
    id: "logo-torken",
    nome: "Torken",
    sigla: "TORKEN",
    fundo: "#06152f",
    cor: "#67e8f9",
  },
  {
    id: "logo-casa",
    nome: "Casa da Injeção",
    sigla: "CASA DA INJEÇÃO",
    fundo: "#0f172a",
    cor: "#ffffff",
  },
  {
    id: "logo-appia",
    nome: "APPIA AI",
    sigla: "APPIA AI",
    fundo: "#020617",
    cor: "#67e8f9",
  },
  {
    id: "logo-bosch",
    nome: "Bosch",
    sigla: "BOSCH",
    fundo: "#ffffff",
    cor: "#dc2626",
  },
  {
    id: "logo-marelli",
    nome: "Magneti Marelli",
    sigla: "MARELLI",
    fundo: "#111827",
    cor: "#ffffff",
  },
  {
    id: "logo-delphi",
    nome: "Delphi",
    sigla: "DELPHI",
    fundo: "#020617",
    cor: "#f43f5e",
  },
  {
    id: "logo-ngk",
    nome: "NGK",
    sigla: "NGK",
    fundo: "#ffffff",
    cor: "#dc2626",
  },
  {
    id: "logo-denso",
    nome: "Denso",
    sigla: "DENSO",
    fundo: "#ffffff",
    cor: "#b91c1c",
  },
];

const ELEMENTOS = [
  {
    id: "elemento-faixa",
    nome: "Faixa",
    icone: "🏷️",
    tipo: "faixa",
  },
  {
    id: "elemento-seta",
    nome: "Seta",
    icone: "➡️",
    tipo: "seta",
  },
  {
    id: "elemento-circulo",
    nome: "Círculo",
    icone: "⭕",
    tipo: "circulo",
  },
  {
    id: "elemento-quadrado",
    nome: "Quadrado",
    icone: "⬜",
    tipo: "quadrado",
  },
  {
    id: "elemento-estrela",
    nome: "Estrela",
    icone: "⭐",
    tipo: "estrela",
  },
  {
    id: "elemento-explosao",
    nome: "Explosão",
    icone: "💥",
    tipo: "explosao",
  },
  {
    id: "elemento-linha",
    nome: "Linha",
    icone: "➖",
    tipo: "linha",
  },
  {
    id: "elemento-marcador",
    nome: "Marcador",
    icone: "📍",
    tipo: "marcador",
  },
];

function BannerBiblioteca({
  onSelecionarFundo,
  onAdicionarSelo,
  onAdicionarLogo,
  onAdicionarElemento,
  onUpload,
}) {
  const [
    categoriaAtiva,
    setCategoriaAtiva,
  ] = useState("fundos");

  const [
    busca,
    setBusca,
  ] = useState("");

  const [
    favoritos,
    setFavoritos,
  ] = useState(() => {
    try {
      const salvo =
        localStorage.getItem(
          "bannerBibliotecaFavoritos"
        );

      return salvo
        ? JSON.parse(salvo)
        : [];
    } catch {
      return [];
    }
  });

  const itensAtivos =
    useMemo(() => {
      const termo = String(
        busca || ""
      )
        .toLowerCase()
        .trim();

      const mapa = {
        fundos: FUNDOS,
        selos: SELOS,
        logos: LOGOS,
        elementos: ELEMENTOS,
      };

      const lista =
        mapa[categoriaAtiva] || [];

      if (!termo) {
        return lista;
      }

      return lista.filter(
        (item) =>
          String(
            item.nome || ""
          )
            .toLowerCase()
            .includes(termo) ||
          String(
            item.categoria || ""
          )
            .toLowerCase()
            .includes(termo)
      );
    }, [
      categoriaAtiva,
      busca,
    ]);

  function alternarFavorito(id) {
    const atualizado =
      favoritos.includes(id)
        ? favoritos.filter(
            (item) => item !== id
          )
        : [...favoritos, id];

    setFavoritos(atualizado);

    localStorage.setItem(
      "bannerBibliotecaFavoritos",
      JSON.stringify(
        atualizado
      )
    );
  }

  function selecionarItem(item) {
    if (
      categoriaAtiva ===
      "fundos"
    ) {
      onSelecionarFundo?.(
        item.valor,
        item
      );
      return;
    }

    if (
      categoriaAtiva ===
      "selos"
    ) {
      onAdicionarSelo?.(item);
      return;
    }

    if (
      categoriaAtiva ===
      "logos"
    ) {
      onAdicionarLogo?.(item);
      return;
    }

    if (
      categoriaAtiva ===
      "elementos"
    ) {
      onAdicionarElemento?.(
        item
      );
    }
  }

  function importarArquivo(
    evento
  ) {
    const arquivo =
      evento.target.files?.[0];

    if (!arquivo) {
      return;
    }

    const tiposPermitidos = [
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/svg+xml",
    ];

    if (
      !tiposPermitidos.includes(
        arquivo.type
      )
    ) {
      alert(
        "Use PNG, JPG, WEBP ou SVG."
      );

      evento.target.value = "";
      return;
    }

    const leitor =
      new FileReader();

    leitor.onload = () => {
      onUpload?.({
        id: `upload-${Date.now()}`,
        nome: arquivo.name,
        tipo: arquivo.type,
        src: leitor.result,
      });
    };

    leitor.readAsDataURL(
      arquivo
    );

    evento.target.value = "";
  }

  return (
    <section
      data-nao-exportar="true"
      style={{
        padding: "16px",
        borderRadius: "16px",
        background: "#020617",
        border:
          "1px solid #334155",
        boxShadow:
          "0 16px 35px rgba(0,0,0,.24)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "center",
          gap: "10px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h3
            style={{
              margin: 0,
              color: "#67e8f9",
            }}
          >
            📚 Biblioteca Premium
          </h3>

          <p
            style={{
              margin:
                "5px 0 0",
              color: "#94a3b8",
              fontSize: "12px",
            }}
          >
            Fundos, selos, logos e elementos para banners profissionais.
          </p>
        </div>

        <label
          style={{
            padding:
              "10px 14px",
            borderRadius:
              "10px",
            border:
              "1px solid #2563eb",
            background:
              "#172554",
            color: "#dbeafe",
            cursor: "pointer",
            fontWeight: "bold",
            fontSize: "12px",
          }}
        >
          📂 Importar
          <input
            type="file"
            accept=".png,.jpg,.jpeg,.webp,.svg"
            onChange={
              importarArquivo
            }
            style={{
              display: "none",
            }}
          />
        </label>
      </div>

      <div
        style={{
          display: "flex",
          gap: "7px",
          flexWrap: "wrap",
          marginTop: "15px",
        }}
      >
        {CATEGORIAS.map(
          (categoria) => (
            <button
              key={categoria.id}
              type="button"
              onClick={() =>
                setCategoriaAtiva(
                  categoria.id
                )
              }
              style={{
                padding:
                  "9px 12px",
                borderRadius:
                  "999px",
                border:
                  categoriaAtiva ===
                  categoria.id
                    ? "1px solid #22d3ee"
                    : "1px solid #334155",
                background:
                  categoriaAtiva ===
                  categoria.id
                    ? "#164e63"
                    : "#0f172a",
                color:
                  categoriaAtiva ===
                  categoria.id
                    ? "#cffafe"
                    : "#cbd5e1",
                cursor:
                  "pointer",
                fontWeight:
                  "bold",
                fontSize: "11px",
              }}
            >
              {categoria.icone}{" "}
              {categoria.nome}
            </button>
          )
        )}
      </div>

      <input
        value={busca}
        onChange={(evento) =>
          setBusca(
            evento.target.value
          )
        }
        placeholder="🔍 Pesquisar na biblioteca..."
        style={{
          width: "100%",
          boxSizing:
            "border-box",
          marginTop: "14px",
          padding: "11px",
          borderRadius: "10px",
          border:
            "1px solid #334155",
          background: "#0f172a",
          color: "#ffffff",
          outline: "none",
        }}
      />

      {categoriaAtiva ===
      "uploads" ? (
        <div
          style={{
            marginTop: "16px",
            padding: "22px",
            borderRadius:
              "12px",
            border:
              "1px dashed #2563eb",
            background:
              "#0f172a",
            textAlign: "center",
            color: "#94a3b8",
          }}
        >
          📂 Use o botão
          <strong>
            {" "}
            Importar{" "}
          </strong>
          para adicionar PNG, JPG, WEBP ou SVG.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fill,minmax(130px,1fr))",
            gap: "10px",
            marginTop: "15px",
          }}
        >
          {itensAtivos.map(
            (item) => (
              <article
                key={item.id}
                style={{
                  position:
                    "relative",
                  minHeight:
                    "120px",
                  padding: "10px",
                  borderRadius:
                    "12px",
                  border:
                    favoritos.includes(
                      item.id
                    )
                      ? "1px solid #eab308"
                      : "1px solid #334155",
                  background:
                    "#0f172a",
                  overflow:
                    "hidden",
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    alternarFavorito(
                      item.id
                    )
                  }
                  title="Favoritar"
                  style={{
                    position:
                      "absolute",
                    top: "7px",
                    right: "7px",
                    width: "30px",
                    height: "30px",
                    borderRadius:
                      "50%",
                    border:
                      "1px solid #475569",
                    background:
                      "#020617",
                    color:
                      "#fde047",
                    cursor:
                      "pointer",
                    zIndex: 2,
                  }}
                >
                  {favoritos.includes(
                    item.id
                  )
                    ? "⭐"
                    : "☆"}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    selecionarItem(
                      item
                    )
                  }
                  style={{
                    width: "100%",
                    height: "100%",
                    minHeight:
                      "100px",
                    padding: "6px",
                    border: "none",
                    background:
                      "transparent",
                    color:
                      "#ffffff",
                    cursor:
                      "pointer",
                    textAlign:
                      "center",
                  }}
                >
                  {categoriaAtiva ===
                    "fundos" && (
                    <div
                      style={{
                        height:
                          "62px",
                        borderRadius:
                          "9px",
                        background:
                          item.valor,
                        border:
                          "1px solid rgba(255,255,255,.25)",
                        marginBottom:
                          "8px",
                      }}
                    />
                  )}

                  {categoriaAtiva ===
                    "selos" && (
                    <div
                      style={{
                        display:
                          "flex",
                        alignItems:
                          "center",
                        justifyContent:
                          "center",
                        minHeight:
                          "62px",
                        borderRadius:
                          "999px",
                        padding:
                          "7px",
                        background:
                          item.fundo,
                        color:
                          item.cor,
                        fontSize:
                          "10px",
                        fontWeight:
                          "900",
                        marginBottom:
                          "8px",
                      }}
                    >
                      {item.texto}
                    </div>
                  )}

                  {categoriaAtiva ===
                    "logos" && (
                    <div
                      style={{
                        display:
                          "flex",
                        alignItems:
                          "center",
                        justifyContent:
                          "center",
                        minHeight:
                          "62px",
                        borderRadius:
                          "9px",
                        background:
                          item.fundo,
                        color:
                          item.cor,
                        border:
                          "1px solid #334155",
                        fontSize:
                          "13px",
                        fontWeight:
                          "900",
                        marginBottom:
                          "8px",
                      }}
                    >
                      {item.sigla}
                    </div>
                  )}

                  {categoriaAtiva ===
                    "elementos" && (
                    <div
                      style={{
                        fontSize:
                          "42px",
                        lineHeight: 1,
                        marginBottom:
                          "12px",
                      }}
                    >
                      {item.icone}
                    </div>
                  )}

                  <strong
                    style={{
                      display:
                        "block",
                      color:
                        "#e2e8f0",
                      fontSize:
                        "11px",
                    }}
                  >
                    {item.nome}
                  </strong>

                  {item.categoria && (
                    <small
                      style={{
                        display:
                          "block",
                        color:
                          "#64748b",
                        marginTop:
                          "3px",
                        fontSize:
                          "9px",
                      }}
                    >
                      {
                        item.categoria
                      }
                    </small>
                  )}
                </button>
              </article>
            )
          )}
        </div>
      )}

      {categoriaAtiva !==
        "uploads" &&
        itensAtivos.length ===
          0 && (
          <div
            style={{
              marginTop: "15px",
              padding: "18px",
              borderRadius:
                "12px",
              background:
                "#0f172a",
              color:
                "#94a3b8",
              textAlign:
                "center",
            }}
          >
            Nenhum item encontrado.
          </div>
        )}
    </section>
  );
}

export default memo(
  BannerBiblioteca
);