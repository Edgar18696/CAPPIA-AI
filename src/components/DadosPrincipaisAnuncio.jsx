export default function DadosPrincipaisAnuncio({
  codigo,
  setCodigo,
  oem,
  setOem,
  titulo,
  setTitulo,
  descricao,
  setDescricao,
  pecaEncontrada,
}) {
  return (
    <div style={{ marginTop: "20px" }}>
      <h3 style={{ color: "#67e8f9" }}>
        📝 Dados principais do anúncio
      </h3>

      <input
        type="text"
        inputMode="text"
        value={codigo}
        onChange={(e) =>
          setCodigo(e.target.value)
        }
        placeholder="Código da peça"
        style={inputStyle}
      />

      {pecaEncontrada && (
        <div
          style={{
            marginTop: "10px",
            padding: "12px",
            borderRadius: "10px",
            background: "#020617",
            border: "1px solid #2563eb",
            color: "#fff",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "20px",
              fontWeight: "bold",
            }}
          >
            {pecaEncontrada.codigo_oem ||
              codigo}
          </div>

          <div
            style={{
              fontSize: "18px",
            }}
          >
            {pecaEncontrada.peca ||
              "Peça Automotiva"}
          </div>

          <div
            style={{
              color: "#67e8f9",
            }}
          >
            {pecaEncontrada.fabricante ||
              "-"}
          </div>
        </div>
      )}

      <input
        type="text"
        value={oem}
        onChange={(e) =>
          setOem(e.target.value)
        }
        placeholder="Código OEM"
        style={inputStyle}
      />

      <input
        type="text"
        value={titulo}
        onChange={(e) =>
          setTitulo(e.target.value)
        }
        placeholder="Título do anúncio"
        maxLength={60}
        style={inputStyle}
      />

      <textarea
        value={descricao}
        onChange={(e) =>
          setDescricao(e.target.value)
        }
        placeholder="Descrição do anúncio"
        rows={8}
        style={{
          ...inputStyle,
          resize: "vertical",
          minHeight: "220px",
        }}
      />
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "12px",
  marginTop: "10px",
  borderRadius: "10px",
  border: "1px solid #334155",
  background: "#0f172a",
  color: "#fff",
  fontSize: "15px",
  boxSizing: "border-box",
};