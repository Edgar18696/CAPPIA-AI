import { useMemo, useState } from "react";

export default function PlanosPagamentos({
  setScreen,
  usuario,
}) {
  const [planoSelecionado, setPlanoSelecionado] =
    useState("prata");

  const [formaPagamento, setFormaPagamento] =
    useState("pix");

  const [nomeCartao, setNomeCartao] =
    useState("");

  const [numeroCartao, setNumeroCartao] =
    useState("");

  const [validadeCartao, setValidadeCartao] =
    useState("");

  const [cvvCartao, setCvvCartao] =
    useState("");

  const [parcelasCartao, setParcelasCartao] =
    useState("1");

  const [pacoteCreditoSelecionado, setPacoteCreditoSelecionado] =
    useState(null);

  const [formaPagamentoCreditos, setFormaPagamentoCreditos] =
    useState("pix");

  const [nomeBoleto, setNomeBoleto] =
    useState("");

  const [cpfCnpjBoleto, setCpfCnpjBoleto] =
    useState("");

  const [emailBoleto, setEmailBoleto] =
    useState("");

  const [tipoClienteBoleto, setTipoClienteBoleto] =
    useState("pf");

  const chavePixAppia = "43.559.865/0001-03";
  const favorecidoPixAppia =
    "Casa da Injecao Eletronica Brasil Ltda ME";

  const planos = useMemo(
    () => [
      {
        id: "prata",
        nome: "Profissional Prata",
        preco: "R$ 119,90",
        periodo: "/ mês",
        destaque: false,
        recursos: [
          "Criador Inteligente de Anúncios",
          "Foto IA",
          "Banner Studio",
          "Catálogos técnicos",
          "Consulta por Chassi",
        ],
      },
      {
        id: "ouro",
        nome: "Profissional Ouro",
        preco: "R$ 149,90",
        periodo: "/ mês",
        creditos: 60,
        destaque: true,
        recursos: [
          "Todos os recursos do Profissional Prata",
          "60 créditos de Clip IA",
          "Maior volume de processamento",
          "Prioridade de processamento",
          "Suporte prioritário",
        ],
      },
    ],
    []
  );

  const planoAtual =
    planos.find(
      (plano) =>
        plano.id === planoSelecionado
    ) || planos[0];

  function formatarNumeroCartao(valor) {
    return String(valor || "")
      .replace(/\D/g, "")
      .slice(0, 16)
      .replace(/(\d{4})(?=\d)/g, "$1 ");
  }

  function formatarValidade(valor) {
    const numeros = String(valor || "")
      .replace(/\D/g, "")
      .slice(0, 4);

    if (numeros.length <= 2) {
      return numeros;
    }

    return `${numeros.slice(0, 2)}/${numeros.slice(2)}`;
  }

  async function copiarTexto(texto, mensagem) {
    try {
      await navigator.clipboard.writeText(texto);
      alert(mensagem);
    } catch {
      alert(
        "Não foi possível copiar automaticamente. Selecione os dados e copie manualmente."
      );
    }
  }

  function finalizarCompraCreditos() {
    if (!pacoteCreditoSelecionado) {
      alert("⚠️ Selecione um pacote de créditos.");
      return;
    }

    if (formaPagamentoCreditos === "boleto") {
      const documentoLimpo =
        cpfCnpjBoleto.replace(/\D/g, "");

      const documentoValido =
        tipoClienteBoleto === "pf"
          ? documentoLimpo.length === 11
          : documentoLimpo.length === 14;

      if (
        !nomeBoleto.trim() ||
        !documentoValido ||
        !emailBoleto.trim()
      ) {
        alert(
          tipoClienteBoleto === "pf"
            ? "⚠️ Preencha nome, CPF e e-mail para emissão do boleto."
            : "⚠️ Preencha razão social, CNPJ e e-mail para emissão do boleto."
        );
        return;
      }
    }

    alert(
      [
        "💎 Compra de créditos APPIA",
        "",
        `Pacote: ${pacoteCreditoSelecionado.quantidade} créditos`,
        `Valor: ${pacoteCreditoSelecionado.valor}`,
        `Pagamento: ${nomeFormaPagamento(
          formaPagamentoCreditos
        )}`,
        "",
        "⚠️ Ambiente visual de teste.",
        "Nenhuma cobrança foi realizada.",
      ].join("\n")
    );
  }

  function finalizarPagamento() {
    if (formaPagamento === "cartao") {
      const numeroLimpo =
        numeroCartao.replace(/\D/g, "");

      if (
        !nomeCartao.trim() ||
        numeroLimpo.length < 13 ||
        validadeCartao.length < 5 ||
        cvvCartao.length < 3
      ) {
        alert(
          "⚠️ Preencha os dados do cartão antes de continuar."
        );
        return;
      }
    }

    if (formaPagamento === "boleto") {
      const documentoLimpo =
        cpfCnpjBoleto.replace(/\D/g, "");

      const documentoValido =
        tipoClienteBoleto === "pf"
          ? documentoLimpo.length === 11
          : documentoLimpo.length === 14;

      if (
        !nomeBoleto.trim() ||
        !documentoValido ||
        !emailBoleto.trim()
      ) {
        alert(
          tipoClienteBoleto === "pf"
            ? "⚠️ Preencha nome, CPF e e-mail para emissão do boleto."
            : "⚠️ Preencha razão social, CNPJ e e-mail para emissão do boleto."
        );
        return;
      }
    }

    alert(
      [
        "💳 Checkout APPIA",
        "",
        `Plano: ${planoAtual.nome}`,
        `Valor: ${planoAtual.preco} ${planoAtual.periodo}`,
        `Pagamento: ${nomeFormaPagamento(
          formaPagamento
        )}`,
        formaPagamento === "cartao"
          ? `Parcelas: ${parcelasCartao}x`
          : "",
        "",
        "⚠️ Ambiente visual de teste.",
        "Nenhuma cobrança foi realizada.",
      ].join("\n")
    );
  }

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "1180px",
        margin: "30px auto",
        padding: "0 18px 40px",
        boxSizing: "border-box",
      }}
    >
      <section
        style={{
          padding: "24px",
          borderRadius: "20px",
          border: "1px solid #2563eb",
          background:
            "linear-gradient(135deg,#020617,#0f172a)",
          boxShadow:
            "0 20px 45px rgba(0,0,0,.22)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                color: "#67e8f9",
                fontSize: "30px",
              }}
            >
              💳 Planos e Pagamentos
            </h1>

            <p
              style={{
                margin:
                  "8px 0 0",
                color: "#cbd5e1",
                lineHeight: 1.55,
              }}
            >
              Gerencie sua assinatura,
              créditos APPIA e formas de
              pagamento.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              setScreen?.("home")
            }
            style={botaoSecundario}
          >
            ⬅ Voltar
          </button>
        </div>
      </section>

      <section
        style={{
          marginTop: "20px",
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit,minmax(230px,1fr))",
          gap: "16px",
        }}
      >
        <ResumoCard
          icone="👤"
          titulo="Conta"
          valor={
            usuario?.email ||
            "Usuário APPIA"
          }
        />

        <ResumoCard
          icone="💎"
          titulo="Créditos disponíveis"
          valor={
            planoAtual.creditos != null
              ? `${planoAtual.creditos}`
              : "—"
          }
        />

        <ResumoCard
          icone="📅"
          titulo="Renovação"
          valor="Mensal"
        />

        <ResumoCard
          icone="✅"
          titulo="Status"
          valor="Ativo"
        />
      </section>

      <h2 style={tituloSecao}>
        Escolha seu plano
      </h2>

      <section
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit,minmax(260px,1fr))",
          gap: "18px",
        }}
      >
        {planos.map((plano) => {
          const selecionado =
            planoSelecionado ===
            plano.id;

          return (
            <button
              key={plano.id}
              type="button"
              onClick={() =>
                setPlanoSelecionado(
                  plano.id
                )
              }
              style={{
                ...cardPlano,
                border:
                  selecionado
                    ? "2px solid #22d3ee"
                    : "1px solid #334155",
                background:
                  selecionado
                    ? "linear-gradient(135deg,#0f172a,#164e63)"
                    : "#0f172a",
                boxShadow:
                  selecionado
                    ? "0 15px 35px rgba(34,211,238,.12)"
                    : "none",
                transform:
                  plano.destaque
                    ? "translateY(-4px)"
                    : "none",
              }}
            >
              {plano.destaque && (
                <div
                  style={{
                    display:
                      "inline-block",
                    marginBottom:
                      "12px",
                    padding:
                      "5px 10px",
                    borderRadius:
                      "999px",
                    background:
                      "#1d4ed8",
                    color:
                      "#ffffff",
                    fontSize:
                      "11px",
                    fontWeight:
                      "bold",
                  }}
                >
                  ⭐ MAIS POPULAR
                </div>
              )}

              <h3
                style={{
                  margin:
                    "0 0 10px",
                  color:
                    "#67e8f9",
                  fontSize:
                    "22px",
                }}
              >
                {plano.nome}
              </h3>

              <div
                style={{
                  color:
                    "#ffffff",
                  fontSize:
                    "30px",
                  fontWeight:
                    "bold",
                }}
              >
                {plano.preco}
              </div>

              <div
                style={{
                  color:
                    "#94a3b8",
                  marginTop:
                    "4px",
                }}
              >
                {plano.periodo}
              </div>

              <div
                style={{
                  marginTop:
                    "18px",
                  display:
                    "grid",
                  gap: "9px",
                  color:
                    "#cbd5e1",
                  textAlign:
                    "left",
                  fontSize:
                    "14px",
                }}
              >
                {plano.recursos.map(
                  (recurso) => (
                    <span
                      key={
                        recurso
                      }
                    >
                      ✅ {recurso}
                    </span>
                  )
                )}
              </div>
            </button>
          );
        })}
      </section>

      <h2 style={tituloSecao}>
        Forma de pagamento
      </h2>

      <section
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit,minmax(210px,1fr))",
          gap: "14px",
        }}
      >
        <FormaPagamento
          id="pix"
          icone="⚡"
          titulo="Pix"
          texto="Pagamento rápido e confirmação automática."
          selecionado={
            formaPagamento === "pix"
          }
          onClick={() =>
            setFormaPagamento("pix")
          }
        />

        <FormaPagamento
          id="cartao"
          icone="💳"
          titulo="Cartão de crédito"
          texto="Ideal para assinatura mensal recorrente."
          selecionado={
            formaPagamento ===
            "cartao"
          }
          onClick={() =>
            setFormaPagamento(
              "cartao"
            )
          }
        />

        <FormaPagamento
          id="boleto"
          icone="📄"
          titulo="Boleto"
          texto="Opção adicional para pagamento da assinatura."
          selecionado={
            formaPagamento ===
            "boleto"
          }
          onClick={() =>
            setFormaPagamento(
              "boleto"
            )
          }
        />

        <FormaPagamento
          id="transferencia"
          icone="🏦"
          titulo="Transferência"
          texto="Transferência bancária para a conta da empresa."
          selecionado={
            formaPagamento ===
            "transferencia"
          }
          onClick={() =>
            setFormaPagamento(
              "transferencia"
            )
          }
        />
      </section>

      {formaPagamento === "pix" && (
        <section style={dadosPagamentoBox}>
          <h3 style={dadosPagamentoTitulo}>
            ⚡ Pagamento por Pix
          </h3>

          <div style={linhaDado}>
            <span>Favorecido</span>
            <strong>
              Casa da Injecao Eletronica Brasil Ltda ME
            </strong>
          </div>

          <div style={linhaDado}>
            <span>Tipo da chave</span>
            <strong>CNPJ</strong>
          </div>

          <div style={linhaDado}>
            <span>Chave Pix</span>
            <strong>{chavePixAppia}</strong>
          </div>

          <div style={qrArea}>
            <div style={qrPlaceholder}>
              <div style={{ fontSize: "42px" }}>▦</div>
              <strong>QR Code Pix</strong>
              <span style={qrTexto}>
                Será gerado automaticamente pelo gateway
                com o valor desta cobrança.
              </span>
            </div>

            <div style={{ flex: 1, minWidth: "230px" }}>
              <div style={qrResumo}>
                <span>Recebedor</span>
                <strong>{favorecidoPixAppia}</strong>
              </div>

              <div style={qrResumo}>
                <span>Valor</span>
                <strong>{planoAtual.preco}</strong>
              </div>

              <button
                type="button"
                onClick={() =>
                  copiarTexto(
                    chavePixAppia,
                    "✅ Chave Pix copiada."
                  )
                }
                style={botaoCopiar}
              >
                📋 Copiar chave Pix
              </button>

              <button
                type="button"
                onClick={() =>
                  alert(
                    "⚠️ O Pix Copia e Cola real será gerado pelo gateway de pagamento na integração."
                  )
                }
                style={{
                  ...botaoCopiar,
                  marginLeft: "8px",
                }}
              >
                📋 Pix Copia e Cola
              </button>
            </div>
          </div>
        </section>
      )}

      {formaPagamento === "transferencia" && (
        <section style={dadosPagamentoBox}>
          <h3 style={dadosPagamentoTitulo}>
            🏦 Transferência bancária
          </h3>

          <div style={linhaDado}>
            <span>Favorecido</span>
            <strong>
              Casa da Injecao Eletronica Brasil Ltda ME
            </strong>
          </div>

          <div style={linhaDado}>
            <span>Banco</span>
            <strong>Bradesco</strong>
          </div>

          <div style={linhaDado}>
            <span>Agência</span>
            <strong>0614-9</strong>
          </div>

          <div style={linhaDado}>
            <span>Conta corrente</span>
            <strong>11133-3</strong>
          </div>

          <button
            type="button"
            onClick={() =>
              copiarTexto(
                [
                  "Casa da Injecao Eletronica Brasil Ltda ME",
                  "Bradesco",
                  "Agência: 0614-9",
                  "Conta corrente: 11133-3",
                ].join("\n"),
                "✅ Dados bancários copiados."
              )
            }
            style={botaoCopiar}
          >
            📋 Copiar dados bancários
          </button>
        </section>
      )}

      {formaPagamento === "boleto" && (
        <section
          style={{
            marginTop: "18px",
            padding: "22px",
            borderRadius: "18px",
            border: "1px solid #f59e0b",
            background:
              "linear-gradient(135deg,#020617,#0f172a)",
          }}
        >
          <h3
            style={{
              margin: "0 0 6px",
              color: "#fde68a",
              fontSize: "20px",
            }}
          >
            📄 Dados para emissão do boleto
          </h3>

          <p
            style={{
              margin: "0 0 18px",
              color: "#94a3b8",
              fontSize: "13px",
            }}
          >
            Preencha os dados do responsável pelo pagamento.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(2,minmax(0,1fr))",
              gap: "10px",
              marginBottom: "16px",
            }}
          >
            <button
              type="button"
              onClick={() => {
                setTipoClienteBoleto("pf");
                setNomeBoleto("");
                setCpfCnpjBoleto("");
              }}
              style={{
                ...botaoTipoCliente,
                border:
                  tipoClienteBoleto === "pf"
                    ? "2px solid #22d3ee"
                    : "1px solid #334155",
                background:
                  tipoClienteBoleto === "pf"
                    ? "#083344"
                    : "#0f172a",
                color:
                  tipoClienteBoleto === "pf"
                    ? "#67e8f9"
                    : "#cbd5e1",
              }}
            >
              👤 Pessoa Física
            </button>

            <button
              type="button"
              onClick={() => {
                setTipoClienteBoleto("pj");
                setNomeBoleto("");
                setCpfCnpjBoleto("");
              }}
              style={{
                ...botaoTipoCliente,
                border:
                  tipoClienteBoleto === "pj"
                    ? "2px solid #22d3ee"
                    : "1px solid #334155",
                background:
                  tipoClienteBoleto === "pj"
                    ? "#083344"
                    : "#0f172a",
                color:
                  tipoClienteBoleto === "pj"
                    ? "#67e8f9"
                    : "#cbd5e1",
              }}
            >
              🏢 Pessoa Jurídica
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gap: "14px",
            }}
          >
            <label style={labelCampo}>
              {tipoClienteBoleto === "pf"
                ? "Nome completo"
                : "Razão social"}
              <input
                type="text"
                value={nomeBoleto}
                onChange={(e) =>
                  setNomeBoleto(e.target.value)
                }
                placeholder={
                  tipoClienteBoleto === "pf"
                    ? "Nome completo"
                    : "Razão social"
                }
                style={campoPagamento}
              />
            </label>

            <label style={labelCampo}>
              {tipoClienteBoleto === "pf"
                ? "CPF"
                : "CNPJ"}
              <input
                type="text"
                inputMode="numeric"
                value={cpfCnpjBoleto}
                onChange={(e) =>
                  setCpfCnpjBoleto(
                    e.target.value
                      .replace(/\D/g, "")
                      .slice(
                      0,
                      tipoClienteBoleto === "pf"
                        ? 11
                        : 14
                    )
                  )
                }
                placeholder={
                  tipoClienteBoleto === "pf"
                    ? "Digite o CPF"
                    : "Digite o CNPJ"
                }
                style={campoPagamento}
              />
            </label>

            <label style={labelCampo}>
              E-mail
              <input
                type="email"
                value={emailBoleto}
                onChange={(e) =>
                  setEmailBoleto(e.target.value)
                }
                placeholder="email@exemplo.com"
                style={campoPagamento}
              />
            </label>
          </div>

          <div
            style={{
              marginTop: "16px",
              padding: "12px 14px",
              borderRadius: "11px",
              background: "#0f172a",
              border: "1px solid #334155",
              color: "#cbd5e1",
              fontSize: "13px",
              lineHeight: 1.5,
            }}
          >
            Plano: <strong>{planoAtual.nome}</strong>
            <br />
            Valor: <strong>{planoAtual.preco}</strong>
            <br />
            O boleto real será gerado pelo gateway de
            pagamento na integração.

            <div
              style={{
                marginTop: "12px",
                padding: "11px 12px",
                borderRadius: "10px",
                border: "1px solid #f59e0b",
                background: "#451a03",
                color: "#fde68a",
                fontWeight: "bold",
                lineHeight: 1.5,
              }}
            >
              ⚠️ Importante: A conta APPIA será liberada
              após a confirmação do pagamento do boleto.
            </div>
          </div>
        </section>
      )}

      {formaPagamento === "cartao" && (
        <section
          style={{
            marginTop: "18px",
            padding: "22px",
            borderRadius: "18px",
            border: "1px solid #22d3ee",
            background:
              "linear-gradient(135deg,#020617,#0f172a)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
              marginBottom: "18px",
            }}
          >
            <div>
              <h3
                style={{
                  margin: 0,
                  color: "#67e8f9",
                  fontSize: "20px",
                }}
              >
                💳 Dados do cartão
              </h3>

              <p
                style={{
                  margin: "6px 0 0",
                  color: "#94a3b8",
                  fontSize: "13px",
                }}
              >
                Preencha os dados abaixo para continuar.
              </p>
            </div>

            <span
              style={{
                padding: "6px 10px",
                borderRadius: "999px",
                border: "1px solid #334155",
                background: "#0f172a",
                color: "#cbd5e1",
                fontSize: "11px",
                fontWeight: "bold",
              }}
            >
              🔒 Ambiente de teste
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(2,minmax(0,1fr))",
              gap: "14px",
            }}
          >
            <label
              style={{
                ...labelCampo,
                gridColumn: "1 / -1",
              }}
            >
              Nome impresso no cartão

              <input
                type="text"
                value={nomeCartao}
                onChange={(e) =>
                  setNomeCartao(
                    e.target.value.toUpperCase()
                  )
                }
                placeholder="NOME COMPLETO"
                autoComplete="cc-name"
                style={campoPagamento}
              />
            </label>

            <label
              style={{
                ...labelCampo,
                gridColumn: "1 / -1",
              }}
            >
              Número do cartão

              <input
                type="text"
                inputMode="numeric"
                value={numeroCartao}
                onChange={(e) =>
                  setNumeroCartao(
                    formatarNumeroCartao(
                      e.target.value
                    )
                  )
                }
                placeholder="0000 0000 0000 0000"
                autoComplete="cc-number"
                style={campoPagamento}
              />
            </label>

            <label style={labelCampo}>
              Validade

              <input
                type="text"
                inputMode="numeric"
                value={validadeCartao}
                onChange={(e) =>
                  setValidadeCartao(
                    formatarValidade(
                      e.target.value
                    )
                  )
                }
                placeholder="MM/AA"
                autoComplete="cc-exp"
                style={campoPagamento}
              />
            </label>

            <label style={labelCampo}>
              CVV

              <input
                type="password"
                inputMode="numeric"
                value={cvvCartao}
                onChange={(e) =>
                  setCvvCartao(
                    e.target.value
                      .replace(/\D/g, "")
                      .slice(0, 4)
                  )
                }
                placeholder="123"
                autoComplete="cc-csc"
                style={campoPagamento}
              />
            </label>

            <label
              style={{
                ...labelCampo,
                gridColumn: "1 / -1",
              }}
            >
              Parcelas

              <select
                value={parcelasCartao}
                onChange={(e) =>
                  setParcelasCartao(
                    e.target.value
                  )
                }
                style={campoPagamento}
              >
                <option value="1">
                  1x — pagamento mensal
                </option>

                <option value="2">
                  2x
                </option>

                <option value="3">
                  3x
                </option>

                <option value="6">
                  6x
                </option>

                <option value="12">
                  12x
                </option>
              </select>
            </label>
          </div>

          <p
            style={{
              margin: "14px 0 0",
              color: "#64748b",
              fontSize: "11px",
              lineHeight: 1.5,
            }}
          >
            Na integração real, os dados do cartão serão
            enviados diretamente ao gateway de pagamento.
            A APPIA não armazenará o número completo do cartão
            nem o CVV.
          </p>
        </section>
      )}

      <section
        style={{
          marginTop: "22px",
          padding: "22px",
          borderRadius: "18px",
          border:
            "1px solid #2563eb",
          background: "#020617",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                color:
                  "#94a3b8",
                fontSize:
                  "13px",
              }}
            >
              Plano selecionado
            </div>

            <div
              style={{
                marginTop:
                  "4px",
                color:
                  "#ffffff",
                fontSize:
                  "22px",
                fontWeight:
                  "bold",
              }}
            >
              {planoAtual.nome} —{" "}
              {planoAtual.preco}
            </div>

            {planoAtual.creditos != null && (
            <div
              style={{
                marginTop:
                  "5px",
                color:
                  "#67e8f9",
                fontSize:
                  "13px",
              }}
            >
              {planoAtual.creditos}{" "}
              créditos de Clip IA
            </div>
            )}
          </div>

          <button
            type="button"
            onClick={
              finalizarPagamento
            }
            style={botaoPrincipal}
          >
            🔒 Continuar para pagamento
          </button>
        </div>
      </section>


      <section
        style={{
          marginTop: "20px",
          padding: "18px",
          borderRadius: "16px",
          border:
            "1px solid #334155",
          background: "#020617",
        }}
      >
        <h3
          style={{
            margin: 0,
            color: "#67e8f9",
          }}
        >
          🧾 Histórico de pagamentos
        </h3>

        <div
          style={{
            marginTop: "14px",
            color: "#94a3b8",
            fontSize: "14px",
          }}
        >
          Nenhum pagamento registrado
          neste ambiente de teste.
        </div>
      </section>
    </div>
  );
}

