import { useMemo, useState } from "react";
import Button from "./ui/Button";

import {
  motorPrecificacao,
  motorMercado,
  motorEstrategia,
  motorAlertas,
  motorConcorrencia,
  motorRecomendacao,
} from "../services/precificacao";

function numero(valor) {
  const normalizado = String(valor ?? "")
    .replace(/\./g, "")
    .replace(",", ".")
    .trim();

  const convertido = Number(normalizado);

  return Number.isFinite(convertido)
    ? convertido
    : 0;
}
function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default function CentralPrecificacao({
  cardStyle,
  setScreen,
  codigoInicial = "",
  descricaoInicial = "",
  custoInicial = "",
  precoAtual = "",
  onUsarPreco,
}) {
  let dadosSalvos = {};

  try {
    dadosSalvos = JSON.parse(
      localStorage.getItem(
        "dadosPrecificacaoAppia"
      ) || "{}"
    );
  } catch {
    dadosSalvos = {};
  }

  const [codigo, setCodigo] = useState(
    codigoInicial ||
      dadosSalvos.codigo ||
      ""
  );

  const [descricao, setDescricao] = useState(
    descricaoInicial ||
      dadosSalvos.descricao ||
      ""
  );

  const [custo, setCusto] = useState(
    custoInicial ||
      dadosSalvos.custo ||
      ""
  );
  const [quantidade, setQuantidade] = useState("1");
  const [frete, setFrete] = useState("");
  const [embalagem, setEmbalagem] = useState("");
  const [outrosCustos, setOutrosCustos] = useState("");
  const [lucroDesejado, setLucroDesejado] = useState("35");
  const [meuPreco, setMeuPreco] = useState(
    precoAtual ||
      dadosSalvos.precoAtual ||
      ""
  );
  const [analisandoMercado, setAnalisandoMercado] = useState(false);
  const [mercadoAnalisado, setMercadoAnalisado] = useState(false);
  const [statusAnalise, setStatusAnalise] = useState(
    "Informe seus custos para iniciar a análise."
  );

  const [resultadoMercado, setResultadoMercado] =
    useState(null);

  const [estrategias, setEstrategias] =
    useState([]);

  const [alertas, setAlertas] =
    useState([]);

  const [
    analiseConcorrencia,
    setAnaliseConcorrencia,
  ] = useState(null);

  const [
    recomendacao,
    setRecomendacao,
  ] = useState(null);

  const analiseFinanceira = useMemo(() => {
    return motorPrecificacao({
      custoProduto: custo,
      frete,
      embalagem,
      outrosCustos,
      comissaoPercentual: 16,
      impostoPercentual: 0,
      margemDesejadaPercentual:
        lucroDesejado,
      taxaFixa: 0,
    });
  }, [
    custo,
    frete,
    embalagem,
    outrosCustos,
    lucroDesejado,
  ]);

  const custoTotal =
    analiseFinanceira?.custos?.total ||
    0;

  const precoBase =
    analiseFinanceira
      ?.resultado
      ?.precoRecomendado ||
    0;

  const precoMinimo =
    analiseFinanceira
      ?.resultado
      ?.precoMinimo ||
    0;

  const precoVendaSugerido =
  precoBase > 0
    ? precoBase.toFixed(2).replace(".", ",")
    : "";

  const precoEscolhido =
    numero(meuPreco) ||
    precoBase;

  const lucroEstimado = useMemo(() => {
    if (precoEscolhido <= 0) {
      return 0;
    }

    const comissao =
      precoEscolhido * 0.16;

    return Math.max(
      0,
      precoEscolhido -
        custoTotal -
        comissao
    );
  }, [
    precoEscolhido,
    custoTotal,
  ]);

  const margemEstimada = useMemo(() => {
    if (precoEscolhido <= 0) {
      return 0;
    }

    return (
      (lucroEstimado /
        precoEscolhido) *
      100
    );
  }, [
    precoEscolhido,
    lucroEstimado,
  ]);

  async function analisarMercado() {
    if (custoTotal <= 0) {
      setStatusAnalise(
        "Informe primeiro o custo do produto."
      );
      return;
    }

    setAnalisandoMercado(true);

    setStatusAnalise(
      "Analisando custos, margem e estrutura de mercado..."
    );

    try {
      const mercado =
        await motorMercado({
          codigo,
          descricao,
          shopee: {
            precos: [],
            concorrentes: 0,
          },
          amazon: {
            precos: [],
            concorrentes: 0,
          },
        });

      setResultadoMercado(
        mercado
      );

      setMercadoAnalisado(
        true
      );

      const estrategiasGeradas =
        motorEstrategia({
          precoRecomendado:
            precoBase,
          precoMercado:
            mercado?.resumo
              ?.precoMedio ||
            0,
        });

      setEstrategias(
        estrategiasGeradas
          ?.opcoes ||
        []
      );

      const alertasGerados =
        motorAlertas({
          precoAtual:
            precoEscolhido,
          precoMinimo,
          precoMercado:
            mercado?.resumo
              ?.precoMedio ||
            0,
          margemPercentual:
            margemEstimada,
          concorrentes:
            mercado?.resumo
              ?.concorrentes ||
            0,
        });

      setAlertas(
        alertasGerados
      );

      const concorrenciaGerada =
        motorConcorrencia({
          precoUsuario:
            precoEscolhido,
          precoMedio:
            mercado?.resumo
              ?.precoMedio ||
            0,
          menorPreco:
            mercado?.resumo
              ?.menorPreco ||
            0,
          maiorPreco:
            mercado?.resumo
              ?.maiorPreco ||
            0,
          concorrentes:
            mercado?.resumo
              ?.concorrentes ||
            0,
        });

      setAnaliseConcorrencia(
        concorrenciaGerada
      );

      setRecomendacao(
        motorRecomendacao({
          precoRecomendado:
            precoBase,
          precoMercado:
            mercado?.resumo
              ?.precoMedio ||
            0,
          concorrentes:
            mercado?.resumo
              ?.concorrentes ||
            0,
          margem:
            margemEstimada,
          competitividade:
            concorrenciaGerada
              ?.usuario
              ?.competitividade ||
            0,
        })
      );

      setStatusAnalise(
        mercado?.resumo
          ?.possuiDados
          ? "✅ Mercado Livre analisado. Preços, concorrência e estratégias atualizados."
          : "⚠ Não encontrei dados válidos para este código no Mercado Livre."
      );
    } catch (erro) {
      console.error(
        "Erro na análise de precificação:",
        erro
      );

      setStatusAnalise(
        "Não foi possível concluir a análise."
      );
    } finally {
      setAnalisandoMercado(
        false
      );
    }
  }

  function atualizarAnalise() {
    if (custoTotal <= 0) {
      setStatusAnalise(
        "Informe pelo menos o custo do produto."
      );
      return;
    }

    const precoMercado =
      resultadoMercado
        ?.resumo
        ?.precoMedio ||
      0;

    const estrategiasGeradas =
      motorEstrategia({
        precoRecomendado:
          precoBase,
        precoMercado,
      });

    setEstrategias(
      estrategiasGeradas
        ?.opcoes ||
      []
    );

    setAlertas(
      motorAlertas({
        precoAtual:
          precoEscolhido,
        precoMinimo,
        precoMercado,
        margemPercentual:
          margemEstimada,
        concorrentes:
          resultadoMercado
            ?.resumo
            ?.concorrentes ||
          0,
      })
    );

    const concorrenciaAtualizada =
      motorConcorrencia({
        precoUsuario:
          precoEscolhido,
        precoMedio:
          precoMercado,
        menorPreco:
          resultadoMercado
            ?.resumo
            ?.menorPreco ||
          0,
        maiorPreco:
          resultadoMercado
            ?.resumo
            ?.maiorPreco ||
          0,
        concorrentes:
          resultadoMercado
            ?.resumo
            ?.concorrentes ||
          0,
      });

    setAnaliseConcorrencia(
      concorrenciaAtualizada
    );

    setRecomendacao(
      motorRecomendacao({
        precoRecomendado:
          precoBase,
        precoMercado,
        concorrentes:
          resultadoMercado
            ?.resumo
            ?.concorrentes ||
          0,
        margem:
          margemEstimada,
        competitividade:
          concorrenciaAtualizada
            ?.usuario
            ?.competitividade ||
          0,
      })
    );

    setStatusAnalise(
      "Análise atualizada com seus custos, margem e estratégia."
    );
  }

 function usarPreco() {
  const precoFinal =
    precoBase > 0
      ? precoBase
      : numero(meuPreco);

  if (precoFinal <= 0) {
    alert(
      "Informe o custo e gere um preço recomendado primeiro."
    );
    return;
  }

  const dadosAtualizados = {
    ...dadosSalvos,

    codigo,
    descricao,

    custo: String(custo || ""),

    precoAtual:
      String(precoFinal),

    custoTotal,
    precoMinimo,

    precoRecomendado:
      precoBase,

    lucroEstimado,
    margemEstimada,
  };

  localStorage.setItem(
    "precoSugeridoAppia",
    String(precoFinal)
  );

  localStorage.setItem(
    "dadosPrecificacaoAppia",
    JSON.stringify(
      dadosAtualizados
    )
  );

  if (
    typeof onUsarPreco ===
    "function"
  ) {
    onUsarPreco(
      precoFinal,
      dadosAtualizados
    );
  }

  alert(
    `✅ Preço ${formatarMoeda(
      precoFinal
    )} aplicado ao anúncio.`
  );

  setScreen?.(
    "novoAnuncio"
  );
}

  const estiloPrincipal = {
    ...cardStyle,
    background: "#020617",
    border: "1px solid #1e293b",
    borderRadius: "18px",
  };

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "1180px",
        margin: "30px auto 0",
      }}
    >
      <section
        style={{
          ...estiloPrincipal,
          padding: "28px",
          textAlign: "center",
          background: "linear-gradient(135deg,#020617,#0f172a)",
        }}
      >
        <div style={{ fontSize: "46px" }}>💰</div>

        <h2
          style={{
            color: "#67e8f9",
            fontSize: "32px",
            margin: "8px 0 6px 0",
          }}
        >
          Central de Precificação
        </h2>

        <p
          style={{
            color: "#94a3b8",
            margin: 0,
            fontSize: "15px",
          }}
        >
          O copiloto inteligente para definir o melhor preço.
        </p>

        {(codigo || descricao) && (
          <div
            style={{
              margin:
                "16px auto 0",
              maxWidth: "760px",
              padding: "12px 16px",
              borderRadius: "12px",
              background:
                "rgba(37,99,235,.12)",
              border:
                "1px solid #2563eb",
              color: "#bfdbfe",
              fontSize: "13px",
              lineHeight: 1.5,
            }}
          >
            ✅ Dados recebidos do anúncio atual.
            Agora informe seu custo e faça a análise.
          </div>
        )}
      </section>

      <div style={gradePrincipal}>
        <section style={blocoStyle}>
          <h3 style={tituloBloco}>📦 Dados do Produto</h3>

          <Campo
            label="Código"
            value={codigo}
            onChange={setCodigo}
            placeholder="Ex.: 0261230268"
          />

          <div style={{ height: "12px" }} />

          <Campo
            label="Descrição"
            value={descricao}
            onChange={setDescricao}
            placeholder="Ex.: Sensor MAP Bosch"
          />

          <div style={{ height: "12px" }} />

          <div style={gradeDois}>
            <Campo
              label="Custo da peça"
              value={custo}
              onChange={setCusto}
              placeholder="0,00"
              prefixo="R$"
            />

            <Campo
              label="Quantidade"
              value={quantidade}
              onChange={setQuantidade}
              placeholder="1"
            />
          </div>
        </section>

        <section style={blocoStyle}>
          <h3 style={tituloBloco}>🧮 Custos e Margem</h3>

          <div style={gradeDois}>
            <Campo
              label="Frete"
              value={frete}
              onChange={setFrete}
              placeholder="0,00"
              prefixo="R$"
            />

            <Campo
              label="Embalagem"
              value={embalagem}
              onChange={setEmbalagem}
              placeholder="0,00"
              prefixo="R$"
            />

            <Campo
              label="Outros custos"
              value={outrosCustos}
              onChange={setOutrosCustos}
              placeholder="0,00"
              prefixo="R$"
            />

            <Campo
              label="Lucro desejado"
              value={lucroDesejado}
              onChange={setLucroDesejado}
              placeholder="35"
              sufixo="%"
            />
          </div>

          <div style={resumoCustos}>
            <span>Custo total informado</span>
            <strong>{formatarMoeda(custoTotal)}</strong>
          </div>
        </section>
      </div>

      <section style={blocoStyle}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "12px",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <h3 style={{ ...tituloBloco, marginBottom: 0 }}>
            📈 Análise de Mercado
          </h3>

          <button
            type="button"
            onClick={analisarMercado}
            disabled={analisandoMercado}
            style={botaoAnalisar}
          >
            {analisandoMercado ? "⏳ Analisando..." : "🔎 Analisar Mercado"}
          </button>
        </div>

        <div style={gradeMercado}>
          <CardMercado
            icone="🟡"
            nome="Mercado Livre"
            analisado={mercadoAnalisado}
            dados={
              resultadoMercado
                ?.canais
                ?.mercadoLivre
            }
          />

          <CardMercado
            icone="🟠"
            nome="Shopee"
            analisado={mercadoAnalisado}
            dados={
              resultadoMercado
                ?.canais
                ?.shopee
            }
          />

          <CardMercado
            icone="🔵"
            nome="Amazon"
            analisado={mercadoAnalisado}
            dados={
              resultadoMercado
                ?.canais
                ?.amazon
            }
          />
        </div>
      </section>

      <section style={blocoDestaque}>
        <div style={{ fontSize: "42px" }}>🤖</div>

        <h3
          style={{
            color: "#ffffff",
            margin: "8px 0 6px 0",
          }}
        >
          Paizinho APPIA
        </h3>

        <p
          style={{
            color: "#bfdbfe",
            margin: 0,
            lineHeight: 1.6,
          }}
        >
          {statusAnalise}
        </p>
      </section>

      <section style={blocoStyle}>
        <h3 style={tituloBloco}>💡 Resultado da Análise</h3>

        <div style={gradeResultados}>
          <Resultado
            label="Preço mínimo"
            valor={
              precoMinimo > 0
                ? formatarMoeda(
                    precoMinimo
                  )
                : "—"
            }
          />

          <Resultado
            label="Preço recomendado"
            destaque
            valor={precoBase > 0 ? formatarMoeda(precoBase) : "—"}
          />

          <Resultado
            label="Lucro estimado"
            valor={custoTotal > 0 ? formatarMoeda(lucroEstimado) : "—"}
          />

          <Resultado
            label="Margem estimada"
            valor={
              custoTotal > 0
                ? `${margemEstimada.toFixed(1)}%`
                : "—"
            }
          />
        </div>

        <div
          style={{
            marginTop: "20px",
            maxWidth: "420px",
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          <Campo
  label="Custo da mercadoria"
  value={custo}
  onChange={setCusto}
  placeholder="0,00"
  prefixo="R$"
/>
        </div>
      </section>

      {analiseConcorrencia && (
        <section style={blocoStyle}>
          <h3 style={tituloBloco}>
            📊 Concorrência e Competitividade
          </h3>

          <div style={gradeConcorrencia}>
            <Resultado
              label="Nível de concorrência"
              valor={
                analiseConcorrencia
                  .nivelConcorrencia ===
                "baixa"
                  ? "🟢 Baixa"
                  : analiseConcorrencia
                        .nivelConcorrencia ===
                      "media"
                    ? "🟡 Média"
                    : analiseConcorrencia
                          .nivelConcorrencia ===
                        "alta"
                      ? "🔴 Alta"
                      : "Aguardando dados"
              }
            />

            <Resultado
              label="Concorrentes"
              valor={
                analiseConcorrencia
                  .concorrentes > 0
                  ? String(
                      analiseConcorrencia
                        .concorrentes
                    )
                  : "—"
              }
            />

            <Resultado
              label="Diferença para média"
              valor={
                analiseConcorrencia
                  .mercado
                  .precoMedio > 0
                  ? `${analiseConcorrencia.usuario.diferencaMercadoPercentual.toFixed(
                      1
                    )}%`
                  : "—"
              }
            />

            <Resultado
              label="Competitividade"
              destaque
              valor={
                analiseConcorrencia
                  .usuario
                  .competitividade > 0
                  ? "★".repeat(
                      analiseConcorrencia
                        .usuario
                        .competitividade
                    )
                  : "—"
              }
            />
          </div>

          <div style={oportunidadeStyle}>
            <strong
              style={{
                color: "#ffffff",
              }}
            >
              💡 Oportunidade APPIA
            </strong>

            <span
              style={{
                color: "#cbd5e1",
                fontSize: "13px",
                lineHeight: 1.5,
              }}
            >
              {analiseConcorrencia
                .oportunidade ===
              "aumentar_margem"
                ? "Seu preço está bem abaixo da média. Pode existir espaço para aumentar a margem."
                : analiseConcorrencia
                      .oportunidade ===
                    "revisar_preco"
                  ? "Seu preço está acima da média. Vale revisar a estratégia antes de publicar."
                  : analiseConcorrencia
                        .oportunidade ===
                      "preco_competitivo"
                    ? "Seu preço está em uma faixa competitiva."
                    : "Aguardando dados reais de mercado para identificar oportunidades."}
            </span>
          </div>
        </section>
      )}

      {(estrategias.length > 0 ||
        alertas.length > 0) && (
        <section style={blocoStyle}>
          {estrategias.length > 0 && (
            <>
              <h3 style={tituloBloco}>
                🚀 Estratégias APPIA
              </h3>

              <div style={gradeEstrategias}>
                {estrategias.map(
                  (item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        setMeuPreco(
                          String(
                            item.preco
                          )
                        )
                      }
                      style={
                        cardEstrategia
                      }
                    >
                      <strong
                        style={{
                          color:
                            "#ffffff",
                          fontSize:
                            "16px",
                        }}
                      >
                        {item.titulo}
                      </strong>

                      <span
                        style={{
                          color:
                            "#67e8f9",
                          fontSize:
                            "22px",
                          fontWeight:
                            "bold",
                        }}
                      >
                        {formatarMoeda(
                          item.preco
                        )}
                      </span>

                      <span
                        style={{
                          color:
                            "#94a3b8",
                          fontSize:
                            "11px",
                          lineHeight:
                            1.4,
                        }}
                      >
                        {item.descricao}
                      </span>
                    </button>
                  )
                )}
              </div>
            </>
          )}

          {alertas.length > 0 && (
            <div
              style={{
                marginTop:
                  estrategias.length >
                  0
                    ? "22px"
                    : 0,
              }}
            >
              <h3 style={tituloBloco}>
                🧠 Alertas do Paizinho
              </h3>

              <div style={listaAlertas}>
                {alertas.map(
                  (
                    alerta,
                    index
                  ) => (
                    <div
                      key={`${alerta.titulo}-${index}`}
                      style={
                        alertaStyle
                      }
                    >
                      <strong
                        style={{
                          color:
                            "#ffffff",
                        }}
                      >
                        {alerta.titulo}
                      </strong>

                      <span
                        style={{
                          color:
                            "#cbd5e1",
                          fontSize:
                            "12px",
                          lineHeight:
                            1.5,
                        }}
                      >
                        {alerta.mensagem}
                      </span>
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {recomendacao &&
        Array.isArray(
          recomendacao.mensagens
        ) &&
        recomendacao.mensagens.length > 0 && (
          <section
            style={{
              ...blocoStyle,
              border:
                "1px solid #22c55e",
              background:
                "linear-gradient(135deg,#052e16,#0f172a)",
            }}
          >
            <h3
              style={{
                ...tituloBloco,
                color: "#86efac",
              }}
            >
              {recomendacao.titulo}
            </h3>

            <div
              style={{
                display: "grid",
                gap: "10px",
              }}
            >
              {recomendacao.mensagens.map(
                (
                  mensagem,
                  index
                ) => (
                  <div
                    key={`${mensagem}-${index}`}
                    style={{
                      padding:
                        "12px 14px",
                      borderRadius:
                        "10px",
                      background:
                        "#020617",
                      border:
                        "1px solid #334155",
                      color:
                        "#e2e8f0",
                      lineHeight: 1.5,
                    }}
                  >
                    {mensagem}
                  </div>
                )
              )}
            </div>
          </section>
        )}

      <section
        style={{
          ...blocoStyle,
          textAlign: "center",
        }}
      >
        <p
          style={{
            margin: "0 auto 22px auto",
            maxWidth: "760px",
            color: "#cbd5e1",
            fontSize: "16px",
            lineHeight: 1.7,
          }}
        >
          O melhor preço não é o menor. É aquele que mantém sua empresa
          competitiva e lucrativa.
        </p>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <Button
            type="button"
            variant="gray"
            onClick={() => setScreen?.("novoAnuncio")}
          >
            ⬅ Voltar ao Anúncio
          </Button>

          <button
  type="button"
  onClick={() => {
    if (precoBase <= 0) {
      alert(
        "Informe primeiro o custo da mercadoria."
      );
      return;
    }

    setMeuPreco(
      precoBase
        .toFixed(2)
        .replace(".", ",")
    );

    setStatusAnalise(
      "✅ Preço sugerido pelo APPIA aplicado. Você ainda pode alterá-lo antes de confirmar."
    );
  }}
  style={botaoSecundario}
>
  💰 Aplicar Preço Sugerido
</button>

          <button
            type="button"
            onClick={usarPreco}
            style={botaoPrincipal}
          >
            💰 Usar este Preço
          </button>
        </div>
      </section>
    </div>
  );
}

function Campo({
  label,
  value,
  onChange,
  placeholder,
  prefixo,
  sufixo,
}) {
  return (
    <label
      style={{
        display: "block",
        color: "#cbd5e1",
        fontSize: "12px",
        fontWeight: "bold",
      }}
    >
      <span
        style={{
          display: "block",
          marginBottom: "6px",
        }}
      >
        {label}
      </span>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          border: "1px solid #334155",
          borderRadius: "10px",
          background: "#020617",
          overflow: "hidden",
        }}
      >
        {prefixo && <span style={adicionalCampo}>{prefixo}</span>}

        <input
          value={value}
          onChange={(evento) => onChange(evento.target.value)}
          placeholder={placeholder}
          style={{
            flex: 1,
            minWidth: 0,
            padding: "11px 12px",
            border: "none",
            outline: "none",
            background: "transparent",
            color: "#ffffff",
          }}
        />

        {sufixo && <span style={adicionalCampo}>{sufixo}</span>}
      </div>
    </label>
  );
}

function CardMercado({
  icone,
  nome,
  analisado,
  dados,
}) {
  const possuiDados =
    Boolean(
      dados?.disponivel
    );

  return (
    <div style={cardMercado}>
      <div
        style={{
          fontSize: "28px",
        }}
      >
        {icone}
      </div>

      <strong
        style={{
          color: "#ffffff",
        }}
      >
        {nome}
      </strong>

      {possuiDados ? (
        <>
          <span
            style={{
              color: "#86efac",
              fontSize: "12px",
              fontWeight: "bold",
            }}
          >
            Média:{" "}
            {formatarMoeda(
              dados.precoMedio
            )}
          </span>

          <span
            style={{
              color: "#94a3b8",
              fontSize: "11px",
            }}
          >
            {dados.concorrentes || 0} concorrente(s)
          </span>
        </>
      ) : (
        <span
          style={{
            color: analisado
              ? "#facc15"
              : "#94a3b8",
            fontSize: "11px",
            textAlign: "center",
          }}
        >
          {analisado
            ? "⏳ Aguardando integração oficial"
            : "Aguardando análise"}
        </span>
      )}
    </div>
  );
}

function Resultado({ label, valor, destaque = false }) {
  return (
    <div
      style={{
        ...cardResultado,
        border: destaque
          ? "1px solid #22d3ee"
          : "1px solid #334155",
        background: destaque
          ? "#164e63"
          : "#020617",
      }}
    >
      <span
        style={{
          color: "#94a3b8",
          fontSize: "11px",
        }}
      >
        {label}
      </span>

      <strong
        style={{
          display: "block",
          color: destaque ? "#67e8f9" : "#ffffff",
          fontSize: "22px",
          marginTop: "7px",
        }}
      >
        {valor}
      </strong>
    </div>
  );
}

const gradePrincipal = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))",
  gap: "18px",
  marginTop: "20px",
};

const gradeDois = {
  display: "grid",
  gridTemplateColumns: "repeat(2,minmax(0,1fr))",
  gap: "12px",
};

const blocoStyle = {
  marginTop: "20px",
  padding: "22px",
  borderRadius: "16px",
  background: "#0f172a",
  border: "1px solid #1e293b",
};

const blocoDestaque = {
  marginTop: "20px",
  padding: "22px",
  borderRadius: "16px",
  textAlign: "center",
  border: "1px solid #2563eb",
  background: "linear-gradient(135deg,#172554,#0f172a)",
};

const tituloBloco = {
  color: "#67e8f9",
  marginTop: 0,
  marginBottom: "16px",
};

const resumoCustos = {
  display: "flex",
  justifyContent: "space-between",
  gap: "15px",
  marginTop: "16px",
  padding: "13px",
  borderRadius: "10px",
  background: "#020617",
  color: "#cbd5e1",
};

const gradeMercado = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
  gap: "12px",
  marginTop: "18px",
};

