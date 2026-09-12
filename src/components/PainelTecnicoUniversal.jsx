import { useState } from "react";

function limparTexto(valor) {
  return String(valor ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function adicionarSemRepetir(lista, valor) {
  const texto = limparTexto(valor);

  if (!texto) return;

  const existe = lista.some(
    (item) =>
      item.toLowerCase() ===
      texto.toLowerCase()
  );

  if (!existe) {
    lista.push(texto);
  }
}

function separarCodigos(valor) {
  return String(valor ?? "")
    .split(/[,;|/]+/)
    .map((codigo) => limparTexto(codigo))
    .filter(Boolean);
}

function montarPeriodo(item) {
  const inicio = item?.ano_inicio;
  const fim = item?.ano_fim;

  if (!inicio && !fim) {
    return "";
  }

  if (inicio && fim) {
    return `${inicio} até ${fim}`;
  }

  if (inicio) {
    return `${inicio} em diante`;
  }

  return `Até ${fim}`;
}

function criarDadosTecnicos(resultados) {
  const registros = Array.isArray(resultados)
    ? resultados
    : [];

  const principal = registros[0] || {};

  const aplicacoes = [];
  const motores = [];
  const periodos = [];
  const equivalencias = [];
  const montadoras = [];
  const modelos = [];

  registros.forEach((item) => {
    const aplicacao = [
      item.montadora,
      item.modelo,
    ]
      .filter(Boolean)
      .join(" ");

    adicionarSemRepetir(
      aplicacoes,
      aplicacao
    );

    adicionarSemRepetir(
      montadoras,
      item.montadora
    );

    adicionarSemRepetir(
      modelos,
      item.modelo
    );

    adicionarSemRepetir(
      motores,
      item.motor
    );

    adicionarSemRepetir(
      periodos,
      montarPeriodo(item)
    );

    separarCodigos(
      item.codigo_equivalente
    ).forEach((codigo) => {
      adicionarSemRepetir(
        equivalencias,
        codigo
      );
    });
  });

  return {
    principal,
    aplicacoes,
    motores,
    periodos,
    equivalencias,
    montadoras,
    modelos,
  };
}

export default function PainelTecnicoUniversal({
  resultados = [],
  diagnostico = null,
  onCriarAnuncio,
  onAbrirCatalogo,
}) {
  const [mostrarAplicacoes, setMostrarAplicacoes] =
    useState(false);

  const [mostrarEquivalencias, setMostrarEquivalencias] =
    useState(false);

 const dados =
  diagnostico ||
  criarDadosTecnicos(resultados);

const principal =
  dados.principal ||
  resultados[0] ||
  {};

const aplicacoes =
  dados.aplicacoes || [];

const motores =
  dados.motores || [];

const periodos =
  dados.periodos || [];

const equivalencias =
  dados.equivalencias || [];

const montadoras =
  dados.montadoras || [];

const modelos =
  dados.modelos || [];

  if (!resultados.length) {
    return null;
  }

  const codigo =
    principal.codigo_oem ||
    principal.codigo ||
    "Não informado";

  const fabricante =
    principal.fabricante ||
    "Não informado";

  const peca =
    principal.peca ||
    principal.descricao ||
    "Peça automotiva";

  const origem =
    principal.origem_catalogo ||
    principal.arquivo_catalogo ||
    "Base PAIIA";

  const confiabilidade =
    Number(principal.confiabilidade) ||
    100;

  const pagina =
    principal.pagina_catalogo ||
    principal.pagina ||
    principal.pagina_origem;

  async function copiarDados() {
    const texto = `
PAINEL TÉCNICO PAIIA AI

CÓDIGO:
${codigo}

PEÇA:
${peca}

FABRICANTE:
${fabricante}

APLICAÇÕES:
${aplicacoes.join("\n") || "Não informadas"}

MOTORES:
${motores.join(", ") || "Não informados"}

ANOS:
${periodos.join(", ") || "Não informados"}

EQUIVALÊNCIAS:
${equivalencias.join(", ") || "Não informadas"}

ORIGEM:
${origem}

CONFIABILIDADE:
${confiabilidade}%
`.trim();

    try {
      await navigator.clipboard.writeText(
        texto
      );

      alert(
        "Dados técnicos copiados."
      );
    } catch (error) {
      console.error(
        "Erro ao copiar dados:",
        error
      );

      alert(
        "Não foi possível copiar os dados."
      );
    }
  }

  return (
    <section style={painel}>
      <div style={cabecalho}>
        <div>
          <span style={etiqueta}>
            📚 PAINEL TÉCNICO PAIIA AI
          </span>

          <h2 style={titulo}>
            {peca}
          </h2>

          <p style={subtitulo}>
            Informações consolidadas da base
            técnica universal.
          </p>
        </div>

        <div style={confiabilidadeBox}>
          <span style={confiabilidadeTitulo}>
            Confiabilidade
          </span>

          <strong
            style={confiabilidadeValor}
          >
            ★★★★★ {confiabilidade}%
          </strong>
        </div>
      </div>

      <div style={gridPrincipal}>
        <Campo
          titulo="Código OEM"
          valor={codigo}
          destaque
        />

        <Campo
          titulo="Fabricante"
          valor={fabricante}
        />

        <Campo
          titulo="Origem"
          valor={origem}
        />

        <Campo
          titulo="Registros encontrados"
          valor={diagnostico?.totalAplicacoes || resultados.length}
        />
        <Campo
  titulo="Montadoras"
  valor={montadoras.length}
/>

<Campo
  titulo="Modelos"
  valor={modelos.length}
/>

<Campo
  titulo="Motores"
  valor={motores.length}
/>
      </div>

      <div style={secao}>
        <h3 style={tituloSecao}>
          🚗 Aplicações
        </h3>

        {aplicacoes.length > 0 ? (
          <>
            <div style={chips}>
              {aplicacoes
                .slice(
                  0,
                  mostrarAplicacoes
                    ? aplicacoes.length
                    : 6
                )
                .map((aplicacao) => (
                  <span
                    key={aplicacao}
                    style={chip}
                  >
                    {aplicacao}
                  </span>
                ))}
            </div>

            {aplicacoes.length > 6 && (
              <button
                type="button"
                onClick={() =>
                  setMostrarAplicacoes(
                    (valor) => !valor
                  )
                }
                style={botaoSecundario}
              >
                {mostrarAplicacoes
                  ? "▲ Ocultar aplicações"
                  : `▼ Ver todas as ${aplicacoes.length} aplicações`}
              </button>
            )}
          </>
        ) : (
          <p style={textoVazio}>
            Aplicações não informadas.
          </p>
        )}
      </div>

      <div style={gridSecundario}>
        <BlocoLista
          titulo="⚙ Motores"
          itens={motores}
          vazio="Motores não informados."
        />

        <BlocoLista
          titulo="📅 Anos"
          itens={periodos}
          vazio="Anos não informados."
        />
      </div>

      <div style={secao}>
        <h3 style={tituloSecao}>
          🔄 Equivalências
        </h3>

        {equivalencias.length > 0 ? (
          <>
            <div style={chips}>
              {equivalencias
                .slice(
                  0,
                  mostrarEquivalencias
                    ? equivalencias.length
                    : 10
                )
                .map((codigoEquivalente) => (
                  <span
                    key={codigoEquivalente}
                    style={chipEquivalencia}
                  >
                    {codigoEquivalente}
                  </span>
                ))}
            </div>

            {equivalencias.length > 10 && (
              <button
                type="button"
                onClick={() =>
                  setMostrarEquivalencias(
                    (valor) => !valor
                  )
                }
                style={botaoSecundario}
              >
                {mostrarEquivalencias
                  ? "▲ Ocultar equivalências"
                  : `▼ Ver todas as ${equivalencias.length} equivalências`}
              </button>
            )}
          </>
        ) : (
          <p style={textoVazio}>
            Equivalências não informadas.
          </p>
        )}
      </div>

      {principal.observacao && (
        <div style={observacao}>
          <strong>
            Observação técnica:
          </strong>

          <p style={observacaoTexto}>
            {principal.observacao}
          </p>
        </div>
      )}

      <div style={acoes}>
        <button
          type="button"
          onClick={() =>
            onCriarAnuncio?.(principal)
          }
          style={botaoCriar}
        >
          🚀 Criar Anúncio
        </button>

        <button
          type="button"
          onClick={copiarDados}
          style={botaoCopiar}
        >
          📋 Copiar dados técnicos
        </button>

        {pagina && onAbrirCatalogo && (
          <button
            type="button"
            onClick={() =>
              onAbrirCatalogo(principal)
            }
            style={botaoCatalogo}
          >
            📖 Abrir página do catálogo
          </button>
        )}
      </div>
    </section>
  );
}

function Campo({
  titulo,
  valor,
  destaque = false,
}) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ""
  ) {
    return null;
  }

  return (
    <div
      style={{
        ...campo,
        border: destaque
          ? "1px solid #2563eb"
          : "1px solid #334155",
      }}
    >
      <span style={campoTitulo}>
        {titulo}
      </span>

      <strong
        style={{
          ...campoValor,
          color: destaque
            ? "#67e8f9"
            : "#ffffff",
        }}
      >
        {valor}
      </strong>
    </div>
  );
}

