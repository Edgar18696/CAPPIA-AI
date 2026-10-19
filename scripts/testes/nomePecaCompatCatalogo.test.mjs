// =============================================================
// PAIIA — TESTES: Nome da peça e correspondência de modelo com o catálogo
// do Mercado Livre (correção definitiva, 18/10/2026).
//   node --test scripts/testes/nomePecaCompatCatalogo.test.mjs
// Caso de referência: SKU 7701040840 "Suporte Cavalete Pinça de Freio Clio II
// 1.6 16V" (TRW), aplicação manual Renault Clio II 1.6 16V 2009–2016.
// Catálogo do ML SIMULADO (nenhuma consulta real).
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { decidirNomePeca, extrairProdutoPrincipal, identificarProdutoPrincipal } from "../../src/services/nomePecaFicha.js";
import {
  aplicacoesDaFicha, separarAplicacoesParaML, candidatosModeloCatalogo, aplicarCorrespondencias,
  chaveModeloML, resolverCompatibilidades, avaliarVeiculo, lerAplicacoesAprovadas,
} from "../../src/services/compatibilidadeML.js";
import { montarCompatibilidadesPersistidas } from "../../src/services/publicacaoSegura.js";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ler = (r) => fs.readFileSync(path.join(RAIZ, r), "utf8").replace(/\r\n/g, "\n");

const TITULO = "Suporte Cavalete Pinça de Freio Clio II 1.6 16V";
const CONTEXTO = new Set(["renault", "clio", "ii", "1.6", "16v"]);

// ---------- Nome da peça ----------
test("N1) sem base: nome vem do título, sem veículo/anos/motor", () => {
  const r = decidirNomePeca({ titulo: TITULO, descricao: "SUPORTE DO CAVALETE DA PINÇA\n\nAplicação: Renault Clio II", contexto: CONTEXTO });
  assert.deepEqual([r.nome, r.origem, r.estado], ["Suporte Cavalete Pinça de Freio", "anuncio", "ok"]);
  // mesmo sem o contexto da aplicação (ficha sem aplicações)
  assert.equal(decidirNomePeca({ titulo: TITULO }).nome, "Suporte Cavalete Pinça de Freio");
});

test("N2) base/catálogo tem prioridade sobre o título; cadastro antes do título", () => {
  assert.deepEqual(pick(decidirNomePeca({ base: "Suporte da Pinça", titulo: TITULO })), ["Suporte da Pinça", "base"]);
  assert.deepEqual(pick(decidirNomePeca({ cadastro: "Cavalete de freio", titulo: TITULO })), ["Cavalete de freio", "cadastro"]);
});
const pick = (r) => [r.nome, r.origem];

test("N3) nome MANUAL/CONFIRMADO nunca é sobrescrito (base, cadastro ou título diferentes)", () => {
  for (const origemSalva of ["manual", "confirmado"]) {
    const r = decidirNomePeca({ salvo: "Suporte da pinça dianteira", origemSalva, base: "Outro nome", cadastro: "X", titulo: "Bomba de combustível Gol" });
    assert.deepEqual(pick(r), ["Suporte da pinça dianteira", origemSalva]);
  }
});

test("N4) ficha ANTIGA com nome gravado (sem origem) é mantida; ficha antiga sem nome recebe o do título", () => {
  assert.deepEqual(pick(decidirNomePeca({ salvo: "Cavalete", titulo: TITULO })), ["Cavalete", "ficha"]);
  assert.deepEqual(pick(decidirNomePeca({ salvo: "", titulo: TITULO })), ["Suporte Cavalete Pinça de Freio", "anuncio"]);
});

test("N5) nome tirado do título é recalculado se o título mudar (não é manual)", () => {
  assert.equal(decidirNomePeca({ salvo: "Suporte Cavalete Pinça de Freio", origemSalva: "anuncio", titulo: "Bomba de Combustível Clio II" }).nome, "Bomba de Combustível");
});

