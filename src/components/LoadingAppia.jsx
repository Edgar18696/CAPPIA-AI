import logoAppia from "../assets/logo-appia-ai.png";

import {
  useEffect,
  useState,
} from "react";

export default function LoadingAppia({
  titulo = "🤖 APPIA AI",
  mensagem = "Processando...",
}) {
  const [segundos, setSegundos] =
    useState(0);

  const [progresso, setProgresso] =
    useState(8);

  useEffect(() => {
    const intervaloTempo =
      setInterval(() => {
        setSegundos(
          (valor) => valor + 1
        );
      }, 1000);

    const intervaloProgresso =
      setInterval(() => {
        setProgresso(
          (valorAtual) => {
            if (valorAtual >= 92) {
              return 92;
            }

            const incremento =
              valorAtual < 40
                ? 4
                : valorAtual < 70
                  ? 2
                  : 1;

            return Math.min(
              valorAtual + incremento,
              92
            );
          }
        );
      }, 900);

    return () => {
      clearInterval(
        intervaloTempo
      );

      clearInterval(
        intervaloProgresso
      );
    };
  }, []);

  const minutos = String(
    Math.floor(segundos / 60)
  ).padStart(2, "0");

  const segundosFormatados =
    String(segundos % 60).padStart(
      2,
      "0"
    );

function obterEtapa() {
  if (progresso < 10) {
    return {
      icone: "📤",
      titulo: "Enviando imagem",
      descricao:
        "Preparando a imagem para processamento.",
    };
  }

  if (progresso < 25) {
    return {
      icone: "🔎",
      titulo: "Identificando a peça",
      descricao:
        "Detectando automaticamente o produto.",
    };
  }

  if (progresso < 45) {
    return {
      icone: "🧠",
      titulo: "Inteligência Artificial",
      descricao:
        "Analisando detalhes técnicos da imagem.",
    };
  }

  if (progresso < 65) {
    return {
      icone: "✂️",
      titulo: "Removendo fundo",
      descricao:
        "Aplicando recorte profissional.",
    };
  }

  if (progresso < 85) {
    return {
      icone: "🎨",
      titulo: "Finalizando imagem",
      descricao:
        "Aplicando acabamento premium.",
    };
  }

  return {
    icone: "💾",
    titulo: "Salvando",
    descricao:
      "Gravando automaticamente na Galeria.",
  };
}
const etapa = obterEtapa();
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background:
          "rgba(2,6,23,0.82)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 99999,
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        style={{
          background: "#0f172a",
          border:
            "1px solid #2563eb",
          borderRadius: "18px",
          padding: "35px",
          width: "380px",
          maxWidth:
            "calc(100% - 32px)",
          textAlign: "center",
          boxShadow:
            "0 20px 60px rgba(0,0,0,0.45)",
        }}
      >
       <div
  style={{
    marginBottom: "22px",
    display: "flex",
    justifyContent: "center",
  }}
>
  <img
    src={logoAppia}
    alt="APPIA AI"
    style={{
      width: "90px",
      height: "90px",
      animation: "logoPulse 2s ease-in-out infinite",
      filter:
        "drop-shadow(0 0 18px rgba(34,211,238,.45))",
    }}
  />
</div>

        <h2
          style={{
            color: "#67e8f9",
            marginBottom: "10px",
          }}
        >
          {titulo}
        </h2>

        <p
          style={{
            color: "#cbd5e1",
            marginBottom: "12px",
          }}
        >
          {mensagem}
        </p>

       <div
  style={{
    marginBottom: "18px",
  }}
>
  <div
    style={{
      color: "#67e8f9",
      fontSize: "20px",
      fontWeight: "bold",
      marginBottom: "6px",
    }}
  >
    {etapa.icone} {etapa.titulo}
  </div>

  <div
    style={{
      color: "#cbd5e1",
      fontSize: "14px",
    }}
  >
    {etapa.descricao}
  </div>
</div>

        <div
          style={{
            width: "100%",
            height: "14px",
            background: "#020617",
            borderRadius: "999px",
            overflow: "hidden",
            border:
              "1px solid #334155",
          }}
        >
          <div
            style={{
              width: `${progresso}%`,
              height: "100%",
              background:
                "linear-gradient(90deg,#2563eb,#22d3ee)",
              borderRadius: "999px",
              transition:
                "width 0.8s ease",
            }}
          />
        </div>

        <div
          style={{
            marginTop: "10px",
            color: "#67e8f9",
            fontWeight: "bold",
          }}
        >
          {progresso}%
        </div>

        <div
          style={{
            color: "#22d3ee",
            fontSize: "22px",
            fontWeight: "bold",
            marginTop: "16px",
          }}
        >
          ⏱ {minutos}:
          {segundosFormatados}
        </div>

        <p
          style={{
            color: "#94a3b8",
            marginTop: "12px",
            marginBottom: 0,
            fontSize: "13px",
          }}
        >
          Tempo médio: 25 a 40
          segundos
        </p>

      <style>
  {`
    @keyframes logoPulse {

      0% {
        transform: scale(0.96);
        opacity: .75;
      }

      50% {
        transform: scale(1.08);
        opacity: 1;
      }

      100% {
        transform: scale(0.96);
        opacity: .75;
      }

    }

    @keyframes barra {

      0% {
        background-position: 0% 50%;
      }

      100% {
        background-position: 200% 50%;
      }

    }

  `}
</style>
      </div>
    </div>
  );
}