// =============================================================
// PAIIA — TESTES: Inteligência de Busca automática e Dados Técnicos.
//   node --test scripts/testes/inteligenciaBusca.test.mjs
// Regras: palavras-chave geradas SEM preenchimento manual, só de dados
// confirmados; códigos normalizados (espaços/pontos/hífens); sinônimos só
// de frases equivalentes; nada de "original"; concorrentes separados;
// nenhum veículo/código/medida inventado.
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  codigoCompacto,
  variacoesCodigo,
  identificarCodigos,
  sinonimosDaPeca,
  limparTermoBusca,
  nomeCategoria,
  termosConfirmados,
  gerarIntencoesBusca,
  separarSugestoesConcorrentes,
  extrairDadosDescricao,
} from "../../src/services/inteligenciaBusca.js";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const termos = (lista) => lista.map((t) => t.termo);
// Lê o arquivo com quebras de linha normalizadas (no Windows o git pode
// entregar CRLF): as conferências abaixo valem para o conteúdo, não para o
// tipo de quebra de linha.
const lerFonte = (rel) => fs.readFileSync(path.join(RAIZ, rel), "utf8").replace(/\r\n/g, "\n");

test("1) códigos: mesmo código com/sem espaços, pontos e hífens = um só", () => {
  assert.equal(codigoCompacto("0 280-158.276"), "0280158276");
  assert.deepEqual(variacoesCodigo("0.280.158.276"), ["0.280.158.276", "0280158276", "0 280 158 276"]);
  assert.deepEqual(variacoesCodigo("510959620"), ["510959620"]); // nenhum agrupamento inventado
  assert.deepEqual(variacoesCodigo("informado"), []); // palavra não é código
  const ids = identificarCodigos({ codigo: "510959620", numeroPeca: "510 959 620", oem: "5K0959620", codigoOemBase: "5K0-959-620" });
  assert.equal(ids.length, 2);
  assert.deepEqual(ids[0].papeis, ["Código / SKU", "Número da peça"]);
  assert.deepEqual(ids[1].papeis, ["OEM", "OEM (base PAIIA)"]);
  assert.ok(ids[1].variacoes.includes("5K0 959 620"));
});

test("2) sinônimos só de frases equivalentes; peça diferente não vira sinônimo", () => {
  assert.deepEqual(termos(sinonimosDaPeca("Interruptor Botão Elétrico Teto Solar")), ["botão do teto solar", "chave do teto solar"]);
  assert.deepEqual(termos(sinonimosDaPeca("Sonda Lambda Pré Catalisador")), ["sensor de oxigênio", "sensor lambda"]);
  assert.deepEqual(termos(sinonimosDaPeca("Kit 4 Bicos Injetores Corsa")), ["injetor de combustível", "válvula injetora"]);
  // o interruptor do eletroventilador NÃO é o eletroventilador
  assert.equal(termos(sinonimosDaPeca("Interruptor do Eletroventilador")).includes("ventoinha do radiador"), false);
  // sem frase no dicionário: nada (zero é melhor que sinônimo errado)
  assert.deepEqual(sinonimosDaPeca("Tampa Flange Combustível"), []);
  assert.deepEqual(sinonimosDaPeca("Sensor de Rotação"), []);
});

test("3) termos proibidos/genéricos saem", () => {
  assert.equal(limparTermoBusca("Interruptor Teto Solar Original"), "Interruptor Teto Solar");
  assert.equal(limparTermoBusca("Peça Original"), "");
  assert.equal(limparTermoBusca("Kit"), "");
  assert.equal(nomeCategoria("Acessórios para Veículos > Peças de Carros > Interruptores"), "Interruptores");
});

const dados510 = {
  codigos: ["510959620", "510 959 620", "5K0959620"],
  nomePeca: "Interruptor Botão Elétrico Teto Solar Original",
  categoria: "Acessórios para Veículos > Peças de Carros > Interruptores",
  marca: "Torken",
  fabricante: "",
  aplicacoes: [{ montadora: "Volkswagen", modelo: "Jetta", motor: "", anoInicio: "2011", anoFim: "2015" }],
  modelos: [{ montadora: "Volkswagen", modelo: "Passat" }],
};

test("4) palavras-chave automáticas com origem de cada termo (sem campo manual)", () => {
  const t = termosConfirmados(dados510);
  const por = (o) => t.filter((x) => x.origem === o).map((x) => x.termo);
  assert.deepEqual(por("codigo"), ["510959620", "5K0959620"]);
  assert.deepEqual(por("peca"), ["Interruptor Botão Elétrico Teto Solar"]);
  assert.deepEqual(por("categoria"), ["Interruptores"]);
  assert.deepEqual(por("sinonimo"), ["botão do teto solar", "chave do teto solar"]);
  assert.deepEqual(por("marca"), ["Torken"]);
  assert.deepEqual(por("modelo"), ["Passat", "Jetta"]);
  assert.equal(t.some((x) => /original/i.test(x.termo)), false);
  // sem repetidos (sem acento/caixa)
  const k = t.map((x) => x.termo.toLowerCase());
  assert.equal(new Set(k).size, k.length);
});

