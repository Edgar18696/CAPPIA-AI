export async function buscarEquivalencias(codigo: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceKey) {
    return [];
  }

  const url =
    `${supabaseUrl}/rest/v1/equivalencias_pecas` +
    `?select=*` +
    `&or=(codigo_principal.eq.${codigo},codigo_equivalente.eq.${codigo})`;

  const resposta = await fetch(url, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  });

  if (!resposta.ok) {
    console.log(await resposta.text());
    return [];
  }

  return await resposta.json();
}