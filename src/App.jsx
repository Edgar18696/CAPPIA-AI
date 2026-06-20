import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import logoAppia from "./assets/logo-appia-ai.png";


export default function App() {
  const [screen, setScreen] = useState("home");
  const [usuario, setUsuario] = useState(null);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
const [filtroGaleria, setFiltroGaleria] = useState("todos");
const [totalBanners, setTotalBanners] = useState(0);
const [totalVideos, setTotalVideos] = useState(0);
  const [totalFotos, setTotalFotos] = useState(0);
  const [editandoProjeto, setEditandoProjeto] = useState(null);
const [novoStatus, setNovoStatus] = useState("");
  const [ultimosBanners, setUltimosBanners] = useState([]);
  const [ultimasImagens, setUltimasImagens] = useState([]);
  const [galeria, setGaleria] = useState([]);
const [bannerModelo, setBannerModelo] = useState("mercadolivre");
  const [arquivo, setArquivo] = useState(null);
  const [preview, setPreview] = useState("");
  const [urlPublica, setUrlPublica] = useState("");
  const [resultadoIA, setResultadoIA] = useState("");
  const [processando, setProcessando] = useState(false);
  const [statusProcesso, setStatusProcesso] = useState("");
  const [projetos, setProjetos] = useState([]);
const [nomeProjeto, setNomeProjeto] = useState("");
const [descricaoProjeto, setDescricaoProjeto] = useState("");
const [imagemProjeto, setImagemProjeto] = useState("");
const [arquivoProjeto, setArquivoProjeto] = useState(null);
const [statusProjeto, setStatusProjeto] = useState("Em andamento");
const [totalProjetos, setTotalProjetos] = useState(0);
const [projetosAndamento, setProjetosAndamento] = useState(0);
const [projetosConcluidos, setProjetosConcluidos] = useState(0);
const [projetosPausados, setProjetosPausados] = useState(0);
const [buscaProjeto, setBuscaProjeto] = useState("");
const [ultimosProjetos, setUltimosProjetos] = useState([]);
  useEffect(() => {
    verificarUsuario();
  }, []);

useEffect(() => {
  if (usuario) {
    carregarDashboard();
    carregarGaleria();
    carregarProjetos();
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
    setScreen("home");
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

  const { count: countFotos } = await supabase
    .from("processamentos")
    .select("*", { count: "exact", head: true })
    .eq("user_id", usuario.id)
    .eq("tipo", "foto");

  setTotalFotos(countFotos || 0);

  const { count: countBanners } = await supabase
    .from("processamentos")
    .select("*", { count: "exact", head: true })
    .eq("user_id", usuario.id)
    .eq("tipo", "banner");

  setTotalBanners(countBanners || 0);

  const { count: countVideos } = await supabase
    .from("processamentos")
    .select("*", { count: "exact", head: true })
    .eq("user_id", usuario.id)
    .eq("tipo", "video");

  setTotalVideos(countVideos || 0);

  const { data: fotosRecentes } = await supabase
    .from("processamentos")
    .select("*")
    .eq("user_id", usuario.id)
    .eq("tipo", "foto")
    .not("imagem_processada", "is", null)
    .order("created_at", { ascending: false })
    .limit(6);

  setUltimasImagens(fotosRecentes || []);

  const { data: bannersRecentes } = await supabase
    .from("processamentos")
    .select("*")
    .eq("user_id", usuario.id)
    .eq("tipo", "banner")
    .not("imagem_processada", "is", null)
    .order("created_at", { ascending: false })
    .limit(4);

  setUltimosBanners(bannersRecentes || []);
}

async function carregarProjetos() {
  if (!usuario) return;

  const { data, count, error } = await supabase
    .from("projetos")
    .select("*", { count: "exact" })
    .eq("user_id", usuario.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.log("ERRO CARREGAR PROJETOS:", error);
    return;
  }

  const lista = data || [];

  setProjetos(lista);
  setTotalProjetos(count || 0);
  setUltimosProjetos(lista.slice(0, 5));

  setProjetosAndamento(
    lista.filter((p) =>
      (p.status || "").trim().toLowerCase() === "em andamento"
    ).length
  );

  setProjetosConcluidos(
    lista.filter((p) =>
      (p.status || "").trim().toLowerCase() === "concluído" ||
      (p.status || "").trim().toLowerCase() === "concluido"
    ).length
  );

  setProjetosPausados(
    lista.filter((p) =>
      (p.status || "").trim().toLowerCase() === "pausado"
    ).length
  );
}
async function atualizarProjeto() {
  if (!editandoProjeto) {
    alert("Nenhum projeto selecionado");
    return;
  }

  const { error } = await supabase
    .from("projetos")
    .update({
      nome: nomeProjeto,
      descricao: descricaoProjeto,
      status: novoStatus || statusProjeto,
    })
    .eq("id", editandoProjeto);

  if (error) {
    alert(error.message);
    return;
  }

  setEditandoProjeto(null);
  setNomeProjeto("");
  setDescricaoProjeto("");
  setImagemProjeto("");
  setArquivoProjeto(null);
  setStatusProjeto("Em andamento");
  setNovoStatus("");

  await carregarProjetos();
  await carregarDashboard();

  alert("Projeto atualizado!");
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
    return null;
  }

  if (!arquivo) {
    alert("Escolha uma imagem primeiro");
    return null;
  }

  setStatusProcesso("⬆️ Enviando imagem...");

  const nomeArquivo = `${usuario.id}/${Date.now()}-${arquivo.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9.]/g, "-")}`;

  const { error } = await supabase.storage
    .from("imagens")
    .upload(nomeArquivo, arquivo, { upsert: true });

  if (error) {
    alert(error.message);
    return null;
  }

  const { data } = supabase.storage
    .from("imagens")
    .getPublicUrl(nomeArquivo);

  setUrlPublica(data.publicUrl);
  setStatusProcesso("✅ Imagem enviada.");

  return data.publicUrl;
}

  async function processarIA() {
    if (!usuario) {
      alert("Faça login primeiro");
      setScreen("login");
      return;
    }

    if (!urlPublica) {
      alert("Envie a imagem primeiro");
      return;
    }

    setProcessando(true);
    setStatusProcesso("🤖 Processando imagem com IA...");

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
        console.log(dados);
        setStatusProcesso("❌ A IA não retornou uma imagem.");
        setProcessando(false);
        return;
      }

      setResultadoIA(dados.imagem_processada);
      setStatusProcesso("💾 Salvando resultado na galeria...");

      const { error } = await supabase.from("processamentos").insert([
  {
    imagem_original: urlPublica,
    imagem_processada: dados.imagem_processada,
    status: "processado",
    user_id: usuario.id,
    tipo: "foto",
  },
]);

      if (error) {
        alert(error.message);
      } else {
        await carregarDashboard();
        await carregarGaleria();
        setStatusProcesso("✅ Concluído! Imagem processada e salva na galeria.");
      }
    } catch (erro) {
      console.log(erro);
      setStatusProcesso("❌ Erro ao processar imagem.");
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

  async function excluirImagem(item) {
    const confirmar = confirm("Deseja excluir esta imagem da galeria?");
    if (!confirmar) return;

    const { error } = await supabase
      .from("processamentos")
      .delete()
      .eq("created_at", item.created_at)
      .eq("user_id", usuario.id);

    if (error) {
      alert(error.message);
      return;
    }

    await carregarDashboard();
    await carregarGaleria();
  }

  function limparTelaFoto() {
    setArquivo(null);
    setPreview("");
    setUrlPublica("");
    setResultadoIA("");
    setStatusProcesso("");
  }

  const cardStyle = {
    background: "#0f172a",
    padding: "20px",
    borderRadius: "16px",
    border: "1px solid #2563eb",
  };

  const buttonBlue = {
    padding: "12px 18px",
    background: "#2563eb",
    color: "white",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    fontWeight: "bold",
  };

  const buttonGreen = {
    padding: "12px 18px",
    background: "#22c55e",
    color: "white",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    fontWeight: "bold",
  };

  const buttonRed = {
    padding: "12px 18px",
    background: "#dc2626",
    color: "white",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    fontWeight: "bold",
  };
async function processarBannerIA() {
  if (!usuario) {
    alert("Faça login primeiro");
    setScreen("login");
    return;
  }

  if (!arquivo) {
    alert("Escolha uma imagem primeiro");
    return;
  }

  setProcessando(true);
  setStatusProcesso("🎨 Gerando banner com IA...");

  try {
    const imagemEnviada = await enviarImagem();

    if (!imagemEnviada) {
      setProcessando(false);
      return;
    }

    const resposta = await fetch(
      "https://arqzpqkkpwikyecdbopf.supabase.co/functions/v1/processar-imagem",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: imagemEnviada,
          tipo: "banner",
          modelo: bannerModelo,
        }),
      }
    );

    const dados = await resposta.json();

    console.log("RESPOSTA BANNER IA:", dados);

    if (!dados.imagem_processada) {
      alert("A IA não retornou o banner.");
      setProcessando(false);
      return;
    }

    setResultadoIA(dados.imagem_processada);

    await supabase.from("processamentos").insert([
      {
        imagem_original: imagemEnviada,
        imagem_processada: dados.imagem_processada,
        status: "processado",
        user_id: usuario.id,
        tipo: "banner",
        modelo_banner: bannerModelo,
      },
    ]);

    await carregarDashboard();
    await carregarGaleria();

    setStatusProcesso("✅ Banner gerado e salvo!");
  } catch (erro) {
    console.log(erro);
    alert("Erro ao gerar banner.");
  }

  setProcessando(false);
}
console.log(
  projetosAndamento,
  projetosConcluidos,
  projetosPausados
);
const dadosProjetos = [
  {
    name: "Em andamento",
    value: projetosAndamento,
  },
  {
    name: "Concluídos",
    value: projetosConcluidos,
  },
  {
    name: "Pausados",
    value: projetosPausados,
  },
];
const COLORS = [
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
];
async function criarProjeto() {
  console.log("NOME:", nomeProjeto);
console.log("DESCRIÇÃO:", descricaoProjeto);
  if (!usuario) {
    alert("Faça login primeiro");
    setScreen("login");
    return;
  }

  if (!nomeProjeto.trim()) {
    alert("Digite o nome do projeto");
    return;
  }

  const imagemUrl = await enviarImagemProjeto();

  if (imagemUrl === null) return;

  const { error } = await supabase.from("projetos").insert([
    {
      user_id: usuario.id,
      nome: nomeProjeto,
      descricao: descricaoProjeto,
imagem: imagemUrl,
      status: statusProjeto,
    },
  ]);

  if (error) {
    alert(error.message);
    return;
  }

  setNomeProjeto("");
  setDescricaoProjeto("");
  setArquivoProjeto(null);
  setStatusProjeto("Em andamento");
  setNovoStatus("");
  setEditandoProjeto(null);

  await carregarProjetos();
  await carregarDashboard();

  alert("Projeto criado com sucesso!");
}

