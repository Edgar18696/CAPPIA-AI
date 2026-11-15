// (Novo Anúncio) Etapa final da PUBLICAÇÃO — escolha das contas Mercado Livre (14/11/2026).
// Uma caixa independente por conta (LOJA ONLINE, REVELAÇÃO, CIEBR): 1, 2 ou as 3.
// Cada conta marcada é conferida SEPARADAMENTE (conexão, estoque, duplicidade, frete oficial
// DAQUELA conta, preço/margem); impedimento numa conta não bloqueia as outras liberadas.
// Nada é publicado sem a confirmação final, que mostra exatamente quais contas serão usadas.
// LOJA ONLINE segue com a autorização única (o mesmo piloto do PAIIA Voz: Bling, validação,
// publicação travada no servidor, ativo, vínculo, Central); as outras contas seguem a Publicação
// de sempre, conta por conta, com o seu toque em Publicar.
import { useEffect, useMemo, useState } from "react";
import { nomeDaLoja, verificarDuplicidadeML } from "../services/duplicidadeML";
import { novaAutorizacaoId } from "../services/pilotoPublicacao";
import { consultorML, modalidadesDaConta, FRETE_SIMULADO_PERMITIDO } from "../services/consultaMLLeitura";
import { conferirDuplicidadeBase, obterAnuncio, registrarContasPublicacao } from "../services/anuncioPublicacaoService";
import {
  CONTAS_PUBLICACAO_ML, CONTA_PUBLICACAO_AUTOMATICA, SITUACAO_CONTA, assinaturaVerificacao,
  montarPlanoContas, nomeContaPublicacao, resumoConfirmacao, verificarContasPublicacao,
} from "../services/contasPublicacaoML";

const CHAVE = (id) => `paiiaAutorizacaoPublicacao:${id}`;
const COR = { ok: "#86efac", aviso: "#fde68a", conferir: "#fde68a", erro: "#fca5a5" };
const SELO = {
  [SITUACAO_CONTA.LIBERADA]: { txt: "✅ Liberada", cor: "#86efac" },
  [SITUACAO_CONTA.CONFERIR]: { txt: "⚠ Conferir", cor: "#fde68a" },
  [SITUACAO_CONTA.IMPEDIDA]: { txt: "⛔ Impedida", cor: "#fca5a5" },
};

