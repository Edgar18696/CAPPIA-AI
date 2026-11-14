// (09/11) Foto IA: "Tirar Foto" (câmera do celular) e "Escolher Foto".
// Tirar Foto → a original vai NA HORA para a Galeria PAIIA → tratamento automático
// (fundo branco 1200×1200) → a mesma foto na Galeria fica tratada. Pode sair da tela:
// o trabalho continua em segundo plano (FotosCameraSegundoPlano) e é retomado se o
// navegador fechar. "Escolher Foto" abre a escolha de sempre (lotes de até 8).
// (14/11) Tela simples: só "Tratando fotografia" e "Salva na Galeria". Baixar a foto
// fica na Galeria (o botão "Salvar no celular" saiu daqui).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../../supabase";
import { usuarioDaGaleria } from "../../paiiaVoz/servicos/galeriaVoz";
import { EVENTO_CAMERA, filaCamera } from "../../../services/fotoIA/filaCameraApp";
import { ROTULO_CAMERA, resumoCamera } from "../../../services/fotoIA/fotoCameraGaleria";
import { marcarCameraAberta, limparCameraAberta, fotoPerdidaNaRecarga, MSG_FOTO_PERDIDA } from "../../../services/fotoIA/cameraRetorno";

const COR = { salvando: "#93c5fd", salva: "#93c5fd", tratando: "#93c5fd", pronta: "#86efac", falhou: "#fca5a5" };

/** Só a parte clara da mensagem de falha (os detalhes técnicos ficam guardados). */
const erroCurto = (t) => String(t || "").split(" Detalhes:")[0];

function Miniatura({ item }) {
  const local = useMemo(() => (!item.urlTratada && item.blob instanceof Blob ? URL.createObjectURL(item.blob) : ""), [item.urlTratada, item.blob]);
  useEffect(() => () => { if (local) URL.revokeObjectURL(local); }, [local]);
  const src = item.urlTratada || local || item.url || "";
  return src ? <img src={src} alt="" style={{ width: 64, height: 64, objectFit: "contain", background: "#fff", borderRadius: 8, flex: "0 0 64px" }} /> : <div style={{ width: 64, height: 64, background: "#1e293b", borderRadius: 8 }} />;
}

