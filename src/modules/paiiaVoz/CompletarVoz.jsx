// =============================================================
// PAIIA Voz — Pacote C (03/11/2026): cartão da conversa “Completar a ficha”.
// Mostra a conversa, fala a pergunta (voz do próprio navegador, sem custo) e
// oferece respostas rápidas. Quem entende e grava é o serviço completarVoz
// (via onResponder). Aqui nada é aprovado nem publicado.
// =============================================================
import { useEffect, useRef, useState } from "react";

const BOTOES = {
  confirmarAplicacao: ["Sim", "Não"],
  categoria: ["Sim", "Não"],
  maisAplicacao: ["Não"],
  aplicacao: ["Sem aplicação"],
  aplicacaoDescricao: ["Sim", "Não"],
  tipoVeiculo: ["Carro", "Linha pesada"],
  modalidade: ["Premium", "Clássico"],
  conferir: ["Conferir"],
};

function falarTexto(texto, { aoComecar, aoTerminar } = {}) {
  try {
    const s = globalThis.speechSynthesis;
    const U = globalThis.SpeechSynthesisUtterance;
    if (!s || !U || !texto) return false;
    s.cancel();
    const u = new U(String(texto).replace(/[“”"]/g, ""));
    u.lang = "pt-BR";
    u.rate = 1.05;
    const voz = (s.getVoices?.() || []).find((v) => /^pt(-|_)BR/i.test(v.lang));
    if (voz) u.voice = voz;
    u.onstart = () => aoComecar?.();
    u.onend = () => aoTerminar?.();
    u.onerror = () => aoTerminar?.();
    s.speak(u);
    return true;
  } catch {
    return false;
  }
}

export default function CompletarVoz({ historico = [], pergunta = null, fim = null, contas = [], ocupado = "", falar = true, onFalar, onResponder, aoFalar }) {
  const [texto, setTexto] = useState("");
  const ultimaFalada = useRef("");
  const fala = pergunta?.texto || fim?.texto || "";
  // Fala a pergunta nova (uma vez); o microfone pausa enquanto o PAIIA fala.
  useEffect(() => {
    if (!falar || !fala || ocupado || ultimaFalada.current === fala) return;
    ultimaFalada.current = fala;
    falarTexto(fala, { aoComecar: () => aoFalar?.(true), aoTerminar: () => aoFalar?.(false) });
  }, [fala, falar, ocupado, aoFalar]);
  useEffect(() => () => { try { globalThis.speechSynthesis?.cancel(); } catch { /* sem voz */ } }, []);

  function enviar(e) {
    e?.preventDefault?.();
    const t = texto.trim();
    if (!t) return;
    setTexto("");
    onResponder?.(t);
  }
  const rapidos = pergunta?.campo === "conta" ? contas.map((c) => c.nome) : BOTOES[pergunta?.campo] || [];

  return (
    <div className="pr-cartao" data-pv-completar={pergunta ? pergunta.campo : fim?.pronto ? "pronto" : "fim"}>
      <p><b>🗣️ Completar a ficha</b> — o PAIIA pergunta só o que falta. Responda falando ou digitando; para corrigir, é só dizer (ex.: “na verdade o preço é 42”).</p>
      <label className="pr-check" data-pv-completar-falar>
        <input type="checkbox" checked={falar} onChange={(e) => onFalar?.(e.target.checked)} /> PAIIA fala as perguntas
      </label>
      {historico.length > 0 && (
        <ul className="pr-fonte" data-pv-completar-historico style={{ listStyle: "none", padding: 0, margin: "6px 0", maxHeight: 220, overflowY: "auto" }}>
          {historico.slice(-8).map((h, i) => (
            <li key={`${i}-${h.texto.slice(0, 12)}`} style={{ margin: "3px 0", textAlign: h.quem === "voce" ? "right" : "left" }}>
              <span style={{ display: "inline-block", padding: "4px 8px", borderRadius: 8, background: h.quem === "voce" ? "#1e3a8a" : "#334155" }}>{h.quem === "voce" ? "Você: " : "PAIIA: "}{h.texto}</span>
            </li>
          ))}
        </ul>
      )}
      {ocupado ? (
        <p className="pr-aviso" data-pv-completar-ocupado>⏳ {ocupado}</p>
      ) : pergunta ? (
        <p className="pr-pergunta-grande" data-pv-completar-pergunta style={{ fontSize: 18, fontWeight: 600 }}>{pergunta.texto}</p>
      ) : fim ? (
        <p data-pv-completar-fim style={{ fontWeight: 600 }}>{fim.pronto ? "✅ " : "ℹ️ "}{fim.texto}</p>
      ) : null}
      {pergunta && !ocupado && (
        <>
          <div className="pr-linha" style={{ flexWrap: "wrap", gap: 6 }}>
            {rapidos.map((b) => <button key={b} type="button" className="pr-botao pr-claro" onClick={() => onResponder?.(b)} data-pv-completar-rapido={b}>{b}</button>)}
            {pergunta.campo !== "conferir" && <button type="button" className="pr-link" onClick={() => onResponder?.("pular")} data-pv-completar-pular>Pular</button>}
          </div>
          <form className="pr-entrada" onSubmit={enviar}>
            <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Digite a resposta" aria-label="Resposta para o PAIIA" data-pv-completar-entrada />
            <button type="submit" className="pr-botao">OK</button>
          </form>
        </>
      )}
    </div>
  );
}
