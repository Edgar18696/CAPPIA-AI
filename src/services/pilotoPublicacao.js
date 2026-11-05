// =============================================================
// PAIIA — Piloto automático da Publicação (LOJA ONLINE).
// Depois da ÚNICA autorização do PAIIA Voz, executa sozinho, em ordem, os
// MESMOS passos da tela de Publicação (nada é reescrito): canais → Bling →
// quantidade → validar → autorizar → publicar (com o nº da autorização, travado
// no servidor) → acompanhar até ATIVO → vínculo no Bling → Central.
// Qualquer problema: PAUSA com uma única mensagem; nada é repetido.
// =============================================================
export const ETAPAS_PILOTO = ["canais", "bling", "quantidade", "validar", "publicar", "ativo", "vinculo", "central"];
export const ROTULO_ETAPA = { canais: "Canais", bling: "Bling e estoque", quantidade: "Quantidade", validar: "Validação no Mercado Livre", publicar: "Publicação", ativo: "Anúncio ativo", vinculo: "Vínculo no Bling", central: "Central de Publicação" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function autorizacaoDaUrl(href) {
  try { const id = new URL(href).searchParams.get("auto") || ""; return UUID.test(id) ? id.toLowerCase() : ""; } catch { return ""; }
}
export function novaAutorizacaoId() {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  const b = c.getRandomValues(new Uint8Array(16)); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Estado do anúncio no ML: ativo = sucesso; pausado processando fotos = continua esperando. */
export function situacaoAnuncioML(item) {
  const st = String(item?.status || "");
  const sub = (item?.sub_status || []).map(String);
  if (st === "active") return { fim: true, ok: true };
  if (st === "paused" && (!sub.length || sub.some((s) => /picture|image|foto|waiting|processing/i.test(s)))) return { fim: false, texto: "Mercado Livre processando as fotos…" };
  if (st === "under_review") return { fim: false, texto: "Mercado Livre revisando o anúncio…" };
  if (!st) return { fim: false, texto: "Aguardando o Mercado Livre…" };
  return { fim: true, ok: false, texto: `O Mercado Livre deixou o anúncio como "${st}${sub.length ? ` (${sub.join(", ")})` : ""}".` };
}

const pausa = (etapa, texto) => ({ ok: false, etapa, texto });

/**
 * Executa o piloto. `p` (interface com a tela, trocável nos testes):
 *  achar(sel) → elemento | null ; clicar(el) ; texto(el) ; esperar(ms) ;
 *  consultarItem(mlb) → item ; relerIntegracao() → "integrado" | outro ; progresso(etapa, texto)
 */
export async function executarPiloto(p, { limites = {} } = {}) {
  const L = { passo: 45_000, ativo: 15 * 60_000, vinculo: 20 * 60_000, intervalo: 1_500, intervaloML: 10_000, ...limites };
  const esperarAte = async (fn, ms, intervalo = L.intervalo) => {
    const fim = Date.now() + ms;
    for (;;) { const v = await fn(); if (v) return v; if (Date.now() > fim) return null; await p.esperar(intervalo); }
  };
  const visivel = (sel) => { const e = p.achar(sel); return e && !e.disabled ? e : null; };
  const erroNaTela = () => { const e = p.achar('[data-paiia-resultado-publicacao="erro"], [data-paiia-causa-ml]'); return e ? p.texto(e) : ""; };

  // 1) Canais: "somente este anúncio" + Mercado Livre + continuar.
  p.progresso("canais");
  if (await esperarAte(() => p.achar("[data-paiia-revisao-ml]") || p.achar("[data-paiia-base-nao]") || p.achar('[data-paiia-salvar-canais="ml"]'), L.passo) === null) return pausa("canais", "A Publicação desta ficha não abriu.");
  const base = p.achar("[data-paiia-base-nao]"); if (base) { p.clicar(base); await p.esperar(L.intervalo); }
  if (!p.achar("[data-paiia-revisao-ml]")) {
    const chk = await esperarAte(() => p.achar('[data-paiia-canal-check="mercado_livre"]'), L.passo);
    if (!chk) return pausa("canais", "Não encontrei o canal Mercado Livre desta ficha.");
    if (!chk.checked) p.clicar(chk);
    const salvar = await esperarAte(() => visivel('[data-paiia-salvar-canais="ml"]'), L.passo);
    if (!salvar) return pausa("canais", "Não consegui confirmar o canal Mercado Livre.");
    p.clicar(salvar);
    if (!(await esperarAte(() => p.achar("[data-paiia-revisao-ml]"), L.passo))) return pausa("canais", "A revisão do Mercado Livre não abriu.");
  }
  // 2) Bling: usar o Bling (o produto já foi cadastrado/conferido na etapa 8 do Voz).
  p.progresso("bling");
  const usar = await esperarAte(() => p.achar("[data-paiia-usar-bling]") || p.achar("[data-paiia-bling-estoque]") || p.achar("[data-paiia-bling-estado]"), L.passo);
  if (!usar) return pausa("bling", "O bloco do Bling não apareceu.");
  if (usar.hasAttribute?.("data-paiia-usar-bling")) p.clicar(usar);
  // (Novo Anúncio) SKU ausente no Bling: o MESMO cadastro protegido da Publicação (criar_produto: confere
  // as escritas do SKU, trava, envia UMA vez, estoque por balanço). A autorização única cobre este passo.
  const abrirCriar = await esperarAte(() => visivel("[data-paiia-abrir-criar-bling]") || p.achar("[data-paiia-bling-estoque]") || (p.achar("[data-paiia-confirmar-quantidade]") ? { ja: true } : null), L.passo);
  if (abrirCriar && abrirCriar.hasAttribute?.("data-paiia-abrir-criar-bling")) {
    p.progresso("bling", "Cadastrando o produto no Bling com o estoque da ficha…");
    p.clicar(abrirCriar);
    const conferi = await esperarAte(() => p.achar("[data-paiia-conferi-sku-bling] input"), L.passo);
    if (!conferi) return pausa("bling", "O cadastro no Bling não abriu.");
    if (!conferi.checked) p.clicar(conferi);
    const criar = await esperarAte(() => visivel("[data-paiia-confirmar-criar-bling]"), L.passo);
    if (!criar) { const f = p.achar("[data-paiia-bling-faltando]"); return pausa("bling", f ? p.texto(f) : "Faltam dados para cadastrar no Bling."); }
    p.clicar(criar);
    const feito = await esperarAte(() => (p.achar("[data-paiia-abrir-criar-bling]") || p.achar("[data-paiia-conferir-criar-bling]") ? (p.achar("[data-paiia-bling-criacao]") && /n[ãa]o foi|incerto|bloquead|falt|erro|n[ãa]o confirm/i.test(p.texto(p.achar("[data-paiia-bling-criacao]"))) ? { erro: p.texto(p.achar("[data-paiia-bling-criacao]")) } : null) : { ok: true }), 3 * L.passo);
    if (!feito || feito.erro) return pausa("bling", feito?.erro?.slice(0, 300) || "O cadastro no Bling não foi confirmado. Nada foi repetido.");
  }
  // 3) Quantidade da ficha.
  p.progresso("quantidade");
  const q = await esperarAte(() => visivel("[data-paiia-confirmar-quantidade]") || (p.achar('[data-paiia-quantidade-estado="confirmada"]') ? { ja: true } : null), L.passo);
  if (q && !q.ja) p.clicar(q);
  // 4) Validar no ML (não publica).
  p.progresso("validar");
  const val = await esperarAte(() => visivel("[data-paiia-validar-ml]"), L.passo);
  if (!val) { const m = p.achar("[data-paiia-motivo-sem-validar]"); return pausa("validar", m ? p.texto(m) : "A validação no Mercado Livre não ficou disponível."); }
  p.clicar(val);
  const aut = await esperarAte(() => visivel("[data-paiia-autorizo-ml]") || (erroNaTela() ? { erro: erroNaTela() } : null), L.passo);
  if (!aut || aut.erro) return pausa("validar", aut?.erro || "O Mercado Livre não confirmou os dados do anúncio.");
  // 5) Publicar UMA vez (o nº da autorização vai junto; o servidor recusa repetição).
  p.progresso("publicar");
  if (!aut.checked) p.clicar(aut);
  // Bloqueio da conferência (ex.: Frete/precificação): espera só enquanto algo ainda está sendo conferido
  // ("Conferindo…"); bloqueio estável por alguns segundos = pausa JÁ, com o motivo específico.
  let estavel = 0;
  const pub = await esperarAte(() => {
    const b = visivel("[data-paiia-publicar-ml]");
    if (b) return b;
    const bloq = p.achar("[data-paiia-bloqueios-detalhe]");
    const conferindo = bloq && /Conferindo|Procurando|Consultando/i.test(p.texto(bloq));
    estavel = bloq && !conferindo ? estavel + 1 : 0;
    return estavel >= (L.estavel || 4) ? { bloqueio: p.texto(bloq) } : null;
  }, L.passo);
  if (!pub || pub.bloqueio) return pausa("publicar", pub?.bloqueio ? `Corrija antes de publicar — ${pub.bloqueio.slice(0, 400)}` : "A publicação não foi liberada pela conferência.");
  p.clicar(pub);
  // A tela pede 2 toques (autorizar + confirmar): a ÚNICA autorização do Voz cobre os dois.
  // O 2º toque só acontece UMA vez e só se nada começou; a trava do servidor impede repetição.
  await p.esperar(L.intervalo);
  const pub2 = p.achar("[data-paiia-resultado-publicacao]") ? null : visivel("[data-paiia-publicar-ml]");
  if (pub2) p.clicar(pub2);
  const res = await esperarAte(() => p.achar("[data-paiia-resultado-publicacao]"), 3 * L.passo);
  if (!res) return pausa("publicar", "Sem resposta da publicação. Nada foi reenviado: confira na conta.");
  const estadoRes = res.getAttribute("data-paiia-resultado-publicacao");
  const mlb = (p.texto(res).match(/MLB\d{6,}/) || [])[0] || "";
  if (!mlb || !/^publicado/.test(estadoRes)) return pausa("publicar", p.texto(res).slice(0, 300) || "O Mercado Livre não publicou. Nada foi reenviado.");
  // 6) Acompanhar até ATIVO (pausado processando fotos = continua esperando).
  p.progresso("ativo", "Aguardando o Mercado Livre ativar o anúncio…");
  let sit = null;
  const ativo = await esperarAte(async () => { sit = situacaoAnuncioML(await p.consultarItem(mlb).catch(() => null)); if (!sit.fim) p.progresso("ativo", sit.texto); return sit.fim ? sit : null; }, L.ativo, L.intervaloML);
  if (!ativo) return pausa("ativo", `Anúncio ${mlb} publicado, mas ainda não ficou ativo no Mercado Livre. Nada foi reenviado.`);
  if (!ativo.ok) return pausa("ativo", `Anúncio ${mlb} publicado, mas ${String(ativo.texto).charAt(0).toLowerCase()}${String(ativo.texto).slice(1)}`);
  // 7) Vínculo no Bling (LOJA ONLINE: o Bling traz o anúncio; o PAIIA só confere).
  p.progresso("vinculo", "Conferindo o vínculo do anúncio no Bling…");
  const vinc = await esperarAte(async () => ((await p.relerIntegracao()) === "integrado" ? true : null), L.vinculo, L.intervaloML);
  if (!vinc) return pausa("vinculo", `Anúncio ${mlb} ATIVO, mas o vínculo no Bling ainda não foi confirmado. A integração não está totalmente concluída.`);
  // 8) Central: a ficha já foi marcada publicada pela própria Publicação.
  p.progresso("central");
  // Publicado com pendência (ex.: compatibilidades não gravadas): o anúncio fica, mas a integração NÃO está 100%.
  const pendencia = estadoRes === "publicado_com_pendencia" ? p.texto(res).replace(/\s+/g, " ").slice(0, 400) : "";
  return { ok: true, mlb, link: (res.querySelector?.("a")?.href) || "", pendencia };
}
