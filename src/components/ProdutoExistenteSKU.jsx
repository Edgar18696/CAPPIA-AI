// (16/11/2026) PRODUTO JÁ EXISTENTE — aparece no Novo Anúncio quando o código já tem ficha no PAIIA
// (caso SKU 7527362). Nada é apagado nem pesquisado como peça nova sem o seu toque.
// "Ver as 3 contas" lê (somente leitura) Bling, registro de MLBs e o Mercado Livre de cada conta e
// mostra LOJA ONLINE, CIEBR e REVELAÇÃO com os seus anúncios. MLB de OUTRA peça aparece separado e
// nunca é usado. Conta sem anúncio: aproveitar os dados da ficha existente (o Bling é reaproveitado
// pelo SKU na Publicação; nada é cadastrado de novo). Nada é publicado aqui.
import { useState } from "react";
import { useContasML, contasMLConectadas } from "../services/contaMLAtiva";
import { contasParaConsultar, ESTADO_RECONHECIMENTO } from "../services/reconhecimentoSKU";
import { reconhecerProdutoExistente } from "../services/produtoExistenteService";
import { prepararFichaOutraConta } from "../services/anuncioPublicacaoService";
import { enderecoDaFicha } from "../services/fichasCentral";
import { ESTADO_QUADRO, acaoDaConta, quadroProdutoExistente } from "../services/produtoExistenteSKU";

const SELO = {
  [ESTADO_QUADRO.ANUNCIADA]: { txt: "✅ Já anunciada", cor: "#86efac" },
  [ESTADO_QUADRO.EM_ANDAMENTO]: { txt: "⏳ Ficha em andamento", cor: "#93c5fd" },
  [ESTADO_QUADRO.DISPONIVEL]: { txt: "➕ Sem anúncio deste SKU", cor: "#e2e8f0" },
  [ESTADO_QUADRO.CONFERIR]: { txt: "⚠ Anúncio não confirmado — confira", cor: "#fde68a" },
  [ESTADO_QUADRO.INCOMPLETA]: { txt: "⏸ Não conferida", cor: "#fde68a" },
};
const STATUS_FICHA = { publicado: "publicada", publicado_com_pendencia: "publicada (com pendência)", publicando: "publicando", conferencia_aprovada: "aprovada", rascunho: "rascunho", erro_publicacao: "erro na publicação" };

