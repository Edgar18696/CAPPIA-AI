// =============================================================
// PAIIA — Central do Paizinho: LEITURA COMERCIAL (vendas, visitas e
// custo dos envios) da conta do piloto. SOMENTE LEITURA.
//
// Por quê (12/11/2026): no teste local, a função mercadolivre-publicacao
// recusa visitas e pedidos ("fora da lista permitida"), então vendas,
// visitas, conversão e faturamento saíam "não lido". A função nova
// "paizinho-leitura-ml" faz SÓ estas leituras, para o usuário logado e
// só nas contas liberadas da auditoria. As regras ficam aqui para valerem
// igual no navegador, no servidor e nos testes.
// =============================================================
import { CONTAS_AUDITORIA } from "./contas.js";

const txt = (v) => (v === null || v === undefined ? "" : String(v)).trim();

/** Endereços que a leitura comercial aceita (somente GET). */
const PADROES = Object.freeze([
  { tipo: "visitas", re: /^\/items\/visits\?ids=MLB\d+(,MLB\d+){0,49}&date_from=\d{4}-\d{2}-\d{2}&date_to=\d{4}-\d{2}-\d{2}$/ },
  { tipo: "visitas", re: /^\/items\/MLB\d+\/visits\?date_from=\d{4}-\d{2}-\d{2}&date_to=\d{4}-\d{2}-\d{2}$/ },
  { tipo: "vendas", re: /^\/orders\/search\?seller=(\d+)&[^#]*$/ },
  { tipo: "envio", re: /^\/shipments\/\d+\/costs$/ },
]);

/** É uma das leituras comerciais? (não diz se é permitida para a conta) */
export function ehLeituraComercial(caminho) {
  const c = txt(caminho);
  return PADROES.some((p) => p.re.test(c));
}

/**
 * Confere se o caminho pode ser lido para a conta.
 * @returns {{ ok: true, tipo: string } | { ok: false, erro: string }}
 */
export function conferirLeituraComercial(caminho, conta) {
  const c = txt(caminho);
  const id = txt(conta).replace(/\D/g, "");
  if (!CONTAS_AUDITORIA.some((x) => x.id === id)) return { ok: false, erro: "Conta não liberada para a leitura comercial (piloto: LOJA ONLINE)." };
  if (/[\s\\]|\.\.|\/\//.test(c)) return { ok: false, erro: "Endereço inválido." };
  const p = PADROES.find((x) => x.re.test(c));
  if (!p) return { ok: false, erro: "Leitura não permitida (só visitas, vendas e custo de envio)." };
  if (p.tipo === "vendas") {
    // Pedidos: só da própria conta (nunca de outro vendedor).
    const seller = c.match(p.re)?.[1];
    if (seller !== id || (c.match(/seller[=.]/g) || []).length !== 1) return { ok: false, erro: "Pedidos só da conta informada." };
  }
  return { ok: true, tipo: p.tipo };
}

/** Anúncios citados numa leitura de visitas (para conferir o dono antes de ler). */
export function anunciosDaLeitura(caminho) {
  const c = txt(caminho);
  const grupo = c.match(/^\/items\/visits\?ids=([^&]+)&/);
  if (grupo) return grupo[1].split(",");
  const um = c.match(/^\/items\/(MLB\d+)\/visits\?/);
  return um ? [um[1]] : [];
}

/**
 * Endereços para conferir o dono dos anúncios: um por anúncio, só id e vendedor.
 * (12/11) A leitura em grupo /items?ids= foi descontinuada pelo ML
 * ("Resource deprecated - client no longer allowed").
 */
export function caminhosDonoDosAnuncios(ids) {
  return ids.map((id) => `/items/${id}?attributes=id,seller_id`);
}

/**
 * Todos os anúncios pedidos são da conta? `respostas` = dados das consultas
 * /items/{id}?attributes=id,seller_id (formato { id, seller_id }).
 */
export function anunciosSaoDaConta(ids, respostas, conta) {
  const dono = {};
  for (const x of respostas || []) if (x?.id) dono[x.id] = String(x.seller_id);
  return ids.length > 0 && ids.every((id) => dono[id] === txt(conta).replace(/\D/g, ""));
}

export const FUNCAO_LEITURA_COMERCIAL = "paizinho-leitura-ml";
export const ERRO_FUNCAO_NAO_PUBLICADA = `Leitura de vendas e visitas indisponível: a função ${FUNCAO_LEITURA_COMERCIAL} ainda não foi publicada no Supabase.`;

/**
 * consultar(caminho) para vendas, visitas e custo de envio pela função
 * paizinho-leitura-ml. `invocar` = supabase.functions.invoke (injetado).
 */
export function consultorComercial(conta, invocar) {
  return async (caminho) => {
    try {
      const { data, error } = await invocar(FUNCAO_LEITURA_COMERCIAL, { body: { conta, caminho } });
      if (error) {
        const status = error.context?.status;
        // Função ainda não publicada (404): motivo claro, sem insistir.
        // (Falha de rede passageira NÃO entra aqui: segue como falha comum.)
        if (status === 404) return { ok: false, status: 404, erro: ERRO_FUNCAO_NAO_PUBLICADA };
        let erro = error.message;
        try { const corpo = await error.context?.json?.(); if (corpo?.erro) erro = corpo.erro; } catch { /* mantém */ }
        return { ok: false, status, erro };
      }
      return data && typeof data === "object" ? data : { ok: false, erro: "Resposta vazia do servidor." };
    } catch (e) {
      return { ok: false, erro: String(e?.message || e) };
    }
  };
}

/**
 * Junta as duas formas de ler o ML no teste local: leituras comerciais vão
 * para `comercial` (função paizinho-leitura-ml), o resto para `principal`
 * (mercadolivre-publicacao). Os dois só fazem GET.
 */
export function roteadorConsultas({ principal, comercial }) {
  if (typeof comercial !== "function") return principal;
  return (caminho) => (ehLeituraComercial(caminho) ? comercial(caminho) : principal(caminho));
}
