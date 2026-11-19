// =============================================================
// PAIIA — Central do Paizinho: AUDITORIA POR ANÚNCIO (18/11/2026).
// Uma linha por anúncio da conta analisada: conta + MLB, produto + SKU, problema
// principal, prioridade e o botão "Corrigir". O painel "Correção inteligente"
// abre logo abaixo da linha (um por vez): o que está errado, como corrigir,
// dados que o relatório confirma (para copiar), "Marcar como resolvido" (fila,
// com histórico, reversível) e "Próximo anúncio →".
// Só mostra: nada aqui altera anúncio, preço, estoque ou Bling.
// Custo ausente = "Custo não informado" (nunca zero, nunca inventado, nunca prejuízo).
// =============================================================
import { useEffect, useMemo, useRef, useState } from "react";
import EnviarParaPromocoes from "./EnviarParaPromocoes";
import { textoCusto, textoMargem, textoMargemEstimada, planilhaAuditoriaCSV } from "../services/paizinhoAuditoria/textosAnuncio";
import { textoUltimaCompra } from "../services/paizinhoAuditoria/ultimaCompra";
import { filtrarAnuncios, htmlRelatorioImpressao, FILTROS_AUDITORIA, ROTULO, contaDoAnuncio } from "../services/paizinhoAuditoria/relatorioImpressao";
import { correcaoDoAnuncio, proximoDaLista, CATEGORIA, ROTULO_CATEGORIA, LIMITE_TITULO_ML } from "../services/paizinhoAuditoria/correcao";
import { STATUS, chavePendencia } from "../services/paizinhoAuditoria/filaAnuncios";

const reais = (v) => (v === null || v === undefined || !Number.isFinite(Number(v)) ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const num = (v) => (v === null || v === undefined ? "não lido" : Number(v).toLocaleString("pt-BR"));
const hora = (iso) => { try { return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }); } catch { return "—"; } };
const COR = { alta: "#f87171", media: "#fbbf24", baixa: "#60a5fa" };
const COR_CATEGORIA = { [CATEGORIA.PREJUIZO]: "#f87171", [CATEGORIA.NAO_VERIFICADO]: "#fbbf24", [CATEGORIA.MARGEM_BAIXA]: "#fb923c", [CATEGORIA.QUALIDADE]: "#67e8f9" };
const POR_PAGINA = 30;
const FORA = new Set([STATUS.RESOLVIDA, STATUS.REMOVIDA]);

/** Situação do anúncio na fila: resolvido quando TODOS os assuntos dele saíram da lista. */
function situacaoNaFila(estado, areas) {
  if (!areas.length) return { resolvido: false, resolvidas: [], em: null };
  const ps = areas.map((x) => estado?.pendencias?.[chavePendencia(x.item_id, x.area)] || null);
  const resolvidas = areas.filter((x, i) => ps[i]?.status === STATUS.RESOLVIDA);
  const todos = ps.every((p) => p && FORA.has(p.status));
  const em = ps.map((p) => p?.resolvida_em || "").sort().pop() || null;
  return { resolvido: todos, resolvidas, em };
}

/**
 * rel: relatório; busca: texto da busca do topo (sem ela, a lista mostra a própria caixa);
 * estado + aoAgir: fila da conta (Resolvido / Voltar para a lista), o mesmo das Prioridades.
 */
