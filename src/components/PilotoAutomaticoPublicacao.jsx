// (PAIIA Voz) Tela de progresso do piloto automático: sem nenhum botão de etapa.
// (08/11) Assim que o Mercado Livre confirma o MLB: "Anúncio Publicado Com Sucesso" +
// Criar Próximo Anúncio / Fechar. As conferências que faltam ficam gravadas na ficha e
// seguem em segundo plano (ConferenciasSegundoPlano), mesmo saindo desta tela.
import { useEffect, useRef, useState } from "react";
import { supabase } from "../supabase";
import { executarPiloto, ETAPAS_PILOTO, ROTULO_ETAPA, autorizacaoDaUrl, mlbRegistradoDaFicha, situacaoEtapaPiloto } from "../services/pilotoPublicacao";

const COR_ETAPA = { ok: "#86efac", conferir: "#fde68a", atual: "#67e8f9", pausa: "#fde68a", pendente: "#64748b" };
import { obterAnuncio } from "../services/anuncioPublicacaoService";
import { registrarPosPublicacao } from "../services/posPublicacaoService";
import { marcarFichaPublicada } from "../services/posPublicacao";
import { marcarFichaLiberada } from "../modules/paiiaVoz/servicos/limpezaPosPublicacaoVoz";

export default function PilotoAutomaticoPublicacao({ conta = "", sku = "", autoId = "", anuncioId = "", quantidade = "", onProximo, onCorrigir }) {
  // Nº da autorização: do PAIIA Voz (?auto= na URL) ou da autorização única do Novo Anúncio (autoId).
  const auto = autoId || autorizacaoDaUrl(window.location.href);
  const [st, setSt] = useState({ etapa: "canais", texto: "", fim: null });
  // (09/11) "Tentar de novo" (só antes do envio): nova rodada com a MESMA autorização, pelo seu toque.
  const [rodada, setRodada] = useState(0);
  const rodou = useRef(-1);
  const [fechado, setFechado] = useState(false);
  const encerradoRef = useRef(false);
  const dadosRef = useRef({ anuncioId, quantidade, conta, sku });
  useEffect(() => { dadosRef.current = { anuncioId, quantidade, conta, sku }; }, [anuncioId, quantidade, conta, sku]);
  useEffect(() => {
    if (!auto || rodou.current >= rodada) return;
    rodou.current = rodada;
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
      // (10/11) Antes de tudo: a ficha já tem MLB? (F5, "Continuar" na Central) → nunca publica de novo.
      mlbJaPublicado: async () => {
        let id = dadosRef.current.anuncioId;
        if (!id) { try { id = new URL(window.location.href).searchParams.get("ficha") || ""; } catch { id = ""; } }
        if (!/^[0-9a-f-]{36}$/i.test(String(id || ""))) return { mlb: "" };
        const t = globalThis.__paiiaModoTeste && globalThis.__paiiaLerFichaPiloto;
        const r = await (t || obterAnuncio)(id);
        if (!r?.ok) return r?.naoEncontrado ? { mlb: "" } : { erro: r?.erro || "ficha não lida" };
        return { mlb: mlbRegistradoDaFicha(r.anuncio), link: r.anuncio?.publicacao?.mlb_link || "" };
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
  }, [auto, conta, rodada]);
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
  // (09/11) Publicação PAUSADA ou ainda antes do envio: a ficha já está salva na conta (anuncioId).
  // "Salvar e Criar Próximo Anúncio": para o piloto (nada mais é tocado), a publicação fica pendente na
  // Central (status real, NÃO publicada) e o PAIIA Voz abre vazio. Nunca aparece no envio ao ML.
  const podeLiberar = Boolean(anuncioId) && !st.publicado && (st.fim ? !st.fim.ok : st.etapa !== "publicar");
  const salvarEProximo = () => {
    encerradoRef.current = true;
    marcarFichaLiberada(anuncioId);
    setFechado(true);
    onProximo?.();
  };
  const botaoLiberar = podeLiberar ? (
    <div data-paiia-piloto-liberar style={{ marginTop: 12 }}>
      <button type="button" data-paiia-salvar-proximo onClick={salvarEProximo} style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid #2f5fd0", background: "linear-gradient(160deg,#1d4ed8 0%,#123a8a 100%)", color: "#fff", fontWeight: 800, fontSize: 16, cursor: "pointer" }}>💾 Salvar e Criar Próximo Anúncio</button>
      <p style={{ fontSize: 13, color: "#94a3b8", margin: "6px 0 0" }}>A ficha já está salva na sua conta. {st.fim ? "A publicação" : "Se você sair agora, a publicação"} fica pendente na Central de Publicação; nada é enviado ao Mercado Livre sem você autorizar de novo.</p>
    </div>
  ) : null;
  // (09/11) Pausa ANTES do envio ao ML: corrigir na MESMA ficha (fecha esta tela e abre a pendência) ou
  // tentar de novo. Nada é enviado sem o seu toque; a ficha, as fotos, o preço e a conta continuam.
  const pausadoAntes = Boolean(st.fim && !st.fim.ok && !st.fim.liberado && st.fim.antesDoEnvio && !st.publicado);
  const corrigir = () => {
    encerradoRef.current = true;
    setFechado(true);
    onCorrigir?.({ etapa: st.fim?.etapa || "", item: st.fim?.item || "", texto: st.fim?.texto || "" });
  };
  const tentarDeNovo = () => {
    encerradoRef.current = false;
    setSt({ etapa: "canais", texto: "", fim: null });
    setRodada((r) => r + 1);
  };
  const botoesPausa = pausadoAntes ? (
    <div data-paiia-piloto-corrigir-bloco style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
      {onCorrigir && <button type="button" data-paiia-piloto-corrigir onClick={corrigir} style={{ flex: "1 1 200px", padding: "12px 14px", borderRadius: 10, border: "1px solid #f59e0b", background: "#451a03", color: "#fde68a", fontWeight: 800, fontSize: 16, cursor: "pointer" }}>🔧 Corrigir nesta ficha{st.fim.item ? ` — ${st.fim.item}` : ""}</button>}
      <button type="button" data-paiia-piloto-tentar onClick={tentarDeNovo} style={{ flex: "1 1 140px", padding: "12px 14px", borderRadius: 10, border: "1px solid #334155", background: "#1e293b", color: "#e2e8f0", fontWeight: 700, fontSize: 16, cursor: "pointer" }}>↻ Tentar de novo</button>
    </div>
  ) : null;
  return (
    <div data-paiia-piloto={st.fim ? (st.fim.ok ? "concluido" : "pausado") : "executando"} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(2,6,23,0.96)", color: "#e2e8f0", display: "grid", placeItems: "center", padding: 16, overflow: "auto" }}>
      <div style={{ maxWidth: 520, width: "100%", border: "1px solid #334155", borderRadius: 14, padding: 18, background: "#0f172a" }}>
        {!st.fim && !st.publicado && <p style={{ fontSize: 18, fontWeight: 700 }}>⏳ O PAIIA está publicando sozinho. Não é preciso tocar em nada.</p>}
        {!st.fim && st.publicado && (
          <div data-paiia-piloto-publicado style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.5 }}>
            <div>{st.publicado.jaExistia ? "✅ Este anúncio já está publicado — nada foi publicado de novo" : "✅ Anúncio Publicado Com Sucesso"}</div>
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
            <div data-paiia-piloto-ja-existia={st.fim.jaExistia ? "1" : undefined}>{st.fim.jaExistia ? "✅ ANÚNCIO JÁ PUBLICADO — nada foi publicado de novo" : `✅ ANÚNCIO PUBLICADO${st.fim.pendencia ? "" : " COM SUCESSO"}`}</div>
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
          <p data-paiia-piloto-pausa data-paiia-piloto-pendencia-item={st.fim.item || undefined} style={{ fontSize: 16, color: "#fde68a" }}>⏸ Pausado em “{ROTULO_ETAPA[st.fim.etapa] || st.fim.etapa}”: {st.fim.texto} O que já foi feito ficou salvo.</p>
        )}
        {botoesPausa}
        {botaoLiberar}
        <ol style={{ margin: "10px 0 0", paddingLeft: 20, fontSize: 14 }}>
          {ETAPAS_PILOTO.map((e) => {
            // (10/11) Concluído não pinta tudo de verde: vínculo/ativação não confirmados ficam ⚠.
            const s = situacaoEtapaPiloto(e, { fim: st.fim, atual: st.etapa, texto: st.texto });
            return (
              <li key={e} data-paiia-piloto-etapa={e} data-paiia-piloto-etapa-estado={s.estado} style={{ color: COR_ETAPA[s.estado] }}>
                {s.icone} {ROTULO_ETAPA[e]}{s.sufixo}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
