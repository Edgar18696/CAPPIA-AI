/*
 * Peso e dimensões de embalagem por código/OEM — usado SOMENTE pelo
 * cálculo de frete do "Calcule o preço ideal" (Criar Anúncio).
 *
 * Ordem obrigatória das fontes:
 *   1. Base PAIIA (tabela produto_dimensoes) — dados CONFIRMADOS ou MANUAIS.
 *   2. Catálogos PAIIA / dados já validados da peça identificada.
 *   3. Fonte externa confiável: o próprio anúncio do vendedor na conta
 *      Mercado Livre conectada (função buscar-dimensoes-mercado-livre).
 *   4. Estimativa por categoria — apenas SUGESTÃO (status ESTIMADO),
 *      nunca usada para calcular o frete automaticamente.
 *
 * Nada aqui inventa peso ou medidas: sem fonte confiável → confiavel=false.
 */
import { supabase } from "../../supabase";

export const TABELA_DIMENSOES = "produto_dimensoes";

export const STATUS_DIMENSOES = {
  CONFIRMADO: "CONFIRMADO",
  ESTIMADO: "ESTIMADO",
  MANUAL: "MANUAL",
};

export const ORIGEM_DIMENSOES = {
  BASE_PAIIA: "base_paiia",
  CATALOGO: "catalogo_paiia",
  ANUNCIO_ML: "anuncio_mercado_livre_proprio",
  ESTIMATIVA: "estimativa_categoria",
  MANUAL: "informado_pelo_usuario",
};

export const ROTULO_ORIGEM = {
  [ORIGEM_DIMENSOES.BASE_PAIIA]: "Base PAIIA",
  [ORIGEM_DIMENSOES.CATALOGO]: "Catálogo PAIIA",
  [ORIGEM_DIMENSOES.ANUNCIO_ML]: "Seu anúncio no Mercado Livre",
  [ORIGEM_DIMENSOES.ESTIMATIVA]: "Estimativa por categoria",
  [ORIGEM_DIMENSOES.MANUAL]: "Informado por você",
};

