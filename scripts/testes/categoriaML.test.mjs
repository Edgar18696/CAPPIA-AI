// =============================================================
// PAIIA — TESTES (09/10/2026): categoria do Mercado Livre.
//   node --test scripts/testes/categoriaML.test.mjs
// Caso real: 8200442891 (anel de vedação/segmento do câmbio automático
// DP0) publicado 2x em MLB47095 "Jogo de Anéis Motor" e encerrado pelo
// ML por categoria incorreta (MLB5351282473, MLB7770899950).
// Dados do ML abaixo = respostas REAIS lidas em 09/10/2026.
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ler = (f) => fs.readFileSync(path.join(RAIZ, f), "utf8");

const C = await import("../../src/services/categoriaML.js");
const P = await import("../../src/services/categoriaPublicacaoML.js");
const B = await import("../../src/services/categoriaMLBusca.js");
const S = await import("../../src/services/publicacaoSegura.js");
const FC = await import("../../src/services/fichaConferencia.js");

const RAIZ_PECAS = ["Acessórios para Veículos", "Peças de Carros e Caminhonetes"];
const DETALHES = {
  MLB47095: { id: "MLB47095", nome: "Jogo de Anéis Motor", niveis: [...RAIZ_PECAS, "Motor", "Componentes de Motor", "Bloco de Motores", "Jogo de Anéis Motor"], dominio: "MLB-VEHICLE_ENGINE_PISTON_RING_SETS", listingAllowed: true, filhos: [], tipoVeiculo: { existe: true, valores: [{ id: "1", nome: "Carro/Caminhonete" }] } },
  MLB116875: { id: "MLB116875", nome: "Outros", niveis: [...RAIZ_PECAS, "Transmissão", "Câmbios", "Outros"], dominio: "MLB-LIGHT_VEHICLE_REPLACEMENTS", listingAllowed: true, filhos: [], tipoVeiculo: { existe: true, valores: [{ id: "1", nome: "Carro/Caminhonete" }] } },
  MLB459042: { id: "MLB459042", nome: "Outros", niveis: [...RAIZ_PECAS, "Transmissão", "Transmissõ Automáticas", "Outros"], dominio: "MLB-LIGHT_VEHICLE_REPLACEMENTS", listingAllowed: true, filhos: [] },
  MLB456398: { id: "MLB456398", nome: "Anéis", niveis: ["Acessórios para Veículos", "Peças de Linha Pesada", "Caixas de Marchas", "Anéis"], dominio: "MLB-VEHICLE_GEARBOX_RINGS", listingAllowed: true, filhos: [] },
  MLB442366: { id: "MLB442366", nome: "Anéis", niveis: [...RAIZ_PECAS, "Motor", "Anéis"], dominio: "MLB-VEHICLE_ENGINE_PISTON_RING_SETS", listingAllowed: true, filhos: [] },
  MLB240693: { id: "MLB240693", nome: "Anel Segmento", niveis: ["Acessórios para Veículos", "Peças de Motos e Quadriciclos", "Motor", "Anel Segmento"], dominio: "MLB-VEHICLE_ENGINE_PISTON_RING_SETS", listingAllowed: true, filhos: [] },
  MLB33383: { id: "MLB33383", nome: "Outros", niveis: ["Ferramentas", "Acessórios para Ferramentas", "Outros"], dominio: "MLB-TOOL_ACCESSORIES_AND_REPLACEMENTS", listingAllowed: true, filhos: [] },
  MLB194431: { id: "MLB194431", nome: "Fechaduras de Portas", niveis: [...RAIZ_PECAS, "Fechaduras e Chaves", "Fechaduras de Portas"], dominio: "MLB-CAR_DOOR_LOCKS", listingAllowed: true, filhos: [] },
};
// Preditor oficial (respostas reais de 09/10/2026).
const PRED_SEGMENTO = { termo: "Anel Segmento Câmbio Automático Renault 8200442891", sugestoes: [
  { category_id: "MLB47095", domain_id: "MLB-VEHICLE_ENGINE_PISTON_RING_SETS" }, { category_id: "MLB442366", domain_id: "MLB-VEHICLE_ENGINE_PISTON_RING_SETS" },
  { category_id: "MLB240693", domain_id: "MLB-VEHICLE_ENGINE_PISTON_RING_SETS" }] };
