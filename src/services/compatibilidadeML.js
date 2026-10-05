/*
 * Compatibilidade de veículos para o Mercado Livre — regras do PAIIA.
 *
 * Usa SOMENTE as aplicações aprovadas na Conferência (montadora, modelo,
 * motor e período). Nunca acrescenta veículo, motor ou ano: cada aplicação
 * aprovada é procurada no catálogo de veículos do ML e só entram os
 * veículos do catálogo que batem com TODOS os dados aprovados. O que não
 * confirma vai para a lista de descartados, com o motivo.
 *
 * Também monta a descrição padrão e a conferência pós-publicação.
 */

const DOMINIO_CARROS = "MLB-CARS_AND_VANS";

const limpar = (v) => String(v ?? "").replace(/�/g, "").replace(/\s+/g, " ").trim();
const semAcento = (v) => limpar(v).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const ano = (v) => (/^\d{4}$/.test(limpar(v)) ? Number(limpar(v)) : null);

/** Aplicações aprovadas, a partir da lista estruturada ou do texto da Conferência. */
export function lerAplicacoesAprovadas({ aplicacoes, texto } = {}) {
  const lista = [];
  if (Array.isArray(aplicacoes) && aplicacoes.length) {
    for (const a of aplicacoes) {
      const montadora = limpar(a?.montadora || a?.marca_veiculo || a?.marcaVeiculo);
      const modelo = limpar(a?.modelo || a?.veiculo);
      if (!montadora || !modelo) continue;
      lista.push({
        montadora,
        modelo,
        motor: limpar([a?.motor, a?.versao].filter(Boolean).join(" ")),
        anoInicio: ano(a?.anoInicio ?? a?.ano_inicio),
        anoFim: ano(a?.anoFim ?? a?.ano_fim),
      });
    }
    return lista;
  }
  // Texto no formato da Conferência:
  // RENAULT / • Symbol / Motor: 1.6 16v / Período: 2009 até 2013
  let montadora = "";
  let atual = null;
  for (const bruta of String(texto || "").split(/\r?\n/)) {
    const linha = limpar(bruta);
    if (!linha) continue;
    if (/^[•\-*]\s*/.test(linha)) {
      atual = { montadora, modelo: limpar(linha.replace(/^[•\-*]\s*/, "")), motor: "", anoInicio: null, anoFim: null };
      lista.push(atual);
    } else if (/^motor\s*:/i.test(linha) && atual) {
      atual.motor = limpar(linha.replace(/^motor\s*:/i, ""));
    } else if (/^per[ií]odo\s*:/i.test(linha) && atual) {
      // Só o período escrito: "Atual"/"?" ficam em branco (nunca ano inventado).
      const desde = linha.match(/a\s+partir\s+de\s+(\d{4})/i);
      const ate = linha.match(/:\s*at[eé]\s+(\d{4})/i);
      const m = linha.match(/(\d{4}|\?)\s*(?:até|ate|a|à|-)\s*(\d{4}|atual|\?)/i);
      if (desde) {
        atual.anoInicio = Number(desde[1]);
      } else if (ate) {
        atual.anoFim = Number(ate[1]);
      } else if (m) {
        atual.anoInicio = ano(m[1]);
        atual.anoFim = ano(m[2]);
      } else {
        const unico = linha.match(/\d{4}/);
        if (unico) atual.anoInicio = atual.anoFim = Number(unico[0]);
      }
    } else if (!/:/.test(linha)) {
      montadora = linha;
      atual = null;
    }
  }
  return lista.filter((a) => a.montadora && a.modelo && a.modelo !== "Modelo não informado");
}

/**
 * Separa o que pode ir para a tabela OFICIAL de compatibilidade do ML
 * (aplicação com motor e/ou ano confirmados) dos modelos confirmados sem
 * detalhes (ficam na descrição/busca; nunca viram todas as versões/anos).
 */
