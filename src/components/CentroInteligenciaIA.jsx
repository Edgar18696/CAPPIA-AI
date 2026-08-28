import PainelResumoCatalogo from "./PainelResumoCatalogo";
import DiagnosticoTecnicoIA from "./DiagnosticoTecnicoIA";
import FichaTecnicaIA from "./FichaTecnicaIA";
import ConsultaCruzadaIA from "./ConsultaCruzadaIA";
import AlertasTecnicosIA from "./AlertasTecnicosIA";
import ParecerTecnicoIA from "./ParecerTecnicoIA";

import { motorAnaliseTecnica } from "../services/motorAnaliseTecnica";

export default function CentroInteligenciaIA({
  resultados = [],
  termo = "",
  onCriarAnuncio,
}) {
  if (!resultados.length) {
    return null;
  }

  const analise = motorAnaliseTecnica(
    resultados,
    termo
  );

  if (!analise) {
    return null;
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        marginBottom: "30px",
      }}
    >
      <PainelResumoCatalogo
        resultados={resultados}
        termo={termo}
        analise={analise}
      />

      <DiagnosticoTecnicoIA
        resultados={resultados}
        analise={analise}
      />

      <FichaTecnicaIA
        resultados={resultados}
        analise={analise}
      />

      <ConsultaCruzadaIA
        resultados={resultados}
        analise={analise}
      />

      <AlertasTecnicosIA
        resultados={resultados}
        analise={analise}
      />

      <ParecerTecnicoIA
        resultados={resultados}
        analise={analise}
      />
    </div>
  );
}