const PRED_VEDACAO = { termo: "Anel Vedação Câmbio Automático DP0 Renault 8200442891", sugestoes: [{ category_id: "MLB456398", domain_id: "MLB-VEHICLE_GEARBOX_RINGS" }, { category_id: "MLB33383", domain_id: "MLB-TOOL_ACCESSORIES_AND_REPLACEMENTS" }] };
// Anúncios reais do código (09/10/2026): 33 em MLB47095, 6 em MLB116875.
const EVIDENCIA = { estado: "ok", total: 39, porCategoria: { MLB47095: { anuncios: 33, vendedores: 7 }, MLB116875: { anuncios: 6, vendedores: 6 } } };
const REJ = [
  { categoria_id: "MLB47095", mlb: "MLB5351282473", motivo: "Encerrado pelo ML: categoria incorreta." },
  { categoria_id: "MLB47095", mlb: "MLB7770899950", motivo: "Encerrado pelo ML: categoria incorreta." },
];
const PECA = "Anel de vedação do câmbio automático DP0";

test("sistema técnico: peça de câmbio × categoria de motor (caminho e domínio)", () => {
  assert.deepEqual(C.sistemasDaPeca(PECA), ["transmissao"]);
  assert.deepEqual(C.sistemasDaPeca("Anel Segmento Câmbio Automático Renault"), ["transmissao"]);
  assert.equal(C.sistemaDaCategoria(DETALHES.MLB47095), "motor");
  assert.equal(C.sistemaDaCategoria(DETALHES.MLB116875), "transmissao");
  assert.equal(C.sistemaDaCategoria(DETALHES.MLB459042), "transmissao");
  const av = C.avaliarUmaCategoria(DETALHES.MLB47095, { sistemasPeca: ["transmissao"] });
  assert.equal(av.compativel, false);
  assert.match(av.bloqueios.join(" "), /domínio de motor para peça de transmissão/);
  assert.equal(C.avaliarUmaCategoria(DETALHES.MLB116875, { sistemasPeca: ["transmissao"] }).compativel, true);
});

test("Linha Pesada, outro ramo e categoria fora de veículos não servem para Carro/Caminhonete", () => {
  assert.match(C.avaliarUmaCategoria(DETALHES.MLB456398, { tipoVeiculo: "Carro/Caminhonete" }).bloqueios.join(), /Peças de Linha Pesada/);
  assert.match(C.avaliarUmaCategoria(DETALHES.MLB33383, {}).bloqueios.join(), /fora de "Acessórios para Veículos"/);
  assert.match(C.avaliarUmaCategoria(DETALHES.MLB240693, {}).bloqueios.join(), /Motos/);
  assert.match(C.avaliarUmaCategoria({ ...DETALHES.MLB116875, filhos: ["MLB1"] }, {}).bloqueios.join(), /categoria final/);
  assert.match(C.avaliarUmaCategoria({ ...DETALHES.MLB116875, listingAllowed: false }, {}).bloqueios.join(), /não aceita anúncios/);
});

test("8200442891 + 'Segmento' sugerindo categoria de MOTOR → NÃO escolhe sozinho", () => {
  const r = C.avaliarCategorias({ textoPeca: PECA, consultas: [PRED_SEGMENTO], detalhes: DETALHES });
  assert.equal(r.sugerida, null);
  assert.ok(r.conflitos.some((c) => /nenhuma categoria compatível/.test(c)));
  assert.ok(r.alertas.some((a) => /sugeriu primeiro MLB47095/.test(a)));
  // A 1ª sugestão do preditor nunca vira a escolha.
  assert.notEqual(r.candidatas[0].id === "MLB47095" && r.candidatas[0].compativel, true);
});