function BlocoLista({
  titulo,
  itens,
  vazio,
}) {
  return (
    <div style={blocoLista}>
      <h3 style={tituloSecao}>
        {titulo}
      </h3>

      {itens.length > 0 ? (
        <div style={chips}>
          {itens.map((item) => (
            <span
              key={item}
              style={chip}
            >
              {item}
            </span>
          ))}
        </div>
      ) : (
        <p style={textoVazio}>
          {vazio}
        </p>
      )}
    </div>
  );
}

const painel = {
  marginTop: "28px",
  padding: "24px",
  borderRadius: "20px",
  background: "#020617",
  border: "1px solid #2563eb",
  boxShadow:
    "0 18px 45px rgba(2, 6, 23, 0.35)",
};

const cabecalho = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "20px",
  flexWrap: "wrap",
  marginBottom: "24px",
};

const etiqueta = {
  display: "inline-block",
  padding: "7px 12px",
  borderRadius: "999px",
  background: "#172554",
  color: "#67e8f9",
  fontSize: "13px",
  fontWeight: "bold",
};

const titulo = {
  color: "#ffffff",
  fontSize: "28px",
  marginTop: "12px",
  marginBottom: "6px",
};

const subtitulo = {
  color: "#94a3b8",
  margin: 0,
};

const confiabilidadeBox = {
  padding: "14px 18px",
  borderRadius: "14px",
  background: "#052e16",
  border: "1px solid #16a34a",
};

