// =============================================================
// PAIIA Voz — RECONHECIMENTO DE VOZ DO NAVEGADOR (Web Speech API).
//   Testes: scripts/testes/paiiaVoz.test.mjs (navegador simulado)
//
// Gratuito e sem chave: usa o reconhecimento embutido do navegador
// (Chrome/Edge no computador, Chrome no Android; Safari parcial). Em
// navegador sem suporte, a tela oferece digitação. Nenhum áudio é
// guardado pelo PAIIA — só o texto reconhecido.
// Observação: no Chrome, o áudio é processado pelo serviço de voz do
// próprio navegador (Google), como em qualquer ditado do Chrome.
// =============================================================

export function construtorReconhecimento(janela) {
  const w = janela || globalThis.window;
  if (!w) return null;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function suportaReconhecimento(janela) {
  return Boolean(construtorReconhecimento(janela));
}

/**
 * (22/10/2026) O que avisar ao ABRIR a tela (antes de tocar no microfone):
 * navegador sem reconhecimento de voz, endereço inseguro ou sem acesso ao
 * microfone. Sem aviso = pode tentar falar.
 */
export function diagnosticoVoz(janela) {
  const w = janela || globalThis.window;
  const suporta = suportaReconhecimento(w);
  const seguro = !w || w.isSecureContext !== false;
  const temMicrofone = Boolean(w?.navigator?.mediaDevices?.getUserMedia);
  let aviso = "";
  if (!suporta) aviso = "Este navegador não tem reconhecimento de voz. Use o Google Chrome (ou o Microsoft Edge) no computador, ou o Chrome no Android. Você pode digitar normalmente.";
  else if (!seguro) aviso = "O microfone só funciona em endereço seguro (https ou localhost). Abra o PAIIA pelo endereço do teste. Você pode digitar normalmente.";
  else if (!temMicrofone) aviso = "Este navegador não dá acesso ao microfone. Use o Google Chrome atualizado. Você pode digitar normalmente.";
  return { suporta, seguro, temMicrofone, aviso };
}

export const MENSAGENS_ERRO = {
  "not-allowed": "O navegador bloqueou o microfone. Libere o acesso ao microfone para este site (ícone de cadeado na barra de endereço) ou digite abaixo.",
  "service-not-allowed": "O reconhecimento de voz não está liberado neste navegador. Use o Chrome ou digite abaixo.",
  "no-speech": "Não ouvi nada. Fale perto do microfone. Se continuar, use “Testar microfone” para ver qual microfone o Chrome está usando.",
  "audio-capture": "Nenhum microfone encontrado (ou em uso por outro programa). Conecte o microfone, use “Testar microfone” ou digite abaixo.",
  network: "O reconhecimento de voz precisa de internet. Verifique a conexão ou digite abaixo.",
  aborted: "",
  "language-not-supported": "Português não está disponível no reconhecimento deste navegador. Digite abaixo.",
};

// Erros que encerram de vez (não adianta religar sozinho).
const ERROS_FATAIS = new Set(["not-allowed", "service-not-allowed", "audio-capture", "language-not-supported", "network"]);

/**
 * Cria um controlador simples:
 *   iniciar(), parar(), get ouvindo
 * Eventos: onParcial(texto), onFinal(texto), onErro(mensagem), onEstado(ouvindo)
 *
 * manterLigado (celular): o Chrome do Android encerra o microfone a cada
 * pausa. Com esta opção o PAIIA religa sozinho até a pessoa tocar em
 * "Parar" (no máximo maxReinicios vezes seguidas sem fala). Cada frase
 * é processada uma vez: o Android às vezes entrega o mesmo resultado
 * final duas vezes, e a repetição imediata é ignorada.
 */
export function criarReconhecedor({ janela, idioma = "pt-BR", onParcial, onFinal, onErro, onEstado, manterLigado = false, maxReinicios = 20, agora = () => Date.now(), agendar = (fn, ms) => setTimeout(fn, ms) } = {}) {
  const Construtor = construtorReconhecimento(janela);
  if (!Construtor) return null;
  let rec = null;
  let ouvindo = false;
  let querParar = false;
  let fatal = false;
  let semFala = 0;
  let ultimo = { texto: "", em: 0 };
  let manter = Boolean(manterLigado);
  const estado = (v) => {
    if (ouvindo === v) return;
    ouvindo = v;
    onEstado?.(v);
  };

  function ligarUmaVez() {
    rec = new Construtor();
    rec.lang = idioma;
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    let falouNestaVez = false;
    rec.onresult = (ev) => {
      let parcial = "";
      let final = "";
      for (let i = ev.resultIndex ?? 0; i < ev.results.length; i++) {
        const r = ev.results[i];
        const t = r[0]?.transcript || "";
        if (r.isFinal) final += t;
        else parcial += t;
      }
      if (parcial) onParcial?.(parcial.trim());
      const f = final.trim();
      if (f) {
        falouNestaVez = true;
        const repetido = f.toLowerCase() === ultimo.texto && agora() - ultimo.em < 2500;
        ultimo = { texto: f.toLowerCase(), em: agora() };
        if (!repetido) onFinal?.(f);
      }
    };
    rec.onerror = (ev) => {
      const codigo = ev?.error;
      if (ERROS_FATAIS.has(codigo)) fatal = true;
      if (manter && !fatal && (codigo === "no-speech" || codigo === "aborted")) return; // religa em silêncio
      const msg = MENSAGENS_ERRO[codigo] ?? `Falha no reconhecimento de voz (${codigo || "desconhecida"}). Digite abaixo.`;
      if (msg) onErro?.(msg);
    };
    rec.onend = () => {
      semFala = falouNestaVez ? 0 : semFala + 1;
      if (manter && !querParar && !fatal && semFala < maxReinicios) {
        agendar(() => {
          if (querParar || fatal) { estado(false); return; }
          try { ligarUmaVez(); } catch (e) { estado(false); onErro?.(`Não foi possível religar o microfone: ${e?.message || e}`); }
        }, 250);
        return;
      }
      if (manter && semFala >= maxReinicios) onErro?.("Microfone desligado depois de um tempo sem fala. Toque no microfone para continuar.");
      estado(false);
    };
    rec.start();
  }

  function iniciar() {
    if (ouvindo) return;
    querParar = false;
    fatal = false;
    semFala = 0;
    try {
      ligarUmaVez();
      estado(true);
    } catch (e) {
      estado(false);
      onErro?.(`Não foi possível ligar o microfone: ${e?.message || e}`);
    }
  }

  function parar() {
    querParar = true;
    try {
      rec?.stop();
    } catch {
      // já parado
    }
    estado(false);
  }

  return {
    iniciar,
    parar,
    get ouvindo() {
      return ouvindo;
    },
    set manterLigado(v) {
      manter = Boolean(v);
    },
    get manterLigado() {
      return manter;
    },
  };
}
