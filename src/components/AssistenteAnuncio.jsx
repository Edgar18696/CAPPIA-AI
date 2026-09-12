export default function AssistenteAnuncio({
  titulo,
  descricao,
  fotosAnuncio,
  diagnostico,
  auditoria,
  pecaEncontrada,
}) {

  const mensagens = [];

  if (!titulo || titulo.length < 40)
    mensagens.push({
      tipo: "aviso",
      texto: "Título curto. Considere adicionar fabricante ou aplicação.",
    });

  if (!descricao || descricao.length < 250)
    mensagens.push({
      tipo: "erro",
      texto: "Descrição muito pequena.",
    });

  if (!pecaEncontrada?.modelo)
    mensagens.push({
      tipo: "aviso",
      texto: "Aplicações ainda podem ser enriquecidas.",
    });

  if (!fotosAnuncio.length)
    mensagens.push({
      tipo: "erro",
      texto: "Nenhuma foto adicionada.",
    });

  if (!diagnostico)
    mensagens.push({
      tipo: "erro",
      texto: "Diagnóstico técnico não disponível.",
    });

  if (!auditoria)
    mensagens.push({
      tipo: "erro",
      texto: "Auditoria técnica não executada.",
    });

  if (mensagens.length === 0) {
    mensagens.push({
      tipo: "ok",
      texto: "🎉 Excelente! O anúncio está muito bem preenchido.",
    });
  }

  return (
    <div
      style={{
        background: "#020617",
        border: "1px solid #2563eb",
        borderRadius: "16px",
        padding: "20px",
        marginBottom: "20px",
      }}
    >
      <h3 style={{ color: "#67e8f9" }}>
        🧠 Assistente PAIIA AI
      </h3>

      {mensagens.map((m, index) => (
        <div
          key={index}
          style={{
            marginBottom: "10px",
            color:
              m.tipo === "ok"
                ? "#22c55e"
                : m.tipo === "erro"
                ? "#ef4444"
                : "#facc15",
          }}
        >
          • {m.texto}
        </div>
      ))}
    </div>
  );
}