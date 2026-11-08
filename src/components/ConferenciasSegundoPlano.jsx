// (08/11) Conferências pós-publicação em segundo plano (sem tela).
// Roda com o PAIIA aberto em QUALQUER tela/aparelho da conta: ao abrir, a cada minuto e
// quando a aba volta a ficar visível. Só uma aba por navegador roda (vez guardada aqui).
// Só leitura no ML e no Bling; o resultado vai para a ficha (e aparece na Central).
import { useEffect } from "react";
import { processarPosPendentes } from "../services/posPublicacaoService";

const CHAVE_VEZ = "paiiaPosPublicacaoVez";
const INTERVALO = 60_000;

function pegarVez(agora = Date.now()) {
  try {
    const v = Number(localStorage.getItem(CHAVE_VEZ) || 0);
    if (v && agora - v < INTERVALO - 5_000) return false;
    localStorage.setItem(CHAVE_VEZ, String(agora));
    return true;
  } catch {
    return true;
  }
}

export default function ConferenciasSegundoPlano({ userId }) {
  useEffect(() => {
    if (!userId) return undefined;
    let ativo = true;
    let rodando = false;
    const rodar = async () => {
      if (!ativo || rodando || !pegarVez()) return;
      rodando = true;
      try { await processarPosPendentes(); } catch { /* tenta na próxima */ } finally { rodando = false; }
    };
    const t0 = setTimeout(rodar, 3_000);
    const t = setInterval(rodar, INTERVALO);
    const aoVoltar = () => { if (document.visibilityState === "visible") rodar(); };
    document.addEventListener("visibilitychange", aoVoltar);
    globalThis.__paiiaRodarPosPublicacao = rodar;
    return () => { ativo = false; clearTimeout(t0); clearInterval(t); document.removeEventListener("visibilitychange", aoVoltar); };
  }, [userId]);
  return null;
}
