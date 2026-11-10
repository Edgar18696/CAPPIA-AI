// (10/11) Diagnóstico TEMPORÁRIO de publicação: somente leitura, pela sessão do PAIIA.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { diagnosticarPublicacao, somenteLeitura, textoDiagnostico, LEITURAS_BLING } from "../../src/services/diagnosticoPublicacao.js";
const ler = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const MLB = "MLB5535014431", SKU = "39038558", CONTA = "1729335019", PROD = "16732475335", LOJA = "204883484";
const FICHA = "aaaaaaaa-1111-4222-8333-000039038558";

function mundo({ statusFluxo = "publicado", pubMlb = MLB, skuAttr = SKU, busca = [MLB], blingAnuncios = [{ mlb: MLB, produto_id: PROD, id_anuncio: 9 }], buscaMLB = null, outros = [], seller = CONTA, regs = [{ mlb_id: MLB, ml_user_id: CONTA, anuncio_id: FICHA, bling_produto_id: PROD }] } = {}) {
  const chamadas = [];
  const item = (id, extra = {}) => ({ id, seller_id: Number(seller), status: "active", sub_status: [], price: 127.76, available_quantity: 1, condition: "new", listing_type_id: "gold_special", title: "Botão Volante Comando Voz Fone Cruze 1.4", attributes: skuAttr ? [{ id: "SELLER_SKU", value_name: skuAttr }] : [], ...extra });
  const deps = {
    listarFichas: async () => ({ ok: true, anuncios: [{ id: FICHA, status_fluxo: statusFluxo, conta_destino_ml_user_id: CONTA }] }),
    lerFicha: async () => ({ ok: true, anuncio: { id: FICHA, status_fluxo: statusFluxo, conta_destino_ml_user_id: CONTA, conta_destino_nome: "LOJA ONLINE", updated_at: "2026-11-10T10:00:00Z", publicacao: { mlb_id: pubMlb, status_publicacao: pubMlb ? "publicado" : "pendente", ml_user_id: CONTA, bling_produto_id: PROD }, dados_conferencia: { integracao_bling: { mlb: MLB, estado: "aguardando_importacao", bling_produto_id: PROD, bling_loja_id: LOJA }, pos_publicacao: { mlb: MLB, concluido: false, vinculo: { estado: "aguardando" } } } } }),
    lerRegistro: async () => ({ ok: true, registros: regs }),
    consultarML: async (conta, caminho) => {
      chamadas.push(["ml", conta, caminho]);
      if (caminho === `/items/${MLB}`) return { ok: true, dados: item(MLB) };
      if (/items\/search\?seller_sku=/.test(caminho)) return { ok: true, dados: { results: busca, paging: { total: busca.length } } };
      if (/items\/search\?q=/.test(caminho)) return { ok: true, dados: { results: [...busca, ...outros], paging: { total: busca.length + outros.length } } };
      const o = /\/items\/(MLB\d+)$/.exec(caminho);
      if (o) return { ok: true, dados: item(o[1]) };
      return { ok: false, erro: "?" };
    },
    consultarBling: async (corpo) => {
      chamadas.push(["bling", corpo.acao]);
      if (corpo.acao === "saldo_por_sku") return { ok: true, encontrado: true, produto: { id: PROD, codigo: SKU, nome: "Botão" } };
      if (corpo.acao === "anuncios_consultar") return { ok: true, id_loja: LOJA, anuncios: blingAnuncios };
      if (corpo.acao === "anuncios_buscar_mlb") return buscaMLB || { ok: true, id_loja: LOJA, encontrado: false };
      return { ok: false };
    },
  };
  return { deps, chamadas };
}
const nivel = (d, item) => d.pontos.filter((p) => p.item === item).map((p) => p.nivel);

