// (17/11/2026) AVISO DO SKU — Criar Anúncio. Somente leitura e em segundo plano.
// O usuário digita o código e continua. Depois de uma pausa na digitação, o PAIIA consulta
// sozinho as integrações que ele USA (Bling, se conectado; contas ML conectadas) e as fichas
// PAIIA do código. Ao lado do campo aparece só: "Já existe · Ver detalhes", "Não encontrado"
// ou "Consulta indisponível". "Ver detalhes" abre um painel compacto (Bling, PAIIA, contas ML)
// com no máximo os atalhos necessários: Continuar ficha, Aproveitar para outra conta,
// Abrir anúncio, e — só com estoque 0 — Regularizar no Bling / Verificar de novo.
// Nada é criado, alterado, vinculado ou publicado aqui.
import { useEffect, useState } from "react";
import { useContasML, contasMLConectadas } from "../services/contaMLAtiva";
import { lerBling, consultarML, lerFichasDoCodigo, blingEstaConectado } from "../services/produtoExistenteService";
import { prepararFichaOutraConta } from "../services/anuncioPublicacaoService";
import { enderecoDaFicha } from "../services/fichasCentral";
import { nomeDaLoja } from "../services/duplicidadeML";
import {
  ESTADO_CONSULTA, PENDENCIA, ESPERA_DIGITACAO_SKU_MS, consultarSKURapido, consultarBlingInicial, chaveConsulta,
  criarCacheConsulta, resumoIndicador, oportunidadesSKU, linkProdutoBling, textoEstoque,
} from "../services/consultaInicialSKU";

const cache = criarCacheConsulta();
const STATUS_FICHA = { publicado: "publicada", publicado_com_pendencia: "publicada", publicando: "publicando", conferencia_aprovada: "aprovada", rascunho: "rascunho", erro_publicacao: "erro na publicação" };
const COR = { existe: "#fbbf24", conferir: "#fbbf24", nao_encontrado: "#94a3b8", indisponivel: "#fca5a5" };

