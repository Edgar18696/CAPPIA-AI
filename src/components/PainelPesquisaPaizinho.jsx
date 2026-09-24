// =============================================================
// PAINEL — PESQUISA DO PAIZINHO EM FONTES ORIGINAIS
// Mostra, no Criar Anúncio, o status da pesquisa externa feita
// quando o código não existe na Base PAIIA. Somente leitura.
// =============================================================

import { STATUS_PESQUISA, MENSAGENS } from "../services/paizinhoPesquisa/validarResultadoPesquisa.js";

const COR = {
  fundo: "#020617",
  borda: "#1e293b",
  texto: "#e2e8f0",
  suave: "#94a3b8",
  ok: "#22c55e",
  alerta: "#f59e0b",
  erro: "#f87171",
  info: "#67e8f9",
};

const caixa = {
  marginTop: "18px",
  padding: "18px",
  borderRadius: "16px",
  background: COR.fundo,
  border: `1px solid ${COR.borda}`,
  color: COR.texto,
  fontSize: "14px",
  lineHeight: 1.5,
};

const linha = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
  padding: "4px 0",
  borderBottom: `1px dashed ${COR.borda}`,
};

const rotulo = { color: COR.suave, minWidth: "190px" };

const subtitulo = { color: COR.info, margin: "16px 0 8px", fontSize: "14px" };

const link = { color: COR.info, wordBreak: "break-all" };

function Linha({ nome, children }) {
  return (
    <div style={linha}>
      <span style={rotulo}>{nome}</span>
      <span style={{ flex: 1, minWidth: 0 }}>{children}</span>
    </div>
  );
}

function periodo(a) {
  if (a.ano_inicio && a.ano_fim) return `${a.ano_inicio} a ${a.ano_fim}`;
  if (a.ano_inicio) return `a partir de ${a.ano_inicio}`;
  if (a.ano_fim) return `até ${a.ano_fim}`;
  return "período não informado na fonte";
}

function listaCodigos(lista) {
  if (!lista?.length) return <span style={{ color: COR.suave }}>—</span>;
  return lista.map((c) => c.codigo).join(", ");
}

function faixaStatus(status) {
  if (status === STATUS_PESQUISA.ENCONTRADO)
    return { cor: COR.ok, texto: "Encontrado em fonte original" };
  if (status === STATUS_PESQUISA.CONFLITO)
    return { cor: COR.alerta, texto: MENSAGENS.CONFLITO };
  if (status === STATUS_PESQUISA.INDISPONIVEL)
    return { cor: COR.alerta, texto: "Pesquisa externa indisponível" };
  if (status === "pesquisando") return { cor: COR.info, texto: "Pesquisando…" };
  return { cor: COR.erro, texto: "Não identificado com segurança" };
}