test("preditor e anúncios reais discordando → pede decisão (anúncios são só evidência)", () => {
  // Preditor indica MLB459042 (compatível); anúncios do código usam MLB116875.
  const pred = { termo: "Anel Câmbio Automático DP0 Renault", sugestoes: [{ category_id: "MLB459042" }] };
  const r = C.avaliarCategorias({ textoPeca: PECA, consultas: [pred], detalhes: DETALHES, evidencia: EVIDENCIA });
  assert.equal(r.sugerida, null);
  assert.ok(r.conflitos.some((c) => /preditor indica MLB459042, mas os anúncios do mesmo código \(compatíveis\) usam MLB116875/.test(c)));
  // Maioria dos anúncios em MLB47095 (incompatível) = alerta, nunca escolha.
  assert.ok(r.alertas.some((a) => /maioria dos anúncios do mesmo código \(33\) está em MLB47095/.test(a)));
});

test("caso real completo: sem sugestão automática; MLB116875 aparece como alternativa compatível; MLB47095 REJEITADA", () => {
  const r = C.avaliarCategorias({ textoPeca: PECA, consultas: [PRED_SEGMENTO, PRED_VEDACAO], detalhes: DETALHES, evidencia: EVIDENCIA, rejeicoes: REJ });
  assert.equal(r.sugerida, null);
  const c116 = r.candidatas.find((c) => c.id === "MLB116875");
  assert.equal(c116.compativel, true);
  assert.deepEqual(c116.evidencia, { anuncios: 6, vendedores: 6 });
  assert.ok(c116.origens.includes("anuncios_mesmo_codigo"));
  const c47 = r.candidatas.find((c) => c.id === "MLB47095");
  assert.equal(c47.rejeitada, true);
  assert.deepEqual(c47.rejeicoes.map((x) => x.mlb), ["MLB5351282473", "MLB7770899950"]);
  // Rejeitada vai para o fim da lista.
  assert.equal(r.candidatas[r.candidatas.length - 1].rejeitada, true);
});

test("sem conflito: preditor compatível + evidência igual → sugerida (mas ainda NÃO confirmada)", () => {
  const pred = { termo: "Anel câmbio", sugestoes: [{ category_id: "MLB116875" }] };
  const r = C.avaliarCategorias({ textoPeca: PECA, consultas: [pred, { termo: "x", sugestoes: [{ category_id: "MLB116875" }] }], detalhes: DETALHES, evidencia: { estado: "ok", porCategoria: { MLB116875: { anuncios: 6, vendedores: 6 } } } });
  assert.equal(r.sugerida, "MLB116875");
  assert.deepEqual(r.conflitos, []);
  const fp = C.conferirCategoriaParaPublicar({ categoriaId: "MLB116875", decisao: null, detalhe: DETALHES.MLB116875, textoPeca: PECA });
  assert.equal(fp.ok, false);
  assert.match(fp.motivos[0], /não confirmada/);
});

test("categoria MLB47095 rejeitada → nunca herdada (ficha nova com categoria antiga no navegador é REVALIDADA)", () => {
  const herdadas = [{ id: "MLB47095", origem: C.ORIGEM_CATEGORIA.NAVEGADOR, caminho: "… > Jogo de Anéis Motor" }];
  const r = C.avaliarCategorias({ textoPeca: PECA, consultas: [PRED_VEDACAO], detalhes: DETALHES, rejeicoes: REJ, herdadas });
  const c47 = r.candidatas.find((c) => c.id === "MLB47095");
  assert.ok(c47.origens.includes("navegador"));
  assert.equal(c47.rejeitada, true);
  assert.notEqual(r.sugerida, "MLB47095");
  assert.ok(r.alertas.some((a) => /MLB47095 guardada no navegador está REJEITADA/.test(a)));
  // Publicação com MLB47095 bloqueada mesmo "confirmada" sem revisão explícita.
  const dec = C.registrarConfirmacao(null, { candidata: c47, avaliacao: r });
  const fp = C.conferirCategoriaParaPublicar({ categoriaId: "MLB47095", decisao: dec, rejeicoes: REJ, detalhe: DETALHES.MLB47095, textoPeca: PECA });
  assert.equal(fp.ok, false);
  assert.ok(fp.motivos.some((m) => /CATEGORIA REJEITADA/.test(m)));
  assert.ok(fp.motivos.some((m) => /incompatível/.test(m)));
});

