import { useState } from "react";
import { supabase } from "../supabase";

export default function NovoAnuncio({
  cardStyle,
  setScreen,
  fotosAnuncio,
  setFotosAnuncio,
}) {
  const [codigo, setCodigo] = useState("");
  const [oem, setOem] = useState("");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [preco, setPreco] = useState("");
  const [tipoAnuncio, setTipoAnuncio] = useState("classico");

  async function buscarNoCatalogo() {
    const codigoFinal = codigo.trim() || oem.trim();

    if (!codigoFinal) {
      alert("Informe o código da peça ou OEM.");
      return;
    }

    const { data, error } = await supabase
      .from("catalogo_pecas")
      .select("*")
      .or(
        `codigo_oem.ilike.%${codigoFinal}%,codigo_equivalente.ilike.%${codigoFinal}%,peca.ilike.%${codigoFinal}%`
      )
      .eq("ativo", true)
      .limit(20);

    if (error) {
      console.log(error);
      alert("Erro ao buscar no catálogo.");
      return;
    }

    if (!data || data.length === 0) {
      alert("Código não encontrado no catálogo.");
      return;
    }

    const item = data[0];

    const aplicacoes = data
      .map(
        (p) =>
          `${p.montadora || ""} ${p.modelo || ""} ${p.ano_inicio || ""} - ${
            p.ano_fim || ""
          } ${p.motor || ""}`
      )
      .join("\n");

    setCodigo(item.codigo_oem || codigoFinal);
    setOem(item.codigo_oem || codigoFinal);

    setTitulo(
      `${item.peca || "Peça Automotiva"} ${item.montadora || ""} ${
        item.modelo || ""
      } ${item.codigo_oem || codigoFinal}`.slice(0, 60)
    );

    setDescricao(`
${(item.peca || "PEÇA AUTOMOTIVA").toUpperCase()}

CÓDIGO OEM:
${item.codigo_oem || codigoFinal}

CÓDIGO EQUIVALENTE:
${item.codigo_equivalente || "Consultar"}

FABRICANTE:
${item.fabricante || "Consultar"}

APLICAÇÕES:
${aplicacoes}

OBSERVAÇÃO:
${item.observacao || "Antes da compra, compare o código gravado na peça original."}

IMPORTANTE:
Antes da compra, compare o código gravado na peça original ou informe o chassi do veículo para confirmação da compatibilidade.
`.trim());
  }

  function gerarComCopilot() {
    if (!descricao.trim()) {
      alert("Busque primeiro no catálogo.");
      return;
    }

    setDescricao(
      `${descricao}

DESCRIÇÃO DO PRODUTO:
Produto novo, desenvolvido para reposição automotiva com excelente acabamento, qualidade e durabilidade.

ESPECIFICAÇÕES:
- Produto novo
- Excelente acabamento
- Encaixe conforme aplicação
- Alta durabilidade
- Pronto para instalação
- Compatível conforme códigos informados

BENEFÍCIOS:
- Auxilia no funcionamento correto do sistema
- Mantém o desempenho adequado do veículo
- Substituição ideal para peça danificada ou com mau funcionamento
- Excelente custo-benefício

CONTEÚDO DA EMBALAGEM:
- 01 peça

GARANTIA:
- 90 dias contra defeitos de fabricação`
    );
  }
const etapasConcluidas =
  (codigo || oem ? 1 : 0) +
  (titulo ? 1 : 0) +
  (descricao ? 1 : 0) +
  (fotosAnuncio?.length > 0 ? 1 : 0);

const progressoProjeto = Math.round((etapasConcluidas / 4) * 100);
  return (
    <div style={{ marginTop: "40px" }}>
      <div style={cardStyle}>
<h2 style={{ color: "#67e8f9", fontSize: "32px" }}>
  🚀 Criar Projeto
</h2>
<div
  style={{
    marginTop: "15px",
    marginBottom: "25px",
    background: "#020617",
    border: "1px solid #2563eb",
    borderRadius: "14px",
    padding: "16px",
  }}
>
  <h3 style={{ color: "#38bdf8", marginBottom: "10px" }}>
    📊 Progresso do Projeto
  </h3>

  <div
    style={{
      width: "100%",
      height: "16px",
      background: "#1e293b",
      borderRadius: "999px",
      overflow: "hidden",
    }}
  >
    <div
      style={{
        width: `${progressoProjeto}%`,
        height: "100%",
        background: "linear-gradient(135deg,#2563eb,#22d3ee)",
      }}
    />
  </div>

  <p style={{ color: "#cbd5e1", marginTop: "10px" }}>
    {progressoProjeto}% concluído
  </p>

  <p style={{ color: "#94a3b8", fontSize: "14px" }}>
    ✅ Catálogo • ✅ Descrição • ✅ Fotos • ⬜ Publicação
  </p>
</div>
        <div style={gridStyle}>
          <input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Código da peça" style={inputStyle} />
          <input value={oem} onChange={(e) => setOem(e.target.value)} placeholder="Código OEM" style={inputStyle} />
          <input value={preco} onChange={(e) => setPreco(e.target.value)} placeholder="Preço" style={inputStyle} />
          <select value={tipoAnuncio} onChange={(e) => setTipoAnuncio(e.target.value)} style={inputStyle}>
            <option value="classico">Anúncio Clássico</option>
            <option value="premium">Anúncio Premium</option>
          </select>
        </div>

        <input value={titulo} onChange={(e) => setTitulo(e.target.value.slice(0, 60))} placeholder="Título do anúncio — máximo 60 caracteres" style={{ ...inputStyle, marginTop: "20px", width: "100%" }} />

        <p style={{ color: "#94a3b8" }}>{titulo.length}/60 caracteres</p>

        <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descrição do anúncio" style={textareaStyle} />
{fotosAnuncio && fotosAnuncio.length > 0 && (
  <div style={{ marginTop: "20px" }}>
    <h3 style={{ color: "#67e8f9" }}>
      🖼️ Fotos selecionadas para o anúncio
    </h3>

    <div style={fotosGridStyle}>
      {fotosAnuncio.map((foto) => (
        <img
          key={foto.id}
          src={foto.imagem_processada}
          alt="Foto do anúncio"
          style={fotoMiniaturaStyle}
        />
      ))}
    </div>
  </div>
)}

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
<button style={botaoStyle} onClick={buscarNoCatalogo}>
  🔍 Buscar no Catálogo
</button>

<button style={botaoStyle} onClick={gerarComCopilot}>
  🤖 Gerar com APPIA Copilot
</button>
<button
  style={{
    ...botaoStyle,
    background: "linear-gradient(135deg,#16a34a,#22c55e)",
  }}
  onClick={() => {
    alert("💾 Em breve: salvar projeto completo.");
  }}
>
  💾 Salvar Projeto
</button>

<button style={botaoStyle} onClick={() => setScreen("galeria")}>
  🖼️ Escolher Fotos da Galeria
</button>

        </div>
      </div>
    </div>
  );
}