export default function AutorizacaoUnicaPublicacao({ anuncioId = "", sku = "", codigo = "", titulo = "", preco = "", quantidade = "", contas = [], dadosFrete = null, onAutorizar, onManual = null, ativo = false }) {
  const [marcadas, setMarcadas] = useState({});
  const [verificacao, setVerificacao] = useState(null);
  const [verificando, setVerificando] = useState(false);
  const [conferidas, setConferidas] = useState({});
  const [marcado, setMarcado] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState("");
  // (Fila de contas) Ficha preparada para a PRÓXIMA conta: só pré-marca as contas que faltam.
  // Nada é conferido nem confirmado sozinho: "Conferir" e "Confirmar" continuam sendo seus toques.
  const [origemFila, setOrigemFila] = useState(null);
  useEffect(() => {
    let ativoEf = true;
    if (!anuncioId) return undefined;
    (async () => {
      const r = await obterAnuncio(anuncioId);
      const p = r?.ok ? r.anuncio?.dados_conferencia?.contas_publicacao : null;
      if (!ativoEf || !p?.pendente || !Array.isArray(p.sugeridas) || !p.sugeridas.length) return;
      setOrigemFila(p.origem || null);
      setMarcadas((m) => (Object.keys(m).length ? m : Object.fromEntries(p.sugeridas.map((id) => [String(id), true]))));
    })();
    return () => { ativoEf = false; };
  }, [anuncioId]);
  const conectadas = useMemo(() => new Set((contas || []).map((c) => String(c.ml_user_id || ""))), [contas]);
  // Publicação automática (piloto): por enquanto só LOJA ONLINE.
  const loja = (contas || []).find((c) => nomeDaLoja(c.ml_user_id, c.nickname) === "LOJA ONLINE");
  const dados = {
    sku, codigo: codigo || sku, preco, quantidade,
    medida: dadosFrete?.medida || null,
    registroFrete: dadosFrete?.registro || null,
    categoria: dadosFrete?.categoria || "",
    tipoAnuncio: dadosFrete?.tipoAnuncio || "",
  };
  const selecao = CONTAS_PUBLICACAO_ML.filter((c) => marcadas[c.id]).map((c) => c.id);
  const verificacaoValida = Boolean(verificacao) && verificacao.assinatura === assinaturaVerificacao(selecao, dados);
  const resumo = verificacaoValida ? resumoConfirmacao(verificacao.resultados, conferidas) : null;
  if (ativo || !anuncioId || !(contas || []).length) return null;

  function alternar(id, v) {
    setMarcadas((m) => ({ ...m, [id]: v }));
    setMarcado(false);
    setErro("");
  }

  async function verificar() {
    if (!selecao.length) return;
    setVerificando(true);
    setMarcado(false);
    setErro("");
    // Somente leitura: base PAIIA e Mercado Livre (ml_consulta GET) de cada conta marcada.
    const deps = {
      conectada: (id) => conectadas.has(String(id)),
      modalidades: (id) => modalidadesDaConta(id),
      consultar: (id) => consultorML(id),
      duplicidadeBase: (a) => conferirDuplicidadeBase(a),
      duplicidadeML: (a) => verificarDuplicidadeML(a),
      simulacaoPermitida: FRETE_SIMULADO_PERMITIDO,
    };
    try {
      setVerificacao(await verificarContasPublicacao({ selecao, dados, deps }));
    } catch (e) {
      setErro(`Não foi possível conferir as contas (${e?.message || e}). Nada foi publicado.`);
    }
    setVerificando(false);
  }

  async function confirmar() {
    if (!marcado || !resumo?.contas.length || gravando) return;
    setGravando(true);
    setErro("");
    const plano = montarPlanoContas({ selecao, resultados: verificacao.resultados, conferidas });
    const contaFicha = plano.conta_desta_ficha;
    const r = await registrarContasPublicacao({ anuncioId, plano, codigo: codigo || sku, titulo, contaNome: nomeContaPublicacao(contaFicha) });
    setGravando(false);
    if (!r.ok) { setErro(`${r.erro || "Não foi possível gravar as contas."} Nada foi publicado.`); return; }
    if (contaFicha === CONTA_PUBLICACAO_AUTOMATICA && loja && String(loja.ml_user_id) === contaFicha) {
      // Mesmo nº se a autorização desta ficha já foi dada (toque repetido / recarregar): o servidor nunca publica 2x.
      // (15/11) Só reaproveita o nº guardado para ESTA ficha (com ID). Sem ID: sempre um nº novo e nada é
      // guardado — antes, "paiiaAutorizacaoPublicacao:" (sem ID) era a mesma chave para fichas diferentes.
      const fichaDaAut = /^[0-9a-f-]{36}$/i.test(String(anuncioId || "")) ? String(anuncioId) : "";
      let id = "";
      if (fichaDaAut) { try { id = sessionStorage.getItem(CHAVE(fichaDaAut)) || ""; } catch { id = ""; } }
      if (!/^[0-9a-f-]{36}$/i.test(id)) { id = novaAutorizacaoId(); if (fichaDaAut) { try { sessionStorage.setItem(CHAVE(fichaDaAut), id); } catch { /* segue com o nº em memória */ } } }
      try { const u = new URL(window.location.href); u.searchParams.set("auto", id); u.searchParams.set("ficha", anuncioId); window.history.replaceState(window.history.state, "", u.pathname + u.search + u.hash); } catch { /* sem URL */ }
      onAutorizar?.(contaFicha, id, plano);
    } else {
      onManual?.(contaFicha, plano);
    }
  }

  return (
    <div data-paiia-autorizacao-unica data-paiia-contas-publicacao style={{ border: "2px solid #22c55e", borderRadius: 12, padding: 14, margin: "12px 0", background: "#052e16", color: "#e2e8f0" }}>
      <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>Publicar no Mercado Livre — em quais contas?</div>
      <div style={{ fontSize: 13, color: "#bbf7d0", marginBottom: 8 }}>
        SKU <b>{sku || "—"}</b>{preco ? <> · preço <b>{preco}</b></> : ""}{quantidade ? <> · quantidade <b>{quantidade}</b></> : ""}. Marque uma, duas ou as três. Cada conta é conferida separadamente; um problema numa conta não trava as outras.
      </div>
      {origemFila?.conta && origemFila.motivo === "republicacao" && (
        <div data-paiia-origem-retomada={origemFila.conta} style={{ fontSize: 13, color: "#fde68a", marginBottom: 8 }}>
          🔁 Ficha retomada: o anúncio anterior{origemFila.mlb ? <> <b>{origemFila.mlb}</b></> : ""} em <b>{nomeContaPublicacao(origemFila.conta)}</b> foi encerrado/excluído no Mercado Livre e NÃO é reutilizado. Sugerimos a mesma conta; ela é conferida de novo (duplicidade ao vivo) e só publica com a sua confirmação.
        </div>
      )}
      {origemFila?.conta && origemFila.motivo !== "republicacao" && (
        <div data-paiia-origem-fila={origemFila.conta} style={{ fontSize: 13, color: "#bae6fd", marginBottom: 8 }}>
          ➡ Continuação da fila: este anúncio já foi publicado em <b>{nomeContaPublicacao(origemFila.conta)}</b>{origemFila.mlb ? <> ({origemFila.mlb})</> : ""}. Marcamos as contas que faltam; confira e confirme.
        </div>
      )}
      <div style={{ display: "grid", gap: 6 }}>
        {CONTAS_PUBLICACAO_ML.map((c) => {
          const on = conectadas.has(c.id);
          return (
            <label key={c.id} data-paiia-conta-publicacao={c.nome} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 15, color: on ? "#e2e8f0" : "#94a3b8", cursor: "pointer" }}>
              <input type="checkbox" checked={Boolean(marcadas[c.id])} onChange={(e) => alternar(c.id, e.target.checked)} disabled={verificando || gravando} data-paiia-conta-check={c.id} />
              <span><b>{c.nome}</b> <span style={{ fontSize: 12, color: "#94a3b8" }}>(ID {c.id}){on ? "" : " — não conectada"}{c.id === CONTA_PUBLICACAO_AUTOMATICA ? " · publicação automática" : " · publicação conferida por você"}</span></span>
            </label>
          );
        })}
      </div>
      <button type="button" onClick={verificar} disabled={!selecao.length || verificando || gravando} data-paiia-verificar-contas
        style={{ marginTop: 10, width: "100%", padding: "10px 14px", fontSize: 15, fontWeight: 700, borderRadius: 10, border: "1px solid #22c55e", background: selecao.length ? "#14532d" : "#334155", color: "#fff", cursor: selecao.length ? "pointer" : "not-allowed" }}>
        {verificando ? "⏳ Conferindo cada conta (somente leitura)…" : verificacaoValida ? "🔄 Conferir de novo" : "🔎 Conferir as contas marcadas"}
      </button>

      {verificacao && !verificacaoValida && !verificando && (
        <p data-paiia-verificacao-desatualizada style={{ color: "#fde68a", fontSize: 13, margin: "8px 0 0" }}>As contas marcadas ou os dados mudaram: confira de novo antes de confirmar.</p>
      )}

      {verificacaoValida && (
        <div data-paiia-resultado-contas style={{ marginTop: 10, display: "grid", gap: 8 }}>
          {verificacao.resultados.map((r) => (
            <div key={r.conta} data-paiia-resultado-conta={r.conta} data-paiia-situacao-conta={r.situacao} style={{ border: `1px solid ${SELO[r.situacao].cor}`, borderRadius: 10, padding: 10, background: "#020617" }}>
              <div style={{ fontWeight: 700 }}>{r.nome} <span style={{ color: SELO[r.situacao].cor }}>{SELO[r.situacao].txt}</span></div>
              <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 13 }}>
                {r.itens.map((i, k) => <li key={k} style={{ color: COR[i.nivel] || "#e2e8f0" }}><b>{i.item}:</b> {i.texto}</li>)}
              </ul>
              {r.situacao === SITUACAO_CONTA.CONFERIR && (
                <label style={{ display: "flex", gap: 8, marginTop: 6, fontSize: 13 }}>
                  <input type="checkbox" checked={conferidas[r.conta] === true} onChange={(e) => { setConferidas((x) => ({ ...x, [r.conta]: e.target.checked })); setMarcado(false); }} data-paiia-conferi-possivel={r.conta} />
                  <span>Conferi no Mercado Livre: NÃO é o mesmo produto. Pode publicar em {r.nome}.</span>
                </label>
              )}
            </div>
          ))}

          <div data-paiia-confirmacao-contas style={{ border: "2px solid #22c55e", borderRadius: 10, padding: 10 }}>
            <div data-paiia-contas-confirmadas={resumo.contas.join(",")} style={{ fontWeight: 700 }}>{resumo.texto}</div>
            {resumo.fora.length > 0 && (
              <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12, color: "#fca5a5" }}>
                {resumo.fora.map((f) => <li key={f.conta}><b>{f.nome}</b> fica de fora: {f.motivo}</li>)}
              </ul>
            )}
            {resumo.contas.length > 1 && (
              <p style={{ fontSize: 12, color: "#bbf7d0", margin: "6px 0 0" }}>
                Ordem: primeiro <b>{resumo.nomes[0]}</b> (esta ficha); depois {resumo.nomes.slice(1).join(" e ")}, uma conta de cada vez. Cada conta tem o seu próprio anúncio (MLB).
              </p>
            )}
            {resumo.contas.length > 0 && (
              <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 14, marginTop: 8 }}>
                <input type="checkbox" checked={marcado} onChange={(e) => setMarcado(e.target.checked)} disabled={gravando} data-paiia-autorizacao-unica-check />
                <span>
                  <b>Autorizo publicar SOMENTE em: {resumo.nomes.join(", ")}.</b>
                  {resumo.contas[0] === CONTA_PUBLICACAO_AUTOMATICA && loja
                    ? <> Na LOJA ONLINE o PAIIA usa o Bling (cadastra só se o SKU não existir, com o estoque da ficha) e conclui sozinho o vínculo e a Central. É uma única autorização: nada é publicado duas vezes.</>
                    : <> Na Publicação de {resumo.nomes[0]} você ainda confere e toca em Publicar.</>}
                </span>
              </label>
            )}
            {resumo.contas.length > 0 && (
              <button type="button" disabled={!marcado} onClick={confirmar} data-paiia-autorizacao-unica-botao
                style={{ marginTop: 10, width: "100%", padding: "14px 16px", fontSize: 17, fontWeight: 800, borderRadius: 10, border: "none", background: marcado && !gravando ? "#16a34a" : "#334155", color: "#fff", cursor: marcado && !gravando ? "pointer" : "not-allowed" }}>
                {gravando ? "⏳ Gravando as contas na ficha…" : `✅ Confirmar e Enviar (${resumo.nomes.join(", ")})`}
              </button>
            )}
          </div>
        </div>
      )}
      {erro && <p data-paiia-erro-contas style={{ color: "#fca5a5", fontSize: 13, margin: "8px 0 0" }}>❌ {erro}</p>}
      {onManual && <button type="button" onClick={() => onManual()} data-paiia-publicacao-manual style={{ marginTop: 8, background: "none", border: "none", color: "#94a3b8", textDecoration: "underline", cursor: "pointer", fontSize: 13 }}>Publicar manualmente (correção)</button>}
    </div>
  );
}
