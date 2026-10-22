// =============================================================
// PAIIA Voz — botão "Testar microfone" (22/10/2026).
// Mostra o microfone que o Chrome está usando (o mesmo do reconhecimento
// de voz), uma barra com o volume captado e a lista de microfones.
// NADA é gravado nem enviado: o som só é medido na hora (Web Audio).
// =============================================================
import { useCallback, useEffect, useRef, useState } from "react";
import { nivelDoSinal, NIVEL_VOZ, listaMicrofones, mensagemErroMicrofone, nomeLimpo } from "./servicos/testeMicrofone";

const DURACAO_MS = 60000;

export default function TesteMicrofone({ onAbrir, desligar = false }) {
  const [aberto, setAberto] = useState(false);
  const [estado, setEstado] = useState({ fase: "parado", nome: "", erro: "" });
  const [nivel, setNivel] = useState(0);
  const [pico, setPico] = useState(0);
  const [micros, setMicros] = useState({ lista: [], nomePadrao: "" });
  const [escolhido, setEscolhido] = useState("");
  const recursos = useRef({ stream: null, ctx: null, raf: 0, fim: 0 });

  const parar = useCallback(() => {
    const r = recursos.current;
    if (r.raf) cancelAnimationFrame(r.raf);
    if (r.fim) clearTimeout(r.fim);
    try { r.stream?.getTracks().forEach((t) => t.stop()); } catch { /* já parado */ }
    try { r.ctx?.close(); } catch { /* já fechado */ }
    recursos.current = { stream: null, ctx: null, raf: 0, fim: 0 };
    setNivel(0);
    setEstado((e) => (e.fase === "ouvindo" || e.fase === "pedindo" ? { ...e, fase: "parado" } : e));
  }, []);

  const lerLista = useCallback(async () => {
    try {
      const d = await navigator.mediaDevices.enumerateDevices();
      setMicros(listaMicrofones(d));
    } catch {
      // sem lista
    }
  }, []);

  const iniciar = useCallback(async (deviceId = "") => {
    parar();
    onAbrir?.();
    setPico(0);
    const seguro = globalThis.isSecureContext !== false;
    if (!seguro || !navigator.mediaDevices?.getUserMedia) {
      setEstado({ fase: "erro", nome: "", erro: mensagemErroMicrofone({ name: seguro ? "SemSuporte" : "" }, { seguro }) });
      return;
    }
    setEstado({ fase: "pedindo", nome: "", erro: "" });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: deviceId ? { deviceId: { exact: deviceId } } : true, video: false });
      const trilha = stream.getAudioTracks()[0];
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      const analisador = ctx.createAnalyser();
      analisador.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(analisador); // não vai para o alto-falante
      const amostras = new Float32Array(analisador.fftSize);
      const r = recursos.current;
      r.stream = stream;
      r.ctx = ctx;
      const passo = () => {
        analisador.getFloatTimeDomainData(amostras);
        const n = nivelDoSinal(amostras);
        setNivel(n);
        setPico((p) => (n > p ? n : p));
        r.raf = requestAnimationFrame(passo);
      };
      r.raf = requestAnimationFrame(passo);
      r.fim = setTimeout(() => parar(), DURACAO_MS);
      trilha?.addEventListener?.("ended", () => setEstado({ fase: "erro", nome: "", erro: "O microfone foi desconectado. Conecte de novo e toque em “Testar de novo”." }));
      setEstado({ fase: "ouvindo", nome: nomeLimpo(trilha?.label) || "(sem nome)", erro: "" });
      lerLista();
    } catch (e) {
      setEstado({ fase: "erro", nome: "", erro: mensagemErroMicrofone(e) });
      lerLista();
    }
  }, [lerLista, onAbrir, parar]);

  // Microfone ligado/desligado no computador (USB): a lista se atualiza sozinha.
  useEffect(() => {
    const md = navigator.mediaDevices;
    if (!aberto || !md?.addEventListener) return undefined;
    md.addEventListener("devicechange", lerLista);
    return () => md.removeEventListener("devicechange", lerLista);
  }, [aberto, lerLista]);
  // O reconhecimento de voz ligou: o teste para (um uso do microfone por vez).
  // eslint-disable-next-line react-hooks/set-state-in-effect -- desligar o teste quando o reconhecimento liga (recurso externo: microfone)
  useEffect(() => { if (desligar) parar(); }, [desligar, parar]);
  useEffect(() => () => parar(), [parar]);

  const ouvindo = estado.fase === "ouvindo";
  const captou = pico >= NIVEL_VOZ;
  return (
    <div className="pr-teste-mic" data-pv-teste-mic>
      <button
        type="button"
        className="pr-link"
        data-pv-testar-microfone
        onClick={() => {
          if (aberto) { parar(); setAberto(false); return; }
          setAberto(true);
          iniciar(escolhido);
        }}
      >
        🎚️ {aberto ? "Fechar teste do microfone" : "Testar microfone"}
      </button>
      {aberto && (
        <div className="pr-cartao" data-pv-teste-mic-painel data-pv-teste-mic-fase={estado.fase} style={{ marginTop: 8 }}>
          {estado.fase === "pedindo" && <p>Pedindo permissão do microfone… Se o Chrome perguntar, clique em <b>Permitir</b>.</p>}
          {estado.fase === "erro" && <p className="pr-erro" role="alert" data-pv-teste-mic-erro>{estado.erro}</p>}
          {(ouvindo || estado.nome) && (
            <p data-pv-teste-mic-nome>
              {escolhido ? "Microfone testado: " : "Microfone em uso pelo Chrome: "}<b>{estado.nome}</b>{/usb/i.test(estado.nome) ? " (USB)" : ""}
              {escolhido && micros.nomePadrao && micros.nomePadrao !== estado.nome ? <span style={{ display: "block", color: "#fde68a" }}>Atenção: o reconhecimento de voz usa o padrão do Chrome ({micros.nomePadrao}), não este. Veja abaixo como trocar.</span> : null}
            </p>
          )}
          {ouvindo && (
            <>
              <div aria-label={`Nível do microfone: ${nivel}`} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={nivel} data-pv-teste-mic-nivel={nivel} style={{ height: 14, borderRadius: 7, background: "#1e293b", overflow: "hidden", margin: "6px 0" }}>
                <div style={{ width: `${nivel}%`, height: "100%", background: nivel >= NIVEL_VOZ ? "#22c55e" : "#64748b", transition: "width 80ms linear" }} />
              </div>
              <p data-pv-teste-mic-captou={captou ? "sim" : "nao"} style={{ margin: "4px 0", color: captou ? "#86efac" : "#fde68a" }}>
                {captou ? "✔ Captando a sua voz. O microfone está funcionando." : "Fale algo perto do microfone: a barra deve subir e ficar verde."}
              </p>
            </>
          )}
          {micros.lista.length > 0 && (
            <label style={{ display: "block", marginTop: 6 }}>
              Microfones encontrados ({micros.lista.length}):{" "}
              <select data-pv-teste-mic-lista value={escolhido} onChange={(e) => { setEscolhido(e.target.value); iniciar(e.target.value); }}>
                <option value="">Padrão do Chrome{micros.nomePadrao ? ` — ${micros.nomePadrao}` : ""}</option>
                {micros.lista.map((m) => (
                  <option key={m.id} value={m.id}>{m.nome}{m.padrao ? " (padrão)" : ""}</option>
                ))}
              </select>
            </label>
          )}
          <p style={{ fontSize: 12, color: "#94a3b8", margin: "6px 0 0" }}>
            O reconhecimento de voz usa o microfone <b>padrão do Chrome</b>. Se o USB não for o padrão: clique no ícone à esquerda do endereço → Configurações do site → Microfone, ou abra chrome://settings/content/microphone e escolha o USB. No Windows: Configurações → Sistema → Som → Entrada. Nada é gravado: o som só é medido aqui, na hora.
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            {ouvindo
              ? <button type="button" className="pr-link" onClick={parar} data-pv-teste-mic-parar>Parar teste</button>
              : <button type="button" className="pr-link" onClick={() => iniciar(escolhido)} data-pv-teste-mic-de-novo>Testar de novo</button>}
          </div>
        </div>
      )}
    </div>
  );
}
