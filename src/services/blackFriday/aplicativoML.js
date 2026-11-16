// =============================================================
// PAIIA — Black Friday 2026: IDENTIFICAR O APLICATIVO DO MERCADO LIVRE
// usado pelo PAIIA (16/11/2026). SÓ LEITURA, só na tela local.
//
// De onde vem cada dado (nada é gravado, nada é renovado):
//   - App ID: da URL oficial de autorização que a função publicada
//     "mercadolivre-oauth" (ação url_autorizacao) já monta com o segredo
//     ML_CLIENT_ID. O App ID (client_id) é PÚBLICO: aparece em toda URL de
//     autorização do ML. O Client Secret NUNCA sai do servidor.
//     A tela NÃO abre essa URL (não inicia autorização nem reconexão).
//   - Escopos salvos: ação "status" da mesma função (lista SEM tokens).
//   - Autorização no ML e cadastro do aplicativo: função paizinho-bf-leitura
//     (resumos seguros, id mascarado).
// =============================================================
import { CONTAS_BLACK_FRIDAY } from "./contas.js";

const txt = (v) => (v === null || v === undefined ? "" : String(v)).trim();
const ultimos4 = (v) => txt(v).replace(/\D/g, "").slice(-4);

/** Da URL de autorização, só o App ID (público) e o domínio de retorno. Nada mais. */
export function aplicativoDaUrl(url) {
  try {
    const u = new URL(txt(url));
    const appId = txt(u.searchParams.get("client_id"));
    let retorno = "";
    try { retorno = new URL(txt(u.searchParams.get("redirect_uri"))).host; } catch { retorno = ""; }
    return /^\d{6,}$/.test(appId) ? { ok: true, app_id: appId, retorno_host: retorno, autorizacao_host: u.host } : { ok: false, erro: "A URL de autorização não trouxe um App ID numérico." };
  } catch {
    return { ok: false, erro: "URL de autorização inválida." };
  }
}

async function chamar(invocar, nome, body) {
  try {
    const { data, error } = await invocar(nome, { body });
    if (error) {
      let erro = error.message;
      try { const c = await error.context?.json?.(); if (c?.erro) erro = c.erro; } catch { /* mantém */ }
      return { ok: false, status: error.context?.status, erro };
    }
    return data && typeof data === "object" ? data : { ok: false, erro: "Resposta vazia do servidor." };
  } catch (e) {
    return { ok: false, erro: txt(e?.message || e) };
  }
}

/**
 * Lê tudo o que dá para saber do aplicativo SEM alterar nada.
 * @param {{ invocar: Function, consultorDaConta: (conta: string) => (caminho: string) => Promise<any>, contas?: Array<{id: string, nome: string}> }} p
 */
export async function identificarAplicativo({ invocar, consultorDaConta, contas = CONTAS_BLACK_FRIDAY }) {
  // 1) App ID público (a URL NÃO é aberta; state fixo de diagnóstico, sem PKCE, nada gravado).
  const url = await chamar(invocar, "mercadolivre-oauth", { acao: "url_autorizacao", state: "diagnostico-bf-somente-leitura" });
  const app = url?.ok && url?.url ? aplicativoDaUrl(url.url) : { ok: false, erro: txt(url?.erro) || "Não foi possível ler a URL de autorização." };

  // 2) Escopos que o PAIIA guardou na conexão de cada conta (sem tokens).
  const st = await chamar(invocar, "mercadolivre-oauth", { acao: "status" });
  const salvas = Array.isArray(st?.contas) ? st.contas : [];

  // 3) Por conta: autorização dada ao PAIIA no ML e leitura do cadastro do aplicativo.
  const porConta = [];
  for (const c of contas) {
    const ler = consultorDaConta(c.id);
    const [aut, cad] = await Promise.all([ler(`/users/${c.id}/applications`), ler("/applications/paiia")]);
    const salva = salvas.find((x) => txt(x.ml_user_id) === c.id) || null;
    const nossa = aut?.ok ? aut?.dados?.paiia : null;
    porConta.push({
      conta: c.nome,
      id: c.id,
      conexao: salva ? { status: salva.status || "conectada", escopos_salvos: txt(salva.scopes) || null, conectado_em: salva.conectado_em || null, renovado_em: salva.ultima_renovacao_em || null } : null,
      autorizacao: aut?.ok
        ? { ok: true, encontrada: !!nossa, escopos: nossa?.scopes || null, data: nossa?.data || null, final_app: ultimos4(nossa?.app_id), total: aut?.dados?.autorizacoes_na_conta ?? null }
        : { ok: false, status: aut?.status || null, erro: txt(aut?.erro), recusa_ml: aut?.recusa_ml || null },
      cadastro: cad?.ok
        ? { ok: true, nome: txt(cad?.dados?.name) || null, final_app: ultimos4(cad?.dados?.id), campos: Object.keys(cad?.dados || {}).filter((k) => k !== "id"), dados: cad?.dados }
        : { ok: false, status: cad?.status || null, erro: txt(cad?.erro), recusa_ml: cad?.recusa_ml || null },
    });
  }
  return { app, porConta, conclusoes: concluirAplicativo(app, porConta) };
}

