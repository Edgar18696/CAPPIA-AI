// =============================================================
// PAIIA — TESTES (15/11/2026): MLB devolvido pela publicação tem de ser DESTE anúncio.
// Caso real: SKU 7527362 (ficha 4ab28be5) recebeu o MLB5560614343, anúncio do SKU
// 8200642689 (ficha f5ad389b), e o PAIIA gravou o MLB na ficha errada.
//   node --test scripts/testes/mlbDevolvido.test.mjs
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { register } from "node:module";

register("./simulacao/ganchoSupabaseFalso.mjs", import.meta.url);
const F = await import("./simulacao/supabaseFalso.mjs");
const M = await import("../../src/services/mlbDevolvido.js");
const S = await import("../../src/services/anuncioPublicacaoService.js");
const ler = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

// Filtro por caminho JSON (dados_conferencia->integracao_bling->>mlb), como o PostgREST.
const fromOriginal = F.supabase.from;
F.supabase.from = (t) => {
  const q = fromOriginal(t);
  const eq0 = q.eq.bind(q);
  q.eq = (k, v) => {
    if (!k.includes("->")) return eq0(k, v);
    const partes = k.split(/->>|->/);
    q.filtros.push((l) => String(partes.reduce((o, p) => (o == null ? null : o[p]), l)) === String(v));
    return q;
  };
  return q;
};

const PARAFUSO = { id: "MLB5560614343", title: "Parafuso Aço Temperado Cabeçote Laguna Megane 8200642689", seller_custom_field: "", attributes: [{ id: "SELLER_SKU", value_name: "8200642689" }], variations: [] };
const FLANGE = { id: "MLB6000000001", title: "Flange Tampa De Combustivel 10 Furos Uno Elba Fiorino Premio", attributes: [{ id: "SELLER_SKU", value_name: "7527362" }] };

