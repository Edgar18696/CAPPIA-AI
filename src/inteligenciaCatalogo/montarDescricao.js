import { montarAplicacoesAgrupadas } from "./montarAplicacoes";
import { unicos } from "./util";

export function montarDescricao(registros, codigoFinal) {
  console.log("REGISTROS NA DESCRIÇÃO:", registros);
  console.log("CÓDIGO NA DESCRIÇÃO:", codigoFinal);

  const primeiro = registros[0] || {};
  
  const equivalentes = unicos(
    registros.flatMap((item) =>
      String(item.codigo_equivalente || "")
        .split(/[,;/\n]/)
        .map((c) => c.trim())
    )
  );

  const motores = unicos(registros.map((item) => item.motor));
  const montadoras = unicos(registros.map((item) => item.montadora));

  return `
${(primeiro.peca || "PEÇA AUTOMOTIVA").toUpperCase()}

FABRICANTE:
${primeiro.fabricante || "-"}

CÓDIGO PRINCIPAL:
${codigoFinal}

CÓDIGOS EQUIVALENTES:
${equivalentes.length ? equivalentes.map((c) => `• ${c}`).join("\n") : "Não informado"}

MONTADORAS:
${montadoras.length ? montadoras.map((m) => `• ${m}`).join("\n") : "Não informado"}

MOTORES:
${motores.length ? motores.map((m) => `• ${m}`).join("\n") : "Não informado"}

APLICAÇÕES:
${montarAplicacoesAgrupadas(registros)}

OBSERVAÇÃO:
${primeiro.observacao || "Compare sempre o código gravado na peça original antes da compra."}

IMPORTANTE:
Antes da compra, compare o código gravado na peça original ou informe o chassi do veículo para confirmação da compatibilidade.

CONTEÚDO DA EMBALAGEM:
• 01 peça
`.trim();
}