// =============================================================
// PAIIA — (15/11) CORRIGIR O SKU de uma ficha já publicada, quando o SKU foi corrigido
// no Mercado Livre e no Bling (caso real: parafuso MLB5560614343, 8200642689 → 8200642489).
//   Testes: scripts/testes/correcaoSku.test.mjs
//
// Regras:
//  • Só corrige se o anúncio (MLB DESTA ficha) já tem o SKU novo no ML e o Bling acha o SKU
//    novo no MESMO produto registrado na ficha. Nada é criado, publicado ou excluído.
//  • Troca o SKU na ficha (código, dados aprovados, registros da publicação/Bling/pós) e na
//    linha da publicação. Endereços de fotos e o histórico (versões/MLB trocado) ficam como estão.
//  • Registro interno (paiia_registro_mlb): o banco não deixa mudar o SKU de uma linha; só
//    marca sku_ml_divergente com o SKU do ML (mesma regra que o PAIIA já usa).
//  • Preço, estoque, MLB, conta, aplicações e fotos não mudam.
// =============================================================
import { supabase } from "../supabase";

const txt = (v) => String(v ?? "").trim();
export const normalizarSkuCorrecao = (v) => txt(v).toUpperCase().replace(/[^A-Z0-9]/g, "");
const T_ANUNCIOS = "paiia_anuncios";
const T_PUB = "paiia_anuncios_publicacoes";
const T_REG = "paiia_registro_mlb";

/** Chaves que NUNCA são reescritas (histórico e fotos). */
export const CHAVES_INTOCADAS = Object.freeze(["versoes_substituidas", "mlb_trocado", "mlbs_anteriores", "sku_corrigido", "fotos", "imagens", "banners", "fotosFichaId"]);
const ehEndereco = (s) => /^(https?:|data:|blob:)/i.test(s) || s.includes("/");

/**
 * Troca o SKU antigo pelo novo em todos os TEXTOS dos dados da ficha (deep), menos endereços
 * e chaves intocadas. Devolve { dados, trocas } (trocas = caminhos alterados).
 */
