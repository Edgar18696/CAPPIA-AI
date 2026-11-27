// (26/11/2026) PAIIA Parceiros — PILOTO, SÓ NO STAGING.
// Três perfis (garantidos também no banco, por RLS e gatilhos):
//  * administrador: cadastra, aprova, define mensalidade/vigência, ativa, suspende, encerra;
//  * parceiro: atualiza os próprios dados comerciais e envia itens/catálogo para aprovação técnica;
//  * usuário comum: consulta parceiros ativos e itens aprovados e fala direto com o fornecedor.
//    (A cotação simulada abaixo está guardada para o futuro; a tela não a usa — COTACAO_INTERNA_ATIVA.)
// Nunca grava em catalogo_pecas/catalogo_chaves, nunca cobra e nunca envia cotação.
import { supabase, ambienteSupabase, supabaseUrl, supabaseKey } from "../supabase";
import {
  pilotoParceirosAtivo,
  normalizarCodigoParceiro,
  lerListaDeItens,
  limparContatos,
  LIMITE_CATALOGO_BYTES,
} from "../config/parceirosPiloto";

function exigirStaging() {
  if (!pilotoParceirosAtivo(ambienteSupabase)) {
    throw new Error("PAIIA Parceiros: área ainda não liberada neste ambiente.");
  }
}

function falha(contexto, error) {
  return new Error(`${contexto}: ${error?.message || "erro desconhecido"}`);
}

// Dados comerciais: o próprio parceiro pode mudar.
const CAMPOS_COMERCIAIS = [
  "nome_fantasia", "razao_social", "documento", "tipo_empresa", "segmentos", "marcas", "apresentacao",
  "logotipo_url", "site", "whatsapp", "telefone", "email_comercial", "contatos", "catalogo_tipo", "catalogo_url",
  "catalogo_autorizado", "modalidades",
];
// Controle da parceria: só o administrador (o banco recusa se outro tentar).
const CAMPOS_ADMIN = ["situacao", "catalogo_situacao"];

export async function meuPapel() {
  exigirStaging();
  const { data, error } = await supabase.rpc("parceiros_meu_papel");
  if (error) throw falha("Não foi possível identificar o perfil", error);
  return { admin: !!data?.admin, parceiros: data?.parceiros || [] };
}

export async function listarParceiros() {
  exigirStaging();
  const { data, error } = await supabase
    .from("parceiros")
    // controle (critérios/observações): o banco só devolve para o administrador
    .select("*, contrato:parceiro_contratos(*), controle:parceiro_controle(*)")
    .order("nome_fantasia");
  if (error) throw falha("Não foi possível ler os parceiros", error);
  const umSo = (v) => (Array.isArray(v) ? v[0] || null : v || null);
  return (data || []).map((p) => ({ ...p, contrato: umSo(p.contrato), controle: umSo(p.controle) }));
}

