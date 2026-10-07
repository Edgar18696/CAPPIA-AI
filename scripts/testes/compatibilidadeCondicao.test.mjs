// =============================================================
// PAIIA — TESTES (06/10/2026, após o MLB5342409793):
//  1. Compatibilidade: paginação do catálogo ML (offset/limit na query
//     string), aplicações aprovadas → exatamente as versões que confirmam.
//  2. Zero aplicação estruturada nunca passa calada; veículos só na
//     descrição geram aviso; "publicar sem compatibilidade" só explícito.
//  3. Condição NOVO/USADO: a da ficha vai ao ML e é conferida depois.
//  4. Compatibilidade persistida na ficha = a enviada.
//   node --test scripts/testes/compatibilidadeCondicao.test.mjs
// Sem rede, sem Mercado Livre, sem Bling, sem banco.
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  resolverCompatibilidades, conferirPublicacao, normalizarCondicao, condicaoParaML,
  descricaoCitaVeiculos, situacaoCompatibilidade, lerAplicacoesAprovadas,
} from "../../src/services/compatibilidadeML.js";
import {
  conferirFichaPersistida, montarCompatibilidadesPersistidas, idsCompatPersistidos, conferirCompatPersistida, divergenciasAnuncio,
} from "../../src/services/publicacaoSegura.js";
import { diferencasAssinatura } from "../../src/services/fichaConferencia.js";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// ---------- Catálogo ML (Mercedes-Benz Classe A), lido em 06/10/2026 ----------
// As 31 versões W168 1.6 (1999–2005) e 1.9 (2001–2005), IDs reais.
const ESPERADAS = [
  ["MLB8011286", 1999, "1.6 Classic 5p"], ["MLB8011690", 1999, "1.6 Elegance 5p"],
  ["MLB8011115", 2000, "1.6 Classic 5p"], ["MLB8011589", 2000, "1.6 Classic 5p 99 hp"], ["MLB8012070", 2000, "1.6 Elegance 5p"],
  ["MLB8011961", 2001, "1.6 Classic 5p"], ["MLB8011307", 2001, "1.6 Elegance 5p"], ["MLB8011861", 2001, "1.6 Spirit 5p"],
  ["MLB8011353", 2001, "1.9 Avantgarde 5p"], ["MLB8011900", 2001, "1.9 Classic 5p"], ["MLB28048642", 2001, "1.9 Elegance 5p"],
  ["MLB8011931", 2001, "1.9 Elegance 5p Automática"], ["MLB8011347", 2001, "1.9 Elegance 5p Manual"],
  ["MLB8012017", 2002, "1.6 Classic 5p"], ["MLB8011894", 2002, "1.9 Avantgarde 5p"], ["MLB8011815", 2002, "1.9 Classic 5p"],
  ["MLB8011880", 2002, "1.9 Elegance 5p"], ["MLB8011667", 2002, "1.9 Elegance 5p Automática"], ["MLB8011790", 2002, "1.9 Spirit 5p"],
  ["MLB8011668", 2003, "1.6 Classic 5p"], ["MLB8011993", 2003, "1.9 Avantgarde 5p"], ["MLB8011480", 2003, "1.9 Classic 5p"], ["MLB8011386", 2003, "1.9 Elegance 5p"],
  ["MLB8011105", 2004, "1.6 Classic 5p"], ["MLB8011745", 2004, "1.9 Avantgarde 5p"], ["MLB8011482", 2004, "1.9 Classic 5p"], ["MLB8012000", 2004, "1.9 Elegance 5p"],
  ["MLB8011579", 2005, "1.6 Classic 5p"], ["MLB8011198", 2005, "1.9 Avantgarde 5p"], ["MLB8011217", 2005, "1.9 Classic 5p"], ["MLB8012008", 2005, "1.9 Elegance 5p"],
];
// Outras versões reais da Classe A (não podem entrar).
const OUTRAS_REAIS = [
  ["MLB15574391", 2020, "1.3 Advance 4p"], ["MLB28048647", 2014, "1.6 Urban Turbo 5p"], ["MLB8011297", 2018, "1.6 Turbo Flex 5p"],
  ["MLB8011494", 2014, "1.6 Style Turbo 5p"], ["MLB8011338", 2015, "1.6 Urban Turbo 5p"], ["MLB8011808", 2013, "1.6 Urban Turbo 5p"],
  ["MLB8011945", 2015, "1.6 Turbo 5p"], ["MLB8011472", 2015, "1.6 Turbo Flex 5p"], ["MLB8012097", 2016, "1.6 Turbo Flex 5p"],
  ["MLB8011305", 2015, "2.0 Sport Turbo 5p"], ["MLB25815438", 2010, "2.0 Elegance 5p"], ["MLB8011108", 2009, "2.0 Elegance 5p"],
  ["MLB8011465", 2006, "2.0 Elegance 5p"], ["MLB8011982", 2008, "2.0 Elegance 5p"], ["MLB8011131", 2017, "1.6 Turbo Flex 5p"],
];
function produto([id, ano, trim]) {
  const motor = trim.split(" ")[0];
  return { id, attributes: [
    { id: "BRAND", value_name: "Mercedes-Benz" }, { id: "MODEL", value_name: "Classe A" },
    { id: "VEHICLE_YEAR", value_name: String(ano) }, { id: "TRIM", value_name: trim }, { id: "ENGINE", value_name: motor },
  ] };
}
// 108 versões (como no ML): 31 esperadas + 15 reais + 62 de outros anos/motores.
const EXTRAS = Array.from({ length: 62 }, (_, i) => [`MLB9${String(i).padStart(7, "0")}`, 2006 + (i % 20), `${["1.3", "2.0", "1.6 Turbo"][i % 3]} Teste ${i} 5p`]);
const CATALOGO = [...ESPERADAS, ...OUTRAS_REAIS, ...EXTRAS]
  .map((r, i) => ({ r, k: (i * 37) % 108 })) // embaralha: as 31 ficam espalhadas pelas 3 páginas
  .sort((a, b) => a.k - b.k).map((x) => produto(x.r));

