import {
  enviarMensagemAtendimento,
} from "./atendimentoService";

export async function gerarRespostaIAAction({
  mensagem,
  especialista,
  supabaseKey,
}) {
  if (!String(mensagem || "").trim()) {
    throw new Error(
      "Digite uma mensagem."
    );
  }

  const retorno =
    await enviarMensagemAtendimento({
      mensagem,
      especialista,
      supabaseKey,
    });

  const dados = retorno.data || {};

  return {
    resposta:
      dados.resposta ||
      dados.error ||
      "Não foi possível gerar resposta.",

    dados,
  };
}