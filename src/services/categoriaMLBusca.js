// =============================================================
// PAIIA — LEITURAS para decidir a categoria do Mercado Livre
// (somente leitura; nada é gravado no ML). As funções recebem as
// dependências de rede por parâmetro: assim os testes usam dados falsos.
//   - preditor oficial: GET /sites/MLB/domain_discovery/search (público)
//   - categoria: GET /categories/{id} e /categories/{id}/attributes (público)
//   - anúncios do mesmo código: função mercadolivre-publicacao, ação
//     "evidencia_codigo" (se ainda não existir no servidor = indisponível)
//   - histórico de rejeições: fichas do mesmo código na base PAIIA +
//     leitura dos MLBs anteriores no ML (GET /items/{mlb}, ml_consulta).
//     "forbidden" sem motivo comprovado vira só RESTRIÇÃO no histórico.
// Regras: services/categoriaML.js
// =============================================================
import { classificarMLBsAnteriores, mesclarRejeicoes, MOTIVOS_CONFIRMADOS_ML } from "./categoriaML.js";
import { resumoAtributosCategoria } from "./categoriaPublicacaoML.js";
import { tipoVeiculoDaCategoria } from "./compatibilidadeML.js";

const API_ML = "https://api.mercadolibre.com";
const txt = (v) => String(v ?? "").trim();

/** fetch → JSON (null em erro). */
export async function lerJsonPublico(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

/** Preditor oficial, uma consulta por termo (ordem do próprio ML preservada). */
export async function consultarPreditor(termos, lerJson = lerJsonPublico) {
  const lista = [...new Set((termos || []).map(txt).filter(Boolean))].slice(0, 5);
  const out = [];
  for (const termo of lista) {
    const d = await lerJson(`${API_ML}/sites/MLB/domain_discovery/search?q=${encodeURIComponent(termo)}&limit=8`);
    out.push({
      termo,
      ok: Array.isArray(d),
      sugestoes: (Array.isArray(d) ? d : []).map((s) => ({ category_id: txt(s?.category_id), category_name: txt(s?.category_name), domain_id: txt(s?.domain_id), domain_name: txt(s?.domain_name) })).filter((s) => s.category_id),
    });
  }
  return out;
}

/** Caminho, domínio, se aceita anúncio, atributos (obrigatórios/condicionais) e Tipo de veículo. */
export async function lerDetalheCategoria(id, lerJson = lerJsonPublico, cache = {}) {
  const c = txt(id).toUpperCase();
  if (!/^MLB\d+$/.test(c)) return null;
  if (cache[c]) return cache[c];
  const [d, atributos] = await Promise.all([lerJson(`${API_ML}/categories/${c}`), lerJson(`${API_ML}/categories/${c}/attributes`)]);
  if (!d) return (cache[c] = { id: c, lido: false, niveis: [], caminho: "", atributos: null, atributosBrutos: null });
  const niveis = Array.isArray(d.path_from_root) ? d.path_from_root.map((n) => txt(n?.name)).filter(Boolean) : [];
  return (cache[c] = {
    id: c,
    lido: true,
    nome: txt(d.name) || niveis[niveis.length - 1] || "",
    niveis,
    caminho: niveis.join(" > "),
    dominio: txt(d.settings?.catalog_domain),
    listingAllowed: d.settings?.listing_allowed !== false,
    filhos: (Array.isArray(d.children_categories) ? d.children_categories : []).map((f) => txt(f?.id)).filter(Boolean),
    atributosBrutos: Array.isArray(atributos) ? atributos : null,
    atributos: resumoAtributosCategoria(atributos),
    tipoVeiculo: Array.isArray(atributos) ? tipoVeiculoDaCategoria(atributos) : null,
  });
}

/** Anúncios reais do mesmo código (evidência). Servidor sem a ação = indisponível. */
export async function lerEvidenciaMesmoCodigo(codigo, chamarFuncao) {
  const cod = txt(codigo);
  if (!cod || typeof chamarFuncao !== "function") return { estado: "nao_consultada", total: 0, porCategoria: {} };
  try {
    const r = await chamarFuncao({ acao: "evidencia_codigo", codigo: cod });
    if (!r?.ok || r.estado !== "ok") return { estado: r?.estado === "sem_resultado" ? "sem_resultado" : "indisponivel", total: 0, porCategoria: {}, motivo: txt(r?.erro || r?.motivo) };
    return { estado: "ok", total: Number(r.total) || 0, porCategoria: r.porCategoria || {}, lido_em: r.lido_em || "" };
  } catch (e) {
    return { estado: "indisponivel", total: 0, porCategoria: {}, motivo: txt(e?.message || e) };
  }
}

/**
 * Histórico de rejeições do SKU: o que já está gravado nas fichas do mesmo
 * código + leitura AGORA dos MLBs anteriores no ML (forbidden = rejeitada).
 *  listarFichas(codigo) → { ok, anuncios: [{ id, publicacao: {mlb_id, ml_user_id}, mlbs_anteriores, categorias_rejeitadas }] }
 *  lerItem(mlb, conta) → { ok, dados: item }
 */
export async function lerRejeicoesDoSKU({ codigo, listarFichas, lerItem, motivosConhecidos = MOTIVOS_CONFIRMADOS_ML }) {
  const r = { lista: [], restricoes: [], lidos: [], erros: [] };
  if (!txt(codigo) || typeof listarFichas !== "function") return r;
  let fichas = [];
  try {
    const l = await listarFichas(codigo);
    if (!l?.ok) r.erros.push(l?.erro || "Fichas do mesmo código não lidas.");
    fichas = Array.isArray(l?.anuncios) ? l.anuncios : [];
  } catch (e) {
    r.erros.push(txt(e?.message || e));
  }
  let lista = [];
  const mlbs = new Map();
  for (const f of fichas) {
    lista = mesclarRejeicoes(lista, Array.isArray(f?.categorias_rejeitadas) ? f.categorias_rejeitadas : []).lista;
    const pub = f?.publicacao;
    if (pub?.mlb_id) mlbs.set(txt(pub.mlb_id).toUpperCase(), txt(pub.ml_user_id));
    for (const m of Array.isArray(f?.mlbs_anteriores) ? f.mlbs_anteriores : []) {
      if (m?.mlb && !mlbs.has(txt(m.mlb).toUpperCase())) mlbs.set(txt(m.mlb).toUpperCase(), txt(m.conta));
    }
  }
  if (typeof lerItem === "function") {
    for (const [mlb, conta] of [...mlbs.entries()].slice(0, 15)) {
      try {
        const it = await lerItem(mlb, conta);
        const d = it?.ok ? it.dados || {} : null;
        if (!d) {
          r.erros.push(`${mlb}: ${txt(it?.erro) || "não lido"}`);
          continue;
        }
        r.lidos.push({ mlb, conta, categoria_id: txt(d.category_id), status: txt(d.status), sub_status: Array.isArray(d.sub_status) ? d.sub_status : [] });
      } catch (e) {
        r.erros.push(`${mlb}: ${txt(e?.message || e)}`);
      }
    }
  }
  const cls = classificarMLBsAnteriores(r.lidos, { motivosConhecidos });
  lista = mesclarRejeicoes(lista, cls.rejeicoes).lista;
  r.lista = lista;
  // Restrição sem motivo comprovado: só histórico (não rejeita a categoria).
  r.restricoes = cls.restricoes.filter((x) => !lista.some((l) => String(l.mlb || "").toUpperCase() === x.mlb));
  return r;
}
