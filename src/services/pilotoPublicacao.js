// =============================================================
// PAIIA — Piloto automático da Publicação (LOJA ONLINE).
// Depois da ÚNICA autorização do PAIIA Voz, executa sozinho, em ordem, os
// MESMOS passos da tela de Publicação (nada é reescrito): canais → Bling →
// quantidade → validar → autorizar → publicar (com o nº da autorização, travado
// no servidor) → acompanhar até ATIVO → vínculo no Bling → Central.
// Qualquer problema: PAUSA com uma única mensagem; nada é repetido.
// =============================================================
export const ETAPAS_PILOTO = ["canais", "bling", "quantidade", "validar", "publicar", "ativo", "vinculo", "central"];
export const ROTULO_ETAPA = { canais: "Canais", bling: "Bling e estoque", quantidade: "Quantidade", validar: "Dados obrigatórios (o ML valida ao publicar)", publicar: "Publicação", ativo: "Anúncio ativo", vinculo: "Vínculo no Bling", central: "Central de Publicação" };
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

const pausa = (etapa, texto, extra = {}) => ({ ok: false, etapa, texto, ...extra });

const EM_CONFERENCIA = /Conferindo|Procurando|Consultando/i;
/**
 * (09/11) Motivo ESPECÍFICO de o botão Publicar não ter sido liberado (antes: "A publicação não foi
 * liberada pela conferência", sem dizer o quê). textoBloqueios = "Item: texto · Item: texto" (tela);
 * motivoBotao = por que o botão está desligado sem bloqueio na lista. → { texto, item }
 */
export function motivoDoBloqueio(textoBloqueios = "", motivoBotao = "", { segundos = 45 } = {}) {
  const itens = String(textoBloqueios || "").split(" · ").map((x) => x.trim()).filter(Boolean).map((x) => {
    const i = x.indexOf(": ");
    return i > 0 ? { item: x.slice(0, i), texto: x.slice(i + 2) } : { item: "", texto: x };
  });
  const conferindo = itens.filter((x) => EM_CONFERENCIA.test(x.texto));
  const erros = itens.filter((x) => !conferindo.includes(x));
  const nomes = (l) => l.map((x) => x.item || "conferência").join(", ");
  if (erros.length) {
    const resto = conferindo.length ? ` (ainda sem resposta: ${nomes(conferindo)})` : "";
    return { item: erros[0].item, texto: `Corrija antes de publicar — ${erros.map((x) => (x.item ? `${x.item}: ${x.texto}` : x.texto)).join(" · ").slice(0, 500)}${resto}` };
  }
  if (conferindo.length) {
    return { item: conferindo[0].item, texto: `A conferência de ${nomes(conferindo)} não terminou em ${segundos} s (${conferindo.map((x) => x.texto).join(" · ").slice(0, 300)}). Nada foi enviado ao Mercado Livre.${String(motivoBotao || "").trim() ? ` Também: ${String(motivoBotao).trim().slice(0, 200)}` : ""}` };
  }
  if (String(motivoBotao || "").trim()) return { item: "", texto: `O botão Publicar não foi liberado: ${String(motivoBotao).trim().slice(0, 300)}` };
  return { item: "", texto: "A publicação não foi liberada pela conferência e a tela não informou o motivo. Toque em “Corrigir nesta ficha” para ver a verificação técnica." };
}

/**
 * (10/11) Etapa 2 — Bling. Retomada (F5 / "Tentar de novo"): a ficha lembra "usar o Bling", mas a
 * leitura do SKU só acontece por botão ("Consultar o SKU no Bling"). O piloto reconhece esse botão e
 * faz a MESMA consulta (somente leitura), espera enquanto o Bling responde e, se a consulta falhar,
 * relê UMA vez. Produto já cadastrado (pelo SKU ou pelo ID gravado na ficha) = reutiliza, nada é
 * criado. Retorna null quando o bloco do Bling ficou pronto, ou { texto } com o motivo da pausa.
 */
