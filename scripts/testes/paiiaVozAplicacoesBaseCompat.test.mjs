// =============================================================
// PAIIA Voz — (08/11) duas correções pontuais:
//  1) Aplicações encontradas na Base PAIIA entram SOZINHAS na Descrição Organizada
//     (sem marcar na Compatibilidade). Confirmadas por você ≠ encontradas na base.
//     A validação do Mercado Livre continua na Finalizar (só as confirmadas).
//  2) Tela "Veículo compatível" no mesmo estilo azul premium da calculadora.
//   node --test scripts/testes/paiiaVozAplicacoesBaseCompat.test.mjs
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { register } from "node:module";

register("./simulacao/ganchoSupabaseFalso.mjs", import.meta.url);

const R = await import("../../src/modules/paiiaVoz/servicos/rascunhoRapido.js");
const F = await import("../../src/modules/paiiaVoz/servicos/fichaVoz.js");
const ler = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

// IWP211: o que a Base PAIIA devolve (3 aplicações Ford 1.0, 2008 a 2010; 2 códigos).
const ap = (modelo) => ({ texto: `Ford ${modelo} 1.0 2008 a 2010`, montadora: "Ford", modelos: [modelo], motores: ["1.0"], anoInicio: 2008, anoFim: 2010 });
const IWP211 = { encontrado: true, codigo: "IWP211", origem: "catalogo", rotulo: "Base PAIIA (Criar Anúncio)", descricao: "Bico Injetor", aplicacoes: [ap("Ka"), ap("Ecosport"), ap("Fiesta")], codigos: ["50174302", "9S4G9F593CA"] };
const LISTA = "Compatível com os veículos:\nKa 1.0 2008 à 2010\nEcosport 1.0 2008 à 2010\nFiesta 1.0 2008 à 2010";

function fichaComBase(res = IWP211) {
  let f = F.aplicarInterpretacao(F.criarFichaVoz({ id: "iwp", agora: 1 }), { itens: [{ campo: "codigoPrincipal", valor: "IWP211" }], naoEntendido: [], avisos: [] }).ficha;
  f = R.definirTitulo(f, "Bico Injetor");
  f = R.registrarConsultaBase(f, res);
  return R.marcarBaseAproveitada(F.incorporarResultadoBase(f, res).ficha);
}

test("1) IWP211: as 3 aplicações da base aparecem na Descrição Organizada assim que a pesquisa termina, sem marcar nada", () => {
  const f = fichaComBase();
  assert.equal(F.aplicacoesConfirmadas(f).length, 0, "nenhuma foi confirmada por você");
  assert.ok(R.organizarDescricao(f).texto.includes(LISTA), R.organizarDescricao(f).texto);
  assert.ok(R.descricaoParaEnvio(f).includes(LISTA), "a mesma descrição segue para o anúncio");
});

test("2) diferença entre 'encontrada na base' e 'confirmada por você'; desmarcar tira da descrição", () => {
  let f = fichaComBase();
  const [ka, eco] = f.aplicacoes;
  assert.deepEqual(f.aplicacoes.map((a) => R.situacaoNaDescricao(a).estado), ["base", "base", "base"]);
  assert.match(R.situacaoNaDescricao(ka).texto, /Base PAIIA/);
  f = F.confirmarAplicacao(f, ka.id, true);
  assert.equal(R.situacaoNaDescricao(f.aplicacoes[0]).estado, "confirmada");
  assert.equal(F.aplicacoesConfirmadas(f).length, 1, "só a Ka foi confirmada (é o que a Finalizar valida no Mercado Livre)");
  // marcou e desmarcou: você recusou → sai da descrição
  f = F.confirmarAplicacao(f, eco.id, true);
  f = F.confirmarAplicacao(f, eco.id, false);
  assert.equal(R.situacaoNaDescricao(f.aplicacoes[1]).estado, "fora");
  const t = R.organizarDescricao(f).texto;
  assert.ok(t.includes("Ka 1.0 2008 à 2010") && t.includes("Fiesta 1.0 2008 à 2010") && !t.includes("Ecosport"), t);
});

test("3) sem aplicações na base: cadastro manual continua (informada por você e não marcada fica fora; adicionada já confirmada entra)", () => {
  let f = fichaComBase({ ...IWP211, aplicacoes: [] });
  assert.ok(!R.organizarDescricao(f).texto.includes("Compatível com os veículos:"));
  const c = JSON.parse(JSON.stringify(f));
  const { id } = F.incluirAplicacao(c, { texto: "Gol", montadora: "VW", modelos: ["Gol"], motores: ["1.6"], anoInicio: 2010, anoFim: 2014 }, { origem: "usuario", agora: 1 });
  assert.equal(R.situacaoNaDescricao(c.aplicacoes[0]).estado, "fora");
  assert.ok(!R.organizarDescricao(c).texto.includes("Gol"));
  f = F.confirmarAplicacao(c, id, true);
  assert.ok(R.organizarDescricao(f).texto.includes("Compatível com os veículos:\nGol 1.6 2010 à 2014"));
});

