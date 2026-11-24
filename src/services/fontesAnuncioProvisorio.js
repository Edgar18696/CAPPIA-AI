// =============================================================
// PAIIA — Fontes do anúncio pré-montado (23/11/2026). SÓ LEITURA.
// Usa a MESMA consulta do aviso ao lado do código (mesmo cache: nada é
// consultado duas vezes) e, se preciso, lê UMA ficha ou UM anúncio ML.
// (24/11) Sem ficha nem anúncio nosso do mesmo SKU: UMA pesquisa no Google
// (função paiia-pesquisa-google; reaproveitada por 30 dias) monta o texto.
// O nome do Bling fica só como último recurso.
// Nada é criado no PAIIA, no Bling ou no Mercado Livre.
// =============================================================
import { supabase } from "../supabase";
import { consultarSKURapido, chaveConsulta, cacheConsultaSKU } from "./consultaInicialSKU";
import { lerBling, consultarML, lerFichasDoCodigo, blingEstaConectado } from "./produtoExistenteService";
import { lerFichaNovoAnuncio } from "./fichaNovoAnuncioService";
import { reunirFontesProvisorias, montarAnuncioProvisorio, montarDescricaoProvisoria, FONTE } from "./anuncioProvisorio";
import { montarPeloGoogle } from "./pesquisaGoogleAnuncio";

const TEMPO_GOOGLE_MS = 20000;

/** UMA pesquisa no Google pelo código (servidor). Nunca lança. → { ok, resultados, reaproveitada, buscado_em, erro } */
export async function pesquisarGoogleCodigo(codigo, { invocar = (nome, op) => supabase.functions.invoke(nome, op) } = {}) {
  try {
    const r = await Promise.race([
      invocar("paiia-pesquisa-google", { body: { codigo: String(codigo || "").trim() } }),
      new Promise((ok) => setTimeout(() => ok({ data: { ok: false, erro: "a pesquisa no Google demorou demais" } }), TEMPO_GOOGLE_MS)),
    ]);
    const d = r?.data || {};
    if (r?.error || !d.ok) return { ok: false, resultados: [], erro: d.erro || r?.error?.message || "pesquisa indisponível" };
    return { ok: true, resultados: Array.isArray(d.resultados) ? d.resultados : [], reaproveitada: Boolean(d.reaproveitada), buscado_em: d.buscado_em || "" };
  } catch (e) {
    return { ok: false, resultados: [], erro: String(e?.message || e) };
  }
}

/** Troca o provisório pelo montado com o Google (quando os resultados identificam a peça). */
export function provisorioComGoogle(prov, { codigo = "", g = null } = {}) {
  if (!g?.ok || !g.resultados?.length) return { ...prov, googleErro: g?.ok === false ? g.erro : "" };
  const m = montarPeloGoogle({ codigo, resultados: g.resultados, quando: g.buscado_em || new Date() });
  if (!m.titulo) return prov;
  const n = m.org.fontes.length;
  const ml = m.org.fontes.filter((f) => f.ml).length;
  return {
    ...prov,
    fonte: FONTE.GOOGLE,
    rotulo: `pesquisa no Google (${n} fonte${n === 1 ? "" : "s"}${ml ? `, ${ml} do Mercado Livre` : ""}${g.reaproveitada ? ", reaproveitada" : ""})`,
    titulo: m.titulo,
    descricao: m.descricao,
    descricaoBase: "",
    nome: m.org.peca,
    provisorio: true,
    google: { fontes: n, mercadoLivre: ml, reaproveitada: g.reaproveitada },
  };
}

/**
 * contas: [{ id, nome }] só as conectadas. Nunca lança.
 * pesquisarGoogle: true SÓ quando o código não está nos catálogos (quem chama decide).
 */
export async function montarProvisorioDasFontes({ codigo, contas = [], fichaAtualId = "", pesquisarGoogle = false, google = pesquisarGoogleCodigo }) {
  const sku = String(codigo || "").trim();
  try {
    const blingConectado = await blingEstaConectado().catch(() => null);
    const chave = chaveConsulta({ codigo: sku, contas, blingConectado, fichaAtualId });
    const consulta = chave
      ? await cacheConsultaSKU.obter(chave, () => consultarSKURapido({ codigo: sku, contas, blingConectado, lerBling, consultarML, lerFichas: lerFichasDoCodigo, fichaAtualId }))
      : null;
    const fontes = await reunirFontesProvisorias({ consulta, lerFicha: lerFichaNovoAnuncio, consultarML });
    const prov = { ...montarAnuncioProvisorio({ codigo: sku, ...fontes }), consulta };
    // Ficha nossa ou anúncio nosso do mesmo SKU já dão o texto: não pesquisa fora.
    if (!pesquisarGoogle || prov.fonte === FONTE.FICHA || prov.fonte === FONTE.ML) return prov;
    return provisorioComGoogle(prov, { codigo: sku, g: await google(sku) });
  } catch (e) {
    return { fonte: FONTE.NENHUMA, rotulo: "", titulo: "", descricao: montarDescricaoProvisoria({ codigo: sku }), provisorio: true, erro: String(e?.message || e), consulta: null };
  }
}
