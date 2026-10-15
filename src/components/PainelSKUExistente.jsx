import { useEffect, useRef, useState } from "react";
import { useContasML, contasMLConectadas } from "../services/contaMLAtiva";
import { reconhecerCodigo } from "../services/reconhecimentoSKUService";
import {
  ESTADO_RECONHECIMENTO as E,
  ESPERA_DIGITACAO_MS,
  TEXTO_INCOMPLETA,
  chaveCodigo,
  codigoProntoParaConsultar,
  contasParaConsultar,
} from "../services/reconhecimentoSKU";

/*
 * "Este SKU já existe?" — aparece no Novo Anúncio logo abaixo do código.
 * Consulta sozinha (depois que o código para de mudar), SOMENTE LEITURA:
 * Bling, as três contas do Mercado Livre e as fichas da base PAIIA.
 * Não bloqueia nada, não grava nada e não substitui as conferências da
 * Publicação. Falha = "Verificação incompleta" (nunca "não existe").
 */
export default function PainelSKUExistente({ codigo }) {
  const estadoContas = useContasML();
  const [estado, setEstado] = useState({ chave: "", carregando: false, r: null, erro: "" });
  const pedidoRef = useRef(0);
  const chave = chaveCodigo(codigo);
  const pronto = codigoProntoParaConsultar(codigo);
  const contasCarregadas = Boolean(estadoContas?.carregado);
  const idsConectadas = contasMLConectadas(estadoContas).map((c) => c.ml_user_id).join(",");

  async function consultar(forcar = false) {
    const pedido = ++pedidoRef.current;
    const cod = String(codigo || "").trim();
    const contas = contasParaConsultar(contasMLConectadas(estadoContas), estadoContas?.erro);
    setEstado({ chave, carregando: true, r: null, erro: "" });
    try {
      const r = await reconhecerCodigo({ codigo: cod, contas, forcar });
      if (pedido === pedidoRef.current) setEstado({ chave, carregando: false, r, erro: "" });
    } catch (e) {
      if (pedido === pedidoRef.current) setEstado({ chave, carregando: false, r: null, erro: e?.message || "falha na consulta" });
    }
  }

  // Espera o código ficar parado antes de consultar (não consulta a cada tecla).
  useEffect(() => {
    if (!pronto || !contasCarregadas) {
      pedidoRef.current += 1; // descarta resposta de um código anterior
      return undefined;
    }
    const t = setTimeout(() => { consultar(false); }, ESPERA_DIGITACAO_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, pronto, contasCarregadas, idsConectadas]);

  if (!pronto) return null;
  const atual = estado.chave === chave ? estado : { carregando: true, r: null, erro: "" };

  return (
    <section data-paiia-sku-existente={atual.carregando ? "consultando" : atual.r?.resumo?.existe ? "existe" : atual.r?.resumo?.completo ? "nada" : "incompleta"} style={caixa}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "space-between" }}>
        <b style={{ color: "#e2e8f0" }}>🔎 Este SKU já existe?</b>
        {!atual.carregando && (
          <button type="button" data-paiia-sku-reverificar onClick={() => consultar(true)} style={botao}>↻ Verificar de novo</button>
        )}
      </div>

      {atual.carregando && <p style={sub}>⏳ Consultando Bling, as três contas do Mercado Livre e a base PAIIA...</p>}
      {atual.erro && <p style={{ ...sub, color: "#fbbf24" }}>⚠ {TEXTO_INCOMPLETA}: {atual.erro}</p>}

      {atual.r && (
        <>
          <p data-paiia-sku-resumo style={{ margin: "6px 0 8px", fontWeight: 700, color: atual.r.resumo.existe ? "#fde047" : atual.r.resumo.completo ? "#86efac" : "#fbbf24" }}>
            {atual.r.resumo.existe ? "⚠ " : atual.r.resumo.completo ? "✅ " : "⚠ "}
            {atual.r.resumo.titulo}
            {!atual.r.resumo.completo && atual.r.resumo.existe ? ` (${TEXTO_INCOMPLETA.toLowerCase()} em ${atual.r.resumo.incompletas} consulta${atual.r.resumo.incompletas > 1 ? "s" : ""})` : ""}
          </p>
          <Linha rotulo="Bling" dado="bling" parte={atual.r.bling}>
            {atual.r.bling.estado === E.ENCONTRADO && <>Já existe: <b>{atual.r.bling.produto.nome || "—"}</b> (ID {atual.r.bling.produto.id}, SKU {atual.r.bling.produto.codigo || "—"})</>}
            {atual.r.bling.estado === E.AMBIGUO && <>Mais de um produto com este SKU: {atual.r.bling.candidatos.map((p) => `${p.codigo || "—"} (ID ${p.id})`).join(", ")}</>}
            {atual.r.bling.estado === E.NAO_ENCONTRADO && <>Não encontrado com esta grafia exata (a conferência completa do cadastro é feita ao criar o produto)</>}
          </Linha>
          {atual.r.contas.map((c) => (
            <Linha key={c.conta} rotulo={c.nome} dado={`ml-${c.conta}`} parte={c}>
              {c.estado === E.ENCONTRADO && <>Já tem anúncio: {c.anuncios.map((a) => `${a.mlb} (${traduzStatus(a.status)})`).join(", ")}</>}
              {c.estado === E.POSSIVEL && <>Possível anúncio — confira no Mercado Livre: {c.possiveis.map((a) => `${a.mlb} (${traduzStatus(a.status)}; ${a.motivo})`).join(", ")}</>}
              {c.estado === E.NAO_ENCONTRADO && <>Nenhum anúncio deste SKU nesta conta</>}
            </Linha>
          ))}
          <Linha rotulo="Base PAIIA" dado="base" parte={atual.r.base}>
            {atual.r.base.estado === E.ENCONTRADO && (
              <>
                {atual.r.base.fichas.length} ficha{atual.r.base.fichas.length > 1 ? "s" : ""} deste código:{" "}
                {atual.r.base.fichas.map((f) => [f.mlb || traduzFicha(f.status), f.conta].filter(Boolean).join(" · ")).join("; ")}
              </>
            )}
            {atual.r.base.estado === E.NAO_ENCONTRADO && <>Nenhuma ficha deste código</>}
          </Linha>
          <p style={{ ...sub, marginTop: 8 }}>Somente consulta: nada é criado, alterado ou publicado. As conferências de duplicidade da Publicação continuam valendo.</p>
        </>
      )}
    </section>
  );
}