async function atualizarProjeto() {
  if (!editandoProjeto) {
    alert("Nenhum projeto selecionado");
    return;
  }

  const { error } = await supabase
    .from("projetos")
    .update({
      nome: nomeProjeto,
      descricao: descricaoProjeto,
      status: novoStatus || statusProjeto,
    })
    .eq("id", editandoProjeto);

  if (error) {
    alert(error.message);
    return;
  }

  setEditandoProjeto(null);
  setNomeProjeto("");
  setDescricaoProjeto("");
  setArquivoProjeto(null);
  setStatusProjeto("Em andamento");
  setNovoStatus("");

  await carregarProjetos();
  await carregarDashboard();

  alert("Projeto atualizado!");
}

async function excluirProjeto(id) {
  const confirmar = window.confirm("Deseja realmente excluir este projeto?");

  if (!confirmar) return;

  const { error } = await supabase
    .from("projetos")
    .delete()
    .eq("id", id);

  if (error) {
    alert(error.message);
    return;
  }

  await carregarProjetos();
  await carregarDashboard();

  alert("Projeto excluído!");
}
async function enviarImagemProjeto() {
  if (!arquivoProjeto) return null;

  const nomeArquivo =
    `${usuario.id}/projetos/${Date.now()}-${arquivoProjeto.name}`;

  const { error } = await supabase.storage
    .from("imagens")
    .upload(nomeArquivo, arquivoProjeto, {
      upsert: true,
    });

  if (error) {
    alert(error.message);
    return null;
  }

  const { data } = supabase.storage
    .from("imagens")
    .getPublicUrl(nomeArquivo);

  return data.publicUrl;
}
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#020617",
        color: "white",