export async function etapaBling(p, { L, esperarAte, encerrado = () => false }) {
  const lendo = () => Boolean(p.achar("[data-paiia-bling-lendo]"));
  // O estoque do Bling só aparece com o produto encontrado (inclui o cadastro gravado na ficha).
  const estado = () => p.achar("[data-paiia-bling-estado]")?.getAttribute?.("data-paiia-bling-estado") || (p.achar("[data-paiia-bling-estoque]") ? "encontrado" : "");
  const textoDo = (sel) => p.texto(p.achar(sel)).replace(/\s+/g, " ").replace(/^[⚠❌]\s*/u, "").trim().slice(0, 300);
  const seg = Math.round(L.passo / 1000);
  // Espera o bloco: resultado da leitura, o botão de consulta/uso, ou "sem Bling" (sem conexão).
  const achou = await esperarAte(() => (lendo() ? null
    : p.achar("[data-paiia-bling-estado]") || p.achar("[data-paiia-bling-estoque]") || p.achar("[data-paiia-usar-bling]") || p.achar("[data-paiia-consultar-bling]") || p.achar('[data-paiia-bling-escolha="sem"]')), L.passo);
  if (encerrado()) return { texto: "" };
  if (!achou) return { texto: lendo() ? `O Bling não respondeu à consulta do SKU em ${seg} s. Nada foi criado nem alterado no Bling.` : "O bloco do Bling não apareceu." };
  const resultado = async () => (await esperarAte(() => (!lendo() ? estado() || null : null), 2 * L.passo)) || "";
  let est = estado();
  if (!est) {
    const botao = p.achar("[data-paiia-usar-bling]") || p.achar("[data-paiia-consultar-bling]");
    if (!botao) return { texto: "Nenhuma conta Bling conectada: o SKU não pôde ser conferido no Bling. Reconecte o Bling (ou escolha “Publicar sem Bling” na ficha) e toque em Tentar de novo. Nada foi enviado." };
    p.clicar(botao); // consulta do SKU (somente leitura)
    est = await resultado();
    if (!est) return { texto: `O Bling não respondeu à consulta do SKU em ${2 * seg} s. Nada foi criado nem alterado no Bling.` };
  }
  if (est === "erro") {
    const reler = p.achar("[data-paiia-reler-bling]");
    if (reler && !reler.disabled) { p.clicar(reler); await p.esperar(L.intervalo); est = await resultado(); }
    if (est === "erro" || !est) return { texto: `${(textoDo('[data-paiia-bling-estado="erro"]') || "Não foi possível consultar o Bling agora").replace(/[.\s]+$/, "")}. Nada foi criado nem alterado no Bling.` };
  }
  if (est === "ambiguo") return { texto: textoDo('[data-paiia-bling-estado="ambiguo"]') || "Mais de um produto no Bling com este SKU: resolva no Bling." };
  return null;
}

/**
 * Executa o piloto. `p` (interface com a tela, trocável nos testes):
 *  achar(sel) → elemento | null ; clicar(el) ; texto(el) ; esperar(ms) ;
 *  consultarItem(mlb) → item ; relerIntegracao() → "integrado" | outro ; progresso(etapa, texto)
 */
