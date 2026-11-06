// =====================================================================
// (06/11/2026) Atributos OBRIGATÓRIOS da categoria do Mercado Livre na
// Conferência (bloco ⑮), logo abaixo da categoria.
//  - Preenche sozinho SÓ com informação confiável: o campo próprio da ficha
//    (Marca, Número da peça, Tipo de veículo) ou uma linha “Nome: valor” da
//    própria ficha cujo NOME é o do atributo (ex.: “Material: PVC” só vale
//    para o atributo Material — nunca para Tipo de capa).
//  - Lista de valores do ML: só vale valor IGUAL a uma opção oficial.
//    Parecido / dúvida = pendente (o usuário confirma).
//  - Nada é inventado. Os valores ficam na decisão da categoria (ficha).
// =====================================================================

const sem = (v) => String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const txt = (v) => String(v ?? "").trim();

/** Atributos que têm campo próprio na ficha (ou tratamento próprio). */
export const ATRIBUTOS_DE_CAMPO = Object.freeze({
  BRAND: { campo: "marca", rotulo: "Marca" },
  PART_NUMBER: { campo: "numeroPeca", rotulo: "Número da peça" },
  VEHICLE_TYPE: { campo: "tipoVeiculo", rotulo: "Tipo de veículo" },
});
// Tratados em outro lugar (não aparecem aqui): GTIN e motivo sem GTIN (bloco próprio),
// SKU e condição (vêm da ficha na Publicação).
const IGNORADOS = new Set(["GTIN", "EMPTY_GTIN_REASON", "SELLER_SKU", "ITEM_CONDITION"]);

const obrigatorio = (a) => Boolean(a?.tags?.required || a?.tags?.catalog_required);

/** Linhas “Nome: valor” dos textos da ficha → { nomeNormalizado: valor }. */
export function linhasRotuladas(textos = []) {
  const mapa = {};
  for (const t of textos) {
    for (const linha of String(t || "").split(/\r?\n/)) {
      const m = linha.replace(/^[\s•\-*]+/, "").match(/^([^:]{2,40}):\s*(.+)$/);
      if (!m) continue;
      const chave = sem(m[1]);
      if (chave && !(chave in mapa)) mapa[chave] = txt(m[2]).replace(/[.;]+$/, "");
    }
  }
  return mapa;
}

/** Valor da ficha → opção oficial (só igualdade, sem “parecido”). */
function opcaoIgual(valores, valor) {
  const v = sem(valor);
  if (!v) return null;
  return (valores || []).find((o) => sem(o.name) === v) || null;
}

/**
 * atributosBrutos: /categories/{id}/attributes do ML (com tags e values).
 * ficha: { marca, numeroPeca, tipoVeiculo, textos: [especificação, características, descrição] }
 * salvos: decisaoCategoria.atributos = { categoria_id, valores: { ID: { value_id?, value_name, nome, origem } } }
 * Devolve { lido, itens[], pendentes[], completo, paraGravar }.
 */
