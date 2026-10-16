import { supabase } from "../supabase";
import {
  normalizarSku,
  linhaValida,
  camposAtualizaveis,
  situacaoFinal,
  linhaPublicadaPAIIA,
  linhaConfirmadaUsuario,
} from "./registroMLB";

/*
 * Registro interno de anúncios (public.paiia_registro_mlb) — leitura e
 * gravação. Só esta tabela. NUNCA apaga linha, nunca muda conta/MLB/SKU/
 * origem (o banco também impede) e nunca altera linhas de histórico
 * (encerrado/excluído). Qualquer falha → ok:false (quem chama trata como
 * PENDENTE e bloqueia publicação).
 */
const T = "paiia_registro_mlb";
const COLUNAS = "id, sku, sku_normalizado, sku_confirmado, sku_ml_divergente, ml_user_id, conta_nome, mlb_id, bling_produto_id, situacao, situacao_ml, origem, anuncio_id, conferido_em, updated_at";

async function usuarioAtual() {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id || null;
}
const erroTexto = (e) => String(e?.message || e?.details || e || "falha no registro interno").slice(0, 200);
const duplicado = (e) => String(e?.code || "") === "23505" || /duplicate key|unique/i.test(String(e?.message || ""));

/** Todos os MLBs registrados deste SKU (todas as contas). */
export async function lerRegistroDoSKU(...skus) {
  const chaves = [...new Set(skus.map(normalizarSku).filter(Boolean))];
  if (!chaves.length) return { ok: true, registros: [] };
  try {
    const { data, error } = await supabase.from(T).select(COLUNAS).in("sku_normalizado", chaves);
    if (error) return { ok: false, erro: erroTexto(error) };
    return { ok: true, registros: Array.isArray(data) ? data : [] };
  } catch (e) {
    return { ok: false, erro: erroTexto(e) };
  }
}

async function lerPorMLB(mlb) {
  const { data, error } = await supabase.from(T).select(COLUNAS).eq("mlb_id", String(mlb || "").toUpperCase()).maybeSingle();
  if (error) return { ok: false, erro: erroTexto(error) };
  return { ok: true, registro: data || null };
}

/**
 * Grava UMA linha nova. Se o MLB já estiver registrado (índice único),
 * relê: mesma conta = ok (já registrado); outra conta = conflito (não grava).
 */
export async function registrarLinha(linha) {
  if (!linhaValida(linha)) return { ok: false, erro: "dados inválidos para o registro (SKU, conta ou MLB)" };
  const usuarioId = await usuarioAtual();
  if (!usuarioId) return { ok: false, erro: "sessão expirada" };
  try {
    const { error } = await supabase.from(T).insert({ ...linha, usuario_id: usuarioId });
    if (!error) return { ok: true, novo: true };
    if (!duplicado(error)) return { ok: false, erro: erroTexto(error) };
    const r = await lerPorMLB(linha.mlb_id);
    if (!r.ok) return { ok: false, erro: r.erro };
    if (r.registro && String(r.registro.ml_user_id) === String(linha.ml_user_id)) return { ok: true, novo: false, registro: r.registro };
    return { ok: false, conflito: true, erro: `o MLB ${linha.mlb_id} já está registrado em outra conta (${r.registro?.ml_user_id || "?"})` };
  } catch (e) {
    return { ok: false, erro: erroTexto(e) };
  }
}

/**
 * Atualiza a CONFERÊNCIA de um MLB registrado (situação, data, SKU
 * confirmado, divergência). Nunca toca em linha de histórico.
 */
export async function atualizarConferencia(registro, campos) {
  if (!registro?.mlb_id || situacaoFinal(registro.situacao)) return { ok: true, ignorado: true };
  const dados = camposAtualizaveis(campos);
  if (!Object.keys(dados).length) return { ok: true, ignorado: true };
  try {
    const { error } = await supabase
      .from(T)
      .update(dados)
      .eq("mlb_id", String(registro.mlb_id).toUpperCase())
      .eq("ml_user_id", String(registro.ml_user_id))
      .in("situacao", ["ativo", "pausado", "em_revisao", "inativo", "desconhecida"]);
    return error ? { ok: false, erro: erroTexto(error) } : { ok: true };
  } catch (e) {
    return { ok: false, erro: erroTexto(e) };
  }
}

/** Aplica as gravações decididas pelo reconhecimento (novos + conferências). */
export async function aplicarGravacoesRegistro({ inserir = [], atualizar = [] }) {
  const resultado = { registrados: [], atualizados: 0, falhas: [] };
  for (const l of inserir) {
    const r = await registrarLinha(l);
    if (r.ok) resultado.registrados.push(l.mlb_id);
    else resultado.falhas.push(`${l.mlb_id}: ${r.erro}`);
  }
  for (const { registro, campos } of atualizar) {
    const r = await atualizarConferencia(registro, campos);
    if (r.ok && !r.ignorado) resultado.atualizados += 1;
    else if (!r.ok) resultado.falhas.push(`${registro?.mlb_id}: ${r.erro}`);
  }
  return resultado;
}

/** Anúncio parecido que o USUÁRIO confirmou ser o mesmo produto. */
export function registrarParecidoConfirmado({ sku, conta, contaNome, mlb, status }) {
  return registrarLinha(linhaConfirmadaUsuario({ sku, conta, contaNome, mlb, status }));
}

/**
 * Logo após publicar no ML: registra o MLB novo (até 3 tentativas).
 * Se falhar, o MLB continua salvo na ficha e na publicação, que já
 * bloqueiam nova publicação; a próxima consulta do SKU registra.
 */
export async function registrarPublicadoNoRegistro({ sku, conta, contaNome, mlb, anuncioId, blingProdutoId, esperar = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  const linha = linhaPublicadaPAIIA({ sku, conta, contaNome, mlb, anuncioId, blingProdutoId });
  let ultimo = { ok: false, erro: "não tentado" };
  for (let i = 0; i < 3; i += 1) {
    ultimo = await registrarLinha(linha);
    if (ultimo.ok || ultimo.conflito) return ultimo;
    await esperar(800 * (i + 1));
  }
  return ultimo;
}

/** Depois da verificação pós-publicação SEM pendência: SKU confirmado. */
export async function confirmarSkuPublicado({ mlb, conta }) {
  const r = await lerPorMLB(mlb);
  if (!r.ok || !r.registro) return { ok: false, erro: r.erro || "MLB não registrado" };
  if (String(r.registro.ml_user_id) !== String(conta)) return { ok: false, erro: "conta diferente no registro" };
  if (r.registro.sku_confirmado) return { ok: true, ignorado: true };
  return atualizarConferencia(r.registro, { sku_confirmado: true });
}