export function separarAplicacoesParaML(lista = []) {
  const temDetalhe = (a) => Boolean(a?.motor || a?.anoInicio || a?.anoFim);
  return { detalhadas: lista.filter(temDetalhe), semDetalhes: lista.filter((a) => !temDetalhe(a)) };
}

// Montadoras de automóvel/caminhonete. Fabricantes que também fazem
// caminhão/ônibus ficam de fora: na dúvida o PAIIA pede confirmação.
const MONTADORAS_CARRO = new Set([
  "renault", "fiat", "volkswagen", "vw", "chevrolet", "gm", "ford", "hyundai", "kia", "toyota",
  "honda", "nissan", "peugeot", "citroen", "mitsubishi", "jeep", "bmw", "audi", "chery", "caoa chery",
  "jac", "suzuki", "subaru", "land rover", "dodge", "ram", "chrysler", "mini", "porsche", "lexus",
  "seat", "smart", "byd", "gwm", "lifan", "jaguar", "alfa romeo", "troller",
]);

/**
 * Tipo de veículo sugerido pelas aplicações aprovadas.
 * Só devolve "Carro / Caminhonete" quando TODAS as montadoras são de carro;
 * sem aplicação ou com dúvida devolve "" (o usuário confirma).
 */
export function inferirTipoVeiculo(aplicacoes = []) {
  if (!aplicacoes.length) return "";
  const todasCarro = aplicacoes.every((a) => MONTADORAS_CARRO.has(semAcento(a.montadora)));
  const temPesado = aplicacoes.some((a) => /caminh[aã]o|onibus|ônibus|moto|trator/i.test(`${a.modelo} ${a.motor}`));
  return todasCarro && !temPesado ? "Carro / Caminhonete" : "";
}

const chaveTipo = (v) => semAcento(v).replace(/[^a-z]/g, "").replace(/s$/, "");

/** Valor do atributo VEHICLE_TYPE da categoria que corresponde ao tipo aprovado. */
export function valorTipoVeiculo(valoresCategoria = [], tipoAprovado = "") {
  const alvo = chaveTipo(tipoAprovado);
  if (!alvo) return null;
  return (valoresCategoria || []).find((v) => chaveTipo(v?.nome || v?.name) === alvo) || null;
}

/**
 * Tipo de veículo a partir dos ATRIBUTOS DA CATEGORIA no Mercado Livre
 * (GET /categories/{id}/attributes). Verificado em 05/10/2026:
 *  - Peças/Acessórios de Carros e Caminhonetes → 1 valor "Carro/Caminhonete" (fixo)
 *  - Peças de Motos e Quadriciclos → 1 valor "Moto/Quadriciclo" (fixo)
 *  - Peças de Linha Pesada → 1 valor "Linha Pesada" (fixo)
 *  - Peças Náuticas → categoria SEM o atributo (não se aplica)
 * Devolve { existe, valores:[{id,nome}], fixo, obrigatorio }. Nunca inventa valor.
 */
export function tipoVeiculoDaCategoria(atributos) {
  if (!Array.isArray(atributos)) return null;
  const vt = atributos.find((a) => a?.id === "VEHICLE_TYPE");
  if (!vt) return { existe: false, valores: [], fixo: false, obrigatorio: false };
  const valores = (Array.isArray(vt.values) ? vt.values : []).map((v) => ({ id: String(v.id), nome: String(v.name) }));
  return { existe: true, valores, fixo: valores.length === 1, obrigatorio: Boolean(vt.tags?.required || vt.tags?.catalog_required) };
}

/** Valor a gravar na ficha: o único da categoria, ou o escolhido na grafia do ML. */
export function tipoVeiculoParaFicha(infoCategoria, atual = "") {
  if (!infoCategoria?.existe) return atual;
  if (infoCategoria.valores.length === 1) return infoCategoria.valores[0].nome;
  const igual = valorTipoVeiculo(infoCategoria.valores, atual);
  return igual ? igual.nome : atual;
}