export async function executarPiloto(p, { limites = {} } = {}) {
  const L = { passo: 45_000, ativo: 15 * 60_000, vinculo: 20 * 60_000, intervalo: 1_500, intervaloML: 10_000, ...limites };
  // (08/11) Depois do MLB confirmado, a tela pode ser liberada (Fechar / Criar Próximo Anúncio):
  // p.encerrado() = true para de esperar aqui; as conferências seguem em segundo plano pela ficha.
  // (09/11) ANTES do envio também ("Salvar e Criar Próximo Anúncio"): para na hora, sem tocar em
  // mais nada; a publicação fica pendente (nada vai ao Mercado Livre sem nova autorização).
  // Entre o toque em Publicar e a resposta do ML NUNCA interrompe (enviando).
  let depoisDoMLB = false;
  let enviando = false;
  let enviou = false; // (09/11) já tocou em Publicar: "Tentar de novo" não é oferecido

  const encerrado = () => !enviando && Boolean(p.encerrado?.());
  const pausar = (etapa, texto) => (!depoisDoMLB && encerrado()
    ? { ok: false, etapa, liberado: true, texto: "Liberado para a próxima peça: a ficha ficou salva e a publicação pendente na Central de Publicação; nada foi enviado ao Mercado Livre." }
    : pausa(etapa, texto, { antesDoEnvio: !enviou }));
  const esperarAte = async (fn, ms, intervalo = L.intervalo) => {
    const fim = Date.now() + ms;
    for (;;) { if (encerrado()) return null; const v = await fn(); if (v) return v; if (Date.now() > fim) return null; await p.esperar(intervalo); }
  };
  const visivel = (sel) => { const e = p.achar(sel); return e && !e.disabled ? e : null; };

  // (10/11) Ficha que JÁ tem MLB (F5, "Continuar" na Central, rodada repetida): NUNCA publica de novo.
  // Reconhece o MLB gravado na ficha e segue só com as conferências (anúncio ativo, vínculo no Bling).
  // Sem conseguir ler a ficha: pausa antes de tudo (nada é enviado sem ter certeza).
  if (p.mlbJaPublicado) {
    let ja;
    try { ja = await p.mlbJaPublicado(); } catch (e) { ja = { erro: String(e?.message || e) }; }
    if (ja?.erro) return pausa("canais", `Não consegui conferir se esta ficha já foi publicada (${ja.erro}). Nada foi enviado ao Mercado Livre.`, { antesDoEnvio: true });
    const mlbJa = String(ja?.mlb || "").toUpperCase();
    if (/^MLB\d{6,}$/.test(mlbJa)) {
      enviou = true;
      p.progresso("publicar", `Esta ficha já está publicada no Mercado Livre (${mlbJa}): nada é publicado de novo.`);
      return depoisDoEnvio(mlbJa, String(ja?.link || ""), { jaExistia: true });
    }
  }

  // 1) Canais: "somente este anúncio" + Mercado Livre + continuar.
  p.progresso("canais");
  if (await esperarAte(() => p.achar("[data-paiia-revisao-ml]") || p.achar("[data-paiia-base-nao]") || p.achar('[data-paiia-salvar-canais="ml"]'), L.passo) === null) return pausar("canais", "A Publicação desta ficha não abriu.");
  const base = p.achar("[data-paiia-base-nao]"); if (base) { p.clicar(base); await p.esperar(L.intervalo); }
  if (!p.achar("[data-paiia-revisao-ml]")) {
    const chk = await esperarAte(() => p.achar('[data-paiia-canal-check="mercado_livre"]'), L.passo);
    if (!chk) return pausar("canais", "Não encontrei o canal Mercado Livre desta ficha.");
    if (!chk.checked) p.clicar(chk);
    const salvar = await esperarAte(() => visivel('[data-paiia-salvar-canais="ml"]'), L.passo);
    if (!salvar) return pausar("canais", "Não consegui confirmar o canal Mercado Livre.");
    p.clicar(salvar);
    if (!(await esperarAte(() => p.achar("[data-paiia-revisao-ml]"), L.passo))) return pausar("canais", "A revisão do Mercado Livre não abriu.");
  }
  // 2) Bling: usar o Bling (o produto já foi cadastrado/conferido na etapa 8 do Voz).
  p.progresso("bling");
  const r2 = await etapaBling(p, { L, esperarAte, encerrado });
  if (r2) return pausar("bling", r2.texto);
  // (Novo Anúncio) SKU ausente no Bling: o MESMO cadastro protegido da Publicação (criar_produto: confere
  // as escritas do SKU, trava, envia UMA vez, estoque por balanço). A autorização única cobre este passo.
  const abrirCriar = await esperarAte(() => visivel("[data-paiia-abrir-criar-bling]") || p.achar("[data-paiia-bling-estoque]") || (p.achar("[data-paiia-confirmar-quantidade]") ? { ja: true } : null), L.passo);
  if (abrirCriar && abrirCriar.hasAttribute?.("data-paiia-abrir-criar-bling")) {
    if (encerrado()) return pausar("bling");
    p.progresso("bling", "Cadastrando o produto no Bling com o estoque da ficha…");
    p.clicar(abrirCriar);
    const conferi = await esperarAte(() => p.achar("[data-paiia-conferi-sku-bling] input"), L.passo);
    if (!conferi) return pausar("bling", "O cadastro no Bling não abriu.");
    if (encerrado()) return pausar("bling");
    if (!conferi.checked) p.clicar(conferi);
    const criar = await esperarAte(() => visivel("[data-paiia-confirmar-criar-bling]"), L.passo);
    if (!criar) { const f = p.achar("[data-paiia-bling-faltando]"); return pausar("bling", f ? p.texto(f) : "Faltam dados para cadastrar no Bling."); }
    if (encerrado()) return pausar("bling");
    p.clicar(criar);
    const feito = await esperarAte(() => (p.achar("[data-paiia-abrir-criar-bling]") || p.achar("[data-paiia-conferir-criar-bling]") ? (p.achar("[data-paiia-bling-criacao]") && /n[ãa]o foi|incerto|bloquead|falt|erro|n[ãa]o confirm/i.test(p.texto(p.achar("[data-paiia-bling-criacao]"))) ? { erro: p.texto(p.achar("[data-paiia-bling-criacao]")) } : null) : { ok: true }), 3 * L.passo);
    if (!feito || feito.erro) return pausar("bling", feito?.erro?.slice(0, 300) || "O cadastro no Bling não foi confirmado. Nada foi repetido.");
  }
  // 3) Quantidade da ficha.
  p.progresso("quantidade");
  const q = await esperarAte(() => visivel("[data-paiia-confirmar-quantidade]") || (p.achar('[data-paiia-quantidade-estado="confirmada"]') ? { ja: true } : null), L.passo);
  if (encerrado()) return pausar("quantidade");
  if (q && !q.ja) p.clicar(q);
  // 4) (13/11 — "publicar primeiro, conferir depois") Sem pré-validação separada: o SERVIDOR valida no
  // Mercado Livre dentro da própria publicação (validarComVariacoes) e recusa o que o ML não aceitar.
  // Assim a mesma checagem não é feita 2–3 vezes e nada fica esperando por ela.
  p.progresso("validar", "O Mercado Livre valida na própria publicação");
  await p.esperar(L.intervalo);
  if (encerrado()) return pausar("validar");
  const aut = visivel("[data-paiia-autorizo-ml]");
  // 5) Publicar UMA vez (o nº da autorização vai junto; o servidor recusa repetição).
  p.progresso("publicar");
  if (aut && !aut.checked) p.clicar(aut);
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
  if (!pub || pub.bloqueio) {
    // (09/11) Diz QUAL pendência impede (e qual item abrir), mesmo se algo ficou "Conferindo…".
    const bloq = p.achar("[data-paiia-bloqueios-detalhe]");
    const motivo = p.achar("[data-paiia-publicar-motivo]");
    const m = motivoDoBloqueio(pub?.bloqueio || (bloq ? p.texto(bloq) : ""), motivo ? p.texto(motivo) : "", { segundos: Math.round(L.passo / 1000) });
    const r = pausar("publicar", m.texto);
    return m.item && !r.liberado ? { ...r, item: m.item } : r;
  }
  if (encerrado()) return pausar("publicar");
  enviando = true;
  enviou = true;
  p.clicar(pub);
  // A tela pede 2 toques (autorizar + confirmar): a ÚNICA autorização do Voz cobre os dois.
  // O 2º toque só acontece UMA vez e só se nada começou; a trava do servidor impede repetição.
  await p.esperar(L.intervalo);
  const pub2 = p.achar("[data-paiia-resultado-publicacao]") ? null : visivel("[data-paiia-publicar-ml]");
  if (pub2) p.clicar(pub2);
  const res = await esperarAte(() => p.achar("[data-paiia-resultado-publicacao]"), 3 * L.passo);
  enviando = false;
  if (!res) return pausar("publicar", "Sem resposta da publicação. Nada foi reenviado: confira na conta.");
  const estadoRes = res.getAttribute("data-paiia-resultado-publicacao");
  const mlb = (p.texto(res).match(/MLB\d{6,}/) || [])[0] || "";
  if (!mlb || !/^publicado/.test(estadoRes)) return pausar("publicar", p.texto(res).slice(0, 300) || "O Mercado Livre não publicou. Nada foi reenviado.");
  // MLB confirmado pelo Mercado Livre e gravado: avisa "publicado" JÁ; o resto segue sem prender ninguém.
  const link = (res.querySelector?.("a")?.href) || "";
  return depoisDoEnvio(mlb, link);

  // Depois do MLB (publicado agora ou já existente na ficha): só conferências, nunca outra publicação.
  async function depoisDoEnvio(mlb, link, { jaExistia = false } = {}) {
  depoisDoMLB = true;
  await p.publicado?.({ mlb, link, ...(jaExistia ? { jaExistia: true } : {}) });
  const segundoPlano = { ok: true, mlb, link, segundoPlano: true, ...(jaExistia ? { jaExistia: true } : {}), pendencia: "conferências seguem em segundo plano (Central de Publicação)" };
  if (encerrado()) return segundoPlano;
  const avisos = [];
  // 6) Acompanhar até ATIVO (pausado processando fotos = continua esperando).
  p.progresso("ativo", "Aguardando o Mercado Livre ativar o anúncio…");
  let sit = null;
  const ativo = await esperarAte(async () => { sit = situacaoAnuncioML(await p.consultarItem(mlb).catch(() => null)); if (!sit.fim) p.progresso("ativo", sit.texto); return sit.fim ? sit : null; }, L.ativo, L.intervaloML);
  if (!ativo) avisos.push(`o Mercado Livre ainda não ativou o ${mlb} (fotos em processamento?): confira mais tarde`);
  else if (!ativo.ok) avisos.push(`${String(ativo.texto).replace(/\.$/, "")}: confira no Mercado Livre`);
  if (encerrado()) return segundoPlano;
  // 7) Vínculo no Bling (LOJA ONLINE: o Bling traz o anúncio; o PAIIA só confere).
  p.progresso("vinculo", "Conferindo o vínculo do anúncio no Bling…");
  // (10/11) Ficha já publicada: uma leitura só (a conferência do vínculo segue em segundo plano pela ficha).
  const vinc = jaExistia
    ? (await p.relerIntegracao().catch(() => "")) === "integrado"
    : await esperarAte(async () => ((await p.relerIntegracao()) === "integrado" ? true : null), L.vinculo, L.intervaloML);
  if (!vinc) avisos.push(jaExistia ? "vínculo no Bling em conferência: segue sozinho em segundo plano (Central de Publicação)" : "vínculo no Bling ainda não confirmado: confira a Gestão de Anúncios do Bling");
  if (encerrado()) return segundoPlano;
  // 8) Central (a ficha já foi marcada publicada) + pendências da conferência posterior, sem esconder nada.
  p.progresso("central");
  const resFinal = p.achar("[data-paiia-resultado-publicacao]");
  if (resFinal?.getAttribute?.("data-paiia-resultado-publicacao") === "publicado_com_pendencia") avisos.push(p.texto(resFinal).replace(/\s+/g, " ").slice(0, 300));
  const posteriores = p.achar("[data-paiia-pendencias-posteriores]");
  if (posteriores) avisos.push(p.texto(posteriores).replace(/;?\s*a publicação fica bloqueada[^.]*\./gi, ".").replace(/Volte ao Novo Anúncio \([^)]*\) e recalcule/gi, "recalcule no Novo Anúncio").replace(/\s+/g, " ").slice(0, 300));
  return { ok: true, mlb, link, ...(jaExistia ? { jaExistia: true } : {}), pendencia: avisos.join(" · "), ativo: Boolean(ativo?.ok), vinculo: Boolean(vinc) };
  }
}

/**
 * (10/11) MLB já gravado na ficha (qualquer um dos registros da publicação): tabela de publicações,
 * registro do Bling (integracao_bling) ou conferência pós-publicação (pos_publicacao).
 * Aceita a ficha completa (dados_conferencia) ou a linha da Central (campos já extraídos).
 */
export function mlbRegistradoDaFicha(ficha) {
  const f = ficha || {};
  const dc = f.dados_conferencia || {};
  const pubs = Array.isArray(f.publicacao) ? f.publicacao : f.publicacao ? [f.publicacao] : [];
  const candidatos = [...pubs.map((x) => x?.mlb_id), (f.integracao_bling || dc.integracao_bling)?.mlb, (f.pos_publicacao || dc.pos_publicacao)?.mlb];
  return candidatos.map((m) => String(m || "").trim().toUpperCase()).find((m) => /^MLB\d{6,}$/.test(m)) || "";
}
