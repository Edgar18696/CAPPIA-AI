// =============================================================
// PAIIA Voz — TESTAR MICROFONE (22/10/2026). Funções puras.
//   Testes: scripts/testes/paiiaVozRapido.test.mjs
//
// O teste só MEDE o volume na hora (Web Audio, no próprio navegador):
// nada é gravado, guardado ou enviado. Mostra qual microfone o Chrome
// está usando — o mesmo que o reconhecimento de voz vai usar.
// =============================================================

/** Nível 0–100 a partir das amostras (−1…1) do microfone. 0 = silêncio. */
export function nivelDoSinal(amostras) {
  const a = amostras || [];
  if (!a.length) return 0;
  let soma = 0;
  for (let i = 0; i < a.length; i++) soma += a[i] * a[i];
  const rms = Math.sqrt(soma / a.length);
  if (!(rms > 0)) return 0;
  const db = 20 * Math.log10(rms); // −∞ … 0 dB
  return Math.max(0, Math.min(100, Math.round(((db + 60) / 60) * 100)));
}

/** Nível a partir do qual consideramos que a voz foi captada. */
export const NIVEL_VOZ = 35;

/** Tira "Padrão - " / "Default - " / "Comunicações - " do nome do Windows. */
export function nomeLimpo(rotulo) {
  return String(rotulo || "").replace(/^(?:padr[aã]o|default|comunica[cç][oõ]es|communications)\s*-\s*/i, "").trim();
}

/**
 * Lista de entradas de áudio (enumerateDevices) → itens para a tela.
 * No Windows o Chrome lista "default" (Padrão) e "communications" à parte:
 * viram marcações no microfone real correspondente.
 */
export function listaMicrofones(dispositivos) {
  const entradas = (dispositivos || []).filter((d) => d && d.kind === "audioinput");
  const padrao = entradas.find((d) => d.deviceId === "default");
  const nomePadrao = padrao ? nomeLimpo(padrao.label) : "";
  const reais = entradas.filter((d) => d.deviceId !== "default" && d.deviceId !== "communications");
  const lista = (reais.length ? reais : entradas).map((d, i) => {
    const nome = nomeLimpo(d.label) || `Microfone ${i + 1} (nome aparece depois de permitir)`;
    return { id: d.deviceId, nome, padrao: nomePadrao ? nome === nomePadrao || (padrao && d.groupId && d.groupId === padrao.groupId) : i === 0, usb: /usb/i.test(d.label || "") };
  });
  return { lista, nomePadrao: nomePadrao || (lista[0]?.nome || "") };
}

/** Mensagem clara para cada erro do getUserMedia. */
export function mensagemErroMicrofone(erro, { seguro = true } = {}) {
  const nome = String(erro?.name || "");
  if (!seguro) return "O microfone só funciona em endereço seguro (https ou localhost). Abra o PAIIA pelo endereço do teste (http://localhost…).";
  if (nome === "NotAllowedError" || nome === "SecurityError" || nome === "PermissionDeniedError") {
    return "O Chrome bloqueou o microfone neste endereço. Clique no ícone à esquerda do endereço → Microfone → Permitir, e toque em “Testar de novo”.";
  }
  if (nome === "NotFoundError" || nome === "OverconstrainedError" || nome === "DevicesNotFoundError") {
    return "Nenhum microfone encontrado (ou o escolhido foi desconectado). Conecte o microfone USB e toque em “Testar de novo”.";
  }
  if (nome === "NotReadableError" || nome === "TrackStartError" || nome === "AbortError") {
    return "O Windows não liberou o microfone: ele pode estar em uso por outro programa (Zoom, Teams, WhatsApp) ou desativado em Configurações → Privacidade → Microfone.";
  }
  if (nome === "SemSuporte") return "Este navegador não dá acesso ao microfone. Use o Google Chrome atualizado.";
  return `Não foi possível abrir o microfone (${nome || erro?.message || "erro desconhecido"}).`;
}
