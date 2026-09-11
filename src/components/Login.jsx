import { useEffect, useState } from "react";

export default function Login({
  email,
  setEmail,
  senha,
  setSenha,
  entrarUsuario,
  cadastrarUsuario,
  cardStyle,
  iniciarCadastro = false,
}) {
  const [modoCadastro, setModoCadastro] =
    useState(Boolean(iniciarCadastro));

  useEffect(() => {
    setModoCadastro(Boolean(iniciarCadastro));
  }, [iniciarCadastro]);

  const [tipoConta, setTipoConta] =
    useState("pf");

  const [nome, setNome] =
    useState("");

  const [documento, setDocumento] =
    useState("");

  const [telefone, setTelefone] =
    useState("");

  const [nomeLoja, setNomeLoja] =
    useState("");

  const [cidade, setCidade] =
    useState("");

  const [estado, setEstado] =
    useState("");

  const [cep, setCep] =
    useState("");

  const [logradouro, setLogradouro] =
    useState("");

  const [numeroEndereco, setNumeroEndereco] =
    useState("");

  const [bairro, setBairro] =
    useState("");

  const [buscandoCep, setBuscandoCep] =
    useState(false);

  const [confirmarSenha, setConfirmarSenha] =
    useState("");

  const [aceitouTermos, setAceitouTermos] =
    useState(false);

  const [aceitouPrivacidade, setAceitouPrivacidade] =
    useState(false);

  const [cadastrando, setCadastrando] =
    useState(false);

  function somenteNumeros(valor) {
    return String(valor || "").replace(/\D/g, "");
  }

  function validarCPF(valor) {
    const cpf = somenteNumeros(valor);

    if (
      cpf.length !== 11 ||
      /^(\d)\1{10}$/.test(cpf)
    ) {
      return false;
    }

    let soma = 0;

    for (let i = 0; i < 9; i += 1) {
      soma += Number(cpf[i]) * (10 - i);
    }

    let digito = (soma * 10) % 11;

    if (digito === 10) {
      digito = 0;
    }

    if (digito !== Number(cpf[9])) {
      return false;
    }

    soma = 0;

    for (let i = 0; i < 10; i += 1) {
      soma += Number(cpf[i]) * (11 - i);
    }

    digito = (soma * 10) % 11;

    if (digito === 10) {
      digito = 0;
    }

    return digito === Number(cpf[10]);
  }

  function validarCNPJ(valor) {
    const cnpj = somenteNumeros(valor);

    if (
      cnpj.length !== 14 ||
      /^(\d)\1{13}$/.test(cnpj)
    ) {
      return false;
    }

    function calcularDigito(base, pesos) {
      const soma = base
        .split("")
        .reduce(
          (total, numero, indice) =>
            total +
            Number(numero) *
              pesos[indice],
          0
        );

      const resto = soma % 11;

      return resto < 2
        ? 0
        : 11 - resto;
    }

    const base12 = cnpj.slice(0, 12);

    const primeiro = calcularDigito(
      base12,
      [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    );

    const segundo = calcularDigito(
      `${base12}${primeiro}`,
      [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    );

    return (
      cnpj ===
      `${base12}${primeiro}${segundo}`
    );
  }

  function atualizarDocumento(valor) {
    const limite =
      tipoConta === "pf" ? 11 : 14;

    setDocumento(
      somenteNumeros(valor).slice(0, limite)
    );
  }

  function trocarTipoConta(tipo) {
    setTipoConta(tipo);
    setDocumento("");
    setNome("");
  }

  async function buscarCep(valorCep = cep) {
    const cepLimpo =
      somenteNumeros(valorCep).slice(0, 8);

    setCep(cepLimpo);

    if (cepLimpo.length !== 8) {
      return;
    }

    setBuscandoCep(true);

    try {
      const resposta = await fetch(
        `https://viacep.com.br/ws/${cepLimpo}/json/`
      );

      if (!resposta.ok) {
        throw new Error(
          "Não foi possível consultar o CEP."
        );
      }

      const dados = await resposta.json();

      if (dados?.erro) {
        throw new Error(
          "CEP não encontrado."
        );
      }

      setLogradouro(
        dados?.logradouro || ""
      );

      setBairro(
        dados?.bairro || ""
      );

      setCidade(
        dados?.localidade || ""
      );

      setEstado(
        dados?.uf || ""
      );
    } catch (erro) {
      alert(
        erro?.message ||
          "Não foi possível buscar o endereço pelo CEP."
      );
    } finally {
      setBuscandoCep(false);
    }
  }

  function voltarLogin() {
    setModoCadastro(false);
    setConfirmarSenha("");
  }

  async function criarConta() {
    if (cadastrando) {
      return;
    }

    const documentoLimpo =
      somenteNumeros(documento);

    const documentoValido =
      tipoConta === "pf"
        ? validarCPF(documentoLimpo)
        : validarCNPJ(documentoLimpo);

    if (!nome.trim()) {
      alert(
        tipoConta === "pf"
          ? "Digite seu nome completo."
          : "Digite a razão social."
      );
      return;
    }

    if (!documentoValido) {
      alert(
        tipoConta === "pf"
          ? "⚠️ CPF inválido. Confira o número informado."
          : "⚠️ CNPJ inválido. Confira o número informado."
      );
      return;
    }

    if (!email.trim()) {
      alert("Digite seu e-mail.");
      return;
    }

    if (!telefone.trim()) {
      alert(
        "Digite seu telefone ou WhatsApp."
      );
      return;
    }

    if (cep.length !== 8) {
      alert("Digite um CEP válido.");
      return;
    }

    if (!logradouro.trim()) {
      alert("Endereço não encontrado. Verifique o CEP.");
      return;
    }

    if (!numeroEndereco.trim()) {
      alert("Digite o número do endereço.");
      return;
    }

    if (!senha || senha.length < 6) {
      alert(
        "A senha deve ter pelo menos 6 caracteres."
      );
      return;
    }

    if (senha !== confirmarSenha) {
      alert("As senhas não conferem.");
      return;
    }

    if (!aceitouTermos) {
      alert(
        "Você precisa aceitar os Termos de Uso."
      );
      return;
    }

    if (!aceitouPrivacidade) {
      alert(
        "Você precisa aceitar a Política de Privacidade."
      );
      return;
    }

    setCadastrando(true);

    try {
      await cadastrarUsuario({
        tipoConta,
        nome: nome.trim(),
        documento: documentoLimpo,
        telefone: telefone.trim(),
        nomeLoja: nomeLoja.trim(),
        cep: cep.trim(),
        logradouro: logradouro.trim(),
        numeroEndereco:
          numeroEndereco.trim(),
        bairro: bairro.trim(),
        cidade: cidade.trim(),
        estado: estado.trim(),
      });
    } finally {
      setCadastrando(false);
    }
  }

  return (
    <div
      style={{
        ...cardStyle,
        maxWidth: modoCadastro
          ? "650px"
          : "450px",
        margin: "50px auto",
        padding: "26px",
      }}
    >
      <h2
        style={{
          color: "#67e8f9",
          marginTop: 0,
        }}
      >
        {modoCadastro
          ? "🚀 Criar Conta APPIA AI"
          : "🔐 Login PAIIA"}
      </h2>

      {!modoCadastro ? (
        <>
          <p style={textoAuxiliar}>
            Entre com seu e-mail e senha.
          </p>

          <input
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
            style={campo}
          />

          <input
            type="password"
            placeholder="Senha"
            value={senha}
            onChange={(e) =>
              setSenha(e.target.value)
            }
            style={campo}
          />

          <div
            style={{
              display: "flex",
              gap: "10px",
              justifyContent: "center",
              flexWrap: "wrap",
              marginTop: "20px",
            }}
          >
            <button
              type="button"
              onClick={entrarUsuario}
              style={botaoPrincipal}
            >
              🔐 Entrar
            </button>

            <button
              type="button"
              onClick={() =>
                setModoCadastro(true)
              }
              style={botaoSecundario}
            >
              🚀 Criar Conta
            </button>
          </div>
        </>
      ) : (
        <>
          <p style={textoAuxiliar}>
            Preencha seus dados para criar
            sua conta na APPIA.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(2,minmax(0,1fr))",
              gap: "10px",
              marginTop: "18px",
            }}
          >
            <button
              type="button"
              onClick={() =>
                trocarTipoConta("pf")
              }
              style={{
                ...botaoTipo,
                border:
                  tipoConta === "pf"
                    ? "2px solid #22d3ee"
                    : "1px solid #334155",
                background:
                  tipoConta === "pf"
                    ? "#083344"
                    : "#0f172a",
              }}
            >
              👤 Pessoa Física
            </button>

            <button
              type="button"
              onClick={() =>
                trocarTipoConta("pj")
              }
              style={{
                ...botaoTipo,
                border:
                  tipoConta === "pj"
                    ? "2px solid #22d3ee"
                    : "1px solid #334155",
                background:
                  tipoConta === "pj"
                    ? "#083344"
                    : "#0f172a",
              }}
            >
              🏢 Pessoa Jurídica
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(2,minmax(0,1fr))",
              gap: "12px",
              marginTop: "16px",
            }}
          >
            <label
              style={{
                ...label,
                gridColumn: "1 / -1",
              }}
            >
              {tipoConta === "pf"
                ? "Nome completo"
                : "Razão social"}

              <input
                type="text"
                value={nome}
                onChange={(e) =>
                  setNome(e.target.value)
                }
                placeholder={
                  tipoConta === "pf"
                    ? "Seu nome completo"
                    : "Razão social da empresa"
                }
                style={campo}
              />
            </label>

            <label style={label}>
              {tipoConta === "pf"
                ? "CPF"
                : "CNPJ"}

              <input
                type="text"
                inputMode="numeric"
                value={documento}
                onChange={(e) =>
                  atualizarDocumento(
                    e.target.value
                  )
                }
                placeholder={
                  tipoConta === "pf"
                    ? "Somente números"
                    : "Somente números"
                }
                style={campo}
              />
            </label>

            <label style={label}>
              Telefone / WhatsApp

              <input
                type="tel"
                value={telefone}
                onChange={(e) =>
                  setTelefone(
                    e.target.value
                  )
                }
                placeholder="(00) 00000-0000"
                style={campo}
              />
            </label>

            <label
              style={{
                ...label,
                gridColumn: "1 / -1",
              }}
            >
              Nome da loja / empresa
              <span style={opcional}>
                opcional
              </span>

              <input
                type="text"
                value={nomeLoja}
                onChange={(e) =>
                  setNomeLoja(
                    e.target.value
                  )
                }
                placeholder="Nome comercial"
                style={campo}
              />
            </label>

            <label
              style={{
                ...label,
                gridColumn: "1 / -1",
              }}
            >
              CEP

              <div
                style={{
                  display: "flex",
                  gap: "8px",
                }}
              >
                <input
                  type="text"
                  inputMode="numeric"
                  value={cep}
                  onChange={(e) =>
                    setCep(
                      somenteNumeros(
                        e.target.value
                      ).slice(0, 8)
                    )
                  }
                  onBlur={() =>
                    buscarCep()
                  }
                  placeholder="Digite o CEP"
                  style={{
                    ...campo,
                    marginTop: 0,
                    flex: 1,
                  }}
                />

                <button
                  type="button"
                  onClick={() =>
                    buscarCep()
                  }
                  disabled={buscandoCep}
                  style={{
                    ...botaoSecundario,
                    minWidth: "120px",
                  }}
                >
                  {buscandoCep
                    ? "🔎 Buscando..."
                    : "🔎 Buscar CEP"}
                </button>
              </div>
            </label>

            <label
              style={{
                ...label,
                gridColumn: "1 / -1",
              }}
            >
              Endereço

              <input
                type="text"
                value={logradouro}
                readOnly
                placeholder="Preenchido automaticamente pelo CEP"
                style={{
                  ...campo,
                  opacity: logradouro
                    ? 1
                    : 0.75,
                }}
              />
            </label>

            <label style={label}>
              Número

              <input
                type="text"
                value={numeroEndereco}
                onChange={(e) =>
                  setNumeroEndereco(
                    e.target.value
                  )
                }
                placeholder="Número"
                style={campo}
              />
            </label>

            <label style={label}>
              Bairro

              <input
                type="text"
                value={bairro}
                readOnly
                placeholder="Bairro"
                style={campo}
              />
            </label>

            <label style={label}>
              Cidade

              <input
                type="text"
                value={cidade}
                readOnly
                placeholder="Cidade"
                style={campo}
              />
            </label>

            <label style={label}>
              Estado

              <input
                type="text"
                value={estado}
                readOnly
                placeholder="UF"
                style={campo}
              />
            </label>

            <label
              style={{
                ...label,
                gridColumn: "1 / -1",
              }}
            >
              E-mail

              <input
                type="email"
                value={email}
                onChange={(e) =>
                  setEmail(
                    e.target.value
                  )
                }
                placeholder="email@exemplo.com"
                style={campo}
              />
            </label>

            <label style={label}>
              Senha

              <input
                type="password"
                value={senha}
                onChange={(e) =>
                  setSenha(e.target.value)
                }
                placeholder="Mínimo 6 caracteres"
                style={campo}
              />
            </label>

            <label style={label}>
              Confirmar senha

              <input
                type="password"
                value={confirmarSenha}
                onChange={(e) =>
                  setConfirmarSenha(
                    e.target.value
                  )
                }
                placeholder="Repita a senha"
                style={campo}
              />
            </label>
          </div>

          <div
            style={{
              display: "grid",
              gap: "10px",
              marginTop: "18px",
              textAlign: "left",
            }}
          >
            <label style={checkLabel}>
              <input
                type="checkbox"
                checked={aceitouTermos}
                onChange={(e) =>
                  setAceitouTermos(
                    e.target.checked
                  )
                }
              />

              Aceito os Termos de Uso
              da APPIA.
            </label>

            <label style={checkLabel}>
              <input
                type="checkbox"
                checked={aceitouPrivacidade}
                onChange={(e) =>
                  setAceitouPrivacidade(
                    e.target.checked
                  )
                }
              />

              Aceito a Política de
              Privacidade.
            </label>
          </div>

          <div
            style={{
              display: "flex",
              gap: "10px",
              justifyContent: "center",
              flexWrap: "wrap",
              marginTop: "22px",
            }}
          >
            <button
              type="button"
              onClick={criarConta}
              disabled={cadastrando}
              style={{
                ...botaoPrincipal,
                opacity: cadastrando ? 0.65 : 1,
                cursor: cadastrando
                  ? "not-allowed"
                  : "pointer",
              }}
            >
              {cadastrando
                ? "⏳ Criando conta..."
                : "🚀 Criar minha conta"}
            </button>

            <button
              type="button"
              onClick={voltarLogin}
              style={botaoSecundario}
            >
              ⬅ Já tenho conta
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const campo = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px 13px",
  marginTop: "7px",
  borderRadius: "10px",
  border: "1px solid #334155",
  background: "#020617",
  color: "#ffffff",
  outline: "none",
  fontSize: "14px",
};

const label = {
  display: "block",
  color: "#cbd5e1",
  fontSize: "13px",
  fontWeight: "bold",
  textAlign: "left",
};

const opcional = {
  marginLeft: "6px",
  color: "#64748b",
  fontSize: "11px",
  fontWeight: "normal",
};

const textoAuxiliar = {
  color: "#94a3b8",
  lineHeight: 1.5,
};

const botaoTipo = {
  padding: "12px",
  borderRadius: "11px",
  color: "#ffffff",
  cursor: "pointer",
  fontWeight: "bold",
};

const botaoPrincipal = {
  padding: "12px 18px",
  borderRadius: "10px",
  border: "none",
  background:
    "linear-gradient(135deg,#2563eb,#0891b2)",
  color: "#ffffff",
  cursor: "pointer",
  fontWeight: "bold",
};

const botaoSecundario = {
  padding: "12px 18px",
  borderRadius: "10px",
  border: "1px solid #334155",
  background: "#0f172a",
  color: "#ffffff",
  cursor: "pointer",
  fontWeight: "bold",
};

const checkLabel = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  color: "#cbd5e1",
  fontSize: "13px",
};