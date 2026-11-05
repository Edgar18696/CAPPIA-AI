// =============================================================
// PAIIA Voz — (04/11/2026) Ligações reais da “Finalizar anúncio”.
// Leituras: Bling (saldo_por_sku), base PAIIA e Mercado Livre (ml_consulta).
// ESCRITAS: criar no Bling LIBERADO (ação existente do servidor, protegida); publicar no ML e gravar compatibilidades:
// NÃO LIBERADAS nesta versão — devolvem “bloqueado”. Motivo: o código das
// funções do servidor não está no repositório e a proteção contra duplicar
// não foi comprovada. Até lá, a publicação real continua pela rotina atual.
// =============================================================
import { supabase } from "../../../supabase";
import { lerFichaNovoAnuncio } from "../../../services/fichaNovoAnuncioService";
import { fichaFechada } from "../../../services/fichaNovoAnuncio";
import { conferirDuplicidadeBase } from "../../../services/anuncioPublicacaoService";
import { verificarDuplicidadeML, nomeDaLoja } from "../../../services/duplicidadeML";
import { lojaBlingDaConta } from "../../../services/vinculoBlingPublicacao";
import { cadastrarNoBlingVoz, conferirAntesVoz, conferirIncertaVoz } from "./blingCadastroVoz";

const txt = (v) => String(v ?? "").trim();
const NAO_LIBERADO = "Execução real ainda não liberada nesta versão: a proteção do servidor contra duplicidade não foi comprovada. Nada foi enviado.";

async function chamarPublicacao(corpo) {
  if (!corpo?.conta_ml) return { ok: false, erro: "Sem conta Mercado Livre." };
  const { data, error } = await supabase.functions.invoke("mercadolivre-publicacao", { body: corpo });
  if (error) return { ok: false, erro: error.message || "Falha ao falar com o servidor." };
  return data || { ok: false, erro: "Resposta vazia do servidor." };
}
// Mesma função do servidor usada pela Publicação do computador (tokens só no servidor).
async function chamarBling(corpo) {
  const { data, error } = await supabase.functions.invoke("bling-integracao", { body: corpo });
  if (error) throw new Error(error.message || "Falha ao falar com o Bling.");
  return data || { ok: false, erro: "Resposta vazia do Bling." };
}

/** Grava SÓ paiia_voz.finalizacao, com trava de versão (updated_at). */
async function gravarFinalizacao(fichaId, mudar) {
  const r = await lerFichaNovoAnuncio(fichaId);
  if (!r.ok) return { ok: false, erro: r.erro || "Ficha não encontrada." };
  if (fichaFechada(r.ficha)) return { ok: false, erro: "Ficha já publicada ou cancelada." };
  const d = r.ficha.dados_conferencia || {};
  const voz = d.paiia_voz || {};
  const dados = { ...d, paiia_voz: { ...voz, finalizacao: mudar(voz.finalizacao || {}) } };
  const agora = new Date().toISOString();
  const { data, error } = await supabase.from("paiia_anuncios").update({ dados_conferencia: dados, updated_at: agora }).eq("id", fichaId).eq("updated_at", r.ficha.updated_at).select("id");
  if (error) return { ok: false, erro: error.message || "Falha ao gravar." };
  if (!Array.isArray(data) || !data.length) return { ok: false, conflito: true, erro: "A ficha mudou ao mesmo tempo (outro aparelho)." };
  return { ok: true, ficha: { ...r.ficha, dados_conferencia: dados, updated_at: agora } };
}

export const depsFinalizarReais = {
  conferirIncerta: (sku) => conferirIncertaVoz(sku, { chamarBling }),
  lerFicha: lerFichaNovoAnuncio,
  gravarFinalizacao,
  conferir: {
    // (Bling real) confere antes; SKU criado pelo PAIIA só vale com o saldo oficial = estoque da ficha.
    async bling_criar(ctx) { return conferirAntesVoz(ctx, { chamarBling }); },
    async ml_publicar(ctx) {
      const conta = ctx.conta;
      if (ctx.registro.mlb) return { ok: true, feito: true, mlb: ctx.registro.mlb, texto: `Já publicado (${ctx.registro.mlb}).` };
      const base = await conferirDuplicidadeBase({ codigo: ctx.entrada.codigo, sku: ctx.entrada.codigo, contaId: conta });
      if (!base?.ok) return { ok: false, erro: base?.erro || "base PAIIA não conferida" };
      const dela = (base.registros || []).find((p) => txt(p.anuncio_id) === ctx.fichaId && /^MLB\d+$/i.test(txt(p.mlb_id)));
      if (dela) return { ok: true, feito: true, mlb: txt(dela.mlb_id).toUpperCase(), texto: `Esta ficha já tem anúncio (${dela.mlb_id}): não publica de novo.` };
      const ml = await verificarDuplicidadeML({ conta, codigos: [ctx.entrada.codigo], consultar: (caminho) => chamarPublicacao({ acao: "ml_consulta", conta_ml: conta, metodo: "GET", caminho }) });
      if (ml?.erro) return { ok: false, erro: ml.erro };
      if (ml.duplicados.length) return { ok: true, bloqueia: true, texto: `Já existe anúncio deste SKU na ${nomeDaLoja(conta)} (${ml.duplicados.map((d) => d.id).join(", ")}): não publica.` };
      return { ok: true };
    },
    async ml_compat(ctx) {
      if (!ctx.mlb && !ctx.registro.mlb) return { ok: true, bloqueia: true, texto: "Sem anúncio publicado: compatibilidades não gravadas." };
      return { ok: true };
    },
    async bling_vinculo() { return { ok: true }; },
  },
  executar: {
    // (Bling real) ação EXISTENTE criar_produto, com a sua autorização única; sucesso só com releitura.
    async bling_criar(ctx) { return cadastrarNoBlingVoz(ctx.row, { chamarBling }); },
    async ml_publicar() { return { ok: false, bloqueado: true, erro: NAO_LIBERADO }; },
    async ml_compat() { return { ok: false, bloqueado: true, erro: NAO_LIBERADO }; },
    async bling_vinculo(ctx) {
      const loja = lojaBlingDaConta(ctx.conta);
      return { ok: true, texto: loja?.vinculo_automatico ? "LojaOnlineSP: o Bling traz o anúncio sozinho (acompanhar na ficha)." : `${nomeDaLoja(ctx.conta)}: vínculo no Bling é manual (o PAIIA não ativa nada nesta conta).` };
    },
  },
};