padding: "20px 40px",
        textAlign: "center",
        fontFamily: "Arial",
      }}
    >
    
<img
  src={logoAppia}
  alt="APPIA AI"
  style={{
    width: "320px",
    marginTop: "10px",
    marginBottom: "-40px",
  }}
/>
<p
  style={{
    color: "#93c5fd",
    fontSize: "22px",
    marginBottom: "20px",
    fontWeight: "500",
  }}
>
  Criação inteligente de imagens, banners e conteúdo digital
</p>

<p
  style={{
    color: "#93c5fd",
    fontSize: "18px",
    marginBottom: "15px",
  }}
>
</p>
      

      <div
  style={{
    display: "flex",
    justifyContent: "center",
    gap: "12px",
    flexWrap: "wrap",
  }}
>
  <button onClick={() => setScreen("home")}>🏠 Home</button>
  <button onClick={() => setScreen("foto")}>📸 Fotos IA</button>
  <button onClick={() => setScreen("banner")}>🎨 Banner IA</button>
  <button onClick={() => setScreen("galeria")}>🖼 Galeria</button>

  <button
    onClick={() => setScreen("projetos")}
    style={{
      background: "#2563eb",
      color: "white",
      fontWeight: "bold",
      padding: "10px 18px",
      borderRadius: "8px",
      border: "none",
      cursor: "pointer",
    }}
  >
    📦 Projetos
  </button>

  <button onClick={() => setScreen("admin")}>⚙️ Administrador</button>

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
    <h1
  style={{
    fontSize: "42px",
    fontWeight: "bold",
    color: "#38bdf8",
    textAlign: "center",
    marginBottom: "10px",
    textShadow: "0 0 20px rgba(56,189,248,0.4)",
  }}
