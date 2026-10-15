import { useCallback, useEffect, useState } from "react";
import { obterAnuncio, publicacaoExiste, registrarCanaisPublicacao } from "../services/anuncioPublicacaoService";
import {
  CANAIS_PUBLICACAO,
  CANAL,
  MODO_CANAIS,
  SITUACAO_CANAL,
  TEXTO_AGUARDANDO_INTEGRACAO,
  TEXTO_INTEGRACAO_PENDENTE,
  erroSelecao,
  modoInicialCanais,
  normalizarSelecao,
  resumoCanais,
} from "../services/canaisPublicacao";

/*
 * "Escolher canais de publicação" — aparece ao finalizar o anúncio, ANTES
 * da Publicação do Mercado Livre (que continua exatamente a mesma).
 * - Mercado Livre: "Salvar e continuar no Mercado Livre" abre a Publicação
 *   de hoje (REVELAÇÃO, LOJA ONLINE ou CIEBR).
 * - Shopee e WooCommerce: só ficam registrados ("Integração pendente").
 *   Esta tela NÃO chama nenhuma integração e NÃO publica nada.
 * - A escolha fica na ficha (dados_conferencia.canais_publicacao): o F5
 *   volta com a mesma escolha.
 * onLiberarML(true|false): a Publicação do ML aparece (true) ou não.
 */
/** Lê a ficha e decide como a tela abre (sem gravar nada). */
async function lerModoCanais(anuncioId) {
  const id = String(anuncioId || "");
  if (!id) return { ...modoInicialCanais({ temId: false }), salvo: null };
  const r = await obterAnuncio(id);
  if (!r.ok) return { erro: r.erro || "Não foi possível ler a ficha na base PAIIA." };
  const m = modoInicialCanais({ temId: true, anuncio: r.anuncio, publicada: publicacaoExiste(r.anuncio.publicacao) });
  return { ...m, salvo: r.anuncio.dados_conferencia?.canais_publicacao || null };
}

