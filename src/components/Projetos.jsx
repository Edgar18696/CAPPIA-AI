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
}) {
  return (
    <div style={{ marginTop: "50px" }}>
      <h2>📦 Projetos</h2>

      <div style={{ ...cardStyle, maxWidth: "700px", margin: "20px auto" }}>
        {editandoProjeto && (
          <h3 style={{ color: "#f59e0b", marginBottom: "20px" }}>
            ✏️ Editando Projeto
          </h3>
        )}

        <input
          placeholder="Nome do projeto"
          value={nomeProjeto}
          onChange={(e) => setNomeProjeto(e.target.value)}
          style={{
            width: "90%",
            padding: "12px",
            marginBottom: "10px",
          }}
        />

        <textarea
          placeholder="Descrição"
          value={descricaoProjeto}
          onChange={(e) => setDescricaoProjeto(e.target.value)}
          style={{
            width: "90%",
            padding: "12px",
            height: "120px",
            marginBottom: "10px",
          }}
        />

        <select
          value={editandoProjeto ? novoStatus : statusProjeto}
          onChange={(e) => {
            if (editandoProjeto) {
              setNovoStatus(e.target.value);
            } else {
              setStatusProjeto(e.target.value);
            }
          }}
          style={{
            width: "90%",
            padding: "12px",
            marginBottom: "15px",
          }}
        >
          <option value="Em andamento">Em andamento</option>
          <option value="Concluído">Concluído</option>
          <option value="Pausado">Pausado</option>
        </select>

        {editandoProjeto ? (
          <button onClick={atualizarProjeto} style={buttonGreen}>
            💾 Salvar Alterações
          </button>
        ) : (
          <button onClick={criarProjeto} style={buttonBlue}>
            ➕ Criar Projeto
          </button>
        )}
      </div>

      <input
        placeholder="🔍 Buscar projeto por nome..."
        value={buscaProjeto}
        onChange={(e) => setBuscaProjeto(e.target.value)}
        style={{
          width: "100%",
          maxWidth: "500px",
          padding: "14px",
          margin: "20px auto",
          display: "block",
          borderRadius: "10px",
          border: "1px solid #2563eb",
          fontSize: "16px",
        }}
      />

      <h3 style={{ color: "#38bdf8", marginTop: "20px" }}>
        Total Projetos: {projetos.length}
      </h3>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))",
          gap: "20px",
        }}
      >
        {projetos
          .filter((item) =>
            item.nome?.toLowerCase().includes(buscaProjeto.toLowerCase())
          )
          .map((item) => (
            <div key={item.id} style={cardStyle}>
              {item.imagem && (
                <img
                  src={item.imagem}
                  alt=""
                  style={{
                    width: "100%",
                    height: "120px",
                    objectFit: "cover",
                    borderRadius: "10px",
                    marginBottom: "15px",
                  }}
                />
              )}

              <h3>{item.nome}</h3>

              <p style={{ color: "#93c5fd" }}>{item.descricao}</p>

              <p
                style={{
                  color:
                    item.status === "Concluído"
                      ? "#22c55e"
                      : item.status === "Pausado"
                      ? "#f59e0b"
                      : "#38bdf8",
                  fontWeight: "bold",
                }}
              >
                📌 {item.status}
              </p>

              <button
                onClick={() => {
                  setEditandoProjeto(item.id);
                  setNomeProjeto(item.nome || "");
                  setDescricaoProjeto(item.descricao || "");
                  setStatusProjeto(item.status || "Em andamento");
                  setNovoStatus(item.status || "Em andamento");

                  setTimeout(() => {
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }, 100);
                }}
                style={buttonBlue}
              >
                ✏️ Editar
              </button>

              <button onClick={() => excluirProjeto(item.id)} style={buttonRed}>
                🗑️ Excluir
              </button>
            </div>
          ))}
      </div>
    </div>
  );
}