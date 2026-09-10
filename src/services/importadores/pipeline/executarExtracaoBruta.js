import { supabase } from "../../../supabase";
import { extrairPaginasPdf } from "../leitorPdf";
import {
  estimarConfiancaExtracao,
  montarBlocosBrutosDaPagina,
} from "./montarBlocosBrutos";

async function hashArquivo(arquivo) {
  const buffer = await arquivo.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function lancarErroSupabase(erro, contexto) {
  throw new Error(
    `${contexto}: ${erro?.message || "falha ao gravar extração bruta."}`
  );
}

async function upsertLote({ fabricante, arquivoNome, arquivoHash, totalPaginas }) {
  const { data, error } = await supabase
    .from("catalogo_importacao_lote")
    .upsert(
      {
        fabricante,
        arquivo_nome: arquivoNome,
        arquivo_hash: arquivoHash,
        total_paginas: totalPaginas,
        status: "extraido",
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "arquivo_hash" }
    )
    .select("id")
    .single();

  if (error || !data?.id) {
    lancarErroSupabase(error, "Não foi possível gravar o lote do PDF");
  }

  return data.id;
}

async function upsertPagina({
  loteId,
  pagina,
  textoPagina,
  confianca,
}) {
  const { data, error } = await supabase
    .from("catalogo_pagina")
    .upsert(
      {
        lote_id: loteId,
        pagina,
        texto_pagina: textoPagina,
        metodo_extracao: "pdfjs",
        confianca_extracao: confianca,
        status: "extraido",
      },
      { onConflict: "lote_id,pagina" }
    )
    .select("id")
    .single();

  if (error || !data?.id) {
    lancarErroSupabase(error, `Não foi possível gravar a página ${pagina}`);
  }

  return data.id;
}

async function upsertBloco(bloco) {
  const { data, error } = await supabase
    .from("catalogo_bloco_bruto")
    .upsert(bloco, {
      onConflict: "lote_id,pagina,ordem_bloco",
    })
    .select("id")
    .single();

  if (error) {
    lancarErroSupabase(
      error,
      `Não foi possível gravar o bloco ${bloco.pagina}.${bloco.ordem_bloco}`
    );
  }

  return data?.id || null;
}

export async function executarExtracaoBruta({
  arquivo,
  fabricante,
  onProgresso,
} = {}) {
  if (!arquivo) {
    throw new Error("Selecione o catálogo PDF.");
  }

  if (!fabricante) {
    throw new Error("Selecione o fabricante do catálogo.");
  }

  onProgresso?.("🔐 Calculando identificação do arquivo...");
  const arquivoHash = await hashArquivo(arquivo);

  onProgresso?.("📄 Extraindo texto bruto das páginas...");
  const paginas = await extrairPaginasPdf({
    arquivo,
    tipo: "extração bruta",
    onProgresso,
  });

  const loteId = await upsertLote({
    fabricante,
    arquivoNome: arquivo.name || "catalogo.pdf",
    arquivoHash,
    totalPaginas: paginas.length,
  });

  const { error: erroLimpeza } = await supabase
    .from("catalogo_pagina")
    .delete()
    .eq("lote_id", loteId);

  if (erroLimpeza) {
    lancarErroSupabase(
      erroLimpeza,
      "Não foi possível reprocessar as páginas do lote"
    );
  }

  const blocosInspecao = [];
  const paginasComErro = [];
  let totalBlocos = 0;
  let paginasProcessadas = 0;

  for (const pagina of paginas) {
    const numero = Number(pagina?.numeroPagina || pagina?.pagina || 0);
    const textoPagina = String(pagina?.texto || pagina?.conteudo || "");
    const erroPagina = pagina?.erro ? String(pagina.erro) : null;
    const confianca = estimarConfiancaExtracao(textoPagina);

    onProgresso?.(`💾 Gravando página ${numero}...`);

    const paginaId = await upsertPagina({
      loteId,
      pagina: numero,
      textoPagina,
      confianca,
    });
    paginasProcessadas += 1;

    if (erroPagina) {
      paginasComErro.push({
        pagina: numero,
        erro: erroPagina,
      });
    }

    const blocos = montarBlocosBrutosDaPagina(textoPagina);

    for (const bloco of blocos) {
      const statusBloco = "extraido";
      const blocoId = await upsertBloco({
        lote_id: loteId,
        pagina_id: paginaId,
        pagina: numero,
        pagina_fim: numero,
        ordem_bloco: bloco.ordem_bloco,
        cabecalho_secao: null,
        linhas_originais: bloco.linhas_originais,
        texto_original: bloco.texto_original,
        tipo_bloco: "bruto",
        codigos_encontrados: [],
        contexto_pagina: textoPagina.slice(0, 500),
        fonte: fabricante,
        status: statusBloco,
        classificado_por: null,
        confianca_extracao: confianca,
        confianca_classificacao: null,
        motivo_suspeita: null,
        erro_processamento: erroPagina,
        tentativas: 0,
      });
      totalBlocos += 1;
      blocosInspecao.push({
        id: blocoId,
        pagina: numero,
        ordem_bloco: bloco.ordem_bloco,
        texto_original: bloco.texto_original,
        linhas_originais: bloco.linhas_originais,
        arquivoHash,
        status: statusBloco,
      });
    }
  }

  const blocosPendentes = blocosInspecao.filter(
    (bloco) => bloco.status === "extraido"
  ).length;

  return {
    sucesso: true,
    enviadoCatalogoPecas: false,
    loteId,
    fabricante,
    arquivoHash,
    arquivoNome: arquivo.name || "catalogo.pdf",
    totalPaginas: paginas.length,
    paginasProcessadas,
    totalBlocos,
    paginasComErro: paginasComErro.length,
    paginasComErroDetalhe: paginasComErro,
    blocosPendentes,
    statusExtracao: paginasComErro.length > 0 ? "extraido_com_erros" : "extraido",
    blocos: blocosInspecao,
  };
}
