// =============================================================
// PAIIA — TESTES: compatibilidades dos ANÚNCIOS MANUAIS (19/10/2026).
//   node --test scripts/testes/compatManualDescricao.test.mjs
// A descrição do anúncio manual é a fonte autorizada das aplicações; a
// correspondência de nome é automática só quando única e segura; nada é
// ampliado nem trocado; sucesso só com veículos aceitos pelo ML.
// Catálogo do ML SIMULADO (nenhuma consulta real).
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extrairAplicacoesDaDescricao, lerLinhaAplicacao } from "../../src/services/aplicacoesDescricao.js";
import { resolverCompatibilidades, correspondenciaAutomatica, separarAplicacoesParaML, lerAplicacoesAprovadas, idsCompatibilidadesLidas, resultadoCompatibilidades, conferirPublicacao } from "../../src/services/compatibilidadeML.js";
import { conferirCompatibilidadesMLB, enviarCompatibilidadesFaltantes, aplicacoesDaFichaPublicada } from "../../src/services/correcaoCompatMLB.js";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ler = (r) => fs.readFileSync(path.join(RAIZ, r), "utf8").replace(/\r\n/g, "\n");

const veic = (id, ano, trim, motor, modelo = "Clio", marca = "Renault") => ({ id, attributes: [{ id: "BRAND", value_name: marca }, { id: "MODEL", value_name: modelo }, { id: "VEHICLE_YEAR", value_name: String(ano) }, { id: "TRIM", value_name: trim }, { id: "ENGINE", value_name: motor }] });
const POR_MODELO = {
  "m-clio": [veic("MLB1001", 2009, "Hatch 1.6 16V Privilège", "1.6"), veic("MLB1002", 2010, "Hatch 1.6 16V Expression", "1.6"), veic("MLB1003", 2012, "Hatch 1.0 16V Authentique", "1.0"), veic("MLB1005", 2005, "Hatch 1.6 16V Privilège", "1.6")],
  "m-clio-sedan": [veic("MLB2001", 2010, "Sedan 1.6 16V Privilège", "1.6", "Clio Sedan")],
  "m-logan": [veic("MLB3001", 2010, "1.6 8V Expression", "1.6", "Logan"), veic("MLB3002", 2016, "1.6 8V Expression", "1.6", "Logan")],
  "m-sandero": [veic("MLB4001", 2012, "1.6 8V Expression", "1.6", "Sandero"), veic("MLB4002", 2012, "1.0 16V Authentique", "1.0", "Sandero")],
  "m-palio": [veic("MLB5001", 2012, "1.0 Fire", "1.0", "Palio", "Fiat")],
};
const MODELOS = { Renault: [{ id: "m-clio", name: "Clio" }, { id: "m-clio-sedan", name: "Clio Sedan" }, { id: "m-logan", name: "Logan" }, { id: "m-sandero", name: "Sandero" }], Fiat: [{ id: "m-palio", name: "Palio" }] };
function catalogo(modelos = MODELOS) {
  const marcas = [{ id: "b-renault", name: "Renault" }, { id: "b-fiat", name: "Fiat" }];
  return async (caminho, metodo, corpo) => {
    if (/BRAND\/top_values/.test(caminho)) return { ok: true, dados: marcas };
    if (/MODEL\/top_values/.test(caminho)) {
      const b = corpo.known_attributes[0].value_id;
      return { ok: true, dados: modelos[marcas.find((m) => m.id === b).name] || [] };
    }
    if (/products_search/.test(caminho)) {
      const id = corpo.known_attributes.find((k) => k.id === "MODEL").value_ids[0];
      const l = POR_MODELO[id] || [];
      return { ok: true, dados: { results: l, total: l.length } };
    }
    return { ok: false, erro: "?" };
  };
}
const daDescricao = (t) => separarAplicacoesParaML(lerAplicacoesAprovadas({ aplicacoes: extrairAplicacoesDaDescricao(t).detalhadas })).detalhadas;

test("M1) descrição manual com UM veículo → aplicação exatamente como escrita → vinculada (Clio II → Clio automático)", async () => {
  const t = "SUPORTE CAVALETE DA PINÇA DE FREIO\n\nAplicação: Renault Clio II 1.6 16V 2009 a 2016\n\nCódigo de Referência: 7701040840";
  const e = extrairAplicacoesDaDescricao(t);
  assert.deepEqual(e.detalhadas, [{ montadora: "Renault", modelo: "Clio II", motor: "1.6 16V", versao: "", anoInicio: 2009, anoFim: 2016 }]);
  const r = await resolverCompatibilidades(daDescricao(t), catalogo());
  assert.deepEqual(r.veiculos.map((v) => v.id).sort(), ["MLB1001", "MLB1002"]);
});

