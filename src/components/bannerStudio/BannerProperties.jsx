import { memo } from "react";

function BannerProperties({
  elementoSelecionado,
  onAtualizar,
  onDuplicar,
  onExcluir,
}) {
  if (!elementoSelecionado) {
    return null;
  }

  function atualizar(campo, valor) {
    onAtualizar?.({
      ...elementoSelecionado,
      [campo]: valor,
    });
  }

  return (
    <div
      data-nao-exportar="true"
      style={{
        background: "#020617",
        border: "1px solid #334155",
        borderRadius: 12,
        padding: 16,
        display: "grid",
        gap: 12,
      }}
    >
      <h3
        style={{
          margin: 0,
          color: "#67e8f9",
        }}
      >
        ⚙️ Propriedades
      </h3>

      <label>
        Cor
        <input
          type="color"
          value={elementoSelecionado.cor || "#ffffff"}
          onChange={(e) =>
            atualizar("cor", e.target.value)
          }
        />
      </label>

      <label>
        Tamanho
        <input
          type="range"
          min="8"
          max="200"
          value={elementoSelecionado.tamanho || 32}
          onChange={(e) =>
            atualizar(
              "tamanho",
              Number(e.target.value)
            )
          }
        />
      </label>

      <label>
        Opacidade
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={elementoSelecionado.opacidade ?? 1}
          onChange={(e) =>
            atualizar(
              "opacidade",
              Number(e.target.value)
            )
          }
        />
      </label>

      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <button onClick={onDuplicar}>
          📄 Duplicar
        </button>

        <button onClick={onExcluir}>
          🗑️ Excluir
        </button>
      </div>
    </div>
  );
}

export default memo(BannerProperties);