test("herdada compatível também é revalidada: diferente do preditor = conflito", () => {
  const herdadas = [{ id: "MLB459042", origem: C.ORIGEM_CATEGORIA.FICHA }];
  const pred = { termo: "t", sugestoes: [{ category_id: "MLB116875" }] };
  const r = C.avaliarCategorias({ textoPeca: PECA, consultas: [pred], detalhes: DETALHES, herdadas });
  assert.equal(r.sugerida, null);
  assert.ok(r.conflitos.some((c) => /herdada MLB459042 é diferente/.test(c)));
});

test("revisão explícita de categoria rejeitada: só com justificativa registrada", () => {
  const r = C.avaliarCategorias({ textoPeca: PECA, consultas: [PRED_VEDACAO], detalhes: DETALHES, rejeicoes: REJ, herdadas: [{ id: "MLB47095", origem: "ficha_anterior" }] });
  const c47 = r.candidatas.find((c) => c.id === "MLB47095");
  const curta = C.registrarConfirmacao(null, { candidata: c47, avaliacao: r, revisao: { categoria_id: "MLB47095", tipo: "rejeitada", justificativa: "ok" } });
  assert.ok(C.conferirCategoriaParaPublicar({ categoriaId: "MLB47095", decisao: curta, rejeicoes: REJ, detalhe: { ...DETALHES.MLB116875, id: "MLB47095" }, textoPeca: PECA }).motivos.some((m) => /REJEITADA/.test(m)));
  const longa = C.registrarConfirmacao(null, { candidata: c47, avaliacao: r, revisao: { categoria_id: "MLB47095", tipo: "rejeitada", justificativa: "Revisado com o suporte do ML: categoria liberada." } });
  assert.ok(!C.conferirCategoriaParaPublicar({ categoriaId: "MLB47095", decisao: longa, rejeicoes: REJ, detalhe: { ...DETALHES.MLB116875, id: "MLB47095" }, textoPeca: PECA }).motivos.some((m) => /REJEITADA/.test(m)));
});

test("rastreabilidade: apresentadas, origem, escolha manual, data, descartadas e rejeitadas com motivo", () => {
  const r = C.avaliarCategorias({ textoPeca: PECA, consultas: [PRED_SEGMENTO, PRED_VEDACAO], detalhes: DETALHES, evidencia: EVIDENCIA, rejeicoes: REJ });
  const c116 = r.candidatas.find((c) => c.id === "MLB116875");
  const d = C.registrarConfirmacao({ motivoSemGtin: { id: "17055160", nome: "O produto não tem código cadastrado" } }, { candidata: c116, avaliacao: r, agora: "2026-10-09T15:00:00.000Z" });
  assert.equal(d.confirmada.id, "MLB116875");
  assert.equal(d.confirmada.manual, true);
  assert.equal(d.confirmada.sugerida, false);
  assert.equal(d.confirmada.data, "2026-10-09T15:00:00.000Z");
  assert.ok(d.confirmada.origem.includes("anuncios_mesmo_codigo"));
  assert.ok(d.apresentadas.length >= 5);
  assert.ok(d.descartadas.find((x) => x.id === "MLB47095" && /REJEITADA/.test(x.motivo)));
  assert.ok(d.descartadas.find((x) => x.id === "MLB456398" && /Linha Pesada/.test(x.motivo)));
  assert.equal(d.rejeitadas.length, 2);
  assert.equal(d.motivoSemGtin.id, "17055160");
  const desfeita = C.desfazerConfirmacao(d, "trocou a categoria", "2026-10-09T15:05:00.000Z");
  assert.equal(desfeita.confirmada, null);
  assert.deepEqual(desfeita.historico.map((h) => h.acao), ["confirmou", "desfeita"]);
});

