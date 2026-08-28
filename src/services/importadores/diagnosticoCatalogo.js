import { analisarCatalogo } from "./analisarCatalogo";
import { analisarLayoutPdf } from "./analisarLayoutPdf";

export async function diagnosticoCatalogo({
  arquivo,
  fabricante,
  onProgresso,
}) {
  onProgresso?.(
    "🔍 Executando diagnóstico do catálogo..."
  );

  const analise =
    await analisarCatalogo({
      arquivo,
      fabricante,
      onProgresso,
    });

  const paginas =
    Array.isArray(analise.paginas)
      ? analise.paginas
      : [];

  const layout =
    analisarLayoutPdf(paginas);

  return {
    fabricante:
      analise.fabricante,

    chave:
      analise.chave,

    identificado:
      analise.identificado,

    confiancaCatalogo:
      analise.confianca,

    confiancaLayout:
      layout.confianca,

    paginasAplicacoes:
      layout.paginasAplicacoes,

    paginasEquivalencias:
      layout.paginasEquivalencias,

    paginasComTabela:
      layout.paginasComTabela,

    estrutura:
      layout,

    analise,
  };
}