import { useEffect, useState } from "react";
import { supabase, supabaseKey } from "./supabase";
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
const [imagemBanner, setImagemBanner] = useState(null);
const [categoriaBanner, setCategoriaBanner] = useState("autopecas");
const [estiloBanner, setEstiloBanner] = useState("premium");
const [tamanhoBanner, setTamanhoBanner] = useState("1200x1200");
const [fundoBanner, setFundoBanner] = useState("automatico");
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

      console.log("GALERIA:", data);
console.log("ERRO GALERIA:", error);

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
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({ imageUrl: urlPublica }),
  }
);
    const dados = await resposta.json();

    console.log("RESPOSTA IA:", dados);
    console.log("URL RETORNADA:", dados.imagem_processada);

if (!dados.imagem_processada) {
  console.log("ERRO COMPLETO:", dados);
  setStatusProcesso("❌ " + (dados.erro || "A IA não retornou uma imagem."));
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
      console.log("ERRO AO SALVAR GALERIA:", error);
      setStatusProcesso("❌ Processou, mas não salvou na galeria.");
      setProcessando(false);
      return;
    }

    await carregarGaleria();
    await carregarDashboard();

    setStatusProcesso("✅ Imagem processada e salva!");
  } catch (erro) {
    console.log("ERRO PROCESSAR IA:", erro);
    setStatusProcesso("❌ Erro ao processar imagem.");
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

  if (!imagemBanner) {
    alert("Escolha uma imagem da galeria.");
    return;
  }

  setProcessando(true);
  setStatusProcesso("🎨 Gerando banner com IA...");

  try {
    const imagemEnviada = imagemBanner;

    const resposta = await fetch(
      "https://arqzpqkkpwikyecdbopf.supabase.co/functions/v1/processar-imagem",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
   body: JSON.stringify({
  imageUrl: imagemEnviada,
  tipo: "banner",
  modelo: bannerModelo,
  categoria: categoriaBanner,
  estilo: estiloBanner,
  tamanho: tamanhoBanner,
  fundo: fundoBanner,
}),
      }
    );

    const dados = await resposta.json();

    console.log("RESPOSTA BANNER IA:", dados);

    if (!dados.imagem_processada) {
      console.log("ERRO BANNER COMPLETO:", dados);
      alert(dados.erro || JSON.stringify(dados));
      setProcessando(false);
      return;
    }

    setResultadoIA(dados.imagem_processada);

    const { error: erroSalvar } = await supabase
      .from("processamentos")
      .insert([
        {
          user_id: usuario.id,
          imagem_original: imagemEnviada,
          imagem_processada: dados.imagem_processada,
          status: "finalizado",
          tipo: "banner",
          modelo_banner: bannerModelo,
        },
      ]);

    if (erroSalvar) {
      console.log("ERRO AO SALVAR BANNER:", erroSalvar);
      alert("Banner processou, mas não salvou na galeria.");
      setProcessando(false);
      return;
    }

    await carregarDashboard();
    await carregarGaleria();

    setStatusProcesso("✅ Banner gerado e salvo!");
    setProcessando(false);
  } catch (erro) {
    console.log("ERRO AO GERAR BANNER:", erro);
    alert(erro?.message || JSON.stringify(erro) || "Erro ao gerar banner.");
    setProcessando(false);
  }
}

console.log(
  projetosAndamento,
  projetosConcluidos,
  projetosPausados
);

const dadosProjetos = [
  { name: "Em andamento", value: projetosAndamento },
  { name: "Concluídos", value: projetosConcluidos },
  { name: "Pausados", value: projetosPausados },
];

