// =============================================================
// PAIIA Voz — Etapas 2 e 3: conferir e REVISAR no celular.
// Etapa 2: roda as conferências oficiais (só leitura) e grava na ficha.
// Etapa 3: revisão simples (fotos, título, descrição, SKU, marca, aplicações,
// categoria, preço, modalidade, estoque, peso/medidas) mostrando SÓ o que
// precisa de correção, e a APROVAÇÃO gravada na ficha. NÃO publica.
// =============================================================
import { useCallback, useEffect, useState } from "react";
import { useContasML, contasMLConectadas } from "../../services/contaMLAtiva";
import { nomeDaLoja } from "../../services/duplicidadeML";
import { lerFichaNovoAnuncio } from "../../services/fichaNovoAnuncioService";
import { montarRevisao } from "./servicos/revisaoCelularVoz";
import { prepararEGravar, confirmarCategoriaEGravar, definirModalidadeEGravar, aprovarRevisaoEGravar } from "./servicos/preparoVozService";
// (02/11/2026) Etapa 4: publicar pela rotina EXISTENTE (RevisaoPublicacaoML em modo simples).
import { prepararPublicacaoVoz } from "./servicos/publicarVozService";
import RevisaoPublicacaoML from "../../components/RevisaoPublicacaoML";

const ICONE = { pergunta: "❓", bloqueio: "⛔", erro: "⚠️", aguardando: "⏳", conferir: "🔎", aviso: "ℹ️" };