test("N6) ambiguidade → pede confirmação (não preenche): título × descrição, tipo não reconhecido, só descrição", () => {
  const c = decidirNomePeca({ titulo: TITULO, descricao: "Bomba de combustível nova" });
  assert.equal(c.estado, "confirmar"); assert.equal(c.nome, "");
  assert.deepEqual(c.sugestoes.map((s) => s.fonte), ["título do anúncio", "descrição do anúncio"]);
  const t = decidirNomePeca({ titulo: "Sapata Pinca Freio Fiat" });
  assert.equal(t.estado, "confirmar"); assert.equal(t.nome, "");
  const d = decidirNomePeca({ titulo: "Renault Clio 2009 1.6", descricao: "Sensor de rotação. Aplicação: Clio", contexto: CONTEXTO });
  assert.equal(d.estado, "confirmar"); assert.equal(d.nome, ""); assert.equal(d.sugestoes[0].nome, "Sensor de rotação");
  // descrição genérica não é sugestão, e sinônimos não são conflito
  assert.equal(decidirNomePeca({ titulo: "Renault Clio 2009", descricao: "Produto original de qualidade", contexto: CONTEXTO }).estado, "vazio");
  assert.equal(decidirNomePeca({ titulo: "Bico Injetor Gol 1.0", descricao: "Injetor de combustível" }).estado, "ok");
});

test("N7) categoria: extração do produto principal inalterada (movida para o serviço)", () => {
  assert.equal(extrairProdutoPrincipal(TITULO).principal, "Suporte Cavalete Pinça de Freio");
  assert.equal(identificarProdutoPrincipal({ anuncio: {}, nomePeca: "", nomePecaBase: "", titulo: TITULO, descricao: "" }).fonte, "título do anúncio");
  const conf = ler("src/components/MercadoLivreTeste.jsx");
  assert.ok(!/^function extrairProdutoPrincipal/m.test(conf) && /from "\.\.\/services\/nomePecaFicha"/.test(conf));
});

test("N8) Conferência: origem do nome gravada na ficha; edição = manual; sugestão = confirmado; abrir não grava", () => {
  const conf = ler("src/components/MercadoLivreTeste.jsx");
  assert.match(conf, /origemSalva: fichaSalva\?\.campos\?\.nomePecaOrigem/);
  assert.match(conf, /onChange=\{\(v\) => editarNomePeca\(v, "manual"\)\}/);
  assert.match(conf, /onClick=\{\(\) => editarNomePeca\(sg\.nome, "confirmado"\)\}/);
  assert.match(conf, /\n    nomePeca,\n    nomePecaOrigem,\n/);
  // a regra "só edição real grava" continua
  assert.match(conf, /if \(!usuarioEditouRef\.current && !gravacaoInicialPermitidaRef\.current\) return \{ ok: true, semEdicao: true \};/);
});

// ---------- Compatibilidade ----------
const FICHA_7701 = {
  aplicacoesDetalhadas: [{ montadora: "Renault", modelo: "Clio II", motor: "1.6 16V", anoInicio: 2009, anoFim: 2016 }],
  modelosSemDetalhes: [],
  compatibilidades: "RENAULT\n\n• Clio II\n  Motor: 1.6 16V\n  Período: 2009 até 2016",
};
const veic = (id, ano, trim, motor, modelo = "Clio") => ({ id, attributes: [{ id: "BRAND", value_name: "Renault" }, { id: "MODEL", value_name: modelo }, { id: "VEHICLE_YEAR", value_name: String(ano) }, { id: "TRIM", value_name: trim }, { id: "ENGINE", value_name: motor }] });
const PRODUTOS = {
  "m-clio": [
    veic("MLB1001", 2009, "Hatch 1.6 16V Privilège", "1.6"),
    veic("MLB1002", 2010, "Hatch 1.6 16V Expression", "1.6"),
    veic("MLB1003", 2012, "Hatch 1.0 16V Authentique", "1.0"),
    veic("MLB1004", 2016, "Hatch 1.0 16V Expression", "1.0"),
    veic("MLB1005", 2005, "Hatch 1.6 16V Privilège", "1.6"),
    veic("MLB1006", 2013, "Sedan 1.6 8V", "1.6"),
  ],
  "m-clio-sedan": [veic("MLB2001", 2010, "Sedan 1.6 16V Privilège", "1.6", "Clio Sedan")],
};
const MODELOS = [{ id: "m-clio", name: "Clio" }, { id: "m-clio-sedan", name: "Clio Sedan" }, { id: "m-sandero", name: "Sandero" }, { id: "m-logan", name: "Logan" }];
function catalogo(modelos = MODELOS) {
  const chamadas = [];
  const consultar = async (caminho, metodo, corpo) => {
    chamadas.push(caminho.split("?")[0]);
    if (/BRAND\/top_values/.test(caminho)) return { ok: true, dados: [{ id: "60297", name: "Renault" }] };
    if (/MODEL\/top_values/.test(caminho)) return { ok: true, dados: modelos };
    if (/products_search/.test(caminho)) {
      const id = corpo.known_attributes.find((k) => k.id === "MODEL").value_ids[0];
      const l = PRODUTOS[id] || [];
      return { ok: true, dados: { results: l, total: l.length } };
    }
    return { ok: false, erro: "?" };
  };
  return { consultar, chamadas };
}

