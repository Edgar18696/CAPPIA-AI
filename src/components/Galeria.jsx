import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "../supabase";
import { obterIdProcessamento } from "../services/processamentosService";

function chaveVisualGaleria(item) {
  return (
    item?.id ||
    item?.imagem_processada ||
    item?.created_at ||
    ""
  );
}

function urlMiniaturaCardBanner(urlOriginal) {
  const texto = String(urlOriginal || "");
  const marcador =
    "/storage/v1/object/public/imagens/";
  const indice = texto.indexOf(marcador);

  if (indice < 0) {
    return "";
  }

  const caminho = decodeURIComponent(
    texto
      .slice(indice + marcador.length)
      .split("?")[0]
  );

  const match = caminho.match(
    /^([^/]+)\/banners\/(paiia-banner-\d+)\.png$/i
  );

  if (!match) {
    return "";
  }

  return (
    texto.slice(
      0,
      indice + marcador.length
    ) +
    `${match[1]}/banners/${match[2]}-thumb.webp`
  );
}

export default function Galeria({
  galeria,
  filtroGaleria,
  setFiltroGaleria,
  selecionarAbaGaleria,
  buscaGaleria,
  setBuscaGaleria,
  selecionadas,
  setSelecionadas,
  alternarSelecionada,
  excluirSelecionadas,
  baixarSelecionadas,
  baixandoLote,
  excluirImagem,
  baixarImagem,
  setImagemBanner,
  setScreen,
  setFotosAnuncio,
  cardStyle,
  galeriaTemMais = false,
  carregarMaisGaleria,
}) {

  const [imagemAberta, setImagemAberta] = useState(null);

  const [
    bannersGaleria,
    setBannersGaleria,
  ] = useState(() => {
    if (
      Array.isArray(
        window.__paiiaBannersGaleriaCache
      )
    ) {
      return window
        .__paiiaBannersGaleriaCache;
    }

    return [];
  });

  const [abaMidiaAnuncio, setAbaMidiaAnuncio] =
    useState("foto");

  // Mascotes: ficam na tabela "mascotes_marca" (não em "processamentos"),
  // por isso a aba Mascotes lê de lá. Só leitura.
  const [mascotesGaleria, setMascotesGaleria] =
    useState([]);
useEffect(() => {
  const modoAtual =
    localStorage.getItem(
      "modoGaleria"
    );

  if (modoAtual !== "selecionarParaAnuncio") {
    localStorage.removeItem(
      "galeriaAbaFixa"
    );
    localStorage.removeItem(
      "abrirGaleriaNaAba"
    );
    return;
  }

  const abaInicial =
    localStorage.getItem(
      "galeriaAbaFixa"
    ) ||
    localStorage.getItem(
      "abrirGaleriaNaAba"
    );

  if (abaInicial === "banner") {
    setAbaMidiaAnuncio(
      "banner"
    );
  } else if (abaInicial === "foto") {
    setAbaMidiaAnuncio(
      "foto"
    );
  }

  localStorage.removeItem(
    "abrirGaleriaNaAba"
  );
}, []);
  const inputFotoComputadorRef = useRef(null);

  function importarFotoDoComputador(event) {
    const arquivo = event.target.files?.[0];

    if (!arquivo) return;

    if (!arquivo.type?.startsWith("image/")) {
      alert("Selecione um arquivo de imagem válido.");
      event.target.value = "";
      return;
    }

    const urlTemporaria = URL.createObjectURL(arquivo);

    localStorage.setItem(
      "imagemClipSelecionada",
      urlTemporaria
    );
    if (localStorage.getItem("paiiaAbaMidias") === "produto") {
      localStorage.setItem(
        "imagemClipProdutoSelecionada",
        urlTemporaria
      );
    }

    localStorage.setItem(
      "abrirClipAutomatico",
      "true"
    );

    localStorage.setItem(
      "retornarParaClipIA",
      "true"
    );

    localStorage.removeItem("modoGaleria");
    localStorage.removeItem("abrirGaleriaClip");

    setSelecionadas([]);
    setScreen("clipIA");

    event.target.value = "";
  }

useEffect(() => {
  const abrirUltimas =
    localStorage.getItem(
      "abrirUltimasFotos"
    ) === "true";

  const filtroSalvo =
    localStorage.getItem(
      "filtroGaleria"
    );

  if (abrirUltimas) {
    setFiltroGaleria("foto");
    setBuscaGaleria("");
  } else if (
    filtroSalvo === "foto" ||
    filtroSalvo === "banner" ||
    filtroSalvo === "video" ||
    filtroSalvo === "mascote"
  ) {
    setFiltroGaleria(filtroSalvo);
  }

  window.scrollTo({
    top: 0,
    left: 0,
    behavior: "instant",
  });

  localStorage.removeItem(
    "abrirUltimasFotos"
  );

  localStorage.removeItem(
    "filtroGaleria"
  );
}, [
  setFiltroGaleria,
  setBuscaGaleria,
]);

const modoGaleria =
  localStorage.getItem(
    "modoGaleria"
  );

const selecionandoParaBanner =
  modoGaleria ===
  "selecionarParaBanner";

const selecionandoParaClip =
  modoGaleria ===
  "clipIA";

const selecionandoParaAnuncio =
  modoGaleria ===
  "selecionarParaAnuncio";

useEffect(() => {
  if (!selecionandoParaClip) {
    return;
  }

  if (filtroGaleria === "foto" || filtroGaleria === "mascote") {
    return;
  }

  if (typeof selecionarAbaGaleria === "function") {
    selecionarAbaGaleria("foto");
    return;
  }

  setFiltroGaleria("foto");
}, [
  selecionandoParaClip,
  filtroGaleria,
  selecionarAbaGaleria,
  setFiltroGaleria,
]);

const abaGaleriaFixa = (() => {
  if (!selecionandoParaAnuncio) {
    return "";
  }

  const valor = String(
    localStorage.getItem(
      "galeriaAbaFixa"
    ) || ""
  )
    .trim()
    .toLowerCase();

  if (valor === "banner" || valor === "foto") {
    return valor;
  }

  return "";
})();

const [limiteGaleria, setLimiteGaleria] =
  useState(8);
const [carregandoMaisMidias, setCarregandoMaisMidias] =
  useState(false);

useEffect(() => {
  setLimiteGaleria((atual) =>
    atual === 8 ? atual : 8
  );
}, [
  filtroGaleria,
  buscaGaleria,
  selecionandoParaAnuncio,
  abaMidiaAnuncio,
]);


// =====================================================
// BANNERS — CARREGA SOMENTE QUANDO REALMENTE NECESSÁRIO
// =====================================================
//
// IMPORTANTE:
// A Galeria normal NÃO consulta banners no Supabase.
// A consulta de banners acontece somente no fluxo
// "selecionarParaAnuncio" e somente quando a aba
// "Banners" é aberta.
//
// Isso evita uma segunda consulta pesada toda vez
// que a Galeria é aberta.
// =====================================================

const bannersJaBuscadosRef = useRef(false);

useEffect(() => {
  let ativo = true;

  async function carregarBannersGaleria() {
    if (!selecionandoParaAnuncio) {
      return;
    }

    if (abaMidiaAnuncio !== "banner") {
      return;
    }

    if (bannersJaBuscadosRef.current) {
      return;
    }

    bannersJaBuscadosRef.current = true;

    try {
      const {
        data: dadosSessao,
        error: erroSessao,
      } = await supabase.auth.getSession();

      if (erroSessao) {
        throw erroSessao;
      }

      const usuario =
        dadosSessao?.session?.user;

      if (!usuario?.id) {
        bannersJaBuscadosRef.current = false;
        return;
      }

      const {
        data,
        error,
      } = await supabase
        .from("processamentos")
        // Colunas leves: não baixa imagem_original (pode ser base64).
        .select(
          "id, user_id, tipo, status, created_at, imagem_processada, modelo_banner"
        )
        .eq(
          "user_id",
          usuario.id
        )
        .eq(
          "tipo",
          "banner"
        )
        .eq(
          "status",
          "finalizado"
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
        .limit(8);

      if (error) {
        throw error;
      }

      const bannersLeves =
        (
          Array.isArray(data)
            ? data
            : []
        ).map((item) => ({
          ...item,
          tipo: "banner",
          imagem_original: "",
        }));

      if (!ativo) {
        return;
      }

      const bannersOrdenados =
        [...bannersLeves].sort(
          (a, b) =>
            new Date(
              b?.created_at || 0
            ) -
            new Date(
              a?.created_at || 0
            )
        );

      setBannersGaleria(
        bannersOrdenados
      );

      window.__paiiaBannersGaleriaCache =
        bannersOrdenados;
    } catch (erro) {
      bannersJaBuscadosRef.current = false;

      console.error(
        "Erro ao carregar banners na Galeria:",
        erro
      );
    }
  }

  carregarBannersGaleria();

  return () => {
    ativo = false;
  };
}, [
  selecionandoParaAnuncio,
  abaMidiaAnuncio,
]);

// =====================================================
// MASCOTES (tabela mascotes_marca) — só na aba Mascotes
// =====================================================

useEffect(() => {
  let ativo = true;

  if (filtroGaleria !== "mascote") {
    return () => {
      ativo = false;
    };
  }

  (async () => {
    try {
      const { data: dadosSessao } =
        await supabase.auth.getSession();
      const usuarioId =
        dadosSessao?.session?.user?.id;

      if (!usuarioId) {
        return;
      }

      const { data, error } = await supabase
        .from("mascotes_marca")
        .select("id, nome, imagem_base, created_at")
        .eq("user_id", usuarioId)
        .eq("ativo", true)
        .not("imagem_base", "is", null)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      if (!ativo) {
        return;
      }

      setMascotesGaleria(
        (Array.isArray(data) ? data : []).map((m) => ({
          id: `mascote-marca-${m.id}`,
          user_id: usuarioId,
          tipo: "mascote",
          status: "finalizado",
          created_at: m.created_at,
          imagem_processada: m.imagem_base,
          imagem_original: "",
          nome: m.nome || "",
        }))
      );
    } catch (erro) {
      console.error(
        "Erro ao carregar mascotes na Galeria:",
        erro
      );
    }
  })();

  return () => {
    ativo = false;
  };
}, [filtroGaleria]);

// =====================================================
// GALERIA FILTRADA
// JUNTA FOTOS + BANNERS
// =====================================================

const galeriaFiltrada =
  useMemo(() => {
    const fotos =
      Array.isArray(galeria)
        ? galeria
        : [];

    const banners =
      Array.isArray(
        bannersGaleria
      )
        ? bannersGaleria
        : [];

    const mapa =
      new Map();

    const mascotes =
      filtroGaleria === "mascote" &&
      Array.isArray(mascotesGaleria)
        ? mascotesGaleria
        : [];

    [
      ...fotos,
      ...banners,
      ...mascotes,
    ].forEach((item) => {
      const chave =
        chaveVisualGaleria(
          item
        );

      if (!chave) {
        return;
      }

      if (
        !mapa.has(chave)
      ) {
        mapa.set(
          chave,
          item
        );
      }
    });

    const lista =
      Array.from(
        mapa.values()
      );

    lista.sort(
      (a, b) =>
        new Date(
          b?.created_at || 0
        ) -
        new Date(
          a?.created_at || 0
        )
    );

    return lista.filter(
      (item) => {
        const tipoItem =
          String(
            item?.tipo || ""
          )
            .trim()
            .toLowerCase();

        const ehClipOuVideo =
          tipoItem === "clip" ||
          tipoItem === "video";

        const ehBanner =
          tipoItem ===
          "banner";

        const ehMascote =
          tipoItem ===
          "mascote";

        const ehFoto =
          tipoItem === "foto" ||
          (
            !tipoItem &&
            !ehClipOuVideo &&
            !ehBanner &&
            !ehMascote
          );

        if (!selecionandoParaAnuncio) {
          if (filtroGaleria === "foto" && !ehFoto) {
            return false;
          }

          if (filtroGaleria === "banner" && !ehBanner) {
            return false;
          }

          if (filtroGaleria === "video" && !ehClipOuVideo) {
            return false;
          }

          if (filtroGaleria === "mascote" && !ehMascote) {
            return false;
          }
        }

        /*
         * =============================================
         * FLUXO DO NOVO ANÚNCIO
         * =============================================
         *
         * Mantemos como já estava:
         * anúncio seleciona foto ou banner.
         * Vídeo não entra neste fluxo.
         * =============================================
         */

        if (
          selecionandoParaAnuncio
        ) {
          const abaLista =
            abaGaleriaFixa ||
            abaMidiaAnuncio;

          const passaAba =
            abaLista ===
            "banner"
              ? ehBanner
              : ehFoto;

          if (!passaAba) {
            return false;
          }
        }

        /*
         * =============================================
         * BUSCA
         * =============================================
         */

        const textoBusca =
          String(
            buscaGaleria || ""
          )
            .trim()
            .toLowerCase();

        const categoria =
            ehMascote
              ? "mascote"
              : ehClipOuVideo
            ? "video clip"
            : ehBanner
              ? "banner"
              : "foto";

        const passaBusca =
          !textoBusca ||
          categoria.includes(
            textoBusca
          ) ||
          tipoItem.includes(
            textoBusca
          ) ||
          String(
            item?.created_at ||
            ""
          )
            .toLowerCase()
            .includes(
              textoBusca
            );

        return passaBusca;
      }
    );
  }, [
    galeria,
    bannersGaleria,
    mascotesGaleria,
    filtroGaleria,
    buscaGaleria,
    selecionandoParaAnuncio,
    abaMidiaAnuncio,
    abaGaleriaFixa,
  ]);


// =====================================================
// SELEÇÃO PARA BANNER / CLIP
// =====================================================

function selecionarImagemParaAnuncio(
  item
) {
  const modoAtual =
    localStorage.getItem(
      "modoGaleria"
    );

  // ===================================================
  // BANNER EXPRESS
  // ===================================================

  if (
    modoAtual ===
    "selecionarParaBanner"
  ) {
    const url =
      item?.imagem_processada ||
      item?.imagem_original ||
      "";

    if (!url) {
      alert(
        "Esta imagem não possui uma URL válida."
      );

      return;
    }

    setImagemBanner?.(
      url
    );

    localStorage.setItem(
      "imagemBannerSelecionada",
      url
    );

    localStorage.setItem(
      "abrirBannerAutomatico",
      "true"
    );

    localStorage.removeItem(
      "modoGaleria"
    );

    setSelecionadas([]);

    setScreen(
      "bannerStudio"
    );

    return;
  }

  // ===================================================
  // CLIP IA
  // ===================================================

  if (
    modoAtual ===
    "clipIA"
  ) {
    const url =
      item?.imagem_processada ||
      item?.imagem_original ||
      "";

    if (!url) {
      alert(
        "Esta imagem não possui uma URL válida."
      );

      return;
    }

    localStorage.setItem(
      "imagemClipSelecionada",
      url
    );
    if (localStorage.getItem("paiiaAbaMidias") === "produto") {
      localStorage.setItem(
        "imagemClipProdutoSelecionada",
        url
      );
    }

    localStorage.setItem(
      "abrirClipAutomatico",
      "true"
    );

    localStorage.removeItem(
      "modoGaleria"
    );

    setSelecionadas([]);

    const destino =
      localStorage.getItem(
        "retornoCriacaoMidia"
      ) === "midiasAppia"
        ? "midiasAppia"
        : "clipIA";

    localStorage.removeItem(
      "retornoCriacaoMidia"
    );

    setScreen(
      destino
    );

    return;
  }
}


// =====================================================
// MARCA / DESMARCA FOTO OU BANNER DO ANÚNCIO
// =====================================================

function alternarSelecaoDoAnuncio(
  item
) {
  const id =
    obterIdProcessamento(
      item
    );

  if (!id) {
    alert(
      "Esta imagem não possui identificador único. A seleção foi bloqueada."
    );
    return;
  }

  if (
    selecionadas.includes(
      id
    )
  ) {
    setSelecionadas(
      selecionadas.filter(
        (selecionada) =>
          selecionada !== id
      )
    );

    return;
  }

  if (
    selecionadas.length >= 6
  ) {
    alert(
      "Você pode selecionar no máximo 6 imagens entre fotos e banners."
    );

    return;
  }

  setSelecionadas([
    ...selecionadas,
    id,
  ]);
}


// =====================================================
// CONFIRMA FOTOS + BANNERS NO NOVO ANÚNCIO
// =====================================================

function confirmarImagensNoAnuncio() {
  const fotos =
    Array.isArray(galeria)
      ? galeria
      : [];

  const banners =
    Array.isArray(
      bannersGaleria
    )
      ? bannersGaleria
      : [];

  const todasDisponiveis = [
    ...fotos,
    ...banners,
  ];

  const novasMidias =
    todasDisponiveis
      .filter((item) => {
        const id =
          obterIdProcessamento(
            item
          );

        return (
          id &&
          selecionadas.includes(
            id
          )
        );
      })
      .filter((item) => {
        const tipo =
          String(
            item?.tipo || ""
          )
            .trim()
            .toLowerCase();

        return (
          tipo !== "clip" &&
          tipo !== "video"
        );
      })
      .map((item) => {
        const tipo =
          String(
            item?.tipo || ""
          )
            .trim()
            .toLowerCase();

        return {
          id: item.id,

          imagem_processada:
            item?.imagem_processada ||
            item?.imagem_original ||
            "",

          imagem_original:
            item?.imagem_original ||
            "",

          tipo:
            tipo === "banner"
              ? "banner"
              : "foto",

          created_at:
            item?.created_at ||
            new Date()
              .toISOString(),
        };
      })
      .filter(
        (item) =>
          Boolean(
            item.imagem_processada
          )
      );

  // ===================================================
  // IMAGENS QUE JÁ ESTAVAM NO ANÚNCIO
  // ===================================================

  const fotosMemoria =
    Array.isArray(
      window
        .__paiiaFotosNovoAnuncio
    )
      ? window
          .__paiiaFotosNovoAnuncio
      : [];

  const todas = [
    ...fotosMemoria,
    ...novasMidias,
  ];

  // ===================================================
  // REMOVE DUPLICADAS PELA URL
  // ===================================================

  const mapa = new Map();

  todas.forEach((item) => {
    const url =
      item?.imagem_processada ||
      item?.imagem_original ||
      "";

    if (!url) {
      return;
    }

    if (!mapa.has(url)) {
      mapa.set(
        url,
        item
      );
    }
  });

  // ===================================================
  // LIMITE DE 6
  // ===================================================

  const fotosFinais =
    Array.from(
      mapa.values()
    ).slice(
      0,
      6
    );

  window
    .__paiiaFotosNovoAnuncio =
    fotosFinais;

  setFotosAnuncio?.(
    fotosFinais
  );

  localStorage.setItem(
    "voltarParaFotosAnuncio",
    "true"
  );

  localStorage.removeItem(
    "modoGaleria"
  );

  localStorage.removeItem(
    "abrirGaleriaAnuncio"
  );

  localStorage.removeItem(
    "galeriaAbaFixa"
  );

  localStorage.removeItem(
    "abrirGaleriaNaAba"
  );

  setSelecionadas([]);

  setScreen(
    "novoAnuncio"
  );
}
function confirmarImagemParaBanner() {
  const imagem = galeriaFiltrada.find((item) =>
    selecionadas.includes(
      obterIdProcessamento(item)
    )
  );

  if (!imagem) {
    alert("Selecione uma imagem.");
    return;
  }

  const url =
    imagem.imagem_processada ||
    imagem.imagem_original;

  if (!url) {
    alert(
      "Esta imagem não possui uma URL válida."
    );
    return;
  }

  setImagemBanner?.(url);

  localStorage.setItem(
    "imagemBannerSelecionada",
    url
  );

  localStorage.setItem(
    "abrirBannerAutomatico",
    "true"
  );

  localStorage.removeItem("modoGaleria");

  setSelecionadas([]);

  setScreen("bannerStudio");
}
  return (
    <div style={{ marginTop: "50px", paddingBottom: "90px" }}>
      <h2
        style={{
          color: "#67e8f9",
          fontSize: "32px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>🖼 Galeria</span>
      </h2>

      {selecionandoParaClip && (
        <div
          style={{
            marginBottom:"16px",
            padding:"12px",
            borderRadius:"12px",
            background:"#082f49",
            border:"1px solid #38bdf8",
            color:"#bae6fd",
            textAlign:"center",
            fontWeight:"bold",
          }}
        >
          Selecione uma foto para a criação. Toque na imagem para voltar.
        </div>
      )}

      {selecionandoParaAnuncio && (
        <div
          style={{
            marginBottom: "16px",
            padding: "12px",
            borderRadius: "12px",
            background: "#052e16",
            border: "1px solid #22c55e",
            color: "#bbf7d0",
            textAlign: "center",
            fontWeight: "bold",
          }}
        >
          Selecione fotos e banners do anúncio. Você pode alternar entre as abas sem perder a seleção.
        </div>
      )}

      {selecionandoParaAnuncio &&
        !abaGaleriaFixa && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "10px",
            marginBottom: "18px",
            maxWidth: "520px",
          }}
        >
          <button
            type="button"
            onClick={() =>
              setAbaMidiaAnuncio("foto")
            }
            style={{
              ...botaoAzul,
              background:
                abaMidiaAnuncio === "foto"
                  ? "#2563eb"
                  : "#1e293b",
              border:
                abaMidiaAnuncio === "foto"
                  ? "1px solid #60a5fa"
                  : "1px solid #334155",
            }}
          >
            🖼 Fotos
          </button>

          <button
            type="button"
            onClick={() =>
              setAbaMidiaAnuncio("banner")
            }
            style={{
              ...botaoAzul,
              background:
                abaMidiaAnuncio === "banner"
                  ? "#7c3aed"
                  : "#1e293b",
              border:
                abaMidiaAnuncio === "banner"
                  ? "1px solid #c4b5fd"
                  : "1px solid #334155",
            }}
          >
            🎨 Banners
          </button>
        </div>
      )}

      <input
        type="text"
        className="paiia-galeria-busca"
        placeholder={
          selecionandoParaAnuncio
            ? abaMidiaAnuncio === "banner"
              ? "🔍 Buscar banner"
              : "🔍 Buscar foto"
            : "🔍 Buscar imagem"
        }
        value={buscaGaleria}
        onChange={(e) => setBuscaGaleria(e.target.value)}
        style={{
          padding: "12px",
          width: "300px",
          borderRadius: "8px",
          marginBottom: "20px",
        }}
      />
      {/* FILTROS DA GALERIA DE MÍDIAS */}
      {!selecionandoParaAnuncio &&
        !selecionandoParaBanner &&
        !selecionandoParaClip && (
          <div
            className="paiia-galeria-filtros"
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "10px",
              flexWrap: "wrap",
              marginBottom: "20px",
            }}
          >
            {[
              {
                valor: "foto",
                label: "📸 Fotos",
              },
              {
                valor: "mascote",
                label: "🎭 Mascotes",
              },
              {
                valor: "banner",
                label: "🎨 Banners",
              },
              {
                valor: "video",
                label: "🎬 Vídeos",
              },
            ].map((opcao) => {
              const ativo =
                filtroGaleria ===
                opcao.valor;

              return (
                <button
                  key={opcao.valor}
                  type="button"
                  onClick={() => {
                    if (
                      selecionarAbaGaleria
                    ) {
                      selecionarAbaGaleria(
                        opcao.valor
                      );
                      return;
                    }

                    setFiltroGaleria(
                      opcao.valor
                    );
                  }}
                  style={{
                    padding:
                      "10px 16px",
                    borderRadius:
                      "10px",
                    border: ativo
                      ? "1px solid #67e8f9"
                      : "1px solid #334155",
                    background: ativo
                      ? "#0e7490"
                      : "#0f172a",
                    color: "#ffffff",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {opcao.label}
                </button>
              );
            })}
          </div>
        )}
    {!selecionandoParaAnuncio &&
  !selecionandoParaBanner &&
  !selecionandoParaClip && (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        gap: "12px",
        flexWrap: "wrap",
        marginTop: "20px",
        marginBottom: "25px",
      }}
    >
      <button
        onClick={() =>
          {
            const ids =
              galeriaFiltrada
                .map((item) =>
                  obterIdProcessamento(
                    item
                  )
                )
                .filter(Boolean);

            if (
              galeriaFiltrada.length >
                0 &&
              ids.length === 0
            ) {
              alert(
                "Estas imagens não possuem identificador único. A seleção foi bloqueada."
              );
              return;
            }

            setSelecionadas(
              ids
            );
          }
        }
        style={botaoAzul}
      >
        ✅ Selecionar tudo
      </button>

  {selecionandoParaClip && (
  <div
    style={{
      display: "flex",
      justifyContent: "center",
      gap: "12px",
      flexWrap: "wrap",
      marginTop: "20px",
      marginBottom: "25px",
    }}
  >
    <input
      ref={inputFotoComputadorRef}
      type="file"
      accept="image/*"
      onChange={importarFotoDoComputador}
      style={{ display: "none" }}
    />

    <button
      type="button"
      onClick={() =>
        inputFotoComputadorRef.current?.click()
      }
      style={{
        background: "#16a34a",
        color: "#ffffff",
        border: "none",
        padding: "14px 22px",
        borderRadius: "12px",
        cursor: "pointer",
        fontWeight: "bold",
      }}
    >
      📁 Importar Foto do Computador
    </button>

    <button
      type="button"
      onClick={() => {
        localStorage.removeItem("modoGaleria");
        localStorage.removeItem("abrirGaleriaClip");
        localStorage.removeItem("retornarParaClipIA");

        setSelecionadas([]);
        setScreen("clipIA");
      }}
      style={{
        background: "#475569",
        color: "#ffffff",
        border: "none",
        padding: "14px 22px",
        borderRadius: "12px",
        cursor: "pointer",
        fontWeight: "bold",
      }}
    >
      ↩️ Voltar ao Clip IA
    </button>
  </div>
)}

  {selecionandoParaBanner && (
  <div
    style={{
      display: "flex",
      justifyContent: "center",
      gap: "12px",
      flexWrap: "wrap",
      marginTop: "20px",
      marginBottom: "25px",
    }}
  >
    <button
      type="button"
      onClick={
        confirmarImagemParaBanner
      }
      disabled={
        selecionadas.length !== 1
      }
      style={{
        background: "#2563eb",
        color: "#ffffff",
        border: "none",
        padding: "14px 22px",
        borderRadius: "12px",
        cursor:
          selecionadas.length === 1
            ? "pointer"
            : "not-allowed",
        fontWeight: "bold",
        opacity:
          selecionadas.length === 1
            ? 1
            : 0.6,
      }}
    >
      🎨 Usar no Banner
    </button>

    <button
      type="button"
      onClick={() => {
        localStorage.removeItem(
          "modoGaleria"
        );

        setSelecionadas([]);
        setScreen("bannerStudio");
      }}
      style={{
        background: "#475569",
        color: "#ffffff",
        border: "none",
        padding: "14px 22px",
        borderRadius: "12px",
        cursor: "pointer",
        fontWeight: "bold",
      }}
    >
      ↩️ Voltar ao Banner
    </button>
  </div>
)}

          <button onClick={() => setSelecionadas([])} style={botaoCinza}>
            ❌ Desmarcar tudo
          </button>

          <button onClick={excluirSelecionadas} style={botaoVermelho}>
            🗑️ Excluir selecionadas
          </button>

        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
          gap: "20px",
        }}
      >
        {galeriaFiltrada
  .slice(0, limiteGaleria)
  .map((item) => {
          const url = item.imagem_processada || item.imagem_original;
          const ehBannerCard =
            String(item?.tipo || "")
              .trim()
              .toLowerCase() ===
            "banner";
          const urlMiniatura =
            ehBannerCard
              ? urlMiniaturaCardBanner(
                  url
                )
              : "";
          const urlCard =
            urlMiniatura || url;
          const estaSelecionada = selecionadas.includes(
            obterIdProcessamento(item)
          );
          const chaveCard =
            chaveVisualGaleria(item);

          return (
            <div
              key={chaveCard}
              onClick={() => {
  if (selecionandoParaClip) {
    selecionarImagemParaAnuncio(
      item
    );
    return;
  }

  if (
    selecionandoParaBanner
  ) {
    selecionarImagemParaAnuncio(
      item
    );
    return;
  }

  if (
    selecionandoParaAnuncio
  ) {
    alternarSelecaoDoAnuncio(
      item
    );
    return;
  }

  const urlImagem =
    item.imagem_processada ||
    item.imagem_original;

  if (!urlImagem) {
    alert(
      "Esta imagem não possui uma URL válida."
    );
    return;
  }

  setImagemAberta({
    ...item,
    url: urlImagem,
  });
}}
              style={{
                ...cardStyle,
                position: "relative",
                border: estaSelecionada
                  ? "3px solid #22c55e"
                  : "1px solid #334155",
                boxShadow: estaSelecionada
                  ? "0 0 25px rgba(34,197,94,.45)"
                  : "0 2px 8px rgba(0,0,0,.25)",
                transform: estaSelecionada ? "scale(1.03)" : "scale(1)",
                transition: "all .18s ease",
                cursor:
                  selecionandoParaAnuncio ||
                  selecionandoParaBanner ||
                  selecionandoParaClip
                    ? "pointer"
                    : "default",
              }}
            >
              {!selecionandoParaClip && (
              <input
                type="checkbox"
                checked={estaSelecionada}
                onChange={() => {
                  if (
                    selecionandoParaClip ||
                    selecionandoParaBanner
                  ) {
                    selecionarImagemParaAnuncio(
                      item
                    );
                    return;
                  }

                  if (
                    selecionandoParaAnuncio
                  ) {
                    alternarSelecaoDoAnuncio(
                      item
                    );
                    return;
                  }

                  const processamentoId =
                    obterIdProcessamento(
                      item
                    );

                  if (!processamentoId) {
                    alert(
                      "Esta imagem não possui identificador único. A seleção foi bloqueada."
                    );
                    return;
                  }

                  alternarSelecionada(
                    processamentoId
                  );
                }}
                onClick={(e) =>
                  e.stopPropagation()
                }
                style={{
                  width: "20px",
                  height: "20px",
                  marginBottom: "10px",
                }}
              />
              )}

{item.tipo === "video" ||
item.tipo === "clip" ? (
  <video
    src={url}
    controls
    preload="metadata"
    playsInline
    style={{
      width: "100%",
      borderRadius: "12px",
      background: "#000",
      maxHeight: "420px",
    }}
  />
) : (
  <img
    src={urlCard}
    alt="Imagem"
    loading="lazy"
    decoding="async"
    onError={(e) => {
      const destino =
        e.currentTarget;

      if (ehBannerCard) {
        const atual = String(
          destino.getAttribute("src") ||
            ""
        );

        if (
          atual.endsWith(
            "-thumb.webp"
          )
        ) {
          destino.src = atual.replace(
            /-thumb\.webp$/i,
            "-thumb.jpg"
          );
          return;
        }

        if (
          atual.endsWith(
            "-thumb.jpg"
          ) &&
          url
        ) {
          destino.src = url;
          return;
        }
      }

      destino.style.display =
        "none";
    }}
    style={{
      width: "100%",
      borderRadius: "12px",
      background: "#fff",
    }}
  />
)}
              <p style={{ color: "#93c5fd", fontWeight: "bold" }}>
                {item.tipo === "banner"
  ? "🎨 Banner"
  : item.tipo === "clip"
  ? "🎬 Clip IA"
  : item.tipo === "mascote"
  ? "🎭 Mascote"
  : item.tipo === "video"
  ? "🎬 Vídeo IA"
  : "📸 Foto IA"}
              </p>

              <p style={{ color: "#94a3b8", fontSize: "13px" }}>
                {item.created_at
                  ? new Date(item.created_at).toLocaleString("pt-BR")
                  : ""}
              </p>

              {!selecionandoParaAnuncio &&
  !selecionandoParaBanner &&
  !selecionandoParaClip && (
    <div
      style={{
        display: "flex",
        gap: "8px",
        justifyContent: "center",
        flexWrap: "wrap",
      }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          baixarImagem(url);
        }}
        style={botaoVerdePequeno}
      >
        ⬇️ Baixar
      </button>

      {item.tipo === "foto" && (
        <button
          type="button"
          onClick={(e) => {
  e.stopPropagation();

  // Coloca a foto diretamente no estado do Banner
  setImagemBanner?.(url);

  // Mantém também como segurança
  localStorage.setItem(
    "imagemBannerSelecionada",
    url
  );

  localStorage.setItem(
    "abrirBannerAutomatico",
    "true"
  );

  localStorage.removeItem(
    "modoGaleria"
  );

  setScreen("bannerStudio");
}}
          style={botaoAzulPequeno}
        >
          🖼️ Usar no Banner
        </button>
      )}

      {item.tipo === "banner" && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            // Reabre o banner no Banner Express com os mesmos parâmetros.
            localStorage.setItem(
              "bannerParaEditar",
              url
            );
            localStorage.removeItem(
              "modoGaleria"
            );
            setScreen("bannerStudio");
          }}
          style={botaoAzulPequeno}
        >
          ✏️ Editar
        </button>
      )}

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          excluirImagem(item);
        }}
        style={botaoVermelhoPequeno}
      >
        🗑️ Excluir
      </button>
    </div>
  )}
            </div>
          );
        })}
      </div>
{ (galeriaFiltrada.length > limiteGaleria ||
  galeriaTemMais) && (
  <div
    style={{
      gridColumn: "1 / -1",
      display: "flex",
      justifyContent: "center",
      marginTop: "10px",
    }}
  >
    <button
      type="button"
      onClick={async () => {
        if (
          galeriaFiltrada.length >
          limiteGaleria
        ) {
          setLimiteGaleria(
            (atual) => atual + 8
          );
          return;
        }

        if (carregandoMaisMidias) {
          return;
        }

        // Busca só a próxima página (colunas leves) no servidor.
        setCarregandoMaisMidias(true);
        try {
          await carregarMaisGaleria?.(
            filtroGaleria
          );
          setLimiteGaleria(
            (atual) => atual + 8
          );
        } finally {
          setCarregandoMaisMidias(false);
        }
      }}
      disabled={carregandoMaisMidias}
      style={{
        ...botaoAzul,
        opacity: carregandoMaisMidias ? 0.7 : 1,
        cursor: carregandoMaisMidias ? "wait" : "pointer",
      }}
    >
      {carregandoMaisMidias
        ? "⏳ Carregando..."
        : "⬇️ Carregar mais"}
    </button>
  </div>
)}
      {galeriaFiltrada.length === 0 && (
        <p style={{ color: "#94a3b8", marginTop: "25px" }}>
          {selecionandoParaAnuncio
            ? abaMidiaAnuncio === "banner"
              ? "Nenhum banner encontrado."
              : "Nenhuma foto encontrada."
            : "Nenhuma imagem encontrada."}
        </p>
      )}
{imagemAberta?.url && (
  <div
    onClick={() =>
      setImagemAberta(null)
    }
    style={{
      position: "fixed",
      inset: 0,
      zIndex: 99999,
      background:
        "rgba(2,6,23,.92)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
    }}
  >
    <div
      onClick={(e) =>
        e.stopPropagation()
      }
      style={{
        position: "relative",
        width: "min(100%, 1000px)",
        maxHeight: "92vh",
        background: "#0f172a",
        border:
          "1px solid #334155",
        borderRadius: "18px",
        padding: "16px",
        boxShadow:
          "0 30px 80px rgba(0,0,0,.55)",
        overflow: "auto",
      }}
    >
      <button
        type="button"
        onClick={() =>
          setImagemAberta(null)
        }
        style={{
          position: "absolute",
          top: "12px",
          right: "12px",
          zIndex: 2,
          width: "38px",
          height: "38px",
          borderRadius: "50%",
          border: "none",
          background:
            "rgba(15,23,42,.9)",
          color: "#ffffff",
          fontSize: "20px",
          cursor: "pointer",
        }}
      >
        ✕
      </button>

      <img
        src={imagemAberta.url}
        alt="Imagem ampliada"
        style={{
          width: "100%",
          maxHeight: "75vh",
          objectFit: "contain",
          background: "#ffffff",
          borderRadius: "12px",
          display: "block",
        }}
      />

      <div
        style={{
          display: "flex",
          gap: "10px",
          justifyContent: "center",
          flexWrap: "wrap",
          marginTop: "14px",
        }}
      >
        <button
          type="button"
          onClick={() =>
            baixarImagem(
              imagemAberta.url
            )
          }
          style={botaoVerde}
        >
          ⬇️ Baixar
        </button>

        {imagemAberta.tipo ===
          "foto" && (
          <button
  type="button"
  onClick={() => {
    setImagemBanner?.(
      imagemAberta.url
    );

    localStorage.setItem(
      "imagemBannerSelecionada",
      imagemAberta.url
    );

    localStorage.setItem(
      "abrirBannerAutomatico",
      "true"
    );

    localStorage.removeItem(
      "modoGaleria"
    );

    setImagemAberta(null);

    setScreen(
      "bannerStudio"
    );
  }}
  style={botaoAzul}
>
  🖼️ Usar no Banner
</button>
        )}

        <button
          type="button"
          onClick={() =>
            setImagemAberta(null)
          }
          style={botaoCinza}
        >
          ↩️ Fechar
        </button>
      </div>
    </div>
  </div>
)}

