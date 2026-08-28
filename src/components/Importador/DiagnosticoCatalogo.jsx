import { useState } from "react";
import { diagnosticoCatalogo } from "../../services/importadores/diagnosticoCatalogo";

export default function DiagnosticoCatalogo({
  arquivo,
  fabricante,
}) {
  const [carregando, setCarregando] =
    useState(false);

  const [progresso, setProgresso] =
    useState("");

  const [resultado, setResultado] =
    useState(null);

  const [erro, setErro] =
    useState("");

  async function executarDiagnostico() {
    if (!arquivo) {
      setErro(
        "Selecione um catálogo PDF primeiro."
      );
      return;
    }

    try {
      setCarregando(true);
      setErro("");
      setResultado(null);

      const resposta =
        await diagnosticoCatalogo({
          arquivo,
          fabricante,
          onProgresso: setProgresso,
        });

      setResultado(resposta);
    } catch (error) {
      console.error(
        "Erro no diagnóstico:",
        error
      );

      setErro(
        error?.message ||
          "Não foi possível analisar o catálogo."
      );
    } finally {
      setCarregando(false);
    }
  }

  function formatarFaixa(faixa) {
    const inicio = faixa?.inicio;
    const fim = faixa?.fim;

    if (inicio && fim) {
      return `${inicio} até ${fim}`;
    }

    if (inicio) {
      return `A partir da página ${inicio}`;
    }

    return "Não identificadas";
  }

  function formatarPaginas(paginas) {
    if (
      !Array.isArray(paginas) ||
      paginas.length === 0
    ) {
      return "Não identificadas";
    }

    return paginas.join(", ");
  }

  const identificado =
    resultado?.identificado;

  const paginasAplicacoes =
    resultado?.analise
      ?.paginasAplicacoes;

  const paginasEquivalencias =
    resultado?.analise
      ?.paginasEquivalencias;

  const origemPaginas =
    resultado?.analise
      ?.origemPaginas ||
    "Não informada";

  const totalPaginasAnalisadas =
    resultado?.analise
      ?.paginas?.length ||
    resultado?.estrutura
      ?.totalPaginas ||
    0;

  return (
    <div
      style={{
        marginTop: "20px",
        padding: "20px",
        borderRadius: "16px",
        background: "#020617",
        border: "1px solid #334155",
      }}
    >
      <h3
        style={{
          marginTop: 0,
          marginBottom: "8px",
          color: "#67e8f9",
        }}
      >
        🔍 Diagnóstico do Catálogo
      </h3>

      <p
        style={{
          marginTop: 0,
          color: "#94a3b8",
        }}
      >
        Analise o fabricante, as páginas e o
        layout antes de iniciar a importação.
      </p>

      <button
        type="button"
        onClick={executarDiagnostico}
        disabled={carregando || !arquivo}
        style={{
          padding: "12px 18px",
          border: "none",
          borderRadius: "10px",
          cursor:
            carregando || !arquivo
              ? "not-allowed"
              : "pointer",
          background:
            carregando || !arquivo
              ? "#475569"
              : "#2563eb",
          color: "#ffffff",
          fontWeight: 700,
        }}
      >
        {carregando
          ? "🔄 Analisando..."
          : "🧠 Diagnosticar Catálogo"}
      </button>

      {progresso && (
        <div
          style={{
            marginTop: "14px",
            padding: "12px",
            borderRadius: "10px",
            background: "#0f172a",
            color: "#cbd5e1",
          }}
        >
          {progresso}
        </div>
      )}

      {erro && (
        <div
          style={{
            marginTop: "14px",
            padding: "12px",
            borderRadius: "10px",
            background: "#450a0a",
            border: "1px solid #dc2626",
            color: "#fecaca",
          }}
        >
          ❌ {erro}
        </div>
      )}

      {resultado && (
        <div
          style={{
            marginTop: "18px",
            display: "grid",
            gap: "12px",
          }}
        >
          <div
            style={{
              padding: "16px",
              borderRadius: "12px",
              background: "#0f172a",
              border: identificado
                ? "1px solid #22c55e"
                : "1px solid #f59e0b",
            }}
          >
            <strong
              style={{
                color: identificado
                  ? "#86efac"
                  : "#fcd34d",
              }}
            >
              {identificado
                ? "✅ Catálogo identificado"
                : "⚠️ Identificação incompleta"}
            </strong>

            <p
              style={{
                marginBottom: 0,
                color: "#e2e8f0",
              }}
            >
              Fabricante:{" "}
              <b>
                {resultado.fabricante ||
                  "Não identificado"}
              </b>
            </p>

            <p
              style={{
                marginBottom: 0,
                color: "#e2e8f0",
              }}
            >
              Chave do parser:{" "}
              <b>
                {resultado.chave ||
                  "Não identificada"}
              </b>
            </p>

            <p
              style={{
                marginBottom: 0,
                color: "#e2e8f0",
              }}
            >
              Origem das páginas:{" "}
              <b>{origemPaginas}</b>
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(190px, 1fr))",
              gap: "12px",
            }}
          >
            <CardResultado
              titulo="Confiança do catálogo"
              valor={`${resultado.confiancaCatalogo || 0}%`}
            />

            <CardResultado
              titulo="Confiança do layout"
              valor={`${resultado.confiancaLayout || 0}%`}
            />

            <CardResultado
              titulo="Faixa de aplicações"
              valor={formatarFaixa(
                paginasAplicacoes
              )}
            />

            <CardResultado
              titulo="Faixa de equivalências"
              valor={formatarFaixa(
                paginasEquivalencias
              )}
            />

            <CardResultado
              titulo="Páginas com tabelas"
              valor={formatarPaginas(
                resultado.paginasComTabela
              )}
            />

            <CardResultado
              titulo="Total analisado"
              valor={`${totalPaginasAnalisadas} página(s)`}
            />
          </div>

          <details
            style={{
              padding: "14px",
              borderRadius: "12px",
              background: "#0f172a",
              border: "1px solid #334155",
            }}
          >
            <summary
              style={{
                cursor: "pointer",
                color: "#67e8f9",
                fontWeight: 700,
              }}
            >
              📋 Ver diagnóstico técnico
            </summary>

            <pre
              style={{
                marginTop: "14px",
                padding: "14px",
                borderRadius: "10px",
                overflowX: "auto",
                background: "#020617",
                color: "#cbd5e1",
                fontSize: "12px",
                whiteSpace: "pre-wrap",
              }}
            >
              {JSON.stringify(
                resultado,
                null,
                2
              )}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}

function CardResultado({
  titulo,
  valor,
}) {
  return (
    <div
      style={{
        padding: "14px",
        borderRadius: "12px",
        background: "#0f172a",
        border: "1px solid #334155",
      }}
    >
      <div
        style={{
          marginBottom: "6px",
          color: "#94a3b8",
          fontSize: "13px",
        }}
      >
        {titulo}
      </div>

      <strong
        style={{
          color: "#f8fafc",
          wordBreak: "break-word",
        }}
      >
        {valor}
      </strong>
    </div>
  );
}