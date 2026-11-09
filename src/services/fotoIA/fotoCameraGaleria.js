// =============================================================
// PAIIA — (09/11) Foto IA com a câmera do celular → Galeria PAIIA.
//   Testes: scripts/testes/fotoCameraGaleria.test.mjs
//
// Fluxo: Tirar Foto → original salva NA HORA na Galeria → tratamento automático
// (fundo branco 1200×1200, o MESMO do Foto IA: recorte "foto-ia" + composição com
// os pixels originais) → a MESMA linha da Galeria passa a mostrar a tratada.
//
// Regras:
//  • Original e tratada ficam na MESMA linha de "processamentos" (imagem_original /
//    imagem_processada): ficam ligadas. Enquanto não tratada, as duas são a original.
//  • Sem duplicar: caminhos fixos por foto (repetir = sobrescrever o mesmo arquivo),
//    linha procurada pelo endereço da original antes de criar, e a tratada só entra
//    se a linha ainda estiver com a original (outro aparelho pode ter terminado).
//  • Falhou o tratamento: a original continua na Galeria; nova tentativa automática
//    para falhas temporárias, e "Tentar de novo" para as outras.
//  • Fila guardada no aparelho (IndexedDB): fechar o navegador não perde nada; ao
//    abrir o PAIIA de novo, continua. Outro aparelho da conta também retoma fotos da
//    câmera que ficaram sem tratamento (só depois de alguns minutos).
//  • Nada é apagado da Galeria.
// Sem Supabase novo: só o armazenamento "imagens", a tabela "processamentos" e a
// função "foto-ia" que o Foto IA já usa. Dependências entram por parâmetro.
// =============================================================

export const BUCKET = "imagens";
export const MARCA_CAMERA = "/originais/camera-";
export const HORAS_RETOMAR = 48;
export const MINUTOS_OUTRO_APARELHO = 10;
export const MAX_TENTATIVAS_AUTO = 3;
export const ESPERA_TENTATIVA_MIN = [1, 3, 10];
export const HORAS_MOSTRAR_PRONTAS = 24;
export const ROTULO_CAMERA = {
  salvando: "salvando na Galeria…",
  salva: "salva na Galeria · tratando em seguida",
  tratando: "tratando (fundo branco 1200×1200)…",
  pronta: "pronta na Galeria",
  falhou: "tratamento falhou · a original está salva na Galeria",
};

const txt = (v) => String(v ?? "").trim();
const novoId = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

function nomeSeguro(nome) {
  return (
    String(nome || "foto.jpg")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .slice(-60) || "foto.jpg"
  );
}

export function caminhoOriginalCamera(usuarioId, idLocal, nome) {
  return `${usuarioId}${MARCA_CAMERA}${idLocal}-${nomeSeguro(nome)}`;
}
export function caminhoTratadaCamera(usuarioId, linhaId) {
  return `${usuarioId}/processadas/camera-${String(linhaId).replace(/[^A-Za-z0-9-]/g, "")}.png`;
}
/** Chave do tratamento: a mesma foto (mesma linha) nunca conta duas vezes no limite do Foto IA. */
export function chaveTratamento(linhaId) {
  return `camera-${String(linhaId).replace(/[^A-Za-z0-9-]/g, "")}`.slice(0, 80);
}
export function ehOriginalCamera(url) {
  return txt(url).includes(MARCA_CAMERA);
}
export function caminhoDaUrl(url, bucket = BUCKET) {
  const t = txt(url);
  const m = `/storage/v1/object/public/${bucket}/`;
  const i = t.indexOf(m);
  return i < 0 ? "" : decodeURIComponent(t.slice(i + m.length).split("?")[0]);
}

async function enviar(supabase, caminho, blob, tipo) {
  const { error } = await supabase.storage.from(BUCKET).upload(caminho, blob, { upsert: true, contentType: tipo || blob?.type || undefined });
  if (error) throw Object.assign(new Error(error.message || "falha no envio da foto"), { temporario: true });
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(caminho);
  if (!data?.publicUrl) throw new Error("sem endereço público da foto");
  return data.publicUrl;
}

/**
 * Linha da Galeria para esta original: a que já existe (mesmo endereço) ou uma nova.
 * Nova linha: original nas duas colunas (aparece na Galeria como "não tratada").
 */