/**
 * (16/11) Caminho B: o próprio aplicativo lê o seu cadastro (pela paizinho-bf-leitura).
 * Enquanto a versão nova da função não estiver publicada, o servidor recusa o endereço
 * ("Leitura não permitida") e a tela avisa isso, sem tentar outro caminho.
 */
export async function lerDonoPeloAplicativo({ consultar }) {
  const r = await consultar("/applications/paiia/dono");
  if (r?.ok) {
    const d = r.dados || {};
    const dono = (d.donos || [])[0] || null;
    return {
      ok: true,
      nome: txt(d.name) || null,
      final_app: ultimos4(d.id),
      dono,
      donos: d.donos || [],
      dados: d,
      conclusao: dono
        ? `COMPROVADO pelo próprio ML: o dono do aplicativo é ${dono.conta ? `a conta ${dono.conta}` : "uma conta FORA das 3 da campanha"} (usuário ML ${dono.id}). Entre no painel de desenvolvedores com ${dono.conta || "essa conta"}.`
        : `O ML devolveu o cadastro, mas sem campo de dono (campos: ${(d.campos_recebidos || []).join(", ") || "nenhum"}). Seguir pelo painel ou pelo e-mail de criação.`,
    };
  }
  const naoPublicado = /Leitura não permitida/i.test(txt(r?.erro));
  return {
    ok: false,
    status: r?.status || null,
    erro: naoPublicado ? "Caminho B ainda não publicado na função paizinho-bf-leitura (precisa da sua autorização)." : txt(r?.erro),
    recusa_ml: r?.recusa_ml || null,
    nao_publicado: naoPublicado,
  };
}

/** Conclusões em linguagem simples, separando o que é COMPROVADO do que é só INDÍCIO. */
export function concluirAplicativo(app, porConta) {
  const out = [];
  const final = app?.ok ? ultimos4(app.app_id) : "";
  if (app?.ok) out.push({ tipo: "comprovado", texto: `O PAIIA usa o aplicativo do Mercado Livre de App ID ${app.app_id} (final ${final}). É o mesmo usado para conectar e renovar as 3 contas.` });
  else out.push({ tipo: "falha", texto: `Não foi possível ler o App ID: ${app?.erro || "sem resposta"}.` });

  const nome = porConta.find((p) => p.cadastro.ok && p.cadastro.nome)?.cadastro.nome;
  if (nome) out.push({ tipo: "comprovado", texto: `Nome do aplicativo no ML: "${nome}". No painel de desenvolvedores, procure exatamente este nome e o App ID ${app?.app_id || `final ${final}`}.` });

  const aut = porConta.filter((p) => p.autorizacao.ok);
  const com = aut.filter((p) => p.autorizacao.encontrada);
  if (aut.length) out.push({ tipo: "comprovado", texto: `Autorização ao aplicativo encontrada em ${com.length} de ${aut.length} conta(s) lidas${com.length ? ` (${com.map((p) => `${p.conta}: ${(p.autorizacao.escopos || []).join(", ") || "escopos não informados"}`).join(" · ")})` : ""}.` });

  const lidos = porConta.filter((p) => p.cadastro.ok).map((p) => p.conta);
  const recusados = porConta.filter((p) => !p.cadastro.ok).map((p) => `${p.conta} (${p.cadastro.status ? `HTTP ${p.cadastro.status}` : p.cadastro.erro})`);
  if (lidos.length && recusados.length) out.push({ tipo: "indicio", texto: `Só ${lidos.join(", ")} conseguiu ler o cadastro do aplicativo; ${recusados.join(", ")} não. INDÍCIO (não prova) de que ${lidos.length === 1 ? "essa conta é a dona" : "a dona está entre elas"}: confirme no painel de desenvolvedores com ela.` });
  else if (lidos.length) out.push({ tipo: "inconclusivo", texto: "As 3 contas leem o cadastro do aplicativo: essa leitura não revela a dona. Confirme no painel de desenvolvedores, entrando com cada conta e procurando o App ID." });
  else if (recusados.length) out.push({ tipo: "indicio", texto: `Nenhuma das 3 contas lê o cadastro do aplicativo (${recusados.join(", ")}). INDÍCIO de que a dona é OUTRA conta (nem LOJA ONLINE, nem REVELAÇÃO, nem CIEBR).` });
  return out;
}

