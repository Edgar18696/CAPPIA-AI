// =============================================================
// PAIIA Voz — CONSULTA NA BASE PAIIA (somente leitura).
//   Testes: scripts/testes/paiiaVoz.test.mjs
//
// Ordem oficial: BASE VALIDADA PAIIA → CATÁLOGOS INTERNOS.
// Nada é gravado. As funções de leitura reais são injetadas
// (buscarConhecimentoValidado, pesquisarCatalogo) para os testes rodarem
// sem rede. Aplicação sem modelo é descartada; nada é completado.
// =============================================================

import { normalizarCodigo } from "../../../services/paizinhoPesquisa/codigoPaizinho.js";

const txt = (v) => String(v ?? "").trim();

/**
 * (07/11) Códigos de referência: a base às vezes guarda vários num TEXTO só
 * ("IWP211, 50174302, 501 743 02, 9S4G9F593CA"). Separa por , ; / e quebra de linha,
 * tira o próprio SKU e repetições da mesma forma normalizada (50174302 = 501 743 02),
 * mantendo a primeira grafia.
 */
export function listaCodigos(valores, alvo) {
  const vistos = new Set([alvo]);
  const lista = [];
  for (const v of [valores].flat(Infinity)) {
    for (const parte of String(v ?? "").split(/[,;/\n]+/)) {
      const c = txt(parte);
      const n = normalizarCodigo(c);
      if (!c || !n || vistos.has(n)) continue;
      vistos.add(n);
      lista.push(c);
    }
  }
  return lista;
}

/** (07/11) Textos de andamento da busca do Criar Anúncio que falam em "anúncio" ganham um texto neutro no PAIIA Voz. */
const etapaNeutra = (etapa) => (/an[uú]ncio/i.test(etapa) ? "Mesma busca do Criar Anúncio: conferindo aplicações e códigos…" : etapa);
const ano = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1950 && n <= 2100 ? n : null;
};

function aplicacaoDaLinha(l, fonte) {
  const modelo = txt(l.modelo);
  if (!modelo) return null;
  return {
    texto: [l.montadora, l.modelo, l.motor, l.versao, l.ano_inicio, l.ano_fim].filter(Boolean).join(" "),
    versao: txt(l.versao),
    montadora: txt(l.montadora),
    modelos: [modelo],
    motores: txt(l.motor) ? [txt(l.motor)] : [],
    anoInicio: ano(l.ano_inicio),
    anoFim: ano(l.ano_fim),
    fonte,
  };
}

/** (07/11) Mensagens da busca do Criar Anúncio que significam "a Base PAIIA não tem esse código" (iguais às do NovoAnuncio). */
export function ehNaoEncontradoNaBase(mensagem) {
  const t = txt(mensagem);
  return t === "Produto ainda não encontrado na Base PAIIA." || t.startsWith("Nenhum resultado foi encontrado para");
}

/**
 * (07/11) A Base validada devolve [] quando o banco dá erro (o Criar Anúncio depende disso).
 * Aqui o cliente é "vigiado": se o banco respondeu com erro, a consulta do PAIIA Voz
 * vira FALHA (com "Tentar novamente") em vez de "não encontrado". Só leitura.
 */
function vigiar(alvo, aoErro) {
  return new Proxy(alvo, {
    get(t, p) {
      if (p === "then") return (ok, nok) => t.then((r) => { if (r?.error) aoErro(r.error); return r; }).then(ok, nok);
      const v = Reflect.get(t, p, t);
      if (typeof v !== "function") return v;
      return (...a) => { const r = v.apply(t, a); return r && (typeof r === "object" || typeof r === "function") ? vigiar(r, aoErro) : r; };
    },
  });
}
export function buscarValidadoVigiado(buscar, cliente) {
  return async (codigo) => {
    let erro = null;
    const linhas = await buscar(codigo, { cliente: { from: (...a) => vigiar(cliente.from(...a), (e) => { erro = erro || e; }) } });
    if (erro) throw new Error(erro.message || String(erro));
    return linhas;
  };
}

/**
 * @param onProgresso (progresso 0–100, etapa) — andamento REAL: uma etapa por fonte consultada.
 * @param tempoLimiteMs cada fonte que não responder nesse tempo conta como falha.
 * @returns {Promise<{ encontrado, falhou, origem, rotulo, aplicacoes[], codigos[], descricao, erro }>}
 */
