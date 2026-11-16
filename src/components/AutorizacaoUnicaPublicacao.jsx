// (16/11/2026) FINALIZAÇÃO EM DOIS CLIQUES — as três contas do Mercado Livre funcionam IGUAL.
//   1º clique "🔎 Conferir e Publicar": lê (somente leitura) o Bling, as três contas do Mercado Livre
//      (SKU do anúncio e das VARIAÇÕES, fichas e registro de MLBs) e as exigências de cada conta
//      (conexão, estoque, preço, frete, margem, fotos). Cada conta aparece como PUBLICADO, JÁ EXISTENTE,
//      PENDENTE, CONFERIR ou IMPEDIDO, com o MLB e o motivo. Nada é apagado nem gravado.
//   2º clique "✅ Confirmar Publicação na <conta>": grava a conta escolhida na ficha e entrega ao piloto
//      (Bling sem duplicar, envio ÚNICO travado no servidor, MLB real, vínculo, Central de Publicação).
// Ficha já publicada: reconhece o MLB e não reenvia. Envio sem resposta: "Retomar com segurança".
import { useEffect, useMemo, useState } from "react";
import { verificarDuplicidadeML } from "../services/duplicidadeML";
import { novaAutorizacaoId, mlbRegistradoDaFicha } from "../services/pilotoPublicacao";
import { consultorML, modalidadesDaConta, FRETE_SIMULADO_PERMITIDO } from "../services/consultaMLLeitura";
import { conferirDuplicidadeBase, obterAnuncio, registrarContasPublicacao, registrarMLBPublicado, limparEnvioPublicacao, registrarBlingDescartado } from "../services/anuncioPublicacaoService";
import { CONTAS_PUBLICACAO_ML, assinaturaVerificacao, montarPlanoContas, nomeContaPublicacao, verificarContasPublicacao } from "../services/contasPublicacaoML";
import { contasParaConsultar } from "../services/reconhecimentoSKU";
import { reconhecerProdutoExistente, lerFichasDoCodigo } from "../services/produtoExistenteService";
import { quadroProdutoExistente, ORDEM_CONTAS_QUADRO } from "../services/produtoExistenteSKU";
import { ESTADO_FINAL, situacaoFinalDasContas } from "../services/finalizacaoPublicacao";
import { envioPendenteDaFicha, retomarPublicacao } from "../services/publicacaoVerificada";
import { registroPublicado } from "../services/vinculoBlingPublicacao";
import { produtosBlingRegistradosDoSku, idsBlingDescartados, semBlingDescartados } from "../services/estoqueBlingPAIIA";

const CHAVE = (id) => `paiiaAutorizacaoPublicacao:${id}`;
const COR = {
  [ESTADO_FINAL.PUBLICADO]: "#86efac",
  [ESTADO_FINAL.JA_EXISTENTE]: "#93c5fd",
  [ESTADO_FINAL.PENDENTE]: "#e2e8f0",
  [ESTADO_FINAL.CONFERIR]: "#fde68a",
  [ESTADO_FINAL.IMPEDIDO]: "#fca5a5",
};
const ICONE = { [ESTADO_FINAL.PUBLICADO]: "✅", [ESTADO_FINAL.JA_EXISTENTE]: "📌", [ESTADO_FINAL.PENDENTE]: "⏳", [ESTADO_FINAL.CONFERIR]: "⚠", [ESTADO_FINAL.IMPEDIDO]: "⛔" };