export function montarAtributosCategoria({ categoriaId = "", atributosBrutos = null, ficha = {}, salvos = null } = {}) {
  const id = txt(categoriaId).toUpperCase();
  if (!id || !Array.isArray(atributosBrutos)) return { lido: false, itens: [], pendentes: [], completo: false, paraGravar: null };
  const valoresSalvos = salvos && txt(salvos.categoria_id).toUpperCase() === id && salvos.valores && typeof salvos.valores === "object" ? salvos.valores : {};
  const rotuladas = linhasRotuladas(ficha.textos || []);
  const itens = [];
  const paraGravar = {};
  for (const a of atributosBrutos) {
    if (!obrigatorio(a) || IGNORADOS.has(a?.id)) continue;
    const nome = txt(a.name) || a.id;
    const valores = (Array.isArray(a.values) ? a.values : []).map((v) => ({ id: String(v.id), name: String(v.name) }));
    const base = { id: a.id, nome, valores, tipo: valores.length ? "lista" : "texto" };
    const campo = ATRIBUTOS_DE_CAMPO[a.id];
    if (campo) {
      const valor = txt(ficha[campo.campo]);
      itens.push({ ...base, campoProprio: campo.rotulo, valor, origem: valor ? `campo ${campo.rotulo}` : "", pendente: !valor });
      continue;
    }
    const salvo = valoresSalvos[a.id];
    if (salvo && (salvo.value_id || txt(salvo.value_name))) {
      // Lista: o valor salvo precisa continuar sendo uma opção oficial.
      const ok = !valores.length || valores.some((o) => o.id === String(salvo.value_id || "") || sem(o.name) === sem(salvo.value_name));
      if (ok) {
        itens.push({ ...base, valor: txt(salvo.value_name), valueId: txt(salvo.value_id), origem: salvo.origem === "ficha" ? "da ficha" : "confirmado por você", pendente: false });
        paraGravar[a.id] = { ...salvo, nome };
        continue;
      }
    }
    const daFicha = rotuladas[sem(nome)];
    if (daFicha) {
      if (!valores.length) {
        itens.push({ ...base, valor: daFicha, origem: "da ficha", pendente: false });
        paraGravar[a.id] = { value_name: daFicha, nome, origem: "ficha" };
        continue;
      }
      const o = opcaoIgual(valores, daFicha);
      if (o) {
        itens.push({ ...base, valor: o.name, valueId: o.id, origem: "da ficha", pendente: false });
        paraGravar[a.id] = { value_id: o.id, value_name: o.name, nome, origem: "ficha" };
        continue;
      }
      // A ficha diz algo, mas não é uma opção oficial: o usuário decide.
      itens.push({ ...base, valor: "", origem: "", pendente: true, duvida: `a ficha diz “${daFicha}”, que não é uma opção do Mercado Livre — escolha a correta` });
      continue;
    }
    itens.push({ ...base, valor: "", origem: "", pendente: true });
  }
  const pendentes = itens.filter((i) => i.pendente);
  return { lido: true, itens, pendentes, completo: pendentes.length === 0, paraGravar: Object.keys(paraGravar).length ? { categoria_id: id, valores: paraGravar } : null };
}

/** Registra o valor escolhido pelo usuário (lista: opção oficial; texto: o digitado). */
export function registrarAtributo(salvos, { categoriaId, atributo, valueId = "", valueName = "", agora = new Date().toISOString() }) {
  const id = txt(categoriaId).toUpperCase();
  const atual = salvos && txt(salvos.categoria_id).toUpperCase() === id && salvos.valores ? { ...salvos.valores } : {};
  if (!txt(valueId) && !txt(valueName)) delete atual[atributo.id];
  else atual[atributo.id] = { ...(txt(valueId) ? { value_id: txt(valueId) } : {}), value_name: txt(valueName), nome: atributo.nome, origem: "usuario", data: agora };
  return { categoria_id: id, valores: atual };
}

/** Valores para a Publicação (atributos_extras), só da categoria confirmada. */
export function extrasDaDecisao(decisao) {
  const s = decisao?.atributos;
  const id = txt(decisao?.confirmada?.id).toUpperCase();
  if (!s || !id || txt(s.categoria_id).toUpperCase() !== id) return {};
  const out = {};
  for (const [k, v] of Object.entries(s.valores || {})) {
    if (ATRIBUTOS_DE_CAMPO[k] || IGNORADOS.has(k)) continue;
    if (v?.value_id) out[k] = { value_id: String(v.value_id) };
    else if (txt(v?.value_name)) out[k] = { value_name: txt(v.value_name) };
  }
  return out;
}

/** Texto curto e estável dos valores (assinatura da aprovação). */
export function assinaturaAtributos(paraGravar) {
  const v = paraGravar?.valores || {};
  return Object.keys(v).sort().map((k) => `${k}=${v[k].value_id || ""}|${sem(v[k].value_name)}`).join(";");
}