export async function consultarBaseVoz(codigo, { buscarValidado, pesquisarCatalogo, preencherAutomatico, onProgresso, tempoLimiteMs = 0 } = {}) {
  const alvo = normalizarCodigo(codigo);
  const vazio = { encontrado: false, falhou: false, origem: "", rotulo: "", aplicacoes: [], codigos: [], descricao: "", erro: "" };
  if (!alvo) return { ...vazio, erro: "Informe o código da peça antes de consultar." };
  const sku = txt(codigo).toUpperCase();
  let atual = 0;
  let encerrado = false;
  const querAndamento = typeof onProgresso === "function"; // sem andamento pedido, as chamadas às fontes ficam iguais às de antes
  const andamento = (p, etapa) => { if (encerrado || typeof onProgresso !== "function") return; atual = Math.max(atual, Math.min(100, Math.round(p))); onProgresso(atual, etapa); };
  const comLimite = (promessa) => {
    if (!(tempoLimiteMs > 0)) return promessa;
    let tm;
    const limite = new Promise((_, nok) => { tm = setTimeout(() => nok(new Error(`a Base PAIIA não respondeu em ${Math.round(tempoLimiteMs / 1000)} s`)), tempoLimiteMs); });
    return Promise.race([promessa, limite]).finally(() => clearTimeout(tm));
  };
  const fim = (res) => {
    const final = { ...vazio, ...res, falhou: !res.encontrado && Boolean(res.falhou) };
    andamento(100, final.encontrado ? `${sku} encontrado na ${final.rotulo}` : final.falhou ? `Falha na consulta de ${sku}` : `${sku} não encontrado na Base PAIIA`);
    encerrado = true;
    return final;
  };
  andamento(5, `Pesquisando ${sku} na Base PAIIA`);

  // 1) Base validada PAIIA
  if (typeof buscarValidado === "function") {
    andamento(10, "Base validada PAIIA: consultando…");
    try {
      const linhas = await comLimite(Promise.resolve().then(() => buscarValidado(codigo)));
      if (Array.isArray(linhas) && linhas.length) {
        const rotulo = "Base validada PAIIA";
        const aplicacoes = linhas
          .map((l) => aplicacaoDaLinha(l, (Array.isArray(l.fontes) && l.fontes.length ? l.fontes.map(txt).filter(Boolean).join(" · ") : "") || rotulo))
          .filter(Boolean);
        const codigos = listaCodigos(linhas.map((l) => [l.codigos_oem || [], l.codigos_equivalentes || []]), alvo);
        const descricao = txt((linhas.find((l) => txt(l.peca)) || {}).peca);
        return fim({ encontrado: true, origem: "base_validada", rotulo, aplicacoes, codigos, descricao, erro: "" });
      }
    } catch (e) {
      vazio.erro = `Base validada indisponível: ${e?.message || e}`;
      vazio.falhou = true;
    }
  }

  // 2) Catálogos internos (catalogo_mestre / catalogo_pecas)
  if (typeof pesquisarCatalogo === "function") {
    andamento(35, "Catálogos internos PAIIA: consultando…");
    try {
      const registros = await comLimite(Promise.resolve().then(() => pesquisarCatalogo({ termo: codigo, ...(querAndamento ? { onProgresso: (p) => andamento(Math.min(55, atual + 3), txt(p?.mensagem) || "Catálogos internos PAIIA: consultando…") } : {}) })));
      if (Array.isArray(registros) && registros.length) {
        const aplicacoes = registros.map((r) => {
          const fonte = ["Catálogo interno PAIIA", txt(r.arquivo || r.origem_catalogo), r.pagina ? `pág. ${r.pagina}` : ""].filter(Boolean).join(" · ");
          return aplicacaoDaLinha(r, fonte);
        }).filter(Boolean);
        const codigos = listaCodigos(registros.map((r) => r.equivalencias || r.codigo_equivalente || ""), alvo);
        const descricao = txt((registros.find((r) => txt(r.peca)) || {}).peca);
        return fim({ encontrado: true, origem: "catalogo", rotulo: "Catálogo interno PAIIA", aplicacoes, codigos, descricao, erro: "" });
      }
    } catch (e) {
      vazio.erro = [vazio.erro, `Catálogo indisponível: ${e?.message || e}`].filter(Boolean).join(" · ");
      vazio.falhou = true;
    }
  }

  // 3) (13/11) A MESMA busca do Criar Anúncio (catálogo mestre, catálogos internos, base de anúncios),
  // sem internet. Mesma ordem de fontes de aplicações que o Criar Anúncio usa. Nada é inventado.
  if (typeof preencherAutomatico === "function") {
    andamento(60, "Mesma busca do Criar Anúncio: consultando…");
    try {
      const r = await comLimite(Promise.resolve().then(() => preencherAutomatico({
        codigo, oem: "", permitirBuscaInternet: false,
        ...(querAndamento ? { onProgresso: (p, etapa) => andamento(60 + Math.max(0, Math.min(100, Number(p) || 0)) * 0.35, etapaNeutra(txt(etapa)) || "Mesma busca do Criar Anúncio: consultando…") } : {}),
      })));
      const peca = r?.pecaEncontrada || null;
      const fontes = [r?.baseMestre?.aplicacoes, r?.diagnostico?.baseMestre?.aplicacoes, r?.inteligencia?.registros, peca?.aplicacoes, r?.resultadosCatalogo, r?.aplicacoes].find((a) => Array.isArray(a) && a.length) || [];
      const rotulo = "Base PAIIA (mesma busca do Criar Anúncio)";
      const vistos = new Set();
      const aplicacoes = fontes
        .filter((l) => String(l?.tipo_referencia || "").toLowerCase() !== "nota_tecnica")
        .map((l) => aplicacaoDaLinha(l, rotulo))
        .filter((a) => { if (!a) return false; const k = [a.montadora, a.modelos[0], a.motores[0], a.anoInicio, a.anoFim].join("|").toLowerCase(); if (vistos.has(k)) return false; vistos.add(k); return true; });
      const codigos = listaCodigos([peca?.codigo_oem, peca?.codigos_oem || [], peca?.codigos_equivalentes || [], peca?.codigos_alternativos || [], r?.oem], alvo);
      const descricao = txt(peca?.descricao || peca?.nome || peca?.peca || r?.descricao || "");
      if (aplicacoes.length || descricao || codigos.length) return fim({ encontrado: true, origem: "catalogo", rotulo, aplicacoes, codigos, descricao, erro: "" });
    } catch (e) {
      // Mesma regra do Criar Anúncio: estas mensagens significam "a base não tem o código" (não é falha).
      if (!ehNaoEncontradoNaBase(e?.message)) {
        vazio.erro = vazio.erro || `Busca da base indisponível: ${e?.message || e}`;
        vazio.falhou = true;
      }
    }
  }
  return fim({ ...vazio, erro: vazio.erro || "" });
}

