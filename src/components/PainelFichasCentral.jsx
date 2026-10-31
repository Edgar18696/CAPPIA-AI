import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { listarFichasCentral } from "../services/fichasCentralService";
import BotaoCopiarMLB from "./BotaoCopiarMLB";
import { retomarAnuncioGuardado } from "../services/aberturaNovoAnuncio";
import { excluirFichaDefinitivamente } from "../services/exclusaoFichaService";
import { avaliarExclusao, TEXTO_CONFIRMAR_EXCLUSAO, descartarRascunhoLocalDaFicha } from "../services/exclusaoFicha";
import {
  ESTADO_CENTRAL,
  TEXTO_ESTADO_CENTRAL,
  COR_ESTADO_CENTRAL,
  resumoFichaCentral,
  ordenarFichasCentral,
  lerAnuncioEmAndamento,
  rascunhoLocalJaNaBase,
  enderecoDaFicha,
  CHAVE_ANUNCIO_EM_ANDAMENTO,
  CHAVES_ANUNCIO_LOCAL,
} from "../services/fichasCentral";

/*
 * FICHAS DO PAIIA na Central de Publicação.
 * Mostra TODAS as fichas do usuário (prontas ou não) com o estado de cada
 * uma, e o rascunho do Novo Anúncio guardado neste navegador.
 * "Abrir" só navega: a ficha é reaberta pela base (?ficha=<ID>) na etapa
 * em que estava. Nada é recriado ou publicado aqui.
 * (27/10/2026) "🗑 Excluir" aparece SÓ nas fichas elegíveis (prévia de
 * exclusaoFicha.js) e, depois de UMA confirmação explícita de exclusão
 * DEFINITIVA, chama exclusaoFichaService: ele relê tudo, confere de novo e
 * quem apaga é só a função protegida do banco. Anúncios publicados, MLBs,
 * Bling, Base PAIIA e fotos nunca são apagados.
 * (31/10/2026) TODAS as fichas mostram um único "🗑 Excluir". Ficha sem
 * publicação/vínculos: exclusão definitiva segura (a de sempre). Ficha com
 * MLB, publicação, Bling ou protegida: o mesmo botão só ARQUIVA (sai da
 * lista pela tabela paiia_fichas_arquivadas); histórico, MLB, Bling e
 * proteção contra duplicidade continuam intactos.
 */
