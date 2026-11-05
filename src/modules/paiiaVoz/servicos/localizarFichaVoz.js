// =============================================================
// PAIIA Voz — (Passo 7) "Ler de novo": diagnóstico CLARO de por que a ficha
// do rascunho não aparece na conta atual. Só leitura: não cria, não apaga,
// não mexe no rascunho nem nas fotos do aparelho.
//  - sem sessão      → "sessao"  (a leitura sem login sempre parece "não encontrada")
//  - ficha lida      → "encontrada"
//  - não encontrada  → "nao-encontrada", com as fichas DESTA conta que têm o
//                      mesmo código (para reaproveitar em vez de duplicar)
//  - falha           → "erro" com a mensagem
// =============================================================
const txt = (v) => String(v ?? "").trim();

export async function diagnosticarFichaVoz({ fichaId = "", codigo = "" } = {}, deps) {
  const em = new Date().toISOString();
  let usuario;
  try {
    const u = await deps.usuarioAtual();
    usuario = u?.id ? { id: String(u.id), email: txt(u.email) } : null;
  } catch {
    usuario = null;
  }
  if (!usuario) return { estado: "sessao", em, fichaId, usuario: null, candidatas: [] };
  let r;
  try { r = await deps.lerFicha(fichaId); } catch (e) { r = { ok: false, erro: e?.message || String(e) }; }
  if (r?.ok) return { estado: "encontrada", em, fichaId, usuario, candidatas: [] };
  if (!r?.naoEncontrada) return { estado: "erro", em, fichaId, usuario, candidatas: [], erro: r?.erro || "Falha ao ler a ficha." };
  let candidatas = [];
  if (txt(codigo)) {
    try {
      const l = await deps.listarPorCodigo(codigo);
      candidatas = (l?.ok ? l.anuncios || [] : [])
        .filter((a) => a?.id && a.id !== fichaId && !a.publicacao?.mlb_id && !["publicado", "cancelado"].includes(String(a.status_fluxo || "")))
        .map((a) => ({ id: String(a.id), titulo: txt(a.titulo), status: txt(a.status_fluxo), atualizada: a.updated_at || "" }));
    } catch {
      candidatas = [];
    }
  }
  return { estado: "nao-encontrada", em, fichaId, usuario, candidatas };
}

/** Texto do resultado, para a tela (sem dados sensíveis além do e-mail da própria conta). */
export function textoDiagnostico(d) {
  const hora = d?.em ? new Date(d.em).toLocaleTimeString("pt-BR") : "";
  if (!d) return "";
  if (d.estado === "sessao") return `Lido às ${hora}: você não está com o login ativo neste aparelho. Entre de novo no PAIIA — o rascunho e as fotos continuam guardados aqui.`;
  if (d.estado === "encontrada") return `Lido às ${hora}: ficha ${String(d.fichaId).slice(0, 8)} encontrada na conta ${d.usuario?.email || ""}.`;
  if (d.estado === "erro") return `Lido às ${hora}: não consegui consultar a conta (${d.erro}). Nada foi alterado; tente de novo.`;
  return `Lido às ${hora}: a ficha ${String(d.fichaId).slice(0, 8)} NÃO existe na conta ${d.usuario?.email || ""} (foi excluída ou é de outro login). `
    + (d.candidatas.length ? `Esta conta tem ${d.candidatas.length} ficha(s) com o mesmo código, sem publicação.` : "Esta conta não tem outra ficha com esse código.");
}
