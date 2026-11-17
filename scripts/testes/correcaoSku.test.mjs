// =============================================================
// PAIIA — TESTES (15/11/2026): corrigir o SKU de uma ficha publicada depois que o SKU foi
// corrigido no Mercado Livre e no Bling. Caso real: parafuso MLB5560614343,
// SKU 8200642689 (errado) → 8200642489 (certo), produto Bling 16735643770, 17 un., R$ 26,75.
//   node --test scripts/testes/correcaoSku.test.mjs
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { register } from "node:module";

register("./simulacao/ganchoSupabaseFalso.mjs", import.meta.url);
const F = await import("./simulacao/supabaseFalso.mjs");
const K = await import("../../src/services/correcaoSku.js");
const ler = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

const ANTIGO = "8200642689";
const NOVO = "8200642489";
const MLB = "MLB5560614343";
const LOJA = "1729335019";
const PARAFUSO = "f5ad389b-0b45-45eb-af98-64bf755611cb";
const TAMPA = "4ab28be5-194e-45c8-b0da-4b8c0875a1af";
const FOTO = `https://arqz.supabase.co/storage/v1/object/public/imagens/${ANTIGO}/capa.png`;

function semear() {
  F.zerarBanco();
  const T = F.banco.tabelas;
  T.paiia_anuncios.push(
    { id: PARAFUSO, codigo: ANTIGO, codigo_normalizado: ANTIGO, titulo: `Parafuso Aço Temperado Cabeçote Laguna Megane ${ANTIGO}`, status_fluxo: "publicado", updated_at: "2026-11-15T13:26:56.384Z",
      dados_conferencia: {
        salvo_em: "2026-11-14T20:15:17.845Z",
        anuncio: { codigo: ANTIGO, oem: ANTIGO, titulo: `Parafuso Aço Temperado Cabeçote Laguna Megane ${ANTIGO}`, fotos: [FOTO], preco: "26.75" },
        ficha: { campos: { titulo: `Parafuso Aço Temperado Cabeçote Laguna Megane ${ANTIGO}`, preco: "26.75", quantidadeEstoque: "17", compatibilidades: "RENAULT • Laguna • Megane", descricao: `Código ${ANTIGO}. Parafuso…`, fotos: [FOTO] }, anuncioConferido: { codigo: ANTIGO, fotos: [FOTO] } },
        integracao_bling: { mlb: MLB, estado: "integrado", sku_oficial: ANTIGO, codigo_pesquisado: ANTIGO, bling_produto_id: "16735643770", preco_publicado: 26.75 },
        pos_publicacao: { mlb: MLB, sku: ANTIGO, quantidade: 17 },
        versoes_substituidas: [{ ficha: { campos: { codigo: ANTIGO } } }],
      } },
    { id: TAMPA, codigo: "7527362", codigo_normalizado: "7527362", titulo: "Flange Tampa…", status_fluxo: "publicado_com_pendencia", updated_at: "2026-11-15T12:20:00.000Z", dados_conferencia: { mlb_trocado: [{ mlb: MLB }] } },
  );
  T.paiia_anuncios_publicacoes.push(
    { id: "pp", anuncio_id: PARAFUSO, marketplace: "mercado_livre", ml_user_id: LOJA, mlb_id: MLB, bling_produto_id: "16735643770", sku: ANTIGO, sku_normalizado: ANTIGO, status_publicacao: "publicado", estoque: 17 },
    { id: "pt", anuncio_id: TAMPA, marketplace: "mercado_livre", ml_user_id: LOJA, mlb_id: "MLB7998237230", sku: "7527362", sku_normalizado: "7527362", status_publicacao: "publicado_com_pendencia" },
  );
  T.paiia_registro_mlb.push({ id: "r1", usuario_id: F.USUARIO, sku: ANTIGO, sku_normalizado: ANTIGO, ml_user_id: LOJA, mlb_id: MLB, anuncio_id: PARAFUSO, situacao: "ativo", sku_ml_divergente: null });
}
const itemML = (sku) => ({ id: MLB, seller_id: LOJA, price: 26.75, available_quantity: 17, attributes: [{ id: "SELLER_SKU", value_name: sku }] });
const depsOk = (o = {}) => ({
  lerItem: async () => itemML(NOVO),
  lerBling: async () => ({ ok: true, encontrado: true, ambiguo: false, produto: { id: "16735643770", codigo: NOVO } }),
  fichasDoCodigo: async () => [],
  ...o,
});
const linha = (t, id) => F.banco.tabelas[t].find((x) => x.id === id);