>
  🚀 APPIA AI 
  </h1>
<p
  style={{
    color: "#94a3b8",
    textAlign: "center",
    fontSize: "22px",
    marginBottom: "40px",
  }}
>
  Plataforma Inteligente para Fotos, Banners e Videos
</p>

    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4,1fr)",
        gap: "20px",
      }}
    >
      <div style={cardStyle}>
        <h3>📸 Fotos IA</h3>
        <h1>{totalFotos}</h1>
      </div>

      <div style={cardStyle}>
        <h3>🎨 Banners</h3>
        <h1>{totalBanners}</h1>
      </div>

      <div style={cardStyle}>
        <h3>📦 Projetos</h3>
        <h1>{totalProjetos}</h1>
      </div>

      <div style={cardStyle}>
        <h3>🎬 Vídeos</h3>
        <h1>{totalVideos}</h1>
      </div>
    </div>
    <div
  style={{
    marginTop: "30px",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
    gap: "20px",
  }}
>
  <div style={cardStyle}>
    <h3>🔵 Em andamento</h3>
    <h1>{projetosAndamento}</h1>
  </div>

  <div style={cardStyle}>
    <h3>🟢 Concluídos</h3>
    <h1>{projetosConcluidos}</h1>
  </div>

  <div style={cardStyle}>
    <h3>🟡 Pausados</h3>
    <h1>{projetosPausados}</h1>
  </div>
</div>
<div
  style={{
    marginTop: "40px",
    ...cardStyle,
  }}
>
  <h2>📊 Status dos Projetos</h2>

  <div
    style={{
      width: "100%",
      height: "300px",
    }}
  >
    <ResponsiveContainer>
      <PieChart>
        <Pie
          data={dadosProjetos}
          cx="50%"
          cy="50%"
          outerRadius={100}
          dataKey="value"
          label
        >
          {dadosProjetos.map((entry, index) => (
            <Cell key={index} fill={COLORS[index]} />
          ))}
        </Pie>

        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  </div>