export default function ProdutoExistenteSKU({ codigo = "", fichas = [], onPesquisarMesmoAssim = null, onFechar = null }) {
  const estadoContas = useContasML();
  const [rec, setRec] = useState({ lendo: false, r: null, erro: "" });
  const [ocupado, setOcupado] = useState("");
  const [aviso, setAviso] = useState("");
  const quadro = quadroProdutoExistente({ fichas, reconhecimento: rec.r });

  async function verContas() {
    setRec({ lendo: true, r: null, erro: "" });
    try {
      const contas = contasParaConsultar(contasMLConectadas(estadoContas), estadoContas?.erro);
      const r = await reconhecerProdutoExistente({ codigo: String(codigo || "").trim(), contas });
      setRec({ lendo: false, r, erro: r ? "" : "Código curto demais para conferir." });
    } catch (e) {
      setRec({ lendo: false, r: null, erro: String(e?.message || e) });
    }
  }
  function abrir(id) {
    try { window.location.assign(enderecoDaFicha(window.location.href, id)); } catch { setAviso(`Abra a ficha ${id} pela Central de Publicação.`); }
  }
  async function agir(a) {
    if (a.tipo === "abrir") { abrir(a.ficha); return; }
    if (a.tipo !== "preparar" || ocupado) return;
    setOcupado(a.conta);
    setAviso("");
    const r = await prepararFichaOutraConta({ anuncioId: a.ficha, conta: a.conta }).catch((e) => ({ ok: false, erro: String(e?.message || e) }));
    setOcupado("");
    if (!r.ok) { setAviso(r.erro || "Não foi possível preparar a ficha desta conta."); return; }
    abrir(r.anuncioId);
  }

  const botao = { padding: "8px 12px", borderRadius: 8, border: "none", fontWeight: 800, cursor: "pointer", color: "#fff" };
  return (
    <section data-paiia-produto-existente={codigo} style={{ border: "2px solid #38bdf8", borderRadius: 12, padding: 12, margin: "12px 0", background: "#0c1a2e", color: "#e2e8f0" }}>
      <div style={{ fontWeight: 800, fontSize: 16 }}>📦 O código {codigo} já foi trabalhado no PAIIA</div>
      <p style={{ fontSize: 13, margin: "4px 0 8px", color: "#bae6fd" }}>
        Nada foi apagado nem pesquisado de novo: fotos, descrição e dados preparados continuam na ficha. Abra a ficha existente,
        confira as contas ou, se for mesmo uma peça diferente, pesquise como nova.
      </p>

      {quadro.fichas.length > 0 && (
        <div style={{ display: "grid", gap: 4, marginBottom: 8 }}>
          {quadro.fichas.map((f) => (
            <div key={f.id} data-paiia-ficha-existente={f.id} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 13 }}>
              <span style={{ flex: "1 1 220px" }}>
                Ficha {STATUS_FICHA[f.status] || f.status}{f.conta ? ` · conta ${quadro.linhas.find((l) => l.conta === f.conta)?.nome || f.conta}` : ""}{f.mlb ? ` · ${f.mlb}` : ""}
                {quadro.fonte?.id === f.id ? " · dados aproveitados daqui" : ""}
              </span>
              <button type="button" data-paiia-abrir-ficha-existente={f.id} onClick={() => abrir(f.id)} style={{ ...botao, background: "#0369a1" }}>Abrir esta ficha</button>
            </div>
          ))}
        </div>
      )}

      <button type="button" data-paiia-ver-contas-produto onClick={verContas} disabled={rec.lendo} style={{ ...botao, width: "100%", background: rec.lendo ? "#475569" : "#0e7490" }}>
        {rec.lendo ? "⏳ Lendo Bling e as 3 contas do Mercado Livre (somente leitura)…" : rec.r ? "🔄 Conferir de novo" : "🔎 Ver anúncios nas contas LOJA ONLINE, CIEBR e REVELAÇÃO"}
      </button>
      {rec.erro && <p style={{ color: "#fca5a5", fontSize: 13 }}>❌ {rec.erro}</p>}

      {quadro.bling && (
        <p data-paiia-bling-produto-existente={quadro.bling.estado} style={{ fontSize: 13, margin: "8px 0 0", color: quadro.bling.estado === ESTADO_RECONHECIMENTO.ENCONTRADO ? "#86efac" : "#fde68a" }}>
          {quadro.bling.estado === ESTADO_RECONHECIMENTO.ENCONTRADO
            ? `Bling: produto ${quadro.bling.produto?.id} (código ${quadro.bling.produto?.codigo}) — será reaproveitado; nada é cadastrado de novo.`
            : quadro.bling.estado === ESTADO_RECONHECIMENTO.NAO_ENCONTRADO
              ? "Bling: nenhum produto com este SKU exato."
              : `Bling: ${quadro.bling.motivo || "não conferido"}.`}
        </p>
      )}

      <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
        {quadro.linhas.map((l) => {
          const a = acaoDaConta(l, quadro.fonte);
          return (
            <div key={l.conta} data-paiia-conta-existente={l.conta} data-paiia-conta-existente-estado={l.estado} style={{ border: `1px solid ${SELO[l.estado].cor}`, borderRadius: 8, padding: 8, background: "#020617" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <b style={{ minWidth: 110 }}>{l.nome}</b>
                <span style={{ color: SELO[l.estado].cor, fontSize: 13, flex: "1 1 160px" }}>
                  {SELO[l.estado].txt}{l.anuncios.length ? `: ${l.anuncios.map((x) => `${x.mlb}${x.status ? ` (${x.status})` : ""}${x.onde ? ` · SKU no ${x.onde}` : ""}`).join(", ")} — confirmado no Mercado Livre` : ""}{l.motivo ? ` — ${l.motivo}` : ""}
                </span>
                {(a.tipo === "preparar" || a.tipo === "abrir") && (
                  <button type="button" data-paiia-acao-conta-existente={`${a.tipo}:${l.conta}`} onClick={() => agir(a)} disabled={Boolean(ocupado)} style={{ ...botao, background: ocupado ? "#475569" : "#7c3aed" }}>
                    {ocupado === l.conta ? "⏳ Preparando…" : a.rotulo}
                  </button>
                )}
              </div>
              {l.outraPeca.length > 0 && (
                <div data-paiia-mlb-outra-peca={l.outraPeca.map((o) => o.mlb).join(",")} style={{ fontSize: 12, color: "#fca5a5", marginTop: 4 }}>
                  ⛔ Não é desta peça (nunca usado): {l.outraPeca.map((o) => `${o.mlb} — ${o.motivo}${o.titulo ? ` (“${o.titulo}”)` : ""}`).join(" · ")}
                </div>
              )}
              {(l.naoConfirmados || []).length > 0 && (
                <div data-paiia-mlb-nao-confirmado={l.naoConfirmados.map((o) => o.mlb).join(",")} style={{ fontSize: 12, color: "#fde68a", marginTop: 4 }}>
                  ⚠ Só na ficha, NÃO confirmado no Mercado Livre (não é usado; nada é publicado nesta conta até conferir): {l.naoConfirmados.map((o) => `${o.mlb} — ${o.motivo}${o.titulo ? ` (“${o.titulo}”)` : ""}`).join(" · ")}
                </div>
              )}
              {(l.historico || []).length > 0 && (
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>Histórico: {l.historico.map((o) => `${o.mlb} — ${o.motivo}`).join(" · ")}</div>
              )}
              {l.possiveis.length > 0 && (
                <div style={{ fontSize: 12, color: "#fde68a", marginTop: 4 }}>⚠ Parecidos (SKU diferente): {l.possiveis.map((p) => `${p.mlb} — ${p.motivo}`).join(" · ")}</div>
              )}
            </div>
          );
        })}
      </div>
      {!rec.r && <p style={{ fontSize: 12, color: "#94a3b8", margin: "6px 0 0" }}>As contas só ficam “sem anúncio” depois da leitura do Mercado Livre (botão acima).</p>}
      {aviso && <p style={{ color: "#fde68a", fontSize: 13, margin: "6px 0 0" }}>⚠ {aviso}</p>}

      <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
        {onPesquisarMesmoAssim && (
          <button type="button" data-paiia-pesquisar-mesmo-assim onClick={onPesquisarMesmoAssim} style={{ background: "none", border: "none", color: "#94a3b8", textDecoration: "underline", cursor: "pointer", fontSize: 13 }}>
            É outra peça: pesquisar como nova (apaga título e descrição desta tela)
          </button>
        )}
        {onFechar && <button type="button" onClick={onFechar} style={{ background: "none", border: "none", color: "#94a3b8", textDecoration: "underline", cursor: "pointer", fontSize: 13 }}>Fechar</button>}
      </div>
    </section>
  );
}