test("M2) vários modelos e intervalos de anos (/ e linhas), sem misturar motores", async () => {
  const t = "BOMBA\n\nAplicações:\nRenault Logan / Sandero 1.6 8V 2008 até 2014\nFiat Palio 1.0 2012\n\nGarantia: 3 meses";
  const e = extrairAplicacoesDaDescricao(t);
  assert.deepEqual(e.detalhadas.map((a) => `${a.montadora} ${a.modelo} ${a.motor} ${a.anoInicio}-${a.anoFim}`), ["Renault Logan 1.6 8V 2008-2014", "Renault Sandero 1.6 8V 2008-2014", "Fiat Palio 1.0 2012-2012"]);
  const r = await resolverCompatibilidades(daDescricao(t), catalogo());
  assert.deepEqual(r.veiculos.map((v) => v.id).sort(), ["MLB3001", "MLB4001", "MLB5001"]);
  // Logan 2016 fora do período e Sandero 1.0 descartados (nunca ampliados)
  const desc = Object.fromEntries(r.descartados.map((d) => [d.id, d.motivo]));
  assert.match(desc.MLB3002, /fora do período/);
  assert.match(desc.MLB4002, /motor 1\.0 diferente de 1\.6 8V/);
});

test("M3) correspondência automática só quando ÚNICA e segura", () => {
  const ml = [{ id: 1, name: "Clio" }, { id: 2, name: "Clio Sedan" }, { id: 3, name: "Gol" }, { id: 4, name: "Uno" }, { id: 5, name: "Uno Mille" }];
  assert.equal(correspondenciaAutomatica("Clio II", ml).modelo.name, "Clio");
  assert.equal(correspondenciaAutomatica("Gol G5", ml).modelo.name, "Gol");
  assert.equal(correspondenciaAutomatica("Novo Uno", ml).modelo.name, "Uno");
  assert.equal(correspondenciaAutomatica("Clio Hatch", ml).modelo, null); // não é geração: não adivinha
  assert.equal(correspondenciaAutomatica("Clio II", [{ id: 1, name: "Clio" }, { id: 9, name: "CLIO" }]).modelo, null); // dois iguais: ambíguo
});

test("M4) ambíguo (Clio Hatch × Clio Sedan no catálogo, sem 'Clio'): nada vinculado, aplicação preservada e sinalizada", async () => {
  const modelos = { ...MODELOS, Renault: [{ id: "m-clio-hatch", name: "Clio Hatch" }, { id: "m-clio-sedan", name: "Clio Sedan" }] };
  const r = await resolverCompatibilidades(daDescricao("Aplicação: Renault Clio 1.6 16V 2009 a 2016"), catalogo(modelos));
  assert.equal(r.veiculos.length, 0);
  assert.equal(r.semCatalogo[0].ambiguo, true);
  assert.match(r.semCatalogo[0].motivo, /ambíguo/);
  assert.deepEqual(r.semCatalogo[0].candidatos.map((c) => c.nome), ["Clio Hatch", "Clio Sedan"]);
});

test("M5) motor ou ano que o catálogo não tem: NADA substituído (1.6 nunca vira 1.0) nem ampliado", async () => {
  const r = await resolverCompatibilidades(daDescricao("Aplicação: Renault Clio II 2.0 16V 2009 a 2016"), catalogo());
  assert.equal(r.veiculos.length, 0);
  assert.match(r.semCatalogo[0].motivo, /nenhum veículo do catálogo .* confirma/);
  const r2 = await resolverCompatibilidades(daDescricao("Aplicação: Renault Clio II 1.6 16V 2020 a 2022"), catalogo());
  assert.equal(r2.veiculos.length, 0);
  // e a aplicação lida continua exatamente como escrita
  assert.equal(extrairAplicacoesDaDescricao("Aplicação: Renault Clio II 2.0 16V 2009 a 2016").detalhadas[0].motor, "2.0 16V");
});

