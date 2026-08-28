import { useState } from "react";
import { preencherAnuncioAutomaticamente } from "../services/PreencherAnuncioService";
import PainelResumoCatalogo from "./PainelResumoCatalogo";
import DiagnosticoTecnicoIA from "./DiagnosticoTecnicoIA";
import FichaTecnicaIA from "./FichaTecnicaIA";
import CentroInteligenciaIA from "./CentroInteligenciaIA";

/*
 * ============================================================
 * NORMALIZAÇÃO
 * ============================================================
 */

function normalizarCodigo(valor = "") {
  return String(valor || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .trim();
}

function obterEquivalentes(item = {}) {
  const valor =
    item?.equivalentes;

  if (
    Array.isArray(valor)
  ) {
    return valor
      .map((codigo) =>
        normalizarCodigo(codigo)
      )
      .filter(Boolean);
  }

  if (
    valor &&
    typeof valor === "object"
  ) {
    return Object.values(valor)
      .flatMap((codigo) =>
        obterEquivalentes({
          equivalentes: codigo,
        })
      )
      .filter(Boolean);
  }

  const texto =
    String(valor || "").trim();

  if (!texto) {
    return [];
  }

  return texto
    .split(/[,;|/\s]+/)
    .map((codigo) =>
      normalizarCodigo(codigo)
    )
    .filter(Boolean);
}

/*
 * ============================================================
 * PONTUAÇÃO DA PESQUISA
 * ============================================================
 */

function calcularPontuacaoResultado(
  item,
  termoPesquisa
) {
  let pontos = 0;

  const termoNormalizado =
    normalizarCodigo(
      termoPesquisa
    );

  const codigoOem =
    normalizarCodigo(
      item.codigo_oem
    );

  const codigoEquivalente =
    normalizarCodigo(
      item.codigo_equivalente
    );

  const equivalentes =
    obterEquivalentes(item);

  const peca =
    String(
      item.peca || ""
    ).toLowerCase();

  const fabricante =
    String(
      item.fabricante || ""
    ).toLowerCase();

  const montadora =
    String(
      item.montadora || ""
    ).toLowerCase();

  const modelo =
    String(
      item.modelo || ""
    ).toLowerCase();

  const motor =
    String(
      item.motor || ""
    ).toLowerCase();

  const origem =
    String(
      item.origem_catalogo || ""
    ).toLowerCase();

  const termoTexto =
    String(
      termoPesquisa || ""
    ).toLowerCase();

  /*
   * ========================================================
   * PRIORIDADE ABSOLUTA POR CÓDIGO
   * ========================================================
   */

  if (
    codigoOem &&
    codigoOem === termoNormalizado
  ) {
    pontos += 10000;
  }

  if (
    codigoEquivalente &&
    codigoEquivalente ===
      termoNormalizado
  ) {
    pontos += 9000;
  }

  if (
    equivalentes.includes(
      termoNormalizado
    )
  ) {
    pontos += 8000;
  }

  /*
   * Código parcial
   */

  if (
    codigoOem &&
    codigoOem.includes(
      termoNormalizado
    )
  ) {
    pontos += 1000;
  }

  if (
    codigoEquivalente &&
    codigoEquivalente.includes(
      termoNormalizado
    )
  ) {
    pontos += 900;
  }

  if (
    equivalentes.some(
      (codigo) =>
        codigo.includes(
          termoNormalizado
        )
    )
  ) {
    pontos += 800;
  }

  /*
   * ========================================================
   * CAMPOS TEXTUAIS
   * ========================================================
   */

  if (
    peca === termoTexto
  ) {
    pontos += 300;
  }

  if (
    modelo === termoTexto
  ) {
    pontos += 250;
  }

  if (
    fabricante === termoTexto
  ) {
    pontos += 220;
  }

  if (
    montadora === termoTexto
  ) {
    pontos += 220;
  }

  if (
    peca.includes(
      termoTexto
    )
  ) {
    pontos += 150;
  }

  if (
    modelo.includes(
      termoTexto
    )
  ) {
    pontos += 120;
  }

  if (
    motor.includes(
      termoTexto
    )
  ) {
    pontos += 100;
  }

  if (
    origem.includes(
      termoTexto
    )
  ) {
    pontos += 80;
  }

  return pontos;
}

/*
 * ============================================================
 * TIPO DE CORRESPONDÊNCIA
 * ============================================================
 */

function identificarCorrespondencia(
  item,
  termoPesquisa
) {
  const termo =
    normalizarCodigo(
      termoPesquisa
    );

  if (!termo) {
    return "";
  }

  const codigoOem =
    normalizarCodigo(
      item.codigo_oem
    );

  const codigoEquivalente =
    normalizarCodigo(
      item.codigo_equivalente
    );

  const equivalentes =
    obterEquivalentes(item);

  if (
    codigoOem === termo
  ) {
    return "Código principal";
  }

  if (
    codigoEquivalente === termo
  ) {
    return "Código equivalente";
  }

  if (
    equivalentes.includes(
      termo
    )
  ) {
    return "Encontrado em equivalências";
  }

  return "";
}

/*
 * ============================================================
 * AGRUPAMENTO
 * ============================================================
 */

function agruparResultados(
  resultados = []
) {
  const mapa =
    new Map();

  for (
    const resultado
    of resultados
  ) {
    const peca =
      String(
        resultado.peca ||
          "Peça não informada"
      ).trim();

    const origem =
      String(
        resultado.origem_catalogo ||
          "Base APPIA"
      ).trim();

    const chave =
      `${peca}|||${origem}`;

    if (
      !mapa.has(chave)
    ) {
      mapa.set(
        chave,
        {
          chave,
          peca,
          origem,
          resultados: [],
        }
      );
    }

    mapa
      .get(chave)
      .resultados.push(
        resultado
      );
  }

  return Array.from(
    mapa.values()
  );
}

export default function BuscaCatalogo({
  setScreen,
  cardStyle,
}) {
  const catalogoSelecionado =
    localStorage.getItem(
      "catalogoSelecionado"
    ) || "";

  const [
    termo,
    setTermo,
  ] =
    useState("");

  const [
    resultados,
    setResultados,
  ] =
    useState([]);

  const [
    carregando,
    setCarregando,
  ] =
    useState(false);

  const [
    pesquisou,
    setPesquisou,
  ] =
    useState(false);

  const [
    progresso,
    setProgresso,
  ] =
    useState("");

  const [
    modoPesquisa,
    setModoPesquisa,
  ] =
    useState("todos");

  /*
   * ==========================================================
   * PESQUISAR
   * ==========================================================
   */

  async function pesquisar() {
    const termoBusca =
      String(
        termo || ""
      ).trim();

    if (!termoBusca) {
      alert(
        "Digite um código para pesquisar."
      );

      return;
    }

    setCarregando(true);
    setPesquisou(true);
    setResultados([]);

    setProgresso(
      "🔎 Consultando a base APPIA..."
    );

    try {
      const resposta =
        await preencherAnuncioAutomaticamente({
          termo:
            termoBusca,

          codigo:
            termoBusca,

          oem:
            termoBusca,

          onProgresso: (
            percentual,
            mensagem
          ) => {
            setProgresso(
              `${percentual}% — ${mensagem}`
            );
          },
        });

      const encontradosRecebidos =
        Array.isArray(
          resposta?.resultadosCatalogo
        )
          ? resposta.resultadosCatalogo
          : [];

      /*
       * ======================================================
       * FILTRO DE CATÁLOGO
       * ======================================================
       */

      const encontrados =
        modoPesquisa ===
          "selecionado" &&
        catalogoSelecionado
          ? encontradosRecebidos.filter(
              (item) => {
                const textoFabricante =
                  String(
                    item.fabricante ||
                      ""
                  ).toLowerCase();

                const textoOrigem =
                  String(
                    item.origem_catalogo ||
                      ""
                  ).toLowerCase();

                const catalogo =
                  catalogoSelecionado.toLowerCase();

                return (
                  textoFabricante.includes(
                    catalogo
                  ) ||
                  textoOrigem.includes(
                    catalogo
                  )
                );
              }
            )
          : encontradosRecebidos;

      /*
       * ======================================================
       * ORDENAÇÃO INTELIGENTE
       * ======================================================
       */

      const encontradosOrdenados =
        [...encontrados].sort(
          (a, b) => {
            const pontosA =
              calcularPontuacaoResultado(
                a,
                termoBusca
              );

            const pontosB =
              calcularPontuacaoResultado(
                b,
                termoBusca
              );

            if (
              pontosA !== pontosB
            ) {
              return (
                pontosB -
                pontosA
              );
            }

            /*
             * Em empate:
             * Disco de Freio, Filtro,
             * Sensor etc ficam juntos.
             */

            const pecaA =
              String(
                a.peca || ""
              );

            const pecaB =
              String(
                b.peca || ""
              );

            const comparacaoPeca =
              pecaA.localeCompare(
                pecaB
              );

            if (
              comparacaoPeca !== 0
            ) {
              return comparacaoPeca;
            }

            const origemA =
              String(
                a.origem_catalogo ||
                  ""
              );

            const origemB =
              String(
                b.origem_catalogo ||
                  ""
              );

            return origemA.localeCompare(
              origemB
            );
          }
        );

      setResultados(
        encontradosOrdenados
      );

      setProgresso(
        `✅ ${encontradosOrdenados.length} resultado(s) encontrado(s).`
      );
    } catch (error) {
      console.error(
        "Erro ao pesquisar catálogo:",
        error
      );

      setResultados([]);

      setProgresso(
        error?.message ||
          "Não foi possível consultar a base APPIA."
      );
    } finally {
      setCarregando(false);
    }
  }

  /*
   * ==========================================================
   * VOLTAR
   * ==========================================================
   */

  function voltarCatalogos() {
    localStorage.removeItem(
      "catalogoSelecionado"
    );

    setScreen(
      "catalogos"
    );
  }

  /*
   * ==========================================================
   * NOVO ANÚNCIO
   * ==========================================================
   */

  function montarAnuncio(
    resultado
  ) {
    const codigo =
      resultado?.codigo_oem ||
      resultado?.codigo_equivalente ||
      termo ||
      "";

    localStorage.setItem(
      "codigoNovoAnuncio",
      String(codigo)
    );

    setScreen(
      "novoAnuncio"
    );
  }

  /*
   * ==========================================================
   * GRUPOS
   * ==========================================================
   */

  const gruposResultados =
    agruparResultados(
      resultados
    );

  return (
    <div style={cardStyle}>
      <button
        onClick={
          voltarCatalogos
        }
        style={
          botaoVoltar
        }
      >
        ← Voltar para Catálogos
      </button>

      <div style={cabecalho}>
        <div>
          <h1 style={titulo}>
            📚 Catálogos Técnicos
          </h1>

          <p style={subtitulo}>
            Consulte códigos, aplicações e
            equivalências na base universal
            do APPIA AI.
          </p>
        </div>

        <div
          style={
            catalogoAtual
          }
        >
          {catalogoSelecionado
            ? `Catálogo: ${catalogoSelecionado}`
            : "Pesquisa Universal"}
        </div>
      </div>

      <div
        style={
          opcoesPesquisa
        }
      >
        <label
          style={
            opcaoPesquisa
          }
        >
          <input
            type="radio"
            name="modoPesquisa"
            value="todos"
            checked={
              modoPesquisa ===
              "todos"
            }
            onChange={() =>
              setModoPesquisa(
                "todos"
              )
            }
          />

          <span>
            🌐 Todos os catálogos
          </span>
        </label>

        {catalogoSelecionado && (
          <label
            style={
              opcaoPesquisa
            }
          >
            <input
              type="radio"
              name="modoPesquisa"
              value="selecionado"
              checked={
                modoPesquisa ===
                "selecionado"
              }
              onChange={() =>
                setModoPesquisa(
                  "selecionado"
                )
              }
            />

            <span>
              📘 Apenas{" "}
              {catalogoSelecionado}
            </span>
          </label>
        )}
      </div>

      <div
        style={
          painelBusca
        }
      >
        <label
          style={label}
        >
          Pesquisar em toda a base técnica do APPIA AI
        </label>

        <div
          style={
            linhaBusca
          }
        >
          <input
            value={termo}
            onChange={(
              event
            ) =>
              setTermo(
                event.target.value
              )
            }
            onKeyDown={(
              event
            ) => {
              if (
                event.key ===
                "Enter"
              ) {
                pesquisar();
              }
            }}
            placeholder="Código, OEM, equivalente, peça, montadora, modelo, motor..."
            style={input}
            disabled={
              carregando
            }
          />

          <button
            onClick={
              pesquisar
            }
            disabled={
              carregando
            }
            style={{
              ...botaoPesquisar,

              opacity:
                carregando
                  ? 0.6
                  : 1,

              cursor:
                carregando
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            {carregando
              ? "Pesquisando..."
              : "🔎 Pesquisar"}
          </button>
        </div>

        {progresso && (
          <div
            style={
              mensagemProgresso
            }
          >
            {carregando
              ? "⏳ "
              : ""}

            {progresso}
          </div>
        )}
      </div>

      <CentroInteligenciaIA
        resultados={
          resultados
        }
        termo={termo}
        onCriarAnuncio={(
          item
        ) => {
          localStorage.setItem(
            "codigoNovoAnuncio",
            item.codigo_oem ||
              item.codigo_equivalente ||
              ""
          );

          setScreen(
            "novoAnuncio"
          );
        }}
      />

      {resultados.length >
        0 && (
        <div
          style={
            resultadosContainer
          }
        >
          <div
            style={
              cabecalhoResultados
            }
          >
            <h2
              style={
                tituloResultados
              }
            >
              Resultados encontrados
            </h2>

            <span
              style={
                contador
              }
            >
              {
                resultados.length
              }
            </span>

            <span
              style={
                contadorGrupos
              }
            >
              {
                gruposResultados.length
              }{" "}
              grupo(s)
            </span>
          </div>

          <div
            style={
              gruposContainer
            }
          >
            {gruposResultados.map(
              (
                grupo,
                indiceGrupo
              ) => (
                <section
                  key={
                    grupo.chave ||
                    indiceGrupo
                  }
                  style={
                    grupoResultado
                  }
                >
                  <div
                    style={
                      grupoCabecalho
                    }
                  >
                    <div>
                      <h3
                        style={
                          grupoTitulo
                        }
                      >
                        🔧{" "}
                        {
                          grupo.peca
                        }
                      </h3>

                      <div
                        style={
                          grupoOrigem
                        }
                      >
                        📚{" "}
                        {
                          grupo.origem
                        }
                      </div>
                    </div>

                    <span
                      style={
                        grupoContador
                      }
                    >
                      {
                        grupo
                          .resultados
                          .length
                      }{" "}
                      aplicação(ões)
                    </span>
                  </div>

                  <div
                    style={
                      listaResultados
                    }
                  >
                    {grupo.resultados.map(
                      (
                        resultado,
                        index
                      ) => {
                        const codigo =
                          resultado.codigo_oem ||
                          resultado.codigo_equivalente ||
                          "Código não informado";

                        const aplicacao =
                          [
                            resultado.montadora,
                            resultado.modelo,
                            resultado.motor,
                          ]
                            .filter(
                              Boolean
                            )
                            .join(
                              " "
                            );

                        const anos =
                          resultado.ano_inicio ||
                          resultado.ano_fim
                            ? `${
                                resultado.ano_inicio ||
                                ""
                              }${
                                resultado.ano_fim
                                  ? ` até ${resultado.ano_fim}`
                                  : ""
                              }`
                            : "Não informado";

                        const tipoCorrespondencia =
                          identificarCorrespondencia(
                            resultado,
                            termo
                          );

                        const equivalentes =
                          obterEquivalentes(
                            resultado
                          );

                        return (
                          <div
                            key={
                              resultado.id ||
                              `${grupo.chave}-${codigo}-${index}`
                            }
                            style={
                              resultadoCard
                            }
                          >
                            <div
                              style={
                                resultadoTopo
                              }
                            >
                              <div>
                                <div
                                  style={
                                    chipsLinha
                                  }
                                >
                                  <span
                                    style={
                                      fabricanteChip
                                    }
                                  >
                                    {resultado.fabricante ||
                                      "Fabricante não informado"}
                                  </span>

                                  {tipoCorrespondencia && (
                                    <span
                                      style={
                                        correspondenciaChip
                                      }
                                    >
                                      ✅{" "}
                                      {
                                        tipoCorrespondencia
                                      }
                                    </span>
                                  )}
                                </div>

                                <h3
                                  style={
                                    codigoTitulo
                                  }
                                >
                                  {
                                    codigo
                                  }
                                </h3>
                              </div>

                              <span
                                style={
                                  fonteChip
                                }
                              >
                                {resultado.origem_catalogo ||
                                  "Base APPIA"}
                              </span>
                            </div>

                            <div
                              style={
                                dadosGrid
                              }
                            >
                              <CampoResultado
                                titulo="Peça"
                                valor={
                                  resultado.peca
                                }
                              />

                              <CampoResultado
                                titulo="Aplicação"
                                valor={
                                  aplicacao
                                }
                              />

                              <CampoResultado
                                titulo="Anos"
                                valor={
                                  anos
                                }
                              />

                              <CampoResultado
                                titulo="Código principal"
                                valor={
                                  resultado.codigo_oem
                                }
                              />

                              <CampoResultado
                                titulo="Código equivalente"
                                valor={
                                  resultado.codigo_equivalente
                                }
                              />

                              <CampoResultado
                                titulo="Equivalências"
                                valor={
                                  equivalentes.length >
                                  0
                                    ? equivalentes.join(
                                        ", "
                                      )
                                    : ""
                                }
                              />
                            </div>

                            {resultado.observacao && (
                              <div
                                style={
                                  observacao
                                }
                              >
                                <strong>
                                  Observação:
                                </strong>{" "}
                                {
                                  resultado.observacao
                                }
                              </div>
                            )}

                            <div
                              style={
                                acoes
                              }
                            >
                              <button
                                onClick={() =>
                                  montarAnuncio(
                                    resultado
                                  )
                                }
                                style={
                                  botaoAnuncio
                                }
                              >
                                🚀 Criar Anúncio
                              </button>
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>
                </section>
              )
            )}
          </div>
        </div>
      )}

      {pesquisou &&
        !carregando &&
        resultados.length ===
          0 && (
          <div
            style={
              vazio
            }
          >
            <div
              style={
                iconeVazio
              }
            >
              🔍
            </div>

            <h3
              style={
                tituloVazio
              }
            >
              Código não encontrado
            </h3>

            <p
              style={
                textoVazio
              }
            >
              {progresso ||
                "Nenhum catálogo importado possui registro para o código pesquisado."}
            </p>
          </div>
        )}
    </div>
  );
}

/*
 * ============================================================
 * CAMPO
 * ============================================================
 */

function CampoResultado({
  titulo,
  valor,
}) {
  if (!valor) {
    return null;
  }

  return (
    <div
      style={
        campoResultado
      }
    >
      <span
        style={
          campoTitulo
        }
      >
        {titulo}
      </span>

      <span
        style={
          campoValor
        }
      >
        {valor}
      </span>
    </div>
  );
}

/*
 * ============================================================
 * ESTILOS
 * ============================================================
 */

const cabecalho = {
  display: "flex",
  justifyContent:
    "space-between",
  alignItems:
    "flex-start",
  gap: "20px",
  flexWrap: "wrap",
  marginBottom: "24px",
};

const titulo = {
  margin: 0,
  color: "#67e8f9",
  fontSize: "32px",
};

const subtitulo = {
  color: "#94a3b8",
  marginTop: "8px",
  marginBottom: 0,
};

const catalogoAtual = {
  background: "#0f172a",
  color: "#bfdbfe",
  border:
    "1px solid #2563eb",
  borderRadius: "999px",
  padding: "10px 16px",
  fontWeight: "bold",
};

const botaoVoltar = {
  border: "none",
  background:
    "transparent",
  color: "#93c5fd",
  cursor: "pointer",
  fontSize: "15px",
  padding: 0,
  marginBottom: "20px",
};

const painelBusca = {
  background: "#020617",
  border:
    "1px solid #1e3a8a",
  borderRadius: "18px",
  padding: "22px",
};

const label = {
  display: "block",
  color: "#e2e8f0",
  fontWeight: "bold",
  marginBottom: "10px",
};

const linhaBusca = {
  display: "flex",
  gap: "12px",
  flexWrap: "wrap",
};

const input = {
  flex: 1,
  minWidth: "260px",
  padding: "14px 16px",
  borderRadius: "12px",
  border:
    "1px solid #334155",
  background: "#0f172a",
  color: "#ffffff",
  fontSize: "17px",
  outline: "none",
};

const botaoPesquisar = {
  padding: "14px 22px",
  borderRadius: "12px",
  border: "none",
  background: "#2563eb",
  color: "#ffffff",
  fontWeight: "bold",
  fontSize: "16px",
};

const mensagemProgresso = {
  marginTop: "14px",
  color: "#bfdbfe",
};

const resultadosContainer = {
  marginTop: "28px",
};

const cabecalhoResultados = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  marginBottom: "16px",
  flexWrap: "wrap",
};

const tituloResultados = {
  color: "#e2e8f0",
  margin: 0,
};

const contador = {
  background: "#2563eb",
  color: "#ffffff",
  borderRadius: "999px",
  padding: "4px 10px",
  fontWeight: "bold",
};

const contadorGrupos = {
  background: "#0f172a",
  border:
    "1px solid #334155",
  color: "#94a3b8",
  borderRadius: "999px",
  padding: "4px 10px",
  fontWeight: "bold",
};

const gruposContainer = {
  display: "grid",
  gap: "24px",
};

const grupoResultado = {
  background:
    "rgba(15, 23, 42, 0.45)",
  border:
    "1px solid #1e3a8a",
  borderRadius: "20px",
  padding: "18px",
};

const grupoCabecalho = {
  display: "flex",
  justifyContent:
    "space-between",
  alignItems: "center",
  gap: "14px",
  flexWrap: "wrap",
  paddingBottom: "14px",
  marginBottom: "16px",
  borderBottom:
    "1px solid #1e293b",
};

const grupoTitulo = {
  color: "#67e8f9",
  margin: 0,
  fontSize: "22px",
};

const grupoOrigem = {
  color: "#94a3b8",
  fontSize: "13px",
  marginTop: "6px",
};

const grupoContador = {
  background: "#172554",
  color: "#bfdbfe",
  border:
    "1px solid #1d4ed8",
  borderRadius: "999px",
  padding: "6px 12px",
  fontWeight: "bold",
  fontSize: "13px",
};

const listaResultados = {
  display: "grid",
  gap: "16px",
};

const resultadoCard = {
  background: "#020617",
  border:
    "1px solid #334155",
  borderRadius: "18px",
  padding: "20px",
};

const resultadoTopo = {
  display: "flex",
  justifyContent:
    "space-between",
  alignItems:
    "flex-start",
  gap: "15px",
  flexWrap: "wrap",
  marginBottom: "18px",
};

const chipsLinha = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
  alignItems: "center",
};

const fabricanteChip = {
  display:
    "inline-block",
  color: "#67e8f9",
  background: "#083344",
  borderRadius: "999px",
  padding: "5px 10px",
  fontSize: "13px",
  fontWeight: "bold",
};

const correspondenciaChip = {
  display:
    "inline-block",
  color: "#bbf7d0",
  background: "#052e16",
  border:
    "1px solid #166534",
  borderRadius: "999px",
  padding: "5px 10px",
  fontSize: "12px",
  fontWeight: "bold",
};

const codigoTitulo = {
  color: "#ffffff",
  fontSize: "24px",
  marginTop: "10px",
  marginBottom: 0,
};

const fonteChip = {
  color: "#bfdbfe",
  background: "#172554",
  border:
    "1px solid #1d4ed8",
  borderRadius: "10px",
  padding: "8px 12px",
  fontSize: "13px",
};

const dadosGrid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "12px",
};

const campoResultado = {
  background: "#0f172a",
  borderRadius: "12px",
  padding: "14px",
};

const campoTitulo = {
  display: "block",
  color: "#64748b",
  fontSize: "13px",
  marginBottom: "5px",
};

const campoValor = {
  color: "#e2e8f0",
  lineHeight: 1.5,
  overflowWrap:
    "anywhere",
};

const observacao = {
  marginTop: "14px",
  padding: "12px",
  borderRadius: "10px",
  background: "#172554",
  color: "#bfdbfe",
};

const acoes = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
  marginTop: "18px",
};

const botaoAnuncio = {
  border: "none",
  borderRadius: "10px",
  padding: "11px 16px",
  background: "#16a34a",
  color: "#ffffff",
  cursor: "pointer",
  fontWeight: "bold",
};

const vazio = {
  textAlign: "center",
  marginTop: "28px",
  padding: "35px 20px",
  borderRadius: "18px",
  background: "#020617",
  border:
    "1px dashed #334155",
};

const iconeVazio = {
  fontSize: "38px",
};

const tituloVazio = {
  color: "#e2e8f0",
  marginBottom: "8px",
};

const textoVazio = {
  color: "#94a3b8",
  margin: 0,
};

const opcoesPesquisa = {
  display: "flex",
  gap: "12px",
  flexWrap: "wrap",
  marginBottom: "20px",
};

const opcaoPesquisa = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "10px 14px",
  borderRadius: "12px",
  background: "#0f172a",
  border:
    "1px solid #334155",
  color: "#e2e8f0",
  cursor: "pointer",
  fontWeight: "bold",
};