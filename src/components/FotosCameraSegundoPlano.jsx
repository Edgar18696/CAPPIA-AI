// (09/11) Fotos da câmera do Foto IA em segundo plano (sem tela).
// Com o PAIIA aberto em QUALQUER tela: salva na Galeria e trata as fotos da fila deste
// aparelho (ao abrir, a cada 30 s, quando a aba volta e quando entra foto nova). Também
// retoma, uma vez por abertura, fotos da câmera de outro aparelho que ficaram sem tratamento.
import { useEffect } from "react";
import { EVENTO_CAMERA, filaCamera } from "../services/fotoIA/filaCameraApp";

const INTERVALO = 30_000;

export default function FotosCameraSegundoPlano({ userId }) {
  useEffect(() => {
    const fila = filaCamera(userId);
    if (!fila) return undefined;
    let ativo = true;
    const rodar = () => { if (ativo) fila.rodar().catch(() => {}); };
    const t0 = setTimeout(() => { rodar(); fila.retomarOutros().catch(() => {}); }, 4_000);
    const t = setInterval(rodar, INTERVALO);
    const aoVoltar = () => { if (document.visibilityState === "visible") rodar(); };
    const aoEvento = (e) => { if (e?.detail?.tipo === "adicionou" || e?.detail?.tipo === "tentar") rodar(); };
    document.addEventListener("visibilitychange", aoVoltar);
    globalThis.addEventListener(EVENTO_CAMERA, aoEvento);
    return () => {
      ativo = false;
      clearTimeout(t0);
      clearInterval(t);
      document.removeEventListener("visibilitychange", aoVoltar);
      globalThis.removeEventListener(EVENTO_CAMERA, aoEvento);
    };
  }, [userId]);
  return null;
}
