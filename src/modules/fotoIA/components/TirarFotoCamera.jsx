// (09/11) Foto IA: "Tirar Foto" (câmera do celular) e "Escolher Foto".
// Tirar Foto → a original vai NA HORA para a Galeria PAIIA → tratamento automático
// (fundo branco 1200×1200) → a mesma foto na Galeria fica tratada. Pode sair da tela:
// o trabalho continua em segundo plano (FotosCameraSegundoPlano) e é retomado se o
// navegador fechar. "Escolher Foto" abre a escolha de sempre (lotes de até 8).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../../supabase";
import { usuarioDaGaleria } from "../../paiiaVoz/servicos/galeriaVoz";
import { EVENTO_CAMERA, filaCamera } from "../../../services/fotoIA/filaCameraApp";
import { ROTULO_CAMERA, resumoCamera } from "../../../services/fotoIA/fotoCameraGaleria";

const COR = { salvando: "#fde68a", salva: "#93c5fd", tratando: "#93c5fd", pronta: "#86efac", falhou: "#fca5a5" };

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
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    let vivo = true;
    usuarioDaGaleria(supabase, usuarioId).then((u) => { if (vivo) setUsuario(u.id); });
    return () => { vivo = false; };
  }, [usuarioId]);

  const recarregar = useCallback(async () => {
    const fila = filaCamera(usuario);
    if (!fila) return;
    try { setItens(await fila.listar()); } catch { /* sem IndexedDB */ }
  }, [usuario]);

  useEffect(() => {
    const t = setTimeout(recarregar, 0);
    const aoMudar = () => recarregar();
    globalThis.addEventListener(EVENTO_CAMERA, aoMudar);
    return () => { clearTimeout(t); globalThis.removeEventListener(EVENTO_CAMERA, aoMudar); };
  }, [recarregar]);

  async function aoFotografar(e) {
    const arquivos = Array.from(e.target.files || []);
    e.target.value = "";
    if (!arquivos.length) return;
    const fila = filaCamera(usuario);
    if (!fila) { setAviso("Entre na sua conta PAIIA para salvar as fotos na Galeria."); return; }
    try {
      const novos = await fila.adicionar(arquivos);
      setAviso(novos.length ? "📥 Foto recebida: salvando na Galeria e tratando sozinho. Pode tirar a próxima ou sair da tela." : "Esse arquivo não é uma imagem.");
    } catch (erro) {
      setAviso(`Não consegui guardar a foto neste aparelho (${erro?.message || erro}). Tente de novo.`);
    }
  }

  async function tentarDeNovo(id) {
    const fila = filaCamera(usuario);
    if (fila) fila.tentarDeNovo(id).catch(() => {});
  }

  const botao = (cor) => ({ flex: "1 1 150px", padding: "16px 14px", borderRadius: 14, border: "none", fontSize: 17, fontWeight: 800, color: "#fff", background: cor, cursor: "pointer", minHeight: 56 });

  return (
    <section data-paiia-foto-camera style={{ maxWidth: 950, margin: "0 auto 20px", padding: 14, borderRadius: 16, background: "#0f172a", border: "1px solid #2563eb", boxSizing: "border-box" }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="button" data-paiia-tirar-foto disabled={desativado} onClick={() => cameraRef.current?.click()} style={botao("linear-gradient(135deg,#2563eb,#06b6d4)")}>📷 Tirar Foto</button>
        <button type="button" data-paiia-escolher-foto disabled={desativado} onClick={aoEscolherFoto} style={botao("#334155")}>🖼️ Escolher Foto</button>
      </div>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={aoFotografar} data-paiia-camera-input />
      <p style={{ margin: "10px 2px 0", color: "#94a3b8", fontSize: 13, lineHeight: 1.4 }}>
        Tirar Foto: salva na Galeria PAIIA na hora e trata sozinho (fundo branco 1200×1200). Fica disponível no PAIIA Voz e no Criar Anúncio.
      </p>
      {aviso && <div data-paiia-camera-aviso style={{ marginTop: 10, color: "#bfdbfe", fontSize: 14, fontWeight: 700 }}>{aviso}</div>}
      {itens.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div data-paiia-camera-resumo style={{ color: "#bbf7d0", fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
            {resumoCamera(itens)}
            {abrirGaleria && <button type="button" onClick={abrirGaleria} style={{ marginLeft: 8, background: "none", border: "none", color: "#67e8f9", textDecoration: "underline", fontWeight: 700, cursor: "pointer", padding: 0 }}>Abrir Galeria</button>}
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {itens.slice(0, 12).map((item) => (
              <div key={item.id} data-paiia-camera-item={item.estado} style={{ display: "flex", gap: 10, alignItems: "center", background: "#020617", borderRadius: 12, padding: 8 }}>
                <Miniatura item={item} />
                <div style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
                  <div style={{ color: COR[item.estado] || "#e2e8f0", fontWeight: 700 }}>{ROTULO_CAMERA[item.estado] || item.estado}</div>
                  {item.erro && item.estado !== "pronta" && <div style={{ color: "#94a3b8", marginTop: 2, overflowWrap: "anywhere" }}>{item.erro}</div>}
                  {item.baixaResolucao && <div style={{ color: "#fde68a", marginTop: 2 }}>Foto pequena: ficou ampliada.</div>}
                </div>
                {item.estado === "falhou" && (
                  <button type="button" data-paiia-camera-tentar onClick={() => tentarDeNovo(item.id)} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #f87171", background: "transparent", color: "#fecaca", fontWeight: 700, cursor: "pointer" }}>Tentar de novo</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
