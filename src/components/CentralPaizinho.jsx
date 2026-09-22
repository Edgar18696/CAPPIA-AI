import { useMemo, useState } from "react";

const ACOES = [
  ["compatibilidade", "🔧", "Verificar compatibilidade da peça"],
  ["concorrencia", "📊", "Comparar preços da concorrência"],
  ["codigo", "🔎", "Descobrir código ou aplicação"],
  ["anuncio", "📝", "Criar ou melhorar um anúncio"],
  ["nao-vende", "📉", "Analisar por que um anúncio não vende"],
  ["preco", "💰", "Calcular preço e margem"],
  ["foto", "📸", "Preparar uma foto profissional"],
  ["cliente", "💬", "Responder uma pergunta de cliente"],
  ["estoque", "📦", "Consultar estoque e oportunidades"],
  ["tempo-venda", "⏱️", "Verificar estoque e tempo de venda"],
  ["inativos", "🧾", "Verificar anúncios inativos e necessidade de reposição"],
  ["comecar", "🧭", "Não sei por onde começar"],
];

const SUGESTOES = [
  ["Quero criar um anúncio", "anuncio"],
  ["Verificar uma aplicação", "compatibilidade"],
  ["Comparar preços", "concorrencia"],
  ["Calcular meu preço", "preco"],
  ["Preparar uma foto", "foto"],
  ["Não sei por onde começar", "comecar"],
];

function lerJson(chave) {
  try {
    return JSON.parse(localStorage.getItem(chave) || "null");
  } catch {
    return null;
  }
}

function texto(valor) {
  return String(valor ?? "").trim();
}