export default function TirarFotoCamera({ usuarioId, aoEscolherFoto, abrirGaleria, desativado = false }) {
  const cameraRef = useRef(null);
  const [usuario, setUsuario] = useState(usuarioId || "");
  const [itens, setItens] = useState([]);
  const [prontas, setProntas] = useState([]);
  const [aviso, setAviso] = useState("");
  // (14/11) Foto perdida porque o celular recarregou a página com a câmera aberta.
  const [avisoPerda, setAvisoPerda] = useState(() =>
    fotoPerdidaNaRecarga(globalThis.sessionStorage, { inicioDaPagina: globalThis.performance?.timeOrigin }) ? MSG_FOTO_PERDIDA : "");

  useEffect(() => {
    let vivo = true;
    usuarioDaGaleria(supabase, usuarioId).then((u) => { if (vivo) setUsuario(u.id); });
    return () => { vivo = false; };
  }, [usuarioId]);

  const recarregar = useCallback(async () => {
    const fila = filaCamera(usuario);
    if (!fila) return;
    try { setItens(await fila.listar()); } catch { /* sem IndexedDB */ }
    setProntas(fila.listarProntas?.() || []);
  }, [usuario]);

  useEffect(() => {
    const t = setTimeout(recarregar, 0);
    const aoMudar = () => { setAviso(""); recarregar(); };
    globalThis.addEventListener(EVENTO_CAMERA, aoMudar);
    return () => { clearTimeout(t); globalThis.removeEventListener(EVENTO_CAMERA, aoMudar); };
  }, [recarregar]);

  async function aoFotografar(e) {
    const arquivos = Array.from(e.target.files || []);
    e.target.value = "";
    limparCameraAberta(globalThis.sessionStorage);
    if (!arquivos.length) return;
    setAvisoPerda("");
    const fila = filaCamera(usuario);
    if (!fila) { setAviso("Entre na sua conta PAIIA para salvar as fotos na Galeria."); return; }
    try {
      const novos = await fila.adicionar(arquivos);
      if (!novos.length) setAviso("Esse arquivo não é uma imagem.");
    } catch (erro) {
      setAviso(`Não consegui guardar a foto neste aparelho (${erro?.message || erro}). Tente de novo.`);
    }
  }

  async function tentarDeNovo(id) {
    const fila = filaCamera(usuario);
    if (fila) fila.tentarDeNovo(id).catch(() => {});
  }

  async function removerDaFila(id) {
    const fila = filaCamera(usuario);
    if (fila && (await fila.removerDaFila(id).catch(() => false))) setAviso("Removida da fila. A foto original continua na Galeria.");
  }

  const botao = (cor) => ({ flex: "1 1 150px", padding: "16px 14px", borderRadius: 14, border: "none", fontSize: 17, fontWeight: 800, color: "#fff", background: cor, cursor: "pointer", minHeight: 56 });

  return (
    <section data-paiia-foto-camera style={{ maxWidth: 950, margin: "0 auto 20px", padding: 14, borderRadius: 16, background: "#0f172a", border: "1px solid #2563eb", boxSizing: "border-box" }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="button" data-paiia-tirar-foto disabled={desativado} onClick={() => { marcarCameraAberta(globalThis.sessionStorage); cameraRef.current?.click(); }} style={botao("linear-gradient(135deg,#2563eb,#06b6d4)")}>📷 Tirar Foto</button>
        <button type="button" data-paiia-escolher-foto disabled={desativado} onClick={aoEscolherFoto} style={botao("#334155")}>🖼️ Escolher Foto</button>
      </div>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={aoFotografar} data-paiia-camera-input />
      <p style={{ margin: "10px 2px 0", color: "#94a3b8", fontSize: 13, lineHeight: 1.4 }}>
        Tire a foto: o PAIIA coloca fundo branco e salva na Galeria. Dica: fotografe de perto, com a peça ocupando metade da tela.
      </p>
      {avisoPerda && <div data-paiia-camera-foto-perdida role="alert" style={{ marginTop: 10, padding: 10, borderRadius: 10, border: "1px solid #f59e0b", color: "#fde68a", fontSize: 14, fontWeight: 700 }}>⚠ {avisoPerda}</div>}
      {aviso && <div data-paiia-camera-aviso style={{ marginTop: 10, color: "#bfdbfe", fontSize: 14, fontWeight: 700 }}>{aviso}</div>}
      {(itens.length > 0 || prontas.length > 0) && (
        <div style={{ marginTop: 12 }}>
          <div data-paiia-camera-resumo style={{ color: "#bbf7d0", fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
            {resumoCamera(itens, prontas)}
            {abrirGaleria && prontas.length > 0 && <button type="button" onClick={abrirGaleria} style={{ marginLeft: 8, background: "none", border: "none", color: "#67e8f9", textDecoration: "underline", fontWeight: 700, cursor: "pointer", padding: 0 }}>Abrir Galeria</button>}
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {itens.slice(0, 12).map((item) => (
              <div key={item.id} data-paiia-camera-item={item.estado} style={{ display: "flex", gap: 10, alignItems: "center", background: "#020617", borderRadius: 12, padding: 8 }}>
                <Miniatura item={item} />
                <div style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
                  <div style={{ color: COR[item.estado] || "#e2e8f0", fontWeight: 700 }}>{ROTULO_CAMERA[item.estado] || item.estado}</div>
                  {item.estado === "falhou" && item.erro && <div style={{ color: "#94a3b8", marginTop: 2, overflowWrap: "anywhere" }} title={item.erro}>{erroCurto(item.erro)}</div>}
                </div>
                {item.estado === "falhou" && (
                  <div style={{ display: "grid", gap: 6 }}>
                    <button type="button" data-paiia-camera-tentar onClick={() => tentarDeNovo(item.id)} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #f87171", background: "transparent", color: "#fecaca", fontWeight: 700, cursor: "pointer" }}>Tentar de novo</button>
                    {/* (14/11) Só tira o aviso da fila; a original continua na Galeria. */}
                    {item.linhaId && <button type="button" data-paiia-camera-remover onClick={() => removerDaFila(item.id)} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #475569", background: "transparent", color: "#cbd5e1", fontWeight: 700, cursor: "pointer" }}>Remover da fila</button>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