const confiabilidadeTitulo = {
  display: "block",
  color: "#86efac",
  fontSize: "12px",
  marginBottom: "5px",
};

const confiabilidadeValor = {
  color: "#dcfce7",
};

const gridPrincipal = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(200px, 1fr))",
  gap: "12px",
};

const campo = {
  padding: "16px",
  borderRadius: "14px",
  background: "#0f172a",
};

const campoTitulo = {
  display: "block",
  color: "#64748b",
  fontSize: "12px",
  marginBottom: "6px",
};

const campoValor = {
  fontSize: "17px",
};

const secao = {
  marginTop: "22px",
  padding: "18px",
  borderRadius: "16px",
  background: "#0f172a",
};

const gridSecundario = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(280px, 1fr))",
  gap: "14px",
  marginTop: "14px",
};

const blocoLista = {
  padding: "18px",
  borderRadius: "16px",
  background: "#0f172a",
};

const tituloSecao = {
  color: "#bfdbfe",
  fontSize: "17px",
  marginTop: 0,
  marginBottom: "12px",
};

const chips = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
};

const chip = {
  padding: "8px 11px",
  borderRadius: "999px",
  background: "#1e293b",
  color: "#e2e8f0",
  border: "1px solid #334155",
  fontSize: "13px",
};

const chipEquivalencia = {
  ...chip,
  background: "#172554",
  color: "#bfdbfe",
  border: "1px solid #2563eb",
  fontWeight: "bold",
};

const textoVazio = {
  color: "#64748b",
  margin: 0,
};

const observacao = {
  marginTop: "18px",
  padding: "16px",
  borderRadius: "14px",
  background: "#422006",
  border: "1px solid #a16207",
  color: "#fde68a",
};

const observacaoTexto = {
  marginBottom: 0,
  lineHeight: 1.6,
};

const acoes = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
  marginTop: "22px",
};

const botaoCriar = {
  padding: "12px 18px",
  borderRadius: "11px",
  border: "none",
  background: "#16a34a",
  color: "#ffffff",
  fontWeight: "bold",
  cursor: "pointer",
};

const botaoCopiar = {
  padding: "12px 18px",
  borderRadius: "11px",
  border: "1px solid #2563eb",
  background: "#172554",
  color: "#bfdbfe",
  fontWeight: "bold",
  cursor: "pointer",
};

const botaoCatalogo = {
  padding: "12px 18px",
  borderRadius: "11px",
  border: "1px solid #334155",
  background: "#1e293b",
  color: "#ffffff",
  fontWeight: "bold",
  cursor: "pointer",
};

const botaoSecundario = {
  marginTop: "14px",
  padding: 0,
  border: "none",
  background: "transparent",
  color: "#67e8f9",
  fontWeight: "bold",
  cursor: "pointer",
};