export default function CentralPaizinho({ setScreen }) {
  const contexto = useMemo(() => {
    const anuncio =
      lerJson("novoAnuncioTemporario") ||
      lerJson("rascunhoNovoAnuncioTemp") ||
      {};
    const precificacao = lerJson("dadosPrecificacaoAppia") || {};

    return {
      codigo: texto(anuncio.codigo || precificacao.codigo),
      oem: texto(anuncio.oem),
      produto: texto(
        anuncio.pecaEncontrada?.peca ||
          anuncio.titulo ||
          precificacao.descricao
      ),
      preco: texto(anuncio.preco || precificacao.precoAtual),
      custo: texto(precificacao.custo),
      anuncio,
    };
  }, []);

  const [acao, setAcao] = useState("");
  const [pedidoLivre, setPedidoLivre] = useState("");
  const [aviso, setAviso] = useState("");
  const [categoria, setCategoria] = useState("");
  const [modoAnuncio, setModoAnuncio] = useState("");
  const [codigo, setCodigo] = useState(contexto.codigo);
  const [veiculo, setVeiculo] = useState("");
  const [modelo, setModelo] = useState("");
  const [motor, setMotor] = useState("");
  const [ano, setAno] = useState("");
  const [descricao, setDescricao] = useState(contexto.produto);
  const [oem, setOem] = useState(contexto.oem);
  const [custo, setCusto] = useState(contexto.custo);
  const [frete, setFrete] = useState("");
  const [embalagem, setEmbalagem] = useState("");
  const [despesas, setDespesas] = useState("");
  const [margem, setMargem] = useState("");
  const [perguntaCliente, setPerguntaCliente] = useState("");
  const [produtoRelacionado, setProdutoRelacionado] = useState(
    contexto.produto || contexto.codigo
  );
  const [necessidade, setNecessidade] = useState("");
  const [possuiReferencia, setPossuiReferencia] = useState("");
  const [destinoInicial, setDestinoInicial] = useState("");

  function escolherAcao(id) {
    setAcao(id);
    setAviso("");
    window.setTimeout(() => {
      document.getElementById("fluxo-paizinho")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 30);
  }

  function preservarRascunho(dados = {}) {
    const atual = lerJson("novoAnuncioTemporario") || contexto.anuncio || {};
    localStorage.setItem(
      "novoAnuncioTemporario",
      JSON.stringify({
        ...atual,
        codigo: texto(dados.codigo ?? codigo ?? atual.codigo),
        oem: texto(dados.oem ?? oem ?? atual.oem),
        titulo: texto(dados.titulo ?? descricao ?? atual.titulo),
        preco: texto(dados.preco ?? atual.preco),
      })
    );
  }

  function abrirPesquisaCatalogo() {
    const termo = [codigo, oem, descricao, veiculo, modelo, motor, ano]
      .map(texto)
      .filter(Boolean)
      .join(" ");

    if (!termo) {
      setAviso("Informe ao menos um código, OEM, descrição ou veículo.");
      return;
    }

    localStorage.setItem("paizinhoPesquisaInicial", termo);
    setScreen("centralPesquisa");
  }

  function abrirCompatibilidade() {
    if (!texto(codigo)) {
      setAviso("Informe o código da peça para verificar a compatibilidade.");
      return;
    }

    abrirPesquisaCatalogo();
  }

  function abrirConcorrencia() {
    if (!categoria) {
      setAviso("Escolha Original ou Importado antes de pesquisar.");
      return;
    }

    preservarRascunho();
    localStorage.setItem("paizinhoCategoriaConcorrencia", categoria);
    localStorage.setItem("abrirPesquisaConcorrenciaPaizinho", "true");
    setScreen("novoAnuncio");
  }

  function abrirAnuncio() {
    if (!modoAnuncio) {
      setAviso("Escolha criar um anúncio novo ou melhorar um existente.");
      return;
    }

    if (modoAnuncio === "existente") {
      setScreen("meusAnuncios");
      return;
    }

    preservarRascunho();
    setScreen("novoAnuncio");
  }

  function abrirPrecificacao() {
    localStorage.setItem(
      "dadosPrecificacaoAppia",
      JSON.stringify({
        ...(lerJson("dadosPrecificacaoAppia") || {}),
        codigo: texto(codigo || contexto.codigo),
        descricao: texto(descricao || contexto.produto),
        custo: texto(custo),
        frete: texto(frete),
        embalagem: texto(embalagem),
        despesas: texto(despesas),
        margemDesejada: texto(margem),
      })
    );
    setScreen("centralPrecificacao");
  }

  function abrirAtendimento() {
    if (!texto(perguntaCliente) || !texto(produtoRelacionado)) {
      setAviso("Cole a pergunta e informe o anúncio ou produto relacionado.");
      return;
    }

    localStorage.setItem(
      "paizinhoPerguntaCliente",
      JSON.stringify({
        pergunta: texto(perguntaCliente),
        produto: texto(produtoRelacionado),
      })
    );
    setScreen("atendimento");
  }

  function interpretarPedidoLivre() {
    const pedido = texto(pedidoLivre).toLowerCase();
    if (!pedido) {
      setAviso("Escreva o que você precisa ou escolha uma sugestão.");
      return;
    }

    if (/foto|imagem|fundo branco|recorte/.test(pedido)) escolherAcao("foto");
    else if (/preço|preco|margem|custo|frete/.test(pedido)) escolherAcao("preco");
    else if (/concorr|original|importad/.test(pedido)) escolherAcao("concorrencia");
    else if (/compat|serve|aplica|veículo|veiculo/.test(pedido)) escolherAcao("compatibilidade");
    else if (/código|codigo|oem|catálogo|catalogo/.test(pedido)) escolherAcao("codigo");
    else if (/anúncio|anuncio|descrição|descricao|título|titulo/.test(pedido)) escolherAcao("anuncio");
    else escolherAcao("comecar");
  }

  const possuiContexto = Boolean(
    contexto.codigo || contexto.oem || contexto.produto || contexto.preco
  );

  return (
    <main style={paginaStyle}>
      <button type="button" onClick={() => setScreen("home")} style={voltarStyle}>
        ← Voltar
      </button>

      <header style={cabecalhoStyle}>
        <div style={iconeStyle}>👨‍🔧</div>
        <div>
          <h1 style={tituloStyle}>Olá! O que posso fazer por você hoje?</h1>
          <p style={subtituloStyle}>
            Escolha uma opção abaixo ou escreva com suas palavras.
          </p>
        </div>
      </header>

      {possuiContexto && (
        <div style={contextoStyle}>
          <strong>Contexto encontrado:</strong>{" "}
          {[contexto.produto, contexto.codigo && `código ${contexto.codigo}`, contexto.oem && `OEM ${contexto.oem}`]
            .filter(Boolean)
            .join(" • ")}
          . O Paizinho aproveitará esses dados.
        </div>
      )}

      <section style={gradeStyle}>
        {ACOES.map(([id, icone, rotulo], indice) => (
          <button
            type="button"
            key={id}
            onClick={() => escolherAcao(id)}
            style={{
              ...cartaoStyle,
              ...(acao === id ? cartaoAtivoStyle : {}),
            }}
          >
            <span style={numeroStyle}>{indice + 1}</span>
            <span style={cartaoIconeStyle}>{icone}</span>
            <span>{rotulo}</span>
          </button>
        ))}
      </section>

      <section style={campoLivreStyle}>
        <div style={sugestoesStyle}>
          {SUGESTOES.map(([rotulo, id]) => (
            <button key={id} type="button" onClick={() => escolherAcao(id)} style={sugestaoStyle}>
              {rotulo}
            </button>
          ))}
        </div>
        <div style={linhaCampoStyle}>
          <textarea
            value={pedidoLivre}
            onChange={(event) => setPedidoLivre(event.target.value)}
            placeholder="Ex.: verifique se o código 0258003300 serve no meu veículo"
            rows={2}
            style={{ ...inputStyle, resize: "vertical", minHeight: "58px" }}
          />
          <button type="button" onClick={interpretarPedidoLivre} style={botaoPrimarioStyle}>
            Continuar
          </button>
        </div>
      </section>

      {acao && (
        <section id="fluxo-paizinho" style={fluxoStyle}>
          <h2 style={fluxoTituloStyle}>{ACOES.find(([id]) => id === acao)?.[2]}</h2>
          {aviso && <div style={avisoStyle}>{aviso}</div>}

          {acao === "compatibilidade" && (
            <>
              <p style={ajudaStyle}>A consulta usará somente os catálogos confiáveis disponíveis no PAIIA. Sem confirmação segura, nenhuma aplicação será afirmada.</p>
              <div style={camposStyle}>
                <Campo label="Código da peça" value={codigo} onChange={setCodigo} />
                <Campo label="Veículo" value={veiculo} onChange={setVeiculo} />
                <Campo label="Modelo" value={modelo} onChange={setModelo} />
                <Campo label="Motor" value={motor} onChange={setMotor} />
                <Campo label="Ano" value={ano} onChange={setAno} />
              </div>
              <button type="button" onClick={abrirCompatibilidade} style={botaoPrimarioStyle}>Consultar nos catálogos</button>
              <p style={notaStyle}>Se não houver confirmação: “Não encontrei confirmação segura nos catálogos disponíveis.”</p>
            </>
          )}

          {acao === "concorrencia" && (
            <>
              <p style={ajudaStyle}>Escolha uma categoria. Originais e importados nunca serão misturados na mesma comparação.</p>
              <div role="radiogroup" aria-label="Categoria da concorrência" style={opcoesStyle}>
                <Opcao label="Original" selected={categoria === "original"} onClick={() => { setCategoria("original"); setAviso(""); }} />
                <Opcao label="Importado" selected={categoria === "importado"} onClick={() => { setCategoria("importado"); setAviso(""); }} />
              </div>
              <div style={camposStyle}>
                <Campo label="Código ou produto" value={codigo || descricao} onChange={(valor) => { setCodigo(valor); setDescricao(valor); }} />
              </div>
              <button type="button" disabled={!categoria} onClick={abrirConcorrencia} style={{ ...botaoPrimarioStyle, ...(!categoria ? desabilitadoStyle : {}) }}>Ir para Pesquisa de Concorrência</button>
            </>
          )}

          {acao === "codigo" && (
            <>
              <div style={camposStyle}>
                <Campo label="Código" value={codigo} onChange={setCodigo} />
                <Campo label="Código OEM" value={oem} onChange={setOem} />
                <Campo label="Descrição da peça" value={descricao} onChange={setDescricao} />
                <Campo label="Veículo" value={veiculo} onChange={setVeiculo} />
                <Campo label="Modelo" value={modelo} onChange={setModelo} />
                <Campo label="Motor" value={motor} onChange={setMotor} />
                <Campo label="Ano" value={ano} onChange={setAno} />
              </div>
              <button type="button" onClick={abrirPesquisaCatalogo} style={botaoPrimarioStyle}>Abrir Catálogos Técnicos</button>
            </>
          )}

          {acao === "anuncio" && (
            <>
              <div style={opcoesStyle}>
                <Opcao label="Criar anúncio novo" selected={modoAnuncio === "novo"} onClick={() => setModoAnuncio("novo")} />
                <Opcao label="Melhorar anúncio existente" selected={modoAnuncio === "existente"} onClick={() => setModoAnuncio("existente")} />
              </div>
              <div style={camposStyle}>
                <Campo label="Código" value={codigo} onChange={setCodigo} />
                <Campo label="OEM" value={oem} onChange={setOem} />
                <Campo label="Produto" value={descricao} onChange={setDescricao} />
              </div>
              <button type="button" onClick={abrirAnuncio} style={botaoPrimarioStyle}>Continuar para Novo Anúncio</button>
            </>
          )}

          {acao === "nao-vende" && <Indisponivel />}

          {acao === "preco" && (
            <>
              <p style={ajudaStyle}>Preencha apenas o que ainda estiver faltando.</p>
              <div style={camposStyle}>
                <Campo label="Custo" value={custo} onChange={setCusto} type="number" />
                <Campo label="Frete" value={frete} onChange={setFrete} type="number" />
                <Campo label="Embalagem" value={embalagem} onChange={setEmbalagem} type="number" />
                <Campo label="Outras despesas" value={despesas} onChange={setDespesas} type="number" />
                <Campo label="Margem desejada (%)" value={margem} onChange={setMargem} type="number" />
              </div>
              <button type="button" onClick={abrirPrecificacao} style={botaoPrimarioStyle}>Abrir Precificação</button>
            </>
          )}

          {acao === "foto" && (
            <>
              <p style={ajudaStyle}>A imagem já selecionada será preservada. O Banner Express está temporariamente em revisão e não é oferecido neste fluxo.</p>
              <button type="button" onClick={() => setScreen("foto")} style={botaoPrimarioStyle}>Abrir Foto IA</button>
            </>
          )}

          {acao === "cliente" && (
            <>
              <div style={camposStyle}>
                <Campo label="Anúncio ou produto relacionado" value={produtoRelacionado} onChange={setProdutoRelacionado} />
                <label style={labelStyle}>Pergunta do cliente<textarea value={perguntaCliente} onChange={(event) => setPerguntaCliente(event.target.value)} rows={4} style={{ ...inputStyle, resize: "vertical" }} /></label>
              </div>
              <p style={notaStyle}>A resposta deverá usar somente informações confirmadas do anúncio e dos catálogos.</p>
              <button type="button" onClick={abrirAtendimento} style={botaoPrimarioStyle}>Abrir Atendimento</button>
            </>
          )}

          {["estoque", "tempo-venda", "inativos"].includes(acao) && <Indisponivel />}

          {acao === "comecar" && (
            <>
              <div style={camposStyle}>
                <Campo label="O que você precisa vender ou resolver?" value={necessidade} onChange={setNecessidade} />
                <Campo label="Você possui código ou foto da peça?" value={possuiReferencia} onChange={setPossuiReferencia} />
              </div>
              <div style={opcoesStyle}>
                {[["anuncio", "Criar anúncio"], ["compatibilidade", "Consultar aplicação"], ["preco", "Calcular preço"], ["foto", "Preparar foto"]].map(([id, label]) => (
                  <Opcao key={id} label={label} selected={destinoInicial === id} onClick={() => setDestinoInicial(id)} />
                ))}
              </div>
              <button type="button" disabled={!destinoInicial} onClick={() => escolherAcao(destinoInicial)} style={{ ...botaoPrimarioStyle, ...(!destinoInicial ? desabilitadoStyle : {}) }}>Continuar</button>
            </>
          )}
        </section>
      )}
    </main>
  );
}

function Campo({ label, value, onChange, type = "text" }) {
  return <label style={labelStyle}>{label}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} style={inputStyle} /></label>;
}