export async function salvarParceiro(parceiro, { admin = false } = {}) {
  exigirStaging();
  const registro = {};
  for (const campo of CAMPOS_COMERCIAIS) if (campo in parceiro) registro[campo] = parceiro[campo];
  if ("contatos" in registro) registro.contatos = limparContatos(registro.contatos);
  registro.ficticio = ambienteSupabase !== "producao"; // na produção, cadastro real
  registro.atualizado_em = new Date().toISOString();
  const agora = new Date().toISOString();

  let salvo;
  if (parceiro.id) {
    const { data, error } = await supabase.from("parceiros").update(registro).eq("id", parceiro.id).select().single();
    if (error) throw falha("Não foi possível salvar", error);
    salvo = data;
  } else {
    if (!admin) throw new Error("Somente o administrador cadastra parceiros.");
    const { data, error } = await supabase.from("parceiros").insert({ ...registro, situacao: "em_analise" }).select().single();
    if (error) throw falha("Não foi possível cadastrar", error);
    salvo = data;
  }
  if (!admin) return salvo;

  // Administrador: controle e contrato primeiro (o banco confere os critérios ao ativar).
  const k = parceiro.controle || {};
  const { error: e1 } = await supabase.from("parceiro_controle").upsert({
    parceiro_id: salvo.id,
    criterios: k.criterios || {},
    aprovado_em: k.aprovado_em || null,
    aprovado_por: k.aprovado_por || null,
    observacoes_admin: k.observacoes_admin || null,
    atualizado_em: agora,
  });
  if (e1) throw falha("Dados salvos, mas o controle administrativo não", e1);

  if (parceiro.contrato) {
    const c = parceiro.contrato;
    const { error: e2 } = await supabase.from("parceiro_contratos").upsert({
      parceiro_id: salvo.id,
      mensalidade_centavos: Math.max(0, Math.round(Number(c.mensalidade_centavos) || 0)),
      cobranca_ativa: false,
      experiencia_dias: Math.min(365, Math.max(0, Number.parseInt(c.experiencia_dias, 10) || 0)),
      periodo_meses: Math.min(60, Math.max(1, Number.parseInt(c.periodo_meses, 10) || 12)),
      renovacao_automatica: !!c.renovacao_automatica,
      vigencia_inicio: c.vigencia_inicio || null,
      vigencia_fim: c.vigencia_fim || null,
      suspensao_motivo: parceiro.situacao === "ativo" ? null : c.suspensao_motivo || null,
      atualizado_em: agora,
    });
    if (e2) throw falha("Dados salvos, mas o contrato não", e2);
  }

  const alterarAdmin = {};
  for (const campo of CAMPOS_ADMIN) if (campo in parceiro && parceiro[campo] !== salvo[campo]) alterarAdmin[campo] = parceiro[campo];
  if (Object.keys(alterarAdmin).length) {
    const { data, error } = await supabase.from("parceiros").update(alterarAdmin).eq("id", salvo.id).select().single();
    if (error) throw falha("Dados salvos, mas a situação não", error);
    salvo = data;
  }
  return salvo;
}

/** Rotina de vencimentos (só administrador): renova quem tem renovação automática e suspende quem venceu. */
export async function verificarVencimentos() {
  exigirStaging();
  const { data, error } = await supabase.rpc("parceiros_verificar_vencimentos");
  if (error) throw falha("Não foi possível verificar os vencimentos", error);
  return data || { renovados: 0, suspensos: 0 };
}

/* ---------------- Arquivos ---------------- */
function extensao(nome = "") {
  const m = String(nome).toLowerCase().match(/\.([a-z0-9]{2,5})$/);
  return m ? m[1] : "bin";
}

export async function enviarLogotipo(parceiroId, arquivo) {
  exigirStaging();
  if (!parceiroId) throw new Error("Salve o cadastro antes de enviar o logotipo.");
  if (!arquivo) throw new Error("Escolha a imagem do logotipo.");
  if (!/^image\/(png|jpeg|webp)$/.test(arquivo.type)) throw new Error("Use imagem PNG, JPG ou WEBP.");
  if (arquivo.size > 1024 * 1024) throw new Error("O logotipo deve ter até 1 MB.");
  const caminho = `${parceiroId}/logo-${Date.now()}.${extensao(arquivo.name)}`;
  const { error } = await supabase.storage.from("parceiros-logos").upload(caminho, arquivo, { contentType: arquivo.type });
  if (error) throw falha("Não foi possível enviar o logotipo", error);
  const url = supabase.storage.from("parceiros-logos").getPublicUrl(caminho).data.publicUrl;
  const { error: e2 } = await supabase.from("parceiros").update({ logotipo_url: url }).eq("id", parceiroId);
  if (e2) throw falha("Logotipo enviado, mas não foi ligado ao cadastro", e2);
  return url;
}

const TIPOS_CATALOGO = {
  pdf: "application/pdf",
  csv: "text/csv",
  txt: "text/plain",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};
const PEDACO_RESUMIVEL = 6 * 1024 * 1024; // tamanho exigido pelo envio em partes do Supabase