test("4) Base validada: a linha 'Aplicação: …' do texto não repete a lista de veículos", async () => {
  const res = { ...IWP211, origem: "base_validada", rotulo: "Base validada PAIIA" };
  let f = fichaComBase(res);
  // o texto exatamente como a montagem da Base validada (consultaBaseVoz) entrega
  const { montarDescricaoDaBase } = await import("../../src/modules/paiiaVoz/servicos/consultaBaseVoz.js");
  f = R.definirTextoDescricao(f, montarDescricaoDaBase(res));
  const t = R.organizarDescricao(f).texto;
  assert.ok(t.includes(LISTA), t);
  for (const m of ["Ka", "Ecosport", "Fiesta"]) assert.equal((t.match(new RegExp(`${m} 1\\.0`, "g")) || []).length, 1, `${m} uma vez só:\n${t}`);
  assert.ok(R.organizarDescricao(f).informacoes.some((i) => /^Bico Injetor/.test(i)), "o resto do texto é preservado");
  // sem aplicações na lista (todas desmarcadas), a linha do texto continua como estava
  for (const a of f.aplicacoes) { f = F.confirmarAplicacao(f, a.id, true); f = F.confirmarAplicacao(f, a.id, false); }
  assert.match(R.organizarDescricao(f).texto, /Aplicação: Ford Ka/);
});

test("5) avisos: as da base não são mais 'de fora da descrição'; a validação do Mercado Livre fica na Finalizar", () => {
  const v = R.validarRapido(fichaComBase(), { fotos: 1 });
  assert.ok(!v.avisos.some((a) => /ficam de fora da descrição/.test(a)), v.avisos.join(" | "));
  assert.ok(v.avisos.some((a) => /3 aplicação\(ões\) da Base PAIIA/.test(a) && /Finalizar/.test(a)), v.avisos.join(" | "));
});

test("6) tela Compatibilidade: cada aplicação mostra se veio da base (já na descrição) ou foi confirmada por você", () => {
  const t = ler("src/modules/paiiaVoz/PaiiaVozRapido.jsx");
  assert.ok(t.includes("data-pv-aplicacao-origem={situacaoNaDescricao(a).estado}"));
  assert.ok(t.includes("situacaoNaDescricao(a).texto"));
  assert.ok(t.includes("data-pv-confirmar-aplicacao") && t.includes("data-pv-editar-aplicacao") && t.includes("removerAplicacao(fichaRef.current, a.id)"), "confirmar, editar e remover preservados");
});

test("7) tela Veículo compatível: azul premium da calculadora, campos escuros, 2 colunas no computador e 1 no celular", () => {
  const t = ler("src/modules/paiiaVoz/PaiiaVozRapido.jsx");
  const bloco = t.slice(t.indexOf("data-pv-veiculo-rapido"), t.indexOf("data-pv-aplicacao-completa"));
  assert.ok(bloco.includes('className="pr-veic"') || t.includes('className="pr-veic" data-pv-veiculo-rapido'), "cartão no estilo da calculadora");
  assert.ok(!bloco.includes('className="pr-entrada"'), "o input não usa mais a classe que o deixava branco");
  for (const r of ["Falar a aplicação", "Adicionar veículo", "{ROTULOS_VEIC[k]}"]) assert.ok(bloco.includes(r), r);
  assert.ok(t.includes('const ROTULOS_VEIC = { montadora: "Montadora", modelo: "Modelo", motor: "Motor (opcional)", anoInicio: "Ano Inicial", anoFim: "Ano Final (opcional)" }'), "rótulos dos 5 campos");
  for (const d of ["data-pv-veic={k}", "data-pv-veic-adicionar", "data-pv-veic-falar-tudo", "micCampo(`veic:${k}`", "data-pv-campo-direto={`veic:${k}`}"]) assert.ok(bloco.includes(d), d);
  const css = t.slice(t.indexOf(".pr-veic {"));
  assert.match(css, /\.pr-veic \{[^}]*linear-gradient\(160deg,#0b1f4d 0%,#123a8a 100%\)[^}]*border: 1px solid #2f5fd0/, "mesmo fundo e borda da calculadora");
  assert.match(css, /\.pr-veic-grade \{[^}]*grid-template-columns: repeat\(auto-fit, minmax\(min\(100%, max\(165px, 45%\)\), 1fr\)\)/, "2 colunas quando há espaço, 1 no celular");
  assert.match(css, /\.pr-veic-campo \{[^}]*background: #0a1838/, "campo escuro");
  assert.match(css, /\.pr-veic-campo input \{[^}]*background: transparent[^}]*border-bottom: 1px solid #2f5fd0[^}]*color: #e8efff/, "texto legível com borda azul");
  assert.match(css, /\.pr-veic-linha \{[^}]*align-items: center/, "microfone alinhado ao campo");
});

test("8) a tela de produção usa ESTE componente: App → PaiiaVoz → PaiiaVozRapido → etapa compat com o cartão azul", () => {
  const app = ler("src/App.jsx");
  assert.ok(app.includes('import PaiiaVoz from "./modules/paiiaVoz/PaiiaVoz"') && app.includes('screen === "paiiaVoz"'));
  const voz = ler("src/modules/paiiaVoz/PaiiaVoz.jsx");
  assert.ok(voz.includes('import PaiiaVozRapido from "./PaiiaVozRapido"') && voz.includes("<PaiiaVozRapido {...props}"));
  const t = ler("src/modules/paiiaVoz/PaiiaVozRapido.jsx");
  const compat = t.slice(t.indexOf('{etapa === "compat" && ('), t.indexOf('{etapa === "categoria" && ('));
  assert.ok(compat.includes('<div className="pr-veic" data-pv-veiculo-rapido>'), "o cartão azul está dentro da etapa compat renderizada");
  assert.equal((t.match(/data-pv-veiculo-rapido/g) || []).length, 1, "não há outro cartão de veículo");
});

test("9) versão visível no topo identifica a publicação (para conferir no site)", () => {
  const t = ler("src/modules/paiiaVoz/PaiiaVozRapido.jsx");
  assert.ok(t.includes('export const VERSAO_PAIIA_VOZ = "08/11 · publicou, limpou e pronto"'));
});