test("1) troca o SKU nos textos da ficha; endereços de fotos e histórico ficam como estão", () => {
  const { dados, trocas } = K.substituirSkuNosDados({ a: `x ${ANTIGO}`, fotos: [FOTO], url: FOTO, versoes_substituidas: [{ c: ANTIGO }], n: { sku: ANTIGO, outro: "7527362" } }, ANTIGO, NOVO);
  assert.equal(dados.a, `x ${NOVO}`);
  assert.equal(dados.n.sku, NOVO);
  assert.equal(dados.n.outro, "7527362");
  assert.equal(dados.fotos[0], FOTO, "foto intacta");
  assert.equal(dados.url, FOTO, "endereço intacto");
  assert.equal(dados.versoes_substituidas[0].c, ANTIGO, "histórico intacto");
  assert.deepEqual(trocas.sort(), ["a", "n.sku"]);
});

test("2) caso REAL do parafuso: ficha, publicação e registro passam a reconhecer 8200642489; MLB, preço, estoque, fotos e aplicações iguais", async () => {
  semear();
  const r = await K.corrigirSkuDaFicha({ anuncioId: PARAFUSO, skuAntigo: ANTIGO, skuNovo: NOVO }, depsOk());
  assert.equal(r.ok, true, JSON.stringify(r));
  const f = linha("paiia_anuncios", PARAFUSO);
  assert.equal(f.codigo, NOVO);
  assert.equal(f.codigo_normalizado, NOVO);
  assert.equal(f.titulo, `Parafuso Aço Temperado Cabeçote Laguna Megane ${NOVO}`);
  const d = f.dados_conferencia;
  assert.equal(d.anuncio.codigo, NOVO);
  assert.equal(d.anuncio.oem, NOVO);
  assert.equal(d.ficha.anuncioConferido.codigo, NOVO);
  assert.equal(d.integracao_bling.sku_oficial, NOVO);
  assert.equal(d.integracao_bling.codigo_pesquisado, NOVO);
  assert.equal(d.pos_publicacao.sku, NOVO);
  assert.equal(d.ficha.campos.descricao, `Código ${NOVO}. Parafuso…`);
  // Preservado
  assert.equal(d.integracao_bling.mlb, MLB);
  assert.equal(d.integracao_bling.bling_produto_id, "16735643770");
  assert.equal(d.ficha.campos.preco, "26.75");
  assert.equal(d.ficha.campos.quantidadeEstoque, "17");
  assert.equal(d.pos_publicacao.quantidade, 17);
  assert.equal(d.ficha.campos.compatibilidades, "RENAULT • Laguna • Megane");
  assert.equal(d.ficha.campos.fotos[0], FOTO);
  assert.equal(d.salvo_em, "2026-11-14T20:15:17.845Z", "versão aprovada não muda");
  assert.equal(d.versoes_substituidas[0].ficha.campos.codigo, ANTIGO, "histórico");
  assert.equal(d.sku_corrigido[0].de, ANTIGO);
  assert.equal(d.sku_corrigido[0].para, NOVO);
  assert.equal(f.status_fluxo, "publicado");
  // Publicação: SKU novo, MLB/estoque/produto iguais
  const p = linha("paiia_anuncios_publicacoes", "pp");
  assert.deepEqual([p.sku, p.sku_normalizado, p.mlb_id, p.estoque, p.bling_produto_id], [NOVO, NOVO, MLB, 17, "16735643770"]);
  // Registro interno: SKU não muda (banco impede); marca o SKU do ML
  const rg = linha("paiia_registro_mlb", "r1");
  assert.deepEqual([rg.sku, rg.mlb_id, rg.sku_ml_divergente], [ANTIGO, MLB, NOVO]);
  // Tampa 7527362 intacta; nada criado/apagado
  const tampa = linha("paiia_anuncios", TAMPA);
  assert.equal(tampa.codigo, "7527362");
  assert.equal(tampa.updated_at, "2026-11-15T12:20:00.000Z");
  assert.equal(linha("paiia_anuncios_publicacoes", "pt").sku, "7527362");
  assert.ok(!F.banco.chamadas.some((c) => c.op === "insert" || c.op === "delete" || c.op === "upsert"));
  assert.equal(F.banco.funcoes.length, 0, "nada enviado ao ML/Bling");
});