const cardMercado = {
  minHeight: "125px",
  padding: "16px",
  borderRadius: "13px",
  background: "#020617",
  border: "1px solid #334155",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
};

const gradeResultados = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))",
  gap: "12px",
};

const gradeConcorrencia = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(180px,1fr))",
  gap: "12px",
};

const oportunidadeStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "7px",
  marginTop: "16px",
  padding: "14px",
  borderRadius: "12px",
  border: "1px solid #2563eb",
  background:
    "linear-gradient(135deg,#172554,#0f172a)",
};

const gradeEstrategias = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(210px,1fr))",
  gap: "12px",
};

const cardEstrategia = {
  display: "flex",
  flexDirection: "column",
  gap: "9px",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "150px",
  padding: "16px",
  borderRadius: "14px",
  border: "1px solid #334155",
  background:
    "linear-gradient(145deg,#0f172a,#020617)",
  cursor: "pointer",
};

const listaAlertas = {
  display: "grid",
  gap: "10px",
};

const alertaStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  padding: "13px 14px",
  borderRadius: "12px",
  border: "1px solid #334155",
  background: "#020617",
};

const cardResultado = {
  padding: "18px",
  borderRadius: "13px",
  textAlign: "center",
};

const adicionalCampo = {
  padding: "0 10px",
  color: "#94a3b8",
  fontSize: "12px",
  fontWeight: "bold",
};

const botaoAnalisar = {
  padding: "11px 18px",
  borderRadius: "10px",
  border: "1px solid #38bdf8",
  background: "#082f49",
  color: "#bae6fd",
  cursor: "pointer",
  fontWeight: "bold",
};

const botaoSecundario = {
  padding: "13px 20px",
  borderRadius: "11px",
  border: "1px solid #475569",
  background: "#020617",
  color: "#e2e8f0",
  cursor: "pointer",
  fontWeight: "bold",
};

const botaoPrincipal = {
  padding: "13px 22px",
  borderRadius: "11px",
  border: "none",
  background: "linear-gradient(135deg,#15803d,#22c55e)",
  color: "#ffffff",
  cursor: "pointer",
  fontWeight: "bold",
  minWidth: "200px",
};