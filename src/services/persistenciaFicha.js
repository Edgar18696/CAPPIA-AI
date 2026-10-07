// =============================================================
// PAIIA — Persistência segura da ficha (funções puras, sem rede).
// Testes: scripts/testes/persistenciaFicha.test.mjs
//
// Regras (07/10/2026):
//  - Tipo de anúncio (Clássico/Premium) pertence à FICHA. A preferência
//    do navegador só sugere o tipo de uma ficha NOVA, sem tipo definido.
//  - Abrir/F5/Voltar/Central/?ficha= é LEITURA: nada é gravado e nenhuma
//    aprovação cai só porque a tela carregou.
//  - Só uma edição real do usuário em campo da Conferência invalida a
//    aprovação.
//  - Conflito de versões: nunca escolher sozinho, nunca descartar nenhuma
//    das versões, nunca mandar dar F5. O usuário escolhe.
// =============================================================

const txt = (v) => String(v ?? "").trim();

// ---------------- Tipo de anúncio ----------------
export function normalizarTipoAnuncio(v) {
  const t = txt(v).toLowerCase();
  if (t === "premium" || t === "gold_pro") return "premium";
  if (t === "classico" || t === "clássico" || t === "gold_special") return "classico";
  return "";
}

/**
 * Tipo de anúncio ao abrir a Conferência.
 * Ordem: o salvo na ficha → o aprovado → o da aprovação guardada → o do
 * anúncio de origem (Novo Anúncio da mesma ficha). A preferência global do
 * navegador só vale para ficha NOVA sem tipo; nunca por cima de uma ficha.
 */
export function tipoAnuncioDaFicha({ fichaSalva = null, anuncio = null, preferencia = "" } = {}) {
  const daFicha =
    normalizarTipoAnuncio(fichaSalva?.campos?.tipoAnuncio) ||
    normalizarTipoAnuncio(fichaSalva?.anuncioConferido?.tipoAnuncio) ||
    normalizarTipoAnuncio(fichaSalva?.aprovacaoAnterior?.anuncioConferido?.tipoAnuncio) ||
    normalizarTipoAnuncio(anuncio?.tipoAnuncio);
  if (daFicha) return daFicha;
  const fichaExiste = Boolean(fichaSalva || txt(anuncio?.fichaIdPAIIA));
  return (!fichaExiste && normalizarTipoAnuncio(preferencia)) || "classico";
}

// ---------------- Comparação de versões ----------------
const num = (v) => {
  const t = txt(v);
  if (!t) return "";
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : t;
};
const urlFoto = (f) => (typeof f === "string" ? f : f?.imagem_processada || f?.imagem_original || f?.url || "");
const fotosDe = (f) => {
  const c = (f?.campos?.fotos || []).map(urlFoto).filter(Boolean);
  return c.length ? c : (f?.anuncioConferido?.fotos || []).map(urlFoto).filter(Boolean);
};
const medida = (m) => (m && typeof m === "object" ? [num(m.peso_g), num(m.comprimento_cm), num(m.largura_cm), num(m.altura_cm)].join("×") : "");

/** Campos comparados entre a versão da tela e a da base (rótulos legíveis). */
const CAMPOS = [
  ["titulo", "Título", (f) => txt(f?.campos?.titulo)],
  ["preco", "Preço", (f) => num(f?.campos?.preco)],
  ["descricao", "Descrição", (f) => txt(f?.campos?.descricao).replace(/\s+/g, " ")],
  ["fotos", "Fotos", (f) => fotosDe(f).join(" ")],
  ["marca", "Marca", (f) => txt(f?.campos?.marca)],
  ["categoria", "Categoria", (f) => txt(f?.campos?.categoriaML?.id)],
  ["compatibilidades", "Compatibilidades", (f) => txt(f?.campos?.compatibilidades).replace(/\s+/g, " ")],
  ["estoque", "Estoque", (f) => num(f?.campos?.quantidadeEstoque)],
  ["tipoVeiculo", "Tipo de veículo", (f) => txt(f?.campos?.tipoVeiculo).replace(/\s*\/\s*/g, "/")],
  ["tipoAnuncio", "Tipo de anúncio", (f) => normalizarTipoAnuncio(f?.campos?.tipoAnuncio || f?.anuncioConferido?.tipoAnuncio)],
  ["condicao", "Condição", (f) => txt(f?.campos?.condicao)],
  ["medidas", "Peso e medidas", (f) => medida(f?.campos?.logistica?.medida || f?.anuncioConferido?.logistica?.medida)],
  ["aprovacao", "Conferência aprovada", (f) => (f?.anuncioConferido && f?.assinaturaAprovada ? "aprovada" : "não aprovada")],
];

