import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  situacaoContrato,
  fimDoPeriodo,
  reaisParaCentavos,
  limparContatos,
  lerListaDeItens,
  parceiroVisivel,
  pendenciasAprovacao,
  CRITERIOS_SELECAO,
  LIMITE_CATALOGO_BYTES,
} from "../../src/config/parceirosPiloto.js";
import {
  detectarColunas,
  linhasPlanilhaParaItens,
  linhasPdfParaItens,
  separarEquivalencias,
  resumoExtracao,
  lerTextoDelimitado,
} from "../../src/services/parceiros/extracaoCatalogo.js";

test("CSV do Excel brasileiro: separador ; e aspas", () => {
  const linhas = lerTextoDelimitado('﻿Referência;Descrição;Código OEM\r\nPL-1;"Bomba; elétrica";"0580454001, 23221-0D010"\r\nPL-2;Filtro "A";\r\n');
  assert.deepEqual(linhas[0], ["Referência", "Descrição", "Código OEM"]);
  assert.deepEqual(linhas[1], ["PL-1", "Bomba; elétrica", "0580454001, 23221-0D010"]);
  assert.deepEqual(linhas[2], ["PL-2", 'Filtro "A"', ""]);
  const r = linhasPlanilhaParaItens(linhas);
  assert.deepEqual(r.itens.map((i) => i.codigo), ["PL-1", "PL-2"]);
  assert.deepEqual(r.itens[0].equivalencias, ["0580454001", "23221-0D010"]);
  assert.deepEqual(lerTextoDelimitado("a,b\n1,2")[1], ["1", "2"]);
});

const hoje = new Date("2026-11-27T12:00:00");

test("mensalidade livre digitada em reais", () => {
  assert.equal(reaisParaCentavos("199,90"), 19990);
  assert.equal(reaisParaCentavos("1.299,90"), 129990);
  assert.equal(reaisParaCentavos("250"), 25000);
  assert.equal(reaisParaCentavos("149.9"), 14990);
  assert.equal(reaisParaCentavos("R$ 0,00"), 0);
  assert.equal(reaisParaCentavos("abc"), 0);
});

test("fim do período: início + meses − 1 dia", () => {
  assert.equal(fimDoPeriodo("2026-12-01", 12), "2027-11-30");
  assert.equal(fimDoPeriodo("2026-01-31", 1), "2026-02-27");
  assert.equal(fimDoPeriodo("", 12), "");
});

test("situação do contrato: experiência, vigente, vencendo, vencido, renovar", () => {
  assert.equal(situacaoContrato({ vigencia_inicio: "2026-11-20", vigencia_fim: "2027-11-19", experiencia_dias: 30 }, hoje).tipo, "experiencia");
  assert.equal(situacaoContrato({ vigencia_inicio: "2026-01-01", vigencia_fim: "2027-06-30", experiencia_dias: 30 }, hoje).tipo, "vigente");
  assert.equal(situacaoContrato({ vigencia_inicio: "2026-01-01", vigencia_fim: "2026-12-10" }, hoje).tipo, "vencendo");
  assert.equal(situacaoContrato({ vigencia_inicio: "2025-01-01", vigencia_fim: "2026-11-01" }, hoje).tipo, "vencido");
  assert.equal(situacaoContrato({ vigencia_inicio: "2025-01-01", vigencia_fim: "2026-11-01", renovacao_automatica: true }, hoje).tipo, "renovar");
  assert.equal(situacaoContrato({ vigencia_inicio: "2027-01-01", vigencia_fim: "2027-12-31" }, hoje).tipo, "futuro");
  assert.equal(situacaoContrato(null, hoje).tipo, "sem_contrato");
});

test("contatos individuais: sem nome não é salvo", () => {
  const c = limparContatos([{ nome: " Ana ", funcao: "Vendedor", telefone: " (11) 9 " }, { nome: "", funcao: "Representante" }]);
  assert.deepEqual(c, [{ nome: "Ana", funcao: "Vendedor", regiao: "", telefone: "(11) 9", email: "" }]);
});

test("critérios ficam no controle administrativo; a visibilidade depende de ativo + vigência", () => {
  const todos = Object.fromEntries(CRITERIOS_SELECAO.map((c) => [c.id, true]));
  assert.deepEqual(pendenciasAprovacao({ nome_fantasia: "X", catalogo_autorizado: true, controle: { criterios: todos } }), []);
  assert.equal(pendenciasAprovacao({ nome_fantasia: "X", catalogo_autorizado: true, controle: null }).length, 6);
  // usuário comum não recebe o controle: o parceiro ativo continua visível
  assert.equal(parceiroVisivel({ situacao: "ativo", controle: null, contrato: null }, hoje), true);
  assert.equal(parceiroVisivel({ situacao: "ativo", contrato: { vigencia_fim: "2026-11-01" } }, hoje), false);
});

