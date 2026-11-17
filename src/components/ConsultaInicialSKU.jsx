// (17/11/2026) CONSULTA INICIAL PELO SKU — Novo Anúncio. Somente leitura.
// Ao tocar em "Buscar e Montar Anúncio", lê em paralelo (sem interromper a preparação):
//   Bling: produto, ID, físico, disponível, depósito;
//   Mercado Livre: anúncio deste SKU só na conta selecionada (inclui variações).
// Estoque 0 → "Regularizar estoque no Bling" (abre o produto certo; NADA é alterado) e
// "Verificar estoque novamente e continuar" (relê só o Bling; ficha, fotos, descrição e
// aplicações ficam como estão). Anúncio existente → mostra conta, MLB, título e situação,
// com "Abrir anúncio existente". Nada é criado, vinculado ou publicado aqui.
import { useEffect, useState } from "react";
import { useContasML, contasMLConectadas } from "../services/contaMLAtiva";
import { lerBling, consultarML } from "../services/produtoExistenteService";
import { CONTAS_PUBLICACAO_ML } from "../services/contasPublicacaoML";
import {
  ESTADO_CONSULTA, PENDENCIA, consultarSKUInicial, consultarBlingInicial, consultarMLInicial,
  linkProdutoBling, orientacaoRegularizarEstoque, pendenciasConsulta, textoEstoque,
} from "../services/consultaInicialSKU";

const COR = {
  [ESTADO_CONSULTA.ENCONTRADO]: "#86efac",
  [ESTADO_CONSULTA.NAO_ENCONTRADO]: "#e2e8f0",
  [ESTADO_CONSULTA.NAO_VERIFICADO]: "#fde68a",
  [ESTADO_CONSULTA.AMBIGUO]: "#fca5a5",
  [ESTADO_CONSULTA.OUTRO_CODIGO]: "#fca5a5",
  [ESTADO_CONSULTA.POSSIVEL]: "#fde68a",
};

