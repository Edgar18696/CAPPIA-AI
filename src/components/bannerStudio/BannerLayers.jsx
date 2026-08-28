import { memo } from "react";

function BannerLayers({
  camadas = [],
  elementoSelecionado,
  setElementoSelecionado,
  setImagemSelecionadaId,
  onAlternarVisibilidade,
  onAlternarBloqueio,
  onMoverCamada,
  onExcluirCamada,
}) {
  return (
    <div data-nao-exportar="true">
      <h3
        style={{
          color: "#67e8f9",
          marginTop: 0,
          marginBottom: "8px",
        }}
      >
        📚 Camadas
      </h3>

      <p
        style={{
          color: "#94a3b8",
          fontSize: "12px",
          lineHeight: 1.45,
          marginTop: 0,
        }}
      >
        Organize, oculte ou bloqueie os elementos do banner.
      </p>

      <div
        style={{
          marginBottom: "12px",
          padding: "9px 10px",
          borderRadius: "10px",
          border: "1px solid #334155",
          background: "#0f172a",
          color: "#cbd5e1",
          fontSize: "11px",
          lineHeight: 1.5,
        }}
      >
        ⌨️ Atalhos: Ctrl+D duplicar • Delete excluir • Ctrl+Z desfazer • Esc cancelar seleção
      </div>

      {camadas.length === 0 ? (
        <p style={{ color: "#94a3b8" }}>
          Nenhuma camada adicionada.
        </p>
      ) : (
        <div
          style={{
            display: "grid",
            gap: "9px",
          }}
        >
          {[...camadas]
            .reverse()
            .map((camada) => {
              const visivel =
                camada.visivel !== false;

              const bloqueado =
                Boolean(camada.bloqueado);

              const selecionada =
                elementoSelecionado ===
                camada.id;

              return (
                <div
                  key={camada.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "1fr auto",
                    gap: "7px",
                    padding: "8px",
                    borderRadius: "12px",
                    border: selecionada
                      ? "2px solid #22d3ee"
                      : "1px solid #334155",
                    background: selecionada
                      ? "#164e63"
                      : "#020617",
                    opacity: visivel
                      ? 1
                      : 0.62,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        !visivel ||
                        bloqueado
                      ) {
                        return;
                      }

                      setElementoSelecionado?.(
                        camada.id
                      );

                      if (
                        camada.tipo ===
                        "produto"
                      ) {
                        setImagemSelecionadaId?.(
                          camada.id
                        );
                      }
                    }}
                    style={{
                      minWidth: 0,
                      padding: "7px 8px",
                      borderRadius: "8px",
                      border: "none",
                      background:
                        "transparent",
                      color: "#ffffff",
                      cursor:
                        visivel &&
                        !bloqueado
                          ? "pointer"
                          : "default",
                      textAlign: "left",
                      fontWeight: "bold",
                      overflow: "hidden",
                      textOverflow:
                        "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {camada.nome}
                  </button>

                  <div
                    style={{
                      display: "flex",
                      gap: "4px",
                      alignItems: "center",
                    }}
                  >
                    <button
                      type="button"
                      title={
                        visivel
                          ? "Ocultar camada"
                          : "Mostrar camada"
                      }
                      onClick={() =>
                        onAlternarVisibilidade?.(
                          camada.id
                        )
                      }
                      style={botaoIconeCamada}
                    >
                      {visivel
                        ? "👁️"
                        : "🚫"}
                    </button>

                    <button
                      type="button"
                      title={
                        bloqueado
                          ? "Desbloquear camada"
                          : "Bloquear camada"
                      }
                      onClick={() =>
                        onAlternarBloqueio?.(
                          camada.id
                        )
                      }
                      style={botaoIconeCamada}
                    >
                      {bloqueado
                        ? "🔒"
                        : "🔓"}
                    </button>
                  </div>

                  <div
                    style={{
                      gridColumn:
                        "1 / -1",
                      display: "grid",
                      gridTemplateColumns:
                        "1fr 1fr 1fr",
                      gap: "6px",
                    }}
                  >
                    <button
                      type="button"
                      title="Trazer para frente"
                      onClick={() =>
                        onMoverCamada?.(
                          camada.id,
                          "subir"
                        )
                      }
                      style={botaoAcaoCamada}
                    >
                      ⬆ Frente
                    </button>

                    <button
                      type="button"
                      title="Enviar para trás"
                      onClick={() =>
                        onMoverCamada?.(
                          camada.id,
                          "descer"
                        )
                      }
                      style={botaoAcaoCamada}
                    >
                      ⬇ Trás
                    </button>

                    <button
                      type="button"
                      title="Excluir camada"
                      onClick={() =>
                        onExcluirCamada?.(
                          camada
                        )
                      }
                      style={{
                        ...botaoAcaoCamada,
                        color: "#fecaca",
                        borderColor:
                          "#7f1d1d",
                        background:
                          "#450a0a",
                      }}
                    >
                      🗑 Excluir
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

const botaoIconeCamada = {
  width: "32px",
  height: "32px",
  padding: 0,
  borderRadius: "8px",
  border: "1px solid #334155",
  background: "#0f172a",
  color: "#e2e8f0",
  cursor: "pointer",
};

const botaoAcaoCamada = {
  padding: "8px 5px",
  borderRadius: "8px",
  border: "1px solid #334155",
  background: "#0f172a",
  color: "#cbd5e1",
  cursor: "pointer",
  fontSize: "10px",
  fontWeight: "bold",
};

export default memo(BannerLayers);