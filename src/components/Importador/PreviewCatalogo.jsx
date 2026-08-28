import { useState } from "react";
import { motorImportacao } from "../../services/importadores/motorImportacao";
import { simularImportacao } from "../../services/importadores/simuladorImportacao";

export default function PreviewCatalogo({
  arquivo,
}) {
  const [carregando, setCarregando] =
    useState(false);

  const [progresso, setProgresso] =
    useState("");

  const [resultado, setResultado] =
    useState(null);

  const [erro, setErro] =
    useState("");

  async function gerarPreview() {
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
        await motorImportacao({
          arquivo,
          fabricante: "",
          modoPreview: true,
          onProgresso: setProgresso,
        });

      setResultado(resposta);
    } catch (error) {
      console.error(
        "Erro ao gerar preview:",
        error
      );

      setErro(
        error?.message ||
          "Não foi possível gerar o preview."
      );
    } finally {
      setCarregando(false);
    }
  }

  const registros =
    resultado?.registrosPreview || [];

    const simulacao =
  simularImportacao(registros);

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
        👁️ Preview do Catálogo
      </h3>

      <p
        style={{
          marginTop: 0,
          color: "#94a3b8",
        }}
      >
        Confira os primeiros registros antes
        de gravar no banco de dados.
      </p>

      <button
        type="button"
        onClick={gerarPreview}
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
          ? "🔄 Gerando preview..."
          : "👁️ Gerar Preview"}
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
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "12px",
              marginBottom: "16px",
            }}
          >
            <Card
              titulo="Fabricante"
              valor={
                resultado.fabricante ||
                "Não identificado"
              }
            />

            <Card
              titulo="Registros encontrados"
              valor={
                resultado.encontrados || 0
              }
            />

            <Card
              titulo="Registros exibidos"
              valor={registros.length}
            />
            <div
  style={{
    marginTop: "18px",
    padding: "18px",
    borderRadius: "12px",
    background: "#0f172a",
    border: "1px solid #334155",
  }}
>
  <h3
    style={{
      marginTop: 0,
      color: "#67e8f9",
    }}
  >
    📊 Simulação da Importação
  </h3>

  <p>
    📄 Registros analisados:
    <b> {simulacao.total}</b>
  </p>

  <p>
    📚 Códigos únicos:
    <b> {simulacao.codigosUnicos}</b>
  </p>

  <p>
    ⚠️ Duplicados:
    <b>
      {" "}
      {simulacao.codigosDuplicados.length}
    </b>
  </p>

  <hr />

  <h4>🏭 Fabricantes</h4>

  {Object.entries(
    simulacao.fabricantes
  ).map(([nome, quantidade]) => (
    <div key={nome}>
      {nome} — {quantidade}
    </div>
  ))}

  <hr />

  <h4>🚗 Montadoras</h4>

  {Object.entries(
    simulacao.montadoras
  ).map(([nome, quantidade]) => (
    <div key={nome}>
      {nome} — {quantidade}
    </div>
  ))}
</div>
          </div>

          {registros.length === 0 ? (
            <div
              style={{
                padding: "14px",
                borderRadius: "10px",
                background: "#0f172a",
                color: "#fcd34d",
              }}
            >
              ⚠️ Nenhum registro foi encontrado
              para o preview.
            </div>
          ) : (
            <div
              style={{
                overflowX: "auto",
                borderRadius: "12px",
                border: "1px solid #334155",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  minWidth: "900px",
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: "#0f172a",
                    }}
                  >
                    <Cabecalho texto="Código" />
                    <Cabecalho texto="Equivalente" />
                    <Cabecalho texto="Peça" />
                    <Cabecalho texto="Montadora" />
                    <Cabecalho texto="Modelo" />
                    <Cabecalho texto="Motor" />
                    <Cabecalho texto="Ano" />
                  </tr>
                </thead>

                <tbody>
                  {registros.map(
                    (registro, indice) => (
                      <tr
                        key={`${registro.codigo_oem}-${indice}`}
                        style={{
                          borderTop:
                            "1px solid #334155",
                        }}
                      >
                        <Celula
                          valor={
                            registro.codigo_oem
                          }
                        />

                        <Celula
                          valor={
                            registro.codigo_equivalente
                          }
                        />

                        <Celula
                          valor={registro.peca}
                        />

                        <Celula
                          valor={
                            registro.montadora
                          }
                        />

                        <Celula
                          valor={registro.modelo}
                        />

                        <Celula
                          valor={registro.motor}
                        />

                        <Celula
                          valor={formatarAno(
                            registro
                          )}
                        />
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatarAno(registro) {
  const inicio =
    registro?.ano_inicio;

  const fim =
    registro?.ano_fim;

  if (inicio && fim) {
    return `${inicio} até ${fim}`;
  }

  return inicio || fim || "";
}

function Cabecalho({ texto }) {
  return (
    <th
      style={{
        padding: "12px",
        textAlign: "left",
        color: "#67e8f9",
        fontSize: "13px",
      }}
    >
      {texto}
    </th>
  );
}

function Celula({ valor }) {
  return (
    <td
      style={{
        padding: "12px",
        color: "#e2e8f0",
        verticalAlign: "top",
      }}
    >
      {valor || "—"}
    </td>
  );
}

function Card({
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
          color: "#94a3b8",
          fontSize: "13px",
          marginBottom: "6px",
        }}
      >
        {titulo}
      </div>

      <strong
        style={{
          color: "#f8fafc",
        }}
      >
        {valor}
      </strong>
    </div>
  );
}