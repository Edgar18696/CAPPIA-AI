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

  // Código fora dos catálogos PAIIA: retorno rápido, sem pesquisa externa.
  if (pesquisa.status === "nao_encontrado_catalogos") {
    return (
      <section style={caixa} data-testid="painel-pesquisa-paizinho">
        <h3 style={{ color: COR.info, marginTop: 0, marginBottom: "12px" }}>
          🔎 Paizinho — catálogos PAIIA
        </h3>
        <Linha nome="Código pesquisado">
          <strong data-testid="paizinho-codigo">{pesquisa.codigoPesquisado}</strong>
        </Linha>
        <p style={{ color: COR.alerta, margin: "12px 0 0" }} data-testid="paizinho-mensagem">
          {pesquisa.mensagem ||
            "Código não encontrado em nossos catálogos. Verifique o código informado ou consulte os catálogos disponíveis."}
        </p>
      </section>
    );
  }

  // Código existe no catálogo interno, mas sem aplicação de veículo:
  // nenhuma pesquisa externa é feita automaticamente (regra: catálogo
  // interno primeiro). A consulta externa fica como opção manual.
  if (pesquisa.status === "interno_sem_aplicacao") {
    const catalogos = pesquisa.catalogosInternos || [];
    return (
      <section style={caixa} data-testid="painel-pesquisa-paizinho">
        <h3 style={{ color: COR.info, marginTop: 0, marginBottom: "12px" }}>
          🔎 Paizinho — catálogo interno
        </h3>
        <Linha nome="Fonte interna (Base PAIIA)">
          <strong style={{ color: COR.ok }} data-testid="paizinho-status">
            encontrado no catálogo interno
          </strong>
        </Linha>
        {catalogos.length > 0 && (
          <Linha nome="Catálogo(s)">{catalogos.join(" | ")}</Linha>
        )}
        <Linha nome="Código pesquisado">
          <strong data-testid="paizinho-codigo">{pesquisa.codigoPesquisado}</strong>
        </Linha>
        <p style={{ color: COR.alerta, margin: "12px 0 0" }} data-testid="paizinho-mensagem">
          O catálogo não informa aplicação de veículo para este código. Não foi possível
          confirmar aplicação, motor ou ano — nada foi inventado.
          <br />
          <span style={{ color: COR.suave }}>
            Nenhuma pesquisa externa foi feita — o Criar Anúncio usa somente os catálogos PAIIA.
          </span>
        </p>
        {onPesquisarNovamente && (
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
            data-testid="paizinho-pesquisar-externo"
          >
            🌐 Pesquisar aplicações em fontes externas (consulta paga)
          </button>
        )}
      </section>
    );
  }

  const { status, codigoPesquisado, mensagem, validado, auditoria, deCache, campos, gravacaoBase } = pesquisa;
  const proposta = validado?.propostaIncorporacao || null;
  const situacaoBase = validado?.validacaoBase?.situacao || "";
  const ROTULO_SITUACAO = {
    corroborada: "Conferida com o catálogo interno PAIIA (veículos coincidem)",
    base_sem_mesmo_veiculo: "Catálogo interno tem o código/equivalente, mas não os mesmos veículos",
    sem_registro_na_base: "Sem registro no catálogo interno para comparar",
    divergente: "DIVERGE do catálogo interno — nada usado",
    falha_na_comparacao: "Não foi possível comparar com a base — aplicações não usadas",
  };
  const naoConfirmadasBase = validado?.aplicacoesNaoConfirmadas || [];
  const origens = validado?.origens || null;
  function baixarProposta() {
    try {
      const blob = new Blob([JSON.stringify(proposta, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `proposta-base-paiia-${String(codigoPesquisado || "codigo").replace(/[^\w-]/g, "")}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch {
      // download opcional
    }
  }
  const textoGravacao = (() => {
    if (proposta?.pronta) {
      return {
        cor: COR.ok,
        t: `Validado — pronto para incorporar à Base PAIIA (${proposta.linhas.length} registro(s)), aguardando aprovação. Nada foi gravado automaticamente.`,
      };
    }
    if (proposta && !proposta.pronta) {
      return { cor: COR.suave, t: `Não será incorporado: ${proposta.motivo}` };
    }
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
  const baseValidada = pesquisa.origemFallback === "base_validada";
  // O que a pesquisa guardou na fonte própria (tabela separada)
  const textoConhecimento = (() => {
    const k = pesquisa.conhecimento;
    if (!k) return null;
    if (!k.gravado) {
      return { cor: k.erro ? COR.erro : COR.suave, t: `${k.motivo || "Nada gravado."}${k.erro ? ` (${k.erro})` : ""}` };
    }
    const partes = [];
    if (k.validados) partes.push(`${k.validados} validado(s) — usados nas próximas buscas sem nova pesquisa paga`);
    if (k.pendentes) partes.push(`${k.pendentes} pendente(s) de validação`);
    if (k.conflitos) partes.push(`${k.conflitos} em conflito (revisão manual)`);
    return { cor: k.validados ? COR.ok : COR.alerta, t: `Guardado: ${partes.join("; ") || "nada novo"}.` };
  })();
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
        {baseValidada ? "🔎 Paizinho — Base validada PAIIA" : "🔎 Paizinho — pesquisa em fontes originais"}
      </h3>

      {baseValidada ? (
        <>
          <Linha nome="Fonte">
            <strong style={{ color: COR.ok }} data-testid="paizinho-status">
              Base validada PAIIA (fonte própria)
            </strong>
          </Linha>
          <Linha nome="Validado em">
            {validado?.baseValidada?.validadoEm
              ? new Date(validado.baseValidada.validadoEm).toLocaleString("pt-BR")
              : "—"}
            {` · ${validado?.baseValidada?.registros || 0} registro(s) validado(s)`}
          </Linha>
          <Linha nome="Pesquisa externa">
            <span style={{ color: COR.suave }}>não foi necessária (nenhuma consulta paga)</span>
          </Linha>
        </>
      ) : (
        <>
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
        </>
      )}
      <Linha nome="Código pesquisado">
        <strong data-testid="paizinho-codigo">{codigoPesquisado}</strong>
      </Linha>
      {textoConhecimento && (
        <Linha nome="Base validada PAIIA">
          <strong style={{ color: textoConhecimento.cor }} data-testid="paizinho-conhecimento">
            {textoConhecimento.t}
          </strong>
        </Linha>
      )}

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
          {situacaoBase && (
            <Linha nome="Comparação com a base">
              <strong
                style={{ color: situacaoBase === "divergente" || situacaoBase === "falha_na_comparacao" ? COR.erro : situacaoBase === "corroborada" ? COR.ok : COR.alerta }}
                data-testid="paizinho-validacao-base"
              >
                {ROTULO_SITUACAO[situacaoBase] || situacaoBase}
              </strong>
            </Linha>
          )}
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
                      ({a.fontes?.length || 0} fonte{a.fontes?.length === 1 ? "" : "s"}
                      {a.vereditoRotulo ? ` · ${a.vereditoRotulo}` : ""}
                      {a.referenciaBase?.origem ? ` · catálogo: ${a.referenciaBase.origem}` : ""})
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {naoConfirmadasBase.length > 0 && (
            <>
              <h4 style={{ ...subtitulo, color: COR.alerta }}>Não confirmado — não preenchido (revisão)</h4>
              <ul style={{ margin: 0, paddingLeft: "18px" }} data-testid="paizinho-nao-confirmadas">
                {naoConfirmadasBase.map((a, i) => (
                  <li key={i} style={{ color: COR.suave }}>
                    {[a.montadora, a.modelo, a.versao, a.motor].filter(Boolean).join(" ")} — {periodo(a)} ·{" "}
                    <strong style={{ color: COR.alerta }}>{a.vereditoRotulo || "Não confirmado"}</strong>
                    {a.referenciaBase ? ` (catálogo interno: ${a.referenciaBase.veiculo} ${a.referenciaBase.anos})` : ""}
                  </li>
                ))}
              </ul>
            </>
          )}

          {origens && (
            <details style={{ marginTop: "10px" }}>
              <summary style={{ cursor: "pointer", color: COR.info }}>Origem de cada informação</summary>
              <ul style={{ margin: "6px 0 0", paddingLeft: "18px", color: COR.suave, fontSize: "12px" }} data-testid="paizinho-origens">
                {["fabricante", "descricao", "codigosOem", "codigosEquivalentes"]
                  .filter((k) => origens[k])
                  .map((k) => (
                    <li key={k}>
                      {{ fabricante: "Fabricante", descricao: "Descrição", codigosOem: "Códigos OEM", codigosEquivalentes: "Equivalentes" }[k]}:{" "}
                      {origens[k].origem} — {(origens[k].fontes || []).join(" | ") || "—"}
                    </li>
                  ))}
                {(origens.aplicacoes || []).map((a, i) => (
                  <li key={`a${i}`}>
                    Aplicação {a.veiculo} {a.anos}: {a.origem}
                    {a.catalogoInterno ? ` (${a.catalogoInterno})` : ""} — {(a.fontes || []).join(" | ")}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {proposta?.pronta && (
            <button
              type="button"
              onClick={baixarProposta}
              style={{ marginTop: "10px", padding: "6px 12px", borderRadius: "8px", border: `1px solid ${COR.ok}`, background: "transparent", color: COR.ok, cursor: "pointer" }}
              data-testid="paizinho-baixar-proposta"
            >
              ⬇️ Baixar proposta de incorporação (para aprovação)
            </button>
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
