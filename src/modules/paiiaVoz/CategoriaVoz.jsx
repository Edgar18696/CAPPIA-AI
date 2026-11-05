// =============================================================
// PAIIA Voz — (Rodada 1) Etapa 7 "Categoria".
// - Categoria única válida, compatível e com atributos obrigatórios conferidos:
//   já aparece SELECIONADA (caminho completo), sem clique de confirmação.
// - Com dúvida: mostra a sugestão para você confirmar ou a busca para escolher.
// - "Alterar categoria": mesma busca e mesmas regras da Conferência do computador.
// Só lê o Mercado Livre; grava a decisão na MESMA ficha (registro reaproveitado na etapa 8).
// =============================================================
import { useCallback, useEffect, useState } from "react";
import PainelCategoriaML from "../../components/PainelCategoriaML";
import { lerFichaNovoAnuncio } from "../../services/fichaNovoAnuncioService";
import { categoriaEGravar, confirmarCategoriaEGravar, buscarCategoriasEmOutra, confirmarCategoriaEscolhidaEGravar } from "./servicos/preparoVozService";

const depsTeste = () => (globalThis.__paiiaModoTeste && globalThis.__paiiaCategoriaDeps) || null;
const caminhoDo = (item) => item?.caminho || (String(item?.texto || "").match(/— (.+?) \(/) || [])[1] || item?.id || "";

export default function CategoriaVoz({ fichaId, aoMudar = null, versaoNuvem = 0 }) {
  const [estado, setEstado] = useState({ lendo: true, item: null, erro: "" });
  const [busca, setBusca] = useState({ aberta: false, termo: "", avaliacao: null, carregando: false, erro: "" });
  const [preparo, setPreparo] = useState(null);

  const conferir = useCallback(async () => {
    if (!fichaId) { setEstado({ lendo: false, item: null, erro: "A ficha ainda não foi salva na sua conta (falta o código)." }); return; }
    setEstado((e) => ({ ...e, lendo: true, erro: "" }));
    const r = await (depsTeste()?.categoriaEGravar || categoriaEGravar)(fichaId);
    if (!r?.ok) { setEstado({ lendo: false, item: r?.item || null, erro: r?.erro || "Não consegui conferir a categoria." }); return; }
    setPreparo(r.ficha?.dados_conferencia?.paiia_voz?.preparo || null);
    setEstado({ lendo: false, item: r.item, erro: "" });
  }, [fichaId]);

  useEffect(() => { const t = setTimeout(conferir, 0); return () => clearTimeout(t); }, [conferir, versaoNuvem]);

  const item = estado.item;
  const ok = item?.estado === "ok";
  useEffect(() => {
    if (!estado.lendo) aoMudar?.(ok ? { ok: true, id: item.id, caminho: caminhoDo(item), automatica: Boolean(item.automatica) } : { ok: false });
  }, [estado.lendo, ok, item, aoMudar]);

  async function lerPreparo() {
    const r = await (depsTeste()?.lerFicha || lerFichaNovoAnuncio)(fichaId);
    return r?.ok ? r.ficha?.dados_conferencia?.paiia_voz?.preparo || null : preparo;
  }
  async function confirmarSugerida() {
    setEstado((e) => ({ ...e, lendo: true }));
    const r = await confirmarCategoriaEGravar(fichaId, await lerPreparo());
    if (!r?.ok) { setEstado((e) => ({ ...e, lendo: false, erro: r?.erro || "Não consegui confirmar." })); return; }
    await conferir();
  }
  async function buscar() {
    setBusca((b) => ({ ...b, carregando: true, erro: "" }));
    let r;
    try { r = await (depsTeste()?.buscarCategorias || buscarCategoriasEmOutra)(fichaId, busca.termo, { conta: "" }); } catch (e) { r = { ok: false, erro: e?.message || String(e) }; }
    setBusca((b) => ({ ...b, carregando: false, avaliacao: r?.ok ? r.avaliacao : b.avaliacao, erro: r?.ok ? "" : r?.erro || "Não consegui buscar." }));
  }
  async function escolher(candidata, revisao) {
    setEstado((e) => ({ ...e, lendo: true }));
    const prep = await lerPreparo();
    const r = await confirmarCategoriaEscolhidaEGravar(fichaId, prep, { candidata, avaliacao: busca.avaliacao || prep?.verificacoes?.categoria?.avaliacao || null, revisao });
    if (!r?.ok) { setEstado((e) => ({ ...e, lendo: false, erro: r?.erro || "Não consegui gravar a categoria." })); return; }
    setBusca({ aberta: false, termo: "", avaliacao: null, carregando: false, erro: "" });
    await conferir();
  }

  return (
    <div className="pr-cartao" data-pv-categoria-etapa={estado.lendo ? "lendo" : ok ? "ok" : item?.sugerida ? "sugerida" : "escolher"}>
      {estado.lendo ? (
        <p data-pv-categoria-texto>⏳ Conferindo a categoria no Mercado Livre (só leitura)…</p>
      ) : ok ? (
        <>
          <span className="pr-rotulo">Categoria selecionada</span>
          <p data-pv-categoria-caminho style={{ fontWeight: 600, margin: "4px 0" }}>{caminhoDo(item)}</p>
          <p className="pr-fonte" style={{ margin: 0 }}>{item.automatica ? "Selecionada automaticamente: única categoria válida para a peça, com os atributos obrigatórios conferidos." : "Escolhida por você."}</p>
        </>
      ) : item?.sugerida ? (
        <>
          <span className="pr-rotulo">Categoria sugerida — confirme ou altere</span>
          <p data-pv-categoria-caminho style={{ fontWeight: 600, margin: "4px 0" }}>{item.caminho || item.sugerida}</p>
          <p className="pr-fonte" style={{ margin: 0 }}>O PAIIA não teve segurança para selecionar sozinho (mais de uma opção ou atributo a conferir).</p>
          <button type="button" className="pr-botao pr-grande" onClick={confirmarSugerida} data-pv-categoria-confirmar>✅ Usar esta categoria</button>
        </>
      ) : (
        <p data-pv-categoria-texto>{estado.erro ? `⚠️ ${estado.erro}` : "⚠️ Não há uma categoria segura: escolha abaixo antes de finalizar."}</p>
      )}
      {!estado.lendo && estado.erro && (ok || item?.sugerida) && <p className="pr-aviso">⚠️ {estado.erro}</p>}
      {!estado.lendo && (
        <div className="pr-linha" style={{ gap: 8 }}>
          {!busca.aberta && <button type="button" className="pr-link" onClick={() => setBusca((b) => ({ ...b, aberta: true }))} data-pv-alterar-categoria>Alterar categoria</button>}
          {estado.erro && <button type="button" className="pr-link" onClick={conferir} data-pv-categoria-de-novo>Conferir de novo</button>}
        </div>
      )}
      {(busca.aberta || (!estado.lendo && !ok && !item?.sugerida && !estado.erro)) && (
        <div className="pr-cartao pr-cinza" data-pv-categoria-busca>
          <div className="pr-linha pr-entre"><strong>Escolher a categoria</strong>{busca.aberta && <button type="button" className="pr-link" onClick={() => setBusca({ aberta: false, termo: "", avaliacao: null, carregando: false, erro: "" })}>Fechar</button>}</div>
          {busca.erro && <p className="pr-aviso">⚠️ {busca.erro}</p>}
          <PainelCategoriaML
            carregando={busca.carregando}
            avaliacao={busca.avaliacao || item?.avaliacao || null}
            decisao={busca.aberta ? null : preparo?.categoria?.decisao || null}
            categoriaId={busca.aberta ? "" : preparo?.categoria?.decisao?.confirmada?.id || ""}
            onConfirmar={escolher}
            onTrocar={() => setBusca((b) => ({ ...b, aberta: true }))}
            termo={busca.termo}
            onTermo={(t) => setBusca((b) => ({ ...b, termo: t }))}
            onBuscar={buscar}
          />
        </div>
      )}
    </div>
  );
}