test("C1) Publicação usa a LISTA APROVADA da Conferência (não reconverte o texto); ficha antiga só com texto continua lida", () => {
  const a = aplicacoesDaFicha(FICHA_7701);
  assert.equal(a.origem, "lista_aprovada");
  assert.deepEqual(a.lista.map((x) => [x.montadora, x.modelo, x.anoInicio, x.anoFim]), [["Renault", "Clio II", 2009, 2016]]);
  const antiga = aplicacoesDaFicha({ compatibilidades: FICHA_7701.compatibilidades });
  assert.equal(antiga.origem, "texto");
  assert.equal(separarAplicacoesParaML(antiga.lista).detalhadas.length, 1);
  // modelos sem detalhes da lista aprovada continuam "sem detalhes"
  const m = aplicacoesDaFicha({ aplicacoesDetalhadas: [], modelosSemDetalhes: [{ montadora: "Volkswagen", modelo: "Jetta" }] });
  assert.equal(separarAplicacoesParaML(m.lista).semDetalhes.length, 1);
  assert.equal(separarAplicacoesParaML(m.lista).detalhadas.length, 0);
  const rev = ler("src/components/RevisaoPublicacaoML.jsx");
  assert.match(rev, /aplicacoesDaFicha\(anuncio\)\.lista/);
});

test("C2) (regra de 19/10) Clio II → Clio AUTOMÁTICO quando é a única correspondência segura; só 2009–2016 1.6 16V", async () => {
  const { consultar } = catalogo();
  const sep = separarAplicacoesParaML(aplicacoesDaFicha(FICHA_7701).lista);
  const r = await resolverCompatibilidades(sep.detalhadas, consultar);
  assert.deepEqual(r.veiculos.map((v) => v.id).sort(), ["MLB1001", "MLB1002"]);
  assert.ok(r.veiculos.every((v) => v.correspondencia === "automatica" && v.modeloCatalogo === "Clio"));
  assert.deepEqual(r.correspondencias.map((c) => [c.modeloDigitado, c.modeloCatalogo, c.tipo]), [["Clio II", "Clio", "automatica"]]);
  assert.equal(r.semCatalogo.length, 0);
  // Clio Sedan (outro modelo) não entra
  assert.ok(!r.veiculos.some((v) => v.id === "MLB2001"));
});

test("C3) correspondência CONFIRMADA: só veículos do período, motor e válvulas aprovados", async () => {
  const { consultar } = catalogo();
  const sep = separarAplicacoesParaML(aplicacoesDaFicha(FICHA_7701).lista);
  const mapa = { "renault|clio ii": { montadora: "Renault", modelo_digitado: "Clio II", modelo_id: "m-clio", modelo_nome: "Clio" } };
  const aps = aplicarCorrespondencias(sep.detalhadas, mapa);
  assert.deepEqual(aps[0].modeloCatalogo, { id: "m-clio", nome: "Clio" });
  const r = await resolverCompatibilidades(aps, consultar);
  assert.deepEqual(r.veiculos.map((v) => v.id).sort(), ["MLB1001", "MLB1002"]);
  assert.ok(r.veiculos.every((v) => v.modeloCatalogo === "Clio"));
  const motivos = Object.fromEntries(r.descartados.map((d) => [d.id, d.motivo]));
  assert.match(motivos.MLB1003, /motor/); assert.match(motivos.MLB1004, /motor/);
  assert.match(motivos.MLB1005, /fora do período/); assert.match(motivos.MLB1006, /16v/);
  assert.equal(r.semCatalogo.length, 0);
  // o Clio Sedan (outro modelo do catálogo) não entra
  assert.ok(!r.veiculos.some((v) => v.id === "MLB2001"));
});

