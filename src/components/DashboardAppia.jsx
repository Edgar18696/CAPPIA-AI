import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { supabase } from "../supabase";

import {
  lerProjetoAtual,
} from "../services/projetoAtualService";

const DIAS_SEMANA = 7;

function inicioDoDia(data) {
  const copia = new Date(data);

  copia.setHours(
    0,
    0,
    0,
    0
  );

  return copia;
}

function dataIsoDiasAtras(dias) {
  const data = inicioDoDia(
    new Date()
  );

  data.setDate(
    data.getDate() - dias
  );

  return data.toISOString();
}

function chaveDia(data) {
  const valor = new Date(data);

  return [
    valor.getFullYear(),
    String(
      valor.getMonth() + 1
    ).padStart(2, "0"),
    String(
      valor.getDate()
    ).padStart(2, "0"),
  ].join("-");
}

function rotuloDia(data) {
  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      weekday: "short",
      day: "2-digit",
    }
  )
    .format(data)
    .replace(".", "");
}

function formatarDataHora(data) {
  if (!data) {
    return "Agora";
  }

  try {
    return new Intl.DateTimeFormat(
      "pt-BR",
      {
        dateStyle: "short",
        timeStyle: "short",
      }
    ).format(
      new Date(data)
    );
  } catch {
    return "Agora";
  }
}

function lerFavoritos() {
  try {
    const salvo =
      localStorage.getItem(
        "projetosFavoritosAppia"
      );

    return salvo
      ? JSON.parse(salvo)
      : [];
  } catch {
    return [];
  }
}