export async function acharOuCriarLinhaGaleria({ supabase, usuarioId, url }) {
  if (!usuarioId || !/^https?:\/\//i.test(txt(url))) throw new Error("foto sem endereço ou sem login");
  const achou = await supabase
    .from("processamentos")
    .select("id, imagem_original, imagem_processada")
    .eq("user_id", usuarioId)
    .eq("tipo", "foto")
    .eq("imagem_original", url)
    .limit(1);
  if (achou?.error) throw Object.assign(new Error(achou.error.message || "falha ao ler a Galeria"), { temporario: true });
  const existente = Array.isArray(achou?.data) ? achou.data[0] : null;
  if (existente?.id) return { id: existente.id, imagem_processada: existente.imagem_processada, criada: false };
  const novo = await supabase
    .from("processamentos")
    .insert([{ user_id: usuarioId, tipo: "foto", status: "processado", imagem_original: url, imagem_processada: url }])
    .select("id, imagem_processada")
    .single();
  if (novo?.error || !novo?.data?.id) throw Object.assign(new Error(novo?.error?.message || "a foto não entrou na Galeria"), { temporario: true });
  return { id: novo.data.id, imagem_processada: novo.data.imagem_processada, criada: true };
}

/** Liga a tratada à linha (só se a linha ainda estiver com a original). */
export async function ligarTratadaNaLinha({ supabase, usuarioId, linhaId, urlOriginal, urlTratada }) {
  const r = await supabase
    .from("processamentos")
    .update({ imagem_processada: urlTratada, status: "processado" })
    .eq("id", linhaId)
    .eq("user_id", usuarioId)
    .eq("imagem_processada", urlOriginal)
    .select("id");
  if (r?.error) throw Object.assign(new Error(r.error.message || "falha ao atualizar a Galeria"), { temporario: true });
  return Array.isArray(r?.data) ? r.data.length > 0 : true;
}

/** 1) Salva a original (já normalizada) no armazenamento e na Galeria. */
export async function salvarOriginalNaGaleria({ supabase, usuarioId, item, normalizar }) {
  const caminho = item.caminho || caminhoOriginalCamera(usuarioId, item.id, item.nome);
  let blob = item.blob;
  if (normalizar && !item.normalizada) blob = (await normalizar(blob))?.arquivo || blob;
  const url = await enviar(supabase, caminho, blob, blob?.type || item.tipo);
  const linha = await acharOuCriarLinhaGaleria({ supabase, usuarioId, url });
  return { caminho, url, linhaId: linha.id, blob, normalizada: true };
}

/** 2) Trata a foto (recorte + composição do Foto IA) e liga a tratada à mesma linha. */
export async function tratarFotoDaGaleria({ supabase, usuarioId, linhaId, urlOriginal, caminho, original, recortarFotoIA, comporFotoFinal, baixar }) {
  const recorte = await recortarFotoIA({ supabase, caminho: caminho || caminhoDaUrl(urlOriginal), chave: chaveTratamento(linhaId) });
  const blobRecorte = await baixar(recorte.recorteUrl);
  const pixels = original || (await baixar(urlOriginal));
  const final = await comporFotoFinal({ original: pixels, recorte: blobRecorte, fundo: "branco" });
  const urlTratada = await enviar(supabase, caminhoTratadaCamera(usuarioId, linhaId), final.blob, "image/png");
  const ligou = await ligarTratadaNaLinha({ supabase, usuarioId, linhaId, urlOriginal, urlTratada });
  return { urlTratada, ligou, baixaResolucao: Boolean(final.baixaResolucao) };
}

/** Erros que se resolvem sozinhos (rede, servidor). Limite do mês, login e foto inválida, não. */
export function falhaTemporaria(e) {
  const c = txt(e?.codigo);
  if (["LIMITE_MENSAL", "NAO_AUTORIZADO", "FOTO_INVALIDA", "CANCELADO"].includes(c)) return false;
  return e?.temporario !== false;
}

/**
 * Fila da câmera (no aparelho). armazenamento: { put, getAll, delete, atualizar }.
 * deps: { salvarOriginal(item), tratar(item) } — com o Supabase real fora dos testes.
 */
export function criarFilaCamera({ armazenamento, deps, agora = () => Date.now(), aoMudar = () => {} }) {
  let rodando = null;
  const avisar = (o) => { try { aoMudar(o); } catch { /* tela fechada */ } };

  async function adicionar(arquivos) {
    const novos = [];
    for (const a of Array.from(arquivos || [])) {
      if (!/^image\//i.test(String(a?.type || ""))) continue;
      const item = { id: novoId(), blob: a, nome: a.name || "foto.jpg", tipo: a.type, criadaEm: agora(), estado: "salvando", tentativas: 0, proximaEm: 0 };
      await armazenamento.put(item);
      novos.push(item);
    }
    if (novos.length) avisar({ tipo: "adicionou", quantidade: novos.length });
    return novos;
  }

  async function listar() {
    const t = await armazenamento.getAll();
    return (t || []).sort((a, b) => (b.criadaEm || 0) - (a.criadaEm || 0));
  }

  const mudar = (id, parcial) => armazenamento.atualizar(id, (r) => ({ ...r, ...parcial }));

  async function falhou(item, e) {
    const tentativas = (item.tentativas || 0) + 1;
    const auto = falhaTemporaria(e) && tentativas < MAX_TENTATIVAS_AUTO;
    const espera = ESPERA_TENTATIVA_MIN[Math.min(tentativas - 1, ESPERA_TENTATIVA_MIN.length - 1)] * 60_000;
    const estado = !auto ? "falhou" : item.linhaId ? "salva" : "salvando";
    await mudar(item.id, {
      estado,
      tentativas,
      erro: txt(e?.message || e).slice(0, 200),
      proximaEm: auto ? agora() + espera : 0,
    });
  }

  async function processarUm(item) {
    let atual = item;
    if (atual.estado === "salvando" || (atual.estado === "falhou" && !atual.linhaId)) {
      try {
        const s = await deps.salvarOriginal(atual);
        atual = await mudar(atual.id, { ...s, estado: "salva", erro: "", tentativas: 0, proximaEm: 0 });
        avisar({ tipo: "salva", id: atual.id });
      } catch (e) {
        await falhou(atual, e);
        avisar({ tipo: "falhou", id: atual.id });
        return;
      }
    }
    if (!atual || !atual.linhaId || atual.estado === "pronta") return;
    try {
      atual = await mudar(atual.id, { estado: "tratando", tratandoDesde: agora() });
      avisar({ tipo: "tratando", id: atual.id });
      const t = await deps.tratar(atual);
      await mudar(atual.id, { estado: "pronta", urlTratada: t.urlTratada, baixaResolucao: Boolean(t.baixaResolucao), erro: "", prontaEm: agora(), proximaEm: 0 });
      avisar({ tipo: "pronta", id: atual.id });
    } catch (e) {
      await falhou(atual, e);
      avisar({ tipo: "falhou", id: atual.id });
    }
  }

  /** Uma passada: tudo que está na hora (inclusive "tratando" interrompido por fechar o navegador). */
  async function rodar() {
    if (rodando) return rodando;
    rodando = (async () => {
      try {
        const lista = await listar();
        const t = agora();
        for (const item of lista.reverse()) {
          if (!["salvando", "salva", "tratando"].includes(item.estado)) continue;
          if (item.proximaEm && item.proximaEm > t) continue;
          // outra aba deste aparelho já está tratando (navegador fechado: retoma depois de 3 min)
          if (item.estado === "tratando" && item.tratandoDesde && t - item.tratandoDesde < 180_000) continue;
          await processarUm(item);
        }
        await faxina();
      } finally {
        rodando = null;
      }
    })();
    return rodando;
  }

  async function tentarDeNovo(id) {
    await armazenamento.atualizar(id, (r) => ({ ...r, estado: r.linhaId ? "salva" : "salvando", tentativas: 0, proximaEm: 0, erro: "" }));
    avisar({ tipo: "tentar", id });
    return rodar();
  }

  /** Cópia do aparelho some 24 h depois de pronta (original e tratada continuam na Galeria). */
  async function faxina() {
    const limite = agora() - HORAS_MOSTRAR_PRONTAS * 3600_000;
    for (const item of await listar()) {
      if (item.estado === "pronta" && (item.prontaEm || 0) < limite) await armazenamento.delete(item.id);
    }
  }

  return { adicionar, listar, rodar, tentarDeNovo, faxina };
}

/**
 * Outro aparelho da conta: fotos da câmera que ficaram só com a original (ex.: o celular
 * fechou no meio). Só depois de MINUTOS_OUTRO_APARELHO, até HORAS_RETOMAR, uma vez por
 * abertura (ja: Set). tratar({linhaId, urlOriginal, caminho}).
 */
export async function retomarDeOutrosAparelhos({ supabase, usuarioId, tratar, ja = new Set(), locais = new Set(), agora = Date.now(), limite = 10 }) {
  if (!usuarioId) return { tratadas: 0, falhas: 0 };
  const desde = new Date(agora - HORAS_RETOMAR * 3600_000).toISOString();
  const r = await supabase
    .from("processamentos")
    .select("id, created_at, imagem_original, imagem_processada")
    .eq("user_id", usuarioId)
    .eq("tipo", "foto")
    .like("imagem_original", `%${MARCA_CAMERA}%`)
    .gte("created_at", desde)
    .order("created_at", { ascending: false })
    .limit(50);
  if (r?.error) return { tratadas: 0, falhas: 0, erro: r.error.message };
  const ate = agora - MINUTOS_OUTRO_APARELHO * 60_000;
  const pendentes = (r?.data || []).filter((l) =>
    l.imagem_original && l.imagem_original === l.imagem_processada && ehOriginalCamera(l.imagem_original)
    && Date.parse(l.created_at || 0) <= ate && !ja.has(String(l.id)) && !locais.has(String(l.id)));
  let tratadas = 0;
  let falhas = 0;
  for (const l of pendentes.slice(0, limite)) {
    ja.add(String(l.id));
    try {
      await tratar({ linhaId: l.id, urlOriginal: l.imagem_original, caminho: caminhoDaUrl(l.imagem_original) });
      tratadas += 1;
    } catch {
      falhas += 1;
    }
  }
  return { tratadas, falhas };
}

/** Resumo curto para a tela (confirmação discreta). */
export function resumoCamera(itens) {
  const n = (e) => (itens || []).filter((i) => i.estado === e).length;
  const salvas = (itens || []).filter((i) => i.linhaId).length;
  const andamento = n("salvando") + n("salva") + n("tratando");
  if (!itens?.length) return "";
  const partes = [`✅ ${salvas} foto(s) salva(s) na Galeria`];
  if (andamento) partes.push(`${andamento} em andamento`);
  if (n("pronta")) partes.push(`${n("pronta")} tratada(s)`);
  if (n("falhou")) partes.push(`⚠ ${n("falhou")} com falha no tratamento`);
  return partes.join(" · ");
}
