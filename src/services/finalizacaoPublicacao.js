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

/** Situação do Bling para TODAS as contas (o cadastro é um só). */
export function situacaoBling(bling) {
  const e = bling?.estado;
  if (e === ESTADO_RECONHECIMENTO.ENCONTRADO) return { ok: true, texto: `Bling: produto ${txt(bling.produto?.id)} (código ${txt(bling.produto?.codigo)}) — reaproveitado, nada é cadastrado de novo.` };
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
export function situacaoFinalDasContas({ ficha = {}, quadro = null, verificacoes = [], fotos = 0 } = {}) {
  const mlbFicha = MLB(ficha.mlb);
  const contaFicha = idConta(ficha.conta);
  const envio = ficha.envio && ficha.envio.iniciado_em ? ficha.envio : null;
  const bling = situacaoBling(quadro?.bling);
  const globais = [];
  if (!(Number(fotos) > 0)) globais.push("Fotos: a ficha não tem fotos preparadas.");
  if (!bling.ok) globais.push(bling.texto);

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
    if (q?.estado === ESTADO_QUADRO.EM_ANDAMENTO && q.fichaAndamento && q.fichaAndamento !== txt(ficha.id)) motivos.push(`Outra ficha deste SKU está em andamento nesta conta (${q.fichaAndamento.slice(0, 8)}): continue por ela para não duplicar.`);
    if (!v) motivos.push("Exigências da conta não conferidas.");
    else if (v.situacao === SITUACAO_CONTA.IMPEDIDA) motivos.push(...(v.impedimentos || []));
    if (motivos.length) return fim(ESTADO_FINAL.IMPEDIDO, motivos, undefined, []);
    // 6) Possível duplicidade / MLB de ficha não confirmado: você decide no próprio 2º clique.
    const conferir = [
      ...(q?.naoConfirmados || []).map((o) => `${o.mlb}: ${o.motivo}`),
      ...(q?.possiveis || []).map((o) => `${o.mlb}: ${o.motivo}`),
      ...(v?.situacao === SITUACAO_CONTA.CONFERIR ? (v.itens || []).filter((i) => i.nivel === "conferir").map((i) => `${i.item}: ${i.texto}`) : []),
    ];
    if (conferir.length) return fim(ESTADO_FINAL.CONFERIR, conferir, { tipo: "publicar", conferida: true, texto: `✅ Confirmar Publicação na ${nome} (conferi: não é o mesmo anúncio)` }, []);
    return fim(ESTADO_FINAL.PENDENTE, ["Pronta para publicar: SKU, conta, duplicidade (com variações), Bling, estoque, preço e frete conferidos."], { tipo: "publicar", conferida: false, texto: `✅ Confirmar Publicação na ${nome}` }, []);
  });
  return { linhas, bling, global: globais };
}