export default function EscolherCanaisPublicacao({ anuncioId, temContaML = true, onLiberarML, onIrCentral }) {
  const [estado, setEstado] = useState({ carregando: true, erro: "", modo: "", selecao: null, salvo: null });
  const [marcados, setMarcados] = useState(null);
  const [gravando, setGravando] = useState(false);
  const [aviso, setAviso] = useState("");
  // Aplica o que foi lido da base (só depois da leitura terminar).
  const aplicar = useCallback((res) => {
    if (res.erro) {
      // Falha de leitura NÃO é "sem escolha": nada é decidido nem gravado.
      setEstado({ carregando: false, erro: res.erro, modo: "", selecao: null, salvo: null });
      onLiberarML?.(false);
      return;
    }
    setEstado({ carregando: false, erro: "", modo: res.modo, selecao: res.selecao, salvo: res.salvo });
    setMarcados(res.selecao);
    onLiberarML?.(res.liberarML);
  }, [onLiberarML]);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const res = await lerModoCanais(anuncioId);
      if (ativo) aplicar(res);
    })();
    return () => { ativo = false; };
  }, [anuncioId, aplicar]);

  async function tentarDeNovo() {
    setEstado((e) => ({ ...e, carregando: true, erro: "" }));
    aplicar(await lerModoCanais(anuncioId));
  }

  function alternar(id) {
    setAviso("");
    setMarcados((s) => ({ ...normalizarSelecao(s), [id]: !normalizarSelecao(s)[id] }));
  }

  async function salvar() {
    const sel = normalizarSelecao(marcados);
    const erro = erroSelecao(sel);
    if (erro) {
      setAviso(erro);
      return;
    }
    setGravando(true);
    setAviso("");
    const r = await registrarCanaisPublicacao({ anuncioId, selecao: sel });
    setGravando(false);
    if (!r.ok) {
      setAviso(r.erro || "Não foi possível salvar a escolha dos canais.");
      return;
    }
    const comML = sel[CANAL.MERCADO_LIVRE];
    setEstado((e) => ({ ...e, modo: comML ? MODO_CANAIS.RESUMO : MODO_CANAIS.AGUARDANDO, selecao: sel, salvo: r.registro }));
    onLiberarML?.(comML);
  }

  function alterar() {
    setAviso("");
    setMarcados(estado.selecao);
    // A Publicação do ML (se aberta) continua montada enquanto altera:
    // ela só sai se a nova escolha, já gravada, não tiver o ML.
    setEstado((e) => ({ ...e, modo: MODO_CANAIS.ESCOLHENDO, voltarPara: e.modo }));
  }

  function cancelarAlteracao() {
    setAviso("");
    setMarcados(estado.selecao);
    setEstado((e) => ({ ...e, modo: e.voltarPara || MODO_CANAIS.ESCOLHENDO, voltarPara: "" }));
  }

  if (estado.carregando) {
    return <section data-paiia-canais-carregando style={caixa}>⏳ Lendo os canais desta ficha na base PAIIA...</section>;
  }
  if (estado.erro) {
    return (
      <section data-paiia-canais-erro style={caixa}>
        <p style={{ color: "#fca5a5", margin: "0 0 10px" }}>❌ {estado.erro} Nada foi alterado.</p>
        <button type="button" onClick={tentarDeNovo} style={botaoSec}>↻ Tentar de novo</button>
      </section>
    );
  }

  const sel = normalizarSelecao(marcados);
  const comML = sel[CANAL.MERCADO_LIVRE];
  const erroSel = erroSelecao(sel);

  if (estado.modo === MODO_CANAIS.SEM_FICHA || estado.modo === MODO_CANAIS.FECHADA) {
    return (
      <section data-paiia-canais-modo={estado.modo} style={caixaResumo}>
        <b style={{ color: "#e2e8f0" }}>Canais de publicação:</b>{" "}
        <span style={{ color: "#cbd5e1" }}>{resumoCanais(estado.selecao)}</span>
        <p style={sub}>
          {estado.modo === MODO_CANAIS.SEM_FICHA
            ? "A ficha ainda não está gravada na base PAIIA: a escolha de canais não pode ser salva agora. A Publicação do Mercado Livre segue como antes."
            : "Esta ficha já foi publicada, está publicando ou foi cancelada: os canais não são alterados aqui."}
        </p>
      </section>
    );
  }

  if (estado.modo === MODO_CANAIS.RESUMO || estado.modo === MODO_CANAIS.AGUARDANDO) {
    const aguardando = estado.modo === MODO_CANAIS.AGUARDANDO;
    return (
      <section data-paiia-canais-modo={estado.modo} style={aguardando ? caixa : caixaResumo}>
        {aguardando && <h3 style={{ color: "#ddd6fe", margin: "0 0 8px" }}>🧩 {TEXTO_AGUARDANDO_INTEGRACAO}</h3>}
        <div>
          <b style={{ color: "#e2e8f0" }}>Canais de publicação:</b>{" "}
          <span data-paiia-canais-resumo style={{ color: "#cbd5e1" }}>{resumoCanais(estado.selecao)}</span>
        </div>
        {aguardando ? (
          <p style={sub}>
            Escolha salva na ficha. Shopee e Site próprio ainda não têm integração: nada foi publicado e esta ficha não está pronta para o Mercado Livre. Para publicar no Mercado Livre, altere os canais e marque Mercado Livre.
          </p>
        ) : (
          <p style={sub}>Escolha salva na ficha. A publicação no Mercado Livre continua abaixo; os outros canais marcados aguardam integração.</p>
        )}
        <div style={linhaBotoes}>
          <button type="button" data-paiia-alterar-canais onClick={alterar} style={botaoSec}>✏️ Alterar canais</button>
          {aguardando && onIrCentral && (
            <button type="button" data-paiia-canais-central onClick={onIrCentral} style={botaoSec}>← Voltar à Central de Publicação</button>
          )}
        </div>
      </section>
    );
  }

  // MODO_CANAIS.ESCOLHENDO
  return (
    <section data-paiia-escolher-canais style={caixa}>
      <h3 style={{ color: "#fde047", margin: "0 0 4px" }}>Escolher canais de publicação</h3>
      <p style={{ ...sub, marginTop: 0 }}>Marque um, dois ou todos os canais. Nada é publicado automaticamente.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "10px 0" }}>
        {CANAIS_PUBLICACAO.map((c) => {
          const pendente = c.situacao === SITUACAO_CANAL.INTEGRACAO_PENDENTE;
          return (
            <label key={c.id} data-paiia-canal={c.id} style={{ ...opcao, borderColor: sel[c.id] ? "#22c55e" : "#334155" }}>
              {/* Caixa de tamanho fixo: o CSS do celular põe input com largura 100%. */}
              <span style={{ display: "inline-flex", width: 22, height: 22, flex: "0 0 22px" }}>
                <input type="checkbox" data-paiia-canal-check={c.id} checked={sel[c.id]} onChange={() => alternar(c.id)} disabled={gravando} style={{ width: 22, height: 22, margin: 0 }} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <b style={{ color: "#e2e8f0" }}>{c.nome}</b>
                {pendente && <span data-paiia-integracao-pendente style={{ ...selo, marginLeft: 8 }}>{TEXTO_INTEGRACAO_PENDENTE}</span>}
                <span style={{ ...sub, display: "block", margin: "2px 0 0" }}>
                  {pendente ? "Fica registrado na ficha. Nada é publicado neste canal por enquanto." : c.detalhe}
                </span>
              </span>
            </label>
          );
        })}
      </div>
      {comML && !temContaML && (
        <p style={{ ...sub, color: "#fbbf24" }}>⚠ Nenhuma conta Mercado Livre conectada: conecte em Contas Marketplace para continuar no Mercado Livre.</p>
      )}
      {(aviso || erroSel) && <p data-paiia-canais-aviso style={{ ...sub, color: "#fca5a5" }}>❌ {aviso || erroSel}</p>}
      <div style={linhaBotoes}>
        <button
          type="button"
          data-paiia-salvar-canais={comML ? "ml" : "aguardando"}
          onClick={salvar}
          disabled={gravando || Boolean(erroSel) || (comML && !temContaML)}
          style={{ ...botaoPri, opacity: gravando || erroSel || (comML && !temContaML) ? 0.5 : 1 }}
        >
          {gravando ? "⏳ Salvando..." : comML ? "✅ Salvar e continuar no Mercado Livre" : `💾 Salvar escolha (${TEXTO_AGUARDANDO_INTEGRACAO})`}
        </button>
        {estado.voltarPara && (
          <button type="button" onClick={cancelarAlteracao} disabled={gravando} style={botaoSec}>Cancelar</button>
        )}
      </div>
    </section>
  );
}

const caixa = { border: "1px solid #334155", borderRadius: 12, padding: 14, background: "#0f172a", margin: "0 0 16px", maxWidth: "100%", boxSizing: "border-box", textAlign: "left" };
const caixaResumo = { ...caixa, padding: "10px 14px" };
const sub = { color: "#94a3b8", fontSize: 13, margin: "6px 0 0", overflowWrap: "anywhere" };
const opcao = { display: "flex", alignItems: "center", gap: 10, textAlign: "left", padding: "10px 12px", border: "1px solid #334155", borderRadius: 10, background: "#111827", cursor: "pointer", maxWidth: "100%", boxSizing: "border-box" };
const selo = { display: "inline-block", background: "#4c1d95", color: "#ddd6fe", borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" };
const linhaBotoes = { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 };
const botaoPri = { padding: "12px 16px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#16a34a,#22c55e)", color: "#fff", fontWeight: 700, cursor: "pointer", whiteSpace: "normal", maxWidth: "100%" };
const botaoSec = { padding: "10px 14px", borderRadius: 10, border: "1px solid #475569", background: "#334155", color: "#e2e8f0", cursor: "pointer", whiteSpace: "normal", maxWidth: "100%" };