test("forbidden NÃO é categoria errada: sem motivo comprovado vira só restrição no histórico", () => {
  const lidos = [
    { mlb: "MLB7770899950", conta: "1729335019", categoria_id: "MLB47095", status: "under_review", sub_status: ["forbidden"] },
    { mlb: "MLB5351282473", conta: "1729335019", categoria_id: "MLB47095", status: "inactive", sub_status: ["forbidden", "deleted"] },
    { mlb: "MLB1", conta: "1", categoria_id: "MLB116875", status: "closed", sub_status: ["deleted"] }, // excluído pelo vendedor: nada
  ];
  // Sem nenhum motivo conhecido: NENHUMA categoria rejeitada; os dois ficam como restrição.
  const sem = C.classificarMLBsAnteriores(lidos, { motivosConhecidos: {}, agora: "2026-10-09T10:00:00Z" });
  assert.deepEqual(sem.rejeicoes, []);
  assert.deepEqual(sem.restricoes.map((r) => r.mlb), ["MLB7770899950", "MLB5351282473"]);
  assert.equal(sem.restricoes[0].motivo, "motivo da restrição não confirmado");
  // Motivo que NÃO é de categoria (ex.: marca): continua só restrição.
  const marca = C.classificarMLBsAnteriores(lidos, { motivosConhecidos: { MLB7770899950: "Infração de propriedade intelectual (marca)." } });
  assert.deepEqual(marca.rejeicoes, []);
  // Caso real comprovado no painel: MLB7770899950 = categoria incorreta → MLB47095 rejeitada.
  const real = C.classificarMLBsAnteriores(lidos);
  assert.deepEqual(real.rejeicoes.map((r) => [r.mlb, r.categoria_id, r.origem]), [["MLB7770899950", "MLB47095", "motivo_confirmado"]]);
  assert.match(real.rejeicoes[0].motivo, /categoria incorreta/);
  assert.deepEqual(real.restricoes.map((r) => r.mlb), ["MLB5351282473"]);
  assert.ok(C.motivoEhCategoriaIncorreta("Estava em uma categoria incorreta."));
  assert.ok(!C.motivoEhCategoriaIncorreta("Anúncio com informação de contato"));
});

test("rejeição manual com justificativa; histórico só acrescenta (nada some)", () => {
  assert.equal(C.rejeicaoManual({ categoria_id: "MLB456398", justificativa: "curta" }), null);
  const m = C.rejeicaoManual({ categoria_id: "MLB456398", justificativa: "Linha Pesada não serve para Kangoo.", agora: "2026-10-09T11:00:00Z" });
  assert.equal(m.origem, "manual");
  assert.match(m.motivo, /decisão manual: Linha Pesada não serve/);
  const antiga = [{ categoria_id: "MLB47095", mlb: "MLB7770899950", motivo: "categoria incorreta" }];
  const r1 = C.mesclarRejeicoes(antiga, [m]);
  assert.equal(r1.lista.length, 2);
  assert.equal(r1.mudou, true);
  const r2 = C.mesclarRejeicoes(r1.lista, [m, antiga[0]]);
  assert.equal(r2.mudou, false);
  assert.equal(r2.lista.length, 2);
  // Rejeitada manualmente → bloqueia publicar sem revisão.
  const fp = C.conferirCategoriaParaPublicar({ categoriaId: "MLB456398", decisao: { confirmada: { id: "MLB456398" } }, rejeicoes: r1.lista, detalhe: { ...DETALHES.MLB116875, id: "MLB456398" }, textoPeca: PECA });
  assert.ok(fp.motivos.some((x) => /CATEGORIA REJEITADA/.test(x)));
});