/** Simula ml_consulta. modo "query": ML respeita offset/limit da URL; "corpo": ignora (comportamento real). */
function consultaML({ paginaPorQuery = true } = {}) {
  const chamadas = [];
  const fn = async (caminho, metodo, corpo) => {
    chamadas.push({ caminho, metodo, corpo });
    if (/BRAND\/top_values/.test(caminho)) return { ok: true, dados: [{ id: "75966", name: "Mercedes-Benz" }] };
    if (/MODEL\/top_values/.test(caminho)) return { ok: true, dados: [{ id: "389427", name: "Classe A" }] };
    if (/products_search\/chunks/.test(caminho)) {
      const q = new URLSearchParams(caminho.split("?")[1] || "");
      // O ML real IGNORA offset/limit no corpo: sem query string, devolve sempre a 1ª página.
      const offset = paginaPorQuery ? Number(q.get("offset") || 0) : 0;
      const limit = paginaPorQuery ? Number(q.get("limit") || 50) : 50;
      return { ok: true, dados: { total: CATALOGO.length, results: CATALOGO.slice(offset, offset + limit) } };
    }
    return { ok: false, erro: "caminho inesperado" };
  };
  return { fn, chamadas };
}
const APLICACOES = lerAplicacoesAprovadas({ aplicacoes: [
  { montadora: "Mercedes-Benz", modelo: "Classe A", motor: "1.6", anoInicio: "1999", anoFim: "2005" },
  { montadora: "Mercedes-Benz", modelo: "Classe A", motor: "1.9", anoInicio: "2001", anoFim: "2005" },
] });

test("compatibilidade: Classe A 1.6 1999–2005 + 1.9 2001–2005 → exatamente as 31 versões (3 páginas do catálogo)", async () => {
  const { fn, chamadas } = consultaML();
  const r = await resolverCompatibilidades(APLICACOES, fn);
  assert.equal(r.erro, undefined);
  assert.deepEqual(r.veiculos.map((v) => v.id).sort(), ESPERADAS.map((e) => e[0]).sort());
  assert.equal(r.veiculos.length, 31);
  // paginação pela query string (offset 0, 50, 100)
  const offs = chamadas.filter((c) => /chunks/.test(c.caminho)).map((c) => new URLSearchParams(c.caminho.split("?")[1]).get("offset"));
  assert.ok(offs.includes("50") && offs.includes("100"));
  assert.ok(chamadas.filter((c) => /chunks/.test(c.caminho)).every((c) => c.corpo.offset === undefined));
});

test("compatibilidade: nenhuma versão fora das aplicações aprovadas (2006+, 2.0, 1.3, turbo) entra", async () => {
  const r = await resolverCompatibilidades(APLICACOES, consultaML().fn);
  const ids = new Set(r.veiculos.map((v) => v.id));
  for (const [id] of [...OUTRAS_REAIS, ...EXTRAS]) assert.equal(ids.has(id), false, id);
});