/** Aviso ao lado do campo Código. codigo = valor do campo; fichaAtualId = ficha aberta (não conta como "já existe"). */
export default function AvisoSKU({ codigo = "", fichaAtualId = "" }) {
  const contasML = useContasML();
  const contas = contasMLConectadas(contasML).map((c) => ({ id: String(c.ml_user_id), nome: nomeDaLoja(c.ml_user_id, c.nickname) }));
  const sku = String(codigo || "").trim();
  const [lido, setLido] = useState(null); // { sku, r }
  const [aberto, setAberto] = useState(false);
  const [ocupado, setOcupado] = useState("");
  const [aviso, setAviso] = useState("");
  const idsContas = contas.map((c) => c.id).join(",");

  useEffect(() => {
    if (sku.replace(/[^0-9a-z]/gi, "").length < 4 || !contasML.carregado) return undefined;
    let vivo = true;
    const t = setTimeout(async () => {
      const blingConectado = await blingEstaConectado();
      const chave = chaveConsulta({ codigo: sku, contas, blingConectado, fichaAtualId });
      const r = await cache.obter(chave, () => consultarSKURapido({ codigo: sku, contas, blingConectado, lerBling, consultarML, lerFichas: lerFichasDoCodigo, fichaAtualId }))
        .catch((e) => ({ codigo: sku, erro: String(e?.message || e), resumo: { tipo: "indisponivel", texto: "Consulta indisponível", incompleto: true } }));
      if (vivo) setLido({ sku, chave, r });
    }, ESPERA_DIGITACAO_SKU_MS);
    return () => { vivo = false; clearTimeout(t); };
    // contas entra pela lista de IDs (mesma lista = mesma consulta)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sku, idsContas, contasML.carregado, fichaAtualId]);

  if (sku.replace(/[^0-9a-z]/gi, "").length < 4) return null;
  const atual = lido && lido.sku === sku ? lido.r : null;
  const resumo = atual?.resumo || null;

  async function verificarEstoqueDeNovo() {
    if (!atual || ocupado) return;
    setOcupado("bling");
    const bling = await consultarBlingInicial({ codigo: sku, lerBling });
    const r = { ...atual, bling };
    const novo = { ...r, resumo: resumoIndicador(r), oportunidades: oportunidadesSKU(r) };
    cache.esquecer(lido.chave);
    setLido((x) => (x && x.sku === sku ? { ...x, r: novo } : x));
    setOcupado("");
  }
  function abrirFicha(id) {
    try { window.location.assign(enderecoDaFicha(window.location.href, id)); } catch { setAviso(`Abra a ficha ${id} pela Central de Publicação.`); }
  }
  async function aproveitar(o) {
    if (ocupado) return;
    setOcupado(o.conta);
    setAviso("");
    const r = await prepararFichaOutraConta({ anuncioId: o.ficha, conta: o.conta }).catch((e) => ({ ok: false, erro: String(e?.message || e) }));
    setOcupado("");
    if (!r?.ok) { setAviso(r?.erro || "Não foi possível preparar a ficha desta conta."); return; }
    abrirFicha(r.anuncioId);
  }

  const link = { background: "none", border: "none", padding: 0, color: "#7dd3fc", cursor: "pointer", fontSize: 12, fontWeight: 700, textDecoration: "underline" };
  const mini = { padding: "3px 8px", borderRadius: 6, border: "none", fontWeight: 700, fontSize: 12, cursor: "pointer", color: "#fff", textDecoration: "none", display: "inline-block" };
  const linha = { margin: "3px 0", fontSize: 12, lineHeight: 1.45 };
  const b = atual?.bling;
  const op = atual?.oportunidades || { continuar: null, aproveitar: [] };

  return (
    <div data-paiia-aviso-sku={sku} style={{ position: "relative", marginTop: 4, fontSize: 12, textAlign: "left" }}>
      {!resumo ? (
        <span data-paiia-aviso-sku-estado="consultando" style={{ color: "#64748b" }}>⏳ conferindo o código…</span>
      ) : (
        <span data-paiia-aviso-sku-estado={resumo.tipo} style={{ color: COR[resumo.tipo] || "#94a3b8" }}>
          {resumo.tipo === "existe" ? "● " : resumo.tipo === "indisponivel" ? "○ " : "· "}
          {resumo.texto}{resumo.alerta && resumo.tipo === "existe" ? " (pendência)" : ""}
          {resumo.tipo !== "nao_encontrado" && (
            <> · <button type="button" data-paiia-ver-detalhes-sku onClick={() => setAberto((v) => !v)} style={link}>{aberto ? "Fechar" : "Ver detalhes"}</button></>
          )}
        </span>
      )}

      {aberto && atual && (
        <div data-paiia-detalhes-sku style={{ position: "absolute", zIndex: 30, top: "100%", left: 0, marginTop: 4, width: "min(420px, 92vw)", background: "#0b1220", border: "1px solid #334155", borderRadius: 10, padding: 10, color: "#e2e8f0", boxShadow: "0 8px 24px rgba(0,0,0,.5)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <b style={{ fontSize: 13 }}>SKU {sku}</b>
            <button type="button" onClick={() => setAberto(false)} aria-label="Fechar detalhes" style={{ ...link, textDecoration: "none", fontSize: 14 }}>✕</button>
          </div>

          {/* Bling */}
          <div data-paiia-detalhe-bling={b?.estado} style={linha}>
            <b>Bling:</b>{" "}
            {b?.estado === ESTADO_CONSULTA.ENCONTRADO ? <>{b.produto?.nome || "—"} · ID {b.produto?.id} · {textoEstoque(b)}</> : b?.texto || "—"}
          </div>
          {b?.pendencia === PENDENCIA.ESTOQUE_ZERO && (
            <div data-paiia-consulta-estoque-zero style={{ ...linha, color: "#fbbf24" }}>
              ⚠ {b.texto}{" "}
              <a data-paiia-regularizar-estoque href={linkProdutoBling(b.produto?.id)} target="_blank" rel="noopener noreferrer" style={{ ...mini, background: "#b45309" }}>Regularizar estoque no Bling</a>{" "}
              <button type="button" data-paiia-verificar-estoque onClick={verificarEstoqueDeNovo} disabled={Boolean(ocupado)} style={{ ...mini, background: "#0e7490" }}>
                {ocupado === "bling" ? "⏳" : "Verificar estoque novamente e continuar"}
              </button>
              <div style={{ color: "#94a3b8" }}>O PAIIA não altera a quantidade: lance a entrada no Bling. A ficha continua como está.</div>
            </div>
          )}
          {b?.estado === ESTADO_CONSULTA.NAO_VERIFICADO && (
            <button type="button" data-paiia-verificar-estoque onClick={verificarEstoqueDeNovo} disabled={Boolean(ocupado)} style={link}>Tentar o Bling de novo</button>
          )}

          {/* PAIIA */}
          <div data-paiia-detalhe-fichas={atual.fichas?.estado} style={linha}>
            <b>PAIIA:</b> {atual.fichas?.texto || "—"}
            {(atual.fichas?.lista || []).slice(0, 3).map((f) => (
              <div key={f.id} style={{ color: "#cbd5e1" }}>• ficha {STATUS_FICHA[f.status] || f.status}{f.conta ? ` · ${nomeDaLoja(f.conta)}` : ""}{f.mlb ? ` · ${f.mlb}` : ""}</div>
            ))}
          </div>
          {op.continuar && (
            <button type="button" data-paiia-continuar-ficha={op.continuar.ficha} onClick={() => abrirFicha(op.continuar.ficha)} style={{ ...mini, background: "#2563eb", margin: "2px 0 4px" }}>Continuar ficha</button>
          )}

          {/* Mercado Livre: só as contas conectadas */}
          {(atual.ml || []).length === 0 && <div style={linha}><b>Mercado Livre:</b> nenhuma conta conectada (não consultado).</div>}
          {(atual.ml || []).map((m) => (
            <div key={m.conta} data-paiia-detalhe-ml={m.conta} data-estado={m.estado} style={linha}>
              <b>{m.nome}:</b>{" "}
              {m.estado === ESTADO_CONSULTA.ENCONTRADO ? "anunciado (possível duplicidade — não crie outro)"
                : m.estado === ESTADO_CONSULTA.NAO_ENCONTRADO ? "sem anúncio deste SKU"
                : m.estado === ESTADO_CONSULTA.POSSIVEL ? "anúncio parecido, SKU diferente — confira (não é vinculado)"
                : "não foi possível verificar"}
              {(m.anuncios || []).map((a) => (
                <div key={a.mlb} data-paiia-consulta-anuncio={a.mlb} style={{ color: "#cbd5e1" }}>
                  {a.mlb} · {a.titulo || "—"} · {a.situacao}{" "}
                  {a.link && <a href={a.link} target="_blank" rel="noopener noreferrer" data-paiia-abrir-anuncio-existente={a.mlb} style={{ ...link, textDecoration: "underline" }}>Abrir anúncio existente</a>}
                </div>
              ))}
              {(m.possiveis || []).map((a) => (
                <div key={a.mlb} style={{ color: "#fde68a" }}>{a.mlb} · {a.titulo || "—"} · {a.situacao} {a.link && <a href={a.link} target="_blank" rel="noopener noreferrer" style={link}>Abrir</a>}</div>
              ))}
            </div>
          ))}
          {op.aproveitar.map((o) => (
            <button key={o.conta} type="button" data-paiia-aproveitar-conta={o.conta} onClick={() => aproveitar(o)} disabled={Boolean(ocupado)} style={{ ...mini, background: "#0f766e", margin: "2px 6px 2px 0" }}>
              {ocupado === o.conta ? "⏳ preparando…" : `Aproveitar para ${o.nome}`}
            </button>
          ))}
          {aviso && <div style={{ ...linha, color: "#fca5a5" }}>{aviso}</div>}
          <div style={{ ...linha, color: "#64748b" }}>Só leitura. Nada foi criado, alterado ou publicado.</div>
        </div>
      )}
    </div>
  );
}