export function normalizarCodigoDimensao(codigo) {
  return String(codigo || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function positivo(valor) {
  const n = Number(String(valor ?? "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function dimensoesValidas(d) {
  return Boolean(
    d &&
      positivo(d.peso_g) &&
      positivo(d.comprimento_cm) &&
      positivo(d.largura_cm) &&
      positivo(d.altura_cm)
  );
}

function codigosUnicos(codigos) {
  const lista = [];
  for (const c of codigos || []) {
    const original = String(c || "").trim();
    const normalizado = normalizarCodigoDimensao(original);
    if (normalizado.length >= 4 && !lista.some((x) => x.normalizado === normalizado)) {
      lista.push({ original, normalizado });
    }
  }
  return lista.slice(0, 8);
}

function montarResultado(d, extra) {
  return {
    confiavel: true,
    peso_g: positivo(d.peso_g),
    comprimento_cm: positivo(d.comprimento_cm),
    largura_cm: positivo(d.largura_cm),
    altura_cm: positivo(d.altura_cm),
    embalagem: d.embalagem || "",
    ...extra,
  };
}

/* 1. Base PAIIA ------------------------------------------------------ */
async function buscarNaBasePaiia(codigos, usuarioId) {
  const normalizados = codigos.map((c) => c.normalizado);
  const { data, error } = await supabase
    .from(TABELA_DIMENSOES)
    .select("*")
    .in("codigo_normalizado", normalizados)
    .in("status", [STATUS_DIMENSOES.CONFIRMADO, STATUS_DIMENSOES.MANUAL])
    .order("updated_at", { ascending: false })
    .limit(20);

  if (error) {
    // Tabela ainda não criada ou sem permissão: segue para as próximas fontes.
    console.warn("Base de dimensões PAIIA indisponível:", error.message);
    return null;
  }

  const linhas = (data || []).filter(dimensoesValidas);
  // Prioridade: registro do próprio usuário (inclui MANUAL) > CONFIRMADO de fonte confiável.
  const doUsuario = linhas.find((l) => l.user_id === usuarioId);
  const escolhida =
    doUsuario || linhas.find((l) => l.status === STATUS_DIMENSOES.CONFIRMADO);

  if (!escolhida) return null;

  return montarResultado(escolhida, {
    status: escolhida.status,
    origem: ORIGEM_DIMENSOES.BASE_PAIIA,
    origemRegistro: escolhida.origem,
    detalheOrigem: escolhida.detalhe_origem || "",
    codigo: escolhida.codigo,
  });
}

/* 2. Catálogos / dados validados da peça identificada ---------------- */
function buscarNaPecaIdentificada(peca) {
  if (!peca || typeof peca !== "object") return null;
  const d = {
    peso_g:
      positivo(peca.peso_g) ||
      positivo(peca.peso_gramas) ||
      positivo(peca.peso_kg) * 1000,
    comprimento_cm: positivo(peca.comprimento_cm) || positivo(peca.embalagem_comprimento_cm),
    largura_cm: positivo(peca.largura_cm) || positivo(peca.embalagem_largura_cm),
    altura_cm: positivo(peca.altura_cm) || positivo(peca.embalagem_altura_cm),
    embalagem: peca.embalagem || "",
  };
  if (!dimensoesValidas(d)) return null;
  return montarResultado(d, {
    status: STATUS_DIMENSOES.CONFIRMADO,
    origem: ORIGEM_DIMENSOES.CATALOGO,
    detalheOrigem: peca.origem_catalogo || "",
  });
}

/* 3. Fonte externa confiável: anúncio próprio no Mercado Livre -------- */
async function buscarNoAnuncioMercadoLivre(codigos) {
  try {
    const { data, error } = await supabase.functions.invoke(
      "buscar-dimensoes-mercado-livre",
      { body: { codigos: codigos.map((c) => c.original) } }
    );
    if (error || !data?.ok || !data?.encontrado) return null;
    const d = data.dimensoes || {};
    if (!dimensoesValidas(d)) return null;
    return montarResultado(d, {
      status: STATUS_DIMENSOES.CONFIRMADO,
      origem: ORIGEM_DIMENSOES.ANUNCIO_ML,
      detalheOrigem: data.itemId ? `Anúncio ${data.itemId}` : "",
    });
  } catch (erro) {
    // Função ainda não publicada ou conta ML não conectada: sem dado externo.
    console.warn("Dimensões pelo anúncio ML indisponíveis:", erro?.message || erro);
    return null;
  }
}

/* 4. Estimativa por categoria (somente sugestão) --------------------- */
const ESTIMATIVAS_CATEGORIA = [
  { termos: ["bico injetor", "bicos injetores", "injetor"], peso_g: 150, c: 14, l: 10, a: 6, rotulo: "Bico injetor" },
  { termos: ["sonda lambda", "sensor de oxigenio", "sensor de oxigênio", "sonda"], peso_g: 250, c: 30, l: 14, a: 6, rotulo: "Sonda lambda" },
  { termos: ["bobina"], peso_g: 700, c: 22, l: 16, a: 10, rotulo: "Bobina de ignição" },
  { termos: ["bomba de combustivel", "bomba de combustível", "bomba combustivel"], peso_g: 1200, c: 30, l: 20, a: 15, rotulo: "Bomba de combustível" },
  { termos: ["corpo de borboleta", "tbi"], peso_g: 1100, c: 22, l: 18, a: 16, rotulo: "Corpo de borboleta" },
  { termos: ["valvula", "válvula", "solenoide"], peso_g: 250, c: 14, l: 10, a: 8, rotulo: "Válvula / solenoide" },
  { termos: ["sensor"], peso_g: 150, c: 14, l: 10, a: 6, rotulo: "Sensor" },
];

export function estimarPorCategoria(peca) {
  const texto = [peca?.peca, peca?.categoria, peca?.categoria_peca, peca?.subcategoria_peca]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (!texto) return null;
  const item = ESTIMATIVAS_CATEGORIA.find((e) => e.termos.some((t) => texto.includes(t)));
  if (!item) return null;
  return {
    confiavel: false,
    status: STATUS_DIMENSOES.ESTIMADO,
    origem: ORIGEM_DIMENSOES.ESTIMATIVA,
    detalheOrigem: item.rotulo,
    peso_g: item.peso_g,
    comprimento_cm: item.c,
    largura_cm: item.l,
    altura_cm: item.a,
    embalagem: "",
  };
}

/*
 * Retorna:
 *  - { confiavel: true, status, origem, peso_g, comprimento_cm, largura_cm, altura_cm, ... }
 *  - { confiavel: false, estimativa: {...} | null } quando nada confiável foi encontrado.
 */
export async function buscarDimensoesProduto({ codigos, peca, usuarioId }) {
  const lista = codigosUnicos(codigos);

  if (lista.length) {
    const daBase = await buscarNaBasePaiia(lista, usuarioId);
    if (daBase) return daBase;
  }

  const doCatalogo = buscarNaPecaIdentificada(peca);
  if (doCatalogo) return doCatalogo;

  if (lista.length) {
    const doAnuncio = await buscarNoAnuncioMercadoLivre(lista);
    if (doAnuncio) return doAnuncio;
  }

  return { confiavel: false, estimativa: estimarPorCategoria(peca) };
}

/*
 * Grava peso/medidas vinculados ao código (e OEMs) do usuário.
 * status: CONFIRMADO (fonte confiável), MANUAL (usuário informou)
 * ou ESTIMADO (sugestão por categoria usada sem revisão — não é
 * reaproveitado automaticamente nas próximas pesquisas).
 */
export async function salvarDimensoesProduto({
  codigos,
  peca,
  peso_g,
  comprimento_cm,
  largura_cm,
  altura_cm,
  embalagem = "",
  status,
  origem,
  detalheOrigem = "",
}) {
  const lista = codigosUnicos(codigos);
  const dados = { peso_g, comprimento_cm, largura_cm, altura_cm };
  if (!lista.length || !dimensoesValidas(dados)) return { ok: false };
  if (!Object.values(STATUS_DIMENSOES).includes(status)) return { ok: false };

  const { data: sessao } = await supabase.auth.getSession();
  const usuarioId = sessao?.session?.user?.id;
  if (!usuarioId) return { ok: false };

  const agora = new Date().toISOString();
  const linhas = lista.map((c, i) => ({
    user_id: usuarioId,
    codigo: c.original,
    codigo_normalizado: c.normalizado,
    oem: i === 0 ? lista.slice(1).map((x) => x.original).join(", ") || null : lista[0].original,
    peca: peca?.peca || null,
    peso_g: Math.round(positivo(peso_g)),
    comprimento_cm: positivo(comprimento_cm),
    largura_cm: positivo(largura_cm),
    altura_cm: positivo(altura_cm),
    embalagem: embalagem || null,
    status,
    origem,
    detalhe_origem: detalheOrigem || null,
    updated_at: agora,
  }));

  const { error } = await supabase
    .from(TABELA_DIMENSOES)
    .upsert(linhas, { onConflict: "user_id,codigo_normalizado" });

  if (error) {
    console.warn("Não foi possível gravar as dimensões na base PAIIA:", error.message);
    return { ok: false, erro: error.message };
  }
  return { ok: true };
}
