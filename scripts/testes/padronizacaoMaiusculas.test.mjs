// (23/10/2026 - E6) Inicial maiúscula em cada palavra do título e da descrição
// (PAIIA Voz e Novo Anúncio), preservando códigos, siglas, acentos, aplicações
// confirmadas e os textos fixos do modelo oficial da loja.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { padronizarTitulo, padronizarDescricao } from "../../src/services/padronizarTextoAnuncio.js";
import * as F from "../../src/modules/paiiaVoz/servicos/fichaVoz.js";
import * as R from "../../src/modules/paiiaVoz/servicos/rascunhoRapido.js";
import * as E from "../../src/modules/paiiaVoz/servicos/edicaoPorVoz.js";

const ler = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

test("título: inicial maiúscula em cada palavra, mesmo tamanho, sem trocar palavras", () => {
  const casos = {
    "lanterna dianteira onibus neobus cristal led": "Lanterna Dianteira Onibus Neobus Cristal LED",
    "SONDA LAMBDA CHEVROLET ÔMEGA 4.1 - 0258003300": "Sonda Lambda Chevrolet Ômega 4.1 - 0258003300",
    "bico injetor ômega 2.2 mpfi": "Bico Injetor Ômega 2.2 MPFI",
    "bobina ignição renault clio ii 1.0 16v": "Bobina Ignição Renault Clio II 1.0 16v",
    "sonda pré-catalisador bosch gol 1.0 flex": "Sonda Pré-Catalisador Bosch Gol 1.0 Flex",
    "kit 2 batentes amortecedor sandero duster logan": "Kit 2 Batentes Amortecedor Sandero Duster Logan",
  };
  for (const [entrada, esperado] of Object.entries(casos)) {
    const t = padronizarTitulo(entrada);
    assert.equal(t, esperado);
    assert.equal(t.length, entrada.length, "o limite de 60 do Mercado Livre não muda");
    assert.equal(t.toLocaleLowerCase("pt-BR"), entrada.toLocaleLowerCase("pt-BR"), "só muda maiúscula/minúscula");
    assert.equal(padronizarTitulo(t), t, "aplicar de novo não muda nada");
  }
});

test("códigos, medidas e motorizações ficam exatamente como estão", () => {
  for (const cod of ["0258003300", "D33011", "es10677", "16600-3AC0A", "7700101970", "0 258 003 300", "HB20", "hb20", "2.0", "16v", "16V", "12V/24V", "10mm", "M10x1,75x55", "F 000 99"]) {
    const t = padronizarTitulo(`sonda ${cod}`);
    assert.ok(t.endsWith(` ${cod}`), `${cod} -> ${t}`);
  }
  assert.equal(padronizarTitulo("parafuso 10 mm 2 kg"), "Parafuso 10 mm 2 kg", "unidade depois de número fica como está");
});

test("siglas, grafias especiais e acentos", () => {
  assert.equal(padronizarTitulo("farol led vw gm abs egr"), "Farol LED VW GM ABS EGR");
  assert.equal(padronizarTitulo("astra SW gti"), "Astra SW GTI");
  assert.equal(padronizarTitulo("sensor E.TorQ McLaren"), "Sensor E.TorQ McLaren", "maiúscula no meio é mantida");
  assert.equal(padronizarTitulo("ômega ÔMEGA Ômega"), "Ômega Ômega Ômega");
  assert.equal(padronizarTitulo("OMEGA"), "Omega", "nenhum acento é inventado");
  assert.equal(padronizarTitulo("CHEVROLET BOSCH RENAULT"), "Chevrolet Bosch Renault");
  assert.equal(padronizarTitulo("válvula ignição pós-catalisador"), "Válvula Ignição Pós-Catalisador");
  assert.equal(padronizarTitulo(""), "");
  assert.equal(padronizarTitulo(undefined), undefined);
});

