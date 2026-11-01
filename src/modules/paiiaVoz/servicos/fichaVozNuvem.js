// =============================================================
// PAIIA Voz — FICHA NA CONTA (31/10/2026): celular ⇄ computador.
//   Testes: scripts/testes/paiiaVozFichaNuvem.test.mjs
//
// O que faz (sem criar nada paralelo):
//  • assim que o código é informado, cria/atualiza A MESMA ficha do Novo
//    Anúncio (paiia_anuncios, pela salvarFichaNovoAnuncio de sempre);
//  • envia cada foto ORIGINAL uma única vez ao armazenamento "imagens"
//    (o mesmo envio do Foto IA — a fila do fundo branco reaproveita esse
//    envio, sem mandar a foto de novo);
//  • quando o fundo branco fica pronto, envia a versão 1200×1200 e troca,
//    na ficha, a foto original pela tratada (a original continua guardada
//    no armazenamento e listada em paiia_voz.fotos);
//  • o computador abre a ficha pela Central e já vê código, título,
//    descrição e fotos.
// Regras: nunca sobrescreve no computador o que foi editado lá (título,
// descrição, código, fotos retiradas); ficha publicada/cancelada/na
// Conferência não é alterada; falha de envio não apaga nada (a foto
// continua no aparelho e é enviada na próxima tentativa).
// Sem SQL, sem tabela nova, sem Mercado Livre, sem Bling.
// =============================================================

import { fichaSoNoNovoAnuncio } from "../../../services/fichaNovoAnuncio.js";

export const LIMITE_FOTOS_FICHA = 6; // mesmo limite do Novo Anúncio
const txt = (v) => String(v ?? "").trim();

/** Envia a original uma vez só (também usado pela fila do fundo branco). */
const ENVIOS = new Map(); // id da foto → Promise (evita dois envios simultâneos)
export async function garantirOriginalNaNuvem(reg, { guarda, enviarOriginal }) {
  if (reg?.nuvem?.original?.url) return reg.nuvem.original;
  if (reg?.ia?.caminhoOriginal && reg?.ia?.urlOriginal) {
    const original = { caminho: reg.ia.caminhoOriginal, url: reg.ia.urlOriginal };
    await guarda.salvarNuvem(reg.id, { original });
    return original;
  }
  if (!ENVIOS.has(reg.id)) {
    ENVIOS.set(reg.id, (async () => {
      try {
        const envio = await enviarOriginal(reg);
        const original = { caminho: envio.caminho, url: envio.url };
        await guarda.salvarNuvem(reg.id, { original });
        return original;
      } finally {
        ENVIOS.delete(reg.id);
      }
    })());
  }
  return ENVIOS.get(reg.id);
}

/** Envia a versão com fundo branco (uma vez por tratamento). */
export async function garantirTratadaNaNuvem(reg, { guarda, enviarTratada }) {
  if (!reg?.tratada?.blob) return null;
  const em = reg.tratada.em || 0;
  if (reg?.nuvem?.tratada?.url && reg.nuvem.tratada.em === em) return reg.nuvem.tratada;
  const envio = await enviarTratada(reg);
  const tratada = { caminho: envio.caminho, url: envio.url, em };
  await guarda.salvarNuvem(reg.id, { tratada });
  return tratada;
}

/** Endereço que vai ao anúncio: tratada (se escolhida/automática e enviada) ou original. */
export function urlNoAnuncio(reg) {
  const usarTratada = reg?.versao === "tratada" && reg?.tratada?.blob && reg?.nuvem?.tratada?.url;
  return usarTratada ? reg.nuvem.tratada.url : reg?.nuvem?.original?.url || "";
}

/**
 * Junta as fotos do Voz com as que já estão na ficha, sem desfazer o que
 * foi feito no computador.
 * @param atuais     fotos da ficha agora (endereços)
 * @param sincAntes  { [idFoto]: endereço que o Voz gravou da última vez }
 * @param vozFotos   [{ id, url, usar }] na ordem do Voz
 */
export function juntarFotos(atuais, sincAntes, vozFotos, limite = LIMITE_FOTOS_FICHA) {
  const lista = (Array.isArray(atuais) ? atuais : []).map(txt).filter(Boolean);
  const antes = sincAntes && typeof sincAntes === "object" ? sincAntes : {};
  const sinc = {};
  for (const f of vozFotos) {
    const anterior = txt(antes[f.id]);
    const pos = anterior ? lista.indexOf(anterior) : -1;
    if (!f.usar || !f.url) {
      // desmarcada no Voz: sai da ficha (só a que o próprio Voz pôs)
      if (pos >= 0) lista.splice(pos, 1);
      continue;
    }
    if (pos >= 0) {
      lista[pos] = f.url; // original → tratada, no mesmo lugar
      sinc[f.id] = f.url;
    } else if (anterior) {
      // o Voz já tinha posto e ela foi retirada no computador: não volta
      sinc[f.id] = anterior;
    } else if (!lista.includes(f.url) && lista.length < limite) {
      lista.push(f.url);
      sinc[f.id] = f.url;
    }
  }
  return { fotos: [...new Set(lista)], sinc };
}