test("lista colada aceita aplicação e equivalências", () => {
  const [i] = lerListaDeItens("ABC-1 ; Bomba ; Marca X ; Injeção ; Gol 1.0 ; 0580454001, 23221-0D010");
  assert.equal(i.aplicacao, "Gol 1.0");
  assert.deepEqual(i.equivalencias, ["0580454001", "23221-0D010"]);
});

test("extração de planilha: cabeçalhos por sinônimos, linha de cabeçalho não precisa ser a 1ª", () => {
  const linhas = [
    ["Catálogo Distribuidora Piloto 2026"],
    [],
    ["Referência", "Descrição do produto", "Aplicação", "Código OEM", "Fabricante", "Linha"],
    ["PL-100", "Bomba de combustível", "Gol 1.0 2010-2015", "0580454001 / 23221-0D010", "Marca X", "Injeção"],
    ["PL-100", "duplicado", "", "", "", ""],
    ["PL-200", "Sensor de rotação", "", "", "Marca Y", "Sensores"],
    ["", "linha sem código", "", "", "", ""],
  ];
  const r = linhasPlanilhaParaItens(linhas);
  assert.equal(r.itens.length, 2);
  assert.deepEqual(r.itens[0], {
    codigo: "PL-100", descricao: "Bomba de combustível", aplicacao: "Gol 1.0 2010-2015",
    equivalencias: ["0580454001", "23221-0D010"], marca: "Marca X", segmento: "Injeção", origem: "extracao_planilha",
  });
  assert.deepEqual(resumoExtracao(r.itens), { total: 2, comDescricao: 2, comAplicacao: 1, comEquivalencias: 1 });
});

test("extração de planilha: 'Código OEM' sozinho é equivalência, não o código", () => {
  const m = detectarColunas(["Código", "Código OEM", "Descrição"]);
  assert.equal(m.codigo, 0);
  assert.equal(m.equivalencias, 1);
  assert.match(linhasPlanilhaParaItens([["Nome", "Preço"], ["x", "1"]]).aviso, /coluna de código/);
});

test("extração de PDF: linha que começa com código + descrição; ignora datas, páginas e medidas", () => {
  const r = linhasPdfParaItens([
    "CATÁLOGO 2026",
    "DOX-0109 Sonda lambda universal 4 fios",
    "25/11/2026 Atualização do catálogo",
    "2026 Linha leve",
    "12V Tensão nominal",
    "PL.300/1 Válvula termostática",
    "DOX-0109 repetido na outra página",
    "ABC sem número",
  ]);
  assert.deepEqual(r.itens.map((i) => i.codigo), ["DOX-0109", "PL.300/1"]);
  assert.equal(r.itens[0].origem, "extracao_pdf");
  assert.deepEqual(r.itens[0].equivalencias, []);
});

test("equivalências: separa por vírgula, barra, ponto e vírgula; só códigos com número", () => {
  assert.deepEqual(separarEquivalencias("0580454001, 23221-0D010 / BOSCH; 0580454001"), ["0580454001", "23221-0D010"]);
});

test("catálogos grandes: 50 MB na tela (limite do plano), pasta preparada para 200 MB", () => {
  assert.equal(LIMITE_CATALOGO_BYTES, 50 * 1024 * 1024);
  const sql = fs.readFileSync(new URL("../../supabase/staging-piloto/20261127_parceiros_contrato_extracao.sql", import.meta.url), "utf8");
  assert.match(sql, /file_size_limit = 209715200/);
  assert.match(sql, /public = false/);
  const servico = fs.readFileSync(new URL("../../src/services/parceirosService.js", import.meta.url), "utf8");
  assert.match(servico, /storage\/v1\/upload\/resumable/);
  assert.match(servico, /situacao_tecnica: "pendente"/);
});

test("banco: controle só do administrador, ativação exige critérios, rotina de vencimento sem cobrança", () => {
  const sql = fs.readFileSync(new URL("../../supabase/staging-piloto/20261127_parceiros_contrato_extracao.sql", import.meta.url), "utf8");
  assert.match(sql, /create policy parceiro_controle_admin[\s\S]*?using \(public\.parceiros_eh_admin\(\)\)/);
  assert.match(sql, /Para aprovar ou ativar: marque os 6 critérios/);
  assert.match(sql, /parceiros_verificar_vencimentos[\s\S]*?Somente o administrador/);
  assert.match(sql, /suspensa automaticamente/);
  assert.doesNotMatch(sql, /cobranca_ativa = true|cobranca_ativa := true/);
  assert.doesNotMatch(sql, /catalogo_pecas|catalogo_chaves/);
});

test("cotações recebidas mostram a observação de cada pedido ao distribuidor", () => {
  const tela = fs.readFileSync(new URL("../../src/components/ParceirosPiloto.jsx", import.meta.url), "utf8");
  assert.match(tela, /data-testid="cotacao-recebida"/);
  assert.match(tela, /c\.mensagem \?/);
});