function Opcao({ label, selected, onClick }) {
  return <button type="button" role="radio" aria-checked={selected} onClick={onClick} style={{ ...opcaoStyle, ...(selected ? opcaoAtivaStyle : {}) }}>{label}</button>;
}

function Indisponivel() {
  return <div style={indisponivelStyle}><strong>Integração necessária</strong><p style={{ margin: "6px 0 0" }}>Esta análise precisa da conexão do marketplace e será disponibilizada em uma próxima etapa.</p><p style={notaStyle}>Nenhuma visualização, venda, estoque ou desempenho será inventado.</p></div>;
}

const paginaStyle = { width: "min(1180px, calc(100% - 24px))", margin: "42px auto", color: "#e2e8f0" };
const voltarStyle = { border: "1px solid #334155", background: "#0f172a", color: "#cbd5e1", borderRadius: "10px", padding: "9px 14px", cursor: "pointer", marginBottom: "16px" };
const cabecalhoStyle = { display: "flex", gap: "16px", alignItems: "center", padding: "24px", borderRadius: "20px", border: "1px solid #155e75", background: "linear-gradient(135deg,#020617,#0c2547)", boxShadow: "0 18px 45px rgba(2,6,23,.35)" };
const iconeStyle = { width: "62px", height: "62px", display: "grid", placeItems: "center", borderRadius: "18px", background: "rgba(103,232,249,.12)", fontSize: "34px", flexShrink: 0 };
const tituloStyle = { margin: 0, color: "#67e8f9", fontSize: "clamp(22px,4vw,34px)" };
const subtituloStyle = { margin: "7px 0 0", color: "#cbd5e1", fontSize: "16px" };
const contextoStyle = { marginTop: "14px", padding: "12px 15px", border: "1px solid rgba(103,232,249,.3)", borderRadius: "12px", background: "rgba(8,145,178,.09)", color: "#bae6fd" };
const gradeStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,235px),1fr))", gap: "13px", marginTop: "20px" };
const cartaoStyle = { minHeight: "106px", position: "relative", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "8px", padding: "17px", border: "1px solid #334155", borderRadius: "15px", background: "linear-gradient(145deg,#0f172a,#111c31)", color: "#e2e8f0", textAlign: "left", fontWeight: 800, cursor: "pointer" };
const cartaoAtivoStyle = { border: "1px solid #67e8f9", boxShadow: "0 0 0 2px rgba(103,232,249,.12)" };
const numeroStyle = { position: "absolute", right: "11px", top: "9px", color: "#64748b", fontSize: "11px" };
const cartaoIconeStyle = { fontSize: "24px" };
const campoLivreStyle = { marginTop: "22px", padding: "18px", border: "1px solid #334155", borderRadius: "16px", background: "#0f172a" };
const sugestoesStyle = { display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "12px" };
const sugestaoStyle = { border: "1px solid #155e75", background: "rgba(8,145,178,.1)", color: "#a5f3fc", borderRadius: "999px", padding: "8px 11px", cursor: "pointer", fontWeight: 700 };
const linhaCampoStyle = { display: "flex", gap: "10px", alignItems: "stretch", flexWrap: "wrap" };
const fluxoStyle = { scrollMarginTop: "18px", marginTop: "22px", padding: "clamp(17px,3vw,28px)", border: "1px solid #155e75", borderRadius: "18px", background: "linear-gradient(145deg,#071326,#0f172a)" };
const fluxoTituloStyle = { margin: "0 0 14px", color: "#67e8f9", fontSize: "23px" };
const camposStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,210px),1fr))", gap: "12px", margin: "15px 0" };
const labelStyle = { display: "flex", flexDirection: "column", gap: "6px", color: "#cbd5e1", fontSize: "13px", fontWeight: 700 };
const inputStyle = { width: "100%", boxSizing: "border-box", border: "1px solid #475569", borderRadius: "10px", background: "#020617", color: "#f8fafc", padding: "11px 12px", font: "inherit", outlineColor: "#22d3ee", flex: "1 1 520px" };
const botaoPrimarioStyle = { border: "1px solid #22d3ee", borderRadius: "11px", background: "linear-gradient(135deg,#0369a1,#0891b2)", color: "white", padding: "12px 17px", fontWeight: 900, cursor: "pointer" };
const desabilitadoStyle = { opacity: .48, cursor: "not-allowed" };
const opcoesStyle = { display: "flex", flexWrap: "wrap", gap: "10px", margin: "13px 0" };
const opcaoStyle = { border: "1px solid #475569", borderRadius: "11px", background: "#020617", color: "#e2e8f0", padding: "11px 16px", fontWeight: 800, cursor: "pointer" };
const opcaoAtivaStyle = { borderColor: "#67e8f9", background: "rgba(8,145,178,.24)", color: "#cffafe" };
const avisoStyle = { marginBottom: "12px", padding: "10px 12px", border: "1px solid #f59e0b", borderRadius: "10px", background: "rgba(245,158,11,.1)", color: "#fde68a", fontWeight: 700 };
const ajudaStyle = { color: "#cbd5e1", lineHeight: 1.55 };
const notaStyle = { color: "#94a3b8", fontSize: "12px", lineHeight: 1.5 };
const indisponivelStyle = { padding: "16px", border: "1px solid #475569", borderRadius: "12px", background: "#020617", color: "#cbd5e1" };