function ResumoCard({
  icone,
  titulo,
  valor,
}) {
  return (
    <div
      style={{
        padding: "18px",
        borderRadius: "15px",
        border:
          "1px solid #334155",
        background: "#0f172a",
      }}
    >
      <div
        style={{
          fontSize: "26px",
        }}
      >
        {icone}
      </div>

      <div
        style={{
          marginTop: "9px",
          color: "#94a3b8",
          fontSize: "12px",
        }}
      >
        {titulo}
      </div>

      <strong
        style={{
          display: "block",
          marginTop: "5px",
          color: "#ffffff",
          fontSize: "17px",
        }}
      >
        {valor}
      </strong>
    </div>
  );
}

function FormaPagamento({
  icone,
  titulo,
  texto,
  selecionado,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "18px",
        borderRadius: "15px",
        border: selecionado
          ? "2px solid #22d3ee"
          : "1px solid #334155",
        background: selecionado
          ? "#083344"
          : "#0f172a",
        color: "#ffffff",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <div
        style={{
          fontSize: "27px",
        }}
      >
        {icone}
      </div>

      <div
        style={{
          marginTop: "8px",
          fontWeight: "bold",
          color: selecionado
            ? "#67e8f9"
            : "#ffffff",
        }}
      >
        {titulo}
      </div>

      <div
        style={{
          marginTop: "6px",
          color: "#94a3b8",
          fontSize: "12px",
          lineHeight: 1.45,
        }}
      >
        {texto}
      </div>
    </button>
  );
}

