// =============================================================
// PAIIA Voz — CONSULTA NA BASE PAIIA (somente leitura).
//   Testes: scripts/testes/paiiaVoz.test.mjs
//
// Ordem oficial: BASE VALIDADA PAIIA → CATÁLOGOS INTERNOS.
// Nada é gravado. As funções de leitura reais são injetadas
// (buscarConhecimentoValidado, pesquisarCatalogo) para os testes rodarem
// sem rede. Aplicação sem modelo é descartada; nada é completado.
// =============================================================

import { normalizarCodigo } from "../../../services/paizinhoPesquisa/codigoPaizinho.js";

const txt = (v) => String(v ?? "").trim();
const ano = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1950 && n <= 2100 ? n : null;
};

function aplicacaoDaLinha(l, fonte) {
  const modelo = txt(l.modelo);
  if (!modelo) return null;
  return {
    texto: [l.montadora, l.modelo, l.motor, l.ano_inicio, l.ano_fim].filter(Boolean).join(" "),
    montadora: txt(l.montadora),
    modelos: [modelo],
    motores: txt(l.motor) ? [txt(l.motor)] : [],
    anoInicio: ano(l.ano_inicio),
    anoFim: ano(l.ano_fim),
    fonte,
  };
}

/**
 * @returns {Promise<{ encontrado, origem, rotulo, aplicacoes[], codigos[], descricao, erro }>}
 */
export async function consultarBaseVoz(codigo, { buscarValidado, pesquisarCatalogo } = {}) {
  const alvo = normalizarCodigo(codigo);
  const vazio = { encontrado: false, origem: "", rotulo: "", aplicacoes: [], codigos: [], descricao: "", erro: "" };
  if (!alvo) return { ...vazio, erro: "Informe o código da peça antes de consultar." };

  // 1) Base validada PAIIA
  if (typeof buscarValidado === "function") {
    try {
      const linhas = await buscarValidado(codigo);
      if (Array.isArray(linhas) && linhas.length) {
        const rotulo = "Base validada PAIIA";
        const aplicacoes = linhas
          .map((l) => aplicacaoDaLinha(l, (Array.isArray(l.fontes) && l.fontes.length ? l.fontes.map(txt).filter(Boolean).join(" · ") : "") || rotulo))
          .filter(Boolean);
        const codigos = [...new Set(linhas.flatMap((l) => [...(l.codigos_oem || []), ...(l.codigos_equivalentes || [])]).map(txt).filter(Boolean))]
          .filter((c) => normalizarCodigo(c) !== alvo);
        const descricao = txt((linhas.find((l) => txt(l.peca)) || {}).peca);
        return { encontrado: true, origem: "base_validada", rotulo, aplicacoes, codigos, descricao, erro: "" };
      }
    } catch (e) {
      vazio.erro = `Base validada indisponível: ${e?.message || e}`;
    }
  }

  // 2) Catálogos internos (catalogo_mestre / catalogo_pecas)
  if (typeof pesquisarCatalogo === "function") {
    try {
      const registros = await pesquisarCatalogo({ termo: codigo });
      if (Array.isArray(registros) && registros.length) {
        const aplicacoes = registros.map((r) => {
          const fonte = ["Catálogo interno PAIIA", txt(r.arquivo || r.origem_catalogo), r.pagina ? `pág. ${r.pagina}` : ""].filter(Boolean).join(" · ");
          return aplicacaoDaLinha(r, fonte);
        }).filter(Boolean);
        const codigos = [...new Set(registros.flatMap((r) => String(r.equivalencias || r.codigo_equivalente || "").split(/[,;/]/)).map(txt).filter(Boolean))]
          .filter((c) => normalizarCodigo(c) !== alvo);
        const descricao = txt((registros.find((r) => txt(r.peca)) || {}).peca);
        return { encontrado: true, origem: "catalogo", rotulo: "Catálogo interno PAIIA", aplicacoes, codigos, descricao, erro: "" };
      }
    } catch (e) {
      vazio.erro = [vazio.erro, `Catálogo indisponível: ${e?.message || e}`].filter(Boolean).join(" · ");
    }
  }

  return { ...vazio, erro: vazio.erro || "" };
}

export const MENSAGEM_NAO_ENCONTRADO = "Código não encontrado na base PAIIA. Complete os dados manualmente — nenhuma aplicação foi inventada.";
