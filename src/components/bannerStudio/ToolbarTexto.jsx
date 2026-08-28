export default function ToolbarTexto({
  texto,
  onAtualizar,
  onDuplicar,
  onExcluir,
}) {
  if (!texto) {
    return null;
  }

  function alterarTamanho(valor) {
    onAtualizar?.({
      tamanho: Math.max(
        10,
        Math.min(
          160,
          Number(texto.tamanho || 32) +
            valor
        )
      ),
    });
  }

  function alternarNegrito() {
    onAtualizar?.({
      negrito:
        texto.negrito === false,
    });
  }

  function alternarItalico() {
    onAtualizar?.({
      italico:
        !texto.italico,
    });
  }

  function alternarSublinhado() {
    onAtualizar?.({
      sublinhado:
        !texto.sublinhado,
    });
  }

  function alterarAlinhamento() {
    const alinhamentos = [
      "left",
      "center",
      "right",
    ];

    const atual =
      alinhamentos.indexOf(
        texto.alinhamento ||
          "center"
      );

    const proximo =
      alinhamentos[
        (atual + 1) %
          alinhamentos.length
      ];

    onAtualizar?.({
      alinhamento:
        proximo,
    });
  }

  return (
    <div
      onMouseDown={(evento) => {
        evento.stopPropagation();
      }}
      onClick={(evento) => {
        evento.stopPropagation();
      }}
      style={{
        position: "absolute",

        left: `${texto.x}px`,

        top: `${Math.max(
          58,
          texto.y - 58
        )}px`,

        transform:
          "translate(-50%, -100%)",

        display: "flex",
        alignItems: "center",
        gap: "5px",

        padding: "7px",

        borderRadius: "12px",

        background:
          "rgba(15, 23, 42, 0.97)",

        border:
          "1px solid #334155",

        boxShadow:
          "0 12px 30px rgba(0,0,0,0.45)",

        zIndex: 200,

        whiteSpace: "nowrap",
      }}
    >
      <Botao
        titulo="Negrito"
        ativo={
          texto.negrito !== false
        }
        onClick={
          alternarNegrito
        }
      >
        B
      </Botao>

      <Botao
        titulo="Itálico"
        ativo={
          Boolean(
            texto.italico
          )
        }
        onClick={
          alternarItalico
        }
      >
        <em>I</em>
      </Botao>

      <Botao
        titulo="Sublinhado"
        ativo={
          Boolean(
            texto.sublinhado
          )
        }
        onClick={
          alternarSublinhado
        }
      >
        <u>U</u>
      </Botao>

      <Divisor />

      <Botao
        titulo="Diminuir fonte"
        onClick={() =>
          alterarTamanho(-2)
        }
      >
        A−
      </Botao>

      <span
        style={{
          minWidth: "38px",
          color: "#e2e8f0",
          textAlign: "center",
          fontSize: "12px",
          fontWeight: "bold",
        }}
      >
        {texto.tamanho || 32}
      </span>

      <Botao
        titulo="Aumentar fonte"
        onClick={() =>
          alterarTamanho(2)
        }
      >
        A+
      </Botao>

      <Divisor />

      <label
        title="Cor do texto"
        style={{
          width: "30px",
          height: "30px",

          display: "flex",
          alignItems: "center",
          justifyContent:
            "center",

          borderRadius: "7px",

          border:
            "1px solid #475569",

          background:
            "#020617",

          cursor: "pointer",

          overflow: "hidden",
        }}
      >
        <span
          style={{
            width: "17px",
            height: "17px",

            borderRadius: "50%",

            background:
              texto.cor ||
              "#ffffff",

            border:
              "2px solid #ffffff",
          }}
        />

        <input
          type="color"
          value={
            texto.cor ||
            "#ffffff"
          }
          onChange={(evento) =>
            onAtualizar?.({
              cor:
                evento.target
                  .value,
            })
          }
          style={{
            position:
              "absolute",

            width: "1px",
            height: "1px",

            opacity: 0,
          }}
        />
      </label>

      <select
        value={
          texto.fonte ||
          "Arial"
        }
        onChange={(evento) =>
          onAtualizar?.({
            fonte:
              evento.target
                .value,
          })
        }
        title="Fonte"
        style={{
          height: "30px",

          maxWidth: "105px",

          padding: "0 6px",

          borderRadius: "7px",

          border:
            "1px solid #475569",

          background:
            "#020617",

          color: "#e2e8f0",

          cursor: "pointer",

          outline: "none",

          fontSize: "11px",
        }}
      >
        <option value="Arial">
          Arial
        </option>

        <option value="Montserrat">
          Montserrat
        </option>

        <option value="Roboto">
          Roboto
        </option>

        <option value="Impact">
          Impact
        </option>

        <option value="Georgia">
          Georgia
        </option>

        <option value="Verdana">
          Verdana
        </option>
      </select>

      <Botao
        titulo="Alterar alinhamento"
        onClick={
          alterarAlinhamento
        }
      >
        {texto.alinhamento ===
        "left"
          ? "≡←"
          : texto.alinhamento ===
              "right"
            ? "→≡"
            : "≡"}
      </Botao>

      <Divisor />

      <Botao
        titulo="Duplicar texto"
        onClick={() =>
          onDuplicar?.(
            texto.id
          )
        }
      >
        📋
      </Botao>

      <Botao
        titulo="Excluir texto"
        perigo
        onClick={() =>
          onExcluir?.(
            texto.id
          )
        }
      >
        🗑️
      </Botao>
    </div>
  );
}

function Botao({
  children,
  titulo,
  ativo = false,
  perigo = false,
  onClick,
}) {
  return (
    <button
      type="button"
      title={titulo}
      onClick={onClick}
      style={{
        minWidth: "30px",
        height: "30px",

        padding: "0 7px",

        borderRadius: "7px",

        border: ativo
          ? "1px solid #22d3ee"
          : perigo
            ? "1px solid #7f1d1d"
            : "1px solid #475569",

        background: ativo
          ? "#164e63"
          : perigo
            ? "#450a0a"
            : "#020617",

        color: perigo
          ? "#fecaca"
          : "#f8fafc",

        cursor: "pointer",

        fontSize: "12px",
        fontWeight: "bold",

        display: "flex",
        alignItems: "center",
        justifyContent:
          "center",
      }}
    >
      {children}
    </button>
  );
}

function Divisor() {
  return (
    <div
      style={{
        width: "1px",
        height: "22px",
        background:
          "#334155",
        margin: "0 2px",
      }}
    />
  );
}