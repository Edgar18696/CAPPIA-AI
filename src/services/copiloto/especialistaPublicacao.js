function textoSeguro(valor) {
  return String(valor ?? "").trim();
}

export function especialistaPublicacao({
  fotos = [],
  titulo = "",
  descricao = "",
  preco = "",
  diagnostico = null,
  auditoria = null,
  seo = null,
  comercial = null,
} = {}) {
  const checklist = [
    {
      nome: "Foto Principal",
      ok: fotos.length > 0,
    },
    {
      nome: "Título",
      ok: textoSeguro(titulo).length > 0,
    },
    {
      nome: "Descrição",
      ok: textoSeguro(descricao).length > 0,
    },
    {
      nome: "Preço",
      ok: Number(preco) > 0,
    },
    {
      nome: "Diagnóstico",
      ok: Boolean(diagnostico),
    },
    {
      nome: "Auditoria",
      ok: auditoria?.aprovado === true,
    },
    {
      nome: "SEO",
      ok:
        seo?.status === "APROVADO",
    },
    {
      nome: "Comercial",
      ok:
        comercial?.status ===
        "APROVADO",
    },
  ];

  const concluidos =
    checklist.filter(
      (item) => item.ok
    ).length;

  const percentual = Math.round(
    (concluidos /
      checklist.length) *
      100
  );

  let status = "ALERTA";

  if (percentual >= 100) {
    status = "APROVADO";
  } else if (percentual >= 70) {
    status = "REVISAR";
  }

  return {
    especialista: "publicacao",

    status,

    percentual,

    checklist,

    recomendacao:
      status === "APROVADO"
        ? "🚀 Anúncio pronto para publicação."
        : status === "REVISAR"
        ? "Revise os itens pendentes antes de publicar."
        : "O anúncio ainda não possui os requisitos mínimos para publicação.",

    resumo: {
      total:
        checklist.length,

      concluidos,
    },
  };
}

export default especialistaPublicacao;