export const MENSAGEM_NAO_ENCONTRADO = "Código não encontrado na base PAIIA. Complete os dados manualmente — nenhuma aplicação foi inventada.";

/**
 * (15/11) Descrição montada SÓ com o que a base tem — nada inventado.
 * - Texto da peça da base: sempre (é o que a base diz da peça).
 * - Aplicações e códigos entram no texto SÓ quando vêm da Base validada PAIIA (dados confirmados).
 *   Os do catálogo continuam como "a conferir" na Compatibilidade e nos códigos, fora do texto.
 */
export function montarDescricaoDaBase(res) {
  if (!res?.encontrado) return "";
  const linhas = [];
  const desc = String(res.descricao || "").trim();
  if (desc) linhas.push(desc.charAt(0).toUpperCase() + desc.slice(1));
  if (res.origem === "base_validada") {
    const ap = (res.aplicacoes || []).map((a) => [a.montadora, (a.modelos || []).join("/"), (a.motores || []).join("/"), a.anoInicio ? (a.anoFim && a.anoFim !== a.anoInicio ? `${a.anoInicio} a ${a.anoFim}` : String(a.anoInicio)) : ""].filter(Boolean).join(" ")).filter(Boolean);
    if (ap.length) linhas.push(`Aplicação: ${ap.join("; ")}.`);
    if ((res.codigos || []).length) linhas.push(`Códigos de referência: ${res.codigos.join(", ")}.`);
  }
  return linhas.join("\n");
}