export default function PainelPesquisaPaizinho({ pesquisa, onPesquisarNovamente }) {
  if (!pesquisa) return null;

  const { status, codigoPesquisado, mensagem, validado, auditoria, deCache, campos, gravacaoBase } = pesquisa;
  const textoGravacao = (() => {
    if (!gravacaoBase) return null;
    if (gravacaoBase.erro) return { cor: COR.erro, t: `Não gravado: ${gravacaoBase.motivo || "falha"} (${gravacaoBase.erro})` };
    if (!gravacaoBase.gravado) return { cor: COR.suave, t: `Não gravado: ${gravacaoBase.motivo}` };
    const partes = [];
    if (gravacaoBase.inseridos) partes.push(`${gravacaoBase.inseridos} registro(s) novo(s)`);
    if (gravacaoBase.reaproveitados) partes.push(`${gravacaoBase.reaproveitados} já existente(s), reaproveitado(s) sem duplicar`);
    if (gravacaoBase.atualizados) partes.push(`${gravacaoBase.atualizados} completado(s)`);
    return {
      cor: COR.ok,
      t: `Gravado na Base PAIIA como “Pesquisa externa PAIIA” — ${partes.join(", ")}. Na próxima pesquisa deste código o PAIIA usa a própria base (sem nova consulta paga).`,
    };
  })();
  const naoConfirmados = campos?.naoConfirmados || [];
  const baseIncompleta = pesquisa.origemFallback === "base_incompleta";
  const divergenciasBase = pesquisa.divergenciasBase || [];
  const infoFonte = (url) =>
    (validado?.fontesConsultadas || []).find((f) => f.url === url) || {};
  const faixa = faixaStatus(status);
  const c = validado?.confirmado || {};
  const identificado =
    status === STATUS_PESQUISA.ENCONTRADO || status === STATUS_PESQUISA.CONFLITO;

  return (
    <section style={caixa} data-testid="painel-pesquisa-paizinho">
      <h3 style={{ color: COR.info, marginTop: 0, marginBottom: "12px" }}>
        🔎 Paizinho — pesquisa em fontes originais
      </h3>

      <Linha nome="Fonte interna (Base PAIIA)">
        {baseIncompleta ? (
          <strong style={{ color: COR.alerta }}>
            encontrado, mas sem aplicação de veículo (dados insuficientes)
          </strong>
        ) : (
          <strong style={{ color: COR.erro }}>não encontrado</strong>
        )}
      </Linha>
      <Linha nome="Pesquisa em fontes originais">
        <strong style={{ color: faixa.cor }} data-testid="paizinho-status">
          {faixa.texto}
        </strong>
      </Linha>
      <Linha nome="Código pesquisado">
        <strong data-testid="paizinho-codigo">{codigoPesquisado}</strong>
      </Linha>

      {status === "pesquisando" && (
        <p style={{ color: COR.info, margin: "12px 0 0" }}>{MENSAGENS.PESQUISANDO}</p>
      )}

      {status !== "pesquisando" && !identificado && (
        <p
          style={{ color: COR.alerta, margin: "12px 0 0" }}
          data-testid="paizinho-mensagem"
        >
          {mensagem || MENSAGENS.NAO_IDENTIFICADO}
          <br />
          <span style={{ color: COR.suave }}>
            {baseIncompleta
              ? "O anúncio ficou só com os dados da Base PAIIA; nada externo foi usado."
              : "Nenhum campo foi preenchido com dado não confirmado."}
          </span>
        </p>
      )}

      {identificado && (
        <>
          <Linha nome="Fabricante">
            {c.fabricante || <span style={{ color: COR.suave }}>não confirmado</span>}
          </Linha>
          <Linha nome="Descrição">
            {c.descricao || <span style={{ color: COR.suave }}>não confirmada</span>}
          </Linha>
          <Linha nome="OEM encontrado">{listaCodigos(c.codigosOem)}</Linha>
          <Linha nome="Substitutos">{listaCodigos(c.codigosSubstitutos)}</Linha>
          <Linha nome="Equivalentes">{listaCodigos(c.codigosEquivalentes)}</Linha>
          <Linha nome="Aplicações confirmadas">{c.aplicacoes?.length || 0}</Linha>
          <Linha nome="Nível de confiança">{validado?.confianca || "—"}</Linha>
          <Linha nome="Base PAIIA">
            {textoGravacao ? (
              <strong style={{ color: textoGravacao.cor }} data-testid="paizinho-gravacao">
                {textoGravacao.t}
              </strong>
            ) : (
              <span style={{ color: COR.suave }}>—</span>
            )}
            {deCache ? " (pesquisa anterior reaproveitada, sem nova consulta paga)" : ""}
          </Linha>

          {c.especificacoes?.length > 0 && (
            <>
              <h4 style={subtitulo}>Especificações confirmadas</h4>
              {c.especificacoes.map((e, i) => (
                <Linha key={i} nome={e.nome}>
                  {e.valor}
                </Linha>
              ))}
            </>
          )}

          {c.aplicacoes?.length > 0 && (
            <>
              <h4 style={subtitulo}>Aplicações confirmadas</h4>
              <ul style={{ margin: 0, paddingLeft: "18px" }}>
                {c.aplicacoes.map((a, i) => (
                  <li key={i}>
                    {[a.montadora, a.modelo, a.versao, a.motor].filter(Boolean).join(" ")} —{" "}
                    {periodo(a)}
                    <span style={{ color: COR.suave }}>
                      {" "}
                      ({a.fontes?.length || 0} fonte{a.fontes?.length === 1 ? "" : "s"})
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      {divergenciasBase.length > 0 && (
        <div
          style={{
            marginTop: "14px",
            padding: "12px",
            borderRadius: "12px",
            border: `1px solid ${COR.alerta}`,
            background: "#451a03",
            color: "#fde68a",
          }}
          data-testid="paizinho-divergencia-base"
        >
          <strong>Fonte original diverge da Base PAIIA — revisão necessária.</strong>
          <ul style={{ margin: "8px 0 0", paddingLeft: "18px" }}>
            {divergenciasBase.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
          <span>Os dados externos não foram usados no anúncio nem gravados.</span>
        </div>
      )}

      {validado?.conflitos?.length > 0 && (
        <div
          style={{
            marginTop: "14px",
            padding: "12px",
            borderRadius: "12px",
            border: `1px solid ${COR.alerta}`,
            background: "#451a03",
            color: "#fde68a",
          }}
          data-testid="paizinho-conflitos"
        >
          <strong>{MENSAGENS.CONFLITO}</strong>
          <ul style={{ margin: "8px 0 0", paddingLeft: "18px" }}>
            {validado.conflitos.map((cf, i) => (
              <li key={i}>
                {cf.campo}:
                <ul style={{ paddingLeft: "18px" }}>
                  {cf.valores.map((v, j) => (
                    <li key={j}>
                      “{v.valor}” — {v.fontes.join(" | ")}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          <span>Título e descrição não foram gerados automaticamente.</span>
        </div>
      )}

      {identificado && naoConfirmados.length > 0 && (
        <div
          style={{
            marginTop: "14px",
            padding: "12px",
            borderRadius: "12px",
            border: `1px solid ${COR.borda}`,
            background: "#0f172a",
          }}
          data-testid="paizinho-nao-confirmados"
        >
          <strong style={{ color: COR.alerta }}>Não confirmado em fonte original</strong>
          <span style={{ color: COR.suave }}> — não foi preenchido no anúncio:</span>
          <ul style={{ margin: "8px 0 0", paddingLeft: "18px" }}>
            {naoConfirmados.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {validado?.fontesOficiaisUsadas?.length > 0 && (
        <>
          <h4 style={subtitulo}>Fontes originais usadas (para auditoria)</h4>
          <ul style={{ margin: 0, paddingLeft: "18px" }} data-testid="paizinho-fontes">
            {validado.fontesOficiaisUsadas.map((u) => {
              const f = infoFonte(u);
              return (
                <li key={u} style={{ marginBottom: "6px" }}>
                  {f.nome ? <strong>{f.nome}: </strong> : null}
                  <a href={u} target="_blank" rel="noopener noreferrer" style={link}>
                    {u}
                  </a>
                  <div style={{ color: COR.suave, fontSize: "12px" }}>
                    {f.verificacaoPagina === true
                      ? "✔ código conferido na própria página"
                      : "Código citado pela busca na página oficial (abra o link para conferir)"}
                    {f.evidencia ? ` — trecho: “${f.evidencia}”` : ""}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {validado?.descartadas?.length > 0 && (
        <details style={{ marginTop: "12px" }}>
          <summary style={{ cursor: "pointer", color: COR.suave }}>
            Fontes descartadas ({validado.descartadas.length}) — não usadas para confirmar
          </summary>
          <ul style={{ margin: "8px 0 0", paddingLeft: "18px", color: COR.suave }}>
            {validado.descartadas.map((d, i) => (
              <li key={i}>
                {d.url || "(sem URL)"} — {d.motivo}
              </li>
            ))}
          </ul>
        </details>
      )}

      {onPesquisarNovamente && status !== "pesquisando" && (deCache || !identificado) && (
        <button
          type="button"
          onClick={onPesquisarNovamente}
          style={{
            marginTop: "12px",
            padding: "8px 14px",
            borderRadius: "10px",
            border: `1px solid ${COR.info}`,
            background: "transparent",
            color: COR.info,
            cursor: "pointer",
          }}
          data-testid="paizinho-pesquisar-novamente"
        >
          🔄 Pesquisar de novo nas fontes originais (nova consulta paga)
        </button>
      )}

      {auditoria && (
        <p style={{ color: COR.suave, margin: "12px 0 0", fontSize: "12px" }}>
          Auditoria registrada
          {auditoria.salvoEm === "local" ? " neste navegador (tabela ainda não criada)" : ""}
          {auditoria.registro?.criado_em
            ? ` em ${new Date(auditoria.registro.criado_em).toLocaleString("pt-BR")}`
            : ""}
          .
        </p>
      )}
    </section>
  );
}