/** Texto: o Voz só grava se o campo estiver vazio ou ainda for o que ele mesmo gravou. */
export function juntarTexto(atual, gravadoAntes, voz) {
  const a = txt(atual);
  const v = txt(voz);
  if (!v) return { valor: a, conflito: false };
  if (!a || a === txt(gravadoAntes) || a === v) return { valor: v, conflito: false };
  return { valor: a, conflito: true }; // editado no computador: fica o do computador
}

/**
 * Sincroniza a ficha do Voz com a ficha da conta.
 * deps: { guarda, enviarOriginal(reg), enviarTratada(reg), lerFicha(id), salvarFicha(args), usuarioId }
 * voz:  { fichaVozId, fichaIdPAIIA, codigo, titulo, descricao, preco, oem }
 */
export async function sincronizarFichaVoz(voz, regs, deps) {
  if (!deps?.usuarioId) return { ok: false, estado: "sem-login", erro: "Entre na sua conta para salvar a ficha e as fotos." };
  const codigo = txt(voz.codigo);
  if (!codigo && !voz.fichaIdPAIIA) return { ok: false, estado: "aguardando-codigo" };

  // 1) Fotos para a nuvem (cada falha fica só nesta foto; nada é apagado)
  const erros = [];
  const vozFotos = [];
  for (const reg0 of regs) {
    let reg = reg0;
    try {
      const original = await garantirOriginalNaNuvem(reg, deps);
      reg = { ...reg, nuvem: { ...(reg.nuvem || {}), original } };
      if (reg.tratada?.blob) {
        const tratada = await garantirTratadaNaNuvem(reg, deps);
        reg = { ...reg, nuvem: { ...reg.nuvem, tratada } };
      }
    } catch (e) {
      erros.push(`${reg.nome || "foto"}: ${e?.message || e}`);
    }
    vozFotos.push({ id: reg.id, url: urlNoAnuncio(reg), usar: Boolean(reg.usarNoAnuncio), original: reg.nuvem?.original?.url || "", tratada: reg.nuvem?.tratada?.url || "", versao: reg.versao === "tratada" ? "tratada" : "original" });
  }

  // 2) Ficha atual (se já existe): respeita o que foi feito no computador
  let atual = null;
  if (voz.fichaIdPAIIA) {
    const r = await deps.lerFicha(voz.fichaIdPAIIA);
    if (!r.ok) return { ok: false, estado: r.naoEncontrada ? "excluida" : "erro", erro: r.erro || "Não consegui ler a ficha.", erros };
    atual = r.ficha;
    // mesma regra do Novo Anúncio: depois da Conferência, a ficha é dela
    if (!fichaSoNoNovoAnuncio(atual)) {
      return { ok: false, estado: "na-conferencia", erro: "Esta ficha já está na Conferência: o PAIIA Voz não altera mais.", erros };
    }
  }
  const d = atual?.dados_conferencia || {};
  const na = d.novo_anuncio || {};
  const meta = d.paiia_voz || {};
  const antes = meta.sinc || {};
  const conflitos = [];
  const campo = (nome, valorVoz) => {
    const j = juntarTexto(na[nome], antes[nome], valorVoz);
    if (j.conflito) conflitos.push(nome);
    return j.valor;
  };
  const novoCodigo = campo("codigo", codigo);
  const novoTitulo = campo("titulo", voz.titulo);
  const novaDescricao = campo("descricao", voz.descricao);
  const novoPreco = campo("preco", voz.preco);
  const novoOem = campo("oem", voz.oem);
  const fotosJ = juntarFotos(na.fotos, antes.fotos, vozFotos);

  const novoAnuncio = {
    ...na,
    codigo: novoCodigo, oem: novoOem, titulo: novoTitulo, descricao: novaDescricao, preco: novoPreco,
    fotos: fotosJ.fotos,
    origemPaiiaVoz: txt(voz.fichaVozId) || txt(na.origemPaiiaVoz),
  };
  if (!novoAnuncio.tipoAnuncio) novoAnuncio.tipoAnuncio = "classico";
  const paiiaVoz = {
    fichaVozId: txt(voz.fichaVozId),
    // originais SEMPRE registradas (a ficha pode usar a tratada)
    fotos: vozFotos.filter((f) => f.original).map(({ id, original, tratada, versao, usar }) => ({ id, original, tratada, versao, usar })),
    sinc: { codigo: novoCodigo, titulo: novoTitulo, descricao: novaDescricao, preco: novoPreco, oem: novoOem, fotos: fotosJ.sinc },
  };

  const montado = {
    anuncio: { codigo: novoCodigo, oem: novoOem, titulo: novoTitulo, descricao: novaDescricao, preco: novoPreco, fotos: fotosJ.fotos, imagens: fotosJ.fotos, ...(atual ? {} : { tipoAnuncio: "classico" }) },
    novo_anuncio: novoAnuncio,
  };
  const s = await deps.salvarFicha({ fichaId: voz.fichaIdPAIIA || "", codigo: novoCodigo, titulo: novoTitulo, montado, paiiaVoz });
  if (!s.ok) return { ok: false, estado: s.fechada ? "fechada" : "erro", erro: s.erro || "Não consegui salvar a ficha.", erros };
  return {
    ok: true,
    estado: "salva",
    fichaIdPAIIA: s.fichaId,
    nova: Boolean(s.nova),
    salvoEm: s.salvoEm,
    fotosNaFicha: fotosJ.fotos.length,
    fotosEnviadas: vozFotos.filter((f) => f.original).length,
    conflitos,
    erros,
  };
}