// ---------- Casamento aplicação aprovada × veículo do catálogo ML ----------

const atributo = (produto, id) => (produto?.attributes || []).find((a) => a?.id === id)?.value_name || "";

/** Partes verificáveis do motor aprovado: cilindrada (1.6) e válvulas (16v). */
function partesMotor(motor) {
  const t = semAcento(motor);
  const cil = (t.match(/\b(\d\.\d)\b/) || [])[1] || "";
  const valv = (t.match(/\b(8|12|16|20|24|32)\s*v\b/) || [])[1] || "";
  return { cil, valv };
}

function nomeVeiculo(p) {
  return [atributo(p, "BRAND"), atributo(p, "MODEL"), atributo(p, "TRIM"), atributo(p, "VEHICLE_YEAR")].filter(Boolean).join(" ");
}

/**
 * Compara um veículo do catálogo com a aplicação aprovada.
 * Devolve { ok, motivo }. Tudo o que não confirma é descartado.
 */
export function avaliarVeiculo(produto, aplicacao) {
  const anoV = ano(atributo(produto, "VEHICLE_YEAR"));
  if (anoV == null) return { ok: false, motivo: "ano do veículo não informado no catálogo" };
  if (aplicacao.anoInicio && anoV < aplicacao.anoInicio) return { ok: false, motivo: `ano ${anoV} fora do período aprovado` };
  if (aplicacao.anoFim && anoV > aplicacao.anoFim) return { ok: false, motivo: `ano ${anoV} fora do período aprovado` };
  if (!aplicacao.anoInicio && !aplicacao.anoFim) return { ok: false, motivo: "aplicação aprovada sem período" };
  const { cil, valv } = partesMotor(aplicacao.motor);
  if (!aplicacao.motor) return { ok: false, motivo: "aplicação aprovada sem motor" };
  const versao = semAcento(`${atributo(produto, "TRIM")} ${atributo(produto, "SHORT_VERSION")}`);
  const motorV = semAcento(atributo(produto, "ENGINE"));
  if (cil && !(motorV === cil || new RegExp(`(^|\\s)${cil.replace(".", "\\.")}(\\s|$)`).test(versao))) {
    return { ok: false, motivo: `motor ${atributo(produto, "ENGINE") || "?"} diferente de ${aplicacao.motor}` };
  }
  if (valv) {
    const temNaVersao = new RegExp(`\\b${valv}\\s*v\\b`).test(versao);
    const outrasValvulas = /\b(8|12|16|20|24|32)\s*v\b/.test(versao) && !temNaVersao;
    if (!temNaVersao) {
      const vpc = atributo(produto, "VALVES_PER_CYLINDER");
      const extra = vpc ? ` (${vpc} válvulas por cilindro)` : "";
      return { ok: false, motivo: outrasValvulas ? `versão não é ${valv}v` : `versão do catálogo não confirma ${valv}v${extra}` };
    }
  }
  return { ok: true, motivo: "" };
}

/**
 * Resolve as aplicações aprovadas em veículos do catálogo ML.
 * consultar(caminho, metodo, corpo) = consulta somente leitura (ml_consulta).
 * Devolve { veiculos:[{id,nome,aplicacao}], descartados:[{id,nome,motivo}],
 *           semCatalogo:[{aplicacao,motivo}], erro }.
 */
