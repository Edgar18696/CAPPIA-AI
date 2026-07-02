type ItemCatalogo = {
  montadora?: string;
  modelo?: string;
  ano_inicio?: number;
  ano_fim?: number;
  motor?: string;
  peca?: string;
  codigo_oem?: string;
  codigo_equivalente?: string;
  fabricante?: string;
  observacao?: string;
};

type Contexto = {
  marca?: string;
  modelo?: string;
  ano?: string;
  motor?: string;
  chassi?: string;
};

export function montarRespostaCatalogo(
  itens: ItemCatalogo[],
  contexto?: Contexto
) {
  const infoChassi =
    contexto?.chassi
      ? `🔍 Chassi identificado

🔢 Chassi:
${contexto.chassi}

🚗 Montadora:
${contexto.marca || "-"}

🚙 Modelo:
${contexto.modelo || "-"}

⚙️ Motor:
${contexto.motor || "-"}

📅 Ano:
${contexto.ano || "-"}

----------------------------------------

`
      : "";

  if (!itens || itens.length === 0) {
    return `${infoChassi}Nenhum item foi encontrado na Base de Conhecimento.

Por favor, informe uma destas opções para verificarmos melhor:

• Código OEM

• Código gravado na peça

• Modelo completo

• Motorização

⚠️ Recomendamos confirmar a compatibilidade utilizando o chassi do veículo ou comparando o código gravado na peça original.`;
  }

  return (
    infoChassi +
    itens
      .map((item, index) => {
        return `✅ Encontrei uma peça compatível.

Resultado ${index + 1}

🔧 Peça:
${item.peca || "-"}

🏭 Fabricante:
${item.fabricante || "-"}

🔩 Código OEM:
${item.codigo_oem || "-"}

🔄 Código Equivalente:
${item.codigo_equivalente || "-"}

🚗 Aplicação:
${item.montadora || "-"} ${item.modelo || "-"} ${item.motor || "-"} ${item.ano_inicio || "-"} até ${item.ano_fim || "-"}

📝 Observação:
${item.observacao || "-"}

⚠️ Recomendamos confirmar a compatibilidade utilizando o chassi do veículo ou comparando o código gravado na peça original.`;
      })
      .join("\n\n----------------------------------------\n\n")
  );
}