test("leitura do histórico: fichas do código + MLBs anteriores lidos no ML", async () => {
  const fichas = { ok: true, anuncios: [
    { id: "e57d00cc", publicacao: { mlb_id: "MLB7770899950", ml_user_id: "1729335019" }, mlbs_anteriores: [{ mlb: "MLB5351282473", conta: "1729335019" }] },
    { id: "de006ea6", publicacao: null, categorias_rejeitadas: [{ categoria_id: "MLB99", mlb: "", motivo: "Rejeitada por decisão manual: x", justificativa: "xxxxxxxxxxxx", origem: "manual" }] },
  ] };
  const itens = {
    MLB7770899950: { ok: true, dados: { category_id: "MLB47095", status: "under_review", sub_status: ["forbidden"] } },
    MLB5351282473: { ok: true, dados: { category_id: "MLB47095", status: "inactive", sub_status: ["forbidden", "deleted"] } },
  };
  const r = await B.lerRejeicoesDoSKU({ codigo: "8200442891", listarFichas: async () => fichas, lerItem: async (mlb) => itens[mlb] });
  assert.deepEqual(r.lista.map((x) => `${x.categoria_id}:${x.mlb}`).sort(), ["MLB47095:MLB7770899950", "MLB99:"]);
  assert.deepEqual(r.restricoes.map((x) => x.mlb), ["MLB5351282473"]);
  assert.deepEqual(r.erros, []);
});

test("EMPTY_GTIN_REASON: o ML não exigiu → só AVISO (não bloqueia); o ML exigiu → bloqueia e pede o valor oficial", () => {
  // Atributos REAIS de MLB116875 (resumo): BRAND/PART_NUMBER obrigatórios; EMPTY_GTIN_REASON condicional.
  const ATTR = [
    { id: "BRAND", name: "Marca", tags: { required: true, catalog_required: true } },
    { id: "PART_NUMBER", name: "Número de peça", tags: { required: true, catalog_required: true } },
    { id: "GTIN", name: "Código universal de produto", tags: { multivalued: true } },
    { id: "EMPTY_GTIN_REASON", name: "Motivo de GTIN vazio", tags: { hidden: true, conditional_required: true }, values: [
      { id: "17055158", name: "O produto é uma peça artesanal" }, { id: "17055159", name: "O produto é um kit ou pack" },
      { id: "17055160", name: "O produto não tem código cadastrado" }, { id: "17055161", name: "Outro motivo" }] },
  ];
  const ok = ["BRAND", "PART_NUMBER"];
  // Como na validação real (09/10/2026): o ML não exigiu → aviso, segue.
  const aviso = P.exigenciasAtributos({ atributos: ATTR, preenchidos: ok, gtin: "", exigidosML: [] });
  assert.equal(aviso.ok, true);
  assert.equal(aviso.motivoExigido, false);
  assert.equal(aviso.motivoSugerido, true);
  assert.deepEqual(aviso.pendentes, []);
  assert.equal(aviso.avisos[0].id, "EMPTY_GTIN_REASON");
  assert.match(aviso.avisos[0].texto, /AVISO/);
  assert.equal(aviso.avisos[0].valores.length, 4);
  // Sem consulta do ML (null): também só aviso.
  assert.equal(P.exigenciasAtributos({ atributos: ATTR, preenchidos: ok, gtin: "" }).ok, true);
  // Motivo informado mesmo opcional → vai no anúncio.
  const opc = P.exigenciasAtributos({ atributos: ATTR, preenchidos: ok, gtin: "", motivoSemGtin: { id: "17055160" }, exigidosML: [] });
  assert.equal(opc.ok, true);
  assert.deepEqual(opc.enviar, [{ id: "EMPTY_GTIN_REASON", value_id: "17055160" }]);
  // O ML EXIGIU (consulta oficial de condicionais) → bloqueia e pede.
  const exigido = P.exigenciasAtributos({ atributos: ATTR, preenchidos: ok, gtin: "", exigidosML: ["EMPTY_GTIN_REASON"] });
  assert.equal(exigido.ok, false);
  assert.equal(exigido.motivoExigido, true);
  assert.equal(exigido.pendentes[0].id, "EMPTY_GTIN_REASON");
  assert.match(exigido.pendentes[0].texto, /EXIGE/);
  const invalido = P.exigenciasAtributos({ atributos: ATTR, preenchidos: ok, gtin: "", motivoSemGtin: { id: "999" }, exigidosML: ["EMPTY_GTIN_REASON"] });
  assert.match(invalido.pendentes[0].texto, /não é um valor aceito/);
  const comMotivo = P.exigenciasAtributos({ atributos: ATTR, preenchidos: ok, gtin: "", motivoSemGtin: { id: "17055160" }, exigidosML: ["EMPTY_GTIN_REASON"] });
  assert.equal(comMotivo.ok, true);
  assert.deepEqual(comMotivo.enviar, [{ id: "EMPTY_GTIN_REASON", value_id: "17055160" }]);
  // Tag required na categoria também exige.
  const req = ATTR.map((a) => (a.id === "EMPTY_GTIN_REASON" ? { ...a, tags: { required: true } } : a));
  assert.equal(P.exigenciasAtributos({ atributos: req, preenchidos: ok, gtin: "" }).ok, false);
  // Com GTIN: nada.
  const comGtin = P.exigenciasAtributos({ atributos: ATTR, preenchidos: [...ok, "GTIN"], gtin: "7891234567895" });
  assert.equal(comGtin.ok, true);
  assert.deepEqual(comGtin.avisos, []);
  // Obrigatório sem valor também aparece.
  assert.ok(P.exigenciasAtributos({ atributos: ATTR, preenchidos: ["PART_NUMBER"], gtin: "1" }).pendentes.some((p) => p.id === "BRAND"));
  // Outro condicional exigido pela consulta oficial do ML.
  const outro = P.exigenciasAtributos({ atributos: [...ATTR, { id: "MODEL", name: "Modelo", tags: { conditional_required: true } }], preenchidos: ok, gtin: "1", exigidosML: P.idsExigidosML({ required_attributes: [{ id: "MODEL" }] }) });
  assert.equal(outro.ok, false);
  assert.match(outro.pendentes[0].texto, /condicional Modelo/);
  // Atributos não lidos = bloqueia.
  assert.equal(P.exigenciasAtributos({ atributos: null }).ok, false);
});

