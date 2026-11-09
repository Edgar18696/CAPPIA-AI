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
import { categoriaEGravar, confirmarCategoriaEGravar, buscarCategoriasEmOutra, confirmarCategoriaEscolhidaEGravar, gravarAtributoCategoriaVoz } from "./servicos/preparoVozService";

// (09/11) Atributos obrigatórios da categoria (Modelo, Tipo de produto…): gravados na mesma ficha.
function AtributosVoz({ atributos, onSalvar }) {
  const [texto, setTexto] = useState({});
  // Só categoria fora de “Acessórios para Veículos” (ex.: Relés): nas de veículos nada muda.
  if (!atributos?.exigir) return null;
  return (
    <div className="pr-cartao pr-cinza" data-pv-categoria-atributos={atributos.completo ? "completos" : "pendentes"} style={{ marginTop: 8 }}>
      <span className="pr-rotulo">{atributos.completo ? "✅ Atributos obrigatórios da categoria" : `Preencha ${atributos.pendentes.length === 1 ? "o atributo obrigatório" : `os ${atributos.pendentes.length} atributos obrigatórios`} da categoria`}</span>
      {atributos.pendentes.map((a) => (
        <div key={a.id} data-pv-atributo-pendente={a.id} style={{ marginTop: 6 }}>
          <strong>{a.nome}</strong>
          {a.duvida ? <p className="pr-aviso" style={{ margin: "2px 0" }}>⚠️ {a.duvida}</p> : null}
          {a.tipo === "lista" ? (
            <select data-pv-atributo-valor={a.id} value="" onChange={(ev) => { const o = a.valores.find((v) => v.id === ev.target.value); if (o) onSalvar(a, { valueId: o.id, valueName: o.name }); }} style={{ display: "block", marginTop: 4, padding: 10, fontSize: 16, width: "100%" }}>
              <option value="">— escolha —</option>
              {a.valores.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          ) : (
            <div className="pr-linha" style={{ gap: 8, marginTop: 4 }}>
              <input data-pv-atributo-valor={a.id} value={texto[a.id] || ""} onChange={(ev) => setTexto((t) => ({ ...t, [a.id]: ev.target.value }))} style={{ flex: 1, padding: 10, fontSize: 16, minWidth: 0 }} />
              <button type="button" className="pr-botao" data-pv-atributo-salvar={a.id} disabled={!String(texto[a.id] || "").trim()} onClick={() => onSalvar(a, { valueName: String(texto[a.id] || "").trim() })}>Salvar</button>
            </div>
          )}
        </div>
      ))}
      {atributos.preenchidos.length > 0 && (
        <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
          {atributos.preenchidos.map((a) => (
            <li key={a.id} data-pv-atributo-ok={a.id}>
              {a.nome}: <strong>{a.valor}</strong> <span className="pr-fonte">({a.origem})</span>{" "}
              <button type="button" className="pr-link" data-pv-atributo-alterar={a.id} onClick={() => onSalvar(a, { valueId: "", valueName: "" })}>alterar</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const depsTeste = () => (globalThis.__paiiaModoTeste && globalThis.__paiiaCategoriaDeps) || null;
const caminhoDo = (item) => item?.caminho || (String(item?.texto || "").match(/— (.+?) \(/) || [])[1] || item?.id || "";

export default function CategoriaVoz({ fichaId, aoMudar = null, versaoNuvem = 0, aplicacoes = [] }) {
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
  // Categoria fora de “Acessórios para Veículos” (ex.: Relés): a etapa só fica feita com os atributos obrigatórios.
  const faltaAtributo = Boolean(ok && item.atributos?.exigir && !item.atributos.completo);
  useEffect(() => {
    if (!estado.lendo) aoMudar?.(ok && !faltaAtributo ? { ok: true, id: item.id, caminho: caminhoDo(item), automatica: Boolean(item.automatica) } : { ok: false });
  }, [estado.lendo, ok, faltaAtributo, item, aoMudar]);

  async function salvarAtributo(atributo, valor) {
    setEstado((e) => ({ ...e, lendo: true }));
    const r = await (depsTeste()?.gravarAtributo || gravarAtributoCategoriaVoz)(fichaId, { atributo, ...valor });
    if (!r?.ok) { setEstado((e) => ({ ...e, lendo: false, erro: r?.erro || "Não consegui gravar o atributo." })); return; }
    await conferir();
  }

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
    setBusca((b) => ({ ...b, carregando: false, avaliacao: r?.ok ? r.avaliacao : b.avaliacao, buscada: r?.ok ? r.buscada || "" : b.buscada, erro: r?.ok ? "" : r?.erro || "Não consegui buscar." }));
  }
  async function escolher(candidata, revisao) {
    setEstado((e) => ({ ...e, lendo: true }));
    const prep = await lerPreparo();
    const r = await (depsTeste()?.confirmarEscolhida || confirmarCategoriaEscolhidaEGravar)(fichaId, prep, { candidata, avaliacao: busca.avaliacao || prep?.verificacoes?.categoria?.avaliacao || null, revisao });
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
          {item.id && <p className="pr-fonte" data-pv-categoria-id={item.id} style={{ margin: 0 }}>ID oficial no Mercado Livre: {item.id}</p>}
          <p className="pr-fonte" style={{ margin: 0 }} data-pv-categoria-origem={item.preferencia ? "preferencia" : item.automatica ? "automatica" : "manual"}>{item.preferencia && item.automatica ? "Selecionada pela regra permanente do PAIIA (relés automotivos): ID conferido agora na API do Mercado Livre. Pode alterar." : item.automatica ? "Selecionada automaticamente: única categoria válida para a peça, com os atributos obrigatórios conferidos." : "Escolhida por você."}</p>
          <AtributosVoz atributos={item.atributos} onSalvar={salvarAtributo} />
        </>
      ) : item?.estado === "bloqueio" ? (
        <>
          <span className="pr-rotulo">Categoria escolhida — não passou na conferência</span>
          <p data-pv-categoria-caminho data-pv-categoria-bloqueio={item.id} style={{ fontWeight: 600, margin: "4px 0" }}>{item.caminho || item.id} ({item.id})</p>
          <p className="pr-aviso" style={{ margin: 0 }}>⚠️ {item.texto}</p>
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
      {/* (12/11) Aplicações já cadastradas, organizadas. O ano é da APLICAÇÃO do veículo, não da categoria. */}
      {aplicacoes.length > 0 && (
        <div className="pr-cartao pr-cinza" data-pv-categoria-aplicacoes style={{ marginTop: 8 }}>
          <span className="pr-rotulo">Aplicações cadastradas (o ano é da aplicação, não da categoria)</span>
          <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
            {aplicacoes.map((a) => (
              <li key={a.id} data-pv-categoria-aplicacao>
                {[a.montadora, (a.modelos || []).join("/"), (a.motores || []).join("/") || "motor a conferir", a.anoInicio ? (a.anoFim && a.anoFim !== a.anoInicio ? `${a.anoInicio}–${a.anoFim}` : String(a.anoInicio)) : ""].filter(Boolean).join(" · ")}
              </li>
            ))}
          </ul>
        </div>
      )}
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
            preferida={busca.aberta ? busca.buscada || "" : ""}
            avancadoAberto={Boolean(busca.aberta && busca.avaliacao)}
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
