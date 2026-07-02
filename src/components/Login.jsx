export default function Login({
  email,
  setEmail,
  senha,
  setSenha,
  entrarUsuario,
  cadastrarUsuario,
  cardStyle,
}) {
  return (
    <div style={{ ...cardStyle, maxWidth: "450px", margin: "50px auto" }}>
      <h2>🔐 Login APPIA AI</h2>

      <input
        placeholder="E-mail"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ width: "90%", padding: "12px", marginTop: "15px" }}
      />

      <input
        type="password"
        placeholder="Senha"
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        style={{ width: "90%", padding: "12px", marginTop: "15px" }}
      />

      <br />

      <button
        onClick={entrarUsuario}
        style={{ marginTop: "20px", padding: "12px" }}
      >
        Entrar
      </button>

      <button
        onClick={cadastrarUsuario}
        style={{ marginLeft: "10px", padding: "12px" }}
      >
        Criar Conta
      </button>
    </div>
  );
}