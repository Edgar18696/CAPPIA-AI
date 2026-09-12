function adicionarLinha(lista, emoji, titulo, objeto) {
  if (!objeto) return;

  lista.push(
    `${emoji} ${titulo}\n${objeto.recomendacao}`
  );

  if (
    Array.isArray(objeto.alertas) &&
    objeto.alertas.length
  ) {
    objeto.alertas.forEach((alerta) => {
      lista.push(`• ${alerta}`);
    });
  }

  lista.push("");
}

export function montarRespostaEspecialistas({
  tecnico,
  comercial,
  seo,
  marketplace,
  auditoria,
  publicacao,
}) {
  const resposta = [];

  resposta.push(
    "🤖 Análise completa do PAIIA AI"
  );

  resposta.push("");

  adicionarLinha(
    resposta,
    "🔧",
    "Especialista Técnico",
    tecnico
  );

  adicionarLinha(
    resposta,
    "💰",
    "Especialista Comercial",
    comercial
  );

  adicionarLinha(
    resposta,
    "📝",
    "Especialista SEO",
    seo
  );

  adicionarLinha(
    resposta,
    "🛒",
    "Marketplace",
    marketplace
  );

  adicionarLinha(
    resposta,
    "📋",
    "Auditoria",
    auditoria
  );

  adicionarLinha(
    resposta,
    "🚀",
    "Publicação",
    publicacao
  );

  return resposta.join("\n");
}

export default montarRespostaEspecialistas;