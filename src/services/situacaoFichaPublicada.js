// =============================================================
// PAIIA — (14/11/2026) Tela final da ficha publicada: HISTÓRICO da publicação
// separado da SITUAÇÃO ATUAL no Mercado Livre (função pura, testável).
//
// Regra: "Publicado" e "Fluxo concluído" só descrevem a situação ATUAL quando
// o Mercado Livre confirma que o anúncio ainda existe. Anúncio encerrado ou
// excluído aparece como tal; a publicação anterior fica como histórico.
// =============================================================

const dataBR = (iso) => {
  const d = new Date(iso || "");
  if (Number.isNaN(d.getTime())) return "";
  try {
    return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return d.toISOString();
  }
};

/**
 * situacaoML: { carregando, excluido, situacao, confirmada, texto } (lerSituacaoMLBAtual).
 * Devolve { titulo, situacaoAtual, historico, concluido, encerrado, conferindo, naoConfirmada }.
 */
export function resumoFichaPublicada({ publicadoOk, pend = "", integrado = false, semRegistroBling = false, publicadoEm = "", situacaoML = {} }) {
  const historicoPub = publicadoOk ? `Publicado${publicadoEm ? ` em ${dataBR(publicadoEm)}` : ""}${pend ? " (com pendência)" : ""}${integrado ? " e integrado ao Bling" : ""}` : "—";
  const fluxoHistorico = publicadoOk && (integrado || semRegistroBling) && !pend;
  if (!publicadoOk) {
    return { titulo: "fluxo ainda não concluído", situacaoAtual: "—", historico: historicoPub, concluido: false, encerrado: false, conferindo: false, naoConfirmada: false };
  }
  if (situacaoML.carregando) {
    return { titulo: "conferindo a situação atual no Mercado Livre…", situacaoAtual: "⏳ conferindo no Mercado Livre...", historico: historicoPub, concluido: false, encerrado: false, conferindo: true, naoConfirmada: false };
  }
  if (situacaoML.excluido) {
    const qual = situacaoML.situacao === "excluido" ? "excluído" : "encerrado";
    return {
      titulo: `anúncio ${qual} no Mercado Livre`,
      situacaoAtual: `${qual === "excluído" ? "Excluído" : "Encerrado (finalizado)"} no Mercado Livre — não está à venda`,
      historico: historicoPub,
      concluido: false,
      encerrado: true,
      conferindo: false,
      naoConfirmada: false,
    };
  }
  if (situacaoML.lido === false || situacaoML.confirmada !== true || situacaoML.situacao === "nao_confirmada") {
    return {
      titulo: "situação atual não confirmada no Mercado Livre",
      situacaoAtual: `Não confirmada no Mercado Livre${situacaoML.texto ? ` (${situacaoML.texto})` : ""}`,
      historico: historicoPub,
      concluido: false,
      encerrado: false,
      conferindo: false,
      naoConfirmada: true,
    };
  }
  const rotulo = { ativo: "Ativo", pausado: "Pausado", em_revisao: "Em revisão", inativo: "Inativo" }[situacaoML.situacao] || "Existe";
  return {
    titulo: fluxoHistorico ? "fluxo concluído" : "fluxo ainda não concluído",
    situacaoAtual: `${rotulo} no Mercado Livre${pend ? " — publicado com pendência" : ""}`,
    historico: historicoPub,
    concluido: fluxoHistorico,
    encerrado: false,
    conferindo: false,
    naoConfirmada: false,
  };
}