test("compatibilidade: catálogo que repete a mesma página (paginação ignorada) → erro, nunca lista parcial", async () => {
  const r = await resolverCompatibilidades(APLICACOES, consultaML({ paginaPorQuery: false }).fn);
  assert.ok(r.erro, "deveria recusar lista incompleta");
  assert.equal(r.veiculos, undefined);
});

test("zero aplicação estruturada: bloqueia; veículos só na descrição geram o aviso específico", () => {
  // Caso real: ficha 81f220fd (MLB5342409793) — aplicações só na descrição.
  const desc = "SENSOR DE POSIÇÃO DO PEDAL DO ACELERADOR\\nAplicação:\\nMercedes-Benz Classe A W168\\n1.6 — 1999 a 2005\\n1.9 — 2001 a 2005";
  const s = situacaoCompatibilidade({ aplicacoes: [], modelosSemDetalhes: [], descricao: desc.replace(/\\n/g, "\n") });
  assert.deepEqual(s, { semAplicacao: true, soNaDescricao: true, bloqueia: true });
  const semVeic = situacaoCompatibilidade({ aplicacoes: [], descricao: "Peça usada. Confira o código antes de comprar." });
  assert.deepEqual(semVeic, { semAplicacao: true, soNaDescricao: false, bloqueia: true });
});

test("zero aplicação + confirmação explícita 'publicar sem compatibilidade' → não bloqueia (vira aviso)", () => {
  const s = situacaoCompatibilidade({ aplicacoes: [], descricao: "x", semCompatibilidadeConfirmada: true });
  assert.equal(s.bloqueia, false);
  assert.equal(s.semAplicacao, true);
  // só true literal confirma (string/1 não valem)
  assert.equal(situacaoCompatibilidade({ aplicacoes: [], semCompatibilidadeConfirmada: "true" }).bloqueia, true);
});

test("com aplicação estruturada: nada bloqueia nem avisa", () => {
  const s = situacaoCompatibilidade({ aplicacoes: APLICACOES, descricao: "Aplicação: Classe A 1999 a 2005" });
  assert.deepEqual(s, { semAplicacao: false, soNaDescricao: false, bloqueia: false });
});

test("descrição cita veículos: faixa de anos ou seção de aplicação; texto comum não", () => {
  assert.equal(descricaoCitaVeiculos("Compatível com os veículos:\nDuster"), true);
  assert.equal(descricaoCitaVeiculos("Classe A 1.6 — 1999 a 2005"), true);
  assert.equal(descricaoCitaVeiculos("Garantia: 3 Meses. Código A0125423317."), false);
});

test("condição: normalização e valor do ML (nunca assume novo)", () => {
  assert.equal(normalizarCondicao("Usado"), "usado");
  assert.equal(normalizarCondicao("novo"), "novo");
  assert.equal(normalizarCondicao(""), "");
  assert.equal(normalizarCondicao("recondicionado"), "");
  assert.equal(condicaoParaML("usado"), "used");
  assert.equal(condicaoParaML("novo"), "new");
  assert.equal(condicaoParaML(undefined), "");
});