function Linha({ rotulo, dado, parte, children }) {
  const inc = parte?.estado === E.INCOMPLETA;
  const icone = inc ? "⚠" : parte?.estado === E.NAO_ENCONTRADO ? "—" : parte?.estado === E.POSSIVEL || parte?.estado === E.AMBIGUO ? "❓" : "✔";
  return (
    <div data-paiia-sku-parte={dado} data-paiia-sku-estado={parte?.estado || ""} style={linha}>
      <span style={{ width: 18, flex: "0 0 18px", textAlign: "center" }}>{icone}</span>
      <span style={{ minWidth: 0, flex: 1, overflowWrap: "anywhere" }}>
        <b style={{ color: "#e2e8f0" }}>{rotulo}:</b>{" "}
        {inc ? <span style={{ color: "#fbbf24" }}>{TEXTO_INCOMPLETA} — {parte.motivo}. Não dá para afirmar que não existe.</span> : children}
      </span>
    </div>
  );
}

const STATUS_ML = { active: "ativo", paused: "pausado", under_review: "em revisão", inactive: "inativo", closed: "encerrado" };
const traduzStatus = (s) => STATUS_ML[String(s || "").toLowerCase()] || s || "—";
const STATUS_FICHA = { rascunho: "rascunho", conferencia_aprovada: "conferência aprovada", publicando: "publicando", publicado: "publicada", publicado_com_pendencia: "publicada com pendência", erro_publicacao: "erro na publicação" };
const traduzFicha = (s) => STATUS_FICHA[s] || s || "ficha";

const caixa = { marginTop: 10, padding: "10px 12px", borderRadius: 10, background: "#0f172a", border: "1px solid #334155", color: "#cbd5e1", fontSize: 14, textAlign: "left", maxWidth: "100%", boxSizing: "border-box" };
const linha = { display: "flex", gap: 6, alignItems: "flex-start", padding: "3px 0" };
const sub = { color: "#94a3b8", fontSize: 12, margin: "4px 0 0" };
const botao = { padding: "6px 10px", borderRadius: 8, border: "1px solid #475569", background: "#334155", color: "#e2e8f0", cursor: "pointer", fontSize: 12, whiteSpace: "normal", maxWidth: "100%" };