export default function PainelFichasCentral({ setScreen }) {
  const [estado, setEstado] = useState({ carregando: true, erro: "", fichas: [] });
  const [local, setLocal] = useState(() => {
    try {
      return lerAnuncioEmAndamento(localStorage);
    } catch {
      return null;
    }
  });
  const [mostrarTodas, setMostrarTodas] = useState(false);
  // (27/10) Exclusão definitiva: fichas como vieram da base (para a prévia),
  // ficha em exclusão e a mensagem do resultado.
  const [brutas, setBrutas] = useState(() => new Map());
  const [excluindo, setExcluindo] = useState("");
  const [arquivando, setArquivando] = useState("");
  const [aviso, setAviso] = useState({ texto: "", erro: false });
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const r = await listarFichasCentral();
      if (!ativo) return;
      if (!r.ok) setEstado({ carregando: false, erro: r.erro, fichas: [] });
      else {
        setBrutas(new Map(r.fichas.map((f) => [f.id, f])));
        setEstado({ carregando: false, erro: "", fichas: ordenarFichasCentral(r.fichas.map(resumoFichaCentral)) });
      }
    })();
    return () => { ativo = false; };
  }, [versao]);

  /** Prévia: mostra o botão só se a ficha parece elegível (a conferência real vem no clique). */
  function previaExclusao(id) {
    const f = brutas.get(id);
    return f ? avaliarExclusao(f) : { pode: false, motivo: "Ficha não carregada." };
  }

  async function excluir(f) {
    if (excluindo || arquivando) return;
    const nome = `Ficha: ${f.codigo || "Sem código"} · ${f.titulo || "Sem título"}`;
    if (!previaExclusao(f.id).pode) {
      const okArq = window.confirm(`Excluir esta ficha da Central?\n\nProdutos no Bling e anúncios no Mercado Livre não são alterados.\n\n${nome}`);
      if (okArq) await arquivar(f);
      return;
    }
    const ok = window.confirm(`${TEXTO_CONFIRMAR_EXCLUSAO}\n\n${nome}`);
    if (!ok) return;
    setExcluindo(f.id);
    setAviso({ texto: "⏳ Conferindo a ficha antes de excluir...", erro: false });
    let r;
    try {
      r = await excluirFichaDefinitivamente(f.id);
    } catch (e) {
      r = { apagada: false, erro: `Falha inesperada (${e?.message || "erro"}): nada foi apagado.` };
    }
    if (r.apagada) {
      try {
        descartarRascunhoLocalDaFicha(localStorage, f.id, { chaveGuardada: CHAVE_ANUNCIO_EM_ANDAMENTO, chavesLocais: CHAVES_ANUNCIO_LOCAL });
        setLocal(lerAnuncioEmAndamento(localStorage));
      } catch {
        // sem acesso ao navegador: a ficha já não existe na base
      }
      setAviso({ texto: "🗑 Ficha excluída definitivamente.", erro: false });
    } else if (r.protegida) {
      // A conferência do banco protegeu a ficha: em vez de apagar, só arquiva.
      setExcluindo("");
      await arquivar(f);
      return;
    } else {
      setAviso({ texto: `❌ ${r.erro || "Nada foi apagado."}`, erro: true });
    }
    setExcluindo("");
    setVersao((v) => v + 1);
  }

  async function arquivar(f) {
    setArquivando(f.id);
    setAviso({ texto: "⏳ Excluindo a ficha da Central...", erro: false });
    let erro = "";
    try {
      const { data: u } = await supabase.auth.getUser();
      const usuarioId = u?.user?.id;
      if (!usuarioId) erro = "Sessão expirada: entre de novo no PAIIA.";
      else {
        const { error } = await supabase
          .from("paiia_fichas_arquivadas")
          .insert({ anuncio_id: f.id, usuario_id: usuarioId, motivo: "Arquivada pela Central de Publicação" });
        if (error) erro = error.message || "Não foi possível arquivar.";
      }
    } catch (e) {
      erro = `Falha inesperada (${e?.message || "erro"}).`;
    }
    setAviso(erro ? { texto: `❌ ${erro} Nada foi alterado.`, erro: true } : { texto: "🗑 Ficha excluída da Central.", erro: false });
    setArquivando("");
    setVersao((v) => v + 1);
  }

  /** Rascunho guardado SÓ neste navegador: apaga do navegador (não existe na base). */
  function excluirLocal() {
    if (!local) return;
    const ok = window.confirm(`Excluir este rascunho?\n\nEle está salvo só neste navegador e será apagado. Produtos no Bling e anúncios no Mercado Livre não são alterados.\n\nRascunho: ${local.resumo?.codigo || "Sem código"} · ${local.resumo?.titulo || "Sem título"}`);
    if (!ok) return;
    try {
      const id = local.resumo?.fichaId || local.fichaIdPAIIA || local.fichaId;
      if (id) descartarRascunhoLocalDaFicha(localStorage, id, { chaveGuardada: CHAVE_ANUNCIO_EM_ANDAMENTO, chavesLocais: CHAVES_ANUNCIO_LOCAL });
      if (lerAnuncioEmAndamento(localStorage)) localStorage.removeItem(CHAVE_ANUNCIO_EM_ANDAMENTO);
      setLocal(lerAnuncioEmAndamento(localStorage));
      setAviso({ texto: "🗑 Rascunho excluído deste navegador.", erro: false });
    } catch {
      setAviso({ texto: "❌ Não foi possível apagar o rascunho deste navegador. Nada foi alterado na base.", erro: true });
    }
  }

  function abrirFicha(id) {
    try {
      window.history.replaceState(window.history.state, "", enderecoDaFicha(window.location.href, id));
    } catch {
      // sem acesso ao endereço: a Conferência não conseguiria achar a ficha
      return;
    }
    setScreen?.("mercadoLivreTeste");
  }

  function retomarLocal() {
    try {
      // "Retomar" não é criação nova: o Novo Anúncio abre SÓ com o guardado
      // (as fotos dele; nada do anúncio que estava na tela).
      retomarAnuncioGuardado(localStorage);
    } catch {
      // segue: o Novo Anúncio abre com o que houver
    }
    setScreen?.("novoAnuncio");
  }

  const mostrarLocal = local && !rascunhoLocalJaNaBase(local, estado.fichas);
  // Código que JÁ tem anúncio publicado: outra ficha do mesmo código é
  // sinalizada (uma ficha publicada nunca volta a parecer anúncio novo).
  const publicadosPorCodigo = new Map(
    estado.fichas.filter((f) => f.publicado).map((f) => [String(f.codigo || "").toUpperCase().replace(/[^A-Z0-9]/g, ""), f.mlb || "MLB"])
  );
  const fichas = mostrarTodas ? estado.fichas : estado.fichas.slice(0, 12);
  const contagem = estado.fichas.reduce((m, f) => ({ ...m, [f.estado]: (m[f.estado] || 0) + 1 }), {});

  return (
    <section data-paiia-fichas-central style={caixa}>
      <h3 style={{ color: "#fde047", margin: "0 0 6px" }}>📂 Suas fichas de anúncio</h3>
      <p style={{ color: "#94a3b8", fontSize: 13, margin: "0 0 10px" }}>
        Todas as fichas aparecem aqui, mesmo as que ainda não estão prontas. Abrir uma ficha só navega: nada é apagado nem publicado. "Excluir" tira a ficha da Central. Produtos no Bling e anúncios no Mercado Livre não são alterados.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
        {Object.values(ESTADO_CENTRAL).map((e) => (
          <span key={e} data-paiia-legenda-estado={e} style={{ ...etiqueta(e), opacity: contagem[e] || (e === ESTADO_CENTRAL.EM_ANDAMENTO && mostrarLocal) ? 1 : 0.45 }}>
            {COR_ESTADO_CENTRAL[e].icone} {TEXTO_ESTADO_CENTRAL[e]}
            {contagem[e] ? ` (${contagem[e]})` : ""}
          </span>
        ))}
      </div>

      {mostrarLocal && (
        <div data-paiia-ficha-local style={linha}>
          <span style={etiqueta(ESTADO_CENTRAL.EM_ANDAMENTO)}>{COR_ESTADO_CENTRAL[ESTADO_CENTRAL.EM_ANDAMENTO].icone} {TEXTO_ESTADO_CENTRAL[ESTADO_CENTRAL.EM_ANDAMENTO]}</span>
          <span style={{ flex: 1, minWidth: 180 }}>
            <b>{local.resumo.codigo || "Sem código"}</b> · {local.resumo.titulo || "Sem título"}
            <span style={sub}> · Novo Anúncio guardado neste navegador</span>
          </span>
          <button type="button" data-paiia-retomar-local onClick={retomarLocal} style={botao}>
            ✏️ Retomar no Novo Anúncio
          </button>
          <button type="button" data-paiia-excluir-local onClick={excluirLocal} style={botaoExcluir}>
            🗑 Excluir
          </button>
        </div>
      )}

      {aviso.texto && <p data-paiia-exclusao-msg style={{ ...sub, color: aviso.erro ? "#fca5a5" : "#86efac" }}>{aviso.texto}</p>}
      {estado.carregando && <p style={sub}>⏳ Lendo as fichas na base PAIIA...</p>}
      {estado.erro && <p style={{ ...sub, color: "#fca5a5" }}>❌ {estado.erro}</p>}
      {!estado.carregando && !estado.erro && !estado.fichas.length && !mostrarLocal && (
        <p style={sub}>Nenhuma ficha encontrada.</p>
      )}

      {fichas.map((f) => (
        <div key={f.id} data-paiia-ficha-central={f.estado} style={linha}>
          <span style={etiqueta(f.estado)}>{f.cor.icone} {f.texto}</span>
          <span style={{ flex: 1, minWidth: 180 }}>
            <b>{f.codigo || "Sem código"}</b> · {f.titulo || "Sem título"}
            {f.mlb ? <span style={sub}> · {f.mlb}</span> : null}
            {f.publicado && f.mlb ? <BotaoCopiarMLB mlb={f.mlb} compacto /> : null}
            {f.conta ? <span style={sub}> · {f.conta}</span> : null}
            {f.canais ? <span data-paiia-canais-ficha style={sub}> · Canais: {f.canais}</span> : null}
            {f.pendencia ? <span style={{ ...sub, color: "#fca5a5" }}> · {f.pendencia}</span> : null}
            {f.noNovoAnuncio ? <span style={sub}> · Novo Anúncio · {f.completa ? "ficha completa" : "ficha parcial"}</span> : null}
            {!f.publicado && publicadosPorCodigo.has(String(f.codigo || "").toUpperCase().replace(/[^A-Z0-9]/g, "")) ? (
              <span data-paiia-codigo-ja-publicado style={{ ...sub, color: "#fbbf24" }}> · ⚠ Este código já tem anúncio publicado ({publicadosPorCodigo.get(String(f.codigo || "").toUpperCase().replace(/[^A-Z0-9]/g, ""))}) — esta é OUTRA ficha</span>
            ) : null}
          </span>
          <button type="button" data-paiia-abrir-ficha={f.id} onClick={() => abrirFicha(f.id)} style={botao}>
            {f.publicado
              ? f.estado === ESTADO_CENTRAL.AGUARDANDO_BLING
                ? "🔗 Concluir Bling desta ficha"
                : "👁 Ver ficha publicada"
              : f.noNovoAnuncio
                ? "✏️ Continuar no Novo Anúncio"
                : f.estado === ESTADO_CENTRAL.AGUARDANDO_CONFERENCIA
                  ? "📝 Continuar Conferência"
                  : f.estado === ESTADO_CENTRAL.AGUARDANDO_INTEGRACAO
                    ? "🧩 Ver canais escolhidos"
                    : "▶ Continuar"}
          </button>
          <button type="button" data-paiia-excluir-ficha={f.id} onClick={() => excluir(f)} disabled={Boolean(excluindo || arquivando)} style={botaoExcluir}>
            {excluindo === f.id || arquivando === f.id ? "⏳ Excluindo..." : "🗑 Excluir"}
          </button>
        </div>
      ))}
      {estado.fichas.length > 12 && (
        <button type="button" onClick={() => setMostrarTodas((v) => !v)} style={{ ...botao, marginTop: 8 }}>
          {mostrarTodas ? "Mostrar menos" : `Mostrar todas (${estado.fichas.length})`}
        </button>
      )}
    </section>
  );
}

const caixa = { border: "1px solid #334155", borderRadius: 12, padding: 14, background: "#0f172a", marginBottom: 16 };
const linha = { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "8px 0", borderTop: "1px solid #1e293b", color: "#e2e8f0", fontSize: 14 };
const sub = { color: "#94a3b8", fontSize: 12 };
const botaoExcluir = { padding: "6px 12px", borderRadius: 8, border: "1px solid #7f1d1d", background: "transparent", color: "#fca5a5", cursor: "pointer", fontSize: 13 };
const botao = { padding: "6px 12px", borderRadius: 8, border: "1px solid #475569", background: "#334155", color: "#e2e8f0", cursor: "pointer", fontSize: 13 };
const etiqueta = (e) => ({ background: COR_ESTADO_CENTRAL[e].fundo, color: COR_ESTADO_CENTRAL[e].texto, borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" });
