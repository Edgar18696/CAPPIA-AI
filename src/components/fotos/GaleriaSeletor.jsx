// =====================================================================
// (23/10/2026 - E11) Galeria interna do PAIIA em quadro, para escolher fotos.
// Usado pelo PAIIA Voz e pelo Criar Novo Anúncio. SÓ LEITURA: lista as suas
// fotos (galeriaVoz.listarFotosGaleria). Quem usa decide o que fazer com as
// escolhidas (onEscolher recebe [{ id, url }]) e o limite (vagas).
// (08/11/2026) Sessão: sem o usuário da tela, usa a sessão válida do navegador
// (login do PAIIA — nunca a conta do Mercado Livre). Sem login: onEntrar oferece
// "Entrar na conta PAIIA". barraFixa (PAIIA Voz): a Galeria abre num painel azul
// por cima da tela; as fotos rolam no meio (grade de verdade, também no celular)
// e a barra de baixo — "X de Y fotos" + "Usar X Fotos Selecionadas" — fica FORA
// da rolagem: sempre visível e sem cobrir nenhuma foto. fecharAoUsar: fecha
// depois de confirmar. Sem essas opções o quadro fica como antes (Novo Anúncio).
// =====================================================================
import { useCallback, useEffect, useState } from "react";
import { listarFotosGaleria, usuarioDaGaleria } from "../../modules/paiiaVoz/servicos/galeriaVoz";