function base64(texto) {
  return btoa(unescape(encodeURIComponent(texto)));
}

/** Envio em partes (protocolo TUS do Supabase): arquivos grandes sem estourar a memória nem o tempo. */
async function enviarEmPartes(bucket, caminho, arquivo, tipo, aoProgredir) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error("Entre na sua conta para enviar o catálogo.");
  const cabecalho = { authorization: `Bearer ${token}`, apikey: supabaseKey, "tus-resumable": "1.0.0" };
  const criar = await fetch(`${supabaseUrl}/storage/v1/upload/resumable`, {
    method: "POST",
    headers: {
      ...cabecalho,
      "upload-length": String(arquivo.size),
      "x-upsert": "false",
      "upload-metadata": [
        `bucketName ${base64(bucket)}`,
        `objectName ${base64(caminho)}`,
        `contentType ${base64(tipo)}`,
        `cacheControl ${base64("3600")}`,
      ].join(","),
    },
  });
  if (criar.status !== 201) throw new Error(`envio recusado (${criar.status}) ${await criar.text().catch(() => "")}`.trim());
  const destino = new URL(criar.headers.get("location"), supabaseUrl).toString();
  let enviado = 0;
  while (enviado < arquivo.size) {
    const parte = await fetch(destino, {
      method: "PATCH",
      headers: { ...cabecalho, "upload-offset": String(enviado), "content-type": "application/offset+octet-stream" },
      body: arquivo.slice(enviado, enviado + PEDACO_RESUMIVEL),
    });
    if (parte.status !== 204) throw new Error(`parte recusada (${parte.status}) ${await parte.text().catch(() => "")}`.trim());
    enviado = Number(parte.headers.get("upload-offset")) || enviado + PEDACO_RESUMIVEL;
    aoProgredir?.(Math.min(1, enviado / arquivo.size));
  }
}

export async function enviarArquivoCatalogo(parceiroId, arquivo, aoProgredir) {
  exigirStaging();
  if (!parceiroId) throw new Error("Salve o cadastro antes de enviar o catálogo.");
  if (!arquivo) throw new Error("Escolha o arquivo do catálogo.");
  const ext = extensao(arquivo.name);
  const tipo = TIPOS_CATALOGO[ext];
  if (!tipo) throw new Error("Use PDF, CSV, XLS ou XLSX.");
  if (arquivo.size > LIMITE_CATALOGO_BYTES) throw new Error(`O catálogo deve ter até ${LIMITE_CATALOGO_BYTES / 1024 / 1024} MB.`);
  const nome = String(arquivo.name || "catalogo").normalize("NFD").replace(/[^\w.-]+/g, "_").slice(-80);
  const caminho = `${parceiroId}/${Date.now()}-${nome}`;
  try {
    if (arquivo.size > PEDACO_RESUMIVEL) {
      await enviarEmPartes("parceiros-catalogos", caminho, arquivo, tipo, aoProgredir);
    } else {
      const { error } = await supabase.storage.from("parceiros-catalogos").upload(caminho, arquivo, { contentType: tipo });
      if (error) throw error;
      aoProgredir?.(1);
    }
  } catch (e) {
    if (/413|maximum size|too large|exceed/i.test(String(e?.message || e?.statusCode || ""))) {
      throw new Error(
        "O arquivo passa do limite aceito hoje pelo servidor do PAIIA (50 MB por arquivo). " +
          "Envie a planilha do catálogo ou divida o PDF em partes menores.",
        { cause: e }
      );
    }
    throw falha("Não foi possível enviar o catálogo", e);
  }
  // O banco põe o catálogo como "pendente" (aprovação técnica) quando quem envia é o parceiro.
  const { error: e2 } = await supabase.from("parceiros").update({ catalogo_arquivo: caminho, catalogo_situacao: "pendente" }).eq("id", parceiroId);
  if (e2) throw falha("Arquivo enviado, mas não foi ligado ao cadastro", e2);
  return caminho;
}