test("1) caso REAL: servidor devolve o MLB do parafuso para a ficha da flange → recusado, com o motivo", () => {
  const r = M.avaliarMLBDevolvido({ mlb: "MLB5560614343", sku: "7527362", item: PARAFUSO });
  assert.equal(r.ok, false);
  assert.equal(r.motivo, "outro_produto");
  assert.match(r.texto, /OUTRO produto \(SKU 8200642689; esta ficha é 7527362/);
  assert.match(r.texto, /Nada foi gravado nesta ficha/);
});

test("2) MLB certo (SKU igual, também no campo antigo ou numa variação) → aceito", () => {
  assert.equal(M.avaliarMLBDevolvido({ mlb: FLANGE.id, sku: "7527362", item: FLANGE }).ok, true);
  assert.equal(M.avaliarMLBDevolvido({ mlb: "MLB6000000002", sku: "K4-BIP064", item: { id: "MLB6000000002", seller_custom_field: "k4 bip064" } }).ok, true, "normaliza traço/espaço/caixa");
  assert.equal(M.avaliarMLBDevolvido({ mlb: "MLB6000000003", sku: "BIP211", item: { id: "MLB6000000003", variations: [{ attributes: [{ id: "SELLER_SKU", value_name: "BIP211" }] }] } }).ok, true);
});

test("3) MLB que já é de OUTRA ficha, anúncio não relido, MLB inválido ou ficha sem SKU → recusado (nunca grava às cegas)", () => {
  assert.equal(M.avaliarMLBDevolvido({ mlb: FLANGE.id, sku: "7527362", item: FLANGE, outraFicha: "f5ad389b-x" }).motivo, "outra_ficha");
  assert.equal(M.avaliarMLBDevolvido({ mlb: FLANGE.id, sku: "7527362", item: null }).motivo, "nao_confirmado");
  assert.equal(M.avaliarMLBDevolvido({ mlb: FLANGE.id, sku: "7527362", item: PARAFUSO }).motivo, "nao_confirmado", "item relido de outro MLB");
  assert.equal(M.avaliarMLBDevolvido({ mlb: "123", sku: "7527362", item: FLANGE }).motivo, "mlb_invalido");
  assert.equal(M.avaliarMLBDevolvido({ mlb: FLANGE.id, sku: "", item: FLANGE }).motivo, "sem_sku");
});

test("4) conferirMLBDevolvido: relê até 3 vezes; falha ao procurar outra ficha não libera MLB de outro produto", async () => {
  let n = 0;
  const r = await M.conferirMLBDevolvido({ mlb: FLANGE.id, sku: "7527362" }, { lerItem: async () => (++n < 3 ? null : FLANGE), fichaComMLB: async () => "", esperar: async () => {} });
  assert.equal(r.ok, true);
  assert.equal(n, 3);
  const r2 = await M.conferirMLBDevolvido({ mlb: PARAFUSO.id, sku: "7527362" }, { lerItem: async () => PARAFUSO, fichaComMLB: async () => { throw new Error("rede"); }, esperar: async () => {} });
  assert.equal(r2.ok, false);
  assert.equal(r2.motivo, "outro_produto");
});

test("5) tela de publicação: confere o MLB ANTES de gravar qualquer coisa; recusado = erro visível e retorno", () => {
  const t = ler("src/components/RevisaoPublicacaoML.jsx");
  const i = t.indexOf("const r = await chamar(\"publicar\"");
  const conf = t.indexOf("conferirMLBDevolvido(", i);
  const reg = t.indexOf("registroBling = registroPublicado(", i);
  const mlbPub = t.indexOf("await registrarMLBPublicado(", i);
  assert.ok(i > 0 && conf > i && conf < reg && conf < mlbPub, "conferência antes de gravar o MLB");
  const bloco = t.slice(conf, reg);
  assert.ok(bloco.includes("if (!conf.ok)") && bloco.includes("return;"), "recusado: não segue");
  assert.ok(bloco.includes("registrarResultadoPublicacao("), "pendência registrada (aparece na Central)");
  assert.ok(!bloco.includes("registrarMLBPublicado") && !bloco.includes("garantirRegistroIntegracaoBling"), "MLB recusado nunca entra na ficha");
});

test("6) piloto: 'ficha já publicada' também confere o MLB (não confirmado = pausa antes de enviar)", () => {
  const t = ler("src/components/PilotoAutomaticoPublicacao.jsx");
  const i = t.indexOf("mlbJaPublicado: async");
  const bloco = t.slice(i, t.indexOf("progresso:", i));
  assert.ok(bloco.includes("conferirMLBDevolvido("));
  assert.ok(bloco.includes("if (!conf.ok) return { erro: conf.texto };"));
  // executarPiloto pausa ANTES de tudo quando mlbJaPublicado devolve erro (regra de 10/11).
  assert.ok(ler("src/services/pilotoPublicacao.js").includes("if (ja?.erro) return pausa(\"canais\""));
});

test("7) autorização única: nº guardado só por ficha COM ID; sem ID, sempre nº novo (nunca compartilhado)", () => {
  const t = ler("src/components/AutorizacaoUnicaPublicacao.jsx");
  assert.ok(t.includes("const fichaDaAut = /^[0-9a-f-]{36}$/i.test(String(anuncioId || \"\")) ? String(anuncioId) : \"\";"));
  assert.ok(!t.includes("sessionStorage.getItem(CHAVE(anuncioId))"), "não lê mais a chave com ID vazio");
});

function semear() {
  F.zerarBanco();
  const T = F.banco.tabelas;
  T.paiia_anuncios.push(
    { id: "f5ad389b-0000-4000-8000-000000000001", codigo: "8200642689", status_fluxo: "publicado", updated_at: "2026-11-15T10:26:00.007Z", dados_conferencia: { integracao_bling: { mlb: "MLB5560614343", estado: "integrado" } } },
    { id: "4ab28be5-194e-45c8-b0da-4b8c0875a1af", codigo: "7527362", status_fluxo: "publicado", updated_at: "2026-11-15T11:27:00.411Z", dados_conferencia: {
      salvo_em: "2026-11-15T09:56:00.236Z", ficha: { campos: { preco: "36.54" } }, base_paiia: { decisao: "nao" },
      integracao_bling: { mlb: "MLB5560614343", estado: "produto_incorreto", sku_oficial: "7527362", bling_produto_id: "16735738672" },
      pos_publicacao: { mlb: "MLB5560614343", concluido: false, sku: "7527362" },
    } },
  );
  T.paiia_anuncios_publicacoes.push(
    { id: "p1", anuncio_id: "f5ad389b-0000-4000-8000-000000000001", marketplace: "mercado_livre", mlb_id: "MLB5560614343", status_publicacao: "publicado" },
    { id: "p2", anuncio_id: "4ab28be5-194e-45c8-b0da-4b8c0875a1af", marketplace: "mercado_livre", mlb_id: null, status_publicacao: "pendente" },
  );
}

test("8) fichaComMLB: acha a OUTRA ficha dona do MLB (publicação ou registro do Bling); a própria ficha não conta", async () => {
  semear();
  assert.equal(await S.fichaComMLB("MLB5560614343", "4ab28be5-194e-45c8-b0da-4b8c0875a1af"), "f5ad389b-0000-4000-8000-000000000001");
  assert.equal(await S.fichaComMLB("MLB5560614343", "f5ad389b-0000-4000-8000-000000000001"), "4ab28be5-194e-45c8-b0da-4b8c0875a1af", "registro do Bling também conta");
  assert.equal(await S.fichaComMLB("MLB9999999999", ""), "");
});

test("9) correção PREPARADA da ficha 4ab28be5: tira o MLB do parafuso, volta para aprovada, guarda o registro errado; nada apagado", async () => {
  semear();
  const r = await S.desfazerMLBDeOutroProduto({ anuncioId: "4ab28be5-194e-45c8-b0da-4b8c0875a1af", mlb: "MLB5560614343", motivo: "teste" });
  assert.equal(r.ok, true, JSON.stringify(r));
  const f = F.banco.tabelas.paiia_anuncios.find((x) => x.id.startsWith("4ab28be5"));
  assert.equal(f.status_fluxo, "conferencia_aprovada");
  assert.equal(f.dados_conferencia.integracao_bling, undefined);
  assert.equal(f.dados_conferencia.pos_publicacao, undefined);
  assert.equal(f.dados_conferencia.mlb_trocado[0].mlb, "MLB5560614343");
  assert.equal(f.dados_conferencia.mlb_trocado[0].integracao_bling.bling_produto_id, "16735738672", "registro errado guardado");
  assert.equal(f.dados_conferencia.ficha.campos.preco, "36.54", "aprovação, preço e resto intactos");
  assert.equal(f.dados_conferencia.salvo_em, "2026-11-15T09:56:00.236Z", "versão da ficha não muda");
  assert.deepEqual(f.dados_conferencia.base_paiia, { decisao: "nao" });
  // A ficha do parafuso e as publicações não foram tocadas; nada inserido/apagado.
  const p = F.banco.tabelas.paiia_anuncios.find((x) => x.id.startsWith("f5ad389b"));
  assert.equal(p.dados_conferencia.integracao_bling.mlb, "MLB5560614343");
  assert.equal(F.banco.tabelas.paiia_anuncios_publicacoes.find((x) => x.id === "p1").mlb_id, "MLB5560614343");
  assert.ok(!F.banco.chamadas.some((c) => c.op === "insert" || c.op === "delete" || (c.op === "update" && c.tabela === "paiia_anuncios_publicacoes")));
  // "mlb_trocado" é preservado nas próximas gravações da Conferência.
  assert.ok(S.CHAVES_PRESERVADAS_FICHA.includes("mlb_trocado"));
});

test("10) correção recusa quando o MLB é MESMO da ficha (publicação tem o MLB) ou não está registrado", async () => {
  semear();
  const r1 = await S.desfazerMLBDeOutroProduto({ anuncioId: "f5ad389b-0000-4000-8000-000000000001", mlb: "MLB5560614343" });
  assert.equal(r1.ok, false);
  assert.match(r1.erro, /não é um registro trocado/);
  const r2 = await S.desfazerMLBDeOutroProduto({ anuncioId: "4ab28be5-194e-45c8-b0da-4b8c0875a1af", mlb: "MLB1111111111" });
  assert.equal(r2.ok, false);
  assert.ok(!F.banco.chamadas.some((c) => c.op === "update"), "nada gravado");
});
