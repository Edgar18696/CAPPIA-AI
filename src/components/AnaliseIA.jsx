export default function AnaliseIA({
  codigo,
  oem,
  titulo,
  descricao,
  fotosAnuncio,
  preco,
}) {
  const temCodigo = Boolean(codigo || oem);
  const temTitulo = Boolean(titulo);
  const temDescricao = descricao?.length > 100;
  const temFotos = fotosAnuncio?.length > 0;
  const temPreco = Boolean(preco);
  const pronto = temCodigo && temTitulo && temDescricao && temFotos && temPreco;
const iniciouAnalise =
  temCodigo || temTitulo || temDescricao || temFotos || temPreco;
  const etapas = [
    {
      nome: "Código identificado",
      ok: temCodigo,
    },
    {
      nome: "Título premium gerado",
      ok: temTitulo,
    },
    {
      nome: "Descrição técnica criada",
      ok: temDescricao,
    },
    {
      nome: "Fotos adicionadas ao anúncio",
      ok: temFotos,
    },
    {
      nome: "Preço informado",
      ok: temPreco,
    },
    {
      nome: "Anúncio pronto para publicação",
      ok: pronto,
    },
  ];

  const progresso =
    Math.round((etapas.filter((item) => item.ok).length / etapas.length) * 100);

 if (!iniciouAnalise) {
  return (
    <div
      style={{
        marginTop: "25px",
        padding: "25px",
        borderRadius: "18px",
        background: "#020617",
        border: "1px solid #1e293b",
        textAlign: "center",
      }}
    >
      <h3 style={{ color: "#67e8f9" }}>🧠 APPIA AI</h3>

      <p
        style={{
          color: "#cbd5e1",
          marginTop: "15px",
          fontSize: "17px",
        }}
      >
        Informe o código da peça ou OEM para que a Inteligência Artificial
        consulte os catálogos e monte automaticamente o anúncio.
      </p>
    </div>
  );
}

return (
    <div
      style={{
        marginTop: "22px",
        padding: "18px",
        borderRadius: "18px",
        background: "#020617",
        border: "1px solid #1e293b",
      }}
    >
      <h3 style={{ color: "#67e8f9", marginBottom: "8px" }}>
        🧠 Análise APPIA AI
      </h3>

      <p style={{ color: "#94a3b8", marginBottom: "16px" }}>
        O APPIA AI analisa automaticamente os dados do anúncio e mostra o que
        já está pronto.
      </p>

      <div
        style={{
          width: "100%",
          height: "14px",
          borderRadius: "999px",
          background: "#1e293b",
          overflow: "hidden",
          marginBottom: "12px",
        }}
      >
        <div
          style={{
            width: `${progresso}%`,
            height: "100%",
            background:
              progresso >= 80
                ? "linear-gradient(135deg,#16a34a,#22c55e)"
                : "linear-gradient(135deg,#2563eb,#22d3ee)",
          }}
        />
      </div>

   <h2 style={{ color: progresso >= 80 ? "#22c55e" : "#facc15" }}>
  {iniciouAnalise ? `${progresso}%` : "Aguardando código"}
</h2>

      <div style={{ marginTop: "12px" }}>
        {etapas.map((etapa, index) => (
          <p
            key={index}
            style={{
              color: etapa.ok ? "#22c55e" : "#94a3b8",
              margin: "8px 0",
              fontSize: "15px",
            }}
          >
            {etapa.ok ? "🟢" : "⚪"} {etapa.nome}
          </p>
        ))}
      </div>

      <p
        style={{
          marginTop: "14px",
          color: pronto ? "#22c55e" : "#facc15",
          fontWeight: "bold",
        }}
      >
{!iniciouAnalise
  ? "Digite o código da peça para iniciar a criação automática."
  : pronto
  ? "Anúncio pronto para publicação."
  : "A IA ainda precisa de mais dados para finalizar o anúncio."}
      </p>
    </div>
  );
}