const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "15px",
  marginTop: "25px",
};

const inputStyle = {
  padding: "14px",
  borderRadius: "10px",
  border: "1px solid #334155",
  fontSize: "16px",
};

const textareaStyle = {
  width: "100%",
  minHeight: "180px",
  marginTop: "20px",
  padding: "15px",
  borderRadius: "12px",
  fontSize: "16px",
};

const botaoStyle = {
  marginTop: "20px",
  padding: "14px 28px",
  borderRadius: "12px",
  border: "none",
  background: "linear-gradient(135deg, #2563eb, #22d3ee)",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
};
const fotosGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
  gap: "12px",
  marginTop: "12px",
};

const fotoMiniaturaStyle = {
  width: "100%",
  height: "120px",
  objectFit: "cover",
  borderRadius: "12px",
  border: "2px solid #22d3ee",
  background: "#fff",
};
const fotoCardStyle = {
  background: "#0f172a",
  border: "1px solid #2563eb",
  borderRadius: "14px",
  padding: "10px",
  position: "relative",
};

const seloPrincipalStyle = {
  position: "absolute",
  top: "8px",
  left: "8px",
  background: "#facc15",
  color: "#111827",
  padding: "4px 8px",
  borderRadius: "8px",
  fontSize: "12px",
  fontWeight: "bold",
};

const botaoMiniStyle = {
  marginTop: "8px",
  width: "100%",
  background: "#2563eb",
  color: "white",
  border: "none",
  padding: "8px",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: "bold",
};

const botaoRemoverStyle = {
  marginTop: "8px",
  width: "100%",
  background: "#dc2626",
  color: "white",
  border: "none",
  padding: "8px",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: "bold",
};