test("descrição: texto livre padronizado; aplicações, códigos e textos fixos ficam iguais", () => {
  const protegido = [
    "Compatível com os veículos:",
    "CHEVROLET Astra SW 2.0 1998 à 2001",
    "calibra 2.0 16v",
    "",
    "Especificações Técnicas:",
    "Condição do item: Produto novo",
    "",
    "Código de Referência:",
    "0258003300 / D33011 / es10677",
    "",
    "Garantia: 3 Meses",
    "",
    "ATENÇÃO: Antes de efetuar a compra, verifique o código da peça instalada em seu veículo.",
    "",
    "IMPORTANTE: Para evitar a compra de uma peça incompatível, confira sempre o código da peça antes de realizar o pedido.",
    "",
    "Atenção — Antes de efetuar a compra, verifique se o código da peça instalada em seu veículo corresponde a um dos códigos informados no anúncio.",
  ].join("\n");
  const d = padronizarDescricao(`SONDA LAMBDA\n\na peça vem com conector de 4 fios.\n\n${protegido}`);
  assert.ok(d.startsWith("Sonda Lambda\n\nA Peça Vem Com Conector De 4 Fios.\n\n"), d);
  assert.ok(d.endsWith(protegido), "bloco de aplicações, códigos e textos fixos idênticos");
  assert.equal(padronizarDescricao(d), d, "aplicar de novo não muda nada");
  // Formato da busca do catálogo (Novo Anúncio): APLICAÇÃO e CÓDIGO EQUIVALENTE intactos.
  const cat = "SONDA LAMBDA\n\nFABRICANTE:\nBOSCH\n\nAPLICAÇÃO:\nCHEVROLET Astra\n\nCÓDIGO EQUIVALENTE:\nes10677\n\nIMPORTANTE:\n• Confirme a aplicação pelo código da peça original.";
  const c = padronizarDescricao(cat);
  assert.ok(c.includes("APLICAÇÃO:\nCHEVROLET Astra\n"));
  assert.ok(c.includes("CÓDIGO EQUIVALENTE:\nes10677\n"));
  assert.ok(c.includes("IMPORTANTE:\n• Confirme a aplicação pelo código da peça original."));
  assert.ok(c.startsWith("Sonda Lambda\n\nFabricante:\nBosch\n"), c);
  // "APLICAÇÕES:" do Novo Anúncio e quebras de linha do Windows.
  const ap = "APLICAÇÕES:\r\n\r\nCHEVROLET Astra 2.0 1998 até 2001\r\ncalibra 2.0\r\n\r\nsonda nova";
  assert.equal(padronizarDescricao(ap), "APLICAÇÕES:\r\n\r\nCHEVROLET Astra 2.0 1998 até 2001\r\ncalibra 2.0\r\n\r\nSonda Nova", "linha em branco logo após o rótulo continua protegida");
  // Formato antigo (motor de análise): rótulo e valor na mesma linha.
  const ma = "Produto: sonda lambda\nCódigo OEM: 0258003300\nCódigos equivalentes: d33011, es10677\nModelos: ASTRA, calibra\nMotores: 2.0 8v\nFontes técnicas: catlogo_sondas_2020.pdf";
  assert.equal(padronizarDescricao(ma), ma.replace("Produto: sonda lambda", "Produto: Sonda Lambda"));
  // Trecho do catálogo e página: dados da fonte, intactos.
  const tr = "INFORMAÇÕES ENCONTRADAS:\nsonda lambda 4 fios astra/vectra\n\nPÁGINA:\n12";
  assert.equal(padronizarDescricao(tr), tr);
});

