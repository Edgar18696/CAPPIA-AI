import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { supabase } from "../supabase";

function normalizarTexto(valor = "") {
  return String(valor || "")
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase()
    .trim();
}

function sugerirCategoriaPorTitulo(
  titulo = ""
) {
  const texto =
    normalizarTexto(titulo);

  if (
    texto.includes("sensor map") ||
    texto.includes("sensor de pressao") ||
    texto.includes("sensor pressão")
  ) {
    return (
      "Acessórios para Veículos > " +
      "Peças de Carros e Caminhonetes > " +
      "Injeção > Sensores > Sensor MAP"
    );
  }

  if (
    texto.includes("sonda lambda") ||
    texto.includes("sensor oxigenio") ||
    texto.includes("sensor de oxigenio")
  ) {
    return (
      "Acessórios para Veículos > " +
      "Peças de Carros e Caminhonetes > " +
      "Injeção > Sonda Lambda"
    );
  }

  if (
    texto.includes("bico injetor") ||
    texto.includes("injetor")
  ) {
    return (
      "Acessórios para Veículos > " +
      "Peças de Carros e Caminhonetes > " +
      "Injeção > Bicos Injetores"
    );
  }

  if (
    texto.includes("bomba de combustivel") ||
    texto.includes("bomba combustível")
  ) {
    return (
      "Acessórios para Veículos > " +
      "Peças de Carros e Caminhonetes > " +
      "Injeção > Bombas de Combustível"
    );
  }

  if (
    texto.includes("bobina")
  ) {
    return (
      "Acessórios para Veículos > " +
      "Peças de Carros e Caminhonetes > " +
      "Ignição > Bobinas"
    );
  }

  if (
    texto.includes("vela de ignicao") ||
    texto.includes("vela ignicao")
  ) {
    return (
      "Acessórios para Veículos > " +
      "Peças de Carros e Caminhonetes > " +
      "Ignição > Velas"
    );
  }

  return "";
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

function obterDimensoesFoto(url) {
  return new Promise((resolve) => {
    if (!url) {
      resolve({
        largura: 0,
        altura: 0,
        ok: false,
      });
      return;
    }

    const imagem = new Image();

    imagem.onload = () => {
      const largura =
        Number(imagem.naturalWidth || 0);

      const altura =
        Number(imagem.naturalHeight || 0);

      resolve({
        largura,
        altura,
        ok:
          largura >= 1200 &&
          altura >= 1200,
      });
    };

    imagem.onerror = () => {
      resolve({
        largura: 0,
        altura: 0,
        ok: false,
      });
    };

    imagem.src = url;
  });
}

export default function MercadoLivreTeste({
  setScreen,
}) {
  const anuncio = useMemo(() => {
    try {
      const salvo =
        localStorage.getItem(
          "mlAnuncioTeste"
        );

      return salvo
        ? JSON.parse(salvo)
        : null;
    } catch {
      return null;
    }
  }, []);

  const [
    bannerAtual,
    setBannerAtual,
  ] = useState(() => {
    return (
      anuncio?.banner ||
      localStorage.getItem(
        "bannerPronto"
      ) ||
      localStorage.getItem(
        "bannerSelecionado"
      ) ||
      ""
    );
  });

  const [
    clipAtual,
    setClipAtual,
  ] = useState(() => {
    return (
      anuncio?.clip ||
      localStorage.getItem(
        "clipPronto"
      ) ||
      localStorage.getItem(
        "clipSelecionado"
      ) ||
      ""
    );
  });

  const [
    bannersSelecionados,
    setBannersSelecionados,
  ] = useState(() => {
    try {
      const salvo =
        localStorage.getItem(
          "bannersSelecionadosPublicacao"
        );

      const lista =
        salvo
          ? JSON.parse(salvo)
          : [];

      if (
        Array.isArray(lista) &&
        lista.length > 0
      ) {
        return lista;
      }
    } catch {}

    return bannerAtual
      ? [bannerAtual]
      : [];
  });

  const [
    clipsSelecionados,
    setClipsSelecionados,
  ] = useState(() => {
    try {
      const salvo =
        localStorage.getItem(
          "clipsSelecionadosPublicacao"
        );

      const lista =
        salvo
          ? JSON.parse(salvo)
          : [];

      if (
        Array.isArray(lista) &&
        lista.length > 0
      ) {
        return lista;
      }
    } catch {}

    return clipAtual
      ? [clipAtual]
      : [];
  });

  useEffect(() => {
    function sincronizarMidiasSelecionadas() {
      try {
        const banners =
          JSON.parse(
            localStorage.getItem(
              "bannersSelecionadosPublicacao"
            ) || "[]"
          );

        const clips =
          JSON.parse(
            localStorage.getItem(
              "clipsSelecionadosPublicacao"
            ) || "[]"
          );

        setBannersSelecionados(
          Array.isArray(banners)
            ? banners
            : []
        );

        setClipsSelecionados(
          Array.isArray(clips)
            ? clips
            : []
        );

        if (
          Array.isArray(banners) &&
          banners.length > 0
        ) {
          setBannerAtual(
            banners[
              banners.length - 1
            ]
          );
        }

        if (
          Array.isArray(clips) &&
          clips.length > 0
        ) {
          setClipAtual(
            clips[
              clips.length - 1
            ]
          );
        }
      } catch (erro) {
        console.error(
          "Erro ao sincronizar mídias selecionadas:",
          erro
        );
      }
    }

    sincronizarMidiasSelecionadas();

    window.addEventListener(
      "focus",
      sincronizarMidiasSelecionadas
    );

    return () => {
      window.removeEventListener(
        "focus",
        sincronizarMidiasSelecionadas
      );
    };
  }, []);

  function removerBannerSelecionado(
    url
  ) {
    const novas =
      bannersSelecionados.filter(
        (item) =>
          item !== url
      );

    setBannersSelecionados(
      novas
    );

    localStorage.setItem(
      "bannersSelecionadosPublicacao",
      JSON.stringify(novas)
    );

    setBannerAtual(
      novas[
        novas.length - 1
      ] || ""
    );
  }

  function removerClipSelecionado(
    url
  ) {
    const novos =
      clipsSelecionados.filter(
        (item) =>
          item !== url
      );

    setClipsSelecionados(
      novos
    );

    localStorage.setItem(
      "clipsSelecionadosPublicacao",
      JSON.stringify(novos)
    );

    setClipAtual(
      novos[
        novos.length - 1
      ] || ""
    );
  }

  const [
    statusClipAtual,
    setStatusClipAtual,
  ] = useState(() => {
    return (
      localStorage.getItem(
        "clipGeracaoStatus"
      ) || ""
    );
  });

  const [
    mensagemClipAtual,
    setMensagemClipAtual,
  ] = useState(() => {
    return (
      localStorage.getItem(
        "clipGeracaoMensagem"
      ) || ""
    );
  });

  function sincronizarClipDoAnuncio() {
    const status =
      localStorage.getItem(
        "clipGeracaoStatus"
      ) || "";

    const mensagem =
      localStorage.getItem(
        "clipGeracaoMensagem"
      ) || "";

    const clipRemovido =
      localStorage.getItem(
        "clipRemovidoPublicacao"
      ) === "true";

    const clipEncontrado =
      clipRemovido
        ? ""
        : (
            localStorage.getItem(
              "clipPronto"
            ) ||
            localStorage.getItem(
              "clipSelecionado"
            ) ||
            anuncio?.clip ||
            ""
          );

    setStatusClipAtual(status);
    setMensagemClipAtual(mensagem);

    if (clipEncontrado) {
      setClipAtual(
        clipEncontrado
      );

      try {
        const salvo =
          localStorage.getItem(
            "mlAnuncioTeste"
          );

        if (salvo) {
          const dados =
            JSON.parse(salvo);

          if (
            dados?.clip !==
            clipEncontrado
          ) {
            localStorage.setItem(
              "mlAnuncioTeste",
              JSON.stringify({
                ...dados,
                clip:
                  clipEncontrado,
              })
            );
          }
        }
      } catch (erro) {
        console.error(
          "Erro ao atualizar Clip no simulador:",
          erro
        );
      }
    }
  }

  useEffect(() => {
    sincronizarClipDoAnuncio();

    const intervalo =
      window.setInterval(
        sincronizarClipDoAnuncio,
        2000
      );

    function aoClipPronto() {
      sincronizarClipDoAnuncio();
    }

    function aoClipErro() {
      sincronizarClipDoAnuncio();
    }

    window.addEventListener(
      "appia:clip-pronto",
      aoClipPronto
    );

    window.addEventListener(
      "appia:clip-erro",
      aoClipErro
    );

    return () => {
      window.clearInterval(
        intervalo
      );

      window.removeEventListener(
        "appia:clip-pronto",
        aoClipPronto
      );

      window.removeEventListener(
        "appia:clip-erro",
        aoClipErro
      );
    };
  }, []);

useEffect(() => {
  const retornarParaMidias =
    localStorage.getItem(
      "retornarParaMidiasPublicacao"
    ) === "true";

  if (retornarParaMidias) {
    localStorage.removeItem(
      "retornarParaMidiasPublicacao"
    );

    window.setTimeout(() => {
      const secao =
        document.getElementById(
          "secao-midias-publicacao"
        );

      secao?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 250);

    return;
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
}, []);

  const [
    fotos,
    setFotos,
  ] = useState(() =>
    Array.isArray(anuncio?.fotos)
      ? anuncio.fotos
      : []
  );

  function salvarFotosNoSimulador(
    novasFotos
  ) {
    setFotos(novasFotos);

    try {
      const salvo =
        localStorage.getItem(
          "mlAnuncioTeste"
        );

      const base =
        salvo
          ? JSON.parse(salvo)
          : {};

      localStorage.setItem(
        "mlAnuncioTeste",
        JSON.stringify({
          ...base,
          fotos: novasFotos,
        })
      );
    } catch (erro) {
      console.error(
        "Erro ao salvar ordem das fotos:",
        erro
      );
    }
  }

  function moverFoto(
    index,
    direcao
  ) {
    const destino =
      index + direcao;

    if (
      destino < 0 ||
      destino >= fotos.length
    ) {
      return;
    }

    const novas = [
      ...fotos,
    ];

    const atual =
      novas[index];

    novas[index] =
      novas[destino];

    novas[destino] =
      atual;

    salvarFotosNoSimulador(
      novas
    );
  }

  function excluirFotoPublicacao(
    index
  ) {
    const item =
      fotos[index];

    const url =
      obterUrlFoto(item);

    const novas =
      fotos.filter(
        (_, indice) =>
          indice !== index
      );

    salvarFotosNoSimulador(
      novas
    );

    if (
      url &&
      bannersSelecionados.includes(
        url
      )
    ) {
      removerBannerSelecionado(
        url
      );
    }
  }

  function trocarFotoPublicacao(
    index
  ) {
    const input =
      document.createElement(
        "input"
      );

    input.type = "file";
    input.accept =
      "image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp";

    input.onchange = () => {
      const arquivo =
        input.files?.[0];

      if (!arquivo) {
        return;
      }

      if (
        !String(
          arquivo.type || ""
        ).startsWith(
          "image/"
        )
      ) {
        alert(
          "Selecione uma imagem."
        );
        return;
      }

      const url =
        URL.createObjectURL(
          arquivo
        );

      const novas = [
        ...fotos,
      ];

      const anterior =
        obterUrlFoto(
          novas[index]
        );

      novas[index] = {
        id:
          `foto-trocada-${Date.now()}`,
        imagem_processada:
          url,
        tipo: "foto",
        nome:
          arquivo.name,
      };

      salvarFotosNoSimulador(
        novas
      );

      if (
        anterior &&
        bannersSelecionados.includes(
          anterior
        )
      ) {
        removerBannerSelecionado(
          anterior
        );
      }
    };

    input.click();
  }

  const [
    dimensoesFotos,
    setDimensoesFotos,
  ] = useState([]);

  const [
    validandoFotos,
    setValidandoFotos,
  ] = useState(false);

  useEffect(() => {
    let ativo = true;

    async function analisarFotos() {
      const resultados =
        await Promise.all(
          fotos.map(async (foto) => {
            const url =
              obterUrlFoto(foto);

            return {
              url,
              ...(await obterDimensoesFoto(
                url
              )),
            };
          })
        );

      if (ativo) {
        setDimensoesFotos(
          resultados
        );
      }
    }

    analisarFotos();

    return () => {
      ativo = false;
    };
  }, [fotos]);

  const [tituloAnuncio, setTituloAnuncio] =
    useState(
      anuncio?.titulo || ""
    );

  const [preco, setPreco] =
    useState(
      String(
        anuncio?.preco || ""
      )
    );

  const [codigo, setCodigo] =
    useState(
      anuncio?.codigo || ""
    );

  const [
    pesquisandoConcorrencia,
    setPesquisandoConcorrencia,
  ] = useState(false);

  const [
    resultadoConcorrencia,
    setResultadoConcorrencia,
  ] = useState(null);

  const [
    erroConcorrencia,
    setErroConcorrencia,
  ] = useState("");

  const [
    descricao,
    setDescricao,
  ] = useState(
    anuncio?.descricao || ""
  );

  const [
    categoria,
    setCategoria,
  ] = useState(() =>
    sugerirCategoriaPorTitulo(
      anuncio?.titulo || ""
    )
  );

  const [marca, setMarca] =
    useState("");

  const [
    numeroPeca,
    setNumeroPeca,
  ] = useState(
    anuncio?.codigo || ""
  );

  const [gtin, setGtin] =
    useState("");

  const [
    tipoVeiculo,
    setTipoVeiculo,
  ] = useState(
    "Carro / Caminhonete"
  );

  const [
  compatibilidades,
  setCompatibilidades,
] = useState(
  anuncio?.compatibilidades || ""
);

const [
  observacaoCompatibilidade,
  setObservacaoCompatibilidade,
] = useState(
  anuncio?.observacaoCompatibilidade ||
  ""
);

const totalCompatibilidades =
  Array.isArray(anuncio?.aplicacoes)
    ? anuncio.aplicacoes.length
    : Number(
        anuncio?.totalCompatibilidades ||
          0
      );

  const [
    canalVendaPublicacao,
    setCanalVendaPublicacao,
  ] = useState(() => {
    return (
      localStorage.getItem(
        "canalVendaAppia"
      ) ||
      anuncio?.canalVenda ||
      "mercado_livre"
    );
  });

  const [
    modalidade,
    setModalidade,
  ] = useState(() => {
    return (
      localStorage.getItem(
        "tipoAnuncioAppia"
      ) ||
      anuncio?.tipoAnuncio ||
      "classico"
    );
  });

  useEffect(() => {
    const canalSalvo =
      localStorage.getItem(
        "canalVendaAppia"
      );

    const modalidadeSalva =
      localStorage.getItem(
        "tipoAnuncioAppia"
      );

    if (canalSalvo) {
      setCanalVendaPublicacao(
        canalSalvo
      );
    }

    if (modalidadeSalva) {
      setModalidade(
        modalidadeSalva
      );
    }
  }, []);

  const [
    modoEnvio,
    setModoEnvio,
  ] = useState("meli");

  const [
    lojaOficial,
    setLojaOficial,
  ] = useState("");

  const [
    quantidadeEstoque,
    setQuantidadeEstoque,
  ] = useState("");

  const [
    sku,
    setSku,
  ] = useState(
    anuncio?.codigo || ""
  );

  const [
    larguraFabrica,
    setLarguraFabrica,
  ] = useState("");

  const [
    alturaFabrica,
    setAlturaFabrica,
  ] = useState("");

  const [
    comprimentoFabrica,
    setComprimentoFabrica,
  ] = useState("");

  const [
    pesoFabrica,
    setPesoFabrica,
  ] = useState("");

  const [
    larguraEnvio,
    setLarguraEnvio,
  ] = useState("");

  const [
    alturaEnvio,
    setAlturaEnvio,
  ] = useState("");

  const [
    comprimentoEnvio,
    setComprimentoEnvio,
  ] = useState("");

  const [
    pesoEnvio,
    setPesoEnvio,
  ] = useState("");

  const [
    condicao,
    setCondicao,
  ] = useState("novo");

  const [
    tipoGarantia,
    setTipoGarantia,
  ] = useState(
    "vendedor"
  );

  const [
    mesesGarantia,
    setMesesGarantia,
  ] = useState("3");

  const [
    limiteVenda,
    setLimiteVenda,
  ] = useState("");

  const [
    informacaoRegulatoria,
    setInformacaoRegulatoria,
  ] = useState("");

  const [
    caracteristicasSecundarias,
    setCaracteristicasSecundarias,
  ] = useState("");

  const [
    validado,
    setValidado,
  ] = useState(false);

  const [
    payloadTeste,
    setPayloadTeste,
  ] = useState(null);

  const [
    pendenciasRevisao,
    setPendenciasRevisao,
  ] = useState([]);
const [
  termoCategoria,
  setTermoCategoria,
] = useState("");

const [
  categoriaId,
  setCategoriaId,
] = useState("");

const [
  buscandoCategoria,
  setBuscandoCategoria,
] = useState(false);

const [
  opcoesCategoria,
  setOpcoesCategoria,
] = useState([]);

const [
  erroCategoria,
  setErroCategoria,
] = useState("");

  function importarBannerDoComputador() {
    const input =
      document.createElement("input");

    input.type = "file";
    input.accept =
      "image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp";

    input.onchange = () => {
      const arquivo =
        input.files?.[0];

      if (!arquivo) {
        return;
      }

      if (
        !String(
          arquivo.type || ""
        ).startsWith("image/")
      ) {
        alert(
          "Selecione uma imagem para o Banner."
        );
        return;
      }

      const urlBanner =
        URL.createObjectURL(
          arquivo
        );

      if (
        bannerAtual &&
        String(
          bannerAtual
        ).startsWith("blob:")
      ) {
        URL.revokeObjectURL(
          bannerAtual
        );
      }

      setBannerAtual(
        urlBanner
      );
    };

    input.click();
  }

  function removerBannerAtual() {
    if (
      bannerAtual &&
      String(
        bannerAtual
      ).startsWith("blob:")
    ) {
      URL.revokeObjectURL(
        bannerAtual
      );
    }

    setBannerAtual("");
  }

  function abrirGerenciadorClip() {
    localStorage.setItem(
      "retornarParaMidiasPublicacao",
      "true"
    );

    localStorage.removeItem(
      "retornarParaNovoAnuncio"
    );

    setScreen?.("clipIA");
  }

  async function buscarClipConcluidoNaGaleria() {
    const urlsFotos = fotos
      .map(obterUrlFoto)
      .filter(Boolean);

    if (urlsFotos.length === 0) {
      return null;
    }

    const {
      data: dadosUsuario,
      error: erroUsuario,
    } = await supabase.auth.getUser();

    if (erroUsuario) {
      throw erroUsuario;
    }

    const usuario =
      dadosUsuario?.user;

    if (!usuario?.id) {
      return null;
    }

    const { data, error } =
      await supabase
        .from("processamentos")
        .select(
          "imagem_processada, imagem_original, tipo, status, created_at"
        )
        .eq(
          "user_id",
          usuario.id
        )
        .in(
          "tipo",
          ["clip", "video"]
        )
        .eq(
          "status",
          "finalizado"
        )
        .in(
          "imagem_original",
          urlsFotos
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
        .limit(1);

    if (error) {
      throw error;
    }

    return Array.isArray(data) &&
      data.length > 0
      ? data[0]
      : null;
  }

  async function verificarAndamentoClip() {
    sincronizarClipDoAnuncio();

    const status =
      localStorage.getItem(
        "clipGeracaoStatus"
      ) || "";

    const clipEncontrado =
      localStorage.getItem(
        "clipPronto"
      ) ||
      localStorage.getItem(
        "clipSelecionado"
      ) ||
      "";

    if (clipEncontrado) {
      setClipAtual(clipEncontrado);
      setStatusClipAtual("pronto");
      setMensagemClipAtual(
        "✅ Clip pronto e disponível."
      );
      return;
    }

    if (status === "erro") {
      abrirGerenciadorClip();
      return;
    }

    if (status !== "gerando") {
      abrirGerenciadorClip();
      return;
    }

    setMensagemClipAtual(
      "🔄 Verificando o andamento do Clip..."
    );

    try {
      const clipGaleria =
        await buscarClipConcluidoNaGaleria();

      const urlClip =
        clipGaleria?.imagem_processada ||
        "";

      if (!urlClip) {
        setStatusClipAtual("gerando");
        setMensagemClipAtual(
          "⏳ O Clip ainda está sendo gerado. Aguarde mais um pouco e atualize novamente."
        );
        return;
      }

      localStorage.removeItem(
        "clipRemovidoPublicacao"
      );

      localStorage.setItem(
        "clipPronto",
        urlClip
      );

      localStorage.setItem(
        "clipSelecionado",
        urlClip
      );

      localStorage.setItem(
        "clipGeracaoStatus",
        "pronto"
      );

      localStorage.setItem(
        "clipGeracaoMensagem",
        "✅ Clip pronto, recuperado da Galeria e vinculado ao anúncio"
      );

      setClipAtual(urlClip);
      setStatusClipAtual("pronto");
      setMensagemClipAtual(
        "✅ Clip pronto e recuperado da Galeria."
      );

      try {
        const salvo =
          localStorage.getItem(
            "mlAnuncioTeste"
          );

        if (salvo) {
          const dados =
            JSON.parse(salvo);

          localStorage.setItem(
            "mlAnuncioTeste",
            JSON.stringify({
              ...dados,
              clip: urlClip,
            })
          );
        }
      } catch (erro) {
        console.error(
          "Erro ao vincular Clip recuperado ao simulador:",
          erro
        );
      }

      window.dispatchEvent(
        new CustomEvent(
          "appia:clip-pronto",
          {
            detail: {
              urlClip,
            },
          }
        )
      );
    } catch (erro) {
      console.error(
        "Erro ao verificar andamento do Clip:",
        erro
      );

      setStatusClipAtual("gerando");
      setMensagemClipAtual(
        "⚠️ Não foi possível consultar a Galeria agora. O Clip pode continuar sendo gerado em segundo plano."
      );
    }
  }

  function importarClipDoComputador() {
    const input =
      document.createElement("input");

    input.type = "file";
    input.accept = "video/mp4,.mp4";

    input.onchange = () => {
      const arquivo =
        input.files?.[0];

      if (!arquivo) {
        return;
      }

      const nome =
        String(
          arquivo.name || ""
        ).toLowerCase();

      const ehMp4 =
        arquivo.type === "video/mp4" ||
        nome.endsWith(".mp4");

      if (!ehMp4) {
        alert(
          "Selecione um vídeo MP4."
        );
        return;
      }

      const urlClip =
        URL.createObjectURL(
          arquivo
        );

      localStorage.removeItem(
        "clipRemovidoPublicacao"
      );

      setClipAtual(urlClip);
      setStatusClipAtual("pronto");
      setMensagemClipAtual(
        "✅ Clip MP4 importado para o anúncio."
      );
    };

    input.click();
  }

  function removerClipAtual() {
    if (
      clipAtual &&
      String(clipAtual).startsWith(
        "blob:"
      )
    ) {
      URL.revokeObjectURL(
        clipAtual
      );
    }

    localStorage.setItem(
      "clipRemovidoPublicacao",
      "true"
    );

    localStorage.removeItem(
      "clipPronto"
    );

    localStorage.removeItem(
      "clipSelecionado"
    );

    localStorage.removeItem(
      "clipGeracaoStatus"
    );

    localStorage.removeItem(
      "clipGeracaoMensagem"
    );

    localStorage.removeItem(
      "clipGeracaoErro"
    );

    try {
      const salvo =
        localStorage.getItem(
          "mlAnuncioTeste"
        );

      if (salvo) {
        const dados =
          JSON.parse(salvo);

        localStorage.setItem(
          "mlAnuncioTeste",
          JSON.stringify({
            ...dados,
            clip: "",
            clip_url: "",
          })
        );
      }
    } catch (erro) {
      console.error(
        "Erro ao remover Clip do anúncio de teste:",
        erro
      );
    }

    setClipAtual("");
    setStatusClipAtual("");
    setMensagemClipAtual("");
  }

  function abrirClipAtual() {
    if (!clipAtual) {
      verificarAndamentoClip();
      return;
    }

    window.open(
      clipAtual,
      "_blank",
      "noopener,noreferrer"
    );
  }

function formatarPrecoMercado(valor) {
  const numero = Number(valor);

  if (!Number.isFinite(numero)) {
    return "—";
  }

  return numero.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function normalizarCodigoMercado(valor = "") {
  return String(valor || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

async function pesquisarConcorrenciaPaizinho() {
  const codigoBusca =
    String(codigo || numeroPeca || "").trim();

  const tituloBusca =
    String(tituloAnuncio || "").trim();

  const termoBusca =
    [codigoBusca, tituloBusca]
      .filter(Boolean)
      .join(" ")
      .trim();

  if (!termoBusca) {
    alert(
      "Informe o código ou o título da peça antes de pesquisar a concorrência."
    );
    return;
  }

  setPesquisandoConcorrencia(true);
  setErroConcorrencia("");
  setResultadoConcorrencia(null);

  try {
    const { data, error } =
      await supabase.functions.invoke(
        "concorrencia",
        {
          body: {
            termo: termoBusca,
            codigo: codigoBusca,
            titulo: tituloBusca,
            fabricante:
              String(marca || "").trim(),
            peca: tituloBusca,
            categoria:
              String(categoria || "").trim(),
          },
        }
      );

    if (error) {
      throw new Error(
        error?.message ||
          "A função de concorrência não respondeu."
      );
    }

    if (!data?.ok && !data?.sucesso) {
      throw new Error(
        data?.erro ||
          data?.error ||
          "Não foi possível coletar preços da concorrência."
      );
    }

    const converterPreco = (valor) => {
      if (typeof valor === "number") {
        return Number.isFinite(valor)
          ? valor
          : null;
      }

      const texto = String(valor ?? "")
        .replace(/R\$/gi, "")
        .replace(/\s/g, "")
        .trim();

      if (!texto) {
        return null;
      }

      const normalizado =
        texto.includes(",")
          ? texto
              .replace(/\./g, "")
              .replace(",", ".")
          : texto;

      const numero = Number(normalizado);

      return Number.isFinite(numero)
        ? numero
        : null;
    };

    const prepararItens = (
      lista,
      marketplacePadrao
    ) => {
      return (Array.isArray(lista) ? lista : [])
        .map((item, index) => ({
          id:
            item?.id ||
            `${marketplacePadrao}-${index}`,
          marketplace:
            item?.marketplace ||
            marketplacePadrao,
          titulo:
            item?.titulo ||
            item?.title ||
            "",
          preco: converterPreco(
            item?.preco ?? item?.price
          ),
          link:
            item?.link ||
            item?.url ||
            "",
          fonte: item?.fonte || "",
          categoria:
            item?.categoria || "",
        }))
        .filter(
          (item) =>
            Number.isFinite(item.preco) &&
            item.preco > 0
        );
    };

    const itensMercadoLivre =
      prepararItens(
        data?.mercadoLivre,
        "Mercado Livre"
      );

    const itensShopee =
      prepararItens(
        data?.shopee,
        "Shopee"
      );

    const todosItens = [
      ...itensMercadoLivre,
      ...itensShopee,
    ];

    const precos = todosItens
      .map((item) => item.preco)
      .filter(
        (valor) =>
          Number.isFinite(valor) &&
          valor > 0
      )
      .sort((a, b) => a - b);

    if (!precos.length) {
      throw new Error(
        "O Paizinho pesquisou, mas não encontrou preços comparáveis no Mercado Livre ou Shopee."
      );
    }

    const media =
      precos.reduce(
        (total, valor) => total + valor,
        0
      ) / precos.length;

    const indiceBaixo = Math.floor(
      (precos.length - 1) * 0.2
    );

    const indiceAlto = Math.ceil(
      (precos.length - 1) * 0.8
    );

    const faixaMin = precos[indiceBaixo];
    const faixaMax = precos[indiceAlto];
    const menor = precos[0];

    const precoUsuario = converterPreco(preco);

    let analise =
      `O Paizinho encontrou ${precos.length} preço(s) comparável(is): ` +
      `${itensMercadoLivre.length} no Mercado Livre e ` +
      `${itensShopee.length} na Shopee.`;

    if (
      Number.isFinite(precoUsuario) &&
      precoUsuario > 0
    ) {
      const diferencaPercentual =
        ((precoUsuario - media) / media) * 100;

      if (precoUsuario < faixaMin) {
        analise =
          `Seu preço está abaixo da faixa principal encontrada e ` +
          `${Math.abs(diferencaPercentual).toFixed(1)}% abaixo da média. ` +
          `Foram usados ${itensMercadoLivre.length} resultado(s) do Mercado Livre e ` +
          `${itensShopee.length} da Shopee.`;
      } else if (precoUsuario > faixaMax) {
        analise =
          `Seu preço está acima da faixa principal encontrada e ` +
          `${Math.abs(diferencaPercentual).toFixed(1)}% acima da média. ` +
          `Foram usados ${itensMercadoLivre.length} resultado(s) do Mercado Livre e ` +
          `${itensShopee.length} da Shopee.`;
      } else {
        analise =
          `Seu preço está dentro da faixa principal encontrada e ` +
          `${Math.abs(diferencaPercentual).toFixed(1)}% ` +
          `${diferencaPercentual >= 0 ? "acima" : "abaixo"} da média. ` +
          `Foram usados ${itensMercadoLivre.length} resultado(s) do Mercado Livre e ` +
          `${itensShopee.length} da Shopee.`;
      }
    }

    const palavrasChaveSugeridas =
      (Array.isArray(data?.palavrasChaveSugeridas)
        ? data.palavrasChaveSugeridas
        : [])
        .map((item) => {
          if (typeof item === "string") {
            return {
              termo: item,
              ocorrencias: 1,
            };
          }

          return {
            termo: String(
              item?.termo ||
                item?.palavra ||
                item?.keyword ||
                ""
            ).trim(),
            ocorrencias: Number(
              item?.ocorrencias ||
                item?.quantidade ||
                1
            ),
          };
        })
        .filter((item) => item.termo);

    setResultadoConcorrencia({
      menor,
      media,
      faixaMin,
      faixaMax,
      quantidade: precos.length,
      analise,
      termo:
        data?.termo || termoBusca,
      mercadoLivre: itensMercadoLivre,
      shopee: itensShopee,
      itens: todosItens.slice(0, 10),
      palavrasChaveSugeridas,
      diagnostico:
        data?.diagnostico || null,
    });

    console.log(
      "✅ CONCORRÊNCIA APPIA:",
      data
    );
  } catch (erroPesquisa) {
    console.error(
      "❌ Erro ao pesquisar concorrência:",
      erroPesquisa
    );

    setErroConcorrencia(
      erroPesquisa?.message ||
        "Não foi possível pesquisar a concorrência agora."
    );
  } finally {
    setPesquisandoConcorrencia(false);
  }
}

async function atualizarCategoria() {
  const termo =
    String(
      termoCategoria || ""
    ).trim();

  if (!termo) {
    alert(
      "Digite o nome da peça para buscar a categoria."
    );

    return;
  }

  setBuscandoCategoria(true);
  setErroCategoria("");
  setCategoria("");
  setCategoriaId("");
  setOpcoesCategoria([]);

  try {
    const resposta =
      await fetch(
        "https://api.mercadolibre.com/sites/MLB/domain_discovery/search" +
          `?q=${encodeURIComponent(
            termo
          )}` +
          "&limit=8"
      );

    if (!resposta.ok) {
      throw new Error(
        `Erro Mercado Livre: ${resposta.status}`
      );
    }

    const dados =
      await resposta.json();

    const lista =
      Array.isArray(dados)
        ? dados
        : [];

    if (!lista.length) {
      throw new Error(
        "Nenhuma categoria encontrada para esta peça."
      );
    }

    const categorias =
      await Promise.all(
        lista
          .filter(
            (item) =>
              item?.category_id
          )
          .slice(0, 5)
          .map(
            async (item) => {
              try {
                const respostaDetalhe =
                  await fetch(
                    `https://api.mercadolibre.com/categories/${item.category_id}`
                  );

                if (
                  !respostaDetalhe.ok
                ) {
                  return {
                    id:
                      item.category_id,
                    nome:
                      item.category_name ||
                      "",
                    caminho:
                      item.category_name ||
                      "",
                  };
                }

                const detalhe =
                  await respostaDetalhe.json();

                const caminho =
                  Array.isArray(
                    detalhe
                      ?.path_from_root
                  )
                    ? detalhe
                        .path_from_root
                        .map(
                          (nivel) =>
                            nivel?.name
                        )
                        .filter(Boolean)
                        .join(" > ")
                    : "";

                return {
                  id:
                    item.category_id,

                  nome:
                    detalhe?.name ||
                    item.category_name ||
                    "",

                  caminho:
                    caminho ||
                    detalhe?.name ||
                    item.category_name ||
                    "",
                };
              } catch {
                return {
                  id:
                    item.category_id,

                  nome:
                    item.category_name ||
                    "",

                  caminho:
                    item.category_name ||
                    "",
                };
              }
            }
          )
      );

    const validas =
      categorias.filter(
        (item) =>
          item?.id &&
          item?.caminho
      );

    if (!validas.length) {
      throw new Error(
        "O Mercado Livre não retornou uma categoria válida."
      );
    }

    const principal =
      validas[0];

    setCategoria(
      principal.caminho
    );

    setCategoriaId(
      principal.id
    );

    setOpcoesCategoria(
      validas
    );

    console.log(
      "✅ CATEGORIAS MERCADO LIVRE:",
      validas
    );
  } catch (erro) {
    console.error(
      "❌ ERRO CATEGORIA MERCADO LIVRE:",
      erro
    );

    setCategoria("");
    setCategoriaId("");
    setOpcoesCategoria([]);

    setErroCategoria(
      erro?.message ||
        "Não foi possível consultar a categoria no Mercado Livre."
    );
  } finally {
    setBuscandoCategoria(false);
  }
}

  function salvarEstadoAtualDoTeste() {
    try {
      const salvo =
        localStorage.getItem(
          "mlAnuncioTeste"
        );

      const base =
        salvo
          ? JSON.parse(salvo)
          : {};

      localStorage.setItem(
        "mlAnuncioTeste",
        JSON.stringify({
          ...base,
          titulo:
            tituloAnuncio,
          codigo,
          preco,
          descricao,
          fotos,
          banner:
            bannerAtual || "",
          banners:
            bannersSelecionados,
          clip:
            clipAtual || "",
          clips:
            clipsSelecionados,
          compatibilidades,
          observacaoCompatibilidade,
          canalVenda:
            canalVendaPublicacao,
          tipoAnuncio:
            modalidade,
        })
      );
    } catch (erro) {
      console.error(
        "Erro ao preservar dados do simulador:",
        erro
      );
    }
  }

  function exportarAnuncio() {
    if (!payloadTeste) {
      alert(
        "Valide o anúncio antes de exportar."
      );
      return;
    }

    const codigoArquivo =
      String(
        codigo ||
          numeroPeca ||
          "anuncio"
      )
        .trim()
        .replace(
          /[^a-zA-Z0-9-_]+/g,
          "-"
        ) || "anuncio";

    const blob =
      new Blob(
        [
          JSON.stringify(
            payloadTeste,
            null,
            2
          ),
        ],
        {
          type:
            "application/json;charset=utf-8",
        }
      );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;
    link.download =
      `appia-${codigoArquivo}.json`;

    document.body.appendChild(
      link
    );

    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  }

  function abrirMidiasAppia() {
    salvarEstadoAtualDoTeste();

    setScreen?.(
      "midiasAppia"
    );
  }

  function irParaCentralPublicacao() {
    salvarEstadoAtualDoTeste();

    setScreen?.(
      "centralPublicacao"
    );
  }

  async function validarAnuncio() {
    salvarEstadoAtualDoTeste();

    const faltando = [];

    setPendenciasRevisao([]);

    if (tituloAnuncio.trim().length > 60) {
      alert(
        "⚠ O título do Mercado Livre não pode passar de 60 caracteres."
      );
      setValidado(false);
      setPayloadTeste(null);
      setPendenciasRevisao([
        "Título acima de 60 caracteres.",
      ]);
      return;
    }

    if (!tituloAnuncio.trim()) {
      faltando.push(
        "Título"
      );
    }

    if (!preco) {
      faltando.push(
        "Preço"
      );
    }

    if (!descricao.trim()) {
      faltando.push(
        "Descrição"
      );
    }

    if (!fotos.length) {
      faltando.push(
        "Fotos"
      );
    }

    if (fotos.length) {
      setValidandoFotos(true);

      const verificacaoFotos =
        await Promise.all(
          fotos.map(async (foto) => {
            const url =
              obterUrlFoto(foto);

            return {
              url,
              ...(await obterDimensoesFoto(
                url
              )),
            };
          })
        );

      setDimensoesFotos(
        verificacaoFotos
      );

      setValidandoFotos(false);

      const fotosInvalidas =
        verificacaoFotos.filter(
          (item) => !item.ok
        );

      if (fotosInvalidas.length) {
        alert(
          "❌ Publicação bloqueada.\n\n" +
          `${fotosInvalidas.length} foto(s) estão abaixo de 1200 x 1200 ou não puderam ser verificadas.\n\n` +
          "O APPIA exige no mínimo 1200 x 1200 para o padrão de publicação."
        );

        setValidado(false);
        setPayloadTeste(null);
        setPendenciasRevisao([
          `${fotosInvalidas.length} foto(s) abaixo de 1200 x 1200 ou não verificadas.`,
        ]);
        return;
      }
    }

    if (!categoria.trim()) {
      faltando.push(
        "Categoria"
      );
    }

    if (!marca.trim()) {
      faltando.push(
        "Marca"
      );
    }

    if (!numeroPeca.trim()) {
      faltando.push(
        "Número da peça"
      );
    }

    if (!tipoVeiculo.trim()) {
      faltando.push(
        "Tipo de veículo"
      );
    }

    if (!modoEnvio) {
      faltando.push(
        "Modo de envio"
      );
    }

    if (!condicao) {
      faltando.push(
        "Condição"
      );
    }

    if (
      faltando.length > 0
    ) {
      setValidado(false);

      setPayloadTeste(
        null
      );

      setPendenciasRevisao(
        faltando.map(
          (item) =>
            `${item} precisa ser preenchido.`
        )
      );

      alert(
        "⚠ Campos obrigatórios:\n\n" +
          faltando.join("\n")
      );

      return;
    }

    const imagensPublicacao = [
      ...fotos
        .map(
          obterUrlFoto
        )
        .filter(Boolean),
      ...bannersSelecionados.filter(
        Boolean
      ),
    ].filter(
      (url, index, lista) =>
        lista.indexOf(url) ===
        index
    );

    const videosPublicacao =
      clipsSelecionados
        .filter(Boolean)
        .filter(
          (url, index, lista) =>
            lista.indexOf(url) ===
            index
        );

    const payload = {
      modo:
        "SIMULADOR",

      titulo:
        tituloAnuncio,

      codigo,

      preco,

      categoria: {
  caminho:
    categoria,

  idMercadoLivre:
    categoriaId || null,
},

      venda: {
        canal:
          canalVendaPublicacao,

        modalidade,

        lojaOficial,

        estoque:
          quantidadeEstoque,

        sku,

        limiteUnidades:
          limiteVenda,
      },

      atributos: {
        marca,

        numeroPeca,

        gtin,

        tipoVeiculo,

        caracteristicasSecundarias,

        informacaoRegulatoria,
      },

      embalagemFabrica: {
        largura:
          larguraFabrica,

        altura:
          alturaFabrica,

        comprimento:
          comprimentoFabrica,

        peso:
          pesoFabrica,
      },

      embalagemEnvio: {
        largura:
          larguraEnvio,

        altura:
          alturaEnvio,

        comprimento:
          comprimentoEnvio,

        peso:
          pesoEnvio,
      },

      compatibilidade: {
        dados:
          compatibilidades,

        observacao:
          observacaoCompatibilidade,
      },

      imagens:
        imagensPublicacao,

      fotos:
        imagensPublicacao,

      banners:
        bannersSelecionados,

      videos:
        videosPublicacao,

      clips:
        videosPublicacao,

      envio:
        modoEnvio,

      pagamento:
        "Mercado Pago",

      descricao,

      condicao,

      garantia: {
        tipo:
          tipoGarantia,

        meses:
          mesesGarantia,
      },
    };

    setPayloadTeste(
      payload
    );

    setValidado(true);
    setPendenciasRevisao([]);

    localStorage.setItem(
      "mlPayloadTeste",
      JSON.stringify(
        payload
      )
    );

    alert(
      "✅ Simulação aprovada.\n\nNenhum dado foi enviado ao Mercado Livre."
    );
  }

  if (!anuncio) {
    return (
      <div
        style={{
          width: "100%",
          maxWidth: "1180px",
          margin:
            "30px auto",
        }}
      >
        <section style={cabecalho}>
          <h2
            style={{
              color:
                "#67e8f9",
            }}
          >
            🧪 Simulador Mercado Livre
          </h2>

          <p
            style={{
              color:
                "#fca5a5",
            }}
          >
            Nenhum anúncio de teste
            foi encontrado.
          </p>

          <button
            type="button"
            onClick={() =>
              setScreen?.(
                "centralPublicacao"
              )
            }
            style={botaoSecundario}
          >
            ⬅ Voltar
          </button>
        </section>
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "1180px",
        margin: "30px auto",
      }}
    >
      <section style={cabecalho}>
        <div
          style={{
            fontSize: "42px",
          }}
        >
          🧪
        </div>

        <h2
          style={{
            color: "#67e8f9",
            margin:
              "8px 0 6px 0",
          }}
        >
          Simulador Mercado Livre
        </h2>

        <p
          style={{
            color: "#bfdbfe",
            margin: 0,
          }}
        >
          Revise todo o anúncio como
          se fosse publicar no Mercado
          Livre. Nada será enviado.
        </p>
      </section>

      {/* 1 - DADOS DO ANÚNCIO */}
      <section style={bloco}>
        <h3 style={titulo}>
          ① Dados do anúncio
        </h3>

        <Campo
          label="Título Mercado Livre"
          value={tituloAnuncio}
          onChange={
            setTituloAnuncio
          }
          placeholder="Produto + modelos + motor + ano + código"
          maxLength={60}
        />

        <div
          style={{
            marginTop: "7px",
            display: "flex",
            justifyContent:
              "space-between",
            gap: "10px",
            flexWrap: "wrap",
            fontSize: "12px",
          }}
        >
          <span
            style={{
              color: "#94a3b8",
            }}
          >
            Sugestão: produto + principais modelos + motor + ano + código.
          </span>

          <strong
            style={{
              color:
                tituloAnuncio.length >= 55
                  ? "#facc15"
                  : "#86efac",
            }}
          >
            {tituloAnuncio.length}/60
          </strong>
        </div>

        <div style={gradeDois}>
          <Campo
            label="Código"
            value={codigo}
            onChange={setCodigo}
            placeholder="Código da peça"
          />

          <Campo
            label="Preço"
            value={preco}
            onChange={setPreco}
            placeholder="0,00"
          />
        </div>

        <div
          style={{
            marginTop: "12px",
            padding: "12px",
            borderRadius: "10px",
            border:
              "1px solid #334155",
            background:
              "#020617",
            color: "#cbd5e1",
            fontSize: "13px",
          }}
        >
          🖼 {fotos.length} foto(s)
          recebida(s) do anúncio.
        </div>
      </section>

      {/* PAIIA - INTELIGÊNCIA DE BUSCA */}
      <section
        style={{
          ...bloco,
          border: "1px solid #0891b2",
          background:
            "linear-gradient(135deg,#0f172a,#083344)",
          boxShadow:
            "0 12px 30px rgba(8,145,178,.10)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            gap: "14px",
            flexWrap: "wrap",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              textAlign: "left",
              flex: "1 1 520px",
            }}
          >
            <h3
              style={{
                ...titulo,
                marginBottom: "6px",
              }}
            >
              🔎 PAIIA — Inteligência de Busca
            </h3>

            <div
              style={{
                color: "#a5f3fc",
                fontSize: "13px",
                lineHeight: "1.5",
              }}
            >
              Palavras-chave encontradas no anúncio e
              nos concorrentes para ajudar o algoritmo
              a entender melhor o produto.
            </div>
          </div>

          <button
            type="button"
            onClick={
              pesquisarConcorrenciaPaizinho
            }
            disabled={
              pesquisandoConcorrencia
            }
            style={{
              padding: "13px 18px",
              borderRadius: "10px",
              border:
                "1px solid #22d3ee",
              background: "#0e7490",
              color: "#ffffff",
              fontWeight: "bold",
              fontSize: "14px",
              cursor:
                pesquisandoConcorrencia
                  ? "wait"
                  : "pointer",
              opacity:
                pesquisandoConcorrencia
                  ? 0.75
                  : 1,
              whiteSpace: "nowrap",
            }}
          >
            {pesquisandoConcorrencia
              ? "⏳ Analisando buscas..."
              : resultadoConcorrencia
                ? "🔄 Atualizar palavras-chave"
                : "✨ Gerar palavras-chave"}
          </button>
        </div>

        {(() => {
          const ignorar = new Set([
            "para",
            "com",
            "sem",
            "por",
            "uma",
            "um",
            "das",
            "dos",
            "de",
            "do",
            "da",
            "e",
            "a",
            "o",
            "no",
            "na",
            "em",
            "novo",
            "nova",
            "produto",
            "peca",
            "peça",
            "original",
          ]);

          const palavras = [];
          const vistos = new Set();

          const adicionar = (valor, origem = "anuncio") => {
            const termo = String(valor || "")
              .replace(/\s+/g, " ")
              .trim();

            if (!termo) {
              return;
            }

            const chave = normalizarTexto(termo);

            if (!chave || vistos.has(chave)) {
              return;
            }

            vistos.add(chave);
            palavras.push({
              termo,
              origem,
            });
          };

          adicionar(
            codigo || numeroPeca,
            "codigo"
          );

          adicionar(marca, "marca");

          const sugeridas =
            Array.isArray(
              resultadoConcorrencia
                ?.palavrasChaveSugeridas
            )
              ? resultadoConcorrencia
                  .palavrasChaveSugeridas
              : [];

          sugeridas.forEach((item) => {
            adicionar(
              item?.termo || item,
              "concorrencia"
            );
          });

          String(tituloAnuncio || "")
            .replace(/[^a-zA-ZÀ-ÿ0-9\s-]/g, " ")
            .split(/\s+/)
            .map((item) => item.trim())
            .filter(Boolean)
            .filter((item) => {
              const normalizado =
                normalizarTexto(item);

              return (
                normalizado.length >= 3 &&
                !ignorar.has(normalizado)
              );
            })
            .forEach((item) =>
              adicionar(item, "titulo")
            );

          const principais =
            palavras.slice(0, 14);

          const buscaRecomendada =
            principais
              .slice(0, 6)
              .map((item) => item.termo)
              .join(" ");

          return (
            <>
              <div
                style={{
                  padding: "14px",
                  borderRadius: "12px",
                  border:
                    "1px solid #164e63",
                  background: "#020617",
                  textAlign: "left",
                }}
              >
                <div
                  style={{
                    color: "#67e8f9",
                    fontSize: "12px",
                    fontWeight: "bold",
                    marginBottom: "10px",
                  }}
                >
                  PALAVRAS-CHAVE PRINCIPAIS
                </div>

                {principais.length > 0 ? (
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      flexWrap: "wrap",
                    }}
                  >
                    {principais.map(
                      (item, index) => (
                        <span
                          key={`${item.termo}-${index}`}
                          title={
                            item.origem ===
                            "concorrencia"
                              ? "Encontrada nos anúncios concorrentes"
                              : item.origem ===
                                  "codigo"
                                ? "Código principal da peça"
                                : item.origem ===
                                    "marca"
                                  ? "Marca do produto"
                                  : "Encontrada no título"
                          }
                          style={{
                            padding: "8px 11px",
                            borderRadius: "999px",
                            border:
                              item.origem ===
                              "concorrencia"
                                ? "1px solid #22d3ee"
                                : item.origem ===
                                    "codigo"
                                  ? "1px solid #60a5fa"
                                  : "1px solid #334155",
                            background:
                              item.origem ===
                              "concorrencia"
                                ? "#164e63"
                                : item.origem ===
                                    "codigo"
                                  ? "#172554"
                                  : "#0f172a",
                            color: "#e0f2fe",
                            fontSize: "12px",
                            fontWeight: "bold",
                          }}
                        >
                          {item.termo}
                        </span>
                      )
                    )}
                  </div>
                ) : (
                  <div
                    style={{
                      color: "#94a3b8",
                      fontSize: "13px",
                    }}
                  >
                    Preencha o título e o código para
                    começar a montar as palavras-chave.
                  </div>
                )}
              </div>

              <div
                style={{
                  marginTop: "12px",
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit,minmax(250px,1fr))",
                  gap: "10px",
                }}
              >
                <div
                  style={{
                    padding: "12px 14px",
                    borderRadius: "10px",
                    border:
                      "1px solid #164e63",
                    background: "#082f49",
                    textAlign: "left",
                  }}
                >
                  <div
                    style={{
                      color: "#67e8f9",
                      fontSize: "11px",
                      fontWeight: "bold",
                      marginBottom: "5px",
                    }}
                  >
                    🔍 BUSCA RECOMENDADA
                  </div>

                  <div
                    style={{
                      color: "#f8fafc",
                      fontSize: "13px",
                      lineHeight: "1.45",
                      fontWeight: "bold",
                    }}
                  >
                    {buscaRecomendada ||
                      "Aguardando dados do anúncio"}
                  </div>
                </div>

                <div
                  style={{
                    padding: "12px 14px",
                    borderRadius: "10px",
                    border:
                      "1px solid #334155",
                    background: "#020617",
                    textAlign: "left",
                  }}
                >
                  <div
                    style={{
                      color: "#a5f3fc",
                      fontSize: "11px",
                      fontWeight: "bold",
                      marginBottom: "5px",
                    }}
                  >
                    🧠 LEITURA DA PAIIA
                  </div>

                  <div
                    style={{
                      color: "#cbd5e1",
                      fontSize: "12px",
                      lineHeight: "1.5",
                    }}
                  >
                    {erroConcorrencia
                      ? `⚠️ ${erroConcorrencia}`
                      : resultadoConcorrencia
                        ? `${principais.length} termo(s) relevante(s) preparados. ${sugeridas.length} vieram da análise dos anúncios encontrados.`
                        : "As palavras do título já são analisadas. Clique em “Gerar palavras-chave” para enriquecer a lista com termos recorrentes da concorrência."}
                  </div>
                </div>
              </div>

              <div
                style={{
                  marginTop: "12px",
                  padding: "10px 12px",
                  borderRadius: "9px",
                  border:
                    "1px dashed #155e75",
                  color: "#94a3b8",
                  background:
                    "rgba(2,6,23,.55)",
                  fontSize: "11px",
                  lineHeight: "1.5",
                  textAlign: "left",
                }}
              >
                ℹ️ Nesta etapa a PAIIA apenas sugere
                termos. O título e a descrição não são
                alterados automaticamente.
              </div>
            </>
          );
        })()}
      </section>

      {/* 2 - VENDA */}
      <section style={bloco}>
        <h3 style={titulo}>
          ② Condições de venda
        </h3>

        <div style={gradeDois}>
          <label style={labelStyle}>
            Canal / tipo de anúncio

            <div
              style={{
                ...campo,
                minHeight: "44px",
                display: "flex",
                alignItems: "center",
                fontWeight: "700",
                border:
                  canalVendaPublicacao ===
                  "shopee"
                    ? "1px solid #fb923c"
                    : modalidade ===
                        "premium"
                      ? "1px solid #22c55e"
                      : "1px solid #38bdf8",
                color:
                  canalVendaPublicacao ===
                  "shopee"
                    ? "#fdba74"
                    : modalidade ===
                        "premium"
                      ? "#86efac"
                      : "#7dd3fc",
              }}
            >
              {canalVendaPublicacao ===
              "shopee"
                ? "🟠 Shopee"
                : modalidade ===
                    "premium"
                  ? "🟢 Mercado Livre Premium"
                  : "🔵 Mercado Livre Clássico"}
            </div>

            <span
              style={{
                display: "block",
                marginTop: "6px",
                color: "#94a3b8",
                fontSize: "11px",
                lineHeight: 1.4,
              }}
            >
              Definido automaticamente na
              Inteligência Comercial do anúncio.
            </span>
          </label>

          <Campo
            label="Estoque"
            value={
              quantidadeEstoque
            }
            onChange={
              setQuantidadeEstoque
            }
            placeholder="Ex.: 10"
          />

          <Campo
            label="SKU"
            value={sku}
            onChange={setSku}
            placeholder="Código interno"
          />

          <Campo
            label="Loja oficial"
            value={
              lojaOficial
            }
            onChange={
              setLojaOficial
            }
            placeholder="Ex.: Torken"
          />
        </div>
      </section>

      {/* 3 - ENTREGA */}
      <section style={bloco}>
        <h3 style={titulo}>
          ③ Forma de entrega
        </h3>

        <label style={labelStyle}>
          Modo de envio

          <select
            value={modoEnvio}
            onChange={(e) =>
              setModoEnvio(
                e.target.value
              )
            }
            style={campo}
          >
            <option value="">
              Selecione
            </option>

            <option value="meli">
              Mercado Envios
            </option>

            <option value="full">
              Mercado Envios Full
            </option>

            <option value="flex">
              Mercado Envios Flex
            </option>

            <option value="retirada">
              Retirada
            </option>
          </select>
        </label>
      </section>

      {/* 4 - FOTOS E MÍDIAS OPCIONAIS */}
      <section style={bloco}>
        <h3 style={titulo}>
          ④ Fotos do anúncio
        </h3>

        <div style={gradeFotos}>
          {fotos.map(
            (foto, index) => {
              const url =
                obterUrlFoto(
                  foto
                );

              const dimensao =
                dimensoesFotos[index];

              return (
                <div
                  key={
                    typeof foto ===
                    "string"
                      ? `${foto}-${index}`
                      : foto?.id ||
                        `${url}-${index}`
                  }
                  style={{
                    ...fotoCard,
                    position:
                      "relative",
                    height: "auto",
                    minHeight:
                      "170px",
                    padding:
                      "8px",
                    display:
                      "flex",
                    flexDirection:
                      "column",
                    gap: "7px",
                    border:
                      dimensao?.ok === false
                        ? "2px solid #ef4444"
                        : dimensao?.ok
                          ? "2px solid #22c55e"
                          : "1px solid #334155",
                  }}
                >
                  {index === 0 && (
                    <div
                      style={{
                        position:
                          "absolute",
                        top: "7px",
                        left: "7px",
                        zIndex: 3,
                        padding:
                          "4px 7px",
                        borderRadius:
                          "7px",
                        background:
                          "#16a34a",
                        color:
                          "#ffffff",
                        fontSize:
                          "10px",
                        fontWeight:
                          "bold",
                      }}
                    >
                      ⭐ CAPA
                    </div>
                  )}

                  <div
                    style={{
                      position:
                        "relative",
                      width: "100%",
                      height:
                        "120px",
                      borderRadius:
                        "8px",
                      overflow:
                        "hidden",
                      background:
                        "#ffffff",
                      display:
                        "flex",
                      alignItems:
                        "center",
                      justifyContent:
                        "center",
                    }}
                  >
                    {url ? (
                      <img
                        src={url}
                        alt={`Foto ${
                          index + 1
                        }`}
                        style={{
                          width:
                            "100%",
                          height:
                            "100%",
                          objectFit:
                            "contain",
                        }}
                      />
                    ) : (
                      <span
                        style={{
                          color:
                            "#64748b",
                        }}
                      >
                        Sem imagem
                      </span>
                    )}

                    {dimensao && (
                      <span
                        style={{
                          position:
                            "absolute",
                          left: "5px",
                          right: "5px",
                          bottom:
                            "5px",
                          padding:
                            "3px 5px",
                          borderRadius:
                            "6px",
                          background:
                            "rgba(2,6,23,0.88)",
                          color:
                            dimensao.ok
                              ? "#86efac"
                              : "#fca5a5",
                          fontSize:
                            "10px",
                          fontWeight:
                            "bold",
                          textAlign:
                            "center",
                        }}
                      >
                        {dimensao.largura} ×{" "}
                        {dimensao.altura}
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      display:
                        "grid",
                      gridTemplateColumns:
                        "repeat(2,1fr)",
                      gap: "6px",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        moverFoto(
                          index,
                          -1
                        )
                      }
                      disabled={
                        index === 0
                      }
                      style={{
                        padding:
                          "7px",
                        borderRadius:
                          "7px",
                        border:
                          "1px solid #2563eb",
                        background:
                          index === 0
                            ? "#1e293b"
                            : "#1d4ed8",
                        color:
                          "#ffffff",
                        cursor:
                          index === 0
                            ? "not-allowed"
                            : "pointer",
                      }}
                    >
                      ⬅
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        moverFoto(
                          index,
                          1
                        )
                      }
                      disabled={
                        index ===
                        fotos.length - 1
                      }
                      style={{
                        padding:
                          "7px",
                        borderRadius:
                          "7px",
                        border:
                          "1px solid #2563eb",
                        background:
                          index ===
                          fotos.length - 1
                            ? "#1e293b"
                            : "#1d4ed8",
                        color:
                          "#ffffff",
                        cursor:
                          index ===
                          fotos.length - 1
                            ? "not-allowed"
                            : "pointer",
                      }}
                    >
                      ➡
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        trocarFotoPublicacao(
                          index
                        )
                      }
                      style={{
                        padding:
                          "7px",
                        borderRadius:
                          "7px",
                        border:
                          "1px solid #22d3ee",
                        background:
                          "#083344",
                        color:
                          "#cffafe",
                        cursor:
                          "pointer",
                      }}
                    >
                      🔄 Trocar
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        excluirFotoPublicacao(
                          index
                        )
                      }
                      style={{
                        padding:
                          "7px",
                        borderRadius:
                          "7px",
                        border:
                          "1px solid #ef4444",
                        background:
                          "#450a0a",
                        color:
                          "#fecaca",
                        cursor:
                          "pointer",
                      }}
                    >
                      🗑
                    </button>
                  </div>
                </div>
              );
            }
          )}
        </div>

        <div
          style={{
            marginTop: "10px",
            padding: "10px 12px",
            borderRadius: "9px",
            border:
              "1px solid #2563eb",
            background:
              "#0b1736",
            color:
              "#bfdbfe",
            fontSize: "12px",
            textAlign: "center",
          }}
        >
          ⭐ A primeira imagem é a capa. Use ⬅ ➡ para mudar a ordem,
          🔄 para trocar e 🗑 para excluir.
        </div>

        <div style={resumoLinha}>
          <span>Fotos</span>

          <strong>
            {fotos.length}
          </strong>
        </div>

        <div
          style={{
            ...resumoLinha,
            border:
              dimensoesFotos.some(
                (item) => !item.ok
              )
                ? "1px solid #ef4444"
                : "1px solid #22c55e",
          }}
        >
          <span>
            📐 Resolução mínima
          </span>

          <strong
            style={{
              color:
                dimensoesFotos.some(
                  (item) => !item.ok
                )
                  ? "#fca5a5"
                  : "#86efac",
            }}
          >
            {dimensoesFotos.length === 0
              ? "Verificando..."
              : dimensoesFotos.every(
                    (item) => item.ok
                  )
                ? "✅ Todas 1200 × 1200 ou maiores"
                : "❌ Corrigir fotos abaixo de 1200 × 1200"}
          </strong>
        </div>

        <div
          id="secao-midias-publicacao"
          style={{
            marginTop: "18px",
            paddingTop: "16px",
            borderTop:
              "1px solid #1e3a5f",
            scrollMarginTop: "130px",
          }}
        >
          <h4
            style={{
              color: "#67e8f9",
              textAlign: "center",
              margin: "0 0 6px 0",
            }}
          >
            🎞️ Mídias APPIA
          </h4>

          <p
            style={{
              ...textoAuxiliar,
              textAlign: "center",
              marginBottom: "14px",
            }}
          >
            Prepare Banner e Clip com calma e escolha aqui somente
            quando o anúncio estiver pronto.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit,minmax(320px,1fr))",
              gap: "12px",
              marginBottom: "14px",
            }}
          >
            <div
              style={{
                ...resumoLinha,
                display: "block",
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
                <span>🎨 Banners — entram nas fotos</span>

                <strong
                  style={{
                    color:
                      bannersSelecionados.length
                        ? "#86efac"
                        : "#94a3b8",
                  }}
                >
                  {bannersSelecionados.length
                    ? `✅ ${bannersSelecionados.length} selecionado(s)`
                    : "○ Opcional"}
                </strong>
              </div>

              {bannersSelecionados.length >
                0 && (
                <div
                  style={{
                    marginTop: "12px",
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(2,minmax(0,1fr))",
                    gap: "10px",
                  }}
                >
                  {bannersSelecionados.map(
                    (
                      url,
                      index
                    ) => (
                      <div
                        key={`${url}-${index}`}
                        style={{
                          position:
                            "relative",
                          padding: "8px",
                          borderRadius:
                            "12px",
                          border:
                            "1px solid #334155",
                          background:
                            "#020617",
                        }}
                      >
                        <img
                          src={url}
                          alt={`Banner ${
                            index + 1
                          }`}
                          style={{
                            width: "100%",
                            aspectRatio:
                              "1 / 1",
                            objectFit:
                              "contain",
                            borderRadius:
                              "9px",
                            background:
                              "#ffffff",
                          }}
                        />

                        <button
                          type="button"
                          onClick={() =>
                            removerBannerSelecionado(
                              url
                            )
                          }
                          style={{
                            width:
                              "100%",
                            marginTop:
                              "7px",
                            padding:
                              "7px",
                            borderRadius:
                              "8px",
                            border:
                              "1px solid #ef4444",
                            background:
                              "#450a0a",
                            color:
                              "#fecaca",
                            cursor:
                              "pointer",
                            fontWeight:
                              "bold",
                          }}
                        >
                          🗑 Remover
                        </button>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>

            <div
              style={{
                ...resumoLinha,
                display: "block",
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
                <span>🎬 Clips — vídeos separados</span>

                <strong
                  style={{
                    color:
                      clipsSelecionados.length
                        ? "#86efac"
                        : "#94a3b8",
                  }}
                >
                  {clipsSelecionados.length
                    ? `✅ ${clipsSelecionados.length} selecionado(s)`
                    : "○ Opcional"}
                </strong>
              </div>

              {clipsSelecionados.length >
                0 && (
                <div
                  style={{
                    marginTop: "12px",
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(2,minmax(0,1fr))",
                    gap: "10px",
                  }}
                >
                  {clipsSelecionados.map(
                    (
                      url,
                      index
                    ) => (
                      <div
                        key={`${url}-${index}`}
                        style={{
                          padding: "8px",
                          borderRadius:
                            "12px",
                          border:
                            "1px solid #334155",
                          background:
                            "#020617",
                        }}
                      >
                        <video
                          src={url}
                          controls
                          preload="metadata"
                          playsInline
                          style={{
                            width: "100%",
                            aspectRatio:
                              "1 / 1",
                            objectFit:
                              "contain",
                            borderRadius:
                              "9px",
                            background:
                              "#000000",
                          }}
                        />

                        <button
                          type="button"
                          onClick={() =>
                            removerClipSelecionado(
                              url
                            )
                          }
                          style={{
                            width:
                              "100%",
                            marginTop:
                              "7px",
                            padding:
                              "7px",
                            borderRadius:
                              "8px",
                            border:
                              "1px solid #ef4444",
                            background:
                              "#450a0a",
                            color:
                              "#fecaca",
                            cursor:
                              "pointer",
                            fontWeight:
                              "bold",
                          }}
                        >
                          🗑 Remover
                        </button>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              salvarEstadoAtualDoTeste();

              localStorage.setItem(
                "retornarParaMidiasPublicacao",
                "true"
              );

              setScreen?.(
                "midiasAppia"
              );
            }}
            style={{
              width: "100%",
              padding: "14px 18px",
              borderRadius: "12px",
              border:
                "1px solid #22d3ee",
              background:
                "linear-gradient(135deg,#2563eb,#0891b2)",
              color: "#ffffff",
              fontWeight: "bold",
              cursor: "pointer",
              fontSize: "15px",
            }}
          >
            🎞️ Adicionar / Trocar Mídias APPIA
          </button>

          <p
            style={{
              ...textoAuxiliar,
              textAlign: "center",
              marginTop: "10px",
              marginBottom: 0,
            }}
          >
            Banners entram junto com as fotos da publicação.
            Clips ficam separados na área de vídeos.
          </p>
        </div>
      </section>

      {/* 5 - CARACTERÍSTICAS */}
      <section style={bloco}>
        <h3 style={titulo}>
          ⑤ Características principais
        </h3>

        <div style={gradeDois}>
          <Campo
            label="Marca"
            value={marca}
            onChange={setMarca}
            placeholder="Ex.: Bosch"
          />

          <Campo
            label="Número da peça"
            value={numeroPeca}
            onChange={
              setNumeroPeca
            }
            placeholder="Código da peça"
          />

          <Campo
            label="GTIN / EAN"
            value={gtin}
            onChange={setGtin}
            placeholder="Opcional"
          />

          <Campo
            label="Tipo de veículo"
            value={tipoVeiculo}
            onChange={
              setTipoVeiculo
            }
            placeholder="Carro / Caminhonete"
          />
        </div>
      </section>

      {/* 6 - EMBALAGEM */}
      <section style={bloco}>
        <h3 style={titulo}>
          ⑥ Embalagem
        </h3>

        <h4 style={subtitulo}>
          📦 Embalagem de fábrica
        </h4>

        <div style={gradeQuatro}>
          <Campo
            label="Largura cm"
            value={larguraFabrica}
            onChange={
              setLarguraFabrica
            }
          />

          <Campo
            label="Altura cm"
            value={alturaFabrica}
            onChange={
              setAlturaFabrica
            }
          />

          <Campo
            label="Comprimento cm"
            value={
              comprimentoFabrica
            }
            onChange={
              setComprimentoFabrica
            }
          />

          <Campo
            label="Peso kg"
            value={pesoFabrica}
            onChange={
              setPesoFabrica
            }
          />
        </div>

        <h4 style={subtitulo}>
          🚚 Embalagem de envio
        </h4>

        <div style={gradeQuatro}>
          <Campo
            label="Largura cm"
            value={larguraEnvio}
            onChange={
              setLarguraEnvio
            }
          />

          <Campo
            label="Altura cm"
            value={alturaEnvio}
            onChange={
              setAlturaEnvio
            }
          />

          <Campo
            label="Comprimento cm"
            value={
              comprimentoEnvio
            }
            onChange={
              setComprimentoEnvio
            }
          />

          <Campo
            label="Peso kg"
            value={pesoEnvio}
            onChange={
              setPesoEnvio
            }
          />
        </div>
      </section>

      {/* 7 - SECUNDÁRIAS */}
      <section style={bloco}>
        <h3 style={titulo}>
          ⑦ Características secundárias
        </h3>

        <AreaTexto
          value={
            caracteristicasSecundarias
          }
          onChange={
            setCaracteristicasSecundarias
          }
          placeholder="Características adicionais do produto."
        />
      </section>

      {/* 8 - REGULATÓRIA */}
      <section style={bloco}>
        <h3 style={titulo}>
          ⑧ Informação regulatória
        </h3>

        <AreaTexto
          value={
            informacaoRegulatoria
          }
          onChange={
            setInformacaoRegulatoria
          }
          placeholder="Informações regulatórias quando aplicável."
        />
      </section>

      {/* 9 - COMPATIBILIDADE */}
      <section
  style={{
    ...bloco,
    border:
      "1px solid #2563eb",
  }}
>
  <h3 style={titulo}>
    ⑨ Compatibilidades
  </h3>

  <div
    style={{
      display: "flex",
      justifyContent:
        "space-between",
      alignItems: "center",
      gap: "12px",
      flexWrap: "wrap",
      marginBottom: "12px",
    }}
  >
    <p
      style={{
        ...textoAuxiliar,
        margin: 0,
      }}
    >
      Compatibilidades recuperadas da
      Base Mestre e dos catálogos
      técnicos do APPIA.
    </p>

    <span
      style={{
        padding:
          "7px 12px",
        borderRadius:
          "999px",
        border:
          "1px solid #22c55e",
        background:
          "#052e16",
        color:
          "#86efac",
        fontSize:
          "12px",
        fontWeight:
          "bold",
      }}
    >
      🚗 {totalCompatibilidades} aplicação(ões)
    </span>
  </div>

  <AreaTexto
    value={compatibilidades}
    onChange={
      setCompatibilidades
    }
    placeholder="As aplicações encontradas pelo APPIA aparecerão aqui."
    minHeight="220px"
  />

  <AreaTexto
    label="Observação de compatibilidade"
    value={
      observacaoCompatibilidade
    }
    onChange={
      setObservacaoCompatibilidade
    }
    placeholder="Ex.: Antes da compra, confira o código gravado na peça original."
  />
</section>

      {/* 10 - PAGAMENTO */}
      <section style={bloco}>
        <h3 style={titulo}>
          ⑩ Forma de pagamento
        </h3>

        <div style={resumoLinha}>
          <span>
            Mercado Pago
          </span>

          <strong
            style={{
              color: "#86efac",
            }}
          >
            ✅ Padrão Mercado Livre
          </strong>
        </div>
      </section>

      {/* 11 - DESCRIÇÃO */}
      <section style={bloco}>
        <h3 style={titulo}>
          ⑪ Descrição
        </h3>

        <AreaTexto
          value={descricao}
          onChange={
            setDescricao
          }
          placeholder="Descrição completa do anúncio"
          minHeight="220px"
        />
      </section>

      {/* 12 - LIMITE */}
      <section style={bloco}>
        <h3 style={titulo}>
          ⑫ Limite de unidades por venda
        </h3>

        <Campo
          label="Máximo por compra"
          value={limiteVenda}
          onChange={
            setLimiteVenda
          }
          placeholder="Opcional"
        />
      </section>

      {/* 13 - CONDIÇÃO */}
      <section style={bloco}>
        <h3 style={titulo}>
          ⑬ Condição
        </h3>

        <label style={labelStyle}>
          Condição do produto

          <select
            value={condicao}
            onChange={(e) =>
              setCondicao(
                e.target.value
              )
            }
            style={campo}
          >
            <option value="novo">
              Novo
            </option>

            <option value="usado">
              Usado
            </option>
          </select>
        </label>
      </section>

      {/* 14 - GARANTIA */}
      <section style={bloco}>
        <h3 style={titulo}>
          ⑭ Garantia
        </h3>

        <div style={gradeDois}>
          <label style={labelStyle}>
            Tipo de garantia

            <select
              value={tipoGarantia}
              onChange={(e) =>
                setTipoGarantia(
                  e.target.value
                )
              }
              style={campo}
            >
              <option value="vendedor">
                Garantia do vendedor
              </option>

              <option value="fabricante">
                Garantia do fabricante
              </option>

              <option value="sem_garantia">
                Sem garantia
              </option>
            </select>
          </label>

          <Campo
            label="Meses"
            value={mesesGarantia}
            onChange={
              setMesesGarantia
            }
            placeholder="3"
          />
        </div>
      </section>

      {/* 15 - CATEGORIA */}
      <section
        style={{
          ...bloco,
          border:
            "1px solid #22d3ee",
        }}
      >
        <h3 style={titulo}>
  ⑮ Categoria Mercado Livre
</h3>

<p style={textoAuxiliar}>
  Digite o nome da peça e o APPIA
  consulta o Mercado Livre para
  encontrar a categoria recomendada.
</p>

<div
  style={{
    display: "grid",
    gridTemplateColumns:
      "1fr auto",
    gap: "12px",
    alignItems: "end",
    marginBottom: "16px",
  }}
>
  <Campo
    label="Nome da peça"
    value={termoCategoria}
    onChange={setTermoCategoria}
    placeholder="Ex.: Sensor de nível, bomba de combustível, radiador..."
  />

  <button
    type="button"
    onClick={atualizarCategoria}
    disabled={buscandoCategoria}
    style={{
      ...botaoCategoria,
      opacity:
        buscandoCategoria
          ? 0.65
          : 1,
      cursor:
        buscandoCategoria
          ? "wait"
          : "pointer",
    }}
  >
    {buscandoCategoria
      ? "⏳ Buscando..."
      : "🤖 Buscar Categoria Mercado Livre"}
  </button>
</div>

{erroCategoria && (
  <div
    style={{
      padding: "12px",
      marginBottom: "14px",
      borderRadius: "10px",
      border:
        "1px solid #f59e0b",
      background:
        "rgba(245,158,11,0.08)",
      color: "#fde68a",
      fontSize: "13px",
    }}
  >
    ⚠️ {erroCategoria}
  </div>
)}

{categoria && (
  <div
    style={{
      padding: "16px",
      borderRadius: "12px",
      border:
        "1px solid #2563eb",
      background: "#020617",
      marginBottom: "14px",
    }}
  >
    <div
      style={{
        color: "#67e8f9",
        fontWeight: "bold",
        marginBottom: "8px",
      }}
    >
      🤖 Categoria recomendada
    </div>

    <div
      style={{
        color: "#f8fafc",
        lineHeight: 1.5,
        fontWeight: "bold",
      }}
    >
      {categoria}
    </div>

    {categoriaId && (
      <div
        style={{
          marginTop: "8px",
          color: "#94a3b8",
          fontSize: "12px",
        }}
      >
        ID Mercado Livre:{" "}
        <strong>
          {categoriaId}
        </strong>
      </div>
    )}
  </div>
)}

{opcoesCategoria.length > 1 && (
  <div
    style={{
      marginBottom: "16px",
    }}
  >
    <div
      style={{
        color: "#bfdbfe",
        fontWeight: "bold",
        marginBottom: "8px",
      }}
    >
      🔎 Outras categorias encontradas
    </div>

    <div
      style={{
        display: "grid",
        gap: "8px",
      }}
    >
      {opcoesCategoria.map(
        (opcao) => (
          <button
            key={opcao.id}
            type="button"
            onClick={() => {
              setCategoria(
                opcao.caminho
              );

              setCategoriaId(
                opcao.id
              );
            }}
            style={{
              padding:
                "12px 14px",
              borderRadius:
                "10px",
              border:
                opcao.id ===
                categoriaId
                  ? "1px solid #22d3ee"
                  : "1px solid #334155",
              background:
                "#0f172a",
              color:
                "#e2e8f0",
              textAlign:
                "left",
              cursor:
                "pointer",
            }}
          >
            {opcao.caminho}

            <span
              style={{
                display: "block",
                marginTop: "4px",
                color: "#64748b",
                fontSize: "11px",
              }}
            >
              {opcao.id}
            </span>
          </button>
        )
      )}
    </div>
  </div>
)}

<AreaTexto
  value={categoria}
  onChange={setCategoria}
  placeholder="Categoria selecionada"
/>
</section>

      {/* 16 - REVISÃO FINAL */}
      <section
        style={{
          ...bloco,
          border: validado
            ? "1px solid #22c55e"
            : "1px solid #334155",
        }}
      >
        <h3 style={titulo}>
          ⑯ Revisão final
        </h3>

        <div
          style={{
            padding: "16px",
            borderRadius: "12px",
            background: "#020617",
            border: validado
              ? "1px solid #22c55e"
              : pendenciasRevisao.length
                ? "1px solid #ef4444"
                : "1px solid #334155",
          }}
        >
          <div
            style={{
              color: validado
                ? "#86efac"
                : pendenciasRevisao.length
                  ? "#fca5a5"
                  : "#cbd5e1",
              fontWeight: "bold",
              fontSize: "16px",
            }}
          >
            {validado
              ? "🟢 Pronto para publicar"
              : pendenciasRevisao.length
                ? "🔴 Corrigir antes de publicar"
                : "⚪ Aguardando validação do anúncio"}
          </div>

          <div
            style={{
              marginTop: "14px",
              display: "grid",
              gap: "8px",
              color: "#cbd5e1",
              fontSize: "13px",
            }}
          >
            <span>
              {tituloAnuncio.trim() &&
              tituloAnuncio.trim().length <= 60
                ? "✅"
                : "❌"}{" "}
              Título até 60 caracteres
            </span>

            <span>
              {preco ? "✅" : "❌"}{" "}
              Preço
            </span>

            <span>
              {descricao.trim()
                ? "✅"
                : "❌"}{" "}
              Descrição
            </span>

            <span>
              {fotos.length > 0 &&
              dimensoesFotos.length === fotos.length &&
              dimensoesFotos.every(
                (item) => item.ok
              )
                ? "✅"
                : "❌"}{" "}
              Fotos 1200 × 1200 ou maiores
            </span>

            <span>
              {categoria.trim()
                ? "✅"
                : "❌"}{" "}
              Categoria
            </span>

            <span>
              {marca.trim()
                ? "✅"
                : "❌"}{" "}
              Marca
            </span>

            <span>
              {numeroPeca.trim()
                ? "✅"
                : "❌"}{" "}
              Número da peça
            </span>

            <span>
              {tipoVeiculo.trim()
                ? "✅"
                : "❌"}{" "}
              Tipo de veículo
            </span>

            <span>
              {modoEnvio
                ? "✅"
                : "❌"}{" "}
              Forma de entrega
            </span>

            <span>
              {condicao
                ? "✅"
                : "❌"}{" "}
              Condição
            </span>
          </div>

          {pendenciasRevisao.length > 0 && (
            <div
              style={{
                marginTop: "16px",
                padding: "12px",
                borderRadius: "10px",
                background: "#450a0a",
                border:
                  "1px solid #991b1b",
                color: "#fecaca",
                fontSize: "13px",
              }}
            >
              <strong>
                Pendências encontradas:
              </strong>

              <div
                style={{
                  marginTop: "8px",
                  display: "grid",
                  gap: "5px",
                }}
              >
                {pendenciasRevisao.map(
                  (item, index) => (
                    <span
                      key={`${item}-${index}`}
                    >
                      • {item}
                    </span>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {validado &&
        payloadTeste && (
          <section
            style={{
              ...bloco,
              border:
                "1px solid #22c55e",
              background:
                "linear-gradient(180deg,#052e16,#0f172a)",
            }}
          >
            <h3
              style={{
                ...titulo,
                color: "#86efac",
                textAlign: "center",
              }}
            >
              ✅ Anúncio pronto
            </h3>

            <p
              style={{
                ...textoAuxiliar,
                textAlign: "center",
                marginBottom: "18px",
              }}
            >
              Escolha o próximo passo.
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit,minmax(210px,1fr))",
                gap: "12px",
              }}
            >
              <button
                type="button"
                onClick={
                  abrirMidiasAppia
                }
                style={{
                  ...botaoSecundario,
                  width: "100%",
                  padding: "14px",
                }}
              >
                🎞️ Exportar Mídias
              </button>

              <button
                type="button"
                onClick={
                  exportarAnuncio
                }
                style={{
                  ...botaoPrincipal,
                  width: "100%",
                  padding: "14px",
                }}
              >
                ⬇️ Exportar Anúncio
              </button>

              <button
                type="button"
                onClick={
                  irParaCentralPublicacao
                }
                style={{
                  ...botaoPrincipal,
                  width: "100%",
                  padding: "14px",
                  background:
                    "linear-gradient(135deg,#2563eb,#22d3ee)",
                }}
              >
                🚀 Central de Publicação
              </button>
            </div>
          </section>
        )}

      <div style={acoes}>
        <button
          type="button"
          onClick={() =>
            setScreen?.(
              "centralPublicacao"
            )
          }
          style={botaoSecundario}
        >
          ⬅ Voltar
        </button>

        <button
          type="button"
          onClick={validarAnuncio}
          disabled={validandoFotos}
          style={{
            ...botaoPrincipal,
            opacity:
              validandoFotos
                ? 0.6
                : 1,
            cursor:
              validandoFotos
                ? "not-allowed"
                : "pointer",
          }}
        >
          {validandoFotos
            ? "📐 Verificando fotos..."
            : "🧪 Validar Publicação"}
        </button>
      </div>
    </div>
  );
}

function Campo({
  label,
  value,
  onChange,
  placeholder = "",
  maxLength,
}) {
  return (
    <label style={labelStyle}>
      {label}

      <input
        value={value}
        onChange={(e) =>
          onChange(
            e.target.value
          )
        }
        placeholder={placeholder}
        maxLength={maxLength}
        style={campo}
      />
    </label>
  );
}

function AreaTexto({
  label = "",
  value,
  onChange,
  placeholder = "",
  minHeight = "120px",
}) {
  return (
    <label style={labelStyle}>
      {label}

      <textarea
        value={value}
        onChange={(e) =>
          onChange(
            e.target.value
          )
        }
        placeholder={placeholder}
        style={{
          ...campo,
          minHeight,
          resize: "vertical",
          lineHeight: 1.5,
        }}
      />
    </label>
  );
}

const cabecalho = {
  padding: "26px",
  borderRadius: "18px",
  border:
    "1px solid #2563eb",
  background:
    "linear-gradient(135deg,#172554,#0f172a)",
  textAlign: "center",
};

const bloco = {
  marginTop: "18px",
  padding: "20px",
  borderRadius: "15px",
  background: "#0f172a",
  border:
    "1px solid #1e293b",
};

const titulo = {
  color: "#67e8f9",
  marginTop: 0,
  marginBottom: "15px",
};

const subtitulo = {
  color: "#e2e8f0",
  marginTop: "18px",
  marginBottom: "8px",
};

const textoAuxiliar = {
  color: "#94a3b8",
  fontSize: "12px",
  lineHeight: 1.5,
  marginTop: 0,
};

const campo = {
  width: "100%",
  padding: "11px",
  marginTop: "6px",
  borderRadius: "10px",
  border:
    "1px solid #334155",
  background: "#020617",
  color: "#ffffff",
  boxSizing: "border-box",
};

const labelStyle = {
  display: "block",
  color: "#cbd5e1",
  marginTop: "12px",
  fontSize: "12px",
  fontWeight: "bold",
};

const gradeDois = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(220px,1fr))",
  gap: "12px",
};

const gradeQuatro = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(150px,1fr))",
  gap: "10px",
};

const gradeFotos = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
};

const fotoCard = {
  width: "120px",
  height: "120px",
  borderRadius: "10px",
  border:
    "1px solid #334155",
  background: "#ffffff",
  padding: "5px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const resumoLinha = {
  marginTop: "10px",
  padding: "12px",
  borderRadius: "10px",
  border:
    "1px solid #334155",
  background: "#020617",
  color: "#cbd5e1",
  display: "flex",
  justifyContent:
    "space-between",
  gap: "15px",
  flexWrap: "wrap",
};

const acoes = {
  display: "flex",
  justifyContent: "center",
  gap: "12px",
  marginTop: "20px",
  marginBottom: "30px",
  flexWrap: "wrap",
};

const botaoSecundario = {
  padding: "12px 18px",
  borderRadius: "10px",
  border:
    "1px solid #475569",
  background: "#334155",
  color: "#ffffff",
  cursor: "pointer",
  fontWeight: "bold",
};

const botaoPrincipal = {
  padding: "12px 20px",
  borderRadius: "10px",
  border:
    "1px solid #22c55e",
  background:
    "linear-gradient(135deg,#15803d,#22c55e)",
  color: "#ffffff",
  cursor: "pointer",
  fontWeight: "bold",
};

const botaoCategoria = {
  marginTop: "12px",
  padding: "11px 16px",
  borderRadius: "10px",
  border:
    "1px solid #38bdf8",
  background: "#082f49",
  color: "#bae6fd",
  cursor: "pointer",
  fontWeight: "bold",
};

const cardInteligenciaPreco = {
  padding: "14px",
  borderRadius: "10px",
  border: "1px solid #334155",
  background: "#020617",
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  textAlign: "left",
};

const labelInteligenciaPreco = {
  color: "#94a3b8",
  fontSize: "12px",
  fontWeight: "bold",
};

const valorInteligenciaPreco = {
  color: "#f8fafc",
  fontSize: "18px",
};