export async function resolverCompatibilidades(aplicacoes, consultar) {
  const veiculos = new Map();
  const descartados = [];
  const semCatalogo = [];
  const rotulo = (a) => `${a.modelo} ${a.motor} ${a.anoInicio || "?"}–${a.anoFim || "?"}`.replace(/\s+/g, " ");
  const cacheMarca = new Map();
  for (const a of aplicacoes) {
    // Modelo confirmado SEM detalhes (sem motor e sem período): não é
    // vinculado automaticamente a todas as versões/anos do catálogo.
    if (!a.motor && !a.anoInicio && !a.anoFim) {
      semCatalogo.push({ aplicacao: rotulo(a), motivo: "modelo sem detalhes (sem motor/ano): não vinculado automaticamente ao catálogo do Mercado Livre" });
      continue;
    }
    // 1) montadora no catálogo
    let marcas = cacheMarca.get(a.montadora);
    if (!marcas) {
      const r = await consultar(`/catalog_domains/${DOMINIO_CARROS}/attributes/BRAND/top_values`, "POST", {});
      if (!r?.ok) return { erro: r?.erro || "catálogo de veículos indisponível" };
      marcas = Array.isArray(r.dados) ? r.dados : [];
      cacheMarca.set(a.montadora, marcas);
    }
    const marca = marcas.find((m) => semAcento(m?.name) === semAcento(a.montadora));
    if (!marca) { semCatalogo.push({ aplicacao: rotulo(a), motivo: `montadora ${a.montadora} não encontrada no catálogo` }); continue; }
    // 2) modelo exato
    const rm = await consultar(`/catalog_domains/${DOMINIO_CARROS}/attributes/MODEL/top_values`, "POST", { known_attributes: [{ id: "BRAND", value_id: String(marca.id) }] });
    if (!rm?.ok) return { erro: rm?.erro || "catálogo de modelos indisponível" };
    const modelo = (Array.isArray(rm.dados) ? rm.dados : []).find((m) => semAcento(m?.name) === semAcento(a.modelo));
    if (!modelo) { semCatalogo.push({ aplicacao: rotulo(a), motivo: `modelo ${a.modelo} não encontrado no catálogo` }); continue; }
    // 3) veículos (versões/anos) desse modelo
    const produtos = [];
    for (let offset = 0; offset < 2000; offset += 50) {
      const rp = await consultar("/catalog_compatibilities/products_search/chunks", "POST", {
        domain_id: DOMINIO_CARROS,
        site_id: "MLB",
        known_attributes: [{ id: "BRAND", value_ids: [String(marca.id)] }, { id: "MODEL", value_ids: [String(modelo.id)] }],
        offset,
        limit: 50,
      });
      if (!rp?.ok) return { erro: rp?.erro || "busca de veículos indisponível" };
      const lote = Array.isArray(rp.dados?.results) ? rp.dados.results : [];
      produtos.push(...lote);
      const total = Number(rp.dados?.total) || 0;
      if (!lote.length || produtos.length >= total || lote.length < 50) break;
    }
    let algum = false;
    for (const p of produtos) {
      if (!/^MLB\d+$/.test(String(p?.id || ""))) continue;
      const av = avaliarVeiculo(p, a);
      if (av.ok) {
        algum = true;
        if (!veiculos.has(p.id)) veiculos.set(p.id, { id: p.id, nome: nomeVeiculo(p), aplicacao: rotulo(a) });
      } else if (!veiculos.has(p.id) && !descartados.some((d) => d.id === p.id)) {
        descartados.push({ id: p.id, nome: nomeVeiculo(p), motivo: av.motivo, aplicacao: rotulo(a) });
      }
    }
    if (!algum) semCatalogo.push({ aplicacao: rotulo(a), motivo: "nenhum veículo do catálogo confirma todos os dados aprovados" });
  }
  // Um veículo aceito por uma aplicação não aparece como descartado por outra.
  const aceitos = [...veiculos.values()];
  return {
    veiculos: aceitos.sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR")),
    descartados: descartados.filter((d) => !veiculos.has(d.id)),
    semCatalogo,
    dominio: DOMINIO_CARROS,
  };
}

// ---------- Marca e descrição ----------

/** Marca que NÃO é marca: "Original", "Genuína", "OEM"... (código OEM ≠ marca). */
export function marcaInvalida(marca) {
  const t = semAcento(marca).replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return "";
  if (/\b(original|originais|genuin[oa]s?)\b/.test(t) || /^(oem|paralela|generica|sem marca|nao informada|n a)$/.test(t)) {
    return `"${limpar(marca)}" não é marca: código OEM/original não define a marca. Use a marca real do produto (Torken quando for da nossa marca).`;
  }
  return "";
}

