export async function buscarEquivalencias(codigo: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceKey || !codigo) {
    return [];
  }

  const codigoLimpo = encodeURIComponent(codigo.trim());

  const url =
    `${supabaseUrl}/rest/v1/equivalencias_pecas` +
    `?select=*` +
    `&or=(codigo_principal.ilike.*${codigoLimpo}*,codigo_equivalente.ilike.*${codigoLimpo}*)`;

  const resposta = await fetch(url, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!resposta.ok) {
    console.log("ERRO EQUIVALENCIAS:", await resposta.text());
    return [];
  }

  const dados = await resposta.json();

  console.log("EQUIVALENCIAS ENCONTRADAS:", dados);

  return dados || [];
}