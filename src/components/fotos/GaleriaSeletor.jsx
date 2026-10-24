// =====================================================================
// (23/10/2026 - E11) Galeria interna do PAIIA em quadro, para escolher fotos.
// Usado pelo PAIIA Voz e pelo Criar Novo Anúncio. SÓ LEITURA: lista as suas
// fotos (galeriaVoz.listarFotosGaleria). Quem usa decide o que fazer com as
// escolhidas (onEscolher recebe [{ id, url }]) e o limite (vagas).
// =====================================================================
import { useCallback, useEffect, useState } from "react";
import { listarFotosGaleria } from "../../modules/paiiaVoz/servicos/galeriaVoz";

const grade = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 8, maxHeight: "50vh", overflow: "auto", margin: "8px 0" };
const item = { position: "relative", padding: 0, border: "2px solid #334155", borderRadius: 10, background: "#fff", cursor: "pointer", aspectRatio: "1", overflow: "hidden" };
const marcado = { borderColor: "#22c55e", boxShadow: "0 0 0 2px #22c55e" };
const ok = { position: "absolute", top: 4, right: 4, background: "#22c55e", color: "#fff", borderRadius: "50%", width: 22, height: 22, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" };
const linha = { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 8 };

export default function GaleriaSeletor({ supabase, userId, vagas, urlsExistentes = [], onEscolher, onFechar, onArquivo, onGaleriaCompleta, classeBotao = "", classeLink = "", estiloBotao, estiloLink, estiloCaixa }) {
  const [st, setSt] = useState({ carregando: true, fotos: [], erro: "", temMais: false, escolhidas: [], ocupado: false });
  const jaTem = new Set(urlsExistentes.filter(Boolean));

  const carregar = useCallback(async (inicio = 0) => {
    setSt((s) => ({ ...s, carregando: true, erro: "" }));
    const r = await listarFotosGaleria(supabase, userId, { inicio });
    setSt((s) => ({ ...s, carregando: false, erro: r.erro, temMais: r.temMais, fotos: inicio ? [...s.fotos, ...r.fotos] : r.fotos }));
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
    } catch (e) {
      setSt((s) => ({ ...s, ocupado: false, erro: String(e?.message || e) }));
    }
  }

  return (
    <div className="pr-cartao" style={estiloCaixa} data-pr-galeria>
      <div style={{ ...linha, justifyContent: "space-between", marginTop: 0 }}><strong>Galeria PAIIA</strong><span data-pr-galeria-vagas>{st.escolhidas.length} de {vagas} vaga(s)</span></div>
      {st.carregando && <p className="pr-vazio">Carregando as fotos da Galeria…</p>}
      {st.erro && <p className="pr-erro" style={{ color: "#fca5a5" }} data-pr-galeria-erro>{st.erro}</p>}
      {!st.carregando && !st.erro && !st.fotos.length && <p className="pr-vazio">Nenhuma foto na Galeria ainda.</p>}
      {vagas <= 0 && <p className="pr-vazio">Limite de fotos atingido. Remova uma foto para escolher outra.</p>}
      <div style={grade}>
        {st.fotos.map((f) => {
          const escolhida = st.escolhidas.includes(f.id);
          const repetida = jaTem.has(f.url);
          return (
            <button key={f.id} type="button" disabled={repetida} title={repetida ? "Já está nas fotos" : ""} style={{ ...item, ...(escolhida ? marcado : {}), ...(repetida ? { opacity: 0.35, cursor: "default" } : {}) }} aria-pressed={escolhida} onClick={() => alternar(f.id)} data-pr-galeria-item>
              <img src={f.url} alt="Foto da Galeria PAIIA" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
              {escolhida && <span style={ok}>✓</span>}
            </button>
          );
        })}
      </div>
      {st.temMais && !st.carregando && <button type="button" className={classeLink} style={estiloLink} onClick={() => carregar(st.fotos.length)}>Carregar mais</button>}
      <div style={linha}>
        <button type="button" className={classeBotao} style={estiloBotao} disabled={!st.escolhidas.length || st.ocupado} onClick={usar} data-pr-galeria-usar>{st.ocupado ? "Adicionando…" : `Usar ${st.escolhidas.length} foto(s)`}</button>
        {onArquivo && <button type="button" className={classeLink} style={estiloLink} onClick={() => { onFechar?.(); onArquivo(); }} data-pr-galeria-arquivo>Do computador/celular</button>}
        {onGaleriaCompleta && <button type="button" className={classeLink} style={estiloLink} onClick={() => { onFechar?.(); onGaleriaCompleta(); }} data-pr-galeria-completa>Abrir Galeria completa</button>}
        <button type="button" className={classeLink} style={estiloLink} onClick={() => onFechar?.()} data-pr-galeria-fechar>Fechar</button>
      </div>
    </div>
  );
}
