import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  lerProjetoAtual,
} from "../services/projetoAtualService";

export default function CopilotoIA({
  titulo,
  descricao,
  setTitulo,
  setDescricao,
  pecaEncontrada,
  setScreen,
}) {
  const [
    projetoAtual,
    setProjetoAtual,
  ] = useState(() =>
    lerProjetoAtual()
  );

  const [
    fluxoAberto,
    setFluxoAberto,
  ] = useState(false);

  useEffect(() => {
    function atualizarProjeto(
      evento
    ) {
      setProjetoAtual(
        evento?.detail ??
          lerProjetoAtual()
      );
    }

    window.addEventListener(
      "appia:projeto-atualizado",
      atualizarProjeto
    );

    window.addEventListener(
      "storage",
      atualizarProjeto
    );

    return () => {
      window.removeEventListener(
        "appia:projeto-atualizado",
        atualizarProjeto
      );

      window.removeEventListener(
        "storage",
        atualizarProjeto
      );
    };
  }, []);

  const etapasFluxo = useMemo(() => {
    return [
      {
        id: "foto",
        nome: "Foto IA",
        icone: "📸",
        concluida: Boolean(
          projetoAtual?.foto_pronta
        ),
        tela: "foto",
      },
      {
        id: "banner",
        nome: "Banner Studio",
        icone: "🎨",
        concluida: Boolean(
          projetoAtual?.banner_pronto
        ),
        tela: "banner",
      },
      {
        id: "clip",
        nome: "Clip IA",
        icone: "🎬",
        concluida: Boolean(
          projetoAtual?.clip_pronto
        ),
        tela: "clipIA",
      },
      {
        id: "anuncio",
        nome: "Novo Anúncio",
        icone: "🤖",
        concluida: Boolean(
          projetoAtual?.anuncio_pronto
        ),
        tela: "novoAnuncio",
      },
      {
        id: "publicacao",
        nome: "Publicação",
        icone: "🚀",
        concluida: Boolean(
          projetoAtual?.publicado
        ),
        tela:
          "centralPublicacao",
      },
    ];
  }, [projetoAtual]);

  const progresso = useMemo(() => {
    const concluidas =
      etapasFluxo.filter(
        (etapa) =>
          etapa.concluida
      ).length;

    return {
      concluidas,
      total:
        etapasFluxo.length,
      percentual:
        Math.round(
          (
            concluidas /
            etapasFluxo.length
          ) *
            100
        ),
      proxima:
        etapasFluxo.find(
          (etapa) =>
            !etapa.concluida
        ) || null,
    };
  }, [etapasFluxo]);

  function melhorarTitulo() {
    if (!pecaEncontrada) {
      alert(
        "Pesquise uma peça antes de melhorar o título."
      );
      return;
    }

    const fabricante =
      pecaEncontrada.fabricante ||
      "";

    const codigo =
      pecaEncontrada.codigo_oem ||
      pecaEncontrada
        .codigo_equivalente ||
      "";

    const novoTitulo =
      `${pecaEncontrada.peca || ""}
${fabricante}
${codigo}`
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 60);

    setTitulo?.(novoTitulo);
  }

  function melhorarDescricao() {
    if (!pecaEncontrada) {
      alert(
        "Pesquise uma peça antes de melhorar a descrição."
      );
      return;
    }

    const descricaoAtual =
      String(
        descricao || ""
      ).trim();

    const texto = `
${descricaoAtual}

────────────────────

✅ RECOMENDAÇÕES PAIIA AI

• Compare sempre o código gravado na peça original.

• Utilize o chassi para confirmar a compatibilidade.

• Produto de excelente qualidade.

• Fotos reais do produto.

• Antes da compra confirme aplicação e motorização.

────────────────────
`.trim();

    setDescricao?.(texto);
  }

  function abrirTela(tela) {
    if (
      typeof setScreen ===
      "function"
    ) {
      setScreen(tela);
      return;
    }

    alert(
      "O Copiloto não recebeu setScreen."
    );
  }

  function executarFluxoCompleto() {
    setFluxoAberto(true);

    if (
      !projetoAtual
    ) {
      abrirTela("projetos");
      return;
    }

    if (
      progresso.proxima
    ) {
      abrirTela(
        progresso.proxima.tela
      );
      return;
    }

    abrirTela(
      "centralPublicacao"
    );
  }

  return (
    <div
      style={{
        marginTop: "20px",
        padding: "18px",
        borderRadius: "16px",
        background: "#020617",
        border:
          "1px solid #2563eb",
        boxShadow:
          "0 16px 34px rgba(0,0,0,.2)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          gap: "12px",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h3
            style={{
              color: "#67e8f9",
              marginTop: 0,
              marginBottom: "6px",
            }}
          >
            🤖 Copiloto PAIIA AI
          </h3>

          <p
            style={{
              color: "#cbd5e1",
              margin: 0,
            }}
          >
            Melhore o anúncio e continue
            automaticamente pela próxima
            etapa do projeto.
          </p>
        </div>

        <strong
          style={{
            color: "#67e8f9",
            fontSize: "24px",
          }}
        >
          {progresso.percentual}%
        </strong>
      </div>

      <div
        style={{
          width: "100%",
          height: "9px",
          marginTop: "15px",
          borderRadius: "999px",
          background: "#1e293b",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width:
              `${progresso.percentual}%`,
            height: "100%",
            borderRadius: "999px",
            background:
              progresso.percentual ===
              100
                ? "linear-gradient(90deg,#16a34a,#22c55e)"
                : "linear-gradient(90deg,#2563eb,#22d3ee)",
            transition:
              "width .3s ease",
          }}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit,minmax(135px,1fr))",
          gap: "8px",
          marginTop: "15px",
        }}
      >
        {etapasFluxo.map(
          (etapa) => (
            <button
              key={etapa.id}
              type="button"
              onClick={() =>
                abrirTela(
                  etapa.tela
                )
              }
              style={{
                padding: "10px",
                borderRadius: "9px",
                border:
                  etapa.concluida
                    ? "1px solid #22c55e"
                    : "1px solid #334155",
                background:
                  etapa.concluida
                    ? "#052e16"
                    : "#0f172a",
                color:
                  etapa.concluida
                    ? "#bbf7d0"
                    : "#cbd5e1",
                cursor: "pointer",
                fontWeight: "bold",
                fontSize: "11px",
              }}
            >
              {etapa.concluida
                ? "✅"
                : etapa.icone}{" "}
              {etapa.nome}
            </button>
          )
        )}
      </div>

      <div
        style={{
          display: "flex",
          gap: "12px",
          flexWrap: "wrap",
          marginTop: "16px",
        }}
      >
        <button
          type="button"
          onClick={melhorarTitulo}
          style={{
            background: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: "10px",
            padding: "12px 18px",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          ✨ Melhorar título
        </button>

        <button
          type="button"
          onClick={melhorarDescricao}
          style={{
            background: "#16a34a",
            color: "#fff",
            border: "none",
            borderRadius: "10px",
            padding: "12px 18px",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          🧠 Melhorar descrição
        </button>

        <button
          type="button"
          onClick={
            executarFluxoCompleto
          }
          style={{
            flex: "1 1 240px",
            background:
              "linear-gradient(135deg,#7c3aed,#2563eb,#06b6d4)",
            color: "#ffffff",
            border: "none",
            borderRadius: "10px",
            padding: "12px 18px",
            cursor: "pointer",
            fontWeight: "900",
            boxShadow:
              "0 12px 24px rgba(37,99,235,.2)",
          }}
        >
          {progresso.proxima
            ? `${progresso.proxima.icone} Continuar Fluxo Completo`
            : "🚀 Abrir Publicação"}
        </button>
      </div>

      {fluxoAberto && (
        <div
          style={{
            marginTop: "14px",
            padding: "11px",
            borderRadius: "10px",
            background: "#0f172a",
            border:
              "1px solid #334155",
            color: "#94a3b8",
            fontSize: "11px",
            lineHeight: 1.5,
          }}
        >
          {projetoAtual ? (
            progresso.proxima ? (
              <>
                Próxima etapa:{" "}
                <strong
                  style={{
                    color:
                      "#67e8f9",
                  }}
                >
                  {
                    progresso.proxima
                      .nome
                  }
                </strong>
                . Ao concluir, o Projeto
                Atual será atualizado e o
                Copiloto indicará a etapa
                seguinte.
              </>
            ) : (
              <>
                ✅ Todas as etapas estão
                concluídas. O projeto pode
                seguir para publicação.
              </>
            )
          ) : (
            <>
              Crie ou abra um Projeto PAIIA
              para iniciar o fluxo completo.
            </>
          )}
        </div>
      )}
    </div>
  );
}