/**
 * Diferenças entre a ficha desta tela (cópia local) e a ficha da base.
 * local/base: { campos, anuncioConferido, assinaturaAprovada }.
 * Devolve [{ campo, rotulo, tela, base }]. Campos vazios dos DOIS lados
 * não contam; tipo de anúncio vazio de um lado não conta (fichas antigas).
 */
export function compararVersoesFicha(local, base) {
  const dif = [];
  for (const [campo, rotulo, valor] of CAMPOS) {
    const a = valor(local);
    const b = valor(base);
    if (campo === "tipoAnuncio" && (!a || !b)) continue;
    if (String(a) !== String(b)) dif.push({ campo, rotulo, tela: a, base: b });
  }
  return dif;
}

/**
 * Ao abrir pela base (?ficha=, F5, outro navegador), o que fazer com a
 * cópia deste navegador da MESMA ficha?
 *  - "usar_base": não há cópia local (ou é de outra ficha, ou não é mais nova);
 *  - "mesma_versao": a cópia partiu da versão atual da base (pode ser usada);
 *  - "conteudo_igual": versões diferentes mas mesmo conteúdo (só adota a versão);
 *  - "conflito": a cópia local é mais nova e diferente — NÃO descartar.
 */
export function decidirAberturaFicha({ id, local, baseDados, baseAtualizadaEm = "" }) {
  if (!local || txt(local?.campos?.anuncioIdPAIIA) !== txt(id)) return { acao: "usar_base", diferencas: [] };
  const versaoBase = txt(baseDados?.salvo_em);
  const versaoLocal = txt(local.versaoBase);
  if (versaoBase && versaoLocal === versaoBase) return { acao: "mesma_versao", diferencas: [] };
  const maisNova = txt(local.salvoEm) > (versaoBase || txt(baseAtualizadaEm));
  const diferencas = compararVersoesFicha(local, baseDados?.ficha || {});
  if (!diferencas.length) return { acao: "conteudo_igual", diferencas };
  if (!maisNova) return { acao: "usar_base", diferencas };
  return { acao: "conflito", diferencas };
}

// ---------------- Aprovação ----------------
/**
 * Campos que de fato invalidam a aprovação agora.
 * Só depois de edição REAL do usuário. Campo que já veio diferente no
 * carregamento (normalização, sugestão, formato) só invalida se o usuário
 * mexeu nele depois de carregar (mudaramDesdeCarregamento).
 */
export function camposQueInvalidam({ usuarioEditou, mudou = [], divergentesNoCarregamento = [], mudaramDesdeCarregamento = [] }) {
  if (!usuarioEditou) return [];
  const ja = new Set(divergentesNoCarregamento);
  const mexeu = new Set(mudaramDesdeCarregamento);
  return (Array.isArray(mudou) ? mudou : []).filter((c) => !ja.has(c) || mexeu.has(c));
}

export const TEXTO_CAMPO_ALTERADO = "Este campo foi alterado. A Conferência precisa ser aprovada novamente.";

// ---------------- Indicador e bloqueio ----------------
export const ESTADO_GRAVACAO = Object.freeze({
  SALVANDO: "salvando",
  SALVO: "salvo",
  NAO_SALVO: "nao_salvo",
  CONFLITO: "conflito",
});
export const TEXTO_GRAVACAO = Object.freeze({
  salvando: "Salvando...",
  salvo: "✓ Salvo na base",
  nao_salvo: "⚠ Não salvo",
  conflito: "⚠ Conflito de versões",
});

/** Motivo para bloquear a publicação ("" = pode seguir). */
export function motivoBloqueioPublicacao({ conflito = false, gravacao = "", pendente = false, erroFicha = "", aprovada = true } = {}) {
  if (conflito) return "Esta ficha possui duas versões diferentes: escolha qual manter antes de publicar.";
  if (pendente || gravacao === ESTADO_GRAVACAO.SALVANDO) return "Há alterações ainda não salvas na base: aguarde \"✓ Salvo na base\".";
  if (gravacao === ESTADO_GRAVACAO.NAO_SALVO) return "A última gravação da ficha falhou: a ficha precisa estar salva na base antes de publicar.";
  if (erroFicha) return erroFicha;
  if (!aprovada) return "A Conferência foi invalidada: aprove de novo antes de publicar.";
  return "";
}
