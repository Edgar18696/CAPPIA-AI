Deno.serve(async () => {
  return new Response(JSON.stringify({ resposta: "Atendimento IA OK" }), {
    headers: { "Content-Type": "application/json" },
  });
});