test("M6) linhas que não dá para ler com segurança: listadas, nunca inventadas", () => {
  const e = extrairAplicacoesDaDescricao("Aplicação: Renault Clio 2012 2014 2016\nJetta 2011");
  assert.equal(e.detalhadas.length, 0);
  assert.equal(e.naoLidas.length, 2);
  assert.match(e.naoLidas[0].motivo, /vários anos/);
  assert.equal(lerLinhaAplicacao("Jetta 2011").naoLida, true);
  // só montadora + modelo = modelo sem detalhes (não vira todos os anos/motores)
  const s = extrairAplicacoesDaDescricao("Aplicação: Citroën C3");
  assert.deepEqual(s.modelos, [{ montadora: "Citroën", modelo: "C3" }]);
});

test("M7) Conferência: anúncio MANUAL usa a descrição (sem exigir catálogo PDF); anúncio da BASE PDF não mistura", () => {
  const conf = ler("src/components/MercadoLivreTeste.jsx");
  assert.match(conf, /const origemManualDaFicha =\n  !anuncio\?\.pecaEncontrada &&\n  !\(Array\.isArray\(anuncio\?\.aplicacoes\) && anuncio\.aplicacoes\.length\);/);
  assert.match(conf, /if \(!origemManualDaFicha\) return \{ aplicar: false/);
  assert.match(conf, /aplicar: Boolean\(assinatura\) && !jaLida && !temSalvas/);
  assert.match(conf, /\n    aplicacoesDescricaoLidas,\n/);
});

test("M8) depois do envio: nunca sucesso com zero aceitos; MLBU relido", () => {
  assert.equal(resultadoCompatibilidades({ enviados: ["MLB1"], lidos: new Set() }).estado, "zero");
  assert.equal(resultadoCompatibilidades({ enviados: ["MLB1"], lidos: new Set() }).sucesso, false);
  assert.equal(resultadoCompatibilidades({ enviados: ["MLB1", "MLB2"], lidos: new Set(["MLB1"]) }).estado, "parcial");
  assert.equal(resultadoCompatibilidades({ enviados: ["MLB1"], lidos: null }).estado, "nao_relido");
  assert.equal(resultadoCompatibilidades({ enviados: ["MLB1"], lidos: new Set(["MLB1"]) }).sucesso, true);
  assert.equal(resultadoCompatibilidades({ enviados: [], aplicacoesInformadas: 2 }).sucesso, false);
  assert.deepEqual([...idsCompatibilidadesLidas({ products: [{ catalog_product_id: "MLB1" }] }, { products: [{ id: "mlb2" }] })].sort(), ["MLB1", "MLB2"]);
  const v = conferirPublicacao({ itemId: "MLB9", esperado: { compatibilidades: ["MLB1"] }, item: { id: "MLB9", attributes: [], pictures: [{}] }, compat: { products: [] } });
  assert.ok(v.pendencias.some((p) => /^Compatibilidades/.test(p)));
  const rev = ler("src/components/RevisaoPublicacaoML.jsx");
  assert.match(rev, /caminho: `\/user-products\/\$\{up\}\/compatibilities`/);
  assert.match(rev, /if \(idsCompat\.length && !resultadoCompat\.sucesso/);
  assert.match(rev, /data-paiia-compat-informadas/);
  assert.match(rev, /data-paiia-compat-correspondidas/);
  assert.match(rev, /data-paiia-compat-aceitas/);
});

function fichaPublicada() {
  return {
    id: "f1",
    dados_conferencia: {
      ficha: { anuncioConferido: { aplicacoesDetalhadas: [{ montadora: "Renault", modelo: "Clio II", motor: "1.6 16V", anoInicio: 2009, anoFim: 2016, origem: "manual", fonte: "descricao" }, { montadora: "Renault", modelo: "Twingo", motor: "1.0", anoInicio: 2000, anoFim: 2002 }], modelosSemDetalhes: [] }, campos: {} },
    },
  };
}
function mlSimulado({ noItem = [], userProduct = "", aceita = true } = {}) {
  const estado = { item: new Set(noItem), up: new Set(), chamadas: [] };
  const cat = catalogo();
  const consultar = async (caminho, metodo = "GET", corpo) => {
    estado.chamadas.push(`${metodo} ${caminho}`);
    if (caminho === "/items/MLB7") return { ok: true, dados: { id: "MLB7", user_product_id: userProduct } };
    if (caminho === "/items/MLB7/compatibilities") return { ok: true, dados: { products: [...estado.item].map((id) => ({ catalog_product_id: id })) } };
    if (caminho === `/user-products/${userProduct}/compatibilities`) return { ok: true, dados: { products: [...estado.up].map((id) => ({ catalog_product_id: id })) } };
    return cat(caminho, metodo, corpo);
  };
  const chamar = async (acao, extra) => {
    estado.chamadas.push(`ACAO ${acao}`);
    if (acao !== "gravar_compatibilidades") return { ok: false };
    assert.equal(extra.item_id, "MLB7");
    if (aceita) for (const p of extra.produtos) (userProduct ? estado.up : estado.item).add(p.id);
    return { ok: aceita, erro: aceita ? "" : "recusado" };
  };
  return { estado, consultar, chamar };
}

test("M9) MLB existente: conferir (só leitura) → enviar SÓ o que falta no MESMO MLB → aceitos relidos (inclusive MLBU)", async () => {
  for (const up of ["", "MLBU77"]) {
    const ml = mlSimulado({ noItem: ["MLB1001"], userProduct: up });
    const c = await conferirCompatibilidadesMLB({ ficha: fichaPublicada(), mlb: "MLB7", consultar: ml.consultar });
    assert.equal(c.ok, true);
    assert.equal(c.informadas, 2);
    assert.deepEqual(c.compat.veiculos.map((v) => v.id).sort(), ["MLB1001", "MLB1002"]);
    assert.deepEqual(c.jaAceitos.map((v) => v.id), ["MLB1001"]); // item + MLBU somados
    assert.ok(c.compat.semCatalogo.some((x) => /Twingo/.test(x.aplicacao)), "Twingo preservado e sinalizado");
    assert.ok(!ml.estado.chamadas.some((x) => x.startsWith("ACAO")), "conferir não grava nada");
    assert.equal((await enviarCompatibilidadesFaltantes({ mlb: "MLB7", faltam: c.faltam, confirmado: false, chamar: ml.chamar, consultar: ml.consultar })).ok, false);
    const e = await enviarCompatibilidadesFaltantes({ mlb: "MLB7", faltam: c.faltam, confirmado: true, chamar: ml.chamar, consultar: ml.consultar });
    assert.equal(e.ok, true, JSON.stringify(e.resultado));
    assert.equal(e.resultado.aceitos, c.faltam.length);
    assert.equal(ml.estado.chamadas.filter((x) => x === "ACAO gravar_compatibilidades").length, 1);
    assert.ok(!ml.estado.chamadas.some((x) => /publicar|remover/.test(x)), "nunca publica outro anúncio nem remove");
  }
  const recusa = mlSimulado({ aceita: false });
  const c2 = await conferirCompatibilidadesMLB({ ficha: fichaPublicada(), mlb: "MLB7", consultar: recusa.consultar });
  const e2 = await enviarCompatibilidadesFaltantes({ mlb: "MLB7", faltam: c2.faltam, confirmado: true, chamar: recusa.chamar, consultar: recusa.consultar });
  assert.equal(e2.ok, false);
  assert.equal(e2.resultado.estado, "zero");
});

test("M10) ficha publicada antiga só com texto de compatibilidade também é lida; nada é descartado", () => {
  const f = { dados_conferencia: { ficha: { campos: { compatibilidades: "RENAULT\n\n• Clio II\n  Motor: 1.6 16V\n  Período: 2009 até 2016" } } } };
  assert.deepEqual(aplicacoesDaFichaPublicada(f).detalhadas.map((a) => a.modelo), ["Clio II"]);
});

test("M11) tela da ficha publicada: correção no mesmo MLB, com confirmação; histórico só acrescenta", () => {
  const fp = ler("src/components/FichaPublicadaPAIIA.jsx");
  assert.match(fp, /<CorrecaoCompatMLB ficha=\{ficha\} mlb=\{mlbFicha\} conta=\{contaFicha\} \/>/);
  const c = ler("src/components/CorrecaoCompatMLB.jsx");
  assert.match(c, /disabled=\{!confirmo \|\| envio\.enviando\}/);
  const svc = ler("src/services/anuncioPublicacaoService.js");
  assert.match(svc, /correcoes_compatibilidade: \[\.\.\.lista, novo\]\.slice\(-30\)/);
  assert.match(svc, /"correcoes_compatibilidade"\]\);/);
});
