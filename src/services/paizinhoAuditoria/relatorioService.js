// =============================================================
// PAIIA — Central do Paizinho: leitura do RELATÓRIO DA MANHÃ e o
// TESTE LOCAL com dados reais (somente leitura).
//   - Produção: lê o último relatório gravado pela função das 03h
//     (tabela paiia_paizinho_relatorios; sem a tabela → "não ativado").
//   - Teste local (npm run dev): roda o mesmo motor no navegador usando as
//     funções que o PAIIA já usa (ml_consulta GET e bling buscar_produto).
//     O resultado fica SÓ neste navegador (localStorage).
// =============================================================
import { supabase } from "../../supabase";
import { consultorML } from "../consultaMLLeitura";
import { executarAuditoria, CONTAS_AUDITORIA } from "./index.js";

export const CHAVE_TESTE_LOCAL = "paiiaPaizinhoRelatorioTeste";
export const CONTA_PILOTO = CONTAS_AUDITORIA[0];

/** Último relatório do servidor. { estado: "ok"|"vazio"|"nao_ativado"|"erro", registro } */
export async function lerUltimoRelatorio() {
  try {
    const { data, error } = await supabase
      .from("paiia_paizinho_relatorios")
      .select("id, conta_ml, conta_nome, status, data_referencia, iniciado_em, concluido_em, relatorio, erro")
      .eq("conta_ml", CONTA_PILOTO.id)
      .order("iniciado_em", { ascending: false })
      .limit(1);
    if (error) {
      const semTabela = ["PGRST205", "42P01"].includes(error.code) || /does not exist|Could not find the table/i.test(error.message || "");
      return { estado: semTabela ? "nao_ativado" : "erro", erro: error.message };
    }
    return data?.length ? { estado: "ok", registro: data[0] } : { estado: "vazio" };
  } catch (e) {
    return { estado: "erro", erro: String(e?.message || e) };
  }
}

export function lerRelatorioTesteLocal() {
  try { return JSON.parse(localStorage.getItem(CHAVE_TESTE_LOCAL) || "null"); } catch { return null; }
}
export function guardarRelatorioTesteLocal(rel) {
  try { localStorage.setItem(CHAVE_TESTE_LOCAL, JSON.stringify(rel)); return true; } catch { return false; }
}

function impostoDoPerfil() {
  try {
    const p = JSON.parse(localStorage.getItem("paiiaPerfilCustos") || "null");
    const n = Number(String(p?.impostoPercentual ?? "").replace(",", "."));
    return Number.isFinite(n) && n >= 0 && String(p?.impostoPercentual ?? "").trim() !== "" ? n : null;
  } catch { return null; }
}

/** Teste local com dados reais da LOJA ONLINE (somente leitura). */
export async function rodarTesteLocal({ limiteItens = 100, concorrencia = 0, aoProgredir } = {}) {
  const consultarBling = async (sku) => {
    const { data, error } = await supabase.functions.invoke("bling-integracao", { body: { acao: "buscar_produto", codigo: sku } });
    if (error) return { ok: false, erro: error.message };
    return data?.ok ? { ok: true, produto: data.produto || null, encontrado: data.encontrado } : { ok: false, encontrado: data?.encontrado, erro: data?.erro };
  };
  const buscarConcorrentes = concorrencia > 0 ? async (item) => {
    const a = (id) => (item.attributes || []).find((x) => x.id === id)?.value_name || "";
    const marca = a("BRAND");
    const original = /^(renault|volkswagen|vw|chevrolet|gm|fiat|ford|toyota|honda|hyundai|nissan|peugeot|citroen)$/i.test(marca.trim());
    const { data, error } = await supabase.functions.invoke("concorrencia", { body: { codigo: a("PART_NUMBER") || a("OEM"), titulo: item.title, fabricante: marca, categoria: original ? "original" : "equivalente" } });
    if (error || !data?.sucesso) return { ok: false, erro: error?.message || data?.error || "sem resultado" };
    return { ok: true, faixaComparavel: data.faixaComparavel, palavrasChaveSugeridas: data.palavrasChaveSugeridas };
  } : null;
  const rel = await executarAuditoria({
    conta: CONTA_PILOTO.id,
    consultar: consultorML(CONTA_PILOTO.id),
    consultarBling,
    buscarConcorrentes,
    config: { impostoPercentual: impostoDoPerfil() },
    opcoesColeta: { limiteItens, limiteConcorrencia: concorrencia },
    origem: "teste_local",
    aoProgredir,
  });
  guardarRelatorioTesteLocal(rel);
  return rel;
}
