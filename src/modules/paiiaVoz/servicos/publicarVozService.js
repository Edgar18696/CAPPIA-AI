// =============================================================
// PAIIA Voz — Etapa 4: entrega a revisão aprovada no celular à PUBLICAÇÃO
// EXISTENTE. Grava a ficha aprovada com as funções de sempre
// (salvarFichaAprovada + salvarContaDestino). NÃO publica: quem publica é a
// RevisaoPublicacaoML, com todas as conferências e a confirmação do usuário.
// =============================================================
import { lerFichaNovoAnuncio } from "../../../services/fichaNovoAnuncioService";
import { fichaFechada } from "../../../services/fichaNovoAnuncio";
import { salvarFichaAprovada, salvarContaDestino } from "../../../services/anuncioPublicacaoService";
import { nomeDaLoja } from "../../../services/duplicidadeML";
import { montarAprovacaoDoVoz } from "./publicacaoVoz";

export async function prepararPublicacaoVoz(fichaId) {
  const r = await lerFichaNovoAnuncio(fichaId);
  if (!r.ok) return { ok: false, erro: r.erro || "Ficha não encontrada." };
  // Ficha já publicada/cancelada: nunca grava de novo (salvarFichaAprovada criaria OUTRA ficha).
  if (fichaFechada(r.ficha)) return { ok: false, publicada: true, erro: "Esta ficha já foi publicada (ou cancelada): nada a fazer aqui." };
  const m = montarAprovacaoDoVoz(r.ficha);
  if (!m.ok) return m;
  const s = await salvarFichaAprovada({
    anuncioId: r.ficha.id,
    codigo: m.anuncioConferido.codigo,
    titulo: m.anuncioConferido.titulo,
    dadosConferencia: m.dados,
    versaoEsperada: r.ficha.dados_conferencia?.salvo_em || "",
  });
  if (!s.ok) return { ok: false, erro: s.erro || "Não consegui gravar a ficha aprovada." };
  if (s.anuncioId !== r.ficha.id) return { ok: false, erro: "A gravação não foi na mesma ficha: publicação interrompida." };
  const c = await salvarContaDestino({ anuncioId: r.ficha.id, codigo: m.anuncioConferido.codigo, titulo: m.anuncioConferido.titulo, contaId: m.conta, contaNome: nomeDaLoja(m.conta) });
  if (!c.ok) return { ok: false, erro: c.erro || "Não consegui gravar a conta de destino." };
  return { ok: true, fichaId: r.ficha.id, anuncioConferido: m.anuncioConferido, conta: m.conta, quantidade: m.quantidade };
}