/** pedido = { codigo, n }: muda a cada "Buscar e Montar Anúncio". */
export default function ConsultaInicialSKU({ pedido = null }) {
  const contasML = useContasML();
  const conectadas = contasMLConectadas(contasML);
  const ativa = conectadas.find((c) => c.ativa)?.ml_user_id || "";
  const [contaEscolhida, setContaEscolhida] = useState("");
  const conta = String(contaEscolhida || ativa || "");
  const nomeConta = CONTAS_PUBLICACAO_ML.find((c) => c.id === conta)?.nome || "";
  const conectada = conectadas.some((c) => String(c.ml_user_id) === conta);
  const [lido, setLido] = useState(null); // { n, conta, r }
  const [relendo, setRelendo] = useState(""); // "bling" | "ml" | ""
  const [guia, setGuia] = useState(false);

  useEffect(() => {
    if (!pedido?.codigo || !contasML.carregado) return undefined;
    let vivo = true;
    consultarSKUInicial({ codigo: pedido.codigo, conta, nomeConta, contaConectada: conectada, lerBling, consultarML })
      .then((r) => { if (vivo) setLido({ n: pedido.n, conta, r }); })
      .catch((e) => { if (vivo) setLido({ n: pedido.n, conta, r: { codigo: pedido.codigo, erro: String(e?.message || e) } }); });
    return () => { vivo = false; };
    // A conta muda por escolha (trocarConta), não reconsulta o Bling sozinha.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido?.n, pedido?.codigo, contasML.carregado]);

  if (!pedido?.codigo) return null;
  const lendo = !lido || lido.n !== pedido.n;
  const r = lendo ? null : lido.r;

  async function verificarEstoqueDeNovo() {
    if (!r || relendo) return;
    setRelendo("bling");
    const bling = await consultarBlingInicial({ codigo: pedido.codigo, lerBling });
    setLido((x) => (x && x.n === pedido.n ? { ...x, r: { ...x.r, bling, lido_em: new Date().toISOString() } } : x));
    setRelendo("");
    setGuia(false);
  }
  async function trocarConta(nova) {
    setContaEscolhida(nova);
    if (!r || relendo) return;
    setRelendo("ml");
    const ok = conectadas.some((c) => String(c.ml_user_id) === nova);
    const nome = CONTAS_PUBLICACAO_ML.find((c) => c.id === nova)?.nome || "";
    const ml = await consultarMLInicial({ codigo: pedido.codigo, conta: nova, nome, conectada: ok, consultarML });
    setLido((x) => (x && x.n === pedido.n ? { ...x, conta: nova, r: { ...x.r, ml } } : x));
    setRelendo("");
  }

  const pend = pendenciasConsulta(r);
  const botao = { padding: "7px 12px", borderRadius: 8, border: "none", fontWeight: 800, cursor: "pointer", color: "#fff", fontSize: 13 };
  const linha = { fontSize: 13, lineHeight: 1.6, margin: "4px 0" };
  const b = r?.bling;
  const ml = r?.ml;

  return (
    <section data-paiia-consulta-inicial={pedido.codigo} style={{ border: "2px solid #6366f1", borderRadius: 12, padding: 12, margin: "12px 0", background: "#111827", color: "#e2e8f0", textAlign: "left" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <b style={{ flex: "1 1 220px", fontSize: 15 }}>🔎 SKU {pedido.codigo}: Bling e Mercado Livre</b>
        <label style={{ fontSize: 13 }}>
          Conta ML:{" "}
          <select data-paiia-consulta-conta value={conta} onChange={(e) => trocarConta(e.target.value)} disabled={Boolean(relendo) || lendo} style={{ padding: 4, borderRadius: 6 }}>
            {!conta && <option value="">— escolha —</option>}
            {CONTAS_PUBLICACAO_ML.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </label>
      </div>
      <p style={{ ...linha, color: "#a5b4fc" }}>Só leitura: a preparação do anúncio continua enquanto o PAIIA confere. Nada é criado, alterado ou publicado aqui.</p>

      {lendo && <p data-paiia-consulta-lendo style={linha}>⏳ Consultando o Bling e a conta {nomeConta || "selecionada"} do Mercado Livre…</p>}
      {r?.erro && <p data-paiia-consulta-erro style={{ ...linha, color: "#fde68a" }}>⚠ Não foi possível verificar agora ({r.erro}). Isso NÃO quer dizer que o produto não existe.</p>}

      {b && (
        <div data-paiia-consulta-bling={b.estado} style={{ ...linha, color: COR[b.estado] }}>
          <b>Bling:</b>{" "}
          {b.estado === ESTADO_CONSULTA.ENCONTRADO
            ? <>{b.produto?.nome || "—"} · ID {b.produto?.id} · {textoEstoque(b)}</>
            : b.texto}
          {relendo === "bling" && " ⏳ relendo…"}
        </div>
      )}
      {b?.pendencia === PENDENCIA.ESTOQUE_ZERO && (
        <div data-paiia-consulta-estoque-zero style={{ border: "1px solid #f59e0b", borderRadius: 8, padding: 8, margin: "6px 0", background: "#1f1503" }}>
          <div style={{ fontWeight: 800, color: "#fbbf24" }}>⚠ {b.texto}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
            <a data-paiia-regularizar-estoque href={linkProdutoBling(b.produto?.id)} target="_blank" rel="noopener noreferrer" onClick={() => setGuia(true)} style={{ ...botao, background: "#b45309", textDecoration: "none" }}>
              Regularizar estoque no Bling
            </a>
            <button type="button" data-paiia-verificar-estoque onClick={verificarEstoqueDeNovo} disabled={Boolean(relendo)} style={{ ...botao, background: relendo ? "#475569" : "#0e7490" }}>
              {relendo === "bling" ? "⏳ Verificando…" : "Verificar estoque novamente e continuar"}
            </button>
          </div>
          {guia && (
            <ol data-paiia-guia-estoque style={{ ...linha, paddingLeft: 18 }}>
              {orientacaoRegularizarEstoque(b, pedido.codigo).map((t) => <li key={t}>{t}</li>)}
            </ol>
          )}
        </div>
      )}
      {b?.pendencia === PENDENCIA.ESTOQUE_NAO_LIDO && (
        <div style={{ ...linha, color: "#fde68a" }}>
          ⚠ {b.texto}{" "}
          <button type="button" data-paiia-verificar-estoque onClick={verificarEstoqueDeNovo} disabled={Boolean(relendo)} style={{ ...botao, background: "#0e7490" }}>Verificar estoque novamente</button>
        </div>
      )}
      {b?.estado === ESTADO_CONSULTA.ENCONTRADO && !b.pendencia && (
        <div style={{ ...linha, color: "#86efac" }}>✅ Produto já cadastrado no Bling: na Publicação ele é aproveitado (nada é cadastrado de novo).</div>
      )}
      {b?.estado === ESTADO_CONSULTA.NAO_VERIFICADO && (
        <button type="button" data-paiia-verificar-estoque onClick={verificarEstoqueDeNovo} disabled={Boolean(relendo)} style={{ ...botao, background: "#0e7490" }}>Tentar o Bling de novo</button>
      )}

      {ml && (
        <div data-paiia-consulta-ml={ml.estado} style={{ ...linha, color: COR[ml.estado], marginTop: 8 }}>
          <b>Mercado Livre{ml.nome ? ` (${ml.nome})` : ""}:</b> {ml.texto}{relendo === "ml" && " ⏳ relendo…"}
        </div>
      )}
      {(ml?.anuncios || []).map((a) => (
        <div key={a.mlb} data-paiia-consulta-anuncio={a.mlb} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 13, margin: "4px 0", padding: 6, border: "1px solid #f87171", borderRadius: 8 }}>
          <span style={{ flex: "1 1 240px" }}>⚠ {ml.nome} · <b>{a.mlb}</b> · {a.titulo || "—"} · {a.situacao}</span>
          {a.link && <a href={a.link} target="_blank" rel="noopener noreferrer" data-paiia-abrir-anuncio-existente={a.mlb} style={{ ...botao, background: "#1d4ed8", textDecoration: "none" }}>Abrir anúncio existente</a>}
        </div>
      ))}
      {(ml?.possiveis || []).map((a) => (
        <div key={a.mlb} data-paiia-consulta-possivel={a.mlb} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 13, margin: "4px 0", color: "#fde68a" }}>
          <span style={{ flex: "1 1 240px" }}>? {a.mlb} · {a.titulo || "—"} · {a.situacao} — {a.motivo} (não é vinculado)</span>
          {a.link && <a href={a.link} target="_blank" rel="noopener noreferrer" style={{ ...botao, background: "#334155", textDecoration: "none" }}>Abrir</a>}
        </div>
      ))}

      {r && !r.erro && (
        <p data-paiia-consulta-resumo={pend.length ? "pendencia" : "ok"} style={{ ...linha, marginTop: 8, fontWeight: 700, color: pend.length ? "#fbbf24" : "#86efac" }}>
          {pend.length
            ? "Continue preparando o anúncio normalmente. Antes de publicar, corrija a pendência acima — nada precisa ser refeito."
            : "Sem pendência de cadastro, estoque ou duplicidade. Siga para a Publicação."}
        </p>
      )}
    </section>
  );
}