export async function linkArquivoCatalogo(caminho) {
  exigirStaging();
  const { data, error } = await supabase.storage.from("parceiros-catalogos").createSignedUrl(caminho, 600);
  if (error) throw falha("Não foi possível abrir o catálogo", error);
  return data.signedUrl;
}

export async function definirSituacaoCatalogo(parceiroId, situacao) {
  exigirStaging();
  const { error } = await supabase.from("parceiros").update({ catalogo_situacao: situacao }).eq("id", parceiroId);
  if (error) throw falha("Não foi possível registrar a análise do catálogo", error);
}

/* ---------------- Itens do catálogo ---------------- */
export async function listarItensDoParceiro(parceiroId, filtro = "") {
  exigirStaging();
  let consulta = supabase.from("parceiro_catalogo_itens").select("*").eq("parceiro_id", parceiroId).order("codigo").limit(300);
  const n = normalizarCodigoParceiro(filtro);
  // filtro por código, descrição ou aplicação (sem caracteres que quebram o filtro)
  const texto = String(filtro || "").replace(/[,()*%\\]/g, " ").trim();
  if (n) consulta = consulta.or(`codigo_normalizado.like.*${n}*,descricao.ilike.*${texto}*,aplicacao.ilike.*${texto}*`);
  const { data, error } = await consulta;
  if (error) throw falha("Não foi possível ler o catálogo do parceiro", error);
  return data || [];
}

/** Itens enviados (um ou vários). Parceiro: ficam pendentes. Administrador: já entram aprovados. */
/**
 * Itens enviados (um, vários ou extraídos do catálogo). SEMPRE entram pendentes:
 * até os do administrador passam pela aprovação técnica (botão "Aprovar todos").
 */
export async function enviarItens(parceiroId, itens, { origem = "lista" } = {}) {
  exigirStaging();
  const vistos = new Set();
  const linhas = [];
  for (const i of itens || []) {
    const codigo = String(i.codigo || "").trim();
    const chave = normalizarCodigoParceiro(codigo);
    if (!chave || vistos.has(chave)) continue;
    vistos.add(chave);
    linhas.push({
      parceiro_id: parceiroId,
      codigo,
      codigo_normalizado: chave,
      descricao: i.descricao || null,
      marca: i.marca || null,
      segmento: i.segmento || null,
      aplicacao: i.aplicacao || null,
      equivalencias: Array.isArray(i.equivalencias) ? i.equivalencias.slice(0, 80) : [],
      origem: i.origem || origem,
      situacao_tecnica: "pendente",
    });
  }
  if (!linhas.length) throw new Error("Informe ao menos um código.");
  let total = 0;
  for (let n = 0; n < linhas.length; n += 500) {
    const { error, count } = await supabase
      .from("parceiro_catalogo_itens")
      .upsert(linhas.slice(n, n + 500), { onConflict: "parceiro_id,codigo_normalizado", count: "exact" });
    if (error) throw falha(`Não foi possível enviar os itens (a partir do ${n + 1}º)`, error);
    total += count ?? Math.min(500, linhas.length - n);
  }
  return total;
}

export function enviarListaColada(parceiroId, texto) {
  return enviarItens(parceiroId, lerListaDeItens(texto), { origem: "lista" });
}

/** Aprova de uma vez os itens pendentes do parceiro (só administrador). */
export async function aprovarItensPendentes(parceiroId) {
  exigirStaging();
  const { data, error } = await supabase.rpc("parceiros_aprovar_pendentes", { p_parceiro: parceiroId });
  if (error) throw falha("Não foi possível aprovar os itens", error);
  return data || 0;
}

export async function analisarItem(itemId, situacao, motivo = "") {
  exigirStaging();
  const { error } = await supabase
    .from("parceiro_catalogo_itens")
    .update({ situacao_tecnica: situacao, analise_motivo: motivo || null })
    .eq("id", itemId);
  if (error) throw falha("Não foi possível registrar a análise", error);
}