{/* =========================================
    BARRA DE SELEÇÃO DO NOVO ANÚNCIO
    ========================================= */}

{selecionandoParaAnuncio && (
  <div
    style={{
      position: "fixed",
      bottom: "20px",
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: 9999,
      width: "calc(100% - 32px)",
      maxWidth: "760px",
      background: "#052e16",
      border:
        "1px solid #22c55e",
      borderRadius: "16px",
      padding: "12px 18px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "12px",
      flexWrap: "wrap",
      boxShadow:
        "0 10px 30px rgba(0,0,0,.35)",
    }}
  >
    <div
      style={{
        color: "#dcfce7",
        fontWeight: "bold",
        whiteSpace: "nowrap",
      }}
    >
      📦 {selecionadas.length} / 6 imagens selecionadas
    </div>

    {/* =====================================
        ESTÁ EM FOTOS → LEVA PARA BANNERS
        ===================================== */}

    {abaMidiaAnuncio === "foto" &&
      abaGaleriaFixa !== "foto" && (
      <button
        type="button"
        onClick={() => {
          setAbaMidiaAnuncio(
            "banner"
          );

          setImagemAberta(null);

          window.scrollTo({
            top: 0,
            left: 0,
            behavior: "smooth",
          });
        }}
        style={{
          padding: "12px 18px",
          borderRadius: "12px",
          border:
            "1px solid #c4b5fd",
          background: "#7c3aed",
          color: "#ffffff",
          fontWeight: "bold",
          cursor: "pointer",
        }}
      >
        🎨 Escolher Banner
      </button>
    )}

    {/* =====================================
        ESTÁ EM BANNERS → VOLTA PARA FOTOS
        ===================================== */}

    {abaMidiaAnuncio ===
      "banner" &&
      abaGaleriaFixa !== "banner" && (
      <button
        type="button"
        onClick={() => {
          setAbaMidiaAnuncio(
            "foto"
          );

          setImagemAberta(null);

          window.scrollTo({
            top: 0,
            left: 0,
            behavior: "smooth",
          });
        }}
        style={{
          padding: "12px 18px",
          borderRadius: "12px",
          border:
            "1px solid #60a5fa",
          background: "#2563eb",
          color: "#ffffff",
          fontWeight: "bold",
          cursor: "pointer",
        }}
      >
        🖼 Escolher Fotos
      </button>
    )}

    {/* =====================================
        FINALIZA SELEÇÃO
        ===================================== */}

    <button
      type="button"
      disabled={
        selecionadas.length === 0
      }
      onClick={
        confirmarImagensNoAnuncio
      }
      style={{
        padding: "12px 22px",
        borderRadius: "12px",
        border: "none",
        background:
          selecionadas.length === 0
            ? "#475569"
            : "linear-gradient(135deg,#16a34a,#22c55e)",
        color: "#ffffff",
        fontWeight: "bold",
        cursor:
          selecionadas.length === 0
            ? "not-allowed"
            : "pointer",
        opacity:
          selecionadas.length === 0
            ? 0.65
            : 1,
      }}
    >
      📦 Inserir no anúncio
    </button>
  </div>
)}
    </div>
  );
}
const botaoAzul = {
  background: "#2563eb",
  color: "#ffffff",
  padding: "10px 18px",
  borderRadius: "10px",
  border: "none",
  cursor: "pointer",
  fontWeight: "bold",
};

const botaoCinza = {
  background: "#475569",
  color: "white",
  padding: "10px 18px",
  borderRadius: "10px",
  border: "none",
  cursor: "pointer",
  fontWeight: "bold",
};

const botaoVermelho = {
  background: "#dc2626",
  color: "white",
  padding: "10px 18px",
  borderRadius: "10px",
  border: "none",
  cursor: "pointer",
  fontWeight: "bold",
};

const botaoVerde = {
  background: "#16a34a",
  color: "white",
  padding: "10px 18px",
  borderRadius: "10px",
  border: "none",
  cursor: "pointer",
  fontWeight: "bold",
};

const botaoVerdePequeno = {
  background: "#16a34a",
  color: "#fff",
  border: "none",
  padding: "6px 10px",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: "bold",
  fontSize: "13px",
};

const botaoAzulPequeno = {
  background: "#2563eb",
  color: "#fff",
  border: "none",
  padding: "6px 10px",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: "bold",
  fontSize: "13px",
};

const botaoVermelhoPequeno = {
  background: "#dc2626",
  color: "#fff",
  border: "none",
  padding: "6px 10px",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: "bold",
  fontSize: "13px",
};