test("5) buscas por intenção: só veículos confirmados; sinônimos com os mesmos veículos", () => {
  const i = gerarIntencoesBusca(dados510);
  const textos = i.map((x) => x.texto);
  assert.ok(textos.includes("510959620"));
  assert.ok(textos.includes("Interruptor Botão Elétrico Teto Solar Jetta 2011 a 2015"));
  assert.ok(textos.includes("botão do teto solar Jetta"));
  assert.ok(textos.includes("botão do teto solar Passat"));
  // nenhum veículo fora dos confirmados
  const veiculos = ["Golf", "Tiguan", "Polo", "Amarok"];
  assert.equal(textos.some((x) => veiculos.some((v) => x.includes(v))), false);
  // ano só onde foi confirmado (Passat não tem ano)
  assert.equal(textos.some((x) => /Passat \d/.test(x)), false);
});

test("6) características técnicas: só as confirmadas/rotuladas; nada inventado", () => {
  const t = termosConfirmados({ codigos: ["7703101596"], nomePeca: "Parafuso de Aço", medidas: ["M12 × 1,75 × 35"], funcao: "Suporte do conjunto de transmissão e motor" });
  assert.ok(termos(t).includes("M12 × 1,75 × 35"));
  assert.ok(termos(t).includes("Suporte do conjunto de transmissão e motor"));
  const sem = termosConfirmados({ codigos: ["7703101596"], nomePeca: "Parafuso de Aço" });
  assert.equal(sem.some((x) => x.origem === "medida" || x.origem === "funcao"), false);
  const lidos = extrairDadosDescricao("Parafuso Aço (M12x1,75-35)\nFunção: Suporte do motor\nCódigo:- 7703101596");
  assert.deepEqual(lidos.medidas, ["M12 × 1,75 × 35"]);
  assert.deepEqual(lidos.funcoes, ["Suporte do motor"]);
});

test("6b) mesmo código em várias escritas vira variações; termo sem sentido não é gerado", () => {
  const t = termosConfirmados({ codigos: ["510959620", "510 959 620"], nomePeca: "Interruptor", funcao: "Comando de abertura do teto solar" });
  const v = t.filter((x) => x.origem === "codigo" || x.origem === "variacao").map((x) => x.termo);
  assert.deepEqual(v, ["510959620", "510 959 620"]);
  assert.equal(termos(t).some((x) => /comando solar/i.test(x)), false);
  // forma curta aprovada antes continua: "Parafuso suporte motor"
  assert.ok(termos(termosConfirmados({ nomePeca: "Parafuso de Aço", funcao: "Suporte do conjunto de transmissão e motor" })).includes("Parafuso suporte motor"));
});

test("7) concorrentes continuam separados e nunca viram dado confirmado", () => {
  const confirmados = termosConfirmados(dados510);
  const s = separarSugestoesConcorrentes(["Golf", "teto solar", "botão", "universal", "Jetta"], confirmados);
  assert.ok(s.every((x) => x.origem === "concorrencia" && x.confirmado === false));
  assert.deepEqual(termos(s), ["Golf", "universal"]);
  assert.equal(termos(termosConfirmados(dados510)).includes("Golf"), false);
});

test("8) Conferência: os 4 campos manuais saíram da tela; dados antigos preservados", () => {
  const conf = lerFonte("src/components/MercadoLivreTeste.jsx");
  for (const rotulo of ["Função / localização da peça\"", "Fonte da função/localização\"", "Especificação técnica / medida\"", "Como o comprador procura (opcional)\""]) {
    assert.equal(conf.includes(`label="${rotulo}`), false, rotulo);
  }
  assert.equal(/setFuncaoPeca|setFonteFuncao|setEspecificacaoTecnica|setTermoComercial/.test(conf), false);
  // valores antigos continuam lidos da ficha e gravados de volta (nada se perde)
  assert.match(conf, /useState\(\(\) => inicial\("funcaoPeca", ""\)\)/);
  assert.match(conf, /dadosTecnicos: \{ funcao: funcaoPeca, fonteFuncao, especificacao: especificacaoTecnica, termoComercial \}/);
  assert.match(conf, /\n\s+funcaoPeca,\n\s+fonteFuncao,\n\s+especificacaoTecnica,\n\s+termoComercial,/);
  // Nome da peça e Código/OEM continuam
  assert.match(conf, /label="Nome da peça"/);
  assert.match(conf, /data-paiia-codigo-oem/);
  // Título/descrição não são alterados pela Inteligência de Busca
  const ib = lerFonte("src/services/inteligenciaBusca.js");
  assert.equal(/setTitulo|setDescricao|tituloAnuncio/.test(ib), false);
});