export default function DashboardAppia({
  setScreen,
}) {
  const [totais, setTotais] =
    useState({
      fotos: 0,
      banners: 0,
      clips: 0,
      catalogo: 0,
      fabricantes: 0,
      equivalencias: 0,
      vin: 0,
      projetos: 0,
      projetosAtivos: 0,
      projetosConcluidos: 0,
      anuncios: 0,
      publicacoes: 0,
      fotosHoje: 0,
      bannersHoje: 0,
      clipsHoje: 0,
    });

  const [
    atividades,
    setAtividades,
  ] = useState([]);

  const [
    projetosRecentes,
    setProjetosRecentes,
  ] = useState([]);

  const [
    dadosSemana,
    setDadosSemana,
  ] = useState([]);

  const [
    carregando,
    setCarregando,
  ] = useState(true);

  const [
    projetoAtual,
    setProjetoAtual,
  ] = useState(() =>
    lerProjetoAtual()
  );

  const [
    favoritosIds,
    setFavoritosIds,
  ] = useState(() =>
    lerFavoritos()
  );

  useEffect(() => {
    carregarDashboard();
  }, []);

  useEffect(() => {
    function atualizarProjeto(
      evento
    ) {
      setProjetoAtual(
        evento?.detail ??
          lerProjetoAtual()
      );

      setFavoritosIds(
        lerFavoritos()
      );
    }

    window.addEventListener(
      "appia:projeto-atualizado",
      atualizarProjeto
    );

    window.addEventListener(
      "storage",
      atualizarProjeto
    );

    return () => {
      window.removeEventListener(
        "appia:projeto-atualizado",
        atualizarProjeto
      );

      window.removeEventListener(
        "storage",
        atualizarProjeto
      );
    };
  }, []);

  async function contarTabela(
    tabela,
    filtros = []
  ) {
    try {
      let consulta = supabase
        .from(tabela)
        .select("*", {
          count: "exact",
          head: true,
        });

      filtros.forEach(
        ({
          coluna,
          operador = "eq",
          valor,
        }) => {
          if (
            typeof consulta[
              operador
            ] === "function"
          ) {
            consulta =
              consulta[operador](
                coluna,
                valor
              );
          }
        }
      );

      const {
        count,
        error,
      } = await consulta;

      if (error) {
        throw error;
      }

      return count || 0;
    } catch (erro) {
      console.warn(
        `Falha ao contar ${tabela}:`,
        erro
      );

      return 0;
    }
  }

  async function buscarTabela(
    tabela,
    configuracao = {}
  ) {
    try {
      let consulta = supabase
        .from(tabela)
        .select(
          configuracao.select ||
            "*"
        );

      (
        configuracao.filtros || []
      ).forEach(
        ({
          coluna,
          operador = "eq",
          valor,
        }) => {
          if (
            typeof consulta[
              operador
            ] === "function"
          ) {
            consulta =
              consulta[operador](
                coluna,
                valor
              );
          }
        }
      );

      if (
        configuracao.ordem
      ) {
        consulta =
          consulta.order(
            configuracao.ordem,
            {
              ascending:
                configuracao
                  .ascending ??
                false,
            }
          );
      }

      if (
        configuracao.limite
      ) {
        consulta =
          consulta.limit(
            configuracao.limite
          );
      }

      const {
        data,
        error,
      } = await consulta;

      if (error) {
        throw error;
      }

      return data || [];
    } catch (erro) {
      console.warn(
        `Falha ao buscar ${tabela}:`,
        erro
      );

      return [];
    }
  }

  async function carregarDashboard() {
    setCarregando(true);

    try {
      const hojeIso =
        dataIsoDiasAtras(0);

      const semanaIso =
        dataIsoDiasAtras(
          DIAS_SEMANA - 1
        );

      const [
        fotos,
        banners,
        clips,
        fabricantes,
        equivalencias,
        vin,
        projetos,
        projetosAtivos,
        projetosConcluidos,
        anuncios,
        publicacoes,
        fotosHoje,
        bannersHoje,
        clipsHoje,
        processamentosSemana,
        atividadesRecentes,
        listaProjetos,
      ] = await Promise.all([
        contarTabela(
          "processamentos",
          [
            {
              coluna: "tipo",
              valor: "foto",
            },
          ]
        ),

        contarTabela(
          "processamentos",
          [
            {
              coluna: "tipo",
              valor: "banner",
            },
          ]
        ),

        contarTabela(
          "processamentos",
          [
            {
              coluna: "tipo",
              valor: "video",
            },
          ]
        ),

        contarTabela(
          "fabricantes"
        ),

        contarTabela(
          "equivalencias_pecas"
        ),

        contarTabela(
          "vin_referencia"
        ),

        contarTabela(
          "projetos"
        ),

        contarTabela(
          "projetos",
          [
            {
              coluna: "status",
              valor:
                "Em andamento",
            },
          ]
        ),

        contarTabela(
          "projetos",
          [
            {
              coluna: "status",
              valor:
                "Concluído",
            },
          ]
        ),

        contarTabela(
          "rascunhos_anuncios"
        ),

        contarTabela(
          "publicacoes"
        ),

        contarTabela(
          "processamentos",
          [
            {
              coluna:
                "created_at",
              operador: "gte",
              valor: hojeIso,
            },
            {
              coluna: "tipo",
              valor: "foto",
            },
          ]
        ),

        contarTabela(
          "processamentos",
          [
            {
              coluna:
                "created_at",
              operador: "gte",
              valor: hojeIso,
            },
            {
              coluna: "tipo",
              valor: "banner",
            },
          ]
        ),

        contarTabela(
          "processamentos",
          [
            {
              coluna:
                "created_at",
              operador: "gte",
              valor: hojeIso,
            },
            {
              coluna: "tipo",
              valor: "video",
            },
          ]
        ),

        buscarTabela(
          "processamentos",
          {
            select:
              "tipo,created_at",
            filtros: [
              {
                coluna:
                  "created_at",
                operador: "gte",
                valor: semanaIso,
              },
            ],
            ordem:
              "created_at",
            ascending: true,
          }
        ),

        buscarTabela(
          "processamentos",
          {
            select:
              "id,tipo,status,created_at,imagem_processada",
            ordem:
              "created_at",
            limite: 8,
          }
        ),

        buscarTabela(
          "projetos",
          {
            ordem:
              "updated_at",
            limite: 8,
          }
        ),
      ]);

      let catalogo =
        await contarTabela(
          "catalogo_mestre",
          [
            {
              coluna: "ativo",
              valor: true,
            },
          ]
        );

      if (!catalogo) {
        catalogo =
          await contarTabela(
            "catalogo_pecas",
            [
              {
                coluna: "ativo",
                valor: true,
              },
            ]
          );
      }

      setTotais({
        fotos,
        banners,
        clips,
        catalogo,
        fabricantes,
        equivalencias,
        vin,
        projetos,
        projetosAtivos,
        projetosConcluidos,
        anuncios,
        publicacoes,
        fotosHoje,
        bannersHoje,
        clipsHoje,
      });

      setAtividades(
        atividadesRecentes
      );

      setProjetosRecentes(
        listaProjetos
      );

      setDadosSemana(
        montarDadosSemana(
          processamentosSemana
        )
      );

      setFavoritosIds(
        lerFavoritos()
      );
    } finally {
      setCarregando(false);
    }
  }

  function montarDadosSemana(
    processamentos
  ) {
    const dias = [];

    for (
      let indice =
        DIAS_SEMANA - 1;
      indice >= 0;
      indice -= 1
    ) {
      const data =
        inicioDoDia(
          new Date()
        );

      data.setDate(
        data.getDate() -
          indice
      );

      dias.push({
        chave: chaveDia(
          data
        ),
        data,
        fotos: 0,
        banners: 0,
        clips: 0,
      });
    }

    const mapa = new Map(
      dias.map((dia) => [
        dia.chave,
        dia,
      ])
    );

    (
      processamentos || []
    ).forEach((item) => {
      const dia = mapa.get(
        chaveDia(
          item.created_at
        )
      );

      if (!dia) {
        return;
      }

      if (
        item.tipo === "foto"
      ) {
        dia.fotos += 1;
      } else if (
        item.tipo === "banner"
      ) {
        dia.banners += 1;
      } else if (
        item.tipo === "video" ||
        item.tipo === "clip"
      ) {
        dia.clips += 1;
      }
    });

    return dias;
  }

  const progressoProjeto =
    useMemo(() => {
      if (!projetoAtual) {
        return {
          percentual: 0,
          concluidas: 0,
          total: 5,
          etapas: [],
          proximaAcao: {
            texto:
              "Criar um novo projeto",
            tela: "projetos",
            icone: "📂",
          },
        };
      }

      const etapas = [
        {
          id: "foto",
          nome: "Foto IA",
          concluida: Boolean(
            projetoAtual.foto_pronta
          ),
          tela: "foto",
          icone: "📸",
        },
        {
          id: "banner",
          nome: "Banner Studio",
          concluida: Boolean(
            projetoAtual.banner_pronto
          ),
          tela: "banner",
          icone: "🎨",
        },
        {
          id: "clip",
          nome: "Clip IA",
          concluida: Boolean(
            projetoAtual.clip_pronto
          ),
          tela: "clipIA",
          icone: "🎬",
        },
        {
          id: "anuncio",
          nome: "Novo Anúncio",
          concluida: Boolean(
            projetoAtual.anuncio_pronto
          ),
          tela: "novoAnuncio",
          icone: "🤖",
        },
        {
          id: "publicado",
          nome: "Publicado",
          concluida: Boolean(
            projetoAtual.publicado
          ),
          tela:
            "centralPublicacao",
          icone: "🚀",
        },
      ];

      const concluidas =
        etapas.filter(
          (etapa) =>
            etapa.concluida
        ).length;

      const proximaEtapa =
        etapas.find(
          (etapa) =>
            !etapa.concluida
        );

      return {
        percentual:
          Math.round(
            (
              concluidas /
              etapas.length
            ) *
              100
          ),
        concluidas,
        total: etapas.length,
        etapas,
        proximaAcao:
          proximaEtapa
            ? {
                texto:
                  `Continuar em ${proximaEtapa.nome}`,
                tela:
                  proximaEtapa.tela,
                icone:
                  proximaEtapa.icone,
              }
            : {
                texto:
                  "Projeto concluído",
                tela:
                  "projetos",
                icone: "✅",
              },
      };
    }, [projetoAtual]);

  const projetosFavoritos =
    useMemo(() => {
      return projetosRecentes.filter(
        (item) =>
          favoritosIds.includes(
            item.id
          )
      );
    }, [
      projetosRecentes,
      favoritosIds,
    ]);

  const maiorValorSemana =
    useMemo(() => {
      return Math.max(
        1,
        ...dadosSemana.map(
          (dia) =>
            dia.fotos +
            dia.banners +
            dia.clips
        )
      );
    }, [dadosSemana]);

  const cardsHoje = [
    {
      icone: "📸",
      titulo: "Fotos hoje",
      total: totais.fotosHoje,
      tela: "foto",
    },
    {
      icone: "🎨",
      titulo: "Banners hoje",
      total:
        totais.bannersHoje,
      tela: "banner",
    },
    {
      icone: "🎬",
      titulo: "Clips hoje",
      total: totais.clipsHoje,
      tela: "clipIA",
    },
    {
      icone: "📂",
      titulo:
        "Projetos ativos",
      total:
        totais.projetosAtivos,
      tela: "projetos",
    },
    {
      icone: "🤖",
      titulo: "Anúncios",
      total: totais.anuncios,
      tela: "meusRascunhos",
    },
    {
      icone: "🚀",
      titulo: "Publicações",
      total:
        totais.publicacoes,
      tela:
        "centralPublicacao",
    },
  ];

  const cardsBase = [
    {
      icone: "📸",
      titulo: "Fotos IA",
      total: totais.fotos,
      tela: "foto",
    },
    {
      icone: "🎨",
      titulo: "Banners",
      total: totais.banners,
      tela: "banner",
    },
    {
      icone: "🎬",
      titulo: "Clips",
      total: totais.clips,
      tela: "clipIA",
    },
    {
      icone: "📦",
      titulo: "Catálogo",
      total: totais.catalogo,
      tela:
        "baseConhecimento",
    },
    {
      icone: "🏭",
      titulo:
        "Fabricantes",
      total:
        totais.fabricantes,
      tela: "fabricantes",
    },
    {
      icone: "🔄",
      titulo:
        "Equivalências",
      total:
        totais.equivalencias,
      tela:
        "equivalencias",
    },
  ];

  const atalhos = [
    {
      icone: "📸",
      titulo: "Nova Foto",
      tela: "foto",
    },
    {
      icone: "🎨",
      titulo:
        "Novo Banner",
      tela: "banner",
    },
    {
      icone: "🎬",
      titulo: "Novo Clip",
      tela: "clipIA",
    },
    {
      icone: "🤖",
      titulo:
        "Novo Anúncio",
      tela: "novoAnuncio",
    },
    {
      icone: "📂",
      titulo: "Projetos",
      tela: "projetos",
    },
    {
      icone: "🚀",
      titulo: "Publicar",
      tela:
        "centralPublicacao",
    },
  ];

  function abrirTela(tela) {
    if (
      typeof setScreen ===
      "function"
    ) {
      setScreen(tela);
    }
  }

  function abrirProjeto(item) {
    localStorage.setItem(
      "projetoAppiaAtual",
      JSON.stringify(item)
    );

    setProjetoAtual(item);

    abrirTela("projetos");
  }

  function iconeAtividade(tipo) {
    const icones = {
      foto: "📸",
      banner: "🎨",
      video: "🎬",
      clip: "🎬",
    };

    return (
      icones[tipo] ||
      "⚙️"
    );
  }

  function tituloAtividade(tipo) {
    const titulos = {
      foto:
        "Foto IA criada",
      banner:
        "Banner criado",
      video:
        "Clip criado",
      clip:
        "Clip criado",
    };

    return (
      titulos[tipo] ||
      "Processamento concluído"
    );
  }

  return (
    <div
      style={{
        padding: "30px",
        maxWidth: "1280px",
        margin: "0 auto",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "center",
          gap: "15px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1
            style={{
              color: "#38bdf8",
              fontSize: "42px",
              fontWeight: "bold",
              marginBottom: "8px",
            }}
          >
            🚀 PAIIA AI Dashboard
          </h1>

          <p
            style={{
              color: "#cbd5e1",
              marginTop: 0,
            }}
          >
            Controle seus projetos, mídias e publicações em um só lugar.
          </p>
        </div>

        <button
          type="button"
          onClick={
            carregarDashboard
          }
          disabled={carregando}
          style={{
            padding: "11px 18px",
            borderRadius: "10px",
            border:
              "1px solid #38bdf8",
            background: "#082f49",
            color: "#bae6fd",
            cursor: carregando
              ? "not-allowed"
              : "pointer",
            fontWeight: "bold",
          }}
        >
          {carregando
            ? "⏳ Atualizando..."
            : "🔄 Atualizar"}
        </button>
      </div>

      <h2 style={tituloSecao}>
        🔥 Hoje no PAIIA
      </h2>

      <div style={gradeCards}>
        {cardsHoje.map(
          (card) => (
            <button
              key={card.titulo}
              type="button"
              onClick={() =>
                abrirTela(
                  card.tela
                )
              }
              style={{
                ...cardMetrica,
                border:
                  "1px solid #2563eb",
              }}
            >
              <span
                style={{
                  fontSize: "32px",
                }}
              >
                {card.icone}
              </span>

              <strong
                style={{
                  color: "#67e8f9",
                  fontSize: "30px",
                }}
              >
                {carregando
                  ? "..."
                  : card.total}
              </strong>

              <span
                style={{
                  color: "#cbd5e1",
                  fontSize: "12px",
                }}
              >
                {card.titulo}
              </span>
            </button>
          )
        )}
      </div>

      <section
        style={{
          marginTop: "24px",
          padding: "18px",
          borderRadius: "16px",
          background:
            "linear-gradient(135deg,#082f49,#0f172a)",
          border: "1px solid #0ea5e9",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit,minmax(160px,1fr))",
            gap: "12px",
          }}
        >
          <div style={resumoExecutivoItem}>
            <span>📂 Projetos</span>
            <strong>{carregando ? "..." : totais.projetos}</strong>
          </div>

          <div style={resumoExecutivoItem}>
            <span>🟡 Em andamento</span>
            <strong>{carregando ? "..." : totais.projetosAtivos}</strong>
          </div>

          <div style={resumoExecutivoItem}>
            <span>🟢 Concluídos</span>
            <strong>{carregando ? "..." : totais.projetosConcluidos}</strong>
          </div>

          <div style={resumoExecutivoItem}>
            <span>🚗 VIN</span>
            <strong>{carregando ? "..." : totais.vin}</strong>
          </div>
        </div>
      </section>

      <section
        style={{
          marginTop: "28px",
          padding: "24px",
          borderRadius: "20px",
          border:
            "1px solid #2563eb",
          background:
            "linear-gradient(135deg,#0f172a,#172554)",
          boxShadow:
            "0 22px 55px rgba(0,0,0,.28)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems:
              "flex-start",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <span
              style={{
                color: "#67e8f9",
                fontWeight: "bold",
                fontSize: "13px",
              }}
            >
              ▶ CONTINUAR TRABALHO
            </span>

            <h2
              style={{
                color: "#ffffff",
                margin:
                  "8px 0 6px",
              }}
            >
              {projetoAtual?.nome ||
                projetoAtual?.titulo ||
                "Nenhum projeto selecionado"}
            </h2>

            {projetoAtual && (
              <div
                style={{
                  color: "#94a3b8",
                  fontSize: "12px",
                  lineHeight: 1.6,
                }}
              >
                Código:{" "}
                <strong
                  style={{
                    color:
                      "#e2e8f0",
                  }}
                >
                  {projetoAtual.codigo ||
                    "Não informado"}
                </strong>
                <br />
                OEM:{" "}
                <strong
                  style={{
                    color:
                      "#e2e8f0",
                  }}
                >
                  {projetoAtual.oem ||
                    "Não informado"}
                </strong>
                <br />
                {formatarDataHora(
                  projetoAtual.updated_at
                )}
              </div>
            )}
          </div>

          <div
            style={{
              minWidth: "120px",
              textAlign: "right",
            }}
          >
            <strong
              style={{
                color: "#67e8f9",
                fontSize: "34px",
              }}
            >
              {
                progressoProjeto.percentual
              }
              %
            </strong>

            <div
              style={{
                color: "#94a3b8",
                fontSize: "11px",
              }}
            >
              {
                progressoProjeto.concluidas
              }{" "}
              de{" "}
              {
                progressoProjeto.total
              }{" "}
              etapas
            </div>
          </div>
        </div>

        <div style={barraFundo}>
          <div
            style={{
              width:
                `${progressoProjeto.percentual}%`,
              height: "100%",
              background:
                progressoProjeto.percentual ===
                100
                  ? "linear-gradient(90deg,#16a34a,#4ade80)"
                  : "linear-gradient(90deg,#2563eb,#22d3ee)",
              transition:
                "width .3s ease",
            }}
          />
        </div>

        {projetoAtual ? (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit,minmax(145px,1fr))",
                gap: "10px",
                marginTop: "18px",
              }}
            >
              {progressoProjeto.etapas.map(
                (etapa) => (
                  <button
                    key={etapa.id}
                    type="button"
                    onClick={() =>
                      abrirTela(
                        etapa.tela
                      )
                    }
                    style={{
                      padding:
                        "12px",
                      borderRadius:
                        "11px",
                      border:
                        etapa.concluida
                          ? "1px solid #22c55e"
                          : "1px solid #334155",
                      background:
                        etapa.concluida
                          ? "#052e16"
                          : "#020617",
                      color:
                        etapa.concluida
                          ? "#bbf7d0"
                          : "#cbd5e1",
                      cursor:
                        "pointer",
                      fontWeight:
                        "bold",
                      textAlign:
                        "left",
                    }}
                  >
                    {etapa.concluida
                      ? "✅"
                      : "⬜"}{" "}
                    {etapa.nome}
                  </button>
                )
              )}
            </div>

            <button
              type="button"
              onClick={() =>
                abrirTela(
                  progressoProjeto
                    .proximaAcao.tela
                )
              }
              style={botaoPrincipal}
            >
              {
                progressoProjeto
                  .proximaAcao.icone
              }{" "}
              Continuar de onde parei:{" "}
              {
                progressoProjeto
                  .proximaAcao.texto
              }
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() =>
              abrirTela("projetos")
            }
            style={botaoPrincipal}
          >
            📂 Abrir Projetos
          </button>
        )}
      </section>

      <div style={gradeDupla}>
        <section style={painelStyle}>
          <h2 style={tituloPainel}>
            📈 Produção dos últimos 7 dias
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                `repeat(${DIAS_SEMANA},minmax(42px,1fr))`,
              gap: "8px",
              alignItems: "end",
              minHeight: "230px",
              marginTop: "18px",
            }}
          >
            {dadosSemana.map(
              (dia) => {
                const total =
                  dia.fotos +
                  dia.banners +
                  dia.clips;

                const altura =
                  Math.max(
                    8,
                    Math.round(
                      (
                        total /
                        maiorValorSemana
                      ) *
                        160
                    )
                  );

                return (
                  <div
                    key={dia.chave}
                    style={{
                      display: "flex",
                      flexDirection:
                        "column",
                      justifyContent:
                        "flex-end",
                      alignItems:
                        "center",
                      gap: "6px",
                      height: "210px",
                    }}
                    title={`${total} item(ns): ${dia.fotos} fotos, ${dia.banners} banners, ${dia.clips} clips`}
                  >
                    <strong
                      style={{
                        color:
                          "#e2e8f0",
                        fontSize:
                          "11px",
                      }}
                    >
                      {total}
                    </strong>

                    <div
                      style={{
                        width: "72%",
                        height:
                          `${altura}px`,
                        minHeight:
                          "8px",
                        borderRadius:
                          "8px 8px 3px 3px",
                        background:
                          "linear-gradient(180deg,#22d3ee,#2563eb)",
                        boxShadow:
                          "0 8px 20px rgba(37,99,235,.25)",
                        transition:
                          "height .3s ease",
                      }}
                    />

                    <span
                      style={{
                        color:
                          "#94a3b8",
                        fontSize:
                          "10px",
                        textTransform:
                          "capitalize",
                      }}
                    >
                      {rotuloDia(
                        dia.data
                      )}
                    </span>
                  </div>
                );
              }
            )}
          </div>

          <div style={legendaGrafico}>
            <span>📸 Fotos</span>
            <span>🎨 Banners</span>
            <span>🎬 Clips</span>
          </div>
        </section>

        <section style={painelStyle}>
          <h2 style={tituloPainel}>
            ⚡ Ações rápidas
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(2,minmax(0,1fr))",
              gap: "10px",
            }}
          >
            {atalhos.map(
              (atalho) => (
                <button
                  key={
                    atalho.titulo
                  }
                  type="button"
                  onClick={() =>
                    abrirTela(
                      atalho.tela
                    )
                  }
                  style={{
                    padding:
                      "15px 10px",
                    borderRadius:
                      "11px",
                    border:
                      "1px solid #2563eb",
                    background:
                      "#020617",
                    color:
                      "#bfdbfe",
                    cursor:
                      "pointer",
                    fontWeight:
                      "bold",
                  }}
                >
                  {
                    atalho.icone
                  }{" "}
                  {
                    atalho.titulo
                  }
                </button>
              )
            )}
          </div>
        </section>
      </div>

      <div style={gradeDupla}>
        <section style={painelStyle}>
          <h2 style={tituloPainel}>
            🕒 Últimas atividades
          </h2>

          {atividades.length >
          0 ? (
            <div
              style={{
                display: "grid",
                gap: "9px",
              }}
            >
              {atividades.map(
                (
                  atividade,
                  indice
                ) => (
                  <div
                    key={
                      atividade.id ||
                      `${atividade.created_at}-${indice}`
                    }
                    style={itemAtividade}
                  >
                    <span
                      style={{
                        fontSize:
                          "24px",
                      }}
                    >
                      {iconeAtividade(
                        atividade.tipo
                      )}
                    </span>

                    <div
                      style={{
                        minWidth: 0,
                        textAlign:
                          "left",
                      }}
                    >
                      <strong
                        style={{
                          color:
                            "#e2e8f0",
                          display:
                            "block",
                        }}
                      >
                        {tituloAtividade(
                          atividade.tipo
                        )}
                      </strong>

                      <small
                        style={{
                          color:
                            "#64748b",
                        }}
                      >
                        {formatarDataHora(
                          atividade.created_at
                        )}
                      </small>
                    </div>
                  </div>
                )
              )}
            </div>
          ) : (
            <p
              style={{
                color: "#64748b",
              }}
            >
              Nenhuma atividade recente.
            </p>
          )}
        </section>

        <section style={painelStyle}>
          <h2 style={tituloPainel}>
            ⭐ Projetos favoritos
          </h2>

          {projetosFavoritos.length >
          0 ? (
            <div
              style={{
                display: "grid",
                gap: "9px",
              }}
            >
              {projetosFavoritos
                .slice(0, 5)
                .map(
                  (projeto) => (
                    <button
                      key={
                        projeto.id
                      }
                      type="button"
                      onClick={() =>
                        abrirProjeto(
                          projeto
                        )
                      }
                      style={{
                        padding:
                          "12px",
                        borderRadius:
                          "10px",
                        border:
                          "1px solid #eab308",
                        background:
                          "#422006",
                        color:
                          "#fef3c7",
                        cursor:
                          "pointer",
                        textAlign:
                          "left",
                      }}
                    >
                      <strong
                        style={{
                          display:
                            "block",
                        }}
                      >
                        ⭐{" "}
                        {projeto.nome ||
                          "Projeto"}
                      </strong>

                      <small
                        style={{
                          color:
                            "#fde68a",
                        }}
                      >
                        {projeto.codigo ||
                          projeto.oem ||
                          projeto.status ||
                          "Abrir projeto"}
                      </small>
                    </button>
                  )
                )}
            </div>
          ) : (
            <div
              style={{
                color: "#64748b",
                lineHeight: 1.6,
              }}
            >
              Nenhum favorito ainda.
              <br />
              Marque projetos com ⭐ na tela Projetos.
            </div>
          )}
        </section>
      </div>

      <h2 style={tituloSecao}>
        📊 Base PAIIA
      </h2>

      <div style={gradeCards}>
        {cardsBase.map(
          (card) => (
            <button
              key={card.titulo}
              type="button"
              onClick={() =>
                abrirTela(
                  card.tela
                )
              }
              style={cardBase}
            >
              <div
                style={{
                  fontSize: "35px",
                }}
              >
                {card.icone}
              </div>

              <h3
                style={{
                  fontSize: "16px",
                  margin:
                    "8px 0",
                }}
              >
                {card.titulo}
              </h3>

              <strong
                style={{
                  color: "#2563eb",
                  fontSize: "32px",
                }}
              >
                {carregando
                  ? "..."
                  : card.total}
              </strong>
            </button>
          )
        )}
      </div>
    </div>
  );
}

