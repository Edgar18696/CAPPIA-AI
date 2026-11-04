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
  tipoCategoria: ["Carro", "Linha pesada"],
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

export default function CompletarVoz({ historico = [], pergunta = null, fim = null, contas = [], ocupado = "", falar = true, onFalar, onResponder, aoFalar, campos = [], ouvindo = false, parcial = "", vozDisponivel = true, onMicrofone, recente = "" }) {
  const [texto, setTexto] = useState("");
  const [falando, setFalando] = useState(false);
  const ultimaFalada = useRef("");
  const cartaoRef = useRef(null);
  const fala = pergunta?.texto || fim?.texto || "";
  // Fala a pergunta nova (uma vez); o microfone pausa enquanto o PAIIA fala e volta depois.
  useEffect(() => {
    if (!falar || !fala || ocupado || ultimaFalada.current === fala) return;
    ultimaFalada.current = fala;
    falarTexto(fala, { aoComecar: () => { setFalando(true); aoFalar?.(true, fala); }, aoTerminar: () => { setFalando(false); aoFalar?.(false); } });
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
  // Situação: falando → ouvindo → processando → preenchido → aguardando
  const situacao = ocupado ? ["processando", `⏳ ${ocupado}`]
    : falando ? ["falando", "🔊 PAIIA falando…"]
      : ouvindo ? ["ouvindo", `🎤 Ouvindo…${parcial ? ` “${parcial}”` : ""}`]
        : recente ? ["preenchido", `✅ Preenchido: ${recente}`]
          : pergunta ? ["aguardando", vozDisponivel ? "⌛ Aguardando sua resposta — toque no microfone ou digite." : "⌨️ Voz indisponível neste aparelho: digite a resposta."]
            : ["fim", ""];

  return (
    <div ref={cartaoRef} className="pr-cartao" data-pv-completar={pergunta ? pergunta.campo : fim?.pronto ? "pronto" : "fim"} style={{ scrollMarginTop: 8 }}>
      <div className="pr-linha" style={{ alignItems: "center", gap: 8 }}>
        {vozDisponivel && (
          <button type="button" className={`pr-mic ${ouvindo ? "pr-mic-ouvindo" : ""}`} onClick={onMicrofone} aria-pressed={ouvindo} aria-label={ouvindo ? "Parar de ouvir" : "Falar"} data-pv-completar-mic style={{ width: 52, height: 52, flex: "0 0 auto" }}>🎤</button>
        )}
        <div style={{ flex: 1 }}>
          {ocupado ? null : pergunta ? (
            <p className="pr-pergunta-grande" data-pv-completar-pergunta style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>{pergunta.texto}</p>
          ) : fim ? (
            <p data-pv-completar-fim style={{ fontWeight: 600, margin: 0 }}>{fim.pronto ? "✅ " : "ℹ️ "}{fim.texto}</p>
          ) : null}
          {situacao[1] && <p className="pr-fonte" data-pv-completar-situacao={situacao[0]} role="status" style={{ margin: "4px 0 0" }}>{situacao[1]}</p>}
        </div>
      </div>
      {pergunta && !ocupado && (
        <>
          {rapidos.length > 0 && (
            <div className="pr-linha" style={{ flexWrap: "wrap", gap: 6 }}>
              {rapidos.map((b) => <button key={b} type="button" className="pr-botao pr-claro" onClick={() => onResponder?.(b)} data-pv-completar-rapido={b}>{b}</button>)}
            </div>
          )}
          <form className="pr-entrada" onSubmit={enviar}>
            <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Digite a resposta" aria-label="Resposta para o PAIIA" data-pv-completar-entrada />
            <button type="submit" className="pr-botao">OK</button>
          </form>
          {pergunta.campo !== "conferir" && <button type="button" className="pr-link" onClick={() => onResponder?.("pular")} data-pv-completar-pular>Não sei / deixar pendente</button>}
        </>
      )}
      {campos.length > 0 && (
        <dl className="pr-resumo" data-pv-completar-campos style={{ margin: "8px 0 0" }}>
          {campos.map((c) => (
            <div key={c.id} data-pv-campo={c.id} data-estado={c.atual ? "atual" : c.valor ? "ok" : c.pendente ? "pendente" : "vazio"} style={{ display: "contents" }}>
              <dt style={{ fontWeight: c.atual ? 700 : 400 }}>{c.atual ? "👉 " : ""}{c.rotulo}</dt>
              <dd style={{ color: c.valor ? undefined : c.pendente ? "#fbbf24" : "#94a3b8" }}>{c.valor || (c.pendente ? "pendente" : "—")}</dd>
            </div>
          ))}
        </dl>
      )}
      {historico.length > 0 && (
        <details className="pr-fonte" data-pv-completar-historico>
          <summary>Conversa ({historico.length})</summary>
          <ul style={{ listStyle: "none", padding: 0, margin: "6px 0" }}>
            {historico.slice(-12).map((h, i) => <li key={`${i}-${h.texto.slice(0, 12)}`}>{h.quem === "voce" ? "Você: " : "PAIIA: "}{h.texto}</li>)}
          </ul>
        </details>
      )}
      <label className="pr-check" data-pv-completar-falar>
        <input type="checkbox" checked={falar} onChange={(e) => onFalar?.(e.target.checked)} /> PAIIA fala as perguntas
      </label>
    </div>
  );
}
