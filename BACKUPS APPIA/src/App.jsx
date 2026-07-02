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
  const [selecionadas, setSelecionadas] = useState([]);
const [bannerModelo, setBannerModelo] = useState("mercadolivre");
const [modeloPremiumBanner, setModeloPremiumBanner] = useState("premium");
  const [arquivo, setArquivo] = useState(null);
  const [preview, setPreview] = useState("");
  const [urlPublica, setUrlPublica] = useState("");
  const [resultadoIA, setResultadoIA] = useState("");
  const [processando, setProcessando] = useState(false);
  const [notificacao, setNotificacao] = useState("");
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
const [arquivosFotos, setArquivosFotos] = useState([]);
const [tipoFundoFoto, setTipoFundoFoto] = useState("branco");
const [tamanhoFoto, setTamanhoFoto] = useState("1200x1200");
const [paginaAtual, setPaginaAtual] = useState(1);
const itensPorPagina = 12;
const [buscaGaleria, setBuscaGaleria] = useState("");
const [totalFotosIA, setTotalFotosIA] = useState(0);
const [totalBannersIA, setTotalBannersIA] = useState(0);
const [totalProcessamentos, setTotalProcessamentos] = useState(0);
const [imagensSelecionadas, setImagensSelecionadas] = useState([]);
const [baixandoLote, setBaixandoLote] = useState(false);
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

    mostrarNotificacao("✅ Cadastro criado! Verifique seu e-mail");
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
.order("criado_em", { ascending: false });
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
    .eq("tipo", "foto")
    .not("imagem_processada", "is", null)
    .order("created_at", { ascending: false });

  console.log("GALERIA:", data);
  console.log("TOTAL GALERIA:", data?.length);
  console.log("ERRO GALERIA:", error);

  if (error) {
    console.log(error);
    return;
  }

  setGaleria(data || []);
  const lista = data || [];

setTotalFotosIA(
  lista.filter((item) => item.tipo === "foto").length
);

setTotalBannersIA(
  lista.filter((item) => item.tipo === "banner").length
);

setTotalProcessamentos(lista.length);
}

async function processarSelecionadas() {
  const selecionadas = arquivosFotos.filter((foto) => foto.selecionada);

  if (selecionadas.length === 0) {
   mostrarNotificacao("🖼️ Selecione pelo menos uma foto");
    return;
  }

  setProcessando(true);
  setStatusProcesso(`⏳ Processando ${selecionadas.length} fotos...`);

  for (let i = 0; i < selecionadas.length; i++) {
    const foto = selecionadas[i];

    try {
      setStatusProcesso(`⏳ Processando foto ${i + 1} de ${selecionadas.length}...`);

      const urlEnviada = await enviarImagem(foto.file);

      if (!urlEnviada) {
        throw new Error("Falha ao enviar imagem.");
      }

      await processarIA(urlEnviada);
    } catch (erro) {
      console.log(`ERRO FOTO ${i + 1}:`, erro);
      setStatusProcesso("❌ " + (erro?.message || `Erro ao processar foto ${i + 1}`));
      setProcessando(false);
      return;
    }
  }

  await carregarGaleria();
  await carregarDashboard();

  setProcessando(false);
  setStatusProcesso(`✅ ${selecionadas.length} fotos processadas com sucesso! Confira na Galeria.`);

  setTimeout(() => {
    setScreen("galeria");
  }, 1500);
}

