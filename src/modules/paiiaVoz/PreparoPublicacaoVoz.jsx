// =============================================================
// PAIIA Voz — Etapa 2: "Conferir para publicar" no celular.
// Roda as conferências oficiais (somente leitura) sobre a ficha da conta,
// grava o resultado na ficha e mostra perguntas curtas. NÃO publica.
// =============================================================
import { useEffect, useState } from "react";
import { useContasML, contasMLConectadas } from "../../services/contaMLAtiva";
import { nomeDaLoja } from "../../services/duplicidadeML";
import { lerFichaNovoAnuncio } from "../../services/fichaNovoAnuncioService";
import { preparoAtual } from "./servicos/preparoConferenciaVoz";
import { prepararEGravar, confirmarCategoriaEGravar } from "./servicos/preparoVozService";

const ICONE = { ok: "✅", pergunta: "❓", bloqueio: "⛔", erro: "⚠️", aguardando: "⏳" };
const ORDEM = ["conta", "sku", "marca", "fotos", "categoria", "compatibilidade", "duplicidade", "bling", "frete"];

export default function PreparoPublicacaoVoz({ fichaId }) {
  const estadoContas = useContasML();
  const contas = contasMLConectadas(estadoContas).filter((c) => String(c.ml_user_id || "").trim());
  const [conta, setConta] = useState("");
  const [preparo, setPreparo] = useState(null);
  const [desatualizado, setDesatualizado] = useState("");
  const [rodando, setRodando] = useState(false);
  const [erro, setErro] = useState("");

  // Reabrir: mostra o último preparo gravado na ficha (e se ainda vale).
  useEffect(() => {
    let ativo = true;
    (async () => {
      if (!fichaId) return;
      const r = await lerFichaNovoAnuncio(fichaId);
      if (!ativo || !r.ok) return;
      const p = preparoAtual(r.ficha);
      if (p.preparo) {
        setPreparo(p.preparo);
        setConta((c) => c || p.preparo.conta || "");
        setDesatualizado(p.valido ? "" : p.motivo);
      }
    })();
    return () => { ativo = false; };
  }, [fichaId]);

  async function conferir() {
    if (!fichaId || rodando) return;
    setRodando(true);
    setErro("");
    const r = await prepararEGravar(fichaId, { conta });
    setRodando(false);
    if (r.preparo) { setPreparo(r.preparo); setDesatualizado(""); }
    if (!r.ok) setErro(r.erro || "Não consegui gravar a conferência na ficha.");
  }
  async function confirmarCategoria() {
    if (!preparo || rodando) return;
    setRodando(true);
    const r = await confirmarCategoriaEGravar(fichaId, preparo);
    setRodando(false);
    if (!r.ok) { setErro(r.erro || "Não consegui confirmar a categoria."); return; }
    await conferir(); // reconfere com a categoria confirmada
  }

  if (!fichaId) return <p className="pr-aviso" data-pv-preparo-sem-ficha>☁️ Salve a ficha na conta (informe o código) para conferir a publicação.</p>;
  const v = preparo?.verificacoes || {};
  return (
    <div className="pr-cartao" data-pv-preparo={preparo ? (preparo.pronto ? "pronto" : "pendente") : "nao"}>
      <p><b>🔎 Conferir para publicar</b> — as mesmas conferências da Publicação, só leitura. Nada é publicado aqui.</p>
      <label className="pr-fonte">Conta Mercado Livre:{" "}
        <select value={conta} onChange={(e) => setConta(e.target.value)} data-pv-preparo-conta>
          <option value="">— escolha —</option>
          {contas.map((c) => <option key={c.ml_user_id} value={String(c.ml_user_id)}>{nomeDaLoja(c.ml_user_id, c.nickname)}</option>)}
        </select>
      </label>
      <button type="button" className="pr-botao" disabled={rodando} onClick={conferir} data-pv-preparo-conferir>{rodando ? "⏳ Conferindo..." : preparo ? "🔄 Conferir de novo" : "🔎 Conferir agora"}</button>
      {desatualizado && <p className="pr-aviso" data-pv-preparo-desatualizado>⚠️ Conferência anterior desatualizada ({desatualizado}): confira de novo.</p>}
      {erro && <p className="pr-aviso" data-pv-preparo-erro>⚠️ {erro}</p>}
      {preparo && (
        <ul className="pr-fonte" data-pv-preparo-lista>
          {ORDEM.filter((k) => v[k]).map((k) => (
            <li key={k} data-pv-preparo-item={k} data-estado={v[k].estado}>
              {ICONE[v[k].estado] || "•"} {v[k].texto}
              {k === "categoria" && v[k].estado === "pergunta" && v[k].sugerida && (
                <> <button type="button" className="pr-link" disabled={rodando} onClick={confirmarCategoria} data-pv-preparo-confirmar-categoria>Confirmar {v[k].sugerida}</button></>
              )}
            </li>
          ))}
        </ul>
      )}
      {preparo?.pronto && <p data-pv-preparo-pronto>✅ Tudo conferido. A revisão final e o botão Publicar vêm na próxima etapa.</p>}
    </div>
  );
}