export default function AuditoriaAnuncios({ rel, busca: buscaDoTopo, estado, aoAgir }) {
  const [filtro, setFiltro] = useState("problemas");
  const [buscaLocal, setBuscaLocal] = useState("");
  const busca = buscaDoTopo ?? buscaLocal;
  const [aberto, setAberto] = useState(null); // um painel "Corrigir" por vez
  const [mostrar, setMostrar] = useState(POR_PAGINA);
  const [aviso, setAviso] = useState("");
  const painelRef = useRef(null);
  const lista = useMemo(() => filtrarAnuncios(rel, filtro, busca), [rel, filtro, busca]);
  // Busca nova no topo → volta para a 1ª página (ajuste durante a renderização, sem efeito).
  const [buscaVista, setBuscaVista] = useState(busca);
  if (buscaVista !== busca) { setBuscaVista(busca); setMostrar(POR_PAGINA); }
  useEffect(() => {
    if (!aberto) return;
    try { painelRef.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" }); } catch { /* navegador antigo */ }
  }, [aberto]);
  if (!rel.anuncios?.length) return null;
  const semCusto = rel.anuncios.filter((a) => !(Number(a.custo) > 0)).length;

  const corrigir = (id) => { setAviso(""); setAberto((atual) => (atual === id ? null : id)); };
  function proximo(id) {
    const p = proximoDaLista(lista, id);
    if (!p) { setAviso("Fim da lista deste filtro: não há próximo anúncio."); return; }
    const i = lista.indexOf(p);
    if (i >= mostrar) setMostrar(i + 1);
    setAviso("");
    setAberto(p.item_id);
  }

  return (
    <section style={S.caixa} data-paizinho-auditoria-anuncios>
      <h3 style={S.h3}>🔎 Anúncios para corrigir</h3>
      {semCusto ? <p style={{ ...S.ajuda, color: "#fbbf24", margin: "2px 0" }}>{semCusto} anúncio(s) com "Custo não informado" no Bling (não é prejuízo: a margem não foi verificada).</p> : null}
      <div style={S.acoes}>
        {FILTROS_AUDITORIA.map(([v, t]) => (
          <button key={v} type="button" style={filtro === v ? S.chipAtivo : S.chip} onClick={() => { setFiltro(v); setMostrar(POR_PAGINA); setAberto(null); }}>{t}</button>
        ))}
        {buscaDoTopo === undefined && <input value={buscaLocal} onChange={(e) => { setBuscaLocal(e.target.value); setMostrar(POR_PAGINA); }} placeholder="Buscar SKU, MLB ou produto" style={S.busca} aria-label="Buscar anúncio" />}
        <span style={S.ajuda}>{lista.length} anúncio(s){busca ? ` para "${busca}"` : ""}</span>
        <button type="button" style={S.chip} onClick={() => exportar(rel)} title="Planilha com custos, margens, problemas e recomendações (abre no Excel)">📥 Exportar relatório</button>
        <button type="button" style={S.chip} onClick={() => imprimir(rel, filtro, busca)} title="Relatório A4 com TODOS os anúncios deste filtro, problemas, correções e espaço para observações">🖨️ Imprimir</button>
      </div>
      {aviso && <p style={{ ...S.ajuda, color: "#fbbf24" }} role="status">{aviso}</p>}
      <style>{"@media (max-width: 760px){.pz-cab{display:none!important}}"}</style>
      <div style={S.lista}>
        <div className="pz-cab" style={{ ...S.linha, ...S.cabeca }} aria-hidden="true">
          <span style={S.cConta}>Conta · MLB</span><span style={S.cAnuncio}>Produto · SKU</span><span style={S.cProb}>Problema principal</span><span style={S.cPrio}>Prioridade</span><span style={S.cAbrir} />
        </div>
        {lista.slice(0, mostrar).map((a) => {
          const p = a._p;
          const estaAberto = aberto === a.item_id;
          const c = correcaoDoAnuncio(a);
          const sit = situacaoNaFila(estado, c.areas);
          return (
            <div key={a.item_id} style={{ ...S.item, ...(estaAberto ? S.itemAberto : {}) }} data-paizinho-anuncio={a.item_id}>
              <div style={S.linha}>
                <span style={S.cConta}>
                  <small style={S.ajuda}>{contaDoAnuncio(a, rel)}</small>
                  <a href={a.link} target="_blank" rel="noreferrer" style={S.link}>{a.item_id}</a>
                </span>
                <span style={S.cAnuncio}>
                  <span style={S.titulo} title={a.titulo}>{a.titulo}</span>
                  {a.sku ? <small style={S.ajuda}>SKU {a.sku}</small> : null}
                </span>
                <span style={S.cProb}>
                  {p.length
                    ? <span style={S.prob} title={p.map((x) => x.problema).join("\n")}>{p[0].problema}{p.length > 1 ? ` (+${p.length - 1})` : ""}</span>
                    : <span style={{ color: "#86efac" }}>✔ sem problema</span>}
                  {c.prejuizo && <small style={{ color: COR.alta, fontWeight: 800 }}>💸 prejuízo estimado (custo cadastrado no Bling)</small>}
                </span>
                <span style={S.cPrio}>
                  {sit.resolvido
                    ? <span style={{ ...S.selo, color: "#86efac", borderColor: "#22c55e" }}>✅ Resolvido</span>
                    : p.length ? <span style={{ ...S.selo, color: COR[p[0].severidade], borderColor: COR[p[0].severidade] }}>{ROTULO[p[0].severidade]}</span> : null}
                </span>
                <span style={S.cAbrir}>
                  <button type="button" style={estaAberto ? S.corrigirAtivo : S.corrigir} onClick={() => corrigir(a.item_id)} aria-expanded={estaAberto} data-paizinho-corrigir={a.item_id}>
                    {estaAberto ? "Fechar" : "Corrigir"}
                  </button>
                </span>
              </div>
              {estaAberto && (
                <div ref={painelRef}>
                  <PainelCorrecao
                    key={a.item_id}
                    a={a}
                    c={c}
                    rel={rel}
                    sit={sit}
                    aoAgir={aoAgir}
                    temProximo={Boolean(proximoDaLista(lista, a.item_id))}
                    aoProximo={() => proximo(a.item_id)}
                    aoFechar={() => setAberto(null)}
                  />
                </div>
              )}
            </div>
          );
        })}
        {!lista.length && <p style={{ ...S.ajuda, padding: 10, margin: 0 }}>Nenhum anúncio neste filtro{busca ? ` para "${busca}"` : ""}.</p>}
      </div>
      {lista.length > mostrar && <button type="button" style={{ ...S.chip, marginTop: 8 }} onClick={() => setMostrar(mostrar + POR_PAGINA)}>Mostrar mais ({lista.length - mostrar})</button>}
    </section>
  );
}

/** Painel "Correção inteligente" de UM anúncio (abre logo abaixo da linha). */
function PainelCorrecao({ a, c, rel, sit, aoAgir, temProximo, aoProximo, aoFechar }) {
  const p = c.problemas;
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");

  // Mesmo registro das "Prioridades de hoje": fila da conta, com histórico (Voltar para a lista desfaz).
  async function marcar(acao, areas) {
    if (ocupado) return;
    if (!aoAgir) { setErro("Fila não carregada: não foi possível registrar."); return; }
    setErro("");
    setOcupado(true);
    try {
      for (const achado of areas) {
        const r = await aoAgir(acao, achado, "");
        if (!r?.ok) { setErro(r?.erro || "Não foi possível registrar."); break; }
      }
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div style={S.detalhe} data-paizinho-correcao={a.item_id}>
      <div style={S.cabPainel}>
        <strong style={{ color: "#f8fafc" }}>🧠 Correção inteligente</strong>
        {c.categorias.map((k) => <span key={k} style={{ ...S.selo, color: COR_CATEGORIA[k], borderColor: COR_CATEGORIA[k] }} data-paizinho-categoria={k}>{ROTULO_CATEGORIA[k]}</span>)}
      </div>
      {c.categorias.includes(CATEGORIA.NAO_VERIFICADO) && !c.prejuizo && (
        <p style={{ ...S.ajuda, color: "#fbbf24", margin: "2px 0" }}>Custo ou margem não verificados: isso NÃO é prejuízo. Cadastre/confirme o custo no Bling para a margem ser calculada.</p>
      )}

      {p.length ? <ol style={S.ol}>{p.map((x, i) => (
        <li key={i} style={{ marginBottom: 6 }}>
          <span style={{ ...S.selo, color: COR[x.severidade], borderColor: COR[x.severidade] }}>{ROTULO[x.severidade]}</span>{" "}
          <small style={{ color: COR_CATEGORIA[x.categoria], fontWeight: 700 }}>{x.rotulo_categoria}</small>{" "}
          <strong>{x.problema}</strong>
          <div style={S.corr}>👉 Como corrigir: {x.sugestao}</div>
        </li>
      ))}</ol> : <p style={S.ajuda}>Nenhum problema encontrado nesta análise.</p>}

      {(c.titulo || c.palavras.length > 0 || c.custo) && (
        <div style={S.sugestoes}>
          <div style={S.rotSug}>✍️ Dados prontos (confirmados pelo relatório — confira, edite e copie)</div>
          {c.titulo && (c.titulo.titulo
            ? <CampoCopiar rotulo={`Título sugerido (inclui ${c.titulo.adicionados.join(" + ")})`} valor={c.titulo.titulo} limite={LIMITE_TITULO_ML} nota={c.titulo.aviso} dado="titulo" />
            : <p style={{ ...S.ajuda, color: "#fbbf24", margin: 0 }} data-paizinho-sugestao="titulo-sem">{c.titulo.aviso}</p>)}
          {c.palavras.length > 0 && <CampoCopiar rotulo="Palavras-chave da concorrência que faltam no título (use só as que descrevem a peça)" valor={c.palavras.join(", ")} dado="palavras" />}
          {c.custo && <CampoCopiar rotulo={c.custo.frase} valor={c.custo.valor_texto} nota={`Sugestão para VOCÊ cadastrar no fornecedor padrão do Bling (fonte: ${c.custo.fonte || "pedido de compra"}). O PAIIA não grava no Bling nem no Mercado Livre.`} dado="custo" />}
        </div>
      )}

      <details style={S.dados}>
        <summary style={{ cursor: "pointer", fontWeight: 700 }}>Dados do anúncio</summary>
        <div style={S.grade}>
          <span>Preço: <b>{reais(a.preco)}</b></span>
          <span>Margem: <b>{textoMargem(a)}</b></span>
          <span>Visitas 30d: <b>{num(a.visitas30)}</b></span>
          <span>Vendas 30d: <b>{num(a.vendas30)}</b></span>
          <span>Fotos: <b>{a.fotos ?? "—"}</b></span>
          <span>Compat.: <b>{a.compat ?? "—"}</b></span>
          <span>Frete: <b>{a.frete_gratis ? (a.frete_vendedor === null || a.frete_vendedor === undefined ? "grátis (custo não lido)" : `grátis · ${reais(a.frete_vendedor)}`) : "comprador paga"}</b></span>
        </div>
        <div style={S.ajuda}>
          <strong>Título:</strong> {a.titulo}
          {/* (19/11) Marca e códigos como estão no anúncio: conferência manual, nada é confirmado nem acrescentado. */}
          {a.marca ? <><br /><strong>Marca no anúncio (ML):</strong> {a.marca} <small style={{ color: "#fbbf24" }}>— conferir manualmente com o produto real (o PAIIA não acrescenta marca ao título)</small></> : null}
          {a.codigo ? <><br /><strong>Código principal:</strong> {a.codigo}</> : null}
          {a.outros_codigos?.length ? <><br /><strong>Outros códigos informados no anúncio:</strong> {a.outros_codigos.join(", ")} <small style={{ color: "#fbbf24" }}>— não conferidos como equivalentes</small></> : null}
          {a.palavras?.length ? <><br /><strong>Palavras-chave sugeridas (concorrência):</strong> {a.palavras.join(", ")}</> : <><br /><small>Palavras-chave: só aparecem quando a pesquisa de concorrência é usada na análise.</small></>}
          {a.lucro !== null && a.lucro !== undefined && <><br /><strong>Lucro por venda:</strong> {reais(a.lucro)}{a.margem_com_imposto === false ? " (antes do imposto: cadastre o imposto em Preços, Custos e Lucro)" : ""}</>}
          <br /><strong>Custo cadastrado no Bling:</strong> {Number(a.custo) > 0 ? textoCusto(a) : <span style={{ color: "#fbbf24" }}>Custo não informado{a.custo_motivo ? ` (${a.custo_motivo})` : ""}</span>}
          {!(Number(a.custo) > 0) && (a.ultima_compra?.valor > 0
            ? <><br /><strong>Última compra encontrada:</strong> R$ {a.ultima_compra.valor.toFixed(2).replace(".", ",")} · <strong>Data:</strong> {textoUltimaCompra(a.ultima_compra).split(" em ")[1]} · <strong>Fonte:</strong> {a.ultima_compra.fonte} nº {a.ultima_compra.pedido}{a.ultima_compra.quantidade ? ` (${a.ultima_compra.quantidade} un.)` : ""}
              {a.margem_estimada_pct !== null && a.margem_estimada_pct !== undefined && <><br /><span style={{ color: "#fbbf24" }}><strong>Margem estimada:</strong> {textoMargemEstimada(a)} — referência: última compra; não é a margem definitiva.</span></>}
              <br /><small>Cadastre esse custo no fornecedor padrão do Bling para a margem passar a ser definitiva.</small></>
            : <><br /><span style={{ color: "#fbbf24" }}>Sem compra atendida encontrada no Bling: cadastre o custo do fornecedor no Bling para calcular a margem.</span></>)}
        </div>
      </details>

      {sit.resolvido && <p style={{ ...S.ajuda, color: "#86efac", margin: 0 }}>✅ Marcado como resolvido{sit.em ? ` em ${hora(sit.em)}` : ""} (fica no Histórico; se a reanálise ainda achar o problema, ele volta).</p>}
      {erro && <p style={{ color: "#fca5a5", margin: 0 }} role="alert">❌ {erro}</p>}

      <div style={S.rodape}>
        {a.link && <a href={a.link} target="_blank" rel="noreferrer" style={S.botaoLink}>🔗 Abrir anúncio no Mercado Livre</a>}
        {!sit.resolvido
          ? <button type="button" style={S.botaoOk} disabled={ocupado || !c.areas.length} onClick={() => marcar("resolvido", c.areas)} title={c.areas.length ? "Registra na fila desta conta, com histórico (dá para desfazer)" : "Nada para registrar na fila (só oportunidades ou sem problema)"} data-paizinho-marcar-resolvido={a.item_id}>{ocupado ? "⏳ Registrando…" : "✅ Marcar como resolvido"}</button>
          : sit.resolvidas.length > 0 && <button type="button" style={S.botaoSec} disabled={ocupado} onClick={() => marcar("devolvido", sit.resolvidas)} data-paizinho-desfazer-resolvido={a.item_id}>↩️ Desfazer (voltar para a lista)</button>}
        <button type="button" style={temProximo ? S.botaoProx : { ...S.botaoProx, opacity: 0.45, cursor: "not-allowed" }} onClick={aoProximo} disabled={!temProximo} data-paizinho-proximo-anuncio>Próximo anúncio →</button>
        <EnviarParaPromocoes conta={a.vendedor_id || rel.conta} anuncio={a} />
        <button type="button" style={S.botaoSec} onClick={aoFechar}>Fechar</button>
      </div>
      <small style={S.ajuda}>Somente leitura: o PAIIA não altera o anúncio, o preço, o estoque nem o custo. Corrija no Mercado Livre / Bling e marque como resolvido.</small>
    </div>
  );
}

/** Valor editável com o botão "Copiar". */
function CampoCopiar({ rotulo, valor, limite, nota, dado }) {
  const [texto, setTexto] = useState(valor);
  const [copiado, setCopiado] = useState(false);
  async function copiar() {
    try { await navigator.clipboard.writeText(texto); setCopiado(true); setTimeout(() => setCopiado(false), 1500); } catch { /* sem área de transferência */ }
  }
  const passou = limite && texto.length > limite;
  return (
    <div style={S.campo} data-paizinho-sugestao={dado}>
      <span style={{ fontWeight: 700, color: "#e2e8f0" }}>{rotulo}</span>
      <span style={S.linhaCampo}>
        <input value={texto} onChange={(e) => setTexto(e.target.value)} style={S.entrada} aria-label={rotulo} />
        <button type="button" style={S.botaoSec} onClick={copiar}>{copiado ? "✔ Copiado" : "📋 Copiar"}</button>
      </span>
      {limite ? <small style={{ color: passou ? "#fca5a5" : "#94a3b8" }}>{texto.length} de {limite} caracteres{passou ? " — passou do limite do Mercado Livre" : ""}</small> : null}
      {nota ? <small style={S.ajuda}>{nota}</small> : null}
    </div>
  );
}

// (18/11) Imprime o relatório A4 próprio (fundo branco) com todos os anúncios do filtro.
// Usa um quadro invisível: não abre janela nova e não muda nada na tela nem nos dados.
function imprimir(rel, filtro, busca) {
  try {
    const q = document.createElement("iframe");
    q.setAttribute("aria-hidden", "true");
    q.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    q.onload = () => { setTimeout(() => { try { q.contentWindow.focus(); q.contentWindow.print(); } finally { setTimeout(() => q.remove(), 60000); } }, 50); };
    q.srcdoc = htmlRelatorioImpressao(rel, { filtro, busca });
    document.body.appendChild(q);
  } catch (e) { window.alert(`Não foi possível montar a impressão: ${e?.message || e}`); }
}

// (18/11) Exporta a auditoria completa (abre no Excel). Só gera arquivo; nada é alterado.
function exportar(rel) {
  try {
    const url = URL.createObjectURL(new Blob([planilhaAuditoriaCSV(rel)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    const nome = String(rel.conta?.nome || "conta").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-");
    a.href = url; a.download = `auditoria-${nome}-${String(rel.gerado_em || "").slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch (e) { window.alert(`Não foi possível gerar o arquivo: ${e?.message || e}`); }
}

const S = {
  caixa: { marginTop: 14 },
  h3: { margin: "18px 0 6px", color: "#f8fafc" },
  ajuda: { color: "#94a3b8", fontSize: 13 },
  acoes: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", margin: "8px 0" },
  chip: { border: "1px solid #475569", borderRadius: 999, background: "#0f172a", color: "#e2e8f0", padding: "5px 11px", fontWeight: 700, cursor: "pointer", fontSize: 13 },
  chipAtivo: { border: "1px solid #67e8f9", borderRadius: 999, background: "rgba(8,145,178,.24)", color: "#cffafe", padding: "5px 11px", fontWeight: 700, cursor: "pointer", fontSize: 13 },
  busca: { flex: "1 1 180px", border: "1px solid #475569", borderRadius: 10, background: "#020617", color: "#f8fafc", padding: "7px 10px", font: "inherit" },
  lista: { border: "1px solid #1e293b", borderRadius: 12, overflow: "hidden", textAlign: "left" },
  item: { borderBottom: "1px solid #1e293b" },
  itemAberto: { background: "rgba(8,145,178,.08)", boxShadow: "inset 3px 0 0 #22d3ee" },
  linha: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px 10px", padding: "7px 10px", fontSize: 13, color: "#e2e8f0" },
  cabeca: { background: "#0b1324", color: "#94a3b8", fontSize: 12, fontWeight: 700 },
  cConta: { flex: "0 0 128px", display: "flex", flexDirection: "column", minWidth: 0 },
  cAnuncio: { flex: "3 1 220px", minWidth: 0, display: "flex", flexDirection: "column" },
  titulo: { color: "#e2e8f0", lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" },
  cProb: { flex: "3 1 220px", minWidth: 0, display: "flex", flexDirection: "column", gap: 2 },
  prob: { color: "#cbd5e1", fontSize: 12.5, lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" },
  cPrio: { flex: "0 0 104px" },
  cAbrir: { flex: "0 0 88px", textAlign: "right" },
  corrigir: { border: "1px solid #22d3ee", borderRadius: 8, background: "linear-gradient(135deg,#0369a1,#0891b2)", color: "white", padding: "6px 12px", fontWeight: 800, cursor: "pointer", fontSize: 13 },
  corrigirAtivo: { border: "1px solid #475569", borderRadius: 8, background: "#0f172a", color: "#e2e8f0", padding: "6px 12px", fontWeight: 800, cursor: "pointer", fontSize: 13 },
  selo: { border: "1px solid", borderRadius: 999, padding: "1px 8px", fontSize: 11, fontWeight: 800, whiteSpace: "nowrap" },
  detalhe: { padding: "8px 12px 12px 16px", background: "rgba(15,23,42,.75)", borderTop: "1px dashed #1e3a5f", display: "flex", flexDirection: "column", gap: 6, scrollMarginBottom: 16 },
  cabPainel: { display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" },
  ol: { margin: "4px 0 4px", paddingLeft: 18, color: "#e2e8f0", fontSize: 13 },
  corr: { color: "#86efac", marginTop: 2 },
  sugestoes: { display: "flex", flexDirection: "column", gap: 8, padding: 10, border: "1px solid #1e3a5f", borderRadius: 10, background: "#020617" },
  rotSug: { fontWeight: 800, color: "#a5f3fc", fontSize: 13 },
  campo: { display: "flex", flexDirection: "column", gap: 4, fontSize: 13 },
  linhaCampo: { display: "flex", gap: 6, flexWrap: "wrap" },
  entrada: { flex: "1 1 240px", minWidth: 0, border: "1px solid #475569", borderRadius: 8, background: "#0b1324", color: "#f8fafc", padding: "6px 9px", font: "inherit" },
  dados: { border: "1px solid #1e293b", borderRadius: 10, padding: "6px 10px", background: "#020617", color: "#e2e8f0", fontSize: 13 },
  grade: { display: "flex", flexWrap: "wrap", gap: "4px 16px", margin: "6px 0", color: "#cbd5e1" },
  rodape: { display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 4 },
  botaoLink: { border: "1px solid #22d3ee", borderRadius: 999, background: "rgba(8,145,178,.18)", color: "#cffafe", padding: "6px 12px", fontWeight: 800, fontSize: 13, textDecoration: "none" },
  botaoOk: { border: "1px solid #22c55e", borderRadius: 999, background: "rgba(34,197,94,.14)", color: "#bbf7d0", padding: "6px 12px", fontWeight: 800, fontSize: 13, cursor: "pointer" },
  botaoProx: { border: "1px solid #67e8f9", borderRadius: 999, background: "rgba(8,145,178,.24)", color: "#cffafe", padding: "6px 14px", fontWeight: 800, fontSize: 13, cursor: "pointer" },
  botaoSec: { border: "1px solid #334155", borderRadius: 999, background: "#0f172a", color: "#cbd5e1", padding: "6px 12px", fontSize: 13, cursor: "pointer" },
  link: { color: "#67e8f9", fontFamily: "ui-monospace,Consolas,monospace" },
};