async function processarIA(urlImagem = urlPublica) {
  if (!usuario) {
mostrarNotificacao("🔐 Faça login primeiro");
    return;
  }

  if (!urlImagem) {
mostrarNotificacao("📸 Envie uma imagem primeiro");
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
        body: JSON.stringify({
          imageUrl: urlImagem,
          tipo: "foto",
          fundo: tipoFundoFoto,
        }),
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
    imagem_original: urlImagem,
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
  const modelosPremiumBanner = [
  { id: "premium", nome: "⭐ Premium" },
  { id: "clean", nome: "✨ Clean" },
  { id: "luxo", nome: "👑 Luxo" },
  { id: "moderno", nome: "🚀 Moderno" },
  { id: "oferta", nome: "🔥 Oferta" },
  { id: "instagram", nome: "📱 Instagram" },
  { id: "marketplace", nome: "🛒 Marketplace" },
  { id: "black", nome: "⚫ Black Edition" },
];
function alternarSelecionada(id) {
  setSelecionadas((atual) =>
    atual.includes(id)
      ? atual.filter((item) => item !== id)
      : [...atual, id]
  );
}
async function excluirSelecionadas() {
  if (selecionadas.length === 0) return;

  const confirmar = confirm(
    `Deseja excluir ${selecionadas.length} imagem(ns) selecionada(s)?`
  );

  if (!confirmar) return;

  const { error } = await supabase
    .from("processamentos")
    .delete()
.in("created_at", selecionadas)
  if (error) {
    alert("Erro ao excluir selecionadas: " + error.message);
    return;
  }

  setGaleria((atual) =>
    atual.filter((item) => !selecionadas.includes(item.id))
  );

  setSelecionadas([]);
  setTotalImagens((atual) => atual - selecionadas.length);
}
async function baixarSelecionadas() {
  if (selecionadas.length === 0) return;

  setBaixandoLote(true);

  const imagens = galeria.filter((item) =>
    selecionadas.includes(item.created_at)
  );

  for (const item of imagens) {
    const link = document.createElement("a");

    link.href =
      item.imagem_processada || item.imagem_original;

    link.download = `imagem-${item.created_at}.jpg`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    await new Promise((resolve) =>
      setTimeout(resolve, 500)
    );
  }

  setBaixandoLote(false);
}
async function excluirImagem(item) {
  if (!confirm("Deseja realmente excluir esta imagem?")) return;

  console.log("ITEM PARA EXCLUIR:", item);

  const { error } = await supabase
    .from("processamentos")
    .delete()
    .eq("created_at", item.created_at)
    .eq("user_id", usuario.id);

  if (error) {
    console.log("ERRO EXCLUIR:", error);
    alert(error.message);
    return;
  }

  await carregarGaleria();
  alert("Imagem excluída com sucesso.");
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
  modeloPremium: modeloPremiumBanner,
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
async function enviarImagem(arquivoSelecionado = arquivo) {
  if (!usuario) {
    alert("Faça login primeiro");
    setScreen("login");
    return null;
  }

  if (!arquivoSelecionado) {
mostrarNotificacao("📸 Escolha uma imagem primeiro");
  }

  setStatusProcesso("⬆️ Enviando imagem...");

  const nomeArquivo = `${usuario.id}/${Date.now()}-${arquivoSelecionado.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9.]/g, "-")}`;

  const { error } = await supabase.storage
    .from("imagens")
    .upload(nomeArquivo, arquivoSelecionado, { upsert: true });

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
function mostrarNotificacao(texto) {
  setNotificacao(texto);

  setTimeout(() => {
    setNotificacao("");
  }, 3000);
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
  <button onClick={() => setScreen("clipIA")}>🎬 Clip IA</button>

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
{notificacao && (
  <div
    style={{
      position: "fixed",
      top: "20px",
      right: "20px",
      background: "#22c55e",
      color: "white",
      padding: "15px 20px",
      borderRadius: "12px",
      zIndex: 9999,
      fontWeight: "bold",
      boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
    }}
  >
    {notificacao}
  </div>
)}

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
    <div style={cardStyle}>
  <h3>⚡ Processamentos</h3>
  <h1>{totalProcessamentos}</h1>
</div>
<div
  style={{
    marginTop: "35px",
    background: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: "16px",
    padding: "25px",
    textAlign: "left",
  }}
>
  <h2
    style={{
      color: "#38bdf8",
      marginBottom: "20px",
      textAlign: "center",
    }}
  >
    🕒 Últimos Processamentos
  </h2>
<div
  style={{
    marginTop: "30px",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))",
    gap: "20px",
  }}
>
  <div
    style={{
      background: "#0f172a",
      border: "1px solid #1e293b",
      borderRadius: "15px",
      padding: "20px",
    }}
  >
    <h3 style={{ color: "#38bdf8" }}>
      📸 Última Foto IA
    </h3>

    <p>
      {galeria.find((x) => x.tipo === "foto")
        ? new Date(
            galeria.find((x) => x.tipo === "foto").created_at
          ).toLocaleString("pt-BR")
        : "Nenhuma"}
    </p>
  </div>

  <div
    style={{
      background: "#0f172a",
      border: "1px solid #1e293b",
      borderRadius: "15px",
      padding: "20px",
    }}
  >
    <h3 style={{ color: "#38bdf8" }}>
      🎨 Último Banner
    </h3>

    <p>
      {galeria.find((x) => x.tipo === "banner")
        ? new Date(
            galeria.find((x) => x.tipo === "banner").created_at
          ).toLocaleString("pt-BR")
        : "Nenhum"}
    </p>
  </div>

  <div
    style={{
      background: "#0f172a",
      border: "1px solid #1e293b",
      borderRadius: "15px",
      padding: "20px",
    }}
  >
    <h3 style={{ color: "#38bdf8" }}>
      🤖 Status IA
    </h3>

    <p style={{ color: "#22c55e" }}>
      ✅ Online
    </p>
  </div>

  <div
    style={{
      background: "#0f172a",
      border: "1px solid #1e293b",
      borderRadius: "15px",
      padding: "20px",
    }}
  >
    <h3 style={{ color: "#38bdf8" }}>
      👤 Usuário
    </h3>

    <p>
      {usuario?.email || "Não identificado"}
    </p>
  </div>
</div>

  {galeria.slice(0, 5).map((item) => (
    <div
      key={item.created_at}
      style={{
        display: "grid",
        gridTemplateColumns: "80px 1fr 130px",
        gap: "15px",
        alignItems: "center",
        background: "#020617",
        border: "1px solid #1e293b",
        borderRadius: "12px",
        padding: "12px",
        marginBottom: "12px",
      }}
    >
      <img
        src={item.imagem_processada || item.imagem_original}
        alt=""
        style={{
          width: "70px",
          height: "70px",
          objectFit: "contain",
          background: "white",
          borderRadius: "8px",
        }}
      />

      <div>
        <strong>
          {item.tipo === "banner" ? "🎨 Banner IA" : "📸 Foto IA"}
        </strong>
        <p style={{ margin: "5px 0", color: "#94a3b8" }}>
          {new Date(item.created_at).toLocaleString("pt-BR")}
        </p>
      </div>

      <span
        style={{
          color: "#22c55e",
          fontWeight: "bold",
          textAlign: "right",
        }}
      >
        ✅ Processado
      </span>
    </div>
  ))}

  {galeria.length === 0 && (
    <p style={{ textAlign: "center", color: "#94a3b8" }}>
      Nenhum processamento encontrado.
    </p>
  )}
</div>

<div style={cardStyle}>
  <h3>🖼 Galeria</h3>
  <h1>{galeria.length}</h1>
</div>

<div style={cardStyle}>
  <h3>👤 Usuário</h3>
  <h1>{usuario ? "Online" : "Offline"}</h1>
</div>

<div style={cardStyle}>
  <h3>🤖 IA</h3>
  <h1>Ativa</h1>
</div>

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
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 280px))",
    gap: "15px",
    marginTop: "20px",
    justifyContent: "center",
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

<h3 style={{ marginTop: "25px", color: "#38bdf8" }}>
  Escolha o estilo premium
</h3>

<div
  style={{
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
    gap: "12px",
    marginTop: "15px",
    maxWidth: "900px",
    marginLeft: "auto",
    marginRight: "auto",
  }}
>
  {modelosPremiumBanner.map((modelo) => (
    <button
      key={modelo.id}
      onClick={() => setModeloPremiumBanner(modelo.id)}
      style={{
        background:
          modeloPremiumBanner === modelo.id ? "#2563eb" : "#0f172a",
        color: "white",
        border:
          modeloPremiumBanner === modelo.id
            ? "2px solid #38bdf8"
            : "1px solid #1e293b",
        padding: "18px",
        borderRadius: "14px",
        cursor: "pointer",
        fontWeight: "bold",
      }}
    >
      {modelo.nome}
    </button>
  ))}
</div>

<select value={fundoBanner} onChange={(e) => setFundoBanner(e.target.value)} style={{ padding: "12px", margin: "10px" }}>
  <option value="automatico">Automático IA</option>
  <option value="branco">Branco</option>
  <option value="transparente">Transparente</option>
  <option value="azul_degrade">Azul degradê</option>
  <option value="escuro_premium">Escuro premium</option>
  <option value="colorido">Colorido</option>
</select>
<select
  value={tipoFundoFoto}
  onChange={(e) => setTipoFundoFoto(e.target.value)}
>
  <option value="branco">Fundo Branco</option>
  <option value="transparente">Fundo Transparente</option>
</select>

<select
  value={tamanhoFoto}
  onChange={(e) => setTamanhoFoto(e.target.value)}
>
  <option value="1200x1200">1200x1200</option>
  <option value="1600x1600">1600x1600</option>
  <option value="2000x2000">2000x2000</option>
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
<button
  onClick={() => setResultadoIA(null)}
  style={{
    background: "#475569",
    color: "white",
    border: "none",
    padding: "10px 18px",
    borderRadius: "10px",
    cursor: "pointer",
    marginTop: "15px",
    fontWeight: "bold",
  }}
>
  🧹 Limpar resultado
</button>
{screen === "clipIA" && (
  <div style={{ marginTop: "50px" }}>
    <h2
  style={{
    marginBottom: "20px",
    color: "#38bdf8",
    textAlign: "center",
    fontSize: "36px",
    fontWeight: "bold",
  }}
>
  🎬 Clip IA
</h2>

    <p style={{ color: "#93c5fd" }}>
      Transforme fotos e banners em vídeos automáticos.
    </p>

    <div
      style={{
        background: "#0f172a",
        padding: "25px",
        borderRadius: "15px",
        marginTop: "20px",
      }}
    >
      <h3>🚀 Em desenvolvimento</h3>
      <div
  style={{
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
    gap: "15px",
    marginTop: "20px",
  }}
>
  <div style={{
    background:"#111827",
    padding:"15px",
    borderRadius:"10px"
  }}>
    🎞️ Story 1080x1920
  </div>

  <div style={{
    background:"#111827",
    padding:"15px",
    borderRadius:"10px"
  }}>
    📱 Reels Instagram
  </div>

  <div style={{
    background:"#111827",
    padding:"15px",
    borderRadius:"10px"
  }}>
    🛒 Marketplace
  </div>

  <div style={{
    background:"#111827",
    padding:"15px",
    borderRadius:"10px"
  }}>
    📦 Shopee
  </div>
</div>

      <ul
        style={{
          textAlign: "left",
          maxWidth: "600px",
          margin: "20px auto",
          lineHeight: "2",
          color: "white",
        }}
      >
        <li>✅ Zoom automático</li>
        <li>✅ Movimento suave</li>
        <li>✅ Story 1080x1920</li>
        <li>✅ Reels Instagram</li>
        <li>✅ Mercado Livre</li>
        <li>✅ Shopee</li>
        <li>✅ WhatsApp Status</li>
        <li>✅ Música opcional</li>
        <li>✅ Logo da loja</li>
      </ul>
      <div
  style={{
    background: "#0f172a",
    border: "1px solid #2563eb",
    borderRadius: "12px",
    padding: "20px",
    marginTop: "25px",
    textAlign: "left",
    maxWidth: "700px",
    marginLeft: "auto",
    marginRight: "auto",
  }}
>
  <h3 style={{ color: "#38bdf8" }}>
    🚀 Próxima Versão
  </h3>

  <p>• Upload direto da galeria</p>
  <p>• Efeito Zoom Cinemático</p>
  <p>• Movimento Inteligente</p>
  <p>• Música opcional</p>
  <p>• Logo da empresa</p>
  <p>• Exportação MP4 Full HD</p>
</div>

      <button
        disabled
        style={{
          background: "#2563eb",
          color: "white",
          border: "none",
          padding: "15px 25px",
          borderRadius: "10px",
          opacity: 0.6,
        }}
      >
        🎬 Gerar Clip IA (Em breve)
      </button>
    </div>
  </div>
)}

{screen === "foto" && (
  <div style={{ marginTop: "50px" }}>
<h2
  style={{
    color: "#67e8f9",
    fontSize: "32px",
    marginBottom: "10px",
  }}
>
  📸 Foto Premium IA
</h2>


<p
  style={{
    color: "#94a3b8",
    marginBottom: "25px",
  }}
>
  Transforme até 8 fotos em imagens profissionais para marketplace.
</p>
<h3 style={{ color: "white" }}>
  Escolha até 8 fotos
</h3>
    <div style={{ ...cardStyle, maxWidth: "950px", margin: "30px auto" }}>
     <input
  type="file"
  multiple
  accept="image/*"

  onChange={(e) => {

    const files = Array.from(e.target.files);

    console.log("TOTAL DE FOTOS:", files.length);

    if (files.length === 0) return;

    if (files.length > 8) {
      alert("Máximo de 8 fotos por vez.");
      return;
    }

    setArquivo(files[0]);
    setPreview(URL.createObjectURL(files[0]));

    setArquivosFotos(
      files.map((file) => ({
        file,
        preview: URL.createObjectURL(file),
        selecionada: true,
      }))
    );

    setUrlPublica("");
    setResultadoIA("");
    setStatusProcesso("");
  }}
/>

{arquivosFotos.map((foto, index) => (
  <div
    key={index}
    style={{
      background: "#0f172a",
      border: "1px solid #2563eb",
      borderRadius: "12px",
      padding: "10px",
      textAlign: "center",
      width: "320px",
    }}
  >
<img
  src={foto.preview}
  alt=""
  style={{
    width: "220px",
    height: "120px",
    objectFit: "contain",
    background: "white",
    borderRadius: "8px",
  }}
/>

<label
  style={{
    color: "white",
    display: "flex",
    justifyContent: "center",
    gap: "8px",
    marginTop: "10px",
    marginBottom: "10px",
  }}
>
  <input
    type="checkbox"
    checked={selecionadas.includes(item.created_at)}
    onChange={() => alternarSelecionada(item.created_at)}
  />
  Selecionar
</label>
  </div>
))}
<div style={{ marginTop: "20px", textAlign: "center" }}>
<select
  value={tipoFundoFoto}
  onChange={(e) => setTipoFundoFoto(e.target.value)}
  style={{
    padding: "12px",
    borderRadius: "10px",
    background: "#0f172a",
    color: "white",
    border: "1px solid #2563eb",
    marginTop: "15px",
  }}
>
  <option value="branco">
    🎨 Fundo Branco
  </option>

  <option value="transparente">
    ✨ Fundo Transparente
  </option>
</select>

<button
  style={{
    ...buttonGreen,
    marginLeft: "15px",
  }}
  onClick={processarSelecionadas}
>
  ✨ Processar Selecionadas
</button>
</div>
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

  <div
    style={{
      background: "#0f172a",
      border: "1px solid #2563eb",
      borderRadius: "12px",
      padding: "12px",
      width: "320px",
      margin: "15px auto",
      color: "#93c5fd",
      fontWeight: "bold",
    }}
  >
    ☑ Selecionadas: {imagensSelecionadas.length}
  </div>

  <input
    type="text"
    placeholder="🔍 Buscar imagem..."
    value={buscaGaleria}
    onChange={(e) => setBuscaGaleria(e.target.value)}
    style={{
      padding: "12px",
      width: "300px",
      borderRadius: "8px",
      marginBottom: "20px",
    }}
  />

  <div
    style={{
      display: "flex",
      gap: "15px",
      justifyContent: "center",
      flexWrap: "wrap",
      marginBottom: "20px",
    }}
  >
  <div style={cardStyle}>
    📸 Fotos: {galeria.filter((x) => x.tipo === "foto").length}
  </div>

  <div style={cardStyle}>
    🎨 Banners: {galeria.filter((x) => x.tipo === "banner").length}
  </div>

  <div style={cardStyle}>
    🎬 Clips: {galeria.filter((x) => x.tipo === "clip").length}
  </div>
</div>

   <p style={{ color: "#93c5fd" }}>
  Total de imagens: {
    galeria.filter((item) =>
      filtroGaleria === "todos"
        ? true
        : item.tipo === filtroGaleria
    ).length
  }
</p>
<div style={{ marginBottom: "15px" }}>
  <button
    onClick={() =>
      setSelecionadas(
        galeria
          .filter((item) =>
            filtroGaleria === "todos"
              ? true
              : item.tipo === filtroGaleria
          )
          .map((item) => item.created_at)
      )
    }
    style={{
      background: "#2563eb",
      color: "white",
      padding: "10px 18px",
      borderRadius: "10px",
      border: "none",
      cursor: "pointer",
      marginRight: "10px",
      fontWeight: "bold",
    }}
  >
    ✅ Selecionar tudo
  </button>

  <button
    onClick={() => setSelecionadas([])}
    style={{
      background: "#475569",
      color: "white",
      padding: "10px 18px",
      borderRadius: "10px",
      border: "none",
      cursor: "pointer",
      fontWeight: "bold",
    }}
  >
    ❌ Desmarcar tudo
  </button>
</div>
{selecionadas.length > 0 && (
  <button
    onClick={excluirSelecionadas}
    style={{
      background: "#dc2626",
      color: "white",
      padding: "10px 18px",
      borderRadius: "10px",
      border: "none",
      cursor: "pointer",
      marginBottom: "20px",
      fontWeight: "bold",
    }}
  >
    🗑️ Excluir selecionadas ({selecionadas.length})
  </button>
)}
{selecionadas.length > 0 && (
  <button
    onClick={baixarSelecionadas}
    style={{
      background: "#16a34a",
      color: "white",
      padding: "10px 18px",
      borderRadius: "10px",
      border: "none",
      cursor: "pointer",
      marginLeft: "10px",
      marginBottom: "20px",
      fontWeight: "bold",
    }}
  >
    {baixandoLote
      ? "⏳ Baixando..."
      : `⬇️ Baixar selecionadas (${selecionadas.length})`}
  </button>
)}
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
        gap: "20px",
      }}
    >
{console.log(
  "GALERIA FILTRADA:",
  galeria.filter((item) =>
    filtroGaleria === "todos"
      ? true
      : item.tipo === filtroGaleria
  )
)}
      {galeria
  .filter((item) =>
    filtroGaleria === "todos"
      ? true
      : item.tipo === filtroGaleria
  )
  .map((item) => (
        <div key={item.id || item.created_at} style={cardStyle}>
          
      
  <a
  href={item.imagem_processada || item.imagem_original}
  target="_blank"
  rel="noreferrer"
  style={{ color: "yellow" }}
>
  Abrir imagem
</a>

<img
  src={item.imagem_processada || item.imagem_original}
  alt=""
  style={{
    width: "100%",
    height: "230px",
    objectFit: "contain",
    background: "#f1f5f9",
    borderRadius: "10px",
  }}
/>
<input
  type="checkbox"
  checked={selecionadas.includes(item.created_at)}
  onChange={() => alternarSelecionada(item.created_at)}
/>
          <button
            onClick={() => baixarImagem(item.imagem_processada || item.imagem_original)}
            style={{ ...buttonGreen, marginTop: "12px" }}
          >
            ⬇️ Baixar
          </button>

          <button
  onClick={() => excluirImagem(item)}
  style={{
    background: "#dc2626",
    color: "white",
    border: "none",
    padding: "10px 15px",
    borderRadius: "8px",
    cursor: "pointer",
    marginTop: "10px",
  }}
>
  🗑 Excluir
</button>
        </div>
      ))}
    </div>
  </div>
)}
<p style={{ color: "#93c5fd" }}>
  Total de imagens: {
    galeria.filter((item) =>
      filtroGaleria === "todos"
        ? true
        : item.tipo === filtroGaleria
    ).length
  }
</p>
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