export function substituirSkuNosDados(dados, de, para) {
  const antigo = txt(de);
  const novo = txt(para);
  const trocas = [];
  if (!antigo || !novo || antigo === novo) return { dados, trocas };
  const re = new RegExp(antigo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
  const andar = (v, caminho) => {
    if (typeof v === "string") {
      if (ehEndereco(v) || !v.includes(antigo)) return v;
      trocas.push(caminho);
      return v.replace(re, novo);
    }
    if (Array.isArray(v)) return v.map((x, i) => andar(x, `${caminho}[${i}]`));
    if (v && typeof v === "object") {
      const out = {};
      for (const [k, x] of Object.entries(v)) out[k] = CHAVES_INTOCADAS.includes(k) ? x : andar(x, caminho ? `${caminho}.${k}` : k);
      return out;
    }
    return v;
  };
  return { dados: andar(dados, ""), trocas };
}

const skuDoItem = (it) => txt((it?.attributes || []).find((a) => a?.id === "SELLER_SKU")?.value_name || it?.seller_custom_field);

/**
 * Confere (só leitura) se a correção pode ser feita. deps: { lerItem(conta, mlb), lerBling(sku), fichasDoCodigo(sku) }
 * Devolve { ok, motivo, ficha, publicacao, produtoBling }.
 */
export async function conferirCorrecaoSku({ ficha, skuAntigo, skuNovo }, deps) {
  const de = normalizarSkuCorrecao(skuAntigo);
  const para = normalizarSkuCorrecao(skuNovo);
  if (!de || !para || de === para) return { ok: false, motivo: "Informe o SKU antigo e o novo (diferentes)." };
  if (!ficha) return { ok: false, motivo: "Ficha não encontrada." };
  if (normalizarSkuCorrecao(ficha.codigo) !== de) return { ok: false, motivo: `A ficha está com o SKU ${txt(ficha.codigo)}, não ${txt(skuAntigo)}. Nada foi alterado.` };
  const pub = ficha.publicacao || null;
  const mlb = txt(pub?.mlb_id).toUpperCase();
  if (!/^MLB\d{6,}$/.test(mlb)) return { ok: false, motivo: "A ficha não tem MLB na publicação: corrija o SKU na própria Conferência." };
  const item = await deps.lerItem(txt(pub.ml_user_id), mlb).catch(() => null);
  if (!item || txt(item.id).toUpperCase() !== mlb) return { ok: false, motivo: `Não consegui ler o ${mlb} no Mercado Livre. Nada foi alterado.` };
  if (normalizarSkuCorrecao(skuDoItem(item)) !== para) return { ok: false, motivo: `O ${mlb} está com o SKU ${skuDoItem(item) || "—"} no Mercado Livre, não ${txt(skuNovo)}. Corrija primeiro no Mercado Livre. Nada foi alterado.` };
  const bling = await deps.lerBling(txt(skuNovo)).catch(() => null);
  const prodRegistrado = txt(pub.bling_produto_id || ficha.dados_conferencia?.integracao_bling?.bling_produto_id);
  if (!bling?.encontrado || bling.ambiguo) return { ok: false, motivo: `O SKU ${txt(skuNovo)} não foi encontrado (ou está repetido) no Bling. Nada foi alterado.` };
  if (prodRegistrado && txt(bling.produto?.id) !== prodRegistrado) return { ok: false, motivo: `No Bling o SKU ${txt(skuNovo)} é o produto ${txt(bling.produto?.id)}, mas a ficha usa o produto ${prodRegistrado}. Nada foi alterado (não troca de produto).` };
  const outras = await deps.fichasDoCodigo(txt(skuNovo)).catch(() => null);
  if (!Array.isArray(outras)) return { ok: false, motivo: "Não consegui conferir se já existe ficha com o SKU novo. Nada foi alterado." };
  const outra = outras.find((f) => txt(f.id) !== txt(ficha.id) && f.status_fluxo !== "cancelado");
  if (outra) return { ok: false, motivo: `Já existe outra ficha com o SKU ${txt(skuNovo)} (${txt(outra.id).slice(0, 8)}). Nada foi alterado.` };
  return { ok: true, mlb, item, produtoBling: txt(bling.produto?.id) };
}

/**
 * Executa a correção (depois de conferirCorrecaoSku ok). Grava: publicação (sku), registro interno
 * (sku_ml_divergente) e a ficha (código + dados, com trava de versão). → { ok, trocas, registro, erro }
 */
export async function corrigirSkuDaFicha({ anuncioId, skuAntigo, skuNovo }, deps) {
  const { data: f, error } = await supabase.from(T_ANUNCIOS).select(`id, codigo, titulo, status_fluxo, updated_at, dados_conferencia, ${T_PUB}(id, ml_user_id, mlb_id, bling_produto_id, sku, sku_normalizado)`).eq("id", anuncioId).maybeSingle();
  if (error) return { ok: false, erro: error.message || "Falha ao ler a ficha." };
  const ficha = f ? { ...f, publicacao: (f[T_PUB] || [])[0] || null } : null;
  const conf = await conferirCorrecaoSku({ ficha, skuAntigo, skuNovo }, deps);
  if (!conf.ok) return { ok: false, erro: conf.motivo };
  const novo = txt(skuNovo);
  const agora = new Date().toISOString();
  const { dados, trocas } = substituirSkuNosDados(ficha.dados_conferencia || {}, txt(skuAntigo), novo);
  dados.sku_corrigido = [...(Array.isArray(ficha.dados_conferencia?.sku_corrigido) ? ficha.dados_conferencia.sku_corrigido : []), { de: txt(skuAntigo), para: novo, mlb: conf.mlb, produto_bling: conf.produtoBling, em: agora, campos: trocas.slice(0, 80) }];
  // 1) Ficha (trava de versão: se mudou ao mesmo tempo, nada é gravado).
  const tituloNovo = txt(ficha.titulo).includes(txt(skuAntigo)) ? txt(ficha.titulo).split(txt(skuAntigo)).join(novo) : ficha.titulo;
  const { data: upd, error: e1 } = await supabase.from(T_ANUNCIOS)
    .update({ codigo: novo, codigo_normalizado: normalizarSkuCorrecao(novo), titulo: tituloNovo, dados_conferencia: dados, updated_at: agora })
    .eq("id", ficha.id).eq("updated_at", ficha.updated_at).select("id");
  if (e1) return { ok: false, erro: e1.message || "Falha ao gravar a ficha." };
  if (!Array.isArray(upd) || !upd.length) return { ok: false, erro: "A ficha mudou ao mesmo tempo (conferência em segundo plano). Nada foi alterado; tente de novo em alguns segundos." };
  // 2) Publicação desta ficha (só o SKU).
  const { error: e2 } = await supabase.from(T_PUB).update({ sku: novo, sku_normalizado: normalizarSkuCorrecao(novo), updated_at: agora }).eq("id", ficha.publicacao.id);
  // 3) Registro interno: SKU não muda (o banco impede); marca o SKU do ML como divergente.
  const { error: e3 } = await supabase.from(T_REG).update({ sku_ml_divergente: novo, updated_at: agora }).eq("mlb_id", conf.mlb).eq("anuncio_id", ficha.id);
  return {
    ok: !e2,
    trocas,
    publicacao: e2 ? `falhou (${e2.message || "erro"})` : "ok",
    registro: e3 ? `não marcado (${e3.message || "erro"})` : "marcado",
    erro: e2 ? `Ficha corrigida, mas a linha da publicação não (${e2.message || "erro"}). Rode de novo.` : "",
  };
}
