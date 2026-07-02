export async function buscarVin(prefixo: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceKey) {
    return null;
  }

  const url =
    `${supabaseUrl}/rest/v1/vin_referencia` +
    `?select=*` +
    `&prefixo_vin=eq.${prefixo}`;

  const resposta = await fetch(url, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  });

  if (!resposta.ok) {
    return null;
  }

  const dados = await resposta.json();

  return dados[0] || null;
}