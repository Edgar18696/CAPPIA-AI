import { useState } from "react";
import { supabase } from "../supabase";

function limparTexto(valor) {
  return String(valor ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function escaparBusca(valor) {
  return limparTexto(valor)
    .replace(/[%_,()]/g, "")
    .trim();
}

async function pesquisarNaTabela({
  tabela,
  termo,
}) {
  const termoLimpo =
    limparTexto(termo);

  const codigoNormalizado =
    termoLimpo
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase();

  if (!termoLimpo) {
    return [];
  }

  const { data, error } =
    await supabase
      .from(tabela)
      .select("*")
      .or(
        [
          `peca.ilike.%${termoLimpo}%`,
          `codigo_oem.ilike.%${termoLimpo}%`,
          `codigo_equivalente.ilike.%${termoLimpo}%`,
          `fabricante.ilike.%${termoLimpo}%`,
          `montadora.ilike.%${termoLimpo}%`,
          `modelo.ilike.%${termoLimpo}%`,
          `motor.ilike.%${termoLimpo}%`,
          `observacao.ilike.%${termoLimpo}%`,
        ].join(",")
      )
      .eq("ativo", true)
      .order("prioridade", {
        ascending: true,
      })
      .order("confiabilidade", {
        ascending: false,
      })
      .limit(300);

  if (error) {
    throw error;
  }

  if (
    Array.isArray(data) &&
    data.length > 0
  ) {
    return data;
  }

  if (!codigoNormalizado) {
    return [];
  }

  const trechoCodigo =
    codigoNormalizado.slice(-5);

  const {
    data: candidatos,
    error: erroCandidatos,
  } = await supabase
    .from(tabela)
    .select("*")
    .or(
      [
        `codigo_oem.ilike.%${trechoCodigo}%`,
        `codigo_equivalente.ilike.%${trechoCodigo}%`,
      ].join(",")
    )
    .eq("ativo", true)
    .limit(500);

  if (erroCandidatos) {
    throw erroCandidatos;
  }

  return (candidatos || []).filter(
    (item) => {
      const codigoOem = String(
        item.codigo_oem || ""
      )
        .replace(/[^a-zA-Z0-9]/g, "")
        .toUpperCase();

      const codigoEquivalente =
        String(
          item.codigo_equivalente || ""
        )
          .replace(
            /[^a-zA-Z0-9]/g,
            ""
          )
          .toUpperCase();

      return (
        codigoOem.includes(
          codigoNormalizado
        ) ||
        codigoEquivalente.includes(
          codigoNormalizado
        )
      );
    }
  );
}

async function pesquisarBaseMestre(
  termo
) {
  try {
    const registrosMestre =
      await pesquisarNaTabela({
        tabela: "catalogo_mestre",
        termo,
      });

    if (registrosMestre.length > 0) {
      console.log(
        "CENTRAL DE PESQUISA UTILIZANDO: catalogo_mestre"
      );

      return registrosMestre;
    }
  } catch (error) {
    console.warn(
      "Falha ao consultar catalogo_mestre:",
      error
    );
  }

  const registrosCompatibilidade =
    await pesquisarNaTabela({
      tabela: "catalogo_pecas",
      termo,
    });

  console.log(
    "CENTRAL DE PESQUISA UTILIZANDO: catalogo_pecas"
  );

  return registrosCompatibilidade;
}

function montarItemHistorico(
  registro
) {
  return {
    codigo:
      registro.codigo_oem ||
      registro.codigo_equivalente ||
      "",

    peca:
      registro.peca ||
      "Peça automotiva",

    fabricante:
      registro.fabricante ||
      "",
  };
}

export default function CentralPesquisa({
  cardStyle,
  setScreen,
  setResultadoPesquisa = () => {},
}) {
  const [busca, setBusca] =
    useState("");

  const [resultados, setResultados] =
    useState([]);

  const [historico, setHistorico] =
    useState([]);

  const [carregando, setCarregando] =
    useState(false);

  const [pesquisou, setPesquisou] =
    useState(false);

  async function pesquisar(
    termoRecebido = busca
  ) {
    const termoBusca =
      escaparBusca(termoRecebido);

    if (!termoBusca) {
      alert(
        "Digite um código ou nome da peça."
      );

      return;
    }

    setCarregando(true);
    setPesquisou(true);
    setResultados([]);

    try {
      const encontrados =
        await pesquisarBaseMestre(
          termoBusca
        );

      setResultados(encontrados);

      if (encontrados.length > 0) {
        const itemHistorico =
          montarItemHistorico(
            encontrados[0]
          );

        setHistorico((atual) => {
          const filtrado =
            atual.filter(
              (item) =>
                item.codigo !==
                itemHistorico.codigo
            );

          return [
            itemHistorico,
            ...filtrado,
          ].slice(0, 6);
        });
      }
    } catch (error) {
      console.error(
        "Erro na Central de Pesquisa:",
        error
      );

      alert(
        error.message ||
          "Erro ao pesquisar no catálogo."
      );
    } finally {
      setCarregando(false);
    }
  }

  function abrirRecurso(
    screen,
    item
  ) {
    setResultadoPesquisa(item);
    setScreen(screen);
  }

 function abrirGeradorAnuncio(
  item
) {
  localStorage.setItem(
    "usarDadosCatalogoNoAnuncio",
    "true"
  );

  localStorage.setItem(
    "novoAnuncioTemporario",
    JSON.stringify({
      codigo:
        item.codigo_oem || "",

      oem:
        item.codigo_equivalente || "",

      titulo:
        item.titulo || "",

      descricao:
        item.descricao || "",

      preco: "",

      tipoAnuncio:
        "classico",

      pecaEncontrada: item,

      diagnostico:
        item.diagnostico || null,

      auditoria:
        item.auditoria || null,

      baseMestre:
        item.baseMestre || null,

      fotos: [],
    })
  );

  setResultadoPesquisa(item);

  setScreen("novoAnuncio");
}

  return (
    <div style={cardStyle}>
      <h1
        style={{
          color: "#67e8f9",
          marginBottom: "8px",
        }}
      >
        🔎 Central de Pesquisa PAIIA AI
      </h1>

      <p
        style={{
          color: "#cbd5e1",
          marginBottom: "24px",
        }}
      >
        Pesquise por código, peça,
        fabricante ou aplicação.
      </p>

      <div style={areaPesquisa}>
        <input
          value={busca}
          onChange={(event) =>
            setBusca(
              event.target.value
            )
          }
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !carregando
            ) {
              pesquisar();
            }
          }}
          placeholder="Ex: 0261230268, sensor MAP, Sandero..."
          style={inputPesquisa}
        />

        <button
          onClick={() => pesquisar()}
          disabled={carregando}
          style={{
            ...botaoAzul,

            opacity: carregando
              ? 0.7
              : 1,

            cursor: carregando
              ? "not-allowed"
              : "pointer",
          }}
        >
          {carregando
            ? "⏳ Pesquisando..."
            : "🔍 Pesquisar"}
        </button>
      </div>

      {!carregando &&
        pesquisou &&
        resultados.length === 0 && (
          <div style={avisoVazio}>
            Nenhum registro encontrado
            na Base Mestre PAIIA.
          </div>
        )}

{resultados.map((item, index) => {
  console.log(
    "REGISTRO CENTRAL:",
    item
  );

  return (
    <div
      key={
        item.id ||
        [
          item.codigo_oem,
          item.codigo_equivalente,
          item.modelo,
          item.motor,
          index,
        ].join("-")
      }
      style={cardResultado}
    >
      {item.imagem_processada && (
  <div
    style={{
      textAlign: "center",
      marginBottom: "15px",
    }}
  >
    <img
      src={item.imagem_processada}
      alt={item.peca}
      style={{
        width: "220px",
        maxWidth: "100%",
        borderRadius: "12px",
        background: "#fff",
        padding: "10px",
        border: "1px solid #334155",
      }}
    />
  </div>
)}
      <h3 style={tituloPeca}>
        🔩 {item.peca || "Peça automotiva"}
      </h3>
      <pre
  style={{
    marginTop: "10px",
    padding: "10px",
    background: "#020617",
    color: "#67e8f9",
    borderRadius: "8px",
    fontSize: "11px",
    overflow: "auto",
    maxHeight: "220px",
  }}
>
  {JSON.stringify(item, null, 2)}
</pre>
    <div style={gradeDados}>
      <Info
        titulo="🏷 Código OEM"
        texto={
          item.codigo_oem ||
          "Não informado"
        }
      />

      <Info
        titulo="🔄 Equivalência"
        texto={
          item.codigo_equivalente ||
          "Não informada"
        }
      />

      <Info
        titulo="🏭 Fabricante"
        texto={
          item.fabricante ||
          "Não informado"
        }
      />

      <Info
        titulo="🚘 Montadora"
        texto={
          item.montadora ||
          "Não informada"
        }
      />

      <Info
        titulo="🚗 Modelo"
        texto={
          item.modelo ||
          "Não informado"
        }
      />

      <Info
        titulo="⚙️ Motor"
        texto={
          item.motor ||
          "Não informado"
        }
      />

      <Info
        titulo="📅 Ano"
        texto={montarAno(item)}
      />

      <Info
        titulo="📚 Catálogo"
        texto={
          item.origem_catalogo ||
          "Base PAIIA"
        }
      />
    </div>

    {item.observacao && (
      <div style={observacaoBox}>
        <strong>
          📝 Observação:
        </strong>{" "}
        {item.observacao}
      </div>
    )}

    {item.baseMestre?.qualidade && (
      <div
        style={{
          marginTop: "15px",
          padding: "14px",
          borderRadius: "12px",
          background: "#0f172a",
          border:
            "1px solid #2563eb",
        }}
      >
        <h4
          style={{
            margin: 0,
            color: "#67e8f9",
          }}
        >
          🧠 Inteligência PAIIA
        </h4>

        <div
          style={{
            marginTop: "10px",
            fontSize: "22px",
            fontWeight: "bold",
            color: "#22c55e",
          }}
        >
          ⭐{" "}
          {
            item.baseMestre
              .qualidade.nota
          }
          /100
        </div>

        <div
          style={{
            color: "#cbd5e1",
            marginTop: "5px",
          }}
        >
          Qualidade da Base:{" "}
          <b>
            {
              item.baseMestre
                .qualidade.nivel
            }
          </b>
        </div>
      </div>
    )}

    {item.baseMestre?.confianca && (
      <div
        style={{
          marginTop: "12px",
          padding: "12px",
          borderRadius: "10px",
          background: "#020617",
          border:
            "1px solid #334155",
        }}
      >
        <div
          style={{
            color: "#67e8f9",
            fontWeight: "bold",
          }}
        >
          🎯 Confiança da Inteligência
        </div>

        <div
          style={{
            marginTop: "8px",
            fontSize: "20px",
            fontWeight: "bold",
            color: "#22c55e",
          }}
        >
          {
            item.baseMestre
              .confianca.percentual
          }
          %
        </div>

        <div
          style={{
            color: "#cbd5e1",
          }}
        >
          Nível:{" "}
          <b>
            {
              item.baseMestre
                .confianca.nivel
            }
          </b>
        </div>
      </div>
    )}

    {item.baseMestre?.fontes?.length >
      0 && (
      <div
        style={{
          marginTop: "12px",
          padding: "12px",
          borderRadius: "10px",
          background: "#020617",
          border:
            "1px solid #334155",
        }}
      >
        <div
          style={{
            color: "#67e8f9",
            fontWeight: "bold",
            marginBottom: "8px",
          }}
        >
          📚 Fontes Consultadas
        </div>

        {item.baseMestre.fontes.map(
          (fonte, indiceFonte) => (
            <div
              key={`${fonte}-${indiceFonte}`}
              style={{
                color: "#cbd5e1",
                marginBottom: "4px",
              }}
            >
              • {fonte}
            </div>
          )
        )}
      </div>
    )}
{item.baseMestre?.insights?.length > 0 && (
  <div
    style={{
      marginTop: "12px",
      padding: "12px",
      borderRadius: "10px",
      background: "#020617",
      border: "1px solid #334155",
    }}
  >
    <div
      style={{
        color: "#67e8f9",
        fontWeight: "bold",
        marginBottom: "8px",
      }}
    >
      💡 Insights PAIIA
    </div>

    {item.baseMestre.insights.map(
      (insight, indiceInsight) => (
        <div
          key={indiceInsight}
          style={{
            color: "#cbd5e1",
            marginBottom: "6px",
          }}
        >
          • {insight}
        </div>
      )
    )}
  </div>
)}
{item.baseMestre && (
  <div
    style={{
      marginTop: "12px",
      padding: "12px",
      borderRadius: "10px",
      background: "#020617",
      border: "1px solid #334155",
      display: "grid",
      gridTemplateColumns:
        "repeat(auto-fit, minmax(180px, 1fr))",
      gap: "10px",
    }}
  >
    <Info
      titulo="🚗 Aplicações"
      texto={
        String(
          item.baseMestre.aplicacoes
            ?.length || 0
        )
      }
    />

    <Info
      titulo="🔄 Equivalências"
      texto={
        String(
          item.baseMestre.equivalentes
            ?.length || 0
        )
      }
    />

    <Info
      titulo="🏭 Montadoras"
      texto={
        String(
          item.baseMestre.montadoras
            ?.length || 0
        )
      }
    />

    <Info
      titulo="📚 Fontes"
      texto={
        String(
          item.baseMestre.fontes
            ?.length || 0
        )
      }
    />
  </div>
)}
    <div style={areaBotoes}>
      <button
        onClick={() =>
          abrirRecurso(
            "foto",
            item
          )
        }
        style={botaoAzul}
      >
        📸 Foto IA
      </button>

      <button
        onClick={() =>
          abrirRecurso(
            "banner",
            item
          )
        }
        style={botaoRoxo}
      >
        🎨 Banner
      </button>

      <button
        onClick={() =>
          abrirRecurso(
            "clip",
            item
          )
        }
        style={botaoLaranja}
      >
        🎬 Clip
      </button>

      <button
        onClick={() =>
          abrirGeradorAnuncio(
            item
          )
        }
        style={botaoVerde}
      >
        📝 Gerar Anúncio
      </button>
     </div>
  </div>
  );
})}

      {historico.length > 0 && (
        <div style={historicoBox}>
          <h3
            style={{
              color: "#67e8f9",
              marginTop: 0,
            }}
          >
            🕘 Pesquisas recentes
          </h3>

          <div style={historicoLista}>
            {historico.map(
              (item, index) => (
                <button
                  key={`${item.codigo}-${index}`}
                  onClick={() => {
                    setBusca(
                      item.codigo
                    );

                    pesquisar(
                      item.codigo
                    );
                  }}
                  style={botaoHistorico}
                >
                  {item.codigo ||
                    item.peca}
                </button>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function montarAno(item) {
  const inicio =
    item.ano_inicio || "";

  const fim =
    item.ano_fim || "";

  if (inicio && fim) {
    return `${inicio} até ${fim}`;
  }

  if (inicio) {
    return `A partir de ${inicio}`;
  }

  if (fim) {
    return `Até ${fim}`;
  }

  return "Não informado";
}

function Info({
  titulo,
  texto,
}) {
  return (
    <div style={infoBox}>
      <p style={infoTitulo}>
        {titulo}
      </p>

      <p style={infoTexto}>
        {texto}
      </p>
    </div>
  );
}

const areaPesquisa = {
  display: "flex",
  gap: "10px",
  marginBottom: "25px",
  flexWrap: "wrap",
};

const inputPesquisa = {
  flex: 1,
  minWidth: "280px",
  padding: "14px",
  borderRadius: "12px",
  border: "1px solid #334155",
  background: "#020617",
  color: "white",
  fontSize: "16px",
};

const cardResultado = {
  background: "#020617",
  padding: "22px",
  borderRadius: "16px",
  marginTop: "20px",
  color: "white",
  border: "1px solid #334155",
};

const tituloPeca = {
  color: "#67e8f9",
  marginTop: 0,
  marginBottom: "20px",
};

const gradeDados = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "12px",
};

const infoBox = {
  padding: "12px",
  borderRadius: "10px",
  background: "#0f172a",
  border: "1px solid #1e293b",
};

const infoTitulo = {
  color: "#67e8f9",
  fontWeight: "bold",
  margin: "0 0 6px",
};

const infoTexto = {
  color: "white",
  lineHeight: "1.5",
  margin: 0,
};

const observacaoBox = {
  marginTop: "15px",
  padding: "14px",
  borderRadius: "10px",
  background: "#0f172a",
  color: "#cbd5e1",
};

const areaBotoes = {
  display: "flex",
  flexWrap: "wrap",
  gap: "12px",
  marginTop: "20px",
};

const botaoAzul = {
  padding: "12px 16px",
  borderRadius: "10px",
  border: "none",
  background: "#2563eb",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
};

const botaoVerde = {
  ...botaoAzul,
  background: "#16a34a",
};

const botaoRoxo = {
  ...botaoAzul,
  background: "#7c3aed",
};

const botaoLaranja = {
  ...botaoAzul,
  background: "#ea580c",
};

const avisoVazio = {
  padding: "18px",
  borderRadius: "12px",
  background: "#0f172a",
  border: "1px solid #334155",
  color: "#cbd5e1",
  textAlign: "center",
};

const historicoBox = {
  marginTop: "25px",
  padding: "20px",
  borderRadius: "16px",
  background: "#0f172a",
  border: "1px solid #334155",
};

const historicoLista = {
  display: "flex",
  flexWrap: "wrap",
  gap: "10px",
};

const botaoHistorico = {
  padding: "10px 14px",
  borderRadius: "10px",
  border: "1px solid #475569",
  background: "#1e293b",
  color: "white",
  cursor: "pointer",
};