const grade = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 8, maxHeight: "50vh", overflow: "auto", margin: "8px 0" };
const item = { position: "relative", padding: 0, border: "2px solid #334155", borderRadius: 10, background: "#fff", cursor: "pointer", aspectRatio: "1", overflow: "hidden" };
const marcado = { borderColor: "#22c55e", boxShadow: "0 0 0 2px #22c55e" };
const ok = { position: "absolute", top: 4, right: 4, background: "#22c55e", color: "#fff", borderRadius: "50%", width: 22, height: 22, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" };
const linha = { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 8 };

// (08/11) Painel da Galeria (PAIIA Voz) — azul premium da calculadora. Classes próprias: as regras
// globais do celular (grade inline vira 1 coluna) não desmontam a grade de fotos.
const CSS_PAINEL = `
.pg-fundo { position: fixed; inset: 0; z-index: 60; background: rgba(2,6,23,.72); display: flex; align-items: center; justify-content: center; padding: 12px; box-sizing: border-box; }
.pg-painel { box-sizing: border-box; width: 100%; max-width: 760px; height: min(92dvh, 900px); max-height: 100%; display: flex; flex-direction: column; overflow: hidden;
  background: linear-gradient(160deg,#0b1f4d 0%,#123a8a 100%); border: 1px solid #2f5fd0; border-radius: 16px; color: #e8efff; box-shadow: 0 18px 50px rgba(0,0,0,.6); }
.pg-topo { flex: none; padding: 12px 14px 8px; display: grid; gap: 6px; border-bottom: 1px solid #2f5fd0; }
.pg-titulo { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 17px; }
.pg-links { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
.pg-meio { flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 10px 14px; display: grid; gap: 8px; align-content: start; }
.pg-meio p { margin: 0; font-size: 14px; color: #9fb6e8; }
.pg-grade { display: grid; grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)) !important; gap: 8px; }
@media (max-width: 420px) { .pg-grade { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; gap: 6px; } }
.pg-barra { flex: none; display: flex; gap: 10px; flex-wrap: wrap; align-items: center; justify-content: space-between; padding: 10px 14px calc(10px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid #2f5fd0; background: #0a1838; box-shadow: 0 -8px 18px rgba(2,6,23,.45); }
.pg-contador { font-weight: 800; font-size: 15px; }
.pg-usar { flex: 1 1 220px; min-height: 46px; background: #2563eb; color: #fff; border: none; border-radius: 10px; padding: 10px 14px; font-weight: 800; font-size: 15px; cursor: pointer; }
.pg-usar:disabled { opacity: .55; cursor: default; }
@media (max-width: 520px) { .pg-fundo { padding: 0; align-items: stretch; } .pg-painel { height: 100dvh; max-height: none; border-radius: 0; } }
`;

export default function GaleriaSeletor({ supabase, userId, vagas, urlsExistentes = [], onEscolher, onFechar, onArquivo, onGaleriaCompleta, onEntrar, barraFixa = false, fecharAoUsar = false, classeBotao = "", classeLink = "", estiloBotao, estiloLink, estiloCaixa }) {
  const [st, setSt] = useState({ carregando: true, fotos: [], erro: "", semLogin: false, temMais: false, escolhidas: [], ocupado: false });
  const jaTem = new Set(urlsExistentes.filter(Boolean));

  const carregar = useCallback(async (inicio = 0) => {
    setSt((s) => ({ ...s, carregando: true, erro: "" }));
    // (08/11) o usuário da tela; sem ele, a sessão válida deste navegador (a proteção continua: sem login nada é lido)
    const u = await usuarioDaGaleria(supabase, userId);
    const r = await listarFotosGaleria(supabase, u.id, { inicio });
    setSt((s) => ({ ...s, carregando: false, erro: r.erro, semLogin: Boolean(r.semLogin), temMais: r.temMais, fotos: inicio ? [...s.fotos, ...r.fotos] : r.fotos }));
  }, [supabase, userId]);
  useEffect(() => { carregar(0); }, [carregar]);

  function alternar(id) {
    setSt((s) => {
      if (s.escolhidas.includes(id)) return { ...s, escolhidas: s.escolhidas.filter((x) => x !== id) };
      if (s.escolhidas.length >= vagas) return s;
      return { ...s, escolhidas: [...s.escolhidas, id] };
    });
  }
  async function usar() {
    const itens = st.fotos.filter((f) => st.escolhidas.includes(f.id));
    if (!itens.length) return;
    setSt((s) => ({ ...s, ocupado: true, erro: "" }));
    try {
      const erro = await onEscolher?.(itens);
      setSt((s) => ({ ...s, ocupado: false, escolhidas: [], erro: erro || "" }));
      if (!erro && fecharAoUsar) onFechar?.();
    } catch (e) {
      setSt((s) => ({ ...s, ocupado: false, erro: String(e?.message || e) }));
    }
  }

  const n = st.escolhidas.length;
  const miniaturas = st.fotos.map((f) => {
    const escolhida = st.escolhidas.includes(f.id);
    const repetida = jaTem.has(f.url);
    return (
      <button key={f.id} type="button" disabled={repetida} title={repetida ? "Já está nas fotos" : ""} style={{ ...item, ...(escolhida ? marcado : {}), ...(repetida ? { opacity: 0.35, cursor: "default" } : {}) }} aria-pressed={escolhida} onClick={() => alternar(f.id)} data-pr-galeria-item>
        <img src={f.url} alt="Foto da Galeria PAIIA" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
        {escolhida && <span style={ok}>✓</span>}
      </button>
    );
  });

  if (barraFixa) {
    const textoUsar = st.ocupado ? "Adicionando…" : n ? `Usar ${n} Foto${n === 1 ? "" : "s"} Selecionada${n === 1 ? "" : "s"}` : `Selecione até ${vagas} foto${vagas === 1 ? "" : "s"}`;
    return (
      <div className="pg-fundo" data-pr-galeria-fundo onClick={(e) => { if (e.target === e.currentTarget) onFechar?.(); }}>
        <style>{CSS_PAINEL}</style>
        <div className="pg-painel" role="dialog" aria-modal="true" aria-label="Galeria PAIIA" style={estiloCaixa} data-pr-galeria data-pr-galeria-painel>
          <div className="pg-topo">
            <div className="pg-titulo"><strong>🖼️ Galeria PAIIA</strong><span data-pr-galeria-vagas style={{ fontSize: 13, color: "#9fb6e8" }}>{n} de {vagas} vaga(s)</span></div>
            <div className="pg-links">
              {onArquivo && <button type="button" className={classeLink} style={estiloLink} onClick={() => { onFechar?.(); onArquivo(); }} data-pr-galeria-arquivo>Do computador/celular</button>}
              {onGaleriaCompleta && <button type="button" className={classeLink} style={estiloLink} onClick={() => { onFechar?.(); onGaleriaCompleta(); }} data-pr-galeria-completa>Abrir Galeria completa</button>}
              <button type="button" className={classeLink} style={estiloLink} onClick={() => onFechar?.()} data-pr-galeria-fechar>✕ Fechar</button>
            </div>
          </div>
          <div className="pg-meio" data-pr-galeria-rolagem>
            {st.carregando && <p>Carregando as fotos da Galeria…</p>}
            {st.erro && <p style={{ color: "#fca5a5" }} data-pr-galeria-erro>{st.erro}</p>}
            {st.semLogin && onEntrar && (
              <button type="button" className={classeBotao} style={estiloBotao} onClick={() => onEntrar()} data-pr-galeria-entrar>🔐 Entrar na conta PAIIA (volta para esta etapa)</button>
            )}
            {!st.carregando && !st.erro && !st.fotos.length && <p>Nenhuma foto na Galeria ainda.</p>}
            {vagas <= 0 && <p>Limite de fotos atingido. Remova uma foto para escolher outra.</p>}
            <div className="pg-grade" data-pr-galeria-grade>{miniaturas}</div>
            {st.temMais && !st.carregando && <button type="button" className={classeLink} style={estiloLink} onClick={() => carregar(st.fotos.length)} data-pr-galeria-mais>Carregar mais fotos</button>}
          </div>
          {/* barra FORA da rolagem: sempre visível, não cobre as fotos */}
          <div className="pg-barra" data-pr-galeria-barra>
            <span className="pg-contador" data-pr-galeria-contador>{`${n} de ${vagas} foto${vagas === 1 ? "" : "s"}`}</span>
            <button type="button" className="pg-usar" disabled={!n || st.ocupado} onClick={usar} data-pr-galeria-usar>{textoUsar}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pr-cartao" style={estiloCaixa} data-pr-galeria>
      <div style={{ ...linha, justifyContent: "space-between", marginTop: 0 }}><strong>Galeria PAIIA</strong><span data-pr-galeria-vagas>{n} de {vagas} vaga(s)</span></div>
      {st.carregando && <p className="pr-vazio">Carregando as fotos da Galeria…</p>}
      {st.erro && <p className="pr-erro" style={{ color: "#fca5a5" }} data-pr-galeria-erro>{st.erro}</p>}
      {st.semLogin && onEntrar && (
        <button type="button" className={classeBotao} style={estiloBotao} onClick={() => onEntrar()} data-pr-galeria-entrar>🔐 Entrar na conta PAIIA (volta para esta etapa)</button>
      )}
      {!st.carregando && !st.erro && !st.fotos.length && <p className="pr-vazio">Nenhuma foto na Galeria ainda.</p>}
      {vagas <= 0 && <p className="pr-vazio">Limite de fotos atingido. Remova uma foto para escolher outra.</p>}
      <div style={grade}>{miniaturas}</div>
      {st.temMais && !st.carregando && <button type="button" className={classeLink} style={estiloLink} onClick={() => carregar(st.fotos.length)}>Carregar mais</button>}
      <div style={linha}>
        <button type="button" className={classeBotao} style={estiloBotao} disabled={!n || st.ocupado} onClick={usar} data-pr-galeria-usar>{st.ocupado ? "Adicionando…" : `Usar ${n} foto(s)`}</button>
        {onArquivo && <button type="button" className={classeLink} style={estiloLink} onClick={() => { onFechar?.(); onArquivo(); }} data-pr-galeria-arquivo>Do computador/celular</button>}
        {onGaleriaCompleta && <button type="button" className={classeLink} style={estiloLink} onClick={() => { onFechar?.(); onGaleriaCompleta(); }} data-pr-galeria-completa>Abrir Galeria completa</button>}
        <button type="button" className={classeLink} style={estiloLink} onClick={() => onFechar?.()} data-pr-galeria-fechar>Fechar</button>
      </div>
    </div>
  );
}
