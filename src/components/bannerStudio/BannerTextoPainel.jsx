import { memo } from "react";

function BannerTextoPainel({
  ativo,
  tituloStudio,
  setTituloStudio,
  corTituloStudio,
  setCorTituloStudio,
  tamanhoTituloStudio,
  setTamanhoTituloStudio,
  textosStudio = [],
  setTextosStudio,
  setCamadasStudio,
  elementoSelecionado,
  setElementoSelecionado,
  setTextoArrastando,
  atualizarTextoSelecionado,
}) {
  function adicionarTexto() {
    const textoLimpo =
      String(
        tituloStudio || ""
      ).trim();

    if (!textoLimpo) {
      return;
    }

    const novoTexto = {
      id: Date.now(),
      texto: textoLimpo,
      x: 450,
      y:
        100 +
        textosStudio.length *
          55,
      cor:
        corTituloStudio ||
        "#ffffff",
      tamanho:
        Number(
          tamanhoTituloStudio
        ) || 38,
    };

    setTextosStudio?.(
      (anteriores) => [
        ...anteriores,
        novoTexto,
      ]
    );

    setCamadasStudio?.(
      (anteriores) => [
        ...anteriores,
        {
          id: novoTexto.id,
          nome:
            `📝 ${novoTexto.texto}`,
          tipo: "texto",
        },
      ]
    );

    setElementoSelecionado?.(
      novoTexto.id
    );

    setTituloStudio?.("");
  }

  function excluirTexto() {
    if (
      !elementoSelecionado ||
      elementoSelecionado ===
        "produto"
    ) {
      return;
    }

    setTextosStudio?.(
      (anteriores) =>
        anteriores.filter(
          (texto) =>
            texto.id !==
            elementoSelecionado
        )
    );

    setCamadasStudio?.(
      (anteriores) =>
        anteriores.filter(
          (camada) =>
            camada.id !==
            elementoSelecionado
        )
    );

    setElementoSelecionado?.(
      null
    );

    setTextoArrastando?.(
      null
    );

    setTituloStudio?.("");
  }

  if (!ativo) {
    return null;
  }

  const textoValido =
    Boolean(
      String(
        tituloStudio || ""
      ).trim()
    );

  return (
    <div data-nao-exportar="true">
      <h3
        style={{
          color: "#67e8f9",
          marginTop: 0,
        }}
      >
        📝 Editor de Texto
      </h3>

      <input
        type="text"
        value={tituloStudio}
        placeholder="Digite o texto"
        onChange={(evento) => {
          const texto =
            evento.target.value;

          setTituloStudio?.(
            texto
          );

          atualizarTextoSelecionado?.(
            {
              texto,
            }
          );
        }}
        style={{
          width: "100%",
          boxSizing:
            "border-box",
          padding: "11px",
          borderRadius:
            "10px",
          border:
            "1px solid #475569",
          background:
            "#020617",
          color: "#ffffff",
          marginBottom:
            "12px",
        }}
      />

      <label
        style={{
          color: "#67e8f9",
          display: "block",
          marginBottom:
            "7px",
        }}
      >
        🎨 Cor
      </label>

      <input
        type="color"
        value={
          corTituloStudio
        }
        onChange={(evento) => {
          const cor =
            evento.target.value;

          setCorTituloStudio?.(
            cor
          );

          atualizarTextoSelecionado?.(
            {
              cor,
            }
          );
        }}
        style={{
          width: "100%",
          height: "42px",
          border: "none",
          marginBottom:
            "15px",
          cursor: "pointer",
        }}
      />

      <label
        style={{
          color: "#67e8f9",
          display: "block",
          marginBottom:
            "7px",
        }}
      >
        🔠 Tamanho:{" "}
        {tamanhoTituloStudio}
        px
      </label>

      <input
        type="range"
        min="20"
        max="90"
        value={
          tamanhoTituloStudio
        }
        onChange={(evento) => {
          const tamanho =
            Number(
              evento.target
                .value
            );

          setTamanhoTituloStudio?.(
            tamanho
          );

          atualizarTextoSelecionado?.(
            {
              tamanho,
            }
          );
        }}
        style={{
          width: "100%",
          marginBottom:
            "16px",
        }}
      />

      <button
        type="button"
        disabled={
          !textoValido
        }
        onClick={
          adicionarTexto
        }
        style={{
          width: "100%",
          padding: "12px",
          borderRadius:
            "10px",
          border: "none",
          background:
            textoValido
              ? "#2563eb"
              : "#475569",
          color: "#ffffff",
          fontWeight:
            "bold",
          cursor:
            textoValido
              ? "pointer"
              : "not-allowed",
        }}
      >
        ➕ Novo Texto
      </button>

      {elementoSelecionado &&
        elementoSelecionado !==
          "produto" && (
          <button
            type="button"
            onClick={
              excluirTexto
            }
            style={{
              width: "100%",
              marginTop:
                "12px",
              padding: "12px",
              borderRadius:
                "10px",
              border: "none",
              background:
                "#dc2626",
              color:
                "#ffffff",
              cursor:
                "pointer",
              fontWeight:
                "bold",
            }}
          >
            🗑️ Excluir Texto
          </button>
        )}
    </div>
  );
}

export default memo(
  BannerTextoPainel
);