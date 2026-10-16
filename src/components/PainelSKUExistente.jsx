import { useEffect, useRef, useState } from "react";
import { useContasML, contasMLConectadas } from "../services/contaMLAtiva";
import { reconhecerCodigo, registrarParecido } from "../services/reconhecimentoSKUService";
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
 * Consulta sozinha (depois que o código para de mudar): Bling, as três
 * contas do Mercado Livre, o registro interno de anúncios e as fichas.
 * Única gravação: no registro interno, do que o Mercado Livre confirmou
 * (ou do anúncio parecido que o usuário confirmar no botão).
 * Não publica, não cria produto, não mexe em estoque e não substitui as
 * conferências da Publicação. Falha = "Verificação pendente" (nunca "não existe").
 */
export default function PainelSKUExistente({ codigo }) {
  const estadoContas = useContasML();
  const [estado, setEstado] = useState({ chave: "", carregando: false, r: null, erro: "" });
  const pedidoRef = useRef(0);
  const [registrando, setRegistrando] = useState({});
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

  async function confirmarParecido(c, a) {
    const k = `${c.conta}:${a.mlb}`;
    setRegistrando((x) => ({ ...x, [k]: "gravando" }));
    const r = await registrarParecido({ sku: String(codigo || "").trim(), conta: c.conta, contaNome: c.nome, mlb: a.mlb, status: a.status });
    setRegistrando((x) => ({ ...x, [k]: r.ok ? "ok" : `erro: ${r.erro || "não gravado"}` }));
    if (r.ok) consultar(true);
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

      {atual.carregando && <p style={sub}>⏳ Consultando Bling, as três contas do Mercado Livre, o registro interno e a base PAIIA...</p>}
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
              {c.estado === E.ENCONTRADO && <>Já publicado: {c.anuncios.map((a) => `${a.mlb} (${traduzSituacao(a.situacao, a.status)})${a.divergente ? " — SKU diferente no anúncio" : ""}`).join(", ")}</>}
              {c.estado === E.POSSIVEL && <>Possível anúncio — confira no Mercado Livre:</>}
              {c.estado === E.NAO_ENCONTRADO && <>Nenhum anúncio deste SKU nesta conta</>}
              {(c.possiveis || []).length > 0 && c.estado !== E.INCOMPLETA && (
                <span style={{ display: "block" }}>
                  {c.possiveis.map((a) => {
                    const k = `${c.conta}:${a.mlb}`;
                    const st = registrando[k];
                    return (
                      <span key={a.mlb} data-paiia-sku-possivel={a.mlb} style={{ display: "block", margin: "2px 0" }}>
                        {a.mlb} ({traduzStatus(a.status)}; {a.motivo}){" "}
                        {st === "ok" ? <b style={{ color: "#86efac" }}>registrado</b> : (
                          <button type="button" data-paiia-sku-registrar={a.mlb} disabled={st === "gravando"} onClick={() => confirmarParecido(c, a)} style={botao}>
                            {st === "gravando" ? "Registrando..." : "É o mesmo produto — registrar"}
                          </button>
                        )}
                        {st && st.startsWith("erro") ? <span style={{ color: "#fca5a5" }}> {st}</span> : null}
                      </span>
                    );
                  })}
                </span>
              )}
              {(c.historico || []).length > 0 && (
                <span data-paiia-sku-historico style={{ ...sub, display: "block" }}>
                  ⓘ Histórico: {c.historico.map((h) => `${h.mlb} (${traduzSituacao(h.situacao)})`).join(", ")} — não conta como anúncio ativo
                </span>
              )}
            </Linha>
          ))}
          {atual.r.registro && (
            <Linha rotulo="Registro interno" dado="registro" parte={atual.r.registro}>
              {atual.r.registro.estado === E.ENCONTRADO && <>{atual.r.registro.total} MLB{atual.r.registro.total > 1 ? "s" : ""} registrado{atual.r.registro.total > 1 ? "s" : ""} deste SKU (conferidos acima, conta por conta)</>}
              {atual.r.registro.estado === E.NAO_ENCONTRADO && <>Nenhum MLB registrado deste SKU</>}
            </Linha>
          )}
          {atual.r.gravacao && (atual.r.gravacao.registrados.length > 0 || atual.r.gravacao.falhas.length > 0) && (
            <p data-paiia-sku-gravacao style={{ ...sub, color: atual.r.gravacao.falhas.length ? "#fbbf24" : "#86efac" }}>
              {atual.r.gravacao.registrados.length > 0 && <>Registrado agora no histórico interno (confirmado pelo Mercado Livre): {atual.r.gravacao.registrados.join(", ")}. </>}
              {atual.r.gravacao.falhas.length > 0 && <>Não foi possível gravar no registro: {atual.r.gravacao.falhas.join("; ")}. Será tentado de novo na próxima consulta.</>}
            </p>
          )}
          <Linha rotulo="Base PAIIA" dado="base" parte={atual.r.base}>
            {atual.r.base.estado === E.ENCONTRADO && (
              <>
                {atual.r.base.fichas.length} ficha{atual.r.base.fichas.length > 1 ? "s" : ""} deste código:{" "}
                {atual.r.base.fichas.map((f) => [f.mlb || traduzFicha(f.status), f.conta].filter(Boolean).join(" · ")).join("; ")}
              </>
            )}
            {atual.r.base.estado === E.NAO_ENCONTRADO && <>Nenhuma ficha deste código</>}
          </Linha>
          <p style={{ ...sub, marginTop: 8 }}>Só consulta e guarda no registro interno o que o Mercado Livre confirmou: nada é publicado, criado no Bling ou alterado no estoque. As conferências de duplicidade da Publicação continuam valendo.</p>
        </>
      )}
    </section>
  );
}

function Linha({ rotulo, dado, parte, children }) {
  const inc = parte?.estado === E.INCOMPLETA;
  const icone = inc ? "🕓" : parte?.estado === E.NAO_ENCONTRADO ? "—" : parte?.estado === E.POSSIVEL || parte?.estado === E.AMBIGUO ? "❓" : "✔";
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
const SITUACAO = { ativo: "ativo", pausado: "pausado", em_revisao: "em revisão", inativo: "inativo", encerrado: "encerrado", excluido: "excluído", desconhecida: "situação desconhecida" };
const traduzSituacao = (s, status) => SITUACAO[s] || traduzStatus(status);
const STATUS_FICHA = { rascunho: "rascunho", conferencia_aprovada: "conferência aprovada", publicando: "publicando", publicado: "publicada", publicado_com_pendencia: "publicada com pendência", erro_publicacao: "erro na publicação" };
const traduzFicha = (s) => STATUS_FICHA[s] || s || "ficha";

const caixa = { marginTop: 10, padding: "10px 12px", borderRadius: 10, background: "#0f172a", border: "1px solid #334155", color: "#cbd5e1", fontSize: 14, textAlign: "left", maxWidth: "100%", boxSizing: "border-box" };
const linha = { display: "flex", gap: 6, alignItems: "flex-start", padding: "3px 0" };
const sub = { color: "#94a3b8", fontSize: 12, margin: "4px 0 0" };
const botao = { padding: "6px 10px", borderRadius: 8, border: "1px solid #475569", background: "#334155", color: "#e2e8f0", cursor: "pointer", fontSize: 12, whiteSpace: "normal", maxWidth: "100%" };
