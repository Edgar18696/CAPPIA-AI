// =============================================================
// PAIIA — Black Friday 2026: LEITURAS PERMITIDAS da função
// "paizinho-bf-leitura" (PREPARADA — NÃO PUBLICADA).
//
// Por quê (15/11/2026): o teste "Comparar as 3 contas" mostrou, igual nas 3
// contas, que a mercadolivre-publicacao (ml_consulta) recusa por lista
// permitida:
//   - /products/{id}                          (marca do veículo no catálogo do ML)
//   - /seller-promotions/users/{conta}        (promoções da conta)
// e que /seller-promotions/items/{id} passa pela lista mas o ML responde
// 403 "At least one policy returned UNAUTHORIZED".
// O código da mercadolivre-publicacao não está no repositório; em vez de
// mexer nela (usada na publicação), a Black Friday ganha uma função própria,
// SÓ DE LEITURA, com estas regras (valem igual no servidor e nos testes).
//
// Regras:
//   - só GET e só nestes endereços (nada de POST/PUT/DELETE);
//   - só as 3 contas da campanha, e só a conta do usuário logado (o servidor
//     usa o token DESTA conta DESTE usuário);
//   - promoções de anúncio: o anúncio precisa ser da conta (dono conferido);
//   - promoções da conta: só da própria conta;
//   - catálogo (/products/{id}): dado público do ML, sem dono.
// =============================================================
import { CONTAS_BLACK_FRIDAY } from "./contas.js";

const txt = (v) => (v === null || v === undefined ? "" : String(v)).trim();

export const FUNCAO_BF_LEITURA = "paizinho-bf-leitura";

const PADROES = Object.freeze([
  { tipo: "promocoes_anuncio", re: /^\/seller-promotions\/items\/(MLB\d+)\?app_version=v2$/ },
  { tipo: "promocoes_conta", re: /^\/seller-promotions\/users\/(\d+)\?app_version=v2(?:&offset=\d{1,4})?(?:&limit=\d{1,3})?$/ },
  { tipo: "catalogo", re: /^\/products\/(MLB[A-Z0-9]{1,20})$/ },
  // (15/11) Diagnóstico das permissões do 403 das promoções (só leitura):
  // autorizações que ESTA conta deu (o servidor devolve só a do PAIIA) e o
  // cadastro do aplicativo PAIIA (o id real vem do segredo do servidor; nada de chave).
  { tipo: "autorizacoes_conta", re: /^\/users\/(\d+)\/applications$/ },
  { tipo: "aplicativo", re: /^\/applications\/paiia$/ },
]);

/** É uma leitura da Black Friday? */
export const ehLeituraBF = (caminho) => PADROES.some((p) => p.re.test(txt(caminho)));

/**
 * Confere se o caminho pode ser lido para a conta.
 * @returns {{ ok: true, tipo: string, anuncio?: string } | { ok: false, erro: string }}
 */
