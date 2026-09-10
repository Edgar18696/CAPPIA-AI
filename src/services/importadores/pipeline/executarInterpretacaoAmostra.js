import { supabase } from "../../../supabase";
import { interpretarBlocoBruto } from "./interpretarBlocoBruto.js";
import {
  TAMANHO_LOTE_VALIDACAO_FASE2,
  montarLoteValidacaoFase2,
  resumirLoteInterpretacao,
} from "./selecionarLoteValidacaoFase2.js";

function lancarErro(erro, contexto) {
  throw new Error(`${contexto}: ${erro?.message || "falha na interpretação."}`);
}

async function obterLoteId(loteId) {
  if (loteId) {
    return loteId;
  }

  const { data, error } = await supabase
    .from("catalogo_importacao_lote")
    .select("id")
    .order("atualizado_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    lancarErro(error, "Não foi possível localizar o lote da extração bruta");
  }

  return data?.id || null;
}

async function buscarBlocosDoLote(loteId) {
  const tamanhoPagina = 1000;
  const blocos = [];

  for (let inicio = 0; ; inicio += tamanhoPagina) {
    const { data, error } = await supabase
      .from("catalogo_bloco_bruto")
      .select(
        "id, lote_id, pagina, ordem_bloco, texto_original, linhas_originais"
      )
      .eq("lote_id", loteId)
      .order("pagina", { ascending: true })
      .order("ordem_bloco", { ascending: true })
      .range(inicio, inicio + tamanhoPagina - 1);

    if (error) {
      lancarErro(error, "Não foi possível ler os blocos brutos do lote");
    }

    const pagina = data || [];
    blocos.push(...pagina);
    if (pagina.length < tamanhoPagina) {
      break;
    }
  }

  return blocos;
}

async function gravarInterpretacao(registro) {
  const { data, error } = await supabase
    .from("catalogo_bloco_interpretacao")
    .upsert(registro, { onConflict: "bloco_bruto_id" })
    .select("*")
    .single();

  if (error) {
    lancarErro(error, "Não foi possível gravar a interpretação candidata");
  }

  return data;
}

export async function executarInterpretacaoAmostra({
  loteId,
  onProgresso,
} = {}) {
  onProgresso?.("🔎 Localizando lote da extração bruta...");
  const lote = await obterLoteId(loteId);

  if (!lote) {
    throw new Error(
      "Nenhum lote da Fase 1 encontrado. Execute a extração bruta antes."
    );
  }

  onProgresso?.(
    "📄 Lendo blocos brutos só para montar o lote de validação (50)..."
  );
  const blocos = await buscarBlocosDoLote(lote);
  const amostra = montarLoteValidacaoFase2(blocos, {
    tamanho: TAMANHO_LOTE_VALIDACAO_FASE2,
  });

  if (amostra.length === 0) {
    throw new Error(
      "Nenhum bloco bruto foi encontrado neste lote para o lote de validação."
    );
  }

  const resultados = [];

  for (const item of amostra) {
    onProgresso?.(
      `🧠 Interpretando ${resultados.length + 1}/${amostra.length} (página ${item.bloco.pagina})...`
    );

    const interpretacao = interpretarBlocoBruto({
      texto_original: item.bloco.texto_original,
      linhas_originais: item.bloco.linhas_originais,
    });

    const gravado = await gravarInterpretacao({
      bloco_bruto_id: item.bloco.id,
      lote_id: item.bloco.lote_id,
      pagina: item.bloco.pagina,
      ordem_bloco: item.bloco.ordem_bloco,
      classificacao_candidata: interpretacao.classificacao_candidata,
      codigo_peca: interpretacao.codigo_peca,
      descricao: interpretacao.descricao,
      oem: interpretacao.oem,
      fabricante_marca: interpretacao.fabricante_marca,
      aplicacoes: interpretacao.aplicacoes,
      equivalencias: interpretacao.equivalencias,
      evidencias: {
        ...(interpretacao.evidencias || {}),
        codigo_interno: interpretacao.codigo_interno || interpretacao.evidencias?.codigo_interno || null,
      },
      confianca: interpretacao.confianca,
      motivo_classificacao: interpretacao.motivo_classificacao,
      revisao_manual: interpretacao.revisao_manual,
      status_interpretacao: interpretacao.status_interpretacao,
      amostra_codigo: item.amostraCodigo,
      atualizado_em: new Date().toISOString(),
    });

    resultados.push({
      amostraCodigo: item.amostraCodigo,
      bloco: item.bloco,
      interpretacao: gravado,
    });
  }

  return {
    sucesso: true,
    enviadoCatalogoPecas: false,
    fase1Alterada: false,
    loteId: lote,
    totalBlocosLote: blocos.length,
    totalInterpretados: resultados.length,
    limiteLoteValidacao: TAMANHO_LOTE_VALIDACAO_FASE2,
    resumo: resumirLoteInterpretacao(resultados),
    resultados,
  };
}
