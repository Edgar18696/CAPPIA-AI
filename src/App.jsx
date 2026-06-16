import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export default function App() {
  const [screen, setScreen] = useState("home");
  const [usuario, setUsuario] = useState(null);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  const [totalFotos, setTotalFotos] = useState(0);
  const [ultimasImagens, setUltimasImagens] = useState([]);
  const [galeria, setGaleria] = useState([]);

  const [arquivo, setArquivo] = useState(null);
  const [preview, setPreview] = useState("");
  const [urlPublica, setUrlPublica] = useState("");
  const [resultadoIA, setResultadoIA] = useState("");
  const [processando, setProcessando] = useState(false);

  useEffect(() => {
    verificarUsuario();
  }, []);

  useEffect(() => {
    if (usuario) {
      carregarDashboard();
      carregarGaleria();
    }
  }, [usuario]);

  async function verificarUsuario() {
    const { data } = await supabase.auth.getUser();
    setUsuario(data.user || null);
  }

  async function entrarUsuario() {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });

    if (error) {
      alert(error.message);
      return;
    }

    setUsuario(data.user);
    alert("Login realizado!");
  }

  async function cadastrarUsuario() {
    const { error } = await supabase.auth.signUp({
      email,
      password: senha,
    });

    if (error) {
      alert(error.message);
      return;
    }

    alert("Cadastro criado! Verifique seu e-mail.");
  }

  async function sairUsuario() {
    await supabase.auth.signOut();
    setUsuario(null);
    setGaleria([]);
    setUltimasImagens([]);
    setTotalFotos(0);
    setScreen("login");
  }

  async function carregarDashboard() {
    if (!usuario) return;

    const { count } = await supabase
      .from("processamentos")
      .select("*", { count: "exact", head: true })
      .eq("user_id", usuario.id);

    setTotalFotos(count || 0);

    const { data } = await supabase
      .from("processamentos")
      .select("*")
      .eq("user_id", usuario.id)
      .not("imagem_processada", "is", null)
      .order("created_at", { ascending: false })
      .limit(6);

    setUltimasImagens(data || []);
  }

  async function carregarGaleria() {
    if (!usuario) return;

    const { data, error } = await supabase
      .from("processamentos")
      .select("*")
      .eq("user_id", usuario.id)
      .not("imagem_processada", "is", null)
      .order("created_at", { ascending: false });

    if (error) {
      console.log(error);
      return;
    }

    setGaleria(data || []);
  }

  async function enviarImagem() {
    if (!usuario) {
      alert("Faça login primeiro");
      setScreen("login");
      return;
    }

    if (!arquivo) {
      alert("Escolha uma imagem primeiro");
      return;
    }

    const nomeArquivo = `${Date.now()}-${arquivo.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9.]/g, "-")}`;

    const { error } = await supabase.storage
      .from("imagens")
      .upload(nomeArquivo, arquivo, { upsert: true });

    if (error) {
      alert(error.message);
      return;
    }

    const { data } = supabase.storage
      .from("imagens")
      .getPublicUrl(nomeArquivo);

    setUrlPublica(data.publicUrl);
    alert("Imagem enviada!");
  }

  async function processarIA() {
    if (!urlPublica) {
      alert("Envie a imagem primeiro");
      return;
    }

    setProcessando(true);

    try {
      const resposta = await fetch(
        "https://arqzpqkkpwikyecdbopf.supabase.co/functions/v1/processar-imagem",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl: urlPublica }),
        }
      );

      const dados = await resposta.json();

      if (!dados.imagem_processada) {
        alert("A Function não retornou imagem.");
        setProcessando(false);
        return;
      }

      setResultadoIA(dados.imagem_processada);

      const { error } = await supabase.from("processamentos").insert([
        {
          imagem_original: urlPublica,
          imagem_processada: dados.imagem_processada,
          status: "processado",
          user_id: usuario.id,
        },
      ]);

      if (error) {
        alert(error.message);
      } else {
        await carregarDashboard();
        await carregarGaleria();
        alert("Imagem processada e salva!");
      }
    } catch (erro) {
      console.log(erro);
      alert("Erro ao processar imagem.");
    }

    setProcessando(false);
  }

  async function baixarImagem(url) {
    const resposta = await fetch(url);
    const blob = await resposta.blob();

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `appia-ai-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const cardStyle = {
    background: "#0f172a",
    padding: "20px",
    borderRadius: "12px",
    border: "1px solid #1d4ed8",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#020617",
        color: "white",
        padding: "40px",
        textAlign: "center",
        fontFamily: "Arial",
      }}
    >
      <h1>🚀 APPIA AI</h1>
      <p>Transformando imagens em vendas</p>

      {usuario && (
        <p style={{ color: "#93c5fd" }}>
          Logado como: <strong>{usuario.email}</strong>
        </p>
      )}

      <div style={{ display: "flex", justifyContent: "center", gap: "15px", flexWrap: "wrap" }}>
        <button onClick={() => setScreen("home")}>Home</button>
        <button onClick={() => setScreen("foto")}>Fotos IA</button>
        <button onClick={() => setScreen("galeria")}>Galeria</button>
        <button onClick={() => setScreen("admin")}>Administrador</button>
        {!usuario ? (
          <button onClick={() => setScreen("login")}>Login</button>
        ) : (
          <button onClick={sairUsuario}>Sair</button>
        )}
      </div>

      {screen === "login" && (
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

          <button onClick={entrarUsuario} style={{ marginTop: "20px", padding: "12px" }}>
            Entrar
          </button>

          <button onClick={cadastrarUsuario} style={{ marginLeft: "10px", padding: "12px" }}>
            Criar Conta
          </button>
        </div>
      )}

      {screen === "home" && (
        <div style={{ marginTop: "50px" }}>
          <h2>Painel de Controle APPIA AI</h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: "20px" }}>
            <div style={cardStyle}>
              <h3>📸 Fotos IA</h3>
              <h1>{totalFotos}</h1>
            </div>

            <div style={cardStyle}>
              <h3>🎨 Banners</h3>
              <h1>0</h1>
            </div>

            <div style={cardStyle}>
              <h3>🎬 Vídeos</h3>
              <h1>0</h1>
            </div>
          </div>

          <h2 style={{ marginTop: "50px" }}>🖼 Últimas Imagens</h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: "20px" }}>
            {ultimasImagens.map((item) => (
              <div key={item.created_at} style={cardStyle}>
                <img
                  src={item.imagem_processada}
                  style={{
                    width: "100%",
                    height: "220px",
                    objectFit: "contain",
                    background: "white",
                    borderRadius: "10px",
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {screen === "foto" && (
        <div style={{ marginTop: "50px" }}>
          <h2>📸 Foto Premium IA</h2>

          <div style={{ ...cardStyle, maxWidth: "900px", margin: "30px auto" }}>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files[0];
                if (!file) return;

                setArquivo(file);
                setPreview(URL.createObjectURL(file));
                setUrlPublica("");
                setResultadoIA("");
              }}
            />

            {preview && (
              <div style={{ marginTop: "30px" }}>
                <h3>Original</h3>

                <img src={preview} style={{ maxWidth: "350px", borderRadius: "10px", background: "white" }} />

                <br />

                <button onClick={enviarImagem} style={{ marginTop: "20px", padding: "14px" }}>
                  Enviar
                </button>

                <button
                  onClick={processarIA}
                  disabled={processando}
                  style={{ marginLeft: "10px", padding: "14px" }}
                >
                  {processando ? "Processando..." : "✨ Processar IA"}
                </button>
              </div>
            )}

            {resultadoIA && (
              <div style={{ marginTop: "40px" }}>
                <h2 style={{ color: "#22c55e" }}>✅ Resultado IA</h2>
                <img src={resultadoIA} style={{ maxWidth: "450px", borderRadius: "10px", background: "white" }} />
              </div>
            )}
          </div>
        </div>
      )}

      {screen === "galeria" && (
        <div style={{ marginTop: "50px" }}>
          <h2>🖼 Galeria</h2>
          <p>Total: {galeria.length}</p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: "20px" }}>
            {galeria.map((item) => (
              <div key={item.created_at} style={cardStyle}>
                <img
                  src={item.imagem_processada}
                  style={{
                    width: "100%",
                    height: "230px",
                    objectFit: "contain",
                    background: "white",
                    borderRadius: "10px",
                  }}
                />

                <p style={{ color: "#93c5fd", fontSize: "12px" }}>
                  {new Date(item.created_at).toLocaleString("pt-BR")}
                </p>

                <button onClick={() => baixarImagem(item.imagem_processada)}>
                  ⬇️ Baixar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {screen === "admin" && (
        <div style={{ marginTop: "50px" }}>
          <h2>Painel Administrativo</h2>
          <div style={cardStyle}>
            <h3>Processamentos do usuário</h3>
            <h1>{totalFotos}</h1>
          </div>
        </div>
      )}
    </div>
  );
}