test("PAIIA Voz: título, descrição e envio padronizados; aplicações e códigos da ficha intactos", () => {
  let f = F.criarFichaVoz({ id: "e6" });
  f = R.definirTitulo(f, "sonda lambda astra 2.0 - 0258003300");
  assert.equal(R.estadoRapido(f).titulo.valor, "Sonda Lambda Astra 2.0 - 0258003300");
  // comando de voz continua funcionando sobre o título padronizado
  assert.equal(E.editarPorVoz(R.estadoRapido(f).titulo.valor, "troca astra por vectra").texto.toLowerCase(), "sonda lambda vectra 2.0 - 0258003300");
  f = R.definirTextoDescricao(f, "conector de 4 fios");
  const c = JSON.parse(JSON.stringify(f));
  const { id } = F.incluirAplicacao(c, { texto: "Astra", montadora: "Chevrolet", modelos: ["Astra SW"], motores: ["2.0 8V"], anoInicio: 1998, anoFim: 2001 }, { origem: "usuario", agora: 1 });
  f = F.confirmarAplicacao(c, id, true);
  const antes = JSON.stringify({ a: f.aplicacoes, c: f.codigos });
  const texto = R.descricaoParaEnvio(f);
  assert.ok(texto.includes("Conector De 4 Fios."), texto);
  assert.ok(texto.includes("Compatível com os veículos:\nAstra SW 2.0 8V 1998 à 2001"), texto);
  assert.equal(JSON.stringify({ a: f.aplicacoes, c: f.codigos }), antes, "aplicações e códigos da ficha não mudam");
  const { dados } = R.mapearRapidoParaNovoAnuncio(f, { agora: 1 });
  assert.equal(dados.titulo, "Sonda Lambda Astra 2.0 - 0258003300");
  // "Ajustar ao padrão" e as sugestões de título já saem padronizadas
  assert.equal(R.ajustarTitulo("sonda lambda original torken astra - 0258003300", f), "Sonda Lambda Astra - 0258003300");
});

test("Novo Anúncio: tudo que entra é padronizado; o digitado, ao sair do campo e antes da Publicação", () => {
  const na = ler("src/components/NovoAnuncio.jsx");
  assert.ok(na.includes('import { padronizarTitulo, padronizarDescricao } from "../services/padronizarTextoAnuncio";'));
  assert.ok(na.includes("const setTitulo = useCallback((v) => setTituloDigitado((ant) => padronizarTitulo("));
  assert.ok(na.includes("const setDescricao = useCallback((v) => setDescricaoDigitada((ant) => padronizarDescricao("));
  assert.equal((na.match(/useState\(""\);/g) || []).length >= 2, true);
  assert.ok(!/const \[titulo, setTitulo\] = useState/.test(na), "não existe mais setter sem padronização");
  assert.ok(na.includes("setTitulo={setTituloDigitado}\n  aoSairDoTitulo={() => setTitulo((t) => t)}"));
  assert.ok(na.includes("setDescricao={setDescricaoDigitada}\n  aoSairDaDescricao={() => setDescricao((d) => d)}"));
  assert.ok(/const tituloFinal =\n\s+padronizarTitulo\(/.test(na));
  assert.ok(/const descricaoFinal =\n\s+padronizarDescricao\(/.test(na));
  const dp = ler("src/components/DadosPrincipaisAnuncio.jsx");
  assert.ok(dp.includes("onBlur={() => aoSairDoTitulo?.()}"));
  assert.ok(dp.includes("onBlur={() => aoSairDaDescricao?.()}"));
  const dpc = ler("src/components/DadosPeca.jsx");
  assert.ok(dpc.includes("aoSairDoTitulo={aoSairDoTitulo}") && dpc.includes("aoSairDaDescricao={aoSairDaDescricao}"));
});

test("a padronização é só texto: não grava em banco, catálogo, Bling ou Mercado Livre", () => {
  const m = ler("src/services/padronizarTextoAnuncio.js");
  assert.ok(!/^\s*import\s/m.test(m), "módulo sem dependências");
  assert.ok(!/supabase|fetch\(|localStorage|\.from\(|bling|mercadolivre|insert|update\(|upsert/i.test(m.replace(/\/\/.*$/gm, "")));
});
