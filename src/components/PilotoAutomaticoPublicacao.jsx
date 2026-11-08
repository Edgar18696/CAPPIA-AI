// (PAIIA Voz) Tela de progresso do piloto automático: sem nenhum botão de etapa.
// (08/11) Assim que o Mercado Livre confirma o MLB: "Anúncio Publicado Com Sucesso" +
// Criar Próximo Anúncio / Fechar. As conferências que faltam ficam gravadas na ficha e
// seguem em segundo plano (ConferenciasSegundoPlano), mesmo saindo desta tela.
import { useEffect, useRef, useState } from "react";
import { supabase } from "../supabase";
import { executarPiloto, ETAPAS_PILOTO, ROTULO_ETAPA, autorizacaoDaUrl } from "../services/pilotoPublicacao";
import { registrarPosPublicacao } from "../services/posPublicacaoService";
import { marcarFichaPublicada } from "../services/posPublicacao";

export default function PilotoAutomaticoPublicacao({ conta = "", sku = "", autoId = "", anuncioId = "", quantidade = "", onProximo }) {
  // Nº da autorização: do PAIIA Voz (?auto= na URL) ou da autorização única do Novo Anúncio (autoId).
  const auto = autoId || autorizacaoDaUrl(window.location.href);
  const [st, setSt] = useState({ etapa: "canais", texto: "", fim: null });
  const rodou = useRef(false);
  const [fechado, setFechado] = useState(false);
  const encerradoRef = useRef(false);
  const dadosRef = useRef({ anuncioId, quantidade, conta, sku });
  useEffect(() => { dadosRef.current = { anuncioId, quantidade, conta, sku }; }, [anuncioId, quantidade, conta, sku]);
  useEffect(() => {
    if (!auto || rodou.current) return;
    rodou.current = true;
    globalThis.__paiiaAutorizacaoPublicacao = auto;
    const p = {
      achar: (s) => document.querySelector(s),
      clicar: (el) => el.click(),
      texto: (el) => String(el?.innerText || el?.textContent || ""),
      esperar: (ms) => new Promise((ok) => setTimeout(ok, ms)),
      consultarItem: async (mlb) => {
        const { data } = await supabase.functions.invoke("mercadolivre-publicacao", { body: { acao: "consultar_item", conta_ml: String(conta), item_id: mlb } });
        return data?.ok ? data : null;
      },
      relerIntegracao: async () => {
        const v = document.querySelector("[data-paiia-verificar-bling]");
        if (v && !v.disabled) v.click();
        return document.querySelector("[data-paiia-integracao-bling]")?.getAttribute("data-paiia-integracao-bling") || "";
      },
      progresso: (etapa, texto = "") => setSt((s) => ({ ...s, etapa, texto })),
      encerrado: () => encerradoRef.current,
      // MLB confirmado e gravado: registra as conferências pendentes NA FICHA (seguem em segundo plano,
      // mesmo saindo desta tela) e marca a ficha do Voz como publicada (o Voz abre limpo depois).
      publicado: async (pub) => {
        const d = dadosRef.current;
        let registrada = false;
        try { registrada = Boolean((await registrarPosPublicacao({ anuncioId: d.anuncioId, mlb: pub.mlb, conta: d.conta, sku: d.sku, quantidade: d.quantidade }))?.ok); } catch { /* o piloto continua conferindo nesta tela */ }
        if (d.anuncioId) marcarFichaPublicada(d.anuncioId, pub.mlb);
        try { globalThis.__paiiaRodarPosPublicacao?.(); } catch { /* próxima rodada */ }
        setSt((s) => ({ ...s, publicado: { ...pub, registrada } }));
      },
    };
    executarPiloto(p, { limites: globalThis.__paiiaLimitesPiloto || {} }).then((r) => setSt((s) => ({ ...s, fim: r })), (e) => setSt((s) => ({ ...s, fim: { ok: false, etapa: s.etapa, texto: String(e?.message || e) } })));
  }, [auto, conta]);
  if (!auto || fechado) return null;
  const liberar = (proximo) => {
    encerradoRef.current = true;
    setFechado(true);
    if (proximo) onProximo?.();
  };
  const botoes = st.publicado ? (
    <div data-paiia-piloto-botoes style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
      <button type="button" data-paiia-criar-proximo onClick={() => liberar(true)} style={{ flex: "1 1 200px", padding: "12px 14px", borderRadius: 10, border: "1px solid #2f5fd0", background: "linear-gradient(160deg,#1d4ed8 0%,#123a8a 100%)", color: "#fff", fontWeight: 800, fontSize: 16, cursor: "pointer" }}>＋ Criar Próximo Anúncio</button>
      <button type="button" data-paiia-fechar-piloto onClick={() => liberar(false)} style={{ flex: "1 1 120px", padding: "12px 14px", borderRadius: 10, border: "1px solid #334155", background: "#1e293b", color: "#e2e8f0", fontWeight: 700, fontSize: 16, cursor: "pointer" }}>Fechar</button>
    </div>
  ) : null;
  const i = ETAPAS_PILOTO.indexOf(st.etapa);
  return (
    <div data-paiia-piloto={st.fim ? (st.fim.ok ? "concluido" : "pausado") : "executando"} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(2,6,23,0.96)", color: "#e2e8f0", display: "grid", placeItems: "center", padding: 16, overflow: "auto" }}>
      <div style={{ maxWidth: 520, width: "100%", border: "1px solid #334155", borderRadius: 14, padding: 18, background: "#0f172a" }}>
        {!st.fim && !st.publicado && <p style={{ fontSize: 18, fontWeight: 700 }}>⏳ O PAIIA está publicando sozinho. Não é preciso tocar em nada.</p>}
        {!st.fim && st.publicado && (
          <div data-paiia-piloto-publicado style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.5 }}>
            <div>✅ Anúncio Publicado Com Sucesso</div>
            <p style={{ fontSize: 15, fontWeight: 600 }}>SKU <b>{sku}</b> · <b>{st.publicado.mlb}</b>{st.publicado.link && <> · <a href={st.publicado.link} target="_blank" rel="noreferrer" style={{ color: "#67e8f9" }}>abrir anúncio</a></>}</p>
            <p data-paiia-piloto-segundo-plano={st.publicado.registrada ? "ficha" : "tela"} style={{ fontSize: 13, color: "#94a3b8", fontWeight: 400 }}>
              {st.publicado.registrada
                ? "As conferências (anúncio ativo, estoque, vínculo no Bling) ficaram gravadas na ficha e seguem sozinhas, mesmo se você sair desta tela, com o PAIIA aberto em qualquer aparelho. Pendências aparecem na Central de Publicação."
                : "As conferências (anúncio ativo, vínculo no Bling) seguem nesta tela. O anúncio já está criado."}
            </p>
            {botoes}
          </div>
        )}
        {st.fim?.ok && (
          <div data-paiia-piloto-sucesso={st.fim.pendencia ? "com-pendencia" : "completo"} style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.6 }}>
            <div>✅ ANÚNCIO PUBLICADO{st.fim.pendencia ? "" : " COM SUCESSO"}</div>
            <div>{st.fim.vinculo === false ? "⚠ BLING: vínculo a conferir" : "✅ BLING INTEGRADO"}</div>
            <div>{st.publicado?.registrada ? "⏳ ESTOQUE: conferência em segundo plano" : "✅ ESTOQUE CONFERIDO"}</div>
            <div>{st.fim.ativo === false ? "⚠ MERCADO LIVRE: ativação a conferir" : "✅ MERCADO LIVRE ATIVO"}</div>
            {st.fim.pendencia && <p data-paiia-piloto-pendencia style={{ fontSize: 14, fontWeight: 600, color: "#fde68a" }}>⚠ Para conferir depois: {st.fim.pendencia}</p>}
            <p style={{ fontSize: 15, fontWeight: 600 }}>SKU <b>{sku}</b> · <b data-paiia-piloto-mlb>{st.fim.mlb}</b>{st.fim.link && <> · <a href={st.fim.link} target="_blank" rel="noreferrer" style={{ color: "#67e8f9" }}>abrir anúncio</a></>}</p>
            <p style={{ fontSize: 13, color: "#94a3b8" }}>Ficha concluída na Central de Publicação.</p>
            {botoes}
          </div>
        )}
        {st.fim && !st.fim.ok && (
          <p data-paiia-piloto-pausa style={{ fontSize: 16, color: "#fde68a" }}>⏸ Pausado em “{ROTULO_ETAPA[st.fim.etapa] || st.fim.etapa}”: {st.fim.texto} O que já foi feito ficou salvo.</p>
        )}
        <ol style={{ margin: "10px 0 0", paddingLeft: 20, fontSize: 14 }}>
          {ETAPAS_PILOTO.map((e, k) => (
            <li key={e} data-paiia-piloto-etapa={e} style={{ color: st.fim?.ok || k < i ? "#86efac" : k === i ? (st.fim ? "#fde68a" : "#67e8f9") : "#64748b" }}>
              {st.fim?.ok || k < i ? "✅" : k === i ? (st.fim ? "⏸" : "⏳") : "•"} {ROTULO_ETAPA[e]}{k === i && st.texto && !st.fim ? ` — ${st.texto}` : ""}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