test("só leitura: ML só GET (/items, /users); Bling só saldo_por_sku / anuncios_consultar / anuncios_buscar_mlb", async () => {
  const { deps, chamadas } = mundo();
  await diagnosticarPublicacao({ sku: SKU }, deps);
  assert.ok(chamadas.filter((c) => c[0] === "ml").every((c) => /^\/(items|users)\//.test(c[2])));
  assert.ok(chamadas.filter((c) => c[0] === "bling").every((c) => LEITURAS_BLING.includes(c[1])));
  const q = somenteLeitura({ consultarML: async () => ({ ok: true }), consultarBling: async () => ({ ok: true }) });
  assert.equal((await q.bling({ acao: "criar_produto" })).ok, false, "criar no Bling recusado");
  assert.equal((await q.bling({ acao: "atualizar_estoque" })).ok, false);
  assert.equal((await q.ml("1", "/orders/1")).ok, false);
});

test("tudo certo: conta, status, SKU, busca, sem duplicidade e vínculo integrado", async () => {
  const d = await diagnosticarPublicacao({ sku: SKU }, mundo().deps);
  assert.equal(d.mlb, MLB);
  assert.equal(d.conta, CONTA);
  assert.deepEqual(nivel(d, "Conta vendedora"), ["ok"]);
  assert.deepEqual(nivel(d, "Status no ML"), ["ok"]);
  assert.deepEqual(nivel(d, "SKU no ML"), ["ok"]);
  assert.deepEqual(nivel(d, "Busca do SKU"), ["ok"]);
  assert.deepEqual(nivel(d, "Duplicidade"), ["ok"]);
  assert.equal(d.bling.vinculo.estado, "integrado");
  assert.ok(nivel(d, "Vínculo no Bling").includes("ok"));
  assert.ok(d.pontos.some((p) => p.item === "Vínculo no Bling" && /registra "aguardando_importacao"/.test(p.texto)), "ficha desatualizada é apontada");
  assert.equal(d.ml.preco, 127.76); assert.equal(d.ml.quantidade, 1); assert.equal(d.ml.condicao, "new");
});

test("SKU não aparece na busca do ML: apontado, com o anúncio existente", async () => {
  const d = await diagnosticarPublicacao({ sku: SKU }, mundo({ busca: [] }).deps);
  assert.deepEqual(nivel(d, "Busca do SKU"), ["alerta"]);
  assert.match(d.pontos.find((p) => p.item === "Busca do SKU").texto, /não devolve nenhum anúncio, embora o anúncio exista/);
});

test("anúncio sem SKU gravado: erro explicado", async () => {
  const d = await diagnosticarPublicacao({ sku: SKU }, mundo({ skuAttr: "" }).deps);
  assert.deepEqual(nivel(d, "SKU no ML"), ["erro"]);
});

test("vínculo ainda não feito no Bling: 'ainda não aparece na loja'", async () => {
  const d = await diagnosticarPublicacao({ sku: SKU }, mundo({ blingAnuncios: [] }).deps);
  assert.equal(d.bling.vinculo.estado, "aguardando_importacao");
  assert.match(d.bling.vinculo.mensagem, /ainda não aparece na loja LojaOnlineSP/);
});

test("vínculo com OUTRO produto: erro", async () => {
  const d = await diagnosticarPublicacao({ sku: SKU }, mundo({ blingAnuncios: [{ mlb: MLB, produto_id: "999", id_anuncio: 1 }] }).deps);
  assert.equal(d.bling.vinculo.estado, "produto_incorreto");
});

test("ficha com MLB mas status não publicado e publicação sem MLB: erro de status", async () => {
  const d = await diagnosticarPublicacao({ sku: SKU }, mundo({ statusFluxo: "publicando", pubMlb: null }).deps);
  assert.deepEqual(nivel(d, "Status da ficha"), ["erro"]);
  assert.match(d.pontos.find((p) => p.item === "Status da ficha").texto, /status é "publicando" e a publicação NÃO tem o MLB/);
  assert.equal(d.mlb, MLB, "o MLB do registro do Bling é usado");
});

test("duplicidade: outro anúncio ativo com o mesmo SKU e dois MLBs no registro", async () => {
  const d = await diagnosticarPublicacao({ sku: SKU }, mundo({ busca: [MLB, "MLB5535099999"], regs: [{ mlb_id: MLB, ml_user_id: CONTA }, { mlb_id: "MLB5535099999", ml_user_id: CONTA }] }).deps);
  assert.deepEqual(nivel(d, "Duplicidade"), ["erro"]);
  assert.match(d.pontos.find((p) => p.item === "Duplicidade").texto, /MLB5535099999/);
  assert.deepEqual(nivel(d, "Registro interno"), ["alerta"]);
});

test("anúncio de outra conta: erro de conta vendedora", async () => {
  const d = await diagnosticarPublicacao({ sku: SKU }, mundo({ seller: "2412238242" }).deps);
  assert.deepEqual(nivel(d, "Conta vendedora"), ["erro"]);
});

test("texto para copiar não leva token/chave; tela é temporária, recolhida e só lê", () => {
  const c = ler("src/components/DiagnosticoPublicacao.jsx");
  assert.ok(!/access_token|localStorage|apikey|Authorization|sb_publishable/i.test(c), "sem token/chave na tela");
  assert.ok(!/\.update\(|\.insert\(|\.upsert\(|\.delete\(|acao: "publicar"|criar_produto/.test(c + ler("src/services/diagnosticoPublicacao.js")), "nenhuma escrita");
  assert.ok(c.includes('metodo: "GET"'));
  assert.ok(c.includes("<details data-paiia-diagnostico"));
  const central = ler("src/components/CentralPublicacao.jsx");
  assert.ok(central.includes("TEMPORÁRIO: diagnóstico somente leitura") && (central.match(/<DiagnosticoPublicacao \/>/g) || []).length === 2);
  assert.ok(!ler("src/components/PainelFichasCentral.jsx").includes("DiagnosticoPublicacao"), "o painel de fichas continua sem serviços do ML/Bling");
  const t = textoDiagnostico({ sku: SKU, mlb: MLB, conta: CONTA, pontos: [{ nivel: "ok", item: "X", texto: "y" }], fichas: [], registros: [] });
  assert.ok(!/token|Bearer/i.test(t));
});