export default function AutorizacaoUnicaPublicacao({ anuncioId = "", sku = "", codigo = "", titulo = "", preco = "", quantidade = "", fotos = 0, contas = [], dadosFrete = null, onAutorizar, onManual = null, ativo = false }) {
  const [st, setSt] = useState({ lendo: false, res: null, assinatura: "", erro: "" });
  const [ocupado, setOcupado] = useState("");
  const [aviso, setAviso] = useState("");
  // (16/11) ERRO 1 — a conta é ESCOLHIDA primeiro (1º clique); só então a conferência roda.
  const [escolhida, setEscolhida] = useState("");
  // Ficha retomada / continuação: só AVISA de onde veio. Nada é conferido nem confirmado sozinho.
  const [origemFila, setOrigemFila] = useState(null);
  useEffect(() => {
    let ativoEf = true;
    if (!anuncioId) return undefined;
    (async () => {
      const r = await obterAnuncio(anuncioId);
      const p = r?.ok ? r.anuncio?.dados_conferencia?.contas_publicacao : null;
      if (!ativoEf || !p?.pendente) return;
      setOrigemFila(p.origem || null);
    })();
    return () => { ativoEf = false; };
  }, [anuncioId]);
  const conectadas = useMemo(() => new Set((contas || []).map((c) => String(c.ml_user_id || ""))), [contas]);
  const dados = {
    sku, codigo: codigo || sku, preco, quantidade,
    medida: dadosFrete?.medida || null,
    registroFrete: dadosFrete?.registro || null,
    categoria: dadosFrete?.categoria || "",
    tipoAnuncio: dadosFrete?.tipoAnuncio || "",
  };
  const todas = CONTAS_PUBLICACAO_ML.map((c) => c.id);
  const assinatura = `${assinaturaVerificacao(todas, dados)}|${Number(fotos) || 0}|${escolhida}`;
  const valida = Boolean(st.res) && st.assinatura === assinatura;
  if (ativo || !anuncioId) return null;

  // 1º CLIQUE — escolher a conta: a conferência roda na hora (somente leitura no ML e no Bling). Lê as
  // três contas para mostrar onde o anúncio já existe, mas só a conta ESCOLHIDA recebe o botão de autorização.
  async function conferir(conta = escolhida) {
    if (st.lendo || ocupado || !conta) return;
    setEscolhida(conta);
    const assinaturaDaConta = `${assinaturaVerificacao(todas, dados)}|${Number(fotos) || 0}|${conta}`;
    setSt({ lendo: true, res: null, assinatura: "", erro: "" });
    setAviso("");
    try {
      const lida = await obterAnuncio(anuncioId);
      if (!lida?.ok) throw new Error(lida?.erro || "ficha não lida");
      const f = lida.anuncio;
      const mlb = mlbRegistradoDaFicha(f);
      const ficha = { id: anuncioId, mlb, conta: String(f.publicacao?.ml_user_id || (mlb ? f.conta_destino_ml_user_id : "") || ""), envio: envioPendenteDaFicha(f) };
      const listaContas = contasParaConsultar(contas || [], "");
      const [rec, fichas, verif] = await Promise.all([
        reconhecerProdutoExistente({ codigo: String(sku || codigo || "").trim(), contas: listaContas }),
        lerFichasDoCodigo(String(sku || codigo || "").trim()),
        verificarContasPublicacao({
          selecao: todas,
          dados,
          deps: {
            conectada: (id) => conectadas.has(String(id)),
            modalidades: (id) => modalidadesDaConta(id),
            consultar: (id) => consultorML(id),
            duplicidadeBase: (a) => conferirDuplicidadeBase(a),
            duplicidadeML: (a) => verificarDuplicidadeML(a),
            simulacaoPermitida: FRETE_SIMULADO_PERMITIDO,
          },
        }),
      ]);
      const quadro = quadroProdutoExistente({ fichas: fichas?.ok ? fichas.anuncios : [], reconhecimento: rec });
      // Produtos Bling já registrados nas fichas deste SKU (inclusive esta): nunca cadastra outro por cima.
      const blingRegistrados = semBlingDescartados(produtosBlingRegistradosDoSku([...(fichas?.ok ? fichas.anuncios : []), { id: "esta-ficha", publicacao: f.publicacao, integracao_bling: f.dados_conferencia?.integracao_bling }]), idsBlingDescartados(f.dados_conferencia));
      const res = situacaoFinalDasContas({ ficha, quadro, verificacoes: verif.resultados, fotos, blingRegistrados, sku: String(sku || codigo || "").trim() });
      setSt({ lendo: false, res: { ...res, verif, ficha }, assinatura: assinaturaDaConta, erro: "" });
    } catch (e) {
      setSt({ lendo: false, res: null, assinatura: "", erro: `Não foi possível conferir (${e?.message || e}). Nada foi publicado nem alterado.` });
    }
  }

  // 2º CLIQUE — publicar SÓ na conta escolhida (o piloto faz as etapas internas).
  async function confirmar(linha) {
    if (ocupado || !valida || linha?.acao?.tipo !== "publicar" || linha.conta !== escolhida) return;
    setOcupado(linha.conta);
    setAviso("");
    const resultado = (st.res.verif.resultados || []).find((r) => String(r.conta) === linha.conta);
    const plano = montarPlanoContas({ selecao: [linha.conta], resultados: resultado ? [resultado] : [], conferidas: linha.acao.conferida ? { [linha.conta]: true } : {} });
    if (plano.conta_desta_ficha !== linha.conta) { setOcupado(""); setAviso(`A conferência da ${linha.nome} não liberou a publicação. Confira de novo.`); return; }
    // (16/11) Você conferiu no Bling que o produto registrado não existe: registra na ficha (sem apagar nada).
    if (linha.acao.descartarBling?.length) {
      const d = await registrarBlingDescartado({ anuncioId, produtoIds: linha.acao.descartarBling, motivo: "não encontrado no Bling (conferido pelo usuário no 2º clique)" });
      if (!d.ok) { setOcupado(""); setAviso(`${d.erro || "Não foi possível registrar a conferência do Bling."} Nada foi publicado.`); return; }
    }
    const r = await registrarContasPublicacao({ anuncioId, plano, codigo: codigo || sku, titulo, contaNome: nomeContaPublicacao(linha.conta) });
    if (!r.ok) { setOcupado(""); setAviso(`${r.erro || "Não foi possível gravar a conta na ficha."} Nada foi publicado.`); return; }
    // Mesmo nº se a autorização desta ficha já foi dada (toque repetido / recarregar): o servidor nunca publica 2x.
    // (15/11) Só reaproveita o nº guardado para ESTA ficha (com ID); sem ID, sempre um nº novo.
    const fichaDaAut = /^[0-9a-f-]{36}$/i.test(String(anuncioId || "")) ? String(anuncioId) : "";
    let id = "";
    if (fichaDaAut) { try { id = sessionStorage.getItem(CHAVE(fichaDaAut)) || ""; } catch { id = ""; } }
    if (!/^[0-9a-f-]{36}$/i.test(id)) { id = novaAutorizacaoId(); if (fichaDaAut) { try { sessionStorage.setItem(CHAVE(fichaDaAut), id); } catch { /* segue com o nº em memória */ } } }
    try { const u = new URL(window.location.href); u.searchParams.set("auto", id); u.searchParams.set("ficha", anuncioId); window.history.replaceState(window.history.state, "", u.pathname + u.search + u.hash); } catch { /* sem URL */ }
    setOcupado("");
    onAutorizar?.(linha.conta, id, plano);
  }

  // Envio anterior sem resposta: confere no ML (somente leitura), adota o MLB deste SKU ou libera. Nunca reenvia.
  async function retomar(linha) {
    if (ocupado) return;
    setOcupado(linha.conta);
    const envio = st.res?.ficha?.envio;
    const rt = await retomarPublicacao({
      anuncioId,
      deps: {
        obterFicha: (x) => obterAnuncio(x),
        consultar: (conta) => consultorML(conta),
        gravarMLB: ({ mlb, link }) => {
          const reg = registroPublicado({ mlb, contaId: envio?.conta || linha.conta, skuOficial: envio?.sku || sku, codigoPesquisado: codigo || sku, produtoBlingId: "", preco });
          return registrarMLBPublicado({ anuncioId, contaId: envio?.conta || linha.conta, mlb, link, sku: envio?.sku || sku, registro: reg });
        },
        limparEnvio: () => limparEnvioPublicacao({ anuncioId }),
      },
    }).catch((e) => ({ acao: "aguardar", texto: `Retomada interrompida (${e?.message || e}). Nada foi reenviado.` }));
    setOcupado("");
    setAviso(rt.texto);
    if (rt.acao === "adotado" || rt.acao === "liberado" || rt.acao === "concluir") conferir(escolhida);
  }

  const linhas = valida ? st.res.linhas : ORDEM_CONTAS_QUADRO.map((conta) => ({ conta, nome: nomeContaPublicacao(conta), estado: "", mlbs: [], motivos: [], avisos: [], acao: { tipo: "nenhuma" } }));
  const botao = { width: "100%", padding: "14px 16px", fontSize: 17, fontWeight: 800, borderRadius: 10, border: "none", color: "#fff" };
  return (
    <div data-paiia-autorizacao-unica data-paiia-contas-publicacao data-paiia-finalizacao-dois-cliques style={{ border: "2px solid #22c55e", borderRadius: 12, padding: 14, margin: "12px 0", background: "#052e16", color: "#e2e8f0" }}>
      <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>Publicar no Mercado Livre</div>
      <div style={{ fontSize: 13, color: "#bbf7d0", marginBottom: 8 }}>
        SKU <b>{sku || "—"}</b>{preco ? <> · preço <b>{preco}</b></> : ""}{quantidade ? <> · quantidade <b>{quantidade}</b></> : ""}. <b>1º</b> escolha a conta (a conferência roda sozinha, só lendo). <b>2º</b> autorize a publicação nela.
      </div>
      {origemFila?.conta && origemFila.motivo === "republicacao" && (
        <div data-paiia-origem-retomada={origemFila.conta} style={{ fontSize: 13, color: "#fde68a", marginBottom: 8 }}>
          🔁 Ficha retomada: o anúncio anterior{origemFila.mlb ? <> <b>{origemFila.mlb}</b></> : ""} em <b>{nomeContaPublicacao(origemFila.conta)}</b> foi encerrado/excluído no Mercado Livre e NÃO é reutilizado.
        </div>
      )}
      {origemFila?.conta && origemFila.motivo !== "republicacao" && (
        <div data-paiia-origem-fila={origemFila.conta} style={{ fontSize: 13, color: "#bae6fd", marginBottom: 8 }}>
          ➡ Este anúncio já foi publicado em <b>{nomeContaPublicacao(origemFila.conta)}</b>{origemFila.mlb ? <> ({origemFila.mlb})</> : ""}. Esta ficha é para outra conta.
        </div>
      )}
      {!(contas || []).length && (
        <div data-paiia-contas-sem-conexao style={{ fontSize: 13, color: "#fde68a", marginBottom: 8 }}>⚠ Nenhuma conta Mercado Livre conectada foi carregada ainda. A conferência mostra cada conta como impedida até a conexão (Contas Marketplace).</div>
      )}

      <div data-paiia-escolher-conta data-paiia-conferir-e-publicar style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
        {ORDEM_CONTAS_QUADRO.map((conta) => {
          const marcada = escolhida === conta;
          return (
            <button key={conta} type="button" data-paiia-escolher-conta-botao={conta} aria-pressed={marcada} onClick={() => conferir(conta)} disabled={st.lendo || Boolean(ocupado)}
              style={{ ...botao, fontSize: 16, background: marcada ? "#15803d" : "#14532d", border: marcada ? "3px solid #86efac" : "1px solid #22c55e", cursor: st.lendo ? "wait" : "pointer" }}>
              {nomeContaPublicacao(conta)}
              <span style={{ display: "block", fontSize: 11, fontWeight: 400, color: "#bbf7d0" }}>{conectadas.has(conta) ? `ID ${conta}` : "não conectada"}</span>
            </button>
          );
        })}
      </div>
      {st.lendo && <p data-paiia-conferindo-conta style={{ fontSize: 13, color: "#bbf7d0", margin: "8px 0 0" }}>⏳ Conferindo {nomeContaPublicacao(escolhida)}: SKU, MLB (com variações), duplicidade, Bling, estoque, preço e frete — somente leitura…</p>}
      {valida && <button type="button" onClick={() => conferir(escolhida)} data-paiia-verificar-contas style={{ marginTop: 6, background: "none", border: "none", color: "#94a3b8", textDecoration: "underline", cursor: "pointer", fontSize: 13 }}>🔄 Conferir de novo</button>}
      {st.res && !valida && !st.lendo && <p data-paiia-verificacao-desatualizada style={{ color: "#fde68a", fontSize: 13, margin: "8px 0 0" }}>Os dados da ficha mudaram: confira de novo.</p>}
      {valida && st.res.bling && <p data-paiia-finalizacao-bling style={{ fontSize: 13, margin: "8px 0 0", color: st.res.bling.ok ? "#bbf7d0" : "#fca5a5" }}>{st.res.bling.texto}</p>}

      <div data-paiia-lista-contas-publicacao data-paiia-resultado-contas style={{ marginTop: 10, display: "grid", gap: 8 }}>
        {(valida ? [...linhas.filter((x) => x.conta === escolhida), ...linhas.filter((x) => x.conta !== escolhida)] : []).map((l) => (
          <div key={l.conta} data-paiia-conta-publicacao={l.nome} data-paiia-resultado-conta={l.conta} data-paiia-estado-final={l.estado || "nao_conferida"}
            style={{ border: `1px solid ${COR[l.estado] || "#334155"}`, borderRadius: 10, padding: 10, background: "#020617" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
              <b style={{ minWidth: 110 }}>{l.nome}</b>
              <span style={{ fontSize: 12, color: "#94a3b8" }}>ID {l.conta}{conectadas.has(l.conta) ? "" : " — não conectada"}</span>
              {l.estado && <span data-paiia-rotulo-final style={{ fontWeight: 800, color: COR[l.estado] }}>{ICONE[l.estado]} {l.rotulo}{l.mlbs.length ? ` · ${l.mlbs.join(", ")}` : ""}</span>}
            </div>
            {l.motivos.length > 0 && <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 13, color: COR[l.estado] }}>{l.motivos.map((m, k) => <li key={k}>{m}</li>)}</ul>}
            {l.avisos.filter((a) => !/^Bling/.test(a)).length > 0 && <ul style={{ margin: "4px 0 0", paddingLeft: 18, fontSize: 12, color: "#94a3b8" }}>{l.avisos.filter((a) => !/^Bling/.test(a)).map((m, k) => <li key={k}>{m}</li>)}</ul>}
            {l.conta !== escolhida && <p style={{ fontSize: 12, color: "#94a3b8", margin: "4px 0 0" }}>Só para informação: para publicar aqui, escolha esta conta acima.</p>}
            {l.conta === escolhida && l.acao.tipo === "publicar" && (
              <button type="button" data-paiia-confirmar-publicacao={l.conta} onClick={() => confirmar(l)} disabled={Boolean(ocupado)}
                style={{ ...botao, marginTop: 8, background: ocupado ? "#334155" : "#16a34a", cursor: ocupado ? "wait" : "pointer" }}>
                {ocupado === l.conta ? "⏳ Gravando a conta na ficha…" : l.acao.texto}
              </button>
            )}
            {l.conta === escolhida && l.acao.tipo === "retomar" && (
              <button type="button" data-paiia-retomar-conta={l.conta} onClick={() => retomar(l)} disabled={Boolean(ocupado)}
                style={{ ...botao, marginTop: 8, background: ocupado ? "#334155" : "#0369a1", cursor: ocupado ? "wait" : "pointer" }}>
                {ocupado === l.conta ? "⏳ Conferindo no Mercado Livre (somente leitura)…" : l.acao.texto}
              </button>
            )}
          </div>
        ))}
      </div>
      {aviso && <p data-paiia-aviso-finalizacao style={{ color: "#fde68a", fontSize: 13, margin: "8px 0 0" }}>{aviso}</p>}
      {st.erro && <p data-paiia-erro-contas style={{ color: "#fca5a5", fontSize: 13, margin: "8px 0 0" }}>❌ {st.erro}</p>}
      {onManual && <button type="button" onClick={() => onManual()} data-paiia-publicacao-manual style={{ marginTop: 8, background: "none", border: "none", color: "#94a3b8", textDecoration: "underline", cursor: "pointer", fontSize: 13 }}>Publicar manualmente (correção)</button>}
    </div>
  );
}
