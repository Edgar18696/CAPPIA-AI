// =============================================================
// PAIIA — FINALIZAÇÃO EM DOIS CLIQUES nas três contas (16/11/2026).
//
//   1º clique "Conferir e Publicar": lê (somente leitura) Bling, as três
//      contas do Mercado Livre (SKU do anúncio e das VARIAÇÕES, fichas e
//      registro de MLBs) e as exigências de cada conta (conexão, estoque,
//      preço, frete, margem). Cada conta sai com UMA situação:
//        PUBLICADO     — esta ficha já tem o MLB confirmado nesta conta;
//        JÁ EXISTENTE  — já há anúncio deste SKU nesta conta (não duplica);
//        PENDENTE      — pode publicar (botão do 2º clique);
//        CONFERIR      — possível duplicidade / MLB não confirmado (motivo);
//        IMPEDIDO      — falta algo ou não deu para conferir (motivo).
//   2º clique "Confirmar Publicação na <conta>": publica SÓ nessa conta
//      (piloto: Bling sem duplicar, envio único, MLB real, vínculo, Central).
//
// Pura: recebe o quadro (produtoExistenteSKU) e as conferências por conta
// (contasPublicacaoML). Nada é gravado aqui.
// =============================================================
import { ORDEM_CONTAS_QUADRO, ESTADO_QUADRO } from "./produtoExistenteSKU.js";
import { SITUACAO_CONTA, nomeContaPublicacao } from "./contasPublicacaoML.js";
import { ESTADO_RECONHECIMENTO } from "./reconhecimentoSKU.js";

export const ESTADO_FINAL = Object.freeze({
  PUBLICADO: "publicado",
  JA_EXISTENTE: "ja_existente",
  PENDENTE: "pendente",
  CONFERIR: "conferir",
  IMPEDIDO: "impedido",
});

export const ROTULO_FINAL = Object.freeze({
  [ESTADO_FINAL.PUBLICADO]: "PUBLICADO",
  [ESTADO_FINAL.JA_EXISTENTE]: "JÁ EXISTENTE",
  [ESTADO_FINAL.PENDENTE]: "PENDENTE",
  [ESTADO_FINAL.CONFERIR]: "CONFERIR",
  [ESTADO_FINAL.IMPEDIDO]: "IMPEDIDO",
});

const txt = (v) => String(v ?? "").trim();
const idConta = (v) => txt(v).replace(/\D/g, "");
const MLB = (v) => {
  const t = txt(v).toUpperCase();
  return /^MLB\d{6,}$/.test(t) ? t : "";
};

/**
 * Situação do Bling para TODAS as contas (o cadastro é um só).
 * registrados: produtos Bling já gravados nas fichas deste SKU ([{ produto_id }]).
 * (16/11) ERRO 2 — SKU fora da busca do Bling (que inclui inativos) MAS com produto registrado: o PAIIA
 * NÃO cadastra outro e NÃO pede para excluir. Explica e mostra o que conferir no Bling.
 */
export function situacaoBling(bling, { registrados = [], sku = "" } = {}) {
  const e = bling?.estado;
  const ids = [...new Set((Array.isArray(registrados) ? registrados : []).map((r) => txt(r?.produto_id)).filter(Boolean))];
  if (e === ESTADO_RECONHECIMENTO.ENCONTRADO) {
    const id = txt(bling.produto?.id);
    const outro = ids.length && !ids.includes(id) ? ` Atenção: a ficha registrava o produto ${ids.join(", ")}; a busca pelo SKU acha o ${id} — confira no Bling se não há dois cadastros da mesma peça.` : "";
    return { ok: true, texto: `Bling: produto ${id} (código ${txt(bling.produto?.codigo)}) — reaproveitado, nada é cadastrado de novo.${outro}` };
  }
  if (e === ESTADO_RECONHECIMENTO.NAO_ENCONTRADO && ids.length) {
    return {
      ok: false,
      foraDaBusca: ids,
      texto: `Bling: o SKU ${txt(sku) || "deste anúncio"} não é encontrado pela busca do Bling, mas o PAIIA tem o produto Bling ${ids.join(", ")} registrado. Provável: produto EXCLUÍDO (lixeira), INATIVO ou com o CÓDIGO ALTERADO. No Bling, abra Produtos com Situação “Todos” (e “Excluídos”) e procure pelo ID ${ids[0]}: se estiver excluído, restaure; se inativo, reative; se o código mudou, volte para ${txt(sku) || "o SKU"}. Depois toque em Conferir de novo. O PAIIA não cria outro produto sozinho e não pede para excluir nada. Se você já conferiu que ele NÃO existe mais, use o botão da conta: o PAIIA cadastra o produto UMA vez (cadastro protegido, relê o SKU antes e nunca duplica).`,
    };
  }
  if (e === ESTADO_RECONHECIMENTO.NAO_ENCONTRADO) return { ok: true, cadastrar: true, texto: "Bling: o SKU não está no Bling — no 2º clique o PAIIA cadastra o produto com o estoque da ficha (cadastro protegido: confere o SKU antes e nunca duplica)." };
  if (e === ESTADO_RECONHECIMENTO.AMBIGUO) return { ok: false, texto: "Bling: mais de um produto com este SKU — resolva no Bling (nada é escolhido sozinho)." };
  return { ok: false, texto: `Bling não conferido (${txt(bling?.motivo) || "sem resposta"}).` };
}