test("C4) modelo confirmado que sumiu do catálogo → pendente (nada inventado); nome exato continua direto", async () => {
  const { consultar } = catalogo([{ id: "m-sandero", name: "Sandero" }]);
  const aps = aplicarCorrespondencias(separarAplicacoesParaML(aplicacoesDaFicha(FICHA_7701).lista).detalhadas, { "renault|clio ii": { modelo_id: "m-clio", modelo_nome: "Clio" } });
  const r = await resolverCompatibilidades(aps, consultar);
  assert.equal(r.veiculos.length, 0);
  assert.match(r.semCatalogo[0].motivo, /não existe mais no catálogo/);
  const ex = await resolverCompatibilidades([{ montadora: "Renault", modelo: "Clio", motor: "1.6 16V", anoInicio: 2009, anoFim: 2016 }], catalogo().consultar);
  assert.deepEqual(ex.veiculos.map((v) => v.id).sort(), ["MLB1001", "MLB1002"]);
});

test("C5) modelo sem candidato: nada associado; montadora sem catálogo: nada associado", async () => {
  const r = await resolverCompatibilidades([{ montadora: "Renault", modelo: "Twingo", motor: "1.0", anoInicio: 2000, anoFim: 2002 }], catalogo().consultar);
  assert.equal(r.veiculos.length, 0);
  assert.deepEqual(r.semCatalogo[0].candidatos, []);
  assert.equal(r.semCatalogo[0].modelosMarca.length, 4);
  const m = await resolverCompatibilidades([{ montadora: "Lada", modelo: "Niva", motor: "1.6", anoInicio: 1990, anoFim: 1995 }], catalogo().consultar);
  assert.match(m.semCatalogo[0].motivo, /montadora Lada não encontrada/);
});

test("C6) candidatos: só sugestão por nome (geração/novo); nunca modelos sem relação", () => {
  const ml = [{ id: 1, name: "Uno" }, { id: 2, name: "Uno Mille" }, { id: 3, name: "Palio" }, { id: 4, name: "Golf" }, { id: 5, name: "Golf Variant" }];
  assert.deepEqual(candidatosModeloCatalogo("Novo Uno", ml).map((c) => c.nome), ["Uno", "Uno Mille"]);
  assert.deepEqual(candidatosModeloCatalogo("Golf IV", ml).map((c) => c.nome), ["Golf", "Golf Variant"]);
  assert.deepEqual(candidatosModeloCatalogo("Clio II", ml), []);
  assert.equal(chaveModeloML("Citroën", "C4 Pallas"), "citroen|c4 pallas");
});

test("C7) versão aprovada também é conferida no catálogo", () => {
  const p = veic("MLB9", 2010, "Hatch 1.6 16V Expression", "1.6");
  assert.equal(avaliarVeiculo(p, { motor: "1.6 16V", anoInicio: 2009, anoFim: 2016, versao: "Expression" }).ok, true);
  assert.match(avaliarVeiculo(p, { motor: "1.6 16V", anoInicio: 2009, anoFim: 2016, versao: "Privilège" }).motivo, /versão Privilège não confirmada/);
  assert.equal(lerAplicacoesAprovadas({ aplicacoes: [{ montadora: "Renault", modelo: "Clio", motor: "1.6", versao: "Expression", anoInicio: 2009 }] })[0].versao, "Expression");
});

test("C8) gravado na ficha: correspondência + versão vão junto das aplicações; chave preservada nos rascunhos", () => {
  const p = montarCompatibilidadesPersistidas({ aplicacoes: [{ montadora: "Renault", modelo: "Clio II", motor: "1.6 16V", anoInicio: 2009, anoFim: 2016, modeloCatalogo: { id: "m-clio", nome: "Clio" } }], compat: { veiculos: [{ id: "MLB1001", nome: "x" }] } });
  assert.deepEqual(p.aplicacoes[0].modelo_catalogo, { id: "m-clio", nome: "Clio" });
  const svc = ler("src/services/anuncioPublicacaoService.js");
  assert.match(svc, /"correspondencias_modelo_ml"/);
  assert.match(svc, /export async function registrarCorrespondenciaModeloML/);
  assert.match(svc, /publicacaoExiste\(atual\.anuncio\.publicacao\)\) return \{ ok: false, erro: "Esta ficha já foi publicada/);
  const rev = ler("src/components/RevisaoPublicacaoML.jsx");
  assert.match(rev, /data-paiia-confirmar-modelo-ml/);
  assert.match(rev, /lerCorrespondenciasModeloML\(ficha\.anuncioId\)/);
  // nada de associação automática: o registro só acontece no clique de confirmação
  assert.equal((rev.match(/registrarCorrespondenciaModeloML\(/g) || []).length, 2);
  assert.match(rev, /onClick=\{\(\) => confirmarModeloCatalogo\(x, escolhaModelo\[x\.chave\]\)\}/);
});
