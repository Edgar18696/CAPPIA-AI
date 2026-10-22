import { useEffect, useState } from "react";
import { EVENTO_AVISO_FICHA, lerAvisoFichaNaoSalva, limparAvisoFichaNaoSalva, anuncioGuardadoEhDoAviso } from "../services/avisoFichaNaoSalva";
import { lerAnuncioEmAndamento } from "../services/fichasCentral";
import { retomarAnuncioGuardado } from "../services/aberturaNovoAnuncio";

/** Faixa de aviso: a ficha do Novo Anúncio NÃO foi salva na base ao sair pelo menu. */
export default function AvisoFichaNaoSalva({ setScreen }) {
  const [aviso, setAviso] = useState(() => lerAvisoFichaNaoSalva());
  useEffect(() => {
    const ler = () => setAviso(lerAvisoFichaNaoSalva());
    window.addEventListener(EVENTO_AVISO_FICHA, ler);
    window.addEventListener("storage", ler);
    return () => {
      window.removeEventListener(EVENTO_AVISO_FICHA, ler);
      window.removeEventListener("storage", ler);
    };
  }, []);
  if (!aviso) return null;
  const nome = [aviso.codigo, aviso.titulo].filter(Boolean).join(" · ") || "do Novo Anúncio";
  return (
    <div data-paiia-aviso-ficha-nao-salva role="alert" style={{ margin: "10px auto", maxWidth: 900, padding: "12px 14px", borderRadius: 12, border: "1px solid #f87171", background: "#450a0a", color: "#fecaca", fontSize: 14, boxSizing: "border-box" }}>
      <b>⚠ A ficha {nome} NÃO foi salva na base PAIIA ao sair do Novo Anúncio.</b>
      <div style={{ fontSize: 13, marginTop: 4 }}>
        Motivo: {aviso.erro} Os dados continuam neste navegador (rascunho). Abra o Novo Anúncio de novo para salvar.
      </div>
      <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" data-paiia-aviso-ficha-reabrir onClick={() => {
          // A Home guarda o anúncio em andamento antes de limpar a tela; aqui ele
          // é retomado (o mesmo "Retomar" da Central), só se for o desta ficha.
          try {
            if (anuncioGuardadoEhDoAviso(lerAnuncioEmAndamento(localStorage), aviso)) retomarAnuncioGuardado(localStorage);
          } catch {
            // sem acesso ao navegador: abre o Novo Anúncio como estiver
          }
          setScreen?.("novoAnuncio");
        }} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #fca5a5", background: "#7f1d1d", color: "#fff", cursor: "pointer" }}>
          Abrir o Novo Anúncio de novo
        </button>
        <button type="button" data-paiia-aviso-ficha-fechar onClick={() => { limparAvisoFichaNaoSalva(); setAviso(null); }} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #475569", background: "transparent", color: "#cbd5e1", cursor: "pointer" }}>
          Fechar aviso
        </button>
      </div>
    </div>
  );
}