test("categoria sem atributos condicionais → segue normalmente", () => {
  const ATTR = [{ id: "BRAND", tags: { required: true } }, { id: "PART_NUMBER", tags: { required: true } }, { id: "VEHICLE_TYPE", tags: { required: true } }];
  const r = P.exigenciasAtributos({ atributos: ATTR, preenchidos: ["BRAND", "PART_NUMBER", "VEHICLE_TYPE"], gtin: "" });
  assert.equal(r.ok, true);
  assert.deepEqual(r.condicionais, []);
  assert.deepEqual(r.enviar, []);
  const item = P.aplicarAtributosDecididos({ attributes: [{ id: "BRAND", value_name: "Torken" }] }, [{ id: "EMPTY_GTIN_REASON", value_id: "17055160" }, { id: "BRAND", value_name: "X" }]);
  assert.deepEqual(item.attributes.map((a) => a.id), ["BRAND", "EMPTY_GTIN_REASON"]);
  assert.equal(item.attributes[0].value_name, "Torken");
});

test("categoria ausente → publicação bloqueada", () => {
  const r = C.conferirCategoriaParaPublicar({ categoriaId: "", decisao: null });
  assert.equal(r.ok, false);
  assert.match(r.motivos[0], /não definida/);
  const outra = C.conferirCategoriaParaPublicar({ categoriaId: "MLB116875", decisao: { confirmada: { id: "MLB459042" } }, detalhe: DETALHES.MLB116875, textoPeca: PECA });
  assert.ok(outra.motivos.some((m) => /diferente da confirmada/.test(m)));
  const semDetalhe = C.conferirCategoriaParaPublicar({ categoriaId: "MLB116875", decisao: { confirmada: { id: "MLB116875" } }, detalhe: null });
  assert.ok(semDetalhe.motivos.some((m) => /não conferido agora/.test(m)));
  const ok = C.conferirCategoriaParaPublicar({ categoriaId: "MLB116875", decisao: { confirmada: { id: "MLB116875" } }, detalhe: DETALHES.MLB116875, textoPeca: PECA, exigencias: { ok: true, pendentes: [] } });
  assert.deepEqual(ok, { ok: true, motivos: [] });
});