test("função de publicação: condition vem da ficha (sem 'new' fixo) e validar/publicar recusam sem condição", () => {
  const ts = fs.readFileSync(path.join(RAIZ, "supabase/functions/mercadolivre-publicacao/index.ts"), "utf8");
  assert.equal(/condition:\s*"new"/.test(ts), false, "não pode haver condition: \"new\" fixo");
  assert.match(ts, /condition:\s*condicaoML\(entrada\?\.condicao\)/);
  const corpoFn = ts.match(/function condicaoML\(v: unknown\)[^{]*\{([\s\S]*?)\n    \}/)[1];
  // eslint-disable-next-line no-new-func
  const condicaoML = new Function("texto", "v", corpoFn.replace(/: "new" \| "used" \| null/g, ""));
  const texto = (v) => String(v ?? "").trim();
  assert.equal(condicaoML(texto, "usado"), "used");
  assert.equal(condicaoML(texto, "Novo"), "new");
  assert.equal(condicaoML(texto, ""), null);
  assert.match(ts, /acao === "validar_item"[\s\S]{0,300}condicaoML\(corpo\?\.anuncio\?\.condicao\)\) return responder\(\{ ok: false, erro: ERRO_CONDICAO/);
  assert.match(ts, /acao === "publicar"[\s\S]{0,600}condicaoML\(entrada\?\.condicao\)\) return responder\(\{ ok: false, erro: ERRO_CONDICAO/);
});

test("conferência pós-publicação: condição divergente vira pendência (caso real: ficha usado, MLB saiu new)", () => {
  const item = { id: "MLB5342409793", seller_id: 1729335019, price: 184, available_quantity: 1, listing_type_id: "gold_pro", condition: "new", pictures: [{}, {}, {}], attributes: [{ id: "SELLER_SKU", value_name: "A0125423317" }] };
  const esperado = { conta: "1729335019", sku: "A0125423317", preco: "164.80", quantidade: 1, tipoAnuncio: "premium", fotos: 3, condicao: "usado" };
  const r = conferirPublicacao({ itemId: "MLB5342409793", esperado, item, compat: { products: [] } });
  assert.ok(r.pendencias.some((p) => p.startsWith("Condição")));
  assert.ok(r.pendencias.some((p) => p.startsWith("Preço")));
  const ok = conferirPublicacao({ itemId: "MLB5342409793", esperado, item: { ...item, condition: "used", price: 164.8 }, compat: { products: [] } });
  assert.deepEqual(ok.pendencias, []);
});

test("ficha persistida × envio: condição, preço e tipo de anúncio têm de ser os mesmos", () => {
  const aprovado = { titulo: "Sensor", descricao: "d", preco: "164.80", marca: "Mercedes-Benz", fotos: ["https://x/1.jpg"], codigo: "A0125423317", tipoAnuncio: "premium", condicao: "usado", quantidade: 1 };
  const base = { dados_conferencia: { ficha: { anuncioConferido: aprovado, assinaturaAprovada: "[x]" } } };
  const envio = { titulo: "Sensor", descricao: "d", preco: "164.80", marca: "Mercedes-Benz", fotos: ["https://x/1.jpg"], sku: "A0125423317", tipoAnuncio: "premium", quantidade: 1, condicao: "usado" };
  assert.equal(conferirFichaPersistida({ tela: aprovado, envio, base }).ok, true);
  assert.deepEqual(conferirFichaPersistida({ tela: aprovado, envio: { ...envio, condicao: "novo" }, base }).divergencias, ["condição"]);
  assert.deepEqual(conferirFichaPersistida({ tela: aprovado, envio: { ...envio, preco: "184" }, base }).divergencias, ["preço"]);
  assert.deepEqual(conferirFichaPersistida({ tela: aprovado, envio: { ...envio, tipoAnuncio: "classico" }, base }).divergencias, ["tipo de anúncio"]);
  // ficha antiga sem condição gravada: não derruba
  const antiga = { dados_conferencia: { ficha: { anuncioConferido: { ...aprovado, condicao: undefined }, assinaturaAprovada: "[x]" } } };
  assert.equal(divergenciasAnuncio({ ...aprovado, condicao: undefined }, antiga.dados_conferencia.ficha.anuncioConferido).length, 0);
});

test("assinatura da Conferência: mudar a condição ou a confirmação 'sem compatibilidade' derruba a aprovação", () => {
  const base = ["t", "164.80", "d", [], "", "MLB1", "Mercedes-Benz", "A0125423317", "", "", "", "", "", null, 1, "Carro/Caminhonete", "", "premium"];
  const aprovada = JSON.stringify([...base, "usado", false]);
  assert.deepEqual(diferencasAssinatura(aprovada, JSON.stringify([...base, "novo", false])), ["condição"]);
  assert.deepEqual(diferencasAssinatura(aprovada, JSON.stringify([...base, "usado", true])), ["publicar sem compatibilidade"]);
  // aprovação antiga (sem os campos novos) não cai sozinha
  assert.deepEqual(diferencasAssinatura(JSON.stringify(base), JSON.stringify([...base, "usado", false])), []);
});

test("compatibilidade persistida na ficha: gravada = enviada; diferente ou ausente bloqueia", async () => {
  const r = await resolverCompatibilidades(APLICACOES, consultaML().fn);
  const reg = montarCompatibilidadesPersistidas({ aplicacoes: APLICACOES, compat: r, agora: "2026-10-06T18:00:00.000Z" });
  assert.equal(reg.total, 31);
  assert.equal(reg.aplicacoes.length, 2);
  const base = { dados_conferencia: { compatibilidades_ml: reg } };
  const ids = r.veiculos.map((v) => v.id);
  assert.equal(idsCompatPersistidos(base).length, 31);
  assert.equal(conferirCompatPersistida({ idsEnvio: ids, base }).ok, true);
  assert.equal(conferirCompatPersistida({ idsEnvio: ids.slice(0, 9), base }).ok, false);
  assert.equal(conferirCompatPersistida({ idsEnvio: ids, base: { dados_conferencia: {} } }).ok, false);
  assert.equal(conferirCompatPersistida({ idsEnvio: [], base: null }).ok, true);
});
