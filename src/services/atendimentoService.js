import { API_ATENDIMENTO_IA } from "../components/constants/apiConstants";

export async function enviarMensagemAtendimento({
  mensagem,
  especialista,
  supabaseKey,
}) {
  const respostaApi = await fetch(API_ATENDIMENTO_IA, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({
      mensagem,
      especialista,
    }),
  });

  const data = await respostaApi.json();

  return {
    status: respostaApi.status,
    ok: respostaApi.ok,
    data,
  };
}