export default function PreparoPublicacaoVoz({ fichaId, usuarioId = "" }) {
  const estadoContas = useContasML();
  const contas = contasMLConectadas(estadoContas).filter((c) => String(c.ml_user_id || "").trim());
  const [conta, setConta] = useState("");
  const [row, setRow] = useState(null);
  const [rodando, setRodando] = useState("");
  const [erro, setErro] = useState("");
  const [publicacao, setPublicacao] = useState(null); // { anuncioConferido, conta, quantidade }

  const recarregar = useCallback(async () => {
    if (!fichaId) return null;
    const r = await lerFichaNovoAnuncio(fichaId);
    if (r.ok) {
      setRow(r.ficha);
      const c = r.ficha?.dados_conferencia?.paiia_voz?.preparo?.conta;
      if (c) setConta((x) => x || c);
    }
    return r;
  }, [fichaId]);
  // Abrir/reabrir: lê a ficha da conta (preparo e aprovação gravados nela).
  useEffect(() => {
    let ativo = true;
    (async () => {
      if (!fichaId) return;
      const r = await lerFichaNovoAnuncio(fichaId);
      if (!ativo || !r.ok) return;
      setRow(r.ficha);
      const c = r.ficha?.dados_conferencia?.paiia_voz?.preparo?.conta;
      if (c) setConta((x) => x || c);
    })();
    return () => { ativo = false; };
  }, [fichaId]);

  async function acao(nome, fn) {
    if (rodando) return;
    setRodando(nome);
    setErro("");
    const r = await fn();
    setRodando("");
    if (r && !r.ok) setErro(r.erro || "Não consegui gravar na ficha.");
    await recarregar();
  }
  const conferir = () => acao("conferir", () => prepararEGravar(fichaId, { conta }));
  const confirmarCategoria = () => acao("categoria", async () => {
    const p = row?.dados_conferencia?.paiia_voz?.preparo;
    const r = await confirmarCategoriaEGravar(fichaId, p);
    return r.ok ? prepararEGravar(fichaId, { conta }) : r;
  });
  const premium = () => acao("modalidade", async () => {
    const r = await definirModalidadeEGravar(fichaId, "premium");
    return r.ok ? prepararEGravar(fichaId, { conta }) : r; // frete muda com a modalidade
  });
  const aprovar = () => acao("aprovar", () => aprovarRevisaoEGravar(fichaId, { usuario: usuarioId }));
  // Publicar: entrega a revisão aprovada à publicação de sempre (nada é publicado neste toque).
  async function abrirPublicacao() {
    if (rodando) return;
    setRodando("publicar");
    setErro("");
    let r;
    try {
      r = await prepararPublicacaoVoz(fichaId);
    } catch (e) {
      r = { ok: false, erro: `Não consegui preparar a publicação (${e?.message || e}).` };
    }
    setRodando("");
    if (!r.ok) { setErro(r.erro || "Não consegui preparar a publicação."); return; }
    setPublicacao({ anuncioConferido: r.anuncioConferido, conta: r.conta, quantidade: r.quantidade });
  }

  if (!fichaId) return <p className="pr-aviso" data-pv-preparo-sem-ficha>☁️ Salve a ficha na conta (informe o código) para revisar e publicar.</p>;
  const rev = row ? montarRevisao(row) : null;
  const d = rev?.dados;
  const temPreparo = Boolean(row?.dados_conferencia?.paiia_voz?.preparo);

  return (
    <div className="pr-cartao" data-pv-revisao={rev ? (rev.aprovada ? "aprovada" : rev.podeAprovar ? "pronta" : "pendente") : "carregando"}>
      <p><b>📋 Revisão no celular</b> — as mesmas conferências da Publicação, só leitura. Nada é publicado aqui.</p>
      <label className="pr-fonte">Conta Mercado Livre:{" "}
        <select value={conta} onChange={(e) => setConta(e.target.value)} data-pv-preparo-conta>
          <option value="">— escolha —</option>
          {contas.map((c) => <option key={c.ml_user_id} value={String(c.ml_user_id)}>{nomeDaLoja(c.ml_user_id, c.nickname)}</option>)}
        </select>
      </label>
      <button type="button" className="pr-botao" disabled={Boolean(rodando) || !conta} onClick={conferir} data-pv-preparo-conferir>{rodando === "conferir" ? "⏳ Conferindo..." : temPreparo ? "🔄 Conferir de novo" : "🔎 Conferir agora"}</button>
      {erro && <p className="pr-aviso" data-pv-preparo-erro>⚠️ {erro}</p>}

      {d && (
        <>
          {d.fotos.length > 0 && (
            <div className="pr-fotos-revisao" data-pv-revisao-fotos style={{ display: "flex", gap: 6, overflowX: "auto", margin: "8px 0" }}>
              {d.fotos.map((u, i) => <img key={u} src={u} alt={`Foto ${i + 1}`} style={{ width: 72, height: 72, objectFit: "contain", background: "#fff", borderRadius: 6 }} />)}
            </div>
          )}
          <dl className="pr-resumo" data-pv-revisao-dados>
            <dt>Título</dt><dd>{d.titulo || "—"}</dd>
            <dt>SKU</dt><dd>{d.sku || "—"}</dd>
            <dt>Marca</dt><dd>{d.marca || "—"}</dd>
            <dt>Aplicações</dt><dd>{d.aplicacoes.length ? d.aplicacoes.join(" · ") : "—"}</dd>
            <dt>Categoria</dt><dd>{d.categoria || "—"}</dd>
            <dt>Preço</dt><dd>{d.preco} · {d.modalidade}</dd>
            <dt>Estoque</dt><dd>{d.estoque || "—"}</dd>
            <dt>Peso/medidas</dt><dd>{d.medida || "—"}</dd>
            {d.frete && <><dt>Frete</dt><dd>{d.frete}</dd></>}
          </dl>
          <details className="pr-fonte"><summary>Descrição</summary><pre className="pr-previa" data-pv-revisao-descricao>{d.descricao}</pre></details>

          {rev.pendencias.length > 0 && (
            <ul className="pr-fonte" data-pv-revisao-pendencias>
              {rev.pendencias.map((x) => (
                <li key={x.id} data-pv-pendencia={x.id} data-tipo={x.tipo}>
                  {ICONE[x.tipo] || "•"} {x.texto}
                  {x.id === "categoria" && x.sugerida && <> <button type="button" className="pr-link" disabled={Boolean(rodando)} onClick={confirmarCategoria} data-pv-preparo-confirmar-categoria>Confirmar {x.sugerida}</button></>}
                  {x.id === "modalidade" && <> <button type="button" className="pr-link" disabled={Boolean(rodando)} onClick={premium} data-pv-revisao-premium>Usar Premium</button></>}
                </li>
              ))}
            </ul>
          )}
          {rev.revisaoAnteriorInvalida && <p className="pr-aviso" data-pv-revisao-invalida>⚠️ A ficha mudou depois da aprovação anterior: revise de novo.</p>}
          {rev.aprovada ? (
            <>
              <p data-pv-revisao-aprovada>✅ Revisão aprovada e gravada na ficha.</p>
              {!publicacao && (
                <button type="button" className="pr-botao pr-grande" disabled={Boolean(rodando)} onClick={abrirPublicacao} data-pv-publicar>
                  {rodando === "publicar" ? "⏳ Preparando..." : "🚀 Publicar no Mercado Livre"}
                </button>
              )}
            </>
          ) : (
            <button type="button" className="pr-botao pr-grande" disabled={!rev.podeAprovar || Boolean(rodando)} onClick={aprovar} data-pv-revisao-aprovar>
              {rodando === "aprovar" ? "⏳ Gravando..." : rev.podeAprovar ? "✅ Aprovar revisão" : `Aprovar (${rev.motivoNaoAprova})`}
            </button>
          )}
        </>
      )}
      {publicacao && (
        <div data-pv-publicacao>
          <RevisaoPublicacaoML
            modoSimples
            anuncio={publicacao.anuncioConferido}
            titulo={publicacao.anuncioConferido.titulo}
            contaDestino={publicacao.conta}
            anuncioId={fichaId}
            quantidadeFicha={String(publicacao.quantidade)}
            onFechar={() => setPublicacao(null)}
            onAbrirTelaFinal={(id) => { window.location.href = `/?tela=mercadoLivreTeste&ficha=${encodeURIComponent(id || fichaId)}`; }}
          />
        </div>
      )}
    </div>
  );
}