export async function removerItem(itemId) {
  exigirStaging();
  const { error } = await supabase.from("parceiro_catalogo_itens").delete().eq("id", itemId);
  if (error) throw falha("Não foi possível remover o item", error);
}

/** Itens APROVADOS de parceiros com algum dos códigos (exato ou nos relacionados). */
export async function itensDeParceirosPorCodigos(codigos = []) {
  exigirStaging();
  if (!codigos.length) return [];
  const [exatos, relacionados] = await Promise.all([
    supabase.from("parceiro_catalogo_itens").select("*").eq("situacao_tecnica", "aprovado").in("codigo_normalizado", codigos).limit(200),
    supabase.from("parceiro_catalogo_itens").select("*").eq("situacao_tecnica", "aprovado").overlaps("codigos_relacionados", codigos).limit(200),
  ]);
  if (exatos.error) throw exatos.error;
  if (relacionados.error) throw relacionados.error;
  const porId = new Map();
  for (const item of [...(exatos.data || []), ...(relacionados.data || [])]) porId.set(item.id, item);
  return [...porId.values()];
}

/** Itens APROVADOS de parceiros visíveis pela descrição/aplicação (todas as palavras, sem acento). */
export async function itensDeParceirosPorTexto(termo) {
  exigirStaging();
  const t = String(termo || "").trim();
  if (!t) return [];
  const { data, error } = await supabase.rpc("parceiros_buscar_texto", { p_termo: t });
  if (error) throw error;
  return data || [];
}

/**
 * Validação técnica automática (feita no banco): para cada item, o nível
 * (sem_divergencia | conferir | conflito) e os motivos. Só administrador e o próprio parceiro.
 */
export async function validacaoDoCatalogo(parceiroId) {
  exigirStaging();
  const { data, error } = await supabase.rpc("parceiros_validacao_itens", { p_parceiro: parceiroId });
  if (error) throw falha("Não foi possível validar o catálogo", error);
  return new Map((data || []).map((v) => [v.item_id, { nivel: v.nivel, motivos: v.motivos || [] }]));
}

/* ---------------- Contas vinculadas (administrador) ---------------- */
export async function contasDoParceiro(parceiroId) {
  exigirStaging();
  const { data, error } = await supabase.rpc("parceiros_contas_do_parceiro", { p_parceiro: parceiroId });
  if (error) throw falha("Não foi possível ler as contas", error);
  return data || [];
}

export async function vincularConta(parceiroId, email) {
  exigirStaging();
  const { error } = await supabase.rpc("parceiros_vincular_usuario", { p_parceiro: parceiroId, p_email: email });
  if (error) throw falha("Não foi possível vincular", error);
}

export async function desvincularConta(parceiroId, userId) {
  exigirStaging();
  const { error } = await supabase.rpc("parceiros_desvincular_usuario", { p_parceiro: parceiroId, p_user: userId });
  if (error) throw falha("Não foi possível desvincular", error);
}

/* ---------------- Cotações (sempre simuladas) ---------------- */
export async function registrarCotacaoSimulada({ parceiroId, codigo, quantidade, mensagem }) {
  exigirStaging();
  const qtd = Number.parseInt(quantidade, 10);
  if (!qtd || qtd < 1) throw new Error("Informe a quantidade.");
  const { data, error } = await supabase
    .from("parceiro_cotacoes")
    .insert({ parceiro_id: parceiroId, codigo, quantidade: qtd, mensagem: mensagem || null, situacao: "simulada" })
    .select()
    .single();
  if (error) throw falha("Não foi possível registrar a simulação", error);
  return data;
}

/** Usuário: as próprias. Parceiro: as recebidas. Administrador: todas do parceiro. */
export async function listarCotacoesSimuladas(parceiroId) {
  exigirStaging();
  const { data, error } = await supabase
    .from("parceiro_cotacoes")
    .select("*")
    .eq("parceiro_id", parceiroId)
    .order("criado_em", { ascending: false })
    .limit(20);
  if (error) throw falha("Não foi possível ler as cotações", error);
  return data || [];
}
