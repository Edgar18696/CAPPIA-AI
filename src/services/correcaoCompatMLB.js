// =============================================================
// PAIIA — Correção das compatibilidades de um MLB JÁ PUBLICADO (19/10/2026).
// Usa as aplicações da própria ficha (as informadas pelo usuário) e as
// correspondências de modelo (confirmadas ou automáticas e únicas), confere
// no catálogo de veículos do ML e no próprio MLB (item e, se houver, o
// "produto do vendedor" MLBU) o que já está aceito, e só ENVIA — com
// confirmação explícita — os veículos que faltam ao MESMO MLB.
// Nunca cria anúncio, nunca remove veículo, nunca mexe no Bling.
// =============================================================
import { ramoEsperado } from "./categoriaML.js";
import {
  aplicacoesDaFicha,
  separarAplicacoesParaML,
  aplicarCorrespondencias,
  resolverCompatibilidades,
  idsCompatibilidadesLidas,
  resultadoCompatibilidades,
} from "./compatibilidadeML.js";

/** Aplicações informadas na ficha publicada (cópia aprovada; texto só para fichas antigas). */
export function aplicacoesDaFichaPublicada(ficha) {
  const dc = ficha?.dados_conferencia || {};
  const conferido = dc?.ficha?.anuncioConferido || dc?.anuncio_conferido || {};
  const campos = dc?.ficha?.campos || {};
  const base = Object.keys(conferido).length ? conferido : { compatibilidades: campos.compatibilidades, aplicacoesDetalhadas: campos.aplicacoesManuais, modelosSemDetalhes: campos.modelosSemDetalhes };
  const lista = aplicacoesDaFicha(base).lista;
  const sep = separarAplicacoesParaML(lista);
  return { detalhadas: aplicarCorrespondencias(sep.detalhadas, dc.correspondencias_modelo_ml || {}), modelos: sep.semDetalhes };
}

/** Lê o que o MLB já tem (item + MLBU). consultar(caminho) = ml_consulta GET. */
export async function lerCompatibilidadesDoMLB(mlb, consultar) {
  const it = await consultar(`/items/${mlb}`);
  if (!it?.ok || !it.dados?.id) return { ok: false, erro: it?.erro || "não foi possível ler o anúncio" };
  const c = await consultar(`/items/${mlb}/compatibilities`);
  if (!c?.ok) return { ok: false, erro: c?.erro || "não foi possível ler as compatibilidades do anúncio" };
  const up = String(it.dados.user_product_id || "");
  let cu = null;
  let avisoUserProduct = "";
  if (/^MLBU\d+$/.test(up)) {
    // (06/11/2026) Leitura COMPLEMENTAR: o Mercado Livre responde 400 “Missing request
    // parameter” em /user-products/{MLBU}/compatibilities. Isso não pode derrubar a
    // conferência — vale a leitura do próprio anúncio (/items/{MLB}/compatibilities).
    cu = await consultar(`/user-products/${up}/compatibilities`);
    if (!cu?.ok) {
      avisoUserProduct = `O Mercado Livre não permite ler as compatibilidades do produto do vendedor ${up} por esta consulta (${cu?.erro || "sem resposta"}); contadas as do anúncio ${mlb}.`;
      cu = null;
    }
  }
  // Categoria do anúncio: só categoria de peças do tipo de veículo recebe veículos.
  let categoria = null;
  const catId = String(it.dados.category_id || "");
  if (/^MLB\d+$/.test(catId)) {
    const cat = await consultar(`/categories/${catId}`);
    if (cat?.ok && Array.isArray(cat.dados?.path_from_root)) {
      const niveis = cat.dados.path_from_root.map((n) => String(n?.name || "")).filter(Boolean);
      categoria = { id: catId, niveis, caminho: niveis.join(" > ") };
    }
  }
  return { ok: true, item: it.dados, userProduct: up || "", avisoUserProduct, categoria, ids: idsCompatibilidadesLidas(c.dados, cu?.dados) };
}