function nomeFormaPagamento(
  forma
) {
  const nomes = {
    pix: "Pix",
    cartao:
      "Cartão de crédito",
    boleto: "Boleto",
    transferencia: "Transferência bancária",
  };

  return nomes[forma] || forma;
}

const qrArea = {
  marginTop: "18px",
  display: "flex",
  gap: "18px",
  alignItems: "stretch",
  flexWrap: "wrap",
};

const qrPlaceholder = {
  width: "190px",
  minHeight: "190px",
  padding: "18px",
  boxSizing: "border-box",
  borderRadius: "16px",
  border: "2px dashed #22d3ee",
  background: "#ffffff",
  color: "#0f172a",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  gap: "8px",
};

const qrTexto = {
  fontSize: "11px",
  lineHeight: 1.4,
  color: "#475569",
};

const qrResumo = {
  display: "grid",
  gap: "4px",
  marginBottom: "12px",
  color: "#94a3b8",
  fontSize: "13px",
};

const dadosPagamentoBox = {
  marginTop: "18px",
  padding: "20px",
  borderRadius: "16px",
  border: "1px solid #22d3ee",
  background: "#020617",
};

const dadosPagamentoTitulo = {
  margin: "0 0 15px",
  color: "#67e8f9",
};

const linhaDado = {
  display: "flex",
  justifyContent: "space-between",
  gap: "16px",
  flexWrap: "wrap",
  padding: "9px 0",
  borderBottom: "1px solid #1e293b",
  color: "#94a3b8",
};

