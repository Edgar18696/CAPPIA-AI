import { useState } from "react";
import { obterDemoMovimento } from "../../services/clipPremium/demonstracoesMovimento";

export default function PreviewMovimentoClip({ movimentoId, nome }) {
  const demo = obterDemoMovimento(movimentoId);
  const [fonte, setFonte] = useState(demo.usarVideo ? "video" : "foto");

  if (fonte === "video") {
    return (
      <div className="clip-premium-demo">
        <video
          className="clip-premium-demo-video"
          muted
          loop
          playsInline
          autoPlay
          preload="metadata"
          poster={demo.foto}
          aria-label={`Demonstração: ${nome}`}
          onError={() => setFonte("foto")}
        >
          <source src={demo.videoWebm} type="video/webm" />
          <source src={demo.videoMp4} type="video/mp4" />
        </video>
      </div>
    );
  }

  return (
    <div className="clip-premium-demo">
      <div className={`clip-premium-demo-palco clip-premium-anim-${demo.css}`}>
        {fonte === "css" ? (
          <div className="clip-premium-demo-silhueta" />
        ) : (
          <img
            src={demo.foto}
            alt=""
            className="clip-premium-demo-peca"
            draggable={false}
            onError={() => setFonte("css")}
          />
        )}
      </div>
    </div>
  );
}