/** A categoria do anúncio aceita veículos do tipo da ficha? (só leitura do caminho). */
export function categoriaRecebeVeiculos(categoria, tipoVeiculo = "Carro/Caminhonete") {
  if (!categoria?.niveis?.length) return { ok: true, motivo: "" };
  const ramo = ramoEsperado(tipoVeiculo) || "Peças de Carros e Caminhonetes";
  if (categoria.niveis[0] === "Acessórios para Veículos" && categoria.niveis[1] === ramo) return { ok: true, motivo: "" };
  return { ok: false, motivo: `O anúncio está na categoria “${categoria.caminho}” (${categoria.id}), fora de “${ramo}”: o Mercado Livre não vincula veículos de ${tipoVeiculo} a ela. Enviar de novo não resolve — a categoria do anúncio precisa ser trocada.` };
}

/**
 * Conferência (SOMENTE LEITURA): o que a ficha informa, o que corresponde no
 * catálogo, o que o MLB já aceitou e o que falta.
 */
export async function conferirCompatibilidadesMLB({ ficha, mlb, consultar }) {
  const { detalhadas, modelos } = aplicacoesDaFichaPublicada(ficha);
  const lidos = await lerCompatibilidadesDoMLB(mlb, consultar);
  if (!lidos.ok) return { ok: false, erro: lidos.erro };
  const compat = detalhadas.length
    ? await resolverCompatibilidades(detalhadas, (caminho, metodo = "GET", corpo) => consultar(caminho, metodo, corpo))
    : { veiculos: [], descartados: [], semCatalogo: [], correspondencias: [] };
  if (compat?.erro) return { ok: false, erro: compat.erro };
  const faltam = compat.veiculos.filter((v) => !lidos.ids.has(String(v.id).toUpperCase()));
  const jaAceitos = compat.veiculos.filter((v) => lidos.ids.has(String(v.id).toUpperCase()));
  const dc = ficha?.dados_conferencia || {};
  const tipoVeiculo = dc?.ficha?.anuncioConferido?.tipoVeiculo || dc?.ficha?.campos?.tipoVeiculo || "Carro/Caminhonete";
  const categoriaAnuncio = categoriaRecebeVeiculos(lidos.categoria, tipoVeiculo);
  return { ok: true, mlb, informadas: detalhadas.length + modelos.length, aplicacoes: detalhadas, modelos, compat, noAnuncio: lidos.ids.size, jaAceitos, faltam, userProduct: lidos.userProduct, avisoUserProduct: lidos.avisoUserProduct, categoria: lidos.categoria, categoriaBloqueia: categoriaAnuncio.ok ? "" : categoriaAnuncio.motivo };
}

/**
 * Envia SÓ os veículos que faltam ao MESMO MLB (confirmação explícita) e relê.
 * chamar(acao, extra) = mercadolivre-publicacao na conta da publicação.
 */
export async function enviarCompatibilidadesFaltantes({ mlb, faltam, dominio = "MLB-CARS_AND_VANS", confirmado, chamar, consultar }) {
  if (confirmado !== true) return { ok: false, erro: "Envio não confirmado." };
  const ids = [...new Set((faltam || []).map((v) => String(v.id || v).toUpperCase()).filter((id) => /^MLB\d+$/.test(id)))];
  if (!ids.length) return { ok: false, erro: "Nenhum veículo para enviar." };
  const envio = await chamar("gravar_compatibilidades", { item_id: mlb, produtos: ids.map((id) => ({ id })), domain_id: dominio, confirmado: true, confirmacao: "COMPATIBILIDADES" });
  const relido = await lerCompatibilidadesDoMLB(mlb, consultar);
  const resultado = resultadoCompatibilidades({ enviados: ids, lidos: relido.ok ? relido.ids : null, aplicacoesInformadas: ids.length });
  return { ok: Boolean(envio?.ok) && resultado.sucesso, envio, resultado, noAnuncio: relido.ok ? relido.ids.size : null, erroEnvio: envio?.ok ? "" : envio?.erro || "o Mercado Livre recusou o envio" };
}
