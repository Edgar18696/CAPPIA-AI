export default function PaizinhoAppia({
  codigo = "",
  processando = false,
  etapa = "",
  progresso = 0,
  diagnostico = null,
  auditoria = null,
  pecaEncontrada = null,
}) {
  const temCodigo =
    String(codigo || "").trim().length > 0;

  const encontrouPeca =
    Boolean(pecaEncontrada);

  const aprovado =
    Boolean(
      auditoria?.aprovado ||
        auditoria?.status === "APROVADO"
    );

  const fabricante =
    diagnostico?.fabricante ||
    pecaEncontrada?.fabricante ||
    "";

  const fonte =
    diagnostico?.arquivoCatalogo ||
    pecaEncontrada?.origem_catalogo ||
    "";

  const progressoSeguro = Math.max(
    0,
    Math.min(
      100,
      Number(progresso) || 0
    )
  );

  function obterEstado() {
    if (processando) {
      return {
        icone: "🤖⚙️",
        titulo:
          "Estou trabalhando na sua peça.",
        mensagem:
          etapa ||
          "Estou analisando as informações técnicas.",
        proximo:
          "Acompanhe aqui. Eu aviso quando estiver pronto.",
        progresso:
          progressoSeguro,
        missao:
          "Missão 1 de 5",
      };
    }

    if (aprovado) {
      return {
        icone: "🤖🎉",
        titulo:
          "Excelente! Seu anúncio foi criado.",
        mensagem:
          fabricante
            ? `Localizei a peça, conferi os dados da ${fabricante} e concluí a análise técnica.`
            : "Localizei a peça, conferi os dados e concluí a análise técnica.",
        proximo:
          "Próxima missão: produzir a Foto IA.",
        progresso: 100,
        missao:
          "Missão 1 de 5 concluída",
      };
    }

    if (encontrouPeca) {
      return {
        icone: "🤖😊",
        titulo:
          "Encontrei sua peça.",
        mensagem:
          "Os dados técnicos foram localizados. Confira as informações antes de continuar.",
        proximo:
          "Revise aplicações, equivalências e auditoria.",
        progresso: 80,
        missao:
          "Missão 1 de 5",
      };
    }

    if (temCodigo) {
      return {
        icone: "🤖",
        titulo:
          "Código recebido.",
        mensagem:
          'Tudo pronto. Clique em "Buscar e Montar Anúncio" para eu iniciar a análise técnica.',
        proximo:
          "Vou consultar a Base Mestre e os catálogos oficiais.",
        progresso: 10,
        missao:
          "Missão 1 de 5",
      };
    }

    return {
      icone: "🤖",
      titulo:
        "Bem-vindo! Vamos criar seu anúncio.",
      mensagem:
        'Digite o código da peça. Depois clique em "Buscar e Montar Anúncio" e eu cuido da análise técnica.',
      proximo:
        "Comece informando o código da peça.",
      progresso: 0,
      missao:
        "Missão 1 de 5",
    };
  }

  const estado = obterEstado();

  const etapas = [
    {
      nome: "Código",
      concluido: temCodigo,
    },
    {
      nome: "Base Mestre",
      concluido:
        processando ||
        encontrouPeca,
    },
    {
      nome: "Catálogo",
      concluido:
        Boolean(diagnostico),
    },
    {
      nome: "Anúncio",
      concluido:
        aprovado,
    },
    {
      nome: "Foto IA",
      concluido: false,
    },
  ];

  return (
    <section
      style={{
        position: "sticky",
        top: "8px",
        zIndex: 80,

        marginBottom: "10px",
        padding: "12px 16px",

        borderRadius: "15px",

        border: aprovado
          ? "1px solid #22c55e"
          : "1px solid #2563eb",

        background: aprovado
          ? "linear-gradient(135deg,#052e16,#14532d)"
          : "linear-gradient(135deg,#0f172a,#172554)",

        boxShadow:
          "0 10px 26px rgba(0,0,0,.28)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "14px",
        }}
      >
        <div
          style={{
            width: "56px",
            height: "56px",
            minWidth: "56px",

            display: "flex",
            alignItems: "center",
            justifyContent: "center",

            borderRadius: "50%",

            fontSize: "29px",

            background:
              "rgba(2,6,23,.75)",

            border:
              "1px solid #38bdf8",

            boxShadow:
              "0 0 15px rgba(34,211,238,.25)",
          }}
        >
          {estado.icone}
        </div>

        <div
          style={{
            flex: 1,
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems: "center",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <strong
              style={{
                color: aprovado
                  ? "#bbf7d0"
                  : "#67e8f9",
                fontSize: "17px",
              }}
            >
              Paizinho APPIA
            </strong>

            <span
              style={{
                color: "#94a3b8",
                fontSize: "11px",
                fontWeight: "bold",
              }}
            >
              {estado.missao}
            </span>
          </div>

          <div
            style={{
              marginTop: "3px",
              color: "#ffffff",
              fontWeight: "bold",
              fontSize: "14px",
            }}
          >
            {estado.titulo}
          </div>

          <div
            style={{
              marginTop: "3px",
              color: "#cbd5e1",
              fontSize: "12px",
              lineHeight: 1.4,
            }}
          >
            {estado.mensagem}
          </div>
        </div>
      </div>

      <div
        style={{
          height: "6px",
          marginTop: "10px",
          overflow: "hidden",
          borderRadius: "999px",
          background: "#020617",
        }}
      >
        <div
          style={{
            height: "100%",

            width: `${
              estado.progresso
            }%`,

            borderRadius: "999px",

            background:
              aprovado
                ? "linear-gradient(90deg,#16a34a,#22c55e)"
                : "linear-gradient(90deg,#2563eb,#22d3ee)",

            transition:
              "width .3s ease",
          }}
        />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "7px",
          flexWrap: "wrap",
          marginTop: "9px",
        }}
      >
        {etapas.map(
          (item, index) => (
            <div
              key={item.nome}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "7px",
              }}
            >
              <span
                style={{
                  color:
                    item.concluido
                      ? "#bbf7d0"
                      : "#94a3b8",

                  fontSize: "11px",
                  fontWeight: "bold",
                  whiteSpace: "nowrap",
                }}
              >
                {item.concluido
                  ? "✅"
                  : "⬜"}{" "}
                {item.nome}
              </span>

              {index <
                etapas.length - 1 && (
                <span
                  style={{
                    color: "#475569",
                    fontSize: "12px",
                  }}
                >
                  →
                </span>
              )}
            </div>
          )
        )}
      </div>

      <div
        style={{
          marginTop: "9px",
          paddingTop: "8px",

          borderTop:
            "1px solid rgba(148,163,184,.18)",

          color: aprovado
            ? "#dcfce7"
            : "#bfdbfe",

          fontSize: "12px",
          fontWeight: "bold",
        }}
      >
        ➡️ {estado.proximo}
      </div>

      {aprovado &&
        fonte && (
          <div
            style={{
              marginTop: "5px",
              color: "#94a3b8",
              fontSize: "10px",
            }}
          >
            📚 Fonte validada: {fonte}
          </div>
        )}
    </section>
  );
}