const COLORS = ["#3b82f6", "#22c55e", "#f59e0b"];

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
  src={item.imagem_processada || item.imagem_original}
  alt=""
  onError={(e) => {
    e.currentTarget.style.display = "none";
  }}
  style={{
    width: "100%",
    height: "230px",
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
    {item.imagem && (
      <img
        src={item.imagem}
        alt=""
        style={{
          width: "100%",
          height: "160px",
          objectFit: "cover",
          borderRadius: "10px",
          marginBottom: "12px",
        }}
      />
    )}

    <h3>{item.nome}</h3>

    <p style={{ color: "#93c5fd" }}>
      {item.descricao}
    </p>

    <p
      style={{
        color: "#64748b",
        fontSize: "12px",
        marginTop: "8px",
      }}
    >
      📅 {new Date(item.created_at).toLocaleDateString("pt-BR")}
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

    <h3 style={{ color: "white", marginBottom: "10px" }}>
      Escolha uma imagem da galeria
    </h3>

    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))",
        gap: "10px",
        marginBottom: "20px",
      }}
    >
      {galeria
        .filter((item) => item.tipo === "foto")
        .map((item) => (
          <img
            key={item.id}
            src={item.imagem_processada}
            alt=""
            onClick={() => setImagemBanner(item.imagem_processada)}
            style={{
              width: "100%",
              height: "120px",
              objectFit: "contain",
              background: "#fff",
              cursor: "pointer",
              border:
                imagemBanner === item.imagem_processada
                  ? "3px solid #22c55e"
                  : "2px solid #333",
              borderRadius: "10px",
            }}
          />
        ))}
    </div>

    <select
      value={bannerModelo}
      onChange={(e) => setBannerModelo(e.target.value)}
      style={{ padding: "12px", marginBottom: "20px" }}
    >
      <option value="mercadolivre">Mercado Livre</option>
      <option value="shopee">Shopee</option>
      <option value="instagram">Instagram</option>
      <option value="whatsapp">WhatsApp</option>
    </select>.
    <select value={categoriaBanner} onChange={(e) => setCategoriaBanner(e.target.value)} style={{ padding: "12px", margin: "10px" }}>
  <option value="autopecas">🚗 Autopeças</option>
  <option value="moda">👕 Moda / Roupas</option>
  <option value="papelaria">📚 Papelaria</option>
  <option value="doceria">🍰 Doceria</option>
  <option value="cosmeticos">💄 Cosméticos</option>
  <option value="petshop">🐶 Pet Shop</option>
  <option value="eletronicos">📱 Eletrônicos</option>
  <option value="ferramentas">🔧 Ferramentas</option>
</select>

<select value={estiloBanner} onChange={(e) => setEstiloBanner(e.target.value)} style={{ padding: "12px", margin: "10px" }}>
  <option value="premium">Premium</option>
  <option value="luxo">Luxo</option>
  <option value="moderno">Moderno</option>
  <option value="promocao">Promoção</option>
  <option value="minimalista">Minimalista</option>
  <option value="marketplace">Marketplace</option>
</select>

<select value={tamanhoBanner} onChange={(e) => setTamanhoBanner(e.target.value)} style={{ padding: "12px", margin: "10px" }}>
  <option value="400x400">400x400</option>
  <option value="600x600">600x600</option>
  <option value="800x400">800x400</option>
  <option value="800x800">800x800</option>
  <option value="1080x1080">1080x1080</option>
  <option value="1200x1200">1200x1200</option>
  <option value="1200x1800">1200x1800</option>
  <option value="1080x1920">1080x1920 Story</option>
  <option value="1920x1080">1920x1080 Site</option>
</select>

<select value={fundoBanner} onChange={(e) => setFundoBanner(e.target.value)} style={{ padding: "12px", margin: "10px" }}>
  <option value="automatico">Automático IA</option>
  <option value="branco">Branco</option>
  <option value="transparente">Transparente</option>
  <option value="azul_degrade">Azul degradê</option>
  <option value="escuro_premium">Escuro premium</option>
  <option value="colorido">Colorido</option>
</select>

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

    {resultadoIA && (
      <img
        src={resultadoIA}
        alt=""
        style={{
          width: "100%",
          maxWidth: "600px",
          marginTop: "20px",
          borderRadius: "12px",
          background: "white",
        }}
      />
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

    <p style={{ color: "#93c5fd" }}>
      Total de imagens: {galeria.length}
    </p>

    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
        gap: "20px",
      }}
    >
      {galeria.map((item) => (
        <div key={item.id || item.created_at} style={cardStyle}>
          
       <>
  <a
    href={item.imagem_processada}
    target="_blank"
    rel="noreferrer"
    style={{ color: "yellow" }}
  >
    Abrir imagem
  </a>

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
</>

          <button
            onClick={() => baixarImagem(item.imagem_processada || item.imagem_original)}
            style={{ ...buttonGreen, marginTop: "12px" }}
          >
            ⬇️ Baixar
          </button>
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