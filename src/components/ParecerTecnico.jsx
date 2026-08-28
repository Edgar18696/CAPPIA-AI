export default function ParecerTecnico({
  resultados = [],
  diagnostico = null,
}) {
  if (
    !Array.isArray(resultados) ||
    resultados.length === 0
  ) {
    return null;
  }

  const principal =
    resultados[0] || {};

  const fabricantes =
    diagnostico?.fabricante
      ? [diagnostico.fabricante]
      : [
          ...new Set(
            resultados
              .map((item) => item.fabricante)
              .filter(Boolean)
          ),
        ];

  const montadoras =
    diagnostico?.montadoras || [
      ...new Set(
        resultados
          .map((item) => item.montadora)
          .filter(Boolean)
      ),
    ];

  const motores =
    diagnostico?.motores || [
      ...new Set(
        resultados
          .map((item) => item.motor)
          .filter(Boolean)
      ),
    ];

  const equivalencias =
    diagnostico?.equivalencias || [
      ...new Set(
        resultados
          .flatMap((item) =>
            String(
              item.codigo_equivalente || ""
            ).split(/[,;|/]+/)
          )
          .map((codigo) => codigo.trim())
          .filter(Boolean)
      ),
    ];

  const totalAplicacoes =
    diagnostico?.totalAplicacoes ||
    resultados.length;

  const peca =
    diagnostico?.peca ||
    principal.peca ||
    "Peça Automotiva";

  const confiabilidade =
    Number(principal.confiabilidade) ||
    100;

  let parecer =
    "A aplicação apresenta boa compatibilidade.";

  if (confiabilidade >= 95) {
    parecer =
      "A aplicação apresenta excelente confiabilidade para utilização e geração automática de anúncios.";
  } else if (confiabilidade >= 80) {
    parecer =
      "Existem boas evidências técnicas, porém recomenda-se confirmar a aplicação.";
  } else {
    parecer =
      "Existem poucas referências. Recomenda-se validar manualmente antes da instalação.";
  }

  return (
    <div style={painel}>
      <h2 style={titulo}>
        👨‍🔧 Parecer Técnico APPIA AI
      </h2>

      <p style={texto}>
        A peça pesquisada corresponde a{" "}
        <b>
          {peca}
        </b>
        , do fabricante{" "}
        <b>
          {fabricantes.join(", ")}
        </b>
        .

        Foram identificadas{" "}
        <b>{totalAplicacoes}</b>{" "}
        aplicações oficiais distribuídas entre{" "}
        <b>{montadoras.length}</b>{" "}
        montadora(s),{" "}
        <b>{motores.length}</b>{" "}
        motorização(ões) e{" "}
        <b>{equivalencias.length}</b>{" "}
        código(s) equivalente(s).
      </p>

      <div style={caixa}>
        <strong>
          💡 Recomendação APPIA
        </strong>

        <p style={recomendacao}>
          {parecer}
        </p>

        <ul style={lista}>
          <li>
            ✔ Confirmar o código gravado na peça.
          </li>

          <li>
            ✔ Conferir o conector.
          </li>

          <li>
            ✔ Verificar ano e motorização.
          </li>

          <li>
            ✔ Comparar visualmente a peça original.
          </li>

          <li>
            ✔ Utilizar as equivalências apenas como apoio técnico.
          </li>
        </ul>
      </div>
    </div>
  );
}

const painel = {
  marginTop: "25px",
  padding: "22px",
  borderRadius: "18px",
  background: "#06121d",
  border: "1px solid #2563eb",
};

const titulo = {
  color: "#67e8f9",
  marginTop: 0,
};

const texto = {
  color: "#e2e8f0",
  lineHeight: "1.8",
  fontSize: "16px",
};

const caixa = {
  marginTop: "20px",
  background: "#0f172a",
  borderRadius: "14px",
  padding: "20px",
};

const recomendacao = {
  color: "#cbd5e1",
  lineHeight: "1.7",
};

const lista = {
  color: "#ffffff",
  lineHeight: "2",
};