/** Texto para copiar: sem segredo, sem token (o App ID é público). */
export function textoAplicativo(r) {
  const l = ["IDENTIFICAÇÃO DO APLICATIVO ML DO PAIIA (somente leitura)"];
  l.push(r.app?.ok ? `App ID: ${r.app.app_id} · retorno: ${r.app.retorno_host || "?"}` : `App ID: não lido (${r.app?.erro})`);
  for (const p of r.porConta) {
    l.push(`— ${p.conta}`);
    l.push(`  Conexão no PAIIA: ${p.conexao ? `${p.conexao.status}; escopos salvos: ${p.conexao.escopos_salvos || "não informados"}; conectada em ${p.conexao.conectado_em || "?"}` : "não encontrada"}`);
    l.push(`  Autorização no ML: ${p.autorizacao.ok ? (p.autorizacao.encontrada ? `encontrada (final ${p.autorizacao.final_app}); escopos: ${(p.autorizacao.escopos || []).join(", ")}; desde ${p.autorizacao.data || "?"}` : `não encontrada entre ${p.autorizacao.total ?? "?"} autorizações`) : `falhou (${p.autorizacao.status || ""} ${p.autorizacao.erro})`}`);
    l.push(`  Cadastro do aplicativo: ${p.cadastro.ok ? `lido; nome: ${p.cadastro.nome || "?"}; final ${p.cadastro.final_app}; campos: ${p.cadastro.campos.join(", ")}; ${JSON.stringify(p.cadastro.dados).slice(0, 1500)}` : `recusado (${p.cadastro.status || ""} ${p.cadastro.erro}${p.cadastro.recusa_ml ? `; ML: ${[p.cadastro.recusa_ml.codigo, ...(p.cadastro.recusa_ml.causa || [])].filter(Boolean).join(", ")}` : ""})`}`);
  }
  l.push("Conclusões:");
  for (const c of r.conclusoes) l.push(`  [${c.tipo}] ${c.texto}`);
  return l.join("\n");
}

/**
 * (16/11) Teste de promoções de UMA conta, com o token DESTA conta (no servidor,
 * pela paizinho-bf-leitura). Uma única consulta GET; sem cache de recusa.
 * Resultado objetivo: "autorizada" ou o motivo técnico exato do bloqueio.
 */
export async function testarPromocoesConta({ conta, consultar }) {
  const c = CONTAS_BLACK_FRIDAY.find((x) => x.id === txt(conta));
  const caminho = `/seller-promotions/users/${txt(conta)}?app_version=v2`;
  const r = await consultar(caminho);
  const base = { conta: c?.nome || txt(conta), id: txt(conta), caminho, status: r?.status || null, via: r?.via || null };
  if (r?.ok) {
    const lista = Array.isArray(r.dados?.results) ? r.dados.results : Array.isArray(r.dados) ? r.dados : [];
    const tipos = [...new Set(lista.map((p) => txt(p?.type)).filter(Boolean))];
    return { ...base, ok: true, resultado: "autorizada", promocoes: lista.length, tipos, texto: `Consulta de promoções AUTORIZADA para ${base.conta}: ${lista.length} promoção(ões) disponível(is)${tipos.length ? ` (${tipos.join(", ")})` : ""}.` };
  }
  const codigo = txt(r?.recusa_ml?.codigo);
  const msg = txt(r?.recusa_ml?.mensagem || r?.erro);
  const st = Number(r?.status);
  let motivo;
  if (st === 403 && /policy returned UNAUTHORIZED|PA_UNAUTHORIZED/i.test(`${msg} ${codigo} ${(r?.recusa_ml?.causa || []).join(" ")}`)) motivo = "Falta a permissão funcional \"Promoções, cupons e descontos\" no aplicativo Paiia (App ID 1283127548197864). Habilitar no DevCenter da conta dona (CIEBR) e testar de novo, sem reconectar.";
  else if (st === 401 && /vencido/i.test(msg)) motivo = "Token desta conta vencido no PAIIA (credencial, não permissão). Abra Contas Marketplace no PAIIA para renovar e teste de novo.";
  else if (st === 401) motivo = "Token desta conta recusado pelo ML (credencial inválida ou revogada), não é permissão do aplicativo.";
  else if (st === 404 && /não conectada/i.test(msg)) motivo = "Conta não conectada para o seu usuário no PAIIA.";
  else if (st === 403) motivo = "Recusa do ML diferente da permissão do aplicativo: ver mensagem e código abaixo.";
  else motivo = "Falha técnica na consulta: ver mensagem abaixo.";
  return { ...base, ok: false, resultado: "bloqueada", codigo: codigo || null, mensagem: msg, causa: r?.recusa_ml?.causa || [], motivo, texto: `Consulta de promoções BLOQUEADA para ${base.conta} (HTTP ${st || "?"}${codigo ? `, ${codigo}` : ""}): ${motivo}` };
}