</div>
    <h2 style={{ marginTop: "50px" }}>🖼 Últimas Imagens</h2>

    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
        gap: "20px",
      }}
    >
      {ultimasImagens.map((item) => (
        <div key={item.created_at} style={cardStyle}>
          <img
            src={item.imagem_processada}
            alt=""
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

<h2 style={{ marginTop: "40px" }}>🎨 Últimos Banners</h2>

<div
  style={{
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
    gap: "20px",
  }}
>
{ultimosBanners.map((item) => (
  <div key={item.created_at} style={cardStyle}>
    <img
      src={item.imagem_processada}
      alt=""
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

<h2 style={{ marginTop: "40px" }}>
  📦 Últimos Projetos
</h2>

<div
  style={{
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))",
    gap: "20px",
    marginTop: "20px",
  }}
>
  {ultimosProjetos.map((item) => (
    <div key={item.id} style={cardStyle}>
      <h3>{item.nome}</h3>

      <p style={{ color: "#93c5fd" }}>
        {item.descricao}
      </p>

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
    </div>
  ))}
</div>
</div>
)}

{screen === "banner" && (
  <div style={{ marginTop: "50px" }}>
    <h2>🎨 Banner IA</h2>

    <select
      value={bannerModelo}
      onChange={(e) => setBannerModelo(e.target.value)}
      style={{ padding: "12px", marginBottom: "20px" }}
    >
      <option value="mercadolivre">Mercado Livre</option>
      <option value="shopee">Shopee</option>
      <option value="instagram">Instagram</option>
      <option value="whatsapp">WhatsApp</option>
    </select>

    <br />

    <input
      type="file"
      accept="image/*"
      onChange={(e) => {
        const file = e.target.files[0];
        if (!file) return;

        setArquivo(file);
        setPreview(URL.createObjectURL(file));
      }}
    />

    {preview && (
      <div style={{ marginTop: "20px" }}>
        <img
          src={preview}
          alt=""
          style={{
            maxWidth: "350px",
            borderRadius: "10px",
            background: "white",
          }}
        />

        <br />

        <button
          onClick={processarBannerIA}
          disabled={processando}
          style={{
            marginTop: "20px",
            padding: "12px 20px",
          }}
        >
          {processando ? "⏳ Gerando..." : "🎨 Gerar Banner"}
        </button>
      </div>
    )}
  </div>
)}

{screen === "foto" && (
  <div style={{ marginTop: "50px" }}>
    <h2>📸 Foto Premium IA</h2>

    <div style={{ ...cardStyle, maxWidth: "950px", margin: "30px auto" }}>
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
          setStatusProcesso("");
        }}
      />

      {statusProcesso && (
        <div
          style={{
            marginTop: "25px",
            padding: "15px",
            background: "#020617",
            border: "1px solid #38bdf8",
            borderRadius: "12px",
            color: "#bfdbfe",
            fontWeight: "bold",
          }}
        >
          {statusProcesso}
        </div>
      )}

      {preview && (
        <div style={{ marginTop: "30px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "30px",
              flexWrap: "wrap",
              alignItems: "flex-start",
            }}
          >
            <div>
              <h3 style={{ color: "#38bdf8" }}>📸 Original</h3>

              <img
                src={preview}
                alt=""
                style={{
                  width: "400px",
                  borderRadius: "10px",
                  background: "white",
                }}
              />
            </div>

            {resultadoIA && (
              <div>
                <h3 style={{ color: "#22c55e" }}>✅ Resultado IA</h3>

                <img
                  src={resultadoIA}
                  alt=""
                  style={{
                    width: "400px",
                    borderRadius: "10px",
                    background: "white",
                  }}
                />
              </div>
            )}
          </div>

          <div
            style={{
              marginTop: "25px",
              display: "flex",
              justifyContent: "center",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <button onClick={enviarImagem} disabled={processando} style={buttonBlue}>
              ⬆️ Enviar
            </button>

            <button onClick={processarIA} disabled={processando} style={buttonGreen}>
              {processando ? "⏳ Processando..." : "✨ Processar IA"}
            </button>

            <button onClick={limparTelaFoto} disabled={processando} style={buttonRed}>
              🧹 Limpar
            </button>

            {resultadoIA && (
              <button onClick={() => baixarImagem(resultadoIA)} style={buttonGreen}>
                ⬇️ Baixar Resultado
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  </div>
)}

{screen === "galeria" && (
  <div style={{ marginTop: "50px" }}>
    <h2>🖼 Galeria</h2>
    <p>Total: {galeria.length}</p>

    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
        gap: "20px",
      }}
    >
      {galeria.map((item) => (
        <div key={item.created_at} style={cardStyle}>
          <img
            src={item.imagem_processada}
            alt=""
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

          <div
            style={{
              display: "flex",
              gap: "8px",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <a
              href={item.imagem_processada}
              target="_blank"
              rel="noreferrer"
              style={{
                ...buttonBlue,
                textDecoration: "none",
                display: "inline-block",
              }}
            >
              🔎 Abrir
            </a>

            <button onClick={() => baixarImagem(item.imagem_processada)} style={buttonGreen}>
              ⬇️ Baixar
            </button>

            <button onClick={() => excluirImagem(item)} style={buttonRed}>
              🗑️ Excluir
            </button>
          </div>
        </div>
      ))}
    </div>
  </div>
)}
{screen === "projetos" && (
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
  value={
    editandoProjeto
      ? novoStatus
      : statusProjeto
  }
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

      <input
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files[0];
          if (!file) return;
          setArquivoProjeto(file);
        }}
        style={{
          width: "90%",
          padding: "12px",
          marginBottom: "15px",
        }}
      />

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
            height: "220px",
            objectFit: "cover",
            borderRadius: "10px",
            marginBottom: "15px",
          }}
        />
      )}

      <h3>{item.nome}</h3>

      <p style={{ color: "#93c5fd" }}>
        {item.descricao}
      </p>

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

            <button
        onClick={() => excluirProjeto(item.id)}
        style={buttonRed}
      >
        🗑️ Excluir
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