test("mudança de categoria (ou do motivo sem GTIN) depois da aprovação → derruba a aprovação", () => {
  const base = ["t", "10", "d", [], "cam", "MLB116875", "Torken", "8200442891", "", "", "", "", "", null, "1", "Carro/Caminhonete", "", "classico", "novo", false, "MLB116875", "17055160"];
  assert.ok(FC.mesmaAprovacao(JSON.stringify(base), JSON.stringify(base)));
  const outraCat = [...base];
  outraCat[5] = "MLB459042";
  outraCat[20] = "MLB459042";
  assert.ok(FC.diferencasAssinatura(JSON.stringify(base), JSON.stringify(outraCat)).includes("categoria (ID)"));
  const semConfirmar = [...base];
  semConfirmar[20] = "";
  assert.deepEqual(FC.diferencasAssinatura(JSON.stringify(base), JSON.stringify(semConfirmar)), ["categoria confirmada"]);
  const outroMotivo = [...base];
  outroMotivo[21] = "17055161";
  assert.deepEqual(FC.diferencasAssinatura(JSON.stringify(base), JSON.stringify(outroMotivo)), ["motivo sem GTIN"]);
  // Publicação: ficha gravada com a decisão; a tela com outra = bloqueia.
  const aprovado = { titulo: "t", categoriaId: "MLB116875", categoriaDecisao: { confirmada: { id: "MLB116875" }, motivoSemGtin: { id: "17055160" } } };
  assert.ok(S.divergenciasAnuncio({ ...aprovado, categoriaDecisao: { confirmada: { id: "MLB459042" } } }, aprovado).includes("categoria confirmada"));
  assert.ok(S.divergenciasAnuncio({ ...aprovado, categoriaDecisao: { confirmada: { id: "MLB116875" }, motivoSemGtin: { id: "17055161" } } }, aprovado).includes("motivo sem GTIN"));
});

test("publicação sem categoria aprovada não é mais 'sugerida' pela Publicação", () => {
  const base = { dados_conferencia: { ficha: { anuncioConferido: { titulo: "t", categoriaId: "" }, assinaturaAprovada: "x" } } };
  const r = S.conferirFichaPersistida({ tela: { titulo: "t", categoriaId: "" }, envio: { titulo: "t", categoria_id: "MLB47095" }, base });
  assert.equal(r.ok, false);
  assert.ok(r.divergencias.includes("categoria"));
});

test("código: nenhum caminho escolhe a categoria pela 1ª sugestão do preditor", () => {
  const rev = ler("src/components/RevisaoPublicacaoML.jsx");
  assert.doesNotMatch(rev, /r\.categoria_id && !categoriaId/);
  const mlt = ler("src/components/MercadoLivreTeste.jsx");
  assert.doesNotMatch(mlt, /escolherCategoria\(r\.escolhida/);
  assert.doesNotMatch(mlt, /descobrirCategoriaML/);
  // A cópia do servidor (quando presente) é idêntica à do site.
  const shared = path.join(RAIZ, "supabase/functions/_shared/categoriaPublicacaoML.js");
  if (fs.existsSync(shared)) assert.equal(fs.readFileSync(shared, "utf8").replace(/\r\n/g, "\n"), ler("src/services/categoriaPublicacaoML.js").replace(/\r\n/g, "\n"));
});