const resumoExecutivoItem = {
  display: "grid",
  gap: "5px",
  padding: "14px",
  borderRadius: "12px",
  background: "rgba(2,6,23,.72)",
  border: "1px solid #164e63",
  color: "#cbd5e1",
  textAlign: "center",
};

const tituloSecao = {
  color: "#67e8f9",
  marginTop: "34px",
  marginBottom: "15px",
};

const gradeCards = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(165px,1fr))",
  gap: "14px",
};

const gradeDupla = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(330px,1fr))",
  gap: "20px",
  marginTop: "24px",
};

const cardMetrica = {
  padding: "18px",
  borderRadius: "16px",
  background: "#0f172a",
  display: "grid",
  gap: "5px",
  textAlign: "center",
  cursor: "pointer",
  boxShadow:
    "0 14px 32px rgba(0,0,0,.2)",
};

const cardBase = {
  background: "#ffffff",
  color: "#0f172a",
  borderRadius: "16px",
  padding: "18px",
  cursor: "pointer",
  boxShadow:
    "0 14px 32px rgba(0,0,0,.22)",
  border:
    "2px solid #2563eb",
  textAlign: "center",
};

const painelStyle = {
  padding: "22px",
  borderRadius: "18px",
  background: "#0f172a",
  border:
    "1px solid #334155",
  boxShadow:
    "0 15px 35px rgba(0,0,0,.18)",
};

const tituloPainel = {
  color: "#67e8f9",
  marginTop: 0,
  fontSize: "20px",
};

const barraFundo = {
  width: "100%",
  height: "12px",
  marginTop: "20px",
  background: "#1e293b",
  borderRadius: "999px",
  overflow: "hidden",
};

const botaoPrincipal = {
  width: "100%",
  marginTop: "18px",
  padding: "14px",
  borderRadius: "11px",
  border: "none",
  background:
    "linear-gradient(135deg,#2563eb,#22d3ee)",
  color: "#ffffff",
  cursor: "pointer",
  fontWeight: "bold",
  fontSize: "14px",
};

const legendaGrafico = {
  display: "flex",
  justifyContent: "center",
  gap: "16px",
  flexWrap: "wrap",
  color: "#94a3b8",
  fontSize: "11px",
  marginTop: "8px",
};

const itemAtividade = {
  display: "grid",
  gridTemplateColumns:
    "38px 1fr",
  gap: "10px",
  alignItems: "center",
  padding: "11px",
  borderRadius: "10px",
  background: "#020617",
  border:
    "1px solid #334155",
};