const botaoCopiar = {
  marginTop: "16px",
  padding: "11px 16px",
  borderRadius: "10px",
  border: "1px solid #2563eb",
  background: "#172554",
  color: "#bfdbfe",
  cursor: "pointer",
  fontWeight: "bold",
};

const botaoTipoCliente = {
  padding: "12px 14px",
  borderRadius: "11px",
  cursor: "pointer",
  fontWeight: "bold",
  fontSize: "13px",
  transition: "0.2s",
};

const labelCampo = {
  display: "grid",
  gap: "7px",
  color: "#cbd5e1",
  fontSize: "13px",
  fontWeight: "bold",
};

const campoPagamento = {
  width: "100%",
  boxSizing: "border-box",
  padding: "13px 14px",
  borderRadius: "11px",
  border: "1px solid #334155",
  background: "#020617",
  color: "#ffffff",
  outline: "none",
  fontSize: "14px",
};

const tituloSecao = {
  marginTop: "30px",
  marginBottom: "14px",
  color: "#67e8f9",
  fontSize: "21px",
};

const cardPlano = {
  padding: "22px",
  borderRadius: "18px",
  color: "#ffffff",
  cursor: "pointer",
  textAlign: "left",
  transition: "0.2s",
  width: "100%",
};

const botaoSecundario = {
  padding: "10px 16px",
  borderRadius: "10px",
  border:
    "1px solid #334155",
  background: "#0f172a",
  color: "#ffffff",
  cursor: "pointer",
  fontWeight: "bold",
};

const botaoPrincipal = {
  padding: "14px 20px",
  borderRadius: "12px",
  border: "none",
  background:
    "linear-gradient(135deg,#2563eb,#0891b2)",
  color: "#ffffff",
  cursor: "pointer",
  fontWeight: "bold",
  fontSize: "15px",
};
