// =====================================================================
// (23/10/2026 - E11) PAIIA Voz: fotos da GALERIA interna do PAIIA.
// Mesma origem da Galeria (tabela "processamentos", fotos do seu usuário,
// com endereço público válido). SOMENTE LEITURA: só select; nada é
// inserido, alterado ou apagado. A imagem escolhida é baixada e guardada
// na ficha como as outras fotos (neste aparelho).
// =====================================================================

export const PAGINA_GALERIA_VOZ = 24;

// (08/11) A Galeria é da sua conta PAIIA (login do PAIIA). Conta do Mercado Livre conectada NÃO é login do PAIIA.
export const AVISO_SEM_LOGIN_GALERIA = "Você não está conectado à sua conta PAIIA neste navegador. A Galeria mostra as fotos da sua conta PAIIA (a conta do Mercado Livre conectada não serve para entrar no PAIIA).";

/**
 * (08/11) Quem é o usuário da Galeria: o que a tela recebeu; sem ele (ex.: tela aberta antes
 * de a sessão ser recuperada), a sessão válida deste navegador. Sem sessão: "sem-login".
 */
export async function usuarioDaGaleria(supabase, userId) {
  if (userId) return { id: String(userId), origem: "tela" };
  try {
    const { data } = await supabase.auth.getSession();
    const id = data?.session?.user?.id;
    return id ? { id: String(id), origem: "sessao" } : { id: "", origem: "sem-login" };
  } catch {
    return { id: "", origem: "sem-login" };
  }
}

/** Lista as fotos da Galeria do usuário (mais novas primeiro). */
export async function listarFotosGaleria(supabase, userId, { inicio = 0, quantidade = PAGINA_GALERIA_VOZ } = {}) {
  if (!userId) return { fotos: [], temMais: false, semLogin: true, erro: AVISO_SEM_LOGIN_GALERIA };
  let resposta;
  try {
    resposta = await supabase
      .from("processamentos")
      .select("id, tipo, status, created_at, imagem_processada, imagem_original")
      .eq("user_id", userId)
      .eq("tipo", "foto")
      .not("imagem_processada", "is", null)
      .not("imagem_processada", "like", "data:%")
      .order("created_at", { ascending: false })
      .range(inicio, inicio + quantidade - 1);
  } catch (e) {
    return { fotos: [], temMais: false, erro: String(e?.message || e) };
  }
  if (resposta?.error) return { fotos: [], temMais: false, erro: resposta.error.message || String(resposta.error) };
  const linhas = Array.isArray(resposta?.data) ? resposta.data : [];
  const fotos = linhas
    .filter((l) => /^https?:\/\//i.test(String(l.imagem_processada || "")))
    .map((l) => {
      const original = /^https?:\/\//i.test(String(l.imagem_original || "")) ? String(l.imagem_original) : "";
      // (06/11) Já tratada pelo Foto IA (fundo branco): processada e diferente da original.
      const tratada = /^processad/i.test(String(l.status || "")) && original !== String(l.imagem_processada);
      return { id: String(l.id), url: String(l.imagem_processada), em: l.created_at || "", original, tratada };
    });
  return { fotos, temMais: linhas.length === quantidade, erro: "" };
}

/** Quantas fotos ainda cabem na ficha. */
export function vagasFotos(quantidadeAtual, maximo) {
  return Math.max(0, Number(maximo) - Number(quantidadeAtual || 0));
}

/** Baixa a foto da Galeria e devolve um arquivo de imagem. */
export async function baixarFotoGaleria(item, { fetchFn = globalThis.fetch } = {}) {
  const r = await fetchFn(item.url);
  if (!r || !r.ok) throw new Error(`não consegui baixar a foto (HTTP ${r?.status ?? "?"})`);
  const blob = await r.blob();
  const tipo = /^image\//.test(blob?.type || "") ? blob.type : "image/jpeg";
  const ext = (tipo.split("/")[1] || "jpg").replace("jpeg", "jpg").replace(/[^a-z0-9]/gi, "");
  return new File([blob], `galeria-${item.id}.${ext}`, { type: tipo });
}

/**
 * (E11) Criar Novo Anúncio: junta as fotos escolhidas na Galeria às do anúncio,
 * como endereços (sem baixar nem enviar nada), sem repetir endereço, até o limite
 * (fotos que já estavam acima do limite não são tiradas), ordem e capa refeitas.
 */
export function juntarFotosGaleriaAnuncio(atuais, itens, limite) {
  const lista = Array.isArray(atuais) ? atuais : [];
  const urls = new Set(lista.map((f) => f?.imagem_processada || f?.imagem_original).filter(Boolean));
  const vistos = new Set();
  const novas = (itens || [])
    .filter((i) => i?.url && !urls.has(i.url) && !vistos.has(i.url) && vistos.add(i.url))
    .map((i) => ({ id: i.id, tipo: "foto", imagem_processada: i.url, imagem_original: "", origem: "galeria", created_at: i.em || "" }));
  return [...lista, ...novas]
    .slice(0, Math.max(lista.length, Number(limite) || 0))
    .map((f, ordem) => ({ ...f, ordem, capa: ordem === 0 }));
}