/**
 * entrada:
 *   ficha: { id, mlb, conta, envio }  — ficha aberta (MLB/conta gravados, marca de envio pendente)
 *   quadro: quadroProdutoExistente({ fichas, reconhecimento })   (linhas por conta)
 *   verificacoes: resultados de verificarContasPublicacao (um por conta)
 *   fotos: nº de fotos da ficha
 * → { linhas: [{ conta, nome, estado, rotulo, mlbs, motivos, avisos, acao }], bling, global }
 *   acao: { tipo: "publicar"|"retomar"|"nenhuma", conferida, texto }
 */
export function situacaoFinalDasContas({ ficha = {}, quadro = null, verificacoes = [], fotos = 0, blingRegistrados = [], sku = "" } = {}) {
  const mlbFicha = MLB(ficha.mlb);
  const contaFicha = idConta(ficha.conta);
  const envio = ficha.envio && ficha.envio.iniciado_em ? ficha.envio : null;
  const bling = situacaoBling(quadro?.bling, { registrados: blingRegistrados, sku });
  const globais = [];
  if (!(Number(fotos) > 0)) globais.push("Fotos: a ficha não tem fotos preparadas.");
  // (16/11) Produto registrado fora da busca: não impede — vira decisão SUA no próprio 2º clique.
  if (!bling.ok && !bling.foraDaBusca) globais.push(bling.texto);

  const linhas = ORDEM_CONTAS_QUADRO.map((conta) => {
    const nome = nomeContaPublicacao(conta);
    const q = (quadro?.linhas || []).find((l) => l.conta === conta) || null;
    const v = (verificacoes || []).find((r) => idConta(r.conta) === conta) || null;
    const mlbsQ = (q?.anuncios || []).map((a) => a.mlb);
    const avisos = [bling.texto];
    for (const o of q?.outraPeca || []) avisos.push(`${o.mlb} não é desta peça e é ignorado: ${o.motivo}.`);
    for (const o of q?.historico || []) avisos.push(`${o.mlb}: ${o.motivo}.`);
    const fim = (estado, motivos = [], acao = { tipo: "nenhuma" }, mlbs = mlbsQ) => ({ conta, nome, estado, rotulo: ROTULO_FINAL[estado], mlbs, motivos, avisos, acao });

    // 1) Esta ficha JÁ publicou nesta conta: reconhece, nunca reenvia.
    if (mlbFicha && contaFicha === conta) {
      if ((q?.outraPeca || []).some((o) => o.mlb === mlbFicha)) return fim(ESTADO_FINAL.IMPEDIDO, [`O ${mlbFicha} gravado nesta ficha é de outro produto/conta no Mercado Livre: corrija pelo Diagnóstico (nada é publicado).`], undefined, []);
      return fim(ESTADO_FINAL.PUBLICADO, [`Esta ficha já está publicada: ${mlbFicha}. Nada é reenviado.`], undefined, [mlbFicha]);
    }
    // 2) Envio anterior sem resposta nesta conta: retomada segura (confere no ML, adota o MLB ou libera).
    if (envio && idConta(envio.conta) === conta) return fim(ESTADO_FINAL.PENDENTE, [`Um envio anterior ficou sem resposta (${txt(envio.iniciado_em)}): a retomada confere no Mercado Livre antes de qualquer reenvio.`], { tipo: "retomar", texto: `🔁 Retomar com segurança na ${nome}` });
    // 3) Esta ficha já publicou em OUTRA conta: cada conta tem a sua ficha.
    if (mlbFicha && contaFicha && contaFicha !== conta) {
      if (q?.estado === ESTADO_QUADRO.ANUNCIADA) return fim(ESTADO_FINAL.JA_EXISTENTE, [`Já existe anúncio deste SKU nesta conta: ${mlbsQ.join(", ")}.`]);
      return fim(ESTADO_FINAL.IMPEDIDO, [`Esta ficha é a publicação na ${nomeContaPublicacao(contaFicha)}: para ${nome}, use "Publicar em outra conta" na ficha publicada.`], undefined, []);
    }
    // 4) Anúncio deste SKU já existe nesta conta (confirmado no ML, inclusive variações).
    if (q?.estado === ESTADO_QUADRO.ANUNCIADA) return fim(ESTADO_FINAL.JA_EXISTENTE, [`Já existe anúncio deste SKU nesta conta: ${mlbsQ.join(", ")}. Nada é duplicado.`]);
    // 5) Leituras que não terminaram / impedimentos.
    const motivos = [...globais];
    if (!q || q.estado === ESTADO_QUADRO.INCOMPLETA) motivos.push(`Mercado Livre não conferido nesta conta (${txt(q?.motivo) || "sem resposta"}).`);
    // (16/11) Outra ficha deste SKU em andamento nesta conta (sem MLB): NÃO impede — você publica por
    // esta ficha (a outra fica salva) ou abre a outra. Um 2º anúncio na mesma conta continua barrado na
    // hora de publicar (duplicidade lida ao vivo no Mercado Livre + base PAIIA).
    const outraFicha = q?.estado === ESTADO_QUADRO.EM_ANDAMENTO && q.fichaAndamento && q.fichaAndamento !== txt(ficha.id) ? q.fichaAndamento : "";
    const msgOutra = outraFicha ? [`Outra ficha deste SKU (${outraFicha.slice(0, 8)}) está em andamento nesta conta, ainda sem publicar. Pode publicar por ESTA ficha (a outra continua salva, nada é apagado) ou abrir a outra.`] : [];
    const notaOutra = outraFicha ? ` · a ficha ${outraFicha.slice(0, 8)} continua salva, sem publicar` : "";
    if (!v) motivos.push("Exigências da conta não conferidas.");
    else if (v.situacao === SITUACAO_CONTA.IMPEDIDA) motivos.push(...(v.impedimentos || []));
    if (motivos.length) return fim(ESTADO_FINAL.IMPEDIDO, motivos, undefined, []);
    // 6) Possível duplicidade / MLB de ficha não confirmado: você decide no próprio 2º clique.
    const conferir = [
      ...(q?.naoConfirmados || []).map((o) => `${o.mlb}: ${o.motivo}`),
      ...(q?.possiveis || []).map((o) => `${o.mlb}: ${o.motivo}`),
      ...(v?.situacao === SITUACAO_CONTA.CONFERIR ? (v.itens || []).filter((i) => i.nivel === "conferir").map((i) => `${i.item}: ${i.texto}`) : []),
    ];
    // (16/11) Produto Bling registrado que não aparece no Bling: o 2º clique registra a SUA conferência
    // ("não existe mais") e o piloto faz UM cadastro protegido (relê o SKU antes; nunca duplica).
    if (bling.foraDaBusca) {
      const ids = bling.foraDaBusca.join(", ");
      return fim(ESTADO_FINAL.CONFERIR, [...msgOutra, ...conferir, bling.texto], { tipo: "publicar", conferida: conferir.length > 0, descartarBling: bling.foraDaBusca, outraFicha, texto: `✅ Conferi no Bling: o produto ${ids} não existe — cadastrar de novo e publicar na ${nome}${notaOutra}` }, []);
    }
    if (conferir.length) return fim(ESTADO_FINAL.CONFERIR, [...msgOutra, ...conferir], { tipo: "publicar", conferida: true, outraFicha, texto: `✅ Autorizar e Publicar na ${nome} (conferi: não é o mesmo anúncio)${notaOutra}` }, []);
    if (outraFicha) return fim(ESTADO_FINAL.CONFERIR, msgOutra, { tipo: "publicar", conferida: false, outraFicha, texto: `✅ Autorizar e Publicar na ${nome}${notaOutra}` }, []);
    return fim(ESTADO_FINAL.PENDENTE, ["Pronta para publicar: SKU, conta, duplicidade (com variações), Bling, estoque, preço e frete conferidos."], { tipo: "publicar", conferida: false, texto: `✅ Autorizar e Publicar na ${nome}` }, []);
  });
  return { linhas, bling, global: globais };
}