/** A descrição afirma que a peça é original/genuína? */
export function descricaoAfirmaOriginal(texto) {
  return /\b(original|originais|genu[ií]n[oa]s?)\b/i.test(String(texto || ""));
}

const ATENCAO =
  "ATENÇÃO: Antes de efetuar a compra, verifique o código da peça instalada em seu veículo. A compatibilidade deve ser confirmada comparando o código informado neste anúncio com o código da peça do veículo.";
const IMPORTANTE =
  "IMPORTANTE: Para evitar a compra de uma peça incompatível, confira sempre o código da peça antes de realizar o pedido.";

/**
 * Descrição padrão (modelo oficial do usuário), só com dados aprovados.
 * Sem marca e sem montadora no texto, sem "original/genuína", sem medidas/peso.
 */
export function montarDescricaoPadrao({ nomePeca, titulo, aplicacoes = [], codigos = [], conteudo = "", condicao = "novo", mesesGarantia = "", complementoAplicacao = "" } = {}) {
  // Regra do usuário: sem nome de montadora (nem marca) no texto.
  const ambiguas = new Set(["mini", "ram", "seat", "smart"]);
  const montadoras = new Set([...[...MONTADORAS_CARRO].filter((m) => !ambiguas.has(m)), ...aplicacoes.map((a) => semAcento(a.montadora))]);
  const tirarMontadora = (t) =>
    limpar(t)
      .split(" ")
      .filter((p) => !montadoras.has(semAcento(p)))
      .join(" ");
  const nome = tirarMontadora(limpar(nomePeca) || limpar(titulo));
  const linhas = [];
  if (nome) linhas.push(nome.toUpperCase(), "");
  // Uma linha por modelo + motor, juntando períodos sobrepostos.
  const grupos = new Map();
  for (const a of aplicacoes) {
    const k = `${a.modelo}|${a.motor}`.toUpperCase();
    const g = grupos.get(k) || { modelo: a.modelo, motor: a.motor, ini: null, fim: null };
    if (a.anoInicio && (g.ini == null || a.anoInicio < g.ini)) g.ini = a.anoInicio;
    if (a.anoFim && (g.fim == null || a.anoFim > g.fim)) g.fim = a.anoFim;
    grupos.set(k, g);
  }
  if (grupos.size) {
    linhas.push("Compatível com os veículos:");
    for (const g of grupos.values()) {
      const periodo = g.ini && g.fim ? (g.ini === g.fim ? `${g.ini}` : `${g.ini} à ${g.fim}`) : g.ini ? `${g.ini} em diante` : "";
      linhas.push([g.modelo, g.motor, periodo].filter(Boolean).join(" ") + (limpar(complementoAplicacao) ? ` (${limpar(complementoAplicacao)})` : ""));
    }
    linhas.push("");
  }
  linhas.push("Especificações Técnicas:");
  linhas.push(`Condição do item: ${condicao === "usado" ? "Produto usado" : "Produto novo"}`);
  if (limpar(conteudo)) linhas.push(`Conteúdo da embalagem: ${limpar(conteudo)}`);
  linhas.push("");
  // Código em maiúsculas; rótulo opcional ("Sensor: 497610324R") é mantido.
  const vistos = new Set();
  const cods = codigos
    .map(limpar)
    .filter(Boolean)
    .map((c) => c.replace(/[A-Za-z0-9.\-\/]+$/, (m) => m.toUpperCase()))
    .filter((c) => {
      const k = c.replace(/^.*:\s*/, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (vistos.has(k)) return false;
      vistos.add(k);
      return true;
    });
  if (cods.length) linhas.push("Código de Referência:", ...cods, "");
  if (/^\d+$/.test(limpar(mesesGarantia)) && Number(mesesGarantia) > 0) linhas.push(`Garantia: ${Number(mesesGarantia)} ${Number(mesesGarantia) === 1 ? "Mês" : "Meses"}`, "");
  linhas.push(ATENCAO, "", IMPORTANTE);
  return linhas.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// ---------- Conferência pós-publicação ----------

const normSku = (v) => String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const num = (v) => {
  const t = String(v ?? "").trim();
  const n = t.includes(",") ? Number(t.replace(/\./g, "").replace(",", ".")) : Number(t);
  return Number.isFinite(n) ? n : NaN;
};

/**
 * Compara o que foi enviado com o MLB relido do Mercado Livre.
 * esperado: { conta, sku, preco, quantidade, tipoAnuncio, fotos, marca,
 *             tipoVeiculo, compatibilidades:[ids] }
 * item: GET /items/{id};  compat: GET /items/{id}/compatibilities (ou null)
 * Devolve { itens:[{item, esperado, recebido, ok, obrigatorio}], pendencias:[texto] }.
 */
export function conferirPublicacao({ itemId, esperado = {}, item, compat }) {
  const itens = [];
  const add = (nome, esp, rec, ok, obrigatorio = true) => itens.push({ item: nome, esperado: esp, recebido: rec, ok: Boolean(ok), obrigatorio });
  const attr = (k) => (item?.attributes || []).find((a) => a?.id === k);
  add("MLB criado", itemId, item?.id || "não relido", item?.id && item.id === itemId);
  if (!item?.id) {
    return { itens, pendencias: ["Não foi possível reler o anúncio criado no Mercado Livre (verificação incompleta)."] };
  }
  add("Conta", String(esperado.conta || ""), String(item.seller_id || ""), String(item.seller_id) === String(esperado.conta));
  const skuRec = attr("SELLER_SKU")?.value_name || item.seller_custom_field || "";
  add("SKU", esperado.sku || "", skuRec || "nenhum", esperado.sku && normSku(skuRec) === normSku(esperado.sku));
  add("Preço", esperado.preco, item.price, Math.abs(num(item.price) - num(esperado.preco)) < 0.01);
  add("Quantidade", Number(esperado.quantidade), item.available_quantity, Number(item.available_quantity) === Number(esperado.quantidade));
  const tipoEsp = esperado.tipoAnuncio === "premium" ? "gold_pro" : "gold_special";
  add("Tipo de anúncio", tipoEsp, item.listing_type_id, item.listing_type_id === tipoEsp);
  const nFotos = (item.pictures || []).length;
  add("Fotos", Number(esperado.fotos) || 0, nFotos, nFotos >= 1 && nFotos >= (Number(esperado.fotos) || 0));
  if (esperado.marca) {
    const m = attr("BRAND")?.value_name || "";
    add("Marca", esperado.marca, m || "nenhuma", semAcento(m) === semAcento(esperado.marca));
  }
  if (esperado.tipoVeiculo) {
    const t = attr("VEHICLE_TYPE")?.value_name || "";
    add("Tipo de veículo", esperado.tipoVeiculo, t || "nenhum", chaveTipo(t) === chaveTipo(esperado.tipoVeiculo));
  }
  const enviados = Array.isArray(esperado.compatibilidades) ? esperado.compatibilidades : [];
  if (enviados.length || esperado.compatibilidadesAprovadas) {
    const presentes = new Set((compat?.products || []).map((p) => String(p?.catalog_product_id || "")));
    const aceitos = enviados.filter((id) => presentes.has(String(id)));
    add(
      "Compatibilidades",
      `${enviados.length} veículo(s)`,
      compat ? `${aceitos.length} aceito(s) de ${enviados.length}; ${presentes.size} no anúncio` : "não relido",
      compat && enviados.length > 0 && aceitos.length === enviados.length
    );
  }
  const pendencias = itens.filter((i) => i.obrigatorio && !i.ok).map((i) => `${i.item}: esperado ${i.esperado}, recebido ${i.recebido}.`);
  return { itens, pendencias };
}
