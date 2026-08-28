import { useMemo, useState } from "react";

export default function Projetos({
  projetos,
  nomeProjeto,
  setNomeProjeto,
  descricaoProjeto,
  setDescricaoProjeto,
  statusProjeto,
  setStatusProjeto,
  novoStatus,
  setNovoStatus,
  editandoProjeto,
  setEditandoProjeto,
  criarProjeto,
  atualizarProjeto,
  excluirProjeto,
  buscaProjeto,
  setBuscaProjeto,
  cardStyle,
  buttonGreen,
  buttonBlue,
  buttonRed,
  setScreen,
  setAnuncioEditando,
}) {
  const [
    favoritosProjetos,
    setFavoritosProjetos,
  ] = useState(() => {
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
  });

  function salvarFavoritos(lista) {
    setFavoritosProjetos(lista);

    localStorage.setItem(
      "projetosFavoritosAppia",
      JSON.stringify(lista)
    );
  }

  function alternarFavorito(id) {
    const listaAtualizada =
      favoritosProjetos.includes(id)
        ? favoritosProjetos.filter(
            (item) => item !== id
          )
        : [
            ...favoritosProjetos,
            id,
          ];

    salvarFavoritos(
      listaAtualizada
    );
  }

  function duplicarProjeto(item) {
    setEditandoProjeto(null);

    setNomeProjeto(
      `${item.nome || "Projeto"} - Cópia`
    );

    setDescricaoProjeto(
      item.descricao || ""
    );

    setStatusProjeto(
      "Em andamento"
    );

    setNovoStatus("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function normalizarTexto(valor) {
    return String(valor || "")
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )
      .toLowerCase()
      .trim();
  }

  const projetosFiltrados =
    useMemo(() => {
      const termo =
        normalizarTexto(
          buscaProjeto
        );

      const lista = [
        ...(projetos || []),
      ];

      lista.sort((a, b) => {
        const favoritoA =
          favoritosProjetos.includes(
            a.id
          )
            ? 1
            : 0;

        const favoritoB =
          favoritosProjetos.includes(
            b.id
          )
            ? 1
            : 0;

        if (
          favoritoA !== favoritoB
        ) {
          return (
            favoritoB -
            favoritoA
          );
        }

        return String(
          b.updated_at ||
            b.created_at ||
            ""
        ).localeCompare(
          String(
            a.updated_at ||
              a.created_at ||
              ""
          )
        );
      });

      if (!termo) {
        return lista;
      }

      return lista.filter(
        (item) =>
          [
            item.nome,
            item.descricao,
            item.codigo,
            item.oem,
            item.status,
          ].some((campo) =>
            normalizarTexto(
              campo
            ).includes(termo)
          )
      );
    }, [
      projetos,
      buscaProjeto,
      favoritosProjetos,
    ]);

  const estatisticas =
    useMemo(() => {
      const lista =
        projetos || [];

      return {
        total: lista.length,
        andamento:
          lista.filter(
            (item) =>
              normalizarTexto(
                item.status
              ) ===
              "em andamento"
          ).length,
        concluidos:
          lista.filter(
            (item) =>
              normalizarTexto(
                item.status
              ) ===
              "concluido"
          ).length,
        publicados:
          lista.filter(
            (item) =>
              Boolean(
                item.publicado
              )
          ).length,
        favoritos:
          lista.filter(
            (item) =>
              favoritosProjetos.includes(
                item.id
              )
          ).length,
      };
    }, [
      projetos,
      favoritosProjetos,
    ]);

  function formatarData(data) {
    if (!data) {
      return "Sem data";
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
      return "Sem data";
    }
  }

  function calcularProgresso(item) {
    const etapas = [
      Boolean(item?.foto_pronta),
      Boolean(item?.banner_pronto),
      Boolean(item?.clip_pronto),
      Boolean(item?.anuncio_pronto),
      Boolean(item?.publicado),
    ];

    const concluidos =
      etapas.filter(Boolean).length;

    return {
      percentual: Math.round(
        (concluidos / etapas.length) *
          100
      ),
      concluidos,
      total: etapas.length,
    };
  }

  function abrirProjeto(item) {
    localStorage.setItem(
      "projetoAppiaAtual",
      JSON.stringify(item)
    );

    localStorage.setItem(
      "rascunhoNovoAnuncioTemp",
      JSON.stringify({
        codigo: item.codigo || "",
        oem: item.oem || "",
        titulo: item.nome || "",
        descricao:
          item.descricao || "",
        preco: "",
        tipoAnuncio: "classico",
        pecaEncontrada: null,
        fotos: [],
        clip: item.clip_url || "",
      })
    );

    setAnuncioEditando?.({
      projeto_id: item.id,
      codigo: item.codigo || "",
      oem: item.oem || "",
      titulo: item.nome || "",
      descricao:
        item.descricao || "",
      fotos: [],
    });

    if (setScreen) {
      setScreen("novoAnuncio");
      return;
    }

    alert(
      "O componente Projetos não recebeu setScreen."
    );
  }

  return (
    <div style={{ marginTop: "50px" }}>
      <h2>📦 Projetos</h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit,minmax(150px,1fr))",
          gap: "12px",
          maxWidth: "1000px",
          margin: "20px auto",
        }}
      >
        {[
          [
            "📦",
            "Total",
            estatisticas.total,
            "#2563eb",
          ],
          [
            "🟡",
            "Em andamento",
            estatisticas.andamento,
            "#f59e0b",
          ],
          [
            "🟢",
            "Concluídos",
            estatisticas.concluidos,
            "#22c55e",
          ],
          [
            "🚀",
            "Publicados",
            estatisticas.publicados,
            "#38bdf8",
          ],
          [
            "⭐",
            "Favoritos",
            estatisticas.favoritos,
            "#eab308",
          ],
        ].map(
          ([
            icone,
            titulo,
            total,
            cor,
          ]) => (
            <div
              key={titulo}
              style={{
                background:
                  "#0f172a",
                border:
                  `1px solid ${cor}`,
                borderRadius:
                  "14px",
                padding: "16px",
                textAlign:
                  "center",
              }}
            >
              <div
                style={{
                  fontSize: "28px",
                }}
              >
                {icone}
              </div>

              <strong
                style={{
                  display: "block",
                  color: cor,
                  fontSize: "28px",
                  marginTop: "5px",
                }}
              >
                {total}
              </strong>

              <span
                style={{
                  color: "#cbd5e1",
                  fontSize: "12px",
                }}
              >
                {titulo}
              </span>
            </div>
          )
        )}
      </div>

      <div
        style={{
          ...cardStyle,
          maxWidth: "700px",
          margin: "20px auto",
        }}
      >
        {editandoProjeto && (
          <h3
            style={{
              color: "#f59e0b",
              marginBottom: "20px",
            }}
          >
            ✏️ Editando Projeto
          </h3>
        )}

        <input
          placeholder="Nome do projeto"
          value={nomeProjeto}
          onChange={(e) =>
            setNomeProjeto(
              e.target.value
            )
          }
          style={{
            width: "90%",
            padding: "12px",
            marginBottom: "10px",
          }}
        />

        <textarea
          placeholder="Descrição"
          value={descricaoProjeto}
          onChange={(e) =>
            setDescricaoProjeto(
              e.target.value
            )
          }
          style={{
            width: "90%",
            padding: "12px",
            height: "120px",
            marginBottom: "10px",
          }}
        />

        <select
          value={
            editandoProjeto
              ? novoStatus
              : statusProjeto
          }
          onChange={(e) => {
            if (editandoProjeto) {
              setNovoStatus(
                e.target.value
              );
            } else {
              setStatusProjeto(
                e.target.value
              );
            }
          }}
          style={{
            width: "90%",
            padding: "12px",
            marginBottom: "15px",
          }}
        >
          <option value="Em andamento">
            Em andamento
          </option>

          <option value="Concluído">
            Concluído
          </option>

          <option value="Pausado">
            Pausado
          </option>
        </select>

        {editandoProjeto ? (
          <button
            onClick={atualizarProjeto}
            style={buttonGreen}
          >
            💾 Salvar Alterações
          </button>
        ) : (
          <button
            onClick={criarProjeto}
            style={buttonBlue}
          >
            ➕ Criar Projeto
          </button>
        )}
      </div>

      <input
        placeholder="🔍 Buscar por nome, código, OEM, descrição ou status..."
        value={buscaProjeto}
        onChange={(e) =>
          setBuscaProjeto(
            e.target.value
          )
        }
        style={{
          width: "100%",
          maxWidth: "500px",
          padding: "14px",
          margin: "20px auto",
          display: "block",
          borderRadius: "10px",
          border:
            "1px solid #2563eb",
          fontSize: "16px",
        }}
      />

      <h3
        style={{
          color: "#38bdf8",
          marginTop: "20px",
        }}
      >
        Projetos encontrados:{" "}
        {projetosFiltrados.length}
      </h3>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit,minmax(300px,1fr))",
          gap: "20px",
        }}
      >
        {projetosFiltrados
          .map((item) => {
            const progresso =
              calcularProgresso(item);

            return (
              <div
                key={item.id}
                style={{
                  ...cardStyle,
                  border:
                    progresso.percentual ===
                    100
                      ? "1px solid #22c55e"
                      : cardStyle?.border ||
                        "1px solid #2563eb",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent:
                      "space-between",
                    alignItems:
                      "center",
                    marginBottom:
                      "10px",
                  }}
                >
                  <span
                    style={{
                      color:
                        "#94a3b8",
                      fontSize:
                        "11px",
                    }}
                  >
                    Atualizado:{" "}
                    {formatarData(
                      item.updated_at ||
                        item.created_at
                    )}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      alternarFavorito(
                        item.id
                      )
                    }
                    title={
                      favoritosProjetos.includes(
                        item.id
                      )
                        ? "Remover dos favoritos"
                        : "Adicionar aos favoritos"
                    }
                    style={{
                      width: "38px",
                      height: "38px",
                      borderRadius:
                        "50%",
                      border:
                        favoritosProjetos.includes(
                          item.id
                        )
                          ? "1px solid #eab308"
                          : "1px solid #334155",
                      background:
                        favoritosProjetos.includes(
                          item.id
                        )
                          ? "#422006"
                          : "#020617",
                      color:
                        "#fde047",
                      cursor:
                        "pointer",
                      fontSize:
                        "18px",
                    }}
                  >
                    {favoritosProjetos.includes(
                      item.id
                    )
                      ? "⭐"
                      : "☆"}
                  </button>
                </div>

                {item.imagem && (
                  <img
                    src={item.imagem}
                    alt=""
                    style={{
                      width: "100%",
                      height: "120px",
                      objectFit: "cover",
                      borderRadius:
                        "10px",
                      marginBottom:
                        "15px",
                    }}
                  />
                )}

                <h3>{item.nome}</h3>

                <p
                  style={{
                    color: "#93c5fd",
                  }}
                >
                  {item.descricao}
                </p>

                {(item.codigo ||
                  item.oem) && (
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      flexWrap: "wrap",
                      marginBottom:
                        "10px",
                    }}
                  >
                    {item.codigo && (
                      <span
                        style={chipTecnico}
                      >
                        Código:{" "}
                        {item.codigo}
                      </span>
                    )}

                    {item.oem && (
                      <span
                        style={chipTecnico}
                      >
                        OEM: {item.oem}
                      </span>
                    )}
                  </div>
                )}

                <p
                  style={{
                    color:
                      item.status ===
                      "Concluído"
                        ? "#22c55e"
                        : item.status ===
                            "Pausado"
                          ? "#f59e0b"
                          : "#38bdf8",
                    fontWeight: "bold",
                  }}
                >
                  📌 {item.status}
                </p>

                <div
                  style={{
                    marginTop: "15px",
                    padding: "14px",
                    borderRadius: "12px",
                    background: "#020617",
                    border:
                      progresso.percentual ===
                      100
                        ? "1px solid #22c55e"
                        : "1px solid #334155",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      color: "#cbd5e1",
                      fontSize: "13px",
                      marginBottom: "7px",
                    }}
                  >
                    <span>
                      Progresso do projeto
                    </span>

                    <strong>
                      {progresso.percentual}
                      %
                    </strong>
                  </div>

                  <div
                    style={{
                      width: "100%",
                      height: "10px",
                      background:
                        "#1e293b",
                      borderRadius:
                        "999px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width:
                          `${progresso.percentual}%`,
                        height: "100%",
                        background:
                          progresso.percentual ===
                          100
                            ? "linear-gradient(90deg,#16a34a,#22c55e)"
                            : "linear-gradient(90deg,#2563eb,#22d3ee)",
                        transition:
                          "width .3s ease",
                      }}
                    />
                  </div>

                  <div
                    style={{
                      marginTop: "8px",
                      color: "#94a3b8",
                      fontSize: "11px",
                      textAlign: "right",
                    }}
                  >
                    {progresso.concluidos} de{" "}
                    {progresso.total} etapas
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(2,minmax(0,1fr))",
                      gap: "8px",
                      marginTop: "12px",
                      fontSize: "12px",
                      color: "#cbd5e1",
                    }}
                  >
                    <span>
                      {item.foto_pronta
                        ? "✅"
                        : "⬜"}{" "}
                      Foto IA
                    </span>

                    <span>
                      {item.banner_pronto
                        ? "✅"
                        : "⬜"}{" "}
                      Banner IA
                    </span>

                    <span>
                      {item.clip_pronto
                        ? "✅"
                        : "⬜"}{" "}
                      Clip IA
                    </span>

                    <span>
                      {item.anuncio_pronto
                        ? "✅"
                        : "⬜"}{" "}
                      Anúncio
                    </span>

                    <span>
                      {item.publicado
                        ? "✅"
                        : "⬜"}{" "}
                      Publicado
                    </span>
                  </div>

                  {progresso.percentual ===
                    100 && (
                    <div
                      style={{
                        marginTop:
                          "12px",
                        padding: "9px",
                        borderRadius:
                          "9px",
                        background:
                          "#052e16",
                        border:
                          "1px solid #22c55e",
                        color:
                          "#bbf7d0",
                        textAlign:
                          "center",
                        fontSize:
                          "12px",
                        fontWeight:
                          "bold",
                      }}
                    >
                      🟢 Projeto finalizado
                    </div>
                  )}
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: "10px",
                    flexWrap: "wrap",
                    justifyContent:
                      "center",
                    marginTop: "14px",
                  }}
                >
                  <button
                    type="button"
                    onClick={() =>
                      abrirProjeto(item)
                    }
                    style={buttonGreen}
                  >
                    🚀 Abrir Projeto
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEditandoProjeto(
                        item.id
                      );

                      setNomeProjeto(
                        item.nome || ""
                      );

                      setDescricaoProjeto(
                        item.descricao ||
                          ""
                      );

                      setStatusProjeto(
                        item.status ||
                          "Em andamento"
                      );

                      setNovoStatus(
                        item.status ||
                          "Em andamento"
                      );

                      setTimeout(() => {
                        window.scrollTo({
                          top: 0,
                          behavior:
                            "smooth",
                        });
                      }, 100);
                    }}
                    style={buttonBlue}
                  >
                    ✏️ Editar
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      duplicarProjeto(
                        item
                      )
                    }
                    style={{
                      ...buttonBlue,
                      background:
                        "#7c3aed",
                    }}
                  >
                    📄 Duplicar
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      excluirProjeto(
                        item.id
                      )
                    }
                    style={buttonRed}
                  >
                    🗑️ Excluir
                  </button>
                </div>
              </div>
            );
          })}
      </div>

      {projetosFiltrados.length ===
        0 && (
        <div
          style={{
            ...cardStyle,
            maxWidth: "650px",
            margin: "25px auto",
            textAlign: "center",
            color: "#94a3b8",
          }}
        >
          🔍 Nenhum projeto encontrado.
        </div>
      )}
    </div>
  );
}

const chipTecnico = {
  padding: "6px 9px",
  borderRadius: "999px",
  background: "#0f172a",
  border: "1px solid #334155",
  color: "#cbd5e1",
  fontSize: "11px",
  fontWeight: "bold",
};