test("3) recusa (nada gravado): ML ainda com SKU antigo, Bling sem o SKU novo, Bling em OUTRO produto, outra ficha com o SKU novo, ficha com outro SKU", async () => {
  const casos = [
    [depsOk({ lerItem: async () => itemML(ANTIGO) }), /Corrija primeiro no Mercado Livre/],
    [depsOk({ lerBling: async () => ({ ok: true, encontrado: false }) }), /não foi encontrado/],
    [depsOk({ lerBling: async () => ({ ok: true, encontrado: true, produto: { id: "999" } }) }), /não troca de produto/],
    [depsOk({ fichasDoCodigo: async () => [{ id: "outra", status_fluxo: "rascunho" }] }), /Já existe outra ficha/],
    [depsOk({ lerItem: async () => null }), /Não consegui ler/],
  ];
  for (const [deps, re] of casos) {
    semear();
    const r = await K.corrigirSkuDaFicha({ anuncioId: PARAFUSO, skuAntigo: ANTIGO, skuNovo: NOVO }, deps);
    assert.equal(r.ok, false);
    assert.match(r.erro, re);
    assert.ok(!F.banco.chamadas.some((c) => c.op === "update"), `nada gravado (${re})`);
  }
  semear();
  const r = await K.corrigirSkuDaFicha({ anuncioId: TAMPA, skuAntigo: ANTIGO, skuNovo: NOVO }, depsOk());
  assert.match(r.erro, /está com o SKU 7527362/);
});

test("4) Diagnóstico oferece a correção só quando o MLB da ficha tem outro SKU no ML; botão de 2 toques", async () => {
  const { diagnosticarPublicacao } = await import("../../src/services/diagnosticoPublicacao.js");
  const ficha = { id: PARAFUSO, status_fluxo: "publicado", conta_destino_ml_user_id: LOJA, dados_conferencia: {}, publicacao: { mlb_id: MLB, ml_user_id: LOJA, status_publicacao: "publicado" } };
  const deps = (sku) => ({
    listarFichas: async () => ({ ok: true, anuncios: [{ id: PARAFUSO }] }),
    lerFicha: async () => ({ ok: true, anuncio: ficha }),
    lerRegistro: async () => ({ ok: true, registros: [] }),
    consultarML: async (c, cam) => (cam.startsWith(`/items/${MLB}`) ? { ok: true, dados: { ...itemML(sku), status: "active" } } : { ok: true, dados: { results: [], paging: { total: 0 } } }),
    consultarBling: async () => ({ ok: true, encontrado: false }),
  });
  const d = await diagnosticarPublicacao({ sku: ANTIGO }, deps(NOVO));
  assert.deepEqual(d.skuDivergente, { ficha: PARAFUSO, mlb: MLB, skuAntigo: ANTIGO, skuNovo: NOVO });
  assert.equal((await diagnosticarPublicacao({ sku: ANTIGO }, deps(ANTIGO))).skuDivergente, undefined);
  const t = ler("src/components/DiagnosticoPublicacao.jsx");
  assert.ok(t.includes("if (corrSku.armado !== t.ficha) { setCorrSku({ armado: t.ficha, rodando: false, r: null }); return; }"), "1º toque só arma");
});