export function conferirLeituraBF(caminho, conta) {
  const c = txt(caminho);
  const id = txt(conta).replace(/\D/g, "");
  if (!CONTAS_BLACK_FRIDAY.some((x) => x.id === id)) return { ok: false, erro: "Conta fora da Black Friday (só LOJA ONLINE, REVELAÇÃO e CIEBR)." };
  if (/[\s\\#]|\.\.|\/\//.test(c)) return { ok: false, erro: "Endereço inválido." };
  const p = PADROES.find((x) => x.re.test(c));
  if (!p) return { ok: false, erro: "Leitura não permitida na Black Friday (só promoções e catálogo)." };
  const m = c.match(p.re);
  if (p.tipo === "promocoes_conta" && m[1] !== id) return { ok: false, erro: "Promoções só da própria conta." };
  if (p.tipo === "autorizacoes_conta" && m[1] !== id) return { ok: false, erro: "Autorizações só da própria conta." };
  return p.tipo === "promocoes_anuncio" ? { ok: true, tipo: p.tipo, anuncio: m[1] } : { ok: true, tipo: p.tipo };
}

/** Caminho para conferir o dono do anúncio antes de ler as promoções dele. */
export const caminhoDono = (anuncio) => `/items/${anuncio}?attributes=id,seller_id`;
export const anuncioEhDaConta = (dados, conta) => String(dados?.seller_id) === txt(conta).replace(/\D/g, "");

/**
 * Resumo SEGURO de uma recusa do ML (para o diagnóstico do 403): só os campos
 * públicos da resposta de erro (message, error, status, cause). Nunca o token.
 */
export function detalheRecusaML(status, corpo) {
  const causa = Array.isArray(corpo?.cause) ? corpo.cause.map((x) => (typeof x === "object" ? txt(x?.code || x?.message || JSON.stringify(x)) : txt(x))).filter(Boolean).slice(0, 5) : [];
  return { status: Number(status) || null, mensagem: txt(corpo?.message), codigo: txt(corpo?.error), causa };
}

const mascarar = (v) => { const t = txt(v); return t.length > 4 ? `…${t.slice(-4)}` : t ? "…" : ""; };
const CAMPOS_APLICATIVO = /^(name|short_name|site_id|scopes|status|active|certification_status|catalog_|functional|permission|domains?|topics|notifications?_)/i;
const CAMPOS_SECRETOS = /secret|token|password|key|redirect|callback|url|email|phone|owner/i;

/**
 * (15/11) Resumo SEGURO do cadastro do aplicativo PAIIA (GET /applications/{id}):
 * só nome, escopos e campos de permissão. Nunca segredo, chave, endereço ou dono.
 */
export function resumirAplicativo(dados) {
  const out = {};
  for (const [k, v] of Object.entries(dados || {})) {
    if (CAMPOS_SECRETOS.test(k) || !CAMPOS_APLICATIVO.test(k)) continue;
    out[k] = v;
  }
  out.id = mascarar(dados?.id);
  return out;
}

/**
 * (15/11) Da lista de autorizações da conta (GET /users/{id}/applications),
 * devolve SÓ a do aplicativo PAIIA (escopos e data), com o id mascarado.
 */
export function resumirAutorizacoes(lista, appId) {
  const l = Array.isArray(lista) ? lista : Array.isArray(lista?.results) ? lista.results : [];
  const nossa = l.find((x) => txt(x?.app_id ?? x?.application_id ?? x?.id) === txt(appId));
  return {
    autorizacoes_na_conta: l.length,
    paiia: nossa ? { app_id: mascarar(appId), scopes: nossa.scopes ?? null, data: txt(nossa.date_created || nossa.date || nossa.created_at) || null, campos: Object.keys(nossa).filter((k) => !CAMPOS_SECRETOS.test(k)) } : null,
  };
}

/**
 * consultar(caminho) pela função paizinho-bf-leitura (navegador).
 * `invocar` = supabase.functions.invoke (injetado). Função ainda não publicada → 404 com motivo claro.
 */
export function consultorLeituraBF(conta, invocar) {
  const id = txt(conta).replace(/\D/g, "");
  return async (caminho) => {
    try {
      const { data, error } = await invocar(FUNCAO_BF_LEITURA, { body: { conta: id, caminho } });
      if (error) {
        const status = error.context?.status;
        if (status === 404) return { ok: false, status: 404, erro: `Leitura indisponível: a função ${FUNCAO_BF_LEITURA} ainda não foi publicada no Supabase.`, funcao_ausente: true };
        let erro = error.message;
        try { const corpo = await error.context?.json?.(); if (corpo?.erro) erro = corpo.erro; } catch { /* mantém */ }
        return { ok: false, status, erro };
      }
      return data && typeof data === "object" ? { ...data, via: FUNCAO_BF_LEITURA } : { ok: false, erro: "Resposta vazia do servidor." };
    } catch (e) {
      return { ok: false, erro: txt(e?.message || e) };
    }
  };
}

/**
 * Junta as duas rotas no navegador: leituras da Black Friday → função própria;
 * o resto (anúncio, compatibilidades, preço de venda, frete, tarifa) → ml_consulta.
 * Enquanto a função própria não estiver publicada (404), volta para a ml_consulta,
 * para o diagnóstico continuar mostrando a recusa real.
 */
export function roteadorBF({ principal, bf }) {
  let bfAusente = false;
  // (15/11) Recusa de PERMISSÃO do ML (403 "policy returned UNAUTHORIZED") não muda
  // repetindo: depois da 1ª, o mesmo tipo de leitura nesta conta devolve a mesma
  // recusa sem chamar o servidor (antes eram centenas de consultas iguais).
  // A recusa continua sendo FALHA (nunca "sem promoção").
  const recusados = new Map();
  return async (caminho) => {
    if (bfAusente || !ehLeituraBF(caminho)) return principal(caminho);
    const tipo = PADROES.find((p) => p.re.test(txt(caminho)))?.tipo;
    if (recusados.has(tipo)) return recusados.get(tipo);
    const r = await bf(caminho);
    if (r?.funcao_ausente) { bfAusente = true; return principal(caminho); }
    if (!r?.ok && Number(r?.status) === 403 && /policy returned UNAUTHORIZED/i.test(txt(r?.erro))) recusados.set(tipo, { ...r, recusado: true, repetida: true });
    return r;
  };
}
